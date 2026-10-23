import html
import logging
import urllib.parse
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.oauth_crypto import (
    decrypt_token,
    encrypt_token,
    generate_oauth_state,
    verify_oauth_state,
)
from app.core.permissions import get_current_user, require_admin
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.firebase import get_firebase_app
from firebase_admin import auth as fb_auth
from app.db.session import get_db
from app.models.oauth import OAuthCredential
from app.models.user import User, UserRole
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import authenticate_user
from app.services.drive_service import GoogleDriveService, set_drive_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain JWT access token",
    description=(
        "Authenticates a user via email and password using Argon2id verification. "
        "Returns a signed JWT bearer token with role claims. Returns a generic 401 on "
        "failure to avoid revealing whether an account exists."
    ),
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = authenticate_user(db, email=login_data.email, password=login_data.password)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact an administrator.",
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        role=user.role,
    )


def get_user_accessible_portals(user: User) -> List[str]:
    """Derive list of portal keys the authenticated user is authorized to access."""
    if user.role == UserRole.HOD:
        return ["hod", "mentor"]
    return [user.role.value]


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user account",
    description="Returns identity and role metadata for the currently authenticated user. Never exposes password hashes.",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    res = UserResponse.model_validate(current_user)
    res.accessible_portals = get_user_accessible_portals(current_user)
    return res


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Client token invalidation guidance",
    description="Guidance for client-side token discard and session termination.",
)
def logout(
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    return MessageResponse(
        message="Successfully logged out. Please discard the access token on the client application."
    )


@router.post(
    "/change-password",
    response_model=UserResponse,
    summary="Change user password and clear must_change_password flag",
    description="Updates password in Firebase Auth and PostgreSQL password hash, clearing the initial password change requirement.",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters.",
        )

    # If current_password is provided and user has a password hash, verify it
    if payload.current_password and current_user.password_hash:
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password verification failed.",
            )

    # 1. Update in Firebase Auth if account is linked
    if current_user.firebase_uid:
        try:
            app = get_firebase_app()
            if app:
                fb_auth.update_user(current_user.firebase_uid, password=payload.new_password, app=app)
        except Exception as exc:
            logger.warning("Failed to update Firebase password for user %s: %s", current_user.email, exc)

    # 2. Update Argon2id password hash in PostgreSQL
    current_user.password_hash = get_password_hash(payload.new_password)
    current_user.must_change_password = False
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return UserResponse.model_validate(current_user)


# ==============================================================================
# Google Drive OAuth 2.0 Web Server Flow (Personal Gmail Accounts)
# ==============================================================================

