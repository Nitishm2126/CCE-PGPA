import base64
import hashlib
import json
import secrets
import time
import uuid
from typing import Any, Dict

from cryptography.fernet import Fernet
import jwt

from app.core.config import settings


def _get_fernet() -> Fernet:
    """
    Derives a consistent 32-byte URL-safe base64 key from configured secret
    and returns a Fernet cipher instance.
    """
    secret = settings.OAUTH_ENCRYPTION_KEY or settings.JWT_SECRET_KEY
    hashed = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(hashed)
    return Fernet(key)


def encrypt_token(token: str) -> str:
    """
    Encrypts a sensitive plaintext OAuth token (e.g. refresh_token) for database storage.
    """
    if not token:
        raise ValueError("Cannot encrypt empty token.")
    f = _get_fernet()
    return f.encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted_token: str) -> str:
    """
    Decrypts an encrypted OAuth token from database storage.
    """
    if not encrypted_token:
        raise ValueError("Cannot decrypt empty token string.")
    f = _get_fernet()
    return f.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")


def generate_oauth_state(user_id: uuid.UUID, action: str = "google_drive_oauth") -> str:
    """
    Generates a cryptographically signed CSRF state token valid for 15 minutes.
    Binds the state to the initiating administrator user ID and action.
    """
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "action": action,
        "nonce": secrets.token_hex(16),
        "iat": now,
        "exp": now + 900,  # 15 minutes
    }
    secret = settings.JWT_SECRET_KEY
    return jwt.encode(payload, secret, algorithm="HS256")


def verify_oauth_state(state: str, expected_action: str = "google_drive_oauth") -> Dict[str, Any]:
    """
    Validates a returned OAuth state token against CSRF attacks.
    Raises ValueError on expired, tampered, or invalid tokens.
    """
    if not state or not state.strip():
        raise ValueError("Missing OAuth state parameter.")

    try:
        secret = settings.JWT_SECRET_KEY
        payload = jwt.decode(state.strip(), secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ValueError("OAuth state token has expired. Please initiate authorization again.")
    except jwt.PyJWTError as e:
        raise ValueError(f"Invalid OAuth state parameter (CSRF validation failed): {e}")

    if payload.get("action") != expected_action:
        raise ValueError("OAuth state action mismatch.")

    return payload
