# 数据库性能分析指南（已整合）

> **注意**：本文档已整合到新的统一指南中。
> 
> 请查看：[DATABASE_PERFORMANCE_GUIDE.md](DATABASE_PERFORMANCE_GUIDE.md)
> 
> 新的指南整合了以下三个文档的内容：
> 1. 数据库性能分析指南（本文档）
> 2. 数据库优化指南
> 3. 查询优化示例
> 
> 本文档保留作为重定向参考，实际内容请查看新文档。

## 当前状态

### 已知信息
1. 数据库：PostgreSQL 16
2. 关键表：`znt_group_discussion_*`, `znt_conversations`, `znt_assessment_*`
3. 已有索引：部分表已有基础索引
4. 需要：基于实际查询模式优化索引

## 分析步骤

### 步骤1：启用性能监控

#### 1.1 配置慢查询日志
```sql
-- 临时启用（重启后失效）
ALTER SYSTEM SET log_min_duration_statement = '1000';  -- 记录执行超过1秒的查询
SELECT pg_reload_conf();

-- 永久配置（修改 postgresql.conf）
log_min_duration_statement = 1000
log_statement = 'none'
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
```

#### 1.2 启用 pg_stat_statements
```sql
-- 检查是否已启用
SELECT name, setting FROM pg_settings WHERE name LIKE '%pg_stat_statements%';

-- 如果未启用，在 postgresql.conf 中添加
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### 步骤2：收集查询样本

#### 2.1 使用 pg_stat_statements 分析
```sql
-- 查看最耗时的查询
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows,
    shared_blks_hit,
    shared_blks_read,
    100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- 查看 group_discussion 相关查询
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%group_discussion%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

#### 2.2 分析活跃查询
```sql
-- 查看当前活跃的慢查询
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
  AND state = 'active'
ORDER BY duration DESC;

-- 查看锁等待
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
```

### 步骤3：分析现有索引

#### 3.1 查看表结构和索引
```sql
-- 查看 group_discussion 相关表的索引
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename LIKE 'znt_group_discussion%'
   OR tablename LIKE 'znt_conversations'
   OR tablename LIKE 'znt_assessment%'
ORDER BY tablename, indexname;

-- 查看索引使用情况
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    100.0 * idx_scan / NULLIF(idx_scan + seq_scan, 0) AS index_usage_percent
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 'znt_group_discussion%' 
       OR tablename LIKE 'znt_conversations'
       OR tablename LIKE 'znt_assessment%')
ORDER BY tablename, indexname;
```

#### 3.2 识别未使用的索引
```sql
-- 查找扫描次数为0的索引
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY tablename, indexname;
```

### 步骤4：执行计划分析

#### 4.1 分析关键查询的执行计划
```sql
-- 小组讨论会话查询
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM znt_group_discussion_sessions
WHERE session_date = CURRENT_DATE
  AND class_name = '测试班'
ORDER BY created_at DESC
LIMIT 10;

-- 小组讨论消息查询
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM znt_group_discussion_messages
WHERE session_id = 1
ORDER BY created_at ASC
LIMIT 100;

-- 跨系统分析查询
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM znt_conversations
WHERE user_id = 1
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
  AND message_type = 'question'
ORDER BY created_at ASC
LIMIT 500;

-- 测评会话查询
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM znt_assessment_sessions
WHERE user_id = 1
  AND status = 'completed'
ORDER BY created_at DESC
LIMIT 10;
```

#### 4.2 解读执行计划关键指标
- **Seq Scan**：全表扫描，可能缺少索引
- **Index Scan**：索引扫描，效率较高
- **Bitmap Heap Scan**：多条件查询
- **Sort**：排序操作，可能影响性能
- **Nested Loop**：嵌套循环，可能效率较低
- **Hash Join**：哈希连接，大数据集效率高

### 步骤5：识别优化机会

