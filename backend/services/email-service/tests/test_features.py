"""Tests for search / bulk / drafts features."""

import pytest

from app.schemas.mailbox import MailboxCreate
from app.schemas.message import DraftCreate
from app.services import draft_service, mailbox_service, message_service
from app.services.email_parser import parse_email_bytes


SAMPLE_1 = (
    b"From: alice@example.com\r\n"
    b"To: box@arknexus.local\r\n"
    b"Subject: Hello world\r\n"
    b"MIME-Version: 1.0\r\n"
    b"Content-Type: text/plain; charset=utf-8\r\n"
    b"\r\n"
    b"This message contains the word pineapple in the body."
)

SAMPLE_2 = (
    b"From: bob@example.com\r\n"
    b"To: box@arknexus.local\r\n"
    b"Subject: Greetings from Bob\r\n"
    b"MIME-Version: 1.0\r\n"
    b"Content-Type: text/plain; charset=utf-8\r\n"
    b"\r\n"
    b"Plain text, nothing special here."
)


@pytest.mark.asyncio
async def test_search_finds_message_by_subject(db_session):
    mb = await mailbox_service.create_mailbox(db_session, MailboxCreate())
    mailbox = await mailbox_service.get_mailbox(db_session, mb.id)
    parsed = parse_email_bytes(SAMPLE_1)
    await message_service.create_message_from_parsed(db_session, mailbox, parsed)
    parsed2 = parse_email_bytes(SAMPLE_2)
    await message_service.create_message_from_parsed(db_session, mailbox, parsed2)

    results = await message_service.search_messages(db_session, mb.id, q="pineapple")
    assert len(results) == 1
    assert "pineapple" in (results[0].body_text or "").lower()

    results2 = await message_service.search_messages(db_session, mb.id, q="Bob")
    assert len(results2) == 1
    assert "Bob" in (results2[0].subject or "")


@pytest.mark.asyncio
async def test_bulk_mark_read(db_session):
    mb = await mailbox_service.create_mailbox(db_session, MailboxCreate())
    mailbox = await mailbox_service.get_mailbox(db_session, mb.id)
    for body in (SAMPLE_1, SAMPLE_2):
        await message_service.create_message_from_parsed(
            db_session, mailbox, parse_email_bytes(body)
        )
    msgs = await message_service.list_messages_for_mailbox(db_session, mb.id)
    ids = [m.id for m in msgs]
    affected = await message_service.bulk_action(
        db_session, mb.id, ids, "mark_read"
    )
    assert affected == 2

    msgs_after = await message_service.list_messages_for_mailbox(db_session, mb.id)
    assert all(m.is_read for m in msgs_after)


@pytest.mark.asyncio
async def test_bulk_delete_removes(db_session):
    mb = await mailbox_service.create_mailbox(db_session, MailboxCreate())
    mailbox = await mailbox_service.get_mailbox(db_session, mb.id)
    await message_service.create_message_from_parsed(
        db_session, mailbox, parse_email_bytes(SAMPLE_1)
    )
    msgs = await message_service.list_messages_for_mailbox(db_session, mb.id)
    affected = await message_service.bulk_action(
        db_session, mb.id, [m.id for m in msgs], "delete"
    )
    assert affected == 1
    msgs_after = await message_service.list_messages_for_mailbox(db_session, mb.id)
    assert msgs_after == []


@pytest.mark.asyncio
async def test_draft_lifecycle(db_session):
    mb = await mailbox_service.create_mailbox(db_session, MailboxCreate())
    mailbox = await mailbox_service.get_mailbox(db_session, mb.id)
    d = await draft_service.create_draft(
        db_session,
        mailbox,
        DraftCreate(
            to_addresses=["someone@example.com"],
            subject="Half-written",
            body_text="So far so good",
        ),
    )
    assert d.id
    drafts = await draft_service.list_drafts(db_session, mb.id)
    assert len(drafts) == 1

    d2 = await draft_service.get_draft(db_session, d.id)
    assert d2.subject == "Half-written"

    await draft_service.delete_draft(db_session, d.id)
    drafts_after = await draft_service.list_drafts(db_session, mb.id)
    assert drafts_after == []