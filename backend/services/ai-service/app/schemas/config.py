"""AI service user-configuration schemas (API keys + active provider/model)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ProviderConfig(BaseModel):
    """Per-provider runtime config (api_key, custom base_url, enabled models...)."""
    provider_id: str = Field(min_length=1, max_length=64)
    api_key: Optional[str] = Field(default=None, max_length=2048)
    api_key_set: bool = False  # whether the server currently holds a key
    base_url_override: Optional[str] = Field(default=None, max_length=512)
    enabled_model_ids: Optional[List[str]] = None  # None means all catalog models


class ProviderConfigUpdate(BaseModel):
    provider_id: str = Field(min_length=1, max_length=64)
    api_key: Optional[str] = Field(default=None, max_length=2048)  # empty string clears
    base_url_override: Optional[str] = Field(default=None, max_length=512)
    enabled_model_ids: Optional[List[str]] = None


class ActiveSelection(BaseModel):
    """The provider/model that the chat page will use by default."""
    provider_id: str = Field(min_length=1, max_length=64)
    model_id: str = Field(min_length=1, max_length=120)


class ActiveSelectionUpdate(ActiveSelection):
    pass


class AIConfigSnapshot(BaseModel):
    """Everything the UI needs to render the settings page."""
    providers: List[Dict[str, Any]]
    provider_configs: List[ProviderConfig]
    active: Optional[ActiveSelection] = None
