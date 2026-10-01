"""add_archive_fields_to_conversations_and_analyses

Revision ID: 4a85c94b5c4c
Revises: 291268877685
Create Date: 2026-10-01 19:13:40.593095

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a85c94b5c4c'
down_revision: Union[str, None] = '291268877685'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 为 znt_conversations 添加归档字段
    op.add_column('znt_conversations',
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('znt_conversations',
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))

    # 添加部分索引（优化归档查询）— 只索引未归档的记录
    op.create_index(
        'ix_conversations_archived_time',
        'znt_conversations',
        ['is_archived', 'created_at'],
        postgresql_where=sa.text('is_archived = false')
    )

    # 为 task_analyses 添加归档字段
    op.add_column('task_analyses',
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('task_analyses',
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))

    # 为 hot_question_analyses 添加归档字段
    op.add_column('hot_question_analyses',
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('hot_question_analyses',
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))

    # 为 student_chain_analyses 添加归档字段
    op.add_column('student_chain_analyses',
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('student_chain_analyses',
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # 删除部分索引
    op.drop_index('ix_conversations_archived_time', 'znt_conversations')

    # 删除 znt_conversations 的归档字段
    op.drop_column('znt_conversations', 'archived_at')
    op.drop_column('znt_conversations', 'is_archived')

    # 删除 task_analyses 的归档字段
    op.drop_column('task_analyses', 'archived_at')
    op.drop_column('task_analyses', 'is_archived')

    # 删除 hot_question_analyses 的归档字段
    op.drop_column('hot_question_analyses', 'archived_at')
    op.drop_column('hot_question_analyses', 'is_archived')

    # 删除 student_chain_analyses 的归档字段
    op.drop_column('student_chain_analyses', 'archived_at')
    op.drop_column('student_chain_analyses', 'is_archived')
