"""OAuth login endpoints (GitHub / Google)."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.auth import TokenResponse, UserRead
from app.services import oauth_link_service
from app.services.oauth import (
    OAuthError,
    generate_state,
    get_provider,
    list_configured_providers,
    sign_state,
    verify_state,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oauth", tags=["oauth"])


@router.get("/providers", summary="List OAuth providers that are configured on this server.")
async def list_providers() -> dict:
    providers = list_configured_providers()
    return {
        "providers": [
            {"name": "github", "configured": "github" in providers},
            {"name": "google", "configured": "google" in providers},
            {"name": "microsoft", "configured": "microsoft" in providers},
        ],
        "configured": providers,
    }


@router.get(
    "/{provider}/start",
    summary="Begin OAuth login — redirects the browser to the provider.",
)
async def oauth_start(
    provider: str,
    redirect_to: Optional[str] = Query(default=None, description="Frontend URL to land on after callback."),
) -> RedirectResponse:
    p = get_provider(provider)
    if p is None:
        raise HTTPException(status_code=404, detail=f"OAuth provider '{provider}' is not configured")
    state = generate_state()
    signed = sign_state(provider, state)
    # Pack redirect_to and response_mode into the (signed) state so we can
    # recover them on the callback without storing server-side state.
    from urllib.parse import quote
    extras = []
    if redirect_to:
        extras.append("redirect_to=" + quote(redirect_to, safe=""))
    extras.append("response_mode=html")
    if extras:
        signed = f"{signed}::" + "&".join(extras)
    return RedirectResponse(p.get_authorize_url(state, scopes=[]))


@router.get(
    "/{provider}/callback",
    summary="OAuth callback handler. Trades the code for a profile and issues a JWT.",
)
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    redirect_to: Optional[str] = Query(default=None),
    response_mode: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(db_session),
) -> TokenResponse:
    p = get_provider(provider)
    if p is None:
        raise HTTPException(status_code=404, detail=f"OAuth provider '{provider}' is not configured")
    base_state = state.split("::", 1)[0]
    if not verify_state(provider, base_state):
        raise HTTPException(status_code=400, detail="OAuth state mismatch")
    extras = {}
    if "::" in state:
        from urllib.parse import parse_qs, unquote
        for kv in state.split("::", 1)[1].split("&"):
            if "=" in kv:
                k, v = kv.split("=", 1)
                extras[k] = unquote(v)
    redirect_to = redirect_to or extras.get("redirect_to")
    response_mode = response_mode or extras.get("response_mode")
    try:
        profile = await p.exchange_code(code)
    except OAuthError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    try:
        user = await oauth_link_service.find_or_create_user(session, profile)
    except oauth_link_service.OAuthLinkError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    from datetime import datetime, timezone
    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()
    access = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "via": provider},
    )
    token = TokenResponse(
        access_token=access,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(user),
    )
    # If the client opted into "html" mode, return an auto-redirect page so
    # the browser can navigate without needing fetch+popup plumbing.
    if response_mode == "html":
        import html as _html
        from urllib.parse import quote
        user_json = _html.escape(token.model_dump_json())
        target = _html.escape(redirect_to or "/")
        html = f"""<!doctype html><html><head><meta charset="utf-8"><title>登录成功</title>
<script>
  try {{
    localStorage.setItem("arknexus.token", {quote(token.access_token)});
    localStorage.setItem("arknexus.user", {user_json});
    window.location.replace({quote(target)});
  }} catch (e) {{
    document.body.innerText = "登录失败: " + e;
  }}
</script></head><body>登录成功，正在跳转...</body></html>"""
        return JSONResponse(content=html, media_type="text/html")
    return token
