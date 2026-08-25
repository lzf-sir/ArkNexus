"""add top_p column + default params keys

Revision ID: ai0002_top_p_defaults
Revises: ai0001_initial
Create Date: 2026-08-25

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "ai0002_top_p_defaults"
down_revision: Union[str, Sequence[str], None] = "ai0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_conversations",
        sa.Column("top_p", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_conversations", "top_p")
