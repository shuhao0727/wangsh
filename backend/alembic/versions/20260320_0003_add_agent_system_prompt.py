"""ensure znt_agents.system_prompt exists

Revision ID: 20260320_0003
Revises: 20260320_0002
Create Date: 2026-03-20 18:00:00
"""

from alembic import op


revision = "20260320_0003"
down_revision = "20260320_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE znt_agents ADD COLUMN IF NOT EXISTS system_prompt TEXT;")


def downgrade() -> None:
    op.execute("ALTER TABLE znt_agents DROP COLUMN IF EXISTS system_prompt;")
