# 前端脚本说明

> 历史脚本清理记录：`docs/scripts/ARCHIVE_INDEX.md`

`frontend/scripts/` 只保留当前仍接入 npm 命令、CI 或生产烟测链路的脚本。

## 当前入口

- `copy-pyodide.js` - `predev` / `prebuild` 复制 Pyodide 资源；仅在目标目录包含
  当前依赖版本 marker 和全部非空核心文件时跳过
- `bundle-budget.mjs` - `build:check` 包体与最终产物门禁；读取 Vite `build/.vite/manifest.json`，递归扫描 `build/assets/`，将独立 Worker JS 和复制到 `build/pyodide/` 的生产运行时纳入总量，并确认 Mindmap 本地运行时缺失、favicon 与 KaTeX/Monaco 正式字体存在
- `token-check.mjs` - `token:check:ci` CSS token 完整性门禁；检查 `src/` 中所有 `var(--ws-*)` 引用是否在 `src/styles/index.css` 定义
- `auth-replaced-login-smoke.mjs` - 同账号二次登录踢下线提示专项生产烟测；先等待提示文案在页面正文可见，再判定 `PASS`，避免仅凭 storage/detail 回放通过而 UI 未渲染的误判
- `pythonlab-debug-smoke.mjs` - PythonLab 运行/调试 UI 专项烟测
- `prod-smoke-ui.mjs` - 生产烟测的浏览器 UI 步骤入口；页面加载成功但预期操作控件
  缺失时记录为 `WARN`，不会误记为 `PASS`
- `ui-audit.mjs` - UI 审计主脚本（**口径：px 硬编码**，含 `gap-[24px]` 这类 arbitrary 形式）
- `ui-audit-baseline.json` - UI 审计基线
- `ui-spacing-metrics.mjs` - **数字间距类 vs 语义 token 间距类**计数与迁移率门禁（B5 验收口径）
- `ui-spacing-baseline.json` - 间距迁移基线（只降不升）
- `ui-token-values.mjs` - **颜色 token 值校验**（G6）：与 `token-check.mjs` 互补——后者只证明
  `var(--ws-*)` **引用有定义**，本脚本证明 `index.css` `:root` 里**定义的值没被偷改**。
  三件事：① 值快照 ratchet（**值变更即红**，须明确审查接受）；② `xxx` 与 `xxx-rgb`
  三元组一致性（先解析颜色及 RGB 的整值 `var(--ws-color-*)` 别名链）；③ WCAG 对比度
  断言（强调色三场景 ≥4.5:1；正文按浅色表面/页底，代码文字按 `code-bg`，反白文字按
  `primary-fill`；专业模块沿别名链保留首个既有非模块语义角色，公共强调色不能因指向背景而免检）。
  `values` 保留原声明用于 ratchet，`resolved_values` 仅用于校验；缺失引用、循环别名和
  非法值计入 `resolution_errors`，使 `--ci` 失败并拒绝 `--adopt`；RGB/alpha 不容许
  畸形数值截断或越界，RGB 投影即使缺配对颜色也先核语法和范围。背景/装饰/半透明跳过项
  分别记录原因，不代表实际渲染对比度已验收，也不是完整 CSS 引擎。
  只检测只报告，**不改颜色**——改色需 Lead 决策。
- `ui-token-values.test.mjs` / `ui-token-values.aliases.test.mjs` - 颜色值、角色、别名链及
  CLI 正负例；负例先断言注入命中，CSS 和测试基线使用外部临时夹具，不改真实 baseline。
- `token-value-baseline.json` - 颜色 token 值基线；CLI 用 `--adopt` 生成全表，分批治理只按
  审查后的 token/旧值/新值名单精确补丁更新，保持阈值和失败集合。快照接受不等于消费者
  视觉合格；当前检查不覆盖每个实际底色组合（如小字叠 `surface-2`），这类问题另按页面处理。
- `ui-alpha-modifiers.mjs` - **透明度修饰符门禁**（G9）：Tailwind v3 只为静态色生成 `/N` 规则，
  颜色映射到 `var(--ws-color-*)` 时 `bg-primary/10`、`border-border/40` **不生成任何 CSS**（静默失效）。
  两条检查：① `--ci` 报错不支持 alpha 的色名 + `/N`（支持 `hover:`/`sm:hover:`/`data-[state=open]:` 等变体前缀）；
  ② `--dead-classes` 把 src 里的颜色类交给 Tailwind 实编译，报出**完全不生成 CSS 的死类**
  （正是它发现了 `border-border-secondary` 113 处失效）。死类检查需跑一次 Tailwind（数百毫秒），
  故默认关闭、不影响退出码，建议单独 job 而非每次 lint 都跑。
