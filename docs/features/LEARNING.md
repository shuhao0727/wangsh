# 学习平台

> 最后更新：2026-07-23

## 概述

学习平台是一个通用化的内容管理与进度跟踪系统，为 ML、AI 和智能体三个学习板块提供统一的章节内容、结构化配置、思维导图和学习进度管理能力。系统采用模块键（module_key）实现多课程并存，所有内容通过 RESTful API 管理，支持管理员编辑和用户端只读两种模式。

### 核心功能

- **Chapters（章节管理）**：模块化的 Markdown 章节内容，支持分组、难度分级和排序
- **Content（内容管理）**：结构化 JSON 内容项，按 section/item 键层级组织，支持启用/停用切换
- **Mindmaps（思维导图）**：个人创作 + 公共广场，复用 LearningContentItem 模型，管理员发布/取消发布
- **Progress（进度跟踪）**：按用户按模块的进度记录，支持 UPSERT 语义和 FOR UPDATE 行锁

---

## 架构设计

### 设计边界与内容来源

- 学习平台使用轻量、通用的内容层，不建设独立的完整 CMS。`section_key` 和结构化 JSON
  承载 roadmap、knowledge、experiments、tools、resources 等不同内容形态。
- ML、AI、Agents 的内置课程内容是正式教学资产，不是临时 mock。当前前端数据文件作为
  可审查、可离线使用的 fallback；后端返回有效 section 时按 section 覆盖本地内容。
- 后端内容不可用或单个 section 结构无效时，页面保留内置内容并显示非阻断提示，不能因
  一次 API 失败让正式课程整体不可用。
- 后续若把内置内容完全迁到数据库，必须先建立版本化资源、幂等 seed 和内容完整性校验，
  证明空库可恢复全部内容后，才能删除前端或归档中的重复来源。
- `frontend/public/mindmap-demo/` 是当前开发机保留的第三方静态运行时，字体、SVG、图片
  和打包 JS 不进入 Git 或生产 Docker 构建上下文；本地目录存在时仍可用于开发验证。
  全新 checkout 和当前生产镜像不提供该旧编辑器，后续恢复生产能力前必须建立可复现的
  资源生成、下载或独立镜像流程。`frontend/public/pyodide/` 则由 `predev` /
  `prebuild` 从依赖生成，同样不提交仓库。
- 生产环境的用户端广场和管理端都不会创建或打开依赖旧运行时的编辑会话；新建/编辑操作
  显示明确提示，已有导图通过内置 `MindMapViewer` 和 `/mindmap-preview` 只读查看。
  开发环境在本机运行时存在时继续保留创建和编辑能力。

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
- `GET /learning/progress/{module_key}` — 获取指定模块进度；首次无记录时返回 `200` 和同构默认 payload，不创建数据库记录
- `PUT /learning/progress/{module_key}` — 创建或更新进度（upsert），使用 `SELECT ... FOR UPDATE` 行锁防止并发竞态
- `POST /learning/progress/{module_key}` — 兼容前端保存按钮，行为与 PUT 一致
- `DELETE /learning/progress/{module_key}` — 删除进度记录

**并发安全**：PUT upsert 流程中先以 `with_for_update()` 锁定查询，若不存在则创建；若遇到 `IntegrityError`（竞态条件下另一请求已插入），则回滚后重新锁定，并使用已验证的进度字典更新该记录，确保不会丢失数据。

### 2026-07-23 续验记录

- 首次读取不存在的 progress 记录现在返回 `200` 的同构默认 payload，且不会创建空
  数据库记录；并发 upsert 的 `IntegrityError` 回退路径已在真实接口合同和定向测试中
  复验。
- Docker API 复验同时覆盖 Chapters、Content、Mindmaps 和 ML Book，页面请求未出现
  `404`、`422`、`500` 或未处理的前端异常。

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
| `GET` | `/learning/progress/{module_key}` | 登录 | 获取指定模块进度；无记录时返回默认 payload |
| `PUT` | `/learning/progress/{module_key}` | 登录 | 创建或更新进度（upsert，行锁） |
| `POST` | `/learning/progress/{module_key}` | 登录 | 兼容前端保存，行为同 PUT |
| `DELETE` | `/learning/progress/{module_key}` | 登录 | 删除指定模块进度 |

---

## 与 ML Book 的关系

学习平台与 ML Book 使用相同的 `module_key` 命名空间，但数据库模型和 API 独立：

- **Learning Platform**：使用 Learning 模型和 `/learning/*` API，提供通用章节、结构化
  内容、个人思维导图和学习进度能力。
- **ML Book 后端**：使用独立的 `ml_books` / `ml_book_chapters` 模型和 `/ml/book/*`
  API，负责后台书籍元数据与章节管理。
- **内置 ML/AI/Agents Book**：`book.ts` 与 `chapters/` Markdown 是正式版本化课程
  fallback。Learning Content 可通过 `section_key=raw`、`item_key=book` 覆盖现有学习页，
  但不会静默写入或替代 ML Book 数据库记录。

三条路径可以共存，但不能把共享 `module_key` 误解为共享表或共享 API。完整书籍模型边界
见 [ML_BOOK.md](ML_BOOK.md)。

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
