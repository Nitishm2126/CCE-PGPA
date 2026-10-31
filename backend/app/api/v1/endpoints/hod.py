import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.permissions import require_hod
from app.db.session import get_db
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
from app.models.grading import HODImportBatch, StudentComponentResult, StudentSemesterPGPA
from app.models.review import ReviewAction, VerificationLog
from app.models.semester import Semester
from app.models.user import StudentProfile, User, UserRole
from app.schemas.achievement import AchievementResponse, ReviewSubmissionRequest
from app.schemas.auth import HODStudentItem
from app.schemas.component_config import (
    ComponentDetailItem,
    HODCorrectionRequest,
    HODImportBatchItem,
    HODImportConfirmRequest,
    HODImportPreviewResponse,
    StudentComponentResultItem,
    StudentPGPAComponentScore,
    StudentPGPAGradeRow,
)
from app.services.admin_service import record_audit_log
from app.services.component_service import (
    _recalculate_student_semester_pgpa,
    commit_hod_import,
    generate_hod_excel_template,
    parse_and_preview_hod_import,
)
from app.services.export_service import build_report_data, generate_excel_report, generate_pdf_report
from app.services.grading_engine import calculate_component_grade
from app.api.v1.endpoints.students import format_achievement_response

router = APIRouter()


@router.get(
    "/students",
    response_model=List[HODStudentItem],
    summary="Get cohort-wide student directory for HOD",
    description="Authorized HOD endpoint to inspect all department students and their active mentor assignments.",
)
def get_department_students(
    include_test_accounts: bool = Query(default=False, description="Whether to include test/fixture accounts"),
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[HODStudentItem]:
    stmt = (
        select(User)
        .options(joinedload(User.student_profile))
        .where(User.role == UserRole.STUDENT)
    )
    if not include_test_accounts:
        stmt = stmt.join(StudentProfile, User.id == StudentProfile.user_id).where(
            ~User.email.ilike("%@test.edu")
        )
    stmt = stmt.order_by(User.full_name.asc())
    students = db.scalars(stmt).all()

    active_assignments_stmt = (
        select(MentorAssignment)
        .options(joinedload(MentorAssignment.mentor))
        .where(MentorAssignment.is_active.is_(True))
    )
    active_assignments = db.scalars(active_assignments_stmt).all()
    student_mentor_map = {
        assign.student_id: (assign.mentor.id, assign.mentor.full_name)
        for assign in active_assignments
        if assign.mentor
    }

    results: List[HODStudentItem] = []
    for student in students:
        profile = student.student_profile
        mentor_id, mentor_name = student_mentor_map.get(student.id, (None, None))

        results.append(
            HODStudentItem(
                student_id=student.id,
                full_name=student.full_name,
                email=student.email,
                register_number=profile.register_number if profile else None,
                department=profile.department if profile else "CCE",
                year=profile.year if profile else 2,
                section=profile.section if profile else None,
                is_active=student.is_active,
                mentor_id=mentor_id,
                mentor_name=mentor_name,
            )
        )

    return results


@router.get(
    "/overview",
    summary="Get department-wide PGPA metrics for HOD",
    description="Returns aggregate statistics on cohort students, mentors, and achievement verification queues.",
)
def get_department_overview(
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
):
    total_students = db.scalars(select(func.count(User.id)).where(User.role == UserRole.STUDENT)).one()
    total_mentors = db.scalars(select(func.count(User.id)).where(User.role == UserRole.MENTOR)).one()
    total_components = db.scalars(select(func.count(PGPAComponent.id)).where(PGPAComponent.is_active.is_(True))).one()

    total_achievements = db.scalars(select(func.count(Achievement.id))).one()
    pending_achievements = db.scalars(
        select(func.count(Achievement.id)).where(Achievement.status == AchievementStatus.PENDING)
    ).one()
    approved_achievements = db.scalars(
        select(func.count(Achievement.id)).where(Achievement.status == AchievementStatus.APPROVED)
    ).one()
    rejected_achievements = db.scalars(
        select(func.count(Achievement.id)).where(Achievement.status == AchievementStatus.REJECTED)
    ).one()
    draft_achievements = db.scalars(
        select(func.count(Achievement.id)).where(Achievement.status == AchievementStatus.DRAFT)
    ).one()

    return {
        "department": "Computer and Communication Engineering (CCE)",
        "cohort": "Second-Year CCE",
        "total_students": total_students,
        "total_mentors": total_mentors,
        "active_components": total_components,
        "achievements": {
            "total": total_achievements,
            "draft": draft_achievements,
            "pending": pending_achievements,
            "approved": approved_achievements,
            "rejected": rejected_achievements,
        },
    }


@router.get(
    "/submissions",
    response_model=List[AchievementResponse],
    summary="Get cohort-wide student submissions (view-only HOD access)",
    description=(
        "Enforces HOD authorization: returns submitted student activities across "
        "the CCE department with optional filters by status, component, student, semester, or search query. "
        "By default, returns all non-draft submissions without requiring any approval."
    ),
)
def get_department_submissions(
    status_filter: Optional[AchievementStatus] = Query(
        default=None,
        alias="status",
        description="Filter submissions by status (e.g. 'pending', 'approved', 'rejected'). If omitted, returns all non-draft submissions.",
    ),
    component_id: Optional[uuid.UUID] = Query(
        default=None,
        description="Filter by PGPA component UUID",
    ),
    student_id: Optional[uuid.UUID] = Query(
        default=None,
        description="Filter by specific student UUID",
    ),
    semester: Optional[str] = Query(
        default=None,
        description="Filter by semester (e.g. 'Semester III' or '3')",
    ),
    search: Optional[str] = Query(
        default=None,
        description="Search text across student name, register number, or activity title",
    ),
    limit: int = Query(
        default=200,
        ge=1,
        le=1000,
        description="Maximum number of submissions to return per page",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Pagination offset",
    ),
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[AchievementResponse]:
    stmt = (
        select(Achievement)
        .options(
            joinedload(Achievement.component),
            joinedload(Achievement.semester),
            joinedload(Achievement.student).joinedload(User.student_profile),
            selectinload(Achievement.files),
            selectinload(Achievement.verification_logs).joinedload(VerificationLog.reviewer),
        )
        .join(User, Achievement.student_id == User.id)
        .outerjoin(StudentProfile, User.id == StudentProfile.user_id)
        .join(PGPAComponent, Achievement.component_id == PGPAComponent.id)
        .where(
            User.role == UserRole.STUDENT,
            or_(
                Achievement.status != AchievementStatus.PENDING,
                PGPAComponent.is_visible.is_(True),
            ),
        )
    )

    if status_filter:
        stmt = stmt.where(Achievement.status == status_filter)
    else:
        # Show all submitted activities (exclude drafts)
        stmt = stmt.where(Achievement.status != AchievementStatus.DRAFT)

    if component_id:
        stmt = stmt.where(Achievement.component_id == component_id)

    if student_id:
        stmt = stmt.where(Achievement.student_id == student_id)

    if semester and semester.strip():
        sem_clean = semester.strip().replace("Semester", "").strip()
        stmt = stmt.where(
            or_(
                StudentProfile.semester.ilike(f"%{sem_clean}%"),
                StudentProfile.semester.ilike(f"%{semester.strip()}%"),
            )
        )

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(term),
                StudentProfile.register_number.ilike(term),
                Achievement.title.ilike(term),
            )
        )

    stmt = stmt.order_by(Achievement.submitted_at.desc(), Achievement.created_at.desc())
    stmt = stmt.offset(offset).limit(limit)
    achievements = db.scalars(stmt).all()
    return [format_achievement_response(a) for a in achievements]


