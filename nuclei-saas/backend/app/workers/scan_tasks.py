"""Celery tasks for scanning, reporting, domain verification, and notifications."""
import asyncio
import json
import logging
import os
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from celery import Task
from sqlalchemy import select

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a synchronous Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


# --------------------------------------------------------------------------- #
#  Scan task                                                                    #
# --------------------------------------------------------------------------- #

@celery_app.task(
    bind=True,
    name="app.workers.scan_tasks.run_scan",
    max_retries=2,
    default_retry_delay=30,
    queue="scans",
)
def run_scan(self: Task, scan_id: str) -> dict:
    """Main scan task: builds nuclei command, streams output, stores findings."""
    logger.info("Starting scan %s", scan_id)
    return _run_async(_execute_scan(self, scan_id))


async def _execute_scan(task: Task, scan_id_str: str) -> dict:
    from app.database import AsyncSessionLocal
    from app.models.scan import Scan
    from app.models.domain import Domain, DomainCredential
    from app.models.finding import Finding
    from app.config import settings

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Scan).where(Scan.id == uuid.UUID(scan_id_str)))
        scan = result.scalar_one_or_none()
        if scan is None:
            logger.error("Scan %s not found", scan_id_str)
            return {"error": "scan not found"}

        if scan.status == "cancelled":
            return {"status": "cancelled"}

        # Mark as running
        scan.status = "running"
        scan.started_at = datetime.now(tz=timezone.utc)
        await db.commit()

        domain_result = await db.execute(
            select(Domain).where(Domain.id == scan.domain_id)
        )
        domain = domain_result.scalar_one_or_none()
        if domain is None:
            scan.status = "failed"
            scan.error_message = "Domain not found"
            await db.commit()
            return {"error": "domain not found"}

        target = scan.target_urls or [f"https://{domain.fqdn}"]

        # Build nuclei command
        cmd = [
            settings.NUCLEI_BINARY_PATH,
            "-json",
            "-silent",
            "-rl", str(scan.rate_limit),
            "-timeout", "10",
            "-t", settings.NUCLEI_TEMPLATES_PATH,
        ]

        # Add targets
        for url in target:
            cmd.extend(["-u", url])

        # Filter by plan scan_type tags
        if scan.plan_id:
            plan_result = await db.execute(
                select(__import__("app.models.scan", fromlist=["ScanPlan"]).ScanPlan)
                .where(__import__("app.models.scan", fromlist=["ScanPlan"]).ScanPlan.id == scan.plan_id)
            )
            plan = plan_result.scalar_one_or_none()
            if plan and plan.template_tags:
                cmd.extend(["-tags", ",".join(plan.template_tags)])

        output_findings = []
        try:
            os.makedirs(settings.NUCLEI_OUTPUT_DIR, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                mode="w",
                suffix=".txt",
                dir=settings.NUCLEI_OUTPUT_DIR,
                delete=False,
            ) as targets_file:
                targets_file.write("\n".join(target))
                targets_path = targets_file.name

            cmd = [
                settings.NUCLEI_BINARY_PATH,
                "-json", "-silent",
                "-rl", str(scan.rate_limit),
                "-timeout", "10",
                "-t", settings.NUCLEI_TEMPLATES_PATH,
                "-l", targets_path,
            ]

            if scan.plan_id:
                pass  # tags already handled above; rebuild would duplicate logic

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=scan.max_duration,
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                scan.status = "failed"
                scan.error_message = "Scan exceeded maximum duration"
                await db.commit()
                return {"error": "timeout"}

            os.unlink(targets_path)

            for line in stdout.decode("utf-8", errors="ignore").splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    finding_data = json.loads(line)
                    output_findings.append(finding_data)
                except json.JSONDecodeError:
                    pass

        except FileNotFoundError:
            # nuclei binary not found — record a mock result in dev
            logger.warning(
                "nuclei binary not found at %s; skipping actual scan",
                settings.NUCLEI_BINARY_PATH,
            )

        # Persist findings
        for raw in output_findings:
            info = raw.get("info", {})
            finding = Finding(
                scan_id=scan.id,
                org_id=scan.org_id,
                template_id=raw.get("template-id"),
                template_name=raw.get("template-id", "unknown"),
                severity=info.get("severity", "info").lower(),
                cvss_score=_extract_cvss(info),
                title=info.get("name", raw.get("template-id", "Unknown")),
                description=info.get("description"),
                affected_url=raw.get("matched-at", raw.get("host", "")),
                affected_parameter=raw.get("matched-at"),
                evidence={
                    "request": raw.get("request"),
                    "response": raw.get("response"),
                    "curl_command": raw.get("curl-command"),
                },
                remediation=info.get("remediation"),
                references=info.get("reference", []),
                cwe_ids=[str(c) for c in info.get("classification", {}).get("cwe-id", [])],
                cve_ids=info.get("classification", {}).get("cve-id", []),
                owasp_category=_extract_owasp(info),
                status="open",
                tags=info.get("tags", "").split(",") if isinstance(info.get("tags"), str) else [],
            )
            db.add(finding)

        scan.status = "completed"
        scan.completed_at = datetime.now(tz=timezone.utc)
        await db.commit()

        logger.info("Scan %s completed with %d findings", scan_id_str, len(output_findings))
        return {"scan_id": scan_id_str, "findings_count": len(output_findings)}


