"""Transaction-scoped XBK row locks; no schema or deletion-policy changes.

All cooperating writers lock students, then courses, then selections. Within
one table acquire ascending immutable IDs (including across bounded batches).
SHARE, not KEY SHARE, is required: soft deletion updates a non-key column.
Callers must keep these locks until commit/rollback and inspect returned state.
"""

from sqlalchemy import bindparam, delete, select, tuple_


async def lock_rows(db, model, *conditions, shared=False):
    """Return current locked rows, replacing any stale identity-map snapshot."""
    return (await db.execute(
        select(model).where(*conditions).order_by(model.id)
        .with_for_update(read=shared).execution_options(populate_existing=True)
    )).scalars().all()


async def lock_key_rows(db, model, fields, keys, *, shared=False):
    """Discover IDs in bounded queries, then lock in global ID order.

    Discovery is not validation: deleted/moved rows are checked again from the
    locked result. A concurrently inserted row not seen here is not accepted as
    a reference; an upsert may still create/restore its own parent after a delete.
    """
    columns = [getattr(model, field) for field in fields]
    keys = sorted(set(keys))
    ids = set()
    for offset in range(0, len(keys), 500):
        ids.update((await db.execute(select(model.id).where(
            tuple_(*columns).in_(keys[offset:offset + 500]),
        ))).scalars().all())
    rows = []
    ordered_ids = sorted(ids)
    for offset in range(0, len(ordered_ids), 500):
        rows.extend(await lock_rows(
            db, model, model.id.in_(ordered_ids[offset:offset + 500]), shared=shared,
        ))
    return rows


async def delete_locked_rows(db, model, rows):
    """Delete the frozen set without exceeding PostgreSQL's bind limit."""
    deleted = 0
    for offset in range(0, len(rows), 500):
        result = await db.execute(delete(model).where(
            model.id.in_([row.id for row in rows[offset:offset + 500]]),
        ))
        deleted += result.rowcount or 0
    return deleted


def frozen_id_condition(model, ids):
    """Frozen DB integer IDs, rendered by SQLAlchemy (never interpolated input).

    Cascade membership may span more IDs than asyncpg's bind limit. Expanding
    typed post-compile literals preserve that frozen set without one bind/ID;
    actual deletes remain bounded in delete_locked_rows.
    """
    return model.id.in_(bindparam(None, list(ids), expanding=True, literal_execute=True))
