# WangSh 当前工作区变更批次清单

> 状态：active
> Owner：project-governance
> 最近复核：2026-07-11
> 基线来源：`git status --short --branch`、`git diff --stat`、
> `git diff --name-status`、`git ls-files --others --exclude-standard`
> 归档条件：当前 dirty worktree 已按本清单形成可审查提交，并由 PR 证据替代

## 一、目的与边界

本文冻结 2026-07-11 当前工作区范围，为后续建分支、拆 commit、运行 PR 门禁和发布
验收提供唯一批次清单。

- 当前分支：`main`，跟踪 `origin/main`。
- 本次只盘点和归类，不创建分支，不 commit，不 push，不修改业务代码。
- 每个当前改动入口只归属一个主批次；跨批次关系单独记录。
- 功能专属测试跟随功能批次，跨模块测试基础设施、治理脚本和综合报告归第 7 批。
- 本清单自身及本次同步修改的治理文档是 Task 1 控制面产物，不反向计入冻结快照。

## 二、只读快照

| 指标 | 当前值 |
|---|---:|
| tracked 改动入口 | 142 |
| untracked 改动入口 | 80 |
| 合计入口 | 222 |
| tracked diff | 6,514 additions / 3,646 deletions |
| 当前分支 | `main` |

原 30/60/90 计划记录了 70 个 untracked 入口；本次实时复核为 80 个。新增的 10 个入口
主要来自补齐后的治理、测试和文档文件，因此后续验收统一以本清单的 222 个入口为准。
创建本清单后，Git 当前会额外显示 1 个 untracked 治理产物；因此现时工作区是
142 个 tracked、81 个 untracked，其中冻结批次仍是 142 + 80。

项目整理阶段在冻结快照之外追加了 25 个高可信无引用文件删除，并同步脚本归档索引
和两份历史接力正文，因此整理后的实时工作区为 165 个 tracked 改动、83 个 untracked
文件。冻结业务批次仍保持 222 个入口；这 25 个删除项作为独立整理批次审查，不混入
功能提交。

## 三、批次汇总

| 批次 | 范围 | tracked | untracked | 合计 |
|---|---|---:|---:|---:|
| 1 | 用户权限、认证和会话 | 12 | 9 | 21 |
| 2 | 课堂、AI agents 和异步任务 | 19 | 11 | 30 |
| 3 | Assessment、Alembic 和数据库 | 9 | 2 | 11 |
| 4 | IT 游戏、学习平台、XBK 和文章 | 34 | 25 | 59 |
| 5 | 前端认证、路由、UI 和 bundle | 9 | 4 | 13 |
| 6 | Docker、PythonLab、CI 和发布脚本 | 27 | 8 | 35 |
| 7 | 文档、测试与工程治理 | 32 | 21 | 53 |
| **总计** |  | **142** | **80** | **222** |

### 整理追加批次：无引用旧代码和一次性脚本

以下 25 个文件在删除前均为 Git 已跟踪、相对 `origin/main` 无本地修改，并经静态引用
检查、前后端完整测试、类型检查和生产构建验证：

```text
backend/app/api/endpoints/agents/ai_agents.py
backend/app/models/base.py
backend/scripts/archive/seed_ml_book.py
backend/scripts/run_analysis.py
backend/scripts/seed_conversation_mock_data.py
frontend/public/index.html
frontend/scripts/seed-learning.ts
frontend/src/components/Admin/FormDialog.tsx
frontend/src/components/Auth/LoginForm.tsx
frontend/src/components/Common/Breadcrumbs.tsx
frontend/src/components/Common/SectionErrorBoundary.tsx
frontend/src/lib/badge-variants.ts
frontend/src/lib/icon-map.ts
frontend/src/pages/AIAgents/hooks/useForceRender.ts
frontend/src/pages/Admin/AgentData/components/ChainCard.tsx
frontend/src/pages/Admin/AgentData/components/ChainThoughtPathCard.tsx
frontend/src/pages/Admin/AgentData/components/TeachingSuggestionsPanel.tsx
frontend/src/pages/Admin/AgentData/components/TimelineChart.tsx
frontend/src/pages/Admin/Dashboard/components/StatusItem.tsx
frontend/src/pages/Admin/ITTechnology/ml/components/FilterToolbar.tsx
frontend/src/pages/Admin/ITTechnology/ml/experiments.ts
frontend/src/pages/Admin/ITTechnology/ml/knowledge.ts
frontend/src/pages/Admin/ITTechnology/ml/resources.ts
frontend/src/pages/Admin/ITTechnology/ml/roadmap.ts
frontend/src/pages/Admin/ITTechnology/ml/tools.ts
```

