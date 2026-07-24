# 测试与验证

> 状态：active
> Owner：testing
> 最近复核：2026-07-23

本目录存放测试策略、冒烟测试清单和测试脚本管理文档。

## 文档

| 文件 | 描述 |
|------|------|
| [TEST_STATUS.md](TEST_STATUS.md) | 当前唯一测试状态、功能矩阵、证据和重跑入口 |

## 测试体系概览

WangSh 项目采用多层次测试策略：

### 后端测试
- **单元测试**：`backend/tests/` — pytest + pytest-asyncio
- **当前基线**：见 [TEST_STATUS.md](TEST_STATUS.md)，本页不重复维护测试数字
- **冒烟测试**：`backend/scripts/smoke_*.py` — 覆盖所有功能模块
- **长时巡检**：`backend/scripts/soak_*.py` — PythonLab Phase C 等
- 详见 [backend/tests/README.md](../../../backend/tests/README.md) 和 [backend/scripts/README.md](../../../backend/scripts/README.md)

### 前端测试
- **单元/组件测试**：Vitest + React Testing Library
- **E2E 测试**：Playwright
- **当前结果**：见 [TEST_STATUS.md](TEST_STATUS.md)，本页不复制动态基线
- 详见 [frontend/docs/TESTING_SETUP.md](../../../frontend/docs/TESTING_SETUP.md)

### 生产冒烟
- **全量冒烟**：`scripts/prod-smoke/run.py` — 按模块顺序执行
- **证据安全**：步骤日志、Compose 服务日志、子脚本 JSON 报告和 Phase C 每轮日志
  落盘前会统一脱敏；子进程使用环境白名单，结果目录/文件使用私有权限
- 详见 [scripts/README.md](../../../scripts/README.md)

### CI 门禁
- **通用质量**：`ci-quality.yml` — pytest + 前端 type-check/lint/build
- **文档质量**：`markdown-quality.yml` — 相对链接、锚点、生命周期、归档索引、
  章节数量和动态文档统计
- **PythonLab 定时专项**：owner-concurrency + phasec-gate，验证已部署环境
- **PythonLab PR 门禁**：`pythonlab-pr-runtime.yml` 启动当前 PR 的全栈运行时，
  执行 Chromium 真实 pointer-click smoke 和 owner/Phase C 探针
- 详见 [../deploy/CICD.md](../deploy/CICD.md)

## 完整功能验证矩阵

本表定义 Docker 开发模式下需要逐域验证的长期范围。动态通过数和现场结果只写入
[TEST_STATUS.md](TEST_STATUS.md)。

| # | 功能域 | 用户能力与主要入口 | 后端、Worker 或基础设施 | 主要验证入口 |
|---|---|---|---|---|
| 1 | 系统与开发栈 | 首页、管理仪表盘、系统设置 | health、overview、metrics、feature flags、PostgreSQL、Redis、Adminer | `/health`、`/docs`、Compose health、`test_health.py`、`test_metrics.py` |
| 2 | 认证、会话与用户 | 登录、刷新、退出、单会话轮换、用户列表/导入、角色守卫 | `/auth`、`/users`、refresh token、session guard | `tests/auth/`、`tests/users/`、真实角色边界和替换登录 smoke |
| 3 | 文章与分类 | 文章列表/详情、管理、编辑、分类、Markdown 样式 | `/articles`、`/categories`、缓存隔离 | `tests/articles/`、`smoke_full_deploy.py`、`smoke_feature_suite.py` |
| 4 | AI 智能体 | 智能体管理、对话、SSE、会话详情、使用统计、模型发现 | `/ai-agents`、`/model-discovery`、外部提供商降级 | `tests/ai_agents/`、OpenAPI sweep；默认不调用真实外部 AI |
| 5 | 分组讨论 | 建组、入组、发言、禁言、切组、实时消息、讨论分析 | Redis 锁、Pub/Sub、SSE、Celery | `tests/group_discussion/`、`smoke_group_discussion.py` |
| 6 | Task Analysis | 新建、列表、对比、热点结果、学生问题链结果 | legacy/hot/chains 三类分析 API 和兼容回退 | 5 个 `/task-analysis/*` 页面、分析 API 定向回归 |
| 7 | 课堂互动与计划 | 活动、题目、作答、统计、计划、重置、结束 | `/classroom`、admin stream、Redis/SSE、Celery | `tests/classroom/`、课堂真实角色闭环 |
| 8 | Assessment | 配置、开放时间、题库、答题、评分、统计、个人/小组/群体画像 | `/assessment`、PostgreSQL、可选 AI 降级 | `tests/assessment/`、`smoke_assessment_flow.py`、管理端 4 页面 |
| 9 | 信息学与 Typst | 笔记列表/详情、分类/样式、编辑、PDF、GitHub 同步 | Typst API、异步编译 worker、文件资产 | `tests/informatics/`、`smoke_typst_pipeline.py`、详情/编辑页面 |
| 10 | PythonLab | 程序列表、运行、Debug、Pause/Continue、断点、DAP、终端 | WebSocket、Docker socket、worker、sandbox、资源限制 | `tests/pythonlab/`、owner concurrency、DAP/Phase C smoke、真实 Chrome |
| 11 | 学习平台与思维导图 | Chapters、Content、Progress、个人/公共导图、管理编辑 | `/learning`、进度并发 upsert、Mindmap 生产只读边界 | `tests/learning/`、`smoke_feature_suite.py`、运行时/路由回归 |
| 12 | ML/AI/Agents 学习书籍 | 三套课程阅读、章节编辑、结构化书籍内容 | `/ml` 与前端正式课程 fallback | ML Book CRUD、课程完整性、三个全屏阅读页面 |
| 13 | IT 游戏与教学小游戏 | 游戏仓库、上传、下载、Range、日志、密码锁游戏和配置 | IT games API、ZIP/路径安全、下载计数 | `tests/it/`、真实上传/下载/删除闭环、游戏页面 |
| 14 | XBK 选课 | 学生、课程、志愿、选课、统计、导入导出 | `/xbk`、PostgreSQL | `tests/xbk/`、`scripts/xbk/`、`smoke_feature_suite.py` |
| 15 | XXJS 点名 | 班级导入、名单覆盖、点名数据、班级删除 | `/xxjs/dianming` | `tests/xxjs/`、`smoke_xxjs_dianming.py` |
| 16 | 个人节目与公共内容 | 个人节目、公共模块入口、404 页面 | 前端静态内容与权限路由 | 对应页面巡检、404 和路由合同 |
| 17 | 前端交互层 | 49 个路由族、Dialog、Sheet、浮动面板、错误边界 | Vite 代理、TanStack Query、懒加载 | Vitest、系统 Chrome、UI audit、`UI-PAGES.md` |
| 18 | 数据库、任务与发布基础 | Alembic、bootstrap、日志脱敏、Celery 注册、两套 Compose | PostgreSQL migration、Redis、Typst/PythonLab worker、Caddy | system tests、迁移检查、worker ping、workflow contracts、构建 |

