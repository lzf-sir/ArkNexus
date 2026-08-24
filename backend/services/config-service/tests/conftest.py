"""Pytest fixtures for the config-service."""

from __future__ import annotations

from typing import AsyncIterator

import pytest_asyncio

from app.db.session import SessionLocal, engine
from app.models import ConfigHistory, ConfigKey, Service  # noqa: F401


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[object]:
    """Yield a session with a freshly-emptied database."""
    from app.db.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        yield session