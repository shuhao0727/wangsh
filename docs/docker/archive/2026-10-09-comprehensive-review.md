> 状态：archived
> Owner：project-governance
> 最近复核：2026-10-09
> 生成方式：对当前工作区代码、测试、门禁和两份前序报告执行独立复核，结论基于实际命令输出
> 归档整理：2026-10-19（仅索引和历史边界复核）
> 当前入口：[项目整理台账](../plans/project-consolidation.md)；UI 视觉以[嵌入式规范](../frontend/EMBEDDED_UI_STYLE_GUIDE.md)为准。

> 历史说明：本文不再是当前计划或唯一问题台账。正文中的完成、待办、版本和验证标记均保留为当时快照；未复核事项不能因归档自动关闭。

# 2026-10-09 工作区综合审查报告

本报告同时审查两件事：**一、当前未提交改动的代码质量与 bug 情况；二、《WangSh 近期修改与颜色风险审查报告》（审计 agent 生成）的准确性。**

---

## 一、关于审计报告的准确性判定

审计 agent 的报告整体可信，定性结论没有问题，但有两处重要遗漏，导致它说的"前端工程复验全部通过"不完整。

**属实的部分：**
- HEAD `6f4fd9c`，134 个已跟踪改动，工作区路径数量（审查期间增加至 185）
- Vitest 127 个文件 / 1101 项全部通过
- type-check、token:check:ci（2108/0）、ui:token-values:ci（215/0）、alpha/dead-class 门禁全部通过
- PDF worker 修复在 `PdfCanvasVirtualViewer.tsx:108`，确实传入了副本
- Informatics Detail 9 项状态测试、Typst 外壳 10 项状态测试，计数一致
- 3 处文档事实漂移（全站计划 1298 行、TEST_STATUS 第 30 行、版本号）确认存在
- "不能宣布全站完成或可以发布"、"后端独立审核"等定性判断准确

**不准确的部分：**

1. 报告说"前端工程复验全部通过"，但它没有运行 `ui:audit:ci` 和 `ui:spacing:ci`。这两条门禁当前为红，会阻断 CI。报告应写"所运行的 9 项通过，两条 UI 门禁未运行且当前失败"。

2. 报告把 63 项后端失败描述为"可能是环境因素"，没有给出具体原因。实际上失败原因已经很清楚：`test_conversation_list_isolated.py` 要求环境变量 `CONVERSATION_TEST_REDIS_URL`，没有设置就直接抛 RuntimeError，属于该文件新增的测试设计要求，不是代码回归。设了正确的环境变量后，63 项全部通过。剩下 1 项（`test_metrics_router_has_admin_auth`）是权限设计分歧，下文详述。

3. COLORS.md RGB 示例错误这一点报告确实指出了，是准确的。

---

## 二、未提交代码的 Bug 与问题清单

### 已确认的 Bug

