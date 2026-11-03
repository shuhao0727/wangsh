# 本对话累计修改总表

> 状态：reference
> Owner：project-governance
> 核对日期：2026-11-02
> 范围：`/Users/wsh/wangsh`；`main`；参照提交 `3d05b081f77839523789ea41b1ca34198f488e9f`

这是一份按用户要求生成的变更清单，不是新实施计划或新的验收报告。根据当前 Git 差异、现存文件、脱敏配置比较和本对话执行记录汇总。中间尝试后恢复的内容不计为最终改动；删除、迁移、仅改文档和运行环境操作分别列出。

## 统计口径

生成本表前，当前工作区相对 HEAD 有 **109 个已跟踪文件修改、82 个旧路径删除、34 个未跟踪文件，共 225 个文件项**。`git status --short` 因目录折叠显示 210 条；其中 12 个删除已暂存，不是“暂存区为空”。本对话没有创建新提交、推送、标签或执行远端生产部署。

- 82 个删除中包含文档迁移：`docs/` 的 68 个旧路径退出里，20 个有迁移或合并去向，48 篇旧正文/历史索引实际删除。不能把全部 `D` 当成无替代的删除。
- Git 差异不能单独区分会话开始前已有改动与本对话新增改动。本表是累计最终状态清单，不把每行差异都归功于一次操作。
- `.env`、`.env.dev`、`.codex/AGENTS.md`、运行数据和 Docker 资源不计入上述 Git 文件数，但仍属于本对话改动范围。不会记录密钥值、口令或指纹。
- 文件行数以当前实际文件为准：`ai_agent.py` 453 行、`agent_testing.py` 245 行；测试状态 57 行、待办台账 60 行、UI 路线图 132 行。前面轮次中的行数只是当时快照。
- 本轮没有重新启动服务、操作数据库或重跑业务全套测试；Docker 守护进程当前不可连接，因此此前的 Docker 操作与业务测试只能作为历史执行记录。

## 一、规则与文档

| 序号 | 修改对象 | 修改前 | 修改后 | 影响与边界 | 相关联文件 |
|---|---|---|---|---|---|
| 1 | 项目规则入口 | 根 `AGENTS.md` 承载规则 | 内容整理到 `CLAUDE.md`，删除旧入口；同步规则链接、开发端口与数据目录约定 | 规则正文集中维护；新文件仍未提交 | [CLAUDE.md](../../CLAUDE.md)、[根 README](../../README.md)、[文档规则](../DOCUMENTATION_RULES.md) |
| 2 | Codex 规则指针 | 删除根 AGENTS 后缺少该工具的项目指引；曾写错 `../../CLAUDE.md` | 创建 `.codex/AGENTS.md`，最终指向 `../CLAUDE.md` | 仅本地忽略文件；不等于已验证 Codex 会自动发现这个位置 | `.codex/AGENTS.md`、[CLAUDE.md](../../CLAUDE.md) |
| 3 | 文档目录重组 | 大量文档挤在 `docs/docker/`，功能与运维分类交叉 | 运维迁到 `operations/`，界面迁到 `ui/`，计划与测试分别迁到 `plans/`、`testing/`；性能/工程治理/隐私分别迁到 development/security | 20 个退出路径有承接位置；其中有精简与重写，并非原样搬迁 | [文档总索引](../README.md)、[部署](../operations/DEPLOY.md)、[CI](../operations/CICD.md)、[UI 索引](../ui/README.md)；见附录迁移映射 |
| 4 | 旧历史正文 | 旧审计、日期计划、部署记录、测试历史和脚本退出索引散布多个目录 | 删除 48 篇旧文档：旧归档正文 37、日期计划 7、日期部署记录 2、测试历史 1、脚本历史索引 1 | HEAD 中已提交版本仍可查看；未提交增量和未跟踪证据不能声称均可恢复 | 旧 `docs/docker/archive/`、`docs/docker/plans/`、`docs/docker/testing/TEST_STATUS-history.md`、`docs/scripts/ARCHIVE_INDEX.md`；见附录完整清单 |
| 5 | 监控文档 | `MONITORING.md` 与 `MONITORING_QUICKSTART.md` 双份维护 | 合并为精简后的 `MONITORING.md`，删除 Quickstart | 集中指标、权限与排障说明；不是新增监控服务 | [MONITORING.md](../operations/MONITORING.md) |
| 6 | 文档归属与功能说明 | Owner/生命周期不完整，旧路径、重复说明及部分过强验收表述混杂 | 重写文档规则与索引，补部分文档状态/Owner，更新 API、认证、AI、PythonLab、XBK 等说明和引用 | 文档修订不自动等于功能修复或重新验收 | [DOCUMENTATION_RULES.md](../DOCUMENTATION_RULES.md)、[API.md](../development/API.md)、[AUTH.md](../features/AUTH.md)、[AI_AGENTS.md](../features/AI_AGENTS.md)、[PYTHONLAB.md](../features/PYTHONLAB.md)、[XBK.md](../features/XBK.md) |
| 7 | UI 参考与路线图 | 页面/浮层清单重复，断点行号陈旧，表中累计完成状态 | 精简 UI-PAGES 与治理说明，更新 8 个断点行号；路线图 47 行状态改成“—” | 仍保留 2 个“待用户确认”和 1 个“专用布局”；不是 UI 重新设计或验收。旧状态失效的理由需复核 | [UI-PAGES.md](../ui/UI-PAGES.md)、[断点指南](../ui/DIALOG-AND-BREAKPOINT-GUIDE.md)、[路线图](../ui/UI_REDESIGN_ROADMAP.md)、[UI 治理](../ui/ui-single-page-governance.md) |
| 8 | 当前测试状态与批次记录 | HEAD 旧测试状态 869 行；会话中又积累到 146 行的过程记录 | 当前摘要压到 57 行；整理过程合并为一份维护批次记录 | 保留当前摘要入口；新增批次记录不是已删除旧验收证据的完整替代 | [TEST_STATUS.md](../testing/TEST_STATUS.md)、[维护批次记录](../archive/testing/2026-11-02-maintenance-batches.md)、[归档索引](../archive/README.md) |
| 9 | 统一待办台账 | 混合旧工作树、审查批次、38 项状态与历史来源 | 改为 17 项未结表、关闭摘要和维护规则，当前 60 行 | 这是台账状态变更；工作树删除、记录消失不构成功能已关闭的证明 | [project-consolidation.md](../plans/project-consolidation.md)、[计划索引](../plans/README.md) |
| 10 | 发布记录 | 旧长篇发布历史与两条 lucid 未发布记录并存 | 迁移后保留近期正式版本主体，删除两条本地未发布描述；当前 238 行 | 未发生新的发布；旧记录退出不证明其中功能已合入当前工作区 | [RELEASE_NOTES.md](../operations/RELEASE_NOTES.md) |
| 11 | 项目状况报告 | 没有本次跨模块评估结果文件 | 新增四方向评估报告，后续标注本地环境隔离的处置 | 分析材料；其中的建议、历史结论不能直接视为生产实证或修复完成 | [项目状况报告](2026-11-02-project-status-report.md) |
| 12 | Markdown 检查器 | 识别旧 docs/docker 路径，Git 文件名按换行分割 | 改用 NUL 分隔，检查新目录生命周期、归档索引和派生统计；拒绝旧 docs/docker 目录回流 | 更新自动文档合同，回归用例扩展到 14 个；不验证正文业务真实性 | [检查器](../../scripts/check-markdown-contracts.mjs)、[回归测试](../../scripts/markdown-contracts.test.mjs) |
| 13 | 就近说明文档 | 脚本、前端测试、角色、颜色及子应用说明含旧入口和重复内容 | 更新引用与职责说明，精简部分规范/测试说明 | 主要是文档层修改，不等于配色、角色或核心流程全部重写 | [backend 脚本说明](../../backend/scripts/README.md)、[backend 测试说明](../../backend/tests/README.md)、[前端测试](../../frontend/docs/TESTING_SETUP.md)、[COLORS](../../frontend/src/styles/COLORS.md)、[ROLES](../../frontend/src/styles/ROLES.md)、[AI 伙伴说明](../../frontend/ai-partner/README.md) |

