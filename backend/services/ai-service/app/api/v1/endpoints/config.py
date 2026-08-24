"""AI config endpoints: API key management + active provider/model."""
from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentUserDep
from app.core.config import settings
from app.schemas.config import (
    ActiveSelection,
    ActiveSelectionUpdate,
    AIConfigSnapshot,
    ProviderConfig,
    ProviderConfigUpdate,
)
from app.services.ai_config_store import get_config_store

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
    return AIConfigSnapshot(providers=providers, provider_configs=provider_configs, active=sel)


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
