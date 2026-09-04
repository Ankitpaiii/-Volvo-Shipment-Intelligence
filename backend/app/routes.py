"""
API Routes for Volvo Shipment Intelligence & Intelligent Container Yard Management ML.
Combines live shipment tracking, GPS gap detection, AI copilot, carrier scorecards,
and Computer Vision, OCR Gate Inspection, 2D Digital Twin, and RL Slot Allocation.
"""
from collections import defaultdict
from datetime import datetime, timedelta
import json
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.constants import MILESTONE_TEMPLATE
from app.database import get_db
from app.models import (
    Container,
    ContainerStatus,
    ExceptionRecord,
    ExceptionStatus,
    GateInspection,
    MilestoneEvent,
    MLPredictionLog,
    Shipment,
    ShipmentStatus,
    YardSlot,
)
from app.ml.delay_predictor import delay_predictor
from app.ml.yard_allocator import (
    YardSlotAllocator,
    compute_slot_cost,
    manhattan_distance_to_gate,
    _block_occupancy,
    _same_dest_neighbours,
    _get_empty_slots,
)
from app.ml.evaluation.eval_cv_ocr import evaluate_cv_ocr_pipeline
from app.schemas import (
    AllocationBenchmarkResponse,
    AllocationComparisonResponse,
    CarrierScorecard,
    ContainerSummary,
    CopilotRequest,
    CopilotResponse,
    CVOCRMetricsResponse,
    DelayPredictionRequest,
    DelayPredictionResponse,
    ETAResponse,
    EventCreate,
    EventResponse,
    ExceptionAction,
    ExceptionResponse,
    ExtendedKPIResponse,
    GateInspectionRequest,
    GateInspectionResponse,
    KPIResponse,
    LanePerformance,
    MLMetricsResponse,
    PaginatedShipments,
    RLEvaluationResponse,
    ShipmentCreate,
    ShipmentDetail,
    ShipmentSummary,
    ShipmentUpdate,
    SlotAllocationRequest,
    SlotAllocationResponse,
    YardStateResponse,
)
from app.services.copilot import answer_question
from app.services.gap_detection import (
    compute_dwell_time_hours,
    compute_risk_and_health,
    update_shipment_scores,
)
from app.services.inspection_service import process_gate_image
from app.services.notifications import send_notification
from app.services.yard_service import assign_container_to_slot, get_yard_state

router = APIRouter(prefix="/api/v1")


# ──────────────────────────────────────────────
# Health & Status
# ──────────────────────────────────────────────

@router.get("/health")
def health():
    q_table_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "ml", "artifacts", "q_table.npy"
    )
    return {
        "status": "ok",
        "service": "volvo-shipment-tracking-and-yard-ml",
        "version": "3.0.0",
        "ml_models_loaded": {
            "baseline_linear": delay_predictor.baseline_model is not None,
            "random_forest": delay_predictor.rf_model is not None,
            "xgboost": delay_predictor.xgb_model is not None,
            "rl_q_table": os.path.exists(q_table_path),
        }
    }


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

    # Carrier compliance
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

    risk_score, health_score, flags = compute_risk_and_health(db, shipment)

    delay_minutes = 0
    if shipment.predicted_delivery and shipment.planned_delivery:
        diff = (shipment.predicted_delivery - shipment.planned_delivery).total_seconds() / 60.0
        delay_minutes = max(0, int(diff))

    factors = []
    for f in flags:
        impact = 15 if "stale" in f or "delay" in f else 10
        factors.append({"factor": f.replace("_", " ").title(), "impact_minutes": impact})

    return ETAResponse(
        shipment_id=shipment_id,
        planned_delivery=shipment.planned_delivery,
        predicted_delivery=shipment.predicted_delivery,
        eta_confidence=shipment.eta_confidence,
        delay_minutes=delay_minutes,
        route_risk_factor=round(1.0 + (risk_score / 100.0) * 0.5, 2),
        factors=factors,
    )


# ──────────────────────────────────────────────
# Exceptions
# ──────────────────────────────────────────────

