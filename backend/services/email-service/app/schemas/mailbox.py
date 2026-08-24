"""Mailbox schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class MailboxBase(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=120)


class MailboxCreate(MailboxBase):
    """Optional: caller may provide a desired local-part; otherwise random."""

    local_part: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=40,
        description="Custom local-part for the address; if None a random one is generated.",
    )


class MailboxUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=120)
    extend_days: Optional[int] = Field(
        default=None,
        ge=1,
        le=365,
        description="Optional: extend expiry by N days (max 365).",
    )


class MailboxRead(ORMModel):
    id: str
    address: str
    display_name: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    last_accessed_at: datetime
    message_count: int
    unread_count: int = 0


class MailboxSummary(BaseModel):
    """Lightweight summary for switcher UIs."""

    id: str
    address: str
    display_name: Optional[str] = None
    message_count: int
    unread_count: int
    expires_at: datetime