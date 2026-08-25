"""Pydantic schemas for AI conversations."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import ORMModel

Role = Literal["system", "user", "assistant", "tool"]


class ConversationCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    provider_id: str = Field(min_length=1, max_length=64)
    model_id: str = Field(min_length=1, max_length=120)
    system_prompt: Optional[str] = Field(default=None, max_length=8000)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=200000)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    first_message: Optional[str] = Field(default=None, max_length=32000)


class ConversationUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    system_prompt: Optional[str] = Field(default=None, max_length=8000)
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=200000)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class MessageCreate(BaseModel):
    role: Role = "user"
    content: str = Field(min_length=1, max_length=32000)


class ChatRequest(BaseModel):
    """One-shot chat (no persistence)."""
    provider_id: str
    model_id: str
    messages: List[Dict[str, Any]] = Field(min_length=1)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=200000)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    stream: Optional[bool] = None


class MessageRead(ORMModel):
    id: str
    conversation_id: str
    role: Role
    content: str
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    provider_id: Optional[str] = None
    model_id: Optional[str] = None
    finish_reason: Optional[str] = None
    created_at: datetime


class ConversationRead(ORMModel):
    id: str
    user_id: str
    title: str
    provider_id: str
    model_id: str
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    is_pinned: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    messages: List[MessageRead] = Field(default_factory=list)


class ConversationSummary(ORMModel):
    """A conversation without its full message list."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    provider_id: str
    model_id: str
    is_pinned: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message_preview: Optional[str] = None
