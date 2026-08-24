"""Message and Attachment ORM models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _new_id() -> str:
    return str(uuid.uuid4())


class Attachment(Base):
    """A file attached to a message."""

    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    message_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("messages.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False, default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    content_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    message: Mapped["Message"] = relationship("Message", back_populates="attachments")


class Message(Base):
    """A single email message received by a mailbox."""

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    mailbox_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("mailboxes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # RFC 5322 Message-ID header (optional, may not be present)
    rfc_message_id: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, index=True)

    from_address: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    from_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Comma separated list for quick listing
    to_addresses: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cc_addresses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    subject: Mapped[Optional[str]] = mapped_column(String(998), nullable=True)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_attachments: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    spam_score: Mapped[float] = mapped_column(Integer, default=0, nullable=False)  # float-friendly

    # ===== Organization fields =====
    folder_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("folders.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    is_trashed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    trashed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    mailbox: Mapped["Mailbox"] = relationship("Mailbox", back_populates="messages")
    label_associations: Mapped[list["MessageLabel"]] = relationship(  # type: ignore[name-defined]
        "MessageLabel", back_populates="message", cascade="all, delete-orphan", lazy="selectin"
    )
    attachments: Mapped[list[Attachment]] = relationship(
        Attachment, back_populates="message", cascade="all, delete-orphan", lazy="selectin"
    )