# Assessment 总 Owner

> 状态：active
> Owner：assessment
> 功能与 Prompt 契约版本：v2.0
> 最近复核：2026-07-23
> 归档条件：当评估模块的 API、DB、前端和提示词契约被更细粒度 owner 完整替代时

本文是自主检测系统的唯一长期 owner。它整合测评配置、题库、会话、画像、前端入口、
AI Prompt 和验证入口；历史阶段计划不再作为当前行为依据。

[`hot_agent.md`](assessment/hot_agent.md) 和
[`chain_agent.md`](assessment/chain_agent.md) 保持独立运行的 prompt owner，不并入本文。

## 1. 功能边界

自主检测系统围绕“测评 - 评分 - 画像 - 复盘”闭环工作。

- 管理端当前只允许 `admin` 和 `super_admin` 创建配置、维护题库、查看统计、重测、
  导出和生成画像；`teacher` 当前没有 Assessment 管理权限。
- 登录用户可查看开放测评、答题、提交并读取自己的结果和画像；会话和画像接口校验
  当前用户归属。
- 提交整卷后，系统后台生成初级画像；配置了出题智能体时，还会在不存在同配置个人画像
  的情况下自动生成个人高级画像。
- 管理员可手工生成个人、小组、群体高级画像，也可批量生成个人画像。
- 初级画像只基于本次测评；高级画像按画像类型和请求参数选择数据源，`data_sources`
  保存服务声明的来源标签，不作为 AI 实际读取内容的运行时审计。

当前实现沿用三大数据源：

- 自主检测数据：`znt_assessment_*`
- 小组讨论数据：`znt_group_discussion_*`
- AI 智能体对话：`znt_conversations`

### 会话与答题边界

- 可用列表只返回已启用且位于 `available_start` / `available_end` 时间窗内的配置。
- 开始测评时，服务层使用 `FOR UPDATE SKIP LOCKED` 查询并复用已有 `in_progress`
  会话。当前数据库没有 `(config_id, user_id)` 的进行中唯一约束，因此两个首次并发请求
  仍可能分别创建会话；API 调用方不能把这一行为当作严格幂等保证。
- 固定题从题库随机抽取；自适应题按知识点生成首题，当前仅在答错且未达到
  `max_attempts` 时追加下一题。`mastery_streak` 用于返回掌握状态，不保证系统会持续
  追加正确题直到达到该次数。
- 单题答案一旦提交不可修改。选择题提交后立即精确判分；填空题提交后立即使用智能体
  评分，未配置智能体或 AI 失败时按文本比对降级；简答题单题提交时只保存答案，在整卷
  提交时统一评分。未作答题按 0 分处理。
- 自适应补题用于练习反馈，最终总分按每个知识点的首次作答去重计算。

## 2. 数据模型与迁移

当前数据库契约是 7 张表：

1. `znt_assessment_configs`
2. `znt_assessment_questions`
3. `znt_assessment_sessions`
4. `znt_assessment_answers`
5. `znt_assessment_basic_profiles`
6. `znt_student_profiles`
7. `znt_assessment_config_agents`

迁移和修复约束：

- `backend/alembic/versions/20260318_0001_assessment_tables.py` 创建 7 张基础表。
- `backend/alembic/versions/20260711_0001_add_assessment_availability.py` 是 repair
  migration，补齐 `available_start`、`available_end`、`mode`、`adaptive_config`、
  `knowledge_point`、`attempt_seq`、`is_adaptive` 7 个字段；其 `downgrade()` 为保护
  既有数据而不删除字段。
- 当前 head 为 `20260711_0002_restore_legacy_baseline_indexes`。
- 已存在数据库必须执行 `alembic upgrade head`，不依赖 ORM `create_all` 补齐结构。

各表没有统一的时间列模板：只有配置表有 `updated_at`，答题表使用 `answered_at`，
关联表没有时间列。下表按当前 ORM 列出持久化约束。

### 字段与约束

