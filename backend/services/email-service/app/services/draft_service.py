"""Draft CRUD business logic."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.draft import Draft
from app.models.mailbox import Mailbox
from app.schemas.message import DraftCreate, DraftUpdate


class DraftNotFound(Exception):
    pass


class DraftForbidden(Exception):
    pass


def _split_addrs(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [a.strip() for a in value.split(",") if a.strip()]


def _join_addrs(values: List[str]) -> str:
    return ",".join(a.strip() for a in values if a.strip())


def _draft_size(d: Draft) -> int:
    return len((d.body_text or "") + (d.body_html or "") + (d.subject or ""))


def draft_to_read(d: Draft):
    from app.schemas.message import DraftRead
    return DraftRead(
        id=d.id,
        mailbox_id=d.mailbox_id,
        to_addresses=_split_addrs(d.to_addresses),
        cc_addresses=_split_addrs(d.cc_addresses),
        subject=d.subject,
        body_text=d.body_text,
        body_html=d.body_html,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


async def list_drafts(
    session: AsyncSession, mailbox_id: str
) -> List[Draft]:
    stmt = (
        select(Draft)
        .where(Draft.mailbox_id == mailbox_id)
        .order_by(Draft.updated_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def get_draft(session: AsyncSession, draft_id: str) -> Draft:
    stmt = select(Draft).where(Draft.id == draft_id)
    result = await session.execute(stmt)
    d = result.scalar_one_or_none()
    if d is None:
        raise DraftNotFound(draft_id)
    return d


async def create_draft(
    session: AsyncSession, mailbox: Mailbox, payload: DraftCreate
) -> Draft:
    d = Draft(
        mailbox_id=mailbox.id,
        to_addresses=_join_addrs(payload.to_addresses),
        cc_addresses=_join_addrs(payload.cc_addresses),
        subject=payload.subject,
        body_text=payload.body_text,
        body_html=payload.body_html,
    )
    d.size_bytes = _draft_size(d)
    session.add(d)
    await session.commit()
    await session.refresh(d)
    return d


async def update_draft(
    session: AsyncSession, draft_id: str, payload: DraftUpdate
) -> Draft:
    d = await get_draft(session, draft_id)
    d.to_addresses = _join_addrs(payload.to_addresses)
    d.cc_addresses = _join_addrs(payload.cc_addresses)
    d.subject = payload.subject
    d.body_text = payload.body_text
    d.body_html = payload.body_html
    d.size_bytes = _draft_size(d)
    await session.commit()
    await session.refresh(d)
    return d


async def delete_draft(session: AsyncSession, draft_id: str) -> None:
    d = await get_draft(session, draft_id)
    await session.delete(d)
    await session.commit()