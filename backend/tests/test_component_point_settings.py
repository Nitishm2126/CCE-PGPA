import uuid
from typing import List
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.audit import AuditLog
from app.models.component import PGPAComponent
from app.models.semester import Semester
from app.models.user import User, UserRole, StudentProfile, MentorProfile
from app.models.assignment import MentorAssignment


@pytest.fixture
def db():
    session = SessionLocal()
    created_user_ids: List[uuid.UUID] = []

    def _track_user(user_id: uuid.UUID):
        created_user_ids.append(user_id)

    session.track_user = _track_user  # type: ignore

    try:
        yield session
    finally:
        session.rollback()
        for u_id in created_user_ids:
            try:
                u = session.get(User, u_id)
                if u:
                    session.delete(u)
                    session.commit()
            except Exception:
                session.rollback()
        session.close()


def test_get_and_update_component_point_settings_rbac_and_sync(client: TestClient, db: Session):
    pwd_hash = get_password_hash("TestPass123!")
    # Setup test users
    admin_user = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@sairamtapovanam.org",
        full_name="System Administrator",
        password_hash=pwd_hash,
        role=UserRole.ADMIN,
        is_active=True,
    )
    hod_user = User(
        id=uuid.uuid4(),
        email=f"hod_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        full_name="Dr. HOD Computer Communication",
        password_hash=pwd_hash,
        role=UserRole.HOD,
        is_active=True,
    )
    mentor_user = User(
        id=uuid.uuid4(),
        email=f"mentor_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        full_name="Prof. Mentor",
        password_hash=pwd_hash,
        role=UserRole.MENTOR,
        is_active=True,
    )
    student_user = User(
        id=uuid.uuid4(),
        email=f"student_{uuid.uuid4().hex[:6]}@sairamtapovanam.org",
        full_name="Student Test",
        password_hash=pwd_hash,
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add_all([admin_user, hod_user, mentor_user, student_user])
    db.flush()
    db.track_user(admin_user.id)  # type: ignore
    db.track_user(hod_user.id)  # type: ignore
    db.track_user(mentor_user.id)  # type: ignore
    db.track_user(student_user.id)  # type: ignore

    db.add(MentorProfile(user_id=mentor_user.id, department="CCE", staff_id=f"STF{uuid.uuid4().hex[:5]}"))
    db.add(StudentProfile(
        user_id=student_user.id,
        register_number=f"9213{uuid.uuid4().hex[:6]}",
        department="CCE",
        batch="2023-2027",
        semester="Semester 1",
    ))
    db.add(MentorAssignment(student_id=student_user.id, mentor_id=mentor_user.id, is_active=True))
    db.commit()

    admin_token = create_access_token(admin_user.id, admin_user.role.value)
    hod_token = create_access_token(hod_user.id, hod_user.role.value)
    mentor_token = create_access_token(mentor_user.id, mentor_user.role.value)
    student_token = create_access_token(student_user.id, student_user.role.value)

    # 1. Any authenticated user can read point settings
    res_student_get = client.get(
        "/api/v1/components/point-settings",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res_student_get.status_code == 200, res_student_get.text
    all_configs = res_student_get.json()
    assert len(all_configs) >= 14
    skillrack_item = next(c for c in all_configs if c["component_slug"] == "skillrack")
    assert len(skillrack_item["semesters"]) == 8
    assert skillrack_item["semesters"][0]["max_points"] in [500.0, 750.0]

    skillrack_id = skillrack_item["component_id"]

    # 2. Student trying to update point settings gets 403 Forbidden
    update_payload = {
        "unit": "Problems / Pts",
        "default_min_points": 0.0,
        "default_max_points": 64000.0,
        "scale_label": "0.0 - 64,000.0 Problems / Score",
        "guideline": "Table 1.1 thresholds per semester",
        "semesters": [
            {
                "semester_number": s["semester_number"],
                "is_enabled": True,
                "min_points": 0.0,
                "max_points": 750.0 if s["semester_number"] == 1 else s["max_points"],
                "credit_value": 3,
                "scale_label": s.get("scale_label"),
                "guideline": s.get("guideline"),
                "grade_thresholds": s.get("grade_thresholds"),
            }
            for s in skillrack_item["semesters"]
        ],
    }

    res_student_put = client.put(
        f"/api/v1/components/{skillrack_id}/point-settings",
        json=update_payload,
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res_student_put.status_code == 403

    # 3. Mentor trying to update point settings gets 403 Forbidden
    res_mentor_put = client.put(
        f"/api/v1/components/{skillrack_id}/point-settings",
        json=update_payload,
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert res_mentor_put.status_code == 403

    # 4. HOD successfully updates point settings (e.g. Sem 1 max points = 750.0)
    res_hod_put = client.put(
        f"/api/v1/components/{skillrack_id}/point-settings",
        json=update_payload,
        headers={"Authorization": f"Bearer {hod_token}"},
    )
    assert res_hod_put.status_code == 200, res_hod_put.text
    updated_data = res_hod_put.json()
    assert updated_data["semesters"][0]["max_points"] == 750.0
    assert updated_data["updated_by_name"] == hod_user.full_name

    # 5. Verify audit log was created
    audit = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.actor_id == hod_user.id,
            AuditLog.action == "UPDATE_COMPONENT_POINT_SETTINGS",
            AuditLog.target_id == str(skillrack_id),
        )
    ).first()
    assert audit is not None
    assert audit.action_metadata["actor_role"] == "hod"

    # 6. Verify manual points endpoint enforces the updated centralized points configuration
    sem1 = db.scalars(select(Semester).where(Semester.semester_number == 1)).first()
    assert sem1 is not None

    # 6a. Trying to award 800 points for Sem 1 exceeds the new 750 max -> 400 Bad Request
    bad_payload = {
        "student_id": str(student_user.id),
        "component_id": str(skillrack_id),
        "semester_id": str(sem1.id),
        "points": 800.0,
        "remarks": "Exceeding new semester limit",
    }
    res_manual_bad = client.post(
        "/api/v1/mentor/manual-points",
        json=bad_payload,
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert res_manual_bad.status_code == 400
    assert "official scale" in res_manual_bad.json()["detail"]

    # 6b. Awarding 700 points (which is <= 750 new max) succeeds!
    valid_payload = {
        "student_id": str(student_user.id),
        "component_id": str(skillrack_id),
        "semester_id": str(sem1.id),
        "points": 700.0,
        "remarks": "Valid points within updated 750.0 limit",
    }
    res_manual_ok = client.post(
        "/api/v1/mentor/manual-points",
        json=valid_payload,
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert res_manual_ok.status_code == 201
    assert res_manual_ok.json()["points"] == 700.0

    # 7. Admin can also update point settings
    res_admin_put = client.put(
        f"/api/v1/components/{skillrack_id}/point-settings",
        json=update_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin_put.status_code == 200
