import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from app.core.config import settings

logger = logging.getLogger(__name__)

_firebase_app: Optional[firebase_admin.App] = None


def get_firebase_app() -> firebase_admin.App:
    """
    Initializes and returns the singleton Firebase Admin App instance.
    Supports Service Account JSON file path, inline JSON string, or Application Default Credentials (ADC).
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

    # 1. Service Account JSON file path
    if settings.FIREBASE_SERVICE_ACCOUNT_FILE:
        file_path = Path(settings.FIREBASE_SERVICE_ACCOUNT_FILE)
        if file_path.is_file():
            cred = credentials.Certificate(str(file_path))
        else:
            logger.warning(
                "FIREBASE_SERVICE_ACCOUNT_FILE was configured but file does not exist at specified path."
            )

    # 2. Inline Service Account JSON string
    elif settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            cred_dict = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(cred_dict)
        except Exception:
            logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Invalid JSON structure.")

    # 3. Application Default Credentials (ADC) or GOOGLE_APPLICATION_CREDENTIALS env var
    elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
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
