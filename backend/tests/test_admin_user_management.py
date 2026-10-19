import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
from app.models.file import AchievementFile, FileCategory
from app.models.review import ReviewAction, VerificationLog
from app.models.user import HodProfile, MentorProfile, StudentProfile, User, UserRole


@pytest.fixture
def admin_db():
    """
    Isolated test database session that records and cleans up all created test entities.
    Strictly preserves all 61 existing cohort student records and official users.
    """
    session = SessionLocal()
    created_users: list[uuid.UUID] = []
    created_achievements: list[uuid.UUID] = []
    created_files: list[uuid.UUID] = []

    def _track_user(u_id: uuid.UUID):
        created_users.append(u_id)

    def _track_achievement(ach_id: uuid.UUID):
        created_achievements.append(ach_id)

    def _track_file(f_id: uuid.UUID):
        created_files.append(f_id)

    session.track_user = _track_user  # type: ignore
    session.track_achievement = _track_achievement  # type: ignore
    session.track_file = _track_file  # type: ignore

    try:
        yield session
    finally:
        session.rollback()
        session.expunge_all()
        # Cleanup in safe dependency order
        if created_files:
            files = session.scalars(select(AchievementFile).where(AchievementFile.id.in_(created_files))).all()
            for f in files:
                session.delete(f)

        if created_achievements:
            logs = session.scalars(select(VerificationLog).where(VerificationLog.achievement_id.in_(created_achievements))).all()
            for l in logs:
                session.delete(l)
            achs = session.scalars(select(Achievement).where(Achievement.id.in_(created_achievements))).all()
            for a in achs:
                session.delete(a)

        if created_users:
            # Delete assignments involving these users
            assigns = session.scalars(
                select(MentorAssignment).where(
                    (MentorAssignment.student_id.in_(created_users)) | (MentorAssignment.mentor_id.in_(created_users))
                )
            ).all()
            for ma in assigns:
                session.delete(ma)

            # Delete reviews given by these users
            vlogs = session.scalars(select(VerificationLog).where(VerificationLog.reviewer_id.in_(created_users))).all()
            for vl in vlogs:
                session.delete(vl)

            # Delete profiles
            sps = session.scalars(select(StudentProfile).where(StudentProfile.user_id.in_(created_users))).all()
            for sp in sps:
                session.delete(sp)

            mps = session.scalars(select(MentorProfile).where(MentorProfile.user_id.in_(created_users))).all()
            for mp in mps:
                session.delete(mp)

            hps = session.scalars(select(HodProfile).where(HodProfile.user_id.in_(created_users))).all()
            for hp in hps:
                session.delete(hp)

            users = session.scalars(select(User).where(User.id.in_(created_users))).all()
            for u in users:
                session.delete(u)

        session.commit()
        session.close()


