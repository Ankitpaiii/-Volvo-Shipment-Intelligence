"""Predictive ML endpoints (delay prediction, metrics, drift, retrain)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import Actor, require_admin
from app.database import get_db
from app.ml.delay_predictor import delay_predictor
from app.models import MLPredictionLog
from app.schemas import (
    DelayPredictionRequest,
    DelayPredictionResponse,
    MLMetricsResponse,
)

router = APIRouter()


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
def trigger_ml_retraining(actor: Actor = Depends(require_admin)):
    """
    Trigger end-to-end retraining pipeline for Delay Prediction models (XGBoost, RF, Linear).
    Saves new native XGBoost JSON and atomically reloads delay predictor.
    Requires admin role once AUTH_DISABLED=false (dev mode stays open).
    """
    from app.ml.drift_detector import drift_detector
    try:
        result = drift_detector.trigger_retraining()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model retraining failed: {str(e)}")
