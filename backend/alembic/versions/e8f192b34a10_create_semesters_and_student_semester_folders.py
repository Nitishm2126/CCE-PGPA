"""create_semesters_and_student_semester_folders

Revision ID: e8f192b34a10
Revises: c7391a8e5f20
Create Date: 2026-10-23 19:30:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'e8f192b34a10'
down_revision: Union[str, None] = 'c7391a8e5f20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create semesters table
    op.create_table(
        'semesters',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('semester_number', sa.SmallInteger(), nullable=False),
        sa.Column('display_name', sa.String(length=50), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_semesters_semester_number', 'semesters', ['semester_number'], unique=True)
    op.create_index('ix_semesters_is_enabled', 'semesters', ['is_enabled'], unique=False)

    # 2. Create student_semester_folders table
    op.create_table(
        'student_semester_folders',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('semester_id', UUID(as_uuid=True), sa.ForeignKey('semesters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('drive_folder_id', sa.String(length=255), nullable=False),
        sa.Column('drive_folder_name', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('student_id', 'semester_id', name='uq_student_semester_folder'),
    )
    op.create_index('ix_student_semester_folders_student_id', 'student_semester_folders', ['student_id'], unique=False)
    op.create_index('ix_student_semester_folders_semester_id', 'student_semester_folders', ['semester_id'], unique=False)
    op.create_index('ix_student_semester_folders_drive_folder_id', 'student_semester_folders', ['drive_folder_id'], unique=False)

    # 3. Add semester_id column to achievements table
    op.add_column(
        'achievements',
        sa.Column('semester_id', UUID(as_uuid=True), sa.ForeignKey('semesters.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_achievements_semester_id', 'achievements', ['semester_id'], unique=False)
    op.create_index('ix_achievements_student_semester', 'achievements', ['student_id', 'semester_id'], unique=False)

    # 4. Idempotently seed all eight semesters (Semesters 1-3 open, 4-8 initially closed)
    semesters_data = [
        (str(uuid.uuid4()), 1, "Semester 1", True),
        (str(uuid.uuid4()), 2, "Semester 2", True),
        (str(uuid.uuid4()), 3, "Semester 3", True),
        (str(uuid.uuid4()), 4, "Semester 4", False),
        (str(uuid.uuid4()), 5, "Semester 5", False),
        (str(uuid.uuid4()), 6, "Semester 6", False),
        (str(uuid.uuid4()), 7, "Semester 7", False),
        (str(uuid.uuid4()), 8, "Semester 8", False),
    ]

    for s_id, s_num, s_name, s_enabled in semesters_data:
        op.execute(
            sa.text(f"""
                INSERT INTO semesters (id, semester_number, display_name, is_enabled, created_at, updated_at)
                VALUES ('{s_id}', {s_num}, '{s_name}', {'true' if s_enabled else 'false'}, NOW(), NOW())
                ON CONFLICT (semester_number) DO NOTHING;
            """)
        )


def downgrade() -> None:
    op.drop_index('ix_achievements_student_semester', table_name='achievements')
    op.drop_index('ix_achievements_semester_id', table_name='achievements')
    op.drop_column('achievements', 'semester_id')

    op.drop_index('ix_student_semester_folders_drive_folder_id', table_name='student_semester_folders')
    op.drop_index('ix_student_semester_folders_semester_id', table_name='student_semester_folders')
    op.drop_index('ix_student_semester_folders_student_id', table_name='student_semester_folders')
    op.drop_table('student_semester_folders')

    op.drop_index('ix_semesters_is_enabled', table_name='semesters')
    op.drop_index('ix_semesters_semester_number', table_name='semesters')
    op.drop_table('semesters')
