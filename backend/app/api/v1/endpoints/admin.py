import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Union

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.permissions import get_current_user, http_bearer, require_admin
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import ComponentSemesterConfig, PGPAComponent
from app.models.file import AchievementFile
from app.models.review import VerificationLog
from app.models.semester import Semester
from app.models.semester_folder import StudentSemesterFolder
from app.models.user import HodProfile, MentorProfile, StudentProfile, User, UserRole
from app.schemas.component_config import (
    ComponentDetailItem,
    ComponentSemesterConfigItem,
    ComponentSemesterConfigUpdate,
    ComponentUpdatePayload,
)
from app.schemas.admin import (
    AdminComponentItem,
    AdminEmailUpdateRequest,
    AdminEmailUpdateResponse,
    AdminSendVerificationEmailResponse,
    AdminVerificationStatusResponse,
    AdminHODCreate,
    AdminHODDeleteRequest,
    AdminHODItem,
    AdminHODUpdate,
    AdminMentorAllocationItem,
    AdminMentorAssignedStudent,
    AdminMentorCreate,
    AdminMentorDeleteRequest,
    AdminMentorDetailResponse,
    AdminMentorItem,
    AdminMentorReassignRequest,
    AdminMentorUpdate,
    AdminOperationResult,
    AdminOverviewResponse,
    AdminRecentSubmissionItem,
    AdminResetStudentPasswordRequest,
    AdminResetStudentPasswordResponse,
    AdminResetUserPasswordRequest,
    AdminResetUserPasswordResponse,
    AdminStatusUpdateRequest,
    AdminStudentCreate,
    AdminStudentDeleteRequest,
    AdminStudentDetailResponse,
    AdminStudentItem,
    AdminStudentUpdate,
    AdminSubmissionItem,
    AdminUserItem,
    DriveFolderAuditItem,
    DriveFolderAuditReport,
    DriveFolderProvisionResponse,
    ProvisioningExecuteRequest,
    ProvisioningExecuteResponse,
    ProvisioningPreviewResponse,
    RosterImportRequest,
    RosterImportResponse,
)
from app.schemas.semester import (
    SemesterDriveAuditReport,
    SemesterDriveProvisionResponse,
    SemesterResponse,
    SemesterUpdate,
)
from app.services.drive_provisioning import (
    audit_student_drive_folders,
    audit_student_semester_folders,
    provision_student_drive_folders,
    provision_student_semester_folders,
)
from app.schemas.auth import MentorInfo
from app.services.admin_service import (
    deactivate_student_account,
    delete_hod_account,
    delete_mentor_account,
    delete_student_login_access,
    execute_bulk_provisioning,
    get_provisioning_preview,
    get_user_verification_status_by_admin,
    import_roster_data,
    permanently_delete_student,
    reassign_mentor_students,
    record_audit_log,
    send_user_verification_email_by_admin,
    update_user_email_by_admin,
)
from app.services.drive_service import get_drive_service
from app.services.firebase_service import (
    generate_firebase_password_reset_link,
    sync_create_firebase_user,
    sync_set_firebase_disabled,
    sync_update_firebase_user,
)

router = APIRouter()


# ==============================================================================
# Overview & User Provisioning Summary
# ==============================================================================

@router.get(
    "/overview",
    response_model=AdminOverviewResponse,
    summary="Get system-wide administrative metrics",
    description="Enforces strict system administration isolation: only authenticated ADMIN users can access governance statistics.",
)
def get_admin_overview(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOverviewResponse:
    users = db.scalars(select(User)).all()
    total_users = len(users)

    role_counts = {"admin": 0, "hod": 0, "mentor": 0, "student": 0}
    active_count = 0
    firebase_linked = 0

    for u in users:
        role_key = u.role.value
        role_counts[role_key] = role_counts.get(role_key, 0) + 1
        if u.is_active:
            active_count += 1
        if u.firebase_uid:
            firebase_linked += 1

    inactive_count = total_users - active_count
    unlinked = total_users - firebase_linked

    total_students = db.scalars(select(func.count(StudentProfile.id))).one()
    total_mentors = db.scalars(select(func.count(MentorProfile.id))).one()
    total_hods = db.scalars(select(func.count(HodProfile.id))).one()
    total_assignments = db.scalars(select(func.count(MentorAssignment.id))).one()
    # Align student role count with official roster count
    role_counts["student"] = total_students

    # Data-driven submissions and activities metrics
    pending_submissions = db.scalars(
        select(func.count(Achievement.id)).where(Achievement.status == AchievementStatus.PENDING)
    ).one()
    recorded_activities = db.scalars(
        select(func.count(Achievement.id))
    ).one()
    approved_submissions = db.scalars(
        select(func.count(Achievement.id)).where(Achievement.status == AchievementStatus.APPROVED)
    ).one()
    rejected_submissions = db.scalars(
        select(func.count(Achievement.id)).where(Achievement.status == AchievementStatus.REJECTED)
    ).one()

    # Recent submissions with real student and component names
    recent_stmt = (
        select(Achievement)
        .order_by(Achievement.created_at.desc())
        .limit(8)
    )
    recent_achievements = db.scalars(recent_stmt).all()

    recent_submissions = []
    for a in recent_achievements:
        student_user = db.scalar(select(User).where(User.id == a.student_id))
        student_prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == a.student_id))
        comp = db.scalar(select(PGPAComponent).where(PGPAComponent.id == a.component_id))
        sub_time = a.submitted_at or a.created_at

        recent_submissions.append(
            AdminRecentSubmissionItem(
                id=str(a.id),
                title=a.title,
                status=a.status.value,
                activity_type=a.activity_type,
                student_name=student_user.full_name if student_user else "Student",
                register_number=student_prof.register_number if student_prof else "—",
                component_name=comp.name if comp else "General",
                submitted_at=sub_time.isoformat() if sub_time else None,
            )
        )

    return AdminOverviewResponse(
        total_users=total_users,
        users_by_role=role_counts,
        active_users=active_count,
        inactive_users=inactive_count,
        firebase_linked_users=firebase_linked,
        unlinked_users=unlinked,
        total_student_profiles=total_students,
        total_mentor_profiles=total_mentors,
        total_hod_profiles=total_hods,
        total_mentor_assignments=total_assignments,
        system_status="operational",
        total_students=total_students,
        total_mentors=total_mentors,
        total_hods=total_hods,
        active_accounts=active_count,
        pending_submissions=pending_submissions,
        recorded_activities=recorded_activities,
        approved_submissions=approved_submissions,
        rejected_submissions=rejected_submissions,
        recent_submissions=recent_submissions,
    )


@router.get(
    "/submissions",
    response_model=List[AdminSubmissionItem],
    summary="List student submissions for administrator oversight",
    description="Allows administrators to audit all PGPA submissions across departments.",
)
def list_admin_submissions(
    status: Optional[str] = Query(default=None, description="Filter by status (pending, approved, rejected, draft)"),
    search: Optional[str] = Query(default=None, description="Search across title, student name, or register number"),
    component_id: Optional[uuid.UUID] = Query(default=None, description="Filter by component ID"),
    semester_id: Optional[Union[uuid.UUID, int, str]] = Query(default=None, description="Filter by semester ID (UUID) or number (1-8)"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminSubmissionItem]:
    stmt = (
        select(Achievement)
        .options(
            joinedload(Achievement.student).joinedload(User.student_profile),
            joinedload(Achievement.component),
            joinedload(Achievement.semester),
        )
        .order_by(Achievement.created_at.desc())
    )

    if status and status != "all":
        stmt = stmt.where(Achievement.status == status)
    if component_id:
        stmt = stmt.where(Achievement.component_id == component_id)
    if semester_id is not None:
        try:
            val_uuid = uuid.UUID(str(semester_id))
            stmt = stmt.where(Achievement.semester_id == val_uuid)
        except (ValueError, AttributeError):
            try:
                sem_num = int(str(semester_id))
                stmt = stmt.join(Semester, Achievement.semester_id == Semester.id).where(Semester.semester_number == sem_num)
            except ValueError:
                pass

    achievements = db.scalars(stmt).all()

    # Pre-fetch file counts
    file_counts = dict(
        db.execute(
            select(AchievementFile.achievement_id, func.count(AchievementFile.id))
            .group_by(AchievementFile.achievement_id)
        ).all()
    )

    results = []
    for a in achievements:
        student_user = a.student
        student_prof = student_user.student_profile if student_user else None
        comp = a.component

        s_name = student_user.full_name if student_user else "Student"
        s_email = student_user.email if student_user else ""
        s_reg = student_prof.register_number if student_prof else "—"

        if search:
            q = search.lower()
            if q not in a.title.lower() and q not in s_name.lower() and q not in s_reg.lower():
                continue

        semester_obj = a.semester
        semester_num = semester_obj.semester_number if semester_obj else None
        semester_display = semester_obj.display_name if semester_obj else None

        results.append(
            AdminSubmissionItem(
                id=a.id,
                student_id=a.student_id,
                student_name=s_name,
                student_email=s_email,
                register_number=s_reg,
                component_id=a.component_id,
                component_name=comp.name if comp else "General",
                title=a.title,
                activity_type=a.activity_type,
                organizer=a.organizer,
                event_date=str(a.event_date) if a.event_date else None,
                description=a.description,
                outcome=a.outcome,
                status=a.status.value,
                files_count=file_counts.get(a.id, 0),
                semester_id=a.semester_id,
                semester_number=semester_num,
                semester_name=semester_display,
                submitted_at=a.submitted_at,
                created_at=a.created_at,
            )
        )

    return results


@router.get(
    "/allocations",
    response_model=List[AdminMentorAllocationItem],
    summary="List mentor-student allocations",
    description="Returns all active and past mentor allocations across students.",
)
def list_mentor_allocations(
    search: Optional[str] = Query(default=None, description="Search across student name, reg no, or mentor name"),
    mentor_id: Optional[uuid.UUID] = Query(default=None, description="Filter by mentor ID"),
    is_active: Optional[bool] = Query(default=None, description="Filter active assignments"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminMentorAllocationItem]:
    stmt = select(MentorAssignment).order_by(MentorAssignment.assigned_at.desc())

    if mentor_id:
        stmt = stmt.where(MentorAssignment.mentor_id == mentor_id)
    if is_active is not None:
        stmt = stmt.where(MentorAssignment.is_active == is_active)

    assignments = db.scalars(stmt).all()

    results = []
    for asgn in assignments:
        student_user = db.scalar(select(User).where(User.id == asgn.student_id))
        student_prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == asgn.student_id))
        mentor_user = db.scalar(select(User).where(User.id == asgn.mentor_id))

        s_name = student_user.full_name if student_user else "Student"
        s_email = student_user.email if student_user else ""
        s_reg = student_prof.register_number if student_prof else "—"
        m_name = mentor_user.full_name if mentor_user else "Mentor"
        m_email = mentor_user.email if mentor_user else ""

        if search:
            q = search.lower()
            if q not in s_name.lower() and q not in s_reg.lower() and q not in m_name.lower():
                continue

        results.append(
            AdminMentorAllocationItem(
                id=asgn.id,
                student_id=asgn.student_id,
                student_name=s_name,
                student_email=s_email,
                register_number=s_reg,
                section=student_prof.section if student_prof else None,
                batch=student_prof.batch if student_prof else None,
                mentor_id=asgn.mentor_id,
                mentor_name=m_name,
                mentor_email=m_email,
                assigned_at=asgn.assigned_at,
                is_active=asgn.is_active,
            )
        )

    return results


