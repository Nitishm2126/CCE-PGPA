import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ComponentDetailItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    semester_label: Optional[str] = None
    academic_period: Optional[str] = None
    display_order: int
    is_active: bool
    credit_value: int
    submission_mode: str
    grading_strategy: str
    requires_verification: bool
    rule_version: int
    total_submissions: int = 0
    pending_submissions: int = 0


class ComponentUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    credit_value: Optional[int] = Field(None, ge=0, le=10)
    submission_mode: Optional[str] = Field(None, pattern="^(student_submission|hod_excel_import|both|direct_staff_entry)$")
    grading_strategy: Optional[str] = None
    requires_verification: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class ComponentSemesterConfigItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    component_id: uuid.UUID
    component_name: Optional[str] = None
    semester_id: uuid.UUID
    semester_number: Optional[int] = None
    semester_display_name: Optional[str] = None
    is_enabled: bool
    submission_deadline: Optional[datetime] = None


class ComponentSemesterConfigUpdate(BaseModel):
    is_enabled: bool
    submission_deadline: Optional[datetime] = None


class DynamicFieldDefinition(BaseModel):
    name: str
    label: str
    type: str  # "text" | "number" | "select" | "date" | "checkbox"
    required: bool = False
    options: Optional[List[str]] = None
    min: Optional[float] = None
    max: Optional[float] = None
    placeholder: Optional[str] = None
    help_text: Optional[str] = None


class StudentComponentMetadata(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    credit_value: int
    submission_mode: str
    grading_strategy: str
    requires_verification: bool
    is_enabled_for_semester: bool = True
    input_fields: List[DynamicFieldDefinition] = []


class StudentComponentResultItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_register_number: Optional[str] = None
    component_id: uuid.UUID
    component_name: Optional[str] = None
    component_slug: Optional[str] = None
    semester_id: uuid.UUID
    semester_number: Optional[int] = None
    semester_name: Optional[str] = None
    raw_score: Optional[float] = None
    category: Optional[str] = None
    grade: str
    grade_points: int
    credit_value: int
    is_verified: bool
    source: str
    notes: Optional[str] = None
    calculated_at: datetime


class StudentPGPAResponse(BaseModel):
    student_id: uuid.UUID
    student_name: str
    register_number: str
    semester_id: uuid.UUID
    semester_number: int
    semester_name: str
    a1_score: float
    semester_gpa: Optional[float] = None
    pgpa: Optional[float] = None
    total_credits_attempted: int
    total_credits_earned: int
    calculated_at: datetime
    results: List[StudentComponentResultItem] = []
    formula_explanation: str


# HOD Excel Import schemas
class HODImportPreviewRow(BaseModel):
    row_number: int
    register_number: str
    student_name: Optional[str] = None
    student_id: Optional[uuid.UUID] = None
    result_value: str
    raw_score: Optional[float] = None
    category: Optional[str] = None
    calculated_grade: Optional[str] = None
    grade_points: Optional[int] = None
    is_valid: bool
    error_message: Optional[str] = None


class HODImportPreviewResponse(BaseModel):
    preview_token: str
    component_id: uuid.UUID
    component_name: str
    component_slug: str
    semester_id: uuid.UUID
    semester_name: str
    semester_number: int
    total_rows: int
    valid_rows: int
    error_rows: int
    rows: List[HODImportPreviewRow]
    summary_message: str


class HODImportConfirmRequest(BaseModel):
    preview_token: str


class HODImportBatchItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    uploaded_by: uuid.UUID
    uploaded_by_name: Optional[str] = None
    component_id: uuid.UUID
    component_name: Optional[str] = None
    semester_id: uuid.UUID
    semester_name: Optional[str] = None
    academic_cohort: str
    source_filename: str
    total_rows: int
    valid_rows: int
    error_rows: int
    status: str
    created_at: datetime


class HODCorrectionRequest(BaseModel):
    raw_score: Optional[float] = None
    category: Optional[str] = None
    grade: Optional[str] = None
    notes: Optional[str] = None
    reason: str
