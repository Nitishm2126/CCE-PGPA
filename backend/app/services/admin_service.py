import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.core.firebase import get_firebase_app
from firebase_admin import auth as fb_auth
from app.core.security import get_password_hash, verify_password
from app.models.achievement import Achievement
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog
from app.models.file import AchievementFile
from app.models.review import VerificationLog
from app.models.user import HodProfile, MentorProfile, StudentProfile, User, UserRole
from app.schemas.admin import (
    AdminEmailUpdateRequest,
    AdminEmailUpdateResponse,
    AdminOperationResult,
    AdminSendVerificationEmailResponse,
    AdminVerificationStatusResponse,
    ProvisioningExecuteRequest,
    ProvisioningExecuteResponse,
    ProvisioningPreviewItem,
    ProvisioningPreviewResponse,
    ProvisioningResultItem,
    RosterImportResponse,
)
from app.services.drive_service import get_drive_service
from app.services.firebase_service import (
    sync_create_firebase_user,
    sync_delete_firebase_user,
    sync_set_firebase_disabled,
    sync_update_firebase_user,
)

logger = logging.getLogger(__name__)


def record_audit_log(
    db: Session,
    actor_id: Optional[uuid.UUID],
    action: str,
    target_type: str,
    target_id: Optional[str],
    metadata: Dict[str, Any],
) -> AuditLog:
    """Helper to record security audit logs."""
    log = AuditLog(
        id=uuid.uuid4(),
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        action_metadata=metadata,
    )
    db.add(log)
    return log


# ==============================================================================
# Student Business Logic
# ==============================================================================

def delete_student_login_access(
    db: Session,
    student_id: uuid.UUID,
    admin_user: User,
) -> AdminOperationResult:
    """
    Option 2: Delete login access.
    Removes/disables Firebase Auth login, removes firebase_uid linkage,
    and marks user as inactive in PostgreSQL while strictly retaining all
    profiles, submissions, files, and review history.
    """
    student = db.get(User, student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student account not found (id={student_id}).",
        )

    fb_uid = student.firebase_uid
    reg_no = student.student_profile.register_number if student.student_profile else "N/A"

    # 1. Update PostgreSQL state
    student.firebase_uid = None
    student.is_active = False
    db.add(student)

    # 2. Audit log
    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="delete_student_login_access",
        target_type="student",
        target_id=str(student.id),
        metadata={
            "register_number": reg_no,
            "email": student.email,
            "previous_firebase_uid": fb_uid,
        },
    )

    db.commit()

    # 3. Synchronize with Firebase Auth (remove Firebase login)
    if fb_uid:
        sync_delete_firebase_user(fb_uid)

    return AdminOperationResult(
        success=True,
        message=f"Login access deleted for student {student.full_name} ({reg_no}). Academic records preserved.",
        affected_id=student.id,
        delete_mode="delete_login",
    )


def deactivate_student_account(
    db: Session,
    student_id: uuid.UUID,
    admin_user: User,
) -> AdminOperationResult:
    """
    Option 1: Deactivate account.
    Marks user inactive in PostgreSQL and disables Firebase account.
    Retains all records, profiles, and submissions intact.
    """
    student = db.get(User, student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student account not found (id={student_id}).",
        )

    reg_no = student.student_profile.register_number if student.student_profile else "N/A"
    student.is_active = False
    db.add(student)

    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="deactivate_student",
        target_type="student",
        target_id=str(student.id),
        metadata={"register_number": reg_no, "email": student.email},
    )
    db.commit()

    if student.firebase_uid:
        sync_set_firebase_disabled(student.firebase_uid, disabled=True)

    return AdminOperationResult(
        success=True,
        message=f"Student {student.full_name} ({reg_no}) deactivated successfully. All records preserved.",
        affected_id=student.id,
        delete_mode="deactivate",
    )


