"""First-run initialization endpoints (all public — no JWT required)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.core.config import settings
from app.schemas.init import (
    AdminCreate,
    AdminCreated,
    DatabaseChoice,
    DatabaseChoiceResult,
    DomainChoice,
    DomainChoiceResult,
    InitFinishResult,
    InitState,
    RedisChoice,
    RedisChoiceResult,
)
from app.services import init_service

router = APIRouter(prefix="/init", tags=["init"])


async def _read(session: AsyncSession, key: str):
    return await init_service._get(session, key)


@router.get(
    "/status",
    response_model=InitState,
    summary="Report whether the system has been initialized.",
)
async def init_status_endpoint(
    session: AsyncSession = Depends(db_session),
) -> InitState:
    raw = await init_service.get_full_state(session)
    is_init = bool(raw.get("initialized")) and str(raw["initialized"]).lower() in {"true", "1"}
    return InitState(
        initialized=is_init,
        database_url=raw.get("database_url"),
        database_driver=raw.get("database_driver"),
        redis_url=raw.get("redis_url"),
        email_domain=raw.get("email_domain"),
        admin_user_id=raw.get("admin_user_id"),
        completed_at=raw.get("completed_at"),
        defaults={
            "database_url": settings.database_url,
            "redis_url": "",
            "email_domain": settings.email_domain,
        },
    )


@router.post(
    "/step/database",
    response_model=DatabaseChoiceResult,
    summary="Save the chosen database URL.",
)
async def step_database(
    payload: DatabaseChoice,
    session: AsyncSession = Depends(db_session),
) -> DatabaseChoiceResult:
    try:
        meta = await init_service.save_database_choice(session, payload.url)
    except init_service.InitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return DatabaseChoiceResult(**meta)


@router.post(
    "/step/redis",
    response_model=RedisChoiceResult,
    summary="Save (or skip) the optional Redis URL.",
)
async def step_redis(
    payload: RedisChoice,
    session: AsyncSession = Depends(db_session),
) -> RedisChoiceResult:
    try:
        meta = await init_service.save_redis_choice(session, payload.url)
    except init_service.InitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if meta is None:
        return RedisChoiceResult(skipped=True)
    return RedisChoiceResult(skipped=False, **meta)


@router.post(
    "/step/domain",
    response_model=DomainChoiceResult,
    summary="Save the receiving email domain.",
)
async def step_domain(
    payload: DomainChoice,
    session: AsyncSession = Depends(db_session),
) -> DomainChoiceResult:
    try:
        domain = await init_service.save_domain_choice(session, payload.domain)
    except init_service.InitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return DomainChoiceResult(domain=domain)


@router.post(
    "/step/admin",
    response_model=AdminCreated,
    summary="Create the first administrator account.",
)
async def step_admin(
    payload: AdminCreate,
    session: AsyncSession = Depends(db_session),
) -> AdminCreated:
    try:
        user = await init_service.create_admin(
            session,
            email=payload.email,
            password=payload.password,
            display_name=payload.display_name,
        )
    except init_service.InitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await init_service._set(session, "admin_user_id", user.id)
    return AdminCreated(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )


@router.post(
    "/finish",
    response_model=InitFinishResult,
    summary="Finalize initialization (flips the initialized flag).",
)
async def finish(
    session: AsyncSession = Depends(db_session),
) -> InitFinishResult:
    if await init_service.is_initialized(session):
        raise HTTPException(status_code=409, detail="系统已完成初始化")
    try:
        await init_service.finalize_initialization(session)
    except init_service.InitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    db_row = await _read(session, "database_url")
    redis_row = await _read(session, "redis_url")
    domain_row = await _read(session, "email_domain")
    admin_row = await _read(session, "admin_user_id")
    completed_row = await _read(session, "completed_at")

    return InitFinishResult(
        initialized=True,
        completed_at=completed_row.value if completed_row else "",
        admin_user_id=admin_row.value if admin_row else "",
        summary={
            "database": db_row.value if db_row else None,
            "redis": redis_row.value if redis_row else None,
            "email_domain": domain_row.value if domain_row else None,
            "smtp_listen": f"{settings.smtp_host}:{settings.smtp_port}",
        },
    )