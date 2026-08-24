"""Tests for mailbox service."""

import pytest

from app.schemas.mailbox import MailboxCreate
from app.services import mailbox_service


@pytest.mark.asyncio
async def test_create_and_get_mailbox(db_session):
    mb = await mailbox_service.create_mailbox(db_session, MailboxCreate())
    assert mb.id
    assert mb.address.endswith("@arknexus.local")
    fetched = await mailbox_service.get_mailbox(db_session, mb.id)
    assert fetched.address == mb.address


@pytest.mark.asyncio
async def test_create_with_custom_local_part(db_session):
    mb = await mailbox_service.create_mailbox(
        db_session, MailboxCreate(local_part="my-custom-tag-1")
    )
    assert mb.address.startswith("mycustomtag1@")


@pytest.mark.asyncio
async def test_collision_for_custom_address(db_session):
    await mailbox_service.create_mailbox(
        db_session, MailboxCreate(local_part="dup-1")
    )
    with pytest.raises(mailbox_service.MailboxAddressTaken):
        await mailbox_service.create_mailbox(
            db_session, MailboxCreate(local_part="dup-1")
        )


@pytest.mark.asyncio
async def test_list_mailboxes_excludes_expired(db_session):
    fresh = await mailbox_service.create_mailbox(db_session, MailboxCreate())
    expired = await mailbox_service.create_mailbox(db_session, MailboxCreate())
    from datetime import datetime, timedelta, timezone
    expired.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    await db_session.commit()

    items = await mailbox_service.list_mailboxes(db_session, include_expired=False)
    ids = {m.id for m in items}
    assert fresh.id in ids
    assert expired.id not in ids

    items_all = await mailbox_service.list_mailboxes(db_session, include_expired=True)
    ids_all = {m.id for m in items_all}
    assert expired.id in ids_all