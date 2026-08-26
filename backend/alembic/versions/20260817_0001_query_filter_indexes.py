"""add query filter indexes for high-frequency filtered columns (DB-4)

审计 DB-4 确认以下列在查询中高频过滤但模型与迁移均无索引，本迁移补齐：

1. znt_assessment_sessions(status, created_at) 复合索引（低基数状态列 + 排序）
   - 查询证据: session_service.py:886/966/1052/1169/1256；profile_service.py:46/272
2. sys_users.class_name 单列索引
   - 查询证据: session_service.py:892/953/1063；admin.py:384
3. znt_classroom_activities(status, created_at) 复合索引（低基数状态列 + 排序）
   - 查询证据: services/classroom.py:157/225/314/465；classroom_lifecycle.py:27
4. wz_articles.published 单列索引
   - 查询证据: services/articles/article.py:202/216
5. wz_articles.category_id 单列索引
   - 查询证据: services/articles/article.py:204/218
6. wz_articles.author_id 单列索引
   - 查询证据: services/articles/article.py:206/220
7. znt_assessment_configs.grade 单列索引
   - 查询证据: config_service.py:80-81

幂等原则：全部用 CREATE INDEX IF NOT EXISTS，与 20260711_0002 /
20260807_0001 的守卫模式保持一致（部分开发库可能已以手工 SQL 应用过，
索引已存在但 alembic_version 未记录）。status 类按低基数建复合索引，
命名 ix_<table>_<col>_created；单列命名 ix_<table>_<col>。

Revision ID: 20260817_0001_query_filter_indexes
Revises: 20260807_0001_task_analyses_idxs
Create Date: 2026-08-17T00:00:00+00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260817_0001_query_filter_indexes"
down_revision: Union[str, None] = "20260807_0001_task_analyses_idxs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 测评会话：按 status 过滤 + created_at 排序（低基数复合）
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_znt_assessment_sessions_status_created "
        "ON znt_assessment_sessions (status, created_at)"
    )
    # 2. 用户班级：按 class_name 过滤/分组
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sys_users_class_name "
        "ON sys_users (class_name)"
    )
    # 3. 课堂活动：按 status 过滤 + created_at 排序（低基数复合）
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_znt_classroom_activities_status_created "
        "ON znt_classroom_activities (status, created_at)"
    )
    # 4. 文章：按 published 过滤
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wz_articles_published "
        "ON wz_articles (published)"
    )
    # 5. 文章：按 category_id 过滤
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wz_articles_category_id "
        "ON wz_articles (category_id)"
    )
    # 6. 文章：按 author_id 过滤
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wz_articles_author_id "
        "ON wz_articles (author_id)"
    )
    # 7. 测评配置：按 grade 过滤
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_znt_assessment_configs_grade "
        "ON znt_assessment_configs (grade)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_znt_assessment_configs_grade")
    op.execute("DROP INDEX IF EXISTS ix_wz_articles_author_id")
    op.execute("DROP INDEX IF EXISTS ix_wz_articles_category_id")
    op.execute("DROP INDEX IF EXISTS ix_wz_articles_published")
    op.execute("DROP INDEX IF EXISTS ix_znt_classroom_activities_status_created")
    op.execute("DROP INDEX IF EXISTS ix_sys_users_class_name")
    op.execute("DROP INDEX IF EXISTS ix_znt_assessment_sessions_status_created")
