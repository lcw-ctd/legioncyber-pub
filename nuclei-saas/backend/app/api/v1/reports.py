import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.config import settings
from app.core.dependencies import CurrentOrgDep, CurrentUserDep, DBDep
from app.models.report import Report

router = APIRouter(prefix="/reports", tags=["reports"])


# ---------- Schemas ----------

class ReportCreate(BaseModel):
    name: str
    report_type: str  # executive / technical / compliance / remediation
    format: str = "pdf"
    scan_id: Optional[uuid.UUID] = None
    compliance_profile_id: Optional[uuid.UUID] = None


class ReportResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    scan_id: Optional[uuid.UUID]
    compliance_profile_id: Optional[uuid.UUID]
    name: str
    report_type: str
    format: str
    s3_key: Optional[str]
    status: str
    generated_at: Optional[datetime]
    created_by: Optional[uuid.UUID]
    expires_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


VALID_REPORT_TYPES = {"executive", "technical", "compliance", "remediation"}
VALID_FORMATS = {"pdf", "html", "json"}


# ---------- Endpoints ----------

@router.get("", response_model=list[ReportResponse])
async def list_reports(
    current_org: CurrentOrgDep,
    db: DBDep,
    report_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Report]:
    query = select(Report).where(Report.org_id == current_org.id)
    if report_type:
        query = query.where(Report.report_type == report_type)
    query = query.order_by(Report.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=ReportResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_report(
    payload: ReportCreate,
    current_org: CurrentOrgDep,
    current_user: CurrentUserDep,
    db: DBDep,
) -> Report:
    if payload.report_type not in VALID_REPORT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid report_type. Must be one of: {', '.join(VALID_REPORT_TYPES)}",
        )
    if payload.format not in VALID_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid format. Must be one of: {', '.join(VALID_FORMATS)}",
        )

    report = Report(
        org_id=current_org.id,
        scan_id=payload.scan_id,
        compliance_profile_id=payload.compliance_profile_id,
        name=payload.name,
        report_type=payload.report_type,
        format=payload.format,
        status="generating",
        created_by=current_user.id,
        expires_at=datetime.now(tz=timezone.utc) + timedelta(days=30),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Queue the async report generation
    try:
        from app.workers.scan_tasks import generate_report as generate_report_task
        generate_report_task.delay(str(report.id))
    except Exception:
        pass

    return report


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> Report:
    return await _get_report_or_404(report_id, current_org.id, db)


@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> StreamingResponse:
    report = await _get_report_or_404(report_id, current_org.id, db)

    if report.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report is not ready yet. Current status: {report.status}",
        )

    if report.expires_at and datetime.now(tz=timezone.utc) > report.expires_at:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Report has expired",
        )

    if not report.s3_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Report file location not set",
        )

    content_types = {
        "pdf": "application/pdf",
        "html": "text/html",
        "json": "application/json",
    }
    content_type = content_types.get(report.format, "application/octet-stream")

    try:
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        s3_response = s3_client.get_object(Bucket=settings.S3_BUCKET, Key=report.s3_key)
        body = s3_response["Body"]

        def _stream():
            while True:
                chunk = body.read(65536)
                if not chunk:
                    break
                yield chunk

        filename = f"{report.name.replace(' ', '_')}.{report.format}"
        return StreamingResponse(
            _stream(),
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve report from storage: {exc}",
        ) from exc


# ---------- Helpers ----------

async def _get_report_or_404(
    report_id: uuid.UUID, org_id: uuid.UUID, db
) -> Report:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.org_id == org_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report
