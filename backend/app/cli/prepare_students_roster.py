import argparse
import csv
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, EmailStr, ValidationError

# Add backend directory to sys.path if invoked directly
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

EXPECTED_STUDENT_COUNT = 61
EXPECTED_MENTORS = {"LURDHUMARY J", "P. LEKHA", "PACHHAIAMMAL PRIYA M"}
EXPECTED_MENTOR_COUNTS = {
    "LURDHUMARY J": 25,
    "P. LEKHA": 25,
    "PACHHAIAMMAL PRIYA M": 11,
}


class ExtractedStudent(BaseModel):
    register_number: str
    full_name: str
    email: EmailStr
    section: str
    mentor_reference: str


def read_openxml_sheet(excel_path: Path, target_sheet_name: str = "All Students") -> List[List[str]]:
    """
    Reads an OpenXML (.xlsx) file using standard library zipfile and xml.etree,
    without requiring third-party dependencies like openpyxl.
    """
    if not excel_path.is_file():
        raise FileNotFoundError(f"Excel file not found at: {excel_path}")

    with zipfile.ZipFile(excel_path, "r") as z:
        # 1. Parse shared strings if present
        shared_strings: List[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for elem in tree.iter():
                if elem.tag.endswith("}t"):
                    shared_strings.append(elem.text or "")

        # 2. Map sheet name to relationship ID in workbook.xml
        wb_tree = ET.fromstring(z.read("xl/workbook.xml"))
        r_id = None
        for sheet_elem in wb_tree.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
            if sheet_elem.attrib.get("name") == target_sheet_name:
                r_id = sheet_elem.attrib.get(
                    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                )
                break

        # 3. Locate worksheet XML path in xl/_rels/workbook.xml.rels
        sheet_path = "xl/worksheets/sheet1.xml"  # default fallback
        if r_id and "xl/_rels/workbook.xml.rels" in z.namelist():
            rels_tree = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
            for rel_elem in rels_tree.iter("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                if rel_elem.attrib.get("Id") == r_id:
                    target = rel_elem.attrib.get("Target", "")
                    sheet_path = f"xl/{target}" if not target.startswith("xl/") else target
                    break

        if sheet_path not in z.namelist():
            raise ValueError(f"Target worksheet '{target_sheet_name}' not found inside {excel_path}")

        # 4. Parse row data
        ws_tree = ET.fromstring(z.read(sheet_path))
        rows: List[List[str]] = []
        for row_elem in ws_tree.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
            row_values: List[str] = []
            for cell_elem in row_elem.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                cell_type = cell_elem.attrib.get("t")
                v_elem = cell_elem.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                val = v_elem.text if v_elem is not None else ""
                if cell_type == "s" and val.isdigit():
                    idx = int(val)
                    val = shared_strings[idx] if idx < len(shared_strings) else ""
                row_values.append(val)
            if any(row_values):
                rows.append(row_values)

    return rows


def parse_and_validate_student_records(excel_path: Path) -> List[Dict[str, str]]:
    """
    Extracts, validates, and maps all 61 student records from the Excel file:
    - S.No -> (skipped)
    - Student ID -> register_number
    - Student Name -> full_name
    - Email ID -> email
    - Section -> section
    - Mentor -> mentor_reference
    """
    raw_rows = read_openxml_sheet(excel_path, target_sheet_name="All Students")
    if not raw_rows:
        raise ValueError(f"Sheet 'All Students' in {excel_path} contains no data.")

    header = [h.strip() for h in raw_rows[0]]
    expected_header_fields = ["Student ID", "Student Name", "Email ID", "Section", "Mentor"]
    for field in expected_header_fields:
        if field not in header:
            raise ValueError(f"Missing required header '{field}' in Excel sheet. Found: {header}")

    id_idx = header.index("Student ID")
    name_idx = header.index("Student Name")
    email_idx = header.index("Email ID")
    section_idx = header.index("Section")
    mentor_idx = header.index("Mentor")

    data_rows = raw_rows[1:]
    if len(data_rows) != EXPECTED_STUDENT_COUNT:
        raise ValueError(
            f"Expected exactly {EXPECTED_STUDENT_COUNT} student rows, but found {len(data_rows)}."
        )

    errors: List[str] = []
    validated_students: List[Dict[str, str]] = []
    seen_reg_nos: set = set()
    seen_emails: set = set()

    for row_num, r in enumerate(data_rows, start=2):
        if len(r) <= max(id_idx, name_idx, email_idx, section_idx, mentor_idx):
            errors.append(f"Row {row_num}: Incomplete column count: {r}")
            continue

        reg_no = r[id_idx].strip()
        full_name = r[name_idx].strip()
        email_raw = r[email_idx].strip().lower()
        section = r[section_idx].strip()
        mentor_name = r[mentor_idx].strip()

        if not reg_no or not full_name or not email_raw or not section or not mentor_name:
            errors.append(f"Row {row_num}: Blank required field(s) in {r}")
            continue

        try:
            ExtractedStudent(
                register_number=reg_no,
                full_name=full_name,
                email=email_raw,
                section=section,
                mentor_reference=mentor_name,
            )
        except ValidationError as ve:
            errors.append(f"Row {row_num} ({reg_no}): Validation error: {ve}")
            continue

        if reg_no in seen_reg_nos:
            errors.append(f"Row {row_num}: Duplicate register_number '{reg_no}'")
        seen_reg_nos.add(reg_no)

        if email_raw in seen_emails:
            errors.append(f"Row {row_num}: Duplicate email '{email_raw}'")
        seen_emails.add(email_raw)

        if mentor_name not in EXPECTED_MENTORS:
            errors.append(
                f"Row {row_num}: Unknown mentor '{mentor_name}'. Must be one of {EXPECTED_MENTORS}"
            )

        validated_students.append({
            "register_number": reg_no,
            "full_name": full_name,
            "email": email_raw,
            "section": section,
            "mentor_reference": mentor_name,
        })

    if errors:
        raise ValueError("\n".join(errors))

    # Validate mentor breakdown
    allocation_counts = Counter(s["mentor_reference"] for s in validated_students)
    if dict(allocation_counts) != EXPECTED_MENTOR_COUNTS:
        raise ValueError(
            f"Mentor allocation mismatch: Expected {EXPECTED_MENTOR_COUNTS}, got {dict(allocation_counts)}"
        )

    return validated_students


def export_students_csv(
    students: List[Dict[str, str]],
    output_path: Path,
    overwrite: bool = False,
) -> Path:
    """
    Safely exports validated student records to a CSV file matching
    the students_roster_template.csv format.
    Raises FileExistsError if the target file already exists and overwrite is False.
    """
    if output_path.exists() and not overwrite:
        raise FileExistsError(
            f"Target file already exists: {output_path}. Use --overwrite if you intend to replace it."
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["register_number", "full_name", "email", "section", "mentor_reference"],
        )
        writer.writeheader()
        writer.writerows(students)

    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="CCE Achieve - Extract & Validate Students Roster from Excel"
    )
    default_excel_path = Path.home() / "Downloads" / "CCE_II_Year_A_Students.xlsx"
    default_csv_path = backend_dir / "data" / "import" / "students_roster.csv"

    parser.add_argument(
        "--excel-file",
        type=Path,
        default=default_excel_path,
        help=f"Path to input Excel roster file (default: {default_excel_path})",
    )
    parser.add_argument(
        "--output-file",
        type=Path,
        default=default_csv_path,
        help=f"Path to output students CSV file (default: {default_csv_path})",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite destination CSV if it already exists.",
    )

    args = parser.parse_args()

    print("==================================================================")
    print(" CCE Achieve - Excel Student Roster Validator & Extractor")
    print(f" Source Excel: {args.excel_file}")
    print(f" Target CSV:   {args.output_file}")
    print("==================================================================")

    try:
        students = parse_and_validate_student_records(args.excel_file)
        print(f"\n[OK] Successfully validated {len(students)} student records.")
    except Exception as e:
        print(f"\n[ERROR] Validation failed:\n{e}", file=sys.stderr)
        sys.exit(1)

    # Show allocation breakdown
    alloc = Counter(s["mentor_reference"] for s in students)
    print("\nMentor Allocation Breakdown:")
    for mentor, count in alloc.items():
        print(f"  - {mentor}: {count} students")

    try:
        out = export_students_csv(students, args.output_file, overwrite=args.overwrite)
        print(f"\n[SUCCESS] Generated student roster CSV: {out}")
        print("\nIMPORTANT NOTICE:")
        print("  - Field 'mentor_reference' preserves the official faculty names from Excel.")
        print("  - No fake staff emails or staff IDs were invented.")
        print("  - The final roster bootstrap import remains BLOCKED until official staff")
        print("    identifiers (email / staff_id) are provided for each of the 3 mentors.")
    except FileExistsError as fee:
        print(f"\n[WARNING] {fee}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Export failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
