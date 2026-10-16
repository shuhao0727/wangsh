# 当前测试状态

> 状态：active
> Owner：testing
> 当前版本：2.1.2
> 最近更新：2026-10-16
> 说明：本文件是当前测试事实的唯一汇总入口；阶段报告只引用本页，不复制新基线。


## 2026-10-16 契约与文档门禁修复（本次工作区，未提交）

- **范围：** 只改 `scripts/`、`docs/` 与 `.github/workflows/` 下相关文件；未 commit、未 push、
  未触碰 stash。
- **CI 门禁路径修复：** `968ba9f` 把 `ci-quality.yml` backend-pytest job
  （`working-directory: backend`）内的 8 处 `scripts/X.py` 改成 `backend/scripts/X.py`，
  造成 `backend/backend/scripts/...` 双重前缀（CI 第一步 file not found）。本轮改回
  `scripts/`（check_python_governance×4、check_migration_state、bootstrap_db×2、
  check_changed_lines_coverage）；`pythonlab-pr-runtime.yml` 迁移步骤的 3 处同类双重前缀一并
  改回。契约测试期望值不变，`node --test scripts/workflow-contracts.test.mjs` **60 passed**。
- **env-consistency 移植：** CI repo-config 引用的 `scripts/env-consistency.test.mjs` 与
  `scripts/check-env-consistency.mjs` 在 main 缺失（CI 直接挂）。本轮从
  `codex/release-2.2.0-prep` 移植并按当前 `.env.example` 校准；
  `node --test scripts/env-consistency.test.mjs` **6 passed**。
- **Markdown 合同：** `node scripts/check-markdown-contracts.mjs` **exit 0** —
  `135 files / 507 links / 0 missing`。此前 14 条错误全部修复：
  - 7 条断链改指真实文档或删除引用行：`DATA_ARCHIVING.md`×3
    （Celery→`analysis/ASYNC_ANALYSIS.md`、数据库→`DATABASE_PERFORMANCE_GUIDE.md`、
    监控→`operations/MONITORING.md`）、`IMPLEMENTATION_SUMMARY.md`×1
    （数据库→`DATABASE_PERFORMANCE_GUIDE.md`）、`plans/README.md`×3
    （目标文件只活在本地 `stash@{0}`，从未 commit，索引行删除）；
  - 6 条生命周期元数据补齐：`2026-10-09-comprehensive-audit-final-report.md`、
    `2026-10-09-verification-report.md`、`2026-10-10-file-organization-findings.md` 各补
    `> 状态：reference` 与 `> Owner：project-governance`；
  - 门禁盲区修复：`check-markdown-contracts.mjs` 的 `git ls-files` 补
    `-c core.quotepath=false`，两个中文名 md 自本轮起纳入合同检查
    （此前被八进制转义后静默丢弃）。
- **索引一致性：** `docs/docker/plans/README.md` 表格改为如实列出目录内全部 11 个文档
  （此前 3 条指向 stash-only 文件、4 条声称已移除但文件实际仍在）。
- **历史数字更正：** 2026-10-04 一节（见下）声称的「11 条错误已清零」「6 条断链已修复」
  对应改动从未提交，已按实测更正为如实说明。
- **Markdown 合同测试：** `node --test scripts/markdown-contracts.test.mjs` 全 pass。
- **行尾空白：** 清理 `docs/` 下 12 个文件的 `git diff --check` 行尾空白（只删空白字符，
  不改正文内容）；`git diff --check HEAD` 无输出。
- **边界：** 未 commit、未 push；本轮未改动后端/前端业务源码。

## 2026-10-04 UI 文档重制与门禁转绿（更正：对应修复从未提交，原结论不成立）

