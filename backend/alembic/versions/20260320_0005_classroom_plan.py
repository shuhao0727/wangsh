"""classroom plan tables

Revision ID: 20260320_0005
Revises: 20260320_0004
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "20260320_0005"
down_revision = "20260320_0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "znt_classroom_plans",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(200), nullable=False, comment="计划标题"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft", comment="状态: draft/active/ended"),
        sa.Column("current_item_id", sa.Integer, nullable=True, comment="当前进行中的 plan_item id"),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        comment="课堂计划表",
    )
    op.create_table(
        "znt_classroom_plan_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("znt_classroom_plans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("activity_id", sa.Integer, sa.ForeignKey("znt_classroom_activities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0", comment="排列顺序"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", comment="状态: pending/active/ended"),
        comment="课堂计划题目列表",
    )


def downgrade():
    op.drop_table("znt_classroom_plan_items")
    op.drop_table("znt_classroom_plans")
