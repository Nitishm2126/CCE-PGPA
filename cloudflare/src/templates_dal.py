"""
CCE Events & Forms — Dedicated Event Templates DAL (Phase 1.2 & Phase 3)
Provides 5 canonical starter templates + custom template storage in D1.
"""

import copy
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("cce_templates_dal")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row: Any) -> Dict[str, Any]:
    if row is None:
        return {}
    if hasattr(row, "to_py"):
        try:
            return row.to_py()
        except Exception:
            pass
    if isinstance(row, dict):
        return dict(row)
    try:
        return dict(row)
    except Exception:
        pass
    return {}


def _normalize_template_field(field: Dict[str, Any], idx: int = 1, id_prefix: str = "tpl_f") -> Dict[str, Any]:
    f = copy.deepcopy(field) if isinstance(field, dict) else {}
    f["id"] = str(f.get("id") or f"{id_prefix}{idx}")
    f["field_key"] = str(f.get("field_key") or f"field_{idx}")
    f["field_type"] = str(f.get("field_type") or "text")
    f["label"] = str(f.get("label") or f["field_key"])
    f["required"] = bool(f.get("required", False))
    f["enabled"] = bool(f.get("enabled", True))
    f["display_order"] = int(f.get("display_order") or f.get("sort_order") or idx)
    f.pop("sort_order", None)

    val_cfg = f.get("validation_config")
    if isinstance(val_cfg, str):
        try:
            val_cfg = json.loads(val_cfg)
        except Exception:
            val_cfg = {}
    if not isinstance(val_cfg, dict):
        val_cfg = {}

    raw_opts = f.pop("options", None) or f.get("options_config") or val_cfg.pop("options", None)
    if isinstance(raw_opts, list) and len(raw_opts) > 0:
        f["options_config"] = [
            o if isinstance(o, dict) else {"label": str(o), "value": str(o)}
            for o in raw_opts
        ]
    elif isinstance(f.get("options_config"), list):
        f["options_config"] = [
            o if isinstance(o, dict) else {"label": str(o), "value": str(o)}
            for o in f["options_config"]
        ]

    if val_cfg:
        f["validation_config"] = val_cfg
    else:
        f.pop("validation_config", None)

    rc = f.get("rating_config")
    if isinstance(rc, dict):
        if "max_stars" in rc and "max_rating" not in rc:
            rc["max_rating"] = rc.pop("max_stars")
        f["rating_config"] = rc

    conds = f.get("conditions")
    if isinstance(conds, list):
        norm_c = []
        for c in conds:
            if isinstance(c, dict):
                norm_c.append({
                    "field": c.get("field") or c.get("field_key") or "",
                    "operator": c.get("operator") or "equals",
                    "value": c.get("value"),
                    "action": c.get("action") or "show",
                })
        f["conditions"] = norm_c

    rep = f.get("repeatable_config")
    if isinstance(rep, dict):
        rep["entity_name"] = rep.get("entity_name") or "Item"
        subfields = rep.get("fields") or []
        rep["fields"] = [
            _normalize_template_field(sf, s_i, f"{f['id']}_sub")
            for s_i, sf in enumerate(subfields, start=1)
        ]
        f["repeatable_config"] = rep

    return f


def _normalize_template(tpl: Dict[str, Any]) -> Dict[str, Any]:
    d = copy.deepcopy(tpl)
    if d.get("sections_config") and isinstance(d["sections_config"], str):
        try:
            d["sections_config"] = json.loads(d["sections_config"])
        except Exception:
            d["sections_config"] = []
    if not isinstance(d.get("sections_config"), list):
        d["sections_config"] = []

    if d.get("fields_config") and isinstance(d["fields_config"], str):
        try:
            d["fields_config"] = json.loads(d["fields_config"])
        except Exception:
            d["fields_config"] = []
    raw_fields = d.get("fields_config") if isinstance(d.get("fields_config"), list) else []
    d["fields_config"] = [_normalize_template_field(rf, idx) for idx, rf in enumerate(raw_fields, start=1)]
    d["is_starter"] = int(d.get("is_starter") or 0)
    return d


