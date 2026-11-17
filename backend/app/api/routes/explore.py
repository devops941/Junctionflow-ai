from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from typing import Optional
from app.models.common import APIResponse
from app.services import explore_service
import io
import logging

router = APIRouter(prefix="/explore", tags=["explore"])
logger = logging.getLogger(__name__)


def _jids(junction_ids: Optional[str]) -> list[str] | None:
    if not junction_ids:
        return None
    return [j.strip() for j in junction_ids.split(",") if j.strip()]


def _wdays(weekdays: Optional[str]) -> list[int] | None:
    if not weekdays:
        return None
    return [int(d.strip()) for d in weekdays.split(",") if d.strip().isdigit()]


@router.get("/filtered-summary", response_model=APIResponse)
async def get_filtered_summary(
    dataset_id: str,
    junction_ids: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    weekdays: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    weather_condition: Optional[str] = None,
    is_holiday: Optional[str] = None,
):
    data = await explore_service.get_filtered_summary(
        dataset_id, _jids(junction_ids), start, end,
        _wdays(weekdays), hour_start, hour_end, is_holiday, weather_condition,
    )
    return APIResponse(data=data)


@router.get("/filtered-timeseries", response_model=APIResponse)
async def get_filtered_timeseries(
    dataset_id: str,
    junction_ids: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    weekdays: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    weather_condition: Optional[str] = None,
    is_holiday: Optional[str] = None,
    resample: str = "1h",
):
    data = await explore_service.get_filtered_timeseries(
        dataset_id, _jids(junction_ids), start, end,
        _wdays(weekdays), hour_start, hour_end, is_holiday, weather_condition, resample,
    )
    return APIResponse(data=data)


@router.get("/heatmap", response_model=APIResponse)
async def get_heatmap(
    dataset_id: str,
    junction_ids: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    weekdays: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    weather_condition: Optional[str] = None,
    is_holiday: Optional[str] = None,
):
    data = await explore_service.get_heatmap(
        dataset_id, _jids(junction_ids), start, end,
        _wdays(weekdays), hour_start, hour_end, is_holiday, weather_condition,
    )
    return APIResponse(data=data)


@router.get("/weekday-avg", response_model=APIResponse)
async def get_weekday_avg(
    dataset_id: str,
    junction_ids: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    weekdays: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    weather_condition: Optional[str] = None,
    is_holiday: Optional[str] = None,
):
    data = await explore_service.get_weekday_avg(
        dataset_id, _jids(junction_ids), start, end,
        _wdays(weekdays), hour_start, hour_end, is_holiday, weather_condition,
    )
    return APIResponse(data=data)


@router.get("/weather-impact", response_model=APIResponse)
async def get_weather_impact(
    dataset_id: str,
    junction_ids: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    weekdays: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    is_holiday: Optional[str] = None,
):
    data = await explore_service.get_weather_impact(
        dataset_id, _jids(junction_ids), start, end,
        _wdays(weekdays), hour_start, hour_end, is_holiday, None,
    )
    return APIResponse(data=data)


@router.get("/stl-decomposition", response_model=APIResponse)
async def get_stl_decomposition(
    dataset_id: str,
    junction_id: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    is_holiday: Optional[str] = None,
    weather_condition: Optional[str] = None,
    period: int = 24,
):
    data = await explore_service.get_stl_decomposition(
        dataset_id, junction_id, start, end, is_holiday, weather_condition, period,
    )
    return APIResponse(data=data)


@router.get("/junction-comparison", response_model=APIResponse)
async def get_junction_comparison(
    dataset_id: str,
    junction_ids: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    weekdays: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    weather_condition: Optional[str] = None,
    is_holiday: Optional[str] = None,
    resample: str = "1D",
):
    data = await explore_service.get_junction_comparison(
        dataset_id, _jids(junction_ids), start, end,
        _wdays(weekdays), hour_start, hour_end, is_holiday, weather_condition, resample,
    )
    return APIResponse(data=data)


@router.get("/raw-records", response_model=APIResponse)
async def get_raw_records(
    dataset_id: str,
    junction_ids: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    weekdays: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    weather_condition: Optional[str] = None,
    is_holiday: Optional[str] = None,
    page: int = 1,
    page_size: int = 15,
    sort_by: str = "timestamp",
    sort_dir: str = "asc",
):
    data = await explore_service.get_raw_records(
        dataset_id, _jids(junction_ids), start, end,
        _wdays(weekdays), hour_start, hour_end, is_holiday, weather_condition,
        page, page_size, sort_by, sort_dir,
    )
    return APIResponse(data=data)


@router.get("/export")
async def export_filtered(
    dataset_id: str,
    junction_ids: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    weekdays: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    weather_condition: Optional[str] = None,
    is_holiday: Optional[str] = None,
    format: str = "csv",
):
    content = await explore_service.export_filtered(
        dataset_id, _jids(junction_ids), start, end,
        _wdays(weekdays), hour_start, hour_end, is_holiday, weather_condition, format,
    )
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
    filename = f"traffic_export.{format}"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# Legacy endpoints kept for backward compat
@router.get("/timeseries", response_model=APIResponse)
async def get_timeseries(dataset_id: str, junction_id: str,
                          start: Optional[str] = None, end: Optional[str] = None,
                          resample: str = "1h"):
    data = await explore_service.get_timeseries(dataset_id, junction_id, start, end, resample)
    return APIResponse(data=data)


@router.get("/summary", response_model=APIResponse)
async def get_summary(dataset_id: str, junction_id: Optional[str] = None):
    data = await explore_service.get_summary(dataset_id, junction_id)
    return APIResponse(data=data)


@router.get("/distribution", response_model=APIResponse)
async def get_distribution(dataset_id: str, junction_id: str):
    data = await explore_service.get_distribution(dataset_id, junction_id)
    return APIResponse(data=data)


@router.get("/seasonality", response_model=APIResponse)
async def get_seasonality(dataset_id: str, junction_id: str):
    data = await explore_service.get_seasonality(dataset_id, junction_id)
    return APIResponse(data=data)
