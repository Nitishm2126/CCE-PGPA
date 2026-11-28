import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from grading_engine import (
    GRADE_POINTS_MAP,
    calculate_component_grade,
    calculate_overall_pgpa,
    score_to_grade_table_b,
    grade_skillrack,
)

logger = logging.getLogger(__name__)

try:
    from pyodide.ffi import jsnull as _PYODIDE_JS_NULL
except Exception:
    _PYODIDE_JS_NULL = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


class D1DAL:
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

    async def execute(self, sql: str, *params) -> Dict[str, Any]:
        stmt = self.db.prepare(sql)
        if params:
            clean_params = [_sanitize_param(p) for p in params]
            stmt = stmt.bind(*clean_params)
        res = await stmt.run()
        meta = getattr(res, "meta", {})
        return _row_to_dict(meta)

    # ==========================================
    # Auth & User Lookups
    # ==========================================
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        return await self.first(
            "SELECT id, full_name, email, password_hash, firebase_uid, role, is_active, must_change_password FROM users WHERE LOWER(email) = ?",
            clean_email,
        )

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        return await self.first(
            "SELECT id, full_name, email, password_hash, firebase_uid, role, is_active, must_change_password FROM users WHERE id = ?",
            user_id,
        )

    async def find_user_by_any_id(self, identifier: str) -> Optional[Dict[str, Any]]:
        clean_id = (identifier or "").strip()
        if not clean_id:
            return None
        # 1. Match direct user id
        user = await self.first(
            "SELECT id, full_name, email, password_hash, firebase_uid, role, is_active, must_change_password FROM users WHERE id = ?",
            clean_id,
        )
        if user:
            return user

        # 2. Match student_profiles (id or register_number)
        user = await self.first(
            """SELECT u.id, u.full_name, u.email, u.password_hash, u.firebase_uid, u.role, u.is_active, u.must_change_password
               FROM users u
               JOIN student_profiles sp ON u.id = sp.user_id
               WHERE sp.id = ? OR LOWER(sp.register_number) = ?""",
            clean_id,
            clean_id.lower(),
        )
        if user:
            return user

        # 3. Match mentor_profiles (id or staff_id)
        user = await self.first(
            """SELECT u.id, u.full_name, u.email, u.password_hash, u.firebase_uid, u.role, u.is_active, u.must_change_password
               FROM users u
               JOIN mentor_profiles mp ON u.id = mp.user_id
               WHERE mp.id = ? OR LOWER(mp.staff_id) = ?""",
            clean_id,
            clean_id.lower(),
        )
        if user:
            return user

        # 4. Match hod_profiles (id or staff_id)
        user = await self.first(
            """SELECT u.id, u.full_name, u.email, u.password_hash, u.firebase_uid, u.role, u.is_active, u.must_change_password
               FROM users u
               JOIN hod_profiles hp ON u.id = hp.user_id
               WHERE hp.id = ? OR LOWER(hp.staff_id) = ?""",
            clean_id,
            clean_id.lower(),
        )
        return user

    async def update_password(self, user_id: str, new_password_hash: str) -> bool:
        await self.execute(
            "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            new_password_hash,
            user_id,
        )
        return True

    async def get_oauth_credential(self, provider: str = "google_drive") -> Optional[Dict[str, Any]]:
        return await self.first(
            "SELECT id, provider, client_id, encrypted_refresh_token, scopes, authorized_by, authorized_email, updated_at FROM oauth_credentials WHERE provider = ?",
            provider,
        )

    async def save_oauth_credential(
        self,
        provider: str,
        client_id: str,
        encrypted_refresh_token: str,
        scopes: str,
        authorized_by: Optional[str],
        authorized_email: Optional[str],
    ) -> bool:
        cred_id = str(uuid.uuid4())
        await self.execute(
            """INSERT INTO oauth_credentials (id, provider, client_id, encrypted_refresh_token, scopes, authorized_by, authorized_email, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT (provider) DO UPDATE SET
                   client_id = excluded.client_id,
                   encrypted_refresh_token = excluded.encrypted_refresh_token,
                   scopes = excluded.scopes,
                   authorized_by = excluded.authorized_by,
                   authorized_email = excluded.authorized_email,
                   updated_at = CURRENT_TIMESTAMP""",
            cred_id,
            provider,
            client_id,
            encrypted_refresh_token,
            scopes,
            authorized_by,
            authorized_email,
        )
        return True

    # ==========================================
    # Semesters & Components Catalogue
    # ==========================================
    async def get_semesters(self, enabled_only: bool = False) -> List[Dict[str, Any]]:
        if enabled_only:
            rows = await self.query(
                "SELECT id, semester_number, display_name, is_enabled, is_default FROM semesters WHERE is_enabled = 1 ORDER BY semester_number ASC"
            )
        else:
            rows = await self.query(
                "SELECT id, semester_number, display_name, is_enabled, is_default FROM semesters ORDER BY semester_number ASC"
            )
        for r in rows:
            r["is_enabled"] = bool(r.get("is_enabled", 1))
            r["is_default"] = bool(r.get("is_default", 0))
        return rows

    async def get_default_semester(self) -> Optional[Dict[str, Any]]:
        row = await self.first(
            "SELECT id, semester_number, display_name, is_enabled, is_default FROM semesters WHERE is_default = 1 LIMIT 1"
        )
        if not row:
            row = await self.first(
                "SELECT id, semester_number, display_name, is_enabled, is_default FROM semesters WHERE is_enabled = 1 ORDER BY semester_number ASC LIMIT 1"
            )
        if not row:
            row = await self.first(
                "SELECT id, semester_number, display_name, is_enabled, is_default FROM semesters ORDER BY semester_number ASC LIMIT 1"
            )
        if row:
            row["is_enabled"] = bool(row.get("is_enabled", 1))
            row["is_default"] = bool(row.get("is_default", 0))
        return row

    async def get_components(self, semester_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if semester_id:
            return await self.query(
                """SELECT c.id, c.name, c.slug, c.description, c.semester_label, c.academic_period,
                          c.display_order, c.is_active, c.is_visible, c.credit_value, c.submission_mode,
                          c.grading_strategy, c.requires_verification, c.pdf_requirement, c.allow_other_evidence_types,
                          cfg.is_enabled, cfg.submission_deadline
                   FROM pgpa_components c
                   JOIN component_semester_configs cfg ON c.id = cfg.component_id
                   WHERE cfg.semester_id = ? AND c.is_active = 1 AND c.is_visible = 1 AND cfg.is_enabled = 1 AND c.slug != 'skillrack'
                   ORDER BY c.display_order ASC""",
                semester_id,
            )
        return await self.query(
            """SELECT id, name, slug, description, semester_label, academic_period,
                      display_order, is_active, is_visible, credit_value, submission_mode,
                      grading_strategy, requires_verification, pdf_requirement, allow_other_evidence_types
               FROM pgpa_components
               WHERE is_active = 1 AND is_visible = 1 AND slug != 'skillrack'
               ORDER BY display_order ASC"""
        )

    async def get_all_components_admin(self) -> List[Dict[str, Any]]:
        return await self.query(
            """SELECT id, name, slug, description, semester_label, academic_period,
                      display_order, is_active, is_visible, credit_value, submission_mode,
                      grading_strategy, requires_verification, pdf_requirement, allow_other_evidence_types,
                      rule_version, updated_at
               FROM pgpa_components
               ORDER BY display_order ASC"""
        )

    async def get_component_by_id(self, component_id: str) -> Optional[Dict[str, Any]]:
        return await self.first(
            """SELECT id, name, slug, description, semester_label, academic_period,
                      display_order, is_active, is_visible, credit_value, submission_mode,
                      grading_strategy, requires_verification, pdf_requirement, allow_other_evidence_types,
                      rule_version, updated_at
               FROM pgpa_components
               WHERE id = ?""",
            component_id,
        )

    async def update_component(self, component_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        comp = await self.get_component_by_id(component_id)
        if not comp:
            return None

        name = data.get("name", comp["name"])
        description = data.get("description", comp.get("description"))
        credit_value = data.get("credit_value", comp.get("credit_value", 3))
        submission_mode = data.get("submission_mode", comp.get("submission_mode", "student"))
        grading_strategy = data.get("grading_strategy", comp.get("grading_strategy", "direct"))
        
        req_ver = data.get("requires_verification")
        if req_ver is None:
            requires_verification = comp.get("requires_verification", 1)
        else:
            requires_verification = 1 if req_ver else 0

        is_act = data.get("is_active")
        if is_act is None:
            is_active = comp.get("is_active", 1)
        else:
            is_active = 1 if is_act else 0

        is_vis = data.get("is_visible")
        if is_vis is None:
            is_visible = comp.get("is_visible", 1)
        else:
            is_visible = 1 if is_vis else 0

        pdf_req = data.get("pdf_requirement")
        if pdf_req is None:
            pdf_req = "required" if data.get("pdf_required") else comp.get("pdf_requirement", "optional")

        allow_ev = data.get("allow_other_evidence_types")
        if allow_ev is None:
            allow_other_evidence_types = comp.get("allow_other_evidence_types", 1)
        else:
            allow_other_evidence_types = 1 if allow_ev else 0

        rule_version = comp.get("rule_version", 1) + 1

        await self.execute(
            """UPDATE pgpa_components SET
                name = ?, description = ?, credit_value = ?, submission_mode = ?,
                grading_strategy = ?, requires_verification = ?, is_active = ?,
                is_visible = ?, pdf_requirement = ?, allow_other_evidence_types = ?,
                rule_version = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?""",
            name, description, credit_value, submission_mode,
            grading_strategy, requires_verification, is_active,
            is_visible, pdf_req, allow_other_evidence_types,
            rule_version, component_id,
        )
        return await self.get_component_by_id(component_id)

    async def update_component_visibility(self, component_id: str, is_visible: bool) -> Dict[str, Any]:
        comp = await self.get_component_by_id(component_id)
        if not comp:
            raise ValueError(f"PGPA Component with ID '{component_id}' not found.")
        prev_visible = bool(comp.get("is_visible", 1))
        vis_val = 1 if is_visible else 0
        await self.execute(
            "UPDATE pgpa_components SET is_visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            vis_val, component_id
        )
        status_str = "visible to Students, Mentors, and HOD" if is_visible else "hidden from active student submissions and queues"
        return {
            "id": comp["id"],
            "name": comp["name"],
            "slug": comp["slug"],
            "is_visible": is_visible,
            "previous_is_visible": prev_visible,
            "updated_at": _utc_now_iso(),
            "message": f"Component '{comp['name']}' is now {status_str}."
        }

    async def get_component_semester_configs(self, component_id: str) -> List[Dict[str, Any]]:
        comp = await self.get_component_by_id(component_id)
        comp_name = comp["name"] if comp else None
        rows = await self.query(
            """SELECT cfg.id, cfg.component_id, cfg.semester_id, cfg.is_enabled, cfg.submission_deadline,
                      s.semester_number, s.display_name as semester_name
               FROM component_semester_configs cfg
               JOIN semesters s ON cfg.semester_id = s.id
               WHERE cfg.component_id = ?
               ORDER BY s.semester_number ASC""",
            component_id,
        )
        result = []
        for r in rows:
            result.append({
                "id": str(r["id"]),
                "component_id": str(r["component_id"]),
                "component_name": comp_name,
                "semester_id": str(r["semester_id"]),
                "semester_number": r["semester_number"],
                "semester_display_name": r["semester_name"],
                "is_enabled": bool(r["is_enabled"]),
                "submission_deadline": r["submission_deadline"],
            })
        return result

    async def update_component_semester_config(
        self,
        component_id: str,
        semester_id: str,
        is_enabled: bool,
        submission_deadline: Optional[str] = None,
    ) -> Dict[str, Any]:
        comp = await self.get_component_by_id(component_id)
        sem = await self.first("SELECT id, semester_number, display_name FROM semesters WHERE id = ?", semester_id)
        
        cfg = await self.first(
            "SELECT id, is_enabled, submission_deadline FROM component_semester_configs WHERE component_id = ? AND semester_id = ?",
            component_id, semester_id
        )
        en_val = 1 if is_enabled else 0
        if not cfg:
            cfg_id = str(uuid.uuid4())
            await self.execute(
                """INSERT INTO component_semester_configs (id, component_id, semester_id, is_enabled, submission_deadline, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
                cfg_id, component_id, semester_id, en_val, submission_deadline
            )
        else:
            cfg_id = cfg["id"]
            if submission_deadline is not None:
                await self.execute(
                    "UPDATE component_semester_configs SET is_enabled = ?, submission_deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    en_val, submission_deadline, cfg_id
                )
            else:
                await self.execute(
                    "UPDATE component_semester_configs SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    en_val, cfg_id
                )

        return {
            "id": cfg_id,
            "component_id": component_id,
            "component_name": comp["name"] if comp else None,
            "semester_id": semester_id,
            "semester_number": sem["semester_number"] if sem else None,
            "semester_display_name": sem["display_name"] if sem else None,
            "is_enabled": is_enabled,
            "submission_deadline": submission_deadline if submission_deadline is not None else (cfg["submission_deadline"] if cfg else None),
        }

    async def update_semester_status(self, semester_id: str, is_enabled: bool) -> Optional[Dict[str, Any]]:
        sem = await self.first("SELECT id, semester_number, display_name, is_default FROM semesters WHERE id = ?", semester_id)
        if not sem:
            return None
        val = 1 if is_enabled else 0
        # Default Semester and Open/Closed status are separate settings. Do not automatically change default when toggling status.
        await self.execute("UPDATE semesters SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", val, semester_id)

        updated = await self.first("SELECT id, semester_number, display_name, is_enabled, is_default FROM semesters WHERE id = ?", semester_id)
        if updated:
            updated["is_enabled"] = bool(updated.get("is_enabled", 1))
            updated["is_default"] = bool(updated.get("is_default", 0))
        return updated

    async def set_default_semester(self, semester_id: str) -> Dict[str, Any]:
        sem = await self.first("SELECT id, semester_number, display_name, is_enabled FROM semesters WHERE id = ?", semester_id)
        if not sem:
            return {"success": False, "error": "Semester not found"}

        # Only ONE semester can be the default at a time.
        # Reset all semesters default status in D1
        await self.execute("UPDATE semesters SET is_default = 0, updated_at = CURRENT_TIMESTAMP")
        # Set selected semester as default
        await self.execute("UPDATE semesters SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", semester_id)

        return {
            "success": True,
            "id": sem["id"],
            "semester_number": sem["semester_number"],
            "display_name": sem["display_name"],
            "is_enabled": bool(sem.get("is_enabled", 1)),
            "is_default": True,
        }

    async def get_components_semester_matrix(self) -> Dict[str, Any]:
        components = await self.get_all_components_admin()
        semesters = await self.get_semesters(enabled_only=False)
        configs = await self.query("SELECT component_id, semester_id, is_enabled, submission_deadline FROM component_semester_configs")

        config_map = {(c["component_id"], c["semester_id"]): bool(c["is_enabled"]) for c in configs}

        matrix = []
        for comp in components:
            sem_status = {}
            for sem in semesters:
                val = config_map.get((comp["id"], sem["id"]), True)
                sem_status[str(sem["semester_number"])] = val
                sem_status[str(sem["id"])] = val
            matrix.append({
                "component_id": str(comp["id"]),
                "name": comp["name"],
                "slug": comp["slug"],
                "credit_value": comp.get("credit_value", 3),
                "submission_mode": comp.get("submission_mode", "student"),
                "grading_strategy": comp.get("grading_strategy", "direct"),
                "requires_verification": bool(comp.get("requires_verification", 1)),
                "is_active": bool(comp.get("is_active", 1)),
                "is_visible": bool(comp.get("is_visible", 1)),
                "pdf_requirement": comp.get("pdf_requirement", "optional"),
                "pdf_required": bool(comp.get("pdf_requirement") == "required"),
                "allow_other_evidence_types": bool(comp.get("allow_other_evidence_types", 1)),
                "semesters": sem_status,
            })

        return {
            "semesters": [{"id": str(s["id"]), "number": s["semester_number"], "name": s["display_name"], "is_enabled": bool(s["is_enabled"])} for s in semesters],
            "components": matrix,
        }

    # ==========================================
    # Student Operations
    # ==========================================
    async def get_student_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        user = await self.first(
            """SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.must_change_password,
                      sp.register_number, sp.department, sp.year, sp.section, sp.semester,
                      sp.batch, sp.phone_number, sp.original_mentor_name, sp.google_drive_folder_id,
                      m.id as mentor_id, m.full_name as mentor_name, m.email as mentor_email
               FROM users u
               LEFT JOIN student_profiles sp ON u.id = sp.user_id
               LEFT JOIN mentor_assignments ma ON u.id = ma.student_id AND ma.is_active = 1
               LEFT JOIN users m ON ma.mentor_id = m.id
               WHERE u.id = ?""",
            user_id,
        )
        if not user:
            return None

        # Build authoritative nested profile and assigned mentor structures
        mentor_name = user.get("mentor_name") or user.get("original_mentor_name")
        res = dict(user)
        if not res.get("mentor_name") and mentor_name:
            res["mentor_name"] = mentor_name

        res["profile"] = {
            "id": user.get("id"),
            "register_number": user.get("register_number"),
            "department": user.get("department") or "CCE",
            "year": user.get("year") or 1,
            "section": user.get("section") or "A",
            "semester": user.get("semester") or "Semester 3",
            "batch": user.get("batch"),
            "phone_number": user.get("phone_number"),
            "original_mentor_name": mentor_name,
            "google_drive_folder_id": user.get("google_drive_folder_id"),
        }

        if mentor_name:
            res["assigned_mentor"] = {
                "mentor_id": user.get("mentor_id") or "mentor-assigned",
                "full_name": mentor_name,
                "email": user.get("mentor_email") or "",
            }
        else:
            res["assigned_mentor"] = None

        try:
            hod_user = await self.first(
                """SELECT u.id, u.full_name, u.email, hp.department, hp.designation
                   FROM users u
                   LEFT JOIN hod_profiles hp ON u.id = hp.user_id
                   WHERE u.role = 'hod' AND u.is_active = 1
                   LIMIT 1"""
            )
        except Exception as e:
            logger.error("Failed to fetch HOD profile: %s", e)
            hod_user = None

        res["hod_supervisor"] = {
            "full_name": hod_user.get("full_name") if hod_user else "Dr. Pachaiammal Alias Priya",
            "email": hod_user.get("email") if hod_user else "hod.cce@sairam.edu.in",
            "department": (hod_user.get("department") if hod_user else None) or user.get("department") or "CCE",
            "designation": (hod_user.get("designation") if hod_user else None) or "Head of Department",
        }
        return res

    async def update_student_profile(self, user_id: str, full_name: Optional[str] = None, phone_number: Optional[str] = None) -> bool:
        if full_name:
            await self.execute("UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", full_name, user_id)
        if phone_number is not None:
            await self.execute("UPDATE student_profiles SET phone_number = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", phone_number, user_id)
        return True

    async def attach_files_and_results(self, achievements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not achievements:
            return achievements
        ach_ids = [a["id"] for a in achievements if a.get("id")]
        if not ach_ids:
            return achievements

        placeholders = ",".join(["?"] * len(ach_ids))

        # 1. Fetch files
        try:
            files = await self.query(
                f"""SELECT id, achievement_id, provider, drive_file_id, drive_folder_id,
                           original_filename, mime_type, size_bytes, file_category, uploaded_by, created_at
                    FROM achievement_files WHERE achievement_id IN ({placeholders}) ORDER BY created_at ASC""",
                *ach_ids,
            )
            file_map: Dict[str, List[Dict[str, Any]]] = {}
            for f in files:
                f["content_url"] = f"/api/v1/files/{f['id']}/content"
                file_map.setdefault(f["achievement_id"], []).append(f)
        except Exception as e:
            logger.warning("Error attaching achievement files: %s", e)
            file_map = {}

        # 2. Fetch verified component results
        try:
            results = await self.query(
                f"""SELECT achievement_id, grade, grade_points, raw_score, is_verified
                    FROM student_component_results WHERE achievement_id IN ({placeholders})""",
                *ach_ids,
            )
            res_map = {r["achievement_id"]: r for r in results}
        except Exception as e:
            logger.warning("Error attaching component results: %s", e)
            res_map = {}

        for a in achievements:
            a["files"] = file_map.get(a["id"], [])
            res = res_map.get(a["id"])
            if res:
                a["evaluated_grade"] = res.get("grade")
                a["evaluated_grade_points"] = res.get("grade_points")
                a["evaluated_points"] = res.get("raw_score")
                a["is_verified"] = bool(res.get("is_verified"))
            else:
                a["evaluated_grade"] = None
                a["evaluated_grade_points"] = None
                a["evaluated_points"] = None
                a["is_verified"] = False

            # Parse component_metadata if string
            meta = a.get("component_metadata")
            if isinstance(meta, str) and meta.strip():
                try:
                    meta = json.loads(meta)
                    a["component_metadata"] = meta
                except Exception:
                    meta = {}
            elif not isinstance(meta, dict):
                meta = {}

            # Ensure approved achievements always expose their awarded points and verified state
            if a.get("status") == "approved":
                a["is_verified"] = True
                if a.get("evaluated_points") is None:
                    indiv_pts = None
                    if isinstance(meta, dict):
                        indiv_pts = meta.get("points") or meta.get("calculated_points")
                    if indiv_pts is None:
                        cslug = a.get("component_slug") or ""
                        if cslug == "clubs-and-cells":
                            rc = (meta.get("role_category") if isinstance(meta, dict) else None) or a.get("activity_type")
                            el = meta.get("event_level") if isinstance(meta, dict) else None
                            indiv_pts = calculate_clubs_and_cells_points(str(rc or ""), str(el or ""))
                    if indiv_pts is not None:
                        try:
                            a["evaluated_points"] = float(indiv_pts)
                        except Exception:
                            pass

        return achievements

    async def get_student_achievements(self, student_id: str, semester_id: Optional[str] = None) -> List[Dict[str, Any]]:
        base_sql = """SELECT a.id, a.student_id, a.component_id, a.semester_id, a.title, a.activity_type,
                             a.organizer, a.event_date, a.description, a.outcome, a.certificate_status,
                             a.remarks, a.component_metadata, a.status, a.submitted_at, a.created_at,
                             c.name as component_name, c.slug as component_slug, c.credit_value,
                             COALESCE(s.display_name, 'Semester ' || s.semester_number) as semester_name, s.semester_number,
                             COALESCE(m.full_name, sp.original_mentor_name, '—') as mentor_name
                      FROM achievements a
                      JOIN pgpa_components c ON a.component_id = c.id
                      LEFT JOIN semesters s ON a.semester_id = s.id
                      LEFT JOIN student_profiles sp ON a.student_id = sp.user_id
                      LEFT JOIN mentor_assignments ma ON a.student_id = ma.student_id AND ma.is_active = 1
                      LEFT JOIN users m ON ma.mentor_id = m.id
                      WHERE a.student_id = ?"""
        if semester_id and semester_id != "all":
            if str(semester_id).strip().isdigit():
                sql = base_sql + " AND (s.semester_number = ? OR a.semester_id = ? OR a.semester_id LIKE ?) ORDER BY a.created_at DESC"
                rows = await self.query(sql, student_id, int(semester_id), str(semester_id), f"%{semester_id}")
            else:
                sql = base_sql + " AND a.semester_id = ? ORDER BY a.created_at DESC"
                rows = await self.query(sql, student_id, semester_id)
        else:
            sql = base_sql + " ORDER BY a.created_at DESC"
            rows = await self.query(sql, student_id)
        return await self.attach_files_and_results(rows)

    async def get_achievement_detail(self, achievement_id: str) -> Optional[Dict[str, Any]]:
        row = await self.first(
            """SELECT a.id, a.student_id, a.component_id, a.semester_id, a.title, a.activity_type,
                      a.organizer, a.event_date, a.description, a.outcome, a.certificate_status,
                      a.remarks, a.component_metadata, a.status, a.submitted_at, a.created_at,
                      c.name as component_name, c.slug as component_slug, c.credit_value,
                      COALESCE(s.display_name, 'Semester ' || s.semester_number) as semester_name, s.semester_number,
                      u.full_name as student_name, u.email as student_email,
                      sp.register_number, sp.department, sp.year, sp.section,
                      COALESCE(m.full_name, sp.original_mentor_name, '—') as mentor_name
               FROM achievements a
               JOIN pgpa_components c ON a.component_id = c.id
               LEFT JOIN semesters s ON a.semester_id = s.id
               JOIN users u ON a.student_id = u.id
               LEFT JOIN student_profiles sp ON u.id = sp.user_id
               LEFT JOIN mentor_assignments ma ON a.student_id = ma.student_id AND ma.is_active = 1
               LEFT JOIN users m ON ma.mentor_id = m.id
               WHERE a.id = ?""",
            achievement_id,
        )
        if not row:
            return None

        # Parse component_metadata if string
        meta = row.get("component_metadata")
        if isinstance(meta, str) and meta.strip():
            try:
                row["component_metadata"] = json.loads(meta)
            except Exception:
                pass

        # Fetch files
        files = await self.query(
            """SELECT id, achievement_id, provider, drive_file_id, drive_folder_id,
                      original_filename, mime_type, size_bytes, file_category, uploaded_by, created_at
               FROM achievement_files WHERE achievement_id = ? ORDER BY created_at ASC""",
            achievement_id,
        )
        for f in files:
            f["content_url"] = f"/api/v1/files/{f['id']}/content"
        row["files"] = files

        # Fetch evaluated results
        res = await self.first(
            "SELECT grade, grade_points, raw_score, is_verified FROM student_component_results WHERE achievement_id = ?",
            achievement_id,
        )
        if res:
            row["evaluated_grade"] = res.get("grade")
            row["evaluated_grade_points"] = res.get("grade_points")
            row["evaluated_points"] = res.get("raw_score")
            row["is_verified"] = bool(res.get("is_verified"))
        else:
            row["evaluated_grade"] = None
            row["evaluated_grade_points"] = None
            row["evaluated_points"] = None
            row["is_verified"] = False

        # Fetch verification logs
        logs = await self.query(
            """SELECT vl.id, vl.achievement_id, vl.reviewer_id, vl.action, vl.remarks, vl.created_at,
                      u.full_name as reviewer_name
               FROM verification_logs vl
               LEFT JOIN users u ON vl.reviewer_id = u.id
               WHERE vl.achievement_id = ? ORDER BY vl.created_at ASC""",
            achievement_id,
        )
        row["verification_logs"] = logs
        return row

    async def create_achievement(self, student_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        sem_id = data.get("semester_id")
        if sem_id:
            sem = await self.first("SELECT is_enabled, semester_number FROM semesters WHERE id = ?", sem_id)
            if not sem or not sem.get("is_enabled"):
                raise ValueError("This academic semester is currently closed for new submissions.")
        ach_id = str(uuid.uuid4())
        meta = data.get("component_metadata") or {}

        # Mandatory Activity Title validation for Event Coordinator and Volunteer
        role_cat = meta.get("club_role_category") or data.get("activity_type")
        ach_title = (data.get("title") or meta.get("activity_title") or "").strip()
        if role_cat in ("Event Coordinator", "Volunteer"):
            if not ach_title:
                raise ValueError(f"Activity Title is mandatory for {role_cat}. Please specify the event/activity title.")
            meta["activity_title"] = ach_title
        elif not ach_title:
            club_or_name = meta.get("club_name") or data.get("activity_type")
            if club_or_name:
                ach_title = f"{club_or_name} ({role_cat})" if role_cat and role_cat not in club_or_name else club_or_name
            else:
                ach_title = "PGPA Achievement"

        # Online Certifications validation
        comp_id = data.get("component_id")
        comp = await self.first("SELECT slug FROM pgpa_components WHERE id = ?", comp_id) if comp_id else None
        if comp and comp.get("slug") == "online-certifications":
            # If outcome is not provided by the client, default to "Completed"
            if not data.get("outcome"):
                data["outcome"] = "Completed"
            if meta is not None and not meta.get("category"):
                meta["category"] = "Completed"

            outcome_val = str(data.get("outcome") or (meta and meta.get("category")) or "").strip().lower()
            if outcome_val in ("gold", "silver", "elite with gold"):
                raise ValueError("Invalid outcome: 'Gold', 'Silver', and 'Elite with Gold' are no longer permitted. Allowed outcomes: Completed / Passed, Elite, Topper, Course Completed.")

            provider_val = str(meta.get("provider") or "").strip()
            if provider_val == "Other Approved Platform" or data.get("organizer") == "Other Approved Platform":
                custom_prov = str(meta.get("custom_provider") or data.get("organizer") or "").strip()
                if not custom_prov or custom_prov == "Other Approved Platform":
                    raise ValueError("Enter Platform / Provider Name is required when 'Other Approved Platform' is selected.")
                if len(custom_prov) > 120:
                    raise ValueError("Platform / Provider Name cannot exceed 120 characters.")
                meta["custom_provider"] = custom_prov
                data["organizer"] = custom_prov
                data["activity_type"] = custom_prov

        meta_str = json.dumps(meta)
        await self.execute(
            """INSERT INTO achievements (
                id, student_id, component_id, semester_id, title, activity_type,
                organizer, event_date, description, outcome, certificate_status,
                remarks, component_metadata, status, submitted_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            ach_id,
            student_id,
            data.get("component_id"),
            data.get("semester_id"),
            ach_title,
            data.get("activity_type"),
            data.get("organizer"),
            data.get("event_date"),
            data.get("description"),
            data.get("outcome"),
            data.get("certificate_status", "uploaded"),
            data.get("remarks"),
            meta_str,
        )
        return await self.get_achievement_detail(ach_id)

    async def update_achievement(self, achievement_id: str, student_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        ach = await self.get_achievement_detail(achievement_id)
        if not ach or ach["student_id"] != student_id:
            return None
        if ach["status"] in ("approved", "under_review"):
            raise ValueError(f"Cannot edit achievement in '{ach['status']}' state")

        meta = data.get("component_metadata")

        # Online Certifications validation on edit
        comp_id = data.get("component_id") or ach.get("component_id")
        comp = await self.first("SELECT slug FROM pgpa_components WHERE id = ?", comp_id) if comp_id else None
        if comp and comp.get("slug") == "online-certifications":
            new_outcome = data.get("outcome") or (meta and meta.get("category"))
            if new_outcome:
                outcome_val = str(new_outcome).strip().lower()
                hist_outcome = str(ach.get("outcome") or "").strip().lower()
                if outcome_val in ("gold", "silver", "elite with gold") and outcome_val != hist_outcome:
                    raise ValueError("Invalid outcome: 'Gold', 'Silver', and 'Elite with Gold' are no longer permitted. Allowed outcomes: Completed / Passed, Elite, Topper, Course Completed.")

            provider_val = str((meta and meta.get("provider")) or "").strip()
            if provider_val == "Other Approved Platform" or data.get("organizer") == "Other Approved Platform":
                custom_prov = str((meta and meta.get("custom_provider")) or data.get("organizer") or "").strip()
                if not custom_prov or custom_prov == "Other Approved Platform":
                    raise ValueError("Enter Platform / Provider Name is required when 'Other Approved Platform' is selected.")
                if len(custom_prov) > 120:
                    raise ValueError("Platform / Provider Name cannot exceed 120 characters.")
                if meta:
                    meta["custom_provider"] = custom_prov
                data["organizer"] = custom_prov
                data["activity_type"] = custom_prov

        meta_str = json.dumps(meta) if meta is not None else ach.get("component_metadata")

        await self.execute(
            """UPDATE achievements SET
                title = COALESCE(?, title),
                component_id = COALESCE(?, component_id),
                semester_id = COALESCE(?, semester_id),
                activity_type = COALESCE(?, activity_type),
                organizer = COALESCE(?, organizer),
                event_date = COALESCE(?, event_date),
                description = COALESCE(?, description),
                outcome = COALESCE(?, outcome),
                certificate_status = COALESCE(?, certificate_status),
                remarks = COALESCE(?, remarks),
                component_metadata = COALESCE(?, component_metadata),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND student_id = ?""",
            data.get("title"),
            data.get("component_id"),
            data.get("semester_id"),
            data.get("activity_type"),
            data.get("organizer"),
            data.get("event_date"),
            data.get("description"),
            data.get("outcome"),
            data.get("certificate_status"),
            data.get("remarks"),
            meta_str,
            achievement_id,
            student_id,
        )
        return await self.get_achievement_detail(achievement_id)

    async def submit_achievement(self, achievement_id: str, student_id: str) -> Optional[Dict[str, Any]]:
        ach = await self.get_achievement_detail(achievement_id)
        if not ach or ach["student_id"] != student_id:
            return None
        if ach["status"] not in ("draft", "rejected"):
            raise ValueError(f"Achievement is already submitted (status: {ach['status']})")

        now = _utc_now_iso()
        await self.execute(
            "UPDATE achievements SET status = 'pending', submitted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            now,
            achievement_id,
        )
        return await self.get_achievement_detail(achievement_id)

    async def delete_achievement(self, achievement_id: str, student_id: str) -> bool:
        ach = await self.get_achievement_detail(achievement_id)
        if not ach or ach["student_id"] != student_id:
            return False
        if ach["status"] in ("approved", "under_review"):
            raise ValueError(f"Cannot delete achievement with status '{ach['status']}'")

        await self.execute("DELETE FROM achievements WHERE id = ? AND student_id = ?", achievement_id, student_id)
        return True

    # ==========================================
    # Mentor & Review Operations
    # ==========================================
    async def get_assigned_students(self, mentor_id: str) -> List[Dict[str, Any]]:
        students = await self.query(
            """SELECT u.id as student_id, u.id, u.full_name, u.email, sp.register_number, sp.department,
                      sp.year, sp.section, sp.semester, sp.batch, ma.id as assignment_id, ma.assigned_at,
                      COALESCE(sub.sub_cnt, 0) as submission_count
               FROM mentor_assignments ma
               JOIN users u ON ma.student_id = u.id
               LEFT JOIN student_profiles sp ON u.id = sp.user_id
               LEFT JOIN (
                   SELECT student_id, count(*) as sub_cnt
                   FROM achievements
                   WHERE status != 'draft'
                   GROUP BY student_id
               ) sub ON u.id = sub.student_id
               WHERE ma.mentor_id = ? AND ma.is_active = 1
               ORDER BY sp.register_number ASC""",
            mentor_id,
        )
        if not students:
            return []

        # Load component results for these students to attach 5 components, total points, and overall grade
        st_ids = [s["student_id"] for s in students]
        placeholders = ",".join(["?"] * len(st_ids))

        results = await self.query(
            f"""SELECT cr.student_id, cr.grade, cr.grade_points, cr.raw_score,
                       c.slug as component_slug, c.name as component_name
                FROM student_component_results cr
                JOIN pgpa_components c ON cr.component_id = c.id
                WHERE cr.student_id IN ({placeholders}) AND c.is_active = 1 AND c.is_visible = 1 AND c.slug != 'skillrack'""",
            *st_ids,
        )

        manuals = await self.query(
            f"""SELECT mp.id as manual_point_id, mp.student_id, mp.points, mp.remarks,
                       c.slug as component_slug, c.name as component_name,
                       s.semester_number, s.display_name as semester_name
                FROM manual_component_points mp
                JOIN pgpa_components c ON mp.component_id = c.id
                LEFT JOIN semesters s ON mp.semester_id = s.id
                WHERE mp.student_id IN ({placeholders}) AND c.is_active = 1 AND c.is_visible = 1 AND c.slug != 'skillrack'""",
            *st_ids,
        )

        by_student: Dict[str, Dict[str, Any]] = {s["student_id"]: {} for s in students}
        for r in results:
            sid = r["student_id"]
            slug = r["component_slug"]
            if sid in by_student:
                by_student[sid][slug] = {
                    "grade": r.get("grade") or "—",
                    "points": r.get("raw_score") or r.get("grade_points") or 0,
                    "raw_score": r.get("raw_score") or 0,
                    "component_name": r.get("component_name"),
                    "is_manual": False,
                }

        for m in manuals:
            sid = m["student_id"]
            slug = m["component_slug"]
            if sid in by_student and slug not in by_student[sid]:
                pts = m.get("points") or 0
                if slug == "skillrack":
                    sem_num = m.get("semester_number") or 1
                    g_str, _ = grade_skillrack(pts, sem_num)
                else:
                    g_str, _ = score_to_grade_table_b(pts if pts <= 10 else 7.0)
                by_student[sid][slug] = {
                    "grade": g_str,
                    "points": pts,
                    "raw_score": pts,
                    "component_name": m.get("component_name"),
                    "is_manual": True,
                    "manual_point_id": m.get("manual_point_id"),
                    "remarks": m.get("remarks"),
                    "semester_number": m.get("semester_number"),
                    "semester_name": m.get("semester_name"),
                }

        for s in students:
            sid = s["student_id"]
            comp_dict = by_student.get(sid, {})
            tot = sum(float(c.get("points") or 0) for cslug, c in comp_dict.items() if cslug != "academics-gpa")
            grades = [c.get("grade") for c in comp_dict.values() if c.get("grade") and c.get("grade") != "—"]
            overall_g = grades[0] if grades else "—"
            if "O" in grades:
                overall_g = "O"
            elif "A+" in grades:
                overall_g = "A+"
            elif "A" in grades:
                overall_g = "A"

            s["components"] = comp_dict
            s["total_points"] = int(tot) if tot.is_integer() else round(tot, 2)
            s["overall_grade"] = overall_g

        return students

    async def get_mentee_submissions(
        self,
        mentor_id: str,
        status: Optional[str] = None,
        semester_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = """SELECT a.id, a.student_id, a.component_id, a.semester_id, a.title, a.activity_type,
                        a.organizer, a.event_date, a.description, a.outcome, a.certificate_status,
                        a.remarks, a.component_metadata, a.status, a.submitted_at, a.created_at,
                        u.full_name as student_name, u.email as student_email,
                        sp.register_number, sp.department, sp.year, sp.section,
                        c.name as component_name, c.slug as component_slug, c.credit_value,
                        s.display_name as semester_name, s.semester_number
                 FROM achievements a
                 JOIN mentor_assignments ma ON a.student_id = ma.student_id AND ma.is_active = 1
                 JOIN users u ON a.student_id = u.id
                 LEFT JOIN student_profiles sp ON u.id = sp.user_id
                 JOIN pgpa_components c ON a.component_id = c.id
                 LEFT JOIN semesters s ON a.semester_id = s.id
                 WHERE ma.mentor_id = ?"""
        params = [mentor_id]
        if status:
            sql += " AND a.status = ?"
            params.append(status)
        if semester_id:
            sql += " AND a.semester_id = ?"
            params.append(semester_id)
        sql += " ORDER BY a.submitted_at DESC, a.created_at DESC"
        rows = await self.query(sql, *params)
        return await self.attach_files_and_results(rows)

    async def recalculate_student_semester_pgpa(self, student_id: str, semester_id: str) -> Dict[str, Any]:
        """
        Recalculates student's semester PGPA from all verified component results,
        updating the student_semester_pgpa table without double counting.
        """
        if not student_id or not semester_id:
            return {}

        verified_results = await self.query(
            """SELECT cr.*, c.slug as component_slug, c.name as component_name
               FROM student_component_results cr
               JOIN pgpa_components c ON cr.component_id = c.id
               WHERE cr.student_id = ? AND cr.semester_id = ? AND cr.is_verified = 1""",
            student_id,
            semester_id,
        )

        existing_pgpa = await self.first(
            "SELECT gpa FROM student_semester_pgpa WHERE student_id = ? AND semester_id = ?",
            student_id,
            semester_id,
        )
        semester_gpa = existing_pgpa.get("gpa") if (existing_pgpa and existing_pgpa.get("gpa") is not None) else 8.5

        overall = calculate_overall_pgpa(verified_results, semester_gpa=semester_gpa)

        pgpa_id = str(uuid.uuid4())
        await self.execute(
            """INSERT INTO student_semester_pgpa (
                id, student_id, semester_id, a1_score, gpa, pgpa,
                total_credits_attempted, total_credits_earned,
                calculated_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (student_id, semester_id) DO UPDATE SET
                a1_score = excluded.a1_score,
                gpa = excluded.gpa,
                pgpa = excluded.pgpa,
                total_credits_attempted = excluded.total_credits_attempted,
                total_credits_earned = excluded.total_credits_earned,
                calculated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP""",
            pgpa_id,
            student_id,
            semester_id,
            overall.get("a1_score", 0.0),
            overall.get("semester_gpa", semester_gpa),
            overall.get("pgpa", 0.0),
            overall.get("total_credits_attempted", 0),
            overall.get("total_credits_earned", 0),
        )
        return overall

    async def review_achievement(
        self,
        reviewer_id: str,
        achievement_id: str,
        action: str,
        remarks: Optional[str] = None,
        grade: Optional[str] = None,
        grade_points: Optional[float] = None,
    ) -> Dict[str, Any]:
        ach = await self.get_achievement_detail(achievement_id)
        if not ach:
            raise ValueError("Achievement not found")

        status_map = {
            "approved": "approved",
            "rejected": "rejected",
            "requested_changes": "draft",
            "under_review": "under_review",
            "revert": "pending",
        }
        new_status = status_map.get(action, "pending")

        # 1. Update achievement status
        await self.execute(
            "UPDATE achievements SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            new_status,
            remarks or ach.get("remarks"),
            achievement_id,
        )

        # 2. Append verification log
        log_id = str(uuid.uuid4())
        await self.execute(
            """INSERT INTO verification_logs (id, achievement_id, reviewer_id, action, remarks, created_at)
               VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            log_id,
            achievement_id,
            reviewer_id,
            action,
            remarks or "",
        )

        # 3. Handle Point & Grade Calculation
        if action == "approved":
            # Fetch component info & thresholds
            comp = await self.get_component_by_id(ach["component_id"])
            credit_value = comp.get("credit_value", 3) if comp else 3
            slug = ach.get("component_slug") or (comp.get("slug") if comp else "generic")
            sem_num = ach.get("semester_number") or 1

            # Parse inputs from component_metadata and top-level fields
            meta = ach.get("component_metadata")
            inputs: Dict[str, Any] = {}
            if isinstance(meta, str) and meta.strip():
                try:
                    inputs = json.loads(meta)
                except Exception:
                    inputs = {}
            elif isinstance(meta, dict):
                inputs = dict(meta)

            if ach.get("activity_type") and "activity_type" not in inputs:
                inputs["activity_type"] = ach["activity_type"]
            if ach.get("outcome") and "outcome" not in inputs:
                inputs["outcome"] = ach["outcome"]
            if ach.get("organizer") and "organizer" not in inputs:
                inputs["organizer"] = ach["organizer"]
            if ach.get("title") and "title" not in inputs:
                inputs["title"] = ach["title"]
            if ach.get("description") and "description" not in inputs:
                inputs["description"] = ach["description"]

            # Seamlessly recalculate cumulative component result from all approved submissions
            await self.recalculate_student_component_result(ach["student_id"], ach["component_id"], ach["semester_id"])
        else:
            # Under review, rejected, or reverted: MUST receive 0 approved points from this submission
            await self.execute(
                "DELETE FROM student_component_results WHERE achievement_id = ? AND source = 'student_submission'",
                achievement_id,
            )
            if ach.get("student_id") and ach.get("component_id") and ach.get("semester_id"):
                await self.recalculate_student_component_result(ach["student_id"], ach["component_id"], ach["semester_id"])

        return await self.get_achievement_detail(achievement_id)

    # ==========================================
    # HOD & Admin Operations
    # ==========================================
    async def get_department_overview(self) -> Dict[str, Any]:
        total_students = (await self.first("SELECT count(*) as cnt FROM student_profiles"))["cnt"]
        total_submissions = (await self.first("SELECT count(*) as cnt FROM achievements WHERE status != 'draft'"))["cnt"]
        pending = (await self.first("SELECT count(*) as cnt FROM achievements WHERE status = 'pending'"))["cnt"]
        approved = (await self.first("SELECT count(*) as cnt FROM achievements WHERE status = 'approved'"))["cnt"]
        rejected = (await self.first("SELECT count(*) as cnt FROM achievements WHERE status = 'rejected'"))["cnt"]
        return {
            "total_students": total_students,
            "total_submissions": total_submissions,
            "pending_reviews": pending,
            "approved_submissions": approved,
            "rejected_submissions": rejected,
        }

    async def get_department_submissions(
        self,
        status: Optional[str] = None,
        semester_id: Optional[str] = None,
        semester: Optional[str] = None,
        component_id: Optional[str] = None,
        student_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = """SELECT a.id, a.student_id, a.component_id, a.semester_id, a.title, a.activity_type,
                        a.organizer, a.event_date, a.description, a.outcome, a.certificate_status,
                        a.remarks, a.component_metadata, a.status, a.submitted_at, a.created_at,
                        u.full_name as student_name, u.email as student_email,
                        sp.register_number, sp.department, sp.year, sp.section,
                        c.name as component_name, c.slug as component_slug, c.credit_value,
                        s.display_name as semester_name, s.semester_number,
                        COALESCE(m.full_name, sp.original_mentor_name, '—') as mentor_name
                 FROM achievements a
                 JOIN users u ON a.student_id = u.id
                 LEFT JOIN student_profiles sp ON u.id = sp.user_id
                 LEFT JOIN mentor_assignments ma ON a.student_id = ma.student_id AND ma.is_active = 1
                 LEFT JOIN users m ON ma.mentor_id = m.id
                 JOIN pgpa_components c ON a.component_id = c.id
                 LEFT JOIN semesters s ON a.semester_id = s.id
                 WHERE a.status != 'draft' AND c.is_active = 1 AND c.is_visible = 1 AND c.slug != 'skillrack'"""
        params = []
        if status and status != "all":
            sql += " AND a.status = ?"
            params.append(status)

        target_sem = semester_id or semester
        if target_sem and target_sem != "all":
            sem_str = str(target_sem).strip()
            digits = "".join([c for c in sem_str if c.isdigit()])
            if digits:
                sql += " AND (s.semester_number = ? OR a.semester_id = ? OR a.semester_id LIKE ?)"
                params.extend([int(digits), sem_str, f"%{digits}"])
            else:
                sql += " AND a.semester_id = ?"
                params.append(sem_str)

        if component_id and component_id != "all":
            sql += " AND (a.component_id = ? OR c.slug = ?)"
            params.extend([component_id, component_id])

        if student_id and student_id != "all":
            sql += " AND (a.student_id = ? OR sp.id = ? OR sp.register_number = ?)"
            params.extend([student_id, student_id, student_id])

        if search and str(search).strip():
            term = f"%{str(search).strip().lower()}%"
            sql += " AND (LOWER(u.full_name) LIKE ? OR LOWER(sp.register_number) LIKE ? OR LOWER(a.title) LIKE ?)"
            params.extend([term, term, term])

        sql += " ORDER BY a.submitted_at DESC, a.created_at DESC"
        rows = await self.query(sql, *params)
        return await self.attach_files_and_results(rows)

    async def list_all_students_admin(self) -> List[Dict[str, Any]]:
        students = await self.query(
            """SELECT u.id, u.id as student_id, u.full_name, u.email, u.role, u.is_active, u.must_change_password,
                      sp.register_number, sp.department, sp.year, sp.section, sp.semester,
                      sp.batch, sp.phone_number, sp.original_mentor_name, sp.google_drive_folder_id,
                      COALESCE(m.id, ma.mentor_id) as mentor_id,
                      COALESCE(m.full_name, sp.original_mentor_name, '—') as mentor_name,
                      COALESCE(sub.sub_cnt, 0) as submission_count
               FROM users u
               JOIN student_profiles sp ON u.id = sp.user_id
               LEFT JOIN mentor_assignments ma ON u.id = ma.student_id AND ma.is_active = 1
               LEFT JOIN users m ON ma.mentor_id = m.id
               LEFT JOIN (
                   SELECT student_id, count(*) as sub_cnt
                   FROM achievements
                   WHERE status != 'draft'
                   GROUP BY student_id
               ) sub ON u.id = sub.student_id
               ORDER BY sp.register_number ASC"""
        )
        if not students:
            return []

        st_ids = [s["student_id"] for s in students]
        placeholders = ",".join(["?"] * len(st_ids))

        results = await self.query(
            f"""SELECT cr.student_id, cr.grade, cr.grade_points, cr.raw_score,
                       c.slug as component_slug
                FROM student_component_results cr
                JOIN pgpa_components c ON cr.component_id = c.id
                WHERE cr.student_id IN ({placeholders}) AND c.is_active = 1 AND c.is_visible = 1 AND c.slug != 'skillrack'""",
            *st_ids,
        )
        manuals = await self.query(
            f"""SELECT mp.id as manual_point_id, mp.student_id, mp.points, mp.remarks,
                       c.slug as component_slug, c.name as component_name,
                       s.semester_number, s.display_name as semester_name
                FROM manual_component_points mp
                JOIN pgpa_components c ON mp.component_id = c.id
                LEFT JOIN semesters s ON mp.semester_id = s.id
                WHERE mp.student_id IN ({placeholders}) AND c.is_active = 1 AND c.is_visible = 1 AND c.slug != 'skillrack'""",
            *st_ids,
        )

        by_student: Dict[str, Dict[str, Any]] = {s["student_id"]: {} for s in students}
        for r in results:
            sid = r["student_id"]
            slug = r["component_slug"]
            if sid in by_student:
                by_student[sid][slug] = {
                    "grade": r.get("grade") or "—",
                    "points": r.get("raw_score") or r.get("grade_points") or 0,
                    "is_manual": False,
                }

        for m in manuals:
            sid = m["student_id"]
            slug = m["component_slug"]
            if sid in by_student and slug not in by_student[sid]:
                pts = m.get("points") or 0
                if slug == "skillrack":
                    sem_num = m.get("semester_number") or 1
                    g_str, _ = grade_skillrack(pts, sem_num)
                else:
                    g_str, _ = score_to_grade_table_b(pts if pts <= 10 else 7.0)
                by_student[sid][slug] = {
                    "grade": g_str,
                    "points": pts,
                    "is_manual": True,
                    "manual_point_id": m.get("manual_point_id"),
                    "remarks": m.get("remarks"),
                }

        for s in students:
            sid = s["student_id"]
            comp_dict = by_student.get(sid, {})
            tot = sum(float(c.get("points") or 0) for cslug, c in comp_dict.items() if cslug not in ("academics-gpa", "skillrack"))
            grades = [c.get("grade") for c in comp_dict.values() if c.get("grade") and c.get("grade") != "—"]
            overall_g = grades[0] if grades else "—"
            if "O" in grades:
                overall_g = "O"
            elif "A+" in grades:
                overall_g = "A+"
            elif "A" in grades:
                overall_g = "A"

            s["components"] = comp_dict
            s["total_points"] = int(tot) if tot.is_integer() else round(tot, 2)
            s["overall_grade"] = overall_g

        return students

    async def list_all_mentors_admin(self) -> List[Dict[str, Any]]:
        return await self.query(
            """SELECT u.id, u.full_name, u.email, u.role, u.is_active,
                      mp.staff_id, mp.department, mp.designation,
                      count(ma.id) as mentee_count
               FROM users u
               JOIN mentor_profiles mp ON u.id = mp.user_id
               LEFT JOIN mentor_assignments ma ON u.id = ma.mentor_id AND ma.is_active = 1
               GROUP BY u.id
               ORDER BY u.full_name ASC"""
        )

    async def list_all_hods_admin(self) -> List[Dict[str, Any]]:
        return await self.query(
            """SELECT u.id, u.full_name, u.email, u.role, u.is_active,
                      hp.staff_id, hp.department, hp.designation
               FROM users u
               JOIN hod_profiles hp ON u.id = hp.user_id
               ORDER BY u.full_name ASC"""
        )

    async def reassign_students(self, mentor_id: str, student_ids: List[str], assigned_by: str) -> int:
        count = 0
        for sid in student_ids:
            assign_id = str(uuid.uuid4())
            await self.execute("UPDATE mentor_assignments SET is_active = 0 WHERE student_id = ?", sid)
            await self.execute(
                "INSERT INTO mentor_assignments (id, mentor_id, student_id, assigned_by, is_active) VALUES (?, ?, ?, ?, 1)",
                assign_id,
                mentor_id,
                sid,
                assigned_by,
            )
            count += 1
        return count

    # ==========================================
    # File References in D1 (Google Drive storage)
    # ==========================================
    async def create_achievement_file(
        self,
        achievement_id: str,
        provider: str,
        drive_file_id: str,
        drive_folder_id: str,
        filename: str,
        mime_type: str,
        size_bytes: int,
        category: str,
        uploaded_by: str,
    ) -> Dict[str, Any]:
        file_id = str(uuid.uuid4())
        await self.execute(
            """INSERT INTO achievement_files (
                id, achievement_id, provider, drive_file_id, drive_folder_id,
                original_filename, mime_type, size_bytes, file_category, uploaded_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            file_id,
            achievement_id,
            provider,
            drive_file_id,
            drive_folder_id,
            filename,
            mime_type,
            size_bytes,
            category,
            uploaded_by,
        )
        return await self.first("SELECT * FROM achievement_files WHERE id = ?", file_id)

    async def get_file_by_id(self, file_id: str) -> Optional[Dict[str, Any]]:
        return await self.first("SELECT * FROM achievement_files WHERE id = ?", file_id)

    async def delete_file(self, file_id: str) -> bool:
        await self.execute("DELETE FROM achievement_files WHERE id = ?", file_id)
        return True

    # ==========================================
    # In-App Communications / Messages
    # ==========================================
    async def list_messages(
        self,
        user_id: str,
        achievement_id: Optional[str] = None,
        student_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = [
            """SELECT m.id, m.sender_id, m.recipient_id, m.message_body, m.message_type,
                      m.related_achievement_id, m.is_read, m.read_at, m.created_at,
                      s.full_name as sender_name, s.role as sender_role,
                      r.full_name as recipient_name, r.role as recipient_role,
                      a.title as achievement_title
               FROM messages m
               JOIN users s ON m.sender_id = s.id
               JOIN users r ON m.recipient_id = r.id
               LEFT JOIN achievements a ON m.related_achievement_id = a.id
               WHERE (m.recipient_id = ? OR m.sender_id = ?)"""
        ]
        params: List[Any] = [user_id, user_id]

        if achievement_id and achievement_id != "all":
            query.append("AND m.related_achievement_id = ?")
            params.append(achievement_id)

        if student_id and student_id != "all":
            query.append("AND (m.sender_id = ? OR m.recipient_id = ?)")
            params.extend([student_id, student_id])

        query.append("ORDER BY m.created_at ASC")
        return await self.query(" ".join(query), *params)

    async def send_message(
        self,
        sender_id: str,
        recipient_id: str,
        body: str,
        msg_type: str = "General Message",
        related_achievement_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        clean_ach_id = str(related_achievement_id).strip() if related_achievement_id else None
        if clean_ach_id:
            await self.execute(
                """INSERT INTO messages (id, sender_id, recipient_id, message_body, message_type, related_achievement_id, is_read, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)""",
                msg_id,
                sender_id,
                recipient_id,
                body,
                msg_type,
                clean_ach_id,
            )
        else:
            await self.execute(
                """INSERT INTO messages (id, sender_id, recipient_id, message_body, message_type, related_achievement_id, is_read, created_at)
                   VALUES (?, ?, ?, ?, ?, NULL, 0, CURRENT_TIMESTAMP)""",
                msg_id,
                sender_id,
                recipient_id,
                body,
                msg_type,
            )
        return await self.first(
            """SELECT m.id, m.sender_id, m.recipient_id, m.message_body, m.message_type,
                      m.related_achievement_id, m.is_read, m.read_at, m.created_at,
                      s.full_name as sender_name, s.role as sender_role,
                      r.full_name as recipient_name, r.role as recipient_role,
                      a.title as achievement_title
               FROM messages m
               JOIN users s ON m.sender_id = s.id
               JOIN users r ON m.recipient_id = r.id
               LEFT JOIN achievements a ON m.related_achievement_id = a.id
               WHERE m.id = ?""",
            msg_id,
        )

    async def mark_message_read(self, message_id: str, user_id: str) -> bool:
        await self.execute(
            "UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ?",
            message_id,
            user_id,
        )
        return True

    async def get_unread_count(self, user_id: str) -> int:
        res = await self.first("SELECT count(*) as cnt FROM messages WHERE recipient_id = ? AND is_read = 0", user_id)
        return res["cnt"] if res else 0

    # ==========================================
    # Manual Points
    # ==========================================
    async def get_manual_points_for_student(self, student_id: str) -> List[Dict[str, Any]]:
        return await self.query(
            """SELECT mp.id, mp.student_id, mp.mentor_id, mp.component_id, mp.semester_id,
                      mp.points, mp.remarks, 1 as is_active, mp.created_at, mp.updated_at,
                      u.full_name as student_name, sp.register_number as student_register_number,
                      c.name as component_name, c.slug as component_slug,
                      s.semester_number, s.display_name as semester_name,
                      m.full_name as mentor_name
               FROM manual_component_points mp
               JOIN users u ON mp.student_id = u.id
               LEFT JOIN student_profiles sp ON u.id = sp.user_id
               JOIN pgpa_components c ON mp.component_id = c.id
               JOIN semesters s ON mp.semester_id = s.id
               JOIN users m ON mp.mentor_id = m.id
               WHERE mp.student_id = ?
               ORDER BY mp.created_at DESC""",
            student_id,
        )

    async def get_all_manual_points(self) -> List[Dict[str, Any]]:
        return await self.query(
            """SELECT mp.id, mp.student_id, mp.mentor_id, mp.component_id, mp.semester_id,
                      mp.points, mp.remarks, 1 as is_active, mp.created_at, mp.updated_at,
                      u.full_name as student_name, sp.register_number as student_register_number,
                      c.name as component_name, c.slug as component_slug,
                      s.semester_number, s.display_name as semester_name,
                      m.full_name as mentor_name
               FROM manual_component_points mp
               JOIN users u ON mp.student_id = u.id
               LEFT JOIN student_profiles sp ON u.id = sp.user_id
               JOIN pgpa_components c ON mp.component_id = c.id
               JOIN semesters s ON mp.semester_id = s.id
               JOIN users m ON mp.mentor_id = m.id
               ORDER BY mp.created_at DESC"""
        )

    async def create_or_update_manual_points(
        self,
        mentor_id: str,
        student_id: str,
        component_id: str,
        semester_id: str,
        points: float,
        remarks: str,
    ) -> Dict[str, Any]:
        mp_id = str(uuid.uuid4())
        await self.execute(
            """INSERT INTO manual_component_points (id, student_id, mentor_id, component_id, semester_id, points, remarks, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            mp_id,
            student_id,
            mentor_id,
            component_id,
            semester_id,
            points,
            remarks,
        )
        return await self.first(
            """SELECT mp.id, mp.student_id, mp.mentor_id, mp.component_id, mp.semester_id,
                      mp.points, mp.remarks, 1 as is_active, mp.created_at, mp.updated_at,
                      u.full_name as student_name, sp.register_number as student_register_number,
                      c.name as component_name, c.slug as component_slug,
                      s.semester_number, s.display_name as semester_name,
                      m.full_name as mentor_name
               FROM manual_component_points mp
               JOIN users u ON mp.student_id = u.id
               LEFT JOIN student_profiles sp ON u.id = sp.user_id
               JOIN pgpa_components c ON mp.component_id = c.id
               JOIN semesters s ON mp.semester_id = s.id
               JOIN users m ON mp.mentor_id = m.id
               WHERE mp.id = ?""",
            mp_id,
        )

    async def delete_manual_point(self, point_id: str) -> bool:
        await self.execute("DELETE FROM manual_component_points WHERE id = ?", point_id)
        await self.execute("DELETE FROM student_component_results WHERE id = ?", point_id)
        return True

    async def update_manual_point(self, point_id: str, points: float, remarks: str) -> Optional[Dict[str, Any]]:
        await self.execute(
            "UPDATE manual_component_points SET points = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            points,
            remarks,
            point_id,
        )
        await self.execute(
            "UPDATE student_component_results SET raw_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            points,
            point_id,
        )
        return await self.first(
            """SELECT mp.id, mp.student_id, mp.mentor_id, mp.component_id, mp.semester_id,
                      mp.points, mp.remarks, 1 as is_active, mp.created_at, mp.updated_at,
                      u.full_name as student_name, sp.register_number as student_register_number,
                      c.name as component_name, c.slug as component_slug,
                      s.semester_number, s.display_name as semester_name,
                      m.full_name as mentor_name
               FROM manual_component_points mp
               JOIN users u ON mp.student_id = u.id
               LEFT JOIN student_profiles sp ON u.id = sp.user_id
               JOIN pgpa_components c ON mp.component_id = c.id
               JOIN semesters s ON mp.semester_id = s.id
               JOIN users m ON mp.mentor_id = m.id
               WHERE mp.id = ?""",
            point_id,
        )

    async def get_student_pgpa_grades(
        self,
        semester_id: Optional[str] = None,
        section: Optional[str] = None,
        mentor_id: Optional[str] = None,
        component_slug: Optional[str] = None,
        grade: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve official student PGPA grades matrix for HOD oversight.
        Matches the StudentPGPAGradeRow frontend contract.
        """
        query_parts = [
            """SELECT u.id as student_id, u.full_name as student_name, u.email,
                      sp.register_number, sp.department, sp.year, sp.section,
                      COALESCE(m.id, ma.mentor_id) as mentor_id,
                      COALESCE(m.full_name, sp.original_mentor_name, '—') as mentor_name
               FROM users u
               JOIN student_profiles sp ON u.id = sp.user_id
               LEFT JOIN mentor_assignments ma ON u.id = ma.student_id AND ma.is_active = 1
               LEFT JOIN users m ON ma.mentor_id = m.id
               WHERE u.is_active = 1"""
        ]
        params: List[Any] = []

        if section and section != "all":
            query_parts.append("AND sp.section = ?")
            params.append(section)

        if mentor_id and mentor_id != "all":
            query_parts.append("AND (m.id = ? OR ma.mentor_id = ? OR LOWER(sp.original_mentor_name) LIKE ?)")
            params.extend([mentor_id, mentor_id, f"%{str(mentor_id).strip().lower()}%"])

        if search and str(search).strip():
            term = f"%{str(search).strip().lower()}%"
            query_parts.append("AND (LOWER(u.full_name) LIKE ? OR LOWER(sp.register_number) LIKE ? OR LOWER(u.email) LIKE ?)")
            params.extend([term, term, term])

        query_parts.append("ORDER BY sp.register_number ASC, u.full_name ASC")
        students = await self.query(" ".join(query_parts), *params)

        if not students:
            return []

        results_query = [
            """SELECT cr.id, cr.student_id, cr.component_id, cr.semester_id, cr.grade, cr.grade_points,
                      cr.raw_score, cr.credit_value, cr.is_verified, cr.source, cr.updated_at as calculated_at,
                      c.slug as component_slug, c.name as component_name,
                      s.semester_number, s.display_name as semester_name
               FROM student_component_results cr
               JOIN pgpa_components c ON cr.component_id = c.id
               LEFT JOIN semesters s ON cr.semester_id = s.id
               WHERE c.is_active = 1 AND c.is_visible = 1 AND c.slug != 'skillrack'"""
        ]
        res_params: List[Any] = []

        if semester_id and semester_id != "all":
            if str(semester_id).strip().isdigit():
                results_query.append("AND (s.semester_number = ? OR cr.semester_id = ? OR cr.semester_id LIKE ?)")
                res_params.extend([int(semester_id), str(semester_id), f"%{semester_id}"])
            else:
                results_query.append("AND cr.semester_id = ?")
                res_params.append(semester_id)

        if component_slug and component_slug != "all":
            results_query.append("AND c.slug = ?")
            res_params.append(component_slug)

        if grade and grade != "all":
            results_query.append("AND cr.grade = ?")
            res_params.append(grade)

        all_results = await self.query(" ".join(results_query), *res_params)

        # Also query active manual mentor/HOD point awards
        manual_query = [
            """SELECT mp.id, mp.student_id, mp.component_id, mp.semester_id, mp.points as raw_score,
                      mp.remarks, mp.updated_at as calculated_at,
                      c.slug as component_slug, c.name as component_name, c.credit_value,
                      s.semester_number, s.display_name as semester_name
               FROM manual_component_points mp
               JOIN pgpa_components c ON mp.component_id = c.id
               LEFT JOIN semesters s ON mp.semester_id = s.id
               WHERE c.is_active = 1 AND c.is_visible = 1 AND c.slug != 'skillrack'"""
        ]
        m_params: List[Any] = []

        if semester_id and semester_id != "all":
            if str(semester_id).strip().isdigit():
                manual_query.append("AND (s.semester_number = ? OR mp.semester_id = ? OR mp.semester_id LIKE ?)")
                m_params.extend([int(semester_id), str(semester_id), f"%{semester_id}"])
            else:
                manual_query.append("AND mp.semester_id = ?")
                m_params.append(semester_id)

        if component_slug and component_slug != "all":
            manual_query.append("AND c.slug = ?")
            m_params.append(component_slug)

        all_manual = await self.query(" ".join(manual_query), *m_params)

        # Group results by student_id -> component_slug -> score
        results_by_student: Dict[str, Dict[str, Any]] = {}
        for r in all_results:
            sid = r["student_id"]
            cslug = r["component_slug"]
            if sid not in results_by_student:
                results_by_student[sid] = {}
            pts = r.get("raw_score")
            gp = r.get("grade_points")
            results_by_student[sid][cslug] = {
                "id": r.get("id"),
                "result_id": r.get("id"),
                "manual_point_id": r.get("id"),
                "grade": r.get("grade"),
                "grade_points": gp,
                "grade_point": gp,
                "raw_score": pts,
                "points": pts,
                "credit_value": r.get("credit_value") or 0,
                "is_verified": bool(r.get("is_verified")),
                "status": "verified" if r.get("is_verified") else "in_review",
                "source": r.get("source"),
                "calculated_at": r.get("calculated_at"),
            }

        # Seamlessly incorporate legitimate manual points without double counting
        for m in all_manual:
            sid = m["student_id"]
            cslug = m["component_slug"]
            if sid not in results_by_student:
                results_by_student[sid] = {}
            existing = results_by_student[sid].get(cslug)
            m_pts = float(m.get("raw_score") or 0)
            if not existing:
                if cslug == "skillrack":
                    sem_num = m.get("semester_number") or 3
                    g_str, g_val = grade_skillrack(m_pts, int(sem_num))
                else:
                    g_str, g_val = score_to_grade_table_b(m_pts if m_pts <= 10 else (m_pts / 100.0 if m_pts > 100 else 7.0))
                results_by_student[sid][cslug] = {
                    "id": m.get("id"),
                    "result_id": m.get("id"),
                    "manual_point_id": m.get("id"),
                    "grade": g_str,
                    "grade_points": g_val,
                    "grade_point": g_val,
                    "raw_score": m_pts,
                    "points": m_pts,
                    "credit_value": m.get("credit_value") or 3,
                    "is_verified": True,
                    "status": "verified",
                    "source": "manual_point_award",
                    "calculated_at": m.get("calculated_at"),
                }
            elif (existing.get("points") is None or existing.get("points") == 0) and m_pts > 0:
                existing["id"] = m.get("id") or existing.get("id")
                existing["result_id"] = m.get("id") or existing.get("result_id")
                existing["manual_point_id"] = m.get("id")
                existing["points"] = m_pts
                existing["raw_score"] = m_pts
                existing["is_verified"] = True
                if cslug == "skillrack":
                    sem_num = m.get("semester_number") or 3
                    g_str, g_val = grade_skillrack(m_pts, int(sem_num))
                    existing["grade"] = g_str
                    existing["grade_points"] = g_val
                    existing["grade_point"] = g_val

        rows: List[Dict[str, Any]] = []
        for s in students:
            sid = s["student_id"]
            comp_scores = results_by_student.get(sid, {})

            if grade and grade != "all":
                has_grade = any(cs.get("grade") == grade for cs in comp_scores.values())
                if not has_grade:
                    continue

            tot_pts = 0.0
            tot_gp = 0.0
            tot_credits = 0
            for cslug, cs in comp_scores.items():
                if cslug in ("academics-gpa", "skillrack"):
                    continue
                val = cs.get("points")
                if val is None:
                    val = cs.get("raw_score")
                if isinstance(val, (int, float)):
                    tot_pts += float(val)
                gp_val = cs.get("grade_points")
                cr_val = cs.get("credit_value") or 0
                if isinstance(gp_val, (int, float)) and int(cr_val) > 0:
                    tot_gp += float(gp_val) * int(cr_val)
                    tot_credits += int(cr_val)

            clean_tot_pts = int(tot_pts) if tot_pts.is_integer() else round(tot_pts, 2)

            if tot_credits > 0:
                avg_gp = tot_gp / tot_credits
                overall_grade, _ = score_to_grade_table_b(avg_gp)
            elif tot_pts > 0:
                overall_grade, _ = score_to_grade_table_b(min(10.0, tot_pts / 100.0 if tot_pts > 10 else tot_pts))
            else:
                overall_grade = "—"

            rows.append({
                "student_id": sid,
                "register_number": s.get("register_number"),
                "student_name": s.get("student_name") or "Student",
                "email": s.get("email"),
                "department": s.get("department") or "CCE",
                "year": s.get("year") or 1,
                "section": s.get("section"),
                "mentor_id": s.get("mentor_id"),
                "mentor_name": s.get("mentor_name") or "—",
                "components": comp_scores,
                "total_points": clean_tot_pts,
                "total_grade_points": tot_gp,
                "overall_grade": overall_grade,
            })

        return rows
