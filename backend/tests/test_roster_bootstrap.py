import csv
import io
import tempfile
import uuid
from pathlib import Path
import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import Session

from app.cli.bootstrap_roster import (
    EXPECTED_HOD_COUNT,
    EXPECTED_MENTOR_COUNT,
    EXPECTED_STUDENT_COUNT,
    check_existing_records,
    clean_csv_lines,
    execute_roster_import,
    main as cli_main,
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


def test_validate_staff_roster_allow_missing_hod():
    """
    Verifies that allow_missing_hod=True permits 0 HOD while enforcing 3 mentors,
    and still enforces all other constraints (no multiple HODs, valid mentor count).
    Verifies that default allow_missing_hod=False strictly rejects 0 HOD.
    """
    prefix = uuid.uuid4().hex[:6]
    staff_rows_0_hod = generate_mock_staff_rows(num_mentors=3, num_hod=0, prefix=prefix)

    # Default rejects 0 HOD
    with pytest.raises(ValueError, match="Missing HOD"):
        validate_staff_roster(staff_rows_0_hod)

    # allow_missing_hod=False explicitly rejects 0 HOD
    with pytest.raises(ValueError, match="Missing HOD"):
        validate_staff_roster(staff_rows_0_hod, allow_missing_hod=False)

    # allow_missing_hod=True accepts 0 HOD
    hod, mentors = validate_staff_roster(staff_rows_0_hod, allow_missing_hod=True)
    assert hod is None
    assert len(mentors) == 3

    # allow_missing_hod=True with 1 HOD still works normally
    staff_rows_1_hod = generate_mock_staff_rows(num_mentors=3, num_hod=1, prefix=prefix)
    hod_pres, mentors_pres = validate_staff_roster(staff_rows_1_hod, allow_missing_hod=True)
    assert hod_pres is not None
    assert hod_pres["role"] == "hod"
    assert len(mentors_pres) == 3

    # allow_missing_hod=True still rejects invalid mentor counts (e.g. 2 mentors)
    with pytest.raises(ValueError, match="Exactly 3 mentors are required"):
        validate_staff_roster(generate_mock_staff_rows(num_mentors=2, num_hod=0), allow_missing_hod=True)

    # allow_missing_hod=True still rejects multiple HODs (e.g. 2 HODs)
    with pytest.raises(ValueError, match="Multiple HOD records"):
        validate_staff_roster(generate_mock_staff_rows(num_mentors=3, num_hod=2), allow_missing_hod=True)


def test_dry_run_safety_missing_hod():
    """
    Verifies that dry-run validations execute successfully with missing HOD
    when allowed, without writing to the database.
    """
    with engine.connect() as conn:
        initial_users = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()

    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(num_mentors=3, num_hod=0, prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows, allow_missing_hod=True)
    assert hod is None

    staff_emails = {m["email"] for m in mentors}
    mentor_emails = [m["email"] for m in mentors]

    student_rows = generate_mock_student_rows(count=61, mentor_refs=mentor_emails, prefix=prefix)
    validated = validate_students_roster(student_rows, mentors, staff_emails)

    assert len(validated) == 61
    assert len(mentors) == 3

    # Assert database user count has not changed
    with engine.connect() as conn:
        current_users = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
    assert current_users == initial_users


def test_transactional_import_and_mentor_assignment_counts_without_hod():
    """
    Executes actual import without HOD within an isolated test session.
    Verifies creation of:
    - Exactly 0 HOD
    - Exactly 3 Mentors and 3 MentorProfiles
    - Exactly 61 Students and 61 StudentProfiles
    - Exactly 61 active MentorAssignments with assigned_by IS NULL
    - Argon2id password hashing for all users
    - Credentials CSV containing only 64 users (3 mentors + 61 students)
    Cleans up all created rows after verification.
    """
    prefix = uuid.uuid4().hex[:6]
    staff_rows = generate_mock_staff_rows(num_mentors=3, num_hod=0, prefix=prefix)
    hod, mentors = validate_staff_roster(staff_rows, allow_missing_hod=True)
    assert hod is None

    staff_emails = {m["email"] for m in mentors}
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
                hod_data=None,
                mentors_data=mentors,
                students_data=validated_students,
                output_credentials_path=cred_file,
            )

        assert summary["hod_created"] == 0
        assert summary["mentors_created"] == 3
        assert summary["students_created"] == 61
        assert summary["assignments_created"] == 61
        assert sum(summary["mentor_distribution"].values()) == 61

        # Verify database objects: exactly 64 users (no HOD)
        all_emails = [m["email"] for m in mentors] + [s["email"] for s in validated_students]
        db_users = session.scalars(select(User).where(User.email.in_(all_emails))).all()
        assert len(db_users) == 64
        created_user_ids = [u.id for u in db_users]

        mentor_user_ids = [u.id for u in db_users if u.role == UserRole.MENTOR]
        assert len(mentor_user_ids) == 3

        # Verify password hashes are Argon2id
        for u in db_users:
            assert u.password_hash.startswith("$argon2id$")

        # Verify mentor assignments in DB: all 61 must have assigned_by IS NULL
        db_assignments = session.scalars(
            select(MentorAssignment).where(MentorAssignment.student_id.in_(created_user_ids))
        ).all()
        assert len(db_assignments) == 61
        for a in db_assignments:
            assert a.assigned_by is None
            assert a.is_active is True
            assert a.mentor_id in mentor_user_ids

        # Verify credentials file exists and has 64 records (no HOD)
        with open(cred_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            cred_rows = list(reader)
        assert len(cred_rows) == 64
        assert set(r["role"] for r in cred_rows) == {"mentor", "student"}
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


def test_validate_students_roster_unassigned_mentors():
    """
    Verifies that allow_unassigned_mentors=True allows validating students
    with plain mentor reference names without requiring staff mentor accounts,
    populating original_mentor_name while leaving mentor_email and mentor_staff_id None.
    Also verifies that allow_unassigned_mentors=False requires mentor records.
    """
    prefix = uuid.uuid4().hex[:6]
    mentor_names = ["LURDHUMARY J", "P. LEKHA", "PACHHAIAMMAL PRIYA M"]
    raw_students = generate_mock_student_rows(count=61, mentor_refs=mentor_names, prefix=prefix)

    # Rejection when allow_unassigned_mentors=False and no mentors
    with pytest.raises(ValueError, match="Staff mentor records are required"):
        validate_students_roster(raw_students, mentor_records=None, allow_unassigned_mentors=False)

    # Acceptance when allow_unassigned_mentors=True without mentors
    validated = validate_students_roster(raw_students, mentor_records=None, allow_unassigned_mentors=True)
    assert len(validated) == 61
    for s in validated:
        assert s["original_mentor_name"] in mentor_names
        assert s["mentor_email"] is None
        assert s["mentor_staff_id"] is None
        assert s["semester"] == "III SEM"
        assert s["department"] == "CCE"
        assert s["year"] == 2


def test_check_existing_records_and_conflicts():
    """
    Verifies that check_existing_records correctly identifies:
    - New records to insert
    - Existing records already imported (idempotency)
    - Conflict where email exists with different register number or role
    - Conflict where register number exists with different email
    """
    prefix = uuid.uuid4().hex[:6]
    mentor_names = ["LURDHUMARY J", "P. LEKHA", "PACHHAIAMMAL PRIYA M"]
    raw_students = generate_mock_student_rows(count=61, mentor_refs=mentor_names, prefix=prefix)
    validated = validate_students_roster(raw_students, allow_unassigned_mentors=True)

    session = SessionLocal()
    created_user_ids = []

    try:
        # Case 1: Empty DB -> 61 to insert, 0 existing, 0 conflicts
        res1 = check_existing_records(session, validated)
        assert res1["valid_count"] == 61
        assert len(res1["to_insert"]) == 61
        assert len(res1["existing"]) == 0
        assert len(res1["conflicts"]) == 0

        # Create one student in DB
        first = validated[0]
        test_u = User(
            id=uuid.uuid4(),
            full_name=first["full_name"],
            email=first["email"],
            password_hash="$argon2id$mockhash",
            role=UserRole.STUDENT,
            is_active=True,
        )
        session.add(test_u)
        session.flush()
        created_user_ids.append(test_u.id)

        test_p = StudentProfile(
            id=uuid.uuid4(),
            user_id=test_u.id,
            register_number=first["register_number"],
            department="CCE",
            year=2,
            section=first["section"],
            semester=first["semester"],
            original_mentor_name=first["original_mentor_name"],
            batch="2023-2027",
        )
        session.add(test_p)
        session.flush()
        session.commit()

        # Case 2: 1 existing record, 60 to insert, 0 conflicts
        res2 = check_existing_records(session, validated)
        assert len(res2["existing"]) == 1
        assert res2["existing"][0]["register_number"] == first["register_number"]
        assert len(res2["to_insert"]) == 60
        assert len(res2["conflicts"]) == 0

        # Case 3: Email collision with different register number
        conflicting_students = [dict(s) for s in validated]
        conflicting_students[0]["register_number"] = f"DIFFERENT_{prefix}"
        res3 = check_existing_records(session, conflicting_students)
        assert len(res3["conflicts"]) >= 1
        assert any("already exists in database" in c for c in res3["conflicts"])

        # Case 4: Register number collision with different email
        conflicting_students2 = [dict(s) for s in validated]
        conflicting_students2[0]["email"] = f"different_{prefix}@sairam.edu.in"
        res4 = check_existing_records(session, conflicting_students2)
        assert len(res4["conflicts"]) >= 1
        assert any("register number already exists in database" in c for c in res4["conflicts"])

    finally:
        session.rollback()
        if created_user_ids:
            with session.begin():
                session.execute(
                    text("DELETE FROM student_profiles WHERE user_id = ANY(:uids)"),
                    {"uids": created_user_ids},
                )
                session.execute(
                    text("DELETE FROM users WHERE id = ANY(:uids)"),
                    {"uids": created_user_ids},
                )
        session.close()


def test_repeat_import_idempotency_unassigned_mentors():
    """
    Executes actual unassigned mentor import in an isolated session, verifies
    creation of 61 students with original_mentor_name and semester, 0 assignments,
    then executes repeat-import to verify idempotent safety (0 inserted, 61 skipped, 0 conflicts).
    """
    prefix = uuid.uuid4().hex[:6]
    mentor_names = ["LURDHUMARY J", "P. LEKHA", "PACHHAIAMMAL PRIYA M"]
    student_rows = generate_mock_student_rows(count=61, mentor_refs=mentor_names, prefix=prefix)
    validated = validate_students_roster(student_rows, allow_unassigned_mentors=True)

    session = SessionLocal()
    created_user_ids = []
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        cred_file = Path(tmp.name)

    try:
        # First import run: all 61 inserted
        with session.begin():
            summary1 = execute_roster_import(
                session=session,
                hod_data=None,
                mentors_data=[],
                students_data=validated,
                output_credentials_path=cred_file,
                allow_unassigned_mentors=True,
            )

        assert summary1["students_created"] == 61
        assert summary1["students_existing"] == 0
        assert summary1["assignments_created"] == 0
        assert summary1["mentors_created"] == 0
        assert summary1["hod_created"] == 0

        # Query database to confirm all 61 profiles and fields
        student_emails = [s["email"] for s in validated]
        db_users = session.scalars(select(User).where(User.email.in_(student_emails))).all()
        assert len(db_users) == 61
        created_user_ids = [u.id for u in db_users]

        profiles = session.scalars(select(StudentProfile).where(StudentProfile.user_id.in_(created_user_ids))).all()
        assert len(profiles) == 61
        for p in profiles:
            assert p.original_mentor_name in mentor_names
            assert p.semester == "III SEM"
            assert p.department == "CCE"
            assert p.year == 2

        # Mentor assignments in DB must be exactly 0
        assignments = session.scalars(
            select(MentorAssignment).where(MentorAssignment.student_id.in_(created_user_ids))
        ).all()
        assert len(assignments) == 0

        # Commit read transaction to allow beginning a new transaction block
        session.commit()

        # Second import run: exact repeat of the same 61 records
        with session.begin():
            summary2 = execute_roster_import(
                session=session,
                hod_data=None,
                mentors_data=[],
                students_data=validated,
                output_credentials_path=cred_file,
                allow_unassigned_mentors=True,
            )

        assert summary2["students_created"] == 0
        assert summary2["students_existing"] == 61
        assert summary2["conflicts_count"] == 0
        assert summary2["assignments_created"] == 0

        # Total user count in database remains unchanged
        db_users_after = session.scalars(select(User).where(User.email.in_(student_emails))).all()
        assert len(db_users_after) == 61

    finally:
        session.close()
        if created_user_ids:
            with SessionLocal() as cleanup_session:
                with cleanup_session.begin():
                    cleanup_session.execute(
                        text("DELETE FROM student_profiles WHERE user_id = ANY(:uids)"),
                        {"uids": created_user_ids},
                    )
                    cleanup_session.execute(
                        text("DELETE FROM users WHERE id = ANY(:uids)"),
                        {"uids": created_user_ids},
                    )

        if cred_file.exists():
            cred_file.unlink()


def test_execute_roster_import_aborts_on_conflicts():
    """
    Verifies that execute_roster_import aborts with ValueError when a conflict is detected,
    leaving existing database records untouched.
    """
    prefix = uuid.uuid4().hex[:6]
    mentor_names = ["LURDHUMARY J", "P. LEKHA", "PACHHAIAMMAL PRIYA M"]
    student_rows = generate_mock_student_rows(count=61, mentor_refs=mentor_names, prefix=prefix)
    validated = validate_students_roster(student_rows, allow_unassigned_mentors=True)

    session = SessionLocal()
    created_user_ids = []

    try:
        # Pre-insert a conflicting staff user with the email of student 0
        target_email = validated[0]["email"]
        conflict_user = User(
            id=uuid.uuid4(),
            full_name="Staff Conflict User",
            email=target_email,
            password_hash="$argon2id$mockhash",
            role=UserRole.HOD,
            is_active=True,
        )
        session.add(conflict_user)
        session.flush()
        session.commit()
        created_user_ids.append(conflict_user.id)

        # Attempt import
        with pytest.raises(ValueError, match="Database conflict detected"):
            with session.begin():
                execute_roster_import(
                    session=session,
                    hod_data=None,
                    mentors_data=[],
                    students_data=validated,
                    allow_unassigned_mentors=True,
                )

    finally:
        session.rollback()
        if created_user_ids:
            with session.begin():
                session.execute(
                    text("DELETE FROM users WHERE id = ANY(:uids)"),
                    {"uids": created_user_ids},
                )
        session.close()


def test_cli_main_dry_run_and_actual_import_transaction_safety(monkeypatch, tmp_path):
    """
    Regression test verifying that bootstrap_roster.py CLI main() can:
    1. Perform a dry-run check without transaction collisions.
    2. Execute an actual import with a single atomic transaction boundary without raising:
       'InvalidRequestError: A transaction is already begun on this Session.'
    3. Idempotently execute repeat import without conflicts or duplicates.
    Cleans up all created database records.
    """
    prefix = uuid.uuid4().hex[:6]
    mentor_names = ["LURDHUMARY J", "P. LEKHA", "PACHHAIAMMAL PRIYA M"]
    raw_students = generate_mock_student_rows(count=61, mentor_refs=mentor_names, prefix=prefix)

    csv_path = tmp_path / f"test_students_{prefix}.csv"
    with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["register_number", "full_name", "email", "section", "mentor_reference"]
        )
        writer.writeheader()
        writer.writerows(raw_students)

    cred_path = tmp_path / f"creds_{prefix}.csv"

    student_emails = [s["email"] for s in raw_students]
    created_user_ids = []

    try:
        # Phase 1: Dry Run
        dry_run_args = [
            "bootstrap_roster.py",
            "--students-file", str(csv_path),
            "--allow-unassigned-mentors",
            "--dry-run",
        ]
        monkeypatch.setattr("sys.argv", dry_run_args)
        with pytest.raises(SystemExit) as exc_info:
            cli_main()
        assert exc_info.value.code == 0

        # Verify database is still completely empty
        with engine.connect() as conn:
            assert conn.execute(
                text("SELECT count(*) FROM users WHERE email = ANY(:emails)"),
                {"emails": student_emails},
            ).scalar() == 0

        # Phase 2: Actual Import via main()
        import_args = [
            "bootstrap_roster.py",
            "--students-file", str(csv_path),
            "--allow-unassigned-mentors",
            "--output-credentials", str(cred_path),
        ]
        monkeypatch.setattr("sys.argv", import_args)
        # MUST execute without raising InvalidRequestError or SystemExit(1)
        cli_main()

        # Verify all 61 students were committed to database
        with SessionLocal() as check_session:
            db_users = check_session.scalars(select(User).where(User.email.in_(student_emails))).all()
            assert len(db_users) == 61
            created_user_ids = [u.id for u in db_users]

            profiles = check_session.scalars(select(StudentProfile).where(StudentProfile.user_id.in_(created_user_ids))).all()
            assert len(profiles) == 61
            for p in profiles:
                assert p.original_mentor_name in mentor_names
                assert p.semester == "III SEM"
                assert p.department == "CCE"

        # Phase 3: Idempotent Repeat Import via main()
        monkeypatch.setattr("sys.argv", import_args)
        # Should succeed without errors and without inserting duplicates
        cli_main()

        # Database count remains exactly 61
        with SessionLocal() as check_session:
            db_users_after = check_session.scalars(select(User).where(User.email.in_(student_emails))).all()
            assert len(db_users_after) == 61

    finally:
        if created_user_ids:
            with SessionLocal() as cleanup_session:
                with cleanup_session.begin():
                    cleanup_session.execute(
                        text("DELETE FROM student_profiles WHERE user_id = ANY(:uids)"),
                        {"uids": created_user_ids},
                    )
                    cleanup_session.execute(
                        text("DELETE FROM users WHERE id = ANY(:uids)"),
                        {"uids": created_user_ids},
                    )


