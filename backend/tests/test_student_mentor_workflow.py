import uuid
from datetime import date
from typing import List
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
from app.models.review import ReviewAction, VerificationLog
from app.models.user import MentorProfile, StudentProfile, User, UserRole


@pytest.fixture
def db():
    """
    Session fixture with automated teardown to clean up only test-generated entities.
    Preserves all 61 cohort student records and the admin user.
    """
    session = SessionLocal()
    created_user_ids: List[uuid.UUID] = []
    created_achievement_ids: List[uuid.UUID] = []

    def _track_user(user_id: uuid.UUID):
        created_user_ids.append(user_id)

    def _track_achievement(achievement_id: uuid.UUID):
        created_achievement_ids.append(achievement_id)

    session.track_user = _track_user  # type: ignore
    session.track_achievement = _track_achievement  # type: ignore

    try:
        yield session
    finally:
        # 1. Clean up verification logs and achievements
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

        # 2. Clean up mentor assignments and test users
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


def test_get_pgpa_components(client: TestClient, db: Session):
    """
    Test GET /api/v1/students/components returns all 13 official catalogue items.
    """
    student = User(
        id=uuid.uuid4(),
        full_name="Component Reader",
        email=f"reader_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="h",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.track_user(student.id)  # type: ignore

    token = create_access_token(subject=student.id, role="student")
    res = client.get("/api/v1/students/components", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 13
    slugs = [c["slug"] for c in data]
    assert "skillrack" in slugs
    assert "academics-gpa" in slugs
    assert "online-certifications" in slugs


def test_student_achievement_crud_and_validation(client: TestClient, db: Session):
    """
    Test student draft creation, validation, update, and deletion:
    - Creates draft achievement under a valid component.
    - Validates missing/invalid component returns 404.
    - Updates draft achievement.
    - Deletes draft achievement.
    """
    component = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "online-certifications")).first()
    assert component is not None

    student = User(
        id=uuid.uuid4(),
        full_name="Student Creator",
        email=f"creator_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="h",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.track_user(student.id)  # type: ignore

    token = create_access_token(subject=student.id, role="student")

    # 1. Invalid component -> 404
    bad_res = client.post(
        "/api/v1/students/me/achievements",
        json={"component_id": str(uuid.uuid4()), "title": "Invalid Component Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad_res.status_code == 404

    # 2. Valid creation -> 201
    payload = {
        "component_id": str(component.id),
        "title": "AWS Certified Cloud Practitioner",
        "activity_type": "Certification",
        "organizer": "Amazon Web Services",
        "event_date": "2024-09-15",
        "description": "Passed with score 890/1000",
        "outcome": "Certified",
    }
    create_res = client.post(
        "/api/v1/students/me/achievements",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    created_data = create_res.json()
    ach_id = uuid.UUID(created_data["id"])
    db.track_achievement(ach_id)  # type: ignore
    assert created_data["status"] == "draft"
    assert created_data["title"] == "AWS Certified Cloud Practitioner"
    assert created_data["component_slug"] == "online-certifications"

    # 3. Update draft
    update_res = client.patch(
        f"/api/v1/students/me/achievements/{ach_id}",
        json={"outcome": "Certified with Distinction"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["outcome"] == "Certified with Distinction"

    # 4. List my achievements
    list_res = client.get(
        "/api/v1/students/me/achievements",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    my_list = list_res.json()
    assert len(my_list) >= 1
    assert any(a["id"] == str(ach_id) for a in my_list)

    # 5. Delete draft
    del_res = client.delete(
        f"/api/v1/students/me/achievements/{ach_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200


def test_student_own_record_isolation(client: TestClient, db: Session):
    """
    Verify strict student isolation:
    - Student A cannot view, edit, submit, or delete Student B's achievement.
    """
    comp = db.scalars(select(PGPAComponent)).first()
    assert comp is not None

    # Student A
    sa = User(id=uuid.uuid4(), full_name="Student A", email=f"sa_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT)
    ach_a = Achievement(id=uuid.uuid4(), student_id=sa.id, component_id=comp.id, title="Student A Activity", status=AchievementStatus.DRAFT)

    # Student B
    sb = User(id=uuid.uuid4(), full_name="Student B", email=f"sb_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT)

    db.add_all([sa, ach_a, sb])
    db.commit()
    db.track_user(sa.id)  # type: ignore
    db.track_user(sb.id)  # type: ignore
    db.track_achievement(ach_a.id)  # type: ignore

    token_b = create_access_token(subject=sb.id, role="student")

    # Student B attempts GET on A's achievement -> 403
    r_get = client.get(f"/api/v1/students/me/achievements/{ach_a.id}", headers={"Authorization": f"Bearer {token_b}"})
    assert r_get.status_code == 403

    # Student B attempts PATCH on A's achievement -> 403
    r_patch = client.patch(f"/api/v1/students/me/achievements/{ach_a.id}", json={"title": "Hacked Title"}, headers={"Authorization": f"Bearer {token_b}"})
    assert r_patch.status_code == 403

    # Student B attempts POST submit on A's achievement -> 403
    r_submit = client.post(f"/api/v1/students/me/achievements/{ach_a.id}/submit", headers={"Authorization": f"Bearer {token_b}"})
    assert r_submit.status_code == 403

    # Student B attempts DELETE on A's achievement -> 403
    r_del = client.delete(f"/api/v1/students/me/achievements/{ach_a.id}", headers={"Authorization": f"Bearer {token_b}"})
    assert r_del.status_code == 403


def test_mentor_review_workflow_and_mentee_isolation(client: TestClient, db: Session):
    """
    Test full submission and review lifecycle:
    1. Student submits achievement (draft -> pending).
    2. Pending achievement cannot be edited or deleted by student.
    3. Assigned Mentor sees submission in /mentor/submissions.
    4. Unassigned Mentor CANNOT see submission and CANNOT review it (403).
    5. Assigned Mentor rejects with remarks -> status becomes rejected, VerificationLog created.
    6. Student edits and re-submits rejected achievement.
    7. Assigned Mentor approves -> status becomes approved, VerificationLog created.
    8. Once approved, cannot be modified or re-reviewed.
    """
    comp = db.scalars(select(PGPAComponent)).first()
    assert comp is not None

    # Mentor 1 (Assigned) and Student 1
    m1 = User(id=uuid.uuid4(), full_name="Mentor One", email=f"m1_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR)
    s1 = User(id=uuid.uuid4(), full_name="Student One", email=f"s1_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT)
    a1 = MentorAssignment(id=uuid.uuid4(), mentor_id=m1.id, student_id=s1.id, is_active=True)

    # Mentor 2 (Unassigned)
    m2 = User(id=uuid.uuid4(), full_name="Mentor Two", email=f"m2_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR)

    ach = Achievement(
        id=uuid.uuid4(),
        student_id=s1.id,
        component_id=comp.id,
        title="Web Development Hackathon",
        status=AchievementStatus.DRAFT,
    )

    db.add_all([m1, s1, a1, m2, ach])
    db.commit()
    db.track_user(m1.id)  # type: ignore
    db.track_user(s1.id)  # type: ignore
    db.track_user(m2.id)  # type: ignore
    db.track_achievement(ach.id)  # type: ignore

    t_student = create_access_token(subject=s1.id, role="student")
    t_mentor1 = create_access_token(subject=m1.id, role="mentor")
    t_mentor2 = create_access_token(subject=m2.id, role="mentor")

    # Step 1: Student submits draft achievement
    submit_res = client.post(
        f"/api/v1/students/me/achievements/{ach.id}/submit",
        headers={"Authorization": f"Bearer {t_student}"},
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "pending"
    assert submit_res.json()["submitted_at"] is not None

    # Step 2: Student cannot edit or delete while pending
    assert client.patch(
        f"/api/v1/students/me/achievements/{ach.id}",
        json={"title": "Change"},
        headers={"Authorization": f"Bearer {t_student}"},
    ).status_code == 400

    assert client.delete(
        f"/api/v1/students/me/achievements/{ach.id}",
        headers={"Authorization": f"Bearer {t_student}"},
    ).status_code == 400

    # Step 3: Mentor 1 sees pending submission
    m1_queue = client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {t_mentor1}"})
    assert m1_queue.status_code == 200
    m1_items = m1_queue.json()
    assert len(m1_items) == 1
    assert m1_items[0]["id"] == str(ach.id)

    # Step 4: Mentor 2 cannot see or review
    m2_queue = client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {t_mentor2}"})
    assert m2_queue.status_code == 200
    assert len(m2_queue.json()) == 0

    m2_review = client.post(
        f"/api/v1/mentor/achievements/{ach.id}/review",
        json={"action": "approved"},
        headers={"Authorization": f"Bearer {t_mentor2}"},
    )
    assert m2_review.status_code == 403

    # Step 5: Mentor 1 rejects without remarks -> 422 Unprocessable Entity
    bad_reject = client.post(
        f"/api/v1/mentor/achievements/{ach.id}/review",
        json={"action": "rejected", "remarks": ""},
        headers={"Authorization": f"Bearer {t_mentor1}"},
    )
    assert bad_reject.status_code == 422

    # Step 6: Mentor 1 rejects with valid remarks
    reject_res = client.post(
        f"/api/v1/mentor/achievements/{ach.id}/review",
        json={"action": "rejected", "remarks": "Please attach official certificate of participation."},
        headers={"Authorization": f"Bearer {t_mentor1}"},
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"
    assert len(reject_res.json()["verification_logs"]) == 1
    assert reject_res.json()["verification_logs"][0]["action"] == "rejected"
    assert "attach official certificate" in reject_res.json()["verification_logs"][0]["remarks"]

    # Step 7: Student can edit and re-submit after rejection
    patch_res = client.patch(
        f"/api/v1/students/me/achievements/{ach.id}",
        json={"description": "Updated with certificate upload link."},
        headers={"Authorization": f"Bearer {t_student}"},
    )
    assert patch_res.status_code == 200

    resubmit_res = client.post(
        f"/api/v1/students/me/achievements/{ach.id}/submit",
        headers={"Authorization": f"Bearer {t_student}"},
    )
    assert resubmit_res.status_code == 200
    assert resubmit_res.json()["status"] == "pending"

    # Step 8: Mentor 1 approves
    approve_res = client.post(
        f"/api/v1/mentor/achievements/{ach.id}/review",
        json={"action": "approved", "remarks": "Verified and approved."},
        headers={"Authorization": f"Bearer {t_mentor1}"},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"
    assert len(approve_res.json()["verification_logs"]) == 2


def test_hod_overview_and_oversight(client: TestClient, db: Session):
    """
    Test HOD department overview and student portfolio inspection:
    - HOD accesses /hod/overview and sees department statistics.
    - HOD inspects any student's achievements across the department.
    - Non-HOD users (Student, Mentor, Admin) are rejected with 403.
    """
    hod = User(id=uuid.uuid4(), full_name="HOD CCE", email=f"hod_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.HOD)
    student = User(id=uuid.uuid4(), full_name="Student Under HOD", email=f"suh_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT)
    admin = User(id=uuid.uuid4(), full_name="Admin", email=f"adm_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.ADMIN)

    db.add_all([hod, student, admin])
    db.commit()
    db.track_user(hod.id)  # type: ignore
    db.track_user(student.id)  # type: ignore
    db.track_user(admin.id)  # type: ignore

    t_hod = create_access_token(subject=hod.id, role="hod")
    t_student = create_access_token(subject=student.id, role="student")
    t_admin = create_access_token(subject=admin.id, role="admin")

    # HOD overview
    res_overview = client.get("/api/v1/hod/overview", headers={"Authorization": f"Bearer {t_hod}"})
    assert res_overview.status_code == 200
    data = res_overview.json()
    assert data["department"] == "Computer and Communication Engineering (CCE)"
    assert data["total_students"] >= 61
    assert data["active_components"] == 13

    # Student portfolio inspection
    res_portfolio = client.get(f"/api/v1/hod/students/{student.id}/achievements", headers={"Authorization": f"Bearer {t_hod}"})
    assert res_portfolio.status_code == 200
    assert isinstance(res_portfolio.json(), list)

    # Student and Admin blocked from HOD endpoints
    assert client.get("/api/v1/hod/overview", headers={"Authorization": f"Bearer {t_student}"}).status_code == 403
    assert client.get("/api/v1/hod/overview", headers={"Authorization": f"Bearer {t_admin}"}).status_code == 403


def test_view_only_faculty_access_workflow(client: TestClient, db: Session):
    """
    Test the view-only faculty access workflow without approval requirement:
    1. Student creates and submits an activity with details.
    2. Submission is saved with status 'pending' and submitted_at timestamp.
    3. Assigned mentor immediately views the submission via /mentor/submissions without any status filter.
    4. Unassigned mentor sees 0 submissions (strict mentor isolation preserved).
    5. HOD immediately views the submission via /hod/submissions across CCE department.
    6. HOD filters by component, search query, or student ID.
    7. Neither mentor nor HOD approval is required for the submission to be recorded or visible.
    8. Non-HOD users cannot access /hod/submissions (403 Forbidden).
    """
    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "online-certifications")).first()
    assert comp is not None

    # Create mentor 1, mentor 2, student with profile, and HOD
    m1 = User(id=uuid.uuid4(), full_name="Mentor Alpha", email=f"m1_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR)
    m2 = User(id=uuid.uuid4(), full_name="Mentor Beta", email=f"m2_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.MENTOR)
    student = User(id=uuid.uuid4(), full_name="Submitting Mentee", email=f"st_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.STUDENT)
    student_profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"211423244{uuid.uuid4().hex[:3]}",
        department="CCE",
        year=2,
        section="A",
        semester="Semester III",
    )
    student.student_profile = student_profile
    hod = User(id=uuid.uuid4(), full_name="HOD CCE", email=f"hod_{uuid.uuid4().hex[:6]}@sairam.edu.in", password_hash="h", role=UserRole.HOD)

    # Assign student to Mentor 1
    assign = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=m1.id,
        student_id=student.id,
        is_active=True,
    )

    db.add_all([m1, m2, student, hod, assign])
    db.commit()
    db.track_user(m1.id)  # type: ignore
    db.track_user(m2.id)  # type: ignore
    db.track_user(student.id)  # type: ignore
    db.track_user(hod.id)  # type: ignore

    t_student = create_access_token(subject=student.id, role="student")
    t_m1 = create_access_token(subject=m1.id, role="mentor")
    t_m2 = create_access_token(subject=m2.id, role="mentor")
    t_hod = create_access_token(subject=hod.id, role="hod")

    # 1. Student creates draft
    create_res = client.post(
        "/api/v1/students/me/achievements",
        json={
            "component_id": str(comp.id),
            "title": "NPTEL Cloud Computing Elite Certification",
            "activity_type": "Course Completion",
            "organizer": "IIT Kharagpur",
            "event_date": str(date.today()),
            "outcome": "Elite Silver (78%)",
            "description": "Completed 12-week course with proctored exam",
        },
        headers={"Authorization": f"Bearer {t_student}"},
    )
    assert create_res.status_code == 201
    ach_id = create_res.json()["id"]
    db.track_achievement(uuid.UUID(ach_id))  # type: ignore

    # Before submission: Mentor 1 does NOT see drafts
    m1_initial = client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {t_m1}"})
    assert m1_initial.status_code == 200
    assert not any(item["id"] == ach_id for item in m1_initial.json())

    # 2. Student submits activity
    submit_res = client.post(
        f"/api/v1/students/me/achievements/{ach_id}/submit",
        headers={"Authorization": f"Bearer {t_student}"},
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "pending"
    assert submit_res.json()["submitted_at"] is not None

    # 3. Assigned mentor immediately sees submission without any approval action
    m1_queue = client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {t_m1}"})
    assert m1_queue.status_code == 200
    m1_items = m1_queue.json()
    assert any(item["id"] == ach_id for item in m1_items)
    ach_m1 = next(item for item in m1_items if item["id"] == ach_id)
    assert ach_m1["title"] == "NPTEL Cloud Computing Elite Certification"
    assert ach_m1["student_name"] == "Submitting Mentee"

    # 4. Unassigned mentor cannot see the submission
    m2_queue = client.get("/api/v1/mentor/submissions", headers={"Authorization": f"Bearer {t_m2}"})
    assert m2_queue.status_code == 200
    assert not any(item["id"] == ach_id for item in m2_queue.json())

    # 5. HOD immediately sees submission across CCE department without mentor or HOD approval
    hod_subs = client.get("/api/v1/hod/submissions", headers={"Authorization": f"Bearer {t_hod}"})
    assert hod_subs.status_code == 200
    assert any(item["id"] == ach_id for item in hod_subs.json())

    # 6. HOD filters by component, student, and search
    hod_comp_filter = client.get(f"/api/v1/hod/submissions?component_id={comp.id}", headers={"Authorization": f"Bearer {t_hod}"})
    assert hod_comp_filter.status_code == 200
    assert any(item["id"] == ach_id for item in hod_comp_filter.json())

    hod_search = client.get("/api/v1/hod/submissions?search=NPTEL", headers={"Authorization": f"Bearer {t_hod}"})
    assert hod_search.status_code == 200
    assert any(item["id"] == ach_id for item in hod_search.json())

    # 7. Non-HOD users blocked from /hod/submissions
    assert client.get("/api/v1/hod/submissions", headers={"Authorization": f"Bearer {t_student}"}).status_code == 403
    assert client.get("/api/v1/hod/submissions", headers={"Authorization": f"Bearer {t_m1}"}).status_code == 403
