"""LLM catalog endpoints (proxy over config-service to keep the frontend dependency-free)."""
from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, Depends

from app.api.deps import CurrentUserDep
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai-catalog"])

CONFIG_BASE = (settings.config_service_url or "").rstrip("/")


async def _proxy_get(path: str) -> Any:
    if not CONFIG_BASE:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{CONFIG_BASE}{path}")
            if r.status_code == 200:
                return r.json()
    except Exception as exc:
        logger.debug("catalog proxy %s failed: %s", path, exc)
    return None


@router.get("/ai/catalog", summary="Supported LLM providers + models.")
async def get_catalog(_user=CurrentUserDep) -> Dict[str, Any]:
    data = await _proxy_get("/api/v1/llm/catalog")
    return data or {"providers": []}


@router.get("/ai/providers", summary="Slim provider metadata.")
async def get_providers(_user=CurrentUserDep) -> List[Dict[str, Any]]:
    data = await _proxy_get("/api/v1/llm/providers")
    return data or []


@router.get("/ai/providers/{provider_id}/models", summary="Models for one provider.")
async def get_provider_models(provider_id: str, _user=CurrentUserDep) -> Dict[str, Any]:
    data = await _proxy_get(f"/api/v1/llm/providers/{provider_id}/models")
    return data or {"provider_id": provider_id, "models": []}