| 表 | 非空列与默认值 | 可空列 | 外键、索引与唯一约束 |
|---|---|---|---|
| `znt_assessment_configs` | `id INTEGER PK`；`title VARCHAR(200)`；`total_score INTEGER DEFAULT 100`；`time_limit_minutes INTEGER DEFAULT 0`；`enabled BOOLEAN DEFAULT false`；`created_at TIMESTAMPTZ DEFAULT now()`；`updated_at TIMESTAMPTZ DEFAULT now()` | `grade VARCHAR(20)`、`teaching_objectives TEXT`、`knowledge_points TEXT`、`question_config TEXT`、`ai_prompt TEXT`、`agent_id INTEGER`、`available_start/end TIMESTAMPTZ`、`created_by_user_id INTEGER` | `agent_id`、`created_by_user_id` 删除时置空；`id` 索引 |
| `znt_assessment_questions` | `id INTEGER PK`；`config_id INTEGER`；`question_type VARCHAR(20)`；`content TEXT`；`correct_answer TEXT`；`score INTEGER`；`difficulty VARCHAR(10) DEFAULT medium`；`source VARCHAR(20) DEFAULT ai_generated`；`mode VARCHAR(20) DEFAULT fixed`；`created_at TIMESTAMPTZ DEFAULT now()` | `options TEXT`、`knowledge_point VARCHAR(200)`、`explanation TEXT`、`adaptive_config TEXT` | `config_id` 级联删除并建立索引 |
| `znt_assessment_sessions` | `id INTEGER PK`；`config_id INTEGER`；`user_id INTEGER`；`status VARCHAR(20) DEFAULT pending`；`total_score INTEGER`；`created_at TIMESTAMPTZ DEFAULT now()` | `started_at/submitted_at TIMESTAMPTZ`、`earned_score INTEGER` | config/user 均级联删除并建立索引；当前无进行中会话唯一约束 |
| `znt_assessment_answers` | `id INTEGER PK`；`session_id INTEGER`；`question_type VARCHAR(20)`；`max_score INTEGER`；`attempt_seq INTEGER DEFAULT 1`；`is_adaptive BOOLEAN DEFAULT false` | `question_id INTEGER`、`question_snapshot TEXT`、`student_answer TEXT`、`is_correct BOOLEAN`、`ai_score INTEGER`、`ai_feedback TEXT`、`knowledge_point VARCHAR(200)`、`answered_at TIMESTAMPTZ` | `session_id` 级联删除并建立索引；`question_id` 删除时置空 |
| `znt_assessment_basic_profiles` | `id INTEGER PK`；`session_id/user_id/config_id INTEGER`；`earned_score/total_score INTEGER`；`created_at TIMESTAMPTZ DEFAULT now()` | `knowledge_scores TEXT`、`wrong_points TEXT`、`ai_summary TEXT` | session/user/config 均级联删除；`session_id` 唯一，user/config 建索引 |
| `znt_student_profiles` | `id INTEGER PK`；`profile_type VARCHAR(20)`；`target_id VARCHAR(100)`；`created_at TIMESTAMPTZ DEFAULT now()` | `config_id/discussion_session_id/agent_id/created_by_user_id INTEGER`、`agent_ids/data_sources/result_text/scores TEXT` | 可选外键删除时置空；`profile_type`、`target_id` 建索引 |
| `znt_assessment_config_agents` | `id INTEGER PK`；`config_id INTEGER`；`agent_id INTEGER` | 无 | 两端均级联删除并建索引；`(config_id, agent_id)` 联合唯一 |

字符串枚举由 Pydantic 和服务层校验，数据库当前没有 CHECK 约束：

- `question_type`：`choice`、`fill`、`short_answer`
- `difficulty`：`easy`、`medium`、`hard`
- `source`：`ai_generated`、`manual`、`ai_realtime`
- `mode`：`fixed`、`adaptive`
- `session.status`：`pending`、`in_progress`、`submitted`、`graded`
- `profile_type`：`individual`、`group`、`class`

JSON 字段当前以 `Text` 保存：`knowledge_points`、`question_config`、`options`、
`adaptive_config`、`question_snapshot`、`knowledge_scores`、`wrong_points`、
`agent_ids`、`data_sources` 和 `scores`。修改这些字段结构时必须同时检查服务层解析、
Pydantic schema、前端类型和已有数据兼容。

历史 migration 中 `znt_assessment_configs.subject` 仍存在，但当前 ORM 和 Pydantic
配置契约不读写该列。它属于兼容 schema，不应在未提供正式 migration 前直接删除。

## 3. API 契约