该批次应作为独立 `chore: remove verified dead code and generated artifacts` 审查，
不要与迁移、权限或发布行为修改混合。

## 四、批次明细

### 批次 1：用户权限、认证和会话

目标：统一登录、refresh 原子轮换、退出降级、用户管理权限和前端认证竞态。

**Tracked（12）**

```text
backend/app/api/endpoints/auth/auth.py
backend/app/api/endpoints/management/users/users.py
backend/app/core/session_guard.py
backend/app/services/auth.py
backend/tests/auth/test_auth_logout_refresh.py
backend/tests/auth/test_auth_refresh_nonce.py
backend/tests/core/test_session_guard_bootstrap.py
backend/tests/users/test_users_crud.py
backend/tests/users/test_users_import.py
frontend/src/hooks/useAuth.ts
frontend/src/pages/Auth/Login.tsx
frontend/src/services/api.ts
```

**Untracked（9）**

```text
backend/app/api/endpoints/management/users/import_service.py
backend/app/api/endpoints/management/users/policy.py
backend/app/api/endpoints/management/users/schemas.py
backend/tests/auth/test_authenticate_user_contract.py
backend/tests/auth/test_refresh_token_rotation.py
frontend/src/components/Auth/RoleGuard.test.ts
frontend/src/components/Auth/RoleGuard.tsx
frontend/src/components/Auth/authRace.test.ts
frontend/src/components/Auth/roleAccess.ts
```

### 批次 2：课堂、AI agents 和异步任务

目标：课堂访问控制、计划事务、Celery 自动分析、Redis Pub/Sub 和深度分析职责拆分。

**Tracked（19）**

```text
backend/app/api/endpoints/agents/ai_agents/analysis.py
backend/app/api/endpoints/classroom/admin.py
backend/app/api/endpoints/classroom/plan.py
backend/app/api/endpoints/classroom/student.py
backend/app/core/celery_app.py
backend/app/core/pubsub.py
backend/app/models/agents/__init__.py
backend/app/models/classroom/activity.py
backend/app/schemas/classroom.py
backend/app/services/agents/agent_deep_analysis.py
backend/app/services/classroom.py
backend/app/services/classroom_plan.py
backend/tests/ai_agents/test_agent_deep_analysis.py
backend/tests/assessment/test_classroom_service_flow.py
backend/tests/classroom/test_classroom_plan.py
backend/tests/test_pubsub.py
frontend/src/pages/Admin/AgentData/TaskAnalysisComparePage.tsx
frontend/src/pages/Admin/AgentData/components/ChainBeamChart.tsx
frontend/src/pages/Admin/AgentData/components/TaskAnalysisListPanel.tsx
```

**Untracked（11）**

```text
backend/alembic/versions/20260628_0001_add_classroom_activity_class_desc.py
backend/app/services/agents/agent_analysis_events.py
backend/app/services/agents/agent_analysis_summaries.py
backend/app/services/agents/agent_chain_analysis.py
backend/app/services/agents/agent_hot_analysis.py
backend/app/services/classroom_plan_rules.py
backend/app/tasks/classroom.py
backend/tests/classroom/test_classroom_access_control.py
backend/tests/classroom/test_classroom_service.py
backend/tests/classroom/test_classroom_tasks.py
frontend/src/components/asyncAgentAnalysis.test.tsx
```

