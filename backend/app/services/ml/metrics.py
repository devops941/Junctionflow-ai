import numpy as np


def mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)))


def rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    mask = actual != 0
    if not mask.any():
        return float("nan")
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)


def smape(actual: np.ndarray, predicted: np.ndarray) -> float:
    denom = (np.abs(actual) + np.abs(predicted)) / 2
    mask = denom != 0
    if not mask.any():
        return float("nan")
    return float(np.mean(np.abs(actual[mask] - predicted[mask]) / denom[mask]) * 100)


def r2(actual: np.ndarray, predicted: np.ndarray) -> float:
    ss_res = np.sum((actual - predicted) ** 2)
    ss_tot = np.sum((actual - np.mean(actual)) ** 2)
    return float(1 - ss_res / ss_tot) if ss_tot != 0 else float("nan")


def compute_all(actual: np.ndarray, predicted: np.ndarray) -> dict:
    return {
        "mae": round(mae(actual, predicted), 4),
        "rmse": round(rmse(actual, predicted), 4),
        "mape": round(mape(actual, predicted), 4),
        "smape": round(smape(actual, predicted), 4),
        "r2": round(r2(actual, predicted), 4),
    }
