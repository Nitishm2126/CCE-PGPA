import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OAuthCredential(Base):
    """
    Secure persistent storage for third-party OAuth 2.0 credentials (e.g. Google Drive).
    ARCHITECTURAL MANDATE:
    Sensitive refresh tokens are encrypted at rest using AES/Fernet encryption.
    Plaintext secrets or access tokens are never logged or stored unencrypted.
    """
    __tablename__ = "oauth_credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    provider: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    client_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    encrypted_refresh_token: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    scopes: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    authorized_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    authorized_email: Mapped[Optional[str]] = mapped_column(
        String(255),
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
