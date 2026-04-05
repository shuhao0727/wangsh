# 全局残留问题 UI 深度分析报告

> 50 个界面分析完成后，对全局 grep 扫描发现的残留硬编码问题汇总。
> 生成时间：2026-04-04 | 最后更新：2026-04-04（全部修复完成）

**状态：全部 ~58 处问题已修复 ✅**（8 处合理保留：SVG 画布引擎、终端初始化、单一实例标记）

---

## 目录

1. [ProfileView](#1-profileview)
2. [PythonLab 画布组件群](#2-pythonlab-画布组件群)
3. [PythonLab 右侧面板](#3-pythonlab-右侧面板)
4. [IT 技术公共页面](#4-it-技术公共页面)
5. [浮动面板 z-index 未迁移](#5-浮动面板-z-index-未迁移)
6. [文字颜色硬编码（散落）](#6-文字颜色硬编码散落)
7. [bg 颜色硬编码（散落）](#7-bg-颜色硬编码散落)
8. [UI 基础组件 shadow rgba](#8-ui-基础组件-shadow-rgba)
9. [汇总统计](#9-汇总统计)

---

## 1. ProfileView

**文件**: `src/components/ProfileView.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 31 | `stroke="rgba(15,23,42,0.12)"` | SVG stroke 硬编码 | `stroke="var(--ws-color-border-secondary)"` |
| 2 | 121 | `bg-gray-50` | 背景硬编码 | `bg-surface-2` |
| 3 | 176 | `bg-gray-50` | 背景硬编码 | `bg-surface-2` |
| 4 | 222 | `bg-gray-50` | 背景硬编码 | `bg-surface-2` |
| 5 | 251 | `bg-gray-50` | 背景硬编码 | `bg-surface-2` |

---

## 2. PythonLab 画布组件群

> 画布类组件大量使用 inline style 是合理的（动态定位、SVG 属性等），
> 以下仅列出**可改为 token** 的明确硬编码。
> SVG 的 `fill="rgba(0,0,0,0)"` / `stroke="rgba(0,0,0,0)"` 是透明占位，**不需要修改**。

### EdgeToolbar.tsx

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/EdgeToolbar.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 69 | `background: "#fff"` | 白色背景硬编码 | `background: "var(--ws-color-surface)"` |
| 2 | 70 | `border: "1px solid rgba(0,0,0,0.10)"` | 边框色硬编码 | `border: "1px solid var(--ws-color-border)"` |
| 3 | 72 | `boxShadow: "0 12px 28px rgba(0,0,0,0.12)"` | 阴影硬编码 | `boxShadow: "var(--ws-shadow-lg)"` |
| 4 | 85 | `background: "rgba(0,0,0,0.04)"` | hover 背景硬编码 | `background: "var(--ws-color-hover-bg)"` |

### TemplatePalette.tsx

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/TemplatePalette.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 36 | `borderBottom: "1px solid rgba(0,0,0,0.06)"` | 边框色硬编码 | `borderBottom: "1px solid var(--ws-color-border)"` |

### FlowNodesLayer.tsx

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/FlowNodesLayer.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 6 | 188 | `drop-shadow(0 16px 32px rgba(0,0,0,0.18))` / `drop-shadow(0 12px 24px rgba(0,0,0,0.12))` | 节点阴影硬编码 | 可保留（SVG filter，无对应 token）|
| 7 | 447 | `const stroke = active ? "#0EA5E9" : "rgba(0,0,0,0.35)"` | 端口圆描边颜色硬编码 | `active ? "var(--ws-color-primary)" : "var(--ws-color-text-tertiary)"` |

### FlowAnnotationsSvg.tsx

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/FlowAnnotationsSvg.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 8 | 141 | `drop-shadow(0 4px 6px rgba(0,0,0,0.1))` | 注释阴影硬编码 | 可保留（SVG filter）|

---

## 3. PythonLab 右侧面板

### DebugTab.tsx

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/DebugTab.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 100 | `color: "#0EA5E9"` | 变量变化高亮色硬编码 | `color: "var(--ws-color-primary)"` |
| 2 | 128 | `style={{ height: "100%", overflowY: "auto" }}` | inline style | `className="h-full overflow-y-auto"` |
| 3 | 130 | `style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}` | inline style | `className="flex items-center justify-between gap-3"` |
| 4 | 182 | `style={{ padding: "8px 0", color: "rgba(0,0,0,0.45)", textAlign: "center" }}` | inline style + 颜色硬编码 | `className="py-2 text-center text-text-tertiary"` |

### RightPanelView.tsx

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 549 | `text-red-600` | 错误文字色硬编码 | `text-destructive` |
| 6 | 594 | `background: "#ffffff", padding: 4` | 终端容器白色 + padding 硬编码 | `className="h-full bg-surface p-1 flex flex-col"` |

---

## 4. IT 技术公共页面

### ClassSelector.tsx

**文件**: `src/pages/ITTechnology/ClassSelector.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 59 | `background: 'rgba(14,165,233,0.1)'` | 图标背景硬编码 | `className="bg-primary-soft"` 或 `background: "var(--ws-color-primary-soft)"` |
| 2 | 67 | `background: 'rgba(0,0,0,0.04)'` | 标签背景硬编码 | `className="bg-[var(--ws-color-hover-bg)]"` 或 `background: "var(--ws-color-hover-bg)"` |

| 8 | 97 | `style={{ flex: 1, display: 'flex', ... }}` | inline style | `className="flex flex-1 items-center justify-center"` |
| 9 | 107 | `textShadow: '0 0 20px rgba(255,255,255,0.5)'` | 白色 glow 硬编码 | 可保留（全屏动画特效，无对应 token）|
| 10 | 116 | `style={{ paddingBottom: 100 }}` | inline style | `className="pb-[100px]"` |

---

## 5. 浮动面板 z-index 未迁移

以下浮动面板的 z-index 仍为硬编码数字，应改为 CSS token。

| 文件 | 行 | 当前值 | 建议 |
|------|-----|--------|------|
| AssessmentPanel.tsx | 559 | `zIndex: 1000` | `"var(--ws-z-floating-btn)"` |
| AssessmentPanel.tsx | 954 | `zIndex: 1001` | `"var(--ws-z-floating-panel)"` |
| AssessmentPanel.tsx | 1019 | `z-[999]` | `z-[var(--ws-z-floating-btn)]` |
| ClassroomPanel.tsx | 508 | `zIndex: 1000` | `"var(--ws-z-floating-btn)"` |
| ClassroomPanel.tsx | 527 | `zIndex: 1001` | `"var(--ws-z-floating-panel)"` |
| AdminEditorLayout.tsx | 33 | `z-[1000]` | `z-[var(--ws-z-floating-panel)]` |

---

## 6. 文字颜色硬编码（散落）

| 文件 | 行 | 当前代码 | 建议 |
|------|-----|---------|------|
| RightPanelView.tsx | 549 | `text-red-600` | `text-destructive` |
| AssessmentPanel.tsx | 797 | `text-emerald-500` | `text-[var(--ws-color-success)]` |
| AssessmentPanel.tsx | 798 | `text-red-500` | `text-[var(--ws-color-error)]` |
| AssessmentPanel.tsx | 809 | `text-emerald-500` | `text-[var(--ws-color-success)]` |
| AssessmentPanel.tsx | 909 | `text-emerald-500` | `text-[var(--ws-color-success)]` |
| AssessmentPanel.tsx | 910 | `text-red-500` | `text-[var(--ws-color-error)]` |
| Informatics/index.tsx | 844,877 | `text-red-600` (2 处) | `text-destructive` |
| ClassroomPlan/index.tsx | 337,676 | `text-red-600 hover:text-red-700` (2 处) | `text-destructive` |
| ClassroomPlan/PlanPage.tsx | 869 | `text-red-600 hover:text-red-700` | `text-destructive` |
| Xbk/index.tsx | 496,1011 | `text-rose-600` (2 处) | `text-destructive` |
| AgentData/columns.tsx | 174 | `text-emerald-500` | `text-[var(--ws-color-success)]` |
| AgentData/columns.tsx | 200 | `text-amber-500` | `text-[var(--ws-color-warning)]` |
| AgentData/columns.tsx | 214 | `text-sky-500` | `text-primary` |
| AgentData/DetailModal.tsx | 172 | `text-amber-500` | `text-[var(--ws-color-warning)]` |
| AIAgents/columns.tsx | 247 | `text-amber-500` | `text-[var(--ws-color-warning)]` |
| AgentDetail.tsx | 115 | `text-sky-500` | `text-primary` |
| AgentDetail.tsx | 145 | `text-amber-500` | `text-[var(--ws-color-warning)]` |
| XbkAnalysisModal.tsx | 297 | `text-amber-600` | `text-[var(--ws-color-warning)]` |

---

## 7. bg 颜色硬编码（散落）

| 文件 | 行 | 当前代码 | 建议 |
|------|-----|---------|------|
| AssessmentPanel.tsx | 603,749,837 | `!bg-indigo-500` (3 处) | `!bg-[var(--ws-color-purple)]` 或自定义 button variant |
| Xbk/index.tsx | 628 | `bg-amber-100 text-amber-700` | `variant="warning"` (Badge) 或语义 token |
| ClassroomPlan/PlanPage.tsx | 74 | `softBg: "bg-blue-50"` | `"bg-primary-soft"` |
| ClassroomPlan/PlanPage.tsx | 919 | `bg-blue-50 hover:bg-blue-50` | `bg-primary-soft hover:bg-primary-soft` |
| ClassroomInteraction/index.tsx | 511 | `bg-violet-100 text-violet-700` | 可保留（内联 code 标记，单一实例）|
| TemplatePalette.tsx | 18 | `bg-amber-100 text-amber-700` | 可保留（单一实例"高级"标签）|

---

## 8. UI 基础组件 shadow rgba

> 以下 rgba 值用于 `box-shadow` / `shadow-[...]`，属于阴影效果，
> 不影响主题一致性，**可保留**不改。

| 文件 | 行 | 用途 |
|------|-----|------|
| dialog.tsx | 39 | `shadow-[0_8px_32px_rgba(0,0,0,0.08)]` |
| alert-dialog.tsx | 39 | 同上 |
| sheet.tsx | 32 | 同上 |
| toast.tsx | 28 | `shadow-[0_8px_24px_rgba(0,0,0,0.06)]` |
| tooltip.tsx | 21 | `bg-[rgba(15,23,42,0.92)]` — tooltip 深色背景，可保留 |
| toast.tsx | 19 | `z-[100]` — Toast 全局 z-index，可保留 |

---

## 9. 汇总统计

### 按问题类型

| 类型 | 数量 |
|------|------|
| `bg-gray-50` → `bg-surface-2` | 4 处 |
| rgba / hex 颜色硬编码 | ~12 处 |
| inline style → Tailwind | ~10 处 |
| z-index 硬编码 | 6 处 |
| 文字颜色硬编码 (text-red/emerald/amber/sky/rose) | ~20 处 |
| bg 颜色硬编码 (bg-indigo/amber/blue) | ~6 处 |
| **需修复总计** | **~58 处** |
| 可保留（SVG filter/shadow/单一实例） | ~8 处 |

### 按文件严重度

| 文件/组件群 | 问题数 | 严重度 |
|------------|--------|--------|
| AssessmentPanel.tsx | 8 | 高 — z-index + 颜色 |
| AgentData/columns.tsx + DetailModal.tsx | 4 | 中 — 图标颜色 |
| ClassroomPlan (index + PlanPage) | 5 | 中 — 文字颜色 + bg-blue |
| PythonLab 画布组件群 | 8 | 中 — EdgeToolbar/Template/FlowNodes |
| DebugTab + RightPanelView | 6 | 中 — inline style |
| ProfileView | 5 | 中 — bg-gray-50 |
| IT 技术公共页 (ClassSelector/Dianming/RollCall) | 10 | 中 — inline style |
| Xbk/index.tsx | 4 | 低 — text-rose + badge |
| Informatics/index.tsx | 2 | 低 |
| 散落图标颜色 (AgentDetail/columns) | 4 | 低 |
| AdminEditorLayout.tsx | 1 | 低 — z-index |

### 批量修复建议

**文字颜色替换 (~20 处)**:
```
text-red-600 / text-red-500      → text-destructive 或 text-[var(--ws-color-error)]
text-rose-600                    → text-destructive
text-emerald-500 / text-emerald-600  → text-[var(--ws-color-success)]
text-amber-500 / text-amber-600  → text-[var(--ws-color-warning)]
text-sky-500                     → text-primary
```

**z-index 统一 (6 处)**:
```
zIndex: 1000  → "var(--ws-z-floating-btn)"
zIndex: 1001  → "var(--ws-z-floating-panel)"
z-[999]       → z-[var(--ws-z-floating-btn)]
z-[1000]      → z-[var(--ws-z-floating-panel)]
```

**bg-gray-50 替换 (4 处 ProfileView)**:
```
bg-gray-50  → bg-surface-2
```

**inline rgba 替换**:
```
"#fff" / "#ffffff"        → "var(--ws-color-surface)"
"#0EA5E9"                 → "var(--ws-color-primary)"
rgba(0,0,0,0.04)          → "var(--ws-color-hover-bg)"
rgba(0,0,0,0.06)          → "var(--ws-color-border)"
rgba(0,0,0,0.10)          → "var(--ws-color-border)"
rgba(0,0,0,0.45)          → text-text-tertiary (Tailwind)
rgba(14,165,233,0.1)      → "var(--ws-color-primary-soft)"
```
