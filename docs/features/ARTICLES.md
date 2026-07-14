# 文章管理系统

> 最后更新：2026-07-11

## 概述

文章管理系统（Articles CMS）提供文章、分类和 Markdown 渲染样式的完整内容管理能力。系统以 Redis 缓存加速读取 + SSE Pub/Sub 实现管理端实时通知，支持公开访问和后台管理两套 API。

### 核心功能

- **文章管理**：完整的 CRUD、发布/取消发布、slug 唯一标识、分类归属、自定义 Markdown 样式
- **分类管理**：slug 查找、关键词搜索、热门排行、统计信息、get-or-create 快捷操作
- **Markdown 样式管理**：自定义 CSS 渲染方案，文章可按需绑定样式
- **Redis 缓存**：分角色缓存策略（管理员/普通用户/公开），写操作自动失效
- **SSE 实时推送**：文章变更时通过 `admin_global` 频道广播 `article_changed` 事件

---

## 架构设计

### 数据模型

**核心表**：

| 表名 | 模型类 | 说明 |
|------|--------|------|
| `wz_articles` | Article | 文章主表 |
| `wz_categories` | Category | 分类表 |
| `wz_markdown_styles` | MarkdownStyle | Markdown 渲染样式表 |

**Article 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `title` | String(255) | 文章标题 |
| `slug` | String(255) | URL 友好的唯一别名，带索引 |
| `content` | Text | 文章正文（Markdown 格式） |
| `summary` | Text | 文章摘要（可选） |
| `custom_css` | Text | 文章级自定义 CSS（可选） |
| `style_key` | String(100) FK | 关联的 Markdown 样式 key，删除时 SET NULL |
| `author_id` | Integer FK | 作者 ID，关联 `sys_users.id`，删除时 CASCADE |
| `category_id` | Integer FK | 分类 ID，关联 `wz_categories.id`，删除时 SET NULL |
| `published` | Boolean | 是否发布，默认 False |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间（自动更新） |

**Category 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `name` | String(100) | 分类名称，唯一 |
| `slug` | String(100) | URL 友好的唯一别名，带索引 |
| `description` | Text | 分类描述（可选） |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间（自动更新） |

**MarkdownStyle 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | String(100) | 主键，样式唯一标识 |
| `title` | String(200) | 样式名称 |
| `content` | Text | CSS 样式内容 |
| `sort_order` | Integer | 排序序号，默认 0 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间（自动更新） |

### 关系

```
Article.author_id  →  User.id          (多对一，CASCADE 删除)
Article.category_id → Category.id      (多对一，SET NULL)
Article.style_key   → MarkdownStyle.key (多对一，SET NULL)
Category.articles   → Article[]         (一对多)
MarkdownStyle.articles → Article[]      (一对多)
```

> **注意**：标签功能已移除。现有 `GET /{article_id}/tags` 端点保留兼容，但始终返回空数组。

---

## API 端点

### 路由前缀

- 管理端文章：`/api/v1/articles`（需认证/管理员权限）
- 公开文章：`/api/v1/articles/public`（无需认证）
- 分类：`/api/v1/categories`（部分公开）
- Markdown 样式：`/api/v1/articles/markdown-styles`（管理员）

---

### 文章（Articles）— 10 个端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/articles` | SuperAdmin | 管理端文章列表（分页、筛选、缓存） |
| `POST` | `/articles` | SuperAdmin | 创建新文章 |
| `GET` | `/articles/{article_id}` | 登录用户 | 按 ID 获取文章详情 |
| `GET` | `/articles/slug/{slug}` | 登录用户 | 按 slug 获取文章详情 |
| `PUT` | `/articles/{article_id}` | SuperAdmin | 更新文章 |
| `DELETE` | `/articles/{article_id}` | SuperAdmin | 删除文章 |
| `POST` | `/articles/{article_id}/publish?published=true\|false` | SuperAdmin | 发布或取消发布文章 |
| `GET` | `/articles/{article_id}/tags` | 登录用户 | 获取文章标签（已废弃，返回空数组） |
| `GET` | `/articles/public/list` | 无 | 公开文章列表（支持分页、分类筛选、关键词搜索） |
| `GET` | `/articles/public/{slug}` | 无 | 公开文章详情（按 slug，仅已发布） |

**权限说明**：
- 管理端接口（列表/Create/Update/Delete/Publish）需要 `super_admin` 角色
- 详情接口（按 ID/Slug）需要登录，普通用户只能看到已发布文章，管理员可看所有
- 公开接口无需认证，仅返回 `published=True` 的文章
- 公开列表支持 `?q=` 关键词搜索（标题和内容模糊匹配，搜索时跳过缓存）

---

### 分类（Categories）— 12 个端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/categories` | 登录用户 | 分类列表（分页，可选文章数量统计） |
| `POST` | `/categories` | SuperAdmin | 创建新分类 |
| `GET` | `/categories/search?keyword=` | 登录用户 | 按名称/slug 模糊搜索分类 |
| `GET` | `/categories/popular` | 登录用户 | 热门分类（按文章数量降序） |
| `GET` | `/categories/{category_id}` | 登录用户 | 按 ID 获取分类详情 |
| `GET` | `/categories/slug/{slug}` | 登录用户 | 按 slug 获取分类详情 |
| `PUT` | `/categories/{category_id}` | SuperAdmin | 更新分类 |
| `DELETE` | `/categories/{category_id}` | SuperAdmin | 删除分类（自动将关联文章的 category_id 置 NULL） |
| `POST` | `/categories/get-or-create` | SuperAdmin | 获取或创建分类（按名称/slug 查找） |
| `GET` | `/categories/{category_id}/stats` | 登录用户 | 分类统计（文章总数/已发布/草稿/最新文章） |
| `GET` | `/categories/{category_id}/articles` | 登录用户 | 该分类下的文章列表 |
| `GET` | `/categories/public/list` | 无 | 公开分类列表（含文章数量统计） |