def test_transaction_rollback_unassigned_mentors_atomicity():
    """
    Verifies that if an error occurs during unassigned mentor import,
    the transaction is rolled back and zero student records are persisted.
    """
    prefix = uuid.uuid4().hex[:6]
    mentor_names = ["LURDHUMARY J", "P. LEKHA", "PACHHAIAMMAL PRIYA M"]
    raw_students = generate_mock_student_rows(count=61, mentor_refs=mentor_names, prefix=prefix)
    validated = validate_students_roster(raw_students, allow_unassigned_mentors=True)

    # Force a failure on student 30 by injecting an invalid non-null value
    validated[30]["register_number"] = None  # Will cause DB integrity error on flush

    student_emails = [s["email"] for s in raw_students if s["email"]]

    with SessionLocal() as session:
        with pytest.raises(Exception):
            with session.begin():
                execute_roster_import(
                    session=session,
                    hod_data=None,
                    mentors_data=[],
                    students_data=validated,
                    allow_unassigned_mentors=True,
                )

    # Verify zero records committed
    with engine.connect() as conn:
        committed_count = conn.execute(
            text("SELECT count(*) FROM users WHERE email = ANY(:emails)"),
            {"emails": student_emails},
        ).scalar()
        assert committed_count == 0


def test_regression_transaction_already_begun_on_session_prevention():
    """
    Direct regression test verifying the root cause of:
    'A transaction is already begun on this Session.'

    1. Demonstrates that calling check_existing_records on a session without an active transaction
       causes SQLAlchemy 2.0 to autobegin an implicit transaction. A subsequent session.begin()
       raises InvalidRequestError.
    2. Demonstrates the clean refactored pattern: using an independent read session
       followed by an atomic transactional session boundary.
    """
    raw_students = generate_mock_student_rows(count=3, prefix="regtest")

    # 1. Reproduce the exact bug when using a single un-delimited session:
    session = SessionLocal()
    try:
        check_existing_records(session, raw_students)
        # Session now has an autobegun implicit transaction
        assert session.in_transaction()
        with pytest.raises(InvalidRequestError, match="A transaction is already begun on this Session"):
            with session.begin():
                pass
    finally:
        session.rollback()
        session.close()

    # 2. Verify clean resolution with distinct session boundaries:
    with SessionLocal() as read_session:
        check_result = check_existing_records(read_session, raw_students)
        assert check_result["valid_count"] == 3

    # Clean separate transactional session works without collision:
    with SessionLocal() as import_session:
        with import_session.begin():
            assert import_session.in_transaction()
