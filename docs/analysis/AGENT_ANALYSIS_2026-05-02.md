# WangSh 项目分析报告

> 日期：2026-05-02
> 方法：三 Agent 并行只读审计（代码质量、架构、文档一致性）
> 状态：只读分析，未修改任何文件

---

## 一、代码质量审计

### 🔴 严重问题

1. **前端 `any` 类型泛滥** — `useAuth.ts` 中 auth 核心路径使用 `as any` 绕过类型检查，auth 是安全关键模块，类型绕过可能掩盖 API 变更带来的运行时错误。同样问题出现在 AgentData、ClassroomPanel、AnalysisPanel 等多个页面组件中。

2. **后端裸 SQL 查询** — `system/overview.py`、`agents/usage.py`、`system/health.py` 中使用 `text()` 执行裸 SQL。当前虽无参数拼接（暂无注入风险），但脱离了 ORM 的测试和迁移保障。

3. **前端调试日志可能暴露 token 存在性** — `BasicLayout.tsx` 中 `token: getToken() ? "[exists]" : "[null]"`，虽不泄露实际值但暗示存在性。

### 🟡 中等问题

4. **超大组件** — `StatisticsPage.tsx`(1208行)、`GroupDiscussionPanel.tsx`(1190行)、`AssessmentPanel.tsx`(993行)、`ClassroomPanel.tsx`(866行) 职责过多，建议拆分。

5. **assessment admin 路由全部使用 `require_super_admin`** — 24 个路由排除了 `admin` 角色，如果项目意图是让 admin 也能访问则需调整。

6. **Celery 任务中 `except: pass` 过多** — `pythonlab.py` 中多处异常被静默吞没，建议至少 `logger.exception()` 记录。

7. **API 认证依赖** — `/categories/search` 等公开接口要求登录认证，未登录用户无法访问公开页面。

### 🟢 轻微问题

8. **深层相对路径 import** — `RightPanelView.tsx` 等使用 `../../` 深层相对路径，建议使用 `@/` 别名。

### ✅ 亮点

- **后端 API 依赖注入**覆盖率 100%，152 处 Depends 覆盖所有受保护路由
- **数据库异常处理**规范，18 处 rollback 分布 6 个文件，均遵循 try-except-rollback-commit
- **TanStack Query** queryKeys 工厂设计优秀，as const 类型安全
- **主题系统**完整，369 处 CSS 变量引用无硬编码颜色
- **Admin 页面架构**统一，22 个页面使用 AdminPage/AdminTablePanel
- **无 console.log 残留**，日志规范统一

---

## 二、架构梳理

### API 模块（10 个路由模块 + 1 个独立子应用）

| 模块 | 前缀 | 关键端点 |
|------|------|---------|
| auth | /auth | login, register, me, logout, refresh, verify |
| articles | /articles | CRUD + 公开列表 |
| categories | /categories | CRUD + 公开分类 |
| users | /users | CRUD + 权限管理 |
| ai-agents | /ai-agents | 智能体管理 + 对话 + 分组讨论 + 使用分析 |
| informatics | /informatics | Typst 笔记 + GitHub 同步 |
| xbk | /xbk | 选课管理（students, courses, selections 均在 /data/ 子路由下）|
| xxjs | /xxjs | 信息技术课堂点名 |
| assessment | /assessment | 测评系统 |
| classroom | /classroom | 课堂互动计划 |
| pythonlab | /pythonlab | 独立子应用（流程图编程 + Docker 沙箱）|

### 数据模型（25 个 SQLAlchemy 模型）

| 前缀 | 用途 | 模型数 |
|------|------|--------|
| sys_ | 系统用户/角色 | 4 |
| wz_ | 文章系统 | 4 |
| znt_ | AI 智能体 | 6 |
| xbk_ | 校本课选课 | 4 |
| inf_ | 信息学笔记 | 3 |
| xxjs_ | 信息技术课堂 | 2 |
| (其他) | 测评/课堂互动 | 2 |

Alembic 迁移版本：25 个（CLAUDE_MEMORY.md 写 14 个，已过期）

