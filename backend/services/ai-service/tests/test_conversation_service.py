"""Tests for the conversation service (create / list / update / delete / messages)."""

from __future__ import annotations

import pytest

from app.schemas.chat import ConversationCreate, ConversationUpdate, MessageCreate
from app.services import conversation_service

pytestmark = pytest.mark.asyncio


async def test_create_conversation_defaults_title(db_session):
    conv = await conversation_service.create_conversation(
        db_session,
        "user-1",
        ConversationCreate(provider_id="openai", model_id="gpt-4o-mini"),
    )
    assert conv.id
    assert conv.title == "新对话"
    assert conv.provider_id == "openai"
    assert conv.model_id == "gpt-4o-mini"
    assert conv.is_pinned is False
    assert conv.is_archived is False


async def test_create_conversation_uses_first_message_as_title(db_session):
    conv = await conversation_service.create_conversation(
        db_session,
        "user-1",
        ConversationCreate(
            provider_id="openai",
            model_id="gpt-4o-mini",
            first_message="Hello world\nsecond line",
        ),
    )
    assert conv.title == "Hello world"


async def test_create_conversation_persists_first_message(db_session):
    conv = await conversation_service.create_conversation(
        db_session,
        "user-1",
        ConversationCreate(
            provider_id="openai",
            model_id="gpt-4o-mini",
            first_message="hi",
        ),
    )
    msgs = await conversation_service.list_messages(db_session, conv)
    assert len(msgs) == 1
    assert msgs[0].role == "user"
    assert msgs[0].content == "hi"


async def test_list_filters_archived_by_default(db_session):
    a = await conversation_service.create_conversation(
        db_session, "u-1", ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", title="A")
    )
    b = await conversation_service.create_conversation(
        db_session, "u-1", ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", title="B")
    )
    await conversation_service.update_conversation(db_session, b, is_archived=True)

    visible = await conversation_service.list_conversations(db_session, "u-1")
    assert {c.id for c in visible} == {a.id}

    all_incl_archived = await conversation_service.list_conversations(
        db_session, "u-1", include_archived=True
    )
    assert {c.id for c in all_incl_archived} == {a.id, b.id}


async def test_list_orders_pinned_first_then_updated_desc(db_session):
    c1 = await conversation_service.create_conversation(
        db_session, "u-1", ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", title="C1")
    )
    c2 = await conversation_service.create_conversation(
        db_session, "u-1", ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", title="C2")
    )
    c3 = await conversation_service.create_conversation(
        db_session, "u-1", ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", title="C3")
    )
    await conversation_service.update_conversation(db_session, c3, is_pinned=True)

    rows = await conversation_service.list_conversations(db_session, "u-1")
    # Pinned first, then by updated_at desc.
    assert rows[0].id == c3.id
    assert rows[1].id in {c1.id, c2.id}


async def test_update_conversation_partial_fields(db_session):
    conv = await conversation_service.create_conversation(
        db_session, "u-1", ConversationCreate(provider_id="openai", model_id="gpt-4o-mini")
    )
    conv = await conversation_service.update_conversation(
        db_session, conv, title="renamed", temperature=0.5, is_pinned=True
    )
    assert conv.title == "renamed"
    assert conv.temperature == 0.5
    assert conv.is_pinned is True
    # Untouched fields remain.
    assert conv.model_id == "gpt-4o-mini"


async def test_delete_conversation_cascades_messages(db_session):
    conv = await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", first_message="hi"),
    )
    await conversation_service.save_assistant_message(
        db_session, conv, content="hello back", provider_id="openai", model_id="gpt-4o-mini"
    )
    assert len(await conversation_service.list_messages(db_session, conv)) == 2

    await conversation_service.delete_conversation(db_session, conv)
    fetched = await conversation_service.get_conversation(db_session, "u-1", conv.id)
    assert fetched is None


async def test_get_conversation_returns_none_for_other_user(db_session):
    conv = await conversation_service.create_conversation(
        db_session, "owner", ConversationCreate(provider_id="openai", model_id="gpt-4o-mini")
    )
    assert await conversation_service.get_conversation(db_session, "intruder", conv.id) is None
    assert await conversation_service.get_conversation(db_session, "owner", conv.id) is not None


async def test_history_to_provider_messages_skips_duplicated_system_prompt(db_session):
    conv = await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", system_prompt="You are helpful."),
    )
    await conversation_service.add_message(
        db_session, conv, MessageCreate(role="system", content="You are helpful.")
    )
    await conversation_service.add_message(
        db_session, conv, MessageCreate(role="user", content="hi")
    )
    await conversation_service.add_message(
        db_session, conv, MessageCreate(role="assistant", content="hello")
    )
    msgs = await conversation_service.list_messages(db_session, conv)
    out, _ = conversation_service.history_to_provider_messages(msgs, conv.system_prompt)
    # One system (from system_prompt), user, assistant.
    assert [m["role"] for m in out] == ["system", "user", "assistant"]
    assert out[0]["content"] == "You are helpful."


