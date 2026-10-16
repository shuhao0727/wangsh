> 状态：superseded
> Owner：frontend
> 最近复核：2026-10-03
> 归档条件：已由 [2026-10-03-ui-improvement-plan.md](2026-10-03-ui-improvement-plan.md) 取代

# WangSh UI 提升计划（统一版）

> ⚠️ **本文已被取代，不再是执行依据。** 当前唯一执行计划见
> [2026-10-03-ui-improvement-plan.md](2026-10-03-ui-improvement-plan.md)。
> 保留本文是因为它最早逐条核实并记录了一批报表失真（见其 §5），有溯源价值。

本文曾是 UI 改造的**唯一执行依据**。它合并了三类来源，并已用代码逐条核实：

1. 既有计划（`UI_OPTIMIZATION_DETAILED_PLAN.md`、`UI_OPTIMIZATION_PC_ONLY_PLAN.md`）
2. 既有分析与验证报告（`UI_DESIGN_ANALYSIS.md`、`UI_LAYOUT_DEEP_ANALYSIS.md`、`docs/verification/*`）
3. 本轮实测发现（浏览器实测 + 代码统计）

**重要前提**：既有文档大面积失真（详见 §5）。本文所有状态标注均以**代码实测**为准，不采信文档自述。引用旧文档时请先看 §5 的失真清单。

---

## 一、总体进度

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0 回归修复 | ✅ 完成 | 7 个文件簇 + 补修 5 处，均经浏览器实测 |
| Phase 1 设计系统基础 | 🔄 部分完成 | 色彩 100%、CSS 补丁层 100%、硬编码收敛 70%、间距迁移 ~14%、字号 token 0% |
| Phase 2 组件一致性 | ❌ 未开始 | 加载态/空状态/确认弹窗碎片化 |
| Phase 3 PC 大屏与信息架构 | ❌ 未开始 | `xl:`3 处、`2xl:`0 处 |
| Phase 4 防退化机制 | ❌ 未开始 | 无 lint 规则、无 CI 扫描 |

---

## 二、Phase 0：回归修复（已完成）

| 项 | 证据 |
|---|---|
| `Input` 的 flex-1 / min-w 失效（91px→260px） | CSS 特异性修复，浏览器实测 |
| 表格 `min-w-[Npx]` 被压成 0 | 排除段 `table:not([class*="min-w-"])` |
| `pr-9` 被 tailwind-merge 吞掉 | 调整 `cn()` 参数顺序 |
| 对话框/警告框头部间距跳变 | 回到 `space-y-1.5`，与 CardHeader 一致 |
| 批量删除双入口 | 保留工具栏入口，浮动栏已废弃 |
| 表格操作列宽度（340px 过宽→280px） | 真实浏览器 A/B 实测 |
| AdminLayout 侧边栏折叠死分支 | 重写，含 localStorage 偏好记忆 |
| 后端视图静默失败（500） | 开发库已修；**代码层待办见 §4.6** |
| 持久化读取路径失效 ×2（PythonLab、AIAgents） | 含侧边栏窗口外会话两层局限 |

**验证**：`npm run type-check` exit 0；`npm run lint` 0 error；6 视口 × 多页面回归通过。

---

## 三、Phase 1：设计系统（部分完成）

### 3.1 ✅ 色彩达标（已完成）

现状（`index.css`，已实测对比度）：

| Token | 值 | 白字/色块 | 对 `#E6F5F3` |
|---|---|---|---|
| `--ws-color-primary` | `#36776F` | 5.22 | 4.65 |
| `--ws-color-primary-hover` | `#2F7169` | 5.70 | 5.08 |
| `--ws-color-primary-active` | `#266961` | 6.41 | 5.71 |
| `--ws-color-success` | `#39795D` | 5.16 | 4.60 |
| `--ws-color-warning` | `#976135` | 5.15 | 4.59 |
| `--ws-color-error` | `#A25850` | 5.19 | 4.62 |
| `--ws-color-info` | `#4B6EA1` | 5.19 | 4.63 |
| `--ws-color-accent` | `#7164A1` | 5.20 | 4.63 |
| `--ws-color-text-tertiary` | `#626F82` | 5.10 | 4.55 |

