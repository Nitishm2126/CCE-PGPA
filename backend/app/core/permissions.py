import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.firebase import verify_firebase_id_token
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole
from app.services.auth_service import get_or_link_user_by_firebase_token

# Reusable HTTP Bearer authentication scheme
http_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates the Bearer token (Firebase ID token or legacy JWT) and retrieves
    the active PostgreSQL user.
    - Resolves Firebase UID or pre-provisioned email to PostgreSQL User.
    - Derives all roles strictly from PostgreSQL, never from client claims.
    - If Firebase token verification fails, fails immediately (no silent fallback).
    - Enforces active account restrictions.
    - Strictly validates Bearer tokens in the Authorization header; tokens in URL query
      parameters are never accepted.
    """
    token = ""
    if credentials and credentials.credentials:
        token = credentials.credentials.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Bearer token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Determine token type by inspecting unverified header
    is_firebase_token = False
    try:
        unverified_header = jwt.get_unverified_header(token)
        # Firebase ID tokens use RS256 algorithm and include key ID (kid)
        if unverified_header.get("alg") == "RS256":
            is_firebase_token = True
    except Exception:
        is_firebase_token = False

    # Path A: Firebase ID token verification
    if is_firebase_token:
        # Note: Any verification error raises HTTPException directly.
        # It must NOT silently fall back to legacy authentication.
        claims = verify_firebase_id_token(token)

        user = get_or_link_user_by_firebase_token(db, claims)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found. Registration is restricted to pre-provisioned members.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user account. Please contact an administrator.",
            )

        return user

    # Path B: Legacy HS256 JWT access token verification (transition / backward compatibility)
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired. Please authenticate again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials. Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_raw = payload.get("sub")
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing subject identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(str(user_id_raw))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject format.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account. Please contact an administrator.",
        )

    return user


def require_role(*allowed_roles: UserRole):
    """
    FastAPI dependency factory to enforce role-based access control.
    Verifies that the authenticated user possesses one of the allowed roles.
    """
    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            expected = ", ".join(role.value for role in allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: operation requires one of [{expected}] role(s).",
            )
        return current_user

    return role_dependency


# Role-specific shortcut dependencies
require_admin = require_role(UserRole.ADMIN)
require_student = require_role(UserRole.STUDENT)
require_mentor = require_role(UserRole.MENTOR, UserRole.HOD)
require_hod = require_role(UserRole.HOD)
