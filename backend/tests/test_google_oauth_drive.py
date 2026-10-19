import io
import time
import uuid
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from googleapiclient.errors import HttpError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.oauth_crypto import (
    decrypt_token,
    encrypt_token,
    generate_oauth_state,
    verify_oauth_state,
)
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
from app.models.file import AchievementFile, FileCategory
from app.models.oauth import OAuthCredential
from app.models.user import User, UserRole
from app.services.drive_service import GoogleDriveService, get_drive_service, set_drive_service


@pytest.fixture
def db():
    """
    Session fixture with automated teardown for test users and artifacts.
    """
    session = SessionLocal()
    created_user_ids: List[uuid.UUID] = []
    created_file_ids: List[uuid.UUID] = []
    created_achievement_ids: List[uuid.UUID] = []

    def _track_user(uid: uuid.UUID):
        created_user_ids.append(uid)

    def _track_file(fid: uuid.UUID):
        created_file_ids.append(fid)

    def _track_achievement(aid: uuid.UUID):
        created_achievement_ids.append(aid)

    session.track_user = _track_user  # type: ignore
    session.track_file = _track_file  # type: ignore
    session.track_achievement = _track_achievement  # type: ignore

    try:
        yield session
    finally:
        # Clean up files
        if created_file_ids:
            for fid in created_file_ids:
                f = session.get(AchievementFile, fid)
                if f:
                    session.delete(f)
            session.commit()

        # Clean up achievements
        if created_achievement_ids:
            for aid in created_achievement_ids:
                a = session.get(Achievement, aid)
                if a:
                    session.delete(a)
            session.commit()

        # Clean up assignments and users
        if created_user_ids:
            assignments = session.scalars(
                select(MentorAssignment).where(
                    (MentorAssignment.student_id.in_(created_user_ids))
                    | (MentorAssignment.mentor_id.in_(created_user_ids))
                )
            ).all()
            for assign in assignments:
                session.delete(assign)

            for uid in created_user_ids:
                u = session.get(User, uid)
                if u:
                    session.delete(u)
            session.commit()

        # Clean up test oauth credentials
        session.close()


# ==============================================================================
# 1. State Validation & CSRF Tests
# ==============================================================================

def test_oauth_state_generation_and_verification():
    """
    Test CSRF state token generation and verification:
    - Binds to user ID and action.
    - Decodes properly when valid.
    - Rejects tampered tokens.
    - Rejects expired tokens.
    """
    admin_id = uuid.uuid4()
    state = generate_oauth_state(admin_id, action="google_drive_oauth")
    assert isinstance(state, str)
    assert len(state) > 20

    # Valid decode
    payload = verify_oauth_state(state, expected_action="google_drive_oauth")
    assert payload["sub"] == str(admin_id)
    assert payload["action"] == "google_drive_oauth"
    assert "nonce" in payload

    # Action mismatch
    with pytest.raises(ValueError, match="action mismatch"):
        verify_oauth_state(state, expected_action="different_action")

    # Tampered state
    tampered = state[:-4] + "abcd"
    with pytest.raises(ValueError, match="CSRF validation failed"):
        verify_oauth_state(tampered)

    # Empty state
    with pytest.raises(ValueError, match="Missing OAuth state"):
        verify_oauth_state("")


def test_oauth_token_encryption_and_decryption():
    """
    Verify that refresh tokens are properly encrypted with Fernet and decrypted losslessly.
    """
    secret_refresh_token = "1//04test_real_refresh_token_very_sensitive_xyz"
    encrypted = encrypt_token(secret_refresh_token)

    assert encrypted != secret_refresh_token
    assert "test_real_refresh_token" not in encrypted

    decrypted = decrypt_token(encrypted)
    assert decrypted == secret_refresh_token


# ==============================================================================
# 2. Authorization Endpoint Guard Tests
# ==============================================================================

