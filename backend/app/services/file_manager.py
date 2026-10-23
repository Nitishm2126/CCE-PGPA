import logging
import uuid
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog
from app.models.file import AchievementFile, FileCategory
from app.models.user import User, UserRole
from app.services.drive_service import GoogleDriveService, get_drive_service

logger = logging.getLogger(__name__)


def check_achievement_read_authorization(
    session: Session,
    current_user: User,
    achievement: Achievement,
) -> None:
    """
    Verifies caller has permission to view an achievement and its evidence files:
    - Student: Must own the achievement.
    - Mentor: Must have an active mentor assignment to the student.
    - HOD: Has department-wide read access.
    """
    if current_user.role == UserRole.STUDENT:
        if achievement.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot view evidence files belonging to another student.",
            )
    elif current_user.role == UserRole.MENTOR:
        assignment = session.scalar(
            select(MentorAssignment).where(
                MentorAssignment.mentor_id == current_user.id,
                MentorAssignment.student_id == achievement.student_id,
                MentorAssignment.is_active.is_(True),
            )
        )
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You are not assigned as a mentor to this student.",
            )
    elif current_user.role in (UserRole.HOD, UserRole.ADMIN):
        # HOD and System Administrator have institutional inspection permissions
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Unauthorized role.",
        )


def upload_achievement_file(
    session: Session,
    current_user: User,
    achievement_id: uuid.UUID,
    file_category: FileCategory,
    filename: str,
    content: bytes,
    content_type: Optional[str] = None,
    drive_service: Optional[GoogleDriveService] = None,
) -> AchievementFile:
    """
    Coordinates file validation, Google Drive upload, and PostgreSQL metadata persistence.
    Guarantees transactional integrity: if database insertion fails, the uploaded Drive file
    is automatically cleaned up. If cleanup fails, an orphan reconciliation audit log is written.
    """
    ds = drive_service or get_drive_service()

    # Verify storage configuration and authorization
    if not ds.is_configured:
        if ds.is_oauth_credentials_configured and not ds.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google Drive OAuth 2.0 authorization required. Visit Admin Console to connect.",
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Drive storage is not configured. Please contact the system administrator.",
        )

    # 1. Authorize achievement ownership
    achievement = session.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    if current_user.role == UserRole.STUDENT:
        if achievement.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot upload evidence to another student's achievement.",
            )
        if achievement.status == AchievementStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot upload evidence files to an approved achievement.",
            )
    elif current_user.role not in (UserRole.HOD,):
        # Only the student owner (or HOD administrator) can add files
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Only the student owner can upload evidence files.",
        )

    # 2. Validate file attributes
    try:
        clean_filename, validated_mime, size_bytes = ds.validate_file(
            filename=filename,
            content=content,
            content_type=content_type,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )

    # 3. Resolve student's dedicated folder in Google Drive (Semester folder or root student folder)
    folder_id = None
    try:
        from app.services.drive_provisioning import (
            ensure_student_folder,
            ensure_student_semester_folder,
        )
        if achievement.semester_id:
            folder_id = ensure_student_semester_folder(
                session=session,
                student_id=achievement.student_id,
                semester_id=achievement.semester_id,
                drive_service=ds,
            )
        else:
            folder_id = ensure_student_folder(
                session=session,
                student_id=achievement.student_id,
                drive_service=ds,
            )
    except Exception as e:
        logger.warning("Dedicated student folder resolution failed (%s), attempting fallback...", e)
        if hasattr(ds, "ensure_achievement_folder"):
            try:
                folder_id = ds.ensure_achievement_folder(
                    student_id=achievement.student_id,
                    achievement_id=achievement.id,
                )
            except Exception as e2:
                logger.error("Both dedicated folder and fallback folder resolution failed: %s", e2)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Google Drive folder management failed: {e}",
                )
        else:
            logger.error("Failed to ensure student Google Drive folder: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Google Drive folder management failed: {e}",
            )

    # 4. Upload binary to Google Drive
    try:
        drive_meta = ds.upload_file(
            content=content,
            filename=clean_filename,
            mime_type=validated_mime,
            folder_id=folder_id,
        )
    except Exception as e:
        logger.error("Google Drive upload failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Drive file upload failed: {e}",
        )

    drive_file_id = drive_meta["drive_file_id"]

    # 5. Persist metadata in PostgreSQL with transactional rollback & Drive cleanup
    try:
        file_record = AchievementFile(
            id=uuid.uuid4(),
            achievement_id=achievement.id,
            provider="google_drive",
            drive_file_id=drive_file_id,
            drive_folder_id=folder_id,
            original_filename=clean_filename,
            mime_type=validated_mime,
            size_bytes=size_bytes,
            file_category=file_category,
            uploaded_by=current_user.id,
        )
        session.add(file_record)

        audit_entry = AuditLog(
            actor_id=current_user.id,
            action="upload_achievement_file",
            target_type="achievement_file",
            target_id=str(file_record.id),
            action_metadata={
                "achievement_id": str(achievement.id),
                "original_filename": clean_filename,
                "mime_type": validated_mime,
                "size_bytes": size_bytes,
                "file_category": file_category.value,
            },
        )
        session.add(audit_entry)
        session.commit()
        session.refresh(file_record)
        return file_record

    except Exception as db_exc:
        session.rollback()
        logger.error(
            "Database insertion failed after Drive upload for file '%s' (Drive ID: %s): %s",
            clean_filename,
            drive_file_id,
            db_exc,
        )

        # Attempt immediate cleanup of the orphan Drive file
        cleanup_success = False
        try:
            ds.delete_file(drive_file_id)
            cleanup_success = True
            logger.info("Successfully cleaned up orphan Google Drive file %s", drive_file_id)
        except Exception as cleanup_exc:
            logger.critical(
                "ORPHAN FILE ERROR: Failed to clean up Drive file %s during DB rollback: %s",
                drive_file_id,
                cleanup_exc,
            )

        # If cleanup failed, record an orphan reconciliation audit log
        if not cleanup_success:
            try:
                orphan_log = AuditLog(
                    actor_id=current_user.id,
                    action="orphan_drive_file_detected",
                    target_type="google_drive_file",
                    target_id=drive_file_id,
                    action_metadata={
                        "filename": clean_filename,
                        "achievement_id": str(achievement.id),
                        "db_error": str(db_exc),
                    },
                )
                session.add(orphan_log)
                session.commit()
            except Exception as audit_err:
                logger.error("Failed to persist orphan audit log: %s", audit_err)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record file metadata in database. Drive file cleanup was attempted.",
        )


