"""Optional integration with the central config-service.

When `CONFIG_SERVICE_URL` is configured, the email-service will:
- register itself on startup (POST /services + bulk-upsert its config schema)
- send periodic heartbeats (POST /services/{slug}/heartbeat)
- periodically pull the latest runtime config (GET /services/{slug}/runtime)

Pulled values are NOT applied to the live `Settings` object (Pydantic
immutability); instead they are exposed via `get_live_overrides()` so callers
can opt in. This keeps startup stable and predictable.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SERVICE_SLUG = "email-service"


def _descriptor() -> dict[str, Any]:
    return {
        "slug": SERVICE_SLUG,
        "display_name": "临时邮箱",
        "description": "随机生成临时邮箱、收发邮件、30 天自动清理",
        "version": "0.2.0",
        "icon": "mail",
        "base_url": f"http://127.0.0.1:{settings.api_port}",
        "health_url": f"http://127.0.0.1:{settings.api_port}/",
    }


def _schema() -> list[dict[str, Any]]:
    """Publish the email-service's user-facing config keys."""
    return [
        {
            "key": "EMAIL_DOMAIN",
            "display_name": "收信域名",
            "description": "只接收该域名下的邮件",
            "group": "smtp",
            "value_type": "string",
            "default_value": settings.email_domain,
            "current_value": settings.email_domain,
            "is_secret": False,
            "is_readonly": False,
        },
        {
            "key": "SMTP_PORT",
            "display_name": "SMTP 端口",
            "description": "25 / 465 / 587 / 1025 (dev)",
            "group": "smtp",
            "value_type": "int",
            "default_value": str(settings.smtp_port),
            "current_value": str(settings.smtp_port),
            "is_secret": False,
            "is_readonly": False,
        },
        {
            "key": "SMTP_USE_TLS",
            "display_name": "启用 TLS",
            "description": "SMTP 接收端是否要求 STARTTLS / 隐式 TLS",
            "group": "smtp",
            "value_type": "bool",
            "default_value": "false" if not settings.smtp_use_tls else "true",
            "current_value": "false" if not settings.smtp_use_tls else "true",
            "is_secret": False,
            "is_readonly": False,
        },
        {
            "key": "RETENTION_DAYS",
            "display_name": "数据保留天数",
            "description": "邮箱/邮件到期自动清理",
            "group": "retention",
            "value_type": "int",
            "default_value": str(settings.retention_days),
            "current_value": str(settings.retention_days),
            "is_secret": False,
            "is_readonly": False,
        },

    ]


# In-memory cache of the latest overrides fetched from config-service.
_live_overrides: Dict[str, Any] = {}


def get_live_overrides() -> Dict[str, Any]:
    return dict(_live_overrides)


class ConfigSync:
    """Background task that talks to the central config-service."""

    def __init__(self) -> None:
        self._base_url = (settings.config_service_url or "").rstrip("/")
        self._heartbeat_interval = max(15, int(settings.config_service_heartbeat_interval_seconds))
        self._pull_interval = max(30, int(settings.config_service_pull_interval_seconds))
        self._stop_event = asyncio.Event()
        self._tasks: list[asyncio.Task] = []

    @property
    def enabled(self) -> bool:
        return bool(self._base_url)

    async def register(self) -> None:
        if not self.enabled:
            return
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                r = await client.post(f"{self._base_url}/api/v1/services", json=_descriptor())
                r.raise_for_status()
                logger.info("Registered with config-service: %s", r.json().get("slug"))
            except Exception as exc:  # noqa: BLE001
                logger.warning("config-service registration failed: %s", exc)
                return

            try:
                r = await client.post(
                    f"{self._base_url}/api/v1/services/{SERVICE_SLUG}/configs/bulk",
                    json=_schema(),
                )
                r.raise_for_status()
                logger.info("Published %d config keys to config-service", len(_schema()))
            except Exception as exc:  # noqa: BLE001
                logger.warning("config-service schema publish failed: %s", exc)

    async def _heartbeat_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{self._base_url}/api/v1/services/{SERVICE_SLUG}/heartbeat",
                        json={
                            "heartbeat_meta": {
                                "version": _descriptor().get("version"),
                                "pid": __import__("os").getpid(),
                            }
                        },
                    )
            except Exception as exc:  # noqa: BLE001
                logger.debug("heartbeat failed: %s", exc)
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._heartbeat_interval)
            except asyncio.TimeoutError:
                pass

    async def _pull_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    r = await client.get(
                        f"{self._base_url}/api/v1/services/{SERVICE_SLUG}/runtime"
                    )
                    if r.status_code == 200:
                        global _live_overrides
                        _live_overrides = r.json()
                        logger.debug("pulled live overrides: %s", _live_overrides)
            except Exception as exc:  # noqa: BLE001
                logger.debug("pull failed: %s", exc)
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._pull_interval)
            except asyncio.TimeoutError:
                pass

    async def start(self) -> None:
        if not self.enabled:
            return
        await self.register()
        self._tasks = [
            asyncio.create_task(self._heartbeat_loop(), name="config-heartbeat"),
            asyncio.create_task(self._pull_loop(), name="config-pull"),
        ]
        logger.info(
            "config-service sync started (heartbeat=%ds, pull=%ds)",
            self._heartbeat_interval,
            self._pull_interval,
        )

    async def stop(self) -> None:
        self._stop_event.set()
        for t in self._tasks:
            t.cancel()
        for t in self._tasks:
            try:
                await t
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        self._tasks = []


_sync_instance: Optional[ConfigSync] = None


async def start_config_sync() -> None:
    global _sync_instance
    if _sync_instance is not None:
        return
    sync = ConfigSync()
    _sync_instance = sync
    await sync.start()


async def stop_config_sync() -> None:
    global _sync_instance
    if _sync_instance is None:
        return
    await _sync_instance.stop()
    _sync_instance = None