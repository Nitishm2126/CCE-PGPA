"""
CCE In-App Student Notification System DAL (Phase 2)
Full lifecycle management of department announcements, automated event notifications,
scheduling, priority levels, recipient mapping, and student read/dismissal tracking.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("cce_notifications_dal")


try:
    from pyodide.ffi import jsnull as _PYODIDE_JS_NULL
except Exception:
    _PYODIDE_JS_NULL = None


def _get_js_null() -> Any:
    global _PYODIDE_JS_NULL
    if _PYODIDE_JS_NULL is not None:
        return _PYODIDE_JS_NULL
    try:
        from pyodide.ffi import jsnull
        _PYODIDE_JS_NULL = jsnull
        return _PYODIDE_JS_NULL
    except Exception:
        pass
    try:
        import js
        _PYODIDE_JS_NULL = js.JSON.parse("null")
        return _PYODIDE_JS_NULL
    except Exception:
        pass
    return None


def _sanitize_param(p: Any) -> Any:
    if p is None:
        return _get_js_null()
    return p


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(r: Any) -> Dict[str, Any]:
    if r is None:
        return {}
    if isinstance(r, dict):
        return r
    if hasattr(r, "to_py"):
        try:
            return r.to_py()
        except Exception:
            pass
    try:
        return dict(r)
    except Exception:
        pass
    return {}


class NotificationsDAL:
    def __init__(self, db: Any):
        self.db = db

    async def query(self, sql: str, *params) -> List[Dict[str, Any]]:
        stmt = self.db.prepare(sql)
        if params:
            clean_params = [_sanitize_param(p) for p in params]
            stmt = stmt.bind(*clean_params)
        res = await stmt.all()
        results = getattr(res, "results", []) or []
        if hasattr(results, "to_py"):
            try:
                results = results.to_py()
            except Exception:
                pass
        return [_row_to_dict(r) for r in results]

    async def first(self, sql: str, *params) -> Optional[Dict[str, Any]]:
        stmt = self.db.prepare(sql)
        if params:
            clean_params = [_sanitize_param(p) for p in params]
            stmt = stmt.bind(*clean_params)
        r = await stmt.first()
        if r is None:
            return None
        if hasattr(r, "to_py"):
            try:
                return r.to_py()
            except Exception:
                pass
        return _row_to_dict(r)

    async def execute(self, sql: str, *params) -> Any:
        stmt = self.db.prepare(sql)
        if params:
            clean_params = [_sanitize_param(p) for p in params]
            stmt = stmt.bind(*clean_params)
        return await stmt.run()

    # =========================================================================
    # 1. Admin & HOD Notification Lifecycle
    # =========================================================================

    async def create_notification(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        notif_id = f"notif_{uuid.uuid4().hex[:16]}"
        now = _utc_now_iso()

        title = str(data.get("title", "")).strip()
        if not title:
            raise ValueError("Notification title is required.")

        short_message = str(data.get("short_message", "")).strip()
        if not short_message:
            raise ValueError("Notification short message is required.")

        category = str(data.get("category", "event")).strip().lower()
        cat_map = {
            "event_announcement": "announcement",
            "urgent_alert": "announcement",
            "reminder": "academic",
            "opportunity": "internship",
            "notice": "general",
        }
        category = cat_map.get(category, category)
        if category not in (
            "event", "registration", "announcement", "academic", "workshop",
            "competition", "internship", "general", "custom"
        ):
            category = "announcement"

        priority = str(data.get("priority", "normal")).strip().lower()
        if priority not in ("normal", "important", "urgent"):
            priority = "normal"

        display_mode = str(data.get("display_mode", "both")).strip().lower()
        disp_map = {
            "normal": "bell_only",
            "popup_modal": "popup_only",
            "bell_only": "bell_only",
            "popup_only": "popup_only",
            "both": "both",
        }
        display_mode = disp_map.get(display_mode, "both")

        status = str(data.get("status", "published")).strip().lower()
        if status not in ("draft", "published", "scheduled", "paused", "archived"):
            status = "published"

        scheduled_at = data.get("scheduled_at")
        published_at = data.get("published_at")
        if status == "published" and not published_at:
            published_at = now
        elif status == "scheduled" and scheduled_at:
            published_at = scheduled_at

        expires_at = data.get("expires_at")
        can_dismiss = 1 if data.get("can_dismiss", True) else 0

        audience_type = str(data.get("audience_type", "all")).strip().lower()
        if audience_type == "mentor_mentees":
            audience_type = "custom"
        audience_payload = data.get("audience_payload")
        if isinstance(audience_payload, str):
            try:
                parsed_aud = json.loads(audience_payload)
                if isinstance(parsed_aud, (dict, list)):
                    audience_payload = parsed_aud
            except Exception:
                pass
        aud_payload_str = json.dumps(audience_payload) if isinstance(audience_payload, (dict, list)) else audience_payload

        # Insert notification master record
        await self.execute(
            """INSERT INTO notifications (
                id, title, short_message, detailed_message, category, priority,
                image_url, attachment_url, external_url, cta_label, cta_url,
                event_id, audience_type, audience_payload, display_mode, status,
                scheduled_at, published_at, expires_at, can_dismiss,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            notif_id,
            title,
            short_message,
            data.get("detailed_message"),
            category,
            priority,
            data.get("image_url"),
            data.get("attachment_url"),
            data.get("external_url"),
            data.get("cta_label"),
            data.get("cta_url"),
            data.get("event_id"),
            audience_type,
            aud_payload_str,
            display_mode,
            status,
            scheduled_at,
            published_at,
            expires_at,
            can_dismiss,
            user_id,
            now,
            now,
        )

        # Populate eligible student recipients
        await self._populate_recipients(notif_id, audience_type, audience_payload)

        return await self.get_notification(notif_id)

    async def _populate_recipients(self, notification_id: str, audience_type: str, audience_payload: Any):
        """
        Determines eligible students based on audience configuration and creates recipient tracking records.
        """
        all_students = await self.query(
            """SELECT u.id as user_id, sp.register_number, sp.section, sp.year, sp.batch
               FROM users u
               JOIN student_profiles sp ON u.id = sp.user_id
               WHERE u.role = 'student'"""
        )

        eligible_user_ids = []
        now = _utc_now_iso()

        if audience_type == "all":
            eligible_user_ids = [s["user_id"] for s in all_students]

        elif audience_type == "section":
            target_sec = str(audience_payload or "").strip().upper()
            for s in all_students:
                if (s.get("section") or "").strip().upper() == target_sec:
                    eligible_user_ids.append(s["user_id"])

        elif audience_type == "academic_year":
            target_years = []
            if isinstance(audience_payload, list):
                target_years = [str(y).strip() for y in audience_payload]
            elif isinstance(audience_payload, str):
                target_years = [audience_payload.strip()]
            for s in all_students:
                s_yr = str(s.get("year") or "").strip()
                s_batch = str(s.get("batch") or "").strip()
                if (s_yr in target_years) or (s_batch in target_years):
                    eligible_user_ids.append(s["user_id"])

        elif audience_type == "specific_students":
            target_ids = set()
            if isinstance(audience_payload, list):
                for x in audience_payload:
                    target_ids.add(str(x).strip().upper())
                    target_ids.add(str(x).strip())
            for s in all_students:
                reg = str(s.get("register_number") or "").strip().upper()
                uid = str(s.get("user_id") or "").strip()
                if reg in target_ids or uid in target_ids or uid.upper() in target_ids:
                    eligible_user_ids.append(s["user_id"])

        elif audience_type == "custom" and isinstance(audience_payload, dict):
            if audience_payload.get("mode") == "mentor_mentees" or audience_payload.get("mentor_id") or audience_payload.get("mentor_key"):
                mentor_id = audience_payload.get("mentor_id")
                if not mentor_id:
                    m_key = str(audience_payload.get("mentor_key") or "").lower()
                    m_name = str(audience_payload.get("mentor_name") or "").lower()
                    rows = await self.query(
                        """SELECT DISTINCT u.id, u.full_name, u.email
                           FROM users u
                           JOIN mentor_assignments ma ON ma.mentor_id = u.id AND ma.is_active = 1
                           WHERE u.is_active = 1"""
                    )
                    for r in rows:
                        hay = f"{r.get('full_name', '')} {r.get('email', '')}".lower()
                        if (m_key and m_key in hay) or (m_name and m_name in hay):
                            mentor_id = r["id"]
                            break
                if mentor_id:
                    mentees = await self.query(
                        """SELECT DISTINCT ma.student_id
                           FROM mentor_assignments ma
                           JOIN users u ON u.id = ma.student_id
                           WHERE ma.mentor_id = ? AND ma.is_active = 1 AND u.role = 'student' AND u.is_active = 1""",
                        mentor_id,
                    )
                    eligible_user_ids = [m["student_id"] for m in mentees]
            else:
                sections = [str(x).upper() for x in audience_payload.get("sections", [])]
                years = [str(x) for x in audience_payload.get("years", [])]
                students = [str(x).upper() for x in audience_payload.get("students", [])]

                for s in all_students:
                    reg = str(s.get("register_number") or "").strip().upper()
                    sec = str(s.get("section") or "").strip().upper()
                    yr = str(s.get("year") or "").strip()

                    if students and reg in students:
                        eligible_user_ids.append(s["user_id"])
                    elif sections and sec in sections:
                        eligible_user_ids.append(s["user_id"])
                    elif years and yr in years:
                        eligible_user_ids.append(s["user_id"])
        else:
            eligible_user_ids = [s["user_id"] for s in all_students]

        # Bulk insert recipients
        for uid in set(eligible_user_ids):
            rec_id = str(uuid.uuid4())
            try:
                await self.execute(
                    """INSERT OR IGNORE INTO notification_recipients (
                        id, notification_id, student_id, is_read, is_dismissed, created_at
                    ) VALUES (?, ?, ?, 0, 0, ?)""",
                    rec_id,
                    notification_id,
                    uid,
                    now,
                )
            except Exception as e:
                logger.debug("Recipient insert exception: %s", e)

    async def update_notification(self, notification_id: str, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        existing = await self.get_notification(notification_id)
        if not existing:
            raise ValueError("Notification not found.")

        now = _utc_now_iso()
        title = data.get("title", existing["title"])
        short_message = data.get("short_message", existing["short_message"])
        detailed_message = data.get("detailed_message", existing.get("detailed_message"))
        category = data.get("category", existing.get("category", "event"))
        priority = data.get("priority", existing.get("priority", "normal"))
        image_url = data.get("image_url", existing.get("image_url"))
        attachment_url = data.get("attachment_url", existing.get("attachment_url"))
        external_url = data.get("external_url", existing.get("external_url"))
        cta_label = data.get("cta_label", existing.get("cta_label"))
        cta_url = data.get("cta_url", existing.get("cta_url"))
        display_mode = data.get("display_mode", existing.get("display_mode", "both"))
        expires_at = data.get("expires_at", existing.get("expires_at"))
        can_dismiss = 1 if data.get("can_dismiss", bool(existing.get("can_dismiss", 1))) else 0

        await self.execute(
            """UPDATE notifications SET
                title = ?, short_message = ?, detailed_message = ?, category = ?,
                priority = ?, image_url = ?, attachment_url = ?, external_url = ?,
                cta_label = ?, cta_url = ?, display_mode = ?, expires_at = ?,
                can_dismiss = ?, updated_at = ?
            WHERE id = ?""",
            title,
            short_message,
            detailed_message,
            category,
            priority,
            image_url,
            attachment_url,
            external_url,
            cta_label,
            cta_url,
            display_mode,
            expires_at,
            can_dismiss,
            now,
            notification_id,
        )

        return await self.get_notification(notification_id)

    async def get_notification(self, notification_id: str) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT n.*,
                   u.full_name as creator_name,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id) as total_recipients,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.is_read = 1) as read_count,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.is_read = 0) as unread_count,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.is_dismissed = 1) as dismissed_count,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.clicked_at IS NOT NULL) as clicked_count
            FROM notifications n
            LEFT JOIN users u ON n.created_by = u.id
            WHERE n.id = ?
        """
        notif = await self.first(sql, notification_id)
        if not notif:
            return None

        # Parse audience_payload
        if notif.get("audience_payload") and isinstance(notif["audience_payload"], str):
            try:
                notif["audience_payload"] = json.loads(notif["audience_payload"])
            except Exception:
                pass

        return notif

    async def list_notifications(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT n.*,
                   u.full_name as creator_name,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id) as total_recipients,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.is_read = 1) as read_count,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.is_read = 0) as unread_count,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.is_dismissed = 1) as dismissed_count,
                   (SELECT COUNT(*) FROM notification_recipients nr WHERE nr.notification_id = n.id AND nr.clicked_at IS NOT NULL) as clicked_count
            FROM notifications n
            LEFT JOIN users u ON n.created_by = u.id
            WHERE 1=1
        """
        params = []
        if status and status != "all":
            sql += " AND n.status = ?"
            params.append(status)
        if category and category != "all":
            sql += " AND n.category = ?"
            params.append(category)
        if priority and priority != "all":
            sql += " AND n.priority = ?"
            params.append(priority)
        if search:
            sql += " AND (n.title LIKE ? OR n.short_message LIKE ? OR n.detailed_message LIKE ?)"
            pat = f"%{search.strip()}%"
            params.extend([pat, pat, pat])

        sql += " ORDER BY n.created_at DESC"
        items = await self.query(sql, *params)
        for it in items:
            if it.get("audience_payload") and isinstance(it["audience_payload"], str):
                try:
                    it["audience_payload"] = json.loads(it["audience_payload"])
                except Exception:
                    pass
        return items

    async def change_status(self, notification_id: str, new_status: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        valid = ("draft", "published", "scheduled", "paused", "archived")
        if new_status not in valid:
            raise ValueError(f"Invalid notification status '{new_status}'")

        now = _utc_now_iso()
        if new_status == "published":
            await self.execute(
                "UPDATE notifications SET status = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?",
                new_status, now, now, notification_id
            )
        else:
            await self.execute(
                "UPDATE notifications SET status = ?, updated_at = ? WHERE id = ?",
                new_status, now, notification_id
            )
        return await self.get_notification(notification_id)

    async def delete_notification(self, notification_id: str) -> Dict[str, Any]:
        await self.execute("DELETE FROM notification_recipients WHERE notification_id = ?", notification_id)
        await self.execute("DELETE FROM notifications WHERE id = ?", notification_id)
        return {"action": "deleted", "message": "Notification and recipient tracking deleted successfully."}

    # =========================================================================
    # 2. Student In-App Notification Operations
    # =========================================================================

    async def list_student_notifications(self, student_user_id: str) -> List[Dict[str, Any]]:
        """
        Returns active notifications for student:
        - Must be in notification_recipients for this student
        - Must have status = 'published'
        - Must have published_at <= now
        - Must not be expired (expires_at is null or expires_at > now)
        - Must not be dismissed by student (is_dismissed = 0)
        """
        now = _utc_now_iso()
        sql = """
            SELECT n.id, n.title, n.short_message, n.detailed_message, n.category, n.priority,
                   n.status, n.scheduled_at,
                   n.image_url, n.attachment_url, n.external_url, n.cta_label, n.cta_url,
                   n.event_id, n.display_mode, n.can_dismiss, n.published_at, n.expires_at,
                   nr.is_read, nr.read_at, nr.is_dismissed, nr.dismissed_at
            FROM notifications n
            JOIN notification_recipients nr ON n.id = nr.notification_id
            LEFT JOIN events ev ON n.event_id = ev.id
            WHERE nr.student_id = ?
              AND (n.event_id IS NULL OR ev.status = 'published')
              AND (
                n.status = 'published'
                OR (n.status = 'scheduled' AND n.scheduled_at IS NOT NULL AND n.scheduled_at <= ?)
              )
              AND (n.published_at IS NULL OR n.published_at <= ?)
              AND (n.expires_at IS NULL OR n.expires_at > ?)
              AND nr.is_dismissed = 0
            ORDER BY 
              CASE n.priority
                WHEN 'urgent' THEN 1
                WHEN 'important' THEN 2
                ELSE 3
              END ASC,
              n.published_at DESC
        """
        return await self.query(sql, student_user_id, now, now, now)

    async def get_student_unread_count(self, student_user_id: str) -> int:
        now = _utc_now_iso()
        sql = """
            SELECT COUNT(*) as cnt
            FROM notifications n
            JOIN notification_recipients nr ON n.id = nr.notification_id
            LEFT JOIN events ev ON n.event_id = ev.id
            WHERE nr.student_id = ?
              AND (n.event_id IS NULL OR ev.status = 'published')
              AND nr.is_read = 0
              AND nr.is_dismissed = 0
              AND (
                n.status = 'published'
                OR (n.status = 'scheduled' AND n.scheduled_at IS NOT NULL AND n.scheduled_at <= ?)
              )
              AND (n.published_at IS NULL OR n.published_at <= ?)
              AND (n.expires_at IS NULL OR n.expires_at > ?)
        """
        res = await self.first(sql, student_user_id, now, now, now)
        return int(res["cnt"]) if res else 0

    async def mark_as_read(self, notification_id: str, student_user_id: str) -> Dict[str, Any]:
        now = _utc_now_iso()
        await self.execute(
            """UPDATE notification_recipients
               SET is_read = 1, read_at = COALESCE(read_at, ?)
               WHERE notification_id = ? AND student_id = ?""",
            now, notification_id, student_user_id
        )
        return {"message": "Notification marked as read."}

    async def mark_all_as_read(self, student_user_id: str) -> Dict[str, Any]:
        now = _utc_now_iso()
        await self.execute(
            """UPDATE notification_recipients
               SET is_read = 1, read_at = COALESCE(read_at, ?)
               WHERE student_id = ? AND is_read = 0""",
            now, student_user_id
        )
        return {"message": "All notifications marked as read."}

    async def dismiss_notification(self, notification_id: str, student_user_id: str) -> Dict[str, Any]:
        now = _utc_now_iso()
        await self.execute(
            """UPDATE notification_recipients
               SET is_dismissed = 1, dismissed_at = ?, is_read = 1, read_at = COALESCE(read_at, ?)
               WHERE notification_id = ? AND student_id = ?""",
            now, now, notification_id, student_user_id
        )
        return {"message": "Notification dismissed."}

    async def record_click(self, notification_id: str, student_user_id: str) -> Dict[str, Any]:
        now = _utc_now_iso()
        await self.execute(
            """UPDATE notification_recipients
               SET clicked_at = ?, is_read = 1, read_at = COALESCE(read_at, ?)
               WHERE notification_id = ? AND student_id = ?""",
            now, now, notification_id, student_user_id
        )
        return {"message": "Notification click recorded."}
