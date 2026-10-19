
import io
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from google.oauth2.credentials import Credentials as UserCredentials
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
from googleapiclient.discovery import Resource, build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

from app.core.config import settings

logger = logging.getLogger(__name__)

# Scopes: least privilege for managing drive files created/used by this app
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]


_SENTINEL = object()


class GoogleDriveService:
    """
    Modular Google Drive API client for CCE Achieve.
    
    ARCHITECTURAL MANDATES:
    1. Google Drive is the ONLY permanent storage location for uploaded evidence binaries.
    2. Folders and Drive files use OPAQUE identifiers to prevent leaking student PII.
    3. Files are strictly PRIVATE to the configured account / shared drive folder.
        Public permissions and open portfolio links are NEVER created.
    4. Supports Google OAuth 2.0 user flow for personal Gmail accounts, with
        offline refresh tokens persisted securely.
    """

    def __init__(
        self,
        service: Optional[Resource] = None,
        oauth_client_id: Any = _SENTINEL,
        oauth_client_secret: Any = _SENTINEL,
        refresh_token: Optional[str] = None,
        service_account_file: Any = _SENTINEL,
        service_account_json: Any = _SENTINEL,
        root_folder_id: Any = _SENTINEL,
        authorized_email: Optional[str] = None,
    ):
        self._service: Optional[Resource] = service
        self.oauth_client_id = settings.GOOGLE_OAUTH_CLIENT_ID if oauth_client_id is _SENTINEL else oauth_client_id
        self.oauth_client_secret = settings.GOOGLE_OAUTH_CLIENT_SECRET if oauth_client_secret is _SENTINEL else oauth_client_secret
        self.refresh_token = refresh_token
        self.authorized_email = authorized_email
        self.service_account_file = settings.GOOGLE_SERVICE_ACCOUNT_FILE if service_account_file is _SENTINEL else service_account_file
        self.service_account_json = settings.GOOGLE_SERVICE_ACCOUNT_JSON if service_account_json is _SENTINEL else service_account_json
        self.root_folder_id = settings.GOOGLE_DRIVE_FOLDER_ID if root_folder_id is _SENTINEL else root_folder_id

    @property
    def is_oauth_credentials_configured(self) -> bool:
        """True if OAuth client ID, secret, and root folder ID are specified in settings/env."""
        return bool(self.oauth_client_id and self.oauth_client_secret and self.root_folder_id)

    @property
    def is_oauth_configured(self) -> bool:
        """True if user OAuth credentials (client_id, secret, and refresh_token) are present."""
        return bool(self.oauth_client_id and self.oauth_client_secret and self.refresh_token)

    @property
    def is_configured(self) -> bool:
        """
        Returns True if credentials and root folder ID are specified.
        """
        if self._service is not None:
            return bool(self.root_folder_id)
        has_creds = self.is_oauth_configured or bool(self.service_account_file or self.service_account_json)
        return has_creds and bool(self.root_folder_id)

    @property
    def service(self) -> Resource:
        """
        Lazily initializes and returns the Google Drive Resource client.
        """
        if self._service is None:
            self._service = self._build_drive_client()
        return self._service

    def _build_drive_client(self) -> Resource:
        """
        Initializes Google Drive API v3 client using either:
        1. User OAuth 2.0 credentials (preferred for personal Gmail accounts)
        2. Service Account credentials (if explicitly configured)
        MANDATE: If OAuth is configured, does NOT silently fall back to service accounts.
        """
        # Path A: OAuth 2.0 Web Server flow
        if self.oauth_client_id and self.oauth_client_secret:
            if not self.refresh_token:
                logger.error("OAuth client ID is configured, but no refresh token is stored.")
                raise RuntimeError(
                    "Google Drive OAuth 2.0 credentials not yet authorized. "
                    "Please visit /api/v1/auth/google/authorize to complete authorization."
                )

            creds = UserCredentials(
                token=None,
                refresh_token=self.refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.oauth_client_id,
                client_secret=self.oauth_client_secret,
                scopes=DRIVE_SCOPES,
            )
            return build("drive", "v3", credentials=creds, cache_discovery=False)

        # Path B: Service Account (only when OAuth is not configured)
        if self.service_account_json:
            try:
                info = json.loads(self.service_account_json)
                creds = ServiceAccountCredentials.from_service_account_info(info, scopes=DRIVE_SCOPES)
            except Exception as e:
                logger.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: %s", e)
                raise RuntimeError(f"Invalid Google Service Account JSON configuration: {e}")
        elif self.service_account_file:
            path = Path(self.service_account_file)
            if not path.is_file():
                logger.error("Service account file not found at: %s", path)
                raise FileNotFoundError(f"Google Service Account file not found: {path}")
            try:
                creds = ServiceAccountCredentials.from_service_account_file(str(path), scopes=DRIVE_SCOPES)
            except Exception as e:
                logger.error("Failed to load credentials from file %s: %s", path, e)
                raise RuntimeError(f"Could not load Google Service Account from file: {e}")
        else:
            raise RuntimeError(
                "Google Drive credentials not configured. "
                "Specify GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET or service account credentials in .env."
            )

        return build("drive", "v3", credentials=creds, cache_discovery=False)

    def verify_connectivity(self) -> Dict[str, Any]:
        """
        Verifies authentication and access to the configured Google Drive root folder.
        Never claims connectivity unless an active API request succeeds.
        """
        if not self.is_configured:
            if self.is_oauth_credentials_configured:
                return {
                    "configured": True,
                    "connected": False,
                    "oauth_authorized": False,
                    "authorized_email": None,
                    "root_folder_id": self.root_folder_id,
                    "message": "Google Drive OAuth 2.0 authorization required. Visit Admin Console to connect.",
                    "detail": None,
                }
            return {
                "configured": False,
                "connected": False,
                "oauth_authorized": False,
                "authorized_email": self.authorized_email,
                "root_folder_id": self.root_folder_id,
                "message": "Google Drive integration is not configured. Service account credentials, OAuth client credentials, or folder ID missing.",
                "detail": None,
            }

        try:
            folder = (
                self.service.files()
                .get(fileId=self.root_folder_id, fields="id, name, mimeType, trashed")
                .execute()
            )
            if folder.get("trashed", False):
                return {
                    "configured": True,
                    "connected": False,
                    "oauth_authorized": self.is_oauth_configured,
                    "authorized_email": self.authorized_email,
                    "root_folder_id": self.root_folder_id,
                    "message": "Configured Google Drive root folder is in trash.",
                    "detail": "Folder trashed = True",
                }

            return {
                "configured": True,
                "connected": True,
                "oauth_authorized": self.is_oauth_configured,
                "authorized_email": self.authorized_email,
                "root_folder_id": folder.get("id"),
                "folder_name": folder.get("name"),
                "message": "Google Drive API connectivity and root folder verified successfully.",
                "detail": None,
            }
        except HttpError as he:
            # Under drive.file scope, an externally created folder cannot be fetched directly
            # with files().get() (Google returns 404). However, the folder is accessible for
            # child file/folder creation and queries if it exists and is accessible.
            # We verify parent accessibility via files().list() with parent filter.
            if he.resp.status == 404 and self.is_oauth_configured and self.root_folder_id:
                try:
                    safe_id = self.root_folder_id.replace("'", "\\'")
                    self.service.files().list(
                        q=f"'{safe_id}' in parents and trashed = false",
                        spaces="drive",
                        fields="files(id, name)",
                        pageSize=1,
                    ).execute()
                    return {
                        "configured": True,
                        "connected": True,
                        "oauth_authorized": True,
                        "authorized_email": self.authorized_email,
                        "root_folder_id": self.root_folder_id,
                        "folder_name": "Google Drive Evidence Root (drive.file scope)",
                        "message": "Google Drive API connectivity and root folder verified successfully.",
                        "detail": None,
                    }
                except HttpError as parent_he:
                    logger.warning("Drive root folder verification failed: %s", parent_he)
                    if parent_he.resp.status == 404:
                        msg = "Configured Google Drive folder ID was not found or is not accessible. Verify GOOGLE_DRIVE_FOLDER_ID in backend/.env."
                    elif parent_he.resp.status == 403:
                        msg = "Permission denied for configured Google Drive folder. Ensure the authorized account has Editor access."
                    else:
                        msg = f"Google Drive root folder check failed (HTTP {parent_he.resp.status})."
                    return {
                        "configured": True,
                        "connected": False,
                        "oauth_authorized": True,
                        "authorized_email": self.authorized_email,
                        "root_folder_id": self.root_folder_id,
                        "message": msg,
                        "detail": str(parent_he),
                    }

            logger.warning("Google Drive API connectivity check failed: %s", he)
            if he.resp.status == 404:
                msg = "Google Drive folder not found (HTTP 404). Check the folder ID configured in backend/.env."
            elif he.resp.status == 403:
                msg = "Google Drive API access denied (HTTP 403). Ensure the Google Drive API is enabled in Google Cloud Console."
            else:
                msg = f"Google Drive API error (HTTP {he.resp.status})."
            return {
                "configured": True,
                "connected": False,
                "oauth_authorized": self.is_oauth_configured,
                "authorized_email": self.authorized_email,
                "root_folder_id": self.root_folder_id,
                "message": msg,
                "detail": str(he),
            }
        except Exception as e:
            logger.warning("Google Drive connectivity check failed with unexpected error: %s", e)
            err_lower = str(e).lower()
            if "invalid_client" in err_lower or "client was not found" in err_lower:
                msg = "Google OAuth client configuration is invalid or missing. Please re-authorize Google Drive from the Admin Console."
            elif "invalid_grant" in err_lower or "expired or revoked" in err_lower:
                msg = "Google OAuth authorization expired or was revoked. Please re-authorize Google Drive from the Admin Console."
            elif "quota" in err_lower:
                msg = "Google Drive API quota limit reached. Please check Google Cloud Console quotas."
            else:
                msg = f"Google Drive connection error: {e}"

            return {
                "configured": True,
                "connected": False,
                "oauth_authorized": self.is_oauth_configured,
                "authorized_email": self.authorized_email,
                "root_folder_id": self.root_folder_id,
                "message": msg,
                "detail": str(e),
            }

    @staticmethod
    def validate_file(
        filename: str,
        content: bytes,
        content_type: Optional[str] = None,
    ) -> Tuple[str, str, int]:
        """
        Validates file attributes:
        - Filename sanitization and length check
        - Extension against ALLOWED_UPLOAD_EXTENSIONS
        - Size against MAX_UPLOAD_SIZE_MB
        - MIME type against ALLOWED_UPLOAD_MIME_TYPES
        - Extension / MIME type consistency
        
        Returns: (sanitized_filename, validated_mime_type, size_bytes)
        """
        if not filename or not filename.strip():
            raise ValueError("Filename cannot be empty.")

        # 1. Sanitize filename (remove path traversal, null bytes, control chars)
        raw_name = Path(filename).name
        clean_name = re.sub(r'[\x00-\x1f\x7f/\\]', '', raw_name).strip()
        if not clean_name or clean_name in (".", ".."):
            raise ValueError("Invalid filename.")
        if len(clean_name) > 255:
            raise ValueError("Filename exceeds maximum allowed length of 255 characters.")

        # 2. Check extension
        ext = Path(clean_name).suffix.lower()
        if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
            allowed = ", ".join(settings.ALLOWED_UPLOAD_EXTENSIONS)
            raise ValueError(f"File extension '{ext}' is not allowed. Supported formats: {allowed}")

        # 3. Check file size
        size_bytes = len(content)
        if size_bytes == 0:
            raise ValueError("Uploaded file is empty (0 bytes).")
        if size_bytes > settings.max_upload_size_bytes:
            raise ValueError(
                f"File size ({size_bytes / (1024 * 1024):.2f} MB) exceeds maximum allowed limit "
                f"of {settings.MAX_UPLOAD_SIZE_MB} MB."
            )

        # 4. Normalize and validate MIME type
        norm_mime = (content_type or "").split(";")[0].strip().lower()
        if not norm_mime or norm_mime == "application/octet-stream":
            # Infer from extension
            ext_map = {
                ".pdf": "application/pdf",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
            }
            norm_mime = ext_map.get(ext, norm_mime)

        if norm_mime not in settings.ALLOWED_UPLOAD_MIME_TYPES:
            allowed_mimes = ", ".join(settings.ALLOWED_UPLOAD_MIME_TYPES)
            raise ValueError(f"MIME type '{norm_mime}' is not supported. Allowed types: {allowed_mimes}")

        # 5. Check extension / MIME type cross-consistency
        expected_mime_map = {
            ".pdf": ["application/pdf"],
            ".png": ["image/png"],
            ".jpg": ["image/jpeg"],
            ".jpeg": ["image/jpeg"],
        }
        valid_mimes = expected_mime_map.get(ext, [])
        if norm_mime not in valid_mimes:
            raise ValueError(
                f"File extension '{ext}' does not match declared MIME type '{norm_mime}'."
            )

        # 6. Validate binary file content signature
        if ext == ".pdf":
            # PDF documents must start with %PDF- within the first 1024 bytes
            if not (content.startswith(b"%PDF-") or b"%PDF-" in content[:1024]):
                raise ValueError("Invalid PDF file: Missing '%PDF-' header signature.")
        elif ext == ".png":
            if not content.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("Invalid PNG image: Corrupted or invalid file header signature.")
        elif ext in (".jpg", ".jpeg"):
            if not content.startswith(b"\xff\xd8"):
                raise ValueError("Invalid JPEG image: Corrupted or invalid file header signature.")

        return clean_name, norm_mime, size_bytes

    def get_or_create_folder(self, folder_name: str, parent_id: str) -> str:
        """
        Locates an existing folder with `folder_name` under `parent_id`,
        or creates a private subfolder if it does not exist.
        """
        # Escape single quotes in folder name for Drive query
        safe_name = folder_name.replace("'", "\\'")
        query = (
            f"mimeType = 'application/vnd.google-apps.folder' and "
            f"name = '{safe_name}' and "
            f"'{parent_id}' in parents and "
            f"trashed = false"
        )

        response = (
            self.service.files()
            .list(q=query, spaces="drive", fields="files(id, name)")
            .execute()
        )
        existing_folders = response.get("files", [])
        if existing_folders:
            return existing_folders[0]["id"]

        # Create private folder
        file_metadata = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        }
        created = (
            self.service.files()
            .create(body=file_metadata, fields="id, name")
            .execute()
        )
        return created["id"]

    def list_folders_in_parent(self, parent_id: str) -> List[Dict[str, Any]]:
        """
        Lists all child folders inside `parent_id` (supporting pagination).
        Returns a list of dicts: [{"id": folder_id, "name": folder_name}].
        """
        safe_parent = parent_id.replace("'", "\\'")
        query = (
            f"mimeType = 'application/vnd.google-apps.folder' and "
            f"'{safe_parent}' in parents and "
            f"trashed = false"
        )
        folders: List[Dict[str, Any]] = []
        page_token = None
        while True:
            res = (
                self.service.files()
                .list(
                    q=query,
                    spaces="drive",
                    fields="nextPageToken, files(id, name)",
                    pageSize=100,
                    pageToken=page_token,
                )
                .execute()
            )
            folders.extend(res.get("files", []))
            page_token = res.get("nextPageToken")
            if not page_token:
                break
        return folders

    def folder_exists(self, folder_id: str) -> bool:
        """
        Verifies whether a folder with `folder_id` exists, is not trashed,
        and is a folder.
        """
        try:
            res = (
                self.service.files()
                .get(fileId=folder_id, fields="id, name, mimeType, trashed")
                .execute()
            )
            return (
                res.get("mimeType") == "application/vnd.google-apps.folder"
                and not res.get("trashed", False)
            )
        except Exception:
            return False


    def ensure_achievement_folder(self, student_id: uuid.UUID, achievement_id: uuid.UUID) -> str:
        """
        Resolves or creates the opaque folder hierarchy in Google Drive:
        root_folder / student_{student_id} / achievement_{achievement_id}
        
        Mandate: Contains OPAQUE identifiers only (no student names or roll numbers).
        """
        if not self.root_folder_id:
            raise ValueError("Root folder ID (GOOGLE_DRIVE_FOLDER_ID) is not configured.")

        # Level 1: Opaque student directory
        student_folder_name = f"student_{student_id}"
        student_folder_id = self.get_or_create_folder(student_folder_name, self.root_folder_id)

        # Level 2: Opaque achievement directory
        achievement_folder_name = f"achievement_{achievement_id}"
        achievement_folder_id = self.get_or_create_folder(achievement_folder_name, student_folder_id)

        return achievement_folder_id

    def upload_file(
        self,
        content: bytes,
        filename: str,
        mime_type: str,
        folder_id: str,
        opaque_prefix: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Uploads a binary file to Google Drive under `folder_id` using an opaque filename.
        Guarantees that files remain PRIVATE with no public permissions.
        """
        prefix = opaque_prefix or uuid.uuid4().hex[:12]
        safe_drive_name = f"{prefix}_{filename}"

        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=False)
        body = {
            "name": safe_drive_name,
            "parents": [folder_id],
        }

        created = (
            self.service.files()
            .create(body=body, media_body=media, fields="id, name, mimeType, size, createdTime")
            .execute()
        )

        return {
            "drive_file_id": created["id"],
            "drive_folder_id": folder_id,
            "drive_filename": created.get("name", safe_drive_name),
            "size_bytes": int(created.get("size", len(content))),
            "mime_type": created.get("mimeType", mime_type),
        }

    def get_file_metadata(self, drive_file_id: str) -> Dict[str, Any]:
        """
        Fetches metadata for a file in Google Drive.
        """
        return (
            self.service.files()
            .get(fileId=drive_file_id, fields="id, name, mimeType, size, createdTime, modifiedTime")
            .execute()
        )

    def download_file(self, drive_file_id: str) -> Tuple[bytes, Dict[str, Any]]:
        """
        Downloads file binary stream from Google Drive into memory.
        Returns: (content_bytes, metadata)
        """
        metadata = self.get_file_metadata(drive_file_id)
        request = self.service.files().get_media(fileId=drive_file_id)

        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()

        fh.seek(0)
        return fh.read(), metadata

    def delete_file(self, drive_file_id: str) -> bool:
        """
        Deletes a file permanently from Google Drive.
        """
        try:
            self.service.files().delete(fileId=drive_file_id).execute()
            return True
        except HttpError as e:
            if e.resp.status == 404:
                # File already deleted or does not exist
                return True
            logger.error("Failed to delete Google Drive file %s: %s", drive_file_id, e)
            raise


# Global singleton instance and test injection tracker
_drive_service_instance: Optional[GoogleDriveService] = None
_is_injected_instance: bool = False


def load_persisted_oauth_credentials() -> Optional[Dict[str, str]]:
    """
    Attempts to read stored Google Drive OAuth credentials from PostgreSQL oauth_credentials table
    or local token file.
    """
    try:
        from sqlalchemy import select
        from app.core.oauth_crypto import decrypt_token
        from app.db.session import SessionLocal
        from app.models.oauth import OAuthCredential

        db = SessionLocal()
        try:
            record = db.scalars(
                select(OAuthCredential).where(OAuthCredential.provider == "google_drive")
            ).first()
            if record:
                token = decrypt_token(record.encrypted_refresh_token)
                return {
                    "client_id": record.client_id,
                    "refresh_token": token,
                    "authorized_email": record.authorized_email,
                }
        finally:
            db.close()
    except Exception as exc:
        logger.debug("Could not query oauth_credentials table: %s", exc)

    # Fallback to local token backup file if specified and present
    token_file = settings.GOOGLE_OAUTH_TOKEN_FILE
    if token_file and Path(token_file).is_file():
        try:
            with open(token_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {
                    "client_id": data.get("client_id", settings.GOOGLE_OAUTH_CLIENT_ID),
                    "refresh_token": data.get("refresh_token"),
                    "authorized_email": data.get("authorized_email"),
                }
        except Exception as e:
            logger.warning("Could not read GOOGLE_OAUTH_TOKEN_FILE: %s", e)

    return None


_drive_service_instance: Optional[GoogleDriveService] = None
_is_injected_instance: bool = False


def get_drive_service(reload: bool = False) -> GoogleDriveService:
    """
    Returns the GoogleDriveService singleton, dynamically loading persisted
    OAuth 2.0 user credentials if available, when requested via reload=True,
    or when the current singleton lacks active tokens and was not explicitly injected.
    """
    global _drive_service_instance, _is_injected_instance
    if _is_injected_instance:
        return _drive_service_instance

    if reload or _drive_service_instance is None or not _drive_service_instance.refresh_token:
        creds_data = load_persisted_oauth_credentials()
        if creds_data and creds_data.get("refresh_token"):
            _drive_service_instance = GoogleDriveService(
                oauth_client_id=creds_data.get("client_id") or settings.GOOGLE_OAUTH_CLIENT_ID,
                oauth_client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
                refresh_token=creds_data["refresh_token"],
                root_folder_id=settings.GOOGLE_DRIVE_FOLDER_ID,
                authorized_email=creds_data.get("authorized_email"),
            )
            _is_injected_instance = False
        elif _drive_service_instance is None:
            _drive_service_instance = GoogleDriveService()
            _is_injected_instance = False
    return _drive_service_instance


def set_drive_service(service: Optional[GoogleDriveService]) -> None:
    """
    Sets or resets the GoogleDriveService singleton (primarily for tests and dependency injection).
    """
    global _drive_service_instance, _is_injected_instance
    _drive_service_instance = service
    _is_injected_instance = service is not None
