"""Tests for OAuth account linkage management.

The /auth/me/oauth-accounts endpoints are thin wrappers around
`oauth_link_service`; the heavy lifting (find/create user on first OAuth login)
is already covered in test_oauth.py. Here we only verify the data layer: a user
can have multiple providers linked, and links can be detached/reattached.
"""

from __future__ import annotations

from app.core.security import hash_password
from app.models.oauth import OAuthAccount
from app.models.user import User
from app.services import oauth, oauth_link_service


async def _make_user(db_session, email: str = "multi@example.com") -> User:
    user = User(
        email=email,
        display_name=email.split("@")[0].title(),
        password_hash=hash_password("longerthan8"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def test_user_can_have_multiple_providers_linked(db_session):
    user = await _make_user(db_session)

    gh_profile = oauth.OAuthUserProfile(
        provider="github",
        provider_user_id="gh-001",
        email=user.email,
        display_name="GH",
    )
    gg_profile = oauth.OAuthUserProfile(
        provider="google",
        provider_user_id="gg-002",
        email=user.email,
        display_name="GG",
    )
    ms_profile = oauth.OAuthUserProfile(
        provider="microsoft",
        provider_user_id="ms-003",
        email=user.email,
        display_name="MS",
    )

    user1 = await oauth_link_service.find_or_create_user(db_session, gh_profile)
    user2 = await oauth_link_service.find_or_create_user(db_session, gg_profile)
    user3 = await oauth_link_service.find_or_create_user(db_session, ms_profile)
    assert user1.id == user.id
    assert user2.id == user.id
    assert user3.id == user.id

    from sqlalchemy import select
    stmt = select(OAuthAccount).where(OAuthAccount.user_id == user.id)
    rows = (await db_session.execute(stmt)).scalars().all()
    providers = sorted(r.provider for r in rows)
    assert providers == ["github", "google", "microsoft"]


async def test_unlink_then_relink(db_session):
    user = await _make_user(db_session, "relink@example.com")

    profile = oauth.OAuthUserProfile(
        provider="github",
        provider_user_id="gh-relink",
        email=user.email,
        display_name="Relink",
    )
    await oauth_link_service.find_or_create_user(db_session, profile)

    from sqlalchemy import select
    stmt = select(OAuthAccount).where(OAuthAccount.user_id == user.id)
    rows = (await db_session.execute(stmt)).scalars().all()
    assert len(rows) == 1

    # Unlink.
    link = rows[0]
    await db_session.delete(link)
    await db_session.commit()

    rows = (await db_session.execute(stmt)).scalars().all()
    assert len(rows) == 0

    # Re-link: same provider+user_id should re-create.
    again = await oauth_link_service.find_or_create_user(db_session, profile)
    assert again.id == user.id
    rows = (await db_session.execute(stmt)).scalars().all()
    assert len(rows) == 1
    assert rows[0].provider == "github"
    assert rows[0].provider_user_id == "gh-relink"


async def test_same_provider_id_different_users_isolated(db_session):
    """A different user can be linked to a different (provider, provider_user_id)."""
    u1 = await _make_user(db_session, "iso1@example.com")
    u2 = await _make_user(db_session, "iso2@example.com")

    p1 = oauth.OAuthUserProfile(
        provider="github", provider_user_id="gh-iso-1", email=u1.email, display_name="U1"
    )
    p2 = oauth.OAuthUserProfile(
        provider="github", provider_user_id="gh-iso-2", email=u2.email, display_name="U2"
    )
    await oauth_link_service.find_or_create_user(db_session, p1)
    await oauth_link_service.find_or_create_user(db_session, p2)

    from sqlalchemy import select
    stmt = select(OAuthAccount).where(OAuthAccount.provider == "github")
    rows = (await db_session.execute(stmt)).scalars().all()
    assert len(rows) == 2
    user_ids = {r.user_id for r in rows}
    assert user_ids == {u1.id, u2.id}
