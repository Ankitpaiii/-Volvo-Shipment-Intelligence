"""Audit trail reads (P5.1). Public read, newest first."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog
from app.schemas import AuditLogResponse

router = APIRouter()


@router.get("/audit-log", response_model=list[AuditLogResponse])
def list_audit_log(
    entity_type: str | None = None,
    entity_id: str | None = None,
    action: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.filter(AuditLog.entity_id == entity_id)
    if action:
        q = q.filter(AuditLog.action == action)
    return q.order_by(AuditLog.timestamp.desc()).limit(limit).all()
