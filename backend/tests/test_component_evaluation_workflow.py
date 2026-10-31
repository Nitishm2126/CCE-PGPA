import uuid
from typing import List
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.achievement import Achievement
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
from app.models.review import VerificationLog
from app.models.semester import Semester
from app.models.grading import StudentComponentResult
from app.models.user import MentorProfile, StudentProfile, User, UserRole
from app.services.grading_engine import (
    calculate_clubs_and_cells_points,
    grade_academics_gpa,
)
from app.services.component_service import COMPONENT_DYNAMIC_FIELDS


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


# -------------------------------------------------------------------------
# 1. Authoritative Grading Engine Unit Tests
# -------------------------------------------------------------------------

def test_academics_gpa_authoritative_mapping():
    """Verify Anna University Table B GPA to Grade mapping."""
    assert grade_academics_gpa(10.0) == ("O", 10)
    assert grade_academics_gpa(9.25) == ("O", 10)
    assert grade_academics_gpa(9.0) == ("O", 10)
    assert grade_academics_gpa(8.5) == ("A+", 9)
    assert grade_academics_gpa(7.0) == ("A+", 9)
    assert grade_academics_gpa(6.99) == ("A", 7)
    assert grade_academics_gpa(4.0) == ("A", 7)
    assert grade_academics_gpa(3.5) == ("B+", 5)
    assert grade_academics_gpa(2.0) == ("B+", 5)
    assert grade_academics_gpa(1.5) == ("B", 3)
    assert grade_academics_gpa(1.0) == ("B", 3)
    assert grade_academics_gpa(0.5) == ("C", 1)
    assert grade_academics_gpa(0.0) == ("C", 1)

    # Invalid GPAs
    with pytest.raises(ValueError):
        grade_academics_gpa(-0.5)

    with pytest.raises(ValueError):
        grade_academics_gpa(10.5)


def test_clubs_and_cells_table_7_1_points():
    """Verify Table 7.1 exact point allocation for all categories and levels."""
    # Member, MAGIC, Coordinator, Volunteer
    assert calculate_clubs_and_cells_points("Member") == 100
    assert calculate_clubs_and_cells_points("MAGIC") == 200
    assert calculate_clubs_and_cells_points("Event Coordinator") == 200
    assert calculate_clubs_and_cells_points("Volunteer") == 100

    # Event Participation
    assert calculate_clubs_and_cells_points("Event Participation", "Within College") == 100
    assert calculate_clubs_and_cells_points("Event Participation", "Within State (Other College)") == 200
    assert calculate_clubs_and_cells_points("Event Participation", "National Level (Other State)") == 300
    assert calculate_clubs_and_cells_points("Event Participation", "International Level (In College / Others)") == 400
    assert calculate_clubs_and_cells_points("Event Participation", "International Level (Other Country)") == 500

    # Winner
    assert calculate_clubs_and_cells_points("Winner", "Within College") == 200
    assert calculate_clubs_and_cells_points("Winner", "Within State (Other College)") == 300
    assert calculate_clubs_and_cells_points("Winner", "National Level (Other State)") == 500
    assert calculate_clubs_and_cells_points("Winner", "International Level (In College / Others)") == 600
    assert calculate_clubs_and_cells_points("Winner", "International Level (Other Country)") == 700


def test_all_14_component_dynamic_field_schemas():
    """Verify that all 14 PGPA components have defined dynamic form schemas."""
    expected_slugs = [
        "academics-gpa",
        "clubs-and-cells",
        "skillrack",
        "amcat",
        "internship",
        "sairam-sdg-action-programme",
        "sairam-innovation-eco-system",
        "sail",
        "sports-and-games",
        "online-certifications",
        "nptel-non-credit-transfer",
        "gate",
        "scouts-for-sdgs",
        "fit-india-certifications",
    ]
    for slug in expected_slugs:
        assert slug in COMPONENT_DYNAMIC_FIELDS, f"Missing dynamic field schema for {slug}"
        fields = COMPONENT_DYNAMIC_FIELDS[slug]
        assert len(fields) > 0, f"Component {slug} has empty dynamic field schema"
        for f in fields:
            assert f.name
            assert f.label
            assert f.type in ["text", "number", "select", "date", "textarea", "checkbox"]


