from .base import ForecastModel
from .seasonal_naive import SeasonalNaive
from .arima_model import SARIMAXModel
from .random_forest import RandomForestModel

_REGISTRY: dict[str, type[ForecastModel]] = {
    "seasonal_naive": SeasonalNaive,
    "sarimax": SARIMAXModel,
    "random_forest": RandomForestModel,
}


def get_model_class(algorithm: str) -> type[ForecastModel]:
    cls = _REGISTRY.get(algorithm)
    if cls is None:
        raise ValueError(f"Unknown algorithm: {algorithm}. Choose from {list(_REGISTRY)}")
    return cls


def build_model(algorithm: str, hyperparameters: dict) -> ForecastModel:
    import inspect
    cls = get_model_class(algorithm)
    valid = set(inspect.signature(cls.__init__).parameters) - {"self"}
    return cls(**{k: v for k, v in hyperparameters.items() if k in valid})
