import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from python_slugify import slugify
from sqlalchemy import select

from app.core.dependencies import CurrentUserDep, DBDep
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
    hash_password,
    verify_password,
)
from app.models.organization import Organization, OrganizationMember
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization_name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class VerifyEmailRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_verified: bool
    mfa_enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Helpers ----------

async def send_verification_email(email: str, token: str) -> None:
    """Send an email verification link. In production wire to an SMTP/SES sender."""
    from app.config import settings

    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    # TODO: integrate with email service (SMTP or AWS SES)
    # For now we just log – swap for real sender in production
    import logging
    logging.getLogger(__name__).info(
        "Verification email for %s: %s", email, verification_url
    )


async def send_password_reset_email(email: str, token: str) -> None:
    from app.config import settings

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    import logging
    logging.getLogger(__name__).info(
        "Password reset email for %s: %s", email, reset_url
    )


def _unique_slug(base: str) -> str:
    suffix = uuid.uuid4().hex[:6]
    return f"{slugify(base)}-{suffix}"


# ---------- Endpoints ----------

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: DBDep,
) -> TokenResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    verification_token = generate_secure_token(32)
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        is_active=True,
        is_verified=False,
        email_verification_token=verification_token,
    )
    db.add(user)
    await db.flush()  # get user.id

    org = Organization(
        name=payload.organization_name,
        slug=_unique_slug(payload.organization_name),
        plan_type="free",
        subscription_status="active",
        is_active=True,
    )
    db.add(org)
    await db.flush()

    member = OrganizationMember(
        org_id=org.id,
        user_id=user.id,
        role="owner",
    )
    db.add(member)
    await db.commit()

    background_tasks.add_task(send_verification_email, user.email, verification_token)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DBDep) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    user.last_login = datetime.now(tz=timezone.utc)
    await db.commit()

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(payload: RefreshRequest, db: DBDep) -> TokenResponse:
    try:
        token_data = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id_str = token_data.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject missing",
        )

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    access_token = create_access_token(str(user.id))
    new_refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    # Stateless JWT: client discards tokens. For full revocation implement a redis blocklist.
    return None


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: DBDep,
) -> dict:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if user and user.is_active:
        reset_token = generate_secure_token(32)
        from datetime import timedelta
        user.password_reset_token = reset_token
        user.password_reset_expires = datetime.now(tz=timezone.utc) + timedelta(hours=1)
        await db.commit()
        background_tasks.add_task(send_password_reset_email, user.email, reset_token)

    return {"message": "If an account exists, a password reset email has been sent"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(payload: ResetPasswordRequest, db: DBDep) -> dict:
    result = await db.execute(
        select(User).where(User.password_reset_token == payload.token)
    )
    user = result.scalar_one_or_none()

    if user is None or user.password_reset_expires is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    if datetime.now(tz=timezone.utc) > user.password_reset_expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired",
        )

    user.hashed_password = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.commit()

    return {"message": "Password updated successfully"}


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(payload: VerifyEmailRequest, db: DBDep) -> dict:
    result = await db.execute(
        select(User).where(User.email_verification_token == payload.token)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token",
        )

    user.is_verified = True
    user.email_verification_token = None
    await db.commit()

    return {"message": "Email verified successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUserDep) -> User:
    return current_user
