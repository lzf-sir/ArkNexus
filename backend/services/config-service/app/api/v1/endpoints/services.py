"""Service registry + heartbeat endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.registry import HeartbeatRequest, ServiceRead, ServiceRegister
from app.services import registry_service

router = APIRouter(tags=["services"])


@router.get(
    "/services",
    response_model=list[ServiceRead],
    summary="List all registered services (with online status).",
)
async def list_services_endpoint(
    session: AsyncSession = Depends(db_session),
) -> list[ServiceRead]:
    return await registry_service.list_services(session)


@router.post(
    "/services",
    response_model=ServiceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new service or update its descriptor.",
)
async def register_service_endpoint(
    payload: ServiceRegister,
    session: AsyncSession = Depends(db_session),
) -> ServiceRead:
    return await registry_service.register_or_update_service(session, payload)


@router.get(
    "/services/{slug}",
    response_model=ServiceRead,
    summary="Get one service by slug.",
)
async def get_service_endpoint(
    slug: str,
    session: AsyncSession = Depends(db_session),
) -> ServiceRead:
    try:
        svc = await registry_service.get_service_by_slug(session, slug)
    except registry_service.ServiceNotFound as exc:
        raise HTTPException(status_code=404, detail=f"Service not found: {exc.args[0]}") from exc
    return registry_service.service_to_read(svc)


@router.delete(
    "/services/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=__import__("fastapi").Response,
    response_model=None,
    summary="Remove a service from the registry (and its config keys).",
)
async def delete_service_endpoint(
    slug: str,
    session: AsyncSession = Depends(db_session),
) -> None:
    try:
        await registry_service.delete_service(session, slug)
    except registry_service.ServiceNotFound as exc:
        raise HTTPException(status_code=404, detail=f"Service not found: {exc.args[0]}") from exc


@router.post(
    "/services/{slug}/heartbeat",
    response_model=ServiceRead,
    summary="Send a heartbeat; refreshes last_heartbeat_at.",
)
async def heartbeat_endpoint(
    slug: str,
    payload: HeartbeatRequest | None = None,
    session: AsyncSession = Depends(db_session),
) -> ServiceRead:
    return await registry_service.heartbeat(session, slug, payload)