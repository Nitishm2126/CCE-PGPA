import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.user import StudentProfile, User, UserRole


@pytest.fixture
def audit_db():
    session = SessionLocal()
    created_users = []
    created_profiles = []

    def _track(user_id: uuid.UUID):
        created_users.append(user_id)

    session.track = _track

    try:
        yield session
    finally:
        session.rollback()
        if created_profiles:
            for p in session.scalars(select(StudentProfile).where(StudentProfile.id.in_(created_profiles))).all():
                session.delete(p)
        if created_users:
            for u in session.scalars(select(User).where(User.id.in_(created_users))).all():
                session.delete(u)
        session.commit()
        session.close()


def test_student_roster_excludes_test_accounts_by_default(client: TestClient, audit_db: Session):
    """
    Verifies that the normal /api/v1/admin/students endpoint returns only official
    roster students (with active profiles and non-test domains) and excludes
    test/fixture accounts.
    """
    prefix = uuid.uuid4().hex[:6]

    # Create an admin for calling the endpoint
    admin = User(
        id=uuid.uuid4(),
        full_name=f"Roster Auditor {prefix}",
        email=f"auditor_{prefix}@sairamtap.edu.in",
        password_hash=get_password_hash("pass"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    # Create a bare synthetic test student (no profile, @test.edu)
    test_student = User(
        id=uuid.uuid4(),
        full_name=f"Synthetic Student {prefix}",
        email=f"synthetic_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    # Create an official-style student with profile
    official_student = User(
        id=uuid.uuid4(),
        full_name=f"Official Student {prefix}",
        email=f"official_{prefix}@sairamtap.edu.in",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    audit_db.add_all([admin, test_student, official_student])
    audit_db.flush()
    audit_db.track(admin.id)
    audit_db.track(test_student.id)
    audit_db.track(official_student.id)

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=official_student.id,
        register_number=f"212623{prefix.upper()[:6]}",
        department="CCE",
        year=2,
        section="A",
    )
    audit_db.add(profile)
    audit_db.commit()

    token = create_access_token(subject=admin.id, role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Default listing: excludes synthetic test student
    res = client.get("/api/v1/admin/students", headers=headers)
    assert res.status_code == 200
    students = res.json()
    student_ids = [s["id"] for s in students]

    assert str(official_student.id) in student_ids
    assert str(test_student.id) not in student_ids

    # 2. With include_test_accounts=true: includes synthetic test student
    res_all = client.get("/api/v1/admin/students?include_test_accounts=true", headers=headers)
    assert res_all.status_code == 200
    all_students = res_all.json()
    all_student_ids = [s["id"] for s in all_students]

    assert str(test_student.id) in all_student_ids
    assert str(official_student.id) in all_student_ids


def test_hod_roster_excludes_test_accounts_by_default(client: TestClient, audit_db: Session):
    """
    Verifies that the /api/v1/hod/students endpoint excludes test accounts by default.
    """
    prefix = uuid.uuid4().hex[:6]

    hod = User(
        id=uuid.uuid4(),
        full_name=f"HOD Auditor {prefix}",
        email=f"hod_aud_{prefix}@sairamtap.edu.in",
        password_hash=get_password_hash("pass"),
        role=UserRole.HOD,
        is_active=True,
    )
    test_student = User(
        id=uuid.uuid4(),
        full_name=f"HOD Synthetic {prefix}",
        email=f"hod_syn_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    audit_db.add_all([hod, test_student])
    audit_db.commit()
    audit_db.track(hod.id)
    audit_db.track(test_student.id)

    token = create_access_token(subject=hod.id, role="hod")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/hod/students", headers=headers)
    assert res.status_code == 200
    student_ids = [s["student_id"] for s in res.json()]
    assert str(test_student.id) not in student_ids
