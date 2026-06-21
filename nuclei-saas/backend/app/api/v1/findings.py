import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import case, func, select

from app.core.dependencies import CurrentOrgDep, CurrentUserDep, DBDep
from app.models.finding import Finding, FindingComment

router = APIRouter(prefix="/findings", tags=["findings"])


# ---------- Schemas ----------

class FindingStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class CommentCreate(BaseModel):
    comment: str


class CommentResponse(BaseModel):
    id: uuid.UUID
    finding_id: uuid.UUID
    user_id: uuid.UUID
    comment: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FindingResponse(BaseModel):
    id: uuid.UUID
    scan_id: uuid.UUID
    org_id: uuid.UUID
    template_id: Optional[str]
    template_name: str
    severity: str
    cvss_score: Optional[float]
    title: str
    description: Optional[str]
    affected_url: str
    affected_parameter: Optional[str]
    evidence: Optional[dict]
    remediation: Optional[str]
    references: Optional[list[str]]
    cwe_ids: Optional[list[str]]
    cve_ids: Optional[list[str]]
    owasp_category: Optional[str]
    status: str
    business_impact: Optional[str]
    first_seen: datetime
    last_seen: datetime
    resolved_at: Optional[datetime]
    assigned_to: Optional[uuid.UUID]
    tags: Optional[list[str]]

    model_config = {"from_attributes": True}


VALID_STATUSES = {"open", "in_progress", "resolved", "accepted_risk", "false_positive"}
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


# ---------- Endpoints ----------

@router.get("/stats")
async def get_finding_stats(
    current_org: CurrentOrgDep,
    db: DBDep,
) -> dict:
    """Aggregated findings stats for the dashboard."""
    # Counts by severity
    severity_result = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .where(Finding.org_id == current_org.id, Finding.status == "open")
        .group_by(Finding.severity)
    )
    by_severity = {row[0]: row[1] for row in severity_result.all()}

    # Counts by status
    status_result = await db.execute(
        select(Finding.status, func.count(Finding.id))
        .where(Finding.org_id == current_org.id)
        .group_by(Finding.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}

    # Counts by OWASP category (open findings only)
    owasp_result = await db.execute(
        select(Finding.owasp_category, func.count(Finding.id))
        .where(
            Finding.org_id == current_org.id,
            Finding.status == "open",
            Finding.owasp_category.isnot(None),
        )
        .group_by(Finding.owasp_category)
        .order_by(func.count(Finding.id).desc())
        .limit(10)
    )
    by_owasp = {row[0]: row[1] for row in owasp_result.all()}

    # Total counts
    total_result = await db.execute(
        select(func.count(Finding.id)).where(Finding.org_id == current_org.id)
    )
    total = total_result.scalar_one()

    open_result = await db.execute(
        select(func.count(Finding.id)).where(
            Finding.org_id == current_org.id, Finding.status == "open"
        )
    )
    total_open = open_result.scalar_one()

    return {
        "total": total,
        "total_open": total_open,
        "by_severity": by_severity,
        "by_status": by_status,
        "by_owasp_category": by_owasp,
    }


@router.get("", response_model=list[FindingResponse])
async def list_findings(
    current_org: CurrentOrgDep,
    db: DBDep,
    severity: Optional[str] = Query(None),
    finding_status: Optional[str] = Query(None, alias="status"),
    owasp_category: Optional[str] = Query(None),
    scan_id: Optional[uuid.UUID] = Query(None),
    assigned_to: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[Finding]:
    query = select(Finding).where(Finding.org_id == current_org.id)

    if severity:
        query = query.where(Finding.severity == severity)
    if finding_status:
        query = query.where(Finding.status == finding_status)
    if owasp_category:
        query = query.where(Finding.owasp_category == owasp_category)
    if scan_id:
        query = query.where(Finding.scan_id == scan_id)
    if assigned_to:
        query = query.where(Finding.assigned_to == assigned_to)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            Finding.title.ilike(search_term) | Finding.affected_url.ilike(search_term)
        )

    # Order by severity (critical first), then first_seen desc
    query = (
        query.order_by(
            case(
                (Finding.severity == "critical", 0),
                (Finding.severity == "high", 1),
                (Finding.severity == "medium", 2),
                (Finding.severity == "low", 3),
                else_=4,
            ),
            Finding.first_seen.desc(),
        )
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{finding_id}", response_model=FindingResponse)
async def get_finding(
    finding_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Finding:
    return await _get_finding_or_404(finding_id, current_org.id, db)


@router.put("/{finding_id}/status", response_model=FindingResponse)
async def update_finding_status(
    finding_id: uuid.UUID,
    payload: FindingStatusUpdate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Finding:
    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
        )

    finding = await _get_finding_or_404(finding_id, current_org.id, db)
    finding.status = payload.status

    if payload.status == "resolved":
        finding.resolved_at = datetime.now(tz=timezone.utc)
    elif finding.status == "resolved":
        finding.resolved_at = None

    await db.commit()
    await db.refresh(finding)

    # Trigger finding notification async
    try:
        from app.workers.scan_tasks import send_finding_notifications
        send_finding_notifications.delay(str(finding_id))
    except Exception:
        pass

    return finding


@router.post("/{finding_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    finding_id: uuid.UUID,
    payload: CommentCreate,
    current_org: CurrentOrgDep,
    current_user: CurrentUserDep,
    db: DBDep,
) -> FindingComment:
    await _get_finding_or_404(finding_id, current_org.id, db)

    comment = FindingComment(
        finding_id=finding_id,
        user_id=current_user.id,
        comment=payload.comment,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.get("/{finding_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    finding_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> list[FindingComment]:
    await _get_finding_or_404(finding_id, current_org.id, db)

    result = await db.execute(
        select(FindingComment)
        .where(FindingComment.finding_id == finding_id)
        .order_by(FindingComment.created_at.asc())
    )
    return list(result.scalars().all())


# ---------- Helpers ----------

async def _get_finding_or_404(
    finding_id: uuid.UUID, org_id: uuid.UUID, db
) -> Finding:
    result = await db.execute(
        select(Finding).where(Finding.id == finding_id, Finding.org_id == org_id)
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    return finding
