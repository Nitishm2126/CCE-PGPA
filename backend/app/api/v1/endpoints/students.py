import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.permissions import get_current_user, require_student
from app.db.session import get_db
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import ComponentSemesterConfig, PGPAComponent
from app.models.grading import StudentComponentResult, StudentSemesterPGPA
from app.models.review import ReviewAction, VerificationLog
from app.models.semester import Semester
from app.models.user import HodProfile, User, UserRole
from app.schemas.achievement import (
    AchievementCreate,
    AchievementResponse,
    AchievementUpdate,
    PGPAComponentResponse,
    VerificationLogResponse,
)
from app.schemas.auth import (
    MentorInfo,
    StudentDetailResponse,
    StudentProfileResponse,
    StudentProfileUpdateRequest,
)
from app.schemas.component_config import StudentComponentResultItem, StudentPGPAResponse
from app.schemas.file import AchievementFileResponse
from app.schemas.semester import SemesterResponse
from app.services.component_service import get_dynamic_fields_for_component, _recalculate_student_semester_pgpa
from app.services.grading_engine import (
    calculate_clubs_and_cells_points,
    calculate_component_grade,
    calculate_overall_pgpa,
)

router = APIRouter()


def format_achievement_response(
    achievement: Achievement,
    db: Optional[Session] = None,
    is_reviewer: bool = False,
) -> AchievementResponse:
    """
    Format SQLAlchemy Achievement model into AchievementResponse.
    Strict Result Visibility Invariant:
    Students must not see unapproved grades, provisional scores, or final point allocations before mentor approval.
    """
    files_data = [
        AchievementFileResponse(
            id=f.id,
            achievement_id=f.achievement_id,
            provider=f.provider,
            original_filename=f.original_filename,
            mime_type=f.mime_type,
            size_bytes=f.size_bytes,
            file_category=f.file_category.value,
            uploaded_by=f.uploaded_by,
            created_at=f.created_at,
            content_url=f"/api/v1/files/{f.id}/content",
        )
        for f in (achievement.files or [])
    ]

    logs_data = [
        VerificationLogResponse(
            id=log.id,
            achievement_id=log.achievement_id,
            reviewer_id=log.reviewer_id,
            reviewer_name=log.reviewer.full_name if log.reviewer else None,
            action=log.action,
            remarks=log.remarks,
            created_at=log.created_at,
        )
        for log in (achievement.verification_logs or [])
    ]

    student = achievement.student
    student_profile = student.student_profile if student else None

    # Latest mentor feedback remarks
    mentor_remarks = None
    if achievement.verification_logs:
        sorted_logs = sorted(
            achievement.verification_logs,
            key=lambda l: l.created_at or datetime.min.replace(tzinfo=timezone.utc),
        )
        if sorted_logs:
            mentor_remarks = sorted_logs[-1].remarks

    # Component-specific metadata restoration
    comp_metadata = achievement.component_metadata
    if not comp_metadata and achievement.outcome:
        try:
            import json
            parsed = json.loads(achievement.outcome)
            if isinstance(parsed, dict):
                comp_metadata = parsed
        except Exception:
            pass

    # Result visibility enforcement
    evaluated_grade = None
    evaluated_grade_points = None
    evaluated_points = None

    if achievement.status == AchievementStatus.APPROVED:
        # Load officially verified result from student_component_results
        if db is not None:
            res_rec = db.scalars(
                select(StudentComponentResult).where(
                    StudentComponentResult.student_id == achievement.student_id,
                    StudentComponentResult.component_id == achievement.component_id,
                    StudentComponentResult.semester_id == achievement.semester_id,
                    StudentComponentResult.is_verified.is_(True),
                )
            ).first()
            if res_rec:
                evaluated_grade = res_rec.grade
                evaluated_grade_points = res_rec.grade_points
                evaluated_points = res_rec.raw_score
    elif is_reviewer and achievement.status == AchievementStatus.PENDING:
        # For faculty review inspection: calculate tentative rubric outcome
        if achievement.component and achievement.semester:
            try:
                calc_inputs = {
                    "raw_score": achievement.outcome,
                    "category": achievement.activity_type or achievement.title,
                }
                if comp_metadata:
                    calc_inputs.update(comp_metadata)
                tentative = calculate_component_grade(
                    component_slug=achievement.component.slug,
                    semester_number=achievement.semester.semester_number,
                    inputs=calc_inputs,
                    credit_value=achievement.component.credit_value,
                )
                evaluated_grade = tentative.get("grade")
                evaluated_grade_points = tentative.get("grade_points")
                evaluated_points = tentative.get("raw_score")
            except Exception:
                pass

    return AchievementResponse(
        id=achievement.id,
        student_id=achievement.student_id,
        student_name=student.full_name if student else None,
        student_register_number=student_profile.register_number if student_profile else None,
        component_id=achievement.component_id,
        component_name=achievement.component.name if achievement.component else None,
        component_slug=achievement.component.slug if achievement.component else None,
        semester_id=achievement.semester_id,
        semester_number=achievement.semester.semester_number if achievement.semester else None,
        semester_display_name=achievement.semester.display_name if achievement.semester else None,
        semester=SemesterResponse.model_validate(achievement.semester) if achievement.semester else None,
        title=achievement.title,
        activity_type=achievement.activity_type,
        organizer=achievement.organizer,
        event_date=achievement.event_date,
        description=achievement.description,
        outcome=achievement.outcome,
        component_metadata=comp_metadata,
        evaluated_grade=evaluated_grade,
        evaluated_grade_points=evaluated_grade_points,
        evaluated_points=evaluated_points,
        mentor_remarks=mentor_remarks,
        status=achievement.status,
        submitted_at=achievement.submitted_at,
        created_at=achievement.created_at,
        updated_at=achievement.updated_at,
        files=files_data,
        verification_logs=logs_data,
    )


