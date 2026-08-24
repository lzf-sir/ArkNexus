"""Business logic for folders, labels and the trash workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import SYSTEM_FOLDERS, Folder, Label, MessageLabel
from app.models.message import Message
from app.models.user import User
from app.schemas.organization import (
    FolderCreate,
    FolderRead,
    FolderUpdate,
    LabelCreate,
    LabelRead,
    LabelUpdate,
    MessageLabelUpdate,
)


class FolderNotFound(Exception):
    pass


class LabelNotFound(Exception):
    pass


class FolderSlugTaken(Exception):
    pass


def _folder_to_read(folder: Folder) -> FolderRead:
    return FolderRead(
        id=folder.id,
        slug=folder.slug,
        name=folder.name,
        color=None,
        is_system=folder.slug in SYSTEM_FOLDERS,
        created_at=folder.created_at,
    )


def _label_to_read(label: Label) -> LabelRead:
    return LabelRead(
        id=label.id,
        name=label.name,
        color=label.color,
        created_at=label.created_at,
    )


# ===== Folders =====

async def ensure_system_folders(session: AsyncSession) -> List[Folder]:
    """Create the system folders if they do not exist yet. Safe to call repeatedly."""
    existing = (await session.execute(select(Folder))).scalars().all()
    have = {f.slug for f in existing}
    system_defs = [
        ("inbox", "收件箱"),
        ("trash", "回收站"),
        ("starred", "星标"),
    ]
    for slug, name in system_defs:
        if slug not in have:
            session.add(Folder(slug=slug, name=name, owner_id=None))
            have.add(slug)
    await session.commit()
    result = (await session.execute(select(Folder).where(Folder.slug.in_(SYSTEM_FOLDERS)))).scalars().all()
    return list(result)


async def list_folders(session: AsyncSession, user_id: Optional[str]) -> List[FolderRead]:
    """Return system folders + the user's custom folders."""
    if user_id is None:
        stmt = select(Folder).where(Folder.owner_id.is_(None))
    else:
        stmt = select(Folder).where(
            (Folder.owner_id.is_(None)) | (Folder.owner_id == user_id)
        )
    stmt = stmt.order_by(Folder.created_at.asc())
    rows = (await session.execute(stmt)).scalars().all()
    return [_folder_to_read(f) for f in rows]


async def create_folder(session: AsyncSession, owner_id: str, payload: FolderCreate) -> FolderRead:
    name = payload.name.strip()
    if not name:
        raise ValueError("Folder name cannot be empty")
    folder = Folder(slug="custom", name=name, owner_id=owner_id)
    session.add(folder)
    await session.commit()
    await session.refresh(folder)
    return _folder_to_read(folder)


async def update_folder(session: AsyncSession, folder_id: str, user_id: str, payload: FolderUpdate) -> FolderRead:
    folder = await session.get(Folder, folder_id)
    if folder is None or folder.slug in SYSTEM_FOLDERS or folder.owner_id != user_id:
        raise FolderNotFound(folder_id)
    if payload.name is not None:
        folder.name = payload.name.strip()
    await session.commit()
    await session.refresh(folder)
    return _folder_to_read(folder)


async def delete_folder(session: AsyncSession, folder_id: str, user_id: str) -> None:
    folder = await session.get(Folder, folder_id)
    if folder is None or folder.slug in SYSTEM_FOLDERS or folder.owner_id != user_id:
        raise FolderNotFound(folder_id)
    # Move messages back to inbox (any folder will do; we use NULL = "no folder").
    await session.execute(
        update(Message)
        .where(Message.folder_id == folder_id)
        .values(folder_id=None)
    )
    await session.delete(folder)
    await session.commit()


async def get_inbox_folder(session: AsyncSession) -> Folder:
    folder = (
        await session.execute(select(Folder).where(Folder.slug == "inbox"))
    ).scalar_one_or_none()
    if folder is None:
        # Should never happen if ensure_system_folders ran.
        await ensure_system_folders(session)
        folder = (
            await session.execute(select(Folder).where(Folder.slug == "inbox"))
        ).scalar_one()
    return folder


# ===== Labels =====

async def list_labels(session: AsyncSession, owner_id: str) -> List[LabelRead]:
    stmt = select(Label).where(Label.owner_id == owner_id).order_by(Label.created_at.asc())
    rows = (await session.execute(stmt)).scalars().all()
    return [_label_to_read(l) for l in rows]


