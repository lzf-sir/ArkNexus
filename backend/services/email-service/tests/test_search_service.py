"""Tests for the full-text search service."""

from __future__ import annotations

import pytest

from app.models.mailbox import Mailbox
from app.models.user import User
from app.services import search_service
from app.services.email_parser import parse_email_bytes


pytestmark = pytest.mark.asyncio


async def _seed_mailbox_with_messages(db_session):
    from app.core.security import hash_password
    user = User(email="search-user@example.com", display_name="Su", password_hash=hash_password("p" * 8))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    mb = Mailbox(address="search@local.test", user_id=user.id, expires_at=Mailbox.default_expiry())
    db_session.add(mb)
    await db_session.commit()
    await db_session.refresh(mb)

    raw1 = (
        b"From: alice@example.com\r\n"
        b"To: search@local.test\r\n"
        b"Subject: Welcome to ArkNexus\r\n"
        b"\r\n"
        b"Hello friend, this is the welcome message.\r\n"
    )
    raw2 = (
        b"From: bob@example.com\r\n"
        b"To: search@local.test\r\n"
        b"Subject: Invoice 42\r\n"
        b"\r\n"
        b"Please find the invoice attached. Total: $42.00.\r\n"
    )
    raw3 = (
        b"From: alice@example.com\r\n"
        b"To: search@local.test\r\n"
        b"Subject: Goodbye\r\n"
        b"\r\n"
        b"This is another message from alice with no real keywords.\r\n"
    )
    msgs = []
    for raw in (raw1, raw2, raw3):
        parsed = parse_email_bytes(raw)
        from app.services import message_service
        m = await message_service.create_message_from_parsed(db_session, mb, parsed)
        msgs.append(m)
    return mb, msgs


async def test_search_finds_subject_or_body(db_session):
    mb, _ = await _seed_mailbox_with_messages(db_session)
    rows = await search_service.search_messages(db_session, mb.id, query="welcome")
    assert len(rows) == 1
    assert rows[0]["subject"].startswith("Welcome")
    # Highlight wraps the match.
    assert "<mark>" in rows[0]["preview"].lower()


async def test_search_finds_by_sender(db_session):
    mb, _ = await _seed_mailbox_with_messages(db_session)
    rows = await search_service.search_messages(db_session, mb.id, query="bob")
    assert len(rows) == 1
    assert rows[0]["from_address"] == "bob@example.com"


async def test_search_empty_query_returns_empty(db_session):
    mb, _ = await _seed_mailbox_with_messages(db_session)
    rows = await search_service.search_messages(db_session, mb.id, query="")
    assert rows == []


async def test_search_case_insensitive(db_session):
    mb, _ = await _seed_mailbox_with_messages(db_session)
    rows_uc = await search_service.search_messages(db_session, mb.id, query="INVOICE")
    rows_lc = await search_service.search_messages(db_session, mb.id, query="invoice")
    assert len(rows_uc) == len(rows_lc) == 1


async def test_search_only_unread(db_session):
    mb, msgs = await _seed_mailbox_with_messages(db_session)
    # Mark one as read
    msgs[0].is_read = True
    await db_session.commit()
    rows = await search_service.search_messages(
        db_session, mb.id, query="welcome", only_unread=True
    )
    assert rows == []
    rows = await search_service.search_messages(
        db_session, mb.id, query="welcome", only_unread=False
    )
    assert len(rows) == 1


async def test_highlight_keeps_safe_html(db_session):
    mb, _ = await _seed_mailbox_with_messages(db_session)
    rows = await search_service.search_messages(db_session, mb.id, query="hello")
    assert rows and "<mark>Hello</mark>" in rows[0]["preview"]
