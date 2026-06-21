import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ScanPlan(Base):
    __tablename__ = "scan_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scan_type: Mapped[str] = mapped_column(
        Enum(
            "owasp_top10",
            "full",
            "api",
            "custom",
            "compliance",
            name="scan_type_enum",
        ),
        nullable=False,
    )
    template_tags: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    scans: Mapped[list["Scan"]] = relationship("Scan", back_populates="plan")
    schedules: Mapped[list["ScanSchedule"]] = relationship(
        "ScanSchedule", back_populates="plan"
    )


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    domain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("domains.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum(
            "queued",
            "running",
            "completed",
            "failed",
            "cancelled",
            name="scan_status_enum",
        ),
        nullable=False,
        default="queued",
        index=True,
    )
    scan_mode: Mapped[str] = mapped_column(
        Enum("blackbox", "graybox", "whitebox", name="scan_mode_enum"),
        nullable=False,
        default="blackbox",
    )
    credential_ids: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    target_urls: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    rate_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    max_duration: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3600
    )  # seconds
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="scans"
    )
    domain: Mapped["Domain"] = relationship("Domain", back_populates="scans")  # type: ignore[name-defined]
    plan: Mapped[Optional["ScanPlan"]] = relationship("ScanPlan", back_populates="scans")
    creator: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", back_populates="scans_created", foreign_keys=[created_by]
    )
    findings: Mapped[list["Finding"]] = relationship(  # type: ignore[name-defined]
        "Finding", back_populates="scan", cascade="all, delete-orphan"
    )
    reports: Mapped[list["Report"]] = relationship(  # type: ignore[name-defined]
        "Report", back_populates="scan"
    )


class ScanSchedule(Base):
    __tablename__ = "scan_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    domain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("domains.id", ondelete="CASCADE"),
        nullable=False,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    credential_ids: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    domain: Mapped["Domain"] = relationship("Domain", back_populates="schedules")  # type: ignore[name-defined]
    plan: Mapped["ScanPlan"] = relationship("ScanPlan", back_populates="schedules")
