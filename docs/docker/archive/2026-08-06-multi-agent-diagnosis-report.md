# WangSh 全方位诊断报告（综合版：工程健康 + UI 视觉品质）

> 状态：archived
> Owner：docs
> 最近复核：2026-09-08
> 归档说明：从 Git 历史恢复的 2026-08 综合诊断快照；当前事实以代码、owner 文档和当前测试状态为准。

> 版本：v2（合并工程诊断 + 视觉品质诊断）
> 日期：2026-08-06
> 分支：`feature/ui-optimization-design`（67 个未提交前端改动）
> 方式：14 个并行审查 agent（8 工程 + 6 视觉）· 静态审查 + 运行门禁命令 + 运行时 DOM/样式
> 历史定位：原报告曾作为存活追踪文档；现已归档，不再作为当前决策或执行依据。
> 说明：本报告合并自原工程健康诊断与视觉品质审查，在当时作为统一追踪快照；现仅用于历史追溯。工程部分见 §A，视觉部分见 §B，综合优先级见 §C。

---

### 0. 更新记录 / Decision Log

> 约定：按新发现追加、按已落地项更新状态。状态字段：`open` / `resolved` / `won't-fix` / `deferred`。

| 日期 | 变更 | 关联发现 |
|------|------|---------|
| 2026-08-06 | 初版 8 维工程诊断快照（门禁全绿） | 全部 |
| 2026-08-06 | **决策：永久放弃深色/暗色模式**，删除相关文档表述，保留 `--ws-color-error-dark`（勿删） | D1 → resolved |
| 2026-08-06 | **新增 6 维 UI 视觉品质审查**（一致/配色/首页/公开页/后台/响应式），合并进本报告 | V1-V6 |
| 2026-08-06 | **批次 1 落地**：F1 `chartTheme.ts` accent 兜底改 Teal；G1 `tableDefaults.ts` densityStyles 的 h-8/h-12 走 `--ws-control-height-sm/lg`。type-check + token-check 通过 | F1/G1 → resolved |
| 2026-08-06 | **批次 2 落地（定一色）**：Home hero 5 模块 + 2 外链图标统一白 `rgba(255,255,255,.85)`；Dashboard 统计卡 3 色→primary；AIAgents 侧栏 4 色轮转 + 默认 agent →primary；ITTechnology 模块网格 purple/warning/success→primary；UserMenu 头像默认色→primary；StatCard 删 purple/secondary 死变体。**验证**：type-check 通过；**实跑浏览器验证**（起完整前后端 + playwright 登录 admin）：Dashboard 用户/文章统计卡图标实测 Teal `rgb(13,148,136)`、ITTechnology PythonLab 卡图标 Teal、Home 5 pill 全白。**用户本机浏览器访问 `localhost:6608` 人工验收通过**。4 张真实截图存 `screens/`。AIAgents 侧栏因无 agent 数据无法渲染，代码级验证。**保留**功能色：workflow 节点/端口/自适应评估/图表序列色。 | V2 部分 resolved |
| 2026-08-06 | **批次 3 启动（关 token 断层，A 方案）**：先立 token 映射（`gap-layout-gap`/`p-panel`/`gap-space-*` 类已加进 tailwind）+ 语义助手类启用，不做全库替换。边改边截图人工验收。 | V1 进行中 |
| 2026-08-06 | **批次 3 · 甲-1+壳 落地**：`SharedResultLayout.tsx` 修正 —— ① h1 改 `ws-heading-card`（原 text-sm）；② 手写导出下拉（`absolute z-50 shadow-xl`）→ shadcn `DropdownMenu`（复用 `ui/dropdown-menu`）；③ 删无用 `useState/useRef/useEffect`；④ 内容容器 padding `px-6 py-8` → `--ws-panel-padding-lg`/`--ws-space-5`。验证：type-check ✓ + 浏览器实测 Radix `[role=menu]` 正常弹出 2 项。 | V1 语义类/壳部分启用 |
| 2026-08-06 | **发现真 bug：后台页刷新被弹回 /home**。根因定位：前端 `useAuth.fetchCurrentUser` 在 `/me` 返回 401 时**直接判登出**（`isAuthenticated:false`）而不先尝试 `/refresh` 续期；且刷新时 `/refresh` 自身 401（stale `ws_refresh_token` / Redis 会话 nonce 不匹配），导致续期失败 → 守卫弹回 /home。后端 `/me` 在带**当前有效 token** 时返回 200（curl 实测），非后端鉴权缺陷，是**前端 token 续期健壮性 bug**。 | 新增 DEFECT-1（open，需专修） |
| 2026-08-06 | **用户决定：光束图（结果页图表渲染）效果问题暂缓**，标记归后置处理（属数据/图表渲染层，非壳层，不纳入本轮视觉主线）。 | 新增 DEFER-beam（deferred） |
| 2026-08-07 | **DEFECT-1 已修复**：Login `resolveLoginDestination` 硬编码 /home → 改为 honor `redirect` 参数。后台深链刷新不再弹回 /home。type-check ✓ + 374 tests ✓ + 浏览器实跑验证。 | DEFECT-1 → resolved |
| 2026-08-07 | **§F P0 批量落地**：①DB 三件(task_analyses agent_id+复合索引、幂等删 subject 死列) + 重建丢失的 `20260726_0001` migration 对齐链，`check_migration_state` OK；②SSRF(新增 `_assert_safe_endpoint` 封禁内网/环回/169.254.169.254，94 tests ✓)；③typst 路径穿越双重校验；④性能(SSE 停双跑、评测 N+1 批量 count)；⑤**refresh token 迁移 HttpOnly cookie**（set 不再写 storage、getStoredRefreshToken→null 走 cookie；验证 localStorage refresh=absent + 刷新会话存活）。数据/契约敏感项(znt mock 边界、文章 list 去 content)标记待需业务确认。 | §F P0 部分 resolved |
| 2026-08-06 | **批次 4 · F2 对比度修复落地**：新增 `--ws-color-primary-text:#0F766E`（深档 Teal，白底 5.47:1 达 AA）+ tailwind `text-primary-text` 类；Button `secondary`/`link`、Badge `info` 3 处 text-primary → text-primary-text。验证：type-check ✓ token-check ✓ 浏览器实测 `text-primary-text`=rgb(15,118,110)。**保**--ws-color-primary 用于图形/图标/背景（3:1 足够）。页面散落 text-primary（多图标/装饰）暂不改（A 方案谨慎）。 | F2 → resolved（组件文本） |
| 2026-08-15 | **全量复检（5 并行审查代理 + 6 门禁实测）**：对分支 90 文件改动（+688/−611）+ 9 未跟踪文件做合并前终检。门禁：type-check ✓ · token:check:ci ✓（0 undefined / 1831 引用）· vitest 77 文件 374 ✓ · pytest 736 passed 1 skipped ✓ · alembic 单 head ✓ · 迁移全新库 upgrade/downgrade 往返 ✓。发现合并前清单 1-5 与打磨项 6-12，详见 §C-3。 | 新增（全部） |
| 2026-08-15 | **§C-3 收尾修复全部落地**：①SSRF 防护重构（Ollama 本机 11434 显式放行、`EndpointNotAllowedError`→/discover 400 生效、getaddrinfo 全地址校验+异步化+IPv4-mapped 归一化，新增 `test_model_discovery_ssrf.py` 17 用例）；②typst seed ValueError→400；③迁移 20260807 索引改 `IF NOT EXISTS` + docstring Revises 修正；④beam 序列第 2 槽→`--ws-color-secondary`（图表序列色，登记保留）；⑤token 细节（3xs/2xs rem 化、导航字号回归、`--ws-gradient-primary` 纯 Teal、Login 渐变 token 化、primary-text 去重、button/search-input padding rem/token 化）；⑥紫色交互态→primary（自适应题边框/workflow 节点/Badge purple 保留）、hover→primary-active（AA）；⑦硬编码色→success/warning/error/info/purple 语义 token；⑧Users TooltipProvider 表格级 + 胶囊 h-9→token、Xbk 搜索框 h-8 text-xs、api.ts 死代码、Home 内联色、StatCard 过时 color prop、AIAgents 死色数组；⑨3 个新守卫 GET 补鉴权测试 + API.md 认证列同步。 | 新发现 → resolved |
| 2026-08-15 | **迁移全新库实测（部署路径确认）**：`bootstrap_db --initial-only`（create_all legacy baseline）→ `alembic upgrade head` 从零库成功；两条新迁移 upgrade/downgrade/re-upgrade 往返全对。**注意**：空库直接裸跑 `alembic upgrade head` 会在 20260213_0005 失败（znt_agents 不存在）——正式全新库路径必须 bootstrap 先行。 | 新发现（部署路径约束，记录） |
| 2026-08-16 | **Docker 栈实践验证（真机全链路）**：Docker Desktop 启动后旧栈自动复活（旧镜像）；重建 backend/typst-worker/pythonlab-worker 镜像（新代码），前端为源码挂载（天然新代码）。**docker 库从 20260711_0002 → upgrade head 一次跑通两条新迁移**（真实部署路径）。API 行为实测全对：`supported-providers` 无 token **401**（旧代码为 200）/ admin token 200；`detect-provider` localhost:11434 → **ollama 200**（本机放行生效）；`/discover` SSRF 127.0.0.1:8080 → **400「禁止访问内网/环回/保留地址端点」**（此前死掉的 400 分支实测生效）；typst seed 非法 key → **400**；`assessment/available` admin token 200 / 无 token 401（require_student_or_staff 端到端）。**playwright 浏览器实测**：登录 → /admin/dashboard 落点正确，/home、/ai-agents、/admin/users、/admin/assessment、/admin/ai-agents、/admin/informatics、/articles、/xbk 共 9 页走查**零控制台/页面错误**；Xbk 搜索框 h-8 实测 29px（=2rem×根字号 14.5px，与同排 h-8 控件一致）。截图存 `screens/verify-20260816/`。 | 实践验证 ✓ |
| 2026-08-16 | **全项目第二批审计（6 并行只读代理）**：维度评级——安全 B、部署 CI B−、前端 C+、文档架构 B−、数据库 C、测试 C−。执行入口与全部证据见 `docs/docker/plans/2026-08-16-full-project-audit-plan.md` §8（含旧假设修正 6 条、各维度 TOP 问题编号、7 个待拍板决策点）。同时修复自引治理违规：`model_discovery.py` 拆 endpoint_security/provider_clients 两模块（865→468 行）、typst_notes 570，治理 errors 22→18，全量 736 tests 无回退。 | 新增（进行中） |
| 2026-08-17 | **批次 1 · 无需决策项全部落地**：①API.md 17 处认证列修正（system/articles/categories→超级管理员）+ ASSESSMENT.md head 过期修正；②CI `repo-config` job 补 `git diff --check origin/main...HEAD`；③治理基线：`chat_stream.py` 真重构（stream_agent_chat 35→20、_stream_dify 24→13、抽 13 helper）、`run_agent_chat_blocking` 33→29（抽 _post_with_retry）、`create_game` 条目删除、14 条过期例外中 typst_notes 因减肥 542 行删除条目，`check` **ERROR=0**；assessment/admin.py 741→734；④死代码清理（6 token+5 类+--ws-z-toast+5 后端死函数+IT_GAMES_ADMIN_ROLES 合并 6 处，token 引用 1831→1821）；⑤`?token=` 收窄：deps.py 移除 query 回退，新增 `get_current_user_sse`/`require_*_sse` 挂 3 个 SSE 路由，前端删 3 处拼接（WS 保留），新增 5 测试，**线上实测**（docker 新镜像）：普通端点 query token 401、SSE cookie 200、SSE 伪 token 401/真 token 200；⑥dev 双库收敛（docker-compose.dev.yml postgres 5433 + DEPLOY.md 本地开发数据库章节）+ .env.example 补 9 变量。全量门禁：pytest **741 passed**、vitest 374、type-check、token:check:ci、git diff --check 全绿。 | 批次 1 部分 resolved |
| 2026-08-17 | **ratchet 已知事项（PR 需人工放行）**：`check --base-ref` 对 12 条例外续期（2026-08-10→2026-09-15）判 "exception expiry extension" ERROR——治理机制如此（续期被拒促修复）。清单：analysis.py(file)、users.py(file)、pubsub._redis_listener、agent_analysis_events._extract_terms、agent_analysis_summaries._qc、agent_chain_analysis ×2、agent_hot_analysis ×4、games._check_file_signature。**处置**：批次 2 上帝文件/复杂度拆分消除这些债务并删条目；PR 合入时对这 12 条做一次性放行并留档。 | 新增（open，批次 2） |
| 2026-08-17 | **批次 2 · 决策无关项全部落地（6 并行代理）**：①**DB-1（P0）修复**：新增根迁移 `20260210_0000_legacy_baseline_tables`（18 表 172 列对照模型逐一固化 + inspector 幂等守卫）、链根改接、`20260213_0005` 补表守卫、并修复既有缺陷 `alembic_compat.py`（裸库 alembic_version VARCHAR(32) 装不下 45 字符 revision）——**裸空库 `alembic upgrade head` 实测成功**（upgrade/downgrade 往返 + bootstrap 路径双验证）；②**DB-4**：7 高频过滤列补索引迁移 `20260817_0001_query_filter_indexes`（status 类复合 (status,created_at)），模型同步登记，docker 库 + Homebrew 库双实测在位；③**F-3 断点统一**：useBreakpoint 对齐 Tailwind（640/1024/1280/1536），修 9 消费点中 4 处错位（另发现 TypstNoteEditor:204 硬编码 992px 第三轨，待批次 4）；④**S-6**：pythonlab syntax/check 按 IP 限流（公开模型不变）；⑤**F5**：rollback.sh 新增 `--image-tag` 固定旧镜像 + revision 存在性断言 + 防误启警告；⑥**D-1**：新增 `scripts/backup.sh`（pg_dump -Fc + 14 天轮转）与 `scripts/restore-drill.sh`（演练库恢复+断言+记录，Homebrew PG 实跑通过），DEPLOY.md/scripts README 同步；⑦**ratchet 债务消除**：10 个函数级复杂度真拆（≤12）删条目、analysis.py 1355→489（拆 3 模块）、users.py→456（拆 2 模块），**base-ref errors=0**——12 条续期问题随条目删除自然消失，PR 无需人工放行。 | 批次 2 部分 resolved |
| 2026-08-17 | **门禁终验（批次 1+2 后）**：pytest **741 passed** · vitest 77 文件 **374** · type-check ✓ · token:check:ci 0 未定义/1821 · 治理 check **errors=0**（warnings=10）· **base-ref errors=0** · alembic 单 head `20260817_0001` · git diff --check 干净 · 两库（Homebrew/docker）均升至 head。 | 验证 ✓ |
| 2026-08-17 | **批次 3 · 决策无关项落地（6 并行代理 + 2 项自办）**：①**T-1 越权行为测试**：新增 3 文件 **159 用例**（assessment 10 端点 4 角色矩阵、typst 15 端点 staff 矩阵、student→admin 代表 403）——"student token→管理端点→403"全栈用例从 0 到 1；②**T-2 coverage 门禁**：pytest-cov/coverage/@vitest/coverage-v8 接入 + `check_changed_lines_coverage.py/.mjs` + CI 非阻断门禁（实测本分支命中率后端 32.7%/前端 20.1%，下阶段收紧）；③**A-2 service 层**：learning(10 函数)/ml(9 函数) 两域补齐，端点净删 440 行内联 DB；④**F-2 data.ts 拆分**：3 个 9,280 行数据文件 → 34 子文件（逐字节等价、导出名全保留）；⑤**F-5 any 清零**：TOP4 47 处 no-explicit-any 全消（lint 482→**435**）+ PlanPage 1205→509（拆 5 组件）+ TypstNoteEditor 第三断点轨改用 hook；⑥**模型登记补齐**：alembic check 漂移 14→9；⑦**smoke 入 CI**：core smoke import gate 落地（best-effort）+ 需栈 smoke 登记 CICD.md 暂缓；⑧自办：删除 37 个已合入 stale 分支（worktree-*/codex/fix），卸载 3 个 @myriaddreamin/typst-* 死依赖并移除 typst-vendor chunk（build 通过）。 | 批次 3 部分 resolved |
| 2026-08-17 | **门禁终验（批次 3 后）**：pytest **906 passed, 1 skipped** · vitest 77 文件 374 · type-check ✓ · token:check:ci 0/1821 · lint **0 errors / 435 warnings**（−47）· 治理 check/base-ref **双 0 ERROR** · 单 head 20260817 · build ✓。 | 验证 ✓ |