- `ui-visual-routes.json` - UI 审计页面清单
- `ui-page-workflow.mjs` - 单页治理工作流（G3 重写：产出即受 `ui-verify-gate` 契约约束，
  报告写入 `docs/docker/testing/ui-page-reports/`）
- `ui-migration-metrics.mjs` - UI 迁移指标 + **不变量门禁**（G7 改造，2026-10-05）。
  门禁三项：`message_calls`（antd 的 `message.*`）、`antd_import_files`、
  `ant_design_icons_import_files`，均须恒为 0。前者证明 Toast 全量走项目约定的
  `showMessage`（当前 501 处映射、0 处绕过）；后两者是**哨兵** —— antd 迁移早已
  完成且依赖已移除，一旦有人引回来计数立刻 > 0 并红灯。
  `tsx_ts_files` 与 `show_message_calls` 是**观测值**，不设门禁（随代码量自然变化，
  设门禁会让每次加页面都要 `--adopt`，门禁退化成噪音）。
  用法：`ui:migration:metrics`（打印）/ `ui:migration:ci`（比对）/ `ui:migration:adopt`（采纳，拒绝放宽）。

## 对应 npm 命令

```bash
npm run ui:audit
npm run ui:audit:ci
npm run ui:spacing
npm run ui:spacing:ci
npm run ui:token-values
npm run ui:token-values:ci
npm run ui:alpha
npm run ui:alpha:ci
npm run ui:alpha:dead-classes
npm run ui:page:report -- --route /ai-agents
npm run ui:page:verify -- --route /ai-agents
npm run ui:migration:metrics
npm run build:check
npm run pythonlab:smoke
npm run token:check:ci
npm run test:scripts
```

元信息专项测试：在 `frontend/` 下运行 `npm test -- src/hooks/useAppMeta.metadata.test.tsx`，
验证本地构建版本、环境标签及无网络请求行为；该文件已显式纳入默认测试收集。

后台交互与权限专项：在 `frontend/` 下运行
`npm test -- src/layouts/AdminLayout.mobile.test.tsx src/pages/Admin/Dashboard/index.permissions.test.tsx`。
这两个文件显式纳入默认测试收集；组件测试检查交互状态及按身份取数，
不能替代真实浏览器中侧栏层级、指针命中、版本标签裁切和网关权限的验收。


## 生成产物与配置文件

- `ui-audit-baseline.json` 是 UI 审计基线文件，属于受控生成产物；只有在确认 UI 变化符合预期后才更新基线。刷新时必须先审计当前 `HEAD`，新基线不得高于修复前快照，不能用抬高阈值掩盖本轮新增命中。
- **基线是等式，不是上界（ratchet 双向）**：`ui:audit:ci` 在实测 **高于** 基线（回归）与实测 **低于** 基线（基线松弛/stale）时**都** exit 1。
  实测低于基线时脚本会打印可复制的收紧命令 `npm run -s ui:audit -- --ci --adopt`；`--adopt` 对每个键取
  `min(基线, 实测)`，任何键想要变大都会被拒绝并 exit 1，因此**不存在通过该命令放宽阈值的路径**。
  确有必要的放宽容差必须在 `reference.ratchet_debt` 中登记 key、HEAD 值、当前值与理由。
  比较覆盖四层：`max_total_hits` / `max_by_type`（四类分别 ratchet）/ `max_by_scope` / `max_route_hits` + `by_file` 全量。
- `by_scope` 分口径（计划 §3.1）：路线桶回答"属于哪个页面"，scope 桶回答"责任人是谁"。
  `page` = `src/pages/**`（含同目录 .css）；`infrastructure` = 其余 `.css`（全局样式表）；`shared_components` = 其余非 pages 代码；`test` = `*.test.*` / `*.spec.*`。
  `ui-visual-routes.json` 的 12 条 key route 与 `key_route_hits` 是 `by_route` 的**子集**，全量以 `by_route` / `by_file` 为准。
