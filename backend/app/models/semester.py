import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.achievement import Achievement
    from app.models.semester_folder import StudentSemesterFolder


class Semester(Base):
    """
    Academic program semester model.
    The programme consists of eight semesters (Semester 1 to Semester 8).
    Administrator controls determine which semesters are enabled for new achievement submissions.
    """
    __tablename__ = "semesters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    semester_number: Mapped[int] = mapped_column(
        SmallInteger,
        unique=True,
        index=True,
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
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
    achievements: Mapped[List["Achievement"]] = relationship(
        "Achievement",
        back_populates="semester",
    )
    student_folders: Mapped[List["StudentSemesterFolder"]] = relationship(
        "StudentSemesterFolder",
        back_populates="semester",
        cascade="all, delete-orphan",
    )
