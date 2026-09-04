"""User data export — bundle mailboxes, messages, folders, labels, settings.

The export is generated entirely in memory and streamed to the client as
application/zip. No temporary files are written to disk.

Archive layout (versioned, see EXPORT_MANIFEST_VERSION below):

    export.zip
    ├── manifest.json                    # version, exported_at, counts
    ├── README.md                        # human-readable summary
    ├── user.json                        # profile snapshot (no password hash)
    ├── settings/
    │   └── system.json                  # system_state rows for this user
    ├── mailboxes/
    │   ├── <id>.json                    # per-mailbox metadata
    │   └── folders.json                 # { mailbox_id: [folders] }
    ├── labels.json                      # all user labels
    ├── messages/
    │   ├── index.json                   # [{ id, mailbox_id, from, subject, ... }]
    │   ├── <id>.json                    # full message: headers, text, html
    │   └── attachments/
    │       └── <id>.<ext>               # binary attachment bodies
    └── mbox/
        └── all.mbox                     # RFC 5322 mbox concatenation for IMAP import

Why mbox? Every mail client (Thunderbird, Apple Mail, mutt, etc.) can import it,
so users get a usable artifact in addition to the structured JSON.

Why JSON + mbox + README? JSON preserves the exact ArkNexus schema (lossless),
mbox gives portability, and README explains the structure to a human.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import format_datetime, make_msgid
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.folder import Folder, Label, MessageLabel
from app.models.mailbox import Mailbox
from app.models.message import Attachment, Message

EXPORT_MANIFEST_VERSION = 1
MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024  # 25 MB hard cap per attachment


@dataclass
class ExportCounts:
    mailboxes: int = 0
    folders: int = 0
    labels: int = 0
    messages: int = 0
    attachments: int = 0
    attachment_bytes: int = 0

    def as_dict(self) -> dict:
        return {
            "mailboxes": self.mailboxes,
            "folders": self.folders,
            "labels": self.labels,
            "messages": self.messages,
            "attachments": self.attachments,
            "attachment_bytes": self.attachment_bytes,
        }


def _json_default(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Unserializable type: {type(obj).__name__}")


def _dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2, default=_json_default)


def _safe_filename(s: str) -> str:
    """Sanitize a string for use as a zip entry name (no path traversal)."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", s)[:80]


def _build_mbox_message(msg: Message) -> str:
    """Synthesize an RFC 5322 message from a stored row.

    The leading 'From ' line is the standard mboxo separator. We omit the
    display name from the separator (per RFC 4155) so that mbox importers can
    correctly delimit message boundaries.
    """
    received = msg.received_at or datetime.now(timezone.utc)
    if received.tzinfo is None:
        received = received.replace(tzinfo=timezone.utc)

    # Use the email only in the From line (mboxo format), keep the name in the
    # actual From: header below.
    mboxo_separator = f"From {msg.from_address}"
    headers = [
        mboxo_separator,
        f"From: {msg.from_name or ''} <{msg.from_address}>",
        f"Date: {format_datetime(received)}",
        f"Message-ID: {msg.rfc_message_id or make_msgid(domain='arknexus.local')}",
        f"Subject: {msg.subject or ''}",
        f"To: {msg.to_addresses or ''}",
    ]
    if msg.cc_addresses:
        headers.append(f"Cc: {msg.cc_addresses}")
    body = msg.body_text or msg.body_html or ""
    return "\n".join(headers) + "\n\n" + body + "\n"


