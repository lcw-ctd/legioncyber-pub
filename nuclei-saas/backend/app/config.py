from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nuclei_saas"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "changeme-in-production-use-a-strong-random-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Encryption key for field-level encryption (Fernet - must be 32 url-safe base64 bytes)
    FIELD_ENCRYPTION_KEY: str = "changeme-generate-with-Fernet.generate_key()"

    # Zoho Subscriptions / Books
    ZOHO_CLIENT_ID: str = ""
    ZOHO_CLIENT_SECRET: str = ""
    ZOHO_ORGANIZATION_ID: str = ""
    ZOHO_REFRESH_TOKEN: str = ""
    ZOHO_API_DOMAIN: str = "https://www.zohoapis.com"
    ZOHO_ACCOUNTS_URL: str = "https://accounts.zoho.com"

    # Nuclei
    NUCLEI_BINARY_PATH: str = "/usr/local/bin/nuclei"
    NUCLEI_TEMPLATES_PATH: str = "/opt/nuclei-templates"
    NUCLEI_CUSTOM_TEMPLATES_PATH: str = "/opt/custom-templates"
    NUCLEI_OUTPUT_DIR: str = "/tmp/nuclei-output"

    # Scan limits
    SCAN_MAX_CONCURRENT: int = 5
    SCAN_RATE_LIMIT: int = 100  # requests/sec per scan

    # Domain verification
    DOMAIN_VERIFICATION_TIMEOUT: int = 300  # seconds

    # URLs
    FRONTEND_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"

    # AWS / S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET: str = ""

    # Optional integrations
    VANTA_API_KEY: Optional[str] = None
    CLOUDFLARE_API_KEY: Optional[str] = None
    AKAMAI_API_KEY: Optional[str] = None
    IMPERVA_API_KEY: Optional[str] = None

    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@example.com"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"


settings = Settings()
