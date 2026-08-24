"""Schemas for folders, labels, and the trash workflow."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


# ===== Folders =====

class FolderBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: Optional[str] = Field(default=None, max_length=20)


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    color: Optional[str] = Field(default=None, max_length=20)


class FolderRead(ORMModel):
    id: str
    slug: str
    name: str
    color: Optional[str] = None
    is_system: bool
    created_at: datetime


# ===== Labels =====

_LABEL_COLORS = {
    "blue", "red", "green", "orange", "purple", "cyan", "magenta", "gold", "grey",
}


class LabelBase(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str = Field(default="blue", max_length=20)

    @field_validator("color")
    @classmethod
    def _validate_color(cls, v: str) -> str:
        if v not in _LABEL_COLORS:
            return "blue"
        return v


class LabelCreate(LabelBase):
    pass


class LabelUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=40)
    color: Optional[str] = Field(default=None, max_length=20)

    @field_validator("color")
    @classmethod
    def _validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in _LABEL_COLORS:
            return "blue"
        return v


class LabelRead(ORMModel):
    id: str
    name: str
    color: str
    created_at: datetime


# ===== Message label bindings =====

class MessageLabelUpdate(BaseModel):
    """Add or remove labels on a message."""

    label_ids: List[str] = Field(default_factory=list, max_length=50)


class MessageLabelRead(BaseModel):
    label_id: str
    name: str
    color: str
