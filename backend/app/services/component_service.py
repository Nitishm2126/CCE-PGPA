"""
Service layer for PGPA Component Configuration, Dynamic Form Specifications,
and HOD Excel Template Generation / Import Processing.
"""
import csv
import io
import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.component import ComponentSemesterConfig, PGPAComponent
from app.models.grading import HODImportBatch, StudentComponentResult, StudentSemesterPGPA
from app.models.semester import Semester
from app.models.user import StudentProfile, User, UserRole
from app.schemas.component_config import (
    DynamicFieldDefinition,
    HODImportPreviewResponse,
    HODImportPreviewRow,
    StudentComponentMetadata,
)
from app.services.grading_engine import (
    GRADE_POINTS_MAP,
    calculate_component_grade,
    calculate_overall_pgpa,
)


# In-memory store for pending import previews (keyed by preview_token)
PENDING_IMPORT_PREVIEWS: Dict[str, Dict[str, Any]] = {}


# ==============================================================================
# Dynamic Input Field Definitions per Component
# ==============================================================================
COMPONENT_DYNAMIC_FIELDS: Dict[str, List[DynamicFieldDefinition]] = {
    "skillrack": [
        DynamicFieldDefinition(
            name="points",
            label="Skillrack Points",
            type="number",
            required=True,
            min=0,
            placeholder="e.g. 2450",
            help_text="Enter your cumulative Skillrack points earned this semester.",
        ),
    ],
    "amcat": [
        DynamicFieldDefinition(
            name="score",
            label="AMCAT Score / Points",
            type="number",
            required=True,
            min=0.0,
            max=10.0,
            placeholder="e.g. 8.5",
            help_text="Official AMCAT score or grade point on a 10.0 scale.",
        ),
    ],
    "internship": [
        DynamicFieldDefinition(
            name="company_type",
            label="Company Classification",
            type="select",
            required=True,
            options=["Core / with stipend", "Others"],
            help_text="Core / with stipend earns Min A+; Others earns Upto A.",
        ),
        DynamicFieldDefinition(
            name="organizer",
            label="Company / Organization Name",
            type="text",
            required=True,
            placeholder="e.g. Zoho Corporation, L&T, BSNL",
        ),
        DynamicFieldDefinition(
            name="performance_grade",
            label="Evaluated Performance Grade (Optional)",
            type="select",
            required=False,
            options=["O", "A+", "A", "B+", "B"],
            help_text="If your evaluation report specifies a grade.",
        ),
    ],
    "sairam-sdg-action-programme": [
        DynamicFieldDefinition(
            name="points",
            label="SAP Points Earned",
            type="number",
            required=True,
            min=0,
            placeholder="e.g. 75",
            help_text="Points per Table 4.1: Member (10), 1 Activity (15), 2 Activities (30), 16h Drill (40), 25h Drill (75), Best Unit / RD (75).",
        ),
    ],
    "sairam-innovation-eco-system": [
        DynamicFieldDefinition(
            name="category",
            label="Innovation Category / Achievement Level",
            type="select",
            required=True,
            options=[
                "Overall Winners 3 Teams",
                "SDG wise winners 51 teams",
                "12 Teams eliminated out of top 15 (Round 2)",
                "10 Teams eliminated out of top 25 (Round 1)",
                "Participants proposal submitted in time",
                "Participants proposal submitted after due date",
            ],
            help_text="Select your verified team outcome from Table 5.1.",
        ),
    ],
    "sail": [
        DynamicFieldDefinition(
            name="points",
            label="SAIL Points",
            type="number",
            required=True,
            min=0,
            placeholder="e.g. 210",
            help_text="Total cumulative SAIL points earned in the current semester.",
        ),
    ],
    "clubs-and-cells": [
        DynamicFieldDefinition(
            name="points",
            label="Cumulative Club Points",
            type="number",
            required=True,
            min=0,
            placeholder="e.g. 1800",
            help_text="Member: 100, Event: 100-500, Winner: 200-700, Coordinator/MAGIC: 200.",
        ),
    ],
    "sports-and-games": [
        DynamicFieldDefinition(
            name="points",
            label="Sports Points",
            type="number",
            required=True,
            min=0,
            placeholder="e.g. 100",
            help_text="Points from Table 8.1 (Sports Day, Zonal, State, National).",
        ),
        DynamicFieldDefinition(
            name="is_international",
            label="International Level Participant / Record Maker",
            type="checkbox",
            required=False,
            help_text="Check if you are an International Participant or Record Maker (Automatically credited as 'O' Grade).",
        ),
    ],
    "online-certifications": [
        DynamicFieldDefinition(
            name="category",
            label="Certification Outcome / Category",
            type="select",
            required=True,
            options=["Topper", "Gold", "Silver", "Elite", "Completed", "Attended"],
            help_text="IITB Spoken Tutorials or approved institutional online certificate result.",
        ),
    ],
    "nptel-non-credit-transfer": [
        DynamicFieldDefinition(
            name="category",
            label="NPTEL Certification Category",
            type="select",
            required=True,
            options=["Topper", "Gold", "Silver", "Elite", "Successfully Completed", "Attended"],
            help_text="Select exact classification stated on your NPTEL certificate.",
        ),
    ],
    "gate": [
        DynamicFieldDefinition(
            name="category",
            label="GATE Result Category",
            type="select",
            required=True,
            options=[
                "Percentile (>90)",
                "Score (>400)",
                "Qualified",
                "Not Qualified",
                "Attended",
                "Registration",
            ],
            help_text="Select your official GATE outcome as per Table 11.1.",
        ),
        DynamicFieldDefinition(
            name="score",
            label="GATE Score (Optional)",
            type="number",
            required=False,
            min=0,
            placeholder="e.g. 450",
        ),
    ],
    "scouts-for-sdgs": [
        DynamicFieldDefinition(
            name="category",
            label="Scout Activity Classification",
            type="select",
            required=True,
            options=["Service (20 hrs)", "Scout Online Courses (2)", "Work on activity", "Enroll"],
            help_text="Table 12.1: Service 20h -> O, Online Courses -> A+, Activity -> A, Enroll -> B.",
        ),
    ],
    "fit-india-certifications": [
        DynamicFieldDefinition(
            name="score",
            label="FIT INDIA Score",
            type="number",
            required=True,
            min=0,
            placeholder="e.g. 85",
            help_text="Table 13.1: >=100 -> O, 75-99 -> A+, 50-74 -> A, 30-49 -> B+, <30 -> B.",
        ),
    ],
    "academics-gpa": [
        DynamicFieldDefinition(
            name="gpa",
            label="Semester Grade Point Average (GPA)",
            type="number",
            required=True,
            min=0.0,
            max=10.0,
            placeholder="e.g. 8.75",
            help_text="Official university GPA for the completed semester on a 10.0 scale.",
        ),
    ],
}