- `ui-visual-routes.json` 是 UI 审计路由清单；新增、删除或重命名页面后必须同步更新。
- Vite 生产构建必须生成 `build/.vite/manifest.json`；包体预算从 `isEntry` 沿静态 `imports` 计算 Entry，从 `dynamicImports` 沿动态分支计算 Deferred，同一 chunk 同时被静态和动态引用时按 Entry 计，Worker 始终独立按 Deferred 计。
- Monaco 及其 React 包装器由 Rollup 跟随 PythonLab 动态入口自然分包，避免手工
  `monaco-vendor` 吸收共享 helper 后反向进入首屏；`echarts-vendor` 只包含 ECharts
  核心包，`echarts-for-react` 与 `zrender` 跟随按需页面分包。
- 包体预算会单独报告 Entry、Deferred 和 Worker JS；Pyodide 静态运行时按
  Deferred 计入总量。manifest 缺失、`build/assets/` 没有 JS、移动 Worker/Pyodide
  输出目录、漏扫子目录或超过现有阈值都会使门禁失败，不得通过提高阈值绕过失败。
- `copy-pyodide.js` 从 `node_modules/pyodide/package.json` 读取版本，并在目标目录写入
  `.wangsh-pyodide-version`。版本不匹配、marker 缺失或任一核心文件缺失/为空时，
  先复制到 `public/pyodide.tmp-<pid>`，完整校验后再替换正式目录；替换时先将旧运行时
  原子改名为进程级备份，激活新目录失败会恢复旧运行时，成功后才删除备份。
- Vite 开发服务器仍可读取本机 `public/mindmap-demo`，但生产构建完成后会删除
  `build/mindmap-demo`；正式 KaTeX 字体和 `favicon.svg` 不受该目录级规则影响。
- `test:scripts` 使用 Node test runner 执行 `scripts/*.test.mjs`，新增脚本测试后会自动纳入，
  包括 bundle budget、Pyodide 版本/完整性、Docker 构建上下文、生产 UI smoke 分类与
  token checker。静态资产合同只允许 Git 跟踪明确审核的
  `frontend/public/favicon.svg`；新增字体、图片、SVG、WASM 或 source map 必须先说明
  运行用途、大小和构建来源，再更新白名单。
- token checker 对带 fallback 的 `var(--ws-token, fallback)` 同样要求 token 已定义，禁止用 fallback 掩盖设计系统缺口。
- 单页治理报告默认生成到 `docs/docker/testing/ui-page-reports/`（**受版本管理**）。
  G3 修复：旧路径 `frontend/test-results/ui-page-reports/` 被 `.gitignore:174,241` 忽略，
  导致报告永不入库、永不被复核；现改到 tracked 目录。
- 报告必须通过 `node scripts/ui-verify-gate.mjs <report>`（计划 §5.2 六条硬规则）：
  `generated_at` 取系统时钟且**拒绝 `--date` 覆写**；`evidence_level` 由实际证据决定
  （本脚本无浏览器，恒为 L0/L1，永不为 L3/L4）；`counts.scanned_hits` 与
  `counts.human_confirmed` 分开；人工判断只进 `manual_notes` 且须标 `manual:true`。

### 颜色类为什么需要"实编译"比对（`ui:alpha` 的死类检查）

`token:check:ci` 只证明 **`var(--ws-*)` 引用有定义**，**不证明对应的 Tailwind class 生成 CSS**。
两者是不同层次：

| 层次 | 工具 | 能发现 | 发现不了 |
|---|---|---|---|
| CSS 变量 | `token:check:ci` | `var(--ws-xxx)` 未定义 | class 名根本不存在 |
| Tailwind 映射 | `ui:alpha`（死类检查） | 色名不在 colors 表 → class 不生成 | — |
| **布局/助手类** | **`ui:dead-layout:ci`** | `index.css` 里**全站 0 引用**的 class 定义 | 颜色类（见上行） |

