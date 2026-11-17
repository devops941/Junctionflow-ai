import logging
import math
from datetime import datetime
import pandas as pd
import numpy as np
from app.db.mongo import get_db

logger = logging.getLogger(__name__)

WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _build_query(dataset_id: str, junction_ids: list[str] | None,
                 start: str | None, end: str | None,
                 is_holiday: str | None, weather_condition: str | None) -> dict:
    q: dict = {"dataset_id": dataset_id}
    if junction_ids:
        q["junction_id"] = {"$in": junction_ids}
    if start or end:
        q["timestamp"] = {}
        if start:
            q["timestamp"]["$gte"] = datetime.fromisoformat(start)
        if end:
            q["timestamp"]["$lte"] = datetime.fromisoformat(end)
    if is_holiday is not None and is_holiday != "all":
        q["is_holiday"] = is_holiday == "true"
    if weather_condition:
        q["weather.weather_condition"] = weather_condition
    return q


def _apply_time_filters(df: pd.DataFrame, weekdays: list[int] | None,
                        hour_start: int | None, hour_end: int | None) -> pd.DataFrame:
    if df.empty:
        return df
    if weekdays:
        df = df[df["timestamp"].dt.dayofweek.isin(weekdays)]
    if hour_start is not None:
        df = df[df["timestamp"].dt.hour >= hour_start]
    if hour_end is not None:
        df = df[df["timestamp"].dt.hour <= hour_end]
    return df


async def _fetch_df(dataset_id: str, junction_ids: list[str] | None = None,
                    start: str | None = None, end: str | None = None,
                    weekdays: list[int] | None = None,
                    hour_start: int | None = None, hour_end: int | None = None,
                    is_holiday: str | None = None,
                    weather_condition: str | None = None) -> pd.DataFrame:
    db = get_db()
    q = _build_query(dataset_id, junction_ids, start, end, is_holiday, weather_condition)
    cursor = db.traffic_observations.find(
        q, {"_id": 0, "timestamp": 1, "junction_id": 1, "vehicle_count": 1,
            "weather": 1, "is_holiday": 1, "event_flag": 1}
    )
    docs = [d async for d in cursor]
    if not docs:
        return pd.DataFrame()
    df = pd.DataFrame(docs)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = _apply_time_filters(df, weekdays, hour_start, hour_end)
    if not df.empty:
        df = df.sort_values(["junction_id", "timestamp"]).reset_index(drop=True)
    return df


async def get_filtered_summary(dataset_id, junction_ids, start, end,
                                weekdays, hour_start, hour_end,
                                is_holiday, weather_condition) -> dict:
    df = await _fetch_df(dataset_id, junction_ids, start, end, weekdays,
                         hour_start, hour_end, is_holiday, weather_condition)
    if df.empty:
        return {}
    total = int(df["vehicle_count"].sum())
    avg_h = round(float(df["vehicle_count"].mean()), 2)
    df["hour"] = df["timestamp"].dt.hour
    df["dow"] = df["timestamp"].dt.dayofweek
    hour_avg = df.groupby("hour")["vehicle_count"].mean()
    peak_hour = int(hour_avg.idxmax())
    peak_hour_avg = round(float(hour_avg.max()), 2)
    dow_avg = df.groupby("dow")["vehicle_count"].mean()
    busiest_dow = int(dow_avg.idxmax())
    jct_avg = df.groupby("junction_id")["vehicle_count"].mean()
    busiest_jct = str(jct_avg.idxmax())
    return {
        "total_vehicles": total,
        "avg_hourly_count": avg_h,
        "peak_hour": peak_hour,
        "peak_hour_avg": peak_hour_avg,
        "busiest_weekday": busiest_dow,
        "busiest_weekday_name": WEEKDAY_NAMES[busiest_dow],
        "busiest_junction": busiest_jct,
        "observation_count": len(df),
        "junctions_included": df["junction_id"].unique().tolist(),
        "date_start": df["timestamp"].min().isoformat(),
        "date_end": df["timestamp"].max().isoformat(),
    }


