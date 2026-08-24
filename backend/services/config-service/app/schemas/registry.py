"""Pydantic schemas for the config-service."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


VALUE_TYPES = {"string", "int", "float", "bool", "json"}


class ServiceBase(BaseModel):
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9\-_.]*$")
    display_name: str = Field(min_length=1, max_length=160)
    description: Optional[str] = None
    version: Optional[str] = Field(default=None, max_length=40)
    icon: Optional[str] = Field(default=None, max_length=80)
    base_url: Optional[str] = Field(default=None, max_length=255)
    health_url: Optional[str] = Field(default=None, max_length=255)


class ServiceRegister(ServiceBase):
    heartbeat_meta: Optional[dict[str, Any]] = None


class HeartbeatRequest(BaseModel):
    heartbeat_meta: Optional[dict[str, Any]] = None


class ServiceRead(ORMModel):
    id: str
    slug: str
    display_name: str
    description: Optional[str] = None
    version: Optional[str] = None
    icon: Optional[str] = None
    base_url: Optional[str] = None
    health_url: Optional[str] = None
    is_active: bool
    first_seen_at: datetime
    last_heartbeat_at: datetime
    is_online: bool


class ConfigKeyBase(BaseModel):
    key: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    display_name: Optional[str] = Field(default=None, max_length=160)
    description: Optional[str] = None
    group: Optional[str] = Field(default=None, max_length=80)
    value_type: str = "string"
    default_value: Optional[str] = None
    is_secret: bool = False
    is_readonly: bool = False
    is_required: bool = False
    options: Optional[List[Any]] = None
    sort_order: int = 100

    @field_validator("value_type")
    @classmethod
    def _check_type(cls, v: str) -> str:
        if v not in VALUE_TYPES:
            raise ValueError(f"value_type must be one of {sorted(VALUE_TYPES)}")
        return v


class ConfigKeyUpsert(ConfigKeyBase):
    current_value: Optional[str] = None


class ConfigValueUpdate(BaseModel):
    value: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=255)


class ConfigKeyRead(ORMModel):
    id: str
    service_id: str
    key: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    group: Optional[str] = None
    value_type: str
    current_value: Optional[str] = None
    default_value: Optional[str] = None
    is_secret: bool
    is_readonly: bool
    is_required: bool
    options: Optional[List[Any]] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class ConfigKeyGrouped(BaseModel):
    group: str
    items: List[ConfigKeyRead]


class ConfigHistoryRead(ORMModel):
    id: str
    config_key_id: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: datetime
    note: Optional[str] = None