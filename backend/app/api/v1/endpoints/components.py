import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_hod_or_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.point_settings import (
    ComponentPointSettingsResponse,
    ComponentPointSettingsUpdatePayload,
)
from app.services.component_point_service import (
    get_all_point_settings,
    get_single_point_settings,
    update_point_settings,
)

router = APIRouter()


@router.get(
    "/point-settings",
    response_model=List[ComponentPointSettingsResponse],
    status_code=status.HTTP_200_OK,
    summary="Get centralized PGPA component point settings",
    description="Returns the centralized scoring rules and semester-wise point boundaries for all 14 PGPA components. Available to all authenticated members (Student, Mentor, HOD, Admin) with read-only access.",
)
def list_component_point_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ComponentPointSettingsResponse]:
    return get_all_point_settings(db)


@router.get(
    "/{component_id}/point-settings",
    response_model=ComponentPointSettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get point settings for a specific component",
)
def retrieve_component_point_settings(
    component_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ComponentPointSettingsResponse:
    return get_single_point_settings(db, component_id)


@router.put(
    "/{component_id}/point-settings",
    response_model=ComponentPointSettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Update centralized PGPA component point settings",
    description="Updates the semester-wise scoring configuration for a PGPA component. Restricted strictly to HOD and Admin roles. Every modification is recorded in institutional audit logs.",
)
def save_component_point_settings(
    component_id: uuid.UUID,
    payload: ComponentPointSettingsUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hod_or_admin),
) -> ComponentPointSettingsResponse:
    return update_point_settings(db, component_id, payload, current_user)
