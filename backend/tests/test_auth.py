import uuid
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.db.session import SessionLocal
from app.models.assignment import MentorAssignment
from app.models.user import MentorProfile, StudentProfile, User, UserRole


@pytest.fixture
def db():
    """
    Session fixture with automated teardown to clean up test users.
    """
    session = SessionLocal()
    created_user_ids = []

    def _track(user_id: uuid.UUID):
        created_user_ids.append(user_id)

    session.track_user = _track  # type: ignore

    try:
        yield session
    finally:
        if created_user_ids:
            stmt = select(MentorAssignment).where(
                (MentorAssignment.student_id.in_(created_user_ids))
                | (MentorAssignment.mentor_id.in_(created_user_ids))
            )
            for a in session.scalars(stmt).all():
                session.delete(a)
            session.flush()

            for uid in created_user_ids:
                u = session.get(User, uid)
                if u:
                    session.delete(u)
            session.commit()
        session.close()


def test_password_hashing_and_verification():
    """
    Test Argon2id password hashing and verification.
    """
    password = "MySecurePassword123!"
    hashed = get_password_hash(password)

    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_token_creation_and_validation():
    """
    Test JWT creation, valid decoding, and expiration rejection.
    """
    user_id = uuid.uuid4()
    token = create_access_token(subject=user_id, role="student")
    payload = decode_access_token(token)

    assert payload["sub"] == str(user_id)
    assert payload["role"] == "student"
    assert "exp" in payload

    # Test expired token
    expired_token = create_access_token(
        subject=user_id,
        role="student",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)

    # Test tampered/invalid token
    with pytest.raises(jwt.PyJWTError):
        decode_access_token("invalid.token.structure")


