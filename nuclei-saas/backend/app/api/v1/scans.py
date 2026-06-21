import uuid
from datetime import datetime, timezone
from typing import Optional

from croniter import croniter
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select

from app.core.dependencies import CurrentOrgDep, CurrentUserDep, DBDep
from app.models.domain import Domain
from app.models.finding import Finding
from app.models.scan import Scan, ScanPlan, ScanSchedule

router = APIRouter(prefix="/scans", tags=["scans"])


# ---------- Schemas ----------

class ScanCreate(BaseModel):
    domain_id: uuid.UUID
    plan_id: Optional[uuid.UUID] = None
    name: str
    scan_mode: str = "blackbox"
    credential_ids: list[str] = []
    target_urls: list[str] = []
    rate_limit: int = 100
    max_duration: int = 3600


class ScanResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    domain_id: uuid.UUID
    plan_id: Optional[uuid.UUID]
    name: str
    status: str
    scan_mode: str
    credential_ids: Optional[list[str]]
    target_urls: Optional[list[str]]
    rate_limit: int
    max_duration: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    celery_task_id: Optional[str]
    error_message: Optional[str]
    created_by: Optional[uuid.UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    domain_id: uuid.UUID
    plan_id: uuid.UUID
    cron_expression: str
    credential_ids: list[str] = []
    is_active: bool = True

    @field_validator("cron_expression")
    @classmethod
    def valid_cron(cls, v: str) -> str:
        if not croniter.is_valid(v):
            raise ValueError(f"Invalid cron expression: {v}")
        return v


class ScheduleUpdate(BaseModel):
    cron_expression: Optional[str] = None
    is_active: Optional[bool] = None
    credential_ids: Optional[list[str]] = None

    @field_validator("cron_expression")
    @classmethod
    def valid_cron(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not croniter.is_valid(v):
            raise ValueError(f"Invalid cron expression: {v}")
        return v


class ScheduleResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    domain_id: uuid.UUID
    plan_id: uuid.UUID
    cron_expression: str
    is_active: bool
    next_run_at: Optional[datetime]
    last_run_at: Optional[datetime]
    credential_ids: Optional[list[str]]
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanPlanResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    scan_type: str
    template_tags: Optional[list[str]]
    enabled: bool

    model_config = {"from_attributes": True}


VALID_SCAN_MODES = {"blackbox", "graybox", "whitebox"}


# ---------- Endpoints ----------

@router.get("/plans", response_model=list[ScanPlanResponse])
async def list_scan_plans(db: DBDep) -> list[ScanPlan]:
    result = await db.execute(
        select(ScanPlan).where(ScanPlan.enabled.is_(True)).order_by(ScanPlan.name)
    )
    return list(result.scalars().all())


@router.get("/schedules", response_model=list[ScheduleResponse])
async def list_schedules(current_org: CurrentOrgDep, db: DBDep) -> list[ScanSchedule]:
    result = await db.execute(
        select(ScanSchedule)
        .where(ScanSchedule.org_id == current_org.id)
        .order_by(ScanSchedule.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/schedules", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED
)
async def create_schedule(
    payload: ScheduleCreate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> ScanSchedule:
    await _assert_domain_belongs_to_org(payload.domain_id, current_org.id, db)
    await _assert_plan_exists(payload.plan_id, db)

    from croniter import croniter as CronIter
    cron = CronIter(payload.cron_expression)
    next_run = cron.get_next(datetime)

    schedule = ScanSchedule(
        org_id=current_org.id,
        domain_id=payload.domain_id,
        plan_id=payload.plan_id,
        cron_expression=payload.cron_expression,
        is_active=payload.is_active,
        next_run_at=next_run,
        credential_ids=payload.credential_ids,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleUpdate,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> ScanSchedule:
    schedule = await _get_schedule_or_404(schedule_id, current_org.id, db)

    if payload.cron_expression is not None:
        schedule.cron_expression = payload.cron_expression
        from croniter import croniter as CronIter
        cron = CronIter(payload.cron_expression)
        schedule.next_run_at = cron.get_next(datetime)
    if payload.is_active is not None:
        schedule.is_active = payload.is_active
    if payload.credential_ids is not None:
        schedule.credential_ids = payload.credential_ids

    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> None:
    schedule = await _get_schedule_or_404(schedule_id, current_org.id, db)
    await db.delete(schedule)
    await db.commit()


@router.get("", response_model=list[ScanResponse])
async def list_scans(
    current_org: CurrentOrgDep,
    db: DBDep,
    domain_id: Optional[uuid.UUID] = Query(None),
    scan_status: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[Scan]:
    query = select(Scan).where(Scan.org_id == current_org.id)
    if domain_id:
        query = query.where(Scan.domain_id == domain_id)
    if scan_status:
        query = query.where(Scan.status == scan_status)
    query = query.order_by(Scan.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def create_scan(
    payload: ScanCreate,
    current_org: CurrentOrgDep,
    current_user: CurrentUserDep,
    db: DBDep,
) -> Scan:
    if payload.scan_mode not in VALID_SCAN_MODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid scan_mode. Must be one of: {', '.join(VALID_SCAN_MODES)}",
        )

    domain = await _assert_domain_belongs_to_org(payload.domain_id, current_org.id, db)
    if domain.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain must be verified before scanning",
        )

    if payload.plan_id:
        await _assert_plan_exists(payload.plan_id, db)

    scan = Scan(
        org_id=current_org.id,
        domain_id=payload.domain_id,
        plan_id=payload.plan_id,
        name=payload.name,
        status="queued",
        scan_mode=payload.scan_mode,
        credential_ids=payload.credential_ids,
        target_urls=payload.target_urls,
        rate_limit=payload.rate_limit,
        max_duration=payload.max_duration,
        created_by=current_user.id,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    # Queue the Celery task
    try:
        from app.workers.scan_tasks import run_scan
        task = run_scan.delay(str(scan.id))
        scan.celery_task_id = task.id
        await db.commit()
    except Exception:
        # If celery is unavailable don't fail the scan creation
        pass

    return scan


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Scan:
    return await _get_scan_or_404(scan_id, current_org.id, db)


@router.post("/{scan_id}/cancel", response_model=ScanResponse)
async def cancel_scan(
    scan_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Scan:
    scan = await _get_scan_or_404(scan_id, current_org.id, db)

    if scan.status not in ("queued", "running"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a scan with status '{scan.status}'",
        )

    if scan.celery_task_id:
        try:
            from app.workers.celery_app import celery_app
            celery_app.control.revoke(scan.celery_task_id, terminate=True, signal="SIGKILL")
        except Exception:
            pass

    scan.status = "cancelled"
    scan.completed_at = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(scan)
    return scan


@router.get("/{scan_id}/findings")
async def get_scan_findings(
    scan_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
    severity: Optional[str] = Query(None),
    finding_status: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict]:
    await _get_scan_or_404(scan_id, current_org.id, db)

    query = select(Finding).where(
        Finding.scan_id == scan_id, Finding.org_id == current_org.id
    )
    if severity:
        query = query.where(Finding.severity == severity)
    if finding_status:
        query = query.where(Finding.status == finding_status)
    query = query.order_by(Finding.severity, Finding.first_seen.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    findings = result.scalars().all()
    return [
        {
            "id": str(f.id),
            "template_id": f.template_id,
            "template_name": f.template_name,
            "severity": f.severity,
            "cvss_score": f.cvss_score,
            "title": f.title,
            "affected_url": f.affected_url,
            "status": f.status,
            "owasp_category": f.owasp_category,
            "first_seen": f.first_seen.isoformat() if f.first_seen else None,
        }
        for f in findings
    ]


# ---------- Helpers ----------

async def _get_scan_or_404(
    scan_id: uuid.UUID, org_id: uuid.UUID, db
) -> Scan:
    result = await db.execute(
        select(Scan).where(Scan.id == scan_id, Scan.org_id == org_id)
    )
    scan = result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return scan


async def _get_schedule_or_404(
    schedule_id: uuid.UUID, org_id: uuid.UUID, db
) -> ScanSchedule:
    result = await db.execute(
        select(ScanSchedule).where(
            ScanSchedule.id == schedule_id, ScanSchedule.org_id == org_id
        )
    )
    schedule = result.scalar_one_or_none()
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found"
        )
    return schedule


async def _assert_domain_belongs_to_org(
    domain_id: uuid.UUID, org_id: uuid.UUID, db
) -> Domain:
    result = await db.execute(
        select(Domain).where(Domain.id == domain_id, Domain.org_id == org_id)
    )
    domain = result.scalar_one_or_none()
    if domain is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found"
        )
    return domain


async def _assert_plan_exists(plan_id: uuid.UUID, db) -> ScanPlan:
    result = await db.execute(select(ScanPlan).where(ScanPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan plan not found"
        )
    return plan
