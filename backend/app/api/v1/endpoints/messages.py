import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import get_current_user
from app.db.session import get_db
from app.models.achievement import Achievement
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog
from app.models.message import Message, MessageType
from app.models.user import HodProfile, StudentProfile, User, UserRole
from app.schemas.message import (
    BatchReadRequest,
    MessageCreate,
    MessageResponse,
    UnreadCountResponse,
)

router = APIRouter()


def _format_message_response(msg: Message, db: Session) -> MessageResponse:
    sender = msg.sender or db.get(User, msg.sender_id)
    recipient = msg.recipient or db.get(User, msg.recipient_id)
    ach = msg.achievement or (db.get(Achievement, msg.achievement_id) if msg.achievement_id else None)

    return MessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        sender_name=sender.full_name if sender else "Unknown User",
        sender_role=sender.role.value if sender else "unknown",
        recipient_id=msg.recipient_id,
        recipient_name=recipient.full_name if recipient else "Unknown User",
        recipient_role=recipient.role.value if recipient else "unknown",
        message_body=msg.message_body,
        message_type=msg.message_type,
        achievement_id=msg.achievement_id,
        achievement_title=ach.title if ach else None,
        parent_id=msg.parent_id,
        is_read=msg.is_read,
        read_at=msg.read_at,
        created_at=msg.created_at,
    )


def _get_assigned_student_ids(db: Session, mentor_id: uuid.UUID) -> List[uuid.UUID]:
    stmt = select(MentorAssignment.student_id).where(
        MentorAssignment.mentor_id == mentor_id,
        MentorAssignment.is_active.is_(True),
    )
    return list(db.scalars(stmt).all())


def _get_student_mentor_ids(db: Session, student_id: uuid.UUID) -> List[uuid.UUID]:
    stmt = select(MentorAssignment.mentor_id).where(
        MentorAssignment.student_id == student_id,
        MentorAssignment.is_active.is_(True),
    )
    return list(db.scalars(stmt).all())


def _get_hod_user_ids(db: Session) -> List[uuid.UUID]:
    stmt = select(User.id).where(
        User.role == UserRole.HOD,
        User.is_active.is_(True),
    )
    return list(db.scalars(stmt).all())


@router.get(
    "",
    response_model=List[MessageResponse],
    summary="List messages and remarks scoped by caller role and filters",
    description=(
        "Retrieves conversation history. Students view own messages; Mentors view assigned mentee "
        "conversations; HOD views department-wide messages."
    ),
)
def list_messages(
    achievement_id: Optional[uuid.UUID] = Query(None, description="Filter by achievement submission"),
    student_id: Optional[uuid.UUID] = Query(None, description="Filter by student user UUID"),
    message_type: Optional[MessageType] = Query(None, description="Filter by message type"),
    unread_only: bool = Query(False, description="Filter only unread messages received by caller"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[MessageResponse]:
    stmt = select(Message).options(
        joinedload(Message.sender),
        joinedload(Message.recipient),
        joinedload(Message.achievement),
    )

    # 1. Role-based scoping
    if current_user.role == UserRole.STUDENT:
        # Students only see messages where they are sender or recipient
        stmt = stmt.where(
            or_(
                Message.sender_id == current_user.id,
                Message.recipient_id == current_user.id,
            )
        )
        if achievement_id:
            ach = db.get(Achievement, achievement_id)
            if not ach or ach.student_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: You cannot view messages for another student's achievement.",
                )
    elif current_user.role == UserRole.MENTOR:
        assigned_ids = _get_assigned_student_ids(db, current_user.id)
        # Mentor sees messages where:
        # - Mentor is sender or recipient
        # - OR message involves one of their assigned mentees
        stmt = stmt.where(
            or_(
                Message.sender_id == current_user.id,
                Message.recipient_id == current_user.id,
                Message.sender_id.in_(assigned_ids),
                Message.recipient_id.in_(assigned_ids),
            )
        )
        if student_id and student_id not in assigned_ids and student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: This student is not assigned to your mentor portfolio.",
            )
        if achievement_id:
            ach = db.get(Achievement, achievement_id)
            if not ach or (ach.student_id not in assigned_ids and ach.student_id != current_user.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: Achievement belongs to a student outside your mentor queue.",
                )
    elif current_user.role in (UserRole.HOD, UserRole.ADMIN):
        # HOD / Admin have department / system-wide visibility
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role not authorized to access messages.",
        )

    # 2. Filters
    if achievement_id:
        stmt = stmt.where(Message.achievement_id == achievement_id)
    if student_id:
        stmt = stmt.where(
            or_(
                Message.sender_id == student_id,
                Message.recipient_id == student_id,
            )
        )
    if message_type:
        stmt = stmt.where(Message.message_type == message_type)
    if unread_only:
        stmt = stmt.where(
            Message.recipient_id == current_user.id,
            Message.is_read.is_(False),
        )

    stmt = stmt.order_by(Message.created_at.asc()).offset(offset).limit(limit)
    messages = db.scalars(stmt).all()

    return [_format_message_response(m, db) for m in messages]


