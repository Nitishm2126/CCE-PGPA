"""add_pdf_requirement_to_components

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-25 10:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add pdf_requirement and allow_other_evidence_types columns to pgpa_components
    op.add_column(
        'pgpa_components',
        sa.Column('pdf_requirement', sa.String(length=20), server_default='optional', nullable=False)
    )
    op.add_column(
        'pgpa_components',
        sa.Column('allow_other_evidence_types', sa.Boolean(), server_default='false', nullable=False)
    )

    # 2. Set Academics (GPA) to 'required' initially to preserve existing GPA mark sheet requirement
    op.execute(
        sa.text("UPDATE pgpa_components SET pdf_requirement = 'required' WHERE slug = 'academics-gpa';")
    )


def downgrade() -> None:
    op.drop_column('pgpa_components', 'allow_other_evidence_types')
    op.drop_column('pgpa_components', 'pdf_requirement')