def test_admin_authorization_guards(client: TestClient, admin_db: Session):
    """
    Verifies that only authenticated users with ADMIN role can access management endpoints.
    Students, Mentors, and HODs must receive 403 Forbidden.
    Unauthenticated requests must receive 401.
    """
    prefix = uuid.uuid4().hex[:6]
    student = User(id=uuid.uuid4(), full_name="Guard Student", email=f"st_guard_{prefix}@test.edu", password_hash="h", role=UserRole.STUDENT)
    mentor = User(id=uuid.uuid4(), full_name="Guard Mentor", email=f"m_guard_{prefix}@test.edu", password_hash="h", role=UserRole.MENTOR)
    hod = User(id=uuid.uuid4(), full_name="Guard HOD", email=f"hod_guard_{prefix}@test.edu", password_hash="h", role=UserRole.HOD)
    admin = User(id=uuid.uuid4(), full_name="Guard Admin", email=f"adm_guard_{prefix}@test.edu", password_hash="h", role=UserRole.ADMIN)

    admin_db.add_all([student, mentor, hod, admin])
    admin_db.commit()
    for u in [student, mentor, hod, admin]:
        admin_db.track_user(u.id)  # type: ignore

    t_student = create_access_token(subject=student.id, role="student")
    t_mentor = create_access_token(subject=mentor.id, role="mentor")
    t_hod = create_access_token(subject=hod.id, role="hod")
    t_admin = create_access_token(subject=admin.id, role="admin")

    # 1. Unauthenticated -> 401
    assert client.get("/api/v1/admin/students").status_code == 401
    assert client.get("/api/v1/admin/mentors").status_code == 401
    assert client.get("/api/v1/admin/hods").status_code == 401

    # 2. Student, Mentor, HOD -> 403
    for tok in [t_student, t_mentor, t_hod]:
        assert client.get("/api/v1/admin/students", headers={"Authorization": f"Bearer {tok}"}).status_code == 403
        assert client.get("/api/v1/admin/mentors", headers={"Authorization": f"Bearer {tok}"}).status_code == 403
        assert client.get("/api/v1/admin/hods", headers={"Authorization": f"Bearer {tok}"}).status_code == 403

    # 3. Admin -> 200
    res = client.get("/api/v1/admin/students", headers={"Authorization": f"Bearer {t_admin}"})
    assert res.status_code == 200


