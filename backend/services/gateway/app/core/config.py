"""Gateway settings."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Gateway configuration."""

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    gateway_name: str = "ArkNexus Gateway"
    app_env: str = "development"
    log_level: str = "INFO"

    api_host: str = "0.0.0.0"
    api_port: int = 8080
    api_prefix: str = "/api"
    cors_origins: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    email_service_url: str = "http://127.0.0.1:8000"
    config_service_url: str = "http://127.0.0.1:8081"
    ai_service_url: str = "http://127.0.0.1:8001"

    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"

    require_auth_for_protected: bool = True
    public_path_prefixes: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: [
            "/",
            "/health",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/oauth",
            "/api/v1/system/stats",
        ]
    )

    @field_validator("cors_origins", "public_path_prefixes", mode="before")
    @classmethod
    def _split_csv(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()