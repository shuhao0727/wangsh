"""Durable session authority, explicit legacy cutover, and opaque refresh families.

Redis is a recoverable projection, never the sole revocation witness.
"""
import re
import secrets
from datetime import datetime, timedelta, timezone

_PREFIX = "ws1."
_NONCE = re.compile(r"[A-Za-z0-9_-]{22}\Z")
_SECRET = re.compile(r"[A-Za-z0-9_-]{86}\Z")


class FamilyStoreUnavailable(RuntimeError):
    """Durable authority could not be checked; not an invalid credential."""


def valid_family_nonce(value) -> bool:
    return isinstance(value, str) and _NONCE.fullmatch(value) is not None


def refresh_family(token: str) -> str | None:
    """Reject malformed versioned tokens rather than downgrade them to legacy."""
    if not token.startswith(_PREFIX):
        return None
    parts = token.split(".")
    if len(parts) != 3 or not _NONCE.fullmatch(parts[1]) or not _SECRET.fullmatch(parts[2]):
        raise ValueError("无效的刷新凭据格式")
    return parts[1]


def new_family_refresh(nonce: str | None = None) -> str:
    nonce = nonce or secrets.token_urlsafe(16)
    if not _NONCE.fullmatch(nonce):
        raise ValueError("无效的会话标识")
    return f"{_PREFIX}{nonce}.{secrets.token_urlsafe(64)}"


async def family_is_active(db, user_id: int, nonce: str) -> bool:
    """Literal prefix, same owner, active and unexpired; DB errors propagate."""
    from sqlalchemy import select
    from app.models import RefreshToken

    if not isinstance(nonce, str) or not _NONCE.fullmatch(nonce):
        return False
    result = await db.execute(select(RefreshToken.id).where(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked.is_(False),
        RefreshToken.expires_at > datetime.now(timezone.utc),
        RefreshToken.token.startswith(f"{_PREFIX}{nonce}.", autoescape=True),
    ).limit(1))
    return result.scalar_one_or_none() is not None


async def verify_access_family(user_id: int, payload: dict, db=None) -> bool:
    """Durable nonce fence applies to legacy access as well as ws1 families."""
    async def check(session):
        await require_auth_authority_ready(session)
        if not await durable_access_is_active(session, user_id, payload):
            return False
        if "sf" not in payload:
            return True
        if type(payload["sf"]) is not int or payload["sf"] != 1:
            return False
        return await family_is_active(session, user_id, payload.get("sn"))

    try:
        if db is not None:
            return await check(db)
        from app.db.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            return await check(session)
    except Exception as exc:
        raise FamilyStoreUnavailable("无法核验会话，请稍后重试") from exc


async def lock_auth_mutation(db, *, require_ready: bool = True) -> None:
    """Global order: auth advisory lock -> user -> token/state rows.

    PostgreSQL transaction locks release on commit/rollback/connection loss.
    SQLite is used only for sequential unit tests, never as concurrency proof.
    """
    from sqlalchemy import text

    if db.get_bind().dialect.name == "postgresql":
        await db.execute(text("SELECT pg_advisory_xact_lock(1465075777, 1)"))
    if require_ready:
        await require_auth_authority_ready(db)


async def require_auth_authority_ready(db) -> None:
    from fastapi import HTTPException
    from sqlalchemy import select
    from app.models import AuthAuthority

    ready = await db.scalar(select(AuthAuthority.ready).where(AuthAuthority.id == 1))
    if ready is not True:
        raise HTTPException(status_code=503, detail="认证持久状态尚未完成受控迁移")


async def session_state(db, user_id: int):
    from sqlalchemy import select
    from app.models import AuthSessionState

    return (await db.execute(select(AuthSessionState).where(
        AuthSessionState.user_id == user_id,
    ).execution_options(populate_existing=True))).scalar_one_or_none()


async def revoke_durable_session(db, user_id: int) -> None:
    """Caller holds the auth lock. Keep a tombstone even for legacy-only users."""
    from app.models import AuthSessionState
    from app.services.auth import revoke_all_user_refresh_tokens

    state = await session_state(db, user_id)
    if state is None:
        db.add(AuthSessionState(user_id=user_id, nonce=secrets.token_urlsafe(16), ip="", active=False))
    else:
        state.active = False
    await revoke_all_user_refresh_tokens(db, user_id, commit=False)
    await db.flush()


async def claim_durable_session(db, user_id: int, nonce: str, ip: str) -> None:
    """Caller holds the auth lock. Only unexpired IP leases cause eviction.

    Ready authority is complete: never runtime-adopt a Redis-only owner. Keep
    revocation evidence after the occupation lease expires.
    """
    from sqlalchemy import select
    from app.core.config import settings
    from app.core.session_guard import _session_ttl
    from app.models import AuthSessionState

    now = datetime.now(timezone.utc)
    if settings.AUTH_USER_UNIQUE_PER_IP:
        owners = (await db.execute(select(AuthSessionState).where(
            AuthSessionState.ip == ip,
            AuthSessionState.active.is_(True),
            AuthSessionState.ip_expires_at > now,
            AuthSessionState.user_id != user_id,
        ))).scalars().all()
        for owner in owners:
            await revoke_durable_session(db, owner.user_id)

    state = await session_state(db, user_id)
    if state is None:
        db.add(AuthSessionState(user_id=user_id, nonce=nonce, ip=ip, active=True,
                                ip_expires_at=now + timedelta(seconds=_session_ttl())))
    else:
        state.nonce, state.ip, state.active = nonce, ip, True
        state.ip_expires_at = now + timedelta(seconds=_session_ttl())
    await db.flush()


async def durable_access_is_active(db, user_id: int, payload: dict) -> bool:
    state = await session_state(db, user_id)
    # Missing ownership is not authority. Legacy must be enrolled during the
    # controlled cutover; runtime cache loss can recover only enrolled state.
    return state is not None and state.active and state.nonce == payload.get("sn")
