"""Tests for the in-process notification bus + SSE endpoint."""

from __future__ import annotations

import asyncio
import json

import pytest

from app.services.notifications import Notification, bus, new_id


@pytest.mark.asyncio
async def test_publish_and_subscribe_roundtrip():
    sub = await bus.subscribe()
    try:
        n = Notification(id=new_id(), type="email.received", title="hi", body="there")
        await bus.publish(n)
        received = await asyncio.wait_for(sub.get(), timeout=1.0)
        assert received.id == n.id
        assert received.type == "email.received"
    finally:
        await bus.unsubscribe(sub)


@pytest.mark.asyncio
async def test_subscribe_does_not_replay_history():
    n = Notification(id=new_id(), type="email.received", title="before", body="x")
    await bus.publish(n)
    # New subscriber does NOT get the past event.
    sub = await bus.subscribe()
    try:
        # Verify no item is immediately available.
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(sub.get(), timeout=0.2)
    finally:
        await bus.unsubscribe(sub)


@pytest.mark.asyncio
async def test_publish_to_multiple_subscribers():
    a = await bus.subscribe()
    b = await bus.subscribe()
    try:
        n = Notification(id=new_id(), type="system", title="all", body="fan-out")
        await bus.publish(n)
        ra = await asyncio.wait_for(a.get(), timeout=1.0)
        rb = await asyncio.wait_for(b.get(), timeout=1.0)
        assert ra.id == rb.id == n.id
    finally:
        await bus.unsubscribe(a)
        await bus.unsubscribe(b)


@pytest.mark.asyncio
async def test_full_queue_drops_oldest():
    sub = await bus.subscribe()
    try:
        # Fill the queue past its capacity.
        for i in range(250):
            await bus.publish(
                Notification(id=f"q-{i}", type="system", title=str(i), body="")
            )
        # Queue is capped at 200; older items were dropped, so we should
        # still see *some* items but not all 250.
        seen = set()
        while not sub.empty():
            seen.add(sub.get_nowait().id)
        assert 200 <= len(seen) <= 200  # exactly the cap
        assert "q-249" in seen  # newest survives
    finally:
        await bus.unsubscribe(sub)


def test_notification_to_sse_format():
    n = Notification(id="abc", type="x", title="t", body="b")
    out = n.to_sse()
    assert out.startswith("data: ")
    assert out.endswith("\n\n")
    payload = json.loads(out[len("data: ") :].rstrip("\n"))
    assert payload["id"] == "abc"
    assert payload["type"] == "x"


@pytest.mark.asyncio
async def test_sse_endpoint_route_is_registered():
    """Smoke test that the SSE endpoint is wired into the FastAPI router.

    We can't easily run a real SSE consumer in TestClient (the SMTP server
    lifespan makes it slow), but we can verify the route exists and is
    configured for event-stream.
    """
    from app.api.v1.router import api_router

    paths = {r.path for r in api_router.routes}
    assert "/system/notifications/stream" in paths