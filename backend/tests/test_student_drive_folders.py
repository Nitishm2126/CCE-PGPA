import uuid
from typing import Any, Dict, List, Optional
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.main import app
from app.models.achievement import Achievement, AchievementStatus
from app.models.component import PGPAComponent
from app.models.file import AchievementFile, FileCategory
from app.models.user import StudentProfile, User, UserRole
from app.services.drive_provisioning import (
    audit_student_drive_folders,
    ensure_student_folder,
    generate_student_folder_name,
    provision_student_drive_folders,
)
from app.services.drive_service import GoogleDriveService, set_drive_service
from app.services.file_manager import upload_achievement_file, get_achievement_files


class MockFolderDriveService(GoogleDriveService):
    """Test double for Drive folder management."""

    def __init__(self, root_folder_id: str = "mock_cce_root_001"):
        super().__init__(root_folder_id=root_folder_id)
        self.root_folder_id = root_folder_id
        self.folders: Dict[str, Dict[str, Any]] = {
            root_folder_id: {"name": "Root", "parent": None}
        }
        self.files: Dict[str, Dict[str, Any]] = {}

    @property
    def is_configured(self) -> bool:
        return True

    def verify_connectivity(self) -> Dict[str, Any]:
        return {
            "configured": True,
            "connected": True,
            "oauth_authorized": True,
            "authorized_email": "cce.pgpa@gmail.com",
            "root_folder_id": self.root_folder_id,
            "folder_name": "Mock Root",
            "message": "Connected",
            "detail": None,
        }

    def list_folders_in_parent(self, parent_id: str) -> List[Dict[str, Any]]:
        return [
            {"id": fid, "name": f["name"]}
            for fid, f in self.folders.items()
            if f["parent"] == parent_id
        ]

    def folder_exists(self, folder_id: str) -> bool:
        return folder_id in self.folders

    def get_or_create_folder(self, folder_name: str, parent_id: str) -> str:
        for fid, f in self.folders.items():
            if f["parent"] == parent_id and f["name"] == folder_name:
                return fid
        new_id = f"mock_folder_{uuid.uuid4().hex[:8]}"
        self.folders[new_id] = {"name": folder_name, "parent": parent_id}
        return new_id

    def upload_file(
        self,
        content: bytes,
        filename: str,
        mime_type: str,
        folder_id: str,
        opaque_prefix: Optional[str] = None,
    ) -> Dict[str, Any]:
        file_id = f"mock_file_{uuid.uuid4().hex[:8]}"
        drive_name = f"{opaque_prefix or 'pfx'}_{filename}"
        self.files[file_id] = {
            "id": file_id,
            "name": drive_name,
            "folder_id": folder_id,
            "content": content,
            "mime_type": mime_type,
        }
        return {
            "drive_file_id": file_id,
            "drive_folder_id": folder_id,
            "drive_filename": drive_name,
            "size_bytes": len(content),
            "mime_type": mime_type,
        }

    def delete_file(self, drive_file_id: str) -> bool:
        self.files.pop(drive_file_id, None)
        return True


@pytest.fixture
def mock_drive():
    ds = MockFolderDriveService()
    set_drive_service(ds)
    yield ds
    set_drive_service(None)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_generate_student_folder_name():
    """Verifies canonical folder naming format: {REGISTER_NUMBER}_{NORMALIZED_NAME}."""
    assert generate_student_folder_name("SEC25CO031", "Nitish M") == "SEC25CO031_NITISH_M"
    assert generate_student_folder_name("sec25co001", "Sharmi  K. N.") == "SEC25CO001_SHARMI_K_N"
    assert generate_student_folder_name("SEC-25-002", "Jane - Doe") == "SEC25002_JANE_DOE"
    assert generate_student_folder_name("", "") == "STUDENT_UNNAMED"


def test_audit_student_drive_folders(db_session, mock_drive):
    """Verifies read-only audit accurately analyzes all 61 students."""
    report = audit_student_drive_folders(db_session, mock_drive)
    assert report["total_students"] == 61
    assert "students" in report
    assert len(report["students"]) == 61
    # Check that each student has computed folder name
    for s in report["students"]:
        assert s["computed_folder_name"].startswith(s["register_number"])


def test_provision_student_drive_folders_dry_run(db_session, mock_drive):
    """Verifies that dry run simulates creation without altering DB or Drive."""
    initial_folder_count = len(mock_drive.folders)
    result = provision_student_drive_folders(db_session, mock_drive, dry_run=True)
    assert result["dry_run"] is True
    assert result["total_students"] == 61
    assert result["already_provisioned"] + result["created"] == 61
    assert result["failed"] == 0
    # Verify no folders were created in Drive mock
    assert len(mock_drive.folders) == initial_folder_count


