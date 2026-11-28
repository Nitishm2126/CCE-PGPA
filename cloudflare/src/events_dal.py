import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("cce_events_dal")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_dt_utc(val: Optional[str]) -> Optional[datetime]:
    if not val or not isinstance(val, str):
        return None
    s = val.strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _derive_effective_status(evt: Dict[str, Any]) -> str:
    raw = str(evt.get("status") or "draft").lower()
    if raw in ("draft", "archived", "closed"):
        return raw

    now = datetime.now(timezone.utc)
    end_dt = _parse_dt_utc(evt.get("event_end_at"))
    reg_start_dt = _parse_dt_utc(evt.get("registration_start_at"))
    reg_deadline_dt = _parse_dt_utc(evt.get("registration_deadline"))

    if end_dt and now > end_dt:
        return "completed"
    if evt.get("is_registration_enabled") == 0:
        return "registration_closed"
    if evt.get("close_after_deadline") and reg_deadline_dt and now > reg_deadline_dt:
        return "registration_closed"
    if reg_start_dt and now < reg_start_dt:
        return "scheduled"
    return "registration_open"


def _normalize_options_list(raw_opts: Any) -> List[Dict[str, str]]:
    if not raw_opts or not isinstance(raw_opts, list):
        return []
    out: List[Dict[str, str]] = []
    for item in raw_opts:
        if isinstance(item, dict):
            lbl = str(item.get("label") or item.get("value") or "")
            val = str(item.get("value") or re.sub(r"\s+", "_", lbl.lower().strip()))
            out.append({"label": lbl, "value": val})
        elif item is not None:
            s = str(item)
            val = re.sub(r"[^a-z0-9]+", "_", s.lower().strip()).strip("_") or s
            out.append({"label": s, "value": val})
    return out


def _sanitize_param(p: Any) -> Any:
    if p is None:
        try:
            from pyodide.ffi import jsnull
            return jsnull
        except Exception:
            pass
        try:
            import js
            return js.JSON.parse("null")
        except Exception:
            pass
        return None
    return p


def _row_to_dict(row: Any) -> Dict[str, Any]:
    if row is None:
        return {}
    if isinstance(row, dict):
        return row
    if hasattr(row, "to_py"):
        try:
            return row.to_py()
        except Exception:
            pass
    try:
        return dict(row)
    except Exception:
        pass
    return {}