> 视觉品质维度由"干净 / 优美 / 简洁 / 整洁"四标准驱动。视觉发现用 `V` 前缀编号。

---

## §A 工程健康诊断（原 8 维）

### A.1 门禁实测结果（已实跑）

| 门禁 | 结果 |
|---|---|
| `npm run type-check` | ✅ 0 错误 |
| `npm run build` | ✅ `✓ built in 1.48s`，4363 modules |
| `npm run test` (vitest) | ✅ **77 文件 / 373 用例全绿** |
| `npm run lint` | ✅ 0 errors / 481 warnings（皆既有 no-explicit-any） |
| `npm run token:check:ci` | ✅ **0 undefined across 1816 references** |
| `npm run ui:audit` | ✅ 731 hits（上限 912，净减 ~181，token 化有效） |
| `pytest --collect-only` | ✅ **718 tests collected**，无 import 错误 |
| `alembic heads` | ✅ 单 head：`20260711_0002_restore_legacy_baseline_indexes` |
| `docker compose config` (prod+dev) | ✅ 双双通过 |

> 未验证：需真实 postgres 的运行态（check_migration_state 动态部分、docker.sock 缓解）已标注。

### A.2 工程健康总体结论

**UI 分支门禁全绿；后端/DB/部署基线健康。** 无绕过鉴权、无 schema 漂移、无死路由。

