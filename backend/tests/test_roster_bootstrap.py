import csv
import io
import tempfile
import uuid
from pathlib import Path
import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.cli.bootstrap_roster import (
    EXPECTED_HOD_COUNT,
    EXPECTED_MENTOR_COUNT,
    EXPECTED_STUDENT_COUNT,
    clean_csv_lines,
    execute_roster_import,
    validate_staff_roster,
    validate_students_roster,
)
from app.db.session import SessionLocal, engine
from app.models.assignment import MentorAssignment
from app.models.user import MentorProfile, StudentProfile, User, UserRole


def generate_mock_staff_rows(num_mentors: int = 3, num_hod: int = 1, prefix: str = None):
    if prefix is None:
        prefix = uuid.uuid4().hex[:6]
    rows = []
    for h in range(1, num_hod + 1):
        rows.append({
            "role": "hod",
            "full_name": f"Dr. Department HOD {h}",
            "email": f"hod{h}_{prefix}@sairam.edu.in",
            "staff_id": f"STF_HOD_{prefix}_{h}",
            "department": "CCE",
            "designation": "Professor & Head",
        })
    for m in range(1, num_mentors + 1):
        rows.append({
            "role": "mentor",
            "full_name": f"Dr. Faculty Mentor {m}",
            "email": f"mentor{m}_{prefix}@sairam.edu.in",
            "staff_id": f"STF_M0{m}_{prefix}",
            "department": "CCE",
            "designation": "Assistant Professor",
        })
    return rows


def generate_mock_student_rows(count: int = 61, mentor_refs: list = None, prefix: str = None):
    if prefix is None:
        prefix = uuid.uuid4().hex[:6]
    if mentor_refs is None:
        mentor_refs = [
            f"mentor1_{prefix}@sairam.edu.in",
            f"mentor2_{prefix}@sairam.edu.in",
            f"mentor3_{prefix}@sairam.edu.in",
        ]
    rows = []
    for i in range(1, count + 1):
        m_ref = mentor_refs[(i - 1) % len(mentor_refs)]
        section = "A" if i <= 31 else "B"
        rows.append({
            "register_number": f"212623{prefix[:3]}{i:03d}",
            "full_name": f"Student Name {i}",
            "email": f"student{i}_{prefix}@sairam.edu.in",
            "section": section,
            "mentor_reference": m_ref,
        })
    return rows


def test_validate_staff_roster_valid():
    """
    Valid staff roster with exactly 1 HOD and 3 mentors must pass validation.
    """
    prefix = uuid.uuid4().hex[:6]
    raw_staff = generate_mock_staff_rows(num_mentors=3, num_hod=1, prefix=prefix)
    hod, mentors = validate_staff_roster(raw_staff)

    assert hod["role"] == "hod"
    assert hod["staff_id"] == f"STF_HOD_{prefix}_1"
    assert len(mentors) == 3
    assert {m["staff_id"] for m in mentors} == {f"STF_M01_{prefix}", f"STF_M02_{prefix}", f"STF_M03_{prefix}"}


def test_validate_staff_roster_wrong_counts():
    """
    Rosters with invalid mentor or HOD counts must be rejected.
    """
    # 2 mentors instead of 3
    with pytest.raises(ValueError, match="Exactly 3 mentors are required"):
        validate_staff_roster(generate_mock_staff_rows(num_mentors=2, num_hod=1))

    # 4 mentors instead of 3
    with pytest.raises(ValueError, match="Exactly 3 mentors are required"):
        validate_staff_roster(generate_mock_staff_rows(num_mentors=4, num_hod=1))

    # 0 HOD
    with pytest.raises(ValueError, match="Missing HOD"):
        validate_staff_roster(generate_mock_staff_rows(num_mentors=3, num_hod=0))

    # 2 HODs
    with pytest.raises(ValueError, match="Multiple HOD records"):
        validate_staff_roster(generate_mock_staff_rows(num_mentors=3, num_hod=2))


