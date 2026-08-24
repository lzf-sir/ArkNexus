"""RFC822 email parsing utilities."""

from __future__ import annotations

import email
import email.policy
from dataclasses import dataclass
from email.message import Message as EmailMessage
from email.utils import getaddresses, parseaddr
from typing import List, Optional, Tuple

from app.core.config import settings


PREVIEW_MAX = 240


@dataclass
class ParsedAddress:
    address: str
    name: Optional[str] = None

    @classmethod
    def from_raw(cls, raw: str) -> "ParsedAddress":
        name, addr = parseaddr(raw or "")
        if not addr:
            return cls(address=(raw or "").strip().lower())
        return cls(address=addr.lower(), name=(name or None))


@dataclass
class ParsedAttachment:
    filename: str
    content_type: str
    size_bytes: int
    content: bytes
    content_id: Optional[str] = None


@dataclass
class ParsedMail:
    rfc_message_id: Optional[str]
    from_address: str
    from_name: Optional[str]
    to_addresses: List[str]
    cc_addresses: List[str]
    subject: Optional[str]
    body_text: Optional[str]
    body_html: Optional[str]
    raw_content: str
    size_bytes: int
    attachments: List[ParsedAttachment]

    @property
    def preview(self) -> str:
        base = self.body_text or self.body_html or self.subject or ""
        text = base
        if text and "<" in text and ">" in text:
            # crude HTML strip for preview
            import re
            text = re.sub(r"<[^>]+>", "", text)
        text = text.replace("\r", " ").replace("\n", " ")
        text = " ".join(text.split())
        return text[:PREVIEW_MAX]


def _decode_part(part: EmailMessage) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def _extract_text_and_html(msg: EmailMessage) -> Tuple[Optional[str], Optional[str]]:
    body_text: Optional[str] = None
    body_html: Optional[str] = None

    if msg.is_multipart():
        for part in msg.walk():
            if part.is_multipart():
                continue
            ctype = part.get_content_type()
            disp = (part.get("Content-Disposition") or "").lower()
            if "attachment" in disp:
                continue
            if ctype == "text/plain" and body_text is None:
                body_text = _decode_part(part)
            elif ctype == "text/html" and body_html is None:
                body_html = _decode_part(part)
    else:
        ctype = msg.get_content_type()
        decoded = _decode_part(msg)
        if ctype == "text/plain":
            body_text = decoded
        elif ctype == "text/html":
            body_html = decoded
        else:
            body_text = decoded

    return body_text, body_html


def _extract_attachments(msg: EmailMessage) -> List[ParsedAttachment]:
    attachments: List[ParsedAttachment] = []
    if not msg.is_multipart():
        return attachments

    max_bytes = settings.max_attachment_size_mb * 1024 * 1024

    for part in msg.walk():
        if part.is_multipart():
            continue
        disp = (part.get("Content-Disposition") or "").lower()
        filename = part.get_filename()
        content_id = (part.get("Content-ID") or "").strip("<>") or None
        is_attachment = "attachment" in disp or bool(filename)

        if not is_attachment:
            continue

        payload = part.get_payload(decode=True) or b""
        if len(payload) > max_bytes:
            # skip oversized attachments rather than fail the whole message
            continue

        attachments.append(
            ParsedAttachment(
                filename=filename or "unnamed.bin",
                content_type=part.get_content_type() or "application/octet-stream",
                size_bytes=len(payload),
                content=payload,
                content_id=content_id,
            )
        )

    return attachments


def parse_email_bytes(raw_bytes: bytes) -> ParsedMail:
    """Parse a raw RFC822 byte string into a `ParsedMail` object."""
    raw_text = raw_bytes.decode("utf-8", errors="replace")
    msg = email.message_from_bytes(raw_bytes, policy=email.policy.compat32)

    from_header = msg.get("From", "")
    to_header = msg.get("To", "")
    cc_header = msg.get("Cc", "")

    from_parsed = ParsedAddress.from_raw(from_header)
    to_parsed = [addr for name, addr in getaddresses([to_header]) if addr]
    cc_parsed = [addr for name, addr in getaddresses([cc_header]) if addr]

    body_text, body_html = _extract_text_and_html(msg)
    attachments = _extract_attachments(msg)

    return ParsedMail(
        rfc_message_id=(msg.get("Message-ID") or None),
        from_address=from_parsed.address,
        from_name=from_parsed.name,
        to_addresses=to_parsed,
        cc_addresses=cc_parsed,
        subject=(msg.get("Subject") or None),
        body_text=body_text,
        body_html=body_html,
        raw_content=raw_text,
        size_bytes=len(raw_bytes),
        attachments=attachments,
    )