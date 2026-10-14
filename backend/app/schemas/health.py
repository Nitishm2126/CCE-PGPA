from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class DatabaseStatus(BaseModel):
    connected: bool
    status: str
    database: Optional[str] = None
    host: Optional[str] = None
    message: str
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = Field(default="healthy", description="Application service status")
    app_name: str
    environment: str
    timestamp: datetime
    database: DatabaseStatus
    storage_rule: str = Field(
        default="All uploaded certificate and photo file binaries reside in Google Drive; PostgreSQL stores structured records and file metadata only."
    )
