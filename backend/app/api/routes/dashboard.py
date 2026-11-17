from fastapi import APIRouter, Query
from app.models.common import APIResponse
from app.services import dashboard_service
from app.services import accuracy_service
import logging

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)


@router.get("/summary", response_model=APIResponse)
async def get_summary():
    data = await dashboard_service.get_summary()
    return APIResponse(data=data)


@router.get("/live-congestion", response_model=APIResponse)
async def get_live_congestion():
    data = await dashboard_service.get_live_congestion()
    return APIResponse(data=data)


@router.get("/recent-forecasts", response_model=APIResponse)
async def get_recent_forecasts(limit: int = Query(5, ge=1, le=50)):
    data = await dashboard_service.get_recent_forecasts(limit)
    return APIResponse(data=data)


@router.get("/congestion-alerts", response_model=APIResponse)
async def get_congestion_alerts(hours_ahead: int = Query(24, ge=1, le=168)):
    data = await dashboard_service.get_congestion_alerts(hours_ahead)
    return APIResponse(data=data)


@router.get("/accuracy", response_model=APIResponse)
async def get_accuracy(junction_id: str, dataset_id: str):
    data = await accuracy_service.compare_models(junction_id, dataset_id)
    return APIResponse(data=data)
