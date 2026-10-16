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
                WHERE table_schema = current_schema() AND table_name = 'znt_group_discussion_sessions'
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
                WHERE table_schema = current_schema() AND table_name = 'znt_group_discussion_analyses'
            ) THEN
                ALTER TABLE znt_group_discussion_analyses ADD COLUMN IF NOT EXISTS compare_session_ids TEXT;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = current_schema() AND table_name = 'znt_agents'
            ) THEN
                ALTER TABLE znt_agents ADD COLUMN IF NOT EXISTS description TEXT;
            END IF;

            -- 旧库可能已有不同列序及独立 owner/ACL/comment 的视图。
            -- 本历史 revision 不重建任何已有对象，否则后续 forward 迁移
            -- 无法恢复这里已经丢失的元信息。最终定义与元信息保全由
            -- f1a2b3c4d5e6 在单事务中负责，startup 不执行 DDL 兜底。
            -- 空库的归档列由后续 revision 添加；全部投影依赖就绪才创建。
            IF NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_class AS existing
                JOIN pg_catalog.pg_namespace AS namespace
                  ON namespace.oid = existing.relnamespace
                WHERE namespace.nspname = current_schema()
                  AND existing.relname = 'v_conversations_with_deleted'
            ) AND NOT EXISTS (
                SELECT 1
                FROM (VALUES
                    ('znt_conversations', 'id'),
                    ('znt_conversations', 'user_id'),
                    ('znt_conversations', 'user_name'),
                    ('znt_conversations', 'agent_id'),
                    ('znt_conversations', 'agent_name'),
                    ('znt_conversations', 'session_id'),
                    ('znt_conversations', 'message_type'),
                    ('znt_conversations', 'content'),
                    ('znt_conversations', 'response_time_ms'),
                    ('znt_conversations', 'created_at'),
                    ('znt_conversations', 'is_archived'),
                    ('znt_conversations', 'archived_at'),
                    ('sys_users', 'id'),
                    ('sys_users', 'full_name'),
                    ('sys_users', 'is_deleted'),
                    ('znt_agents', 'id'),
                    ('znt_agents', 'name'),
                    ('znt_agents', 'is_deleted')
                ) AS required(table_name, column_name)
                WHERE NOT EXISTS (
                    SELECT 1 FROM information_schema.columns AS present
                    WHERE present.table_schema = current_schema()
                      AND present.table_name = required.table_name
                      AND present.column_name = required.column_name
                )
            ) THEN
                CREATE VIEW v_conversations_with_deleted AS
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
                    c.is_archived,
                    c.archived_at,
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

