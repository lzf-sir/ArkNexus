"""Auth endpoints: register / login / me / profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, db_session
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import (
    PasswordChange,
    ProfileUpdate,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
)
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_user_read(user: User) -> UserRead:
    return UserRead.model_validate(user)


def _token_for(user: User) -> TokenResponse:
    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email},
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=_to_user_read(user),
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new account and issue an access token.",
)
async def register_endpoint(
    payload: UserCreate,
    session: AsyncSession = Depends(db_session),
) -> TokenResponse:
    try:
        user = await user_service.create_user(session, payload)
    except user_service.UserAlreadyExists as exc:
        raise HTTPException(status_code=409, detail=f"Email already registered: {exc.args[0]}") from exc
    return _token_for(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate with email + password and issue an access token.",
)
async def login_endpoint(
    payload: UserLogin,
    session: AsyncSession = Depends(db_session),
) -> TokenResponse:
    try:
        user = await user_service.authenticate(session, payload.email, payload.password)
    except user_service.InvalidCredentials as exc:
        raise HTTPException(status_code=401, detail="Invalid email or password") from exc
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return _token_for(user)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Return the current authenticated user (token introspection).",
)
async def me_endpoint(
    user: User = Depends(current_user),
) -> UserRead:
    return _to_user_read(user)


@router.patch(
    "/me",
    response_model=UserRead,
    summary="Update the current user profile (display_name).",
)
async def update_me_endpoint(
    payload: ProfileUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> UserRead:
    user = await user_service.update_profile(
        session, user, display_name=payload.display_name
    )
    return _to_user_read(user)


@router.post(
    "/me/password",
    response_model=UserRead,
    summary="Change the current user password (requires current password).",
)
async def change_password_endpoint(
    payload: PasswordChange,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> UserRead:
    try:
        user = await user_service.change_password(
            session,
            user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except user_service.InvalidCredentials as exc:
        raise HTTPException(status_code=401, detail="Current password is incorrect") from exc
    return _to_user_read(user)