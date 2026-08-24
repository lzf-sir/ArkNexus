"""Authentication primitives: password hashing + JWT issuance/validation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return _pwd_context.hash(plain[:72])


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against the stored bcrypt hash."""
    try:
        return _pwd_context.verify(plain[:72], hashed)
    except (ValueError, TypeError):
        return False


def create_access_token(
    subject: str,
    *,
    extra_claims: Optional[dict[str, Any]] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    """Issue a signed JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes or settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate a JWT. Returns the payload dict or None on failure."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
]