@router.get(
    "/components",
    response_model=List[AdminComponentItem],
    summary="List PGPA components catalogue with submission metrics",
    description="Returns all 14 official PGPA components with counts of submissions and configuration details.",
)
def list_admin_components(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminComponentItem]:
    components = db.scalars(
        select(PGPAComponent).order_by(PGPAComponent.display_order, PGPAComponent.name)
    ).all()

    # Pre-fetch counts
    total_counts = dict(
        db.execute(
            select(Achievement.component_id, func.count(Achievement.id))
            .group_by(Achievement.component_id)
        ).all()
    )
    pending_counts = dict(
        db.execute(
            select(Achievement.component_id, func.count(Achievement.id))
            .where(Achievement.status == AchievementStatus.PENDING)
            .group_by(Achievement.component_id)
        ).all()
    )

    results = []
    for c in components:
        results.append(
            AdminComponentItem(
                id=c.id,
                name=c.name,
                slug=c.slug,
                description=c.description,
                display_order=c.display_order,
                is_active=c.is_active,
                credit_value=c.credit_value,
                submission_mode=c.submission_mode,
                grading_strategy=c.grading_strategy,
                requires_verification=c.requires_verification,
                rule_version=c.rule_version,
                pdf_requirement=c.pdf_requirement,
                pdf_required=c.pdf_required,
                allow_other_evidence_types=c.allow_other_evidence_types,
                total_submissions=total_counts.get(c.id, 0),
                pending_submissions=pending_counts.get(c.id, 0),
            )
        )

    return results


@router.patch(
    "/components/{component_id}",
    response_model=AdminComponentItem,
    summary="Update PGPA component configuration",
    description="Allows System Admin to update component credits, submission mode, grading rules, active status, etc.",
)
def update_admin_component(
    component_id: uuid.UUID,
    payload: ComponentUpdatePayload,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminComponentItem:
    component = db.get(PGPAComponent, component_id)
    if not component:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PGPA Component with ID '{component_id}' not found.",
        )

    prev_state = {
        "name": component.name,
        "is_active": component.is_active,
        "credit_value": component.credit_value,
        "submission_mode": component.submission_mode,
        "grading_strategy": component.grading_strategy,
        "pdf_requirement": component.pdf_requirement,
        "allow_other_evidence_types": component.allow_other_evidence_types,
    }

    if payload.name is not None:
        component.name = payload.name.strip()
    if payload.description is not None:
        component.description = payload.description.strip() or None
    if payload.credit_value is not None:
        component.credit_value = payload.credit_value
    if payload.submission_mode is not None:
        component.submission_mode = payload.submission_mode
    if payload.grading_strategy is not None:
        component.grading_strategy = payload.grading_strategy
    if payload.requires_verification is not None:
        component.requires_verification = payload.requires_verification
    if payload.is_active is not None:
        component.is_active = payload.is_active
    if payload.display_order is not None:
        component.display_order = payload.display_order
    if payload.pdf_requirement is not None:
        component.pdf_requirement = payload.pdf_requirement
    elif payload.pdf_required is not None:
        component.pdf_required = payload.pdf_required
    if payload.allow_other_evidence_types is not None:
        component.allow_other_evidence_types = payload.allow_other_evidence_types

    component.rule_version += 1
    component.updated_at = datetime.now(timezone.utc)
    db.add(component)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_pgpa_component_config",
        target_type="pgpa_component",
        target_id=str(component.id),
        metadata={
            "previous_state": prev_state,
            "new_state": {
                "name": component.name,
                "is_active": component.is_active,
                "credit_value": component.credit_value,
                "submission_mode": component.submission_mode,
                "grading_strategy": component.grading_strategy,
                "pdf_requirement": component.pdf_requirement,
                "allow_other_evidence_types": component.allow_other_evidence_types,
                "rule_version": component.rule_version,
            },
        },
    )
    db.commit()
    db.refresh(component)

    total_subs = db.scalar(select(func.count(Achievement.id)).where(Achievement.component_id == component.id)) or 0
    pending_subs = db.scalar(
        select(func.count(Achievement.id)).where(
            Achievement.component_id == component.id,
            Achievement.status == AchievementStatus.PENDING,
        )
    ) or 0

    return AdminComponentItem(
        id=component.id,
        name=component.name,
        slug=component.slug,
        description=component.description,
        display_order=component.display_order,
        is_active=component.is_active,
        credit_value=component.credit_value,
        submission_mode=component.submission_mode,
        grading_strategy=component.grading_strategy,
        requires_verification=component.requires_verification,
        rule_version=component.rule_version,
        pdf_requirement=component.pdf_requirement,
        pdf_required=component.pdf_required,
        allow_other_evidence_types=component.allow_other_evidence_types,
        total_submissions=total_subs,
        pending_submissions=pending_subs,
    )


@router.get(
    "/components/{component_id}/semesters",
    response_model=List[ComponentSemesterConfigItem],
    summary="Get component semester availability matrix",
    description="Returns enabled status and deadlines for a component across all semesters.",
)
def get_component_semester_configs(
    component_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[ComponentSemesterConfigItem]:
    component = db.get(PGPAComponent, component_id)
    if not component:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PGPA Component with ID '{component_id}' not found.",
        )

    stmt = (
        select(ComponentSemesterConfig)
        .options(joinedload(ComponentSemesterConfig.semester))
        .where(ComponentSemesterConfig.component_id == component_id)
        .join(Semester)
        .order_by(Semester.semester_number.asc())
    )
    configs = db.scalars(stmt).all()

    return [
        ComponentSemesterConfigItem(
            id=cfg.id,
            component_id=cfg.component_id,
            component_name=component.name,
            semester_id=cfg.semester_id,
            semester_number=cfg.semester.semester_number if cfg.semester else None,
            semester_display_name=cfg.semester.display_name if cfg.semester else None,
            is_enabled=cfg.is_enabled,
            submission_deadline=cfg.submission_deadline,
        )
        for cfg in configs
    ]


@router.patch(
    "/components/{component_id}/semesters/{semester_id}",
    response_model=ComponentSemesterConfigItem,
    summary="Update component availability for a specific semester",
    description="Enables or disables a component for achievement submissions in a specific semester.",
)
def update_component_semester_config(
    component_id: uuid.UUID,
    semester_id: uuid.UUID,
    payload: ComponentSemesterConfigUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ComponentSemesterConfigItem:
    stmt = (
        select(ComponentSemesterConfig)
        .options(
            joinedload(ComponentSemesterConfig.component),
            joinedload(ComponentSemesterConfig.semester),
        )
        .where(
            ComponentSemesterConfig.component_id == component_id,
            ComponentSemesterConfig.semester_id == semester_id,
        )
    )
    config = db.scalars(stmt).first()
    if not config:
        # Create config if it doesn't exist
        config = ComponentSemesterConfig(
            id=uuid.uuid4(),
            component_id=component_id,
            semester_id=semester_id,
            is_enabled=payload.is_enabled,
            submission_deadline=payload.submission_deadline,
        )
        db.add(config)
    else:
        config.is_enabled = payload.is_enabled
        if payload.submission_deadline is not None:
            config.submission_deadline = payload.submission_deadline
        db.add(config)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_component_semester_config",
        target_type="component_semester_config",
        target_id=str(config.id),
        metadata={
            "component_id": str(component_id),
            "semester_id": str(semester_id),
            "is_enabled": config.is_enabled,
            "submission_deadline": config.submission_deadline.isoformat() if config.submission_deadline else None,
        },
    )
    db.commit()
    db.refresh(config)

    return ComponentSemesterConfigItem(
        id=config.id,
        component_id=config.component_id,
        component_name=config.component.name if config.component else None,
        semester_id=config.semester_id,
        semester_number=config.semester.semester_number if config.semester else None,
        semester_display_name=config.semester.display_name if config.semester else None,
        is_enabled=config.is_enabled,
        submission_deadline=config.submission_deadline,
    )


