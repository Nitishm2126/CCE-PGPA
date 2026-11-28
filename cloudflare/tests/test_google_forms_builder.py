import asyncio
import json
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))

from events_dal import EventsDAL
from events_routes import handle_events_request
from test_phase1_2_and_2_local import LocalD1DBAdapter


class MockRequest:
    def __init__(self, method="GET", path="/api/v1/events", headers=None, body_bytes=b""):
        self.method = method
        self.url = f"http://localhost:8787{path}"
        self.headers = headers or {}
        self._body = body_bytes

    async def bytes(self):
        return self._body


class TestGoogleFormsBuilderAndValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.src_db = (
            ROOT
            / ".wrangler"
            / "state"
            / "v3"
            / "d1"
            / "miniflare-D1DatabaseObject"
            / "c57ba87a474b0a092a849e913ea1a6adb63bc0b47384e09790d1115277ae43db.sqlite"
        )
        cls.tmpdir = tempfile.TemporaryDirectory()
        cls.tmp_db = Path(cls.tmpdir.name) / "google_forms_test.sqlite"
        shutil.copy2(cls.src_db, cls.tmp_db)

    @classmethod
    def tearDownClass(cls):
        cls.tmpdir.cleanup()

    def setUp(self):
        self.db = LocalD1DBAdapter(self.tmp_db)
        self.dal = EventsDAL(self.db)
        self.env = SimpleNamespace(
            DB=self.db,
            ENVIRONMENT="staging",
            JWT_SECRET_KEY="test-jwt-secret-key-at-least-32-chars",
        )
        self.admin_user = {
            "id": "u0000000-0000-0000-0000-000000000099",
            "role": "admin",
            "token_role": "admin",
            "full_name": "CCE System Administrator",
        }

        async def _get_students():
            return await self.dal.query(
                """SELECT u.id, u.full_name, u.role, sp.register_number, sp.section, sp.year
                   FROM users u JOIN student_profiles sp ON sp.user_id = u.id
                   WHERE u.role = 'student' AND u.is_active = 1
                   ORDER BY sp.register_number ASC LIMIT 2"""
            )

        students = asyncio.run(_get_students())
        self.assertGreaterEqual(len(students), 1)
        self.student_a = dict(students[0], token_role="student")

    def tearDown(self):
        try:
            self.db.conn.close()
        except Exception:
            pass

    def _future_event_payload(self, title: str):
        now = datetime.now(timezone.utc)
        return {
            "title": title,
            "category": "Workshop",
            "mode": "Hybrid",
            "event_start_at": (now + timedelta(days=3)).isoformat(),
            "event_end_at": (now + timedelta(days=4)).isoformat(),
            "registration_start_at": (now - timedelta(days=1)).isoformat(),
            "registration_deadline": (now + timedelta(days=2)).isoformat(),
            "status": "published",
            "audience_type": "all",
            "is_registration_enabled": True,
        }

    def test_01_form_settings_roundtrip_and_routes(self):
        async def _run():
            evt = await self.dal.create_event(self._future_event_payload("Google Forms Settings Workshop"), self.admin_user["id"])
            event_id = evt["id"]

            sections = [
                {"id": "sec_1", "title": "Basic Info", "order": 0},
                {
                    "id": "sec_2",
                    "title": "Travel Support",
                    "order": 1,
                    "conditions": {"logic": "and", "rules": [{"field": "need_travel", "operator": "equals", "value": "yes", "action": "show"}]},
                },
            ]
            fields = [
                {"field_key": "student_code", "field_type": "text", "label": "Student Code", "required": True, "section_id": "sec_1", "validation_config": {"regex_pattern": "^CCE[0-9]{3}$", "custom_error": "Format must be CCE followed by 3 digits."}},
                {"field_key": "need_travel", "field_type": "yes_no", "label": "Need Travel?", "required": True, "section_id": "sec_1"},
                {"field_key": "city", "field_type": "text", "label": "Departure City", "required": True, "section_id": "sec_2"},
            ]
            form_settings = {
                "form_title": "Custom Bootcamp Form",
                "form_description": "Please fill accurate information",
                "custom_instructions": "Carry your ID card",
                "submit_button_label": "Complete Entry",
                "success_message": "Thank you for enrolling!",
                "allow_multiple_responses": False,
                "allow_edit_submission": True,
                "allow_resubmission": True,
                "registration_capacity": 50,
                "show_progress_indicator": True,
                "show_section_navigation": False,
            }

            body_dict = {"fields": fields, "sections_config": sections, "form_settings": form_settings}
            req = MockRequest(
                "POST",
                f"/api/v1/events/{event_id}/forms",
                body_bytes=json.dumps(body_dict).encode(),
            )
            res = await handle_events_request(req, f"/api/v1/events/{event_id}/forms", "POST", body_dict, {}, self.admin_user, None, self.env)
            self.assertEqual(res.status, 200)

            curr = await self.dal.get_current_form_version(event_id)
            self.assertIsNotNone(curr)
            self.assertIsInstance(curr["form_settings"], dict)
            self.assertEqual(curr["form_settings"]["form_title"], "Custom Bootcamp Form")
            self.assertEqual(curr["form_settings"]["submit_button_label"], "Complete Entry")
            self.assertEqual(curr["form_settings"]["success_message"], "Thank you for enrolling!")
            self.assertFalse(curr["form_settings"]["show_section_navigation"])

            refreshed_evt = await self.dal.get_event(event_id)
            self.assertTrue(refreshed_evt["allow_edit_submission"])
            self.assertEqual(refreshed_evt["registration_capacity"], 50)

        asyncio.run(_run())

    def test_02_validation_rules_and_conditional_section_skip(self):
        async def _run():
            evt = await self.dal.create_event(self._future_event_payload("Validation Rules Test Event"), self.admin_user["id"])
            event_id = evt["id"]

            sections = [
                {"id": "sec_main", "title": "Main", "order": 0},
                {
                    "id": "sec_online",
                    "title": "Online Session Setup",
                    "order": 1,
                    "conditions": {"logic": "and", "rules": [{"field": "attendance_mode", "operator": "equals", "value": "Online", "action": "show"}]},
                },
            ]
            fields = [
                {"field_key": "code", "field_type": "text", "label": "Roll Code", "required": True, "section_id": "sec_main", "validation_config": {"regex_pattern": "^[A-Z]{2}[0-9]{2}$", "custom_error": "Roll Code must be 2 letters + 2 digits"}},
                {"field_key": "age", "field_type": "number", "label": "Age", "required": True, "section_id": "sec_main", "validation_config": {"number_mode": "integer", "min_val": 17, "max_val": 30}},
                {"field_key": "skills", "field_type": "checkbox", "label": "Skills", "required": True, "section_id": "sec_main", "options_config": [{"label": "Python", "value": "python"}, {"label": "Cloud", "value": "cloud"}, {"label": "SQL", "value": "sql"}], "validation_config": {"min_selections": 2, "max_selections": 3, "allow_other": True}},
                {"field_key": "slot_date", "field_type": "date", "label": "Slot Date", "required": True, "section_id": "sec_main", "validation_config": {"min_date": "2026-01-01", "max_date": "2027-12-31"}},
                {"field_key": "slot_time", "field_type": "time", "label": "Slot Time", "required": True, "section_id": "sec_main", "validation_config": {"min_time": "09:00", "max_time": "17:00"}},
                {"field_key": "attendance_mode", "field_type": "radio", "label": "Mode", "required": True, "section_id": "sec_main", "options_config": [{"label": "Online", "value": "Online"}, {"label": "Offline", "value": "Offline"}]},
                {"field_key": "laptop_specs", "field_type": "text", "label": "Laptop Specs", "required": True, "section_id": "sec_online"},
            ]
            await self.dal.save_form_fields(event_id, fields, self.admin_user["id"], sections_config=sections, form_settings={"allow_edit_submission": True})
            await self.dal.change_event_status(event_id, "published", self.admin_user["id"])

            # 1) Regex error
            with self.assertRaises(ValueError) as ctx:
                await self.dal.submit_event_response(event_id, self.student_a["id"], None, {"code": "bad", "age": 20, "skills": ["python", "cloud"], "slot_date": "2026-06-01", "slot_time": "10:00", "attendance_mode": "Offline"})
            self.assertIn("2 letters + 2 digits", str(ctx.exception))

            # 2) Non-integer when integer mode required
            with self.assertRaises(ValueError) as ctx:
                await self.dal.submit_event_response(event_id, self.student_a["id"], None, {"code": "CS12", "age": 20.5, "skills": ["python", "cloud"], "slot_date": "2026-06-01", "slot_time": "10:00", "attendance_mode": "Offline"})
            self.assertIn("integer", str(ctx.exception).lower())

            # 3) Min checkbox selections
            with self.assertRaises(ValueError) as ctx:
                await self.dal.submit_event_response(event_id, self.student_a["id"], None, {"code": "CS12", "age": 20, "skills": ["python"], "slot_date": "2026-06-01", "slot_time": "10:00", "attendance_mode": "Offline"})
            self.assertIn("at least 2", str(ctx.exception))

            # 4) Time window check
            with self.assertRaises(ValueError) as ctx:
                await self.dal.submit_event_response(event_id, self.student_a["id"], None, {"code": "CS12", "age": 20, "skills": ["python", "Other: Rust"], "slot_date": "2026-06-01", "slot_time": "19:30", "attendance_mode": "Offline"})
            self.assertIn("17:00", str(ctx.exception))

            # 5) Section conditional skip: attendance_mode == "Offline" skips required laptop_specs in sec_online
            sub = await self.dal.submit_event_response(event_id, self.student_a["id"], None, {
                "code": "CS12",
                "age": 20,
                "skills": ["python", "Other: Rust"],
                "slot_date": "2026-06-01",
                "slot_time": "11:30",
                "attendance_mode": "Offline",
            })
            self.assertIsNotNone(sub)

            # 6) Version snapshot test: saving a new form after submission creates v2 while preserving v1
            v2 = await self.dal.save_form_fields(
                event_id,
                fields + [{"field_key": "extra_note", "field_type": "text", "label": "Extra Note v2", "required": False, "section_id": "sec_main"}],
                self.admin_user["id"],
                sections_config=sections,
                form_settings={"submit_button_label": "Send v2"},
            )
            self.assertEqual(v2["version_number"], 2)
            versions = await self.dal.list_form_versions(event_id)
            self.assertEqual(len(versions), 2)

        asyncio.run(_run())

    def test_03_mentor_mentee_audiences_and_notifications(self):
        async def _run():
            summary = await self.dal.get_audience_options_summary()
            self.assertEqual(summary["total_students"], 61)
            options = {o["mentor_key"]: o for o in summary["options"]}
            self.assertEqual(options["all"]["student_count"], 61)
            self.assertEqual(options["lekha"]["student_count"], 25)
            self.assertEqual(options["lurdhmary"]["student_count"], 25)
            self.assertEqual(options["pachhaiammal_priya"]["student_count"], 11)

            # Pick one real mentee from Lekha and one from Lurdhmary
            lekha_id = options["lekha"]["mentor_id"]
            lurdh_id = options["lurdhmary"]["mentor_id"]
            lekha_stu = (await self.dal.first("SELECT student_id FROM mentor_assignments WHERE mentor_id = ? AND is_active = 1 LIMIT 1", lekha_id))["student_id"]
            lurdh_stu = (await self.dal.first("SELECT student_id FROM mentor_assignments WHERE mentor_id = ? AND is_active = 1 LIMIT 1", lurdh_id))["student_id"]
            priya_id = options["pachhaiammal_priya"]["mentor_id"]
            priya_stu = (await self.dal.first("SELECT student_id FROM mentor_assignments WHERE mentor_id = ? AND is_active = 1 LIMIT 1", priya_id))["student_id"]

            # Create event targeted ONLY at Lekha Mentees with notifications enabled
            payload = self._future_event_payload("Lekha Mentee Exclusive Workshop")
            payload.update({
                "audience_type": "custom",
                "audience_payload": options["lekha"]["audience_payload"],
                "notify_students": True,
                "notification_title": "Lekha Mentee Alert",
                "notification_message": "Mandatory for Lekha mentees",
            })
            evt = await self.dal.create_event(payload, self.admin_user["id"])
            await self.dal.save_form_fields(
                evt["id"],
                [{"field_key": "q1", "field_type": "text", "label": "Topic", "required": True, "section_id": "sec_1"}],
                self.admin_user["id"],
                sections_config=[{"id": "sec_1", "title": "Main", "order": 0}],
            )
            await self.dal.change_event_status(evt["id"], "published", self.admin_user["id"])

            self.assertTrue(await self.dal.check_student_eligibility(evt["id"], lekha_stu))
            self.assertFalse(await self.dal.check_student_eligibility(evt["id"], lurdh_stu))
            self.assertFalse(await self.dal.check_student_eligibility(evt["id"], priya_stu))

            notif = await self.dal.first("SELECT id FROM notifications WHERE event_id = ?", evt["id"])
            self.assertIsNotNone(notif)
            rec_cnt = (await self.dal.first("SELECT COUNT(*) as cnt FROM notification_recipients WHERE notification_id = ?", notif["id"]))["cnt"]
            self.assertEqual(rec_cnt, 25)

        asyncio.run(_run())

    def test_04_yes_no_branching_and_anonymized_poll_results(self):
        async def _run():
            evt = await self.dal.create_event(self._future_event_payload("Branching Exam & Poll Test"), self.admin_user["id"])
            event_id = evt["id"]

            sections = [
                {"id": "sec_1", "title": "Section 1: Attendance", "order": 0},
                {"id": "sec_2", "title": "Section 2: After the Exam", "order": 1, "after_section_action": "__submit__"},
                {"id": "sec_3", "title": "Section 3: Reason for Not Attending", "order": 2, "after_section_action": "__submit__"},
            ]
            fields = [
                {
                    "field_key": "attended_exam",
                    "field_type": "yes_no",
                    "label": "Did you attend the examination?",
                    "required": True,
                    "section_id": "sec_1",
                    "validation_config": {
                        "go_to_section_on_answer": True,
                        "option_routes": {"yes": "sec_2", "no": "sec_3"},
                    },
                },
                {
                    "field_key": "fav_topic",
                    "field_type": "poll",
                    "label": "Which workshop topic next?",
                    "required": True,
                    "section_id": "sec_1",
                    "options_config": [{"label": "AI Agents", "value": "ai_agents"}, {"label": "Cloudflare", "value": "cloudflare"}],
                    "validation_config": {"show_poll_results": True},
                },
                {"field_key": "exam_feedback", "field_type": "text", "label": "Exam Feedback", "required": True, "section_id": "sec_2"},
                {"field_key": "absence_reason", "field_type": "textarea", "label": "Reason for Absence", "required": True, "section_id": "sec_3"},
            ]
            await self.dal.save_form_fields(event_id, fields, self.admin_user["id"], sections_config=sections, form_settings={"allow_edit_submission": True})
            await self.dal.change_event_status(event_id, "published", self.admin_user["id"])

            # Branch YES -> Section 2 required ('exam_feedback'), Section 3 ('absence_reason') NOT required
            with self.assertRaises(ValueError) as ctx_yes:
                await self.dal.submit_event_response(event_id, self.student_a["id"], None, {"attended_exam": "yes", "fav_topic": "ai_agents"})
            self.assertIn("Exam Feedback", str(ctx_yes.exception))

            # Branch NO -> Section 3 required ('absence_reason'), Section 2 ('exam_feedback') skipped cleanly
            sub = await self.dal.submit_event_response(
                event_id,
                self.student_a["id"],
                None,
                {"attended_exam": "no", "fav_topic": "ai_agents", "absence_reason": "Medical leave"},
            )
            self.assertIsNotNone(sub)

            # Anonymized poll results expose counts only, never student PII
            curr = await self.dal.get_current_form_version(event_id)
            agg = await self.dal.get_poll_aggregates(event_id, curr)
            self.assertEqual(agg["fav_topic"]["total"], 1)
            self.assertEqual(agg["fav_topic"]["counts"]["ai_agents"], 1)

        asyncio.run(_run())

    def test_content_blocks_sanitization_video_theme_and_duplicate(self):
        async def _run():
            ev = await self.dal.create_event(self._future_event_payload("Google Forms Full Editor Event"), self.admin_user["id"])
            event_id = ev["id"]

            # 1. Invalid video_block URL must raise ValueError
            bad_fields = [
                {
                    "field_key": "vid_bad",
                    "field_type": "video_block",
                    "label": "Unsafe Video",
                    "validation_config": {"media_config": {"video_url": "javascript:alert(1)"}},
                }
            ]
            with self.assertRaises(ValueError):
                await self.dal.save_form_fields(event_id, bad_fields, self.admin_user["id"])

            # 2. Save title_block, sanitized description, image_block, valid YouTube video_block, and theme
            fields = [
                {
                    "field_key": "blk_title",
                    "field_type": "title_block",
                    "label": "Workshop Welcome",
                    "required": True,  # Content block must still be skipped on submit
                    "validation_config": {"block_style": {"subtitle": "Read carefully", "alignment": "center"}},
                },
                {
                    "field_key": "blk_desc",
                    "field_type": "description",
                    "label": "Guidelines",
                    "description": "Plain fallback",
                    "validation_config": {
                        "rich_html": '<p>Bring <strong>ID</strong><script>alert("xss")</script> &amp; laptop.</p>',
                        "block_style": {"variant": "instructions"},
                    },
                },
                {
                    "field_key": "blk_img",
                    "field_type": "image_block",
                    "label": "Campus Map",
                    "validation_config": {
                        "media_config": {
                            "image_url": "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWx/view",
                            "caption": "Main Auditorium",
                            "width_percent": 75,
                        }
                    },
                },
                {
                    "field_key": "blk_vid",
                    "field_type": "video_block",
                    "label": "Intro Video",
                    "required": True,
                    "validation_config": {
                        "media_config": {
                            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            "video_description": "Watch before submitting",
                        }
                    },
                },
                {
                    "field_key": "q_team",
                    "field_type": "text",
                    "label": "Team Name",
                    "required": True,
                },
            ]
            theme_cfg = {
                "background_color": "#eef2ff",
                "theme_color": "#4f46e5",
                "font_family": "serif",
                "corner_radius": "2xl",
                "button_style": "pill",
            }
            ver = await self.dal.save_form_fields(
                event_id,
                fields,
                self.admin_user["id"],
                form_settings={"form_title": "Themed Form", "theme": theme_cfg},
            )
            desc_saved = next(f for f in ver["fields"] if f["field_key"] == "blk_desc")
            self.assertNotIn("<script>", desc_saved["validation_config"]["rich_html"])
            self.assertIn("<strong>ID</strong>", desc_saved["validation_config"]["rich_html"])

            vid_saved = next(f for f in ver["fields"] if f["field_key"] == "blk_vid")
            self.assertEqual(
                vid_saved["validation_config"]["media_config"]["embed_url"],
                "https://www.youtube.com/embed/dQw4w9WgXcQ",
            )
            self.assertEqual(ver["form_settings"]["theme"]["theme_color"], "#4f46e5")

            # 3. Publish and submit with only q_team (content blocks must not fail required checks)
            await self.dal.change_event_status(event_id, "published", self.admin_user["id"])
            sub = await self.dal.submit_event_response(
                event_id, self.student_a["id"], None, {"q_team": "Alpha Squad"}
            )
            self.assertIsNotNone(sub)

            # 4. Duplicate event preserves form fields + theme into a fresh draft event
            cloned = await self.dal.duplicate_event(event_id, self.admin_user["id"])
            self.assertIsNotNone(cloned)
            self.assertNotEqual(cloned["id"], event_id)
            self.assertEqual(cloned["status"], "draft")
            self.assertTrue(cloned["title"].endswith("(Copy)"))
            self.assertEqual(len(cloned["current_form"]["fields"]), 5)
            self.assertEqual(cloned["current_form"]["form_settings"]["theme"]["theme_color"], "#4f46e5")

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
