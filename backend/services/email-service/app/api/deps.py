"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import AsyncIterator, Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_session
from app.models.user import User
from sqlalchemy import select


async def db_session() -> AsyncIterator[AsyncSession]:
    async for session in get_session():
        yield session


DBSession = Depends(db_session)


async def current_user_optional(
    authorization: Optional[str] = Header(default=None),
    session: AsyncSession = Depends(db_session),
) -> Optional[User]:
    """Resolve the current user if a valid Bearer token is provided.

    Returns `None` when no header is present or the token is invalid; callers
    can decide whether the route is anonymous-friendly or auth-required.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    result = await session.execute(select(User).where(User.id == sub))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


async def current_user(
    user: Optional[User] = Depends(current_user_optional),
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUser = Depends(current_user)
CurrentUserOptional = Depends(current_user_optional)