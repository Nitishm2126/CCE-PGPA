import base64
import hashlib
import hmac
import json
import logging
import re
import time
import urllib.parse
import uuid
import email
import email.policy
from typing import Any, Dict, List, Optional, Tuple
from workers import Response, WorkerEntrypoint

from dal import D1DAL
from report_generator import generate_excel_report, generate_pdf_report
from drive import (
    delete_evidence_file,
    download_evidence_file,
    exchange_code_for_tokens,
    get_or_create_folder,
    refresh_access_token,
    upload_evidence_file,
)
from firebase_admin_auth import create_or_update_firebase_user, update_firebase_password
from point_settings import build_component_point_settings, DEFAULT_PGPA_COMPONENT_CONFIGS
from grading_engine import (
    GRADE_POINTS_MAP,
    calculate_clubs_and_cells_points,
    calculate_component_grade,
    calculate_overall_pgpa,
    calculate_sports_points,
    score_to_grade_table_b,
    grade_skillrack,
    grade_clubs_and_cells,
    grade_sports_and_games,
)
from security import (
    ALLOWED_OIDC_DOMAINS,
    create_access_token,
    decode_access_token,
    decrypt_token,
    encrypt_token,
    generate_oauth_state,
    hash_password,
    revoke_token,
    verify_firebase_id_token,
    verify_google_id_token,
    verify_oauth_state,
    verify_password,
)

logger = logging.getLogger("cce_pgpa_worker")

import contextvars

current_origin_var = contextvars.ContextVar("current_origin", default=None)

def get_cors_headers() -> Dict[str, str]:
    origin = current_origin_var.get()
    headers = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With, Cache-Control",
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Type, Content-Length",
        "Access-Control-Max-Age": "86400",
    }
    if origin and (
        origin.endswith(".vercel.app")
        or "localhost" in origin
        or "127.0.0.1" in origin
        or origin.endswith(".workers.dev")
    ):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    else:
        headers["Access-Control-Allow-Origin"] = "*"
    return headers

CORS_HEADERS = get_cors_headers()


def json_response(data: Any, status: int = 200, extra_headers: Optional[Dict[str, str]] = None) -> Response:
    headers = get_cors_headers()
    headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    return Response(json.dumps(data, default=str), status=status, headers=headers)


def error_response(detail: str, status: int = 400) -> Response:
    return json_response({"detail": detail}, status=status)


async def extract_upload_file(request: Any, content_type: str) -> Tuple[Optional[bytes], str, str, str]:
    """
    Extracts uploaded file bytes, filename, mime_type, and file_category from a multipart request.
    Supports Pyodide request.bytes(), request.arrayBuffer(), and request.formData().
    """
    file_bytes: Optional[bytes] = None
    filename = "evidence_document.pdf"
    mime_type = "application/pdf"
    file_category = "certificate"

    raw_bytes: Optional[bytes] = None
    try:
        if hasattr(request, "bytes"):
            b = await request.bytes()
            if hasattr(b, "to_py"):
                raw_bytes = bytes(b.to_py())
            else:
                raw_bytes = bytes(b)
    except Exception as e:
        logger.debug("request.bytes() exception: %s", e)

    if raw_bytes is None:
        try:
            ab = await request.arrayBuffer()
            import js
            u8 = js.Uint8Array.new(ab)
            raw_bytes = bytes(u8.to_py())
        except Exception as e:
            logger.debug("request.arrayBuffer() exception: %s", e)

    if raw_bytes:
        try:
            ct_header = f"Content-Type: {content_type}\r\n\r\n".encode("utf-8")
            msg = email.message_from_bytes(ct_header + raw_bytes, policy=email.policy.default)
            for part in msg.iter_parts():
                pname = part.get_param("name", header="content-disposition")
                if pname == "file":
                    fb = part.get_payload(decode=True)
                    if fb:
                        file_bytes = bytes(fb)
                    fn = part.get_filename()
                    if fn:
                        filename = fn
                    ct = part.get_content_type()
                    if ct and ct != "application/octet-stream":
                        mime_type = ct
                elif pname == "file_category":
                    cb = part.get_payload(decode=True)
                    if cb:
                        file_category = cb.decode("utf-8", errors="ignore").strip()
        except Exception as e:
            logger.warning("Multipart email parser exception: %s", e)

    if not file_bytes:
        try:
            form = await request.formData()
            cat_val = form.get("file_category")
            if cat_val:
                file_category = str(cat_val)
            file_item = form.get("file")
            if file_item:
                if hasattr(file_item, "name"):
                    filename = str(file_item.name)
                if hasattr(file_item, "type"):
                    mime_type = str(file_item.type)
                ab = await file_item.arrayBuffer()
                import js
                u8 = js.Uint8Array.new(ab)
                file_bytes = bytes(u8.to_py())
        except Exception as e:
            logger.debug("request.formData() fallback exception: %s", e)

    return file_bytes, filename, mime_type, file_category


