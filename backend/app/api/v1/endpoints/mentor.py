from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import require_mentor
from app.db.session import get_db
from app.models.assignment import MentorAssignment
from app.models.user import User
from app.schemas.auth import MentorStudentItem

router = APIRouter()


@router.get(
    "/students",
    response_model=List[MentorStudentItem],
    summary="Get assigned students for current mentor",
    description=(
        "Enforces strict mentor isolation: returns ONLY students actively assigned to "
        "the authenticated mentor via active mentor_assignments. Mentors cannot inspect "
        "students assigned to other faculty mentors."
    ),
)
def get_assigned_students(
    current_user: User = Depends(require_mentor),
    db: Session = Depends(get_db),
) -> List[MentorStudentItem]:
    stmt = (
        select(MentorAssignment)
        .where(
            MentorAssignment.mentor_id == current_user.id,
            MentorAssignment.is_active.is_(True),
        )
        .order_by(MentorAssignment.assigned_at.desc())
    )
    assignments = db.scalars(stmt).all()

    results: List[MentorStudentItem] = []
    for assignment in assignments:
        student = assignment.student
        if not student:
            continue

        profile = student.student_profile
        results.append(
            MentorStudentItem(
                student_id=student.id,
                full_name=student.full_name,
                email=student.email,
                register_number=profile.register_number if profile else None,
                department=profile.department if profile else "CCE",
                year=profile.year if profile else 2,
                section=profile.section if profile else None,
                assignment_id=assignment.id,
                assigned_at=assignment.assigned_at,
            )
        )

    return results
