"""v1 API aggregator."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import configs, llm_catalog, services

api_router = APIRouter()
api_router.include_router(services.router)
api_router.include_router(configs.router)
api_router.include_router(llm_catalog.router)
