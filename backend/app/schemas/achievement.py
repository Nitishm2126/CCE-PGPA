import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.achievement import AchievementStatus
from app.models.review import ReviewAction
from app.schemas.file import AchievementFileResponse
from app.schemas.semester import SemesterResponse


class PGPAComponentResponse(BaseModel):
    """
    Schema for official PGPA catalogue components.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    semester_label: Optional[str] = None
    academic_period: Optional[str] = None
    display_order: int
    is_active: bool
    credit_value: int = 3
    submission_mode: str = "both"
    grading_strategy: str = "categorical"
    requires_verification: bool = True
    input_fields: List[Dict[str, Any]] = []
    is_enabled_for_semester: bool = True
    lock_reason: Optional[str] = None


class AchievementCreate(BaseModel):
    """
    Payload for creating a new draft achievement submission.
    """
    component_id: uuid.UUID = Field(..., description="Target PGPA component UUID")
    semester_id: Optional[uuid.UUID] = Field(None, description="Academic semester UUID")
    title: Optional[str] = Field(None, max_length=255, description="Activity title (auto-generated if omitted for GPA)")
    activity_type: Optional[str] = Field(None, max_length=100, description="e.g. Workshop, Hackathon, Course")
    organizer: Optional[str] = Field(None, max_length=255, description="Host institution or organization")
    event_date: Optional[date] = Field(None, description="Date of the event / certificate completion")
    description: Optional[str] = Field(None, description="Detailed activity summary")
    outcome: Optional[str] = Field(None, max_length=255, description="e.g. 1st Prize, Completed with Elite, Participant")
    component_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Component-specific evaluation parameters")


class AchievementUpdate(BaseModel):
    """
    Payload for modifying an existing draft or rejected achievement.
    """
    title: Optional[str] = Field(None, max_length=255)
    semester_id: Optional[uuid.UUID] = Field(None, description="Academic semester UUID")
    activity_type: Optional[str] = Field(None, max_length=100)
    organizer: Optional[str] = Field(None, max_length=255)
    event_date: Optional[date] = None
    description: Optional[str] = None
    outcome: Optional[str] = Field(None, max_length=255)
    component_metadata: Optional[Dict[str, Any]] = None


class VerificationLogResponse(BaseModel):
    """
    Audit log of mentor/HOD review decisions.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    achievement_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewer_name: Optional[str] = None
    action: ReviewAction
    remarks: Optional[str] = None
    created_at: datetime


class AchievementResponse(BaseModel):
    """
    Detailed response for student achievements.
    Result visibility constraint: unapproved submissions must NOT expose tentative or unverified grades/scores to students.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_register_number: Optional[str] = None
    component_id: uuid.UUID
    component_name: Optional[str] = None
    component_slug: Optional[str] = None
    semester_id: Optional[Union[uuid.UUID, int, str]] = None
    semester_number: Optional[int] = None
    semester_display_name: Optional[str] = None
    semester: Optional[SemesterResponse] = None
    title: str
    activity_type: Optional[str] = None
    organizer: Optional[str] = None
    event_date: Optional[date] = None
    description: Optional[str] = None
    outcome: Optional[str] = None
    component_metadata: Optional[Dict[str, Any]] = None
    evaluated_grade: Optional[str] = None
    evaluated_grade_points: Optional[int] = None
    evaluated_points: Optional[float] = None
    mentor_remarks: Optional[str] = None
    status: AchievementStatus
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    files: List[AchievementFileResponse] = []
    verification_logs: List[VerificationLogResponse] = []


class ReviewSubmissionRequest(BaseModel):
    """
    Mentor/HOD review action payload.
    """
    action: ReviewAction = Field(..., description="Review outcome: approved, rejected, requested_changes")
    remarks: Optional[str] = Field(None, description="Feedback or reason for decision (mandatory on rejection)")
    awarded_points: Optional[float] = Field(None, ge=0, description="Optional confirmed points allocation by mentor")
    awarded_grade: Optional[str] = Field(None, description="Optional confirmed grade award by mentor (e.g. O, A+, A)")

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, v: Optional[str], info) -> Optional[str]:
        action = info.data.get("action")
        if action in (ReviewAction.REJECTED, ReviewAction.REQUESTED_CHANGES):
            if not v or not v.strip():
                raise ValueError("Remarks are mandatory when rejecting or requesting changes.")
        return v.strip() if v else None
