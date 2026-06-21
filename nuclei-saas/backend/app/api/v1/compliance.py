import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.dependencies import CurrentOrgDep, DBDep
from app.models.compliance import ComplianceProfile
from app.services.compliance import ComplianceService

router = APIRouter(prefix="/compliance", tags=["compliance"])


# ---------- Schemas ----------

class ComplianceProfileUpdate(BaseModel):
    name: Optional[str] = None
    frameworks: Optional[list[str]] = None
    security_controls: Optional[dict] = None
    risk_tolerance: Optional[str] = None
    industry_vertical: Optional[str] = None


class ComplianceProfileResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    frameworks: Optional[list[str]]
    security_controls: Optional[dict]
    risk_tolerance: str
    industry_vertical: Optional[str]

    model_config = {"from_attributes": True}


VALID_FRAMEWORKS = {
    "pci_dss", "hipaa", "soc2", "iso27001", "nist_csf", "gdpr", "cmmc", "fedramp"
}
VALID_RISK_TOLERANCES = {"low", "medium", "high"}


# ---------- Endpoints ----------

@router.get("/frameworks")
async def list_frameworks() -> list[dict]:
    """List all supported compliance frameworks with descriptions."""
    return [
        {
            "id": "pci_dss",
            "name": "PCI DSS",
            "version": "4.0",
            "description": "Payment Card Industry Data Security Standard",
            "applicable_to": "Organizations that process, store, or transmit payment card data",
        },
        {
            "id": "hipaa",
            "name": "HIPAA",
            "version": "2013",
            "description": "Health Insurance Portability and Accountability Act",
            "applicable_to": "Healthcare organizations and business associates",
        },
        {
            "id": "soc2",
            "name": "SOC 2",
            "version": "Type II",
            "description": "Service Organization Control 2",
            "applicable_to": "Technology and cloud service providers",
        },
        {
            "id": "iso27001",
            "name": "ISO 27001",
            "version": "2022",
            "description": "Information Security Management System",
            "applicable_to": "Any organization seeking an internationally recognized ISMS certification",
        },
        {
            "id": "nist_csf",
            "name": "NIST CSF",
            "version": "2.0",
            "description": "NIST Cybersecurity Framework",
            "applicable_to": "US critical infrastructure and organizations adopting NIST guidance",
        },
        {
            "id": "gdpr",
            "name": "GDPR",
            "version": "2018",
            "description": "General Data Protection Regulation",
            "applicable_to": "Organizations processing EU residents' personal data",
        },
        {
            "id": "cmmc",
            "name": "CMMC",
            "version": "2.0",
            "description": "Cybersecurity Maturity Model Certification",
            "applicable_to": "US Department of Defense contractors",
        },
        {
            "id": "fedramp",
            "name": "FedRAMP",
            "version": "Rev 5",
            "description": "Federal Risk and Authorization Management Program",
            "applicable_to": "Cloud service providers serving US federal agencies",
        },
    ]


@router.get("/profile", response_model=ComplianceProfileResponse)
async def get_compliance_profile(
    current_org: CurrentOrgDep,
    db: DBDep,
) -> ComplianceProfile:
    result = await db.execute(
        select(ComplianceProfile)
        .where(ComplianceProfile.org_id == current_org.id)
        .order_by(ComplianceProfile.created_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No compliance profile found for this organization. Create one first.",
        )
    return profile


@router.put("/profile", response_model=ComplianceProfileResponse)
async def upsert_compliance_profile(
    payload: ComplianceProfileUpdate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> ComplianceProfile:
    if payload.frameworks:
        invalid = set(payload.frameworks) - VALID_FRAMEWORKS
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid frameworks: {', '.join(invalid)}. Valid: {', '.join(VALID_FRAMEWORKS)}",
            )
    if payload.risk_tolerance and payload.risk_tolerance not in VALID_RISK_TOLERANCES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid risk_tolerance. Must be one of: {', '.join(VALID_RISK_TOLERANCES)}",
        )

    result = await db.execute(
        select(ComplianceProfile)
        .where(ComplianceProfile.org_id == current_org.id)
        .order_by(ComplianceProfile.created_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        profile = ComplianceProfile(
            org_id=current_org.id,
            name=payload.name or f"{current_org.name} Compliance Profile",
            frameworks=payload.frameworks or [],
            security_controls=payload.security_controls or {},
            risk_tolerance=payload.risk_tolerance or "medium",
            industry_vertical=payload.industry_vertical,
        )
        db.add(profile)
    else:
        if payload.name is not None:
            profile.name = payload.name
        if payload.frameworks is not None:
            profile.frameworks = payload.frameworks
        if payload.security_controls is not None:
            profile.security_controls = payload.security_controls
        if payload.risk_tolerance is not None:
            profile.risk_tolerance = payload.risk_tolerance
        if payload.industry_vertical is not None:
            profile.industry_vertical = payload.industry_vertical

    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/gaps")
async def get_compliance_gaps(
    current_org: CurrentOrgDep,
    db: DBDep,
    framework: Optional[str] = None,
) -> dict:
    """Get compliance gap analysis based on open findings."""
    result = await db.execute(
        select(ComplianceProfile)
        .where(ComplianceProfile.org_id == current_org.id)
        .order_by(ComplianceProfile.created_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No compliance profile found",
        )

    service = ComplianceService()
    frameworks_to_check = [framework] if framework else (profile.frameworks or [])

    gaps = {}
    scores = {}
    for fw in frameworks_to_check:
        gaps[fw] = await service.get_compliance_gaps(current_org.id, [fw], db)
        scores[fw] = await service.get_compliance_score(current_org.id, fw, db)

    return {
        "profile": {
            "id": str(profile.id),
            "name": profile.name,
            "risk_tolerance": profile.risk_tolerance,
            "frameworks": profile.frameworks,
        },
        "gaps": gaps,
        "scores": scores,
    }
