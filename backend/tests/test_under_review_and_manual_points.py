import io
import uuid
from datetime import date
from typing import List
import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
from app.models.manual_point import ManualComponentPoint
from app.models.review import ReviewAction, VerificationLog
from app.models.semester import Semester
from app.models.user import MentorProfile, StudentProfile, User, UserRole
from app.services.export_service import generate_excel_report, build_report_data


@pytest.fixture
def db():
    session = SessionLocal()
    created_user_ids: List[uuid.UUID] = []
    created_achievement_ids: List[uuid.UUID] = []
    created_manual_point_ids: List[uuid.UUID] = []

    def _track_user(user_id: uuid.UUID):
        created_user_ids.append(user_id)

    def _track_achievement(achievement_id: uuid.UUID):
        created_achievement_ids.append(achievement_id)

    def _track_manual_point(point_id: uuid.UUID):
        created_manual_point_ids.append(point_id)

    session.track_user = _track_user  # type: ignore
    session.track_achievement = _track_achievement  # type: ignore
    session.track_manual_point = _track_manual_point  # type: ignore

    try:
        yield session
    finally:
        # Clean manual points
        if created_user_ids:
            points = session.scalars(
                select(ManualComponentPoint).where(
                    (ManualComponentPoint.student_id.in_(created_user_ids))
                    | (ManualComponentPoint.mentor_id.in_(created_user_ids))
                )
            ).all()
            for p in points:
                session.delete(p)
            session.commit()

        if created_manual_point_ids:
            points = session.scalars(
                select(ManualComponentPoint).where(ManualComponentPoint.id.in_(created_manual_point_ids))
            ).all()
            for p in points:
                session.delete(p)
            session.commit()

        # Clean achievements & verification logs
        if created_achievement_ids:
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

        # Clean assignments & users
        if created_user_ids:
            from app.models.audit import AuditLog
            audits = session.scalars(
                select(AuditLog).where(AuditLog.actor_id.in_(created_user_ids))
            ).all()
            for al in audits:
                session.delete(al)
            session.commit()

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


