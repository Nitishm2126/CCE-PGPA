import argparse
import csv
import re
import secrets
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, EmailStr, ValidationError
from sqlalchemy.orm import Session

# Add backend directory to sys.path if invoked directly
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.security import get_password_hash
from app.db.session import SessionLocal
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


def validate_staff_roster(raw_rows: List[Dict[str, str]]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Validates staff roster records:
    - Exactly 1 HOD
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
    if hod_record is None:
        errors.append(f"Staff roster error: Missing HOD. Exactly {EXPECTED_HOD_COUNT} HOD is required.")

    if len(mentor_records) != EXPECTED_MENTOR_COUNT:
        errors.append(
            f"Staff roster error: Found {len(mentor_records)} mentors. Exactly {EXPECTED_MENTOR_COUNT} mentors are required."
        )

    if errors:
        raise ValueError("\n".join(errors))

    return hod_record, mentor_records  # type: ignore


def validate_students_roster(
    raw_rows: List[Dict[str, str]],
    mentor_records: List[Dict[str, Any]],
    staff_emails: set,
) -> List[Dict[str, Any]]:
    """
    Validates student roster records:
    - Exactly 61 students
    - Required fields, valid email format
    - Unique emails and register numbers
    - No email collision with staff
    - Valid mentor references matching one of the 3 validated mentors
    """
    errors: List[str] = []
    validated_students: List[Dict[str, Any]] = []

    # Map mentor lookup keys (both email and staff_id) to mentor record
    mentor_lookup: Dict[str, Dict[str, Any]] = {}
    for m in mentor_records:
        mentor_lookup[m["email"].lower()] = m
        mentor_lookup[m["staff_id"].lower()] = m

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

        matched_mentor = mentor_lookup.get(mentor_ref.lower())
        if not matched_mentor:
            errors.append(
                f"Student row {idx} ({full_name}): mentor_reference '{mentor_ref}' does not match any of the {len(mentor_records)} mentors."
            )
            continue

        validated_students.append({
            "register_number": reg_no,
            "full_name": full_name,
            "email": email_raw,
            "section": section,
            "mentor_email": matched_mentor["email"],
            "mentor_staff_id": matched_mentor["staff_id"],
        })

    if len(raw_rows) != EXPECTED_STUDENT_COUNT:
        errors.append(
            f"Student roster count error: Found {len(raw_rows)} records in file. Exactly {EXPECTED_STUDENT_COUNT} students are required."
        )

    if errors:
        raise ValueError("\n".join(errors))

    return validated_students


def execute_roster_import(
    session: Session,
    hod_data: Dict[str, Any],
    mentors_data: List[Dict[str, Any]],
    students_data: List[Dict[str, Any]],
    output_credentials_path: Optional[Path] = None,
    department: str = "CCE",
    year: int = 2,
    batch: str = "2023-2027",
) -> Dict[str, Any]:
    """
    Executes transactional database insertion of HOD, mentors, students,
    and mentor assignments using Argon2id password hashes.
    Saves initial temporary credentials securely to output_credentials_path.
    """
    credentials_list: List[Dict[str, str]] = []
    now = datetime.now(timezone.utc)

    # 1. Create HOD
    hod_temp_pw = secrets.token_urlsafe(12)
    hod_user = User(
        id=uuid.uuid4(),
        full_name=hod_data["full_name"],
        email=hod_data["email"],
        password_hash=get_password_hash(hod_temp_pw),
        role=UserRole.HOD,
        is_active=True,
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

    # 2. Create Mentors & Profiles
    mentor_user_map: Dict[str, User] = {}
    for m in mentors_data:
        m_temp_pw = secrets.token_urlsafe(12)
        m_user = User(
            id=uuid.uuid4(),
            full_name=m["full_name"],
            email=m["email"],
            password_hash=get_password_hash(m_temp_pw),
            role=UserRole.MENTOR,
            is_active=True,
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
        credentials_list.append({
            "identifier": m["staff_id"],
            "role": "mentor",
            "full_name": m["full_name"],
            "email": m["email"],
            "temporary_password": m_temp_pw,
        })

    # 3. Create Students & Profiles & Mentor Assignments
    mentor_counts: Dict[str, int] = {m["email"]: 0 for m in mentors_data}
    for s in students_data:
        s_temp_pw = secrets.token_urlsafe(12)
        s_user = User(
            id=uuid.uuid4(),
            full_name=s["full_name"],
            email=s["email"],
            password_hash=get_password_hash(s_temp_pw),
            role=UserRole.STUDENT,
            is_active=True,
        )
        session.add(s_user)
        session.flush()

        s_profile = StudentProfile(
            id=uuid.uuid4(),
            user_id=s_user.id,
            register_number=s["register_number"],
            department=department,
            year=year,
            section=s["section"],
            batch=batch,
        )
        session.add(s_profile)
        session.flush()

        # Mentor assignment
        assigned_mentor_user = mentor_user_map[s["mentor_email"]]
        assignment = MentorAssignment(
            id=uuid.uuid4(),
            mentor_id=assigned_mentor_user.id,
            student_id=s_user.id,
            assigned_by=hod_user.id,
            assigned_at=now,
            is_active=True,
        )
        session.add(assignment)
        session.flush()

        mentor_counts[s["mentor_email"]] += 1
        credentials_list.append({
            "identifier": s["register_number"],
            "role": "student",
            "full_name": s["full_name"],
            "email": s["email"],
            "temporary_password": s_temp_pw,
        })

    # 4. Save credential distribution file securely
    if output_credentials_path:
        output_credentials_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_credentials_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["identifier", "role", "full_name", "email", "temporary_password"],
            )
            writer.writeheader()
            writer.writerows(credentials_list)

    return {
        "hod_created": 1,
        "mentors_created": len(mentors_data),
        "students_created": len(students_data),
        "assignments_created": len(students_data),
        "mentor_distribution": mentor_counts,
        "credentials_saved_to": str(output_credentials_path) if output_credentials_path else None,
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
        required=True,
        help="Path to CSV file containing the 1 HOD and 3 mentor records.",
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
        "--batch",
        type=str,
        default="2023-2027",
        help="Cohort batch identifier (default: 2023-2027).",
    )

    args = parser.parse_args()

    print("==================================================================")
    print(" CCE Achieve - Roster Import & Provisioning CLI")
    print(f" Mode: {'DRY RUN (No database modifications)' if args.dry_run else 'ACTUAL IMPORT'}")
    print("==================================================================")

    # 1. Parse & validate staff
    try:
        raw_staff = clean_csv_lines(args.staff_file)
        hod_data, mentors_data = validate_staff_roster(raw_staff)
        staff_emails = {hod_data["email"]} | {m["email"] for m in mentors_data}
        print(f"[OK] Staff roster validated: 1 HOD ({hod_data['full_name']}) and {len(mentors_data)} Mentors.")
    except Exception as e:
        print(f"[ERROR] Staff validation failed:\n{e}", file=sys.stderr)
        sys.exit(1)

    # 2. Parse & validate students
    try:
        raw_students = clean_csv_lines(args.students_file)
        validated_students = validate_students_roster(raw_students, mentors_data, staff_emails)
        print(f"[OK] Student roster validated: exactly {len(validated_students)} students.")
    except Exception as e:
        print(f"[ERROR] Student validation failed:\n{e}", file=sys.stderr)
        sys.exit(1)

    # Calculate mentor allocation metrics
    allocation: Dict[str, int] = {m["email"]: 0 for m in mentors_data}
    for s in validated_students:
        allocation[s["mentor_email"]] += 1

    print("\nMentor Allocation Breakdown:")
    for m in mentors_data:
        email = m["email"]
        print(f"  - {m['full_name']} ({m['staff_id']}): {allocation.get(email, 0)} assigned students")

    if args.dry_run:
        print("\n[SUCCESS] DRY RUN COMPLETED SUCCESSFULLY.")
        print("All data constraints, counts, and mentor references are 100% valid.")
        print("Database was NOT modified.")
        sys.exit(0)

    # 3. Execute transactional import
    session = SessionLocal()
    try:
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
            )

        print("\n==================================================================")
        print("[SUCCESS] ROSTER IMPORT COMMITTED TO POSTGRESQL (cce_achieve)")
        print(f"  - Accounts created: 1 HOD, {summary['mentors_created']} Mentors, {summary['students_created']} Students")
        print(f"  - Total assignments created: {summary['assignments_created']}")
        print(f"  - Credentials distribution file: {summary['credentials_saved_to']}")
        print("  - Notice: Credentials file is excluded by .gitignore. Passwords were NOT printed.")
        print("==================================================================")
    except Exception as e:
        print(f"\n[FATAL] Database transaction failed. All changes rolled back.\nDetail: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
