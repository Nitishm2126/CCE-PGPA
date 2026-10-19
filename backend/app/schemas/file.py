import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class FileCategoryEnum(str, Enum):
    """
    Evidence file categories for student achievements.
    """
    CERTIFICATE = "certificate"
    PHOTO = "photo"
    SUPPORTING_DOCUMENT = "supporting_document"


class AchievementFileResponse(BaseModel):
    """
    Public response schema for achievement evidence file metadata.
    
    ARCHITECTURAL MANDATE:
    Internal Google Drive identifiers and paths are NOT exposed to the client.
    File content is securely accessed through the backend proxy.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    achievement_id: uuid.UUID
    provider: str
    original_filename: str
    mime_type: str
    size_bytes: int
    file_category: FileCategoryEnum
    uploaded_by: uuid.UUID
    created_at: datetime
    content_url: Optional[str] = Field(
        default=None,
        description="Authenticated backend stream URL for viewing/downloading the file.",
    )


class GoogleDriveStatus(BaseModel):
    """
    Health and operational status of the Google Drive integration.
    """
    configured: bool = Field(..., description="Whether credentials and root folder are configured.")
    connected: bool = Field(..., description="Whether API authentication and folder access succeeded.")
    oauth_authorized: Optional[bool] = Field(default=None, description="Whether OAuth credentials are saved in PostgreSQL.")
    authorized_email: Optional[str] = Field(default=None, description="Email address of the authorized Google account.")
    root_folder_id: Optional[str] = Field(None, description="Configured Google Drive root folder ID.")
    message: str = Field(..., description="Human-readable status summary.")
    detail: Optional[str] = Field(None, description="Error detail if connection failed.")
