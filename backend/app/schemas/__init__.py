"""
Pydantic schemas package for request/response serialization and validation.
"""
from app.schemas.auth import (
    HODStudentItem,
    LoginRequest,
    MentorInfo,
    MentorStudentItem,
    MessageResponse,
    StudentDetailResponse,
    StudentProfileResponse,
    TokenResponse,
    UserResponse,
)
from app.schemas.health import DatabaseStatus, HealthResponse

__all__ = [
    "HealthResponse",
    "DatabaseStatus",
    "LoginRequest",
    "TokenResponse",
    "UserResponse",
    "StudentProfileResponse",
    "StudentDetailResponse",
    "MentorInfo",
    "MentorStudentItem",
    "HODStudentItem",
    "MessageResponse",
]
