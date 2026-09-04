"""Pytest fixtures."""

from __future__ import annotations

from typing import AsyncIterator

import pytest_asyncio

from app.db.session import SessionLocal, engine
from app.models import Attachment, Mailbox, Message, SystemState, User  # noqa: F401


TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest_asyncio.fixture
async def session() -> AsyncIterator[object]:
    """Yield a session with a freshly-emptied database."""
    from app.db.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session_:
        yield session_


# Backwards-compatible name used by older tests.
@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[object]:
    from app.db.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session_:
        yield session_