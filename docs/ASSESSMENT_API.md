# 后端 API 设计

> 隶属于 [ASSESSMENT_DESIGN.md](./ASSESSMENT_DESIGN.md)
> 最后更新：2026-03-24

---

## 1. 管理端 API（需要管理员权限）

前缀：`/api/v1/assessment/admin`

### 1.1 测评配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/configs` | 创建测评配置 |
| GET | `/configs` | 列表（分页，支持按学科/年级/状态筛选） |
| GET | `/configs/{id}` | 详情（含关联智能体列表） |
| PUT | `/configs/{id}` | 更新配置 |
| DELETE | `/configs/{id}` | 删除配置（级联删除题目、会话、答题记录、画像） |
| PUT | `/configs/{id}/toggle` | 开启/关闭学生端可见 |

### 1.2 题库管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/configs/{id}/generate-questions` | AI 批量生成题目（调用智能体） |
| GET | `/configs/{id}/questions` | 题库列表（分页，支持按题型/难度筛选） |
| POST | `/questions` | 手动添加单道题目 |
| PUT | `/questions/{qid}` | 编辑单道题目 |
| DELETE | `/questions/{qid}` | 删除单道题目 |

### 1.3 答题统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/configs/{id}/class-names` | 获取已参与班级列表（用于统计筛选） |
| GET | `/configs/{id}/sessions` | 学生答题情况列表（含初级画像摘要） |
| GET | `/sessions/{sid}` | 单个学生答题详情（含每题得分和 AI 评语） |
| GET | `/sessions/{sid}/basic-profile` | 查看某学生的初级画像 |
| POST | `/sessions/{sid}/allow-retest` | 允许单个学生重测（清理历史会话） |
| POST | `/configs/{id}/batch-retest` | 批量重测（按班级或会话列表） |
| GET | `/configs/{id}/statistics` | 统计数据（平均分、通过率、各知识点掌握率） |
| GET | `/configs/{id}/export` | 导出统计明细（xlsx） |

说明：`/statistics` 返回的 `pass_rate` 字段为 `0~1` 比例值，前端按百分比展示。

### 1.4 高级画像管理（三维融合）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/profiles/generate` | 生成高级画像（指定类型、目标、数据源） |
| POST | `/profiles/batch-generate` | 批量生成画像（如全班个人画像） |
| GET | `/profiles` | 画像列表（分页，按类型/目标筛选） |
| GET | `/profiles/{id}` | 画像详情 |
| DELETE | `/profiles/{id}` | 删除画像 |

#### `POST /profiles/generate` 请求体

```json
{
  "profile_type": "individual",
  "target_id": "42",
  "config_id": 1,
  "discussion_session_id": 15,
  "agent_ids": [1, 3],
  "agent_id": 2
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| profile_type | 是 | `individual` / `group` / `class` |
| target_id | 是 | 个人=user_id，小组=discussion_session_id，群体=class_name |
| config_id | 否 | 关联的测评配置（拉取测评数据） |
| discussion_session_id | 否 | 关联的小组讨论会话（拉取讨论数据） |
| agent_ids | 否 | 关联的智能体 ID 列表（拉取 AI 对话数据） |
| agent_id | 是 | 用于生成画像的 AI 智能体 |

#### `POST /profiles/batch-generate` 请求体

```json
{
  "profile_type": "individual",
  "user_ids": [42, 43, 44, 45],
  "config_id": 1,
  "discussion_session_id": 15,
  "agent_ids": [1, 3],
  "agent_id": 2
}
```

批量为多个学生生成个人画像，后端逐个调用 AI 生成。

---

## 2. 学生端 API（需要登录）

前缀：`/api/v1/assessment`

### 2.1 自主检测

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/available` | 可用的测评列表（enabled=true） |
| POST | `/sessions/start` | 开始检测（创建会话 + 随机抽题/实时生成） |
| GET | `/sessions/{sid}/questions` | 获取本次检测的题目列表（不含答案） |
| POST | `/sessions/{sid}/answer` | 提交单题答案（选择题即时判分） |
| POST | `/sessions/{sid}/submit` | 提交整卷（AI 统一评分 + 自动生成初级画像） |
| GET | `/sessions/{sid}/result` | 查看检测结果（总分 + 各题详情 + AI 评语） |
| GET | `/sessions/{sid}/profile-status` | 查询三维画像生成状态 |

