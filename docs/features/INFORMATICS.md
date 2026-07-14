# 信息学笔记系统文档

> 最后更新：2026-07-12

## 概述

信息学笔记系统基于 Typst 排版引擎，为信息学竞赛教学提供结构化笔记管理。支持在线编辑、PDF 编译（同步/异步）、资源管理、样式模板和 GitHub 自动同步。

### 核心功能

- **Typst 编辑器**：在线编辑 Typst 源码，多文件项目结构
- **PDF 编译**：同步编译 + Celery 异步编译，内容哈希缓存
- **笔记分类**：扁平路径式分类（`category_path`，非嵌套树）
- **样式管理**：可复用 Typst 样式模板（String PK）
- **资源管理**：附件上传/下载（图片、字体等）
- **GitHub 同步**：定时/手动同步笔记到 GitHub 仓库
- **公开发布**：已发布笔记可供学生公开访问

---

## 架构设计

### 数据模型

**核心表**（均使用 `inf_` 前缀）：

| 表名 | 模型 | 说明 |
|------|------|------|
| `inf_typst_notes` | TypstNote | 笔记主体 |
| `inf_typst_styles` | TypstStyle | 样式模板（key 为主键） |
| `inf_typst_categories` | TypstCategory | 分类（扁平路径） |
| `inf_typst_assets` | TypstAsset | 笔记资源/附件 |
| `inf_github_sync_settings` | InformaticsGithubSyncSetting | 同步配置 |
| `inf_github_sync_sources` | InformaticsGithubSyncSource | 笔记-GitHub 文件映射 |
| `inf_github_sync_runs` | InformaticsGithubSyncRun | 同步运行记录 |

### TypstNote 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键 |
| `title` | String(200) | 笔记标题 |
| `summary` | String(500) | 摘要，默认空 |
| `category_path` | String(200) | 分类路径（字符串，非外键），默认空 |
| `published` | Boolean | 是否公开，默认 False |
| `published_at` | DateTime(tz) | 发布时间 |
| `style_key` | String(100) | 样式键，默认 "my_style" |
| `entry_path` | String(200) | 入口文件路径，默认 "main.typ" |
| `files` | JSONB | 多文件项目结构 |
| `toc` | JSONB | 目录结构 |
| `content_typst` | Text | Typst 源码主体 |
| `created_by_id` | Integer, FK | 创建者 |
| `compiled_hash` | String(64) | 编译内容哈希（缓存判定） |
| `compiled_pdf` | LargeBinary | 编译后的 PDF 二进制 |
| `compiled_pdf_path` | String(500) | PDF 磁盘存储相对路径 |
| `compiled_pdf_size` | Integer | PDF 文件大小 |
| `compiled_at` | DateTime(tz) | 最近编译时间 |
| `is_deleted` | Boolean | 软删除标记 |
| `created_at` | DateTime(tz) | 创建时间 |
| `updated_at` | DateTime(tz) | 更新时间 |

**注意**：没有 `pdf_path`、`github_path`、`content`、`category_id`、`is_published` 等字段。

### TypstStyle 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | String(100) | **主键**（自然键，非自增） |
| `title` | String(200) | 样式标题 |
| `content` | Text | Typst 样式代码 |
| `sort_order` | Integer | 排序 |

### TypstCategory 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键 |
| `path` | String(200) | 分类路径（唯一），如 "算法/图论" |
| `sort_order` | Integer | 排序 |

**注意**：分类是扁平路径（`category_path` 字符串匹配），不是嵌套外键树。

---

## PDF 编译流程

### 核心机制

1. **Per-note 锁**：每个笔记有独立的 `asyncio.Lock`，防止同一笔记并发编译
2. **全局信号量**：`TYPST_COMPILE_MAX_CONCURRENCY`（默认 2），限制总并发编译数
3. **编译超时**：`TYPST_COMPILE_TIMEOUT_SECONDS`（默认 **120 秒**）
4. **内容哈希缓存**：`compiled_hash` 对比，相同内容不重复编译
5. **速率限制**：`TYPST_COMPILE_RATE_LIMIT_SECONDS`，per-user per-note

### 编译模式

**同步编译**：直接调用 `compile_note_pdf()`，适合小文件

**异步编译**：当 `TYPST_COMPILE_USE_CELERY=True` 时，委托 Celery 任务 `compile_typst_note` 到 `typst` 队列

### 编译步骤

1. 获取笔记 files/assets/样式资源
2. 写入临时目录
3. 调用 `typst compile` CLI
4. 比较内容哈希（缓存命中则跳过存储）
5. 存入磁盘（`compiled_pdf_path` 基于 `TYPST_PDF_STORAGE_DIR`）
6. 更新数据库记录

### PDF 缓存

- `invalidate_note_pdf_cache()` 可清除已编译 PDF 缓存（元数据 + 磁盘文件）
- 编辑源码、入口或样式时只清除数据库缓存引用，不在更新请求中同步删除旧 PDF，
  避免与同步/Celery 编译发生跨进程删除竞态
- 失去引用的旧 PDF 由 `cleanup_unreferenced_pdfs()` 按保留天数延迟回收
- 公开 PDF 下载会重新校验源码、样式和规范化后的附件哈希；校验查询失败时拒绝返回缓存
- 编译前自动对比 hash，相同内容不重复编译

---

## API 端点

