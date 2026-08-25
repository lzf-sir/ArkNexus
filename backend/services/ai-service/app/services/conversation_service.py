"""Conversation persistence + lifecycle helpers."""
from __future__ import annotations

import logging
from typing import List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import ChatMessage, Conversation
from app.schemas.chat import ConversationCreate, ConversationSummary, MessageCreate

logger = logging.getLogger(__name__)

async def list_conversations(
    session: AsyncSession,
    user_id: str,
    *,
    include_archived: bool = False,
    limit: int = 100,
) -> List[ConversationSummary]:
    stmt = (
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.is_pinned.desc(), Conversation.updated_at.desc())
        .limit(limit)
    )
    if not include_archived:
        stmt = stmt.where(Conversation.is_archived.is_(False))
    result = await session.execute(stmt)
    rows = result.scalars().unique().all()

    summaries: List[ConversationSummary] = []
    for c in rows:
        last = c.messages[-1] if c.messages else None
        summaries.append(
            ConversationSummary(
                id=c.id,
                user_id=c.user_id,
                title=c.title,
                provider_id=c.provider_id,
                model_id=c.model_id,
                is_pinned=c.is_pinned,
                is_archived=c.is_archived,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=len(c.messages),
                last_message_preview=(last.content[:120] if last else None),
            )
        )
    return summaries

async def get_conversation(
    session: AsyncSession,
    user_id: str,
    conversation_id: str,
) -> Optional[Conversation]:
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

async def create_conversation(
    session: AsyncSession,
    user_id: str,
    payload: ConversationCreate,
) -> Conversation:
    title = payload.title
    if not title and payload.first_message:
        title = payload.first_message.strip().splitlines()[0][:80]
    if not title:
        title = "新对话"
    conv = Conversation(
        user_id=user_id,
        title=title,
        provider_id=payload.provider_id,
        model_id=payload.model_id,
        system_prompt=payload.system_prompt,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        top_p=payload.top_p,
    )
    session.add(conv)
    await session.flush()
    if payload.first_message:
        msg = ChatMessage(conversation_id=conv.id, role="user", content=payload.first_message)
        session.add(msg)
    await session.commit()
    await session.refresh(conv)
    return conv

async def update_conversation(
    session: AsyncSession,
    conv: Conversation,
    *,
    title: Optional[str] = None,
    system_prompt: Optional[str] = None,
    is_pinned: Optional[bool] = None,
    is_archived: Optional[bool] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    top_p: Optional[float] = None,
) -> Conversation:
    if title is not None:
        conv.title = title
    if system_prompt is not None:
        conv.system_prompt = system_prompt
    if is_pinned is not None:
        conv.is_pinned = is_pinned
    if is_archived is not None:
        conv.is_archived = is_archived
    if temperature is not None:
        conv.temperature = temperature
    if max_tokens is not None:
        conv.max_tokens = max_tokens
    if top_p is not None:
        conv.top_p = top_p
    await session.commit()
    await session.refresh(conv)
    return conv

async def delete_conversation(session: AsyncSession, conv: Conversation) -> None:
    await session.delete(conv)
    await session.commit()

async def add_message(
    session: AsyncSession,
    conv: Conversation,
    payload: MessageCreate,
) -> ChatMessage:
    msg = ChatMessage(conversation_id=conv.id, role=payload.role, content=payload.content)
    session.add(msg)
    await session.commit()
    await session.refresh(msg)
    return msg

async def save_assistant_message(
    session: AsyncSession,
    conv: Conversation,
    *,
    content: str,
    provider_id: str,
    model_id: str,
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    finish_reason: Optional[str] = None,
    extra: Optional[dict] = None,
) -> ChatMessage:
    msg = ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=content,
        provider_id=provider_id,
        model_id=model_id,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        finish_reason=finish_reason,
        extra=extra,
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)
    return msg

async def list_messages(session: AsyncSession, conv: Conversation) -> List[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())

def history_to_provider_messages(
    messages: List[ChatMessage],
    system_prompt: Optional[str],
    max_messages: int = 200,
) -> Tuple[List[dict], List[ChatMessage]]:
    included = list(messages)[-max_messages:]
    out: List[dict] = []
    if system_prompt:
        out.append({"role": "system", "content": system_prompt})
    for m in included:
        if m.role in ("user", "assistant", "system", "tool"):
            if m.role == "system" and system_prompt:
                continue
            out.append({"role": m.role, "content": m.content})
    return out, included
