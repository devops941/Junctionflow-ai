from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum
from .common import PyObjectId


class FeatureSetStatus(str, Enum):
    pending = "pending"
    computing = "computing"
    ready = "ready"
    failed = "failed"


class FeatureConfig(BaseModel):
    # Time features
    include_hour: bool = True
    include_dow: bool = True
    include_dom: bool = True
    include_month: bool = True
    include_week_of_year: bool = True
    include_is_weekend: bool = True
    cyclical_hour: bool = True
    cyclical_dow: bool = True

    # Calendar
    include_holiday: bool = True
    include_event: bool = True

    # Lag features (must all be >= 1 — enforced in FeatureEngineer)
    lags: list[int] = [1, 2, 3, 24, 168]

    # Rolling statistics
    rolling_windows: list[int] = [3, 24, 168]
    rolling_stats: list[str] = ["mean", "std"]  # "mean","std","min","max"

    # Weather
    include_weather_numeric: bool = True
    include_weather_onehot: bool = True
    scale_numeric: bool = True


class FeatureSetCreate(BaseModel):
    dataset_id: str
    junction_id: Optional[str] = None
    config: FeatureConfig = FeatureConfig()


class FeatureSet(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    dataset_id: str
    junction_id: Optional[str] = None
    config: FeatureConfig
    feature_columns: list[str] = []
    total_features: int = 0
    train_rows: int = 0
    test_rows: int = 0
    status: FeatureSetStatus = FeatureSetStatus.pending
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}
