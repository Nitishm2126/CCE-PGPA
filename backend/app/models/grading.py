import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.achievement import Achievement
    from app.models.component import PGPAComponent
    from app.models.semester import Semester
    from app.models.user import User


class HODImportBatch(Base):
    """
    Provenance and audit record for HOD Excel import operations.
    """
    __tablename__ = "hod_import_batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pgpa_components.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    semester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("semesters.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    academic_cohort: Mapped[str] = mapped_column(String(50), nullable=False)
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="preview", nullable=False)
    errors_summary: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    uploader: Mapped["User"] = relationship("User")
    component: Mapped["PGPAComponent"] = relationship("PGPAComponent")
    semester: Mapped["Semester"] = relationship("Semester")
    component_results: Mapped[List["StudentComponentResult"]] = relationship(
        "StudentComponentResult",
        back_populates="import_batch",
    )


class StudentComponentResult(Base):
    """
    Finalized/verified or imported component result for each student per semester.
    Populated by HOD Excel imports or automated student verified submission grading.
    """
    __tablename__ = "student_component_results"

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
    semester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("semesters.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    raw_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    grade: Mapped[str] = mapped_column(String(10), nullable=False)
    grade_points: Mapped[int] = mapped_column(Integer, nullable=False)
    credit_value: Mapped[int] = mapped_column(Integer, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), default="student_submission", nullable=False)
    import_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hod_import_batches.id", ondelete="SET NULL"),
        nullable=True,
    )
    achievement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("achievements.id", ondelete="SET NULL"),
        nullable=True,
    )
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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

    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    component: Mapped["PGPAComponent"] = relationship("PGPAComponent")
    semester: Mapped["Semester"] = relationship("Semester")
    import_batch: Mapped[Optional["HODImportBatch"]] = relationship(
        "HODImportBatch",
        back_populates="component_results",
    )
    achievement: Mapped[Optional["Achievement"]] = relationship("Achievement")

    __table_args__ = (
        UniqueConstraint("student_id", "component_id", "semester_id", name="uq_student_component_semester_result"),
    )


class StudentSemesterPGPA(Base):
    """
    Cumulative and semester PGPA scores calculated using official formula:
    A1 = Σ(Grade obtained * Credit) / Σ(Credits Attempted)
    PGPA = (A1 * 0.6) + (GPA * 0.4)
    """
    __tablename__ = "student_semester_pgpa"

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
    semester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("semesters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    a1_score: Mapped[float] = mapped_column(Float, nullable=False)
    gpa: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pgpa: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_credits_attempted: Mapped[int] = mapped_column(Integer, nullable=False)
    total_credits_earned: Mapped[int] = mapped_column(Integer, nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
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

    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    semester: Mapped["Semester"] = relationship("Semester")

    __table_args__ = (
        UniqueConstraint("student_id", "semester_id", name="uq_student_semester_pgpa"),
    )