def test_mentor_review_under_review_status(client: TestClient, db: Session):
    """
    Test that mentor can place a submission 'Under Review' without finalizing points,
    and can later reopen and review it to 'Approved'.
    """
    mentor_user = User(
        email=f"test.mentor.{uuid.uuid4().hex[:8]}@sairam.edu.in",
        password_hash=get_password_hash("MentorSecret123"),
        full_name="Dr. Test Mentor",
        role=UserRole.MENTOR,
        is_active=True,
    )
    db.add(mentor_user)
    db.flush()
    db.track_user(mentor_user.id)  # type: ignore

    mentor_profile = MentorProfile(user_id=mentor_user.id, department="CCE", staff_id=f"STF{uuid.uuid4().hex[:6]}")
    db.add(mentor_profile)

    student_user = User(
        email=f"test.student.{uuid.uuid4().hex[:8]}@sairam.edu.in",
        password_hash=get_password_hash("StudentSecret123"),
        full_name="Under Review Student",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student_user)
    db.flush()
    db.track_user(student_user.id)  # type: ignore

    student_profile = StudentProfile(
        user_id=student_user.id,
        register_number=f"9213{uuid.uuid4().hex[:6]}",
        department="CCE",
        batch="2023-2027",
        semester="Semester 3",
    )
    db.add(student_profile)

    assignment = MentorAssignment(student_id=student_user.id, mentor_id=mentor_user.id, is_active=True)
    db.add(assignment)

    component = db.scalars(select(PGPAComponent)).first()
    assert component is not None

    semester = db.scalars(select(Semester).where(Semester.semester_number == 3)).first()
    assert semester is not None

    achievement = Achievement(
        student_id=student_user.id,
        component_id=component.id,
        semester_id=semester.id,
        title="Hackathon Participation Proof",
        description="National level hackathon documentation",
        activity_type="Participation",
        event_date=date.today(),
        status=AchievementStatus.PENDING,
        created_at=date.today(),
    )
    db.add(achievement)
    db.commit()
    db.refresh(achievement)
    db.track_achievement(achievement.id)  # type: ignore

    mentor_token = create_access_token(mentor_user.id, mentor_user.role.value)
    headers = {"Authorization": f"Bearer {mentor_token}"}

    # 1. Mentor places submission "Under Review"
    review_payload = {
        "action": "under_review",
        "remarks": "Certificate needs formal organizer verification.",
    }
    resp = client.post(
        f"/api/v1/mentor/achievements/{achievement.id}/review",
        json=review_payload,
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "under_review"

    # DB verify
    db.refresh(achievement)
    assert achievement.status == AchievementStatus.UNDER_REVIEW

    # Verification log verify
    log = db.scalars(
        select(VerificationLog).where(VerificationLog.achievement_id == achievement.id)
    ).first()
    assert log is not None
    assert log.action == ReviewAction.UNDER_REVIEW
    assert "organizer verification" in (log.remarks or "")

    # 2. Mentor re-reviews the Under Review submission to Approved
    approve_payload = {
        "action": "approved",
        "remarks": "Certificate confirmed valid by organizer.",
        "awarded_points": 4.0,
    }
    resp2 = client.post(
        f"/api/v1/mentor/achievements/{achievement.id}/review",
        json=approve_payload,
        headers=headers,
    )
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["status"] == "approved"

    db.refresh(achievement)
    assert achievement.status == AchievementStatus.APPROVED


def test_manual_component_points_crud_and_auth(client: TestClient, db: Session):
    """
    Test manual points award, validation (0-10 scale), audit trail, and soft delete.
    """
    mentor_user = User(
        email=f"test.mentor2.{uuid.uuid4().hex[:8]}@sairam.edu.in",
        password_hash=get_password_hash("MentorSecret123"),
        full_name="Dr. Assigned Mentor",
        role=UserRole.MENTOR,
        is_active=True,
    )
    unauthorized_mentor = User(
        email=f"test.other.{uuid.uuid4().hex[:8]}@sairam.edu.in",
        password_hash=get_password_hash("MentorSecret123"),
        full_name="Dr. Other Mentor",
        role=UserRole.MENTOR,
        is_active=True,
    )
    student_user = User(
        email=f"test.student2.{uuid.uuid4().hex[:8]}@sairam.edu.in",
        password_hash=get_password_hash("StudentSecret123"),
        full_name="Mentee Student",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add_all([mentor_user, unauthorized_mentor, student_user])
    db.flush()
    db.track_user(mentor_user.id)  # type: ignore
    db.track_user(unauthorized_mentor.id)  # type: ignore
    db.track_user(student_user.id)  # type: ignore

    db.add(MentorProfile(user_id=mentor_user.id, department="CCE", staff_id=f"STF{uuid.uuid4().hex[:6]}"))
    db.add(MentorProfile(user_id=unauthorized_mentor.id, department="CCE", staff_id=f"STF{uuid.uuid4().hex[:6]}"))
    db.add(StudentProfile(
        user_id=student_user.id,
        register_number=f"9213{uuid.uuid4().hex[:6]}",
        department="CCE",
        batch="2023-2027",
        semester="Semester 4",
    ))
    db.add(MentorAssignment(student_id=student_user.id, mentor_id=mentor_user.id, is_active=True))

    component = db.scalars(select(PGPAComponent)).first()
    assert component is not None

    semester = db.scalars(select(Semester).where(Semester.semester_number == 4)).first()
    assert semester is not None

    db.commit()

    mentor_token = create_access_token(mentor_user.id, mentor_user.role.value)
    other_token = create_access_token(unauthorized_mentor.id, unauthorized_mentor.role.value)
    student_token = create_access_token(student_user.id, student_user.role.value)

    # 1. Validation test: points > 10.0 must be rejected
    bad_payload = {
        "student_id": str(student_user.id),
        "component_id": str(component.id),
        "semester_id": str(semester.id),
        "points": 12.5,  # Exceeds max 10.0
        "remarks": "Exceptional work",
    }
    resp = client.post(
        "/api/v1/mentor/manual-points",
        json=bad_payload,
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert resp.status_code == 422

    # 2. Validation test: negative points must be rejected
    bad_neg = {
        "student_id": str(student_user.id),
        "component_id": str(component.id),
        "semester_id": str(semester.id),
        "points": -1.0,
        "remarks": "Invalid",
    }
    resp_neg = client.post(
        "/api/v1/mentor/manual-points",
        json=bad_neg,
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert resp_neg.status_code == 422

    # 3. Auth test: unauthorized mentor cannot award points to non-assigned student
    valid_payload = {
        "student_id": str(student_user.id),
        "component_id": str(component.id),
        "semester_id": str(semester.id),
        "points": 8.0,
        "remarks": "Verified direct departmental contribution.",
    }
    resp_unauth = client.post(
        "/api/v1/mentor/manual-points",
        json=valid_payload,
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp_unauth.status_code == 403

    # 4. Assigned mentor awards manual points successfully
    resp_create = client.post(
        "/api/v1/mentor/manual-points",
        json=valid_payload,
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert resp_create.status_code == 201, resp_create.text
    created_data = resp_create.json()
    assert created_data["points"] == 8.0
    assert created_data["student_id"] == str(student_user.id)
    assert created_data["component_id"] == str(component.id)
    assert created_data["mentor_id"] == str(mentor_user.id)
    point_id = created_data["id"]
    db.track_manual_point(uuid.UUID(point_id))  # type: ignore

    # 5. Student retrieves their awarded manual points
    resp_student_view = client.get(
        "/api/v1/students/manual-points",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert resp_student_view.status_code == 200
    student_points = resp_student_view.json()
    assert len(student_points) >= 1
    assert any(p["id"] == point_id for p in student_points)

    # 6. Mentor fetches mentee manual points
    resp_mentor_view = client.get(
        f"/api/v1/mentor/manual-points/{student_user.id}",
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert resp_mentor_view.status_code == 200
    mentor_points = resp_mentor_view.json()
    assert len(mentor_points) >= 1
    assert any(p["id"] == point_id for p in mentor_points)

    # 7. Soft delete manual point
    resp_del = client.delete(
        f"/api/v1/mentor/manual-points/{point_id}",
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert resp_del.status_code == 200

    # 8. Verify it is now inactive
    resp_student_after = client.get(
        "/api/v1/students/manual-points",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert not any(p["id"] == point_id for p in resp_student_after.json())


def test_excel_export_numeric_cells_and_manual_points_worksheet(db: Session):
    """
    Test that export_service generates Excel with numeric cells and the 5th 'Manual Component Points' sheet.
    """
    # Create test student & mentor with manual points
    mentor = User(
        email=f"test.mentor.exp.{uuid.uuid4().hex[:8]}@sairam.edu.in",
        password_hash=get_password_hash("MentorSecret123"),
        full_name="Dr. Export Mentor",
        role=UserRole.MENTOR,
        is_active=True,
    )
    student = User(
        email=f"test.student.exp.{uuid.uuid4().hex[:8]}@sairam.edu.in",
        password_hash=get_password_hash("StudentSecret123"),
        full_name="Export Test Student",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add_all([mentor, student])
    db.flush()
    db.track_user(mentor.id)  # type: ignore
    db.track_user(student.id)  # type: ignore

    reg_no = f"9213{uuid.uuid4().hex[:6]}"
    db.add(MentorProfile(user_id=mentor.id, department="CCE", staff_id=f"STF{uuid.uuid4().hex[:6]}"))
    db.add(StudentProfile(
        user_id=student.id,
        register_number=reg_no,
        department="CCE",
        batch="2023-2027",
        semester="Semester 4",
    ))
    db.add(MentorAssignment(student_id=student.id, mentor_id=mentor.id, is_active=True))

    component = db.scalars(select(PGPAComponent)).first()
    assert component is not None

    semester = db.scalars(select(Semester).where(Semester.semester_number == 4)).first()
    assert semester is not None

    manual_pt = ManualComponentPoint(
        student_id=student.id,
        mentor_id=mentor.id,
        component_id=component.id,
        semester_id=semester.id,
        points=7.5,
        remarks="Special achievement in competitive programming.",
        is_active=True,
    )
    db.add(manual_pt)
    db.commit()
    db.refresh(manual_pt)
    db.track_manual_point(manual_pt.id)  # type: ignore

    # Build report data
    report_data = build_report_data(
        db=db,
        student_ids=[student.id],
    )

    assert "manual_points_list" in report_data
    manual_entries = [m for m in report_data["manual_points_list"] if m["register_number"] == reg_no]
    assert len(manual_entries) == 1
    assert manual_entries[0]["manual_points"] == 7.5
    assert manual_entries[0]["component_name"] == component.name

    # Generate Excel bytes
    excel_bytes = generate_excel_report(report_data)
    assert len(excel_bytes) > 0

    # Load workbook from bytes and inspect sheets
    wb = load_workbook(io.BytesIO(excel_bytes))
    sheet_names = wb.sheetnames
    assert "Manual Component Points" in sheet_names

    ws_manual = wb["Manual Component Points"]
    # Check headers at row 5 (below institutional header block)
    headers = [cell.value for cell in ws_manual[5]]
    expected_headers = [
        "S.No",
        "Register Number",
        "Student Name",
        "Semester",
        "PGPA Component",
        "Manual Points",
        "Awarded By",
        "Award Date",
        "Remarks",
    ]
    assert headers == expected_headers

    # Find the row for our student (data starts at row 6)
    found = False
    for row in ws_manual.iter_rows(min_row=6, values_only=True):
        if row[1] == reg_no:
            found = True
            assert row[2] == "Export Test Student"
            assert row[4] == component.name
            assert row[5] == 7.5
            assert isinstance(row[5], (int, float))  # Verify numeric type in Excel
            assert row[6] == "Dr. Export Mentor"
            assert "competitive programming" in str(row[8])
            break
    assert found, "Created manual point record was not found in exported Excel sheet"