def _enrich_event_record(evt: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not evt:
        return evt
    if evt.get("gallery_images") and isinstance(evt["gallery_images"], str):
        try:
            evt["gallery_images"] = json.loads(evt["gallery_images"])
        except Exception:
            evt["gallery_images"] = []
    elif not evt.get("gallery_images"):
        evt["gallery_images"] = []

    if evt.get("attachments") and isinstance(evt["attachments"], str):
        try:
            evt["attachments"] = json.loads(evt["attachments"])
        except Exception:
            evt["attachments"] = []
    elif not evt.get("attachments"):
        evt["attachments"] = []

    evt["notify_students"] = bool(evt.get("notify_students", 0))
    evt["notification_priority"] = evt.get("notification_priority") or "normal"
    evt["notification_display_mode"] = evt.get("notification_display_mode") or "both"
    evt["notification_cta_label"] = evt.get("notification_cta_label") or "Register Now"
    evt["banner_image_url"] = evt.get("banner_image_url") or evt.get("poster_url")
    evt["online_meeting_url"] = evt.get("online_meeting_url") or evt.get("meeting_url")
    evt["allow_multiple_responses"] = bool(evt.get("allow_multiple_responses", 0))
    evt["allow_edit_submission"] = bool(evt.get("allow_edit_submission", 0))
    evt["close_after_deadline"] = False if evt.get("close_after_deadline") == 0 else True
    evt["is_registration_enabled"] = False if evt.get("is_registration_enabled") == 0 else True
    evt["effective_status"] = _derive_effective_status(evt)

    return evt


def _evaluate_conditions_block(conditions: Any, values: Dict[str, Any]) -> bool:
    if not conditions:
        return True

    rules = []
    logic = "and"
    if isinstance(conditions, dict):
        logic = str(conditions.get("logic", "and") or "and").lower()
        rules = conditions.get("rules", [])
    elif isinstance(conditions, list):
        rules = conditions

    if not rules:
        return True

    matches = []
    for r in rules:
        if not isinstance(r, dict):
            continue
        src_key = r.get("field_key") or r.get("field") or r.get("source_field")
        op = str(r.get("operator") or "equals").lower()
        target_val = r.get("value") if "value" in r else r.get("target_value")
        action = str(r.get("action") or "show").lower()

        src_val = values.get(src_key)
        rule_matched = False
        target_lower = str(target_val or "").strip().lower()

        if op == "equals":
            if isinstance(src_val, list):
                rule_matched = any(str(item).strip().lower() == target_lower for item in src_val)
            else:
                rule_matched = str(src_val or "").strip().lower() == target_lower
        elif op == "not_equals":
            if isinstance(src_val, list):
                rule_matched = all(str(item).strip().lower() != target_lower for item in src_val)
            else:
                rule_matched = str(src_val or "").strip().lower() != target_lower
        elif op == "contains":
            if isinstance(src_val, list):
                rule_matched = any(target_lower in str(item).lower() for item in src_val)
            else:
                rule_matched = target_lower in str(src_val or "").lower()
        elif op == "not_contains":
            if isinstance(src_val, list):
                rule_matched = all(target_lower not in str(item).lower() for item in src_val)
            else:
                rule_matched = target_lower not in str(src_val or "").lower()
        elif op == "greater_than":
            try:
                rule_matched = float(src_val) > float(target_val)
            except Exception:
                rule_matched = False
        elif op == "less_than":
            try:
                rule_matched = float(src_val) < float(target_val)
            except Exception:
                rule_matched = False
        elif op == "in":
            target_list = [t.strip().lower() for t in (target_val if isinstance(target_val, list) else str(target_val or "").split(","))]
            if isinstance(src_val, list):
                rule_matched = any(str(s).strip().lower() in target_list for s in src_val)
            else:
                rule_matched = str(src_val or "").strip().lower() in target_list
        elif op == "is_empty":
            rule_matched = src_val is None or src_val == "" or src_val == []
        elif op == "is_not_empty":
            rule_matched = src_val is not None and src_val != "" and src_val != []
        else:
            rule_matched = True

        if action in ("hide", "skip"):
            matches.append(not rule_matched)
        else:
            matches.append(rule_matched)

    if not matches:
        return True
    if logic == "or":
        return any(matches)
    return all(matches)


def _sanitize_rich_html(raw: Optional[str]) -> str:
    if not raw or not isinstance(raw, str):
        return ""
    s = raw
    # Strip dangerous blocks and tags completely
    s = re.sub(r"<\s*(script|style|iframe|object|embed|form|input|button)[^>]*>.*?<\s*/\s*\1\s*>", "", s, flags=re.IGNORECASE | re.DOTALL)
    s = re.sub(r"<\s*/?\s*(script|style|iframe|object|embed|form|input|button)[^>]*>", "", s, flags=re.IGNORECASE)
    # Strip inline event handlers like onclick=
    s = re.sub(r"\s+on[a-zA-Z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", s, flags=re.IGNORECASE)
    # Strip javascript: or data: URIs
    s = re.sub(r"(href|src)\s*=\s*([\"'])\s*(javascript|vbscript|data):[^\"']*\2", r'\1="#"', s, flags=re.IGNORECASE)
    return s.strip()


def _validate_and_normalize_video_url(raw_url: str) -> str:
    url = str(raw_url or "").strip()
    if not url:
        raise ValueError("Video URL cannot be empty.")
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise ValueError("Video URL must start with http:// or https://.")

    yt_match = re.search(r"(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([a-zA-Z0-9_-]{6,20})", url, re.IGNORECASE)
    if yt_match:
        return f"https://www.youtube.com/embed/{yt_match.group(1)}"

    vimeo_match = re.search(r"vimeo\.com/(?:video/)?(\d{5,15})", url, re.IGNORECASE)
    if vimeo_match:
        return f"https://player.vimeo.com/video/{vimeo_match.group(1)}"

    drive_match = re.search(r"drive\.google\.com/file/d/([a-zA-Z0-9_-]{10,})", url, re.IGNORECASE)
    if drive_match:
        return f"https://drive.google.com/file/d/{drive_match.group(1)}/preview"

    raise ValueError("Unsupported video source. Please enter a valid YouTube, Vimeo, or Google Drive video URL.")


def _evaluate_field_visibility(field: Dict[str, Any], values: Dict[str, Any]) -> bool:
    return _evaluate_conditions_block(field.get("conditions"), values)


def _evaluate_section_visibility(section: Dict[str, Any], values: Dict[str, Any]) -> bool:
    return _evaluate_conditions_block(section.get("conditions"), values)


def _resolve_option_route(field: Dict[str, Any], val: Any) -> Optional[str]:
    val_cfg = field.get("validation_config") if isinstance(field.get("validation_config"), dict) else {}
    if not val_cfg.get("go_to_section_on_answer"):
        return None
    routes = val_cfg.get("option_routes") or field.get("option_routes")
    if not isinstance(routes, dict) or not routes:
        return None
    if val is None or val == "":
        return None
    val_str = str(val).strip()
    if val_str in routes and routes[val_str]:
        return str(routes[val_str])
    val_lower = val_str.lower()
    for k, target in routes.items():
        if str(k).strip().lower() == val_lower and target:
            return str(target)
    if val_str.startswith("Other:") and routes.get("__other__"):
        return str(routes["__other__"])
    return None


def _compute_active_section_path(
    sections_config: List[Dict[str, Any]],
    fields: List[Dict[str, Any]],
    values: Dict[str, Any],
) -> Optional[set]:
    if not sections_config or len(sections_config) <= 1:
        return None

    ordered = sorted(
        [s for s in sections_config if isinstance(s, dict) and s.get("id")],
        key=lambda s: int(s.get("order") or 0),
    )
    if len(ordered) <= 1:
        return None

    id_to_index = {str(s["id"]): idx for idx, s in enumerate(ordered)}
    fields_by_sec: Dict[str, List[Dict[str, Any]]] = {}
    fallback_id = str(ordered[0]["id"])
    for f in sorted(fields, key=lambda item: int(item.get("display_order") or 0)):
        if f.get("enabled") is False:
            continue
        sid = str(f.get("section_id") or fallback_id)
        fields_by_sec.setdefault(sid, []).append(f)

    active_ids = set()
    curr_idx: Optional[int] = 0
    steps = 0

    while curr_idx is not None and 0 <= curr_idx < len(ordered) and steps < len(ordered) * 2:
        steps += 1
        sec = ordered[curr_idx]
        sec_id = str(sec["id"])

        if not _evaluate_section_visibility(sec, values):
            curr_idx = curr_idx + 1 if curr_idx + 1 < len(ordered) else None
            continue

        if sec_id in active_ids:
            # Cycle guard: break cleanly so student/validation cannot loop indefinitely
            break
        active_ids.add(sec_id)

        jump_target: Optional[str] = None
        for f in fields_by_sec.get(sec_id, []):
            if not _evaluate_field_visibility(f, values):
                continue
            target = _resolve_option_route(f, values.get(f.get("field_key")))
            if target and target != "__next__":
                jump_target = target

        # Section-level rule override if no answer route fired
        if not jump_target and isinstance(sec.get("navigation_rules"), list):
            for nr in sec["navigation_rules"]:
                if isinstance(nr, dict) and nr.get("target_section_id"):
                    if _evaluate_conditions_block([nr], values):
                        jump_target = str(nr["target_section_id"])
                        break

        if not jump_target:
            jump_target = sec.get("after_section_action")

        if jump_target == "__submit__" or jump_target == "submit":
            break
        elif jump_target and jump_target not in ("__next__", "next") and jump_target in id_to_index:
            next_idx = id_to_index[jump_target]
            if str(ordered[next_idx]["id"]) in active_ids:
                break
            curr_idx = next_idx
        else:
            curr_idx = curr_idx + 1 if curr_idx + 1 < len(ordered) else None

    return active_ids


class EventsDAL:
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
                return results.to_py()
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

    async def _ensure_notification_columns(self):
        columns = [
            ("notify_students", "INTEGER NOT NULL DEFAULT 0"),
            ("notification_title", "TEXT"),
            ("notification_message", "TEXT"),
            ("notification_image_url", "TEXT"),
            ("notification_priority", "TEXT DEFAULT 'normal'"),
            ("notification_display_mode", "TEXT DEFAULT 'both'"),
            ("notification_schedule", "TEXT"),
            ("notification_cta_label", "TEXT DEFAULT 'Register Now'"),
            ("idempotency_key", "TEXT"),
        ]
        for col_name, col_type in columns:
            try:
                await self.execute(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass
        try:
            await self.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_events_idempotency ON events (idempotency_key) WHERE idempotency_key IS NOT NULL"
            )
        except Exception:
            pass

    async def _ensure_event_files_schema(self):
        try:
            await self.execute(
                """CREATE TABLE IF NOT EXISTS event_files (
                    id TEXT PRIMARY KEY,
                    student_id TEXT REFERENCES users (id) ON DELETE CASCADE,
                    event_id TEXT REFERENCES events (id) ON DELETE SET NULL,
                    submission_id TEXT REFERENCES event_submissions (id) ON DELETE CASCADE,
                    field_key TEXT,
                    provider TEXT NOT NULL DEFAULT 'google_drive',
                    drive_file_id TEXT NOT NULL,
                    drive_folder_id TEXT,
                    original_filename TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    file_scope TEXT NOT NULL DEFAULT 'student_submission',
                    uploaded_by TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
                    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
                )"""
            )
        except Exception:
            pass
        for col_name, col_type in (
            ("drive_file_id", "TEXT"),
            ("drive_folder_id", "TEXT"),
            ("student_id", "TEXT"),
            ("event_id", "TEXT"),
        ):
            try:
                await self.execute(f"ALTER TABLE event_submission_files ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass

    async def register_event_file(
        self,
        file_id: str,
        student_id: Optional[str],
        event_id: Optional[str],
        field_key: Optional[str],
        drive_file_id: str,
        drive_folder_id: Optional[str],
        original_filename: str,
        mime_type: str,
        file_size: int,
        file_scope: str,
        uploaded_by: str,
    ) -> Dict[str, Any]:
        now = _utc_now_iso()
        sql = """INSERT OR REPLACE INTO event_files (
                    id, student_id, event_id, submission_id, field_key, provider,
                    drive_file_id, drive_folder_id, original_filename, mime_type,
                    file_size, file_scope, uploaded_by, created_at
                ) VALUES (?, ?, ?, NULL, ?, 'google_drive', ?, ?, ?, ?, ?, ?, ?, ?)"""
        try:
            await self.execute(
                sql, file_id, student_id, event_id, field_key,
                drive_file_id, drive_folder_id, original_filename,
                mime_type, file_size, file_scope, uploaded_by, now
            )
        except Exception:
            await self._ensure_event_files_schema()
            await self.execute(
                sql, file_id, student_id, event_id, field_key,
                drive_file_id, drive_folder_id, original_filename,
                mime_type, file_size, file_scope, uploaded_by, now
            )
        return await self.get_event_file(file_id) or {
            "id": file_id,
            "student_id": student_id,
            "event_id": event_id,
            "field_key": field_key,
            "drive_file_id": drive_file_id,
            "drive_folder_id": drive_folder_id,
            "original_filename": original_filename,
            "mime_type": mime_type,
            "file_size": file_size,
            "file_scope": file_scope,
            "uploaded_by": uploaded_by,
            "created_at": now,
        }

    async def get_event_file(self, file_id_or_ref: str) -> Optional[Dict[str, Any]]:
        try:
            row = await self.first(
                "SELECT * FROM event_files WHERE id = ? OR drive_file_id = ? LIMIT 1",
                file_id_or_ref,
                file_id_or_ref,
            )
            if row:
                return row
        except Exception:
            pass
        # Fallback to event_submission_files if already attached to a submission
        try:
            sub_file = await self.first(
                """SELECT sf.*, es.student_id as sub_student_id, es.event_id as sub_event_id
                   FROM event_submission_files sf
                   LEFT JOIN event_submissions es ON sf.submission_id = es.id
                   WHERE sf.id = ? OR sf.storage_reference = ? LIMIT 1""",
                file_id_or_ref,
                file_id_or_ref,
            )
            if sub_file:
                return {
                    "id": sub_file["id"],
                    "student_id": sub_file.get("student_id") or sub_file.get("sub_student_id"),
                    "event_id": sub_file.get("event_id") or sub_file.get("sub_event_id"),
                    "submission_id": sub_file.get("submission_id"),
                    "field_key": sub_file.get("field_key"),
                    "provider": "google_drive",
                    "drive_file_id": sub_file.get("drive_file_id") or sub_file.get("storage_reference"),
                    "drive_folder_id": sub_file.get("drive_folder_id"),
                    "original_filename": sub_file.get("original_filename"),
                    "mime_type": sub_file.get("mime_type"),
                    "file_size": sub_file.get("file_size"),
                    "file_scope": "student_submission",
                    "uploaded_by": sub_file.get("student_id") or sub_file.get("sub_student_id"),
                    "created_at": sub_file.get("uploaded_at"),
                }
        except Exception:
            pass
        return None

    async def _sync_event_notification(self, event_id: str, user_id: str, is_update: bool = False, update_msg: Optional[str] = None):
        evt = await self.get_event(event_id)
        if not evt:
            return

        try:
            from notifications_dal import NotificationsDAL
        except ImportError:
            from src.notifications_dal import NotificationsDAL

        notif_dal = NotificationsDAL(self.db)
        existing_notif = await notif_dal.first("SELECT id, status FROM notifications WHERE event_id = ?", event_id)

        title = evt.get("notification_title") or evt.get("title") or "Event Announcement"
        if is_update:
            title = f"Event Updated: {evt.get('title')}"
            short_msg = update_msg or f"Details for {evt.get('title')} have been updated. Please review the schedule and information."
        else:
            short_msg = evt.get("notification_message") or evt.get("short_description") or f"Registration is now open for {evt.get('title')}."

        priority = evt.get("notification_priority") or "normal"
        display_mode = evt.get("notification_display_mode") or "both"
        image_url = evt.get("notification_image_url") or evt.get("poster_url")
        cta_label = evt.get("notification_cta_label") or "Register Now"
        cta_url = f"/student?tab=events&eventId={event_id}"
        aud_type = evt.get("audience_type") or "all"
        aud_payload = evt.get("audience_payload")

        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()
        sched_str = evt.get("notification_schedule")
        sched_dt = _parse_dt_utc(sched_str) if sched_str else None
        if sched_dt and sched_dt > now_dt and not is_update:
            target_status = "scheduled"
            target_pub_at = sched_dt.isoformat()
            target_sched_at = sched_dt.isoformat()
        else:
            target_status = "published"
            target_pub_at = now
            target_sched_at = None

        if existing_notif:
            db_aud_type = "custom" if aud_type == "mentor_mentees" else aud_type
            await notif_dal.execute(
                """UPDATE notifications SET
                    title = ?, short_message = ?, priority = ?, display_mode = ?,
                    image_url = ?, cta_label = ?, cta_url = ?, audience_type = ?, audience_payload = ?,
                    status = ?, scheduled_at = ?, published_at = COALESCE(published_at, ?), updated_at = ?
                   WHERE id = ?""",
                title, short_msg, priority, display_mode, image_url, cta_label, cta_url,
                db_aud_type, json.dumps(aud_payload) if isinstance(aud_payload, (dict, list)) else aud_payload,
                target_status, target_sched_at, target_pub_at, now, existing_notif["id"]
            )
            await notif_dal.execute("DELETE FROM notification_recipients WHERE notification_id = ?", existing_notif["id"])
            await notif_dal._populate_recipients(existing_notif["id"], db_aud_type, aud_payload)
            if is_update:
                # Surface explicit event updates cleanly to recipients
                await notif_dal.execute(
                    "UPDATE notification_recipients SET is_read = 0, is_dismissed = 0 WHERE notification_id = ?",
                    existing_notif["id"],
                )
        else:
            await notif_dal.create_notification({
                "title": title,
                "short_message": short_msg,
                "category": "announcement",
                "priority": priority,
                "display_mode": display_mode,
                "image_url": image_url,
                "cta_label": cta_label,
                "cta_url": cta_url,
                "event_id": event_id,
                "audience_type": aud_type,
                "audience_payload": aud_payload,
                "status": target_status,
                "scheduled_at": target_sched_at,
                "published_at": target_pub_at,
            }, user_id)

    # =========================================================================
    # 1. Event CRUD & Lifecycle
    # =========================================================================

    async def create_event(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        idempotency_key = str(data.get("idempotency_key") or "").strip() or None
        if idempotency_key:
            try:
                existing_idemp = await self.first(
                    "SELECT id FROM events WHERE idempotency_key = ?",
                    idempotency_key,
                )
                if existing_idemp and existing_idemp.get("id"):
                    existing_evt = await self.get_event(existing_idemp["id"])
                    if existing_evt:
                        existing_evt["current_form"] = await self.get_current_form_version(existing_evt["id"])
                        return existing_evt
            except Exception:
                await self._ensure_notification_columns()

        event_id = str(uuid.uuid4())
        now = _utc_now_iso()

        title = str(data.get("title", "")).strip()
        if not title:
            raise ValueError("Event title is required.")

        start_at = str(data.get("event_start_at", "")).strip()
        end_at = str(data.get("event_end_at", "")).strip()
        reg_start = str(data.get("registration_start_at", "")).strip()
        reg_deadline = str(data.get("registration_deadline", "")).strip()

        if not start_at or not end_at:
            raise ValueError("Event start and end dates are required.")
        if not reg_start or not reg_deadline:
            raise ValueError("Registration start date and deadline are required.")

        if end_at < start_at:
            raise ValueError("Event end date cannot be earlier than event start date.")
        if reg_deadline < reg_start:
            raise ValueError("Registration deadline cannot be earlier than registration start date.")

        gallery_images = data.get("gallery_images")
        gallery_images_str = json.dumps(gallery_images) if isinstance(gallery_images, list) else gallery_images

        attachments = data.get("attachments")
        attachments_str = json.dumps(attachments) if isinstance(attachments, list) else attachments

        reg_capacity = data.get("registration_capacity")
        if reg_capacity is not None and str(reg_capacity).strip() != "":
            try:
                reg_capacity = int(reg_capacity)
                if reg_capacity <= 0:
                    reg_capacity = None
            except Exception:
                reg_capacity = None
        else:
            reg_capacity = None

        raw_mode = str(data.get("mode", "Offline") or "Offline").strip().capitalize()
        mode_val = raw_mode if raw_mode in ("Offline", "Online", "Hybrid") else "Offline"

        poster_val = data.get("poster_url") or data.get("banner_image_url")
        meeting_val = data.get("meeting_url") or data.get("online_meeting_url")

        notify_students_val = 1 if data.get("notify_students") else 0
        notif_title = data.get("notification_title")
        notif_msg = data.get("notification_message")
        notif_img = data.get("notification_image_url") or poster_val
        notif_prio = data.get("notification_priority", "normal")
        notif_disp = data.get("notification_display_mode", "both")
        notif_sched = data.get("notification_schedule")
        notif_cta = data.get("notification_cta_label") or "Register Now"

        insert_sql = """INSERT INTO events (
            id, title, subtitle, custom_category, short_description, detailed_description, category,
            poster_url, document_url, gallery_images, attachments, venue, mode, meeting_url,
            event_start_at, event_end_at, registration_start_at, registration_deadline,
            academic_year, semester_id, status, allow_multiple_responses,
            allow_edit_submission, close_after_deadline, is_registration_enabled,
            contact_person, contact_email, contact_phone, instructions, terms_conditions,
            form_layout_mode, registration_capacity,
            notify_students, notification_title, notification_message, notification_image_url,
            notification_priority, notification_display_mode, notification_schedule,
            notification_cta_label, idempotency_key,
            created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""

        insert_args = (
            event_id,
            title,
            data.get("subtitle"),
            data.get("custom_category"),
            data.get("short_description"),
            data.get("detailed_description"),
            data.get("category", "Workshop"),
            poster_val,
            data.get("document_url"),
            gallery_images_str,
            attachments_str,
            data.get("venue"),
            mode_val,
            meeting_val,
            start_at,
            end_at,
            reg_start,
            reg_deadline,
            data.get("academic_year"),
            data.get("semester_id"),
            1 if data.get("allow_multiple_responses") else 0,
            1 if data.get("allow_edit_submission") else 0,
            0 if data.get("close_after_deadline") is False else 1,
            0 if data.get("is_registration_enabled") is False else 1,
            data.get("contact_person"),
            data.get("contact_email"),
            data.get("contact_phone"),
            data.get("instructions"),
            data.get("terms_conditions"),
            data.get("form_layout_mode", "single_page"),
            reg_capacity,
            notify_students_val,
            notif_title,
            notif_msg,
            notif_img,
            notif_prio,
            notif_disp,
            notif_sched,
            notif_cta,
            idempotency_key,
            user_id,
            now,
            now,
        )

        try:
            await self.execute(insert_sql, *insert_args)
        except Exception:
            await self._ensure_notification_columns()
            await self.execute(insert_sql, *insert_args)

        # Set target audience (default 'all')
        audience_type = data.get("audience_type", "all")
        audience_payload = data.get("audience_payload")
        await self.set_event_audience(event_id, audience_type, audience_payload)

        # Create initial draft form version (v1) including sections_config if provided
        version_id = str(uuid.uuid4())
        sections_cfg = data.get("sections_config")
        sections_json = json.dumps(sections_cfg) if isinstance(sections_cfg, list) else None
        await self.execute(
            """INSERT INTO event_form_versions (id, event_id, version_number, status, sections_config, created_by, created_at)
            VALUES (?, ?, 1, 'draft', ?, ?, ?)""",
            version_id,
            event_id,
            sections_json,
            user_id,
            now,
        )

        # If initial fields provided, save them
        initial_fields = data.get("form_fields") or []
        if initial_fields:
            await self._insert_form_fields(version_id, initial_fields)

        created = await self.get_event(event_id)
        if created:
            created["current_form"] = await self.get_current_form_version(event_id)
        return created

    async def update_event(self, event_id: str, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        existing = await self.get_event(event_id)
        if not existing:
            raise ValueError("Event not found.")

        def pick(key: str, default: Any = None):
            return data[key] if key in data else existing.get(key, default)

        now = _utc_now_iso()
        start_at = str(pick("event_start_at") or "").strip()
        end_at = str(pick("event_end_at") or "").strip()
        reg_start = str(pick("registration_start_at") or "").strip()
        reg_deadline = str(pick("registration_deadline") or "").strip()

        if end_at < start_at:
            raise ValueError("Event end date cannot be earlier than event start date.")
        if reg_deadline < reg_start:
            raise ValueError("Registration deadline cannot be earlier than registration start date.")

        gallery_images = pick("gallery_images")
        gallery_images_str = json.dumps(gallery_images) if isinstance(gallery_images, list) else gallery_images

        attachments = pick("attachments")
        attachments_str = json.dumps(attachments) if isinstance(attachments, list) else attachments

        reg_capacity = pick("registration_capacity")
        if reg_capacity is not None and str(reg_capacity).strip() != "":
            try:
                reg_capacity = int(reg_capacity)
                if reg_capacity <= 0:
                    reg_capacity = None
            except Exception:
                reg_capacity = None
        else:
            reg_capacity = None

        raw_mode = str(pick("mode", "Offline") or "Offline").strip().capitalize()
        mode_val = raw_mode if raw_mode in ("Offline", "Online", "Hybrid") else existing.get("mode", "Offline")

        notify_students_val = 1 if (data["notify_students"] if "notify_students" in data else existing.get("notify_students")) else 0
        notif_title = pick("notification_title")
        notif_msg = pick("notification_message")
        notif_img = pick("notification_image_url")
        notif_prio = pick("notification_priority", "normal") or "normal"
        notif_disp = pick("notification_display_mode", "both") or "both"
        notif_sched = pick("notification_schedule")
        notif_cta = pick("notification_cta_label", "Register Now") or "Register Now"

        update_sql = """UPDATE events SET
            title = COALESCE(?, title),
            subtitle = ?,
            custom_category = ?,
            short_description = ?,
            detailed_description = ?,
            category = COALESCE(?, category),
            poster_url = ?,
            document_url = ?,
            gallery_images = ?,
            attachments = ?,
            venue = ?,
            mode = COALESCE(?, mode),
            meeting_url = ?,
            event_start_at = ?,
            event_end_at = ?,
            registration_start_at = ?,
            registration_deadline = ?,
            academic_year = ?,
            semester_id = ?,
            allow_multiple_responses = ?,
            allow_edit_submission = ?,
            close_after_deadline = ?,
            is_registration_enabled = ?,
            contact_person = ?,
            contact_email = ?,
            contact_phone = ?,
            instructions = ?,
            terms_conditions = ?,
            form_layout_mode = ?,
            registration_capacity = ?,
            notify_students = ?,
            notification_title = ?,
            notification_message = ?,
            notification_image_url = ?,
            notification_priority = ?,
            notification_display_mode = ?,
            notification_schedule = ?,
            notification_cta_label = ?,
            updated_at = ?
        WHERE id = ?"""

        poster_val = (
            data["poster_url"]
            if "poster_url" in data
            else (data["banner_image_url"] if "banner_image_url" in data else existing.get("poster_url"))
        )
        meeting_val = (
            data["meeting_url"]
            if "meeting_url" in data
            else (data["online_meeting_url"] if "online_meeting_url" in data else existing.get("meeting_url"))
        )
        update_args = (
            pick("title"),
            pick("subtitle"),
            pick("custom_category"),
            pick("short_description"),
            pick("detailed_description"),
            pick("category"),
            poster_val,
            pick("document_url"),
            gallery_images_str,
            attachments_str,
            pick("venue"),
            mode_val,
            meeting_val,
            start_at,
            end_at,
            reg_start,
            reg_deadline,
            pick("academic_year"),
            pick("semester_id"),
            1 if pick("allow_multiple_responses") else 0,
            1 if pick("allow_edit_submission") else 0,
            0 if pick("close_after_deadline") is False else 1,
            0 if pick("is_registration_enabled") is False else 1,
            pick("contact_person"),
            pick("contact_email"),
            pick("contact_phone"),
            pick("instructions"),
            pick("terms_conditions"),
            pick("form_layout_mode", "single_page") or "single_page",
            reg_capacity,
            notify_students_val,
            notif_title,
            notif_msg,
            notif_img,
            notif_prio,
            notif_disp,
            notif_sched,
            notif_cta,
            now,
            event_id,
        )

        try:
            await self.execute(update_sql, *update_args)
        except Exception:
            await self._ensure_notification_columns()
            await self.execute(update_sql, *update_args)

        if "audience_type" in data:
            await self.set_event_audience(event_id, data["audience_type"], data.get("audience_payload"))

        # Optional explicit update notification dispatch OR sync notification if published & enabled
        if data.get("send_update_notification"):
            try:
                await self._sync_event_notification(event_id, user_id, is_update=True, update_msg=data.get("update_message"))
            except Exception as n_err:
                logger.warning("Failed to send event update notification: %s", n_err)
        elif existing.get("status") == "published" and notify_students_val:
            try:
                await self._sync_event_notification(event_id, user_id, is_update=False)
            except Exception as n_err:
                logger.warning("Failed to sync published event notification: %s", n_err)

        updated = await self.get_event(event_id)
        if updated:
            updated["current_form"] = await self.get_current_form_version(event_id)
        return updated

    async def delete_event(self, event_id: str, allow_archive: bool = True) -> Dict[str, Any]:
        existing = await self.get_event(event_id)
        if not existing:
            raise ValueError("Event not found.")

        # Check if event has student submissions or submitted files
        sub_row = await self.first("SELECT COUNT(*) as cnt FROM event_submissions WHERE event_id = ?", event_id)
        sub_count = int((sub_row or {}).get("cnt") or 0)
        file_row = await self.first("SELECT COUNT(*) as cnt FROM event_submission_files WHERE event_id = ?", event_id)
        sub_file_count = int((file_row or {}).get("cnt") or 0)

        now = _utc_now_iso()

        if sub_count > 0 or sub_file_count > 0:
            if allow_archive:
                # Soft delete by archiving to preserve responses, uploaded evidence, and audit integrity
                await self.execute("UPDATE events SET status = 'archived', updated_at = ? WHERE id = ?", now, event_id)
                try:
                    await self.execute(
                        "UPDATE notifications SET status = 'archived', updated_at = ? WHERE event_id = ?",
                        now,
                        event_id,
                    )
                except Exception:
                    pass
                return {
                    "action": "archived",
                    "event_id": event_id,
                    "total_submissions": sub_count,
                    "message": f"Event '{existing['title']}' has {sub_count} student submission(s); safely archived to preserve historical records.",
                }
            else:
                raise ValueError(f"Cannot permanently delete event with {sub_count} submissions. Archive instead.")

        # Event has 0 registrations/submissions: perform clean permanent deletion without leaving orphans
        try:
            notifs = await self.query("SELECT id FROM notifications WHERE event_id = ?", event_id)
            for n in notifs:
                await self.execute("DELETE FROM notification_recipients WHERE notification_id = ?", n["id"])
            await self.execute("DELETE FROM notifications WHERE event_id = ?", event_id)
        except Exception as n_err:
            logger.warning("Cleanup of event notifications during deletion failed: %s", n_err)

        try:
            await self.execute("DELETE FROM event_files WHERE event_id = ? AND submission_id IS NULL", event_id)
        except Exception:
            pass

        versions = await self.query("SELECT id FROM event_form_versions WHERE event_id = ?", event_id)
        for v in versions:
            await self.execute("DELETE FROM event_form_fields WHERE form_version_id = ?", v["id"])
        await self.execute("DELETE FROM event_form_versions WHERE event_id = ?", event_id)
        await self.execute("DELETE FROM event_audiences WHERE event_id = ?", event_id)
        await self.execute("DELETE FROM events WHERE id = ?", event_id)
        return {
            "action": "deleted",
            "event_id": event_id,
            "message": f"Event '{existing['title']}' permanently deleted.",
        }

    async def duplicate_event(self, event_id: str, user_id: str) -> Dict[str, Any]:
        existing = await self.get_event(event_id)
        if not existing:
            raise ValueError("Source event not found.")

        curr_form = await self.get_current_form_version(event_id)
        payload = {
            "title": f"{existing['title']} (Copy)",
            "subtitle": existing.get("subtitle"),
            "custom_category": existing.get("custom_category"),
            "short_description": existing.get("short_description"),
            "detailed_description": existing.get("detailed_description"),
            "category": existing.get("category") or "Workshop",
            "poster_url": existing.get("poster_url"),
            "banner_image_url": existing.get("banner_image_url"),
            "gallery_images": existing.get("gallery_images") or [],
            "attachments": existing.get("attachments") or [],
            "venue": existing.get("venue"),
            "mode": existing.get("mode") or "Offline",
            "meeting_url": existing.get("meeting_url"),
            "online_meeting_url": existing.get("online_meeting_url"),
            "event_start_at": existing.get("event_start_at"),
            "event_end_at": existing.get("event_end_at"),
            "registration_start_at": existing.get("registration_start_at"),
            "registration_deadline": existing.get("registration_deadline"),
            "academic_year": existing.get("academic_year"),
            "semester_id": existing.get("semester_id"),
            "status": "draft",
            "allow_multiple_responses": existing.get("allow_multiple_responses", False),
            "allow_edit_submission": existing.get("allow_edit_submission", False),
            "close_after_deadline": existing.get("close_after_deadline", True),
            "is_registration_enabled": existing.get("is_registration_enabled", True),
            "contact_person": existing.get("contact_person"),
            "contact_email": existing.get("contact_email"),
            "contact_phone": existing.get("contact_phone"),
            "instructions": existing.get("instructions"),
            "terms_conditions": existing.get("terms_conditions"),
            "form_layout_mode": existing.get("form_layout_mode") or "single_page",
            "registration_capacity": existing.get("registration_capacity"),
            "audience_type": existing.get("audience_type") or "all",
            "audience_payload": existing.get("audience_payload"),
        }
        cloned = await self.create_event(payload, user_id)
        if curr_form:
            cloned_fields = []
            for f in curr_form.get("fields", []):
                f_copy = dict(f)
                f_copy["id"] = str(uuid.uuid4())
                cloned_fields.append(f_copy)
            await self.save_form_fields(
                cloned["id"],
                cloned_fields,
                user_id,
                sections_config=curr_form.get("sections_config") or [],
                form_settings=curr_form.get("form_settings"),
            )
            cloned = await self.get_event(cloned["id"])
            if cloned:
                cloned["current_form"] = await self.get_current_form_version(cloned["id"])
        return cloned

    async def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT e.*,
                   u.full_name as creator_name,
                   u.email as creator_email,
                   s.display_name as semester_display_name,
                   (SELECT COUNT(*) FROM event_submissions sub WHERE sub.event_id = e.id) as total_submissions
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN semesters s ON e.semester_id = s.id
            WHERE e.id = ?
        """
        evt = await self.first(sql, event_id)
        if not evt:
            return None

        # Fetch audience
        aud = await self.first("SELECT audience_type, audience_payload FROM event_audiences WHERE event_id = ?", event_id)
        if aud:
            evt["audience_type"] = aud.get("audience_type", "all")
            payload_raw = aud.get("audience_payload")
            if payload_raw:
                try:
                    evt["audience_payload"] = json.loads(payload_raw) if isinstance(payload_raw, str) else payload_raw
                except Exception:
                    evt["audience_payload"] = payload_raw
            else:
                evt["audience_payload"] = None
        else:
            evt["audience_type"] = "all"
            evt["audience_payload"] = None

        return _enrich_event_record(evt)

    async def list_events(
        self,
        status: Optional[str] = None,
        search: Optional[str] = None,
        semester_id: Optional[str] = None,
        academic_year: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT e.*,
                   u.full_name as creator_name,
                   s.display_name as semester_display_name,
                   (SELECT COUNT(*) FROM event_submissions sub WHERE sub.event_id = e.id) as total_submissions
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN semesters s ON e.semester_id = s.id
            WHERE 1=1
        """
        params = []
        if status and status != "all":
            sql += " AND e.status = ?"
            params.append(status)
        if semester_id and semester_id != "all":
            sql += " AND e.semester_id = ?"
            params.append(semester_id)
        if academic_year and academic_year != "all":
            sql += " AND e.academic_year = ?"
            params.append(academic_year)
        if search:
            sql += " AND (e.title LIKE ? OR e.short_description LIKE ? OR e.category LIKE ? OR e.subtitle LIKE ?)"
            s_pat = f"%{search.strip()}%"
            params.extend([s_pat, s_pat, s_pat, s_pat])

        sql += " ORDER BY e.created_at DESC"
        events = await self.query(sql, *params)

        # Enrich with audience summary & parsed fields
        for evt in events:
            aud = await self.first("SELECT audience_type FROM event_audiences WHERE event_id = ?", evt["id"])
            evt["audience_type"] = aud.get("audience_type", "all") if aud else "all"
            _enrich_event_record(evt)

        return events

    async def change_event_status(self, event_id: str, new_status: str, user_id: str) -> Dict[str, Any]:
        valid_statuses = ("draft", "published", "closed", "archived")
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status '{new_status}'. Allowed: {valid_statuses}")

        existing = await self.get_event(event_id)
        if not existing:
            raise ValueError("Event not found.")

        now = _utc_now_iso()

        if new_status == "published":
            # Ensure event has at least one form version with at least 1 field
            curr_form = await self.get_current_form_version(event_id)
            if not curr_form or not curr_form.get("fields"):
                raise ValueError("Cannot publish an event without any form fields. Please configure at least one form field.")

            # Mark current form version as published
            await self.execute(
                "UPDATE event_form_versions SET status = 'published', published_at = COALESCE(published_at, ?) WHERE id = ?",
                now,
                curr_form["id"],
            )

        await self.execute("UPDATE events SET status = ?, updated_at = ? WHERE id = ?", new_status, now, event_id)

        updated = await self.get_event(event_id)

        # When published and notify_students is enabled, automatically create/activate event notification
        if new_status == "published" and updated and updated.get("notify_students"):
            try:
                await self._sync_event_notification(event_id, user_id)
            except Exception as n_err:
                logger.warning("Failed to auto-dispatch event publish notification: %s", n_err)
        elif new_status == "archived":
            try:
                await self.execute("UPDATE notifications SET status = 'archived', updated_at = ? WHERE event_id = ?", now, event_id)
            except Exception:
                pass

        return updated

    # =========================================================================
    # 2. Audience Management & Eligibility
    # =========================================================================

    async def _resolve_mentor_record(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rows = await self.query(
            """SELECT u.id as mentor_id, u.full_name as mentor_name, u.email as mentor_email, u.role as mentor_role,
                      COUNT(DISTINCT ma.student_id) as mentee_count
               FROM users u
               JOIN mentor_assignments ma ON ma.mentor_id = u.id AND ma.is_active = 1
               JOIN users su ON su.id = ma.student_id AND su.role = 'student' AND su.is_active = 1
               JOIN student_profiles sp ON sp.user_id = su.id
               WHERE u.is_active = 1
               GROUP BY u.id"""
        )
        m_id = str(payload.get("mentor_id") or "").strip()
        if m_id:
            for r in rows:
                if str(r.get("mentor_id")) == m_id:
                    return r

        m_email = str(payload.get("mentor_email") or "").strip().lower()
        if m_email:
            for r in rows:
                if str(r.get("mentor_email") or "").strip().lower() == m_email:
                    return r

        m_key = str(payload.get("mentor_key") or "").strip().lower()
        m_name = str(payload.get("mentor_name") or "").strip().lower()
        tokens_map = {
            "lekha": ("lekha",),
            "lurdhmary": ("lurdhu", "lurdh"),
            "pachhaiammal_priya": ("priya", "pachai", "pachhai", "hod.cce"),
        }
        search_terms = tokens_map.get(m_key, tuple(t for t in (m_key, m_name) if t))
        for r in rows:
            hay = f"{r.get('mentor_name', '')} {r.get('mentor_email', '')}".lower()
            if any(tok in hay for tok in search_terms):
                return r
        return None

    async def get_audience_options_summary(self) -> Dict[str, Any]:
        total_row = await self.first(
            """SELECT COUNT(DISTINCT sp.user_id) as cnt
               FROM student_profiles sp
               JOIN users u ON sp.user_id = u.id
               WHERE u.role = 'student' AND u.is_active = 1"""
        )
        total_students = int((total_row or {}).get("cnt") or 0)

        mentor_rows = await self.query(
            """SELECT u.id as mentor_id, u.full_name as mentor_name, u.email as mentor_email, u.role as mentor_role,
                      COUNT(DISTINCT ma.student_id) as mentee_count
               FROM users u
               JOIN mentor_assignments ma ON ma.mentor_id = u.id AND ma.is_active = 1
               JOIN users su ON su.id = ma.student_id AND su.role = 'student' AND su.is_active = 1
               JOIN student_profiles sp ON sp.user_id = su.id
               WHERE u.is_active = 1
               GROUP BY u.id
               ORDER BY u.full_name ASC"""
        )

        def _find_mentor(*needles: str) -> Optional[Dict[str, Any]]:
            for r in mentor_rows:
                hay = f"{r.get('mentor_name', '')} {r.get('mentor_email', '')}".lower()
                if any(n in hay for n in needles):
                    return r
            return None

        lekha = _find_mentor("lekha")
        lurdh = _find_mentor("lurdhu", "lurdh")
        priya = _find_mentor("priya", "pachai", "pachhai", "hod.cce")

        options: List[Dict[str, Any]] = [
            {
                "id": "all",
                "audience_type": "all",
                "mentor_key": "all",
                "title": f"All {total_students} Students",
                "subtitle": "Complete CCE Cohort",
                "description": f"Targets all {total_students} enrolled CCE students across every mentor.",
                "student_count": total_students,
                "audience_payload": None,
            }
        ]

        canonical_mentors = [
            ("lekha", "Lekha Mentees", "Students allocated under mentor Lekha", lekha),
            ("lurdhmary", "Lurdhmary Mentees", "Students allocated under mentor Lurdhmary", lurdh),
            ("pachhaiammal_priya", "Pachhaiammal Priya Mentees", "Students allocated under mentor Pachhaiammal Priya", priya),
        ]

        for m_key, card_title, card_desc, rec in canonical_mentors:
            cnt = int((rec or {}).get("mentee_count") or 0)
            m_id = (rec or {}).get("mentor_id")
            m_name = (rec or {}).get("mentor_name") or card_title.replace(" Mentees", "")
            m_email = (rec or {}).get("mentor_email")
            options.append({
                "id": f"mentor_{m_key}",
                "audience_type": "custom",
                "mentor_key": m_key,
                "mentor_id": m_id,
                "mentor_name": m_name,
                "mentor_email": m_email,
                "title": card_title,
                "subtitle": m_name,
                "description": card_desc,
                "student_count": cnt,
                "audience_payload": {
                    "mode": "mentor_mentees",
                    "mentor_key": m_key,
                    "mentor_id": m_id,
                    "mentor_name": m_name,
                    "mentor_email": m_email,
                },
            })

        return {"total_students": total_students, "options": options}

    async def set_event_audience(self, event_id: str, audience_type: str, audience_payload: Any) -> Dict[str, Any]:
        valid_types = ("all", "mentor_mentees", "specific_students", "section", "academic_year", "custom")
        if audience_type not in valid_types:
            raise ValueError(f"Invalid audience type '{audience_type}'. Allowed: {valid_types}")

        stored_type = "custom" if audience_type == "mentor_mentees" else audience_type
        normalized_payload = audience_payload
        if isinstance(audience_payload, str):
            try:
                parsed = json.loads(audience_payload)
                if isinstance(parsed, (dict, list)):
                    normalized_payload = parsed
            except Exception:
                pass

        if stored_type == "custom" and isinstance(normalized_payload, dict) and (
            audience_type == "mentor_mentees"
            or normalized_payload.get("mode") == "mentor_mentees"
            or normalized_payload.get("mentor_id")
            or normalized_payload.get("mentor_key")
        ):
            rec = await self._resolve_mentor_record(normalized_payload)
            normalized_payload = {
                **normalized_payload,
                "mode": "mentor_mentees",
                "mentor_id": (rec or {}).get("mentor_id") or normalized_payload.get("mentor_id"),
                "mentor_name": (rec or {}).get("mentor_name") or normalized_payload.get("mentor_name"),
                "mentor_email": (rec or {}).get("mentor_email") or normalized_payload.get("mentor_email"),
            }

        payload_str = json.dumps(normalized_payload) if normalized_payload is not None else None

        existing = await self.first("SELECT id FROM event_audiences WHERE event_id = ?", event_id)
        if existing:
            await self.execute(
                "UPDATE event_audiences SET audience_type = ?, audience_payload = ? WHERE event_id = ?",
                stored_type,
                payload_str,
                event_id,
            )
        else:
            aud_id = str(uuid.uuid4())
            await self.execute(
                "INSERT INTO event_audiences (id, event_id, audience_type, audience_payload, created_at) VALUES (?, ?, ?, ?, ?)",
                aud_id,
                event_id,
                stored_type,
                payload_str,
                _utc_now_iso(),
            )

        return {"event_id": event_id, "audience_type": stored_type, "audience_payload": normalized_payload}

    async def check_student_eligibility(self, event_id: str, student_user_id: str) -> bool:
        aud = await self.first("SELECT audience_type, audience_payload FROM event_audiences WHERE event_id = ?", event_id)
        if not aud or aud.get("audience_type") == "all":
            return True

        aud_type = aud.get("audience_type")
        payload = aud.get("audience_payload")
        if not payload:
            return True

        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                pass

        # Dynamic mentor mentee allocation check (uses mentor_assignments table directly)
        if aud_type in ("custom", "mentor_mentees") and isinstance(payload, dict) and (
            payload.get("mode") == "mentor_mentees" or payload.get("mentor_id") or payload.get("mentor_key")
        ):
            rec = await self._resolve_mentor_record(payload)
            mentor_id = (rec or {}).get("mentor_id") or payload.get("mentor_id")
            if not mentor_id:
                return False
            assigned = await self.first(
                """SELECT 1 as ok
                   FROM mentor_assignments ma
                   JOIN users u ON u.id = ma.student_id
                   WHERE ma.mentor_id = ? AND ma.student_id = ? AND ma.is_active = 1 AND u.role = 'student' AND u.is_active = 1
                   LIMIT 1""",
                mentor_id,
                student_user_id,
            )
            return bool(assigned)

        profile = await self.first(
            """SELECT sp.*, u.email, u.full_name
               FROM student_profiles sp
               JOIN users u ON sp.user_id = u.id
               WHERE sp.user_id = ?""",
            student_user_id,
        )
        if not profile:
            return False

        reg_num = (profile.get("register_number") or "").strip().upper()
        section = (profile.get("section") or "").strip().upper()
        year_val = str(profile.get("year") or "").strip()
        batch = (profile.get("batch") or "").strip()

        if aud_type == "specific_students":
            if isinstance(payload, list):
                # Check student_user_id or register_number
                target_set = {str(x).strip().upper() for x in payload}
                return (student_user_id.upper() in target_set) or (reg_num in target_set)
            return False

        elif aud_type == "section":
            if isinstance(payload, list):
                sections = [str(s).strip().upper() for s in payload]
                return section in sections
            elif isinstance(payload, str):
                return section == payload.strip().upper()
            return False

        elif aud_type == "academic_year":
            if isinstance(payload, list):
                years = [str(y).strip() for y in payload]
                return (year_val in years) or (batch in years)
            elif isinstance(payload, str):
                return (year_val == payload.strip()) or (batch == payload.strip())
            return False

        elif aud_type == "custom":
            # Check sections, batches, or explicit students
            if isinstance(payload, dict):
                if "students" in payload and payload["students"]:
                    if reg_num in [str(x).upper() for x in payload["students"]]:
                        return True
                if "sections" in payload and payload["sections"]:
                    if section in [str(x).upper() for x in payload["sections"]]:
                        return True
                if "years" in payload and payload["years"]:
                    if year_val in [str(x) for x in payload["years"]]:
                        return True
            return False

        return False

    # =========================================================================
    # 3. Dynamic Form Builder & Form Versioning
    # =========================================================================

    def _parse_field_dict(self, f: Any) -> Dict[str, Any]:
        f_dict = _row_to_dict(f)
        for json_key in ("validation_config", "options_config", "conditions", "rating_config", "repeatable_config"):
            if f_dict.get(json_key) and isinstance(f_dict[json_key], str):
                try:
                    f_dict[json_key] = json.loads(f_dict[json_key])
                except Exception:
                    pass
        if not f_dict.get("options_config"):
            val_cfg = f_dict.get("validation_config")
            if isinstance(val_cfg, dict) and val_cfg.get("options"):
                f_dict["options_config"] = _normalize_options_list(val_cfg["options"])
            elif f_dict.get("options"):
                f_dict["options_config"] = _normalize_options_list(f_dict["options"])
        f_dict["required"] = bool(f_dict.get("required"))
        f_dict["enabled"] = False if f_dict.get("enabled") == 0 else True
        if not f_dict.get("section_id"):
            f_dict["section_id"] = "default"
        return f_dict

    async def _ensure_form_settings_column(self):
        try:
            await self.execute("ALTER TABLE event_form_versions ADD COLUMN form_settings TEXT")
        except Exception:
            pass

    def _parse_version_dict(self, ver: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not ver:
            return None
        v_dict = _row_to_dict(ver)
        if v_dict.get("sections_config") and isinstance(v_dict["sections_config"], str):
            try:
                v_dict["sections_config"] = json.loads(v_dict["sections_config"])
            except Exception:
                v_dict["sections_config"] = []
        elif not v_dict.get("sections_config"):
            v_dict["sections_config"] = []

        if v_dict.get("form_settings") and isinstance(v_dict["form_settings"], str):
            try:
                v_dict["form_settings"] = json.loads(v_dict["form_settings"])
            except Exception:
                v_dict["form_settings"] = None
        elif not isinstance(v_dict.get("form_settings"), dict):
            v_dict["form_settings"] = None
        return v_dict

    async def get_current_form_version(self, event_id: str) -> Optional[Dict[str, Any]]:
        # Get the latest version number
        ver = await self.first(
            "SELECT * FROM event_form_versions WHERE event_id = ? ORDER BY version_number DESC LIMIT 1",
            event_id,
        )
        if not ver:
            return None

        ver = self._parse_version_dict(ver)

        fields = await self.query(
            "SELECT * FROM event_form_fields WHERE form_version_id = ? ORDER BY display_order ASC, created_at ASC",
            ver["id"],
        )

        ver["fields"] = [self._parse_field_dict(f) for f in fields]
        return ver

    async def get_form_version_by_id(self, form_version_id: str) -> Optional[Dict[str, Any]]:
        ver = await self.first("SELECT * FROM event_form_versions WHERE id = ?", form_version_id)
        if not ver:
            return None

        ver = self._parse_version_dict(ver)

        fields = await self.query(
            "SELECT * FROM event_form_fields WHERE form_version_id = ? ORDER BY display_order ASC, created_at ASC",
            form_version_id,
        )
        ver["fields"] = [self._parse_field_dict(f) for f in fields]
        return ver

    async def list_form_versions(self, event_id: str) -> List[Dict[str, Any]]:
        versions = await self.query(
            """SELECT v.*,
                      (SELECT COUNT(*) FROM event_submissions s WHERE s.form_version_id = v.id) as submissions_count,
                      (SELECT COUNT(*) FROM event_form_fields f WHERE f.form_version_id = v.id) as fields_count
               FROM event_form_versions v
               WHERE v.event_id = ?
               ORDER BY v.version_number DESC""",
            event_id,
        )
        return [self._parse_version_dict(v) for v in versions]

    async def save_form_fields(
        self,
        event_id: str,
        fields: List[Dict[str, Any]],
        user_id: str,
        sections_config: Optional[List[Dict[str, Any]]] = None,
        form_settings: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Saves form fields for an event.
        - If current version already has submissions, creates a new form version (version_number + 1)
          to preserve historical submission structures.
        - If current version has 0 submissions, updates the current version in place.
        """
        event = await self.get_event(event_id)
        if not event:
            raise ValueError("Event not found.")

        await self._ensure_form_settings_column()
        current_ver = await self.get_current_form_version(event_id)
        now = _utc_now_iso()

        # Validate & sanitize Google Forms content blocks before persisting
        cleaned_fields: List[Dict[str, Any]] = []
        for raw_f in fields:
            f = dict(raw_f)
            ftype = str(f.get("field_type") or "text")
            v_cfg = dict(f.get("validation_config") or {}) if isinstance(f.get("validation_config"), dict) else {}

            if ftype == "video_block":
                m_cfg = dict(v_cfg.get("media_config") or {}) if isinstance(v_cfg.get("media_config"), dict) else {}
                vid_url = str(m_cfg.get("video_url") or f.get("default_value") or f.get("placeholder") or "").strip()
                if vid_url:
                    embed_url = _validate_and_normalize_video_url(vid_url)
                    m_cfg["video_url"] = vid_url
                    m_cfg["embed_url"] = embed_url
                    v_cfg["media_config"] = m_cfg
                    f["default_value"] = embed_url

            if ftype in ("description", "rich_text_block") and isinstance(v_cfg.get("rich_html"), str):
                v_cfg["rich_html"] = _sanitize_rich_html(v_cfg["rich_html"])

            f["validation_config"] = v_cfg
            cleaned_fields.append(f)
        fields = cleaned_fields

        # Check if current version has submissions
        has_submissions = False
        target_version_id = None

        if current_ver:
            sub_count = (await self.first(
                "SELECT COUNT(*) as cnt FROM event_submissions WHERE form_version_id = ?",
                current_ver["id"],
            ))["cnt"]
            has_submissions = sub_count > 0

        sections_json = json.dumps(sections_config) if isinstance(sections_config, list) else None
        existing_fs = current_ver.get("form_settings") if current_ver else None
        effective_fs = form_settings if isinstance(form_settings, dict) else (existing_fs if isinstance(existing_fs, dict) else None)
        fs_json = json.dumps(effective_fs) if isinstance(effective_fs, dict) else None

        if not current_ver or has_submissions:
            # Create a brand new version
            new_ver_num = (current_ver["version_number"] + 1) if current_ver else 1
            target_version_id = str(uuid.uuid4())
            await self.execute(
                """INSERT INTO event_form_versions (id, event_id, version_number, status, sections_config, form_settings, created_by, created_at, published_at)
                   VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)""",
                target_version_id,
                event_id,
                new_ver_num,
                sections_json,
                fs_json,
                user_id,
                now,
                now if event["status"] == "published" else None,
            )
        else:
            # Reuse current version: update sections_config, form_settings and clear old fields
            target_version_id = current_ver["id"]
            if sections_json is not None:
                await self.execute("UPDATE event_form_versions SET sections_config = ? WHERE id = ?", sections_json, target_version_id)
            if form_settings is not None:
                await self.execute("UPDATE event_form_versions SET form_settings = ? WHERE id = ?", fs_json, target_version_id)
            await self.execute("DELETE FROM event_form_fields WHERE form_version_id = ?", target_version_id)

        # Insert new fields
        await self._insert_form_fields(target_version_id, fields)

        # Sync compatible submission policy toggles when explicitly configured in form_settings
        if isinstance(form_settings, dict):
            event_updates: List[str] = []
            event_params: List[Any] = []
            if "allow_multiple_responses" in form_settings:
                event_updates.append("allow_multiple_responses = ?")
                event_params.append(1 if form_settings["allow_multiple_responses"] else 0)
            if "allow_edit_submission" in form_settings or "allow_resubmission" in form_settings:
                can_edit = bool(form_settings.get("allow_edit_submission") or form_settings.get("allow_resubmission"))
                event_updates.append("allow_edit_submission = ?")
                event_params.append(1 if can_edit else 0)
            if "registration_capacity" in form_settings:
                cap_raw = form_settings.get("registration_capacity")
                cap_val = int(cap_raw) if (cap_raw is not None and str(cap_raw).strip() != "") else None
                event_updates.append("registration_capacity = ?")
                event_params.append(cap_val)
            if event_updates:
                event_updates.append("updated_at = ?")
                event_params.append(now)
                event_params.append(event_id)
                await self.execute(
                    f"UPDATE events SET {', '.join(event_updates)} WHERE id = ?",
                    *event_params,
                )

        # If event is already published, keep version published
        if event["status"] == "published":
            await self.execute(
                "UPDATE event_form_versions SET status = 'published', published_at = COALESCE(published_at, ?) WHERE id = ?",
                now,
                target_version_id,
            )

        await self.execute("UPDATE events SET updated_at = ? WHERE id = ?", now, event_id)
        return await self.get_current_form_version(event_id)

    async def _insert_form_fields(self, version_id: str, fields: List[Dict[str, Any]]):
        now = _utc_now_iso()

        for idx, f in enumerate(fields):
            field_id = f.get("id") or str(uuid.uuid4())
            field_key = f.get("field_key") or f"field_{idx + 1}"
            field_type = f.get("field_type") or "text"

            label = str(f.get("label", f"Field {idx + 1}")).strip()
            desc = f.get("description")
            placeholder = f.get("placeholder")
            required = 1 if f.get("required") else 0
            order = f.get("display_order") if f.get("display_order") is not None else f.get("sort_order", idx)
            enabled = 0 if f.get("enabled") is False else 1
            section_id = f.get("section_id") or "default"

            val_cfg = f.get("validation_config")
            val_cfg_str = json.dumps(val_cfg) if isinstance(val_cfg, (dict, list)) else val_cfg

            opt_cfg = f.get("options_config")
            if not opt_cfg:
                if f.get("options"):
                    opt_cfg = _normalize_options_list(f.get("options"))
                elif isinstance(val_cfg, dict) and val_cfg.get("options"):
                    opt_cfg = _normalize_options_list(val_cfg.get("options"))
            opt_cfg_str = json.dumps(opt_cfg) if isinstance(opt_cfg, (dict, list)) else opt_cfg

            cond_cfg = f.get("conditions")
            cond_cfg_str = json.dumps(cond_cfg) if isinstance(cond_cfg, (dict, list)) else cond_cfg

            rating_cfg = f.get("rating_config")
            if isinstance(rating_cfg, dict) and "max_stars" in rating_cfg and "max_rating" not in rating_cfg:
                rating_cfg = {**rating_cfg, "max_rating": rating_cfg["max_stars"]}
            rating_cfg_str = json.dumps(rating_cfg) if isinstance(rating_cfg, (dict, list)) else rating_cfg

            rep_cfg = f.get("repeatable_config")
            rep_cfg_str = json.dumps(rep_cfg) if isinstance(rep_cfg, (dict, list)) else rep_cfg

            default_val = f.get("default_value")
            if default_val is not None and not isinstance(default_val, str):
                default_val = json.dumps(default_val) if isinstance(default_val, (dict, list)) else str(default_val)

            min_len = f.get("min_len")
            max_len = f.get("max_len")
            min_val = f.get("min_val")
            max_val = f.get("max_val")

            await self.execute(
                """INSERT INTO event_form_fields (
                    id, form_version_id, field_key, field_type, label, description,
                    placeholder, required, validation_config, options_config,
                    display_order, enabled, section_id, conditions, rating_config,
                    repeatable_config, default_value, min_len, max_len, min_val, max_val,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                field_id,
                version_id,
                field_key,
                field_type,
                label,
                desc,
                placeholder,
                required,
                val_cfg_str,
                opt_cfg_str,
                order,
                enabled,
                section_id,
                cond_cfg_str,
                rating_cfg_str,
                rep_cfg_str,
                default_val,
                min_len,
                max_len,
                min_val,
                max_val,
                now,
            )

    # =========================================================================
    # 4. Student Event Submissions & Viewing
    # =========================================================================

    async def list_student_events(self, student_user_id: str) -> List[Dict[str, Any]]:
        """
        Lists published events that the student is eligible to see.
        """
        now = _utc_now_iso()
        all_published = await self.query(
            """SELECT e.*,
                      s.display_name as semester_display_name,
                      (SELECT sub.id FROM event_submissions sub WHERE sub.event_id = e.id AND sub.student_id = ? LIMIT 1) as my_submission_id,
                      (SELECT sub.submission_status FROM event_submissions sub WHERE sub.event_id = e.id AND sub.student_id = ? LIMIT 1) as my_submission_status,
                      (SELECT sub.submitted_at FROM event_submissions sub WHERE sub.event_id = e.id AND sub.student_id = ? LIMIT 1) as my_submitted_at
               FROM events e
               LEFT JOIN semesters s ON e.semester_id = s.id
               WHERE e.status = 'published'
               ORDER BY e.event_start_at ASC""",
            student_user_id,
            student_user_id,
            student_user_id,
        )

        eligible_events = []
        for evt in all_published:
            if await self.check_student_eligibility(evt["id"], student_user_id):
                evt["has_submitted"] = bool(evt.get("my_submission_id"))
                _enrich_event_record(evt)
                eligible_events.append(evt)

        return eligible_events

    async def get_student_submission(self, event_id: str, student_user_id: str) -> Optional[Dict[str, Any]]:
        sub = await self.first(
            """SELECT s.*, v.version_number
               FROM event_submissions s
               JOIN event_form_versions v ON s.form_version_id = v.id
               WHERE s.event_id = ? AND s.student_id = ?
               ORDER BY s.submitted_at DESC LIMIT 1""",
            event_id,
            student_user_id,
        )
        if not sub:
            return None

        # Fetch field values
        vals = await self.query(
            """SELECT v.field_key, v.value_json, f.label, f.field_type
               FROM event_submission_values v
               LEFT JOIN event_form_fields f ON v.field_id = f.id
               WHERE v.submission_id = ?""",
            sub["id"],
        )
        val_map = {}
        for r in vals:
            val_raw = r["value_json"]
            try:
                parsed_val = json.loads(val_raw) if val_raw else None
            except Exception:
                parsed_val = val_raw
            val_map[r["field_key"]] = {
                "value": parsed_val,
                "label": r.get("label"),
                "field_type": r.get("field_type"),
            }
        sub["values"] = val_map

        # Fetch files
        files = await self.query(
            "SELECT * FROM event_submission_files WHERE submission_id = ?",
            sub["id"],
        )
        for f_row in files:
            f_row["drive_file_id"] = f_row.get("drive_file_id") or f_row.get("storage_reference")
            f_row["file_url"] = f"/api/v1/events/files/{f_row['id']}/content"
            f_row["download_url"] = f"/api/v1/events/files/{f_row['id']}/content?download=1"
        sub["files"] = files
        return sub

    async def submit_event_response(
        self,
        event_id: str,
        student_user_id: str,
        form_version_id: Optional[str],
        values: Dict[str, Any],
        uploaded_files: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        event = await self.get_event(event_id)
        if not event:
            raise ValueError("Event not found.")

        if event["status"] != "published":
            raise ValueError(f"Registration is not open for this event (current status: {event['status']}).")

        # Resolve target form version early so per-version form_settings can be enforced
        if not form_version_id:
            curr_ver = await self.get_current_form_version(event_id)
            if not curr_ver:
                raise ValueError("No published form found for this event.")
            form_version_id = curr_ver["id"]
            form_ver = curr_ver
        else:
            form_ver = await self.get_form_version_by_id(form_version_id)
            if not form_ver:
                raise ValueError("Form version not found.")

        fs = form_ver.get("form_settings") if isinstance(form_ver.get("form_settings"), dict) else {}

        # Check registration deadline using parsed UTC datetimes (form_settings overrides if set)
        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()
        reg_start_dt = _parse_dt_utc(event.get("registration_start_at"))
        fs_deadline = fs.get("submission_deadline")
        reg_deadline_dt = _parse_dt_utc(fs_deadline or event.get("registration_deadline"))
        if reg_start_dt and now_dt < reg_start_dt:
            raise ValueError("Registration has not yet started for this event.")
        if (fs_deadline or event.get("close_after_deadline")) and reg_deadline_dt and now_dt > reg_deadline_dt:
            raise ValueError("Registration deadline has passed for this event.")
        if event.get("is_registration_enabled") is False or event.get("is_registration_enabled") == 0:
            raise ValueError("Registration is currently disabled for this event.")

        # Check student audience eligibility
        is_eligible = await self.check_student_eligibility(event_id, student_user_id)
        if not is_eligible:
            raise ValueError("You are not in the target audience for this event.")

        # Check if already submitted
        existing_sub = await self.first(
            "SELECT * FROM event_submissions WHERE event_id = ? AND student_id = ? ORDER BY submitted_at DESC LIMIT 1",
            event_id,
            student_user_id,
        )

        allow_multiple = bool(fs["allow_multiple_responses"]) if "allow_multiple_responses" in fs else bool(event.get("allow_multiple_responses"))
        allow_edit = (
            bool(fs.get("allow_edit_submission") or fs.get("allow_resubmission"))
            if ("allow_edit_submission" in fs or "allow_resubmission" in fs)
            else bool(event.get("allow_edit_submission"))
        )

        is_edit = False
        if existing_sub:
            if not allow_multiple:
                if not allow_edit:
                    raise ValueError("You have already submitted a response for this event. Multiple responses are not allowed.")
                is_edit = True

        # Check registration capacity
        cap = fs.get("registration_capacity") if fs.get("registration_capacity") is not None else event.get("registration_capacity")
        if cap:
            sub_count = (await self.first("SELECT COUNT(*) as cnt FROM event_submissions WHERE event_id = ?", event_id))["cnt"]
            if not is_edit and sub_count >= int(cap):
                raise ValueError(f"Registration capacity of {cap} has been reached for this event.")

        # Validate values against form fields along active conditional branch path
        sections_cfg = form_ver.get("sections_config") or []
        sections_by_id = {
            str(s.get("id")): s
            for s in sections_cfg
            if isinstance(s, dict) and s.get("id")
        }
        active_section_ids = _compute_active_section_path(sections_cfg, form_ver.get("fields", []), values)
        fields_by_key = {f["field_key"]: f for f in form_ver.get("fields", []) if f.get("enabled")}

        for key, f in fields_by_key.items():
            ftype = f.get("field_type") or "text"

            # Skip layout blocks, content blocks & visual page breaks
            if ftype in ("title_block", "heading", "subheading", "description", "rich_text", "rich_text_block", "divider", "page_break", "info", "info_card", "image_block", "video_block", "pdf_link", "notice"):
                continue

            # Skip sections excluded by conditional visibility or Google Forms branch path
            sec_id = str(f.get("section_id") or "default")
            if active_section_ids is not None and sec_id not in active_section_ids:
                continue
            sec = sections_by_id.get(sec_id)
            if sec and not _evaluate_section_visibility(sec, values):
                continue

            # Evaluate field conditional visibility
            if not _evaluate_field_visibility(f, values):
                # Field is dynamically hidden: skip required checks and validation
                continue

            val_cfg = f.get("validation_config") if isinstance(f.get("validation_config"), dict) else {}
            custom_err = val_cfg.get("custom_error") or None

            val = values.get(key)
            is_empty = (
                val is None
                or (isinstance(val, str) and not val.strip())
                or (isinstance(val, list) and len(val) == 0)
                or (ftype == "checkbox" and not f.get("options_config") and not val_cfg.get("allow_other") and val is not True)
            )

            # Upload & file fields (including geo_photo, images, pdfs)
            if ftype in ("file", "image_upload", "pdf_upload", "document_upload", "camera_capture", "gallery_upload", "geo_photo"):
                matching_uploads = [uf for uf in (uploaded_files or []) if uf.get("field_key") == key]
                val_count = len(val) if isinstance(val, list) else (1 if val else 0)
                total_files = max(len(matching_uploads), val_count)
                if f.get("required") and total_files == 0:
                    raise ValueError(custom_err or f"'{f['label']}' is required. Please provide the requested photo or document.")
                max_files = val_cfg.get("max_files")
                if max_files and total_files > int(max_files):
                    raise ValueError(custom_err or f"'{f['label']}' allows at most {int(max_files)} file(s).")
                continue

            # Repeatable group validation
            if ftype == "repeatable_group":
                rep_cfg = f.get("repeatable_config") or {}
                min_items = rep_cfg.get("min_items", 0)
                max_items = rep_cfg.get("max_items")
                entries = val if isinstance(val, list) else []
                if f.get("required") and (not entries or len(entries) < max(1, min_items)):
                    raise ValueError(custom_err or f"'{f['label']}' requires at least {max(1, min_items)} entry.")
                if min_items and len(entries) < min_items:
                    raise ValueError(custom_err or f"'{f['label']}' requires at least {min_items} entries.")
                if max_items and len(entries) > max_items:
                    raise ValueError(custom_err or f"'{f['label']}' cannot have more than {max_items} entries.")
                continue

            if f.get("required") and is_empty:
                raise ValueError(custom_err or f"'{f['label']}' is a required field.")

            if not is_empty:
                if ftype == "email":
                    val_str = str(val).strip()
                    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str):
                        raise ValueError(custom_err or f"'{f['label']}' must be a valid email address.")
                elif ftype == "phone":
                    val_str = str(val).strip()
                    digits = re.sub(r"\D", "", val_str)
                    if len(digits) < 7 or len(digits) > 15:
                        raise ValueError(custom_err or f"'{f['label']}' must be a valid phone number.")
                elif ftype == "url":
                    val_str = str(val).strip()
                    if not re.match(r"^https?://[^\s]+$", val_str, re.IGNORECASE):
                        raise ValueError(custom_err or f"'{f['label']}' must be a valid URL starting with http:// or https://.")
                elif ftype in ("number", "numeric_rating", "custom_scale"):
                    try:
                        num_val = float(val)
                    except Exception:
                        raise ValueError(custom_err or f"'{f['label']}' must be a valid number.")
                    if ftype == "number" and val_cfg.get("number_mode") == "integer" and not num_val.is_integer():
                        raise ValueError(custom_err or f"'{f['label']}' must be a whole integer.")
                    min_v = val_cfg.get("min_val") if val_cfg.get("min_val") is not None else f.get("min_val")
                    max_v = val_cfg.get("max_val") if val_cfg.get("max_val") is not None else f.get("max_val")
                    if min_v is not None and str(min_v).strip() != "" and num_val < float(min_v):
                        raise ValueError(custom_err or f"'{f['label']}' cannot be less than {min_v}.")
                    if max_v is not None and str(max_v).strip() != "" and num_val > float(max_v):
                        raise ValueError(custom_err or f"'{f['label']}' cannot exceed {max_v}.")
                elif ftype in ("text", "textarea"):
                    val_str = str(val).strip()
                    min_len = f.get("min_len") or val_cfg.get("min_len")
                    max_len = f.get("max_len") or val_cfg.get("max_len")
                    if min_len and len(val_str) < int(min_len):
                        raise ValueError(custom_err or f"'{f['label']}' must be at least {min_len} characters.")
                    if max_len and len(val_str) > int(max_len):
                        raise ValueError(custom_err or f"'{f['label']}' cannot exceed {max_len} characters.")
                    regex_pattern = val_cfg.get("regex_pattern")
                    if regex_pattern:
                        try:
                            if not re.search(str(regex_pattern), val_str):
                                raise ValueError(custom_err or f"'{f['label']}' does not match the required pattern.")
                        except re.error:
                            pass
                elif ftype in ("checkbox", "multi_select", "poll") and isinstance(val, list):
                    min_sel = val_cfg.get("min_selections")
                    max_sel = val_cfg.get("max_selections")
                    if min_sel is not None and str(min_sel).strip() != "" and len(val) < int(min_sel):
                        raise ValueError(custom_err or f"'{f['label']}' requires selecting at least {int(min_sel)} option(s).")
                    if max_sel is not None and str(max_sel).strip() != "" and len(val) > int(max_sel):
                        raise ValueError(custom_err or f"'{f['label']}' allows selecting at most {int(max_sel)} option(s).")
                elif ftype in ("date", "datetime"):
                    val_cmp = str(val).strip()[:10]
                    min_d = str(val_cfg.get("min_date") or "").strip()[:10]
                    max_d = str(val_cfg.get("max_date") or "").strip()[:10]
                    if min_d and val_cmp < min_d:
                        raise ValueError(custom_err or f"'{f['label']}' must be on or after {min_d}.")
                    if max_d and val_cmp > max_d:
                        raise ValueError(custom_err or f"'{f['label']}' must be on or before {max_d}.")
                elif ftype == "time":
                    val_t = str(val).strip()[:5]
                    min_t = str(val_cfg.get("min_time") or "").strip()[:5]
                    max_t = str(val_cfg.get("max_time") or "").strip()[:5]
                    if min_t and val_t < min_t:
                        raise ValueError(custom_err or f"'{f['label']}' must be at or after {min_t}.")
                    if max_t and val_t > max_t:
                        raise ValueError(custom_err or f"'{f['label']}' must be at or before {max_t}.")

        # Persist submission
        if is_edit and existing_sub:
            sub_id = existing_sub["id"]
            await self.execute(
                """UPDATE event_submissions SET
                    form_version_id = ?,
                    submission_status = 'updated',
                    updated_at = ?
                WHERE id = ?""",
                form_version_id,
                now,
                sub_id,
            )
            # Clear old response values
            await self.execute("DELETE FROM event_submission_values WHERE submission_id = ?", sub_id)
        else:
            sub_id = str(uuid.uuid4())
            await self.execute(
                """INSERT INTO event_submissions (id, event_id, form_version_id, student_id, submission_status, submitted_at, updated_at)
                VALUES (?, ?, ?, ?, 'submitted', ?, ?)""",
                sub_id,
                event_id,
                form_version_id,
                student_user_id,
                now,
                now,
            )

        # Insert values
        for key, val in values.items():
            f = fields_by_key.get(key)
            if not f:
                continue
            val_id = str(uuid.uuid4())
            val_json = json.dumps(val) if val is not None else None
            await self.execute(
                """INSERT INTO event_submission_values (id, submission_id, field_id, field_key, value_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)""",
                val_id,
                sub_id,
                f["id"],
                key,
                val_json,
                now,
            )

        # Insert uploaded files & link Drive metadata cleanly
        if uploaded_files:
            await self._ensure_event_files_schema()
            for uf in uploaded_files:
                file_id = str(uuid.uuid4())
                f_key = uf.get("field_key", "file")
                f = fields_by_key.get(f_key)
                s_ref = uf["storage_reference"]
                ef_row = await self.get_event_file(s_ref)
                d_file_id = (ef_row.get("drive_file_id") if ef_row else None) or uf.get("drive_file_id") or s_ref
                d_folder_id = (ef_row.get("drive_folder_id") if ef_row else None) or uf.get("drive_folder_id")
                await self.execute(
                    """INSERT INTO event_submission_files (
                        id, submission_id, field_id, field_key, storage_reference,
                        drive_file_id, drive_folder_id, student_id, event_id,
                        original_filename, mime_type, file_size, uploaded_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    file_id,
                    sub_id,
                    f["id"] if f else None,
                    f_key,
                    s_ref,
                    d_file_id,
                    d_folder_id,
                    student_user_id,
                    event_id,
                    uf.get("original_filename", "document.pdf"),
                    uf.get("mime_type", "application/pdf"),
                    uf.get("file_size", 0),
                    now,
                )
                if ef_row and ef_row.get("id"):
                    try:
                        await self.execute(
                            "UPDATE event_files SET submission_id = ?, event_id = COALESCE(event_id, ?) WHERE id = ?",
                            sub_id, event_id, ef_row["id"]
                        )
                    except Exception:
                        pass

        return await self.get_student_submission(event_id, student_user_id)

    async def get_poll_aggregates(self, event_id: str, form_ver: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Returns ONLY anonymized aggregate counts per option for polls with show_poll_results=True."""
        if not form_ver or not isinstance(form_ver.get("fields"), list):
            return {}

        poll_keys: List[str] = []
        for f in form_ver["fields"]:
            if not isinstance(f, dict) or f.get("enabled") is False:
                continue
            if f.get("field_type") == "poll":
                val_cfg = f.get("validation_config") if isinstance(f.get("validation_config"), dict) else {}
                if val_cfg.get("show_poll_results"):
                    poll_keys.append(str(f["field_key"]))

        if not poll_keys:
            return {}

        placeholders = ", ".join(["?"] * len(poll_keys))
        rows = await self.query(
            f"""SELECT sv.field_key, sv.value_json
                FROM event_submission_values sv
                JOIN event_submissions es ON sv.submission_id = es.id
                WHERE es.event_id = ? AND sv.field_key IN ({placeholders})""",
            event_id,
            *poll_keys,
        )

        out: Dict[str, Dict[str, Any]] = {k: {"total": 0, "counts": {}} for k in poll_keys}
        for row in rows:
            fkey = str(row.get("field_key") or "")
            if fkey not in out:
                continue
            raw_val = row.get("value_json")
            parsed = raw_val
            if isinstance(raw_val, str):
                try:
                    parsed = json.loads(raw_val)
                except Exception:
                    parsed = raw_val
            if parsed is None or parsed == "" or parsed == []:
                continue
            out[fkey]["total"] += 1
            items = parsed if isinstance(parsed, list) else [parsed]
            for item in items:
                s = str(item).strip()
                if s:
                    out[fkey]["counts"][s] = out[fkey]["counts"].get(s, 0) + 1
        return out

    # =========================================================================
    # 5. Admin / HOD Response Management
    # =========================================================================

    async def get_event_responses(
        self,
        event_id: str,
        search: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        event = await self.get_event(event_id)
        if not event:
            raise ValueError("Event not found.")

        curr_form = await self.get_current_form_version(event_id)

        sql = """
            SELECT sub.id, sub.event_id, sub.form_version_id, sub.student_id,
                   sub.submission_status, sub.submitted_at, sub.updated_at,
                   u.full_name as student_name, u.email as student_email,
                   sp.register_number, sp.section, sp.year as academic_year,
                   v.version_number
            FROM event_submissions sub
            JOIN users u ON sub.student_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            JOIN event_form_versions v ON sub.form_version_id = v.id
            WHERE sub.event_id = ?
        """
        params = [event_id]

        if status and status != "all":
            sql += " AND sub.submission_status = ?"
            params.append(status)

        if search:
            sql += " AND (u.full_name LIKE ? OR sp.register_number LIKE ? OR u.email LIKE ?)"
            s_pat = f"%{search.strip()}%"
            params.extend([s_pat, s_pat, s_pat])

        sql += " ORDER BY sub.submitted_at DESC"
        submissions = await self.query(sql, *params)

        # For each submission, attach values
        for s in submissions:
            vals = await self.query(
                "SELECT field_key, value_json FROM event_submission_values WHERE submission_id = ?",
                s["id"],
            )
            v_map = {}
            for row in vals:
                try:
                    v_map[row["field_key"]] = json.loads(row["value_json"]) if row["value_json"] else None
                except Exception:
                    v_map[row["field_key"]] = row["value_json"]
            s["values"] = v_map

            file_cnt = (await self.first(
                "SELECT COUNT(*) as cnt FROM event_submission_files WHERE submission_id = ?",
                s["id"],
            ))["cnt"]
            s["files_count"] = file_cnt

        total_registered = len(submissions)

        # Get eligible students who haven't submitted
        eligible_students_sql = """
            SELECT u.id, u.full_name, u.email, sp.register_number, sp.section, sp.year
            FROM users u
            JOIN student_profiles sp ON u.id = sp.user_id
            WHERE u.role = 'student' AND u.is_active = 1
        """
        all_students = await self.query(eligible_students_sql)
        submitted_user_ids = {s["student_id"] for s in submissions}

        not_submitted = []
        for stu in all_students:
            if stu["id"] not in submitted_user_ids:
                if await self.check_student_eligibility(event_id, stu["id"]):
                    not_submitted.append(stu)

        return {
            "event": event,
            "current_form_version": curr_form,
            "total_submissions": total_registered,
            "total_not_submitted": len(not_submitted),
            "submissions": submissions,
            "not_submitted_students": not_submitted,
        }

    async def get_submission_detail(self, submission_id: str) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT sub.*,
                   u.full_name as student_name, u.email as student_email,
                   sp.register_number, sp.section, sp.year as academic_year, sp.phone_number,
                   e.title as event_title, e.category as event_category,
                   v.version_number
            FROM event_submissions sub
            JOIN users u ON sub.student_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            JOIN events e ON sub.event_id = e.id
            JOIN event_form_versions v ON sub.form_version_id = v.id
            WHERE sub.id = ?
        """
        sub = await self.first(sql, submission_id)
        if not sub:
            return None

        # Fetch form version fields for that exact submission version!
        form_ver = await self.get_form_version_by_id(sub["form_version_id"])

        # Fetch values
        vals = await self.query(
            """SELECT v.field_key, v.value_json, f.label, f.field_type, f.display_order
               FROM event_submission_values v
               LEFT JOIN event_form_fields f ON v.field_id = f.id
               WHERE v.submission_id = ?
               ORDER BY f.display_order ASC""",
            submission_id,
        )
        val_map = {}
        for r in vals:
            val_raw = r["value_json"]
            try:
                parsed_val = json.loads(val_raw) if val_raw else None
            except Exception:
                parsed_val = val_raw
            val_map[r["field_key"]] = {
                "value": parsed_val,
                "label": r.get("label"),
                "field_type": r.get("field_type"),
            }
        sub["values"] = val_map

        # Fetch files
        files = await self.query(
            "SELECT * FROM event_submission_files WHERE submission_id = ?",
            submission_id,
        )
        for f_row in files:
            f_row["drive_file_id"] = f_row.get("drive_file_id") or f_row.get("storage_reference")
            f_row["file_url"] = f"/api/v1/events/files/{f_row['id']}/content"
            f_row["download_url"] = f"/api/v1/events/files/{f_row['id']}/content?download=1"
        sub["files"] = files
        sub["form_version"] = form_ver
        return sub