设计原则：**对比度由亮度决定，「刺眼」来自彩度**。所有语义色统一在彩度带 0.068–0.098，亮度只取「刚够 AA」，不追求高对比数字。

### 3.2 ✅ CSS 补丁层拆解（已完成）

`responsive-audit.css` 已重构：`!important` 清零、删除零引用死类（`.ws-responsive-toolbar__group` 等）、小屏内边距收敛为唯一来源。5 档视口 × 4 个 admin 页面实机通过。

### 3.3 🔴 间距 token 迁移（**最大欠账**）

**实测：语义 token 约 150 处，数字间距类约 2649 处（`gap-N` 628、`p-N` 261…），占比约 14%。**

> ⚠️ 既有文档宣称「95%+ 完成」，与实测相差 6 倍。**不要按 95% 口径评估进度。**

存在两套冲突的间距源，需一并统一：

| 来源 | 值 | 使用处 |
|---|---|---|
| Tailwind `p-panel-padding` | 固定 24px | `AdminPage.tsx`、`card.tsx` |
| CSS `var(--ws-panel-padding)` | `clamp(12–20px)` | `BasicLayout.css` |

同名不同值，同页并存时留白不一致。

**做法**：按模块分批替换（Admin 表格页 → 表单/弹窗 → 其余），每批跑 type-check + 视觉回归。**不要一次性全量替换**（2649 处，回归面过大）。

### 3.4 🔴 字号无 token（**文档完全未覆盖**）

`text-[Npx]` 硬编码 **87 处**，集中在 `text-[10px]`(约30) / `text-[11px]`(约40)，且高度集中在前 4 个文件（`HotAnalysisResultPage` 13、`ITTechnology/{ml,ai,agents}` 各 6-7）——**一次批量替换即可清掉近半**。

另有 `style={{fontSize}}` 58 处。项目只有间距 token，**没有字号 token**。

**做法**：先在 `tailwind.config.js` 定义字号 scale（如 `text-micro`=11px / `text-tiny`=10px，或直接归并到 `text-xs`），再批量替换。

### 3.5 🟡 按钮高度未接 token

**实测 `h-8`=118、`h-9`=51、`h-10`=18、`h-11`=4**，而 `index.css` 已定义 `--ws-control-height`(36) / `-sm`(28) / `-lg`(44)。

> 注意：`Button` 组件本身**已**正确使用 token（`button-variants.ts`），问题在**调用方**用 `className="h-8"` 覆盖。修正方向是收敛调用方，而非改组件。

### 3.6 🟡 硬编码色值残留

- `.tsx` 内 hex **42 处**（含 `Login.tsx` 已修，剩 Games/终端/图表/评分色）
- 原始 Tailwind 调色板类 `text-green-700` 等 **21 处**
- `--ws-color-info-soft` 与新 `--ws-color-info` **不同源**（前者仍是旧蓝 `rgba(9,105,218,.08)`），在 `AssessmentPanel.tsx:839`、`ActivityFormDialog.tsx:342` 同屏使用，色相割裂
- `StatisticsCards.tsx` 的 `var(--ws-color-danger, #ef4444)` fallback 是旧色

---

## 四、Phase 2/3/4：待办（按优先级）

### 4.1 🔴 加载/空状态统一（Phase 2）

**实测碎片化远超文档描述**：`Loader2` 55 文件、`animate-spin` 132 处、`Skeleton` 14 文件、「加载中」文本 392 处；`EmptyState` 组件仅 11 文件使用，另有 10 文件手写空态文案。表格骨架屏还有两套（`AdminTablePanel` 与 `data-table.tsx` 内联）。

**做法**：定 `<LoadingState variant>` 与统一空状态，按场景分工（表格→Skeleton、按钮→Spinner）。

### 4.2 🔴 确认弹窗不统一

