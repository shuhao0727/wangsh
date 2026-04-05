# 抽屉 & 浮动面板 UI 深度分析报告

> 对 3 个 Sheet/Drawer + 3 个浮动面板进行两轮深度分析的完整结果。
> 生成时间：2026-04-04 | 最后更新：2026-04-04（全部修复完成）

**状态：全部 ~28 处问题已修复 ✅**

---

## 目录

1. [ActivityDetailDrawer](#1-activitydetaildrawer)
2. [TypstTocDrawer](#2-typsttockdrawer)
3. [Informatics PDF Sheet (Reader.tsx)](#3-informatics-pdf-sheet)
4. [GroupDiscussionPanel](#4-groupdiscussionpanel)
5. [OptimizationDialog (FloatingPopup)](#5-optimizationdialog)
6. [AIAssistantModal (FloatingPopup)](#6-aiassistantmodal)
7. [FloatingPopup 基础组件](#7-floatingpopup-基础组件)
8. [跨组件一致性问题](#8-跨组件一致性问题)
9. [汇总统计](#9-汇总统计)

---

## 1. ActivityDetailDrawer

**文件**: `src/components/ActivityDetailDrawer.tsx`

> 刚完成全面修复，仅剩以下小问题。

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 57 | `bg-gray-100` | SimpleMarkdown 代码块背景硬编码 | `bg-surface-2` |
| 2 | 142-145 | `dot: "bg-sky-500"` / `"bg-emerald-500"` / `"bg-slate-400"` | 生命周期状态圆点颜色硬编码 | 可保留（实心圆点，非 Alert/Badge 模式） |

### Alert 冗余

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 3 | 283 | `variant="destructive" className="border border-destructive/20 bg-destructive/5"` | className 与 variant 功能重复 | 移除冗余 className，仅保留 `variant="destructive"` |

---

## 2. TypstTocDrawer

**文件**: `src/pages/Admin/Informatics/typst/TypstTocDrawer.tsx`

### 布局

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 23 | `style={{ paddingLeft: Math.max(0, (it.level - 1) * 12 }}` | indent 魔术数字 12px | 改为 `(it.level - 1) * 16`（配合 `--ws-space-2` = 16px）或直接使用 Tailwind `pl-N` |

### 跨 Sheet 一致性

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 2 | 16 | `<SheetHeader>` 无 border/padding | 与 ActivityDetailDrawer 的 `border-b border-border px-6 py-4` 不一致 | 添加 `className="border-b border-border px-6 py-4"` |
| 3 | 19 | `<div className="mt-4">` | 内容区无统一 padding 容器 | 改为 `<div className="px-6 py-4">` 与 ActivityDetailDrawer 对齐 |

---

## 3. Informatics PDF Sheet

**文件**: `src/pages/Informatics/Reader.tsx` (line 599-604)

### 布局

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 601-602 | `<div className="border-b ..."><SheetTitle>` | 手动 div 模拟 SheetHeader | 改为 `<SheetHeader className="border-b border-border px-4 py-3">` |

### Alert 冗余

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 2 | 562 | `variant="destructive" className="border border-destructive/20 bg-destructive/5"` | className 与 variant 冗余（同 ActivityDetailDrawer） | 仅保留 `variant="destructive"` |

---

## 4. GroupDiscussionPanel

**文件**: `src/pages/AIAgents/GroupDiscussionPanel.tsx`

### z-index 硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 1001 | `zIndex: 1000` | 悬浮按钮 z-index 硬编码 | `zIndex: "var(--ws-z-floating-btn)"` — 需要先在 index.css 新增此 token |
| 2 | 1028 | `zIndex: 1050` | 悬浮窗口 z-index 硬编码 | `zIndex: "var(--ws-z-floating-panel)"` — 需要先在 index.css 新增此 token |

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 3 | 953 | `bg-primary text-white` | 消息气泡白色文字硬编码 | `text-primary-foreground`（语义化） |

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 4 | 1046-1058 | Pin/Unpin 按钮无 aria-label | 图标按钮缺少无障碍标签 | 添加 `aria-label={floatingPinned ? "取消固定" : "固定窗口"}` |
| 5 | 1062-1073 | 刷新按钮无 aria-label | 图标按钮缺少无障碍标签 | 添加 `aria-label="刷新"` |
| 6 | 1074-1082 | 关闭按钮无 aria-label | 图标按钮缺少无障碍标签 | 添加 `aria-label="关闭窗口"` |

### 布局

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 7 | 931 | `variant="destructive"` | "切换小组"按钮用红色破坏性样式，但非破坏性操作 | 改为 `variant="outline"` |

---

## 5. OptimizationDialog

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/OptimizationDialog.tsx`

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 99 | `border: "1px solid rgba(0,0,0,0.08)"` | FlowPreview 容器边框硬编码 | `border: "1px solid var(--ws-color-border)"` |
| 2 | 183 | `border: "1px solid rgba(0,0,0,0.08)"` | DiffEditor 容器边框硬编码 | `border: "1px solid var(--ws-color-border)"` |
| 3 | 197 | `background: "rgba(255,255,255,0.72)"` | loading overlay 白色背景硬编码 | `background: "color-mix(in srgb, var(--ws-color-surface) 72%, transparent)"` |
| 4 | 224 | `background: "rgba(255,255,255,0.72)"` | 同上（flow 预览 loading） | 同上 |

### 布局

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 183 | `style={{ minHeight: 360, ... }}` | minHeight 内联样式 | 改为 className `min-h-[360px]` |
| 6 | 206 | `style={{ minHeight: 360 }}` | 同上 | 改为 className `min-h-[360px]` |

---

## 6. AIAssistantModal

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/AIAssistantModal.tsx`

### inline style → Tailwind (重点)

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 87 | `style={{ flex: 1, overflowY: "auto", padding: 12, borderBottom: "1px solid rgba(0,0,0,0.04)" }}` | 全部应为 Tailwind | `className="flex-1 overflow-y-auto p-3 border-b border-border-secondary"` |
| 2 | 89 | `style={{ textAlign: "center", marginTop: 40, color: "var(--ws-color-text-tertiary)" }}` | 内联样式 | `className="text-center mt-10 text-text-tertiary"` |
| 3 | 90 | `<Bot style={{ fontSize: 48, marginBottom: 16 }} />` | 图标内联样式 | `<Bot className="mx-auto h-12 w-12 mb-4" />` |
| 4 | 97 | `style={{ display: "flex", justifyContent: ... }}` | flex 布局内联 | `className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}` |
| 5 | 99-105 | `style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 8, ... }}` | 消息气泡全内联 | 见下方建议 |
| 6 | 120 | `style={{ padding: 12, display: "flex", gap: 8 }}` | 输入区内联 | `className="p-3 flex gap-2"` |
| 7 | 158-164 | toolbar 全部内联样式 | 布局+颜色全内联 | `className="px-3 py-2 border-b border-border-secondary flex justify-between items-center bg-surface-2"` |

**消息气泡建议** (行 97-105):
```tsx
<div className={cn(
  "flex",
  item.role === "user" ? "justify-end" : "justify-start"
)}>
  <div className={cn(
    "max-w-[85%] px-3 py-2 rounded-lg text-sm",
    item.role === "user"
      ? "bg-primary text-primary-foreground"
      : "bg-surface-2 text-text-base"
  )}>
```

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 8 | 134-136 | Send/Loading 按钮无 aria-label | 图标按钮 | 添加 `aria-label="发送消息"` |
| 9 | 121-133 | Textarea 仅有 placeholder | 缺 aria-label | 添加 `aria-label="输入你的问题"` |

---

## 7. FloatingPopup 基础组件

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/FloatingPopup.tsx`

### z-index 硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 142 | `zIndex: 1000` | z-index 硬编码 | `zIndex: "var(--ws-z-floating-panel)"` |

### resize handle 颜色

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 2 | 180 | `rgba(0,0,0,0.16)` (x3) | resize 手柄颜色硬编码 | `var(--ws-color-text-tertiary)` 替代 |

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 3 | 164 | 关闭按钮无 aria-label | 图标按钮 | 添加 `aria-label="关闭"` |

---

## 8. 跨组件一致性问题

### A. Sheet Header 不一致

| 组件 | 行 | 当前样式 | 建议统一为 |
|------|-----|---------|----------|
| ActivityDetailDrawer | 314 | `<SheetHeader className="border-b border-border px-6 py-4">` | 标准 ✓ |
| TypstTocDrawer | 16 | `<SheetHeader>` (无样式) | 添加 `border-b border-border px-6 py-4` |
| Reader.tsx (Mobile) | 601 | 手动 div 模拟 | 改用 `<SheetHeader>` |
| GroupDiscussionPanel 成员列表 | 1096 | `<SheetHeader className="border-b border-[...] px-4 py-3">` | 接近标准 ✓ |

**建议统一标准**: `<SheetHeader className="border-b border-border px-6 py-4">`

### B. 浮动面板 z-index 管理混乱

| 位置 | z-index | 用途 |
|------|---------|------|
| GroupDiscussionPanel 按钮 | 1000 | 悬浮入口 |
| GroupDiscussionPanel 窗口 | 1050 | 悬浮面板 |
| FloatingPopup (OptimizationDialog/AIAssistant) | 1000 | 浮动面板 |
| AdminLayout header | `var(--ws-z-header)` | 已 token 化 |
| AdminLayout overlay | `var(--ws-z-overlay)` | 已 token 化 |

**建议**: 在 index.css 新增浮动面板 z-index token:
```css
--ws-z-floating-btn: 1000;
--ws-z-floating-panel: 1050;
```

### C. 消息气泡圆角不一致

| 组件 | 圆角值 | 效果 |
|------|--------|------|
| GroupDiscussionPanel | `rounded-[14px]` | 大圆角聊天风格 |
| AIAssistantModal | `borderRadius: 8` (=rounded-lg) | 较小圆角 |

**建议**: 统一为 `rounded-xl`（12px），平衡两者。

### D. "切换小组"误用 destructive variant

| 组件 | 行 | 当前 | 建议 |
|------|-----|------|------|
| GroupDiscussionPanel | 931 | `variant="destructive"` | `variant="outline"` — 非破坏性操作 |

### E. Alert variant 缺失

当前 `alert.tsx` 只有 `default` 和 `destructive` 两个 variant。多处 Warning Alert 需要 inline className 模拟。

**建议**: 给 alert.tsx 新增 `warning` variant:
```ts
warning: "border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)] text-[var(--ws-color-warning)] [&>svg]:text-[var(--ws-color-warning)]"
```

---

## 9. 汇总统计

### 按问题类型

| 类型 | 数量 |
|------|------|
| inline style → Tailwind (AIAssistantModal 重灾区) | 7 处 |
| rgba / 颜色硬编码 (OptimizationDialog + FloatingPopup) | 6 处 |
| z-index 硬编码 (浮动面板 3 处) | 3 处 |
| Sheet Header 不一致 | 2 处 |
| 无障碍 aria-label 缺失 | 6 处 |
| Alert className 冗余 | 2 处 |
| 按钮 variant 误用 | 1 处 |
| 消息气泡圆角不一致 | 1 类 |
| **总计** | **~28 处** |

### 按组件严重度

| 组件 | 问题数 | 严重度 |
|------|--------|--------|
| AIAssistantModal | 9 | 高 — inline style 泛滥 |
| OptimizationDialog | 6 | 中 — rgba 硬编码 |
| GroupDiscussionPanel | 7 | 中 — z-index + 无障碍 |
| FloatingPopup (基础) | 3 | 中 — z-index + resize handle |
| ActivityDetailDrawer | 3 | 低 — 仅剩小问题 |
| TypstTocDrawer | 3 | 低 — 一致性 |
| Reader.tsx Sheet | 2 | 低 |

### 修复优先级

**P0 (影响一致性)**:
1. 在 index.css 新增 `--ws-z-floating-btn` 和 `--ws-z-floating-panel` token
2. AIAssistantModal inline style → Tailwind 全面替换

**P1 (颜色硬编码)**:
3. OptimizationDialog rgba → CSS 变量
4. FloatingPopup z-index + resize handle 颜色

**P2 (一致性)**:
5. Sheet Header 统一为 `border-b border-border px-6 py-4`
6. GroupDiscussionPanel "切换小组" variant 修正
7. 消息气泡圆角统一

**P3 (无障碍)**:
8. 浮动面板图标按钮添加 aria-label