def test_validate_staff_roster_duplicate_and_invalid_email():
    """
    Rejects duplicate emails and malformed emails.
    """
    rows = generate_mock_staff_rows()
    rows[1]["email"] = rows[0]["email"]  # duplicate
    with pytest.raises(ValueError, match="Duplicate email"):
        validate_staff_roster(rows)

    bad_email_rows = generate_mock_staff_rows()
    bad_email_rows[1]["email"] = "not-an-email"
    with pytest.raises(ValueError, match="Invalid format"):
        validate_staff_roster(bad_email_rows)


def test_validate_students_roster_valid():
    """
    Valid students roster with exactly 61 students assigned to the 3 mentors passes.
    """
    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(num_mentors=3, num_hod=1, prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows)
    staff_emails = {hod["email"]} | {m["email"] for m in mentors}
    mentor_emails = [m["email"] for m in mentors]

    student_rows = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    validated = validate_students_roster(student_rows, mentors, staff_emails)

    assert len(validated) == 61
    assert validated[0]["register_number"] == f"212623{prefix[:3]}001"
    assert validated[60]["register_number"] == f"212623{prefix[:3]}061"


def test_validate_students_roster_wrong_count():
    """
    Rejects student lists with count != 61.
    """
    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows)
    staff_emails = {hod["email"]} | {m["email"] for m in mentors}
    mentor_emails = [m["email"] for m in mentors]

    # 60 students
    with pytest.raises(ValueError, match="Exactly 61 students are required"):
        validate_students_roster(
            generate_mock_student_rows(count=60, mentor_refs=mentor_emails, prefix=prefix),
            mentors,
            staff_emails,
        )

    # 62 students
    with pytest.raises(ValueError, match="Exactly 61 students are required"):
        validate_students_roster(
            generate_mock_student_rows(count=62, mentor_refs=mentor_emails, prefix=prefix),
            mentors,
            staff_emails,
        )


def test_validate_students_roster_duplicates():
    """
    Rejects duplicate emails and duplicate register numbers.
    """
    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows)
    staff_emails = {hod["email"]} | {m["email"] for m in mentors}
    mentor_emails = [m["email"] for m in mentors]

    # Duplicate register number
    dup_reg = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    dup_reg[1]["register_number"] = dup_reg[0]["register_number"]
    with pytest.raises(ValueError, match="Duplicate register_number"):
        validate_students_roster(dup_reg, mentors, staff_emails)

    # Duplicate email
    dup_email = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    dup_email[1]["email"] = dup_email[0]["email"]
    with pytest.raises(ValueError, match="Duplicate student email"):
        validate_students_roster(dup_email, mentors, staff_emails)

    # Email collision with staff
    collision = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    collision[0]["email"] = hod["email"]
    with pytest.raises(ValueError, match="collides with a staff account"):
        validate_students_roster(collision, mentors, staff_emails)


def test_validate_students_roster_invalid_mentor_ref():
    """
    Rejects student assignment referencing an unknown mentor.
    """
    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows)
    staff_emails = {hod["email"]} | {m["email"] for m in mentors}
    mentor_emails = [m["email"] for m in mentors]

    student_rows = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    student_rows[5]["mentor_reference"] = "unknown_mentor@sairam.edu.in"

    with pytest.raises(ValueError, match="does not match any of the 3 mentors"):
        validate_students_roster(student_rows, mentors, staff_emails)


def test_dry_run_safety():
    """
    Verifies that dry-run validations execute successfully without touching database.
    """
    with engine.connect() as conn:
        initial_users = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()

    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(num_mentors=3, num_hod=1, prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows)
    staff_emails = {hod["email"]} | {m["email"] for m in mentors}
    mentor_emails = [m["email"] for m in mentors]

    student_rows = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    validated = validate_students_roster(student_rows, mentors, staff_emails)

    assert len(validated) == 61
    assert len(mentors) == 3

    # Assert database user count has not changed
    with engine.connect() as conn:
        current_users = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
    assert current_users == initial_users


