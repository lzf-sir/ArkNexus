"""Folder and Label ORM models for message organization."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _new_id() -> str:
    return str(uuid.uuid4())


# Built-in folder slugs (reserved for the system).
SYSTEM_FOLDERS = ("inbox", "trash", "starred")


class Folder(Base):
    """A logical container for messages.

    Two flavours:
      - system (slug == "inbox" | "trash" | "starred"): globally unique, no owner.
      - custom: user-defined, scoped to an owner.
    """

    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    slug: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    owner_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

# Folder has no direct child rows; messages reference Folder via folder_id.


class Label(Base):
    """A user-defined tag. Many-to-many with messages."""

    __tablename__ = "labels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    owner_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="blue")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    messages: Mapped[list["MessageLabel"]] = relationship(  # type: ignore[name-defined]
        "MessageLabel", back_populates="label", cascade="all, delete-orphan"
    )


class MessageLabel(Base):
    """Association table between messages and labels."""

    __tablename__ = "message_labels"

    message_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("messages.id", ondelete="CASCADE"),
        primary_key=True,
    )
    label_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("labels.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    message = relationship("Message", back_populates="label_associations")
    label = relationship("Label", back_populates="messages")
