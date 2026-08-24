"""Tests for folders, labels, trash workflow."""

from __future__ import annotations

import pytest

from app.models.folder import Folder, Label, MessageLabel
from app.models.message import Message
from app.services import organization_service


pytestmark = pytest.mark.asyncio


async def test_ensure_system_folders(db_session):
    """First call should create the three system folders."""
    rows = await organization_service.ensure_system_folders(db_session)
    slugs = {f.slug for f in rows}
    assert slugs == {"inbox", "trash", "starred"}
    # Second call should be idempotent.
    rows2 = await organization_service.ensure_system_folders(db_session)
    assert len(rows2) == 3


async def test_create_list_update_delete_folder(db_session):
    # Need a user to own the folder.
    from app.models.user import User
    from app.core.security import hash_password
    user = User(email="u1@example.com", display_name="u1", password_hash=hash_password("p" * 8))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    from app.schemas.organization import FolderCreate
    f = await organization_service.create_folder(db_session, user.id, FolderCreate(name="工作"))
    assert f.id and f.name == "工作"
    assert f.slug == "custom"

    await organization_service.ensure_system_folders(db_session)
    folders = await organization_service.list_folders(db_session, user.id)
    slugs = {x.slug for x in folders}
    assert "inbox" in slugs and "custom" in slugs

    from app.schemas.organization import FolderUpdate
    f2 = await organization_service.update_folder(db_session, f.id, user.id, FolderUpdate(name="主页"))
    assert f2.name == "主页"

    await organization_service.delete_folder(db_session, f.id, user.id)
    folders = await organization_service.list_folders(db_session, user.id)
    assert all(x.id != f.id for x in folders)


async def test_labels_lifecycle(db_session):
    from app.models.user import User
    from app.core.security import hash_password
    user = User(email="u2@example.com", display_name="u2", password_hash=hash_password("p" * 8))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    from app.schemas.organization import LabelCreate, LabelUpdate
    label = await organization_service.create_label(db_session, user.id, LabelCreate(name="urgent", color="red"))
    assert label.color == "red"
    assert label.name == "urgent"

    # Idempotent: creating same name again returns same label
    again = await organization_service.create_label(db_session, user.id, LabelCreate(name="urgent", color="blue"))
    assert again.id == label.id

    # Update
    upd = await organization_service.update_label(db_session, label.id, user.id, LabelUpdate(name="hot", color="orange"))
    assert upd.name == "hot" and upd.color == "orange"

    # List
    labels = await organization_service.list_labels(db_session, user.id)
    assert len(labels) == 1

    # Delete
    await organization_service.delete_label(db_session, label.id, user.id)
    labels = await organization_service.list_labels(db_session, user.id)
    assert labels == []


async def test_message_labels_and_trash(db_session):
    # Setup: user + mailbox + message
    from app.models.user import User
    from app.models.mailbox import Mailbox
    from app.core.security import hash_password
    from app.services.email_parser import ParsedMail
    from app.services import message_service
    from app.schemas.organization import LabelCreate

    user = User(email="u3@example.com", display_name="u3", password_hash=hash_password("p" * 8))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    mb = Mailbox(address="u3@inbox.local", user_id=user.id, expires_at=Mailbox.default_expiry())
    db_session.add(mb)
    await db_session.commit()
    await db_session.refresh(mb)

    # Use a real raw_content to satisfy ParsedMail
    raw = (
        "From: sender@x.com\n"
        "To: u3@inbox.local\n"
        "Subject: Hi\n"
        "\n"
        "hello\n"
    )
    from app.services.email_parser import parse_email_bytes
    parsed = parse_email_bytes(raw.encode("utf-8"))
    msg = await message_service.create_message_from_parsed(db_session, mb, parsed)
    assert msg.folder_id is not None  # inbox folder assigned

    # Create label and bind
    label = await organization_service.create_label(db_session, user.id, LabelCreate(name="work", color="blue"))
    from app.schemas.organization import MessageLabelUpdate
    labels = await organization_service.set_message_labels(db_session, msg.id, user.id, MessageLabelUpdate(label_ids=[label.id]))
    assert labels[0].id == label.id

    binds = await organization_service.get_message_labels(db_session, msg.id)
    assert binds[0].id == label.id

    # Trash + restore
    trashed = await organization_service.trash_message(db_session, msg.id, user.id)
    assert trashed.is_trashed and trashed.trashed_at is not None
    restored = await organization_service.restore_message(db_session, msg.id, user.id)
    assert not restored.is_trashed and restored.trashed_at is None

    # Empty trash: re-trash then empty
    await organization_service.trash_message(db_session, msg.id, user.id)
    deleted = await organization_service.empty_trash(db_session, user.id)
    assert deleted == 1
