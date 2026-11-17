import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.forecast import ForecastCreate
from app.models.common import APIResponse
from app.services import forecast_service

router = APIRouter(prefix="/forecasts", tags=["forecasts"])
logger = logging.getLogger(__name__)


class CompareRequest(BaseModel):
    model_ids: list[str]
    junction_id: str
    horizon_hours: int = 24


@router.post("", response_model=APIResponse, status_code=201)
async def generate_forecast(body: ForecastCreate):
    forecast = await forecast_service.generate(body)
    try:
        from app.core.socket_manager import broadcast_refresh
        await broadcast_refresh()
    except Exception as exc:
        logger.warning(f"Failed to broadcast refresh after forecast generate: {exc}")
    return APIResponse(data=forecast, message="Forecast generated")


@router.post("/compare", response_model=APIResponse)
async def compare_forecasts(body: CompareRequest):
    """Generate fresh forecasts from multiple models and return them together."""
    results = []
    for model_id in body.model_ids[:5]:
        try:
            fc = await forecast_service.generate(ForecastCreate(
                model_id=model_id,
                junction_id=body.junction_id,
                horizon_hours=body.horizon_hours,
            ))
            results.append(fc)
        except Exception as exc:
            logger.warning(f"Compare: model {model_id} failed: {exc}")
    return APIResponse(data=results)


@router.get("", response_model=APIResponse)
async def list_forecasts(junction_id: str | None = None, model_id: str | None = None):
    forecasts = await forecast_service.list_forecasts(junction_id, model_id)
    return APIResponse(data=forecasts)


@router.get("/{forecast_id}", response_model=APIResponse)
async def get_forecast(forecast_id: str):
    forecast = await forecast_service.get_forecast(forecast_id)
    if not forecast:
        raise HTTPException(404, "Forecast not found")
    return APIResponse(data=forecast)


@router.get("/{forecast_id}/congestion", response_model=APIResponse)
async def get_congestion(forecast_id: str):
    data = await forecast_service.get_congestion_flags(forecast_id)
    return APIResponse(data=data)