@router.get(
    "/me",
    response_model=StudentDetailResponse,
    summary="Get current student's profile and assigned mentor",
    description="Enforces strict student isolation: returns only the logged-in student's own profile and assigned mentor.",
)
def get_student_me(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudentDetailResponse:
    profile_data = None
    if current_user.student_profile is not None:
        profile_data = StudentProfileResponse.model_validate(current_user.student_profile)

    assignment_stmt = (
        select(MentorAssignment)
        .where(
            MentorAssignment.student_id == current_user.id,
            MentorAssignment.is_active.is_(True),
        )
        .limit(1)
    )
    active_assignment = db.scalars(assignment_stmt).first()

    mentor_info = None
    if active_assignment and active_assignment.mentor:
        mentor = active_assignment.mentor
        staff_id = mentor.mentor_profile.staff_id if mentor.mentor_profile else None
        department = mentor.mentor_profile.department if mentor.mentor_profile else "CCE"
        mentor_info = MentorInfo(
            mentor_id=mentor.id,
            full_name=mentor.full_name,
            email=mentor.email,
            staff_id=staff_id,
            department=department,
        )

    hod_stmt = (
        select(User)
        .join(HodProfile, HodProfile.user_id == User.id)
        .where(
            User.role == UserRole.HOD,
            User.is_active.is_(True),
        )
        .limit(1)
    )
    hod_user = db.scalars(hod_stmt).first()
    hod_info = None
    if hod_user:
        staff_id = hod_user.hod_profile.staff_id if hod_user.hod_profile else None
        department = hod_user.hod_profile.department if hod_user.hod_profile else "CCE"
        hod_info = MentorInfo(
            mentor_id=hod_user.id,
            full_name=hod_user.full_name,
            email=hod_user.email,
            staff_id=staff_id,
            department=department,
        )

    return StudentDetailResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        profile=profile_data,
        assigned_mentor=mentor_info,
        hod_supervisor=hod_info,
    )


