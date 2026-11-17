from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any
from enum import Enum
from .common import PyObjectId


class ReportFormat(str, Enum):
    pdf = "pdf"
    csv = "csv"
    xlsx = "xlsx"


class ReportType(str, Enum):
    forecast_summary = "forecast_summary"
    model_comparison = "model_comparison"
    congestion_analysis = "congestion_analysis"
    dataset_validation = "dataset_validation"


class ReportCreate(BaseModel):
    type: ReportType
    format: ReportFormat
    params: dict[str, Any] = {}


class Report(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    type: ReportType
    params: dict[str, Any] = {}
    gridfs_file_id: Optional[str] = None
    format: ReportFormat
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}
