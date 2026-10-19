import logging
import re
import time
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.achievement import Achievement
from app.models.file import AchievementFile
from app.models.user import StudentProfile, User, UserRole
from app.services.drive_service import GoogleDriveService, get_drive_service

logger = logging.getLogger(__name__)


def create_folder_with_retry(
    ds: GoogleDriveService,
    folder_name: str,
    parent_id: str,
    max_retries: int = 3,
) -> str:
    """
    Creates or retrieves a Google Drive folder with exponential backoff retry
    to handle transient network failures or rate limits (HTTP 429/500/503).
    """
    delay = 1.0
    for attempt in range(1, max_retries + 1):
        try:
            return ds.get_or_create_folder(folder_name, parent_id)
        except Exception as exc:
            err_str = str(exc).lower()
            is_transient = any(k in err_str for k in ["429", "rate", "quota", "503", "500", "backenderror", "timed out", "connection"])
            if is_transient and attempt < max_retries:
                logger.warning(
                    "Transient error creating folder '%s' (attempt %d/%d): %s. Retrying in %.1fs...",
                    folder_name, attempt, max_retries, exc, delay,
                )
                time.sleep(delay)
                delay *= 2
            else:
                raise


def generate_student_folder_name(register_number: str, full_name: str) -> str:
    """
    Generates a deterministic, stable Google Drive folder name for a student:
    Format: {REGISTER_NUMBER}_{NORMALIZED_STUDENT_NAME}
    Example: SEC25CO031_NITISH_M
    """
    clean_reg = re.sub(r"[^A-Za-z0-9]", "", (register_number or "").strip()).upper()
    clean_name = re.sub(r"[^A-Za-z0-9]+", "_", (full_name or "").strip()).strip("_").upper()
    if not clean_reg:
        clean_reg = "STUDENT"
    if not clean_name:
        clean_name = "UNNAMED"
    return f"{clean_reg}_{clean_name}"


def audit_student_drive_folders(
    session: Session,
    drive_service: Optional[GoogleDriveService] = None,
) -> Dict[str, Any]:
    """
    Generates a comprehensive read-only audit report of all students and their Google Drive folders.
    - Inspects PostgreSQL student profiles and existing evidence files.
    - Inspects Google Drive root folder items without altering or moving anything.
    - Identifies provisioned, existing, and missing student folders.
    """
    ds = drive_service or get_drive_service()
    connectivity = ds.verify_connectivity()
    is_connected = bool(connectivity.get("connected"))
    root_folder_id = ds.root_folder_id

    # 1. Fetch all student users and their profiles
    stmt = (
        select(User, StudentProfile)
        .join(StudentProfile, StudentProfile.user_id == User.id)
        .where(User.role == UserRole.STUDENT)
        .order_by(StudentProfile.register_number.asc())
    )
    records = session.execute(stmt).all()

    # 2. Fetch all achievement files in DB grouped by student
    file_stmt = (
        select(AchievementFile, Achievement.student_id)
        .join(Achievement, Achievement.id == AchievementFile.achievement_id)
    )
    db_files = session.execute(file_stmt).all()
    files_by_student: Dict[uuid.UUID, List[AchievementFile]] = {}
    for f_record, student_id in db_files:
        files_by_student.setdefault(student_id, []).append(f_record)

    # 3. Query existing folders in Google Drive root folder if connected
    drive_folders_by_name: Dict[str, str] = {}
    legacy_folders_detected = 0
    if is_connected and root_folder_id:
        try:
            drive_subfolders = ds.list_folders_in_parent(root_folder_id)
            for f in drive_subfolders:
                fname = f.get("name", "")
                fid = f.get("id", "")
                drive_folders_by_name[fname] = fid
                if fname.startswith("student_"):
                    legacy_folders_detected += 1
        except Exception as e:
            logger.error("Failed to list Google Drive folders during audit: %s", e)

    # 4. Analyze each student
    students_audit: List[Dict[str, Any]] = []
    provisioned_in_db_count = 0
    found_in_drive_count = 0
    requires_provisioning_count = 0

    for user, profile in records:
        computed_name = generate_student_folder_name(profile.register_number, user.full_name)
        db_folder_id = profile.google_drive_folder_id
        drive_folder_id = drive_folders_by_name.get(computed_name)

        student_files = files_by_student.get(user.id, [])
        legacy_evidence_folder_ids = list({f.drive_folder_id for f in student_files if f.drive_folder_id})

        status = "NEEDS_CREATION"
        if db_folder_id:
            provisioned_in_db_count += 1
            status = "ALREADY_PROVISIONED"
        elif drive_folder_id:
            found_in_drive_count += 1
            status = "EXISTS_IN_DRIVE_NEEDS_LINK"
        else:
            requires_provisioning_count += 1

        students_audit.append({
            "student_id": user.id,
            "register_number": profile.register_number,
            "student_name": user.full_name,
            "student_email": user.email,
            "computed_folder_name": computed_name,
            "db_folder_id": db_folder_id,
            "drive_folder_id": drive_folder_id or db_folder_id,
            "status": status,
            "evidence_count": len(student_files),
            "legacy_evidence_folder_ids": legacy_evidence_folder_ids,
        })

    return {
        "total_students": len(records),
        "provisioned_in_db": provisioned_in_db_count,
        "found_in_drive": found_in_drive_count,
        "requires_provisioning": requires_provisioning_count,
        "legacy_folders_detected": legacy_folders_detected,
        "total_evidence_files": len(db_files),
        "students": students_audit,
        "root_folder_id": root_folder_id,
        "drive_connected": is_connected,
        "authorized_email": connectivity.get("authorized_email"),
    }


