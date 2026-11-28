import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

DEFAULT_PGPA_COMPONENT_CONFIGS: Dict[str, Dict[str, Any]] = {
    "skillrack": {
        "unit": "Problems / Pts",
        "default_min_points": 0.0,
        "default_max_points": 64000.0,
        "scale_label": "0.0 - 64,000.0 Problems / Score",
        "guideline": "Table 1.1 thresholds per semester (Sem 1: 500, Sem 2: 1000, ..., Sem 8: 64000)",
        "semesters": {
            1: {"max_points": 500.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 500.0, "A+": 400.0, "A": 300.0, "B+": 200.0, "B": 100.0}, "guideline": "Sem 1: target 500 problems"},
            2: {"max_points": 1000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 1000.0, "A+": 800.0, "A": 600.0, "B+": 400.0, "B": 200.0}, "guideline": "Sem 2: cumulative 1,000 problems"},
            3: {"max_points": 2000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 2000.0, "A+": 1600.0, "A": 1200.0, "B+": 800.0, "B": 400.0}, "guideline": "Sem 3: cumulative 2,000 problems"},
            4: {"max_points": 4000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 4000.0, "A+": 3200.0, "A": 2400.0, "B+": 1600.0, "B": 800.0}, "guideline": "Sem 4: cumulative 4,000 problems"},
            5: {"max_points": 8000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 8000.0, "A+": 6400.0, "A": 4800.0, "B+": 3200.0, "B": 1600.0}, "guideline": "Sem 5: cumulative 8,000 problems"},
            6: {"max_points": 16000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 16000.0, "A+": 12800.0, "A": 9600.0, "B+": 6400.0, "B": 3200.0}, "guideline": "Sem 6: cumulative 16,000 problems"},
            7: {"max_points": 32000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 32000.0, "A+": 25600.0, "A": 19200.0, "B+": 12800.0, "B": 6400.0}, "guideline": "Sem 7: cumulative 32,000 problems"},
            8: {"max_points": 64000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 64000.0, "A+": 51200.0, "A": 38400.0, "B+": 25600.0, "B": 12800.0}, "guideline": "Sem 8: cumulative 64,000 problems"},
        },
    },
    "academics-gpa": {
        "unit": "GPA",
        "default_min_points": 0.0,
        "default_max_points": 10.0,
        "scale_label": "0.00 - 10.00 GPA",
        "guideline": "Anna University Semester GPA scale (0.00 - 10.00)",
        "semesters": {
            s: {"max_points": 10.0, "min_points": 0.0, "is_enabled": True, "credit_value": 0, "thresholds": {"O": 9.0, "A+": 7.0, "A": 4.0, "B+": 2.0, "B": 1.0}, "guideline": f"Semester {s} GPA evaluation"}
            for s in range(1, 9)
        },
    },
    "amcat": {
        "unit": "Score / %ile",
        "default_min_points": 0.0,
        "default_max_points": 100.0,
        "scale_label": "0.0 - 100.0 Score / Percentile",
        "guideline": "Table 2.1 score ranges or Table B scale",
        "semesters": {
            s: {"max_points": 100.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 90.0, "A+": 70.0, "A": 40.0, "B+": 20.0, "B": 10.0}, "guideline": f"Semester {s} AMCAT assessment"}
            for s in range(1, 9)
        },
    },
    "clubs-and-cells": {
        "unit": "Points",
        "default_min_points": 0.0,
        "default_max_points": 6000.0,
        "scale_label": "0.0 - 6,000.0 Points",
        "guideline": "Table 7.1 point allocations (100 - 700 pts/event, cumulative up to 6,000)",
        "semesters": {
            1: {"max_points": 600.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 600.0, "A+": 500.0, "A": 400.0, "B+": 300.0, "B": 200.0}, "guideline": "Sem 1: cumulative 600 pts"},
            2: {"max_points": 1200.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 1200.0, "A+": 1000.0, "A": 800.0, "B+": 600.0, "B": 400.0}, "guideline": "Sem 2: cumulative 1,200 pts"},
            3: {"max_points": 1800.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 1800.0, "A+": 1500.0, "A": 1200.0, "B+": 900.0, "B": 600.0}, "guideline": "Sem 3: cumulative 1,800 pts"},
            4: {"max_points": 2400.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 2400.0, "A+": 2000.0, "A": 1600.0, "B+": 1200.0, "B": 800.0}, "guideline": "Sem 4: cumulative 2,400 pts"},
            5: {"max_points": 3000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 3000.0, "A+": 2500.0, "A": 2000.0, "B+": 1500.0, "B": 1000.0}, "guideline": "Sem 5: cumulative 3,000 pts"},
            6: {"max_points": 3600.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 3600.0, "A+": 3000.0, "A": 2400.0, "B+": 1800.0, "B": 1200.0}, "guideline": "Sem 6: cumulative 3,600 pts"},
            7: {"max_points": 4200.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 4200.0, "A+": 3500.0, "A": 2800.0, "B+": 2100.0, "B": 1400.0}, "guideline": "Sem 7: cumulative 4,200 pts"},
            8: {"max_points": 4800.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 4800.0, "A+": 4000.0, "A": 3200.0, "B+": 2400.0, "B": 1600.0}, "guideline": "Sem 8: cumulative 4,800 pts"},
        },
    },
    "sairam-innovation-eco-system": {
        "unit": "Grade Points",
        "default_min_points": 0.0,
        "default_max_points": 10.0,
        "scale_label": "0.0 - 10.0 Grade Points",
        "guideline": "Table 5.1 & Table B grade points (Overall Winner=10, SDG Winner=9, Top 15=7, Participant=3)",
        "semesters": {
            s: {"max_points": 10.0, "min_points": 0.0, "is_enabled": True, "credit_value": 4, "thresholds": {"O": 10.0, "A+": 9.0, "A": 7.0, "B+": 5.0, "B": 3.0}, "guideline": f"Semester {s} Innovation Project / Proposal"}
            for s in range(1, 9)
        },
    },
    "nptel-non-credit-transfer": {
        "unit": "Marks / GP",
        "default_min_points": 0.0,
        "default_max_points": 100.0,
        "scale_label": "0.0 - 100.0 Marks or 0.0 - 10.0 Grade Points",
        "guideline": "Table 10.1 marks (Topper 90+=10, Gold 75+=9, Silver 60+=7, Elite 50+=5, Pass=3)",
        "semesters": {
            s: {"max_points": 100.0, "min_points": 0.0, "is_enabled": True, "credit_value": 4, "thresholds": {"O": 90.0, "A+": 75.0, "A": 60.0, "B+": 50.0, "B": 40.0}, "guideline": f"Semester {s} NPTEL / SWAYAM Certification"}
            for s in range(1, 9)
        },
    },
    "sail": {
        "unit": "SAIL Points",
        "default_min_points": 0.0,
        "default_max_points": 560.0,
        "scale_label": "0.0 - 560.0 SAIL Points",
        "guideline": "Table 6.2 cumulative semester thresholds (Sem 1: 70, ..., Sem 8: 560)",
        "semesters": {
            1: {"max_points": 70.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 70.0, "A+": 60.0, "A": 50.0, "B+": 45.0, "B": 40.0}, "guideline": "Sem 1: 70 SAIL points"},
            2: {"max_points": 140.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 140.0, "A+": 120.0, "A": 100.0, "B+": 90.0, "B": 80.0}, "guideline": "Sem 2: 140 SAIL points"},
            3: {"max_points": 210.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 210.0, "A+": 180.0, "A": 150.0, "B+": 135.0, "B": 120.0}, "guideline": "Sem 3: 210 SAIL points"},
            4: {"max_points": 280.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 280.0, "A+": 240.0, "A": 200.0, "B+": 180.0, "B": 160.0}, "guideline": "Sem 4: 280 SAIL points"},
            5: {"max_points": 350.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 350.0, "A+": 300.0, "A": 250.0, "B+": 225.0, "B": 200.0}, "guideline": "Sem 5: 350 SAIL points"},
            6: {"max_points": 420.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 420.0, "A+": 360.0, "A": 300.0, "B+": 270.0, "B": 240.0}, "guideline": "Sem 6: 420 SAIL points"},
            7: {"max_points": 490.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 490.0, "A+": 420.0, "A": 350.0, "B+": 315.0, "B": 280.0}, "guideline": "Sem 7: 490 SAIL points"},
            8: {"max_points": 560.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 560.0, "A+": 480.0, "A": 400.0, "B+": 360.0, "B": 320.0}, "guideline": "Sem 8: 560 SAIL points"},
        },
    },
    "online-certifications": {
        "unit": "Marks / GP",
        "default_min_points": 0.0,
        "default_max_points": 100.0,
        "scale_label": "0.0 - 100.0 Marks or 0.0 - 10.0 Grade Points",
        "guideline": "Table B grade points or marks (Coursera, edX, Spoken Tutorial)",
        "semesters": {
            s: {"max_points": 100.0, "min_points": 0.0, "is_enabled": True, "credit_value": 2, "thresholds": {"O": 90.0, "A+": 75.0, "A": 60.0, "B+": 50.0, "B": 40.0}, "guideline": f"Semester {s} Online Certifications"}
            for s in range(1, 9)
        },
    },
    "fit-india-certifications": {
        "unit": "Fitness Score",
        "default_min_points": 0.0,
        "default_max_points": 100.0,
        "scale_label": "0.0 - 100.0 Fitness Score",
        "guideline": "Table 13.1 fitness challenge score (100=O, 75=A+, 50=A, 30=B+)",
        "semesters": {
            s: {"max_points": 100.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 100.0, "A+": 75.0, "A": 50.0, "B+": 30.0, "B": 10.0}, "guideline": f"Semester {s} FIT INDIA"}
            for s in range(1, 9)
        },
    },
    "internship": {
        "unit": "Grade Points",
        "default_min_points": 0.0,
        "default_max_points": 10.0,
        "scale_label": "0.0 - 10.0 Grade Points",
        "guideline": "Table 3.3 grade points (Core/Stipend min A+=9/O=10, Others upto A=7)",
        "semesters": {
            s: {"max_points": 10.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 10.0, "A+": 9.0, "A": 7.0, "B+": 5.0, "B": 3.0}, "guideline": f"Semester {s} Industrial Internship"}
            for s in range(1, 9)
        },
    },
    "sairam-sdg-action-programme": {
        "unit": "SAP Points",
        "default_min_points": 0.0,
        "default_max_points": 100.0,
        "scale_label": "0.0 - 100.0 SAP Points",
        "guideline": "Table 4.2 SAP points (75+=O, 60+=A+, 45+=A, 30+=B+, 11+=B)",
        "semesters": {
            s: {"max_points": 100.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 75.0, "A+": 60.0, "A": 45.0, "B+": 30.0, "B": 11.0}, "guideline": f"Semester {s} SDG Action Project"}
            for s in range(1, 9)
        },
    },
    "sports-and-games": {
        "unit": "Points",
        "default_min_points": 0.0,
        "default_max_points": 1000.0,
        "scale_label": "0.0 - 1,000.0 Points",
        "guideline": "Table 8.1 medal matrix points (5 - 115 pts/event, cumulative up to 700+ for O)",
        "semesters": {
            s: {"max_points": 1000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 700.0, "A+": 401.0, "A": 250.0, "B+": 91.0, "B": 21.0}, "guideline": f"Semester {s} Sports Tournament & Athletic Meet"}
            for s in range(1, 9)
        },
    },
    "scouts-for-sdgs": {
        "unit": "Hours / GP",
        "default_min_points": 0.0,
        "default_max_points": 50.0,
        "scale_label": "0.0 - 50.0 Service Hours or 0.0 - 10.0 Grade Points",
        "guideline": "Table 12.1 service hours (20+ hrs = O) or grade points",
        "semesters": {
            s: {"max_points": 50.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": {"O": 20.0, "A+": 15.0, "A": 10.0, "B+": 5.0, "B": 2.0}, "guideline": f"Semester {s} Scouts for SDGs Community Service"}
            for s in range(1, 9)
        },
    },
    "gate": {
        "unit": "Score",
        "default_min_points": 0.0,
        "default_max_points": 1000.0,
        "scale_label": "0.0 - 1,000.0 GATE Score",
        "guideline": "Table 9.1 GATE marks / score (Qualify=O:10, min score=A+:9)",
        "semesters": {
            s: {"max_points": 1000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 4, "thresholds": {"O": 600.0, "A+": 400.0, "A": 100.0, "B+": 50.0, "B": 25.0}, "guideline": f"Semester {s} GATE Exam / Mock Test"}
            for s in range(1, 9)
        },
    },
}