**推进进度（2026-08-06 晚）**：
- **批次 1 ✅**：F1（chartTheme accent 兜底→Teal）、G1（densityStyles→token），type-check+token-check 通过。
- **批次 2 ✅**：V2 装饰性多色收敛（Home/Dashboard/AIAgents/ITTechnology/UserMenu/StatCard），用户人工验收通过；保留功能色。
- **批次 3 ⏳ 进行中**：已立 token 映射地基；`SharedResultLayout` 壳整改（h1 语义类 + DropdownMenu + token padding）验证通过。语义类/壳开始启用。
- **DEFECT-1 🟠 open（待最后修复）**：后台刷新被弹回 /home（前端 token 续期健壮性）。
- **DEFER-beam 🔵 deferred**：光束图图表渲染效果（数据/图表层）暂缓。

工程维度剩余开放项：**P0×1(D2) · P1×1(F5) · P2×1(G3) · P3×8**（其余 P0-P2 已 resolved）。

### A.3 工程发现清单（D/F/G/H，按严重度）

#### P0
- **D2 🟠 [deploy]** docker.sock 直接暴露 + pythonlab-worker 以 root 运行。`docker-compose.yml:178/275`；当前仅内网未公网是防线；`DOCKER_SOCK_GID` 未设。→ worker 去 root(`group_add`)、永不公开端口、治本走 Dind/Pod。

#### P1
- **F1 🟢 [token]** `chartTheme.ts:4` accent 兜底色已改 Teal `#0D9488`（原 Violet `#7C3AED`），2026-08-06 批次 1 落地，type-check+token-check 通过。
- **F2 🟢 [a11y]** Teal 对比度不达标：`#0D9488` 正文对白底 3.74:1、`!text-white` on `primary-hover` 2.49:1、`info #0EA5E9` 2.77:1。→ **已修**（2026-08-06）：新增 `--ws-color-primary-text:#0F766E`(5.47:1 达 AA) + tailwind `text-primary-text` 类，Button secondary/link、Badge info 改用之。`#0D9488` 保留给图形/图标背景(3:1 足够)。primary-hover 配深字(2.49:1)仍待后续审。|
- **F3 🟢 [api]** `assessment/student.py` 十处学生端端点 `get_current_user` → **`require_student_or_staff`**（2026-08-06，用户选择"student 或 staff"档：学生为主 + 教师/管理员可用）。新增 `require_student_or_staff` 到 `core/deps.py`。验证：assessment 测试 32 passed 1 skipped，模块导入✓。
- **F4 🟢 [api]** `agents/model_discovery.py` 三个只读 GET（`/preset-models`、`/detect-provider`、`/supported-providers`）**已加 `require_admin`**（2026-08-06，模块导入✓+5 路由均有鉴权依赖，与既有 POST 一致）。
- **F5 🟠 [deploy]** rollback 用当前镜像执行 `alembic downgrade`（非旧镜像），旧 revision 文件被清则回滚失败。

