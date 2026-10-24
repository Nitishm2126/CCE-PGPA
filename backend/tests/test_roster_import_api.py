import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import SessionLocal
from app.models.user import StudentProfile, User, UserRole


def build_csv_text(students: list) -> str:
    lines = ["register_number,full_name,email,section,mentor_reference,department,year,batch,semester"]
    for s in students:
        lines.append(
            f"{s['register_number']},{s['full_name']},{s['email']},{s['section']},{s['mentor_reference']},{s.get('department','CCE')},{s.get('year',2)},{s.get('batch','2023-2027')},{s.get('semester','Semester 4')}"
        )
    return "\n".join(lines)


def generate_mock_students(count: int = 5, prefix: str = None) -> list:
    if prefix is None:
        prefix = uuid.uuid4().hex[:6]
    students = []
    for i in range(1, count + 1):
        students.append({
            "register_number": f"212623{prefix[:3]}{i:03d}",
            "full_name": f"Test Student {prefix} {i}",
            "email": f"student_{prefix}_{i}@sairam.edu.in",
            "section": "A" if i % 2 == 1 else "B",
            "mentor_reference": "unassigned",
            "department": "CCE",
            "year": 2,
            "batch": "2023-2027",
            "semester": "Semester 4",
        })
    return students


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def cleanup_users(emails: list):
    session = SessionLocal()
    try:
        users = session.scalars(select(User).where(User.email.in_(emails))).all()
        if users:
            uids = [u.id for u in users]
            session.execute(
                text("DELETE FROM audit_logs WHERE actor_id = ANY(:uids)"),
                {"uids": uids},
            )
            session.execute(
                text("DELETE FROM mentor_assignments WHERE student_id = ANY(:uids) OR mentor_id = ANY(:uids)"),
                {"uids": uids},
            )
            session.execute(
                text("DELETE FROM student_profiles WHERE user_id = ANY(:uids)"),
                {"uids": uids},
            )
            session.execute(
                text("DELETE FROM users WHERE id = ANY(:uids)"),
                {"uids": uids},
            )
            session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def test_roster_bootstrap_unauthenticated(client: TestClient):
    """
    Endpoints must reject calls without Authorization header or X-Setup-Token.
    """
    res = client.post("/api/v1/admin/roster/bootstrap", json={"csv_content": "dummy"})
    assert res.status_code == 401
    assert "detail" in res.json()


def test_roster_bootstrap_invalid_setup_token(client: TestClient):
    """
    Invalid X-Setup-Token header must be rejected with 401.
    """
    res = client.post(
        "/api/v1/admin/roster/bootstrap",
        headers={"X-Setup-Token": "completely_wrong_secret_key"},
        json={"csv_content": "dummy"},
    )
    assert res.status_code == 401
    assert "Invalid setup token" in res.json()["detail"]


def test_roster_bootstrap_with_valid_setup_token_and_csv_content(client: TestClient):
    """
    Using valid X-Setup-Token, student cohort CSV is successfully imported into PostgreSQL:
    - Creates student users and student profiles.
    - Password is set to initial_password ('cce@123') and hashed with Argon2id.
    - must_change_password is True.
    - Student can authenticate via /api/v1/auth/login.
    """
    prefix = uuid.uuid4().hex[:6]
    students = generate_mock_students(count=3, prefix=prefix)
    csv_content = build_csv_text(students)
    all_emails = [s["email"] for s in students]

    try:
        res = client.post(
            "/api/v1/admin/roster/bootstrap",
            headers={"X-Setup-Token": settings.JWT_SECRET_KEY},
            json={
                "csv_content": csv_content,
                "initial_password": "cce@123",
                "provision_admin": True,
            },
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        assert data["students_created"] == 3
        assert data["students_existing"] == 0
        assert data["admin_provisioned"] is True

        # Verify DB records
        session = SessionLocal()
        try:
            db_users = session.scalars(select(User).where(User.email.in_(all_emails))).all()
            assert len(db_users) == 3
            for u in db_users:
                assert u.role == UserRole.STUDENT
                assert u.is_active is True
                assert u.must_change_password is True
                assert verify_password("cce@123", u.password_hash)

            # Test student login via API using register number
            first_student = students[0]
            login_res = client.post(
                "/api/v1/auth/login",
                json={
                    "email": first_student["register_number"],
                    "password": "cce@123",
                },
            )
            assert login_res.status_code == 200, login_res.text
            login_data = login_res.json()
            assert login_data["role"] == "student"
            assert "access_token" in login_data

            # Query /api/v1/auth/me to verify user profile and must_change_password
            me_res = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {login_data['access_token']}"},
            )
            assert me_res.status_code == 200, me_res.text
            me_data = me_res.json()
            assert me_data["must_change_password"] is True
            assert me_data["role"] == "student"
            assert me_data["email"] == first_student["email"]

        finally:
            session.close()

    finally:
        cleanup_users(all_emails)


