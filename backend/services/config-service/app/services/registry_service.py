"""Business logic for the service registry + config keys."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime as _dt, timedelta, timezone
from typing import Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.registry import ConfigHistory, ConfigKey, Service
from app.schemas.registry import (
    ConfigHistoryRead,
    ConfigKeyGrouped,
    ConfigKeyRead,
    ConfigKeyUpsert,
    ConfigValueUpdate,
    HeartbeatRequest,
    ServiceRead,
    ServiceRegister,
)


class ServiceNotFound(Exception):
    pass


class ConfigKeyNotFound(Exception):
    pass


def _is_online(last_heartbeat_at, *, now=None):
    """Return True when the service heartbeat is within the configured timeout."""
    ref = now or _dt.now(timezone.utc)
    if last_heartbeat_at is None:
        return False
    if last_heartbeat_at.tzinfo is None:
        last_heartbeat_at = last_heartbeat_at.replace(tzinfo=timezone.utc)
    return (ref - last_heartbeat_at) <= timedelta(seconds=settings.service_heartbeat_timeout_seconds)


def service_to_read(svc: Service) -> ServiceRead:
    return ServiceRead(
        id=svc.id,
        slug=svc.slug,
        display_name=svc.display_name,
        description=svc.description,
        version=svc.version,
        icon=svc.icon,
        base_url=svc.base_url,
        health_url=svc.health_url,
        is_active=svc.is_active,
        first_seen_at=svc.first_seen_at,
        last_heartbeat_at=svc.last_heartbeat_at,
        is_online=_is_online(svc.last_heartbeat_at),
    )


async def list_services(session: AsyncSession) -> List[ServiceRead]:
    stmt = select(Service).order_by(Service.display_name.asc())
    result = await session.execute(stmt)
    return [service_to_read(s) for s in result.scalars().unique().all()]


async def get_service_by_slug(session: AsyncSession, slug: str) -> Service:
    stmt = select(Service).where(Service.slug == slug)
    result = await session.execute(stmt)
    svc = result.scalar_one_or_none()
    if svc is None:
        raise ServiceNotFound(slug)
    return svc


async def register_or_update_service(
    session: AsyncSession, payload: ServiceRegister
) -> ServiceRead:
    """Idempotent register: creates or refreshes a service entry + heartbeat."""
    stmt = select(Service).where(Service.slug == payload.slug)
    result = await session.execute(stmt)
    svc = result.scalar_one_or_none()
    now = _dt.now(timezone.utc)

    if svc is None:
        svc = Service(
            slug=payload.slug,
            display_name=payload.display_name,
            description=payload.description,
            version=payload.version,
            icon=payload.icon,
            base_url=payload.base_url,
            health_url=payload.health_url,
            last_heartbeat_at=now,
            last_heartbeat_meta=payload.heartbeat_meta,
        )
        session.add(svc)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            return await register_or_update_service(session, payload)
    else:
        svc.display_name = payload.display_name
        svc.description = payload.description
        svc.version = payload.version
        svc.icon = payload.icon
        svc.base_url = payload.base_url
        svc.health_url = payload.health_url
        svc.last_heartbeat_at = now
        svc.last_heartbeat_meta = payload.heartbeat_meta
        await session.commit()

    await session.refresh(svc)
    return service_to_read(svc)


async def heartbeat(
    session: AsyncSession, slug: str, payload: Optional[HeartbeatRequest] = None
) -> ServiceRead:
    try:
        svc = await get_service_by_slug(session, slug)
    except ServiceNotFound:
        if payload is None:
            payload = HeartbeatRequest()
        return await register_or_update_service(
            session,
            ServiceRegister(
                slug=slug,
                display_name=slug,
                heartbeat_meta=payload.heartbeat_meta,
            ),
        )
    svc.last_heartbeat_at = _dt.now(timezone.utc)
    if payload and payload.heartbeat_meta is not None:
        svc.last_heartbeat_meta = payload.heartbeat_meta
    await session.commit()
    await session.refresh(svc)
    return service_to_read(svc)


async def delete_service(session: AsyncSession, slug: str) -> None:
    svc = await get_service_by_slug(session, slug)
    await session.delete(svc)
    await session.commit()


# ===== Config keys =====

def config_key_to_read(ck: ConfigKey) -> ConfigKeyRead:
    return ConfigKeyRead.model_validate(ck)


async def list_config_keys_for_service(
    session: AsyncSession, slug: str
) -> List[ConfigKeyRead]:
    svc = await get_service_by_slug(session, slug)
    stmt = (
        select(ConfigKey)
        .where(ConfigKey.service_id == svc.id)
        .order_by(ConfigKey.group.asc().nulls_last(), ConfigKey.sort_order.asc(), ConfigKey.key.asc())
    )
    result = await session.execute(stmt)
    return [config_key_to_read(ck) for ck in result.scalars().unique().all()]


async def list_config_keys_grouped(
    session: AsyncSession, slug: str
) -> List[ConfigKeyGrouped]:
    flat = await list_config_keys_for_service(session, slug)
    grouped: dict = defaultdict(list)
    for ck in flat:
        grouped[ck.group or "默认"].append(ck)
    return [ConfigKeyGrouped(group=g, items=items) for g, items in grouped.items()]


async def get_config_key(session: AsyncSession, slug: str, key: str) -> ConfigKey:
    svc = await get_service_by_slug(session, slug)
    stmt = select(ConfigKey).where(
        ConfigKey.service_id == svc.id, ConfigKey.key == key
    )
    result = await session.execute(stmt)
    ck = result.scalar_one_or_none()
    if ck is None:
        raise ConfigKeyNotFound(f"{slug}/{key}")
    return ck


async def upsert_config_key(
    session: AsyncSession, slug: str, payload: ConfigKeyUpsert
) -> ConfigKeyRead:
    svc = await get_service_by_slug(session, slug)
    stmt = select(ConfigKey).where(
        ConfigKey.service_id == svc.id, ConfigKey.key == payload.key
    )
    result = await session.execute(stmt)
    ck = result.scalar_one_or_none()

    if ck is None:
        ck = ConfigKey(
            service_id=svc.id,
            key=payload.key,
            display_name=payload.display_name,
            description=payload.description,
            group=payload.group,
            value_type=payload.value_type,
            current_value=payload.current_value or payload.default_value,
            default_value=payload.default_value,
            is_secret=payload.is_secret,
            is_readonly=payload.is_readonly,
            is_required=payload.is_required,
            options=payload.options,
            sort_order=payload.sort_order,
        )
        session.add(ck)
    else:
        ck.display_name = payload.display_name
        ck.description = payload.description
        ck.group = payload.group
        ck.value_type = payload.value_type
        ck.default_value = payload.default_value
        ck.is_secret = payload.is_secret
        ck.is_readonly = payload.is_readonly
        ck.is_required = payload.is_required
        ck.options = payload.options
        ck.sort_order = payload.sort_order
        if payload.current_value is not None and ck.current_value is None:
            ck.current_value = payload.current_value

    await session.commit()
    await session.refresh(ck)
    return config_key_to_read(ck)


async def bulk_upsert_config_keys(
    session: AsyncSession, slug: str, items: Iterable[ConfigKeyUpsert]
) -> List[ConfigKeyRead]:
    results: list = []
    for it in items:
        results.append(await upsert_config_key(session, slug, it))
    return results


def _coerce(value, value_type: str):
    if value is None:
        return None
    import json
    if value_type == "string":
        return value
    if value_type == "int":
        return int(value)
    if value_type == "float":
        return float(value)
    if value_type == "bool":
        if value.lower() in ("true", "1", "yes", "on"):
            return True
        if value.lower() in ("false", "0", "no", "off"):
            return False
        raise ValueError(f"Cannot coerce {value!r} to bool")
    if value_type == "json":
        return json.loads(value)
    raise ValueError(f"Unknown value_type {value_type}")


async def update_config_value(
    session: AsyncSession,
    slug: str,
    key: str,
    payload: ConfigValueUpdate,
    *,
    changed_by: Optional[str] = None,
) -> ConfigKeyRead:
    ck = await get_config_key(session, slug, key)
    if ck.is_readonly:
        raise PermissionError(f"Config key {slug}/{key} is read-only")

    if payload.value is not None:
        try:
            _coerce(payload.value, ck.value_type)
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Invalid value for {ck.value_type}: {exc}") from exc

    old = ck.current_value
    ck.current_value = payload.value
    await session.commit()
    await session.refresh(ck)

    history = ConfigHistory(
        config_key_id=ck.id,
        old_value=old,
        new_value=payload.value,
        changed_by=changed_by,
        note=payload.note,
    )
    session.add(history)
    await session.commit()
    return config_key_to_read(ck)


async def get_config_history(
    session: AsyncSession, slug: str, key: str, *, limit: int = 50
) -> List[ConfigHistoryRead]:
    ck = await get_config_key(session, slug, key)
    stmt = (
        select(ConfigHistory)
        .where(ConfigHistory.config_key_id == ck.id)
        .order_by(ConfigHistory.changed_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return [ConfigHistoryRead.model_validate(h) for h in result.scalars().unique().all()]


async def get_runtime_config(session: AsyncSession, slug: str) -> dict:
    """Return a JSON-serializable dict of current values for a service."""
    keys = await list_config_keys_for_service(session, slug)
    out: dict = {}
    for k in keys:
        try:
            out[k.key] = _coerce(k.current_value, k.value_type)
        except Exception:  # noqa: BLE001
            out[k.key] = k.current_value
    return out