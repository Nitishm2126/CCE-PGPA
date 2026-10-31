import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog
from app.models.component import PGPAComponent
from app.models.semester import Semester
from app.models.user import MentorProfile, StudentProfile, User, UserRole


@pytest.fixture
def db():
    session = SessionLocal()
    created_user_ids: list[uuid.UUID] = []
    created_achievement_ids: list[uuid.UUID] = []

    def _track_user(user_id: uuid.UUID):
        created_user_ids.append(user_id)

    def _track_achievement(achievement_id: uuid.UUID):
        created_achievement_ids.append(achievement_id)

    session.track_user = _track_user  # type: ignore
    session.track_achievement = _track_achievement  # type: ignore

    try:
        yield session
    finally:
        session.rollback()
        session.expunge_all()

        if created_achievement_ids:
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

            user_str_ids = [str(u) for u in created_user_ids]
            audit_logs = session.scalars(
                select(AuditLog).where(
                    AuditLog.actor_id.in_(created_user_ids) | AuditLog.target_id.in_(user_str_ids)
                )
            ).all()
            for al in audit_logs:
                session.delete(al)

            for uid in created_user_ids:
                u = session.get(User, uid)
                if u:
                    session.delete(u)
            session.commit()

        session.close()


def _get_or_create_admin(db: Session) -> tuple[User, str]:
    admin = db.scalars(select(User).where(User.role == UserRole.ADMIN, User.is_active.is_(True))).first()
    if not admin:
        admin = User(
            id=uuid.uuid4(),
            full_name="Visibility Test Admin",
            email=f"admin_vis_{uuid.uuid4().hex[:6]}@cce.edu",
            password_hash=get_password_hash("AdminPass123!"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        if hasattr(db, "track_user"):
            db.track_user(admin.id)
    token = create_access_token(subject=str(admin.id), role=admin.role.value)
    return admin, token


def _create_test_student(db: Session, semester_str: str = "Semester 1") -> tuple[User, str]:
    uid = uuid.uuid4()
    student = User(
        id=uid,
        full_name="Visibility Test Student",
        email=f"student_vis_{uid.hex[:6]}@cce.edu",
        password_hash=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student)
    db.commit()

    sp = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        register_number=f"REGVIS{uid.hex[:6].upper()}",
        department="CCE",
        year=1,
        semester=semester_str,
    )
    db.add(sp)
    db.commit()

    if hasattr(db, "track_user"):
        db.track_user(student.id)

    token = create_access_token(subject=str(student.id), role=student.role.value)
    return student, token


def _create_test_mentor(db: Session) -> tuple[User, str]:
    uid = uuid.uuid4()
    mentor = User(
        id=uid,
        full_name="Visibility Test Mentor",
        email=f"mentor_vis_{uid.hex[:6]}@cce.edu",
        password_hash=get_password_hash("MentorPass123!"),
        role=UserRole.MENTOR,
        is_active=True,
    )
    db.add(mentor)
    db.commit()

    mp = MentorProfile(
        id=uuid.uuid4(),
        user_id=mentor.id,
        staff_id=f"STF{uid.hex[:6].upper()}",
        department="CCE",
        designation="Assistant Professor",
    )
    db.add(mp)
    db.commit()

    if hasattr(db, "track_user"):
        db.track_user(mentor.id)

    token = create_access_token(subject=str(mentor.id), role=mentor.role.value)
    return mentor, token


def _create_test_hod(db: Session) -> tuple[User, str]:
    uid = uuid.uuid4()
    hod = User(
        id=uid,
        full_name="Visibility Test HOD",
        email=f"hod_vis_{uid.hex[:6]}@cce.edu",
        password_hash=get_password_hash("HodPass123!"),
        role=UserRole.HOD,
        is_active=True,
    )
    db.add(hod)
    db.commit()

    if hasattr(db, "track_user"):
        db.track_user(hod.id)

    token = create_access_token(subject=str(hod.id), role=hod.role.value)
    return hod, token


def test_admin_can_toggle_component_visibility(client: TestClient, db: Session):
    admin, admin_token = _get_or_create_admin(db)
    component = db.scalars(select(PGPAComponent).where(PGPAComponent.is_active.is_(True))).first()
    assert component is not None, "At least one active PGPA component must exist"

    initial_visibility = component.is_visible

    try:
        # 1. Admin hides the component
        res_hide = client.patch(
            f"/api/v1/admin/components/{component.id}/visibility",
            json={"is_visible": False},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res_hide.status_code == 200, res_hide.text
        data_hide = res_hide.json()
        assert data_hide["is_visible"] is False
        assert data_hide["slug"] == component.slug
        assert "hidden" in data_hide["message"].lower()

        db.refresh(component)
        assert component.is_visible is False

        # Verify audit log was recorded
        audit = db.scalars(
            select(AuditLog).where(
                AuditLog.action == "update_component_visibility",
                AuditLog.target_id == str(component.id),
            ).order_by(AuditLog.created_at.desc())
        ).first()
        assert audit is not None
        assert audit.actor_id == admin.id
        assert audit.action_metadata["new_visibility"] is False

        # 2. Admin restores component visibility
        res_show = client.patch(
            f"/api/v1/admin/components/{component.id}/visibility",
            json={"is_visible": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res_show.status_code == 200, res_show.text
        data_show = res_show.json()
        assert data_show["is_visible"] is True
        assert "visible" in data_show["message"].lower()

        db.refresh(component)
        assert component.is_visible is True

    finally:
        component.is_visible = initial_visibility
        db.commit()


def test_non_admin_cannot_toggle_visibility(client: TestClient, db: Session):
    component = db.scalars(select(PGPAComponent).where(PGPAComponent.is_active.is_(True))).first()
    assert component is not None

    _, student_token = _create_test_student(db)
    _, mentor_token = _create_test_mentor(db)
    _, hod_token = _create_test_hod(db)

    # Student forbidden
    res = client.patch(
        f"/api/v1/admin/components/{component.id}/visibility",
        json={"is_visible": False},
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res.status_code == 403

    # Mentor forbidden
    res = client.patch(
        f"/api/v1/admin/components/{component.id}/visibility",
        json={"is_visible": False},
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert res.status_code == 403

    # HOD forbidden
    res = client.patch(
        f"/api/v1/admin/components/{component.id}/visibility",
        json={"is_visible": False},
        headers={"Authorization": f"Bearer {hod_token}"},
    )
    assert res.status_code == 403

    # Unauthenticated rejected
    res = client.patch(
        f"/api/v1/admin/components/{component.id}/visibility",
        json={"is_visible": False},
    )
    assert res.status_code in (401, 403)


def test_component_visibility_filtering_across_roles(client: TestClient, db: Session):
    component = db.scalars(
        select(PGPAComponent).where(PGPAComponent.is_active.is_(True), PGPAComponent.submission_mode != "hod_excel_import")
    ).first()
    assert component is not None

    initial_visibility = component.is_visible
    admin, admin_token = _get_or_create_admin(db)
    student, student_token = _create_test_student(db)
    _, hod_token = _create_test_hod(db)

    try:
        # Hide the component
        component.is_visible = False
        db.commit()

        # 1. Student /components excludes hidden component
        res_stu = client.get(
            "/api/v1/students/components",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert res_stu.status_code == 200
        student_comp_ids = [c["id"] for c in res_stu.json()]
        assert str(component.id) not in student_comp_ids

        # 2. HOD /components excludes hidden component
        res_hod = client.get(
            "/api/v1/hod/components",
            headers={"Authorization": f"Bearer {hod_token}"},
        )
        assert res_hod.status_code == 200
        hod_comp_ids = [c["id"] for c in res_hod.json()]
        assert str(component.id) not in hod_comp_ids

        # 3. Admin matrix retains all components and shows is_visible=False
        res_admin = client.get(
            "/api/v1/admin/components/semester-matrix",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res_admin.status_code == 200
        admin_comps = {c["component_id"]: c for c in res_admin.json()["components"]}
        assert str(component.id) in admin_comps
        assert admin_comps[str(component.id)]["is_visible"] is False

        # 4. Student submitting hidden component is rejected with 400
        open_sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
        res_submit = client.post(
            "/api/v1/students/me/achievements",
            json={
                "component_id": str(component.id),
                "semester_id": str(open_sem.id) if open_sem else None,
                "title": "Hidden Component Activity Attempt",
                "component_metadata": {"role": "Member"},
            },
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert res_submit.status_code == 400
        assert "hidden and does not accept submissions" in res_submit.text.lower()

        # 5. Restore visibility
        component.is_visible = True
        db.commit()

        # Re-check student listing
        res_stu_restored = client.get(
            "/api/v1/students/components",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert res_stu_restored.status_code == 200
        restored_comp_ids = [c["id"] for c in res_stu_restored.json()]
        assert str(component.id) in restored_comp_ids

    finally:
        component.is_visible = initial_visibility
        db.commit()


def test_mentor_queue_hides_pending_of_hidden_component(client: TestClient, db: Session):
    component = db.scalars(
        select(PGPAComponent).where(
            PGPAComponent.is_active.is_(True),
            PGPAComponent.submission_mode != "hod_excel_import",
            PGPAComponent.requires_verification.is_(True),
        )
    ).first()
    assert component is not None

    initial_visibility = component.is_visible
    student, student_token = _create_test_student(db)
    mentor, mentor_token = _create_test_mentor(db)

    # Assign student to mentor
    assignment = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=mentor.id,
        student_id=student.id,
        is_active=True,
    )
    db.add(assignment)
    db.commit()

    open_sem = db.scalars(select(Semester).where(Semester.is_enabled.is_(True))).first()
    sem_id = open_sem.id if open_sem else None

    # Create two achievements: one PENDING, one APPROVED
    pending_ach = Achievement(
        id=uuid.uuid4(),
        student_id=student.id,
        component_id=component.id,
        semester_id=sem_id,
        title="Pending Activity on Test Component",
        status=AchievementStatus.PENDING,
        created_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    approved_ach = Achievement(
        id=uuid.uuid4(),
        student_id=student.id,
        component_id=component.id,
        semester_id=sem_id,
        title="Approved Historical Activity",
        status=AchievementStatus.APPROVED,
        created_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    db.add_all([pending_ach, approved_ach])
    db.commit()

    if hasattr(db, "track_achievement"):
        db.track_achievement(pending_ach.id)
        db.track_achievement(approved_ach.id)

    try:
        # Step A: While component is VISIBLE, mentor sees both
        component.is_visible = True
        db.commit()

        res_visible = client.get(
            "/api/v1/mentor/submissions",
            headers={"Authorization": f"Bearer {mentor_token}"},
        )
        assert res_visible.status_code == 200
        visible_ids = [s["id"] for s in res_visible.json()]
        assert str(pending_ach.id) in visible_ids
        assert str(approved_ach.id) in visible_ids

        # Step B: Admin hides component
        component.is_visible = False
        db.commit()

        # Mentor queue must HIDE pending submissions of hidden component, but KEEP approved historical
        res_hidden = client.get(
            "/api/v1/mentor/submissions",
            headers={"Authorization": f"Bearer {mentor_token}"},
        )
        assert res_hidden.status_code == 200
        hidden_ids = [s["id"] for s in res_hidden.json()]
        assert str(pending_ach.id) not in hidden_ids, "Pending submission under hidden component must be excluded"
        assert str(approved_ach.id) in hidden_ids, "Approved historical submission must remain intact and visible"

        # Explicit pending filter also excludes it
        res_pending_only = client.get(
            "/api/v1/mentor/submissions?status=pending",
            headers={"Authorization": f"Bearer {mentor_token}"},
        )
        assert res_pending_only.status_code == 200
        pending_only_ids = [s["id"] for s in res_pending_only.json()]
        assert str(pending_ach.id) not in pending_only_ids

        # Step C: Admin re-enables visibility
        component.is_visible = True
        db.commit()

        res_restored = client.get(
            "/api/v1/mentor/submissions",
            headers={"Authorization": f"Bearer {mentor_token}"},
        )
        assert res_restored.status_code == 200
        restored_ids = [s["id"] for s in res_restored.json()]
        assert str(pending_ach.id) in restored_ids
        assert str(approved_ach.id) in restored_ids

    finally:
        component.is_visible = initial_visibility
        db.commit()