`Common/ConfirmDialog` 已被 20 文件使用，但仍有原生弹窗：`window.confirm` 2 处（`TaskAnalysisNewPage.tsx:171`、`TaskAnalysisListPanel.tsx:86`）、`alert` 1 处（`GameDetailModal.tsx:91`）。原生弹窗无法主题化/无障碍定制，与永久浅色 + token 策略冲突。

### 4.3 🔴 无障碍缺口（Phase 2，**5 份报告均未审计**）

| 项 | 实测 |
|---|---|
| `focus-visible` 覆盖 | 仅 **15/242** 组件文件（约 6%），而可点击元素 **592** 个 |
| `focus:` 与 `focus-visible:` 混用 | 60 : 58，接近 1:1 |
| `aria-label` | 全项目 115 处；`size="icon"` 按钮 19 个中仅 7 个有 |
| `aria-live` | 全项目仅 4 处；**流式对话区 0 处**——屏幕阅读器无法感知 AI 回复 |

`ChatArea.tsx` 消息列表无任何 aria 标注，这是硬缺陷（WCAG 2.4.7 / 4.1.2 不达标）。

### 4.4 🔴 PC 大屏适配（Phase 3）

`xl:`(1280) **3 处**、`2xl:`(1536) **0 处**——1280–1920 主流区间仍按 `lg`(1024) 渲染。

> ⚠️ 既有计划提出的 `laptop/desktop/wide/ultra` 自定义断点**不建议实施**：代码已有 CSS 媒体查询（`responsive-audit.css` 1366/1920/2560）+ `--ws-shell-max-width` 双轨机制，再加一套 JS 断点会三轨并存。真实缺口是**推广现有机制**，不是新建。

同时：`grid-cols-N` 固定列 146 处非响应式；对话容器无最大宽度。

### 4.5 🟡 信息架构

**AdminLayout「智能体」分组含 7 个子菜单**（AI智能体、用户管理、智能体数据、小组讨论、自适应测评、课堂互动、课堂计划），其中「用户管理」与其余智能体功能无关联。已核实未拆分。

### 4.6 🔴 后端视图静默失败（**非 UI，但阻塞新环境**）

`backend/app/core/startup.py:275` 的 `except Exception` 把视图创建错误吞成 warning。根因：`CREATE OR REPLACE VIEW` 不能重排列名，旧视图列序不符时报错后被静默跳过 → 查询 `is_archived` 失败 → 接口 500。

**开发库已修复，代码层未动。任何新环境启动都会静默失败。**

### 4.7 🟡 PythonLab 按钮缺 `type="button"`

`RightPanelView.tsx` 中 `<Button>` 出现 14 次，仅 1 处写了 `type="button"`。调试按钮（Run/Debug/Pause/Continue/Step/Reset）均未声明。若处于 `<form>` 内会触发意外提交。`AGENTS.md` 将 PythonLab 列为高风险区，此项应优先。

### 4.8 🟢 其他

| 项 | 实测 |
|---|---|
| 原生 `window.innerWidth` 读屏宽 | 4 个文件，无通用 `useMediaQuery` |
| 两份同名 `tableDefaults.ts` | `components/ui/`(真源) 与 `constants/`(仅分页常量) |
| `data-table-bulk-actions.tsx` | **死代码**（0 import），且旧计划还要新建同类组件 |
| `grid.tsx` | 已实现但仅 1 处使用，旧计划当"新建" |
| 表格排序 | 6 文件已接入 `getSortedRowModel` |
| 表格筛选 | 无 TanStack 筛选模型，46 文件手写过滤逻辑 |
| 语义 class 死代码 | `--ws-text-body/title/caption` 及 8 个语义 class **零使用** |
| Hero 高度 | `Home/index.tsx:43` 仍 `minHeight: "100vh"` |

### 4.9 ❌ 已废弃（不要再做）

