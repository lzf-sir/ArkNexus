"""Common shared schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Generic, List, TypeVar

from pydantic import BaseModel, ConfigDict


T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int = 0


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str
    version: str
    time: datetime