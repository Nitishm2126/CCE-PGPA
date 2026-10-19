from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import User


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> Optional[User]:
    """
    Look up user by normalized email and verify password using Argon2id.
    Returns None if user is not found or password does not match.
    """
    normalized_email = email.strip().lower()
    stmt = select(User).where(func.lower(User.email) == normalized_email)
    user = db.scalars(stmt).first()

    if user is None:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def get_or_link_user_by_firebase_token(
    db: Session,
    token_claims: dict,
) -> Optional[User]:
    """
    Resolves a verified Firebase ID token payload to an existing PostgreSQL User.
    1. Looks up user by matched `firebase_uid`.
    2. If not yet linked, matches pre-provisioned user by normalized email and binds `firebase_uid`.
    3. Returns None if no pre-provisioned user matches (public signup is disabled).
    Roles are always derived strictly from PostgreSQL.
    """
    uid = token_claims.get("uid")
    if not uid:
        return None

    # Step 1: Look up by mapped Firebase UID
    stmt = select(User).where(User.firebase_uid == uid)
    user = db.scalars(stmt).first()
    if user is not None:
        return user

    # Step 2: Fallback linking by verified email for pre-provisioned users
    email = token_claims.get("email")
    if email:
        normalized_email = email.strip().lower()
        stmt = select(User).where(func.lower(User.email) == normalized_email)
        user = db.scalars(stmt).first()
        if user is not None:
            # Bind the verified Firebase UID to the existing PostgreSQL record
            user.firebase_uid = uid
            db.add(user)
            db.commit()
            db.refresh(user)
            return user

    return None
