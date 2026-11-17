"""
Generate a realistic synthetic traffic dataset for JunctionFlow AI.
Run:  python scripts/generate_sample_data.py --output sample_traffic.csv
"""
import argparse
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

JUNCTIONS = [
    {"id": "JCT-001", "name": "Main St & 1st Ave",   "capacity": 1200},
    {"id": "JCT-002", "name": "Broadway & 5th St",   "capacity": 900},
    {"id": "JCT-003", "name": "Harbor Rd & Bay Blvd","capacity": 600},
    {"id": "JCT-004", "name": "Central Park N & 7th","capacity": 1500},
]

# Public holidays (MM-DD)
HOLIDAYS = {"01-01","01-20","02-17","05-26","07-04","09-01","11-27","12-25"}

HOUR_PATTERN = np.array([
    0.20, 0.15, 0.10, 0.08, 0.10, 0.25,   # 0-5
    0.55, 0.85, 1.00, 0.75, 0.65, 0.70,   # 6-11
    0.80, 0.70, 0.60, 0.65, 0.80, 0.95,   # 12-17
    0.90, 0.75, 0.60, 0.50, 0.40, 0.30,   # 18-23
])

DOW_FACTOR = [1.0, 1.0, 0.95, 0.95, 0.90, 0.65, 0.50]  # Mon-Sun

WEATHER_CONDITIONS = ["clear", "cloudy", "rain", "fog", "storm"]
WEATHER_WEIGHTS   = [0.50,    0.25,    0.15,  0.07,  0.03]


def _weather_impact(cond: str) -> float:
    return {"clear": 1.0, "cloudy": 0.97, "rain": 0.85, "fog": 0.75, "storm": 0.55}[cond]


def generate(start: datetime, end: datetime, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []

    ts = start
    while ts < end:
        is_holiday = ts.strftime("%m-%d") in HOLIDAYS
        weather = rng.choice(WEATHER_CONDITIONS, p=WEATHER_WEIGHTS)
        temp = rng.normal(18 if ts.month in range(4, 10) else 8, 5)
        rain = rng.exponential(2.0) if weather in ("rain", "storm") else 0.0
        humidity = rng.uniform(40, 95)
        wind = rng.exponential(10)

        for jct in JUNCTIONS:
            base = jct["capacity"] * HOUR_PATTERN[ts.hour] * DOW_FACTOR[ts.weekday()]
            if is_holiday:
                base *= 0.6
            base *= _weather_impact(weather)
            noise = rng.normal(0, base * 0.08)
            count = max(0, int(base + noise))

            rows.append({
                "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "junction_id": jct["id"],
                "vehicle_count": count,
                "temperature_c": round(temp, 1),
                "rainfall_mm": round(rain, 2),
                "humidity_pct": round(humidity, 1),
                "wind_speed_kmh": round(wind, 1),
                "weather_condition": weather,
                "is_holiday": int(is_holiday),
                "event_flag": int(rng.random() < 0.02),
            })

        ts += timedelta(hours=1)

    return pd.DataFrame(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="sample_traffic.csv")
    parser.add_argument("--days", type=int, default=180)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    end = datetime.now().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=args.days)

    print(f"Generating {args.days} days × {len(JUNCTIONS)} junctions × 24 hours …")
    df = generate(start, end, seed=args.seed)
    df.to_csv(args.output, index=False)
    print(f"Saved {len(df):,} rows → {args.output}")
    print(df.head(3).to_string())


if __name__ == "__main__":
    main()
