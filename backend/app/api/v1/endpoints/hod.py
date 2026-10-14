from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import require_hod
from app.db.session import get_db
from app.models.assignment import MentorAssignment
from app.models.user import User, UserRole
from app.schemas.auth import HODStudentItem

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
    # Query all students in the cohort
    stmt = (
        select(User)
        .where(User.role == UserRole.STUDENT)
        .order_by(User.full_name.asc())
    )
    students = db.scalars(stmt).all()

    # Query all active mentor assignments for fast mapping
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
