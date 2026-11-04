"""add_revert_action_to_review_action

Revision ID: f7e8f9a1b2c4
Revises: f6d7e8f9b2c3
Create Date: 2026-11-04 22:35:00.000000

Adds 'revert' value to PostgreSQL enum 'review_action'
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f7e8f9a1b2c4'
down_revision: Union[str, None] = 'f6d7e8f9b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(sa.text("ALTER TYPE review_action ADD VALUE IF NOT EXISTS 'revert'"))


def downgrade() -> None:
    pass

