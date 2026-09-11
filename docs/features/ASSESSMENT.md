# Assessment 总 Owner

> 状态：active
> Owner：assessment
> 功能与 Prompt 契约版本：v2.0
> 最近复核：2026-09-08
> 归档条件：当评估模块的 API、DB、前端和提示词契约被更细粒度 owner 完整替代时

本文是自主检测系统的唯一长期 owner。它整合测评配置、题库、会话、画像、前端入口、
AI Prompt 和验证入口；历史阶段计划不再作为当前行为依据。

[`hot_agent.md`](assessment/hot_agent.md) 和
[`chain_agent.md`](assessment/chain_agent.md) 保持独立运行的 prompt owner，不并入本文。

## 1. 功能边界

自主检测系统围绕“测评 - 评分 - 画像 - 复盘”闭环工作。

- 管理端当前只允许 `admin` 和 `super_admin` 创建配置、维护题库、查看统计、重测、
  导出和生成画像；`teacher` 当前没有 Assessment 管理权限。
- 学生或教职工（`student/teacher/admin/super_admin`）可查看开放测评、答题、提交并读取自己的结果和画像；学生端路由统一使用 `require_student_or_staff`，会话和画像接口另校验当前用户归属。
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

- 可用列表只返回已启用且位于 `available_start` / `available_end` 时间窗内的配置；列表与新建会话共用服务层时间判断，以 timezone-aware 当前时刻比较，起止时刻均包含在窗内，未设置的一侧不限制。
- 起测先校验配置存在且启用，再尝试复用本人同配置的 `in_progress` 会话；仅在没有可复用会话、准备新建时检查开放窗。尚未开始或已结束分别返回 HTTP 422（`该测评尚未开始` / `该测评已结束`），拒绝发生在查题、AI 生成和 session/answer 写入之前。
- 时间窗只限制新建，不中断已有会话续答：跨截止或窗口被调整到未来时，仍可恢复原会话，保留开始时间与已答记录，不重新抽题。列表仍隐藏窗外配置；续答须通过已有会话入口。禁用配置仍拒绝起测接口的恢复请求；其他用户、其他配置或非进行中历史会话不能豁免新建时间窗。
- PostgreSQL 起测先取得按 `(config_id, user_id)` 稳定散列、带业务命名空间的事务级 advisory lock，再读配置及本人进行中会话；已有会话使用普通 `FOR UPDATE` 等待保存/交卷，不能 `SKIP LOCKED` 后另建。正常 READ COMMITTED 请求经此入口并发首次起测会复用同一已提交会话，不同学生或不同配置不共用该业务锁。锁随事务提交、回滚或请求会话关闭释放，供应商调用仍占用起测事务。
- 这不是数据库唯一约束：不修复历史重复会话，不保护绕过服务直接插入、旧版本混跑或非默认快照隔离；SQLite 单元测试也不提供并发唯一性保证。没有新增 schema/migration，不擅自合并历史记录。
- 固定题从题库随机抽取；自适应题按知识点生成首题，当前仅在答错且未达到
  `max_attempts` 时追加下一题。`mastery_streak` 用于返回掌握状态，不保证系统会持续
  追加正确题直到达到该次数。
- 单题答案一旦提交不可修改。选择题提交后立即精确判分；填空题提交后立即使用智能体
  评分，未配置智能体或 AI 失败时按文本比对降级；简答题单题提交时只保存答案，在整卷
  提交时统一评分。未作答题按 0 分处理。
- 单题保存与整卷提交在读取状态前锁定同一会话行，锁持续至事务提交或回滚。以取得锁的顺序串行处理：先保存成功的答案计入随后交卷；先交卷成功则后续保存被拒绝；重复保存或交卷不能同时成功。这不是按 HTTP 到达顺序的排队保证，也不是响应丢失时的幂等恢复。
- 写入等待后刷新 ORM 会话状态及单题答案快照；普通题目/结果只读不新增行锁。不同会话不共用该锁。AI 评分/自适应出题仍在原事务内，同会话请求可能等待供应商调用；超时、取消与长事务压力需要单独验收。数据库异常由请求事务边界回滚，不新增结构迁移。
- 整卷结果仅对归属本人且处于 `submitted` / `graded` 的会话开放；`in_progress`（包括全部已答）及其他非结果状态返回 422，不提前提供标准答案或解析。单题已提交后的合法即时反馈不受此限制。
- 新会话自适应首题使用逐题保存点：保存点内的生成或 SQL 写入失败只回滚当前题，再建立原合同中的无快照占位答案，保留外层新会话及此前固定/成功答案。边界是保存点已经建立；若建立前自动 flush 固定答案或前一题占位答案失败，则请求整体失败，由会话关闭回滚，不能声称仍可占位成功；隔离 SQLite/PG 用新 Session 验证无会话/答案部分提交。占位题后续评分与供应商故障体验仍需专项验收，不把该恢复机制当作首次起测严格并发幂等。AI JSON 解析集中在 `backend/app/services/assessment/ai_response_parsing.py`，`session_service` 保留兼容导出。
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
- 当前 head 为 `20260807_0001_task_analyses_idxs`。
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
- 个人画像详情必须同时满足 `profile_type=individual` 和本人 `target_id`；group/class 的数字标识即使与用户 ID 相同也返回 403。不存在仍为 404；管理员需使用原管理端入口读取非个人类型，个人入口不因角色提升而豁免类型检查。
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

提交交互使用单题保存/整卷提交共享的同步互斥保护，最终确认也重新检查，不能依赖按钮 disabled 或旧确认回调。保存中拒绝交卷并提示用户稍后显式重试，不排队自动结算；未保存/失败草稿按 answer ID 保留，跨题导航可恢复，保存成功前阻止交卷。选择题失败可“重试保存”，填空题可“提交”或 Enter，简答题可“保存”；简答失败后的 blur 不自动重试。已确认提交成功而结果加载失败时，再试只读结果，不重复交卷。

倒计时当前仅提示时间，归零不自动提交；本轮没有新增截止后禁答规则。单题 timeout 按失败保留草稿，要求显式恢复，不把请求结束当成保存成功。服务端已写入但响应丢失的歧义、跨标签页并发、刷新/退出后草稿恢复及 PostgreSQL 事务仍须专项验收；这些内存保护不提供服务端幂等性或持久草稿。


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
- 后端专项：`cd backend && pytest -q tests/assessment`；先确认专用数据库安全边界。
- 开放时间窗隔离回归：`cd backend && pytest -q tests/assessment/test_assessment_availability_isolated.py`，使用真实学生 router/JWT/角色守卫/service/ORM 和合成 SQLite 内存库。覆盖窗内外、起止边界、等价 aware offset、会话续答与拒绝先于副作用；安全入口与扩展筛选见 [后端测试说明](../../backend/tests/README.md#测评开放时间窗隔离回归)。SQLite 配置加载适配不代替真实 PostgreSQL 时区转换或并发验收。
- 真实 PostgreSQL 班级隔离回归优先读取 `TEST_DATABASE_URL`，且数据库名必须包含
  `test`、`testing` 或 `ci`；未显式提供且默认库不合规时跳过，显式提供不合规库名则拒绝执行，不接触业务库。
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