#### P2
- **G1 🟢 [ui]** `tableDefaults` 命名冲突/职责分裂：`components/ui/`(density) vs `constants/`(分页)。**densityStyles 部分已修**（2026-08-06：compact/comfortable 的 h-8/h-12 → `--ws-control-height-sm/lg` token）；命名冲突/职责分裂的合并仍 `open`（归批次 3）。
- **G2 🟢 [token]** `StatisticsCards.tsx` Indigo 硬编码卡片背景 —— **已修**（2026-08-06）：7 卡 7 色 → 收敛为 primary/teal 单 accent（平均响应用中性 text-secondary），删全部硬编码 `rgba(14,165,233)` 等 + fallback hex（`#0ea5e9`/`#ef4444`）。token-check✓。
- **G3 🟠 [db]** migration 命名/元数据不规范：`20260325_add_xbk_indexes.py` revision 不符、`1655cf329617` docstring 与 down_revision 不符、`20260430_migrate_dev_schema.py` 倾倒式。
- **G4 🟢 [tests]** pytest.ini 注册 asyncio marker 但无 pytest-asyncio、无 asyncio_mode、0 async 用例。→ **已修**（2026-08-06）：删掉 `pytest.ini` 死 marker 块；pytest 仍收集 718 tests。
- **G5 🟢 [tests]** `useAssessmentQuery.ts:40` `Number.isFinite` 守卫**已补测试**（useAssessmentApiContract.test.tsx 新增：NaN id 时 query 不触发）。全量 frontend 测试 374 passed / type-check ✓。
- **G6 🟢 [docs]** accent Violet→Teal 变更同步 —— **已修**（2026-08-06）：AGENTS.md 核心色彩表 accent 从 `#7C3AED(Violet)` → `#0D9488(Teal)`，新增 `secondary=Violet`（品牌仅装饰）行，与 COLORS.md+index.css 一致。
- **G7 🟢 [a11y]** `TableHead` `<th>` **已加 `scope="col"`**（2026-08-06）；`TableCaption` 组件全仓无使用（保留为可用组件，非 bug）。

#### P3
- **H1** 色系文档需澄清（`--ws-color-purple` vs `secondary`）。
- **H2** rem 迁移残留：`index.css:185 --ws-text-3xs:10px`、第三方编辑器/markdown px。
- **H3** Teal/Violet 混用 accent 漂移（视觉）；按钮 `secondary` 变体名不副实。
- **H4 [security]** `?token=` query 被所有 HTTP 端点接受（前端仅 3 处 SSE 用）→ 建议收窄到 SSE。
- **H5 [db]** 4 模型类未进顶层 `__init__.__all__`（表已注册，命名瑕疵）。
- **H6 [ui]** Card/TableRow 键盘事件强转鼠标事件（`as unknown as MouseEvent`）语义隐患。
- **H7 [deploy]** `CORS_ORIGINS` 生产回落 localhost；shadow `md` 与 `sm` 重复。
- **H8 [build]** 既有 unused-vars + vendor chunk 告警（非本分支引入）。

---

## §B UI 视觉品质诊断（新增，6 维）

> 准绳：**干净 / 优美 / 简洁 / 整洁**。证据 = 源码 token 一致性 + 运行时 DOM/计算样式。
> 视觉发现用 `V` 编号。视觉严重度：`V-高`（直接影响"干净/整洁"）/ `V-中` / `V-低`。

### B.1 核心总体判断（高信号）

**设计 token 定义完整，但"落地层"几乎全部绕过 token**——间距/圆角/卡片基本走回 shadcn 出厂默认与手写 tailwind 工具类。这是"看起来不够干净整洁"的**最核心单一原因**：体系在顶层是对的，贯彻到每个页面时被稀释了。

四个最抢眼的`脏/乱`集中点：
1. **4 处复用入口色相打架**（V2）：Home 5 色 pill、AIAgents 侧栏 4 色轮转、Dashboard 统计卡 3 色同排、ITTechnology 模块网格 5 色穿插。
2. **图表硬编码彩虹**（V2）：`normalize.ts` 8 色、`ChainBeamChart` 15 色、`chartTheme` 非 token FALLBACKS。
3. **Violet 泄漏进主交互约 8 处**（V2）：UserMenu、ChatArea、pythonLab 端口、ITTechnology 模块卡等——违反"Violet 仅品牌"既定规则。
4. **卡片/悬浮装饰叠加**（V3）：`border + shadow + translate + backdrop-blur` 多项叠加（`SummaryCard.tsx:11` 五项）。

### B.2 视觉发现清单（V1-V6）

**V1 进展（批次 3，A 方案）**：已把 `--ws-space-1..5`/`--ws-layout-gap`/`--ws-panel-padding*` 映射进
`tailwind.config.js` 的 `theme.extend.spacing`，使 `gap-layout-gap`/`p-panel`/`gap-space-3` 等类成立
（2026-08-06，type-check ✓ + tailwind 构建 ✓）。**全库替换 `gap-3/4`、`p-4/5/6` 为 token 类
（报告原列的高杠杆项）按 A 方案暂缓**，待你确认后分步执行。**已进步**：`rounded-2xl`→`rounded-lg`
标准卡圆角收敛（AgentData，2026-08-07）；`SharedResultLayout` 壳整改（h1 语义类 + DropdownMenu + token padding）。
- **栅格 gutter 全硬编码**：`gap-3`×45 / `gap-2`×31 / `gap-4`×26 vs `--ws-layout-gap` 仅 7 处（现可用 `gap-layout-gap` 后待替换）；等价内容卡 `p-4/p-5/p-6` 三档混用。
- **语义助手类 0 采用**：`ws-stack`/`ws-grid-cards`/`ws-heading-page/section/card` 定义后全站 0 文件使用（死代码）。
- **`rounded-2xl`（=16px，非 token）被当标准卡容器**：~~19 处~~ → **已收敛**（2026-08-07）：AgentData 5 文件 18 处 `rounded-2xl`→`rounded-lg`（与 Bento 圆角一致）；仅 `ClassSelector` 2 处大型选择卡保留（不同卡片范式，刻意）。
- **6 套卡片抽象并存**：ui/Card、PanelCard、AdminCard、AdminAppCard、AppLauncherCard、StatCard。
- **z 层级 token 被绕过**：header 手写 `z-index:100`、全站 `z-50` modal。
- **`h1` 页面标题当小正文**：`SharedResultLayout.tsx:39` → **已改** `ws-heading-card`（2026-08-06 甲-1）。其余 h1 无 text-sm。
- **字距滥用**：`tracking-wide/widest` 全站 5 处。

#### V2 🟠 色彩与噪音：多色打架 + 硬编码 + Violet 泄漏
> **批次 2 已收敛装饰性多色**（2026-08-06）：Home hero 7 图标全白（视觉验证 ✓）；Dashboard 统计卡 3→primary；
> AIAgents 侧栏 4 色轮转→primary；ITTechnology 模块网格→primary；UserMenu 头像默认→primary；StatCard 删 purple/secondary 死变体。
> **仍保留的功能色**（需区分，不违背"定一色"——它是语义数据色而非装饰）：workflow 节点/端口形状/自适应评估 purple、图表序列色。
- **Home hero 5 色 pill**（Home/index.tsx:12-18）：~~primary/purple/info/success/warning~~ → 已统一白 `rgba(255,255,255,.85)`。
- **AIAgents 侧栏 4 色轮转含 Violet**（index.tsx:110-113）：~~10-114~~ → 已统一 `primary`。
- **Dashboard 统计卡 3 色同排**（Admin/Dashboard/index.tsx:108-110）：~~primary/purple/warning~~ → 已统一 `primary`。AgentData StatisticsCards 7 卡 7 色（:22-28）**已收敛**（2026-08-06 G2：→primary 单 accent + 平均响应中性）。
- **ITTechnology 模块网格 5 色穿插**（index.tsx:26-93）：~~purple/warning/success~~ → 已统一 `primary`/`accent`（同为 Teal）。
- **图表硬编码彩虹**：normalize.ts:10（8 色）、TaskAnalysisComparePage.tsx:33（5 色）、ChainBeamChart.tsx:12-13（15 色）、chartTheme.ts FALLBACKS —— **open**（保留区分但需收敛为 token 化阶梯，入批次 3）。
- **Violet 泄漏主交互**：UserMenu:90 默认头像→primary（改）；StatCard purple 变体→删（改）；ChatArea:143 节点色 / pythonLab ports 形状色保留（功能色）。AdminLayout logo 渐变(primary→purple)保留（品牌）。
- **评估分数热图硬编码红/琥珀/绿**（StatisticsPage.tsx:842-843）：不改 token → open（入批次 3）。

