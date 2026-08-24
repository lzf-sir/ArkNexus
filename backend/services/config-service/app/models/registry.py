"""Service registry + config key models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _new_id() -> str:
    return str(uuid.uuid4())


class Service(Base):
    """A registered microservice in the ArkNexus fleet."""

    __tablename__ = "services"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    # slug, used as the routing key (e.g. "email-service")
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    base_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    health_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_heartbeat_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    last_heartbeat_meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    config_keys: Mapped[list["ConfigKey"]] = relationship(
        "ConfigKey",
        back_populates="service",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ConfigKey(Base):
    """A single configuration entry exposed by a service."""

    __tablename__ = "config_keys"
    __table_args__ = (
        UniqueConstraint("service_id", "key", name="uq_config_keys_service_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    service_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("services.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    group: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)

    # value_type: string | int | float | bool | json
    value_type: Mapped[str] = mapped_column(String(20), nullable=False, default="string")
    current_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_secret: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_readonly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    options: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    service: Mapped[Service] = relationship("Service", back_populates="config_keys")


class ConfigHistory(Base):
    """Audit trail for config value changes."""

    __tablename__ = "config_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    config_key_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("config_keys.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)