def test_roster_bootstrap_idempotent_duplicate_import(client: TestClient):
    """
    Importing the same roster again should be idempotent:
    - 0 created, existing count reported.
    - Existing passwords and must_change_password flags are preserved without modification.
    """
    prefix = uuid.uuid4().hex[:6]
    students = generate_mock_students(count=2, prefix=prefix)
    csv_content = build_csv_text(students)
    all_emails = [s["email"] for s in students]

    try:
        # First import
        res1 = client.post(
            "/api/v1/admin/roster/bootstrap",
            headers={"X-Setup-Token": settings.JWT_SECRET_KEY},
            json={"csv_content": csv_content, "initial_password": "cce@123"},
        )
        assert res1.status_code == 200
        assert res1.json()["students_created"] == 2

        # Second import (same data)
        res2 = client.post(
            "/api/v1/admin/roster/bootstrap",
            headers={"X-Setup-Token": settings.JWT_SECRET_KEY},
            json={"csv_content": csv_content, "initial_password": "different_pw"},
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["students_created"] == 0
        assert data2["students_existing"] == 2

        # Verify password was NOT changed to 'different_pw'
        session = SessionLocal()
        try:
            u = session.scalars(select(User).where(User.email == students[0]["email"])).first()
            assert verify_password("cce@123", u.password_hash)
            assert not verify_password("different_pw", u.password_hash)
        finally:
            session.close()

    finally:
        cleanup_users(all_emails)


def test_roster_bootstrap_malformed_csv(client: TestClient):
    """
    Malformed CSV or missing required columns must be rejected with 422.
    """
    bad_csv = "dummy_col1,dummy_col2\nval1,val2\n"
    res = client.post(
        "/api/v1/admin/roster/bootstrap",
        headers={"X-Setup-Token": settings.JWT_SECRET_KEY},
        json={"csv_content": bad_csv},
    )
    assert res.status_code == 422
    assert "validation failed" in res.json()["detail"].lower()


def test_roster_upload_csv_endpoint(client: TestClient):
    """
    Upload CSV endpoint parses multipart file upload, validates, and provisions students.
    """
    prefix = uuid.uuid4().hex[:6]
    students = generate_mock_students(count=2, prefix=prefix)
    csv_content = build_csv_text(students)
    all_emails = [s["email"] for s in students]

    try:
        res = client.post(
            "/api/v1/admin/roster/upload-csv",
            headers={"X-Setup-Token": settings.JWT_SECRET_KEY},
            files={"file": ("roster.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
            data={"initial_password": "cce@123", "provision_admin": "true"},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        assert data["students_created"] == 2
        assert "initial_password" not in data
        assert "password" not in data
    finally:
        cleanup_users(all_emails)


def test_roster_upload_csv_rejects_non_csv(client: TestClient):
    """
    Uploading a non-.csv file should return 400 Bad Request.
    """
    res = client.post(
        "/api/v1/admin/roster/upload-csv",
        headers={"X-Setup-Token": settings.JWT_SECRET_KEY},
        files={"file": ("roster.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert res.status_code == 400
    assert "must be a .csv file" in res.json()["detail"].lower()


def test_roster_bootstrap_with_admin_bearer_token(client: TestClient):
    """
    Authenticated Admin Bearer token can successfully authorize roster bootstrap.
    """
    prefix = uuid.uuid4().hex[:6]
    admin_email = f"admin_{prefix}@sairam.edu.in"
    students = generate_mock_students(count=2, prefix=prefix)
    csv_content = build_csv_text(students)
    all_emails = [admin_email] + [s["email"] for s in students]

    session = SessionLocal()
    try:
        admin_user = User(
            id=uuid.uuid4(),
            full_name=f"Admin {prefix}",
            email=admin_email,
            password_hash=get_password_hash("adminPass123!"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(admin_user)
        session.commit()
        session.refresh(admin_user)

        admin_token = create_access_token(subject=admin_user.id, role="admin")

        res = client.post(
            "/api/v1/admin/roster/bootstrap",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"csv_content": csv_content, "initial_password": "cce@123"},
        )
        assert res.status_code == 200, res.text
        assert res.json()["students_created"] == 2
    finally:
        session.close()
        cleanup_users(all_emails)


def test_roster_bootstrap_forbidden_for_student_bearer_token(client: TestClient):
    """
    Non-admin user (e.g. Student) Bearer token must receive 403 Forbidden.
    """
    prefix = uuid.uuid4().hex[:6]
    student_email = f"student_{prefix}@sairam.edu.in"

    session = SessionLocal()
    try:
        student_user = User(
            id=uuid.uuid4(),
            full_name=f"Student {prefix}",
            email=student_email,
            password_hash=get_password_hash("studentPass123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        session.add(student_user)
        session.commit()
        session.refresh(student_user)

        student_token = create_access_token(subject=student_user.id, role="student")

        res = client.post(
            "/api/v1/admin/roster/bootstrap",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"csv_content": "dummy"},
        )
        assert res.status_code == 403
        assert "forbidden" in res.json()["detail"].lower()
        assert "admin" in res.json()["detail"].lower()
    finally:
        session.close()
        cleanup_users([student_email])


def test_roster_bootstrap_partial_failure_atomic_rollback(client: TestClient):
    """
    If a roster contains invalid data on any row, the entire transaction rolls back.
    No partial or corrupted student records remain inserted in the database.
    """
    prefix = uuid.uuid4().hex[:6]
    students = generate_mock_students(count=2, prefix=prefix)
    # Inject bad student data on row 3
    bad_rows = (
        f"{students[0]['register_number']},{students[0]['full_name']},{students[0]['email']},{students[0]['section']},{students[0]['mentor_reference']}\n"
        f"INVALID_REG,Bad Student,not-an-email,A,unassigned\n"
    )
    csv_content = f"register_number,full_name,email,section,mentor_reference\n{bad_rows}"

    res = client.post(
        "/api/v1/admin/roster/bootstrap",
        headers={"X-Setup-Token": settings.JWT_SECRET_KEY},
        json={"csv_content": csv_content},
    )
    assert res.status_code == 422

    # Verify that students[0] was NOT inserted (atomic rollback)
    session = SessionLocal()
    try:
        found = session.scalars(select(User).where(User.email == students[0]["email"])).first()
        assert found is None, "Partial failure violated atomicity; student record was not rolled back!"
    finally:
        session.close()
        cleanup_users([students[0]["email"]])
