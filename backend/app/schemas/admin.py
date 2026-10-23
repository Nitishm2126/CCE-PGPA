import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole
from app.schemas.auth import MentorInfo


class AdminRecentSubmissionItem(BaseModel):
    """Recent student achievement submission summary for dashboard overview."""
    id: str
    title: str
    status: str
    activity_type: Optional[str] = None
    student_name: str
    register_number: str
    component_name: str
    submitted_at: Optional[str] = None


class AdminOverviewResponse(BaseModel):
    """
    System-wide governance and user metrics for system administrators.
    """
    total_users: int
    users_by_role: Dict[str, int]
    active_users: int
    inactive_users: int
    firebase_linked_users: int
    unlinked_users: int
    total_student_profiles: int
    total_mentor_profiles: int
    total_hod_profiles: int = 0
    total_mentor_assignments: int
    system_status: str = "operational"

    # College ERP Data-driven metrics
    total_students: int = 0
    total_mentors: int = 0
    total_hods: int = 0
    active_accounts: int = 0
    pending_submissions: int = 0
    recorded_activities: int = 0
    approved_submissions: int = 0
    rejected_submissions: int = 0
    recent_submissions: List[AdminRecentSubmissionItem] = []


class AdminSubmissionItem(BaseModel):
    """Complete submission record for Admin Submissions tab."""
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    student_email: str
    register_number: str
    component_id: uuid.UUID
    component_name: str
    title: str
    activity_type: Optional[str] = None
    organizer: Optional[str] = None
    event_date: Optional[str] = None
    description: Optional[str] = None
    outcome: Optional[str] = None
    status: str
    files_count: int = 0
    semester_id: Optional[int] = None
    semester_number: Optional[int] = None
    semester_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime


class AdminMentorAllocationItem(BaseModel):
    """Complete mentor allocation record for Admin Mentor Allocation tab."""
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    student_email: str
    register_number: str
    section: Optional[str] = None
    batch: Optional[str] = None
    mentor_id: uuid.UUID
    mentor_name: str
    mentor_email: str
    assigned_at: Optional[datetime] = None
    is_active: bool


class AdminComponentItem(BaseModel):
    """Component summary for Admin Components tab."""
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    display_order: int
    is_active: bool
    total_submissions: int = 0
    pending_submissions: int = 0


class AdminUserItem(BaseModel):
    """
    Summary item for administrative user registry and provisioning management.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    firebase_uid: Optional[str] = None
    created_at: datetime


class AdminStatusUpdateRequest(BaseModel):
    """Request payload to activate or deactivate any user account."""
    is_active: bool


# ==============================================================================
# Student Management Schemas
# ==============================================================================

class AdminStudentItem(BaseModel):
    """Complete student item for Admin User Management table."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: UserRole = UserRole.STUDENT
    is_active: bool
    firebase_uid: Optional[str] = None
    created_at: datetime

    register_number: Optional[str] = None
    department: str = "CCE"
    year: int = 2
    section: Optional[str] = None
    semester: Optional[str] = None
    batch: Optional[str] = None
    phone_number: Optional[str] = None
    original_mentor_name: Optional[str] = None
    google_drive_folder_id: Optional[str] = None

    assigned_mentor: Optional[MentorInfo] = None
    submission_count: int = 0
    approved_count: int = 0
    pending_count: int = 0


class AdminStudentDetailResponse(AdminStudentItem):
    """Detailed student information including mentorship history and achievements summary."""
    assignment_history: List[Dict[str, Any]] = Field(default_factory=list)
    recent_submissions: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_files_count: int = 0


