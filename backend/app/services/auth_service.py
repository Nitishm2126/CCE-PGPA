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