def permanently_delete_student(
    db: Session,
    student_id: uuid.UUID,
    confirmation_register_number: Optional[str],
    admin_user: User,
) -> AdminOperationResult:
    """
    Option 3: Permanently delete student and associated data.
    Requires explicit confirmation matching the student's register number.
    Deletes Google Drive files with retryable failure tracking.
    Cleans up PostgreSQL relational records in safe dependency order.
    Removes Firebase Auth user.
    """
    student = db.get(User, student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student account not found (id={student_id}).",
        )

    profile = student.student_profile
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student profile record is missing. Cannot verify register number.",
        )

    expected_reg_no = profile.register_number.strip().upper()
    received_reg_no = (confirmation_register_number or "").strip().upper()

    if expected_reg_no != received_reg_no:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Register number verification mismatch. Expected '{profile.register_number}', "
                f"received '{confirmation_register_number}'. Permanent deletion aborted for safety."
            ),
        )

    student_email = student.email
    student_name = student.full_name
    fb_uid = student.firebase_uid

    # 1. Collect all achievements and evidence files
    achievements = db.scalars(
        select(Achievement).where(Achievement.student_id == student_id)
    ).all()
    achievement_ids = [a.id for a in achievements]

    file_stmt = select(AchievementFile).where(
        or_(
            AchievementFile.achievement_id.in_(achievement_ids) if achievement_ids else False,
            AchievementFile.uploaded_by == student_id,
        )
    )
    files = db.scalars(file_stmt).all() if achievement_ids else []

    # 2. Cleanup Google Drive file binaries
    failed_drive_cleanups: List[str] = []
    drive_service = get_drive_service(db)

    for f_rec in files:
        if f_rec.drive_file_id:
            try:
                if drive_service.is_configured:
                    drive_service.delete_file(f_rec.drive_file_id)
            except Exception as e:
                logger.error("Failed to delete Google Drive file %s: %s", f_rec.drive_file_id, e)
                failed_drive_cleanups.append(f_rec.drive_file_id)

    # 3. Clean up database records in strict dependency order
    # a. Achievement files (foreign key RESTRICT on uploaded_by, CASCADE on achievement_id)
    for f_rec in files:
        db.delete(f_rec)
    db.flush()

    # b. Verification logs for student's achievements
    if achievement_ids:
        logs = db.scalars(
            select(VerificationLog).where(VerificationLog.achievement_id.in_(achievement_ids))
        ).all()
        for log in logs:
            db.delete(log)
        db.flush()

    # c. Achievements
    for ach in achievements:
        db.delete(ach)
    db.flush()

    # d. Mentor assignments
    assignments = db.scalars(
        select(MentorAssignment).where(MentorAssignment.student_id == student_id)
    ).all()
    for assign in assignments:
        db.delete(assign)
    db.flush()

    # e. User (automatically cascades student_profile)
    db.delete(student)

    # g. Audit log
    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="permanent_delete_student",
        target_type="student",
        target_id=str(student_id),
        metadata={
            "register_number": expected_reg_no,
            "email": student_email,
            "full_name": student_name,
            "deleted_achievements_count": len(achievements),
            "deleted_files_count": len(files),
            "failed_drive_file_ids": failed_drive_cleanups,
        },
    )

    db.commit()

    # 4. Remove Firebase user account
    if fb_uid:
        sync_delete_firebase_user(fb_uid)

    msg = f"Student {student_name} ({expected_reg_no}) and all associated data permanently deleted."
    if failed_drive_cleanups:
        msg += f" Note: {len(failed_drive_cleanups)} Google Drive file(s) require manual/retry cleanup."

    return AdminOperationResult(
        success=True,
        message=msg,
        affected_id=student_id,
        delete_mode="permanent",
        deleted_achievements_count=len(achievements),
        deleted_files_count=len(files),
        failed_drive_file_ids=failed_drive_cleanups,
        retry_drive_cleanup_needed=len(failed_drive_cleanups) > 0,
    )


# ==============================================================================
# Faculty Mentor Business Logic
# ==============================================================================

def reassign_mentor_students(
    db: Session,
    source_mentor_id: uuid.UUID,
    target_mentor_id: uuid.UUID,
    admin_user: User,
    student_ids: Optional[List[uuid.UUID]] = None,
) -> int:
    """
    Reassigns students from source mentor to target mentor.
    Closes active assignments and creates new active assignments under target mentor.
    """
    if source_mentor_id == target_mentor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target mentor cannot be the same.",
        )

    target_mentor = db.get(User, target_mentor_id)
    if not target_mentor or target_mentor.role != UserRole.MENTOR or not target_mentor.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target mentor does not exist or is inactive.",
        )

    stmt = select(MentorAssignment).where(
        MentorAssignment.mentor_id == source_mentor_id,
        MentorAssignment.is_active.is_(True),
    )
    if student_ids:
        stmt = stmt.where(MentorAssignment.student_id.in_(student_ids))

    active_assignments = db.scalars(stmt).all()
    now = datetime.now(timezone.utc)

    for assign in active_assignments:
        assign.is_active = False
        assign.ended_at = now
        db.add(assign)

        new_assignment = MentorAssignment(
            id=uuid.uuid4(),
            mentor_id=target_mentor_id,
            student_id=assign.student_id,
            assigned_by=admin_user.id,
            assigned_at=now,
            is_active=True,
        )
        db.add(new_assignment)

        # Update original_mentor_name on profile if present
        student_profile = db.scalars(
            select(StudentProfile).where(StudentProfile.user_id == assign.student_id)
        ).first()
        if student_profile:
            student_profile.original_mentor_name = target_mentor.full_name
            db.add(student_profile)

    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="reassign_mentor_students",
        target_type="mentor",
        target_id=str(source_mentor_id),
        metadata={
            "source_mentor_id": str(source_mentor_id),
            "target_mentor_id": str(target_mentor_id),
            "reassigned_count": len(active_assignments),
        },
    )

    db.flush()
    return len(active_assignments)


