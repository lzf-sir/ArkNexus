"""Conversation CRUD endpoints."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserDep, CurrentUser, db_session
from app.schemas.chat import (
    ConversationCreate,
    ConversationRead,
    ConversationUpdate,
    ConversationSummary,
    MessageRead,
)
from app.services import conversation_service

router = APIRouter(tags=["ai-conversations"])


@router.get("/ai/conversations", response_model=List[ConversationSummary], summary="List the user conversations.")
async def list_endpoint(
    include_archived: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    user: CurrentUser = CurrentUserDep,
    session: AsyncSession = Depends(db_session),
) -> List[ConversationSummary]:
    return await conversation_service.list_conversations(
        session, user.id, include_archived=include_archived, limit=limit
    )


@router.post("/ai/conversations", response_model=ConversationRead, status_code=status.HTTP_201_CREATED, summary="Create a conversation.")
async def create_endpoint(
    payload: ConversationCreate,
    user: CurrentUser = CurrentUserDep,
    session: AsyncSession = Depends(db_session),
) -> ConversationRead:
    conv = await conversation_service.create_conversation(session, user.id, payload)
    return ConversationRead.model_validate(conv)


async def _load(session: AsyncSession, user_id: str, conv_id: str):
    conv = await conversation_service.get_conversation(session, user_id, conv_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.get("/ai/conversations/{conversation_id}", response_model=ConversationRead, summary="Get a single conversation with messages.")
async def get_endpoint(
    conversation_id: str,
    user: CurrentUser = CurrentUserDep,
    session: AsyncSession = Depends(db_session),
) -> ConversationRead:
    conv = await _load(session, user.id, conversation_id)
    return ConversationRead.model_validate(conv)


@router.patch("/ai/conversations/{conversation_id}", response_model=ConversationRead, summary="Update metadata / settings.")
async def update_endpoint(
    conversation_id: str,
    payload: ConversationUpdate,
    user: CurrentUser = CurrentUserDep,
    session: AsyncSession = Depends(db_session),
) -> ConversationRead:
    conv = await _load(session, user.id, conversation_id)
    conv = await conversation_service.update_conversation(
        session, conv,
        title=payload.title,
        system_prompt=payload.system_prompt,
        is_pinned=payload.is_pinned,
        is_archived=payload.is_archived,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
    )
    return ConversationRead.model_validate(conv)


@router.delete("/ai/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a conversation.")
async def delete_endpoint(
    conversation_id: str,
    user: CurrentUser = CurrentUserDep,
    session: AsyncSession = Depends(db_session),
) -> None:
    conv = await _load(session, user.id, conversation_id)
    await conversation_service.delete_conversation(session, conv)


@router.get("/ai/conversations/{conversation_id}/messages", response_model=List[MessageRead], summary="All messages for a conversation, oldest first.")
async def messages_endpoint(
    conversation_id: str,
    user: CurrentUser = CurrentUserDep,
    session: AsyncSession = Depends(db_session),
) -> List[MessageRead]:
    conv = await _load(session, user.id, conversation_id)
    msgs = await conversation_service.list_messages(session, conv)
    return [MessageRead.model_validate(m) for m in msgs]