async def create_label(session: AsyncSession, owner_id: str, payload: LabelCreate) -> LabelRead:
    name = payload.name.strip()
    if not name:
        raise ValueError("Label name cannot be empty")
    existing = (
        await session.execute(
            select(Label).where(Label.owner_id == owner_id, Label.name == name)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return _label_to_read(existing)
    label = Label(owner_id=owner_id, name=name, color=payload.color or "blue")
    session.add(label)
    await session.commit()
    await session.refresh(label)
    return _label_to_read(label)


async def update_label(session: AsyncSession, label_id: str, owner_id: str, payload: LabelUpdate) -> LabelRead:
    label = await session.get(Label, label_id)
    if label is None or label.owner_id != owner_id:
        raise LabelNotFound(label_id)
    if payload.name is not None:
        label.name = payload.name.strip()
    if payload.color is not None:
        label.color = payload.color
    await session.commit()
    await session.refresh(label)
    return _label_to_read(label)


async def delete_label(session: AsyncSession, label_id: str, owner_id: str) -> None:
    label = await session.get(Label, label_id)
    if label is None or label.owner_id != owner_id:
        raise LabelNotFound(label_id)
    await session.delete(label)
    await session.commit()


# ===== Message bindings =====

async def set_message_labels(
    session: AsyncSession,
    message_id: str,
    owner_id: str,
    payload: MessageLabelUpdate,
) -> List[LabelRead]:
    msg = await session.get(Message, message_id)
    if msg is None:
        raise FolderNotFound(message_id)
    # Validate ownership via mailbox.
    if msg.mailbox and msg.mailbox.user_id not in (None, owner_id):
        raise FolderNotFound(message_id)
    # Drop existing
    await session.execute(
        delete(MessageLabel).where(MessageLabel.message_id == message_id)
    )
    # Add new
    if payload.label_ids:
        # Must belong to owner.
        labels = (
            await session.execute(
                select(Label).where(Label.id.in_(payload.label_ids), Label.owner_id == owner_id)
            )
        ).scalars().all()
        for l in labels:
            session.add(MessageLabel(message_id=message_id, label_id=l.id))
    await session.commit()
    return await list_labels(session, owner_id)


async def get_message_labels(
    session: AsyncSession, message_id: str
) -> List[LabelRead]:
    stmt = (
        select(Label)
        .join(MessageLabel, MessageLabel.label_id == Label.id)
        .where(MessageLabel.message_id == message_id)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return [_label_to_read(l) for l in rows]


# ===== Trash workflow =====

async def trash_message(session: AsyncSession, message_id: str, owner_id: Optional[str]) -> Message:
    msg = await session.get(Message, message_id)
    if msg is None:
        raise FolderNotFound(message_id)
    if owner_id is not None and msg.mailbox and msg.mailbox.user_id not in (None, owner_id):
        raise FolderNotFound(message_id)
    msg.is_trashed = True
    msg.trashed_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(msg)
    return msg


async def restore_message(session: AsyncSession, message_id: str, owner_id: Optional[str]) -> Message:
    msg = await session.get(Message, message_id)
    if msg is None:
        raise FolderNotFound(message_id)
    if owner_id is not None and msg.mailbox and msg.mailbox.user_id not in (None, owner_id):
        raise FolderNotFound(message_id)
    msg.is_trashed = False
    msg.trashed_at = None
    await session.commit()
    await session.refresh(msg)
    return msg


async def empty_trash(session: AsyncSession, owner_id: Optional[str]) -> int:
    """Permanently delete all currently-trashed messages for the owner."""
    deleted = 0
    # We only allow each user to purge their own trashed items.
    if owner_id is None:
        return 0
    # Find all messages to delete (so we can collect attachment paths).
    stmt = (
        select(Message)
        .join(Message.mailbox)  # type: ignore[attr-defined]
        .where(Message.is_trashed.is_(True), Message.mailbox.has(user_id=owner_id))
    )
    rows = (await session.execute(stmt)).scalars().all()
    paths = []
    for m in rows:
        for att in m.attachments:
            paths.append(att.storage_path)
    result = await session.execute(
        delete(Message).where(
            Message.id.in_([m.id for m in rows])
        )
    )
    deleted = result.rowcount or 0
    await session.commit()
    import os
    for p in paths:
        try:
            os.remove(p)
        except OSError:
            pass
    return deleted
