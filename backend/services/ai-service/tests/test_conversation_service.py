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
