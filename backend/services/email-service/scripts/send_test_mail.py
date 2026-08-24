"""Send a test email to a temporary mailbox via raw SMTP."""

from __future__ import annotations

import asyncio
import smtplib
import sys
import uuid
from email.message import EmailMessage
from email.utils import formataddr, make_msgid


def build_message(from_addr: str, to_addr: str, subject: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr(("Test Sender", from_addr))
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain="test.local")
    msg.set_content(body)
    return msg


def send(smtp_host: str, smtp_port: int, from_addr: str, to_addr: str) -> None:
    msg = build_message(
        from_addr=from_addr,
        to_addr=to_addr,
        subject=f"ArkNexus test mail #{uuid.uuid4().hex[:6]}",
        body="Hello from ArkNexus test script!\nIf you see this in the UI, SMTP reception works.",
    )
    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as client:
        client.sendmail(from_addr, [to_addr], msg.as_string())
    print(f"Sent test mail from {from_addr} -> {to_addr}")


if __name__ == "__main__":
    host = "127.0.0.1"
    port = 1025
    sender = "external.sender@example.com"
    if len(sys.argv) > 1:
        recipient = sys.argv[1]
    else:
        print("Usage: python send_test_mail.py <recipient@arknexus.local>")
        sys.exit(1)
    send(host, port, sender, recipient)