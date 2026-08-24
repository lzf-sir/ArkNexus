"""Tests for service registry + config keys + history."""

import pytest

from app.schemas.registry import (
    ConfigKeyUpsert,
    ConfigValueUpdate,
    ServiceRegister,
)
from app.services import registry_service


@pytest.mark.asyncio
async def test_register_and_list_services(db_session):
    svc = await registry_service.register_or_update_service(
        db_session,
        ServiceRegister(slug="email-service", display_name="Email", version="0.2"),
    )
    assert svc.slug == "email-service"
    assert svc.is_online is True

    services = await registry_service.list_services(db_session)
    assert any(s.slug == "email-service" for s in services)


@pytest.mark.asyncio
async def test_heartbeat_creates_service_if_missing(db_session):
    svc = await registry_service.heartbeat(db_session, "newcomer")
    assert svc.slug == "newcomer"
    assert svc.display_name == "newcomer"


@pytest.mark.asyncio
async def test_upsert_and_list_config_keys(db_session):
    await registry_service.register_or_update_service(
        db_session, ServiceRegister(slug="email-service", display_name="Email")
    )
    items = await registry_service.bulk_upsert_config_keys(
        db_session,
        "email-service",
        [
            ConfigKeyUpsert(
                key="EMAIL_DOMAIN",
                value_type="string",
                default_value="arknexus.local",
                current_value="arknexus.local",
                group="smtp",
                display_name="收信域名",
            ),
            ConfigKeyUpsert(
                key="RETENTION_DAYS",
                value_type="int",
                default_value="30",
                current_value="30",
                group="retention",
                display_name="保留天数",
            ),
        ],
    )
    assert len(items) == 2
    listed = await registry_service.list_config_keys_for_service(db_session, "email-service")
    assert {c.key for c in listed} == {"EMAIL_DOMAIN", "RETENTION_DAYS"}


@pytest.mark.asyncio
async def test_update_value_creates_history(db_session):
    await registry_service.register_or_update_service(
        db_session, ServiceRegister(slug="email-service", display_name="Email")
    )
    await registry_service.upsert_config_key(
        db_session,
        "email-service",
        ConfigKeyUpsert(
            key="RETENTION_DAYS",
            value_type="int",
            default_value="30",
            current_value="30",
        ),
    )
    updated = await registry_service.update_config_value(
        db_session,
        "email-service",
        "RETENTION_DAYS",
        ConfigValueUpdate(value="45", note="bumped for testing"),
        changed_by="admin",
    )
    assert updated.current_value == "45"
    history = await registry_service.get_config_history(
        db_session, "email-service", "RETENTION_DAYS"
    )
    assert len(history) == 1
    assert history[0].old_value == "30"
    assert history[0].new_value == "45"
    assert history[0].changed_by == "admin"


@pytest.mark.asyncio
async def test_readonly_rejects_update(db_session):
    await registry_service.register_or_update_service(
        db_session, ServiceRegister(slug="email-service", display_name="Email")
    )
    await registry_service.upsert_config_key(
        db_session,
        "email-service",
        ConfigKeyUpsert(
            key="EMAIL_DOMAIN",
            value_type="string",
            default_value="arknexus.local",
            is_readonly=True,
        ),
    )
    with pytest.raises(PermissionError):
        await registry_service.update_config_value(
            db_session, "email-service", "EMAIL_DOMAIN", ConfigValueUpdate(value="evil.com")
        )


@pytest.mark.asyncio
async def test_runtime_config_returns_typed_dict(db_session):
    await registry_service.register_or_update_service(
        db_session, ServiceRegister(slug="email-service", display_name="Email")
    )
    await registry_service.bulk_upsert_config_keys(
        db_session,
        "email-service",
        [
            ConfigKeyUpsert(key="EMAIL_DOMAIN", value_type="string", current_value="example.com"),
            ConfigKeyUpsert(key="RETENTION_DAYS", value_type="int", current_value="60"),
            ConfigKeyUpsert(key="ENABLE_TLS", value_type="bool", current_value="true"),
        ],
    )
    cfg = await registry_service.get_runtime_config(db_session, "email-service")
    assert cfg == {
        "EMAIL_DOMAIN": "example.com",
        "RETENTION_DAYS": 60,
        "ENABLE_TLS": True,
    }


@pytest.mark.asyncio
async def test_delete_service_removes_keys(db_session):
    await registry_service.register_or_update_service(
        db_session, ServiceRegister(slug="throwaway", display_name="X")
    )
    await registry_service.upsert_config_key(
        db_session,
        "throwaway",
        ConfigKeyUpsert(key="FOO", value_type="string", default_value="bar"),
    )
    await registry_service.delete_service(db_session, "throwaway")
    with pytest.raises(registry_service.ServiceNotFound):
        await registry_service.get_service_by_slug(db_session, "throwaway")