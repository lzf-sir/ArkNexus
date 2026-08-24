"""APScheduler setup for retention cleanup."""

from __future__ import annotations

import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.services.retention_service import run_cleanup

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


async def _cleanup_job() -> None:
    try:
        result = await run_cleanup()
        logger.info("Scheduled retention cleanup result: %s", result)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Retention cleanup failed: %s", exc)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _cleanup_job,
        trigger=IntervalTrigger(hours=settings.cleanup_interval_hours),
        id="retention_cleanup",
        max_instances=1,
        coalesce=True,
        next_run_time=None,  # first run is manual via /api/v1/system/cleanup
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info(
        "Retention scheduler started: every %s hour(s)",
        settings.cleanup_interval_hours,
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None