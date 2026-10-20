"""
Integration tests for CCE-PGPA:
1. Editable submissions (student can edit/delete pending achievements, revision flow for approved)
2. Shared Messages, Remarks & Congratulations system (RBAC, unread counts, threads, achievement links)
"""
import uuid
from datetime import date, datetime, timezone
from typing import List

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.component import PGPAComponent
from app.models.message import Message, MessageType
from app.models.review import VerificationLog
from app.models.user import HodProfile, MentorProfile, StudentProfile, User, UserRole


@pytest.fixture
def db():
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
        # Clean up messages
        if created_user_ids:
            msgs = session.scalars(
                select(Message).where(
                    (Message.sender_id.in_(created_user_ids)) | (Message.recipient_id.in_(created_user_ids))
                )
            ).all()
            for m in msgs:
                session.delete(m)
            session.commit()

        # Clean up verification logs and achievements
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

        # Clean up mentor assignments and test users
        if created_user_ids:
            assignments = session.scalars(
                select(MentorAssignment).where(
                    (MentorAssignment.student_id.in_(created_user_ids))
                    | (MentorAssignment.mentor_id.in_(created_user_ids))
                )
            ).all()
            for assign in assignments:
                session.delete(assign)

            users = session.scalars(select(User).where(User.id.in_(created_user_ids))).all()
            for u in users:
                session.delete(u)
            session.commit()

        session.close()


def _create_user(db: Session, full_name: str, email: str, role: UserRole) -> User:
    u = User(
        id=uuid.uuid4(),
        email=email,
        full_name=full_name,
        password_hash="hashed_test_password_12345",
        role=role,
        is_active=True,
    )
    db.add(u)
    db.flush()
    db.track_user(u.id)  # type: ignore
    return u


def _get_component(db: Session) -> PGPAComponent:
    comp = db.scalars(select(PGPAComponent)).first()
    assert comp is not None
    return comp


