"""Common shared schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Generic, List, TypeVar

from pydantic import BaseModel, ConfigDict, Field


T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for ORM-backed schemas."""

    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    """Lightweight paginated envelope."""

    items: List[T]
    total: int = Field(default=0)


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str
    version: str
    time: datetime


class StatsResponse(BaseModel):
    mailbox_total: int
    mailbox_active: int
    message_total: int
    message_active: int
    attachment_total: int
    retention_days: int
    cleanup_last_run: datetime | None = None