API 统一挂在 `backend/app/api/endpoints/assessment/` 下，完整路径前缀为
`/api/v1/assessment`。完整端点表、HTTP 方法和请求字段约束由
[API.md](../development/API.md#十三自适应测评assessment)维护，本文不重复路径清单。

### 权限边界

- 管理端后端统一使用 `require_admin`，即 `admin` 或 `super_admin`。
- 管理端前端路由统一使用 `ADMIN_ROLES`，与后端保持一致。
- 登录用户端使用 `get_current_user`，会话、结果和画像按用户 ID 校验归属。
- 画像的 `profile_type` 仅允许 `individual`、`group`、`class`。
- 群体画像的 `target_id` 是班级名，测评统计必须同时按 `config_id` 和该班学生 ID 过滤。
- 小组画像必须绑定 `discussion_session_id`；批量生成只支持个人画像。
- 若未来向 `teacher` 开放，必须同时修改后端依赖、前端路由角色和
  `frontend/src/styles/ROLES.md`，不能只放开菜单。

## 4. 前端契约

### 学生端入口

- `frontend/src/pages/AIAgents/AssessmentPanel.tsx`
- 挂载：`frontend/src/pages/AIAgents/index.tsx`

该浮动窗保留三个顶层视图：

- 列表
- 答题
- 结果

初级画像和三维画像位于结果视图内的 Tabs，不是独立顶层视图。

浮窗只把布局偏好写入 `localStorage`，不持久化答题或画像业务数据：

- `assessment_floating_pos`
- `assessment_floating_size`
- `assessment_floating_pinned`
- `assessment_btn_top`

### 管理端页面

| 路由 | 页面 |
|---|---|
| `/admin/assessment` | `frontend/src/pages/Admin/Assessment/index.tsx` |
| `/admin/assessment/editor/new` | `frontend/src/pages/Admin/Assessment/EditorPage.tsx`，只创建基础配置 |
| `/admin/assessment/editor/{id}` | `EditorPage.tsx` 接收旧入口后立即跳转题库页 |
| `/admin/assessment/{id}/questions` | `frontend/src/pages/Admin/Assessment/QuestionsPage.tsx` |
| `/admin/assessment/{id}/statistics` | `frontend/src/pages/Admin/Assessment/StatisticsPage.tsx` |

路由和角色挂载位于 `frontend/src/App.tsx`，侧边栏入口位于
`frontend/src/layouts/AdminLayout.tsx`。

### 服务层

- `frontend/src/services/assessment/`

### 关键交互

- 列表页负责筛选、开关状态和新建入口
- 新建页负责标题、年级、知识点、教学目标和主智能体，创建后进入题库页。静态路由
  `/admin/assessment/editor/new` 不提供 `id` 参数，页面必须把参数缺失识别为新建
  模式；只有 `/admin/assessment/editor/{id}` 的真实 ID 才进入旧入口跳转逻辑。
- 题库页同时负责配置编辑、开放时间、Prompt、智能体关联、自适应知识点，以及题目的
  AI 生成、手动录入、预览、编辑和删除
- 统计页负责成绩分布、知识点掌握率、学生列表和画像入口
- 画像入口并入统计页，不单独拆出 `/admin/assessment/profiles`

### 2026-07-23 续验记录

- Docker 真实页面复验覆盖 `/admin/assessment`、`/admin/assessment/editor/new`、
  题目页和统计页；新建页不再因静态 `new` 路由缺少 `id` 而永久加载。
- 自适应题和已评分会话的前端分页读取已按后端上限分段请求，定向跨页合同测试通过；
  复验期间未出现 `422`、`500` 或前端运行时错误。

## 5. Prompt 契约与维护

当前 Prompt 契约版本为 `v2.0`。运行时模板不从本文复制，而由以下源码维护：

- 批量出题：`backend/app/services/assessment/question_service.py`
- 自适应实时出题与评分：`backend/app/services/assessment/session_service.py`
- 初级画像：`backend/app/services/assessment/basic_profile_service.py`
- 个人、小组、群体高级画像：`backend/app/services/assessment/profile_service.py`

### 出题 Prompt

教师自定义 `ai_prompt` 与系统模板合并后发送，要求输出题目 JSON 数组，字段至少包含：

- `type`
- `content`
- `options`
- `correct_answer`
- `score`
- `difficulty`
- `knowledge_point`
- `explanation`

### 评分 Prompt

用于填空题和简答题，要求返回结构化 JSON：

- `score`
- `is_correct`
- `feedback`

### 初级画像 Prompt

学生提交后后台触发，仅基于本次检测生成 120 字以内、无标题的 Markdown 简短画像，包含：

- 总评
- 优势知识点
- 待加强知识点
- 具体建议

### 高级画像 Prompt

高级画像输出 Markdown 报告，并在末尾追加可解析的 JSON `dimensions` 评分块；服务层
会把 Markdown 与 JSON 分离存入 `result_text` 和 `scores`。

- 个人：可融合测评、小组讨论和 AI 对话；自动生成路径当前只传入本次测评配置。
- 小组：使用小组讨论，可选融合测评。
- 群体：当前使用班级测评聚合数据。

当前高级画像输出合同：

| 类型 | Markdown 章节 | 字数约束 | `dimensions` 键 |
|---|---|---|---|
| 个人 | 知识掌握、协作能力、自主学习、思维特征、知识盲点、个性化学习建议 | 每节 30-50 字，总计不超过 300 字 | 知识掌握、协作能力、自主学习、思维特征、知识盲点修复 |
| 小组 | 整体水平、成员互补性、协作模式、薄弱环节、小组提升建议 | 每节 50-80 字，总计不超过 500 字 | 整体水平、成员互补性、协作模式、知识覆盖、讨论质量 |
| 群体 | 知识点掌握分布、共性问题、学习模式分析、分层教学建议、教学调整建议 | 每节 60-100 字，总计不超过 600 字 | 知识掌握、共性问题、学习模式、分层教学、教学效果 |

评分块必须使用 fenced `json`，结构为 `{"dimensions": {...}}`，每个维度为
0-100 分。服务层无法解析该块时仍保留 Markdown 正文，但 `scores` 为空对象。

维护规则：

- `ai_prompt` 只追加到批量出题模板；自适应题使用 `adaptive_config.prompt_hint`。
- 修改输入变量、JSON 字段、Markdown 章节、字数限制或 `dimensions` 结构时，必须同步
  本文和对应 service 测试。
- Prompt 解析失败必须走现有显式失败或降级路径，不把无法解析的自由文本当作结构化结果。

## 6. 验证入口

- 文档与链接合同：`node scripts/check-markdown-contracts.mjs`
- 文档合同测试：`node --test scripts/markdown-contracts.test.mjs`
- 后端专项：`cd backend && pytest -q tests/assessment`
- 真实 PostgreSQL 班级隔离回归优先读取 `TEST_DATABASE_URL`，且数据库名必须包含
  `test`、`testing` 或 `ci`；未提供安全测试库时该用例跳过，不接触业务库。
- 前端服务合同：`cd frontend && npm test -- src/services/assessment/__tests__/types.test.ts`
- 前端路由回归：
  `cd frontend && npm test -- src/components/assessmentEditorRoute.test.tsx`
- 生产式 smoke：`backend/scripts/smoke_assessment_flow.py`，由
  `scripts/prod-smoke/run.py` 的 Assessment 模块编排
- 当前测试状态：`docs/docker/testing/TEST_STATUS.md`

## 7. 相关文件

- `README.md`
- `docs/README.md`
- `docs/DOCUMENTATION_RULES.md`
- `docs/development/API.md`
- `docs/docker/testing/README.md`
- `docs/docker/testing/TEST_STATUS.md`
- `backend/app/api/endpoints/assessment/`
- `backend/app/services/assessment/`
- `frontend/src/services/assessment/`
- [hot_agent.md](assessment/hot_agent.md) - 学生热点问题分析 Agent Prompt
- [chain_agent.md](assessment/chain_agent.md) - 学生问题链分析 Agent Prompt

---

## 附录：AI Agent Prompts

本模块使用两个独立的 AI Agent 进行学习数据分析：

### A1. 热点问题分析 Agent (hot_agent.md)
- **职责**：识别学生高频提问、共性困惑和知识盲区
- **输入**：课程会话数据、学生提问记录
- **输出**：热点问题排序、困难点分析、教学建议
- **详细文档**：[assessment/hot_agent.md](assessment/hot_agent.md)

### A2. 问题链分析 Agent (chain_agent.md)
- **职责**：追踪学生思维过程、分析学习路径演化
- **输入**：学生问题序列、任务单、教师提问
- **输出**：认知建构分析、学习障碍诊断、个性化建议
- **详细文档**：[assessment/chain_agent.md](assessment/chain_agent.md)

这两个 Agent 的 Prompt 保持独立维护，不并入主文档，以便灵活调整和版本管理。
