"""System endpoints: stats, manual cleanup, data export, data import."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, db_session
from app.models.mailbox import Mailbox
from app.schemas.common import StatsResponse
from app.services.export import EXPORT_MANIFEST_VERSION, build_export
from app.services.import_service import import_mbox_upload
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


@router.get(
    "/export",
    summary="Export all data for the current user (mailboxes, messages, attachments, labels, folders)",
    response_class=StreamingResponse,
)
async def export_data(
    session: Annotated[AsyncSession, Depends(db_session)],
    user_: Annotated[object, CurrentUser],
) -> StreamingResponse:
    """Bundle the current user's data into a downloadable zip.

    The build runs entirely in memory and is streamed as `application/zip`.
    """
    blob, counts = await build_export(session, user_.id)

    # RFC 5987 filename* for unicode safety in downloads.
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"arknexus-export-{stamp}.zip"
    quoted = f"attachment; filename=\"{filename}\"; filename*=UTF-8''{filename}"

    return StreamingResponse(
        iter([blob]),
        media_type="application/zip",
        headers={
            "Content-Disposition": quoted,
            "X-Export-Version": str(EXPORT_MANIFEST_VERSION),
            "X-Export-Count-Messages": str(counts.messages),
            "X-Export-Count-Attachments": str(counts.attachments),
            "X-Export-Count-Mailboxes": str(counts.mailboxes),
        },
    )


@router.post(
    "/import/mbox",
    summary="Import an mbox file (or .zip containing one) into the current user's primary mailbox",
)
async def import_mbox(
    session: Annotated[AsyncSession, Depends(db_session)],
    user_: Annotated[object, CurrentUser],
    file: UploadFile = File(...),
    target_mailbox_id: str | None = None,
) -> dict:
    """Accept an .mbox file (or .zip wrapping one) and import each message.

    If `target_mailbox_id` is omitted we look up the user's first mailbox, or
    create a default one if the user has none.
    """
    user_email = getattr(user_, "email", None) or "user@arknexus.local"

    mailbox_id = target_mailbox_id
    if not mailbox_id:
        result = await session.execute(
            select(Mailbox).where(Mailbox.user_id == user_.id).order_by(Mailbox.created_at)
        )
        first = result.scalars().first()
        if first is None:
            mb = Mailbox(user_id=user_.id, address=user_email, expires_at=Mailbox.default_expiry())
            session.add(mb)
            await session.flush()
            mailbox_id = mb.id
        else:
            mailbox_id = first.id

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="上传的文件为空")

    try:
        summary = await import_mbox_upload(
            session=session,
            user_id=user_.id,
            mailbox_id=mailbox_id,
            filename=file.filename or "import.mbox",
            raw=raw,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return {
        "imported": summary.imported,
        "skipped": summary.skipped,
        "errors": summary.errors,
        "target_mailbox_id": mailbox_id,
    }