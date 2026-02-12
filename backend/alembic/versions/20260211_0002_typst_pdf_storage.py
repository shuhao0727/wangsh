from alembic import op


revision = "20260211_0002"
down_revision = "20260211_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'inf_typst_notes'
            ) THEN
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS compiled_pdf_path VARCHAR(500);
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS compiled_pdf_size INTEGER;
                EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inf_typst_notes_compiled_hash ON inf_typst_notes(compiled_hash);';
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_inf_typst_notes_compiled_hash;")
    op.execute("ALTER TABLE IF EXISTS inf_typst_notes DROP COLUMN IF EXISTS compiled_pdf_path;")
    op.execute("ALTER TABLE IF EXISTS inf_typst_notes DROP COLUMN IF EXISTS compiled_pdf_size;")
