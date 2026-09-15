"""Transactional account-lifecycle governance.

Lock order is shared with AUTH admission: global auth mutation lock, then user
rows in primary-key order, then durable session/refresh rows.  Every account
writer that can remove an active account or active super administrator must use
this module before changing state.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session_family import (
    lock_auth_mutation,
    require_auth_authority_ready,
    revoke_durable_session,
)
from app.models import User

LAST_ACTIVE_SUPER_ADMIN = "LAST_ACTIVE_SUPER_ADMIN"


def _actor_context(user: User) -> dict[str, Any]:
    return {"id": user.id, "role_code": user.role_code}


def _reject_stale_actor() -> None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="当前管理员账号已停用、删除或权限已变更",
    )


async def _lock_governed_user_rows(
    db: AsyncSession,
    *,
    actor_id: int,
    target_ids: Iterable[int],
) -> tuple[dict[str, Any], dict[int, User]]:
    try:
        normalized_actor_id = int(actor_id)
        ordered_ids = sorted(
            {normalized_actor_id, *(int(value) for value in target_ids)}
        )
    except (TypeError, ValueError):
        _reject_stale_actor()

    rows = (
        await db.execute(
            select(User).where(User.id.in_(ordered_ids)).order_by(User.id).with_for_update()
        )
    ).scalars().all()
    by_id = {user.id: user for user in rows}
    actor = by_id.get(normalized_actor_id)
    if (
        actor is None
        or actor.is_deleted
        or not actor.is_active
        or actor.role_code not in {"admin", "super_admin"}
    ):
        _reject_stale_actor()
    return _actor_context(actor), by_id


async def lock_account_governance(
    db: AsyncSession,
    *,
    actor_id: int,
    target_ids: Iterable[int],
) -> tuple[dict[str, Any], dict[int, User]]:
    """Serialize governance and revalidate the actor after waiting.

    The ready gate is checked only when a transition actually needs durable
    revocation.  This keeps non-lifecycle profile edits available while the
    AUTH cutover gate is closed, without permitting unsafe disable/delete.
    """
    await lock_auth_mutation(db, require_ready=False)
    return await _lock_governed_user_rows(
        db, actor_id=actor_id, target_ids=target_ids
    )


async def lock_import_account_governance(
    db: AsyncSession,
    *,
    actor_id: int,
    student_id: str,
) -> tuple[dict[str, Any], User | None]:
    """Lock an import target without discovering it before the AUTH lock.

    Target discovery happens after the global transaction lock, then actor and
    target rows are locked together in primary-key order.  This avoids an
    import-only actor->target inversion when the target id sorts before actor.
    """
    await lock_auth_mutation(db, require_ready=False)
    target_id = await db.scalar(
        select(User.id).where(
            User.student_id == student_id,
            User.is_deleted.is_(False),
        )
    )
    actor, users = await _lock_governed_user_rows(
        db,
        actor_id=actor_id,
        target_ids=[target_id] if target_id is not None else [],
    )
    return actor, users.get(target_id) if target_id is not None else None


async def assert_last_active_super_admin(
    db: AsyncSession,
    final_states: Mapping[int, tuple[str, bool, bool]],
) -> None:
    """Reject a cooperating transaction whose final state removes the last SA."""
    active_ids = set(
        (
            await db.execute(
                select(User.id).where(
                    User.role_code == "super_admin",
                    User.is_active.is_(True),
                    User.is_deleted.is_(False),
                )
            )
        ).scalars().all()
    )
    touched_super_admin = False
    for user_id, (role_code, is_active, is_deleted) in final_states.items():
        was_active = user_id in active_ids
        will_be_active = role_code == "super_admin" and is_active and not is_deleted
        touched_super_admin = touched_super_admin or was_active or role_code == "super_admin"
        if will_be_active:
            active_ids.add(user_id)
        else:
            active_ids.discard(user_id)

    if touched_super_admin and not active_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": LAST_ACTIVE_SUPER_ADMIN,
                "message": "系统必须至少保留一名已激活且未删除的超级管理员",
            },
        )


async def revoke_if_account_removed(
    db: AsyncSession,
    user: User,
    *,
    final_is_active: bool,
    final_is_deleted: bool,
) -> bool:
    """Persist an inactive tombstone and revoke refresh tokens in this txn."""
    # A restore must also rotate the durable generation.  This repairs users
    # disabled by an older writer that did not persist a tombstone, while an
    # ordinary active->active profile edit leaves the session untouched.
    must_revoke = not (
        bool(user.is_active)
        and not bool(user.is_deleted)
        and final_is_active
        and not final_is_deleted
    )
    if not must_revoke:
        return False
    await require_auth_authority_ready(db)
    await revoke_durable_session(db, user.id)
    return True
