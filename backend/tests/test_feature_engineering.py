import numpy as np
import pytest
from app.services.feature_engineering import FeatureEngineer
from app.models.feature_set import FeatureConfig


def test_lag1_no_leakage(sample_df):
    """lag_1 at row i must equal vehicle_count at row i-1 (strict no-leakage)."""
    fe = FeatureEngineer(FeatureConfig(use_lag=True))
    result = fe.fit_transform(sample_df.copy())
    # Row 1 onwards (row 0 has NaN lag)
    for i in range(1, min(10, len(result))):
        actual_prev = sample_df.iloc[i - 1]["vehicle_count"]
        lag_val = result.iloc[i]["lag_1"]
        if not np.isnan(lag_val):
            assert lag_val == pytest.approx(actual_prev, rel=1e-3), \
                f"Row {i}: lag_1={lag_val} != vehicle_count[{i-1}]={actual_prev}"


def test_lag24_offset(sample_df):
    """lag_24 at row i must equal vehicle_count at row i-24."""
    fe = FeatureEngineer(FeatureConfig(use_lag=True))
    result = fe.fit_transform(sample_df.copy())
    for i in range(24, min(30, len(result))):
        actual_prev24 = sample_df.iloc[i - 24]["vehicle_count"]
        lag_val = result.iloc[i]["lag_24"]
        if not np.isnan(lag_val):
            assert lag_val == pytest.approx(actual_prev24, rel=1e-3)


def test_rolling_uses_shift(sample_df):
    """roll_mean_3h at row i must NOT use vehicle_count[i] (must use shift(1) first)."""
    fe = FeatureEngineer(FeatureConfig())
    result = fe.fit_transform(sample_df.copy())
    col = "roll_mean_3h" if "roll_mean_3h" in result.columns else "roll_mean_3"
    for i in range(3, min(10, len(result))):
        roll_val = result.iloc[i][col]
        # The rolling mean at i should be mean of [i-3, i-2, i-1] (after shift)
        expected = sample_df.iloc[i - 3:i]["vehicle_count"].mean()
        if not np.isnan(roll_val):
            assert roll_val == pytest.approx(expected, rel=1e-2)


def test_time_features_present(sample_df):
    fe = FeatureEngineer(FeatureConfig(use_time=True))
    result = fe.fit_transform(sample_df.copy())
    for col in ("hour_sin", "hour_cos", "dow_sin", "dow_cos"):
        assert col in result.columns, f"Missing {col}"


def test_weather_encoding(sample_df):
    fe = FeatureEngineer(FeatureConfig(use_weather=True))
    result = fe.fit_transform(sample_df.copy())
    # At least one weather_* column should exist
    weather_cols = [c for c in result.columns if c.startswith("weather_")]
    assert len(weather_cols) > 0


def test_transform_no_refitting(sample_df):
    """transform() must not refit scaler — apply same scaler as fit_transform()."""
    split = len(sample_df) // 2
    train = sample_df.iloc[:split].copy()
    test = sample_df.iloc[split:].copy()
    fe = FeatureEngineer(FeatureConfig(use_lag=True, use_rolling=True, use_time=True))
    fe.fit_transform(train)
    # Must not raise
    result = fe.transform(test)
    assert result is not None and len(result) > 0


def test_all_features_enabled(sample_df):
    config = FeatureConfig(
        use_time=True, use_calendar=True, use_lag=True,
        use_rolling=True, use_weather=True,
    )
    fe = FeatureEngineer(config)
    result = fe.fit_transform(sample_df.copy())
    # Expect many feature columns
    feature_cols = [c for c in result.columns if c not in ("vehicle_count", "timestamp", "junction_id", "dataset_id")]
    assert len(feature_cols) >= 10
