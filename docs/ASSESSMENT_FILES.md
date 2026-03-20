# 文件清单 + 注意事项

> 隶属于 [ASSESSMENT_DESIGN.md](./ASSESSMENT_DESIGN.md)

---

## 1. 后端文件

### 1.1 Models

```
backend/app/models/assessment/
  ├── __init__.py              # 导出所有模型
  ├── config.py                # AssessmentConfig 模型
  ├── question.py              # AssessmentQuestion 模型
  ├── session.py               # AssessmentSession 模型
  ├── answer.py                # AssessmentAnswer 模型
  ├── basic_profile.py         # AssessmentBasicProfile 模型（初级画像）
  ├── profile.py               # StudentProfile 模型（高级画像）
  └── config_agent.py          # AssessmentConfigAgent 关联模型
```

### 1.2 Schemas

```
backend/app/schemas/assessment/
  ├── __init__.py              # 导出所有 schema
  ├── config.py                # ConfigCreate/Update/Response/ListResponse
  ├── question.py              # QuestionCreate/Update/Response/GenerateRequest
  ├── session.py               # SessionStart/AnswerSubmit/SubmitResponse/ResultResponse
  └── profile.py               # BasicProfileResponse/ProfileGenerate/ProfileResponse
```

### 1.3 Services

```
backend/app/services/assessment/
  ├── __init__.py              # 导出所有服务函数
  ├── config_service.py        # 配置 CRUD + toggle
  ├── question_service.py      # 题目 CRUD + AI 出题（调用智能体，解析 JSON）
  ├── session_service.py       # 开始检测 + 抽题 + 答题 + 提交 + 评分
  ├── basic_profile_service.py # 初级画像自动生成（提交后调用）
  └── profile_service.py       # 高级画像生成（三方数据聚合 + 调用 AI）
```

### 1.4 API Endpoints

```
backend/app/api/endpoints/assessment/
  ├── __init__.py              # 聚合 router
  ├── admin.py                 # 管理端 API（configs/questions/sessions/statistics/profiles）
  └── student.py               # 学生端 API（available/start/answer/submit/result/profiles）
```

### 1.5 Alembic 迁移

```
backend/alembic/versions/
  └── 20260318_0001_assessment_tables.py   # 创建 7 张新表
```

### 1.6 需要修改的现有文件

| 文件 | 修改内容 |
|------|---------|
| `backend/app/models/__init__.py` | 导入 assessment 模块的所有模型 |
| `backend/app/api/__init__.py` | 注册 assessment router，prefix="/assessment" |

---

## 2. 前端文件

### 2.1 学生端

```
frontend/src/pages/AIAgents/
  └── AssessmentPanel.tsx       # 自主检测浮动窗口（列表+答题+结果+画像 四视图）
```

### 2.2 管理端页面

```
frontend/src/pages/Admin/Assessment/
  ├── index.tsx                 # 测评配置列表
  ├── EditorPage.tsx            # 测评编辑页（新建/编辑）
  ├── QuestionsPage.tsx         # 题库管理
  ├── StatisticsPage.tsx        # 答题统计
  └── ProfilesPage.tsx          # 画像中心（生成+列表+详情）
```

### 2.3 API 服务层

```
frontend/src/services/assessment/
  ├── index.ts                  # 统一导出
  ├── config.ts                 # 配置 CRUD API
  ├── question.ts               # 题目 API
  ├── session.ts                # 答题流程 API
  └── profile.ts                # 画像 API（初级+高级）
```

### 2.4 需要修改的现有文件

| 文件 | 修改内容 |
|------|---------|
| `frontend/src/App.tsx` | 添加 assessment 相关路由（5 个管理端页面） |
| `frontend/src/layouts/AdminLayout.tsx` | 侧边栏菜单新增"自主检测"分组 |
| `frontend/src/pages/AIAgents/index.tsx` | 引入 AssessmentPanel 浮动按钮 |

---

## 3. 文件总计

| 类别 | 新建 | 修改 |
|------|------|------|
| 后端 Models | 8 | 1 |
| 后端 Schemas | 5 | 0 |
| 后端 Services | 6 | 0 |
| 后端 API | 3 | 1 |
| 后端 Migration | 1 | 0 |
| 前端 Pages | 6 | 1 |
| 前端 Services | 5 | 0 |
| 前端 Layout/Route | 0 | 2 |
| **合计** | **34** | **5** |

---

## 4. 开发顺序建议

### 第 1 期（后端基础 + 管理端）

```
1. Models（7 个模型文件 + __init__.py）
2. Alembic 迁移
3. Schemas（config.py + question.py）
4. Services（config_service.py + question_service.py）
5. API（admin.py 中的 configs + questions 部分）
6. 注册 router（api/__init__.py）
7. 前端 services（config.ts + question.ts）
8. 前端页面（index.tsx + EditorPage.tsx + QuestionsPage.tsx）
9. 路由 + 菜单注册
```

### 第 2 期（学生端 + 评分 + 初级画像）

```
1. Schemas（session.py）
2. Services（session_service.py + basic_profile_service.py）
3. API（student.py + admin.py 中的 sessions/statistics 部分）
4. 前端 services（session.ts）
5. 前端 AssessmentPanel.tsx（列表+答题+结果+初级画像）
6. 前端 StatisticsPage.tsx
7. 修改 AIAgents/index.tsx（引入浮动按钮）
```

### 第 3 期（三维融合画像）

```
1. Schemas（profile.py）
2. Services（profile_service.py）
3. API（admin.py 中的 profiles 部分 + student.py 中的 my-profiles）
4. 前端 services（profile.ts）
5. 前端 ProfilesPage.tsx
6. AssessmentPanel.tsx 中添加三维画像 Tab
```

---

## 5. 技术约束

1. **遵循项目现有模式**：Model 继承 Base、Schema 用 Field + from_attributes、Service 用 AsyncSession + select()、API 用 Depends(get_db/get_current_user/require_super_admin)
2. **表前缀**：所有新表使用 `znt_` 前缀
3. **迁移命名**：`20260318_0001_assessment_tables.py`，revision ID = `20260318_0001`
4. **前端组件**：管理页面用 AdminPage + AdminTablePanel，浮动窗口复用 GroupDiscussionPanel 的 Portal + 拖拽模式
5. **API 服务层**：返回 `BaseResponse<T>`，错误用 `asApiError()` + `toDetailMessage()` 处理
6. **AI 调用**：通过现有的智能体对话接口调用 LLM，不直接调用外部 API
7. **中文 locale**：Ant Design 已配置 zhCN，分页用 `共 X 条` 格式
