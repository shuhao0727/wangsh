from alembic import op


revision = "20260211_0003"
down_revision = "20260211_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'inf_typst_assets'
            ) THEN
                ALTER TABLE inf_typst_assets ADD COLUMN IF NOT EXISTS sha256 VARCHAR(64);
                ALTER TABLE inf_typst_assets ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
                ALTER TABLE inf_typst_assets ADD COLUMN IF NOT EXISTS uploaded_by_id INTEGER;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'inf_typst_assets'
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'inf_typst_assets_uploaded_by_id_fkey'
                ) THEN
                    ALTER TABLE inf_typst_assets
                    ADD CONSTRAINT inf_typst_assets_uploaded_by_id_fkey
                    FOREIGN KEY (uploaded_by_id) REFERENCES sys_users(id);
                END IF;
            END IF;
        END $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_inf_typst_assets_note_id_path ON inf_typst_assets(note_id, path);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inf_typst_assets_sha256 ON inf_typst_assets(sha256);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_inf_typst_assets_sha256;")
    op.execute("DROP INDEX IF EXISTS idx_inf_typst_assets_note_id_path;")
    op.execute("ALTER TABLE IF EXISTS inf_typst_assets DROP CONSTRAINT IF EXISTS inf_typst_assets_uploaded_by_id_fkey;")
    op.execute("ALTER TABLE IF EXISTS inf_typst_assets DROP COLUMN IF EXISTS uploaded_by_id;")
    op.execute("ALTER TABLE IF EXISTS inf_typst_assets DROP COLUMN IF EXISTS size_bytes;")
    op.execute("ALTER TABLE IF EXISTS inf_typst_assets DROP COLUMN IF EXISTS sha256;")