### 批次 3：Assessment、Alembic 和数据库

目标：正式迁移、legacy Alembic 兼容、空库初始化和 assessment 字段约束一致性。

**Tracked（9）**

```text
backend/alembic/env.py
backend/app/core/startup.py
backend/app/models/assessment/answer.py
backend/app/models/assessment/question.py
backend/scripts/bootstrap_db.py
backend/scripts/check_migration_state.py
backend/tests/system/test_bootstrap_db.py
backend/tests/system/test_migration_state_check.py
backend/tests/system/test_startup_database_init.py
```

**Untracked（2）**

```text
backend/alembic/versions/20260711_0001_add_assessment_availability.py
backend/app/db/alembic_compat.py
```

### 批次 4：IT 游戏、学习平台、XBK 和文章

目标：IT 游戏资源库垂直功能、信息学安全加固、学习编辑器、思维导图、XBK 和文章体验。

**Tracked（34）**

```text
backend/app/api/__init__.py
backend/app/api/endpoints/informatics/public_typst_notes.py
backend/app/core/config/_services.py
backend/app/models/__init__.py
backend/app/services/informatics/typst_notes.py
frontend/src/components/Admin/AdminAppCard.tsx
frontend/src/hooks/queries/queryKeys.test.ts
frontend/src/hooks/queries/queryKeys.ts
frontend/src/pages/Admin/ITTechnology/agents/index.tsx
frontend/src/pages/Admin/ITTechnology/ai/data.ts
frontend/src/pages/Admin/ITTechnology/ai/index.tsx
frontend/src/pages/Admin/ITTechnology/index.tsx
frontend/src/pages/Admin/ITTechnology/learning/BookReader.tsx
frontend/src/pages/Admin/ITTechnology/learning/InteractiveMindMapEditor.tsx
frontend/src/pages/Admin/ITTechnology/learning/MindMapEditor.tsx
frontend/src/pages/Admin/ITTechnology/learning/MindMapEditorLib.tsx
frontend/src/pages/Admin/ITTechnology/learning/MindMapManager.tsx
frontend/src/pages/Admin/ITTechnology/learning/TabEditorPage.tsx
frontend/src/pages/Admin/ITTechnology/ml/data.ts
frontend/src/pages/Admin/ITTechnology/ml/index.tsx
frontend/src/pages/Admin/Informatics/index.tsx
frontend/src/pages/Articles/Detail.tsx
frontend/src/pages/Games/LockCracker.tsx
frontend/src/pages/ITTechnology/ITTechnology.css
frontend/src/pages/ITTechnology/index.tsx
frontend/src/pages/MindmapGallery.tsx
frontend/src/pages/Xbk/Xbk.css
frontend/src/pages/Xbk/components/XbkAnalysisModal.tsx
frontend/src/pages/Xbk/components/XbkDeleteModal.tsx
frontend/src/pages/Xbk/components/XbkEditModal.tsx
frontend/src/pages/Xbk/components/XbkExportModal.tsx
frontend/src/pages/Xbk/components/XbkImportModal.tsx
frontend/src/pages/Xbk/index.tsx
frontend/src/styles/index.css
```

**Untracked（25）**

