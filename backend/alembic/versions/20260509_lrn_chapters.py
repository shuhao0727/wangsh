"""add learning chapters table

Revision ID: 20260509_lrn_chapters
Revises: 20260503_0003_ml_book
Create Date: 2026-05-09

"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_lrn_chapters"
down_revision = "20260503_0003_ml_book"
branch_labels = None
depends_on = None


def _table_exists(table: str) -> bool:
    result = op.get_bind().execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
        ),
        {"t": table},
    )
    return result.scalar()


def upgrade():
    if _table_exists("sys_learning_chapters"):
        return
    op.create_table(
        "sys_learning_chapters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("module_key", sa.String(50), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="beginner"),
        sa.Column("group_name", sa.String(100), nullable=True),
        sa.Column("markdown", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_learning_chapters_module_key", "sys_learning_chapters", ["module_key"])
    op.create_index("ix_learning_chapters_module_slug", "sys_learning_chapters", ["module_key", "slug"], unique=True)


def downgrade():
    op.drop_table("sys_learning_chapters")
