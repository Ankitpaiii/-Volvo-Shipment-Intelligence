"""Shipment CRUD, milestone events, and ETA endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import Actor, require_writer
from app.database import get_db
from app.models import MilestoneEvent, Shipment
from app.routes.common import _escape_like
from app.schemas import (
    ETAResponse,
    EventCreate,
    EventResponse,
    PaginatedShipments,
    ShipmentCreate,
    ShipmentDetail,
    ShipmentUpdate,
)
from app.services.gap_detection import compute_risk_and_health, update_shipment_scores
from app.timeutils import utcnow

router = APIRouter()


@router.post("/shipments", response_model=ShipmentDetail)
def create_shipment(
    payload: ShipmentCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_writer),
):
    shipment = Shipment(**payload.model_dump())
    db.add(shipment)
    db.flush()
    db.add(
        MilestoneEvent(
            shipment_id=shipment.shipment_id,
            event_type="TRANSPORT_ORDER_CREATED",
            source="manual",
            event_time=utcnow(),
            payload={"created_by": actor.name},
        )
    )
    db.commit()
    db.refresh(shipment)
    log_action(db, actor.name, "shipment.create", "shipment", shipment.shipment_id, {"po_number": shipment.po_number})
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
        q = q.filter(Shipment.carrier_name.ilike(f"%{_escape_like(carrier)}%", escape="\\"))
    if lane:
        q = q.filter(Shipment.lane_name.ilike(f"%{_escape_like(lane)}%", escape="\\"))
    if criticality:
        q = q.filter(Shipment.part_criticality == criticality)
    if search:
        term = f"%{_escape_like(search)}%"
        q = q.filter(
            Shipment.po_number.ilike(term, escape="\\") |
            Shipment.supplier_name.ilike(term, escape="\\") |
            Shipment.carrier_name.ilike(term, escape="\\") |
            Shipment.lane_name.ilike(term, escape="\\") |
            Shipment.origin_city.ilike(term, escape="\\") |
            Shipment.dest_city.ilike(term, escape="\\")
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
def update_shipment(
    shipment_id: str,
    payload: ShipmentUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_writer),
):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}})
    changed = payload.model_dump(exclude_unset=True)
    for key, value in changed.items():
        setattr(shipment, key, value)
    db.commit()
    db.refresh(shipment)
    log_action(db, actor.name, "shipment.update", "shipment", shipment_id, {"fields": sorted(changed.keys())})
    return shipment


@router.post("/shipments/{shipment_id}/events", response_model=EventResponse)
def add_event(
    shipment_id: str,
    payload: EventCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_writer),
):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}})

    event = MilestoneEvent(
        shipment_id=shipment_id,
        event_type=payload.event_type,
        source=payload.source,
        event_time=payload.event_time or utcnow(),
        payload=payload.payload,
    )
    db.add(event)
    if payload.event_type == "GPS_PING" and "lat" in payload.payload and "lng" in payload.payload:
        shipment.current_lat = payload.payload["lat"]
        shipment.current_lng = payload.payload["lng"]
    update_shipment_scores(db, shipment)
    db.commit()
    db.refresh(event)
    log_action(db, actor.name, "shipment.event", "shipment", shipment_id, {"event_type": payload.event_type})
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

    events = (
        db.query(MilestoneEvent)
        .filter(MilestoneEvent.shipment_id == shipment_id)
        .all()
    )
    risk_score, health_score, flags, predicted, confidence = compute_risk_and_health(
        shipment, events
    )

    predicted_delivery = predicted or shipment.predicted_delivery
    eta_confidence = confidence if confidence is not None else (shipment.eta_confidence or 0.85)

    delay_minutes = 0
    if predicted_delivery and shipment.planned_delivery:
        from app.timeutils import ensure_aware

        pred_aware = ensure_aware(predicted_delivery)
        plan_aware = ensure_aware(shipment.planned_delivery)
        diff = (pred_aware - plan_aware).total_seconds() / 60.0
        delay_minutes = max(0, int(diff))

    factors = []
    for f in flags:
        impact = 15 if "stale" in f or "delay" in f else 10
        factors.append({"factor": f.replace("_", " ").title(), "impact_minutes": impact})

    return ETAResponse(
        shipment_id=shipment_id,
        planned_delivery=shipment.planned_delivery,
        predicted_delivery=predicted_delivery,
        eta_confidence=eta_confidence,
        delay_minutes=delay_minutes,
        route_risk_factor=round(1.0 + (risk_score / 100.0) * 0.5, 2),
        factors=factors,
    )
