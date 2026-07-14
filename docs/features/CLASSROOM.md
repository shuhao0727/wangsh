# 课堂互动系统文档

> 最后更新：2026-07-11

## 概述

课堂互动系统支持教师在课堂上发起实时互动活动，学生通过 Web 界面参与响应。系统包含课堂活动和课堂计划两大功能模块。

### 核心功能

- **课堂活动**：实时互动（投票/填空）、学生响应、统计分析、AI 分析
- **课堂计划**：课堂流程管理、活动排序、进度控制
- **SSE 推送**：实时推送活动状态变化，支持按班级隔离

---

## 架构设计

### 技术架构

- **后端**：FastAPI + SQLAlchemy（异步）+ SSE pub/sub（`app.core.pubsub`）
- **前端**：React + TypeScript + Tailwind CSS
- **数据库**：PostgreSQL，4 张核心表

### 数据模型

**核心表**：

| 表名 | 说明 |
|------|------|
| `znt_classroom_activities` | 课堂活动 |
| `znt_classroom_responses` | 学生响应 |
| `znt_classroom_plans` | 课堂计划 |
| `znt_classroom_plan_items` | 课堂计划项 |

---

## 课堂活动

### 活动类型

系统仅支持两种活动类型（`ActivityType = Literal["vote", "fill_blank"]`）：

| 类型 | 标识 | 说明 | AI 分析 |
|------|------|------|---------|
| 投票 | `vote` | 学生从预设选项中选择，支持单选/多选 | 不支持（`not_applicable`） |
| 填空题 | `fill_blank` | 学生提交填空答案，支持多个空位 | 支持（默认 `pending`） |

**注意**：系统不存在 `question`、`poll`、`discussion`、`quiz` 等类型。

### 活动状态机

| 状态 | 说明 | 可执行操作 |
|------|------|-----------|
| `draft` | 草稿，未开始 | 编辑、删除、启动（start） |
| `active` | 进行中，学生可响应 | 结束（end） |
| `ended` | 已结束 | 查看统计、重启（restart）、查看分析结果 |

**状态转换**：
- `draft` --[start]--> `active` --[end]--> `ended` --[restart]--> `active`
- `delete` 仅限 `draft` 状态
- `update` 仅限 `draft` 状态（`active` 状态下不可编辑）

### ClassroomActivity 模型字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `activity_type` | String(20) | 活动类型：`"vote"` 或 `"fill_blank"` |
| `title` | String(200) | 活动标题 |
| `class_name` | String(50), nullable, indexed | 班级名称，用于学生端班级隔离，可为空 |
| `description` | Text, nullable | 活动描述，教师附加说明 |
| `options` | JSON, nullable | 投票选项，格式：`[{"key":"A","text":"..."},...]` |
| `correct_answer` | String(500), nullable | 正确答案 |
| `allow_multiple` | Boolean | 是否允许多选投票，默认 `False` |
| `time_limit` | Integer | 时间限制（秒），默认 60，0 表示无限制 |
| `status` | String(20) | 状态：`draft` / `active` / `ended`，默认 `draft` |
| `started_at` | DateTime(tz), nullable | 开始时间 |
| `ended_at` | DateTime(tz), nullable | 结束时间 |
| `analysis_agent_id` | Integer, FK | 分析智能体快照 ID（FK -> `znt_agents.id`） |
| `analysis_prompt` | Text, nullable | 分析提示词快照 |
| `analysis_status` | String(20), nullable | 分析状态（见下方分析状态机） |
| `analysis_result` | Text, nullable | 分析文本结果 |
| `analysis_context` | JSON, nullable | 结构化分析上下文 |
| `analysis_error` | Text, nullable | 分析失败错误信息 |
| `analysis_updated_at` | DateTime(tz), nullable | 分析更新时间 |
| `created_by` | Integer, FK | 创建者（FK -> `sys_users.id`, CASCADE） |
| `created_at` | DateTime(tz) | 创建时间，服务端默认 now() |
| `updated_at` | DateTime(tz) | 更新时间，自动更新 |

