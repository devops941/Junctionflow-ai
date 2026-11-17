from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum
from .common import PyObjectId


class CongestionLevel(str, Enum):
    low = "low"
    moderate = "moderate"
    high = "high"
    critical = "critical"


class ForecastPoint(BaseModel):
    timestamp: datetime
    predicted: float
    lower_ci: Optional[float] = None
    upper_ci: Optional[float] = None
    actual: Optional[float] = None
    congestion_level: CongestionLevel = CongestionLevel.low


class FutureWeather(BaseModel):
    temperature_c: Optional[float] = None
    rainfall_mm: Optional[float] = None
    humidity_pct: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    weather_condition: Optional[str] = None


class ForecastCreate(BaseModel):
    model_id: str
    junction_id: str
    horizon_hours: int = 24
    future_weather: Optional[FutureWeather] = None


class Forecast(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    model_id: str
    junction_id: str
    horizon_hours: int
    future_weather: Optional[FutureWeather] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    predictions: list[ForecastPoint] = []

    model_config = {"populate_by_name": True}