STARTER_TEMPLATES: List[Dict[str, Any]] = [   {   'id': 'tpl_workshop_seminar',
        'name': 'Workshop / Seminar Registration',
        'category': 'Workshop',
        'purpose': 'Technical workshops, guest lectures, webinars, and hands-on skill development '
                   'seminars.',
        'description': '4-section comprehensive registration with participant details, session '
                       'selection, technical interests, and confirmation.',
        'is_starter': 1,
        'default_title': 'Department Technical Workshop on Emerging Technologies',
        'default_subtitle': 'Hands-on Training & Expert Seminar Series',
        'default_mode': 'Offline',
        'form_layout_mode': 'multi_step',
        'sections_config': [   {   'id': 'sec_ws_student',
                                   'title': 'Section 1: Student Details',
                                   'description': 'Basic student profile and college department '
                                                  'information.',
                                   'order': 1},
                               {   'id': 'sec_ws_info',
                                   'title': 'Section 2: Event & Track Information',
                                   'description': 'Choose your preferred session timing and '
                                                  'participation track.',
                                   'order': 2},
                               {   'id': 'sec_ws_extra',
                                   'title': 'Section 3: Technical Background & Expectations',
                                   'description': 'Tell us about your background so speakers can '
                                                  'calibrate content.',
                                   'order': 3},
                               {   'id': 'sec_ws_confirm',
                                   'title': 'Section 4: Acknowledgment & Confirmation',
                                   'description': 'Attendance guidelines and confirmation '
                                                  'declaration.',
                                   'order': 4}],
        'fields_config': [   {   'id': 'ws_f1',
                                 'field_key': 'student_name',
                                 'field_type': 'text',
                                 'label': 'Full Name',
                                 'placeholder': 'Enter your full name',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_student',
                                 'display_order': 1},
                             {   'id': 'ws_f2',
                                 'field_key': 'register_number',
                                 'field_type': 'text',
                                 'label': 'Register Number',
                                 'placeholder': 'e.g. SEC22CO001',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_student',
                                 'display_order': 2},
                             {   'id': 'ws_f3',
                                 'field_key': 'college_email',
                                 'field_type': 'email',
                                 'label': 'College Email Address',
                                 'placeholder': 'student@sairamtap.edu.in',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_student',
                                 'display_order': 3},
                             {   'id': 'ws_f4',
                                 'field_key': 'department',
                                 'field_type': 'dropdown',
                                 'label': 'Department',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_student',
                                 'display_order': 4,
                                 'options_config': [   {   'label': 'Computer & Communication '
                                                                    'Engineering (CCE)',
                                                           'value': 'Computer & Communication '
                                                                    'Engineering (CCE)'},
                                                       {   'label': 'Computer Science & '
                                                                    'Engineering (CSE)',
                                                           'value': 'Computer Science & '
                                                                    'Engineering (CSE)'},
                                                       {   'label': 'Information Technology (IT)',
                                                           'value': 'Information Technology (IT)'},
                                                       {   'label': 'Artificial Intelligence & '
                                                                    'Data Science (AI-DS)',
                                                           'value': 'Artificial Intelligence & '
                                                                    'Data Science (AI-DS)'}]},
                             {   'id': 'ws_f5',
                                 'field_key': 'year_and_section',
                                 'field_type': 'dropdown',
                                 'label': 'Year & Section',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_student',
                                 'display_order': 5,
                                 'options_config': [   {   'label': 'II Year - Sec A',
                                                           'value': 'II Year - Sec A'},
                                                       {   'label': 'II Year - Sec B',
                                                           'value': 'II Year - Sec B'},
                                                       {   'label': 'III Year - Sec A',
                                                           'value': 'III Year - Sec A'},
                                                       {   'label': 'III Year - Sec B',
                                                           'value': 'III Year - Sec B'},
                                                       {   'label': 'IV Year - Sec A',
                                                           'value': 'IV Year - Sec A'},
                                                       {   'label': 'IV Year - Sec B',
                                                           'value': 'IV Year - Sec B'}]},
                             {   'id': 'ws_f6',
                                 'field_key': 'contact_phone',
                                 'field_type': 'phone',
                                 'label': 'Mobile Contact Number',
                                 'placeholder': '+91 98765 43210',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_student',
                                 'display_order': 6},
                             {   'id': 'ws_f7',
                                 'field_key': 'workshop_track',
                                 'field_type': 'dropdown',
                                 'label': 'Preferred Workshop Track',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_info',
                                 'display_order': 7,
                                 'options_config': [   {   'label': 'Track 1: Cloud & Edge '
                                                                    'Computing (AWS / Cloudflare)',
                                                           'value': 'Track 1: Cloud & Edge '
                                                                    'Computing (AWS / Cloudflare)'},
                                                       {   'label': 'Track 2: Applied Generative '
                                                                    'AI & LLMs',
                                                           'value': 'Track 2: Applied Generative '
                                                                    'AI & LLMs'},
                                                       {   'label': 'Track 3: Full-Stack React & '
                                                                    'Next.js Architecture',
                                                           'value': 'Track 3: Full-Stack React & '
                                                                    'Next.js Architecture'}]},
                             {   'id': 'ws_f8',
                                 'field_key': 'preferred_session',
                                 'field_type': 'radio',
                                 'label': 'Preferred Time Slot',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_info',
                                 'display_order': 8,
                                 'options_config': [   {   'label': 'Morning Batch (09:00 AM - '
                                                                    '12:30 PM)',
                                                           'value': 'Morning Batch (09:00 AM - '
                                                                    '12:30 PM)'},
                                                       {   'label': 'Afternoon Batch (01:30 PM - '
                                                                    '05:00 PM)',
                                                           'value': 'Afternoon Batch (01:30 PM - '
                                                                    '05:00 PM)'}]},
                             {   'id': 'ws_f9',
                                 'field_key': 'participation_mode',
                                 'field_type': 'radio',
                                 'label': 'Mode of Attendance',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_info',
                                 'display_order': 9,
                                 'options_config': [   {   'label': 'In-Person (Auditorium / Lab)',
                                                           'value': 'In-Person (Auditorium / Lab)'},
                                                       {   'label': 'Virtual Live Stream (Google '
                                                                    'Meet)',
                                                           'value': 'Virtual Live Stream (Google '
                                                                    'Meet)'}]},
                             {   'id': 'ws_f10',
                                 'field_key': 'previous_experience',
                                 'field_type': 'dropdown',
                                 'label': 'Prior Familiarity with this Domain',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_info',
                                 'display_order': 10,
                                 'options_config': [   {   'label': 'Complete Beginner',
                                                           'value': 'Complete Beginner'},
                                                       {   'label': 'Intermediate / Academic '
                                                                    'Projects',
                                                           'value': 'Intermediate / Academic '
                                                                    'Projects'},
                                                       {   'label': 'Advanced / Built Production '
                                                                    'Apps',
                                                           'value': 'Advanced / Built Production '
                                                                    'Apps'}]},
                             {   'id': 'ws_f11',
                                 'field_key': 'technical_interests',
                                 'field_type': 'multi_select',
                                 'label': 'Key Technical Interests',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_ws_extra',
                                 'display_order': 11,
                                 'options_config': [   {   'label': 'Microservices & Serverless',
                                                           'value': 'Microservices & Serverless'},
                                                       {   'label': 'Docker & Kubernetes',
                                                           'value': 'Docker & Kubernetes'},
                                                       {   'label': 'PyTorch & Computer Vision',
                                                           'value': 'PyTorch & Computer Vision'},
                                                       {   'label': 'Prompt Engineering & RAG',
                                                           'value': 'Prompt Engineering & RAG'},
                                                       {   'label': 'System Design & DevOps',
                                                           'value': 'System Design & DevOps'}]},
                             {   'id': 'ws_f12',
                                 'field_key': 'workshop_expectations',
                                 'field_type': 'textarea',
                                 'label': 'What do you hope to learn from this workshop?',
                                 'placeholder': 'Mention specific tools or questions you would '
                                                'like the speaker to address...',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_ws_extra',
                                 'display_order': 12},
                             {   'id': 'ws_f13',
                                 'field_key': 'rules_agreement',
                                 'field_type': 'checkbox',
                                 'label': 'I agree to bring my laptop with required dependencies '
                                          'installed and attend all scheduled sessions punctually.',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_ws_confirm',
                                 'display_order': 13}]},
    {   'id': 'tpl_hackathon_competition',
        'name': 'Hackathon / Technical Competition',
        'category': 'Competition',
        'purpose': 'Hackathons, 24-hr coding sprints, project expos, and national competitions.',
        'description': '5-section structure with team leader info, repeatable team members, '
                       'project domain, tech stack, abstract PDF, and rules acknowledgment.',
        'is_starter': 1,
        'default_title': 'CCE Annual 24-Hour National Hackathon',
        'default_subtitle': 'Build Autonomous & Intelligent Solutions for Real-World Problems',
        'default_mode': 'Hybrid',
        'form_layout_mode': 'multi_step',
        'sections_config': [   {   'id': 'sec_hk_team',
                                   'title': 'Section 1: Team Leader & Registration',
                                   'description': 'Team identity and team lead details.',
                                   'order': 1},
                               {   'id': 'sec_hk_members',
                                   'title': 'Section 2: Team Members',
                                   'description': 'Add 1 to 4 teammates to your hackathon squad.',
                                   'order': 2},
                               {   'id': 'sec_hk_project',
                                   'title': 'Section 3: Project Proposal & Tech Stack',
                                   'description': 'Idea submission, domain, and architecture '
                                                  'overview.',
                                   'order': 3},
                               {   'id': 'sec_hk_docs',
                                   'title': 'Section 4: Supporting Documents & Links',
                                   'description': 'Upload presentation deck, architecture '
                                                  'abstract, or repository.',
                                   'order': 4},
                               {   'id': 'sec_hk_confirm',
                                   'title': 'Section 5: Declaration & Code of Conduct',
                                   'description': 'Agree to contest integrity guidelines.',
                                   'order': 5}],
        'fields_config': [   {   'id': 'hk_f1',
                                 'field_key': 'team_name',
                                 'field_type': 'text',
                                 'label': 'Team Name',
                                 'placeholder': 'e.g. ByteForce',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_team',
                                 'display_order': 1},
                             {   'id': 'hk_f2',
                                 'field_key': 'team_leader_name',
                                 'field_type': 'text',
                                 'label': 'Team Leader Full Name',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_team',
                                 'display_order': 2},
                             {   'id': 'hk_f3',
                                 'field_key': 'team_leader_roll',
                                 'field_type': 'text',
                                 'label': 'Team Leader Register Number',
                                 'placeholder': 'e.g. SEC22CO024',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_team',
                                 'display_order': 3},
                             {   'id': 'hk_f4',
                                 'field_key': 'team_leader_email',
                                 'field_type': 'email',
                                 'label': 'Team Leader College Email',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_team',
                                 'display_order': 4},
                             {   'id': 'hk_f5',
                                 'field_key': 'team_leader_phone',
                                 'field_type': 'phone',
                                 'label': 'Team Leader Contact Number',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_team',
                                 'display_order': 5},
                             {   'id': 'hk_f6',
                                 'field_key': 'participation_category',
                                 'field_type': 'dropdown',
                                 'label': 'Competition Track / Category',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_team',
                                 'display_order': 6,
                                 'options_config': [   {   'label': 'Track A: Smart Healthcare & '
                                                                    'Biomedical AI',
                                                           'value': 'Track A: Smart Healthcare & '
                                                                    'Biomedical AI'},
                                                       {   'label': 'Track B: Fintech & Secure '
                                                                    'Decentralized Apps',
                                                           'value': 'Track B: Fintech & Secure '
                                                                    'Decentralized Apps'},
                                                       {   'label': 'Track C: Sustainable Campus & '
                                                                    'Green Energy',
                                                           'value': 'Track C: Sustainable Campus & '
                                                                    'Green Energy'},
                                                       {   'label': 'Track D: Open Innovation & '
                                                                    'Autonomous Agents',
                                                           'value': 'Track D: Open Innovation & '
                                                                    'Autonomous Agents'}]},
                             {   'id': 'hk_f7',
                                 'field_key': 'team_members',
                                 'field_type': 'repeatable_group',
                                 'label': 'Additional Team Members (Exclude Leader)',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_hk_members',
                                 'display_order': 7,
                                 'repeatable_config': {   'min_items': 1,
                                                          'max_items': 3,
                                                          'add_button_text': '+ Add Teammate',
                                                          'fields': [   {   'id': 'hk_f7_sub1',
                                                                            'field_key': 'member_name',
                                                                            'field_type': 'text',
                                                                            'label': 'Teammate '
                                                                                     'Full Name',
                                                                            'required': True,
                                                                            'enabled': True,
                                                                            'display_order': 1},
                                                                        {   'id': 'hk_f7_sub2',
                                                                            'field_key': 'member_roll',
                                                                            'field_type': 'text',
                                                                            'label': 'Register '
                                                                                     'Number',
                                                                            'required': True,
                                                                            'enabled': True,
                                                                            'display_order': 2},
                                                                        {   'id': 'hk_f7_sub3',
                                                                            'field_key': 'member_email',
                                                                            'field_type': 'email',
                                                                            'label': 'College '
                                                                                     'Email '
                                                                                     'Address',
                                                                            'required': True,
                                                                            'enabled': True,
                                                                            'display_order': 3},
                                                                        {   'id': 'hk_f7_sub4',
                                                                            'field_key': 'member_department',
                                                                            'field_type': 'dropdown',
                                                                            'label': 'Department',
                                                                            'required': True,
                                                                            'enabled': True,
                                                                            'display_order': 4,
                                                                            'options_config': [   {   'label': 'CCE',
                                                                                                      'value': 'CCE'},
                                                                                                  {   'label': 'CSE',
                                                                                                      'value': 'CSE'},
                                                                                                  {   'label': 'IT',
                                                                                                      'value': 'IT'},
                                                                                                  {   'label': 'AI-DS',
                                                                                                      'value': 'AI-DS'},
                                                                                                  {   'label': 'ECE',
                                                                                                      'value': 'ECE'}]},
                                                                        {   'id': 'hk_f7_sub5',
                                                                            'field_key': 'member_role',
                                                                            'field_type': 'dropdown',
                                                                            'label': 'Primary Role '
                                                                                     'in Team',
                                                                            'required': True,
                                                                            'enabled': True,
                                                                            'display_order': 5,
                                                                            'options_config': [   {   'label': 'Frontend '
                                                                                                               'Developer',
                                                                                                      'value': 'Frontend '
                                                                                                               'Developer'},
                                                                                                  {   'label': 'Backend '
                                                                                                               '/ '
                                                                                                               'Cloud '
                                                                                                               'Engineer',
                                                                                                      'value': 'Backend '
                                                                                                               '/ '
                                                                                                               'Cloud '
                                                                                                               'Engineer'},
                                                                                                  {   'label': 'AI/ML '
                                                                                                               'Engineer',
                                                                                                      'value': 'AI/ML '
                                                                                                               'Engineer'},
                                                                                                  {   'label': 'UI/UX '
                                                                                                               'Designer',
                                                                                                      'value': 'UI/UX '
                                                                                                               'Designer'},
                                                                                                  {   'label': 'Hardware/IoT',
                                                                                                      'value': 'Hardware/IoT'}]}],
                                                          'entity_name': 'Teammate'}},
                             {   'id': 'hk_f8',
                                 'field_key': 'project_title',
                                 'field_type': 'text',
                                 'label': 'Proposed Project Title',
                                 'placeholder': 'e.g. MediPredict AI: Real-Time Diagnostic Triage',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_project',
                                 'display_order': 8},
                             {   'id': 'hk_f9',
                                 'field_key': 'problem_statement',
                                 'field_type': 'textarea',
                                 'label': 'Problem Statement',
                                 'placeholder': 'What core friction or challenge are you '
                                                'addressing?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_project',
                                 'display_order': 9},
                             {   'id': 'hk_f10',
                                 'field_key': 'solution_description',
                                 'field_type': 'textarea',
                                 'label': 'Solution Description & Architecture',
                                 'placeholder': 'Briefly describe your solution, architecture, and '
                                                'innovative approach...',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_project',
                                 'display_order': 10},
                             {   'id': 'hk_f11',
                                 'field_key': 'tech_stack',
                                 'field_type': 'text',
                                 'label': 'Planned Tech Stack',
                                 'placeholder': 'e.g. Next.js, Cloudflare Workers, FastEmbed, '
                                                'SQLite, Python',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_project',
                                 'display_order': 11},
                             {   'id': 'hk_f12',
                                 'field_key': 'project_abstract_pdf',
                                 'field_type': 'pdf_upload',
                                 'label': 'Project Abstract or Slide Deck (PDF)',
                                 'description': 'Upload a 1 to 3 page overview of your solution '
                                                'concept.',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_hk_docs',
                                 'display_order': 12,
                                 'validation_config': {   'allowed_types': ['pdf'],
                                                          'max_size_mb': 15}},
                             {   'id': 'hk_f13',
                                 'field_key': 'github_repo_url',
                                 'field_type': 'url',
                                 'label': 'GitHub Repository URL (Optional)',
                                 'placeholder': 'https://github.com/...',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_hk_docs',
                                 'display_order': 13},
                             {   'id': 'hk_f14',
                                 'field_key': 'originality_declaration',
                                 'field_type': 'checkbox',
                                 'label': 'We certify that all code written during the competition '
                                          'will be original and developed within the hackathon '
                                          'timeframe.',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_hk_confirm',
                                 'display_order': 14}]},
    {   'id': 'tpl_exam_attendance_feedback',
        'name': 'Exam Attendance & Feedback',
        'category': 'Exam',
        'purpose': 'Pre-exam hall ticket upload, venue logging, post-exam attendance verification '
                   'with geo-tagged photo, and ratings.',
        'description': "2-section form with conditional branching on attendance ('Yes' unlocks "
                       "geo-photo & 5-question rating feedback; 'No' requests absence reason).",
        'is_starter': 1,
        'default_title': 'Autonomous Semester Examination Attendance & Course Feedback',
        'default_subtitle': 'Pre-Exam Verification & Post-Exam Review',
        'default_mode': 'Offline',
        'form_layout_mode': 'multi_step',
        'sections_config': [   {   'id': 'sec_exam_before',
                                   'title': 'Section 1: Before the Exam (Pre-Exam Check)',
                                   'description': 'Course selection, examination centre details, '
                                                  'and hall ticket upload.',
                                   'order': 1},
                               {   'id': 'sec_exam_after',
                                   'title': 'Section 2: After the Exam (Attendance & Feedback)',
                                   'description': 'Verify your attendance at the centre and share '
                                                  'course difficulty ratings.',
                                   'order': 2}],
        'fields_config': [   {   'id': 'ex_f1',
                                 'field_key': 'exam_name',
                                 'field_type': 'text',
                                 'label': 'Exam Title / Course Code',
                                 'placeholder': 'e.g. CS3401 - Algorithms and Data Structures',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_before',
                                 'display_order': 1},
                             {   'id': 'ex_f2',
                                 'field_key': 'exam_centre',
                                 'field_type': 'dropdown',
                                 'label': 'Assigned Exam Centre / Hall',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_before',
                                 'display_order': 2,
                                 'options_config': [   {   'label': 'Alpha Block - Hall 101',
                                                           'value': 'Alpha Block - Hall 101'},
                                                       {   'label': 'Beta Block - Hall 204',
                                                           'value': 'Beta Block - Hall 204'},
                                                       {   'label': 'Gamma Block - Cloud Lab 1',
                                                           'value': 'Gamma Block - Cloud Lab 1'},
                                                       {   'label': 'Main Auditorium Ground Floor',
                                                           'value': 'Main Auditorium Ground '
                                                                    'Floor'}]},
                             {   'id': 'ex_f3',
                                 'field_key': 'exam_date',
                                 'field_type': 'date',
                                 'label': 'Scheduled Exam Date',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_before',
                                 'display_order': 3},
                             {   'id': 'ex_f4',
                                 'field_key': 'hall_ticket_upload',
                                 'field_type': 'pdf_upload',
                                 'label': 'Hall Ticket / Admit Card Copy (PDF/Image)',
                                 'description': 'Upload official admit card signed by institution.',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_before',
                                 'display_order': 4,
                                 'validation_config': {   'allowed_types': ['pdf'],
                                                          'max_size_mb': 15}},
                             {   'id': 'ex_f5',
                                 'field_key': 'did_attend_exam',
                                 'field_type': 'radio',
                                 'label': 'Did you attend and complete the exam?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 5,
                                 'options_config': [   {   'label': 'Yes, I attended the exam in '
                                                                    'person',
                                                           'value': 'Yes, I attended the exam in '
                                                                    'person'},
                                                       {   'label': 'No, I was absent',
                                                           'value': 'No, I was absent'}]},
                             {   'id': 'ex_f6',
                                 'field_key': 'centre_geo_photo',
                                 'field_type': 'geo_photo',
                                 'label': 'Geo-Tagged Photograph at the Exam Centre',
                                 'description': 'Capture an on-site photo. Your device GPS '
                                                'location will be automatically verified.',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 6,
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'Yes',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f7',
                                 'field_key': 'exam_rating',
                                 'field_type': 'star_rating',
                                 'label': 'Overall, how was the examination experience?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 7,
                                 'rating_config': {   'min_label': 'Very Poor',
                                                      'max_label': 'Excellent',
                                                      'max_rating': 5},
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'Yes',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f8',
                                 'field_key': 'question_difficulty',
                                 'field_type': 'dropdown',
                                 'label': 'How difficult were the questions?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 8,
                                 'options_config': [   {'label': 'Very Easy', 'value': 'Very Easy'},
                                                       {   'label': 'Moderate / Balanced',
                                                           'value': 'Moderate / Balanced'},
                                                       {   'label': 'Challenging',
                                                           'value': 'Challenging'},
                                                       {   'label': 'Extremely Difficult',
                                                           'value': 'Extremely Difficult'}],
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'Yes',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f9',
                                 'field_key': 'syllabus_alignment',
                                 'field_type': 'dropdown',
                                 'label': 'Were the questions aligned with the prescribed course '
                                          'syllabus?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 9,
                                 'options_config': [   {   'label': '100% In-Syllabus',
                                                           'value': '100% In-Syllabus'},
                                                       {   'label': 'Mostly In-Syllabus (>80%)',
                                                           'value': 'Mostly In-Syllabus (>80%)'},
                                                       {   'label': 'Partially Out of Syllabus',
                                                           'value': 'Partially Out of Syllabus'},
                                                       {   'label': 'Significantly Mismatched',
                                                           'value': 'Significantly Mismatched'}],
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'Yes',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f10',
                                 'field_key': 'centre_arrangements',
                                 'field_type': 'dropdown',
                                 'label': 'Arrangements and facilities at the exam centre:',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 10,
                                 'options_config': [   {   'label': 'Excellent (Lighting, Air, '
                                                                    'Seating)',
                                                           'value': 'Excellent (Lighting, Air, '
                                                                    'Seating)'},
                                                       {   'label': 'Good / Adequate',
                                                           'value': 'Good / Adequate'},
                                                       {   'label': 'Needs Improvement',
                                                           'value': 'Needs Improvement'}],
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'Yes',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f11',
                                 'field_key': 'time_sufficiency',
                                 'field_type': 'dropdown',
                                 'label': 'Was the allocated time sufficient to finish the paper?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 11,
                                 'options_config': [   {   'label': 'Yes, ample time remaining',
                                                           'value': 'Yes, ample time remaining'},
                                                       {   'label': 'Just enough time',
                                                           'value': 'Just enough time'},
                                                       {   'label': 'No, felt rushed',
                                                           'value': 'No, felt rushed'}],
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'Yes',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f12',
                                 'field_key': 'additional_exam_feedback',
                                 'field_type': 'textarea',
                                 'label': 'Anything else you would like to share regarding this '
                                          'exam? (Optional)',
                                 'placeholder': 'Feedback regarding specific questions or hall '
                                                'environment...',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 12,
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'Yes',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f13',
                                 'field_key': 'absence_reason_category',
                                 'field_type': 'dropdown',
                                 'label': 'Primary Reason for Absence',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 13,
                                 'options_config': [   {   'label': 'Medical / Health Issue',
                                                           'value': 'Medical / Health Issue'},
                                                       {   'label': 'Severe Travel Disruption',
                                                           'value': 'Severe Travel Disruption'},
                                                       {   'label': 'Clash with Another '
                                                                    'Examination',
                                                           'value': 'Clash with Another '
                                                                    'Examination'},
                                                       {   'label': 'Personal / Family Emergency',
                                                           'value': 'Personal / Family Emergency'},
                                                       {'label': 'Other', 'value': 'Other'}],
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'No',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f14',
                                 'field_key': 'absence_explanation',
                                 'field_type': 'textarea',
                                 'label': 'Please provide details regarding your absence:',
                                 'placeholder': 'Explain the circumstances and any supporting '
                                                'medical certificate references...',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 14,
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'No',
                                                       'action': 'show'}]},
                             {   'id': 'ex_f15',
                                 'field_key': 'absence_proof',
                                 'field_type': 'file',
                                 'label': 'Upload Supporting Medical / Approval Certificate',
                                 'description': 'Attach official medical certificate or '
                                                'pre-approved leave letter.',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_exam_after',
                                 'display_order': 15,
                                 'conditions': [   {   'field': 'did_attend_exam',
                                                       'operator': 'contains',
                                                       'value': 'No',
                                                       'action': 'show'}]}]},
    {   'id': 'tpl_internship_opportunity',
        'name': 'Internship & Placement Registration',
        'category': 'Internship',
        'purpose': 'Internship applications, on-campus placement drives, research assistantships, '
                   'and corporate opportunities.',
        'description': '5-section workflow covering student profile, opportunity specifications, '
                       'portfolio links, resume PDF upload, and placement cell declaration.',
        'is_starter': 1,
        'default_title': 'Department Internship & Industry Placement Drive',
        'default_subtitle': 'Application Portal for Corporate Internships & Research Fellowships',
        'default_mode': 'Hybrid',
        'form_layout_mode': 'multi_step',
        'sections_config': [   {   'id': 'sec_in_student',
                                   'title': 'Section 1: Candidate Information',
                                   'description': 'Contact info, current semester, and academic '
                                                  'standing.',
                                   'order': 1},
                               {   'id': 'sec_in_opp',
                                   'title': 'Section 2: Opportunity & Company Selection',
                                   'description': 'Select role preference, mode, and availability '
                                                  'window.',
                                   'order': 2},
                               {   'id': 'sec_in_skills',
                                   'title': 'Section 3: Skills, Experience & Profiles',
                                   'description': 'Share your portfolio, LinkedIn, and GitHub '
                                                  'links.',
                                   'order': 3},
                               {   'id': 'sec_in_docs',
                                   'title': 'Section 4: Resume & Supporting Documents',
                                   'description': 'Upload verified resume PDF and recent '
                                                  'certificates.',
                                   'order': 4},
                               {   'id': 'sec_in_confirm',
                                   'title': 'Section 5: Candidate Declaration',
                                   'description': 'Placement cell rules and attendance terms.',
                                   'order': 5}],
        'fields_config': [   {   'id': 'in_f1',
                                 'field_key': 'candidate_name',
                                 'field_type': 'text',
                                 'label': 'Full Name (as per College Records)',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_student',
                                 'display_order': 1},
                             {   'id': 'in_f2',
                                 'field_key': 'register_number',
                                 'field_type': 'text',
                                 'label': 'Register Number',
                                 'placeholder': 'e.g. SEC22CO045',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_student',
                                 'display_order': 2},
                             {   'id': 'in_f3',
                                 'field_key': 'college_email',
                                 'field_type': 'email',
                                 'label': 'Official College Email',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_student',
                                 'display_order': 3},
                             {   'id': 'in_f4',
                                 'field_key': 'current_cgpa',
                                 'field_type': 'number',
                                 'label': 'Current CGPA (Out of 10.0)',
                                 'placeholder': 'e.g. 8.75',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_student',
                                 'display_order': 4,
                                 'validation_config': {'min_val': 0, 'max_val': 10}},
                             {   'id': 'in_f5',
                                 'field_key': 'standing_arrears',
                                 'field_type': 'radio',
                                 'label': 'Do you have any active standing arrears?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_student',
                                 'display_order': 5,
                                 'options_config': [   {   'label': '0 (Zero Arrears)',
                                                           'value': '0 (Zero Arrears)'},
                                                       {'label': '1 Arrear', 'value': '1 Arrear'},
                                                       {   'label': '2 or More Arrears',
                                                           'value': '2 or More Arrears'}]},
                             {   'id': 'in_f6',
                                 'field_key': 'target_company',
                                 'field_type': 'text',
                                 'label': 'Company / Organisation Name',
                                 'placeholder': 'e.g. Zoho, Freshworks, Google Cloud Partner',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_opp',
                                 'display_order': 6},
                             {   'id': 'in_f7',
                                 'field_key': 'opportunity_type',
                                 'field_type': 'radio',
                                 'label': 'Opportunity Category',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_opp',
                                 'display_order': 7,
                                 'options_config': [   {   'label': 'Summer Internship (6–8 weeks)',
                                                           'value': 'Summer Internship (6–8 '
                                                                    'weeks)'},
                                                       {   'label': 'Semester Internship (6 '
                                                                    'months)',
                                                           'value': 'Semester Internship (6 '
                                                                    'months)'},
                                                       {   'label': 'Full-Time Placement',
                                                           'value': 'Full-Time Placement'},
                                                       {   'label': 'Research Fellowship',
                                                           'value': 'Research Fellowship'}]},
                             {   'id': 'in_f8',
                                 'field_key': 'work_mode',
                                 'field_type': 'radio',
                                 'label': 'Working Mode',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_opp',
                                 'display_order': 8,
                                 'options_config': [   {'label': 'On-Site', 'value': 'On-Site'},
                                                       {   'label': 'Remote / Work From Home',
                                                           'value': 'Remote / Work From Home'},
                                                       {'label': 'Hybrid', 'value': 'Hybrid'}]},
                             {   'id': 'in_f9',
                                 'field_key': 'internship_duration',
                                 'field_type': 'dropdown',
                                 'label': 'Duration',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_opp',
                                 'display_order': 9,
                                 'options_config': [   {'label': '1 Month', 'value': '1 Month'},
                                                       {'label': '2 Months', 'value': '2 Months'},
                                                       {'label': '3 Months', 'value': '3 Months'},
                                                       {'label': '6 Months', 'value': '6 Months'}]},
                             {   'id': 'in_f10',
                                 'field_key': 'start_date',
                                 'field_type': 'date',
                                 'label': 'Earliest Possible Start Date',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_opp',
                                 'display_order': 10},
                             {   'id': 'in_f11',
                                 'field_key': 'core_competencies',
                                 'field_type': 'multi_select',
                                 'label': 'Core Competencies & Technologies',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_skills',
                                 'display_order': 11,
                                 'options_config': [   {   'label': 'Python / Django / FastAPI',
                                                           'value': 'Python / Django / FastAPI'},
                                                       {   'label': 'TypeScript / React / Next.js',
                                                           'value': 'TypeScript / React / Next.js'},
                                                       {   'label': 'Cloud Infrastructure '
                                                                    '(AWS/GCP/Cloudflare)',
                                                           'value': 'Cloud Infrastructure '
                                                                    '(AWS/GCP/Cloudflare)'},
                                                       {   'label': 'Data Engineering & SQL',
                                                           'value': 'Data Engineering & SQL'},
                                                       {   'label': 'Mobile Apps (React '
                                                                    'Native/Flutter)',
                                                           'value': 'Mobile Apps (React '
                                                                    'Native/Flutter)'},
                                                       {   'label': 'Embedded C / IoT',
                                                           'value': 'Embedded C / IoT'}]},
                             {   'id': 'in_f12',
                                 'field_key': 'portfolio_url',
                                 'field_type': 'url',
                                 'label': 'Personal Portfolio URL',
                                 'placeholder': 'https://yourportfolio.dev',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_in_skills',
                                 'display_order': 12},
                             {   'id': 'in_f13',
                                 'field_key': 'linkedin_url',
                                 'field_type': 'url',
                                 'label': 'LinkedIn Profile URL',
                                 'placeholder': 'https://linkedin.com/in/...',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_skills',
                                 'display_order': 13},
                             {   'id': 'in_f14',
                                 'field_key': 'github_url',
                                 'field_type': 'url',
                                 'label': 'GitHub Profile URL',
                                 'placeholder': 'https://github.com/...',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_skills',
                                 'display_order': 14},
                             {   'id': 'in_f15',
                                 'field_key': 'resume_pdf',
                                 'field_type': 'pdf_upload',
                                 'label': 'Updated Professional Resume (PDF)',
                                 'description': 'Single-page or two-page PDF format only (Max 10 '
                                                'MB).',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_docs',
                                 'display_order': 15,
                                 'validation_config': {   'allowed_types': ['pdf'],
                                                          'max_size_mb': 10}},
                             {   'id': 'in_f16',
                                 'field_key': 'supporting_certificates',
                                 'field_type': 'file',
                                 'label': 'Key Achievement or NPTEL Certificates (Optional)',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_in_docs',
                                 'display_order': 16},
                             {   'id': 'in_f17',
                                 'field_key': 'placement_declaration',
                                 'field_type': 'checkbox',
                                 'label': 'I agree that once an offer is extended, I will honor '
                                          'the placement guidelines and obtain proper NOC approval '
                                          'from the department.',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_in_confirm',
                                 'display_order': 17}]},
    {   'id': 'tpl_general_survey_feedback',
        'name': 'General Survey & Feedback',
        'category': 'Feedback',
        'purpose': 'Department surveys, end-of-semester feedback, facility audits, and student '
                   'sentiment polling.',
        'description': '5-section template with student details, diverse question formats, 1-5 '
                       'star ratings, satisfaction scales, and optional document evidence.',
        'is_starter': 1,
        'default_title': 'CCE Department Academic & Infrastructure Survey',
        'default_subtitle': 'Student Voice & Continuous Improvement Feedback',
        'default_mode': 'Online',
        'form_layout_mode': 'single_page',
        'sections_config': [   {   'id': 'sec_sv_basic',
                                   'title': 'Section 1: Basic Information',
                                   'description': 'Anonymous or identified department profile '
                                                  'details.',
                                   'order': 1},
                               {   'id': 'sec_sv_questions',
                                   'title': 'Section 2: Survey Questions',
                                   'description': 'Curriculum, teaching methodology, and campus '
                                                  'resources.',
                                   'order': 2},
                               {   'id': 'sec_sv_ratings',
                                   'title': 'Section 3: Department Ratings',
                                   'description': 'Rate various academic and laboratory facilities '
                                                  'on rating scales.',
                                   'order': 3},
                               {   'id': 'sec_sv_supporting',
                                   'title': 'Section 4: Supporting Notes & Evidence',
                                   'description': 'Optional photos, screenshots, or detailed '
                                                  'suggestions.',
                                   'order': 4},
                               {   'id': 'sec_sv_submit',
                                   'title': 'Section 5: Submission & Acknowledgment',
                                   'description': 'Finalize and submit your feedback responses.',
                                   'order': 5}],
        'fields_config': [   {   'id': 'sv_f1',
                                 'field_key': 'batch_year',
                                 'field_type': 'dropdown',
                                 'label': 'Your Current Year of Study',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_sv_basic',
                                 'display_order': 1,
                                 'options_config': [   {'label': 'I Year', 'value': 'I Year'},
                                                       {'label': 'II Year', 'value': 'II Year'},
                                                       {'label': 'III Year', 'value': 'III Year'},
                                                       {'label': 'IV Year', 'value': 'IV Year'}]},
                             {   'id': 'sv_f2',
                                 'field_key': 'section',
                                 'field_type': 'radio',
                                 'label': 'Section',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_sv_basic',
                                 'display_order': 2,
                                 'options_config': [   {'label': 'Section A', 'value': 'Section A'},
                                                       {'label': 'Section B', 'value': 'Section B'},
                                                       {   'label': 'Section C',
                                                           'value': 'Section C'}]},
                             {   'id': 'sv_f3',
                                 'field_key': 'curriculum_relevance',
                                 'field_type': 'dropdown',
                                 'label': 'How relevant is the current curriculum to industry '
                                          'requirements?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_sv_questions',
                                 'display_order': 3,
                                 'options_config': [   {   'label': 'Extremely Relevant',
                                                           'value': 'Extremely Relevant'},
                                                       {   'label': 'Relevant with Minor Gaps',
                                                           'value': 'Relevant with Minor Gaps'},
                                                       {   'label': 'Moderately Outdated',
                                                           'value': 'Moderately Outdated'},
                                                       {   'label': 'Needs Complete Overhaul',
                                                           'value': 'Needs Complete Overhaul'}]},
                             {   'id': 'sv_f4',
                                 'field_key': 'practical_lab_exposure',
                                 'field_type': 'radio',
                                 'label': 'Are lab sessions offering sufficient hands-on '
                                          'experimentation?',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_sv_questions',
                                 'display_order': 4,
                                 'options_config': [   {   'label': 'Yes, very comprehensive',
                                                           'value': 'Yes, very comprehensive'},
                                                       {   'label': 'Adequate, but more projects '
                                                                    'needed',
                                                           'value': 'Adequate, but more projects '
                                                                    'needed'},
                                                       {   'label': 'No, mostly theoretical',
                                                           'value': 'No, mostly theoretical'}]},
                             {   'id': 'sv_f5',
                                 'field_key': 'preferred_learning_resources',
                                 'field_type': 'multi_select',
                                 'label': 'Which learning formats do you find most impactful?',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_sv_questions',
                                 'display_order': 5,
                                 'options_config': [   {   'label': 'In-class whiteboarding',
                                                           'value': 'In-class whiteboarding'},
                                                       {   'label': 'Live coding walkthroughs',
                                                           'value': 'Live coding walkthroughs'},
                                                       {   'label': 'Recorded video archives',
                                                           'value': 'Recorded video archives'},
                                                       {   'label': 'Hands-on cloud labs',
                                                           'value': 'Hands-on cloud labs'},
                                                       {   'label': 'Industry guest workshops',
                                                           'value': 'Industry guest workshops'}]},
                             {   'id': 'sv_f6',
                                 'field_key': 'suggested_course_topics',
                                 'field_type': 'textarea',
                                 'label': 'Which specific tools or technologies should be '
                                          'integrated next semester?',
                                 'placeholder': 'e.g. Rust programming, Edge Computing, '
                                                'Kubernetes, Large Multimodal Models...',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_sv_questions',
                                 'display_order': 6},
                             {   'id': 'sv_f7',
                                 'field_key': 'overall_academic_rating',
                                 'field_type': 'star_rating',
                                 'label': 'Overall Academic & Faculty Mentorship Rating',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_sv_ratings',
                                 'display_order': 7,
                                 'rating_config': {   'min_label': 'Poor',
                                                      'max_label': 'Outstanding',
                                                      'max_rating': 5}},
                             {   'id': 'sv_f8',
                                 'field_key': 'lab_infrastructure_satisfaction',
                                 'field_type': 'satisfaction_rating',
                                 'label': 'Computing Lab & Internet Infrastructure Satisfaction',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_sv_ratings',
                                 'display_order': 8},
                             {   'id': 'sv_f9',
                                 'field_key': 'course_difficulty_scale',
                                 'field_type': 'numeric_rating',
                                 'label': "Average Difficulty of this Semester's Courses (0 = "
                                          'Trivial, 10 = Very Challenging)',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_sv_ratings',
                                 'display_order': 9},
                             {   'id': 'sv_f10',
                                 'field_key': 'feedback_image',
                                 'field_type': 'image_upload',
                                 'label': 'Optional Screenshot or Supporting Photo',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_sv_supporting',
                                 'display_order': 10,
                                 'validation_config': {   'allowed_types': [   'jpg',
                                                                               'jpeg',
                                                                               'png',
                                                                               'webp'],
                                                          'max_size_mb': 10}},
                             {   'id': 'sv_f11',
                                 'field_key': 'final_suggestions',
                                 'field_type': 'textarea',
                                 'label': 'Any other constructive suggestions for department '
                                          'leadership:',
                                 'placeholder': 'Share any thoughts or observations...',
                                 'required': False,
                                 'enabled': True,
                                 'section_id': 'sec_sv_supporting',
                                 'display_order': 11},
                             {   'id': 'sv_f12',
                                 'field_key': 'accuracy_confirmation',
                                 'field_type': 'checkbox',
                                 'label': 'I confirm that the feedback provided above is genuine '
                                          'and constructive.',
                                 'required': True,
                                 'enabled': True,
                                 'section_id': 'sec_sv_submit',
                                 'display_order': 12}]}]


