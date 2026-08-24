"""FastAPI gateway entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Awaitable, Callable

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.logging import configure_logging
from app.routes.email_proxy import router as email_proxy_router

logger = logging.getLogger(__name__)

VERSION = "0.1.0"


def _is_public(path: str) -> bool:
    """Match public paths. The special prefix `/` matches only the root."""
    for prefix in settings.public_path_prefixes:
        if prefix == "/":
            if path == "/":
                return True
        elif path.startswith(prefix):
            return True
    return False


def _extract_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info(
        "Starting %s (env=%s) -> email-service=%s",
        settings.gateway_name,
        settings.app_env,
        settings.email_service_url,
    )
    yield
    logger.info("Gateway shutdown complete")


async def jwt_edge_check(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if not settings.require_auth_for_protected:
        return await call_next(request)

    path = request.url.path
    if _is_public(path):
        return await call_next(request)

    token = _extract_token(request.headers.get("authorization"))
    if not token:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing bearer token"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": f"Invalid token: {exc}"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await call_next(request)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.gateway_name,
        version=VERSION,
        description="Unified API entrypoint for ArkNexus microservices.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.middleware("http")(jwt_edge_check)

    @app.get("/", tags=["meta"])
    async def root() -> dict:
        return {
            "service": settings.gateway_name,
            "version": VERSION,
            "upstream": {"email_service": settings.email_service_url},
            "auth_required": settings.require_auth_for_protected,
            "public_paths": settings.public_path_prefixes,
        }

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        return {"status": "ok"}

    app.include_router(email_proxy_router)
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