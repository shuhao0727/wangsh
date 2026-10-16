"""add_core_indexes_for_conversations

Revision ID: 291268877685
Revises: 20260914_0001_xbk_active_selection_unique
Create Date: 2026-10-01 19:12:24.410919

索引以普通（非 CONCURRENTLY）方式在事务内创建，不加 `if_not_exists` 守卫。

为什么不加守卫：本仓库的迁移预检（backend/scripts/check_migration_state.py）
把 `op.create_index` 的任何条件包装与 `if_not_exists` 关键字都判定为
「未审查的控制流」并 fail-closed。预检的存在意义是：升级前先比对真实 schema
与待执行迁移，发现漂移就停下来交给人工核对，而不是让迁移用防御性 DDL 把漂移
悄悄绕过去。因此这里保持无条件创建，漂移由预检负责拦截。

幂等性由 Alembic 自身保证：alembic_version 记录每个 revision 是否已执行，
本迁移不会重复运行，无需靠 if_not_exists 兜底。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '291268877685'
down_revision: Union[str, None] = '20260914_0001_xbk_active_selection_unique'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 会话历史查询优化（最高优先级）
    op.create_index(
        'ix_conversations_session_created',
        'znt_conversations',
        ['session_id', sa.text('created_at DESC'), sa.text('id DESC')],
        unique=False,
    )

    # 2. 深度分析时间范围扫描（部分索引）
    op.execute(
        "CREATE INDEX ix_conversations_agent_time "
        "ON znt_conversations(agent_id, created_at, id) "
        "WHERE content IS NOT NULL AND trim(content) != ''"
    )

    # 3. 小组讨论消息分页
    op.create_index(
        'ix_group_messages_session_created',
        'znt_group_discussion_messages',
        ['session_id', sa.text('created_at DESC')],
        unique=False,
    )

    # 4. 用户会话列表
    op.create_index(
        'ix_conversations_user_agent_time',
        'znt_conversations',
        ['user_id', 'agent_id', sa.text('created_at DESC')],
        unique=False,
    )

    # 5. class_name 过滤优化（部分索引）
    op.execute(
        "CREATE INDEX ix_users_class_name "
        "ON sys_users(class_name) WHERE class_name IS NOT NULL"
    )


def downgrade() -> None:
    # 按创建顺序逆序删除索引
    op.execute("DROP INDEX IF EXISTS ix_users_class_name")
    op.drop_index('ix_conversations_user_agent_time', table_name='znt_conversations', if_exists=True)
    op.drop_index('ix_group_messages_session_created', table_name='znt_group_discussion_messages', if_exists=True)
    op.execute("DROP INDEX IF EXISTS ix_conversations_agent_time")
    op.drop_index('ix_conversations_session_created', table_name='znt_conversations', if_exists=True)