def provision_student_drive_folders(
    session: Session,
    drive_service: Optional[GoogleDriveService] = None,
    dry_run: bool = True,
) -> Dict[str, Any]:
    """
    Idempotently provisions dedicated Google Drive folders for students.
    - If dry_run=True: Returns a simulated execution plan without modifying Drive or database.
    - If dry_run=False: Creates or links folders, records folder IDs in student_profiles,
      and handles individual student retries and partial failures safely.
    - Prevents duplicates and reuses existing verified folders.
    - Does NOT touch or delete existing files.
    """
    ds = drive_service or get_drive_service()
    if not dry_run and not ds.is_configured:
        raise RuntimeError("Google Drive service is not configured or authorized.")

    audit = audit_student_drive_folders(session, ds)
    root_folder_id = ds.root_folder_id or audit.get("root_folder_id")
    if not dry_run and not root_folder_id:
        raise RuntimeError("Google Drive root folder ID is missing.")

    # Cache folders in Drive to avoid duplicate API calls
    drive_folders_by_name: Dict[str, str] = {}
    if ds.is_configured and root_folder_id:
        try:
            drive_subfolders = ds.list_folders_in_parent(root_folder_id)
            for f in drive_subfolders:
                drive_folders_by_name[f.get("name", "")] = f.get("id", "")
        except Exception as e:
            logger.warning("Could not list Drive folders for provisioning cache: %s", e)

    results: List[Dict[str, Any]] = []
    created_count = 0
    reused_count = 0
    already_provisioned_count = 0
    failed_count = 0

    for item in audit["students"]:
        student_id = item["student_id"]
        reg_no = item["register_number"]
        name = item["student_name"]
        folder_name = item["computed_folder_name"]
        db_folder_id = item["db_folder_id"]
        existing_drive_id = drive_folders_by_name.get(folder_name)

        # Case 1: Already provisioned in DB
        if db_folder_id:
            already_provisioned_count += 1
            results.append({
                "student_id": student_id,
                "register_number": reg_no,
                "student_name": name,
                "folder_name": folder_name,
                "folder_id": db_folder_id,
                "action_taken": "ALREADY_SET",
                "success": True,
                "error": None,
            })
            continue

        # Case 2: Dry Run Mode
        if dry_run:
            if existing_drive_id:
                reused_count += 1
                results.append({
                    "student_id": student_id,
                    "register_number": reg_no,
                    "student_name": name,
                    "folder_name": folder_name,
                    "folder_id": existing_drive_id,
                    "action_taken": "DRY_RUN_REUSED",
                    "success": True,
                    "error": None,
                })
            else:
                created_count += 1
                results.append({
                    "student_id": student_id,
                    "register_number": reg_no,
                    "student_name": name,
                    "folder_name": folder_name,
                    "folder_id": f"simulated_drive_folder_{reg_no.lower()}",
                    "action_taken": "DRY_RUN_CREATED",
                    "success": True,
                    "error": None,
                })
            continue

        # Case 3: Live Execution Mode
        try:
            profile = session.scalar(
                select(StudentProfile).where(StudentProfile.user_id == student_id)
            )
            if not profile:
                raise ValueError(f"Student profile for user ID {student_id} not found.")

            target_folder_id = existing_drive_id
            action = "REUSED_EXISTING"

            if not target_folder_id:
                target_folder_id = create_folder_with_retry(ds, folder_name, root_folder_id)
                drive_folders_by_name[folder_name] = target_folder_id
                action = "CREATED"
                time.sleep(0.15)  # Safe rate pacing to prevent bursting Google Drive API rate limits

            # Update PostgreSQL student profile
            profile.google_drive_folder_id = target_folder_id
            session.commit()

            if action == "CREATED":
                created_count += 1
            else:
                reused_count += 1

            results.append({
                "student_id": student_id,
                "register_number": reg_no,
                "student_name": name,
                "folder_name": folder_name,
                "folder_id": target_folder_id,
                "action_taken": action,
                "success": True,
                "error": None,
            })

        except Exception as exc:
            session.rollback()
            failed_count += 1
            logger.error("Failed provisioning Drive folder for student %s (%s): %s", reg_no, name, exc)
            results.append({
                "student_id": student_id,
                "register_number": reg_no,
                "student_name": name,
                "folder_name": folder_name,
                "folder_id": None,
                "action_taken": "FAILED",
                "success": False,
                "error": str(exc),
            })

    mode_str = "DRY RUN" if dry_run else "LIVE EXECUTION"
    msg = (
        f"[{mode_str}] Processed {len(audit['students'])} students: "
        f"{created_count} to create, {reused_count} to reuse, "
        f"{already_provisioned_count} already configured, {failed_count} failed."
    )

    return {
        "dry_run": dry_run,
        "total_students": len(audit["students"]),
        "created": created_count,
        "reused": reused_count,
        "already_provisioned": already_provisioned_count,
        "failed": failed_count,
        "results": results,
        "message": msg,
    }


