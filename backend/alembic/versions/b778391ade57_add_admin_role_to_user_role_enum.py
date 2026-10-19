"""add_admin_role_to_user_role_enum

Revision ID: b778391ade57
Revises: 9e0f7bf799cc
Create Date: 2026-10-16 18:09:39.634129

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b778391ade57'
down_revision: Union[str, None] = '9e0f7bf799cc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safely add 'admin' value to PostgreSQL native enum 'user_role'
    with op.get_context().autocommit_block():
        op.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'"))


def downgrade() -> None:
    # PostgreSQL does not support directly removing enum labels via ALTER TYPE.
    # Remove any test or provisioned users with role='admin' to prevent constraint failure.
    op.execute(sa.text("DELETE FROM users WHERE role = 'admin'"))
