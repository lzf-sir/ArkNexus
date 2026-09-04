"""mbox / Gmail Takeout import service.

Accepts an uploaded file (.mbox directly, or a .zip that wraps one) and
parses it message by message using Python's email module. Each parsed
message is persisted to the database.

Format support:
    - Plain RFC 5322 mbox (any client: Thunderbird, Apple Mail, mutt, ...)
    - Gmail Takeout: the user uploads the entire `takeout.zip`. We extract
      any `.mbox` files found under `Mail/` (the canonical location Gmail uses
      for label-exported mailboxes) and import each into a separate mailbox.
    - zipped mbox (one .mbox file inside a .zip, common from ProtonMail,
      Fastmail, etc.)

What we deliberately do NOT do:
    - We don't try to handle Live Mail .dbx, Outlook .pst, etc. — those need
      external tools and are out of scope for v1.
"""

from __future__ import annotations

import io
import mailbox
import re
import zipfile
from dataclasses import dataclass
from email import policy
from email.message import EmailMessage as ParsedEmail
from email.parser import Parser
from email.utils import getaddresses, parsedate_to_datetime
from typing import Iterable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mailbox import Mailbox
from app.models.message import Message as DbMessage


@dataclass
class ImportSummary:
    imported: int = 0
    skipped: int = 0
    errors: int = 0
    created_mailboxes: list[str] | None = None

    def __post_init__(self):
        if self.created_mailboxes is None:
            self.created_mailboxes = []


@dataclass
class _ParsedMessage:
    from_address: str
    from_name: Optional[str]
    to_addresses: str
    cc_addresses: Optional[str]
    subject: Optional[str]
    body_text: Optional[str]
    body_html: Optional[str]
    raw_content: str
    rfc_message_id: Optional[str]
    received_at: "datetime"  # type: ignore[name-defined]


async def import_mbox_upload(
    *,
    session: AsyncSession,
    user_id: str,
    mailbox_id: str,
    filename: str,
    raw: bytes,
) -> ImportSummary:
    """Top-level entrypoint. Decides what to do based on the file extension."""
    lower = (filename or "").lower()
    if lower.endswith(".zip"):
        return await _import_zip(session=session, user_id=user_id, filename=filename, raw=raw)
    return await _import_mbox_bytes(
        session=session, user_id=user_id, mailbox_id=mailbox_id, raw=raw
    )


