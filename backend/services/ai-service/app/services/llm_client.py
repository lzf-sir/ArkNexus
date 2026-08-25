"""Provider-agnostic LLM client.

Builds the right HTTP request for the chosen provider (mostly
OpenAI-compatible). Supports both streaming (SSE) and non-streaming
chat completions. The Anthropic `messages` API is handled separately
because its payload shape differs significantly.
"""
from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class UpstreamError(RuntimeError):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def _build_openai_payload(
    *,
    model: str,
    messages: List[Dict[str, Any]],
    temperature: Optional[float],
    max_tokens: Optional[int],
    top_p: Optional[float] = None,
    stream: bool,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"model": model, "messages": messages, "stream": stream}
    if temperature is not None:
        payload["temperature"] = float(temperature)
    if max_tokens is not None:
        payload["max_tokens"] = int(max_tokens)
    if top_p is not None:
        payload["top_p"] = float(top_p)
    return payload


def _build_anthropic_payload(
    *,
    model: str,
    messages: List[Dict[str, Any]],
    temperature: Optional[float],
    max_tokens: Optional[int],
    system: Optional[str],
    top_p: Optional[float] = None,
    stream: bool,
) -> Dict[str, Any]:
    """Anthropic /v1/messages payload shape.

    Anthropic splits system prompt out of the messages array and uses
    `max_tokens` as a required field. We extract any system message we find.
    """
    out_messages: List[Dict[str, Any]] = []
    sys_text: Optional[str] = system
    for m in messages:
        if m.get("role") == "system":
            sys_text = m.get("content", "")
            continue
        out_messages.append({"role": m["role"], "content": m.get("content", "")})
    payload: Dict[str, Any] = {
        "model": model,
        "messages": out_messages,
        "max_tokens": int(max_tokens) if max_tokens is not None else 4096,
        "stream": stream,
    }
    if sys_text:
        payload["system"] = sys_text
    if temperature is not None:
        payload["temperature"] = float(temperature)
    if top_p is not None:
        payload["top_p"] = float(top_p)
    return payload


def _auth_headers(provider: Dict[str, Any], api_key: str) -> Dict[str, str]:
    header = provider.get("auth_header", "Authorization")
    prefix = provider.get("auth_prefix", "Bearer ")
    return {header: f"{prefix}{api_key}"}


def _resolve_url(provider: Dict[str, Any], base_url_override: Optional[str]) -> str:
    base = (base_url_override or provider.get("base_url", "")).rstrip("/")
    if not base:
        raise UpstreamError(400, f"Provider {provider['id']} has no base_url configured")
    style = provider.get("api_style", "openai")
    if style == "anthropic":
        path = "/v1/messages" if "/v1/messages" not in base else ""
        # Anthropic base is e.g. https://api.anthropic.com; endpoint is /v1/messages
        if base.endswith("/v1"):
            return f"{base}/messages"
        return f"{base}/v1/messages"
    # OpenAI compatible: <base>/chat/completions
    return f"{base}/chat/completions"


async def chat_completion(
    *,
    provider: Dict[str, Any],
    api_key: str,
    model: str,
    messages: List[Dict[str, Any]],
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    top_p: Optional[float] = None,
    base_url_override: Optional[str] = None,
    timeout_seconds: int = 120,
) -> Dict[str, Any]:
    """Non-streaming chat completion. Returns the parsed JSON body."""
    style = provider.get("api_style", "openai")
    url = _resolve_url(provider, base_url_override)
    headers = _auth_headers(provider, api_key)
    if not headers.get("Content-Type"):
        headers["Content-Type"] = "application/json"
    if style == "anthropic":
        payload = _build_anthropic_payload(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            system=None,
            top_p=top_p,
            stream=False,
        )
        headers["anthropic-version"] = "2023-06-01"
    else:
        payload = _build_openai_payload(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            stream=False,
        )

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        r = await client.post(url, headers=headers, json=payload)
    if r.status_code >= 400:
        raise UpstreamError(r.status_code, _safe_error_message(r))
    return r.json()


async def stream_chat_completion(
    *,
    provider: Dict[str, Any],
    api_key: str,
    model: str,
    messages: List[Dict[str, Any]],
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    top_p: Optional[float] = None,
    base_url_override: Optional[str] = None,
    timeout_seconds: int = 120,
) -> AsyncIterator[Dict[str, Any]]:
    """Streaming chat completion. Yields decoded SSE/data JSON chunks.

    For OpenAI-compatible providers we receive `data: {...}` lines and yield
    each parsed JSON object. For Anthropic we receive multiple `event:` lines.
    This helper normalises both to a dict with at least `delta` and `done` keys.
    """
    style = provider.get("api_style", "openai")
    url = _resolve_url(provider, base_url_override)
    headers = _auth_headers(provider, api_key)
    if not headers.get("Content-Type"):
        headers["Content-Type"] = "application/json"
    headers["Accept"] = "text/event-stream"
    if style == "anthropic":
        payload = _build_anthropic_payload(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            system=None,
            top_p=top_p,
            stream=True,
        )
        headers["anthropic-version"] = "2023-06-01"
    else:
        payload = _build_openai_payload(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            stream=True,
        )

    timeout = httpx.Timeout(timeout_seconds, read=timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as r:
            if r.status_code >= 400:
                # Drain the body for an error message.
                body = await r.aread()
                raise UpstreamError(r.status_code, body.decode("utf-8", errors="ignore"))
            # Read SSE event stream, line by line.
            buffer_text = ""
            async for raw_line in r.aiter_lines():
                if not raw_line:
                    continue
                if style == "openai":
                    if raw_line.startswith("data:"):
                        data = raw_line[5:].strip()
                        if data == "[DONE]":
                            yield {"done": True}
                            return
                        try:
                            yield {"json": json.loads(data), "done": False}
                        except json.JSONDecodeError:
                            continue
                elif style == "anthropic":
                    # Anthropic lines: event: <type>\ndata: <json>
                    if raw_line.startswith("event:"):
                        buffer_text = raw_line.split(":", 1)[1].strip()
                        continue
                    if raw_line.startswith("data:") and buffer_text:
                        data = raw_line[5:].strip()
                        try:
                            payload = json.loads(data)
                            yield {"event": buffer_text, "json": payload, "done": buffer_text == "message_stop"}
                            buffer_text = ""
                            if buffer_text == "":
                                pass
                        except json.JSONDecodeError:
                            continue
            yield {"done": True}


def extract_assistant_text(provider_style: str, response_json: Dict[str, Any]) -> str:
    """Pull the assistant text from a non-streaming response payload."""
    style = provider_style
    if style == "anthropic":
        parts = response_json.get("content") or []
        return "".join(p.get("text", "") for p in parts if p.get("type") == "text")
    choices = response_json.get("choices") or []
    if not choices:
        return ""
    return choices[0].get("message", {}).get("content", "") or ""


def extract_usage(response_json: Dict[str, Any]) -> Dict[str, Optional[int]]:
    """Best-effort token accounting."""
    u = response_json.get("usage") or {}
    return {
        "prompt_tokens": u.get("prompt_tokens"),
        "completion_tokens": u.get("completion_tokens"),
        "total_tokens": u.get("total_tokens"),
    }


def _safe_error_message(r: httpx.Response) -> str:
    try:
        j = r.json()
        if isinstance(j, dict):
            return str(j.get("error", {}).get("message") or j)
        return str(j)
    except Exception:  # noqa: BLE001
        return r.text[:1000]
