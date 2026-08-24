"""ai-service FastAPI entrypoint."""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Make backend/shared importable so we can reach llm_catalog.
_BACKEND = Path(__file__).resolve().parents[3]
_SHARED = _BACKEND / "shared"
if _SHARED.exists() and str(_SHARED) not in sys.path:
    sys.path.insert(0, str(_SHARED))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import init_db
from app.services.ai_config_store import get_config_store
from app.services.config_sync import start_config_sync, stop_config_sync

logger = logging.getLogger(__name__)

VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("Starting %s (env=%s)", settings.app_name, settings.app_env)
    await init_db()
    try:
        await get_config_store().bootstrap()
    except Exception as exc:
        logger.warning("config store bootstrap failed: %s", exc)
    if settings.config_service_register_on_startup:
        try:
            await start_config_sync()
        except Exception as exc:
            logger.warning("config-service sync failed to start: %s", exc)
    try:
        yield
    finally:
        if settings.config_service_register_on_startup:
            try:
                await stop_config_sync()
            except Exception:
                pass
        logger.info("ai-service shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=VERSION,
        description="AI 助手微服务：多模型对话 + 会话管理 + 流式输出",
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
        return {"service": settings.app_name, "version": VERSION, "docs": "/docs"}

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
