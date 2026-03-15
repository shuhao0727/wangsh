"""informatics github sync tables

Revision ID: 20260311_0001
Revises: 20260225_0010
Create Date: 2026-03-11 20:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260311_0001"
down_revision = "20260225_0010"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return bool(inspector.has_table(table_name))


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for index in inspector.get_indexes(table_name):
        if index.get("name") == index_name:
            return True
    return False


def upgrade() -> None:
    if not _has_table("inf_github_sync_settings"):
        op.create_table(
            "inf_github_sync_settings",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("repo_url", sa.String(length=500), nullable=False, server_default=""),
            sa.Column("repo_owner", sa.String(length=100), nullable=False, server_default=""),
            sa.Column("repo_name", sa.String(length=200), nullable=False, server_default=""),
            sa.Column("branch", sa.String(length=100), nullable=False, server_default="main"),
            sa.Column("token_encrypted", sa.Text(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("interval_hours", sa.Integer(), nullable=False, server_default="48"),
            sa.Column("delete_mode", sa.String(length=20), nullable=False, server_default="unpublish"),
            sa.Column("last_test_status", sa.String(length=20), nullable=True),
            sa.Column("last_test_message", sa.String(length=500), nullable=True),
            sa.Column("last_test_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_by_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _has_table("inf_github_sync_runs"):
        op.create_table(
            "inf_github_sync_runs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("trigger_type", sa.String(length=20), nullable=False, server_default="manual"),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="running"),
            sa.Column("repo_owner", sa.String(length=100), nullable=False, server_default=""),
            sa.Column("repo_name", sa.String(length=200), nullable=False, server_default=""),
            sa.Column("branch", sa.String(length=100), nullable=False, server_default="main"),
            sa.Column("created_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("updated_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("deleted_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("error_summary", sa.Text(), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        )

    if not _has_table("inf_github_sync_sources"):
        op.create_table(
            "inf_github_sync_sources",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("repo_owner", sa.String(length=100), nullable=False),
            sa.Column("repo_name", sa.String(length=200), nullable=False),
            sa.Column("branch", sa.String(length=100), nullable=False, server_default="main"),
            sa.Column("source_path", sa.String(length=500), nullable=False),
            sa.Column("source_sha", sa.String(length=80), nullable=True),
            sa.Column("note_id", sa.Integer(), sa.ForeignKey("inf_typst_notes.id", ondelete="CASCADE"), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("repo_owner", "repo_name", "branch", "source_path", name="uq_inf_sync_source_repo_path"),
        )
    if _has_table("inf_github_sync_sources") and not _has_index("inf_github_sync_sources", "ix_inf_github_sync_sources_note_id"):
        op.create_index("ix_inf_github_sync_sources_note_id", "inf_github_sync_sources", ["note_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_inf_github_sync_sources_note_id", table_name="inf_github_sync_sources")
    op.drop_table("inf_github_sync_sources")
    op.drop_table("inf_github_sync_runs")
    op.drop_table("inf_github_sync_settings")