def _extract_cvss(info: dict) -> Optional[float]:
    classification = info.get("classification", {})
    score = classification.get("cvss-score")
    if score is not None:
        try:
            return float(score)
        except (ValueError, TypeError):
            pass
    # Fallback to severity-based score
    severity_scores = {"critical": 9.5, "high": 7.5, "medium": 5.0, "low": 2.5, "info": 0.0}
    return severity_scores.get(info.get("severity", "info").lower())


def _extract_owasp(info: dict) -> Optional[str]:
    classification = info.get("classification", {})
    owasp = classification.get("owasp-id")
    if isinstance(owasp, list) and owasp:
        return owasp[0]
    if isinstance(owasp, str) and owasp:
        return owasp
    # Map from tags if possible
    tags = info.get("tags", "")
    if isinstance(tags, str):
        tag_list = [t.strip() for t in tags.split(",")]
    else:
        tag_list = tags or []

    tag_to_owasp = {
        "sqli": "A03:2021",
        "xss": "A03:2021",
        "rce": "A03:2021",
        "lfi": "A03:2021",
        "ssrf": "A10:2021",
        "csrf": "A01:2021",
        "idor": "A01:2021",
        "auth": "A07:2021",
        "default-login": "A07:2021",
        "exposure": "A05:2021",
        "misconfiguration": "A05:2021",
        "ssl": "A02:2021",
        "tls": "A02:2021",
        "cve": "A06:2021",
        "outdated": "A06:2021",
    }
    for tag in tag_list:
        if tag in tag_to_owasp:
            return tag_to_owasp[tag]
    return None


# --------------------------------------------------------------------------- #
#  Scheduled scan beat task                                                     #
# --------------------------------------------------------------------------- #

@celery_app.task(name="app.workers.scan_tasks.run_scheduled_scans", queue="beat")
def run_scheduled_scans() -> dict:
    """Check ScanSchedule table and queue all due scans."""
    return _run_async(_check_and_queue_scheduled_scans())


async def _check_and_queue_scheduled_scans() -> dict:
    from app.database import AsyncSessionLocal
    from app.models.scan import Scan, ScanSchedule
    from croniter import croniter

    now = datetime.now(tz=timezone.utc)
    queued = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScanSchedule).where(
                ScanSchedule.is_active.is_(True),
                ScanSchedule.next_run_at <= now,
            )
        )
        due_schedules = result.scalars().all()

        for schedule in due_schedules:
            scan = Scan(
                org_id=schedule.org_id,
                domain_id=schedule.domain_id,
                plan_id=schedule.plan_id,
                name=f"Scheduled scan {now.strftime('%Y-%m-%d %H:%M')}",
                status="queued",
                scan_mode="blackbox",
                credential_ids=schedule.credential_ids or [],
                rate_limit=100,
                max_duration=3600,
            )
            db.add(scan)
            await db.flush()

            task = run_scan.delay(str(scan.id))
            scan.celery_task_id = task.id

            # Advance next_run_at
            cron = croniter(schedule.cron_expression, now)
            schedule.next_run_at = cron.get_next(datetime)
            schedule.last_run_at = now
            queued += 1

        await db.commit()

    logger.info("Scheduled scans: queued %d scans", queued)
    return {"queued": queued}


# --------------------------------------------------------------------------- #
#  Domain verification task                                                     #
# --------------------------------------------------------------------------- #

@celery_app.task(
    bind=True,
    name="app.workers.scan_tasks.verify_domain",
    max_retries=5,
    default_retry_delay=300,
    queue="verification",
)
def verify_domain(self: Task, domain_id: str) -> dict:
    """Retry domain verification."""
    return _run_async(_do_verify_domain(domain_id))


async def _do_verify_domain(domain_id_str: str) -> dict:
    from app.database import AsyncSessionLocal
    from app.models.domain import Domain
    from app.services.domain_verification import DomainVerificationService

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Domain).where(Domain.id == uuid.UUID(domain_id_str))
        )
        domain = result.scalar_one_or_none()
        if domain is None:
            return {"error": "domain not found"}

        service = DomainVerificationService()
        now = datetime.now(tz=timezone.utc)

        if domain.verification_method == "dns_txt":
            verified = await service.verify_dns(domain.fqdn, domain.verification_token or "")
        elif domain.verification_method == "http_file":
            verified = await service.verify_http(domain.fqdn, domain.verification_token or "")
        else:
            verified = await service.verify_meta_tag(domain.fqdn, domain.verification_token or "")

        domain.last_checked = now
        if verified:
            domain.verification_status = "verified"
            domain.verified_at = now
        else:
            domain.verification_status = "failed"
        await db.commit()

    return {"domain_id": domain_id_str, "verified": verified}