## 二、后端代码与依赖

| 序号 | 修改对象 | 修改前 | 修改后 | 影响与边界 | 相关联文件 |
|---|---|---|---|---|---|
| 14 | 智能体测试逻辑拆分 | `ai_agent.py` 630 行，超过原 ceiling 629 | 连接测试辅助逻辑迁到新增 `agent_testing.py`，多数旧名通过 import 回导；主文件现 453 行 | 职责拆分；新文件必须与调用方一起纳入后续提交 | [ai_agent.py](../../backend/app/services/agents/ai_agent.py)、[agent_testing.py](../../backend/app/services/agents/agent_testing.py) |
| 15 | 保存 endpoint 时的安全提示 | create/update 保存路径不调用安全检查 | 新增 `warn_if_endpoint_unsafe` 与更新辅助函数，保存时调用 guard，异常转为日志；新增 6 个测试 | **只告警、不拒绝保存，也未修出站重定向问题**；同步 DNS 在异步保存路径上的影响仍需注意 | [保存逻辑](../../backend/app/services/agents/ai_agent.py)、[新增测试](../../backend/tests/ai_agents/test_agent_endpoint_warning.py) |
| 16 | Provider 兼容工具 | `compat.py` 单独保存 3 个端点/厂商判断函数 | 合并到 `registry.py`，更新包导出，删除 compat.py | 减少一个模块；models_endpoint 分支也有精简，不能一概视为仅搬文件 | [registry.py](../../backend/app/services/agents/providers/registry.py)、[包导出](../../backend/app/services/agents/providers/__init__.py) |
| 17 | Excel 工作表命名 | 两个文件分别实现 `_unique_sheet_name` | 提取为 `exports/common.py` 的 `unique_sheet_name`，调用方复用 | 31 字符截断与重名后缀逻辑集中维护 | [common.py](../../backend/app/services/xbk/exports/common.py)、[选课导出](../../backend/app/services/xbk/exports/course_selection.py)、[工作簿路由](../../backend/app/api/endpoints/xbk/course_selection_workbook.py) |
| 18 | 配置重复分支 | DEBUG/生产各自执行同一套 Typst、DAP 路径推导 | 保留生产安全校验，路径推导合为一份 | 减少重复逻辑；不修改数据库模型 | [config/__init__.py](../../backend/app/core/config/__init__.py) |
| 19 | 空模块与旧桥接 | 空 `cross_system_service.py`；旧 `xbk/data.py` 只回导函数 | 删除两文件及空模块 import，并删除只测旧导入路径的用例 | 主业务路由仍由现有拆分模块提供；旧 Python 导入路径不再保留 | [讨论模块导出](../../backend/app/services/agents/group_discussion/__init__.py)、[XBK 结构测试](../../backend/tests/xbk/test_xbk_structure.py) |
| 20 | 未使用 schema | 5 个课堂响应类、2 个登录响应类、1 个工作簿错误类仍保留 | 删除这 8 个类及部分不再使用的 import | 减少未被当前路由消费的类型定义；未修改数据表 | [classroom.py](../../backend/app/schemas/classroom.py)、[auth.py](../../backend/app/schemas/core/auth.py)、[工作簿 schema](../../backend/app/schemas/xbk/course_selection_workbook.py) |
| 21 | 未使用函数/常量 | 占位浏览计数、未调用缓存清除、重复净化、旧迁移 helper、未用 multipart、QUALITY_EXCLUDED | 删除 `increment_view_count`、`clear_all_article_cache`、`sanitize_multiline`、`_has_alembic_version`、讨论 smoke 中 `_http_multipart`/uuid、`QUALITY_EXCLUDED` | 现有 XSS 模式常量保留；中途误删后已恢复，不计为最终删除 | [article.py](../../backend/app/services/articles/article.py)、[cache.py](../../backend/app/utils/cache.py)、[input_sanitizer.py](../../backend/app/utils/input_sanitizer.py)、[bootstrap](../../backend/scripts/bootstrap_db.py)、[讨论 smoke](../../backend/scripts/smoke_group_discussion.py)、[analysis_events](../../backend/app/services/agents/agent_analysis_events.py) |
| 22 | Python 直接依赖 | passlib[bcrypt]、argon2-cffi、email-validator、sse-starlette；bcrypt 由 extra 间接安装 | 移除 4 项，显式声明 bcrypt==5.0.0，删 passlib 日志名 | 历史曾用干净容器内 venv 验证安装与导入；未完成新发布镜像重建 | [requirements.txt](../../backend/requirements.txt)、[log_sanitizer.py](../../backend/app/core/log_sanitizer.py) |
| 23 | Python 治理基线 | 残留 4 个已降到阈值以下的文件条目、5 个消失函数条目，8 个 ceiling 高于当前值 | 删除 9 条失效项，下调 8 个文件 ceiling；保留两项既有临时例外 | 收紧维护基线；不等于所有复杂函数已消除 | [python-governance-baseline.json](../../backend/scripts/python-governance-baseline.json) |
| 24 | 后端构建上下文 | 本地 data/uploads/beat 状态未排除 | `.dockerignore` 新增 data/、uploads/、celerybeat-schedule 及其扩展文件 | 避免这些运行产物进入后端构建上下文 | [backend/.dockerignore](../../backend/.dockerignore) |
| 25 | 注释与历史脚本退出 | Dify、迁移守卫引用旧文档；部分 TODO 含糊；3 个归档脚本仍在 | 更新文档引用与注释；删除 516 行 AI seed、652 行 agents seed、117 行低内存 smoke | 注释调整不等于 GDPR/K8s 功能完成；seed 内容逐项承接和幂等初始化替代未由本次汇总证明。SQL 草案保留 | [dify_provider.py](../../backend/app/services/agents/providers/dify_provider.py)、[迁移守卫](../../backend/scripts/check_migration_guard.py)、[privacy.py](../../backend/app/api/endpoints/management/users/privacy.py)、[k8s.py](../../backend/app/core/sandbox/k8s.py)、[脚本说明](../../backend/scripts/README.md) |

## 三、前端代码、依赖与测试