- **更正说明：** 本节原始版本声称 `node scripts/check-markdown-contracts.mjs` exit 0、
  `165 files / 489 links / 0 missing`、「11 条错误已清零」「6 条断链已修复」。经 2026-10-15
  全项目核查（[2026-10-15-project-audit.md](../2026-10-15-project-audit.md) §3.4/§八）实测：
  这些修复**从未出现在任何提交中**；截至 2026-10-15，仓库内 Markdown 合同仍为 14 条错误
  （7 条断链 + 6 条生命周期元数据缺失 + 1 条过期摘要），当时「门禁已绿」的结论不成立。
  本节原始数字与结论仅作历史保留，不再作为当前状态依据。
- **原始记载（未提交、未经核验）：** 移除 18 份失真 UI/运维文档、抢救 7 项唯一内容到
  owner 文档、`ui:audit:ci` 824→822、`npm run type-check` exit 0，以及 6 条臆想路径断链的
  改链方案（`docs/database/`、`docs/architecture/`、`docs/development/DATABASE.md`、
  `docs/docker/CELERY.md`、`docs/docker/deploy/MONITORING.md`、`.../CACHE_IMPLEMENTATION.md`
  经 `git log --all` 查证从未存在）。上述内容均未落地到仓库，与当前实际状态无关。

## 2026-09-28 AI伙伴页面文案精简（未发布）

- **范围：** 删除重复介绍、英文装饰标题与“本地交互模式”字样；缩短任务引导和检查说明，
  选型规则默认折叠。保留按钮、表单、校验、关键风险提示及评分数据发送说明，不改业务逻辑。
- **自动化：** `npm run type-check`、`npm run build:ai-partner` 通过；AI伙伴测试
  4 文件 / 55 passed。新增文案与操作保留回归，首次断言发现状态栏会被身份通知覆盖，
  将数据发送说明保留在可展开的数据说明中后复跑通过。构建仍有既有 chunk 大小提醒。
- **桌面交互：** 系统 Chrome + Playwright，1440×1000、1280×800，10 组检查通过。
  覆盖页面/canvas、精简文案、规则展开、三维工具、左上角榜单、评分与凭证上榜、
  修改作废/迟到响应、搜索重置、草稿保存恢复、报告与JSON下载；无相关console/pageerror。
  评分使用隔离接口夹具，不代表真实模型验收；本轮不测手机。
- **证据：** 外部可视化目录 `ai-partner-copy-simplified/`，含 `ui-results.json`、
  `desktop-simplified.png` 和实际导出文件；临时脚本与构建日志位于
  `/tmp/ai-partner-copy-20260928/`。预览保持 `127.0.0.1:16610`。
- **边界：** 不修改后端、模型配置、教学原源或发布文件；未打包Docker镜像、commit、push或部署。

## 2026-09-28 AI伙伴智能评分与左上角榜单（未发布，桌面隔离验证）

- **范围：** 在前轮临时榜单基础上，改为后台模型 API 四维评分（价格性价比、任务完成度、
  选择合理性、设计验证与风险，各 25 分）；榜单移至左上角、简化文案并避让标题。客户端只提交
  部件 ID 与设计材料，使用服务器一次性评分凭证上榜；修改方案/换号作废旧结果。
- **前端：** 完整 `npm run build` 通过（主站与独立页类型检查及静态构建）；
  `npm run test:ai-partner` 为 4 文件、54 passed，共享 `api.auth-race.test.ts` 为 52 passed。
  既有 Browserslist、PDF.js eval、较大 chunk 警告不影响构建通过。
- **后端：** 整个 `backend/tests/ai_partner` 收集 evaluation 61 项与 leaderboard 58 项。
  fakeredis 模式 118 passed / 1 skipped（仅真实 Redis 用例），独立真实 Redis 模式
  119 passed / 0 skipped；均无失败，6 条既有 Pydantic 弃用警告。覆盖任务 ID/目录计价、
  模型结构验证、超时/限流/并发、轮次/身份、凭证过期/盗用/重放、伪造分数、无配置/存储故障。
- **桌面浏览器：** 使用系统 Google Chrome + Playwright，在 1440×1000、1280×800 验证。
  UI/API 夹具 8 组通过；真实产品路由＋独立 Redis、模拟身份/模型的联调 7 组通过。
  后者覆盖签发评分、双用户互见、盗用/重放拒绝、伪造分数 422 及同名用户分离。
  上述均无相关 console error/pageerror；本轮不做手机模拟。