def test_student_management_crud_and_status(client: TestClient, admin_db: Session):
    """
    Tests creating, listing, editing, activating, and deactivating students.
    Verifies duplicate register number and email prevention.
    """
    prefix = uuid.uuid4().hex[:6]
    admin = User(id=uuid.uuid4(), full_name="Admin Test", email=f"admin_{prefix}@test.edu", password_hash="h", role=UserRole.ADMIN)
    mentor = User(id=uuid.uuid4(), full_name="Dr. Assigned Mentor", email=f"mentor_{prefix}@test.edu", password_hash="h", role=UserRole.MENTOR)
    admin_db.add_all([admin, mentor])
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore
    admin_db.track_user(mentor.id)  # type: ignore

    t_admin = create_access_token(subject=admin.id, role="admin")
    auth_headers = {"Authorization": f"Bearer {t_admin}"}

    # 1. Create a student with assigned mentor
    reg_no = f"312423{prefix.upper()}"
    create_payload = {
        "full_name": "Test Cohort Student",
        "email": f"student_{prefix}@test.edu",
        "register_number": reg_no,
        "department": "CCE",
        "year": 2,
        "section": "A",
        "semester": "IV SEM",
        "batch": "2023-2027",
        "assigned_mentor_id": str(mentor.id),
    }

    with patch("app.services.admin_service.sync_create_firebase_user", return_value=f"fb_{prefix}"):
        res = client.post("/api/v1/admin/students", json=create_payload, headers=auth_headers)
        assert res.status_code == 201
        created_data = res.json()
        student_id = created_data["id"]
        admin_db.track_user(uuid.UUID(student_id))  # type: ignore

        assert created_data["full_name"] == "Test Cohort Student"
        assert created_data["register_number"] == reg_no
        assert created_data["assigned_mentor"]["full_name"] == "Dr. Assigned Mentor"

    # 2. Duplicate email rejected
    res_dup_email = client.post(
        "/api/v1/admin/students",
        json={**create_payload, "register_number": f"DIFF_{prefix}"},
        headers=auth_headers,
    )
    assert res_dup_email.status_code == 400
    assert "already exists" in res_dup_email.json()["detail"]

    # 3. Duplicate register number rejected
    res_dup_reg = client.post(
        "/api/v1/admin/students",
        json={**create_payload, "email": f"diff_{prefix}@test.edu"},
        headers=auth_headers,
    )
    assert res_dup_reg.status_code == 400
    assert "already assigned" in res_dup_reg.json()["detail"]

    # 4. Search and filters
    res_search = client.get(f"/api/v1/admin/students?search={reg_no}", headers=auth_headers)
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1
    assert res_search.json()[0]["id"] == student_id

    # 5. Edit student details
    update_payload = {
        "full_name": "Updated Cohort Student",
        "year": 3,
        "section": "B",
    }
    with patch("app.services.admin_service.sync_update_firebase_user", return_value=True):
        res_update = client.put(f"/api/v1/admin/students/{student_id}", json=update_payload, headers=auth_headers)
        assert res_update.status_code == 200
        assert res_update.json()["full_name"] == "Updated Cohort Student"
        assert res_update.json()["year"] == 3
        assert res_update.json()["section"] == "B"

    # 6. Deactivate account
    with patch("app.services.admin_service.sync_set_firebase_disabled", return_value=True):
        res_status = client.patch(
            f"/api/v1/admin/students/{student_id}/status",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert res_status.status_code == 200
        assert res_status.json()["success"] is True

        # Verify DB state
        admin_db.expire_all()
        stu = admin_db.get(User, uuid.UUID(student_id))
        assert stu.is_active is False

    # 7. Reactivate account
    with patch("app.services.admin_service.sync_set_firebase_disabled", return_value=True):
        res_status2 = client.patch(
            f"/api/v1/admin/students/{student_id}/status",
            json={"is_active": True},
            headers=auth_headers,
        )
        assert res_status2.status_code == 200
        admin_db.expire_all()
        stu = admin_db.get(User, uuid.UUID(student_id))
        assert stu.is_active is True


def test_student_deletion_modes(client: TestClient, admin_db: Session):
    """
    Tests all 3 deletion options for students:
    1. deactivate
    2. delete_login
    3. permanent (with typed register number verification)
    """
    prefix = uuid.uuid4().hex[:6]
    admin = User(id=uuid.uuid4(), full_name="Admin Test", email=f"admin_{prefix}@test.edu", password_hash="h", role=UserRole.ADMIN)
    admin_db.add(admin)
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore

    t_admin = create_access_token(subject=admin.id, role="admin")
    auth_headers = {"Authorization": f"Bearer {t_admin}"}

    # Helper to create isolated test student
    def _create_isolated_student(suffix: str):
        u = User(
            id=uuid.uuid4(),
            full_name=f"Student {suffix}",
            email=f"stu_{suffix}_{prefix}@test.edu",
            password_hash="h",
            firebase_uid=f"fb_{suffix}_{prefix}",
            role=UserRole.STUDENT,
            is_active=True,
        )
        admin_db.add(u)
        admin_db.flush()
        p = StudentProfile(
            id=uuid.uuid4(),
            user_id=u.id,
            register_number=f"REG_{suffix}_{prefix}".upper(),
            department="CCE",
            year=2,
        )
        admin_db.add(p)
        admin_db.commit()
        admin_db.track_user(u.id)  # type: ignore
        return u, p

    # Mode 1: Deactivate account
    s1, p1 = _create_isolated_student("deact")
    with patch("app.services.admin_service.sync_set_firebase_disabled", return_value=True):
        res1 = client.post(
            f"/api/v1/admin/students/{s1.id}/delete",
            json={"delete_mode": "deactivate"},
            headers=auth_headers,
        )
        assert res1.status_code == 200
        assert res1.json()["delete_mode"] == "deactivate"
        admin_db.expire_all()
        refetched_s1 = admin_db.get(User, s1.id)
        assert refetched_s1.is_active is False
        assert refetched_s1.student_profile is not None

    # Mode 2: Delete login access
    s2, p2 = _create_isolated_student("dellogin")
    with patch("app.services.admin_service.sync_delete_firebase_user", return_value=True) as mock_fb_del:
        res2 = client.post(
            f"/api/v1/admin/students/{s2.id}/delete",
            json={"delete_mode": "delete_login"},
            headers=auth_headers,
        )
        assert res2.status_code == 200
        assert res2.json()["delete_mode"] == "delete_login"
        mock_fb_del.assert_called_once_with(f"fb_dellogin_{prefix}")
        admin_db.expire_all()
        refetched_s2 = admin_db.get(User, s2.id)
        assert refetched_s2.firebase_uid is None
        assert refetched_s2.is_active is False
        assert refetched_s2.student_profile is not None  # Records preserved

    # Mode 3: Permanent deletion with register number verification
    s3, p3 = _create_isolated_student("perm")
    reg3 = p3.register_number

    # a. Wrong confirmation register number rejected
    res_wrong = client.post(
        f"/api/v1/admin/students/{s3.id}/delete",
        json={"delete_mode": "permanent", "confirmation_register_number": "WRONG_REG"},
        headers=auth_headers,
    )
    assert res_wrong.status_code == 400
    assert "verification mismatch" in res_wrong.json()["detail"]

    # b. Correct confirmation permanently deletes
    with patch("app.services.admin_service.sync_delete_firebase_user", return_value=True), \
         patch("app.services.admin_service.get_drive_service") as mock_ds_getter:
        mock_ds = MagicMock()
        mock_ds.is_configured = True
        mock_ds_getter.return_value = mock_ds

        res3 = client.post(
            f"/api/v1/admin/students/{s3.id}/delete",
            json={"delete_mode": "permanent", "confirmation_register_number": reg3},
            headers=auth_headers,
        )
        assert res3.status_code == 200
        assert res3.json()["delete_mode"] == "permanent"
        admin_db.expunge_all()
        assert admin_db.get(User, s3.id) is None
        assert admin_db.get(StudentProfile, p3.id) is None


def test_student_permanent_deletion_drive_cleanup_and_retry(client: TestClient, admin_db: Session):
    """
    Verifies that permanent deletion cleans up Drive files, tracks any Drive failures,
    and allows retrying failed Drive file cleanup via /cleanup/drive-file/{drive_file_id}.
    """
    prefix = uuid.uuid4().hex[:6]
    admin = User(id=uuid.uuid4(), full_name="Admin Test", email=f"admin_{prefix}@test.edu", password_hash="h", role=UserRole.ADMIN)
    student = User(id=uuid.uuid4(), full_name="Drive Student", email=f"drive_{prefix}@test.edu", password_hash="h", role=UserRole.STUDENT)
    admin_db.add_all([admin, student])
    admin_db.flush()

    reg_no = f"REG_DRIVE_{prefix.upper()}"
    profile = StudentProfile(id=uuid.uuid4(), user_id=student.id, register_number=reg_no, department="CCE", year=2)
    admin_db.add(profile)

    comp = admin_db.scalars(select(PGPAComponent)).first()
    ach = Achievement(
        id=uuid.uuid4(),
        student_id=student.id,
        component_id=comp.id,
        title="Evidence Activity",
        status=AchievementStatus.PENDING,
    )
    admin_db.add(ach)
    admin_db.flush()

    file_rec = AchievementFile(
        id=uuid.uuid4(),
        achievement_id=ach.id,
        provider="google_drive",
        drive_file_id=f"gdrive_file_{prefix}",
        original_filename="cert.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
        file_category=FileCategory.CERTIFICATE,
        uploaded_by=student.id,
    )
    admin_db.add(file_rec)
    admin_db.commit()

    admin_db.track_user(admin.id)  # type: ignore
    admin_db.track_user(student.id)  # type: ignore
    admin_db.track_achievement(ach.id)  # type: ignore
    admin_db.track_file(file_rec.id)  # type: ignore

    t_admin = create_access_token(subject=admin.id, role="admin")
    auth_headers = {"Authorization": f"Bearer {t_admin}"}

    # Simulate Drive deletion failure
    with patch("app.services.admin_service.get_drive_service") as mock_ds_getter:
        mock_ds = MagicMock()
        mock_ds.is_configured = True
        mock_ds.delete_file.side_effect = RuntimeError("Drive network error")
        mock_ds_getter.return_value = mock_ds

        res = client.post(
            f"/api/v1/admin/students/{student.id}/delete",
            json={"delete_mode": "permanent", "confirmation_register_number": reg_no},
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["retry_drive_cleanup_needed"] is True
        assert f"gdrive_file_{prefix}" in data["failed_drive_file_ids"]

    # Now test retry endpoint for the failed file ID
    with patch("app.api.v1.endpoints.admin.get_drive_service") as mock_ds_retry:
        mock_ds2 = MagicMock()
        mock_ds2.is_configured = True
        mock_ds2.delete_file.return_value = True
        mock_ds_retry.return_value = mock_ds2

        res_retry = client.post(
            f"/api/v1/admin/cleanup/drive-file/gdrive_file_{prefix}",
            headers=auth_headers,
        )
        assert res_retry.status_code == 200
        assert res_retry.json()["success"] is True
        mock_ds2.delete_file.assert_called_once_with(f"gdrive_file_{prefix}")


def test_mentor_management_and_reassignment(client: TestClient, admin_db: Session):
    """
    Tests mentor creation, editing, student assignment enforcement before deletion,
    and automatic review history reattribution.
    """
    prefix = uuid.uuid4().hex[:6]
    admin = User(id=uuid.uuid4(), full_name="Admin Test", email=f"admin_{prefix}@test.edu", password_hash="h", role=UserRole.ADMIN)
    m1 = User(id=uuid.uuid4(), full_name="Dr. Outgoing Mentor", email=f"m1_{prefix}@test.edu", password_hash="h", role=UserRole.MENTOR)
    m2 = User(id=uuid.uuid4(), full_name="Dr. Incoming Mentor", email=f"m2_{prefix}@test.edu", password_hash="h", role=UserRole.MENTOR)
    student = User(id=uuid.uuid4(), full_name="Mentee Student", email=f"mentee_{prefix}@test.edu", password_hash="h", role=UserRole.STUDENT)

    admin_db.add_all([admin, m1, m2, student])
    admin_db.flush()

    mp1 = MentorProfile(id=uuid.uuid4(), user_id=m1.id, staff_id=f"STF_{prefix}_1", department="CCE", designation="Assistant Professor")
    mp2 = MentorProfile(id=uuid.uuid4(), user_id=m2.id, staff_id=f"STF_{prefix}_2", department="CCE", designation="Associate Professor")
    sp = StudentProfile(id=uuid.uuid4(), user_id=student.id, register_number=f"REG_MENTEE_{prefix.upper()}", department="CCE", year=2)

    assign = MentorAssignment(id=uuid.uuid4(), mentor_id=m1.id, student_id=student.id, is_active=True)
    admin_db.add_all([mp1, mp2, sp, assign])

    # Add a review log given by m1
    comp = admin_db.scalars(select(PGPAComponent)).first()
    ach = Achievement(id=uuid.uuid4(), student_id=student.id, component_id=comp.id, title="Reviewed Activity", status=AchievementStatus.APPROVED)
    admin_db.add(ach)
    admin_db.flush()
    vlog = VerificationLog(id=uuid.uuid4(), achievement_id=ach.id, reviewer_id=m1.id, action=ReviewAction.APPROVED, remarks="Well done")
    admin_db.add(vlog)
    admin_db.commit()

    for u in [admin, m1, m2, student]:
        admin_db.track_user(u.id)  # type: ignore
    admin_db.track_achievement(ach.id)  # type: ignore

    t_admin = create_access_token(subject=admin.id, role="admin")
    auth_headers = {"Authorization": f"Bearer {t_admin}"}

    # 1. Attempt deleting mentor without reassignment fails because students are assigned
    res_fail = client.post(
        f"/api/v1/admin/mentors/{m1.id}/delete",
        json={},
        headers=auth_headers,
    )
    assert res_fail.status_code == 400
    assert "reassign" in res_fail.json()["detail"].lower()

    # 2. Deleting mentor with reassignment succeeds
    with patch("app.services.admin_service.sync_delete_firebase_user", return_value=True):
        res_del = client.post(
            f"/api/v1/admin/mentors/{m1.id}/delete",
            json={"reassign_mentor_id": str(m2.id)},
            headers=auth_headers,
        )
        assert res_del.status_code == 200
        assert res_del.json()["success"] is True

        # Verify m1 is deleted
        admin_db.expunge_all()
        assert admin_db.get(User, m1.id) is None

        # Verify student is now assigned to m2
        active_assign = admin_db.scalars(
            select(MentorAssignment).where(MentorAssignment.student_id == student.id, MentorAssignment.is_active.is_(True))
        ).first()
        assert active_assign is not None
        assert active_assign.mentor_id == m2.id

        # Verify review log was preserved and reattributed to m2
        reloaded_vlog = admin_db.get(VerificationLog, vlog.id)
        assert reloaded_vlog.reviewer_id == m2.id


def test_hod_management_and_safety_rules(client: TestClient, admin_db: Session):
    """
    Tests HOD creation, conflict prevention for department, safe replacement on deletion,
    and prevention of Admin self-deletion.
    """
    prefix = uuid.uuid4().hex[:6]
    admin = User(id=uuid.uuid4(), full_name="Admin Test", email=f"admin_{prefix}@test.edu", password_hash="h", role=UserRole.ADMIN)
    admin_db.add(admin)
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore

    t_admin = create_access_token(subject=admin.id, role="admin")
    auth_headers = {"Authorization": f"Bearer {t_admin}"}

    # 1. Admin self-deletion prevented
    res_self = client.post(
        f"/api/v1/admin/hods/{admin.id}/delete",
        json={},
        headers=auth_headers,
    )
    assert res_self.status_code == 400
    assert "cannot delete their own" in res_self.json()["detail"]

    # 2. Create HOD
    create_payload = {
        "full_name": "Dr. Department HOD",
        "email": f"hod1_{prefix}@test.edu",
        "staff_id": f"STF_HOD_{prefix}_1",
        "department": f"DEPT_{prefix}",
        "designation": "Professor & Head",
    }
    with patch("app.services.admin_service.sync_create_firebase_user", return_value=f"fb_hod_{prefix}"):
        res = client.post("/api/v1/admin/hods", json=create_payload, headers=auth_headers)
        assert res.status_code == 201
        hod1_id = res.json()["id"]
        admin_db.track_user(uuid.UUID(hod1_id))  # type: ignore

    # 3. Create second active HOD for same department rejected (conflict prevention)
    res_conflict = client.post(
        "/api/v1/admin/hods",
        json={
            "full_name": "Dr. Rival HOD",
            "email": f"hod2_{prefix}@test.edu",
            "staff_id": f"STF_HOD_{prefix}_2",
            "department": f"DEPT_{prefix}",
        },
        headers=auth_headers,
    )
    assert res_conflict.status_code == 400
    assert "already has an active HOD" in res_conflict.json()["detail"]

    # 4. Create successor HOD (inactive initially or in another department)
    successor_user = User(
        id=uuid.uuid4(),
        full_name="Dr. Successor HOD",
        email=f"succ_{prefix}@test.edu",
        password_hash="h",
        role=UserRole.HOD,
        is_active=False,
    )
    admin_db.add(successor_user)
    admin_db.commit()
    admin_db.track_user(successor_user.id)  # type: ignore

    # 5. Delete HOD with safe replacement
    with patch("app.services.admin_service.sync_delete_firebase_user", return_value=True):
        res_del = client.post(
            f"/api/v1/admin/hods/{hod1_id}/delete",
            json={"replacement_hod_id": str(successor_user.id)},
            headers=auth_headers,
        )
        assert res_del.status_code == 200
        assert res_del.json()["success"] is True

        # Successor is now active
        admin_db.expire_all()
        reloaded_succ = admin_db.get(User, successor_user.id)
        assert reloaded_succ.is_active is True