def ensure_student_folder(
    session: Session,
    student_id: uuid.UUID,
    drive_service: Optional[GoogleDriveService] = None,
) -> str:
    """
    Resolves or safely auto-provisions the dedicated Google Drive folder for a student.
    Never accepts client-supplied folder IDs as authoritative.
    If the student's folder is missing or invalid, it creates or repairs it safely,
    updates PostgreSQL, and returns the verified folder ID.
    """
    ds = drive_service or get_drive_service()
    if not ds.is_configured:
        raise RuntimeError("Google Drive service is not configured or authorized.")

    user = session.get(User, student_id)
    if not user:
        raise ValueError(f"Student user with ID {student_id} not found.")

    profile = session.scalar(
        select(StudentProfile).where(StudentProfile.user_id == student_id)
    )
    if not profile:
        raise ValueError(f"Student profile for user ID {student_id} not found.")

    root_folder_id = ds.root_folder_id
    if not root_folder_id:
        raise ValueError("Google Drive root folder ID is not configured.")

    # 1. If profile already has a folder ID, check if it still exists
    if profile.google_drive_folder_id:
        try:
            if hasattr(ds, "folder_exists") and ds.folder_exists(profile.google_drive_folder_id):
                return profile.google_drive_folder_id
        except Exception:
            return profile.google_drive_folder_id
        logger.warning(
            "Drive folder ID %s for student %s not found on Drive. Repairing...",
            profile.google_drive_folder_id,
            profile.register_number,
        )

    # 2. Derive deterministic folder name
    folder_name = generate_student_folder_name(profile.register_number, user.full_name)

    # 3. Locate or create folder in Drive root
    folder_id = create_folder_with_retry(ds, folder_name, root_folder_id)

    # 4. Persist in database (flush to maintain transaction atomicity with caller)
    profile.google_drive_folder_id = folder_id
    session.flush()
    logger.info(
        "Successfully bound Google Drive folder %s (%s) for student %s",
        folder_name,
        folder_id,
        profile.register_number,
    )
    return folder_id
