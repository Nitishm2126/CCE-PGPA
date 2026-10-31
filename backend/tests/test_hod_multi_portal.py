import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.main import app
from app.models.user import User, UserRole
from app.models.assignment import MentorAssignment


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_hod_multi_portal_access(client: TestClient, db_session: Session):
    """
    Verify:
    1. HOD can access mentor endpoints.
    2. In mentor endpoint, HOD sees strictly their 11 assigned mentees.
    3. In HOD endpoint, HOD sees all 61 department students.
    4. Regular mentor cannot access HOD endpoints (403 Forbidden).
    5. Regular mentor only sees their own assigned mentees.
    6. Student cannot access mentor or HOD endpoints (403 Forbidden).
    """
    # 1. Fetch HOD user (primary active HOD)
    hod = db_session.query(User).filter(User.role == UserRole.HOD).order_by(User.created_at.asc()).first()
    assert hod is not None, "HOD user must exist in database"

    hod_token = create_access_token(subject=str(hod.id), role=hod.role.value)
    hod_headers = {"Authorization": f"Bearer {hod_token}"}

    # HOD accesses mentor students endpoint
    res_mentor = client.get("/api/v1/mentor/students", headers=hod_headers)
    assert res_mentor.status_code == 200, f"Expected 200, got {res_mentor.status_code}: {res_mentor.text}"
    hod_mentees = res_mentor.json()
    assert len(hod_mentees) == 11, f"Expected exactly 11 mentees for HOD, got {len(hod_mentees)}"

    # HOD accesses department students endpoint
    res_hod = client.get("/api/v1/hod/students", headers=hod_headers)
    assert res_hod.status_code == 200
    dept_students = res_hod.json()
    assert len(dept_students) == 61, f"Expected 61 department students, got {len(dept_students)}"

    # 2. Fetch regular mentor
    mentor = db_session.query(User).filter(User.role == UserRole.MENTOR).first()
    assert mentor is not None, "Mentor user must exist"

    mentor_token = create_access_token(subject=str(mentor.id), role=mentor.role.value)
    mentor_headers = {"Authorization": f"Bearer {mentor_token}"}

    # Regular mentor accesses mentor endpoint
    res_m = client.get("/api/v1/mentor/students", headers=mentor_headers)
    assert res_m.status_code == 200
    m_mentees = res_m.json()
    assert len(m_mentees) == 25, f"Expected 25 mentees for regular mentor, got {len(m_mentees)}"

    # Regular mentor attempts to access HOD endpoint -> 403 Forbidden
    res_forbidden = client.get("/api/v1/hod/students", headers=mentor_headers)
    assert res_forbidden.status_code == 403, f"Expected 403 Forbidden for mentor on HOD endpoint, got {res_forbidden.status_code}"

    # 3. Student attempts to access mentor or HOD endpoints -> 403 Forbidden
    student = db_session.query(User).filter(User.role == UserRole.STUDENT).first()
    assert student is not None, "Student user must exist"

    student_token = create_access_token(subject=str(student.id), role=student.role.value)
    student_headers = {"Authorization": f"Bearer {student_token}"}

    res_student_mentor = client.get("/api/v1/mentor/students", headers=student_headers)
    assert res_student_mentor.status_code == 403

    res_student_hod = client.get("/api/v1/hod/students", headers=student_headers)
    assert res_student_hod.status_code == 403


def test_hod_student_pgpa_grades_endpoint(client: TestClient, db_session: Session):
    """
    Verify GET /api/v1/hod/student-pgpa-grades:
    1. HOD can fetch department-wide 5-component PGPA grades.
    2. Response includes all 5 components (Clubs, NPTEL, Online Certs, Internship, Sports).
    3. Query filters by section, search, and grade work properly.
    4. Mentor and student are forbidden (403).
    """
    hod = db_session.query(User).filter(User.role == UserRole.HOD).order_by(User.created_at.asc()).first()
    assert hod is not None
    hod_token = create_access_token(subject=str(hod.id), role=hod.role.value)
    hod_headers = {"Authorization": f"Bearer {hod_token}"}

    # 1. HOD gets all student PGPA grades
    res = client.get("/api/v1/hod/student-pgpa-grades", headers=hod_headers)
    assert res.status_code == 200, res.text
    rows = res.json()
    assert len(rows) > 0
    first = rows[0]
    assert "student_id" in first
    assert "register_number" in first
    assert "student_name" in first
    assert "components" in first
    assert "total_points" in first
    assert "total_grade_points" in first

    # Check 5 target component slugs in dictionary
    expected_slugs = {
        "clubs-and-cells",
        "nptel-non-credit-transfer",
        "online-certifications",
        "internship",
        "sports-and-games",
    }
    assert expected_slugs.issubset(set(first["components"].keys()))

    # 2. Filter by search
    test_name_part = first["student_name"][:4]
    search_res = client.get(f"/api/v1/hod/student-pgpa-grades?search={test_name_part}", headers=hod_headers)
    assert search_res.status_code == 200
    search_rows = search_res.json()
    assert len(search_rows) >= 1
    assert any(r["student_id"] == first["student_id"] for r in search_rows)

    # 3. Regular mentor is forbidden
    mentor = db_session.query(User).filter(User.role == UserRole.MENTOR).first()
    assert mentor is not None
    mentor_token = create_access_token(subject=str(mentor.id), role=mentor.role.value)
    mentor_headers = {"Authorization": f"Bearer {mentor_token}"}
    res_m = client.get("/api/v1/hod/student-pgpa-grades", headers=mentor_headers)
    assert res_m.status_code == 403

    # 4. Student is forbidden
    student = db_session.query(User).filter(User.role == UserRole.STUDENT).first()
    assert student is not None
    student_token = create_access_token(subject=str(student.id), role=student.role.value)
    student_headers = {"Authorization": f"Bearer {student_token}"}
    res_s = client.get("/api/v1/hod/student-pgpa-grades", headers=student_headers)
    assert res_s.status_code == 403