- **未配置模式：** 本地预览恢复真实未配置路径，评分返回 503 且 `Cache-Control: no-store`，
  不显示替代分数，上榜按钮禁用，独立轮次榜单为空；左上按钮不遮挡标题。
  预期存在一条 HTTP 503 资源日志，不存在 pageerror。
- **证据与边界：** 本轮证据位于外部可视化目录 `ai-partner-ai-scoring/` 的
  `ui-results.json`、`live-results.json`、`unconfigured-results.json` 及桌面截图；后端两模式
  runner/日志位于 `/tmp/ai-partner-llm-backend/`。预览为 `127.0.0.1:16610`，隔离后端
  `51641`、专用 Redis `51640`。**真实供应商模型 API 与真实 JWT 登录尚未验收**；
  模型 fixture 仅验证接口联动，不能代表智能评分质量。不访问生产数据库或模型。
- **合同门禁：** 构建/工作流合同合计 68 passed；Markdown 派生摘要为
  `113 files / 448 links / 0 missing`，Markdown 合同 10 passed，`git diff --check` 通过。
- **发布边界：** 未打包 Docker 镜像、未 commit/push、未部署；真实模型需要后台配置并绑定
  `AI_PARTNER_SCORING_AGENT_ID`，生产 Compose 透传等发布准备仍按部署文档另行验收。

## 2026-09-28 AI伙伴临时互动榜（未发布，本地隔离验证）

- **范围：** 集成新版三维教学源码与浮动共享榜单，保留五维评分与课堂记录门槛；使用平台
  身份、每人最高分、同分并列及 Redis 固定期限，不新增 DB 表、migration 或管理员页面。
- **前端：** `npm run type-check` 通过；`npm run test:ai-partner` 为 4 文件、42 passed；
  既有 `api.auth-race.test.ts` 为 52 passed。未将这些限定测试表述为主站全量测试。
- **后端：** 同一套 58 项测试分别在 fakeredis Lua 和独立真实 Redis 模式通过，不是
  116 项独立测试；覆盖认证/guest拒绝、严格参数、身份与轮次冲突、最高分、并列排名、
  固定到期及 deadline tombstone、限流、no-store 与 Redis 故障关闭。复审补齐
  未捕获路由/认证依赖异常的统一 500 no-store 响应，新增 4 项用例并在两模式重跑通过。
- **源码与构建：** 教学原目录 11 项源文件哈希与导入清单一致；7 项未改视觉/规则文件
  与源文件逐字节一致。完整 `npm run build`（双类型检查、主站、独立页）通过；构建路径
  核验 258 个文件，两份入口及依赖资源共 8 项临时 HTTP 检查均为 200、内容匹配。
  已知非阻塞 warning：Browserslist 数据较旧、既有 PDF.js `eval`、较大 chunk；AI伙伴 JS
  约 692.4 kB。未通过放宽阈值或改依赖掩盖 warning。
- **真实浏览器：** 系统 Google Chrome + Playwright，桌面 1440×1000、手机 390×844，
  共 14 组检查通过；页面标题/三维 canvas/非空/无错误覆盖层、真实点击选型→测试→课堂
  记录→评分→提交、独立用户互见与自动刷新、同名不同ID分离、真实同分 `1,1,3`、
  低分不覆盖、关闭停止轮询、手机浮窗不越界及 Escape 恢复焦点、换号清空和草稿隔离、
  匿名不读取实名榜均通过；已认证会话无 console error 或 pageerror。
- **构建产物浏览器复验：** 在 `127.0.0.1:16610` 用 `vite preview` 提供本次正式静态
  构建产物，重复同一套 14 组 Chrome 桌面/手机检查全部通过、无已认证会话运行时错误；
  已加载最终 no-store 补丁的隔离后端再次复验通过。
  这是相同场景的第二运行模式，不计为额外 14 个独立场景。证据为同一外部目录下的
  `ai-partner-production-smoke/verification.json` 及桌面/手机截图；并非 Docker 或生产验收。
