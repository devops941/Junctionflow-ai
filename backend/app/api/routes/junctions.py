from fastapi import APIRouter, HTTPException
from app.models.junction import JunctionCreate, JunctionUpdate
from app.models.common import APIResponse, PaginatedResponse
from app.services import junction_service
import logging

router = APIRouter(prefix="/junctions", tags=["junctions"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse)
async def list_junctions(page: int = 1, page_size: int = 20):
    return await junction_service.list_junctions(page, page_size)


@router.post("", response_model=APIResponse, status_code=201)
async def create_junction(body: JunctionCreate):
    junction = await junction_service.create_junction(body)
    return APIResponse(data=junction)


@router.get("/{junction_id}", response_model=APIResponse)
async def get_junction(junction_id: str):
    junction = await junction_service.get_junction(junction_id)
    if not junction:
        raise HTTPException(404, "Junction not found")
    return APIResponse(data=junction)


@router.patch("/{junction_id}", response_model=APIResponse)
async def update_junction(junction_id: str, body: JunctionUpdate):
    junction = await junction_service.update_junction(junction_id, body)
    if not junction:
        raise HTTPException(404, "Junction not found")
    return APIResponse(data=junction)


@router.delete("/{junction_id}", response_model=APIResponse)
async def delete_junction(junction_id: str):
    deleted = await junction_service.delete_junction(junction_id)
    if not deleted:
        raise HTTPException(404, "Junction not found")
    return APIResponse(message="Junction deleted")
