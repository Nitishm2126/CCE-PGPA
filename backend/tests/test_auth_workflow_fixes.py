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
