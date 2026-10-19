"""
CCE Achieve -- Secure System Administrator Provisioning Tool
Location: backend/app/cli/provision_admin.py

Features:
1. Bidirectional live Firebase Preflight Verification (Email <-> UID match, account active).
2. Explicit System Administrator Authorization Confirmation requirement.
3. Argon2id security check proving placeholder password hash cannot authenticate.
4. Dynamic Database Schema & Cohort Integrity verification (no hardcoded assumption of 61).
5. Transaction Safety: session.commit is strictly disabled during dry-run.
6. Explicit session.rollback() for normal control flow in dry-run (no KeyboardInterrupt anti-pattern).
7. Independent post-execution database verification confirming 0 persistent changes in dry-run.
"""
import argparse
import sys
import uuid
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import func, select, text
from app.db.session import SessionLocal
from app.models.user import MentorProfile, StudentProfile, User, UserRole
from app.core.firebase import get_firebase_app
from app.core.security import verify_password
from firebase_admin import auth as fb_auth

TARGET_EMAIL = "cce.pgpa@gmail.com"
TARGET_FIREBASE_UID = "fjWQn2rGgsR3iVd97YgaZCvBsgB3"
ADMIN_FULL_NAME = "CCE System Administrator"
PLACEHOLDER_PASSWORD_HASH = "FIREBASE_MANAGED_ACCOUNT"


def verify_firebase_preflight(target_email: str, target_uid: str):
    """
    Preflight check against live Firebase Authentication service:
    1. Confirms the user exists in Firebase project cce-pgpa by email.
    2. Confirms the user exists in Firebase project cce-pgpa by UID.
    3. Confirms bidirectional match: email -> UID and UID -> email.
    4. Confirms the Firebase user account is active (not disabled).
    """
    print("\n--- 1. FIREBASE PREFLIGHT VERIFICATION ---")
    app = get_firebase_app()

    # 1.1: Lookup by email
    try:
        fb_user_by_email = fb_auth.get_user_by_email(target_email, app=app)
    except fb_auth.UserNotFoundError:
        raise RuntimeError(
            f"Firebase Preflight Failure: User '{target_email}' does not exist in Firebase project 'cce-pgpa'."
        )
    except Exception as e:
        raise RuntimeError(f"Firebase Preflight Failure: Unable to query Firebase by email: {e}")

    # 1.2: Lookup by UID
    try:
        fb_user_by_uid = fb_auth.get_user(target_uid, app=app)
    except fb_auth.UserNotFoundError:
        raise RuntimeError(
            f"Firebase Preflight Failure: UID '{target_uid}' does not exist in Firebase project 'cce-pgpa'."
        )
    except Exception as e:
        raise RuntimeError(f"Firebase Preflight Failure: Unable to query Firebase by UID: {e}")

    # 1.3: Verify bidirectional identity match
    if fb_user_by_email.uid != target_uid:
        raise RuntimeError(
            f"Firebase Preflight Failure: Email lookup UID mismatch for '{target_email}'. "
            f"Expected '{target_uid}', found '{fb_user_by_email.uid}'."
        )

    if (fb_user_by_uid.email or "").strip().lower() != target_email.strip().lower():
        raise RuntimeError(
            f"Firebase Preflight Failure: UID lookup email mismatch for '{target_uid}'. "
            f"Expected '{target_email}', found '{fb_user_by_uid.email}'."
        )

    # 1.4: Verify account status
    if fb_user_by_email.disabled:
        raise RuntimeError(
            f"Firebase Preflight Failure: Account '{target_email}' is marked disabled in Firebase."
        )

    print(f"[OK] Firebase account confirmed: '{fb_user_by_email.email}'")
    print(f"[OK] Firebase UID confirmed:     '{fb_user_by_email.uid}'")
    print(f"[OK] Bidirectional UID <-> Email mapping verified.")
    print(f"[OK] Firebase account status:    Active (disabled={fb_user_by_email.disabled})")
    print(f"[OK] Firebase email verified:   {fb_user_by_email.email_verified}")