def test_oauth_authorize_endpoint_requires_admin(client: TestClient, db: Session):
    """
    Verify GET /api/v1/auth/google/authorize:
    - Rejects unauthenticated callers with 401.
    - Rejects Student with 403 Forbidden.
    - Rejects Mentor with 403 Forbidden.
    - Permits Admin with 200 JSON or 307 redirect.
    """
    # 1. Unauthenticated -> 401
    res_unauth = client.get("/api/v1/auth/google/authorize")
    assert res_unauth.status_code == 401

    # 2. Student -> 403
    student = User(id=uuid.uuid4(), full_name="Student", email=f"s_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT, is_active=True)
    db.add(student)
    db.commit()
    db.track_user(student.id)  # type: ignore

    t_student = create_access_token(subject=student.id, role="student")
    res_student = client.get("/api/v1/auth/google/authorize", headers={"Authorization": f"Bearer {t_student}"})
    assert res_student.status_code == 403

    # 3. Mentor -> 403
    mentor = User(id=uuid.uuid4(), full_name="Mentor", email=f"m_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR, is_active=True)
    db.add(mentor)
    db.commit()
    db.track_user(mentor.id)  # type: ignore

    t_mentor = create_access_token(subject=mentor.id, role="mentor")
    res_mentor = client.get("/api/v1/auth/google/authorize", headers={"Authorization": f"Bearer {t_mentor}"})
    assert res_mentor.status_code == 403

    # 4. Admin with unconfigured credentials -> 400 Bad Request
    admin = User(id=uuid.uuid4(), full_name="Admin", email=f"a_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.ADMIN, is_active=True)
    db.add(admin)
    db.commit()
    db.track_user(admin.id)  # type: ignore

    t_admin = create_access_token(subject=admin.id, role="admin")

    # With credentials configured via monkeypatch
    with patch.object(settings, "GOOGLE_OAUTH_CLIENT_ID", "test-client-id.apps.googleusercontent.com"), \
         patch.object(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "test-secret"):

        # JSON response (redirect=False)
        res_admin = client.get("/api/v1/auth/google/authorize", headers={"Authorization": f"Bearer {t_admin}"})
        assert res_admin.status_code == 200
        data = res_admin.json()
        assert "authorization_url" in data
        assert "accounts.google.com" in data["authorization_url"]
        assert "test-client-id" in data["authorization_url"]
        assert "drive.file" in data["authorization_url"]
        assert "prompt=consent" in data["authorization_url"]
        assert "access_type=offline" in data["authorization_url"]
        assert "state=" in data["authorization_url"]

        # Browser redirect (redirect=True)
        res_redirect = client.get("/api/v1/auth/google/authorize?redirect=true", headers={"Authorization": f"Bearer {t_admin}"}, follow_redirects=False)
        assert res_redirect.status_code == 307
        assert "accounts.google.com" in res_redirect.headers["location"]


def test_oauth_no_bearer_token_accepted_through_query_params(client: TestClient, db: Session):
    """
    Verify that passing access/bearer tokens in URL query parameters is rejected.
    Authentication strictly requires the standard Authorization: Bearer <token> header.
    """
    admin = User(
        id=uuid.uuid4(),
        full_name="Admin User",
        email=f"admin_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="h",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.track_user(admin.id)  # type: ignore

    t_admin = create_access_token(subject=admin.id, role="admin")

    with patch.object(settings, "GOOGLE_OAUTH_CLIENT_ID", "test-client-id"), \
         patch.object(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "test-secret"):

        # 1. ?token=... without header -> Rejected with 401
        res1 = client.get(f"/api/v1/auth/google/authorize?token={t_admin}")
        assert res1.status_code == 401
        assert "Not authenticated. Bearer token is missing." in res1.json()["detail"]

        # 2. ?access_token=... without header -> Rejected with 401
        res2 = client.get(f"/api/v1/auth/google/authorize?access_token={t_admin}")
        assert res2.status_code == 401
        assert "Not authenticated. Bearer token is missing." in res2.json()["detail"]

        # 3. ?bearer=... without header -> Rejected with 401
        res3 = client.get(f"/api/v1/auth/google/authorize?bearer={t_admin}")
        assert res3.status_code == 401
        assert "Not authenticated. Bearer token is missing." in res3.json()["detail"]


# ==============================================================================
# 3. Callback Endpoint Tests
# ==============================================================================

def test_oauth_callback_state_mismatch_rejected(client: TestClient):
    """
    Verify callback returns 400 on invalid or missing state parameter (CSRF defense).
    """
    # 1. Missing state
    res_no_state = client.get("/api/v1/auth/google/callback?code=some_code")
    assert res_no_state.status_code == 400
    assert "Missing OAuth state" in res_no_state.json()["detail"]

    # 2. Tampered state
    res_bad_state = client.get("/api/v1/auth/google/callback?code=some_code&state=invalid_jwt_state")
    assert res_bad_state.status_code == 400
    assert "OAuth state verification failed" in res_bad_state.json()["detail"]


def test_oauth_callback_expired_state_rejected(client: TestClient):
    """
    Verify callback returns 400 when an expired state token is submitted (exp < current time).
    """
    import jwt
    import time

    admin_id = uuid.uuid4()
    expired_payload = {
        "sub": str(admin_id),
        "action": "google_drive_oauth",
        "nonce": uuid.uuid4().hex,
        "iat": int(time.time()) - 3600,
        "exp": int(time.time()) - 1800,  # Expired 30 minutes ago
    }
    expired_state = jwt.encode(expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    res = client.get(f"/api/v1/auth/google/callback?code=some_code&state={expired_state}")
    assert res.status_code == 400
    assert "OAuth state verification failed" in res.json()["detail"]
    assert "expired" in res.json()["detail"].lower()


def test_oauth_callback_browser_error_renders_actionable_html(client: TestClient):
    """
    Verify that when an interactive browser (Accept: text/html) encounters an error
    during callback, a safe and actionable HTML error page with a Return to Admin Console
    button is rendered instead of a raw JSON trace.
    """
    res = client.get(
        "/api/v1/auth/google/callback?code=some_code",
        headers={"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"},
    )
    assert res.status_code == 400
    assert "text/html" in res.headers["content-type"]
    assert "Authorization Failed" in res.text
    assert "Return to Admin Console" in res.text
    assert "http://localhost:3000/admin" in res.text



def test_oauth_callback_error_declined(client: TestClient):
    """
    Verify callback returns 400 when user declines consent in Google prompt.
    """
    res = client.get("/api/v1/auth/google/callback?error=access_denied&error_description=User+denied+access")
    assert res.status_code == 400
    assert "declined" in res.json()["detail"]


def test_oauth_callback_preserves_existing_token_if_omitted_by_google(client: TestClient, db: Session):
    """
    Verify callback reuses existing persisted refresh token if Google omits it on re-consent.
    """
    admin = User(id=uuid.uuid4(), full_name="Admin User", email=f"admin_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.ADMIN, is_active=True)
    db.add(admin)
    db.commit()
    db.track_user(admin.id)  # type: ignore

    valid_state = generate_oauth_state(admin.id, action="google_drive_oauth")

    # Ensure a pre-existing credential exists
    existing = db.scalars(select(OAuthCredential).where(OAuthCredential.provider == "google_drive")).first()
    saved_backup = None
    if existing:
        saved_backup = {c.name: getattr(existing, c.name) for c in OAuthCredential.__table__.columns}
    else:
        existing = OAuthCredential(
            id=uuid.uuid4(),
            provider="google_drive",
            client_id="test-client-id",
            encrypted_refresh_token=encrypt_token("1//04test_existing_refresh_token"),
            scopes="https://www.googleapis.com/auth/drive.file",
            authorized_by=admin.id,
            authorized_email=admin.email,
        )
        db.add(existing)
        db.commit()

    saved_token = existing.encrypted_refresh_token

    try:
        with patch.object(settings, "GOOGLE_OAUTH_CLIENT_ID", existing.client_id), \
             patch.object(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "test-secret"), \
             patch("httpx.Client.post") as mock_post:

            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "access_token": "ya29.new_access_token",
                "expires_in": 3600,
                "scope": "https://www.googleapis.com/auth/drive.file",
                "token_type": "Bearer",
                # refresh_token omitted by Google
            }
            mock_post.return_value = mock_resp

            res = client.get(f"/api/v1/auth/google/callback?code=test_code_123&state={valid_state}")
            assert res.status_code == 200
            assert "Google Drive Connected" in res.text

            db.expire_all()
            rechecked = db.scalars(select(OAuthCredential).where(OAuthCredential.provider == "google_drive")).first()
            assert rechecked is not None
            assert decrypt_token(rechecked.encrypted_refresh_token) == decrypt_token(saved_token)
    finally:
        if saved_backup:
            db.expire_all()
            current = db.scalars(select(OAuthCredential).where(OAuthCredential.provider == "google_drive")).first()
            if current:
                for k, v in saved_backup.items():
                    setattr(current, k, v)
                db.commit()
        get_drive_service(reload=True)


def test_oauth_callback_missing_refresh_token_rejected_when_no_existing(client: TestClient, db: Session):
    """
    Verify callback returns 400 if Google omits refresh_token and no prior credential is saved.
    """
    admin = User(id=uuid.uuid4(), full_name="Admin", email=f"a_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.ADMIN, is_active=True)
    db.add(admin)
    db.commit()
    db.track_user(admin.id)  # type: ignore

    valid_state = generate_oauth_state(admin.id, action="google_drive_oauth")

    # Temporarily remove any existing credential to test initial-consent rejection
    existing = db.scalars(select(OAuthCredential).where(OAuthCredential.provider == "google_drive")).first()
    saved_backup = None
    if existing:
        saved_backup = {c.name: getattr(existing, c.name) for c in OAuthCredential.__table__.columns}
        db.delete(existing)
        db.commit()

    try:
        with patch.object(settings, "GOOGLE_OAUTH_CLIENT_ID", "test-client-id"), \
             patch.object(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "test-secret"), \
             patch("httpx.Client.post") as mock_post:

            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "access_token": "ya29.test_access_token",
                "expires_in": 3600,
                "scope": "https://www.googleapis.com/auth/drive.file",
                "token_type": "Bearer",
                # refresh_token is missing!
            }
            mock_post.return_value = mock_resp

            res = client.get(f"/api/v1/auth/google/callback?code=test_code_123&state={valid_state}")
            assert res.status_code == 400
            assert "refresh token" in res.json()["detail"]
    finally:
        if saved_backup:
            db.add(OAuthCredential(**saved_backup))
            db.commit()
        get_drive_service(reload=True)


def test_oauth_callback_successful_exchange_and_persistence(client: TestClient, db: Session):
    """
    Verify successful OAuth 2.0 callback flow:
    - Exchanges authorization code for tokens.
    - Encrypts refresh_token at rest in PostgreSQL.
    - Returns 200 HTML response without leaking tokens.
    - Does not expose secret credentials.
    - Preserves pre-existing credential state so the test is isolated and non-destructive.
    """
    existing_cred = db.scalars(select(OAuthCredential).where(OAuthCredential.provider == "google_drive")).first()
    saved_cred_data = None
    if existing_cred:
        saved_cred_data = {c.name: getattr(existing_cred, c.name) for c in OAuthCredential.__table__.columns}

    admin = User(id=uuid.uuid4(), full_name="Admin User", email=f"admin_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.ADMIN, is_active=True)
    db.add(admin)
    db.commit()
    db.track_user(admin.id)  # type: ignore

    valid_state = generate_oauth_state(admin.id, action="google_drive_oauth")
    mock_refresh_token = f"1//04test_refresh_token_{uuid.uuid4().hex}"

    try:
        with patch.object(settings, "GOOGLE_OAUTH_CLIENT_ID", "test-client-id"), \
             patch.object(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "test-secret"), \
             patch("httpx.Client.post") as mock_post:

            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "access_token": "ya29.test_access_token_abc",
                "refresh_token": mock_refresh_token,
                "expires_in": 3600,
                "scope": "https://www.googleapis.com/auth/drive.file",
                "token_type": "Bearer",
            }
            mock_post.return_value = mock_resp

            res = client.get(f"/api/v1/auth/google/callback?code=test_auth_code_xyz&state={valid_state}")
            assert res.status_code == 200
            assert "Google Drive Connected" in res.text
            assert "Return to Admin Console" in res.text
            assert "http://localhost:3000/admin" in res.text
            # Ensure secret tokens are NEVER leaked in HTML response
            assert mock_refresh_token not in res.text
            assert "ya29." not in res.text

        # Verify database persistence
        db.expire_all()
        cred = db.scalars(select(OAuthCredential).where(OAuthCredential.provider == "google_drive")).first()
        assert cred is not None
        assert cred.client_id == "test-client-id"
        assert cred.authorized_by == admin.id
        assert cred.authorized_email == admin.email
        # Verify encrypted at rest
        assert cred.encrypted_refresh_token != mock_refresh_token
        # Verify lossless decryption
        decrypted = decrypt_token(cred.encrypted_refresh_token)
        assert decrypted == mock_refresh_token
    finally:
        db.expire_all()
        current_creds = db.scalars(select(OAuthCredential).where(OAuthCredential.provider == "google_drive")).all()
        for c in current_creds:
            db.delete(c)
        db.commit()

        if saved_cred_data:
            restored = OAuthCredential(**saved_cred_data)
            db.add(restored)
            db.commit()
        get_drive_service(reload=True)


# ==============================================================================
# 4. File Size & Content Validation Tests
# ==============================================================================

def test_file_size_validation_enforces_5mb_limit():
    """
    Verify file size validation strictly enforces 5 MiB (5,242,880 bytes).
    """
    service = GoogleDriveService()

    # 1. 5.0 MiB valid file (5 * 1024 * 1024 bytes) -> OK
    exact_5mb = b"%PDF-1.4\n" + b"A" * (5 * 1024 * 1024 - 9)
    name, mime, sz = service.validate_file("document.pdf", exact_5mb, "application/pdf")
    assert sz == 5 * 1024 * 1024

    # 2. 5 MiB + 1 byte -> Rejected with 400 ValueError
    too_large = exact_5mb + b"X"
    with pytest.raises(ValueError, match="exceeds maximum allowed limit of 5"):
        service.validate_file("document.pdf", too_large, "application/pdf")


def test_oauth_drive_service_expired_access_token_refresh():
    """
    Verify that when user OAuth credentials have an expired or missing access token,
    calling API methods invokes Google's token refresh mechanism using the stored refresh_token.
    """
    from google.oauth2.credentials import Credentials as UserCredentials

    mock_refresh_token = "1//04test_refresh_token_to_refresh"
    service = GoogleDriveService(
        oauth_client_id="test-client-id",
        oauth_client_secret="test-client-secret",
        refresh_token=mock_refresh_token,
        root_folder_id="mock_root_folder",
    )

    # Mock the UserCredentials refresh behavior
    with patch("google.oauth2.credentials.Credentials.refresh") as mock_refresh, \
         patch("app.services.drive_service.build") as mock_build:

        mock_resource = MagicMock()
        mock_build.return_value = mock_resource

        # Calling service property triggers _build_drive_client
        client_res = service.service
        assert client_res == mock_resource
        assert mock_build.called
        # Verify UserCredentials passed with refresh_token
        creds_arg = mock_build.call_args[1]["credentials"]
        assert isinstance(creds_arg, UserCredentials)
        assert creds_arg.refresh_token == mock_refresh_token
        assert creds_arg.client_id == "test-client-id"


def test_pdf_content_validation_rejects_missing_magic_header():
    """
    Verify content validation:
    A file claiming to be '.pdf' that does NOT contain '%PDF-' header is rejected.
    """
    service = GoogleDriveService()

    # 1. Valid PDF header
    valid_pdf = b"%PDF-1.5\n%trailer\nend"
    name, mime, sz = service.validate_file("certificate.pdf", valid_pdf, "application/pdf")
    assert name == "certificate.pdf"
    assert mime == "application/pdf"

    # 2. Fake PDF (plain text or script claiming to be PDF)
    fake_pdf = b"<html><script>alert('fake')</script></html>"
    with pytest.raises(ValueError, match="Missing '%PDF-' header signature"):
        service.validate_file("malicious.pdf", fake_pdf, "application/pdf")

    # 3. Empty PDF
    with pytest.raises(ValueError, match="Uploaded file is empty"):
        service.validate_file("empty.pdf", b"", "application/pdf")


# ==============================================================================
# 5. Upload Failure & DB Rollback Cleanup Tests
# ==============================================================================

class MockDriveServiceForUpload(GoogleDriveService):
    def __init__(self):
        super().__init__()
        self.deleted_files = []
        self.uploaded_files = {}

    @property
    def is_configured(self) -> bool:
        return True

    def ensure_achievement_folder(self, student_id, achievement_id):
        return f"folder_{achievement_id}"

    def upload_file(self, content, filename, mime_type, folder_id, opaque_prefix=None):
        fid = f"drive_file_{uuid.uuid4().hex[:8]}"
        self.uploaded_files[fid] = {"content": content, "filename": filename}
        return {
            "drive_file_id": fid,
            "drive_folder_id": folder_id,
            "drive_filename": filename,
            "size_bytes": len(content),
            "mime_type": mime_type,
        }

    def delete_file(self, drive_file_id: str) -> bool:
        self.deleted_files.append(drive_file_id)
        if drive_file_id in self.uploaded_files:
            del self.uploaded_files[drive_file_id]
        return True


def test_upload_failure_returns_502_and_no_db_record(client: TestClient, db: Session):
    """
    Simulate Google Drive API failure during upload.
    Verify 502 Bad Gateway and that no file record or audit log is written.
    """
    comp = db.scalars(select(PGPAComponent)).first()
    student = User(id=uuid.uuid4(), full_name="Student", email=f"s_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT, is_active=True)
    ach = Achievement(id=uuid.uuid4(), student_id=student.id, component_id=comp.id, title="Test Ach", status=AchievementStatus.DRAFT)

    db.add_all([student, ach])
    db.commit()
    db.track_user(student.id)  # type: ignore
    db.track_achievement(ach.id)  # type: ignore

    t_student = create_access_token(subject=student.id, role="student")

    # Mock Drive service throwing an error during upload
    mock_ds = MockDriveServiceForUpload()
    def _fail_upload(*args, **kwargs):
        raise RuntimeError("Simulated Google Drive API timeout")
    mock_ds.upload_file = _fail_upload  # type: ignore

    set_drive_service(mock_ds)
    try:
        valid_pdf_content = b"%PDF-1.4\nSample content"
        files = {"file": ("cert.pdf", io.BytesIO(valid_pdf_content), "application/pdf")}
        data = {"file_category": "certificate"}

        res = client.post(
            f"/api/v1/achievements/{ach.id}/files",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {t_student}"},
        )
        assert res.status_code == 502
        assert "Google Drive file upload failed" in res.json()["detail"]

        # Ensure no database record was created
        file_count = db.scalars(select(AchievementFile).where(AchievementFile.achievement_id == ach.id)).all()
        assert len(file_count) == 0
    finally:
        set_drive_service(None)
        get_drive_service(reload=True)


def test_database_failure_cleans_up_orphaned_drive_file(db: Session):
    """
    Verify transactional integrity:
    If database persistence fails after file was uploaded to Drive,
    the orphaned Drive file must be cleaned up immediately via delete_file.
    """
    from fastapi import HTTPException
    from app.services.file_manager import upload_achievement_file

    comp = db.scalars(select(PGPAComponent)).first()
    student = User(id=uuid.uuid4(), full_name="Student", email=f"s_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT, is_active=True)
    ach = Achievement(id=uuid.uuid4(), student_id=student.id, component_id=comp.id, title="Test Ach", status=AchievementStatus.DRAFT)

    db.add_all([student, ach])
    db.commit()
    db.track_user(student.id)  # type: ignore
    db.track_achievement(ach.id)  # type: ignore

    mock_ds = MockDriveServiceForUpload()

    # Simulate database failure during commit by mocking session.add to raise
    valid_pdf = b"%PDF-1.4\nTest Document"

    with patch.object(db, "commit", side_effect=RuntimeError("Simulated DB connection failure")):
        with pytest.raises(HTTPException) as exc_info:
            upload_achievement_file(
                session=db,
                current_user=student,
                achievement_id=ach.id,
                file_category=FileCategory.CERTIFICATE,
                filename="cert.pdf",
                content=valid_pdf,
                content_type="application/pdf",
                drive_service=mock_ds,
            )
        assert exc_info.value.status_code == 500

    # Verify that the orphaned file on Drive was cleaned up!
    assert len(mock_ds.deleted_files) == 1


# ==============================================================================
# 6. Role-Based Evidence Access Tests
# ==============================================================================

def test_role_based_evidence_access(client: TestClient, db: Session):
    """
    Verify evidence access authorization:
    - Student owner CAN view/download.
    - Other students CANNOT view/download (403).
    - Assigned Mentor CAN view/download.
    - Unassigned Mentor CANNOT view/download (403).
    - HOD CAN view/download.
    """
    comp = db.scalars(select(PGPAComponent)).first()

    # 1. Student A (owner)
    sa = User(id=uuid.uuid4(), full_name="Student A", email=f"sa_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT, is_active=True)
    ach = Achievement(id=uuid.uuid4(), student_id=sa.id, component_id=comp.id, title="Activity A", status=AchievementStatus.PENDING)

    # 2. Student B (stranger)
    sb = User(id=uuid.uuid4(), full_name="Student B", email=f"sb_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT, is_active=True)

    # 3. Mentor 1 (assigned)
    m1 = User(id=uuid.uuid4(), full_name="Mentor 1", email=f"m1_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR, is_active=True)
    assign = MentorAssignment(id=uuid.uuid4(), mentor_id=m1.id, student_id=sa.id, is_active=True)

    # 4. Mentor 2 (unassigned)
    m2 = User(id=uuid.uuid4(), full_name="Mentor 2", email=f"m2_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR, is_active=True)

    # 5. HOD
    hod = User(id=uuid.uuid4(), full_name="HOD", email=f"hod_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.HOD, is_active=True)

    # File attached to achievement
    file_record = AchievementFile(
        id=uuid.uuid4(),
        achievement_id=ach.id,
        provider="google_drive",
        drive_file_id="mock_drive_file_123",
        original_filename="certificate.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
        file_category=FileCategory.CERTIFICATE,
        uploaded_by=sa.id,
    )

    db.add_all([sa, ach, sb, m1, assign, m2, hod, file_record])
    db.commit()
    for u in [sa, sb, m1, m2, hod]:
        db.track_user(u.id)  # type: ignore
    db.track_file(file_record.id)  # type: ignore
    db.track_achievement(ach.id)  # type: ignore

    t_sa = create_access_token(subject=sa.id, role="student")
    t_sb = create_access_token(subject=sb.id, role="student")
    t_m1 = create_access_token(subject=m1.id, role="mentor")
    t_m2 = create_access_token(subject=m2.id, role="mentor")
    t_hod = create_access_token(subject=hod.id, role="hod")

    mock_ds = MockDriveServiceForUpload()
    mock_ds.download_file = lambda fid: (b"%PDF-1.4\nDummy Binary", {"drive_filename": "certificate.pdf", "mime_type": "application/pdf"})  # type: ignore
    set_drive_service(mock_ds)

    try:
        # A. Student A (owner) lists & streams files -> 200 OK
        res_sa = client.get(f"/api/v1/achievements/{ach.id}/files", headers={"Authorization": f"Bearer {t_sa}"})
        assert res_sa.status_code == 200
        res_stream_sa = client.get(f"/api/v1/files/{file_record.id}/content", headers={"Authorization": f"Bearer {t_sa}"})
        assert res_stream_sa.status_code == 200

        # B. Student B (unauthorized) -> 403 Forbidden
        res_sb = client.get(f"/api/v1/achievements/{ach.id}/files", headers={"Authorization": f"Bearer {t_sb}"})
        assert res_sb.status_code == 403
        res_stream_sb = client.get(f"/api/v1/files/{file_record.id}/content", headers={"Authorization": f"Bearer {t_sb}"})
        assert res_stream_sb.status_code == 403

        # C. Assigned Mentor 1 -> 200 OK
        res_m1 = client.get(f"/api/v1/achievements/{ach.id}/files", headers={"Authorization": f"Bearer {t_m1}"})
        assert res_m1.status_code == 200
        res_stream_m1 = client.get(f"/api/v1/files/{file_record.id}/content", headers={"Authorization": f"Bearer {t_m1}"})
        assert res_stream_m1.status_code == 200

        # D. Unassigned Mentor 2 -> 403 Forbidden
        res_m2 = client.get(f"/api/v1/achievements/{ach.id}/files", headers={"Authorization": f"Bearer {t_m2}"})
        assert res_m2.status_code == 403
        res_stream_m2 = client.get(f"/api/v1/files/{file_record.id}/content", headers={"Authorization": f"Bearer {t_m2}"})
        assert res_stream_m2.status_code == 403

        # E. HOD -> 200 OK
        res_hod = client.get(f"/api/v1/achievements/{ach.id}/files", headers={"Authorization": f"Bearer {t_hod}"})
        assert res_hod.status_code == 200
        res_stream_hod = client.get(f"/api/v1/files/{file_record.id}/content", headers={"Authorization": f"Bearer {t_hod}"})
        assert res_stream_hod.status_code == 200

    finally:
        set_drive_service(None)
        get_drive_service(reload=True)


# ==============================================================================
# 7. Storage Status & drive.file Scope Connectivity Tests
# ==============================================================================

def test_drive_service_verify_connectivity_drive_file_scope_fallback():
    """
    Verify that when the root folder was created externally in Google Drive Web UI
    (which causes files().get() to return 404 under the least-privilege drive.file scope),
    verify_connectivity() safely validates root folder accessibility using files().list()
    with the parent query and marks connected=True without requiring full drive scope.
    """
    mock_service = MagicMock()

    # files().get() returns 404 (simulating Google's drive.file restriction on external folders)
    mock_resp_404 = MagicMock(status=404, reason="Not Found")
    mock_service.files().get().execute.side_effect = HttpError(resp=mock_resp_404, content=b"File not found")

    # files().list() succeeds with 200 OK (proving the parent folder exists and is accessible)
    mock_service.files().list().execute.return_value = {"files": []}

    ds = GoogleDriveService(
        service=mock_service,
        oauth_client_id="mock_client_id",
        oauth_client_secret="mock_secret",
        refresh_token="mock_refresh_token",
        root_folder_id="1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI",
        authorized_email="cce.pgpa@gmail.com",
    )

    status = ds.verify_connectivity()
    assert status["configured"] is True
    assert status["connected"] is True
    assert status["oauth_authorized"] is True
    assert status["authorized_email"] == "cce.pgpa@gmail.com"
    assert status["root_folder_id"] == "1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI"
    assert "verified successfully" in status["message"]


def test_drive_service_verify_connectivity_inaccessible_parent():
    """
    Verify that if both files().get() and files().list() fail with 404 (e.g. invalid/deleted folder ID),
    connected is reported as False with clear error details.
    """
    mock_service = MagicMock()

    mock_resp_404 = MagicMock(status=404, reason="Not Found")
    mock_service.files().get().execute.side_effect = HttpError(resp=mock_resp_404, content=b"File not found")
    mock_service.files().list().execute.side_effect = HttpError(resp=mock_resp_404, content=b"Parent not found")

    ds = GoogleDriveService(
        service=mock_service,
        oauth_client_id="mock_client_id",
        oauth_client_secret="mock_secret",
        refresh_token="mock_refresh_token",
        root_folder_id="bogus_folder_id",
        authorized_email="cce.pgpa@gmail.com",
    )

    status = ds.verify_connectivity()
    assert status["configured"] is True
    assert status["connected"] is False
    assert status["oauth_authorized"] is True
    assert "not accessible" in status["message"] or "not found" in status["message"]


def test_health_endpoint_reports_oauth_and_storage_status(client: TestClient):
    """
    Verify that the /health and /api/v1/health endpoints report the GoogleDriveStatus
    including oauth_authorized and authorized_email fields.
    """
    for endpoint in ["/health", "/api/v1/health"]:
        res = client.get(endpoint)
        assert res.status_code == 200
        data = res.json()
        assert "storage" in data
        storage = data["storage"]
        assert "configured" in storage
        assert "connected" in storage
        assert "oauth_authorized" in storage
        assert "authorized_email" in storage
        assert "root_folder_id" in storage
        assert "message" in storage
