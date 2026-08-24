"""aiosmtpd handler that captures incoming mail into storage.

Supports two receive modes:
- Plain SMTP (default for dev on port 1025)
- STARTTLS / implicit TLS when `SMTP_USE_TLS=true` and cert/key are provided.
"""

from __future__ import annotations

import logging
from email.utils import parseaddr
from typing import Optional

from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP as SMTPProtocol

from app.core.config import settings
from app.db.session import SessionLocal
from app.services import mailbox_service, message_service
from app.services.email_parser import parse_email_bytes

logger = logging.getLogger(__name__)


class ArkNexusMessageHandler:
    """Custom aiosmtpd handler: stores messages addressed to known mailboxes."""

    async def handle_RCPT(
        self,
        server: SMTPProtocol,
        session,
        envelope,
        address: str,
        rcpt_options,
    ) -> str:
        _, real = parseaddr(address)
        host = real.split("@", 1)[-1].lower() if "@" in real else ""
        if host != settings.email_domain.lower():
            logger.info("Rejecting recipient outside domain: %s", address)
            return "550 recipient domain not accepted"
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(
        self,
        server: SMTPProtocol,
        session,
        envelope,
    ) -> str:
        if not envelope.rcpt_tos:
            return "550 no valid recipients"

        raw: bytes = envelope.content
        if len(raw) > settings.max_message_size_mb * 1024 * 1024:
            return "552 message exceeds size limit"

        try:
            parsed = parse_email_bytes(raw)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to parse incoming email: %s", exc)
            return "451 failed to parse message"

        stored = 0
        rejected = []
        async with SessionLocal() as db_session:
            for rcpt in envelope.rcpt_tos:
                _, addr = parseaddr(rcpt)
                if not addr:
                    rejected.append(rcpt)
                    continue
                mailbox = await mailbox_service.get_mailbox_by_address(db_session, addr)
                if mailbox is None:
                    rejected.append(rcpt)
                    continue
                try:
                    await message_service.create_message_from_parsed(
                        db_session, mailbox, parsed
                    )
                    stored += 1
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Failed to store message for %s: %s", addr, exc)
                    rejected.append(rcpt)

        if stored == 0:
            logger.info(
                "Message discarded: no active mailbox matched %s",
                ", ".join(rejected) or "(none)",
            )
            return "550 no active mailbox accepted the message"
        return "250 Message accepted for delivery"


def _build_controller() -> Controller:
    handler = ArkNexusMessageHandler()
    hostname = settings.smtp_banner_hostname or settings.email_domain

    kwargs: dict = dict(
        handler=handler,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        server_hostname=hostname,
    )

    if settings.smtp_use_tls:
        if not (settings.smtp_tls_cert_file and settings.smtp_tls_key_file):
            raise RuntimeError(
                "SMTP_USE_TLS=true requires SMTP_TLS_CERT_FILE and SMTP_TLS_KEY_FILE"
            )
        # aiosmtpd's Controller accepts `ssl_context` and a `tls_context` for STARTTLS.
        # When `SMTP_USE_TLS=true`, the controller expects an SSL context to negotiate
        # TLS immediately after the EHLO/STARTTLS exchange (or as implicit TLS via
        # the underlying asyncio.start_server(..., ssl=...)).
        import ssl

        ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ctx.load_cert_chain(
            certfile=settings.smtp_tls_cert_file,
            keyfile=settings.smtp_tls_key_file,
        )
        kwargs["ssl_context"] = ctx

    return Controller(**kwargs)


_smtp_controller: Optional[Controller] = None


def start_smtp() -> None:
    global _smtp_controller
    if _smtp_controller is not None:
        return
    controller = _build_controller()
    controller.start()
    _smtp_controller = controller
    logger.info(
        "SMTP receiver listening on %s:%s (domain=%s, tls=%s)",
        settings.smtp_host,
        settings.smtp_port,
        settings.email_domain,
        settings.smtp_use_tls,
    )


def stop_smtp() -> None:
    global _smtp_controller
    if _smtp_controller is None:
        return
    _smtp_controller.stop()
    _smtp_controller = None
    logger.info("SMTP receiver stopped")