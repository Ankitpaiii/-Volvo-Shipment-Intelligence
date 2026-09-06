"""Exception queue endpoints (N+1 fixed via bulk shipment fetch)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import Actor, require_writer
from app.database import get_db
from app.models import ExceptionRecord, ExceptionStatus, Shipment
from app.schemas import ExceptionAction, ExceptionResponse
from app.services.notifications import send_notification
from app.timeutils import utcnow

router = APIRouter()


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
    # Bulk-fetch shipments once (fixes N+1)
    shipment_ids = {r.shipment_id for r in records}
    shipments_by_id = {}
    if shipment_ids:
        for s in db.query(Shipment).filter(Shipment.shipment_id.in_(shipment_ids)).all():
            shipments_by_id[s.shipment_id] = s
    result = []
    for r in records:
        shipment = shipments_by_id.get(r.shipment_id)
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
def exception_action(
    exception_id: str,
    payload: ExceptionAction,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_writer),
):
    record = db.query(ExceptionRecord).filter(ExceptionRecord.exception_id == exception_id).first()
    if not record:
        raise HTTPException(status_code=404, detail={"error": {"code": "EXCEPTION_NOT_FOUND", "message": "Exception not found"}})

    if payload.action == "acknowledge":
        record.status = ExceptionStatus.ACKNOWLEDGED.value
    elif payload.action == "resolve":
        record.status = ExceptionStatus.RESOLVED.value
        record.resolved_at = utcnow()
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
    log_action(
        db, actor.name, f"exception.{payload.action}", "exception", exception_id,
        {"shipment_id": record.shipment_id, "note": payload.notes or payload.reason},
    )
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
