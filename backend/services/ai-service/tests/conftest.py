"""Pytest fixtures for the AI service.

We swap the SQLAlchemy engine to point at a fresh on-disk SQLite DB per
session, recreate the schema, run the test, then drop everything. The
session-scoped fixture is intentional so module-level ``engine`` bindings
stay valid across the test functions.
"""

from __future__ import annotations

import os
import tempfile
from typing import AsyncIterator

import pytest_asyncio


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[object]:
    """Yield a session against a fresh SQLite DB.

    We monkey-patch ``app.db.session.engine`` and ``SessionLocal`` so the
    production code paths use our temporary engine.
    """
    import asyncio

    from sqlalchemy.ext.asyncio import (
        AsyncEngine,
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )

    from app.db import session as session_mod
    from app.db.base import Base
    from app.models.conversation import ChatMessage, Conversation  # noqa: F401

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    test_url = f"sqlite+aiosqlite:///{tmp.name}"

    new_engine: AsyncEngine = create_async_engine(
        test_url, echo=False, future=True, connect_args={"check_same_thread": False}
    )
    new_factory = async_sessionmaker(new_engine, expire_on_commit=False, class_=AsyncSession)

    # Swap module-level bindings.
    original_engine = session_mod.engine
    original_factory = session_mod.SessionLocal
    session_mod.engine = new_engine
    session_mod.SessionLocal = new_factory

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
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
