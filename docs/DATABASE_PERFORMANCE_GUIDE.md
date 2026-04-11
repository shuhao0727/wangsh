# 数据库性能指南

> 最后更新：2026-04-11
> 
> 本文档整合了原有的三个数据库性能相关文档：
> - `DATABASE_PERFORMANCE_ANALYSIS.md` - 分析方法和过程
> - `DATABASE_OPTIMIZATION_GUIDE.md` - 优化技术和最佳实践  
> - `QUERY_OPTIMIZATION_EXAMPLES.md` - 具体代码示例和修复方案

## 概述

本文档提供完整的数据库性能优化指南，涵盖性能分析、优化技术、代码示例和最佳实践。

## 第一部分：性能分析与监控

### 1.1 启用性能监控

#### 配置慢查询日志
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

#### 启用 pg_stat_statements
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

### 1.2 收集和分析查询样本

#### 查看最耗时的查询
```sql
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
```

#### 分析活跃查询和锁等待
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
```

### 1.3 分析现有索引

#### 查看索引使用情况
```sql
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
ORDER BY tablename, indexname;
```

#### 识别未使用的索引
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

## 第二部分：索引优化

### 2.1 已识别的缺失索引

#### 高优先级（立即添加）
1. **GroupDiscussionSession.created_at** - 常用排序字段
2. **ClassroomActivity.status** - 高频筛选字段
3. **ClassroomActivity.analysis_agent_id** - 外键列
4. **InformaticsGithubSyncSource.note_id** - 外键列

#### 中优先级（建议添加）
1. **ClassroomActivity.created_at/updated_at** - 时间戳字段
2. **InformaticsGithubSyncRun.status** - 状态字段
3. **InformaticsGithubSyncSetting.created_at/updated_at** - 时间戳字段

### 2.2 复合索引建议

对于常见查询模式，建议创建复合索引：

```sql
-- 文章按分类和发布时间查询
CREATE INDEX idx_wz_articles_category_published_created 
ON wz_articles(category_id, published, created_at DESC) 
WHERE published = true;

-- 用户按角色和活跃状态查询
CREATE INDEX idx_sys_users_role_active 
ON sys_users(role_code, is_active);

-- 对话按用户和时间查询
CREATE INDEX idx_znt_conversations_user_created 
ON znt_conversations(user_id, created_at DESC);
```

### 2.3 基于查询模式的索引建议

```sql
-- 1. 按日期和班级查询小组讨论会话
CREATE INDEX IF NOT EXISTS idx_sessions_date_class 
ON znt_group_discussion_sessions(session_date, class_name);

-- 2. 按会话和时间查询消息
CREATE INDEX IF NOT EXISTS idx_messages_session_created 
ON znt_group_discussion_messages(session_id, created_at);

-- 3. 按用户和时间查询对话（跨系统分析）
CREATE INDEX IF NOT EXISTS idx_conversations_user_created_type 
ON znt_conversations(user_id, created_at, message_type);

-- 4. 按用户和状态查询测评会话
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_status 
ON znt_assessment_sessions(user_id, status);

-- 5. 按会话和题目查询答题记录
CREATE INDEX IF NOT EXISTS idx_attempts_session_question 
ON znt_assessment_attempts(session_id, question_id);
```

### 2.4 索引创建原则

1. **选择性原则**：为高选择性字段创建索引（如状态、类型等）
2. **查询模式原则**：根据实际查询模式创建索引
3. **复合索引原则**：将等值查询字段放在前面，范围查询字段放在后面
4. **排序原则**：索引方向应与ORDER BY子句一致

## 第三部分：ORM查询优化

### 3.1 避免N+1查询问题

#### ❌ 错误示例：N+1查询
```python
async def get_articles_with_authors(db: AsyncSession):
    articles = await db.execute(select(Article))
    articles = articles.scalars().all()
    
    result = []
    for article in articles:
        # 每次循环都执行一次查询
        author_result = await db.execute(
            select(User).where(User.id == article.author_id)
        )
        author = author_result.scalar_one_or_none()
        
        result.append({
            'article': article,
            'author': author
        })
    
    return result
```

#### ✅ 正确做法：使用selectinload（推荐）
```python
async def get_articles_with_authors(db: AsyncSession):
    query = select(Article).options(
        selectinload(Article.author)  # 一次性加载所有作者
    )
    
    result = await db.execute(query)
    articles = result.scalars().all()
    
    return [{'article': article, 'author': article.author} for article in articles]