@router.patch(
    "/me",
    response_model=StudentDetailResponse,
    summary="Update permitted student profile fields",
    description="Enforces strict field isolation: allows student to update full_name and phone_number. Protected fields (register_number, email, batch, role, etc.) cannot be modified.",
)
def update_student_me(
    payload: StudentProfileUpdateRequest,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudentDetailResponse:
    if payload.full_name is not None:
        trimmed_name = payload.full_name.strip()
        if len(trimmed_name) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name must be at least 2 characters.",
            )
        current_user.full_name = trimmed_name

    if payload.phone_number is not None and current_user.student_profile is not None:
        current_user.student_profile.phone_number = payload.phone_number.strip() or None

    db.add(current_user)
    if current_user.student_profile:
        db.add(current_user.student_profile)
    db.commit()
    db.refresh(current_user)

    return get_student_me(current_user=current_user, db=db)


@router.get(
    "/components",
    response_model=List[PGPAComponentResponse],
    summary="Get official PGPA components catalogue",
    description="Returns all active PGPA components with dynamic field definitions and semester availability.",
)
def get_pgpa_components(
    semester_id: Optional[uuid.UUID] = Query(None, description="Optional semester UUID to filter enabled components"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[PGPAComponentResponse]:
    stmt = (
        select(PGPAComponent)
        .where(PGPAComponent.is_active.is_(True))
        .order_by(PGPAComponent.display_order.asc())
    )
    components = db.scalars(stmt).all()

    configs_map = {}
    semester_name = None
    target_sem_id = semester_id
    if not target_sem_id and current_user.role == UserRole.STUDENT and getattr(current_user, "student_profile", None) and current_user.student_profile.semester:
        sem_str = current_user.student_profile.semester.upper()
        roman_map = {"VIII": 8, "VII": 7, "VI": 6, "IV": 4, "V": 5, "III": 3, "II": 2, "I": 1}
        num = None
        for r, val in roman_map.items():
            if r in sem_str:
                num = val
                break
        if not num:
            import re
            m = re.search(r"\d+", sem_str)
            if m:
                num = int(m.group())
        if num:
            matched_sem = db.scalars(select(Semester).where(Semester.semester_number == num)).first()
            if matched_sem:
                target_sem_id = matched_sem.id

    if target_sem_id:
        sem = db.get(Semester, target_sem_id)
        if sem:
            semester_name = sem.display_name
        configs = db.scalars(
            select(ComponentSemesterConfig).where(ComponentSemesterConfig.semester_id == target_sem_id)
        ).all()
        configs_map = {c.component_id: c.is_enabled for c in configs}

    results = []
    for c in components:
        is_matrix_enabled = configs_map.get(c.id, True) if target_sem_id else True
        is_mode_permitted = c.submission_mode != "hod_excel_import"
        is_enabled = is_matrix_enabled and is_mode_permitted

        lock_reason = None
        if not is_mode_permitted:
            lock_reason = f"{c.name} is configured for HOD Excel import only and does not accept direct student submissions."
        elif not is_matrix_enabled:
            lock_reason = f"This component is currently unavailable for {semester_name or 'the selected semester'}."

        fields = [f.model_dump() for f in get_dynamic_fields_for_component(c.slug)]
        results.append(
            PGPAComponentResponse(
                id=c.id,
                name=c.name,
                slug=c.slug,
                description=c.description,
                semester_label=c.semester_label,
                academic_period=c.academic_period,
                display_order=c.display_order,
                is_active=c.is_active,
                credit_value=c.credit_value,
                submission_mode=c.submission_mode,
                grading_strategy=c.grading_strategy,
                requires_verification=c.requires_verification,
                input_fields=fields,
                pdf_requirement=c.pdf_requirement,
                pdf_required=c.pdf_required,
                allow_other_evidence_types=c.allow_other_evidence_types,
                is_enabled_for_semester=is_enabled,
                lock_reason=lock_reason,
            )
        )
    return results


@router.get(
    "/semesters",
    response_model=List[SemesterResponse],
    summary="Get available academic semesters",
    description="Returns enabled semesters available for new achievement submissions.",
)
def get_available_semesters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SemesterResponse]:
    stmt = (
        select(Semester)
        .where(Semester.is_enabled.is_(True))
        .order_by(Semester.semester_number.asc())
    )
    semesters = db.scalars(stmt).all()
    return [SemesterResponse.model_validate(s) for s in semesters]


@router.get(
    "/me/achievements",
    response_model=List[AchievementResponse],
    summary="List caller's own achievements",
    description="Enforces strict student isolation: returns only achievements submitted by the authenticated student.",
)
def get_my_achievements(
    semester_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(require_student),
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
        .where(Achievement.student_id == current_user.id)
        .order_by(Achievement.created_at.desc())
    )
    if semester_id:
        stmt = stmt.where(Achievement.semester_id == semester_id)
    achievements = db.scalars(stmt).all()
    return [format_achievement_response(a, db=db) for a in achievements]


@router.post(
    "/me/achievements",
    response_model=AchievementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft achievement submission",
    description="Creates an achievement record with status 'draft' belonging to the authenticated student.",
)
def create_achievement(
    data: AchievementCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> AchievementResponse:
    # Verify component exists and is active
    component = db.get(PGPAComponent, data.component_id)
    if not component or not component.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PGPA Component with ID '{data.component_id}' not found or inactive.",
        )

    # Verify component permits student submissions
    if component.submission_mode == "hod_excel_import":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{component.name} is configured for HOD Excel import only and cannot be submitted by students.",
        )

    # Verify semester exists and is enabled
    resolved_semester_id = data.semester_id
    if resolved_semester_id:
        semester = db.get(Semester, resolved_semester_id)
        if not semester:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected academic semester not found.",
            )
        if not semester.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{semester.display_name} is currently closed for submissions.",
            )
    else:
        # Check if an enabled semester is available or default to first enabled
        enabled_semester = db.scalars(
            select(Semester).where(Semester.is_enabled.is_(True)).order_by(Semester.semester_number.asc())
        ).first()
        if not enabled_semester:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Achievement submissions are temporarily unavailable because no semester is open.",
            )
        resolved_semester_id = enabled_semester.id
        semester = enabled_semester

    # Verify component is enabled for the selected semester
    comp_sem_cfg = db.scalars(
        select(ComponentSemesterConfig).where(
            ComponentSemesterConfig.component_id == component.id,
            ComponentSemesterConfig.semester_id == resolved_semester_id,
        )
    ).first()
    if comp_sem_cfg and not comp_sem_cfg.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This component is currently unavailable for {semester.display_name}.",
        )

    # Duplicate prevention for single-submission components like academics-gpa
    if component.slug == "academics-gpa":
        existing_gpa = db.scalars(
            select(Achievement).where(
                Achievement.student_id == current_user.id,
                Achievement.component_id == component.id,
                Achievement.semester_id == resolved_semester_id,
                Achievement.status.in_([AchievementStatus.DRAFT, AchievementStatus.PENDING, AchievementStatus.APPROVED]),
            )
        ).first()
        if existing_gpa:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have an active or approved Academics submission for {semester.display_name}. Please edit or revise that submission instead.",
            )

    meta = dict(data.component_metadata or {})
    title = (data.title or "").strip()
    activity_type = (data.activity_type or "").strip() or None
    organizer = (data.organizer or "").strip() or None
    outcome = (data.outcome or "").strip() or None
    description = (data.description or "").strip() or None
    event_date = data.event_date

    # Component-specific schema handling and authoritative validation:
    if component.slug == "academics-gpa":
        raw_gpa = meta.get("gpa") if meta.get("gpa") is not None else outcome
        if raw_gpa is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Semester GPA value is required for Academics evaluation.",
            )
        try:
            gpa_float = float(raw_gpa)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GPA must be a valid number on the 10.0 scale.",
            )
        if gpa_float < 0.0 or gpa_float > 10.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GPA {gpa_float:.2f} is outside the valid scale [0.00, 10.00].",
            )
        meta["gpa"] = gpa_float
        title = f"Semester {semester.semester_number} GPA: {gpa_float:.2f}"
        outcome = f"{gpa_float:.2f}"
        activity_type = "Semester GPA"

    elif component.slug == "clubs-and-cells":
        role_cat = meta.get("role_category") or activity_type or "Member"
        event_lvl = meta.get("event_level") or ""
        club_name = meta.get("club_name") or organizer or "Club Activity"
        act_title = meta.get("activity_title") or title or f"{club_name} {role_cat}"

        calc_pts = calculate_clubs_and_cells_points(role_cat, event_lvl)
        user_pts = meta.get("points")
        final_pts = float(user_pts) if (user_pts is not None and float(user_pts) > 0) else float(calc_pts)

        meta["club_name"] = club_name
        meta["role_category"] = role_cat
        meta["event_level"] = event_lvl
        meta["points"] = final_pts
        meta["calculated_points"] = final_pts
        meta["activity_title"] = act_title

        title = title or act_title
        activity_type = role_cat
        organizer = club_name
        outcome = f"{final_pts:g} Points ({role_cat})"

    elif component.slug == "skillrack":
        pts = float(meta.get("points") or 0)
        meta["points"] = pts
        title = title or meta.get("milestone_title") or f"Skillrack Milestone ({pts:g} pts)"
        outcome = f"{pts:g} Points"

    elif component.slug == "amcat":
        sc = float(meta.get("score") or 0)
        if sc < 0.0 or sc > 10.0:
            raise HTTPException(status_code=400, detail="AMCAT score must be between 0.0 and 10.0.")
        meta["score"] = sc
        title = title or meta.get("assessment_title") or f"AMCAT Assessment (Score: {sc:g})"
        outcome = f"Score {sc:g} / 10.0"

    elif component.slug == "internship":
        org = meta.get("organizer") or organizer or "Host Organization"
        comp_type = meta.get("company_type") or "Core / with stipend"
        title = title or f"Internship at {org} ({comp_type})"
        organizer = org
        activity_type = comp_type
        outcome = comp_type

    elif not title:
        title = f"{component.name} Achievement"

    achievement = Achievement(
        id=uuid.uuid4(),
        student_id=current_user.id,
        component_id=data.component_id,
        semester_id=resolved_semester_id,
        title=title,
        activity_type=activity_type,
        organizer=organizer,
        event_date=event_date,
        description=description,
        outcome=outcome,
        component_metadata=meta,
        status=AchievementStatus.DRAFT,
    )
    db.add(achievement)
    db.commit()
    db.refresh(achievement)

    return format_achievement_response(achievement, db=db)


