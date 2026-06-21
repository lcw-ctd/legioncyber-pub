import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scan_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    compliance_profile_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("compliance_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(
        Enum(
            "executive",
            "technical",
            "compliance",
            "remediation",
            name="report_type_enum",
        ),
        nullable=False,
    )
    format: Mapped[str] = mapped_column(
        Enum("pdf", "html", "json", name="report_format_enum"),
        nullable=False,
        default="pdf",
    )
    s3_key: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("generating", "ready", "failed", name="report_status_enum"),
        nullable=False,
        default="generating",
    )
    generated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="reports"
    )
    scan: Mapped[Optional["Scan"]] = relationship("Scan", back_populates="reports")  # type: ignore[name-defined]
    compliance_profile: Mapped[Optional["ComplianceProfile"]] = relationship(  # type: ignore[name-defined]
        "ComplianceProfile", back_populates="reports"
    )
    creator: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", back_populates="reports_created", foreign_keys=[created_by]
    )
