from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

# Initialize Argon2id password hasher via pwdlib recommended algorithm
password_hasher = PasswordHash.recommended()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against an Argon2id password hash.
    """
    try:
        return password_hasher.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Generate an Argon2id hash of a plaintext password.
    """
    return password_hasher.hash(password)


def create_access_token(
    subject: Union[str, Any],
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate a signed JSON Web Token (JWT) with user subject and role claims.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "role": str(role),
        "iat": now,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT access token.
    Raises jwt.ExpiredSignatureError if expired, or jwt.PyJWTError if invalid.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


# In-memory revocation cache for active sessions / tokens
_revoked_tokens: set[str] = set()


def revoke_token(token: str) -> None:
    """Mark a token as revoked on the server."""
    if token:
        _revoked_tokens.add(token.strip())


def is_token_revoked(token: str) -> bool:
    """Check whether a token has been revoked."""
    if not token:
        return True
    return token.strip() in _revoked_tokens

