"""
Centralized Server-Side Grading Engine for CCE Achieve PGPA.
Implements official rules, tables, thresholds, and calculations from the
17-page PGPA Evaluation Guidelines PDF.
"""
from typing import Any, Dict, List, Optional, Tuple


# ==============================================================================
# Table B : Official Grade to Grade-Point Mapping
# ==============================================================================
GRADE_POINTS_MAP: Dict[str, int] = {
    "O": 10,
    "A+": 9,
    "A": 7,
    "B+": 5,
    "B": 3,
    "C": 1,
}

# Standard 10-point scale range to Grade (Table B)
def score_to_grade_table_b(score: float) -> Tuple[str, int]:
    """Map a score in [0.0, 10.0] according to Table B."""
    if score >= 9.0:
        return "O", 10
    elif score >= 7.0:
        return "A+", 9
    elif score >= 4.0:
        return "A", 7
    elif score >= 2.0:
        return "B+", 5
    elif score >= 1.0:
        return "B", 3
    else:
        return "C", 1


# ==============================================================================
# Component-Specific Grading Rules
# ==============================================================================

# 1. Skillrack: Table 1.1 thresholds per semester
SKILLRACK_THRESHOLDS: Dict[int, Dict[str, int]] = {
    1: {"O": 500, "A+": 400, "A": 300, "B+": 200, "B": 100},
    2: {"O": 1000, "A+": 800, "A": 600, "B+": 400, "B": 200},
    3: {"O": 2000, "A+": 1600, "A": 1200, "B+": 800, "B": 400},
    4: {"O": 4000, "A+": 3200, "A": 2400, "B+": 1600, "B": 800},
    5: {"O": 8000, "A+": 6400, "A": 4800, "B+": 3200, "B": 1600},
    6: {"O": 16000, "A+": 12800, "A": 9600, "B+": 6400, "B": 3200},
    7: {"O": 32000, "A+": 25600, "A": 19200, "B+": 12800, "B": 6400},
    8: {"O": 64000, "A+": 51200, "A": 38400, "B+": 25600, "B": 12800},
    9: {"O": 64000, "A+": 51200, "A": 38400, "B+": 25600, "B": 12800},
    10: {"O": 64000, "A+": 51200, "A": 38400, "B+": 25600, "B": 12800},
}

def grade_skillrack(points: float, semester: int) -> Tuple[str, int]:
    thresholds = SKILLRACK_THRESHOLDS.get(semester, SKILLRACK_THRESHOLDS[8])
    if points > thresholds["O"]:
        return "O", 10
    elif points > thresholds["A+"]:
        return "A+", 9
    elif points > thresholds["A"]:
        return "A", 7
    elif points > thresholds["B+"]:
        return "B+", 5
    elif points > thresholds["B"]:
        return "B", 3
    else:
        return "C", 1


# 2. AMCAT: Table 2.1 score ranges
def grade_amcat(score: float) -> Tuple[str, int]:
    # Accepts 0-10 scale or converts percentage if > 10
    norm_score = score / 10.0 if score > 10.0 else score
    if norm_score >= 9.0:
        return "O", 10
    elif norm_score >= 7.0:
        return "A+", 9
    elif norm_score >= 4.0:
        return "A", 7
    elif norm_score >= 2.0:
        return "B+", 5
    elif norm_score >= 1.0:
        return "B", 3
    else:
        return "C", 1


# 3. Internship: Table 3.3
def grade_internship(company_type: str, performance_grade: Optional[str] = None) -> Tuple[str, int]:
    ct = company_type.strip().lower()
    if "core" in ct or "stipend" in ct:
        # Min A+ (i.e. 'O' or 'A+')
        if performance_grade and performance_grade.upper() == "O":
            return "O", 10
        return "A+", 9
    else:
        # Others: Upto A (e.g. A, B+, B, C)
        if performance_grade:
            pg = performance_grade.upper()
            if pg in ["O", "A+"]:
                return "A", 7
            elif pg in GRADE_POINTS_MAP:
                return pg, GRADE_POINTS_MAP[pg]
        return "A", 7


# 4. Sairam SDG Action Programme (SAP): Table 4.2
def grade_sairam_sap(points: float) -> Tuple[str, int]:
    if points >= 75:
        return "O", 10
    elif points >= 60:
        return "A+", 9
    elif points >= 45:
        return "A", 7
    elif points >= 30:
        return "B+", 5
    elif points >= 11:
        return "B", 3
    else:
        return "C", 1


