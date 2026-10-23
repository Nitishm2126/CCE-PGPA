import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.semester import Semester
    from app.models.user import User


class StudentSemesterFolder(Base):
    """
    Persistent mapping of dedicated Google Drive semester subfolder IDs for each student.
    Hierarchy:
    CCE-PGPA Evidence
      └── Student Folder (profile.google_drive_folder_id)
          ├── Semester 1 (student_semester_folders record)
          ├── Semester 2 (student_semester_folders record)
          └── ...
    """
    __tablename__ = "student_semester_folders"

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
    drive_folder_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    drive_folder_name: Mapped[str] = mapped_column(
        String(100),
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

    # Relationships
    student: Mapped["User"] = relationship(
        "User",
        foreign_keys=[student_id],
    )
    semester: Mapped["Semester"] = relationship(
        "Semester",
        back_populates="student_folders",
    )

    __table_args__ = (
        UniqueConstraint("student_id", "semester_id", name="uq_student_semester_folder"),
    )
