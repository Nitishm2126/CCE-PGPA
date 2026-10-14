"""
SQLAlchemy models package for CCE Achieve PGPA Management System.
All models are imported here to ensure registration on Base.metadata for Alembic.
"""
from app.db.base import Base
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog
from app.models.component import PGPAComponent
from app.models.file import AchievementFile, FileCategory
from app.models.review import ReviewAction, VerificationLog
from app.models.user import MentorProfile, StudentProfile, User, UserRole

__all__ = [
    "Base",
    "User",
    "UserRole",
    "StudentProfile",
    "MentorProfile",
    "MentorAssignment",
    "PGPAComponent",
    "Achievement",
    "AchievementStatus",
    "AchievementFile",
    "FileCategory",
    "VerificationLog",
    "ReviewAction",
    "AuditLog",
]