> **为什么要两个死类门禁**：`ui:alpha:dead-classes` 走 `findDeadColorClasses()`，只看**颜色类**；
> `index.css` 里的**布局/排版/助手类**是另一个盲区。该盲区真实存在过：
> `docs/docker/archive/2026-08-06-multi-agent-diagnosis-report.md` 点名的 6 个死定义
> **两个月无人处理**，因为没有门禁看着它们。2026-10-05 清理了 30 个死类并补上 `ui:dead-layout:ci`。
>
> `dead-layout-classes.mjs` 的两个必须注意的边界：
> ① **排除 `frontend/ai-partner/`** —— 它是独立子应用，自带 `leaderboard/selection/style.css`，
>    不加载 `index.css`；它有同名 `.module-arrow`，不排除会**误报**。
> ② **必须整词匹配** —— 否则 `.module-card` 会命中 CSS 变量 `--ws-module-card-min-height`。

实例：`border-border-secondary` 曾在 **113 处 / 43 文件**被使用，色名看着"有 token"，
实际因 `colors.border` 是扁平 string 而**完全不生成 CSS**，全部退化为默认灰
（而 `token:check:ci` 全绿）。修复方式是把 `border` 改为嵌套对象并保留 `DEFAULT`。

⚠️ 改动 `tailwind.config.js` 的 colors 结构后，必须确认 `border-border`（DEFAULT）未回归，
否则 1000+ 处标准边框会一起断。这正是死类检查要兜住的场景。

### 两个 px 口径必须分开（`ui:audit` vs `ui:spacing`）

| 口径 | 脚本 | 覆盖 | 用途 |
|---|---|---|---|
| **px 硬编码** | `ui-audit.mjs` | `gap-[24px]`、`w-[1100px]`、CSS `padding: 12px`、内联 style | 静态 px 债务总量 |
| **数字间距类** | `ui-spacing-metrics.mjs` | `gap-4`、`px-6`、`mb-3` | **B5 间距迁移的验收** |

**为什么需要两个**：`ui-audit.mjs` 的正则只匹配 `-[\d+px]` 形式，
**看不到 `gap-4` 这类数字间距类**。而 B5「间距迁移」的对象恰恰是后者——
用 `ui-audit` 的 route 阈值下降来验收 B5 是**不可执行**的。

另需注意：`ui-audit` 的 `tailwind_arbitrary_px` 里 **97.7% 是尺寸/列宽类**
（如 `min-w-[1180px]` 的 DataTable 最小宽度），**不该 token 化**，
所以**不能**用它的下降幅度衡量间距迁移成效。

两者的基线都遵循同一条规则：**只降不升**，实测低于基线时 exit 1 并提示
`--adopt` 收紧。

### G2 洗白指标 `laundering_classes`（`ui:spacing` 的第二个门禁键）

**要防的通道**：把有语义的数字间距类改写成**视觉逐位等价**的任意值，
例如 `p-2`（8px）→ `p-[8px]`。这样 `numeric_spacing_uses` 直接归零，
而它是 `ui:spacing:ci` 的核心 ratchet 键——**视觉零变化即可清零核心债务指标**。

| 指标 | 计入 | 说明 |
|---|---|---|
| `laundering_classes` | `p-[8px]` `p-[0.5rem]` `p-[1.5em]` | **门禁键**，内联字面量任意值 = 视觉等价改写 |
| `token_arbitrary_uses` | `p-[var(--ws-space-3)]` | **纯观测，不进门禁**，见下 |
| `laundering_classes` 不计 | `p-[calc(...)]` | 表达式不属字面量，放行 |

**为什么 `var(--ws-*)` 不算洗白**（2026-10-05 裁决）：
`p-3` = 0.75rem = **10.67px@1024 / 11.25px@1920**，
而 `--ws-space-3` = `clamp(12px, 0.38vw+9.6px, 20px)` = **13.49px@1024 / 16.90px@1920**。
两者数值**根本不同**——把写死值换成引用真实定义、随视口缩放的 CSS 变量是一次
**真实的语义 token 迁移**，正是迁移想要的方向。若计为洗白等于惩罚正确行为。
该用法仍由 `token_arbitrary_uses` 观测，信息不丢失。

三个键彼此独立：`laundering_classes` **不并入** `numeric_spacing_uses`
（否则 `--adopt` 会把洗白值当成真实债务固化进基线），**也不并入** `total`
（`total` 是 `semantic+numeric` 的派生观测值，混入会污染迁移率）。

**实测（2026-10-05）**：真实代码 `laundering_classes=7` / `token_arbitrary_uses=146`；
影子副本「把 1506 处数字类全改写成 `[Npx]`」后 `laundering_classes=1476` ——
证明该指标对真实洗白有充分灵敏度。

