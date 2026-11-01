"""reconcile_hod_and_mentor_identity

Revision ID: f4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-11-01 12:15:00.000000

Safely reconciles separate HOD and Mentor accounts for Dr. Pachaiammal Alias Priya.
Unifies single official email hod.cce@sairam.edu.in for both HOD and Mentor roles.
Reassigns the 11 mentee allocations to the primary HOD account.
Sets active password to default cce@123.
Archives legacy pachaiammal.cce@sairam.edu.in account safely to preserve audit logs.
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from pwdlib import PasswordHash

# revision identifiers, used by Alembic.
revision: str = 'f4b5c6d7e8f9'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    password_hasher = PasswordHash.recommended()
    default_password_hash = password_hasher.hash("cce@123")

    # 1. Query for primary HOD account (hod.cce@sairam.edu.in)
    hod_row = bind.execute(
        sa.text("SELECT id, email, password_hash, full_name, role FROM users WHERE LOWER(email) = 'hod.cce@sairam.edu.in'")
    ).fetchone()

    # 2. Query for legacy mentor account (pachaiammal.cce@sairam.edu.in)
    mentor_row = bind.execute(
        sa.text("SELECT id, email, password_hash, full_name, role FROM users WHERE LOWER(email) = 'pachaiammal.cce@sairam.edu.in'")
    ).fetchone()

    # Determine valid password hash (preserve existing working hash if present)
    working_hash = None
    if mentor_row and mentor_row.password_hash:
        try:
            if password_hasher.verify("cce@123", mentor_row.password_hash):
                working_hash = mentor_row.password_hash
        except Exception:
            pass

    if not working_hash and hod_row and hod_row.password_hash:
        try:
            if password_hasher.verify("cce@123", hod_row.password_hash):
                working_hash = hod_row.password_hash
        except Exception:
            pass

    if not working_hash:
        working_hash = default_password_hash

    # Target HOD user ID
    target_hod_id = None

    if hod_row:
        target_hod_id = hod_row.id
        # Update HOD password hash so cce@123 works reliably
        bind.execute(
            sa.text("""
                UPDATE users
                SET password_hash = :pwd_hash,
                    is_active = true,
                    full_name = 'Dr. Pachaiammal Alias Priya',
                    role = 'hod'
                WHERE id = :uid
            """),
            {"pwd_hash": working_hash, "uid": hod_row.id}
        )
    elif mentor_row:
        # If no HOD account existed, promote mentor account to HOD
        target_hod_id = mentor_row.id
        bind.execute(
            sa.text("""
                UPDATE users
                SET email = 'hod.cce@sairam.edu.in',
                    full_name = 'Dr. Pachaiammal Alias Priya',
                    role = 'hod',
                    is_active = true,
                    password_hash = :pwd_hash
                WHERE id = :uid
            """),
            {"pwd_hash": working_hash, "uid": mentor_row.id}
        )

    # 3. If separate legacy mentor account exists and differs from target HOD account:
    if mentor_row and target_hod_id and mentor_row.id != target_hod_id:
        # Transfer all mentor assignments to target HOD account
        bind.execute(
            sa.text("""
                UPDATE mentor_assignments
                SET mentor_id = :target_id
                WHERE mentor_id = :source_id
            """),
            {"target_id": target_hod_id, "source_id": mentor_row.id}
        )

        # Transfer any verification logs
        bind.execute(
            sa.text("""
                UPDATE verification_logs
                SET reviewer_id = :target_id
                WHERE reviewer_id = :source_id
            """),
            {"target_id": target_hod_id, "source_id": mentor_row.id}
        )

        # Archive legacy mentor account safely without deleting to preserve referential integrity
        bind.execute(
            sa.text("""
                UPDATE users
                SET email = 'pachaiammal.cce.archived@sairam.edu.in',
                    is_active = false
                WHERE id = :source_id
            """),
            {"source_id": mentor_row.id}
        )

    # 4. Ensure HodProfile exists for target HOD account
    if target_hod_id:
        hod_profile = bind.execute(
            sa.text("SELECT id FROM hod_profiles WHERE user_id = :uid"),
            {"uid": target_hod_id}
        ).fetchone()

        if not hod_profile:
            bind.execute(
                sa.text("""
                    INSERT INTO hod_profiles (id, user_id, staff_id, department, designation, created_at, updated_at)
                    VALUES (:id, :uid, 'STF_HOD01', 'CCE', 'Professor & Head', NOW(), NOW())
                """),
                {"id": uuid.uuid4(), "uid": target_hod_id}
            )

    # 5. Ensure any unassigned student profiles mapped to Pachaiammal are assigned to target HOD
    if target_hod_id:
        bind.execute(
            sa.text("""
                INSERT INTO mentor_assignments (id, student_id, mentor_id, is_active, assigned_at)
                SELECT gen_random_uuid(), sp.user_id, :target_id, true, NOW()
                FROM student_profiles sp
                WHERE (LOWER(sp.original_mentor_name) LIKE '%pachhaiammal%' OR LOWER(sp.original_mentor_name) LIKE '%pachaiammal%')
                  AND sp.user_id NOT IN (
                      SELECT student_id FROM mentor_assignments WHERE is_active = true
                  )
            """),
            {"target_id": target_hod_id}
        )


def downgrade() -> None:
    pass

