-- 数据库性能优化：添加缺失的索引
-- 根据性能分析报告生成的索引优化脚本

BEGIN;

-- 1. GroupDiscussionSession 表优化
-- created_at 是常用查询字段，经常用于排序和分页
CREATE INDEX IF NOT EXISTS idx_znt_group_discussion_sessions_created_at
ON znt_group_discussion_sessions(created_at DESC);

-- 2. ClassroomActivity 表优化
-- status 是常用查询字段，经常用于筛选
CREATE INDEX IF NOT EXISTS idx_znt_classroom_activities_status
ON znt_classroom_activities(status);

-- analysis_agent_id 是外键，需要索引以优化连接查询
CREATE INDEX IF NOT EXISTS idx_znt_classroom_activities_analysis_agent_id
ON znt_classroom_activities(analysis_agent_id);

-- created_at 和 updated_at 是常用查询字段
CREATE INDEX IF NOT EXISTS idx_znt_classroom_activities_created_at
ON znt_classroom_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_znt_classroom_activities_updated_at
ON znt_classroom_activities(updated_at DESC);

-- 复合索引：经常一起查询的字段组合
-- 例如：按状态和创建时间查询
CREATE INDEX IF NOT EXISTS idx_znt_classroom_activities_status_created_at
ON znt_classroom_activities(status, created_at DESC);

-- 3. ClassroomResponse 表优化
-- is_correct 是布尔字段，选择性较低，但如果是高频查询可以考虑索引
-- 注意：布尔字段索引效果有限，只有当数据分布不均匀时才有效
-- 这里先不创建，但保留注释供参考
-- CREATE INDEX IF NOT EXISTS idx_znt_classroom_responses_is_correct
-- ON znt_classroom_responses(is_correct);

-- 4. InformaticsGithubSyncRun 表优化
-- status 是常用查询字段
CREATE INDEX IF NOT EXISTS idx_inf_github_sync_runs_status
ON inf_github_sync_runs(status);

-- 复合索引：按状态和创建时间查询（常见的管理界面查询）
CREATE INDEX IF NOT EXISTS idx_inf_github_sync_runs_status_created_at
ON inf_github_sync_runs(status, created_at DESC);

-- 5. InformaticsGithubSyncSetting 表优化
-- created_at 和 updated_at 是常用查询字段
CREATE INDEX IF NOT EXISTS idx_inf_github_sync_settings_created_at
ON inf_github_sync_settings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inf_github_sync_settings_updated_at
ON inf_github_sync_settings(updated_at DESC);

-- 6. InformaticsGithubSyncSource 表优化
-- note_id 是外键，需要索引
CREATE INDEX IF NOT EXISTS idx_inf_github_sync_sources_note_id
ON inf_github_sync_sources(note_id);

-- created_at 和 updated_at 是常用查询字段
CREATE INDEX IF NOT EXISTS idx_inf_github_sync_sources_created_at
ON inf_github_sync_sources(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inf_github_sync_sources_updated_at
ON inf_github_sync_sources(updated_at DESC);

-- 7. 其他可能需要的索引（基于常见查询模式）

-- Article 表：按分类和发布时间查询（常见的前端查询）
CREATE INDEX IF NOT EXISTS idx_wz_articles_category_published_created
ON wz_articles(category_id, published, created_at DESC)
WHERE published = true;

-- Article 表：按作者和发布时间查询（管理界面）
CREATE INDEX IF NOT EXISTS idx_wz_articles_author_created
ON wz_articles(author_id, created_at DESC);

-- User 表：按角色和活跃状态查询（管理界面）
CREATE INDEX IF NOT EXISTS idx_sys_users_role_active
ON sys_users(role_code, is_active);

-- Conversation 表：按用户和创建时间查询（聊天历史）
CREATE INDEX IF NOT EXISTS idx_znt_conversations_user_created
ON znt_conversations(user_id, created_at DESC);

-- Conversation 表：按智能体和创建时间查询（分析查询）
CREATE INDEX IF NOT EXISTS idx_znt_conversations_agent_created
ON znt_conversations(agent_id, created_at DESC);

-- 8. 复合索引优化建议（根据实际查询模式调整）

-- 对于经常一起查询的字段组合，创建复合索引
-- 例如：SELECT * FROM table WHERE field1 = ? AND field2 = ? ORDER BY created_at DESC

-- 对于经常用于排序的字段，确保索引方向与ORDER BY一致
-- 例如：ORDER BY created_at DESC 对应索引 (created_at DESC)

-- 对于范围查询，将范围查询字段放在索引最后
-- 例如：WHERE status = 'active' AND created_at > ? 对应索引 (status, created_at)

COMMIT;

-- 索引创建后的维护建议：
-- 1. 定期运行 ANALYZE 更新统计信息
-- 2. 监控索引使用情况，删除未使用的索引
-- 3. 对于大表，考虑使用并行索引创建
-- 4. 定期重建碎片化的索引

-- 查看索引使用情况的查询：
-- SELECT schemaname, tablename, indexname, idx_scan
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;

-- 查看未使用的索引：
-- SELECT schemaname, tablename, indexname
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0;