### 分析状态机（analysis_status）

| 状态 | 说明 | 触发条件 |
|------|------|---------|
| `not_applicable` | 不适用分析 | `vote` 类型活动创建时的默认值 |
| `pending` | 等待分析 | `fill_blank` 类型活动创建时的默认值 |
| `running` | 分析中 | 后台 worker 已认领任务并开始分析 |
| `success` | 分析成功 | AI 分析完成并返回结果 |
| `failed` | 分析失败 | AI 分析出错 |
| `skipped` | 已跳过 | 没有有效作答数据或没有风险空位 |

**自动触发条件**：`fill_blank` 活动成功结束并提交事务后，系统先发布全部 SSE 状态事件，再把分析任务投递到 Celery 默认 `celery` 队列。教师选择的 `analysis_agent_id` 作为首选智能体；未指定或首选不可用时，会按可用智能体列表回退。

### 填空题 AI 分析

**功能**：活动结束后，AI 自动分析学生填空答题情况。

**触发方式**：
- **教师结束活动**时，前端的 AnalysisModal 可选择 AI 代理并传递 `analysis_agent_id`
- 活动结束事务提交后，系统通过后台 worker 异步触发分析，不阻塞结束活动接口

**幂等与重试**：
- `success`、`failed`、`skipped` 等终态在普通重复投递时直接返回，不会重复调用 AI
- 同一活动已有 `running` 任务时，普通重复投递直接跳过
- Celery 对异常任务自动重试时可以接管遗留的 `running` 或可重试 `failed` 状态，
  避免 worker 中断或临时提供商故障后永久卡住
- broker 发布使用有限重试；最终仍无法入队时写入可观察的 `failed` 和错误摘要，
  教师重新选择智能体可手工接管并重投
- 课堂分析任务启用 late ack 和 worker-lost 重投；broker redelivery 会接管遗留
  `running` 状态，避免 worker 被强制终止后永久卡住
- 所有候选 AI 提供商都失败时，服务先提交可观察的 `failed` 状态和错误摘要，再抛出
  专用可重试异常；未配置可用智能体属于配置失败，只记录状态，不触发自动重试
- 分析写回前会重新锁定活动，并用 `ended_at` 确认仍是同一结束轮次；活动已重启或再次结束时，旧轮次结果不会覆盖新轮次状态
- 活动已被重启为 `active` 时，旧的延迟分析任务直接跳过；下一次结束会产生新的分析任务

**提示词配置**：
- **默认提示词**：系统内置，200 字简洁分析（总体结论 + 易错分析 + 教学建议）
- **自定义提示词**：创建/编辑活动时填写 `analysis_prompt` 字段，完全替换默认提示词

**分析上下文（analysis_context）**：
包含活动统计数据的结构化 JSON，供 AI 分析使用：
- 活动基本信息（标题、描述、正确答案）
- 响应统计数据（总提交数、正确率）
- 逐空位统计（各空位正确率、高频错误答案）

### 自动结束机制

系统在以下时机**限流检查**（至少间隔 30 秒）超时活动并自动结束：

- `list_activities`（管理端列表查询时）
- `get_active_activities`（学生端获取活动时）

检查逻辑：`status == "active"` 且 `time_limit > 0` 且 `started_at + time_limit <= now()`。

### ClassroomResponse 模型字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `activity_id` | Integer, FK, indexed | 活动 ID（FK -> `znt_classroom_activities.id`, CASCADE） |
| `user_id` | Integer, FK, indexed | 学生 ID（FK -> `sys_users.id`, CASCADE） |
| `answer` | String(500) | 学生答案（投票为逗号分隔的选项 key，填空为 `|` 分隔的各空位值） |
| `is_correct` | Boolean, nullable | 是否正确（有正确答案时判定） |
| `submitted_at` | DateTime(tz) | 提交时间，服务端默认 now() |

**唯一约束**：`(activity_id, user_id)` —— 每个学生对每个活动只能提交一次。

### 统计数据结构

**投票（vote）统计**：

