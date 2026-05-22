"""add task_analyses table

Revision ID: 20260522_0146_task_analyses
Revises: fa302846ca5d
Create Date: 2026-05-22T01:46:47.490021
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260522_0146_task_analyses'
down_revision: Union[str, None] = 'fa302846ca5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'task_analyses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False, server_default='未命名分析'),
        sa.Column('task_sheet', sa.Text(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=True),
        sa.Column('class_name', sa.String(length=100), nullable=True),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('result', sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['agent_id'], ['znt_agents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['sys_users.id'], ondelete='SET NULL'),
        comment='任务分析记录表'
    )
    op.create_index(op.f('ix_task_analyses_id'), 'task_analyses', ['id'])

def downgrade() -> None:
    op.drop_index(op.f('ix_task_analyses_id'), table_name='task_analyses')
    op.drop_table('task_analyses')
