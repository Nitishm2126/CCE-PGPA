import json
import logging
import re
from typing import Any, Dict, Optional
try:
    from workers import Response
except ImportError:
    class Response:
        def __init__(self, body: Any = "", status: int = 200, headers: Optional[Dict[str, str]] = None):
            self.body = body
            self.status = status
            self.headers = headers or {}

try:
    from notifications_dal import NotificationsDAL
    from templates_dal import TemplatesDAL
except ImportError:
    from src.notifications_dal import NotificationsDAL
    from src.templates_dal import TemplatesDAL

logger = logging.getLogger("cce_notifications_routes")


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


async def handle_notifications_and_templates_request(
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
    Handles:
    - /api/v1/events/templates (Templates Library)
    - /api/v1/notifications (Admin/HOD Management)
    - /api/v1/student/notifications (Student In-App Interface)
    """
    is_template_route = path.startswith("/api/v1/events/templates")
    is_admin_notif_route = path.startswith("/api/v1/notifications")
    is_student_notif_route = path.startswith("/api/v1/student/notifications")

    if not (is_template_route or is_admin_notif_route or is_student_notif_route):
        return None

    if not hasattr(env, "DB"):
        return error_response("Database binding DB is not available", 500)

    # Public read access for starter templates library
    if is_template_route and method == "GET":
        tpl_dal = TemplatesDAL(getattr(env, "DB", None))

        # GET /api/v1/events/templates
        if path == "/api/v1/events/templates":
            category = query_params.get("category", [None])[0]
            search = query_params.get("search", [None])[0]
            templates = await tpl_dal.list_templates(category=category, search=search)
            return json_response({"templates": templates, "count": len(templates)})

        # GET /api/v1/events/templates/{id}
        m_tpl_single = re.match(r"^/api/v1/events/templates/([a-zA-Z0-9_\-]+)$", path)
        if m_tpl_single:
            tpl_id = m_tpl_single.group(1)
            tpl = await tpl_dal.get_template(tpl_id)
            if not tpl:
                return error_response("Template not found", 404)
            return json_response(tpl)

    # All remaining notification and mutation routes require an authenticated user
    if not current_user:
        return error_response("Unauthorized: Please log in to access this resource", 401)

    role = str(current_user.get("token_role") or current_user.get("role") or "").lower()
    user_id = str(current_user.get("id") or current_user.get("user_id") or "")

    # =========================================================================
    # A. Dedicated Event Templates Library (/api/v1/events/templates)
    # =========================================================================
    if is_template_route:
        tpl_dal = TemplatesDAL(env.DB)

        # POST /api/v1/events/templates (Save custom template - Admin/HOD only)
        if path == "/api/v1/events/templates" and method == "POST":
            if role not in ("admin", "hod"):
                return error_response("Forbidden: Admin or HOD access required", 403)
            try:
                created = await tpl_dal.create_custom_template(body, user_id)
                return json_response(created, 201)
            except ValueError as ve:
                return error_response(str(ve), 400)

        # GET /api/v1/events/templates/{id}
        m_tpl_single = re.match(r"^/api/v1/events/templates/([a-zA-Z0-9_\-]+)$", path)
        if m_tpl_single:
            tpl_id = m_tpl_single.group(1)
            if method == "GET":
                tpl = await tpl_dal.get_template(tpl_id)
                if not tpl:
                    return error_response("Template not found", 404)
                return json_response(tpl)
            elif method == "DELETE":
                if role not in ("admin", "hod"):
                    return error_response("Forbidden: Admin or HOD access required", 403)
                try:
                    res = await tpl_dal.delete_custom_template(tpl_id)
                    return json_response(res)
                except ValueError as ve:
                    return error_response(str(ve), 400)

    # =========================================================================
    # B. Student In-App Notifications (/api/v1/student/notifications)
    # =========================================================================
    if is_student_notif_route:
        if role != "student":
            return error_response("Forbidden: Only students can access student notifications", 403)

        notif_dal = NotificationsDAL(env.DB)

        # GET /api/v1/student/notifications/unread-count
        if path == "/api/v1/student/notifications/unread-count" and method == "GET":
            count = await notif_dal.get_student_unread_count(user_id)
            return json_response({"unread_count": count})

        # POST /api/v1/student/notifications/read-all
        if path == "/api/v1/student/notifications/read-all" and method == "POST":
            res = await notif_dal.mark_all_as_read(user_id)
            return json_response(res)

        # GET /api/v1/student/notifications
        if path == "/api/v1/student/notifications" and method == "GET":
            notifs = await notif_dal.list_student_notifications(user_id)
            unread_cnt = await notif_dal.get_student_unread_count(user_id)
            return json_response({"notifications": notifs, "count": len(notifs), "unread_count": unread_cnt})

        # POST /api/v1/student/notifications/{id}/read
        m_st_read = re.match(r"^/api/v1/student/notifications/([a-zA-Z0-9_\-]+)/read$", path)
        if m_st_read and method == "POST":
            notif_id = m_st_read.group(1)
            res = await notif_dal.mark_as_read(notif_id, user_id)
            return json_response(res)

        # POST /api/v1/student/notifications/{id}/dismiss
        m_st_dismiss = re.match(r"^/api/v1/student/notifications/([a-zA-Z0-9_\-]+)/dismiss$", path)
        if m_st_dismiss and method == "POST":
            notif_id = m_st_dismiss.group(1)
            res = await notif_dal.dismiss_notification(notif_id, user_id)
            return json_response(res)

        # POST /api/v1/student/notifications/{id}/click
        m_st_click = re.match(r"^/api/v1/student/notifications/([a-zA-Z0-9_\-]+)/click$", path)
        if m_st_click and method == "POST":
            notif_id = m_st_click.group(1)
            res = await notif_dal.record_click(notif_id, user_id)
            return json_response(res)

    # =========================================================================
    # C. Admin & HOD Notifications Console (/api/v1/notifications)
    # =========================================================================
    if is_admin_notif_route:
        if role not in ("admin", "hod"):
            return error_response("Forbidden: Admin or HOD access required", 403)

        notif_dal = NotificationsDAL(env.DB)

        # GET /api/v1/notifications
        if path == "/api/v1/notifications" and method == "GET":
            st_filter = query_params.get("status", [None])[0]
            cat_filter = query_params.get("category", [None])[0]
            pri_filter = query_params.get("priority", [None])[0]
            srch_filter = query_params.get("search", [None])[0]

            notifs = await notif_dal.list_notifications(
                status=st_filter,
                category=cat_filter,
                priority=pri_filter,
                search=srch_filter,
            )
            return json_response({"notifications": notifs, "count": len(notifs)})

        # POST /api/v1/notifications (Create notification)
        if path == "/api/v1/notifications" and method == "POST":
            try:
                created = await notif_dal.create_notification(body, user_id)
                return json_response(created, 201)
            except ValueError as ve:
                return error_response(str(ve), 400)
            except Exception as ex:
                logger.error("Notification create error: %s", ex)
                return error_response(f"Failed to create notification: {str(ex)}", 500)

        # Specific Notification Action Routes (/api/v1/notifications/{id}/...)
        m_notif_pub = re.match(r"^/api/v1/notifications/([a-zA-Z0-9_\-]+)/publish$", path)
        if m_notif_pub and method == "POST":
            notif_id = m_notif_pub.group(1)
            updated = await notif_dal.change_status(notif_id, "published", user_id)
            return json_response({"message": "Notification published successfully.", "notification": updated})

        m_notif_pause = re.match(r"^/api/v1/notifications/([a-zA-Z0-9_\-]+)/pause$", path)
        if m_notif_pause and method == "POST":
            notif_id = m_notif_pause.group(1)
            updated = await notif_dal.change_status(notif_id, "paused", user_id)
            return json_response({"message": "Notification paused.", "notification": updated})

        m_notif_resume = re.match(r"^/api/v1/notifications/([a-zA-Z0-9_\-]+)/resume$", path)
        if m_notif_resume and method == "POST":
            notif_id = m_notif_resume.group(1)
            updated = await notif_dal.change_status(notif_id, "published", user_id)
            return json_response({"message": "Notification resumed.", "notification": updated})

        m_notif_archive = re.match(r"^/api/v1/notifications/([a-zA-Z0-9_\-]+)/archive$", path)
        if m_notif_archive and method == "POST":
            notif_id = m_notif_archive.group(1)
            updated = await notif_dal.change_status(notif_id, "archived", user_id)
            return json_response({"message": "Notification archived.", "notification": updated})

        # Single Notification Detail, Update, Delete: /api/v1/notifications/{id}
        m_notif_single = re.match(r"^/api/v1/notifications/([a-zA-Z0-9_\-]+)$", path)
        if m_notif_single:
            notif_id = m_notif_single.group(1)
            if method == "GET":
                notif = await notif_dal.get_notification(notif_id)
                if not notif:
                    return error_response("Notification not found", 404)
                return json_response(notif)
            elif method in ("PUT", "PATCH"):
                try:
                    updated = await notif_dal.update_notification(notif_id, body, user_id)
                    return json_response(updated)
                except ValueError as ve:
                    return error_response(str(ve), 400)
            elif method == "DELETE":
                res = await notif_dal.delete_notification(notif_id)
                return json_response(res)

    return error_response(f"Notification route '{method} {path}' not found", 404)
