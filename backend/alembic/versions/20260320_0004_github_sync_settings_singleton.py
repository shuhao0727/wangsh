"""enforce singleton for github sync settings

Revision ID: 20260320_0004
Revises: 20260320_0003
Create Date: 2026-03-20 19:40:00
"""

from alembic import op


revision = "20260320_0004"
down_revision = "20260320_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id DESC) AS rn
            FROM inf_github_sync_settings
        )
        DELETE FROM inf_github_sync_settings s
        USING ranked r
        WHERE s.id = r.id AND r.rn > 1;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_inf_github_sync_settings_singleton
        ON inf_github_sync_settings ((1));
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_inf_github_sync_settings_singleton;")
