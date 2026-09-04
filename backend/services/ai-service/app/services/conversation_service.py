"""Conversation persistence + lifecycle helpers."""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import ChatMessage, Conversation
from app.schemas.chat import (
    ConversationCreate,
    ConversationSummary,
    MessageCreate,
    SearchHit,
)

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
    conv = result.scalar_one_or_none()
    if conv is not None:
        # Force a fresh load of the messages relationship so callers see
        # anything committed after the conversation was first fetched.
        await session.refresh(conv, attribute_names=["messages"])
    return conv

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


# ===== Search + export helpers =====

# Window around a match for the human-readable snippet.
_SNIPPET_WINDOW = 60


def _make_snippet(content: str, query: str, window: int = _SNIPPET_WINDOW) -> str:
    """Return a short excerpt around the first match of ``query`` in ``content``.

    The match span is wrapped with ``>>...<<`` markers so the frontend can
    highlight it without needing to know the absolute position.
    """
    if not content:
        return ""
    text = content.replace("\n", " ")
    if not query:
        return text[: window * 2] + ("…" if len(text) > window * 2 else "")

    # Find the first match using a case-insensitive regex so the highlight
    # span stays aligned with the original casing in `text`.
    match = re.search(re.escape(query), text, flags=re.IGNORECASE)
    if not match:
        return text[: window * 2] + ("…" if len(text) > window * 2 else "")
    idx = match.start()
    q_len = match.end() - match.start()

    start = max(0, idx - window)
    end = min(len(text), idx + q_len + window)
    excerpt = text[start:end]
    if start > 0:
        excerpt = "…" + excerpt
    if end < len(text):
        excerpt = excerpt + "…"
    # Wrap the matched span (use the original-case substring).
    match_in_excerpt = excerpt.lower().find(query.lower())
    if match_in_excerpt >= 0:
        excerpt = (
            excerpt[:match_in_excerpt]
            + ">>"
            + excerpt[match_in_excerpt : match_in_excerpt + q_len]
            + "<<"
            + excerpt[match_in_excerpt + q_len :]
        )
    return excerpt


async def search_user_conversations(
    session: AsyncSession,
    user_id: str,
    *,
    query: str,
    include_archived: bool = False,
    limit: int = 50,
) -> List[SearchHit]:
    """Search a user's conversations by message content + title.

    Strategy:
      * Fetch all (non-archived) conversations for the user, with messages.
      * Filter in Python to keep the implementation dialect-agnostic
        (SQLite + PostgreSQL).
      * Rank by whether the query matches the title, then by message recency.
    """
    q = (query or "").strip()
    if not q:
        return []

    stmt = (
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .limit(200)  # safety cap; we'll slice again after ranking
    )
    if not include_archived:
        stmt = stmt.where(Conversation.is_archived.is_(False))
    rows = list((await session.execute(stmt)).scalars().unique().all())

    hits: List[SearchHit] = []
    q_lower = q.lower()
    for conv in rows:
        title_hit = q_lower in (conv.title or "").lower()
        # Emit a hit for the title itself if it matches, even if no messages.
        if title_hit:
            snippet = _make_snippet(conv.title, q)
            hits.append(
                SearchHit(
                    conversation_id=conv.id,
                    conversation_title=conv.title,
                    message_id="",
                    role="title",
                    snippet=snippet,
                    created_at=conv.updated_at or conv.created_at,
                )
            )
            if len(hits) >= limit:
                return hits
        for msg in conv.messages:
            content = msg.content or ""
            if q_lower in content.lower():
                snippet = _make_snippet(content, q)
                hits.append(
                    SearchHit(
                        conversation_id=conv.id,
                        conversation_title=conv.title,
                        message_id=msg.id,
                        role=msg.role,
                        snippet=snippet,
                        created_at=msg.created_at,
                    )
                )
                if len(hits) >= limit:
                    return hits
    return hits


def export_to_markdown(conv: Conversation) -> str:
    """Render a conversation to a Markdown transcript."""
    lines: List[str] = []
    lines.append(f"# {conv.title or 'Untitled conversation'}")
    lines.append("")
    lines.append(
        f"- Provider: `{conv.provider_id}`  ·  Model: `{conv.model_id}`"
    )
    lines.append(
        f"- Created: {conv.created_at.isoformat() if conv.created_at else ''}"
    )
    lines.append(
        f"- Updated: {conv.updated_at.isoformat() if conv.updated_at else ''}"
    )
    if conv.system_prompt:
        lines.append("")
        lines.append("## System prompt")
        lines.append("")
        lines.append("```")
        lines.append(conv.system_prompt)
        lines.append("```")
    if conv.temperature is not None or conv.max_tokens is not None or conv.top_p is not None:
        params = []
        if conv.temperature is not None:
            params.append(f"temperature={conv.temperature}")
        if conv.max_tokens is not None:
            params.append(f"max_tokens={conv.max_tokens}")
        if conv.top_p is not None:
            params.append(f"top_p={conv.top_p}")
        lines.append("")
        lines.append(f"Parameters: {', '.join(params)}")
    lines.append("")
    lines.append("---")
    lines.append("")
    for msg in conv.messages:
        role = msg.role.capitalize()
        lines.append(f"### {role}")
        lines.append("")
        lines.append(msg.content or "")
        if msg.finish_reason:
            lines.append("")
            lines.append(f"_finish_reason: `{msg.finish_reason}`_")
        if msg.total_tokens:
            lines.append(
                f"_tokens: prompt={msg.prompt_tokens}, completion={msg.completion_tokens}, total={msg.total_tokens}_"
            )
        lines.append("")
    return "\n".join(lines)


def export_to_json(conv: Conversation) -> str:
    """Render a conversation to a structured JSON transcript."""
    payload = {
        "id": conv.id,
        "title": conv.title,
        "provider_id": conv.provider_id,
        "model_id": conv.model_id,
        "system_prompt": conv.system_prompt,
        "temperature": conv.temperature,
        "max_tokens": conv.max_tokens,
        "top_p": conv.top_p,
        "is_pinned": conv.is_pinned,
        "is_archived": conv.is_archived,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "prompt_tokens": m.prompt_tokens,
                "completion_tokens": m.completion_tokens,
                "total_tokens": m.total_tokens,
                "finish_reason": m.finish_reason,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in conv.messages
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)
