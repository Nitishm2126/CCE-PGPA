import csv
import tempfile
from pathlib import Path
import pytest
from pydantic import ValidationError

from app.cli.prepare_students_roster import (
    EXPECTED_MENTORS,
    EXPECTED_MENTOR_COUNTS,
    EXPECTED_STUDENT_COUNT,
    ExtractedStudent,
    export_students_csv,
    parse_and_validate_student_records,
)

SAMPLE_EXCEL_PATH = Path.home() / "Downloads" / "CCE_II_Year_A_Students.xlsx"


def test_extracted_student_validation():
    """
    Validates model constraints on individual student records.
    """
    valid = ExtractedStudent(
        register_number="SEC25CO001",
        full_name="Student Test",
        email="student@sairamtap.edu.in",
        section="A",
        mentor_reference="PACHHAIAMMAL PRIYA M",
    )
    assert valid.register_number == "SEC25CO001"
    assert valid.email == "student@sairamtap.edu.in"

    # Invalid email
    with pytest.raises(ValidationError):
        ExtractedStudent(
            register_number="SEC25CO001",
            full_name="Student Test",
            email="not-an-email",
            section="A",
            mentor_reference="PACHHAIAMMAL PRIYA M",
        )


def test_read_nonexistent_excel_file():
    """
    Verifies that passing a missing Excel file path raises FileNotFoundError.
    """
    with pytest.raises(FileNotFoundError):
        parse_and_validate_student_records(Path("nonexistent_path/fake.xlsx"))


@pytest.mark.skipif(not SAMPLE_EXCEL_PATH.is_file(), reason="Official Excel roster not in user Downloads")
def test_parse_and_validate_student_records_from_excel():
    """
    Verifies extraction from the official CCE_II_Year_A_Students.xlsx:
    - Exactly 61 students
    - Zero duplicates in register numbers and emails
    - Exact 3 mentors with counts 25, 25, 11
    """
    records = parse_and_validate_student_records(SAMPLE_EXCEL_PATH)
    assert len(records) == EXPECTED_STUDENT_COUNT

    reg_nos = [r["register_number"] for r in records]
    emails = [r["email"] for r in records]
    assert len(set(reg_nos)) == EXPECTED_STUDENT_COUNT
    assert len(set(emails)) == EXPECTED_STUDENT_COUNT

    mentors = set(r["mentor_reference"] for r in records)
    assert mentors == EXPECTED_MENTORS

    counts = {m: sum(1 for r in records if r["mentor_reference"] == m) for m in EXPECTED_MENTORS}
    assert counts == EXPECTED_MENTOR_COUNTS


def test_export_students_csv_safety_and_overwrite():
    """
    Verifies that export_students_csv creates directories safely,
    raises FileExistsError if target already exists without overwrite=True,
    and overwrites only when overwrite=True.
    """
    records = [
        {
            "register_number": "SEC25CO001",
            "full_name": "Student One",
            "email": "student1@sairamtap.edu.in",
            "section": "A",
            "mentor_reference": "PACHHAIAMMAL PRIYA M",
        }
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        target_path = Path(tmpdir) / "subfolder" / "students_roster.csv"

        # First export creates directory and file
        out = export_students_csv(records, target_path, overwrite=False)
        assert out.is_file()

        # Second export without overwrite must raise FileExistsError
        with pytest.raises(FileExistsError):
            export_students_csv(records, target_path, overwrite=False)

        # Third export with overwrite=True succeeds
        out2 = export_students_csv(records, target_path, overwrite=True)
        assert out2.is_file()

        # Verify content
        with open(target_path, mode="r", encoding="utf-8") as f:
            reader = list(csv.DictReader(f))
        assert len(reader) == 1
        assert reader[0]["register_number"] == "SEC25CO001"
