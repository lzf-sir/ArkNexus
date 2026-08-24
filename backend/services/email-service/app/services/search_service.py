"""Full-text search for messages.

Strategy:
- If the database is PostgreSQL (asyncpg), use to_tsvector + websearch_to_tsquery
  + ts_headline to produce a snippet with <mark>-highlighted matches.
- Otherwise (SQLite, dev), fall back to a portable LIKE search and wrap matched
  substrings in a fake <mark> snippet.
"""
from __future__ import annotations

import re
from typing import Any, List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _is_postgres_url(url: str) -> bool:
    return url.startswith("postgresql") or url.startswith("postgres")


def _highlight_with_mark(text_value: str, query: str, *, max_len: int = 240) -> str:
    """Wrap occurrences of query in <mark> markers (case-insensitive)."""
    if not text_value or not query:
        return (text_value or "")[:max_len]
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    parts: list[str] = []
    cursor = 0
    for m in pattern.finditer(text_value):
        parts.append(text_value[cursor:m.start()])
        parts.append("<mark>")
        parts.append(m.group(0))
        parts.append("</mark>")
        cursor = m.end()
    parts.append(text_value[cursor:])
    highlighted = "".join(parts)
    if len(highlighted) > max_len:
        first = highlighted.find("<mark>")
        if first > max_len // 2:
            start = max(0, first - max_len // 4)
            highlighted = ("..." + highlighted[start:start + max_len - 3]) if start else highlighted[:max_len]
        else:
            highlighted = highlighted[:max_len]
    return highlighted


async def search_messages(
    session: AsyncSession,
    mailbox_id: str,
    *,
    query: str,
    limit: int = 50,
    offset: int = 0,
    only_unread: bool = False,
) -> List[dict[str, Any]]:
    """Run a full-text search.

    Returns a list of dicts with the basic message fields plus a preview HTML
    snippet (with <mark> highlights) and a rank score.
    """
    q = (query or "").strip()
    if not q:
        return []

    bind = session.bind
    dialect = bind.dialect.name if bind is not None else "sqlite"

    if dialect == "postgresql":
        return await _search_postgres(session, mailbox_id, q, limit, offset, only_unread)
    return await _search_sqlite(session, mailbox_id, q, limit, offset, only_unread)


async def _search_sqlite(
    session: AsyncSession,
    mailbox_id: str,
    query: str,
    limit: int,
    offset: int,
    only_unread: bool,
) -> List[dict[str, Any]]:
    like = f"%{query.strip()}%"
    extra = " AND is_read = 0" if only_unread else ""
    sql = text(
        f"""
        SELECT id, mailbox_id, rfc_message_id, from_address, from_name,
               subject, body_text, received_at, is_read, is_starred,
               has_attachments, size_bytes
        FROM messages
        WHERE mailbox_id = :mailbox_id
          AND (subject LIKE :like COLLATE NOCASE
               OR from_address LIKE :like COLLATE NOCASE
               OR from_name LIKE :like COLLATE NOCASE
               OR body_text LIKE :like COLLATE NOCASE){extra}
        ORDER BY received_at DESC
        LIMIT :limit OFFSET :offset
        """
    )
    rows = (await session.execute(sql, {
        "mailbox_id": mailbox_id,
        "like": like,
        "limit": limit,
        "offset": offset,
    })).mappings().all()
    out: list[dict] = []
    for r in rows:
        preview = _highlight_with_mark(r["body_text"] or r["subject"] or "", query)
        out.append({
            "id": r["id"],
            "mailbox_id": r["mailbox_id"],
            "rfc_message_id": r["rfc_message_id"],
            "from_address": r["from_address"],
            "from_name": r["from_name"],
            "subject": r["subject"],
            "preview": preview,
            "received_at": r["received_at"],
            "is_read": r["is_read"],
            "is_starred": r["is_starred"],
            "has_attachments": r["has_attachments"],
            "size_bytes": r["size_bytes"],
            "rank": 1.0,
        })
    return out


async def _search_postgres(
    session: AsyncSession,
    mailbox_id: str,
    query: str,
    limit: int,
    offset: int,
    only_unread: bool,
) -> List[dict[str, Any]]:
    extra = " AND m.is_read = FALSE" if only_unread else ""
    sql = text(
        f"""
        WITH q AS (SELECT websearch_to_tsquery('simple', :q) AS query)
        SELECT
            m.id, m.mailbox_id, m.rfc_message_id, m.from_address, m.from_name,
            m.subject, m.body_text, m.received_at, m.is_read, m.is_starred,
            m.has_attachments, m.size_bytes,
            ts_rank(m.search_tsv, q.query) AS rank,
            ts_headline(
                'simple',
                coalesce(m.body_text, m.subject, ''),
                q.query,
                'MaxFragments=1,MinWords=5,MaxWords=20,StartSel=<mark>,StopSel=</mark>'
            ) AS preview
        FROM messages m, q
        WHERE m.mailbox_id = :mailbox_id
          AND m.search_tsv @@ q.query{extra}
        ORDER BY rank DESC, m.received_at DESC
        LIMIT :limit OFFSET :offset
        """
    )
    rows = (await session.execute(
        sql,
        {"q": query, "mailbox_id": mailbox_id, "limit": limit, "offset": offset},
    )).mappings().all()
    return [
        {
            "id": r["id"],
            "mailbox_id": r["mailbox_id"],
            "rfc_message_id": r["rfc_message_id"],
            "from_address": r["from_address"],
            "from_name": r["from_name"],
            "subject": r["subject"],
            "preview": r["preview"],
            "received_at": r["received_at"],
            "is_read": r["is_read"],
            "is_starred": r["is_starred"],
            "has_attachments": r["has_attachments"],
            "size_bytes": r["size_bytes"],
            "rank": float(r["rank"] or 0.0),
        }
        for r in rows
    ]


async def ensure_search_index(session: AsyncSession) -> None:
    """Ensure the PostgreSQL search_tsv column + GIN index exist.

    On SQLite this is a no-op (we use the LIKE fallback). Safe to call repeatedly.
    """
    bind = session.bind
    if bind is None or bind.dialect.name != "postgresql":
        return
    await session.execute(text(
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_tsv tsvector"
    ))
    await session.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_messages_search_tsv ON messages USING GIN (search_tsv)"
    ))
    await session.execute(text(
        """
        UPDATE messages
        SET search_tsv = setweight(to_tsvector('simple', coalesce(subject, '')), 'A')
                     || setweight(to_tsvector('simple', coalesce(from_address, '')), 'B')
                     || setweight(to_tsvector('simple', coalesce(from_name, '')), 'B')
                     || setweight(to_tsvector('simple', coalesce(body_text, '')), 'C')
        WHERE search_tsv IS NULL
        """
    ))
    await session.execute(text(
        """
        CREATE OR REPLACE FUNCTION messages_search_tsv_update() RETURNS trigger AS $func$
        BEGIN
            NEW.search_tsv :=
                setweight(to_tsvector('simple', coalesce(NEW.subject, '')), 'A')
                || setweight(to_tsvector('simple', coalesce(NEW.from_address, '')), 'B')
                || setweight(to_tsvector('simple', coalesce(NEW.from_name, '')), 'B')
                || setweight(to_tsvector('simple', coalesce(NEW.body_text, '')), 'C');
            RETURN NEW;
        END
        $func$ LANGUAGE plpgsql;
        """
    ))
    await session.execute(text("DROP TRIGGER IF EXISTS messages_search_tsv_trigger ON messages"))
    await session.execute(text(
        "CREATE TRIGGER messages_search_tsv_trigger BEFORE INSERT OR UPDATE OF subject, from_address, from_name, body_text ON messages FOR EACH ROW EXECUTE FUNCTION messages_search_tsv_update()"
    ))
    await session.commit()
