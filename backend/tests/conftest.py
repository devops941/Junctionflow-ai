import pandas as pd
import numpy as np
import pytest


@pytest.fixture
def sample_df():
    """One week of hourly data for 1 junction with realistic patterns."""
    rng = pd.date_range("2024-01-01", periods=168, freq="h")
    np.random.seed(42)
    # Base pattern: morning peak ~8am, evening peak ~5pm
    base = 400 + 200 * np.sin(np.pi * (rng.hour - 7) / 11) * (rng.hour.isin(range(7, 20)))
    noise = np.random.normal(0, 20, 168)
    # Weekend dip
    weekend_mask = rng.dayofweek >= 5
    vehicle_count = np.clip(base + noise - weekend_mask * 150, 50, None).astype(int)

    df = pd.DataFrame({
        "timestamp": rng,
        "vehicle_count": vehicle_count.astype(float),
        "temperature_c": 15.0 + 5 * np.sin(np.pi * rng.hour / 12) + np.random.normal(0, 1, 168),
        "rainfall_mm": np.maximum(0, np.random.normal(0, 0.5, 168)),
        "humidity_pct": 60.0 + np.random.normal(0, 5, 168),
        "wind_speed_kmh": 10.0 + np.random.exponential(5, 168),
        "weather_condition": np.random.choice(["clear", "cloudy", "rain"], 168),
        "junction_id": "J001",
        "dataset_id": "DS001",
    })
    return df


@pytest.fixture
def four_junction_df():
    """One week of hourly data for 4 junctions."""
    dfs = []
    for i in range(1, 5):
        rng = pd.date_range("2024-01-01", periods=168, freq="h")
        np.random.seed(i * 10)
        vc = np.clip(300 + 150 * np.random.randn(168).cumsum() * 0.01 + 100 * np.sin(np.pi * rng.hour / 12), 50, 1000)
        dfs.append(pd.DataFrame({
            "timestamp": rng,
            "vehicle_count": vc,
            "temperature_c": 15.0 + np.random.normal(0, 2, 168),
            "rainfall_mm": np.maximum(0, np.random.normal(0, 0.3, 168)),
            "humidity_pct": 60.0 + np.random.normal(0, 5, 168),
            "wind_speed_kmh": 10.0 + np.random.exponential(3, 168),
            "weather_condition": "clear",
            "junction_id": f"J{i:03d}",
            "dataset_id": "DS001",
        }))
    return pd.concat(dfs, ignore_index=True)
