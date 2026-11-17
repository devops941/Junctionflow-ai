"""
FeatureEngineer: stateful transformer that fits on training data and transforms
test/prediction data with no data leakage.

STRICT RULES enforced here:
  - All lags use shift(n) where n >= 1
  - All rolling windows use shift(1) BEFORE rolling
  - Scalers are fit on training data only (fit_transform), then applied to
    test/prediction data (transform)
"""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from app.models.feature_set import FeatureConfig

_WEATHER_CATS = ["clear", "cloudy", "fog", "rain", "storm"]
_NUMERIC_WEATHER = ["temperature_c", "rainfall_mm", "humidity_pct", "wind_speed_kmh"]
_EXCLUDE_COLS = {
    "timestamp", "junction_id", "vehicle_count", "weather",
    "is_holiday", "event_flag", "_id", "_split",
}


class FeatureEngineer:
    """
    Fits on training data, transforms test/prediction data.
    Serialise with joblib alongside the forecast model.
    """

    def __init__(self, config: FeatureConfig):
        self.config = config
        self._scaler: StandardScaler | None = None
        self._scaler_cols: list[str] = []
        self.feature_columns: list[str] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Build features AND fit scalers. Call only on training data."""
        df = self._build(df)
        if self.config.scale_numeric:
            df = self._fit_scale(df)
        self.feature_columns = [
            c for c in df.columns
            if c not in _EXCLUDE_COLS and pd.api.types.is_numeric_dtype(df[c])
        ]
        return df

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Build features and apply pre-fitted scalers. Call on test/prediction data."""
        df = self._build(df)
        if self.config.scale_numeric and self._scaler is not None:
            df = self._apply_scale(df)
        return df

    def save(self, path: str) -> None:
        import joblib
        joblib.dump(self, path)

    @classmethod
    def load(cls, path: str) -> "FeatureEngineer":
        import joblib
        return joblib.load(path)

    # ------------------------------------------------------------------
    # Internal pipeline
    # ------------------------------------------------------------------

    def _build(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df = df.sort_values(["junction_id", "timestamp"]).reset_index(drop=True)
        df = self._time_features(df)
        df = self._calendar_features(df)
        df = self._lag_features(df)
        df = self._rolling_features(df)
        df = self._weather_features(df)
        return df

    def _time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        ts = df["timestamp"]
        if self.config.include_hour:
            df["hour"] = ts.dt.hour
        if self.config.include_dow:
            df["day_of_week"] = ts.dt.dayofweek
        if self.config.include_dom:
            df["day_of_month"] = ts.dt.day
        if self.config.include_month:
            df["month"] = ts.dt.month
        if self.config.include_week_of_year:
            df["week_of_year"] = ts.dt.isocalendar().week.astype(int)
        if self.config.include_is_weekend:
            df["is_weekend"] = (ts.dt.dayofweek >= 5).astype(int)
        # Cyclical encodings — capture circular nature of time
        if self.config.cyclical_hour:
            df["hour_sin"] = np.sin(2 * np.pi * ts.dt.hour / 24)
            df["hour_cos"] = np.cos(2 * np.pi * ts.dt.hour / 24)
        if self.config.cyclical_dow:
            df["dow_sin"] = np.sin(2 * np.pi * ts.dt.dayofweek / 7)
            df["dow_cos"] = np.cos(2 * np.pi * ts.dt.dayofweek / 7)
        return df

    def _calendar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.config.include_holiday and "is_holiday" in df.columns:
            df["is_holiday_int"] = df["is_holiday"].fillna(False).astype(int)
        if self.config.include_event and "event_flag" in df.columns:
            df["event_flag_int"] = df["event_flag"].fillna(False).astype(int)
        return df

    def _lag_features(self, df: pd.DataFrame) -> pd.DataFrame:
        # Lags are sorted and must be >= 1 — shift prevents leakage
        for lag in sorted(set(max(1, lag_val) for lag_val in self.config.lags)):
            df[f"lag_{lag}"] = df.groupby("junction_id")["vehicle_count"].transform(
                lambda x, lag_step=lag: x.shift(lag_step)
            )
        return df

    def _rolling_features(self, df: pd.DataFrame) -> pd.DataFrame:
        # shift(1) BEFORE rolling — this is the leakage guard
        for window in sorted(set(self.config.rolling_windows)):
            for stat in self.config.rolling_stats:
                col = f"roll_{stat}_{window}h"
                if stat == "mean":
                    df[col] = df.groupby("junction_id")["vehicle_count"].transform(
                        lambda x, w=window: x.shift(1).rolling(w, min_periods=1).mean()
                    )
                elif stat == "std":
                    df[col] = df.groupby("junction_id")["vehicle_count"].transform(
                        lambda x, w=window: x.shift(1).rolling(w, min_periods=2).std().fillna(0)
                    )
                elif stat == "min":
                    df[col] = df.groupby("junction_id")["vehicle_count"].transform(
                        lambda x, w=window: x.shift(1).rolling(w, min_periods=1).min()
                    )
                elif stat == "max":
                    df[col] = df.groupby("junction_id")["vehicle_count"].transform(
                        lambda x, w=window: x.shift(1).rolling(w, min_periods=1).max()
                    )
        return df

    def _weather_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if "weather" not in df.columns:
            return df
        if self.config.include_weather_numeric:
            for col in _NUMERIC_WEATHER:
                df[col] = df["weather"].apply(
                    lambda w: w.get(col) if isinstance(w, dict) else None
                )
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        if self.config.include_weather_onehot:
            cond = df["weather"].apply(
                lambda w: w.get("weather_condition") if isinstance(w, dict) else "clear"
            ).fillna("clear")
            for cat in _WEATHER_CATS:
                df[f"weather_{cat}"] = (cond == cat).astype(int)
        return df

    def _fit_scale(self, df: pd.DataFrame) -> pd.DataFrame:
        cols = [c for c in _NUMERIC_WEATHER if c in df.columns]
        if cols:
            self._scaler = StandardScaler()
            df[cols] = self._scaler.fit_transform(df[cols].values.astype(float))
            self._scaler_cols = cols
        return df

    def _apply_scale(self, df: pd.DataFrame) -> pd.DataFrame:
        cols = [c for c in self._scaler_cols if c in df.columns]
        if cols and self._scaler:
            df[cols] = self._scaler.transform(df[cols].fillna(0.0).values.astype(float))
        return df
