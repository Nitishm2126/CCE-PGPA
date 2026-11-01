import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.user import User, UserRole
from app.models.component import PGPAComponent
from app.models.semester import Semester
from app.models.achievement import Achievement, AchievementStatus
from app.core.security import create_access_token
from app.db.session import SessionLocal


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def test_setup(db: Session):
    student = User(
        id=uuid.uuid4(),
        email=f"cert_test_student_{uuid.uuid4().hex[:6]}@sairamtap.edu.in",
        full_name="Certificate Test Student",
        password_hash="test_password_hash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)

    semester = db.scalars(select(Semester).where(Semester.is_enabled == True)).first()
    if not semester:
        semester = Semester(
            id=uuid.uuid4(),
            semester_number=1,
            display_name="Semester 1",
            is_enabled=True,
        )
        db.add(semester)

    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "clubs-and-cells")).first()
    if not comp:
        comp = PGPAComponent(
            id=uuid.uuid4(),
            name="Clubs & Cells",
            slug="clubs-and-cells",
            display_order=1,
            is_active=True,
            pdf_requirement="required",
            pdf_required=True,
        )
        db.add(comp)

    db.commit()
    db.refresh(student)
    db.refresh(semester)
    db.refresh(comp)

    token = create_access_token(subject=student.id, role="student")
    headers = {"Authorization": f"Bearer {token}"}

    return {
        "student": student,
        "semester": semester,
        "component": comp,
        "headers": headers,
    }


def test_submit_achievement_yet_to_receive_certificate_bypasses_pdf_requirement(
    client: TestClient, db: Session, test_setup
):
    """
    Verify that an achievement created with certificate_status="yet_to_receive"
    can be submitted directly for mentor review without a PDF evidence file,
    even when the component's pdf_requirement is "required".
    """
    comp = test_setup["component"]
    sem = test_setup["semester"]
    headers = test_setup["headers"]

    # 1. Create achievement with certificate_status="yet_to_receive" and remarks
    create_payload = {
        "component_id": str(comp.id),
        "semester_id": str(sem.id),
        "title": "Rotaract Community Service Camp",
        "activity_type": "Member",
        "organizer": "Rotaract Club",
        "certificate_status": "yet_to_receive",
        "remarks": "Official certificate pending dispatch from Rotary District 3232.",
        "component_metadata": {
            "club_name": "Rotaract Club",
            "role_category": "Member",
            "points": 100,
        },
    }

    create_resp = client.post("/api/v1/students/me/achievements", json=create_payload, headers=headers)
    assert create_resp.status_code == 201, create_resp.text
    created_data = create_resp.json()
    assert created_data["certificate_status"] == "yet_to_receive"
    assert created_data["remarks"] == "Official certificate pending dispatch from Rotary District 3232."
    ach_id = created_data["id"]

    # 2. Submit for review without uploading any PDF file
    submit_resp = client.post(f"/api/v1/students/me/achievements/{ach_id}/submit", headers=headers)
    assert submit_resp.status_code == 200, submit_resp.text
    submitted_data = submit_resp.json()
    assert submitted_data["status"] == "pending"
    assert submitted_data["certificate_status"] == "yet_to_receive"
    assert submitted_data["remarks"] == "Official certificate pending dispatch from Rotary District 3232."


def test_submit_achievement_not_provided_certificate_bypasses_pdf_requirement(
    client: TestClient, db: Session, test_setup
):
    """
    Verify that an achievement created with certificate_status="not_provided"
    can be submitted directly for mentor review without a PDF file.
    """
    comp = test_setup["component"]
    sem = test_setup["semester"]
    headers = test_setup["headers"]

    create_payload = {
        "component_id": str(comp.id),
        "semester_id": str(sem.id),
        "title": "Coding Club Weekly Practice",
        "activity_type": "Volunteer",
        "certificate_status": "not_provided",
        "remarks": "No certificate issued for internal club meetings.",
        "component_metadata": {
            "club_name": "Coding Club",
            "role_category": "Volunteer",
            "points": 100,
        },
    }

    create_resp = client.post("/api/v1/students/me/achievements", json=create_payload, headers=headers)
    assert create_resp.status_code == 201, create_resp.text
    created_data = create_resp.json()
    assert created_data["certificate_status"] == "not_provided"
    assert created_data["remarks"] == "No certificate issued for internal club meetings."
    ach_id = created_data["id"]

    # Submit for review without file
    submit_resp = client.post(f"/api/v1/students/me/achievements/{ach_id}/submit", headers=headers)
    assert submit_resp.status_code == 200, submit_resp.text
    assert submit_resp.json()["status"] == "pending"


def test_clubs_and_cells_empty_details_submits_normally(
    client: TestClient, db: Session, test_setup
):
    """
    Verify that Clubs & Cells submission with empty club details succeeds normally without failing.
    """
    comp = test_setup["component"]
    sem = test_setup["semester"]
    headers = test_setup["headers"]

    create_payload = {
        "component_id": str(comp.id),
        "semester_id": str(sem.id),
        "certificate_status": "not_provided",
        "remarks": "General club participation without specific club named.",
        "component_metadata": {},
    }

    create_resp = client.post("/api/v1/students/me/achievements", json=create_payload, headers=headers)
    assert create_resp.status_code == 201, create_resp.text
    ach = create_resp.json()
    assert ach["certificate_status"] == "not_provided"
    assert ach["remarks"] == "General club participation without specific club named."


def test_update_achievement_certificate_status_and_remarks(
    client: TestClient, db: Session, test_setup
):
    """
    Verify that certificate_status and remarks can be updated on an existing achievement.
    """
    comp = test_setup["component"]
    sem = test_setup["semester"]
    headers = test_setup["headers"]

    create_payload = {
        "component_id": str(comp.id),
        "semester_id": str(sem.id),
        "title": "Initial Club Submission",
        "certificate_status": "uploaded",
        "remarks": "Initial note",
    }
    create_resp = client.post("/api/v1/students/me/achievements", json=create_payload, headers=headers)
    ach_id = create_resp.json()["id"]

    # Update to yet_to_receive and updated remarks
    update_payload = {
        "certificate_status": "yet_to_receive",
        "remarks": "Updated: certificate will be issued by month end.",
    }
    patch_resp = client.patch(f"/api/v1/students/me/achievements/{ach_id}", json=update_payload, headers=headers)
    assert patch_resp.status_code == 200, patch_resp.text
    updated_data = patch_resp.json()
    assert updated_data["certificate_status"] == "yet_to_receive"
    assert updated_data["remarks"] == "Updated: certificate will be issued by month end."
