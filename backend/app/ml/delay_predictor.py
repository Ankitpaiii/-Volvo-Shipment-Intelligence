"""
Delay Predictor Service.
Loads pre-trained artifacts (Scaler, Linear Baseline, Random Forest, XGBoost)
and executes real-time multi-model delay inference.
Supports direct operational feature inference and container/shipment entity inference.
"""
from datetime import datetime, timedelta
import json
import logging
import os
from typing import Any, Dict, List, Optional
import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.timeutils import utcnow

logger = logging.getLogger(__name__)

from app.models import Container, ContainerStatus, MLPredictionLog, Shipment, ShipmentStatus

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")


class DelayPredictor:
    def __init__(self):
        self.scaler = None
        self.baseline_model = None
        self.rf_model = None
        self.xgb_model = None
        self.metrics: Dict[str, Any] = {}
        self.feature_cols: List[str] = [
            "remaining_distance",
            "current_progress",
            "current_speed",
            "dwell_time",
            "yard_congestion",
            "historical_delay",
            "priority_level",
            "route_risk"
        ]
        self._load_artifacts()

    def _load_artifacts(self):
        try:
            scaler_path = os.path.join(ARTIFACTS_DIR, "scaler.joblib")
            baseline_path = os.path.join(ARTIFACTS_DIR, "baseline_model.joblib")
            rf_path = os.path.join(ARTIFACTS_DIR, "random_forest.joblib")
            xgb_json_path = os.path.join(ARTIFACTS_DIR, "xgboost.json")
            xgb_joblib_path = os.path.join(ARTIFACTS_DIR, "xgboost.joblib")
            metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")

            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            if os.path.exists(baseline_path):
                self.baseline_model = joblib.load(baseline_path)
            if os.path.exists(rf_path):
                self.rf_model = joblib.load(rf_path)
            if os.path.exists(xgb_json_path):
                import xgboost as xgb
                self.xgb_model = xgb.XGBRegressor()
                self.xgb_model.load_model(xgb_json_path)
            elif os.path.exists(xgb_joblib_path):
                self.xgb_model = joblib.load(xgb_joblib_path)
            if os.path.exists(metrics_path):
                with open(metrics_path, "r") as f:
                    self.metrics = json.load(f)
        except Exception as e:
            logger.warning("Error loading ML artifacts: %s", e)

    def get_metrics(self) -> Dict[str, Any]:
        """Return holdout test set evaluation benchmarks."""
        return self.metrics

    def predict(
        self,
        remaining_distance: float,
        current_progress: float,
        current_speed: float,
        dwell_time: float,
        yard_congestion: float,
        historical_delay: float,
        priority: str = "STANDARD",
        route_risk: float = 1.0,
        selected_model: str = "xgboost"
    ) -> Dict[str, Any]:
        """
        Execute prediction across models and return comparative outputs.
        """
        priority_map = {"STANDARD": 0, "HIGH": 1, "URGENT": 2}
        priority_val = priority_map.get(priority.upper(), 0)

        df_feat = pd.DataFrame([{
            "remaining_distance": remaining_distance,
            "current_progress": current_progress,
            "current_speed": current_speed,
            "dwell_time": dwell_time,
            "yard_congestion": yard_congestion,
            "historical_delay": historical_delay,
            "priority_level": priority_val,
            "route_risk": route_risk
        }], columns=self.feature_cols)

        predictions = {}

        # 1. Baseline Linear
        if self.baseline_model and self.scaler:
            scaled_vec = self.scaler.transform(df_feat)
            base_pred = float(np.maximum(0.0, self.baseline_model.predict(scaled_vec)[0]))
            predictions["baseline_linear"] = round(base_pred, 1)

        # 2. Random Forest
        if self.rf_model:
            rf_pred = float(np.maximum(0.0, self.rf_model.predict(df_feat)[0]))
            predictions["random_forest"] = round(rf_pred, 1)

        # 3. XGBoost
        if self.xgb_model:
            xgb_pred = float(np.maximum(0.0, self.xgb_model.predict(df_feat)[0]))
            predictions["xgboost"] = round(xgb_pred, 1)

        primary_val = predictions.get(selected_model.lower(), predictions.get("xgboost", 0.0))

        return {
            "primary_predicted_delay_minutes": primary_val,
            "selected_model": selected_model,
            "comparison": predictions,
            "features_applied": {
                "remaining_distance": remaining_distance,
                "current_progress": current_progress,
                "current_speed": current_speed,
                "dwell_time": dwell_time,
                "yard_congestion": yard_congestion,
                "historical_delay": historical_delay,
                "priority_level": priority_val,
                "route_risk": route_risk
            }
        }

    def predict_for_container(
        self,
        db: Session,
        container_id: Optional[str] = None,
        shipment_id: Optional[str] = None,
        selected_model: str = "xgboost",
    ) -> Dict[str, Any]:
        """
        Resolve Container / Shipment in DB, extract operational features,
        execute prediction, calculate derived ETA, persist MLPredictionLog,
        and update Shipment record.
        """
        container = None
        shipment = None

        if shipment_id:
            shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
            if shipment and shipment.container_id:
                container = db.query(Container).filter(Container.id == shipment.container_id).first()

        if not shipment and container_id:
            container = db.query(Container).filter(Container.id == container_id).first()
            if container:
                # Find existing shipment linked to this container
                shipment = db.query(Shipment).filter(Shipment.container_id == container.id).first()
                if not shipment:
                    # Create deterministic default shipment for container at gate
                    shipment = Shipment(
                        container_id=container.id,
                        origin="Port Terminal Inbound",
                        destination=container.destination or "Rotterdam",
                        distance=450.0,
                        current_progress=0.90,     # At gate checkpoint (~90% trip completion)
                        current_speed=25.0,        # Terminal approach speed (km/h)
                        dwell_time=0.75,           # Gate processing queue hours
                        yard_congestion=0.45,      # Current yard occupancy proxy
                        historical_delay=15.0,     # Lane average delay (mins)
                        status=ShipmentStatus.AT_GATE.value,
                    )
                    db.add(shipment)
                    db.commit()
                    db.refresh(shipment)

        if not shipment:
            raise ValueError(f"No shipment found or created for container_id={container_id}, shipment_id={shipment_id}")

        # Extract features deterministically
        priority = container.priority if container else "STANDARD"
        total_dist = float(shipment.distance or 450.0)
        progress = float(np.clip(shipment.current_progress or 0.90, 0.0, 1.0))
        remaining_dist = max(0.0, total_dist * (1.0 - progress))
        speed = float(max(15.0, shipment.current_speed or 25.0))
        dwell = float(max(0.0, shipment.dwell_time or 0.75))
        congestion = float(np.clip(shipment.yard_congestion or 0.45, 0.0, 1.0))
        hist_delay = float(max(0.0, shipment.historical_delay or 15.0))
        route_risk = 1.0

        # Execute prediction
        pred_res = self.predict(
            remaining_distance=round(remaining_dist, 1),
            current_progress=round(progress, 2),
            current_speed=round(speed, 1),
            dwell_time=round(dwell, 2),
            yard_congestion=round(congestion, 2),
            historical_delay=round(hist_delay, 1),
            priority=priority,
            route_risk=route_risk,
            selected_model=selected_model,
        )

        pred_delay = pred_res["primary_predicted_delay_minutes"]
        now = utcnow()

        # ETA calculation: nominal transit time = remaining_dist / speed + dwell + predicted_delay
        nominal_transit_hours = (remaining_dist / speed) + dwell
        total_delay_hours = pred_delay / 60.0
        predicted_eta = now + timedelta(hours=(nominal_transit_hours + total_delay_hours))

        # Update shipment in DB
        shipment.predicted_delay = pred_delay
        shipment.predicted_eta = predicted_eta
        if container and container.status == ContainerStatus.AT_GATE.value:
            shipment.status = ShipmentStatus.AT_GATE.value

        # Persist MLPredictionLog
        try:
            log_entry = MLPredictionLog(
                shipment_id=shipment.id,
                model_name=selected_model,
                predicted_delay_minutes=pred_delay,
                features_json=pred_res["features_applied"],
            )
            db.add(log_entry)
            db.commit()
            db.refresh(shipment)
        except Exception as e:
            logger.warning("Failed to log prediction: %s", e)
            db.rollback()

        return {
            "primary_predicted_delay_minutes": pred_delay,
            "predicted_eta": predicted_eta.isoformat(),
            "selected_model": selected_model,
            "comparison": pred_res["comparison"],
            "features_applied": pred_res["features_applied"],
            "container_id": container.id if container else None,
            "container_number": container.container_number if container else None,
            "shipment_id": shipment.id,
            "timestamp": now.isoformat(),
        }


# Global instance
delay_predictor = DelayPredictor()
