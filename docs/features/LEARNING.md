# 学习平台

> 最后更新：2026-07-07

## 概述

学习平台是一个通用化的内容管理与进度跟踪系统，为 ML、AI 和智能体三个学习板块提供统一的章节内容、结构化配置、思维导图和学习进度管理能力。系统采用模块键（module_key）实现多课程并存，所有内容通过 RESTful API 管理，支持管理员编辑和用户端只读两种模式。

### 核心功能

- **Chapters（章节管理）**：模块化的 Markdown 章节内容，支持分组、难度分级和排序
- **Content（内容管理）**：结构化 JSON 内容项，按 section/item 键层级组织，支持启用/停用切换
- **Mindmaps（思维导图）**：个人创作 + 公共广场，复用 LearningContentItem 模型，管理员发布/取消发布
- **Progress（进度跟踪）**：按用户按模块的进度记录，支持 UPSERT 语义和 FOR UPDATE 行锁

---

## 架构设计

### 数据模型

**核心表**：
- `sys_learning_chapters` (LearningChapter) — 学习章节，按模块组织 Markdown 内容
- `sys_learning_content_items` (LearningContentItem) — 结构化内容项，用于配置和思维导图
- `sys_learning_progress` (LearningProgress) — 用户学习进度，每用户每模块一条记录

**LearningChapter 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `module_key` | String(50) | 模块标识：ml、ai、agents |
| `slug` | String(120) | 章节唯一标识（URL 友好） |
| `title` | String(255) | 章节标题 |
| `summary` | Text | 摘要 |
| `estimated_minutes` | Integer | 预计学习时长（分钟），默认 30 |
| `difficulty` | String(20) | 难度：beginner / intermediate / advanced / expert |
| `group_name` | String(100) | 所属分组名称 |
| `markdown` | Text | Markdown 正文内容 |
| `sort_order` | Integer | 排序序号 |
| `created_at` / `updated_at` | DateTime | 时间戳 |

**LearningContentItem 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `module_key` | String(50) | 模块标识 |
| `section_key` | String(80) | 内容分区 |
| `item_key` | String(120) | 内容项唯一标识 |
| `title` | String(255) | 标题 |
| `summary` | Text | 摘要 |
| `content` | Text | 结构化内容 JSON |
| `tags` | Text | 标签 JSON 数组 |
| `difficulty` | String(50) | 难度 |
| `sort_order` | Integer | 排序 |
| `enabled` | Boolean | 是否启用 |
| `source_type` | String(50) | 来源：admin / user |
| `owner_id` | Integer | 所有者用户 ID，NULL 表示公共 |
| `created_at` / `updated_at` | DateTime | 时间戳 |

唯一约束：`(module_key, section_key, item_key)`

**LearningProgress 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `user_id` | Integer (FK -> sys_users.id, CASCADE) | 用户 ID |
| `module_key` | String(50) | 模块标识 |
| `current_stage` | String(100) | 当前学习阶段 |
| `completed_stages` | Text | 已完成阶段列表（JSON 数组） |
| `progress_data` | Text | 前端学习进度数据（JSON 对象） |
| `notes` | Text | 学习笔记 |
| `created_at` / `updated_at` | DateTime | 时间戳 |

唯一约束：`(user_id, module_key)`

### 模块键（Module Key）

系统通过 `module_key` 区分不同课程的命名空间：

| 键值 | 说明 |
|------|------|
| `ml` | 机器学习课程 |
| `ai` | 人工智能课程 |
| `agents` | AI 智能体课程 |

所有子模块（chapters、content、mindmaps、progress）共享相同的 module_key 校验逻辑，仅允许这三个值。

---

## 子模块

### Chapters（章节管理）

4 个端点（2 公开 + 2 管理）。以 module_key 和 slug 为联合标识，提供 Markdown 章节的列表、详情、创建/更新（upsert）和删除操作。章节支持 `group_name` 分组、`difficulty` 难度分级和 `sort_order` 排序，前端 BookReader 组件据此渲染分组目录和进度。

- **公开接口**：`GET /learning/chapters/{module_key}` 列出模块所有章节，`GET /learning/chapters/{module_key}/{slug}` 获取单章节详情。二者均需登录，按 `sort_order` 排序。
- **管理接口**：`PUT` 使用 upsert 语义——章节不存在则创建，存在则更新；`DELETE` 删除章节。均需 admin 权限。

### Content（内容管理）

4 个端点（2 公开 + 2 管理）。基于 `(module_key, section_key, item_key)` 三键定位的结构化内容系统。content 字段存储 JSON，tags 存储 JSON 数组，前端可按需解析。

- **公开接口**：`GET /learning/content/{module_key}` 仅返回 `enabled=true` 的内容项
- **管理接口**：`GET /learning/content/{module_key}/admin` 返回全部内容项（含停用）；`PUT` upsert；`PATCH /enabled` 启用/停用切换

### Mindmaps（思维导图）

6 个端点。复用 `LearningContentItem` 模型，固定 `section_key="mindmap"`。区分个人导图（`owner_id` 指向创建者）和公共导图（`owner_id=NULL`）。

- **公共广场**：`GET /learning/mindmaps` 返回所有已发布的公共导图（`owner_id IS NULL AND enabled=true`），无需登录即可访问
- **个人导图**：`GET /learning/mindmaps/my` 列出当前用户的个人导图；`POST` 创建新导图；`PUT /{id}` 更新（仅所有者）；`DELETE /{id}` 删除（所有者或管理员）
- **管理员操作**：`PATCH /{id}/publish` 切换发布状态——发布时设置 `owner_id=NULL, source_type="admin"`，取消发布时设置 `owner_id=1, source_type="user"`

### Progress（进度跟踪）