### 2.2 画像查看

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sessions/{sid}/basic-profile` | 查看本次检测的初级画像 |
| GET | `/my-profiles` | 查看我的所有高级画像（三维融合） |
| GET | `/my-profiles/{id}` | 查看某个高级画像详情 |

---

## 3. 关键 API 详细说明

### 3.1 `POST /sessions/start` — 开始检测

**请求体：**
```json
{
  "config_id": 1
}
```

**后端逻辑：**
1. 检查该测评是否 `enabled=true`
2. 检查该学生是否已有 `in_progress` 的会话（有则返回已有会话）
3. 抽取固定题（按 `question_config` 配置）
4. 加载自适应知识点题（`mode=adaptive`），并为首轮题实时调用 AI 生成 `question_snapshot`
5. 创建 `session`（status=`in_progress`）和对应的 `answer` 记录（student_answer 为空）
6. 返回 session_id

**响应：**
```json
{
  "session_id": 123,
  "config_title": "Python循环结构课堂检测",
  "total_questions": 10,
  "total_score": 100,
  "time_limit_minutes": 30,
  "started_at": "2026-03-18T10:00:00Z"
}
```

### 3.2 `POST /sessions/{sid}/answer` — 提交单题答案

**请求体：**
```json
{
  "answer_id": 456,
  "student_answer": "B"
}
```

**后端逻辑：**
- 选择题：即时判分，返回 `is_correct` + `correct_answer` + `explanation`
- 填空题：调用 AI 评分，返回 `ai_score` + `ai_feedback`
- 简答题：仅保存答案，提交整卷时统一评分

**响应（选择题）：**
```json
{
  "is_correct": true,
  "correct_answer": "B",
  "explanation": "while 是 Python 的循环关键字...",
  "earned_score": 10,
  "max_score": 10
}
```

### 3.3 `POST /sessions/{sid}/submit` — 提交整卷

**后端逻辑：**
1. 检查所有题目是否已作答（未答的记 0 分）
2. AI 统一评分未评分的简答题
3. 计算总分，更新 session 状态为 `graded`
4. **自动生成初级画像**：
   - 统计各知识点得分
   - 提取错题知识点
   - 调用 AI 生成简短评语（200字以内）
   - 存入 `znt_assessment_basic_profiles`
5. 返回结果摘要

**响应：**
```json
{
  "session_id": 123,
  "status": "graded",
  "earned_score": 85,
  "total_score": 100,
  "basic_profile_id": 789,
  "summary": "你在本次检测中表现良好，循环结构掌握扎实，建议加强对 break/continue 的理解。"
}
```

### 3.4 `GET /sessions/{sid}/basic-profile` — 初级画像

**响应：**
```json
{
  "id": 789,
  "session_id": 123,
  "earned_score": 85,
  "total_score": 100,
  "knowledge_scores": {
    "for循环": {"earned": 20, "total": 20},
    "while循环": {"earned": 18, "total": 20},
    "循环嵌套": {"earned": 15, "total": 20},
    "break/continue": {"earned": 12, "total": 20},
    "综合应用": {"earned": 20, "total": 20}
  },
  "wrong_points": ["break/continue", "循环嵌套"],
  "ai_summary": "## 本次检测画像\n\n你在循环基础（for/while）方面掌握扎实...",
  "created_at": "2026-03-18T10:35:00Z"
}
```

### 3.5 `GET /my-profiles` — 我的高级画像

**查询参数：** `skip`, `limit`

**响应：**
```json
{
  "items": [
    {
      "id": 101,
      "profile_type": "individual",
      "config_title": "Python循环结构课堂检测",
      "data_sources": ["assessment", "discussion", "agent_chat"],
      "scores": {"knowledge": 85, "participation": 70, "thinking": 60, "autonomy": 75},
      "created_at": "2026-03-18T11:00:00Z"
    }
  ],
  "total": 1
}
```
