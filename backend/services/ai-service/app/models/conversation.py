"""Conversation + message models."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _new_id() -> str:
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False, default="新对话")
    # Effective provider/model + system prompt that produced this conversation.
    provider_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    model_id: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Generation parameters snapshot.
    temperature: Mapped[Optional[float]] = mapped_column(nullable=True)
    max_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    is_pinned: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        index=True,
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
        lazy="selectin",
    )


class ChatMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # "system" | "user" | "assistant" | "tool"
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Token accounting (populated when the upstream response carries usage).
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # For assistant messages: provider/model that produced them.
    provider_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    model_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    finish_reason: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)

    # Any extra structured payload (tool calls, citations, raw response).
    extra: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    conversation: Mapped[Conversation] = relationship(
        "Conversation", back_populates="messages"
    )