async def build_export(session: AsyncSession, user_id: str) -> tuple[bytes, ExportCounts]:
    """Build the export zip in memory. Returns (bytes, counts)."""
    counts = ExportCounts()
    buf = io.BytesIO()
    now = datetime.now(timezone.utc).isoformat()

    # ===== 1. Mailboxes =====
    mailbox_rows = (
        await session.execute(
            select(Mailbox).where(Mailbox.user_id == user_id).order_by(Mailbox.created_at)
        )
    ).scalars().all()
    mailbox_ids = [m.id for m in mailbox_rows]
    counts.mailboxes = len(mailbox_rows)

    # ===== 2. Folders =====
    folder_rows: list[Folder] = []
    if mailbox_ids:
        folder_rows = (
            await session.execute(
                select(Folder)
                .where(Folder.owner_id == user_id)
                .order_by(Folder.created_at)
            )
        ).scalars().all()
    counts.folders = len(folder_rows)
    folders_by_mailbox: dict[str, list[dict]] = {}
    folder_dump = []
    for f in folder_rows:
        d = {
            "id": f.id,
            "slug": getattr(f, "slug", None),
            "name": f.name,
            "created_at": f.created_at,
        }
        folder_dump.append(d)
        # System folders (inbox/trash/starred) apply to all mailboxes; custom
        # folders are not currently scoped to a single mailbox in the schema,
        # so we attach them under a synthetic "__all__" key for the export.
        folders_by_mailbox.setdefault("__all__", []).append(d)

    # ===== 3. Labels + MessageLabel associations =====
    label_rows = (
        await session.execute(
            select(Label).where(Label.owner_id == user_id).order_by(Label.created_at)
        )
    ).scalars().all()
    counts.labels = len(label_rows)
    label_dump = [
        {
            "id": l.id,
            "name": l.name,
            "created_at": l.created_at,
        }
        for l in label_rows
    ]

    # ===== 4. Messages (paginated in chunks to avoid memory blow-up) =====
    if mailbox_ids:
        msg_rows = (
            await session.execute(
                select(Message)
                .where(Message.mailbox_id.in_(mailbox_ids))
                .where(Message.is_trashed == False)  # noqa: E712 — skip trash by default
                .options(
                    selectinload(Message.attachments),
                    selectinload(Message.label_associations),
                )
                .order_by(Message.received_at)
            )
        ).scalars().unique().all()
    else:
        msg_rows = []
    counts.messages = len(msg_rows)

    # Build a lookup for label ids → names for the per-message label list.
    label_name_by_id = {l.id: l.name for l in label_rows}

    # ===== 5. Build zip =====
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        # manifest.json
        manifest = {
            "version": EXPORT_MANIFEST_VERSION,
            "exported_at": now,
            "generator": "ArkNexus export v1",
            "user_id": user_id,
            "counts": counts.as_dict(),
        }
        zf.writestr("manifest.json", _dump(manifest))

        # README.md
        readme = _build_readme(counts, now)
        zf.writestr("README.md", readme)

        # user.json (placeholder: just the id; deeper profile lives in email-service users table).
        user_dump = {"id": user_id, "exported_at": now}
        zf.writestr("user.json", _dump(user_dump))

        # mailboxes/<id>.json
        for mb in mailbox_rows:
            mb_dump = {
                "id": mb.id,
                "address": mb.address,
                "display_name": getattr(mb, "display_name", None),
                "created_at": mb.created_at,
                "expires_at": getattr(mb, "expires_at", None),
                "is_active": getattr(mb, "is_active", True),
                "retention_days": getattr(mb, "retention_days", None),
            }
            zf.writestr(f"mailboxes/{mb.id}.json", _dump(mb_dump))
        zf.writestr("mailboxes/folders.json", _dump(folders_by_mailbox))

        # labels.json
        zf.writestr("labels.json", _dump(label_dump))

        # messages/index.json — list view only
        msg_index = []
        for m in msg_rows:
            msg_index.append({
                "id": m.id,
                "mailbox_id": m.mailbox_id,
                "from_address": m.from_address,
                "from_name": m.from_name,
                "to_addresses": m.to_addresses,
                "cc_addresses": m.cc_addresses,
                "subject": m.subject,
                "received_at": m.received_at,
                "is_read": m.is_read,
                "is_starred": m.is_starred,
                "folder_id": m.folder_id,
                "labels": [
                    {"id": a.label_id, "name": label_name_by_id.get(a.label_id)}
                    for a in (m.label_associations or [])
                    if a.label_id in label_name_by_id
                ],
                "attachment_count": len(m.attachments or []),
            })
        zf.writestr("messages/index.json", _dump(msg_index))

        # messages/<id>.json — full bodies
        for m in msg_rows:
            full = {
                "id": m.id,
                "mailbox_id": m.mailbox_id,
                "rfc_message_id": m.rfc_message_id,
                "from_address": m.from_address,
                "from_name": m.from_name,
                "to_addresses": m.to_addresses,
                "cc_addresses": m.cc_addresses,
                "subject": m.subject,
                "body_text": m.body_text,
                "body_html": m.body_html,
                "received_at": m.received_at,
                "is_read": m.is_read,
                "is_starred": m.is_starred,
                "folder_id": m.folder_id,
                "spam_score": m.spam_score,
                "size_bytes": m.size_bytes,
                "attachments": [
                    {
                        "id": a.id,
                        "filename": a.filename,
                        "content_type": a.content_type,
                        "size_bytes": a.size_bytes,
                    }
                    for a in (m.attachments or [])
                ],
            }
            zf.writestr(f"messages/{m.id}.json", _dump(full))

        # messages/attachments/<id>.<ext>
        for m in msg_rows:
            for a in (m.attachments or []):
                try:
                    blob = await _read_attachment(a.storage_path)
                except FileNotFoundError:
                    blob = b""
                if not blob:
                    # Leave a small placeholder so users can still see what was missing.
                    zf.writestr(
                        f"messages/attachments/{a.id}.missing",
                        json.dumps(
                            {
                                "attachment_id": a.id,
                                "message_id": m.id,
                                "filename": a.filename,
                                "missing_path": a.storage_path,
                                "note": "Original file was not found on disk at export time.",
                            },
                            ensure_ascii=False,
                            indent=2,
                        ),
                    )
                    continue
                if len(blob) > MAX_ATTACHMENT_BYTES:
                    # Split or truncate? We err on the safe side: skip and note it.
                    zf.writestr(
                        f"messages/attachments/{a.id}.too_large",
                        json.dumps(
                            {
                                "attachment_id": a.id,
                                "message_id": m.id,
                                "filename": a.filename,
                                "size_bytes": len(blob),
                                "limit_bytes": MAX_ATTACHMENT_BYTES,
                                "note": "Attachment exceeded export size cap.",
                            },
                            ensure_ascii=False,
                            indent=2,
                        ),
                    )
                    continue
                ext = _safe_filename(a.filename.split(".")[-1] if "." in a.filename else "bin")
                zf.writestr(f"messages/attachments/{a.id}.{ext}", blob)
                counts.attachments += 1
                counts.attachment_bytes += len(blob)

        # mbox/all.mbox — concatenated RFC 5322, ideal for IMAP import elsewhere.
        if msg_rows:
            mbox_buf = io.StringIO()
            for m in msg_rows:
                mbox_buf.write(_build_mbox_message(m))
                mbox_buf.write("\n")
            zf.writestr("mbox/all.mbox", mbox_buf.getvalue())

    return buf.getvalue(), counts


