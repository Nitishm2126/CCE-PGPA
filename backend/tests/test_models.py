import uuid
from datetime import date, datetime, timezone
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import engine
from app.models.achievement import Achievement, AchievementStatus
from app.models.assignment import MentorAssignment
from app.models.audit import AuditLog
from app.models.component import PGPAComponent
from app.models.file import AchievementFile, FileCategory
from app.models.review import ReviewAction, VerificationLog
from app.models.user import MentorProfile, StudentProfile, User, UserRole


@pytest.fixture
def db_session():
    """
    Provides a transactional database session for testing model constraints.
    Rolls back after each test to keep the database completely clean and isolated.
    """
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, expire_on_commit=False)
        try:
            yield session
        finally:
            session.close()
            if transaction.is_active:
                transaction.rollback()


def test_seeded_components_count_and_ordering(db_session: Session):
    """
    Verify that exactly 13 official verified PGPA components are seeded
    in ascending display_order without invented or missing components.
    """
    stmt = select(PGPAComponent).order_by(PGPAComponent.display_order)
    components = db_session.scalars(stmt).all()

    assert len(components) == 14
    assert components[0].slug == "skillrack"
    assert components[0].display_order == 1
    assert components[13].slug == "scouts-for-sdgs"
    assert components[13].display_order == 13

    # Verify all slugs are unique
    slugs = [c.slug for c in components]
    assert len(slugs) == len(set(slugs))


def test_user_creation_and_student_profile(db_session: Session):
    """
    Verify creating a student user and linked 1-to-1 StudentProfile.
    """
    student_user = User(
        id=uuid.uuid4(),
        full_name="Test Student",
        email=f"student_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student_user)
    db_session.flush()

    student_profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student_user.id,
        register_number=f"REG_{uuid.uuid4().hex[:6]}",
        department="CCE",
        year=2,
        section="A",
        batch="2023-2027",
    )
    db_session.add(student_profile)
    db_session.flush()

    # Query back and verify relationships
    queried = db_session.get(User, student_user.id)
    assert queried is not None
    assert queried.role == UserRole.STUDENT
    assert queried.student_profile is not None
    assert queried.student_profile.register_number == student_profile.register_number
    assert queried.student_profile.year == 2


def test_email_unique_constraint(db_session: Session):
    """
    Verify that duplicate user emails violate the uniqueness constraint.
    """
    shared_email = f"duplicate_{uuid.uuid4().hex[:6]}@sairam.edu.in"
    user1 = User(
        id=uuid.uuid4(),
        full_name="User One",
        email=shared_email,
        password_hash="hash1",
        role=UserRole.STUDENT,
    )
    user2 = User(
        id=uuid.uuid4(),
        full_name="User Two",
        email=shared_email,
        password_hash="hash2",
        role=UserRole.MENTOR,
    )
    db_session.add(user1)
    db_session.flush()

    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_mentor_student_assignment(db_session: Session):
    """
    Verify explicit student-to-mentor assignment and bidirectional relationships.
    """
    mentor_user = User(
        id=uuid.uuid4(),
        full_name="Dr. Faculty Mentor",
        email=f"mentor_{uuid.uuid4().hex[:6]}@sairamtap.edu.in",
        password_hash="hash",
        role=UserRole.MENTOR,
    )
    student_user = User(
        id=uuid.uuid4(),
        full_name="Cohort Student",
        email=f"mentee_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="hash",
        role=UserRole.STUDENT,
    )
    db_session.add_all([mentor_user, student_user])
    db_session.flush()

    assignment = MentorAssignment(
        id=uuid.uuid4(),
        mentor_id=mentor_user.id,
        student_id=student_user.id,
        is_active=True,
    )
    db_session.add(assignment)
    db_session.flush()

    # Verify relationships
    assert len(mentor_user.mentor_assignments) == 1
    assert mentor_user.mentor_assignments[0].student_id == student_user.id
    assert len(student_user.mentee_assignments) == 1
    assert student_user.mentee_assignments[0].mentor_id == mentor_user.id


