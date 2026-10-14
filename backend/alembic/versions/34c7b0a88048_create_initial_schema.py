"""create_initial_schema

Revision ID: 34c7b0a88048
Revises: 
Create Date: 2026-10-14 20:32:19.109187

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '34c7b0a88048'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Verified 13 PGPA components from PRD/TRD documentation baseline.
# Note: 14th component is currently unconfirmed in project requirements and will be added via follow-up migration.
SEED_NOW = datetime.now(timezone.utc)
VERIFIED_PGPA_COMPONENTS = [
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000001"),
        "name": "Skillrack",
        "slug": "skillrack",
        "description": "Skillrack coding practice, performance assessments, and milestones.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 1,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000002"),
        "name": "Academics (GPA)",
        "slug": "academics-gpa",
        "description": "Semester GPA records and academic merit achievements.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 2,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000003"),
        "name": "AMCAT",
        "slug": "amcat",
        "description": "AMCAT employability assessments, test scores, and performance feedback.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 3,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000004"),
        "name": "Clubs & Cells",
        "slug": "clubs-and-cells",
        "description": "Institutional and departmental club memberships, event organization, and roles.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 4,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000005"),
        "name": "Sairam Innovation Eco-System",
        "slug": "sairam-innovation-eco-system",
        "description": "Ideathon, Solvethon, Innovathon, Inspirathon, and innovation ecosystem activities.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 5,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000006"),
        "name": "NPTEL (Non-Credit Transfer)",
        "slug": "nptel-non-credit-transfer",
        "description": "NPTEL certification courses undertaken without academic credit transfer.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 6,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000007"),
        "name": "SAIL (Sairam Artificial Intelligence Learning)",
        "slug": "sail",
        "description": "Sairam Artificial Intelligence Learning modules, workshops, and certifications.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 7,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000008"),
        "name": "Online Certifications",
        "slug": "online-certifications",
        "description": "MOOCs and verified industry online certifications (Coursera, edX, Udemy, etc.).",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 8,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000009"),
        "name": "FIT INDIA Certifications",
        "slug": "fit-india-certifications",
        "description": "Fit India initiatives, fitness challenges, and national fitness certificates.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 9,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000010"),
        "name": "Internship",
        "slug": "internship",
        "description": "Industrial internships, corporate training, and research internships.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 10,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000011"),
        "name": "Sairam SDG Action Programme",
        "slug": "sairam-sdg-action-programme",
        "description": "Sustainable Development Goals projects, field initiatives, and outreach.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 11,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000012"),
        "name": "Sports & Games",
        "slug": "sports-and-games",
        "description": "Inter-college, zonal, state, and national athletic and sports competitions.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 12,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
    {
        "id": uuid.UUID("a0000001-0000-0000-0000-000000000013"),
        "name": "Scouts for SDGs",
        "slug": "scouts-for-sdgs",
        "description": "Scout badges, community leadership, and environmental sustainability initiatives.",
        "semester_label": "All Semesters",
        "academic_period": "2024-2025",
        "display_order": 13,
        "is_active": True,
        "created_at": SEED_NOW,
        "updated_at": SEED_NOW,
    },
]


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    pgpa_components_table = op.create_table('pgpa_components',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('slug', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('semester_label', sa.String(length=50), nullable=True),
    sa.Column('academic_period', sa.String(length=50), nullable=True),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pgpa_components_is_active'), 'pgpa_components', ['is_active'], unique=False)
    op.create_index(op.f('ix_pgpa_components_slug'), 'pgpa_components', ['slug'], unique=True)

    # Seed verified 13 official PGPA components
    op.bulk_insert(pgpa_components_table, VERIFIED_PGPA_COMPONENTS)
    op.create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.Text(), nullable=False),
    sa.Column('role', sa.Enum('student', 'mentor', 'hod', name='user_role'), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_table('achievements',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('component_id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('activity_type', sa.String(length=100), nullable=True),
    sa.Column('organizer', sa.String(length=255), nullable=True),
    sa.Column('event_date', sa.Date(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('outcome', sa.String(length=255), nullable=True),
    sa.Column('status', sa.Enum('draft', 'pending', 'approved', 'rejected', name='achievement_status'), nullable=False),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['component_id'], ['pgpa_components.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_achievements_component_id'), 'achievements', ['component_id'], unique=False)
    op.create_index(op.f('ix_achievements_event_date'), 'achievements', ['event_date'], unique=False)
    op.create_index(op.f('ix_achievements_status'), 'achievements', ['status'], unique=False)
    op.create_index('ix_achievements_student_component', 'achievements', ['student_id', 'component_id'], unique=False)
    op.create_index(op.f('ix_achievements_student_id'), 'achievements', ['student_id'], unique=False)
    op.create_index('ix_achievements_student_status', 'achievements', ['student_id', 'status'], unique=False)
    op.create_table('audit_logs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('actor_id', sa.UUID(), nullable=True),
    sa.Column('action', sa.String(length=100), nullable=False),
    sa.Column('target_type', sa.String(length=100), nullable=False),
    sa.Column('target_id', sa.String(length=255), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_actor_id'), 'audit_logs', ['actor_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_target_type'), 'audit_logs', ['target_type'], unique=False)
    op.create_table('mentor_assignments',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('mentor_id', sa.UUID(), nullable=False),
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('assigned_by', sa.UUID(), nullable=True),
    sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['mentor_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mentor_assignments_is_active'), 'mentor_assignments', ['is_active'], unique=False)
    op.create_index(op.f('ix_mentor_assignments_mentor_id'), 'mentor_assignments', ['mentor_id'], unique=False)
    op.create_index('ix_mentor_assignments_mentor_student', 'mentor_assignments', ['mentor_id', 'student_id'], unique=False)
    op.create_index('ix_mentor_assignments_student_active', 'mentor_assignments', ['student_id', 'is_active'], unique=False)
    op.create_index(op.f('ix_mentor_assignments_student_id'), 'mentor_assignments', ['student_id'], unique=False)
    op.create_table('mentor_profiles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('staff_id', sa.String(length=50), nullable=True),
    sa.Column('department', sa.String(length=50), nullable=False),
    sa.Column('designation', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('staff_id')
    )
    op.create_index(op.f('ix_mentor_profiles_user_id'), 'mentor_profiles', ['user_id'], unique=True)
    op.create_table('student_profiles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('register_number', sa.String(length=50), nullable=False),
    sa.Column('department', sa.String(length=50), nullable=False),
    sa.Column('year', sa.SmallInteger(), nullable=False),
    sa.Column('section', sa.String(length=10), nullable=True),
    sa.Column('batch', sa.String(length=20), nullable=True),
    sa.Column('phone_number', sa.String(length=20), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_student_profiles_register_number'), 'student_profiles', ['register_number'], unique=True)
    op.create_index(op.f('ix_student_profiles_user_id'), 'student_profiles', ['user_id'], unique=True)
    op.create_table('achievement_files',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('achievement_id', sa.UUID(), nullable=False),
    sa.Column('provider', sa.String(length=50), nullable=False),
    sa.Column('drive_file_id', sa.String(length=255), nullable=False),
    sa.Column('drive_folder_id', sa.String(length=255), nullable=True),
    sa.Column('original_filename', sa.String(length=255), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('size_bytes', sa.BigInteger(), nullable=False),
    sa.Column('file_category', sa.Enum('certificate', 'photo', 'supporting_document', name='file_category'), nullable=False),
    sa.Column('uploaded_by', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['achievement_id'], ['achievements.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_achievement_files_achievement_id'), 'achievement_files', ['achievement_id'], unique=False)
    op.create_index(op.f('ix_achievement_files_drive_file_id'), 'achievement_files', ['drive_file_id'], unique=False)
    op.create_table('verification_logs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('achievement_id', sa.UUID(), nullable=False),
    sa.Column('reviewer_id', sa.UUID(), nullable=False),
    sa.Column('action', sa.Enum('approved', 'rejected', 'requested_changes', name='review_action'), nullable=False),
    sa.Column('remarks', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['achievement_id'], ['achievements.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_verification_logs_achievement_id'), 'verification_logs', ['achievement_id'], unique=False)
    op.create_index(op.f('ix_verification_logs_reviewer_id'), 'verification_logs', ['reviewer_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_verification_logs_reviewer_id'), table_name='verification_logs')
    op.drop_index(op.f('ix_verification_logs_achievement_id'), table_name='verification_logs')
    op.drop_table('verification_logs')
    op.drop_index(op.f('ix_achievement_files_drive_file_id'), table_name='achievement_files')
    op.drop_index(op.f('ix_achievement_files_achievement_id'), table_name='achievement_files')
    op.drop_table('achievement_files')
    op.drop_index(op.f('ix_student_profiles_user_id'), table_name='student_profiles')
    op.drop_index(op.f('ix_student_profiles_register_number'), table_name='student_profiles')
    op.drop_table('student_profiles')
    op.drop_index(op.f('ix_mentor_profiles_user_id'), table_name='mentor_profiles')
    op.drop_table('mentor_profiles')
    op.drop_index(op.f('ix_mentor_assignments_student_id'), table_name='mentor_assignments')
    op.drop_index('ix_mentor_assignments_student_active', table_name='mentor_assignments')
    op.drop_index('ix_mentor_assignments_mentor_student', table_name='mentor_assignments')
    op.drop_index(op.f('ix_mentor_assignments_mentor_id'), table_name='mentor_assignments')
    op.drop_index(op.f('ix_mentor_assignments_is_active'), table_name='mentor_assignments')
    op.drop_table('mentor_assignments')
    op.drop_index(op.f('ix_audit_logs_target_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_actor_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index('ix_achievements_student_status', table_name='achievements')
    op.drop_index(op.f('ix_achievements_student_id'), table_name='achievements')
    op.drop_index('ix_achievements_student_component', table_name='achievements')
    op.drop_index(op.f('ix_achievements_status'), table_name='achievements')
    op.drop_index(op.f('ix_achievements_event_date'), table_name='achievements')
    op.drop_index(op.f('ix_achievements_component_id'), table_name='achievements')
    op.drop_table('achievements')
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_pgpa_components_slug'), table_name='pgpa_components')
    op.drop_index(op.f('ix_pgpa_components_is_active'), table_name='pgpa_components')
    op.drop_table('pgpa_components')

    # Drop custom PostgreSQL ENUM types on rollback
    sa.Enum(name='review_action').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='file_category').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='achievement_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='user_role').drop(op.get_bind(), checkfirst=True)
    # ### end Alembic commands ###
