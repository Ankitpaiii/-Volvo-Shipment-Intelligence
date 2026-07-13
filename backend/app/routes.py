from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import ExceptionRecord, ExceptionStatus, MilestoneEvent, Shipment
from app.constants import MILESTONE_TEMPLATE
from app.schemas import (
    CarrierScorecard,
    CopilotRequest,
    CopilotResponse,
    ETAResponse,
    EventCreate,
    EventResponse,
    ExceptionAction,
    ExceptionResponse,
    ExtendedKPIResponse,
    KPIResponse,
    LanePerformance,
    PaginatedShipments,
    ShipmentCreate,
    ShipmentDetail,
    ShipmentSummary,
    ShipmentUpdate,
)
from app.services.copilot import answer_question
from app.services.gap_detection import (
    compute_dwell_time_hours,
    compute_risk_and_health,
    update_shipment_scores,
)
from app.services.notifications import send_notification

router = APIRouter(prefix="/api/v1")


# ──────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "volvo-shipment-tracking", "version": "2.0.0"}


# ──────────────────────────────────────────────
# KPIs
# ──────────────────────────────────────────────

@router.get("/kpis", response_model=KPIResponse)
def get_kpis(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    in_transit = sum(1 for s in shipments if s.status in ("IN_TRANSIT", "AT_RISK", "DELAYED"))
    at_risk = sum(1 for s in shipments if s.delay_risk_score >= 40)
    missing = sum(1 for s in shipments if any(f in (s.flags or []) for f in ("low_milestone_progress", "gps_stale_45min", "gps_stale_90min")))
    open_exc = db.query(ExceptionRecord).filter(ExceptionRecord.status == ExceptionStatus.OPEN.value).count()
    avg_health = sum(s.health_score for s in shipments) / max(1, len(shipments))
    return KPIResponse(
        shipments_in_transit=in_transit,
        at_risk_count=at_risk,
        missing_milestone_count=missing,
        open_exceptions=open_exc,
        avg_health_score=round(avg_health, 1),
    )


@router.get("/kpis/extended", response_model=ExtendedKPIResponse)
def get_extended_kpis(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    in_transit = sum(1 for s in shipments if s.status in ("IN_TRANSIT", "AT_RISK", "DELAYED"))
    at_risk = sum(1 for s in shipments if s.delay_risk_score >= 40)
    missing = sum(1 for s in shipments if any(f in (s.flags or []) for f in ("low_milestone_progress", "gps_stale_45min", "gps_stale_90min")))
    open_exc = db.query(ExceptionRecord).filter(ExceptionRecord.status == ExceptionStatus.OPEN.value).count()
    avg_health = sum(s.health_score for s in shipments) / max(1, len(shipments))

    # OTIF
    delivered = [s for s in shipments if s.actual_delivery]
    on_time = [s for s in delivered if s.actual_delivery and s.actual_delivery <= s.planned_delivery]
    otif_pct = round(100 * len(on_time) / max(1, len(delivered)), 1)

    # On-time pickup
    picked_up = [s for s in shipments if s.actual_pickup]
    on_time_pickup = [s for s in picked_up if s.actual_pickup and s.actual_pickup <= s.planned_pickup + timedelta(hours=2)]
    pickup_pct = round(100 * len(on_time_pickup) / max(1, len(picked_up)), 1)

    # Avg dwell time
    dwell_times = []
    for s in delivered:
        events = db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()
        dwell = compute_dwell_time_hours(s, events)
        if dwell is not None:
            dwell_times.append(dwell)
    avg_dwell = round(sum(dwell_times) / max(1, len(dwell_times)), 1)

    # Carrier compliance (shipments without PICKUP_COMPLETED that should have it)
    should_have_pickup = [s for s in shipments if s.actual_pickup]
    events_map: dict[str, set] = {}
    compliant = 0
    for s in should_have_pickup:
        if s.shipment_id not in events_map:
            evts = db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()
            events_map[s.shipment_id] = {e.event_type for e in evts}
        if "PICKUP_COMPLETED" in events_map[s.shipment_id]:
            compliant += 1
    carrier_compliance = round(100 * compliant / max(1, len(should_have_pickup)), 1)

    critical_at_risk = sum(1 for s in shipments if s.part_criticality in ("JIT", "JIS") and s.delay_risk_score >= 40)

    return ExtendedKPIResponse(
        shipments_in_transit=in_transit,
        at_risk_count=at_risk,
        missing_milestone_count=missing,
        open_exceptions=open_exc,
        avg_health_score=round(avg_health, 1),
        otif_pct=otif_pct,
        on_time_pickup_pct=pickup_pct,
        avg_dwell_hours=avg_dwell,
        carrier_compliance_pct=carrier_compliance,
        critical_at_risk=critical_at_risk,
        total_shipments=len(shipments),
    )


# ──────────────────────────────────────────────
# Shipments
# ──────────────────────────────────────────────

@router.post("/shipments", response_model=ShipmentDetail)
def create_shipment(payload: ShipmentCreate, db: Session = Depends(get_db)):
    shipment = Shipment(**payload.model_dump())
    db.add(shipment)
    db.flush()
    db.add(
        MilestoneEvent(
            shipment_id=shipment.shipment_id,
            event_type="TRANSPORT_ORDER_CREATED",
            source="manual",
            event_time=datetime.utcnow(),
            payload={"created_by": "api"},
        )
    )
    db.commit()
    db.refresh(shipment)
    return shipment


@router.get("/shipments", response_model=PaginatedShipments)
def list_shipments(
    status: str | None = None,
    carrier: str | None = None,
    lane: str | None = None,
    search: str | None = None,
    criticality: str | None = None,
    sort: str = Query("risk", pattern="^(risk|eta|health)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Shipment)
    if status:
        q = q.filter(Shipment.status == status)
    if carrier:
        q = q.filter(Shipment.carrier_name.ilike(f"%{carrier}%"))
    if lane:
        q = q.filter(Shipment.lane_name.ilike(f"%{lane}%"))
    if criticality:
        q = q.filter(Shipment.part_criticality == criticality)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Shipment.po_number.ilike(term) |
            Shipment.supplier_name.ilike(term) |
            Shipment.carrier_name.ilike(term) |
            Shipment.lane_name.ilike(term) |
            Shipment.origin_city.ilike(term) |
            Shipment.dest_city.ilike(term)
        )

    total = q.count()

    if sort == "eta":
        q = q.order_by(Shipment.planned_delivery.asc())
    elif sort == "health":
        q = q.order_by(Shipment.health_score.asc())
    else:
        q = q.order_by(Shipment.delay_risk_score.desc())

    items = q.offset((page - 1) * limit).limit(limit).all()
    return PaginatedShipments(items=items, total=total, page=page, limit=limit)


@router.get("/shipments/{shipment_id}", response_model=ShipmentDetail)
def get_shipment(shipment_id: str, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}})
    return shipment


@router.patch("/shipments/{shipment_id}", response_model=ShipmentDetail)
def update_shipment(shipment_id: str, payload: ShipmentUpdate, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}})
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(shipment, key, value)
    db.commit()
    db.refresh(shipment)
    return shipment


