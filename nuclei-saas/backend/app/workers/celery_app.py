from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "nuclei_saas",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.scan_tasks"],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Task behaviour
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # prevent task hoarding
    # Result expiry
    result_expires=86400,  # 24 hours
    # Retry defaults
    task_default_retry_delay=60,
    task_max_retries=3,
    # Routing
    task_routes={
        "app.workers.scan_tasks.run_scan": {"queue": "scans"},
        "app.workers.scan_tasks.generate_report": {"queue": "reports"},
        "app.workers.scan_tasks.verify_domain": {"queue": "verification"},
        "app.workers.scan_tasks.run_scheduled_scans": {"queue": "beat"},
        "app.workers.scan_tasks.sync_integrations": {"queue": "beat"},
        "app.workers.scan_tasks.send_finding_notifications": {"queue": "notifications"},
    },
    # Beat schedule
    beat_schedule={
        "run-scheduled-scans": {
            "task": "app.workers.scan_tasks.run_scheduled_scans",
            "schedule": crontab(minute="*/5"),  # every 5 minutes
            "options": {"queue": "beat"},
        },
        "sync-integrations": {
            "task": "app.workers.scan_tasks.sync_integrations",
            "schedule": crontab(minute=0, hour="*/6"),  # every 6 hours
            "options": {"queue": "beat"},
        },
        "reverify-domains": {
            "task": "app.workers.scan_tasks.reverify_all_domains",
            "schedule": crontab(minute=0, hour=2),  # daily at 02:00 UTC
            "options": {"queue": "verification"},
        },
    },
)
