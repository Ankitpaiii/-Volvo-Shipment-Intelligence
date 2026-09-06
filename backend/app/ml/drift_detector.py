"""
Automated Model Drift Detector & Continuous Learning Engine.

Statistical Methods:
1. Population Stability Index (PSI):
   - Compares production feature distributions against training decile bins.
   - PSI < 0.10: Stable / Normal
   - 0.10 <= PSI < 0.20: Moderate Drift / Alert
   - PSI >= 0.20: Significant Drift / Retrain Required
2. Two-Sample Kolmogorov-Smirnov (KS) Test:
   - Non-parametric test detecting subtle changes in cumulative distribution functions.
   - p-value < 0.05 rejects null hypothesis (statistical drift detected).
3. Automated Retraining Trigger:
   - Orchestrates automated model retraining upon detected covariate shift.
   - Atomically reloads the DelayPredictor with zero downtime.
"""
from datetime import datetime
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy import stats
from sqlalchemy.orm import Session

from app.models import Shipment
from app.timeutils import utcnow

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "ml", "artifacts")
METRICS_PATH = os.path.join(ARTIFACTS_DIR, "metrics.json")
DRIFT_LOG_PATH = os.path.join(ARTIFACTS_DIR, "drift_history.json")


class DriftDetector:
    def __init__(self, metrics_path: Optional[str] = None):
        self.metrics_path = metrics_path or METRICS_PATH
        self.baseline = self._load_baseline()

    def _load_baseline(self) -> Dict[str, Any]:
        if os.path.exists(self.metrics_path):
            try:
                with open(self.metrics_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning("[DriftDetector] Failed to load baseline metrics: %s", e)
        return {}

    def calculate_psi(self, feature_name: str, actual_values: np.ndarray, epsilon: float = 1e-4) -> float:
        """
        Calculate Population Stability Index (PSI) using baseline decile bins.
        PSI = sum((Actual_i - Expected_i) * ln(Actual_i / Expected_i))
        """
        if not self.baseline or "feature_distributions" not in self.baseline:
            return 0.0

        dist = self.baseline["feature_distributions"].get(feature_name)
        if not dist or "quantiles" not in dist:
            return 0.0

        quantiles = dist["quantiles"]
        # 9 quantiles form 10 bins: [-inf, q0, q1, ..., q8, inf]
        bins = [-np.inf] + list(quantiles) + [np.inf]
        # Remove any non-monotonic values
        bins = np.unique(bins)
        num_bins = len(bins) - 1

        if num_bins < 2 or len(actual_values) == 0:
            return 0.0

        expected_pct = 1.0 / num_bins

        # Bin the actual production values
        counts, _ = np.histogram(actual_values, bins=bins)
        actual_pcts = counts / max(1, len(actual_values))

        # Add epsilon smoothing
        actual_pcts = np.clip(actual_pcts, epsilon, 1.0)
        expected_pcts = np.full(num_bins, expected_pct)

        # Normalize so they sum to 1
        actual_pcts /= np.sum(actual_pcts)
        expected_pcts /= np.sum(expected_pcts)

        psi = np.sum((actual_pcts - expected_pcts) * np.log(actual_pcts / expected_pcts))
        return float(max(0.0, psi))

    def calculate_ks_test(self, feature_name: str, actual_values: np.ndarray) -> Tuple[float, float]:
        """
        Perform Two-Sample Kolmogorov-Smirnov test against baseline distribution.
        Returns: (ks_statistic, p_value)
        """
        if not self.baseline or "feature_distributions" not in self.baseline or len(actual_values) < 5:
            return 0.0, 1.0

        dist = self.baseline["feature_distributions"].get(feature_name)
        if not dist:
            return 0.0, 1.0

        # Synthesize reference distribution from baseline mean & std (or quantiles)
        mean = dist.get("mean", 0.0)
        std = max(1e-5, dist.get("std", 1.0))
        n_samples = max(200, len(actual_values) * 2)

        # Truncated normal sampling respecting baseline min and max
        f_min = dist.get("min", mean - 3 * std)
        f_max = dist.get("max", mean + 3 * std)
        baseline_samples = np.clip(np.random.normal(mean, std, n_samples), f_min, f_max)

        stat, p_val = stats.ks_2samp(actual_values, baseline_samples)
        return float(stat), float(p_val)

    def extract_production_features(self, db: Session, limit: int = 500) -> Dict[str, np.ndarray]:
        """
        Extract active production shipment feature distributions from database.
        """
        shipments = (
            db.query(Shipment)
            .order_by(Shipment.created_at.desc())
            .limit(limit)
            .all()
        )

        prio_map = {"STANDARD": 0, "HIGH": 1, "URGENT": 2}

        data: Dict[str, List[float]] = {
            "remaining_distance": [],
            "current_progress": [],
            "current_speed": [],
            "dwell_time": [],
            "yard_congestion": [],
            "historical_delay": [],
            "priority_level": [],
            "route_risk": [],
        }

        for s in shipments:
            data["remaining_distance"].append(float(getattr(s, "distance", 400.0)))
            data["current_progress"].append(float(getattr(s, "current_progress", 0.5)))
            data["current_speed"].append(float(getattr(s, "current_speed", 60.0)))
            data["dwell_time"].append(float(getattr(s, "dwell_time", 1.5)))
            data["yard_congestion"].append(float(getattr(s, "yard_congestion", 0.5)))
            data["historical_delay"].append(float(getattr(s, "historical_delay", 20.0)))

            prio_str = "STANDARD"
            if s.container and hasattr(s.container, "priority"):
                prio_str = s.container.priority
            data["priority_level"].append(float(prio_map.get(prio_str, 0)))

            # Route risk inferred from origin / delay risk score
            data["route_risk"].append(float(1.0 + (getattr(s, "delay_risk_score", 0) / 100.0)))

        return {k: np.array(v, dtype=np.float32) for k, v in data.items()}

    def evaluate_drift(self, db: Session, sample_size: int = 200) -> Dict[str, Any]:
        """
        Analyze production drift across all 8 features.
        Returns comprehensive drift report.
        """
        if not self.baseline:
            self.baseline = self._load_baseline()

        prod_data = self.extract_production_features(db, limit=sample_size)
        total_records = len(next(iter(prod_data.values()))) if prod_data else 0

        features_report = {}
        high_drift_features = []
        moderate_drift_features = []
        total_psi = 0.0

        for f_name, vals in prod_data.items():
            if len(vals) == 0:
                continue

            psi = self.calculate_psi(f_name, vals)
            ks_stat, ks_pval = self.calculate_ks_test(f_name, vals)

            # Drift classification
            if psi >= 0.20 or (ks_pval < 0.01 and psi >= 0.15):
                status = "SIGNIFICANT_DRIFT"
                high_drift_features.append(f_name)
            elif psi >= 0.10 or ks_pval < 0.05:
                status = "MODERATE_DRIFT"
                moderate_drift_features.append(f_name)
            else:
                status = "STABLE"

            features_report[f_name] = {
                "psi": round(psi, 4),
                "ks_statistic": round(ks_stat, 4),
                "ks_p_value": round(ks_pval, 4),
                "status": status,
                "current_mean": round(float(np.mean(vals)), 2),
                "baseline_mean": round(float(self.baseline.get("feature_distributions", {}).get(f_name, {}).get("mean", 0.0)), 2),
            }
            total_psi += psi

        num_feats = max(1, len(features_report))
        system_psi = round(total_psi / num_feats, 4)

        retraining_recommended = len(high_drift_features) > 0 or system_psi >= 0.15

        report = {
            "timestamp": utcnow().isoformat(),
            "sample_size": total_records,
            "system_psi": system_psi,
            "retraining_recommended": retraining_recommended,
            "overall_status": "CRITICAL_DRIFT" if retraining_recommended else ("WARNING" if moderate_drift_features else "HEALTHY"),
            "high_drift_features": high_drift_features,
            "moderate_drift_features": moderate_drift_features,
            "features": features_report,
            "thresholds": {
                "psi_stable": "< 0.10",
                "psi_warning": "0.10 - 0.20",
                "psi_critical": ">= 0.20",
                "ks_significance": "p < 0.05"
            }
        }

        # Log drift analysis
        self._save_drift_log(report)
        return report

    def _save_drift_log(self, report: Dict[str, Any]):
        history = []
        if os.path.exists(DRIFT_LOG_PATH):
            try:
                with open(DRIFT_LOG_PATH, "r") as f:
                    history = json.load(f)
            except Exception:
                history = []

        history.append({
            "timestamp": report["timestamp"],
            "sample_size": report["sample_size"],
            "system_psi": report["system_psi"],
            "overall_status": report["overall_status"],
            "retraining_recommended": report["retraining_recommended"],
            "high_drift_features": report["high_drift_features"],
        })

        # Keep last 50 snapshots
        history = history[-50:]
        try:
            with open(DRIFT_LOG_PATH, "w") as f:
                json.dump(history, f, indent=2)
        except Exception as e:
            logger.warning("[DriftDetector] Failed to persist drift history: %s", e)

    def trigger_retraining(self) -> Dict[str, Any]:
        """
        Execute automated model retraining pipeline:
        1. Calls train_models() to retrain XGBoost, Random Forest, and Linear Baseline.
        2. Regenerates native XGBoost JSON and enriched metrics.json.
        3. Atomically reloads the live DelayPredictor.
        """
        from app.ml.training.train_delay_model import train_and_evaluate_models
        from app.ml.delay_predictor import delay_predictor

        t0 = utcnow()
        train_res = train_and_evaluate_models()

        # Reload predictor instance
        delay_predictor._load_artifacts()
        self.baseline = self._load_baseline()

        return {
            "status": "SUCCESS",
            "message": "Model retraining pipeline completed successfully. DelayPredictor hot-reloaded.",
            "started_at": t0.isoformat(),
            "completed_at": utcnow().isoformat(),
            "new_metrics": train_res.get("metrics"),
            "xgboost_serialization": "xgboost.json (native)",
            "retrained_samples": train_res.get("n_train_samples")
        }


# Global drift detector
drift_detector = DriftDetector()