class AdminStudentCreate(BaseModel):
    """Request payload to add a new student."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    register_number: str = Field(..., min_length=2, max_length=50)
    department: str = Field(default="CCE", max_length=50)
    year: int = Field(default=2, ge=1, le=5)
    section: Optional[str] = Field(default=None, max_length=10)
    semester: Optional[str] = Field(default=None, max_length=20)
    batch: Optional[str] = Field(default=None, max_length=20)
    phone_number: Optional[str] = Field(default=None, max_length=20)
    assigned_mentor_id: Optional[uuid.UUID] = None
    password: Optional[str] = Field(default=None, min_length=6)


class AdminStudentUpdate(BaseModel):
    """Request payload to edit student details."""
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    register_number: Optional[str] = Field(default=None, min_length=2, max_length=50)
    department: Optional[str] = Field(default=None, max_length=50)
    year: Optional[int] = Field(default=None, ge=1, le=5)
    section: Optional[str] = Field(default=None, max_length=10)
    semester: Optional[str] = Field(default=None, max_length=20)
    batch: Optional[str] = Field(default=None, max_length=20)
    phone_number: Optional[str] = Field(default=None, max_length=20)
    assigned_mentor_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class AdminStudentDeleteRequest(BaseModel):
    """Request payload for student deletion options."""
    delete_mode: Literal["deactivate", "delete_login", "permanent"]
    confirmation_register_number: Optional[str] = None


# ==============================================================================
# Faculty Mentor Management Schemas
# ==============================================================================

class AdminMentorAssignedStudent(BaseModel):
    """Student summary assigned to a faculty mentor."""
    student_id: uuid.UUID
    full_name: str
    register_number: Optional[str] = None
    email: str
    year: int = 2
    section: Optional[str] = None
    assigned_at: datetime


class AdminMentorItem(BaseModel):
    """Faculty mentor item for Admin User Management table."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: UserRole = UserRole.MENTOR
    is_active: bool
    firebase_uid: Optional[str] = None
    created_at: datetime

    staff_id: Optional[str] = None
    department: str = "CCE"
    designation: Optional[str] = "Assistant Professor"

    assigned_student_count: int = 0
    assigned_students: List[AdminMentorAssignedStudent] = Field(default_factory=list)
    reviews_count: int = 0


class AdminMentorDetailResponse(AdminMentorItem):
    """Complete mentor details including assignment history."""
    all_assigned_students: List[AdminMentorAssignedStudent] = Field(default_factory=list)


class AdminMentorCreate(BaseModel):
    """Request payload to add a new faculty mentor."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    staff_id: Optional[str] = Field(default=None, max_length=50)
    department: str = Field(default="CCE", max_length=50)
    designation: Optional[str] = Field(default="Assistant Professor", max_length=100)
    password: Optional[str] = Field(default=None, min_length=6)


class AdminMentorUpdate(BaseModel):
    """Request payload to edit faculty mentor details."""
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    staff_id: Optional[str] = Field(default=None, max_length=50)
    department: Optional[str] = Field(default=None, max_length=50)
    designation: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None


class AdminMentorDeleteRequest(BaseModel):
    """Request payload to delete a mentor account, requiring student reassignment."""
    reassign_mentor_id: Optional[uuid.UUID] = None


class AdminMentorReassignRequest(BaseModel):
    """Request payload to reassign students from one mentor to another."""
    target_mentor_id: uuid.UUID
    student_ids: Optional[List[uuid.UUID]] = None


# ==============================================================================
# HOD Management Schemas
# ==============================================================================

class AdminHODItem(BaseModel):
    """HOD item for Admin User Management table."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: UserRole = UserRole.HOD
    is_active: bool
    firebase_uid: Optional[str] = None
    created_at: datetime

    staff_id: Optional[str] = None
    department: str = "CCE"
    designation: Optional[str] = "Head of Department"
    reviews_count: int = 0


