"""JWT decoding for endpoints that need user identity."""
from __future__ import annotations

from typing import Any, Optional

from jose import JWTError, jwt

from app.core.config import settings


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
