import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application startup and shutdown lifecycle."""
    logger.info("Starting up nuclei-saas backend...")

    # Run Alembic migrations on startup
    try:
        import subprocess
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            logger.info("Alembic migrations applied successfully")
        else:
            logger.warning("Alembic migration warning: %s", result.stderr)
    except Exception as exc:
        logger.error("Failed to run Alembic migrations: %s", exc)

    # Seed default scan plans if not already present
    try:
        await _seed_scan_plans()
    except Exception as exc:
        logger.warning("Failed to seed scan plans: %s", exc)

    # Seed compliance mappings
    try:
        await _seed_compliance_mappings()
    except Exception as exc:
        logger.warning("Failed to seed compliance mappings: %s", exc)

    yield

    logger.info("Shutting down nuclei-saas backend...")


async def _seed_scan_plans() -> None:
    """Insert default ScanPlan rows if they don't exist."""
    from app.database import AsyncSessionLocal
    from app.models.scan import ScanPlan
    from sqlalchemy import select

    default_plans = [
        {
            "name": "OWASP Top 10",
            "description": "Scan for the OWASP Top 10 most critical web application security risks",
            "scan_type": "owasp_top10",
            "template_tags": ["owasp-top-10"],
        },
        {
            "name": "Full Scan",
            "description": "Comprehensive scan using all available templates",
            "scan_type": "full",
            "template_tags": [],
        },
        {
            "name": "API Security Scan",
            "description": "Focused scan for REST and GraphQL API vulnerabilities",
            "scan_type": "api",
            "template_tags": ["api", "rest", "graphql"],
        },
        {
            "name": "CVE Scan",
            "description": "Detect known CVEs in web services and frameworks",
            "scan_type": "compliance",
            "template_tags": ["cve"],
        },
        {
            "name": "Misconfiguration Scan",
            "description": "Detect common web server and cloud misconfigurations",
            "scan_type": "custom",
            "template_tags": ["misconfiguration", "exposure"],
        },
    ]

    async with AsyncSessionLocal() as db:
        for plan_data in default_plans:
            existing = await db.execute(
                select(ScanPlan).where(ScanPlan.name == plan_data["name"])
            )
            if existing.scalar_one_or_none() is None:
                plan = ScanPlan(**plan_data, enabled=True)
                db.add(plan)
        await db.commit()


async def _seed_compliance_mappings() -> None:
    """Seed ComplianceMapping rows from the FRAMEWORK_REQUIREMENTS dict."""
    from app.database import AsyncSessionLocal
    from app.models.compliance import ComplianceMapping
    from app.services.compliance import FRAMEWORK_REQUIREMENTS
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        for framework, requirements in FRAMEWORK_REQUIREMENTS.items():
            for req in requirements:
                existing = await db.execute(
                    select(ComplianceMapping).where(
                        ComplianceMapping.framework == framework,
                        ComplianceMapping.requirement_id == req["requirement_id"],
                    )
                )
                if existing.scalar_one_or_none() is None:
                    mapping = ComplianceMapping(
                        framework=framework,
                        requirement_id=req["requirement_id"],
                        requirement_name=req["requirement_name"],
                        nuclei_tags=req.get("nuclei_tags", []),
                        cwe_ids=req.get("cwe_ids", []),
                        owasp_categories=req.get("owasp_categories", []),
                    )
                    db.add(mapping)
        await db.commit()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Nuclei Security Scanner SaaS",
        description="Multi-tenant web application security scanning powered by Nuclei",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_URL, settings.API_URL],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Total-Count"],
    )

    # Exception handlers
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Resource not found"},
        )

    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred"},
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": str(exc)},
        )

    # Health check
    @app.get("/health", tags=["system"])
    async def health_check() -> dict:
        from app.database import engine
        from sqlalchemy import text

        db_ok = False
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            pass

        return {
            "status": "healthy" if db_ok else "degraded",
            "database": "ok" if db_ok else "unavailable",
            "version": "1.0.0",
        }

    # Include all API routers
    from app.api.v1 import auth, billing, compliance, dashboard, domains, findings, integrations, reports, scans

    prefix = "/api/v1"
    app.include_router(auth.router, prefix=prefix)
    app.include_router(domains.router, prefix=prefix)
    app.include_router(scans.router, prefix=prefix)
    app.include_router(findings.router, prefix=prefix)
    app.include_router(reports.router, prefix=prefix)
    app.include_router(compliance.router, prefix=prefix)
    app.include_router(billing.router, prefix=prefix)
    app.include_router(integrations.router, prefix=prefix)
    app.include_router(dashboard.router, prefix=prefix)

    return app


app = create_app()