```json
{
  "activity_id": 1,
  "total_responses": 30,
  "option_counts": {"A": 15, "B": 10, "C": 5},
  "correct_count": 15,
  "correct_rate": 50.0
}
```

**填空（fill_blank）统计**：

```json
{
  "activity_id": 1,
  "total_responses": 30,
  "correct_count": 12,
  "correct_rate": 40.0,
  "blank_slot_stats": [
    {
      "slot_index": 1,
      "correct_answer": "TCP",
      "total_count": 30,
      "correct_count": 20,
      "correct_rate": 66.7,
      "top_wrong_answers": [{"answer": "UDP", "count": 5}, ...]
    }
  ],
  "top_wrong_answers": [
    {"answer": "UDP | 传输层协议", "count": 5}
  ]
}
```

- `option_counts`：仅投票类型返回，key 为选项标识，value 为选择人数
- `blank_slot_stats`：仅填空类型返回，逐空位统计
- `top_wrong_answers`：仅填空类型返回，全局高频错误答案 TOP 10

---

## 课堂计划

### 计划模型

**ClassroomPlan（`znt_classroom_plans`）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `title` | String(200) | 计划标题 |
| `status` | String(20) | 状态：`draft` / `active` / `ended`，默认 `draft` |
| `current_item_id` | Integer, nullable | 当前进行中的 plan_item 的 id |
| `created_by` | Integer, FK | 创建者（FK -> `sys_users.id`, CASCADE） |
| `created_at` | DateTime(tz) | 创建时间 |
| `updated_at` | DateTime(tz) | 更新时间 |

**注意**：`ClassroomPlan` 没有 `class_name` 字段，也没有 `current_item_index` 字段。Items 通过 SQLAlchemy relationship 关联，**不是 JSON 列**。

**ClassroomPlanItem（`znt_classroom_plan_items`）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `plan_id` | Integer, FK, indexed | 计划 ID（FK -> `znt_classroom_plans.id`, CASCADE） |
| `activity_id` | Integer, FK | 活动 ID（FK -> `znt_classroom_activities.id`, CASCADE） |
| `order_index` | Integer | 排列顺序，默认 0 |
| `status` | String(20) | 状态：`pending` / `active` / `ended`，默认 `pending` |

Items 按 `order_index` 排序，与计划通过 `plan.items` relationship 关联。

课堂计划没有独立班级字段，因此创建或更新时，所有活动必须设置非空 `class_name`，并且必须属于同一班级。启动草稿计划时会再次校验这一约束，避免历史混合班级计划进入 active 后对学生不可见。

计划推进采用单一数据库事务：活动状态、plan item 状态和 `current_item_id` 必须一起提交。活动启动/结束失败时整次操作回滚，不会出现“计划项已 active、活动仍 draft”之类的状态分裂；SSE 和自动分析只在事务提交成功后执行。活动启动与重启会先锁定创建教师，再锁定活动；同一教师的并发状态切换被串行化，并自动结束该教师其他 active 活动。

### 计划服务操作（12 个）

| 操作 | 函数 | 说明 |
|------|------|------|
| 创建计划 | `create_plan` | 根据标题和活动 ID 列表创建计划及其 items |
| 更新计划 | `update_plan` | 仅 `draft` 状态可更新 |
| 删除计划 | `delete_plan` | 仅 `draft` 状态可删除 |
| 列出计划 | `list_plans` | 分页查询，支持 skip/limit |
| 获取计划 | `get_plan` | 获取单个计划及 items |
| 启动计划 | `start_plan` | 校验班级范围后将 `draft` 切换为 `active`，不自动启动 item |
| 下一项 | `next_item` | 结束当前 item，启动下一个 item |
| 重置计划 | `reset_plan` | `ended` -> `draft`，重置所有 items 为 pending |
| 启动项 | `start_item` | 将指定的 pending item 设为 active |
| 结束项 | `end_item` | 将 active item 设为 ended |
| 结束计划 | `end_plan` | 强制结束计划 |
| 当前计划 | `get_active_plan` | 学生端获取当前 active 计划 |