# ===== Search + export =====


async def test_search_returns_hits_with_snippet_highlight(db_session):
    conv = await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(
            provider_id="openai",
            model_id="gpt-4o-mini",
            title="DB question",
            first_message="How do indexes work in PostgreSQL?",
        ),
    )
    await conversation_service.save_assistant_message(
        db_session, conv,
        content="PostgreSQL B-tree indexes are stored in order...",
        provider_id="openai",
        model_id="gpt-4o-mini",
    )

    hits = await conversation_service.search_user_conversations(
        db_session, "u-1", query="postgres"
    )
    assert len(hits) >= 1
    # Title match OR content match produces a hit.
    assert any("postgres" in h.snippet.lower() or "postgres" in h.conversation_title.lower() for h in hits)


async def test_search_excludes_other_users(db_session):
    await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", first_message="alpha topic"),
    )
    await conversation_service.create_conversation(
        db_session, "u-2",
        ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", first_message="alpha topic too"),
    )

    hits = await conversation_service.search_user_conversations(db_session, "u-1", query="alpha")
    assert all(h.conversation_id for h in hits)
    # Verify we only see u-1's conversations.
    from sqlalchemy import select
    from app.models.conversation import Conversation
    stmt = select(Conversation).where(Conversation.user_id == "u-1")
    own_ids = {str(c.id) for c in (await db_session.execute(stmt)).scalars().all()}
    for h in hits:
        assert h.conversation_id in own_ids


async def test_search_empty_query_returns_nothing(db_session):
    await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", first_message="hi"),
    )
    assert await conversation_service.search_user_conversations(db_session, "u-1", query="") == []
    assert await conversation_service.search_user_conversations(db_session, "u-1", query="   ") == []


async def test_search_excludes_archived_by_default(db_session):
    a = await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", title="Active thingy"),
    )
    b = await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(provider_id="openai", model_id="gpt-4o-mini", title="Archived thingy"),
    )
    await conversation_service.update_conversation(db_session, b, is_archived=True)

    hits = await conversation_service.search_user_conversations(db_session, "u-1", query="thingy")
    assert {h.conversation_id for h in hits} == {a.id}

    hits_all = await conversation_service.search_user_conversations(
        db_session, "u-1", query="thingy", include_archived=True
    )
    assert {h.conversation_id for h in hits_all} == {a.id, b.id}


def test_make_snippet_marks_match_with_brackets():
    snippet = conversation_service._make_snippet(
        "PostgreSQL is a relational database. PostgreSQL rocks.", "postgres"
    )
    assert ">>" in snippet and "<<" in snippet
    # Highlight wraps the exact query span ("postgres", 8 chars) at the match.
    assert ">>PostgreS<<" in snippet


def test_make_snippet_no_truncation_when_short():
    snippet = conversation_service._make_snippet("hi", "postgres")
    assert "…" not in snippet
    assert snippet == "hi"


def test_make_snippet_handles_no_match():
    snippet = conversation_service._make_snippet("Hello world", "absent")
    assert "Hello world" in snippet
    assert ">>" not in snippet


async def test_export_to_markdown_includes_metadata_and_messages(db_session):
    conv = await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(
            provider_id="openai",
            model_id="gpt-4o-mini",
            title="My chat",
            system_prompt="Be brief.",
            first_message="hi",
        ),
    )
    await conversation_service.save_assistant_message(
        db_session, conv,
        content="hello there",
        provider_id="openai",
        model_id="gpt-4o-mini",
        prompt_tokens=3,
        completion_tokens=2,
        total_tokens=5,
        finish_reason="stop",
    )
    # Reload so the conversation's `selectin` messages cache is fresh.
    fresh = await conversation_service.get_conversation(db_session, "u-1", conv.id)
    md = conversation_service.export_to_markdown(fresh)
    assert "# My chat" in md
    assert "Provider: `openai`" in md
    assert "Model: `gpt-4o-mini`" in md
    assert "## System prompt" in md
    assert "Be brief." in md
    assert "### User" in md
    assert "hi" in md
    assert "### Assistant" in md
    assert "hello there" in md
    assert "tokens: prompt=3, completion=2, total=5" in md


async def test_export_to_json_is_valid_json_with_messages(db_session):
    conv = await conversation_service.create_conversation(
        db_session, "u-1",
        ConversationCreate(
            provider_id="openai", model_id="gpt-4o-mini", first_message="ping"
        ),
    )
    fresh = await conversation_service.get_conversation(db_session, "u-1", conv.id)
    text = conversation_service.export_to_json(fresh)
    import json as _json
    parsed = _json.loads(text)
    assert parsed["provider_id"] == "openai"
    assert len(parsed["messages"]) == 1
    assert parsed["messages"][0]["content"] == "ping"