def delete_mentor_account(
    db: Session,
    mentor_id: uuid.UUID,
    reassign_mentor_id: Optional[uuid.UUID],
    admin_user: User,
) -> AdminOperationResult:
    """
    Deletes a faculty mentor account.
    Enforces student reassignment before deletion.
    Preserves student submissions and review history by reassigning VerificationLogs.
    Cleans up PostgreSQL and Firebase Auth states consistently.
    """
    if mentor_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account.",
        )

    mentor = db.get(User, mentor_id)
    if not mentor or mentor.role != UserRole.MENTOR:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty mentor not found (id={mentor_id}).",
        )

    # 1. Check actively assigned students
    active_assign_count = db.scalars(
        select(func.count(MentorAssignment.id)).where(
            MentorAssignment.mentor_id == mentor_id,
            MentorAssignment.is_active.is_(True),
        )
    ).one()

    # 2. Check review logs given by this mentor
    reviews_count = db.scalars(
        select(func.count(VerificationLog.id)).where(VerificationLog.reviewer_id == mentor_id)
    ).one()

    if active_assign_count > 0 and not reassign_mentor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Mentor has {active_assign_count} active student assignment(s). "
                f"You must designate an active mentor to reassign these students before deleting this account."
            ),
        )

    reassigned_count = 0
    if reassign_mentor_id:
        reassigned_count = reassign_mentor_students(
            db,
            source_mentor_id=mentor_id,
            target_mentor_id=reassign_mentor_id,
            admin_user=admin_user,
        )

        # Preserve review history: reassign verification logs so RESTRICT constraint is met
        if reviews_count > 0:
            db.execute(
                update(VerificationLog)
                .where(VerificationLog.reviewer_id == mentor_id)
                .values(reviewer_id=reassign_mentor_id)
            )

    fb_uid = mentor.firebase_uid
    mentor_name = mentor.full_name
    mentor_email = mentor.email

    # 3. Clean up mentor's historical assignments and profile
    db.execute(
        update(MentorAssignment)
        .where(MentorAssignment.assigned_by == mentor_id)
        .values(assigned_by=None)
    )

    all_mentor_assignments = db.scalars(
        select(MentorAssignment).where(MentorAssignment.mentor_id == mentor_id)
    ).all()
    for ma in all_mentor_assignments:
        db.delete(ma)
    db.flush()

    db.delete(mentor)

    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="delete_mentor",
        target_type="mentor",
        target_id=str(mentor_id),
        metadata={
            "full_name": mentor_name,
            "email": mentor_email,
            "reassigned_students_count": reassigned_count,
            "preserved_reviews_count": reviews_count,
            "reassign_mentor_id": str(reassign_mentor_id) if reassign_mentor_id else None,
        },
    )

    db.commit()

    if fb_uid:
        sync_delete_firebase_user(fb_uid)

    return AdminOperationResult(
        success=True,
        message=(
            f"Mentor {mentor_name} deleted successfully. {reassigned_count} student(s) reassigned, "
            f"and {reviews_count} review record(s) preserved."
        ),
        affected_id=mentor_id,
    )


# ==============================================================================
# HOD Business Logic
# ==============================================================================

def delete_hod_account(
    db: Session,
    hod_id: uuid.UUID,
    replacement_hod_id: Optional[uuid.UUID],
    admin_user: User,
) -> AdminOperationResult:
    """
    Deletes an HOD account.
    - Never allows Admin to delete their own account.
    - Requires a safe replacement if the department requires an active HOD.
    - Preserves department data and student/mentor review history.
    - Keeps Firebase and PostgreSQL states consistent.
    """
    if hod_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account.",
        )

    hod = db.get(User, hod_id)
    if not hod or hod.role != UserRole.HOD:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"HOD account not found (id={hod_id}).",
        )

    dept = hod.hod_profile.department if hod.hod_profile else "CCE"

    # Check if this HOD is active and is the only active HOD in this department
    active_dept_hods = db.scalars(
        select(User).where(
            User.role == UserRole.HOD,
            User.is_active.is_(True),
            User.id != hod_id,
        )
    ).all()

    # Check department students count
    dept_students_count = db.scalars(
        select(func.count(StudentProfile.id)).where(StudentProfile.department == dept)
    ).one()

    if replacement_hod_id:
        replacement = db.get(User, replacement_hod_id)
        if not replacement or replacement.id == hod_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Replacement HOD account is invalid or the same as the deleted HOD.",
            )
        replacement.role = UserRole.HOD
        replacement.is_active = True
        db.add(replacement)
        if not replacement.hod_profile:
            r_profile = HodProfile(
                id=uuid.uuid4(),
                user_id=replacement.id,
                department=dept,
                designation="Head of Department",
            )
            db.add(r_profile)
        else:
            replacement.hod_profile.department = dept
            db.add(replacement.hod_profile)
        db.flush()
    elif hod.is_active and len(active_dept_hods) == 0 and dept_students_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Department '{dept}' currently has {dept_students_count} student(s) and requires an active HOD. "
                f"Please designate an active replacement HOD before deleting this account."
            ),
        )

    # Preserve review history given by HOD
    reviews_count = db.scalars(
        select(func.count(VerificationLog.id)).where(VerificationLog.reviewer_id == hod_id)
    ).one()
    if reviews_count > 0:
        target_reviewer = replacement_hod_id if replacement_hod_id else admin_user.id
        db.execute(
            update(VerificationLog)
            .where(VerificationLog.reviewer_id == hod_id)
            .values(reviewer_id=target_reviewer)
        )

    fb_uid = hod.firebase_uid
    hod_name = hod.full_name
    hod_email = hod.email

    db.delete(hod)

    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="delete_hod",
        target_type="hod",
        target_id=str(hod_id),
        metadata={
            "full_name": hod_name,
            "email": hod_email,
            "department": dept,
            "replacement_hod_id": str(replacement_hod_id) if replacement_hod_id else None,
            "preserved_reviews_count": reviews_count,
        },
    )

    db.commit()

    if fb_uid:
        sync_delete_firebase_user(fb_uid)

    return AdminOperationResult(
        success=True,
        message=f"HOD {hod_name} deleted successfully. Department records and {reviews_count} review logs preserved.",
        affected_id=hod_id,
    )