---

## SSE 实时推送

### 频道体系

| 频道 | 订阅者 | 说明 |
|------|--------|------|
| `admin_{user_id}` | 特定教师 | 教师的个人事件频道 |
| `admin_global` | `admin` / `super_admin` | 全局管理事件广播 |
| `student_{class_name}` | 特定班级学生 | 班级隔离的学生频道 |

没有班级的活动不会发布到正常学生班级频道；没有班级的学生不能建立课堂 SSE 连接。学生订阅前会统一去除班级名称首尾空白，避免查询可见但 SSE 频道不一致。

### 事件类型

| 事件 | 推送频道 | 触发时机 |
|------|---------|---------|
| `connected` | 所有频道 | SSE 连接建立 |
| `activity_started` | `student_*` + `admin_{id}` + `admin_global` | 活动开始 / 重启 |
| `activity_ended` | `student_*` + `admin_{id}` + `admin_global` | 活动结束 |
| `new_response` | `admin_{id}` + `admin_global` | 学生提交响应 |
| `activity_changed` | `admin_global` | 批量删除等批量操作 |

### 连接方式

- 管理端 SSE：`GET /classroom/admin/stream`（教师订阅个人频道，`admin` / `super_admin` 订阅 `admin_global`）
- 学生端 SSE：`GET /classroom/stream`（需 `require_student` 且 `class_name` 非空）
- 心跳：每 15 秒无事件时发送 `:keepalive`

---

## API 端点

### 管理端活动 API

所有端点需要 `require_staff` 认证。教师只能查看和管理自己创建的活动；`admin`、`super_admin` 可全局管理。

| 方法 | 路径 | 说明 | 限制 |
|------|------|------|------|
| `POST` | `/classroom/admin/` | 创建活动 | -- |
| `PUT` | `/classroom/admin/{id}` | 更新活动 | 仅 `draft` 状态 |
| `DELETE` | `/classroom/admin/{id}` | 删除活动 | 仅 `draft` 状态 |
| `POST` | `/classroom/admin/{id}/duplicate` | 复制为新草稿 | -- |
| `POST` | `/classroom/admin/{id}/restart` | 重启已结束的活动 | 仅 `ended` 状态 |
| `POST` | `/classroom/admin/bulk-delete` | 批量删除草稿 | 仅 `draft` 状态，含越权校验 |
| `GET` | `/classroom/admin/` | 列表查询 | 支持 `skip`、`limit`、`status` 参数 |
| `GET` | `/classroom/admin/{id}` | 活动详情 + 统计信息 | -- |
| `POST` | `/classroom/admin/{id}/start` | 启动活动 | `draft` -> `active` |
| `POST` | `/classroom/admin/{id}/end` | 结束活动 | `active` -> `ended`，可选传 `analysis_agent_id` |
| `GET` | `/classroom/admin/{id}/statistics` | 获取统计 | -- |
| `GET` | `/classroom/admin/stream` | SSE 管理端流 | -- |

### 学生端活动 API

所有端点需要 `require_student` 认证，并要求学生与活动具有完全匹配的非空 `class_name`。

| 方法 | 路径 | 说明 | 限制 |
|------|------|------|------|
| `GET` | `/classroom/active` | 列出当前 active 活动 | 班级隔离 |
| `GET` | `/classroom/stream` | SSE 学生端流 | 班级隔离 |
| `GET` | `/classroom/{id}` | 获取活动学生视图 | 已结束则额外返回判定与统计，不返回标准答案 |
| `POST` | `/classroom/{id}/respond` | 提交响应 | `(activity_id, user_id)` 唯一；并发重复提交统一回滚并返回“已提交过答案” |
| `GET` | `/classroom/{id}/result` | 获取答题结果 | 仅 `ended` 状态 |