# 5. Sairam Innovation Eco-System: Table 5.1
INNOVATION_CATEGORY_MAP: Dict[str, str] = {
    "overall winners 3 teams": "O",
    "overall winners": "O",
    "sdg wise winners 51 teams": "A+",
    "sdg wise winners": "A+",
    "12 teams eliminated out of top 15": "A",
    "round 2 finalist": "A",
    "10 teams eliminated out of top 25": "B+",
    "round 1 finalist": "B+",
    "participants who will submit the proposal in time": "B",
    "proposal submitted in time": "B",
    "participants who will submit the proposal after the due date": "C",
    "proposal submitted after due date": "C",
}

def grade_innovation_eco_system(category: str) -> Tuple[str, int]:
    cat = category.strip().lower()
    for key, grade in INNOVATION_CATEGORY_MAP.items():
        if key in cat or cat in key:
            return grade, GRADE_POINTS_MAP[grade]
    return "B", 3  # default fallback for participant


# 6. SAIL: Table 6.2 thresholds per semester (2026 Batch)
SAIL_THRESHOLDS: Dict[int, Dict[str, int]] = {
    1: {"O": 70, "A+": 60, "A": 50, "B+": 45, "B": 40},
    2: {"O": 140, "A+": 120, "A": 100, "B+": 90, "B": 80},
    3: {"O": 210, "A+": 180, "A": 150, "B+": 135, "B": 120},
    4: {"O": 280, "A+": 240, "A": 200, "B+": 180, "B": 160},
    5: {"O": 350, "A+": 300, "A": 250, "B+": 225, "B": 200},
    6: {"O": 420, "A+": 360, "A": 300, "B+": 270, "B": 240},
    7: {"O": 490, "A+": 420, "A": 350, "B+": 315, "B": 280},
    8: {"O": 560, "A+": 480, "A": 400, "B+": 360, "B": 320},
}

def grade_sail(points: float, semester: int) -> Tuple[str, int]:
    thresholds = SAIL_THRESHOLDS.get(semester, SAIL_THRESHOLDS[8])
    if points >= thresholds["O"]:
        return "O", 10
    elif points >= thresholds["A+"]:
        return "A+", 9
    elif points >= thresholds["A"]:
        return "A", 7
    elif points >= thresholds["B+"]:
        return "B+", 5
    elif points >= thresholds["B"]:
        return "B", 3
    else:
        return "C", 1


# 7. Clubs & Cells: Table 7.1 Point Allocation Table & Table 7.2 Cumulative Thresholds
TABLE_7_1_POINTS: Dict[str, Any] = {
    "member": 100,
    "magic": 200,
    "event coordinator": 200,
    "volunteer": 100,
    "event participation": {
        "within college": 100,
        "within state (other college)": 200,
        "national level (other state)": 300,
        "international level (in college / others)": 400,
        "international level (other country)": 500,
    },
    "winner": {
        "within college": 200,
        "within state (other college)": 300,
        "national level (other state)": 500,
        "international level (in college / others)": 600,
        "international level (other country)": 700,
    },
}

def calculate_clubs_and_cells_points(role_category: str, event_level: Optional[str] = None) -> int:
    """
    Computes exact point allocation for Clubs & Cells from Table 7.1:
    - Member: 100 points
    - Event Participation: Within College 100, Within State 200, National 300, International (In College) 400, International (Other Country) 500
    - Winner: Within College 200, Within State 300, National 500, International (In College) 600, International (Other Country) 700
    - MAGIC: 200 points
    - Event Coordinator: 200 points
    - Volunteer: 100 points
    """
    cat = (role_category or "").strip().lower()
    lvl = (event_level or "").strip().lower()

    if "magic" in cat:
        return 200
    if "coordinator" in cat:
        return 200
    if "volunteer" in cat:
        return 100
    if "member" in cat and "participation" not in cat and "winner" not in cat:
        return 100

    if "winner" in cat:
        winner_map = TABLE_7_1_POINTS["winner"]
        for k, pts in winner_map.items():
            if k in lvl or (lvl and lvl in k):
                return pts
        for k, pts in winner_map.items():
            if k in cat:
                return pts
        return 200  # Default within college winner

    if "participation" in cat or "participant" in cat or "event" in cat:
        part_map = TABLE_7_1_POINTS["event participation"]
        for k, pts in part_map.items():
            if k in lvl or (lvl and lvl in k):
                return pts
        for k, pts in part_map.items():
            if k in cat:
                return pts
        return 100  # Default within college participation

    return 100

