"""add learning progress table

Revision ID: 20260503_0001_learning_progress
Revises: 20260430_migrate_dev_schema
Create Date: 2026-05-03

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20260503_0001_learning_progress"
down_revision = "20260430_migrate_dev_schema"
branch_labels = None
depends_on = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = current_schema() AND table_name = :table"
        ),
        {"table": table},
    ).first()
    return row is not None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    ).first()
    return row is not None


def _constraint_exists(name: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_schema = current_schema() AND constraint_name = :name"
        ),
        {"name": name},
    ).first()
    return row is not None


def upgrade():
    if not _table_exists("sys_learning_progress"):
        op.create_table(
            "sys_learning_progress",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("module_key", sa.String(length=50), nullable=False),
            sa.Column("current_stage", sa.String(length=100), nullable=True),
            sa.Column("completed_stages", sa.Text(), nullable=True),
            sa.Column("progress_data", sa.Text(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["sys_users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "module_key", name="uq_sys_learning_progress_user_module"),
            comment="学习进度表",
        )
        return

    if not _column_exists("sys_learning_progress", "progress_data"):
        op.add_column("sys_learning_progress", sa.Column("progress_data", sa.Text(), nullable=True, comment="前端学习进度数据 (JSON 对象)"))

    if _constraint_exists("uq_user_module") and not _constraint_exists("uq_sys_learning_progress_user_module"):
        op.drop_constraint("uq_user_module", "sys_learning_progress", type_="unique")

    if not _constraint_exists("uq_sys_learning_progress_user_module"):
        op.create_unique_constraint(
            "uq_sys_learning_progress_user_module",
            "sys_learning_progress",
            ["user_id", "module_key"],
        )


def downgrade():
    op.drop_table("sys_learning_progress")
