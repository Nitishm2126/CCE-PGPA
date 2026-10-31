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
    grade_sports_and_games,
    grade_clubs_and_cells,
    calculate_sports_points,
    SPORTS_POINTS_TABLE,
    CLUBS_CUMULATIVE_THRESHOLDS,
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


def test_sports_points_table_8_1():
    """Verify Table 8.1 medal × level point matrix."""
    # Gold
    assert calculate_sports_points("Gold", "Sports Day") == (20, False)
    assert calculate_sports_points("1st Place", "AU Zonal / District") == (65, False)
    assert calculate_sports_points("Gold", "AU International / State Level") == (100, False)
    assert calculate_sports_points("First", "National / South University Level") == (115, False)

    # Silver
    assert calculate_sports_points("Silver", "Sports Day (Intra-College)") == (15, False)
    assert calculate_sports_points("2nd Place", "AU Zonal / District Level") == (50, False)
    assert calculate_sports_points("Silver", "State Level") == (80, False)
    assert calculate_sports_points("Second", "National Level") == (95, False)

    # Bronze
    assert calculate_sports_points("Bronze", "Sports Day") == (10, False)
    assert calculate_sports_points("3rd Place", "Zonal Level") == (35, False)
    assert calculate_sports_points("Bronze", "AU International / State Level") == (40, False)
    assert calculate_sports_points("Third", "South University Level") == (60, False)

    # Participation
    assert calculate_sports_points("Participation", "Sports Day") == (5, False)
    assert calculate_sports_points("Participation", "AU Zonal / District") == (25, False)
    assert calculate_sports_points("Participation", "AU International / State Level") == (30, False)
    assert calculate_sports_points("Participation", "National / South University Level") == (30, False)

    # All India level - requires HOD confirmation
    pts, pending = calculate_sports_points("Gold", "All India Level")
    assert pending is True
    assert pts == 0


def test_sports_grading_table_8_2():
    """Verify Table 8.2 Sports Grade thresholds."""
    assert grade_sports_and_games(750) == ("O", 10)
    assert grade_sports_and_games(700) == ("O", 10)
    assert grade_sports_and_games(699) == ("A+", 9)
    assert grade_sports_and_games(401) == ("A+", 9)
    assert grade_sports_and_games(400) == ("A", 7)
    assert grade_sports_and_games(250) == ("A", 7)
    assert grade_sports_and_games(249) == ("B+", 5)
    assert grade_sports_and_games(91) == ("B+", 5)
    assert grade_sports_and_games(90) == ("B", 3)
    assert grade_sports_and_games(21) == ("B", 3)
    assert grade_sports_and_games(20) == ("C", 1)
    assert grade_sports_and_games(0) == ("C", 1)
    # International participant / record maker
    assert grade_sports_and_games(10, is_international_or_record=True) == ("O", 10)


def test_clubs_cumulative_grading_table_7_2():
    """Verify Table 7.2 Cumulative Clubs & Cells thresholds."""
    # Semester 1
    assert grade_clubs_and_cells(600, 1) == ("O", 10)
    assert grade_clubs_and_cells(500, 1) == ("A+", 9)
    assert grade_clubs_and_cells(400, 1) == ("A", 7)
    assert grade_clubs_and_cells(300, 1) == ("B+", 5)
    assert grade_clubs_and_cells(200, 1) == ("B", 3)
    assert grade_clubs_and_cells(150, 1) == ("C", 1)

    # Semester 3
    assert grade_clubs_and_cells(1800, 3) == ("O", 10)
    assert grade_clubs_and_cells(1500, 3) == ("A+", 9)
    assert grade_clubs_and_cells(1200, 3) == ("A", 7)
    assert grade_clubs_and_cells(900, 3) == ("B+", 5)
    assert grade_clubs_and_cells(600, 3) == ("B", 3)
    assert grade_clubs_and_cells(500, 3) == ("C", 1)

    # Semester 8
    assert grade_clubs_and_cells(4800, 8) == ("O", 10)
    assert grade_clubs_and_cells(4000, 8) == ("A+", 9)
    assert grade_clubs_and_cells(3200, 8) == ("A", 7)
    assert grade_clubs_and_cells(2400, 8) == ("B+", 5)
    assert grade_clubs_and_cells(1600, 8) == ("B", 3)
    assert grade_clubs_and_cells(1000, 8) == ("C", 1)


def test_sports_dispatcher_in_calculate_component_grade():
    """Verify calculate_component_grade sports-and-games evaluation."""
    res = calculate_component_grade(
        "sports-and-games",
        3,
        {"position": "Gold / 1st Place", "competition_level": "AU Zonal / District Level"}
    )
    assert res["raw_score"] == 65
    assert res["grade"] == "B"
    assert res["grade_points"] == 3

    # All India level raises ValueError unless HOD confirmation / points provided
    with pytest.raises(ValueError) as exc:
        calculate_component_grade(
            "sports-and-games",
            3,
            {"position": "Gold / 1st Place", "competition_level": "All India Level"}
        )
    assert "require HOD confirmation" in str(exc.value)


def test_sports_points_edge_cases():
    """Verify edge cases: None values, unknown mappings, All India with collision words."""
    # None inputs must return (0, True) without crashing
    assert calculate_sports_points(None, "Sports Day") == (0, True)
    assert calculate_sports_points("Gold", None) == (0, True)
    assert calculate_sports_points(None, None) == (0, True)

    # All India competition containing 'national' must still be flagged as pending
    pts, pending = calculate_sports_points("Gold", "All India Inter-University National Championship")
    assert pending is True
    assert pts == 0

    # Semester boundary clamping in clubs
    assert grade_clubs_and_cells(500, 0) == ("A+", 9)  # clamped to sem 1
    assert grade_clubs_and_cells(6000, 15) == ("O", 10)  # clamped to sem 10


