import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ComplianceProfile(Base):
    __tablename__ = "compliance_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    frameworks: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    security_controls: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    risk_tolerance: Mapped[str] = mapped_column(
        Enum("low", "medium", "high", name="risk_tolerance_enum"),
        nullable=False,
        default="medium",
    )
    industry_vertical: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="compliance_profiles"
    )
    reports: Mapped[list["Report"]] = relationship(  # type: ignore[name-defined]
        "Report", back_populates="compliance_profile"
    )


class ComplianceMapping(Base):
    """Maps compliance framework requirements to nuclei templates, CWEs, and OWASP categories."""

    __tablename__ = "compliance_mappings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    framework: Mapped[str] = mapped_column(
        Enum(
            "pci_dss",
            "hipaa",
            "soc2",
            "iso27001",
            "nist_csf",
            "gdpr",
            "cmmc",
            "fedramp",
            name="compliance_framework_enum",
        ),
        nullable=False,
        index=True,
    )
    requirement_id: Mapped[str] = mapped_column(String(100), nullable=False)
    requirement_name: Mapped[str] = mapped_column(String(500), nullable=False)
    nuclei_tags: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    cwe_ids: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    owasp_categories: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
