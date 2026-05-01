"""migrate _ensure_dev_schema patches into formal Alembic migration

Revision ID: 20260430_migrate_dev_schema
Revises: 20260428_agent_idx
Create Date: 2026-04-30

Three historical schema patches (previously applied directly via raw SQL in
_startup.py:_ensure_dev_schema) are now formalized here with idempotent checks.
"""

from alembic import op
from sqlalchemy import text

revision = '20260430_migrate_dev_schema'
down_revision = '20260428_agent_idx'
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).first()
    return row is not None


def _index_exists(index_name: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        text(
            "SELECT 1 FROM pg_indexes WHERE indexname = :idx"
        ),
        {"idx": index_name},
    ).first()
    return row is not None


def upgrade():
    # 1. xxjs_dianming: add updated_at column (historical missing column)
    if not _column_exists("xxjs_dianming", "updated_at"):
        op.execute(
            text(
                "ALTER TABLE xxjs_dianming "
                "ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"
            )
        )
    op.execute(
        text(
            "UPDATE xxjs_dianming SET updated_at = created_at WHERE updated_at IS NULL"
        )
    )
    # Make NOT NULL if currently nullable
    conn = op.get_bind()
    col_info = conn.execute(
        text(
            "SELECT is_nullable FROM information_schema.columns "
            "WHERE table_name = 'xxjs_dianming' AND column_name = 'updated_at'"
        )
    ).first()
    if col_info and col_info[0] == "YES":
        op.execute(
            text("ALTER TABLE xxjs_dianming ALTER COLUMN updated_at SET NOT NULL")
        )

    # 2. znt_group_discussion_sessions: add group_name column + index
    if not _column_exists("znt_group_discussion_sessions", "group_name"):
        op.execute(
            text(
                "ALTER TABLE znt_group_discussion_sessions "
                "ADD COLUMN group_name VARCHAR(64)"
            )
        )
    if not _index_exists("ix_znt_group_discussion_sessions_group_name"):
        op.create_index(
            "ix_znt_group_discussion_sessions_group_name",
            "znt_group_discussion_sessions",
            ["group_name"],
        )

    # 3. znt_group_discussion_analyses: add compare_session_ids column
    if not _column_exists("znt_group_discussion_analyses", "compare_session_ids"):
        op.execute(
            text(
                "ALTER TABLE znt_group_discussion_analyses "
                "ADD COLUMN compare_session_ids TEXT"
            )
        )


def downgrade():
    # 1. xxjs_dianming: leave updated_at in place (no lossy downgrade)
    # 2. znt_group_discussion_sessions: drop index + column
    if _index_exists("ix_znt_group_discussion_sessions_group_name"):
        op.drop_index(
            "ix_znt_group_discussion_sessions_group_name",
            table_name="znt_group_discussion_sessions",
        )
    if _column_exists("znt_group_discussion_sessions", "group_name"):
        op.drop_column("znt_group_discussion_sessions", "group_name")
    # 3. znt_group_discussion_analyses: drop column
    if _column_exists("znt_group_discussion_analyses", "compare_session_ids"):
        op.drop_column("znt_group_discussion_analyses", "compare_session_ids")
