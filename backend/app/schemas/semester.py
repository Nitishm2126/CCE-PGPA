from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class SemesterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    semester_number: int
    display_name: str
    is_enabled: bool
    created_at: datetime
    updated_at: datetime


class SemesterUpdate(BaseModel):
    is_enabled: bool
    display_name: Optional[str] = None


class StudentSemesterStatusItem(BaseModel):
    semester_number: int
    semester_name: str
    folder_id: Optional[str] = None
    status: str  # "EXISTS_MAPPED" | "EXISTS_IN_DRIVE" | "MISSING"


class StudentSemesterFolderAuditItem(BaseModel):
    student_id: uuid.UUID
    register_number: str
    student_name: str
    existing_student_folder_id: Optional[str] = None
    has_student_folder: bool
    semesters: List[StudentSemesterStatusItem]


class SemesterDriveAuditReport(BaseModel):
    root_folder_id: str
    total_students: int
    target_semesters: List[int]
    students: List[StudentSemesterFolderAuditItem]


class SemesterDriveProvisionDetailItem(BaseModel):
    student_id: uuid.UUID
    register_number: str
    semester_number: int
    folder_id: Optional[str] = None
    action: str  # "CREATED" | "REUSED_EXISTING" | "ALREADY_MAPPED" | "DRY_RUN_CREATED" | "FAILED"
    error: Optional[str] = None


class SemesterDriveProvisionResponse(BaseModel):
    dry_run: bool
    total_students: int
    target_semesters: List[int]
    created_folders: int
    reused_folders: int
    already_mapped: int
    failed: int
    details: List[SemesterDriveProvisionDetailItem]
    message: str
