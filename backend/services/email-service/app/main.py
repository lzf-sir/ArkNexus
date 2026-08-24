"""FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import init_db
from app.services.config_sync import start_config_sync, stop_config_sync
from app.smtp.server import start_smtp, stop_smtp
from app.tasks.scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)

VERSION = "0.2.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("Starting %s (env=%s)", settings.app_name, settings.app_env)

    await init_db()
    start_smtp()
    start_scheduler()

    if settings.config_service_register_on_startup:
        try:
            await start_config_sync()
        except Exception as exc:  # noqa: BLE001
            logger.warning("config-service sync failed to start: %s", exc)

    try:
        yield
    finally:
        if settings.config_service_register_on_startup:
            try:
                await stop_config_sync()
            except Exception:  # noqa: BLE001
                pass
        stop_scheduler()
        stop_smtp()
        logger.info("Shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=VERSION,
        description="Temporary mailbox microservice for ArkNexus.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["meta"])
    async def root() -> dict:
        return {
            "service": settings.app_name,
            "version": VERSION,
            "docs": "/docs",
            "smtp": f"{settings.smtp_host}:{settings.smtp_port}",
            "domain": settings.email_domain,
        }

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()