@router.get(
    "/google/authorize",
    summary="Initiate Google Drive OAuth 2.0 Authorization Flow",
    description=(
        "Restricted to authorized administrators. Generates a signed CSRF state token "
        "and returns Google's OAuth 2.0 authorization URL for offline access to Google Drive."
    ),
)
def google_authorize(
    redirect: bool = False,
    current_user: User = Depends(require_admin),
):
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Google OAuth credentials are not configured. "
                "Please configure GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in backend/.env."
            ),
        )

    # 1. Generate cryptographically signed CSRF state
    state = generate_oauth_state(current_user.id, action="google_drive_oauth")

    # 2. Build Google OAuth 2.0 consent URL
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(settings.GOOGLE_OAUTH_SCOPES),
        "access_type": "offline",
        "prompt": "consent select_account",
        "state": state,
        "include_granted_scopes": "true",
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    if redirect:
        return RedirectResponse(url=auth_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    return {
        "authorization_url": auth_url,
        "state": state,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "scopes": settings.GOOGLE_OAUTH_SCOPES,
        "instruction": "Open the authorization_url in a browser as the administrator to authorize Google Drive access.",
    }


def _render_oauth_error_html(detail: str, action_hint: str) -> str:
    escaped_detail = html.escape(detail)
    escaped_hint = html.escape(action_hint)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Drive Authorization Failed - CCE Achieve</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f8fafc;
            color: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 1.5rem;
            box-sizing: border-box;
        }}
        .card {{
            background: white;
            border: 1px solid #fecaca;
            border-radius: 1rem;
            padding: 2.5rem;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 10px 25px -5px rgba(239,68,68,0.1);
            text-align: center;
        }}
        .icon {{
            width: 52px;
            height: 52px;
            background: #fef2f2;
            color: #dc2626;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.25rem;
        }}
        h1 {{
            font-size: 1.35rem;
            font-weight: 700;
            margin: 0 0 0.5rem;
            color: #991b1b;
        }}
        p {{
            color: #475569;
            font-size: 0.925rem;
            line-height: 1.5;
            margin: 0 0 1.25rem;
        }}
        .hint-box {{
            background: #fef2f2;
            border: 1px solid #fee2e2;
            border-radius: 0.75rem;
            padding: 1rem;
            margin-bottom: 1.75rem;
            text-align: left;
            font-size: 0.825rem;
            color: #7f1d1d;
            line-height: 1.45;
        }}
        .btn {{
            display: inline-block;
            background: #0f172a;
            color: white;
            padding: 0.75rem 1.75rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 600;
            text-decoration: none;
            transition: background 0.15s ease;
        }}
        .btn:hover {{
            background: #1e293b;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </div>
        <h1>Authorization Failed</h1>
        <p>{escaped_detail}</p>
        <div class="hint-box"><strong>Recommended Action:</strong> {escaped_hint}</div>
        <a href="http://localhost:3000/admin" class="btn">Return to Admin Console</a>
    </div>
</body>
</html>"""


def _handle_oauth_callback_error(request: Request, status_code: int, detail: str, action_hint: str):
    accept = request.headers.get("accept", "")
    if "text/html" in accept and "application/json" not in accept:
        return HTMLResponse(
            content=_render_oauth_error_html(detail, action_hint),
            status_code=status_code,
        )
    raise HTTPException(status_code=status_code, detail=detail)


@router.get(
    "/google/callback",
    summary="Google Drive OAuth 2.0 Authorization Callback Handler",
    description=(
        "Handles Google's redirect containing the authorization code and state token. "
        "Verifies CSRF state, exchanges code for access & refresh tokens, securely persists "
        "encrypted refresh token in PostgreSQL, and activates the Drive service."
    ),
)
def google_callback(
    request: Request,
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    # 1. Handle error response from Google (e.g. user denied consent)
    if error:
        return _handle_oauth_callback_error(
            request=request,
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth authorization was declined: {error} - {error_description or 'No detail provided.'}",
            action_hint="Please return to the Admin Console, click 'Connect Google Drive', and grant consent on Google's prompt.",
        )

    # 2. Validate CSRF state token
    if not state:
        return _handle_oauth_callback_error(
            request=request,
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth state parameter.",
            action_hint="Direct access to the callback endpoint is prohibited. Please initiate authorization from the Admin Console.",
        )

    try:
        state_data = verify_oauth_state(state, expected_action="google_drive_oauth")
    except ValueError as ve:
        return _handle_oauth_callback_error(
            request=request,
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth state verification failed: {ve}",
            action_hint="The state token may have expired (15-minute window) or was altered. Please re-initiate authorization from the Admin Console.",
        )

    # 3. Validate authorization code
    if not code:
        return _handle_oauth_callback_error(
            request=request,
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing authorization code from Google.",
            action_hint="Google did not return an authorization code. Please return to the Admin Console and retry.",
        )

    # 4. Exchange code for access & refresh tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_payload = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            token_resp = client.post(token_url, data=token_payload)
    except Exception as e:
        return _handle_oauth_callback_error(
            request=request,
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Network error communicating with Google token endpoint: {e}",
            action_hint="Check backend internet connectivity to Google OAuth servers, then re-initiate authorization.",
        )

    if token_resp.status_code != 200:
        logger.error("Google token exchange failed: %s %s", token_resp.status_code, token_resp.text)
        return _handle_oauth_callback_error(
            request=request,
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to exchange authorization code with Google token endpoint. Please re-initiate authorization.",
            action_hint="Authorization codes expire quickly and can only be exchanged once. Please initiate a new connection flow from the Admin Console.",
        )

    token_data = token_resp.json()
    refresh_token = token_data.get("refresh_token")

    # 5. Enforce offline access requirement: refresh_token MUST be returned or pre-existing
    encrypted_token: Optional[str] = None
    if not refresh_token:
        stmt_existing = select(OAuthCredential).where(OAuthCredential.provider == "google_drive")
        existing_record = db.scalars(stmt_existing).first()
        if existing_record and existing_record.encrypted_refresh_token:
            logger.info("Google re-consent did not return a new refresh token; preserving existing persisted token.")
            refresh_token = decrypt_token(existing_record.encrypted_refresh_token)
            encrypted_token = existing_record.encrypted_refresh_token
        else:
            return _handle_oauth_callback_error(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Google did not return a refresh token. "
                    "If this Google account previously granted access, please visit "
                    "https://myaccount.google.com/connections to remove 'CCE Achieve' and re-connect."
                ),
                action_hint="Visit https://myaccount.google.com/connections, disconnect access, then re-connect from the Admin Console.",
            )
    else:
        # 6. Encrypt sensitive refresh token for persistence
        encrypted_token = encrypt_token(refresh_token)

    admin_id = uuid.UUID(state_data["sub"])
    admin_user = db.get(User, admin_id)

    # Query the authenticated Google account email via Drive about.get()
    google_account_email: Optional[str] = None
    try:
        temp_drive_service = GoogleDriveService(
            oauth_client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
            oauth_client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
            refresh_token=refresh_token,
            root_folder_id=settings.GOOGLE_DRIVE_FOLDER_ID,
        )
        about_info = temp_drive_service.service.about().get(fields="user(emailAddress,displayName)").execute()
        google_account_email = about_info.get("user", {}).get("emailAddress")
    except Exception as exc:
        logger.warning("Could not fetch Google account email from Drive API about.get(): %s", exc)

    # Use the verified Google Account email as the primary authorized identity
    authorized_email = google_account_email or (admin_user.email if admin_user else None)

    # 7. Persist encrypted credentials in PostgreSQL oauth_credentials table
    stmt = select(OAuthCredential).where(OAuthCredential.provider == "google_drive")
    cred_record = db.scalars(stmt).first()
    if not cred_record:
        cred_record = OAuthCredential(
            id=uuid.uuid4(),
            provider="google_drive",
            client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
            encrypted_refresh_token=encrypted_token,
            scopes=" ".join(settings.GOOGLE_OAUTH_SCOPES),
            authorized_by=admin_id,
            authorized_email=authorized_email,
        )
        db.add(cred_record)
    else:
        cred_record.client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        cred_record.encrypted_refresh_token = encrypted_token
        cred_record.scopes = " ".join(settings.GOOGLE_OAUTH_SCOPES)
        cred_record.authorized_by = admin_id
        cred_record.authorized_email = authorized_email

    db.commit()

    # 8. Activate the GoogleDriveService singleton with the new user credentials
    new_drive_service = GoogleDriveService(
        oauth_client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
        oauth_client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
        refresh_token=refresh_token,
        root_folder_id=settings.GOOGLE_DRIVE_FOLDER_ID,
        authorized_email=authorized_email,
    )
    set_drive_service(new_drive_service)

    # 9. Return safe confirmation without leaking tokens
    admin_label = admin_user.email if admin_user else str(admin_id)
    account_info_html = (
        f'<div class="account-badge">Google Account: {html.escape(authorized_email)}</div>'
        f'<div style="font-size: 0.75rem; color: #64748b; margin-top: 6px;">Authorized by: {html.escape(admin_label)}</div>'
        if authorized_email
        else ""
    )

    success_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Drive Authorized - CCE Achieve</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f8fafc;
            color: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 1.5rem;
            box-sizing: border-box;
        }}
        .card {{
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 1rem;
            padding: 2.5rem;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
            text-align: center;
        }}
        .icon {{
            width: 52px;
            height: 52px;
            background: #ecfdf5;
            color: #059669;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.25rem;
        }}
        h1 {{
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0 0 0.5rem;
            color: #0f172a;
        }}
        p {{
            color: #64748b;
            font-size: 0.925rem;
            line-height: 1.5;
            margin: 0 0 1.25rem;
        }}
        .account-badge {{
            display: inline-block;
            background: #f1f5f9;
            padding: 0.4rem 0.85rem;
            border-radius: 9999px;
            font-size: 0.825rem;
            font-weight: 500;
            color: #334155;
            margin-bottom: 1.25rem;
        }}
        .meta-list {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            padding: 1rem;
            margin-bottom: 1.75rem;
            text-align: left;
            font-size: 0.825rem;
            color: #475569;
        }}
        .meta-item {{
            display: flex;
            justify-content: space-between;
            padding: 0.25rem 0;
        }}
        .meta-label {{
            font-weight: 600;
            color: #334155;
        }}
        .btn {{
            display: inline-block;
            background: #0f172a;
            color: white;
            padding: 0.75rem 1.75rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 600;
            text-decoration: none;
            transition: background 0.15s ease;
        }}
        .btn:hover {{
            background: #1e293b;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h1>Google Drive Connected</h1>
        <p>Your Google Drive account has been authorized successfully for CCE Achieve evidence storage. Offline access has been secured.</p>
        {account_info_html}
        <div class="meta-list">
            <div class="meta-item"><span class="meta-label">Scope:</span><span>drive.file (Application Private)</span></div>
            <div class="meta-item"><span class="meta-label">Storage:</span><span>Binary Evidence Files</span></div>
            <div class="meta-item"><span class="meta-label">Credential:</span><span>Encrypted at rest (PostgreSQL)</span></div>
        </div>
        <a href="http://localhost:3000/admin" class="btn">Return to Admin Console</a>
    </div>
</body>
</html>"""

    return HTMLResponse(
        content=success_html,
        status_code=status.HTTP_200_OK,
    )