#### V3 🟡 冗余装饰：卡片/悬浮叠加
- **卡片 hover 五选叠加**：`SummaryCard.tsx:11` border+shadow+backdrop-blur+translate+hover border 五层；`it-app-card:hover` box-shadow ring + 底色双边框 + `!important`×2（index.css:431）。
- **hero 装饰过载**：Teal→Violet 渐变 + 点阵 + 紫光斑 3 层（index.css:782-795），装饰超过信息层。
- **改法（"简洁"方向）**：卡片 hover 任选一种反馈（shadow 上浮 OR 边框变色 OR 微位移），三选一；hero 渐变收敛为纯 Teal 阶、删紫 blob 与点阵。

#### V4 🟠 首页（Home）：元素过载、层级重复
> **色彩-减法已落地（2026-08-07）**：hero 渐变去 Violet（`#7C3AED`末段→纯 Teal `#0F766E`）；Violet blob → 白；pill 保持 batch2 统一白。截图存 `screens/v4-hero-pureteal.png`。
- **首屏堆叠**：标语 pill + H1 + 问候/副文案 + 5 模块 pill + 2 外链 + 版本号，且模块入口与顶部导航 1:1 重复（顶部导航被自动隐藏，BasicLayout.css:240-262）。→ **open**（结构待定，未改）。
- **版本号与产品外链混排**（Home/index.tsx:89-103）：~~`v{version}` 孤悬~~ → **open**（可下沉 footer，未做）。
- **hero 渐变/饱和色硬编码**：~~含 Violet → 已改纯 Teal~~ ✅。
- **正面资产**：hero 玻璃轻盈按钮方向正确（保留）；~~均等 pill 建立"1 强 4 弱"~~ 保持统一（简洁优先，未加不对称）。

#### V5 🟠 后台（Admin）：共享栈完整但细节分裂
> **V5 状态（2026-08-07，用户决定收敛）**：本方向的多项改进**视觉价值不明显**，经试做后用户选择收敛。
> - **AdminDialog 激活 ✅ 保留**（死代码 → 导出 barrel，可用）。
> - **操作列统一（RowActions 扩展/文字模式）→ 试做后回滚**（用户判断各页文字/icon 形态可接受，不强行统一）。
> - **超宽列收敛（AIAgents 1400px→收窄）→ 试做后回滚**（内容少看不出区别；其余页仍为原始宽）。
> - 记录状态：V5 归 **won't-fix/deferred**，后台维持现状（管理/统计/删除等文字按钮保留，各页手写操作列保留）。
- **操作列**：各页手写形态保留（AIAgents icon / Assessment 文字 / Categories outline 等），不再强行统一。
- **`AdminDialog` 是死代码**（未导出 barrel、无调用）；所有弹窗走裸 shadcn Dialog，宽度（640/480/780px）、footer gap、字段 gutter（gap-3 vs gap-4）、标签词汇（FormLabel vs 裸 label）至少 3 个弹窗家族。→ 启用 AdminDialog 统一。
- **表格过宽**：AIAgents `min-w-[1400px]`、AgentData `min-w-[1180px]` + 单元格双 badge + 多色 icon → 信息过载。
- **形态分裂**：Assessment/StatisticsPage、ClassroomPlan/PlanPage 跳过共享 AdminTablePanel/AdminFilterBar，表格嵌裸 Card，与 CRUD 列表页观感不同。
- **基础良好**：未发现红色大按钮堆叠（删除皆 text-destructive ghost）；Dashboard 无多余边框切碎；BasicLayout 与 AdminLayout tool token/高度一致（仅 logo 渐变略异）。

#### V6 🟡 响应式 + 组件复用（"整洁"维度）
- **两套断点体系数值不一致（P0 根因）**：`useBreakpoint.ts` sm:576/md:768/lg:992/xl:1200（Bootstrap）vs Tailwind sm:640/md:768/lg:1024/xl:1280。md(768) 碰巧一致（最常用安全），但 sm/lg/xl 三区间 JS 与 CSS 结论相反，影响 Articles/Users/EditForm。
- **宽屏行过长**：阅读页正文 shell-wide(最大 1920px)、Article/Detail `max-w-[1560px]` → 阅读正文应限宽 `clamp(640px,72ch,860px)`。
- **组件复用机会**：ITTechnology 的 ml|ai|agents 三模块高度雷同（各 121 处硬编码间距、各 4 处手写页头）→ 抽 `PageHeader`/`PageToolbar`/`PageShell`。
- **间距未归 token**：Admin 目录硬编码 spacing 最集中（1652 处），固定 rem 不随 vw 自适应 → ≥16px 走 `--ws-space-*`。
- **表格 `minWidthPreset` 零采用**；3 处绕过统一横滚需复核（TaskAnalysisComparePage、GamesManager、Xbk）。

### B.3 视觉改进优先级（按"干净/整洁"收益）

1. **V2 定一色**：全局交互 accent 只留 Teal。Violet/purple 从 ITTechnology/AIAgents/StatCard/UserMenu/ChatArea/pythonLab 撤回，品牌紫只留登录插画与铭牌。**最优先（4 处色相打架 + 8 处 Violet 泄漏）。**
2. **V1 关 token 断层**：把 `--ws-space/layout-gap/radius` 映射进 tailwind `theme.extend`，生成 `gap-layout-gap`/`rounded-card` 类后一次全库替换 `gap-3/4`、`rounded-2xl`、`p-4/5/6`。**最高杠杆的工程化统一。**
3. **V1 定死"标准卡"模板**：内容卡 = `Card(rounded-lg)+CardContent(--ws-panel-padding)+border-border-secondary+shadow-sm`；交互卡=`Card isInteractive`。删 `rounded-2xl` 19 处与手写卡。
4. **V4 Hero 减负**：删紫 blob/点阵，渐变纯 Teal，pill 图标统一白/淡 Teal，建立主次。
5. **V2 图表收敛**：对比/学生链/雷达改 Teal 透明度阶梯，异常才用 warning/error；色板统一走 `getAgentChartTheme()`。
6. **V5 后台收敛**：扩展 RowActions 统一操作列 + 激活 AdminDialog 统一弹窗 + 统计卡色相收敛。
7. **V3 hover 三选一**：卡片悬浮只留一种反馈；hero 装饰减层。
8. **V6 统一断点 + 阅读行宽**：断点数值段对齐；正文限 `72ch`。

---

## §C 综合修复优先级（工程 + 视觉合并）

> 合并了工程健康（§A）与视觉品质（§B），按"投入产出比 + 是否阻断"排序。

