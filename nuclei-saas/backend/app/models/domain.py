import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Domain(Base):
    __tablename__ = "domains"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fqdn: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    verification_method: Mapped[str] = mapped_column(
        Enum("dns_txt", "http_file", "meta_tag", name="verification_method_enum"),
        nullable=False,
        default="dns_txt",
    )
    verification_token: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    verification_status: Mapped[str] = mapped_column(
        Enum("pending", "verified", "failed", name="verification_status_enum"),
        nullable=False,
        default="pending",
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_checked: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(  # type: ignore[name-defined]
        "Organization", back_populates="domains"
    )
    credentials: Mapped[list["DomainCredential"]] = relationship(
        "DomainCredential", back_populates="domain", cascade="all, delete-orphan"
    )
    scans: Mapped[list["Scan"]] = relationship(  # type: ignore[name-defined]
        "Scan", back_populates="domain"
    )
    schedules: Mapped[list["ScanSchedule"]] = relationship(  # type: ignore[name-defined]
        "ScanSchedule", back_populates="domain"
    )


class DomainCredential(Base):
    __tablename__ = "domain_credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    domain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("domains.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_type: Mapped[str] = mapped_column(
        Enum(
            "basic_auth",
            "bearer_token",
            "cookie",
            "form_login",
            "api_key",
            "oauth2",
            name="credential_type_enum",
        ),
        nullable=False,
    )
    # Stored as encrypted JSON
    credential_data: Mapped[str] = mapped_column(String, nullable=False)
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
    domain: Mapped["Domain"] = relationship("Domain", back_populates="credentials")
