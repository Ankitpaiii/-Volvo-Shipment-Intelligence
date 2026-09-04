"""
Synthetic Data Generation & Model Training Pipeline for Shipment Delay Prediction.
Trains and compares Baseline (Linear Regression), Random Forest, and XGBoost Regressors.
Calculates MAE, RMSE, and R2 on a holdout test set and saves trained artifacts.
"""
import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

RANDOM_SEED = 42
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "artifacts")


def generate_synthetic_delay_dataset(n_samples: int = 6000, seed: int = RANDOM_SEED) -> pd.DataFrame:
    """
    Generate realistic operational shipment trip data with non-linear delay interactions and stochastic noise.
    """
    np.random.seed(seed)

    # 1. Total Distance (km): 100 to 1500 km
    total_distance = np.random.uniform(100.0, 1500.0, n_samples)

    # 2. Current Progress: 0.05 to 0.95
    current_progress = np.random.uniform(0.05, 0.95, n_samples)
    remaining_distance = total_distance * (1.0 - current_progress)

    # 3. Current Speed (km/h): nominal highway 70 km/h, range 20 to 90 km/h
    current_speed = np.random.normal(65.0, 15.0, n_samples)
    current_speed = np.clip(current_speed, 15.0, 95.0)

    # 4. Dwell Time (hours spent waiting at weigh stations/customs/inspections)
    dwell_time = np.random.exponential(scale=1.5, size=n_samples)
    dwell_time = np.clip(dwell_time, 0.0, 12.0)

    # 5. Yard Congestion Ratio (0.0 to 1.0)
    yard_congestion = np.random.beta(a=2.0, b=2.0, size=n_samples)

    # 6. Historical Lane Average Delay (minutes): 0 to 90 mins
    historical_delay = np.random.gamma(shape=2.0, scale=12.0, size=n_samples)

    # 7. Priority Tier: 0=STANDARD, 1=HIGH, 2=URGENT (represented numerically)
    priority_level = np.random.choice([0, 1, 2], size=n_samples, p=[0.60, 0.25, 0.15])

    # 8. Route Risk Index (0.5 to 2.0 based on corridor complexity)
    route_risk = np.random.uniform(0.8, 1.8, n_samples)

    # --- Target Delay Calculation (Non-linear physics + operational constraints + noise) ---
    # Speed deficit impact: below 60 km/h creates compounding delay per 100km remaining
    speed_factor = np.maximum(0.0, (60.0 - current_speed) / 60.0)
    transit_delay = (remaining_distance / 60.0) * speed_factor * 60.0 * route_risk * 0.45

    # Dwell bottleneck: hours converted to minutes with compounding congestion
    dwell_delay = dwell_time * 45.0 * (1.0 + 0.8 * yard_congestion)

    # Congestion non-linear surge: congestion > 0.65 causes exponential gate queues
    congestion_surge = np.where(
        yard_congestion > 0.65,
        ((yard_congestion - 0.65) / 0.35) ** 2 * 65.0,
        yard_congestion * 15.0
    )

    # Priority expedited handling discount (urgent shipments get prioritized)
    priority_discount = priority_level * 18.0

    # Historical delay momentum
    hist_factor = historical_delay * 0.40

    # Stochastic environmental shocks (weather, tire repairs, customs audits)
    stochastic_noise = np.random.normal(0.0, 12.0, n_samples)
    rare_shocks = np.random.choice([0.0, 30.0, 60.0], size=n_samples, p=[0.90, 0.07, 0.03])

    # Combined actual delay in minutes (minimum 0)
    delay_minutes = (
        transit_delay +
        dwell_delay +
        congestion_surge +
        hist_factor -
        priority_discount +
        rare_shocks +
        stochastic_noise
    )
    delay_minutes = np.maximum(0.0, delay_minutes)

    df = pd.DataFrame({
        "total_distance": total_distance,
        "remaining_distance": remaining_distance,
        "current_progress": current_progress,
        "current_speed": current_speed,
        "dwell_time": dwell_time,
        "yard_congestion": yard_congestion,
        "historical_delay": historical_delay,
        "priority_level": priority_level,
        "route_risk": route_risk,
        "delay_minutes": delay_minutes
    })

    return df


