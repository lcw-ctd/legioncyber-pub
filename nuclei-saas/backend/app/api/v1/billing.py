import hashlib
import hmac
import json
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select

from app.config import settings
from app.core.dependencies import CurrentOrgDep, CurrentUserDep, DBDep
from app.models.organization import Organization
from app.services.billing import BillingService

router = APIRouter(prefix="/billing", tags=["billing"])

billing_service = BillingService()


# ---------- Schemas ----------

class CheckoutRequest(BaseModel):
    plan_id: str  # internal plan name: starter / professional / enterprise
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class ChangePlanRequest(BaseModel):
    plan_id: str


# ---------- Endpoints ----------

@router.get("/plans")
async def list_plans() -> list[dict]:
    """Return available subscription plans with pricing and feature limits."""
    return [
        {
            "id": "free",
            "name": "Free",
            "price_monthly": 0,
            "price_yearly": 0,
            "features": {
                "domains": 1,
                "scans_per_month": 5,
                "concurrent_scans": 1,
                "report_types": ["executive"],
                "data_retention_days": 30,
                "team_members": 1,
                "integrations": [],
            },
        },
        {
            "id": "starter",
            "name": "Starter",
            "price_monthly": 99,
            "price_yearly": 990,
            "features": {
                "domains": 5,
                "scans_per_month": 50,
                "concurrent_scans": 2,
                "report_types": ["executive", "technical"],
                "data_retention_days": 90,
                "team_members": 5,
                "integrations": ["webhook", "slack"],
            },
        },
        {
            "id": "professional",
            "name": "Professional",
            "price_monthly": 299,
            "price_yearly": 2990,
            "features": {
                "domains": 20,
                "scans_per_month": 200,
                "concurrent_scans": 5,
                "report_types": ["executive", "technical", "compliance", "remediation"],
                "data_retention_days": 365,
                "team_members": 20,
                "integrations": ["webhook", "slack", "jira", "pagerduty"],
                "compliance_frameworks": ["pci_dss", "soc2", "iso27001"],
            },
        },
        {
            "id": "enterprise",
            "name": "Enterprise",
            "price_monthly": None,
            "price_yearly": None,
            "description": "Custom pricing — contact sales",
            "features": {
                "domains": -1,  # unlimited
                "scans_per_month": -1,
                "concurrent_scans": -1,
                "report_types": ["executive", "technical", "compliance", "remediation"],
                "data_retention_days": -1,
                "team_members": -1,
                "integrations": [
                    "webhook", "slack", "jira", "pagerduty",
                    "vanta", "cloudflare", "akamai", "imperva",
                ],
                "compliance_frameworks": [
                    "pci_dss", "hipaa", "soc2", "iso27001",
                    "nist_csf", "gdpr", "cmmc", "fedramp",
                ],
                "custom_templates": True,
                "sla": "99.9% uptime",
                "support": "24/7 dedicated",
            },
        },
    ]


@router.get("/subscription")
async def get_subscription(
    current_org: CurrentOrgDep,
    db: DBDep,
) -> dict:
    """Return current subscription status for the organization."""
    if current_org.zoho_subscription_id:
        try:
            subscription_data = await billing_service.get_subscription_status(
                current_org.zoho_subscription_id
            )
        except Exception:
            subscription_data = {}
    else:
        subscription_data = {}

    return {
        "org_id": str(current_org.id),
        "plan_type": current_org.plan_type,
        "subscription_status": current_org.subscription_status,
        "zoho_subscription_id": current_org.zoho_subscription_id,
        **subscription_data,
    }


@router.post("/checkout")
async def create_checkout(
    payload: CheckoutRequest,
    current_org: CurrentOrgDep,
    current_user: CurrentUserDep,
    db: DBDep,
) -> dict:
    """Create a Zoho checkout / hosted payment page URL."""
    valid_plans = {"starter", "professional", "enterprise"}
    if payload.plan_id not in valid_plans:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid plan_id. Must be one of: {', '.join(valid_plans)}",
        )

    try:
        # Ensure customer exists in Zoho
        if not current_org.zoho_customer_id:
            customer_id = await billing_service.create_customer(current_org, current_user)
            current_org.zoho_customer_id = customer_id
            await db.commit()

        result = await billing_service.create_subscription(
            customer_id=current_org.zoho_customer_id,
            plan_id=payload.plan_id,
            success_url=payload.success_url or f"{settings.FRONTEND_URL}/billing/success",
            cancel_url=payload.cancel_url or f"{settings.FRONTEND_URL}/billing/cancel",
        )
        return {
            "checkout_url": result["hostedpage"]["url"],
            "subscription_id": result.get("subscription_id"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create checkout session: {exc}",
        ) from exc


@router.post("/subscription/cancel", status_code=status.HTTP_200_OK)
async def cancel_subscription(
    current_org: CurrentOrgDep,
    db: DBDep,
) -> dict:
    if not current_org.zoho_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription found",
        )
    try:
        await billing_service.cancel_subscription(current_org.zoho_subscription_id)
        current_org.subscription_status = "cancelled"
        await db.commit()
        return {"message": "Subscription cancelled successfully"}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to cancel subscription: {exc}",
        ) from exc


@router.post("/subscription/change-plan")
async def change_plan(
    payload: ChangePlanRequest,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> dict:
    valid_plans = {"free", "starter", "professional", "enterprise"}
    if payload.plan_id not in valid_plans:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid plan_id",
        )

    if not current_org.zoho_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription. Create a subscription first.",
        )

    try:
        await billing_service.change_plan(
            current_org.zoho_subscription_id, payload.plan_id
        )
        current_org.plan_type = payload.plan_id
        await db.commit()
        return {"message": f"Plan changed to {payload.plan_id}"}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to change plan: {exc}",
        ) from exc


@router.get("/invoices")
async def list_invoices(current_org: CurrentOrgDep) -> list[dict]:
    if not current_org.zoho_customer_id:
        return []
    try:
        invoices = await billing_service.list_invoices(current_org.zoho_customer_id)
        return invoices
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to retrieve invoices: {exc}",
        ) from exc


@router.post("/webhooks/zoho", status_code=status.HTTP_200_OK)
async def zoho_webhook(request: Request, db) -> dict:
    """Handle Zoho Subscriptions webhook events."""
    body = await request.body()
    # Zoho signs webhooks with HMAC-SHA256
    signature = request.headers.get("X-Zoho-Webhooktoken", "")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body"
        )

    try:
        await billing_service.handle_webhook(payload, signature, db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Webhook processing error: {exc}",
        ) from exc

    return {"status": "ok"}
