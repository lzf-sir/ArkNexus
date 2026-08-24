"""Schemas for the first-run initialization wizard."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class InitDefaults(BaseModel):
    database_url: str
    redis_url: str = ""
    email_domain: str


class InitState(BaseModel):
    initialized: bool
    database_url: Optional[str] = None
    database_driver: Optional[str] = None
    redis_url: Optional[str] = None
    email_domain: Optional[str] = None
    admin_user_id: Optional[str] = None
    completed_at: Optional[str] = None
    defaults: InitDefaults


class DatabaseChoice(BaseModel):
    url: str = Field(min_length=1, max_length=500)


class DatabaseChoiceResult(BaseModel):
    driver: str
    scheme: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    saved: bool = True


class RedisChoice(BaseModel):
    url: str = Field(default="", max_length=500)


class RedisChoiceResult(BaseModel):
    skipped: bool
    scheme: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    saved: bool = True


class DomainChoice(BaseModel):
    domain: str = Field(min_length=1, max_length=255)


class DomainChoiceResult(BaseModel):
    domain: str
    saved: bool = True


class AdminCreate(BaseModel):
    # NOTE: use plain str (not EmailStr) because `.local` and other dev-only
    # TLDs are flagged by email-validator as reserved; the wizard accepts any
    # well-formed address regardless.
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=120)


class AdminCreated(BaseModel):
    user_id: str
    email: str
    display_name: Optional[str] = None


class InitFinishResult(BaseModel):
    initialized: bool
    completed_at: str
    admin_user_id: str
    summary: dict