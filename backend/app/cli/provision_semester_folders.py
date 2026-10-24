"""
CCE Achieve -- Student Semester Folders Provisioning Tool
Location: backend/app/cli/provision_semester_folders.py

Authorized administrative CLI command to idempotently audit and provision
Semester 1, Semester 2, and Semester 3 Google Drive subfolders for all existing students.

Hierarchy:
CCE-PGPA Evidence/
├── {REGISTER_NUMBER}_{STUDENT_NAME}/
│   ├── Semester 1/
│   ├── Semester 2/
│   └── Semester 3/
└── ...

Guarantees:
1. Idempotency: Never creates duplicate folders or mappings. Reuses existing folders in Drive.
2. Safe Rate Limits: Paces Drive API write requests with backoff retry on transient errors.
3. Student Folder Preservation: Reuses mapped student parent folders; never alters or deletes existing files.
4. Security: Does not expose OAuth refresh tokens or secrets in stdout or logs.
"""

import argparse
import logging
import sys
import time
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import func, select
from app.db.session import SessionLocal
from app.models.semester import Semester
from app.models.semester_folder import StudentSemesterFolder
from app.models.user import StudentProfile, User, UserRole
from app.services.drive_provisioning import (
    audit_student_semester_folders,
    create_folder_with_retry,
)
from app.services.drive_service import get_drive_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("provision_semester_folders")


