"""FastAPI entrypoint for the config-service."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# Make the backend/shared module package importable.
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_SHARED = _BACKEND_ROOT / "shared"
if _SHARED.exists() and str(_SHARED) not in sys.path:
    sys.path.insert(0, str(_SHARED))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import init_db

logger = logging.getLogger(__name__)

VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("Starting %s (env=%s)", settings.app_name, settings.app_env)
    await init_db()
    try:
        yield
    finally:
        logger.info("Shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=VERSION,
        description="Central configuration registry for ArkNexus microservices.",
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
        }

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        return {"status": "ok", "service": settings.app_name}

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.app_env == "development",
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()