"""add_gdpr_compliance_tables

Revision ID: 2de7995a8f24
Revises: 4a85c94b5c4c
Create Date: 2026-10-01 21:02:27.836377

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2de7995a8f24'
down_revision: Union[str, None] = '4a85c94b5c4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 创建审计日志表
    op.create_table(
        'sys_audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='主键'),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='用户 ID'),
        sa.Column('action', sa.String(length=50), nullable=False, comment='操作类型: EXPORT_DATA, DELETE_DATA, VIEW_CONVERSATION, etc.'),
        sa.Column('resource_type', sa.String(length=50), nullable=True, comment='资源类型: conversation, analysis, user, etc.'),
        sa.Column('resource_id', sa.String(length=100), nullable=True, comment='资源 ID'),
        sa.Column('ip_address', sa.String(length=45), nullable=True, comment='IP 地址（支持 IPv4 和 IPv6）'),
        sa.Column('user_agent', sa.Text(), nullable=True, comment='用户代理字符串'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='创建时间'),
        sa.PrimaryKeyConstraint('id'),
        comment='审计日志表（GDPR 合规）'
    )
    op.create_index('ix_sys_audit_logs_user_id', 'sys_audit_logs', ['user_id'])
    op.create_index('ix_sys_audit_logs_action', 'sys_audit_logs', ['action'])
    op.create_index('ix_sys_audit_logs_created_at', 'sys_audit_logs', ['created_at'])
    op.create_index(op.f('ix_sys_audit_logs_id'), 'sys_audit_logs', ['id'], unique=False)

    # 创建用户同意记录表
    op.create_table(
        'sys_user_consents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='主键'),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='用户 ID'),
        sa.Column('consent_type', sa.String(length=50), nullable=False, comment='同意类型: AI_USAGE, DATA_ANALYSIS, MARKETING, etc.'),
        sa.Column('consented', sa.Boolean(), nullable=False, comment='是否同意'),
        sa.Column('consented_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='同意/拒绝时间'),
        sa.Column('ip_address', sa.String(length=45), nullable=True, comment='IP 地址'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='更新时间'),
        sa.PrimaryKeyConstraint('id'),
        comment='用户同意记录表（GDPR 合规）'
    )
    op.create_index('ix_sys_user_consents_user_id', 'sys_user_consents', ['user_id'])
    op.create_index('ix_sys_user_consents_consent_type', 'sys_user_consents', ['consent_type'])
    op.create_index('ix_sys_user_consents_user_consent', 'sys_user_consents', ['user_id', 'consent_type'])
    op.create_index(op.f('ix_sys_user_consents_id'), 'sys_user_consents', ['id'], unique=False)


def downgrade() -> None:
    # 删除用户同意记录表
    op.drop_index(op.f('ix_sys_user_consents_id'), table_name='sys_user_consents')
    op.drop_index('ix_sys_user_consents_user_consent', table_name='sys_user_consents')
    op.drop_index('ix_sys_user_consents_consent_type', table_name='sys_user_consents')
    op.drop_index('ix_sys_user_consents_user_id', table_name='sys_user_consents')
    op.drop_table('sys_user_consents')

    # 删除审计日志表
    op.drop_index(op.f('ix_sys_audit_logs_id'), table_name='sys_audit_logs')
    op.drop_index('ix_sys_audit_logs_created_at', table_name='sys_audit_logs')
    op.drop_index('ix_sys_audit_logs_action', table_name='sys_audit_logs')
    op.drop_index('ix_sys_audit_logs_user_id', table_name='sys_audit_logs')
    op.drop_table('sys_audit_logs')