### Celery 任务（4 个已定义任务 + 2 个定时 Beat）

| 任务 | 队列 | 说明 |
|------|------|------|
| compile_typst | typst | Typst 编译 PDF |
| sync_github_repo | celery | GitHub 同步 |
| cleanup_orphan_containers | celery | 清理孤儿 Docker 容器（每 10 分钟）|
| cleanup_stale_sessions | celery | 清理僵尸会话（每 30 分钟）|

### 前端页面

- **公开页面**（15 个）：Home, Login, AIAgents, Articles, ArticleDetail, Informatics, Reader, ITTechnology, PersonalPrograms, XBK, NotFound 等
- **管理后台**（16 个）：Dashboard, Users, AIAgents, AgentData, Articles, Categories, Informatics, EditorPage, ITTechnology, PythonLab, PersonalPrograms, System 等
- **全部懒加载**，使用 React.lazy + Suspense

### 部署架构

| 维度 | 开发模式 | 生产模式 |
|------|---------|---------|
| 服务数 | 8（含 Adminer） | 9（含 sandbox） |
| 前端 | React dev server (6608) | Caddy 静态托管 (80) |
| 热重载 | uvicorn --reload | 多 workers |
| 数据库迁移 | AUTO_CREATE_TABLES=True | alembic upgrade head |
| 镜像 | Dockerfile.dev | Dockerfile.prod（多阶段）|

---

## 三、文档一致性检查

### 🔴 不一致

1. **XBK 模块 API 路径错误** — API.md 中所有 XBK 端点写为 `/xbk/students`、`/xbk/courses` 等，实际路径是 `/xbk/data/students`、`/xbk/data/courses`（缺少 `/data` 前缀），约 20 个端点路径错误。

2. **缺失端点文档** — `/ai-agents/usage/filter-options` 端点存在于代码中但 API.md 未列出。小组讨论的 `/admin/student-profile` 和 `/admin/cross-system-analyze` 同样缺失。

### 🟡 过期

3. **CLAUDE_MEMORY.md 版本号** — 写 `1.5.3`，实际 `1.5.8`（docker-compose.yml 中 IMAGE_TAG=1.5.8）。
4. **待办事项状态** — "提交代码（git commit）" 已完成（最近 commit a4b6a07, May 1），但文档仍标记为 `[ ]`。
5. **Alembic 迁移版本数** — 文档写 14 个，实际 25 个。
6. **CLAUDE_GUIDE.md 记忆路径** — `~/.claude/projects/` 是旧版路径格式。
7. **API 端点总数** — 文档写 "192+"，实际远超 250+。
8. **DEPLOY.md 技术栈** — 写 Ant Design，实际已改为 Tailwind CSS + 自定义主题。

### 🟢 一致

- 端口分配（6608/8000/5432/6379）— 全部一致
- Docker Compose 服务架构 — 一致
- 资源限制配置 — 与 CLAUDE_MEMORY.md 完全一致
- 认证模块端点 — 全部存在
- 文章/分类/用户/信息学/测评/课堂互动端点 — 全部匹配
- docs/README.md 中所有文档路径 — 全部存在

---

## 四、优先修复建议

| 优先级 | 问题 | 修复方式 |
|--------|------|---------|
| P0 | XBK API 文档路径错误 | 更新 API.md，所有 XBK 路径加 `/data` 前缀 |
| P1 | 缺失端点文档 | 补充 `/usage/filter-options` 等 3 个端点 |
| P1 | CLAUDE_MEMORY.md 过期数据 | 更新版本号、Alembic 版本数、待办状态、API 端点数 |
| P2 | 前端 any 类型泛滥 | 逐步替换为具体类型或 unknown |
| P2 | 超大组件拆分 | 按优先级拆分 StatisticsPage 和 GroupDiscussionPanel |
| P3 | 后端裸 SQL 转 ORM | system/overview.py 的统计查询可转 ORM |
| P3 | Celery except:pass 加日志 | 给 pythonlab.py 的静默异常加 logger.exception() |
