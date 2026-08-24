"""Mailbox API endpoints."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_optional, db_session
from app.models.user import User
from app.schemas.mailbox import (
    MailboxCreate,
    MailboxRead,
    MailboxUpdate,
)
from app.schemas.message import MessageRead, MessageSummary
from app.services import mailbox_service, message_service

router = APIRouter(prefix="/mailboxes", tags=["mailboxes"])


async def _resolve_owner(user: Optional[User]) -> Optional[str]:
    return user.id if user is not None else None


@router.post(
    "",
    response_model=MailboxRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new temporary mailbox (optionally owned by the caller).",
)
async def create_mailbox_endpoint(
    payload: MailboxCreate,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> MailboxRead:
    owner_id = await _resolve_owner(user)
    try:
        mailbox = await mailbox_service.create_mailbox(
            session, payload, owner_id=owner_id
        )
    except mailbox_service.MailboxAddressTaken as exc:
        raise HTTPException(status_code=409, detail=f"Address already exists: {exc.args[0]}") from exc
    return mailbox_service.mailbox_to_read(mailbox, unread_count=0)


@router.get(
    "",
    response_model=List[MailboxRead],
    summary="List mailboxes owned by the caller (or all anonymous mailboxes).",
)
async def list_mailboxes_endpoint(
    include_expired: bool = Query(default=False),
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> List[MailboxRead]:
    owner_id = await _resolve_owner(user)
    mailboxes = await mailbox_service.list_mailboxes(
        session, include_expired=include_expired, user_id=owner_id
    )
    items: list[MailboxRead] = []
    for mb in mailboxes:
        unread = await message_service.unread_count_for_mailbox(session, mb.id)
        items.append(mailbox_service.mailbox_to_read(mb, unread_count=unread))
    return items


@router.get(
    "/{mailbox_id}",
    response_model=MailboxRead,
    summary="Get mailbox by id (owned by caller or anonymous).",
)
async def get_mailbox_endpoint(
    mailbox_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> MailboxRead:
    owner_id = await _resolve_owner(user)
    try:
        mailbox = await mailbox_service.get_mailbox_for(session, mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Mailbox not found") from exc
    unread = await message_service.unread_count_for_mailbox(session, mailbox_id)
    return mailbox_service.mailbox_to_read(mailbox, unread_count=unread)


@router.patch(
    "/{mailbox_id}",
    response_model=MailboxRead,
    summary="Update mailbox (display name / extend expiry).",
)
async def update_mailbox_endpoint(
    mailbox_id: str,
    payload: MailboxUpdate,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> MailboxRead:
    owner_id = await _resolve_owner(user)
    try:
        mailbox = await mailbox_service.get_mailbox_for(session, mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Mailbox not found") from exc
    mailbox = await mailbox_service.update_mailbox(session, mailbox.id, payload)
    unread = await message_service.unread_count_for_mailbox(session, mailbox_id)
    return mailbox_service.mailbox_to_read(mailbox, unread_count=unread)


@router.delete(
    "/{mailbox_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
    summary="Delete a mailbox (and its messages/attachments).",
)
async def delete_mailbox_endpoint(
    mailbox_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> None:
    owner_id = await _resolve_owner(user)
    try:
        mailbox = await mailbox_service.get_mailbox_for(session, mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Mailbox not found") from exc
    await mailbox_service.delete_mailbox(session, mailbox.id)


@router.get(
    "/{mailbox_id}/messages",
    response_model=List[MessageSummary],
    summary="List messages in a mailbox.",
)
async def list_messages_endpoint(
    mailbox_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    only_unread: bool = Query(default=False),
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> List[MessageSummary]:
    owner_id = await _resolve_owner(user)
    try:
        await mailbox_service.get_mailbox_for(session, mailbox_id, user_id=owner_id)
    except mailbox_service.MailboxNotFound as exc:
        raise HTTPException(status_code=404, detail="Mailbox not found") from exc

    msgs = await message_service.list_messages_for_mailbox(
        session,
        mailbox_id,
        limit=limit,
        offset=offset,
        only_unread=only_unread,
    )
    try:
        await mailbox_service.touch_mailbox(session, mailbox_id)
    except Exception:  # noqa: BLE001
        pass

    # Bulk-fetch labels for these messages
    from app.services.message_service import _message_labels_inline
    labels_map = await _message_labels_inline(session, [m.id for m in msgs])
    items: list[MessageSummary] = []
    for m in msgs:
        from app.services.email_parser import parse_email_bytes
        try:
            parsed = parse_email_bytes(m.raw_content.encode("utf-8", errors="replace"))
            preview = parsed.preview
        except Exception:  # noqa: BLE001
            preview = (m.body_text or "")[:200]
        items.append(message_service.message_to_summary(m, preview, labels=labels_map.get(m.id, [])))
    return items