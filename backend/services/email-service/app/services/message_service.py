"""Message and attachment business logic."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from app.models.mailbox import Mailbox  # noqa: F401

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.message import Attachment, Message
from app.schemas.message import (
    AttachmentRead,
    LabelInline,
    MessageRead,
    MessageSummary,
    MessageUpdate,
)
from app.services.email_parser import ParsedMail


class MessageNotFound(Exception):
    pass


class AttachmentNotFound(Exception):
    pass


def _safe_filename(name: str) -> str:
    name = name.replace("/", "_").replace("\\", "_").strip() or "unnamed.bin"
    return name[:200]


def _attachment_path(att_id: str, filename: str) -> Path:
    safe = _safe_filename(filename)
    return settings.attachment_dir_path / f"{att_id}_{safe}"


async def create_message_from_parsed(
    session: AsyncSession,
    mailbox: Mailbox,
    parsed: ParsedMail,
) -> Message:
    """Persist a parsed email + attachments for the given mailbox."""

    # Resolve the inbox folder lazily so we don't import-time cycle.
    from app.services.organization_service import ensure_system_folders, get_inbox_folder
    await ensure_system_folders(session)
    inbox = await get_inbox_folder(session)
    message = Message(
        mailbox_id=mailbox.id,
        rfc_message_id=parsed.rfc_message_id,
        from_address=parsed.from_address,
        from_name=parsed.from_name,
        to_addresses=",".join(parsed.to_addresses),
        cc_addresses=",".join(parsed.cc_addresses) or None,
        subject=parsed.subject,
        body_text=parsed.body_text,
        body_html=parsed.body_html,
        raw_content=parsed.raw_content,
        received_at=datetime.now(timezone.utc),
        is_read=False,
        is_starred=False,
        has_attachments=bool(parsed.attachments),
        size_bytes=parsed.size_bytes,
        folder_id=inbox.id,
    )
    session.add(message)
    await session.flush()  # populate message.id

    for att in parsed.attachments:
        path = _attachment_path(message.id, att.filename)
        try:
            await _write_bytes(path, att.content)
        except OSError:
            continue  # skip on disk failure but keep the message
        attachment = Attachment(
            message_id=message.id,
            filename=att.filename,
            content_type=att.content_type,
            size_bytes=att.size_bytes,
            storage_path=str(path),
            content_id=att.content_id,
        )
        session.add(attachment)

    # update mailbox counters
    mailbox.message_count = (mailbox.message_count or 0) + 1
    mailbox.touch()

    await session.commit()
    await session.refresh(message)

    # Fan out a real-time notification so any open SSE clients get a ping.
    # Imported lazily to avoid circular imports on module load.
    try:
        from app.services.notifications import Notification, bus
        notif = Notification(
            id=message.id,
            type="email.received",
            title=f"新邮件：{parsed.subject or '(无主题)'}",
            body=f"发件人：{parsed.from_address}",
            data={
                "message_id": message.id,
                "mailbox_id": mailbox.id,
                "from_address": parsed.from_address,
                "subject": parsed.subject,
                "has_attachments": bool(parsed.attachments),
            },
        )
        # Best-effort: never let a publish failure block message persistence.
        await bus.publish(notif)
    except Exception:
        pass

    return message


async def _write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # write atomically via tmp file
    tmp = path.with_suffix(path.suffix + f".{secrets.token_hex(4)}.part")
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, path)


async def list_messages_for_mailbox(
    session: AsyncSession,
    mailbox_id: str,
    *,
    limit: int = 100,
    offset: int = 0,
    only_unread: bool = False,
) -> List[Message]:
    stmt = (
        select(Message)
        .where(Message.mailbox_id == mailbox_id)
        .order_by(Message.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if only_unread:
        stmt = stmt.where(Message.is_read.is_(False))
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def get_message(session: AsyncSession, message_id: str) -> Message:
    stmt = select(Message).where(Message.id == message_id)
    result = await session.execute(stmt)
    msg = result.scalar_one_or_none()
    if msg is None:
        raise MessageNotFound(message_id)
    return msg


async def get_attachment(session: AsyncSession, attachment_id: str) -> Attachment:
    stmt = select(Attachment).where(Attachment.id == attachment_id)
    result = await session.execute(stmt)
    att = result.scalar_one_or_none()
    if att is None:
        raise AttachmentNotFound(attachment_id)
    return att


async def update_message(
    session: AsyncSession,
    message_id: str,
    payload: MessageUpdate,
) -> Message:
    msg = await get_message(session, message_id)
    if payload.is_read is not None:
        msg.is_read = payload.is_read
    if payload.is_starred is not None:
        msg.is_starred = payload.is_starred
    await session.commit()
    await session.refresh(msg)
    return msg


async def search_messages(
    session: AsyncSession,
    mailbox_id: str,
    *,
    q: str,
    limit: int = 100,
    offset: int = 0,
    only_unread: bool = False,
) -> List[Message]:
    """Full-text-ish search over subject / from / body_text."""
    if not q or not q.strip():
        return []
    like = f"%{q.strip()}%"
    from sqlalchemy import or_, select
    stmt = (
        select(Message)
        .where(
            Message.mailbox_id == mailbox_id,
            or_(
                Message.subject.ilike(like),
                Message.from_address.ilike(like),
                Message.from_name.ilike(like),
                Message.body_text.ilike(like),
            ),
        )
        .order_by(Message.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if only_unread:
        stmt = stmt.where(Message.is_read.is_(False))
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def bulk_action(
    session: AsyncSession,
    mailbox_id: str,
    message_ids: List[str],
    action: str,
) -> int:
    """Apply an action to many messages. Returns the count affected."""
    if action not in {"delete", "mark_read", "mark_unread", "star", "unstar"}:
        raise ValueError(f"Unknown bulk action: {action}")
    if not message_ids:
        return 0

    from sqlalchemy import delete as sql_delete, update as sql_update
    if action == "delete":
        # Capture attachment paths first to remove files.
        stmt = select(Message).where(
            Message.mailbox_id == mailbox_id,
            Message.id.in_(message_ids),
        )
        rows = list((await session.execute(stmt)).scalars().unique().all())
        paths = []
        for m in rows:
            for att in m.attachments:
                paths.append(att.storage_path)
        result = await session.execute(
            sql_delete(Message).where(
                Message.mailbox_id == mailbox_id,
                Message.id.in_(message_ids),
            )
        )
        # decrement mailbox counter
        affected = result.rowcount or 0
        if affected:
            mb_stmt = select(Mailbox).where(Mailbox.id == mailbox_id)
            mb = (await session.execute(mb_stmt)).scalar_one_or_none()
            if mb is not None and mb.message_count > 0:
                mb.message_count = max(0, mb.message_count - affected)
        await session.commit()
        # best-effort file removal
        import os
        for p in paths:
            try:
                os.remove(p)
            except OSError:
                pass
        return affected

    values: dict = {}
    if action == "mark_read":
        values["is_read"] = True
    elif action == "mark_unread":
        values["is_read"] = False
    elif action == "star":
        values["is_starred"] = True
    elif action == "unstar":
        values["is_starred"] = False

    result = await session.execute(
        sql_update(Message)
        .where(
            Message.mailbox_id == mailbox_id,
            Message.id.in_(message_ids),
        )
        .values(**values)
    )
    await session.commit()
    return result.rowcount or 0


async def delete_message(session: AsyncSession, message_id: str) -> None:
    msg = await get_message(session, message_id)
    # capture attachment paths to remove files
    paths: list[Path] = []
    for att in list(msg.attachments):
        paths.append(Path(att.storage_path))

    mailbox_id = msg.mailbox_id
    await session.delete(msg)
    await session.commit()

    # decrement message_count and clean files
    stmt = select(Mailbox).where(Mailbox.id == mailbox_id)
    res = await session.execute(stmt)
    mb = res.scalar_one_or_none()
    if mb is not None and mb.message_count > 0:
        mb.message_count -= 1
        await session.commit()

    for p in paths:
        try:
            os.remove(p)
        except OSError:
            pass


async def unread_count_for_mailbox(session: AsyncSession, mailbox_id: str) -> int:
    stmt = select(func.count(Message.id)).where(
        and_(Message.mailbox_id == mailbox_id, Message.is_read.is_(False))
    )
    result = await session.execute(stmt)
    return int(result.scalar() or 0)



async def _message_labels_inline(session: AsyncSession, message_ids):
    if not message_ids:
        return {}
    from app.models.folder import Label, MessageLabel
    stmt = (
        select(MessageLabel.message_id, Label.id, Label.name, Label.color)
        .join(Label, Label.id == MessageLabel.label_id)
        .where(MessageLabel.message_id.in_(message_ids))
    )
    rows = (await session.execute(stmt)).all()
    out = {mid: [] for mid in message_ids}
    for mid, lid, name, color in rows:
        if mid in out:
            out[mid].append(LabelInline(id=lid, name=name, color=color))
    return out


def message_to_summary(msg: Message, preview: str, labels: list[LabelInline] | None = None) -> MessageSummary:
    return MessageSummary(
        id=msg.id,
        mailbox_id=msg.mailbox_id,
        from_address=msg.from_address,
        from_name=msg.from_name,
        subject=msg.subject or "(无主题)",
        preview=preview,
        received_at=msg.received_at,
        is_read=msg.is_read,
        is_starred=msg.is_starred,
        has_attachments=msg.has_attachments,
        size_bytes=msg.size_bytes,
        is_trashed=msg.is_trashed,
        folder_id=msg.folder_id,
        labels=labels or [],
    )


async def message_to_read(session: AsyncSession, msg: Message) -> MessageRead:
    to_list = [a for a in (msg.to_addresses or "").split(",") if a]
    cc_list = [a for a in (msg.cc_addresses or "").split(",") if a] if msg.cc_addresses else []
    labels = await _message_labels_inline(session, [msg.id])
    return MessageRead(
        id=msg.id,
        mailbox_id=msg.mailbox_id,
        rfc_message_id=msg.rfc_message_id,
        from_address=msg.from_address,
        from_name=msg.from_name,
        to_addresses=to_list,
        cc_addresses=cc_list,
        subject=msg.subject,
        body_text=msg.body_text,
        body_html=msg.body_html,
        received_at=msg.received_at,
        is_read=msg.is_read,
        is_starred=msg.is_starred,
        has_attachments=msg.has_attachments,
        size_bytes=msg.size_bytes,
        is_trashed=msg.is_trashed,
        folder_id=msg.folder_id,
        labels=labels.get(msg.id, []),
        attachments=[AttachmentRead.model_validate(a) for a in msg.attachments],
    )