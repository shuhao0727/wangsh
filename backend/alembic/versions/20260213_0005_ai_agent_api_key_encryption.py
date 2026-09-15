from alembic import op
import sqlalchemy as sa


revision = "20260213_0005"
down_revision = "20260211_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = current_schema() AND table_name = 'znt_agents'
            ) THEN
                ALTER TABLE znt_agents ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;
                ALTER TABLE znt_agents ADD COLUMN IF NOT EXISTS api_key_last4 VARCHAR(8);
                ALTER TABLE znt_agents ADD COLUMN IF NOT EXISTS has_api_key BOOLEAN NOT NULL DEFAULT FALSE;

                UPDATE znt_agents
                SET has_api_key = TRUE
                WHERE api_key IS NOT NULL AND api_key <> '';
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = current_schema() AND table_name = 'znt_agents'
            ) THEN
                ALTER TABLE znt_agents DROP COLUMN IF EXISTS has_api_key;
                ALTER TABLE znt_agents DROP COLUMN IF EXISTS api_key_last4;
                ALTER TABLE znt_agents DROP COLUMN IF EXISTS api_key_encrypted;
            END IF;
        END $$;
        """
    )
