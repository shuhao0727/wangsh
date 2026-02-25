"""markdown styles and article style_key

Revision ID: 20260225_0009
Revises: 20260225_0008
Create Date: 2026-02-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision: str = "20260225_0009"
down_revision: Union[str, None] = "20260225_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = set(inspector.get_table_names())

    if "wz_markdown_styles" not in tables:
        op.create_table(
            "wz_markdown_styles",
            sa.Column("key", sa.String(length=100), primary_key=True),
            sa.Column("title", sa.String(length=200), nullable=False, server_default=""),
            sa.Column("content", sa.Text(), nullable=False, server_default=""),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("idx_wz_markdown_styles_sort", "wz_markdown_styles", ["sort_order"], unique=False)

    if "wz_articles" in tables:
        cols = {c["name"] for c in inspector.get_columns("wz_articles")}
        if "style_key" not in cols:
            op.add_column("wz_articles", sa.Column("style_key", sa.String(length=100), nullable=True))
            op.create_index("ix_wz_articles_style_key", "wz_articles", ["style_key"], unique=False)

        fks = inspector.get_foreign_keys("wz_articles")
        has_fk = any(
            (fk.get("referred_table") == "wz_markdown_styles")
            and (fk.get("constrained_columns") == ["style_key"])
            for fk in fks
        )
        if not has_fk:
            op.create_foreign_key(
                "fk_wz_articles_style_key",
                "wz_articles",
                "wz_markdown_styles",
                ["style_key"],
                ["key"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = set(inspector.get_table_names())

    if "wz_articles" in tables:
        try:
            op.drop_constraint("fk_wz_articles_style_key", "wz_articles", type_="foreignkey")
        except Exception:
            pass
        try:
            op.drop_index("ix_wz_articles_style_key", table_name="wz_articles")
        except Exception:
            pass
        cols = {c["name"] for c in inspector.get_columns("wz_articles")}
        if "style_key" in cols:
            op.drop_column("wz_articles", "style_key")

    if "wz_markdown_styles" in tables:
        try:
            op.drop_index("idx_wz_markdown_styles_sort", table_name="wz_markdown_styles")
        except Exception:
            pass
        op.drop_table("wz_markdown_styles")
