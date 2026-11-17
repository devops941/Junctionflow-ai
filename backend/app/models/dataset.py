from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum
from .common import PyObjectId


class DatasetStatus(str, Enum):
    uploaded = "uploaded"
    validated = "validated"
    failed = "failed"
    processed = "processed"


class ColumnMapping(BaseModel):
    timestamp: str = "timestamp"
    junction_id: str = "junction_id"
    vehicle_count: str = "vehicle_count"
    temperature_c: Optional[str] = None
    rainfall_mm: Optional[str] = None
    humidity_pct: Optional[str] = None
    wind_speed_kmh: Optional[str] = None
    weather_condition: Optional[str] = None
    is_holiday: Optional[str] = None
    event_flag: Optional[str] = None


class DateRange(BaseModel):
    start: datetime
    end: datetime


class ValidationReport(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    missing_required: list[str] = []
    duplicate_rows: int = 0
    out_of_range: dict[str, int] = {}
    warnings: list[str] = []
    errors: list[str] = []


class DatasetCreate(BaseModel):
    name: str
    column_mapping: ColumnMapping


class Dataset(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    original_filename: str
    gridfs_file_id: Optional[str] = None
    row_count: int = 0
    column_mapping: Optional[ColumnMapping] = None
    date_range: Optional[DateRange] = None
    junction_ids: list[str] = []
    status: DatasetStatus = DatasetStatus.uploaded
    validation_report: Optional[ValidationReport] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by: Optional[str] = None

    model_config = {"populate_by_name": True}