# ==============================================================================
# Bulk Login Provisioning Business Logic
# ==============================================================================

def get_provisioning_preview(db: Session, admin_user: User) -> ProvisioningPreviewResponse:
    """
    Performs a safe, read-only dry-run audit of all PostgreSQL users against Firebase Auth.
    Identifies accounts to create, existing accounts to link, and any anomalies.
    Never modifies real Firebase or PostgreSQL data.
    """
    users = db.execute(select(User).order_by(User.role, User.email)).scalars().all()

    app = get_firebase_app()
    fb_by_email = {}
    if app:
        try:
            for fb_u in fb_auth.list_users(app=app).iterate_all():
                if fb_u.email:
                    fb_by_email[fb_u.email.lower()] = fb_u
        except Exception as e:
            logger.warning("Failed to list Firebase users: %s", e)

    items: List[ProvisioningPreviewItem] = []
    by_role: Dict[str, int] = {}
    already_linked_count = 0
    needs_creation_count = 0
    exists_unlinked_count = 0
    conflicts_count = 0
    invalid_email_count = 0

    seen_emails = set()
    admin_email = admin_user.email

    for u in users:
        role_str = u.role.value
        by_role[role_str] = by_role.get(role_str, 0) + 1

        email_clean = (u.email or "").strip().lower()
        if not email_clean or "@" not in email_clean:
            invalid_email_count += 1
            items.append(
                ProvisioningPreviewItem(
                    user_id=u.id,
                    full_name=u.full_name,
                    email=u.email or "",
                    role=u.role,
                    is_active=u.is_active,
                    status="invalid_email",
                    firebase_uid=u.firebase_uid,
                    existing_firebase_uid=None,
                    notes="Missing or malformed email address in database.",
                )
            )
            continue

        if email_clean in seen_emails:
            conflicts_count += 1
            items.append(
                ProvisioningPreviewItem(
                    user_id=u.id,
                    full_name=u.full_name,
                    email=u.email,
                    role=u.role,
                    is_active=u.is_active,
                    status="conflict",
                    firebase_uid=u.firebase_uid,
                    existing_firebase_uid=None,
                    notes="Duplicate email detected in PostgreSQL.",
                )
            )
            continue
        seen_emails.add(email_clean)

        fb_record = fb_by_email.get(email_clean)

        # Preserve Admin account
        if u.role == UserRole.ADMIN:
            already_linked_count += 1
            items.append(
                ProvisioningPreviewItem(
                    user_id=u.id,
                    full_name=u.full_name,
                    email=u.email,
                    role=u.role,
                    is_active=u.is_active,
                    status="already_linked",
                    firebase_uid=u.firebase_uid,
                    existing_firebase_uid=fb_record.uid if fb_record else None,
                    notes="Existing Admin account — preserved without modification.",
                )
            )
            continue

        if fb_record:
            if u.firebase_uid == fb_record.uid:
                already_linked_count += 1
                items.append(
                    ProvisioningPreviewItem(
                        user_id=u.id,
                        full_name=u.full_name,
                        email=u.email,
                        role=u.role,
                        is_active=u.is_active,
                        status="already_linked",
                        firebase_uid=u.firebase_uid,
                        existing_firebase_uid=fb_record.uid,
                        notes="Firebase account exists and is linked in database. Password preserved.",
                    )
                )
            elif u.firebase_uid is None:
                exists_unlinked_count += 1
                items.append(
                    ProvisioningPreviewItem(
                        user_id=u.id,
                        full_name=u.full_name,
                        email=u.email,
                        role=u.role,
                        is_active=u.is_active,
                        status="exists_unlinked",
                        firebase_uid=None,
                        existing_firebase_uid=fb_record.uid,
                        notes="Account exists in Firebase Auth. Will link UID without resetting password.",
                    )
                )
            else:
                conflicts_count += 1
                items.append(
                    ProvisioningPreviewItem(
                        user_id=u.id,
                        full_name=u.full_name,
                        email=u.email,
                        role=u.role,
                        is_active=u.is_active,
                        status="conflict",
                        firebase_uid=u.firebase_uid,
                        existing_firebase_uid=fb_record.uid,
                        notes=f"Conflicting UID: DB has '{u.firebase_uid}' but Firebase has '{fb_record.uid}'.",
                    )
                )
        else:
            needs_creation_count += 1
            items.append(
                ProvisioningPreviewItem(
                    user_id=u.id,
                    full_name=u.full_name,
                    email=u.email,
                    role=u.role,
                    is_active=u.is_active,
                    status="needs_creation",
                    firebase_uid=u.firebase_uid,
                    existing_firebase_uid=None,
                    notes="Missing from Firebase Auth. Will create account with initial password 'cce@123'.",
                )
            )

    return ProvisioningPreviewResponse(
        total_users=len(users),
        by_role=by_role,
        already_linked_count=already_linked_count,
        needs_creation_count=needs_creation_count,
        exists_unlinked_count=exists_unlinked_count,
        conflicts_count=conflicts_count,
        invalid_email_count=invalid_email_count,
        initial_password="cce@123",
        admin_account_email=admin_email,
        admin_account_preserved=True,
        items=items,
    )


