"""create_hod_profiles_table

Revision ID: e1987b4f2c01
Revises: d32a4eed9098
Create Date: 2026-10-18 17:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1987b4f2c01'
down_revision: Union[str, None] = 'd32a4eed9098'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'hod_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('staff_id', sa.String(length=50), nullable=True),
        sa.Column('department', sa.String(length=50), server_default='CCE', nullable=False),
        sa.Column('designation', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('staff_id'),
    )
    op.create_index(op.f('ix_hod_profiles_user_id'), 'hod_profiles', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_hod_profiles_user_id'), table_name='hod_profiles')
    op.drop_table('hod_profiles')