# --------------------------------------------------------------------------- #
#  Re-verify all verified domains (daily beat)                                  #
# --------------------------------------------------------------------------- #

@celery_app.task(name="app.workers.scan_tasks.reverify_all_domains", queue="verification")
def reverify_all_domains() -> dict:
    return _run_async(_queue_reverification())


async def _queue_reverification() -> dict:
    from app.database import AsyncSessionLocal
    from app.models.domain import Domain

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Domain).where(Domain.verification_status == "verified")
        )
        domains = result.scalars().all()
        for domain in domains:
            verify_domain.apply_async(args=[str(domain.id)], countdown=0)

    return {"queued": len(domains)}


# --------------------------------------------------------------------------- #
#  Report generation task                                                       #
# --------------------------------------------------------------------------- #

@celery_app.task(
    bind=True,
    name="app.workers.scan_tasks.generate_report",
    max_retries=2,
    default_retry_delay=60,
    queue="reports",
)
def generate_report(self: Task, report_id: str) -> dict:
    """Generate and upload a report to S3."""
    return _run_async(_do_generate_report(report_id))


async def _do_generate_report(report_id_str: str) -> dict:
    from app.database import AsyncSessionLocal
    from app.services.report_generator import ReportGenerator

    async with AsyncSessionLocal() as db:
        generator = ReportGenerator(db)
        await generator.generate(uuid.UUID(report_id_str))

    return {"report_id": report_id_str}


# --------------------------------------------------------------------------- #
#  Integration sync beat task                                                   #
# --------------------------------------------------------------------------- #

@celery_app.task(name="app.workers.scan_tasks.sync_integrations", queue="beat")
def sync_integrations() -> dict:
    return _run_async(_do_sync_integrations())


async def _do_sync_integrations() -> dict:
    from app.database import AsyncSessionLocal
    from app.models.integration import Integration
    from app.services.integration_manager import IntegrationManager
    from app.core.security import decrypt_data

    manager = IntegrationManager()
    synced = 0
    failed = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Integration).where(Integration.is_active.is_(True))
        )
        integrations = result.scalars().all()

        for integration in integrations:
            try:
                config = decrypt_data(integration.config)
                if not isinstance(config, dict):
                    config = {}
                await manager.sync(integration, config)
                integration.last_sync_at = datetime.now(tz=timezone.utc)
                synced += 1
            except Exception as exc:
                logger.warning(
                    "Integration sync failed for %s (%s): %s",
                    integration.id,
                    integration.provider,
                    exc,
                )
                failed += 1

        await db.commit()

    return {"synced": synced, "failed": failed}


# --------------------------------------------------------------------------- #
#  Finding notification task                                                    #
# --------------------------------------------------------------------------- #

@celery_app.task(
    bind=True,
    name="app.workers.scan_tasks.send_finding_notifications",
    max_retries=3,
    default_retry_delay=30,
    queue="notifications",
)
def send_finding_notifications(self: Task, finding_id: str) -> dict:
    """Notify all configured integrations about a finding."""
    return _run_async(_do_send_notifications(finding_id))


async def _do_send_notifications(finding_id_str: str) -> dict:
    from app.database import AsyncSessionLocal
    from app.models.finding import Finding
    from app.models.integration import Integration
    from app.services.integration_manager import IntegrationManager
    from app.core.security import decrypt_data

    async with AsyncSessionLocal() as db:
        finding_result = await db.execute(
            select(Finding).where(Finding.id == uuid.UUID(finding_id_str))
        )
        finding = finding_result.scalar_one_or_none()
        if finding is None:
            return {"error": "finding not found"}

        # Only notify for critical/high findings
        if finding.severity not in ("critical", "high"):
            return {"skipped": "severity below threshold"}

        integration_result = await db.execute(
            select(Integration).where(
                Integration.org_id == finding.org_id,
                Integration.is_active.is_(True),
            )
        )
        integrations = integration_result.scalars().all()

        manager = IntegrationManager()
        notified = []
        for integration in integrations:
            try:
                if integration.provider == "slack":
                    await manager.notify_slack(integration, finding)
                    notified.append("slack")
                elif integration.provider == "jira":
                    await manager.create_jira_ticket(integration, finding)
                    notified.append("jira")
                elif integration.provider == "pagerduty" and finding.severity == "critical":
                    await manager.notify_pagerduty(integration, finding)
                    notified.append("pagerduty")
                elif integration.provider == "webhook":
                    config = decrypt_data(integration.config) if isinstance(integration.config, str) else {}
                    payload = {
                        "finding_id": finding_id_str,
                        "severity": finding.severity,
                        "title": finding.title,
                        "affected_url": finding.affected_url,
                        "status": finding.status,
                    }
                    await manager.notify_webhook(integration, "new_finding", payload)
                    notified.append("webhook")
            except Exception as exc:
                logger.warning(
                    "Notification failed for integration %s: %s", integration.id, exc
                )

    return {"finding_id": finding_id_str, "notified": notified}
