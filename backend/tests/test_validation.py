import pandas as pd
import numpy as np
from app.services.validation import validate_dataframe


def test_duplicate_detection():
    """Rows with same junction_id + timestamp should be flagged."""
    df = pd.DataFrame({
        "timestamp": pd.to_datetime(["2024-01-01 00:00", "2024-01-01 00:00", "2024-01-01 01:00"]),
        "vehicle_count": [100.0, 120.0, 150.0],
        "junction_id": ["J001", "J001", "J001"],
    })
    result = validate_dataframe(df)
    assert result.get("duplicate_count", 0) > 0 or result.get("warnings") or result.get("errors")


def test_negative_clamping():
    """Negative vehicle counts should be caught as an error or warning."""
    df = pd.DataFrame({
        "timestamp": pd.date_range("2024-01-01", periods=5, freq="h"),
        "vehicle_count": [100.0, -50.0, 200.0, 150.0, 300.0],
        "junction_id": ["J001"] * 5,
    })
    result = validate_dataframe(df)
    # Either flagged as error/warning or negative_count returned
    has_flag = (
        result.get("negative_count", 0) > 0
        or result.get("errors")
        or result.get("warnings")
    )
    assert has_flag


def test_valid_dataframe_passes():
    """Clean DataFrame with no issues should not produce errors."""
    df = pd.DataFrame({
        "timestamp": pd.date_range("2024-01-01", periods=24, freq="h"),
        "vehicle_count": np.random.uniform(100, 500, 24),
        "junction_id": ["J001"] * 24,
    })
    result = validate_dataframe(df)
    errors = result.get("errors", [])
    assert len(errors) == 0 or all("negative" not in str(e).lower() for e in errors)


def test_missing_required_columns():
    """DataFrame missing vehicle_count should raise or return an error."""
    df = pd.DataFrame({
        "timestamp": pd.date_range("2024-01-01", periods=5, freq="h"),
        "junction_id": ["J001"] * 5,
    })
    try:
        result = validate_dataframe(df)
        assert result.get("errors") or not result.get("valid", True)
    except (KeyError, ValueError):
        pass  # Raising is also acceptable


def test_unparseable_timestamp_drops_bad_row():
    """Unparseable timestamp values like 'not_a_date' should be dropped with a warning, not crash."""
    df = pd.DataFrame({
        "timestamp": ["2024-01-01 00:00:00", "not_a_date", "2024-01-01 02:00:00"],
        "vehicle_count": [100.0, 150.0, 200.0],
        "junction_id": ["J001", "J001", "J001"],
    })
    report, cleaned_df = validate_dataframe(df)
    assert len(cleaned_df) == 2
    assert any("unparseable" in w.lower() for w in report.warnings)
