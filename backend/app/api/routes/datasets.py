from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from app.models.dataset import ColumnMapping
from app.models.common import APIResponse, PaginatedResponse
from app.services import dataset_service
import logging

router = APIRouter(prefix="/datasets", tags=["datasets"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse)
async def list_datasets(page: int = 1, page_size: int = 20):
    return await dataset_service.list_datasets(page, page_size)


@router.post("/upload", response_model=APIResponse, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
):
    dataset = await dataset_service.upload_dataset(file, name)
    return APIResponse(data=dataset, message="File uploaded — awaiting column mapping")


@router.post("/{dataset_id}/validate", response_model=APIResponse)
async def validate_dataset(
    dataset_id: str,
    column_mapping: ColumnMapping,
    background_tasks: BackgroundTasks,
):
    background_tasks.add_task(dataset_service.validate_dataset, dataset_id, column_mapping)
    return APIResponse(message="Validation started")


@router.get("/{dataset_id}", response_model=APIResponse)
async def get_dataset(dataset_id: str):
    ds = await dataset_service.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return APIResponse(data=ds)


@router.get("/{dataset_id}/preview", response_model=APIResponse)
async def preview_dataset(dataset_id: str, rows: int = 20):
    data = await dataset_service.preview_dataset(dataset_id, rows)
    return APIResponse(data=data)


@router.delete("/{dataset_id}", response_model=APIResponse)
async def delete_dataset(dataset_id: str):
    deleted = await dataset_service.delete_dataset(dataset_id)
    if not deleted:
        raise HTTPException(404, "Dataset not found")
    return APIResponse(message="Dataset deleted")
