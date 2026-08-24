"""Mailbox ORM model."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.db.base import Base


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Mailbox(Base):
    """A temporary mailbox created by a user (or anonymously)."""

    __tablename__ = "mailboxes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    address: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # Optional owner. NULL = anonymous mailbox.
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    last_accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    messages: Mapped[list["Message"]] = relationship(  # type: ignore[name-defined]
        "Message",
        back_populates="mailbox",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    drafts: Mapped[list["Draft"]] = relationship(
        "Draft",
        back_populates="mailbox",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    owner: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User",
        back_populates="mailboxes",
    )

    @staticmethod
    def default_expiry() -> datetime:
        return _now() + timedelta(days=settings.retention_days)

    def touch(self) -> None:
        self.last_accessed_at = _now()

    def is_expired(self, when: Optional[datetime] = None) -> bool:
        ref = when or _now()
        return ref >= self.expires_at