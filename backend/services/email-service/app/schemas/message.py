"""Message and attachment schemas."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class AttachmentRead(ORMModel):
    id: str
    filename: str
    content_type: str
    size_bytes: int
    content_id: Optional[str] = None


class LabelInline(BaseModel):
    id: str
    name: str
    color: str


class MessageSummary(BaseModel):
    id: str
    mailbox_id: str
    from_address: str
    from_name: Optional[str] = None
    subject: str
    preview: str
    received_at: datetime
    is_read: bool
    is_starred: bool
    has_attachments: bool
    size_bytes: int
    is_trashed: bool = False
    folder_id: Optional[str] = None
    labels: List[LabelInline] = Field(default_factory=list)


class MessageRead(ORMModel):
    id: str
    mailbox_id: str
    rfc_message_id: Optional[str] = None
    from_address: str
    from_name: Optional[str] = None
    to_addresses: List[str]
    cc_addresses: List[str]
    subject: Optional[str]
    body_text: Optional[str]
    body_html: Optional[str]
    received_at: datetime
    is_read: bool
    is_starred: bool
    has_attachments: bool
    size_bytes: int
    is_trashed: bool = False
    folder_id: Optional[str] = None
    labels: List[LabelInline] = Field(default_factory=list)
    attachments: List[AttachmentRead]


class MessageUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_starred: Optional[bool] = None


    relay_mode: str


class BulkActionRequest(BaseModel):
    message_ids: List[str] = Field(min_length=1, max_length=200)
    action: str = Field(pattern="^(delete|mark_read|mark_unread|star|unstar)$")


class BulkActionResponse(BaseModel):
    affected: int
    action: str


# ===== Drafts =====

class DraftBase(BaseModel):
    to_addresses: List[str] = Field(default_factory=list)
    cc_addresses: List[str] = Field(default_factory=list)
    subject: str = Field(default="", max_length=998)
    body_text: Optional[str] = None
    body_html: Optional[str] = None


class DraftCreate(DraftBase):
    pass


class DraftUpdate(DraftBase):
    pass


class DraftRead(ORMModel):
    id: str
    mailbox_id: str
    to_addresses: List[str]
    cc_addresses: List[str]
    subject: str
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    created_at: datetime
    updated_at: datetime