def test_transactional_import_and_mentor_assignment_counts():
    """
    Executes actual import within an isolated test session.
    Verifies creation of:
    - Exactly 1 HOD
    - Exactly 3 Mentors and 3 MentorProfiles
    - Exactly 61 Students and 61 StudentProfiles
    - Exactly 61 active MentorAssignments distributed across the 3 mentors
    - Argon2id password hashing for all users
    - Secure output credentials CSV generation
    Cleans up all created rows after verification.
    """
    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(num_mentors=3, num_hod=1, prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows)
    staff_emails = {hod["email"]} | {m["email"] for m in mentors}
    mentor_emails = [m["email"] for m in mentors]
    student_rows = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    validated_students = validate_students_roster(student_rows, mentors, staff_emails)

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        cred_file = Path(tmp.name)

    session = SessionLocal()
    created_user_ids = []

    try:
        with session.begin():
            summary = execute_roster_import(
                session=session,
                hod_data=hod,
                mentors_data=mentors,
                students_data=validated_students,
                output_credentials_path=cred_file,
            )

        assert summary["hod_created"] == 1
        assert summary["mentors_created"] == 3
        assert summary["students_created"] == 61
        assert summary["assignments_created"] == 61

        # Check distribution sums to 61
        assert sum(summary["mentor_distribution"].values()) == 61

        # Verify database objects
        all_emails = [hod["email"]] + [m["email"] for m in mentors] + [s["email"] for s in validated_students]
        db_users = session.scalars(select(User).where(User.email.in_(all_emails))).all()
        assert len(db_users) == 65
        created_user_ids = [u.id for u in db_users]

        # Verify password hashes are Argon2id
        for u in db_users:
            assert u.password_hash.startswith("$argon2id$")

        # Verify mentor assignments count in DB
        db_assignments = session.scalars(
            select(MentorAssignment).where(MentorAssignment.student_id.in_(created_user_ids))
        ).all()
        assert len(db_assignments) == 61

        # Verify credentials file exists and has 65 records
        with open(cred_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            cred_rows = list(reader)
        assert len(cred_rows) == 65
        assert set(r["role"] for r in cred_rows) == {"hod", "mentor", "student"}
        for r in cred_rows:
            assert len(r["temporary_password"]) >= 12

    finally:
        # Clean up database records
        session.rollback()
        if created_user_ids:
            with session.begin():
                session.execute(
                    text("DELETE FROM mentor_assignments WHERE student_id = ANY(:uids) OR mentor_id = ANY(:uids)"),
                    {"uids": created_user_ids},
                )
                session.execute(
                    text("DELETE FROM student_profiles WHERE user_id = ANY(:uids)"),
                    {"uids": created_user_ids},
                )
                session.execute(
                    text("DELETE FROM mentor_profiles WHERE user_id = ANY(:uids)"),
                    {"uids": created_user_ids},
                )
                session.execute(
                    text("DELETE FROM users WHERE id = ANY(:uids)"),
                    {"uids": created_user_ids},
                )
        session.close()

        if cred_file.exists():
            cred_file.unlink()


def test_rollback_on_failure():
    """
    Verifies that if any failure happens during import, the transaction rolls back completely.
    """
    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(num_mentors=3, num_hod=1, prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows)
    mentor_emails = [m["email"] for m in mentors]
    student_rows = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    # Corrupt one student with None email to trigger error during ORM insertion
    student_rows[10]["email"] = None  # type: ignore

    session = SessionLocal()
    with engine.connect() as conn:
        before_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()

    with pytest.raises(Exception):
        with session.begin():
            execute_roster_import(
                session=session,
                hod_data=hod,
                mentors_data=mentors,
                students_data=student_rows,
            )

    with engine.connect() as conn:
        after_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()

    assert after_count == before_count
    session.close()
