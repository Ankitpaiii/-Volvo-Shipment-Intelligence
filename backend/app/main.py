import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routes import router
from app.seed_data import seed_database
from app.services.gap_detection import detect_gaps
from app.services.gps_simulator import simulate_gps_pings
from app.services.notifications import send_notification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global SSE event queue — background worker pushes events here
# Each item is a dict that will be JSON-serialized to the SSE stream
_sse_queue: asyncio.Queue = asyncio.Queue(maxsize=200)


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
                try:
                    _sse_queue.put_nowait(event_data)
                except asyncio.QueueFull:
                    pass  # Drop oldest-style: just skip if queue full

            if pings > 0:
                # Push a GPS update event so the frontend can refresh the map
                try:
                    _sse_queue.put_nowait({"type": "gps_update", "count": pings})
                except asyncio.QueueFull:
                    pass

            if pings or new_exceptions:
                logger.info(
                    "Background tick: %s GPS pings, %s new exceptions",
                    pings,
                    len(new_exceptions),
                )
        except Exception as e:
            logger.exception("Background worker error: %s", e)
        finally:
            db.close()
        await asyncio.sleep(settings.gap_check_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # try:
    #     seed_database(db)
    # finally:
    #     db.close()
    task = asyncio.create_task(background_worker())
    yield
    task.cancel()


app = FastAPI(
    title="Volvo Shipment Tracking Platform",
    description="Hackathon MVP v2 — gap detection, risk scoring, AI copilot, and operational visibility",
    version="2.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
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
    async def event_generator() -> AsyncGenerator[str, None]:
        # Send initial connection confirmation
        yield "data: {\"type\": \"connected\", \"message\": \"SSE stream active\"}\n\n"

        while True:
            if await request.is_disconnected():
                break
            try:
                # Wait up to 25 seconds for an event (then send keepalive)
                event = await asyncio.wait_for(_sse_queue.get(), timeout=25.0)
                payload = json.dumps(event)
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                # Keepalive ping to prevent connection timeout
                yield ": keepalive\n\n"
            except Exception:
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