@router.get(
    "/me/achievements/{achievement_id}",
    response_model=AchievementResponse,
    summary="Get single achievement detail",
    description="Returns full achievement record including files and verification logs. Enforces ownership isolation.",
)
def get_achievement_detail(
    achievement_id: uuid.UUID,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> AchievementResponse:
    stmt = (
        select(Achievement)
        .options(
            joinedload(Achievement.component),
            joinedload(Achievement.semester),
            joinedload(Achievement.student).joinedload(User.student_profile),
            selectinload(Achievement.files),
            selectinload(Achievement.verification_logs).joinedload(VerificationLog.reviewer),
        )
        .where(Achievement.id == achievement_id)
    )
    achievement = db.scalars(stmt).first()
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    if achievement.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot view achievements belonging to another student.",
        )

    return format_achievement_response(achievement, db=db)


@router.patch(
    "/me/achievements/{achievement_id}",
    response_model=AchievementResponse,
    summary="Update or revise an achievement submission",
    description=(
        "Updates permitted achievement details and remarks. Students can edit draft, rejected, "
        "and submitted (pending review) achievements. If editing an approved achievement, a controlled "
        "revision workflow is initiated: previous approval audit history is preserved and the record is "
        "re-routed to pending review for mentor re-verification."
    ),
)
@router.put(
    "/me/achievements/{achievement_id}",
    response_model=AchievementResponse,
    include_in_schema=False,
)
def update_achievement(
    achievement_id: uuid.UUID,
    data: AchievementUpdate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> AchievementResponse:
    achievement = db.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    if achievement.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot modify achievements belonging to another student.",
        )

    was_approved = achievement.status == AchievementStatus.APPROVED
    was_pending = achievement.status == AchievementStatus.PENDING

    if data.component_metadata is not None:
        merged_meta = dict(achievement.component_metadata or {})
        merged_meta.update(data.component_metadata)
        achievement.component_metadata = merged_meta

        # Sync clubs-and-cells or academics-gpa specific updates
        if achievement.component and achievement.component.slug == "academics-gpa":
            raw_gpa = merged_meta.get("gpa")
            if raw_gpa is not None:
                gpa_val = float(raw_gpa)
                if gpa_val < 0.0 or gpa_val > 10.0:
                    raise HTTPException(status_code=400, detail="GPA must be between 0.0 and 10.0.")
                achievement.outcome = f"{gpa_val:.2f}"
                if achievement.semester:
                    achievement.title = f"Semester {achievement.semester.semester_number} GPA: {gpa_val:.2f}"
        elif achievement.component and achievement.component.slug == "clubs-and-cells":
            rc = merged_meta.get("role_category") or achievement.activity_type or "Member"
            el = merged_meta.get("event_level") or ""
            calc_pts = calculate_clubs_and_cells_points(rc, el)
            merged_meta["points"] = float(calc_pts)
            merged_meta["calculated_points"] = float(calc_pts)
            achievement.outcome = f"{calc_pts:g} Points ({rc})"

    if data.title is not None:
        achievement.title = data.title.strip()
    if data.activity_type is not None:
        achievement.activity_type = data.activity_type.strip() if data.activity_type else None
    if data.organizer is not None:
        achievement.organizer = data.organizer.strip() if data.organizer else None
    if data.semester_id is not None and data.semester_id != achievement.semester_id:
        target_sem = db.get(Semester, data.semester_id)
        if not target_sem or not target_sem.is_enabled:
            sem_name = target_sem.display_name if target_sem else "Target semester"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{sem_name} is currently closed for submissions.",
            )
        cfg = db.scalars(
            select(ComponentSemesterConfig).where(
                ComponentSemesterConfig.component_id == achievement.component_id,
                ComponentSemesterConfig.semester_id == data.semester_id,
            )
        ).first()
        if cfg and not cfg.is_enabled:
            comp_name = achievement.component.name if achievement.component else "This component"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This component is currently unavailable for {target_sem.display_name}.",
            )
        achievement.semester_id = data.semester_id
        achievement.semester = target_sem

    if data.event_date is not None:
        achievement.event_date = data.event_date
    if data.description is not None:
        achievement.description = data.description.strip() if data.description else None
    if data.outcome is not None:
        achievement.outcome = data.outcome.strip() if data.outcome else None

    # Workflow handling:
    now_utc = datetime.now(timezone.utc)
    if was_approved:
        # Controlled revision: previous approval is kept in verification logs; status resets to pending review
        achievement.status = AchievementStatus.PENDING
        achievement.submitted_at = now_utc
        revision_log = VerificationLog(
            id=uuid.uuid4(),
            achievement_id=achievement.id,
            reviewer_id=current_user.id,
            action=ReviewAction.REQUESTED_CHANGES,
            remarks="Student submitted revision after prior approval. Resubmitted for mentor re-verification.",
            created_at=now_utc,
        )
        db.add(revision_log)
    elif was_pending:
        # If edited after submission, mark submitted_at with updated timestamp to reflect in mentor queue
        achievement.submitted_at = now_utc

    db.add(achievement)
    db.commit()
    db.refresh(achievement)

    return format_achievement_response(achievement, db=db)