---

### Markdown 样式（Markdown Styles）— 5 个端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/articles/markdown-styles` | Admin | 列出所有样式（按 sort_order 排序） |
| `GET` | `/articles/markdown-styles/{key}` | Admin | 获取单个样式详情 |
| `POST` | `/articles/markdown-styles` | Admin | 创建或覆盖样式（upsert 语义） |
| `PATCH` | `/articles/markdown-styles/{key}` | Admin | 更新样式字段 |
| `DELETE` | `/articles/markdown-styles/{key}` | Admin | 删除样式 |

> Markdown 样式路由挂载在 articles 路由下（`/articles/markdown-styles`），权限级别为 `require_admin`（低于 `require_super_admin`）。

### 默认 Markdown 样式

应用启动时会检查 `terminal`、`paper`、`minimal` 三个默认样式，只创建数据库中缺失的
样式。已有样式的 `title`、`content`、`sort_order` 会完整保留，管理员通过 API
完成的自定义不会在服务重启后被默认内容覆盖。

启动种子行为不改变管理接口语义：`POST /articles/markdown-styles` 仍为 upsert，
`PATCH /articles/markdown-styles/{key}` 仍按请求字段更新已有样式。

---

## 缓存与 PubSub

### 缓存策略

文章读取使用 Redis 缓存，写操作自动失效。区分三种角色维度的缓存键：

| 缓存角色 | 前缀 | TTL 配置 | 说明 |
|---------|------|---------|------|
| 公开 | `articles:p:*` | `ARTICLE_CACHE_PUBLIC_*_TTL` | 未登录用户访问的公开接口 |
| 管理员 | `articles:a:*` | `ARTICLE_CACHE_ADMIN_*_TTL` | 超级管理员的管理端接口 |
| 普通用户 | `articles:u:*` | `ARTICLE_CACHE_USER_*_TTL` | 已登录普通用户的详情接口 |

### 缓存失效

- 创建文章 → `clear_article_cache(article_id, slug)`
- 更新文章 → `clear_article_cache(article_id, old_slug/new_slug)`
- 删除文章 → `clear_article_cache(article_id, slug)`
- 发布/取消发布 → `clear_article_cache(article_id, slug)`

清理逻辑通过 `ArticleCacheKeys.clear_article()` 生成匹配模式列表，以 `SCAN + DELETE` 批量清除，包括所有列表缓存和详情缓存。

### SSE 实时推送

文章写操作通过 Redis Pub/Sub 向 `admin_global` 频道发布事件：

```json
{"type": "article_changed", "action": "create|update|delete", "id": 123}
```

前端管理页面通过 `useAdminSSE('article_changed', callback)` 监听并自动刷新列表。详见 [AUTO_REFRESH.md](./AUTO_REFRESH.md)。

---

## 前端页面

| 路由 | 组件 | 说明 |
|------|------|------|
| `/articles` | `ArticlesPage` | 公开文章列表（含搜索、分类筛选） |
| `/articles/:slug` | `ArticleDetailPage` | 文章详情页（Markdown 渲染 + 样式） |
| `/admin/articles` | `AdminArticlesPage` | 管理后台文章列表（含 SSE 实时刷新、分类管理弹窗） |
| `/admin/articles/editor/new` | `AdminArticleEditorPage` | 新建文章编辑器 |
| `/admin/articles/editor/:id` | `AdminArticleEditorPage` | 编辑文章编辑器 |
| `/admin/articles/new` | Redirect | 重定向到 `/admin/articles/editor/new` |
| `/admin/articles/edit/:id` | `ArticleEditRedirect` | 重定向到 `/admin/articles/editor/:id` |

### 关键前端文件

| 文件 | 说明 |
|------|------|
| `frontend/src/pages/Articles/index.tsx` | 公开文章列表页 |
| `frontend/src/pages/Articles/Detail.tsx` | 公开文章详情页 |
| `frontend/src/pages/Admin/Articles/index.tsx` | 管理端文章列表（含 SSE 刷新） |
| `frontend/src/pages/Admin/Articles/EditorPage.tsx` | 文章编辑器（新建/编辑共用） |
| `frontend/src/pages/Admin/Articles/CategoryManageModal.tsx` | 分类管理弹窗 |
| `frontend/src/services/wz/articles.ts` | 文章 API 服务层 |
| `frontend/src/hooks/queries/useArticlesQuery.ts` | 文章查询 Hook |
| `frontend/src/layouts/AdminEditorLayout.tsx` | 编辑器布局（文章编辑器使用） |

---

## 相关文档

- [AUTO_REFRESH.md](./AUTO_REFRESH.md) — SSE 实时刷新机制
- [API 参考](../development/API.md) — 完整 API 规格
