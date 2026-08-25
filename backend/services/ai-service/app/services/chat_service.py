"""High-level chat service: ties LLM calls to conversations."""
from __future__ import annotations

import logging
from typing import AsyncIterator, Dict, List, Optional

from app.core.config import settings
from app.schemas.chat import ChatRequest
from app.services import conversation_service
from app.services.ai_config_store import get_config_store
from app.services.llm_client import (
    UpstreamError,
    chat_completion,
    extract_assistant_text,
    extract_usage,
    stream_chat_completion,
)

# We deliberately import the catalog lazily: a single source of truth
# lives in backend/shared/llm_catalog.py which is added to sys.path by
# the application entrypoint.
import llm_catalog  # type: ignore

logger = logging.getLogger(__name__)

async def _resolve_provider(provider_id: str):
    prov = llm_catalog.get_provider(provider_id)
    if prov is None:
        raise UpstreamError(400, f"Unknown provider: {provider_id}")
    return prov

async def _ensure_key(provider_id: str) -> str:
    api_key = await get_config_store().get_api_key(provider_id)
    if not api_key:
        raise UpstreamError(400, f"服务商 {provider_id} 尚未配置 API Key")
    return api_key

async def chat_once(req: ChatRequest) -> Dict[str, Any]:
    provider = await _resolve_provider(req.provider_id)
    api_key = await _ensure_key(req.provider_id)
    base_url = await get_config_store().get_base_url_override(req.provider_id)
    payload = await chat_completion(
        provider=provider,
        api_key=api_key,
        model=req.model_id,
        messages=req.messages,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        top_p=req.top_p,
        base_url_override=base_url,
        timeout_seconds=settings.upstream_timeout_seconds,
    )
    return {
        "provider": provider,
        "response": payload,
        "text": extract_assistant_text(provider.get("api_style", "openai"), payload),
        "usage": extract_usage(payload),
    }

async def stream_chat(req: ChatRequest) -> AsyncIterator[Dict[str, Any]]:
    provider = await _resolve_provider(req.provider_id)
    api_key = await _ensure_key(req.provider_id)
    base_url = await get_config_store().get_base_url_override(req.provider_id)
    style = provider.get("api_style", "openai")
    emitted_text: List[str] = []
    try:
        async for chunk in stream_chat_completion(
            provider=provider,
            api_key=api_key,
            model=req.model_id,
            messages=req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            top_p=req.top_p,
            base_url_override=base_url,
            timeout_seconds=settings.upstream_timeout_seconds,
        ):
            # Normalise the chunk into a shape the frontend can consume.
            if chunk.get("done"):
                yield {"type": "done", "text": "".join(emitted_text)}
                return
            j = chunk.get("json") or {}
            if style == "anthropic":
                # Anthropic streaming events
                evt = chunk.get("event")
                if evt in ("content_block_start", "content_block_delta"):
                    delta = j.get("delta") or {}
                    text = delta.get("text") or ""
                    if text:
                        emitted_text.append(text)
                        yield {"type": "delta", "delta": text}
                elif evt == "message_start":
                    yield {"type": "start", "model": j.get("message", {}).get("model")}
                elif evt == "message_delta":
                    usage = j.get("usage") or {}
                    yield {"type": "usage", "usage": usage}
                elif evt == "message_stop":
                    yield {"type": "stop"}
            else:
                # OpenAI-style chunk
                choices = j.get("choices") or []
                if choices:
                    delta = choices[0].get("delta") or {}
                    text = delta.get("content") or ""
                    if text:
                        emitted_text.append(text)
                        yield {"type": "delta", "delta": text}
                    fr = choices[0].get("finish_reason")
                    if fr:
                        yield {"type": "finish", "finish_reason": fr}
                if j.get("usage"):
                    yield {"type": "usage", "usage": j["usage"]}
    except UpstreamError as exc:
        yield {"type": "error", "status": exc.status, "message": str(exc)}
        return
    yield {"type": "done", "text": "".join(emitted_text)}

async def chat_for_conversation(
    session,
    conv,
    user_text: str,
    *,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    top_p: Optional[float] = None,
) -> Dict[str, Any]:
    """Non-streaming chat attached to a conversation: appends both sides and returns the assistant message."""
    # Persist user message
    from app.schemas.chat import MessageCreate
    await conversation_service.add_message(
        session, conv, MessageCreate(role="user", content=user_text)
    )
    messages_db = await conversation_service.list_messages(session, conv)
    provider_messages, _ = conversation_service.history_to_provider_messages(
        messages_db, conv.system_prompt, max_messages=settings.max_conversation_messages
    )
    req = ChatRequest(
        provider_id=conv.provider_id,
        model_id=conv.model_id,
        messages=provider_messages,
        temperature=temperature if temperature is not None else conv.temperature,
        max_tokens=max_tokens if max_tokens is not None else conv.max_tokens,
        top_p=top_p if top_p is not None else conv.top_p,
        stream=False,
    )
    result = await chat_once(req)
    text = result["text"]
    usage = result["usage"]
    saved = await conversation_service.save_assistant_message(
        session, conv,
        content=text,
        provider_id=conv.provider_id,
        model_id=conv.model_id,
        prompt_tokens=usage.get("prompt_tokens"),
        completion_tokens=usage.get("completion_tokens"),
        total_tokens=usage.get("total_tokens"),
    )
    return {
        "user_message": user_text,
        "assistant_message_id": saved.id,
        "text": text,
        "usage": usage,
    }