@router.post("/shipments/{shipment_id}/events", response_model=EventResponse)
def add_event(shipment_id: str, payload: EventCreate, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}})

    event = MilestoneEvent(
        shipment_id=shipment_id,
        event_type=payload.event_type,
        source=payload.source,
        event_time=payload.event_time or datetime.utcnow(),
        payload=payload.payload,
    )
    db.add(event)
    if payload.event_type == "GPS_PING" and "lat" in payload.payload and "lng" in payload.payload:
        shipment.current_lat = payload.payload["lat"]
        shipment.current_lng = payload.payload["lng"]
    update_shipment_scores(db, shipment)
    db.commit()
    db.refresh(event)
    return event


@router.get("/shipments/{shipment_id}/events", response_model=list[EventResponse])
def list_events(shipment_id: str, db: Session = Depends(get_db)):
    return (
        db.query(MilestoneEvent)
        .filter(MilestoneEvent.shipment_id == shipment_id)
        .order_by(MilestoneEvent.event_time.asc())
        .all()
    )


@router.get("/shipments/{shipment_id}/eta", response_model=ETAResponse)
def get_eta(shipment_id: str, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}})
    events = db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == shipment_id).all()
    risk, health, flags, predicted, confidence = compute_risk_and_health(shipment, events)
    non_gps = [e for e in events if e.event_type != "GPS_PING"]
    last = max(non_gps, key=lambda e: e.event_time) if non_gps else None
    return ETAResponse(
        shipment_id=shipment_id,
        predicted_delivery=predicted,
        confidence=confidence,
        delay_risk_score=risk,
        health_score=health,
        last_event={"type": last.event_type, "time": last.event_time.isoformat()} if last else None,
        flags=flags,
    )


