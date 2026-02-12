-- 将 xbk_courses.quota_by_class(JSONB) 迁移为 quota(INTEGER)
-- 适用：已存在旧字段 quota_by_class 的数据库
-- 说明：若 JSONB 中存在 default，则取 default；否则取所有值中的最大值；为空则置 0

BEGIN;

ALTER TABLE IF EXISTS xbk_courses
  ADD COLUMN IF NOT EXISTS quota INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'xbk_courses' AND column_name = 'quota_by_class'
  ) THEN
    UPDATE xbk_courses
    SET quota = COALESCE(
      NULLIF((quota_by_class->>'default')::int, 0),
      (
        SELECT COALESCE(MAX((value)::int), 0)
        FROM jsonb_each_text(quota_by_class)
      ),
      0
    )
    WHERE quota IS NULL;
  END IF;
END $$;

ALTER TABLE xbk_courses
  ALTER COLUMN quota SET DEFAULT 0;

UPDATE xbk_courses SET quota = 0 WHERE quota IS NULL;

ALTER TABLE xbk_courses
  ALTER COLUMN quota SET NOT NULL;

ALTER TABLE IF EXISTS xbk_courses
  DROP COLUMN IF EXISTS quota_by_class;

COMMIT;