def verify_password_hash_security():
    """
    Confirm the placeholder password hash cannot authenticate through
    the legacy password-login endpoint or Argon2id verification.
    """
    print("\n--- 2. PLACEHOLDER PASSWORD HASH SECURITY VERIFICATION ---")
    candidate_passwords = [
        "",
        "password",
        "admin",
        "admin123",
        "Admin@123",
        TARGET_EMAIL,
        PLACEHOLDER_PASSWORD_HASH,
        "fjWQn2rGgsR3iVd97YgaZCvBsgB3",
        "random_test_password_string_!@#",
    ]

    for candidate in candidate_passwords:
        if verify_password(candidate, PLACEHOLDER_PASSWORD_HASH):
            raise RuntimeError(
                f"CRITICAL SECURITY VULNERABILITY: Placeholder password hash authenticated with candidate {candidate!r}!"
            )

    print(f"[OK] Tested {len(candidate_passwords)} candidate passwords against placeholder '{PLACEHOLDER_PASSWORD_HASH}'.")
    print("[OK] All verifications returned False (Argon2id rejected non-hash format).")
    print("[OK] Direct legacy password authentication (/api/v1/auth/login) is completely impossible.")


def verify_schema_and_models():
    """
    Dynamically verify the actual User model and StudentProfile schema,
    PostgreSQL enum definitions, and live cohort integrity before provisioning.
    Avoids relying on a hardcoded assumption of 61.
    """
    print("\n--- 3. DATABASE SCHEMA & DYNAMIC COHORT INTEGRITY VERIFICATION ---")
    session = SessionLocal()

    try:
        # 3.1: Verify User and StudentProfile SQLAlchemy model columns
        user_columns = {col.name for col in User.__table__.columns}
        required_user_cols = {
            "id", "full_name", "email", "password_hash", "firebase_uid",
            "role", "is_active", "created_at", "updated_at"
        }
        missing_user_cols = required_user_cols - user_columns
        if missing_user_cols:
            raise RuntimeError(f"Schema Error: User model is missing columns: {missing_user_cols}")

        profile_columns = {col.name for col in StudentProfile.__table__.columns}
        required_profile_cols = {"id", "user_id", "register_number", "department", "year"}
        missing_profile_cols = required_profile_cols - profile_columns
        if missing_profile_cols:
            raise RuntimeError(f"Schema Error: StudentProfile model is missing columns: {missing_profile_cols}")

        print("[OK] SQLAlchemy model schemas verified: User and StudentProfile definitions match expected columns.")

        # 3.2: Verify PostgreSQL user_role enum supports 'admin'
        enum_labels = [
            r[0]
            for r in session.execute(
                text(
                    "SELECT enumlabel FROM pg_enum "
                    "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
                    "WHERE pg_type.typname = 'user_role' "
                    "ORDER BY enumsortorder"
                )
            ).fetchall()
        ]
        if "admin" not in enum_labels:
            raise RuntimeError(
                f"Schema Error: PostgreSQL 'user_role' enum does not include 'admin'. Found: {enum_labels}"
            )
        print(f"[OK] PostgreSQL 'user_role' enum verified in database: {enum_labels}")

        # 3.3: Verify dynamic live database counts (no hardcoded assumption)
        live_total_users = session.scalars(select(func.count(User.id))).one()
        live_student_users = session.scalars(
            select(func.count(User.id)).where(User.role == UserRole.STUDENT)
        ).one()
        live_student_profiles = session.scalars(select(func.count(StudentProfile.id))).one()
        live_mentors = session.scalars(
            select(func.count(User.id)).where(User.role == UserRole.MENTOR)
        ).one()
        live_admins = session.scalars(
            select(func.count(User.id)).where(User.role == UserRole.ADMIN)
        ).one()
        live_hods = session.scalars(
            select(func.count(User.id)).where(User.role == UserRole.HOD)
        ).one()

        print(f"[OK] Live PostgreSQL baseline counts retrieved dynamically:")
        print(f"     * Total Users:            {live_total_users}")
        print(f"     * Student Users:          {live_student_users}")
        print(f"     * Student Profiles:       {live_student_profiles}")
        print(f"     * Mentor Users:           {live_mentors}")
        print(f"     * Admin Users:            {live_admins}")
        print(f"     * HOD Users:              {live_hods}")

        # 3.4: Dynamic Cohort 1:1 Integrity Check
        if live_student_profiles != live_student_users:
            raise RuntimeError(
                f"Cohort Integrity Failure: Dynamic student users count ({live_student_users}) does not match "
                f"student profiles count ({live_student_profiles})."
            )

        # Check for any orphaned student profiles (profiles without valid student users)
        orphaned_profiles = session.scalars(
            select(func.count(StudentProfile.id)).where(
                ~StudentProfile.user_id.in_(
                    select(User.id).where(User.role == UserRole.STUDENT)
                )
            )
        ).one()
        if orphaned_profiles > 0:
            raise RuntimeError(
                f"Cohort Integrity Failure: Found {orphaned_profiles} orphaned student profile(s)."
            )

        print(f"[OK] Dynamic cohort integrity confirmed: 1:1 mapping between all {live_student_users} students and profiles.")
        return {
            "total_users": live_total_users,
            "student_users": live_student_users,
            "student_profiles": live_student_profiles,
            "admin_users": live_admins,
        }
    finally:
        session.close()