#### 5.1 基于查询模式建议索引
```sql
-- 需要评估的索引（基于常见查询模式）

-- 1. 按日期和班级查询小组讨论会话
-- 查询模式: WHERE session_date = ? AND class_name = ?
CREATE INDEX IF NOT EXISTS idx_sessions_date_class 
ON znt_group_discussion_sessions(session_date, class_name);

-- 2. 按会话和时间查询消息
-- 查询模式: WHERE session_id = ? ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_messages_session_created 
ON znt_group_discussion_messages(session_id, created_at);

-- 3. 按用户和时间查询对话（跨系统分析）
-- 查询模式: WHERE user_id = ? AND created_at BETWEEN ? AND ? AND message_type = ?
CREATE INDEX IF NOT EXISTS idx_conversations_user_created_type 
ON znt_conversations(user_id, created_at, message_type);

-- 4. 按用户和状态查询测评会话
-- 查询模式: WHERE user_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_status 
ON znt_assessment_sessions(user_id, status);

-- 5. 按会话和题目查询答题记录
-- 查询模式: WHERE session_id = ? AND question_id = ?
CREATE INDEX IF NOT EXISTS idx_attempts_session_question 
ON znt_assessment_attempts(session_id, question_id);
```

#### 5.2 查询优化建议

**1. 避免 N+1 查询**
```python
# 不好：多次查询
for session in sessions:
    messages = await db.execute(
        select(GroupDiscussionMessage)
        .where(GroupDiscussionMessage.session_id == session.id)
    )

# 好：一次查询
session_ids = [s.id for s in sessions]
messages = await db.execute(
    select(GroupDiscussionMessage)
    .where(GroupDiscussionMessage.session_id.in_(session_ids))
)
```

**2. 使用 JOIN 替代多次查询**
```python
# 不好：分开查询
session = await db.execute(
    select(GroupDiscussionSession).where(GroupDiscussionSession.id == session_id)
)
messages = await db.execute(
    select(GroupDiscussionMessage).where(GroupDiscussionMessage.session_id == session_id)
)

# 好：使用 JOIN
result = await db.execute(
    select(GroupDiscussionSession, GroupDiscussionMessage)
    .join(GroupDiscussionMessage, GroupDiscussionSession.id == GroupDiscussionMessage.session_id)
    .where(GroupDiscussionSession.id == session_id)
)
```

**3. 分页优化**
```python
# 使用 keyset pagination 替代 OFFSET
last_id = request.query_params.get('last_id')
query = select(GroupDiscussionSession).order_by(GroupDiscussionSession.id)

if last_id:
    query = query.where(GroupDiscussionSession.id > int(last_id))

result = await db.execute(query.limit(20))
```

### 步骤6：实施和验证

#### 6.1 创建迁移脚本
```python
# backend/app/db/migrations/versions/20240410_0001_add_performance_indexes.py
"""add performance indexes

Revision ID: 20240410_0001
Revises: previous_revision
Create Date: 2026-04-10 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20240410_0001'
down_revision = 'previous_revision'
branch_labels = None
depends_on = None

def upgrade():
    # 添加性能索引
    op.create_index(
        'idx_sessions_date_class',
        'znt_group_discussion_sessions',
        ['session_date', 'class_name']
    )
    
    op.create_index(
        'idx_messages_session_created',
        'znt_group_discussion_messages',
        ['session_id', 'created_at']
    )
    
    op.create_index(
        'idx_conversations_user_created_type',
        'znt_conversations',
        ['user_id', 'created_at', 'message_type']
    )

def downgrade():
    # 回滚索引
    op.drop_index('idx_sessions_date_class', table_name='znt_group_discussion_sessions')
    op.drop_index('idx_messages_session_created', table_name='znt_group_discussion_messages')
    op.drop_index('idx_conversations_user_created_type', table_name='znt_conversations')
```