## ui-alpha-modifiers 透明度修饰符门禁 + 死类门禁

两份 npm 入口（`ui:alpha` 系列）与两条检查项，详见脚本头部注释。

| 命令 | 职责 | 退出码 |
|---|---|---|
| `npm run ui:alpha` | 透明度修饰符检查（人读报告） | 恒 0 |
| `npm run ui:alpha:ci` | 同上，有违规 exit 1 | 违规则 1 |
| `npm run ui:alpha:dead-classes` | 附加死类报告 | 恒 0（信息性） |
| `npm run ui:alpha:dead-classes:ci` | **颜色类**死类检查，有死类 exit 1 | 有死类则 1 |
| `npm run ui:dead-layout` | **布局/排版/助手类**死类报告 | 恒 0（信息性） |
| `npm run ui:dead-layout:ci` | 同上，有死类 exit 1 | 有死类则 1 |
| `npm run ui:verify` | **校验报告合法性**（B13，计划 §5.2） | 报告非法则 1 |
| `npm run ui:verify:ci` | 同上，扫 `docs/docker/testing/` 全部报告 | 有非法报告则 1 |

## ui-verify-gate 报告合法性门禁（B13）

**存在理由**：计划 §5.2 防的是「**没有浏览器却声称通过**」。仅重写报告生成器（G3）
不够——生成器能产出合法报告，人也能手写一份假的。本脚本是「合法报告」的**可执行契约**。

`ui-verify-gate.mjs` 只校验报告、**不采集证据**，逐条对应计划 §5.2 的六条硬规则：

| 规则 | 检查 |
|---|---|
| 1 | 结论行（含 `PASS`/`FAIL`/`BLOCKED`）必须附 `evidence_ref` |
| 2 | `L3`/`L4` 必须内联 6 个浏览器字段（engine/version/viewport/screenshot_sha256/assertion_count/ran_at） |
| 3 | 提到「浏览器不可用」→ 结论只能是 `BLOCKED(no_browser)`；禁「仅静态审查→通过」路径 |
| 4 | 不得残留空白「规则符合度评分」模板 |
| 5 | `generated_at` 须可解析，且与文件 mtime 相差 <24h（防日期造假） |
| 6 | `counts` 中 `scanned_hits` 与 `human_confirmed` 必须分开 |

> `--all` 会跳过 `README.md`/`INDEX.md`/`TEMPLATE.md`/`CHANGELOG.md`/`TEST_STATUS.md`——
> 它们不是报告，否则门禁恒红。其中 `TEST_STATUS.md` 的身份由
> `docs/docker/testing/README.md` 定义：它是「当前唯一测试状态、功能矩阵、证据和重跑入口」
> 的**汇总台账**（持续更新、引用各次报告），本身不是一份单次验证报告。
>
> 扫描是**递归**的：报告位于 `docs/docker/testing/ui-page-reports/` 子目录。
> ⚠️ 曾经只扫顶层 → 排除台账后变成「未找到报告文件 → exit 0」的**假绿**
> （因为找不到东西而通过，比恒红危险）。改动扫描范围后务必确认门禁仍有检测对象。

契约测试见 `scripts/ui-verify-gate.test.mjs`（8 条，每种非法形态一条 + 合法负例）。

> ⚠️ **覆盖度风险**：门禁的守备力 = 报告数量。当前只有 1 份报告，
> 绿灯仅代表「这 1 份合法」，不代表「所有 UI 结论都合法」。
> 需持续为各路由产出报告（`npm run -s ui:page:report -- --route <r>`）才能让覆盖增长。
> 这与 G3 原本的病根同源：旧版写进被 `.gitignore` 忽略的 `test-results/`，
> 机制上「有产出」但无人可校。

### 检查 1：透明度修饰符（决定 `ui:alpha:ci` 退出码）

Tailwind v3 只为静态色生成 `/N` 规则。项目把颜色映射到 `var(--ws-color-*)`
（hex 或 rgba），因此 `bg-primary/10`、`border-border/40` 不生成任何 CSS——
不报错、不警告，元素静默拿到默认值。已通过并列定义 `-rgb` 三元组修复；本检查防止
这类写法回潮。

### 检查 2：死类检查（`ui:alpha:dead-classes:ci`）

