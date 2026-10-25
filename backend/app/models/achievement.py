import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import sqlalchemy as sa
from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.component import PGPAComponent
    from app.models.file import AchievementFile
    from app.models.review import VerificationLog
    from app.models.semester import Semester
    from app.models.user import User


class AchievementStatus(str, enum.Enum):
    """
    Workflow state of an activity submission.
    """
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Achievement(Base):
    """
    Student PGPA activity / achievement submission.
    Multiple activities can exist under each component.
    """
    __tablename__ = "achievements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pgpa_components.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    semester_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("semesters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    activity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    organizer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    event_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    component_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    status: Mapped[AchievementStatus] = mapped_column(
        sa.Enum(
            AchievementStatus,
            name="achievement_status",
            native_enum=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AchievementStatus.DRAFT,
        nullable=False,
        index=True,
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
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
    student: Mapped["User"] = relationship(
        "User",
        foreign_keys=[student_id],
        back_populates="achievements",
    )
    component: Mapped["PGPAComponent"] = relationship(
        "PGPAComponent",
        back_populates="achievements",
    )
    semester: Mapped[Optional["Semester"]] = relationship(
        "Semester",
        back_populates="achievements",
    )
    files: Mapped[List["AchievementFile"]] = relationship(
        "AchievementFile",
        back_populates="achievement",
        cascade="all, delete-orphan",
    )
    verification_logs: Mapped[List["VerificationLog"]] = relationship(
        "VerificationLog",
        back_populates="achievement",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_achievements_student_component", "student_id", "component_id"),
        Index("ix_achievements_student_status", "student_id", "status"),
        Index("ix_achievements_student_semester", "student_id", "semester_id"),
        Index("ix_achievements_status_submitted", "status", "submitted_at"),
        Index("ix_achievements_submitted_at", "submitted_at"),
    )
