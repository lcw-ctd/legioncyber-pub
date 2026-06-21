"""Integration manager: provider-specific sync logic for all third-party integrations."""
import json
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class IntegrationManager:
    async def sync(self, integration: Any, config: dict) -> dict:
        """Dispatch to the correct sync handler based on provider."""
        provider = integration.provider
        handler = {
            "vanta": self.sync_vanta,
            "cloudflare": self.sync_cloudflare,
            "akamai": self.sync_akamai,
            "imperva": self.sync_imperva,
            "webhook": self._noop_sync,
            "slack": self._noop_sync,
            "jira": self._noop_sync,
            "pagerduty": self._noop_sync,
        }.get(provider)

        if handler is None:
            raise ValueError(f"No sync handler for provider: {provider}")
        return await handler(integration, config)

    async def sync_vanta(self, integration: Any, config: dict) -> dict:
        """Push open findings to Vanta as vulnerability evidence."""
        api_key = config.get("api_key") or settings.VANTA_API_KEY
        if not api_key:
            raise ValueError("Vanta API key not configured")

        from app.database import AsyncSessionLocal
        from app.models.finding import Finding
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Finding).where(
                    Finding.org_id == integration.org_id,
                    Finding.status == "open",
                    Finding.severity.in_(["critical", "high", "medium"]),
                )
            )
            findings = result.scalars().all()

        vulnerabilities = [
            {
                "externalId": str(f.id),
                "title": f.title,
                "severity": f.severity.upper(),
                "description": f.description or f.title,
                "affectedUrl": f.affected_url,
                "status": "OPEN",
                "firstDetectedAt": f.first_seen.isoformat(),
                "remediationSteps": f.remediation or "See finding details for remediation guidance.",
            }
            for f in findings
        ]

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.vanta.com/v1/vulnerability_reports",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"vulnerabilities": vulnerabilities},
            )
            response.raise_for_status()

        return {"synced_count": len(vulnerabilities), "provider": "vanta"}

    async def sync_cloudflare(self, integration: Any, config: dict) -> dict:
        """Fetch active Cloudflare WAF rules to correlate with findings."""
        api_token = config.get("api_token") or settings.CLOUDFLARE_API_KEY
        zone_id = config.get("zone_id", "")
        if not api_token:
            raise ValueError("Cloudflare API token not configured")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/rules",
                headers={
                    "Authorization": f"Bearer {api_token}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()

        rules = data.get("result", [])
        active_rule_ids = [r["id"] for r in rules if r.get("paused") is False]

        return {
            "provider": "cloudflare",
            "zone_id": zone_id,
            "total_rules": len(rules),
            "active_rules": len(active_rule_ids),
        }

    async def sync_akamai(self, integration: Any, config: dict) -> dict:
        """Fetch Akamai security configuration status."""
        client_token = config.get("client_token", "")
        client_secret = config.get("client_secret", "")
        access_token = config.get("access_token", "")
        base_url = config.get("base_url", "")

        if not all([client_token, client_secret, access_token, base_url]):
            raise ValueError("Akamai credentials not fully configured (need client_token, client_secret, access_token, base_url)")

        # Akamai uses EdgeGrid authentication — this is a simplified placeholder
        # In production use the akamai-edgegrid Python SDK
        return {
            "provider": "akamai",
            "status": "credentials_configured",
            "message": "Use akamai-edgegrid SDK for full integration",
        }

    async def sync_imperva(self, integration: Any, config: dict) -> dict:
        """Fetch Imperva WAF site protection status."""
        api_id = config.get("api_id", "")
        api_key = config.get("api_key") or settings.IMPERVA_API_KEY

        if not api_key:
            raise ValueError("Imperva API key not configured")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://my.imperva.com/api/prov/v1/sites/list",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={"api_id": api_id, "api_key": api_key},
            )
            response.raise_for_status()
            data = response.json()

        sites = data.get("sites", [])
        return {
            "provider": "imperva",
            "site_count": len(sites),
            "sites": [{"id": s.get("site_id"), "domain": s.get("domain")} for s in sites],
        }

    async def notify_webhook(
        self, integration: Any, event_type: str, payload: dict
    ) -> bool:
        """Send an HTTP POST to a configured webhook URL."""
        from app.core.security import decrypt_data

        try:
            config = decrypt_data(integration.config)
            if not isinstance(config, dict):
                return False
        except Exception:
            return False

        url = config.get("url", "")
        secret = config.get("secret", "")
        if not url:
            return False

        headers = {"Content-Type": "application/json", "X-Event-Type": event_type}
        if secret:
            import hashlib
            import hmac
            body = json.dumps(payload).encode()
            sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={sig}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
            return True
        except httpx.RequestError as exc:
            logger.warning("Webhook delivery failed to %s: %s", url, exc)
            return False

    async def notify_slack(self, integration: Any, finding: Any) -> bool:
        """Post a Slack message for a new critical/high finding."""
        from app.core.security import decrypt_data

        try:
            config = decrypt_data(integration.config)
            if not isinstance(config, dict):
                return False
        except Exception:
            return False

        webhook_url = config.get("webhook_url", "")
        channel = config.get("channel", "#security")
        if not webhook_url:
            return False

        severity_emoji = {
            "critical": ":rotating_light:",
            "high": ":warning:",
            "medium": ":large_yellow_circle:",
            "low": ":large_green_circle:",
            "info": ":information_source:",
        }
        emoji = severity_emoji.get(finding.severity, ":white_circle:")

        message = {
            "channel": channel,
            "text": f"{emoji} *New {finding.severity.upper()} Security Finding*",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{emoji} {finding.severity.upper()} Finding Detected",
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Title:*\n{finding.title}"},
                        {"type": "mrkdwn", "text": f"*Severity:*\n{finding.severity.title()}"},
                        {"type": "mrkdwn", "text": f"*Affected URL:*\n{finding.affected_url}"},
                        {
                            "type": "mrkdwn",
                            "text": f"*OWASP Category:*\n{finding.owasp_category or 'N/A'}",
                        },
                    ],
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Remediation:*\n{finding.remediation or 'See the security dashboard for remediation guidance.'}",
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "View Finding"},
                            "url": f"{settings.FRONTEND_URL}/findings/{finding.id}",
                            "style": "danger" if finding.severity in ("critical", "high") else "primary",
                        }
                    ],
                },
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(webhook_url, json=message)
                response.raise_for_status()
            return True
        except httpx.RequestError as exc:
            logger.warning("Slack notification failed: %s", exc)
            return False

    async def create_jira_ticket(self, integration: Any, finding: Any) -> Optional[str]:
        """Create a Jira issue for a finding and return the issue key."""
        from app.core.security import decrypt_data

        try:
            config = decrypt_data(integration.config)
            if not isinstance(config, dict):
                return None
        except Exception:
            return None

        jira_url = config.get("url", "").rstrip("/")
        project_key = config.get("project_key", "")
        email = config.get("email", "")
        api_token = config.get("api_token", "")

        if not all([jira_url, project_key, email, api_token]):
            logger.warning("Jira integration not fully configured")
            return None

        severity_priority = {
            "critical": "Highest",
            "high": "High",
            "medium": "Medium",
            "low": "Low",
            "info": "Lowest",
        }
        priority = severity_priority.get(finding.severity, "Medium")

        issue_body = {
            "fields": {
                "project": {"key": project_key},
                "summary": f"[Security] {finding.severity.upper()}: {finding.title}",
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": (
                                        f"Security finding detected by nuclei scanner.\n\n"
                                        f"Affected URL: {finding.affected_url}\n"
                                        f"OWASP Category: {finding.owasp_category or 'N/A'}\n"
                                        f"CWE IDs: {', '.join(finding.cwe_ids or [])}\n\n"
                                        f"Description:\n{finding.description or 'No description available.'}\n\n"
                                        f"Remediation:\n{finding.remediation or 'See security dashboard.'}"
                                    ),
                                }
                            ],
                        }
                    ],
                },
                "issuetype": {"name": "Bug"},
                "priority": {"name": priority},
                "labels": ["security", "scanner", finding.severity],
            }
        }

        try:
            import base64
            credentials = base64.b64encode(f"{email}:{api_token}".encode()).decode()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{jira_url}/rest/api/3/issue",
                    headers={
                        "Authorization": f"Basic {credentials}",
                        "Content-Type": "application/json",
                    },
                    json=issue_body,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("key")
        except httpx.RequestError as exc:
            logger.warning("Jira ticket creation failed: %s", exc)
            return None

    async def notify_pagerduty(self, integration: Any, finding: Any) -> bool:
        """Trigger a PagerDuty event for a critical finding."""
        from app.core.security import decrypt_data

        try:
            config = decrypt_data(integration.config)
            if not isinstance(config, dict):
                return False
        except Exception:
            return False

        routing_key = config.get("routing_key", "")
        if not routing_key:
            return False

        severity_map = {
            "critical": "critical",
            "high": "error",
            "medium": "warning",
            "low": "info",
            "info": "info",
        }

        payload = {
            "routing_key": routing_key,
            "event_action": "trigger",
            "dedup_key": f"scanner-finding-{finding.id}",
            "payload": {
                "summary": f"{finding.severity.upper()} Security Finding: {finding.title}",
                "severity": severity_map.get(finding.severity, "error"),
                "source": finding.affected_url,
                "custom_details": {
                    "finding_id": str(finding.id),
                    "owasp_category": finding.owasp_category,
                    "cvss_score": finding.cvss_score,
                    "remediation": finding.remediation,
                    "dashboard_url": f"{settings.FRONTEND_URL}/findings/{finding.id}",
                },
            },
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    "https://events.pagerduty.com/v2/enqueue",
                    json=payload,
                )
                response.raise_for_status()
            return True
        except httpx.RequestError as exc:
            logger.warning("PagerDuty notification failed: %s", exc)
            return False

    async def _noop_sync(self, integration: Any, config: dict) -> dict:
        return {"provider": integration.provider, "status": "no_sync_action"}


from typing import Optional