# -------------------------------------------------------------------------
# 2. End-to-End Workflow & Result Isolation Tests
# -------------------------------------------------------------------------

def test_academics_gpa_workflow_and_result_visibility(client: TestClient, db: Session):
    """
    Test Academics GPA submission:
    - Student submits GPA
    - While pending: student CANNOT see evaluated grade/points
    - Mentor reviews: mentor CAN see tentative calculation
    - Mentor approves: student CAN now see official grade/points
    - Duplicate prevention: second GPA submission in same semester is rejected
    """
    mentor_user = User(
        id=uuid.uuid4(),
        email=f"test.mentor.{uuid.uuid4().hex[:6]}@sairam.edu.in",
        full_name="Workflow Mentor",
        password_hash="testpass",
        role=UserRole.MENTOR,
        is_active=True,
    )
    db.add(mentor_user)
    db.flush()
    db.track_user(mentor_user.id)

    mentor_profile = MentorProfile(
        user_id=mentor_user.id,
        department="CCE",
        designation="Assistant Professor",
    )
    db.add(mentor_profile)

    student_user = User(
        id=uuid.uuid4(),
        email=f"test.student.{uuid.uuid4().hex[:6]}@sairam.edu.in",
        full_name="Workflow Student",
        password_hash="testpass",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student_user)
    db.flush()
    db.track_user(student_user.id)

    student_profile = StudentProfile(
        user_id=student_user.id,
        register_number=f"2126{uuid.uuid4().hex[:8]}",
        department="CCE",
        year=2,
        semester="3",
        section="A",
    )
    db.add(student_profile)

    assignment = MentorAssignment(
        student_id=student_user.id,
        mentor_id=mentor_user.id,
    )
    db.add(assignment)
    db.commit()

    # Get Academics Component and Semester 3
    acad_comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "academics-gpa")).first()
    assert acad_comp is not None
    sem3 = db.scalars(select(Semester).where(Semester.semester_number == 3)).first()
    assert sem3 is not None

    student_token = create_access_token(subject=student_user.id, role="student")
    mentor_token = create_access_token(subject=mentor_user.id, role="mentor")

    # 1. Student creates draft GPA 9.20
    submit_res = client.post(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "component_id": str(acad_comp.id),
            "semester_id": str(sem3.id),
            "outcome": "9.20",
            "component_metadata": {"gpa": 9.20},
        },
    )
    assert submit_res.status_code == 201, submit_res.text
    ach_data = submit_res.json()
    ach_id = ach_data["id"]
    db.track_achievement(uuid.UUID(ach_id))
    assert ach_data["status"] == "draft"

    # Submit for mentor review
    sub_res = client.post(
        f"/api/v1/students/me/achievements/{ach_id}/submit",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert sub_res.status_code == 200
    pending_ach = sub_res.json()
    assert pending_ach["status"] == "pending"

    # Pending result isolation — student MUST NOT see unapproved grades
    assert pending_ach["evaluated_grade"] is None
    assert pending_ach["evaluated_grade_points"] is None
    assert pending_ach["evaluated_points"] is None

    # Check student achievements list — also masked
    list_res = client.get(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert list_res.status_code == 200
    my_ach = next(a for a in list_res.json() if a["id"] == ach_id)
    assert my_ach["evaluated_grade"] is None
    assert my_ach["evaluated_points"] is None

    # Duplicate Prevention: Attempt second GPA submission in same semester
    dup_res = client.post(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "component_id": str(acad_comp.id),
            "semester_id": str(sem3.id),
            "outcome": "8.50",
            "component_metadata": {"gpa": 8.50},
        },
    )
    assert dup_res.status_code == 400
    assert "already have an active" in dup_res.json()["detail"].lower()

    # Mentor Inspection: Mentor CAN see tentative rubric evaluation
    mentor_sub_res = client.get(
        f"/api/v1/mentor/achievements/{ach_id}",
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert mentor_sub_res.status_code == 200
    mentor_view = mentor_sub_res.json()
    assert mentor_view["evaluated_grade"] == "O"
    assert mentor_view["evaluated_grade_points"] == 10.0

    # Mentor Approves
    approve_res = client.post(
        f"/api/v1/mentor/achievements/{ach_id}/review",
        headers={"Authorization": f"Bearer {mentor_token}"},
        json={
            "action": "approved",
            "remarks": "Anna University marksheet verified. GPA 9.20 confirmed.",
        },
    )
    assert approve_res.status_code == 200
    approved_data = approve_res.json()
    assert approved_data["status"] == "approved"
    assert approved_data["evaluated_grade"] == "O"
    assert approved_data["evaluated_grade_points"] == 10.0

    # Now Student checks achievements: Official Grade and Points are UNLOCKED
    student_final_res = client.get(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert student_final_res.status_code == 200
    my_final_ach = next(a for a in student_final_res.json() if a["id"] == ach_id)
    assert my_final_ach["status"] == "approved"
    assert my_final_ach["evaluated_grade"] == "O"
    assert my_final_ach["evaluated_grade_points"] == 10.0


def test_clubs_and_cells_workflow_with_rejection_and_resubmission(client: TestClient, db: Session):
    """
    Test Clubs & Cells workflow:
    - Student submits Clubs participation with Table 7.1 details
    - Mentor rejects with remarks (Action Required)
    - Student sees remarks, updates details, and resubmits
    - Mentor approves with verified Table 7.1 points
    """
    mentor_user = User(
        id=uuid.uuid4(),
        email=f"test.mentor2.{uuid.uuid4().hex[:6]}@sairam.edu.in",
        full_name="Clubs Mentor",
        password_hash="testpass",
        role=UserRole.MENTOR,
        is_active=True,
    )
    db.add(mentor_user)
    db.flush()
    db.track_user(mentor_user.id)

    db.add(MentorProfile(user_id=mentor_user.id, department="CCE", designation="AP"))

    student_user = User(
        id=uuid.uuid4(),
        email=f"test.student2.{uuid.uuid4().hex[:6]}@sairam.edu.in",
        full_name="Clubs Student",
        password_hash="testpass",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student_user)
    db.flush()
    db.track_user(student_user.id)

    db.add(StudentProfile(
        user_id=student_user.id,
        register_number=f"2126{uuid.uuid4().hex[:8]}",
        department="CCE",
        year=2,
        semester="4",
    ))

    db.add(MentorAssignment(student_id=student_user.id, mentor_id=mentor_user.id))
    db.commit()

    clubs_comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "clubs-and-cells")).first()
    assert clubs_comp is not None
    enabled_sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
    assert enabled_sem is not None

    student_token = create_access_token(subject=student_user.id, role="student")
    mentor_token = create_access_token(subject=mentor_user.id, role="mentor")

    # 1. Student creates draft Winner - National Level (Table 7.1 = 500 points)
    create_res = client.post(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "component_id": str(clubs_comp.id),
            "semester_id": str(enabled_sem.id),
            "title": "National Hackathon Winner",
            "component_metadata": {
                "club_name": "Coding Club",
                "role_category": "Winner",
                "event_level": "National Level (Other State)",
            },
        },
    )
    assert create_res.status_code == 201, create_res.text
    ach_id = create_res.json()["id"]
    db.track_achievement(uuid.UUID(ach_id))
    assert create_res.json()["component_metadata"]["calculated_points"] == 500

    # 2. Student submits for review
    sub_res = client.post(
        f"/api/v1/students/me/achievements/{ach_id}/submit",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == "pending"
    # Points are masked while pending
    assert sub_res.json()["evaluated_points"] is None

    # 3. Mentor rejects requiring certificate evidence
    reject_res = client.post(
        f"/api/v1/mentor/achievements/{ach_id}/review",
        headers={"Authorization": f"Bearer {mentor_token}"},
        json={
            "action": "rejected",
            "remarks": "Please attach official certificate of merit issued by host institution.",
        },
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"

    # 4. Student sees rejection and mentor remarks
    student_view_res = client.get(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    rejected_item = next(a for a in student_view_res.json() if a["id"] == ach_id)
    assert rejected_item["status"] == "rejected"
    assert "certificate of merit" in (rejected_item["mentor_remarks"] or "")

    # 5. Student edits/updates submission and resubmits
    update_res = client.put(
        f"/api/v1/students/me/achievements/{ach_id}",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "title": "National Hackathon 1st Prize Winner",
            "component_metadata": {
                "club_name": "Coding Club",
                "role_category": "Winner",
                "event_level": "National Level (Other State)",
                "calculated_points": 500,
            },
        },
    )
    assert update_res.status_code == 200

    resubmit_res = client.post(
        f"/api/v1/students/me/achievements/{ach_id}/submit",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert resubmit_res.status_code == 200
    assert resubmit_res.json()["status"] == "pending"

    # 6. Mentor approves with awarded_points
    approve_res = client.post(
        f"/api/v1/mentor/achievements/{ach_id}/review",
        headers={"Authorization": f"Bearer {mentor_token}"},
        json={
            "action": "approved",
            "remarks": "Certificate verified. Awarding 500 Table 7.1 points.",
            "awarded_points": 500.0,
        },
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"
    assert approve_res.json()["evaluated_points"] == 500.0

    # 7. Student sees verified approval and official points
    final_student_res = client.get(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    final_item = next(a for a in final_student_res.json() if a["id"] == ach_id)
    assert final_item["status"] == "approved"
    assert final_item["evaluated_points"] == 500.0


def test_sports_and_games_workflow_table_8_1(client: TestClient, db: Session):
    """
    Test Sports & Games workflow with Table 8.1 Medal Matrix:
    - Student submits Gold medal at AU Zonal Level (Table 8.1 = 65 points).
    - Auto-calculation generates 65 points.
    - Mentor reviews and approves.
    - Resulting grade in StudentComponentResult is Grade B (Table 8.2: 21-90 -> B).
    """
    mentor_user = User(
        id=uuid.uuid4(),
        email=f"sports.mentor.{uuid.uuid4().hex[:6]}@sairam.edu.in",
        full_name="Sports Mentor",
        password_hash="testpass",
        role=UserRole.MENTOR,
        is_active=True,
    )
    db.add(mentor_user)
    db.flush()
    db.track_user(mentor_user.id)

    student_user = User(
        id=uuid.uuid4(),
        email=f"sports.student.{uuid.uuid4().hex[:6]}@sairam.edu.in",
        full_name="Sports Student",
        password_hash="testpass",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student_user)
    db.flush()
    db.track_user(student_user.id)

    student_profile = StudentProfile(
        user_id=student_user.id,
        register_number=f"2126{uuid.uuid4().hex[:8]}",
        department="CCE",
        year=2,
        semester="3",
        section="A",
    )
    db.add(student_profile)

    assignment = MentorAssignment(
        student_id=student_user.id,
        mentor_id=mentor_user.id,
    )
    db.add(assignment)
    db.commit()

    sports_comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "sports-and-games")).first()
    assert sports_comp is not None

    enabled_sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
    assert enabled_sem is not None

    student_token = create_access_token(subject=student_user.id, role="student")
    mentor_token = create_access_token(subject=mentor_user.id, role="mentor")

    # 1. Student creates draft: Gold at AU Zonal / District Level
    create_res = client.post(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "component_id": str(sports_comp.id),
            "semester_id": str(enabled_sem.id),
            "title": "Anna University Zonal Badminton",
            "component_metadata": {
                "sport_name": "Badminton",
                "competition_name": "Anna University Zonal Championship",
                "competition_level": "AU Zonal / District Level",
                "position": "Gold / 1st Place",
            },
        },
    )
    assert create_res.status_code == 201, create_res.text
    ach_id = create_res.json()["id"]
    db.track_achievement(uuid.UUID(ach_id))
    assert create_res.json()["component_metadata"]["calculated_points"] == 65
    assert create_res.json()["component_metadata"]["points"] == 65

    # 2. Student submits
    sub_res = client.post(
        f"/api/v1/students/me/achievements/{ach_id}/submit",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == "pending"

    # 3. Mentor approves
    approve_res = client.post(
        f"/api/v1/mentor/achievements/{ach_id}/review",
        headers={"Authorization": f"Bearer {mentor_token}"},
        json={
            "action": "approved",
            "remarks": "Zonal Gold verified against official scoresheet.",
        },
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"
    assert approve_res.json()["evaluated_points"] == 65.0
    assert approve_res.json()["evaluated_grade"] == "B"

