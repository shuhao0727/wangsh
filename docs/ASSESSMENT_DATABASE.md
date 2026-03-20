# 数据库设计（7 张新表）

> 隶属于 [ASSESSMENT_DESIGN.md](./ASSESSMENT_DESIGN.md)

---

## 1. 测评配置表 `znt_assessment_configs`

教师在后台创建的测评方案，定义教学目标、知识点、题型和出题规则。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| title | String(200) | 测评标题，如"Python循环结构课堂检测" |
| subject | String(100) | 学科，如"信息技术" |
| grade | String(20) | 年级，如"高一" |
| teaching_objectives | Text | 教学目标（支持 Markdown） |
| knowledge_points | Text | 知识点列表，JSON 数组格式，如 `["for循环","while循环","循环嵌套","break/continue"]` |
| total_score | Integer | 总分，默认 100 |
| question_config | Text | 题型配置 JSON，如 `{"choice":{"count":5,"score":10},"fill":{"count":3,"score":10},"short_answer":{"count":2,"score":10}}` |
| ai_prompt | Text | 教师自定义的出题提示词（与系统模板合并） |
| agent_id | Integer FK → znt_agents.id | 用于出题和评分的 AI 智能体 |
| time_limit_minutes | Integer | 答题时限（分钟），0 表示不限时 |
| enabled | Boolean | 是否对学生开放 |
| created_by_user_id | Integer FK → sys_users.id | 创建者（教师） |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

---

## 2. 题库表 `znt_assessment_questions`

预生成或实时生成的题目。每道题归属于一个测评配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| config_id | Integer FK → znt_assessment_configs.id | 所属测评配置 |
| question_type | String(20) | 题型：`choice`（选择）/ `fill`（填空）/ `short_answer`（简答） |
| content | Text | 题目内容（支持 Markdown） |
| options | Text | 选项 JSON（仅选择题），如 `["A. 10","B. 20","C. 30","D. 40"]` |
| correct_answer | Text | 正确答案（选择题为 "A"，填空题为文本，简答题为参考答案） |
| score | Integer | 该题分值 |
| difficulty | String(10) | 难度：`easy` / `medium` / `hard` |
| knowledge_point | String(200) | 对应的知识点 |
| explanation | Text | 答案解析 |
| source | String(20) | 来源：`ai_generated`（预生成）/ `manual`（手动录入）/ `ai_realtime`（实时生成） |
| created_at | DateTime | 创建时间 |

---

## 3. 测评会话表 `znt_assessment_sessions`

每个学生每次参加测评时创建一个会话，记录答题状态和最终得分。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| config_id | Integer FK → znt_assessment_configs.id | 所属测评配置 |
| user_id | Integer FK → sys_users.id | 学生 |
| status | String(20) | 状态：`pending`→`in_progress`→`submitted`→`graded` |
| started_at | DateTime | 开始答题时间 |
| submitted_at | DateTime | 提交时间 |
| total_score | Integer | 满分 |
| earned_score | Integer | 实际得分 |
| created_at | DateTime | 创建时间 |

**唯一约束：** 同一学生对同一测评配置只能有一个 `in_progress` 状态的会话。

> 注意：v1.0 中的 `ai_report` 字段已移除，初级画像改为独立的 `znt_assessment_basic_profiles` 表存储。

---

## 4. 答题记录表 `znt_assessment_answers`

每道题的作答详情，支持预生成题目和实时生成题目两种模式。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| session_id | Integer FK → znt_assessment_sessions.id | 所属会话 |
| question_id | Integer FK → znt_assessment_questions.id (nullable) | 题目 ID（预生成模式） |
| question_snapshot | Text | 题目完整快照 JSON（实时生成模式，确保题目不丢失） |
| question_type | String(20) | 题型（冗余存储，方便查询） |
| student_answer | Text | 学生提交的答案 |
| is_correct | Boolean (nullable) | 是否正确（选择题即时判定，填空/简答由 AI 判定） |
| ai_score | Integer (nullable) | AI 评分（填空/简答题） |
| ai_feedback | Text | AI 评语（每道题的个性化反馈） |
| max_score | Integer | 该题满分 |
| answered_at | DateTime | 作答时间 |

---

