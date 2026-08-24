"""Async SQLAlchemy engine + session factory."""

from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.db.base import Base

# Ensure models are registered with the metadata before table creation.
import app.models  # noqa: F401


def _make_engine(url: str) -> AsyncEngine:
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_async_engine(url, echo=False, future=True, connect_args=connect_args)


engine: AsyncEngine = _make_engine(settings.database_url)
SessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields an `AsyncSession`."""
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create all tables (development only; production uses Alembic)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)