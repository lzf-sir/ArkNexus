"""Tests for the export service — verify zip structure + round-trip integrity."""

from __future__ import annotations

import io
import zipfile
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder, Label
from app.models.mailbox import Mailbox
from app.models.message import Attachment, Message
from app.services.export import build_export

from tests.conftest import TEST_USER_ID


def _make_message(mailbox_id: str, **overrides) -> Message:
    defaults = {
        "id": "msg-1",
        "mailbox_id": mailbox_id,
        "from_address": "alice@example.com",
        "from_name": "Alice",
        "to_addresses": "bob@example.com",
        "subject": "Hello",
        "body_text": "Plain body",
        "body_html": "<p>HTML body</p>",
        "raw_content": "raw bytes",
        "received_at": datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc),
        "is_read": False,
        "is_starred": True,
        "size_bytes": 100,
        "spam_score": 0.1,
    }
    defaults.update(overrides)
    return Message(**defaults)


@pytest.mark.asyncio
async def test_export_zip_has_manifest_and_readme(session: AsyncSession):
    blob, counts = await build_export(session, TEST_USER_ID)
    assert blob  # non-empty
    zf = zipfile.ZipFile(io.BytesIO(blob))
    names = zf.namelist()
    assert "manifest.json" in names
    assert "README.md" in names
    manifest = json.loads(zf.read("manifest.json").decode())
    assert manifest["version"] == 1
    assert manifest["user_id"] == TEST_USER_ID
    assert "counts" in manifest


@pytest.mark.asyncio
async def test_export_includes_mailbox_messages_labels_folders(session: AsyncSession):
    mb = Mailbox(
        user_id=TEST_USER_ID,
        address="me@arknexus.local",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    session.add(mb)
    await session.flush()

    label = Label(owner_id=TEST_USER_ID, name="work")
    session.add(label)
    await session.flush()

    folder = Folder(owner_id=TEST_USER_ID, slug="archive", name="Archive")
    session.add(folder)
    await session.flush()

    msg = _make_message(mailbox_id=mb.id, folder_id=folder.id)
    session.add(msg)
    await session.flush()

    blob, counts = await build_export(session, TEST_USER_ID)
    zf = zipfile.ZipFile(io.BytesIO(blob))

    # Mailboxes directory
    assert f"mailboxes/{mb.id}.json" in zf.namelist()
    # Labels
    assert "labels.json" in zf.namelist()
    # Folders index
    assert "mailboxes/folders.json" in zf.namelist()
    # Messages
    assert "messages/index.json" in zf.namelist()
    assert f"messages/{msg.id}.json" in zf.namelist()

    assert counts.mailboxes == 1
    assert counts.labels == 1
    assert counts.folders == 1
    assert counts.messages == 1


@pytest.mark.asyncio
async def test_export_excludes_trashed_messages(session: AsyncSession):
    mb = Mailbox(
        user_id=TEST_USER_ID,
        address="me@arknexus.local",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    session.add(mb)
    await session.flush()

    keep = _make_message(mailbox_id=mb.id, id="keep")
    trashed = _make_message(
        mailbox_id=mb.id,
        id="trashed",
        is_trashed=True,
        trashed_at=datetime.now(timezone.utc),
    )
    session.add_all([keep, trashed])
    await session.flush()

    blob, counts = await build_export(session, TEST_USER_ID)
    assert counts.messages == 1
    zf = zipfile.ZipFile(io.BytesIO(blob))
    assert "messages/keep.json" in zf.namelist()
    assert "messages/trashed.json" not in zf.namelist()


@pytest.mark.asyncio
async def test_export_writes_mbox_file(session: AsyncSession):
    mb = Mailbox(
        user_id=TEST_USER_ID,
        address="me@arknexus.local",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    session.add(mb)
    await session.flush()

    msg = _make_message(mailbox_id=mb.id)
    session.add(msg)
    await session.flush()

    blob, _counts = await build_export(session, TEST_USER_ID)
    zf = zipfile.ZipFile(io.BytesIO(blob))
    assert "mbox/all.mbox" in zf.namelist()
    mbox_text = zf.read("mbox/all.mbox").decode()
    assert "From alice@example.com" in mbox_text
    assert "Subject: Hello" in mbox_text


@pytest.mark.asyncio
async def test_export_message_index_contains_label_ids_and_names(session: AsyncSession):
    mb = Mailbox(
        user_id=TEST_USER_ID,
        address="me@arknexus.local",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    session.add(mb)
    await session.flush()

    label = Label(owner_id=TEST_USER_ID, name="important")
    session.add(label)
    await session.flush()

    msg = _make_message(mailbox_id=mb.id)
    session.add(msg)
    await session.flush()
    from app.models.folder import MessageLabel
    assoc = MessageLabel(message_id=msg.id, label_id=label.id)
    session.add(assoc)
    await session.flush()

    blob, _counts = await build_export(session, TEST_USER_ID)
    zf = zipfile.ZipFile(io.BytesIO(blob))
    import json as _json
    index = _json.loads(zf.read("messages/index.json").decode())
    assert len(index) == 1
    assert index[0]["labels"][0]["name"] == "important"


@pytest.mark.asyncio
async def test_export_with_no_mailboxes_produces_empty_archive(session: AsyncSession):
    blob, counts = await build_export(session, TEST_USER_ID)
    assert counts.mailboxes == 0
    assert counts.messages == 0
    zf = zipfile.ZipFile(io.BytesIO(blob))
    assert "manifest.json" in zf.namelist()
    # messages/index.json is still present, but empty list.
    import json as _json
    index = _json.loads(zf.read("messages/index.json").decode())
    assert index == []


@pytest.mark.asyncio
async def test_export_handles_missing_attachment_file(session: AsyncSession, tmp_path):
    mb = Mailbox(
        user_id=TEST_USER_ID,
        address="me@arknexus.local",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    session.add(mb)
    await session.flush()

    # Point at a non-existent path to verify the missing-file placeholder path.
    msg = _make_message(mailbox_id=mb.id)
    session.add(msg)
    await session.flush()

    missing_path = str(tmp_path / "does-not-exist.bin")
    att = Attachment(
        message_id=msg.id,
        filename="ghost.bin",
        content_type="application/octet-stream",
        size_bytes=42,
        storage_path=missing_path,
    )
    session.add(att)
    await session.flush()

    blob, counts = await build_export(session, TEST_USER_ID)
    zf = zipfile.ZipFile(io.BytesIO(blob))
    names = zf.namelist()
    assert any(n.endswith(".missing") for n in names)
    assert counts.attachments == 0  # missing files don't count toward attachments


import json