def execute_bulk_provisioning(
    db: Session,
    admin_user: User,
    req: ProvisioningExecuteRequest,
) -> ProvisioningExecuteResponse:
    """
    Executes bulk login account provisioning for all missing or unlinked users.
    Enforces strict safety rules:
    - Requires explicit Admin confirmation.
    - Preserves Admin account untouched.
    - Does not reset existing passwords unless reset_existing_passwords is True.
    - Sets must_change_password=True for newly provisioned accounts.
    - Updates Argon2id password hash in DB for dual compatibility.
    - Records audit log.
    """
    if not req.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit Admin confirmation is required before provisioning real Firebase accounts.",
        )

    app = get_firebase_app()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin SDK is not initialized. Cannot provision accounts.",
        )

    users = db.execute(select(User).order_by(User.role, User.email)).scalars().all()

    fb_by_email = {}
    try:
        for fb_u in fb_auth.list_users(app=app).iterate_all():
            if fb_u.email:
                fb_by_email[fb_u.email.lower()] = fb_u
    except Exception as e:
        logger.warning("Could not pre-fetch Firebase users: %s", e)

    results: List[ProvisioningResultItem] = []
    created_count = 0
    reused_count = 0
    skipped_count = 0
    failed_count = 0

    for u in users:
        # Preserve Admin account unconditionally
        if u.role == UserRole.ADMIN:
            skipped_count += 1
            results.append(
                ProvisioningResultItem(
                    user_id=u.id,
                    email=u.email,
                    role=u.role.value,
                    action="skipped_already_linked",
                    firebase_uid=u.firebase_uid,
                    message="Admin account preserved.",
                )
            )
            continue

        email_clean = (u.email or "").strip().lower()
        if not email_clean:
            failed_count += 1
            results.append(
                ProvisioningResultItem(
                    user_id=u.id,
                    email=u.email or "none",
                    role=u.role.value,
                    action="failed",
                    message="Missing email address.",
                )
            )
            continue

        fb_record = fb_by_email.get(email_clean)

        # 1. Already linked and present in Firebase
        if fb_record and u.firebase_uid == fb_record.uid:
            if req.reset_existing_passwords:
                try:
                    fb_auth.update_user(fb_record.uid, password=req.initial_password, app=app)
                    u.password_hash = get_password_hash(req.initial_password)
                    u.must_change_password = True
                    db.add(u)
                    reused_count += 1
                    results.append(
                        ProvisioningResultItem(
                            user_id=u.id,
                            email=u.email,
                            role=u.role.value,
                            action="reused_linked",
                            firebase_uid=fb_record.uid,
                            message="Linked account password reset per Admin request.",
                        )
                    )
                except Exception as exc:
                    failed_count += 1
                    results.append(
                        ProvisioningResultItem(
                            user_id=u.id,
                            email=u.email,
                            role=u.role.value,
                            action="failed",
                            message=f"Failed to reset existing password: {exc}",
                        )
                    )
            else:
                skipped_count += 1
                results.append(
                    ProvisioningResultItem(
                        user_id=u.id,
                        email=u.email,
                        role=u.role.value,
                        action="skipped_already_linked",
                        firebase_uid=u.firebase_uid,
                        message="Account already active in Firebase Auth.",
                    )
                )
            continue

        # 2. Exists in Firebase Auth but UID was unlinked
        if fb_record:
            u.firebase_uid = fb_record.uid
            if req.reset_existing_passwords:
                try:
                    fb_auth.update_user(fb_record.uid, password=req.initial_password, app=app)
                    u.password_hash = get_password_hash(req.initial_password)
                    u.must_change_password = True
                except Exception as exc:
                    logger.warning("Could not reset password for %s: %s", email_clean, exc)
            db.add(u)
            reused_count += 1
            results.append(
                ProvisioningResultItem(
                    user_id=u.id,
                    email=u.email,
                    role=u.role.value,
                    action="reused_linked",
                    firebase_uid=fb_record.uid,
                    message="Reused existing Firebase account and linked UID.",
                )
            )
            continue

        # 3. Needs creation
        try:
            new_user_record = fb_auth.create_user(
                email=email_clean,
                display_name=u.full_name,
                password=req.initial_password,
                disabled=not u.is_active,
                email_verified=False,
                app=app,
            )
            u.firebase_uid = new_user_record.uid
            u.password_hash = get_password_hash(req.initial_password)
            u.must_change_password = True
            db.add(u)
            created_count += 1
            results.append(
                ProvisioningResultItem(
                    user_id=u.id,
                    email=u.email,
                    role=u.role.value,
                    action="created",
                    firebase_uid=new_user_record.uid,
                    message=f"Created Firebase Auth account with initial password '{req.initial_password}'. First-login password change required.",
                )
            )
        except Exception as exc:
            failed_count += 1
            results.append(
                ProvisioningResultItem(
                    user_id=u.id,
                    email=u.email,
                    role=u.role.value,
                    action="failed",
                    message=f"Failed to create Firebase account: {exc}",
                )
            )

    db.commit()

    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="bulk_provision_accounts",
        target_type="system",
        target_id=None,
        metadata={
            "total_processed": len(users),
            "created_count": created_count,
            "reused_count": reused_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count,
            "reset_existing_passwords": req.reset_existing_passwords,
        },
    )

    return ProvisioningExecuteResponse(
        success=failed_count == 0,
        message=f"Bulk provisioning complete: {created_count} created, {reused_count} linked, {skipped_count} skipped, {failed_count} failed.",
        total_processed=len(users),
        created_count=created_count,
        reused_count=reused_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        details=results,
    )