```

#### ✅ 正确做法：使用joinedload
```python
async def get_articles_with_authors(db: AsyncSession):
    query = select(Article).options(
        joinedload(Article.author)  # 使用JOIN一次性加载
    )
    
    result = await db.execute(query)
    articles = result.unique().scalars().all()
    
    return [{'article': article, 'author': article.author} for article in articles]
```

### 3.2 批量操作优化

#### ❌ 错误：循环中单个插入
```python
async def create_multiple_articles(db: AsyncSession, article_data_list: list):
    for data in article_data_list:
        article = Article(**data)
        db.add(article)  # 每次循环都调用add
        await db.commit()  # ❌ 更糟：每次循环都提交
```

#### ✅ 正确：批量插入
```python
async def create_multiple_articles(db: AsyncSession, article_data_list: list):
    articles = [Article(**data) for data in article_data_list]
    db.add_all(articles)  # 一次性添加所有对象
    await db.commit()  # 只提交一次
```

### 3.3 分页查询优化

#### ✅ 正确：有ORDER BY的分页
```python
async def get_articles_page(db: AsyncSession, page: int, size: int):
    query = select(Article).where(Article.published == True)
    query = query.order_by(Article.created_at.desc())  # 添加ORDER BY
    query = query.offset((page - 1) * size).limit(size)
    
    result = await db.execute(query)
    return result.scalars().all()
```

#### ✅ 高级方案：Keyset分页（大数据集）
```python
async def get_articles_keyset(db: AsyncSession, last_id: int, size: int):
    query = select(Article).where(Article.published == True)
    
    if last_id:
        query = query.where(Article.id > last_id)  # 使用WHERE替代OFFSET
    
    query = query.order_by(Article.id).limit(size)  # 必须按ID排序
    
    result = await db.execute(query)
    return result.scalars().all()
```

### 3.4 只选择需要的字段

#### ❌ 错误：选择所有字段
```python
async def get_article_titles(db: AsyncSession):
    query = select(Article)  # 选择所有字段
    
    result = await db.execute(query)
    articles = result.scalars().all()
    
    return [article.title for article in articles]  # 只用了title字段
```

#### ✅ 正确：只选择需要的字段
```python
async def get_article_titles(db: AsyncSession):
    query = select(Article.title, Article.id)  # 只选择需要的字段
    
    result = await db.execute(query)
    rows = result.all()
    
    return [{'id': row.id, 'title': row.title} for row in rows]
```

### 3.5 复合查询优化

#### ❌ 错误：多个独立查询
```python
async def get_article_with_stats(db: AsyncSession, article_id: int):
    # 查询1：获取文章
    article_result = await db.execute(
        select(Article).where(Article.id == article_id)
    )
    article = article_result.scalar_one_or_none()
    
    # 查询2：获取作者
    author_result = await db.execute(
        select(User).where(User.id == article.author_id)
    )
    author = author_result.scalar_one_or_none()
    
    # 查询3：获取分类
    category_result = await db.execute(
        select(Category).where(Category.id == article.category_id)
    )
    category = category_result.scalar_one_or_none()
    
    return {
        'article': article,
        'author': author,
        'category': category
    }
```

#### ✅ 正确：一次性加载所有关联
```python
async def get_article_with_stats(db: AsyncSession, article_id: int):
    query = select(Article).where(Article.id == article_id).options(
        selectinload(Article.author),
        selectinload(Article.category),
        selectinload(Article.style)
    )
    
    result = await db.execute(query)
    article = result.scalar_one_or_none()
    
    if not article:
        return None
    
    return {
        'article': article,
        'author': article.author,
        'category': article.category,
        'style': article.style
    }
```

## 第四部分：缓存策略

### 4.1 查询结果缓存

对于不经常变化的数据，使用查询缓存：

```python
from app.utils.cache import cache

async def get_article_list(page: int, size: int):
    cache_key = f"articles:list:{page}:{size}"
    
    # 尝试从缓存获取
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # 数据库查询
    result = await ArticleService.list_articles(...)
    
    # 设置缓存（适当TTL）
    await cache.set(cache_key, result, expire_seconds=300)
    
    return result
```

### 4.2 缓存失效策略

当数据变更时，及时清理相关缓存：

```python
async def update_article(article_id: int, data: dict):
    # 更新数据库
    await ArticleService.update_article(...)
    
    # 清理相关缓存
    await cache.delete(f"article:{article_id}")
    await cache.delete_pattern("articles:list:*")  # 清理所有列表缓存
