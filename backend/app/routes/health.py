"""Health & status endpoints (deep check: DB, worker, SSE, ML)."""
import os

from fastapi import APIRouter, Depends
from sqlalchemy import text as _text
from sqlalchemy.orm import Session

from app import runtime_state as _rt
from app.config import settings
from app.database import get_db
from app.ml.delay_predictor import delay_predictor
from app.timeutils import utcnow

router = APIRouter()


@router.get("/health")
def health(db: Session = Depends(get_db)):
    q_table_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "ml", "artifacts", "q_table.npy"
    )
    ml = {
        "baseline_linear": delay_predictor.baseline_model is not None,
        "random_forest": delay_predictor.rf_model is not None,
        "xgboost": delay_predictor.xgb_model is not None,
        "rl_q_table": os.path.exists(q_table_path),
    }

    # DB connectivity probe
    db_ok = False
    try:
        db_ok = db.execute(_text("SELECT 1")).scalar() == 1
    except Exception:
        db_ok = False

    # Background worker freshness (tick expected every gap_check_interval_seconds)
    tick = _rt.last_worker_tick
    age_s: float | None = None
    worker_ok = False
    if tick is not None:
        try:
            age_s = (utcnow() - tick).total_seconds()
            worker_ok = age_s < max(90, settings.gap_check_interval_seconds * 3)
        except Exception:
            age_s = None
            worker_ok = False

    sse_info = {
        "subscribers": _rt.sse_subscriber_count,
        "dropped_total": _rt.sse_dropped_total,
        "queue_maxsize": 200,
    }

    if not db_ok:
        status = "down"
    elif not worker_ok or not all(ml.values()):
        status = "degraded"
    else:
        status = "ok"

    return {
        "status": status,
        "service": "volvo-shipment-tracking-and-yard-ml",
        "version": "3.0.0",
        "db_ok": db_ok,
        "worker": {
            "last_tick": tick.isoformat() if tick else None,
            "age_seconds": round(age_s, 1) if age_s is not None else None,
            "healthy": worker_ok,
            "last_error": _rt.last_worker_error,
        },
        "sse": sse_info,
        "ml_models_loaded": ml,
    }
