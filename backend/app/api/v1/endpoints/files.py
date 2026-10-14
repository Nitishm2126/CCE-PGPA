import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user
from app.db.session import get_db
from app.models.file import FileCategory
from app.models.user import User
from app.schemas.file import AchievementFileResponse
from app.services.file_manager import (
    delete_achievement_file,
    download_achievement_file,
    get_achievement_files,
    upload_achievement_file,
)

router = APIRouter()


def _format_file_response(record) -> AchievementFileResponse:
    """Helper to attach backend stream content URL to the file response."""
    return AchievementFileResponse(
        id=record.id,
        achievement_id=record.achievement_id,
        provider=record.provider,
        original_filename=record.original_filename,
        mime_type=record.mime_type,
        size_bytes=record.size_bytes,
        file_category=record.file_category.value,
        uploaded_by=record.uploaded_by,
        created_at=record.created_at,
        content_url=f"/api/v1/files/{record.id}/content",
    )


@router.post(
    "/achievements/{achievement_id}/files",
    response_model=AchievementFileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an evidence file for an achievement",
    description=(
        "Uploads a certificate, photo, or supporting document binary to Google Drive. "
        "Stores structured metadata and Drive file ID in PostgreSQL. "
        "File binaries are NEVER stored in PostgreSQL or permanently on the application server."
    ),
)
async def upload_file(
    achievement_id: uuid.UUID,
    file: UploadFile = File(..., description="Evidence file (PDF, PNG, JPG, max 10MB)"),
    file_category: FileCategory = Form(..., description="Category: certificate, photo, or supporting_document"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AchievementFileResponse:
    content = await file.read()
    file_record = upload_achievement_file(
        session=db,
        current_user=current_user,
        achievement_id=achievement_id,
        file_category=file_category,
        filename=file.filename or "uploaded_file",
        content=content,
        content_type=file.content_type,
    )
    return _format_file_response(file_record)


@router.get(
    "/achievements/{achievement_id}/files",
    response_model=List[AchievementFileResponse],
    summary="List evidence files for an achievement",
    description=(
        "Returns metadata for all evidence files attached to the achievement. "
        "Requires student ownership, assigned mentor authorization, or HOD role."
    ),
)
def list_files(
    achievement_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[AchievementFileResponse]:
    files = get_achievement_files(
        session=db,
        current_user=current_user,
        achievement_id=achievement_id,
    )
    return [_format_file_response(f) for f in files]


@router.get(
    "/files/{file_id}/content",
    summary="Stream file content through secure backend proxy",
    description=(
        "Proxies the evidence file binary directly from Google Drive. "
        "Never exposes service-account credentials or private Google Drive links to the frontend. "
        "Requires student ownership, assigned mentor authorization, or HOD role."
    ),
)
def get_file_content(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    content_bytes, file_record = download_achievement_file(
        session=db,
        current_user=current_user,
        file_id=file_id,
    )

    headers = {
        "Content-Disposition": f'inline; filename="{file_record.original_filename}"',
        "Content-Length": str(len(content_bytes)),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
    }
    return Response(
        content=content_bytes,
        media_type=file_record.mime_type,
        headers=headers,
    )


@router.delete(
    "/files/{file_id}",
    summary="Delete an evidence file",
    description=(
        "Removes evidence file record from PostgreSQL and deletes the binary from Google Drive. "
        "Requires student ownership on a draft achievement or HOD authorization."
    ),
)
def delete_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_achievement_file(
        session=db,
        current_user=current_user,
        file_id=file_id,
    )
    return {
        "detail": "Evidence file deleted successfully.",
        "file_id": str(file_id),
    }