async def _import_zip(
    *, session: AsyncSession, user_id: str, filename: str, raw: bytes
) -> ImportSummary:
    """Handle Gmail Takeout or generic zipped mbox(es)."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as e:
        raise ValueError(f"无法解析 ZIP 文件：{e}") from e

    summary = ImportSummary()
    mbox_files = [n for n in zf.namelist() if n.lower().endswith(".mbox")]
    if not mbox_files:
        # Fall back: maybe the user uploaded a single .mbox with .zip extension.
        for n in zf.namelist():
            if n.lower().endswith(".mbox"):
                mbox_files.append(n)
    if not mbox_files:
        raise ValueError("ZIP 中未找到 .mbox 文件")

    for entry in mbox_files:
        # Derive a mailbox label from the path, e.g. "Mail/All mail.mbox".
        label = _mailbox_label_from_path(entry)
        target = await _ensure_mailbox(session=session, user_id=user_id, address=label)
        sub = await _import_mbox_bytes(
            session=session,
            user_id=user_id,
            mailbox_id=target.id,
            raw=zf.read(entry),
        )
        summary.imported += sub.imported
        summary.skipped += sub.skipped
        summary.errors += sub.errors
        if target.id not in summary.created_mailboxes:
            summary.created_mailboxes.append(target.id)

    await session.commit()
    return summary


async def _import_mbox_bytes(
    *, session: AsyncSession, user_id: str, mailbox_id: str, raw: bytes
) -> ImportSummary:
    """Parse an mbox byte stream and persist each message."""
    summary = ImportSummary()

    # mailbox.from_bytes handles both Unix (\\n) and Windows (\\r\\n) mbox files.
    # We need to write to a SpooledTemporaryFile because mailbox requires a
    # seekable file.
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".mbox", delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name

    try:
        mbox = mailbox.mbox(tmp_path, factory=None)
    except (mailbox.Error, OSError, ValueError) as e:
        raise ValueError(f"mbox 解析失败：{e}") from e

    try:
        for key in mbox.keys():
            try:
                raw_msg = mbox.get_string(key)
                if not raw_msg:
                    summary.skipped += 1
                    continue
                parsed = _parse_rfc5322(raw_msg)
                row = DbMessage(
                    mailbox_id=mailbox_id,
                    from_address=parsed.from_address,
                    from_name=parsed.from_name,
                    to_addresses=parsed.to_addresses,
                    cc_addresses=parsed.cc_addresses,
                    subject=parsed.subject,
                    body_text=parsed.body_text,
                    body_html=parsed.body_html,
                    raw_content=parsed.raw_content,
                    rfc_message_id=parsed.rfc_message_id,
                    received_at=parsed.received_at,
                    size_bytes=len(raw_msg),
                )
                session.add(row)
                summary.imported += 1
            except Exception:
                summary.errors += 1
                continue
        await session.flush()
    finally:
        try:
            mbox.close()
        except Exception:
            pass
        try:
            import os
            os.unlink(tmp_path)
        except OSError:
            pass

    return summary


def _parse_rfc5322(raw: str) -> _ParsedMessage:
    """Parse a single RFC 5322 message string into our DB-ready dataclass."""
    from datetime import datetime, timezone

    msg = Parser(policy=policy.default).parsestr(raw)
    from_addr = msg.get("From", "")
    from_name, from_email = _split_name_addr(from_addr)
    to_addrs = ", ".join([a for _, a in getaddresses(msg.get_all("To", []) or [])])
    cc_addrs = ", ".join([a for _, a in getaddresses(msg.get_all("Cc", []) or [])])
    subject = msg.get("Subject")
    msg_id = msg.get("Message-ID")

    body_text: Optional[str] = None
    body_html: Optional[str] = None
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/plain" and body_text is None:
                body_text = _safe_decode(part)
            elif ctype == "text/html" and body_html is None:
                body_html = _safe_decode(part)
    else:
        ctype = msg.get_content_type()
        if ctype == "text/plain":
            body_text = _safe_decode(msg)
        elif ctype == "text/html":
            body_html = _safe_decode(msg)
        else:
            body_text = _safe_decode(msg)

    # Date parsing — fall back to "now" if header is missing/malformed.
    received_at = datetime.now(timezone.utc)
    raw_date = msg.get("Date")
    if raw_date:
        try:
            received_at = parsedate_to_datetime(raw_date)
            if received_at and received_at.tzinfo is None:
                received_at = received_at.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            pass

    return _ParsedMessage(
        from_address=from_email or "unknown@unknown",
        from_name=from_name,
        to_addresses=to_addrs,
        cc_addresses=cc_addrs or None,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        raw_content=raw,
        rfc_message_id=msg_id,
        received_at=received_at,
    )


def _split_name_addr(value: str) -> tuple[Optional[str], str]:
    """Best-effort split of 'Name <addr>' to ('Name', 'addr')."""
    value = (value or "").strip()
    if not value:
        return None, ""
    m = re.match(r"^(.*?)\s*<\s*([^>]+)\s*>\s*$", value)
    if m:
        name = (m.group(1) or "").strip().strip('"')
        addr = (m.group(2) or "").strip()
        return (name or None), addr
    return None, value


def _safe_decode(part) -> Optional[str]:
    try:
        return part.get_content()
    except (LookupError, AttributeError, ValueError):
        try:
            return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="replace")
        except Exception:
            return None


async def _ensure_mailbox(session: AsyncSession, *, user_id: str, address: str) -> Mailbox:
    """Create a fresh mailbox per Gmail Takeout mbox. Address is sanitized."""
    safe = re.sub(r"[^A-Za-z0-9._@-]", "_", address)[:120] or "imported@arknexus.local"
    # Dedupe by appending a suffix if needed.
    suffix = 0
    candidate = safe
    while True:
        from sqlalchemy import select
        existing = (
            await session.execute(
                select(Mailbox).where(
                    Mailbox.user_id == user_id, Mailbox.address == candidate
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            break
        suffix += 1
        candidate = f"{safe}-{suffix}"
    mb = Mailbox(user_id=user_id, address=candidate, expires_at=Mailbox.default_expiry())
    session.add(mb)
    await session.flush()
    return mb


def _mailbox_label_from_path(entry_path: str) -> str:
    """Take 'Mail/All mail.mbox' → 'allmail@arknexus.local'."""
    base = entry_path.rsplit("/", 1)[-1]
    name = re.sub(r"\.mbox$", "", base, flags=re.IGNORECASE)
    name = re.sub(r"[^A-Za-z0-9]+", "", name).lower() or "imported"
    return f"{name}@arknexus.local"