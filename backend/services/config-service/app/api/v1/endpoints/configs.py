"""Config key endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.registry import (
    ConfigHistoryRead,
    ConfigKeyGrouped,
    ConfigKeyRead,
    ConfigKeyUpsert,
    ConfigValueUpdate,
)
from app.services import registry_service

router = APIRouter(tags=["configs"])


@router.get(
    "/services/{slug}/configs",
    response_model=List[ConfigKeyRead],
    summary="List all config keys for a service.",
)
async def list_configs(
    slug: str,
    session: AsyncSession = Depends(db_session),
) -> List[ConfigKeyRead]:
    try:
        return await registry_service.list_config_keys_for_service(session, slug)
    except registry_service.ServiceNotFound as exc:
        raise HTTPException(status_code=404, detail=f"Service not found: {exc.args[0]}") from exc


@router.get(
    "/services/{slug}/configs/grouped",
    response_model=List[ConfigKeyGrouped],
    summary="Group config keys by their `group` field (UI convenience).",
)
async def list_configs_grouped(
    slug: str,
    session: AsyncSession = Depends(db_session),
) -> List[ConfigKeyGrouped]:
    try:
        return await registry_service.list_config_keys_grouped(session, slug)
    except registry_service.ServiceNotFound as exc:
        raise HTTPException(status_code=404, detail=f"Service not found: {exc.args[0]}") from exc


@router.put(
    "/services/{slug}/configs/{key}",
    response_model=ConfigKeyRead,
    summary="Upsert a config key (typically called by the service itself).",
)
async def upsert_config(
    slug: str,
    key: str,
    payload: ConfigKeyUpsert,
    session: AsyncSession = Depends(db_session),
) -> ConfigKeyRead:
    # Force the URL key onto the payload so callers do not have to repeat it.
    if payload.key != key:
        payload = payload.model_copy(update={"key": key})
    return await registry_service.upsert_config_key(session, slug, payload)


@router.post(
    "/services/{slug}/configs/bulk",
    response_model=List[ConfigKeyRead],
    summary="Bulk upsert config keys (publishes a whole schema at once).",
)
async def bulk_upsert_configs(
    slug: str,
    items: List[ConfigKeyUpsert],
    session: AsyncSession = Depends(db_session),
) -> List[ConfigKeyRead]:
    return await registry_service.bulk_upsert_config_keys(session, slug, items)


@router.patch(
    "/services/{slug}/configs/{key}/value",
    response_model=ConfigKeyRead,
    summary="Update the current value of a config key (admin UI).",
)
async def update_config_value(
    slug: str,
    key: str,
    payload: ConfigValueUpdate,
    request: Request,
    session: AsyncSession = Depends(db_session),
) -> ConfigKeyRead:
    changed_by = (
        request.headers.get("X-ArkNexus-User")
        or request.headers.get("X-Actor")
        or None
    )
    try:
        return await registry_service.update_config_value(
            session, slug, key, payload, changed_by=changed_by
        )
    except registry_service.ConfigKeyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get(
    "/services/{slug}/configs/{key}/history",
    response_model=List[ConfigHistoryRead],
    summary="Audit trail for a config key.",
)
async def config_history(
    slug: str,
    key: str,
    limit: int = Query(default=50, ge=1, le=500),
    session: AsyncSession = Depends(db_session),
) -> List[ConfigHistoryRead]:
    try:
        return await registry_service.get_config_history(session, slug, key, limit=limit)
    except registry_service.ConfigKeyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/services/{slug}/runtime",
    summary="Return current values as a JSON object (for the owning service).",
)
async def runtime_config(
    slug: str,
    session: AsyncSession = Depends(db_session),
) -> dict:
    try:
        return await registry_service.get_runtime_config(session, slug)
    except registry_service.ServiceNotFound as exc:
        raise HTTPException(status_code=404, detail=f"Service not found: {exc.args[0]}") from exc