CLUBS_CUMULATIVE_THRESHOLDS: Dict[int, Dict[str, int]] = {
    1:  {"O": 600,  "A+": 500, "A": 400, "B+": 300, "B": 200, "C": 100},
    2:  {"O": 1200, "A+": 1000,"A": 800, "B+": 600, "B": 400, "C": 200},
    3:  {"O": 1800, "A+": 1500,"A": 1200,"B+": 900, "B": 600, "C": 300},
    4:  {"O": 2400, "A+": 2000,"A": 1600,"B+": 1200,"B": 800, "C": 400},
    5:  {"O": 3000, "A+": 2500,"A": 2000,"B+": 1500,"B": 1000,"C": 500},
    6:  {"O": 3600, "A+": 3000,"A": 2400,"B+": 1800,"B": 1200,"C": 600},
    7:  {"O": 4200, "A+": 3500,"A": 2800,"B+": 2100,"B": 1400,"C": 700},
    8:  {"O": 4800, "A+": 4000,"A": 3200,"B+": 2400,"B": 1600,"C": 800},
    9:  {"O": 5400, "A+": 4500,"A": 3600,"B+": 2700,"B": 1800,"C": 900},
    10: {"O": 6000, "A+": 5000,"A": 4000,"B+": 3000,"B": 2000,"C": 1000},
}

def grade_clubs_and_cells(points: float, semester: int) -> Tuple[str, int]:
    """Table 7.2 Cumulative Clubs & Cells grade thresholds."""
    safe_sem = max(1, min(10, semester)) if semester > 0 else 1
    thresholds = CLUBS_CUMULATIVE_THRESHOLDS.get(safe_sem, CLUBS_CUMULATIVE_THRESHOLDS[8])
    if points >= thresholds["O"]:
        return "O", 10
    elif points >= thresholds["A+"]:
        return "A+", 9
    elif points >= thresholds["A"]:
        return "A", 7
    elif points >= thresholds["B+"]:
        return "B+", 5
    elif points >= thresholds["B"]:
        return "B", 3
    else:
        return "C", 1


# 8. Sports & Games: Table 8.1 Medal × Competition Level Point Matrix & Table 8.2 Grade Thresholds
SPORTS_POINTS_TABLE: Dict[str, Dict[str, int]] = {
    "gold":         {"sports_day": 20, "au_zonal_district": 65, "au_intl_state": 100, "national_south_univ": 115},
    "silver":       {"sports_day": 15, "au_zonal_district": 50, "au_intl_state": 80,  "national_south_univ": 95},
    "bronze":       {"sports_day": 10, "au_zonal_district": 35, "au_intl_state": 40,  "national_south_univ": 60},
    "participation":{"sports_day": 5,  "au_zonal_district": 25, "au_intl_state": 30,  "national_south_univ": 30},
}
# All India column (225 total) – medal breakdown NOT available in official document.
# Keep as HOD-configurable; return 0 with a flag.
ALL_INDIA_PENDING_HOD = True

def calculate_sports_points(position: Optional[str], competition_level: Optional[str]) -> Tuple[int, bool]:
    """
    Calculate sports points from Table 8.1.
    Returns (points, criteria_pending) where criteria_pending=True means HOD must confirm.
    """
    pos = (position or "").strip().lower()
    level = (competition_level or "").strip().lower()

    if not pos or not level:
        return 0, True

    if "all india" in level:
        return 0, True  # Pending HOD confirmation

    level_key = None
    if "sports day" in level or "intra" in level:
        level_key = "sports_day"
    elif "zonal" in level or "district" in level:
        level_key = "au_zonal_district"
    elif "state" in level or "international" in level:
        level_key = "au_intl_state"
    elif "national" in level or "south university" in level:
        level_key = "national_south_univ"

    pos_key = None
    if "gold" in pos or "first" in pos or "1st" in pos:
        pos_key = "gold"
    elif "silver" in pos or "second" in pos or "2nd" in pos:
        pos_key = "silver"
    elif "bronze" in pos or "third" in pos or "3rd" in pos:
        pos_key = "bronze"
    elif "participat" in pos:
        pos_key = "participation"

    if level_key and pos_key:
        return SPORTS_POINTS_TABLE[pos_key][level_key], False

    return 0, True  # Unknown mapping – pending HOD

