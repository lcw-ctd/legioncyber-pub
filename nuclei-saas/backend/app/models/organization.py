import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    plan_type: Mapped[str] = mapped_column(
        Enum("free", "starter", "professional", "enterprise", name="plan_type_enum"),
        nullable=False,
        default="free",
    )
    subscription_status: Mapped[str] = mapped_column(
        Enum(
            "active",
            "trialing",
            "past_due",
            "cancelled",
            "expired",
            name="subscription_status_enum",
        ),
        nullable=False,
        default="active",
    )
    zoho_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    zoho_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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
    members: Mapped[list["OrganizationMember"]] = relationship(
        "OrganizationMember", back_populates="organization", cascade="all, delete-orphan"
    )
    domains: Mapped[list["Domain"]] = relationship(  # type: ignore[name-defined]
        "Domain", back_populates="organization", cascade="all, delete-orphan"
    )
    scans: Mapped[list["Scan"]] = relationship(  # type: ignore[name-defined]
        "Scan", back_populates="organization"
    )
    findings: Mapped[list["Finding"]] = relationship(  # type: ignore[name-defined]
        "Finding", back_populates="organization"
    )
    reports: Mapped[list["Report"]] = relationship(  # type: ignore[name-defined]
        "Report", back_populates="organization"
    )
    integrations: Mapped[list["Integration"]] = relationship(  # type: ignore[name-defined]
        "Integration", back_populates="organization", cascade="all, delete-orphan"
    )
    compliance_profiles: Mapped[list["ComplianceProfile"]] = relationship(  # type: ignore[name-defined]
        "ComplianceProfile", back_populates="organization", cascade="all, delete-orphan"
    )


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        Enum("owner", "admin", "analyst", "viewer", name="member_role_enum"),
        nullable=False,
        default="viewer",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="members"
    )
    user: Mapped["User"] = relationship("User", back_populates="memberships")  # type: ignore[name-defined]
