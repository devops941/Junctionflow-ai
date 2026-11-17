from app.services.feature_engineering import FeatureEngineer
from app.models.feature_set import FeatureConfig
from app.services.ml.seasonal_naive import SeasonalNaive
from app.services.ml.random_forest import RandomForestModel


def _get_features(df):
    config = FeatureConfig(lags=[1, 2, 3, 24], rolling_windows=[3, 24])
    fe = FeatureEngineer(config)
    return fe.fit_transform(df.copy())


def test_seasonal_naive_fit_predict(sample_df):
    features = _get_features(sample_df)
    model = SeasonalNaive()
    model.fit(features, target_col="vehicle_count")
    preds = model.predict(24)
    assert len(preds) == 24
    assert all(p >= 0 for p in preds)


def test_seasonal_naive_predict_with_ci(sample_df):
    features = _get_features(sample_df)
    model = SeasonalNaive()
    model.fit(features, target_col="vehicle_count")
    preds, lower, upper = model.predict_with_ci(12)
    assert len(preds) == 12
    assert len(lower) == 12
    assert len(upper) == 12
    assert all(upper[i] >= lower[i] for i in range(12))


def test_random_forest_fit_predict(sample_df):
    features = _get_features(sample_df)
    model = RandomForestModel()
    model.fit(features, target_col="vehicle_count")
    preds = model.predict(6)
    assert len(preds) == 6
    assert all(p >= 0 for p in preds)


def test_random_forest_recursive_steps(sample_df):
    """RF recursive multi-step: each step uses previous predictions as lag input."""
    features = _get_features(sample_df)
    model = RandomForestModel()
    model.fit(features, target_col="vehicle_count")
    horizon = 10
    preds, lower, upper = model.predict_with_ci(horizon, exog=features)
    assert len(preds) == horizon
    assert len(lower) == horizon
    assert len(upper) == horizon


def test_random_forest_ci_width(sample_df):
    """CI upper >= lower for all steps."""
    features = _get_features(sample_df)
    model = RandomForestModel()
    model.fit(features, target_col="vehicle_count")
    preds, lower, upper = model.predict_with_ci(5, exog=features)
    for i in range(5):
        assert upper[i] >= lower[i], f"Step {i}: upper={upper[i]} < lower={lower[i]}"


def test_random_forest_feature_importances(sample_df):
    features = _get_features(sample_df)
    model = RandomForestModel()
    model.fit(features, target_col="vehicle_count")
    importances = model.feature_importances_
    assert isinstance(importances, dict)
    assert len(importances) > 0
    # Sum should be ~1
    total = sum(importances.values())
    assert 0.95 <= total <= 1.05