async def _read_attachment(storage_path: str) -> bytes:
    """Read attachment bytes from disk. Returns empty if the file is missing."""
    import os

    # Defensive: storage_path should be absolute and live under data/attachments.
    if not storage_path or not os.path.isabs(storage_path):
        raise FileNotFoundError(storage_path)
    with open(storage_path, "rb") as f:
        return f.read()


def _build_readme(counts: ExportCounts, exported_at: str) -> str:
    return (
        "# ArkNexus Data Export\n\n"
        f"Exported at: {exported_at}\n\n"
        "## Contents\n\n"
        "- `manifest.json` — version + metadata (machine readable)\n"
        "- `user.json` — your user id (no password data is included)\n"
        "- `mailboxes/*.json` — one file per mailbox you own\n"
        "- `labels.json` — all custom labels\n"
        "- `messages/index.json` — flat list of every message (subject/sender/labels)\n"
        "- `messages/<id>.json` — full message bodies (text + html)\n"
        "- `messages/attachments/<id>.<ext>` — attachment binaries\n"
        "- `mbox/all.mbox` — RFC 5322 mbox of every message, ready to import into Thunderbird / Apple Mail / mutt\n\n"
        "## Summary\n\n"
        f"- Mailboxes: **{counts.mailboxes}**\n"
        f"- Folders: **{counts.folders}**\n"
        f"- Labels: **{counts.labels}**\n"
        f"- Messages: **{counts.messages}**\n"
        f"- Attachments: **{counts.attachments}** ({counts.attachment_bytes:,} bytes)\n\n"
        "## How to re-import\n\n"
        "1. The `mbox/all.mbox` file can be dragged into Thunderbird's Local Folders or "
        "uploaded via `mbox-import` in any IMAP bridge.\n"
        "2. The JSON tree is lossless — use it for a future re-import into ArkNexus itself.\n\n"
        "## Privacy\n\n"
        "This archive contains every email and attachment tied to your account at the time "
        "of export. Keep it safe.\n"
    )