"""AI config endpoints: API key management + active provider/model."""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentUserDep
from app.core.config import settings
from app.schemas.config import (
    ActiveSelection,
    ActiveSelectionUpdate,
    AIConfigSnapshot,
    DefaultParams,
    DefaultParamsUpdate,
    ProviderConfig,
    ProviderConfigUpdate,
)
from app.services.ai_config_store import get_config_store
from app.services.llm_client import UpstreamError, _auth_headers, _resolve_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai-config"])

CONFIG_BASE = (settings.config_service_url or "").rstrip("/")


async def _fetch_catalog_providers() -> List[Dict[str, Any]]:
    if not CONFIG_BASE:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{CONFIG_BASE}/api/v1/llm/providers")
            if r.status_code == 200:
                return r.json()
    except Exception as exc:
        logger.debug("catalog fetch failed: %s", exc)
    return []


@router.get("/ai/config", response_model=AIConfigSnapshot, summary="Full AI configuration snapshot.")
async def get_ai_config(_user=CurrentUserDep) -> AIConfigSnapshot:
    providers = await _fetch_catalog_providers()
    provider_ids = [p["id"] for p in providers]
    cfg_store = get_config_store()
    provider_configs = await cfg_store.snapshot_provider_configs(provider_ids)
    active = await cfg_store.get_active()
    sel = None
    if active.get("provider_id") and active.get("model_id"):
        sel = ActiveSelection(provider_id=active["provider_id"], model_id=active["model_id"])
    return AIConfigSnapshot(
        providers=providers,
        provider_configs=provider_configs,
        active=sel,
        default_params=DefaultParams(**(await cfg_store.get_default_params())),
    )


@router.put("/ai/config/provider/{provider_id}", response_model=ProviderConfig, summary="Save a provider API key (or base_url override).")
async def update_provider_config(provider_id: str, payload: ProviderConfigUpdate, _user=CurrentUserDep) -> ProviderConfig:
    if payload.provider_id != provider_id:
        payload = payload.model_copy(update={"provider_id": provider_id})
    cfg_store = get_config_store()
    if payload.api_key is not None:
        await cfg_store.set_api_key(provider_id, payload.api_key or None)
    if payload.base_url_override is not None:
        await cfg_store.set_base_url_override(provider_id, payload.base_url_override or None)
    snap = await cfg_store.snapshot_provider_configs([provider_id])
    s = snap[0] if snap else {"provider_id": provider_id, "api_key": None, "api_key_set": False, "base_url_override": None}
    return ProviderConfig(**s)


@router.delete("/ai/config/provider/{provider_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Forget the API key + base_url override for a provider.")
async def clear_provider_config(provider_id: str, _user=CurrentUserDep) -> None:
    cfg_store = get_config_store()
    await cfg_store.set_api_key(provider_id, None)
    await cfg_store.set_base_url_override(provider_id, None)


@router.put("/ai/config/active", response_model=ActiveSelection, summary="Set the active provider + model.")
async def set_active(payload: ActiveSelectionUpdate, _user=CurrentUserDep) -> ActiveSelection:
    await get_config_store().set_active(payload.provider_id, payload.model_id)
    return ActiveSelection(provider_id=payload.provider_id, model_id=payload.model_id)


@router.put("/ai/config/defaults", response_model=DefaultParams, summary="Save global default generation parameters.")
async def update_default_params(payload: DefaultParamsUpdate, _user=CurrentUserDep) -> DefaultParams:
    params: Dict[str, Optional[float]] = {}
    if payload.temperature is not None:
        params["temperature"] = payload.temperature
    if payload.max_tokens is not None:
        params["max_tokens"] = payload.max_tokens
    if payload.top_p is not None:
        params["top_p"] = payload.top_p
    await get_config_store().set_default_params(params)
    return DefaultParams(**(await get_config_store().get_default_params()))


@router.post(
    "/ai/config/provider/{provider_id}/test",
    summary="Probe a provider by sending a tiny 'hi' request.",
)
async def test_provider_connection(provider_id: str, _user=CurrentUserDep) -> Dict[str, Any]:
    """Send a 1-token completion to verify the configured API key + base URL work.

    Returns a small JSON envelope:

      * ``ok`` - True on success
      * ``status`` - HTTP status from the upstream (None on transport error)
      * ``latency_ms`` - round-trip time
      * ``reply`` - first ~80 chars of the upstream reply (or error excerpt)
    """
    if not CONFIG_BASE:
        raise HTTPException(status_code=503, detail="config-service 未连接，无法读取目录")

    providers = await _fetch_catalog_providers()
    provider = next((p for p in providers if p.get("id") == provider_id), None)
    if provider is None:
        raise HTTPException(status_code=404, detail=f"未知服务商: {provider_id}")

    cfg_store = get_config_store()
    api_key = await cfg_store.get_api_key(provider_id)
    if not api_key:
        return {
            "ok": False,
            "status": None,
            "latency_ms": 0,
            "reply": "尚未配置 API Key",
        }
    base_url_override = await cfg_store.get_base_url_override(provider_id)

    # Pick the first model — we only care about a successful round-trip.
    models = provider.get("models") or []
    if not models:
        raise HTTPException(status_code=400, detail="该服务商没有任何模型")
    model_id = models[0].get("id") or ""

    style = provider.get("api_style", "openai")
    try:
        url = _resolve_url(provider, base_url_override)
    except UpstreamError as exc:
        return {"ok": False, "status": None, "latency_ms": 0, "reply": str(exc)}

    headers = _auth_headers(provider, api_key)
    headers["Content-Type"] = "application/json"
    if style == "anthropic":
        headers["anthropic-version"] = "2023-06-01"

    if style == "anthropic":
        payload: Dict[str, Any] = {
            "model": model_id,
            "max_tokens": 8,
            "messages": [{"role": "user", "content": "hi"}],
        }
    else:
        payload = {
            "model": model_id,
            "messages": [{"role": "user", "content": "hi"}],
            "max_tokens": 8,
            "stream": False,
        }

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        return {
            "ok": False,
            "status": None,
            "latency_ms": int((time.monotonic() - start) * 1000),
            "reply": f"网络错误: {exc}",
        }
    latency_ms = int((time.monotonic() - start) * 1000)

    if r.status_code >= 400:
        # Try to surface a useful error excerpt.
        try:
            j = r.json()
            if isinstance(j, dict):
                excerpt = str(j.get("error", {}).get("message") or j)[:240]
            else:
                excerpt = str(j)[:240]
        except Exception:  # noqa: BLE001
            excerpt = r.text[:240]
        return {
            "ok": False,
            "status": r.status_code,
            "latency_ms": latency_ms,
            "reply": excerpt,
        }

    return {
        "ok": True,
        "status": r.status_code,
        "latency_ms": latency_ms,
        "reply": "OK",
        "model": model_id,
    }