def test_provision_student_drive_folders_idempotent(db_session, mock_drive):
    """
    Verifies that provisioning is idempotent:
    First run creates folders and saves IDs to DB.
    Second run reuses existing folders without duplicates.
    """
    # Create isolated test student
    test_email = f"test.drive.student.{uuid.uuid4().hex[:6]}@sairam.edu.in"
    test_user = User(
        id=uuid.uuid4(),
        email=test_email,
        full_name="Test Student Drive",
        role=UserRole.STUDENT,
        password_hash=get_password_hash("pass123"),
        is_active=True,
    )
    db_session.add(test_user)
    db_session.flush()

    test_profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=test_user.id,
        register_number=f"TEST{uuid.uuid4().hex[:6].upper()}",
        department="CCE",
        year=2,
        batch="2025-2029",
    )
    db_session.add(test_profile)
    db_session.commit()

    try:
        # Run 1: Create
        folder_id_1 = ensure_student_folder(db_session, test_user.id, mock_drive)
        assert folder_id_1.startswith("mock_folder_")

        db_session.refresh(test_profile)
        assert test_profile.google_drive_folder_id == folder_id_1

        # Run 2: Re-use
        folder_id_2 = ensure_student_folder(db_session, test_user.id, mock_drive)
        assert folder_id_2 == folder_id_1

    finally:
        db_session.delete(test_profile)
        db_session.delete(test_user)
        db_session.commit()


def test_upload_routes_to_dedicated_student_folder(db_session, mock_drive):
    """Verifies PDF upload automatically resolves and uses student's dedicated folder."""
    # Setup test student
    test_email = f"test.upload.{uuid.uuid4().hex[:6]}@sairam.edu.in"
    test_user = User(
        id=uuid.uuid4(),
        email=test_email,
        full_name="Upload Tester",
        role=UserRole.STUDENT,
        password_hash=get_password_hash("pass123"),
        is_active=True,
    )
    db_session.add(test_user)
    db_session.flush()

    test_profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=test_user.id,
        register_number=f"UPL{uuid.uuid4().hex[:6].upper()}",
        department="CCE",
        year=2,
        batch="2025-2029",
    )
    db_session.add(test_profile)

    component = db_session.scalars(select(PGPAComponent)).first()

    ach = Achievement(
        id=uuid.uuid4(),
        student_id=test_user.id,
        component_id=component.id,
        title="Test Achievement for Upload",
        status=AchievementStatus.DRAFT,
    )
    db_session.add(ach)
    db_session.commit()

    try:
        valid_pdf = b"%PDF-1.4 header and content for test binary"
        file_record = upload_achievement_file(
            session=db_session,
            current_user=test_user,
            achievement_id=ach.id,
            file_category=FileCategory.CERTIFICATE,
            filename="certificate.pdf",
            content=valid_pdf,
            content_type="application/pdf",
            drive_service=mock_drive,
        )

        assert file_record is not None
        db_session.refresh(test_profile)
        # Verify file record folder ID equals student's dedicated folder ID
        assert file_record.drive_folder_id == test_profile.google_drive_folder_id
        # Verify file exists inside mock drive under that folder
        uploaded = mock_drive.files.get(file_record.drive_file_id)
        assert uploaded is not None
        assert uploaded["folder_id"] == test_profile.google_drive_folder_id

    finally:
        files = db_session.scalars(select(AchievementFile).where(AchievementFile.achievement_id == ach.id)).all()
        for f in files:
            db_session.delete(f)
        db_session.delete(ach)
        db_session.delete(test_profile)
        db_session.delete(test_user)
        db_session.commit()


def test_admin_drive_endpoints_require_admin(db_session, mock_drive):
    """Verifies that non-admin users cannot access drive audit or provisioning."""
    client = TestClient(app)

    # Student token
    student = db_session.scalars(select(User).where(User.role == UserRole.STUDENT)).first()
    student_token = create_access_token(subject=student.id, role=student.role.value)

    # Unauthorized audit attempt
    res = client.get("/api/v1/admin/drive/audit", headers={"Authorization": f"Bearer {student_token}"})
    assert res.status_code == 403

    # Unauthorized provision attempt
    res2 = client.post("/api/v1/admin/drive/provision-folders", headers={"Authorization": f"Bearer {student_token}"})
    assert res2.status_code == 403

    # Authorized admin attempt
    admin = db_session.scalars(select(User).where(User.role == UserRole.ADMIN)).first()
    admin_token = create_access_token(subject=admin.id, role=admin.role.value)

    res_admin = client.get("/api/v1/admin/drive/audit", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert data["total_students"] == 61
