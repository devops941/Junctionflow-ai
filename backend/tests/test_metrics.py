import numpy as np
import pytest
from app.services.ml.metrics import mae, rmse, r2, compute_all


def test_mae():
    actual = np.array([1.0, 2.0, 3.0])
    pred = np.array([1.5, 2.5, 3.5])
    assert mae(actual, pred) == pytest.approx(0.5)


def test_rmse():
    actual = np.array([1.0, 2.0, 3.0])
    pred = np.array([1.0, 2.0, 3.0])
    assert rmse(actual, pred) == pytest.approx(0.0)


def test_r2_perfect():
    actual = np.array([1.0, 2.0, 3.0, 4.0])
    assert r2(actual, actual) == pytest.approx(1.0)


def test_compute_all():
    actual = np.array([100.0, 200.0, 150.0, 180.0])
    pred = np.array([110.0, 190.0, 160.0, 175.0])
    result = compute_all(actual, pred)
    assert all(k in result for k in ("mae", "rmse", "mape", "smape", "r2"))