```text
backend/alembic/versions/20260624_0001_add_it_game_tables.py
backend/app/api/endpoints/it/__init__.py
backend/app/api/endpoints/it/games.py
backend/app/models/it/__init__.py
backend/app/models/it/game.py
backend/app/schemas/it/__init__.py
backend/app/schemas/it/game.py
backend/app/services/it/__init__.py
backend/app/services/it/games.py
backend/tests/it/test_games_api.py
backend/tests/it/test_games_delete_download.py
backend/tests/it/test_games_upload.py
frontend/src/components/Auth/ITGamesAccess.test.ts
frontend/src/components/Auth/ITGamesAccess.ts
frontend/src/components/adminITFeatureFlagsAsync.test.tsx
frontend/src/components/asyncLearningEditors.test.tsx
frontend/src/components/mindmapGalleryAsync.test.tsx
frontend/src/hooks/queries/useITGamesQuery.ts
frontend/src/pages/Admin/ITTechnology/GamesManager.tsx
frontend/src/pages/ITTechnology/GamesRepo.tsx
frontend/src/pages/ITTechnology/components/GameCard.tsx
frontend/src/pages/ITTechnology/components/GameDetailModal.tsx
frontend/src/pages/ITTechnology/components/GameUploadModal.tsx
frontend/src/services/it/games.ts
frontend/src/services/it/index.ts
```

### 批次 5：前端认证、路由、UI 和 bundle

目标：角色路由矩阵、通用布局、构建分包、CSS token 和 UI/bundle 基线。

**Tracked（9）**

```text
frontend/package-lock.json
frontend/package.json
frontend/scripts/bundle-budget.mjs
frontend/scripts/ui-audit-baseline.json
frontend/src/App.tsx
frontend/src/layouts/AdminLayout.tsx
frontend/src/layouts/BasicLayout.tsx
frontend/src/lib/monacoSetup.ts
frontend/vite.config.ts
```

**Untracked（4）**

```text
frontend/scripts/bundle-budget-lib.mjs
frontend/scripts/bundle-budget-lib.test.mjs
frontend/scripts/token-check.mjs
frontend/scripts/token-check.test.mjs
```

### 批次 6：Docker、PythonLab、CI 和发布脚本

目标：生产镜像、Compose 隔离、PythonLab namespace、PR runtime、release-set 和
production smoke 证据。

**Tracked（27）**

```text
.env.example
.github/workflows/ci-quality.yml
.github/workflows/dockerhub-amd64.yml
.github/workflows/pr-pythonlab-owner-gate.yml
.github/workflows/pr-pythonlab-phasec-gate.yml
backend/Dockerfile.dev
backend/Dockerfile.prod
backend/app/core/config/_pythonlab.py
backend/app/core/sandbox/docker.py
backend/app/tasks/pythonlab.py
backend/scripts/smoke_openapi_sweep.py
backend/scripts/smoke_pythonlab_dap_step_watch_soak.py
backend/scripts/smoke_pythonlab_low_memory_start_failure.py
backend/scripts/smoke_pythonlab_print_visibility_probe.py
backend/scripts/smoke_pythonlab_ws_owner_concurrency.py
backend/scripts/soak_pythonlab_phasec.py
backend/tests/pythonlab/test_pythonlab_docker_limits.py
backend/tests/system/test_smoke_openapi_sweep.py
docker-compose.dev.yml
docker-compose.yml
frontend/.dockerignore
frontend/Dockerfile.prod
frontend/scripts/copy-pyodide.js
frontend/scripts/prod-smoke-ui.mjs
scripts/check-version-consistency.mjs
scripts/deploy.sh
scripts/prod-smoke/run.py
```

**Untracked（8）**

```text
.github/workflows/pythonlab-pr-runtime.yml
backend/app/core/sandbox/docker_runtime.py
backend/tests/system/test_prod_smoke_compose_context.py
frontend/scripts/copy-pyodide.test.mjs
frontend/scripts/docker-build-context.test.mjs
frontend/scripts/prod-smoke-ui-lib.mjs
frontend/scripts/prod-smoke-ui-lib.test.mjs
scripts/workflow-contracts.test.mjs
```

### 批次 7：文档、测试与工程治理

目标：owner 文档、发布/测试说明、Python 规模门禁、阶段报告和项目协作规则。

**Tracked（32）**