### 笔记管理（需 staff 权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/informatics/typst-notes` | 列表（skip, limit, search） |
| POST | `/informatics/typst-notes` | 创建笔记 |
| GET | `/informatics/typst-notes/{note_id}` | 获取单个笔记 |
| PUT | `/informatics/typst-notes/{note_id}` | 更新笔记 |
| DELETE | `/informatics/typst-notes/{note_id}` | 软删除 |
| GET | `/informatics/typst-notes/{note_id}/assets` | 列出资源 |
| POST | `/informatics/typst-notes/{note_id}/assets` | 上传资源 |
| DELETE | `/informatics/typst-notes/{note_id}/assets/{asset_id}` | 删除资源 |
| GET | `/informatics/typst-notes/{note_id}/assets/{asset_id}` | 下载资源 |
| POST | `/informatics/typst-notes/{note_id}/compile` | 同步编译 |
| POST | `/informatics/typst-notes/{note_id}/compile-async` | 异步编译（返回 job_id） |
| GET | `/informatics/typst-notes/compile-jobs/{job_id}` | 查询编译状态 |
| POST | `/informatics/typst-notes/compile-jobs/{job_id}/cancel` | 取消编译任务 |
| GET | `/informatics/typst-notes/{note_id}/export.pdf` | 下载 PDF |
| GET | `/informatics/typst-notes/{note_id}/export.typ` | 下载 .typ 源码 |

### 样式管理（需 staff 权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/informatics/typst-styles` | 列出样式 |
| GET | `/informatics/typst-styles/{key}` | 获取样式（key 为字符串主键） |
| POST | `/informatics/typst-styles` | 创建/更新样式（upsert） |
| PATCH | `/informatics/typst-styles/{key}` | 部分更新 |
| DELETE | `/informatics/typst-styles/{key}` | 删除样式 |
| POST | `/informatics/typst-styles/seed/{key}` | 从内置资源文件导入样式 |

### 分类管理（需 staff 权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/informatics/typst-categories` | 列出分类 |
| POST | `/informatics/typst-categories` | 创建分类 |
| PATCH | `/informatics/typst-categories/{id}` | 更新分类 |
| DELETE | `/informatics/typst-categories/{id}` | 删除分类 |

### GitHub 同步（需 admin 权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/informatics/sync/github/settings` | 获取同步配置 |
| PUT | `/informatics/sync/github/settings` | 更新配置 |
| POST | `/informatics/sync/github/test-connection` | 测试连接 |
| POST | `/informatics/sync/github/trigger` | 触发同步（dry_run, force_recompile） |
| GET | `/informatics/sync/github/runs` | 列出同步记录 |
| GET | `/informatics/sync/github/task-status` | 查询 Celery 任务状态 |

### 公开端点（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/public/informatics/typst-notes` | 列出已发布笔记 |
| GET | `/public/informatics/typst-notes/{note_id}` | 获取已发布笔记 |
| GET | `/public/informatics/typst-notes/{note_id}/export.pdf` | 下载 PDF（仅缓存，无触发编译） |
| GET | `/public/informatics/typst-notes/{note_id}/export.typ` | 下载源码 |
| GET | `/public/informatics/typst-style` | 公开样式（PPT 导出模式用） |

---

## GitHub 同步

### 同步配置

| 字段 | 说明 |
|------|------|
| `repo_owner` | 仓库所有者 |
| `repo_name` | 仓库名称 |
| `branch` | 分支（默认 "main"） |
| `token_encrypted` | 加密存储的 GitHub Token |
| `interval_hours` | 同步间隔（默认 48 小时） |
| `delete_mode` | 删除模式：`unpublish`（取消发布）或 `delete`（硬删除） |
| `enabled` | 是否启用自动同步 |

### 同步源映射

`InformaticsGithubSyncSource` 将 GitHub 文件路径映射到本地笔记：
- 唯一约束：`(repo_owner, repo_name, branch, source_path)`
- `source_sha`：Git 文件 SHA，用于变更检测
- `is_active`：是否活跃（可禁用单个映射）

### 同步流程

1. 触发同步（定时/手动/Celery）
2. 获取 GitHub 仓库文件列表
3. 对比 `source_sha` 检测变更
4. 新增 → 创建本地笔记 + 映射关系
5. 修改 → 更新本地笔记内容
6. 删除 → 根据 `delete_mode` 取消发布或删除
7. 记录同步结果到 `InformaticsGithubSyncRun`

---

## 前端页面

- `/informatics` — 公开笔记列表（Notes.tsx）
- `/informatics/:id` — PDF 阅读器（Reader.tsx + Detail.tsx）
- `/admin/informatics` — 笔记管理后台（TypstNotesPanel.tsx）
- `/admin/informatics/editor/new|:id` — Typst 在线编辑器（EditorPage.tsx）

---

## 相关文档

- [API 参考](../development/API.md) — 第九章：信息学笔记
- [AUTO_REFRESH.md](./AUTO_REFRESH.md) — SSE 实时推送

## 相关文件

### 后端

- `backend/app/api/endpoints/informatics/` — API 路由（6 个文件）
- `backend/app/models/informatics/` — 数据模型（7 个文件）
- `backend/app/services/informatics/` — 业务逻辑
- `backend/app/tasks/typst_compile.py` — Celery 编译任务
- `backend/app/tasks/informatics_sync.py` — Celery 同步任务

### 前端

- `frontend/src/pages/Informatics/` — 公开页面
- `frontend/src/pages/Admin/Informatics/` — 管理后台
- `frontend/src/services/informatics/` — API 客户端
