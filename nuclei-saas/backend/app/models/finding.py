import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    template_name: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(
        Enum(
            "critical",
            "high",
            "medium",
            "low",
            "info",
            name="finding_severity_enum",
        ),
        nullable=False,
        index=True,
    )
    cvss_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    affected_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    affected_parameter: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Evidence: {request, response, curl_command}
    evidence: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    remediation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    references: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    cwe_ids: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    cve_ids: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )
    owasp_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(
            "open",
            "in_progress",
            "resolved",
            "accepted_risk",
            "false_positive",
            name="finding_status_enum",
        ),
        nullable=False,
        default="open",
        index=True,
    )
    business_impact: Mapped[Optional[str]] = mapped_column(
        Enum("critical", "high", "medium", "low", name="business_impact_enum"),
        nullable=True,
    )
    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    tags: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String), nullable=True, default=list
    )

    # Relationships
    scan: Mapped["Scan"] = relationship("Scan", back_populates="findings")  # type: ignore[name-defined]
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="findings"
    )
    assignee: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", back_populates="assigned_findings", foreign_keys=[assigned_to]
    )
    comments: Mapped[list["FindingComment"]] = relationship(
        "FindingComment", back_populates="finding", cascade="all, delete-orphan"
    )


class FindingComment(Base):
    __tablename__ = "finding_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("findings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    finding: Mapped["Finding"] = relationship("Finding", back_populates="comments")
    user: Mapped["User"] = relationship("User", back_populates="finding_comments")  # type: ignore[name-defined]
