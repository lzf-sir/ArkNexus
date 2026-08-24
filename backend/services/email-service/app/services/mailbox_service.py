"""Mailbox-related business logic."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import and_, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.mailbox import Mailbox
from app.schemas.mailbox import MailboxCreate, MailboxRead, MailboxUpdate
from app.services.email_generator import normalize_custom, random_local_part


class MailboxAddressTaken(Exception):
    pass


class MailboxNotFound(Exception):
    pass


class MailboxForbidden(Exception):
    """Raised when the current user is not allowed to access a mailbox."""


def _compose_address(local_part: str) -> str:
    return f"{local_part}@{settings.email_domain}"


async def _address_exists(session: AsyncSession, address: str) -> bool:
    stmt = select(func.count(Mailbox.id)).where(Mailbox.address == address)
    result = await session.execute(stmt)
    return bool(result.scalar() or 0)


async def create_mailbox(
    session: AsyncSession,
    payload: MailboxCreate,
    *,
    owner_id: Optional[str] = None,
) -> Mailbox:
    """Create a new temporary mailbox with a unique address."""
    local_part = (
        normalize_custom(payload.local_part)
        if payload.local_part
        else random_local_part(settings.email_localpart_max_len)
    )
    if not local_part:
        raise ValueError("local_part cannot be empty")

    for _ in range(8):
        address = _compose_address(local_part)
        if not await _address_exists(session, address):
            break
        if payload.local_part:
            raise MailboxAddressTaken(address)
        local_part = random_local_part(settings.email_localpart_max_len)
    else:
        raise MailboxAddressTaken(address)

    mailbox = Mailbox(
        address=address,
        display_name=payload.display_name,
        user_id=owner_id,
        expires_at=Mailbox.default_expiry(),
    )
    session.add(mailbox)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise MailboxAddressTaken(address) from exc

    await session.refresh(mailbox)
    return mailbox


async def get_mailbox(session: AsyncSession, mailbox_id: str) -> Mailbox:
    stmt = select(Mailbox).where(Mailbox.id == mailbox_id)
    result = await session.execute(stmt)
    mailbox = result.scalar_one_or_none()
    if mailbox is None:
        raise MailboxNotFound(mailbox_id)
    return mailbox


async def get_mailbox_for(
    session: AsyncSession,
    mailbox_id: str,
    *,
    user_id: Optional[str],
) -> Mailbox:
    """Get a mailbox, enforcing that `user_id` matches the owner.

    - user_id is None (anonymous caller): can only access anonymous mailboxes.
    - user_id is a real ID: can access either their own boxes OR anonymous ones.
    """
    if user_id is None:
        stmt = select(Mailbox).where(
            Mailbox.id == mailbox_id, Mailbox.user_id.is_(None)
        )
    else:
        stmt = select(Mailbox).where(
            Mailbox.id == mailbox_id,
            (Mailbox.user_id.is_(None)) | (Mailbox.user_id == user_id),
        )
    result = await session.execute(stmt)
    mailbox = result.scalar_one_or_none()
    if mailbox is None:
        raise MailboxNotFound(mailbox_id)
    return mailbox


async def get_mailbox_by_address(session: AsyncSession, address: str) -> Optional[Mailbox]:
    stmt = select(Mailbox).where(Mailbox.address == address.lower())
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_mailboxes(
    session: AsyncSession,
    *,
    include_expired: bool = False,
    user_id: Optional[str] = None,
) -> List[Mailbox]:
    """List mailboxes.

    - user_id is None: returns anonymous (user_id IS NULL) mailboxes only.
    - user_id is a real ID: returns that user's mailboxes.
    """
    now = datetime.now(timezone.utc)
    stmt = select(Mailbox)
    if not include_expired:
        stmt = stmt.where(Mailbox.expires_at > now)
    if user_id is None:
        stmt = stmt.where(Mailbox.user_id.is_(None))
    else:
        stmt = stmt.where(Mailbox.user_id == user_id)
    stmt = stmt.order_by(Mailbox.created_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def update_mailbox(
    session: AsyncSession,
    mailbox_id: str,
    payload: MailboxUpdate,
) -> Mailbox:
    mailbox = await get_mailbox(session, mailbox_id)
    if payload.display_name is not None:
        mailbox.display_name = payload.display_name
    if payload.extend_days:
        mailbox.expires_at = max(
            datetime.now(timezone.utc),
            mailbox.expires_at + timedelta(days=payload.extend_days),
        )
    await session.commit()
    await session.refresh(mailbox)
    return mailbox


async def delete_mailbox(session: AsyncSession, mailbox_id: str) -> None:
    mailbox = await get_mailbox(session, mailbox_id)
    await session.delete(mailbox)
    await session.commit()


async def touch_mailbox(session: AsyncSession, mailbox_id: str) -> None:
    await session.execute(
        update(Mailbox)
        .where(Mailbox.id == mailbox_id)
        .values(last_accessed_at=func.now())
    )
    await session.commit()


def mailbox_to_read(mailbox: Mailbox, unread_count: int = 0) -> MailboxRead:
    return MailboxRead(
        id=mailbox.id,
        address=mailbox.address,
        display_name=mailbox.display_name,
        created_at=mailbox.created_at,
        expires_at=mailbox.expires_at,
        last_accessed_at=mailbox.last_accessed_at,
        message_count=mailbox.message_count,
        unread_count=unread_count,
    )