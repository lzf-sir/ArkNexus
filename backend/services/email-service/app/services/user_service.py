"""User management business logic."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserCreate


class UserAlreadyExists(Exception):
    pass


class InvalidCredentials(Exception):
    pass


class UserNotFound(Exception):
    pass


async def create_user(session: AsyncSession, payload: UserCreate) -> User:
    """Register a new user. Email is normalized to lower-case."""
    email = payload.email.lower().strip()
    stmt = select(User).where(User.email == email)
    if (await session.execute(stmt)).scalar_one_or_none() is not None:
        raise UserAlreadyExists(email)

    user = User(
        email=email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise UserAlreadyExists(email) from exc
    await session.refresh(user)
    return user


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    """Verify credentials. Raises InvalidCredentials on failure."""
    stmt = select(User).where(User.email == email.lower().strip())
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentials()

    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(user)
    return user


async def get_user(session: AsyncSession, user_id: str) -> Optional[User]:
    stmt = select(User).where(User.id == user_id)
    return (await session.execute(stmt)).scalar_one_or_none()

async def update_profile(
    session: AsyncSession,
    user: User,
    *,
    display_name=None,
):
    if display_name is not None:
        user.display_name = display_name.strip() or None
    await session.commit()
    await session.refresh(user)
    return user


async def change_password(
    session: AsyncSession,
    user: User,
    *,
    current_password: str,
    new_password: str,
):
    from app.core.security import hash_password, verify_password
    if not verify_password(current_password, user.password_hash):
        raise InvalidCredentials()
    user.password_hash = hash_password(new_password)
    await session.commit()
    await session.refresh(user)
    return user