def test_editable_submissions_workflow(client: TestClient, db: Session):
    comp = _get_component(db)
    s1 = _create_user(db, "NITISH M", f"sec25co031_{uuid.uuid4().hex[:6]}@sairamtap.edu.in", UserRole.STUDENT)
    s2 = _create_user(db, "OTHER STUDENT", f"sec25co099_{uuid.uuid4().hex[:6]}@sairamtap.edu.in", UserRole.STUDENT)
    m1 = _create_user(db, "P. LEKHA", f"lekha_{uuid.uuid4().hex[:6]}@sairam.edu.in", UserRole.MENTOR)

    assign = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=m1.id,
        student_id=s1.id,
        is_active=True,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(assign)
    db.commit()

    t_s1 = create_access_token(subject=s1.id, role="student")
    t_s2 = create_access_token(subject=s2.id, role="student")

    # 1. Create and submit achievement
    create_res = client.post(
        "/api/v1/students/me/achievements",
        json={"component_id": str(comp.id), "title": "Smart India Hackathon 2026"},
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert create_res.status_code == 201
    ach_id = create_res.json()["id"]

    submit_res = client.post(
        f"/api/v1/students/me/achievements/{ach_id}/submit",
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "pending"

    # 2. Student 1 CAN edit their own pending submission
    edit_res = client.patch(
        f"/api/v1/students/me/achievements/{ach_id}",
        json={"title": "Smart India Hackathon 2026 - Grand Finalist", "outcome": "Top 10 Team"},
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["title"] == "Smart India Hackathon 2026 - Grand Finalist"
    assert edit_res.json()["outcome"] == "Top 10 Team"
    assert edit_res.json()["status"] == "pending"

    # 3. Student 2 cannot edit or delete Student 1's pending submission
    s2_edit = client.patch(
        f"/api/v1/students/me/achievements/{ach_id}",
        json={"title": "Unauthorized Edit"},
        headers={"Authorization": f"Bearer {t_s2}"},
    )
    assert s2_edit.status_code == 403

    s2_del = client.delete(
        f"/api/v1/students/me/achievements/{ach_id}",
        headers={"Authorization": f"Bearer {t_s2}"},
    )
    assert s2_del.status_code == 403

    # 4. Student 1 CAN delete their own pending submission
    del_res = client.delete(
        f"/api/v1/students/me/achievements/{ach_id}",
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert del_res.status_code == 200

    # 5. Create another achievement and approve it to test revision workflow
    ach2 = Achievement(
        id=uuid.uuid4(),
        student_id=s1.id,
        component_id=comp.id,
        title="NPTEL Cloud Computing Course",
        status=AchievementStatus.APPROVED,
    )
    db.add(ach2)
    db.commit()
    db.track_achievement(ach2.id)  # type: ignore

    # Attempting to delete approved achievement is rejected
    del_approved = client.delete(
        f"/api/v1/students/me/achievements/{ach2.id}",
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert del_approved.status_code == 400
    assert "Cannot delete an approved achievement" in del_approved.json()["detail"]

    # Student edits approved achievement -> initiates controlled revision
    revise_res = client.patch(
        f"/api/v1/students/me/achievements/{ach2.id}",
        json={"outcome": "Elite + Silver Medal 88%"},
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert revise_res.status_code == 200
    assert revise_res.json()["status"] == "pending"
    assert revise_res.json()["outcome"] == "Elite + Silver Medal 88%"
    assert len(revise_res.json()["verification_logs"]) >= 1


def test_mentor_student_messaging(client: TestClient, db: Session):
    comp = _get_component(db)
    s1 = _create_user(db, "STUDENT A", f"student_a_{uuid.uuid4().hex[:6]}@sairamtap.edu.in", UserRole.STUDENT)
    s2 = _create_user(db, "STUDENT B", f"student_b_{uuid.uuid4().hex[:6]}@sairamtap.edu.in", UserRole.STUDENT)
    m1 = _create_user(db, "P. LEKHA", f"lekha_{uuid.uuid4().hex[:6]}@sairam.edu.in", UserRole.MENTOR)
    m2 = _create_user(db, "LURDHUMARY J", f"lurdhumary_{uuid.uuid4().hex[:6]}@sairam.edu.in", UserRole.MENTOR)

    # s1 is assigned to m1; s2 is assigned to m2
    assign1 = MentorAssignment(id=uuid.uuid4(), mentor_id=m1.id, student_id=s1.id, is_active=True, assigned_at=datetime.now(timezone.utc))
    assign2 = MentorAssignment(id=uuid.uuid4(), mentor_id=m2.id, student_id=s2.id, is_active=True, assigned_at=datetime.now(timezone.utc))
    db.add_all([assign1, assign2])

    ach1 = Achievement(id=uuid.uuid4(), student_id=s1.id, component_id=comp.id, title="AI Workshop", status=AchievementStatus.PENDING)
    db.add(ach1)
    db.commit()
    db.track_achievement(ach1.id)  # type: ignore

    t_s1 = create_access_token(subject=s1.id, role="student")
    t_m1 = create_access_token(subject=m1.id, role="mentor")
    t_m2 = create_access_token(subject=m2.id, role="mentor")

    # 1. Mentor 1 sends Congratulations to assigned Student 1
    send_res = client.post(
        "/api/v1/messages",
        json={
            "recipient_id": str(s1.id),
            "message_body": "Outstanding effort on completing the AI Workshop!",
            "message_type": "Congratulations",
            "achievement_id": str(ach1.id),
        },
        headers={"Authorization": f"Bearer {t_m1}"},
    )
    assert send_res.status_code == 201
    msg1 = send_res.json()
    assert msg1["message_type"] == "Congratulations"
    assert msg1["sender_name"] == "P. LEKHA"
    assert msg1["is_read"] is False

    # 2. Mentor 1 sends Action Required remark
    send_act = client.post(
        "/api/v1/messages",
        json={
            "recipient_id": str(s1.id),
            "message_body": "Please re-upload the signed completion certificate.",
            "message_type": "Action Required",
            "achievement_id": str(ach1.id),
        },
        headers={"Authorization": f"Bearer {t_m1}"},
    )
    assert send_act.status_code == 201
    assert send_act.json()["message_type"] == "Action Required"

    # 3. Mentor 2 cannot message Student 1 (cross-mentor violation)
    cross_send = client.post(
        "/api/v1/messages",
        json={
            "recipient_id": str(s1.id),
            "message_body": "Unauthorized message",
            "message_type": "Remark",
        },
        headers={"Authorization": f"Bearer {t_m2}"},
    )
    assert cross_send.status_code == 403

    # 4. Student 1 views messages sent to them
    s1_msgs = client.get(
        f"/api/v1/messages?achievement_id={ach1.id}",
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert s1_msgs.status_code == 200
    assert len(s1_msgs.json()) == 2

    # 5. Student 1 replies to Mentor 1
    reply_res = client.post(
        "/api/v1/messages",
        json={
            "recipient_id": str(m1.id),
            "message_body": "Thank you ma'am, I have uploaded the signed certificate.",
            "message_type": "General Message",
            "achievement_id": str(ach1.id),
            "parent_id": msg1["id"],
        },
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert reply_res.status_code == 201
    assert reply_res.json()["sender_name"] == "STUDENT A"


def test_hod_department_messaging_and_unread(client: TestClient, db: Session):
    s1 = _create_user(db, "STUDENT C", f"student_c_{uuid.uuid4().hex[:6]}@sairamtap.edu.in", UserRole.STUDENT)
    m1 = _create_user(db, "P. LEKHA", f"lekha_{uuid.uuid4().hex[:6]}@sairam.edu.in", UserRole.MENTOR)
    hod = _create_user(db, "Dr. Priya HOD", f"hod_{uuid.uuid4().hex[:6]}@sairam.edu.in", UserRole.HOD)

    assign = MentorAssignment(id=uuid.uuid4(), mentor_id=m1.id, student_id=s1.id, is_active=True, assigned_at=datetime.now(timezone.utc))
    db.add(assign)
    db.commit()

    t_s1 = create_access_token(subject=s1.id, role="student")
    t_hod = create_access_token(subject=hod.id, role="hod")

    # 1. HOD sends department congratulations to Student C
    hod_msg = client.post(
        "/api/v1/messages",
        json={
            "recipient_id": str(s1.id),
            "message_body": "Hearty congratulations on your national hackathon victory from the department!",
            "message_type": "Congratulations",
        },
        headers={"Authorization": f"Bearer {t_hod}"},
    )
    assert hod_msg.status_code == 201
    msg_id = hod_msg.json()["id"]

    # 2. Check unread count for Student C
    unread_res = client.get(
        "/api/v1/messages/unread-count",
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert unread_res.status_code == 200
    assert unread_res.json()["total_unread"] == 1

    # 3. Student C marks message as read
    read_res = client.patch(
        f"/api/v1/messages/{msg_id}/read",
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 4. Unread count becomes 0
    unread_after = client.get(
        "/api/v1/messages/unread-count",
        headers={"Authorization": f"Bearer {t_s1}"},
    )
    assert unread_after.json()["total_unread"] == 0