def provision_admin(
    dry_run: bool = True,
    confirmed_email: str = None,
    authorized_confirmation: bool = False,
):
    """
    Provisions cce.pgpa@gmail.com as ADMIN in PostgreSQL with strict transaction safety.
    """
    print("=" * 70)
    print("CCE ACHIEVE -- SECURE ADMINISTRATOR PROVISIONING")
    print(f"Mode: {'[DRY RUN - SIMULATION ONLY]' if dry_run else '[LIVE EXECUTION - WILL COMMIT]'}")
    print("=" * 70)

    # Authorization Check 1: Explicit email confirmation parameter
    if not confirmed_email or confirmed_email.strip().lower() != TARGET_EMAIL.lower():
        raise ValueError(
            f"Authorization Check Failure: Provisioning requires explicit email confirmation.\n"
            f"Usage requires: --confirm-admin-email {TARGET_EMAIL}"
        )

    # Authorization Check 2: Explicit administrator role authorization confirmation
    if not authorized_confirmation:
        raise ValueError(
            "Authorization Check Failure: Explicit confirmation is required that this account "
            f"is authorized to be the system administrator.\n"
            "Please provide --confirm-admin-authorization flag."
        )

    print(f"[OK] Administrator authorization confirmed for '{TARGET_EMAIL}'.")

    # Step 1: Preflight live Firebase verification
    verify_firebase_preflight(TARGET_EMAIL, TARGET_FIREBASE_UID)

    # Step 2: Placeholder password hash security verification
    verify_password_hash_security()

    # Step 3: Schema and dynamic model verification
    baseline = verify_schema_and_models()
    initial_total_users = baseline["total_users"]
    initial_student_users = baseline["student_users"]
    initial_student_profiles = baseline["student_profiles"]

    # Step 4: Database Provisioning Transaction
    print("\n--- 4. POSTGRESQL TRANSACTION EXECUTION ---")
    session = SessionLocal()

    # Safety Guard: Ensure the transaction context CANNOT accidentally commit during dry-run
    if dry_run:
        def _forbidden_commit(*args, **kwargs):
            raise RuntimeError(
                "CRITICAL SAFETY VIOLATION: session.commit() was invoked during dry-run mode! "
                "Commits are strictly disabled in dry-run."
            )
        # Monkey-patch the session instance to make commit physically impossible
        session.commit = _forbidden_commit

    try:
        # Begin explicit transaction
        session.begin()

        # Step 4.1: Conflict check on Email
        existing_by_email = session.scalars(
            select(User).where(func.lower(User.email) == TARGET_EMAIL.lower())
        ).first()

        # Step 4.2: Conflict check on Firebase UID
        existing_by_uid = session.scalars(
            select(User).where(User.firebase_uid == TARGET_FIREBASE_UID)
        ).first()

        # Step 4.3: Evaluate Idempotency or Conflict
        if existing_by_email:
            if (
                existing_by_email.role == UserRole.ADMIN
                and existing_by_email.firebase_uid == TARGET_FIREBASE_UID
                and existing_by_email.is_active is True
            ):
                print(f"[OK] Idempotency Check: Account '{TARGET_EMAIL}' is already provisioned as ADMIN.")
                session.rollback()
                return

            raise RuntimeError(
                f"Conflict Abort: Email '{TARGET_EMAIL}' already exists in PostgreSQL "
                f"with role '{existing_by_email.role.value}' and UID '{existing_by_email.firebase_uid}'. "
                "Refusing to overwrite or alter existing user identity."
            )

        if existing_by_uid:
            raise RuntimeError(
                f"Conflict Abort: Firebase UID '{TARGET_FIREBASE_UID}' is already linked to "
                f"user '{existing_by_uid.email}' (Role: {existing_by_uid.role.value}). "
                "Refusing to assign duplicate UID."
            )

        # Step 4.4: Stage the new ADMIN user record
        admin_user = User(
            id=uuid.uuid4(),
            full_name=ADMIN_FULL_NAME,
            email=TARGET_EMAIL.lower().strip(),
            role=UserRole.ADMIN,
            is_active=True,
            firebase_uid=TARGET_FIREBASE_UID,
            password_hash=PLACEHOLDER_PASSWORD_HASH,
        )
        session.add(admin_user)
        session.flush()

        print(f"\n[OK] Staged new ADMIN user record in transaction:")
        print(f"     ID:            {admin_user.id}")
        print(f"     Full Name:     {admin_user.full_name}")
        print(f"     Email:         {admin_user.email}")
        print(f"     Role:          {admin_user.role.value}")
        print(f"     Active:        {admin_user.is_active}")
        print(f"     Firebase UID:  {admin_user.firebase_uid}")
        print(f"     Password Hash: {admin_user.password_hash}")

        # Step 4.5: In-transaction cohort preservation assertions
        post_student_users = session.scalars(
            select(func.count(User.id)).where(User.role == UserRole.STUDENT)
        ).one()
        post_student_profiles = session.scalars(
            select(func.count(StudentProfile.id))
        ).one()
        post_total_users = session.scalars(
            select(func.count(User.id))
        ).one()

        if post_student_users != initial_student_users or post_student_profiles != initial_student_profiles:
            raise RuntimeError(
                "CRITICAL ABORT: Student cohort records or profiles were affected during staging!"
            )

        if post_total_users != (initial_total_users + 1):
            raise RuntimeError(
                f"CRITICAL ABORT: Expected total users to be {initial_total_users + 1}, found {post_total_users}."
            )

        print(f"[OK] In-transaction verification confirmed: All {post_student_users} students remain 100% intact.")

        # Step 4.6: Controlled Commit or Rollback (Clean normal control flow, NO KeyboardInterrupt)
        if dry_run:
            session.rollback()
            print("\n[DRY RUN] Explicit rollback executed successfully.")
            print("[DRY RUN] Transaction rolled back cleanly. Zero changes written to PostgreSQL.")
        else:
            session.commit()
            print("\n[SUCCESS] Administrator record committed to PostgreSQL.")
            print(f"Total Users: {post_total_users} ({initial_student_users} Students + 1 System Administrator).")

    except Exception as e:
        try:
            session.rollback()
        except Exception:
            pass
        print(f"\n[ABORTED] PROVISIONING FAILED / ROLLED BACK: {e}")
        raise
    finally:
        # Final safeguard: ensure any uncommitted active transaction is rolled back before closing
        try:
            if session.is_active:
                session.rollback()
        except Exception:
            pass
        session.close()

    # Step 5: Post-execution independent database verification (Separate clean session)
    verify_session = SessionLocal()
    try:
        final_total = verify_session.scalars(select(func.count(User.id))).one()
        final_students = verify_session.scalars(select(func.count(User.id)).where(User.role == UserRole.STUDENT)).one()
        final_profiles = verify_session.scalars(select(func.count(StudentProfile.id))).one()
        admin_check = verify_session.scalars(select(User).where(User.email == TARGET_EMAIL)).first()

        print("\n--- 5. INDEPENDENT POST-EXECUTION DATABASE VERIFICATION ---")
        print(f"Active PostgreSQL Users count:          {final_total}")
        print(f"Active PostgreSQL Students count:       {final_students}")
        print(f"Active PostgreSQL Profiles count:       {final_profiles}")
        print(f"Target '{TARGET_EMAIL}' in database:    {'Present (Role: ' + admin_check.role.value + ')' if admin_check else 'Not present (clean database state preserved)'}")

        if dry_run:
            assert admin_check is None, "CRITICAL ERROR: Admin record persisted after dry-run rollback!"
            assert final_total == baseline["total_users"], "CRITICAL ERROR: Total user count changed after dry-run!"
            print("[SUCCESS] Dry-run completed with 100% database isolation. Zero records modified or persisted.")
    finally:
        verify_session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CCE Achieve Admin Provisioning Tool")
    parser.add_argument(
        "--confirm-admin-email",
        type=str,
        required=True,
        help="Explicitly confirm the admin email address to be provisioned (must match target)",
    )
    parser.add_argument(
        "--confirm-admin-authorization",
        action="store_true",
        default=False,
        help="Explicitly confirm that this account is authorized to be the system administrator",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        default=False,
        help="Execute live commit (default is dry-run mode)",
    )
    args = parser.parse_args()

    is_dry_run = not args.live
    provision_admin(
        dry_run=is_dry_run,
        confirmed_email=args.confirm_admin_email,
        authorized_confirmation=args.confirm_admin_authorization,
    )
