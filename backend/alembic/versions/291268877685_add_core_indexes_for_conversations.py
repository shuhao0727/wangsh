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
    # 1. 会话历史查询优化（最高优先级）
    # 优化: GET /api/conversations/session/{session_id} 按会话查询对话历史
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_conversations_session_created "
        "ON znt_conversations(session_id, created_at DESC, id DESC)"
    )

    # 2. 深度分析时间范围扫描
    # 优化: 热点分析等功能需要按 agent 和时间范围扫描有效内容
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_conversations_agent_time "
        "ON znt_conversations(agent_id, created_at, id) "
        "WHERE content IS NOT NULL AND trim(content) != ''"
    )

    # 3. 小组讨论消息分页
    # 优化: GET /api/group_discussions/sessions/{session_id}/messages 消息列表查询
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_group_messages_session_created "
        "ON znt_group_discussion_messages(session_id, created_at DESC)"
    )

    # 4. 用户会话列表
    # 优化: GET /api/conversations/sessions 按用户和 agent 筛选会话
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_conversations_user_agent_time "
        "ON znt_conversations(user_id, agent_id, created_at DESC)"
    )

    # 5. class_name 过滤优化
    # 优化: 后台管理按班级筛选用户列表
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_class_name "
        "ON sys_users(class_name) WHERE class_name IS NOT NULL"
    )


def downgrade() -> None:
    # 按创建顺序逆序删除索引
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_users_class_name")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_conversations_user_agent_time")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_group_messages_session_created")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_conversations_agent_time")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_conversations_session_created")
