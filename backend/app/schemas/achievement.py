import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.achievement import AchievementStatus
from app.models.review import ReviewAction
from app.schemas.file import AchievementFileResponse


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


class AchievementCreate(BaseModel):
    """
    Payload for creating a new draft achievement submission.
    """
    component_id: uuid.UUID = Field(..., description="Target PGPA component UUID")
    title: str = Field(..., min_length=2, max_length=255, description="Activity title")
    activity_type: Optional[str] = Field(None, max_length=100, description="e.g. Workshop, Hackathon, Course")
    organizer: Optional[str] = Field(None, max_length=255, description="Host institution or organization")
    event_date: Optional[date] = Field(None, description="Date of the event / certificate completion")
    description: Optional[str] = Field(None, description="Detailed activity summary")
    outcome: Optional[str] = Field(None, max_length=255, description="e.g. 1st Prize, Completed with Elite, Participant")


class AchievementUpdate(BaseModel):
    """
    Payload for modifying an existing draft or rejected achievement.
    """
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    activity_type: Optional[str] = Field(None, max_length=100)
    organizer: Optional[str] = Field(None, max_length=255)
    event_date: Optional[date] = None
    description: Optional[str] = None
    outcome: Optional[str] = Field(None, max_length=255)


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
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_register_number: Optional[str] = None
    component_id: uuid.UUID
    component_name: Optional[str] = None
    component_slug: Optional[str] = None
    title: str
    activity_type: Optional[str] = None
    organizer: Optional[str] = None
    event_date: Optional[date] = None
    description: Optional[str] = None
    outcome: Optional[str] = None
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

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, v: Optional[str], info) -> Optional[str]:
        action = info.data.get("action")
        if action in (ReviewAction.REJECTED, ReviewAction.REQUESTED_CHANGES):
            if not v or not v.strip():
                raise ValueError("Remarks are mandatory when rejecting or requesting changes.")
        return v.strip() if v else None
