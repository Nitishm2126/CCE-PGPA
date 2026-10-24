from datetime import datetime, timezone
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.permissions import require_mentor
from app.db.session import get_db
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.grading import StudentComponentResult
from app.models.review import ReviewAction, VerificationLog
from app.models.user import StudentProfile, User
from app.schemas.achievement import AchievementResponse, ReviewSubmissionRequest
from app.schemas.auth import MentorStudentItem
from app.services.component_service import _recalculate_student_semester_pgpa
from app.services.grading_engine import calculate_component_grade
from app.api.v1.endpoints.students import format_achievement_response

router = APIRouter()


def ensure_mentor_assignments(db: Session, mentor: User) -> int:
    """
    Authoritative reconciliation helper:
    Ensures students whose StudentProfile.original_mentor_name matches this mentor
    have an active MentorAssignment in PostgreSQL.

    This safely reconciles the bootstrap roster deferral, where students were loaded
    with original_mentor_name before mentor accounts were provisioned.

    Safety constraints:
    - Never reassigns students who already have an active mentor assignment (strict 1-to-1).
    - Matches mentor by full_name or tokenized name components.
    - Preserves mentor isolation and relational database integrity.
    """
    mentor_name_clean = mentor.full_name.strip()
    mentor_tokens = [t.lower() for t in mentor_name_clean.replace(".", " ").split() if len(t) > 1]

    active_assigned_subquery = select(MentorAssignment.student_id).where(
        MentorAssignment.is_active.is_(True)
    )

    unassigned_count = db.scalar(
        select(func.count(StudentProfile.id)).where(
            StudentProfile.user_id.not_in(active_assigned_subquery),
            StudentProfile.original_mentor_name.is_not(None),
        )
    )
    if not unassigned_count:
        return 0

    unassigned_profiles = db.scalars(
        select(StudentProfile).where(
            StudentProfile.user_id.not_in(active_assigned_subquery),
            StudentProfile.original_mentor_name.is_not(None),
        )
    ).all()

    added = 0
    now = datetime.now(timezone.utc)
    for prof in unassigned_profiles:
        orig = (prof.original_mentor_name or "").strip().lower()
        if not orig:
            continue
        orig_tokens = [t for t in orig.replace(".", " ").split() if len(t) > 1]

        # Match exact string or substantial name token (e.g. 'P. LEKHA' <-> 'lekha')
        is_match = (
            orig == mentor_name_clean.lower()
            or any(t in orig_tokens for t in mentor_tokens if len(t) > 2)
            or (mentor_tokens and all(t in orig_tokens for t in mentor_tokens))
        )
        if is_match:
            new_assign = MentorAssignment(
                id=uuid.uuid4(),
                mentor_id=mentor.id,
                student_id=prof.user_id,
                assigned_by=None,
                assigned_at=now,
                is_active=True,
            )
            db.add(new_assign)
            added += 1

    if added > 0:
        db.commit()

    return added


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
    # Reconcile any unassigned cohort students mapped to this mentor
    ensure_mentor_assignments(db, current_user)

    stmt = (
        select(MentorAssignment)
        .options(
            joinedload(MentorAssignment.student).joinedload(User.student_profile)
        )
        .where(
            MentorAssignment.mentor_id == current_user.id,
            MentorAssignment.is_active.is_(True),
        )
        .order_by(MentorAssignment.assigned_at.desc())
    )
    assignments = db.scalars(stmt).all()

    # Pre-fetch submission counts for these mentees
    student_ids = [a.student_id for a in assignments]
    counts_map: dict[uuid.UUID, int] = {}
    if student_ids:
        counts_stmt = (
            select(Achievement.student_id, func.count(Achievement.id))
            .where(
                Achievement.student_id.in_(student_ids),
                Achievement.status != AchievementStatus.DRAFT,
            )
            .group_by(Achievement.student_id)
        )
        counts_map = dict(db.execute(counts_stmt).all())

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
                submission_count=counts_map.get(student.id, 0),
            )
        )

    return results


