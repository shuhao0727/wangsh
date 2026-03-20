"""add_classroom_interaction_tables

Revision ID: 78ef5c1ccb1d
Revises: 20260318_0001
Create Date: 2026-03-20 10:46:42.674465

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '78ef5c1ccb1d'
down_revision: Union[str, None] = '20260318_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('znt_classroom_activities'):
        op.create_table(
            'znt_classroom_activities',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('activity_type', sa.String(length=20), nullable=False, comment='活动类型: vote/fill_blank'),
            sa.Column('title', sa.String(length=200), nullable=False, comment='活动标题'),
            sa.Column('options', sa.JSON(), nullable=True, comment='投票选项'),
            sa.Column('correct_answer', sa.String(length=500), nullable=True, comment='正确答案'),
            sa.Column('allow_multiple', sa.Boolean(), nullable=False, server_default='false', comment='是否多选投票'),
            sa.Column('time_limit', sa.Integer(), nullable=False, server_default='60', comment='时间限制(秒)'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='draft', comment='状态'),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('sys_users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            comment='课堂互动活动表',
        )
    op.execute('CREATE INDEX IF NOT EXISTS ix_znt_classroom_activities_id ON znt_classroom_activities (id);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_znt_classroom_activities_created_by ON znt_classroom_activities (created_by);')

    if not inspector.has_table('znt_classroom_responses'):
        op.create_table(
            'znt_classroom_responses',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('activity_id', sa.Integer(), sa.ForeignKey('znt_classroom_activities.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('sys_users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('answer', sa.String(length=500), nullable=False, comment='学生答案'),
            sa.Column('is_correct', sa.Boolean(), nullable=True, comment='是否正确'),
            sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('activity_id', 'user_id', name='uq_classroom_response_activity_user'),
            comment='课堂互动学生响应表',
        )
    op.execute('CREATE INDEX IF NOT EXISTS ix_znt_classroom_responses_id ON znt_classroom_responses (id);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_znt_classroom_responses_activity_id ON znt_classroom_responses (activity_id);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_znt_classroom_responses_user_id ON znt_classroom_responses (user_id);')


def downgrade() -> None:
    op.drop_table('znt_classroom_responses')
    op.drop_table('znt_classroom_activities')
