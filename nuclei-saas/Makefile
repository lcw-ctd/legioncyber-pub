.PHONY: up down build rebuild migrate seed logs backend-shell db-shell redis-shell \
        test test-cov lint format update-nuclei-templates \
        generate-encryption-key generate-secret-key \
        scan-worker-logs celery-flower check-health clean

# =============================================================================
# Docker Compose — Core Operations
# =============================================================================

## Start all services in detached mode
up:
	docker-compose up -d

## Start all services and stream logs
up-logs:
	docker-compose up

## Stop all services (preserves volumes)
down:
	docker-compose down

## Stop all services and remove volumes (WARNING: destroys database data)
down-volumes:
	@echo "WARNING: This will destroy all data including the database. Press Ctrl+C to cancel."
	@sleep 3
	docker-compose down -v

## Build all Docker images
build:
	docker-compose build

## Force rebuild all images without cache
rebuild:
	docker-compose build --no-cache

## Rebuild and restart a specific service: make restart SERVICE=backend
restart:
	docker-compose up -d --build $(SERVICE)

# =============================================================================
# Database Migrations (Alembic)
# =============================================================================

## Run all pending Alembic migrations
migrate:
	docker-compose exec backend alembic upgrade head

## Roll back the last Alembic migration
migrate-down:
	docker-compose exec backend alembic downgrade -1

## Show current migration state
migrate-status:
	docker-compose exec backend alembic current

## Auto-generate a new migration based on model changes
## Usage: make migrate-create MSG="add_scan_results_table"
migrate-create:
	docker-compose exec backend alembic revision --autogenerate -m "$(MSG)"

# =============================================================================
# Database Seeding
# =============================================================================

## Seed the database with default data (scan plans, compliance mappings, remediation guides)
seed:
	docker-compose exec backend python -m app.scripts.seed_data

## Seed only compliance mappings
seed-compliance:
	docker-compose exec backend python -m app.scripts.seed_data --only compliance

## Seed only scan plans
seed-plans:
	docker-compose exec backend python -m app.scripts.seed_data --only plans

## Full bootstrap: migrate + seed
bootstrap: migrate seed
	@echo "Bootstrap complete. Run 'make logs' to monitor services."

# =============================================================================
# Logs
# =============================================================================

## Stream logs for all services
logs:
	docker-compose logs -f

## Stream backend logs only
logs-backend:
	docker-compose logs -f backend

## Stream celery worker logs
logs-worker:
	docker-compose logs -f celery-worker

## Stream celery beat logs
logs-beat:
	docker-compose logs -f celery-beat

## Stream scanner logs
logs-scanner:
	docker-compose logs -f scanner

## Stream nginx logs
logs-nginx:
	docker-compose logs -f nginx

# =============================================================================
# Shell Access
# =============================================================================

## Open a bash shell in the backend container
backend-shell:
	docker-compose exec backend bash

## Open a Python REPL in the backend container with app context
backend-python:
	docker-compose exec backend python

## Open a psql shell connected to the application database
db-shell:
	docker-compose exec postgres psql -U lcshield legioncyber_shield

## Open a redis-cli shell
redis-shell:
	docker-compose exec redis redis-cli

## Open a shell in the scanner container
scanner-shell:
	docker-compose exec scanner bash

# =============================================================================
# Testing
# =============================================================================

## Run all backend tests
test:
	docker-compose exec backend pytest

## Run tests with coverage report
test-cov:
	docker-compose exec backend pytest --cov=app --cov-report=term-missing --cov-report=html

## Run a specific test file: make test-file FILE=tests/test_scans.py
test-file:
	docker-compose exec backend pytest $(FILE) -v

## Run tests matching a keyword: make test-k KEY=auth
test-k:
	docker-compose exec backend pytest -k "$(KEY)" -v

# =============================================================================
# Code Quality
# =============================================================================

## Run ruff linter
lint:
	docker-compose exec backend ruff check app/

## Auto-fix lint issues
lint-fix:
	docker-compose exec backend ruff check --fix app/

## Format code with black
format:
	docker-compose exec backend black app/

## Run mypy type checking
typecheck:
	docker-compose exec backend mypy app/

## Run all quality checks
check: lint typecheck
	@echo "All checks passed."

# =============================================================================
# Nuclei Templates
# =============================================================================

## Update nuclei templates to latest version
update-nuclei-templates:
	docker-compose exec scanner nuclei -update-templates
	@echo "Nuclei templates updated."

## List all installed template tags
list-nuclei-tags:
	docker-compose exec scanner nuclei -list-tags

## Show nuclei version
nuclei-version:
	docker-compose exec scanner nuclei -version

# =============================================================================
# Key Generation
# =============================================================================

## Generate a Fernet encryption key for ENCRYPTION_KEY
generate-encryption-key:
	@docker-compose exec backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

## Generate a 256-bit hex secret key for SECRET_KEY
generate-secret-key:
	@docker-compose exec backend python -c "import secrets; print(secrets.token_hex(32))"

## Generate both keys at once and display them
generate-all-keys:
	@echo "SECRET_KEY=$(shell docker-compose exec -T backend python -c 'import secrets; print(secrets.token_hex(32))')"
	@echo "ENCRYPTION_KEY=$(shell docker-compose exec -T backend python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"

# =============================================================================
# Health & Status
# =============================================================================

## Check health of all services
check-health:
	@echo "=== Service Status ==="
	@docker-compose ps
	@echo ""
	@echo "=== Backend Health ==="
	@curl -sf http://localhost:8000/health || echo "Backend unhealthy or not running"
	@echo ""
	@echo "=== Redis Ping ==="
	@docker-compose exec -T redis redis-cli ping 2>/dev/null || echo "Redis not running"
	@echo ""
	@echo "=== Database Connection ==="
	@docker-compose exec -T postgres pg_isready -U lcshield -d legioncyber_shield 2>/dev/null || echo "Database not running"

## Show running container resource usage
stats:
	docker stats --no-stream $(shell docker-compose ps -q)

# =============================================================================
# Celery Monitoring
# =============================================================================

## Launch Celery Flower monitoring UI (available at http://localhost:5555)
celery-flower:
	docker-compose exec celery-worker celery -A app.workers.celery_app flower --port=5555

## Inspect active Celery tasks
celery-inspect:
	docker-compose exec celery-worker celery -A app.workers.celery_app inspect active

## Purge all Celery queues (WARNING: drops pending tasks)
celery-purge:
	@echo "WARNING: This will drop all pending scan/report/notification tasks."
	@read -p "Continue? [y/N] " yn; [ "$$yn" = "y" ] || exit 1
	docker-compose exec celery-worker celery -A app.workers.celery_app purge -f

# =============================================================================
# Cleanup
# =============================================================================

## Remove stopped containers and dangling images
clean:
	docker system prune -f

## Remove all project Docker images (forces full rebuild)
clean-images:
	docker-compose down --rmi local

# =============================================================================
# Help
# =============================================================================

## Show this help message
help:
	@echo ""
	@echo "LegionCyber Shield — Developer Makefile"
	@echo "========================================"
	@echo ""
	@grep -E '^##' Makefile | sed 's/## /  /'
	@echo ""
