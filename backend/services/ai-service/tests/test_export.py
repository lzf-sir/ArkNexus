"""Tests for the AI conversation export service."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import ChatMessage, Conversation
from app.services.export import build_export

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


def _make_conversation(**overrides) -> Conversation:
    defaults = {
        "id": "conv-1",
        "user_id": TEST_USER_ID,
        "title": "Test conversation",
        "provider_id": "openai",
        "model_id": "gpt-4o-mini",
        "system_prompt": "You are helpful.",
        "temperature": 0.7,
        "max_tokens": 1024,
        "top_p": 1.0,
        "is_pinned": False,
        "is_archived": False,
    }
    defaults.update(overrides)
    return Conversation(**defaults)


@pytest.mark.asyncio
async def test_export_zip_has_manifest_and_readme(db_session: AsyncSession):
    blob, counts = await build_export(db_session, TEST_USER_ID)
    assert blob
    zf = zipfile.ZipFile(io.BytesIO(blob))
    names = zf.namelist()
    assert "manifest.json" in names
    assert "README.md" in names
    assert counts.conversations == 0
    manifest = json.loads(zf.read("manifest.json").decode())
    assert manifest["version"] == 1


@pytest.mark.asyncio
async def test_export_includes_conversations_and_messages(db_session: AsyncSession):
    conv = _make_conversation()
    db_session.add(conv)
    await db_session.flush()

    m1 = ChatMessage(
        id="m1",
        conversation_id=conv.id,
        role="user",
        content="hello",
        prompt_tokens=2,
    )
    m2 = ChatMessage(
        id="m2",
        conversation_id=conv.id,
        role="assistant",
        content="hi there",
        completion_tokens=2,
        total_tokens=4,
        finish_reason="stop",
    )
    db_session.add_all([m1, m2])
    await db_session.flush()

    blob, counts = await build_export(db_session, TEST_USER_ID)
    assert counts.conversations == 1
    assert counts.messages == 2

    zf = zipfile.ZipFile(io.BytesIO(blob))
    assert "conversations/index.json" in zf.namelist()
    assert "conversations/conv-1.json" in zf.namelist()
    assert "conversations/conv-1.md" in zf.namelist()

    payload = json.loads(zf.read("conversations/conv-1.json").decode())
    assert payload["provider_id"] == "openai"
    assert len(payload["messages"]) == 2
    assert payload["messages"][0]["role"] == "user"

    md = zf.read("conversations/conv-1.md").decode()
    assert "# Test conversation" in md
    assert "openai" in md


@pytest.mark.asyncio
async def test_export_only_includes_current_user_conversations(db_session: AsyncSession):
    mine = _make_conversation(id="mine", user_id=TEST_USER_ID)
    other = _make_conversation(id="other", user_id="other-user")
    db_session.add_all([mine, other])
    await db_session.flush()

    blob, counts = await build_export(db_session, TEST_USER_ID)
    assert counts.conversations == 1
    zf = zipfile.ZipFile(io.BytesIO(blob))
    assert "conversations/mine.json" in zf.namelist()
    assert "conversations/other.json" not in zf.namelist()