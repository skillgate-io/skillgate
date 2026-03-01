"""Shared authentication context dependency for JWT or API key auth."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from skillgate.api.db import get_session
from skillgate.api.models import APIKey, User
from skillgate.api.routes.auth import get_current_user
from skillgate.api.security import hash_api_key
from skillgate.config.license import Tier, get_current_tier, validate_api_key
from skillgate.core.errors import ConfigError

AuthContext = tuple[User, Tier, list[str] | None]

bearer_scheme = HTTPBearer(auto_error=False)


async def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> AuthContext:
    """Authenticate request using JWT bearer token or API key."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        user = await get_current_user(credentials=credentials, session=session)
        return user, get_current_tier(), None
    except HTTPException as exc:
        if exc.status_code != 401:
            raise

    plaintext = credentials.credentials
    record = await session.scalar(
        select(APIKey).where(
            APIKey.key_hash == hash_api_key(plaintext),
            APIKey.revoked.is_(False),
        )
    )
    if record is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    api_key_user = await session.get(User, record.user_id)
    if api_key_user is None or not api_key_user.is_active:
        raise HTTPException(status_code=401, detail="Inactive account")

    record.last_used_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await session.commit()

    try:
        tier = validate_api_key(plaintext)
    except ConfigError:
        tier = Tier.FREE

    scopes = [scope for scope in record.scopes.split(",") if scope]
    return api_key_user, tier, scopes


def require_api_key_scope(auth_ctx: AuthContext, required_scope: str) -> tuple[User, Tier]:
    """Require a scope only when caller used an API key.

    JWT-authenticated users are treated as full user sessions for these endpoints.
    """
    user, tier, key_scopes = auth_ctx
    if key_scopes is not None and required_scope not in key_scopes:
        raise HTTPException(
            status_code=403,
            detail=f"API key scope '{required_scope}' is required for this endpoint",
        )
    return user, tier
