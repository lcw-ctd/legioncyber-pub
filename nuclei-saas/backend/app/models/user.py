import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mfa_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_verification_token: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    password_reset_token: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    password_reset_expires: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    memberships: Mapped[list["OrganizationMember"]] = relationship(  # type: ignore[name-defined]
        "OrganizationMember", back_populates="user", cascade="all, delete-orphan"
    )
    scans_created: Mapped[list["Scan"]] = relationship(  # type: ignore[name-defined]
        "Scan", back_populates="creator", foreign_keys="Scan.created_by"
    )
    finding_comments: Mapped[list["FindingComment"]] = relationship(  # type: ignore[name-defined]
        "FindingComment", back_populates="user"
    )
    assigned_findings: Mapped[list["Finding"]] = relationship(  # type: ignore[name-defined]
        "Finding", back_populates="assignee", foreign_keys="Finding.assigned_to"
    )
    reports_created: Mapped[list["Report"]] = relationship(  # type: ignore[name-defined]
        "Report", back_populates="creator", foreign_keys="Report.created_by"
    )
