import logging
from typing import Any, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger(__name__)

# Maps internal plan names -> Zoho plan codes
PLAN_CONFIGS: dict[str, dict[str, Any]] = {
    "free": {
        "zoho_plan_code": "free_plan",
        "domains": 1,
        "scans_per_month": 5,
        "concurrent_scans": 1,
        "team_members": 1,
        "data_retention_days": 30,
    },
    "starter": {
        "zoho_plan_code": "starter_monthly",
        "zoho_plan_code_yearly": "starter_yearly",
        "price_monthly": 99,
        "price_yearly": 990,
        "domains": 5,
        "scans_per_month": 50,
        "concurrent_scans": 2,
        "team_members": 5,
        "data_retention_days": 90,
    },
    "professional": {
        "zoho_plan_code": "professional_monthly",
        "zoho_plan_code_yearly": "professional_yearly",
        "price_monthly": 299,
        "price_yearly": 2990,
        "domains": 20,
        "scans_per_month": 200,
        "concurrent_scans": 5,
        "team_members": 20,
        "data_retention_days": 365,
    },
    "enterprise": {
        "zoho_plan_code": "enterprise_monthly",
        "zoho_plan_code_yearly": "enterprise_yearly",
        "domains": -1,
        "scans_per_month": -1,
        "concurrent_scans": -1,
        "team_members": -1,
        "data_retention_days": -1,
    },
}


class BillingService:
    def __init__(self) -> None:
        self._access_token: Optional[str] = None

    async def _get_access_token(self) -> str:
        """Obtain a fresh OAuth2 access token from Zoho using the stored refresh token."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.ZOHO_ACCOUNTS_URL}/oauth/v2/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": settings.ZOHO_CLIENT_ID,
                    "client_secret": settings.ZOHO_CLIENT_SECRET,
                    "refresh_token": settings.ZOHO_REFRESH_TOKEN,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["access_token"]

    async def _client(self) -> httpx.AsyncClient:
        token = await self._get_access_token()
        return httpx.AsyncClient(
            base_url=f"{settings.ZOHO_API_DOMAIN}/billing/v1/",
            headers={
                "Authorization": f"Zoho-oauthtoken {token}",
                "X-com-zoho-subscriptions-organizationid": settings.ZOHO_ORGANIZATION_ID,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def create_customer(self, org: Any, user: Any) -> str:
        """Create a customer record in Zoho Books/Subscriptions and return the customer ID."""
        async with await self._client() as client:
            response = await client.post(
                "customers",
                json={
                    "display_name": org.name,
                    "email": user.email,
                    "contact_name": user.full_name,
                    "custom_fields": [
                        {"label": "org_id", "value": str(org.id)},
                        {"label": "org_slug", "value": org.slug},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["customer"]["customer_id"]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def create_subscription(
        self,
        customer_id: str,
        plan_id: str,
        success_url: str = "",
        cancel_url: str = "",
    ) -> dict:
        """Create a Zoho subscription with a hosted payment page.

        Returns the API response dict which includes hostedpage.url for redirect.
        """
        if plan_id not in PLAN_CONFIGS:
            raise ValueError(f"Unknown plan: {plan_id}")

        plan_config = PLAN_CONFIGS[plan_id]
        zoho_plan_code = plan_config.get("zoho_plan_code", plan_id)

        async with await self._client() as client:
            response = await client.post(
                "hostedpages/newsubscription",
                json={
                    "customer_id": customer_id,
                    "plan": {"plan_code": zoho_plan_code, "quantity": 1},
                    "redirect_url": success_url,
                },
            )
            response.raise_for_status()
            return response.json()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def cancel_subscription(self, subscription_id: str) -> None:
        async with await self._client() as client:
            response = await client.post(
                f"subscriptions/{subscription_id}/cancel",
                json={"cancel_at_end": True},
            )
            response.raise_for_status()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def get_subscription_status(self, subscription_id: str) -> dict:
        async with await self._client() as client:
            response = await client.get(f"subscriptions/{subscription_id}")
            response.raise_for_status()
            data = response.json()
            sub = data.get("subscription", {})
            return {
                "zoho_status": sub.get("status"),
                "current_term_starts_at": sub.get("current_term_starts_at"),
                "current_term_ends_at": sub.get("current_term_ends_at"),
                "next_billing_at": sub.get("next_billing_at"),
                "amount": sub.get("amount"),
                "currency_code": sub.get("currency_code"),
            }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def change_plan(self, subscription_id: str, plan_id: str) -> None:
        if plan_id not in PLAN_CONFIGS:
            raise ValueError(f"Unknown plan: {plan_id}")
        zoho_plan_code = PLAN_CONFIGS[plan_id].get("zoho_plan_code", plan_id)
        async with await self._client() as client:
            response = await client.post(
                f"subscriptions/{subscription_id}/plan",
                json={"plan": {"plan_code": zoho_plan_code, "quantity": 1}},
            )
            response.raise_for_status()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def list_invoices(self, customer_id: str) -> list[dict]:
        async with await self._client() as client:
            response = await client.get(
                "invoices", params={"customer_id": customer_id, "sort_column": "created_time"}
            )
            response.raise_for_status()
            data = response.json()
            invoices = data.get("invoices", [])
            return [
                {
                    "invoice_id": inv.get("invoice_id"),
                    "invoice_number": inv.get("invoice_number"),
                    "status": inv.get("status"),
                    "amount": inv.get("total"),
                    "currency_code": inv.get("currency_code"),
                    "date": inv.get("date"),
                    "due_date": inv.get("due_date"),
                    "payment_made": inv.get("payment_made"),
                    "balance": inv.get("balance"),
                    "invoice_url": inv.get("invoice_url"),
                }
                for inv in invoices
            ]

    async def handle_webhook(self, payload: dict, signature: str, db: Any) -> None:
        """Process Zoho Subscriptions webhook events to update org subscription state."""
        from sqlalchemy import select
        from app.models.organization import Organization

        event_type = payload.get("event_type", "")
        subscription = payload.get("data", {}).get("subscription", {})
        zoho_subscription_id = subscription.get("subscription_id")

        if not zoho_subscription_id:
            logger.warning("Zoho webhook missing subscription_id: %s", payload)
            return

        result = await db.execute(
            select(Organization).where(
                Organization.zoho_subscription_id == zoho_subscription_id
            )
        )
        org = result.scalar_one_or_none()
        if org is None:
            logger.warning(
                "Zoho webhook: no org found for subscription_id %s", zoho_subscription_id
            )
            return

        status_map = {
            "subscription_activated": ("active", None),
            "subscription_renewed": ("active", None),
            "subscription_cancelled": ("cancelled", "free"),
            "subscription_expired": ("expired", "free"),
            "payment_failed": ("past_due", None),
            "payment_succeeded": ("active", None),
        }

        if event_type in status_map:
            new_status, new_plan = status_map[event_type]
            org.subscription_status = new_status
            if new_plan:
                org.plan_type = new_plan
            await db.commit()
            logger.info(
                "Org %s subscription updated via webhook: event=%s status=%s",
                org.id,
                event_type,
                new_status,
            )
        else:
            logger.debug("Unhandled Zoho webhook event: %s", event_type)
