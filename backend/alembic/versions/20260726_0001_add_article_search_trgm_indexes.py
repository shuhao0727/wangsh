"""add article search trgm indexes

启用 pg_trgm 扩展并创建 wz_articles.title/content 的 GIN trgm 索引，
用于文章全文/模糊搜索加速。

注意：此迁移曾在本地开发库被应用（2026-07-26），但源文件未提交到仓库，
导致开发库 alembic_version 指向本 revision 而仓库缺失。本文件按 DB 现状重建，
使用 IF NOT EXISTS 保证幂等（已在开发库 apply 过则跳过，全新库则正常执行）。

Revision ID: 20260726_0001_add_article_search_trgm_indexes
Revises: 20260711_0002_restore_legacy_baseline_indexes
Create Date: 2026-07-26T00:00:00+00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260726_0001_add_article_search_trgm_indexes"
down_revision: Union[str, None] = "20260711_0002_restore_legacy_baseline_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 幂等：扩展与索引均带 IF NOT EXISTS（开发库已应用过则无副作用）
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_wz_articles_title_trgm '
        'ON wz_articles USING gin (title gin_trgm_ops)'
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_wz_articles_content_trgm '
        'ON wz_articles USING gin (content gin_trgm_ops)'
    )


def downgrade() -> None:
    # 有意保留 pg_trgm 扩展（可能被其他对象依赖，扩展存在本身无副作用）；
    # 仅移除本迁移创建的索引。
    op.execute('DROP INDEX IF EXISTS ix_wz_articles_content_trgm')
    op.execute('DROP INDEX IF EXISTS ix_wz_articles_title_trgm')
