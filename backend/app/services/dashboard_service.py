import logging
from datetime import datetime, timedelta
from app.db.mongo import get_db
from app.services.congestion import classify_congestion

logger = logging.getLogger(__name__)


async def get_summary() -> dict:
    db = get_db()
    junctions, datasets, models, active_models, forecasts = await _gather_counts(db)
    return {
        "total_junctions": junctions,
        "total_datasets": datasets,
        "total_models": models,
        "active_models": active_models,
        "total_forecasts": forecasts,
    }


async def _gather_counts(db):
    import asyncio
    j, d, m, am, f = await asyncio.gather(
        db.junctions.count_documents({}),
        db.datasets.count_documents({}),
        db.models.count_documents({"status": "ready"}),
        db.models.count_documents({"is_active": True}),
        db.forecasts.count_documents({}),
    )
    return j, d, m, am, f


async def get_live_congestion() -> list:
    """
    Returns the current-hour congestion level per junction by looking at
    the most recent forecast for each active-model junction.
    """
    db = get_db()
    active = await db.models.find({"is_active": True, "status": "ready"}).to_list(50)
    if not active:
        return []

    seen = set()
    result = []
    now = datetime.utcnow()

    for model in active:
        jid = model["junction_id"]
        if jid in seen:
            continue
        seen.add(jid)

        junction = await db.junctions.find_one({"junction_id": jid})
        capacity = junction.get("capacity_per_hour") if junction else None

        forecast = await db.forecasts.find_one(
            {"junction_id": jid},
            sort=[("generated_at", -1)],
        )
        if not forecast or not forecast.get("predictions"):
            continue

        predictions = forecast.get("predictions", [])
        if not predictions:
            continue

        # Pick the prediction matching the current hour of day
        current_hour = now.hour
        closest = min(
            predictions,
            key=lambda p: abs(
                ((datetime.fromisoformat(p["timestamp"]) if isinstance(p["timestamp"], str)
                  else p["timestamp"]).hour) - current_hour
            ),
            default=predictions[0],
        )

        pred_val = closest["predicted"]
        if capacity:
            level = classify_congestion(pred_val, capacity).value
        else:
            level = closest.get("congestion_level", "low")
            if hasattr(level, "value"):
                level = level.value

        result.append({
            "junction_id": jid,
            "junction_name": junction.get("name", jid) if junction else jid,
            "predicted": round(pred_val, 1),
            "congestion_level": level,
            "capacity": capacity,
            "ratio": round(pred_val / capacity, 2) if capacity else None,
        })

    return sorted(result, key=lambda x: {"critical": 0, "high": 1, "moderate": 2, "low": 3}.get(x["congestion_level"], 4))


async def get_recent_forecasts(limit: int = 5) -> list:
    db = get_db()
    cursor = db.forecasts.find({}, {"predictions": 0}).sort("generated_at", -1).limit(limit)
    docs = [d async for d in cursor]
    for d in docs:
        d["_id"] = str(d["_id"])
        gen_at = d.get("generated_at")
        if hasattr(gen_at, "isoformat"):
            iso = gen_at.isoformat()
            d["generated_at"] = iso if iso.endswith("Z") or "+" in iso else iso + "Z"
        elif isinstance(gen_at, str) and not gen_at.endswith("Z") and "+" not in gen_at:
            d["generated_at"] = gen_at + "Z"
    return docs


async def get_congestion_alerts(hours_ahead: int = 24) -> list:
    """
    Upcoming high/critical congestion predictions from latest active-model forecasts.
    Uses capacity-based thresholds when junction capacity is known.
    """
    db = get_db()
    now = datetime.utcnow()
    cutoff = now + timedelta(hours=hours_ahead)

    active = await db.models.find({"is_active": True, "status": "ready"}).to_list(50)
    if not active:
        return []

    seen = set()
    alerts = []

    for model in active:
        jid = model["junction_id"]
        if jid in seen:
            continue
        seen.add(jid)

        junction = await db.junctions.find_one({"junction_id": jid})
        capacity = junction.get("capacity_per_hour") if junction else None

        forecast = await db.forecasts.find_one(
            {"junction_id": jid},
            sort=[("generated_at", -1)],
        )
        if not forecast:
            continue

        predictions = forecast.get("predictions", [])
        if not predictions:
            continue

        # Look for future predictions within cutoff; fallback to upcoming horizon predictions
        upcoming = []
        for p in predictions:
            ts_raw = p.get("timestamp")
            if isinstance(ts_raw, str):
                t = datetime.fromisoformat(ts_raw.replace("Z", "+00:00")).replace(tzinfo=None)
            elif hasattr(ts_raw, "replace"):
                t = ts_raw.replace(tzinfo=None)
            else:
                continue
            if now <= t <= cutoff:
                upcoming.append((p, t))

        if not upcoming:
            # Fallback: take first 24h predictions from forecast
            for p in predictions[:hours_ahead]:
                ts_raw = p.get("timestamp")
                if isinstance(ts_raw, str):
                    t = datetime.fromisoformat(ts_raw.replace("Z", "+00:00")).replace(tzinfo=None)
                elif hasattr(ts_raw, "replace"):
                    t = ts_raw.replace(tzinfo=None)
                else:
                    t = now
                upcoming.append((p, t))

        for pred, ts in upcoming:
            pred_val = float(pred["predicted"])
            if capacity:
                level = classify_congestion(pred_val, capacity).value
            else:
                lv = pred.get("congestion_level", "low")
                level = lv.value if hasattr(lv, "value") else str(lv)

            if level in ("high", "critical"):
                alerts.append({
                    "junction_id": jid,
                    "junction_name": junction.get("name", jid) if junction else jid,
                    "timestamp": ts.isoformat() + ("Z" if not ts.isoformat().endswith("Z") else ""),
                    "predicted": pred_val,
                    "congestion_level": level,
                    "capacity": capacity,
                    "ratio": round(pred_val / capacity, 2) if capacity else None,
                })

    lvl_order = {"critical": 0, "high": 1}
    return sorted(alerts, key=lambda x: (lvl_order.get(x["congestion_level"], 2), x["timestamp"]))
