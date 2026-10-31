import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User, StudentProfile, UserRole
from app.models.assignment import MentorAssignment
from app.models.achievement import Achievement
from app.core.security import create_access_token


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_mentor_identity_and_student_roster(client, db_session):
    """
    Test that an authenticated mentor receives their assigned mentees
    with full profile details and submission counts.
    """
    mentor = db_session.execute(
        select(User).where(User.email == "nithish21077@gmail.com")
    ).scalars().first()
    assert mentor is not None, "Mentor P. LEKHA must exist in users table"

    token = create_access_token(subject=str(mentor.id), role=mentor.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/mentor/students", headers=headers)
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"

    students = response.json()
    assert isinstance(students, list)
    assert len(students) == 25, f"Expected 25 mentees for P. LEKHA, got {len(students)}"

    # Validate schema fields on each student
    for s in students:
        assert "student_id" in s
        assert "full_name" in s
        assert "email" in s
        assert "register_number" in s
        assert "department" in s
        assert s["department"] == "CCE"
        assert "year" in s
        assert s["year"] == 2
        assert "section" in s
        assert "assignment_id" in s
        assert "submission_count" in s
        assert isinstance(s["submission_count"], int)


def test_no_duplicate_assignments_on_repeated_calls(client, db_session):
    """
    Calling /api/v1/mentor/students multiple times must be strictly idempotent
    and never create duplicate MentorAssignment records.
    """
    mentor = db_session.execute(
        select(User).where(User.email == "nithish21077@gmail.com")
    ).scalars().first()

    token = create_access_token(subject=str(mentor.id), role=mentor.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Call endpoint multiple times
    res1 = client.get("/api/v1/mentor/students", headers=headers)
    res2 = client.get("/api/v1/mentor/students", headers=headers)
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert len(res1.json()) == len(res2.json())

    # Check database row count
    assignment_count = db_session.execute(
        select(func.count(MentorAssignment.id)).where(
            MentorAssignment.mentor_id == mentor.id,
            MentorAssignment.is_active.is_(True),
        )
    ).scalar()
    assert assignment_count == 25, f"Expected exactly 25 active assignments, got {assignment_count}"


def test_strict_cross_mentor_isolation(client, db_session):
    """
    Enforces strict mentor isolation:
    - Mentor A cannot inspect an achievement belonging to Mentor B's mentee.
    - Mentor B can access their own mentee's achievement.
    """
    lekha = db_session.execute(
        select(User).where(User.email == "nithish21077@gmail.com")
    ).scalars().first()
    lurdhu = db_session.execute(
        select(User).where(User.email == "nitishms007@gmail.com")
    ).scalars().first()

    assert lekha is not None and lurdhu is not None

    # Pick an achievement belonging to Lurdhumary's mentee
    ach = db_session.execute(
        select(Achievement)
        .join(MentorAssignment, MentorAssignment.student_id == Achievement.student_id)
        .where(
            MentorAssignment.mentor_id == lurdhu.id,
            MentorAssignment.is_active.is_(True),
        )
    ).scalars().first()
    assert ach is not None, "At least one achievement must exist for isolation test"

    # Verify student is assigned to Lurdhu, not Lekha
    lurdhu_assigned = db_session.execute(
        select(MentorAssignment).where(
            MentorAssignment.mentor_id == lurdhu.id,
            MentorAssignment.student_id == ach.student_id,
            MentorAssignment.is_active.is_(True),
        )
    ).scalars().first()
    assert lurdhu_assigned is not None, "Achievement student must be assigned to Lurdhumary J"

    # Lekha attempts cross-mentor access -> 403 Forbidden
    token_lekha = create_access_token(subject=str(lekha.id), role=lekha.role.value)
    res_forbidden = client.get(
        f"/api/v1/mentor/achievements/{ach.id}",
        headers={"Authorization": f"Bearer {token_lekha}"},
    )
    assert res_forbidden.status_code == 403
    assert "Access forbidden" in res_forbidden.json().get("detail", "")

    # Lurdhu accesses own mentee -> 200 OK
    token_lurdhu = create_access_token(subject=str(lurdhu.id), role=lurdhu.role.value)
    res_ok = client.get(
        f"/api/v1/mentor/achievements/{ach.id}",
        headers={"Authorization": f"Bearer {token_lurdhu}"},
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["id"] == str(ach.id)


def test_mentor_submissions_endpoint_isolation(client, db_session):
    """
    Tests that GET /api/v1/mentor/submissions only returns submissions from
    the mentor's own assigned mentees.
    """
    lekha = db_session.execute(
        select(User).where(User.email == "nithish21077@gmail.com")
    ).scalars().first()
    lurdhu = db_session.execute(
        select(User).where(User.email == "nitishms007@gmail.com")
    ).scalars().first()

    token_lekha = create_access_token(subject=str(lekha.id), role=lekha.role.value)
    token_lurdhu = create_access_token(subject=str(lurdhu.id), role=lurdhu.role.value)

    res_lurdhu = client.get(
        "/api/v1/mentor/submissions",
        headers={"Authorization": f"Bearer {token_lurdhu}"},
    )
    assert res_lurdhu.status_code == 200
    lurdhu_subs = res_lurdhu.json()
    assert len(lurdhu_subs) > 0, "Lurdhumary J must see NITISH M's submissions"

    res_lekha = client.get(
        "/api/v1/mentor/submissions",
        headers={"Authorization": f"Bearer {token_lekha}"},
    )
    assert res_lekha.status_code == 200
    lekha_subs = res_lekha.json()

    # Enforce strict cross-mentor isolation: neither mentor sees any submission from the other mentor's mentees
    lurdhu_student_ids = {s["student_id"] for s in lurdhu_subs}
    lekha_student_ids = {s["student_id"] for s in lekha_subs}
    assert lurdhu_student_ids.isdisjoint(lekha_student_ids), "Mentors must never see each other's mentee submissions"

    # Also verify that a mentor with no submissions (e.g. Pachaiammal) receives an empty list
    pachaiammal = db_session.execute(
        select(User).where(User.email == "pachaiammal.cce@sairam.edu.in")
    ).scalars().first()
    if pachaiammal:
        token_pachai = create_access_token(subject=str(pachaiammal.id), role=pachaiammal.role.value)
        res_pachai = client.get(
            "/api/v1/mentor/submissions",
            headers={"Authorization": f"Bearer {token_pachai}"},
        )
        assert res_pachai.status_code == 200
        assert len(res_pachai.json()) == 0, "Mentor with no mentee submissions must receive empty list"


def test_empty_state_for_mentor_without_students(client, db_session):
    """
    A newly created mentor who genuinely has 0 assigned students must receive
    an empty list [ ] and 200 OK, not an error or unauthorized students.
    """
    test_mentor_id = uuid.uuid4()
    test_mentor = User(
        id=test_mentor_id,
        full_name="Dr. Unassigned Test Mentor",
        email=f"test.mentor.{test_mentor_id.hex[:6]}@sairam.edu.in",
        password_hash="test_hash_val",
        role=UserRole.MENTOR,
        is_active=True,
    )
    db_session.add(test_mentor)
    db_session.commit()

    try:
        token = create_access_token(subject=str(test_mentor.id), role=test_mentor.role.value)
        response = client.get(
            "/api/v1/mentor/students",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json() == []

        res_subs = client.get(
            "/api/v1/mentor/submissions",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_subs.status_code == 200
        assert res_subs.json() == []
    finally:
        # Cleanup
        db_session.delete(test_mentor)
        db_session.commit()
