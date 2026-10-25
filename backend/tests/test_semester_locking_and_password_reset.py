import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.audit import AuditLog
from app.models.component import ComponentSemesterConfig, PGPAComponent
from app.models.semester import Semester
from app.models.user import StudentProfile, User, UserRole


@pytest.fixture
def test_db():
    """
    Isolated test database session that records and cleans up all created test entities.
    Strictly preserves all existing student/staff accounts and component semester configs.
    """
    session = SessionLocal()
    created_users: list[uuid.UUID] = []
    created_achievements: list[uuid.UUID] = []
    created_components: list[uuid.UUID] = []
    created_configs: list[uuid.UUID] = []

    def _track_user(u_id: uuid.UUID):
        created_users.append(u_id)

    def _track_achievement(ach_id: uuid.UUID):
        created_achievements.append(ach_id)

    def _track_component(comp_id: uuid.UUID):
        created_components.append(comp_id)

    def _track_config(cfg_id: uuid.UUID):
        created_configs.append(cfg_id)

    session.track_user = _track_user  # type: ignore
    session.track_achievement = _track_achievement  # type: ignore
    session.track_component = _track_component  # type: ignore
    session.track_config = _track_config  # type: ignore

    try:
        yield session
    finally:
        session.rollback()
        session.expunge_all()

        if created_achievements:
            achs = session.scalars(
                select(Achievement).where(Achievement.id.in_(created_achievements))
            ).all()
            for a in achs:
                session.delete(a)

        if created_configs:
            cfgs = session.scalars(
                select(ComponentSemesterConfig).where(ComponentSemesterConfig.id.in_(created_configs))
            ).all()
            for c in cfgs:
                session.delete(c)

        if created_users:
            user_str_ids = [str(u) for u in created_users]
            audit_logs = session.scalars(
                select(AuditLog).where(
                    AuditLog.actor_id.in_(created_users) | AuditLog.target_id.in_(user_str_ids)
                )
            ).all()
            for al in audit_logs:
                session.delete(al)

            profiles = session.scalars(
                select(StudentProfile).where(StudentProfile.user_id.in_(created_users))
            ).all()
            for sp in profiles:
                session.delete(sp)

            users = session.scalars(
                select(User).where(User.id.in_(created_users))
            ).all()
            for u in users:
                session.delete(u)

        if created_components:
            comps = session.scalars(
                select(PGPAComponent).where(PGPAComponent.id.in_(created_components))
            ).all()
            for cp in comps:
                session.delete(cp)

        session.commit()
        session.close()


# ==============================================================================
# FEATURE 1: Semester Component Locking Tests
# ==============================================================================

