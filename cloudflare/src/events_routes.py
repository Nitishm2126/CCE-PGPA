import base64
import email
import email.policy
import json
import logging
import re
import urllib.parse
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
try:
    from workers import Response
except ImportError:
    class Response:
        def __init__(self, body: Any = "", status: int = 200, headers: Optional[Dict[str, str]] = None):
            self.body = body
            self.status = status
            self.headers = headers or {}

from events_dal import EventsDAL
from drive import (
    refresh_access_token,
    upload_evidence_file,
    download_evidence_file,
    get_or_create_folder,
    resolve_student_drive_folder,
    resolve_student_event_folder,
)
from security import decrypt_token

logger = logging.getLogger("cce_events_routes")


def get_cors_headers() -> Dict[str, str]:
    try:
        from main import get_cors_headers as _gch
        return _gch()
    except Exception:
        return {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
        }


def json_response(data: Any, status: int = 200, extra_headers: Optional[Dict[str, str]] = None) -> Response:
    headers = get_cors_headers()
    headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    return Response(json.dumps(data, default=str), status=status, headers=headers)


def error_response(detail: str, status: int = 400) -> Response:
    return json_response({"detail": detail}, status=status)


async def _extract_event_upload(
    request: Any,
    content_type: str,
) -> Tuple[Optional[bytes], str, str, Dict[str, str]]:
    file_bytes: Optional[bytes] = None
    filename = "event_upload.pdf"
    mime_type = "application/pdf"
    extra_fields: Dict[str, str] = {}

    raw_bytes: Optional[bytes] = None
    try:
        if hasattr(request, "bytes"):
            b = await request.bytes()
            if hasattr(b, "to_py"):
                raw_bytes = bytes(b.to_py())
            elif isinstance(b, (bytes, bytearray)):
                raw_bytes = bytes(b)
    except Exception as ex_b:
        logger.debug("event request.bytes() exception: %s", ex_b)

    if raw_bytes is None:
        try:
            if hasattr(request, "arrayBuffer"):
                ab = await request.arrayBuffer()
                import js
                u8 = js.Uint8Array.new(ab)
                raw_bytes = bytes(u8.to_py())
        except Exception as ex_ab:
            logger.debug("event request.arrayBuffer() exception: %s", ex_ab)

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
                elif pname:
                    val_b = part.get_payload(decode=True)
                    if val_b is not None:
                        extra_fields[pname] = val_b.decode("utf-8", errors="ignore").strip()
        except Exception as ex_mp:
            logger.warning("Multipart email parser warning in events upload: %s", ex_mp)

    if not file_bytes:
        try:
            if hasattr(request, "formData"):
                form = await request.formData()
                for fk in ("event_id", "field_key", "upload_scope", "file_category", "file_name", "mime_type"):
                    try:
                        fv = form.get(fk)
                        if fv is not None:
                            extra_fields[fk] = str(fv).strip()
                    except Exception:
                        pass
                file_item = form.get("file")
                if file_item:
                    if hasattr(file_item, "name"):
                        filename = str(file_item.name)
                    if hasattr(file_item, "type") and file_item.type:
                        mime_type = str(file_item.type)
                    ab = await file_item.arrayBuffer()
                    import js
                    u8 = js.Uint8Array.new(ab)
                    file_bytes = bytes(u8.to_py())
        except Exception as ex_fd:
            logger.debug("request.formData() fallback in events upload: %s", ex_fd)

    if not file_bytes:
        try:
            from main import extract_upload_file
            fb, fn, mt, cat = await extract_upload_file(request, content_type)
            if fb:
                file_bytes = fb
                filename = fn or filename
                mime_type = mt or mime_type
                if cat:
                    extra_fields.setdefault("upload_scope", cat)
        except Exception as ex_ex:
            logger.debug("extract_upload_file fallback in events upload: %s", ex_ex)

    return file_bytes, filename, mime_type, extra_fields


