import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from .base import ForecastModel

_TIME_FEATS = {
    "hour", "day_of_week", "day_of_month", "month", "week_of_year",
    "is_weekend", "is_holiday_int", "event_flag_int",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
}


class RandomForestModel(ForecastModel):
    name = "random_forest"

    def __init__(self, n_estimators: int = 200, max_depth: int = 15,
                 min_samples_leaf: int = 5, n_jobs: int = -1):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_leaf = min_samples_leaf
        self.n_jobs = n_jobs
        self._model: RandomForestRegressor | None = None
        self._feature_cols: list[str] = []
        self._target_col: str = "vehicle_count"
        self._train_mean: float = 0.0
        self.feature_importances_: dict[str, float] = {}
        self.cv_scores_: list[float] = []

    def fit(self, train: pd.DataFrame, target_col: str = "vehicle_count", **kwargs) -> None:
        self._target_col = target_col
        for k in ("n_estimators", "max_depth", "min_samples_leaf"):
            if k in kwargs:
                setattr(self, k, int(kwargs[k]))
        cv_folds = int(kwargs.get("cv_folds", 0))

        exclude = {target_col, "timestamp", "junction_id", "_split"}
        self._feature_cols = [
            c for c in train.columns
            if c not in exclude and pd.api.types.is_numeric_dtype(train[c])
        ]

        df = train.dropna(subset=self._feature_cols + [target_col])
        X = df[self._feature_cols].values.astype(float)
        y = df[target_col].values.astype(float)
        self._train_mean = float(np.mean(y))

        rf = RandomForestRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            min_samples_leaf=self.min_samples_leaf,
            n_jobs=self.n_jobs,
            random_state=42,
        )

        if cv_folds >= 2 and len(X) > cv_folds * 2:
            from sklearn.model_selection import TimeSeriesSplit, cross_val_score
            tscv = TimeSeriesSplit(n_splits=cv_folds)
            scores = cross_val_score(rf, X, y, cv=tscv, scoring="neg_mean_absolute_error")
            self.cv_scores_ = (-scores).tolist()

        rf.fit(X, y)
        self._model = rf
        self.feature_importances_ = dict(
            zip(self._feature_cols, rf.feature_importances_.round(6).tolist())
        )

    def predict(self, horizon: int, exog: pd.DataFrame | None = None, start_ts=None) -> np.ndarray:
        preds, _, _ = self.predict_with_ci(horizon, exog, start_ts=start_ts)
        return preds

    def predict_with_ci(self, horizon: int, exog: pd.DataFrame | None = None,
                        alpha: float = 0.05, start_ts=None):
        if self._model is None:
            raise ValueError("Model not fitted")

        if exog is None or len(exog) == 0:
            preds = np.full(horizon, max(0.0, self._train_mean))
            std = max(1.0, preds[0] * 0.1)
            return preds, preds - std, preds + std

        # Seed recursive history from recent observations
        history: list[float] = (
            exog["vehicle_count"].values.tolist()
            if "vehicle_count" in exog.columns else []
        )

        # Last known row for non-time / non-lag / non-roll features (e.g. weather)
        last_row = exog.iloc[-1]
        base_ts: pd.Timestamp = (
            pd.Timestamp(start_ts)
            if start_ts is not None
            else pd.Timestamp(last_row["timestamp"])
            if "timestamp" in last_row.index
            else pd.Timestamp.utcnow()
        )

        all_preds: list[float] = []
        all_tree_preds: list[np.ndarray] = []

        for step in range(horizon):
            future_ts = base_ts + pd.Timedelta(hours=step + 1)
            feat_vals: list[float] = []

            for col in self._feature_cols:
                v: float = 0.0
                if col == "hour":
                    v = float(future_ts.hour)
                elif col == "day_of_week":
                    v = float(future_ts.dayofweek)
                elif col == "day_of_month":
                    v = float(future_ts.day)
                elif col == "month":
                    v = float(future_ts.month)
                elif col == "week_of_year":
                    v = float(future_ts.isocalendar()[1])
                elif col == "is_weekend":
                    v = float(future_ts.dayofweek >= 5)
                elif col in ("is_holiday_int", "event_flag_int"):
                    v = 0.0
                elif col == "hour_sin":
                    v = np.sin(2 * np.pi * future_ts.hour / 24)
                elif col == "hour_cos":
                    v = np.cos(2 * np.pi * future_ts.hour / 24)
                elif col == "dow_sin":
                    v = np.sin(2 * np.pi * future_ts.dayofweek / 7)
                elif col == "dow_cos":
                    v = np.cos(2 * np.pi * future_ts.dayofweek / 7)
                elif col.startswith("lag_"):
                    lag = int(col[4:])
                    if len(history) >= lag:
                        v = float(history[-lag])
                    elif history:
                        v = float(history[0])
                elif col.startswith("roll_"):
                    parts = col.split("_")  # ["roll", "stat", "Nh"]
                    stat = parts[1] if len(parts) > 1 else "mean"
                    win_str = parts[2].rstrip("h") if len(parts) > 2 else "24"
                    window = int(win_str) if win_str.isdigit() else 24
                    slice_hist = history[-window:] if len(history) >= window else history
                    if slice_hist:
                        if stat == "mean":
                            v = float(np.mean(slice_hist))
                        elif stat == "std":
                            v = float(np.std(slice_hist)) if len(slice_hist) > 1 else 0.0
                        elif stat == "min":
                            v = float(min(slice_hist))
                        elif stat == "max":
                            v = float(max(slice_hist))
                else:
                    raw = last_row.get(col) if hasattr(last_row, "get") else last_row[col] if col in last_row.index else 0.0
                    v = float(raw) if pd.notna(raw) else 0.0

                feat_vals.append(v)

            X = np.array([feat_vals])
            tree_preds = np.array([t.predict(X)[0] for t in self._model.estimators_])
            pred = max(0.0, float(tree_preds.mean()))
            all_preds.append(pred)
            all_tree_preds.append(tree_preds)
            history.append(pred)

        preds = np.array(all_preds)
        tree_matrix = np.array(all_tree_preds)  # (horizon, n_estimators)
        lower = np.clip(np.percentile(tree_matrix, 100 * alpha / 2, axis=1), 0, None)
        upper = np.percentile(tree_matrix, 100 * (1 - alpha / 2), axis=1)
        return preds, lower, upper

    @property
    def feature_importances(self) -> dict[str, float]:
        return self.feature_importances_
