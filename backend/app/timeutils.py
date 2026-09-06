"""Timezone helpers — always store/compare UTC timezone-aware datetimes."""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Timezone-aware UTC now (replaces deprecated datetime.utcnow())."""
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime | None) -> datetime | None:
    """Coerce naive legacy DB datetimes (assumed UTC) to aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