def grade_sports_and_games(points: float, is_international_or_record: bool = False) -> Tuple[str, int]:
    """Table 8.2 Sports Grade thresholds (exact from official document)."""
    if is_international_or_record:
        return "O", 10
    if points > 699:
        return "O", 10
    elif points >= 401:
        return "A+", 9
    elif points >= 250:
        return "A", 7
    elif points >= 91:
        return "B+", 5
    elif points >= 21:
        return "B", 3
    else:
        return "C", 1


# 9. Online Certifications (IITB Spoken Tutorials)
ONLINE_CERT_MAP: Dict[str, str] = {
    "topper": "O",
    "elite with gold": "O",
    "gold": "A+",
    "silver": "A",
    "elite": "B+",
    "completed": "B",
    "pass": "B",
    "attended": "C",
}

def grade_online_certifications(category_or_score: str) -> Tuple[str, int]:
    val = category_or_score.strip().lower()
    for k, g in ONLINE_CERT_MAP.items():
        if k in val:
            return g, GRADE_POINTS_MAP[g]
    return "B", 3


# 10. NPTEL (Non-Credit Transfer): Table 10.1
NPTEL_CATEGORY_MAP: Dict[str, str] = {
    "topper": "O",
    "gold": "A+",
    "silver": "A",
    "elite": "B+",
    "successfully completed": "B",
    "completed": "B",
    "pass": "B",
    "attended": "C",
}

def grade_nptel(category: str) -> Tuple[str, int]:
    cat = category.strip().lower()
    for key, grade in NPTEL_CATEGORY_MAP.items():
        if key in cat:
            return grade, GRADE_POINTS_MAP[grade]
    return "B", 3


# 11. GATE: Table 11.1
GATE_CATEGORY_RULES: List[Tuple[str, str]] = [
    ("percentile (>90)", "O"),
    ("percentile", "O"),
    ("score (>400)", "A+"),
    ("score", "A+"),
    ("not qualified", "B+"),
    ("qualified", "A"),
    ("attended", "B"),
    ("registration", "C"),
]

def grade_gate(category_or_score: str, raw_score: Optional[float] = None) -> Tuple[str, int]:
    if raw_score is not None:
        if raw_score >= 400:
            return "A+", 9
        elif raw_score >= 100:
            return "A", 7
    cat = category_or_score.strip().lower()
    for key, grade in GATE_CATEGORY_RULES:
        if key in cat:
            return grade, GRADE_POINTS_MAP[grade]
    return "C", 1


# 12. Scouts for SDGs: Table 12.1
SCOUTS_MAP: Dict[str, str] = {
    "service": "O",
    "service (20 hrs)": "O",
    "scout online courses": "A+",
    "work on activity": "A",
    "enroll": "B",
    "enrolled": "B",
}

def grade_scouts_for_sdgs(category: str, hours: Optional[float] = None) -> Tuple[str, int]:
    if hours is not None and hours >= 20:
        return "O", 10
    cat = category.strip().lower()
    for key, grade in SCOUTS_MAP.items():
        if key in cat:
            return grade, GRADE_POINTS_MAP[grade]
    return "B", 3


# 13. FIT INDIA Certifications: Table 13.1
def grade_fit_india(score: float, category: Optional[str] = None) -> Tuple[str, int]:
    if score >= 100:
        return "O", 10
    elif score >= 75:
        return "A+", 9
    elif score >= 50:
        return "A", 7
    elif score >= 30:
        return "B+", 5
    elif category and "reg" in category.lower():
        return "B", 3
    else:
        return "B", 3


# 14. Academics (GPA)
def grade_academics(gpa: float) -> Tuple[str, int]:
    if gpa < 0.0 or gpa > 10.0:
        raise ValueError("Anna University GPA must be between 0.00 and 10.00.")
    return score_to_grade_table_b(gpa)


grade_academics_gpa = grade_academics


