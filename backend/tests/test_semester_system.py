import uuid
from datetime import date
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.audit import AuditLog
from app.models.component import PGPAComponent
from app.models.semester import Semester
from app.models.semester_folder import StudentSemesterFolder
from app.models.user import StudentProfile, User, UserRole


@pytest.fixture
def admin_db():
    session = SessionLocal()
    created_users: list[uuid.UUID] = []
    created_achievements: list[uuid.UUID] = []

    def _track_user(u_id: uuid.UUID):
        created_users.append(u_id)

    def _track_achievement(ach_id: uuid.UUID):
        created_achievements.append(ach_id)

    session.track_user = _track_user  # type: ignore
    session.track_achievement = _track_achievement  # type: ignore

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

        if created_users:
            audit_logs = session.scalars(
                select(AuditLog).where(AuditLog.actor_id.in_(created_users))
            ).all()
            for al in audit_logs:
                session.delete(al)

            sem_folders = session.scalars(
                select(StudentSemesterFolder).where(StudentSemesterFolder.student_id.in_(created_users))
            ).all()
            for sf in sem_folders:
                session.delete(sf)

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

        session.commit()
        session.close()


def test_admin_semesters_list_and_permissions(client: TestClient, admin_db: Session):
    prefix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        full_name="Sem Admin",
        email=f"admin_sem_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    student = User(
        id=uuid.uuid4(),
        full_name="Sem Student",
        email=f"student_sem_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    admin_db.add_all([admin, student])
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore
    admin_db.track_user(student.id)  # type: ignore

    admin_token = create_access_token(subject=admin.id, role="admin")
    student_token = create_access_token(subject=student.id, role="student")

    # 1. Non-admin forbidden
    resp = client.get(
        "/api/v1/admin/semesters",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert resp.status_code == 403

    # 2. Admin can list all 8 semesters
    resp = client.get(
        "/api/v1/admin/semesters",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 8
    semester_numbers = [s["semester_number"] for s in data]
    assert semester_numbers == [1, 2, 3, 4, 5, 6, 7, 8]


def test_admin_semester_availability_toggle(client: TestClient, admin_db: Session):
    prefix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        full_name="Toggle Admin",
        email=f"toggle_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    admin_db.add(admin)
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore

    admin_token = create_access_token(subject=admin.id, role="admin")

    # Get semester 8 (which starts disabled)
    sem8 = admin_db.scalars(
        select(Semester).where(Semester.semester_number == 8)
    ).first()
    assert sem8 is not None
    orig_status = sem8.is_enabled

    try:
        # Enable Semester 8
        resp = client.patch(
            f"/api/v1/admin/semesters/{sem8.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_enabled": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_enabled"] is True

        # Check DB updated
        admin_db.expire_all()
        refreshed = admin_db.get(Semester, sem8.id)
        assert refreshed.is_enabled is True

        # Check audit log recorded
        audit = admin_db.scalars(
            select(AuditLog).where(
                AuditLog.actor_id == admin.id,
                AuditLog.action == "update_semester_availability",
                AuditLog.target_id == str(sem8.id),
            )
        ).first()
        assert audit is not None
        assert audit.action_metadata["new_status"] is True

    finally:
        # Revert back to original status
        sem8.is_enabled = orig_status
        admin_db.commit()


def test_student_available_semesters_and_submission(client: TestClient, admin_db: Session):
    prefix = uuid.uuid4().hex[:6]
    student = User(
        id=uuid.uuid4(),
        full_name="Test Student Submitter",
        email=f"submitter_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    admin_db.add(student)
    admin_db.flush()

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"REG{prefix.upper()}",
        department="CCE",
        year=2,
    )
    admin_db.add(profile)
    admin_db.commit()
    admin_db.track_user(student.id)  # type: ignore

    student_token = create_access_token(subject=student.id, role="student")

    # 1. Fetch available semesters (should only return is_enabled=True)
    resp = client.get(
        "/api/v1/students/semesters",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert resp.status_code == 200
    available_sems = resp.json()
    assert all(s["is_enabled"] is True for s in available_sems)
    available_sem_ids = [s["id"] for s in available_sems]

    # Pick an enabled semester (e.g. Semester 1)
    sem1 = next(s for s in available_sems if s["semester_number"] == 1)

    # Pick a disabled semester
    sem_disabled = admin_db.scalars(
        select(Semester).where(Semester.is_enabled.is_(False))
    ).first()
    assert sem_disabled is not None

    # Get an active component (exclude academics-gpa which requires numeric GPA)
    component = admin_db.scalars(
        select(PGPAComponent).where(
            PGPAComponent.is_active.is_(True),
            PGPAComponent.slug != "academics-gpa",
        )
    ).first()
    assert component is not None

    # 2. Submitting to a disabled semester should be rejected (400)
    resp_disabled = client.post(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "component_id": str(component.id),
            "semester_id": str(sem_disabled.id),
            "title": "Hackathon Submission in Closed Semester",
            "activity_type": "Hackathon",
        },
    )
    assert resp_disabled.status_code == 400
    assert "closed for submissions" in resp_disabled.json()["detail"]

    # 3. Submitting to an enabled semester should succeed (201)
    resp_enabled = client.post(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "component_id": str(component.id),
            "semester_id": str(sem1["id"]),
            "title": "Hackathon Winner in Active Semester 1",
            "activity_type": "Hackathon",
            "outcome": "1st Place",
        },
    )
    assert resp_enabled.status_code == 201
    created_data = resp_enabled.json()
    admin_db.track_achievement(uuid.UUID(created_data["id"]))  # type: ignore
    assert created_data["semester_id"] == sem1["id"]
    assert created_data["semester_number"] == 1
    assert created_data["semester_display_name"] == "Semester 1"

    # 4. Filter achievements by semester
    resp_filter = client.get(
        f"/api/v1/students/me/achievements?semester_id={sem1['id']}",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert resp_filter.status_code == 200
    filtered = resp_filter.json()
    assert len(filtered) >= 1
    assert any(a["id"] == created_data["id"] for a in filtered)


def test_semester_drive_audit_and_dry_run_provisioning(client: TestClient, admin_db: Session):
    prefix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        full_name="Drive Audit Admin",
        email=f"drive_adm_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    admin_db.add(admin)
    admin_db.commit()
    admin_db.track_user(admin.id)  # type: ignore

    admin_token = create_access_token(subject=admin.id, role="admin")

    with patch("app.api.v1.endpoints.admin.get_drive_service") as mock_get_ds:
        mock_ds = MagicMock()
        mock_ds.is_configured = True
        mock_ds.root_folder_id = "test_root_123"
        mock_ds.verify_connectivity.return_value = {"connected": True}
        mock_ds.list_folders_in_parent.return_value = []
        mock_get_ds.return_value = mock_ds

        # 1. Audit endpoint (dry-run inspection)
        resp_audit = client.get(
            "/api/v1/admin/semesters/drive-audit",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp_audit.status_code == 200
        audit_data = resp_audit.json()
        assert "students" in audit_data
        assert audit_data["target_semesters"] == [1, 2, 3]

        # 2. Provisioning dry-run
        resp_prov = client.post(
            "/api/v1/admin/semesters/provision-folders?dry_run=true",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp_prov.status_code == 200
        prov_data = resp_prov.json()
        assert prov_data["dry_run"] is True
        assert prov_data["target_semesters"] == [1, 2, 3]
        assert "Evaluated" in prov_data["message"]


def test_upload_evidence_uses_semester_folder(client: TestClient, admin_db: Session):
    from app.services.file_manager import upload_achievement_file
    from app.models.file import FileCategory

    prefix = uuid.uuid4().hex[:6]
    student = User(
        id=uuid.uuid4(),
        full_name="Upload Student",
        email=f"upload_{prefix}@test.edu",
        password_hash=get_password_hash("pass"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    admin_db.add(student)
    admin_db.flush()

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"UP{prefix.upper()}",
        department="CCE",
        year=2,
        google_drive_folder_id=f"folder_student_{prefix}",
    )
    admin_db.add(profile)

    sem = admin_db.scalars(
        select(Semester).where(Semester.semester_number == 1)
    ).first()

    comp = admin_db.scalars(
        select(PGPAComponent).where(PGPAComponent.is_active.is_(True))
    ).first()

    ach = Achievement(
        id=uuid.uuid4(),
        student_id=student.id,
        component_id=comp.id,
        semester_id=sem.id,
        title="Evidence Upload Test",
        status=AchievementStatus.DRAFT,
    )
    admin_db.add(ach)
    admin_db.commit()
    admin_db.track_user(student.id)  # type: ignore
    admin_db.track_achievement(ach.id)  # type: ignore

    mock_ds = MagicMock()
    mock_ds.is_configured = True
    mock_ds.validate_file.return_value = ("test.pdf", "application/pdf", 1024)
    mock_ds.get_or_create_folder.return_value = f"mock_sem1_folder_{prefix}"
    mock_ds.upload_file.return_value = {
        "drive_file_id": f"drive_file_{prefix}",
        "web_view_link": "https://drive.google.com/test",
    }

    uploaded = upload_achievement_file(
        session=admin_db,
        current_user=student,
        achievement_id=ach.id,
        file_category=FileCategory.CERTIFICATE,
        filename="test.pdf",
        content=b"%PDF-1.4 test content",
        content_type="application/pdf",
        drive_service=mock_ds,
    )

    assert uploaded is not None
    assert uploaded.achievement_id == ach.id
    mock_ds.upload_file.assert_called_once()
    call_kwargs = mock_ds.upload_file.call_args[1]
    assert call_kwargs["folder_id"] == f"mock_sem1_folder_{prefix}"

    # Verify student_semester_folders table has the mapping saved
    mapping = admin_db.scalar(
        select(StudentSemesterFolder).where(
            StudentSemesterFolder.student_id == student.id,
            StudentSemesterFolder.semester_id == sem.id,
        )
    )
    assert mapping is not None
    assert mapping.drive_folder_id == f"mock_sem1_folder_{prefix}"