#### Bug 1：`/system/ai-agents-metrics` 权限级别与测试不一致
- **位置**：[`backend/app/api/endpoints/system/metrics.py:74`](../../../backend/app/api/endpoints/system/metrics.py#L74)
- **表现**：端点用 `Depends(require_admin)`，但 `tests/system/test_metrics.py:126` 断言该路径必须是 `require_super_admin`，导致测试持续失败。
- **引入时间**：2026-10-01 提交 `a284ba2`，与当前未提交改动无关。
- **影响**：`/system/ai-agents-metrics` 目前任何管理员都能访问 AI 指标监控数据，比其他 `/metrics` 端点宽松一级。这是设计决策还是疏漏需要明确。
- **修复方向**：要么把端点改回 `require_super_admin`，要么更新测试，选哪个取决于这个端点的访问控制意图。

#### Bug 2：`COLORS.md` RGB 示例值错误
- **位置**：[`frontend/src/styles/COLORS.md`](../../../frontend/src/styles/COLORS.md) 第 278 行
- **表现**：RGB 示例写的是 `54 119 111`（旧色 `#36776F`），但代码里 `index.css` 实际值是 `15 118 110`（`#0F766E`）。
- **影响**：代码本身正确（192 个 fallback 与 index.css 零漂移），但文档误导读者。任何参照文档手写颜色的人会得到错误的值。
- **修复**：改一行，把 `54 119 111` 改为 `15 118 110`。

#### Bug 3：`ui:spacing:ci` 门禁失败，4 处新增数字间距
- **位置**：[`frontend/src/pages/Admin/Informatics/TypstNoteEditor.tsx`](../../../frontend/src/pages/Admin/Informatics/TypstNoteEditor.tsx)（1 处新增）、[`frontend/src/pages/Informatics/Detail.tsx`](../../../frontend/src/pages/Informatics/Detail.tsx)（3 处新增：`mb-3`、`mt-1`、`mt-2`）
- **表现**：`numeric_spacing_uses` 从基线 1382 增加到 1386，`ui:spacing:ci` exit 1。
- **影响**：会阻断 CI；这批改动在语义间距迁移进行中时引入了新的数字间距，与计划方向相反。
- **修复方向**：把 4 处改成对应的语义 token（例如 `p-3` → `p-sm`，或检查 SPACING.md 里的对应值），再确认门禁通过。

#### Bug 4：`ui:audit:ci` 基线过期
- **表现**：新建的 11 个颜色测试文件让 test scope 命中数从 9 增加到 20，超过基线。另外 `Xbk.css` 的 token 迁移让命中数从 4 增加到 5，超过基线。
- **性质**：test scope 增加是新增文件的合理结果，不是错误；Xbk.css 命中增加也是迁移工作的正常产物。但门禁本身没有区分"test 文件命中"和"业务文件命中"，所以会 exit 1。
- **修复方向**：需要判断这些新增命中是否都合理，再用 `npm run ui:audit -- --adopt` 采纳新基线。不要直接 `--adopt` 而不先审查每一条增量。

### 设计层面的待确认问题

#### 问题 1：`health.py` 的 `degraded` 语义变化

未提交的 `health.py` 改动引入了一个新行为：`degraded`（Redis 不可用但 DB 和视图合同正常）时返回 **HTTP 503** 而不是 200。这是正确的设计——HTTP 语义和 readiness 语义对齐了——但它对现有的 Compose 健康检查有直接影响。

旧行为：`degraded` → HTTP 200，Compose probe 通过，下游服务启动。
新行为：`degraded` → HTTP 503，Compose probe 失败，下游服务等待。

这意味着如果 Redis 在 backend 启动时短暂不可用，整个 Compose 栈会卡住等待。Compose 文件里 backend 已经 `depends_on: redis: condition: service_healthy`，所以正常路径下不会有问题；但 Redis 在 backend 运行期间重启时，会导致 backend 的 `/health` 连续返回 503，其他健康检查依赖 backend 的服务可能因此被认为不可用。

这个行为变化是有意的，文档和注释里也写了，只是需要确认 Compose 的 probe 重试间隔（10s × 30 次）是否足够覆盖 Redis 短暂重启的窗口。

#### 问题 2：`test_conversation_list_isolated.py` 的新测试设计要求

新增的测试文件要求环境变量 `CONVERSATION_TEST_REDIS_URL` 且必须指向本地（localhost/127.0.0.1/::1），否则抛 RuntimeError。这是刻意设计——避免测试误连生产 Redis——但它意味着：
- 在标准 CI 环境里如果没有 Redis，这 63 项测试会整块失败而不是跳过
- 本地开发者如果没设环境变量，运行完整测试套件会看到 63 项失败

确认一下 CI 环境是否已配置 `CONVERSATION_TEST_REDIS_URL`，或者是否需要在 pytest 配置里标记这些测试为需要 Redis 的，方便在没有 Redis 时用 `-m "not requires_redis"` 跳过。

### 其他风险（不是 bug，但需要在提交前处理）

#### 探针脚本安全风险
`frontend/` 根目录下有 20+ 个一次性探针脚本，且审查期间数量还在增加（从 51 增到 60 个未跟踪文件），说明有其他会话或 agent 在并行写入。其中 `xbk_write.mjs`、`xbk_roundtrip.mjs`、`xbk_probe.mjs`、`agent_probe.mjs`、`pool_probe.mjs`、`load_probe.mjs`、`sse_probe.mjs`、`agent_leak.mjs`、`sse_err.mjs` 包含 POST/PUT/DELETE/PATCH 请求。`login_probe.mjs:20` 有非空密码环境变量回退值（`process.env.ADMIN_PW || "<值>"`）。这些脚本不能直接提交到产品代码目录：一是写操作可能意外指向真实环境，二是带回退密码的文件不应进版本库。建议移到项目外的临时目录（如 `/tmp/wangsh-probes/`），如果密码是真实在用的，安排轮换。

---

## 三、各工作线综合状态

### 前端色彩系统

**实际已完成**（代码和测试都在）：
- CSS token 分层（表面/文字/交互/边框/语义状态/图表/专业模块）
- 运行时颜色桥接：`cssTokens.ts`、`monacoTheme.ts`、`flowPalette.ts`、`mermaidTheme.ts`、`markmapTheme.ts`、`xtermTheme.ts`
- ECharts/Radar/Canvas 图表接入
- Monaco/DiffEditor 专用浅色主题
- 流程图 SVG 和 DOT 导出共享 palette
- Markdown/KaTeX/Mermaid/Markmap 外壳接入
- Typst/PDF 改外壳不覆盖作者内容
- 全站语义边界分级：L0 无边框 / L1 弱分隔 / L2 控件边界 / L3 浮层隔离
- 192 个 fallback 值与 index.css 零漂移
- 全部语义 token 对比度满足 WCAG AA（最低 primary/success/warning 5.02:1）

**尚未完成**（不能宣称通过）：
- R1/R2 真实浏览器页面验收（hover/active/focus/error/permission/loading 完整矩阵）
- R3–R8 各页面族
- S4 终端按用户决定 DEFERRED
- 移动端 PDF 非等比、长图例裁切
- 真实业务链：编译/导出/保存/鉴权/跨浏览器

**门禁状态（实测）：**

| 门禁 | 结果 |
|---|---|
| type-check | ✅ 通过 |
| Vitest 1101 项 | ✅ 通过 |
| token:check:ci | ✅ 2108 处 / 0 未定义 |
| ui:token-values:ci | ✅ 215 token / 0 对比度失败 |
| ui:alpha:ci | ✅ 通过 |
| ui:alpha:dead-classes:ci | ✅ 通过 |
| ui:dead-layout:ci | ✅ 通过 |
| ui:verify:ci | ✅ 通过 |
| ui:migration:ci | ✅ 通过 |
| Markdown 合同 | ✅ 168 文件 / 566 链接 / 0 缺失 |
| lint | ✅ 0 错误（460 warnings） |
| build | ✅ 通过 |
| **ui:audit:ci** | 🔴 **失败**（见 Bug 4） |
| **ui:spacing:ci** | 🔴 **失败**（见 Bug 3） |

### 后端 Alembic 迁移与启动

**已完成，质量高**：
- `alembic/env.py`：PostgreSQL advisory lock 串行化并发迁移 runner，用 `pg_advisory_xact_lock`，事务级自动释放，key 固定为 `0x57534D4947`
- `alembic/versions/f1a2b3c4d5e6`：用 DROP+CREATE 重建 `v_conversations_with_deleted`，迁移前保存 owner/ACL/security label，重建后恢复，任何失败都回滚整个事务
- `alembic/versions/20260211_0004`：修复全新库升级路径——加列存在性条件，避免 `is_archived` 列不存在时视图创建失败中断整条 `upgrade head`
- `startup.py`：移除运行时 `_ensure_views()` DDL，改为只读 `check_conversations_view_contract()`，不满足则启动拒绝
- `health.py`：`readiness_check()` 统一合同，degraded 返回 503（见设计问题 1）
- `migration_state.py`：AST 解析迁移文件，构建有向图，校验无环无缺失父节点

**待确认**：
- 后端 63 项测试（在设置 `CONVERSATION_TEST_REDIS_URL=redis://127.0.0.1:6379/15` 后全部通过，见问题 2）
- `test_metrics_router_has_admin_auth` 权限设计分歧（见 Bug 1）
- 新 migration 在已有生产库上的升级路径尚未跑真实 PostgreSQL 验证

### 文档

**已更新并与代码同步的**：
- AGENTS.md 色彩表（token 值已对齐 index.css）
- RELEASE_NOTES.md（S4–S9 专项、PDF worker 修复、健康检查变化）
- DEPLOY.md（health readiness 合同说明）
- COLORS.md（95% 正确，除 RGB 示例错误外）

**仍有事实漂移的**（需要修正，一行代码级别的改动）：

| 位置 | 问题 | 正确表述 |
|---|---|---|
| `frontend/src/styles/COLORS.md:278` | RGB 示例是旧值 `54 119 111` | 应为 `15 118 110` |
| `docs/docker/plans/2026-10-06-color-system-comprehensive-migration-plan.md:1298` | R2-C 写"待做" | 应为"工程验证通过，实景验收未闭合" |
| `docs/docker/testing/TEST_STATUS.md:30` | "Home/Informatics 没有本批专属测试" | Home 仍无；Informatics 已有 9 项状态测试（mock 层），应分开表述 |
| `docs/docker/testing/TEST_STATUS.md` 版本头 | 写 2.1.2 | 当前 package.json 是 2.1.3 |

---

## 四、提交前必须做的事

按优先级排：

1. **探针脚本**：停止往 `frontend/` 写新探针，把现有探针移到 `frontend/` 以外，检查是否有真实口令需要轮换。

2. **修 Bug 3**（ui:spacing 红）：把 4 处数字间距改成语义 token，让门禁恢复绿。

3. **审查 Bug 4 再采纳基线**：逐条核查 `ui:audit` 增量，确认合理后再 `--adopt`。

4. **修文档错误**：上表 4 处，每处都是一行改动。

5. **定下 Bug 1 的权限决策**：`/ai-agents-metrics` 是 `require_admin` 还是 `require_super_admin`，改代码或测试。

6. **后端 CI 环境配置**：确认 CI 里有 `CONVERSATION_TEST_REDIS_URL`，或为 Redis 依赖测试加 pytest marker。

7. **按 5 组分批提交**（见前序报告建议），不要用一个大 UI commit 混入迁移和探针变更。

---

## 五、被审计报告的结论更正

原报告最终结论"近期修改确实推进了色彩治理、内容保护、渲染器适配、PDF 生命周期和状态覆盖；当前前端工程状态健康"——这个方向是对的，但需要加上：

**补充更正**：前端工程状态并非完全健康，有 2 条门禁当前失败。后端 63 项测试失败原因是环境变量未设，不是代码回归，设了之后全通过；但这也说明这批测试对环境有新的要求，CI 需要配套更新。`test_metrics_router_has_admin_auth` 是权限设计分歧，需要一个明确决定。