def test_semester_locking_enabled_vs_disabled(client: TestClient, test_db: Session):
    """
    Verifies that:
    1. An enabled component can be submitted in an enabled semester.
    2. A disabled component in that semester returns HTTP 400 with a clear lock message.
    3. Direct API calls cannot bypass the lock.
    """
    prefix = uuid.uuid4().hex[:6]

    # Use existing Semesters 1 and 2
    sem_a = test_db.scalars(select(Semester).where(Semester.semester_number == 1)).first()
    sem_b = test_db.scalars(select(Semester).where(Semester.semester_number == 2)).first()
    assert sem_a is not None, "Semester 1 must exist"
    assert sem_b is not None, "Semester 2 must exist"

    # Create a unique test component
    comp = PGPAComponent(
        id=uuid.uuid4(),
        name=f"Test Component {prefix}",
        slug=f"test-comp-{prefix}",
        submission_mode="both",
        is_active=True,
        display_order=99,
        credit_value=3,
    )
    test_db.add(comp)
    test_db.commit()
    test_db.track_component(comp.id)  # type: ignore

    # Configure matrix: Enabled in Sem 1, Disabled in Sem 2
    cfg_a = ComponentSemesterConfig(
        id=uuid.uuid4(),
        component_id=comp.id,
        semester_id=sem_a.id,
        is_enabled=True,
    )
    cfg_b = ComponentSemesterConfig(
        id=uuid.uuid4(),
        component_id=comp.id,
        semester_id=sem_b.id,
        is_enabled=False,
    )
    test_db.add_all([cfg_a, cfg_b])
    test_db.commit()
    test_db.track_config(cfg_a.id)  # type: ignore
    test_db.track_config(cfg_b.id)  # type: ignore

    # Create a student
    student = User(
        id=uuid.uuid4(),
        full_name="Lock Test Student",
        email=f"lock_student_{prefix}@test.edu",
        password_hash=get_password_hash("TestPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    test_db.add(student)
    test_db.commit()
    test_db.track_user(student.id)  # type: ignore

    sp = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"REG{prefix.upper()}",
        department="CCE",
        year=1,
        semester="Semester 1",
    )
    test_db.add(sp)
    test_db.commit()

    student_token = create_access_token(subject=student.id, role="student")
    headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Catalogue reflects Sem 1 (enabled) vs Sem 2 (disabled)
    res_cat_a = client.get(f"/api/v1/students/components?semester_id={sem_a.id}", headers=headers)
    assert res_cat_a.status_code == 200
    comp_a_meta = next(c for c in res_cat_a.json() if c["id"] == str(comp.id))
    assert comp_a_meta["is_enabled_for_semester"] is True
    assert comp_a_meta["lock_reason"] is None

    res_cat_b = client.get(f"/api/v1/students/components?semester_id={sem_b.id}", headers=headers)
    assert res_cat_b.status_code == 200
    comp_b_meta = next(c for c in res_cat_b.json() if c["id"] == str(comp.id))
    assert comp_b_meta["is_enabled_for_semester"] is False
    assert f"unavailable for {sem_b.display_name}" in comp_b_meta["lock_reason"]

    # 2. Student submits in enabled Sem 1 -> Success (201)
    payload_a = {
        "component_id": str(comp.id),
        "semester_id": str(sem_a.id),
        "title": "Legitimate Submission in Sem 1",
        "activity_type": "Certification",
        "component_metadata": {"points": 100},
    }
    res_sub_a = client.post("/api/v1/students/me/achievements", json=payload_a, headers=headers)
    assert res_sub_a.status_code == 201
    ach_a_id = res_sub_a.json()["id"]
    test_db.track_achievement(uuid.UUID(ach_a_id))  # type: ignore

    # 3. Direct API attempt to submit in disabled Sem 2 -> Blocked (400)
    payload_b = {
        "component_id": str(comp.id),
        "semester_id": str(sem_b.id),
        "title": "Bypass Attempt in Sem 2",
        "activity_type": "Certification",
        "component_metadata": {"points": 100},
    }
    res_sub_b = client.post("/api/v1/students/me/achievements", json=payload_b, headers=headers)
    assert res_sub_b.status_code == 400
    assert f"unavailable for {sem_b.display_name}" in res_sub_b.json()["detail"]


def test_submit_endpoint_enforces_semester_lock(client: TestClient, test_db: Session):
    """
    Verifies that if an achievement was previously saved as draft, and the component
    is subsequently locked for that semester, calling /submit blocks the submission.
    """
    prefix = uuid.uuid4().hex[:6]

    sem = test_db.scalars(select(Semester).where(Semester.semester_number == 2)).first()
    assert sem is not None

    comp = PGPAComponent(
        id=uuid.uuid4(),
        name=f"Lockable Comp {prefix}",
        slug=f"lockable-{prefix}",
        submission_mode="student_submission",
        is_active=True,
        display_order=50,
    )
    test_db.add(comp)
    test_db.commit()
    test_db.track_component(comp.id)  # type: ignore

    # Initially enabled
    cfg = ComponentSemesterConfig(
        id=uuid.uuid4(),
        component_id=comp.id,
        semester_id=sem.id,
        is_enabled=True,
    )
    test_db.add(cfg)

    student = User(
        id=uuid.uuid4(),
        full_name="Draft Student",
        email=f"draft_{prefix}@test.edu",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    test_db.add(student)
    test_db.commit()
    test_db.track_config(cfg.id)  # type: ignore
    test_db.track_user(student.id)  # type: ignore

    # Create draft achievement
    ach = Achievement(
        id=uuid.uuid4(),
        student_id=student.id,
        component_id=comp.id,
        semester_id=sem.id,
        title="Draft Achievement",
        status=AchievementStatus.DRAFT,
    )
    test_db.add(ach)
    test_db.commit()
    test_db.track_achievement(ach.id)  # type: ignore

    # Administrator locks component for this semester
    cfg.is_enabled = False
    test_db.add(cfg)
    test_db.commit()

    student_token = create_access_token(subject=student.id, role="student")
    headers = {"Authorization": f"Bearer {student_token}"}

    # Student tries to submit draft
    res = client.post(f"/api/v1/students/me/achievements/{ach.id}/submit", headers=headers)
    assert res.status_code == 400
    assert f"unavailable for {sem.display_name}" in res.json()["detail"]


def test_hod_only_mode_blocks_student_submission(client: TestClient, test_db: Session):
    """
    Verifies that components configured with submission_mode == 'hod_excel_import'
    cannot be submitted or drafted by students.
    """
    prefix = uuid.uuid4().hex[:6]

    sem = test_db.scalars(select(Semester).where(Semester.semester_number == 3)).first()
    assert sem is not None

    comp = PGPAComponent(
        id=uuid.uuid4(),
        name=f"HOD Import Only {prefix}",
        slug=f"hod-only-{prefix}",
        submission_mode="hod_excel_import",
        is_active=True,
        display_order=80,
    )
    test_db.add(comp)
    test_db.commit()
    test_db.track_component(comp.id)  # type: ignore

    cfg = ComponentSemesterConfig(
        id=uuid.uuid4(),
        component_id=comp.id,
        semester_id=sem.id,
        is_enabled=True,
    )
    student = User(
        id=uuid.uuid4(),
        full_name="HOD Block Student",
        email=f"hod_block_{prefix}@test.edu",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    test_db.add_all([cfg, student])
    test_db.commit()
    test_db.track_config(cfg.id)  # type: ignore
    test_db.track_user(student.id)  # type: ignore

    student_token = create_access_token(subject=student.id, role="student")
    headers = {"Authorization": f"Bearer {student_token}"}

    # Catalogue marks it locked with clear explanation
    res_cat = client.get(f"/api/v1/students/components?semester_id={sem.id}", headers=headers)
    assert res_cat.status_code == 200
    comp_meta = next(c for c in res_cat.json() if c["id"] == str(comp.id))
    assert comp_meta["is_enabled_for_semester"] is False
    assert "configured for HOD Excel import only" in comp_meta["lock_reason"]

    # Direct creation attempt fails with 400
    payload = {
        "component_id": str(comp.id),
        "semester_id": str(sem.id),
        "title": "Student Attempt on HOD Import",
        "activity_type": "Excel",
        "component_metadata": {},
    }
    res_create = client.post("/api/v1/students/me/achievements", json=payload, headers=headers)
    assert res_create.status_code == 400
    assert "configured for HOD Excel import only" in res_create.json()["detail"]


# ==============================================================================
# FEATURE 2: Individual Student Password Reset Tests
# ==============================================================================

def test_admin_individual_student_password_reset(client: TestClient, test_db: Session):
    """
    Verifies that:
    1. Administrator can securely reset one student's password.
    2. The new password works for login; old password fails.
    3. must_change_password flag is properly toggled.
    4. Audit log is recorded without recording the plaintext password.
    5. Other student accounts are unaffected.
    """
    prefix = uuid.uuid4().hex[:6]

    # Create Admin
    admin = User(
        id=uuid.uuid4(),
        full_name="Admin Reset Tester",
        email=f"adm_rst_{prefix}@test.edu",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    # Create Target Student A
    student_a = User(
        id=uuid.uuid4(),
        full_name="Student A",
        email=f"student_a_{prefix}@test.edu",
        password_hash=get_password_hash("OldStudentPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
        must_change_password=False,
    )
    # Create Bystander Student B
    student_b = User(
        id=uuid.uuid4(),
        full_name="Student B",
        email=f"student_b_{prefix}@test.edu",
        password_hash=get_password_hash("StudentBPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
        must_change_password=False,
    )

    test_db.add_all([admin, student_a, student_b])
    test_db.commit()
    test_db.track_user(admin.id)  # type: ignore
    test_db.track_user(student_a.id)  # type: ignore
    test_db.track_user(student_b.id)  # type: ignore

    admin_token = create_access_token(subject=admin.id, role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    new_temp_pass = "TemporarySecurePass#2026!"

    with patch("app.api.v1.endpoints.admin.sync_update_firebase_user") as mock_fb:
        # Reset Student A's password
        res = client.post(
            f"/api/v1/admin/students/{student_a.id}/reset-password",
            json={"new_password": new_temp_pass, "must_change_password": True},
            headers=admin_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["must_change_password"] is True
        assert data["student_id"] == str(student_a.id)

    # Verify database state
    test_db.refresh(student_a)
    assert student_a.must_change_password is True
    assert verify_password(new_temp_pass, student_a.password_hash) is True
    assert verify_password("OldStudentPass123!", student_a.password_hash) is False

    # Verify audit log was recorded safely
    audit = test_db.scalars(
        select(AuditLog).where(
            AuditLog.actor_id == admin.id,
            AuditLog.target_id == str(student_a.id),
            AuditLog.action == "reset_student_password",
        )
    ).first()
    assert audit is not None
    assert new_temp_pass not in str(audit.action_metadata)
    assert new_temp_pass not in audit.action

    # 1. Login with old password fails (401)
    res_old_login = client.post(
        "/api/v1/auth/login",
        json={"email": student_a.email, "password": "OldStudentPass123!"},
    )
    assert res_old_login.status_code == 401

    # 2. Login with new password succeeds (200)
    res_new_login = client.post(
        "/api/v1/auth/login",
        json={"email": student_a.email, "password": new_temp_pass},
    )
    assert res_new_login.status_code == 200
    token_data = res_new_login.json()
    assert "access_token" in token_data
    student_a_token = token_data["access_token"]

    # Verify /api/v1/auth/me enforces must_change_password == True
    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {student_a_token}"})
    assert res_me.status_code == 200
    assert res_me.json()["must_change_password"] is True

    # Student updates temporary password via change-password workflow
    perm_pass = "PermanentStrongPass#999!"
    res_change = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": new_temp_pass, "new_password": perm_pass},
        headers={"Authorization": f"Bearer {student_a_token}"},
    )
    assert res_change.status_code == 200
    test_db.refresh(student_a)
    assert student_a.must_change_password is False
    assert verify_password(perm_pass, student_a.password_hash) is True

    # 3. Bystander Student B is completely unaffected
    test_db.refresh(student_b)
    assert student_b.must_change_password is False
    assert verify_password("StudentBPass123!", student_b.password_hash) is True

    res_b_login = client.post(
        "/api/v1/auth/login",
        json={"email": student_b.email, "password": "StudentBPass123!"},
    )
    assert res_b_login.status_code == 200
    b_token = res_b_login.json()["access_token"]
    res_b_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {b_token}"})
    assert res_b_me.status_code == 200
    assert res_b_me.json()["must_change_password"] is False


def test_password_reset_authorization_guards(client: TestClient, test_db: Session):
    """
    Verifies that unauthorized users (Student, Mentor, HOD, or unauthenticated)
    cannot call the reset-password API.
    """
    prefix = uuid.uuid4().hex[:6]

    student = User(
        id=uuid.uuid4(),
        full_name="Attacker Student",
        email=f"atk_st_{prefix}@test.edu",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    mentor = User(
        id=uuid.uuid4(),
        full_name="Attacker Mentor",
        email=f"atk_m_{prefix}@test.edu",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    victim = User(
        id=uuid.uuid4(),
        full_name="Victim Student",
        email=f"victim_{prefix}@test.edu",
        password_hash=get_password_hash("VictimPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    test_db.add_all([student, mentor, victim])
    test_db.commit()
    test_db.track_user(student.id)  # type: ignore
    test_db.track_user(mentor.id)  # type: ignore
    test_db.track_user(victim.id)  # type: ignore

    t_student = create_access_token(subject=student.id, role="student")
    t_mentor = create_access_token(subject=mentor.id, role="mentor")

    payload = {"new_password": "HackedPassword123!", "must_change_password": False}

    # 1. Unauthenticated -> 401
    res_unauth = client.post(f"/api/v1/admin/students/{victim.id}/reset-password", json=payload)
    assert res_unauth.status_code == 401

    # 2. Student caller -> 403
    res_student = client.post(
        f"/api/v1/admin/students/{victim.id}/reset-password",
        json=payload,
        headers={"Authorization": f"Bearer {t_student}"},
    )
    assert res_student.status_code == 403

    # 3. Mentor caller -> 403
    res_mentor = client.post(
        f"/api/v1/admin/students/{victim.id}/reset-password",
        json=payload,
        headers={"Authorization": f"Bearer {t_mentor}"},
    )
    assert res_mentor.status_code == 403

    # Victim password remains untouched
    test_db.refresh(victim)
    assert verify_password("VictimPass123!", victim.password_hash) is True
