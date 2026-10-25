"""
Authoritative Test Suite for CCE PGPA:
1. Valid Drive access-token refresh.
2. Revoked/invalid refresh-token handling without repeated retries.
3. System Admin can update component PDF settings.
4. Non-admin users cannot modify component PDF settings.
5. PDF-required component rejects a submission without evidence.
6. PDF-optional component accepts a submission without evidence.
7. PDF-disabled component accepts a submission without evidence.
8. The setting applies consistently across all 14 official components.
9. Existing grading and mentor-approval workflows remain unchanged.
10. Drive failure does not falsely report successful uploads.
"""
import io
import uuid
from datetime import date, datetime, timezone
from typing import List
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from google.auth.exceptions import RefreshError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import ComponentSemesterConfig, PGPAComponent
from app.models.file import AchievementFile
from app.models.grading import StudentComponentResult
from app.models.review import VerificationLog
from app.models.semester import Semester
from app.models.user import MentorProfile, StudentProfile, User, UserRole
from app.services.drive_service import (
    GoogleDriveAuthRevokedError,
    GoogleDriveService,
    get_drive_service,
    reset_drive_revocation_state,
)
from app.services.grading_engine import grade_academics_gpa, calculate_clubs_and_cells_points


OFFICIAL_14_SLUGS = [
    "skillrack",
    "academics-gpa",
    "amcat",
    "clubs-and-cells",
    "sairam-innovation-eco-system",
    "nptel-non-credit-transfer",
    "sail",
    "online-certifications",
    "fit-india-certifications",
    "internship",
    "gate",
    "sairam-sdg-action-programme",
    "sports-and-games",
    "scouts-for-sdgs",
]


@pytest.fixture
def db():
    session = SessionLocal()
    created_user_ids: List[uuid.UUID] = []
    created_achievement_ids: List[uuid.UUID] = []
    created_result_ids: List[uuid.UUID] = []

    def _track_user(user_id: uuid.UUID):
        created_user_ids.append(user_id)

    def _track_achievement(achievement_id: uuid.UUID):
        created_achievement_ids.append(achievement_id)

    def _track_result(result_id: uuid.UUID):
        created_result_ids.append(result_id)

    session.track_user = _track_user  # type: ignore
    session.track_achievement = _track_achievement  # type: ignore
    session.track_result = _track_result  # type: ignore

    try:
        yield session
    finally:
        if created_result_ids:
            results = session.scalars(
                select(StudentComponentResult).where(StudentComponentResult.id.in_(created_result_ids))
            ).all()
            for r in results:
                session.delete(r)
            session.commit()

        if created_achievement_ids:
            files = session.scalars(
                select(AchievementFile).where(AchievementFile.achievement_id.in_(created_achievement_ids))
            ).all()
            for f in files:
                session.delete(f)

            logs = session.scalars(
                select(VerificationLog).where(VerificationLog.achievement_id.in_(created_achievement_ids))
            ).all()
            for log in logs:
                session.delete(log)

            achievements = session.scalars(
                select(Achievement).where(Achievement.id.in_(created_achievement_ids))
            ).all()
            for a in achievements:
                session.delete(a)
            session.commit()

        if created_user_ids:
            assignments = session.scalars(
                select(MentorAssignment).where(
                    (MentorAssignment.student_id.in_(created_user_ids))
                    | (MentorAssignment.mentor_id.in_(created_user_ids))
                )
            ).all()
            for assign in assignments:
                session.delete(assign)

            for uid in created_user_ids:
                u = session.get(User, uid)
                if u:
                    session.delete(u)
            session.commit()

        session.close()