### 课堂计划 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/classroom/plans/admin` | 创建计划 | `require_staff` |
| `PUT` | `/classroom/plans/admin/{plan_id}` | 更新计划（仅 draft） | `require_staff` |
| `DELETE` | `/classroom/plans/admin/{plan_id}` | 删除计划（仅 draft） | `require_staff` |
| `GET` | `/classroom/plans/admin` | 列出计划 | `require_staff` |
| `GET` | `/classroom/plans/admin/{plan_id}` | 获取计划详情 | `require_staff` |
| `POST` | `/classroom/plans/admin/{plan_id}/start` | 启动计划 | `require_staff` |
| `POST` | `/classroom/plans/admin/{plan_id}/reset` | 重置计划（ended -> draft） | `require_staff` |
| `POST` | `/classroom/plans/admin/{plan_id}/next` | 推进到下一项 | `require_staff` |
| `POST` | `/classroom/plans/admin/{plan_id}/end` | 强制结束计划 | `require_staff` |
| `POST` | `/classroom/plans/admin/{plan_id}/items/{item_id}/start` | 启动计划项 | `require_staff` |
| `POST` | `/classroom/plans/admin/{plan_id}/items/{item_id}/end` | 结束计划项 | `require_staff` |
| `GET` | `/classroom/plans/active-plan` | 学生端获取当前计划，不返回 `correct_answer` | `require_student` |

教师创建或更新计划时只能引用自己创建的活动；教师只能查看和操作自己创建且全部活动仍归自己所有的计划。`admin`、`super_admin` 不受所有权过滤。

---

## 前端实现

### 目录结构

```
frontend/src/pages/Admin/ClassroomInteraction/
├── index.tsx                        # 活动管理主页面
├── components/
│   ├── ActivityColumns.tsx          # 活动列表列定义
│   ├── ActivityFormDialog.tsx       # 活动创建/编辑对话框
└── utils.ts                         # 工具函数

frontend/src/pages/Admin/ClassroomPlan/
├── index.tsx                        # 计划列表页面
└── PlanPage.tsx                     # 计划详情和编辑页

frontend/src/pages/AIAgents/
└── ClassroomPanel.tsx               # 课堂活动分析面板

frontend/src/services/
├── classroom.ts                     # 活动 API 封装
└── classroomPlan.ts                 # 计划 API 封装

frontend/src/hooks/queries/
├── useClassroomQuery.ts             # 活动数据查询 hooks
└── useClassroomPlanQuery.ts         # 计划数据查询 hooks
```

### ActivityFormDialog

创建/编辑活动的表单对话框，根据活动类型动态展示不同配置项：
- **投票类型**：配置选项（key/text 列表）、允许多选、正确答案、时间限制
- **填空类型**：配置正确答案（多个空位用 `|` 分隔）、AI 分析提示词、时间限制

### 班级隔离

学生端获取活动和 SSE 订阅时，自动根据 `current_user.class_name` 进行班级隔离：
- 学生只能看到与自己班级完全匹配的活动；`NULL` 班级活动不向学生开放
- 详情、答题和结果接口也执行同样的对象级班级校验
- active plan 只有在全部 item 的活动都属于当前班级时才返回，并移除所有正确答案
- SSE 频道自动路由到 `student_{class_name}`
- 计划推进和活动状态变更同事务提交，提交成功后才发送 SSE

---

## 典型使用场景

### 场景 1：课堂投票

1. 教师创建投票活动，设置选项（如 A/B/C/D）
2. 教师点击「开始」，活动状态变为 `active`，SSE 推送 `activity_started`
3. 学生端通过 SSE 或轮询 `GET /classroom/active` 获取活动
4. 学生选择选项并提交 `POST /classroom/{id}/respond`
5. 教师端通过 SSE 接收 `new_response` 事件，实时看到统计变化
6. 教师点击「结束」，活动变为 `ended`，SSE 推送 `activity_ended`
7. 教师查看 `GET /classroom/admin/{id}/statistics` 获取投票结果

### 场景 2：填空练习

1. 教师创建填空活动，设置题目描述和正确答案
2. 可选：配置 AI 分析提示词用于自动分析
3. 教师启动活动，学生提交填空答案
4. 教师结束活动时，可选择 AI 代理触发自动分析
5. 分析完成后，教师查看各空位正确率和 AI 教学建议

