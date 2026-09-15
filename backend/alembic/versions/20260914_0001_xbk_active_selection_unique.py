"""prevent more than one active XBK selection per student and period

This is an expand-phase safety constraint.  The migration deliberately refuses
DDL when historical active duplicates exist; operators must review and resolve
those rows explicitly before retrying.  Run only during an approved write stop.

Revision ID: 20260914_0001_xbk_active_selection_unique
Revises: 20260910_0001_auth_authority
Create Date: 2026-09-14T00:00:00+08:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260914_0001_xbk_active_selection_unique"
down_revision: Union[str, None] = "20260910_0001_auth_authority"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX_NAME = "uq_xbk_selections_active_period_student"
_DUPLICATE_QUERY = sa.text(
    """
    SELECT year, term, student_no, COUNT(*) AS active_count
    FROM xbk_selections
    WHERE is_deleted IS FALSE
    GROUP BY year, term, student_no
    HAVING COUNT(*) > 1
    ORDER BY year, term, student_no
    LIMIT 20
    """
)


def _active_duplicate_samples(bind):
    return list(bind.execute(_DUPLICATE_QUERY).mappings())


def _require_postgresql(bind) -> None:
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "XBK active-selection uniqueness migration requires PostgreSQL; "
            "non-PostgreSQL execution is unsupported"
        )


def _lock_selection_writers(bind) -> None:
    # SHARE ROW EXCLUSIVE waits for active INSERT/UPDATE/DELETE transactions and
    # blocks new writers until this migration transaction commits or rolls back.
    # Operators must still stop and drain every old application writer first.
    bind.execute(sa.text("LOCK TABLE xbk_selections IN SHARE ROW EXCLUSIVE MODE"))


def upgrade() -> None:
    bind = op.get_bind()
    _require_postgresql(bind)
    _lock_selection_writers(bind)

    duplicates = _active_duplicate_samples(bind)
    if duplicates:
        summary = "; ".join(
            f"{row['year']}/{row['term']}/{row['student_no']}={row['active_count']}"
            for row in duplicates
        )
        raise RuntimeError(
            "XBK active-selection uniqueness preflight failed; "
            f"review active duplicates before retrying (up to 20 shown): {summary}"
        )

    op.create_index(
        "uq_xbk_selections_active_period_student",
        "xbk_selections",
        ["year", "term", "student_no"],
        unique=True,
        postgresql_where=sa.text("is_deleted IS FALSE"),
    )


def downgrade() -> None:
    # Dropping this index reopens the multiple-active-selection race.  Acquire
    # the same writer-blocking lock as upgrade, but treat a live downgrade as an
    # operationally unsafe contract change even when this DDL succeeds.
    bind = op.get_bind()
    _require_postgresql(bind)
    _lock_selection_writers(bind)
    op.drop_index(_INDEX_NAME, table_name="xbk_selections")
