"""Report generation service using Jinja2 + WeasyPrint for PDF output."""
import io
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import boto3
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

# Path to Jinja2 HTML templates (relative to project root)
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")


def _get_jinja_env() -> Environment:
    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )
    return env


class ReportGenerator:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate(
        self,
        report_id: uuid.UUID,
    ) -> None:
        """Main entry point called by the Celery task. Updates the Report record when done."""
        from app.models.report import Report

        result = await self.db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if report is None:
            logger.error("Report %s not found", report_id)
            return

        try:
            if report.format == "pdf":
                content_bytes, content_type = await self._render_pdf(report)
            elif report.format == "html":
                html = await self._render_html(report)
                content_bytes = html.encode("utf-8")
                content_type = "text/html"
            else:
                data = await self._build_json_data(report)
                content_bytes = json.dumps(data, default=str, indent=2).encode("utf-8")
                content_type = "application/json"

            s3_key = await self._upload_to_s3(
                content_bytes, content_type, report.org_id, report.id, report.format
            )
            report.s3_key = s3_key
            report.status = "ready"
            report.generated_at = datetime.now(tz=timezone.utc)
        except Exception as exc:
            logger.exception("Report generation failed for %s: %s", report_id, exc)
            report.status = "failed"
            report.error_message = str(exc)

        await self.db.commit()

    async def _render_html(self, report: Any) -> str:
        """Render the appropriate HTML template based on report_type."""
        data = await self._build_json_data(report)
        env = _get_jinja_env()

        template_map = {
            "executive": "executive_report.html",
            "technical": "technical_report.html",
            "compliance": "compliance_report.html",
            "remediation": "remediation_report.html",
        }
        template_name = template_map.get(report.report_type, "executive_report.html")

        # Fallback: use inline template if file doesn't exist
        try:
            template = env.get_template(template_name)
            return template.render(**data)
        except Exception:
            return self._inline_html_report(data, report.report_type)

    async def _render_pdf(self, report: Any) -> tuple[bytes, str]:
        """Render the report as a PDF via WeasyPrint."""
        try:
            from weasyprint import HTML  # type: ignore
        except ImportError as exc:
            raise RuntimeError("WeasyPrint is not installed") from exc

        html_content = await self._render_html(report)
        pdf_bytes = HTML(string=html_content, base_url=settings.FRONTEND_URL).write_pdf()
        return pdf_bytes, "application/pdf"

    async def _build_json_data(self, report: Any) -> dict:
        """Collect all data needed to render the report."""
        from app.models.finding import Finding
        from app.models.organization import Organization
        from app.models.scan import Scan

        org_result = await self.db.execute(
            select(Organization).where(Organization.id == report.org_id)
        )
        org = org_result.scalar_one_or_none()

        scan = None
        if report.scan_id:
            scan_result = await self.db.execute(
                select(Scan).where(Scan.id == report.scan_id)
            )
            scan = scan_result.scalar_one_or_none()

        # Determine which scans to include
        if scan:
            scan_ids = [scan.id]
        else:
            scan_id_result = await self.db.execute(
                select(Scan.id).where(Scan.org_id == report.org_id)
            )
            scan_ids = [row[0] for row in scan_id_result.all()]

        findings_result = await self.db.execute(
            select(Finding)
            .where(Finding.org_id == report.org_id, Finding.scan_id.in_(scan_ids))
            .order_by(Finding.severity, Finding.first_seen.desc())
        )
        findings = findings_result.scalars().all()

        severity_counts: dict[str, int] = {}
        status_counts: dict[str, int] = {}
        owasp_counts: dict[str, int] = {}
        for f in findings:
            severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1
            status_counts[f.status] = status_counts.get(f.status, 0) + 1
            if f.owasp_category:
                owasp_counts[f.owasp_category] = owasp_counts.get(f.owasp_category, 0) + 1

        top_risks = [
            {
                "id": str(f.id),
                "title": f.title,
                "severity": f.severity,
                "cvss_score": f.cvss_score,
                "affected_url": f.affected_url,
                "owasp_category": f.owasp_category,
                "remediation": f.remediation,
            }
            for f in findings
            if f.severity in ("critical", "high") and f.status == "open"
        ][:20]

        compliance_data = {}
        if report.compliance_profile_id:
            from app.services.compliance import ComplianceService
            from app.models.compliance import ComplianceProfile

            profile_result = await self.db.execute(
                select(ComplianceProfile).where(
                    ComplianceProfile.id == report.compliance_profile_id
                )
            )
            profile = profile_result.scalar_one_or_none()
            if profile and profile.frameworks:
                service = ComplianceService()
                for fw in profile.frameworks:
                    score = await service.get_compliance_score(report.org_id, fw, self.db)
                    gaps = await service.get_compliance_gaps(report.org_id, [fw], self.db)
                    compliance_data[fw] = {"score": score, "gaps": gaps.get(fw, [])}

        return {
            "report": {
                "id": str(report.id),
                "name": report.name,
                "type": report.report_type,
                "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            },
            "organization": {
                "id": str(org.id) if org else None,
                "name": org.name if org else "Unknown",
                "plan": org.plan_type if org else None,
            },
            "scan": {
                "id": str(scan.id) if scan else None,
                "name": scan.name if scan else "Multiple Scans",
                "domain_id": str(scan.domain_id) if scan else None,
                "started_at": scan.started_at.isoformat() if scan and scan.started_at else None,
                "completed_at": scan.completed_at.isoformat() if scan and scan.completed_at else None,
            },
            "summary": {
                "total_findings": len(findings),
                "open_findings": status_counts.get("open", 0),
                "by_severity": severity_counts,
                "by_status": status_counts,
                "by_owasp": owasp_counts,
                "risk_score": self._compute_risk_score(severity_counts),
            },
            "top_risks": top_risks,
            "all_findings": [
                {
                    "id": str(f.id),
                    "title": f.title,
                    "severity": f.severity,
                    "cvss_score": f.cvss_score,
                    "affected_url": f.affected_url,
                    "owasp_category": f.owasp_category,
                    "status": f.status,
                    "description": f.description,
                    "remediation": f.remediation,
                    "cwe_ids": f.cwe_ids,
                    "cve_ids": f.cve_ids,
                    "references": f.references,
                    "first_seen": f.first_seen.isoformat(),
                }
                for f in findings
            ],
            "compliance": compliance_data,
        }

    def _compute_risk_score(self, severity_counts: dict) -> int:
        weights = {"critical": 10, "high": 5, "medium": 2, "low": 1, "info": 0}
        raw = sum(severity_counts.get(sev, 0) * w for sev, w in weights.items())
        return min(100, int(raw / 10))

    def _inline_html_report(self, data: dict, report_type: str) -> str:
        """Minimal inline HTML report used when no Jinja2 template file exists."""
        org_name = data["organization"]["name"]
        report_name = data["report"]["name"]
        generated_at = data["report"]["generated_at"]
        total = data["summary"]["total_findings"]
        by_sev = data["summary"]["by_severity"]
        risk_score = data["summary"]["risk_score"]

        sev_rows = "".join(
            f"<tr><td>{sev.title()}</td><td>{count}</td></tr>"
            for sev, count in by_sev.items()
        )

        finding_rows = "".join(
            f"""<tr>
                <td>{f['severity'].upper()}</td>
                <td>{f['title']}</td>
                <td>{f['affected_url']}</td>
                <td>{f.get('owasp_category') or ''}</td>
                <td>{f['status']}</td>
            </tr>"""
            for f in data["all_findings"][:100]
        )

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>{report_name}</title>
<style>
  body {{ font-family: Arial, sans-serif; margin: 40px; color: #222; }}
  h1 {{ color: #1a1a2e; }} h2 {{ color: #16213e; border-bottom: 2px solid #e94560; }}
  table {{ border-collapse: collapse; width: 100%; margin-bottom: 24px; }}
  th, td {{ border: 1px solid #ccc; padding: 8px 12px; text-align: left; }}
  th {{ background: #16213e; color: #fff; }}
  .critical {{ color: #d32f2f; font-weight: bold; }}
  .high {{ color: #f57c00; font-weight: bold; }}
  .medium {{ color: #fbc02d; }}
  .low {{ color: #388e3c; }}
  .risk-score {{ font-size: 3em; font-weight: bold;
    color: {'#d32f2f' if risk_score >= 70 else '#f57c00' if risk_score >= 40 else '#388e3c'};
  }}
</style>
</head>
<body>
<h1>{report_name}</h1>
<p><strong>Organization:</strong> {org_name} &nbsp;|&nbsp;
   <strong>Type:</strong> {report_type.title()} Report &nbsp;|&nbsp;
   <strong>Generated:</strong> {generated_at}</p>

<h2>Executive Summary</h2>
<p>Risk Score: <span class="risk-score">{risk_score}/100</span></p>
<p>Total Findings: <strong>{total}</strong></p>

<h2>Findings by Severity</h2>
<table><thead><tr><th>Severity</th><th>Count</th></tr></thead>
<tbody>{sev_rows}</tbody></table>

<h2>All Findings</h2>
<table>
<thead><tr><th>Severity</th><th>Title</th><th>Affected URL</th><th>OWASP</th><th>Status</th></tr></thead>
<tbody>{finding_rows}</tbody></table>
</body>
</html>"""

    async def _upload_to_s3(
        self,
        content: bytes,
        content_type: str,
        org_id: uuid.UUID,
        report_id: uuid.UUID,
        extension: str,
    ) -> str:
        s3_key = f"reports/{org_id}/{report_id}.{extension}"
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        s3_client.put_object(
            Bucket=settings.S3_BUCKET,
            Key=s3_key,
            Body=content,
            ContentType=content_type,
        )
        return s3_key
