BEGIN;

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

ALTER TABLE IF EXISTS inf_typst_notes
  ADD COLUMN IF NOT EXISTS compiled_hash VARCHAR(64);

ALTER TABLE IF EXISTS inf_typst_notes
  ADD COLUMN IF NOT EXISTS compiled_pdf BYTEA;

ALTER TABLE IF EXISTS inf_typst_notes
  ADD COLUMN IF NOT EXISTS compiled_pdf_path VARCHAR(500);

ALTER TABLE IF EXISTS inf_typst_notes
  ADD COLUMN IF NOT EXISTS compiled_pdf_size INTEGER;

ALTER TABLE IF EXISTS inf_typst_notes
  ADD COLUMN IF NOT EXISTS compiled_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS xbk_selections
  ADD COLUMN IF NOT EXISTS grade VARCHAR(20);

COMMIT;
