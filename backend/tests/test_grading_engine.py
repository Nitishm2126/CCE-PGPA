import pytest
from app.services.grading_engine import (
    calculate_component_grade,
    calculate_overall_pgpa,
    grade_skillrack,
    grade_amcat,
    grade_internship,
    grade_sairam_sap,
    grade_sail,
    grade_nptel,
    grade_gate,
    GRADE_POINTS_MAP,
)


def test_grade_points_map():
    assert GRADE_POINTS_MAP["O"] == 10
    assert GRADE_POINTS_MAP["A+"] == 9
    assert GRADE_POINTS_MAP["A"] == 7
    assert GRADE_POINTS_MAP["B+"] == 5
    assert GRADE_POINTS_MAP["B"] == 3
    assert GRADE_POINTS_MAP["C"] == 1


def test_skillrack_thresholds():
    # Sem 1 thresholds: O > 500, A+ > 400, A > 300, B+ > 200, B > 100, C <= 100
    assert grade_skillrack(550, 1) == ("O", 10)
    assert grade_skillrack(450, 1) == ("A+", 9)
    assert grade_skillrack(350, 1) == ("A", 7)
    assert grade_skillrack(250, 1) == ("B+", 5)
    assert grade_skillrack(150, 1) == ("B", 3)
    assert grade_skillrack(80, 1) == ("C", 1)

    # Sem 3 thresholds: O > 2000, A+ > 1600, A > 1200, B+ > 800, B > 400, C <= 400
    assert grade_skillrack(2500, 3) == ("O", 10)
    assert grade_skillrack(1800, 3) == ("A+", 9)
    assert grade_skillrack(350, 3) == ("C", 1)


def test_amcat_grading():
    assert grade_amcat(9.5) == ("O", 10)
    assert grade_amcat(8.0) == ("A+", 9)
    assert grade_amcat(5.5) == ("A", 7)
    assert grade_amcat(2.5) == ("B+", 5)
    assert grade_amcat(1.2) == ("B", 3)
    assert grade_amcat(0.5) == ("C", 1)


def test_internship_grading():
    assert grade_internship("Core / with stipend") == ("A+", 9)
    assert grade_internship("Core / with stipend", performance_grade="O") == ("O", 10)
    assert grade_internship("Others") == ("A", 7)


def test_nptel_grading():
    assert grade_nptel("Topper") == ("O", 10)
    assert grade_nptel("Gold") == ("A+", 9)
    assert grade_nptel("Silver") == ("A", 7)
    assert grade_nptel("Elite") == ("B+", 5)
    assert grade_nptel("Successfully Completed") == ("B", 3)
    assert grade_nptel("Attended") == ("C", 1)


def test_gate_grading():
    assert grade_gate("Percentile (>90)") == ("O", 10)
    assert grade_gate("Score (>400)") == ("A+", 9)
    assert grade_gate("Qualified") == ("A", 7)
    assert grade_gate("Not Qualified") == ("B+", 5)
    assert grade_gate("Attended") == ("B", 3)
    assert grade_gate("Registration") == ("C", 1)


def test_overall_pgpa_formula():
    # Formula:
    # A1 = Σ(Grade obtained * Credit) / Σ(Credits Attempted)
    # PGPA = (A1 * 0.6) + (GPA * 0.4)
    #
    # Component 1: Skillrack (3 credits, O -> 10 pts) = 30
    # Component 2: NPTEL (4 credits, A+ -> 9 pts) = 36
    # Total credit points = 66
    # Total credits attempted = 7
    # A1 = 66 / 7 = 9.4286
    # GPA = 8.5
    # PGPA = (9.4286 * 0.6) + (8.5 * 0.4) = 5.65714 + 3.4 = 9.06
    components = [
        {"component_slug": "skillrack", "grade": "O", "grade_points": 10, "credit_value": 3, "is_verified": True},
        {"component_slug": "nptel-non-credit-transfer", "grade": "A+", "grade_points": 9, "credit_value": 4, "is_verified": True},
    ]
    res = calculate_overall_pgpa(components, semester_gpa=8.5)
    assert round(res["a1_score"], 2) == 9.43
    assert res["pgpa"] == 9.06
    assert res["total_credits_attempted"] == 7