def update_user_email_by_admin(
    db: Session,
    admin_user: User,
    target_user_id: uuid.UUID,
    payload: AdminEmailUpdateRequest,
) -> AdminEmailUpdateResponse:
    """
    Security-critical email update initiated by System Administrator.
    - Requires fresh administrator reauthentication using admin_password.
    - Validates matching confirmation.
    - Checks uniqueness in PostgreSQL.
    - Checks uniqueness in Firebase Auth.
    - Updates Firebase Auth email and sets email_verified=False (requiring verification).
    - Updates PostgreSQL user email.
    - Writes immutable audit log with full details.
    """
    clean_new_email = str(payload.new_email).strip().lower()
    clean_confirm_email = str(payload.confirm_new_email).strip().lower()

    # 1. Validate email confirmation
    if clean_new_email != clean_confirm_email:
        record_audit_log(
            db,
            actor_id=admin_user.id,
            action="admin_edit_user_email",
            target_type="user",
            target_id=str(target_user_id),
            metadata={
                "requested_new_email": clean_new_email,
                "outcome": "failed",
                "failure_reason": "Email confirmation mismatch",
            },
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New email address and confirmation email address do not match.",
        )

    # 2. Fresh Administrator reauthentication
    if not admin_user.password_hash or not verify_password(payload.admin_password, admin_user.password_hash):
        record_audit_log(
            db,
            actor_id=admin_user.id,
            action="admin_edit_user_email",
            target_type="user",
            target_id=str(target_user_id),
            metadata={
                "requested_new_email": clean_new_email,
                "outcome": "failed",
                "failure_reason": "Administrator reauthentication failed",
            },
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator reauthentication failed. Invalid administrator password.",
        )

    # 3. Locate target user
    target_user = db.get(User, target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User account not found (id={target_user_id}).",
        )

    previous_email = target_user.email
    if clean_new_email == previous_email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New email address is identical to the current registered email.",
        )

    # 4. PostgreSQL duplicate check
    existing_pg = db.scalars(
        select(User).where(func.lower(User.email) == clean_new_email, User.id != target_user_id)
    ).first()
    if existing_pg:
        record_audit_log(
            db,
            actor_id=admin_user.id,
            action="admin_edit_user_email",
            target_type=target_user.role.value,
            target_id=str(target_user.id),
            metadata={
                "previous_email": previous_email,
                "requested_new_email": clean_new_email,
                "outcome": "failed",
                "failure_reason": "Duplicate email in PostgreSQL",
            },
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{clean_new_email}' is already registered to another account.",
        )

    # 5. Firebase duplicate check and update
    firebase_synced = False
    try:
        fb_app = get_firebase_app()
    except Exception:
        fb_app = None

    if fb_app:
        try:
            existing_fb = fb_auth.get_user_by_email(clean_new_email, app=fb_app)
            if existing_fb and existing_fb.uid != target_user.firebase_uid:
                record_audit_log(
                    db,
                    actor_id=admin_user.id,
                    action="admin_edit_user_email",
                    target_type=target_user.role.value,
                    target_id=str(target_user.id),
                    metadata={
                        "previous_email": previous_email,
                        "requested_new_email": clean_new_email,
                        "outcome": "failed",
                        "failure_reason": "Duplicate email in Firebase Auth",
                    },
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Email '{clean_new_email}' is already associated with another Firebase account.",
                )
        except fb_auth.UserNotFoundError:
            pass
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Could not check Firebase user by email: %s", e)

        # Update Firebase Auth if user has firebase_uid
        if target_user.firebase_uid:
            try:
                fb_auth.update_user(
                    target_user.firebase_uid,
                    email=clean_new_email,
                    email_verified=False,
                    app=fb_app,
                )
                firebase_synced = True
            except Exception as fb_err:
                logger.error("Failed to update Firebase email for user %s: %s", target_user.id, fb_err)
                record_audit_log(
                    db,
                    actor_id=admin_user.id,
                    action="admin_edit_user_email",
                    target_type=target_user.role.value,
                    target_id=str(target_user.id),
                    metadata={
                        "previous_email": previous_email,
                        "requested_new_email": clean_new_email,
                        "outcome": "failed",
                        "failure_reason": f"Firebase update error: {type(fb_err).__name__}",
                    },
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to synchronize updated email with Firebase Authentication.",
                )

    # 6. Update PostgreSQL user record
    target_user.email = clean_new_email
    db.add(target_user)

    # 7. Record successful audit event
    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="admin_edit_user_email",
        target_type=target_user.role.value,
        target_id=str(target_user.id),
        metadata={
            "previous_email": previous_email,
            "requested_new_email": clean_new_email,
            "firebase_uid": target_user.firebase_uid,
            "firebase_synced": firebase_synced,
            "outcome": "completed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    db.commit()
    db.refresh(target_user)

    return AdminEmailUpdateResponse(
        user_id=target_user.id,
        full_name=target_user.full_name,
        previous_email=previous_email,
        new_email=clean_new_email,
        role=target_user.role.value,
        status="pending_verification" if firebase_synced else "completed",
        firebase_synced=firebase_synced,
        message=f"Email address successfully updated from '{previous_email}' to '{clean_new_email}'.",
    )


def get_user_verification_status_by_admin(
    db: Session,
    admin_user: User,
    target_user_id: uuid.UUID,
) -> AdminVerificationStatusResponse:
    """
    Retrieves the live email verification status for any user directly from Firebase Auth.
    """
    target_user = db.get(User, target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User account not found (id={target_user_id}).",
        )

    is_verified = False
    fb_linked = bool(target_user.firebase_uid)

    try:
        fb_app = get_firebase_app()
    except Exception:
        fb_app = None

    if fb_app:
        if target_user.firebase_uid:
            try:
                fb_user = fb_auth.get_user(target_user.firebase_uid, app=fb_app)
                is_verified = bool(fb_user.email_verified)
            except Exception as e:
                logger.warning("Could not fetch Firebase user verification for %s: %s", target_user.id, e)
        elif target_user.email:
            try:
                fb_user = fb_auth.get_user_by_email(target_user.email.strip().lower(), app=fb_app)
                is_verified = bool(fb_user.email_verified)
                fb_linked = True
            except Exception:
                pass

    return AdminVerificationStatusResponse(
        user_id=target_user.id,
        email=target_user.email,
        email_verified=is_verified,
        firebase_linked=fb_linked,
        firebase_uid=target_user.firebase_uid,
        message="Verified" if is_verified else "Pending email verification",
    )


def send_user_verification_email_by_admin(
    db: Session,
    admin_user: User,
    target_user_id: uuid.UUID,
) -> AdminSendVerificationEmailResponse:
    """
    Generates a secure email verification link for any user via Firebase Admin SDK
    and records an immutable audit log.
    """
    target_user = db.get(User, target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User account not found (id={target_user_id}).",
        )

    clean_email = target_user.email.strip().lower()
    verification_link = None

    try:
        fb_app = get_firebase_app()
        verification_link = fb_auth.generate_email_verification_link(clean_email, app=fb_app)
    except Exception as e:
        logger.error("Failed to generate Firebase verification link for %s: %s", clean_email, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate Firebase email verification link: {e}",
        )

    record_audit_log(
        db,
        actor_id=admin_user.id,
        action="admin_send_verification_email",
        target_type=target_user.role.value,
        target_id=str(target_user.id),
        metadata={
            "email": clean_email,
            "outcome": "completed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    db.commit()

    return AdminSendVerificationEmailResponse(
        user_id=target_user.id,
        email=clean_email,
        success=True,
        message=f"Verification email link successfully generated for '{clean_email}'.",
        verification_link=verification_link,
    )


# ==============================================================================
# Protected Student Roster Import Service
# ==============================================================================

def parse_csv_content(csv_text: str) -> List[Dict[str, str]]:
    """Parse raw CSV text into a list of cleaned row dictionaries."""
    import csv
    lines = [line for line in csv_text.splitlines() if not line.strip().startswith("#") and line.strip()]
    if not lines:
        raise ValueError("Provided CSV content is empty or contains only comments.")
    reader = csv.DictReader(lines)
    if reader.fieldnames is None:
        raise ValueError("CSV is missing headers.")
    rows: List[Dict[str, str]] = []
    for raw_row in reader:
        cleaned_row = {k.strip(): v.strip() for k, v in raw_row.items() if k is not None and v is not None}
        if any(cleaned_row.values()):
            rows.append(cleaned_row)
    return rows


def import_roster_data(
    db: Session,
    csv_content: Optional[str] = None,
    initial_password: Optional[str] = None,
    provision_admin: bool = True,
    actor_id: Optional[uuid.UUID] = None,
    expected_count: Optional[int] = None,
    staff_csv_content: Optional[str] = None,
) -> RosterImportResponse:
    """
    Safely and idempotently imports the student cohort and staff into PostgreSQL.
    Accepts raw CSV content strings, or falls back to server data/import files.
    Enforces must_change_password=True, never exposes passwords or secrets,
    and preserves existing user accounts without modifying passwords or roles.
    """
    import secrets
    from pathlib import Path
    from app.cli.bootstrap_roster import (
        clean_csv_lines,
        execute_roster_import,
        validate_staff_roster,
        validate_students_roster,
    )
    from app.schemas.admin import RosterImportResponse

    # 1. Resolve staff records if provided or if server staff file exists
    hod_data = None
    mentors_data: List[Dict[str, Any]] = []
    backend_dir = Path(__file__).resolve().parent.parent.parent

    if staff_csv_content and staff_csv_content.strip():
        try:
            staff_rows = parse_csv_content(staff_csv_content)
            hod_data, mentors_data = validate_staff_roster(staff_rows, allow_missing_hod=True)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Staff roster validation failed: {e}",
            )
    else:
        staff_file = backend_dir / "data" / "import" / "staff_roster.csv"
        if staff_file.is_file():
            try:
                staff_rows = clean_csv_lines(staff_file)
                hod_data, mentors_data = validate_staff_roster(staff_rows, allow_missing_hod=True)
            except Exception as e:
                logger.warning("Optional server staff roster file had validation error: %s", e)

    # 2. Resolve student records
    raw_rows: List[Dict[str, str]] = []
    if csv_content and csv_content.strip():
        try:
            raw_rows = parse_csv_content(csv_content)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CSV parsing error: {e}",
            )
    else:
        roster_file = backend_dir / "data" / "import" / "students_roster.csv"
        if not roster_file.is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Roster file not found on server at '{roster_file}'. "
                    "Please provide CSV content in the request body (csv_content) or upload via the upload-csv endpoint."
                ),
            )
        try:
            raw_rows = clean_csv_lines(roster_file)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read server roster file: {e}",
            )

    # 3. Validate roster format
    try:
        validated_students = validate_students_roster(
            raw_rows=raw_rows,
            mentor_records=mentors_data if mentors_data else None,
            allow_unassigned_mentors=True,
            expected_count=expected_count,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Student roster validation failed: {e}",
        )

    # 4. Transactional import execution
    admin_created = False
    try:
        summary = execute_roster_import(
            session=db,
            hod_data=hod_data,
            mentors_data=mentors_data,
            students_data=validated_students,
            output_credentials_path=None,
            allow_unassigned_mentors=True,
            initial_password=initial_password,
        )

        # 5. Optional admin account provisioning
        if provision_admin:
            target_admin_email = "cce.pgpa@gmail.com"
            existing_admin = db.scalars(
                select(User).where(func.lower(User.email) == target_admin_email)
            ).first()
            if not existing_admin:
                admin_temp_pw = initial_password if initial_password else secrets.token_urlsafe(12)
                admin_user = User(
                    id=uuid.uuid4(),
                    full_name="CCE System Administrator",
                    email=target_admin_email,
                    password_hash=get_password_hash(admin_temp_pw),
                    firebase_uid="fjWQn2rGgsR3iVd97YgaZCvBsgB3",
                    role=UserRole.ADMIN,
                    is_active=True,
                    must_change_password=False,
                )
                db.add(admin_user)
                db.flush()
                admin_created = True

        # Audit log
        record_audit_log(
            db,
            actor_id=actor_id,
            action="admin_roster_bootstrap",
            target_type="student_roster",
            target_id=None,
            metadata={
                "students_created": summary["students_created"],
                "students_existing": summary["students_existing"],
                "mentors_created": summary.get("mentors_created", 0),
                "hod_created": bool(summary.get("hod_created")),
                "assignments_created": summary.get("assignments_created", 0),
                "admin_created": admin_created,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Failed to execute roster import: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Database import halted: {exc}",
        )

    has_admin = bool(db.scalars(select(User).where(User.role == UserRole.ADMIN)).first())

    mentors_created = summary.get("mentors_created", 0)
    mentors_existing = len(mentors_data) - mentors_created if mentors_data else 0

    return RosterImportResponse(
        success=True,
        message=(
            f"Roster import completed: {summary['students_created']} students created, "
            f"{summary['students_existing']} already existing. "
            f"{mentors_created} mentors created, "
            f"{summary.get('assignments_created', 0)} mentor assignments created."
        ),
        students_total_in_roster=len(validated_students),
        students_created=summary["students_created"],
        students_existing=summary["students_existing"],
        mentors_created=mentors_created,
        mentors_existing=mentors_existing,
        hod_created=bool(summary.get("hod_created")),
        admin_provisioned=admin_created or has_admin,
        assignments_created=summary.get("assignments_created", 0),
    )
