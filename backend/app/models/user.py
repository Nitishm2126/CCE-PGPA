import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.achievement import Achievement
    from app.models.assignment import MentorAssignment
    from app.models.review import VerificationLog


class UserRole(str, enum.Enum):
    """
    Role enumeration for CCE Achieve users.
    """
    STUDENT = "student"
    MENTOR = "mentor"
    HOD = "hod"


class User(Base):
    """
    Core user account model handling identity, credentials, role, and active status.
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        sa.Enum(
            UserRole,
            name="user_role",
            native_enum=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    student_profile: Mapped[Optional["StudentProfile"]] = relationship(
        "StudentProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    mentor_profile: Mapped[Optional["MentorProfile"]] = relationship(
        "MentorProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    achievements: Mapped[List["Achievement"]] = relationship(
        "Achievement",
        back_populates="student",
        foreign_keys="[Achievement.student_id]",
        cascade="all, delete-orphan",
    )
    reviews_given: Mapped[List["VerificationLog"]] = relationship(
        "VerificationLog",
        back_populates="reviewer",
        foreign_keys="[VerificationLog.reviewer_id]",
    )
    mentee_assignments: Mapped[List["MentorAssignment"]] = relationship(
        "MentorAssignment",
        back_populates="student",
        foreign_keys="[MentorAssignment.student_id]",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    mentor_assignments: Mapped[List["MentorAssignment"]] = relationship(
        "MentorAssignment",
        back_populates="mentor",
        foreign_keys="[MentorAssignment.mentor_id]",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class StudentProfile(Base):
    """
    Profile extension for students in the 2nd-year CCE cohort (61 students).
    """
    __tablename__ = "student_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    register_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    department: Mapped[str] = mapped_column(
        String(50),
        default="CCE",
        nullable=False,
    )
    year: Mapped[int] = mapped_column(
        SmallInteger,
        default=2,
        nullable=False,
    )
    section: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    semester: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    original_mentor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    batch: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="student_profile")


class MentorProfile(Base):
    """
    Profile extension for faculty mentors (3 mentors for 2nd-year CCE cohort).
    """
    __tablename__ = "mentor_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    staff_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        unique=True,
        nullable=True,
    )
    department: Mapped[str] = mapped_column(
        String(50),
        default="CCE",
        nullable=False,
    )
    designation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="mentor_profile")