| 序号 | 修改对象 | 修改前 | 修改后 | 影响与边界 | 相关联文件 |
|---|---|---|---|---|---|
| 26 | 未使用页面/组件 | 793 行 Admin/Categories 页面；177 行 AIAssistantModal 组件仅有注释调用 | 删除两文件，清除 RightPanelView 中注释 import、state 与 JSX | 删除当时未接入路由/渲染的源码；不是删除后台分类接口或全部 AI 助手能力 | [RightPanelView.tsx](../../frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx)、旧 `frontend/src/pages/Admin/Categories/index.tsx`、旧 `AIAssistantModal.tsx` |
| 27 | 导出/模拟数据 | 无消费者的 znt/index.ts barrel；Users/data 中 mockUsers 等 4 项 | 删除 barrel 和 mockUsers/defaultPagination/excelTemplateHeaders/formRules，保留在用选项 | 不删除 `@services/znt/api` 或真实用户接口 | [Users/data.ts](../../frontend/src/pages/Admin/Users/data.ts)、旧 `frontend/src/services/znt/index.ts` |
| 28 | 课程重复类型 | ai/agents 分别定义 Experiment/ToolItem/ResourceItem；三课程各有 TabKey/SectionKey | 新建 shared-types.ts；旧内容类型 re-export，三页面导入共享页签类型 | ML 独有 Experiment 字段继续保留独立定义 | [shared-types.ts](../../frontend/src/features/it-technology/courses/shared-types.ts)、[ai/types](../../frontend/src/features/it-technology/courses/ai/content/types.ts)、[agents/types](../../frontend/src/features/it-technology/courses/agents/content/types.ts)、三课程 `LearningPage.tsx` |
| 29 | 测评错误解析 | config/profile/session 各有错误结构和解析函数 | 新建 assessment/errors.ts，三服务共用 asApiError/toDetailMessage | 统一提示；profile 的对象错误现在走共享的 msg/message/JSON 分支，不能说完全零行为变化 | [errors.ts](../../frontend/src/services/assessment/errors.ts)、[config.ts](../../frontend/src/services/assessment/config.ts)、[profile.ts](../../frontend/src/services/assessment/profile.ts)、[session.ts](../../frontend/src/services/assessment/session.ts) |
| 30 | 前端类型依赖 | dompurify 自带类型，同时安装 @types/dompurify | 删除冗余类型包并同步 lock；echarts-wordcloud 曾尝试删后恢复 | 最终依赖净变化不包含删除 echarts-wordcloud | [package.json](../../frontend/package.json)、[package-lock.json](../../frontend/package-lock.json) |
| 31 | 过期别名与忽略配置 | @assets 指向不存在目录；ESLint 忽略 dist；Dockerignore 原已同时列 build/dist | 删 @assets 两处配置；ESLint 改忽略 build；Dockerignore 删 dist | **此前“build 原来会被打进 Docker”不成立**，原 dockerignore 已排除 build | [tsconfig.json](../../frontend/tsconfig.json)、[vite.config.ts](../../frontend/vite.config.ts)、[eslint.config.mjs](../../frontend/eslint.config.mjs)、[frontend/.dockerignore](../../frontend/.dockerignore) |
| 32 | 游戏上传客户端超时 | 上传使用 axios 默认 15 秒 | 该请求设置 10 分钟 timeout | 仅改客户端；网关 read_body/普通代理写超时仍为 30 秒，不能称慢速大包上传全链已解决 | [games.ts](../../frontend/src/services/it/games.ts)、[网关配置](../../gateway/Caddyfile) |
| 33 | Vite 分包测试 | 调用旧 manualChunks API，当前 Vite 配置不再提供 | 改测 codeSplitting.groups、分组命中/优先级/懒加载边界 | 更新老测试适配实际构建接口，未删除预算断言 | [bundle-budget-lib.test.mjs](../../frontend/scripts/bundle-budget-lib.test.mjs) |
| 34 | AI 伙伴请求测试 | 用例仍期待 timeout=65000，服务已经是 140000 | 断言更新为 140000 | 修复测试与实现不一致；服务本身的 140000 不是本轮新增 | [ai-partner-service.test.ts](../../frontend/ai-partner/src/ai-partner-service.test.ts) |
| 35 | 后端测试清理 | 旧 bridge 测试、2 个未调用辅助函数、永久 skip 且 pass 的集成占位 | 随桥接删除对应测试；删 `_legacy_seed_token`、`_make_settling_gather` 和空壳集成类 | 保留在用回归测试；删除占位不代表补齐真实 Celery E2E | [XBK 测试](../../backend/tests/xbk/test_xbk_structure.py)、[refresh 测试](../../backend/tests/auth/test_refresh_token_rotation.py)、[WS 测试](../../backend/tests/pythonlab/test_pythonlab_v2_ws_behavior.py)、[异步分析测试](../../backend/tests/ai_agents/test_async_analysis.py) |
| 36 | 测试配置与说明 | slow 未注册；README 引用不存在的用例和失实的 xfail 状态 | 注册 slow；删不存在文件引用并订正文案；Dify 测试说明改指当前台账 | 注册 marker 本身不会自动排除 slow；真实依赖用例仍有跳过范围 | [pytest.ini](../../backend/pytest.ini)、[backend/tests/README.md](../../backend/tests/README.md)、[Dify 测试](../../backend/tests/ai_agents/test_dify_bounded_history.py) |

## 四、CI、启动与运维脚本

| 序号 | 修改对象 | 修改前 | 修改后 | 影响与边界 | 相关联文件 |
|---|---|---|---|---|---|
| 37 | 远端 PythonLab 巡检 workflow | owner-concurrency、phasec 两份远端巡检与一份失败 issue 模板 | 删除这 3 个文件，保留 PR gate 和复用 runtime workflow | 对应远端巡检入口退出；不等于整个 PythonLab 测试删除 | 旧 `.github/workflows/pythonlab-owner-concurrency.yml`、旧 `pythonlab-phasec-gate.yml`、旧 issue 模板；[CICD.md](../operations/CICD.md) |
| 38 | PR 模板 | 以 UI 迁移命令为主，含不再适用检查 | 重写为范围/验证/未覆盖/风险清单；后端检查命令后来补 backend/ 前缀 | 当前标题仍写 backend 工作目录，与含前缀命令的目录语义需统一 | [pull_request_template.md](../../.github/pull_request_template.md) |
| 39 | CI 新接线 | 进程识别测试无自动执行，网关脚本不在语法清单 | 添加 start-dev-processes 的 10 个测试执行；网关测试脚本加入 bash -n | **网关在此 CI 步骤只检查 shell 语法，不执行 caddy adapt/完整合同** | [ci-quality.yml](../../.github/workflows/ci-quality.yml)、[start-dev-processes.test.mjs](../../scripts/start-dev-processes.test.mjs) |
| 40 | Gate 路径与 workflow 合同 | PR gate 仍过滤已删 debug 目录、已删远端 workflow；测试仍约束旧文件 | 清旧过滤路径和对应合同；同步 rollback mock 与注释路径断言 | 缩减过期触发范围；保护仍在用的 workflow 行为 | [owner gate](../../.github/workflows/pr-pythonlab-owner-gate.yml)、[phasec gate](../../.github/workflows/pr-pythonlab-phasec-gate.yml)、[workflow 测试](../../scripts/workflow-contracts.test.mjs) |
| 41 | start-dev.sh | 按端口广泛停止；CRA 进程名；系统 Python 安装依赖；PG 默认5432；固定打印 docs | 增加 Python/Vite 监听者筛选；Vite 核对 cwd/CLI；优先 venv；PG 默认5433；按 DEBUG 展示 docs；移除旧 worker 名；启动前调用 env 检查 | 减少部分误杀，**仍有宽泛 Python 识别及全局 pkill，不能宣称全部只操作本项目进程** | [start-dev.sh](../../start-dev.sh)、[进程测试](../../scripts/start-dev-processes.test.mjs) |
| 42 | stop-dev.sh | v2 按端口终止；CRA 名称与旧状态判断 | v3 对齐部分 Python/Vite 筛选，跳过不匹配占用，更新状态提示 | 启停仍是两个文件，共享函数尚未抽库；既有全局停止逻辑未全部收窄 | [stop-dev.sh](../../stop-dev.sh) |
| 43 | 部署、迁移与回滚脚本 | deploy 内部相对路径依赖 cwd；容器状态靠文本 Up | deploy 开头切 repo_root；migrate/rollback 改查 running service；补 cutover 完整路径 | 影响相对 ENV_FILE/COMPOSE_FILE 解释位置；此处没有执行真实生产回滚/部署 | [deploy.sh](../../scripts/deploy.sh)、[migrate-db.sh](../../scripts/migrate-db.sh)、[rollback.sh](../../scripts/rollback.sh)、[workflow 测试](../../scripts/workflow-contracts.test.mjs) |
| 44 | XBK 运维 helper | import_samples、smoke 各自实现 `_list_items`；多个脚本打印旧部署文档路径 | 提取 common.list_items，更新调用与文档提示 | 函数仍请求第一页、size=500，不是新增全量分页算法；audit/resolve 的权限确认未合并 | [common.py](../../scripts/xbk/common.py)、[import_samples.py](../../scripts/xbk/import_samples.py)、[smoke.py](../../scripts/xbk/smoke.py)、[audit](../../scripts/xbk/audit_active_duplicates.py)、[resolve](../../scripts/xbk/resolve_active_duplicates.py) |
| 45 | SSE 网关分流与合同 | 白名单没有学生课堂流、讨论公共配置流 | 添加两路径；测试提取部分前端订阅字符串并检查配置，保留 adapt 校验 | 已有静态/配置验证；不是完整后端路由覆盖，也未证明所有真实长连接时长 | [Caddyfile](../../gateway/Caddyfile)、[test_caddy_config.sh](../../gateway/tests/test_caddy_config.sh) |
| 46 | 上传网关预算 | 全站 max_size 16MB | 游戏精确路径配500MB，其余16MB；新增数值比较与文档说明 | **Caddy 500MB 是500,000,000字节，后端500MiB是524,288,000字节**；测试按1024换算MB仍有口径问题，且30秒限制未放宽 | [Caddyfile](../../gateway/Caddyfile)、[网关合同](../../gateway/tests/test_caddy_config.sh)、[gateway README](../../gateway/README.md)、[DEPLOY.md](../operations/DEPLOY.md) |