def create_test_user(db: Session, role: UserRole, full_name: str) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"test.{role.value}.{uuid.uuid4().hex[:8]}@sairam.edu.in",
        full_name=full_name,
        password_hash="testpasshash123",
        role=role,
        is_active=True,
    )
    db.add(u)
    db.flush()
    db.track_user(u.id)

    if role == UserRole.STUDENT:
        p = StudentProfile(
            user_id=u.id,
            register_number=f"2126{uuid.uuid4().hex[:8]}",
            department="CCE",
            year=2,
            semester="3",
            section="A",
        )
        db.add(p)
    elif role == UserRole.MENTOR:
        p = MentorProfile(
            user_id=u.id,
            department="CCE",
            designation="Assistant Professor",
        )
        db.add(p)
    db.commit()
    return u


# ==============================================================================
# 1. Valid Drive access-token refresh
# ==============================================================================
def test_valid_drive_access_token_refresh():
    reset_drive_revocation_state()
    service = GoogleDriveService(
        oauth_client_id="dummy_client_id_123",
        oauth_client_secret="dummy_client_secret_456",
        refresh_token="valid_refresh_token_123",
    )

    mock_credentials = MagicMock()
    mock_credentials.valid = True
    mock_credentials.expired = False
    mock_credentials.token = "initial_valid_token"
    mock_credentials.refresh_token = "valid_refresh_token_123"

    def fake_refresh(req):
        mock_credentials.token = "newly_refreshed_access_token_456"

    mock_credentials.refresh.side_effect = fake_refresh
    service._creds = mock_credentials

    # Refresh
    success = service.refresh_access_token(force=True)
    assert success is True
    assert service._creds.token == "newly_refreshed_access_token_456"
    assert service.is_token_revoked is False


# ==============================================================================
# 2. Revoked/invalid refresh-token handling
# ==============================================================================
def test_revoked_invalid_refresh_token_handling():
    reset_drive_revocation_state()
    service = GoogleDriveService(
        oauth_client_id="dummy_client_id_123",
        oauth_client_secret="dummy_client_secret_456",
        refresh_token="revoked_token_789",
    )

    mock_credentials = MagicMock()
    mock_credentials.valid = False
    mock_credentials.expired = True
    mock_credentials.refresh_token = "revoked_token_789"
    mock_credentials.refresh.side_effect = RefreshError("invalid_grant: Token has been expired or revoked.")
    service._creds = mock_credentials

    # First attempt should catch RefreshError and raise GoogleDriveAuthRevokedError
    with pytest.raises(GoogleDriveAuthRevokedError) as exc_info:
        service.refresh_access_token(force=True)
    assert "reconnect" in str(exc_info.value).lower()
    assert service.is_token_revoked is True

    # Subsequent API calls must immediately raise without re-calling Google refresh
    mock_credentials.refresh.reset_mock()
    with pytest.raises(GoogleDriveAuthRevokedError):
        service.upload_file(b"test", "test.pdf", "application/pdf", "dummy_folder_id")
    # Verify no repeated network refresh was attempted
    mock_credentials.refresh.assert_not_called()

    # Reset state for other tests
    reset_drive_revocation_state()


