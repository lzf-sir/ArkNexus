"""Persisted AI service configuration.

Stores per-provider API keys + active provider/model selection. Persistence
strategy:

  * If config-service is reachable: API keys live as is_secret values under
    the ai-service slug. Active selection is stored as plain current_value
    entries under AI_ACTIVE_PROVIDER and AI_ACTIVE_MODEL.
  * If config-service URL is empty: in-memory only.

Adding a new provider requires no code changes here. The schema is published
on startup from the static catalog.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SERVICE_SLUG = "ai-service"

KEY_ACTIVE_PROVIDER = "AI_ACTIVE_PROVIDER"
KEY_ACTIVE_MODEL = "AI_ACTIVE_MODEL"
KEY_API_KEY_PREFIX = "AI_API_KEY_"
KEY_BASE_URL_PREFIX = "AI_BASE_URL_"

# Global default generation parameters (configured from 系统设置 → AI 模型配置).
KEY_DEFAULT_TEMPERATURE = "AI_DEFAULT_TEMPERATURE"
KEY_DEFAULT_MAX_TOKENS = "AI_DEFAULT_MAX_TOKENS"
KEY_DEFAULT_TOP_P = "AI_DEFAULT_TOP_P"


def _provider_key(provider_id: str) -> str:
    return f"{KEY_API_KEY_PREFIX}{provider_id.upper()}"


def _base_url_key(provider_id: str) -> str:
    return f"{KEY_BASE_URL_PREFIX}{provider_id.upper()}"


class AIConfigStore:
    def __init__(self) -> None:
        self._base_url = (settings.config_service_url or "").rstrip("/")
        self._lock = asyncio.Lock()
        self._mem_keys: Dict[str, str] = {}
        self._mem_base_url: Dict[str, str] = {}
        self._mem_active_provider: Optional[str] = None
        self._mem_active_model: Optional[str] = None

    async def _get(self, key: str) -> Optional[str]:
        if not self._base_url:
            return self._mem_keys.get(key)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    f"{self._base_url}/api/v1/services/{SERVICE_SLUG}/runtime"
                )
                if r.status_code == 200:
                    data = r.json()
                    v = data.get(key)
                    return str(v) if v is not None else None
        except Exception as exc:
            logger.debug("config-service read %s failed: %s", key, exc)
        return self._mem_keys.get(key)

    async def _set(self, key: str, value: Optional[str]) -> None:
        self._mem_keys[key] = value or ""
        if not self._base_url:
            return
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.patch(
                    f"{self._base_url}/api/v1/services/{SERVICE_SLUG}/configs/{key}/value",
                    json={"value": value, "note": "ai-service updated"},
                )
        except Exception as exc:
            logger.warning("config-service write %s failed: %s", key, exc)

    async def _ensure_schema_published(self) -> None:
        if not self._base_url:
            return
        schema = [
            {
                "key": KEY_ACTIVE_PROVIDER,
                "display_name": "AI 当前服务商",
                "description": "默认使用的 LLM 服务商 ID",
                "group": "ai",
                "value_type": "string",
                "default_value": "",
            },
            {
                "key": KEY_ACTIVE_MODEL,
                "display_name": "AI 当前模型",
                "description": "默认使用的模型 ID",
                "group": "ai",
                "value_type": "string",
                "default_value": "",
            },
            {
                "key": KEY_DEFAULT_TEMPERATURE,
                "display_name": "默认 Temperature",
                "description": "新建对话时使用的默认采样温度 (0-2)",
                "group": "ai",
                "value_type": "float",
                "default_value": "0.7",
            },
            {
                "key": KEY_DEFAULT_MAX_TOKENS,
                "display_name": "默认 Max Tokens",
                "description": "新建对话时使用的默认最大生成长度",
                "group": "ai",
                "value_type": "int",
                "default_value": "2048",
            },
            {
                "key": KEY_DEFAULT_TOP_P,
                "display_name": "默认 Top P",
                "description": "新建对话时使用的默认 nucleus 采样概率 (0-1)",
                "group": "ai",
                "value_type": "float",
                "default_value": "1.0",
            },
        ]
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{self._base_url}/api/v1/services/{SERVICE_SLUG}/configs/bulk",
                    json=schema,
                )
        except Exception as exc:
            logger.debug("schema publish failed: %s", exc)

    async def bootstrap(self) -> None:
        await self._ensure_schema_published()
        if not self._base_url:
            return
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    f"{self._base_url}/api/v1/services/{SERVICE_SLUG}/runtime"
                )
                if r.status_code != 200:
                    return
                data = r.json()
                self._mem_active_provider = data.get(KEY_ACTIVE_PROVIDER) or None
                self._mem_active_model = data.get(KEY_ACTIVE_MODEL) or None
                for k, v in data.items():
                    if k.startswith(KEY_API_KEY_PREFIX):
                        self._mem_keys[k] = str(v) if v else ""
                    elif k.startswith(KEY_BASE_URL_PREFIX):
                        provider_part = k[len(KEY_BASE_URL_PREFIX):].lower()
                        self._mem_base_url[provider_part] = str(v) if v else ""
        except Exception as exc:
            logger.debug("bootstrap pull failed: %s", exc)

    async def set_api_key(self, provider_id: str, api_key: Optional[str]) -> None:
        await self._set(_provider_key(provider_id), api_key)

    async def get_api_key(self, provider_id: str) -> str:
        return (await self._get(_provider_key(provider_id))) or ""

    async def set_base_url_override(self, provider_id: str, base_url: Optional[str]) -> None:
        await self._set(_base_url_key(provider_id), base_url)
        if base_url:
            self._mem_base_url[provider_id] = base_url
        else:
            self._mem_base_url.pop(provider_id, None)

    async def get_base_url_override(self, provider_id: str) -> Optional[str]:
        v = await self._get(_base_url_key(provider_id))
        if v:
            return v
        return self._mem_base_url.get(provider_id)

    async def set_active(self, provider_id: str, model_id: str) -> None:
        await self._set(KEY_ACTIVE_PROVIDER, provider_id)
        await self._set(KEY_ACTIVE_MODEL, model_id)
        self._mem_active_provider = provider_id
        self._mem_active_model = model_id

    async def get_active(self) -> Dict[str, Optional[str]]:
        prov = await self._get(KEY_ACTIVE_PROVIDER) or self._mem_active_provider
        mod = await self._get(KEY_ACTIVE_MODEL) or self._mem_active_model
        return {"provider_id": prov, "model_id": mod}

    async def snapshot_provider_configs(self, provider_ids: List[str]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for pid in provider_ids:
            api_key = await self.get_api_key(pid)
            base_url = await self.get_base_url_override(pid)
            masked = None
            if api_key:
                if len(api_key) > 8:
                    masked = api_key[:4] + "***" + api_key[-4:]
                else:
                    masked = api_key
            out.append(
                {
                    "provider_id": pid,
                    "api_key": masked,
                    "api_key_set": bool(api_key),
                    "base_url_override": base_url,
                }
            )
        return out

    async def get_default_params(self) -> Dict[str, Optional[float]]:
        """Global default generation parameters (temperature / max_tokens / top_p)."""
        temp = await self._get(KEY_DEFAULT_TEMPERATURE)
        mt = await self._get(KEY_DEFAULT_MAX_TOKENS)
        tp = await self._get(KEY_DEFAULT_TOP_P)
        return {
            "temperature": float(temp) if temp not in (None, "") else None,
            "max_tokens": int(mt) if mt not in (None, "") else None,
            "top_p": float(tp) if tp not in (None, "") else None,
        }

    async def set_default_params(self, params: Dict[str, Optional[float]]) -> None:
        mapping = {
            "temperature": KEY_DEFAULT_TEMPERATURE,
            "max_tokens": KEY_DEFAULT_MAX_TOKENS,
            "top_p": KEY_DEFAULT_TOP_P,
        }
        for field, key in mapping.items():
            if field in params:
                value = params[field]
                await self._set(key, None if value is None else str(value))


_instance: Optional[AIConfigStore] = None


def get_config_store() -> AIConfigStore:
    global _instance
    if _instance is None:
        _instance = AIConfigStore()
    return _instance
