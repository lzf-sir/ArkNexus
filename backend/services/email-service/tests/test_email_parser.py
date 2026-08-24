"""Tests for the RFC822 parser."""

from app.services.email_parser import parse_email_bytes


SIMPLE = (
    b"From: Alice <alice@example.com>\r\n"
    b"To: bob@arknexus.local\r\n"
    b"Subject: Hello there\r\n"
    b"Message-ID: <abc@example.com>\r\n"
    b"MIME-Version: 1.0\r\n"
    b"Content-Type: text/plain; charset=utf-8\r\n"
    b"\r\n"
    b"Hello, this is a plain text message."
)


def test_parse_simple_text():
    parsed = parse_email_bytes(SIMPLE)
    assert parsed.from_address == "alice@example.com"
    assert parsed.from_name == "Alice"
    assert parsed.subject == "Hello there"
    assert parsed.to_addresses == ["bob@arknexus.local"]
    assert parsed.body_text and "Hello" in parsed.body_text
    assert parsed.rfc_message_id == "<abc@example.com>"
    assert parsed.attachments == []


def test_parse_html_multipart():
    raw = (
        b"From: Alice <alice@example.com>\r\n"
        b"To: bob@arknexus.local\r\n"
        b"Subject: Greetings\r\n"
        b"MIME-Version: 1.0\r\n"
        b"Content-Type: multipart/alternative; boundary=\"BOUND\"\r\n"
        b"\r\n"
        b"--BOUND\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Plain version\r\n"
        b"--BOUND\r\n"
        b"Content-Type: text/html; charset=utf-8\r\n"
        b"\r\n"
        b"<p>HTML version</p>\r\n"
        b"--BOUND--\r\n"
    )
    parsed = parse_email_bytes(raw)
    assert parsed.body_text and "Plain version" in parsed.body_text
    assert parsed.body_html and "<p>" in parsed.body_html