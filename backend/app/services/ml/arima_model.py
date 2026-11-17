import numpy as np
import pandas as pd
import warnings
from .base import ForecastModel


class SARIMAXModel(ForecastModel):
    name = "sarimax"

    def __init__(self, order=(1, 1, 1), seasonal_order=(1, 1, 1, 24)):
        self.order = order
        self.seasonal_order = seasonal_order
        self._result = None
        self._exog_cols: list[str] = []
        self.best_aic: float | None = None

    def fit(self, train: pd.DataFrame, target_col: str = "vehicle_count", **kwargs) -> None:
        from statsmodels.tsa.statespace.sarimax import SARIMAX

        if kwargs.get("order"):
            self.order = tuple(kwargs["order"])
        if kwargs.get("seasonal_order"):
            self.seasonal_order = tuple(kwargs["seasonal_order"])

        exog_cols = [
            c for c in train.columns
            if c not in (target_col, "timestamp", "junction_id", "_split")
            and pd.api.types.is_numeric_dtype(train[c])
        ]
        exog = train[exog_cols].values if exog_cols else None
        self._exog_cols = exog_cols
        y = train[target_col].values.astype(float)

        if kwargs.get("auto", False):
            self._result = self._auto_fit(y, exog, maxiter=int(kwargs.get("maxiter", 30)))
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = SARIMAX(
                    y, exog=exog,
                    order=self.order, seasonal_order=self.seasonal_order,
                    enforce_stationarity=False, enforce_invertibility=False,
                )
                self._result = model.fit(disp=False, maxiter=int(kwargs.get("maxiter", 50)))

    def _auto_fit(self, y: np.ndarray, exog, maxiter: int = 30):
        """AIC grid search over (p,d,q) × seasonal orders — picks best AIC."""
        from statsmodels.tsa.statespace.sarimax import SARIMAX

        orders = [(p, 1, q) for p in range(3) for q in range(3)]
        seasonal_orders = [
            (0, 0, 0, 0),
            (1, 0, 0, 24),
            (0, 0, 1, 24),
            (1, 1, 0, 24),
            (0, 1, 1, 24),
        ]
        best_aic = float("inf")
        best_result = None

        for order in orders:
            for seasonal in seasonal_orders:
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        mdl = SARIMAX(
                            y, exog=exog, order=order, seasonal_order=seasonal,
                            enforce_stationarity=False, enforce_invertibility=False,
                        )
                        result = mdl.fit(disp=False, maxiter=maxiter)
                    if result.aic < best_aic:
                        best_aic = result.aic
                        best_result = result
                        self.order = order
                        self.seasonal_order = seasonal
                except Exception:
                    continue

        self.best_aic = best_aic
        return best_result if best_result is not None else self._fallback_fit(y, exog, maxiter)

    def _fallback_fit(self, y: np.ndarray, exog, maxiter: int):
        from statsmodels.tsa.statespace.sarimax import SARIMAX
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            mdl = SARIMAX(y, exog=exog, order=(1, 1, 1), seasonal_order=(0, 0, 0, 0),
                          enforce_stationarity=False, enforce_invertibility=False)
            return mdl.fit(disp=False, maxiter=maxiter)

    def predict(self, horizon: int, exog: pd.DataFrame | None = None) -> np.ndarray:
        exog_vals = exog[self._exog_cols].values if exog is not None and self._exog_cols else None
        if exog_vals is not None and len(exog_vals) > horizon:
            exog_vals = exog_vals[:horizon]
        forecast = self._result.forecast(steps=horizon, exog=exog_vals)
        return np.array(forecast)

    def predict_with_ci(self, horizon: int, exog=None, alpha: float = 0.05):
        exog_vals = exog[self._exog_cols].values if exog is not None and self._exog_cols else None
        if exog_vals is not None and len(exog_vals) > horizon:
            exog_vals = exog_vals[:horizon]
        forecast_obj = self._result.get_forecast(steps=horizon, exog=exog_vals)
        preds = forecast_obj.predicted_mean.values
        ci = forecast_obj.conf_int(alpha=alpha)
        return preds, ci.iloc[:, 0].values, ci.iloc[:, 1].values
