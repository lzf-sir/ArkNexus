"""Tests for OAuth linking + endpoints."""

from __future__ import annotations

import pytest

from app.services import oauth, oauth_link_service


async def test_oauth_providers_empty_when_unconfigured():
    # By default no providers are configured (no client ids).
    assert oauth.list_configured_providers() in ([], None) or isinstance(oauth.list_configured_providers(), list)


async def test_oauth_state_sign_and_verify():
    signed = oauth.sign_state("github", "abc123")
    assert oauth.verify_state("github", signed)
    assert not oauth.verify_state("github", signed + "x")
    assert not oauth.verify_state("google", signed)


def test_microsoft_provider_tenant_whitelist_default():
    """Unknown tenant values fall back to ``common`` for safety."""
    p = oauth.MicrosoftProvider("id", "secret", "http://x/cb", tenant="")
    assert p.tenant == "common"

    p = oauth.MicrosoftProvider("id", "secret", "http://x/cb", tenant="bogus-tenant")
    assert p.tenant == "common"

    p = oauth.MicrosoftProvider("id", "secret", "http://x/cb", tenant="organizations")
    assert p.tenant == "organizations"

    p = oauth.MicrosoftProvider("id", "secret", "http://x/cb", tenant="CONSUMERS")
    assert p.tenant == "consumers"

    guid = "12345678-1234-1234-1234-123456789012"
    p = oauth.MicrosoftProvider("id", "secret", "http://x/cb", tenant=guid)
    assert p.tenant == guid


def test_microsoft_provider_not_configured_without_credentials():
    p = oauth.MicrosoftProvider("", "", "http://x/cb", tenant="common")
    assert p.is_configured() is False

    p = oauth.MicrosoftProvider("client-id", "client-secret", "http://x/cb")
    assert p.is_configured() is True


def test_microsoft_authorize_url_uses_v2_endpoint():
    p = oauth.MicrosoftProvider("cid", "csec", "http://127.0.0.1:8080/api/v1/auth/oauth/microsoft/cb", tenant="common")
    url = p.get_authorize_url("state-xyz", scopes=["openid", "email"])
    assert url.startswith("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?")
    assert "client_id=cid" in url
    assert "redirect_uri=" in url
    assert "response_type=code" in url
    assert "scope=openid+email" in url or "scope=openid%20email" in url
    assert "state=state-xyz" in url
    assert "prompt=select_account" in url


def test_microsoft_authorize_url_default_scopes_when_none():
    p = oauth.MicrosoftProvider("cid", "csec", "http://x/cb")
    url = p.get_authorize_url("s", scopes=[])
    # Defaults to openid email profile offline_access.
    assert "openid" in url
    assert "email" in url
    assert "profile" in url
    assert "offline_access" in url


def test_get_provider_returns_microsoft_when_configured(monkeypatch):
    monkeypatch.setattr(oauth.settings, "oauth_microsoft_client_id", "cid", raising=False)
    monkeypatch.setattr(oauth.settings, "oauth_microsoft_client_secret", "csec", raising=False)
    monkeypatch.setattr(oauth.settings, "oauth_microsoft_tenant", "common", raising=False)
    p = oauth.get_provider("microsoft")
    assert isinstance(p, oauth.MicrosoftProvider)
    assert p.is_configured()


def test_get_provider_returns_none_when_microsoft_unconfigured(monkeypatch):
    monkeypatch.setattr(oauth.settings, "oauth_microsoft_client_id", "", raising=False)
    monkeypatch.setattr(oauth.settings, "oauth_microsoft_client_secret", "", raising=False)
    assert oauth.get_provider("microsoft") is None


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