```text
README.md
backend/scripts/README.md
docs/DATABASE_PERFORMANCE_GUIDE.md
docs/DOCUMENTATION_OWNERSHIP.md
docs/DOCUMENTATION_RULES.md
docs/README.md
docs/development/API.md
docs/docker/README.md
docs/docker/RELEASE_NOTES.md
docs/docker/deploy/CICD.md
docs/docker/deploy/DEPLOY.md
docs/docker/frontend/UI-PAGES.md
docs/docker/plans/2026-05-03-it-technology-markdown-book-system.md
docs/docker/plans/2026-05-03-learning-platform-improvement.md
docs/docker/plans/pythonlab-capability-inventory.md
docs/docker/plans/sse-redis-pubsub-migration.md
docs/features/AI_AGENTS.md
docs/features/AUTO_REFRESH.md
docs/features/CLASSROOM.md
docs/features/INFORMATICS.md
docs/features/PYTHONLAB.md
docs/features/assessment/ASSESSMENT_API.md
docs/features/assessment/ASSESSMENT_DATABASE.md
docs/features/assessment/ASSESSMENT_DESIGN.md
docs/features/assessment/ASSESSMENT_FILES.md
docs/features/assessment/ASSESSMENT_FRONTEND.md
docs/features/assessment/ASSESSMENT_PROMPTS.md
frontend/docs/TESTING_SETUP.md
frontend/scripts/README.md
frontend/src/styles/COLORS.md
frontend/src/styles/ROLES.md
scripts/README.md
```

**Untracked（21）**

```text
CLAUDE.md
backend/scripts/check_python_governance.py
backend/scripts/python-governance-baseline.json
backend/tests/system/test_python_governance.py
docs/ENGINEERING_GOVERNANCE.md
docs/docker/archive/README.md
docs/docker/frontend/README.md
docs/docker/plans/2026-07-11-project-governance-30-60-90-execution-plan.md
docs/docker/plans/2026-07-11-project-governance-handoff.md
docs/docker/plans/2026-07-11-project-governance-phase2-handoff.md
docs/docker/plans/2026-07-11-project-governance-phase3-handoff.md
docs/docker/plans/2026-07-11-project-governance-phase4-handoff.md
docs/docker/plans/2026-07-11-project-health-and-improvement-report.md
docs/docker/plans/README.md
docs/docker/testing/README.md
docs/features/ARTICLES.md
docs/features/DIANMING.md
docs/features/IT_GAMES.md
docs/features/LEARNING.md
docs/features/ML_BOOK.md
docs/features/XBK.md
```

### 冻结后追加入口（2026-07-12）

本节不改写 2026-07-11 的 222 个冻结入口，只补录后续验证、修复和整理新增的范围，
避免按批次暂存时漏掉 tracked 文件直接依赖的测试、迁移或文档。2026-07-12 最终复核
时实时工作区为 186 个 tracked 状态入口、95 个 untracked 文件，共 281 个入口。

**批次 1：认证和角色路由**

```text
frontend/src/components/Auth/loginRoleRedirect.test.tsx
frontend/src/components/Auth/useAuthStrictMode.test.tsx
```

**批次 2：课堂运行时修复**

```text
backend/app/services/agents/group_discussion/session_service.py
backend/tests/group_discussion/test_group_discussion_session_creation.py
```

**批次 3：数据库迁移**

```text
backend/alembic/versions/20260711_0002_restore_legacy_baseline_indexes.py
```

**批次 4：文章、前端页面和运行时验证**

```text
backend/app/api/endpoints/content/categories/categories.py
backend/app/schemas/articles/__init__.py
backend/app/schemas/articles/category.py
backend/app/services/articles/markdown_style_examples.py
backend/tests/articles/test_articles_crud.py
backend/tests/articles/test_markdown_style_examples.py
frontend/src/pages/Admin/ITTechnology/learning/MindMapViewer.tsx
frontend/src/components/mindMapViewer.test.tsx
frontend/scripts/ui-visual-routes.json
```

