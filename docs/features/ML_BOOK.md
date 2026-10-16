# ML/AI/Agents 学习书籍系统

> 最后更新：2026-07-24

## 概述

学习书籍系统为 ML、AI 和 Agents 三大学习路径提供完整的书籍化内容管理与阅读功能。每个 `module_key` 对应一本独立的书籍，每本书包含多个章节，每个章节携带丰富的学习元数据（学习目标、检查清单、实验任务、术语表、参考资料、前置章节、关键词、自测题等）。

### 核心功能
- **三本书独立管理**：ml / ai / agents 各为一本完整书籍，通过 `module_key` 区分
- **丰富的章节元数据**：每章节支持 goals（学习目标）、checklist（检查清单）、experiments（实验任务）、glossary（术语表）、references（参考资料）、prerequisites（前置章节）、keywords（关键词）、quiz（自测题），全部为 JSON 数组格式
- **章节排序与上下架**：支持 `sort_order` 排序和 `enabled` 启用/禁用，批量重排
- **公开与管理双模式**：公开接口返回已启用的书籍和章节，管理接口返回完整数据

### 内容来源与兼容策略

- `ml`、`ai`、`agents` 的 `book.ts` 和章节 Markdown 是正式内置课程内容，提供完整离线
  fallback，不依赖外部链接才能阅读。
- 学习页面允许 Learning Content 使用 `section_key=raw`、`item_key=book` 覆盖内置
  `LearningBook`；没有有效覆盖时继续使用内置内容。
- 专用 `ml_books` / `ml_book_chapters` 表和 `/ml/book/*` API 负责后台书籍管理；Learning
  Content 覆盖用于兼容现有 IT Technology 学习页，两条路径共享 `module_key`，但不应
  静默互相覆盖数据库记录。
- 章节 `slug` 是路由、进度、前置关系和后台编辑的稳定标识。调整标题不应顺带修改 slug；
  必须改 slug 时，需要同步迁移引用和用户进度。
- 删除任何内置课程副本前，必须验证后端资源、空库 seed 和章节数量/slug/正文完整性，
  避免把开发数据库中的临时状态误当成正式内容唯一来源。

---

## 架构设计

### 数据模型

**核心表**：
- `ml_books` (MLBook) — 书籍元数据表，每本书一条记录
- `ml_book_chapters` (MLBookChapter) — 章节内容表，关联到书籍

**MLBook 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `module_key` | String(50) | 模块标识，唯一约束：ml / ai / agents |
| `title` | String(255) | 书名 |
| `subtitle` | String(255) | 副标题（可选） |
| `description` | Text | 书籍描述（可选） |
| `audience` | String(255) | 目标读者（可选） |
| `outcomes` | Text | 学习成果，JSON 字符串数组 |
| `enabled` | Boolean | 是否启用，默认 True |
| `created_at` / `updated_at` | DateTime | 时间戳 |

唯一约束：`(module_key)`

**MLBookChapter 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `book_id` | Integer (FK -> ml_books.id, CASCADE) | 关联书籍 |
| `slug` | String(120) | URL 友好唯一标识 |
| `chapter_number` | Integer | 章节序号 |
| `title` | String(255) | 章节标题 |
| `summary` | Text | 章节摘要（可选） |
| `difficulty` | String(50) | 难度：beginner / intermediate / advanced / expert |
| `estimated_minutes` | Integer | 预计学习时长（分钟） |
| `markdown` | Text | 章节正文（Markdown 格式） |
| `goals` | Text | 学习目标，JSON 字符串数组 |
| `checklist` | Text | 检查清单，JSON 字符串数组 |
| `experiments` | Text | 实验任务，JSON 对象数组 |
| `glossary` | Text | 术语表，JSON 对象数组（label + description） |
| `references` | Text | 参考来源，JSON 对象数组（title + url） |
| `prerequisites` | Text | 前置章节 slug，JSON 字符串数组 |
| `keywords` | Text | 搜索关键词，JSON 字符串数组 |
| `quiz` | Text | 自测题，JSON 对象数组 |
| `sort_order` | Integer | 排序值，默认 0 |
| `enabled` | Boolean | 是否启用，默认 True |
| `created_at` / `updated_at` | DateTime | 时间戳 |

唯一约束：`(book_id, slug)`、`(book_id, chapter_number)`

### 模块键（Module Key）

三本书通过 `module_key` 区分，与 Learning 平台共享相同的命名空间：

| 键值 | 书名 |
|------|------|
| `ml` | 机器学习（Machine Learning） |
| `ai` | 人工智能（Artificial Intelligence） |
| `agents` | AI 智能体（AI Agents） |

---

## API 端点

完整路径、认证和请求合同统一维护在 [API 文档](../development/API.md) 的 ML Book 章节。
本功能文档只保留书籍模型、内容语义和与 Learning 平台的关系。

### 请求/响应说明

- **Upsert 语义**：PUT 操作中，如果目标书籍或章节不存在则自动创建，存在则更新。`module_key` 在创建书籍时必须遵守校验规则（仅 ml / ai / agents）。
- **JSON 序列化**：所有 JSON 数组类型的字段（goals、checklist 等）在数据库中以 JSON 字符串存储（`json.dumps(ensure_ascii=False)`），在 API 响应中自动反序列化为 JSON 数组。
- **SELECTINLOAD**：查询书籍时使用 `selectinload(MLBook.chapters)` 预加载关联章节，避免 N+1 问题。

---

## 与 Learning 平台的关系

ML Book 是面向"教科书"场景的书籍系统，Learning 平台是通用化的内容管理基础设施。二者共享 `module_key` 命名空间（ml / ai / agents）并可协同工作：

- **ML Book**：提供自上而下的书籍结构——书 -> 章节 -> 丰富的元数据（目标、清单、实验、术语、测验等）。适合作为学习的"主线"教科书。
- **Learning Platform**：提供扁平的章节列表和灵活的结构化内容（content items），通过 `section_key` 区分内容用途（如 `raw`、`mindmap`）。Learning Content Items 可以通过约定（`section_key=raw`、`item_key=book`）覆盖或扩展 Book 内容。

二者不冲突：Book 系统为结构化教科书提供专用 API，Learning 平台为通用化内容提供基础设施。

---

## 前端页面

### 用户端（阅读）

| 路由 | 页面组件 | 说明 |
|------|----------|------|
| `/it-technology/ml` | `MLFullPage` | ML 全屏书籍阅读器 |
| `/it-technology/ai` | `AIFullPage` | AI 全屏书籍阅读器 |
| `/it-technology/agents` | `AgentsFullPage` | Agents 全屏书籍阅读器 |

阅读器提供：Markdown 渲染、侧边栏章节目录、内容大纲导航、滚动位置跟踪、KaTeX 数学公式 + Mermaid 图表支持。

### 管理端（编辑）

| 路由 | 页面组件 | 说明 |
|------|----------|------|
| `/admin/it-technology/ml-book-editor` | `AdminMLBookEditorPage` | 书籍编辑器，管理三本书的书籍元数据和章节内容 |
| `/admin/it-technology/learning/:moduleKey` | `AdminLearningEditorPage` | Learning 内容编辑器（关联模块） |
| `/admin/it-technology/learning/:moduleKey/:section` | `AdminTabEditorPage` | 多标签编辑器页面 |

---

## 相关文档

- [Learning 平台](./LEARNING.md) — 通用化学习内容管理与进度跟踪
- [API 参考](../development/API.md) — 完整 API 规格
