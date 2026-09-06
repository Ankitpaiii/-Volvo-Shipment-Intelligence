"""Audit trail helper (P5.1). Call AFTER the main commit so audit failures never break ops."""
import logging

from sqlalchemy.orm import Session

from app.models import AuditLog

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict | None = None,
) -> None:
    try:
        db.add(
            AuditLog(
                actor=actor or "anonymous",
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details or {},
            )
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning("Audit log write failed (%s %s): %s", action, entity_id, e)
