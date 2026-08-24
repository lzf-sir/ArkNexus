"""First-run initialization logic.

Validates and persists the wizard's choices, creates the admin user, and runs
schema migrations if needed. All state lives in the `system_state` table.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime as _dt, timezone
from typing import Any, Optional
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models.system_state import SystemState
from app.models.user import User

logger = logging.getLogger(__name__)


INIT_KEYS = {
    "initialized": False,
    "database_url": "",
    "database_driver": "sqlite",
    "redis_url": "",
    "email_domain": "arknexus.local",
    "admin_user_id": None,
    "completed_at": None,
}


class InitError(Exception):
    """Raised for any validation failure during the init wizard."""


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {"true", "1", "yes", "on"}
    return bool(value)


async def _get(session: AsyncSession, key: str) -> Optional[SystemState]:
    stmt = select(SystemState).where(SystemState.key == key)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def _set(
    session: AsyncSession,
    key: str,
    value: Any,
    *,
    meta: Optional[dict] = None,
) -> None:
    row = await _get(session, key)
    if row is None:
        row = SystemState(key=key, value=value, meta=meta)
        session.add(row)
    else:
        row.value = value
        if meta is not None:
            row.meta = meta
    await session.commit()


async def is_initialized(session: AsyncSession) -> bool:
    row = await _get(session, "initialized")
    return bool(row and _coerce_bool(row.value))


async def get_full_state(session: AsyncSession) -> dict[str, Any]:
    """Return everything we know about the system config for the wizard."""
    keys = [
        "initialized",
        "database_url",
        "database_driver",
        "redis_url",
        "email_domain",
        "admin_user_id",
        "completed_at",
    ]
    out: dict[str, Any] = {k: None for k in keys}
    for k in keys:
        row = await _get(session, k)
        if row is not None:
            out[k] = row.value
    # Also include runtime defaults so the wizard UI can prefill them.
    if not out["database_url"]:
        out["database_url"] = settings.database_url
    if not out["email_domain"]:
        out["email_domain"] = settings.email_domain
    return out


def detect_database_driver(url: str) -> str:
    if not url:
        return "sqlite"
    head = url.split("://", 1)[0].lower()
    if "+" in head:
        head = head.split("+", 1)[0]
    return head


def validate_database_url(url: str) -> dict[str, Any]:
    """Validate the chosen DB URL. Returns metadata to display in the UI."""
    if not url:
        raise InitError("数据库 URL 不能为空")

    try:
        parsed = urlparse(url)
    except Exception as exc:  # noqa: BLE001
        raise InitError(f"数据库 URL 格式错误：{exc}") from exc

    if parsed.scheme not in {"sqlite", "sqlite+aiosqlite", "postgresql", "postgresql+asyncpg", "mysql", "mysql+aiomysql"}:
        raise InitError(
            f"不支持的数据库驱动：{parsed.scheme}（仅支持 sqlite / postgresql / mysql）"
        )

    if parsed.scheme.startswith("sqlite") and not (parsed.path or "").endswith(".db"):
        raise InitError("SQLite URL 必须以 .db 结尾，例如 sqlite+aiosqlite:///./data/app.db")

    if parsed.scheme.startswith("postgresql") and not parsed.hostname:
        raise InitError("PostgreSQL URL 必须包含 host")

    return {
        "driver": detect_database_driver(url),
        "scheme": parsed.scheme,
        "host": parsed.hostname,
        "port": parsed.port,
        "database": parsed.path.lstrip("/") if parsed.path else "",
    }


def validate_redis_url(url: str) -> Optional[dict[str, Any]]:
    """Redis is optional. Empty means "skip". Returns None on skip, else metadata."""
    if not url:
        return None
    try:
        parsed = urlparse(url)
    except Exception as exc:  # noqa: BLE001
        raise InitError(f"Redis URL 格式错误：{exc}") from exc
    if parsed.scheme not in {"redis", "rediss"}:
        raise InitError("Redis URL 必须以 redis:// 或 rediss:// 开头")
    return {"scheme": parsed.scheme, "host": parsed.hostname, "port": parsed.port}


def validate_domain(domain: str) -> str:
    domain = (domain or "").strip().lower()
    if not domain:
        raise InitError("域名不能为空")
    if " " in domain or "/" in domain:
        raise InitError("域名格式错误")
    if "." not in domain:
        raise InitError("域名需要包含点，例如 example.com")
    return domain


async def save_database_choice(session: AsyncSession, url: str) -> dict[str, Any]:
    meta = validate_database_url(url)
    await _set(session, "database_url", url, meta=meta)
    await _set(session, "database_driver", meta["driver"])
    return meta


async def save_redis_choice(session: AsyncSession, url: str) -> Optional[dict[str, Any]]:
    meta = validate_redis_url(url)
    await _set(session, "redis_url", url or "")
    return meta


async def save_domain_choice(session: AsyncSession, domain: str) -> str:
    normalized = validate_domain(domain)
    await _set(session, "email_domain", normalized)
    return normalized


async def create_admin(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    display_name: Optional[str] = None,
) -> User:
    """Create the first admin user. Raises InitError on validation failures."""
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        raise InitError("管理员邮箱格式错误")
    if not password or len(password) < 8:
        raise InitError("管理员密码至少 8 位")

    # Reject if any user exists (we treat this strictly: one admin only at init time).
    existing = await session.execute(select(User).limit(1))
    if existing.scalar_one_or_none() is not None:
        raise InitError("系统已有用户存在，不能再次初始化")

    user = User(
        email=email,
        display_name=display_name or "Admin",
        password_hash=hash_password(password),
        is_active=True,
        is_admin=True,
        is_verified=True,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise InitError(f"邮箱已被注册：{email}") from exc
    await session.refresh(user)
    return user


async def finalize_initialization(session: AsyncSession) -> dict[str, Any]:
    """Mark the system as fully initialized.

    This does NOT run Alembic (the app's lifespan already does it). It just
    flips the `initialized` flag so future startup skips the wizard.
    """
    # Make sure admin user exists
    admin_id = await _get(session, "admin_user_id")
    if not admin_id or not admin_id.value:
        raise InitError("缺少管理员账号信息")

    await _set(session, "initialized", "true")
    await _set(session, "completed_at", _dt.now(timezone.utc).isoformat())
    return {"initialized": True}


async def reset_for_testing(session: AsyncSession) -> None:
    """Dev helper: wipe system_state (not used by HTTP)."""
    for k in list(INIT_KEYS):
        row = await _get(session, k)
        if row is not None:
            await session.delete(row)
    await session.commit()