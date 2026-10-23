import uuid
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
import firebase_admin.auth
import jwt
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.assignment import MentorAssignment
from app.models.user import MentorProfile, StudentProfile, User, UserRole

# Generate an ephemeral RSA key pair for testing RS256 token headers
_test_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_test_pem = _test_private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)


def create_mock_firebase_id_token(payload: dict) -> str:
    """
    Creates an RS256 JWT simulating a Firebase ID token with 'kid' in header.
    """
    return jwt.encode(
        payload,
        _test_pem,
        algorithm="RS256",
        headers={"kid": "test-firebase-kid-123", "alg": "RS256"},
    )


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


def test_firebase_auth_valid_mapped_uid(client: TestClient, db: Session):
    """
    Test successful authentication when a valid Firebase ID token resolves
    to an existing PostgreSQL user via `firebase_uid`.
    """
    fb_uid = f"fb_uid_{uuid.uuid4().hex[:12]}"
    user = User(
        id=uuid.uuid4(),
        full_name="Firebase Student",
        email=f"fb_student_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="argon2_placeholder",
        firebase_uid=fb_uid,
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.track_user(user.id)  # type: ignore

    token = create_mock_firebase_id_token({"sub": fb_uid, "uid": fb_uid, "email": user.email})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {"uid": fb_uid, "email": user.email}

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user.id)
    assert data["email"] == user.email
    assert data["role"] == "student"
    assert data["firebase_uid"] == fb_uid


def test_firebase_auth_auto_link_unmapped_uid_by_email(client: TestClient, db: Session):
    """
    Test that a pre-provisioned PostgreSQL user with firebase_uid=NULL
    is automatically bound to their verified Firebase UID on first login.
    """
    user_email = f"preprovisioned_{uuid.uuid4().hex[:6]}@sairam.edu.in"
    user = User(
        id=uuid.uuid4(),
        full_name="Preprovisioned Student",
        email=user_email,
        password_hash="argon2_placeholder",
        firebase_uid=None,
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.track_user(user.id)  # type: ignore

    new_fb_uid = f"new_fb_uid_{uuid.uuid4().hex[:12]}"
    token = create_mock_firebase_id_token({"sub": new_fb_uid, "uid": new_fb_uid, "email": user_email})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {"uid": new_fb_uid, "email": user_email}

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user.id)
    assert data["firebase_uid"] == new_fb_uid

    # Verify database persistence of linked UID
    db.expire_all()
    reloaded_user = db.get(User, user.id)
    assert reloaded_user is not None
    assert reloaded_user.firebase_uid == new_fb_uid


def test_firebase_auth_unknown_uid_and_email_rejected(client: TestClient):
    """
    Verify rejection with 401 when a Firebase token belongs to an unprovisioned user.
    Public signup is strictly disabled.
    """
    unknown_fb_uid = f"unregistered_{uuid.uuid4().hex[:12]}"
    token = create_mock_firebase_id_token({"sub": unknown_fb_uid, "uid": unknown_fb_uid, "email": "stranger@gmail.com"})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {"uid": unknown_fb_uid, "email": "stranger@gmail.com"}

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert "Registration is restricted" in response.json()["detail"]


def test_firebase_auth_inactive_account_forbidden(client: TestClient, db: Session):
    """
    Verify rejection with 403 Forbidden when an authenticated Firebase user
    is deactivated in PostgreSQL.
    """
    fb_uid = f"inactive_fb_{uuid.uuid4().hex[:8]}"
    inactive_user = User(
        id=uuid.uuid4(),
        full_name="Deactivated User",
        email=f"deactivated_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="placeholder",
        firebase_uid=fb_uid,
        role=UserRole.STUDENT,
        is_active=False,
    )
    db.add(inactive_user)
    db.commit()
    db.track_user(inactive_user.id)  # type: ignore

    token = create_mock_firebase_id_token({"sub": fb_uid, "uid": fb_uid, "email": inactive_user.email})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {"uid": fb_uid, "email": inactive_user.email}

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403
    assert "Inactive user account" in response.json()["detail"]


def test_firebase_auth_expired_token_rejected(client: TestClient):
    """
    Verify 401 response on expired Firebase ID token.
    """
    token = create_mock_firebase_id_token({"sub": "some_uid"})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.side_effect = firebase_admin.auth.ExpiredIdTokenError("Token expired", None)

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert "expired" in response.json()["detail"]


