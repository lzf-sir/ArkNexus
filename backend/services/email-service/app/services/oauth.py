"""OAuth2 provider abstraction + concrete implementations for GitHub and Google."""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from typing import Iterable, Optional
from urllib.parse import urlencode

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class OAuthUserProfile:
    """Normalized user info returned by an OAuth provider."""

    provider: str
    provider_user_id: str
    email: Optional[str]
    display_name: Optional[str]
    avatar_url: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: Optional[str] = None
    scope: Optional[str] = None
    expires_at: Optional[float] = None  # epoch seconds


class OAuthError(Exception):
    pass


def _authorize_url(authorize_endpoint: str, params: dict) -> str:
    return f"{authorize_endpoint}?{urlencode(params)}"


def _generate_state() -> str:
    return secrets.token_urlsafe(24)


class OAuthProvider:
    """Base class for OAuth providers."""

    name: str = "base"

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def get_authorize_url(self, state: str, scopes: Iterable[str]) -> str:
        raise NotImplementedError

    async def exchange_code(self, code: str) -> OAuthUserProfile:
        raise NotImplementedError


class GitHubProvider(OAuthProvider):
    name = "github"

    AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USER_URL = "https://api.github.com/user"
    EMAILS_URL = "https://api.github.com/user/emails"

    def get_authorize_url(self, state: str, scopes: Iterable[str]) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(scopes) or "read:user user:email",
            "state": state,
            "allow_signup": "true",
        }
        return _authorize_url(self.AUTHORIZE_URL, params)

    async def exchange_code(self, code: str) -> OAuthUserProfile:
        async with httpx.AsyncClient(timeout=15.0) as client:
            tok = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            if tok.status_code != 200:
                raise OAuthError(f"github token exchange failed: {tok.status_code}")
            tok_data = tok.json()
            access_token = tok_data.get("access_token")
            if not access_token:
                raise OAuthError("github returned no access_token")
            headers = {"Authorization": f"Bearer {access_token}"}
            user = (await client.get(self.USER_URL, headers=headers)).json()
            user_id = str(user.get("id"))
            if not user_id:
                raise OAuthError("github user id missing")
            email = user.get("email")
            display_name = user.get("name") or user.get("login")
            if not email:
                # Fall back to the verified primary email endpoint.
                try:
                    emails = (await client.get(self.EMAILS_URL, headers=headers)).json()
                    for e in emails:
                        if e.get("primary") and e.get("verified"):
                            email = e["email"]
                            break
                except Exception:  # noqa: BLE001
                    pass
            return OAuthUserProfile(
                provider=self.name,
                provider_user_id=user_id,
                email=email,
                display_name=display_name,
                access_token=access_token,
                token_type=tok_data.get("token_type", "bearer"),
                scope=tok_data.get("scope"),
            )


class GoogleProvider(OAuthProvider):
    name = "google"

    AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

    def get_authorize_url(self, state: str, scopes: Iterable[str]) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes) or "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
        return _authorize_url(self.AUTHORIZE_URL, params)

    async def exchange_code(self, code: str) -> OAuthUserProfile:
        async with httpx.AsyncClient(timeout=15.0) as client:
            tok = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if tok.status_code != 200:
                raise OAuthError(f"google token exchange failed: {tok.status_code}")
            tok_data = tok.json()
            access_token = tok_data.get("access_token")
            if not access_token:
                raise OAuthError("google returned no access_token")
            profile = (await client.get(
                self.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )).json()
            user_id = profile.get("sub")
            if not user_id:
                raise OAuthError("google user id missing")
            return OAuthUserProfile(
                provider=self.name,
                provider_user_id=user_id,
                email=profile.get("email"),
                display_name=profile.get("name"),
                avatar_url=profile.get("picture"),
                access_token=access_token,
                refresh_token=tok_data.get("refresh_token"),
                token_type=tok_data.get("token_type", "Bearer"),
                scope=tok_data.get("scope"),
                expires_at=float(tok_data["expires_in"]) if tok_data.get("expires_in") else None,
            )


def _redirect_uri(provider: str) -> str:
    return f"{settings.oauth_redirect_base}/api/v1/auth/oauth/{provider}/callback"


def get_provider(name: str) -> Optional[OAuthProvider]:
    """Return a configured provider or None."""
    if name == "github":
        p = GitHubProvider(
            settings.oauth_github_client_id,
            settings.oauth_github_client_secret,
            _redirect_uri("github"),
        )
        return p if p.is_configured() else None
    if name == "google":
        p = GoogleProvider(
            settings.oauth_google_client_id,
            settings.oauth_google_client_secret,
            _redirect_uri("google"),
        )
        return p if p.is_configured() else None
    return None


def list_configured_providers() -> list[str]:
    """Return the list of provider names that have credentials configured."""
    return [n for n in ("github", "google") if get_provider(n) is not None]


def generate_state() -> str:
    return _generate_state()


def sign_state(provider: str, state: str) -> str:
    """Sign a (provider, state) pair so we can verify it on callback."""
    import hashlib
    import hmac
    msg = f"{provider}:{state}".encode()
    sig = hmac.new(settings.oauth_state_secret.encode(), msg, hashlib.sha256).hexdigest()
    return f"{state}.{sig}"


def verify_state(provider: str, signed_state: str) -> bool:
    if not signed_state or "." not in signed_state:
        return False
    state, sig = signed_state.rsplit(".", 1)
    import hashlib
    import hmac
    msg = f"{provider}:{state}".encode()
    expected = hmac.new(settings.oauth_state_secret.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)
