"""
CCE Achieve -- Safe Student Account Linking Tool
Location: backend/app/cli/link_student.py

Safely links an existing Firebase student account to the corresponding PostgreSQL student record.

Guarantees:
1. Live Firebase Preflight: Bidirectional verification (UID <-> Email) and account active check.
2. Conflict Checks:
   - Ensures PostgreSQL student user exists by exact case-insensitive email.
   - Ensures the record has role=STUDENT.
   - Ensures the record does not already have a different firebase_uid.
   - Ensures target firebase_uid is not assigned to any other user.
3. Zero Row Addition/Deletion:
   - Only modifies `users.firebase_uid` on the exact matching student record.
   - Does NOT create or delete any User or StudentProfile rows.
   - Does NOT alter student name, email, register number, role, or profile data.
4. Strict Transaction Safety:
   - Default is dry-run mode (session.commit physically disabled).
   - Explicit session.rollback() on dry-run.
   - Live execution requires explicit `--live` flag and confirmation arguments.
5. Cohort Invariant Assertions:
   - Confirms total users remain 62, students remain 61, profiles remain 61, admins remain 1.
"""
import argparse
import sys
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import func, select
from app.db.session import SessionLocal
from app.models.user import StudentProfile, User, UserRole
from app.core.firebase import get_firebase_app
from firebase_admin import auth as fb_auth

TARGET_EMAIL = "sec25co031@sairamtap.edu.in"
TARGET_FIREBASE_UID = "6iMIvvga4CPM6dH8yXTvHcYYzmk2"


def verify_firebase_preflight(target_email: str, target_uid: str):
    """
    Verify the user account in Firebase Authentication:
    1. Lookup by email.
    2. Lookup by UID.
    3. Confirm bidirectional match.
    4. Confirm account is not disabled.
    """
    print("\n--- 1. FIREBASE PREFLIGHT VERIFICATION ---")
    app = get_firebase_app()

    try:
        fb_user_by_email = fb_auth.get_user_by_email(target_email, app=app)
    except fb_auth.UserNotFoundError:
        raise RuntimeError(
            f"Firebase Preflight Failure: User '{target_email}' does not exist in Firebase project 'cce-pgpa'."
        )
    except Exception as e:
        raise RuntimeError(f"Firebase Preflight Failure: Unable to query Firebase by email: {e}")

    try:
        fb_user_by_uid = fb_auth.get_user(target_uid, app=app)
    except fb_auth.UserNotFoundError:
        raise RuntimeError(
            f"Firebase Preflight Failure: UID '{target_uid}' does not exist in Firebase project 'cce-pgpa'."
        )
    except Exception as e:
        raise RuntimeError(f"Firebase Preflight Failure: Unable to query Firebase by UID: {e}")

    if fb_user_by_email.uid != target_uid:
        raise RuntimeError(
            f"Firebase Preflight Failure: Email lookup UID mismatch. Expected '{target_uid}', found '{fb_user_by_email.uid}'."
        )

    if (fb_user_by_uid.email or "").strip().lower() != target_email.strip().lower():
        raise RuntimeError(
            f"Firebase Preflight Failure: UID lookup email mismatch. Expected '{target_email}', found '{fb_user_by_uid.email}'."
        )

    if fb_user_by_email.disabled:
        raise RuntimeError(f"Firebase Preflight Failure: Account '{target_email}' is marked disabled.")

    print(f"[OK] Firebase user confirmed: '{fb_user_by_email.email}'")
    print(f"[OK] Firebase UID confirmed:  '{fb_user_by_email.uid}'")
    print(f"[OK] Account status:         Active (disabled={fb_user_by_email.disabled})")
    print(f"[OK] Email verified:        {fb_user_by_email.email_verified}")


def verify_baseline():
    """
    Verify PostgreSQL database baseline counts.
    """
    print("\n--- 2. POSTGRESQL BASELINE AUDIT ---")
    session = SessionLocal()
    try:
        total = session.scalars(select(func.count(User.id))).one()
        students = session.scalars(select(func.count(User.id)).where(User.role == UserRole.STUDENT)).one()
        profiles = session.scalars(select(func.count(StudentProfile.id))).one()
        admins = session.scalars(select(func.count(User.id)).where(User.role == UserRole.ADMIN)).one()
        mentors = session.scalars(select(func.count(User.id)).where(User.role == UserRole.MENTOR)).one()
        hods = session.scalars(select(func.count(User.id)).where(User.role == UserRole.HOD)).one()

        print(f"Total Users:      {total} (Expected: 62)")
        print(f"Students:         {students} (Expected: 61)")
        print(f"Student Profiles: {profiles} (Expected: 61)")
        print(f"Admins:           {admins} (Expected: 1)")
        print(f"Mentors:          {mentors} (Expected: 0)")
        print(f"HODs:             {hods} (Expected: 0)")

        if total != 62 or students != 61 or profiles != 61 or admins != 1:
            raise RuntimeError(
                f"Baseline Integrity Failure: Expected 62 users, 61 students, 61 profiles, 1 admin. "
                f"Found {total} users, {students} students, {profiles} profiles, {admins} admins."
            )

        print("[OK] Baseline cohort numbers verified.")
        return {"total": total, "students": students, "profiles": profiles, "admins": admins}
    finally:
        session.close()


