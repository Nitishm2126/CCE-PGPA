"""add_certificate_status_and_remarks_to_achievements

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-11-01 10:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add certificate_status column to achievements with default 'uploaded'
    op.add_column(
        'achievements',
        sa.Column('certificate_status', sa.String(length=50), server_default='uploaded', nullable=True)
    )
    # 2. Add remarks column to achievements
    op.add_column(
        'achievements',
        sa.Column('remarks', sa.Text(), nullable=True)
    )
    # 3. Create index on certificate_status for query efficiency
    op.create_index(
        'ix_achievements_certificate_status',
        'achievements',
        ['certificate_status']
    )


def downgrade() -> None:
    op.drop_index('ix_achievements_certificate_status', table_name='achievements')
    op.drop_column('achievements', 'remarks')
    op.drop_column('achievements', 'certificate_status')
