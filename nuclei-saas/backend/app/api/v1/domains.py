import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.dependencies import CurrentOrgDep, CurrentUserDep, DBDep
from app.core.security import decrypt_data, encrypt_data
from app.models.domain import Domain, DomainCredential
from app.services.domain_verification import DomainVerificationService

router = APIRouter(prefix="/domains", tags=["domains"])


# ---------- Schemas ----------

class DomainCreate(BaseModel):
    fqdn: str
    verification_method: str = "dns_txt"


class DomainResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    fqdn: str
    verification_method: str
    verification_token: Optional[str]
    verification_status: str
    verified_at: Optional[datetime]
    last_checked: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class VerificationInstructionsResponse(BaseModel):
    method: str
    token: str
    instructions: dict


class CredentialCreate(BaseModel):
    name: str
    credential_type: str
    credential_data: dict


class CredentialUpdate(BaseModel):
    name: Optional[str] = None
    credential_data: Optional[dict] = None


class CredentialResponse(BaseModel):
    id: uuid.UUID
    domain_id: uuid.UUID
    org_id: uuid.UUID
    name: str
    credential_type: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


VALID_VERIFICATION_METHODS = {"dns_txt", "http_file", "meta_tag"}
VALID_CREDENTIAL_TYPES = {
    "basic_auth", "bearer_token", "cookie", "form_login", "api_key", "oauth2"
}


# ---------- Endpoints ----------

@router.get("", response_model=list[DomainResponse])
async def list_domains(current_org: CurrentOrgDep, db: DBDep) -> list[Domain]:
    result = await db.execute(
        select(Domain)
        .where(Domain.org_id == current_org.id)
        .order_by(Domain.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=DomainResponse, status_code=status.HTTP_201_CREATED)
async def add_domain(
    payload: DomainCreate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Domain:
    if payload.verification_method not in VALID_VERIFICATION_METHODS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid verification_method. Must be one of: {', '.join(VALID_VERIFICATION_METHODS)}",
        )

    # Normalize FQDN
    fqdn = payload.fqdn.lower().strip().rstrip(".")

    # Check for duplicates within org
    existing = await db.execute(
        select(Domain).where(Domain.org_id == current_org.id, Domain.fqdn == fqdn)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Domain already exists in this organization",
        )

    service = DomainVerificationService()
    token = service.generate_verification_token(str(uuid.uuid4()))

    domain = Domain(
        org_id=current_org.id,
        fqdn=fqdn,
        verification_method=payload.verification_method,
        verification_token=token,
        verification_status="pending",
    )
    db.add(domain)
    await db.commit()
    await db.refresh(domain)
    return domain


@router.get("/{domain_id}/verification", response_model=VerificationInstructionsResponse)
async def get_verification_instructions(
    domain_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> VerificationInstructionsResponse:
    domain = await _get_domain_or_404(domain_id, current_org.id, db)
    service = DomainVerificationService()

    if domain.verification_method == "dns_txt":
        instructions = service.get_dns_txt_record(domain.fqdn, domain.verification_token or "")
    elif domain.verification_method == "http_file":
        content = service.get_http_file_content(domain.verification_token or "")
        instructions = {
            "file_content": content,
            "file_path": "/.well-known/security-scanner-verification.txt",
            "instruction": f"Create a file at https://{domain.fqdn}/.well-known/security-scanner-verification.txt with the given content",
        }
    else:  # meta_tag
        instructions = {
            "meta_tag": f'<meta name="security-scanner-verification" content="{domain.verification_token}" />',
            "instruction": "Add the meta tag to the <head> section of your website's root page",
        }

    return VerificationInstructionsResponse(
        method=domain.verification_method,
        token=domain.verification_token or "",
        instructions=instructions,
    )


@router.post("/{domain_id}/verify", response_model=DomainResponse)
async def trigger_verification(
    domain_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Domain:
    domain = await _get_domain_or_404(domain_id, current_org.id, db)
    service = DomainVerificationService()

    verified = False
    if domain.verification_method == "dns_txt":
        verified = await service.verify_dns(domain.fqdn, domain.verification_token or "")
    elif domain.verification_method == "http_file":
        verified = await service.verify_http(domain.fqdn, domain.verification_token or "")
    elif domain.verification_method == "meta_tag":
        verified = await service.verify_meta_tag(domain.fqdn, domain.verification_token or "")

    now = datetime.now(tz=timezone.utc)
    domain.last_checked = now
    if verified:
        domain.verification_status = "verified"
        domain.verified_at = now
    else:
        domain.verification_status = "failed"

    await db.commit()
    await db.refresh(domain)
    return domain


@router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_domain(
    domain_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> None:
    domain = await _get_domain_or_404(domain_id, current_org.id, db)
    await db.delete(domain)
    await db.commit()


# ---------- Credential endpoints ----------

@router.get("/{domain_id}/credentials", response_model=list[CredentialResponse])
async def list_credentials(
    domain_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> list[DomainCredential]:
    await _get_domain_or_404(domain_id, current_org.id, db)
    result = await db.execute(
        select(DomainCredential).where(DomainCredential.domain_id == domain_id)
    )
    return list(result.scalars().all())


@router.post(
    "/{domain_id}/credentials",
    response_model=CredentialResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_credential(
    domain_id: uuid.UUID,
    payload: CredentialCreate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> DomainCredential:
    await _get_domain_or_404(domain_id, current_org.id, db)

    if payload.credential_type not in VALID_CREDENTIAL_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid credential_type. Must be one of: {', '.join(VALID_CREDENTIAL_TYPES)}",
        )

    encrypted = encrypt_data(payload.credential_data)
    cred = DomainCredential(
        domain_id=domain_id,
        org_id=current_org.id,
        name=payload.name,
        credential_type=payload.credential_type,
        credential_data=encrypted,
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    return cred


@router.put("/{domain_id}/credentials/{cred_id}", response_model=CredentialResponse)
async def update_credential(
    domain_id: uuid.UUID,
    cred_id: uuid.UUID,
    payload: CredentialUpdate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> DomainCredential:
    await _get_domain_or_404(domain_id, current_org.id, db)
    cred = await _get_credential_or_404(cred_id, domain_id, db)

    if payload.name is not None:
        cred.name = payload.name
    if payload.credential_data is not None:
        cred.credential_data = encrypt_data(payload.credential_data)

    await db.commit()
    await db.refresh(cred)
    return cred


@router.delete(
    "/{domain_id}/credentials/{cred_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_credential(
    domain_id: uuid.UUID,
    cred_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> None:
    await _get_domain_or_404(domain_id, current_org.id, db)
    cred = await _get_credential_or_404(cred_id, domain_id, db)
    await db.delete(cred)
    await db.commit()


# ---------- Helpers ----------

async def _get_domain_or_404(
    domain_id: uuid.UUID, org_id: uuid.UUID, db
) -> Domain:
    result = await db.execute(
        select(Domain).where(Domain.id == domain_id, Domain.org_id == org_id)
    )
    domain = result.scalar_one_or_none()
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    return domain


async def _get_credential_or_404(
    cred_id: uuid.UUID, domain_id: uuid.UUID, db
) -> DomainCredential:
    result = await db.execute(
        select(DomainCredential).where(
            DomainCredential.id == cred_id, DomainCredential.domain_id == domain_id
        )
    )
    cred = result.scalar_one_or_none()
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found"
        )
    return cred