# ──────────────────────────────────────────────
# Exceptions
# ──────────────────────────────────────────────

@router.get("/exceptions", response_model=list[ExceptionResponse])
def list_exceptions(
    severity: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(ExceptionRecord)
    if severity:
        q = q.filter(ExceptionRecord.severity == severity)
    if status:
        q = q.filter(ExceptionRecord.status == status)
    records = q.order_by(ExceptionRecord.business_impact_score.desc(), ExceptionRecord.raised_at.desc()).all()
    result = []
    for r in records:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == r.shipment_id).first()
        result.append(
            ExceptionResponse(
                exception_id=r.exception_id,
                shipment_id=r.shipment_id,
                po_number=shipment.po_number if shipment else None,
                lane_name=shipment.lane_name if shipment else None,
                dest_city=shipment.dest_city if shipment else None,
                exception_type=r.exception_type,
                severity=r.severity,
                root_cause=r.root_cause,
                status=r.status,
                business_impact_score=r.business_impact_score,
                message=r.message,
                recommended_action=r.recommended_action,
                raised_at=r.raised_at,
                resolved_at=r.resolved_at,
            )
        )
    return result


@router.post("/exceptions/{exception_id}/actions", response_model=ExceptionResponse)
def exception_action(exception_id: str, payload: ExceptionAction, db: Session = Depends(get_db)):
    record = db.query(ExceptionRecord).filter(ExceptionRecord.exception_id == exception_id).first()
    if not record:
        raise HTTPException(status_code=404, detail={"error": {"code": "EXCEPTION_NOT_FOUND", "message": "Exception not found"}})

    if payload.action == "acknowledge":
        record.status = ExceptionStatus.ACKNOWLEDGED.value
    elif payload.action == "resolve":
        record.status = ExceptionStatus.RESOLVED.value
        record.resolved_at = datetime.utcnow()
    elif payload.action == "approve_recommendation":
        record.status = ExceptionStatus.ACKNOWLEDGED.value
        send_notification(
            "email",
            "transport.organizer@volvo.com",
            f"Action approved: {record.exception_type}",
            record.recommended_action or "No action specified",
        )

    db.commit()
    db.refresh(record)
    shipment = db.query(Shipment).filter(Shipment.shipment_id == record.shipment_id).first()
    return ExceptionResponse(
        exception_id=record.exception_id,
        shipment_id=record.shipment_id,
        po_number=shipment.po_number if shipment else None,
        lane_name=shipment.lane_name if shipment else None,
        dest_city=shipment.dest_city if shipment else None,
        exception_type=record.exception_type,
        severity=record.severity,
        root_cause=record.root_cause,
        status=record.status,
        business_impact_score=record.business_impact_score,
        message=record.message,
        recommended_action=record.recommended_action,
        raised_at=record.raised_at,
        resolved_at=record.resolved_at,
    )


# ──────────────────────────────────────────────
# AI Copilot
# ──────────────────────────────────────────────

@router.post("/copilot/chat", response_model=CopilotResponse)
async def copilot_chat(payload: CopilotRequest, db: Session = Depends(get_db)):
    answer, sources = await answer_question(
        db, payload.question, settings.anthropic_api_key, payload.session_id
    )
    return CopilotResponse(answer=answer, sources=sources)


# ──────────────────────────────────────────────
# Reports / Analytics
# ──────────────────────────────────────────────

