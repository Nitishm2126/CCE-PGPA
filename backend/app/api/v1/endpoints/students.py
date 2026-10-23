import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import require_student
from app.db.session import get_db
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
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
from app.schemas.semester import SemesterResponse
from app.schemas.auth import (
    MentorInfo,
    StudentDetailResponse,
    StudentProfileResponse,
    StudentProfileUpdateRequest,
)
from app.schemas.file import AchievementFileResponse
from app.schemas.semester import SemesterResponse

router = APIRouter()


def format_achievement_response(achievement: Achievement) -> AchievementResponse:
    """Format SQLAlchemy Achievement model into AchievementResponse."""
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
    description="Returns all active PGPA components defined in PostgreSQL.",
)
def get_pgpa_components(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> List[PGPAComponentResponse]:
    stmt = (
        select(PGPAComponent)
        .where(PGPAComponent.is_active.is_(True))
        .order_by(PGPAComponent.display_order.asc())
    )
    components = db.scalars(stmt).all()
    return [PGPAComponentResponse.model_validate(c) for c in components]


@router.get(
    "/semesters",
    response_model=List[SemesterResponse],
    summary="Get available academic semesters",
    description="Returns enabled semesters available for new achievement submissions.",
)
def get_available_semesters(
    current_user: User = Depends(require_student),
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
        .where(Achievement.student_id == current_user.id)
        .order_by(Achievement.created_at.desc())
    )
    if semester_id:
        stmt = stmt.where(Achievement.semester_id == semester_id)
    achievements = db.scalars(stmt).all()
    return [format_achievement_response(a) for a in achievements]


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

    achievement = Achievement(
        id=uuid.uuid4(),
        student_id=current_user.id,
        component_id=data.component_id,
        semester_id=resolved_semester_id,
        title=data.title.strip(),
        activity_type=data.activity_type.strip() if data.activity_type else None,
        organizer=data.organizer.strip() if data.organizer else None,
        event_date=data.event_date,
        description=data.description.strip() if data.description else None,
        outcome=data.outcome.strip() if data.outcome else None,
        status=AchievementStatus.DRAFT,
    )
    db.add(achievement)
    db.commit()
    db.refresh(achievement)

    return format_achievement_response(achievement)


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
    achievement = db.get(Achievement, achievement_id)
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

    return format_achievement_response(achievement)


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

    if data.title is not None:
        achievement.title = data.title.strip()
    if data.activity_type is not None:
        achievement.activity_type = data.activity_type.strip() if data.activity_type else None
    if data.organizer is not None:
        achievement.organizer = data.organizer.strip() if data.organizer else None
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

    return format_achievement_response(achievement)


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
    achievement = db.get(Achievement, achievement_id)
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

    achievement.status = AchievementStatus.PENDING
    achievement.submitted_at = datetime.now(timezone.utc)
    db.add(achievement)
    db.commit()
    db.refresh(achievement)

    return format_achievement_response(achievement)


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
