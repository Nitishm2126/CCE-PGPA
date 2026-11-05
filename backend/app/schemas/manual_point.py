import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ManualPointCreate(BaseModel):
    """
    Payload for mentor awarding manual PGPA component points to an individual mentee.
    """
    student_id: uuid.UUID = Field(..., description="Student User UUID")
    component_id: uuid.UUID = Field(..., description="PGPA Component UUID")
    semester_id: uuid.UUID = Field(..., description="Academic Semester UUID")
    points: float = Field(..., ge=0.0, le=64000.0, description="Points awarded according to official component-specific evaluation rules")
    remarks: str = Field(..., min_length=3, max_length=1000, description="Mandatory reason or explanation for the manual award")

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 3:
            raise ValueError("Remarks must be at least 3 characters explaining the award reason.")
        return stripped


class ManualPointUpdate(BaseModel):
    """
    Payload for updating an existing manual component point record.
    """
    points: float = Field(..., ge=0.0, le=64000.0, description="Updated points awarded")
    remarks: str = Field(..., min_length=3, max_length=1000, description="Mandatory reason or explanation")

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 3:
            raise ValueError("Remarks must be at least 3 characters explaining the award reason.")
        return stripped


class ManualPointResponse(BaseModel):
    """
    Serialized manual component point with student, mentor, component and semester metadata.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_register_number: Optional[str] = None
    mentor_id: uuid.UUID
    mentor_name: Optional[str] = None
    component_id: uuid.UUID
    component_name: Optional[str] = None
    component_slug: Optional[str] = None
    semester_id: uuid.UUID
    semester_number: Optional[int] = None
    semester_name: Optional[str] = None
    points: float
    remarks: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
