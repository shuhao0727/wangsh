from alembic import op


revision = "20260211_0004"
down_revision = "20260211_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'znt_group_discussion_sessions'
            ) THEN
                ALTER TABLE znt_group_discussion_sessions ADD COLUMN IF NOT EXISTS class_name VARCHAR(64);
                ALTER TABLE znt_group_discussion_sessions ADD COLUMN IF NOT EXISTS group_name VARCHAR(64);
                UPDATE znt_group_discussion_sessions SET class_name='未知班级' WHERE class_name IS NULL;
                BEGIN
                    ALTER TABLE znt_group_discussion_sessions ALTER COLUMN class_name SET NOT NULL;
                EXCEPTION
                    WHEN undefined_column THEN NULL;
                END;

                ALTER TABLE znt_group_discussion_sessions DROP CONSTRAINT IF EXISTS uq_znt_group_discussion_sessions_date_group;

                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_znt_group_discussion_sessions_date_class_group') THEN
                    BEGIN
                        DROP INDEX IF EXISTS uq_znt_group_discussion_sessions_date_class_group;
                        ALTER TABLE znt_group_discussion_sessions
                            ADD CONSTRAINT uq_znt_group_discussion_sessions_date_class_group
                            UNIQUE (session_date, class_name, group_no);
                    EXCEPTION
                        WHEN duplicate_object THEN NULL;
                        WHEN duplicate_table THEN NULL;
                        WHEN unique_violation THEN NULL;
                    END;
                END IF;

                CREATE INDEX IF NOT EXISTS idx_znt_group_discussion_sessions_class_name ON znt_group_discussion_sessions(class_name);
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'znt_group_discussion_analyses'
            ) THEN
                ALTER TABLE znt_group_discussion_analyses ADD COLUMN IF NOT EXISTS compare_session_ids TEXT;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'znt_agents'
            ) THEN
                ALTER TABLE znt_agents ADD COLUMN IF NOT EXISTS description TEXT;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'znt_conversations'
            ) THEN
                CREATE OR REPLACE VIEW v_conversations_with_deleted AS
                SELECT
                    c.id,
                    c.user_id,
                    COALESCE(c.user_name, u.full_name, '未知用户') AS display_user_name,
                    c.agent_id,
                    COALESCE(c.agent_name, a.name, '未知智能体') AS display_agent_name,
                    c.session_id,
                    c.message_type,
                    c.content,
                    c.response_time_ms,
                    c.created_at,
                    CASE
                        WHEN u.id IS NULL OR u.is_deleted = true THEN true
                        ELSE false
                    END AS is_user_deleted,
                    CASE
                        WHEN a.id IS NULL OR a.is_deleted = true THEN true
                        ELSE false
                    END AS is_agent_deleted
                FROM znt_conversations c
                LEFT JOIN sys_users u ON c.user_id = u.id
                LEFT JOIN znt_agents a ON c.agent_id = a.id;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_conversations_with_deleted;")
    op.execute("DROP INDEX IF EXISTS idx_znt_group_discussion_sessions_class_name;")
    op.execute("ALTER TABLE IF EXISTS znt_agents DROP COLUMN IF EXISTS description;")
    op.execute("ALTER TABLE IF EXISTS znt_group_discussion_analyses DROP COLUMN IF EXISTS compare_session_ids;")
    op.execute("ALTER TABLE IF EXISTS znt_group_discussion_sessions DROP CONSTRAINT IF EXISTS uq_znt_group_discussion_sessions_date_class_group;")
    op.execute("ALTER TABLE IF EXISTS znt_group_discussion_sessions DROP COLUMN IF EXISTS group_name;")
    op.execute("ALTER TABLE IF EXISTS znt_group_discussion_sessions DROP COLUMN IF EXISTS class_name;")

