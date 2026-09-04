"""User data export — bundle all conversations + provider settings."""

import io
import json
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation

EXPORT_MANIFEST_VERSION = 1


@dataclass
class ExportCounts:
    conversations: int = 0
    messages: int = 0

    def as_dict(self) -> dict:
        return {"conversations": self.conversations, "messages": self.messages}


def _dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2, default=_iso)


def _iso(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Unserializable type: {type(obj).__name__}")


async def build_export(session: AsyncSession, user_id: str) -> tuple[bytes, ExportCounts]:
    counts = ExportCounts()
    buf = io.BytesIO()
    now = datetime.now(timezone.utc).isoformat()

    rows = (
        await session.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .options(selectinload(Conversation.messages))
            .order_by(Conversation.created_at)
        )
    ).scalars().all()

    counts.conversations = len(rows)

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        manifest = {
            "version": EXPORT_MANIFEST_VERSION,
            "exported_at": now,
            "generator": "ArkNexus AI export v1",
            "user_id": user_id,
            "counts": counts.as_dict(),
        }
        zf.writestr("manifest.json", _dump(manifest))

        zf.writestr(
            "README.md",
            "# ArkNexus AI Conversation Export\n\n"
            f"Exported at: {now}\n\n"
            "## Contents\n\n"
            "- `manifest.json` — version + counts\n"
            "- `conversations/<id>.json` — one file per conversation (system, params, full message log)\n"
            "- `conversations/<id>.md` — human-readable Markdown of the same conversation\n"
            "- `conversations/index.json` — flat list with metadata\n\n"
            "## Privacy\n\n"
            "API keys are NOT included. Only provider/model IDs and per-conversation parameters.\n",
        )

        index = []
        for conv in rows:
            counts.messages += len(conv.messages or [])
            payload = {
                "id": conv.id,
                "title": conv.title,
                "provider_id": conv.provider_id,
                "model_id": conv.model_id,
                "system_prompt": conv.system_prompt,
                "temperature": conv.temperature,
                "max_tokens": conv.max_tokens,
                "top_p": conv.top_p,
                "is_pinned": conv.is_pinned,
                "is_archived": conv.is_archived,
                "created_at": conv.created_at,
                "updated_at": conv.updated_at,
                "messages": [
                    {
                        "id": m.id,
                        "role": m.role,
                        "content": m.content,
                        "prompt_tokens": m.prompt_tokens,
                        "completion_tokens": m.completion_tokens,
                        "total_tokens": m.total_tokens,
                        "finish_reason": m.finish_reason,
                        "created_at": m.created_at,
                    }
                    for m in (conv.messages or [])
                ],
            }
            zf.writestr(f"conversations/{conv.id}.json", _dump(payload))
            index.append(
                {
                    "id": conv.id,
                    "title": conv.title,
                    "provider_id": conv.provider_id,
                    "model_id": conv.model_id,
                    "message_count": len(conv.messages or []),
                    "is_pinned": conv.is_pinned,
                    "is_archived": conv.is_archived,
                    "created_at": conv.created_at,
                    "updated_at": conv.updated_at,
                }
            )
            md = _render_markdown(conv)
            zf.writestr(f"conversations/{conv.id}.md", md)

        zf.writestr("conversations/index.json", _dump(index))

    return buf.getvalue(), counts


def _render_markdown(conv: Conversation) -> str:
    lines = []
    title = conv.title or "(无标题)"
    lines.append(f"# {title}")
    lines.append("")
    lines.append(
        f"- Provider: `{conv.provider_id}`  |  Model: `{conv.model_id}`  "
        f"|  Messages: {len(conv.messages or [])}"
    )
    if conv.created_at:
        lines.append(f"- Created: {conv.created_at}")
    if conv.system_prompt:
        lines.append("")
        lines.append("## System prompt")
        lines.append("")
        lines.append(conv.system_prompt)
    lines.append("")
    lines.append("## Conversation")
    lines.append("")
    for m in (conv.messages or []):
        role = m.role.capitalize() if m.role else "?"
        lines.append(f"### {role}")
        lines.append("")
        lines.append(m.content or "")
        lines.append("")
    return "\n".join(lines)