import argparse
from collections import Counter
import csv
import logging
import re
import secrets
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, EmailStr, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

# Add backend directory to sys.path if invoked directly
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.security import get_password_hash
from app.db.session import SessionLocal, engine
from app.models.assignment import MentorAssignment
from app.models.user import MentorProfile, StudentProfile, User, UserRole

EXPECTED_STUDENT_COUNT = 61
EXPECTED_MENTOR_COUNT = 3
EXPECTED_HOD_COUNT = 1


class StaffRecord(BaseModel):
    role: str
    full_name: str
    email: EmailStr
    staff_id: str
    department: str = "CCE"
    designation: Optional[str] = None


class StudentRecord(BaseModel):
    register_number: str
    full_name: str
    email: EmailStr
    section: str
    mentor_reference: str
    semester: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    batch: Optional[str] = None


def clean_csv_lines(filepath: Path) -> List[Dict[str, str]]:
    """
    Reads a CSV file, skipping comments (#) and blank lines,
    stripping whitespace from all headers and field values.
    """
    if not filepath.is_file():
        raise FileNotFoundError(f"File not found: {filepath}")

    rows: List[Dict[str, str]] = []
    with open(filepath, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader((line for line in f if not line.strip().startswith("#") and line.strip()))
        if reader.fieldnames is None:
            raise ValueError(f"CSV file is empty or missing headers: {filepath}")
        
        # Clean fieldnames
        clean_headers = [h.strip() for h in reader.fieldnames if h]

        for line_num, raw_row in enumerate(reader, start=2):
            cleaned_row = {k.strip(): v.strip() for k, v in raw_row.items() if k is not None and v is not None}
            # Only add non-empty rows
            if any(cleaned_row.values()):
                rows.append(cleaned_row)

    return rows


def validate_staff_roster(
    raw_rows: List[Dict[str, str]],
    allow_missing_hod: bool = False,
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Validates staff roster records:
    - Exactly 1 HOD (unless allow_missing_hod is True, where 0 or 1 HOD is allowed)
    - Exactly 3 Mentors
    - Required fields, valid email format
    - Unique emails and staff IDs
    """
    errors: List[str] = []
    hod_record: Optional[Dict[str, Any]] = None
    mentor_records: List[Dict[str, Any]] = []

    seen_emails: set = set()
    seen_staff_ids: set = set()

    for idx, r in enumerate(raw_rows, start=1):
        role_raw = r.get("role", "").strip().lower()
        full_name = r.get("full_name", "").strip()
        email_raw = r.get("email", "").strip().lower()
        staff_id = r.get("staff_id", "").strip()
        department = r.get("department", "CCE").strip()
        designation = r.get("designation", "").strip()

        if not role_raw or not full_name or not email_raw or not staff_id:
            errors.append(f"Staff row {idx}: Missing required field(s) in {r}")
            continue

        try:
            StaffRecord(
                role=role_raw,
                full_name=full_name,
                email=email_raw,
                staff_id=staff_id,
                department=department,
                designation=designation,
            )
        except ValidationError as ve:
            errors.append(f"Staff row {idx} ({full_name}): Invalid format - {ve}")
            continue

        if email_raw in seen_emails:
            errors.append(f"Staff row {idx}: Duplicate email '{email_raw}'")
        seen_emails.add(email_raw)

        if staff_id in seen_staff_ids:
            errors.append(f"Staff row {idx}: Duplicate staff_id '{staff_id}'")
        seen_staff_ids.add(staff_id)

        record_data = {
            "role": role_raw,
            "full_name": full_name,
            "email": email_raw,
            "staff_id": staff_id,
            "department": department,
            "designation": designation,
        }

        if role_raw == "hod":
            if hod_record is not None:
                errors.append(f"Staff row {idx}: Multiple HOD records found. Only exactly {EXPECTED_HOD_COUNT} HOD is allowed.")
            hod_record = record_data
        elif role_raw == "mentor":
            mentor_records.append(record_data)
        else:
            errors.append(f"Staff row {idx}: Invalid role '{role_raw}'. Must be 'hod' or 'mentor'.")

    # Validate counts
    if hod_record is None and not allow_missing_hod:
        errors.append(f"Staff roster error: Missing HOD. Exactly {EXPECTED_HOD_COUNT} HOD is required.")

    if len(mentor_records) != EXPECTED_MENTOR_COUNT:
        errors.append(
            f"Staff roster error: Found {len(mentor_records)} mentors. Exactly {EXPECTED_MENTOR_COUNT} mentors are required."
        )

    if errors:
        raise ValueError("\n".join(errors))

    return hod_record, mentor_records


def validate_students_roster(
    raw_rows: List[Dict[str, str]],
    mentor_records: Optional[List[Dict[str, Any]]] = None,
    staff_emails: Optional[set] = None,
    allow_unassigned_mentors: bool = False,
    default_semester: str = "III SEM",
    default_department: str = "CCE",
    default_year: int = 2,
    default_batch: str = "2025-2029",
    expected_count: Optional[int] = EXPECTED_STUDENT_COUNT,
) -> List[Dict[str, Any]]:
    """
    Validates student roster records:
    - Exactly 61 students
    - Required fields, valid email format
    - Unique emails and register numbers
    - No email collision with staff
    - Valid mentor references:
      - If allow_unassigned_mentors is False: must match one of the validated mentors
      - If allow_unassigned_mentors is True: mentor_reference is preserved as original_mentor_name
    """
    errors: List[str] = []
    validated_students: List[Dict[str, Any]] = []

    if staff_emails is None:
        staff_emails = set()

    mentor_lookup: Dict[str, Dict[str, Any]] = {}
    if mentor_records:
        for m in mentor_records:
            mentor_lookup[m["email"].lower()] = m
            mentor_lookup[m["staff_id"].lower()] = m
            if "full_name" in m:
                mentor_lookup[m["full_name"].lower()] = m
    elif not allow_unassigned_mentors:
        errors.append("Staff mentor records are required unless allow_unassigned_mentors=True.")

    seen_emails: set = set()
    seen_register_numbers: set = set()

    for idx, r in enumerate(raw_rows, start=1):
        reg_no = r.get("register_number", "").strip()
        full_name = r.get("full_name", "").strip()
        email_raw = r.get("email", "").strip().lower()
        section = r.get("section", "").strip()
        mentor_ref = r.get("mentor_reference", "").strip()

        if not reg_no or not full_name or not email_raw or not section or not mentor_ref:
            errors.append(f"Student row {idx}: Missing required field(s) in {r}")
            continue

        try:
            StudentRecord(
                register_number=reg_no,
                full_name=full_name,
                email=email_raw,
                section=section,
                mentor_reference=mentor_ref,
            )
        except ValidationError as ve:
            errors.append(f"Student row {idx} ({reg_no}): Invalid format - {ve}")
            continue

        if email_raw in seen_emails:
            errors.append(f"Student row {idx}: Duplicate student email '{email_raw}'")
        seen_emails.add(email_raw)

        if email_raw in staff_emails:
            errors.append(f"Student row {idx}: Email '{email_raw}' collides with a staff account.")

        if reg_no in seen_register_numbers:
            errors.append(f"Student row {idx}: Duplicate register_number '{reg_no}'")
        seen_register_numbers.add(reg_no)

        matched_mentor = mentor_lookup.get(mentor_ref.lower()) if mentor_lookup else None
        if not matched_mentor and not allow_unassigned_mentors:
            errors.append(
                f"Student row {idx} ({full_name}): mentor_reference '{mentor_ref}' does not match any of the {len(mentor_records or [])} mentors."
            )
            continue

        semester = r.get("semester", "").strip() or default_semester
        department = r.get("department", "").strip() or default_department
        raw_year = r.get("year", "").strip()
        year = int(raw_year) if raw_year.isdigit() else default_year
        batch = r.get("batch", "").strip() or default_batch

        validated_students.append({
            "register_number": reg_no,
            "full_name": full_name,
            "email": email_raw,
            "section": section,
            "department": department,
            "year": year,
            "semester": semester,
            "batch": batch,
            "original_mentor_name": mentor_ref,
            "mentor_email": matched_mentor["email"] if matched_mentor else None,
            "mentor_staff_id": matched_mentor["staff_id"] if matched_mentor else None,
        })

    if expected_count is not None and len(raw_rows) != expected_count:
        errors.append(
            f"Student roster count error: Found {len(raw_rows)} records in file. Exactly {expected_count} students are required."
        )

    if errors:
        raise ValueError("\n".join(errors))

    return validated_students


def check_existing_records(
    session: Session,
    students_data: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Safely inspects database to detect existing records vs new insertions vs conflicts.
    Does not modify database records.
    - Existing: email and register_number match the same existing student user and profile (idempotent skip).
    - Conflict: email exists on another user/role OR with a different register number.
    - Conflict: register_number exists on a profile with a different email.
    - To Insert: neither email nor register_number exists.
    """
    emails = [s["email"].lower() for s in students_data]
    reg_nos = [s["register_number"] for s in students_data]

    db_users = session.scalars(select(User).where(User.email.in_(emails))).all()
    user_by_email: Dict[str, User] = {u.email.lower(): u for u in db_users}

    db_profiles = session.scalars(select(StudentProfile).where(StudentProfile.register_number.in_(reg_nos))).all()
    profile_by_reg: Dict[str, StudentProfile] = {p.register_number: p for p in db_profiles}

    profile_user_ids = {p.user_id for p in db_profiles}
    profile_users = session.scalars(select(User).where(User.id.in_(profile_user_ids))).all() if profile_user_ids else []
    user_by_id: Dict[uuid.UUID, User] = {u.id: u for u in profile_users}

    to_insert: List[Dict[str, Any]] = []
    existing_records: List[Dict[str, Any]] = []
    conflicts: List[str] = []

    for s in students_data:
        email = s["email"].lower()
        reg_no = s["register_number"]

        existing_user = user_by_email.get(email)
        existing_profile = profile_by_reg.get(reg_no)

        if not existing_user and not existing_profile:
            to_insert.append(s)
        elif existing_user and existing_profile:
            if existing_profile.user_id == existing_user.id:
                existing_records.append(s)
            else:
                conflicts.append(
                    f"Conflict for {reg_no}: email '{email}' belongs to user {existing_user.id}, but register number belongs to user {existing_profile.user_id}"
                )
        elif existing_user and not existing_profile:
            conflicts.append(
                f"Conflict for {reg_no}: email '{email}' already exists in database with role '{existing_user.role.value}'"
            )
        elif existing_profile and not existing_user:
            linked_user = user_by_id.get(existing_profile.user_id)
            linked_email = linked_user.email if linked_user else "unknown"
            conflicts.append(
                f"Conflict for {reg_no}: register number already exists in database associated with email '{linked_email}'"
            )

    return {
        "valid_count": len(students_data),
        "to_insert": to_insert,
        "existing": existing_records,
        "conflicts": conflicts,
    }


def execute_roster_import(
    session: Session,
    hod_data: Optional[Dict[str, Any]],
    mentors_data: List[Dict[str, Any]],
    students_data: List[Dict[str, Any]],
    output_credentials_path: Optional[Path] = None,
    department: str = "CCE",
    year: int = 2,
    batch: str = "2025-2029",
    semester: str = "III SEM",
    allow_unassigned_mentors: bool = False,
    initial_password: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes transactional database insertion of HOD (if provided), mentors (if provided),
    students, and mentor assignments using Argon2id password hashes.
    Idempotent: skips already imported records, halts on conflicts.
    """
    # 0. Check database state and idempotency
    check_result = check_existing_records(session, students_data)
    if check_result["conflicts"]:
        raise ValueError(
            f"Database conflict detected ({len(check_result['conflicts'])} conflicts). Import aborted to prevent data corruption:\n"
            + "\n".join(check_result["conflicts"])
        )

    students_to_insert = check_result["to_insert"]
    existing_students = check_result["existing"]

    credentials_list: List[Dict[str, str]] = []
    now = datetime.now(timezone.utc)

    # 1. Create HOD (if provided)
    hod_user: Optional[User] = None
    existing_hod: Optional[User] = None
    if hod_data:
        existing_hod = session.scalars(select(User).where(User.email == hod_data["email"].lower())).first()
        if existing_hod:
            hod_user = existing_hod
        else:
            hod_temp_pw = initial_password if initial_password else secrets.token_urlsafe(12)
            hod_user = User(
                id=uuid.uuid4(),
                full_name=hod_data["full_name"],
                email=hod_data["email"],
                password_hash=get_password_hash(hod_temp_pw),
                role=UserRole.HOD,
                is_active=True,
                must_change_password=True,
            )
            session.add(hod_user)
            session.flush()

            credentials_list.append({
                "identifier": hod_data["staff_id"],
                "role": "hod",
                "full_name": hod_data["full_name"],
                "email": hod_data["email"],
                "temporary_password": hod_temp_pw,
            })

    # 2. Create Mentors & Profiles (if provided)
    mentor_user_map: Dict[str, User] = {}
    mentors_created_count = 0
    for m in mentors_data:
        m_email = m["email"].lower()
        existing_m_user = session.scalars(select(User).where(User.email == m_email)).first()
        if existing_m_user:
            mentor_user_map[m["email"]] = existing_m_user
        else:
            m_temp_pw = initial_password if initial_password else secrets.token_urlsafe(12)
            m_user = User(
                id=uuid.uuid4(),
                full_name=m["full_name"],
                email=m["email"],
                password_hash=get_password_hash(m_temp_pw),
                role=UserRole.MENTOR,
                is_active=True,
                must_change_password=True,
            )
            session.add(m_user)
            session.flush()

            m_profile = MentorProfile(
                id=uuid.uuid4(),
                user_id=m_user.id,
                staff_id=m["staff_id"],
                department=m.get("department", department),
                designation=m.get("designation", "Assistant Professor"),
            )
            session.add(m_profile)
            session.flush()

            mentor_user_map[m["email"]] = m_user
            mentors_created_count += 1
            credentials_list.append({
                "identifier": m["staff_id"],
                "role": "mentor",
                "full_name": m["full_name"],
                "email": m["email"],
                "temporary_password": m_temp_pw,
            })

    # 3. Create Students & Profiles & Mentor Assignments
    if mentors_data:
        mentor_counts: Dict[str, int] = {m["email"]: 0 for m in mentors_data}
    else:
        mentor_counts = dict(Counter(s.get("original_mentor_name", "Unassigned") for s in students_data))
    assignments_created = 0

    for s in students_to_insert:
        s_temp_pw = initial_password if initial_password else secrets.token_urlsafe(12)
        s_user = User(
            id=uuid.uuid4(),
            full_name=s["full_name"],
            email=s["email"],
            password_hash=get_password_hash(s_temp_pw),
            role=UserRole.STUDENT,
            is_active=True,
            must_change_password=True,
        )
        session.add(s_user)
        session.flush()

        s_profile = StudentProfile(
            id=uuid.uuid4(),
            user_id=s_user.id,
            register_number=s["register_number"],
            department=s.get("department", department),
            year=s.get("year", year),
            section=s.get("section"),
            semester=s.get("semester", semester),
            original_mentor_name=s.get("original_mentor_name"),
            batch=s.get("batch", batch),
        )
        session.add(s_profile)
        session.flush()

        # Mentor assignment (if mentor account is present)
        mentor_email = s.get("mentor_email")
        if mentor_email and mentor_email in mentor_user_map:
            assigned_mentor_user = mentor_user_map[mentor_email]
            assignment = MentorAssignment(
                id=uuid.uuid4(),
                mentor_id=assigned_mentor_user.id,
                student_id=s_user.id,
                assigned_by=hod_user.id if hod_user else None,
                assigned_at=now,
                is_active=True,
            )
            session.add(assignment)
            session.flush()
            assignments_created += 1
            mentor_counts[mentor_email] += 1
        elif allow_unassigned_mentors:
            # Mentor assignment deferred: mentor mapping will occur when verified staff accounts are provisioned
            pass
        else:
            raise ValueError(
                f"Student {s['register_number']} missing assigned mentor and allow_unassigned_mentors=False."
            )

        credentials_list.append({
            "identifier": s["register_number"],
            "role": "student",
            "full_name": s["full_name"],
            "email": s["email"],
            "temporary_password": s_temp_pw,
        })

    # 4. Save credential distribution file securely
    if output_credentials_path and credentials_list:
        output_credentials_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_credentials_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["identifier", "role", "full_name", "email", "temporary_password"],
            )
            writer.writeheader()
            writer.writerows(credentials_list)

    return {
        "hod_created": 1 if (hod_user and not existing_hod) else 0,
        "mentors_created": mentors_created_count,
        "students_valid": len(students_data),
        "students_created": len(students_to_insert),
        "students_existing": len(existing_students),
        "conflicts_count": 0,
        "assignments_created": assignments_created,
        "mentor_distribution": mentor_counts,
        "credentials_saved_to": str(output_credentials_path) if (output_credentials_path and credentials_list) else None,
    }


def main():
    parser = argparse.ArgumentParser(
        description="CCE Achieve - Phase 4 Roster Import and Account Provisioning CLI"
    )
    parser.add_argument(
        "--students-file",
        type=Path,
        required=True,
        help="Path to CSV file containing the 61 student records.",
    )
    parser.add_argument(
        "--staff-file",
        type=Path,
        required=False,
        default=None,
        help="Path to CSV file containing the 1 HOD (optional if --allow-missing-hod is set) and 3 mentor records.",
    )
    parser.add_argument(
        "--allow-missing-hod",
        action="store_true",
        help="Allow bootstrapping roster without an HOD account (HOD account can be provisioned later).",
    )
    parser.add_argument(
        "--allow-unassigned-mentors",
        action="store_true",
        help="Allow importing students with unassigned mentors, preserving original mentor names in student profiles.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate all CSV records, references, and counts without writing to the database.",
    )
    parser.add_argument(
        "--output-credentials",
        type=Path,
        default=backend_dir / "credentials_distribution_report.csv",
        help="Path to output the secure credential distribution CSV file.",
    )
    parser.add_argument(
        "--department",
        type=str,
        default="CCE",
        help="Department code (default: CCE).",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2,
        help="Academic cohort year (default: 2).",
    )
    parser.add_argument(
        "--semester",
        type=str,
        default="III SEM",
        help="Academic semester (default: 'III SEM').",
    )
    parser.add_argument(
        "--batch",
        type=str,
        default="2025-2029",
        help="Cohort batch identifier (default: 2025-2029).",
    )
    parser.add_argument(
        "--initial-password",
        type=str,
        default="cce@123",
        help="Initial institutional temporary password for provisioned accounts (default: 'cce@123').",
    )
    parser.add_argument(
        "--use-random-passwords",
        action="store_true",
        help="Generate cryptographically random 16-character temporary passwords instead of the institutional default.",
    )

    args = parser.parse_args()

    # Keep CLI logs clean by silencing verbose SQL echoing
    engine.echo = False
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    print("==================================================================")
    print(" CCE Achieve - Roster Import & Provisioning CLI")
    print(f" Mode: {'DRY RUN (No database modifications)' if args.dry_run else 'ACTUAL IMPORT'}")
    print("==================================================================")

    if not args.staff_file and not args.allow_unassigned_mentors:
        print("[ERROR] Either --staff-file must be provided, or --allow-unassigned-mentors must be set.", file=sys.stderr)
        sys.exit(1)

    hod_data = None
    mentors_data = []
    staff_emails: set = set()

    if args.staff_file:
        try:
            raw_staff = clean_csv_lines(args.staff_file)
            hod_data, mentors_data = validate_staff_roster(
                raw_staff,
                allow_missing_hod=args.allow_missing_hod,
            )
            staff_emails = ({hod_data["email"]} if hod_data else set()) | {m["email"] for m in mentors_data}
            if hod_data:
                print(f"[OK] Staff roster validated: 1 HOD and {len(mentors_data)} Mentors.")
            else:
                print(f"[OK] Staff roster validated: 0 HOD (deferred) and {len(mentors_data)} Mentors.")
        except Exception as e:
            print(f"[ERROR] Staff validation failed:\n{e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[OK] Staff roster omitted: proceeding with unassigned mentors.")

    try:
        raw_students = clean_csv_lines(args.students_file)
        validated_students = validate_students_roster(
            raw_rows=raw_students,
            mentor_records=mentors_data if mentors_data else None,
            staff_emails=staff_emails if staff_emails else None,
            allow_unassigned_mentors=args.allow_unassigned_mentors,
            default_semester=args.semester,
            default_department=args.department,
            default_year=args.year,
            default_batch=args.batch,
        )
        print(f"[OK] Student roster validated: exactly {len(validated_students)} students.")
    except Exception as e:
        print(f"[ERROR] Student validation failed:\n{e}", file=sys.stderr)
        sys.exit(1)

    mentor_distribution = Counter(s["original_mentor_name"] for s in validated_students)
    print("\nMentor Allocation Breakdown (from roster):")
    for mentor_name, count in sorted(mentor_distribution.items()):
        print(f"  - {mentor_name}: {count} assigned students")

    db_url = engine.url
    db_name = db_url.database
    db_host = db_url.host or "localhost"
    db_port = db_url.port or 5432
    print(f"\nTarget Database: {db_name} @ {db_host}:{db_port}")

    # 1. Read-only verification check against database
    with SessionLocal() as read_session:
        check_result = check_existing_records(read_session, validated_students)
        valid_count = check_result["valid_count"]
        to_insert_count = len(check_result["to_insert"])
        existing_count = len(check_result["existing"])
        conflicts_count = len(check_result["conflicts"])

    print("\nDatabase Verification:")
    print(f"  - Valid records in roster: {valid_count}")
    print(f"  - Records to insert:       {to_insert_count}")
    print(f"  - Existing records in DB:  {existing_count}")
    print(f"  - Conflicts detected:      {conflicts_count}")

    if conflicts_count > 0:
        print(f"\n[ERROR] Database conflicts detected ({conflicts_count}):", file=sys.stderr)
        for c in check_result["conflicts"]:
            print(f"  - {c}", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print("\n==================================================================")
        print("[SUCCESS] DRY RUN COMPLETED SUCCESSFULLY.")
        print(f"Target Database: {db_name} (local)")
        print(f"Summary: {valid_count} valid records, {to_insert_count} to insert, {existing_count} existing, {conflicts_count} conflicts.")
        print("Database was NOT modified.")
        print("==================================================================")
        sys.exit(0)

    # 2. Atomic transactional import execution
    try:
        with SessionLocal() as session:
            with session.begin():
                summary = execute_roster_import(
                    session=session,
                    hod_data=hod_data,
                    mentors_data=mentors_data,
                    students_data=validated_students,
                    output_credentials_path=args.output_credentials,
                    department=args.department,
                    year=args.year,
                    batch=args.batch,
                    semester=args.semester,
                    allow_unassigned_mentors=args.allow_unassigned_mentors,
                    initial_password=None if args.use_random_passwords else args.initial_password,
                )

        print("\n==================================================================")
        print(f"[SUCCESS] ROSTER IMPORT COMMITTED TO POSTGRESQL ({db_name})")
        print(f"  - Students created: {summary['students_created']}")
        print(f"  - Students existing (skipped): {summary['students_existing']}")
        print(f"  - Mentors created: {summary['mentors_created']}")
        print(f"  - HOD created: {summary['hod_created']}")
        print(f"  - Total assignments created: {summary['assignments_created']}")
        if summary['credentials_saved_to']:
            print(f"  - Credentials distribution file: {summary['credentials_saved_to']}")
            print("  - Notice: Credentials file is excluded by .gitignore. Passwords were NOT printed.")
        print("==================================================================")
    except Exception as e:
        print(f"\n[FATAL] Database operation failed. All changes rolled back.\nDetail: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