async def get_filtered_timeseries(dataset_id, junction_ids, start, end,
                                   weekdays, hour_start, hour_end,
                                   is_holiday, weather_condition,
                                   resample: str = "1h") -> dict:
    df = await _fetch_df(dataset_id, junction_ids, start, end, weekdays,
                         hour_start, hour_end, is_holiday, weather_condition)
    if df.empty:
        return {"timestamps": [], "series": {}}
    result: dict[str, list] = {}
    all_ts = set()
    for jct, group in df.groupby("junction_id"):
        g = group.set_index("timestamp")["vehicle_count"].resample(resample).mean().fillna(0)
        result[str(jct)] = {ts.isoformat(): round(float(v), 2) for ts, v in g.items()}
        all_ts.update(result[str(jct)].keys())
    timestamps = sorted(all_ts)
    series = {jct: [vals.get(ts, None) for ts in timestamps] for jct, vals in result.items()}
    return {"timestamps": timestamps, "series": series}


async def get_heatmap(dataset_id, junction_ids, start, end,
                      weekdays, hour_start, hour_end, is_holiday, weather_condition) -> dict:
    df = await _fetch_df(dataset_id, junction_ids, start, end, weekdays,
                         hour_start, hour_end, is_holiday, weather_condition)
    if df.empty:
        return {}
    df["hour"] = df["timestamp"].dt.hour
    df["dow"] = df["timestamp"].dt.dayofweek
    pivot = df.pivot_table(values="vehicle_count", index="dow", columns="hour",
                           aggfunc="mean").reindex(range(7)).reindex(columns=range(24)).fillna(0)
    return {
        "hours": list(range(24)),
        "days": list(range(7)),
        "day_names": WEEKDAY_NAMES,
        "values": [[round(float(pivot.loc[d, h]), 2) for h in range(24)] for d in range(7)],
    }


async def get_weekday_avg(dataset_id, junction_ids, start, end,
                           weekdays, hour_start, hour_end, is_holiday, weather_condition) -> dict:
    df = await _fetch_df(dataset_id, junction_ids, start, end, weekdays,
                         hour_start, hour_end, is_holiday, weather_condition)
    if df.empty:
        return {}
    df["dow"] = df["timestamp"].dt.dayofweek
    avg = df.groupby("dow")["vehicle_count"].mean().reindex(range(7), fill_value=0)
    return {"days": WEEKDAY_NAMES, "values": [round(float(v), 2) for v in avg.values]}


async def get_weather_impact(dataset_id, junction_ids, start, end,
                              weekdays, hour_start, hour_end, is_holiday, weather_condition) -> dict:
    df = await _fetch_df(dataset_id, junction_ids, start, end, weekdays,
                         hour_start, hour_end, is_holiday, weather_condition)
    if df.empty or "weather" not in df.columns:
        return {}
    df["weather_cond"] = df["weather"].apply(
        lambda w: w.get("weather_condition") if isinstance(w, dict) else None
    )
    df = df.dropna(subset=["weather_cond"])
    conditions = ["clear", "cloudy", "rain", "fog", "storm"]
    stats = {}
    for cond in conditions:
        sub = df[df["weather_cond"] == cond]["vehicle_count"]
        if len(sub) == 0:
            continue
        q1, med, q3 = float(sub.quantile(0.25)), float(sub.quantile(0.5)), float(sub.quantile(0.75))
        iqr = q3 - q1
        lower_fence = max(float(sub.min()), q1 - 1.5 * iqr)
        upper_fence = min(float(sub.max()), q3 + 1.5 * iqr)
        stats[cond] = {
            "min": round(lower_fence, 2),
            "q1": round(q1, 2),
            "median": round(med, 2),
            "q3": round(q3, 2),
            "max": round(upper_fence, 2),
            "mean": round(float(sub.mean()), 2),
            "count": len(sub),
        }
    return {"conditions": [c for c in conditions if c in stats], "stats": stats}


async def get_stl_decomposition(dataset_id, junction_id: str, start, end,
                                 is_holiday, weather_condition, period: int = 24) -> dict:
    df = await _fetch_df(dataset_id, [junction_id], start, end, None, None, None, is_holiday, weather_condition)
    if df.empty:
        return {}
    series = df.set_index("timestamp")["vehicle_count"].resample("1h").mean().interpolate("time")
    if len(series) < period * 2:
        return {"error": f"Not enough data for STL (need {period * 2}+ points, got {len(series)})"}
    try:
        from statsmodels.tsa.seasonal import STL
        stl = STL(series, period=period, robust=True)
        result = stl.fit()
        timestamps = [ts.isoformat() for ts in series.index]
        return {
            "timestamps": timestamps,
            "observed": [round(float(v), 2) for v in result.observed],
            "trend": [round(float(v), 2) for v in result.trend],
            "seasonal": [round(float(v), 2) for v in result.seasonal],
            "residual": [round(float(v), 2) for v in result.resid],
        }
    except Exception as exc:
        logger.warning(f"STL failed: {exc}")
        return {"error": str(exc)}