**批次 6：开发入口和环境治理**

```text
start-dev.sh
stop-dev.sh
.gitignore
```

**批次 7：文档、归档和整理追加**

```text
docs/docker/archive/plans/2026-05-03-it-technology-markdown-book-system.md
docs/docker/archive/plans/2026-05-03-learning-platform-improvement-design.md
docs/docker/archive/plans/2026-05-03-learning-platform-improvement.md
docs/docker/archive/plans/2026-07-11-project-governance-handoff.md
docs/docker/archive/plans/2026-07-11-project-governance-phase2-handoff.md
docs/docker/archive/plans/2026-07-11-project-governance-phase3-handoff.md
docs/docker/archive/plans/sse-redis-pubsub-migration.md
docs/docker/frontend/ui-style-guardrails.md
docs/docker/plans/2026-05-03-learning-platform-improvement-design.md
docs/docker/plans/2026-07-11-change-batch-manifest.md
docs/docker/plans/2026-07-11-modification-validation-handoff.md
docs/docker/plans/2026-07-11-project-cleanup-handoff.md
docs/docker/plans/ui-final-regression-checklist.md
docs/docker/plans/ui-page-health-template.md
docs/docker/plans/ui-single-page-governance.md
docs/docker/testing/test-script-cleanup-inventory.md
docs/scripts/ARCHIVE_INDEX.md
```

其中 phase1-4、validation 和 cleanup handoff 是执行过程中的未提交临时文档，长期信息
已分别进入当前收口计划、`TEST_STATUS.md` 和健康报告，2026-07-13 文档整理时删除。
本节保留原路径仅用于说明冻结快照，不表示这些文件仍应进入提交。

暂存时必须同时检查本节与原七批清单；`git diff --cached --name-status` 中出现本节未列
的新入口时，应先更新清单再继续提交。

## 五、跨批次依赖

| 来源 | 依赖批次 | 说明 |
|---|---|---|
| 批次 1 | 5 | `RoleGuard`、`roleAccess`、`useAuth` 必须与 `App.tsx` 和 `AdminLayout.tsx` 的路由/菜单限制一起审查 |
| 批次 1 | 6 | production smoke、PythonLab PR path filter 和登录验证依赖新的认证/refresh 行为 |
| 批次 1 | 7 | `ROLES.md`、API 和 release notes 必须与用户管理权限保持一致 |
| 批次 2 | 3 | 课堂 `class_name` / `description` 模型变化依赖正式 Alembic migration |
| 批次 2 | 6 | 课堂自动分析依赖 Celery worker、Compose 队列和运行环境 |
| 批次 2 | 7 | AI agents、课堂和 SSE owner 文档必须同步 |
| 批次 3 | 6 | migration preflight、bootstrap 和 application startup 由 CI/Compose/部署脚本调用 |
| 批次 3 | 7 | assessment 数据库文档和部署迁移说明必须同步 |
| 批次 4 | 5 | IT 游戏和学习页面依赖通用路由守卫、query key、token 和 Vite 分包 |
| 批次 4 | 6 | IT 上传上限、Typst 超时和生产镜像依赖 `.env.example` / Docker 配置 |
| 批次 4 | 7 | IT_GAMES、LEARNING、XBK、ARTICLES、INFORMATICS 和 API 文档必须同步 |
| 批次 5 | 6 | bundle/token/script tests 由通用 CI 和生产构建门禁调用 |
| 批次 6 | 7 | CI/CD、DEPLOY、testing README 和 release notes 是发布行为的权威说明 |

关键合并规则：

1. `backend/app/models/__init__.py` 主归批次 4，但同时注册课堂计划模型；审查批次 2
   时必须确认其公共导入没有遗漏。
