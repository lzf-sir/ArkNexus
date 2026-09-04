"""Tests for the retention / cleanup service.

We swap the SQLAlchemy engine to point at a fresh on-disk SQLite DB per
test, recreate the schema, run the test, then drop everything.
"""

from __future__ import annotations

import os
import tempfile
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator

import pytest_asyncio


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[object]:
    from sqlalchemy.ext.asyncio import (
        AsyncEngine,
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )

    from app.db import session as session_mod
    from app.db.base import Base
    from app.models import Attachment, Mailbox, Message, SystemState  # noqa: F401
    # `retention_service` captured `SessionLocal` at import time, so patching
    # `app.db.session.SessionLocal` after-the-fact doesn't reach it.
    from app.services import retention_service

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    test_url = f"sqlite+aiosqlite:///{tmp.name}"

    new_engine: AsyncEngine = create_async_engine(
        test_url, echo=False, future=True, connect_args={"check_same_thread": False}
    )
    new_factory = async_sessionmaker(new_engine, expire_on_commit=False, class_=AsyncSession)

    original_engine = session_mod.engine
    original_factory = session_mod.SessionLocal
    original_rs_session_local = retention_service.SessionLocal
    session_mod.engine = new_engine
    session_mod.SessionLocal = new_factory
    retention_service.SessionLocal = new_factory

    try:
        async with new_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with new_factory() as session:
            yield session
    finally:
        try:
            async with new_engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        except Exception:
            pass
        await new_engine.dispose()
        session_mod.engine = original_engine
        session_mod.SessionLocal = original_factory
        retention_service.SessionLocal = original_rs_session_local
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


async def _make_mailbox(session, *, address: str = "test@arknexus.local", expires_at=None):
    from app.models.mailbox import Mailbox
    mb = Mailbox(
        address=address,
        display_name="Test",
        expires_at=expires_at or (datetime.now(timezone.utc) + timedelta(days=10)),
    )
    session.add(mb)
    await session.commit()
    await session.refresh(mb)
    return mb


async def _make_message(session, *, mailbox_id: str, subject: str = "hi", received_at=None, body: str = "body"):
    from app.models.message import Message
    m = Message(
        mailbox_id=mailbox_id,
        from_address="sender@example.com",
        subject=subject,
        body_text=body,
        received_at=received_at or datetime.now(timezone.utc),
    )
    session.add(m)
    await session.commit()
    await session.refresh(m)
    return m


# ===== run_cleanup =====


async def test_run_cleanup_removes_expired_mailboxes(db_session):
    from app.services import retention_service
    past = datetime.now(timezone.utc) - timedelta(days=1)
    future = datetime.now(timezone.utc) + timedelta(days=10)
    expired = await _make_mailbox(db_session, address="expired@x.com", expires_at=past)
    active = await _make_mailbox(db_session, address="active@x.com", expires_at=future)

    stats = await retention_service.run_cleanup()

    assert stats["mailboxes_deleted"] >= 1
    from sqlalchemy import select
    from app.models.mailbox import Mailbox
    remaining = (await db_session.execute(select(Mailbox))).scalars().all()
    remaining_ids = {m.id for m in remaining}
    assert expired.id not in remaining_ids
    assert active.id in remaining_ids


async def test_run_cleanup_removes_messages_older_than_retention_window(db_session):
    from app.services import retention_service
    mb = await _make_mailbox(db_session)
    ancient = await _make_message(
        db_session,
        mailbox_id=mb.id,
        subject="ancient",
        received_at=datetime.now(timezone.utc) - timedelta(days=365),
    )
    fresh = await _make_message(
        db_session, mailbox_id=mb.id, subject="fresh"
    )

    stats = await retention_service.run_cleanup()

    assert stats["messages_deleted"] >= 1
    from sqlalchemy import select
    from app.models.message import Message
    remaining = (await db_session.execute(select(Message))).scalars().all()
    remaining_ids = {m.id for m in remaining}
    assert ancient.id not in remaining_ids
    assert fresh.id in remaining_ids


async def test_run_cleanup_idempotent_on_empty_db(db_session):
    from app.services import retention_service
    stats = await retention_service.run_cleanup()
    assert stats["mailboxes_deleted"] == 0
    assert stats["messages_deleted"] == 0
    assert stats["attachments_deleted"] == 0


# ===== stats =====


async def test_stats_counts_active_and_total(db_session):
    from app.services import retention_service
    past = datetime.now(timezone.utc) - timedelta(days=1)
    future = datetime.now(timezone.utc) + timedelta(days=10)
    await _make_mailbox(db_session, address="exp@x.com", expires_at=past)
    await _make_mailbox(db_session, address="a@x.com", expires_at=future)
    mb = await _make_mailbox(db_session, address="b@x.com")
    await _make_message(db_session, mailbox_id=mb.id, subject="x")

    out = await retention_service.stats(db_session)

    assert out["mailbox_total"] == 3
    assert out["mailbox_active"] == 2  # both future-expiry mailboxes
    assert out["message_total"] == 1
    assert out["attachment_total"] == 0
    assert out["retention_days"] >= 1


async def test_stats_message_active_filters_by_retention_window(db_session):
    from app.services import retention_service
    mb = await _make_mailbox(db_session)
    # One old message outside the retention window.
    await _make_message(
        db_session,
        mailbox_id=mb.id,
        subject="old",
        received_at=datetime.now(timezone.utc) - timedelta(days=365),
    )
    await _make_message(db_session, mailbox_id=mb.id, subject="new")

    out = await retention_service.stats(db_session)

    assert out["message_total"] == 2
    assert out["message_active"] == 1  # only the recent one