### 场景 3：课堂计划

1. 教师创建课堂计划，关联多个已有活动，按顺序排列
2. 教师点击「开始计划」，计划变为 `active`，但不自动启动第一项
3. 教师按课堂节奏点击「下一项」，系统启动第一项，之后自动结束当前项并启动下一项
4. 学生端通过 `GET /classroom/plans/active-plan` 获取当前进行中的活动和下一项预告
5. 所有项完成后计划自动结束，也可手动提前结束或重置

---

## 权限控制

| 操作 | 权限要求 |
|------|---------|
| 管理端所有操作 | `require_staff` |
| 教师查看/修改/删除/开始/结束/重启活动 | 仅本人创建 |
| 教师管理计划 | 计划和全部计划活动均为本人创建 |
| 管理员全局管理 | `admin` 或 `super_admin` |
| 学生端操作 | `require_student` + 非空且完全匹配的班级 |

---

## 相关文件

### 后端

| 文件 | 说明 |
|------|------|
| `backend/app/models/classroom/activity.py` | ClassroomActivity 模型 |
| `backend/app/models/classroom/response.py` | ClassroomResponse 模型 |
| `backend/app/models/classroom/plan.py` | ClassroomPlan / ClassroomPlanItem 模型 |
| `backend/app/api/endpoints/classroom/admin.py` | 管理端活动 API |
| `backend/app/api/endpoints/classroom/student.py` | 学生端活动 API |
| `backend/app/api/endpoints/classroom/plan.py` | 课堂计划 API |
| `backend/app/services/classroom.py` | 活动服务层（CRUD + SSE + 统计 + 分析 + 自动结束） |
| `backend/app/services/classroom_analysis.py` | 填空活动自动分析状态机、智能体回退和结果写回 |
| `backend/app/services/classroom_events.py` | 提交后 SSE 发布、Celery 入队重试和失败补偿 |
| `backend/app/services/classroom_lifecycle.py` | 超时活动认领、跳锁和幂等结束 |
| `backend/app/services/classroom_statistics.py` | 答题判分、投票统计和填空逐空位统计 |
| `backend/app/services/classroom_plan.py` | 计划服务层 |
| `backend/app/core/pubsub.py` | SSE pub/sub 基础设施 |
| `backend/app/schemas/classroom.py` | 请求/响应 Schema |

### 前端

| 文件 | 说明 |
|------|------|
| `frontend/src/pages/Admin/ClassroomInteraction/index.tsx` | 管理端活动列表页 |
| `frontend/src/pages/Admin/ClassroomInteraction/components/ActivityFormDialog.tsx` | 活动表单对话框 |
| `frontend/src/pages/Admin/ClassroomInteraction/components/ActivityColumns.tsx` | 活动列表列定义 |
| `frontend/src/pages/Admin/ClassroomPlan/index.tsx` | 计划列表页 |
| `frontend/src/pages/Admin/ClassroomPlan/PlanPage.tsx` | 计划详情编辑页 |
| `frontend/src/services/classroom.ts` | 活动 API 服务 |
| `frontend/src/services/classroomPlan.ts` | 计划 API 服务 |
| `frontend/src/hooks/queries/useClassroomQuery.ts` | 活动查询 hooks |
| `frontend/src/hooks/queries/useClassroomPlanQuery.ts` | 计划查询 hooks |

---

## 最佳实践

1. **活动命名**：使用清晰的标题，便于学生快速理解任务
2. **班级匹配**：确保活动班级与学生班级一致，实现正确的班级隔离
3. **时间限制**：设置合理的 `time_limit`，超时后系统自动结束活动
4. **及时结束**：活动完成后及时点击结束，系统会自动触发超时检查和 AI 分析
5. **计划预演**：正式上课前预演计划流程，确认活动顺序和内容正确
6. **AI 分析**：填空类活动建议配置 AI 代理，活动结束后自动获取教学分析报告
7. **SSE 连接**：管理端和学生端均支持自动重连和心跳保活（15 秒超时）
