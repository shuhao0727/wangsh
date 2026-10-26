# 数据库性能指南

> 状态：reference
> Owner：database
> 最后更新：2026-10-20
>
> 来源说明：本文档已整合早期的数据库性能分析、优化指南和查询示例。原独立文档不再
> 作为当前入口；现行数据库结构变更仍必须通过 Alembic migration。

## 概述

本文档提供完整的数据库性能优化指南，涵盖性能分析、优化技术、代码示例和最佳实践。

---

## 📑 目录

- [第一部分：性能分析与监控](#第一部分性能分析与监控)
  - [1.1 启用性能监控](#11-启用性能监控)
  - [1.2 收集和分析查询样本](#12-收集和分析查询样本)
  - [1.3 分析现有索引](#13-分析现有索引)
- [第二部分：索引优化](#第二部分索引优化)
  - [2.1 已识别的缺失索引](#21-已识别的缺失索引)
  - [2.2 复合索引建议](#22-复合索引建议)
  - [2.3 基于查询模式的索引建议](#23-基于查询模式的索引建议)
  - [2.4 索引创建原则](#24-索引创建原则)
  - [2.5 已实施的索引优化](#25-已实施的索引优化2026-04-后)
- [第三部分：ORM查询优化](#第三部分orm查询优化)
  - [3.1 避免N+1查询问题](#31-避免n1查询问题)
  - [3.2 批量操作优化](#32-批量操作优化)
  - [3.3 分页查询优化](#33-分页查询优化)
  - [3.4 只选择需要的字段](#34-只选择需要的字段)
  - [3.5 复合查询优化](#35-复合查询优化)
- [第四部分：缓存策略](#第四部分缓存策略)
  - [4.1 查询结果缓存](#41-查询结果缓存)
  - [4.2 缓存失效策略](#42-缓存失效策略)
- [第五部分：数据库连接池优化](#第五部分数据库连接池优化)
  - [5.1 连接池配置](#51-连接池配置)
  - [5.2 连接使用最佳实践](#52-连接使用最佳实践)
- [第六部分：执行计划分析](#第六部分执行计划分析)
  - [6.1 分析关键查询的执行计划](#61-分析关键查询的执行计划)
  - [6.2 解读执行计划关键指标](#62-解读执行计划关键指标)
- [第七部分：实际修复示例](#第七部分实际修复示例)

---

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

> 复核结论（2026-10-21）：下列条目为早期分析结论，逐条核对当前模型、迁移与实际查询后，
> **均无需新增索引**。已补齐或确认不需要的条目直接记录结论，不再作为待办。

#### 2026-10-26 复核新增

- **ClassroomPlanItem.activity_id — 已实施**：`20261026_0001` 新增
  `ix_znt_classroom_plan_items_activity_id`。代码中有 5 处按 `activity_id` 过滤计划项，
  该外键此前无索引，数据量增长后会退化为全表扫描。本地已验证升级/降级/再升级，
  并用 `EXPLAIN` 确认查询走该索引。
- 其余外键缺索引的列（如 `znt_assessment_answers.question_id`、
  `znt_student_profiles.discussion_session_id`、`znt_classroom_activities.analysis_agent_id`）
  经核对**当前没有查询把它们当过滤条件**，暂不新增；数据量增长或出现新查询时再评估。

#### 高优先级

1. **GroupDiscussionSession.created_at** — **不需要**。现有查询按 `session_date` +
   `class_name` 等值过滤，排序使用 `group_no` 或 `last_message_at`，没有按 `created_at`
   过滤或排序的查询（`backend/app/services/agents/group_discussion/session_service.py:219-238`）。
   该字段仅用于展示。
2. **ClassroomActivity.status** — 已由 `20260817_0001` 的
   `ix_znt_classroom_activities_status_created(status, created_at)` 覆盖。
3. **ClassroomActivity.analysis_agent_id** — **不需要**。该列只在应用层读取和写入
   （`backend/app/services/classroom_analysis.py:64`），实际查询是先按主键取活动，再取
   全部可用智能体做内存过滤，不按此列做数据库过滤或连接。
4. **InformaticsGithubSyncSource.note_id** — 已实施：`20260311_0001` 中的
   `ix_inf_github_sync_sources_note_id`。

#### 中优先级

1. **ClassroomActivity.created_at/updated_at** — **不需要**。`created_at` 已被上述
   `(status, created_at)` 复合索引覆盖；`updated_at` 没有查询或排序使用点。
2. **InformaticsGithubSyncRun.status** — **不需要**。表内只有同步运行记录，
   按状态查询仅用于判断“是否有正在运行的任务”（`github_sync.py:337`），表体量极小，
   顺序扫描成本可忽略。
3. **InformaticsGithubSyncSetting.created_at/updated_at** — **不需要**。单例配置表，
   按 `id` 取最新一条（`github_sync.py:151`），只有个位数行。

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

-- 5. 按会话和题目查询答题记录（表名为 znt_assessment_answers，
--    见 backend/app/models/assessment/answer.py:13；answers 已有 session_id 索引）
CREATE INDEX IF NOT EXISTS idx_answers_session_question
ON znt_assessment_answers(session_id, question_id);
```

### 2.4 索引创建原则

1. **选择性原则**：为高选择性字段创建索引（如状态、类型等）
2. **查询模式原则**：根据实际查询模式创建索引
3. **复合索引原则**：将等值查询字段放在前面，范围查询字段放在后面
4. **排序原则**：索引方向应与ORDER BY子句一致

### 2.5 已实施的索引优化（2026-04 后）

以下索引已通过 Alembic 迁移落地：

1. **znt_conversations 复合索引** — `20260428_add_agent_conversation_indexes.py`：
   - `(agent_id, message_type, created_at)` — 智能体对话分类查询
   - `(session_id, created_at)` — 会话消息时序查询
2. **sys_users.full_name 索引** — `20260614_0001_add_fullname_index.py`，优化姓名登录查询性能
3. **InformaticsGithubSyncSource.note_id 索引** — `20260311_0001_informatics_github_sync.py`
   第 88-89 行，外键列索引

## 第三部分：ORM查询优化

### 2026年4月后新增表

以下表为 2026-04 之后新增，可能需要根据查询模式追加索引：

| 表名 | 新增时间 | 关键字段（候选索引） |
|------|---------|------------------|
| sys_learning_chapters | 2026-05 | module_key, section_key |
| sys_learning_content_items | 2026-05 | module_key, section_key |
| sys_learning_progress | 2026-05 | module_key, section_key |
| ml_books | 2026-05 | module_key |
| ml_book_chapters | 2026-05 | book_id |
| task_analyses | 2026-05-22 | — |
| hot_question_analyses | 2026-05-22 | — |
| student_chain_analyses | 2026-05-22 | — |
| agent_analysis_prompt_templates | 2026-05-29 | — |
| it_games | 2026-06-24 | category, uploaded_by |
| it_game_download_logs | 2026-06-24 | game_id, user_id |

> 表名更正依据：模型 `__tablename__` 见 `backend/app/models/agents/ai_agent.py:79,105,130,152`
> 与迁移 `20260522_0146_task_analyses.py:18`、`20260522_0719_hot_chain_tables.py:18,43`；
> 原表名的 `znt_` 前缀与实际情况不符。`it_game_download_logs` 的实际索引列为
> `game_id`、`user_id`（`backend/app/models/it/game.py:47-48`）。

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

### 3.3.1 Keyset 分页实践案例

**正面案例：** `group_discussion` 的 `list_messages` 使用 `after_id` 游标分页，避免了大 offset 带来的性能退化。

**待优化：** 以下模块仍使用 offset/limit 分页，数据量增长后建议迁移到 keyset 模式：
- `it/games` 游戏列表（`page` / `size`，`backend/app/api/endpoints/it/games.py:66-74`）
- `users` 用户管理列表（`skip` / `limit`，`users.py:84-91`）
- `xbk/selections` 选择列表（`skip` / `limit`，`selections.py:109-119`）

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

在 `app/core/config/_database.py` 与 `app/db/database.py` 中配置数据库连接池：

```python
# 实际配置（backend/app/core/config/_database.py:20-22）
POSTGRES_MAX_CONNECTIONS = 20  # 连接池大小（DEBUG 下 20，生产默认 50）
DB_MAX_OVERFLOW = 20           # 最大溢出连接数（DEBUG 下 10）
DB_POOL_TIMEOUT_SECONDS = 30   # 获取连接超时（DEBUG 下 15）
# 引擎侧（backend/app/db/database.py:26-30）
pool_recycle = 3600            # 已设置，单位秒
pool_pre_ping = True
```

> **注意：** `pool_recycle=3600` 与 `pool_timeout` 已在 `backend/app/db/database.py` 中显式设置，
> 早期“未设置 pool_recycle”的说明不再成立。生产环境 `POSTGRES_MAX_CONNECTIONS` 默认 50，
> 但仓库 `.env.example:95` 与 `.env.dev:73` 均写为 100，以实际环境变量为准。

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

**问题文件**：`app/services/agents/group_discussion/session_service.py`（该文件存在，
但 `get_session_with_messages` 是历史示例，当前实现以 `list_messages` 的 `after_id`
游标分页为主，见该文件第 266-300 行）

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

### 7.2 正面案例：article service 的 eager loading

article service 正确使用了 `selectinload` 进行关联数据的预加载，避免了 N+1 查询问题，是 ORM 最佳实践的良好示例。
证据：`backend/app/services/articles/article.py:74-76,95-97,233-235`。

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
> - 2026-07-13：移除不存在的旧备份路径说明，明确本文件是当前整合入口
