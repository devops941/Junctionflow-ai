import io
import logging
from datetime import datetime, timedelta
from bson import ObjectId
import numpy as np
import joblib
from app.db.mongo import get_db, get_gridfs
from app.models.forecast import ForecastCreate, FutureWeather, CongestionLevel
from app.services.congestion import classify_congestion_by_percentile

logger = logging.getLogger(__name__)


async def generate(body: ForecastCreate) -> dict:
    db = get_db()
    fs = get_gridfs()

    model_doc = await db.models.find_one({"_id": ObjectId(body.model_id)})
    if not model_doc or model_doc["status"] != "ready":
        raise ValueError("Model not ready or not found")

    # Load model binary — supports both legacy (bare model) and v2 (dict with engineer)
    grid_out = await fs.open_download_stream(ObjectId(model_doc["gridfs_model_id"]))
    buf = io.BytesIO(await grid_out.read())
    payload = joblib.load(buf)
    if isinstance(payload, dict):
        model = payload["model"]
        engineer = payload.get("engineer")
    else:
        model = payload
        engineer = None

    # Align to current local top-of-hour converted to UTC so that predictions land on exact round hours (:00)
    from datetime import timezone
    local_now = datetime.now().astimezone().replace(minute=0, second=0, microsecond=0)
    base_ts = local_now.astimezone(timezone.utc).replace(tzinfo=None)
    local_hour = local_now.hour

    # Build observation frame
    raw_obs = await _get_last_observations(body.junction_id, model_doc["dataset_id"], body.horizon_hours + 500)

    # Phase-align historical observations to the current local hour of day
    # so that lag_1, lag_24, lag_168 retrieve the matching hour-of-day telemetry
    if raw_obs is not None and len(raw_obs) > 0 and "timestamp" in raw_obs.columns:
        matching = raw_obs.index[raw_obs["timestamp"].dt.hour == local_hour].tolist()
        if matching:
            raw_obs = raw_obs.iloc[:matching[-1] + 1].copy()

    if engineer is not None and raw_obs is not None:
        last_obs = engineer.transform(raw_obs)
    else:
        last_obs = raw_obs

    # Inject future weather into the last row so recursive forecasting uses it
    if body.future_weather is not None and last_obs is not None and len(last_obs) > 0:
        _apply_future_weather(last_obs, body.future_weather)

    try:
        preds, lower, upper = model.predict_with_ci(body.horizon_hours, exog=last_obs, start_ts=base_ts)
    except (TypeError, ValueError):
        try:
            preds, lower, upper = model.predict_with_ci(body.horizon_hours, exog=last_obs)
        except Exception:
            preds = model.predict(body.horizon_hours)
            std = preds.std() * 0.1
            lower, upper = preds - std, preds + std

    preds = np.clip(preds, 0, None)
    lower = np.clip(lower, 0, None)

    # Congestion thresholds from historical data
    p50 = float(np.percentile(preds, 50))
    p95 = float(np.percentile(preds, 95))

    predictions = []
    for i, (p, lo, hi) in enumerate(zip(preds, lower, upper)):
        ts = base_ts + timedelta(hours=i + 1)
        level = classify_congestion_by_percentile(float(p), p50, p95)
        predictions.append({
            "timestamp": ts,
            "predicted": round(float(p), 2),
            "lower_ci": round(float(lo), 2),
            "upper_ci": round(float(hi), 2),
            "actual": None,
            "congestion_level": level,
        })

    doc = {
        "model_id": body.model_id,
        "junction_id": body.junction_id,
        "horizon_hours": body.horizon_hours,
        "future_weather": body.future_weather.model_dump() if body.future_weather else None,
        "generated_at": datetime.utcnow(),
        "predictions": predictions,
    }
    result = await db.forecasts.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return _s(doc)


async def list_forecasts(junction_id, model_id) -> list:
    db = get_db()
    q: dict = {}
    if junction_id:
        q["junction_id"] = junction_id
    if model_id:
        q["model_id"] = model_id
    cursor = db.forecasts.find(q, {"predictions": 0}).sort("generated_at", -1).limit(50)
    return [_s(d) async for d in cursor]


async def get_forecast(forecast_id: str) -> dict | None:
    db = get_db()
    doc = await db.forecasts.find_one({"_id": ObjectId(forecast_id)})
    return _s(doc) if doc else None


async def get_congestion_flags(forecast_id: str) -> list:
    doc = await get_forecast(forecast_id)
    if not doc:
        return []
    return [p for p in doc["predictions"]
            if p["congestion_level"] in (CongestionLevel.high, CongestionLevel.critical)]


async def _get_last_observations(junction_id: str, dataset_id: str, n: int):
    import pandas as pd
    db = get_db()
    cursor = db.traffic_observations.find(
        {"junction_id": junction_id, "dataset_id": dataset_id},
        {"_id": 0},
    ).sort("timestamp", -1).limit(n)
    docs = [d async for d in cursor]
    if not docs:
        return None
    df = pd.DataFrame(docs).sort_values("timestamp").reset_index(drop=True)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    import numpy as np
    df["hour_sin"] = np.sin(2 * np.pi * df["timestamp"].dt.hour / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["timestamp"].dt.hour / 24)
    df["dow_sin"] = np.sin(2 * np.pi * df["timestamp"].dt.dayofweek / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["timestamp"].dt.dayofweek / 7)
    for lag in [1, 2, 3, 24, 48, 168]:
        df[f"lag_{lag}"] = df["vehicle_count"].shift(lag)
    for window in [3, 6, 12, 24]:
        df[f"roll_mean_{window}"] = df["vehicle_count"].shift(1).rolling(window, min_periods=1).mean()
    return df


def _apply_future_weather(df, fw: FutureWeather) -> None:
    """Override last row's weather columns with user-specified future values."""
    idx = df.index[-1]
    numeric_map = {
        "temperature_c": fw.temperature_c,
        "rainfall_mm": fw.rainfall_mm,
        "humidity_pct": fw.humidity_pct,
        "wind_speed_kmh": fw.wind_speed_kmh,
    }
    for col, val in numeric_map.items():
        if val is not None and col in df.columns:
            df.at[idx, col] = float(val)
    if fw.weather_condition is not None:
        for cat in ("clear", "cloudy", "fog", "rain", "storm"):
            col = f"weather_{cat}"
            if col in df.columns:
                df.at[idx, col] = int(fw.weather_condition == cat)


def _s(doc):
    if not doc:
        return doc
    doc["_id"] = str(doc.get("_id", ""))
    gen_at = doc.get("generated_at")
    if hasattr(gen_at, "isoformat"):
        iso = gen_at.isoformat()
        doc["generated_at"] = iso if iso.endswith("Z") or "+" in iso else iso + "Z"
    elif isinstance(gen_at, str) and not gen_at.endswith("Z") and "+" not in gen_at:
        doc["generated_at"] = gen_at + "Z"

    for p in doc.get("predictions", []):
        ts = p.get("timestamp")
        if hasattr(ts, "isoformat"):
            iso = ts.isoformat()
            p["timestamp"] = iso if iso.endswith("Z") or "+" in iso else iso + "Z"
        elif isinstance(ts, str) and not ts.endswith("Z") and "+" not in ts:
            p["timestamp"] = ts + "Z"
        if isinstance(p.get("congestion_level"), CongestionLevel):
            p["congestion_level"] = p["congestion_level"].value
    return doc
