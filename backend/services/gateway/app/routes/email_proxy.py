"""Multi-upstream reverse-proxy router.

Forwards `/api/v1/*` to whichever upstream service owns the path:

  * /api/v1/services/*       -> config-service
  * /api/v1/llm/*            -> config-service (LLM catalog)
  * /api/v1/ai/*             -> ai-service
  * everything else          -> email-service

Streaming responses (Server-Sent Events) are supported: when the
upstream returns `text/event-stream`, we forward chunks as they arrive.
"""
from __future__ import annotations

import logging
from typing import Iterable

import httpx
from fastapi import APIRouter, Request, Response

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Endpoints that need to pass through binary responses (attachment downloads, etc.)
_PASS_THROUGH_CONTENT_TYPES_PREFIXES = (
    "application/octet-stream",
    "image/",
    "audio/",
    "video/",
    "application/pdf",
)


def _resolve_upstream(path: str) -> str:
    """Pick the upstream base URL based on the request path prefix."""
    # Most specific first
    overrides = {
        "/api/v1/services": settings.config_service_url,
        "/api/v1/llm": settings.config_service_url,
        "/api/v1/ai": settings.ai_service_url,
        "/api/v1/auth": settings.email_service_url,
    }
    for prefix, url in overrides.items():
        if path.startswith(prefix):
            return url.rstrip("/")
    # Default: everything else goes to email-service.
    return settings.email_service_url.rstrip("/")


def _should_stream(headers) -> bool:
    ct = headers.get("content-type", "")
    return ct.startswith("text/event-stream")


@router.api_route(
    "/api/v1/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(request: Request) -> Response:
    """Forward every /api/v1/* call to the matching upstream service.

    The gateway is intentionally thin: it does not validate or re-shape
    payloads. Auth is enforced by middleware in main.py before this runs.
    """
    path = request.url.path
    upstream = _resolve_upstream(path)
    target = f"{upstream}{path}"

    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in {"host", "content-length", "connection"}
    }
    if "authorization" not in {h.lower() for h in headers}:
        auth = request.headers.get("authorization")
        if auth:
            headers["Authorization"] = auth

    body = await request.body()
    is_streaming_request = (request.headers.get("accept", "").startswith("text/event-stream"))

    if is_streaming_request:
        return await _proxy_stream(target, request, headers, body, upstream)

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            upstream_resp = await client.request(
                method=request.method,
                url=target,
                params=request.query_params,
                headers=headers,
                content=body,
            )
        except httpx.RequestError as exc:
            logger.exception("Upstream %s unreachable: %s", upstream, exc)
            return Response(
                content=b'{"detail":"upstream service unavailable"}',
                media_type="application/json",
                status_code=502,
            )

    passthrough = upstream_resp.headers.get("content-type", "").startswith(
        _PASS_THROUGH_CONTENT_TYPES_PREFIXES
    )

    response_headers = {
        k: v
        for k, v in upstream_resp.headers.items()
        if k.lower() not in {
            "content-length",
            "transfer-encoding",
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "upgrade",
        }
    }

    return Response(
        content=upstream_resp.content,
        status_code=upstream_resp.status_code,
        headers=response_headers,
        media_type=None if passthrough else upstream_resp.headers.get("content-type"),
    )


async def _proxy_stream(target: str, request: Request, headers: dict, body: bytes, upstream: str) -> Response:
    """Stream the upstream response back to the client (SSE / chunked)."""

    async def _gen():
        timeout = httpx.Timeout(300.0, read=300.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream(
                    method=request.method,
                    url=target,
                    params=request.query_params,
                    headers=headers,
                    content=body,
                ) as upstream_resp:
                    async for chunk in upstream_resp.aiter_bytes():
                        yield chunk
            except httpx.RequestError as exc:
                logger.exception("Streaming upstream %s unreachable: %s", upstream, exc)
                yield b'{"detail":"upstream service unavailable"}\n'

    # Return a StreamingResponse. The actual content-type comes from upstream.
    # We forward `cache-control: no-cache` and `X-Accel-Buffering: no` which are
    # friendlier for SSE proxies.
    return Response(
        content=_gen(),
        status_code=200,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


_ = Iterable  # silence unused-import warnings