@router.get("/reports/otif")
def otif_report(from_date: str | None = None, to_date: str | None = None, plant: str | None = None, db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    if plant:
        shipments = [s for s in shipments if plant.lower() in s.dest_city.lower()]
    delivered = [s for s in shipments if s.actual_delivery]
    on_time = [s for s in delivered if s.actual_delivery and s.actual_delivery <= s.planned_delivery]
    return {
        "total_shipments": len(shipments),
        "delivered": len(delivered),
        "on_time_in_full_pct": round(100 * len(on_time) / max(1, len(delivered)), 1),
        "avg_delay_risk": round(sum(s.delay_risk_score for s in shipments) / max(1, len(shipments)), 1),
    }


@router.get("/reports/carrier-scorecards", response_model=list[CarrierScorecard])
def carrier_scorecards(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    carrier_data: dict[str, dict] = defaultdict(lambda: {
        "total": 0, "at_risk": 0, "total_risk": 0,
        "on_time": 0, "delivered": 0, "p1_exceptions": 0, "compliant": 0, "should_pickup": 0
    })

    for s in shipments:
        c = s.carrier_name
        carrier_data[c]["total"] += 1
        carrier_data[c]["total_risk"] += s.delay_risk_score
        if s.delay_risk_score >= 40:
            carrier_data[c]["at_risk"] += 1
        if s.actual_delivery:
            carrier_data[c]["delivered"] += 1
            if s.actual_delivery <= s.planned_delivery:
                carrier_data[c]["on_time"] += 1
        if s.actual_pickup:
            carrier_data[c]["should_pickup"] += 1
            # Check if PICKUP_COMPLETED event exists
            evts = {e.event_type for e in db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()}
            if "PICKUP_COMPLETED" in evts:
                carrier_data[c]["compliant"] += 1

    # P1 exceptions per carrier
    p1_exc = db.query(ExceptionRecord).filter(ExceptionRecord.severity == "P1").all()
    for exc in p1_exc:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == exc.shipment_id).first()
        if shipment:
            carrier_data[shipment.carrier_name]["p1_exceptions"] += 1

    result = []
    for name, data in sorted(carrier_data.items(), key=lambda x: x[1]["total"], reverse=True):
        total = data["total"]
        result.append(CarrierScorecard(
            carrier_name=name,
            total_shipments=total,
            at_risk_count=data["at_risk"],
            avg_risk_score=round(data["total_risk"] / max(1, total), 1),
            on_time_rate=round(100 * data["on_time"] / max(1, data["delivered"]), 1),
            compliance_rate=round(100 * data["compliant"] / max(1, data["should_pickup"]), 1),
            p1_exception_count=data["p1_exceptions"],
        ))
    return result


@router.get("/reports/lane-performance", response_model=list[LanePerformance])
def lane_performance(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    lane_data: dict[str, dict] = defaultdict(lambda: {
        "origin": "", "dest": "", "total": 0, "total_risk": 0,
        "on_time": 0, "delivered": 0, "milestone_completeness": 0.0, "exceptions": 0
    })

    milestone_required = set(MILESTONE_TEMPLATE)

    for s in shipments:
        lane = s.lane_name
        lane_data[lane]["origin"] = s.origin_city
        lane_data[lane]["dest"] = s.dest_city
        lane_data[lane]["total"] += 1
        lane_data[lane]["total_risk"] += s.delay_risk_score
        if s.actual_delivery:
            lane_data[lane]["delivered"] += 1
            if s.actual_delivery <= s.planned_delivery:
                lane_data[lane]["on_time"] += 1

        evts = {e.event_type for e in db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()}
        completeness = len(evts & milestone_required) / max(1, len(milestone_required))
        lane_data[lane]["milestone_completeness"] += completeness

    # Count active exceptions per lane
    open_exc = db.query(ExceptionRecord).filter(ExceptionRecord.status == ExceptionStatus.OPEN.value).all()
    for exc in open_exc:
        ship = db.query(Shipment).filter(Shipment.shipment_id == exc.shipment_id).first()
        if ship:
            lane_data[ship.lane_name]["exceptions"] += 1

    result = []
    for name, data in sorted(lane_data.items(), key=lambda x: x[1]["total_risk"] / max(1, x[1]["total"]), reverse=True):
        total = data["total"]
        result.append(LanePerformance(
            lane_name=name,
            origin_city=data["origin"],
            dest_city=data["dest"],
            total_shipments=total,
            avg_risk_score=round(data["total_risk"] / max(1, total), 1),
            on_time_rate=round(100 * data["on_time"] / max(1, data["delivered"]), 1),
            avg_milestone_completeness=round(100 * data["milestone_completeness"] / max(1, total), 1),
            active_exceptions=data["exceptions"],
        ))
    return result