def test_firebase_auth_invalid_token_rejected(client: TestClient):
    """
    Verify 401 response on invalid Firebase ID token.
    """
    token = create_mock_firebase_id_token({"sub": "some_uid"})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.side_effect = firebase_admin.auth.InvalidIdTokenError("Token invalid")

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert "Invalid Firebase ID token" in response.json()["detail"]


def test_firebase_auth_revoked_token_rejected(client: TestClient):
    """
    Verify 401 response on revoked Firebase ID token.
    """
    token = create_mock_firebase_id_token({"sub": "some_uid"})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.side_effect = firebase_admin.auth.RevokedIdTokenError("Token revoked")

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert "revoked" in response.json()["detail"]


def test_firebase_auth_does_not_fall_back_on_failure(client: TestClient, db: Session):
    """
    Verify Requirement 7: When Firebase token verification fails, the backend
    MUST NOT silently fall back to legacy JWT decoding or legacy credentials.
    """
    # Create valid user that exists in PostgreSQL
    user = User(
        id=uuid.uuid4(),
        full_name="Fallback Check User",
        email=f"fallback_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="placeholder",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.track_user(user.id)  # type: ignore

    # Craft RS256 token containing the user's UUID in the sub claim
    token = create_mock_firebase_id_token({"sub": str(user.id)})

    # Simulate Firebase verification failure
    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.side_effect = firebase_admin.auth.InvalidIdTokenError("Invalid signature")

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    # Must be 401 Unauthorized, never 200 OK from legacy decoding
    assert response.status_code == 401
    assert "Invalid Firebase ID token" in response.json()["detail"]


def test_roles_derived_strictly_from_postgresql_never_token_claims(client: TestClient, db: Session):
    """
    Verify Requirement 5: Roles must come from PostgreSQL, never from client input
    or token claims. Even if a Firebase token has custom claim `role: 'hod'`,
    a student user in PostgreSQL remains strictly restricted to 'student'.
    """
    student_uid = f"fb_student_{uuid.uuid4().hex[:8]}"
    student = User(
        id=uuid.uuid4(),
        full_name="Student With Spoofed Token Claim",
        email=f"spoofed_claim_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="placeholder",
        firebase_uid=student_uid,
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.track_user(student.id)  # type: ignore

    # Token payload attempts to inject HOD role claim
    token = create_mock_firebase_id_token({
        "uid": student_uid,
        "email": student.email,
        "role": "hod",
        "claims": {"role": "hod"},
    })

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        # Firebase returns spoofed role claim
        mock_verify.return_value = {
            "uid": student_uid,
            "email": student.email,
            "role": "hod",
            "claims": {"role": "hod"},
        }

        # Attempt to access HOD endpoint
        hod_resp = client.get(
            "/api/v1/hod/students",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert hod_resp.status_code == 403
        assert "Access forbidden" in hod_resp.json()["detail"]

        # Attempt to access Mentor endpoint
        mentor_resp = client.get(
            "/api/v1/mentor/students",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert mentor_resp.status_code == 403


def test_firebase_role_authorization_enforcement(client: TestClient, db: Session):
    """
    Verify role-based access control under Firebase authentication:
    - Student can access student endpoint, blocked from mentor and hod.
    - Mentor can access mentor endpoint, blocked from student and hod.
    - HOD can access hod endpoint, blocked from student.
    """
    # 1. Create Student
    s_uid = f"s_uid_{uuid.uuid4().hex[:6]}"
    student = User(id=uuid.uuid4(), full_name="S1", email=f"s_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=s_uid, role=UserRole.STUDENT)
    sp = StudentProfile(id=uuid.uuid4(), user_id=student.id, register_number=f"REG_{uuid.uuid4().hex[:4]}", department="CCE", year=2)

    # 2. Create Mentor
    m_uid = f"m_uid_{uuid.uuid4().hex[:6]}"
    mentor = User(id=uuid.uuid4(), full_name="M1", email=f"m_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=m_uid, role=UserRole.MENTOR)
    mp = MentorProfile(id=uuid.uuid4(), user_id=mentor.id, staff_id=f"STF_{uuid.uuid4().hex[:4]}", department="CCE")

    # 3. Create HOD
    h_uid = f"h_uid_{uuid.uuid4().hex[:6]}"
    hod = User(id=uuid.uuid4(), full_name="H1", email=f"h_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=h_uid, role=UserRole.HOD)

    db.add_all([student, sp, mentor, mp, hod])
    db.commit()
    for u in [student, mentor, hod]:
        db.track_user(u.id)  # type: ignore

    s_token = create_mock_firebase_id_token({"uid": s_uid, "email": student.email})
    m_token = create_mock_firebase_id_token({"uid": m_uid, "email": mentor.email})
    h_token = create_mock_firebase_id_token({"uid": h_uid, "email": hod.email})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        # Case A: Student access
        mock_verify.return_value = {"uid": s_uid, "email": student.email}
        assert client.get("/api/v1/students/me", headers={"Authorization": f"Bearer {s_token}"}).status_code == 200
        assert client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {s_token}"}).status_code == 403
        assert client.get("/api/v1/hod/students", headers={"Authorization": f"Bearer {s_token}"}).status_code == 403

        # Case B: Mentor access
        mock_verify.return_value = {"uid": m_uid, "email": mentor.email}
        assert client.get("/api/v1/students/me", headers={"Authorization": f"Bearer {m_token}"}).status_code == 403
        assert client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {m_token}"}).status_code == 200
        assert client.get("/api/v1/hod/students", headers={"Authorization": f"Bearer {m_token}"}).status_code == 403

        # Case C: HOD access (Phase 2: HOD is authorized to access both HOD and Mentor endpoints)
        mock_verify.return_value = {"uid": h_uid, "email": hod.email}
        assert client.get("/api/v1/students/me", headers={"Authorization": f"Bearer {h_token}"}).status_code == 403
        assert client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {h_token}"}).status_code == 200
        assert client.get("/api/v1/hod/students", headers={"Authorization": f"Bearer {h_token}"}).status_code == 200


def test_admin_role_authorization_and_strict_isolation(client: TestClient, db: Session):
    """
    Verify four-role server-side permissions:
    - Admin can access /admin/overview and /admin/users.
    - Admin is strictly barred from student, mentor, and hod domain endpoints.
    - Non-admins (Student, Mentor, HOD) are barred from admin endpoints.
    """
    # Create users for all 4 roles
    a_uid = f"a_uid_{uuid.uuid4().hex[:6]}"
    admin = User(id=uuid.uuid4(), full_name="System Admin", email=f"admin_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=a_uid, role=UserRole.ADMIN)

    s_uid = f"s_uid_{uuid.uuid4().hex[:6]}"
    student = User(id=uuid.uuid4(), full_name="Cohort Student", email=f"s_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=s_uid, role=UserRole.STUDENT)

    m_uid = f"m_uid_{uuid.uuid4().hex[:6]}"
    mentor = User(id=uuid.uuid4(), full_name="Faculty Mentor", email=f"m_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=m_uid, role=UserRole.MENTOR)

    h_uid = f"h_uid_{uuid.uuid4().hex[:6]}"
    hod = User(id=uuid.uuid4(), full_name="HOD User", email=f"h_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=h_uid, role=UserRole.HOD)

    db.add_all([admin, student, mentor, hod])
    db.commit()
    for u in [admin, student, mentor, hod]:
        db.track_user(u.id)  # type: ignore

    a_token = create_mock_firebase_id_token({"uid": a_uid, "email": admin.email})
    s_token = create_mock_firebase_id_token({"uid": s_uid, "email": student.email})
    m_token = create_mock_firebase_id_token({"uid": m_uid, "email": mentor.email})
    h_token = create_mock_firebase_id_token({"uid": h_uid, "email": hod.email})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        # 1. Admin accessing admin endpoints -> 200 OK
        mock_verify.return_value = {"uid": a_uid, "email": admin.email}
        res_overview = client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {a_token}"})
        assert res_overview.status_code == 200
        overview_data = res_overview.json()
        assert overview_data["total_users"] >= 4
        assert overview_data["users_by_role"]["admin"] >= 1
        assert overview_data["system_status"] == "operational"

        res_users = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {a_token}"})
        assert res_users.status_code == 200
        assert isinstance(res_users.json(), list)

        # 2. Strict Role Isolation: Admin cannot access student, mentor, or hod domain routes
        assert client.get("/api/v1/students/me", headers={"Authorization": f"Bearer {a_token}"}).status_code == 403
        assert client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {a_token}"}).status_code == 403
        assert client.get("/api/v1/hod/students", headers={"Authorization": f"Bearer {a_token}"}).status_code == 403

        # 3. Non-admins cannot access admin endpoints
        mock_verify.return_value = {"uid": s_uid, "email": student.email}
        assert client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {s_token}"}).status_code == 403
        assert client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {s_token}"}).status_code == 403

        mock_verify.return_value = {"uid": m_uid, "email": mentor.email}
        assert client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {m_token}"}).status_code == 403
        assert client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {m_token}"}).status_code == 403

        mock_verify.return_value = {"uid": h_uid, "email": hod.email}
        assert client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {h_token}"}).status_code == 403
        assert client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {h_token}"}).status_code == 403


def test_admin_spoofing_defense_and_inactive_admin(client: TestClient, db: Session):
    """
    Verify:
    1. A student attempting to spoof role: 'admin' via token claims is blocked (roles derived strictly from PostgreSQL).
    2. An inactive administrator is rejected with 403 Forbidden.
    """
    # 1. Student spoofing test
    s_uid = f"s_uid_{uuid.uuid4().hex[:6]}"
    student = User(id=uuid.uuid4(), full_name="Student", email=f"s_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=s_uid, role=UserRole.STUDENT)

    # 2. Inactive admin test
    a_uid = f"a_uid_{uuid.uuid4().hex[:6]}"
    inactive_admin = User(id=uuid.uuid4(), full_name="Inactive Admin", email=f"inadmin_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=a_uid, role=UserRole.ADMIN, is_active=False)

    db.add_all([student, inactive_admin])
    db.commit()
    db.track_user(student.id)  # type: ignore
    db.track_user(inactive_admin.id)  # type: ignore

    spoofed_token = create_mock_firebase_id_token({"uid": s_uid, "email": student.email, "role": "admin", "admin": True})
    inactive_token = create_mock_firebase_id_token({"uid": a_uid, "email": inactive_admin.email})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        # Spoofed student claims admin
        mock_verify.return_value = {"uid": s_uid, "email": student.email, "role": "admin", "admin": True}
        res_spoof = client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {spoofed_token}"})
        assert res_spoof.status_code == 403
        assert "Access forbidden" in res_spoof.json()["detail"]

        # Inactive admin
        mock_verify.return_value = {"uid": a_uid, "email": inactive_admin.email}
        res_inactive = client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {inactive_token}"})
        assert res_inactive.status_code == 403
        assert "Inactive user account" in res_inactive.json()["detail"]


def test_verified_but_unprovisioned_firebase_user_rejected_on_all_endpoints(client: TestClient):
    """
    Requirement 9: Verified Firebase user who is NOT provisioned in PostgreSQL
    is rejected with 401 Unauthorized across all protected endpoints.
    No automatic user creation or directory bypass is allowed.
    """
    unprov_uid = f"unprov_uid_{uuid.uuid4().hex[:12]}"
    unprov_email = f"unprovisioned_{uuid.uuid4().hex[:6]}@gmail.com"
    token = create_mock_firebase_id_token({"sub": unprov_uid, "uid": unprov_uid, "email": unprov_email, "email_verified": True})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {"uid": unprov_uid, "email": unprov_email, "email_verified": True}

        # 1. /auth/me rejected
        me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 401
        assert "Registration is restricted" in me_resp.json()["detail"]

        # 2. /mentor/students rejected
        mentor_resp = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {token}"})
        assert mentor_resp.status_code == 401

        # 3. /students/me rejected
        student_resp = client.get("/api/v1/students/me", headers={"Authorization": f"Bearer {token}"})
        assert student_resp.status_code == 401


def test_valid_mentor_login_and_access(client: TestClient, db: Session):
    """
    Requirement 9: Valid authorized mentor authenticates via Firebase,
    backend resolves role strictly from PostgreSQL as 'mentor',
    and mentor can access /mentor/students and /mentor/submissions.
    """
    m_uid = f"m_uid_{uuid.uuid4().hex[:8]}"
    mentor = User(
        id=uuid.uuid4(),
        full_name="Dr. Valid Mentor",
        email=f"mentor_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="placeholder",
        firebase_uid=m_uid,
        role=UserRole.MENTOR,
        is_active=True,
    )
    mp = MentorProfile(
        id=uuid.uuid4(),
        user_id=mentor.id,
        staff_id=f"STF_{uuid.uuid4().hex[:4]}",
        department="CCE",
        designation="Assistant Professor",
    )
    s_uid = f"s_uid_{uuid.uuid4().hex[:8]}"
    student = User(
        id=uuid.uuid4(),
        full_name="Assigned Student",
        email=f"assigned_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="placeholder",
        firebase_uid=s_uid,
        role=UserRole.STUDENT,
        is_active=True,
    )
    sp = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"REG_{uuid.uuid4().hex[:4]}",
        department="CCE",
        year=2,
        section="A",
    )
    assignment = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=mentor.id,
        student_id=student.id,
        is_active=True,
    )

    db.add_all([mentor, mp, student, sp, assignment])
    db.commit()
    db.track_user(mentor.id)  # type: ignore
    db.track_user(student.id)  # type: ignore

    token = create_mock_firebase_id_token({"uid": m_uid, "email": mentor.email, "email_verified": True})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {"uid": m_uid, "email": mentor.email, "email_verified": True}

        # 1. /auth/me returns role 'mentor'
        res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res_me.status_code == 200
        data_me = res_me.json()
        assert data_me["role"] == "mentor"
        assert data_me["email"] == mentor.email
        assert data_me["full_name"] == "Dr. Valid Mentor"

        # 2. /mentor/students returns assigned student
        res_roster = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {token}"})
        assert res_roster.status_code == 200
        roster_data = res_roster.json()
        assert len(roster_data) == 1
        assert roster_data[0]["student_id"] == str(student.id)
        assert roster_data[0]["full_name"] == "Assigned Student"

        # 3. /mentor/submissions returns 200
        res_subs = client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {token}"})
        assert res_subs.status_code == 200
        assert isinstance(res_subs.json(), list)


def test_invalid_role_access_to_mentor_endpoints(client: TestClient, db: Session):
    """
    Requirement 9: Non-mentor roles (Student, Admin, HOD) are strictly forbidden
    from accessing mentor endpoints (/mentor/students and /mentor/submissions).
    """
    s_uid = f"s_uid_{uuid.uuid4().hex[:8]}"
    student = User(id=uuid.uuid4(), full_name="Student", email=f"s_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=s_uid, role=UserRole.STUDENT, is_active=True)

    a_uid = f"a_uid_{uuid.uuid4().hex[:8]}"
    admin = User(id=uuid.uuid4(), full_name="Admin", email=f"a_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", firebase_uid=a_uid, role=UserRole.ADMIN, is_active=True)

    db.add_all([student, admin])
    db.commit()
    db.track_user(student.id)  # type: ignore
    db.track_user(admin.id)  # type: ignore

    s_token = create_mock_firebase_id_token({"uid": s_uid, "email": student.email})
    a_token = create_mock_firebase_id_token({"uid": a_uid, "email": admin.email})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        # Student cannot access mentor endpoints -> 403 Forbidden
        mock_verify.return_value = {"uid": s_uid, "email": student.email}
        assert client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {s_token}"}).status_code == 403
        assert client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {s_token}"}).status_code == 403

        # Admin cannot access mentor endpoints -> 403 Forbidden
        mock_verify.return_value = {"uid": a_uid, "email": admin.email}
        assert client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {a_token}"}).status_code == 403
        assert client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {a_token}"}).status_code == 403


def test_mentor_login_and_endpoints_with_missing_mentor_profile(client: TestClient, db: Session):
    """
    Requirement 9: A mentor who does NOT have an explicit mentor_profile record
    can still authenticate via Firebase, resolve role='mentor', and access
    /mentor/students and /mentor/submissions without internal server errors.
    """
    m_uid = f"m_uid_{uuid.uuid4().hex[:8]}"
    # Mentor user WITHOUT MentorProfile row
    mentor = User(
        id=uuid.uuid4(),
        full_name="Mentor Without Profile Record",
        email=f"noprofile_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="placeholder",
        firebase_uid=m_uid,
        role=UserRole.MENTOR,
        is_active=True,
    )
    s_uid = f"s_uid_{uuid.uuid4().hex[:8]}"
    student = User(
        id=uuid.uuid4(),
        full_name="Student For Mentor Without Profile",
        email=f"s_noprofile_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="placeholder",
        firebase_uid=s_uid,
        role=UserRole.STUDENT,
        is_active=True,
    )
    assignment = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=mentor.id,
        student_id=student.id,
        is_active=True,
    )

    db.add_all([mentor, student, assignment])
    db.commit()
    db.track_user(mentor.id)  # type: ignore
    db.track_user(student.id)  # type: ignore

    token = create_mock_firebase_id_token({"uid": m_uid, "email": mentor.email, "email_verified": True})

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {"uid": m_uid, "email": mentor.email, "email_verified": True}

        # 1. /auth/me returns 200 with role='mentor'
        res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res_me.status_code == 200
        assert res_me.json()["role"] == "mentor"

        # 2. /mentor/students gracefully succeeds
        res_roster = client.get("/api/v1/mentor/students", headers={"Authorization": f"Bearer {token}"})
        assert res_roster.status_code == 200
        data = res_roster.json()
        assert len(data) == 1
        assert data[0]["student_id"] == str(student.id)

        # 3. /mentor/submissions gracefully succeeds
        res_subs = client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {token}"})
        assert res_subs.status_code == 200