#### 6.2 验证优化效果
```sql
-- 优化前基准测试
SELECT 
    query,
    mean_exec_time AS before_ms,
    calls AS before_calls
FROM pg_stat_statements
WHERE query LIKE '%znt_group_discussion%'
ORDER BY total_exec_time DESC
LIMIT 5;

-- 应用索引后
-- 1. 执行迁移
-- 2. 重新收集统计信息
ANALYZE VERBOSE;

-- 3. 运行相同查询
-- 4. 比较性能

-- 优化后性能对比
SELECT 
    query,
    mean_exec_time AS after_ms,
    calls AS after_calls,
    ROUND((before_ms - after_ms) / before_ms * 100, 2) AS improvement_percent
FROM (
    SELECT 
        query,
        mean_exec_time AS before_ms,
        calls AS before_calls
    FROM pg_stat_statements_snapshot_before
    WHERE query LIKE '%znt_group_discussion%'
) BEFORE
JOIN (
    SELECT 
        query,
        mean_exec_time AS after_ms,
        calls AS after_calls
    FROM pg_stat_statements
    WHERE query LIKE '%znt_group_discussion%'
) AFTER ON BEFORE.query = AFTER.query;
```

#### 6.3 监控优化效果
```sql
-- 创建性能监控视图
CREATE OR REPLACE VIEW performance_monitor AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 查看索引使用情况
SELECT * FROM performance_monitor LIMIT 10;

-- 监控表大小和膨胀
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - 
                   pg_relation_size(schemaname || '.' || tablename)) AS index_size,
    n_live_tup,
    n_dead_tup,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'znt_group_discussion%' 
       OR tablename LIKE 'znt_conversations'
       OR tablename LIKE 'znt_assessment%')
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

## 性能优化清单

### 高优先级
1. [ ] 分析慢查询日志，识别Top 10慢查询
2. [ ] 对关键查询执行 EXPLAIN ANALYZE
3. [ ] 检查现有索引使用情况
4. [ ] 添加缺失的复合索引

### 中优先级
1. [ ] 优化 N+1 查询问题
2. [ ] 实施分页优化
3. [ ] 添加查询缓存策略
4. [ ] 监控表膨胀情况

### 低优先级
1. [ ] 查询重写优化
2. [ ] 连接池优化
3. [ ] 分区表评估
4. [ ] 读写分离评估

## 工具和资源

### 监控工具
1. **pg_stat_statements**：查询性能分析
2. **pgBadger**：日志分析工具
3. **pgHero**：Web 监控界面
4. **Prometheus + Grafana**：时序监控

### 优化工具
1. **EXPLAIN ANALYZE**：执行计划分析
2. **pg_qualstats**：WHERE 条件分析
3. **pg_stat_kcache**：CPU/IO 消耗分析
4. **hypopg**：虚拟索引测试

### 参考文档
1. [PostgreSQL 性能优化](https://www.postgresql.org/docs/current/performance-tips.html)
2. [使用索引](https://www.postgresql.org/docs/current/indexes.html)
3. [EXPLAIN 使用指南](https://www.postgresql.org/docs/current/using-explain.html)
4. [pg_stat_statements 详解](https://www.postgresql.org/docs/current/pgstatstatements.html)

## 风险控制

### 实施风险
1. **索引影响写入性能**
   - 应对：在低峰期实施，监控写入性能
   - 回滚：准备索引删除脚本

2. **查询重写引入bug**
   - 应对：充分测试，逐步替换
   - 验证：对比查询结果一致性

3. **迁移失败**
   - 应对：备份数据库，测试环境验证
   - 回滚：准备完整的回滚方案

### 监控策略
1. **实施前基准**：记录关键指标基线
2. **实施中监控**：实时监控性能变化
3. **实施后验证**：对比优化效果
4. **长期跟踪**：建立持续监控机制

## 交付物

### 分析报告
1. 慢查询分析报告
2. 索引优化建议
3. 查询重写方案
4. 性能基准对比

### 实施成果
1. 新增索引迁移脚本
2. 优化后的查询代码
3. 性能监控配置
4. 文档和指南

### 质量指标
1. 查询响应时间提升百分比
2. 索引使用率提升
3. 数据库负载下降
4. 用户感知性能改善