GENERIC_DEFAULT_CONFIG = {
    "unit": "Points",
    "default_min_points": 0.0,
    "default_max_points": 1000.0,
    "scale_label": "0.0 - 1,000.0 Points",
    "guideline": "Official Component Guidelines",
    "semesters": {
        s: {"max_points": 1000.0, "min_points": 0.0, "is_enabled": True, "credit_value": 3, "thresholds": None, "guideline": f"Semester {s} Evaluation"}
        for s in range(1, 9)
    },
}


def build_component_point_settings(component: Dict[str, Any]) -> Dict[str, Any]:
    slug = component.get("slug", "")
    default_cfg = DEFAULT_PGPA_COMPONENT_CONFIGS.get(slug, GENERIC_DEFAULT_CONFIG)

    raw_schema = component.get("config_schema")
    schema_dict = {}
    if isinstance(raw_schema, str) and raw_schema.strip():
        try:
            schema_dict = json.loads(raw_schema)
        except Exception:
            schema_dict = {}
    elif isinstance(raw_schema, dict):
        schema_dict = raw_schema

    saved_cfg = schema_dict.get("point_config", {})

    unit = saved_cfg.get("unit") or default_cfg["unit"]
    default_min = float(saved_cfg.get("default_min_points", default_cfg["default_min_points"]))
    default_max = float(saved_cfg.get("default_max_points", default_cfg["default_max_points"]))
    scale_label = saved_cfg.get("scale_label") or default_cfg["scale_label"]
    guideline = saved_cfg.get("guideline") or default_cfg["guideline"]

    saved_semesters = saved_cfg.get("semesters", {})
    default_semesters = default_cfg["semesters"]

    semesters_list: List[Dict[str, Any]] = []
    for s_num in range(1, 9):
        s_key = str(s_num)
        s_saved = saved_semesters.get(s_key, {})
        s_default = default_semesters.get(s_num, default_semesters.get(8, {}))

        min_pts = float(s_saved.get("min_points", s_default.get("min_points", default_min)))
        max_pts = float(s_saved.get("max_points", s_default.get("max_points", default_max)))
        is_en = bool(s_saved.get("is_enabled", s_default.get("is_enabled", True)))
        credits = int(s_saved.get("credit_value", s_default.get("credit_value", component.get("credit_value", 3))))
        s_label = s_saved.get("scale_label") or f"{min_pts:g} - {max_pts:g} {unit}"
        s_guide = s_saved.get("guideline") or s_default.get("guideline") or guideline
        thresholds = s_saved.get("grade_thresholds", s_default.get("thresholds"))
        rules_desc = s_saved.get("rules_description", s_default.get("rules_description"))

        semesters_list.append({
            "semester_number": s_num,
            "is_enabled": is_en,
            "min_points": min_pts,
            "max_points": max_pts,
            "credit_value": credits,
            "scale_label": s_label,
            "guideline": s_guide,
            "grade_thresholds": thresholds,
            "rules_description": rules_desc,
        })

    return {
        "component_id": component["id"],
        "component_name": component["name"],
        "component_slug": component["slug"],
        "credit_value": component.get("credit_value", 3),
        "unit": unit,
        "default_min_points": default_min,
        "default_max_points": default_max,
        "scale_label": scale_label,
        "guideline": guideline,
        "semesters": semesters_list,
        "updated_at": saved_cfg.get("updated_at") or component.get("updated_at"),
        "updated_by_name": saved_cfg.get("updated_by_name"),
    }
