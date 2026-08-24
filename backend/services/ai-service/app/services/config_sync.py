"""Heartbeat + registration with the central config-service."""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SERVICE_SLUG = "ai-service"


def _descriptor() -> Dict[str, Any]:
    return {
        "slug": SERVICE_SLUG,
        "display_name": "AI 助手",
        "description": "多模型对话、AI 会话、流式输出",
        "version": "0.1.0",
        "icon": "robot",
        "base_url": f"http://127.0.0.1:{settings.api_port}",
        "health_url": f"http://127.0.0.1:{settings.api_port}/",
    }

class ConfigSync:
    def __init__(self) -> None:
        self._base_url = (settings.config_service_url or "").rstrip("/")
        self._interval = max(15, int(settings.config_service_heartbeat_interval_seconds))
        self._stop = asyncio.Event()
        self._tasks: list[asyncio.Task] = []

    @property
    def enabled(self) -> bool:
        return bool(self._base_url)

    async def register(self) -> None:
        if not self.enabled:
            return
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(f"{self._base_url}/api/v1/services", json=_descriptor())
                r.raise_for_status()
                logger.info("Registered with config-service: %s", r.json().get("slug"))
        except Exception as exc:
            logger.warning("config-service registration failed: %s", exc)

    async def _heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{self._base_url}/api/v1/services/{SERVICE_SLUG}/heartbeat",
                        json={"heartbeat_meta": {"version": _descriptor().get("version")}},
                    )
            except Exception as exc:
                logger.debug("heartbeat failed: %s", exc)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                pass

    async def start(self) -> None:
        if not self.enabled:
            return
        await self.register()
        self._tasks = [asyncio.create_task(self._heartbeat_loop(), name="ai-heartbeat")]
        logger.info("config-service sync started (interval=%ds)", self._interval)

    async def stop(self) -> None:
        self._stop.set()
        for t in self._tasks:
            t.cancel()
        for t in self._tasks:
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass
        self._tasks = []

_instance: Optional[ConfigSync] = None

async def start_config_sync() -> None:
    global _instance
    if _instance is not None:
        return
    s = ConfigSync()
    _instance = s
    await s.start()

async def stop_config_sync() -> None:
    global _instance
    if _instance is None:
        return
    await _instance.stop()
    _instance = None
