import numpy as np
import pandas as pd
from .base import ForecastModel


class SeasonalNaive(ForecastModel):
    """Repeats the values from exactly `season_length` periods ago."""
    name = "seasonal_naive"

    def __init__(self, season_length: int = 168):  # 168h = 1 week
        self.season_length = season_length
        self._history: np.ndarray = np.array([])

    def fit(self, train: pd.DataFrame, target_col: str = "vehicle_count", **kwargs) -> None:
        self._history = train[target_col].values.astype(float)
        if kwargs.get("season_length"):
            self.season_length = int(kwargs["season_length"])

    def predict(self, horizon: int, exog: pd.DataFrame | None = None) -> np.ndarray:
        preds = []
        history = list(self._history)
        for _ in range(horizon):
            idx = -(self.season_length - len(preds) % self.season_length) % self.season_length or self.season_length
            val = history[-idx] if len(history) >= idx else history[-1]
            preds.append(val)
        return np.array(preds)

    def predict_with_ci(self, horizon: int, exog=None, alpha: float = 0.05):
        preds = self.predict(horizon)
        # CI from historical residuals (naive: use std of diffs at same season)
        diffs = []
        for i in range(self.season_length, len(self._history)):
            diffs.append(self._history[i] - self._history[i - self.season_length])
        if diffs:
            std = np.std(diffs) * (1.96 if alpha <= 0.05 else 1.645)
        else:
            std = preds.std() * 0.1
        return preds, preds - std, preds + std
