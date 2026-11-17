from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models.feature_set import FeatureSetCreate, FeatureConfig
from app.models.common import APIResponse
from app.services import feature_service
import logging

router = APIRouter(prefix="/features", tags=["features"])
logger = logging.getLogger(__name__)


class PreviewRequest(FeatureConfig):
    dataset_id: str
    junction_id: str
    sample_size: int = 500


@router.post("", response_model=APIResponse, status_code=201)
async def create_feature_set(body: FeatureSetCreate, background_tasks: BackgroundTasks):
    fs = await feature_service.create_feature_set(body)
    background_tasks.add_task(feature_service.engineer_features, str(fs["_id"]))
    return APIResponse(data=fs, message="Feature set created — engineering in background")


@router.post("/preview", response_model=APIResponse)
async def preview_features(body: PreviewRequest):
    try:
        data = await feature_service.preview_features(
            dataset_id=body.dataset_id,
            junction_id=body.junction_id,
            config=FeatureConfig(**body.model_dump(exclude={"dataset_id", "junction_id", "sample_size"})),
            sample_size=body.sample_size,
        )
        if "error" in data:
            raise HTTPException(400, data["error"])
        return APIResponse(data=data)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error in preview_features: {exc}")
        raise HTTPException(500, f"Feature preview calculation error: {exc}")


@router.get("", response_model=APIResponse)
async def list_feature_sets(dataset_id: str):
    sets = await feature_service.list_feature_sets(dataset_id)
    return APIResponse(data=sets)


@router.get("/{feature_set_id}", response_model=APIResponse)
async def get_feature_set(feature_set_id: str):
    fs = await feature_service.get_feature_set(feature_set_id)
    if not fs:
        raise HTTPException(404, "Feature set not found")
    return APIResponse(data=fs)


@router.delete("/{feature_set_id}", response_model=APIResponse)
async def delete_feature_set(feature_set_id: str):
    deleted = await feature_service.delete_feature_set(feature_set_id)
    if not deleted:
        raise HTTPException(404, "Feature set not found")
    return APIResponse(message="Feature set deleted")