class TemplatesDAL:
    def __init__(self, db: Any):
        self.db = db

    async def list_templates(self, category: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Lists the 5 canonical starter templates plus any saved custom templates from D1.
        Authoritative starter definitions always come from STARTER_TEMPLATES so stale seeded rows never shadow upgrades.
        """
        starter_ids = {st["id"] for st in STARTER_TEMPLATES}
        merged: List[Dict[str, Any]] = []

        for st in STARTER_TEMPLATES:
            if category and category != "all" and st["category"].lower() != category.lower():
                continue
            if search:
                s_lower = search.lower()
                hay = f"{st['name']} {st.get('description', '')} {st.get('purpose', '')}".lower()
                if s_lower not in hay:
                    continue
            merged.append(copy.deepcopy(st))

        try:
            if self.db:
                sql = "SELECT * FROM event_templates WHERE is_starter = 0"
                params = []
                if category and category != "all":
                    sql += " AND category = ?"
                    params.append(category)
                if search:
                    sql += " AND (name LIKE ? OR description LIKE ? OR purpose LIKE ?)"
                    pat = f"%{search.strip()}%"
                    params.extend([pat, pat, pat])
                sql += " ORDER BY created_at DESC"

                stmt = self.db.prepare(sql)
                if params:
                    stmt = stmt.bind(*params)
                res = await stmt.all()
                custom_rows = getattr(res, "results", []) or []

                for r in custom_rows:
                    d = _normalize_template(_row_to_dict(r))
                    if d.get("id") and d["id"] not in starter_ids:
                        merged.append(d)
        except Exception as db_err:
            logger.warning("Custom templates query error (using starter templates): %s", db_err)

        return merged

    async def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        for st in STARTER_TEMPLATES:
            if st["id"] == template_id:
                return copy.deepcopy(st)

        try:
            if self.db:
                stmt = self.db.prepare("SELECT * FROM event_templates WHERE id = ?").bind(template_id)
                row = await stmt.first()
                if not row:
                    return None
                return _normalize_template(_row_to_dict(row))
        except Exception as ex:
            logger.warning("Database template lookup error: %s", ex)
        return None

    async def create_custom_template(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        tpl_id = f"custom_tpl_{uuid.uuid4().hex[:12]}"
        name = str(data.get("name", "")).strip()
        if not name:
            raise ValueError("Template name is required.")

        category = str(data.get("category", "Workshop")).strip()
        description = data.get("description", "")
        purpose = data.get("purpose", "")
        now = _utc_now_iso()

        sections_cfg = data.get("sections_config", [])
        sections_str = json.dumps(sections_cfg) if isinstance(sections_cfg, list) else None

        raw_fields = data.get("fields_config", [])
        norm_fields = [
            _normalize_template_field(rf, idx, f"{tpl_id}_f")
            for idx, rf in enumerate(raw_fields, start=1)
        ] if isinstance(raw_fields, list) else []
        fields_str = json.dumps(norm_fields)

        await self.db.prepare(
            """INSERT INTO event_templates (
                id, name, category, description, purpose, is_starter,
                sections_config, fields_config, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)"""
        ).bind(
            tpl_id, name, category, description, purpose,
            sections_str, fields_str, user_id, now, now
        ).run()

        return await self.get_template(tpl_id)

    async def delete_custom_template(self, template_id: str) -> Dict[str, Any]:
        for st in STARTER_TEMPLATES:
            if st["id"] == template_id:
                raise ValueError("Protected starter templates cannot be deleted.")

        await self.db.prepare("DELETE FROM event_templates WHERE id = ? AND is_starter = 0").bind(template_id).run()
        return {"message": "Custom template deleted successfully."}
