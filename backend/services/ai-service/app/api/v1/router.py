"""v1 router aggregator for ai-service."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import catalog, chat, config, conversations

api_router = APIRouter()
api_router.include_router(catalog.router)
api_router.include_router(config.router)
api_router.include_router(conversations.router)
api_router.include_router(chat.router)
