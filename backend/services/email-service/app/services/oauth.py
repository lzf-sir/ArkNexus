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


class MicrosoftProvider(OAuthProvider):
    """Microsoft Identity Platform v2.0 (Azure AD + personal accounts).

    Uses the multi-tenant ``common`` endpoint by default so the same client
    ID can serve both work/school and personal Microsoft accounts. Set
    ``OAUTH_MICROSOFT_TENANT`` to ``organizations`` / ``consumers`` / a
    specific tenant GUID to lock it down.
    """

    name = "microsoft"

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, tenant: str = "common") -> None:
        super().__init__(client_id, client_secret, redirect_uri)
        # Whitelist acceptable tenant values to prevent open-proxy via config injection.
        t = (tenant or "common").strip().lower()
        if t and t != "common" and t != "organizations" and t != "consumers" and not _is_tenant_guid(t):
            t = "common"
        self.tenant = t or "common"

    @property
    def _base(self) -> str:
        return f"https://login.microsoftonline.com/{self.tenant}/oauth2/v2.0"

    AUTHORIZE_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
    TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    USERINFO_URL = "https://graph.microsoft.com/oidc/userinfo"

    def get_authorize_url(self, state: str, scopes: Iterable[str]) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes) or "openid email profile offline_access",
            "state": state,
            "response_mode": "query",
            "prompt": "select_account",
        }
        return _authorize_url(f"{self._base}/authorize", params)

    async def exchange_code(self, code: str) -> OAuthUserProfile:
        async with httpx.AsyncClient(timeout=20.0) as client:
            tok = await client.post(
                f"{self._base}/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"},
            )
            if tok.status_code != 200:
                raise OAuthError(
                    f"microsoft token exchange failed: {tok.status_code} {tok.text[:200]}"
                )
            tok_data = tok.json()
            access_token = tok_data.get("access_token")
            if not access_token:
                raise OAuthError("microsoft returned no access_token")

            # Microsoft Graph OIDC userinfo returns the standard claims.
            profile = (
                await client.get(
                    self.USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            ).json()

            user_id = profile.get("sub")
            if not user_id:
                raise OAuthError("microsoft user id missing")
            email = profile.get("email")
            # Some tenants don't expose email via userinfo — fall back to Graph /me.
            display_name = profile.get("name")
            avatar_url = None
            if not email or not display_name:
                try:
                    me = (
                        await client.get(
                            "https://graph.microsoft.com/v1.0/me",
                            headers={"Authorization": f"Bearer {access_token}"},
                        )
                    ).json()
                    email = email or me.get("mail") or me.get("userPrincipalName")
                    display_name = display_name or me.get("displayName")
                except Exception:  # noqa: BLE001
                    pass

            return OAuthUserProfile(
                provider=self.name,
                provider_user_id=str(user_id),
                email=email,
                display_name=display_name,
                avatar_url=avatar_url,
                access_token=access_token,
                refresh_token=tok_data.get("refresh_token"),
                token_type=tok_data.get("token_type", "Bearer"),
                scope=tok_data.get("scope"),
                expires_at=float(tok_data["expires_in"]) if tok_data.get("expires_in") else None,
            )


def _is_tenant_guid(value: str) -> bool:
    """A tenant GUID is an 8-4-4-4-12 hex string (Azure AD directory id)."""
    if len(value) != 36:
        return False
    parts = value.split("-")
    if len(parts) != 5:
        return False
    expected = [8, 4, 4, 4, 12]
    return all(len(parts[i]) == expected[i] and all(c in "0123456789abcdef" for c in parts[i]) for i in range(5))


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
    if name == "microsoft":
        p = MicrosoftProvider(
            settings.oauth_microsoft_client_id,
            settings.oauth_microsoft_client_secret,
            _redirect_uri("microsoft"),
            tenant=settings.oauth_microsoft_tenant,
        )
        return p if p.is_configured() else None
    return None


def list_configured_providers() -> list[str]:
    """Return the list of provider names that have credentials configured."""
    return [
        n for n in ("github", "google", "microsoft") if get_provider(n) is not None
    ]


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
