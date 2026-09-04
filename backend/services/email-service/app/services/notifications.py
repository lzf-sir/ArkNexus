"""In-process pub/sub bus for real-time notifications within this service.

The bus is intentionally simple: a single asyncio.Queue per subscriber. Events
flow through the SSE endpoint to all connected clients. If the bus is empty
when a client connects, we keep the connection alive by sending periodic
heartbeats so the SSE stream doesn't time out at intermediate proxies.

This is single-process: if the user later runs multiple uvicorn workers, swap
the bus for Redis pub/sub or Postgres LISTEN/NOTIFY. For the typical
self-hosted single-container deploy, in-process is enough.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class Notification:
    """A single notification event delivered via SSE."""

    id: str
    type: str  # "email.received" | "system"
    title: str
    body: str
    created_at: float = field(default_factory=time.time)
    data: dict | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "body": self.body,
            "created_at": self.created_at,
            "data": self.data or {},
        }

    def to_sse(self) -> str:
        # SSE wire format: data: <json>\n\n
        return f"data: {json.dumps(self.to_dict(), ensure_ascii=False)}\n\n"


class NotificationBus:
    """Fan-out queue. New subscribers receive future events; history isn't replayed."""

    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue[Notification | None]] = []
        self._lock = asyncio.Lock()

    async def publish(self, notif: Notification) -> None:
        async with self._lock:
            queues = list(self._subscribers)
        for q in queues:
            # If a queue is full, drop the oldest entry — better than back-pressure.
            if q.full():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                q.put_nowait(notif)
            except asyncio.QueueFull:
                pass

    async def subscribe(self) -> asyncio.Queue[Notification | None]:
        q: asyncio.Queue[Notification | None] = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._subscribers.append(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue[Notification | None]) -> None:
        async with self._lock:
            try:
                self._subscribers.remove(q)
            except ValueError:
                pass


# Module-level singleton. Imported by endpoints and the SMTP handler.
bus = NotificationBus()


def new_id() -> str:
    return uuid.uuid4().hex[:12]


async def stream(
    q: asyncio.Queue[Notification | None],
) -> AsyncIterator[str]:
    """Yield SSE-formatted strings from the subscriber queue, with heartbeats."""
    HEARTBEAT_INTERVAL = 25.0
    try:
        while True:
            try:
                notif = await asyncio.wait_for(q.get(), timeout=HEARTBEAT_INTERVAL)
                if notif is None:
                    break
                yield notif.to_sse()
            except asyncio.TimeoutError:
                # SSE comment line keeps the connection warm.
                yield ": heartbeat\n\n"
    finally:
        await bus.unsubscribe(q)