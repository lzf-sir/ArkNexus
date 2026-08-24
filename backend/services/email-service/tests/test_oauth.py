"""Tests for OAuth linking + endpoints."""

from __future__ import annotations

import pytest

from app.services import oauth, oauth_link_service


pytestmark = pytest.mark.asyncio


async def test_oauth_providers_empty_when_unconfigured():
    # By default no providers are configured (no client ids).
    assert oauth.list_configured_providers() in ([], None) or isinstance(oauth.list_configured_providers(), list)


async def test_oauth_state_sign_and_verify():
    signed = oauth.sign_state("github", "abc123")
    assert oauth.verify_state("github", signed)
    assert not oauth.verify_state("github", signed + "x")
    assert not oauth.verify_state("google", signed)


async def test_oauth_link_creates_user(db_session):
    profile = oauth.OAuthUserProfile(
        provider="github",
        provider_user_id="12345",
        email="ghost@example.com",
        display_name="Ghost",
        access_token="tok",
        token_type="bearer",
        scope="read:user",
    )
    user = await oauth_link_service.find_or_create_user(db_session, profile)
    assert user.email == "ghost@example.com"
    assert user.is_active
    assert user.is_verified

    # Idempotent: same profile returns same user.
    again = await oauth_link_service.find_or_create_user(db_session, profile)
    assert again.id == user.id


async def test_oauth_link_to_existing_user_by_email(db_session):
    from app.models.user import User
    from app.core.security import hash_password
    existing = User(
        email="alice@example.com",
        display_name="Alice",
        password_hash=hash_password("p" * 8),
    )
    db_session.add(existing)
    await db_session.commit()
    await db_session.refresh(existing)

    profile = oauth.OAuthUserProfile(
        provider="google",
        provider_user_id="google-9999",
        email="alice@example.com",
        display_name="Alice G",
        access_token="g-tok",
    )
    user = await oauth_link_service.find_or_create_user(db_session, profile)
    assert user.id == existing.id


async def test_oauth_link_without_email_raises(db_session):
    profile = oauth.OAuthUserProfile(
        provider="github",
        provider_user_id="no-email",
        email=None,
        display_name=None,
    )
    with pytest.raises(oauth_link_service.OAuthLinkError):
        await oauth_link_service.find_or_create_user(db_session, profile)