```

## 第五部分：数据库连接池优化

### 5.1 连接池配置

在`app/core/config.py`中优化数据库连接池：

```python
# 推荐配置
DATABASE_POOL_SIZE = 20  # 连接池大小
DATABASE_MAX_OVERFLOW = 10  # 最大溢出连接数
DATABASE_POOL_RECYCLE = 3600  # 连接回收时间（秒）
DATABASE_POOL_TIMEOUT = 30  # 连接超时时间（秒）
```

### 5.2 连接使用最佳实践

```python
# 正确：使用async with管理连接
async with async_session() as session:
    result = await session.execute(query)
    return result.scalars().all()

# 避免：长时间持有连接
# 不要在一个连接中执行多个不相关的操作
```

## 第六部分：执行计划分析

### 6.1 分析关键查询的执行计划

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
```

### 6.2 解读执行计划关键指标

- **Seq Scan**：全表扫描，可能缺少索引
- **Index Scan**：索引扫描，效率较高
- **Bitmap Heap Scan**：多条件查询
- **Sort**：排序操作，可能影响性能
- **Nested Loop**：嵌套循环，可能效率较低
- **Hash Join**：哈希连接，大数据集效率高

## 第七部分：实际修复示例

### 7.1 修复分组讨论服务

**问题文件**：`app/services/agents/group_discussion.py`

**修复前**：
```python
async def get_session_with_messages(db: AsyncSession, session_id: int):
    # 查询会话
    session_query = select(GroupDiscussionSession).where(
        GroupDiscussionSession.id == session_id
    )
    session_result = await db.execute(session_query)
    session = session_result.scalar_one_or_none()
    
    # 查询消息（N+1问题）
    messages_query = select(GroupDiscussionMessage).where(
        GroupDiscussionMessage.session_id == session_id
    ).order_by(GroupDiscussionMessage.created_at)
    messages_result = await db.execute(messages_query)
    messages = messages_result.scalars().all()
    
    # 为每条消息查询作者（另一个N+1问题）
    for message in messages:
        author_query = select(User).where(User.id == message.user_id)
        author_result = await db.execute(author_query)
        message.author = author_result.scalar_one_or_none()
    
    return {'session': session, 'messages': messages}
```

**修复后**：
```python
async def get_session_with_messages(db: AsyncSession, session_id: int):
    # 一次性加载所有关联数据
    session_query = select(GroupDiscussionSession).where(
        GroupDiscussionSession.id == session_id
    ).options(
        selectinload(GroupDiscussionSession.messages).selectinload(
            GroupDiscussionMessage.author
        )
    )
    
    session_result = await db.execute(session_query)
    session = session_result.scalar_one_or_none()
    
    if not session:
        return None
    
    # 消息和作者已经通过selectinload加载
    return {
        'session': session,
        'messages': session.messages  # 已经包含author信息
    }
```

## 第八部分：优化检查清单

### 8.1 开发时检查

1. **列表查询**：是否使用了`selectinload`或`joinedload`？
2. **循环中的查询**：是否可以在循环外一次性查询？
3. **分页查询**：是否有`ORDER BY`子句？
4. **字段选择**：是否只选择了需要的字段？
5. **批量操作**：是否使用了`add_all`和批量更新？

### 8.2 代码审查检查

1. **N+1检测**：查找循环中的`select()`调用
2. **关联加载**：检查列表查询是否加载了关联数据
3. **分页性能**：检查大数据集的分页实现
4. **缓存使用**：检查是否合理使用了缓存

### 8.3 性能测试检查

1. **查询数量**：单个API端点执行了多少次查询？
2. **响应时间**：95%的查询是否在100ms内完成？
3. **数据库负载**：连接池使用率是否正常？
4. **缓存命中率**：缓存是否有效工作？

## 第九部分：性能优化清单

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

## 第十部分：工具和资源

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

## 总结

数据库性能优化是一个持续的过程。建议：

1. **定期监控**：每周检查一次性能指标
2. **渐进优化**：每次只优化一个瓶颈点
3. **测试验证**：每次优化后都要进行测试验证
4. **文档更新**：更新本文档记录优化措施和效果

---

> **文档历史**：
> - 2026-04-11：整合三个数据库性能文档，创建统一指南
> - 原始文档已备份：
>   - `DATABASE_PERFORMANCE_ANALYSIS.md.backup`
>   - `DATABASE_OPTIMIZATION_GUIDE.md.backup`
>   - `QUERY_OPTIMIZATION_EXAMPLES.md.backup`