from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any
from enum import Enum
from .common import PyObjectId


class Algorithm(str, Enum):
    seasonal_naive = "seasonal_naive"
    sarimax = "sarimax"
    random_forest = "random_forest"


class ModelStatus(str, Enum):
    training = "training"
    ready = "ready"
    failed = "failed"


class ModelMetrics(BaseModel):
    mae: Optional[float] = None
    rmse: Optional[float] = None
    mape: Optional[float] = None
    smape: Optional[float] = None
    r2: Optional[float] = None


class ModelCreate(BaseModel):
    name: str
    algorithm: Algorithm
    junction_id: str
    dataset_id: str
    feature_set_id: Optional[str] = None
    hyperparameters: dict[str, Any] = {}
    train_range: Optional[dict] = None
    test_range: Optional[dict] = None


class MLModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    algorithm: Algorithm
    version: int = 1
    junction_id: str
    dataset_id: str
    feature_set_id: Optional[str] = None
    hyperparameters: dict[str, Any] = {}
    train_range: Optional[dict] = None
    test_range: Optional[dict] = None
    metrics: Optional[ModelMetrics] = None
    gridfs_model_id: Optional[str] = None
    status: ModelStatus = ModelStatus.training
    is_active: bool = False
    training_duration_sec: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    error_message: Optional[str] = None

    model_config = {"populate_by_name": True}
