
import io
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import Resource, build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

from app.core.config import settings

logger = logging.getLogger(__name__)

# Scopes: least privilege for managing drive files created/used by this app
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]


class GoogleDriveService:
    """
    Modular Google Drive API client for CCE Achieve.
    
    ARCHITECTURAL MANDATES:
    1. Google Drive is the ONLY permanent storage location for uploaded evidence binaries.
    2. Folders and Drive files use OPAQUE identifiers to prevent leaking student PII.
    3. Files are strictly PRIVATE to the configured service account / shared drive folder.
       Public permissions and open portfolio links are NEVER created.
    """

    def __init__(
        self,
        service: Optional[Resource] = None,
        service_account_file: Optional[str] = None,
        service_account_json: Optional[str] = None,
        root_folder_id: Optional[str] = None,
    ):
        self._service: Optional[Resource] = service
        self.service_account_file = service_account_file or settings.GOOGLE_SERVICE_ACCOUNT_FILE
        self.service_account_json = service_account_json or settings.GOOGLE_SERVICE_ACCOUNT_JSON
        self.root_folder_id = root_folder_id or settings.GOOGLE_DRIVE_FOLDER_ID

    @property
    def is_configured(self) -> bool:
        """
        Returns True if credentials and root folder ID are specified.
        """
        if self._service is not None:
            return bool(self.root_folder_id)
        has_creds = bool(self.service_account_file or self.service_account_json)
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
        Initializes Google Drive API v3 client using official Google service account credentials.
        """
        if self.service_account_json:
            try:
                info = json.loads(self.service_account_json)
                creds = Credentials.from_service_account_info(info, scopes=DRIVE_SCOPES)
            except Exception as e:
                logger.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: %s", e)
                raise RuntimeError(f"Invalid Google Service Account JSON configuration: {e}")
        elif self.service_account_file:
            path = Path(self.service_account_file)
            if not path.is_file():
                logger.error("Service account file not found at: %s", path)
                raise FileNotFoundError(f"Google Service Account file not found: {path}")
            try:
                creds = Credentials.from_service_account_file(str(path), scopes=DRIVE_SCOPES)
            except Exception as e:
                logger.error("Failed to load credentials from file %s: %s", path, e)
                raise RuntimeError(f"Could not load Google Service Account from file: {e}")
        else:
            raise RuntimeError(
                "Google Drive service credentials not configured. "
                "Specify GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON in .env."
            )

        return build("drive", "v3", credentials=creds, cache_discovery=False)

    def verify_connectivity(self) -> Dict[str, Any]:
        """
        Verifies authentication and access to the configured Google Drive root folder.
        Never claims connectivity unless an active API request succeeds.
        """
        if not self.is_configured:
            return {
                "configured": False,
                "connected": False,
                "root_folder_id": self.root_folder_id,
                "message": "Google Drive integration is not configured. Service account credentials or folder ID missing.",
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
                    "root_folder_id": self.root_folder_id,
                    "message": "Configured Google Drive root folder is in trash.",
                    "detail": "Folder trashed = True",
                }

            return {
                "configured": True,
                "connected": True,
                "root_folder_id": folder.get("id"),
                "folder_name": folder.get("name"),
                "message": "Google Drive API connectivity and root folder verified successfully.",
                "detail": None,
            }
        except HttpError as he:
            logger.warning("Google Drive API connectivity check failed: %s", he)
            return {
                "configured": True,
                "connected": False,
                "root_folder_id": self.root_folder_id,
                "message": f"Google Drive API error: {he.resp.status}",
                "detail": str(he),
            }
        except Exception as e:
            logger.warning("Google Drive connectivity check failed with unexpected error: %s", e)
            return {
                "configured": True,
                "connected": False,
                "root_folder_id": self.root_folder_id,
                "message": "Failed to connect to Google Drive API.",
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


# Global singleton instance
_drive_service_instance: Optional[GoogleDriveService] = None


def get_drive_service() -> GoogleDriveService:
    """
    Returns the GoogleDriveService singleton.
    """
    global _drive_service_instance
    if _drive_service_instance is None:
        _drive_service_instance = GoogleDriveService()
    return _drive_service_instance


def set_drive_service(service: Optional[GoogleDriveService]) -> None:
    """
    Sets or resets the GoogleDriveService singleton (primarily for tests and dependency injection).
    """
    global _drive_service_instance
    _drive_service_instance = service