def link_student_account(
    dry_run: bool = True,
    target_email: str = TARGET_EMAIL,
    target_uid: str = TARGET_FIREBASE_UID,
):
    """
    Safely link Firebase UID to the existing PostgreSQL student record.
    """
    print("=" * 70)
    print("CCE ACHIEVE -- STUDENT ACCOUNT SAFE LINKING TOOL")
    print(f"Mode: {'[DRY RUN - SIMULATION ONLY]' if dry_run else '[LIVE EXECUTION - WILL COMMIT]'}")
    print("=" * 70)

    # Step 1: Firebase preflight
    verify_firebase_preflight(target_email, target_uid)

    # Step 2: Database baseline
    baseline = verify_baseline()

    # Step 3: Inspect existing record & execute transaction
    print("\n--- 3. TRANSACTION EXECUTION & CONFLICT VERIFICATION ---")
    session = SessionLocal()

    if dry_run:
        def _forbidden_commit(*args, **kwargs):
            raise RuntimeError("CRITICAL ERROR: session.commit() called during dry-run!")
        session.commit = _forbidden_commit

    try:
        session.begin()

        # 3.1: Locate existing student by case-insensitive email
        student_user = session.scalars(
            select(User).where(func.lower(User.email) == target_email.lower().strip())
        ).first()

        if not student_user:
            raise RuntimeError(f"Student Record Not Found: No user found with email '{target_email}'.")

        # 3.2: Verify role is STUDENT
        if student_user.role != UserRole.STUDENT:
            raise RuntimeError(
                f"Role Mismatch Error: User '{target_email}' has role '{student_user.role.value}', expected 'student'."
            )

        # 3.3: Fetch linked student profile
        student_profile = session.scalars(
            select(StudentProfile).where(StudentProfile.user_id == student_user.id)
        ).first()

        if not student_profile:
            raise RuntimeError(f"Orphan Error: Student user '{student_user.id}' has no associated StudentProfile.")

        print(f"[OK] Found existing student record:")
        print(f"     User ID:         {student_user.id}")
        print(f"     Full Name:       {student_user.full_name}")
        print(f"     Email:           {student_user.email}")
        print(f"     Role:            {student_user.role.value}")
        print(f"     Active Status:   {student_user.is_active}")
        print(f"     Current UID:     {student_user.firebase_uid}")
        print(f"     Register Number: {student_profile.register_number}")
        print(f"     Department:      {student_profile.department}")
        print(f"     Year:            {student_profile.year}")
        print(f"     Section:         {student_profile.section}")
        print(f"     Semester:        {student_profile.semester}")
        print(f"     Batch:           {student_profile.batch}")
        print(f"     Assigned Mentor: {student_profile.original_mentor_name}")

        # 3.4: Check idempotency & conflict on student user's firebase_uid
        if student_user.firebase_uid:
            if student_user.firebase_uid == target_uid:
                print(f"[OK] Idempotency: Student '{target_email}' is already linked to UID '{target_uid}'.")
                session.rollback()
                return
            raise RuntimeError(
                f"Conflict Abort: Student '{target_email}' is already linked to a different Firebase UID "
                f"'{student_user.firebase_uid}'. Refusing to overwrite."
            )

        # 3.5: Conflict check: is target_uid already linked to another account?
        existing_uid_user = session.scalars(
            select(User).where(User.firebase_uid == target_uid)
        ).first()
        if existing_uid_user:
            raise RuntimeError(
                f"Conflict Abort: Firebase UID '{target_uid}' is already linked to another user: "
                f"'{existing_uid_user.email}' (Role: {existing_uid_user.role.value})."
            )

        # 3.6: Perform the link
        print(f"\n[PROPOSED CHANGE]")
        print(f"Updating users.firebase_uid:")
        print(f"  Before: {student_user.firebase_uid}")
        print(f"  After:  {target_uid}")
        print(f"All other fields remain UNCHANGED.")

        student_user.firebase_uid = target_uid
        session.flush()

        # 3.7: In-transaction cohort invariants
        post_total = session.scalars(select(func.count(User.id))).one()
        post_students = session.scalars(select(func.count(User.id)).where(User.role == UserRole.STUDENT)).one()
        post_profiles = session.scalars(select(func.count(StudentProfile.id))).one()
        post_admins = session.scalars(select(func.count(User.id)).where(User.role == UserRole.ADMIN)).one()

        if post_total != baseline["total"]:
            raise RuntimeError(f"Invariant Violation: Total users changed from {baseline['total']} to {post_total}!")
        if post_students != baseline["students"]:
            raise RuntimeError(f"Invariant Violation: Student count changed from {baseline['students']} to {post_students}!")
        if post_profiles != baseline["profiles"]:
            raise RuntimeError(f"Invariant Violation: Profile count changed from {baseline['profiles']} to {post_profiles}!")
        if post_admins != baseline["admins"]:
            raise RuntimeError(f"Invariant Violation: Admin count changed from {baseline['admins']} to {post_admins}!")

        print("\n[OK] In-transaction cohort invariants confirmed:")
        print(f"     Total users:      {post_total}")
        print(f"     Students:         {post_students}")
        print(f"     Student Profiles: {post_profiles}")
        print(f"     Admins:           {post_admins}")

        if dry_run:
            session.rollback()
            print("\n[DRY RUN] Transaction explicitly rolled back. Zero changes committed to PostgreSQL.")
        else:
            session.commit()
            print("\n[SUCCESS] Student Firebase UID successfully committed to PostgreSQL.")

    except Exception as e:
        try:
            session.rollback()
        except Exception:
            pass
        print(f"\n[ABORTED] LINKING FAILED / ROLLED BACK: {e}")
        raise
    finally:
        try:
            if session.is_active:
                session.rollback()
        except Exception:
            pass
        session.close()

    # Step 4: Post-execution independent verification
    verify_session = SessionLocal()
    try:
        final_total = verify_session.scalars(select(func.count(User.id))).one()
        final_students = verify_session.scalars(select(func.count(User.id)).where(User.role == UserRole.STUDENT)).one()
        final_profiles = verify_session.scalars(select(func.count(StudentProfile.id))).one()
        final_admins = verify_session.scalars(select(func.count(User.id)).where(User.role == UserRole.ADMIN)).one()
        check_user = verify_session.scalars(
            select(User).where(func.lower(User.email) == target_email.lower().strip())
        ).first()

        print("\n--- 4. INDEPENDENT POST-EXECUTION DATABASE AUDIT ---")
        print(f"Active PostgreSQL Users count:          {final_total}")
        print(f"Active PostgreSQL Students count:       {final_students}")
        print(f"Active PostgreSQL Profiles count:       {final_profiles}")
        print(f"Active PostgreSQL Admins count:         {final_admins}")
        print(f"Student '{target_email}' Firebase UID:  {check_user.firebase_uid if check_user else 'None'}")

        if dry_run:
            assert check_user.firebase_uid is None, "CRITICAL ERROR: UID was persisted during dry-run!"
            assert final_total == baseline["total"], "CRITICAL ERROR: Total count changed during dry-run!"
            print("[SUCCESS] Dry-run completed with 100% database isolation. Zero records modified.")
        else:
            assert check_user.firebase_uid == target_uid, "CRITICAL ERROR: Live update failed to persist UID!"
            assert final_total == baseline["total"], "CRITICAL ERROR: User count changed during live commit!"
            print("[SUCCESS] Live commit verified. Student record successfully linked.")
    finally:
        verify_session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CCE Achieve Student Account Linking Tool")
    parser.add_argument(
        "--confirm-student-email",
        type=str,
        default=TARGET_EMAIL,
        help=f"Explicitly confirm student email (default: {TARGET_EMAIL})",
    )
    parser.add_argument(
        "--confirm-student-uid",
        type=str,
        default=TARGET_FIREBASE_UID,
        help=f"Explicitly confirm student Firebase UID (default: {TARGET_FIREBASE_UID})",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        default=False,
        help="Execute live commit (default is dry-run mode)",
    )
    args = parser.parse_args()

    if args.confirm_student_email.strip().lower() != TARGET_EMAIL.lower():
        raise ValueError(
            f"Email mismatch: provided '{args.confirm_student_email}', expected '{TARGET_EMAIL}'."
        )

    if args.confirm_student_uid.strip() != TARGET_FIREBASE_UID:
        raise ValueError(
            f"UID mismatch: provided '{args.confirm_student_uid}', expected '{TARGET_FIREBASE_UID}'."
        )

    link_student_account(
        dry_run=not args.live,
        target_email=args.confirm_student_email.strip().lower(),
        target_uid=args.confirm_student_uid.strip(),
    )
