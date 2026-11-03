# 数据库性能指南

> 状态：reference
> Owner：database
> 最近复核：2026-10-31

本文维护项目查询、索引和连接池的判断依据。结构变更以 Alembic 为准，目标库是否已应用
必须现场核对；本轮只核对源码与文档，未测数据库、负载或生产环境。
性能待办统一见[当前台账 PERF-01](../plans/project-consolidation.md#未结事项)，
测量结果见[测试状态](../testing/TEST_STATUS.md)。

## 第一部分：性能分析与监控

### 1.1 启用性能监控

先查已有日志、监控和查询样本。调整日志、启用扩展或重启数据库属于运维变更，
按[部署指南](../operations/DEPLOY.md)核对授权、窗口和回退。
没有新性能证据时保留既有“不安装 `pg_stat_statements`”取舍，不因旧示例自动配置扩展。

### 1.2 收集和分析查询样本

记录接口、查询参数范围、数据量、查询次数、耗时、锁等待及环境；样本脱敏，区分真实负载与合成基准。
已有 `pg_stat_statements` 时可辅助定位高总耗时或高调用量查询，未配置时不把安装作为排查前置。
监控入口见[监控参考](../operations/MONITORING.md)。

### 1.3 分析现有索引

对照模型、完整迁移链、目标 schema 的索引定义和实际查询计划。
统计窗口、数据规模和约束用途未核清前，不因扫描次数为零就删索引，也不因外键存在就盲目新增。

## 第二部分：索引优化

### 2.1 已识别的缺失索引

以下保留历史候选的处理依据，不表示当前仍缺索引或已经完成目标库验收。

| 对象 | 已有依据与处理边界 |
|---|---|
| `ClassroomPlanItem.activity_id` | 迁移 `20261026_0001` 创建 `ix_znt_classroom_plan_items_activity_id`，服务删除/更新活动时的外键级联。原文“5 处业务过滤”有误：迁移已注明这些过滤属于 `ClassroomResponse` |
| `ClassroomActivity.status/created_at` | `20260817_0001_query_filter_indexes` 已定义 `ix_znt_classroom_activities_status_created(status, created_at)`；是否适合新查询仍看执行计划 |
| `InformaticsGithubSyncSource.note_id` | `20260311_0001` 已定义 `ix_inf_github_sync_sources_note_id` |
| `GroupDiscussionSession.created_at` | 10/21 复核：既有列表主要按日期、班级过滤并按 `group_no` / `last_message_at` 排序；仅用于展示时不新增 |
| `ClassroomActivity.analysis_agent_id/updated_at` | 10/21 复核未发现对应筛选或排序需求；新查询出现后再评估 |
| `InformaticsGithubSyncRun.status` | 10/21 复核属于小体量运行记录查询；不把历史体量判断推广到未来 |
| `InformaticsGithubSyncSetting.created_at/updated_at` | 10/21 复核为少量配置记录、按 `id` 取值；不因时间字段存在而新增 |
| `znt_assessment_answers.question_id`、`znt_student_profiles.discussion_session_id` | 10/26 旧候选；需求、级联路径和代表性数据均须重新核对，不能只查显式 WHERE |

`20261026_0001` 的升级/降级及隔离基准属于当批证据；详见
[迁移源码](../../backend/alembic/versions/20261026_0001_idx_classroom_plan_items_activity.py)，本轮未复跑。

### 2.2 复合索引建议

以下名称来自旧建议，保留以便追溯，**不是可直接执行的迁移或已确认缺失项**。
先核对现有索引、查询和写入代价；需要实施时新增 Alembic migration，不复制裸 SQL。

| 旧候选名称 | 原建议定义 |
|---|---|
| `idx_wz_articles_category_published_created` | `wz_articles(category_id, published, created_at DESC) WHERE published = true` |
| `idx_sys_users_role_active` | `sys_users(role_code, is_active)` |
| `idx_znt_conversations_user_created` | `znt_conversations(user_id, created_at DESC)` |

### 2.3 基于查询模式的索引建议

本表与 §2.2 同属未核准旧候选；已有相近索引不能仅凭名称不同再建一份。

| 旧候选名称 | 原建议定义 |
|---|---|
| `idx_sessions_date_class` | `znt_group_discussion_sessions(session_date, class_name)` |
| `idx_messages_session_created` | `znt_group_discussion_messages(session_id, created_at)` |
| `idx_conversations_user_created_type` | `znt_conversations(user_id, created_at, message_type)` |
| `idx_assessment_sessions_user_status` | `znt_assessment_sessions(user_id, status)` |
| `idx_answers_session_question` | `znt_assessment_answers(session_id, question_id)`；旧记录已指出存在 `session_id` 索引 |

### 2.4 索引创建原则

- 从真实过滤、连接、排序和外键维护路径出发，比较现有索引覆盖与写入成本。
- 用代表性数据核对索引列顺序、选择性和执行计划；不以字段名或单个扫描节点直接下结论。
- 迁移说明锁影响、失败处理和回退；不改写已执行历史 DDL，不靠 `IF NOT EXISTS` 跳过 schema 漂移。
- 准入与漂移检测边界见[工程治理 §六](ENGINEERING_GOVERNANCE.md#六数据库迁移)。

### 2.5 已有索引迁移

以下表示迁移源码已有定义，**不证明任一运行数据库已应用**。

| 迁移源码 | 索引 |
|---|---|
| [20260428_add_agent_conversation_indexes.py](../../backend/alembic/versions/20260428_add_agent_conversation_indexes.py) | `idx_znt_conv_agent_type_created(agent_id, message_type, created_at)`、`idx_znt_conv_session_created(session_id, created_at)`，表为 `znt_conversations` |
| [20260614_0001_add_fullname_index.py](../../backend/alembic/versions/20260614_0001_add_fullname_index.py) | `ix_sys_users_full_name`：`sys_users(full_name)` |
| [20260311_0001_informatics_github_sync.py](../../backend/alembic/versions/20260311_0001_informatics_github_sync.py) | `ix_inf_github_sync_sources_note_id`：`inf_github_sync_sources(note_id)` |

#### 2.5.1 对话域六个索引

前五项定义于 [291268877685 迁移](../../backend/alembic/versions/291268877685_add_core_indexes_for_conversations.py)，
第六项定义于 [4a85c94b5c4c 归档迁移](../../backend/alembic/versions/4a85c94b5c4c_add_archive_fields_to_conversations_and_.py)。

| 索引名 | 表、列与条件 |
|---|---|
| `ix_conversations_session_created` | `znt_conversations(session_id, created_at DESC, id DESC)` |
| `ix_conversations_user_agent_time` | `znt_conversations(user_id, agent_id, created_at DESC)` |
| `ix_group_messages_session_created` | `znt_group_discussion_messages(session_id, created_at DESC)` |
| `ix_users_class_name` | `sys_users(class_name) WHERE class_name IS NOT NULL` |
| `ix_conversations_agent_time` | `znt_conversations(agent_id, created_at, id) WHERE content IS NOT NULL AND trim(content) != ''` |
| `ix_conversations_archived_time` | `znt_conversations(is_archived, created_at) WHERE is_archived = false` |

历史报告的 `ix_conversations_is_archived` 是错值，不能据此补建索引。
旧性能倍数、命中率和验收声明仅供追溯，见原始报告及勘误（正文已清理）。

## 第三部分：ORM查询优化

### 2026年4月后新增表

以下名称保留旧文档的表名订正；是否需要新索引由查询证明，不能按建表日期批量添加。

| 范围 | 实际表名与原候选字段 |
|---|---|
| 学习内容 | `sys_learning_chapters`、`sys_learning_content_items`、`sys_learning_progress`：`module_key`、`section_key` |
| 书籍 | `ml_books.module_key`、`ml_book_chapters.book_id` |
| 智能体分析 | `task_analyses`、`hot_question_analyses`、`student_chain_analyses`、`agent_analysis_prompt_templates`；无 `znt_` 前缀 |
| 游戏 | `it_games.category/uploaded_by`；`it_game_download_logs.game_id/user_id` |

分析表名由 `backend/app/models/agents/ai_agent.py` 与 `20260522_0146`、`20260522_0719` 迁移定义；
游戏下载日志列见 `backend/app/models/it/game.py`。此表不是当前迁移待办。

### 3.1 避免N+1查询问题

先限定父记录数量，再按关系使用 `selectinload`、`joinedload` 或批量 `IN` 查询。
实际例子见 `backend/app/services/articles/article.py`；不能把“预加载全部关系”当作无界加载许可。

### 3.2 批量操作优化

合并往返与写入批次，保持原权限、约束、错误归因和事务原子性。
提交由业务事务边界负责；不复制循环逐条 commit，也不在底层工具里自行 commit。
XBK 导入批量化须先核 `guard_course_change` 预取及冲突归因，不作为顺手小改。

### 3.3 分页查询优化

列表有明确上限和稳定排序。offset 是否需要替换由真实负载决定，不默认迁移成 keyset。

### 3.3.1 Keyset 分页实践案例

`backend/app/services/agents/group_discussion/session_service.py::list_messages` 使用
`after_id`、按消息 `id` 升序及 `limit`。游戏、用户和选课列表的旧 keyset 建议不构成实施决定。

### 3.4 只选择需要的字段

只返回调用方需要的字段；筛选、计数和聚合优先在 SQL 完成，不全表拉回后再处理。

### 3.5 复合查询优化

按所需关联设计查询，检查空结果、重复行、分页语义及返回合同；查询变少仍须验证结果等价。

## 第四部分：缓存策略

### 4.1 查询结果缓存

只在实际热点和一致性边界明确时使用缓存。复用当前模块实现，核对用户/权限隔离、键、TTL、
序列化与降级，不复制泛化的 `articles:list` 示例作为项目合同。
AI 会话列表缓存已从当前端点移除；原因见 `backend/app/api/endpoints/agents/ai_agents/conversations.py`，不按旧性能报告恢复。

### 4.2 缓存失效策略

明确成功写入、回滚、删除和权限变化的失效时点；不要靠通配删除替代完整的一致性设计。
智能体 ORM 快照边界见[智能体缓存约定](../features/AI_AGENTS.md#智能体缓存约定踩过坑改动前必读)。

## 第五部分：数据库连接池优化

### 5.1 连接池配置

字段在 `backend/app/core/config/_database.py`，未显式配置时的环境默认值由
`backend/app/core/config/__init__.py` 计算；引擎配置在 `backend/app/db/database.py`。

| 配置 | DEBUG 默认 | 非 DEBUG 默认 |
|---|---|---|
| `POSTGRES_MAX_CONNECTIONS` | 20 | 50 |
| `DB_MAX_OVERFLOW` | 10 | 20 |
| `DB_POOL_TIMEOUT_SECONDS` | 15 | 30 |

显式环境变量优先；`.env.example` 当前示例为 `POSTGRES_MAX_CONNECTIONS=100`，不证明运行实例采用此值。
引擎已配置 `pool_pre_ping=True`、`pool_recycle=3600` 和池等待超时；旧“未配置 recycle”结论失效。

### 5.2 连接使用最佳实践

复用已有 `AsyncSessionLocal`、`get_db` 与事务边界。请求结束时清理未提交事务，
检查长流、外部请求和取消路径是否长期占用连接；不为了重构绕开现有失败回滚。

## 第六部分：执行计划分析

### 6.1 分析关键查询的执行计划

选实际查询、代表性参数与规模，记录计划、扫描行数、耗时和缓冲区信息。
`EXPLAIN ANALYZE` 会执行语句，只在已核准环境运行；写查询按事务和恢复要求单独处理。

### 6.2 解读执行计划关键指标

结合估算/实际行数、循环次数、扫描范围、排序和读块判断瓶颈。
不能仅因出现 Seq Scan、Nested Loop 或 Index Scan 就判定需要优化或已经优化成功。

## 第七部分：实际修复示例

### 7.1 修复分组讨论服务

旧 `get_session_with_messages` 前后对照只是历史示例，并非当前接口，不再保留可误复制的实现。
当前消息分页与边界以 `session_service.py::list_messages` 及[AI 智能体功能说明](../features/AI_AGENTS.md)为准。

### 7.2 正面案例：article service 的 eager loading

`backend/app/services/articles/article.py` 使用 `selectinload` 加载作者、分类、样式；
复用前仍须核对本次列表上限、所需关系与 SQL 次数。

## 第八部分：优化检查清单

1. 权限、事务、排序、分页、错误和取消语义是否保持？
2. 输入、结果和内存是否有界，循环查询是否可批量处理？
3. 代表性规模下查询次数、耗时或内存是否有前后实测，样本量是否说明？
4. 迁移、锁影响、回退及相关回归是否覆盖，未测项是否单列？

## 第九部分：性能优化清单

统一维护在[项目台账](../plans/project-consolidation.md#未结事项)，本页不另设高/中/低优先级清单。
没有新证据时，不恢复会话缓存、不安装监控扩展、不自动迁移 keyset 或精简字体。

## 第十部分：工具和资源

优先当前查询日志、已有监控、迁移源码和执行计划；工具安装不等于性能验证。
数据库结构与发布操作见[部署指南](../operations/DEPLOY.md#数据库迁移策略)，
历史分析见[归档索引](../archive/README.md)。

## 风险控制

逐次验证一个明确瓶颈，保存基线和前后结果；索引、查询改写与连接池调整分别评估写入、锁、
并发和资源影响。结构变更先准备迁移与回退，不用裸 SQL 临时修补后补文档。

本文于 2026-04-11 合并早期指南，2026-07-13 移除失效备份入口；2026-10-31 收拢为项目参考，
保留历史候选和已实施索引的来源，移除泛化代码教程、重复清单及未经核准的执行建议。