def get_achievement_files(
    session: Session,
    current_user: User,
    achievement_id: uuid.UUID,
) -> List[AchievementFile]:
    """
    Returns list of metadata records for all files attached to an achievement.
    Enforces authorization check.
    """
    achievement = session.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Achievement with ID '{achievement_id}' not found.",
        )

    check_achievement_read_authorization(session, current_user, achievement)

    files = session.scalars(
        select(AchievementFile)
        .where(AchievementFile.achievement_id == achievement_id)
        .order_by(AchievementFile.created_at.asc())
    ).all()
    return list(files)


def download_achievement_file(
    session: Session,
    current_user: User,
    file_id: uuid.UUID,
    drive_service: Optional[GoogleDriveService] = None,
) -> Tuple[bytes, AchievementFile]:
    """
    Downloads file binary from Google Drive after verifying user authorization.
    File binary is proxied through the backend server and never directly exposed to the public.
    """
    ds = drive_service or get_drive_service()

    file_record = session.get(AchievementFile, file_id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence file with ID '{file_id}' not found.",
        )

    achievement = session.get(Achievement, file_record.achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated achievement record not found.",
        )

    check_achievement_read_authorization(session, current_user, achievement)

    try:
        content_bytes, _ = ds.download_file(file_record.drive_file_id)
        return content_bytes, file_record
    except Exception as e:
        logger.error("Failed to retrieve file from Google Drive: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to retrieve file binary from Google Drive: {e}",
        )


def delete_achievement_file(
    session: Session,
    current_user: User,
    file_id: uuid.UUID,
    drive_service: Optional[GoogleDriveService] = None,
) -> None:
    """
    Deletes an evidence file record from PostgreSQL and removes binary from Google Drive.
    """
    ds = drive_service or get_drive_service()

    file_record = session.get(AchievementFile, file_id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence file with ID '{file_id}' not found.",
        )

    achievement = session.get(Achievement, file_record.achievement_id)
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated achievement record not found.",
        )

    # Authorization
    if current_user.role == UserRole.STUDENT:
        if achievement.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot delete evidence from another student's achievement.",
            )
        if achievement.status == AchievementStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete evidence files from an approved achievement.",
            )
    elif current_user.role not in (UserRole.HOD, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to delete this file.",
        )

    drive_file_id = file_record.drive_file_id

    # 1. Delete from Google Drive
    try:
        ds.delete_file(drive_file_id)
    except Exception as e:
        logger.error("Google Drive deletion failed for file %s: %s", drive_file_id, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to delete file from Google Drive: {e}",
        )

    # 2. Delete from database
    session.delete(file_record)
    audit = AuditLog(
        actor_id=current_user.id,
        action="delete_achievement_file",
        target_type="achievement_file",
        target_id=str(file_id),
        action_metadata={
            "achievement_id": str(achievement.id),
            "original_filename": file_record.original_filename,
            "drive_file_id": drive_file_id,
        },
    )
    session.add(audit)
    session.commit()
