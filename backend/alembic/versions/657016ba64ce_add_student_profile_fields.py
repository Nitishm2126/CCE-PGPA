"""add_student_profile_fields

Revision ID: 657016ba64ce
Revises: 34c7b0a88048
Create Date: 2026-10-15 22:21:59.883471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '657016ba64ce'
down_revision: Union[str, None] = '34c7b0a88048'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('student_profiles', sa.Column('semester', sa.String(length=20), nullable=True))
    op.add_column('student_profiles', sa.Column('original_mentor_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('student_profiles', 'original_mentor_name')
    op.drop_column('student_profiles', 'semester')
