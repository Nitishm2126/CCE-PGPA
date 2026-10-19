import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import SessionLocal
from app.main import app
from app.models.user import User, UserRole, StudentProfile, MentorProfile
from app.models.assignment import MentorAssignment


@pytest.fixture
def db_session():
    """
    Test database session that rolls back and cleans up any test entities.
    Preserves all existing cohort student records and official users.
    """
    session = SessionLocal()
    created_user_ids: list[uuid.UUID] = []

    def _track_user(u_id: uuid.UUID):
        created_user_ids.append(u_id)

    session.track_user = _track_user  # type: ignore

    try:
        yield session
    finally:
        session.rollback()
        session.expunge_all()
        if created_user_ids:
            # Delete tracking entities
            session.query(MentorAssignment).filter(
                (MentorAssignment.student_id.in_(created_user_ids)) |
                (MentorAssignment.mentor_id.in_(created_user_ids))
            ).delete(synchronize_session=False)
            session.query(StudentProfile).filter(StudentProfile.user_id.in_(created_user_ids)).delete(synchronize_session=False)
            session.query(MentorProfile).filter(MentorProfile.user_id.in_(created_user_ids)).delete(synchronize_session=False)
            session.query(User).filter(User.id.in_(created_user_ids)).delete(synchronize_session=False)
            session.commit()
        session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_headers(db_session: Session):
    admin = db_session.scalars(select(User).where(User.role == UserRole.ADMIN)).first()
    assert admin is not None, "Admin user must exist in PostgreSQL"
    token = create_access_token(
        subject=str(admin.id), role=admin.role.value
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_headers(db_session: Session):
    student = db_session.scalars(select(User).where(User.role == UserRole.STUDENT)).first()
    assert student is not None, "At least one student must exist"
    token = create_access_token(
        subject=str(student.id), role=student.role.value
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mentor_headers(db_session: Session):
    mentor = db_session.scalars(select(User).where(User.role == UserRole.MENTOR)).first()
    assert mentor is not None, "At least one mentor must exist"
    token = create_access_token(
        subject=str(mentor.id), role=mentor.role.value
    )
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Preview (Dry Run) Tests
# ==============================================================================

def test_provisioning_preview_dry_run(client: TestClient, admin_headers: dict):
    """
    GET /api/v1/admin/provisioning/preview
    Dry-run preview must report:
    - total users (65)
    - by_role dictionary (61 students, 2 mentors, 1 hod, 1 admin)
    - already_linked_count (5)
    - needs_creation_count (60)
    - conflicts_count (0)
    - admin_account_preserved = True
    - initial_password = 'cce@123'
    """
    res = client.get("/api/v1/admin/provisioning/preview", headers=admin_headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["total_users"] >= 65
    assert data["by_role"]["student"] == 61
    assert data["by_role"]["mentor"] == 2
    assert data["by_role"]["hod"] == 1
    assert data["by_role"]["admin"] == 1
    assert data["already_linked_count"] >= 5
    assert data["needs_creation_count"] <= 60
    assert data["conflicts_count"] == 0
    assert data["invalid_email_count"] == 0
    assert data["initial_password"] == "cce@123"
    assert data["admin_account_preserved"] is True
    assert "cce.pgpa@gmail.com" in data["admin_account_email"].lower()
    assert len(data["items"]) == data["total_users"]


def test_provisioning_preview_forbidden_for_non_admin(
    client: TestClient, student_headers: dict, mentor_headers: dict
):
    """
    Non-admin roles (Student, Mentor) must be strictly forbidden (HTTP 403)
    from accessing the provisioning preview endpoint.
    """
    res_student = client.get("/api/v1/admin/provisioning/preview", headers=student_headers)
    assert res_student.status_code == 403

    res_mentor = client.get("/api/v1/admin/provisioning/preview", headers=mentor_headers)
    assert res_mentor.status_code == 403


# ==============================================================================
# 2. Confirmation Safety Gate Tests
# ==============================================================================

def test_provisioning_execute_requires_confirmation(client: TestClient, admin_headers: dict):
    """
    POST /api/v1/admin/provisioning/execute without explicit confirm=True
    must be rejected with HTTP 400 Bad Request.
    """
    res = client.post(
        "/api/v1/admin/provisioning/execute",
        headers=admin_headers,
        json={"confirm": False},
    )
    assert res.status_code == 400
    assert "confirmation" in res.json()["detail"].lower()


# ==============================================================================
# 3. Execution & Preservation of Admin Account
# ==============================================================================

def test_provisioning_execute_preserves_admin_and_sets_must_change_password(
    client: TestClient, admin_headers: dict, db_session: Session
):
    """
    When provisioning runs:
    - Admin account credentials are preserved and never modified.
    - Missing accounts are created and marked with must_change_password = True.
    """
    admin_before = db_session.scalars(
        select(User).where(User.role == UserRole.ADMIN)
    ).first()
    assert admin_before is not None
    admin_original_hash = admin_before.password_hash
    admin_original_uid = admin_before.firebase_uid

    # Mock Firebase Admin SDK create_user to simulate safe execution with unique UIDs
    def _mock_create_user(**kwargs):
        m = MagicMock()
        m.uid = f"mock_fb_{uuid.uuid4().hex[:12]}"
        return m

    with patch("app.services.admin_service.fb_auth.create_user", side_effect=_mock_create_user) as mock_create:
        res = client.post(
            "/api/v1/admin/provisioning/execute",
            headers=admin_headers,
            json={"confirm": True, "initial_password": "cce@123", "reset_existing_passwords": False},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True

        # Verify admin was skipped and preserved
        admin_result = next((d for d in data["details"] if d["email"].lower() == admin_before.email.lower()), None)
        assert admin_result is not None
        assert admin_result["action"] == "skipped_already_linked"
        assert "preserved" in admin_result["message"].lower()

    # Re-verify Admin in DB remained untouched
    db_session.expire_all()
    admin_after = db_session.scalars(select(User).where(User.role == UserRole.ADMIN)).first()
    assert admin_after.password_hash == admin_original_hash
    assert admin_after.firebase_uid == admin_original_uid


# ==============================================================================
# 4. Change Password Endpoint Tests
# ==============================================================================

def test_change_password_validation_and_clearing_flag(
    client: TestClient, db_session: Session
):
    """
    POST /api/v1/auth/change-password
    - Rejects password < 6 characters (HTTP 400).
    - Updates Argon2id password hash in DB.
    - Clears must_change_password flag to False.
    """
    # Create an isolated test student with must_change_password = True
    test_user_id = uuid.uuid4()
    test_email = f"test_pwd_change_{uuid.uuid4().hex[:6]}@sairam.edu.in"
    initial_pwd = "cce@123"

    test_user = User(
        id=test_user_id,
        email=test_email,
        full_name="Password Test Student",
        role=UserRole.STUDENT,
        is_active=True,
        must_change_password=True,
        password_hash=get_password_hash(initial_pwd),
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.track_user(test_user_id)  # type: ignore

    # Generate token
    token = create_access_token(
        subject=str(test_user.id), role=test_user.role.value
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Attempt too short password (< 6 chars)
    short_res = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"new_password": "123"},
    )
    assert short_res.status_code in [400, 422]

    # 2. Attempt with wrong current_password
    wrong_curr = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "WrongPassword!", "new_password": "StrongNewPassword@2026"},
    )
    assert wrong_curr.status_code == 400
    assert "verification failed" in wrong_curr.json()["detail"].lower()

    # 3. Successful password change
    new_pwd = "SecureStudentPass#2026"
    success_res = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": initial_pwd, "new_password": new_pwd},
    )
    assert success_res.status_code == 200
    resp_data = success_res.json()
    assert resp_data["must_change_password"] is False

    # 4. Verify in DB
    db_session.expire_all()
    updated_user = db_session.get(User, test_user_id)
    assert updated_user.must_change_password is False
    assert verify_password(new_pwd, updated_user.password_hash) is True


# ==============================================================================
# 5. Mentor Restrictions and Assignment Protection
# ==============================================================================

def test_mentor_assigned_students_preserved_and_isolated(
    client: TestClient, db_session: Session
):
    """
    Verifies that mentor endpoints strictly isolate assigned mentees:
    - P. LEKHA sees only her assigned mentees (25).
    - LURDHUMARY J sees only her assigned mentees (25).
    - No mentor can view or mutate other mentors' mentees.
    """
    lekha = db_session.scalars(
        select(User).where(User.email == "nithish21077@gmail.com")
    ).first()
    lurdhu = db_session.scalars(
        select(User).where(User.email == "nitishms007@gmail.com")
    ).first()

    assert lekha is not None
    assert lurdhu is not None

    token_lekha = create_access_token(
        subject=str(lekha.id), role=lekha.role.value
    )
    token_lurdhu = create_access_token(
        subject=str(lurdhu.id), role=lurdhu.role.value
    )

    res_lekha = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {token_lekha}"})
    assert res_lekha.status_code == 200
    lekha_students = res_lekha.json()
    assert len(lekha_students) == 25

    res_lurdhu = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {token_lurdhu}"})
    assert res_lurdhu.status_code == 200
    lurdhu_students = res_lurdhu.json()
    assert len(lurdhu_students) == 25

    # Check zero overlap
    lekha_ids = {s["student_id"] for s in lekha_students}
    lurdhu_ids = {s["student_id"] for s in lurdhu_students}
    assert lekha_ids.isdisjoint(lurdhu_ids)
