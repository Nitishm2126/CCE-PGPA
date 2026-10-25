"""
Safe, idempotent maintenance utility to inspect and safely clean up orphaned test/fixture accounts.

Safety invariants:
- Default is DRY RUN (inspects without deleting).
- Deletion requires explicit --confirm-delete flag.
- Refuses to touch any account with an official StudentProfile.
- Refuses to touch any account with achievements/submissions.
- Refuses to touch any institutional domain (@sairamtap.edu.in, @sairam.edu.in).
- Preserves referential integrity by cleaning referencing audit_logs before user deletion.
"""

import argparse
import sys
import uuid
from pathlib import Path
from typing import List, Dict, Any

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, text
from app.db.session import SessionLocal
from app.models.user import User, StudentProfile, UserRole
from app.models.achievement import Achievement
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog


KNOWN_TARGET_EMAILS = [
    "atk_st_e3c0da@test.edu",
    "student_a_291838@test.edu",
    "student_b_291838@test.edu",
    "victim_e3c0da@test.edu",
    "adm_rst_291838@test.edu",
]


def audit_and_cleanup(confirm_delete: bool = False) -> int:
    db = SessionLocal()
    try:
        print("=" * 70)
        print("CCE-PGPA Maintenance: Test Account Safety Audit & Cleanup Utility")
        print("=" * 70)
        mode = "LIVE EXECUTION" if confirm_delete else "DRY RUN (Read-Only)"
        print(f"Mode: {mode}\n")

        # 1. Query candidate test users
        users: List[User] = (
            db.query(User)
            .filter(
                (User.email.in_(KNOWN_TARGET_EMAILS)) | (User.email.ilike("%@test.edu"))
            )
            .all()
        )

        if not users:
            print("No test accounts found in the database. System is clean!")
            return 0

        print(f"Found {len(users)} test/fixture user candidate(s):")
        print("-" * 70)

        candidates_to_delete: List[Dict[str, Any]] = []

        for u in users:
            # Check domain guard
            domain = u.email.split("@")[-1].lower() if "@" in u.email else ""
            if domain in ["sairamtap.edu.in", "sairam.edu.in"]:
                print(f"[PROTECTED] Skipping institutional user: {u.email} (ID: {u.id})")
                continue

            # Check StudentProfile guard
            sp = db.query(StudentProfile).filter(StudentProfile.user_id == u.id).first()
            if sp:
                print(f"[PROTECTED] User {u.email} has active StudentProfile (Reg: {sp.register_number}). Skipping.")
                continue

            # Check Submissions guard
            ach_count = db.query(Achievement).filter(Achievement.student_id == u.id).count()
            if ach_count > 0:
                print(f"[PROTECTED] User {u.email} has {ach_count} active achievement(s). Skipping.")
                continue

            # Check Mentor Assignments
            mentor_assign_count = db.query(MentorAssignment).filter(
                (MentorAssignment.student_id == u.id) | (MentorAssignment.mentor_id == u.id)
            ).count()

            # Check Audit Logs
            user_str_id = str(u.id)
            audit_count = db.query(AuditLog).filter(
                (AuditLog.actor_id == u.id) | (AuditLog.target_id == user_str_id)
            ).count()

            print(f"User: {u.full_name} | Email: {u.email} | Role: {u.role.value}")
            print(f"  ID: {u.id}")
            print(f"  Profile: None | Achievements: 0 | Mentor Allocations: {mentor_assign_count} | Audit Logs: {audit_count}")

            candidates_to_delete.append({
                "user": u,
                "user_id": u.id,
                "user_str_id": user_str_id,
                "email": u.email,
                "audit_count": audit_count,
            })

        print("-" * 70)
        print(f"Verified Safe Cleanup Candidates: {len(candidates_to_delete)} account(s)")

        if not confirm_delete:
            print("\n[DRY RUN SUMMARY]")
            print("No records were deleted.")
            print("To safely clean up these verified test accounts, re-run with:")
            print("    python scripts/cleanup_test_accounts.py --confirm-delete")
            return 0

        # 2. Execute deletion within atomic transaction
        print("\n[EXECUTING CLEANUP]")
        target_uuids = [c["user_id"] for c in candidates_to_delete]
        target_str_ids = [c["user_str_id"] for c in candidates_to_delete]

        # Step 2a: Remove referencing audit logs
        deleted_audits = (
            db.query(AuditLog)
            .filter(
                (AuditLog.actor_id.in_(target_uuids)) | (AuditLog.target_id.in_(target_str_ids))
            )
            .delete(synchronize_session=False)
        )
        print(f"  - Deleted {deleted_audits} referencing audit log entry/entries.")

        # Step 2b: Remove test users
        deleted_users = (
            db.query(User)
            .filter(User.id.in_(target_uuids))
            .delete(synchronize_session=False)
        )
        print(f"  - Deleted {deleted_users} test user account(s).")

        db.commit()
        print("\nCleanup completed successfully! Transaction committed.")
        return 0

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] An error occurred during audit/cleanup: {e}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit and safely clean up test accounts in CCE-PGPA.")
    parser.add_argument(
        "--confirm-delete",
        action="store_true",
        help="Execute the permanent deletion of verified test accounts after safety checks.",
    )
    args = parser.parse_args()
    sys.exit(audit_and_cleanup(confirm_delete=args.confirm_delete))
