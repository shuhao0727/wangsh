"""add learning content items table

Revision ID: 20260503_0002_learning_content
Revises: 20260503_0001_learning_progress
Create Date: 2026-05-03

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20260503_0002_learning_content"
down_revision = "20260503_0001_learning_progress"
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


def upgrade():
    if _table_exists("sys_learning_content_items"):
        return

    op.create_table(
        "sys_learning_content_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("module_key", sa.String(length=50), nullable=False, comment="模块标识: ml, ai, agents"),
        sa.Column("section_key", sa.String(length=80), nullable=False, comment="内容分区"),
        sa.Column("item_key", sa.String(length=120), nullable=False, comment="内容项唯一标识"),
        sa.Column("title", sa.String(length=255), nullable=False, comment="标题"),
        sa.Column("summary", sa.Text(), nullable=True, comment="摘要"),
        sa.Column("content", sa.Text(), nullable=False, comment="结构化内容 JSON"),
        sa.Column("tags", sa.Text(), nullable=True, comment="标签 JSON 数组"),
        sa.Column("difficulty", sa.String(length=50), nullable=True, comment="难度"),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False, comment="排序"),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False, comment="是否启用"),
        sa.Column("source_type", sa.String(length=50), server_default="admin", nullable=False, comment="来源"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False, comment="创建时间"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False, comment="更新时间"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("module_key", "section_key", "item_key", name="uq_sys_learning_content_module_section_item"),
        comment="学习内容配置表",
    )
    op.create_index("ix_sys_learning_content_items_module_key", "sys_learning_content_items", ["module_key"])
    op.create_index("ix_sys_learning_content_items_section_key", "sys_learning_content_items", ["section_key"])


def downgrade():
    if not _table_exists("sys_learning_content_items"):
        return
    op.drop_index("ix_sys_learning_content_items_section_key", table_name="sys_learning_content_items")
    op.drop_index("ix_sys_learning_content_items_module_key", table_name="sys_learning_content_items")
    op.drop_table("sys_learning_content_items")
