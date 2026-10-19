import io
import uuid
from typing import Any, Dict, List, Optional, Tuple
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog
from app.models.component import PGPAComponent
from app.models.file import AchievementFile, FileCategory
from app.models.user import MentorProfile, StudentProfile, User, UserRole
from app.services.drive_service import GoogleDriveService, get_drive_service, set_drive_service


class MockGoogleDriveService(GoogleDriveService):
    """
    In-memory test double for GoogleDriveService.
    Simulates Google Drive API interactions without real Google credentials.
    """

    def __init__(self, root_folder_id: str = "mock_cce_root_folder_001"):
        super().__init__(root_folder_id=root_folder_id)
        self.root_folder_id = root_folder_id
        self.folders_store: Dict[str, Dict[str, Any]] = {
            root_folder_id: {"name": "CCE_Achieve_Root", "parent": None}
        }
        self.files_store: Dict[str, Dict[str, Any]] = {}  # file_id -> {meta, content}
        self.deleted_file_ids: List[str] = []
        self.fail_uploads: bool = False
        self.fail_deletes: bool = False
        self.simulate_trashed_root: bool = False

    @property
    def is_configured(self) -> bool:
        return True

    def verify_connectivity(self) -> Dict[str, Any]:
        if self.simulate_trashed_root:
            return {
                "configured": True,
                "connected": False,
                "root_folder_id": self.root_folder_id,
                "message": "Configured Google Drive root folder is in trash.",
                "detail": "Folder trashed = True",
            }
        return {
            "configured": True,
            "connected": True,
            "root_folder_id": self.root_folder_id,
            "folder_name": "CCE_Achieve_Root",
            "message": "Google Drive API connectivity and root folder verified successfully.",
            "detail": None,
        }

    def get_or_create_folder(self, folder_name: str, parent_id: str) -> str:
        # Check if already exists under parent
        for fid, fmeta in self.folders_store.items():
            if fmeta["name"] == folder_name and fmeta["parent"] == parent_id:
                return fid

        new_id = f"fldr_{uuid.uuid4().hex[:10]}"
        self.folders_store[new_id] = {"name": folder_name, "parent": parent_id}
        return new_id

    def upload_file(
        self,
        content: bytes,
        filename: str,
        mime_type: str,
        folder_id: str,
        opaque_prefix: Optional[str] = None,
    ) -> Dict[str, Any]:
        if self.fail_uploads:
            raise RuntimeError("Simulated Google Drive API upload failure")

        prefix = opaque_prefix or uuid.uuid4().hex[:10]
        drive_name = f"{prefix}_{filename}"
        drive_id = f"drv_{uuid.uuid4().hex[:12]}"

        meta = {
            "drive_file_id": drive_id,
            "drive_folder_id": folder_id,
            "drive_filename": drive_name,
            "size_bytes": len(content),
            "mime_type": mime_type,
        }
        self.files_store[drive_id] = {
            "meta": meta,
            "content": content,
            "folder_id": folder_id,
        }
        return meta

    def get_file_metadata(self, drive_file_id: str) -> Dict[str, Any]:
        if drive_file_id not in self.files_store:
            raise RuntimeError(f"File '{drive_file_id}' not found in Drive.")
        item = self.files_store[drive_file_id]
        return {
            "id": drive_file_id,
            "name": item["meta"]["drive_filename"],
            "mimeType": item["meta"]["mime_type"],
            "size": item["meta"]["size_bytes"],
        }

    def download_file(self, drive_file_id: str) -> Tuple[bytes, Dict[str, Any]]:
        if drive_file_id not in self.files_store:
            raise RuntimeError(f"File '{drive_file_id}' not found in Drive.")
        item = self.files_store[drive_file_id]
        return item["content"], self.get_file_metadata(drive_file_id)

    def delete_file(self, drive_file_id: str) -> bool:
        if self.fail_deletes:
            raise RuntimeError(f"Simulated Drive delete failure for {drive_file_id}")

        self.deleted_file_ids.append(drive_file_id)
        if drive_file_id in self.files_store:
            del self.files_store[drive_file_id]
        return True


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture
def mock_drive():
    """
    Installs MockGoogleDriveService as the active drive service for the test duration.
    """
    service = MockGoogleDriveService()
    set_drive_service(service)
    yield service
    set_drive_service(None)
    get_drive_service(reload=True)


