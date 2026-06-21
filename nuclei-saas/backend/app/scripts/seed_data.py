"""
seed_data.py — Database seeding script for LegionCyber Shield

Seeds the database with:
  - Compliance framework mappings (from compliance_mappings.json)
  - Scan plan definitions (from scan_plans.json)
  - Remediation guides (from remediation_guides.json)
  - Billing plan definitions (from billing_plans.json)
  - An admin user (credentials from environment or interactive prompt)
  - A sample organization for local testing

Usage:
  python -m app.scripts.seed_data                   # seed everything
  python -m app.scripts.seed_data --only compliance  # seed only compliance data
  python -m app.scripts.seed_data --only plans       # seed only scan plans
  python -m app.scripts.seed_data --only remediation # seed only remediation guides
  python -m app.scripts.seed_data --only billing     # seed only billing plans
  python -m app.scripts.seed_data --only admin       # seed only the admin user
  python -m app.scripts.seed_data --only sample_org  # seed only sample org
  python -m app.scripts.seed_data --skip admin       # seed everything except admin
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data file locations (relative to this file's location)
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent.parent / "data"
COMPLIANCE_MAPPINGS_FILE = DATA_DIR / "compliance_mappings.json"
SCAN_PLANS_FILE = DATA_DIR / "scan_plans.json"
REMEDIATION_GUIDES_FILE = DATA_DIR / "remediation_guides.json"
BILLING_PLANS_FILE = DATA_DIR / "billing_plans.json"


def load_json(path: Path) -> Any:
    """Load and parse a JSON file, raising a clear error if missing."""
    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Lazy imports — defer SQLAlchemy/app imports until we're inside an async
# context so the script can be imported without the database being available.
# ---------------------------------------------------------------------------
async def get_db_session():
    """Return an async SQLAlchemy session."""
    from app.database import AsyncSessionLocal  # type: ignore[import]
    return AsyncSessionLocal()


# ---------------------------------------------------------------------------
# Seeder: Compliance Mappings
# ---------------------------------------------------------------------------
async def seed_compliance_mappings(session) -> int:
    """Insert or update compliance framework mappings."""
    try:
        from app.models.compliance import ComplianceFramework, ComplianceRequirement  # type: ignore[import]
    except ImportError:
        log.warning("ComplianceFramework model not found — skipping compliance seed.")
        return 0

    data = load_json(COMPLIANCE_MAPPINGS_FILE)
    inserted = 0

    for framework_key, framework_data in data.items():
        from sqlalchemy import select  # type: ignore[import]

        # Upsert framework
        stmt = select(ComplianceFramework).where(
            ComplianceFramework.key == framework_key
        )
        result = await session.execute(stmt)
        framework_obj = result.scalar_one_or_none()

        if framework_obj is None:
            framework_obj = ComplianceFramework(
                key=framework_key,
                name=framework_data["name"],
                version=framework_data["version"],
                description=framework_data.get("description", ""),
            )
            session.add(framework_obj)
            await session.flush()
            log.info(f"  [+] Inserted framework: {framework_data['name']} v{framework_data['version']}")
        else:
            framework_obj.name = framework_data["name"]
            framework_obj.version = framework_data["version"]
            framework_obj.description = framework_data.get("description", "")
            log.info(f"  [~] Updated framework: {framework_data['name']}")

        # Upsert requirements
        for req_data in framework_data.get("requirements", []):
            req_stmt = select(ComplianceRequirement).where(
                ComplianceRequirement.framework_id == framework_obj.id,
                ComplianceRequirement.requirement_id == req_data["id"],
            )
            req_result = await session.execute(req_stmt)
            req_obj = req_result.scalar_one_or_none()

            if req_obj is None:
                req_obj = ComplianceRequirement(
                    framework_id=framework_obj.id,
                    requirement_id=req_data["id"],
                    name=req_data["name"],
                    description=req_data.get("description", ""),
                    owasp_categories=req_data.get("owasp_categories", []),
                    cwe_ids=req_data.get("cwe_ids", []),
                    nuclei_tags=req_data.get("nuclei_tags", []),
                    severity_threshold=req_data.get("severity_threshold", "medium"),
                    sub_requirements=req_data.get("sub_requirements", []),
                )
                session.add(req_obj)
                inserted += 1
            else:
                req_obj.name = req_data["name"]
                req_obj.description = req_data.get("description", "")
                req_obj.owasp_categories = req_data.get("owasp_categories", [])
                req_obj.cwe_ids = req_data.get("cwe_ids", [])
                req_obj.nuclei_tags = req_data.get("nuclei_tags", [])
                req_obj.severity_threshold = req_data.get("severity_threshold", "medium")

    await session.commit()
    log.info(f"Compliance seeding complete. {inserted} requirements inserted/updated.")
    return inserted


# ---------------------------------------------------------------------------
# Seeder: Scan Plans
# ---------------------------------------------------------------------------
async def seed_scan_plans(session) -> int:
    """Insert or update scan plan definitions."""
    try:
        from app.models.scan import ScanPlan  # type: ignore[import]
    except ImportError:
        log.warning("ScanPlan model not found — skipping scan plans seed.")
        return 0

    data = load_json(SCAN_PLANS_FILE)
    inserted = 0

    from sqlalchemy import select  # type: ignore[import]

    for plan_data in data:
        stmt = select(ScanPlan).where(ScanPlan.plan_id == plan_data["id"])
        result = await session.execute(stmt)
        plan_obj = result.scalar_one_or_none()

        if plan_obj is None:
            plan_obj = ScanPlan(
                plan_id=plan_data["id"],
                name=plan_data["name"],
                description=plan_data.get("description", ""),
                template_tags=plan_data.get("template_tags", []),
                severity_filter=plan_data.get("severity_filter", []),
                exclude_tags=plan_data.get("exclude_tags", []),
                estimated_duration_minutes=plan_data.get("estimated_duration_minutes", 30),
                available_in_plans=plan_data.get("available_in_plans", []),
                compliance_frameworks=plan_data.get("compliance_frameworks", []),
                icon=plan_data.get("icon", "shield"),
                color=plan_data.get("color", "#1565c0"),
            )
            session.add(plan_obj)
            inserted += 1
            log.info(f"  [+] Inserted scan plan: {plan_data['name']}")
        else:
            plan_obj.name = plan_data["name"]
            plan_obj.description = plan_data.get("description", "")
            plan_obj.template_tags = plan_data.get("template_tags", [])
            plan_obj.severity_filter = plan_data.get("severity_filter", [])
            plan_obj.exclude_tags = plan_data.get("exclude_tags", [])
            plan_obj.estimated_duration_minutes = plan_data.get("estimated_duration_minutes", 30)
            plan_obj.available_in_plans = plan_data.get("available_in_plans", [])
            plan_obj.compliance_frameworks = plan_data.get("compliance_frameworks", [])
            log.info(f"  [~] Updated scan plan: {plan_data['name']}")

    await session.commit()
    log.info(f"Scan plan seeding complete. {inserted} plans inserted/updated.")
    return inserted


# ---------------------------------------------------------------------------
# Seeder: Remediation Guides
# ---------------------------------------------------------------------------
async def seed_remediation_guides(session) -> int:
    """Insert or update remediation guide definitions."""
    try:
        from app.models.findings import RemediationGuide  # type: ignore[import]
    except ImportError:
        log.warning("RemediationGuide model not found — skipping remediation guides seed.")
        return 0

    data = load_json(REMEDIATION_GUIDES_FILE)
    inserted = 0

    from sqlalchemy import select  # type: ignore[import]

    for guide_key, guide_data in data.items():
        stmt = select(RemediationGuide).where(RemediationGuide.guide_key == guide_key)
        result = await session.execute(stmt)
        guide_obj = result.scalar_one_or_none()

        if guide_obj is None:
            guide_obj = RemediationGuide(
                guide_key=guide_key,
                cwe_id=guide_data.get("cwe_id"),
                title=guide_data["title"],
                owasp_category=guide_data.get("owasp_category", ""),
                nuclei_tags=guide_data.get("nuclei_tags", []),
                steps=guide_data.get("steps", []),
                code_examples=guide_data.get("code_examples", {}),
                references=guide_data.get("references", []),
                estimated_effort=guide_data.get("estimated_effort", ""),
                priority=guide_data.get("priority", "medium"),
            )
            session.add(guide_obj)
            inserted += 1
            log.info(f"  [+] Inserted remediation guide: {guide_data['title']}")
        else:
            guide_obj.cwe_id = guide_data.get("cwe_id")
            guide_obj.title = guide_data["title"]
            guide_obj.owasp_category = guide_data.get("owasp_category", "")
            guide_obj.nuclei_tags = guide_data.get("nuclei_tags", [])
            guide_obj.steps = guide_data.get("steps", [])
            guide_obj.code_examples = guide_data.get("code_examples", {})
            guide_obj.references = guide_data.get("references", [])
            guide_obj.estimated_effort = guide_data.get("estimated_effort", "")
            guide_obj.priority = guide_data.get("priority", "medium")
            log.info(f"  [~] Updated remediation guide: {guide_data['title']}")

    await session.commit()
    log.info(f"Remediation guide seeding complete. {inserted} guides inserted/updated.")
    return inserted


# ---------------------------------------------------------------------------
# Seeder: Billing Plans
# ---------------------------------------------------------------------------
async def seed_billing_plans(session) -> int:
    """Insert or update billing plan definitions."""
    try:
        from app.models.billing import BillingPlan  # type: ignore[import]
    except ImportError:
        log.warning("BillingPlan model not found — skipping billing plans seed.")
        return 0

    data = load_json(BILLING_PLANS_FILE)
    inserted = 0

    from sqlalchemy import select  # type: ignore[import]

    for plan_data in data:
        stmt = select(BillingPlan).where(BillingPlan.plan_id == plan_data["id"])
        result = await session.execute(stmt)
        plan_obj = result.scalar_one_or_none()

        if plan_obj is None:
            plan_obj = BillingPlan(
                plan_id=plan_data["id"],
                name=plan_data["name"],
                description=plan_data.get("description", ""),
                price_monthly=plan_data.get("price_monthly"),
                price_annual=plan_data.get("price_annual"),
                price_one_time=plan_data.get("price_one_time"),
                zoho_plan_id=plan_data.get("zoho_plan_id"),
                features=plan_data.get("features", {}),
                highlighted_features=plan_data.get("highlighted_features", []),
            )
            session.add(plan_obj)
            inserted += 1
            log.info(f"  [+] Inserted billing plan: {plan_data['name']}")
        else:
            plan_obj.name = plan_data["name"]
            plan_obj.description = plan_data.get("description", "")
            plan_obj.price_monthly = plan_data.get("price_monthly")
            plan_obj.price_annual = plan_data.get("price_annual")
            plan_obj.price_one_time = plan_data.get("price_one_time")
            plan_obj.features = plan_data.get("features", {})
            plan_obj.highlighted_features = plan_data.get("highlighted_features", [])
            log.info(f"  [~] Updated billing plan: {plan_data['name']}")

    await session.commit()
    log.info(f"Billing plan seeding complete. {inserted} plans inserted/updated.")
    return inserted


# ---------------------------------------------------------------------------
# Seeder: Admin User
# ---------------------------------------------------------------------------
async def seed_admin_user(session) -> bool:
    """Create the admin user. Credentials come from env vars or interactive prompt."""
    try:
        from app.models.user import User  # type: ignore[import]
        from app.core.security import get_password_hash  # type: ignore[import]
    except ImportError:
        log.warning("User model or security module not found — skipping admin user seed.")
        return False

    from sqlalchemy import select  # type: ignore[import]

    # Resolve credentials
    admin_email = os.environ.get("ADMIN_EMAIL") or os.environ.get("SEED_ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD") or os.environ.get("SEED_ADMIN_PASSWORD")

    if not admin_email:
        print("\n--- Admin User Setup ---")
        admin_email = input("Admin email address: ").strip()
        if not admin_email:
            log.error("No admin email provided. Skipping admin user creation.")
            return False

    if not admin_password:
        admin_password = getpass.getpass(f"Admin password for {admin_email}: ")
        if not admin_password:
            log.error("No admin password provided. Skipping admin user creation.")
            return False

    # Check if user already exists
    stmt = select(User).where(User.email == admin_email)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        log.info(f"  [~] Admin user already exists: {admin_email}")
        return True

    # Create admin user
    hashed_password = get_password_hash(admin_password)
    admin_user = User(
        email=admin_email,
        hashed_password=hashed_password,
        full_name=os.environ.get("ADMIN_FULL_NAME", "Shield Administrator"),
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    session.add(admin_user)
    await session.commit()
    await session.refresh(admin_user)

    log.info(f"  [+] Created admin user: {admin_email} (id={admin_user.id})")
    return True


# ---------------------------------------------------------------------------
# Seeder: Sample Organization
# ---------------------------------------------------------------------------
async def seed_sample_organization(session) -> bool:
    """Create a sample organization for local development and testing."""
    try:
        from app.models.organization import Organization  # type: ignore[import]
        from app.models.user import User  # type: ignore[import]
    except ImportError:
        log.warning("Organization model not found — skipping sample org seed.")
        return False

    from sqlalchemy import select  # type: ignore[import]

    SAMPLE_ORG_SLUG = "demo-org"

    stmt = select(Organization).where(Organization.slug == SAMPLE_ORG_SLUG)
    result = await session.execute(stmt)
    existing_org = result.scalar_one_or_none()

    if existing_org:
        log.info(f"  [~] Sample organization already exists: {SAMPLE_ORG_SLUG}")
        return True

    # Find the admin user to associate with the org
    admin_email = os.environ.get("ADMIN_EMAIL") or os.environ.get("SEED_ADMIN_EMAIL")
    owner_id = None

    if admin_email:
        user_stmt = select(User).where(User.email == admin_email)
        user_result = await session.execute(user_stmt)
        admin = user_result.scalar_one_or_none()
        if admin:
            owner_id = admin.id

    sample_org = Organization(
        name="Demo Organization",
        slug=SAMPLE_ORG_SLUG,
        plan_id="professional",
        owner_id=owner_id,
        is_active=True,
        # Billing state: set to active for local dev
        billing_status="active",
        domains_used=0,
        scans_this_month=0,
    )
    session.add(sample_org)
    await session.commit()
    await session.refresh(sample_org)

    log.info(f"  [+] Created sample organization: 'Demo Organization' (id={sample_org.id}, slug={SAMPLE_ORG_SLUG})")

    # Add sample domain if the Domain model exists
    try:
        from app.models.scan import Domain  # type: ignore[import]

        sample_domain = Domain(
            organization_id=sample_org.id,
            url="https://example.com",
            name="example.com",
            is_verified=True,
            is_active=True,
        )
        session.add(sample_domain)
        await session.commit()
        log.info(f"  [+] Added sample domain: https://example.com")
    except ImportError:
        pass

    return True


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
async def main(args: argparse.Namespace) -> None:
    """Run all selected seeders."""
    only: str | None = args.only
    skip: str | None = args.skip

    def should_run(name: str) -> bool:
        if only:
            return name in only.split(",")
        if skip:
            return name not in skip.split(",")
        return True

    log.info("=== LegionCyber Shield — Database Seeder ===")
    log.info(f"Data directory: {DATA_DIR}")

    session = await get_db_session()
    try:
        async with session.begin():
            # 1. Compliance mappings
            if should_run("compliance"):
                log.info("\n[1/6] Seeding compliance mappings...")
                count = await seed_compliance_mappings(session)
                log.info(f"      Done ({count} items processed).")

            # 2. Scan plans
            if should_run("plans"):
                log.info("\n[2/6] Seeding scan plans...")
                count = await seed_scan_plans(session)
                log.info(f"      Done ({count} items processed).")

            # 3. Remediation guides
            if should_run("remediation"):
                log.info("\n[3/6] Seeding remediation guides...")
                count = await seed_remediation_guides(session)
                log.info(f"      Done ({count} items processed).")

            # 4. Billing plans
            if should_run("billing"):
                log.info("\n[4/6] Seeding billing plans...")
                count = await seed_billing_plans(session)
                log.info(f"      Done ({count} items processed).")

            # 5. Admin user (runs outside the transaction to allow interactive input)
            if should_run("admin"):
                log.info("\n[5/6] Seeding admin user...")
                await seed_admin_user(session)

            # 6. Sample organization
            if should_run("sample_org"):
                log.info("\n[6/6] Seeding sample organization...")
                await seed_sample_organization(session)

    except Exception as exc:
        log.error(f"Seeding failed: {exc}", exc_info=True)
        sys.exit(1)
    finally:
        await session.close()

    log.info("\n=== Seeding complete! ===")
    log.info("Run 'docker-compose up -d' and visit http://localhost:3000 to get started.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed the LegionCyber Shield database with initial data.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--only",
        metavar="SECTION",
        help="Comma-separated list of sections to seed (compliance, plans, remediation, billing, admin, sample_org)",
    )
    parser.add_argument(
        "--skip",
        metavar="SECTION",
        help="Comma-separated list of sections to skip",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be seeded without writing to the database",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if args.dry_run:
        log.info("DRY RUN mode — no data will be written.")
        for data_file in [
            COMPLIANCE_MAPPINGS_FILE,
            SCAN_PLANS_FILE,
            REMEDIATION_GUIDES_FILE,
            BILLING_PLANS_FILE,
        ]:
            try:
                data = load_json(data_file)
                if isinstance(data, list):
                    log.info(f"  Would seed {len(data)} records from {data_file.name}")
                elif isinstance(data, dict):
                    count = sum(
                        len(v.get("requirements", [])) if isinstance(v, dict) else 1
                        for v in data.values()
                    )
                    log.info(f"  Would seed {len(data)} frameworks / {count} items from {data_file.name}")
            except FileNotFoundError as exc:
                log.warning(str(exc))
        sys.exit(0)

    asyncio.run(main(args))
