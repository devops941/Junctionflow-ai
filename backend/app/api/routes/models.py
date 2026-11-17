from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models.ml_model import ModelCreate
from app.models.common import APIResponse, PaginatedResponse
from app.services import model_service
import logging

router = APIRouter(prefix="/models", tags=["models"])
logger = logging.getLogger(__name__)


@router.post("", response_model=APIResponse, status_code=201)
async def train_model(body: ModelCreate, background_tasks: BackgroundTasks):
    model = await model_service.create_model(body)
    background_tasks.add_task(model_service.train_model, str(model["_id"]))
    return APIResponse(data=model, message="Training started")


@router.get("", response_model=PaginatedResponse)
async def list_models(
    junction_id: str | None = None,
    algorithm: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    return await model_service.list_models(junction_id, algorithm, page, page_size)


# Fixed-path routes MUST come before /{model_id} to avoid shadowing
@router.get("/compare", response_model=APIResponse)
async def compare_models(junction_id: str):
    data = await model_service.compare_models(junction_id)
    return APIResponse(data=data)


@router.get("/{model_id}", response_model=APIResponse)
async def get_model(model_id: str):
    model = await model_service.get_model(model_id)
    if not model:
        raise HTTPException(404, "Model not found")
    return APIResponse(data=model)


@router.post("/{model_id}/activate", response_model=APIResponse)
async def activate_model(model_id: str):
    model = await model_service.activate_model(model_id)
    if not model:
        raise HTTPException(404, "Model not found")
    return APIResponse(data=model, message="Model activated")


@router.get("/{model_id}/importance", response_model=APIResponse)
async def get_feature_importance(model_id: str):
    importance = await model_service.get_feature_importance(model_id)
    if importance is None:
        raise HTTPException(404, "Model not found or importance not available")
    return APIResponse(data=importance)


@router.delete("/{model_id}", response_model=APIResponse)
async def delete_model(model_id: str):
    deleted = await model_service.delete_model(model_id)
    if not deleted:
        raise HTTPException(404, "Model not found")
    return APIResponse(message="Model deleted")
