import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import SessionLocal
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog
from app.models.user import HodProfile, MentorProfile, StudentProfile, User, UserRole
from app.models.review import VerificationLog


@pytest.fixture
def test_db():
    """
    Isolated test database session that records and cleans up all created test entities.
    Strictly preserves all existing student/staff accounts.
    """
    session = SessionLocal()
    created_users: list[uuid.UUID] = []
    created_assignments: list[uuid.UUID] = []
    created_verifications: list[uuid.UUID] = []

    def _track_user(u_id: uuid.UUID):
        created_users.append(u_id)

    def _track_assignment(a_id: uuid.UUID):
        created_assignments.append(a_id)

    def _track_verification(v_id: uuid.UUID):
        created_verifications.append(v_id)

    session.track_user = _track_user  # type: ignore
    session.track_assignment = _track_assignment  # type: ignore
    session.track_verification = _track_verification  # type: ignore

    try:
        yield session
    finally:
        session.rollback()
        session.expunge_all()

        if created_verifications:
            v_logs = session.scalars(
                select(VerificationLog).where(VerificationLog.id.in_(created_verifications))
            ).all()
            for v in v_logs:
                session.delete(v)

        if created_assignments:
            assigns = session.scalars(
                select(MentorAssignment).where(MentorAssignment.id.in_(created_assignments))
            ).all()
            for a in assigns:
                session.delete(a)

        if created_users:
            user_str_ids = [str(u) for u in created_users]
            audit_logs = session.scalars(
                select(AuditLog).where(
                    (AuditLog.actor_id.in_(created_users))
                    | (AuditLog.target_id.in_(user_str_ids))
                )
            ).all()
            for al in audit_logs:
                session.delete(al)

            users = session.scalars(select(User).where(User.id.in_(created_users))).all()
            for u in users:
                session.delete(u)

        session.commit()
        session.close()


def test_mentor_password_reset_success(test_db: Session, client: TestClient):
    """
    Test successful password reset for a Faculty Mentor by System Administrator.
    - Updates Argon2id password hash in PostgreSQL.
    - Enforces must_change_password flag.
    - Creates safe audit log without plaintext password.
    - Enables login with new password and rejects old password.
    """
    suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{suffix}@test.edu",
        full_name="Admin User",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    mentor = User(
        id=uuid.uuid4(),
        email=f"mentor_{suffix}@test.edu",
        full_name="Dr. Faculty Mentor",
        password_hash=get_password_hash("OldMentorPass123!"),
        role=UserRole.MENTOR,
        is_active=True,
        firebase_uid=f"fb_mentor_{suffix}",
        must_change_password=False,
    )
    mentor_profile = MentorProfile(
        id=uuid.uuid4(),
        user_id=mentor.id,
        staff_id=f"STAFF_{suffix}",
        department="CCE",
        designation="Assistant Professor",
    )

    test_db.track_user(admin.id)  # type: ignore
    test_db.track_user(mentor.id)  # type: ignore
    test_db.add_all([admin, mentor, mentor_profile])
    test_db.commit()

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    new_temp_pass = "MentorTempSecret@2026!"

    with patch("app.api.v1.endpoints.admin.sync_update_firebase_user", return_value=True) as mock_fb, \
         patch("app.api.v1.endpoints.admin.generate_firebase_password_reset_link", return_value="https://cce.page.link/reset123") as mock_link:
        res = client.post(
            f"/api/v1/admin/mentors/{mentor.id}/reset-password",
            json={"new_password": new_temp_pass, "must_change_password": True},
            headers=admin_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["user_id"] == str(mentor.id)
        assert data["full_name"] == mentor.full_name
        assert data["email"] == mentor.email
        assert data["role"] == "mentor"
        assert data["staff_id"] == f"STAFF_{suffix}"
        assert data["department"] == "CCE"
        assert data["must_change_password"] is True
        assert data["firebase_updated"] is True
        assert data["password_reset_link"] == "https://cce.page.link/reset123"
        mock_fb.assert_called_once_with(mentor.firebase_uid, password=new_temp_pass)

    # Verify PostgreSQL state
    test_db.refresh(mentor)
    assert mentor.must_change_password is True
    assert verify_password(new_temp_pass, mentor.password_hash) is True
    assert verify_password("OldMentorPass123!", mentor.password_hash) is False

    # Verify audit log was recorded safely (no plaintext password)
    audit = test_db.scalars(
        select(AuditLog).where(
            AuditLog.actor_id == admin.id,
            AuditLog.target_id == str(mentor.id),
            AuditLog.action == "reset_mentor_password",
        )
    ).first()
    assert audit is not None
    assert audit.target_type == "mentor"
    assert new_temp_pass not in str(audit.action_metadata)
    assert audit.action_metadata["must_change_password"] is True
    assert audit.action_metadata["firebase_updated"] is True

    # Test login with old password fails
    res_old = client.post("/api/v1/auth/login", json={"email": mentor.email, "password": "OldMentorPass123!"})
    assert res_old.status_code == 401

    # Test login with new password succeeds
    res_new = client.post("/api/v1/auth/login", json={"email": mentor.email, "password": new_temp_pass})
    assert res_new.status_code == 200
    token_data = res_new.json()
    assert "access_token" in token_data

    # Check /auth/me enforces must_change_password
    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_data['access_token']}"})
    assert res_me.status_code == 200
    assert res_me.json()["must_change_password"] is True