@router.post(
    "",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message, remark, congratulations, or action required",
    description="Enforces strict authorization: sender is authenticated user; recipients must be within authorized institutional scope.",
)
def send_message(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    # 1. Verify recipient exists and is active
    recipient = db.get(User, payload.recipient_id)
    if not recipient or not recipient.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipient user with ID '{payload.recipient_id}' not found or inactive.",
        )

    # Cannot message self
    if recipient.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send a message to yourself.",
        )

    # 2. Verify institutional relationship / scope
    hod_ids = _get_hod_user_ids(db)
    if current_user.role == UserRole.STUDENT:
        # Students can message:
        # - Their assigned mentor(s)
        # - The department HOD
        # - Or reply to a message they received from someone
        mentor_ids = _get_student_mentor_ids(db, current_user.id)
        allowed_recipients = set(mentor_ids).union(hod_ids)

        if payload.parent_id:
            parent_msg = db.get(Message, payload.parent_id)
            if parent_msg and parent_msg.sender_id:
                allowed_recipients.add(parent_msg.sender_id)

        if recipient.id not in allowed_recipients:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Students can only message their assigned Faculty Mentor or Department HOD.",
            )

        if payload.achievement_id:
            ach = db.get(Achievement, payload.achievement_id)
            if not ach or ach.student_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: Cannot link a message to another student's achievement.",
                )

    elif current_user.role == UserRole.MENTOR:
        # Mentors can message:
        # - Their assigned students
        # - The department HOD
        assigned_ids = _get_assigned_student_ids(db, current_user.id)
        allowed_recipients = set(assigned_ids).union(hod_ids)

        if recipient.id not in allowed_recipients:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Faculty Mentors can only message their assigned mentees or Department HOD.",
            )

        if payload.achievement_id:
            ach = db.get(Achievement, payload.achievement_id)
            if not ach or ach.student_id not in assigned_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: Achievement belongs to a student outside your assigned portfolio.",
                )

    elif current_user.role == UserRole.HOD:
        # HOD can message any student or mentor in the department
        if recipient.role not in (UserRole.STUDENT, UserRole.MENTOR, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid recipient role.",
            )

        if payload.achievement_id:
            ach = db.get(Achievement, payload.achievement_id)
            if not ach:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Linked achievement record not found.",
                )

    elif current_user.role == UserRole.ADMIN:
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role not authorized to send messages.",
        )

    # 3. Create message
    new_message = Message(
        id=uuid.uuid4(),
        sender_id=current_user.id,
        recipient_id=recipient.id,
        message_body=payload.message_body.strip(),
        message_type=payload.message_type,
        achievement_id=payload.achievement_id,
        parent_id=payload.parent_id,
        is_read=False,
        read_at=None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_message)

    audit_entry = AuditLog(
        actor_id=current_user.id,
        action="send_message",
        target_type="message",
        target_id=str(new_message.id),
        action_metadata={
            "recipient_id": str(recipient.id),
            "recipient_role": recipient.role.value,
            "message_type": payload.message_type.value,
            "achievement_id": str(payload.achievement_id) if payload.achievement_id else None,
        },
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(new_message)

    return _format_message_response(new_message, db)


@router.patch(
    "/{message_id}/read",
    response_model=MessageResponse,
    summary="Mark a specific message as read",
    description="Permitted only for the recipient of the message or authorized administrator.",
)
def mark_message_read(
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    msg = db.get(Message, message_id)
    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Message with ID '{message_id}' not found.",
        )

    if msg.recipient_id != current_user.id and current_user.role not in (UserRole.HOD, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Only the message recipient can mark it as read.",
        )

    if not msg.is_read:
        msg.is_read = True
        msg.read_at = datetime.now(timezone.utc)
        db.add(msg)
        db.commit()
        db.refresh(msg)

    return _format_message_response(msg, db)


@router.post(
    "/read-all",
    summary="Batch mark messages as read for caller",
    description="Marks incoming messages as read, optionally scoped to a single achievement submission.",
)
def mark_all_read(
    payload: BatchReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Message).where(
        Message.recipient_id == current_user.id,
        Message.is_read.is_(False),
    )

    if payload.achievement_id:
        stmt = stmt.where(Message.achievement_id == payload.achievement_id)
    if payload.message_ids:
        stmt = stmt.where(Message.id.in_(payload.message_ids))

    unread_messages = db.scalars(stmt).all()
    now_utc = datetime.now(timezone.utc)
    count = 0
    for m in unread_messages:
        m.is_read = True
        m.read_at = now_utc
        db.add(m)
        count += 1

    if count > 0:
        db.commit()

    return {"detail": f"Marked {count} messages as read.", "count": count}


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread message count summary for caller",
    description="Returns caller's total unread incoming messages and breakdown by achievement.",
)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UnreadCountResponse:
    # 1. Total unread messages
    total_stmt = select(func.count(Message.id)).where(
        Message.recipient_id == current_user.id,
        Message.is_read.is_(False),
    )
    total_unread = db.scalar(total_stmt) or 0

    # 2. Unread count by achievement
    by_ach_stmt = (
        select(Message.achievement_id, func.count(Message.id))
        .where(
            Message.recipient_id == current_user.id,
            Message.is_read.is_(False),
            Message.achievement_id.is_not(None),
        )
        .group_by(Message.achievement_id)
    )
    by_ach_rows = db.execute(by_ach_stmt).all()
    by_achievement = {str(row[0]): int(row[1]) for row in by_ach_rows if row[0]}

    return UnreadCountResponse(
        total_unread=total_unread,
        by_achievement=by_achievement,
    )
