"""add_core_indexes_for_conversations

Revision ID: 291268877685
Revises: 20260914_0001_xbk_active_selection_unique
Create Date: 2026-10-01 19:12:24.410919

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
    # 注意：生产环境建议使用 CONCURRENTLY 避免锁表
    # 但 CONCURRENTLY 不能在 Alembic 事务中使用，需手动执行

    # 1. 会话历史查询优化（最高优先级）
    op.create_index(
        'ix_conversations_session_created',
        'znt_conversations',
        ['session_id', sa.text('created_at DESC'), sa.text('id DESC')],
        unique=False,
        if_not_exists=True
    )

    # 2. 深度分析时间范围扫描（部分索引）
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_conversations_agent_time "
        "ON znt_conversations(agent_id, created_at, id) "
        "WHERE content IS NOT NULL AND trim(content) != ''"
    )

    # 3. 小组讨论消息分页
    op.create_index(
        'ix_group_messages_session_created',
        'znt_group_discussion_messages',
        ['session_id', sa.text('created_at DESC')],
        unique=False,
        if_not_exists=True
    )

    # 4. 用户会话列表
    op.create_index(
        'ix_conversations_user_agent_time',
        'znt_conversations',
        ['user_id', 'agent_id', sa.text('created_at DESC')],
        unique=False,
        if_not_exists=True
    )

    # 5. class_name 过滤优化（部分索引）
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_class_name "
        "ON sys_users(class_name) WHERE class_name IS NOT NULL"
    )


def downgrade() -> None:
    # 按创建顺序逆序删除索引
    op.execute("DROP INDEX IF EXISTS ix_users_class_name")
    op.drop_index('ix_conversations_user_agent_time', table_name='znt_conversations', if_exists=True)
    op.drop_index('ix_group_messages_session_created', table_name='znt_group_discussion_messages', if_exists=True)
    op.execute("DROP INDEX IF EXISTS ix_conversations_agent_time")
    op.drop_index('ix_conversations_session_created', table_name='znt_conversations', if_exists=True)