def train_and_evaluate_models():
    """
    Train Baseline (Ridge), Random Forest, and XGBoost models.
    Persist weights and evaluation metrics.
    """
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    df = generate_synthetic_delay_dataset(n_samples=6000, seed=RANDOM_SEED)

    feature_cols = [
        "remaining_distance",
        "current_progress",
        "current_speed",
        "dwell_time",
        "yard_congestion",
        "historical_delay",
        "priority_level",
        "route_risk"
    ]
    target_col = "delay_minutes"

    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_SEED, shuffle=True
    )

    # 1. Feature Scaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    results = {}

    # Model 1: Baseline (Ridge Linear Regression)
    baseline_model = Ridge(alpha=1.0)
    baseline_model.fit(X_train_scaled, y_train)
    y_pred_base = baseline_model.predict(X_test_scaled)
    y_pred_base = np.maximum(0.0, y_pred_base)

    results["Baseline_Linear"] = {
        "MAE": float(mean_absolute_error(y_test, y_pred_base)),
        "RMSE": float(np.sqrt(mean_squared_error(y_test, y_pred_base))),
        "R2": float(r2_score(y_test, y_pred_base))
    }

    # Model 2: Random Forest Regressor
    rf_model = RandomForestRegressor(
        n_estimators=120, max_depth=12, random_state=RANDOM_SEED, n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    y_pred_rf = rf_model.predict(X_test)
    y_pred_rf = np.maximum(0.0, y_pred_rf)

    results["Random_Forest"] = {
        "MAE": float(mean_absolute_error(y_test, y_pred_rf)),
        "RMSE": float(np.sqrt(mean_squared_error(y_test, y_pred_rf))),
        "R2": float(r2_score(y_test, y_pred_rf))
    }

    # Model 3: XGBoost Regressor
    xgb_model = XGBRegressor(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    xgb_model.fit(X_train, y_train)
    y_pred_xgb = xgb_model.predict(X_test)
    y_pred_xgb = np.maximum(0.0, y_pred_xgb)

    results["XGBoost"] = {
        "MAE": float(mean_absolute_error(y_test, y_pred_xgb)),
        "RMSE": float(np.sqrt(mean_squared_error(y_test, y_pred_xgb))),
        "R2": float(r2_score(y_test, y_pred_xgb))
    }

    # Save artifacts (Native JSON for XGBoost to deprecate pickle warnings + joblib for scikit-learn)
    joblib.dump(scaler, os.path.join(ARTIFACTS_DIR, "scaler.joblib"))
    joblib.dump(baseline_model, os.path.join(ARTIFACTS_DIR, "baseline_model.joblib"))
    joblib.dump(rf_model, os.path.join(ARTIFACTS_DIR, "random_forest.joblib"))
    xgb_model.save_model(os.path.join(ARTIFACTS_DIR, "xgboost.json"))
    joblib.dump(xgb_model, os.path.join(ARTIFACTS_DIR, "xgboost.joblib"))

    # Feature Importance for analysis
    rf_feature_importances = dict(zip(feature_cols, rf_model.feature_importances_.tolist()))
    xgb_feature_importances = dict(zip(feature_cols, [float(x) for x in xgb_model.feature_importances_]))

    # Compute baseline feature distributions for PSI / KS drift detection
    feature_distributions = {}
    for col in feature_cols:
        col_vals = df[col].dropna().values
        feature_distributions[col] = {
            "mean": float(np.mean(col_vals)),
            "std": float(np.std(col_vals)),
            "min": float(np.min(col_vals)),
            "max": float(np.max(col_vals)),
            "quantiles": [float(q) for q in np.quantile(col_vals, np.linspace(0.1, 0.9, 9))]
        }

    metadata = {
        "serialization": {
            "xgboost": "xgboost.json",
            "random_forest": "random_forest.joblib",
            "baseline": "baseline_model.joblib",
            "scaler": "scaler.joblib"
        },
        "features": feature_cols,
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "metrics": results,
        "feature_importance": {
            "random_forest": rf_feature_importances,
            "xgboost": xgb_feature_importances
        },
        "feature_distributions": feature_distributions
    }

    metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print("=== Model Training Completed Successfully ===")
    print(json.dumps(metadata, indent=2))
    return metadata


if __name__ == "__main__":
    train_and_evaluate_models()
