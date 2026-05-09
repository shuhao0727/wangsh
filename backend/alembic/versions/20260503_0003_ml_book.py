"""创建 ML 学习书表 (ml_books, ml_book_chapters)。

Revision ID: 20260503_0003_ml_book
Revises: 20260503_0002_learning_content
Create Date: 2026-05-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "20260503_0003_ml_book"
down_revision = "20260503_0002_learning_content"
branch_labels = None
depends_on = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_schema = :schema AND table_name = :table"),
        {"schema": "public", "table": table},
    ).first()
    return row is not None


def upgrade():
    # ── ml_books ──────────────────────────────────
    if not _table_exists("ml_books"):
        op.create_table(
            "ml_books",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
            sa.Column("module_key", sa.String(length=50), nullable=False, comment="模块标识: ml / ai / agents"),
            sa.Column("title", sa.String(length=255), nullable=False, comment="书名"),
            sa.Column("subtitle", sa.String(length=255), nullable=True, comment="副标题"),
            sa.Column("description", sa.Text(), nullable=True, comment="书籍描述"),
            sa.Column("audience", sa.String(length=255), nullable=True, comment="目标读者"),
            sa.Column("outcomes", sa.Text(), nullable=True, comment="学习成果 (JSON 数组)"),
            sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False, comment="是否启用"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), comment="创建时间"),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), comment="更新时间"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("module_key", name="uq_ml_books_module_key"),
            comment="ML 学习书元数据表",
        )

    # ── ml_book_chapters ──────────────────────────
    if not _table_exists("ml_book_chapters"):
        op.create_table(
            "ml_book_chapters",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
            sa.Column("book_id", sa.Integer(), nullable=False, comment="关联书籍"),
            sa.Column("slug", sa.String(length=120), nullable=False, comment="URL 友好唯一标识"),
            sa.Column("chapter_number", sa.Integer(), nullable=False, comment="章节序号"),
            sa.Column("title", sa.String(length=255), nullable=False, comment="章节标题"),
            sa.Column("summary", sa.Text(), nullable=True, comment="章节摘要"),
            sa.Column("difficulty", sa.String(length=50), nullable=True, comment="难度: beginner/intermediate/advanced/expert"),
            sa.Column("estimated_minutes", sa.Integer(), nullable=True, comment="预计学习时长(分钟)"),
            sa.Column("markdown", sa.Text(), nullable=True, comment="章节正文 (Markdown)"),
            sa.Column("goals", sa.Text(), nullable=True, comment="学习目标 (JSON 数组)"),
            sa.Column("checklist", sa.Text(), nullable=True, comment="检查清单 (JSON 数组)"),
            sa.Column("experiments", sa.Text(), nullable=True, comment="实验任务 (JSON)"),
            sa.Column("glossary", sa.Text(), nullable=True, comment="术语表 (JSON)"),
            sa.Column("references", sa.Text(), nullable=True, comment="参考来源 (JSON)"),
            sa.Column("prerequisites", sa.Text(), nullable=True, comment="前置章节 (JSON 数组)"),
            sa.Column("keywords", sa.Text(), nullable=True, comment="搜索关键词 (JSON 数组)"),
            sa.Column("quiz", sa.Text(), nullable=True, comment="自测题 (JSON)"),
            sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False, comment="排序值"),
            sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False, comment="是否启用"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), comment="创建时间"),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), comment="更新时间"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("book_id", "slug", name="uq_ml_book_chapters_book_slug"),
            sa.UniqueConstraint("book_id", "chapter_number", name="uq_ml_book_chapters_book_number"),
            comment="ML 学习书章节内容表",
        )
        op.create_foreign_key(
            "fk_ml_book_chapters_book_id",
            "ml_book_chapters",
            "ml_books",
            ["book_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # ── 索引 ──────────────────────────────────────
    if not _table_exists("ml_books"):
        return
    # 检查索引是否已存在
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ix_ml_books_module_key') THEN
                CREATE INDEX ix_ml_books_module_key ON ml_books (module_key);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ix_ml_book_chapters_book_id') THEN
                CREATE INDEX ix_ml_book_chapters_book_id ON ml_book_chapters (book_id);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ix_ml_book_chapters_slug') THEN
                CREATE INDEX ix_ml_book_chapters_slug ON ml_book_chapters (book_id, slug);
            END IF;
        END
        $$;
    """)


def downgrade():
    if _table_exists("ml_book_chapters"):
        op.execute("DROP INDEX IF EXISTS ix_ml_book_chapters_slug")
        op.execute("DROP INDEX IF EXISTS ix_ml_book_chapters_book_id")
        op.drop_constraint("fk_ml_book_chapters_book_id", "ml_book_chapters", type_="foreignkey")
        op.drop_table("ml_book_chapters")
    if _table_exists("ml_books"):
        op.execute("DROP INDEX IF EXISTS ix_ml_books_module_key")
        op.drop_table("ml_books")