5 个端点。按用户+模块存储进度数据，支持 `extra="allow"` 的自定义字段扩展。

- `GET /learning/progress` — 列出当前用户所有模块的进度
- `GET /learning/progress/{module_key}` — 获取指定模块进度（404 如果没有记录）
- `PUT /learning/progress/{module_key}` — 创建或更新进度（upsert），使用 `SELECT ... FOR UPDATE` 行锁防止并发竞态
- `POST /learning/progress/{module_key}` — 兼容前端保存按钮，行为与 PUT 一致
- `DELETE /learning/progress/{module_key}` — 删除进度记录

**并发安全**：PUT upsert 流程中先以 `with_for_update()` 锁定查询，若不存在则创建；若遇到 `IntegrityError`（竞态条件下另一请求已插入），则回滚后重新锁定并更新，确保不会丢失数据。

---

## API 端点

共 19 个端点。

### Chapters

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/learning/chapters/{module_key}` | 登录 | 获取某模块所有章节列表 |
| `GET` | `/learning/chapters/{module_key}/{slug}` | 登录 | 获取单章节详情 |
| `PUT` | `/learning/chapters/{module_key}/{slug}` | Admin | 创建或更新章节（upsert） |
| `DELETE` | `/learning/chapters/{module_key}/{slug}` | Admin | 删除章节 |

### Content

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/learning/content/{module_key}` | 登录 | 获取启用状态的内容项 |
| `GET` | `/learning/content/{module_key}/admin` | Admin | 获取全部内容项（含停用） |
| `PUT` | `/learning/content/{module_key}/{section_key}/{item_key}` | Admin | 创建或更新内容项（upsert） |
| `PATCH` | `/learning/content/{module_key}/{section_key}/{item_key}/enabled` | Admin | 启用/停用内容项 |

### Mindmaps

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/learning/mindmaps` | 无 | 公共导图广场 |
| `GET` | `/learning/mindmaps/my` | 登录 | 我的个人导图列表 |
| `POST` | `/learning/mindmaps` | 登录 | 创建个人思维导图 |
| `PUT` | `/learning/mindmaps/{id}` | 登录 | 更新个人导图（仅所有者） |
| `DELETE` | `/learning/mindmaps/{id}` | 登录 | 删除个人导图（所有者或管理员） |
| `PATCH` | `/learning/mindmaps/{id}/publish` | Admin | 管理员发布/取消发布导图 |

### Progress

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/learning/progress` | 登录 | 获取当前用户所有模块进度 |
| `GET` | `/learning/progress/{module_key}` | 登录 | 获取指定模块进度 |
| `PUT` | `/learning/progress/{module_key}` | 登录 | 创建或更新进度（upsert，行锁） |
| `POST` | `/learning/progress/{module_key}` | 登录 | 兼容前端保存，行为同 PUT |
| `DELETE` | `/learning/progress/{module_key}` | 登录 | 删除指定模块进度 |

---

## 与 ML Book 的关系

学习平台提供通用的章节/内容/导图/进度基础设施，模块键和 API 端点与 ML Book、AI Book、Agents Book 共享同一套模型。二者的区别：

- **Learning Platform**：通用化的 CRUD 后端，不预设内容结构。chapters 是扁平的 Markdown 章节列表，content 是灵活的结构化 JSON 配置项。
- **ML/AI/Agents Book**：前端层面的"书籍"概念，通过 `book.ts` 定义章节元数据和排序，每个模块的 `chapters/` 目录存放 Markdown 源文件。BookReader 组件消费 Learning Platform 的 API 数据并结合前端定义的章节结构渲染分组阅读界面。

两者共享 `module_key` 命名空间（ml、ai、agents），可以共存且互不冲突。Book 系统为前端构建的"丰富结构化书籍"视图，Learning Platform 为其提供后端持久化支持。

---

## 前端页面

### 管理端

**位置**：`frontend/src/pages/Admin/ITTechnology/learning/`

| 文件 | 说明 |
|------|------|
| `BookReader.tsx` | 通用书籍阅读器（Markdown 渲染 / 侧边栏目录 / 内容大纲 / 滚动跟踪 / KaTeX + Mermaid 支持） |
| `EditorPage.tsx` | 章节编辑器页面 |
| `TabEditorPage.tsx` | 多标签编辑器页面 |
| `MindMapManager.tsx` | 思维导图管理器 |
| `MindMapEditor.tsx` | 思维导图编辑器 |
| `MindMapEditorLib.tsx` | 思维导图编辑器底层库 |
| `InteractiveMindMapEditor.tsx` | 交互式思维导图编辑器 |
| `MindMapViewer.tsx` | 思维导图查看器 |
| `types.ts` | 类型定义 |
| `helpers.ts` | 辅助函数 |

### 用户端

**位置**：`frontend/src/pages/ITTechnology/`

| 文件 | 说明 |
|------|------|
| `MLFullPage.tsx` / `MLPage.tsx` | 机器学习课程页面 |
| `AIFullPage.tsx` / `AIPage.tsx` | 人工智能课程页面 |
| `AgentsFullPage.tsx` / `AgentsPage.tsx` | AI 智能体课程页面 |

### 章节内容（Markdown 源文件）

每个模块的章节以 `.md` 文件形式存放，由前端构建时导入：

- `Admin/ITTechnology/ml/chapters/` — 机器学习章节（16 个）
- `Admin/ITTechnology/ai/chapters/` — 人工智能章节（19 个）
- `Admin/ITTechnology/agents/chapters/` — 智能体章节（16 个）

---

## 相关文档

- [API 参考](../development/API.md) — 完整 API 规格
- [课堂互动系统](./CLASSROOM.md) — 课堂计划与活动
- [PythonLab](./PYTHONLAB.md) — Python 教学实验环境
