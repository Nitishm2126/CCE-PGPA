"""create_messages_table

Revision ID: c7391a8e5f20
Revises: b81c2d3e4f5a
Create Date: 2026-10-19 14:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID


# revision identifiers, used by Alembic.
revision: str = 'c7391a8e5f20'
down_revision: Union[str, None] = 'b81c2d3e4f5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotently ensure the enum type exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
                CREATE TYPE message_type AS ENUM ('Remark', 'Congratulations', 'Action Required', 'General Message');
            END IF;
        END
        $$;
    """)

    op.create_table(
        'messages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('sender_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recipient_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('message_body', sa.Text(), nullable=False),
        sa.Column('message_type', ENUM('Remark', 'Congratulations', 'Action Required', 'General Message', name='message_type', create_type=False), nullable=False, server_default='General Message'),
        sa.Column('achievement_id', UUID(as_uuid=True), sa.ForeignKey('achievements.id', ondelete='SET NULL'), nullable=True),
        sa.Column('parent_id', UUID(as_uuid=True), sa.ForeignKey('messages.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)
    op.create_index(op.f('ix_messages_recipient_id'), 'messages', ['recipient_id'], unique=False)
    op.create_index(op.f('ix_messages_message_type'), 'messages', ['message_type'], unique=False)
    op.create_index(op.f('ix_messages_achievement_id'), 'messages', ['achievement_id'], unique=False)
    op.create_index(op.f('ix_messages_parent_id'), 'messages', ['parent_id'], unique=False)
    op.create_index(op.f('ix_messages_is_read'), 'messages', ['is_read'], unique=False)
    op.create_index(op.f('ix_messages_created_at'), 'messages', ['created_at'], unique=False)
    op.create_index('ix_messages_recipient_is_read', 'messages', ['recipient_id', 'is_read'], unique=False)
    op.create_index('ix_messages_achievement_created', 'messages', ['achievement_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_messages_achievement_created', table_name='messages')
    op.drop_index('ix_messages_recipient_is_read', table_name='messages')
    op.drop_index(op.f('ix_messages_created_at'), table_name='messages')
    op.drop_index(op.f('ix_messages_is_read'), table_name='messages')
    op.drop_index(op.f('ix_messages_parent_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_achievement_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_message_type'), table_name='messages')
    op.drop_index(op.f('ix_messages_recipient_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_table('messages')

    op.execute("DROP TYPE IF EXISTS message_type;")