把源码里出现的颜色工具类交给 Tailwind **实编译**，比对哪些没有生成任何 CSS。
覆盖 `border-border-secondary` 这类「看着有 token、其实是死类」的写法。

**CI 接入**：已加入 `.github/workflows/ci-quality.yml` 的 `frontend-quality` job，
紧跟 `ui-audit-gate` 之后执行 `npm run -s ui:alpha:dead-classes:ci`。
实测约 270ms（一次 Tailwind 编译），可每次运行，无需单独 job 或 nightly。

**残余风险**（知情决策用）：

1. 只扫 `.ts` / `.tsx` 字面量。CSS 文件、`.jsx`、字符串拼接变量（`const cls = "bg-" + color`）不覆盖。
2. 判定依赖「字面量里至少有 1 个真 class 作为活性证据」。整组全死且字面量里没有任何其他
   class 的场景会漏检（如单写 `bg-surface-99` 一个词的场景）；真实 className 通常含布局/间距
   class，故实际漏检概率低。该限制是刻意取舍：若要求每个候选都是 class，散文/模型名
   （`text-embedding-3-small`）会产生假阳性。
3. 含中日韩文字的字面量一律按散文跳过（护栏），因此纯中文说明文字里夹的类名不会被检出。
4. 死类报告的是「Tailwind 没生成 CSS」，不代表元素一定视觉出错——若同名 class 在全局 CSS
   里另有定义（如 `.border-right`），需人工判断。当前报告 0 个，不存在待判断项。

## AI伙伴独立源码入口（未发布）

以下 npm 入口在 `frontend/` 下使用，由主线程接入；此处不记录执行结果：

| 命令 | 职责 |
|---|---|
| `npm run type-check` | 类型检查同时覆盖主站与 `ai-partner/` 独立源码 |
| `npm run build` | 先构建主站，再独立构建 AI伙伴至 `build/games/ai-partner/` |
| `npm run build:ai-partner` | 使用 `vite.ai-partner.config.ts` 独立构建 AI伙伴 |
| `npm run dev:ai-partner` | 独立源码开发入口 |
| `npm run test:ai-partner` | AI伙伴专项测试入口 |

页面 URL 仍为 `/games/ai-partner/index.html`。旧 `public/games/ai-partner/` 仅移除
`index.html` 和两份已打包 JS/CSS；`favicon.svg` 保留原位置以维持静态白名单，不迁往
`ai-partner/public/`。独立 Vite 的 `publicDir` 复用 `public/games/ai-partner/`，
将保留的 favicon 复制到 `build/games/ai-partner/`。

本轮仅同步未发布说明，不构建或推送镜像、不部署；实际测试数字由主线程写入
[TEST_STATUS](../../docs/docker/testing/TEST_STATUS.md)，功能边界见
[AI 智能体 owner](../../docs/features/AI_AGENTS.md#ai伙伴临时共享榜单未发布)。

## 维护规则

- 未接入 `package.json`、CI 或 `prod-smoke` 的一次性脚本不再保留。
- 截图采集、手工调试、临时验证脚本统一清理，不回流到本目录。
- PythonLab 调试控制区一旦涉及 `tooltip / hover / pointer / focus` 相关改动，必须补跑真实 Chrome channel 与 WebKit。

## 前端静态独立入口合同

`caddy-directory-entry.test.mjs` 由 `npm run test:scripts` 默认收集，检查独立
AI Partner 的无尾斜线、目录和显式 HTML 入口匹配；目录只回到其自身 index，
不存在的文件仍为 404，不能误回主站 SPA。它也约束 KaTeX CDN 字体源和未放宽
的 object/base/form 边界。静态源码合同不替代实际 Caddy HTTP、浏览器或字体渲染。

## 颜色编译负例与原始扫描

G9 仍扫描测试文件中的运行类。仅直接 Vitest it/test 回调内的真实
Tailwind/PostCSS inline raw HTML 编译输入分类为 compiler fixture；普通字符串、
JSX、变量逃逸、shadow/mock 均不豁免。`ui-alpha-fixture-context.mjs` 使用
TypeScript 绑定识别，报告同时保留 raw_violations 与 compiler_fixtures。
`node --test scripts/ui-alpha-fixture-context.test.mjs` 覆盖反例；不得将测试
文件名或注释当作全文件豁免。动态结果只见 TEST_STATUS。
