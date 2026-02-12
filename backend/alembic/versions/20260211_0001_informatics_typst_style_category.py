from alembic import op


revision = "20260211_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS inf_typst_styles (
            key VARCHAR(100) PRIMARY KEY,
            title VARCHAR(200) NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_inf_typst_styles_sort ON inf_typst_styles(sort_order);")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS inf_typst_categories (
            id SERIAL PRIMARY KEY,
            path VARCHAR(200) NOT NULL UNIQUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_inf_typst_categories_sort ON inf_typst_categories(sort_order);")

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'inf_typst_notes'
            ) THEN
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS summary VARCHAR(500) NOT NULL DEFAULT '';
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS category_path VARCHAR(200) NOT NULL DEFAULT '';
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS style_key VARCHAR(100) NOT NULL DEFAULT 'my_style';
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS entry_path VARCHAR(200) NOT NULL DEFAULT 'main.typ';
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS files JSONB NOT NULL DEFAULT '{}'::jsonb;
                ALTER TABLE inf_typst_notes ADD COLUMN IF NOT EXISTS toc JSONB NOT NULL DEFAULT '[]'::jsonb;
                CREATE INDEX IF NOT EXISTS idx_inf_typst_notes_published ON inf_typst_notes(published);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS inf_typst_categories;")
    op.execute("DROP TABLE IF EXISTS inf_typst_styles;")