def test_login_successful_student(client: TestClient, db: Session):
    """
    Test successful login returning JWT access token with role.
    """
    password = "TestPassword_123!"
    student = User(
        id=uuid.uuid4(),
        full_name="Valid Student",
        email=f"valid_student_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash(password),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.track_user(student.id)  # type: ignore

    response = client.post(
        "/api/v1/auth/login",
        json={"email": student.email, "password": password},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "student"
    assert data["expires_in_minutes"] == settings.ACCESS_TOKEN_EXPIRE_MINUTES


def test_login_invalid_password_generic_error(client: TestClient, db: Session):
    """
    Verify generic error response on incorrect password without exposing account existence.
    """
    student = User(
        id=uuid.uuid4(),
        full_name="User With Wrong Password",
        email=f"user_wrong_pw_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash("CorrectPassword123"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.track_user(student.id)  # type: ignore

    response = client.post(
        "/api/v1/auth/login",
        json={"email": student.email, "password": "WrongPassword!"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_login_nonexistent_email_generic_error(client: TestClient):
    """
    Verify generic 401 on non-existent email (prevents account enumeration).
    """
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent_account_12345@sairam.edu.in", "password": "AnyPassword123!"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_login_inactive_account_forbidden(client: TestClient, db: Session):
    """
    Verify inactive user account is rejected on login.
    """
    password = "Password123!"
    inactive_user = User(
        id=uuid.uuid4(),
        full_name="Inactive User",
        email=f"inactive_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash(password),
        role=UserRole.STUDENT,
        is_active=False,
    )
    db.add(inactive_user)
    db.commit()
    db.track_user(inactive_user.id)  # type: ignore

    response = client.post(
        "/api/v1/auth/login",
        json={"email": inactive_user.email, "password": password},
    )
    assert response.status_code == 403
    assert "deactivated" in response.json()["detail"]


def test_get_me_endpoint(client: TestClient, db: Session):
    """
    Test GET /api/v1/auth/me returns identity without password hashes.
    """
    user = User(
        id=uuid.uuid4(),
        full_name="Profile Checker",
        email=f"profile_checker_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash("pass"),
        role=UserRole.HOD,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.track_user(user.id)  # type: ignore

    token = create_access_token(subject=user.id, role=user.role.value)

    # Valid call
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user.id)
    assert data["email"] == user.email
    assert data["role"] == "hod"
    assert "password_hash" not in data

    # Missing token
    resp_missing = client.get("/api/v1/auth/me")
    assert resp_missing.status_code == 401

    # Malformed token
    resp_invalid = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer bad.token.here"},
    )
    assert resp_invalid.status_code == 401


def test_student_isolation_and_mentor_info(client: TestClient, db: Session):
    """
    Test GET /api/v1/students/me:
    - Student accesses only own profile and assigned mentor.
    - Non-students (mentor, HOD) receive 403 Forbidden.
    """
    # Create mentor
    mentor = User(
        id=uuid.uuid4(),
        full_name="Assigned Mentor",
        email=f"mentor_assigned_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash("pass"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    mentor_profile = MentorProfile(
        id=uuid.uuid4(),
        user_id=mentor.id,
        staff_id=f"STF_{uuid.uuid4().hex[:4]}",
        department="CCE",
        designation="Assistant Professor",
    )
    # Create student
    student = User(
        id=uuid.uuid4(),
        full_name="Enrolled Student",
        email=f"student_isolated_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    student_profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"REG_{uuid.uuid4().hex[:6]}",
        department="CCE",
        year=2,
        section="B",
    )
    # Assignment
    assignment = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=mentor.id,
        student_id=student.id,
        is_active=True,
    )
    db.add_all([mentor, mentor_profile, student, student_profile, assignment])
    db.commit()
    db.track_user(mentor.id)  # type: ignore
    db.track_user(student.id)  # type: ignore

    student_token = create_access_token(subject=student.id, role="student")
    mentor_token = create_access_token(subject=mentor.id, role="mentor")

    # Student calls /students/me -> Success
    res = client.get(
        "/api/v1/students/me",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(student.id)
    assert data["profile"]["register_number"] == student_profile.register_number
    assert data["assigned_mentor"]["full_name"] == "Assigned Mentor"
    assert data["assigned_mentor"]["staff_id"] == mentor_profile.staff_id

    # Mentor calling /students/me -> 403 Forbidden
    res_mentor = client.get(
        "/api/v1/students/me",
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert res_mentor.status_code == 403


def test_mentor_assigned_students_isolation(client: TestClient, db: Session):
    """
    Test GET /api/v1/mentor/students:
    - Mentor 1 sees ONLY Student A.
    - Mentor 2 sees ONLY Student B.
    - Mentors cannot view unassigned students.
    - Student calling /mentor/students -> 403 Forbidden.
    """
    # Mentor 1 and Student A
    m1 = User(id=uuid.uuid4(), full_name="Mentor One", email=f"m1_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR)
    s1 = User(id=uuid.uuid4(), full_name="Student Alpha", email=f"s1_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT)
    sp1 = StudentProfile(id=uuid.uuid4(), user_id=s1.id, register_number=f"R1_{uuid.uuid4().hex[:4]}", department="CCE", year=2)
    a1 = MentorAssignment(id=uuid.uuid4(), mentor_id=m1.id, student_id=s1.id, is_active=True)

    # Mentor 2 and Student B
    m2 = User(id=uuid.uuid4(), full_name="Mentor Two", email=f"m2_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR)
    s2 = User(id=uuid.uuid4(), full_name="Student Beta", email=f"s2_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT)
    sp2 = StudentProfile(id=uuid.uuid4(), user_id=s2.id, register_number=f"R2_{uuid.uuid4().hex[:4]}", department="CCE", year=2)
    a2 = MentorAssignment(id=uuid.uuid4(), mentor_id=m2.id, student_id=s2.id, is_active=True)

    db.add_all([m1, s1, sp1, a1, m2, s2, sp2, a2])
    db.commit()
    for u in [m1, s1, m2, s2]:
        db.track_user(u.id)  # type: ignore

    t1 = create_access_token(subject=m1.id, role="mentor")
    t2 = create_access_token(subject=m2.id, role="mentor")
    t_student = create_access_token(subject=s1.id, role="student")

    # Mentor 1 check
    r1 = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {t1}"})
    assert r1.status_code == 200
    m1_students = r1.json()
    assert len(m1_students) == 1
    assert m1_students[0]["student_id"] == str(s1.id)
    assert m1_students[0]["full_name"] == "Student Alpha"

    # Mentor 2 check
    r2 = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {t2}"})
    assert r2.status_code == 200
    m2_students = r2.json()
    assert len(m2_students) == 1
    assert m2_students[0]["student_id"] == str(s2.id)
    assert m2_students[0]["full_name"] == "Student Beta"

    # Student cannot call mentor endpoint
    r_forbidden = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {t_student}"})
    assert r_forbidden.status_code == 403


def test_hod_department_students_access(client: TestClient, db: Session):
    """
    Test GET /api/v1/hod/students:
    - HOD can see all department students.
    - Mentors and students calling /hod/students receive 403 Forbidden.
    """
    hod = User(id=uuid.uuid4(), full_name="HOD User", email=f"hod_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.HOD)
    mentor = User(id=uuid.uuid4(), full_name="Mentor Test", email=f"mentor_t_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR)
    student = User(id=uuid.uuid4(), full_name="Student Test", email=f"student_t_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT)
    db.add_all([hod, mentor, student])
    db.commit()
    for u in [hod, mentor, student]:
        db.track_user(u.id)  # type: ignore

    t_hod = create_access_token(subject=hod.id, role="hod")
    t_mentor = create_access_token(subject=mentor.id, role="mentor")
    t_student = create_access_token(subject=student.id, role="student")

    # HOD succeeds
    r_hod = client.get("/api/v1/hod/students", headers={"Authorization": f"Bearer {t_hod}"})
    assert r_hod.status_code == 200
    assert isinstance(r_hod.json(), list)

    # Mentor blocked
    r_m = client.get("/api/v1/hod/students", headers={"Authorization": f"Bearer {t_mentor}"})
    assert r_m.status_code == 403

    # Student blocked
    r_s = client.get("/api/v1/hod/students", headers={"Authorization": f"Bearer {t_student}"})
    assert r_s.status_code == 403


def test_logout_endpoint(client: TestClient, db: Session):
    """
    Test POST /api/v1/auth/logout.
    """
    user = User(
        id=uuid.uuid4(),
        full_name="Logout User",
        email=f"logout_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="h",
        role=UserRole.STUDENT,
    )
    db.add(user)
    db.commit()
    db.track_user(user.id)  # type: ignore

    token = create_access_token(subject=user.id, role="student")
    res = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "discard" in res.json()["message"]


# ==============================================================================
# Comprehensive Authentication Regression Tests
# ==============================================================================

def test_login_by_register_number_success(client: TestClient, db: Session):
    """
    Verify a student can authenticate using their college register number
    instead of full email address.
    """
    reg_no = f"SEC25CO{uuid.uuid4().hex[:4].upper()}"
    password = "StudentSecret123!"
    student = User(
        id=uuid.uuid4(),
        full_name="Reg Number Student",
        email=f"{reg_no.lower()}@sairamtap.edu.in",
        password_hash=get_password_hash(password),
        role=UserRole.STUDENT,
        is_active=True,
    )
    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=reg_no,
        department="CCE",
        year=2,
    )
    db.add_all([student, profile])
    db.commit()
    db.track_user(student.id)  # type: ignore

    # Login using uppercase register number
    resp_upper = client.post(
        "/api/v1/auth/login",
        json={"email": reg_no, "password": password},
    )
    assert resp_upper.status_code == 200
    data_upper = resp_upper.json()
    assert "access_token" in data_upper
    assert data_upper["role"] == "student"

    # Login using lowercase register number
    resp_lower = client.post(
        "/api/v1/auth/login",
        json={"email": reg_no.lower(), "password": password},
    )
    assert resp_lower.status_code == 200
    assert "access_token" in resp_lower.json()


def test_login_empty_password_hash_rejected(client: TestClient, db: Session):
    """
    Verify accounts with missing or empty password hash are safely rejected (401).
    """
    user = User(
        id=uuid.uuid4(),
        full_name="No Hash User",
        email=f"nohash_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.track_user(user.id)  # type: ignore

    res = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "AnyPassword123!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Incorrect email or password."


def test_login_firebase_managed_placeholder_rejected(client: TestClient, db: Session):
    """
    Verify accounts provisioned solely with FIREBASE_MANAGED_ACCOUNT cannot authenticate
    via database password login (prevents bypass).
    """
    admin = User(
        id=uuid.uuid4(),
        full_name="Firebase Only Admin",
        email=f"fb_admin_{uuid.uuid4().hex[:6]}@gmail.com",
        password_hash="FIREBASE_MANAGED_ACCOUNT",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.track_user(admin.id)  # type: ignore

    res = client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": "FIREBASE_MANAGED_ACCOUNT"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Incorrect email or password."


def test_login_database_error_returns_500(client: TestClient):
    """
    Verify that unexpected database query/connection errors return a clean 500 Internal Server Error
    without leaking internal connection details or credentials.
    """
    from unittest.mock import patch
    from sqlalchemy.exc import OperationalError

    with patch("app.api.v1.endpoints.auth.authenticate_user") as mock_auth:
        mock_auth.side_effect = OperationalError("SELECT 1", {}, Exception("Database connection failed"))

        res = client.post(
            "/api/v1/auth/login",
            json={"email": "student@sairamtap.edu.in", "password": "SomePassword123!"},
        )
        assert res.status_code == 500
        assert "Database service error during authentication" in res.json()["detail"]


def test_login_safe_diagnostic_logging(client: TestClient, db: Session, caplog: pytest.LogCaptureFixture):
    """
    Verify that diagnostic logging captures failure categories without exposing passwords.
    """
    import logging
    caplog.set_level(logging.INFO)

    secret_password = "SuperSecretPlainTextPassword_DoNotLog!"

    # 1. Non-existent user
    client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@sairamtap.edu.in", "password": secret_password},
    )
    assert "FailureCategory=USER_NOT_FOUND" in caplog.text
    assert secret_password not in caplog.text

    # 2. Existing user with wrong password
    student = User(
        id=uuid.uuid4(),
        full_name="Logged Student",
        email=f"logged_student_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash("CorrectPassword_123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.track_user(student.id)  # type: ignore

    caplog.clear()
    client.post(
        "/api/v1/auth/login",
        json={"email": student.email, "password": secret_password},
    )
    assert "FailureCategory=PASSWORD_MISMATCH" in caplog.text
    assert secret_password not in caplog.text

    # 3. Successful login
    caplog.clear()
    client.post(
        "/api/v1/auth/login",
        json={"email": student.email, "password": "CorrectPassword_123!"},
    )
    assert "FailureCategory=SUCCESS" in caplog.text
    assert "CorrectPassword_123!" not in caplog.text


def test_login_student_register_number_as_initial_password(client: TestClient, db: Session):
    """
    Verify uninitialized student accounts (must_change_password=True) can authenticate
    using either their institutional default password ('cce@123') or their register number.
    """
    reg_no = f"SEC25CO{uuid.uuid4().hex[:4].upper()}"
    student_user = User(
        id=uuid.uuid4(),
        full_name="First Time Student",
        email=f"{reg_no.lower()}@sairamtap.edu.in",
        password_hash=get_password_hash("cce@123"),
        role=UserRole.STUDENT,
        is_active=True,
        must_change_password=True,
    )
    db.add(student_user)
    db.flush()
    db.track_user(student_user.id)  # type: ignore

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student_user.id,
        register_number=reg_no,
        department="CCE",
        year=2,
        section="A",
        semester="III SEM",
        batch="2025-2029",
    )
    db.add(profile)
    db.commit()

    # Case 1: Authenticate using register number as password
    resp1 = client.post(
        "/api/v1/auth/login",
        json={"email": student_user.email, "password": reg_no},
    )
    assert resp1.status_code == 200
    assert resp1.json()["role"] == "student"

    # Case 2: Authenticate using lowercase register number as password
    resp2 = client.post(
        "/api/v1/auth/login",
        json={"email": reg_no, "password": reg_no.lower()},
    )
    assert resp2.status_code == 200
    assert resp2.json()["role"] == "student"

    # Case 3: Alternate domain prefix fallback (e.g., student typed @sairam.edu.in instead of @sairamtap.edu.in)
    resp3 = client.post(
        "/api/v1/auth/login",
        json={"email": f"{reg_no.lower()}@sairam.edu.in", "password": "cce@123"},
    )
    assert resp3.status_code == 200
    assert resp3.json()["role"] == "student"

    # Case 4: Password with accidental trailing space
    resp4 = client.post(
        "/api/v1/auth/login",
        json={"email": student_user.email, "password": "cce@123 "},
    )
    assert resp4.status_code == 200
    assert resp4.json()["role"] == "student"

    # Case 5: Incorrect password returns 401
    resp5 = client.post(
        "/api/v1/auth/login",
        json={"email": student_user.email, "password": "WrongPassword123!"},
    )
    assert resp5.status_code == 401