# ==============================================================================
# 3. System Admin can update component PDF settings
# ==============================================================================
def test_system_admin_can_update_component_pdf_settings(client: TestClient, db: Session):
    admin_user = create_test_user(db, UserRole.ADMIN, "System Admin")
    admin_token = create_access_token(subject=admin_user.id, role="admin")

    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "clubs-and-cells")).first()
    assert comp is not None
    original_req = comp.pdf_requirement

    try:
        # Admin updates clubs-and-cells to required
        res = client.patch(
            f"/api/v1/admin/components/{comp.id}",
            json={"pdf_requirement": "required", "allow_other_evidence_types": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["pdf_requirement"] == "required"
        assert data["pdf_required"] is True
        assert data["allow_other_evidence_types"] is True

        # Verify DB persisted
        db.refresh(comp)
        assert comp.pdf_requirement == "required"
        assert comp.allow_other_evidence_types is True

        # Admin updates to disabled
        res2 = client.patch(
            f"/api/v1/admin/components/{comp.id}",
            json={"pdf_requirement": "disabled", "allow_other_evidence_types": False},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res2.status_code == 200
        assert res2.json()["pdf_requirement"] == "disabled"
        assert res2.json()["pdf_required"] is False
    finally:
        # Restore original
        comp.pdf_requirement = original_req
        db.add(comp)
        db.commit()


# ==============================================================================
# 4. Non-admin users cannot modify settings
# ==============================================================================
def test_non_admin_users_cannot_modify_settings(client: TestClient, db: Session):
    student_user = create_test_user(db, UserRole.STUDENT, "Regular Student")
    student_token = create_access_token(subject=student_user.id, role="student")

    mentor_user = create_test_user(db, UserRole.MENTOR, "Faculty Mentor")
    mentor_token = create_access_token(subject=mentor_user.id, role="mentor")

    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "academics-gpa")).first()
    assert comp is not None

    # Student attempt
    res_student = client.patch(
        f"/api/v1/admin/components/{comp.id}",
        json={"pdf_requirement": "disabled"},
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res_student.status_code == 403

    # Mentor attempt
    res_mentor = client.patch(
        f"/api/v1/admin/components/{comp.id}",
        json={"pdf_requirement": "disabled"},
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert res_mentor.status_code == 403


# ==============================================================================
# 5. PDF-required component rejects a submission without evidence
# ==============================================================================
def test_pdf_required_component_rejects_submission_without_evidence(client: TestClient, db: Session):
    student_user = create_test_user(db, UserRole.STUDENT, "Submit Student")
    student_token = create_access_token(subject=student_user.id, role="student")

    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "skillrack")).first()
    assert comp is not None
    orig_req = comp.pdf_requirement
    comp.pdf_requirement = "required"
    comp.allow_other_evidence_types = False
    db.add(comp)
    db.commit()

    sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
    assert sem is not None

    try:
        # Create draft achievement
        create_res = client.post(
            "/api/v1/students/me/achievements",
            json={
                "component_id": str(comp.id),
                "semester_id": str(sem.id),
                "title": "Skillrack 2500 Points Milestone",
                "outcome": "2500 Points",
                "component_metadata": {"points": 2500},
            },
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert create_res.status_code == 201
        ach_id = create_res.json()["id"]
        db.track_achievement(uuid.UUID(ach_id))

        # Attempt to submit without uploading evidence PDF
        submit_res = client.post(
            f"/api/v1/students/me/achievements/{ach_id}/submit",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert submit_res.status_code == 400
        assert "evidence is required" in submit_res.json()["detail"].lower()
    finally:
        comp.pdf_requirement = orig_req
        db.add(comp)
        db.commit()


# ==============================================================================
# 6. PDF-optional component accepts a submission without evidence
# ==============================================================================
def test_pdf_optional_component_accepts_submission_without_evidence(client: TestClient, db: Session):
    student_user = create_test_user(db, UserRole.STUDENT, "Optional Student")
    student_token = create_access_token(subject=student_user.id, role="student")

    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "skillrack")).first()
    assert comp is not None
    orig_req = comp.pdf_requirement
    comp.pdf_requirement = "optional"
    db.add(comp)
    db.commit()

    sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
    assert sem is not None

    try:
        create_res = client.post(
            "/api/v1/students/me/achievements",
            json={
                "component_id": str(comp.id),
                "semester_id": str(sem.id),
                "title": "Skillrack Optional Evidence Test",
                "outcome": "1200 Points",
                "component_metadata": {"points": 1200},
            },
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert create_res.status_code == 201
        ach_id = create_res.json()["id"]
        db.track_achievement(uuid.UUID(ach_id))

        # Submit without evidence
        submit_res = client.post(
            f"/api/v1/students/me/achievements/{ach_id}/submit",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert submit_res.status_code == 200, submit_res.text
        assert submit_res.json()["status"] == "pending"
    finally:
        comp.pdf_requirement = orig_req
        db.add(comp)
        db.commit()


# ==============================================================================
# 7. PDF-disabled component accepts a submission without evidence
# ==============================================================================
def test_pdf_disabled_component_accepts_submission_without_evidence(client: TestClient, db: Session):
    student_user = create_test_user(db, UserRole.STUDENT, "Disabled Student")
    student_token = create_access_token(subject=student_user.id, role="student")

    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "sail")).first()
    assert comp is not None
    orig_req = comp.pdf_requirement
    comp.pdf_requirement = "disabled"
    db.add(comp)
    db.commit()

    sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
    assert sem is not None

    try:
        create_res = client.post(
            "/api/v1/students/me/achievements",
            json={
                "component_id": str(comp.id),
                "semester_id": str(sem.id),
                "title": "SAIL AI Learning Milestone",
                "outcome": "210 Points",
                "component_metadata": {"points": 210, "module_title": "Deep Learning"},
            },
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert create_res.status_code == 201
        ach_id = create_res.json()["id"]
        db.track_achievement(uuid.UUID(ach_id))

        # Submit without evidence
        submit_res = client.post(
            f"/api/v1/students/me/achievements/{ach_id}/submit",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert submit_res.status_code == 200, submit_res.text
        assert submit_res.json()["status"] == "pending"
    finally:
        comp.pdf_requirement = orig_req
        db.add(comp)
        db.commit()


# ==============================================================================
# 8. The setting applies consistently across all 14 official components
# ==============================================================================
def test_setting_applies_consistently_across_all_14_official_components(client: TestClient, db: Session):
    admin_user = create_test_user(db, UserRole.ADMIN, "Matrix Admin")
    admin_token = create_access_token(subject=admin_user.id, role="admin")

    components = db.scalars(select(PGPAComponent)).all()
    comp_by_slug = {c.slug: c for c in components}

    for slug in OFFICIAL_14_SLUGS:
        assert slug in comp_by_slug, f"Official component '{slug}' must exist in database"
        comp = comp_by_slug[slug]
        orig_req = comp.pdf_requirement
        orig_credit = comp.credit_value
        orig_mode = comp.submission_mode

        try:
            # Update to 'required'
            res = client.patch(
                f"/api/v1/admin/components/{comp.id}",
                json={"pdf_requirement": "required"},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert res.status_code == 200
            assert res.json()["pdf_requirement"] == "required"
            # Ensure credits and mode were not altered
            assert res.json()["credit_value"] == orig_credit
            assert res.json()["submission_mode"] == orig_mode

            # Verify in Semester Matrix API
            matrix_res = client.get(
                "/api/v1/admin/components/semester-matrix",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert matrix_res.status_code == 200
            matrix_comps = {c["slug"]: c for c in matrix_res.json()["components"]}
            assert matrix_comps[slug]["pdf_requirement"] == "required"

            # Update to 'optional'
            res_opt = client.patch(
                f"/api/v1/admin/components/{comp.id}",
                json={"pdf_requirement": "optional"},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert res_opt.status_code == 200
            assert res_opt.json()["pdf_requirement"] == "optional"

        finally:
            comp.pdf_requirement = orig_req
            db.add(comp)
            db.commit()


# ==============================================================================
# 9. Existing grading and mentor-approval workflows remain unchanged
# ==============================================================================
def test_existing_grading_and_mentor_approval_workflows_remain_unchanged(client: TestClient, db: Session):
    mentor = create_test_user(db, UserRole.MENTOR, "Grading Mentor")
    student = create_test_user(db, UserRole.STUDENT, "Grading Student")
    assignment = MentorAssignment(student_id=student.id, mentor_id=mentor.id)
    db.add(assignment)
    db.commit()

    student_token = create_access_token(subject=student.id, role="student")
    mentor_token = create_access_token(subject=mentor.id, role="mentor")

    acad_comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "academics-gpa")).first()
    assert acad_comp is not None
    orig_req = acad_comp.pdf_requirement
    # Toggle requirement to optional
    acad_comp.pdf_requirement = "optional"
    db.add(acad_comp)
    db.commit()

    sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
    assert sem is not None

    try:
        # 1. Student submits GPA 8.75
        create_res = client.post(
            "/api/v1/students/me/achievements",
            json={
                "component_id": str(acad_comp.id),
                "semester_id": str(sem.id),
                "title": "Semester Academic GPA",
                "outcome": "8.75",
                "component_metadata": {"gpa": 8.75},
            },
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert create_res.status_code == 201
        ach_id = create_res.json()["id"]
        db.track_achievement(uuid.UUID(ach_id))

        sub_res = client.post(
            f"/api/v1/students/me/achievements/{ach_id}/submit",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert sub_res.status_code == 200

        # 2. Mentor reviews pending submissions queue
        queue_res = client.get(
            "/api/v1/mentor/submissions",
            headers={"Authorization": f"Bearer {mentor_token}"},
        )
        assert queue_res.status_code == 200
        found = any(s["id"] == ach_id for s in queue_res.json())
        assert found is True

        # 3. Mentor approves submission
        review_res = client.post(
            f"/api/v1/mentor/achievements/{ach_id}/review",
            json={"action": "approved", "remarks": "Excellent semester GPA validated."},
            headers={"Authorization": f"Bearer {mentor_token}"},
        )
        assert review_res.status_code == 200
        assert review_res.json()["status"] == "approved"

        # 4. Check official Table B grading result: GPA 8.75 -> Grade A+, Points 9
        expected_grade, expected_pts = grade_academics_gpa(8.75)
        assert expected_grade == "A+"
        assert expected_pts == 9

        result = db.scalars(
            select(StudentComponentResult).where(
                StudentComponentResult.student_id == student.id,
                StudentComponentResult.component_id == acad_comp.id,
            )
        ).first()
        assert result is not None
        db.track_result(result.id)
        assert result.grade == "A+"
        assert result.grade_points == 9

    finally:
        acad_comp.pdf_requirement = orig_req
        db.add(acad_comp)
        db.commit()


# ==============================================================================
# 10. Drive failure does not falsely report successful uploads
# ==============================================================================
def test_drive_failure_does_not_falsely_report_successful_uploads(client: TestClient, db: Session):
    student = create_test_user(db, UserRole.STUDENT, "Upload Student")
    student_token = create_access_token(subject=student.id, role="student")

    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "clubs-and-cells")).first()
    assert comp is not None
    sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
    assert sem is not None

    create_res = client.post(
        "/api/v1/students/me/achievements",
        json={
            "component_id": str(comp.id),
            "semester_id": str(sem.id),
            "title": "Rotaract Volunteer Service",
            "outcome": "Volunteer",
            "component_metadata": {"role_category": "Volunteer"},
        },
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert create_res.status_code == 201
    ach_id = create_res.json()["id"]
    db.track_achievement(uuid.UUID(ach_id))

    # Simulate Drive API upload failure
    drive_service = get_drive_service()
    with patch.object(drive_service, "upload_file", side_effect=Exception("Connection to Google Drive timed out")):
        upload_res = client.post(
            f"/api/v1/achievements/{ach_id}/files",
            files={"file": ("evidence.pdf", b"%PDF-1.4 mock content", "application/pdf")},
            data={"category": "certificate"},
            headers={"Authorization": f"Bearer {student_token}"},
        )
        # Must fail with 502/503/500, never 200
        assert upload_res.status_code in [500, 502, 503]

        # Verify database has NO file records recorded for this achievement
        files_in_db = db.scalars(
            select(AchievementFile).where(AchievementFile.achievement_id == uuid.UUID(ach_id))
        ).all()
        assert len(files_in_db) == 0, "No file record must be persisted if Drive upload failed"

        # Verify achievement draft is still preserved
        ach = db.get(Achievement, uuid.UUID(ach_id))
        assert ach is not None
        assert ach.status == AchievementStatus.DRAFT
