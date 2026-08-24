"""ORM models for the config-service."""

from app.models.registry import ConfigHistory, ConfigKey, Service  # noqa: F401

__all__ = ["Service", "ConfigKey", "ConfigHistory"]