"""v1 API router aggregator."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import auth, init, mailboxes, messages, oauth, organization, system

api_router = APIRouter()
api_router.include_router(init.router)
api_router.include_router(auth.router)
api_router.include_router(oauth.router)
api_router.include_router(mailboxes.router)
api_router.include_router(messages.router)
api_router.include_router(organization.router)
api_router.include_router(system.router)