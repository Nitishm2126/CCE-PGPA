import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.achievement import Achievement
    from app.models.user import User


class MessageType(str, enum.Enum):
    """
    Message types supported across CCE-PGPA communications.
    """
    REMARK = "Remark"
    CONGRATULATIONS = "Congratulations"
    ACTION_REQUIRED = "Action Required"
    GENERAL = "General Message"


class Message(Base):
    """
    Persistent in-app message and remarks communication record.
    Facilitates transparent communication between Faculty Mentors, HOD, and Students.
    """
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[MessageType] = mapped_column(
        sa.Enum(
            MessageType,
            name="message_type",
            native_enum=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=MessageType.GENERAL,
        nullable=False,
        index=True,
    )
    achievement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("achievements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    recipient: Mapped["User"] = relationship("User", foreign_keys=[recipient_id])
    achievement: Mapped[Optional["Achievement"]] = relationship("Achievement")

    __table_args__ = (
        Index("ix_messages_recipient_is_read", "recipient_id", "is_read"),
        Index("ix_messages_achievement_created", "achievement_id", "created_at"),
    )
