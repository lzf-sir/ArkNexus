"""ORM models for the ai-service."""

from app.models.conversation import ChatMessage, Conversation  # noqa: F401

__all__ = ["Conversation", "ChatMessage"]
