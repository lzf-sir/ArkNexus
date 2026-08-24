"""ORM models package — import all to register with Base.metadata."""

from app.models.draft import Draft  # noqa: F401
from app.models.folder import Folder, Label, MessageLabel, SYSTEM_FOLDERS  # noqa: F401
from app.models.mailbox import Mailbox  # noqa: F401
from app.models.message import Attachment, Message  # noqa: F401
from app.models.oauth import OAuthAccount  # noqa: F401
from app.models.system_state import SystemState  # noqa: F401
from app.models.user import User  # noqa: F401

__all__ = [
    "User",
    "Mailbox",
    "Message",
    "Attachment",
    "Draft",
    "SystemState",
    "Folder",
    "Label",
    "MessageLabel",
    "SYSTEM_FOLDERS",
    "OAuthAccount",
]
