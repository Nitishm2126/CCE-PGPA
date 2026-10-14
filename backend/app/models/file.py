import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.achievement import Achievement
    from app.models.user import User


class FileCategory(str, enum.Enum):
    """
    Evidence file categories for student achievements.
    """
    CERTIFICATE = "certificate"
    PHOTO = "photo"
    SUPPORTING_DOCUMENT = "supporting_document"


class AchievementFile(Base):
    """
    Metadata for evidence files uploaded to Google Drive.
    
    ARCHITECTURAL MANDATE:
    This table stores METADATA ONLY (Google Drive file ID, filename, MIME type, size).
    File binaries must NEVER be stored in PostgreSQL or as permanent server files.
    """
    __tablename__ = "achievement_files"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    achievement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("achievements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(50),
        default="google_drive",
        nullable=False,
    )
    drive_file_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    drive_folder_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    file_category: Mapped[FileCategory] = mapped_column(
        sa.Enum(
            FileCategory,
            name="file_category",
            native_enum=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    achievement: Mapped["Achievement"] = relationship(
        "Achievement",
        back_populates="files",
    )
    uploader: Mapped["User"] = relationship(
        "User",
        foreign_keys=[uploaded_by],
    )
