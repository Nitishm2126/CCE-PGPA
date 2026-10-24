import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from app.core.config import settings, BACKEND_DIR

logger = logging.getLogger(__name__)

_firebase_app: Optional[firebase_admin.App] = None


def _parse_service_account_dict(raw: str) -> Optional[Dict[str, Any]]:
    """Parse a service account from raw JSON or Base64 encoded JSON without logging secrets."""
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip()
    if cleaned.startswith("{") and cleaned.endswith("}"):
        try:
            return json.loads(cleaned)
        except Exception as e:
            logger.error("Failed to parse inline service account JSON: %s", type(e).__name__)
            return None
    # Try base64 decoding
    try:
        import base64
        decoded = base64.b64decode(cleaned).decode("utf-8")
        if decoded.strip().startswith("{"):
            return json.loads(decoded)
    except Exception:
        pass
    return None


def _find_service_account_file(configured_path: str) -> Optional[Path]:
    """Look for service account file across configured path, backend dir, and Render secret mounts."""
    if not configured_path or not configured_path.strip():
        return None
    raw = configured_path.strip()
    if raw.startswith("{"):
        return None

    candidate_paths = [
        Path(raw),
        BACKEND_DIR / raw,
        Path("/etc/secrets") / Path(raw).name,
        Path("/etc/secrets/cce-pgpa-firebase-adminsdk-fbsvc-f18c12c357.json"),
        Path("/etc/secrets/firebase-service-account.json"),
        Path("/etc/secrets/cce-pgpa-firebase-adminsdk.json"),
    ]
    for p in candidate_paths:
        try:
            if p.is_file():
                return p
        except Exception:
            continue
    return None


def get_firebase_app() -> firebase_admin.App:
    """
    Initializes and returns the singleton Firebase Admin App instance.
    Supports:
    1. Render environment variable FIREBASE_SERVICE_ACCOUNT_JSON (raw or base64)
    2. FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable
    3. Service account JSON file path (configured, relative to backend, or /etc/secrets/)
    4. Render secret file default mounts in /etc/secrets/
    5. Application Default Credentials (ADC) or GOOGLE_APPLICATION_CREDENTIALS
    Never exposes, logs, or prints private keys or sensitive credentials.
    """
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    # Check if a default app was already initialized by external test runners or plugins
    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except ValueError:
        pass

    cred = None
    app_options: Dict[str, Any] = {}

    if settings.FIREBASE_PROJECT_ID:
        app_options["projectId"] = settings.FIREBASE_PROJECT_ID

    # 1. Inline Service Account JSON string or Base64 via FIREBASE_SERVICE_ACCOUNT_JSON
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        sa_dict = _parse_service_account_dict(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
        if sa_dict:
            try:
                cred = credentials.Certificate(sa_dict)
            except Exception as e:
                logger.error("Failed to load credentials from FIREBASE_SERVICE_ACCOUNT_JSON: %s", type(e).__name__)

    # 2. Check FIREBASE_SERVICE_ACCOUNT_BASE64 env var
    if cred is None and os.environ.get("FIREBASE_SERVICE_ACCOUNT_BASE64"):
        sa_dict = _parse_service_account_dict(os.environ["FIREBASE_SERVICE_ACCOUNT_BASE64"])
        if sa_dict:
            try:
                cred = credentials.Certificate(sa_dict)
            except Exception as e:
                logger.error("Failed to load credentials from FIREBASE_SERVICE_ACCOUNT_BASE64: %s", type(e).__name__)

    # 3. Service Account file path (configured path or Render /etc/secrets/)
    if cred is None and settings.FIREBASE_SERVICE_ACCOUNT_FILE:
        raw_val = settings.FIREBASE_SERVICE_ACCOUNT_FILE.strip()
        sa_dict = _parse_service_account_dict(raw_val)
        if sa_dict:
            try:
                cred = credentials.Certificate(sa_dict)
            except Exception as e:
                logger.error("Failed to load credentials from JSON in FIREBASE_SERVICE_ACCOUNT_FILE: %s", type(e).__name__)
        else:
            file_path = _find_service_account_file(raw_val)
            if file_path:
                try:
                    cred = credentials.Certificate(str(file_path))
                except Exception as e:
                    logger.error("Failed to load credentials from file %s: %s", file_path.name, type(e).__name__)
            else:
                logger.warning(
                    "FIREBASE_SERVICE_ACCOUNT_FILE was configured but file does not exist at specified path."
                )

    # 4. Check Render Secret File defaults in /etc/secrets/
    if cred is None:
        default_render_files = [
            Path("/etc/secrets/cce-pgpa-firebase-adminsdk-fbsvc-f18c12c357.json"),
            Path("/etc/secrets/firebase-service-account.json"),
            Path("/etc/secrets/cce-pgpa-firebase-adminsdk.json"),
        ]
        for p in default_render_files:
            try:
                if p.is_file():
                    cred = credentials.Certificate(str(p))
                    break
            except Exception:
                continue

    # 5. Application Default Credentials (ADC) or GOOGLE_APPLICATION_CREDENTIALS env var
    if cred is None and os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        try:
            cred = credentials.ApplicationDefault()
        except Exception as e:
            logger.warning("Could not initialize Application Default Credentials: %s", type(e).__name__)

    # Initialize Firebase Admin app
    if cred is not None:
        _firebase_app = firebase_admin.initialize_app(cred, app_options if app_options else None)
    else:
        # Default initialization (e.g. Google Cloud Run / compute environment with metadata service)
        _firebase_app = firebase_admin.initialize_app(options=app_options if app_options else None)

    return _firebase_app


def verify_firebase_id_token(token: str, check_revoked: bool = False) -> Dict[str, Any]:
    """
    Cryptographically verifies a Firebase ID token using the Firebase Admin SDK.
    Returns the decoded token payload dictionary containing 'uid', 'email', etc.

    Raises HTTPException(401) on invalid or expired token.
    Raises HTTPException(503) on service/network unavailability when fetching public certificates.
    Never prints or exposes raw tokens or private keys.
    """
    try:
        app = get_firebase_app()
        decoded_token = firebase_auth.verify_id_token(
            token,
            app=app,
            check_revoked=check_revoked,
        )
        return decoded_token
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has expired. Please authenticate again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has been revoked. Please authenticate again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (firebase_auth.InvalidIdTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.CertificateFetchError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable. Failed to fetch signing certificates.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate Firebase credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
