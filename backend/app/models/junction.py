from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from .common import PyObjectId


class Location(BaseModel):
    lat: float
    lng: float


class JunctionCreate(BaseModel):
    junction_id: str
    name: str
    location: Optional[Location] = None
    capacity_per_hour: Optional[int] = None


class JunctionUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[Location] = None
    capacity_per_hour: Optional[int] = None


class Junction(JunctionCreate):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}