## 五、本地配置、数据与密钥

| 序号 | 修改对象 | 修改前 | 修改后 | 影响与边界 | 相关联文件 |
|---|---|---|---|---|---|
| 47 | 开发 env | 版本2.1.3、PG5432、REACT_APP_ENV=production | 应用/镜像/前端/沙箱版本统一2.2.4；PG5433；development | 本地配置已生效过；不进入 Git | `.env.dev`、[start-dev.sh](../../start-dev.sh) |
| 48 | 本地生产 env 与示例 | `.env` 仍2.1.3；示例未清楚区分容器端口/宿主端口 | 本地 `.env` 四项版本改2.2.4；`.env.example` 补5432/5433注释，生产容器内5432不变 | 只修改本机文件，未同步远端服务器、未变更服务器密钥 | `.env`、[.env.example](../../.env.example) |
| 49 | 临时覆盖文件 | 曾依赖 `.env.local` 把连接改到5433 | 创建过临时覆盖；开发默认修正后删除；规则改成可选个人覆盖 | 当前 `.env.local` 不存在 | `.env.local`、[CLAUDE.md](../../CLAUDE.md) |
| 50 | dev 数据挂载隔离 | dev/prod 同指 data/postgres、data/redis | dev 的8处宿主映射/HOST_WORKSPACE_ROOT改为data/dev；现存开发数据移动到data/dev；Typst本地启动默认同步 | 目录分开；本机原data/postgres现不存在，未来起本机prod会新建空库。不能等同“已验证两套生产开发实例并行隔离” | [docker-compose.dev.yml](../../docker-compose.dev.yml)、[docker-compose.yml](../../docker-compose.yml)、[start-dev.sh](../../start-dev.sh)、本机 `data/dev/` |
| 51 | JWT/Fernet 密钥 | 两份 env 的 SECRET_KEY、AGENT_API_KEY_ENCRYPTION_KEY 相同 | 仅开发文件生成独立随机值；历史执行前查询两类加密列为空，并做加解密自检 | 开发access token/签名预览可能失效；refresh不由该JWT密钥签名。未实现通用存量密文重新加密工具 | `.env.dev`、`znt_agents`/`inf_github_sync_settings`（历史只读检查）、[agent_secrets.py](../../backend/app/utils/agent_secrets.py) |
| 52 | 开发管理员密码 | dev/prod SUPER_ADMIN_PASSWORD 相同，库中既有bcrypt哈希 | 开发密码轮换，同步更新本地sys_users中admin哈希；历史登录200 | 是真实本地账号数据修改；**POSTGRES_PASSWORD仍与本地.env相同，未轮换** | `.env.dev`、开发库 `sys_users.hashed_password` |
| 53 | 环境一致性检查器 | 假定共库，两个密钥必须相同；原6个测试；无启动接线 | 按PG宿主路径共用/分开判定；缺compose保守，单侧缺键在共用模式报错；补Redis/admin提示、9个测试、启动调用 | 仍是有限文本解析；Redis共用仅提示；没有完整解析override、变量、长语法与软链接；不能称完整隔离证明 | [check-env-consistency.mjs](../../scripts/check-env-consistency.mjs)、[测试](../../scripts/env-consistency.test.mjs)、[start-dev.sh](../../start-dev.sh) |
| 54 | 忽略规则与目录占位 | data/整体忽略使.gitkeep例外失效，行尾注释无效；coverage.json未忽略 | 改data/*并放行.gitkeep，新增coverage.json；创建data/.gitkeep和6个archive占位 | 运行数据继续忽略，空目录可纳入后续提交；不等于运行数据已备份 | [.gitignore](../../.gitignore)、`data/.gitkeep`、`docs/archive/*/.gitkeep` |

## 六、工作树、缓存、Docker 与数据库操作

以下多数不在 Git diff 内，依据本对话真实执行记录；本轮未重做删除或数据库操作。

| 序号 | 修改对象 | 修改前 | 修改后 | 影响与边界 | 相关联文件/资源 |
|---|---|---|---|---|---|
| 55 | 工作树、分支与stash | lucid工作树、同名分支、3条共享stash存在 | 删除工作树/分支，按授权删除3条stash；本轮worktree仅主目录、stash列表为空 | 原工作树数据/未提交独有内容不能假定已完整合入；分支与stash删除是独立操作 | 旧 `.claude/worktrees/lucid-sanderson-a1b1bf`、旧 `claude/lucid-sanderson-a1b1bf`、Git stash |
| 56 | 旧证据与恢复材料 | .playwright-cli、旧.worktree/Playwright备份、部分.codex scratch与空证据树 | 按此前“不需备份”授权删除旧材料；删除frontend/.codex空树 | 这批旧材料与后续新建的迁库备份不是同一批；未跟踪内容不可用Git保证恢复 | 旧 `.playwright-cli/`、旧 `frontend/.codex/`、会话中列出的仓库外旧备份/scratch |
| 57 | 后端本地运行残留 | backend/data内13个旧PDF、celerybeat-schedule、空uploads/tests-utils与pytest缓存 | 清除上述目录/文件 | 不删除venv或实际tests目录；缓存可能随运行再生。当前根data/dev是后期数据 | 旧 `backend/data/`、`backend/celerybeat-schedule`、`backend/uploads/`、`backend/tests/utils/`、`backend/.pytest_cache/` |
| 58 | 孤儿容器与本机开发栈 | 3个已退出容器仍绑定已删工作树路径 | 删除旧容器，以主仓库dev compose重建postgres/redis/adminer；后续改挂data/dev | 早期旧库不是通过此步骤自动恢复；后期曾多次启停并运行验证 | `wangsh-postgres`、`wangsh-redis`、`wangsh-adminer`、[dev compose](../../docker-compose.dev.yml) |
| 59 | Docker资源清理 | 构建缓存、12个悬空卷、2个旧工作树网络 | 清理命令记录总计10.82GB缓存；删除12卷和2网络，保留发布/dev/基础镜像 | **卷包含PG/Redis数据，不全是缓存**；不能把所有卷都断言为无业务数据，也不能把命令报告大小当实际净腾出空间 | Docker builder cache、5个PG卷/2个node_modules卷/3个Redis卷/2个空卷、lucid/beautiful-satoshi旧网络 |
| 60 | 本地开发数据库与验证夹具 | 删除旧运行数据后，新的Docker库为空 | 运行现有50个revision至head、bootstrap、启动初始化admin；曾直接更新本地auth_authority.ready；多次smoke创建/清理合成数据 | Alembic源码没有新增或修改；这是本机数据操作，不是生产迁移，也不是正式cutover流程已执行的证明 | 开发库、既有 `backend/alembic/versions/`、[bootstrap_db.py](../../backend/scripts/bootstrap_db.py)、[smoke_feature_suite.py](../../backend/scripts/smoke_feature_suite.py) |
| 61 | 后期迁库备份与临时凭据 | 数据目录拆分前没有该次定向快照 | 停库后创建postgres数据tar，再移动目录；临时新管理员口令文件曾创建后删除 | 备份只记录为当时存在，位于会话外临时目录，本轮未核验可恢复；未做远端备份/恢复 | 历史路径 `/tmp/wangsh-backup-20261102/postgres-data.tar.gz`；临时 `/tmp/new_admin_pw` 已在执行记录中删除 |

## 必须保留的状态说明

1. **“已修改”不等于“问题全部修复”。** 保存endpoint告警不阻止SSRF；游戏500MB配置与后端500MiB不相等，且还受30秒代理限制；环境检查器不支持完整Compose语义。
2. **“文档写为关闭”不等于已验证关闭。** 特别是lucid历史功能、UI进度、删除seed后的内容承接，不能用删文档、通过其他测试来证明。
3. **不重复前述错误计数。** 43篇docs Markdown是目录内数量；107是汇总前全仓Markdown门禁数量。225是展开后的Git文件项，210是折叠后的status条目。本表自身及导航更新不包含在生成前快照中。
4. **没有新的功能全量验收。** 此前终端记录曾得到后端3608通过/242跳过、前端828通过、AI伙伴55通过、前端脚本34通过、CRUD smoke 38个OK。它们分别属于执行当时基线与环境，不证明所有后续修改、慢速500MiB上传、真实SSE、专用数据库、浏览器与生产路径。
5. **明确未做的内容。** 未提交/推送/打tag，未远端部署或轮换服务器密钥，未轮换本地POSTGRES_PASSWORD，未新增索引/重写Alembic，未把start/stop抽成共享库，未删除仍在用的大批回归测试，未最终移除echarts-wordcloud。
6. **本次汇总只新增清单与必要导航/派生统计。** 不继续修业务代码，不启动或重启Docker；当前Docker不可连接的状态不作故障根因判断。

## 附录：逐文件索引

### A. 文档迁移与合并映射

20 个旧路径有承接位置；不代表旧正文逐字保留。

| 编号 | 旧路径 | 当前承接位置 |
|---|---|---|
| A01 | `docs/DATABASE_PERFORMANCE_GUIDE.md` | [docs/development/DATABASE_PERFORMANCE_GUIDE.md](../development/DATABASE_PERFORMANCE_GUIDE.md) |
| A02 | `docs/ENGINEERING_GOVERNANCE.md` | [docs/development/ENGINEERING_GOVERNANCE.md](../development/ENGINEERING_GOVERNANCE.md) |
| A03 | `docs/compliance/GDPR.md` | [docs/security/GDPR.md](../security/GDPR.md) |
| A04 | `docs/docker/README.md` | [docs/README.md](../README.md)、[docs/operations/README.md](../operations/README.md) |
| A05 | `docs/docker/RELEASE_NOTES.md` | [docs/operations/RELEASE_NOTES.md](../operations/RELEASE_NOTES.md) |
| A06 | `docs/docker/archive/README.md` | [docs/archive/README.md](../archive/README.md) |
| A07 | `docs/docker/deploy/CICD.md` | [docs/operations/CICD.md](../operations/CICD.md) |
| A08 | `docs/docker/deploy/DEPLOY.md` | [docs/operations/DEPLOY.md](../operations/DEPLOY.md) |
| A09 | `docs/docker/frontend/ACCESSIBILITY_GUIDE.md` | [docs/ui/ACCESSIBILITY_GUIDE.md](../ui/ACCESSIBILITY_GUIDE.md) |
| A10 | `docs/docker/frontend/DIALOG-AND-BREAKPOINT-GUIDE.md` | [docs/ui/DIALOG-AND-BREAKPOINT-GUIDE.md](../ui/DIALOG-AND-BREAKPOINT-GUIDE.md) |
| A11 | `docs/docker/frontend/EMBEDDED_UI_STYLE_GUIDE.md` | [docs/ui/EMBEDDED_UI_STYLE_GUIDE.md](../ui/EMBEDDED_UI_STYLE_GUIDE.md) |
| A12 | `docs/docker/frontend/README.md` | [docs/ui/README.md](../ui/README.md) |
| A13 | `docs/docker/frontend/UI-PAGES.md` | [docs/ui/UI-PAGES.md](../ui/UI-PAGES.md) |
| A14 | `docs/docker/frontend/UI_REDESIGN_ROADMAP.md` | [docs/ui/UI_REDESIGN_ROADMAP.md](../ui/UI_REDESIGN_ROADMAP.md) |
| A15 | `docs/docker/plans/README.md` | [docs/plans/README.md](../plans/README.md) |
| A16 | `docs/docker/plans/project-consolidation.md` | [docs/plans/project-consolidation.md](../plans/project-consolidation.md) |
| A17 | `docs/docker/plans/ui-single-page-governance.md` | [docs/ui/ui-single-page-governance.md](../ui/ui-single-page-governance.md) |
| A18 | `docs/docker/testing/README.md` | [docs/testing/README.md](../testing/README.md) |
| A19 | `docs/docker/testing/TEST_STATUS.md` | [docs/testing/TEST_STATUS.md](../testing/TEST_STATUS.md) |
| A20 | `docs/operations/MONITORING_QUICKSTART.md` | [docs/operations/MONITORING.md](../operations/MONITORING.md) |

### B. 实际删除的旧文档

以下 48 篇没有作为整篇迁入新目录。路径仅作历史标识，不建立失效链接。

| 编号 | 删除路径 |
|---|---|
| B01 | `docs/docker/archive/2026-07-11-project-governance-30-60-90-execution-plan.md` |
| B02 | `docs/docker/archive/2026-07-14-project-file-consolidation-plan.md` |
| B03 | `docs/docker/archive/2026-08-06-multi-agent-diagnosis-report.md` |
| B04 | `docs/docker/archive/2026-08-10-ui-branch-layout-review.md` |
| B05 | `docs/docker/archive/2026-08-10-ui-branch-visual-review.md` |
| B06 | `docs/docker/archive/2026-09-08-project-audit-findings.md` |
| B07 | `docs/docker/archive/2026-09-08-project-comprehensive-audit-plan.md` |
| B08 | `docs/docker/archive/2026-09-09-release-readiness-gap.md` |
| B09 | `docs/docker/archive/2026-09-11-proxy-chain-acceptance.md` |
| B10 | `docs/docker/archive/2026-09-11-v2-multiagent-acceptance.md` |
| B11 | `docs/docker/archive/2026-09-13-docker-clean-build-verify-release-plan.md` |
| B12 | `docs/docker/archive/2026-10-01-agent-data-analysis.md` |
| B13 | `docs/docker/archive/2026-10-01-ai-agents-analysis.md` |
| B14 | `docs/docker/archive/2026-10-01-async-analysis-guide.md` |
| B15 | `docs/docker/archive/2026-10-01-async-analysis-verification.md` |
| B16 | `docs/docker/archive/2026-10-01-gdpr-implementation-summary.md` |
| B17 | `docs/docker/archive/2026-10-01-p0-p1-optimization-verification.md` |
| B18 | `docs/docker/archive/2026-10-03-ui-improvement-plan.md` |
| B19 | `docs/docker/archive/2026-10-03-view-migration-and-pythonlab-type.md` |
| B20 | `docs/docker/archive/2026-10-09-comprehensive-audit-final-report.md` |
| B21 | `docs/docker/archive/2026-10-09-comprehensive-remediation-plan.md` |
| B22 | `docs/docker/archive/2026-10-09-comprehensive-review.md` |
| B23 | `docs/docker/archive/2026-10-09-six-round-audit-issue-list.md` |
| B24 | `docs/docker/archive/2026-10-09-verification-report.md` |
| B25 | `docs/docker/archive/2026-10-10-file-organization-findings.md` |
| B26 | `docs/docker/archive/2026-10-15-project-audit.md` |
| B27 | `docs/docker/archive/2026-10-26-code-audit-report.md` |
| B28 | `docs/docker/archive/2026-10-26-verification-summary.md` |
| B29 | `docs/docker/archive/CODE_REVIEW_FIXES_2026-07-19.md` |
| B30 | `docs/docker/archive/RELEASE_NOTES_v1.5.x.md` |
| B31 | `docs/docker/archive/plans/2026-05-03-learning-platform-improvement-design.md` |
| B32 | `docs/docker/archive/plans/2026-07-project-consolidation-history.md` |
| B33 | `docs/docker/archive/plans/2026-10-27-S1-S7-VERIFICATION-PLAN-V3.md` |
| B34 | `docs/docker/archive/plans/2026-10-27-S1-S7-VERIFICATION-REVIEW-PLAN.md` |
| B35 | `docs/docker/archive/plans/sse-redis-pubsub-migration.md` |
| B36 | `docs/docker/archive/ui-improvement-plan-2026-10-03-superseded.md` |
| B37 | `docs/docker/archive/全项目算法复杂度审查报告_20261025.md` |
| B38 | `docs/docker/deploy/2026-10-26-DEPLOY-CHECKLIST.md` |
| B39 | `docs/docker/deploy/2026-10-27-KNOWN-ISSUES.md` |
| B40 | `docs/docker/plans/2026-10-28-DIFY-DEFECT-FIX-PLAN.md` |
| B41 | `docs/docker/plans/2026-10-28-RELEASE-2.2.1-PLAN.md` |
| B42 | `docs/docker/plans/2026-10-28-REVIEW-AFTER-FIX.md` |
| B43 | `docs/docker/plans/2026-10-28-S2-S7-EXECUTION-PLAN-V4.md` |
| B44 | `docs/docker/plans/2026-10-28-S4-S7-ITEM-MANIFEST.md` |
| B45 | `docs/docker/plans/2026-10-29-POST-222-CLOSEOUT-PLAN.md` |
| B46 | `docs/docker/plans/2026-10-29-TAG-FIX-AND-CLEANUP-PLAN.md` |
| B47 | `docs/docker/testing/TEST_STATUS-history.md` |
| B48 | `docs/scripts/ARCHIVE_INDEX.md` |

### C. 全部 225 个 Git 文件项

`M`：修改；`D`：旧路径删除；`U`：未跟踪新增。`D` 中的迁移见 A 表。此处不包含本总表自身，也不包含被忽略的本机配置与数据。

| 编号 | 状态 | 文件 |
|---|---|---|
| C001 | M | [.env.example](../../.env.example) |
| C002 | D | `.github/ISSUE_TEMPLATE/pythonlab-owner-concurrency-failure.yml` |
| C003 | M | [.github/pull_request_template.md](../../.github/pull_request_template.md) |
| C004 | M | [.github/workflows/ci-quality.yml](../../.github/workflows/ci-quality.yml) |
| C005 | M | [.github/workflows/pr-pythonlab-owner-gate.yml](../../.github/workflows/pr-pythonlab-owner-gate.yml) |
| C006 | M | [.github/workflows/pr-pythonlab-phasec-gate.yml](../../.github/workflows/pr-pythonlab-phasec-gate.yml) |
| C007 | D | `.github/workflows/pythonlab-owner-concurrency.yml` |
| C008 | D | `.github/workflows/pythonlab-phasec-gate.yml` |
| C009 | M | [.gitignore](../../.gitignore) |
| C010 | D | `AGENTS.md` |
| C011 | U | [CLAUDE.md](../../CLAUDE.md) |
| C012 | M | [README.md](../../README.md) |
| C013 | M | [backend/.dockerignore](../../backend/.dockerignore) |
| C014 | D | `backend/app/api/endpoints/agents/ai_agents/CACHE_IMPLEMENTATION.md` |
| C015 | M | [backend/app/api/endpoints/management/users/import_service.py](../../backend/app/api/endpoints/management/users/import_service.py) |
| C016 | M | [backend/app/api/endpoints/management/users/privacy.py](../../backend/app/api/endpoints/management/users/privacy.py) |
| C017 | M | [backend/app/api/endpoints/xbk/course_selection_workbook.py](../../backend/app/api/endpoints/xbk/course_selection_workbook.py) |
| C018 | D | `backend/app/api/endpoints/xbk/data.py` |
| C019 | M | [backend/app/core/config/__init__.py](../../backend/app/core/config/__init__.py) |
| C020 | M | [backend/app/core/log_sanitizer.py](../../backend/app/core/log_sanitizer.py) |
| C021 | M | [backend/app/core/sandbox/k8s.py](../../backend/app/core/sandbox/k8s.py) |
| C022 | M | [backend/app/schemas/classroom.py](../../backend/app/schemas/classroom.py) |
| C023 | M | [backend/app/schemas/core/auth.py](../../backend/app/schemas/core/auth.py) |
| C024 | M | [backend/app/schemas/xbk/course_selection_workbook.py](../../backend/app/schemas/xbk/course_selection_workbook.py) |
| C025 | M | [backend/app/services/agents/agent_analysis_events.py](../../backend/app/services/agents/agent_analysis_events.py) |
| C026 | U | [backend/app/services/agents/agent_testing.py](../../backend/app/services/agents/agent_testing.py) |
| C027 | M | [backend/app/services/agents/ai_agent.py](../../backend/app/services/agents/ai_agent.py) |
| C028 | M | [backend/app/services/agents/group_discussion/__init__.py](../../backend/app/services/agents/group_discussion/__init__.py) |
| C029 | D | `backend/app/services/agents/group_discussion/cross_system_service.py` |
| C030 | M | [backend/app/services/agents/providers/__init__.py](../../backend/app/services/agents/providers/__init__.py) |
| C031 | D | `backend/app/services/agents/providers/compat.py` |
| C032 | M | [backend/app/services/agents/providers/dify_provider.py](../../backend/app/services/agents/providers/dify_provider.py) |
| C033 | M | [backend/app/services/agents/providers/registry.py](../../backend/app/services/agents/providers/registry.py) |
| C034 | M | [backend/app/services/articles/article.py](../../backend/app/services/articles/article.py) |
| C035 | M | [backend/app/services/xbk/exports/common.py](../../backend/app/services/xbk/exports/common.py) |
| C036 | M | [backend/app/services/xbk/exports/course_selection.py](../../backend/app/services/xbk/exports/course_selection.py) |
| C037 | M | [backend/app/utils/cache.py](../../backend/app/utils/cache.py) |
| C038 | M | [backend/app/utils/input_sanitizer.py](../../backend/app/utils/input_sanitizer.py) |
| C039 | M | [backend/pytest.ini](../../backend/pytest.ini) |
| C040 | M | [backend/requirements.txt](../../backend/requirements.txt) |
| C041 | M | [backend/scripts/README.md](../../backend/scripts/README.md) |
| C042 | D | `backend/scripts/archive/seed_agents_content.py` |
| C043 | D | `backend/scripts/archive/seed_ai_content.py` |
| C044 | D | `backend/scripts/archive/smoke_pythonlab_low_memory_start_failure.py` |
| C045 | M | [backend/scripts/bootstrap_db.py](../../backend/scripts/bootstrap_db.py) |
| C046 | M | [backend/scripts/check_migration_guard.py](../../backend/scripts/check_migration_guard.py) |
| C047 | M | [backend/scripts/python-governance-baseline.json](../../backend/scripts/python-governance-baseline.json) |
| C048 | M | [backend/scripts/smoke_group_discussion.py](../../backend/scripts/smoke_group_discussion.py) |
| C049 | M | [backend/tests/README.md](../../backend/tests/README.md) |
| C050 | U | [backend/tests/ai_agents/test_agent_endpoint_warning.py](../../backend/tests/ai_agents/test_agent_endpoint_warning.py) |
| C051 | M | [backend/tests/ai_agents/test_async_analysis.py](../../backend/tests/ai_agents/test_async_analysis.py) |
| C052 | M | [backend/tests/ai_agents/test_dify_bounded_history.py](../../backend/tests/ai_agents/test_dify_bounded_history.py) |
| C053 | M | [backend/tests/auth/test_refresh_token_rotation.py](../../backend/tests/auth/test_refresh_token_rotation.py) |
| C054 | M | [backend/tests/pythonlab/test_pythonlab_v2_ws_behavior.py](../../backend/tests/pythonlab/test_pythonlab_v2_ws_behavior.py) |
| C055 | M | [backend/tests/xbk/test_xbk_structure.py](../../backend/tests/xbk/test_xbk_structure.py) |
| C056 | U | [data/.gitkeep](../../data/.gitkeep) |
| C057 | M | [docker-compose.dev.yml](../../docker-compose.dev.yml) |
| C058 | M | [docker-compose.yml](../../docker-compose.yml) |
| C059 | D | `docs/DATABASE_PERFORMANCE_GUIDE.md` |
| C060 | M | [docs/DOCUMENTATION_RULES.md](../DOCUMENTATION_RULES.md) |
| C061 | D | `docs/ENGINEERING_GOVERNANCE.md` |
| C062 | M | [docs/README.md](../README.md) |
| C063 | U | [docs/archive/README.md](../archive/README.md) |
| C064 | U | [docs/archive/operations/.gitkeep](../archive/operations/.gitkeep) |
| C065 | U | [docs/archive/plans/.gitkeep](../archive/plans/.gitkeep) |
| C066 | U | [docs/archive/releases/.gitkeep](../archive/releases/.gitkeep) |
| C067 | U | [docs/archive/reviews/.gitkeep](../archive/reviews/.gitkeep) |
| C068 | U | [docs/archive/scripts/.gitkeep](../archive/scripts/.gitkeep) |
| C069 | U | [docs/archive/testing/.gitkeep](../archive/testing/.gitkeep) |
| C070 | U | [docs/archive/testing/2026-11-02-maintenance-batches.md](../archive/testing/2026-11-02-maintenance-batches.md) |
| C071 | D | `docs/compliance/GDPR.md` |
| C072 | M | [docs/development/API.md](../development/API.md) |
| C073 | U | [docs/development/DATABASE_PERFORMANCE_GUIDE.md](../development/DATABASE_PERFORMANCE_GUIDE.md) |
| C074 | U | [docs/development/ENGINEERING_GOVERNANCE.md](../development/ENGINEERING_GOVERNANCE.md) |
| C075 | D | `docs/docker/README.md` |
| C076 | D | `docs/docker/RELEASE_NOTES.md` |
| C077 | D | `docs/docker/archive/2026-07-11-project-governance-30-60-90-execution-plan.md` |
| C078 | D | `docs/docker/archive/2026-07-14-project-file-consolidation-plan.md` |
| C079 | D | `docs/docker/archive/2026-08-06-multi-agent-diagnosis-report.md` |
| C080 | D | `docs/docker/archive/2026-08-10-ui-branch-layout-review.md` |
| C081 | D | `docs/docker/archive/2026-08-10-ui-branch-visual-review.md` |
| C082 | D | `docs/docker/archive/2026-09-08-project-audit-findings.md` |
| C083 | D | `docs/docker/archive/2026-09-08-project-comprehensive-audit-plan.md` |
| C084 | D | `docs/docker/archive/2026-09-09-release-readiness-gap.md` |
| C085 | D | `docs/docker/archive/2026-09-11-proxy-chain-acceptance.md` |
| C086 | D | `docs/docker/archive/2026-09-11-v2-multiagent-acceptance.md` |
| C087 | D | `docs/docker/archive/2026-09-13-docker-clean-build-verify-release-plan.md` |
| C088 | D | `docs/docker/archive/2026-10-01-agent-data-analysis.md` |
| C089 | D | `docs/docker/archive/2026-10-01-ai-agents-analysis.md` |
| C090 | D | `docs/docker/archive/2026-10-01-async-analysis-guide.md` |
| C091 | D | `docs/docker/archive/2026-10-01-async-analysis-verification.md` |
| C092 | D | `docs/docker/archive/2026-10-01-gdpr-implementation-summary.md` |
| C093 | D | `docs/docker/archive/2026-10-01-p0-p1-optimization-verification.md` |
| C094 | D | `docs/docker/archive/2026-10-03-ui-improvement-plan.md` |
| C095 | D | `docs/docker/archive/2026-10-03-view-migration-and-pythonlab-type.md` |
| C096 | D | `docs/docker/archive/2026-10-09-comprehensive-audit-final-report.md` |
| C097 | D | `docs/docker/archive/2026-10-09-comprehensive-remediation-plan.md` |
| C098 | D | `docs/docker/archive/2026-10-09-comprehensive-review.md` |
| C099 | D | `docs/docker/archive/2026-10-09-six-round-audit-issue-list.md` |
| C100 | D | `docs/docker/archive/2026-10-09-verification-report.md` |
| C101 | D | `docs/docker/archive/2026-10-10-file-organization-findings.md` |
| C102 | D | `docs/docker/archive/2026-10-15-project-audit.md` |
| C103 | D | `docs/docker/archive/2026-10-26-code-audit-report.md` |
| C104 | D | `docs/docker/archive/2026-10-26-verification-summary.md` |
| C105 | D | `docs/docker/archive/CODE_REVIEW_FIXES_2026-07-19.md` |
| C106 | D | `docs/docker/archive/README.md` |
| C107 | D | `docs/docker/archive/RELEASE_NOTES_v1.5.x.md` |
| C108 | D | `docs/docker/archive/plans/2026-05-03-learning-platform-improvement-design.md` |
| C109 | D | `docs/docker/archive/plans/2026-07-project-consolidation-history.md` |
| C110 | D | `docs/docker/archive/plans/2026-10-27-S1-S7-VERIFICATION-PLAN-V3.md` |
| C111 | D | `docs/docker/archive/plans/2026-10-27-S1-S7-VERIFICATION-REVIEW-PLAN.md` |
| C112 | D | `docs/docker/archive/plans/sse-redis-pubsub-migration.md` |
| C113 | D | `docs/docker/archive/ui-improvement-plan-2026-10-03-superseded.md` |
| C114 | D | `docs/docker/archive/全项目算法复杂度审查报告_20261025.md` |
| C115 | D | `docs/docker/deploy/2026-10-26-DEPLOY-CHECKLIST.md` |
| C116 | D | `docs/docker/deploy/2026-10-27-KNOWN-ISSUES.md` |
| C117 | D | `docs/docker/deploy/CICD.md` |
| C118 | D | `docs/docker/deploy/DEPLOY.md` |
| C119 | D | `docs/docker/frontend/ACCESSIBILITY_GUIDE.md` |
| C120 | D | `docs/docker/frontend/DIALOG-AND-BREAKPOINT-GUIDE.md` |
| C121 | D | `docs/docker/frontend/EMBEDDED_UI_STYLE_GUIDE.md` |
| C122 | D | `docs/docker/frontend/README.md` |
| C123 | D | `docs/docker/frontend/UI-PAGES.md` |
| C124 | D | `docs/docker/frontend/UI_REDESIGN_ROADMAP.md` |
| C125 | D | `docs/docker/plans/2026-10-28-DIFY-DEFECT-FIX-PLAN.md` |
| C126 | D | `docs/docker/plans/2026-10-28-RELEASE-2.2.1-PLAN.md` |
| C127 | D | `docs/docker/plans/2026-10-28-REVIEW-AFTER-FIX.md` |
| C128 | D | `docs/docker/plans/2026-10-28-S2-S7-EXECUTION-PLAN-V4.md` |
| C129 | D | `docs/docker/plans/2026-10-28-S4-S7-ITEM-MANIFEST.md` |
| C130 | D | `docs/docker/plans/2026-10-29-POST-222-CLOSEOUT-PLAN.md` |
| C131 | D | `docs/docker/plans/2026-10-29-TAG-FIX-AND-CLEANUP-PLAN.md` |
| C132 | D | `docs/docker/plans/README.md` |
| C133 | D | `docs/docker/plans/project-consolidation.md` |
| C134 | D | `docs/docker/plans/ui-single-page-governance.md` |
| C135 | D | `docs/docker/testing/README.md` |
| C136 | D | `docs/docker/testing/TEST_STATUS-history.md` |
| C137 | D | `docs/docker/testing/TEST_STATUS.md` |
| C138 | M | [docs/features/AI_AGENTS.md](../features/AI_AGENTS.md) |
| C139 | M | [docs/features/ARTICLES.md](../features/ARTICLES.md) |
| C140 | M | [docs/features/ASSESSMENT.md](../features/ASSESSMENT.md) |
| C141 | M | [docs/features/AUTH.md](../features/AUTH.md) |
| C142 | M | [docs/features/AUTO_REFRESH.md](../features/AUTO_REFRESH.md) |
| C143 | M | [docs/features/CLASSROOM.md](../features/CLASSROOM.md) |
| C144 | M | [docs/features/DATA_ARCHIVING.md](../features/DATA_ARCHIVING.md) |
| C145 | M | [docs/features/DIANMING.md](../features/DIANMING.md) |
| C146 | M | [docs/features/INFORMATICS.md](../features/INFORMATICS.md) |
| C147 | M | [docs/features/IT_GAMES.md](../features/IT_GAMES.md) |
| C148 | M | [docs/features/KNN_SURVEY.md](../features/KNN_SURVEY.md) |
| C149 | M | [docs/features/LEARNING.md](../features/LEARNING.md) |
| C150 | M | [docs/features/ML_BOOK.md](../features/ML_BOOK.md) |
| C151 | M | [docs/features/PYTHONLAB.md](../features/PYTHONLAB.md) |
| C152 | M | [docs/features/XBK.md](../features/XBK.md) |
| C153 | M | [docs/features/assessment/chain_agent.md](../features/assessment/chain_agent.md) |
| C154 | M | [docs/features/assessment/hot_agent.md](../features/assessment/hot_agent.md) |
| C155 | U | [docs/operations/CICD.md](../operations/CICD.md) |
| C156 | U | [docs/operations/DEPLOY.md](../operations/DEPLOY.md) |
| C157 | M | [docs/operations/MONITORING.md](../operations/MONITORING.md) |
| C158 | D | `docs/operations/MONITORING_QUICKSTART.md` |
| C159 | U | [docs/operations/README.md](../operations/README.md) |
| C160 | U | [docs/operations/RELEASE_NOTES.md](../operations/RELEASE_NOTES.md) |
| C161 | U | [docs/plans/README.md](../plans/README.md) |
| C162 | U | [docs/plans/project-consolidation.md](../plans/project-consolidation.md) |
| C163 | U | [docs/reviews/2026-11-02-project-status-report.md](2026-11-02-project-status-report.md) |
| C164 | D | `docs/scripts/ARCHIVE_INDEX.md` |
| C165 | U | [docs/security/GDPR.md](../security/GDPR.md) |
| C166 | M | [docs/security/XSS_PROTECTION.md](../security/XSS_PROTECTION.md) |
| C167 | U | [docs/testing/README.md](../testing/README.md) |
| C168 | U | [docs/testing/TEST_STATUS.md](../testing/TEST_STATUS.md) |
| C169 | U | [docs/ui/ACCESSIBILITY_GUIDE.md](../ui/ACCESSIBILITY_GUIDE.md) |
| C170 | U | [docs/ui/DIALOG-AND-BREAKPOINT-GUIDE.md](../ui/DIALOG-AND-BREAKPOINT-GUIDE.md) |
| C171 | U | [docs/ui/EMBEDDED_UI_STYLE_GUIDE.md](../ui/EMBEDDED_UI_STYLE_GUIDE.md) |
| C172 | U | [docs/ui/README.md](../ui/README.md) |
| C173 | U | [docs/ui/UI-PAGES.md](../ui/UI-PAGES.md) |
| C174 | U | [docs/ui/UI_REDESIGN_ROADMAP.md](../ui/UI_REDESIGN_ROADMAP.md) |
| C175 | U | [docs/ui/ui-single-page-governance.md](../ui/ui-single-page-governance.md) |
| C176 | M | [frontend/.dockerignore](../../frontend/.dockerignore) |
| C177 | M | [frontend/ai-partner/README.md](../../frontend/ai-partner/README.md) |
| C178 | M | [frontend/ai-partner/src/ai-partner-service.test.ts](../../frontend/ai-partner/src/ai-partner-service.test.ts) |
| C179 | M | [frontend/docs/TESTING_SETUP.md](../../frontend/docs/TESTING_SETUP.md) |
| C180 | M | [frontend/eslint.config.mjs](../../frontend/eslint.config.mjs) |
| C181 | M | [frontend/package-lock.json](../../frontend/package-lock.json) |
| C182 | M | [frontend/package.json](../../frontend/package.json) |
| C183 | M | [frontend/scripts/README.md](../../frontend/scripts/README.md) |
| C184 | M | [frontend/scripts/bundle-budget-lib.test.mjs](../../frontend/scripts/bundle-budget-lib.test.mjs) |
| C185 | M | [frontend/src/features/it-technology/courses/agents/LearningPage.tsx](../../frontend/src/features/it-technology/courses/agents/LearningPage.tsx) |
| C186 | M | [frontend/src/features/it-technology/courses/agents/content/types.ts](../../frontend/src/features/it-technology/courses/agents/content/types.ts) |
| C187 | M | [frontend/src/features/it-technology/courses/ai/LearningPage.tsx](../../frontend/src/features/it-technology/courses/ai/LearningPage.tsx) |
| C188 | M | [frontend/src/features/it-technology/courses/ai/content/types.ts](../../frontend/src/features/it-technology/courses/ai/content/types.ts) |
| C189 | M | [frontend/src/features/it-technology/courses/ml/LearningPage.tsx](../../frontend/src/features/it-technology/courses/ml/LearningPage.tsx) |
| C190 | U | [frontend/src/features/it-technology/courses/shared-types.ts](../../frontend/src/features/it-technology/courses/shared-types.ts) |
| C191 | D | `frontend/src/pages/Admin/Categories/index.tsx` |
| C192 | D | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/AIAssistantModal.tsx` |
| C193 | M | [frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx](../../frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx) |
| C194 | M | [frontend/src/pages/Admin/Users/data.ts](../../frontend/src/pages/Admin/Users/data.ts) |
| C195 | M | [frontend/src/services/assessment/config.ts](../../frontend/src/services/assessment/config.ts) |
| C196 | U | [frontend/src/services/assessment/errors.ts](../../frontend/src/services/assessment/errors.ts) |
| C197 | M | [frontend/src/services/assessment/profile.ts](../../frontend/src/services/assessment/profile.ts) |
| C198 | M | [frontend/src/services/assessment/session.ts](../../frontend/src/services/assessment/session.ts) |
| C199 | M | [frontend/src/services/it/games.ts](../../frontend/src/services/it/games.ts) |
| C200 | D | `frontend/src/services/znt/index.ts` |
| C201 | M | [frontend/src/styles/COLORS.md](../../frontend/src/styles/COLORS.md) |
| C202 | M | [frontend/src/styles/ROLES.md](../../frontend/src/styles/ROLES.md) |
| C203 | M | [frontend/tsconfig.json](../../frontend/tsconfig.json) |
| C204 | M | [frontend/vite.config.ts](../../frontend/vite.config.ts) |
| C205 | M | [gateway/Caddyfile](../../gateway/Caddyfile) |
| C206 | M | [gateway/README.md](../../gateway/README.md) |
| C207 | M | [gateway/tests/test_caddy_config.sh](../../gateway/tests/test_caddy_config.sh) |
| C208 | M | [scripts/README.md](../../scripts/README.md) |
| C209 | M | [scripts/check-env-consistency.mjs](../../scripts/check-env-consistency.mjs) |
| C210 | M | [scripts/check-markdown-contracts.mjs](../../scripts/check-markdown-contracts.mjs) |
| C211 | M | [scripts/deploy.sh](../../scripts/deploy.sh) |
| C212 | M | [scripts/env-consistency.test.mjs](../../scripts/env-consistency.test.mjs) |
| C213 | M | [scripts/markdown-contracts.test.mjs](../../scripts/markdown-contracts.test.mjs) |
| C214 | M | [scripts/migrate-db.sh](../../scripts/migrate-db.sh) |
| C215 | M | [scripts/rollback.sh](../../scripts/rollback.sh) |
| C216 | U | [scripts/start-dev-processes.test.mjs](../../scripts/start-dev-processes.test.mjs) |
| C217 | M | [scripts/workflow-contracts.test.mjs](../../scripts/workflow-contracts.test.mjs) |
| C218 | M | [scripts/xbk/_active_duplicate_common.py](../../scripts/xbk/_active_duplicate_common.py) |
| C219 | M | [scripts/xbk/audit_active_duplicates.py](../../scripts/xbk/audit_active_duplicates.py) |
| C220 | M | [scripts/xbk/common.py](../../scripts/xbk/common.py) |
| C221 | M | [scripts/xbk/import_samples.py](../../scripts/xbk/import_samples.py) |
| C222 | M | [scripts/xbk/resolve_active_duplicates.py](../../scripts/xbk/resolve_active_duplicates.py) |
| C223 | M | [scripts/xbk/smoke.py](../../scripts/xbk/smoke.py) |
| C224 | M | [start-dev.sh](../../start-dev.sh) |
| C225 | M | [stop-dev.sh](../../stop-dev.sh) |
