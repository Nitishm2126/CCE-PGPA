import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    """
    Credentials for user authentication.
    """
    email: EmailStr = Field(..., description="College email address")
    password: str = Field(..., min_length=1, description="Account password")


class TokenResponse(BaseModel):
    """
    JWT Access token response payload.
    """
    access_token: str = Field(..., description="Signed JWT Bearer access token")
    token_type: str = Field(default="bearer", description="Token authentication scheme")
    expires_in_minutes: int = Field(..., description="Token lifespan in minutes")
    role: UserRole = Field(..., description="Authenticated user role")


class UserResponse(BaseModel):
    """
    Authenticated user summary information (passwords are never exposed).
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime


class StudentProfileResponse(BaseModel):
    """
    Detailed profile information for a cohort student.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    register_number: str
    department: str
    year: int
    section: Optional[str] = None
    semester: Optional[str] = None
    original_mentor_name: Optional[str] = None
    batch: Optional[str] = None
    phone_number: Optional[str] = None


class MentorInfo(BaseModel):
    """
    Summary of an assigned faculty mentor.
    """
    model_config = ConfigDict(from_attributes=True)

    mentor_id: uuid.UUID
    full_name: str
    email: str
    staff_id: Optional[str] = None
    department: str


class StudentDetailResponse(BaseModel):
    """
    Full student profile response for GET /api/v1/students/me.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    profile: Optional[StudentProfileResponse] = None
    assigned_mentor: Optional[MentorInfo] = None


class MentorStudentItem(BaseModel):
    """
    Student item in mentor's assigned student roster (GET /api/v1/mentor/students).
    """
    model_config = ConfigDict(from_attributes=True)

    student_id: uuid.UUID
    full_name: str
    email: str
    register_number: Optional[str] = None
    department: str
    year: int
    section: Optional[str] = None
    assignment_id: uuid.UUID
    assigned_at: datetime


class HODStudentItem(BaseModel):
    """
    Department-wide student record for HOD overview (GET /api/v1/hod/students).
    """
    model_config = ConfigDict(from_attributes=True)

    student_id: uuid.UUID
    full_name: str
    email: str
    register_number: Optional[str] = None
    department: str
    year: int
    section: Optional[str] = None
    is_active: bool
    mentor_id: Optional[uuid.UUID] = None
    mentor_name: Optional[str] = None


class MessageResponse(BaseModel):
    """
    Generic message response.
    """
    message: str
