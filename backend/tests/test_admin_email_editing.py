import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.audit import AuditLog
from app.models.user import User, UserRole


@pytest.fixture
def admin_db():
    session = SessionLocal()
    created_users: list[uuid.UUID] = []

    def _track_user(u_id: uuid.UUID):
        created_users.append(u_id)

    session.track_user = _track_user  # type: ignore

    try:
        yield session
    finally:
        session.rollback()
        session.expunge_all()
        if created_users:
            audit_logs = session.scalars(
                select(AuditLog).where(AuditLog.actor_id.in_(created_users))
            ).all()
            for al in audit_logs:
                session.delete(al)
            users = session.scalars(
                select(User).where(User.id.in_(created_users))
            ).all()
            for u in users:
                session.delete(u)
        session.commit()
        session.close()


def test_admin_email_editing_authorization(client: TestClient, admin_db: Session):
    prefix = uuid.uuid4().hex[:6]
    student = User(
        id=uuid.uuid4(),
        full_name="Target Student",
        email=f"target_{prefix}@test.edu",
        password_hash=get_password_hash("pass123"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    mentor = User(
        id=uuid.uuid4(),
        full_name="Mentor Guard",
        email=f"mentor_{prefix}@test.edu",
        password_hash=get_password_hash("pass123"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    admin_db.add_all([student, mentor])
    admin_db.commit()
    admin_db.track_user(student.id)  # type: ignore
    admin_db.track_user(mentor.id)  # type: ignore

    mentor_token = create_access_token(subject=mentor.id, role="mentor")

    # Non-admin should be forbidden (403)
    resp = client.patch(
        f"/api/v1/admin/users/{student.id}/email",
        headers={"Authorization": f"Bearer {mentor_token}"},
        json={
            "new_email": f"new_{prefix}@test.edu",
            "confirm_new_email": f"new_{prefix}@test.edu",
            "admin_password": "anypassword",
        },
    )
    assert resp.status_code == 403


def test_admin_email_editing_reauth_failure(client: TestClient, admin_db: Session):
    prefix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        full_name="Admin User",
        email=f"admin_{prefix}@test.edu",
        password_hash=get_password_hash("CorrectAdminPassword#123"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    target_user = User(
        id=uuid.uuid4(),
        full_name="Target User",
        email=f"target_{prefix}@test.edu",
        password_hash=get_password_hash("pass123"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    admin_db.add_all([admin, target_user])
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore
    admin_db.track_user(target_user.id)  # type: ignore

    admin_token = create_access_token(subject=admin.id, role="admin")

    # Wrong admin password
    resp = client.patch(
        f"/api/v1/admin/users/{target_user.id}/email",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "new_email": f"updated_{prefix}@test.edu",
            "confirm_new_email": f"updated_{prefix}@test.edu",
            "admin_password": "WrongAdminPassword",
        },
    )
    assert resp.status_code == 401
    assert "Invalid administrator password" in resp.json()["detail"]

    # Verify user email remains unchanged
    refreshed = admin_db.get(User, target_user.id)
    assert refreshed.email == f"target_{prefix}@test.edu"


def test_admin_email_editing_duplicate_email(client: TestClient, admin_db: Session):
    prefix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        full_name="Admin User",
        email=f"admin_{prefix}@test.edu",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    user_a = User(
        id=uuid.uuid4(),
        full_name="User A",
        email=f"usera_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    user_b = User(
        id=uuid.uuid4(),
        full_name="User B",
        email=f"userb_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    admin_db.add_all([admin, user_a, user_b])
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore
    admin_db.track_user(user_a.id)  # type: ignore
    admin_db.track_user(user_b.id)  # type: ignore

    admin_token = create_access_token(subject=admin.id, role="admin")

    # Try updating user_a to user_b's email
    resp = client.patch(
        f"/api/v1/admin/users/{user_a.id}/email",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "new_email": f"userb_{prefix}@test.edu",
            "confirm_new_email": f"userb_{prefix}@test.edu",
            "admin_password": "AdminPass123!",
        },
    )
    assert resp.status_code == 409
    assert "already registered to another account" in resp.json()["detail"]


def test_admin_email_editing_success(client: TestClient, admin_db: Session):
    prefix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        full_name="Super Admin",
        email=f"admin_{prefix}@test.edu",
        password_hash=get_password_hash("AdminSecret999!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    target = User(
        id=uuid.uuid4(),
        full_name="Target Student",
        email=f"old_student_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        firebase_uid=f"fb_uid_{prefix}",
        is_active=True,
    )
    admin_db.add_all([admin, target])
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore
    admin_db.track_user(target.id)  # type: ignore

    admin_token = create_access_token(subject=admin.id, role="admin")
    new_email = f"new_student_{prefix}@test.edu"

    with patch("app.services.admin_service.get_firebase_app") as mock_get_fb, \
         patch("app.services.admin_service.fb_auth.get_user_by_email", side_effect=Exception("Not found")), \
         patch("app.services.admin_service.fb_auth.update_user") as mock_update_user:
        mock_fb_app = MagicMock()
        mock_get_fb.return_value = mock_fb_app

        resp = client.patch(
            f"/api/v1/admin/users/{target.id}/email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "new_email": new_email,
                "confirm_new_email": new_email,
                "admin_password": "AdminSecret999!",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == str(target.id)
        assert data["previous_email"] == f"old_student_{prefix}@test.edu"
        assert data["new_email"] == new_email
        assert data["status"] == "pending_verification"
        assert data["firebase_synced"] is True

        mock_update_user.assert_called_once_with(
            f"fb_uid_{prefix}",
            email=new_email,
            email_verified=False,
            app=mock_fb_app,
        )

    # Verify PostgreSQL was updated
    admin_db.expire_all()
    updated_user = admin_db.get(User, target.id)
    assert updated_user.email == new_email

    # Verify audit log exists
    audit = admin_db.scalars(
        select(AuditLog).where(
            AuditLog.actor_id == admin.id,
            AuditLog.action == "admin_edit_user_email",
            AuditLog.target_id == str(target.id),
        )
    ).first()
    assert audit is not None
    assert audit.action_metadata["previous_email"] == f"old_student_{prefix}@test.edu"
    assert audit.action_metadata["requested_new_email"] == new_email
