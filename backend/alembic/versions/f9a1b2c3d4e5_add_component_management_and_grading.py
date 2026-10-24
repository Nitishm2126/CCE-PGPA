"""add_component_management_and_grading

Revision ID: f9a1b2c3d4e5
Revises: e8f192b34a10
Create Date: 2026-10-24 14:15:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers, used by Alembic.
revision: str = 'f9a1b2c3d4e5'
down_revision: Union[str, None] = 'e8f192b34a10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add configuration columns to pgpa_components
    op.add_column(
        'pgpa_components',
        sa.Column('credit_value', sa.Integer(), server_default='3', nullable=False)
    )
    op.add_column(
        'pgpa_components',
        sa.Column('submission_mode', sa.String(length=50), server_default='both', nullable=False)
    )
    op.add_column(
        'pgpa_components',
        sa.Column('grading_strategy', sa.String(length=50), server_default='categorical', nullable=False)
    )
    op.add_column(
        'pgpa_components',
        sa.Column('requires_verification', sa.Boolean(), server_default='true', nullable=False)
    )
    op.add_column(
        'pgpa_components',
        sa.Column('config_schema', JSON, nullable=True)
    )
    op.add_column(
        'pgpa_components',
        sa.Column('rule_version', sa.Integer(), server_default='1', nullable=False)
    )

    # 2. Insert GATE component if it does not already exist
    gate_id = 'a0000001-0000-0000-0000-000000000014'
    op.execute(
        sa.text(f"""
            INSERT INTO pgpa_components (id, name, slug, description, semester_label, academic_period, display_order, is_active, credit_value, submission_mode, grading_strategy, requires_verification, rule_version, created_at, updated_at)
            VALUES ('{gate_id}', 'GATE', 'gate', 'Graduate Aptitude Test in Engineering certification and score.', 'Semesters 5-8', 'Year 3-4', 11, true, 4, 'both', 'categorical', true, 1, NOW(), NOW())
            ON CONFLICT (slug) DO UPDATE SET credit_value = 4, grading_strategy = 'categorical';
        """)
    )

    # 3. Update existing components with official credits and grading strategies
    component_updates = [
        ('skillrack', 3, 'semester_threshold', 'both', True),
        ('sairam-sdg-action-programme', 3, 'activity_points_sum', 'both', True),
        ('internship', 3, 'internship', 'both', True),
        ('amcat', 3, 'score_range', 'both', True),
        ('sairam-innovation-eco-system', 4, 'categorical', 'both', True),
        ('sail', 3, 'semester_threshold', 'both', True),
        ('clubs-and-cells', 3, 'cumulative_points', 'both', True),
        ('sports-and-games', 3, 'points_sum', 'both', True),
        ('online-certifications', 2, 'categorical', 'both', True),
        ('nptel-non-credit-transfer', 4, 'categorical', 'both', True),
        ('scouts-for-sdgs', 3, 'categorical', 'both', True),
        ('fit-india-certifications', 3, 'score_range', 'both', True),
        ('academics-gpa', 0, 'score_range', 'direct_staff_entry', False),
    ]

    for slug, credit, strategy, mode, req_ver in component_updates:
        op.execute(
            sa.text(f"""
                UPDATE pgpa_components 
                SET credit_value = {credit}, 
                    grading_strategy = '{strategy}', 
                    submission_mode = '{mode}', 
                    requires_verification = {'true' if req_ver else 'false'}
                WHERE slug = '{slug}';
            """)
        )

    # 4. Create component_semester_configs table
    op.create_table(
        'component_semester_configs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('component_id', UUID(as_uuid=True), sa.ForeignKey('pgpa_components.id', ondelete='CASCADE'), nullable=False),
        sa.Column('semester_id', UUID(as_uuid=True), sa.ForeignKey('semesters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('submission_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('component_id', 'semester_id', name='uq_component_semester_config'),
    )
    op.create_index('ix_comp_sem_configs_component_id', 'component_semester_configs', ['component_id'], unique=False)
    op.create_index('ix_comp_sem_configs_semester_id', 'component_semester_configs', ['semester_id'], unique=False)
    op.create_index('ix_comp_sem_configs_is_enabled', 'component_semester_configs', ['is_enabled'], unique=False)

    # 5. Seed component_semester_configs: Cartesian product of all components x all semesters (all enabled by default)
    op.execute(
        sa.text("""
            INSERT INTO component_semester_configs (id, component_id, semester_id, is_enabled, created_at, updated_at)
            SELECT gen_random_uuid(), c.id, s.id, true, NOW(), NOW()
            FROM pgpa_components c
            CROSS JOIN semesters s
            ON CONFLICT (component_id, semester_id) DO NOTHING;
        """)
    )

    # 6. Create hod_import_batches table
    op.create_table(
        'hod_import_batches',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('uploaded_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('component_id', UUID(as_uuid=True), sa.ForeignKey('pgpa_components.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('semester_id', UUID(as_uuid=True), sa.ForeignKey('semesters.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('academic_cohort', sa.String(length=50), nullable=False),
        sa.Column('source_filename', sa.String(length=255), nullable=False),
        sa.Column('total_rows', sa.Integer(), server_default='0', nullable=False),
        sa.Column('valid_rows', sa.Integer(), server_default='0', nullable=False),
        sa.Column('error_rows', sa.Integer(), server_default='0', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='preview', nullable=False),
        sa.Column('errors_summary', JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_hod_import_batches_uploaded_by', 'hod_import_batches', ['uploaded_by'], unique=False)
    op.create_index('ix_hod_import_batches_component_id', 'hod_import_batches', ['component_id'], unique=False)
    op.create_index('ix_hod_import_batches_semester_id', 'hod_import_batches', ['semester_id'], unique=False)
    op.create_index('ix_hod_import_batches_created_at', 'hod_import_batches', ['created_at'], unique=False)

    # 7. Create student_component_results table
    op.create_table(
        'student_component_results',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('component_id', UUID(as_uuid=True), sa.ForeignKey('pgpa_components.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('semester_id', UUID(as_uuid=True), sa.ForeignKey('semesters.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('raw_score', sa.Float(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('grade', sa.String(length=10), nullable=False),
        sa.Column('grade_points', sa.Integer(), nullable=False),
        sa.Column('credit_value', sa.Integer(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('source', sa.String(length=50), server_default='student_submission', nullable=False),
        sa.Column('import_batch_id', UUID(as_uuid=True), sa.ForeignKey('hod_import_batches.id', ondelete='SET NULL'), nullable=True),
        sa.Column('achievement_id', UUID(as_uuid=True), sa.ForeignKey('achievements.id', ondelete='SET NULL'), nullable=True),
        sa.Column('calculated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('student_id', 'component_id', 'semester_id', name='uq_student_component_semester_result'),
    )
    op.create_index('ix_student_comp_results_student_id', 'student_component_results', ['student_id'], unique=False)
    op.create_index('ix_student_comp_results_component_id', 'student_component_results', ['component_id'], unique=False)
    op.create_index('ix_student_comp_results_semester_id', 'student_component_results', ['semester_id'], unique=False)
    op.create_index('ix_student_comp_results_is_verified', 'student_component_results', ['is_verified'], unique=False)

    # 8. Create student_semester_pgpa table
    op.create_table(
        'student_semester_pgpa',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('semester_id', UUID(as_uuid=True), sa.ForeignKey('semesters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('a1_score', sa.Float(), nullable=False),
        sa.Column('gpa', sa.Float(), nullable=True),
        sa.Column('pgpa', sa.Float(), nullable=True),
        sa.Column('total_credits_attempted', sa.Integer(), nullable=False),
        sa.Column('total_credits_earned', sa.Integer(), nullable=False),
        sa.Column('calculated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('student_id', 'semester_id', name='uq_student_semester_pgpa'),
    )
    op.create_index('ix_student_sem_pgpa_student_id', 'student_semester_pgpa', ['student_id'], unique=False)
    op.create_index('ix_student_sem_pgpa_semester_id', 'student_semester_pgpa', ['semester_id'], unique=False)


def downgrade() -> None:
    op.drop_table('student_semester_pgpa')
    op.drop_table('student_component_results')
    op.drop_table('hod_import_batches')
    op.drop_table('component_semester_configs')
    op.drop_column('pgpa_components', 'rule_version')
    op.drop_column('pgpa_components', 'config_schema')
    op.drop_column('pgpa_components', 'requires_verification')
    op.drop_column('pgpa_components', 'grading_strategy')
    op.drop_column('pgpa_components', 'submission_mode')
    op.drop_column('pgpa_components', 'credit_value')