@pytest.fixture
def db_session():
    """
    Session fixture with tracked cleanup of test users, achievements, and files.
    """
    session = SessionLocal()
    created_user_ids: List[uuid.UUID] = []
    created_achievement_ids: List[uuid.UUID] = []

    try:
        yield session, created_user_ids, created_achievement_ids
    finally:
        session.rollback()
        if created_achievement_ids:
            session.execute(
                text("DELETE FROM audit_logs WHERE target_id = ANY(:aids)"),
                {"aids": [str(aid) for aid in created_achievement_ids]},
            )
            session.execute(
                text("DELETE FROM achievement_files WHERE achievement_id = ANY(:aids)"),
                {"aids": created_achievement_ids},
            )
            session.execute(
                text("DELETE FROM achievements WHERE id = ANY(:aids)"),
                {"aids": created_achievement_ids},
            )
            session.commit()

        if created_user_ids:
            session.execute(
                text("DELETE FROM audit_logs WHERE actor_id = ANY(:uids)"),
                {"uids": created_user_ids},
            )
            session.execute(
                text("DELETE FROM mentor_assignments WHERE student_id = ANY(:uids) OR mentor_id = ANY(:uids)"),
                {"uids": created_user_ids},
            )
            session.execute(
                text("DELETE FROM student_profiles WHERE user_id = ANY(:uids)"),
                {"uids": created_user_ids},
            )
            session.execute(
                text("DELETE FROM mentor_profiles WHERE user_id = ANY(:uids)"),
                {"uids": created_user_ids},
            )
            session.execute(
                text("DELETE FROM users WHERE id = ANY(:uids)"),
                {"uids": created_user_ids},
            )
            session.commit()
        session.close()