async def _get_drive_access_token(
    dal: EventsDAL,
    raw_dal: Any,
    env: Any,
) -> Tuple[Optional[str], str, bool, Optional[str]]:
    root_folder_id = str(getattr(env, "GOOGLE_DRIVE_FOLDER_ID", "") or "").strip()
    client_id = str(getattr(env, "GOOGLE_OAUTH_CLIENT_ID", "") or "").strip()
    client_sec = str(getattr(env, "GOOGLE_OAUTH_CLIENT_SECRET", "") or "").strip()
    jwt_secret = str(getattr(env, "JWT_SECRET_KEY", "cce-pgpa-super-secret-key-32-chars-staging") or "")

    refresh_tok = ""
    cred = None
    try:
        if raw_dal and hasattr(raw_dal, "get_oauth_credential"):
            cred = await raw_dal.get_oauth_credential("google_drive")
        else:
            cred = await dal.first(
                "SELECT * FROM oauth_credentials WHERE provider = 'google_drive' ORDER BY updated_at DESC LIMIT 1"
            )
    except Exception as ex_cred:
        logger.debug("OAuth credentials lookup error: %s", ex_cred)

    if cred and cred.get("encrypted_refresh_token"):
        try:
            refresh_tok = decrypt_token(cred["encrypted_refresh_token"], jwt_secret)
        except Exception as ex_dec:
            return None, root_folder_id, True, f"Unable to decrypt Google Drive credential: {ex_dec}"

    if not refresh_tok:
        refresh_tok = str(getattr(env, "GOOGLE_DRIVE_REFRESH_TOKEN", "") or "").strip()

    if not refresh_tok:
        return None, root_folder_id, False, None

    if not client_id or not client_sec:
        return None, root_folder_id, True, "Google OAuth client credentials are not configured on the worker."

    try:
        acc_tok = await refresh_access_token(client_id, client_sec, refresh_tok)
        return acc_tok, root_folder_id, True, None
    except Exception as ex_tok:
        return None, root_folder_id, True, str(ex_tok)


