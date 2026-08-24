"""Initialize the database using Alembic migrations.

Usage:
    python scripts/init_db.py           # upgrade to head
    python scripts/init_db.py --reset   # drop all tables then upgrade (dev convenience)
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

from app.core.logging import configure_logging  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.db.base import Base  # noqa: E402


def _cfg() -> Config:
    cfg = Config(str(PROJECT_ROOT / "alembic" / "alembic.ini"))
    cfg.set_main_option("script_location", str(PROJECT_ROOT / "alembic"))
    return cfg


def reset_and_upgrade() -> None:
    async def _drop_all() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    asyncio.run(_drop_all())
    command.upgrade(_cfg(), "head")


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize ArkNexus email-service schema")
    parser.add_argument("--reset", action="store_true", help="drop all tables first")
    args = parser.parse_args()

    configure_logging()
    if args.reset:
        print("Dropping all tables ...")
        reset_and_upgrade()
    else:
        print("Running alembic upgrade head ...")
        command.upgrade(_cfg(), "head")
    print("Done. You can now start the service with: python -m app.main")


if __name__ == "__main__":
    main()