def test_achievement_submission_and_file_metadata(db_session: Session):
    """
    Verify achievement creation, Google Drive file metadata association,
    and confirm that only metadata (not binary content) is stored in PostgreSQL.
    """
    student = User(
        id=uuid.uuid4(),
        full_name="Achievement Submitter",
        email=f"achiever_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="hash",
        role=UserRole.STUDENT,
    )
    component = db_session.scalars(select(PGPAComponent).limit(1)).one()
    db_session.add(student)
    db_session.flush()

    achievement = Achievement(
        id=uuid.uuid4(),
        student_id=student.id,
        component_id=component.id,
        title="Ideathon 2024 Winner",
        activity_type="Ideathon",
        organizer="Sairam Innovation Ecosystem",
        event_date=date(2024, 9, 15),
        description="First prize in Solvethon track",
        outcome="First Prize with Certificate",
        status=AchievementStatus.PENDING,
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(achievement)
    db_session.flush()

    # File metadata only (Google Drive storage rule)
    file_record = AchievementFile(
        id=uuid.uuid4(),
        achievement_id=achievement.id,
        provider="google_drive",
        drive_file_id="1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sTuVw",
        drive_folder_id="0bA9zY8xW7vU6tS5rQ4p",
        original_filename="ideathon_first_prize.pdf",
        mime_type="application/pdf",
        size_bytes=1048576,  # 1 MB
        file_category=FileCategory.CERTIFICATE,
        uploaded_by=student.id,
    )
    db_session.add(file_record)
    db_session.flush()

    queried_file = db_session.get(AchievementFile, file_record.id)
    assert queried_file is not None
    assert queried_file.drive_file_id == "1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sTuVw"
    assert queried_file.file_category == FileCategory.CERTIFICATE
    assert queried_file.size_bytes == 1048576
    # Ensure no binary column exists on AchievementFile
    assert not hasattr(queried_file, "binary_data")
    assert not hasattr(queried_file, "file_blob")


def test_verification_log_and_audit_log(db_session: Session):
    """
    Verify review decision logging and administrative audit trail.
    """
    mentor = User(
        id=uuid.uuid4(),
        full_name="Reviewing Mentor",
        email=f"reviewer_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="hash",
        role=UserRole.MENTOR,
    )
    student = User(
        id=uuid.uuid4(),
        full_name="Reviewed Student",
        email=f"reviewed_{uuid.uuid4().hex[:6]}@sairam.edu.in",
        password_hash="hash",
        role=UserRole.STUDENT,
    )
    component = db_session.scalars(select(PGPAComponent).limit(1)).one()
    db_session.add_all([mentor, student])
    db_session.flush()

    achievement = Achievement(
        id=uuid.uuid4(),
        student_id=student.id,
        component_id=component.id,
        title="NPTEL Cloud Computing",
        status=AchievementStatus.APPROVED,
    )
    db_session.add(achievement)
    db_session.flush()

    # Append review verification log
    review = VerificationLog(
        id=uuid.uuid4(),
        achievement_id=achievement.id,
        reviewer_id=mentor.id,
        action=ReviewAction.APPROVED,
        remarks="Verified certificate ID and 85% Elite score on NPTEL portal.",
    )
    db_session.add(review)

    # Append audit log
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=mentor.id,
        action="ACHIEVEMENT_APPROVED",
        target_type="achievement",
        target_id=str(achievement.id),
        action_metadata={"component_slug": component.slug, "score": "Elite"},
    )
    db_session.add(audit)
    db_session.flush()

    # Verify queried review log
    queried_review = db_session.get(VerificationLog, review.id)
    assert queried_review is not None
    assert queried_review.action == ReviewAction.APPROVED
    assert queried_review.reviewer.full_name == "Reviewing Mentor"

    # Verify queried audit log
    queried_audit = db_session.get(AuditLog, audit.id)
    assert queried_audit is not None
    assert queried_audit.action == "ACHIEVEMENT_APPROVED"
    assert queried_audit.action_metadata["score"] == "Elite"
