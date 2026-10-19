"""add_drive_folder_id_to_student_profiles

Revision ID: b81c2d3e4f5a
Revises: a2f1c84918e2
Create Date: 2026-10-19 12:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b81c2d3e4f5a'
down_revision: Union[str, None] = 'a2f1c84918e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'student_profiles',
        sa.Column('google_drive_folder_id', sa.String(length=255), nullable=True),
    )
    op.create_index(
        op.f('ix_student_profiles_google_drive_folder_id'),
        'student_profiles',
        ['google_drive_folder_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_student_profiles_google_drive_folder_id'),
        table_name='student_profiles',
    )
    op.drop_column('student_profiles', 'google_drive_folder_id')
