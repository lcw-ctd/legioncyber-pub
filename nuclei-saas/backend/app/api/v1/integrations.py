import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.dependencies import CurrentOrgDep, DBDep
from app.core.security import decrypt_data, encrypt_data
from app.models.integration import Integration, WebhookEvent
from app.services.integration_manager import IntegrationManager

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ---------- Schemas ----------

class IntegrationCreate(BaseModel):
    provider: str
    config: dict
    is_active: bool = True


class IntegrationUpdate(BaseModel):
    config: Optional[dict] = None
    is_active: Optional[bool] = None


class IntegrationResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    provider: str
    is_active: bool
    last_sync_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class WebhookEventResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    integration_id: uuid.UUID
    event_type: str
    payload: Optional[dict]
    status: str
    attempts: int
    created_at: datetime

    model_config = {"from_attributes": True}


VALID_PROVIDERS = {
    "vanta", "cloudflare", "akamai", "imperva",
    "webhook", "slack", "jira", "pagerduty",
}


# ---------- Endpoints ----------

@router.get("", response_model=list[IntegrationResponse])
async def list_integrations(current_org: CurrentOrgDep, db: DBDep) -> list[Integration]:
    result = await db.execute(
        select(Integration)
        .where(Integration.org_id == current_org.id)
        .order_by(Integration.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    payload: IntegrationCreate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Integration:
    if payload.provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid provider. Must be one of: {', '.join(sorted(VALID_PROVIDERS))}",
        )

    # Only one integration per provider per org
    existing = await db.execute(
        select(Integration).where(
            Integration.org_id == current_org.id,
            Integration.provider == payload.provider,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An integration with provider '{payload.provider}' already exists",
        )

    encrypted_config = encrypt_data(payload.config)
    integration = Integration(
        org_id=current_org.id,
        provider=payload.provider,
        config=encrypted_config,
        is_active=payload.is_active,
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return integration


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: uuid.UUID,
    payload: IntegrationUpdate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Integration:
    integration = await _get_integration_or_404(integration_id, current_org.id, db)

    if payload.config is not None:
        integration.config = encrypt_data(payload.config)
    if payload.is_active is not None:
        integration.is_active = payload.is_active

    await db.commit()
    await db.refresh(integration)
    return integration


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> None:
    integration = await _get_integration_or_404(integration_id, current_org.id, db)
    await db.delete(integration)
    await db.commit()


@router.post("/{integration_id}/sync")
async def trigger_sync(
    integration_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> dict:
    integration = await _get_integration_or_404(integration_id, current_org.id, db)

    manager = IntegrationManager()
    try:
        config = decrypt_data(integration.config)
        if not isinstance(config, dict):
            config = {}

        result = await manager.sync(integration, config)
        from datetime import timezone
        integration.last_sync_at = datetime.now(tz=timezone.utc)
        await db.commit()
        return {"status": "ok", "result": result}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Sync failed: {exc}",
        ) from exc


@router.get("/webhooks/events", response_model=list[WebhookEventResponse])
async def list_webhook_events(
    current_org: CurrentOrgDep,
    db: DBDep,
    integration_id: Optional[uuid.UUID] = Query(None),
    event_status: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[WebhookEvent]:
    query = select(WebhookEvent).where(WebhookEvent.org_id == current_org.id)
    if integration_id:
        query = query.where(WebhookEvent.integration_id == integration_id)
    if event_status:
        query = query.where(WebhookEvent.status == event_status)
    query = query.order_by(WebhookEvent.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


# ---------- Helpers ----------

async def _get_integration_or_404(
    integration_id: uuid.UUID, org_id: uuid.UUID, db
) -> Integration:
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id, Integration.org_id == org_id
        )
    )
    integration = result.scalar_one_or_none()
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found"
        )
    return integration
