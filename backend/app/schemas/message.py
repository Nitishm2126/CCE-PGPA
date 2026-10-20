import uuid
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.message import MessageType


class MessageCreate(BaseModel):
    """
    Payload for sending a new message or remark.
    """
    recipient_id: uuid.UUID = Field(..., description="Target user UUID")
    message_body: str = Field(..., min_length=1, max_length=5000, description="Message content")
    message_type: MessageType = Field(default=MessageType.GENERAL, description="Remark, Congratulations, Action Required, or General Message")
    achievement_id: Optional[uuid.UUID] = Field(None, description="Optional associated achievement UUID")
    parent_id: Optional[uuid.UUID] = Field(None, description="Optional parent message UUID for replies")


class MessageResponse(BaseModel):
    """
    Full message response schema.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    sender_role: str
    recipient_id: uuid.UUID
    recipient_name: str
    recipient_role: str
    message_body: str
    message_type: MessageType
    achievement_id: Optional[uuid.UUID] = None
    achievement_title: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime


class UnreadCountResponse(BaseModel):
    """
    Summary of unread messages for the authenticated user.
    """
    total_unread: int
    by_achievement: Dict[str, int] = {}


class BatchReadRequest(BaseModel):
    """
    Payload for marking multiple messages as read.
    """
    achievement_id: Optional[uuid.UUID] = None
    message_ids: Optional[List[uuid.UUID]] = None
