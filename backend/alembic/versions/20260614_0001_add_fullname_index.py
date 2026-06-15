"""add index on sys_users.full_name for login performance

当60个学生同时登录时，WHERE full_name = ? 查询会走全表扫描，
添加索引后走索引查找，消除性能瓶颈。

Revision ID: 20260614_0001_add_fullname_index
Revises: 20260529_0001_agent_analysis_prompt_templates
Create Date: 2026-06-14T00:00:00+00:00

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260614_0001_add_fullname_index"
down_revision: Union[str, None] = "20260529_0001_agent_analysis_prompt_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 为学生按姓名登录添加索引，解决并发登录时的全表扫描问题
    # 注意：如果在生产环境需要零停机，可手动执行：
    #   CREATE INDEX CONCURRENTLY ix_sys_users_full_name ON sys_users (full_name);
    # CONCURRENTLY 不能在事务内执行，而 Alembic 默认使用事务包装迁移
    op.create_index("ix_sys_users_full_name", "sys_users", ["full_name"])


def downgrade() -> None:
    op.drop_index("ix_sys_users_full_name", table_name="sys_users")