| 阶段 | 动作 | 归属 |
|------|------|------|
| **立即（本分支合入前）** | F1 chartTheme accent 兜底改 Teal；G1 densityStyles h-8/h-12 token 化 | 工程 |
| **短期（临近发布）** | V2 定一色（✅）；**F2 ✅ F4 ✅ F3 ✅**；**G5 补测试 ✅**（374 全绿）；**G4 asyncio ✅**（删死 marker）。剩余：暂无待办 | 视觉 + 工程 |
| **中期（强一致性）** | V1 关 token 断层（tailwind 映射 ✅ + 标准卡圆角收敛 ✅ rounded-2xl→rounded-lg AgentData；全库替换 gap/rounded/p 按 A 方案暂缓）；V4 Hero 减负 ✅（去 Violet）；V2 图表收敛（部分，beam 暂缓） | 视觉 |
| **中期（后台整洁）** | V5 **用户决定收敛/放弃**：RowActions 统一、AdminDialog 激活、超宽列收敛均**试做后回滚或留死代码**（视觉价值不明显）。记录：AdminDialog 已激活(导出 barrel)、操作列统一已放弃并回滚、AIAgents 超宽列收敛已回滚。 | 视觉 → won't-fix/deferred |
| **中期（工程）** | G2 ✅、G3 migration 规范、F5 回滚加固、G6 ✅ | 工程 |
| **长期（运维）** | D2 docker.sock 最小化；H4 token-in-query 收窄 | 工程 |
| **持续（V 低优先）** | V3 hover 三选一、V6 断点统一 + 阅读行宽、V1 启用 ws-* 语义类、删除 6 套卡片冗余 | 视觉 |
| **收尾修复** | **DEFECT-1 ✅ resolved（2026-08-07）**：Login `resolveLoginDestination` 硬编码 /home → 改 honor `redirect` 参数，后台深链刷新不再弹回 /home。Type-check + 374 tests ✓，浏览器实跑验证 | 工程(前端鉴权) |

---

### §C-1 DEFECT-1：后台页刷新被弹回 /home

> 状态：🟢 **resolved（2026-08-07 已修复）**

**现象**：管理员登录后，在 `/admin/dashboard`（或任意 `/admin/*`）**整页刷新 / 深链直达**，会被弹回 `/home`；应用内 SPA 导航则可正常进入后台。

**根因（已实证，以本版为准）**：
- **并非 401/stale-token 问题**：实跑发现刷新时 `/api/v1/auth/me` 返回 **200**（token 有效），但应用仍落到 `/home` → 这是 **routing/boot 逻辑 bug**。
- 真正根因：后台守卫把深链 `/admin/dashboard` 重定向到 `/login?redirect=/admin/dashboard`；而 [Login.tsx](../../../frontend/src/pages/Auth/Login.tsx) 的 `resolveLoginDestination()` **硬编码返回 `"/home"`**，完全忽略守卫传来的 `redirect` 参数 → 会话恢复/登录后固定跳回首页，丢弃用户原本要访问的后台页。

**修复（2026-08-07）**：`resolveLoginDestination` 改为**接收并返回 `redirect` 参数**（`redirect` memo 已安全解析：无合法值→`/home`）。两处调用（登录成功 `onFinish` + 已登录自动跳转 useEffect）都传入 `redirect`。
- 深链刷新 → 守卫 → `/login?redirect=/admin/dashboard` → 登录后回 `/admin/dashboard` ✅
- 普通登录（无 redirect）→ 仍回落 `/home` ✅（无行为变化）

**验证**：type-check ✓；全量测试 **374 passed ✓**；浏览器实跑 `/admin/dashboard` 刷新**停留在该页**（此前弹回 /home）。同步更新 `loginRoleRedirect.test.tsx`：原断言旧 buggy 行为的用例改为断言正确行为（登录回 deep-link 而非固定 /home）。

---

### §C-2 深层审查（2026-08-07，5 维多轮探索 · 近期全部改动）

> 5 个并行深层审查 agent（鉴权路由链 / 后端鉴权 / token组件 / token一致性 / 结果页族）逐文件深挖调用链与潜在回归的汇总。

#### 一、DEFECT-1 修复复核 —— 发现并修正一处连带回归 ⚠️
- 深层审查确认 **DEFECT-1 修复本身完整、无残留 /home 弹回、无 open-redirect、无时序闪跳**（redirect 仅内网绝对路径，`//` 被拒）。
- **但发现我在修复时删掉了原 `resolveLoginDestination` 的"角色回落"逻辑**（admin→/admin/dashboard、teacher→/admin/classroom-interaction），造成教师/管理员从无 redirect 入口登录后不再进各自后台的**回归**。
- **已修正**：`resolveLoginDestination(role, redirect)` 恢复原逻辑（有显式 redirect 就返回它；无则按角色回落；student 回落 /home）。测试恢复原断言，374 tests 全绿。**多轮审查价值体现**。

#### 二、深层发现清单（按严重度）

**P0 · 对比度（AA 不达标点仍多）—— 部分已修（2026-08-07）**
- ✅ **已迁移到 `text-primary-text`**（#0F766E, AA 5.05-5.47:1）的真实文字级点：ChatArea 聊天 `<a>`链接、TaskAnalysisListPanel `光束图/时序`链接、Users 统计数、TaskAnalysisNewPage 步骤 done 态 + `填充`链接、ChainBeamChart 统计值、Hot/Chain 结果页全部 `bg-primary-soft` 文字徽章(共 12 处)。**保留 `text-primary`**(3:1 即可)：Loader2 spinner、`{item.icon}` 图标、SummaryCard 图标容器、checkbox 白勾(小型图形符号,3.74:1 过 3:1)。
- ✅ **Violet 2 处已清**：ActivityFormDialog 空位计数 `text-violet-600`、PlanPage 详情按钮 `text-purple` → text-primary-text。
- ⏳ 仍有零星页面级 `text-primary`（图标/装饰为主）可后续按需迁移，非阻断。
- 验证：type-check / token-check ✓ + 374 tests ✓。

**P1 · 死代码 / 双轨**
- tailwind `spacing` 命名映射近乎死代码：`gap-layout-gap`/`p-panel` 几乎零引用，页面实际用 `gap-[var(--ws-layout-gap)]` arbitrary 类。双轨并存。→ 二选一统一。
- 死定义：`--ws-radius-xl`、`--ws-z-toast`、`.ws-stack*`、`.ws-grid-cards`、`.ws-heading-page/section`（heading 3 个只用 1 个）。

**P2 · px/rem 混用**
- `button default size px-[18px]` 硬编码 px（与 rem 高度混用）；`AddForm.css`(17)/`typstEditor.css`(16)/`editor.css`(7) px 间距；`MindMapEditorLib:148` `#fff` 硬编码。

**P3·后端/契约**
- 文档 `API.md:234-236` 三 GET 仍标"无认证"（契约漂移，AGENTS 要求同步）。
- 新增 3 个 GET 守卫 + student 10 端点**零守卫测试覆盖**。
- `model_discovery` GET 属"死 API 层"（无 React 组件调用）；`/detect-provider` 无出站请求（SSRF 真面在已守卫的 /discover POST）。

