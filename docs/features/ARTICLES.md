# 文章管理系统

> 最后更新：2026-10-13

## 分类管理弹窗与读取生命周期（未发布修复）

实际入口为 `/admin/articles` 的“分类管理”按钮，组件为
`CategoryManageModal.tsx`；没有独立 `/admin/categories` 运行路由。
工具栏复用共享后台筛选模式，搜索及筛选采用透明嵌入式表面，表格统一列宽来源；
长名称、slug、描述可换行，窄屏工具栏换行，宽表在弹窗内部横向滚动。
操作列按编辑/删除按钮组的实际宽度保留空间，桌面默认不应裁切操作；手机滚动到底后操作完整可达。

初次读取失败显示明确错误与重试，不当作真实空数据；刷新失败保留上次成功结果并
说明状态。搜索或筛选无匹配与原始分类为空分别提示。新增、编辑弹窗取消或保存后
恢复原入口焦点；原行已不可达时回到新增入口。

分类读取按请求代次隔离 success、error 和 finally；旧成功不能覆盖当前筛选结果，
旧失败不能改写当前错误状态或弹出过时提示，旧完成不能提前清除新请求的加载状态。
关闭、重新打开及卸载使前一读取代次失效；最新请求失败仍保留错误和重试入口。
请求参数、客户端筛选/排序、分页、CRUD 与权限沿用既有合同。真实 Docker 乱序响应
是受控测试，不能表述为自然后端故障；最终证据及限定范围见
[TEST_STATUS](../docker/testing/TEST_STATUS.md)。

## 列表、搜索与草稿预览合同（未发布修复）

管理列表的发布开关名称包含文章标题，分类筛选、编辑发布/分类/样式控件及正文
均有明确语义名称。窄屏编辑器的侧栏按实际内容高度排列，正文保留最小编辑高度，
由外层纵向滚动，避免侧栏样式控件被正文覆盖。公开列表仍遵守下方桌面两列合同。

管理端搜索由后端按标题或正文筛选后分页；页码、每页数量、分类、作者、发布状态与关联开关共同进入请求和缓存键，页面不再仅过滤当前页。筛选改变回到第一页，列表加载失败显示错误和重试，不作为真实空列表。

管理草稿预览使用已认证的详情入口与独立预览页。公开详情只返回已发布文章；管理预览不应把草稿填入公开详情缓存。公开页的关键词与分类可以组合，分页和总数使用服务端结果。

### 公开列表布局与键盘入口

公开列表的 `page`、`size`、`category` 与 `q` 共用URL状态源，刷新和浏览历史恢复当前
筛选；非法页码/分类回退安全默认值，每页数量仅接受已有选项。改变关键词或分类回到
第一页；清除搜索和分类同时清理对应参数，不保留旧页。搜索态分页可见性仍按下方合同。

公开文章页的桌面布局固定为两列：左侧窄栏包含嵌入式搜索和纵向分类，右侧主区域
包含文章列表及分页。移动端改为上下堆叠，上方搜索/分类，下方文章列表/分页；分类
可横向滚动，搜索和分类保持非零高度及真实 pointer 可达。桌面采用原生纵向焦点
滚动，移动分类保留显式焦点可见处理。当前代码在有关键词时隐藏分页栏，无关键词
且有结果时在右侧列表下方显示分页及每页数量选择，不承诺搜索态始终显示分页。

保持用户确认的永久浅色、扁平、嵌入式风格：搜索休止态边框及背景透明，hover
使用语义背景，focus 使用可见语义焦点；列表采用弱分隔和语义色，不以突出边框、
重阴影或多层卡片强化搜索与内容区。

`ArticleItem` 的文章整行入口使用原生 `button type="button"`，支持 Tab/Shift+Tab、Enter/Space，使用
现有语义 focus ring 并在滚动区内可见。缺少 slug 时禁用入口，不通过键盘触发表单提交。
内部摘要、分类和元信息保持合法 button 内容及原有弱边界，不改变桌面两列。

列表行使用局部 `.article-item-row` 的直线弱分隔与轻 hover，保持可见的 inset
焦点环；重置入口使用已有 ghost 图标按钮并在清除后恢复搜索焦点。手机摘要独立
成行，作者、分类和日期允许换行；长词限制在行内，完整元信息仍保留在 DOM 与
原生 title。日期使用 `time` 语义，显示格式不变。分类交互高度复用现有 control
token，清理无引用的旧全局 hover 规则，不另设颜色来源。

### 当前验证范围与内容限制

各批次的 Chrome/WebKit、两列/堆叠、搜索、分类、分页、键盘与错误恢复实测
按各自源码、镜像和数据前提记录在 TEST_STATUS。旧 v12 使用空分类及未跨页样本，
不证明后续候选的分类组合与跨页行为；新批次须使用自己的非空样本重新验证。
空内容页面只证明外壳与空态，不能作为内容阅读、全角色 CRUD 或整站验收。

接口细节见 [API](../development/API.md)，当前镜像验收和视觉边界见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。文章普通 Markdown/GFM 合同不自动扩展为 BookReader 的公式/Mermaid 合同。

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

管理列表的基础字段、作者、分类和样式响应投影由
`backend/app/api/endpoints/content/articles/_list_serialization.py` 的纯函数承担；
原路由继续持有鉴权、查询、缓存及事务顺序。该职责提取保留原响应字段与缺失值
处理，不新增 API 或数据库迁移。

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
- 详情接口（按 ID/Slug）需要登录，未发布草稿仅 `super_admin` 可读；普通管理员及其他角色不能据管理身份读取草稿。公开详情仍仅返回已发布文章。
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
