"""Application settings (Pydantic Settings v2)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Centralized configuration loaded from .env or environment."""

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "ArkNexus Email Service"
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"
    cors_origins: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_use_tls: bool = False
    smtp_tls_cert_file: str = ""
    smtp_tls_key_file: str = ""
    smtp_banner_hostname: str = ""

    email_domain: str = "arknexus.local"
    email_localpart_max_len: int = 40

    database_url: str = "sqlite+aiosqlite:///./data/email_service.db"

    attachment_dir: str = "./data/attachments"
    max_attachment_size_mb: int = 25
    max_message_size_mb: int = 30

    # Note: outgoing relay is no longer supported — this service is receive-only.

    retention_days: int = 30
    cleanup_interval_hours: int = 1

    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # ===== OAuth providers =====
    oauth_redirect_base: str = "http://127.0.0.1:8080"
    oauth_github_client_id: str = ""
    oauth_github_client_secret: str = ""
    oauth_google_client_id: str = ""
    oauth_google_client_secret: str = ""
    # Microsoft Identity Platform v2.0 (Azure AD). `tenant` controls who can sign in:
    #   "common"        - both personal Microsoft accounts + work/school (default)
    #   "organizations" - work / school only
    #   "consumers"     - personal Microsoft accounts only
    #   "<tenant-id>"   - lock to a single Azure AD tenant
    oauth_microsoft_client_id: str = ""
    oauth_microsoft_client_secret: str = ""
    oauth_microsoft_tenant: str = "common"
    oauth_state_secret: str = "change-me-oauth-state"

    # ===== Optional config-service integration =====
    config_service_url: str = ""
    config_service_register_on_startup: bool = True
    config_service_heartbeat_interval_seconds: int = 60
    config_service_pull_interval_seconds: int = 120

    @property
    def attachment_dir_path(self) -> Path:
        p = Path(self.attachment_dir)
        if not p.is_absolute():
            p = PROJECT_ROOT / p
        p.mkdir(parents=True, exist_ok=True)
        return p

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()