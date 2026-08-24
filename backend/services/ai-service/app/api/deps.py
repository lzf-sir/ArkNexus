"""FastAPI dependencies."""
from __future__ import annotations

from typing import AsyncIterator, Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_session


async def db_session() -> AsyncIterator[AsyncSession]:
    async for session in get_session():
        yield session


DBSession = Depends(db_session)


class CurrentUser:
    """Lightweight identity object (no DB lookup; AI service does not own the user table)."""

    __slots__ = ("id", "email", "is_admin")

    def __init__(self, user_id: str, email: str = "", is_admin: bool = False) -> None:
        self.id = user_id
        self.email = email
        self.is_admin = is_admin

    def to_dict(self) -> dict:
        return {"id": self.id, "email": self.email, "is_admin": self.is_admin}


async def current_user_optional(
    authorization: Optional[str] = Header(default=None),
) -> Optional[CurrentUser]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    return CurrentUser(
        user_id=str(sub),
        email=str(payload.get("email", "")),
        is_admin=bool(payload.get("is_admin", False)),
    )


async def current_user(
    user: Optional[CurrentUser] = Depends(current_user_optional),
) -> CurrentUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUserDep = Depends(current_user)
CurrentUserOptional = Depends(current_user_optional)
