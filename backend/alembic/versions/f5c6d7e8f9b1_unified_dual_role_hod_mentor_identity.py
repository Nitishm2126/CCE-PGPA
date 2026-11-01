"""unified_dual_role_hod_mentor_identity

Revision ID: f5c6d7e8f9b1
Revises: f4b5c6d7e8f9
Create Date: 2026-11-01 12:45:00.000000

Unifies Dr. Pachaiammal Alias Priya under single official email hod.cce@sairam.edu.in
with dual authorized roles (Department HOD and Faculty Mentor).
Purges legacy archived mentor accounts, attaches MentorProfile and HodProfile to the
unified user, and ensures all 11 mentee assignments are active and assigned to her.
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from pwdlib import PasswordHash

# revision identifiers, used by Alembic.
revision: str = 'f5c6d7e8f9b1'
down_revision: Union[str, None] = 'f4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    password_hasher = PasswordHash.recommended()
    default_password_hash = password_hasher.hash("cce@123")

    # 1. Locate primary HOD / unified user (hod.cce@sairam.edu.in)
    target_user = bind.execute(
        sa.text("SELECT id, email, password_hash, full_name, role FROM users WHERE LOWER(email) = 'hod.cce@sairam.edu.in'")
    ).fetchone()

    if not target_user:
        # If no user exists with hod.cce@sairam.edu.in, find by name or legacy email and update email
        legacy_user = bind.execute(
            sa.text("SELECT id, email, password_hash, full_name, role FROM users WHERE LOWER(full_name) LIKE '%pachaiammal%' OR LOWER(email) LIKE '%pachaiammal%'")
        ).fetchone()
        if legacy_user:
            bind.execute(
                sa.text("""
                    UPDATE users
                    SET email = 'hod.cce@sairam.edu.in',
                        full_name = 'Dr. Pachaiammal Alias Priya',
                        role = 'hod',
                        is_active = true
                    WHERE id = :uid
                """),
                {"uid": legacy_user.id}
            )
            target_user_id = legacy_user.id
        else:
            target_user_id = uuid.uuid4()
            bind.execute(
                sa.text("""
                    INSERT INTO users (id, full_name, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
                    VALUES (:id, 'Dr. Pachaiammal Alias Priya', 'hod.cce@sairam.edu.in', :pwd_hash, 'hod', true, false, NOW(), NOW())
                """),
                {"id": target_user_id, "pwd_hash": default_password_hash}
            )
    else:
        target_user_id = target_user.id
        # Ensure name and active status are correct
        bind.execute(
            sa.text("""
                UPDATE users
                SET full_name = 'Dr. Pachaiammal Alias Priya',
                    is_active = true
                WHERE id = :uid
            """),
            {"uid": target_user_id}
        )

    # 2. Find any duplicate / legacy accounts (e.g. pachaiammal.cce.archived or any other pachaiammal accounts that are not target_user_id)
    legacy_rows = bind.execute(
        sa.text("SELECT id FROM users WHERE id != :target_id AND (LOWER(email) LIKE '%pachaiammal%' OR LOWER(full_name) LIKE '%pachaiammal%')"),
        {"target_id": target_user_id}
    ).fetchall()

    for legacy in legacy_rows:
        legacy_id = legacy.id

        # Transfer mentor assignments
        bind.execute(
            sa.text("UPDATE mentor_assignments SET mentor_id = :target_id WHERE mentor_id = :legacy_id"),
            {"target_id": target_user_id, "legacy_id": legacy_id}
        )

        # Transfer verification logs
        bind.execute(
            sa.text("UPDATE verification_logs SET reviewer_id = :target_id WHERE reviewer_id = :legacy_id"),
            {"target_id": target_user_id, "legacy_id": legacy_id}
        )

        # Transfer audit logs
        bind.execute(
            sa.text("UPDATE audit_logs SET actor_id = :target_id WHERE actor_id = :legacy_id"),
            {"target_id": target_user_id, "legacy_id": legacy_id}
        )

        # Transfer messages
        bind.execute(
            sa.text("UPDATE messages SET sender_id = :target_id WHERE sender_id = :legacy_id"),
            {"target_id": target_user_id, "legacy_id": legacy_id}
        )
        bind.execute(
            sa.text("UPDATE messages SET recipient_id = :target_id WHERE recipient_id = :legacy_id"),
            {"target_id": target_user_id, "legacy_id": legacy_id}
        )

        # Delete old mentor profile referencing legacy user
        bind.execute(
            sa.text("DELETE FROM mentor_profiles WHERE user_id = :legacy_id"),
            {"legacy_id": legacy_id}
        )

        # Delete old hod profile referencing legacy user
        bind.execute(
            sa.text("DELETE FROM hod_profiles WHERE user_id = :legacy_id"),
            {"legacy_id": legacy_id}
        )

        # Purge legacy user completely so no .archived or pachaiammal duplicate remains
        bind.execute(
            sa.text("DELETE FROM users WHERE id = :legacy_id"),
            {"legacy_id": legacy_id}
        )

    # 3. Ensure HodProfile exists for target user
    hod_profile = bind.execute(
        sa.text("SELECT id FROM hod_profiles WHERE user_id = :uid"),
        {"uid": target_user_id}
    ).fetchone()

    if not hod_profile:
        bind.execute(
            sa.text("""
                INSERT INTO hod_profiles (id, user_id, staff_id, department, designation, created_at, updated_at)
                VALUES (:id, :uid, 'STF_HOD01', 'CCE', 'Professor & Head', NOW(), NOW())
            """),
            {"id": uuid.uuid4(), "uid": target_user_id}
        )
    else:
        bind.execute(
            sa.text("""
                UPDATE hod_profiles
                SET department = 'CCE',
                    designation = 'Professor & Head',
                    staff_id = COALESCE(staff_id, 'STF_HOD01')
                WHERE user_id = :uid
            """),
            {"uid": target_user_id}
        )

    # 4. Ensure MentorProfile exists for target user (staff_id STF_M03)
    mentor_profile = bind.execute(
        sa.text("SELECT id FROM mentor_profiles WHERE user_id = :uid"),
        {"uid": target_user_id}
    ).fetchone()

    if not mentor_profile:
        # Check if STF_M03 staff_id is taken by another profile
        conflict_staff = bind.execute(
            sa.text("SELECT id FROM mentor_profiles WHERE staff_id = 'STF_M03'")
        ).fetchone()
        staff_id_val = 'STF_M03' if not conflict_staff else f"STF_M_{target_user_id.hex[:4]}"

        bind.execute(
            sa.text("""
                INSERT INTO mentor_profiles (id, user_id, staff_id, department, designation, created_at, updated_at)
                VALUES (:id, :uid, :staff_id, 'CCE', 'Professor & Head', NOW(), NOW())
            """),
            {"id": uuid.uuid4(), "uid": target_user_id, "staff_id": staff_id_val}
        )
    else:
        bind.execute(
            sa.text("""
                UPDATE mentor_profiles
                SET department = 'CCE',
                    designation = 'Professor & Head',
                    staff_id = COALESCE(staff_id, 'STF_M03')
                WHERE user_id = :uid
            """),
            {"uid": target_user_id}
        )

    # 5. Restore and verify the 11 original student assignments to Dr. Pachaiammal (target_user_id)
    target_reg_nos = [
        'SEC25CO001', 'SEC25CO007', 'SEC25CO016', 'SEC25CO034', 'SEC25CO039',
        'SEC25CO041', 'SEC25CO044', 'SEC25CO045', 'SEC25CO048', 'SEC25CO057', 'SEC25CO063'
    ]

    for reg_no in target_reg_nos:
        sp_row = bind.execute(
            sa.text("SELECT user_id FROM student_profiles WHERE register_number = :reg_no"),
            {"reg_no": reg_no}
        ).fetchone()

        if sp_row:
            student_id = sp_row.user_id
            existing_assign = bind.execute(
                sa.text("SELECT id, mentor_id, is_active FROM mentor_assignments WHERE student_id = :sid AND is_active = true"),
                {"sid": student_id}
            ).fetchone()

            if existing_assign:
                if existing_assign.mentor_id != target_user_id:
                    bind.execute(
                        sa.text("UPDATE mentor_assignments SET mentor_id = :target_id WHERE id = :aid"),
                        {"target_id": target_user_id, "aid": existing_assign.id}
                    )
            else:
                bind.execute(
                    sa.text("""
                        INSERT INTO mentor_assignments (id, student_id, mentor_id, is_active, assigned_at)
                        VALUES (:id, :sid, :mid, true, NOW())
                    """),
                    {"id": uuid.uuid4(), "sid": student_id, "mid": target_user_id}
                )


def downgrade() -> None:
    pass

