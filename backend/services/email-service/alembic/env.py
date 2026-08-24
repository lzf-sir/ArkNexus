"""Alembic environment.

Runs migrations against either SQLite (aiosqlite) or PostgreSQL (asyncpg)
by stripping the async driver prefix to obtain a sync URL Alembic can use.
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make `app.*` importable when running `alembic` from project root.
HERE = Path(__file__).resolve()
PROJECT_ROOT = HERE.parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402

# Importing models registers them on Base.metadata.
import app.models  # noqa: E402,F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sync_url(async_url: str) -> str:
    """Strip the async driver prefix so Alembic's sync engine can connect."""
    return (
        async_url.replace("sqlite+aiosqlite", "sqlite")
        .replace("postgresql+asyncpg", "postgresql")
    )


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url(settings.database_url),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = _sync_url(settings.database_url)

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()