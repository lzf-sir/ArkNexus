"""System endpoints: stats, manual cleanup."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.common import StatsResponse
from app.services.retention_service import run_cleanup, stats

router = APIRouter(prefix="/system", tags=["system"])


_last_cleanup_at: datetime | None = None


@router.get("/stats", response_model=StatsResponse, summary="Service statistics")
async def get_stats(session: AsyncSession = Depends(db_session)) -> StatsResponse:
    data = await stats(session)
    return StatsResponse(
        mailbox_total=data["mailbox_total"],
        mailbox_active=data["mailbox_active"],
        message_total=data["message_total"],
        message_active=data["message_active"],
        attachment_total=data["attachment_total"],
        retention_days=data["retention_days"],
        cleanup_last_run=_last_cleanup_at,
    )


@router.post("/cleanup", summary="Manually trigger retention cleanup")
async def trigger_cleanup() -> dict:
    global _last_cleanup_at
    result = await run_cleanup()
    _last_cleanup_at = result["ran_at"]
    return {
        "mailboxes_deleted": result["mailboxes_deleted"],
        "messages_deleted": result["messages_deleted"],
        "attachments_deleted": result["attachments_deleted"],
        "files_removed": result["files_removed"],
        "ran_at": _last_cleanup_at,
    }