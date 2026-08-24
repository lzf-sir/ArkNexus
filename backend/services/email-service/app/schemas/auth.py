"""Authentication / user schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class UserBase(BaseModel):
    # NOTE: plain `str` (not EmailStr) because `.local` and other dev-only
    # TLDs are flagged by email-validator as reserved.
    email: str = Field(min_length=3, max_length=255)
    display_name: Optional[str] = Field(default=None, max_length=120)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserRead(ORMModel):
    id: str
    email: str
    display_name: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_admin: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=120)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)