@router.get(
    "/submissions",
    response_model=List[AchievementResponse],
    summary="Get submissions for assigned mentees (view-only faculty access)",
    description=(
        "Enforces strict mentor isolation: returns ONLY submissions from students "
        "actively assigned to this faculty mentor. By default returns all submitted "
        "activities without requiring an approval action."
    ),
)
def get_mentee_submissions(
    status_filter: Optional[AchievementStatus] = Query(
        default=None,
        alias="status",
        description="Optional filter by status (e.g. 'pending', 'approved', 'rejected'). If omitted, returns all non-draft submissions.",
    ),
    current_user: User = Depends(require_mentor),
    db: Session = Depends(get_db),
) -> List[AchievementResponse]:
    ensure_mentor_assignments(db, current_user)

    # 1. Get assigned mentee IDs
    mentee_ids_stmt = select(MentorAssignment.student_id).where(
        MentorAssignment.mentor_id == current_user.id,
        MentorAssignment.is_active.is_(True),
    )
    mentee_ids = db.scalars(mentee_ids_stmt).all()

    if not mentee_ids:
        return []

    # 2. Query achievements for those mentees
    stmt = (
        select(Achievement)
        .options(
            joinedload(Achievement.component),
            joinedload(Achievement.semester),
            joinedload(Achievement.student).joinedload(User.student_profile),
            selectinload(Achievement.files),
            selectinload(Achievement.verification_logs).joinedload(VerificationLog.reviewer),
        )
        .where(
            Achievement.student_id.in_(mentee_ids)
        )
    )
    if status_filter:
        stmt = stmt.where(Achievement.status == status_filter)
    else:
        # Show all submitted activities (exclude drafts)
        stmt = stmt.where(Achievement.status != AchievementStatus.DRAFT)

    stmt = stmt.order_by(Achievement.submitted_at.desc(), Achievement.created_at.desc())
    achievements = db.scalars(stmt).all()

    return [format_achievement_response(a) for a in achievements]


@router.get(
    "/achievements/{achievement_id}",
    response_model=AchievementResponse,
    summary="Inspect an assigned mentee's achievement submission",
    description="Returns detailed submission data with evidence files. Enforces mentor assignment.",
)
def get_mentee_achievement(
    achievement_id: uuid.UUID,
    current_user: User = Depends(require_mentor),
    db: Session = Depends(get_db),
) -> AchievementResponse:
    ensure_mentor_assignments(db, current_user)

    achievement_stmt = (
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
    achievement = db.scalars(achievement_stmt).first()
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    # Check assignment
    is_assigned = db.scalar(
        select(MentorAssignment).where(
            MentorAssignment.mentor_id == current_user.id,
            MentorAssignment.student_id == achievement.student_id,
            MentorAssignment.is_active.is_(True),
        )
    )
    if not is_assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: This student is not assigned to you.",
        )

    return format_achievement_response(achievement)


@router.post(
    "/achievements/{achievement_id}/review",
    response_model=AchievementResponse,
    summary="Review an assigned mentee's achievement submission",
    description="Approves, rejects, or requests changes. Records decisions in verification_logs.",
)
def review_mentee_achievement(
    achievement_id: uuid.UUID,
    review_data: ReviewSubmissionRequest,
    current_user: User = Depends(require_mentor),
    db: Session = Depends(get_db),
) -> AchievementResponse:
    ensure_mentor_assignments(db, current_user)

    achievement = db.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    # Verify mentor assignment
    is_assigned = db.scalar(
        select(MentorAssignment).where(
            MentorAssignment.mentor_id == current_user.id,
            MentorAssignment.student_id == achievement.student_id,
            MentorAssignment.is_active.is_(True),
        )
    )
    if not is_assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot review achievements of a student not assigned to you.",
        )

    if achievement.status != AchievementStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot review achievement in '{achievement.status.value}' status. Must be 'pending'.",
        )

    # Update achievement status
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
                print(f"Warning: Auto-grading error on mentor approval: {e}")
    elif review_data.action == ReviewAction.REJECTED:
        achievement.status = AchievementStatus.REJECTED
    elif review_data.action == ReviewAction.REQUESTED_CHANGES:
        achievement.status = AchievementStatus.DRAFT

    # Append immutable verification log
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