**DEEPER · 后台验证级**
- `TaskAnalysisComparePage` 是独立手写壳（纯色底 vs 结果页渐变、rounded-xl vs lg、非 sticky header），同列表点开观感跳变 → 本批统一最大漏点。
- `SharedResultLayout` 内容 padding `lg:px-10`(40px)→token(~21-27px)，内容更贴边，大屏需复核。
- 跨 tab refresh token 轮换"互踢"竞态（非本次引入，既有风险）。
- 后端 `require_student_or_staff` 允许教师/管理员以本人身份真实答题落库（建议读=or_staff、写=student 拆分）。

#### 三、已确认无问题
- 无未定义 CSS var（静态 141 定义/82 引用全对）；`--app-*`/`--radix-*`/`--primary` 均为预期/运行时注入。
- backend 角色枚举无 guest 穿透；`role_code` 取自 DB 非 JWT 不可伪造。
- AgentData `rounded-2xl→rounded-lg` 干净，hero 大型选择卡未误改；DropdownMenu portal 修复了旧绝对定位遮挡。

---

### §C-3 全量复检与收尾修复（2026-08-15，5 审查代理 + 4 修复代理）

> 对 `feature/ui-optimization-design` 90 文件改动（+688/−611）+ 9 未跟踪文件做合并前终检。
> 门禁实测：type-check ✓ · token:check:ci ✓（0 undefined / 1831 引用）· vitest 77 文件 374 ✓ ·
> pytest **736 passed 1 skipped** ✓（新增 SSRF 测试 17 用例）· alembic 单 head ✓ ·
> 迁移全新库 upgrade/downgrade 往返 ✓（见 Decision Log 2026-08-15 部署路径条目）。

#### 已修复（resolved）

1. **SSRF 防护重构**（`services/agents/model_discovery.py`）：Ollama 本机 11434 显式放行（host∈{localhost,127.0.0.1,::1} 且 port==11434，仅 OLLAMA provider，admin-only 为前提）；新增 `EndpointNotAllowedError(ValueError)` 使 API 层 400 分支真正生效（不再被吞成 success=False+200）；guard 改 getaddrinfo **全地址**校验（A+AAAA、IPv4-mapped 归一化，任一不安全即拒）+ 异步解析不阻塞事件循环；新增 `tests/ai_agents/test_model_discovery_ssrf.py` 17 用例（9 类攻击面全拦 + 公网 IPv4/IPv6 放行 + Ollama 放行边界 + /discover 400 语义）。**记录修正**：全仓与 git 历史中均不存在 2026-08-07 日志所述"9 攻击面全拦"单测文件，当时为间接验证；本次为 SSRF 防护首次建立专项单测。
2. **typst seed 500 回归**：`api_seed_style_from_resource` catch ValueError→HTTP 400；`typst_notes` 对 DB 来源 key 加防御回退。
3. **迁移幂等**：`20260807_0001` 索引改 `CREATE INDEX IF NOT EXISTS`（对齐 20260711_0002 守卫模式）；docstring Revises 修正为 20260726_0001；`20260726` downgrade 注明有意保留 pg_trgm 扩展。
4. **beam 撞色**：`chartTheme.ts` beamColors 第 2 槽 → `--ws-color-secondary`（图表序列色，属登记保留功能色）；Hot/Compare/ChainBeam 核对无相邻撞色。
5. **token 细节**：`--ws-text-3xs/2xs` 改 0.714/0.786rem；导航字号 clamp 回归旧观感（nav≈14-15.4px、brand≈17-20.25px，见下方注意）；`--ws-gradient-primary` 纯 Teal；`Login.tsx` 渐变走 token；`primary-text` 引用去重（=primary-active）；button px→rem；search-input padding 走 token。
6. **交互统一**：AssessmentPanel/ClassroomPanel 紫色交互态（进度条/选中态/提示文本/统计圆环）→primary/primary-text；**保留**：自适应题边框、workflow 节点（ChatArea:143）、Badge variant="purple" 共享样式；hover 底色→`--ws-color-primary-active`（白字 5:1 达 AA）；AIAgents 4 项全 primary 死色数组删除。
7. **硬编码收敛**：ChainAnalysisResultPage/ActivityFormDialog/TemplatePalette/TaskAnalysisNewPage/ComparePage → success/warning/error/info/purple 语义 token；Home hero 内联色删冗余 + `HERO_ON_PRIMARY` 常量。
8. **结构小项**：Users TooltipProvider 表格级（消除每行一个 Provider）、统计胶囊 h-9→`--ws-control-height`；Xbk 搜索框补回 `h-8 text-xs`；api.ts 死代码清理（429 冷却重试分支**保留**——后端 rate_limit 真实抛 429）；StatCard 过时 purple/secondary prop 调用方清理。
9. **测试/文档**：3 个新守卫 GET 补 `_assert_depends_on` 断言；API.md 三处 GET 认证列「否→管理员」。

#### 残留注意（open，非阻断）

- 导航字号：rem 逼近公式经复核在宽屏仍比原值小 0.4–1px（vw 系数可忽略），已改回改动前的**精确 px clamp 原值**（`--ws-text-nav` / `--ws-text-nav-brand`），零视觉差异。
- `.home-hero-tool-link` CSS 为 rgba(255,255,255,.7)，Home 外链图标 inline .85 为真实视觉差异，保留（已提取常量）。
- Badge `variant="purple"` 全库 8 处共享未动（含 ClassroomPanel 回顾徽章），是否收敛走后续批次。
- UserMenu「后端管理」改为同页 navigate（有意行为变更，已确认无 bug）；Xbk SearchInput allowClear 新增清空行为（保留）。
- beam index 8 深紫槽 `#8B5CF6` 保留（序列可区分）。
- **guest 角色**被 `require_student_or_staff` 静默 403（审查发现，未改——需业务确认 guest 是否应使用自主测评）；教师/管理员仅能以本人身份走测评流程（归属校验未放开，与"放宽访问"意图需再确认）。
- 全新库部署路径：必须先 `bootstrap_db --initial-only` 再 `alembic upgrade head`（裸跑会在 20260213_0005 失败），已记录。

---

### §F 全方位深度分析（2026-08-07，8 维度全仓库探索）

> 8 个并行 agent 覆盖全仓库：架构 / 数据库 · 性能 / 安全 / 前端质量 / 部署运维 / 测试 / 文档治理。规模：前端 46k 行/463 文件 + 后端 4.5k 行/286 文件 + 46 模型 + 90 路由 + 38 migration。

#### 综合评级
| 维度 | 评级 | 一句话 |
|---|---|---|
| 鉴权完整性 | **A** | 写操作/敏感 GET 全部有守卫；仅故意公开(health/public/login) |
| 后端安全实践 | **B+** | 脱敏/加密/沙箱/上传白名单扎实；无 RCE、无未鉴权写面 |
| 前端工程化 | **B+** | 懒加载/queryKeys/ErrorBoundary 三态成熟；短板是 any 类型 |
| 架构分层 | **B-** | services/api 无循环依赖；但 data/mock、逻辑内联部署待清 |
| 部署运维 | **B-** | 构建/CI/密钥/迁移一流；缺备份调度/零停机/监控 |
| 测试质量 | **B-** | 量大真实可跑；但鉴权测试是"接线抽查"非越权验证、无覆盖率护栏 |
| 数据库 | **B-** | 头文件链完好；缺 migration/缺索引/N+1 规范化隐患 |
| 文档治理 | **B-** | 契约/theme 有漂移，需随 PR 收口 |