# ==============================================================================
# Unified Dispatcher
# ==============================================================================
def calculate_component_grade(
    component_slug: str,
    semester_number: int,
    inputs: Dict[str, Any],
    credit_value: int = 3,
) -> Dict[str, Any]:
    """
    Evaluates inputs according to component rules and returns unified grading payload:
    {
        "grade": str,
        "grade_points": int,
        "credit_value": int,
        "raw_score": Optional[float],
        "category": Optional[str],
        "explanation": str
    }
    """
    slug = component_slug.strip().lower()
    raw_score = None
    category = None
    explanation = ""

    if slug == "skillrack":
        points = float(inputs.get("points") or inputs.get("raw_score") or 0)
        grade, gp = grade_skillrack(points, semester_number)
        raw_score = points
        explanation = f"Skillrack {points:g} pts in Sem {semester_number} -> Grade {grade}"

    elif slug == "amcat":
        score = float(inputs.get("score") or inputs.get("points") or inputs.get("raw_score") or 0)
        grade, gp = grade_amcat(score)
        raw_score = score
        explanation = f"AMCAT score {score:g} -> Grade {grade}"

    elif slug == "internship":
        comp_type = str(inputs.get("company_type") or inputs.get("category") or "Others")
        perf = str(inputs.get("performance_grade") or inputs.get("grade") or "")
        grade, gp = grade_internship(comp_type, perf)
        category = comp_type
        explanation = f"Internship '{comp_type}' -> Grade {grade}"

    elif slug == "sairam-sdg-action-programme":
        points = float(inputs.get("points") or inputs.get("raw_score") or 0)
        grade, gp = grade_sairam_sap(points)
        raw_score = points
        explanation = f"Sairam SAP {points:g} pts -> Grade {grade}"

    elif slug == "sairam-innovation-eco-system":
        cat = str(inputs.get("category") or inputs.get("title") or "Proposal submitted in time")
        grade, gp = grade_innovation_eco_system(cat)
        category = cat
        explanation = f"Innovation Eco-System '{cat}' -> Grade {grade}"

    elif slug == "sail":
        points = float(inputs.get("points") or inputs.get("raw_score") or 0)
        grade, gp = grade_sail(points, semester_number)
        raw_score = points
        explanation = f"SAIL {points:g} pts in Sem {semester_number} -> Grade {grade}"

    elif slug == "clubs-and-cells":
        role_cat = str(inputs.get("role_category") or inputs.get("category") or inputs.get("activity_type") or "")
        event_lvl = str(inputs.get("event_level") or "")
        raw_pts = inputs.get("points") or inputs.get("raw_score")
        if raw_pts is not None and float(raw_pts) > 0:
            points = float(raw_pts)
        elif role_cat:
            points = float(calculate_clubs_and_cells_points(role_cat, event_lvl))
        else:
            points = 0.0

        grade, gp = grade_clubs_and_cells(points, semester_number)
        raw_score = points
        category = f"{role_cat} - {event_lvl}".strip(" -") if (role_cat or event_lvl) else "Clubs & Cells"
        explanation = f"Clubs & Cells: {category} ({points:g} pts, Sem {semester_number}) -> Grade {grade}"

    elif slug == "sports-and-games":
        position = str(inputs.get("position") or inputs.get("outcome") or "Participation")
        competition_level = str(inputs.get("competition_level") or inputs.get("event_level") or inputs.get("activity_type") or "Sports Day")
        pts, pending = calculate_sports_points(position, competition_level)
        if pending:
            raw_pts = inputs.get("points") if inputs.get("points") is not None else inputs.get("raw_score")
            if raw_pts is not None and float(raw_pts) > 0:
                pts = int(float(raw_pts))
                pending = False
            else:
                raise ValueError(f"Sports points for position='{position}', level='{competition_level}' require HOD confirmation (All India category or unknown mapping).")
        grade, gp = grade_sports_and_games(float(pts))
        raw_score = float(pts)
        category = f"{position} - {competition_level}"
        explanation = f"Sports & Games: {position} at {competition_level} = {pts} pts → Grade {grade}"

    elif slug == "online-certifications":
        cat = str(inputs.get("category") or inputs.get("outcome") or "Completed")
        grade, gp = grade_online_certifications(cat)
        category = cat
        explanation = f"Online Certifications '{cat}' -> Grade {grade}"

    elif slug == "nptel-non-credit-transfer":
        cat = str(inputs.get("category") or inputs.get("outcome") or "Successfully Completed")
        grade, gp = grade_nptel(cat)
        category = cat
        explanation = f"NPTEL category '{cat}' -> Grade {grade}"

    elif slug == "gate":
        cat = str(inputs.get("category") or inputs.get("outcome") or "Attended")
        raw_val = inputs.get("score") or inputs.get("raw_score")
        score_val = float(raw_val) if raw_val is not None else None
        grade, gp = grade_gate(cat, score_val)
        category = cat
        raw_score = score_val
        explanation = f"GATE '{cat}' -> Grade {grade}"

    elif slug == "scouts-for-sdgs":
        cat = str(inputs.get("category") or inputs.get("outcome") or "Work on activity")
        raw_hrs = inputs.get("hours")
        hrs = float(raw_hrs) if raw_hrs is not None else None
        grade, gp = grade_scouts_for_sdgs(cat, hrs)
        category = cat
        raw_score = hrs
        explanation = f"Scouts for SDGs '{cat}' -> Grade {grade}"

    elif slug == "fit-india-certifications":
        score = float(inputs.get("score") or inputs.get("points") or inputs.get("raw_score") or 0)
        cat = str(inputs.get("category") or "")
        grade, gp = grade_fit_india(score, cat)
        raw_score = score
        explanation = f"FIT INDIA score {score:g} -> Grade {grade}"

    elif slug == "academics-gpa":
        raw_gpa = inputs.get("gpa") if inputs.get("gpa") is not None else inputs.get("raw_score", 0.0)
        gpa = float(raw_gpa)
        if gpa < 0.0 or gpa > 10.0:
            raise ValueError(f"GPA {gpa:.2f} is outside the valid scale [0.0, 10.0].")
        grade, gp = grade_academics(gpa)
        raw_score = gpa
        category = "Semester GPA"
        explanation = f"Academics Semester GPA {gpa:.2f} -> Grade {grade} ({gp} GP)"

    else:
        # Fallback for staff direct entry or generic grade
        direct_grade = str(inputs.get("grade") or "B").upper()
        grade = direct_grade if direct_grade in GRADE_POINTS_MAP else "B"
        gp = GRADE_POINTS_MAP[grade]
        explanation = f"Component '{component_slug}' -> Assigned Grade {grade}"

    return {
        "grade": grade,
        "grade_points": gp,
        "credit_value": credit_value,
        "raw_score": raw_score,
        "category": category,
        "explanation": explanation,
    }


