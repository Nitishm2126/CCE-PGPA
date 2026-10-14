from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, MessageResponse, TokenResponse, UserResponse
from app.services.auth_service import authenticate_user

router = APIRouter()


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain JWT access token",
    description=(
        "Authenticates a user via email and password using Argon2id verification. "
        "Returns a signed JWT bearer token with role claims. Returns a generic 401 on "
        "failure to avoid revealing whether an account exists."
    ),
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = authenticate_user(db, email=login_data.email, password=login_data.password)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact an administrator.",
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        role=user.role,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user account",
    description="Returns identity and role metadata for the currently authenticated user. Never exposes password hashes.",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Client token invalidation guidance",
    description="Guidance for client-side token discard and session termination.",
)
def logout(
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    return MessageResponse(
        message="Successfully logged out. Please discard the access token on the client application."
    )
