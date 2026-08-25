"""Chat endpoints (one-shot + per-conversation streaming)."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserDep, CurrentUser, db_session
from app.core.config import settings
from app.schemas.chat import ChatRequest, ConversationRead, MessageCreate
from app.services import conversation_service
from app.services.chat_service import (
    chat_for_conversation,
    chat_once,
    stream_chat,
)
from app.services.llm_client import UpstreamError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai-chat"])


@router.post("/ai/chat", summary="One-shot chat (no persistence).")
async def one_shot_chat(req: ChatRequest, _user: CurrentUser = CurrentUserDep) -> Dict:
    stream = bool(req.stream) if req.stream is not None else settings.default_stream
    if stream:
        return StreamingResponse(
            _sse_generator(req),
            media_type="text/event-stream",
        )
    try:
        result = await chat_once(req)
    except UpstreamError as exc:
        raise HTTPException(status_code=exc.status or 502, detail=str(exc))
    return {
        "text": result["text"],
        "usage": result["usage"],
        "raw": result["response"],
    }


async def _sse_generator(req: ChatRequest) -> AsyncIterator[bytes]:
    """SSE-style event stream the frontend can read via fetch + ReadableStream."""
    async for chunk in stream_chat(req):
        yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode("utf-8")
    yield "data: [DONE]\n\n".encode("utf-8")


@router.post("/ai/conversations/{conversation_id}/chat", summary="Append a user message + stream the assistant reply (persisted).")
async def chat_in_conversation(
    conversation_id: str,
    body: MessageCreate,
    user: CurrentUser = CurrentUserDep,
    session: AsyncSession = Depends(db_session),
) -> StreamingResponse:
    conv = await conversation_service.get_conversation(session, user.id, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return StreamingResponse(
        _stream_persisted(session, conv, body.content),
        media_type="text/event-stream",
    )


async def _stream_persisted(session: AsyncSession, conv, user_text: str) -> AsyncIterator[bytes]:
    """Persist the user message, stream the assistant reply, persist it at the end."""
    # Persist the user message first so it appears in history immediately.
    await conversation_service.add_message(session, conv, MessageCreate(role="user", content=user_text))
    msgs = await conversation_service.list_messages(session, conv)
    provider_messages, _ = conversation_service.history_to_provider_messages(
        msgs, conv.system_prompt, max_messages=settings.max_conversation_messages
    )
    req = ChatRequest(
        provider_id=conv.provider_id,
        model_id=conv.model_id,
        messages=provider_messages,
        temperature=conv.temperature,
        max_tokens=conv.max_tokens,
        top_p=conv.top_p,
        stream=True,
    )
    accumulated: list[str] = []
    final_usage: Dict | None = None
    finish_reason: str | None = None
    assistant_id: str | None = None
    async for chunk in stream_chat(req):
        if chunk.get("type") == "delta":
            accumulated.append(chunk["delta"])
        elif chunk.get("type") == "usage":
            final_usage = chunk["usage"]
        elif chunk.get("type") == "finish":
            finish_reason = chunk["finish_reason"]
        yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode("utf-8")
    # Persist the assistant message.
    text = "".join(accumulated)
    saved = await conversation_service.save_assistant_message(
        session, conv,
        content=text,
        provider_id=conv.provider_id,
        model_id=conv.model_id,
        prompt_tokens=(final_usage or {}).get("prompt_tokens"),
        completion_tokens=(final_usage or {}).get("completion_tokens"),
        total_tokens=(final_usage or {}).get("total_tokens"),
        finish_reason=finish_reason,
    )
    done = {
        "type": "done",
        "text": text,
        "assistant_message_id": saved.id,
        "usage": final_usage,
    }
    yield f"data: {json.dumps(done, ensure_ascii=False)}\n\n".encode("utf-8")
    yield "data: [DONE]\n\n".encode("utf-8")