def get_dynamic_fields_for_component(slug: str) -> List[DynamicFieldDefinition]:
    return COMPONENT_DYNAMIC_FIELDS.get(slug.strip().lower(), [
        DynamicFieldDefinition(
            name="grade",
            label="Direct Grade",
            type="select",
            required=True,
            options=["O", "A+", "A", "B+", "B", "C"],
        ),
        DynamicFieldDefinition(
            name="notes",
            label="Remarks / Reference",
            type="text",
            required=False,
        ),
    ])


# ==============================================================================
# Excel Template Generation
# ==============================================================================
def generate_hod_excel_template(
    db: Session,
    component: PGPAComponent,
    semester: Semester,
    department: str = "CCE",
) -> bytes:
    """
    Builds a professional, styled Excel (.xlsx) template for HOD data entry.
    Pre-populates active students of the department with register numbers and names.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"{component.slug[:20]}_Sem{semester.semester_number}"

    # Colors and Fonts
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")  # Deep Blue
    sub_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    # Title block
    ws.merge_cells("A1:E1")
    title_cell = ws["A1"]
    title_cell.value = f"SRI SAIRAM ENGINEERING COLLEGE — {department} DEPARTMENT"
    title_cell.font = Font(name="Segoe UI", size=13, bold=True, color="1E3A8A")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 25

    ws.merge_cells("A2:E2")
    sub_cell = ws["A2"]
    sub_cell.value = f"Official HOD Import Template: {component.name} ({semester.display_name}) — Credit Value: {component.credit_value}"
    sub_cell.font = Font(name="Segoe UI", size=10, italic=True, color="475569")
    sub_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 20

    # Instructions Row
    ws.merge_cells("A3:E3")
    instr_cell = ws["A3"]
    guidelines_text = _get_component_template_instructions(component.slug)
    instr_cell.value = f"Instructions: {guidelines_text}"
    instr_cell.font = Font(name="Segoe UI", size=9, bold=True, color="047857")
    instr_cell.fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
    instr_cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[3].height = 22

    # Column Headers (Row 5)
    headers = ["S.No", "Register Number", "Student Name", "Result Value (Points / Category / Score)", "Notes (Optional)"]
    ws.row_dimensions[5].height = 28
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=5, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    # Fetch Department Students
    students_stmt = (
        select(User)
        .options(joinedload(User.student_profile))
        .where(User.role == UserRole.STUDENT, User.is_active.is_(True))
        .order_by(User.full_name.asc())
    )
    students = db.scalars(students_stmt).all()

    # Pre-populate rows
    row_num = 6
    s_idx = 1
    for st in students:
        reg_num = st.student_profile.register_number if st.student_profile else ""
        dept = st.student_profile.department if st.student_profile else "CCE"
        if department and dept.upper() != department.upper():
            continue

        c1 = ws.cell(row=row_num, column=1, value=s_idx)
        c2 = ws.cell(row=row_num, column=2, value=reg_num)
        c3 = ws.cell(row=row_num, column=3, value=st.full_name)
        c4 = ws.cell(row=row_num, column=4, value="")  # To be filled by HOD
        c5 = ws.cell(row=row_num, column=5, value="")  # Notes

        for c in [c1, c2, c3, c4, c5]:
            c.font = Font(name="Segoe UI", size=10)
            c.border = thin_border
            if s_idx % 2 == 0:
                c.fill = sub_fill

        c1.alignment = Alignment(horizontal="center")
        c2.alignment = Alignment(horizontal="center")
        ws.row_dimensions[row_num].height = 20
        row_num += 1
        s_idx += 1

    # Set column widths
    ws.column_dimensions["A"].width = 8
    ws.column_dimensions["B"].width = 22
    ws.column_dimensions["C"].width = 32
    ws.column_dimensions["D"].width = 42
    ws.column_dimensions["E"].width = 30

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


def _get_component_template_instructions(slug: str) -> str:
    s = slug.lower()
    if s == "skillrack":
        return "Enter cumulative Skillrack points (e.g. 2400). Numbers only."
    elif s == "amcat":
        return "Enter score on a 10.0 scale (e.g. 8.5)."
    elif s == "internship":
        return "Enter 'Core / with stipend' or 'Others'."
    elif s == "nptel-non-credit-transfer":
        return "Enter category: Topper | Gold | Silver | Elite | Successfully Completed | Attended."
    elif s == "gate":
        return "Enter: Percentile (>90) | Score (>400) | Qualified | Not Qualified | Attended | Registration."
    elif s == "sairam-innovation-eco-system":
        return "Enter: Overall Winners 3 Teams | SDG wise winners 51 teams | Round 2 finalist | Round 1 finalist | Proposal submitted in time."
    elif s == "sail":
        return "Enter cumulative SAIL points (e.g. 210)."
    elif s == "clubs-and-cells":
        return "Enter cumulative points (e.g. 1200)."
    elif s == "sports-and-games":
        return "Enter sports points (e.g. 100), or 'International'."
    elif s == "scouts-for-sdgs":
        return "Enter: Service (20 hrs) | Scout Online Courses (2) | Work on activity | Enroll."
    elif s == "fit-india-certifications":
        return "Enter score (0-100)."
    elif s == "academics-gpa":
        return "Enter university semester GPA (0.00 - 10.00)."
    return "Enter score or category matching official evaluation guidelines."


# ==============================================================================
# HOD Excel Import Parser & Preview Generator
# ==============================================================================
def parse_and_preview_hod_import(
    db: Session,
    file_bytes: bytes,
    filename: str,
    component_id: uuid.UUID,
    semester_id: uuid.UUID,
    uploader: User,
) -> HODImportPreviewResponse:
    """
    Parses an uploaded .xlsx or .csv spreadsheet, validates each student register number
    against the database, executes the grading engine to compute proposed grades,
    and returns a preview without saving changes to PostgreSQL.
    """
    component = db.get(PGPAComponent, component_id)
    if not component:
        raise ValueError(f"Component with ID '{component_id}' not found.")

    semester = db.get(Semester, semester_id)
    if not semester:
        raise ValueError(f"Semester with ID '{semester_id}' not found.")

    # Cache all active students by register_number
    students_stmt = (
        select(User)
        .options(joinedload(User.student_profile))
        .where(User.role == UserRole.STUDENT)
    )
    all_students = db.scalars(students_stmt).all()
    reg_student_map: Dict[str, Tuple[uuid.UUID, str]] = {}
    for st in all_students:
        if st.student_profile and st.student_profile.register_number:
            key = st.student_profile.register_number.strip().upper()
            reg_student_map[key] = (st.id, st.full_name)

    # Read rows
    raw_rows: List[Tuple[int, str, str, str, str]] = []
    fname = filename.lower()

    if fname.endswith(".csv"):
        text_stream = io.StringIO(file_bytes.decode("utf-8", errors="replace"))
        all_csv_rows = [row for row in csv.reader(text_stream) if row and any(c.strip() for c in row)]
        
        reg_col = None
        name_col = None
        val_col = None
        notes_col = None
        data_start_idx = 0

        # Try to find header row
        for idx, row in enumerate(all_csv_rows[:5]):
            lowered = [c.strip().lower() for c in row]
            if any("register" in c or c in ("reg", "reg_no", "regno", "reg no") for c in lowered):
                data_start_idx = idx + 1
                for c_idx, c_val in enumerate(lowered):
                    if "register" in c_val or c_val in ("reg", "reg_no", "regno", "reg no"):
                        reg_col = c_idx
                    elif "name" in c_val:
                        name_col = c_idx
                    elif any(k in c_val for k in ("result", "score", "grade", "gpa", "points", "passed", "value", "category")):
                        if val_col is None:
                            val_col = c_idx
                    elif "note" in c_val:
                        notes_col = c_idx
                break

        for r_idx, row in enumerate(all_csv_rows[data_start_idx:], data_start_idx + 1):
            if not row or all(c.strip() == "" for c in row):
                continue
            if reg_col is not None and val_col is not None:
                reg = row[reg_col].strip() if reg_col < len(row) else ""
                name = row[name_col].strip() if name_col is not None and name_col < len(row) else ""
                val = row[val_col].strip() if val_col < len(row) else ""
                notes = row[notes_col].strip() if notes_col is not None and notes_col < len(row) else ""
                raw_rows.append((r_idx, reg, name, val, notes))
            elif len(row) >= 4 and row[0].strip().isdigit() and len(row[0].strip()) <= 4:
                # S.No, Reg, Name, Result, [Notes] (template format)
                reg = row[1].strip() if len(row) > 1 else ""
                name = row[2].strip() if len(row) > 2 else ""
                val = row[3].strip() if len(row) > 3 else ""
                notes = row[4].strip() if len(row) > 4 else ""
                raw_rows.append((r_idx, reg, name, val, notes))
            elif len(row) >= 3:
                # Reg, Name, Result, [Notes]
                reg = row[0].strip()
                name = row[1].strip()
                val = row[2].strip()
                notes = row[3].strip() if len(row) > 3 else ""
                raw_rows.append((r_idx, reg, name, val, notes))
            elif len(row) >= 2:
                # Reg, Result
                raw_rows.append((r_idx, row[0].strip(), "", row[1].strip(), ""))
    else:
        # Default: openpyxl Excel
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        start_row = 1
        ex_reg_col = 2
        ex_name_col = 3
        ex_val_col = 4
        ex_notes_col = 5

        # Detect header row
        for row_i in range(1, 10):
            row_vals = [str(ws.cell(row=row_i, column=col_j).value or "").lower() for col_j in range(1, 8)]
            if any("register" in v for v in row_vals):
                start_row = row_i + 1
                for col_j, v in enumerate(row_vals, 1):
                    if "register" in v or v in ("reg", "reg_no", "regno"):
                        ex_reg_col = col_j
                    elif "name" in v:
                        ex_name_col = col_j
                    elif any(k in v for k in ("result", "score", "grade", "gpa", "points", "passed", "value", "category")):
                        ex_val_col = col_j
                    elif "note" in v:
                        ex_notes_col = col_j
                break

        for row_idx in range(start_row, ws.max_row + 1):
            c_reg = str(ws.cell(row=row_idx, column=ex_reg_col).value or "").strip()
            c_name = str(ws.cell(row=row_idx, column=ex_name_col).value or "").strip()
            c_val = str(ws.cell(row=row_idx, column=ex_val_col).value or "").strip()
            c_notes = str(ws.cell(row=row_idx, column=ex_notes_col).value or "").strip()

            if not c_reg and not c_val:
                continue
            raw_rows.append((row_idx, c_reg, c_name, c_val, c_notes))

    # Process and Validate Rows
    preview_rows: List[HODImportPreviewRow] = []
    seen_reg_numbers = set()
    valid_count = 0
    error_count = 0

    for r_idx, reg_num, student_name, res_val, notes in raw_rows:
        reg_clean = reg_num.strip().upper()
        if not reg_clean:
            preview_rows.append(
                HODImportPreviewRow(
                    row_number=r_idx,
                    register_number=reg_num,
                    result_value=res_val,
                    is_valid=False,
                    error_message="Missing student register number.",
                )
            )
            error_count += 1
            continue

        if reg_clean in seen_reg_numbers:
            preview_rows.append(
                HODImportPreviewRow(
                    row_number=r_idx,
                    register_number=reg_num,
                    student_name=student_name,
                    result_value=res_val,
                    is_valid=False,
                    error_message=f"Duplicate register number '{reg_clean}' in spreadsheet.",
                )
            )
            error_count += 1
            continue
        seen_reg_numbers.add(reg_clean)

        if reg_clean not in reg_student_map:
            preview_rows.append(
                HODImportPreviewRow(
                    row_number=r_idx,
                    register_number=reg_num,
                    student_name=student_name,
                    result_value=res_val,
                    is_valid=False,
                    error_message=f"Register number '{reg_clean}' not found in active student roster.",
                )
            )
            error_count += 1
            continue

        student_id, official_name = reg_student_map[reg_clean]

        if not res_val:
            preview_rows.append(
                HODImportPreviewRow(
                    row_number=r_idx,
                    register_number=reg_clean,
                    student_name=official_name,
                    student_id=student_id,
                    result_value="",
                    is_valid=False,
                    error_message="Result value is empty for this student.",
                )
            )
            error_count += 1
            continue

        # Evaluate Grade via Grading Engine
        try:
            inputs: Dict[str, Any] = {"raw_score": res_val, "category": res_val, "notes": notes}
            try:
                num_val = float(res_val)
                inputs["points"] = num_val
                inputs["score"] = num_val
                inputs["gpa"] = num_val
                inputs["hours"] = num_val
            except ValueError:
                pass

            grading_res = calculate_component_grade(
                component_slug=component.slug,
                semester_number=semester.semester_number,
                inputs=inputs,
                credit_value=component.credit_value,
            )

            preview_rows.append(
                HODImportPreviewRow(
                    row_number=r_idx,
                    register_number=reg_clean,
                    student_name=official_name,
                    student_id=student_id,
                    result_value=res_val,
                    raw_score=grading_res.get("raw_score"),
                    category=grading_res.get("category"),
                    calculated_grade=grading_res.get("grade"),
                    grade_points=grading_res.get("grade_points"),
                    is_valid=True,
                    error_message=None,
                )
            )
            valid_count += 1
        except Exception as exc:
            preview_rows.append(
                HODImportPreviewRow(
                    row_number=r_idx,
                    register_number=reg_clean,
                    student_name=official_name,
                    student_id=student_id,
                    result_value=res_val,
                    is_valid=False,
                    error_message=f"Grading rule evaluation error: {exc}",
                )
            )
            error_count += 1

    # Generate preview token and cache payload for confirmation
    preview_token = secrets.token_urlsafe(24)
    PENDING_IMPORT_PREVIEWS[preview_token] = {
        "component_id": str(component_id),
        "semester_id": str(semester_id),
        "uploaded_by_id": str(uploader.id),
        "source_filename": filename,
        "academic_cohort": "2nd Year CCE",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "rows": [row.model_dump() for row in preview_rows if row.is_valid],
        "total_rows": len(preview_rows),
        "valid_rows": valid_count,
        "error_rows": error_count,
    }

    summary = (
        f"Parsed {len(preview_rows)} rows: {valid_count} valid, {error_count} errors. "
        f"{'Ready to import.' if error_count == 0 else 'Please review errors before confirming.'}"
    )

    return HODImportPreviewResponse(
        preview_token=preview_token,
        component_id=component.id,
        component_name=component.name,
        component_slug=component.slug,
        semester_id=semester.id,
        semester_name=semester.display_name,
        semester_number=semester.semester_number,
        total_rows=len(preview_rows),
        valid_rows=valid_count,
        error_rows=error_count,
        rows=preview_rows,
        summary_message=summary,
    )


# ==============================================================================
# Commit Confirmed Import
# ==============================================================================
def commit_hod_import(
    db: Session,
    preview_token: str,
    user: User,
) -> Dict[str, Any]:
    """
    Transactionally commits the verified HOD import batch:
    1. Creates HODImportBatch record
    2. Upserts StudentComponentResult for each student
    3. Triggers PGPA recalculation for each affected student
    """
    cached = PENDING_IMPORT_PREVIEWS.get(preview_token)
    if not cached:
        raise ValueError("Invalid or expired import preview token. Please upload the file again.")

    raw_comp_id = cached["component_id"]
    component_id = uuid.UUID(raw_comp_id) if isinstance(raw_comp_id, str) else raw_comp_id
    raw_sem_id = cached["semester_id"]
    semester_id = uuid.UUID(raw_sem_id) if isinstance(raw_sem_id, str) else raw_sem_id
    component = db.get(PGPAComponent, component_id)
    semester = db.get(Semester, semester_id)

    if not component or not semester:
        raise ValueError("Target component or semester no longer exists.")

    valid_rows_data = cached["rows"]
    if not valid_rows_data:
        raise ValueError("Cannot commit an import batch with 0 valid rows.")

    now_utc = datetime.now(timezone.utc)
    batch_id = uuid.uuid4()

    # 1. Create Batch record
    batch = HODImportBatch(
        id=batch_id,
        uploaded_by=user.id,
        component_id=component_id,
        semester_id=semester_id,
        academic_cohort=cached.get("academic_cohort", "2nd Year CCE"),
        source_filename=cached.get("source_filename", "upload.xlsx"),
        total_rows=cached.get("total_rows", len(valid_rows_data)),
        valid_rows=len(valid_rows_data),
        error_rows=cached.get("error_rows", 0),
        status="confirmed",
        created_at=now_utc,
    )
    db.add(batch)

    # 2. Upsert StudentComponentResult
    imported_count = 0
    student_ids_to_recalc = set()

    for r in valid_rows_data:
        raw_st_id = r["student_id"]
        st_id = uuid.UUID(raw_st_id) if isinstance(raw_st_id, str) else raw_st_id
        student_ids_to_recalc.add(st_id)

        # Look up existing result
        stmt = (
            select(StudentComponentResult)
            .where(
                StudentComponentResult.student_id == st_id,
                StudentComponentResult.component_id == component_id,
                StudentComponentResult.semester_id == semester_id,
            )
        )
        existing = db.scalars(stmt).first()

        grade = r["calculated_grade"]
        gp = r["grade_points"]
        raw_score = r.get("raw_score")
        category = r.get("category")

        if existing:
            existing.raw_score = raw_score
            existing.category = category
            existing.grade = grade
            existing.grade_points = gp
            existing.credit_value = component.credit_value
            existing.is_verified = True
            existing.source = "hod_import"
            existing.import_batch_id = batch_id
            existing.calculated_at = now_utc
            existing.updated_at = now_utc
            db.add(existing)
        else:
            new_res = StudentComponentResult(
                id=uuid.uuid4(),
                student_id=st_id,
                component_id=component_id,
                semester_id=semester_id,
                raw_score=raw_score,
                category=category,
                grade=grade,
                grade_points=gp,
                credit_value=component.credit_value,
                is_verified=True,
                source="hod_import",
                import_batch_id=batch_id,
                calculated_at=now_utc,
                created_at=now_utc,
                updated_at=now_utc,
            )
            db.add(new_res)
        imported_count += 1

    # 3. Recalculate PGPA for all affected students
    for st_id in student_ids_to_recalc:
        _recalculate_student_semester_pgpa(db, st_id, semester_id)

    db.commit()

    # Clear pending cache
    PENDING_IMPORT_PREVIEWS.pop(preview_token, None)

    return {
        "batch_id": str(batch_id),
        "component_name": component.name,
        "semester_name": semester.display_name,
        "imported_count": imported_count,
        "message": f"Successfully imported and updated {imported_count} student component results.",
    }


def _recalculate_student_semester_pgpa(
    db: Session,
    student_id: uuid.UUID,
    semester_id: uuid.UUID,
) -> Optional[StudentSemesterPGPA]:
    """
    Calculates overall PGPA using student_component_results and persists to student_semester_pgpa.
    """
    results_stmt = (
        select(StudentComponentResult)
        .options(joinedload(StudentComponentResult.component))
        .where(
            StudentComponentResult.student_id == student_id,
            StudentComponentResult.semester_id == semester_id,
        )
    )
    results = db.scalars(results_stmt).all()
    if not results:
        return None

    comp_dicts = []
    semester_gpa = None

    for r in results:
        if r.component and r.component.slug == "academics-gpa":
            semester_gpa = r.raw_score

        comp_dicts.append({
            "component_id": str(r.component_id),
            "component_slug": r.component.slug if r.component else "",
            "component_name": r.component.name if r.component else "",
            "grade": r.grade,
            "grade_points": r.grade_points,
            "credit_value": r.credit_value,
            "is_verified": r.is_verified,
        })

    pgpa_summary = calculate_overall_pgpa(comp_dicts, semester_gpa=semester_gpa)

    # Upsert StudentSemesterPGPA
    pgpa_stmt = (
        select(StudentSemesterPGPA)
        .where(
            StudentSemesterPGPA.student_id == student_id,
            StudentSemesterPGPA.semester_id == semester_id,
        )
    )
    record = db.scalars(pgpa_stmt).first()
    now_utc = datetime.now(timezone.utc)

    if record:
        record.a1_score = pgpa_summary["a1_score"]
        record.gpa = pgpa_summary["semester_gpa"]
        record.pgpa = pgpa_summary["pgpa"]
        record.total_credits_attempted = pgpa_summary["total_credits_attempted"]
        record.total_credits_earned = pgpa_summary["total_credits_earned"]
        record.calculated_at = now_utc
        record.updated_at = now_utc
        db.add(record)
    else:
        record = StudentSemesterPGPA(
            id=uuid.uuid4(),
            student_id=student_id,
            semester_id=semester_id,
            a1_score=pgpa_summary["a1_score"],
            gpa=pgpa_summary["semester_gpa"],
            pgpa=pgpa_summary["pgpa"],
            total_credits_attempted=pgpa_summary["total_credits_attempted"],
            total_credits_earned=pgpa_summary["total_credits_earned"],
            calculated_at=now_utc,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(record)

    return record
