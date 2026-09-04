"""Tests for the import service — mbox + zip round-trip."""

from __future__ import annotations

import io
import zipfile
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mailbox import Mailbox
from app.models.message import Message
from app.services.import_service import import_mbox_upload

from tests.conftest import TEST_USER_ID


def _build_minimal_mbox() -> bytes:
    """Build a 3-message mbox byte stream."""
    msg1 = (
        "From alice@example.com Mon Jan 15 12:00:00 2026\n"
        "From: Alice <alice@example.com>\n"
        "To: Bob <bob@example.com>\n"
        "Subject: First\n"
        "Message-ID: <m1@example.com>\n"
        "Date: Mon, 15 Jan 2026 12:00:00 +0000\n"
        "\n"
        "Body of first.\n"
    )
    msg2 = (
        "From bob@example.com Tue Jan 16 09:30:00 2026\n"
        "From: Bob <bob@example.com>\n"
        "To: Alice <alice@example.com>\n"
        "Subject: Second\n"
        "Message-ID: <m2@example.com>\n"
        "Date: Tue, 16 Jan 2026 09:30:00 +0000\n"
        "Content-Type: text/html; charset=utf-8\n"
        "\n"
        "<p>HTML body of second.</p>\n"
    )
    msg3 = (
        "From spam@example.com Wed Jan 17 18:00:00 2026\n"
        "From: spam@example.com\n"
        "Subject: Third (no to)\n"
        "Date: Wed, 17 Jan 2026 18:00:00 +0000\n"
        "\n"
        "Body of third.\n"
    )
    return (msg1 + msg2 + msg3).encode("utf-8")


@pytest.mark.asyncio
async def test_import_mbox_creates_messages(session: AsyncSession):
    mb = Mailbox(
        user_id=TEST_USER_ID,
        address="me@arknexus.local",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    session.add(mb)
    await session.flush()

    summary = await import_mbox_upload(
        session=session,
        user_id=TEST_USER_ID,
        mailbox_id=mb.id,
        filename="test.mbox",
        raw=_build_minimal_mbox(),
    )

    assert summary.imported == 3
    assert summary.errors == 0
    rows = (
        await session.execute(select(Message).where(Message.mailbox_id == mb.id))
    ).scalars().all()
    assert len(rows) == 3
    subjects = sorted(r.subject for r in rows)
    assert subjects == ["First", "Second", "Third (no to)"]
    # The HTML-only message should have body_html set, not body_text.
    second = next(r for r in rows if r.subject == "Second")
    assert second.body_html and "<p>" in second.body_html
    assert second.from_address == "bob@example.com"


@pytest.mark.asyncio
async def test_import_zip_with_multiple_mbox_creates_separate_mailboxes(session: AsyncSession):
    mbox_bytes = _build_minimal_mbox()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("Mail/Inbox.mbox", mbox_bytes)
        zf.writestr("Mail/Sent.mbox", mbox_bytes)
        zf.writestr("ignored.txt", b"hello")
    raw = buf.getvalue()

    summary = await import_mbox_upload(
        session=session,
        user_id=TEST_USER_ID,
        mailbox_id="unused",  # zip import creates its own mailboxes
        filename="takeout.zip",
        raw=raw,
    )

    assert summary.imported == 6  # 2 mboxes × 3 messages each
    assert len(summary.created_mailboxes) == 2
    # Both mailboxes should exist.
    rows = (
        await session.execute(
            select(Mailbox).where(Mailbox.user_id == TEST_USER_ID)
        )
    ).scalars().all()
    assert len(rows) == 2


@pytest.mark.asyncio
async def test_import_empty_mbox_returns_zero_summary(session: AsyncSession):
    mb = Mailbox(
        user_id=TEST_USER_ID,
        address="me@arknexus.local",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    session.add(mb)
    await session.flush()

    summary = await import_mbox_upload(
        session=session,
        user_id=TEST_USER_ID,
        mailbox_id=mb.id,
        filename="empty.mbox",
        raw=b"",
    )
    assert summary.imported == 0


@pytest.mark.asyncio
async def test_import_bad_zip_raises_value_error(session: AsyncSession):
    with pytest.raises(ValueError):
        await import_mbox_upload(
            session=session,
            user_id=TEST_USER_ID,
            mailbox_id="any",
            filename="broken.zip",
            raw=b"this is not a zip file",
        )


@pytest.mark.asyncio
async def test_import_zip_without_mbox_raises(session: AsyncSession):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("README.txt", b"hello")
    with pytest.raises(ValueError, match="未找到"):
        await import_mbox_upload(
            session=session,
            user_id=TEST_USER_ID,
            mailbox_id="any",
            filename="bad.zip",
            raw=buf.getvalue(),
        )