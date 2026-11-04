"""add_under_review_status_and_manual_points

Revision ID: f6d7e8f9b2c3
Revises: f5c6d7e8f9b1
Create Date: 2026-11-04 21:00:00.000000

Adds:
1. 'under_review' value to PostgreSQL enums 'achievement_status' and 'review_action'
2. 'manual_component_points' table for mentor manual component points awards
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f6d7e8f9b2c3'
down_revision: Union[str, None] = 'f5c6d7e8f9b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add 'under_review' to PostgreSQL native enums in autocommit block
    with op.get_context().autocommit_block():
        op.execute(sa.text("ALTER TYPE achievement_status ADD VALUE IF NOT EXISTS 'under_review'"))
        op.execute(sa.text("ALTER TYPE review_action ADD VALUE IF NOT EXISTS 'under_review'"))

    # 2. Create manual_component_points table
    op.create_table(
        'manual_component_points',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mentor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('component_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('semester_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('points', sa.Float(), nullable=False),
        sa.Column('remarks', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['mentor_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['component_id'], ['pgpa_components.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['semester_id'], ['semesters.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_manual_component_points_student_id'), 'manual_component_points', ['student_id'], unique=False)
    op.create_index(op.f('ix_manual_component_points_mentor_id'), 'manual_component_points', ['mentor_id'], unique=False)
    op.create_index(op.f('ix_manual_component_points_component_id'), 'manual_component_points', ['component_id'], unique=False)
    op.create_index(op.f('ix_manual_component_points_semester_id'), 'manual_component_points', ['semester_id'], unique=False)
    op.create_index(op.f('ix_manual_component_points_is_active'), 'manual_component_points', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_manual_component_points_is_active'), table_name='manual_component_points')
    op.drop_index(op.f('ix_manual_component_points_semester_id'), table_name='manual_component_points')
    op.drop_index(op.f('ix_manual_component_points_component_id'), table_name='manual_component_points')
    op.drop_index(op.f('ix_manual_component_points_mentor_id'), table_name='manual_component_points')
    op.drop_index(op.f('ix_manual_component_points_student_id'), table_name='manual_component_points')
    op.drop_table('manual_component_points')
