"""classroom activity auto analysis fields

Revision ID: 20260320_0002
Revises: 78ef5c1ccb1d
Create Date: 2026-03-20 12:00:00
"""

from alembic import op


revision = "20260320_0002"
down_revision = "78ef5c1ccb1d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE znt_classroom_activities ADD COLUMN IF NOT EXISTS analysis_agent_id INTEGER;")
    op.execute("ALTER TABLE znt_classroom_activities ADD COLUMN IF NOT EXISTS analysis_prompt TEXT;")
    op.execute("ALTER TABLE znt_classroom_activities ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(20);")
    op.execute("ALTER TABLE znt_classroom_activities ADD COLUMN IF NOT EXISTS analysis_result TEXT;")
    op.execute("ALTER TABLE znt_classroom_activities ADD COLUMN IF NOT EXISTS analysis_context JSON;")
    op.execute("ALTER TABLE znt_classroom_activities ADD COLUMN IF NOT EXISTS analysis_error TEXT;")
    op.execute("ALTER TABLE znt_classroom_activities ADD COLUMN IF NOT EXISTS analysis_updated_at TIMESTAMP WITH TIME ZONE;")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_znt_classroom_activities_analysis_agent_id'
            ) THEN
                ALTER TABLE znt_classroom_activities
                ADD CONSTRAINT fk_znt_classroom_activities_analysis_agent_id
                FOREIGN KEY (analysis_agent_id) REFERENCES znt_agents(id) ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE znt_classroom_activities DROP CONSTRAINT IF EXISTS fk_znt_classroom_activities_analysis_agent_id;")
    op.execute("ALTER TABLE znt_classroom_activities DROP COLUMN IF EXISTS analysis_updated_at;")
    op.execute("ALTER TABLE znt_classroom_activities DROP COLUMN IF EXISTS analysis_error;")
    op.execute("ALTER TABLE znt_classroom_activities DROP COLUMN IF EXISTS analysis_context;")
    op.execute("ALTER TABLE znt_classroom_activities DROP COLUMN IF EXISTS analysis_result;")
    op.execute("ALTER TABLE znt_classroom_activities DROP COLUMN IF EXISTS analysis_status;")
    op.execute("ALTER TABLE znt_classroom_activities DROP COLUMN IF EXISTS analysis_prompt;")
    op.execute("ALTER TABLE znt_classroom_activities DROP COLUMN IF EXISTS analysis_agent_id;")
