# 弹窗/浮动面板深度审计报告

> 对所有弹窗（Dialog/Modal）、Sheet、浮动面板进行逐行深度审计。
> 生成时间：2026-04-04

**状态：全部 ~26 处问题已修复 ✅**（2026-04-04 验证通过）

---

## 目录

1. [ClassroomPanel — 答题结果卡片 inline style](#1-classroompanel-答题结果卡片-inline-style)
2. [AssessmentPanel — 答案颜色 inline style](#2-assessmentpanel-答案颜色-inline-style)
3. [OptimizationDialog — border inline style](#3-optimizationdialog-border-inline-style)
4. [RightPanelView — inline style 可改 Tailwind](#4-rightpanelview-inline-style-可改-tailwind)
5. [已确认保留项](#5-已确认保留项)
6. [汇总统计](#6-汇总统计)

---

## 1. ClassroomPanel — 答题结果卡片 inline style

**文件**: `src/pages/AIAgents/ClassroomPanel.tsx`

答题结果区域有大量条件 inline style，可以改为 `cn()` 条件 class。

### 1a. 答案结果卡片背景+边框（2 处）

| # | 行 | 当前代码 | 建议 |
|---|-----|---------|------|
| 1 | 746 | `style={{ background: isCorrect === true ? "var(--ws-color-success-soft)" : isCorrect === false ? "var(--ws-color-error-soft)" : "var(--ws-color-surface-2)", border: \`1px solid ${...}\` }}` | 改为 `cn("px-4 py-3 rounded-lg mb-4 border", isCorrect === true ? "bg-[var(--ws-color-success-soft)] border-[var(--ws-color-success)]" : isCorrect === false ? "bg-[var(--ws-color-error-soft)] border-[var(--ws-color-error-light)]" : "bg-surface-2 border-border-secondary")` |
| 2 | 811 | 同上（回顾模式） | 同上，改为 `cn(...)` |

### 1b. 答案文字颜色（4 处）

| # | 行 | 当前代码 | 建议 |
|---|-----|---------|------|
| 3 | 748 | `style={{ color: isCorrect === true ? "var(--ws-color-success)" : isCorrect === false ? "var(--ws-color-error)" : "var(--ws-color-text)" }}` | `className={cn("text-base font-bold", isCorrect === true ? "text-[var(--ws-color-success)]" : isCorrect === false ? "text-[var(--ws-color-error)]" : "text-text")}` |
| 4 | 813 | 同上（回顾模式） | 同上 |
| 5 | 766 | `style={{ color: isCorrectOpt ? "var(--ws-color-success)" : "var(--ws-color-text)", fontWeight: isCorrectOpt ? 600 : undefined }}` | `className={cn(isCorrectOpt ? "font-semibold text-[var(--ws-color-success)]" : "text-text")}` |
| 6 | 834 | 同上（回顾模式） | 同上 |

### 1c. 静态颜色 inline style（1 处）

| # | 行 | 当前代码 | 建议 |
|---|-----|---------|------|
| 7 | 819 | `style={{ color: "var(--ws-color-warning)" }}` | `className="text-[var(--ws-color-warning)]"` |

---

## 2. AssessmentPanel — 答案颜色 inline style

**文件**: `src/pages/AIAgents/AssessmentPanel.tsx`

| # | 行 | 当前代码 | 建议 |
|---|-----|---------|------|
| 1 | 917 | `style={{ color: a.is_correct ? "var(--ws-color-success)" : "var(--ws-color-error)" }}` | `className={a.is_correct ? "text-[var(--ws-color-success)]" : "text-[var(--ws-color-error)]"}` |

---

## 3. OptimizationDialog — border inline style

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/OptimizationDialog.tsx`

| # | 行 | 当前代码 | 建议 |
|---|-----|---------|------|
| 1 | 101 | `style={{ border: "1px solid var(--ws-color-border)" }}` | 加 `className="border border-border"`，删除 style |
| 2 | 188 | `style={{ border: "1px solid var(--ws-color-border)" }}` | 同上 |

> 注：行 206/238 的 `color-mix(...)` loading 遮罩保留，因为 `color-mix` 无法用 Tailwind 表达。

---

## 4. RightPanelView — inline style 可改 Tailwind

**文件**: `src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`

### 4a. softNoticeStyle 对象（4 种状态共用）

| # | 行 | 当前代码 | 建议 |
|---|-----|---------|------|
| 1 | 156-161 | `softNoticeStyle = { success: { marginTop: 8, padding: "8px 12px", background: "var(--ws-color-success-soft)", border: "1px solid var(--ws-color-border-secondary)", borderRadius: 8 }, ... }` | 改为 className map：`{ success: "mt-2 px-3 py-2 bg-[var(--ws-color-success-soft)] border border-border-secondary rounded-lg", warning: "...", info: "...", error: "..." }` |

使用处 2 处（行 539、548）也需相应修改：
```tsx
// Before: <div style={softNoticeStyle.info}>
// After:  <div className={softNoticeClass.info}>
```

### 4b. border inline style（3 处）

| # | 行 | 当前代码 | 建议 |
|---|-----|---------|------|
| 2 | 335 | `style={{ borderLeft: "1px solid var(--ws-color-border)" }}` | 加 `border-l border-l-border`，删除 style |
| 3 | 572 | `style={{ borderLeft: "1px solid var(--ws-color-border)", minHeight: 120 }}` | 改为 `className="border-l border-l-border" style={{ minHeight: 120 }}` |
| 4 | 346 | `style={{ borderBottomColor: "var(--ws-color-border-secondary)" }}` | 加 `border-b-border-secondary`，删除 style |

### 4c. toolButtonStyle 对象（10 处引用）

| # | 行 | 当前代码 | 建议 |
|---|-----|---------|------|
| 5 | 147 | `const toolButtonStyle = { width: 32, height: 32, padding: 0, borderRadius: 6 }` | 改为 className：`"h-8 w-8 p-0 rounded-md"` |

使用处（行 456/476/493/504/510/516/521/526/532 共 9 处）改为 `className="h-8 w-8 p-0 rounded-md"`。

---

## 5. 已确认保留项

| 文件 | 内容 | 保留原因 |
|------|------|----------|
| ClassroomPanel 573/594 | 条件 `color` (状态点 + boxShadow + outline) | 多值组合动态条件，inline style 合理 |
| AssessmentPanel 666-676 | 条件 `background/border/boxShadow` | 动态样式（选中/未选中/adaptive），inline style 合理 |
| AssessmentPanel 149 | `style={{ color: strokeColor }}` | 组件 prop 传入的动态颜色 |
| AssessmentPanel 951/559 | `position: fixed` + 动态 `top` | 浮动按钮/面板定位，必须 inline |
| OptimizationDialog 206/238 | `color-mix(in srgb, ...)` | Tailwind 不支持 color-mix |
| OptimizationDialog 103 | `position: relative; width: 100%; height: 100%` | 画布容器定位 |
| FloatingPopup 全文 | 拖拽定位 inline style | 动态计算值 |
| GroupDiscussionPanel 1001/1029 | `position: fixed` + 动态位置 | 浮动面板定位 |
| dialog/sheet/alert-dialog | `bg-black/80` overlay | shadcn/ui 默认值，全局一致 |
| RightPanelView 556-569 | resize handle style | 动态拖拽相关 |
| RightPanelView 572 `minHeight: 120` | 最小高度约束 | 动态值保留 |

---

## 6. 汇总统计

### 按问题类型

| 类型 | 数量 |
|------|------|
| 条件颜色 inline style → cn() | 8 处（ClassroomPanel 7 + AssessmentPanel 1） |
| border inline style → Tailwind | 5 处（OptimizationDialog 2 + RightPanelView 3） |
| softNoticeStyle 对象 → className map | 1 处定义 + 2 处使用 |
| toolButtonStyle → className | 1 处定义 + 9 处使用 |
| **需修改总计** | **~26 处**（含引用处） |
| 已确认保留 | ~15 处 |

### 按文件

| 文件 | 问题数 | 严重度 |
|------|--------|--------|
| ClassroomPanel.tsx | 7 | 中 — 答题结果 inline style |
| RightPanelView.tsx | 15（含引用） | 中 — softNoticeStyle + toolButtonStyle + border |
| AssessmentPanel.tsx | 1 | 低 |
| OptimizationDialog.tsx | 2 | 低 — border |

### 修复指南

**ClassroomPanel 答案结果卡片（行 746/811）**:
```tsx
// Before
<div className="px-4 py-3 rounded-lg mb-4" style={{ background: isCorrect === true ? "var(--ws-color-success-soft)" : ... }}>

// After
<div className={cn("px-4 py-3 rounded-lg mb-4 border",
  isCorrect === true
    ? "bg-[var(--ws-color-success-soft)] border-[var(--ws-color-success)]"
    : isCorrect === false
      ? "bg-[var(--ws-color-error-soft)] border-[var(--ws-color-error-light)]"
      : "bg-surface-2 border-border-secondary"
)}>
```

**RightPanelView softNoticeStyle（行 156-161）**:
```tsx
// Before
const softNoticeStyle = {
  success: { marginTop: 8, padding: "8px 12px", background: "var(--ws-color-success-soft)", ... },
  ...
};
// <div style={softNoticeStyle.info}>

// After
const softNoticeClass = {
  success: "mt-2 px-3 py-2 rounded-lg border border-border-secondary bg-[var(--ws-color-success-soft)]",
  warning: "mt-2 px-3 py-2 rounded-lg border border-border-secondary bg-[var(--ws-color-warning-soft)]",
  info:    "mt-2 px-3 py-2 rounded-lg border border-border-secondary bg-[var(--ws-color-info-soft)]",
  error:   "mt-2 px-3 py-2 rounded-lg border border-border-secondary bg-[var(--ws-color-error-soft)]",
} as const;
// <div className={softNoticeClass.info}>
```

**RightPanelView toolButtonStyle（行 147）**:
```tsx
// Before: style={toolButtonStyle}
// After:  className="h-8 w-8 p-0 rounded-md"
// 删除 toolButtonStyle 定义
```

**OptimizationDialog border（行 101/188）**:
```tsx
// Before: style={{ border: "1px solid var(--ws-color-border)" }}
// After:  className="... border border-border"  （删除 style）
```
