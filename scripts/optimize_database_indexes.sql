-- WangSh 数据库索引优化脚本
-- 执行前请备份数据库

-- ============================================
-- 1. 分析现有索引
-- ============================================

-- 查看所有表的索引信息
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 查看索引使用情况
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,  -- 索引扫描次数
    idx_tup_read,  -- 通过索引读取的元组数
    idx_tup_fetch  -- 通过索引获取的元组数
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- ============================================
-- 2. 添加缺失的索引
-- ============================================

-- 2.1 znt_group_discussion_sessions 表
-- 按日期和班级查询频繁
CREATE INDEX IF NOT EXISTS idx_sessions_date_class
ON znt_group_discussion_sessions(session_date, class_name);

-- 按创建时间排序
CREATE INDEX IF NOT EXISTS idx_sessions_created
ON znt_group_discussion_sessions(created_at DESC);

-- 2.2 znt_group_discussion_messages 表
-- 按会话和时间查询
CREATE INDEX IF NOT EXISTS idx_messages_session_created
ON znt_group_discussion_messages(session_id, created_at);

-- 按用户查询
CREATE INDEX IF NOT EXISTS idx_messages_user
ON znt_group_discussion_messages(user_id);

-- 2.3 znt_conversations 表
-- 按用户和时间查询（用于跨系统分析）
CREATE INDEX IF NOT EXISTS idx_conversations_user_created
ON znt_conversations(user_id, created_at DESC);

-- 按消息类型查询
CREATE INDEX IF NOT EXISTS idx_conversations_type
ON znt_conversations(message_type);

-- 2.4 znt_assessment_sessions 表
-- 按用户和状态查询
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_status
ON znt_assessment_sessions(user_id, status);

-- 按创建时间查询
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_created
ON znt_assessment_sessions(created_at DESC);

-- 2.5 znt_assessment_attempts 表
-- 按会话和题目查询
CREATE INDEX IF NOT EXISTS idx_attempts_session_question
ON znt_assessment_attempts(session_id, question_id);

-- 按创建时间查询
CREATE INDEX IF NOT EXISTS idx_attempts_created
ON znt_assessment_attempts(created_at);

-- 2.6 znt_classroom_plans 表
-- 按用户查询
CREATE INDEX IF NOT EXISTS idx_classroom_plans_user
ON znt_classroom_plans(user_id);

-- 按状态查询
CREATE INDEX IF NOT EXISTS idx_classroom_plans_status
ON znt_classroom_plans(status);

-- 2.7 znt_articles 表
-- 按分类查询
CREATE INDEX IF NOT EXISTS idx_articles_category
ON znt_articles(category_id);

-- 按状态和发布时间查询
CREATE INDEX IF NOT EXISTS idx_articles_status_published
ON znt_articles(status, published_at DESC);

-- ============================================
-- 3. 优化现有索引
-- ============================================

-- 3.1 检查重复索引
-- 运行以下查询找出可能重复的索引
SELECT
    indrelid::regclass AS table_name,
    array_agg(indexrelid::regclass) AS indexes,
    array_agg(indkey) AS index_keys
FROM pg_index
WHERE indrelid IN (
    SELECT oid FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
)
GROUP BY indrelid, indkey
HAVING COUNT(*) > 1;

-- 3.2 检查未使用的索引（扫描次数为0）
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename, indexname;

-- ============================================
-- 4. 分析查询性能
-- ============================================

-- 4.1 启用慢查询日志（需要在 postgresql.conf 中配置）
-- log_min_duration_statement = 1000  -- 记录执行时间超过1秒的查询

-- 4.2 查看当前活跃的慢查询
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
  AND state = 'active'
ORDER BY duration DESC;

-- 4.3 查看锁等待
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.query AS blocked_query,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- ============================================
-- 5. 维护建议
-- ============================================

-- 5.1 定期分析表（更新统计信息）
ANALYZE VERBOSE;

-- 5.2 重建索引（在维护窗口执行）
-- REINDEX TABLE znt_group_discussion_sessions;
-- REINDEX TABLE znt_group_discussion_messages;
-- REINDEX TABLE znt_conversations;

-- 5.3 清理膨胀（autovacuum 通常会自动处理）
VACUUM ANALYZE;

-- ============================================
-- 6. 监控查询
-- ============================================

-- 6.1 创建查询性能监控视图
CREATE OR REPLACE VIEW query_performance_monitor AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows,
    shared_blks_hit,
    shared_blks_read
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;

-- 6.2 查看最耗时的查询
SELECT * FROM query_performance_monitor;

-- ============================================
-- 7. 执行计划分析示例
-- ============================================

-- 7.1 分析小组讨论查询
EXPLAIN ANALYZE
SELECT *
FROM znt_group_discussion_sessions
WHERE session_date = '2024-01-01'
  AND class_name = '测试班'
ORDER BY created_at DESC
LIMIT 10;

-- 7.2 分析消息查询
EXPLAIN ANALYZE
SELECT *
FROM znt_group_discussion_messages
WHERE session_id = 1
ORDER BY created_at ASC
LIMIT 100;

-- 7.3 分析跨系统查询
EXPLAIN ANALYZE
SELECT *
FROM znt_conversations
WHERE user_id = 1
  AND created_at >= '2024-01-01'
  AND created_at < '2024-01-02'
  AND message_type = 'question'
ORDER BY created_at ASC
LIMIT 500;

-- ============================================
-- 使用说明
-- ============================================

/*
使用步骤:
1. 备份数据库: pg_dump wangsh_db > backup_$(date +%Y%m%d).sql
2. 在测试环境执行本脚本
3. 验证查询性能提升
4. 监控系统负载
5. 在生产环境执行

注意事项:
1. 添加索引会占用磁盘空间
2. 添加索引会影响写入性能
3. 在业务低峰期执行
4. 监控锁等待情况
5. 准备好回滚方案

性能验证:
1. 比较添加索引前后的查询时间
2. 监控数据库CPU和内存使用
3. 检查锁等待情况
4. 验证业务功能正常
*/