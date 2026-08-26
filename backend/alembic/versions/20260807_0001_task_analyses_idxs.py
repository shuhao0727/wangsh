"""add task_analyses indexes and drop assessment subject column

- 建 task_analyses.agent_id 索引（修复主查询按 agent_id 过滤时的全表扫描，对照
  hot_question_analyses / student_chain_analyses 已建 agent_id 索引）。
- 建 task_analyses(agent_id, created_at) 复合索引（支持过滤 + 排序）。
- 删 znt_assessment_configs.subject 死列（模型早已移除，migration 从未删除的反向漂移）。

Revision ID: 20260807_0001_task_analyses_idxs
Revises: 20260726_0001_add_article_search_trgm_indexes
Create Date: 2026-08-07T00:00:00+00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260807_0001_task_analyses_idxs"
down_revision: Union[str, None] = "20260726_0001_add_article_search_trgm_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 幂等原则：部分开发库可能已以手工 SQL 应用过（索引已存在但
    # alembic_version 未记录），因此索引全部用 IF NOT EXISTS，与
    # 20260711_0002 / 20260430_migrate_dev_schema 的守卫模式保持一致。
    # 1. task_analyses.agent_id 单列索引（主查询过滤键；与复合索引并存：
    #    单列索引服务不带 created_at 排序约束的纯过滤查询与规划器选择）
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_task_analyses_agent_id "
        "ON task_analyses (agent_id)"
    )
    # 2. (agent_id, created_at) 复合索引（过滤 + 排序，主查询使用）
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_task_analyses_agent_created "
        "ON task_analyses (agent_id, created_at)"
    )
    # 3. 删死列（模型已无 subject；用 IF EXISTS 幂等，跨环境安全）
    op.execute(
        "ALTER TABLE znt_assessment_configs DROP COLUMN IF EXISTS subject"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE znt_assessment_configs ADD COLUMN IF NOT EXISTS "
        "subject VARCHAR(100)"
    )
    op.execute("DROP INDEX IF EXISTS ix_task_analyses_agent_created")
    op.execute("DROP INDEX IF EXISTS ix_task_analyses_agent_id")