@router.post(
    "/me/achievements/{achievement_id}/submit",
    response_model=AchievementResponse,
    summary="Submit an achievement for mentor verification",
    description="Transitions achievement status from 'draft' or 'rejected' to 'pending'. Records submitted_at timestamp.",
)
def submit_achievement(
    achievement_id: uuid.UUID,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> AchievementResponse:
    achievement = db.scalars(
        select(Achievement)
        .options(
            joinedload(Achievement.component),
            selectinload(Achievement.files),
        )
        .where(Achievement.id == achievement_id)
    ).first()
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    if achievement.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot submit achievements belonging to another student.",
        )

    if achievement.status not in (AchievementStatus.DRAFT, AchievementStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit achievement with status '{achievement.status.value}'. Must be 'draft' or 'rejected'.",
        )

    # Verify component permits student submissions
    if achievement.component and achievement.component.submission_mode == "hod_excel_import":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{achievement.component.name} is configured for HOD Excel import only and cannot be submitted by students.",
        )

    # Enforce admin-controlled PDF evidence requirement
    if achievement.component:
        pdf_req = achievement.component.pdf_requirement or ("required" if achievement.component.pdf_required else "optional")
        if pdf_req == "required":
            has_pdf = any(
                (f.mime_type == "application/pdf" or (f.original_filename and f.original_filename.lower().endswith(".pdf")))
                for f in achievement.files
            )
            has_evidence = has_pdf or (achievement.component.allow_other_evidence_types and len(achievement.files) > 0)
            if not has_evidence:
                evidence_desc = "evidence" if achievement.component.allow_other_evidence_types else "PDF evidence"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supporting {evidence_desc} is required for {achievement.component.name} submissions. Please upload required documentation before submitting.",
                )

    # Verify semester is open and component is enabled for that semester
    if achievement.semester_id:
        sem = db.get(Semester, achievement.semester_id)
        if not sem or not sem.is_enabled:
            sem_name = sem.display_name if sem else "Selected semester"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{sem_name} is currently closed for submissions.",
            )
        comp_sem_cfg = db.scalars(
            select(ComponentSemesterConfig).where(
                ComponentSemesterConfig.component_id == achievement.component_id,
                ComponentSemesterConfig.semester_id == achievement.semester_id,
            )
        ).first()
        if comp_sem_cfg and not comp_sem_cfg.is_enabled:
            comp_name = achievement.component.name if achievement.component else "This component"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This component is currently unavailable for {sem.display_name}.",
            )

    achievement.status = AchievementStatus.PENDING
    achievement.submitted_at = datetime.now(timezone.utc)
    db.add(achievement)
    db.commit()
    db.refresh(achievement)

    return format_achievement_response(achievement, db=db)


