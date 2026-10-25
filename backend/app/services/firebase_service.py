import logging
from typing import Optional
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.core.firebase import get_firebase_app

logger = logging.getLogger(__name__)


def is_firebase_available() -> bool:
    """Check if Firebase Admin SDK app is initialized and reachable."""
    try:
        app = get_firebase_app()
        return app is not None
    except Exception as e:
        logger.debug("Firebase Admin SDK is not available: %s", e)
        return False


def get_firebase_user_by_email(email: str) -> Optional[firebase_auth.UserRecord]:
    """Retrieve existing Firebase user record by email, or None if not found."""
    try:
        app = get_firebase_app()
        return firebase_auth.get_user_by_email(email.strip().lower(), app=app)
    except firebase_auth.UserNotFoundError:
        return None
    except Exception as exc:
        logger.warning("Could not lookup Firebase user by email %s: %s", email, exc)
        return None


def sync_create_firebase_user(
    email: str,
    full_name: str,
    password: Optional[str] = None,
    disabled: bool = False,
) -> Optional[str]:
    """
    Creates or maps a Firebase user for the given email and name.
    If a Firebase account already exists for the email, returns its UID.
    Never exposes or logs plain text passwords.
    """
    try:
        app = get_firebase_app()
        clean_email = email.strip().lower()

        # Check existing first to avoid duplicate email errors
        try:
            existing = firebase_auth.get_user_by_email(clean_email, app=app)
            if existing:
                # Update display name or disabled status if needed
                kwargs = {}
                if full_name and existing.display_name != full_name:
                    kwargs["display_name"] = full_name
                if existing.disabled != disabled:
                    kwargs["disabled"] = disabled
                if kwargs:
                    firebase_auth.update_user(existing.uid, app=app, **kwargs)
                return existing.uid
        except firebase_auth.UserNotFoundError:
            pass

        # Create new Firebase user
        create_kwargs = {
            "email": clean_email,
            "display_name": full_name,
            "disabled": disabled,
            "email_verified": False,
        }
        if password:
            create_kwargs["password"] = password

        user_record = firebase_auth.create_user(app=app, **create_kwargs)
        logger.info("Created Firebase user account for %s (uid=%s)", clean_email, user_record.uid)
        return user_record.uid
    except Exception as exc:
        logger.warning("Firebase user creation skipped or failed for %s: %s", email, exc)
        return None


def sync_update_firebase_user(
    uid: Optional[str],
    email: Optional[str] = None,
    full_name: Optional[str] = None,
    disabled: Optional[bool] = None,
    password: Optional[str] = None,
) -> bool:
    """
    Updates user attributes in Firebase Auth if UID is provided.
    Returns True if update succeeded, False otherwise.
    Never logs or exposes plaintext password values.
    """
    if not uid:
        return False

    try:
        app = get_firebase_app()
        update_kwargs = {}
        if email is not None:
            update_kwargs["email"] = email.strip().lower()
        if full_name is not None:
            update_kwargs["display_name"] = full_name
        if disabled is not None:
            update_kwargs["disabled"] = disabled
        if password is not None:
            update_kwargs["password"] = password

        if not update_kwargs:
            return True

        firebase_auth.update_user(uid, app=app, **update_kwargs)
        logger.info("Updated Firebase user account %s: %s", uid, list(update_kwargs.keys()))
        return True
    except firebase_auth.UserNotFoundError:
        logger.warning("Firebase user %s not found during update; skipping.", uid)
        return False
    except Exception as exc:
        logger.warning("Failed to update Firebase user %s: %s", uid, exc)
        return False


def sync_set_firebase_disabled(uid: Optional[str], disabled: bool) -> bool:
    """Enables or disables a Firebase Auth account."""
    if not uid:
        return False
    return sync_update_firebase_user(uid, disabled=disabled)


def sync_delete_firebase_user(uid: Optional[str]) -> bool:
    """
    Deletes a user account from Firebase Auth.
    Tolerates UserNotFoundError gracefully (already deleted).
    """
    if not uid:
        return True

    try:
        app = get_firebase_app()
        firebase_auth.delete_user(uid, app=app)
        logger.info("Deleted Firebase user account %s", uid)
        return True
    except firebase_auth.UserNotFoundError:
        logger.info("Firebase user %s was already absent in Firebase Auth.", uid)
        return True
    except Exception as exc:
        logger.error("Failed to delete Firebase user %s: %s", uid, exc)
        return False