@router.get(
    "/components/semester-matrix",
    summary="Get full component availability matrix across all semesters",
    description="Returns all 14 components and their enabled status for Semesters 1 through 8.",
)
def get_components_semester_matrix(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    components = db.scalars(select(PGPAComponent).order_by(PGPAComponent.display_order.asc())).all()
    semesters = db.scalars(select(Semester).order_by(Semester.semester_number.asc())).all()
    configs = db.scalars(select(ComponentSemesterConfig)).all()

    # Build lookup map: (comp_id, sem_id) -> is_enabled
    config_map = {(c.component_id, c.semester_id): c.is_enabled for c in configs}

    matrix = []
    for comp in components:
        sem_status = {}
        for sem in semesters:
            sem_status[sem.semester_number] = config_map.get((comp.id, sem.id), True)
        matrix.append({
            "component_id": str(comp.id),
            "name": comp.name,
            "slug": comp.slug,
            "credit_value": comp.credit_value,
            "submission_mode": comp.submission_mode,
            "grading_strategy": comp.grading_strategy,
            "requires_verification": comp.requires_verification,
            "is_active": comp.is_active,
            "pdf_requirement": comp.pdf_requirement,
            "pdf_required": comp.pdf_required,
            "allow_other_evidence_types": comp.allow_other_evidence_types,
            "semesters": sem_status,
        })

    return {
        "semesters": [{"id": str(s.id), "number": s.semester_number, "name": s.display_name, "is_enabled": s.is_enabled} for s in semesters],
        "components": matrix,
    }


@router.get(
    "/provisioning/preview",
    response_model=ProvisioningPreviewResponse,
    summary="Preview bulk login account provisioning (dry-run)",
    description=(
        "Safe read-only audit of all database users against Firebase Authentication. "
        "Shows accounts needing creation, existing accounts to link, and anomalies. "
        "Never modifies real Firebase Auth accounts."
    ),
)
def preview_bulk_provisioning(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProvisioningPreviewResponse:
    return get_provisioning_preview(db=db, admin_user=current_user)


@router.post(
    "/provisioning/execute",
    response_model=ProvisioningExecuteResponse,
    summary="Execute bulk login account provisioning",
    description=(
        "Requires explicit Admin confirmation. Creates missing Firebase accounts with initial password 'cce@123', "
        "links existing accounts, marks accounts for first-login password change, and preserves Admin account."
    ),
)
def run_bulk_provisioning(
    payload: ProvisioningExecuteRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProvisioningExecuteResponse:
    return execute_bulk_provisioning(db=db, admin_user=current_user, req=payload)


def require_admin_or_setup_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Dual-protection dependency allowing authorization via:
    1. Pre-shared X-Setup-Token / X-Admin-Setup-Key header matching settings.JWT_SECRET_KEY, OR
    2. Active Admin User session Bearer token (require_admin).
    Strictly forbids unauthenticated or public access.
    """
    setup_token = request.headers.get("X-Setup-Token") or request.headers.get("X-Admin-Setup-Key")
    if setup_token and setup_token.strip():
        if not settings.JWT_SECRET_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: JWT_SECRET_KEY is not configured.",
            )
        if secrets.compare_digest(setup_token.strip(), settings.JWT_SECRET_KEY.strip()):
            admin = db.scalars(
                select(User).where(User.role == UserRole.ADMIN).limit(1)
            ).first()
            return admin
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid setup token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide an Admin Bearer token or X-Setup-Token header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return require_admin(current_user=get_current_user(credentials=credentials, db=db))


@router.post(
    "/roster/bootstrap",
    response_model=RosterImportResponse,
    summary="One-time protected student cohort import (JSON/Text)",
    description=(
        "Safely imports student roster into PostgreSQL. Idempotent and preserves existing passwords. "
        "Protected by Admin Bearer token or pre-shared X-Setup-Token header."
    ),
)
def bootstrap_student_roster(
    payload: RosterImportRequest,
    current_admin: Optional[User] = Depends(require_admin_or_setup_token),
    db: Session = Depends(get_db),
) -> RosterImportResponse:
    actor_id = current_admin.id if current_admin else None
    return import_roster_data(
        db=db,
        csv_content=payload.csv_content,
        initial_password=payload.initial_password,
        provision_admin=payload.provision_admin,
        actor_id=actor_id,
        staff_csv_content=payload.staff_csv_content,
    )


@router.post(
    "/roster/upload-csv",
    response_model=RosterImportResponse,
    summary="Upload and import student roster CSV file",
    description=(
        "Uploads a CSV file of students to provision into PostgreSQL. "
        "Protected by Admin Bearer token or pre-shared X-Setup-Token header."
    ),
)
async def upload_student_roster_csv(
    file: UploadFile = File(...),
    initial_password: Optional[str] = Form("cce@123"),
    provision_admin: bool = Form(True),
    staff_file: Optional[UploadFile] = File(None),
    current_admin: Optional[User] = Depends(require_admin_or_setup_token),
    db: Session = Depends(get_db),
) -> RosterImportResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a .csv file.",
        )
    content_bytes = await file.read()
    try:
        csv_text = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            csv_text = content_bytes.decode("latin-1")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unable to decode CSV file content: {e}",
            )

    staff_csv_text = None
    if staff_file and staff_file.filename:
        s_bytes = await staff_file.read()
        try:
            staff_csv_text = s_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                staff_csv_text = s_bytes.decode("latin-1")
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unable to decode staff CSV file content: {e}",
                )

    actor_id = current_admin.id if current_admin else None
    return import_roster_data(
        db=db,
        csv_content=csv_text,
        initial_password=initial_password,
        provision_admin=provision_admin,
        actor_id=actor_id,
        staff_csv_content=staff_csv_text,
    )


@router.get(
    "/users",
    response_model=List[AdminUserItem],
    summary="List all system users for provisioning management",
    description="Administrative user roster showing email, role, active status, and Firebase UID linkage.",
)
def get_admin_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminUserItem]:
    stmt = select(User).order_by(User.role, User.email)
    users = db.scalars(stmt).all()
    return [AdminUserItem.model_validate(u) for u in users]


@router.patch(
    "/users/{user_id}/email",
    response_model=AdminEmailUpdateResponse,
    summary="Update registered email address for any user with reauthentication",
    description=(
        "Allows authorized administrators to update a user's registered email address. "
        "Requires fresh administrator password reauthentication, checks for duplicate emails, "
        "updates Firebase Auth with pending email verification, synchronizes PostgreSQL, "
        "and creates an audit log."
    ),
)
def update_user_email(
    user_id: uuid.UUID,
    payload: AdminEmailUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminEmailUpdateResponse:
    return update_user_email_by_admin(
        db=db,
        admin_user=current_user,
        target_user_id=user_id,
        payload=payload,
    )


@router.get(
    "/users/{user_id}/verification-status",
    response_model=AdminVerificationStatusResponse,
    summary="Get live email verification status from Firebase Authentication",
    description="Allows administrators to inspect whether a user's registered email has been verified.",
)
def get_user_verification_status(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminVerificationStatusResponse:
    return get_user_verification_status_by_admin(
        db=db,
        admin_user=current_user,
        target_user_id=user_id,
    )


@router.post(
    "/users/{user_id}/send-verification-email",
    response_model=AdminSendVerificationEmailResponse,
    summary="Generate or resend email verification link for a user",
    description="Generates an email verification link via Firebase Admin SDK for the user's registered email.",
)
def send_user_verification_email(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminSendVerificationEmailResponse:
    return send_user_verification_email_by_admin(
        db=db,
        admin_user=current_user,
        target_user_id=user_id,
    )


# ==============================================================================
# Student Management Endpoints
# ==============================================================================

@router.get(
    "/students",
    response_model=List[AdminStudentItem],
    summary="List all students with search and filters",
    description="Returns complete student list with profile attributes, assigned mentor, and submission counts.",
)
def list_students(
    search: Optional[str] = Query(default=None, description="Search across full name, email, or register number"),
    department: Optional[str] = Query(default=None, description="Filter by department (e.g. CCE)"),
    year: Optional[int] = Query(default=None, description="Filter by academic year"),
    section: Optional[str] = Query(default=None, description="Filter by section"),
    is_active: Optional[bool] = Query(default=None, description="Filter by account status"),
    mentor_id: Optional[uuid.UUID] = Query(default=None, description="Filter by assigned mentor ID"),
    include_test_accounts: bool = Query(default=False, description="Whether to include test/fixture accounts"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminStudentItem]:
    stmt = (
        select(User)
        .outerjoin(StudentProfile, User.id == StudentProfile.user_id)
        .where(User.role == UserRole.STUDENT)
    )

    if not include_test_accounts:
        stmt = stmt.where(StudentProfile.id.is_not(None))
        if not search:
            stmt = stmt.where(~User.email.ilike("%@test.edu"))

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    if department:
        stmt = stmt.where(StudentProfile.department == department)

    if year is not None:
        stmt = stmt.where(StudentProfile.year == year)

    if section:
        stmt = stmt.where(StudentProfile.section == section)

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.full_name).like(term),
                func.lower(User.email).like(term),
                func.lower(StudentProfile.register_number).like(term),
            )
        )

    students = db.scalars(stmt.order_by(StudentProfile.register_number.asc().nulls_last(), User.full_name.asc())).all()

    # Pre-fetch all active assignments
    active_assignments = db.scalars(
        select(MentorAssignment).where(MentorAssignment.is_active.is_(True))
    ).all()
    mentor_by_student: dict[uuid.UUID, MentorAssignment] = {a.student_id: a for a in active_assignments}

    # Pre-fetch achievement counts per student
    counts_stmt = (
        select(
            Achievement.student_id,
            func.count(Achievement.id).label("total"),
            func.count(Achievement.id).filter(Achievement.status == AchievementStatus.APPROVED).label("approved"),
            func.count(Achievement.id).filter(Achievement.status == AchievementStatus.PENDING).label("pending"),
        )
        .group_by(Achievement.student_id)
    )
    counts_rows = db.execute(counts_stmt).all()
    counts_map = {row.student_id: {"total": row.total, "approved": row.approved, "pending": row.pending} for row in counts_rows}

    results: List[AdminStudentItem] = []
    for s in students:
        assignment = mentor_by_student.get(s.id)
        assigned_mentor_info: Optional[MentorInfo] = None
        if assignment and assignment.mentor:
            m_profile = assignment.mentor.mentor_profile
            assigned_mentor_info = MentorInfo(
                mentor_id=assignment.mentor.id,
                full_name=assignment.mentor.full_name,
                email=assignment.mentor.email,
                staff_id=m_profile.staff_id if m_profile else None,
                department=m_profile.department if m_profile else "CCE",
            )

        # Apply mentor_id filter if requested
        if mentor_id is not None:
            if not assignment or assignment.mentor_id != mentor_id:
                continue

        p = s.student_profile
        s_counts = counts_map.get(s.id, {"total": 0, "approved": 0, "pending": 0})

        results.append(
            AdminStudentItem(
                id=s.id,
                full_name=s.full_name,
                email=s.email,
                role=s.role,
                is_active=s.is_active,
                firebase_uid=s.firebase_uid,
                created_at=s.created_at,
                register_number=p.register_number if p else None,
                department=p.department if p else "CCE",
                year=p.year if p else 2,
                section=p.section if p else None,
                semester=p.semester if p else None,
                batch=p.batch if p else None,
                phone_number=p.phone_number if p else None,
                original_mentor_name=p.original_mentor_name if p else None,
                google_drive_folder_id=p.google_drive_folder_id if p else None,
                assigned_mentor=assigned_mentor_info,
                submission_count=s_counts["total"],
                approved_count=s_counts["approved"],
                pending_count=s_counts["pending"],
            )
        )

    return results


@router.get(
    "/students/{student_id}",
    response_model=AdminStudentDetailResponse,
    summary="Get complete details for a student",
    description="Returns detailed student record, mentorship assignment history, and recent submissions.",
)
def get_student_details(
    student_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminStudentDetailResponse:
    student = db.get(User, student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    p = student.student_profile
    active_assignment = db.scalars(
        select(MentorAssignment).where(
            MentorAssignment.student_id == student_id,
            MentorAssignment.is_active.is_(True),
        )
    ).first()

    assigned_mentor_info: Optional[MentorInfo] = None
    if active_assignment and active_assignment.mentor:
        m_profile = active_assignment.mentor.mentor_profile
        assigned_mentor_info = MentorInfo(
            mentor_id=active_assignment.mentor.id,
            full_name=active_assignment.mentor.full_name,
            email=active_assignment.mentor.email,
            staff_id=m_profile.staff_id if m_profile else None,
            department=m_profile.department if m_profile else "CCE",
        )

    # Mentorship history
    all_assignments = db.scalars(
        select(MentorAssignment)
        .where(MentorAssignment.student_id == student_id)
        .order_by(MentorAssignment.assigned_at.desc())
    ).all()
    history = [
        {
            "assignment_id": str(a.id),
            "mentor_id": str(a.mentor_id),
            "mentor_name": a.mentor.full_name if a.mentor else "Unknown",
            "is_active": a.is_active,
            "assigned_at": a.assigned_at.isoformat(),
            "ended_at": a.ended_at.isoformat() if a.ended_at else None,
        }
        for a in all_assignments
    ]

    # Recent submissions
    achievements = db.scalars(
        select(Achievement)
        .where(Achievement.student_id == student_id)
        .order_by(Achievement.created_at.desc())
    ).all()

    recent_subs = [
        {
            "id": str(ach.id),
            "title": ach.title,
            "status": ach.status.value,
            "component_name": ach.component.name if ach.component else None,
            "created_at": ach.created_at.isoformat(),
        }
        for ach in achievements[:10]
    ]

    total_submissions = len(achievements)
    approved_count = sum(1 for a in achievements if a.status == AchievementStatus.APPROVED)
    pending_count = sum(1 for a in achievements if a.status == AchievementStatus.PENDING)

    files_count = db.scalars(
        select(func.count(AchievementFile.id)).where(AchievementFile.uploaded_by == student_id)
    ).one()

    return AdminStudentDetailResponse(
        id=student.id,
        full_name=student.full_name,
        email=student.email,
        role=student.role,
        is_active=student.is_active,
        firebase_uid=student.firebase_uid,
        created_at=student.created_at,
        register_number=p.register_number if p else None,
        department=p.department if p else "CCE",
        year=p.year if p else 2,
        section=p.section if p else None,
        semester=p.semester if p else None,
        batch=p.batch if p else None,
        phone_number=p.phone_number if p else None,
        original_mentor_name=p.original_mentor_name if p else None,
        google_drive_folder_id=p.google_drive_folder_id if p else None,
        assigned_mentor=assigned_mentor_info,
        submission_count=total_submissions,
        approved_count=approved_count,
        pending_count=pending_count,
        assignment_history=history,
        recent_submissions=recent_subs,
        evidence_files_count=files_count,
    )


@router.post(
    "/students",
    response_model=AdminStudentItem,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new student",
    description="Creates student user and profile in PostgreSQL, synchronizes with Firebase, and creates mentor assignment if provided.",
)
def create_student(
    payload: AdminStudentCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminStudentItem:
    clean_email = payload.email.strip().lower()
    clean_reg = payload.register_number.strip().upper()

    # Uniqueness checks
    existing_email = db.scalars(select(User).where(func.lower(User.email) == clean_email)).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{clean_email}' already exists in the system.",
        )

    existing_reg = db.scalars(
        select(StudentProfile).where(func.upper(StudentProfile.register_number) == clean_reg)
    ).first()
    if existing_reg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Register number '{clean_reg}' is already assigned to another student.",
        )

    # Validate mentor assignment if specified
    mentor_user: Optional[User] = None
    if payload.assigned_mentor_id:
        mentor_user = db.get(User, payload.assigned_mentor_id)
        if not mentor_user or mentor_user.role != UserRole.MENTOR:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected assigned mentor does not exist or does not have MENTOR role.",
            )

    # Temporary password
    raw_password = payload.password or secrets.token_urlsafe(12)
    pw_hash = get_password_hash(raw_password)

    # Create User and StudentProfile in transaction
    new_user = User(
        id=uuid.uuid4(),
        full_name=payload.full_name.strip(),
        email=clean_email,
        password_hash=pw_hash,
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    new_profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=new_user.id,
        register_number=clean_reg,
        department=payload.department.strip(),
        year=payload.year,
        section=payload.section.strip() if payload.section else None,
        semester=payload.semester.strip() if payload.semester else None,
        batch=payload.batch.strip() if payload.batch else None,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        original_mentor_name=mentor_user.full_name if mentor_user else None,
    )
    db.add(new_profile)

    assigned_mentor_info: Optional[MentorInfo] = None
    if mentor_user:
        assignment = MentorAssignment(
            id=uuid.uuid4(),
            mentor_id=mentor_user.id,
            student_id=new_user.id,
            assigned_by=current_user.id,
            is_active=True,
        )
        db.add(assignment)
        m_profile = mentor_user.mentor_profile
        assigned_mentor_info = MentorInfo(
            mentor_id=mentor_user.id,
            full_name=mentor_user.full_name,
            email=mentor_user.email,
            staff_id=m_profile.staff_id if m_profile else None,
            department=m_profile.department if m_profile else "CCE",
        )

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="create_student",
        target_type="student",
        target_id=str(new_user.id),
        metadata={"register_number": clean_reg, "email": clean_email},
    )

    db.commit()
    db.refresh(new_user)

    # Sync with Firebase Auth
    fb_uid = sync_create_firebase_user(
        email=clean_email,
        full_name=payload.full_name.strip(),
        password=raw_password,
        disabled=False,
    )
    if fb_uid and not new_user.firebase_uid:
        new_user.firebase_uid = fb_uid
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    return AdminStudentItem(
        id=new_user.id,
        full_name=new_user.full_name,
        email=new_user.email,
        role=new_user.role,
        is_active=new_user.is_active,
        firebase_uid=new_user.firebase_uid,
        created_at=new_user.created_at,
        register_number=new_profile.register_number,
        department=new_profile.department,
        year=new_profile.year,
        section=new_profile.section,
        semester=new_profile.semester,
        batch=new_profile.batch,
        phone_number=new_profile.phone_number,
        original_mentor_name=new_profile.original_mentor_name,
        assigned_mentor=assigned_mentor_info,
        submission_count=0,
        approved_count=0,
        pending_count=0,
    )


@router.put(
    "/students/{student_id}",
    response_model=AdminStudentItem,
    summary="Edit student details",
    description="Updates student profile, email, name, and assigned mentor with uniqueness validations and Firebase synchronization.",
)
def update_student(
    student_id: uuid.UUID,
    payload: AdminStudentUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminStudentItem:
    student = db.get(User, student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    profile = student.student_profile
    if not profile:
        profile = StudentProfile(
            id=uuid.uuid4(),
            user_id=student.id,
            register_number=f"REG_{uuid.uuid4().hex[:6].upper()}",
            department="CCE",
            year=2,
        )
        db.add(profile)
        db.flush()

    # Email update with uniqueness check
    if payload.email is not None:
        clean_email = payload.email.strip().lower()
        if clean_email != student.email.lower():
            conflict = db.scalars(
                select(User).where(func.lower(User.email) == clean_email, User.id != student_id)
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{clean_email}' already belongs to another user.",
                )
            student.email = clean_email

    if payload.full_name is not None:
        student.full_name = payload.full_name.strip()

    if payload.is_active is not None:
        student.is_active = payload.is_active

    # Register number uniqueness check
    if payload.register_number is not None:
        clean_reg = payload.register_number.strip().upper()
        if clean_reg != profile.register_number.upper():
            conflict_reg = db.scalars(
                select(StudentProfile).where(
                    func.upper(StudentProfile.register_number) == clean_reg,
                    StudentProfile.user_id != student_id,
                )
            ).first()
            if conflict_reg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Register number '{clean_reg}' is already in use by another student.",
                )
            profile.register_number = clean_reg

    if payload.department is not None:
        profile.department = payload.department.strip()
    if payload.year is not None:
        profile.year = payload.year
    if payload.section is not None:
        profile.section = payload.section.strip() if payload.section else None
    if payload.semester is not None:
        profile.semester = payload.semester.strip() if payload.semester else None
    if payload.batch is not None:
        profile.batch = payload.batch.strip() if payload.batch else None
    if payload.phone_number is not None:
        profile.phone_number = payload.phone_number.strip() if payload.phone_number else None

    # Handle mentor reassignment
    active_assign = db.scalars(
        select(MentorAssignment).where(
            MentorAssignment.student_id == student_id,
            MentorAssignment.is_active.is_(True),
        )
    ).first()

    now = datetime.now(timezone.utc)
    if payload.assigned_mentor_id is not None:
        new_mentor = db.get(User, payload.assigned_mentor_id)
        if not new_mentor or new_mentor.role != UserRole.MENTOR:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned mentor not found or invalid role.",
            )

        if not active_assign or active_assign.mentor_id != new_mentor.id:
            if active_assign:
                active_assign.is_active = False
                active_assign.ended_at = now
                db.add(active_assign)

            new_assign = MentorAssignment(
                id=uuid.uuid4(),
                mentor_id=new_mentor.id,
                student_id=student_id,
                assigned_by=current_user.id,
                assigned_at=now,
                is_active=True,
            )
            db.add(new_assign)
            profile.original_mentor_name = new_mentor.full_name

    db.add(student)
    db.add(profile)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_student",
        target_type="student",
        target_id=str(student.id),
        metadata={"register_number": profile.register_number, "email": student.email},
    )

    db.commit()
    db.refresh(student)
    db.refresh(profile)

    # Sync attributes to Firebase Auth
    if student.firebase_uid:
        sync_update_firebase_user(
            student.firebase_uid,
            email=student.email,
            full_name=student.full_name,
            disabled=not student.is_active,
        )

    # Pre-fetch counts
    counts = db.execute(
        select(
            func.count(Achievement.id).label("total"),
            func.count(Achievement.id).filter(Achievement.status == AchievementStatus.APPROVED).label("approved"),
            func.count(Achievement.id).filter(Achievement.status == AchievementStatus.PENDING).label("pending"),
        ).where(Achievement.student_id == student_id)
    ).first()

    current_assign = db.scalars(
        select(MentorAssignment).where(
            MentorAssignment.student_id == student_id,
            MentorAssignment.is_active.is_(True),
        )
    ).first()
    assigned_mentor_info: Optional[MentorInfo] = None
    if current_assign and current_assign.mentor:
        m_profile = current_assign.mentor.mentor_profile
        assigned_mentor_info = MentorInfo(
            mentor_id=current_assign.mentor.id,
            full_name=current_assign.mentor.full_name,
            email=current_assign.mentor.email,
            staff_id=m_profile.staff_id if m_profile else None,
            department=m_profile.department if m_profile else "CCE",
        )

    return AdminStudentItem(
        id=student.id,
        full_name=student.full_name,
        email=student.email,
        role=student.role,
        is_active=student.is_active,
        firebase_uid=student.firebase_uid,
        created_at=student.created_at,
        register_number=profile.register_number,
        department=profile.department,
        year=profile.year,
        section=profile.section,
        semester=profile.semester,
        batch=profile.batch,
        phone_number=profile.phone_number,
        original_mentor_name=profile.original_mentor_name,
        assigned_mentor=assigned_mentor_info,
        submission_count=counts.total if counts else 0,
        approved_count=counts.approved if counts else 0,
        pending_count=counts.pending if counts else 0,
    )


@router.patch(
    "/students/{student_id}/status",
    response_model=AdminOperationResult,
    summary="Activate or deactivate a student account",
    description="Updates account status in PostgreSQL and synchronizes active/disabled state in Firebase.",
)
def update_student_status(
    student_id: uuid.UUID,
    payload: AdminStatusUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOperationResult:
    student = db.get(User, student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    student.is_active = payload.is_active
    db.add(student)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_student_status",
        target_type="student",
        target_id=str(student.id),
        metadata={"is_active": payload.is_active},
    )
    db.commit()

    if student.firebase_uid:
        sync_set_firebase_disabled(student.firebase_uid, disabled=not payload.is_active)

    state_str = "activated" if payload.is_active else "deactivated"
    return AdminOperationResult(
        success=True,
        message=f"Student account {state_str} successfully.",
        affected_id=student.id,
    )


def _execute_user_password_reset(
    target_user_id: uuid.UUID,
    expected_role: UserRole,
    payload: AdminResetUserPasswordRequest,
    current_user: User,
    db: Session,
) -> AdminResetUserPasswordResponse:
    """
    Unified, secure password reset engine for administrators.
    - Validates target account exists and strictly enforces expected role.
    - Strictly rejects administrators attempting to reset their own password via faculty endpoints.
    - Safely synchronizes new password with Firebase Authentication (if linked).
    - Optionally generates a direct Firebase password-reset link.
    - Updates Argon2id password hash and mandatory password-change flag in PostgreSQL.
    - Writes immutable, safe audit log without recording plaintext passwords.
    """
    target_user = db.get(User, target_user_id)
    role_label = {
        UserRole.STUDENT: "student",
        UserRole.MENTOR: "faculty mentor",
        UserRole.HOD: "department HOD",
        UserRole.ADMIN: "administrator",
    }.get(expected_role, expected_role.value)

    if not target_user or target_user.role != expected_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{role_label.capitalize()} account not found or target user is not a {role_label}.",
        )

    # Reject administrator self-reset attempts through faculty management endpoints
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot reset their own password via faculty management endpoints. Please use personal security settings.",
        )

    clean_password = payload.new_password.strip()
    if len(clean_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    # 1. Update in Firebase Authentication if account is linked
    firebase_updated = False
    if target_user.firebase_uid:
        try:
            firebase_updated = sync_update_firebase_user(target_user.firebase_uid, password=clean_password)
        except Exception as fb_exc:
            logger.warning("Firebase update failed for %s: %s", target_user.email, fb_exc)
            firebase_updated = False

    # Also attempt generating a direct password reset link if supported
    password_reset_link = generate_firebase_password_reset_link(target_user.email)

    # 2. Update Argon2id password hash and must_change_password in PostgreSQL
    target_user.password_hash = get_password_hash(clean_password)
    target_user.must_change_password = payload.must_change_password
    db.add(target_user)

    # 3. Record safe audit log (never recording the password)
    action_name = f"reset_{expected_role.value}_password"
    record_audit_log(
        db,
        actor_id=current_user.id,
        action=action_name,
        target_type=expected_role.value,
        target_id=str(target_user.id),
        metadata={
            "user_id": str(target_user.id),
            "user_email": target_user.email,
            "role": target_user.role.value,
            "must_change_password": payload.must_change_password,
            "has_firebase_uid": bool(target_user.firebase_uid),
            "firebase_updated": firebase_updated,
            "outcome": "completed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    db.commit()
    db.refresh(target_user)

    staff_id = None
    department = None
    if expected_role == UserRole.MENTOR and target_user.mentor_profile:
        staff_id = target_user.mentor_profile.staff_id
        department = target_user.mentor_profile.department
    elif expected_role == UserRole.HOD and target_user.hod_profile:
        staff_id = target_user.hod_profile.staff_id
        department = target_user.hod_profile.department
    elif expected_role == UserRole.STUDENT and target_user.student_profile:
        staff_id = target_user.student_profile.register_number
        department = target_user.student_profile.department

    role_title = {
        UserRole.STUDENT: "Student",
        UserRole.MENTOR: "Faculty Mentor",
        UserRole.HOD: "Department HOD",
    }.get(expected_role, expected_role.value.capitalize())

    return AdminResetUserPasswordResponse(
        success=True,
        user_id=target_user.id,
        full_name=target_user.full_name,
        email=target_user.email,
        role=target_user.role,
        staff_id=staff_id,
        department=department,
        must_change_password=target_user.must_change_password,
        firebase_updated=firebase_updated,
        password_reset_link=password_reset_link,
        message=f"Password for {role_title} '{target_user.full_name}' ({target_user.email}) has been successfully reset.",
    )


@router.post(
    "/students/{student_id}/reset-password",
    response_model=AdminResetStudentPasswordResponse,
    summary="Securely reset an individual student's login password",
    description=(
        "Enforces Administrator-only authorization. Securely updates the student's password in "
        "PostgreSQL (Argon2id) and Firebase Authentication (if linked), enforces mandatory password change "
        "if requested, and records a safe audit entry without ever storing or logging plaintext passwords."
    ),
)
def reset_student_password(
    student_id: uuid.UUID,
    payload: AdminResetStudentPasswordRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminResetStudentPasswordResponse:
    res = _execute_user_password_reset(
        target_user_id=student_id,
        expected_role=UserRole.STUDENT,
        payload=payload,
        current_user=current_user,
        db=db,
    )
    return AdminResetStudentPasswordResponse(
        success=res.success,
        student_id=res.user_id,
        student_name=res.full_name,
        student_email=res.email,
        register_number=res.staff_id,
        must_change_password=res.must_change_password,
        message=res.message,
    )


@router.post(
    "/students/{student_id}/delete",
    response_model=AdminOperationResult,
    summary="Delete or deactivate student with chosen safety mode",
    description="Supports deactivate, delete_login, or permanent deletion with typed register number verification.",
)
def delete_student(
    student_id: uuid.UUID,
    payload: AdminStudentDeleteRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOperationResult:
    if payload.delete_mode == "deactivate":
        return deactivate_student_account(db, student_id=student_id, admin_user=current_user)
    elif payload.delete_mode == "delete_login":
        return delete_student_login_access(db, student_id=student_id, admin_user=current_user)
    elif payload.delete_mode == "permanent":
        return permanently_delete_student(
            db,
            student_id=student_id,
            confirmation_register_number=payload.confirmation_register_number,
            admin_user=current_user,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown delete_mode '{payload.delete_mode}'. Must be 'deactivate', 'delete_login', or 'permanent'.",
        )


# ==============================================================================
# Faculty Mentor Management Endpoints
# ==============================================================================

@router.get(
    "/mentors",
    response_model=List[AdminMentorItem],
    summary="List all faculty mentors",
    description="Returns mentor accounts with profile info, assigned student list, and reviews count.",
)
def list_mentors(
    search: Optional[str] = Query(default=None, description="Search by name, email, or staff ID"),
    department: Optional[str] = Query(default=None, description="Filter by department"),
    is_active: Optional[bool] = Query(default=None, description="Filter by account status"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminMentorItem]:
    stmt = (
        select(User)
        .outerjoin(MentorProfile, User.id == MentorProfile.user_id)
        .where(User.role == UserRole.MENTOR)
    )

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    if department:
        stmt = stmt.where(MentorProfile.department == department)

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.full_name).like(term),
                func.lower(User.email).like(term),
                func.lower(MentorProfile.staff_id).like(term),
            )
        )

    mentors = db.scalars(stmt.order_by(User.full_name.asc())).all()

    # Pre-fetch all active assignments grouped by mentor
    active_assignments = db.scalars(
        select(MentorAssignment).where(MentorAssignment.is_active.is_(True))
    ).all()

    assignments_by_mentor: dict[uuid.UUID, List[AdminMentorAssignedStudent]] = {}
    for a in active_assignments:
        student = a.student
        if not student:
            continue
        p = student.student_profile
        item = AdminMentorAssignedStudent(
            student_id=student.id,
            full_name=student.full_name,
            register_number=p.register_number if p else None,
            email=student.email,
            year=p.year if p else 2,
            section=p.section if p else None,
            assigned_at=a.assigned_at,
        )
        assignments_by_mentor.setdefault(a.mentor_id, []).append(item)

    # Pre-fetch reviews counts
    review_counts_stmt = (
        select(VerificationLog.reviewer_id, func.count(VerificationLog.id).label("cnt"))
        .group_by(VerificationLog.reviewer_id)
    )
    reviews_map = {row.reviewer_id: row.cnt for row in db.execute(review_counts_stmt).all()}

    results: List[AdminMentorItem] = []
    for m in mentors:
        p = m.mentor_profile
        assigned_students = assignments_by_mentor.get(m.id, [])
        rev_count = reviews_map.get(m.id, 0)

        results.append(
            AdminMentorItem(
                id=m.id,
                full_name=m.full_name,
                email=m.email,
                role=m.role,
                is_active=m.is_active,
                firebase_uid=m.firebase_uid,
                created_at=m.created_at,
                staff_id=p.staff_id if p else None,
                department=p.department if p else "CCE",
                designation=p.designation if p else "Assistant Professor",
                assigned_student_count=len(assigned_students),
                assigned_students=assigned_students,
                reviews_count=rev_count,
            )
        )

    return results


@router.get(
    "/mentors/{mentor_id}",
    response_model=AdminMentorDetailResponse,
    summary="Get complete details for a faculty mentor",
    description="Returns detailed mentor information including all assigned students and historical records.",
)
def get_mentor_details(
    mentor_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminMentorDetailResponse:
    mentor = db.get(User, mentor_id)
    if not mentor or mentor.role != UserRole.MENTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty mentor not found.")

    p = mentor.mentor_profile
    active_assignments = db.scalars(
        select(MentorAssignment).where(
            MentorAssignment.mentor_id == mentor_id,
            MentorAssignment.is_active.is_(True),
        )
    ).all()

    assigned_students: List[AdminMentorAssignedStudent] = []
    for a in active_assignments:
        st = a.student
        if st:
            sp = st.student_profile
            assigned_students.append(
                AdminMentorAssignedStudent(
                    student_id=st.id,
                    full_name=st.full_name,
                    register_number=sp.register_number if sp else None,
                    email=st.email,
                    year=sp.year if sp else 2,
                    section=sp.section if sp else None,
                    assigned_at=a.assigned_at,
                )
            )

    reviews_count = db.scalars(
        select(func.count(VerificationLog.id)).where(VerificationLog.reviewer_id == mentor_id)
    ).one()

    return AdminMentorDetailResponse(
        id=mentor.id,
        full_name=mentor.full_name,
        email=mentor.email,
        role=mentor.role,
        is_active=mentor.is_active,
        firebase_uid=mentor.firebase_uid,
        created_at=mentor.created_at,
        staff_id=p.staff_id if p else None,
        department=p.department if p else "CCE",
        designation=p.designation if p else "Assistant Professor",
        assigned_student_count=len(assigned_students),
        assigned_students=assigned_students,
        reviews_count=reviews_count,
        all_assigned_students=assigned_students,
    )


@router.post(
    "/mentors",
    response_model=AdminMentorItem,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new faculty mentor",
    description="Creates mentor user and MentorProfile in PostgreSQL and synchronizes with Firebase Auth.",
)
def create_mentor(
    payload: AdminMentorCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminMentorItem:
    clean_email = payload.email.strip().lower()

    existing_email = db.scalars(select(User).where(func.lower(User.email) == clean_email)).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{clean_email}' already exists.",
        )

    if payload.staff_id:
        existing_staff = db.scalars(
            select(MentorProfile).where(MentorProfile.staff_id == payload.staff_id.strip())
        ).first()
        if existing_staff:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Staff ID '{payload.staff_id}' already exists.",
            )

    raw_password = payload.password or secrets.token_urlsafe(12)
    pw_hash = get_password_hash(raw_password)

    new_user = User(
        id=uuid.uuid4(),
        full_name=payload.full_name.strip(),
        email=clean_email,
        password_hash=pw_hash,
        role=UserRole.MENTOR,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    new_profile = MentorProfile(
        id=uuid.uuid4(),
        user_id=new_user.id,
        staff_id=payload.staff_id.strip() if payload.staff_id else None,
        department=payload.department.strip(),
        designation=payload.designation.strip() if payload.designation else "Assistant Professor",
    )
    db.add(new_profile)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="create_mentor",
        target_type="mentor",
        target_id=str(new_user.id),
        metadata={"staff_id": new_profile.staff_id, "email": clean_email},
    )

    db.commit()
    db.refresh(new_user)

    # Sync to Firebase Auth
    fb_uid = sync_create_firebase_user(
        email=clean_email,
        full_name=payload.full_name.strip(),
        password=raw_password,
        disabled=False,
    )
    if fb_uid and not new_user.firebase_uid:
        new_user.firebase_uid = fb_uid
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    return AdminMentorItem(
        id=new_user.id,
        full_name=new_user.full_name,
        email=new_user.email,
        role=new_user.role,
        is_active=new_user.is_active,
        firebase_uid=new_user.firebase_uid,
        created_at=new_user.created_at,
        staff_id=new_profile.staff_id,
        department=new_profile.department,
        designation=new_profile.designation,
        assigned_student_count=0,
        assigned_students=[],
        reviews_count=0,
    )


@router.put(
    "/mentors/{mentor_id}",
    response_model=AdminMentorItem,
    summary="Edit faculty mentor details",
    description="Updates mentor profile, staff ID, and designation with uniqueness checks.",
)
def update_mentor(
    mentor_id: uuid.UUID,
    payload: AdminMentorUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminMentorItem:
    mentor = db.get(User, mentor_id)
    if not mentor or mentor.role != UserRole.MENTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mentor not found.")

    profile = mentor.mentor_profile
    if not profile:
        profile = MentorProfile(id=uuid.uuid4(), user_id=mentor.id, department="CCE")
        db.add(profile)
        db.flush()

    if payload.email is not None:
        clean_email = payload.email.strip().lower()
        if clean_email != mentor.email.lower():
            conflict = db.scalars(
                select(User).where(func.lower(User.email) == clean_email, User.id != mentor_id)
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{clean_email}' is already in use.",
                )
            mentor.email = clean_email

    if payload.full_name is not None:
        mentor.full_name = payload.full_name.strip()

    if payload.is_active is not None:
        mentor.is_active = payload.is_active

    if payload.staff_id is not None:
        clean_staff = payload.staff_id.strip() if payload.staff_id else None
        if clean_staff and clean_staff != profile.staff_id:
            conflict_staff = db.scalars(
                select(MentorProfile).where(
                    MentorProfile.staff_id == clean_staff,
                    MentorProfile.user_id != mentor_id,
                )
            ).first()
            if conflict_staff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Staff ID '{clean_staff}' already belongs to another mentor.",
                )
        profile.staff_id = clean_staff

    if payload.department is not None:
        profile.department = payload.department.strip()
    if payload.designation is not None:
        profile.designation = payload.designation.strip()

    db.add(mentor)
    db.add(profile)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_mentor",
        target_type="mentor",
        target_id=str(mentor.id),
        metadata={"staff_id": profile.staff_id, "email": mentor.email},
    )

    db.commit()
    db.refresh(mentor)
    db.refresh(profile)

    if mentor.firebase_uid:
        sync_update_firebase_user(
            mentor.firebase_uid,
            email=mentor.email,
            full_name=mentor.full_name,
            disabled=not mentor.is_active,
        )

    active_assigns = db.scalars(
        select(MentorAssignment).where(
            MentorAssignment.mentor_id == mentor_id,
            MentorAssignment.is_active.is_(True),
        )
    ).all()
    assigned_students = [
        AdminMentorAssignedStudent(
            student_id=a.student.id,
            full_name=a.student.full_name,
            register_number=a.student.student_profile.register_number if a.student.student_profile else None,
            email=a.student.email,
            year=a.student.student_profile.year if a.student.student_profile else 2,
            section=a.student.student_profile.section if a.student.student_profile else None,
            assigned_at=a.assigned_at,
        )
        for a in active_assigns
        if a.student
    ]

    reviews_count = db.scalars(
        select(func.count(VerificationLog.id)).where(VerificationLog.reviewer_id == mentor_id)
    ).one()

    return AdminMentorItem(
        id=mentor.id,
        full_name=mentor.full_name,
        email=mentor.email,
        role=mentor.role,
        is_active=mentor.is_active,
        firebase_uid=mentor.firebase_uid,
        created_at=mentor.created_at,
        staff_id=profile.staff_id,
        department=profile.department,
        designation=profile.designation,
        assigned_student_count=len(assigned_students),
        assigned_students=assigned_students,
        reviews_count=reviews_count,
    )


@router.patch(
    "/mentors/{mentor_id}/status",
    response_model=AdminOperationResult,
    summary="Activate or deactivate a mentor account",
)
def update_mentor_status(
    mentor_id: uuid.UUID,
    payload: AdminStatusUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOperationResult:
    mentor = db.get(User, mentor_id)
    if not mentor or mentor.role != UserRole.MENTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mentor not found.")

    mentor.is_active = payload.is_active
    db.add(mentor)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_mentor_status",
        target_type="mentor",
        target_id=str(mentor.id),
        metadata={"is_active": payload.is_active},
    )
    db.commit()

    if mentor.firebase_uid:
        sync_set_firebase_disabled(mentor.firebase_uid, disabled=not payload.is_active)

    state_str = "activated" if payload.is_active else "deactivated"
    return AdminOperationResult(
        success=True,
        message=f"Mentor account {state_str} successfully.",
        affected_id=mentor.id,
    )


@router.post(
    "/mentors/{mentor_id}/reassign-students",
    response_model=AdminOperationResult,
    summary="Reassign students from one mentor to another",
    description="Closes existing assignments and creates new active assignments under target mentor.",
)
def reassign_students(
    mentor_id: uuid.UUID,
    payload: AdminMentorReassignRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOperationResult:
    count = reassign_mentor_students(
        db,
        source_mentor_id=mentor_id,
        target_mentor_id=payload.target_mentor_id,
        admin_user=current_user,
        student_ids=payload.student_ids,
    )
    db.commit()
    return AdminOperationResult(
        success=True,
        message=f"{count} student(s) reassigned successfully.",
        affected_id=mentor_id,
    )


@router.post(
    "/mentors/{mentor_id}/delete",
    response_model=AdminOperationResult,
    summary="Delete a faculty mentor account",
    description="Requires student reassignment to an active mentor before deletion. Preserves review history.",
)
def delete_mentor(
    mentor_id: uuid.UUID,
    payload: AdminMentorDeleteRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOperationResult:
    return delete_mentor_account(
        db,
        mentor_id=mentor_id,
        reassign_mentor_id=payload.reassign_mentor_id,
        admin_user=current_user,
    )


@router.post(
    "/mentors/{mentor_id}/reset-password",
    response_model=AdminResetUserPasswordResponse,
    summary="Securely reset a faculty mentor's login password",
    description=(
        "Enforces Administrator-only authorization. Securely updates the mentor's password in "
        "PostgreSQL (Argon2id) and Firebase Authentication (if linked), enforces mandatory password change "
        "if requested, and records a safe audit entry without ever storing or logging plaintext passwords."
    ),
)
def reset_mentor_password(
    mentor_id: uuid.UUID,
    payload: AdminResetUserPasswordRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminResetUserPasswordResponse:
    return _execute_user_password_reset(
        target_user_id=mentor_id,
        expected_role=UserRole.MENTOR,
        payload=payload,
        current_user=current_user,
        db=db,
    )


# ==============================================================================
# HOD Management Endpoints
# ==============================================================================

@router.get(
    "/hods",
    response_model=List[AdminHODItem],
    summary="List all HOD accounts",
    description="Returns HOD accounts with profile fields and department oversight.",
)
def list_hods(
    search: Optional[str] = Query(default=None, description="Search by name, email, or staff ID"),
    department: Optional[str] = Query(default=None, description="Filter by department"),
    is_active: Optional[bool] = Query(default=None, description="Filter by account status"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AdminHODItem]:
    stmt = (
        select(User)
        .outerjoin(HodProfile, User.id == HodProfile.user_id)
        .where(User.role == UserRole.HOD)
    )

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    if department:
        stmt = stmt.where(HodProfile.department == department)

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.full_name).like(term),
                func.lower(User.email).like(term),
                func.lower(HodProfile.staff_id).like(term),
            )
        )

    hods = db.scalars(stmt.order_by(User.full_name.asc())).all()

    # Pre-fetch review counts
    review_counts_stmt = (
        select(VerificationLog.reviewer_id, func.count(VerificationLog.id).label("cnt"))
        .group_by(VerificationLog.reviewer_id)
    )
    reviews_map = {row.reviewer_id: row.cnt for row in db.execute(review_counts_stmt).all()}

    results: List[AdminHODItem] = []
    for h in hods:
        p = h.hod_profile
        rev_count = reviews_map.get(h.id, 0)
        results.append(
            AdminHODItem(
                id=h.id,
                full_name=h.full_name,
                email=h.email,
                role=h.role,
                is_active=h.is_active,
                firebase_uid=h.firebase_uid,
                created_at=h.created_at,
                staff_id=p.staff_id if p else None,
                department=p.department if p else "CCE",
                designation=p.designation if p else "Head of Department",
                reviews_count=rev_count,
            )
        )

    return results


@router.get(
    "/hods/{hod_id}",
    response_model=AdminHODItem,
    summary="Get complete details for an HOD account",
)
def get_hod_details(
    hod_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminHODItem:
    hod = db.get(User, hod_id)
    if not hod or hod.role != UserRole.HOD:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HOD account not found.")

    p = hod.hod_profile
    rev_count = db.scalars(
        select(func.count(VerificationLog.id)).where(VerificationLog.reviewer_id == hod_id)
    ).one()

    return AdminHODItem(
        id=hod.id,
        full_name=hod.full_name,
        email=hod.email,
        role=hod.role,
        is_active=hod.is_active,
        firebase_uid=hod.firebase_uid,
        created_at=hod.created_at,
        staff_id=p.staff_id if p else None,
        department=p.department if p else "CCE",
        designation=p.designation if p else "Head of Department",
        reviews_count=rev_count,
    )


@router.post(
    "/hods",
    response_model=AdminHODItem,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new HOD",
    description="Creates HOD account and profile, prevents duplicate accounts and conflicting department assignments.",
)
def create_hod(
    payload: AdminHODCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminHODItem:
    clean_email = payload.email.strip().lower()
    clean_dept = payload.department.strip()

    existing_email = db.scalars(select(User).where(func.lower(User.email) == clean_email)).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{clean_email}' already exists.",
        )

    if payload.staff_id:
        existing_staff = db.scalars(
            select(HodProfile).where(HodProfile.staff_id == payload.staff_id.strip())
        ).first()
        if existing_staff:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Staff ID '{payload.staff_id}' already exists on another HOD profile.",
            )

    # Check conflicting active HOD for department
    active_hod_dept = db.scalars(
        select(User)
        .join(HodProfile, User.id == HodProfile.user_id)
        .where(
            User.role == UserRole.HOD,
            User.is_active.is_(True),
            HodProfile.department == clean_dept,
        )
    ).first()
    if active_hod_dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Department '{clean_dept}' already has an active HOD ({active_hod_dept.full_name}). "
                f"Deactivate or reassign the current HOD before assigning a new active HOD to this department."
            ),
        )

    raw_password = payload.password or secrets.token_urlsafe(12)
    pw_hash = get_password_hash(raw_password)

    new_user = User(
        id=uuid.uuid4(),
        full_name=payload.full_name.strip(),
        email=clean_email,
        password_hash=pw_hash,
        role=UserRole.HOD,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    new_profile = HodProfile(
        id=uuid.uuid4(),
        user_id=new_user.id,
        staff_id=payload.staff_id.strip() if payload.staff_id else None,
        department=clean_dept,
        designation=payload.designation.strip() if payload.designation else "Head of Department",
    )
    db.add(new_profile)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="create_hod",
        target_type="hod",
        target_id=str(new_user.id),
        metadata={"department": clean_dept, "email": clean_email},
    )

    db.commit()
    db.refresh(new_user)

    fb_uid = sync_create_firebase_user(
        email=clean_email,
        full_name=payload.full_name.strip(),
        password=raw_password,
        disabled=False,
    )
    if fb_uid and not new_user.firebase_uid:
        new_user.firebase_uid = fb_uid
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    return AdminHODItem(
        id=new_user.id,
        full_name=new_user.full_name,
        email=new_user.email,
        role=new_user.role,
        is_active=new_user.is_active,
        firebase_uid=new_user.firebase_uid,
        created_at=new_user.created_at,
        staff_id=new_profile.staff_id,
        department=new_profile.department,
        designation=new_profile.designation,
        reviews_count=0,
    )


@router.put(
    "/hods/{hod_id}",
    response_model=AdminHODItem,
    summary="Edit HOD details",
    description="Updates HOD details with uniqueness checks and prevents department conflict.",
)
def update_hod(
    hod_id: uuid.UUID,
    payload: AdminHODUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminHODItem:
    hod = db.get(User, hod_id)
    if not hod or hod.role != UserRole.HOD:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HOD account not found.")

    profile = hod.hod_profile
    if not profile:
        profile = HodProfile(id=uuid.uuid4(), user_id=hod.id, department="CCE")
        db.add(profile)
        db.flush()

    if payload.email is not None:
        clean_email = payload.email.strip().lower()
        if clean_email != hod.email.lower():
            conflict = db.scalars(
                select(User).where(func.lower(User.email) == clean_email, User.id != hod_id)
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{clean_email}' already in use.",
                )
            hod.email = clean_email

    if payload.full_name is not None:
        hod.full_name = payload.full_name.strip()

    target_active = payload.is_active if payload.is_active is not None else hod.is_active
    target_dept = payload.department.strip() if payload.department is not None else profile.department

    # Check department conflict if active
    if target_active:
        dept_conflict = db.scalars(
            select(User)
            .join(HodProfile, User.id == HodProfile.user_id)
            .where(
                User.role == UserRole.HOD,
                User.is_active.is_(True),
                User.id != hod_id,
                HodProfile.department == target_dept,
            )
        ).first()
        if dept_conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department '{target_dept}' already has an active HOD ({dept_conflict.full_name}).",
            )

    hod.is_active = target_active
    profile.department = target_dept

    if payload.staff_id is not None:
        clean_staff = payload.staff_id.strip() if payload.staff_id else None
        if clean_staff and clean_staff != profile.staff_id:
            conflict_staff = db.scalars(
                select(HodProfile).where(
                    HodProfile.staff_id == clean_staff,
                    HodProfile.user_id != hod_id,
                )
            ).first()
            if conflict_staff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Staff ID '{clean_staff}' already in use.",
                )
        profile.staff_id = clean_staff

    if payload.designation is not None:
        profile.designation = payload.designation.strip()

    db.add(hod)
    db.add(profile)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_hod",
        target_type="hod",
        target_id=str(hod.id),
        metadata={"department": profile.department, "email": hod.email},
    )

    db.commit()
    db.refresh(hod)
    db.refresh(profile)

    if hod.firebase_uid:
        sync_update_firebase_user(
            hod.firebase_uid,
            email=hod.email,
            full_name=hod.full_name,
            disabled=not hod.is_active,
        )

    rev_count = db.scalars(
        select(func.count(VerificationLog.id)).where(VerificationLog.reviewer_id == hod_id)
    ).one()

    return AdminHODItem(
        id=hod.id,
        full_name=hod.full_name,
        email=hod.email,
        role=hod.role,
        is_active=hod.is_active,
        firebase_uid=hod.firebase_uid,
        created_at=hod.created_at,
        staff_id=profile.staff_id,
        department=profile.department,
        designation=profile.designation,
        reviews_count=rev_count,
    )


@router.patch(
    "/hods/{hod_id}/status",
    response_model=AdminOperationResult,
    summary="Activate or deactivate an HOD account",
)
def update_hod_status(
    hod_id: uuid.UUID,
    payload: AdminStatusUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOperationResult:
    hod = db.get(User, hod_id)
    if not hod or hod.role != UserRole.HOD:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HOD account not found.")

    dept = hod.hod_profile.department if hod.hod_profile else "CCE"

    if payload.is_active:
        conflict = db.scalars(
            select(User)
            .join(HodProfile, User.id == HodProfile.user_id)
            .where(
                User.role == UserRole.HOD,
                User.is_active.is_(True),
                User.id != hod_id,
                HodProfile.department == dept,
            )
        ).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot activate: department '{dept}' already has an active HOD ({conflict.full_name}).",
            )

    hod.is_active = payload.is_active
    db.add(hod)

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_hod_status",
        target_type="hod",
        target_id=str(hod.id),
        metadata={"is_active": payload.is_active, "department": dept},
    )
    db.commit()

    if hod.firebase_uid:
        sync_set_firebase_disabled(hod.firebase_uid, disabled=not payload.is_active)

    state_str = "activated" if payload.is_active else "deactivated"
    return AdminOperationResult(
        success=True,
        message=f"HOD account {state_str} successfully.",
        affected_id=hod.id,
    )


@router.post(
    "/hods/{hod_id}/delete",
    response_model=AdminOperationResult,
    summary="Delete an HOD account",
    description="Requires safe replacement if department has active members. Admin self-deletion strictly prohibited.",
)
def delete_hod(
    hod_id: uuid.UUID,
    payload: AdminHODDeleteRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOperationResult:
    return delete_hod_account(
        db,
        hod_id=hod_id,
        replacement_hod_id=payload.replacement_hod_id,
        admin_user=current_user,
    )


@router.post(
    "/hods/{hod_id}/reset-password",
    response_model=AdminResetUserPasswordResponse,
    summary="Securely reset a department HOD's login password",
    description=(
        "Enforces Administrator-only authorization. Securely updates the HOD's password in "
        "PostgreSQL (Argon2id) and Firebase Authentication (if linked), enforces mandatory password change "
        "if requested, and records a safe audit entry without ever storing or logging plaintext passwords."
    ),
)
def reset_hod_password(
    hod_id: uuid.UUID,
    payload: AdminResetUserPasswordRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminResetUserPasswordResponse:
    return _execute_user_password_reset(
        target_user_id=hod_id,
        expected_role=UserRole.HOD,
        payload=payload,
        current_user=current_user,
        db=db,
    )


@router.post(
    "/users/{user_id}/reset-password",
    response_model=AdminResetUserPasswordResponse,
    summary="Securely reset a managed user's login password (Mentor, HOD, or Student)",
    description=(
        "Role-aware password reset endpoint. Enforces Administrator-only authorization. "
        "Validates target role is one of MENTOR, HOD, or STUDENT. Rejects admin self-reset."
    ),
)
def reset_user_password(
    user_id: uuid.UUID,
    payload: AdminResetUserPasswordRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminResetUserPasswordResponse:
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )
    if target_user.role not in [UserRole.MENTOR, UserRole.HOD, UserRole.STUDENT]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reset password for role '{target_user.role.value}'. Supported roles: mentor, hod, student.",
        )
    return _execute_user_password_reset(
        target_user_id=user_id,
        expected_role=target_user.role,
        payload=payload,
        current_user=current_user,
        db=db,
    )


# ==============================================================================
# Google Drive Cleanup Retry Endpoint
# ==============================================================================

@router.post(
    "/cleanup/drive-file/{drive_file_id}",
    response_model=AdminOperationResult,
    summary="Retry deleting an unlinked Google Drive file binary",
    description="Allows administrator to retry failed Google Drive binary cleanup without leaving orphaned cloud files.",
)
def retry_drive_cleanup(
    drive_file_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOperationResult:
    drive_service = get_drive_service(db)
    if not drive_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Drive integration is not configured.",
        )

    try:
        drive_service.delete_file(drive_file_id)
        record_audit_log(
            db,
            actor_id=current_user.id,
            action="retry_drive_cleanup_success",
            target_type="drive_file",
            target_id=drive_file_id,
            metadata={"status": "cleaned"},
        )
        db.commit()
        return AdminOperationResult(
            success=True,
            message=f"Google Drive file {drive_file_id} successfully deleted.",
        )
    except Exception as exc:
        logger.error("Retry Google Drive deletion failed for %s: %s", drive_file_id, exc)
        return AdminOperationResult(
            success=False,
            message=f"Failed to delete Google Drive file {drive_file_id}: {exc}",
            failed_drive_file_ids=[drive_file_id],
            retry_drive_cleanup_needed=True,
        )


# ==============================================================================
# Student Google Drive Folder Provisioning & Audit Endpoints
# ==============================================================================

@router.get(
    "/drive/audit",
    response_model=DriveFolderAuditReport,
    summary="Read-only audit of student Google Drive folders",
    description="Inspects PostgreSQL student records and Google Drive folders without making any modifications.",
)
def get_student_drive_audit(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DriveFolderAuditReport:
    drive_service = get_drive_service()
    return audit_student_drive_folders(db, drive_service)


@router.post(
    "/drive/provision-folders",
    response_model=DriveFolderProvisionResponse,
    summary="Provision or link dedicated Google Drive folders for students",
    description=(
        "Idempotently creates or reuses dedicated folders ({REGISTER_NUMBER}_{NORMALIZED_NAME}) "
        "under the configured Google Drive parent folder. "
        "When dry_run=True (default), simulates the process without modifying Drive or the database."
    ),
)
def provision_student_folders(
    dry_run: bool = Query(True, description="Simulate without modifying Drive or database"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DriveFolderProvisionResponse:
    drive_service = get_drive_service()
    try:
        result = provision_student_drive_folders(db, drive_service, dry_run=dry_run)
        if not dry_run:
            record_audit_log(
                db,
                actor_id=current_user.id,
                action="provision_student_drive_folders",
                target_type="google_drive_folder",
                target_id=drive_service.root_folder_id or "root",
                metadata={
                    "created": result["created"],
                    "reused": result["reused"],
                    "already_provisioned": result["already_provisioned"],
                    "failed": result["failed"],
                },
            )
            db.commit()
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Drive folder provisioning error: {exc}",
        )


# ==============================================================================
# Semester Governance & Drive Subfolder Provisioning
# ==============================================================================

@router.get(
    "/semesters",
    response_model=List[SemesterResponse],
    summary="List all academic semesters and availability",
    description="Administrative catalogue of all 8 semesters with active submission availability.",
)
def list_admin_semesters(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[SemesterResponse]:
    semesters = db.scalars(
        select(Semester).order_by(Semester.semester_number.asc())
    ).all()
    return [SemesterResponse.model_validate(s) for s in semesters]


@router.patch(
    "/semesters/{semester_id}",
    response_model=SemesterResponse,
    summary="Update semester availability for student achievement submissions",
    description=(
        "Enables or disables an academic semester for new submissions. "
        "Disabling a semester does not delete achievements, evidence metadata, files, or historical records."
    ),
)
def update_semester_availability(
    semester_id: uuid.UUID,
    payload: SemesterUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SemesterResponse:
    semester = db.get(Semester, semester_id)
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Academic semester with ID '{semester_id}' not found.",
        )

    previous_status = semester.is_enabled
    semester.is_enabled = payload.is_enabled
    if payload.display_name:
        semester.display_name = payload.display_name.strip()

    db.add(semester)

    # Count existing submissions in this semester
    sub_count = db.scalars(
        select(func.count(Achievement.id)).where(Achievement.semester_id == semester.id)
    ).one()

    record_audit_log(
        db,
        actor_id=current_user.id,
        action="update_semester_availability",
        target_type="semester",
        target_id=str(semester.id),
        metadata={
            "semester_number": semester.semester_number,
            "previous_status": previous_status,
            "new_status": semester.is_enabled,
            "existing_submissions_count": sub_count,
        },
    )
    db.commit()
    db.refresh(semester)
    return SemesterResponse.model_validate(semester)


@router.get(
    "/semesters/drive-audit",
    response_model=SemesterDriveAuditReport,
    summary="Dry-run audit of student semester subfolders in Google Drive",
    description=(
        "Read-only inspection of Semesters 1-3 subfolders under each student's folder. "
        "Does not create or alter any folders or database records."
    ),
)
def get_semester_drive_audit(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SemesterDriveAuditReport:
    drive_service = get_drive_service()
    report = audit_student_semester_folders(db, drive_service, target_semesters=[1, 2, 3])
    return SemesterDriveAuditReport.model_validate(report)


@router.post(
    "/semesters/provision-folders",
    response_model=SemesterDriveProvisionResponse,
    summary="Idempotently provision Semester 1-3 folders under student folders",
    description=(
        "Prepares separate folders for Semesters 1, 2, and 3 inside each student's folder. "
        "When dry_run=True (default), simulates without modifying Drive or the database."
    ),
)
def provision_semester_folders(
    dry_run: bool = Query(True, description="Simulate without modifying Drive or database"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SemesterDriveProvisionResponse:
    drive_service = get_drive_service()
    try:
        result = provision_student_semester_folders(
            db,
            drive_service,
            target_semesters=[1, 2, 3],
            dry_run=dry_run,
        )
        if not dry_run:
            record_audit_log(
                db,
                actor_id=current_user.id,
                action="provision_student_semester_drive_folders",
                target_type="google_drive_semester_folders",
                target_id=drive_service.root_folder_id or "root",
                metadata={
                    "created_folders": result["created_folders"],
                    "reused_folders": result["reused_folders"],
                    "already_mapped": result["already_mapped"],
                    "failed": result["failed"],
                },
            )
            db.commit()
        return SemesterDriveProvisionResponse.model_validate(result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semester Drive folder provisioning error: {exc}",
        )