@router.get(
    "/students/{student_id}/achievements",
    response_model=List[AchievementResponse],
    summary="View student's achievement portfolio (HOD department oversight)",
    description="Allows HOD to view any student's achievements and certificates across the department.",
)
def get_student_achievements_for_hod(
    student_id: uuid.UUID,
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[AchievementResponse]:
    student = db.get(User, student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID '{student_id}' not found.",
        )

    stmt = (
        select(Achievement)
        .options(
            joinedload(Achievement.component),
            joinedload(Achievement.semester),
            joinedload(Achievement.student).joinedload(User.student_profile),
            selectinload(Achievement.files),
            selectinload(Achievement.verification_logs).joinedload(VerificationLog.reviewer),
        )
        .where(Achievement.student_id == student_id)
        .order_by(Achievement.created_at.desc())
    )
    achievements = db.scalars(stmt).all()
    return [format_achievement_response(a) for a in achievements]


@router.post(
    "/achievements/{achievement_id}/review",
    response_model=AchievementResponse,
    summary="Review an achievement submission (HOD oversight authority)",
    description="Allows HOD to verify/override any achievement across the department.",
)
def review_achievement_as_hod(
    achievement_id: uuid.UUID,
    review_data: ReviewSubmissionRequest,
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> AchievementResponse:
    achievement = db.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    if review_data.action == ReviewAction.APPROVED:
        achievement.status = AchievementStatus.APPROVED
        # Calculate grade and record verified component result
        if achievement.component and achievement.semester:
            try:
                inputs = {
                    "raw_score": achievement.outcome,
                    "category": achievement.activity_type or achievement.title,
                    "notes": achievement.description,
                }
                if achievement.outcome:
                    try:
                        import json
                        parsed = json.loads(achievement.outcome)
                        if isinstance(parsed, dict):
                            inputs.update(parsed)
                    except Exception:
                        pass
                grading_res = calculate_component_grade(
                    component_slug=achievement.component.slug,
                    semester_number=achievement.semester.semester_number,
                    inputs=inputs,
                    credit_value=achievement.component.credit_value,
                )
                now_utc = datetime.now(timezone.utc)
                stmt = select(StudentComponentResult).where(
                    StudentComponentResult.student_id == achievement.student_id,
                    StudentComponentResult.component_id == achievement.component_id,
                    StudentComponentResult.semester_id == achievement.semester_id,
                )
                res_rec = db.scalars(stmt).first()
                if res_rec:
                    res_rec.grade = grading_res["grade"]
                    res_rec.grade_points = grading_res["grade_points"]
                    res_rec.credit_value = achievement.component.credit_value
                    res_rec.is_verified = True
                    res_rec.source = "student_submission"
                    res_rec.achievement_id = achievement.id
                    res_rec.calculated_at = now_utc
                    db.add(res_rec)
                else:
                    new_res = StudentComponentResult(
                        id=uuid.uuid4(),
                        student_id=achievement.student_id,
                        component_id=achievement.component_id,
                        semester_id=achievement.semester_id,
                        raw_score=grading_res.get("raw_score"),
                        category=grading_res.get("category"),
                        grade=grading_res["grade"],
                        grade_points=grading_res["grade_points"],
                        credit_value=achievement.component.credit_value,
                        is_verified=True,
                        source="student_submission",
                        achievement_id=achievement.id,
                        calculated_at=now_utc,
                    )
                    db.add(new_res)
                if achievement.semester_id:
                    _recalculate_student_semester_pgpa(db, achievement.student_id, achievement.semester_id)
            except Exception as e:
                print(f"Warning: Auto-grading error on HOD approval: {e}")
    elif review_data.action == ReviewAction.REJECTED:
        achievement.status = AchievementStatus.REJECTED
    elif review_data.action == ReviewAction.REQUESTED_CHANGES:
        achievement.status = AchievementStatus.DRAFT

    log = VerificationLog(
        id=uuid.uuid4(),
        achievement_id=achievement.id,
        reviewer_id=current_user.id,
        action=review_data.action,
        remarks=review_data.remarks,
    )
    db.add(log)
    db.add(achievement)
    db.commit()
    db.refresh(achievement)

    return format_achievement_response(achievement)


# ==============================================================================
# HOD Excel Import & Component Result Management Endpoints
# ==============================================================================

@router.get(
    "/components",
    response_model=List[ComponentDetailItem],
    summary="Get PGPA components eligible for HOD data entry and Excel import",
    description="Returns components where submission_mode permits HOD Excel import or direct staff entry.",
)
def get_hod_components(
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[ComponentDetailItem]:
    stmt = (
        select(PGPAComponent)
        .where(
            PGPAComponent.is_active.is_(True),
            PGPAComponent.is_visible.is_(True),
            PGPAComponent.submission_mode.in_(["both", "hod_excel_import", "direct_staff_entry"]),
        )
        .order_by(PGPAComponent.display_order.asc())
    )
    components = db.scalars(stmt).all()
    return [
        ComponentDetailItem(
            id=c.id,
            name=c.name,
            slug=c.slug,
            description=c.description,
            display_order=c.display_order,
            is_active=c.is_active,
            is_visible=c.is_visible,
            credit_value=c.credit_value,
            submission_mode=c.submission_mode,
            grading_strategy=c.grading_strategy,
            requires_verification=c.requires_verification,
            rule_version=c.rule_version,
        )
        for c in components
    ]


@router.get(
    "/import/template",
    summary="Download pre-populated official Excel template for HOD import",
    description="Generates an .xlsx template with department students pre-filled and component instructions.",
)
def download_hod_template(
    component_id: uuid.UUID,
    semester_id: uuid.UUID,
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
):
    component = db.get(PGPAComponent, component_id)
    if not component:
        raise HTTPException(status_code=404, detail="Component not found.")
    if not component.is_visible:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Component '{component.name}' is currently hidden and does not accept imports.",
        )

    semester = db.get(Semester, semester_id)
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found.")

    file_bytes = generate_hod_excel_template(db, component, semester, department="CCE")
    filename = f"CCE_PGPA_{component.slug}_Sem{semester.semester_number}_Template.xlsx"

    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post(
    "/import/preview",
    response_model=HODImportPreviewResponse,
    summary="Preview and validate an uploaded HOD Excel or CSV file",
    description="Parses spreadsheet rows, validates against student roster and grading rules, and returns preview with errors.",
)
async def preview_hod_import(
    file: UploadFile = File(..., description="Spreadsheet (.xlsx or .csv)"),
    component_id: uuid.UUID = Form(...),
    semester_id: uuid.UUID = Form(...),
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> HODImportPreviewResponse:
    fname = file.filename or "upload.xlsx"
    if not (fname.lower().endswith(".xlsx") or fname.lower().endswith(".csv")):
        raise HTTPException(status_code=400, detail="Only .xlsx and .csv files are supported.")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit.")

    try:
        preview = parse_and_preview_hod_import(
            db=db,
            file_bytes=content,
            filename=fname,
            component_id=component_id,
            semester_id=semester_id,
            uploader=current_user,
        )
        return preview
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse spreadsheet: {exc}")


@router.post(
    "/import/confirm",
    summary="Confirm and execute transactional HOD import",
    description="Applies validated rows to student_component_results and triggers PGPA recalculations.",
)
def confirm_hod_import(
    payload: HODImportConfirmRequest,
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
):
    try:
        result = commit_hod_import(db, payload.preview_token, current_user)
        record_audit_log(
            db,
            actor_id=current_user.id,
            action="confirm_hod_excel_import",
            target_type="hod_import_batch",
            target_id=result["batch_id"],
            metadata={
                "component_name": result["component_name"],
                "semester_name": result["semester_name"],
                "imported_count": result["imported_count"],
            },
        )
        db.commit()
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import transaction failed: {exc}")


@router.get(
    "/import/history",
    response_model=List[HODImportBatchItem],
    summary="List past HOD Excel import batches",
)
def get_hod_import_history(
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[HODImportBatchItem]:
    stmt = (
        select(HODImportBatch)
        .options(
            joinedload(HODImportBatch.uploader),
            joinedload(HODImportBatch.component),
            joinedload(HODImportBatch.semester),
        )
        .order_by(HODImportBatch.created_at.desc())
    )
    batches = db.scalars(stmt).all()
    return [
        HODImportBatchItem(
            id=b.id,
            uploaded_by=b.uploaded_by,
            uploaded_by_name=b.uploader.full_name if b.uploader else None,
            component_id=b.component_id,
            component_name=b.component.name if b.component else None,
            semester_id=b.semester_id,
            semester_name=b.semester.display_name if b.semester else None,
            academic_cohort=b.academic_cohort,
            source_filename=b.source_filename,
            total_rows=b.total_rows,
            valid_rows=b.valid_rows,
            error_rows=b.error_rows,
            status=b.status,
            created_at=b.created_at,
        )
        for b in batches
    ]


@router.get(
    "/results",
    response_model=List[StudentComponentResultItem],
    summary="List student component results across department",
    description="Returns verified/imported results with optional filters by student, component, and semester.",
)
def get_department_component_results(
    student_id: Optional[uuid.UUID] = None,
    component_id: Optional[uuid.UUID] = None,
    semester_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[StudentComponentResultItem]:
    stmt = (
        select(StudentComponentResult)
        .options(
            joinedload(StudentComponentResult.student).joinedload(User.student_profile),
            joinedload(StudentComponentResult.component),
            joinedload(StudentComponentResult.semester),
        )
        .order_by(StudentComponentResult.calculated_at.desc())
    )
    if student_id:
        stmt = stmt.where(StudentComponentResult.student_id == student_id)
    if component_id:
        stmt = stmt.where(StudentComponentResult.component_id == component_id)
    if semester_id:
        stmt = stmt.where(StudentComponentResult.semester_id == semester_id)

    results = db.scalars(stmt).all()
    return [
        StudentComponentResultItem(
            id=r.id,
            student_id=r.student_id,
            student_name=r.student.full_name if r.student else None,
            student_register_number=r.student.student_profile.register_number if r.student and r.student.student_profile else None,
            component_id=r.component_id,
            component_name=r.component.name if r.component else None,
            component_slug=r.component.slug if r.component else None,
            semester_id=r.semester_id,
            semester_number=r.semester.semester_number if r.semester else None,
            semester_name=r.semester.display_name if r.semester else None,
            raw_score=r.raw_score,
            category=r.category,
            grade=r.grade,
            grade_points=r.grade_points,
            credit_value=r.credit_value,
            is_verified=r.is_verified,
            source=r.source,
            notes=r.notes,
            calculated_at=r.calculated_at,
        )
        for r in results
    ]


@router.patch(
    "/results/{result_id}",
    response_model=StudentComponentResultItem,
    summary="Authorized HOD correction for a student's component result",
    description="Updates grade or score with mandatory reason and audit logging, and recalculates PGPA.",
)
def correct_component_result(
    result_id: uuid.UUID,
    payload: HODCorrectionRequest,
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> StudentComponentResultItem:
    res = db.get(StudentComponentResult, result_id)
    if not res:
        raise HTTPException(status_code=404, detail="Result record not found.")

    prev = {
        "grade": res.grade,
        "grade_points": res.grade_points,
        "raw_score": res.raw_score,
        "category": res.category,
    }

    if payload.grade is not None:
        g = payload.grade.upper()
        if g in GRADE_POINTS_MAP:
            res.grade = g
            res.grade_points = GRADE_POINTS_MAP[g]
    if payload.raw_score is not None:
        res.raw_score = payload.raw_score
    if payload.category is not None:
        res.category = payload.category
    if payload.notes is not None:
        res.notes = f"{res.notes or ''}\n[HOD Correction] {payload.notes}".strip()

    now_utc = datetime.now(timezone.utc)
    res.updated_at = now_utc
    db.add(res)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="hod_correct_component_result",
        target_type="student_component_result",
        target_id=str(res.id),
        metadata={
            "student_id": str(res.student_id),
            "component_id": str(res.component_id),
            "semester_id": str(res.semester_id),
            "previous_state": prev,
            "new_state": {
                "grade": res.grade,
                "grade_points": res.grade_points,
                "raw_score": res.raw_score,
                "category": res.category,
            },
            "reason": payload.reason,
        },
    )

    _recalculate_student_semester_pgpa(db, res.student_id, res.semester_id)
    db.commit()
    db.refresh(res)

    return StudentComponentResultItem(
        id=res.id,
        student_id=res.student_id,
        student_name=res.student.full_name if res.student else None,
        student_register_number=res.student.student_profile.register_number if res.student and res.student.student_profile else None,
        component_id=res.component_id,
        component_name=res.component.name if res.component else None,
        component_slug=res.component.slug if res.component else None,
        semester_id=res.semester_id,
        semester_number=res.semester.semester_number if res.semester else None,
        semester_name=res.semester.display_name if res.semester else None,
        raw_score=res.raw_score,
        category=res.category,
        grade=res.grade,
        grade_points=res.grade_points,
        credit_value=res.credit_value,
        is_verified=res.is_verified,
        source=res.source,
        notes=res.notes,
        calculated_at=res.calculated_at,
    )


# ==============================================================================
# HOD Academic Report Export Endpoints (Excel & PDF)
# ==============================================================================

@router.get(
    "/export/excel",
    summary="Export department academic report as Excel (.xlsx)",
    description=(
        "Generates a multi-tab Excel workbook with Student Summary, Semester-wise PGPA Matrix, "
        "14 Components Breakdown, and Submissions Trail. Strictly isolated to HOD's department."
    ),
)
def export_hod_excel(
    semester_id: Optional[uuid.UUID] = Query(default=None, description="Optional filter by semester"),
    component_id: Optional[uuid.UUID] = Query(default=None, description="Optional filter by PGPA component"),
    student_id: Optional[uuid.UUID] = Query(default=None, description="Optional filter for individual student report"),
    status_filter: Optional[str] = Query(default=None, alias="status", description="Optional status filter ('approved', 'pending', 'all')"),
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> Response:
    dept_name = current_user.hod_profile.department if current_user.hod_profile else "CCE"

    dept_student_ids = list(db.scalars(
        select(User.id)
        .join(StudentProfile, User.id == StudentProfile.user_id)
        .where(
            User.role == UserRole.STUDENT,
            StudentProfile.department == dept_name,
        )
    ).all())

    if student_id:
        if student_id not in dept_student_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: The requested student does not belong to the {dept_name} department.",
            )
        target_student_ids = [student_id]
    else:
        target_student_ids = dept_student_ids

    report_data = build_report_data(
        db=db,
        student_ids=target_student_ids,
        semester_id=semester_id,
        component_id=component_id,
        status_filter=status_filter,
        department_name=dept_name,
        requester_role="Department HOD",
        requester_name=current_user.full_name,
    )

    content = generate_excel_report(report_data)
    date_stamp = report_data["metadata"]["date_stamp"]
    prefix = "Individual_Student" if student_id else f"{dept_name}_Department"
    filename = f"CCE_PGPA_{prefix}_Report_{date_stamp}.xlsx"

    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/export/pdf",
    summary="Export department academic report as PDF (.pdf)",
    description=(
        "Generates a formal, printable PDF document with Summary, 8-Semester Matrix, "
        "and Evaluation details. Strictly isolated to HOD's department."
    ),
)
def export_hod_pdf(
    semester_id: Optional[uuid.UUID] = Query(default=None, description="Optional filter by semester"),
    component_id: Optional[uuid.UUID] = Query(default=None, description="Optional filter by PGPA component"),
    student_id: Optional[uuid.UUID] = Query(default=None, description="Optional filter for individual student report"),
    status_filter: Optional[str] = Query(default=None, alias="status", description="Optional status filter ('approved', 'pending', 'all')"),
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> Response:
    dept_name = current_user.hod_profile.department if current_user.hod_profile else "CCE"

    dept_student_ids = list(db.scalars(
        select(User.id)
        .join(StudentProfile, User.id == StudentProfile.user_id)
        .where(
            User.role == UserRole.STUDENT,
            StudentProfile.department == dept_name,
        )
    ).all())

    if student_id:
        if student_id not in dept_student_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: The requested student does not belong to the {dept_name} department.",
            )
        target_student_ids = [student_id]
    else:
        target_student_ids = dept_student_ids

    report_data = build_report_data(
        db=db,
        student_ids=target_student_ids,
        semester_id=semester_id,
        component_id=component_id,
        status_filter=status_filter,
        department_name=dept_name,
        requester_role="Department HOD",
        requester_name=current_user.full_name,
    )

    content = generate_pdf_report(report_data)
    date_stamp = report_data["metadata"]["date_stamp"]
    prefix = "Individual_Student" if student_id else f"{dept_name}_Department"
    filename = f"CCE_PGPA_{prefix}_Report_{date_stamp}.pdf"

    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


TARGET_PGPA_SLUGS = [
    "clubs-and-cells",
    "nptel-non-credit-transfer",
    "online-certifications",
    "internship",
    "sports-and-games",
]


@router.get(
    "/student-pgpa-grades",
    response_model=List[StudentPGPAGradeRow],
    summary="Get cohort-wide 5-component PGPA grades matrix for HOD",
    description="Returns verified grades and points for Clubs, NPTEL, Online Certs, Internship, and Sports across department students.",
)
def get_student_pgpa_grades(
    semester_id: Optional[uuid.UUID] = Query(None, description="Optional semester filter"),
    section: Optional[str] = Query(None, description="Optional section filter (e.g. 'A')"),
    mentor_id: Optional[uuid.UUID] = Query(None, description="Optional mentor filter"),
    component_slug: Optional[str] = Query(None, description="Filter by component slug"),
    grade: Optional[str] = Query(None, description="Filter by grade (e.g. 'O', 'A+', etc.)"),
    search: Optional[str] = Query(None, description="Search by student name or register number"),
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[StudentPGPAGradeRow]:
    dept_name = current_user.hod_profile.department if current_user.hod_profile else "CCE"

    stmt = (
        select(User)
        .options(joinedload(User.student_profile))
        .join(StudentProfile, User.id == StudentProfile.user_id)
        .where(
            User.role == UserRole.STUDENT,
            StudentProfile.department == dept_name,
        )
    )

    if section and section.strip() and section.strip().lower() != "all":
        stmt = stmt.where(StudentProfile.section.ilike(section.strip()))

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(term),
                StudentProfile.register_number.ilike(term),
            )
        )

    if mentor_id:
        stmt = stmt.join(
            MentorAssignment,
            (MentorAssignment.student_id == User.id) & (MentorAssignment.is_active.is_(True)),
        ).where(MentorAssignment.mentor_id == mentor_id)

    stmt = stmt.order_by(StudentProfile.register_number.asc(), User.full_name.asc())
    students = db.scalars(stmt).unique().all()

    if not students:
        return []

    student_ids = [s.id for s in students]

    # Resolve active mentor assignments
    assign_stmt = (
        select(MentorAssignment)
        .options(joinedload(MentorAssignment.mentor))
        .where(
            MentorAssignment.student_id.in_(student_ids),
            MentorAssignment.is_active.is_(True),
        )
    )
    assignments = db.scalars(assign_stmt).all()
    mentor_map = {
        a.student_id: (a.mentor.id, a.mentor.full_name)
        for a in assignments
        if a.mentor
    }

    # Resolve target component IDs
    comps_stmt = select(PGPAComponent).where(PGPAComponent.slug.in_(TARGET_PGPA_SLUGS))
    target_comps = db.scalars(comps_stmt).all()
    comp_id_to_slug = {c.id: c.slug for c in target_comps}
    comp_ids = list(comp_id_to_slug.keys())

    # Fetch verified / recorded StudentComponentResult records
    results_stmt = (
        select(StudentComponentResult)
        .where(
            StudentComponentResult.student_id.in_(student_ids),
            StudentComponentResult.component_id.in_(comp_ids),
        )
        .order_by(StudentComponentResult.is_verified.desc(), StudentComponentResult.calculated_at.desc())
    )
    if semester_id:
        results_stmt = results_stmt.where(StudentComponentResult.semester_id == semester_id)

    all_results = db.scalars(results_stmt).all()

    # Map (student_id, slug) -> best result (verified preferred, then latest)
    student_results_map: Dict[Tuple[uuid.UUID, str], StudentComponentResult] = {}
    for r in all_results:
        slug = comp_id_to_slug.get(r.component_id)
        if not slug:
            continue
        key = (r.student_id, slug)
        if key not in student_results_map:
            student_results_map[key] = r

    rows: List[StudentPGPAGradeRow] = []
    clean_comp_filter = component_slug.strip().lower() if component_slug and component_slug.strip().lower() != "all" else None
    clean_grade_filter = grade.strip().upper() if grade and grade.strip().lower() != "all" else None

    for student in students:
        components_map: Dict[str, Optional[StudentPGPAComponentScore]] = {}
        total_pts = 0.0
        total_gp = 0

        for slug in TARGET_PGPA_SLUGS:
            res = student_results_map.get((student.id, slug))
            if res:
                is_pending = "pending" in (res.notes or "").lower() or (
                    slug == "sports-and-games" and res.category and "all india" in res.category.lower()
                )
                score_item = StudentPGPAComponentScore(
                    grade=res.grade,
                    grade_points=res.grade_points,
                    raw_score=res.raw_score,
                    credit_value=res.credit_value,
                    is_verified=res.is_verified,
                    source=res.source,
                    notes=res.notes,
                    criteria_pending=is_pending,
                    calculated_at=res.calculated_at,
                )
                components_map[slug] = score_item
                if res.is_verified and res.raw_score:
                    total_pts += float(res.raw_score)
                if res.is_verified:
                    total_gp += res.grade_points
            else:
                components_map[slug] = None

        # Filter by component_slug & grade if provided
        if clean_comp_filter:
            target_comp = components_map.get(clean_comp_filter)
            if not target_comp:
                continue
            if clean_grade_filter and target_comp.grade.upper() != clean_grade_filter:
                continue
        elif clean_grade_filter:
            has_matching_grade = any(
                c is not None and c.grade and c.grade.upper() == clean_grade_filter
                for c in components_map.values()
            )
            if not has_matching_grade:
                continue

        m_id, m_name = mentor_map.get(student.id, (None, None))
        rows.append(
            StudentPGPAGradeRow(
                student_id=student.id,
                register_number=student.student_profile.register_number if student.student_profile else None,
                student_name=student.full_name,
                email=student.email,
                department=dept_name,
                year=student.student_profile.year if student.student_profile else 2,
                section=student.student_profile.section if student.student_profile else None,
                mentor_id=m_id,
                mentor_name=m_name,
                components=components_map,
                total_points=round(total_pts, 2),
                total_grade_points=total_gp,
            )
        )

    return rows


