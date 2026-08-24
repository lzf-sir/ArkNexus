"""Business logic for linking OAuth identities to users."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.oauth import OAuthAccount
from app.models.user import User
from app.services.oauth import OAuthUserProfile


logger = logging.getLogger(__name__)


class OAuthLinkError(Exception):
    pass


async def find_or_create_user(
    session: AsyncSession,
    profile: OAuthUserProfile,
    *,
    allow_registration: bool = True,
) -> User:
    """Link profile to an existing user or create a new one."""
    stmt = select(OAuthAccount).where(
        OAuthAccount.provider == profile.provider,
        OAuthAccount.provider_user_id == profile.provider_user_id,
    )
    link = (await session.execute(stmt)).scalar_one_or_none()
    if link is not None:
        user = await session.get(User, link.user_id)
        if user is not None:
            _update_link(link, profile)
            await session.commit()
            return user

    if profile.email:
        stmt = select(User).where(User.email == profile.email.lower())
        user = (await session.execute(stmt)).scalar_one_or_none()
        if user is not None:
            await _attach_link(session, user, profile)
            return user

    if not allow_registration:
        raise OAuthLinkError("No matching user for this OAuth identity")

    if not profile.email:
        raise OAuthLinkError(
            "OAuth provider did not return an email; cannot create user"
        )

    user = User(
        email=profile.email.lower(),
        display_name=profile.display_name or profile.email,
        password_hash=hash_password(secrets.token_urlsafe(48)),
        is_active=True,
        is_verified=True,
    )
    session.add(user)
    try:
        await session.commit()
    except Exception as exc:  # noqa: BLE001
        await session.rollback()
        raise OAuthLinkError(f"Failed to create user: {exc}") from exc
    await session.refresh(user)

    await _attach_link(session, user, profile)
    return user


async def _attach_link(
    session: AsyncSession,
    user: User,
    profile: OAuthUserProfile,
) -> OAuthAccount:
    link = OAuthAccount(
        user_id=user.id,
        provider=profile.provider,
        provider_user_id=profile.provider_user_id,
        provider_email=profile.email,
        provider_display_name=profile.display_name,
        access_token=profile.access_token,
        refresh_token=profile.refresh_token,
        token_type=profile.token_type,
        scope=profile.scope,
        expires_at=datetime.fromtimestamp(profile.expires_at, tz=timezone.utc)
        if profile.expires_at else None,
    )
    session.add(link)
    await session.commit()
    await session.refresh(link)
    return link


def _update_link(link: OAuthAccount, profile: OAuthUserProfile) -> None:
    link.provider_email = profile.email or link.provider_email
    link.provider_display_name = profile.display_name or link.provider_display_name
    link.access_token = profile.access_token or link.access_token
    link.refresh_token = profile.refresh_token or link.refresh_token
    link.token_type = profile.token_type or link.token_type
    link.scope = profile.scope or link.scope
    if profile.expires_at:
        link.expires_at = datetime.fromtimestamp(profile.expires_at, tz=timezone.utc)