- **隔离边界：** 预览 `http://127.0.0.1:16608/games/ai-partner/index.html` → 本地后端
  `51641` → 专用 Redis `51640`；使用模拟身份及真实榜单 API/Redis，**未验证真实 JWT
  登录全链路**，不访问生产 DB/Redis。Browser plugin 不可用，按测试 skill 使用 Playwright。
  未测其他浏览器、生产容器、真实全班负载；到期/故障在后端测试验证，不冒称浏览器验收。
- **证据：** 外部 `ai-partner-verification/verification.json`、`desktop.png`、`mobile.png`，
  位于 `/Users/wsh/.codex/visualizations/2026/09/27/01a0e238-eeb8-7632-be78-1af588c3909e/`。
  初次 UI 脚本因错误选择器超时，修正脚本后重跑通过，未为此修改产品逻辑。
- **构建合同：** `frontend/scripts/docker-build-context.test.mjs` 的 8 项及
  `scripts/workflow-contracts.test.mjs` 的 60 项，合并运行 68 passed；未执行镜像构建。
- **文档门禁：** 本批 Markdown 派生摘要为 `114 files / 452 links / 0 missing`，合同测试 10 passed；
  首次因当前摘要过期失败，同步真实统计后复跑通过，不改历史批次统计。
- **发布边界：** 未打包 Docker 镜像、未 commit/push、未部署，原 `2.1.2` 发布记录不变。

## 2026-09-27 公开课静态页 v2.1.2 发布与生产验收（当前工作区）

- **范围：** 信息技术页入口文案从“小游戏”改为“公开课”；`/games` 新增“召唤一名AI同学”
  公开课卡片；保留 `/games/lock-cracker` 原有入口、功能开关和访问逻辑。公开课静态构建产物
  以同源顶层页面 `/games/ai-partner/index.html` 集成，不使用 iframe。
- **前端验证：** `npm run type-check`、`npm run test`（99 个测试文件、712 个测试通过）和
  `npm run build` 通过；正式构建产物包含公开课 HTML、JS、CSS 和 favicon。部署/工作流合同测试
  `node scripts/workflow-contracts.test.mjs` 为 `60 passed / 0 failed`，版本一致性检查和
  `git diff --check` 通过。
- **Docker 模拟：** 使用正式镜像 `shuhao07/*:2.1.2`、隔离端口 `16609` 启动生产模拟，
  项目自带生产 smoke 全部通过；`/games`、公开课三维 canvas、密码锁页面、JS/CSS MIME 和
  缺失资源 404 均通过。
- **镜像与 release-set：** 六个 `linux/amd64` 业务镜像已构建并推送；
  `release-set-2.1.2.txt` 按 Docker Hub registry manifest digest 生成并在本地校验。服务器直连
  registry manifest 超时，配置的镜像 mirror 拉取出现 EOF，因此没有在服务器源码构建或依赖不确定的
  registry 重拉；已将本地已验证镜像通过 SSH 传输到服务器，并按 `--pull never` 运行。
- **生产验收：** `shuhao-Virtual-Machine` 的六个业务容器均为 `2.1.2` 且 healthy；详细健康检查
  为 `healthy`（API、PostgreSQL、Redis、frontend、gateway、Typst worker、PythonLab worker
  全部通过）。服务器本机自检确认 `/api/health`、`/games`、`/games/ai-partner/index.html`、
  `/games/lock-cracker` 为 200，公开课 JS/CSS MIME 正确，缺失资源为 404；公开课 HTML/JS/CSS
  响应 SHA-256 与本地正式静态源一致。未执行数据库迁移，旧 `.env` 与 `release-set.txt` 已备份。

---

> 2026-09-20 及更早的测试状态历史已归档至 [TEST_STATUS-history.md](TEST_STATUS-history.md)。