@router.get("/exceptions", response_model=list[ExceptionResponse])
def list_exceptions(
    status: str | None = None,
    severity: str | None = None,
    shipment_id: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(ExceptionRecord)
    if status:
        q = q.filter(ExceptionRecord.status == status)
    if severity:
        q = q.filter(ExceptionRecord.severity == severity)
    if shipment_id:
        q = q.filter(ExceptionRecord.shipment_id == shipment_id)

    records = q.order_by(ExceptionRecord.raised_at.desc()).all()
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
    return CopilotResponse(answer=answer, sources=sources, session_id=payload.session_id or "default")


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
        "on_time": 0, "delivered": 0, "p1_exceptions": 0, "compliant": 0, "should_pickup": 0,
        "total_transit_variance_days": 0.0,
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
            variance_days = (s.actual_delivery - s.planned_delivery).total_seconds() / 86400.0
            carrier_data[c]["total_transit_variance_days"] += variance_days

        p1_exc = db.query(ExceptionRecord).filter(
            ExceptionRecord.shipment_id == s.shipment_id,
            ExceptionRecord.severity == "P1",
        ).count()
        carrier_data[c]["p1_exceptions"] += p1_exc

        if s.actual_pickup:
            carrier_data[c]["should_pickup"] += 1
            events = {e.event_type for e in db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()}
            if "PICKUP_COMPLETED" in events:
                carrier_data[c]["compliant"] += 1

    result = []
    for carrier, data in carrier_data.items():
        total = data["total"]
        delivered = data["delivered"]
        otif = round(100.0 * data["on_time"] / max(1, delivered), 1) if delivered > 0 else 85.0
        on_time = otif
        comp = round(100.0 * data["compliant"] / max(1, data["should_pickup"]), 1) if data["should_pickup"] > 0 else 90.0
        exc_rate = round(100.0 * data["p1_exceptions"] / max(1, total), 1)
        avg_var = round(data["total_transit_variance_days"] / max(1, delivered), 1) if delivered > 0 else 0.5

        result.append(CarrierScorecard(
            carrier_name=carrier,
            total_shipments=total,
            shipment_count=total,
            at_risk_count=data["at_risk"],
            avg_risk_score=round(data["total_risk"] / max(1, total), 1),
            on_time_rate=on_time,
            otif_rate=otif,
            compliance_rate=comp,
            p1_exception_count=data["p1_exceptions"],
            exception_rate=exc_rate,
            avg_transit_days_variance=avg_var,
        ))
    return sorted(result, key=lambda x: x.total_shipments, reverse=True)


@router.get("/reports/lane-performance", response_model=list[LanePerformance])
def lane_performance(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    lane_data: dict[str, dict] = defaultdict(lambda: {
        "origin": "", "dest": "", "total": 0, "total_risk": 0,
        "on_time": 0, "delivered": 0, "milestone_completeness": 0.0, "exceptions": 0,
        "carrier_counts": defaultdict(int),
    })

    milestone_required = set(MILESTONE_TEMPLATE)

    for s in shipments:
        lane = s.lane_name
        lane_data[lane]["origin"] = s.origin_city
        lane_data[lane]["dest"] = s.dest_city
        lane_data[lane]["total"] += 1
        lane_data[lane]["total_risk"] += s.delay_risk_score
        lane_data[lane]["carrier_counts"][s.carrier_name] += 1
        if s.actual_delivery:
            lane_data[lane]["delivered"] += 1
            if s.actual_delivery <= s.planned_delivery:
                lane_data[lane]["on_time"] += 1

        evts = {e.event_type for e in db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()}
        completeness = len(evts & milestone_required) / max(1, len(milestone_required))
        lane_data[lane]["milestone_completeness"] += completeness

    open_exc = db.query(ExceptionRecord).filter(ExceptionRecord.status == ExceptionStatus.OPEN.value).all()
    for exc in open_exc:
        ship = db.query(Shipment).filter(Shipment.shipment_id == exc.shipment_id).first()
        if ship:
            lane_data[ship.lane_name]["exceptions"] += 1

    result = []
    for name, data in sorted(lane_data.items(), key=lambda x: x[1]["total_risk"] / max(1, x[1]["total"]), reverse=True):
        total = data["total"]
        otif = round(100.0 * data["on_time"] / max(1, data["delivered"]), 1) if data["delivered"] > 0 else 88.0
        dominant = max(data["carrier_counts"].items(), key=lambda x: x[1])[0] if data["carrier_counts"] else "Volvo Logistics"
        risk = round(data["total_risk"] / max(1, total), 1)

        result.append(LanePerformance(
            lane_name=name,
            origin_city=data["origin"],
            dest_city=data["dest"],
            total_shipments=total,
            avg_risk_score=risk,
            avg_delay_risk_score=risk,
            on_time_rate=otif,
            otif_rate=otif,
            avg_milestone_completeness=round(100.0 * data["milestone_completeness"] / max(1, total), 1),
            active_exceptions=data["exceptions"],
            dominant_carrier=dominant,
        ))
    return result


# ──────────────────────────────────────────────
# Computer Vision & Gate Inspection Endpoints
# ──────────────────────────────────────────────

@router.post("/inspection/process-gate", response_model=GateInspectionResponse)
async def process_gate_inspection(
    file: Optional[UploadFile] = File(None),
    payload: Optional[GateInspectionRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Execute end-to-end Container Gate Processing:
    Image Input -> YOLOv8 Detection -> EasyOCR Extraction -> ISO 6346 Validation -> Database Logging.
    """
    if file is not None:
        contents = await file.read()
        res = process_gate_image(contents, filename=file.filename, db=db)
    elif payload and payload.image_path:
        res = process_gate_image(payload.image_path, db=db)
    else:
        sample_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "data", "sample_images", "gate_test_01_mscu.jpg"
        )
        if not os.path.exists(sample_path):
            from app.ml.evaluation.generate_test_dataset import create_standard_testbed
            create_standard_testbed()
        res = process_gate_image(sample_path, db=db)

    return GateInspectionResponse(**res)


@router.get("/inspection/metrics", response_model=CVOCRMetricsResponse)
def get_cv_ocr_metrics():
    """
    Returns actual measured Computer Vision and OCR benchmark evaluation metrics.
    """
    eval_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "ml", "evaluation", "cv_ocr_metrics.json"
    )
    if os.path.exists(eval_path):
        with open(eval_path, "r") as f:
            return json.load(f)
    return evaluate_cv_ocr_pipeline()


# ──────────────────────────────────────────────
# Yard Digital Twin Endpoints
# ──────────────────────────────────────────────

@router.get("/yard/state", response_model=YardStateResponse)
def get_yard_digital_twin_state(db: Session = Depends(get_db)):
    """
    Returns full 2D yard digital twin grid state (Blocks A-D, Bays, Rows, Tiers).
    """
    return get_yard_state(db)


def _compare_strategies(db: Session, container) -> AllocationComparisonResponse:
    """
    Run all 4 strategies in read-only mode and return their recommendations.
    """
    def cost_for_slot(slot) -> Optional[float]:
        if not slot:
            return None
        occ = _block_occupancy(db, slot.block)
        n_dest = _same_dest_neighbours(db, slot, container.destination)
        return compute_slot_cost(
            slot.block, slot.bay, slot.row, slot.tier,
            container.priority, container.destination, occ, n_dest,
        )["total_cost"]

    ff_slot = YardSlotAllocator.allocate_baseline(db, container)
    nr_slot = YardSlotAllocator.allocate_nearest(db, container)
    intel_result = YardSlotAllocator.allocate_intelligent(db, container)
    intel_slot = intel_result.get("slot")
    rl_result = YardSlotAllocator.allocate_rl(db, container)
    rl_slot = rl_result.get("slot")
    rl_available = "rl_qlearning" in rl_result.get("strategy", "")

    dqn_result = YardSlotAllocator.allocate_dqn(db, container)
    dqn_slot = dqn_result.get("slot")
    dqn_available = bool(dqn_result.get("model_trained", True))
    dqn_cost = dqn_result.get("cost_score") if dqn_slot else None

    ff_cost = cost_for_slot(ff_slot)
    nr_cost = cost_for_slot(nr_slot)
    intel_cost = intel_result.get("cost_score")
    intel_breakdown = intel_result.get("cost_breakdown")
    rl_cost = rl_result.get("cost_score") if rl_slot else None

    recommended_slot = intel_slot.id if intel_slot else None
    recommended_strategy = "intelligent"
    best_cost = intel_cost if intel_cost is not None else 999.0

    if rl_available and rl_slot and rl_cost is not None and rl_cost < best_cost:
        recommended_slot = rl_slot.id
        recommended_strategy = "rl_qlearning"
        best_cost = rl_cost

    if dqn_slot and dqn_cost is not None and dqn_cost < best_cost:
        recommended_slot = dqn_slot.id
        recommended_strategy = "dqn"
        best_cost = dqn_cost

    reason_parts = []
    if intel_cost is not None:
        reason_parts.append(f"Intelligent cost={intel_cost:.1f}")
    if rl_cost is not None and rl_available:
        reason_parts.append(f"RL cost={rl_cost:.1f}")
    if dqn_cost is not None:
        reason_parts.append(f"DQN cost={dqn_cost:.1f}")

    if recommended_strategy == "dqn":
        reason_parts.append("Dueling DQN selected (lowest cost & verified stability/reefer constraints)")
    elif recommended_strategy == "rl_qlearning":
        reason_parts.append("RL selected (lower cost than intelligent)")
    else:
        reason_parts.append("Intelligent selected as reliable cost-minimising heuristic")

    return AllocationComparisonResponse(
        container_id=container.id,
        container_number=container.container_number,
        destination=container.destination,
        priority=container.priority,
        weight_tier=container.weight_tier,
        first_fit_slot=ff_slot.id if ff_slot else None,
        nearest_slot=nr_slot.id if nr_slot else None,
        intelligent_slot=intel_slot.id if intel_slot else None,
        rl_slot=rl_slot.id if rl_slot else None,
        rl_available=rl_available,
        dqn_slot=dqn_slot.id if dqn_slot else None,
        dqn_available=dqn_available,
        recommended_slot=recommended_slot,
        recommended_strategy=recommended_strategy,
        intelligent_cost_breakdown=intel_breakdown,
        first_fit_cost=round(ff_cost, 2) if ff_cost is not None else None,
        nearest_cost=round(nr_cost, 2) if nr_cost is not None else None,
        intelligent_cost=round(intel_cost, 2) if intel_cost is not None else None,
        rl_cost=round(rl_cost, 2) if rl_cost is not None else None,
        dqn_cost=round(dqn_cost, 2) if dqn_cost is not None else None,
        rl_zone_action=rl_result.get("rl_zone_action"),
        dqn_zone_action=dqn_result.get("selected_zone"),
        reason=" | ".join(reason_parts),
    )


@router.post("/yard/allocate-slot")
def allocate_slot_for_container(
    payload: SlotAllocationRequest,
    db: Session = Depends(get_db)
):
    """
    Allocate a yard slot for a container.
    """
    container = db.query(Container).filter(Container.id == payload.container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")

    strategy = payload.strategy.lower()

    if strategy == "compare":
        return _compare_strategies(db, container)

    if payload.target_slot_id:
        target_slot = db.query(YardSlot).filter(YardSlot.id == payload.target_slot_id).first()
        if not target_slot:
            raise HTTPException(status_code=400, detail=f"Target slot {payload.target_slot_id} does not exist")
        try:
            assign_container_to_slot(db, container.id, target_slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        occ = _block_occupancy(db, target_slot.block)
        n_dest = _same_dest_neighbours(db, target_slot, container.destination)
        breakdown = compute_slot_cost(
            target_slot.block, target_slot.bay, target_slot.row, target_slot.tier,
            container.priority, container.destination, occ, n_dest,
        )
        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=target_slot.id,
            block=target_slot.block, bay=target_slot.bay, row=target_slot.row, tier=target_slot.tier,
            strategy_used="manual_confirm",
            cost_score=round(breakdown["total_cost"], 2),
            cost_breakdown=breakdown,
            rationale=f"Manually confirmed slot {target_slot.id}",
        )

    if strategy == "first_fit":
        slot = YardSlotAllocator.allocate_baseline(db, container)
        if not slot:
            raise HTTPException(status_code=400, detail="No available yard slot (first-fit)")

        occ = _block_occupancy(db, slot.block)
        n_dest = _same_dest_neighbours(db, slot, container.destination)
        breakdown = compute_slot_cost(
            slot.block, slot.bay, slot.row, slot.tier,
            container.priority, container.destination, occ, n_dest,
        )
        try:
            assign_container_to_slot(db, container.id, slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=slot.id,
            block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
            strategy_used="first_fit",
            cost_score=round(breakdown["total_cost"], 2),
            cost_breakdown=breakdown,
            rationale=f"First available slot {slot.id} (ordered block/bay/row/tier)",
        )

    if strategy == "nearest":
        slot = YardSlotAllocator.allocate_nearest(db, container)
        if not slot:
            raise HTTPException(status_code=400, detail="No available yard slot (nearest)")

        dist = manhattan_distance_to_gate(slot.block, slot.bay, slot.row)
        occ = _block_occupancy(db, slot.block)
        n_dest = _same_dest_neighbours(db, slot, container.destination)
        breakdown = compute_slot_cost(
            slot.block, slot.bay, slot.row, slot.tier,
            container.priority, container.destination, occ, n_dest,
        )
        try:
            assign_container_to_slot(db, container.id, slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=slot.id,
            block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
            strategy_used="nearest",
            cost_score=round(breakdown["total_cost"], 2),
            cost_breakdown=breakdown,
            rationale=f"Nearest slot {slot.id} (Manhattan distance={dist})",
        )

    if strategy == "rl":
        alloc_result = YardSlotAllocator.allocate_rl(db, container)
        slot = alloc_result["slot"]
        if not slot:
            raise HTTPException(status_code=400, detail=alloc_result.get("rationale", "RL allocation failed"))
        try:
            assign_container_to_slot(db, container.id, slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=slot.id,
            block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
            strategy_used=alloc_result["strategy"],
            cost_score=alloc_result["cost_score"],
            cost_breakdown=alloc_result.get("cost_breakdown"),
            rationale=alloc_result["rationale"],
            rl_zone_action=alloc_result.get("rl_zone_action"),
        )

    if strategy == "dqn":
        alloc_result = YardSlotAllocator.allocate_dqn(db, container)
        slot = alloc_result["slot"]
        if not slot:
            raise HTTPException(status_code=400, detail=alloc_result.get("rationale", "DQN allocation failed"))
        try:
            assign_container_to_slot(db, container.id, slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=slot.id,
            block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
            strategy_used=alloc_result["strategy"],
            cost_score=alloc_result["cost_score"],
            cost_breakdown=alloc_result.get("cost_breakdown"),
            rationale=alloc_result["rationale"],
            rl_zone_action=alloc_result.get("selected_zone"),
        )

    # Intelligent (default)
    alloc_result = YardSlotAllocator.allocate_intelligent(db, container)
    slot = alloc_result["slot"]
    if not slot:
        raise HTTPException(status_code=400, detail=alloc_result["rationale"])

    try:
        assign_container_to_slot(db, container.id, slot.id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    return SlotAllocationResponse(
        container_id=container.id,
        container_number=container.container_number,
        allocated_slot_id=slot.id,
        block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
        strategy_used=alloc_result["strategy"],
        cost_score=alloc_result["cost_score"],
        cost_breakdown=alloc_result.get("cost_breakdown"),
        rationale=alloc_result["rationale"],
    )


@router.get("/yard/benchmark")
def get_allocation_benchmark():
    benchmark_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "ml", "evaluation", "allocation_benchmark.json"
    )
    if os.path.exists(benchmark_path):
        with open(benchmark_path, "r") as f:
            return json.load(f)
    raise HTTPException(
        status_code=404,
        detail="Benchmark not yet computed. Run backend/app/ml/allocation_benchmark.py first."
    )


@router.get("/yard/rl-evaluation")
def get_rl_evaluation():
    eval_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "ml", "evaluation", "rl_evaluation.json"
    )
    if os.path.exists(eval_path):
        with open(eval_path, "r") as f:
            return json.load(f)
    raise HTTPException(
        status_code=404,
        detail="RL evaluation not yet computed. Run backend/app/ml/evaluation/eval_rl_allocator.py first."
    )


@router.get("/yard/dqn-training-log")
def get_dqn_training_log():
    log_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "ml", "artifacts", "dqn_training_log.json"
    )
    if os.path.exists(log_path):
        with open(log_path, "r") as f:
            return json.load(f)
    raise HTTPException(
        status_code=404,
        detail="DQN training log not found. Run backend/app/ml/training/train_dqn_allocator.py first."
    )



# ──────────────────────────────────────────────
# Container Management Endpoints
# ──────────────────────────────────────────────

@router.get("/containers", response_model=List[ContainerSummary])
def list_containers(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Container)
    if status:
        query = query.filter(Container.status == status.upper())
    if priority:
        query = query.filter(Container.priority == priority.upper())
    return query.order_by(Container.created_at.desc()).all()


@router.get("/containers/{container_id}", response_model=ContainerSummary)
def get_container(container_id: str, db: Session = Depends(get_db)):
    container = db.query(Container).filter(Container.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    return container


# ──────────────────────────────────────────────
# Predictive ML & Model Metrics Endpoints
# ──────────────────────────────────────────────

@router.get("/ml/metrics", response_model=MLMetricsResponse)
def get_ml_evaluation_metrics():
    metrics = delay_predictor.get_metrics()
    if not metrics:
        raise HTTPException(status_code=404, detail="ML metrics not found. Please train models first.")
    return metrics


@router.post("/ml/predict-delay", response_model=DelayPredictionResponse)
def predict_shipment_delay(
    payload: DelayPredictionRequest,
    db: Session = Depends(get_db)
):
    if payload.container_id or payload.shipment_id:
        try:
            res = delay_predictor.predict_for_container(
                db=db,
                container_id=payload.container_id,
                shipment_id=payload.shipment_id,
                selected_model=payload.model_name,
            )
            return DelayPredictionResponse(
                primary_predicted_delay_minutes=res["primary_predicted_delay_minutes"],
                selected_model=res["selected_model"],
                comparison=res["comparison"],
                features_applied=res["features_applied"],
                predicted_eta=res["predicted_eta"],
                container_id=res["container_id"],
                container_number=res["container_number"],
                shipment_id=res["shipment_id"],
                timestamp=res["timestamp"],
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    rem_dist = payload.remaining_distance if payload.remaining_distance is not None else 100.0
    prog = payload.current_progress if payload.current_progress is not None else 0.50
    spd = payload.current_speed if payload.current_speed is not None else 60.0
    dwell = payload.dwell_time if payload.dwell_time is not None else 0.0
    cong = payload.yard_congestion if payload.yard_congestion is not None else 0.50
    hist = payload.historical_delay if payload.historical_delay is not None else 15.0

    result = delay_predictor.predict(
        remaining_distance=rem_dist,
        current_progress=prog,
        current_speed=spd,
        dwell_time=dwell,
        yard_congestion=cong,
        historical_delay=hist,
        priority=payload.priority or "STANDARD",
        route_risk=payload.route_risk or 1.0,
        selected_model=payload.model_name,
    )

    try:
        log_entry = MLPredictionLog(
            model_name=payload.model_name,
            predicted_delay_minutes=result["primary_predicted_delay_minutes"],
            features_json=result["features_applied"],
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()

    return DelayPredictionResponse(
        primary_predicted_delay_minutes=result["primary_predicted_delay_minutes"],
        selected_model=result["selected_model"],
        comparison=result["comparison"],
        features_applied=result["features_applied"],
    )


@router.get("/ml/drift-status")
def get_ml_drift_status(sample_size: int = 200, db: Session = Depends(get_db)):
    """
    Evaluate feature distribution drift (PSI and KS-test) between live database
    shipment features and the baseline training dataset.
    """
    from app.ml.drift_detector import drift_detector
    try:
        report = drift_detector.evaluate_drift(db=db, sample_size=sample_size)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate drift: {str(e)}")


@router.post("/ml/trigger-retrain")
def trigger_ml_retraining():
    """
    Trigger end-to-end retraining pipeline for Delay Prediction models (XGBoost, RF, Linear).
    Saves new native XGBoost JSON and atomically reloads delay predictor.
    """
    from app.ml.drift_detector import drift_detector
    try:
        result = drift_detector.trigger_retraining()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model retraining failed: {str(e)}")

