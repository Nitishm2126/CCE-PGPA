import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.achievement import Achievement
    from app.models.semester import Semester


class PGPAComponent(Base):
    """
    Official PGPA component catalogue item.
    All component configurations and rules are stored in PostgreSQL.
    """
    __tablename__ = "pgpa_components"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    semester_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    academic_period: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    credit_value: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
    )
    submission_mode: Mapped[str] = mapped_column(
        String(50),
        default="both",
        nullable=False,
    )
    grading_strategy: Mapped[str] = mapped_column(
        String(50),
        default="categorical",
        nullable=False,
    )
    requires_verification: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    config_schema: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
    )
    rule_version: Mapped[int] = mapped_column(
        Integer,
        default=1,
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

    achievements: Mapped[List["Achievement"]] = relationship(
        "Achievement",
        back_populates="component",
    )
    semester_configs: Mapped[List["ComponentSemesterConfig"]] = relationship(
        "ComponentSemesterConfig",
        back_populates="component",
        cascade="all, delete-orphan",
    )


class ComponentSemesterConfig(Base):
    """
    Matrix of availability and deadlines for each PGPA component per semester.
    Admin can enable/disable any component for specific semesters.
    """
    __tablename__ = "component_semester_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pgpa_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    semester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("semesters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    submission_deadline: Mapped[Optional[datetime]] = mapped_column(
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

    component: Mapped["PGPAComponent"] = relationship(
        "PGPAComponent",
        back_populates="semester_configs",
    )
    semester: Mapped["Semester"] = relationship(
        "Semester",
    )

    __table_args__ = (
        UniqueConstraint("component_id", "semester_id", name="uq_component_semester_config"),
    )
