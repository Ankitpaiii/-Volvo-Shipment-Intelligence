"""Shared runtime health state (avoids main<->routes circular import)."""
from datetime import datetime

from app.timeutils import utcnow

last_worker_tick: datetime | None = None
last_worker_error: str | None = None
sse_subscriber_count: int = 0
sse_dropped_total: int = 0


def record_tick() -> None:
    global last_worker_tick
    last_worker_tick = utcnow()


def record_error(msg: str) -> None:
    global last_worker_error
    last_worker_error = msg


def set_sse_count(n: int) -> None:
    global sse_subscriber_count
    sse_subscriber_count = n


def add_dropped(n: int) -> None:
    global sse_dropped_total
    sse_dropped_total += n
