import logging
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import StudentProfile, User

logger = logging.getLogger(__name__)


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> Optional[User]:
    """
    Look up user by normalized email or student register number and verify password using Argon2id.
    Logs safe diagnostic failure categories without exposing passwords, hashes, or personal data.
    Returns None if user is not found or password does not match.
    """
    normalized_identifier = (email or "").strip().lower()
    if not normalized_identifier:
        logger.warning("Auth diagnostic: FailureCategory=EMPTY_IDENTIFIER")
        return None

    safe_domain = normalized_identifier.split("@")[-1] if "@" in normalized_identifier else "local_id"

    # Step 1: Look up by normalized email
    stmt = select(User).where(func.lower(User.email) == normalized_identifier)
    user = db.scalars(stmt).first()

    # Step 2: Fallback lookup by register number for students if identifier has no @
    if user is None and "@" not in normalized_identifier:
        stmt_reg = (
            select(User)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .where(func.lower(StudentProfile.register_number) == normalized_identifier)
        )
        user = db.scalars(stmt_reg).first()

    if user is None:
        logger.warning(
            "Auth diagnostic: FailureCategory=USER_NOT_FOUND domain=@%s has_at_sign=%s",
            safe_domain,
            "@" in normalized_identifier,
        )
        return None

    # Step 3: Password hash presence & validation
    if not user.password_hash:
        logger.warning(
            "Auth diagnostic: FailureCategory=EMPTY_PASSWORD_HASH user_id=%s role=%s",
            user.id,
            user.role.value,
        )
        return None

    if user.password_hash == "FIREBASE_MANAGED_ACCOUNT":
        logger.warning(
            "Auth diagnostic: FailureCategory=FIREBASE_ONLY_ACCOUNT user_id=%s role=%s",
            user.id,
            user.role.value,
        )
        return None

    # Step 4: Verify password
    if not verify_password(password, user.password_hash):
        logger.warning(
            "Auth diagnostic: FailureCategory=PASSWORD_MISMATCH user_id=%s role=%s must_change_password=%s",
            user.id,
            user.role.value,
            user.must_change_password,
        )
        return None

    # Step 5: Check account status
    if not user.is_active:
        logger.warning(
            "Auth diagnostic: FailureCategory=ACCOUNT_INACTIVE user_id=%s role=%s",
            user.id,
            user.role.value,
        )
        return user

    logger.info(
        "Auth diagnostic: FailureCategory=SUCCESS user_id=%s role=%s must_change_password=%s",
        user.id,
        user.role.value,
        user.must_change_password,
    )
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
