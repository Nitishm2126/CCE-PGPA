from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import require_student
from app.db.session import get_db
from app.models.assignment import MentorAssignment
from app.models.user import User
from app.schemas.auth import MentorInfo, StudentDetailResponse, StudentProfileResponse

router = APIRouter()


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
    # Build student profile response
    profile_data = None
    if current_user.student_profile is not None:
        profile_data = StudentProfileResponse.model_validate(current_user.student_profile)

    # Find active mentor assignment
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

    return StudentDetailResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        profile=profile_data,
        assigned_mentor=mentor_info,
    )