#### 全项目 TOP 问题（跨维度合并，按影响）

**🔴 P0 · 业务真相级（需你确认，非代码能定）**
1. **前端跑在 mock 数据上？** `frontend/src/services/znt`（2463 行）文件头自述"后端已移除，返回空/mock 数据"，却被 10+ 处运行时引用（AIAgents/AgentData/Assessment/TaskAnalysis 页面 + agentDataApi/aiAgentsApi）。若是死代码应删，若真上线则数据风险。**需业务确认真实边界。**

**🔴 P0 · 数据库缺失（确定，必改）**
2. **`task_analyses.agent_id` 完全无索引**（对照 hot_question_analyses/student_chain_analyses 都建了），但主查询 `analysis.py:1170` 按 agent_id 过滤排序 → 全表扫描。需补索引 migration。
3. **死列残留**：migration `20260318_0001` 建了 `znt_assessment_configs.subject`，但模型/后续 migration 从未删它 → DB 里留死列。需补删列 migration。
4. **历史漂移**：`20260711_0001_add_assessment_availability.py` 是自认"repair columns missing from Alembic history"的修复性 migration（列长期存在但缺迁移，2026-07 才追回）。

**🔴 P0 · 安全中危（已确认）—— 前 3 项已修（2026-08-07）**
5. ✅ **SSRF→云元数据**：`model_discovery /discover` → 新增 `_assert_safe_endpoint`（拒非 http(s)/环回/私网/链路本地/保留/169.254.169.254，接入 detect/normalize，ValueError→400）。单测 9 攻击面全拦 ✓。
6. ✅ **公共端点路径穿越**：`public_typst_style.py` + `read_resource_style` 双重校验 key（拒 `/ \ ..`）→ 400/ValueError。攻击路径全拦 ✓。
7. ✅ **refresh token 明文进 localStorage** → **已迁移 HttpOnly cookie**（2026-08-07）：前端 `authTokenStorage.set` 不再写 refresh_token 到 local/sessionStorage；`getStoredRefreshToken()` 返回 null，强制走后端 HttpOnly cookie 续期（后端 refresh 端点本就 `refresh_token or cookie`）。**验证**：新登录后 localStorage `ws_refresh_token=absent`、cookie HttpOnly（JS 不可读）、刷新 /admin/dashboard 会话仍存活（cookie 续期 + DEFECT-1 协同）。374 前端 + 94 后端 tests ✓。

**🟠 P1 · 性能（已证实）—— 部分已修（2026-08-07）**
8. ✅ 课堂学生页 SSE+轮询双跑（ClassroomPanel）→ 加 `sseHealthyRef`，SSE 健康时停轮询，SSE 断开才兜底轮询。type-check ✓。
9. 文章列表每行带完整正文+样式（articles.py）→ **契约敏感**（ArticleListItem.content 为 required，前端 schema 依赖），标记待谨慎处理。
10. ✅ 评测配置列表 N+1 count（assessment/admin.py）→ 新增批量 `get_config_{question,session}_counts`（GROUP BY），列表页 1+2 条 SQL 替代 1+2×N。32 assessment tests ✓。
11. ✅ task_analyses 复合索引 `(agent_id, created_at)` → 已随 DB migration `20260807_0001` 建成。

**🟠 P1 · 架构/前端**
12. **两域无 service 层**（learning 内联 select、ml/book.py 313 行直连 DB），分层示范不一致。
13. **三座上帝文件**：session_service(1386L)、analysis.py(1355L,内联 231 DB)、import_export(894L,0 import services)。
14. **前端 any 414 条**(86% warning)集中 4 大文件；`text-primary` 被 54 文件用(对比度不达标)。
15. `pages/Admin` 33762 行(占前端 73%)，ITTechnology/{agents,ai,ml}/data.ts 3 个超 3k 行数据常量文件。

**🟠 P1 · 部署**
16. **无自动化 DB 备份**（backup-db 仅手动 pg_dump，无 cron/异地）。
17. **零停机缺失** + **F5 回滚用当前镜像降级**（backed 启动自动 upgrade head，回滚后误启会再升回）。
18. **docker.sock 顶级逃逸面**（backend+worker 挂 socket、worker root）。
19. Caddy **仅 :80 裸 HTTP 无 TLS**；`AUTH_TRUST_X_FORWARDED_FOR`:true 可伪造 IP。

**🟡 P2 · 测试/质量**
20. 鉴权测试多为**接线抽查**（仅断言"挂了守卫"），`require_staff/student_or_staff` 零行为级越权测试；**无 pytest-cov/vitest coverage 护栏**；前端 `pages/Admin/**` 被 vitest include 排除在门禁外。
21. 后端 94% 用例纯 mock；无 conftest（75 文件各自手写 _FakeDB）。

**🟡 P2 · 文档**
22. API.md 三 GET 认证列仍标"无认证"（与已改 require_admin 不符，契约漂移）。
23. 死定义 `--ws-radius-xl/--ws-z-toast/.ws-stack*/.ws-grid-cards/.ws-heading-*`；`IT_GAMES_ADMIN_ROLES` 与 `ADMIN_ROLES` 同值冗余。

#### 亮点（无需改，值得肯定）
- 鉴权守卫完整（90 路由/284 端点核对），沙箱(cap-drop ALL/非root/禁网)、上传(白名单+magic-byte+防穿越)、log_redaction 脱敏、Fernet 加密 key、非ce 会话绑定均为业界扎实实践。
- 懒加载/manualChunks/TanStack 全局配置/queryKeys 工厂/三态覆盖、迁移只读预检/单头/CI 断 assert DB 结构 —— 工程化成熟。
- 前端 queryKeys 统一有单测、无裸字符串 key；后端 services(17.6k)≈api(18k) 但无循环依赖。

#### 建议的综合修复优先级
1. **业务确认真假数据边界**（P0-1）→ 决定 znt 是删还是修。
2. **DB 三样**：补 task_analyses.agent_id 索引、删 subject 死列、建"模型改动同 PR 出 migration + autogenerate 漂移 CI"。
3. **安全三样**：SSRF 智能体 base_url 加单封禁、公共 typst 路径净化、refresh token 转 HttpOnly cookie。
4. **性能四项 P0**：停 SSE 兜底轮询、文章列表轻 schema、批量 count、事件驱动弃轮询。
5. 前端 any/对比度治理 + tests 补行为级越权 + 覆盖护栏。
6. 部署：加 DB 备份调度、回滚固定旧镜像、worker 去 root、Caddy TLS。
7. 文档：API.md 契约同步、删死定义、title 收口。

---

### §D 分报告索引

**工程分报告**（`/tmp/wsh-diagnostics/`）：token-hygiene、ui-components、ui-a11y-dark、frontend-build、backend-api、backend-db、deploy-docker、tests-ci（各含逐项证据与命令输出）。

**视觉分报告**（`/tmp/wsh-visual/`）：consistency、color-redundancy、home、public-pages、admin、responsive-reuse。

**运行时证据**：登录页实测——输入框 bg `#E6F5F3` radius 14px vs 提交按钮 solid Teal radius 14px，输入文字 12.25px vs 按钮 14px（同表单字号不一致，已并入 V1 字号统一项）。