2. 四条新增 migration 构成硬顺序：
   `20260624_0001_add_it_game_tables` →
   `20260628_0001_add_classroom_activity_class_desc` →
   `20260711_0001_add_assessment_availability` →
   `20260711_0002_restore_legacy_baseline_indexes`。批次 4 必须先于批次 2，批次 2
   必须先于批次 3 进入提交序列，索引恢复 migration 随批次 3 一并提交；否则中间
   commit 无法形成完整 Alembic revision graph。
3. `frontend/src/App.tsx` 主归批次 5，但包含批次 1 权限矩阵和批次 4 IT 游戏路由；
   不可在缺少相关组件时单独提交。
4. `.env.example` 主归批次 6，但包含批次 4 的 IT 上传上限；配置和功能实现必须同一
   PR 到达。
5. `frontend/package.json` 与 `frontend/package-lock.json` 同归批次 5，避免任何
   中间 commit 触发版本一致性门禁失败。

## 六、本地敏感文件和生成物

### 明确禁止纳入提交

以下路径已由 `.gitignore` 排除，并且不在 222 个入口中：

```text
.env
.env.dev
test-results/
frontend/build/
frontend/public/pyodide/
.playwright-mcp/
.coverage
__pycache__/
data/
```

- `release-set.txt` 和仓库根层通用 `coverage/` 当前没有稳定的 ignore 保护，生成后必须
  人工确认不进入暂存区；前端 `frontend/coverage/` 已被忽略。
- 私有 `.env` 的本机版本已同步为 `1.6.0`，但仍只保留在本地。
- 不提交生产 smoke 截图、浏览器报告、临时日志、Docker simulation workspace、
  数据库 volume 内容或明文凭据。
- 本次 secret-shaped diff 扫描未发现硬编码 JWT、Bearer token、Cookie 或明文密码。

### 允许提交但必须人工复核的受控基线

```text
backend/scripts/python-governance-baseline.json
frontend/scripts/ui-audit-baseline.json
frontend/package-lock.json
```

这些文件不是临时垃圾；它们分别承担 Python 治理、UI audit 和依赖锁定职责。提交前
必须确认数值变化来自真实治理结果，而不是抬高阈值或掩盖回归。

## 七、建议分支和 commit 边界

建议分支：

```text
codex/project-governance-release-1.6.0
```

基于 2026-07-11 冻结的 222 个入口，原计划的 5 个 commit 不足以单独容纳 IT 游戏垂直功能和
独立清理批次，建议扩展为以下 8 个可审查 commit：

1. `fix: harden auth sessions and user management`
2. `feat: add IT game repository and harden learning surfaces`
3. `fix: enforce classroom ownership and async analysis consistency`
4. `fix: formalize assessment and database migrations`
5. `refactor: enforce frontend route and bundle contracts`
6. `ci: enforce PythonLab and production release contracts`
7. `chore: remove verified dead code and generated artifacts`
8. `docs: synchronize governance and release guidance`

执行约束：

- 已创建分支 `codex/project-governance-release-1.6.0`；Commit 1-5 已完成，
  Commit 6-8 尚未提交或 push。
- 每个 commit 必须包含其功能专属测试；跨模块治理测试放第 6 或第 8 个 commit。
- 第 2、3、4 个 commit 的顺序是 Alembic revision graph 的硬约束，不可交换。
- 第 7 个清理 commit 只包含本清单列出的 25 个已验证删除入口。
- 第 8 个文档 commit 只能在前 7 个 commit 的最终行为稳定后收口。
- 若实际拆分发现单文件同时承载多个不可分割改动，优先保留原子行为，不使用危险的
  交互式拆块强行切割。

## 八、Task 1 验收

- [x] 实时快照覆盖全部 142 个 tracked 和 80 个 untracked 入口。
- [x] 222 个入口全部归入七个主批次。
- [x] 跨批次依赖、受控基线和禁止提交项已标记。
- [x] 已创建发布治理分支，并将提交边界校准为 8 个 commit；Commit 1-5 已完成。
- [x] 下一阶段固定为 Task 2：固化可重复的本地发布证据包。