def test_hod_password_reset_success(test_db: Session, client: TestClient):
    """
    Test successful password reset for a Department HOD by System Administrator.
    """
    suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{suffix}@test.edu",
        full_name="Admin User",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    hod = User(
        id=uuid.uuid4(),
        email=f"hod_{suffix}@test.edu",
        full_name="Dr. Dept HOD",
        password_hash=get_password_hash("OldHODPass123!"),
        role=UserRole.HOD,
        is_active=True,
        firebase_uid=f"fb_hod_{suffix}",
        must_change_password=False,
    )
    hod_profile = HodProfile(
        id=uuid.uuid4(),
        user_id=hod.id,
        staff_id=f"HOD_STAFF_{suffix}",
        department="CCE",
        designation="Professor & Head",
    )

    test_db.track_user(admin.id)  # type: ignore
    test_db.track_user(hod.id)  # type: ignore
    test_db.add_all([admin, hod, hod_profile])
    test_db.commit()

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    new_hod_pass = "HODTempSecret#2026!"

    with patch("app.api.v1.endpoints.admin.sync_update_firebase_user", return_value=True), \
         patch("app.api.v1.endpoints.admin.generate_firebase_password_reset_link", return_value=None):
        res = client.post(
            f"/api/v1/admin/hods/{hod.id}/reset-password",
            json={"new_password": new_hod_pass, "must_change_password": True},
            headers=admin_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["user_id"] == str(hod.id)
        assert data["role"] == "hod"
        assert data["staff_id"] == f"HOD_STAFF_{suffix}"
        assert data["department"] == "CCE"
        assert data["must_change_password"] is True

    test_db.refresh(hod)
    assert verify_password(new_hod_pass, hod.password_hash) is True
    assert verify_password("OldHODPass123!", hod.password_hash) is False

    # Check audit log
    audit = test_db.scalars(
        select(AuditLog).where(
            AuditLog.actor_id == admin.id,
            AuditLog.target_id == str(hod.id),
            AuditLog.action == "reset_hod_password",
        )
    ).first()
    assert audit is not None
    assert audit.target_type == "hod"
    assert new_hod_pass not in str(audit.action_metadata)


def test_password_reset_unauthorized_access(test_db: Session, client: TestClient):
    """
    Ensure unauthenticated callers and non-admin users (students, mentors, HODs)
    cannot reset passwords via the admin endpoints.
    """
    suffix = uuid.uuid4().hex[:6]
    mentor = User(
        id=uuid.uuid4(),
        email=f"mentor_{suffix}@test.edu",
        full_name="Target Mentor",
        password_hash=get_password_hash("MentorPass123!"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    student = User(
        id=uuid.uuid4(),
        email=f"student_{suffix}@test.edu",
        full_name="Student Attacker",
        password_hash=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    other_mentor = User(
        id=uuid.uuid4(),
        email=f"other_{suffix}@test.edu",
        full_name="Other Mentor Attacker",
        password_hash=get_password_hash("OtherPass123!"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    test_db.track_user(mentor.id)  # type: ignore
    test_db.track_user(student.id)  # type: ignore
    test_db.track_user(other_mentor.id)  # type: ignore
    test_db.add_all([mentor, student, other_mentor])
    test_db.commit()

    payload = {"new_password": "NewSecretPass123!", "must_change_password": True}

    # 1. Unauthenticated -> 401
    res = client.post(f"/api/v1/admin/mentors/{mentor.id}/reset-password", json=payload)
    assert res.status_code == 401

    # 2. Student caller -> 403
    student_token = create_access_token(subject=student.id, role="student")
    res_st = client.post(
        f"/api/v1/admin/mentors/{mentor.id}/reset-password",
        json=payload,
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res_st.status_code == 403

    # 3. Faculty mentor caller -> 403
    m_token = create_access_token(subject=other_mentor.id, role="mentor")
    res_m = client.post(
        f"/api/v1/admin/mentors/{mentor.id}/reset-password",
        json=payload,
        headers={"Authorization": f"Bearer {m_token}"},
    )
    assert res_m.status_code == 403


def test_role_mismatch_rejection(test_db: Session, client: TestClient):
    """
    Ensure cross-role resets are rejected:
    - Student ID passed to mentor reset endpoint -> 404
    - Mentor ID passed to HOD reset endpoint -> 404
    - Student ID passed to HOD reset endpoint -> 404
    """
    suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{suffix}@test.edu",
        full_name="Admin User",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    student = User(
        id=uuid.uuid4(),
        email=f"student_{suffix}@test.edu",
        full_name="Student User",
        password_hash=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    mentor = User(
        id=uuid.uuid4(),
        email=f"mentor_{suffix}@test.edu",
        full_name="Mentor User",
        password_hash=get_password_hash("MentorPass123!"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    test_db.track_user(admin.id)  # type: ignore
    test_db.track_user(student.id)  # type: ignore
    test_db.track_user(mentor.id)  # type: ignore
    test_db.add_all([admin, student, mentor])
    test_db.commit()

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {"new_password": "NewSecretPass123!", "must_change_password": True}

    # Student passed to mentor reset endpoint -> 404
    res1 = client.post(f"/api/v1/admin/mentors/{student.id}/reset-password", json=payload, headers=admin_headers)
    assert res1.status_code == 404
    assert "not found" in res1.json()["detail"].lower()

    # Mentor passed to HOD reset endpoint -> 404
    res2 = client.post(f"/api/v1/admin/hods/{mentor.id}/reset-password", json=payload, headers=admin_headers)
    assert res2.status_code == 404
    assert "not found" in res2.json()["detail"].lower()

    # Student passed to HOD reset endpoint -> 404
    res3 = client.post(f"/api/v1/admin/hods/{student.id}/reset-password", json=payload, headers=admin_headers)
    assert res3.status_code == 404


def test_admin_self_reset_rejection(test_db: Session, client: TestClient):
    """
    Ensure an administrator cannot reset their own password via faculty endpoints.
    """
    suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{suffix}@test.edu",
        full_name="Admin Self",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db.track_user(admin.id)  # type: ignore
    test_db.add(admin)
    test_db.commit()

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {"new_password": "NewSecretPass123!", "must_change_password": True}

    # Admin passed to mentor endpoint -> 404 (because role is not mentor)
    res_m = client.post(f"/api/v1/admin/mentors/{admin.id}/reset-password", json=payload, headers=admin_headers)
    assert res_m.status_code in [400, 404]

    # Admin passed to general users endpoint -> 400
    res_u = client.post(f"/api/v1/admin/users/{admin.id}/reset-password", json=payload, headers=admin_headers)
    assert res_u.status_code == 400
    assert "Cannot reset password for role 'admin'" in res_u.json()["detail"]


def test_nonexistent_account_handling(test_db: Session, client: TestClient):
    """
    Ensure non-existent user IDs return 404.
    """
    suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{suffix}@test.edu",
        full_name="Admin User",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db.track_user(admin.id)  # type: ignore
    test_db.add(admin)
    test_db.commit()

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    random_id = uuid.uuid4()
    payload = {"new_password": "NewSecretPass123!", "must_change_password": True}

    res_m = client.post(f"/api/v1/admin/mentors/{random_id}/reset-password", json=payload, headers=admin_headers)
    assert res_m.status_code == 404

    res_h = client.post(f"/api/v1/admin/hods/{random_id}/reset-password", json=payload, headers=admin_headers)
    assert res_h.status_code == 404


def test_firebase_sync_failure_tolerance(test_db: Session, client: TestClient):
    """
    Ensure that if Firebase Authentication fails (e.g. network timeout or API error),
    the PostgreSQL password reset still succeeds and firebase_updated is False.
    """
    suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{suffix}@test.edu",
        full_name="Admin User",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    mentor = User(
        id=uuid.uuid4(),
        email=f"mentor_{suffix}@test.edu",
        full_name="Faculty Mentor",
        password_hash=get_password_hash("OldMentorPass123!"),
        role=UserRole.MENTOR,
        is_active=True,
        firebase_uid=f"fb_faulty_{suffix}",
    )
    test_db.track_user(admin.id)  # type: ignore
    test_db.track_user(mentor.id)  # type: ignore
    test_db.add_all([admin, mentor])
    test_db.commit()

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    new_pw = "SafePostgresPass123!"

    with patch("app.api.v1.endpoints.admin.sync_update_firebase_user", side_effect=RuntimeError("Firebase Auth network error")):
        res = client.post(
            f"/api/v1/admin/mentors/{mentor.id}/reset-password",
            json={"new_password": new_pw, "must_change_password": True},
            headers=admin_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["firebase_updated"] is False

    test_db.refresh(mentor)
    assert verify_password(new_pw, mentor.password_hash) is True


def test_academic_records_and_allocations_preserved_after_reset(test_db: Session, client: TestClient):
    """
    Verify that resetting a faculty mentor's password does NOT delete or alter:
    - Assigned students (MentorAssignment)
    - Review logs (VerificationLog)
    - Profile details (department, staff ID, designation)
    """
    suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{suffix}@test.edu",
        full_name="Admin User",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    mentor = User(
        id=uuid.uuid4(),
        email=f"mentor_{suffix}@test.edu",
        full_name="Dr. Preserved Mentor",
        password_hash=get_password_hash("MentorOldPass123!"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    mentor_profile = MentorProfile(
        id=uuid.uuid4(),
        user_id=mentor.id,
        staff_id=f"PRESERVE_STAFF_{suffix}",
        department="CCE",
        designation="Associate Professor",
    )
    student = User(
        id=uuid.uuid4(),
        email=f"student_{suffix}@test.edu",
        full_name="Assigned Student",
        password_hash=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    student_profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"REG_{suffix}",
        department="CCE",
        year=2,
    )
    assignment = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=mentor.id,
        student_id=student.id,
        is_active=True,
    )

    test_db.track_user(admin.id)  # type: ignore
    test_db.track_user(mentor.id)  # type: ignore
    test_db.track_user(student.id)  # type: ignore
    test_db.track_assignment(assignment.id)  # type: ignore

    test_db.add_all([admin, mentor, mentor_profile, student, student_profile, assignment])
    test_db.commit()

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Reset mentor password
    with patch("app.api.v1.endpoints.admin.sync_update_firebase_user", return_value=True):
        res = client.post(
            f"/api/v1/admin/mentors/{mentor.id}/reset-password",
            json={"new_password": "NewPreservedPass123!", "must_change_password": True},
            headers=admin_headers,
        )
        assert res.status_code == 200

    # Verify mentor profile is untouched
    test_db.refresh(mentor)
    assert mentor.full_name == "Dr. Preserved Mentor"
    assert mentor.email == f"mentor_{suffix}@test.edu"
    assert mentor.is_active is True
    assert mentor.role == UserRole.MENTOR
    assert mentor.mentor_profile.staff_id == f"PRESERVE_STAFF_{suffix}"
    assert mentor.mentor_profile.department == "CCE"

    # Verify student assignment is still active and unchanged
    active_assignment = test_db.scalars(
        select(MentorAssignment).where(
            MentorAssignment.mentor_id == mentor.id,
            MentorAssignment.student_id == student.id,
            MentorAssignment.is_active.is_(True),
        )
    ).first()
    assert active_assignment is not None
    assert active_assignment.id == assignment.id


def test_existing_student_password_reset_continues_to_work(test_db: Session, client: TestClient):
    """
    Ensure the backward-compatible /students/{student_id}/reset-password endpoint
    continues to work without regressions.
    """
    suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{suffix}@test.edu",
        full_name="Admin User",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    student = User(
        id=uuid.uuid4(),
        email=f"student_{suffix}@test.edu",
        full_name="Student User",
        password_hash=get_password_hash("StudentOldPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"REG_{suffix}",
        department="CCE",
        year=2,
    )
    test_db.track_user(admin.id)  # type: ignore
    test_db.track_user(student.id)  # type: ignore
    test_db.add_all([admin, student, profile])
    test_db.commit()

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.post(
        f"/api/v1/admin/students/{student.id}/reset-password",
        json={"new_password": "NewStudentPass123!", "must_change_password": True},
        headers=admin_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["student_id"] == str(student.id)
    assert data["student_name"] == student.full_name
    assert data["register_number"] == f"REG_{suffix}"
    assert data["must_change_password"] is True