async def get_junction_comparison(dataset_id, junction_ids, start, end,
                                   weekdays, hour_start, hour_end,
                                   is_holiday, weather_condition, resample: str = "1D") -> dict:
    return await get_filtered_timeseries(dataset_id, junction_ids, start, end,
                                          weekdays, hour_start, hour_end,
                                          is_holiday, weather_condition, resample)


async def get_raw_records(dataset_id, junction_ids, start, end,
                           weekdays, hour_start, hour_end,
                           is_holiday, weather_condition,
                           page: int = 1, page_size: int = 50,
                           sort_by: str = "timestamp", sort_dir: str = "asc") -> dict:
    df = await _fetch_df(dataset_id, junction_ids, start, end, weekdays,
                         hour_start, hour_end, is_holiday, weather_condition)
    if df.empty:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "pages": 0}
    # flatten weather
    if "weather" in df.columns:
        for field in ["temperature_c", "rainfall_mm", "humidity_pct", "wind_speed_kmh", "weather_condition"]:
            df[field] = df["weather"].apply(lambda w: w.get(field) if isinstance(w, dict) else None)
        df = df.drop(columns=["weather"])
    # sort
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(sort_dir == "asc"))
    total = len(df)
    skip = (page - 1) * page_size
    page_df = df.iloc[skip: skip + page_size]
    items = []
    for _, row in page_df.iterrows():
        item = {}
        for col in page_df.columns:
            val = row[col]
            if pd.isna(val):
                item[col] = None
            elif hasattr(val, "isoformat"):
                item[col] = val.isoformat()
            else:
                item[col] = val
        items.append(item)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
    }


async def export_filtered(dataset_id, junction_ids, start, end,
                           weekdays, hour_start, hour_end,
                           is_holiday, weather_condition, fmt: str = "csv") -> bytes:
    df = await _fetch_df(dataset_id, junction_ids, start, end, weekdays,
                         hour_start, hour_end, is_holiday, weather_condition)
    if df.empty:
        df = pd.DataFrame([{"message": "No data matching filters"}])
    else:
        if "weather" in df.columns:
            for field in ["temperature_c", "rainfall_mm", "humidity_pct", "wind_speed_kmh", "weather_condition"]:
                df[field] = df["weather"].apply(lambda w: w.get(field) if isinstance(w, dict) else None)
            df = df.drop(columns=["weather"])
        df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")
    import io
    buf = io.BytesIO()
    if fmt == "xlsx":
        df.to_excel(buf, index=False)
    else:
        return df.to_csv(index=False).encode()
    return buf.getvalue()


# Keep old simple aliases for backward compat
async def get_timeseries(dataset_id, junction_id, start, end, resample) -> dict:
    result = await get_filtered_timeseries(dataset_id, [junction_id], start, end,
                                            None, None, None, None, None, resample)
    vcs = result["series"].get(junction_id, [])
    return {"timestamps": result["timestamps"], "vehicle_counts": vcs}


async def get_summary(dataset_id: str, junction_id=None) -> dict:
    jids = [junction_id] if junction_id else None
    return await get_filtered_summary(dataset_id, jids, None, None, None, None, None, None, None)


async def get_distribution(dataset_id: str, junction_id: str) -> dict:
    df = await _fetch_df(dataset_id, [junction_id])
    if df.empty:
        return {}
    counts = df["vehicle_count"].tolist()
    hist, edges = np.histogram(counts, bins=30)
    return {"bins": edges[:-1].round(1).tolist(), "counts": hist.tolist()}


async def get_seasonality(dataset_id: str, junction_id: str) -> dict:
    df = await _fetch_df(dataset_id, [junction_id])
    if df.empty:
        return {}
    df["hour"] = df["timestamp"].dt.hour
    df["dow"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    return {
        "by_hour": df.groupby("hour")["vehicle_count"].mean().round(2).to_dict(),
        "by_dow": df.groupby("dow")["vehicle_count"].mean().round(2).to_dict(),
        "by_month": df.groupby("month")["vehicle_count"].mean().round(2).to_dict(),
    }