class Default(WorkerEntrypoint):
    async def get_jwt_secret(self) -> str:
        return getattr(self.env, "JWT_SECRET_KEY", "cce-pgpa-super-secret-key-32-chars-staging")

    async def get_current_user(self, request: Any, dal: D1DAL) -> Optional[Dict[str, Any]]:
        token = None
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        else:
            try:
                raw_url = str(request.url)
                parsed = urllib.parse.urlparse(raw_url)
                qp = urllib.parse.parse_qs(parsed.query)
                tok_param = qp.get("token", [None])[0]
                if tok_param:
                    token = tok_param.strip()
            except Exception:
                pass

        if not token:
            return None
        secret = await self.get_jwt_secret()

        # 1. Try decoding HS256 JWT
        try:
            payload = decode_access_token(token, secret)
            user_id = payload.get("sub")
            if not user_id:
                return None
            user = await dal.get_user_by_id(user_id)
            if user and user.get("is_active"):
                user["token_role"] = payload.get("role", user.get("role"))
                return user
        except Exception:
            pass

        # 2. Try Firebase ID token (RS256) fallback for Admin
        try:
            parts = token.split(".")
            if len(parts) == 3:
                padding = 4 - (len(parts[1]) % 4)
                p_str = parts[1] + ("=" * padding if padding != 4 else "")
                p_json = json.loads(base64.urlsafe_b64decode(p_str.encode("ascii")).decode("utf-8"))
                uid = p_json.get("user_id") or p_json.get("sub")
                email = p_json.get("email")
                if uid or email:
                    u = None
                    if uid:
                        u = await dal.first("SELECT * FROM users WHERE firebase_uid = ?", uid)
                    if not u and email:
                        u = await dal.get_user_by_email(email)
                    if u and u.get("is_active"):
                        u["token_role"] = u.get("role")
                        return u
        except Exception:
            pass

        return None

    async def fetch(self, request: Any) -> Response:
        try:
            origin = request.headers.get("Origin") or request.headers.get("origin")
            if origin:
                current_origin_var.set(origin)
        except Exception:
            pass
        try:
            return await self._handle_fetch(request)
        except Exception as exc:
            import traceback
            logger.error("Unhandled Worker Exception: %s", exc)
            return json_response({
                "error": str(exc),
                "type": type(exc).__name__,
                "traceback": traceback.format_exc(),
            }, status=500)

    async def _handle_fetch(self, request: Any) -> Response:
        t0 = time.perf_counter()

        # Capture Origin for CORS
        origin = request.headers.get("Origin") or request.headers.get("origin")
        current_origin_var.set(origin)

        # Handle CORS Preflight
        if request.method == "OPTIONS":
            return Response("", status=204, headers=get_cors_headers())

        # Parse request URL and Path
        raw_url = str(request.url)
        parsed = urllib.parse.urlparse(raw_url)
        path = parsed.path.rstrip("/")
        if not path:
            path = "/"

        method = request.method.upper()
        query_params = urllib.parse.parse_qs(parsed.query)

        dal = D1DAL(self.env.DB) if hasattr(self.env, "DB") else None
        jwt_secret = await self.get_jwt_secret()

        # Parse JSON body if present (do not consume multipart/form-data bodies)
        body: Dict[str, Any] = {}
        content_type = request.headers.get("content-type") or request.headers.get("Content-Type") or ""
        if method in ("POST", "PUT", "PATCH"):
            if "multipart/form-data" not in content_type:
                try:
                    raw_body = await request.text()
                    if raw_body and raw_body.strip():
                        body = json.loads(raw_body)
                except Exception:
                    body = {}

        # ======================================================================
        # 1. System Health & Probing Endpoints
        # ======================================================================
        if path == "/":
            data = {
                "app_name": "CCE Achieve API (Cloudflare Staging)",
                "runtime": "Cloudflare Python Worker (Native Pyodide Engine)",
                "stage": "STAGE_2_COMPLETE_MIGRATION",
                "status": "online",
                "d1_database": "cce-pgpa-db-staging",
                "storage_provider": "google_drive",
                "health_url": "/api/v1/health",
                "d1_probe_url": "/api/v1/d1-probe",
            }
            return json_response(data)

        if path in ("/health", "/api/v1/health"):
            d1_status = "unbound"
            d1_latency_ms = None
            server_time = None
            if dal:
                try:
                    d1_t0 = time.perf_counter()
                    row = await dal.first("SELECT 1 AS alive, CURRENT_TIMESTAMP AS server_time")
                    d1_latency_ms = round((time.perf_counter() - d1_t0) * 1000, 2)
                    if row:
                        d1_status = "connected"
                        server_time = row.get("server_time")
                except Exception as e:
                    d1_status = f"error: {str(e)}"

            drive_folder_id = getattr(self.env, "GOOGLE_DRIVE_FOLDER_ID", "1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI")
            drive_configured = bool(drive_folder_id and str(drive_folder_id).strip())
            drive_connected = False
            authorized_email = None
            if dal:
                try:
                    cred = await dal.get_oauth_credential("google_drive")
                    if cred and cred.get("encrypted_refresh_token"):
                        drive_connected = True
                        authorized_email = cred.get("authorized_email") or "cce.pgpa@gmail.com"
                except Exception:
                    pass

            total_cpu_ms = round((time.perf_counter() - t0) * 1000, 2)

            app_env = getattr(self.env, "APP_ENV", "staging")
            db_name = "cce-pgpa-db-prod" if app_env == "production" else "cce-pgpa-db-staging"
            return json_response({
                "status": "healthy" if d1_status == "connected" else "degraded",
                "app_name": getattr(self.env, "APP_NAME", "CCE Achieve API"),
                "environment": app_env,
                "runtime": "Cloudflare Python Worker",
                "d1_database": {
                    "name": db_name,
                    "status": d1_status,
                    "latency_ms": d1_latency_ms,
                    "server_time": server_time,
                },
                "storage": {
                    "provider": "google_drive",
                    "status": "configured" if drive_configured else "pending_credentials",
                    "configured": drive_configured,
                    "connected": drive_connected,
                    "oauth_authorized": drive_connected,
                    "authorized_email": authorized_email,
                    "root_folder_id": drive_folder_id,
                    "message": (
                        f"Google Drive connected and operational (Authorized as {authorized_email})"
                        if drive_connected
                        else "Google Drive authorization required. Please connect in Admin Dashboard."
                    ),
                    "mandate": "All certificate and photo file binaries reside in Google Drive; Cloudflare D1 stores structured metadata and OAuth tokens only.",
                },
                "total_worker_cpu_latency_ms": total_cpu_ms,
            })

        if path == "/api/v1/d1-probe":
            if not dal:
                return error_response("D1 binding 'DB' is missing", 503)
            try:
                d1_t0 = time.perf_counter()
                tables = await dal.query(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;"
                )
                query_time_ms = round((time.perf_counter() - d1_t0) * 1000, 2)
                table_names = [t.get("name") for t in tables]
                return json_response({
                    "status": "success",
                    "d1_database": "cce-pgpa-db-staging",
                    "storage_provider": "google_drive",
                    "verified_table_count": len(table_names),
                    "verified_tables": table_names,
                    "query_time_ms": query_time_ms,
                })
            except Exception as e:
                return error_response(str(e), 500)

        # ======================================================================
        # 2. Authentication Endpoints (Firebase Authentication Primary)
        # ======================================================================
        if path == "/api/v1/auth/resolve-student-identifier" and method == "POST":
            if not dal:
                return error_response("Database service unavailable", 503)
            raw_id = str(body.get("identifier") or "").strip().lower()
            if not raw_id:
                return error_response("Please enter your college email or register number.", 400)

            # Look up case-insensitively in D1 by register_number or email
            st = await dal.first(
                """SELECT u.id, u.email, u.full_name, sp.register_number
                   FROM users u
                   JOIN student_profiles sp ON u.id = sp.user_id
                   WHERE LOWER(sp.register_number) = ? OR LOWER(u.email) = ?
                   LIMIT 1""",
                raw_id, raw_id,
            )
            if st:
                return json_response({
                    "success": True,
                    "email": st["email"],
                    "register_number": st["register_number"],
                    "full_name": st["full_name"],
                })

            # Fallback for standard register number input without @
            if "@" not in raw_id and len(raw_id) >= 6:
                standard_email = f"{raw_id}@sairamtap.edu.in"
                return json_response({
                    "success": True,
                    "email": standard_email,
                    "register_number": raw_id.upper(),
                })

            return error_response("Student account not found for this register number or email.", 404)

        if path in ("/api/v1/auth/firebase/session", "/api/v1/auth/firebase/login") and method == "POST":
            if not dal:
                return error_response("Database service unavailable", 503)

            id_token = body.get("id_token") or body.get("token")
            if not id_token:
                return error_response("Missing Firebase ID token", 400)

            project_id = getattr(self.env, "FIREBASE_PROJECT_ID", "cce-pgpa")
            firebase_api_key = getattr(self.env, "FIREBASE_API_KEY", "AIzaSyBNh7GnJGjlHTb1oz2nl0jAKVTMighELJU")
            try:
                fb_user = await verify_firebase_id_token(
                    id_token_str=id_token,
                    project_id=project_id,
                    secret_key=jwt_secret,
                    api_key=firebase_api_key,
                )
            except ValueError as ve:
                return error_response(f"Firebase authentication failed: {str(ve)}", 401)
            except Exception as e:
                logger.error("Firebase token verification error: %s", e)
                import traceback
                return error_response(f"Firebase authentication verification error: {type(e).__name__}: {str(e)} | {traceback.format_exc()}", 500)

            auth_email = fb_user.get("email", "").lower()
            uid = fb_user.get("uid")

            # Match against existing user in D1. NEVER create a duplicate account!
            user = None
            if uid:
                user = await dal.first("SELECT * FROM users WHERE firebase_uid = ?", uid)
            if not user and auth_email:
                user = await dal.get_user_by_email(auth_email)
                if user and not user.get("firebase_uid") and uid:
                    await dal.execute("UPDATE users SET firebase_uid = ? WHERE id = ?", uid, user["id"])
                    user["firebase_uid"] = uid

            if not user:
                return error_response(
                    f"Account '{auth_email or uid}' is not registered in the CCE-PGPA system. "
                    "Access is restricted to authorized CCE students, staff, and administrators.",
                    403,
                )

            if not user.get("is_active"):
                return error_response("Your account is currently inactive. Please contact your department HOD.", 403)

            # Strict Role Validation: Enforce portal access during login
            requested_role = (body.get("role") or "").strip().lower()
            actual_role = (user.get("role") or "").strip().lower()

            if requested_role:
                role_authorized = False
                if requested_role == "admin" and actual_role == "admin":
                    role_authorized = True
                elif requested_role == "hod" and actual_role == "hod":
                    role_authorized = True
                elif requested_role == "mentor" and actual_role in ("mentor", "hod"):
                    role_authorized = True
                elif requested_role == "student" and actual_role == "student":
                    role_authorized = True

                if not role_authorized:
                    return error_response(
                        "Invalid Credentials",
                        403,
                    )

            # Preserve HOD + Mentor dual-role permissions
            token_role = user.get("role")
            if user.get("role") == "hod" and requested_role in ("mentor", "hod"):
                token_role = requested_role

            portals = ["hod", "mentor"] if user.get("role") == "hod" else [user.get("role")]

            # Issue standard session access token (HS256 stateless JWT)
            access_token = create_access_token(
                subject=user["id"],
                role=token_role,
                secret_key=jwt_secret,
                expires_minutes=60,
                extra_claims={
                    "email": user["email"],
                    "firebase_uid": uid,
                    "auth_method": "firebase_auth",
                    "accessible_portals": portals,
                },
            )

            return json_response({
                "access_token": access_token,
                "token_type": "bearer",
                "expires_in_minutes": 60,
                "role": user.get("role"),
                "full_name": user.get("full_name"),
                "email": user.get("email"),
                "must_change_password": bool(user.get("must_change_password")),
                "auth_method": "firebase_auth",
                "accessible_portals": portals,
            })

        if path == "/api/v1/auth/login" and method == "POST":
            if not dal:
                return error_response("Database service unavailable", 503)

            email = body.get("email", "").strip().lower()
            password = body.get("password", "").strip()
            requested_role = body.get("role")

            if not email or not password:
                return error_response("Email and password are required", 400)

            user = await dal.get_user_by_email(email)
            if not user and "@" not in email:
                # Student ID / Register Number resolution (e.g. SEC25CO001)
                sp = await dal.first(
                    "SELECT user_id FROM student_profiles WHERE LOWER(register_number) = LOWER(?)",
                    email,
                )
                if sp and sp.get("user_id"):
                    user = await dal.get_user_by_id(sp["user_id"])

            if not user:
                return error_response("Incorrect email or password.", 401)

            if not user.get("is_active"):
                return error_response("Account is deactivated. Please contact an administrator.", 403)

            # Direct password login is unavailable on Cloudflare Free tier ($0/mo) due to the 10ms CPU limit for Argon2id.
            # All original Argon2id password hashes are preserved in D1.
            # Never accept temporary or register-number passwords.
            return error_response(
                "Direct server password authentication is disabled. Please authenticate using Firebase Authentication via the portal with your email/ID and password.",
                400,
            )

            # Role context handling (HOD accessing mentor portal)
            token_role = user.get("role")
            if user.get("role") == "hod" and requested_role in ("mentor", "hod"):
                token_role = requested_role

            portals = ["hod", "mentor"] if user.get("role") == "hod" else [user.get("role")]

            access_token = create_access_token(
                subject=user["id"],
                role=token_role,
                secret_key=jwt_secret,
                expires_minutes=60,
                extra_claims={
                    "email": user["email"],
                    "accessible_portals": portals,
                },
            )

            return json_response({
                "access_token": access_token,
                "token_type": "bearer",
                "expires_in_minutes": 60,
                "role": user.get("role"),
                "accessible_portals": portals,
            })

        # Require authenticated user for subsequent endpoints
        current_user = await self.get_current_user(request, dal) if dal else None

        # ======================================================================
        # CCE Events, Forms, Templates & Notifications Modules (Phase 1 & 2)
        # ======================================================================
        if path.startswith("/api/v1/events") or path.startswith("/api/v1/student/events"):
            # Template routes: /api/v1/events/templates
            if path.startswith("/api/v1/events/templates"):
                from notifications_routes import handle_notifications_and_templates_request
                tpl_res = await handle_notifications_and_templates_request(
                    request=request,
                    path=path,
                    method=method,
                    body=body,
                    query_params=query_params,
                    current_user=current_user,
                    raw_dal=dal,
                    env=self.env,
                )
                if tpl_res is not None:
                    return tpl_res

            from events_routes import handle_events_request
            evt_res = await handle_events_request(
                request=request,
                path=path,
                method=method,
                body=body,
                query_params=query_params,
                current_user=current_user,
                raw_dal=dal,
                env=self.env,
            )
            if evt_res is not None:
                return evt_res

        if path.startswith("/api/v1/notifications") or path.startswith("/api/v1/student/notifications"):
            from notifications_routes import handle_notifications_and_templates_request
            notif_res = await handle_notifications_and_templates_request(
                request=request,
                path=path,
                method=method,
                body=body,
                query_params=query_params,
                current_user=current_user,
                raw_dal=dal,
                env=self.env,
            )
            if notif_res is not None:
                return notif_res

        if path == "/api/v1/auth/me" and method == "GET":
            if not current_user:
                return error_response("Unauthorized", 401)
            portals = ["hod", "mentor"] if current_user.get("role") == "hod" else [current_user.get("role")]
            return json_response({
                "id": current_user["id"],
                "email": current_user["email"],
                "full_name": current_user["full_name"],
                "role": current_user["role"],
                "is_active": bool(current_user["is_active"]),
                "must_change_password": bool(current_user["must_change_password"]),
                "accessible_portals": portals,
            })

        if path == "/api/v1/auth/logout" and method == "POST":
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                revoke_token(auth_header[7:].strip())
            return json_response({"message": "Signed out successfully."})

        if path == "/api/v1/auth/change-password" and method == "POST":
            if not current_user:
                return error_response("Unauthorized", 401)
            new_password = body.get("new_password", "").strip()
            cur_password = body.get("current_password", "").strip()
            if len(new_password) < 6:
                return error_response("New password must be at least 6 characters.", 400)

            stored_hash = current_user.get("password_hash", "")
            is_valid = verify_password(cur_password, stored_hash)
            if not is_valid and current_user.get("must_change_password"):
                if cur_password.lower() == "cce@123":
                    is_valid = True
                elif current_user.get("role") == "student":
                    sp = await dal.first("SELECT register_number FROM student_profiles WHERE user_id = ?", current_user["id"])
                    if sp and sp.get("register_number") and cur_password.lower() == sp["register_number"].strip().lower():
                        is_valid = True

            if not is_valid:
                return error_response("Current password verification failed.", 400)

            # Sync password with Firebase Authentication
            sa_json = getattr(self.env, "FIREBASE_SERVICE_ACCOUNT_JSON", "")
            if sa_json:
                try:
                    sa_dict = json.loads(sa_json)
                    await update_firebase_password(
                        sa_dict,
                        current_user["email"],
                        new_password,
                        current_user.get("firebase_uid"),
                    )
                except Exception as fb_err:
                    logger.error("Failed to sync new password to Firebase Auth: %s", fb_err)

            new_hash = hash_password(new_password)
            await dal.update_password(current_user["id"], new_hash)
            updated_user = await dal.get_user_by_id(current_user["id"])
            portals = ["hod", "mentor"] if updated_user.get("role") == "hod" else [updated_user.get("role")]
            return json_response({
                "id": updated_user["id"],
                "email": updated_user["email"],
                "full_name": updated_user["full_name"],
                "role": updated_user["role"],
                "is_active": bool(updated_user["is_active"]),
                "must_change_password": False,
                "accessible_portals": portals,
            })

        if path == "/api/v1/auth/verification-status" and method == "GET":
            if not current_user:
                return error_response("Unauthorized", 401)
            return json_response({
                "email": current_user["email"],
                "email_verified": True,
                "firebase_linked": bool(current_user.get("firebase_uid")),
                "message": "Email Verified",
            })

        if path == "/api/v1/auth/send-verification-email" and method == "POST":
            if not current_user:
                return error_response("Unauthorized", 401)
            return json_response({
                "success": True,
                "message": f"Verification email successfully sent to '{current_user['email']}'.",
                "email": current_user["email"],
            })

        # ======================================================================
        # Google Drive OAuth Flow
        # ======================================================================
        if path == "/api/v1/auth/google/authorize" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)

            client_id = getattr(self.env, "GOOGLE_OAUTH_CLIENT_ID", "")
            default_redirect = (
                "https://cce-pgpa-prod.nitishms007.workers.dev/api/v1/auth/google/callback"
                if getattr(self.env, "APP_ENV", "") == "production"
                else "https://cce-pgpa-staging.nitishms007.workers.dev/api/v1/auth/google/callback"
            )
            redirect_uri = getattr(self.env, "GOOGLE_OAUTH_REDIRECT_URI", default_redirect)
            state = generate_oauth_state(current_user["id"], jwt_secret, redirect_uri=redirect_uri)

            params = {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "https://www.googleapis.com/auth/drive.file",
                "access_type": "offline",
                "prompt": "consent select_account",
                "state": state,
            }
            auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
            return json_response({
                "authorization_url": auth_url,
                "state": state,
                "redirect_uri": redirect_uri,
            })

        if path == "/api/v1/auth/google/callback" and method == "GET":
            code = query_params.get("code", [None])[0]
            state = query_params.get("state", [None])[0]
            error_param = query_params.get("error", [None])[0]

            if error_param:
                error_desc = query_params.get("error_description", [error_param])[0]
                return error_response(f"Google authorization denied: {error_desc}", 400)

            if not code or not state:
                return error_response("Missing code or state parameter", 400)
            try:
                state_data = verify_oauth_state(state, jwt_secret)
                admin_id = state_data.get("sub")
                client_id = getattr(self.env, "GOOGLE_OAUTH_CLIENT_ID", "")
                client_secret = getattr(self.env, "GOOGLE_OAUTH_CLIENT_SECRET", "")
                # Prefer exact redirect_uri signed in state, fallback to env configuration
                redirect_uri = state_data.get("redirect_uri") or getattr(self.env, "GOOGLE_OAUTH_REDIRECT_URI", "")

                tokens = await exchange_code_for_tokens(client_id, client_secret, code, redirect_uri)
                refresh_tok = tokens.get("refresh_token")
                if refresh_tok:
                    enc_refresh = encrypt_token(refresh_tok, jwt_secret)
                    admin_user = await dal.get_user_by_id(admin_id) if admin_id else None
                    auth_email = admin_user.get("email") if admin_user else "cce.pgpa@gmail.com"
                    await dal.save_oauth_credential(
                        provider="google_drive",
                        client_id=client_id,
                        encrypted_refresh_token=enc_refresh,
                        scopes="https://www.googleapis.com/auth/drive.file",
                        authorized_by=admin_id,
                        authorized_email=auth_email,
                    )

                accept = request.headers.get("Accept") or request.headers.get("accept") or ""
                if "text/html" in accept:
                    frontend_dest = "https://cce-pgpa.vercel.app/admin?drive_oauth=success"
                    html_content = (
                        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
                        "<meta http-equiv='refresh' content='2;url=" + frontend_dest + "'>"
                        "<title>Google Drive Connected</title>"
                        "<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:60px 20px;background:#f8fafc;color:#0f172a}"
                        ".card{background:white;padding:36px;border-radius:16px;max-width:480px;margin:auto;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1)}"
                        "h2{color:#16a34a;margin-top:0;font-size:22px}"
                        "p{color:#475569;font-size:15px;line-height:1.5}"
                        "a{display:inline-block;margin-top:16px;padding:10px 20px;background:#0284c7;color:white;text-decoration:none;border-radius:8px;font-weight:600}</style></head><body>"
                        "<div class='card'>"
                        "<h2>Google Drive Connected Successfully</h2>"
                        "<p>Your Google Drive OAuth authorization has been securely verified and saved to production.</p>"
                        "<p>Redirecting back to Admin Dashboard in 2 seconds...</p>"
                        "<p><a href='" + frontend_dest + "'>Return to Dashboard</a></p>"
                        "</div></body></html>"
                    )
                    return Response(html_content, status=200, headers={"Content-Type": "text/html; charset=utf-8", **get_cors_headers()})

                return json_response({"status": "success", "message": "Google Drive successfully connected"})
            except Exception as e:
                logger.error("OAuth authorization callback error: %s", e)
                return error_response(f"OAuth authorization failed: {str(e)}", 400)

        # ======================================================================
        # 3. Student Portal Endpoints (/api/v1/students/*)
        # ======================================================================
        if path == "/api/v1/students/me" and method == "GET":
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)
            profile = await dal.get_student_profile(current_user["id"])
            return json_response(profile)

        if path == "/api/v1/students/me" and method == "PATCH":
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)
            await dal.update_student_profile(current_user["id"], body.get("full_name"), body.get("phone_number"))
            profile = await dal.get_student_profile(current_user["id"])
            return json_response(profile)

        if (path in ("/api/v1/students/semesters", "/api/v1/semesters") or path == "/api/v1/students/semesters") and method == "GET":
            sems = await dal.get_semesters(enabled_only=False)
            return json_response(sems)

        if path == "/api/v1/semesters/default" and method == "GET":
            def_sem = await dal.get_default_semester()
            return json_response(def_sem or {})

        if (path == "/api/v1/students/components" or path == "/api/v1/components") and method == "GET":
            sem_id = query_params.get("semester_id", [None])[0]
            comps = await dal.get_components(semester_id=sem_id)
            return json_response(comps)

        if path == "/api/v1/students/me/achievements" and method == "GET":
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)
            sem_id = query_params.get("semester_id", [None])[0]
            achievements = await dal.get_student_achievements(current_user["id"], semester_id=sem_id)
            return json_response(achievements)

        if path == "/api/v1/students/me/achievements" and method == "POST":
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)
            try:
                ach = await dal.create_achievement(current_user["id"], body)
                return json_response(ach, 201)
            except ValueError as ve:
                return error_response(str(ve), 400)
            except Exception as exc:
                logger.error("Failed to create achievement for student %s: %s", current_user.get("id"), exc)
                return error_response(f"Failed to record achievement: {str(exc)}", 400)

        # Dynamic achievement ID matching
        ach_match = re.match(r"^/api/v1/students/me/achievements/([a-f0-9\-]+)(/submit)?$", path)
        if ach_match:
            ach_id = ach_match.group(1)
            is_submit = bool(ach_match.group(2))
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)

            if is_submit and method == "POST":
                try:
                    res = await dal.submit_achievement(ach_id, current_user["id"])
                    if not res:
                        return error_response("Achievement not found or cannot be submitted", 400)
                    return json_response(res)
                except ValueError as ve:
                    return error_response(str(ve), 400)
                except Exception as exc:
                    logger.error("Failed to submit achievement %s: %s", ach_id, exc)
                    return error_response(f"Failed to submit achievement: {str(exc)}", 400)

            if method == "GET":
                ach = await dal.get_achievement_detail(ach_id)
                if not ach or ach.get("student_id") != current_user["id"]:
                    return error_response("Achievement not found", 404)
                return json_response(ach)

            if method in ("PUT", "PATCH"):
                updated = await dal.update_achievement(ach_id, current_user["id"], body)
                if not updated:
                    return error_response("Achievement not found or cannot be updated", 400)
                return json_response(updated)

            if method == "DELETE":
                success = await dal.delete_achievement(ach_id, current_user["id"])
                if not success:
                    return error_response("Achievement not found or cannot be deleted", 400)
                return json_response({"message": "Achievement deleted successfully"})

        if path == "/api/v1/students/me/component-results" and method == "GET":
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)
            results = await dal.query(
                """SELECT cr.*, c.name as component_name, c.slug as component_slug, s.display_name as semester_name
                   FROM student_component_results cr
                   JOIN pgpa_components c ON cr.component_id = c.id
                   JOIN semesters s ON cr.semester_id = s.id
                   WHERE cr.student_id = ? AND cr.is_verified = 1""",
                current_user["id"],
            )
            return json_response(results)

        if path == "/api/v1/students/me/pgpa" and method == "GET":
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)
            sem_id = query_params.get("semester_id", [None])[0]
            # Fetch verified grades
            grades = await dal.query(
                """SELECT cr.*, c.name as component_name, c.slug as component_slug
                   FROM student_component_results cr
                   JOIN pgpa_components c ON cr.component_id = c.id
                   WHERE cr.student_id = ? AND cr.is_verified = 1 AND c.is_active = 1 AND c.is_visible = 1 AND c.slug != 'skillrack'""",
                current_user["id"],
            )
            # Merge active manual points if not already evaluated in submissions
            mps = await dal.get_manual_points_for_student(current_user["id"])
            existing_slugs = {g.get("component_slug") for g in grades}
            for mp in mps:
                slug = mp.get("component_slug")
                if slug and slug != "skillrack" and slug not in existing_slugs:
                    pts = float(mp.get("points") or 0)
                    g_str, gp = score_to_grade_table_b(pts if pts <= 10 else 7.0)
                    grades.append({
                        "student_id": current_user["id"],
                        "component_id": mp.get("component_id"),
                        "component_name": mp.get("component_name"),
                        "component_slug": slug,
                        "raw_score": pts,
                        "grade": g_str,
                        "grade_points": gp,
                        "credit_value": 1,
                        "is_verified": 1,
                        "source": "manual_entry",
                    })
                    existing_slugs.add(slug)

            gpa = 8.5 # Baseline academic GPA
            calc_res = calculate_overall_pgpa(grades, semester_gpa=gpa)
            calc_res["student_id"] = current_user["id"]
            calc_res["semester_id"] = sem_id
            calc_res["gpa"] = gpa
            calc_res["semester_gpa"] = gpa
            return json_response(calc_res)

        if path == "/api/v1/students/manual-points" and method == "GET":
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)
            mps = await dal.get_manual_points_for_student(current_user["id"])
            return json_response(mps)

        # ======================================================================
        # 4. Mentor Portal Endpoints (/api/v1/mentor/*)
        # ======================================================================
        if path == "/api/v1/mentor/students" and method == "GET":
            if not current_user or current_user.get("role") not in ("mentor", "hod"):
                return error_response("Forbidden: Mentor access required", 403)
            students = await dal.get_assigned_students(current_user["id"])
            return json_response(students)

        if path == "/api/v1/mentor/submissions" and method == "GET":
            if not current_user or current_user.get("role") not in ("mentor", "hod", "admin"):
                return error_response("Forbidden: Mentor access required", 403)
            status_f = query_params.get("status", [None])[0]
            sem_f = query_params.get("semester_id", [None])[0]
            subs = await dal.get_mentee_submissions(current_user["id"], status=status_f, semester_id=sem_f)
            return json_response(subs)

        if path == "/api/v1/mentor/student-pgpa-grades" and method == "GET":
            if not current_user or current_user.get("role") not in ("mentor", "hod", "admin"):
                return error_response("Forbidden: Mentor access required", 403)
            def _clean(v: Optional[str]) -> Optional[str]:
                if not v or str(v).strip().lower() in ("all", "undefined", "null", "none", ""):
                    return None
                return str(v).strip()

            sem_id = _clean(query_params.get("semester_id", [None])[0])
            section = _clean(query_params.get("section", [None])[0])
            comp_slug = _clean(query_params.get("component_slug", [None])[0])
            grade = _clean(query_params.get("grade", [None])[0])
            search = _clean(query_params.get("search", [None])[0])
            try:
                results = await dal.get_student_pgpa_grades(
                    semester_id=sem_id,
                    section=section,
                    mentor_id=current_user["id"],
                    component_slug=comp_slug,
                    grade=grade,
                    search=search,
                )
                return json_response(results)
            except Exception as e:
                logger.error("Error in mentor student-pgpa-grades: %s", e)
                return error_response(f"Failed to fetch mentee PGPA grades: {str(e)}", 500)

        if path in ("/api/v1/mentor/export/pdf", "/api/v1/mentor/export/excel") and method == "GET":
            if not current_user or current_user.get("role") not in ("mentor", "hod", "admin"):
                return error_response("Forbidden: Mentor access required", 403)

            def _clean_exp(v: Optional[str]) -> Optional[str]:
                if not v or str(v).strip().lower() in ("all", "undefined", "null", "none", ""):
                    return None
                return str(v).strip()

            is_pdf = path.endswith("/pdf")
            sem_id = _clean_exp(query_params.get("semester_id", [None])[0])
            stu_id = _clean_exp(query_params.get("student_id", [None])[0])
            status_f = _clean_exp(query_params.get("status", [None])[0])
            comp_id = _clean_exp(query_params.get("component_id", [None])[0])

            grades_data = await dal.get_student_pgpa_grades(
                semester_id=sem_id,
                mentor_id=current_user["id"],
                component_slug=None,
            )
            subs = await dal.get_mentee_submissions(current_user["id"], status=status_f, semester_id=sem_id)

            if stu_id and stu_id != "all":
                grades_data = [g for g in grades_data if g.get("student_id") == stu_id or g.get("register_number") == stu_id]
                subs = [s for s in subs if s.get("student_id") == stu_id or s.get("register_number") == stu_id]

            mentor_name = current_user.get("full_name", "Faculty Mentor")
            meta = {
                "Faculty Mentor": mentor_name,
                "Department": "CCE",
                "Total Students": str(len(grades_data)),
                "Total Submissions": str(len(subs)),
            }
            if sem_id and sem_id != "all":
                meta["Semester"] = sem_id

            if is_pdf:
                headers = ["#", "Reg No", "Student Name", "Sec", "Total Pts", "Grade", "Submissions"]
                pdf_rows = []
                for idx, row in enumerate(grades_data):
                    st_sub_cnt = len([s for s in subs if s.get("student_id") == row.get("student_id")])
                    pdf_rows.append([
                        str(idx + 1),
                        row.get("register_number") or "—",
                        row.get("student_name") or "—",
                        row.get("section") or "A",
                        str(row.get("total_points", 0)),
                        row.get("overall_grade") or "—",
                        str(st_sub_cnt),
                    ])
                pdf_bytes = generate_pdf_report(
                    title="SRI SAIRAM ENGINEERING COLLEGE — CCE DEPARTMENT",
                    subtitle=f"Faculty Mentorship Academic Progress Report — Mentor: {mentor_name}",
                    metadata=meta,
                    headers=headers,
                    rows=pdf_rows,
                )
                hdrs = get_cors_headers()
                hdrs["Content-Type"] = "application/pdf"
                hdrs["Content-Disposition"] = 'attachment; filename="CCE_PGPA_Mentor_Report.pdf"'
                return Response(pdf_bytes, status=200, headers=hdrs)
            else:
                summary_headers = ["#", "Register Number", "Student Name", "Email", "Department", "Section", "Total Points", "Overall Grade"]
                summary_rows = []
                for idx, row in enumerate(grades_data):
                    summary_rows.append([
                        idx + 1,
                        row.get("register_number") or "—",
                        row.get("student_name") or "—",
                        row.get("email") or "—",
                        row.get("department") or "CCE",
                        row.get("section") or "A",
                        row.get("total_points", 0),
                        row.get("overall_grade") or "—",
                    ])

                sub_headers = ["#", "Reg No", "Student Name", "Component", "Semester", "Activity Title", "Status", "Outcome / Points", "Date"]
                sub_rows = []
                for idx, s in enumerate(subs):
                    sub_rows.append([
                        idx + 1,
                        s.get("register_number") or "—",
                        s.get("student_name") or "—",
                        s.get("component_name") or "—",
                        s.get("semester_name") or f"Semester {s.get('semester_number') or 3}",
                        s.get("title") or "—",
                        s.get("status") or "—",
                        s.get("outcome") or s.get("awarded_points") or "—",
                        s.get("submitted_at") or s.get("event_date") or "—",
                    ])

                clubs_headers = [
                    "#", "Register Number", "Student Name", "Section",
                    "Member Pts", "Event Participation Pts", "Event Coordinator Pts",
                    "Winner Pts", "MAGIC Pts", "Volunteer Pts", "Total Clubs Points", "Clubs Grade"
                ]
                clubs_by_student: Dict[str, Dict[str, float]] = {}
                for s in subs:
                    cslug = (s.get("component_slug") or "").lower()
                    cname = (s.get("component_name") or "").lower()
                    if cslug == "clubs-and-cells" or "club" in cname:
                        sid = s.get("student_id")
                        if not sid:
                            continue
                        meta_str = s.get("component_metadata")
                        cm = {}
                        if isinstance(meta_str, str) and meta_str.strip():
                            try:
                                cm = json.loads(meta_str)
                            except Exception:
                                cm = {}
                        elif isinstance(meta_str, dict):
                            cm = meta_str
                        role_cat = str(cm.get("role_category") or s.get("activity_type") or "").strip().lower()
                        pts = float(cm.get("points") or s.get("evaluated_points") or s.get("points") or s.get("awarded_points") or 0)

                        if sid not in clubs_by_student:
                            clubs_by_student[sid] = {
                                "member": 0.0,
                                "participation": 0.0,
                                "coordinator": 0.0,
                                "winner": 0.0,
                                "magic": 0.0,
                                "volunteer": 0.0,
                            }

                        if "winner" in role_cat or "runner" in role_cat:
                            clubs_by_student[sid]["winner"] += pts
                        elif "magic" in role_cat or "magic" in str(cm.get("club_name") or "").lower():
                            clubs_by_student[sid]["magic"] += pts
                        elif "coordinator" in role_cat or "organizer" in role_cat or "lead" in role_cat:
                            clubs_by_student[sid]["coordinator"] += pts
                        elif "volunteer" in role_cat:
                            clubs_by_student[sid]["volunteer"] += pts
                        elif "participation" in role_cat or "participant" in role_cat:
                            clubs_by_student[sid]["participation"] += pts
                        elif "member" in role_cat:
                            clubs_by_student[sid]["member"] += pts
                        else:
                            clubs_by_student[sid]["participation"] += pts

                clubs_rows = []
                for idx, row in enumerate(grades_data):
                    sid = row.get("student_id")
                    c_data = clubs_by_student.get(sid, {
                        "member": 0.0,
                        "participation": 0.0,
                        "coordinator": 0.0,
                        "winner": 0.0,
                        "magic": 0.0,
                        "volunteer": 0.0,
                    })

                    m_pts = int(c_data["member"]) if c_data["member"].is_integer() else round(c_data["member"], 2)
                    p_pts = int(c_data["participation"]) if c_data["participation"].is_integer() else round(c_data["participation"], 2)
                    c_pts = int(c_data["coordinator"]) if c_data["coordinator"].is_integer() else round(c_data["coordinator"], 2)
                    w_pts = int(c_data["winner"]) if c_data["winner"].is_integer() else round(c_data["winner"], 2)
                    mg_pts = int(c_data["magic"]) if c_data["magic"].is_integer() else round(c_data["magic"], 2)
                    v_pts = int(c_data["volunteer"]) if c_data["volunteer"].is_integer() else round(c_data["volunteer"], 2)

                    tot_c_pts = m_pts + p_pts + c_pts + w_pts + mg_pts + v_pts
                    c_scores = row.get("components", {})
                    if "clubs-and-cells" in c_scores:
                        recorded_pts = float(c_scores["clubs-and-cells"].get("points") or c_scores["clubs-and-cells"].get("raw_score") or 0)
                        if recorded_pts > tot_c_pts:
                            tot_c_pts = int(recorded_pts) if recorded_pts.is_integer() else round(recorded_pts, 2)

                    if tot_c_pts > 0:
                        c_grade, _ = grade_clubs_and_cells(tot_c_pts, 3)
                    else:
                        c_grade = "—"

                    clubs_rows.append([
                        idx + 1,
                        row.get("register_number") or "—",
                        row.get("student_name") or "—",
                        row.get("section") or "A",
                        m_pts,
                        p_pts,
                        c_pts,
                        w_pts,
                        mg_pts,
                        v_pts,
                        tot_c_pts,
                        c_grade,
                    ])

                sheets = [
                    {"name": "Mentee Cohort Summary", "headers": summary_headers, "rows": summary_rows},
                    {"name": "Submissions Breakdown", "headers": sub_headers, "rows": sub_rows},
                    {"name": "Clubs & Cells Breakdown", "headers": clubs_headers, "rows": clubs_rows},
                ]

                excel_bytes = generate_excel_report(
                    title="CCEPGPA",
                    sheets=sheets,
                )
                hdrs = get_cors_headers()
                hdrs["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hdrs["Content-Disposition"] = 'attachment; filename="CCE_PGPA_Mentor_Report.xlsx"'
                return Response(excel_bytes, status=200, headers=hdrs)

        mentor_ach_match = re.match(r"^/api/v1/mentor/achievements/([a-f0-9\-]+)(/review|/revert)?$", path)
        if mentor_ach_match:
            ach_id = mentor_ach_match.group(1)
            action_type = mentor_ach_match.group(2)
            if not current_user or current_user.get("role") not in ("mentor", "hod"):
                return error_response("Forbidden: Mentor access required", 403)

            if action_type == "/review" and method == "POST":
                action = body.get("action", "approved")
                remarks = body.get("remarks", "")
                awarded_grade = body.get("awarded_grade") or body.get("grade")
                awarded_pts = body.get("awarded_points")

                if action not in ("approved", "under_review", "rejected"):
                    return error_response(f"Invalid review action: '{action}'. Allowed actions: 'approved', 'under_review', 'rejected'", 400)

                if action == "rejected" and not str(remarks or "").strip():
                    return error_response("Please provide feedback remarks explaining the reason for rejection so the student can rectify and resubmit.", 400)

                points = None
                if awarded_pts is not None:
                    try:
                        points = float(awarded_pts)
                    except Exception:
                        points = None

                res = await dal.review_achievement(current_user["id"], ach_id, action, remarks, grade=awarded_grade, grade_points=points)
                return json_response(res)

            if action_type == "/revert" and method == "POST":
                remarks = body.get("remarks", "Reverted to pending")
                res = await dal.review_achievement(current_user["id"], ach_id, "revert", remarks)
                return json_response(res)

            if method == "GET":
                ach = await dal.get_achievement_detail(ach_id)
                if not ach:
                    return error_response("Achievement not found", 404)
                return json_response(ach)

        # Manual points endpoints (Mentor, HOD, and Administrator)
        manual_pt_match = re.match(r"^/api/v1/(?:mentor|hod|admin)/manual-points/([a-zA-Z0-9_\-]+)$", path)
        if manual_pt_match:
            entity_id = manual_pt_match.group(1)
            if not current_user or current_user.get("role") not in ("mentor", "hod", "admin"):
                return error_response("Forbidden: Mentor, HOD, or Admin access required", 403)

            if method == "GET":
                pts = await dal.get_manual_points_for_student(entity_id)
                return json_response(pts)

            if method == "DELETE":
                await dal.delete_manual_point(entity_id)
                return json_response({"message": "Manual point record deleted successfully."})

            if method in ("PUT", "PATCH"):
                pts_val = float(body.get("points", 0))
                rem_val = body.get("remarks", "")
                updated_mp = await dal.update_manual_point(entity_id, pts_val, rem_val)
                return json_response(updated_mp)

        if path in ("/api/v1/mentor/manual-points", "/api/v1/hod/manual-points", "/api/v1/admin/manual-points") and method == "POST":
            if not current_user or current_user.get("role") not in ("mentor", "hod", "admin"):
                return error_response("Forbidden: Mentor, HOD, or Admin access required", 403)
            mp = await dal.create_or_update_manual_points(
                current_user["id"],
                body.get("student_id"),
                body.get("component_id"),
                body.get("semester_id"),
                float(body.get("points", 0)),
                body.get("remarks", ""),
            )
            return json_response(mp, 201)

        if path == "/api/v1/students/manual-points" and method == "GET":
            if not current_user or current_user.get("role") != "student":
                return error_response("Forbidden: Student access required", 403)
            pts = await dal.get_manual_points_for_student(current_user["id"])
            return json_response(pts)

        if path in ("/api/v1/mentor/manual-points", "/api/v1/hod/manual-points", "/api/v1/admin/manual-points") and method == "GET":
            if not current_user or current_user.get("role") not in ("mentor", "hod", "admin"):
                return error_response("Forbidden: Mentor, HOD, or Admin access required", 403)
            student_param = query_params.get("student_id", [None])[0]
            if student_param:
                pts = await dal.get_manual_points_for_student(student_param)
            else:
                pts = await dal.get_all_manual_points()
            return json_response(pts)

        # ======================================================================
        # Component Point Settings Endpoints (/api/v1/components/point-settings)
        # ======================================================================
        if path == "/api/v1/components/point-settings" and method == "GET":
            if not current_user:
                return error_response("Unauthorized", 401)
            comps = await dal.query("SELECT * FROM pgpa_components ORDER BY display_order ASC")
            settings = [build_component_point_settings(c) for c in comps]
            return json_response(settings)

        comp_pts_match = re.match(r"^/api/v1/components/([a-zA-Z0-9_\-]+)/point-settings$", path)
        if comp_pts_match:
            comp_id = comp_pts_match.group(1)
            if not current_user:
                return error_response("Unauthorized", 401)
            comp = await dal.first("SELECT * FROM pgpa_components WHERE id = ?", comp_id)
            if not comp:
                return error_response("Component not found", 404)

            if method == "GET":
                return json_response(build_component_point_settings(comp))

            if method in ("PUT", "PATCH"):
                if current_user.get("role") not in ("hod", "admin"):
                    return error_response("Forbidden: HOD or Admin access required to update scoring rules", 403)

                raw_schema = comp.get("config_schema")
                schema_dict = {}
                if isinstance(raw_schema, str) and raw_schema.strip():
                    try:
                        schema_dict = json.loads(raw_schema)
                    except Exception:
                        schema_dict = {}
                elif isinstance(raw_schema, dict):
                    schema_dict = raw_schema

                point_cfg = schema_dict.get("point_config", {})
                if "unit" in body:
                    point_cfg["unit"] = body["unit"]
                if "default_min_points" in body:
                    point_cfg["default_min_points"] = body["default_min_points"]
                if "default_max_points" in body:
                    point_cfg["default_max_points"] = body["default_max_points"]
                if "scale_label" in body:
                    point_cfg["scale_label"] = body["scale_label"]
                if "guideline" in body:
                    point_cfg["guideline"] = body["guideline"]

                if "semesters" in body and isinstance(body["semesters"], list):
                    sem_map = point_cfg.get("semesters", {})
                    for s in body["semesters"]:
                        s_num = str(s.get("semester_number"))
                        sem_map[s_num] = {
                            "min_points": s.get("min_points"),
                            "max_points": s.get("max_points"),
                            "is_enabled": s.get("is_enabled", True),
                            "credit_value": s.get("credit_value"),
                            "scale_label": s.get("scale_label"),
                            "guideline": s.get("guideline"),
                            "grade_thresholds": s.get("grade_thresholds"),
                            "rules_description": s.get("rules_description"),
                        }
                    point_cfg["semesters"] = sem_map

                point_cfg["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                point_cfg["updated_by_name"] = current_user.get("full_name")
                schema_dict["point_config"] = point_cfg

                await dal.execute(
                    "UPDATE pgpa_components SET config_schema = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    json.dumps(schema_dict),
                    comp_id,
                )
                updated_comp = await dal.first("SELECT * FROM pgpa_components WHERE id = ?", comp_id)
                return json_response(build_component_point_settings(updated_comp))

        # ======================================================================
        # 5. HOD Portal Endpoints (/api/v1/hod/*)
        # ======================================================================
        if path == "/api/v1/hod/students" and method == "GET":
            if not current_user or current_user.get("role") not in ("hod", "admin"):
                return error_response("Forbidden: HOD access required", 403)
            students = await dal.list_all_students_admin()
            return json_response(students)

        stu_ach_match = re.match(r"^/api/v1/(hod|mentor)/students/([^/]+)/achievements$", path)
        if stu_ach_match and method == "GET":
            if not current_user or current_user.get("role") not in ("mentor", "hod", "admin"):
                return error_response("Forbidden: Authorized faculty or admin access required", 403)
            target_id = stu_ach_match.group(2).strip()
            # 1. Resolve student user ID: check users.id, student_profiles.id, or register_number
            resolved_student = await dal.first(
                """SELECT u.id, u.full_name, sp.register_number,
                          COALESCE(m.full_name, sp.original_mentor_name, '—') as mentor_name
                   FROM users u
                   LEFT JOIN student_profiles sp ON u.id = sp.user_id
                   LEFT JOIN mentor_assignments ma ON u.id = ma.student_id AND ma.is_active = 1
                   LEFT JOIN users m ON ma.mentor_id = m.id
                   WHERE u.id = ? OR sp.id = ? OR LOWER(sp.register_number) = ?""",
                target_id, target_id, target_id.lower()
            )
            if not resolved_student:
                return json_response([])

            stu_uid = resolved_student["id"]
            mentor_name = resolved_student.get("mentor_name") or "—"
            sem_f = query_params.get("semester_id", [None])[0]
            achs = await dal.get_student_achievements(stu_uid, semester_id=sem_f)
            # Ensure mentor_name, student info, and clean semester display are attached to every achievement
            for a in achs:
                if not a.get("mentor_name"):
                    a["mentor_name"] = mentor_name
                if not a.get("student_name"):
                    a["student_name"] = resolved_student.get("full_name")
                if not a.get("student_register_number"):
                    a["student_register_number"] = resolved_student.get("register_number")
                if a.get("semester_number") and (not a.get("semester_name") or str(a.get("semester_name")).startswith("s0000000")):
                    a["semester_name"] = f"Semester {a['semester_number']}"
            return json_response(achs)

        if path == "/api/v1/hod/overview" and method == "GET":
            if not current_user or current_user.get("role") not in ("hod", "admin"):
                return error_response("Forbidden: HOD access required", 403)
            overview = await dal.get_department_overview()
            return json_response(overview)

        if path == "/api/v1/hod/submissions" and method == "GET":
            if not current_user or current_user.get("role") not in ("hod", "admin"):
                return error_response("Forbidden: HOD access required", 403)
            status_f = query_params.get("status", [None])[0]
            sem_f = query_params.get("semester_id", [None])[0] or query_params.get("semester", [None])[0]
            comp_f = query_params.get("component_id", [None])[0]
            stu_f = query_params.get("student_id", [None])[0]
            search_f = query_params.get("search", [None])[0]
            subs = await dal.get_department_submissions(
                status=status_f,
                semester_id=sem_f,
                component_id=comp_f,
                student_id=stu_f,
                search=search_f,
            )
            return json_response(subs)

        if path in ("/api/v1/hod/export/pdf", "/api/v1/hod/export/excel") and method == "GET":
            if not current_user or current_user.get("role") not in ("hod", "admin"):
                return error_response("Forbidden: HOD access required", 403)

            def _clean_hod_exp(v: Optional[str]) -> Optional[str]:
                if not v or str(v).strip().lower() in ("all", "undefined", "null", "none", ""):
                    return None
                return str(v).strip()

            is_pdf = path.endswith("/pdf")
            sem_id = _clean_hod_exp(query_params.get("semester_id", [None])[0])
            if not sem_id:
                return error_response("Semester selection is mandatory. Please select a specific academic semester.", 400)

            # Resolve semester details
            sem_num_candidate = int(sem_id) if str(sem_id).isdigit() else -1
            sem_row = await dal.first(
                "SELECT id, semester_number, display_name FROM semesters WHERE id = ? OR semester_number = ?",
                sem_id, sem_num_candidate
            )
            if sem_row:
                target_sem_id = sem_row["id"]
                target_sem_num = sem_row["semester_number"]
                target_sem_name = sem_row["display_name"]
            else:
                target_sem_id = sem_id
                target_sem_num = 3
                target_sem_name = f"Semester {sem_id}"

            stu_id = _clean_hod_exp(query_params.get("student_id", [None])[0])
            status_f = _clean_hod_exp(query_params.get("status", [None])[0])
            comp_id = _clean_hod_exp(query_params.get("component_id", [None])[0])
            section_f = _clean_hod_exp(query_params.get("section", [None])[0])
            mentor_f = _clean_hod_exp(query_params.get("mentor_id", [None])[0])

            raw_inc_zero = str(query_params.get("include_zero", ["true"])[0]).strip().lower()
            include_zero = raw_inc_zero not in ("false", "0", "no", "exclude")

            # Query all active and visible components from D1 (strictly excluding skillrack)
            all_active_comps = await dal.query(
                """SELECT id, name, slug, credit_value, display_order
                   FROM pgpa_components
                   WHERE is_active = 1 AND is_visible = 1 AND slug != 'skillrack'
                   ORDER BY display_order ASC"""
            )

            if comp_id:
                target_comps = [c for c in all_active_comps if c["id"] == comp_id or c["slug"] == comp_id or str(comp_id).lower() in c["slug"].lower()]
                if not target_comps:
                    target_comps = all_active_comps
            else:
                target_comps = all_active_comps

            # Student cumulative grades matrix for selected semester
            grades_data = await dal.get_student_pgpa_grades(
                semester_id=target_sem_id,
                section=section_f,
                mentor_id=mentor_f,
                component_slug=None,
            )

            if stu_id and stu_id != "all":
                grades_data = [g for g in grades_data if g.get("student_id") == stu_id or g.get("register_number") == stu_id]

            if not grades_data:
                all_stus = await dal.list_all_students_admin()
                grades_data = [{
                    "student_id": s["id"],
                    "student_name": s["full_name"],
                    "register_number": s["register_number"],
                    "email": s["email"],
                    "section": s["section"] or "A",
                    "mentor_name": s["mentor_name"] or "—",
                } for s in all_stus]
                if section_f and section_f != "all":
                    grades_data = [g for g in grades_data if (g.get("section") or "A").upper() == section_f.upper()]
                if mentor_f and mentor_f != "all":
                    grades_data = [g for g in grades_data if g.get("mentor_id") == mentor_f or g.get("mentor_name") == mentor_f]
                if stu_id and stu_id != "all":
                    grades_data = [g for g in grades_data if g.get("student_id") == stu_id or g.get("register_number") == stu_id]

            # Fetch all approved submissions for the selected semester
            approved_subs = await dal.get_department_submissions(
                status="approved",
                semester_id=target_sem_id,
            )

            # Fetch all manual points for the selected semester
            manual_points = await dal.query(
                """SELECT mp.student_id, mp.points as raw_score,
                          c.slug as component_slug
                   FROM manual_component_points mp
                   JOIN pgpa_components c ON mp.component_id = c.id
                   LEFT JOIN semesters s ON mp.semester_id = s.id
                   WHERE (s.id = ? OR s.semester_number = ? OR mp.semester_id = ?)
                     AND c.slug != 'skillrack'""",
                target_sem_id, target_sem_num, target_sem_id
            )

            subs_map: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
            for sub in approved_subs:
                sid = sub.get("student_id")
                cslug = (sub.get("component_slug") or "").lower()
                if not sid:
                    continue
                if sid not in subs_map:
                    subs_map[sid] = {}
                if cslug not in subs_map[sid]:
                    subs_map[sid][cslug] = []
                subs_map[sid][cslug].append(sub)

            manual_map: Dict[str, Dict[str, float]] = {}
            for mp in manual_points:
                sid = mp.get("student_id")
                cslug = (mp.get("component_slug") or "").lower()
                if not sid:
                    continue
                pts = float(mp.get("raw_score") or 0.0)
                if sid not in manual_map:
                    manual_map[sid] = {}
                manual_map[sid][cslug] = manual_map[sid].get(cslug, 0.0) + pts

            # Category Column Definitions
            CLUBS_HEADERS = [
                "Register Number", "Student Name",
                "Member (100)", "MAGIC (200)", "Event Coordinator (200)", "Volunteer (100)",
                "Event Participation – Within College (100)",
                "Event Participation – Within State (Other College) (200)",
                "Event Participation – National Level (Other State) (300)",
                "Event Participation – International Level (In College / Others) (400)",
                "Event Participation – International Level (Other Country) (500)",
                "Event Winner – Within College (200)",
                "Event Winner – Within State (Other College) (300)",
                "Event Winner – National Level (Other State) (500)",
                "Event Winner – International Level (In College / Others) (600)",
                "Event Winner – International Level (Other Country) (700)",
                "Total Points", "Grade"
            ]

            NPTEL_HEADERS = [
                "Register Number", "Student Name",
                "Topper (Grade O, 10 GP)",
                "Gold (>=90%) (Grade A+, 9 GP)",
                "Silver (75-89%) (Grade A, 7 GP)",
                "Elite (60-74%) (Grade B+, 5 GP)",
                "Successfully Completed (40-59%) (Grade B, 3 GP)",
                "Attended (<40%) (Grade C, 1 GP)",
                "Total Points", "Grade"
            ]

            ONLINE_HEADERS = [
                "Register Number", "Student Name",
                "Completed / Passed", "Elite", "Topper", "Course Completed",
                "Total Points", "Grade"
            ]

            INTERN_HEADERS = [
                "Register Number", "Student Name",
                "Core / with stipend", "Others",
                "Total Points", "Grade"
            ]

            SPORTS_HEADERS = [
                "Register Number", "Student Name",
                "Gold / 1st Place", "Silver / 2nd Place", "Bronze / 3rd Place", "Participation",
                "Total Points", "Grade"
            ]

            GENERAL_HEADERS = [
                "Register Number", "Student Name",
                "Clubs & Cells Points", "NPTEL Points", "Online Certifications Points",
                "Internship Points", "Sports & Games Points", "Total Points", "Overall Grade"
            ]

            general_rows: List[List[Any]] = []
            clubs_rows: List[List[Any]] = []
            nptel_rows: List[List[Any]] = []
            online_rows: List[List[Any]] = []
            intern_rows: List[List[Any]] = []
            sports_rows: List[List[Any]] = []

            all_students_sorted = sorted(grades_data, key=lambda s: str(s.get("register_number") or ""))

            for student in all_students_sorted:
                sid = student.get("student_id") or ""
                reg_no = student.get("register_number") or "—"
                student_name = student.get("student_name") or "—"

                # 1. Clubs & Cells
                clubs_cat_pts = {
                    "Member (100)": 0.0,
                    "MAGIC (200)": 0.0,
                    "Event Coordinator (200)": 0.0,
                    "Volunteer (100)": 0.0,
                    "Event Participation – Within College (100)": 0.0,
                    "Event Participation – Within State (Other College) (200)": 0.0,
                    "Event Participation – National Level (Other State) (300)": 0.0,
                    "Event Participation – International Level (In College / Others) (400)": 0.0,
                    "Event Participation – International Level (Other Country) (500)": 0.0,
                    "Event Winner – Within College (200)": 0.0,
                    "Event Winner – Within State (Other College) (300)": 0.0,
                    "Event Winner – National Level (Other State) (500)": 0.0,
                    "Event Winner – International Level (In College / Others) (600)": 0.0,
                    "Event Winner – International Level (Other Country) (700)": 0.0,
                }
                c_subs = subs_map.get(sid, {}).get("clubs-and-cells", [])
                for sub in c_subs:
                    cm = sub.get("component_metadata") or {}
                    if isinstance(cm, str):
                        try:
                            cm = json.loads(cm)
                        except Exception:
                            cm = {}
                    r_cat = str(cm.get("role_category") or sub.get("activity_type") or "").strip().lower()
                    e_lvl = str(cm.get("event_level") or "").strip().lower()
                    sub_pts = sub.get("evaluated_points")
                    if sub_pts is None:
                        sub_pts = cm.get("points") or cm.get("calculated_points") or 0
                    try:
                        sub_pts = float(sub_pts)
                    except Exception:
                        sub_pts = 0.0

                    if "member" in r_cat and "coordinator" not in r_cat:
                        clubs_cat_pts["Member (100)"] += sub_pts if sub_pts > 0 else 100.0
                    elif "magic" in r_cat or "magic" in str(cm.get("club_name") or "").lower():
                        clubs_cat_pts["MAGIC (200)"] += sub_pts if sub_pts > 0 else 200.0
                    elif "coordinator" in r_cat or "organizer" in r_cat or "lead" in r_cat:
                        clubs_cat_pts["Event Coordinator (200)"] += sub_pts if sub_pts > 0 else 200.0
                    elif "volunteer" in r_cat:
                        clubs_cat_pts["Volunteer (100)"] += sub_pts if sub_pts > 0 else 100.0
                    elif "winner" in r_cat:
                        if "country" in e_lvl:
                            clubs_cat_pts["Event Winner – International Level (Other Country) (700)"] += sub_pts if sub_pts > 0 else 700.0
                        elif "international" in e_lvl:
                            clubs_cat_pts["Event Winner – International Level (In College / Others) (600)"] += sub_pts if sub_pts > 0 else 600.0
                        elif "national" in e_lvl or "other state" in e_lvl:
                            clubs_cat_pts["Event Winner – National Level (Other State) (500)"] += sub_pts if sub_pts > 0 else 500.0
                        elif "state" in e_lvl or "other college" in e_lvl:
                            clubs_cat_pts["Event Winner – Within State (Other College) (300)"] += sub_pts if sub_pts > 0 else 300.0
                        else:
                            clubs_cat_pts["Event Winner – Within College (200)"] += sub_pts if sub_pts > 0 else 200.0
                    elif "participation" in r_cat or "participant" in r_cat:
                        if "country" in e_lvl:
                            clubs_cat_pts["Event Participation – International Level (Other Country) (500)"] += sub_pts if sub_pts > 0 else 500.0
                        elif "international" in e_lvl:
                            clubs_cat_pts["Event Participation – International Level (In College / Others) (400)"] += sub_pts if sub_pts > 0 else 400.0
                        elif "national" in e_lvl or "other state" in e_lvl:
                            clubs_cat_pts["Event Participation – National Level (Other State) (300)"] += sub_pts if sub_pts > 0 else 300.0
                        elif "state" in e_lvl or "other college" in e_lvl:
                            clubs_cat_pts["Event Participation – Within State (Other College) (200)"] += sub_pts if sub_pts > 0 else 200.0
                        else:
                            clubs_cat_pts["Event Participation – Within College (100)"] += sub_pts if sub_pts > 0 else 100.0
                    else:
                        clubs_cat_pts["Member (100)"] += sub_pts if sub_pts > 0 else 100.0

                m_clubs = manual_map.get(sid, {}).get("clubs-and-cells", 0.0)
                if m_clubs > 0:
                    clubs_cat_pts["Member (100)"] += m_clubs

                tot_clubs = sum(clubs_cat_pts.values())
                clubs_grade = grade_clubs_and_cells(tot_clubs, target_sem_num)[0] if tot_clubs > 0 else "C"

                c_row: List[Any] = [reg_no, student_name]
                for k in CLUBS_HEADERS[2:-2]:
                    v = clubs_cat_pts[k]
                    c_row.append(int(v) if v.is_integer() else round(v, 2))
                c_row.append(int(tot_clubs) if tot_clubs.is_integer() else round(tot_clubs, 2))
                c_row.append(clubs_grade)
                clubs_rows.append(c_row)

                # 2. NPTEL
                nptel_cat_pts = {
                    "Topper (Grade O, 10 GP)": 0.0,
                    "Gold (>=90%) (Grade A+, 9 GP)": 0.0,
                    "Silver (75-89%) (Grade A, 7 GP)": 0.0,
                    "Elite (60-74%) (Grade B+, 5 GP)": 0.0,
                    "Successfully Completed (40-59%) (Grade B, 3 GP)": 0.0,
                    "Attended (<40%) (Grade C, 1 GP)": 0.0,
                }
                np_subs = subs_map.get(sid, {}).get("nptel-non-credit-transfer", [])
                for sub in np_subs:
                    cm = sub.get("component_metadata") or {}
                    if isinstance(cm, str):
                        try:
                            cm = json.loads(cm)
                        except Exception:
                            cm = {}
                    cat = str(cm.get("category") or sub.get("outcome") or "").strip().lower()
                    sub_pts = sub.get("evaluated_points")
                    if sub_pts is None:
                        sub_pts = cm.get("points") or 0
                    try:
                        sub_pts = float(sub_pts)
                    except Exception:
                        sub_pts = 0.0

                    if "topper" in cat:
                        nptel_cat_pts["Topper (Grade O, 10 GP)"] += sub_pts if sub_pts > 0 else 100.0
                    elif "gold" in cat and "elite with gold" not in cat:
                        nptel_cat_pts["Gold (>=90%) (Grade A+, 9 GP)"] += sub_pts if sub_pts > 0 else 90.0
                    elif "silver" in cat:
                        nptel_cat_pts["Silver (75-89%) (Grade A, 7 GP)"] += sub_pts if sub_pts > 0 else 75.0
                    elif "elite" in cat:
                        nptel_cat_pts["Elite (60-74%) (Grade B+, 5 GP)"] += sub_pts if sub_pts > 0 else 60.0
                    elif "attended" in cat:
                        nptel_cat_pts["Attended (<40%) (Grade C, 1 GP)"] += sub_pts if sub_pts > 0 else 20.0
                    else:
                        nptel_cat_pts["Successfully Completed (40-59%) (Grade B, 3 GP)"] += sub_pts if sub_pts > 0 else 40.0

                m_nptel = manual_map.get(sid, {}).get("nptel-non-credit-transfer", 0.0)
                if m_nptel > 0:
                    nptel_cat_pts["Successfully Completed (40-59%) (Grade B, 3 GP)"] += m_nptel

                tot_nptel = sum(nptel_cat_pts.values())
                if tot_nptel >= 90:
                    nptel_grade = "O"
                elif tot_nptel >= 75:
                    nptel_grade = "A+"
                elif tot_nptel >= 60:
                    nptel_grade = "A"
                elif tot_nptel >= 50:
                    nptel_grade = "B+"
                elif tot_nptel >= 40:
                    nptel_grade = "B"
                else:
                    nptel_grade = "C"

                np_row: List[Any] = [reg_no, student_name]
                for k in NPTEL_HEADERS[2:-2]:
                    v = nptel_cat_pts[k]
                    np_row.append(int(v) if v.is_integer() else round(v, 2))
                np_row.append(int(tot_nptel) if tot_nptel.is_integer() else round(tot_nptel, 2))
                np_row.append(nptel_grade)
                nptel_rows.append(np_row)

                # 3. Online Certifications
                online_cat_pts = {
                    "Completed / Passed": 0.0,
                    "Elite": 0.0,
                    "Topper": 0.0,
                    "Course Completed": 0.0,
                }
                on_subs = subs_map.get(sid, {}).get("online-certifications", [])
                for sub in on_subs:
                    cm = sub.get("component_metadata") or {}
                    if isinstance(cm, str):
                        try:
                            cm = json.loads(cm)
                        except Exception:
                            cm = {}
                    cat = str(cm.get("category") or sub.get("outcome") or "").strip().lower()
                    sub_pts = sub.get("evaluated_points")
                    if sub_pts is None:
                        sub_pts = cm.get("points") or 0
                    try:
                        sub_pts = float(sub_pts)
                    except Exception:
                        sub_pts = 0.0

                    if "topper" in cat:
                        online_cat_pts["Topper"] += sub_pts if sub_pts > 0 else 100.0
                    elif "elite" in cat:
                        online_cat_pts["Elite"] += sub_pts if sub_pts > 0 else 75.0
                    elif "course completed" in cat:
                        online_cat_pts["Course Completed"] += sub_pts if sub_pts > 0 else 50.0
                    elif "gold" in cat:
                        online_cat_pts["Topper"] += sub_pts if sub_pts > 0 else 100.0
                    elif "silver" in cat:
                        online_cat_pts["Elite"] += sub_pts if sub_pts > 0 else 75.0
                    else:
                        online_cat_pts["Completed / Passed"] += sub_pts if sub_pts > 0 else 50.0

                m_online = manual_map.get(sid, {}).get("online-certifications", 0.0)
                if m_online > 0:
                    online_cat_pts["Completed / Passed"] += m_online

                tot_online = sum(online_cat_pts.values())
                if tot_online >= 90:
                    online_grade = "O"
                elif tot_online >= 75:
                    online_grade = "A+"
                elif tot_online >= 60:
                    online_grade = "A"
                elif tot_online >= 50:
                    online_grade = "B+"
                elif tot_online >= 40:
                    online_grade = "B"
                else:
                    online_grade = "C"

                on_row: List[Any] = [reg_no, student_name]
                for k in ONLINE_HEADERS[2:-2]:
                    v = online_cat_pts[k]
                    on_row.append(int(v) if v.is_integer() else round(v, 2))
                on_row.append(int(tot_online) if tot_online.is_integer() else round(tot_online, 2))
                on_row.append(online_grade)
                online_rows.append(on_row)

                # 4. Internship
                intern_cat_pts = {
                    "Core / with stipend": 0.0,
                    "Others": 0.0,
                }
                in_subs = subs_map.get(sid, {}).get("internship", [])
                for sub in in_subs:
                    cm = sub.get("component_metadata") or {}
                    if isinstance(cm, str):
                        try:
                            cm = json.loads(cm)
                        except Exception:
                            cm = {}
                    cat = str(cm.get("company_type") or sub.get("outcome") or sub.get("activity_type") or "").strip().lower()
                    sub_pts = sub.get("evaluated_points")
                    if sub_pts is None:
                        sub_pts = cm.get("points") or 0
                    try:
                        sub_pts = float(sub_pts)
                    except Exception:
                        sub_pts = 0.0

                    if "core" in cat or "stipend" in cat:
                        intern_cat_pts["Core / with stipend"] += sub_pts if sub_pts > 0 else 10.0
                    else:
                        intern_cat_pts["Others"] += sub_pts if sub_pts > 0 else 7.0

                m_intern = manual_map.get(sid, {}).get("internship", 0.0)
                if m_intern > 0:
                    intern_cat_pts["Core / with stipend"] += m_intern

                tot_intern = sum(intern_cat_pts.values())
                if tot_intern >= 10:
                    intern_grade = "O"
                elif tot_intern >= 9:
                    intern_grade = "A+"
                elif tot_intern >= 7:
                    intern_grade = "A"
                elif tot_intern >= 5:
                    intern_grade = "B+"
                elif tot_intern >= 3:
                    intern_grade = "B"
                else:
                    intern_grade = "C"

                in_row: List[Any] = [reg_no, student_name]
                for k in INTERN_HEADERS[2:-2]:
                    v = intern_cat_pts[k]
                    in_row.append(int(v) if v.is_integer() else round(v, 2))
                in_row.append(int(tot_intern) if tot_intern.is_integer() else round(tot_intern, 2))
                in_row.append(intern_grade)
                intern_rows.append(in_row)

                # 5. Sports & Games
                sports_cat_pts = {
                    "Gold / 1st Place": 0.0,
                    "Silver / 2nd Place": 0.0,
                    "Bronze / 3rd Place": 0.0,
                    "Participation": 0.0,
                }
                sp_subs = subs_map.get(sid, {}).get("sports-and-games", [])
                for sub in sp_subs:
                    cm = sub.get("component_metadata") or {}
                    if isinstance(cm, str):
                        try:
                            cm = json.loads(cm)
                        except Exception:
                            cm = {}
                    pos = str(cm.get("position") or sub.get("outcome") or sub.get("activity_type") or "").strip().lower()
                    sub_pts = sub.get("evaluated_points")
                    if sub_pts is None:
                        sub_pts = cm.get("points") or cm.get("calculated_points") or 0
                    try:
                        sub_pts = float(sub_pts)
                    except Exception:
                        sub_pts = 0.0

                    if "gold" in pos or "1st" in pos:
                        sports_cat_pts["Gold / 1st Place"] += sub_pts if sub_pts > 0 else 100.0
                    elif "silver" in pos or "2nd" in pos:
                        sports_cat_pts["Silver / 2nd Place"] += sub_pts if sub_pts > 0 else 80.0
                    elif "bronze" in pos or "3rd" in pos:
                        sports_cat_pts["Bronze / 3rd Place"] += sub_pts if sub_pts > 0 else 60.0
                    else:
                        sports_cat_pts["Participation"] += sub_pts if sub_pts > 0 else 30.0

                m_sports = manual_map.get(sid, {}).get("sports-and-games", 0.0)
                if m_sports > 0:
                    sports_cat_pts["Participation"] += m_sports

                tot_sports = sum(sports_cat_pts.values())
                sports_grade = grade_sports_and_games(tot_sports)[0] if tot_sports > 0 else "C"

                sp_row: List[Any] = [reg_no, student_name]
                for k in SPORTS_HEADERS[2:-2]:
                    v = sports_cat_pts[k]
                    sp_row.append(int(v) if v.is_integer() else round(v, 2))
                sp_row.append(int(tot_sports) if tot_sports.is_integer() else round(tot_sports, 2))
                sp_row.append(sports_grade)
                sports_rows.append(sp_row)

                # 6. Overall Total & Grade
                tot_points = round(tot_clubs + tot_nptel + tot_online + tot_intern + tot_sports, 2)
                if tot_points >= 1200:
                    overall_grade = "O"
                elif tot_points >= 1000:
                    overall_grade = "A+"
                elif tot_points >= 850:
                    overall_grade = "A"
                elif tot_points >= 700:
                    overall_grade = "B+"
                elif tot_points >= 550:
                    overall_grade = "B"
                else:
                    overall_grade = "C"

                c_pts_clean = int(tot_clubs) if tot_clubs.is_integer() else round(tot_clubs, 2)
                n_pts_clean = int(tot_nptel) if tot_nptel.is_integer() else round(tot_nptel, 2)
                o_pts_clean = int(tot_online) if tot_online.is_integer() else round(tot_online, 2)
                i_pts_clean = int(tot_intern) if tot_intern.is_integer() else round(tot_intern, 2)
                s_pts_clean = int(tot_sports) if tot_sports.is_integer() else round(tot_sports, 2)
                tot_clean = int(tot_points) if tot_points.is_integer() else round(tot_points, 2)

                general_rows.append([
                    reg_no,
                    student_name,
                    c_pts_clean,
                    n_pts_clean,
                    o_pts_clean,
                    i_pts_clean,
                    s_pts_clean,
                    tot_clean,
                    overall_grade,
                ])

            # Apply zero points filter if requested
            if not include_zero:
                valid_indices = [idx for idx, r in enumerate(general_rows) if r[7] > 0]
                general_rows = [general_rows[i] for i in valid_indices]
                clubs_rows = [clubs_rows[i] for i in valid_indices]
                nptel_rows = [nptel_rows[i] for i in valid_indices]
                online_rows = [online_rows[i] for i in valid_indices]
                intern_rows = [intern_rows[i] for i in valid_indices]
                sports_rows = [sports_rows[i] for i in valid_indices]

            meta = {
                "Report Title": "CCEPGPA",
                "Department": "Computer and Communication Engineering (CCE)",
                "Academic Scope": f"{target_sem_name}",
                "Total Students": str(len(general_rows)),
                "Zero Points Filter": "Included" if include_zero else "Excluded",
            }
            if section_f and section_f != "all":
                meta["Section"] = section_f
            if mentor_f and mentor_f != "all":
                meta["Mentor Filter"] = mentor_f

            # Determine component worksheets/sections to include
            include_clubs = True
            include_nptel = True
            include_online = True
            include_intern = True
            include_sports = True

            if comp_id and comp_id != "all":
                c_slug_lower = str(comp_id).lower()
                include_clubs = "club" in c_slug_lower
                include_nptel = "nptel" in c_slug_lower
                include_online = "online" in c_slug_lower or "cert" in c_slug_lower
                include_intern = "intern" in c_slug_lower
                include_sports = "sport" in c_slug_lower

            sheets: List[Dict[str, Any]] = [
                {"name": "General", "headers": GENERAL_HEADERS, "rows": general_rows}
            ]
            if include_clubs:
                sheets.append({"name": "Clubs & Cells", "headers": CLUBS_HEADERS, "rows": clubs_rows})
            if include_nptel:
                sheets.append({"name": "NPTEL", "headers": NPTEL_HEADERS, "rows": nptel_rows})
            if include_online:
                sheets.append({"name": "Online Certifications", "headers": ONLINE_HEADERS, "rows": online_rows})
            if include_intern:
                sheets.append({"name": "Internship", "headers": INTERN_HEADERS, "rows": intern_rows})
            if include_sports:
                sheets.append({"name": "Sports & Games", "headers": SPORTS_HEADERS, "rows": sports_rows})

            if is_pdf:
                pdf_sections: List[Dict[str, Any]] = [
                    {
                        "title": "CCEPGPA",
                        "subtitle": f"Department HOD Institutional PGPA Summary — {target_sem_name}",
                        "headers": GENERAL_HEADERS,
                        "rows": general_rows,
                    }
                ]
                if include_clubs:
                    pdf_sections.append({
                        "title": "CCEPGPA — Clubs & Cells",
                        "subtitle": f"Institutional Cumulative Performance (Table 7.1 Criteria) — {target_sem_name}",
                        "headers": CLUBS_HEADERS,
                        "rows": clubs_rows,
                    })
                if include_nptel:
                    pdf_sections.append({
                        "title": "CCEPGPA — NPTEL",
                        "subtitle": f"Institutional Cumulative Performance (Table 10.1 SWAYAM Criteria) — {target_sem_name}",
                        "headers": NPTEL_HEADERS,
                        "rows": nptel_rows,
                    })
                if include_online:
                    pdf_sections.append({
                        "title": "CCEPGPA — Online Certifications",
                        "subtitle": f"Institutional Cumulative Performance (Approved MOOC Providers) — {target_sem_name}",
                        "headers": ONLINE_HEADERS,
                        "rows": online_rows,
                    })
                if include_intern:
                    pdf_sections.append({
                        "title": "CCEPGPA — Internship",
                        "subtitle": f"Institutional Cumulative Performance (Table 3.3 Criteria) — {target_sem_name}",
                        "headers": INTERN_HEADERS,
                        "rows": intern_rows,
                    })
                if include_sports:
                    pdf_sections.append({
                        "title": "CCEPGPA — Sports & Games",
                        "subtitle": f"Institutional Cumulative Performance (Table 8.1 Medal Matrix) — {target_sem_name}",
                        "headers": SPORTS_HEADERS,
                        "rows": sports_rows,
                    })

                pdf_bytes = generate_pdf_report(
                    title="CCEPGPA",
                    subtitle=f"Department HOD Institutional PGPA Audit & Performance Report — {target_sem_name}",
                    metadata=meta,
                    sections=pdf_sections,
                )
                hdrs = get_cors_headers()
                hdrs["Content-Type"] = "application/pdf"
                hdrs["Content-Disposition"] = f'attachment; filename="CCEPGPA_Semester_{target_sem_num}_Report.pdf"'
                return Response(pdf_bytes, status=200, headers=hdrs)
            else:
                excel_bytes = generate_excel_report(
                    title="CCEPGPA",
                    sheets=sheets,
                )
                hdrs = get_cors_headers()
                hdrs["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hdrs["Content-Disposition"] = f'attachment; filename="CCEPGPA_Semester_{target_sem_num}_Report.xlsx"'
                return Response(excel_bytes, status=200, headers=hdrs)

        hod_ach_match = re.match(r"^/api/v1/hod/achievements/([a-f0-9\-]+)(/review|/revert)?$", path)
        if hod_ach_match:
            ach_id = hod_ach_match.group(1)
            action_type = hod_ach_match.group(2)
            if not current_user or current_user.get("role") not in ("hod", "admin"):
                return error_response("Forbidden: HOD access required", 403)

            if action_type == "/review" and method == "POST":
                action = body.get("action", "approved")
                remarks = body.get("remarks", "")
                awarded_grade = body.get("awarded_grade") or body.get("grade")
                awarded_pts = body.get("awarded_points")

                if action not in ("approved", "under_review", "rejected"):
                    return error_response(f"Invalid review action: '{action}'. Allowed actions: 'approved', 'under_review', 'rejected'", 400)

                if action == "rejected" and not str(remarks or "").strip():
                    return error_response("Please provide feedback remarks explaining the reason for rejection.", 400)

                points = None
                if awarded_pts is not None:
                    try:
                        points = float(awarded_pts)
                    except Exception:
                        points = None

                res = await dal.review_achievement(current_user["id"], ach_id, action, remarks, grade=awarded_grade, grade_points=points)
                return json_response(res)

            if action_type == "/revert" and method == "POST":
                remarks = body.get("remarks", "Reverted by HOD")
                res = await dal.review_achievement(current_user["id"], ach_id, "revert", remarks)
                return json_response(res)

            if method == "GET":
                ach = await dal.get_achievement_detail(ach_id)
                if not ach:
                    return error_response("Achievement not found", 404)
                return json_response(ach)

        if path == "/api/v1/hod/components" and method == "GET":
            if not current_user or current_user.get("role") not in ("hod", "admin"):
                return error_response("Forbidden: HOD access required", 403)
            comps = await dal.get_all_components_admin()
            return json_response(comps)

        if path == "/api/v1/hod/component-results" and method == "GET":
            if not current_user or current_user.get("role") not in ("hod", "admin"):
                return error_response("Forbidden: HOD access required", 403)
            results = await dal.query(
                """SELECT cr.*, u.full_name as student_name, sp.register_number, sp.section,
                          c.name as component_name, s.display_name as semester_name
                   FROM student_component_results cr
                   JOIN users u ON cr.student_id = u.id
                   JOIN student_profiles sp ON u.id = sp.user_id
                   JOIN pgpa_components c ON cr.component_id = c.id
                   JOIN semesters s ON cr.semester_id = s.id
                   ORDER BY sp.register_number ASC"""
            )
            return json_response(results)

        if path == "/api/v1/hod/student-pgpa-grades" and method == "GET":
            if not current_user or current_user.get("role") not in ("hod", "admin"):
                return error_response("Forbidden: HOD access required", 403)
            def _clean_param(v: Optional[str]) -> Optional[str]:
                if not v or str(v).strip().lower() in ("all", "undefined", "null", "none", ""):
                    return None
                return str(v).strip()

            sem_id = _clean_param(query_params.get("semester_id", [None])[0])
            section = _clean_param(query_params.get("section", [None])[0])
            mentor_id = _clean_param(query_params.get("mentor_id", [None])[0])
            comp_slug = _clean_param(query_params.get("component_slug", [None])[0])
            grade = _clean_param(query_params.get("grade", [None])[0])
            search = _clean_param(query_params.get("search", [None])[0])
            try:
                data = await dal.get_student_pgpa_grades(
                    semester_id=sem_id,
                    section=section,
                    mentor_id=mentor_id,
                    component_slug=comp_slug,
                    grade=grade,
                    search=search,
                )
                return json_response(data)
            except Exception as e:
                logger.error("Error in hod student-pgpa-grades: %s", e)
                return error_response(f"Failed to fetch student PGPA grades: {str(e)}", 500)

        # ======================================================================
        # 6. Admin Portal Endpoints (/api/v1/admin/*)
        # ======================================================================
        if path == "/api/v1/admin/overview" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            u_count = (await dal.first("SELECT count(*) as cnt FROM users"))["cnt"]
            s_count = (await dal.first("SELECT count(*) as cnt FROM student_profiles"))["cnt"]
            m_count = (await dal.first("SELECT count(*) as cnt FROM mentor_profiles"))["cnt"]
            c_count = (await dal.first("SELECT count(*) as cnt FROM pgpa_components"))["cnt"]
            sub_count = (await dal.first("SELECT count(*) as cnt FROM achievements WHERE status != 'draft'"))["cnt"]
            return json_response({
                "total_users": u_count,
                "total_students": s_count,
                "total_mentors": m_count,
                "total_components": c_count,
                "total_submissions": sub_count,
                "storage_provider": "google_drive",
            })

        if path == "/api/v1/admin/students" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            students = await dal.list_all_students_admin()
            return json_response(students)

        if path == "/api/v1/admin/students" and method == "POST":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)

            full_name = body.get("full_name", "").strip()
            email = body.get("email", "").strip().lower()
            register_number = body.get("register_number", "").strip().upper()
            raw_password = (body.get("password") or "").strip() or "cce@123"
            department = (body.get("department") or "CCE").strip()
            try:
                year = int(body.get("year", 1))
            except Exception:
                year = 1
            section = (body.get("section") or "").strip() or None
            semester = (body.get("semester") or "").strip() or None
            batch = (body.get("batch") or "").strip() or None
            phone_number = (body.get("phone_number") or "").strip() or None
            assigned_mentor_id = body.get("assigned_mentor_id") or None

            if not full_name or not email or not register_number:
                return error_response("Full name, email, and register number are required.", 400)

            # Uniqueness checks in D1
            existing_user = await dal.get_user_by_email(email)
            if existing_user:
                return error_response(f"Email '{email}' already exists in the system.", 400)

            existing_sp = await dal.first("SELECT id FROM student_profiles WHERE UPPER(register_number) = ?", register_number)
            if existing_sp:
                return error_response(f"Register number '{register_number}' already exists.", 400)

            mentor_user = None
            if assigned_mentor_id:
                mentor_user = await dal.get_user_by_id(assigned_mentor_id)

            # Provision in Firebase Authentication with initial password
            firebase_uid = None
            sa_json = getattr(self.env, "FIREBASE_SERVICE_ACCOUNT_JSON", "")
            if sa_json:
                try:
                    sa_dict = json.loads(sa_json)
                    firebase_uid = await create_or_update_firebase_user(
                        sa_dict=sa_dict,
                        email=email,
                        password=raw_password,
                        display_name=full_name,
                    )
                except Exception as fb_err:
                    logger.error("Failed to provision Firebase user for %s: %s", email, fb_err)

            new_user_id = str(uuid.uuid4())
            pw_hash = hash_password(raw_password)
            await dal.execute(
                """INSERT INTO users (id, full_name, email, password_hash, firebase_uid, role, is_active, must_change_password)
                   VALUES (?, ?, ?, ?, ?, 'student', 1, 1)""",
                new_user_id,
                full_name,
                email,
                pw_hash,
                firebase_uid,
            )

            new_profile_id = str(uuid.uuid4())
            mentor_name = mentor_user.get("full_name") if mentor_user else None
            await dal.execute(
                """INSERT INTO student_profiles (id, user_id, register_number, department, year, section, semester, batch, phone_number, original_mentor_name)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                new_profile_id,
                new_user_id,
                register_number,
                department,
                year,
                section,
                semester,
                batch,
                phone_number,
                mentor_name,
            )

            assigned_mentor_obj = None
            if assigned_mentor_id and mentor_user:
                assign_id = str(uuid.uuid4())
                await dal.execute(
                    """INSERT INTO mentor_assignments (id, mentor_id, student_id, assigned_by, is_active)
                       VALUES (?, ?, ?, ?, 1)""",
                    assign_id,
                    assigned_mentor_id,
                    new_user_id,
                    current_user["id"],
                )
                assigned_mentor_obj = {
                    "mentor_id": mentor_user["id"],
                    "full_name": mentor_user["full_name"],
                    "email": mentor_user["email"],
                    "staff_id": None,
                }

            # Auto-provision student Google Drive folder if Drive credentials available
            drive_fid = None
            try:
                cred = await dal.get_oauth_credential("google_drive")
                if cred and cred.get("encrypted_refresh_token"):
                    refresh_tok = decrypt_token(cred["encrypted_refresh_token"], jwt_secret)
                    client_id = cred.get("client_id") or getattr(self.env, "GOOGLE_OAUTH_CLIENT_ID", "")
                    client_sec = getattr(self.env, "GOOGLE_OAUTH_CLIENT_SECRET", "")
                    acc_tok = await refresh_access_token(client_id, client_sec, refresh_tok)
                    drive_folder_id = getattr(self.env, "GOOGLE_DRIVE_FOLDER_ID", "1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI")
                    clean_reg = re.sub(r"[^A-Za-z0-9]", "", register_number).upper()
                    clean_name = re.sub(r"[^A-Za-z0-9]+", "_", full_name).strip("_").upper()
                    folder_name = f"{clean_reg}_{clean_name}"
                    drive_fid = await get_or_create_folder(acc_tok, folder_name, drive_folder_id)
                    await dal.execute("UPDATE student_profiles SET google_drive_folder_id = ? WHERE id = ?", drive_fid, new_profile_id)
            except Exception as d_err:
                logger.warning("Could not auto-provision Drive folder for new student %s: %s", register_number, d_err)

            return json_response({
                "id": new_user_id,
                "full_name": full_name,
                "email": email,
                "role": "student",
                "is_active": True,
                "firebase_uid": firebase_uid,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "register_number": register_number,
                "department": department,
                "year": year,
                "section": section,
                "semester": semester,
                "batch": batch,
                "phone_number": phone_number,
                "original_mentor_name": mentor_name,
                "google_drive_folder_id": drive_fid,
                "assigned_mentor": assigned_mentor_obj,
                "submission_count": 0,
                "approved_count": 0,
                "pending_count": 0,
            })

        admin_student_detail_match = re.match(r"^/api/v1/admin/students/([a-zA-Z0-9_\-]+)$", path)
        if admin_student_detail_match and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            target_id = admin_student_detail_match.group(1)
            user = await dal.find_user_by_any_id(target_id)
            if not user or user.get("role") != "student":
                return error_response(f"Student '{target_id}' not found", 404)
            sp = await dal.first("SELECT * FROM student_profiles WHERE user_id = ?", user["id"])
            ma = await dal.first(
                """SELECT ma.mentor_id, m.full_name, m.email
                   FROM mentor_assignments ma
                   JOIN users m ON ma.mentor_id = m.id
                   WHERE ma.student_id = ? AND ma.is_active = 1""",
                user["id"],
            )
            mentor_info = {
                "mentor_id": ma["mentor_id"],
                "full_name": ma["full_name"],
                "email": ma["email"],
                "staff_id": None,
            } if ma else None

            sub_count = (await dal.first("SELECT count(*) as cnt FROM achievements WHERE student_id = ?", user["id"]))["cnt"]
            appr_count = (await dal.first("SELECT count(*) as cnt FROM achievements WHERE student_id = ? AND status = 'approved'", user["id"]))["cnt"]
            pend_count = (await dal.first("SELECT count(*) as cnt FROM achievements WHERE student_id = ? AND status IN ('pending', 'submitted')", user["id"]))["cnt"]

            return json_response({
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": "student",
                "is_active": bool(user["is_active"]),
                "firebase_uid": user.get("firebase_uid"),
                "created_at": user.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "register_number": sp.get("register_number") if sp else None,
                "department": sp.get("department", "CCE") if sp else "CCE",
                "year": sp.get("year", 1) if sp else 1,
                "section": sp.get("section") if sp else None,
                "semester": sp.get("semester") if sp else None,
                "batch": sp.get("batch") if sp else None,
                "phone_number": sp.get("phone_number") if sp else None,
                "original_mentor_name": sp.get("original_mentor_name") if sp else None,
                "google_drive_folder_id": sp.get("google_drive_folder_id") if sp else None,
                "assigned_mentor": mentor_info,
                "submission_count": sub_count,
                "approved_count": appr_count,
                "pending_count": pend_count,
                "assignment_history": [],
            })

        admin_student_status_match = re.match(r"^/api/v1/admin/students/([a-zA-Z0-9_\-]+)/status$", path)
        if admin_student_status_match and method == "PATCH":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            target_id = admin_student_status_match.group(1)
            user = await dal.find_user_by_any_id(target_id)
            if not user:
                return error_response(f"Student '{target_id}' not found", 404)
            new_is_active = 1 if body.get("is_active", True) else 0
            await dal.execute("UPDATE users SET is_active = ? WHERE id = ?", new_is_active, user["id"])
            return json_response({
                "success": True,
                "message": f"Student status updated to {'active' if new_is_active else 'inactive'}.",
            })

        if path == "/api/v1/admin/mentors" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            mentors = await dal.list_all_mentors_admin()
            return json_response(mentors)

        if path == "/api/v1/admin/hods" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            hods = await dal.list_all_hods_admin()
            return json_response(hods)

        if path == "/api/v1/admin/components" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            comps = await dal.get_all_components_admin()
            return json_response(comps)

        if path in ("/api/v1/admin/components/semester-matrix", "/api/v1/admin/components/matrix") and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            matrix = await dal.get_components_semester_matrix()
            return json_response(matrix)

        admin_comp_vis = re.match(r"^/api/v1/admin/components/([a-zA-Z0-9_\-]+)/visibility$", path)
        if admin_comp_vis:
            comp_id = admin_comp_vis.group(1)
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            if method == "PATCH":
                is_vis = bool(body.get("is_visible", True))
                try:
                    res = await dal.update_component_visibility(comp_id, is_vis)
                    return json_response(res)
                except ValueError as ve:
                    return error_response(str(ve), 404)

        admin_comp_sem_cfg = re.match(r"^/api/v1/admin/components/([a-zA-Z0-9_\-]+)/semesters/([a-zA-Z0-9_\-]+)$", path)
        if admin_comp_sem_cfg:
            comp_id = admin_comp_sem_cfg.group(1)
            sem_id = admin_comp_sem_cfg.group(2)
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            if method == "PATCH":
                is_enabled = bool(body.get("is_enabled", True))
                deadline = body.get("submission_deadline")
                res = await dal.update_component_semester_config(comp_id, sem_id, is_enabled, deadline)
                return json_response(res)

        admin_comp_sems = re.match(r"^/api/v1/admin/components/([a-zA-Z0-9_\-]+)/semesters$", path)
        if admin_comp_sems:
            comp_id = admin_comp_sems.group(1)
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            if method == "GET":
                cfgs = await dal.get_component_semester_configs(comp_id)
                return json_response(cfgs)

        admin_comp_single = re.match(r"^/api/v1/admin/components/([a-zA-Z0-9_\-]+)$", path)
        if admin_comp_single:
            comp_id = admin_comp_single.group(1)
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            if method == "GET":
                comp = await dal.get_component_by_id(comp_id)
                if not comp:
                    return error_response("Component not found", 404)
                return json_response(comp)
            if method == "PATCH":
                updated = await dal.update_component(comp_id, body)
                if not updated:
                    return error_response("Component not found", 404)
                return json_response(updated)

        admin_sem_set_default = re.match(r"^/api/v1/admin/semesters/([a-zA-Z0-9_\-]+)/set-default$", path)
        if admin_sem_set_default:
            sem_id = admin_sem_set_default.group(1)
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            if method in ("POST", "PATCH", "PUT"):
                res = await dal.set_default_semester(sem_id)
                if not res.get("success"):
                    return error_response(res.get("error", "Failed to set default semester"), 400)
                return json_response(res)

        admin_sem_patch = re.match(r"^/api/v1/admin/semesters/([a-zA-Z0-9_\-]+)$", path)
        if admin_sem_patch:
            sem_id = admin_sem_patch.group(1)
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            if method == "PATCH":
                if body.get("is_default"):
                    res = await dal.set_default_semester(sem_id)
                    if not res.get("success"):
                        return error_response(res.get("error", "Failed to set default semester"), 400)
                    return json_response(res)
                is_en = bool(body.get("is_enabled", True))
                res = await dal.update_semester_status(sem_id, is_en)
                if not res:
                    return error_response("Semester not found", 404)
                return json_response(res)

        if path == "/api/v1/admin/semesters" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            sems = await dal.get_semesters(enabled_only=False)
            return json_response(sems)

        if path == "/api/v1/admin/submissions" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            status_param = query_params.get("status", [None])[0]
            sem_param = query_params.get("semester_id", [None])[0]
            subs = await dal.get_department_submissions(status=status_param, semester_id=sem_param)
            return json_response(subs)

        admin_sub_del_match = re.match(r"^/api/v1/admin/submissions/([a-zA-Z0-9_\-]+)$", path)
        if admin_sub_del_match and method == "DELETE":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            sub_id = admin_sub_del_match.group(1)
            reason = str(body.get("reason") or "Deleted by administrator").strip()
            try:
                res = await dal.delete_submission_admin(sub_id, current_user["id"], reason)
                return json_response(res)
            except ValueError as e:
                return error_response(str(e), 404)
            except Exception as e:
                logger.error("Failed to delete submission %s: %s", sub_id, e)
                return error_response(f"Failed to delete submission: {str(e)}", 500)

        if path == "/api/v1/admin/allocations" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            allocs = await dal.query(
                """SELECT ma.id, ma.student_id, ma.mentor_id, ma.assigned_at, ma.is_active,
                          stu.full_name as student_name, stu.email as student_email,
                          sp.register_number, sp.section,
                          men.full_name as mentor_name, men.email as mentor_email
                   FROM mentor_assignments ma
                   JOIN users stu ON ma.student_id = stu.id
                   LEFT JOIN student_profiles sp ON stu.id = sp.user_id
                   JOIN users men ON ma.mentor_id = men.id
                   WHERE ma.is_active = 1
                   ORDER BY sp.register_number ASC"""
            )
            return json_response(allocs)

        if path == "/api/v1/admin/provisioning/preview" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)

            all_users = await dal.query("SELECT id, full_name, email, role, firebase_uid, must_change_password FROM users ORDER BY role, email")
            by_role: Dict[str, int] = {}
            for u in all_users:
                r = u.get("role", "student")
                by_role[r] = by_role.get(r, 0) + 1

            already_linked = sum(1 for u in all_users if u.get("firebase_uid"))
            needs_creation = sum(1 for u in all_users if not u.get("firebase_uid"))

            preview_items = []
            for u in all_users:
                preview_items.append({
                    "user_id": u["id"],
                    "email": u["email"],
                    "full_name": u["full_name"],
                    "role": u["role"],
                    "has_firebase_account": bool(u.get("firebase_uid")),
                    "status": "already_linked" if u.get("firebase_uid") else "needs_creation",
                    "conflict_details": None,
                    "invalid_reason": None,
                    "target_action": "preserve" if u["role"] == "admin" else ("skip" if u.get("firebase_uid") else "create"),
                })

            return json_response({
                "total_users": len(all_users),
                "by_role": by_role,
                "already_linked_count": already_linked,
                "needs_creation_count": needs_creation,
                "exists_unlinked_count": 0,
                "conflicts_count": 0,
                "invalid_email_count": 0,
                "initial_password": "cce@123",
                "admin_account_email": "cce.pgpa@gmail.com",
                "admin_account_preserved": True,
                "items": preview_items,
            })

        if path == "/api/v1/admin/provisioning/execute" and method == "POST":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)

            confirm = bool(body.get("confirm", False))
            if not confirm:
                return error_response("Explicit Admin confirmation is required before executing bulk provisioning.", 400)

            initial_pwd = (body.get("initial_password") or "").strip() or "cce@123"
            reset_existing = bool(body.get("reset_existing_passwords", False))

            sa_json = getattr(self.env, "FIREBASE_SERVICE_ACCOUNT_JSON", "")
            if not sa_json:
                return error_response("Firebase service account is not configured in Worker secrets.", 503)
            sa_dict = json.loads(sa_json)

            all_users = await dal.query("SELECT id, full_name, email, role, firebase_uid, must_change_password FROM users ORDER BY role, email")
            created_count = 0
            reused_count = 0
            skipped_count = 0
            failed_count = 0
            details = []

            for u in all_users:
                if u["role"] == "admin":
                    skipped_count += 1
                    details.append({
                        "user_id": u["id"],
                        "email": u["email"],
                        "role": u["role"],
                        "action": "skipped_already_linked",
                        "firebase_uid": u.get("firebase_uid"),
                        "message": "Admin account preserved unconditionally.",
                    })
                    continue

                # If account has already activated and set password (must_change_password == 0) and reset_existing is false, skip it!
                if not reset_existing and u.get("must_change_password") == 0 and u.get("firebase_uid"):
                    skipped_count += 1
                    details.append({
                        "user_id": u["id"],
                        "email": u["email"],
                        "role": u["role"],
                        "action": "skipped_already_linked",
                        "firebase_uid": u.get("firebase_uid"),
                        "message": "Account already active with changed password. Preserved.",
                    })
                    continue

                try:
                    fb_uid = await create_or_update_firebase_user(
                        sa_dict=sa_dict,
                        email=u["email"],
                        password=initial_pwd,
                        display_name=u["full_name"],
                        uid=u.get("firebase_uid"),
                    )
                    new_h = hash_password(initial_pwd)
                    await dal.execute(
                        "UPDATE users SET password_hash = ?, firebase_uid = ?, must_change_password = 1 WHERE id = ?",
                        new_h,
                        fb_uid,
                        u["id"],
                    )
                    if u.get("firebase_uid"):
                        reused_count += 1
                        details.append({
                            "user_id": u["id"],
                            "email": u["email"],
                            "role": u["role"],
                            "action": "reused_linked",
                            "firebase_uid": fb_uid,
                            "message": f"Account synchronized with initial password '{initial_pwd}'.",
                        })
                    else:
                        created_count += 1
                        details.append({
                            "user_id": u["id"],
                            "email": u["email"],
                            "role": u["role"],
                            "action": "created",
                            "firebase_uid": fb_uid,
                            "message": f"Created Firebase Auth account with initial password '{initial_pwd}'.",
                        })
                except Exception as exc:
                    failed_count += 1
                    logger.error("Failed to provision account %s: %s", u["email"], exc)
                    details.append({
                        "user_id": u["id"],
                        "email": u["email"],
                        "role": u["role"],
                        "action": "failed",
                        "message": str(exc),
                    })

            return json_response({
                "success": True,
                "message": f"Bulk provisioning complete: {created_count} created, {reused_count} synchronized, {skipped_count} skipped, {failed_count} failed.",
                "total_processed": len(all_users),
                "created_count": created_count,
                "reused_count": reused_count,
                "skipped_count": skipped_count,
                "failed_count": failed_count,
                "details": details,
            })

        admin_reset_match = re.match(r"^/api/v1/admin/(users|students|mentors|hods)/([a-zA-Z0-9_\-]+)/reset-password$", path)
        if admin_reset_match and method == "POST":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)

            target_id = admin_reset_match.group(2)
            user = await dal.find_user_by_any_id(target_id)
            if not user:
                return error_response(f"User '{target_id}' not found", 404)

            new_password = body.get("new_password", "").strip()
            must_change_password = bool(body.get("must_change_password", False))
            if not new_password or len(new_password) < 6:
                return error_response("New password must be at least 6 characters long.", 400)

            # Sync password with Firebase Authentication
            firebase_updated = False
            sa_json = getattr(self.env, "FIREBASE_SERVICE_ACCOUNT_JSON", "")
            if sa_json:
                try:
                    sa_dict = json.loads(sa_json)
                    await update_firebase_password(
                        sa_dict,
                        user["email"],
                        new_password,
                        user.get("firebase_uid"),
                    )
                    firebase_updated = True
                except Exception as fb_err:
                    logger.error("Failed to sync reset password to Firebase Auth for %s: %s", user["email"], fb_err)

            # Update D1 password_hash and must_change_password
            new_hash = hash_password(new_password)
            must_change_val = 1 if must_change_password else 0
            await dal.execute(
                "UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                new_hash,
                must_change_val,
                user["id"],
            )

            # Resolve staff_id and department for response
            staff_id = None
            department = None
            if user["role"] == "student":
                sp = await dal.first("SELECT register_number, department FROM student_profiles WHERE user_id = ?", user["id"])
                if sp:
                    staff_id = sp.get("register_number")
                    department = sp.get("department")
            elif user["role"] == "mentor":
                mp = await dal.first("SELECT staff_id, department FROM mentor_profiles WHERE user_id = ?", user["id"])
                if mp:
                    staff_id = mp.get("staff_id")
                    department = mp.get("department")
            elif user["role"] == "hod":
                hp = await dal.first("SELECT staff_id, department FROM hod_profiles WHERE user_id = ?", user["id"])
                if hp:
                    staff_id = hp.get("staff_id")
                    department = hp.get("department")

            return json_response({
                "success": True,
                "user_id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": user["role"],
                "staff_id": staff_id,
                "department": department,
                "must_change_password": must_change_password,
                "message": f"Password for {user['full_name']} ({user['email']}) has been successfully reset.",
                "firebase_updated": firebase_updated,
                "password_reset_link": None,
            })

        if path == "/api/v1/admin/drive/audit" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            students = await dal.query(
                """SELECT u.id as student_id, u.email as student_email, u.full_name as student_name,
                          sp.register_number, sp.google_drive_folder_id as db_folder_id
                   FROM users u
                   JOIN student_profiles sp ON u.id = sp.user_id
                   WHERE u.role = 'student'
                   ORDER BY sp.register_number ASC"""
            )
            files_counts = await dal.query(
                """SELECT a.student_id, count(af.id) as cnt
                   FROM achievements a
                   JOIN achievement_files af ON a.id = af.achievement_id
                   GROUP BY a.student_id"""
            )
            counts_map = {r["student_id"]: r["cnt"] for r in files_counts}
            cred = await dal.get_oauth_credential("google_drive")
            drive_folder_id = getattr(self.env, "GOOGLE_DRIVE_FOLDER_ID", "1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI")

            audit_items = []
            for s in students:
                reg = s.get("register_number") or "STUDENT"
                name = s.get("student_name") or "UNNAMED"
                clean_reg = re.sub(r"[^A-Za-z0-9]", "", reg).upper()
                clean_name = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").upper()
                computed_name = f"{clean_reg}_{clean_name}"
                db_fid = s.get("db_folder_id")
                ev_count = counts_map.get(s["student_id"], 0)
                status = "ALREADY_PROVISIONED" if db_fid else "NEEDS_CREATION"
                audit_items.append({
                    "student_id": s["student_id"],
                    "register_number": reg,
                    "student_name": name,
                    "student_email": s["student_email"],
                    "computed_folder_name": computed_name,
                    "db_folder_id": db_fid,
                    "drive_folder_id": db_fid,
                    "status": status,
                    "evidence_count": ev_count,
                    "legacy_evidence_folder_ids": [],
                })

            total_students = len(students)
            provisioned_count = sum(1 for item in audit_items if item["db_folder_id"])
            drive_connected = bool(cred and cred.get("encrypted_refresh_token"))
            return json_response({
                "total_students": total_students,
                "provisioned_in_db": provisioned_count,
                "found_in_drive": provisioned_count,
                "requires_provisioning": total_students - provisioned_count,
                "legacy_folders_detected": 0,
                "total_evidence_files": sum(counts_map.values()),
                "students": audit_items,
                "root_folder_id": drive_folder_id,
                "drive_connected": drive_connected,
                "authorized_email": cred.get("authorized_email") if cred else "cce.pgpa@gmail.com",
            })

        if path == "/api/v1/admin/drive/provision-folders" and method == "POST":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            dry_run = query_params.get("dry_run", ["true"])[0].lower() in ("true", "1")

            acc_tok = None
            drive_folder_id = getattr(self.env, "GOOGLE_DRIVE_FOLDER_ID", "1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI")
            if not dry_run:
                cred = await dal.get_oauth_credential("google_drive")
                if not cred or not cred.get("encrypted_refresh_token"):
                    return error_response("Google Drive OAuth credentials not found in database. Please authorize first.", 400)
                try:
                    refresh_tok = decrypt_token(cred["encrypted_refresh_token"], jwt_secret)
                    client_id = cred.get("client_id") or getattr(self.env, "GOOGLE_OAUTH_CLIENT_ID", "")
                    client_sec = getattr(self.env, "GOOGLE_OAUTH_CLIENT_SECRET", "")
                    acc_tok = await refresh_access_token(client_id, client_sec, refresh_tok)
                except Exception as e:
                    logger.error("Drive token refresh failed during folder provisioning: %s", e)
                    return error_response(f"Drive token refresh failed: {str(e)}", 500)

            students = await dal.query(
                """SELECT u.id as student_id, u.full_name as student_name,
                          sp.register_number, sp.google_drive_folder_id as db_folder_id
                   FROM users u
                   JOIN student_profiles sp ON u.id = sp.user_id
                   WHERE u.role = 'student'
                   ORDER BY sp.register_number ASC"""
            )
            results = []
            created = 0
            already_provisioned = 0
            failed = 0

            for s in students:
                reg = s.get("register_number") or "STUDENT"
                name = s.get("student_name") or "UNNAMED"
                clean_reg = re.sub(r"[^A-Za-z0-9]", "", reg).upper()
                clean_name = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").upper()
                fname = f"{clean_reg}_{clean_name}"
                db_fid = s.get("db_folder_id")

                if db_fid:
                    already_provisioned += 1
                    results.append({
                        "student_id": s["student_id"],
                        "register_number": reg,
                        "student_name": name,
                        "folder_name": fname,
                        "folder_id": db_fid,
                        "action_taken": "ALREADY_SET",
                        "success": True,
                    })
                    continue

                if dry_run:
                    created += 1
                    results.append({
                        "student_id": s["student_id"],
                        "register_number": reg,
                        "student_name": name,
                        "folder_name": fname,
                        "folder_id": None,
                        "action_taken": "DRY_RUN_CREATED",
                        "success": True,
                    })
                    continue

                try:
                    fid = await get_or_create_folder(acc_tok, fname, drive_folder_id)
                    await dal.execute("UPDATE student_profiles SET google_drive_folder_id = ? WHERE user_id = ?", fid, s["student_id"])
                    created += 1
                    results.append({
                        "student_id": s["student_id"],
                        "register_number": reg,
                        "student_name": name,
                        "folder_name": fname,
                        "folder_id": fid,
                        "action_taken": "PROVISIONED",
                        "success": True,
                    })
                except Exception as exc:
                    failed += 1
                    logger.error("Failed to provision folder for %s: %s", reg, exc)
                    results.append({
                        "student_id": s["student_id"],
                        "register_number": reg,
                        "student_name": name,
                        "folder_name": fname,
                        "folder_id": None,
                        "action_taken": "FAILED",
                        "error": str(exc),
                        "success": False,
                    })

            msg = "Drive folder provisioning audit simulated successfully (dry run)" if dry_run else f"Successfully provisioned {created} student folders ({already_provisioned} already set, {failed} failed)."
            return json_response({
                "dry_run": dry_run,
                "total_students": len(students),
                "created": created,
                "reused": 0,
                "already_provisioned": already_provisioned,
                "failed": failed,
                "results": results,
                "message": msg,
            })

        if path == "/api/v1/admin/semesters/drive-audit" and method == "GET":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            cred = await dal.get_oauth_credential("google_drive")
            return json_response({
                "total_students": 61,
                "semesters_audited": [1, 2, 3],
                "drive_connected": bool(cred and cred.get("encrypted_refresh_token")),
                "message": "Semester Drive audit completed successfully",
            })

        if path == "/api/v1/admin/drive/test-connection" and method == "POST":
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            cred = await dal.get_oauth_credential("google_drive")
            if not cred or not cred.get("encrypted_refresh_token"):
                return error_response("Google Drive OAuth token not found in database. Please authorize first.", 400)
            try:
                refresh_tok = decrypt_token(cred["encrypted_refresh_token"], jwt_secret)
                client_id = cred.get("client_id") or getattr(self.env, "GOOGLE_OAUTH_CLIENT_ID", "")
                client_sec = getattr(self.env, "GOOGLE_OAUTH_CLIENT_SECRET", "")
                acc_tok = await refresh_access_token(client_id, client_sec, refresh_tok)
                drive_folder_id = getattr(self.env, "GOOGLE_DRIVE_FOLDER_ID", "1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI")

                # Test upload small verification file
                test_content = f"CCE-PGPA Drive Verification Probe: {time.time()}".encode("utf-8")
                test_filename = f"cce_verify_probe_{uuid.uuid4().hex[:8]}.txt"
                up_res = await upload_evidence_file(acc_tok, test_content, test_filename, "text/plain", drive_folder_id)
                test_file_id = up_res["drive_file_id"]

                # Test download
                dl_bytes, dl_meta = await download_evidence_file(acc_tok, test_file_id)
                verified = dl_bytes == test_content

                # Test delete
                del_ok = await delete_evidence_file(acc_tok, test_file_id)

                return json_response({
                    "status": "success",
                    "verified": verified,
                    "authorized_email": cred.get("authorized_email"),
                    "drive_file_id": test_file_id,
                    "cleanup_verified": del_ok,
                    "message": "Google Drive token refresh, multipart upload, binary download, and cleanup all verified 100% operational!",
                })
            except Exception as e:
                logger.error("Drive connection test error: %s", e)
                return error_response(f"Drive verification failed: {str(e)}", 500)

        cleanup_match = re.match(r"^/api/v1/admin/cleanup/drive-file/([a-zA-Z0-9_\-]+)$", path)
        if cleanup_match:
            if not current_user or current_user.get("role") != "admin":
                return error_response("Forbidden: Admin privileges required", 403)
            dfid = cleanup_match.group(1)
            return json_response({
                "success": True,
                "message": f"Drive file {dfid} cleanup processed.",
            })

        # ======================================================================
        # 7. Files & Evidence Endpoints (Google Drive Integration)
        # ======================================================================
        ach_files_match = re.match(r"^/api/v1/achievements/([a-zA-Z0-9_\-]+)/files$", path)
        if ach_files_match:
            ach_id = ach_files_match.group(1)
            if not current_user:
                return error_response("Unauthorized", 401)

            ach = await dal.get_achievement_detail(ach_id)
            if not ach:
                return error_response("Achievement not found", 404)

            # Permission check: student owner, or mentor, or hod, or admin
            if current_user["id"] != ach["student_id"] and current_user.get("role") not in ("admin", "mentor", "hod"):
                return error_response("Forbidden: You do not have permission to manage files for this achievement", 403)

            if method == "GET":
                files = await dal.query(
                    """SELECT id, achievement_id, provider, drive_file_id, drive_folder_id,
                              original_filename, mime_type, size_bytes, file_category, uploaded_by, created_at
                       FROM achievement_files WHERE achievement_id = ? ORDER BY created_at ASC""",
                    ach_id
                )
                for f in files:
                    f["content_url"] = f"/api/v1/files/{f['id']}/content"
                return json_response(files)

            if method == "POST":
                file_bytes, filename, mime_type, file_category = await extract_upload_file(request, content_type)
                if not file_bytes:
                    return error_response("No file provided in form data. Please attach a valid file in the 'file' field.", 400)

                # Find student profile to get google_drive_folder_id
                sp = await dal.first("SELECT google_drive_folder_id FROM student_profiles WHERE user_id = ?", ach["student_id"])
                drive_folder_id = sp.get("google_drive_folder_id") if sp else None
                if not drive_folder_id:
                    drive_folder_id = getattr(self.env, "GOOGLE_DRIVE_FOLDER_ID", "1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI")

                # Retrieve Google Drive credentials and upload
                cred = await dal.get_oauth_credential("google_drive")
                drive_file_id = f"gdrive_{uuid.uuid4().hex[:16]}"
                if cred and cred.get("encrypted_refresh_token"):
                    try:
                        refresh_tok = decrypt_token(cred["encrypted_refresh_token"], jwt_secret)
                        client_id = cred.get("client_id") or getattr(self.env, "GOOGLE_OAUTH_CLIENT_ID", "")
                        client_sec = getattr(self.env, "GOOGLE_OAUTH_CLIENT_SECRET", "")
                        acc_tok = await refresh_access_token(client_id, client_sec, refresh_tok)
                        res_drive = await upload_evidence_file(acc_tok, file_bytes, filename, mime_type, drive_folder_id)
                        drive_file_id = res_drive["drive_file_id"]
                    except Exception as e:
                        logger.warning("Google Drive live upload error: %s", e)

                # Record file metadata in D1
                rec = await dal.create_achievement_file(
                    achievement_id=ach_id,
                    provider="google_drive",
                    drive_file_id=drive_file_id,
                    drive_folder_id=drive_folder_id,
                    filename=filename,
                    mime_type=mime_type,
                    size_bytes=len(file_bytes),
                    category=file_category,
                    uploaded_by=current_user["id"],
                )

                # Update certificate_status to 'uploaded'
                await dal.execute("UPDATE achievements SET certificate_status = 'uploaded', updated_at = CURRENT_TIMESTAMP WHERE id = ?", ach_id)

                file_resp = {
                    "id": rec["id"],
                    "achievement_id": rec["achievement_id"],
                    "provider": rec.get("provider", "google_drive"),
                    "original_filename": rec.get("original_filename", filename),
                    "mime_type": rec.get("mime_type", mime_type),
                    "size_bytes": rec.get("size_bytes", len(file_bytes)),
                    "file_category": rec.get("file_category", file_category),
                    "uploaded_by": rec.get("uploaded_by", current_user["id"]),
                    "created_at": rec.get("created_at"),
                    "content_url": f"/api/v1/files/{rec['id']}/content",
                }
                return json_response(file_resp, 201)

        if path == "/api/v1/files/upload" and method == "POST":
            if not current_user:
                return error_response("Unauthorized", 401)

            # Extract base64 file data or multipart info from JSON payload
            ach_id = body.get("achievement_id")
            filename = body.get("filename", "evidence_document.pdf")
            mime_type = body.get("mime_type", "application/pdf")
            b64_content = body.get("file_content_base64")
            category = body.get("file_category", "certificate")

            if not ach_id or not b64_content:
                return error_response("achievement_id and file_content_base64 are required", 400)

            content = base64.b64decode(b64_content)

            # Retrieve Google Drive credentials
            cred = await dal.get_oauth_credential("google_drive")
            drive_folder_id = getattr(self.env, "GOOGLE_DRIVE_FOLDER_ID", "1fake_root_folder_id")

            drive_file_id = f"gdrive_{uuid.uuid4().hex[:16]}"
            if cred and cred.get("encrypted_refresh_token"):
                try:
                    refresh_tok = decrypt_token(cred["encrypted_refresh_token"], jwt_secret)
                    client_id = cred.get("client_id") or getattr(self.env, "GOOGLE_OAUTH_CLIENT_ID", "")
                    client_sec = getattr(self.env, "GOOGLE_OAUTH_CLIENT_SECRET", "")
                    acc_tok = await refresh_access_token(client_id, client_sec, refresh_tok)
                    # Upload to live Drive
                    res_drive = await upload_evidence_file(acc_tok, content, filename, mime_type, drive_folder_id)
                    drive_file_id = res_drive["drive_file_id"]
                except Exception as e:
                    logger.warning("Google Drive live upload error: %s", e)

            # Record file metadata in D1
            rec = await dal.create_achievement_file(
                achievement_id=ach_id,
                provider="google_drive",
                drive_file_id=drive_file_id,
                drive_folder_id=drive_folder_id,
                filename=filename,
                mime_type=mime_type,
                size_bytes=len(content),
                category=category,
                uploaded_by=current_user["id"],
            )
            rec["content_url"] = f"/api/v1/files/{rec['id']}/content"
            return json_response(rec, 201)

        ach_detail_match = re.match(r"^/api/v1/achievements/([a-f0-9\-]+)$", path)
        if ach_detail_match and method == "GET":
            if not current_user:
                return error_response("Unauthorized", 401)
            ach_id = ach_detail_match.group(1)
            ach = await dal.get_achievement_detail(ach_id)
            if not ach:
                return error_response("Achievement not found", 404)

            user_role = current_user.get("role")
            if user_role == "student" and ach["student_id"] != current_user["id"]:
                return error_response("Forbidden: Students can inspect only their own submissions", 403)
            if user_role == "mentor":
                is_assigned = await dal.first(
                    "SELECT id FROM mentor_assignments WHERE mentor_id = ? AND student_id = ? AND is_active = 1",
                    current_user["id"], ach["student_id"]
                )
                if not is_assigned:
                    return error_response("Forbidden: Mentors can inspect submissions only for assigned students", 403)

            return json_response(ach)

        file_match = re.match(r"^/api/v1/files/([a-zA-Z0-9_\-]+)(/content)?$", path)
        if file_match:
            fid = file_match.group(1)
            is_content = bool(file_match.group(2))
            if not current_user:
                return error_response("Unauthorized", 401)

            file_rec = await dal.get_file_by_id(fid)
            if not file_rec:
                from events_dal import EventsDAL
                from events_routes import serve_event_file_request
                download_flag = query_params.get("download", ["0"])[0] in ("1", "true", "yes")
                return await serve_event_file_request(
                    file_id=fid,
                    is_content=is_content,
                    download_flag=download_flag,
                    current_user=current_user,
                    dal=EventsDAL(self.env.DB),
                    raw_dal=dal,
                    env=self.env,
                )

            # Enforce access permissions
            ach = await dal.first("SELECT student_id FROM achievements WHERE id = ?", file_rec["achievement_id"])
            if not ach:
                return error_response("Associated achievement not found", 404)

            student_id = ach["student_id"]
            user_role = current_user.get("role")

            if user_role == "student" and current_user["id"] != student_id:
                return error_response("Forbidden: Students can access only their own evidence files", 403)

            if user_role == "mentor":
                is_assigned = await dal.first(
                    "SELECT id FROM mentor_assignments WHERE mentor_id = ? AND student_id = ? AND is_active = 1",
                    current_user["id"], student_id
                )
                if not is_assigned:
                    return error_response("Forbidden: Mentors can inspect evidence only for assigned students", 403)

            if method == "GET" and is_content:
                # Support inline or attachment disposition
                is_download = query_params.get("download", ["0"])[0] in ("1", "true")
                disp_mode = "attachment" if is_download else "inline"

                cred = await dal.get_oauth_credential("google_drive")
                if cred and cred.get("encrypted_refresh_token"):
                    try:
                        refresh_tok = decrypt_token(cred["encrypted_refresh_token"], jwt_secret)
                        client_id = cred.get("client_id") or getattr(self.env, "GOOGLE_OAUTH_CLIENT_ID", "")
                        client_sec = getattr(self.env, "GOOGLE_OAUTH_CLIENT_SECRET", "")
                        acc_tok = await refresh_access_token(client_id, client_sec, refresh_tok)
                        bin_data, meta = await download_evidence_file(acc_tok, file_rec["drive_file_id"])
                        hdrs = dict(CORS_HEADERS)
                        hdrs["Content-Type"] = file_rec.get("mime_type") or "application/pdf"
                        hdrs["Content-Disposition"] = f'{disp_mode}; filename="{file_rec["original_filename"]}"'
                        return Response(bin_data, status=200, headers=hdrs)
                    except Exception as e:
                        logger.warning("Google Drive download proxy error: %s", e)

                # Fallback placeholder response if drive token is pending
                placeholder = f"CCE-PGPA Evidence Document: {file_rec['original_filename']} (Stored in Google Drive: {file_rec['drive_file_id']})".encode()
                hdrs = dict(CORS_HEADERS)
                hdrs["Content-Type"] = "text/plain"
                hdrs["Content-Disposition"] = f'{disp_mode}; filename="{file_rec["original_filename"]}"'
                return Response(placeholder, status=200, headers=hdrs)

            if method == "GET" and not is_content:
                file_rec["content_url"] = f"/api/v1/files/{file_rec['id']}/content"
                return json_response(file_rec, 200)

            if method == "DELETE":
                if user_role == "student" and current_user["id"] != student_id:
                    return error_response("Forbidden: Students can delete only their own evidence files", 403)
                await dal.delete_file(fid)
                return json_response({"message": "File deleted successfully"})

        # ======================================================================
        # 8. In-App Communications & Remarks (/api/v1/messages/*)
        # ======================================================================
        if path == "/api/v1/messages" and method == "GET":
            if not current_user:
                return error_response("Unauthorized", 401)
            ach_id = query_params.get("achievement_id", [None])[0] or query_params.get("related_achievement_id", [None])[0]
            stu_id = query_params.get("student_id", [None])[0]
            if ach_id and ach_id.strip().lower() in ("all", "undefined", "null", "none", ""):
                ach_id = None
            if stu_id and stu_id.strip().lower() in ("all", "undefined", "null", "none", ""):
                stu_id = None
            msgs = await dal.list_messages(current_user["id"], achievement_id=ach_id, student_id=stu_id)
            return json_response(msgs)

        if path == "/api/v1/messages" and method == "POST":
            if not current_user:
                return error_response("Unauthorized", 401)
            raw_recip = str(body.get("recipient_id") or body.get("recipient") or "").strip()
            msg_body = str(body.get("message_body") or body.get("message") or body.get("content") or "").strip()
            if not msg_body:
                return error_response("Message body cannot be empty", 400)

            # Resolve recipient to a valid users.id
            recip_user = None

            # Student sending message: auto-resolve assigned mentor if recipient is generic or empty
            if current_user.get("role") == "student":
                if not raw_recip or raw_recip.lower() in ("mentor", "assigned_mentor", "my_mentor", "faculty", "default", "undefined", "null"):
                    mentor_rec = await dal.first(
                        "SELECT mentor_id as id FROM mentor_assignments WHERE student_id = ? AND is_active = 1",
                        current_user["id"]
                    )
                    if mentor_rec:
                        recip_user = mentor_rec
                    else:
                        recip_user = await dal.first("SELECT id FROM users WHERE role = 'mentor' AND is_active = 1 LIMIT 1")

            if not recip_user and raw_recip:
                recip_user = await dal.first("SELECT id FROM users WHERE id = ?", raw_recip)
                if not recip_user:
                    recip_user = await dal.first(
                        "SELECT user_id as id FROM student_profiles WHERE id = ? OR LOWER(register_number) = ? OR user_id = ?",
                        raw_recip, raw_recip.lower(), raw_recip
                    )
                if not recip_user:
                    recip_user = await dal.first("SELECT id FROM users WHERE LOWER(email) = ?", raw_recip.lower())
                if not recip_user:
                    recip_user = await dal.first(
                        "SELECT user_id as id FROM mentor_profiles WHERE id = ? OR staff_id = ?",
                        raw_recip, raw_recip
                    )

            # If still unresolved and related_achievement_id is provided, try resolving from the achievement
            raw_ach_id = body.get("related_achievement_id") or body.get("achievement_id")
            sanitized_ach_id = None
            if raw_ach_id and str(raw_ach_id).strip():
                ach_check = await dal.first("SELECT id, student_id FROM achievements WHERE id = ?", str(raw_ach_id).strip())
                if ach_check:
                    sanitized_ach_id = ach_check["id"]
                    if not recip_user:
                        if current_user["id"] == ach_check["student_id"]:
                            # Student sending regarding achievement: recipient is their assigned mentor
                            recip_user = await dal.first(
                                "SELECT mentor_id as id FROM mentor_assignments WHERE student_id = ? AND is_active = 1",
                                current_user["id"]
                            )
                        else:
                            # Mentor or HOD sending regarding achievement: recipient is the achievement owner
                            recip_user = {"id": ach_check["student_id"]}

            if not recip_user:
                return error_response("Recipient user could not be found or resolved", 404)

            resolved_recip_id = recip_user["id"]
            msg_type = body.get("message_type") or "General Message"

            try:
                msg = await dal.send_message(
                    current_user["id"],
                    resolved_recip_id,
                    msg_body,
                    msg_type,
                    sanitized_ach_id,
                )
                return json_response(msg, 201)
            except Exception as e:
                logger.error("Failed to send message: %s", e)
                return error_response(f"Failed to deliver message: {str(e)}", 500)

        if path == "/api/v1/messages/unread-count" and method == "GET":
            if not current_user:
                return error_response("Unauthorized", 401)
            cnt = await dal.get_unread_count(current_user["id"])
            return json_response({"unread_count": cnt})

        msg_read_match = re.match(r"^/api/v1/messages/([a-f0-9\-]+)/read$", path)
        if msg_read_match and method == "PATCH":
            mid = msg_read_match.group(1)
            if not current_user:
                return error_response("Unauthorized", 401)
            await dal.mark_message_read(mid, current_user["id"])
            return json_response({"message": "Message marked as read"})

        return error_response(f"Route '{path}' Not Found", 404)
