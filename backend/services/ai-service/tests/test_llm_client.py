"""Tests for the provider-agnostic LLM client (URL resolution + payload shape)."""

from app.services.llm_client import (
    _build_anthropic_payload,
    _build_openai_payload,
    _resolve_url,
)


# ---------- URL resolution ----------


def test_resolve_openai_url_with_default_base():
    p = {"id": "openai", "api_style": "openai", "base_url": "https://api.openai.com/v1"}
    assert _resolve_url(p, None) == "https://api.openai.com/v1/chat/completions"


def test_resolve_openai_url_with_override():
    p = {"id": "openai", "api_style": "openai", "base_url": "https://api.openai.com/v1"}
    assert (
        _resolve_url(p, "https://proxy.example.com/v1")
        == "https://proxy.example.com/v1/chat/completions"
    )


def test_resolve_anthropic_url():
    p = {"id": "anthropic", "api_style": "anthropic", "base_url": "https://api.anthropic.com"}
    assert _resolve_url(p, None) == "https://api.anthropic.com/v1/messages"


def test_resolve_anthropic_url_already_has_v1():
    p = {"id": "anthropic", "api_style": "anthropic", "base_url": "https://api.anthropic.com/v1"}
    assert _resolve_url(p, None) == "https://api.anthropic.com/v1/messages"


def test_resolve_url_strips_trailing_slash():
    p = {"id": "openai", "api_style": "openai", "base_url": "https://api.openai.com/v1/"}
    assert _resolve_url(p, None) == "https://api.openai.com/v1/chat/completions"


# ---------- OpenAI payload ----------


def test_openai_payload_minimal():
    payload = _build_openai_payload(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "hi"}],
        temperature=None,
        max_tokens=None,
        top_p=None,
        stream=False,
    )
    assert payload["model"] == "gpt-4o-mini"
    assert payload["messages"] == [{"role": "user", "content": "hi"}]
    assert payload["stream"] is False
    # None fields should be omitted, not sent as null.
    assert "temperature" not in payload
    assert "max_tokens" not in payload
    assert "top_p" not in payload


def test_openai_payload_with_all_params():
    payload = _build_openai_payload(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "hi"}],
        temperature=0.3,
        max_tokens=512,
        top_p=0.95,
        stream=True,
    )
    assert payload["temperature"] == 0.3
    assert payload["max_tokens"] == 512
    assert payload["top_p"] == 0.95
    assert payload["stream"] is True


# ---------- Anthropic payload ----------


def test_anthropic_payload_extracts_system_message():
    payload = _build_anthropic_payload(
        model="claude-3-5-sonnet-latest",
        messages=[
            {"role": "system", "content": "You are concise."},
            {"role": "user", "content": "hi"},
        ],
        temperature=0.2,
        max_tokens=256,
        system=None,
        top_p=None,
        stream=False,
    )
    assert payload["system"] == "You are concise."
    # System message must be removed from the messages array.
    assert all(m["role"] != "system" for m in payload["messages"])
    assert payload["messages"] == [{"role": "user", "content": "hi"}]
    # max_tokens is required by Anthropic; we default to 4096 if absent.
    assert payload["max_tokens"] == 256


def test_anthropic_payload_defaults_max_tokens_when_missing():
    payload = _build_anthropic_payload(
        model="claude-3-5-sonnet-latest",
        messages=[{"role": "user", "content": "hi"}],
        temperature=None,
        max_tokens=None,
        system=None,
        top_p=None,
        stream=False,
    )
    assert payload["max_tokens"] == 4096