@router.delete(
    "/me/achievements/{achievement_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an achievement submission",
    description="Deletes an achievement submission. Permitted for draft, rejected, and pending submissions. Approved records are protected institutional credits.",
)
def delete_achievement(
    achievement_id: uuid.UUID,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    achievement = db.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    if achievement.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot delete achievements belonging to another student.",
        )

    if achievement.status == AchievementStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete an approved achievement. Approved records are part of verified institutional academic records. If modifications are required, please edit the record to submit a revision for mentor re-verification.",
        )

    db.delete(achievement)
    db.commit()

    return {"detail": "Achievement deleted successfully.", "id": str(achievement_id)}


@router.get(
    "/me/component-results",
    response_model=List[StudentComponentResultItem],
    summary="Get caller's verified and imported component results",
)
def get_my_component_results(
    semester_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> List[StudentComponentResultItem]:
    stmt = (
        select(StudentComponentResult)
        .options(
            joinedload(StudentComponentResult.component),
            joinedload(StudentComponentResult.semester),
        )
        .where(
            StudentComponentResult.student_id == current_user.id,
            StudentComponentResult.is_verified.is_(True),
        )
        .order_by(StudentComponentResult.calculated_at.desc())
    )
    if semester_id:
        stmt = stmt.where(StudentComponentResult.semester_id == semester_id)
    results = db.scalars(stmt).all()
    return [
        StudentComponentResultItem(
            id=r.id,
            student_id=r.student_id,
            student_name=current_user.full_name,
            student_register_number=current_user.student_profile.register_number if current_user.student_profile else None,
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


@router.get(
    "/me/pgpa",
    response_model=StudentPGPAResponse,
    summary="Get caller's overall PGPA score and calculation breakdown for a semester",
)
def get_my_pgpa(
    semester_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudentPGPAResponse:
    if not semester_id:
        # Default to first active semester or Semester 1
        sem = db.scalars(
            select(Semester).order_by(Semester.semester_number.asc())
        ).first()
        if not sem:
            raise HTTPException(status_code=404, detail="No semesters found.")
        target_sem_id = sem.id
    else:
        sem = db.get(Semester, semester_id)
        if not sem:
            raise HTTPException(status_code=404, detail="Semester not found.")
        target_sem_id = sem.id

    # Recalculate to ensure freshest verified data
    record = _recalculate_student_semester_pgpa(db, current_user.id, target_sem_id)
    db.commit()

    results_stmt = (
        select(StudentComponentResult)
        .options(
            joinedload(StudentComponentResult.component),
            joinedload(StudentComponentResult.semester),
        )
        .where(
            StudentComponentResult.student_id == current_user.id,
            StudentComponentResult.semester_id == target_sem_id,
        )
    )
    results = db.scalars(results_stmt).all()

    formatted_results = [
        StudentComponentResultItem(
            id=r.id,
            student_id=r.student_id,
            student_name=current_user.full_name,
            student_register_number=current_user.student_profile.register_number if current_user.student_profile else None,
            component_id=r.component_id,
            component_name=r.component.name if r.component else None,
            component_slug=r.component.slug if r.component else None,
            semester_id=r.semester_id,
            semester_number=sem.semester_number,
            semester_name=sem.display_name,
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

    a1 = record.a1_score if record else 0.0
    gpa = record.gpa if record else None
    pgpa = record.pgpa if record else None
    credits_att = record.total_credits_attempted if record else 0
    credits_earn = record.total_credits_earned if record else 0

    formula_text = (
        f"A1 = Σ(Grade obtained × Credit) / Σ(Credits Attempted) = {a1:.2f}. "
        f"PGPA = (A1 × 0.6) + (GPA × 0.4)"
        + (f" = ({a1:.2f} × 0.6) + ({gpa:.2f} × 0.4) = {pgpa:.2f}" if (pgpa is not None and gpa is not None) else " (Awaiting Semester GPA)")
    )

    return StudentPGPAResponse(
        student_id=current_user.id,
        student_name=current_user.full_name,
        register_number=current_user.student_profile.register_number if current_user.student_profile else "N/A",
        semester_id=sem.id,
        semester_number=sem.semester_number,
        semester_name=sem.display_name,
        a1_score=a1,
        semester_gpa=gpa,
        pgpa=pgpa,
        total_credits_attempted=credits_att,
        total_credits_earned=credits_earn,
        calculated_at=record.calculated_at if record else datetime.now(timezone.utc),
        results=formatted_results,
        formula_explanation=formula_text,
    )
