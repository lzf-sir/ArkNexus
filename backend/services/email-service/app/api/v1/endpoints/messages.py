"""Message + attachment endpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_optional, db_session
from app.models.user import User
from app.schemas.message import (
    BulkActionRequest,
    BulkActionResponse,
    MessageRead,
    MessageUpdate,
)
from app.services import draft_service, mailbox_service, message_service

router = APIRouter(tags=["messages"])


async def _resolve_owner(user: Optional[User]) -> Optional[str]:
    return user.id if user is not None else None


@router.get(
    "/messages/{message_id}",
    response_model=MessageRead,
    summary="Get a single message with body and attachments.",
)
async def get_message_endpoint(
    message_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> MessageRead:
    msg = await message_service.get_message(session, message_id)
    owner_id = await _resolve_owner(user)
    try:
        await mailbox_service.get_mailbox_for(
            session, msg.mailbox_id, user_id=owner_id
        )
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Message not found") from exc

    if not msg.is_read:
        msg.is_read = True
        await session.commit()
        await session.refresh(msg)
    return await message_service.message_to_read(session, msg)


@router.patch(
    "/messages/{message_id}",
    response_model=MessageRead,
    summary="Update message flags (read/starred).",
)
async def update_message_endpoint(
    message_id: str,
    payload: MessageUpdate,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> MessageRead:
    msg = await message_service.get_message(session, message_id)
    owner_id = await _resolve_owner(user)
    try:
        await mailbox_service.get_mailbox_for(
            session, msg.mailbox_id, user_id=owner_id
        )
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Message not found") from exc
    msg = await message_service.update_message(session, message_id, payload)
    return await message_service.message_to_read(session, msg)


@router.delete(
    "/messages/{message_id}",
    status_code=204,
    response_class=Response,
    response_model=None,
    summary="Delete a message (and its attachment files).",
)
async def delete_message_endpoint(
    message_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> None:
    msg = await message_service.get_message(session, message_id)
    owner_id = await _resolve_owner(user)
    try:
        await mailbox_service.get_mailbox_for(
            session, msg.mailbox_id, user_id=owner_id
        )
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Message not found") from exc
    await message_service.delete_message(session, message_id)


@router.get(
    "/mailboxes/{mailbox_id}/messages/search",
    summary="Full-text search within a mailbox (PostgreSQL tsvector + SQLite LIKE).",
)
async def search_messages_endpoint(
    mailbox_id: str,
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    only_unread: bool = Query(default=False),
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> list:
    owner_id = await _resolve_owner(user)
    try:
        await mailbox_service.get_mailbox_for(session, mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Mailbox not found") from exc
    from app.services import search_service
    rows = await search_service.search_messages(
        session,
        mailbox_id,
        query=q,
        limit=limit,
        only_unread=only_unread,
    )
    return rows


@router.post(
    "/mailboxes/{mailbox_id}/messages/bulk",
    response_model=BulkActionResponse,
    summary="Apply an action to many messages at once.",
)
async def bulk_messages_endpoint(
    mailbox_id: str,
    payload: BulkActionRequest,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> BulkActionResponse:
    owner_id = await _resolve_owner(user)
    try:
        await mailbox_service.get_mailbox_for(session, mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Mailbox not found") from exc
    affected = await message_service.bulk_action(
        session, mailbox_id, payload.message_ids, payload.action
    )
    return BulkActionResponse(affected=affected, action=payload.action)


# ===== Drafts =====

@router.get(
    "/mailboxes/{mailbox_id}/drafts",
    summary="List drafts in a mailbox.",
)
async def list_drafts_endpoint(
    mailbox_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
):
    owner_id = await _resolve_owner(user)
    try:
        await mailbox_service.get_mailbox_for(session, mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Mailbox not found") from exc
    drafts = await draft_service.list_drafts(session, mailbox_id)
    return [draft_service.draft_to_read(d).model_dump(mode="json") for d in drafts]


@router.post(
    "/mailboxes/{mailbox_id}/drafts",
    status_code=201,
    summary="Create a draft.",
)
async def create_draft_endpoint(
    mailbox_id: str,
    payload: dict,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
):
    from app.schemas.message import DraftCreate
    owner_id = await _resolve_owner(user)
    try:
        mailbox = await mailbox_service.get_mailbox_for(session, mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Mailbox not found") from exc
    dc = DraftCreate(**payload)
    d = await draft_service.create_draft(session, mailbox, dc)
    return draft_service.draft_to_read(d).model_dump(mode="json")


@router.patch(
    "/drafts/{draft_id}",
    summary="Update a draft.",
)
async def update_draft_endpoint(
    draft_id: str,
    payload: dict,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
):
    from app.schemas.message import DraftUpdate
    owner_id = await _resolve_owner(user)
    try:
        d = await draft_service.get_draft(session, draft_id)
    except draft_service.DraftNotFound as exc:
        raise HTTPException(status_code=404, detail="Draft not found") from exc
    try:
        await mailbox_service.get_mailbox_for(session, d.mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Draft not found") from exc
    du = DraftUpdate(**payload)
    d2 = await draft_service.update_draft(session, draft_id, du)
    return draft_service.draft_to_read(d2).model_dump(mode="json")


@router.delete(
    "/drafts/{draft_id}",
    status_code=204,
    response_class=Response,
    response_model=None,
    summary="Delete a draft.",
)
async def delete_draft_endpoint(
    draft_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> None:
    owner_id = await _resolve_owner(user)
    try:
        d = await draft_service.get_draft(session, draft_id)
    except draft_service.DraftNotFound as exc:
        raise HTTPException(status_code=404, detail="Draft not found") from exc
    try:
        await mailbox_service.get_mailbox_for(session, d.mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Draft not found") from exc
    await draft_service.delete_draft(session, draft_id)


@router.get(
    "/messages/{message_id}/attachments/{attachment_id}",
    summary="Download an attachment.",
    response_class=FileResponse,
)
async def download_attachment_endpoint(
    message_id: str,
    attachment_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
):
    msg = await message_service.get_message(session, message_id)
    owner_id = await _resolve_owner(user)
    try:
        await mailbox_service.get_mailbox_for(
            session, msg.mailbox_id, user_id=owner_id
        )
    except mailbox_service.MailboxNotFound:
        raise HTTPException(status_code=404, detail="Attachment not found")

    try:
        att = await message_service.get_attachment(session, attachment_id)
    except message_service.AttachmentNotFound as exc:
        raise HTTPException(status_code=404, detail="Attachment not found") from exc
    if att.message_id != message_id:
        raise HTTPException(status_code=404, detail="Attachment not found")

    path = Path(att.storage_path)
    if not path.exists():
        raise HTTPException(status_code=410, detail="Attachment file is gone")

    return FileResponse(
        path=str(path),
        media_type=att.content_type or "application/octet-stream",
        filename=att.filename,
    )