"""System state key/value store used by the first-run initializer.

The system_state table holds arbitrary scalar settings that the init wizard
collects before the application is considered "ready". The canonical key is
``initialized`` (bool). Other keys we care about:

- ``database_url``      -- the SQLAlchemy URL the admin chose during init
- ``database_driver``   -- "sqlite" | "postgresql" | "other"
- ``redis_url``         -- optional Redis connection string
- ``email_domain``      -- the SMTP receiving domain
- ``admin_user_id``     -- the user that was created as admin
- ``completed_at``      -- when init finished
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SystemState(Base):
    """One row per configuration key."""

    __tablename__ = "system_state"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )