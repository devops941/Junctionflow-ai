from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.report import ReportCreate
from app.models.common import APIResponse
from app.services import report_service
import logging
import io

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)


@router.post("", response_model=APIResponse, status_code=201)
async def create_report(body: ReportCreate):
    report = await report_service.create_report(body)
    return APIResponse(data=report)


@router.get("", response_model=APIResponse)
async def list_reports():
    reports = await report_service.list_reports()
    return APIResponse(data=reports)


@router.get("/{report_id}/download")
async def download_report(report_id: str):
    result = await report_service.get_report_file(report_id)
    if not result:
        raise HTTPException(404, "Report not found")
    content, media_type, filename = result
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{report_id}", response_model=APIResponse)
async def delete_report(report_id: str):
    deleted = await report_service.delete_report(report_id)
    if not deleted:
        raise HTTPException(404, "Report not found")
    return APIResponse(message="Report deleted")
