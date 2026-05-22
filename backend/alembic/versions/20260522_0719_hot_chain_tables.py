"""add hot_question_analyses and student_chain_analyses tables

Revision ID: 20260522_0719_hot_chain_tables
Revises: 20260522_0146_task_analyses
Create Date: 2026-05-22T07:19:08.706057+00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260522_0719_hot_chain_tables'
down_revision: Union[str, None] = '20260522_0146_task_analyses'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'hot_question_analyses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False, server_default='未命名分析'),
        sa.Column('task_sheet', sa.Text(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=True),
        sa.Column('analysis_agent_id', sa.Integer(), nullable=True),
        sa.Column('class_name', sa.String(length=100), nullable=True),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('bucket_seconds', sa.Integer(), nullable=False, server_default='180'),
        sa.Column('teacher_marks', sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column('custom_prompt', sa.Text(), nullable=True),
        sa.Column('result', sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['agent_id'], ['znt_agents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['analysis_agent_id'], ['znt_agents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['sys_users.id'], ondelete='SET NULL'),
        comment='热点问题分析记录表'
    )
    op.create_index('ix_hot_question_analyses_id', 'hot_question_analyses', ['id'])
    op.create_index('ix_hot_question_analyses_agent_id', 'hot_question_analyses', ['agent_id'])

    op.create_table(
        'student_chain_analyses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False, server_default='未命名分析'),
        sa.Column('agent_id', sa.Integer(), nullable=True),
        sa.Column('analysis_agent_id', sa.Integer(), nullable=True),
        sa.Column('class_name', sa.String(length=100), nullable=True),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('task_sheet', sa.Text(), nullable=True),
        sa.Column('result', sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['agent_id'], ['znt_agents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['analysis_agent_id'], ['znt_agents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['sys_users.id'], ondelete='SET NULL'),
        comment='学生问题链分析记录表'
    )
    op.create_index('ix_student_chain_analyses_id', 'student_chain_analyses', ['id'])
    op.create_index('ix_student_chain_analyses_agent_id', 'student_chain_analyses', ['agent_id'])

def downgrade() -> None:
    op.drop_index('ix_student_chain_analyses_agent_id', table_name='student_chain_analyses')
    op.drop_index('ix_student_chain_analyses_id', table_name='student_chain_analyses')
    op.drop_table('student_chain_analyses')
    op.drop_index('ix_hot_question_analyses_agent_id', table_name='hot_question_analyses')
    op.drop_index('ix_hot_question_analyses_id', table_name='hot_question_analyses')
    op.drop_table('hot_question_analyses')
