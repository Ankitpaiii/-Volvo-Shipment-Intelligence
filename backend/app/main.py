import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Shipment
from app.routes import router
from app import runtime_state
from app.seed_data import seed_database
from app.services.gap_detection import detect_gaps
from app.services.gps_simulator import simulate_gps_pings
from app.services.notifications import send_notification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SSE fan-out: each connected client gets its own queue so one slow client
# doesn't starve others and events aren't consumed by a single client.
# Background worker broadcasts to all subscribers (non-blocking, per-client drop + warning).
_sse_subscribers: set[asyncio.Queue] = set()
_SSE_MAXSIZE = 200


async def _broadcast_sse(event: dict) -> None:
    """Broadcast event to all SSE subscribers. Drops per-client on full + warns."""
    if not _sse_subscribers:
        return
    dropped = 0
    for q in list(_sse_subscribers):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            dropped += 1
    if dropped:
        runtime_state.add_dropped(dropped)
        logger.warning("SSE queue full, dropped event for %d/%d clients: %s", dropped, len(_sse_subscribers), event.get("type"))


# Legacy alias (kept for backwards-compat imports; do not use directly)
_sse_queue: asyncio.Queue = asyncio.Queue(maxsize=_SSE_MAXSIZE)


async def background_worker():
    while True:
        db = SessionLocal()
        try:
            pings = simulate_gps_pings(db)
            new_exceptions = detect_gaps(db)
            for exc in new_exceptions:
                send_notification(
                    "console",
                    "transport.organizer@volvo.com",
                    f"[{exc.severity}] {exc.exception_type}",
                    exc.message,
                )
                # Push SSE event (non-blocking — drop if queue full)
                event_data = {
                    "type": "new_exception",
                    "exception_id": exc.exception_id,
                    "shipment_id": exc.shipment_id,
                    "exception_type": exc.exception_type,
                    "severity": exc.severity,
                    "message": exc.message,
                    "business_impact_score": exc.business_impact_score,
                }
                await _broadcast_sse(event_data)

            if pings > 0:
                # Push a GPS update event so the frontend can refresh the map
                await _broadcast_sse({"type": "gps_update", "count": pings})

            runtime_state.record_tick()
            if pings or new_exceptions:
                logger.info(
                    "Background tick: %s GPS pings, %s new exceptions",
                    pings,
                    len(new_exceptions),
                )
        except Exception as e:
            runtime_state.record_error(str(e)[:500])
            logger.exception("Background worker error: %s", e)
        finally:
            db.close()
        await asyncio.sleep(settings.gap_check_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Shipment).count() == 0:
            logger.info("Database is empty. Seeding demo shipments and exceptions...")
        # seed_database is idempotent: seeds only when empty + backfills
        # yard geometry to 192 slots for existing DBs.
        seed_database(db)
    except Exception as e:
        logger.exception("Error seeding database: %s", e)
    finally:
        db.close()
    task = asyncio.create_task(background_worker())
    yield
    task.cancel()


app = FastAPI(
    title="Volvo Shipment Tracking Platform",
    description="Hackathon MVP v2 — gap detection, risk scoring, AI copilot, and operational visibility",
    version="2.0.0",
    lifespan=lifespan,
)

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a short request ID for log correlation + error responses."""

    async def dispatch(self, request: Request, call_next):
        request_id = uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


def _request_id(request: Request | None) -> str:
    try:
        return getattr(request.state, "request_id", "unknown") if request else "unknown"
    except Exception:
        return "unknown"


def _err(code: str, message: str, request: Request | None, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "request_id": _request_id(request)}},
    )


from app.rate_limit import RateLimitMiddleware

app.add_middleware(RequestIDMiddleware)
app.add_middleware(RateLimitMiddleware)


@app.exception_handler(StarletteHTTPException)
async def _http_handler(request: Request, exc: StarletteHTTPException):
    # Preserve structured detail dicts raised as {"error": {...}}.
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        err = exc.detail["error"]
        code = err.get("code", f"HTTP_{exc.status_code}") if isinstance(err, dict) else f"HTTP_{exc.status_code}"
        msg = err.get("message", str(exc.detail)) if isinstance(err, dict) else str(exc.detail)
        return _err(code, msg, request, exc.status_code)
    return _err(f"HTTP_{exc.status_code}", str(exc.detail), request, exc.status_code)


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError):
    return _err("VALIDATION_ERROR", str(exc.errors()[:3]), request, 422)


@app.exception_handler(SQLAlchemyError)
async def _db_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("DB error req=%s: %s", _request_id(request), exc)
    return _err("DATABASE_ERROR", "Database operation failed", request, 500)


@app.exception_handler(Exception)
async def _unhandled_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error req=%s: %s", _request_id(request), exc)
    return _err("INTERNAL_ERROR", "Unexpected server error", request, 500)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if not origins:
    # Explicit dev defaults — never fallback to wildcard with credentials.
    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
if "*" in origins:
    logger.warning("CORS wildcard '*' configured — disabling credentials for safety. Set explicit origins in production.")
    allow_credentials = False
else:
    allow_credentials = True
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/api/v1/stream")
async def sse_stream(request: Request):
    """
    Server-Sent Events endpoint for real-time push updates.
    Clients listen here and receive exception alerts and GPS update signals instantly.
    """
    client_queue: asyncio.Queue = asyncio.Queue(maxsize=_SSE_MAXSIZE)
    _sse_subscribers.add(client_queue)
    runtime_state.set_sse_count(len(_sse_subscribers))
    logger.info("SSE client connected (%d total)", len(_sse_subscribers))

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Send initial connection confirmation
            yield "data: {\"type\": \"connected\", \"message\": \"SSE stream active\"}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait up to 25 seconds for an event (then send keepalive)
                    event = await asyncio.wait_for(client_queue.get(), timeout=25.0)
                    payload = json.dumps(event)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive ping to prevent connection timeout
                    yield ": keepalive\n\n"
                except Exception:
                    break
        finally:
            _sse_subscribers.discard(client_queue)
            runtime_state.set_sse_count(len(_sse_subscribers))
            logger.info("SSE client disconnected (%d remaining)", len(_sse_subscribers))

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
