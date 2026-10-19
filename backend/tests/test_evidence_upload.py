import io
import uuid
from typing import Any, Dict, List, Optional

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.component import PGPAComponent
from app.models.file import AchievementFile, FileCategory
from app.models.user import User, UserRole
from app.services.drive_service import GoogleDriveService, set_drive_service


class MockEvidenceDriveService(GoogleDriveService):
    """Isolated in-memory Drive mock for evidence upload tests."""

    def __init__(self, root_folder_id: str = "mock_evidence_root"):
        super().__init__(root_folder_id=root_folder_id)
        self.root_folder_id = root_folder_id
        self.folders_store: Dict[str, Dict[str, Any]] = {
            root_folder_id: {"name": "CCE_Root", "parent": None}
        }
        self.files_store: Dict[str, Dict[str, Any]] = {}
        self.deleted_file_ids: List[str] = []
        self.fail_uploads: bool = False
        self.fail_deletes: bool = False
        self.is_connected_mock: bool = True

    @property
    def is_configured(self) -> bool:
        return self.is_connected_mock

    def verify_connectivity(self) -> Dict[str, Any]:
        if not self.is_connected_mock:
            return {
                "configured": False,
                "connected": False,
                "oauth_authorized": False,
                "authorized_email": None,
                "root_folder_id": self.root_folder_id,
                "message": "Google Drive storage not configured.",
                "detail": None,
            }
        return {
            "configured": True,
            "connected": True,
            "oauth_authorized": True,
            "authorized_email": "test@sairam.edu.in",
            "root_folder_id": self.root_folder_id,
            "folder_name": "CCE_Root",
            "message": "Google Drive API connectivity verified.",
            "detail": None,
        }

    def ensure_achievement_folder(self, student_id: uuid.UUID, achievement_id: uuid.UUID) -> str:
        s_folder = f"student_{student_id}"
        a_folder = f"achievement_{achievement_id}"
        self.folders_store[s_folder] = {"name": s_folder, "parent": self.root_folder_id}
        self.folders_store[a_folder] = {"name": a_folder, "parent": s_folder}
        return a_folder

    def upload_file(
        self,
        content: bytes,
        filename: str,
        mime_type: str,
        folder_id: str,
        opaque_prefix: Optional[str] = None,
    ) -> Dict[str, Any]:
        if self.fail_uploads:
            raise RuntimeError("Simulated Google Drive API upload error")

        prefix = opaque_prefix or uuid.uuid4().hex[:10]
        drive_file_id = f"drv_{uuid.uuid4().hex[:12]}"
        self.files_store[drive_file_id] = {
            "name": f"{prefix}_{filename}",
            "mime_type": mime_type,
            "size": len(content),
            "folder_id": folder_id,
        }
        return {
            "drive_file_id": drive_file_id,
            "name": f"{prefix}_{filename}",
            "size_bytes": len(content),
            "folder_id": folder_id,
        }

    def delete_file(self, drive_file_id: str) -> bool:
        if self.fail_deletes:
            raise RuntimeError("Simulated Google Drive API delete error")
        self.deleted_file_ids.append(drive_file_id)
        self.files_store.pop(drive_file_id, None)
        return True


@pytest.fixture
def evidence_mock_drive():
    service = MockEvidenceDriveService()
    set_drive_service(service)
    yield service
    set_drive_service(None)