@pytest.fixture
def setup_test_hierarchy(db_session, mock_drive):
    """
    Creates isolated test entities:
    - student_1 (with profile)
    - mentor_1 (assigned to student_1)
    - other_student (student_2)
    - other_mentor (unassigned)
    - hod_user
    - 1 draft achievement for student_1
    """
    session, user_ids, ach_ids = db_session
    suffix = uuid.uuid4().hex[:6]

    # Seed component lookup (reuse existing seeded component)
    component = session.scalar(select(PGPAComponent).where(PGPAComponent.is_active.is_(True)).limit(1))
    assert component is not None, "At least one PGPA component must be seeded."

    # 1. Student 1
    s1 = User(
        id=uuid.uuid4(),
        full_name=f"Student One {suffix}",
        email=f"s1_{suffix}@sairam.edu.in",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    s1_prof = StudentProfile(
        id=uuid.uuid4(),
        user_id=s1.id,
        register_number=f"REG1_{suffix}",
        department="CCE",
        year=2,
        section="A",
    )

    # 2. Student 2 (Other student)
    s2 = User(
        id=uuid.uuid4(),
        full_name=f"Student Two {suffix}",
        email=f"s2_{suffix}@sairam.edu.in",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    s2_prof = StudentProfile(
        id=uuid.uuid4(),
        user_id=s2.id,
        register_number=f"REG2_{suffix}",
        department="CCE",
        year=2,
        section="B",
    )

    # 3. Mentor 1 (Assigned to Student 1)
    m1 = User(
        id=uuid.uuid4(),
        full_name=f"Dr. Mentor One {suffix}",
        email=f"m1_{suffix}@sairam.edu.in",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    m1_prof = MentorProfile(
        id=uuid.uuid4(),
        user_id=m1.id,
        staff_id=f"STF_M1_{suffix}",
        department="CCE",
        designation="Assistant Professor",
    )

    # 4. Mentor 2 (Other / Unassigned mentor)
    m2 = User(
        id=uuid.uuid4(),
        full_name=f"Dr. Mentor Two {suffix}",
        email=f"m2_{suffix}@sairam.edu.in",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    m2_prof = MentorProfile(
        id=uuid.uuid4(),
        user_id=m2.id,
        staff_id=f"STF_M2_{suffix}",
        department="CCE",
        designation="Assistant Professor",
    )

    # 5. HOD
    hod = User(
        id=uuid.uuid4(),
        full_name=f"Dr. HOD {suffix}",
        email=f"hod_{suffix}@sairam.edu.in",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.HOD,
        is_active=True,
    )

    # 6. Mentor Assignment: m1 -> s1
    assignment = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=m1.id,
        student_id=s1.id,
        is_active=True,
    )

    # 7. Achievement for Student 1
    achievement = Achievement(
        id=uuid.uuid4(),
        student_id=s1.id,
        component_id=component.id,
        title=f"Sample Activity {suffix}",
        activity_type="Workshop",
        organizer="IEEE Student Branch",
        status=AchievementStatus.DRAFT,
    )

    session.add_all([s1, s1_prof, s2, s2_prof, m1, m1_prof, m2, m2_prof, hod, assignment, achievement])
    session.commit()

    user_ids.extend([s1.id, s2.id, m1.id, m2.id, hod.id])
    ach_ids.append(achievement.id)

    # Auth headers
    def _headers(user: User) -> Dict[str, str]:
        token = create_access_token(subject=user.id, role=user.role.value)
        return {"Authorization": f"Bearer {token}"}

    return {
        "student_1": s1,
        "student_2": s2,
        "mentor_1": m1,
        "mentor_2": m2,
        "hod": hod,
        "achievement": achievement,
        "component": component,
        "s1_headers": _headers(s1),
        "s2_headers": _headers(s2),
        "m1_headers": _headers(m1),
        "m2_headers": _headers(m2),
        "hod_headers": _headers(hod),
    }


# ==============================================================================
# 1. Drive Service Unit Tests
# ==============================================================================

def test_drive_service_unconfigured():
    """
    Unconfigured Google Drive service safely returns configured=False, connected=False
    without throwing exceptions or claiming real connectivity.
    """
    unconfigured = GoogleDriveService(
        service=None,
        service_account_file=None,
        service_account_json=None,
        root_folder_id=None,
    )
    status = unconfigured.verify_connectivity()
    assert status["configured"] is False
    assert status["connected"] is False
    assert "not configured" in status["message"]


def test_drive_service_mock_connectivity(mock_drive: MockGoogleDriveService):
    """
    Configured mock Drive service returns configured=True, connected=True.
    """
    status = mock_drive.verify_connectivity()
    assert status["configured"] is True
    assert status["connected"] is True
    assert status["root_folder_id"] == "mock_cce_root_folder_001"


def test_drive_service_trashed_root(mock_drive: MockGoogleDriveService):
    """
    Drive service detects when the configured root folder is in the Drive trash.
    """
    mock_drive.simulate_trashed_root = True
    status = mock_drive.verify_connectivity()
    assert status["configured"] is True
    assert status["connected"] is False
    assert "in trash" in status["message"]


def test_drive_file_validation_allowed_formats():
    """
    File validator accepts valid PDF, PNG, and JPEG files with consistent extensions and MIME types.
    """
    # 1. PDF
    pdf_bytes = b"%PDF-1.5 mock pdf content"
    name, mime, sz = GoogleDriveService.validate_file("certificate.pdf", pdf_bytes, "application/pdf")
    assert name == "certificate.pdf"
    assert mime == "application/pdf"
    assert sz == len(pdf_bytes)

    # 2. PNG
    png_bytes = b"\x89PNG\r\n\x1a\n mock png"
    name, mime, sz = GoogleDriveService.validate_file("photo.png", png_bytes, "image/png")
    assert name == "photo.png"
    assert mime == "image/png"

    # 3. JPEG
    jpg_bytes = b"\xff\xd8\xff mock jpeg"
    name, mime, sz = GoogleDriveService.validate_file("event_photo.jpeg", jpg_bytes, "image/jpeg")
    assert name == "event_photo.jpeg"
    assert mime == "image/jpeg"


def test_drive_file_validation_rejections():
    """
    File validator enforces security constraints on size, MIME type, extension, and filename.
    """
    # 1. Empty filename
    with pytest.raises(ValueError, match="Filename cannot be empty"):
        GoogleDriveService.validate_file("", b"content", "application/pdf")

    # 2. Path traversal in filename
    sanitized, _, _ = GoogleDriveService.validate_file("../../../secret.pdf", b"%PDF-1.4", "application/pdf")
    assert sanitized == "secret.pdf"

    # 3. Disallowed extension
    with pytest.raises(ValueError, match="is not allowed"):
        GoogleDriveService.validate_file("malicious.exe", b"binary", "application/octet-stream")

    # 4. Empty content
    with pytest.raises(ValueError, match="Uploaded file is empty"):
        GoogleDriveService.validate_file("empty.pdf", b"", "application/pdf")

    # 5. Oversize content (> 10MB)
    large_bytes = b"X" * (11 * 1024 * 1024)
    with pytest.raises(ValueError, match="exceeds maximum allowed limit"):
        GoogleDriveService.validate_file("large.pdf", large_bytes, "application/pdf")

    # 6. Disallowed MIME type
    with pytest.raises(ValueError, match="MIME type 'text/html' is not supported"):
        GoogleDriveService.validate_file("document.pdf", b"%PDF-1.4", "text/html")

    # 7. Extension / MIME type cross-mismatch (e.g. .pdf extension declared as image/png)
    with pytest.raises(ValueError, match="does not match declared MIME type"):
        GoogleDriveService.validate_file("report.pdf", b"content", "image/png")


def test_opaque_folder_hierarchy_no_pii(mock_drive: MockGoogleDriveService):
    """
    Verifies that Google Drive folder hierarchy uses opaque identifiers (UUIDs)
    and contains no student names, roll numbers, or personal information.
    """
    student_id = uuid.uuid4()
    achievement_id = uuid.uuid4()

    folder_id = mock_drive.ensure_achievement_folder(student_id, achievement_id)
    assert folder_id in mock_drive.folders_store

    # Verify student folder is opaque
    student_fldr_name = f"student_{student_id}"
    student_fldrs = [f for f in mock_drive.folders_store.values() if f["name"] == student_fldr_name]
    assert len(student_fldrs) == 1
    assert student_fldrs[0]["parent"] == mock_drive.root_folder_id

    # Verify achievement folder is opaque and nested
    ach_fldr_name = f"achievement_{achievement_id}"
    ach_fldrs = [f for f in mock_drive.folders_store.values() if f["name"] == ach_fldr_name]
    assert len(ach_fldrs) == 1

    # Confirm neither folder contains personal names
    assert "Dr." not in str(mock_drive.folders_store)
    assert "Student" not in str(mock_drive.folders_store)


# ==============================================================================
# 2. FastAPI Endpoints & Database Transactional Integration Tests
# ==============================================================================

def test_upload_achievement_file_success(client: TestClient, setup_test_hierarchy, mock_drive: MockGoogleDriveService):
    """
    Student uploads an evidence file:
    - Uploads to Google Drive using opaque filename
    - Saves metadata to PostgreSQL achievement_files table
    - Generates audit log entry
    - Returns 201 Created with content stream URL without exposing Drive IDs
    """
    data = setup_test_hierarchy
    ach_id = data["achievement"].id
    headers = data["s1_headers"]

    file_bytes = b"%PDF-1.5 CCE Achieve Certificate Binary Content"
    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        files={"file": ("certificate_workshop.pdf", io.BytesIO(file_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 201
    resp_data = response.json()
    assert resp_data["original_filename"] == "certificate_workshop.pdf"
    assert resp_data["mime_type"] == "application/pdf"
    assert resp_data["size_bytes"] == len(file_bytes)
    assert resp_data["file_category"] == "certificate"
    assert resp_data["provider"] == "google_drive"
    assert "content_url" in resp_data
    # Private Drive ID must not be leaked in public response
    assert "drive_file_id" not in resp_data

    # Verify database persistence
    session = SessionLocal()
    try:
        db_file = session.get(AchievementFile, uuid.UUID(resp_data["id"]))
        assert db_file is not None
        assert db_file.drive_file_id in mock_drive.files_store
        assert db_file.uploaded_by == data["student_1"].id

        # Verify audit log
        audit = session.scalar(
            select(AuditLog).where(
                AuditLog.action == "upload_achievement_file",
                AuditLog.target_id == str(db_file.id),
            )
        )
        assert audit is not None
        assert audit.actor_id == data["student_1"].id
    finally:
        session.close()


def test_file_authorization_isolation(client: TestClient, setup_test_hierarchy, mock_drive: MockGoogleDriveService):
    """
    Enforces strict role-based access isolation:
    - Another student cannot upload or read files for student 1's achievement
    - Unassigned mentor cannot view or download student 1's files
    - Assigned mentor CAN view and download student 1's files
    - HOD CAN view and download student 1's files
    """
    data = setup_test_hierarchy
    ach_id = data["achievement"].id

    # 1. Other student attempts to upload to Student 1's achievement -> 403 Forbidden
    file_bytes = b"%PDF-1.5 unauthorized file"
    unauth_upload = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=data["s2_headers"],
        files={"file": ("hacked.pdf", io.BytesIO(file_bytes), "application/pdf")},
        data={"file_category": "supporting_document"},
    )
    assert unauth_upload.status_code == 403

    # 2. Student 1 uploads a valid file
    valid_upload = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=data["s1_headers"],
        files={"file": ("legit_certificate.pdf", io.BytesIO(file_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )
    assert valid_upload.status_code == 201
    file_id = valid_upload.json()["id"]

    # 3. Student 2 attempts to list Student 1's files -> 403 Forbidden
    list_s2 = client.get(f"/api/v1/achievements/{ach_id}/files", headers=data["s2_headers"])
    assert list_s2.status_code == 403

    # 4. Student 2 attempts to download Student 1's file -> 403 Forbidden
    dl_s2 = client.get(f"/api/v1/files/{file_id}/content", headers=data["s2_headers"])
    assert dl_s2.status_code == 403

    # 5. Unassigned mentor (mentor_2) attempts to list files -> 403 Forbidden
    list_m2 = client.get(f"/api/v1/achievements/{ach_id}/files", headers=data["m2_headers"])
    assert list_m2.status_code == 403

    # 6. Unassigned mentor attempts to download file -> 403 Forbidden
    dl_m2 = client.get(f"/api/v1/files/{file_id}/content", headers=data["m2_headers"])
    assert dl_m2.status_code == 403

    # 7. Assigned mentor (mentor_1) CAN list and download
    list_m1 = client.get(f"/api/v1/achievements/{ach_id}/files", headers=data["m1_headers"])
    assert list_m1.status_code == 200
    assert len(list_m1.json()) == 1

    dl_m1 = client.get(f"/api/v1/files/{file_id}/content", headers=data["m1_headers"])
    assert dl_m1.status_code == 200
    assert dl_m1.content == file_bytes

    # 8. HOD CAN list and download
    list_hod = client.get(f"/api/v1/achievements/{ach_id}/files", headers=data["hod_headers"])
    assert list_hod.status_code == 200
    dl_hod = client.get(f"/api/v1/files/{file_id}/content", headers=data["hod_headers"])
    assert dl_hod.status_code == 200
    assert dl_hod.content == file_bytes


def test_download_proxy_streaming(client: TestClient, setup_test_hierarchy, mock_drive: MockGoogleDriveService):
    """
    Verifies that the /api/v1/files/{file_id}/content endpoint proxies the binary
    with proper Content-Type, Content-Disposition, and security headers.
    """
    data = setup_test_hierarchy
    ach_id = data["achievement"].id
    file_bytes = b"\x89PNG\r\n\x1a\n Test Image Binary"

    upload_res = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=data["s1_headers"],
        files={"file": ("event_snapshot.png", io.BytesIO(file_bytes), "image/png")},
        data={"file_category": "photo"},
    )
    assert upload_res.status_code == 201
    file_id = upload_res.json()["id"]

    # Stream download via proxy
    response = client.get(f"/api/v1/files/{file_id}/content", headers=data["s1_headers"])
    assert response.status_code == 200
    assert response.content == file_bytes
    assert response.headers["Content-Type"] == "image/png"
    assert 'filename="event_snapshot.png"' in response.headers["Content-Disposition"]
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_delete_file_success(client: TestClient, setup_test_hierarchy, mock_drive: MockGoogleDriveService):
    """
    Student deletes an evidence file:
    - Removes metadata record from PostgreSQL
    - Invokes delete on Google Drive
    - Logs audit trail entry
    """
    data = setup_test_hierarchy
    ach_id = data["achievement"].id
    file_bytes = b"%PDF-1.4 file to delete"

    upload_res = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=data["s1_headers"],
        files={"file": ("temp_doc.pdf", io.BytesIO(file_bytes), "application/pdf")},
        data={"file_category": "supporting_document"},
    )
    file_id = upload_res.json()["id"]

    # Delete file
    del_res = client.delete(f"/api/v1/files/{file_id}", headers=data["s1_headers"])
    assert del_res.status_code == 200

    # Verify DB deletion
    session = SessionLocal()
    try:
        assert session.get(AchievementFile, uuid.UUID(file_id)) is None
    finally:
        session.close()

    # Verify Drive deletion was called
    assert len(mock_drive.deleted_file_ids) > 0


def test_cannot_modify_approved_achievement_files(client: TestClient, setup_test_hierarchy, mock_drive: MockGoogleDriveService):
    """
    Once an achievement is APPROVED, neither uploading new evidence nor deleting
    existing evidence is allowed.
    """
    data = setup_test_hierarchy
    ach_id = data["achievement"].id
    session = SessionLocal()

    # 1. Upload file in DRAFT state
    file_bytes = b"%PDF-1.4 locked cert"
    res = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=data["s1_headers"],
        files={"file": ("locked_cert.pdf", io.BytesIO(file_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )
    assert res.status_code == 201
    file_id = res.json()["id"]

    # 2. Transition achievement to APPROVED
    try:
        with session.begin():
            ach = session.get(Achievement, ach_id)
            ach.status = AchievementStatus.APPROVED
    finally:
        session.close()

    # 3. Attempt to upload another file -> 400 Bad Request
    another_upload = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=data["s1_headers"],
        files={"file": ("late_file.pdf", io.BytesIO(file_bytes), "application/pdf")},
        data={"file_category": "supporting_document"},
    )
    assert another_upload.status_code == 400
    assert "approved achievement" in another_upload.json()["detail"]

    # 4. Attempt to delete existing file -> 400 Bad Request
    del_res = client.delete(f"/api/v1/files/{file_id}", headers=data["s1_headers"])
    assert del_res.status_code == 400
    assert "approved achievement" in del_res.json()["detail"]


def test_drive_upload_failure_leaves_db_clean(client: TestClient, setup_test_hierarchy, mock_drive: MockGoogleDriveService):
    """
    If the Google Drive upload fails, no record is added to PostgreSQL.
    """
    data = setup_test_hierarchy
    ach_id = data["achievement"].id
    mock_drive.fail_uploads = True

    session = SessionLocal()
    before_count = session.scalar(select(text("COUNT(*) FROM achievement_files")))
    session.close()

    file_bytes = b"%PDF-1.5 should fail"
    res = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=data["s1_headers"],
        files={"file": ("fail_doc.pdf", io.BytesIO(file_bytes), "application/pdf")},
        data={"file_category": "supporting_document"},
    )
    assert res.status_code == 502

    session = SessionLocal()
    after_count = session.scalar(select(text("COUNT(*) FROM achievement_files")))
    session.close()
    assert after_count == before_count


def test_db_failure_cleans_up_uploaded_drive_file(setup_test_hierarchy, mock_drive: MockGoogleDriveService):
    """
    If Google Drive upload succeeds but the database transaction fails,
    the uploaded Drive file is automatically cleaned up to prevent orphan files.
    """
    from app.services.file_manager import upload_achievement_file

    data = setup_test_hierarchy
    ach = data["achievement"]
    student = data["student_1"]

    session = SessionLocal()
    # Mock session.commit to simulate database failure
    session.commit = MagicMock(side_effect=RuntimeError("Simulated DB Connection Crash"))

    with pytest.raises(Exception):
        upload_achievement_file(
            session=session,
            current_user=student,
            achievement_id=ach.id,
            file_category=FileCategory.CERTIFICATE,
            filename="orphan_candidate.pdf",
            content=b"%PDF-1.4 test bytes",
            content_type="application/pdf",
            drive_service=mock_drive,
        )

    # Drive cleanup must have been called
    assert len(mock_drive.deleted_file_ids) == 1
    session.close()


def test_health_endpoint_with_drive_status(client: TestClient, mock_drive: MockGoogleDriveService):
    """
    GET /api/v1/health reflects Google Drive operational status.
    """
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert "storage" in data
    assert data["storage"]["configured"] is True
    assert data["storage"]["connected"] is True
    assert data["storage"]["root_folder_id"] == "mock_cce_root_folder_001"