async def _validate_upload_against_field(
    dal: EventsDAL,
    event_id: Optional[str],
    field_key: Optional[str],
    filename: str,
    mime_type: str,
    file_size: int,
) -> Optional[str]:
    if not event_id or not field_key:
        return None
    try:
        curr_form = await dal.get_current_form_version(event_id)
        if not curr_form:
            return None
        target_field = None
        for f in curr_form.get("fields", []):
            if f.get("field_key") == field_key:
                target_field = f
                break
        if not target_field:
            return None

        val_cfg = target_field.get("validation_config") or {}
        if isinstance(val_cfg, str):
            try:
                val_cfg = json.loads(val_cfg)
            except Exception:
                val_cfg = {}

        max_mb = val_cfg.get("max_size_mb") or target_field.get("max_size_mb")
        if max_mb:
            max_bytes = min(float(max_mb), 15.0) * 1024 * 1024
            if file_size > max_bytes:
                return f"File exceeds configured limit ({max_mb} MB) for '{target_field.get('label', field_key)}'."

        allowed_types = val_cfg.get("allowed_types") or target_field.get("allowed_types")
        if isinstance(allowed_types, str):
            allowed_types = [t.strip() for t in allowed_types.split(",") if t.strip()]
        if isinstance(allowed_types, list) and len(allowed_types) > 0:
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            norm_allowed = [str(a).strip().lower().lstrip(".") for a in allowed_types]
            ext_aliases = {
                "jpg": ("jpg", "jpeg", "image/jpeg", "image/*"),
                "jpeg": ("jpg", "jpeg", "image/jpeg", "image/*"),
                "png": ("png", "image/png", "image/*"),
                "webp": ("webp", "image/webp", "image/*"),
                "gif": ("gif", "image/gif", "image/*"),
                "pdf": ("pdf", "application/pdf"),
                "doc": ("doc", "application/msword"),
                "docx": ("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                "xls": ("xls", "application/vnd.ms-excel"),
                "xlsx": ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                "csv": ("csv", "text/csv"),
                "txt": ("txt", "text/plain"),
            }
            candidates = {ext, mime_type.lower()}
            if ext in ext_aliases:
                candidates.update(ext_aliases[ext])
            if not any(c in norm_allowed for c in candidates):
                return (
                    f"File type '.{ext or mime_type}' is not allowed for '{target_field.get('label', field_key)}'. "
                    f"Allowed types: {', '.join(allowed_types)}"
                )
    except Exception as ex_val:
        logger.debug("Field validation check skipped due to error: %s", ex_val)
    return None


async def serve_event_file_request(
    file_id: str,
    is_content: bool,
    download_flag: bool,
    current_user: Optional[Dict[str, Any]],
    dal: EventsDAL,
    raw_dal: Any,
    env: Any,
) -> Response:
    if not current_user:
        return error_response("Unauthorized: Please log in to access this file", 401)

    file_rec = await dal.get_event_file(file_id)
    if not file_rec:
        return error_response("File not found", 404)

    role = str(current_user.get("token_role") or current_user.get("role") or "").lower()
    user_id = str(current_user.get("id") or current_user.get("user_id") or "")
    scope = str(file_rec.get("file_scope") or "student_submission").lower()

    if role in ("admin", "hod"):
        pass
    elif role == "student":
        if scope == "event_media" and not file_rec.get("student_id"):
            if file_rec.get("event_id"):
                evt = await dal.get_event(file_rec["event_id"])
                if not evt or evt.get("status") != "published":
                    return error_response("Forbidden: Event is not published", 403)
                is_eligible = await dal.check_student_eligibility(file_rec["event_id"], user_id)
                if not is_eligible:
                    return error_response("Forbidden: You are not eligible to access this event file", 403)
        else:
            owner_id = str(file_rec.get("student_id") or "")
            uploader_id = str(file_rec.get("uploaded_by") or "")
            if user_id not in (owner_id, uploader_id) or not user_id:
                return error_response("Forbidden: You do not have permission to access this student file", 403)
    else:
        return error_response("Forbidden: Insufficient permissions", 403)

    resolved_id = file_rec.get("id") or file_id
    if not is_content:
        return json_response({
            "id": resolved_id,
            "drive_file_id": file_rec.get("drive_file_id"),
            "drive_folder_id": file_rec.get("drive_folder_id"),
            "original_filename": file_rec.get("original_filename"),
            "mime_type": file_rec.get("mime_type"),
            "file_size": file_rec.get("file_size"),
            "file_scope": scope,
            "event_id": file_rec.get("event_id"),
            "student_id": file_rec.get("student_id"),
            "file_url": f"/api/v1/events/files/{resolved_id}/content",
            "download_url": f"/api/v1/events/files/{resolved_id}/content?download=1",
        })

    drive_file_id = str(file_rec.get("drive_file_id") or "")
    if not drive_file_id or drive_file_id.startswith(("local_", "evt_")):
        return error_response(
            "File binary content is unavailable because this file was stored in offline test mode without Google Drive connected.",
            404,
        )

    acc_tok, _, has_creds, drive_err = await _get_drive_access_token(dal, raw_dal, env)
    if not has_creds or drive_err or not acc_tok:
        return error_response(
            f"Google Drive is unavailable to retrieve this file: {drive_err or 'Drive OAuth not connected'}",
            502,
        )

    try:
        file_bytes, dl_meta = await download_evidence_file(acc_tok, drive_file_id)
        dl_mime = dl_meta.get("mimeType") if isinstance(dl_meta, dict) else str(dl_meta or "")
    except Exception as ex_dl:
        return error_response(f"Failed to download file from Google Drive: {ex_dl}", 502)

    safe_fn = str(file_rec.get("original_filename") or "document").replace('"', "_")
    content_disp = f'{"attachment" if download_flag else "inline"}; filename="{safe_fn}"'
    headers = get_cors_headers()
    headers["Content-Type"] = file_rec.get("mime_type") or dl_mime or "application/octet-stream"
    headers["Content-Disposition"] = content_disp
    headers["Cache-Control"] = "private, max-age=300"
    return Response(file_bytes, status=200, headers=headers)


async def handle_events_request(
    request: Any,
    path: str,
    method: str,
    body: Dict[str, Any],
    query_params: Dict[str, Any],
    current_user: Optional[Dict[str, Any]],
    raw_dal: Any,
    env: Any,
) -> Optional[Response]:
    """
    Handles all CCE Events & Forms routes.
    Returns Response if matched, or None if the route is not an events route.
    """
    if not (path.startswith("/api/v1/events") or path.startswith("/api/v1/student/events")):
        return None

    if not hasattr(env, "DB"):
        return error_response("Database binding DB is not available", 500)

    dal = EventsDAL(env.DB)

    # All events routes require authentication
    if not current_user:
        return error_response("Unauthorized: Please log in to access this resource", 401)

    role = str(current_user.get("token_role") or current_user.get("role") or "").lower()
    user_id = str(current_user.get("id") or current_user.get("user_id") or "")

    # =========================================================================
    # A0. Event File Retrieval Proxy: GET /api/v1/events/files/{id}(/content)
    # =========================================================================
    m_evt_file = re.match(r"^/api/v1/events/files/([a-zA-Z0-9_\-]+)(/content)?$", path)
    if m_evt_file and method == "GET":
        fid = m_evt_file.group(1)
        is_content = bool(m_evt_file.group(2))
        dl_flag = query_params.get("download", ["0"])[0] in ("1", "true", "yes")
        return await serve_event_file_request(fid, is_content, dl_flag, current_user, dal, raw_dal, env)

    # =========================================================================
    # A. File Upload Endpoint: POST /api/v1/events/upload & /api/v1/student/events/upload
    # =========================================================================
    if path in ("/api/v1/events/upload", "/api/v1/events/upload/", "/api/v1/student/events/upload", "/api/v1/student/events/upload/") and method == "POST":
        content_type = request.headers.get("content-type") or request.headers.get("Content-Type") or ""
        file_bytes = None
        filename = "event_upload.pdf"
        mime_type = "application/pdf"
        form_fields: Dict[str, str] = {}

        if "multipart/form-data" in content_type:
            file_bytes, filename, mime_type, form_fields = await _extract_event_upload(request, content_type)

        # Or JSON payload with base64
        if not file_bytes and isinstance(body, dict) and body:
            b64_content = body.get("file_content_base64") or body.get("file_base64") or body.get("data")
            if b64_content:
                try:
                    file_bytes = base64.b64decode(b64_content)
                    filename = body.get("file_name") or body.get("filename") or filename
                    mime_type = body.get("mime_type") or mime_type
                except Exception as e:
                    return error_response(f"Invalid base64 file data: {str(e)}", 400)

        if not file_bytes:
            return error_response("No file provided for upload", 400)

        # Enforce max file size: 15 MB
        if len(file_bytes) > 15 * 1024 * 1024:
            return error_response("File size exceeds maximum allowed limit (15 MB)", 400)

        # Allowed MIME validation
        allowed_mimes = (
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain", "text/csv", "application/octet-stream",
        )
        if mime_type not in allowed_mimes:
            return error_response(f"File type '{mime_type}' is not supported. Please upload an image, PDF, or document.", 400)

        event_id = (
            form_fields.get("event_id")
            or query_params.get("event_id", [None])[0]
            or (body.get("event_id") if isinstance(body, dict) else None)
        )
        field_key = (
            form_fields.get("field_key")
            or query_params.get("field_key", [None])[0]
            or (body.get("field_key") if isinstance(body, dict) else None)
        )
        upload_scope = (
            form_fields.get("upload_scope")
            or query_params.get("upload_scope", [None])[0]
            or (body.get("upload_scope") if isinstance(body, dict) else None)
            or ("student_submission" if role == "student" else "event_media")
        )

        # Validate against configured form field rules when event_id and field_key are known
        field_err = await _validate_upload_against_field(dal, event_id, field_key, filename, mime_type, len(file_bytes))
        if field_err:
            return error_response(field_err, 400)

        acc_tok, root_folder_id, has_drive_creds, drive_err = await _get_drive_access_token(dal, raw_dal, env)
        environment = str(getattr(env, "APP_ENV", None) or getattr(env, "ENVIRONMENT", "") or "").lower()

        drive_file_id = ""
        drive_folder_id: Optional[str] = None
        student_id_owner: Optional[str] = user_id if role == "student" else None

        if has_drive_creds:
            if drive_err or not acc_tok:
                return error_response(f"Google Drive authentication failed: {drive_err or 'Unable to obtain token'}", 502)
            if not root_folder_id:
                return error_response("Google Drive root folder ID is not configured", 500)

            try:
                event_title = None
                if event_id:
                    evt = await dal.get_event(event_id)
                    if evt:
                        event_title = evt.get("title")

                if role == "student":
                    upload_scope = "student_submission"
                    stu_row = await dal.first(
                        """SELECT u.full_name, sp.register_number, sp.google_drive_folder_id
                           FROM users u
                           LEFT JOIN student_profiles sp ON sp.user_id = u.id
                           WHERE u.id = ?""",
                        user_id,
                    )
                    full_name = (stu_row.get("full_name") if stu_row else None) or current_user.get("full_name") or user_id
                    reg_no = (stu_row.get("register_number") if stu_row else None) or current_user.get("register_number") or ""
                    existing_db_folder = stu_row.get("google_drive_folder_id") if stu_row else None

                    student_folder_id, folder_updated = await resolve_student_drive_folder(
                        acc_tok,
                        root_folder_id,
                        reg_no,
                        full_name,
                        existing_db_folder,
                    )
                    if (folder_updated or not existing_db_folder) and student_folder_id:
                        try:
                            await dal.execute(
                                "UPDATE student_profiles SET google_drive_folder_id = ? WHERE user_id = ?",
                                student_folder_id,
                                user_id,
                            )
                        except Exception as ex_sp:
                            logger.warning("Could not persist resolved student drive folder id: %s", ex_sp)

                    target_folder_id, _ = await resolve_student_event_folder(acc_tok, student_folder_id, event_title)
                else:
                    upload_scope = "event_media" if upload_scope not in ("event_media", "notification_media") else upload_scope
                    assets_folder_id = await get_or_create_folder(acc_tok, "Event Assets", root_folder_id)
                    if event_title:
                        safe_evt = re.sub(r'[\\/:*?"<>|]+', "-", str(event_title)).strip()[:60] or "Event"
                        target_folder_id = await get_or_create_folder(acc_tok, safe_evt, assets_folder_id)
                    else:
                        target_folder_id = assets_folder_id

                res_drive = await upload_evidence_file(acc_tok, file_bytes, filename, mime_type, target_folder_id)
                drive_file_id = res_drive["drive_file_id"]
                drive_folder_id = target_folder_id
            except Exception as ex_up:
                logger.error("Google Drive event upload failed: %s", ex_up)
                return error_response(f"Google Drive upload failed: {str(ex_up)}", 502)
        else:
            if environment == "production":
                return error_response(
                    "Google Drive is not authorized in production. Please ask an Admin to connect Google Drive before uploading files.",
                    503,
                )
            drive_file_id = f"local_{uuid.uuid4().hex[:12]}"
            drive_folder_id = "local_unconnected"

        file_id = str(uuid.uuid4())
        await dal.register_event_file(
            file_id=file_id,
            student_id=student_id_owner,
            event_id=event_id,
            field_key=field_key,
            drive_file_id=drive_file_id,
            drive_folder_id=drive_folder_id,
            original_filename=filename,
            mime_type=mime_type,
            file_size=len(file_bytes),
            file_scope=upload_scope,
            uploaded_by=user_id,
        )

        file_url = f"/api/v1/events/files/{file_id}/content"
        return json_response({
            "file_id": file_id,
            "storage_reference": drive_file_id,
            "drive_file_id": drive_file_id,
            "drive_folder_id": drive_folder_id,
            "file_scope": upload_scope,
            "drive_connected": bool(has_drive_creds),
            "original_filename": filename,
            "filename": filename,
            "file_name": filename,
            "mime_type": mime_type,
            "file_size": len(file_bytes),
            "file_url": file_url,
            "download_url": f"{file_url}?download=1",
        }, 201)

    # =========================================================================
    # B. Student Events Endpoints (/api/v1/student/events & /api/v1/events/student)
    # =========================================================================
    if path in ("/api/v1/student/events", "/api/v1/events/student") and method == "GET":
        if role != "student":
            return error_response("Forbidden: Only students can access this endpoint", 403)
        events = await dal.list_student_events(user_id)
        return json_response({"events": events})

    # Student Event Detail: GET /api/v1/student/events/{id}
    m_stu_evt = re.match(r"^/api/v1/student/events/([a-zA-Z0-9_\-]+)$", path)
    if m_stu_evt and method == "GET":
        if role != "student":
            return error_response("Forbidden: Only students can access this endpoint", 403)
        event_id = m_stu_evt.group(1)
        evt = await dal.get_event(event_id)
        if not evt:
            return error_response("Event not found. It may have been deleted by the coordinator.", 404)
        if evt.get("status") != "published":
            return error_response("This event is no longer available or has been archived.", 404)

        is_eligible = await dal.check_student_eligibility(event_id, user_id)
        if not is_eligible:
            return error_response("You are not eligible for this event", 403)

        sub = await dal.get_student_submission(event_id, user_id)
        evt["my_submission"] = sub
        return json_response(evt)

    # Student Event Form: GET /api/v1/student/events/{id}/form
    m_stu_form = re.match(r"^/api/v1/student/events/([a-zA-Z0-9_\-]+)/form$", path)
    if m_stu_form and method == "GET":
        if role != "student":
            return error_response("Forbidden: Only students can access this endpoint", 403)
        event_id = m_stu_form.group(1)
        evt = await dal.get_event(event_id)
        if not evt:
            return error_response("Event not found. It may have been deleted by the coordinator.", 404)
        if evt.get("status") != "published":
            return error_response("Registration form unavailable because this event is not published or has been archived.", 404)

        is_eligible = await dal.check_student_eligibility(event_id, user_id)
        if not is_eligible:
            return error_response("You are not eligible for this event", 403)

        curr_form = await dal.get_current_form_version(event_id)
        if not curr_form:
            return error_response("No form configuration found for this event", 404)

        poll_results = await dal.get_poll_aggregates(event_id, curr_form)
        return json_response({"event": evt, "form": curr_form, "poll_results": poll_results})

    # Student Submit Response: POST /api/v1/student/events/{id}/submit OR POST /api/v1/student/events/{id}/register OR POST /api/v1/events/{id}/register
    m_stu_sub = re.match(r"^/api/v1/student/events/([a-zA-Z0-9_\-]+)/(submit|register)$", path)
    m_stu_reg = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/register$", path)
    if (m_stu_sub or m_stu_reg) and method == "POST":
        if role != "student":
            return error_response("Forbidden: Only students can submit responses", 403)
        event_id = (m_stu_sub or m_stu_reg).group(1)
        values = body.get("values") or body.get("responses") or {}
        form_version_id = body.get("form_version_id")
        uploaded_files = body.get("uploaded_files", [])

        try:
            sub = await dal.submit_event_response(
                event_id=event_id,
                student_user_id=user_id,
                form_version_id=form_version_id,
                values=values,
                uploaded_files=uploaded_files,
            )
            curr_form = await dal.get_form_version_by_id(form_version_id) if form_version_id else await dal.get_current_form_version(event_id)
            poll_results = await dal.get_poll_aggregates(event_id, curr_form) if curr_form else {}
            return json_response({"message": "Response submitted successfully!", "submission": sub, "poll_results": poll_results}, 201)
        except ValueError as ve:
            return error_response(str(ve), 400)
        except Exception as ex:
            logger.error("Submission error: %s", ex)
            return error_response(f"Submission failed: {str(ex)}", 500)

    # Student View Own Submission: GET /api/v1/student/events/{id}/my-submission
    m_stu_my_sub = re.match(r"^/api/v1/student/events/([a-zA-Z0-9_\-]+)/my-submission$", path)
    if m_stu_my_sub and method == "GET":
        if role != "student":
            return error_response("Forbidden: Only students can access this endpoint", 403)
        event_id = m_stu_my_sub.group(1)
        sub = await dal.get_student_submission(event_id, user_id)
        if not sub:
            return error_response("No submission found for this event", 404)
        return json_response(sub)

    # =========================================================================
    # C. Admin & HOD Event Management Endpoints (/api/v1/events)
    # =========================================================================

    # Verify Admin or HOD role for all remaining management endpoints
    if role not in ("admin", "hod"):
        return error_response("Forbidden: Admin or HOD access required", 403)

    # 1. List Events: GET /api/v1/events
    if path == "/api/v1/events" and method == "GET":
        status_filter = query_params.get("status", [None])[0]
        search_filter = query_params.get("search", [None])[0]
        sem_filter = query_params.get("semester_id", [None])[0]
        ay_filter = query_params.get("academic_year", [None])[0]

        try:
            events = await dal.list_events(
                status=status_filter,
                search=search_filter,
                semester_id=sem_filter,
                academic_year=ay_filter,
            )
            return json_response({"events": events, "count": len(events)})
        except Exception as ex:
            logger.error("List events error: %s", ex)
            return error_response(f"Failed to retrieve events: {str(ex)}", 500)

    # 1b. Dynamic Audience Options (All 61 Students & Mentor Mentees)
    if path == "/api/v1/events/audience-options" and method == "GET":
        try:
            summary = await dal.get_audience_options_summary()
            return json_response(summary)
        except Exception as ex:
            logger.error("Audience options error: %s", ex)
            return error_response(f"Failed to load audience options: {str(ex)}", 500)

    # 2. Create Event: POST /api/v1/events
    if path == "/api/v1/events" and method == "POST":
        try:
            created = await dal.create_event(body, user_id)
            return json_response(created, 201)
        except ValueError as ve:
            return error_response(str(ve), 400)
        except Exception as ex:
            logger.error("Event creation error: %s", ex)
            return error_response(f"Failed to create event: {str(ex)}", 500)

    # 3. Specific Event Routes (/api/v1/events/{id}/...)
    m_evt_status = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/status$", path)
    if m_evt_status and method in ("PATCH", "POST"):
        event_id = m_evt_status.group(1)
        try:
            target_status = body.get("status", "published") if isinstance(body, dict) else "published"
            if isinstance(body, dict):
                upd_payload = {k: v for k, v in body.items() if k in (
                    "notify_students", "notification_title", "notification_message",
                    "notification_image_url", "notification_priority", "notification_display_mode",
                    "notification_schedule", "notification_cta_label"
                )}
                if upd_payload:
                    await dal.update_event(event_id, upd_payload, user_id)
            updated = await dal.change_event_status(event_id, target_status, user_id)
            return json_response({"message": f"Event status updated to {target_status}", "event": updated})
        except ValueError as ve:
            return error_response(str(ve), 400)

    m_evt_publish = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/publish$", path)
    if m_evt_publish and method == "POST":
        event_id = m_evt_publish.group(1)
        try:
            if isinstance(body, dict):
                upd_payload = {k: v for k, v in body.items() if k in (
                    "notify_students", "notification_title", "notification_message",
                    "notification_image_url", "notification_priority", "notification_display_mode",
                    "notification_schedule", "notification_cta_label"
                )}
                if upd_payload:
                    await dal.update_event(event_id, upd_payload, user_id)
            updated = await dal.change_event_status(event_id, "published", user_id)
            return json_response({"message": "Event published successfully", "event": updated})
        except ValueError as ve:
            return error_response(str(ve), 400)

    m_evt_close = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/close$", path)
    if m_evt_close and method == "POST":
        event_id = m_evt_close.group(1)
        try:
            updated = await dal.change_event_status(event_id, "closed", user_id)
            return json_response({"message": "Event closed successfully", "event": updated})
        except ValueError as ve:
            return error_response(str(ve), 400)

    m_evt_reopen = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/reopen$", path)
    if m_evt_reopen and method == "POST":
        event_id = m_evt_reopen.group(1)
        try:
            updated = await dal.change_event_status(event_id, "published", user_id)
            return json_response({"message": "Event reopened successfully", "event": updated})
        except ValueError as ve:
            return error_response(str(ve), 400)

    m_evt_archive = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/archive$", path)
    if m_evt_archive and method == "POST":
        event_id = m_evt_archive.group(1)
        try:
            updated = await dal.change_event_status(event_id, "archived", user_id)
            return json_response({"message": "Event archived successfully", "event": updated})
        except ValueError as ve:
            return error_response(str(ve), 400)

    m_evt_dup = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/duplicate$", path)
    if m_evt_dup and method == "POST":
        event_id = m_evt_dup.group(1)
        try:
            cloned = await dal.duplicate_event(event_id, user_id)
            return json_response({"message": "Event and form duplicated as draft", "event": cloned}, 201)
        except ValueError as ve:
            return error_response(str(ve), 400)
        except Exception as ex:
            logger.error("Duplicate event error: %s", ex)
            return error_response(f"Failed to duplicate event: {str(ex)}", 500)

    # 4. Form Management
    # GET /api/v1/events/{id}/forms/current
    m_curr_form = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/(forms/current|form)$", path)
    if m_curr_form and method == "GET":
        event_id = m_curr_form.group(1)
        curr_ver = await dal.get_current_form_version(event_id)
        if not curr_ver:
            return error_response("No form found for this event", 404)
        return json_response(curr_ver)

    # POST /api/v1/events/{id}/forms (Save Form Fields)
    m_save_form = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/forms$", path)
    if m_save_form and method == "POST":
        event_id = m_save_form.group(1)
        fields = body.get("fields", [])
        sections_config = body.get("sections_config", [])
        form_settings = body.get("form_settings")
        try:
            saved_ver = await dal.save_form_fields(
                event_id,
                fields,
                user_id,
                sections_config=sections_config,
                form_settings=form_settings,
            )
            return json_response({"message": "Form fields saved successfully", "form": saved_ver})
        except ValueError as ve:
            return error_response(str(ve), 400)
        except Exception as ex:
            logger.error("Save form fields error: %s", ex)
            return error_response(f"Failed to save form fields: {str(ex)}", 500)

    # GET /api/v1/events/{id}/forms/versions
    m_form_vers = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/forms/versions$", path)
    if m_form_vers and method == "GET":
        event_id = m_form_vers.group(1)
        versions = await dal.list_form_versions(event_id)
        return json_response({"versions": versions})

    # GET /api/v1/events/{id}/forms/versions/{version_id}
    m_form_ver_single = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/forms/versions/([a-zA-Z0-9_\-]+)$", path)
    if m_form_ver_single and method == "GET":
        ver_id = m_form_ver_single.group(2)
        ver = await dal.get_form_version_by_id(ver_id)
        if not ver:
            return error_response("Form version not found", 404)
        return json_response(ver)

    # 5. Responses Management
    # GET /api/v1/events/{id}/responses & GET /api/v1/events/{id}/submissions
    m_responses = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/(responses|submissions)$", path)
    if m_responses and method == "GET":
        event_id = m_responses.group(1)
        search_filter = query_params.get("search", [None])[0]
        status_filter = query_params.get("status", [None])[0]
        try:
            resp_data = await dal.get_event_responses(event_id, search=search_filter, status=status_filter)
            return json_response(resp_data)
        except ValueError as ve:
            return error_response(str(ve), 400)

    # GET /api/v1/events/{id}/responses/{response_id} & GET /api/v1/events/{id}/submissions/{response_id}
    m_resp_detail = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)/(responses|submissions)/([a-zA-Z0-9_\-]+)$", path)
    if m_resp_detail and method == "GET":
        resp_id = m_resp_detail.group(3)
        sub_detail = await dal.get_submission_detail(resp_id)
        if not sub_detail:
            return error_response("Submission not found", 404)
        return json_response(sub_detail)

    # 6. Event Detail, Update, Delete: /api/v1/events/{id}
    m_evt_single = re.match(r"^/api/v1/events/([a-zA-Z0-9_\-]+)$", path)
    if m_evt_single and m_evt_single.group(1) not in ("student", "upload", "files", "templates", "notifications", "audience-options"):
        event_id = m_evt_single.group(1)
        if method == "GET":
            evt = await dal.get_event(event_id)
            if not evt:
                return error_response("Event not found", 404)
            # Attach current form version
            evt["current_form"] = await dal.get_current_form_version(event_id)
            return json_response(evt)

        elif method in ("PUT", "PATCH"):
            try:
                updated = await dal.update_event(event_id, body, user_id)
                return json_response(updated)
            except ValueError as ve:
                return error_response(str(ve), 400)
            except Exception as ex:
                logger.error("Update event error: %s", ex)
                return error_response(f"Failed to update event: {str(ex)}", 500)

        elif method == "DELETE":
            try:
                res = await dal.delete_event(event_id, allow_archive=True)
                return json_response(res)
            except ValueError as ve:
                status_code = 404 if "not found" in str(ve).lower() else 400
                return error_response(str(ve), status_code)
            except Exception as ex:
                logger.error("Delete event error: %s", ex)
                return error_response(f"Failed to delete event: {str(ex)}", 500)

    return error_response(f"Events route '{method} {path}' not found", 404)
