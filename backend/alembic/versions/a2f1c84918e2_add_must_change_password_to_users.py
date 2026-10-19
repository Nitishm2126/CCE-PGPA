"""add_must_change_password_to_users

Revision ID: a2f1c84918e2
Revises: e1987b4f2c01
Create Date: 2026-10-18 21:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2f1c84918e2'
down_revision: Union[str, None] = 'e1987b4f2c01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('must_change_password', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )


def downgrade() -> None:
    op.drop_column('users', 'must_change_password')