# ==============================================================================
# Overall PGPA Calculation
# ==============================================================================
def calculate_overall_pgpa(
    component_results: List[Dict[str, Any]],
    semester_gpa: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Computes overall PGPA using official guidelines:
    A1 = Σ(Grade obtained * Credit) / Σ(Credits Attempted)
    PGPA = (A1 * 0.6) + (GPA of the semester * 0.4)
    """
    total_credit_points = 0.0
    total_credits_attempted = 0
    total_credits_earned = 0
    breakdown = []

    for res in component_results:
        credit = int(res.get("credit_value") or 0)
        grade = res.get("grade", "C")
        gp = int(res.get("grade_points") or GRADE_POINTS_MAP.get(grade, 1))
        is_verified = bool(res.get("is_verified", True))

        # Academic GPA component has 0 credit in A1 calculation (it is used directly as GPA * 0.4)
        if credit > 0 and is_verified:
            earned_points = gp * credit
            total_credit_points += earned_points
            total_credits_attempted += credit
            if gp > 0:
                total_credits_earned += credit

        breakdown.append({
            "component_id": res.get("component_id"),
            "component_slug": res.get("component_slug"),
            "component_name": res.get("component_name"),
            "grade": grade,
            "grade_points": gp,
            "credit_value": credit,
            "is_verified": is_verified,
            "earned_points": gp * credit if credit > 0 else 0,
        })

    a1 = (total_credit_points / total_credits_attempted) if total_credits_attempted > 0 else 0.0
    pgpa = None
    if semester_gpa is not None:
        pgpa = round((a1 * 0.6) + (float(semester_gpa) * 0.4), 2)

    return {
        "a1_score": round(a1, 4),
        "semester_gpa": semester_gpa,
        "pgpa": pgpa,
        "total_credits_attempted": total_credits_attempted,
        "total_credits_earned": total_credits_earned,
        "breakdown": breakdown,
    }