| 项 | 原因 |
|---|---|
| 移动端表格卡片视图 | `PC_ONLY_PLAN` 已整体移除（省 50h），与 PC 定位一致 |
| `laptop/desktop/wide/ultra` 断点 | 与现有 CSS 机制冲突，见 §4.4 |
| 浮动批量工具栏 | 项目已改为工具栏下拉方案，组件成死代码 |
| `spacing-tokens.ts` 语义别名文件 | 从未创建，且 `index.css` 已有等效机制 |
| `content.js` JS 错误排查 | 浏览器扩展产物，与本项目无关 |
| 统一栅格系统 | `grid.tsx` 已存在，真实缺口是推广非新建 |

---

## 五、既有文档失真清单（**引用前必读**）

审核 14 份文档（约 9900 行）后确认的失真：

### 5.1 数据造假

| 文档 | 声称 | 实测 |
|---|---|---|
| `UI_OPTIMIZATION_EXECUTION_STATUS.md` | 间距统一度 50%→**95%+** | **14%** |
| `UI_OPTIMIZATION_VERIFICATION_REPORT.md` | 遗留硬编码 **6 处**（可接受） | **745 处** |
| 同上 | 修改文件 **151** 个 | 与另一文档的 155 冲突，均不符实际 |
| `UI_LAYOUT_DEEP_ANALYSIS.md` §9 | 路线图阶段 1-3 全部 **[x]** | 多项实测未做（`grid-cols-12`、常量、别名均无） |
| `SPACING_MIGRATION_PHASE2_VERIFICATION_REPORT.md` | 语义 CSS 变量 `--ws-space-card-padding` 等 | **该变量不存在** |

### 5.2 色值全线过时

`AGENTS.md`、`COLORS.md`、5 份报告**全部**停留在旧色板（`#0D9488`/`#7C3AED`/`#0969da`）。当前实际值见 §3.1。

> ⚠️ 若照抄旧文档执行，会「优化对比度」时把已达标的 `success`/`warning` 改回 3.19:1 的不达标值——**反向改动**。

### 5.3 自相矛盾

- **移动端**：`DETAILED_PLAN` 列为 P0，`PC_ONLY_PLAN` 已整体移除
- **Logo 点击**：两文档都当 P0 未达标项，实际 `AdminLayout` 回 `/admin/dashboard` 是有意的信息架构决定
- **信息源缺失**：两份计划援引「共识别 103 个问题」的 `UX_USABILITY_DIAGNOSIS.md`——**全仓库不存在**，TOP20 中多数 UX 条目无法回溯到现存证据
- **`DialogHeader` 间距**：报告称已迁 `space-y-content-gap`，实际仍是 `space-y-1.5`（有意保留）

### 5.4 日期造假

根目录 4 份报告标「2025-01-XX」，实际产出 2026-10-02。

---

## 六、执行顺序建议

| 顺序 | 任务 | 理由 |
|---|---|---|
| 1 | **同步文档色值**（`AGENTS.md`/`COLORS.md`） | 当前文档与代码脱节，是最大误导源 |
| 2 | **后端视图迁移**（§4.6） | 阻塞所有新环境，非 UI 但更紧急 |
| 3 | **PythonLab 按钮 `type`**（§4.7） | 高风险模块，改动小 |
| 4 | **字号 token 化**（§3.4） | 87 处集中在 4 文件，一次可清近半 |
| 5 | **间距迁移**（§3.3） | 最大欠账，但需分批，风险可控 |
| 6 | **无障碍补齐**（§4.3） | 硬缺陷，`aria-live` 尤其 |
| 7 | **组件一致性**（§4.1/4.2） | Phase 2 |
| 8 | **PC 大屏推广**（§4.4） | Phase 3，推广现有机制 |
| 9 | **防退化机制**（Phase 4） | 不做则前 8 项会重新腐化 |

---

## 七、相关文档

- `frontend/src/styles/COLORS.md` — 色彩语义规范（**色值待同步**）
- `frontend/src/styles/SPACING.md` — 间距规范
- `docs/design/UI_OPTIMIZATION_DETAILED_PLAN.md` — 既有计划（**部分失真，见 §5**）
- `docs/design/UI_OPTIMIZATION_PC_ONLY_PLAN.md` — 既有 PC 计划（**部分失真**）
- `docs/verification/*` — 验证报告（**结论多为历史快照**）