@pytest.fixture
def evidence_test_data():
    session = SessionLocal()
    created_user_ids = []
    created_ach_ids = []

    # Get active component
    component = session.scalar(select(PGPAComponent).where(PGPAComponent.is_active.is_(True)).limit(1))
    assert component is not None

    suffix = uuid.uuid4().hex[:6]

    # Student 1
    s1 = User(
        id=uuid.uuid4(),
        full_name=f"Student One {suffix}",
        email=f"s1_{suffix}@sairam.edu.in",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    # Student 2 (Other student)
    s2 = User(
        id=uuid.uuid4(),
        full_name=f"Student Two {suffix}",
        email=f"s2_{suffix}@sairam.edu.in",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )

    ach = Achievement(
        id=uuid.uuid4(),
        student_id=s1.id,
        component_id=component.id,
        title=f"Test Achievement {suffix}",
        status=AchievementStatus.DRAFT,
    )

    session.add_all([s1, s2, ach])
    session.commit()
    created_user_ids.extend([s1.id, s2.id])
    created_ach_ids.append(ach.id)

    token_s1 = create_access_token(subject=s1.id, role="student")
    token_s2 = create_access_token(subject=s2.id, role="student")

    yield {
        "student_1": s1,
        "student_2": s2,
        "achievement": ach,
        "s1_headers": {"Authorization": f"Bearer {token_s1}"},
        "s2_headers": {"Authorization": f"Bearer {token_s2}"},
    }

    # Cleanup
    session.execute(text("DELETE FROM achievement_files WHERE achievement_id = ANY(:aids)"), {"aids": created_ach_ids})
    session.execute(text("DELETE FROM achievements WHERE id = ANY(:aids)"), {"aids": created_ach_ids})
    session.execute(text("DELETE FROM users WHERE id = ANY(:uids)"), {"uids": created_user_ids})
    session.commit()
    session.close()


def test_evidence_upload_valid_pdf_success(client: TestClient, evidence_mock_drive: MockEvidenceDriveService, evidence_test_data):
    """
    1. Valid PDF upload:
    - Accepts valid PDF binary with '%PDF-' header
    - Uploads to Google Drive with opaque folder hierarchy
    - Persists file record in PostgreSQL
    - Returns 201 Created with opaque content_url
    - Never leaks private Google Drive file ID
    """
    data = evidence_test_data
    ach_id = data["achievement"].id
    headers = data["s1_headers"]

    valid_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Title (Certificate) >>\nendobj\ntrailer\n<<>>\n%%EOF"

    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        files={"file": ("certificate.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 201
    resp_data = response.json()
    assert resp_data["original_filename"] == "certificate.pdf"
    assert resp_data["mime_type"] == "application/pdf"
    assert resp_data["size_bytes"] == len(valid_pdf_bytes)
    assert resp_data["file_category"] == "certificate"
    assert resp_data["provider"] == "google_drive"
    assert "content_url" in resp_data
    assert "drive_file_id" not in resp_data

    # Verify Drive mock contains file
    assert len(evidence_mock_drive.files_store) == 1

    # Verify DB persistence
    session = SessionLocal()
    try:
        db_file = session.get(AchievementFile, uuid.UUID(resp_data["id"]))
        assert db_file is not None
        assert db_file.achievement_id == ach_id
        assert db_file.uploaded_by == data["student_1"].id
        assert db_file.original_filename == "certificate.pdf"
    finally:
        session.close()


def test_evidence_upload_missing_or_empty_file_rejected(client: TestClient, evidence_mock_drive: MockEvidenceDriveService, evidence_test_data):
    """
    2. Missing / Empty file:
    - 0-byte file upload is rejected with 400 Bad Request
    - Missing file field returns 422 Unprocessable Entity
    - No Drive file or DB record created
    """
    data = evidence_test_data
    ach_id = data["achievement"].id
    headers = data["s1_headers"]

    # Case A: 0 bytes
    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
        data={"file_category": "certificate"},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()
    assert len(evidence_mock_drive.files_store) == 0

    # Case B: Missing file field
    response_no_file = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        data={"file_category": "certificate"},
    )
    assert response_no_file.status_code == 422


def test_evidence_upload_oversized_file_rejected(client: TestClient, evidence_mock_drive: MockEvidenceDriveService, evidence_test_data):
    """
    3. Oversized file:
    - Files exceeding MAX_UPLOAD_SIZE_MB (5 MiB) are rejected with 400 Bad Request
    - No Drive file or DB record created
    """
    data = evidence_test_data
    ach_id = data["achievement"].id
    headers = data["s1_headers"]

    # 5.5 MiB file (> 5 MiB limit)
    oversized_bytes = b"%PDF-1.4 " + (b"0" * (5 * 1024 * 1024 + 500 * 1024))

    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        files={"file": ("large_certificate.pdf", io.BytesIO(oversized_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "exceeds maximum allowed limit" in detail or "5 mb" in detail.lower()
    assert len(evidence_mock_drive.files_store) == 0


def test_evidence_upload_invalid_pdf_content_rejected(client: TestClient, evidence_mock_drive: MockEvidenceDriveService, evidence_test_data):
    """
    4. Invalid PDF content:
    - File named .pdf but lacking '%PDF-' signature is rejected with 400 Bad Request
    - No Drive file or DB record created
    """
    data = evidence_test_data
    ach_id = data["achievement"].id
    headers = data["s1_headers"]

    fake_pdf_content = b"This is plain text disguised as a certificate PDF without magic header."

    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        files={"file": ("fake_certificate.pdf", io.BytesIO(fake_pdf_content), "application/pdf")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 400
    assert "Invalid PDF" in response.json()["detail"]
    assert len(evidence_mock_drive.files_store) == 0


def test_evidence_upload_non_pdf_extension_rejected(client: TestClient, evidence_mock_drive: MockEvidenceDriveService, evidence_test_data):
    """
    5. Non-PDF extension:
    - Files with non-PDF extension are rejected with 400 Bad Request
    """
    data = evidence_test_data
    ach_id = data["achievement"].id
    headers = data["s1_headers"]

    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        files={"file": ("malicious.exe", io.BytesIO(b"MZ\x90\x00\x03\x00"), "application/octet-stream")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 400
    assert "Only PDF documents" in response.json()["detail"]
    assert len(evidence_mock_drive.files_store) == 0


def test_evidence_upload_unauthenticated_request_rejected(client: TestClient, evidence_test_data):
    """
    6. Unauthenticated request:
    - Missing Authorization header returns 401 Unauthorized
    """
    data = evidence_test_data
    ach_id = data["achievement"].id

    valid_pdf_bytes = b"%PDF-1.4 test binary content"

    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        files={"file": ("certificate.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 401


def test_evidence_upload_drive_failure_safe_handling(client: TestClient, evidence_mock_drive: MockEvidenceDriveService, evidence_test_data):
    """
    7. Google Drive failure:
    - Drive upload failure returns 502 Bad Gateway
    - Safe error message returned without exposing credentials
    - No orphaned database record created
    """
    data = evidence_test_data
    ach_id = data["achievement"].id
    headers = data["s1_headers"]

    evidence_mock_drive.fail_uploads = True
    valid_pdf_bytes = b"%PDF-1.4 test binary content"

    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        files={"file": ("certificate.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 502
    assert "Drive" in response.json()["detail"]

    # Verify no file record was persisted
    session = SessionLocal()
    try:
        files = session.scalars(select(AchievementFile).where(AchievementFile.achievement_id == ach_id)).all()
        assert len(files) == 0
    finally:
        session.close()


def test_evidence_upload_unauthorized_storage_returns_actionable_503(client: TestClient, evidence_mock_drive: MockEvidenceDriveService, evidence_test_data):
    """
    8. Storage not connected:
    - When Google Drive is not configured or unauthorized, returns 503 Service Unavailable
    - Returns clear actionable error message
    """
    data = evidence_test_data
    ach_id = data["achievement"].id
    headers = data["s1_headers"]

    evidence_mock_drive.is_connected_mock = False
    valid_pdf_bytes = b"%PDF-1.4 test binary content"

    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers,
        files={"file": ("certificate.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 503
    assert "Google Drive" in response.json()["detail"]


def test_evidence_upload_student_isolation_forbidden(client: TestClient, evidence_mock_drive: MockEvidenceDriveService, evidence_test_data):
    """
    9. Ownership isolation:
    - Student 2 cannot upload evidence to Student 1's achievement -> 403 Forbidden
    """
    data = evidence_test_data
    ach_id = data["achievement"].id
    headers_s2 = data["s2_headers"]

    valid_pdf_bytes = b"%PDF-1.4 test binary content"

    response = client.post(
        f"/api/v1/achievements/{ach_id}/files",
        headers=headers_s2,
        files={"file": ("certificate.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")},
        data={"file_category": "certificate"},
    )

    assert response.status_code == 403
    assert "another student" in response.json()["detail"].lower()
    assert len(evidence_mock_drive.files_store) == 0
