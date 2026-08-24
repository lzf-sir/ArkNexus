"""ai-service settings."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "ArkNexus AI Service"
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    api_host: str = "0.0.0.0"
    api_port: int = 8001
    api_prefix: str = "/api/v1"
    cors_origins: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    database_url: str = "sqlite+aiosqlite:///./data/ai_service.db"

    # Auth (shared with the gateway / email-service).
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"

    # Optional central config-service integration.
    config_service_url: str = ""
    config_service_register_on_startup: bool = True
    config_service_heartbeat_interval_seconds: int = 60

    # Chat behaviour.
    max_prompt_tokens_hard_limit: int = 200_000
    max_conversation_messages: int = 200
    default_stream: bool = True
    upstream_timeout_seconds: int = 120

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