## Docker 逐项测试计划

1. **范围冻结**：记录分支、dirty worktree、版本和排除目录；测试期间不 reset、clean、
   stage、commit、push 或发布镜像。
2. **启动与基线**：用 `bash start-dev.sh --docker` 或当前等价 Compose 上下文启动开发
   栈，确认固定服务、`/health`、`/docs`、PostgreSQL、Redis、Alembic head 和 worker
   注册状态。
3. **认证先行**：只建立一个管理员浏览器会话，再按管理员、教师、学生和匿名身份验证
   登录、`/auth/me`、refresh、logout、角色路由和越权拒绝。
4. **只读功能**：先验证公开列表、配置、统计、学习内容、模型发现和 OpenAPI GET sweep，
   区分预期 `401/403/404/422` 与真实回归。
5. **状态型功能**：使用唯一 `smoke-*` 前缀逐域执行 CRUD、课堂、讨论、测评、Typst、
   XBK、XXJS、Mindmap、ML Book 和 IT 游戏闭环；每个域完成后立即清理自己的数据库、
   Redis、文件和容器数据。
6. **异步与实时链路**：验证 Celery、Typst 编译、Redis Pub/Sub、SSE、PythonLab
   WebSocket/DAP、连续 `Continue`、owner 并发和动态 sandbox 清理。
7. **完整浏览器面**：按 `UI-PAGES.md` 验证 49 个路由族，再抽查关键 Dialog、Sheet 和
   浮动面板；有效 fixture 页面不得出现 page error、失败请求、console error 或意外
   `4xx/5xx`。
8. **代码门禁**：按改动范围运行 pytest、Vitest、前端脚本、TypeScript、构建、Python
   governance、workflow contracts、Markdown contracts 和 `git diff --check`。
9. **日志与残留**：检查 backend、frontend、worker、PostgreSQL 和 Redis 日志；确认
   没有动态 PythonLab 容器、测试前缀数据、测试 PDF/ZIP、临时账号、refresh token、
   Redis key、截图或报告残留。
10. **结果沉淀**：只把当前事实写入 `TEST_STATUS.md`；一次性驱动和 `/tmp` 证据删除，
    不把本地验证误写成 GitHub、Docker Hub 或生产部署完成。

## 测试文件和结果清理规则

- `backend/tests/test_*.py`、模块 `tests/`、Vitest 用例和已接入 CI 的 smoke/soak 属于
  长期回归资产，测试后保留。
- 一次性排障 `.py`、临时浏览器驱动、截图、JSON 报告和 `test-results/` 可重建证据在
  结论沉淀后删除，不回流到正式测试目录。
- 删除仓库内测试或脚本前，必须确认已有等价替代，并检查 workflow、README、npm 命令、
  生产 smoke 编排和代码引用；删除脚本还要更新 `docs/scripts/ARCHIVE_INDEX.md`。
- `.pytest_cache`、`__pycache__`、构建缓存和开发依赖可以继续保留供本地开发复用，不把
  “看起来不整洁”作为删除它们的理由。

## 相关文档

- [../deploy/CICD.md](../deploy/CICD.md) — CI/CD 工作流
- [../deploy/DEPLOY.md](../deploy/DEPLOY.md) — 部署指南
- [../frontend/UI-PAGES.md](../frontend/UI-PAGES.md) — 49 个路由族与重点交互清单
