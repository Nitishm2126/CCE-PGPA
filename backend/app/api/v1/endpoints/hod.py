import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.permissions import require_hod
from app.db.session import get_db
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
from app.models.review import ReviewAction, VerificationLog
from app.models.user import StudentProfile, User, UserRole
from app.schemas.achievement import AchievementResponse, ReviewSubmissionRequest
from app.schemas.auth import HODStudentItem
from app.api.v1.endpoints.students import format_achievement_response

router = APIRouter()


@router.get(
    "/students",
    response_model=List[HODStudentItem],
    summary="Get cohort-wide student directory for HOD",
    description="Authorized HOD endpoint to inspect all department students and their active mentor assignments.",
)
def get_department_students(
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[HODStudentItem]:
    stmt = (
        select(User)
        .where(User.role == UserRole.STUDENT)
        .order_by(User.full_name.asc())
    )
    students = db.scalars(stmt).all()

    active_assignments_stmt = (
        select(MentorAssignment)
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
    current_user: User = Depends(require_hod),
    db: Session = Depends(get_db),
) -> List[AchievementResponse]:
    stmt = (
        select(Achievement)
        .join(User, Achievement.student_id == User.id)
        .outerjoin(StudentProfile, User.id == StudentProfile.user_id)
        .where(User.role == UserRole.STUDENT)
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
