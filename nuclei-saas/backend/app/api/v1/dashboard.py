from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy import case, func, select

from app.core.dependencies import CurrentOrgDep, DBDep
from app.models.finding import Finding
from app.models.scan import Scan

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(
    current_org: CurrentOrgDep,
    db: DBDep,
    days: int = Query(30, ge=1, le=365),
) -> dict:
    """Overall org security posture with counts, recent findings, scan activity, and trend data."""
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)

    # Open findings by severity
    severity_result = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .where(Finding.org_id == current_org.id, Finding.status == "open")
        .group_by(Finding.severity)
    )
    open_by_severity = {row[0]: row[1] for row in severity_result.all()}

    # All findings by status
    status_result = await db.execute(
        select(Finding.status, func.count(Finding.id))
        .where(Finding.org_id == current_org.id)
        .group_by(Finding.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}

    # Scan counts in window
    scan_count_result = await db.execute(
        select(Scan.status, func.count(Scan.id))
        .where(Scan.org_id == current_org.id, Scan.created_at >= cutoff)
        .group_by(Scan.status)
    )
    scans_by_status = {row[0]: row[1] for row in scan_count_result.all()}

    # Recent findings (last 10 critical/high)
    recent_result = await db.execute(
        select(Finding)
        .where(
            Finding.org_id == current_org.id,
            Finding.severity.in_(["critical", "high"]),
            Finding.status == "open",
        )
        .order_by(Finding.first_seen.desc())
        .limit(10)
    )
    recent_findings = [
        {
            "id": str(f.id),
            "title": f.title,
            "severity": f.severity,
            "affected_url": f.affected_url,
            "owasp_category": f.owasp_category,
            "first_seen": f.first_seen.isoformat(),
        }
        for f in recent_result.scalars().all()
    ]

    # Weekly trend: new findings per week over the past `days`
    trend_data = []
    for i in range(min(days // 7, 12), -1, -1):
        week_start = datetime.now(tz=timezone.utc) - timedelta(weeks=i + 1)
        week_end = datetime.now(tz=timezone.utc) - timedelta(weeks=i)
        count_result = await db.execute(
            select(func.count(Finding.id)).where(
                Finding.org_id == current_org.id,
                Finding.first_seen >= week_start,
                Finding.first_seen < week_end,
            )
        )
        trend_data.append(
            {
                "week_start": week_start.date().isoformat(),
                "new_findings": count_result.scalar_one(),
            }
        )

    # Risk score: weighted sum (critical=10, high=5, medium=2, low=1)
    weights = {"critical": 10, "high": 5, "medium": 2, "low": 1, "info": 0}
    risk_score = sum(
        open_by_severity.get(sev, 0) * w for sev, w in weights.items()
    )
    # Normalize to 0-100 (cap at 1000 raw points = 100%)
    normalized_risk = min(100, int(risk_score / 10))

    total_open = sum(open_by_severity.values())
    total_resolved = by_status.get("resolved", 0) + by_status.get("false_positive", 0)

    return {
        "period_days": days,
        "risk_score": normalized_risk,
        "open_findings": {
            "total": total_open,
            "by_severity": open_by_severity,
        },
        "findings_by_status": by_status,
        "scans": {
            "total": sum(scans_by_status.values()),
            "by_status": scans_by_status,
        },
        "recent_critical_high": recent_findings,
        "trend": trend_data,
        "remediation_rate": (
            round(total_resolved / max(total_resolved + total_open, 1) * 100, 1)
        ),
    }


@router.get("/business-impact")
async def get_business_impact(
    current_org: CurrentOrgDep,
    db: DBDep,
) -> dict:
    """Open findings grouped by business impact level."""
    result = await db.execute(
        select(
            Finding.business_impact,
            Finding.severity,
            func.count(Finding.id),
        )
        .where(Finding.org_id == current_org.id, Finding.status == "open")
        .group_by(Finding.business_impact, Finding.severity)
        .order_by(Finding.business_impact, Finding.severity)
    )
    rows = result.all()

    grouped: dict[str, dict] = {}
    for impact, severity, count in rows:
        impact_key = impact or "unknown"
        if impact_key not in grouped:
            grouped[impact_key] = {"total": 0, "by_severity": {}}
        grouped[impact_key]["by_severity"][severity] = count
        grouped[impact_key]["total"] += count

    # Top affected URLs
    url_result = await db.execute(
        select(Finding.affected_url, func.count(Finding.id).label("count"))
        .where(
            Finding.org_id == current_org.id,
            Finding.status == "open",
            Finding.business_impact.in_(["critical", "high"]),
        )
        .group_by(Finding.affected_url)
        .order_by(func.count(Finding.id).desc())
        .limit(10)
    )
    top_urls = [
        {"url": row[0], "finding_count": row[1]} for row in url_result.all()
    ]

    return {
        "by_business_impact": grouped,
        "top_affected_assets": top_urls,
    }


@router.get("/compliance-posture")
async def get_compliance_posture(
    current_org: CurrentOrgDep,
    db: DBDep,
) -> dict:
    """Compliance status across selected frameworks for the org."""
    from app.models.compliance import ComplianceProfile
    from app.services.compliance import ComplianceService

    result = await db.execute(
        select(ComplianceProfile)
        .where(ComplianceProfile.org_id == current_org.id)
        .order_by(ComplianceProfile.created_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()

    if profile is None or not profile.frameworks:
        return {
            "configured": False,
            "message": "No compliance profile configured",
            "frameworks": [],
        }

    service = ComplianceService()
    framework_postures = []
    for framework in profile.frameworks:
        score = await service.get_compliance_score(current_org.id, framework, db)
        gaps = await service.get_compliance_gaps(current_org.id, [framework], db)
        framework_postures.append(
            {
                "framework": framework,
                "score": score,
                "gap_count": len(gaps.get(framework, [])),
                "status": "passing" if score >= 80 else ("at_risk" if score >= 60 else "failing"),
            }
        )

    overall_score = (
        sum(f["score"] for f in framework_postures) / len(framework_postures)
        if framework_postures
        else 0
    )

    return {
        "configured": True,
        "profile_name": profile.name,
        "overall_score": round(overall_score, 1),
        "frameworks": framework_postures,
        "risk_tolerance": profile.risk_tolerance,
    }