class AdminHODCreate(BaseModel):
    """Request payload to add a new HOD."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    staff_id: Optional[str] = Field(default=None, max_length=50)
    department: str = Field(default="CCE", max_length=50)
    designation: Optional[str] = Field(default="Head of Department", max_length=100)
    password: Optional[str] = Field(default=None, min_length=6)


class AdminHODUpdate(BaseModel):
    """Request payload to edit HOD details."""
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    staff_id: Optional[str] = Field(default=None, max_length=50)
    department: Optional[str] = Field(default=None, max_length=50)
    designation: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None


class AdminHODDeleteRequest(BaseModel):
    """Request payload to delete an HOD account, requiring replacement if active."""
    replacement_hod_id: Optional[uuid.UUID] = None


# ==============================================================================
# Operation Result Schemas
# ==============================================================================

class AdminOperationResult(BaseModel):
    """Generic operation result with optional diagnostics."""
    success: bool
    message: str
    affected_id: Optional[uuid.UUID] = None
    delete_mode: Optional[str] = None
    deleted_achievements_count: Optional[int] = None
    deleted_files_count: Optional[int] = None
    failed_drive_file_ids: Optional[List[str]] = None
    retry_drive_cleanup_needed: Optional[bool] = None
    details: Optional[Dict[str, Any]] = None


# ==============================================================================
# Bulk Login Provisioning Schemas
# ==============================================================================

class ProvisioningPreviewItem(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    status: Literal["already_linked", "needs_creation", "exists_unlinked", "conflict", "invalid_email"]
    firebase_uid: Optional[str] = None
    existing_firebase_uid: Optional[str] = None
    notes: str


class ProvisioningPreviewResponse(BaseModel):
    total_users: int
    by_role: Dict[str, int]
    already_linked_count: int
    needs_creation_count: int
    exists_unlinked_count: int
    conflicts_count: int
    invalid_email_count: int
    initial_password: str = "cce@123"
    admin_account_email: str
    admin_account_preserved: bool = True
    items: List[ProvisioningPreviewItem]


class ProvisioningExecuteRequest(BaseModel):
    confirm: bool = Field(..., description="Explicit Admin confirmation required to execute")
    initial_password: str = Field(default="cce@123", description="Initial password for missing accounts")
    reset_existing_passwords: bool = Field(default=False, description="Reset passwords for existing Firebase accounts (default False)")


class ProvisioningResultItem(BaseModel):
    user_id: uuid.UUID
    email: str
    role: str
    action: Literal["created", "reused_linked", "skipped_already_linked", "failed"]
    firebase_uid: Optional[str] = None
    message: str


class ProvisioningExecuteResponse(BaseModel):
    success: bool
    message: str
    total_processed: int
    created_count: int
    reused_count: int
    skipped_count: int
    failed_count: int
    details: List[ProvisioningResultItem]


# ==============================================================================
# Student Google Drive Folder Provisioning Schemas
# ==============================================================================

class DriveFolderAuditItem(BaseModel):
    student_id: uuid.UUID
    register_number: str
    student_name: str
    student_email: str
    computed_folder_name: str
    db_folder_id: Optional[str] = None
    drive_folder_id: Optional[str] = None
    status: Literal[
        "ALREADY_PROVISIONED",
        "EXISTS_IN_DRIVE_NEEDS_LINK",
        "NEEDS_CREATION",
        "ERROR"
    ]
    evidence_count: int = 0
    legacy_evidence_folder_ids: List[str] = Field(default_factory=list)


class DriveFolderAuditReport(BaseModel):
    total_students: int
    provisioned_in_db: int
    found_in_drive: int
    requires_provisioning: int
    legacy_folders_detected: int
    total_evidence_files: int
    students: List[DriveFolderAuditItem]
    root_folder_id: Optional[str] = None
    drive_connected: bool = False
    authorized_email: Optional[str] = None


class DriveFolderProvisionResultItem(BaseModel):
    student_id: uuid.UUID
    register_number: str
    student_name: str
    folder_name: str
    folder_id: Optional[str] = None
    action_taken: Literal[
        "CREATED",
        "REUSED_EXISTING",
        "ALREADY_SET",
        "DRY_RUN_CREATED",
        "DRY_RUN_REUSED",
        "FAILED"
    ]
    success: bool
    error: Optional[str] = None


class DriveFolderProvisionResponse(BaseModel):
    dry_run: bool
    total_students: int
    created: int
    reused: int
    already_provisioned: int
    failed: int
    results: List[DriveFolderProvisionResultItem]
    message: str


# ==============================================================================
# Email Editing Schemas
# ==============================================================================

class AdminEmailUpdateRequest(BaseModel):
    """
    Security-critical email update request payload.
    Requires administrator reauthentication password and matching confirmation.
    """
    new_email: EmailStr = Field(..., description="Target user's new college email address")
    confirm_new_email: EmailStr = Field(..., description="Confirmation of new email address")
    admin_password: str = Field(..., min_length=1, description="Acting administrator's password for reauthentication")


class AdminEmailUpdateResponse(BaseModel):
    """
    Result of an administrative email update.
    """
    user_id: uuid.UUID
    full_name: str
    previous_email: str
    new_email: str
    role: str
    status: Literal["completed", "pending_verification"]
    firebase_synced: bool
    message: str
