"""add_is_visible_to_pgpa_components

Revision ID: e2f3a4b5c6d7
Revises: c1d2e3f4a5b6
Create Date: 2026-10-31 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_visible column to pgpa_components with server default true
    op.add_column(
        'pgpa_components',
        sa.Column('is_visible', sa.Boolean(), server_default='true', nullable=False)
    )
    # 2. Create index on is_visible for high-performance catalogue filtering
    op.create_index(
        'ix_pgpa_components_is_visible',
        'pgpa_components',
        ['is_visible']
    )


def downgrade() -> None:
    op.drop_index('ix_pgpa_components_is_visible', table_name='pgpa_components')
    op.drop_column('pgpa_components', 'is_visible')
