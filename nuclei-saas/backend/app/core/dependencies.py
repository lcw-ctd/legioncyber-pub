import uuid
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token
from app.database import get_db
from app.models.organization import Organization, OrganizationMember
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

DBDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
    ],
    db: DBDep,
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id_str = payload.get("sub")
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

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


async def get_current_org(
    current_user: CurrentUserDep,
    db: DBDep,
    x_organization_id: Annotated[Optional[str], Header()] = None,
) -> Organization:
    if not x_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Organization-Id header is required",
        )

    try:
        org_id = uuid.UUID(x_organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID format",
        )

    # Verify user is a member of this organization
    member_result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    member = member_result.scalar_one_or_none()

    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )

    org_result = await db.execute(
        select(Organization).where(
            Organization.id == org_id, Organization.is_active.is_(True)
        )
    )
    org = org_result.scalar_one_or_none()

    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive",
        )

    return org


CurrentOrgDep = Annotated[Organization, Depends(get_current_org)]


def require_role(*allowed_roles: str):
    """Return a dependency that enforces the user has one of the specified roles in the current org."""

    async def _check_role(
        current_user: CurrentUserDep,
        current_org: CurrentOrgDep,
        db: DBDep,
    ) -> OrganizationMember:
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == current_org.id,
                OrganizationMember.user_id == current_user.id,
            )
        )
        member = result.scalar_one_or_none()

        if member is None or member.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of the following roles: {', '.join(allowed_roles)}",
            )
        return member

    return Depends(_check_role)


async def get_org_member(
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    db: DBDep,
) -> OrganizationMember:
    """Return the current user's membership record for the current org."""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == current_org.id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization",
        )
    return member


OrgMemberDep = Annotated[OrganizationMember, Depends(get_org_member)]
