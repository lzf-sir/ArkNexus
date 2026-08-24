"""Retention service: enforce 30-day expiry on mailboxes, messages, attachments."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.mailbox import Mailbox
from app.models.message import Attachment, Message

logger = logging.getLogger(__name__)


async def _collect_orphan_attachment_paths(session: AsyncSession) -> list[Path]:
    """Return storage paths of attachments whose message will be deleted."""
    cutoff = datetime.now(timezone.utc) - _retention_window()
    stmt = (
        select(Attachment.storage_path)
        .join(Message, Message.id == Attachment.message_id)
        .where(Message.received_at < cutoff)
    )
    result = await session.execute(stmt)
    return [Path(row[0]) for row in result.all() if row[0]]


def _retention_window():
    from datetime import timedelta
    return timedelta(days=settings.retention_days)


async def run_cleanup() -> dict:
    """Perform a full retention sweep and return stats."""

    now = datetime.now(timezone.utc)
    cutoff = now - _retention_window()

    orphan_paths: list[Path] = []
    mailbox_deleted = 0
    message_deleted = 0
    attachments_deleted = 0

    async with SessionLocal() as session:
        # 1. Drop expired mailboxes (cascades messages + attachments via ORM).
        result = await session.execute(
            delete(Mailbox).where(Mailbox.expires_at < now).returning(Mailbox.id)
        )
        mailbox_deleted = len(result.scalars().all())

        # 2. Drop messages older than retention window that still exist.
        result = await session.execute(
            delete(Message)
            .where(Message.received_at < cutoff)
            .returning(Message.id)
        )
        message_deleted = len(result.scalars().all())

        # 3. Collect paths of any orphan attachments (msg already deleted but
        #    in some engines cascade may not delete files).
        orphan_paths = await _collect_orphan_attachment_paths(session)
        result = await session.execute(
            delete(Attachment).returning(Attachment.id)
        )
        attachments_deleted = len(result.scalars().all())

        await session.commit()

    files_removed = 0
    for path in orphan_paths:
        try:
            os.remove(path)
            files_removed += 1
        except OSError:
            pass

    logger.info(
        "Retention sweep done: mailboxes=%d, messages=%d, attachments=%d, files=%d",
        mailbox_deleted,
        message_deleted,
        attachments_deleted,
        files_removed,
    )

    return {
        "mailboxes_deleted": mailbox_deleted,
        "messages_deleted": message_deleted,
        "attachments_deleted": attachments_deleted,
        "files_removed": files_removed,
        "ran_at": now,
    }


async def stats(session: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)

    def _count(model):
        return select(func.count(model.id))

    mailbox_total = await session.scalar(_count(Mailbox))
    mailbox_active = await session.scalar(
        select(func.count(Mailbox.id)).where(Mailbox.expires_at > now)
    )
    message_total = await session.scalar(_count(Message))
    cutoff = now - _retention_window()
    message_active = await session.scalar(
        select(func.count(Message.id)).where(Message.received_at >= cutoff)
    )
    attachment_total = await session.scalar(_count(Attachment))

    return {
        "mailbox_total": int(mailbox_total or 0),
        "mailbox_active": int(mailbox_active or 0),
        "message_total": int(message_total or 0),
        "message_active": int(message_active or 0),
        "attachment_total": int(attachment_total or 0),
        "retention_days": settings.retention_days,
    }