def run_provisioning(
    target_semesters: list[int] = [1, 2, 3],
    dry_run: bool = True,
    batch_size: int = 10,
    pace_seconds: float = 0.15,
) -> dict:
    mode_str = "DRY-RUN (SIMULATION)" if dry_run else "LIVE EXECUTION"
    print("\n" + "=" * 70)
    print(f"CCE-PGPA GOOGLE DRIVE SEMESTER FOLDER PROVISIONING -- {mode_str}")
    print("=" * 70)

    session = SessionLocal()
    try:
        ds = get_drive_service()
        if not ds.is_configured:
            print("ERROR: Google Drive integration is not configured or authorized.")
            sys.exit(1)

        conn = ds.verify_connectivity()
        if not conn.get("connected"):
            print(f"ERROR: Google Drive connectivity verification failed: {conn.get('message')}")
            sys.exit(1)

        print(f"Authorized Drive Account : {conn.get('authorized_email')}")
        print(f"Root Evidence Folder ID  : {conn.get('root_folder_id')}")
        print(f"Target Semesters         : {target_semesters}")

        # Fetch active semester entities
        semesters = session.scalars(
            select(Semester)
            .where(Semester.semester_number.in_(target_semesters))
            .order_by(Semester.semester_number.asc())
        ).all()
        semester_map = {s.semester_number: s for s in semesters}

        missing_sems = [n for n in target_semesters if n not in semester_map]
        if missing_sems:
            print(f"WARNING: Semesters {missing_sems} not found in database 'semesters' table.")

        # Step 1: Run read-only audit
        print("\nPhase 1: Auditing student folders and existing Drive subfolders...")
        audit = audit_student_semester_folders(session, ds, target_semesters)
        total_students = audit["total_students"]
        print(f"Found {total_students} student accounts in PostgreSQL.")

        # Step 2: Provisioning loop
        print(f"\nPhase 2: Processing students in batches of {batch_size} (pacing: {pace_seconds}s)...")
        already_mapped_count = 0
        reused_count = 0
        created_count = 0
        failed_count = 0

        for idx, st in enumerate(audit["students"], start=1):
            student_id = st["student_id"]
            reg_no = st["register_number"]
            name = st["student_name"]
            student_folder_id = st["existing_student_folder_id"]

            if not student_folder_id:
                print(f"  [{idx:02d}/{total_students}] {reg_no} ({name}): FAILED - Student parent folder missing!")
                failed_count += len(target_semesters)
                continue

            for sem_stat in st["semesters"]:
                sem_num = sem_stat["semester_number"]
                sem_obj = semester_map.get(sem_num)
                if not sem_obj:
                    continue

                folder_name = f"Semester {sem_num}"
                current_status = sem_stat["status"]
                existing_folder_id = sem_stat["folder_id"]

                # Case 1: Already mapped in DB
                if current_status == "EXISTS_MAPPED":
                    already_mapped_count += 1
                    continue

                # Case 2: Dry Run Mode
                if dry_run:
                    if current_status == "EXISTS_IN_DRIVE":
                        reused_count += 1
                        print(f"  [{idx:02d}/{total_students}] {reg_no} -> {folder_name}: [DRY RUN] Would link existing Drive folder ({existing_folder_id})")
                    else:
                        created_count += 1
                        print(f"  [{idx:02d}/{total_students}] {reg_no} -> {folder_name}: [DRY RUN] Would create new folder under parent {student_folder_id[:8]}...")
                    continue

                # Case 3: Live Execution
                try:
                    target_folder_id = existing_folder_id
                    action = "REUSED_EXISTING"

                    if not target_folder_id:
                        target_folder_id = create_folder_with_retry(ds, folder_name, student_folder_id)
                        action = "CREATED"
                        if pace_seconds > 0:
                            time.sleep(pace_seconds)

                    # Upsert DB mapping
                    mapping = session.scalar(
                        select(StudentSemesterFolder).where(
                            StudentSemesterFolder.student_id == student_id,
                            StudentSemesterFolder.semester_id == sem_obj.id,
                        )
                    )
                    if not mapping:
                        import uuid
                        mapping = StudentSemesterFolder(
                            id=uuid.uuid4(),
                            student_id=student_id,
                            semester_id=sem_obj.id,
                            drive_folder_id=target_folder_id,
                            drive_folder_name=folder_name,
                        )
                        session.add(mapping)
                    else:
                        mapping.drive_folder_id = target_folder_id
                        mapping.drive_folder_name = folder_name
                    session.commit()

                    if action == "CREATED":
                        created_count += 1
                        print(f"  [{idx:02d}/{total_students}] {reg_no} -> {folder_name}: CREATED ({target_folder_id[:12]}...)")
                    else:
                        reused_count += 1
                        print(f"  [{idx:02d}/{total_students}] {reg_no} -> {folder_name}: LINKED EXISTING ({target_folder_id[:12]}...)")

                except Exception as exc:
                    session.rollback()
                    failed_count += 1
                    print(f"  [{idx:02d}/{total_students}] {reg_no} -> {folder_name}: ERROR - {exc}")

            # Small batch break if needed
            if idx % batch_size == 0 and not dry_run:
                print(f"  -- Progress: Processed batch {idx // batch_size} ({idx}/{total_students} students) --")
                time.sleep(0.5)

        # Step 3: Final Verification
        db_total_mappings = session.scalar(select(func.count(StudentSemesterFolder.id)))

        print("\n" + "=" * 70)
        print("SUMMARY RESULTS")
        print("=" * 70)
        print(f"Mode                     : {mode_str}")
        print(f"Total Students Processed : {total_students}")
        print(f"Target Semesters         : {target_semesters}")
        print(f"Total Folders Evaluated  : {total_students * len(target_semesters)}")
        print(f"Already Mapped           : {already_mapped_count}")
        print(f"Existing Reused / Linked : {reused_count}")
        print(f"Folders Created          : {created_count}")
        print(f"Failures                 : {failed_count}")
        print(f"Database Mappings in DB  : {db_total_mappings}")
        print("=" * 70 + "\n")

        return {
            "dry_run": dry_run,
            "total_students": total_students,
            "target_semesters": target_semesters,
            "already_mapped": already_mapped_count,
            "reused": reused_count,
            "created": created_count,
            "failed": failed_count,
            "db_total_mappings": db_total_mappings,
        }
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="CCE-PGPA Student Semester Folder Provisioning Tool")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Execute actual Google Drive folder creation and commit PostgreSQL mappings. (Default is dry-run)",
    )
    parser.add_argument(
        "--semesters",
        type=int,
        nargs="+",
        default=[1, 2, 3],
        help="Target semester numbers to provision (default: 1 2 3)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Batch size for progress tracking (default: 10)",
    )
    parser.add_argument(
        "--pace",
        type=float,
        default=0.15,
        help="Pacing sleep between Drive API folder creates in seconds (default: 0.15)",
    )
    args = parser.parse_args()

    run_provisioning(
        target_semesters=args.semesters,
        dry_run=not args.live,
        batch_size=args.batch_size,
        pace_seconds=args.pace,
    )


if __name__ == "__main__":
    main()
