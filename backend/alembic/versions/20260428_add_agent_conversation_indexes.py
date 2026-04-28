"""add agent conversation compound indexes

Revision ID: 20260428_agent_idx
Revises: 20260325_xbk_idx
Create Date: 2026-04-28

"""
from alembic import op

revision = '20260428_agent_idx'
down_revision = '20260325_xbk_idx'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        'idx_znt_conv_agent_type_created',
        'znt_conversations',
        ['agent_id', 'message_type', 'created_at'],
        unique=False,
    )
    op.create_index(
        'idx_znt_conv_session_created',
        'znt_conversations',
        ['session_id', 'created_at'],
        unique=False,
    )


def downgrade():
    op.drop_index('idx_znt_conv_session_created', table_name='znt_conversations')
    op.drop_index('idx_znt_conv_agent_type_created', table_name='znt_conversations')
