"""User ORM model (used for JWT-issued identity, optional mailbox ownership)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _new_id() -> str:
    return str(uuid.uuid4())


class User(Base):
    """A registered user of ArkNexus.

    The temporary-mail feature can be used anonymously (no `User` row, mailboxes
    carry `user_id = NULL`) or under a registered account (mailboxes carry
    `user_id` and are scoped to the owner).
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mailboxes: Mapped[list["Mailbox"]] = relationship(  # type: ignore[name-defined]
        "Mailbox",
        back_populates="owner",
        lazy="selectin",
    )

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(  # type: ignore[name-defined]
        "OAuthAccount", back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )