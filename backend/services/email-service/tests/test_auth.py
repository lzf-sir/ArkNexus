"""Tests for JWT issuance + password hashing + user service."""

import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.schemas.auth import UserCreate
from app.schemas.mailbox import MailboxCreate
from app.services import mailbox_service, user_service


def test_password_hash_and_verify():
    h = hash_password("super-secret-passphrase")
    assert verify_password("super-secret-passphrase", h)
    assert not verify_password("nope", h)


def test_jwt_roundtrip():
    token = create_access_token("user-1", extra_claims={"email": "u@example.com"})
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-1"
    assert payload["email"] == "u@example.com"


def test_jwt_invalid_signature():
    payload = decode_access_token("not.a.real.token")
    assert payload is None


@pytest.mark.asyncio
async def test_create_and_authenticate_user(db_session):
    user = await user_service.create_user(
        db_session, UserCreate(email="alice@example.com", password="longerthan8")
    )
    assert user.id
    assert user.email == "alice@example.com"

    authed = await user_service.authenticate(
        db_session, "alice@example.com", "longerthan8"
    )
    assert authed.id == user.id
    assert authed.last_login_at is not None

    with pytest.raises(user_service.InvalidCredentials):
        await user_service.authenticate(db_session, "alice@example.com", "wrong")

    with pytest.raises(user_service.UserAlreadyExists):
        await user_service.create_user(
            db_session, UserCreate(email="alice@example.com", password="another1234")
        )


@pytest.mark.asyncio
async def test_mailbox_owned_by_user_is_invisible_to_others(db_session):
    owner = await user_service.create_user(
        db_session, UserCreate(email="owner@example.com", password="password123")
    )
    intruder = await user_service.create_user(
        db_session, UserCreate(email="intruder@example.com", password="password123")
    )

    owned = await mailbox_service.create_mailbox(
        db_session, MailboxCreate(), owner_id=owner.id
    )

    owner_boxes = await mailbox_service.list_mailboxes(db_session, user_id=owner.id)
    intruder_boxes = await mailbox_service.list_mailboxes(db_session, user_id=intruder.id)
    anon_boxes = await mailbox_service.list_mailboxes(db_session, user_id=None)

    assert any(m.id == owned.id for m in owner_boxes)
    assert not any(m.id == owned.id for m in intruder_boxes)
    assert not any(m.id == owned.id for m in anon_boxes)


@pytest.mark.asyncio
async def test_get_mailbox_for_visibility(db_session):
    owner = await user_service.create_user(
        db_session, UserCreate(email="owner2@example.com", password="password123")
    )
    intruder = await user_service.create_user(
        db_session, UserCreate(email="intruder2@example.com", password="password123")
    )

    owned = await mailbox_service.create_mailbox(
        db_session, MailboxCreate(), owner_id=owner.id
    )
    anon = await mailbox_service.create_mailbox(db_session, MailboxCreate(), owner_id=None)

    assert (await mailbox_service.get_mailbox_for(db_session, owned.id, user_id=owner.id)).id == owned.id
    assert (await mailbox_service.get_mailbox_for(db_session, anon.id, user_id=None)).id == anon.id

    with pytest.raises(mailbox_service.MailboxNotFound):
        await mailbox_service.get_mailbox_for(db_session, owned.id, user_id=None)

    with pytest.raises(mailbox_service.MailboxNotFound):
        await mailbox_service.get_mailbox_for(db_session, owned.id, user_id=intruder.id)