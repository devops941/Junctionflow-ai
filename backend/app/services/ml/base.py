from abc import ABC, abstractmethod
import pandas as pd
import numpy as np


class ForecastModel(ABC):
    name: str = "base"

    @abstractmethod
    def fit(self, train: pd.DataFrame, target_col: str = "vehicle_count", **kwargs) -> None: ...

    @abstractmethod
    def predict(self, horizon: int, exog: pd.DataFrame | None = None) -> np.ndarray: ...

    @abstractmethod
    def predict_with_ci(self, horizon: int, exog: pd.DataFrame | None = None,
                        alpha: float = 0.05) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Returns (predictions, lower_ci, upper_ci)."""
        ...

    def save(self, path: str) -> None:
        import joblib
        joblib.dump(self, path)

    @classmethod
    def load(cls, path: str) -> "ForecastModel":
        import joblib
        return joblib.load(path)
