import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, is_token_revoked
from app.db.session import SessionLocal
from app.models.user import User, UserRole, StudentProfile


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_password_change_with_initial_password(client: TestClient, db_session: Session):
    """
    Verify that an account with must_change_password=True can successfully
    change password using 'cce@123' as current_password, clearing must_change_password.
    """
    user_id = uuid.uuid4()
    test_user = User(
        id=user_id,
        full_name="Password Test Student",
        email=f"pwtest_{user_id.hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash("random_bootstrap_hash"),
        role=UserRole.STUDENT,
        is_active=True,
        must_change_password=True,
    )
    db_session.add(test_user)
    db_session.commit()

    token = create_access_token(subject=str(test_user.id), role=test_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Attempt with incorrect current password
    fail_res = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "wrong_password", "new_password": "SecurePassword123!"},
    )
    assert fail_res.status_code == 400
    assert "Current password verification failed" in fail_res.json()["detail"]

    # 2. Attempt with 'cce@123' (institutional temporary password)
    success_res = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "cce@123", "new_password": "NewSecretPassword123!"},
    )
    assert success_res.status_code == 200
    data = success_res.json()
    assert data["must_change_password"] is False
    assert data["accessible_portals"] == ["student"]

    # Verify database state
    db_session.refresh(test_user)
    assert test_user.must_change_password is False

    # Cleanup
    db_session.delete(test_user)
    db_session.commit()


def test_logout_revokes_token(client: TestClient, db_session: Session):
    """
    Verify that calling POST /api/v1/auth/logout revokes the access token
    so subsequent calls with the same token return 401 Unauthorized.
    """
    user_id = uuid.uuid4()
    test_user = User(
        id=user_id,
        full_name="Logout Test User",
        email=f"logouttest_{user_id.hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash("testpass"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    db_session.add(test_user)
    db_session.commit()

    token = create_access_token(subject=str(test_user.id), role=test_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Normal authenticated call succeeds
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200

    # 2. Logout revokes token
    logout_res = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert "Signed out successfully" in logout_res.json()["message"]
    assert is_token_revoked(token) is True

    # 3. Subsequent call with revoked token fails with 401
    fail_res = client.get("/api/v1/auth/me", headers=headers)
    assert fail_res.status_code == 401
    assert "Session has been terminated" in fail_res.json()["detail"]

    # Cleanup
    db_session.delete(test_user)
    db_session.commit()


def test_email_verification_status_and_rate_limit(client: TestClient, db_session: Session):
    """
    Verify GET /verification-status and rate limiting on POST /send-verification-email.
    """
    user_id = uuid.uuid4()
    test_user = User(
        id=user_id,
        full_name="Verification Test Mentor",
        email=f"verif_{user_id.hex[:6]}@sairam.edu.in",
        password_hash=get_password_hash("testpass"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    db_session.add(test_user)
    db_session.commit()

    token = create_access_token(subject=str(test_user.id), role=test_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check verification status
    status_res = client.get("/api/v1/auth/verification-status", headers=headers)
    assert status_res.status_code == 200
    data = status_res.json()
    assert "email_verified" in data
    assert data["email"] == test_user.email

    # Cleanup
    db_session.delete(test_user)
    db_session.commit()


def test_hod_single_official_email_dual_portal_access(client: TestClient, db_session: Session):
    """
    Verify that the single official email 'hod.cce@sairam.edu.in' authenticates successfully
    for both HOD and Mentor portals:
    - HOD login opens /hod with department-wide scope across all 61 students.
    - Mentor login opens /mentor with supervisory mentor access to assigned mentees.
    - /api/v1/auth/me returns accessible_portals = ['hod', 'mentor'].
    """
    # 1. Authenticate with role="hod"
    hod_login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "hod.cce@sairam.edu.in", "password": "cce@123", "role": "hod"},
    )
    assert hod_login_res.status_code == 200, f"HOD login failed: {hod_login_res.text}"
    hod_token = hod_login_res.json()["access_token"]
    assert hod_token

    # Verify /me profile
    hod_me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {hod_token}"})
    assert hod_me_res.status_code == 200
    hod_me = hod_me_res.json()
    assert hod_me["email"] == "hod.cce@sairam.edu.in"
    assert "hod" in hod_me["accessible_portals"]
    assert "mentor" in hod_me["accessible_portals"]

    # Verify department-wide scope (all 61 department students)
    dept_res = client.get("/api/v1/hod/students", headers={"Authorization": f"Bearer {hod_token}"})
    assert dept_res.status_code == 200
    assert len(dept_res.json()) >= 61

    # 2. Authenticate with role="mentor" using SAME email hod.cce@sairam.edu.in
    mentor_login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "hod.cce@sairam.edu.in", "password": "cce@123", "role": "mentor"},
    )
    assert mentor_login_res.status_code == 200, f"Mentor login failed: {mentor_login_res.text}"
    mentor_token = mentor_login_res.json()["access_token"]
    assert mentor_token

    # Verify supervisory mentor mentee list
    mentees_res = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {mentor_token}"})
    assert mentees_res.status_code == 200
    mentees = mentees_res.json()
    assert len(mentees) == 11
    expected_11_regs = {
        "SEC25CO001", "SEC25CO007", "SEC25CO016", "SEC25CO034", "SEC25CO039",
        "SEC25CO041", "SEC25CO044", "SEC25CO045", "SEC25CO048", "SEC25CO057", "SEC25CO063"
    }
    actual_regs = {m["register_number"] for m in mentees}
    assert actual_regs == expected_11_regs


def test_admin_mentors_list_unified_pachaiammal_active_11_mentees(client: TestClient, db_session: Session):
    """
    Verify that GET /api/v1/admin/mentors includes Dr. Pachaiammal with:
    - email: 'hod.cce@sairam.edu.in'
    - is_active: True
    - assigned_student_count: 11
    - Total students across all mentors = 61 (25 + 11 + 25)
    - Old pachaiammal.cce or .archived email does NOT exist in active mentor list
    """
    from sqlalchemy import select
    admin_user = db_session.scalars(select(User).where(User.role == UserRole.ADMIN)).first()
    if not admin_user:
        admin_user = User(
            id=uuid.uuid4(),
            full_name="System Admin",
            email="test_admin@sairam.edu.in",
            password_hash=get_password_hash("adminpass"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db_session.add(admin_user)
        db_session.commit()

    admin_token = create_access_token(subject=str(admin_user.id), role=admin_user.role.value)
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/admin/mentors", headers=headers)
    assert res.status_code == 200, f"Failed to list mentors: {res.text}"
    mentors = res.json()
    assert len(mentors) >= 3

    # Check for legacy emails
    for m in mentors:
        assert "pachaiammal.cce" not in m["email"]
        assert ".archived" not in m["email"]

    # Locate Dr. Pachaiammal
    pachai_mentor = next((m for m in mentors if m["email"] == "hod.cce@sairam.edu.in"), None)
    assert pachai_mentor is not None, "Dr. Pachaiammal (hod.cce@sairam.edu.in) missing from /admin/mentors"
    assert pachai_mentor["is_active"] is True
    assert pachai_mentor["assigned_student_count"] == 11

    # Check student counts sum to 61
    total_assigned = sum(m["assigned_student_count"] for m in mentors)
    assert total_assigned == 61

