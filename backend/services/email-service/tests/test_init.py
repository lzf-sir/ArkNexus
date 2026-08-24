"""Tests for the first-run initialization wizard."""

import pytest

from app.services import init_service


def test_validate_database_url_sqlite_ok():
    meta = init_service.validate_database_url("sqlite+aiosqlite:///./data/x.db")
    assert meta["driver"] == "sqlite"


def test_validate_database_url_pg_ok():
    meta = init_service.validate_database_url("postgresql+asyncpg://u:p@db:5432/arknexus")
    assert meta["driver"] == "postgresql"
    assert meta["host"] == "db"
    assert meta["port"] == 5432


def test_validate_database_url_bad_scheme():
    with pytest.raises(init_service.InitError):
        init_service.validate_database_url("mongodb://localhost")


def test_validate_database_url_sqlite_must_end_db():
    with pytest.raises(init_service.InitError):
        init_service.validate_database_url("sqlite+aiosqlite:///./data/folder")


def test_validate_redis_empty_is_skip():
    assert init_service.validate_redis_url("") is None


def test_validate_redis_url_ok():
    meta = init_service.validate_redis_url("redis://localhost:6379/0")
    assert meta["scheme"] == "redis"
    assert meta["port"] == 6379


def test_validate_redis_url_bad_scheme():
    with pytest.raises(init_service.InitError):
        init_service.validate_redis_url("http://localhost:6379")


def test_validate_domain_normalizes():
    assert init_service.validate_domain("Example.COM ") == "example.com"


def test_validate_domain_must_have_dot():
    with pytest.raises(init_service.InitError):
        init_service.validate_domain("localhost")


@pytest.mark.asyncio
async def test_init_wizard_full_flow(db_session):
    assert await init_service.is_initialized(db_session) is False

    # Step 1: DB
    meta = await init_service.save_database_choice(
        db_session, "sqlite+aiosqlite:///./data/test.db"
    )
    assert meta["driver"] == "sqlite"

    # Step 2: Redis (skipped)
    r = await init_service.save_redis_choice(db_session, "")
    assert r is None

    # Step 3: Domain
    domain = await init_service.save_domain_choice(db_session, "Example.com")
    assert domain == "example.com"

    # Step 4: Admin
    user = await init_service.create_admin(
        db_session,
        email="admin@example.com",
        password="supersecret",
        display_name="Root",
    )
    await init_service._set(db_session, "admin_user_id", user.id)
    assert user.is_admin is True
    assert user.is_active is True

    # Finalize
    result = await init_service.finalize_initialization(db_session)
    assert result["initialized"] is True
    assert await init_service.is_initialized(db_session) is True


@pytest.mark.asyncio
async def test_double_init_blocked(db_session):
    user = await init_service.create_admin(
        db_session, email="x@x.com", password="longenough1"
    )
    await init_service._set(db_session, "admin_user_id", user.id)
    await init_service.finalize_initialization(db_session)

    with pytest.raises(init_service.InitError):
        await init_service.create_admin(
            db_session, email="y@y.com", password="longenough2"
        )


@pytest.mark.asyncio
async def test_admin_password_too_short(db_session):
    with pytest.raises(init_service.InitError):
        await init_service.create_admin(
            db_session, email="weak@example.com", password="short"
        )


@pytest.mark.asyncio
async def test_get_full_state_returns_defaults_when_empty(db_session):
    state = await init_service.get_full_state(db_session)
    # database_url and email_domain should fall back to settings defaults
    assert state["database_url"]  # not empty
    assert state["email_domain"]  # not empty
    assert state["initialized"] is None