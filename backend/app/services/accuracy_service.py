"""
Compare ready models for a junction on their held-out test set.
Uses stored metrics for the table; regenerates predictions (≤168 steps)
for the actual-vs-predicted chart.
"""
import io
import logging
import numpy as np
import pandas as pd
import joblib
from bson import ObjectId
from app.db.mongo import get_db, get_gridfs
from app.services.ml.metrics import compute_all

logger = logging.getLogger(__name__)

ALGO_COLORS = {
    "seasonal_naive": "#8b5cf6",
    "sarimax": "#f59e0b",
    "random_forest": "#0ea5e9",
}


async def compare_models(junction_id: str, dataset_id: str) -> dict:
    """
    Returns comparison data for all ready models on this junction/dataset.
    Uses stored metrics for the table; re-runs ≤168 test-set predictions
    for chart visualisation.
    """
    db = get_db()
    fs = get_gridfs()

    model_docs = await db.models.find(
        {"junction_id": junction_id, "dataset_id": dataset_id, "status": "ready"}
    ).sort("created_at", 1).to_list(10)

    if not model_docs:
        return {"models": [], "best_model_id": None, "has_baseline": False}

    results = []
    for doc in model_docs:
        result = await _compare_one(doc, fs)
        if result:
            results.append(result)

    # Identify baseline (Seasonal Naive) and best model (lowest RMSE)
    baseline = next((r for r in results if r["algorithm"] == "seasonal_naive"), None)
    best = min(results, key=lambda r: r["metrics"].get("rmse") or float("inf"), default=None)

    # Inject improvement % vs baseline
    if baseline:
        base_metrics = baseline["metrics"]
        for r in results:
            if r["algorithm"] != "seasonal_naive":
                r["improvement_vs_baseline"] = {
                    k: round((base_metrics[k] - r["metrics"][k]) / base_metrics[k] * 100, 1)
                    if base_metrics.get(k) and base_metrics[k] != 0 else 0.0
                    for k in ("mae", "rmse", "mape")
                }

    return {
        "models": results,
        "best_model_id": str(best["model_id"]) if best else None,
        "has_baseline": baseline is not None,
        "junction_id": junction_id,
        "dataset_id": dataset_id,
    }


async def _compare_one(doc: dict, fs) -> dict | None:
    try:
        db = get_db()
        model_id = str(doc["_id"])

        # --- Load model + engineer from GridFS ---
        if not doc.get("gridfs_model_id"):
            return None
        grid_out = await fs.open_download_stream(ObjectId(doc["gridfs_model_id"]))
        buf = io.BytesIO(await grid_out.read())
        payload = joblib.load(buf)
        ml_model = payload["model"] if isinstance(payload, dict) else payload
        engineer = payload.get("engineer") if isinstance(payload, dict) else None

        # --- Load test observations (up to 168 hours) ---
        test_range = doc.get("test_range", {})
        q: dict = {"junction_id": doc["junction_id"], "dataset_id": doc["dataset_id"]}
        if test_range.get("start"):
            q["timestamp"] = {
                "$gte": pd.Timestamp(test_range["start"]).to_pydatetime(),
                "$lte": pd.Timestamp(test_range["end"]).to_pydatetime(),
            }
        cursor = db.traffic_observations.find(q, {"_id": 0}).sort("timestamp", 1).limit(168)
        test_docs = [d async for d in cursor]
        if not test_docs:
            return None

        test_df = pd.DataFrame(test_docs)
        test_df["timestamp"] = pd.to_datetime(test_df["timestamp"])
        test_df = test_df.sort_values("timestamp").reset_index(drop=True)

        # --- Load seed data (last 250 training rows) for lag warm-start ---
        seed_q: dict = {"junction_id": doc["junction_id"], "dataset_id": doc["dataset_id"]}
        if test_range.get("start"):
            seed_q["timestamp"] = {"$lt": pd.Timestamp(test_range["start"]).to_pydatetime()}
        seed_cursor = db.traffic_observations.find(seed_q, {"_id": 0}).sort("timestamp", -1).limit(250)
        seed_docs = [d async for d in seed_cursor]
        seed_df = pd.DataFrame(seed_docs).sort_values("timestamp").reset_index(drop=True) if seed_docs else None
        if seed_df is not None:
            seed_df["timestamp"] = pd.to_datetime(seed_df["timestamp"])

        # Apply feature engineering to seed data
        if engineer is not None and seed_df is not None:
            seed_features = engineer.transform(seed_df)
        else:
            seed_features = seed_df

        # --- Generate predictions ---
        horizon = len(test_df)
        try:
            preds, lower, upper = ml_model.predict_with_ci(horizon, exog=seed_features)
        except Exception:
            try:
                preds = ml_model.predict(horizon)
            except Exception:
                return None
            std = max(1.0, float(np.std(preds)) * 0.1)
            lower, upper = preds - std, preds + std

        preds = np.clip(preds, 0, None)
        actual = test_df["vehicle_count"].values.astype(float)

        # --- Compute fresh metrics on this window ---
        metrics = compute_all(actual, preds)

        # --- Per-hour MAE ---
        hourly: dict[int, list] = {}
        for i, row in test_df.iterrows():
            h = row["timestamp"].hour
            hourly.setdefault(h, []).append(abs(float(actual[i]) - float(preds[i])))
        hourly_mae = [{"hour": h, "mae": round(float(np.mean(errs)), 2)} for h, errs in sorted(hourly.items())]

        # --- Comparison data for chart ---
        comparison_data = [
            {
                "timestamp": row["timestamp"].isoformat(),
                "actual": float(actual[i]),
                "predicted": round(float(preds[i]), 1),
                "residual": round(float(actual[i]) - float(preds[i]), 1),
                "lower_ci": round(float(lower[i]), 1),
                "upper_ci": round(float(upper[i]), 1),
            }
            for i, (_, row) in enumerate(test_df.iterrows())
        ]

        return {
            "model_id": model_id,
            "model_name": doc.get("name", model_id),
            "algorithm": doc["algorithm"],
            "version": doc.get("version", 1),
            "color": ALGO_COLORS.get(doc["algorithm"], "#6b7280"),
            "is_baseline": doc["algorithm"] == "seasonal_naive",
            "metrics": metrics,
            "improvement_vs_baseline": None,
            "comparison_data": comparison_data,
            "hourly_mae": hourly_mae,
            "test_window_hours": horizon,
        }
    except Exception as exc:
        logger.warning(f"Model comparison failed for {doc.get('_id')}: {exc}")
        return None