## 5. 初级画像表 `znt_assessment_basic_profiles`（新增）

学生提交测评后自动生成的初级画像，仅基于本次测评数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| session_id | Integer FK → znt_assessment_sessions.id (unique) | 关联的测评会话，一对一 |
| user_id | Integer FK → sys_users.id | 学生 |
| config_id | Integer FK → znt_assessment_configs.id | 关联的测评配置 |
| earned_score | Integer | 实际得分 |
| total_score | Integer | 满分 |
| knowledge_scores | Text | 各知识点得分 JSON，如 `{"for循环":{"earned":18,"total":20},"while循环":{"earned":8,"total":10}}` |
| wrong_points | Text | 错题知识点 JSON 数组，如 `["循环嵌套","break/continue"]` |
| ai_summary | Text | AI 生成的简短评语（Markdown，200字以内） |
| created_at | DateTime | 创建时间 |

**唯一约束：** `session_id` 唯一（一个会话只有一个初级画像）。

**与高级画像的区别：**
- 初级画像：自动生成，数据来源单一（仅测评），结构化数据为主 + 简短 AI 评语
- 高级画像：教师触发，三方数据融合，完整的 Markdown 分析报告

---

## 6. 高级画像表 `znt_student_profiles`

存储三维融合画像分析结果，支持个人、小组、群体三个维度。由教师手动或批量触发生成。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| profile_type | String(20) | 画像类型：`individual`（个人）/ `group`（小组）/ `class`（群体） |
| target_id | String(100) | 目标标识：个人=user_id，小组=discussion_session_id，群体=class_name |
| config_id | Integer FK (nullable) | 关联的测评配置 |
| discussion_session_id | Integer FK (nullable) | 关联的小组讨论会话 |
| agent_ids | Text | 关联的智能体 ID 列表 JSON，如 `[1,3,5]` |
| agent_id | Integer FK → znt_agents.id | 生成画像使用的 AI 智能体 |
| data_sources | Text | 实际使用的数据源 JSON，如 `["assessment","discussion","agent_chat"]` |
| result_text | Text | 画像内容（Markdown 格式，完整分析报告） |
| scores | Text | 结构化评分 JSON，如 `{"knowledge":85,"participation":70,"thinking":60,"autonomy":75}` |
| created_by_user_id | Integer FK → sys_users.id | 创建者（教师） |
| created_at | DateTime | 创建时间 |

**说明：**
- `discussion_session_id` 和 `agent_ids` 是 v2.0 新增字段，用于精确记录画像生成时选择的数据源
- 个人画像的 `target_id` = user_id，小组画像 = discussion_session_id，群体画像 = class_name
- `scores` 字段的维度根据 `profile_type` 不同而不同（见下方）

**scores 结构：**

```json
// 个人画像
{"knowledge": 85, "participation": 70, "thinking": 60, "autonomy": 75, "blind_spots": 2}

// 小组画像
{"avg_score": 78, "collaboration": 72, "complementarity": 65, "weakness_count": 3}

// 群体画像
{"avg_score": 75, "pass_rate": 82, "ai_dependency": 45, "common_issues": 4}
```

---

## 7. 测评-智能体关联表 `znt_assessment_config_agents`

一次测评可以关联多个课堂使用的智能体，用于跨系统分析时拉取学生的 AI 对话数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| config_id | Integer FK → znt_assessment_configs.id | 测评配置 |
| agent_id | Integer FK → znt_agents.id | 课堂使用的智能体 |

**唯一约束：** `(config_id, agent_id)` 联合唯一。

---

## ER 关系图

```
znt_assessment_configs (1) ──→ (N) znt_assessment_questions
znt_assessment_configs (1) ──→ (N) znt_assessment_sessions
znt_assessment_configs (1) ──→ (N) znt_assessment_config_agents
znt_assessment_sessions (1) ──→ (N) znt_assessment_answers
znt_assessment_sessions (1) ──→ (1) znt_assessment_basic_profiles  ← 初级画像
znt_assessment_configs (1) ──→ (N) znt_student_profiles            ← 高级画像
sys_users (1) ──→ (N) znt_assessment_sessions
sys_users (1) ──→ (N) znt_assessment_basic_profiles
znt_agents (1) ──→ (N) znt_assessment_config_agents
```
