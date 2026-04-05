# 弹窗 / Dialog UI 深度分析报告

> 对 12 个弹窗 + 2 个登录弹窗进行两轮深度分析的完整结果。
> 生成时间：2026-04-04

---

## 目录

1. [CategoryManageModal](#1-categorymanagemodal)
2. [MarkdownStyleManagerModal](#2-markdownstylemanagermodal)
3. [UserDetailModal](#3-userdetailmodal)
4. [AgentDetail](#4-agentdetail)
5. [AgentConfigModal](#5-agentconfigmodal)
6. [DetailModal (AgentData)](#6-detailmodal-agentdata)
7. [XbkAnalysisModal](#7-xbkanalysismodal)
8. [XbkEditModal](#8-xbkeditmodal)
9. [XbkDeleteModal](#9-xbkdeletemodal)
10. [XbkExportModal](#10-xbkexportmodal)
11. [XbkImportModal](#11-xbkimportmodal)
12. [LoginForm (BasicLayout)](#12-loginform-basiclayout)
13. [LoginForm (AdminLayout)](#13-loginform-adminlayout)
14. [跨弹窗一致性问题](#14-跨弹窗一致性问题)
15. [汇总统计](#15-汇总统计)

---

## 1. CategoryManageModal

**文件**: `src/pages/Admin/Articles/CategoryManageModal.tsx`

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 532-536 | `bg-sky-500/10 text-sky-600` / `bg-slate-500/10 text-slate-600` | Badge 颜色硬编码 | `variant="info"` / `variant="neutral"` |
| 2 | 579 | `text-rose-600 hover:text-rose-600` | 删除按钮颜色硬编码 | `text-destructive` |
| 3 | 727 | `border-sky-100 bg-sky-50/70` | 选中卡片背景硬编码 | `border-primary/20 bg-primary-soft` |

### 布局

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 4 | 617 | `max-h-[90vh] overflow-y-auto` 在 DialogContent 上 | 整个弹窗滚动，应改为内部内容区滚动 | 将 overflow-y-auto 移至内部内容容器 |

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 648-654 | 筛选按钮 | 缺少 `aria-label` | 添加 `aria-label="筛选"` |

---

## 2. MarkdownStyleManagerModal

**文件**: `src/pages/Admin/Articles/components/MarkdownStyleManagerModal.tsx`

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 163-181 | 删除按钮 | 缺少 `aria-label` | 添加 `aria-label="删除样式方案"` |

无其他严重问题。

---

## 3. UserDetailModal

**文件**: `src/pages/Admin/Users/components/UserDetailModal.tsx`

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 19 | `bg-black/[0.01]` | DetailItem 背景硬编码 | `bg-surface-2` |

---

## 4. AgentDetail

**文件**: `src/pages/Admin/AIAgents/components/AgentDetail.tsx`

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 38 | `bg-black/[0.01]` | FieldItem 背景硬编码 | `bg-surface-2` |
| 2 | 63 | `bg-black/[0.03]` | Badge 背景硬编码 | `bg-surface-2` 或 `variant="outline"` |

---

## 5. AgentConfigModal

**文件**: `src/pages/Admin/ITTechnology/components/AgentConfigModal.tsx`

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 211 | `border-emerald-500/25 bg-emerald-500/5` | Alert 成功态颜色硬编码 | `border-[var(--ws-color-success)]/25 bg-[var(--ws-color-success-soft)]` |

---

## 6. DetailModal (AgentData)

**文件**: `src/pages/Admin/AgentData/components/DetailModal.tsx`

### 颜色硬编码 (重点)

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 142,178 | `bg-black/[0.01]` | 详情卡片背景硬编码 | `bg-surface-2` |
| 2 | 148 | `bg-black/[0.03]` | Badge 背景硬编码 | `bg-surface-2` |
| 3 | 201-204 | `border-emerald-500/20 bg-emerald-500/10 text-emerald-600` / `border-red-500/20 bg-red-500/10 text-red-600` | 用户状态 Badge 硬编码 | `variant="success"` / `variant="danger"` |
| 4 | 272-278 | `border-emerald-500/20 bg-emerald-500/10` / `border-cyan-500/20 bg-cyan-500/10` | 消息类型 Badge 硬编码 | `variant="primarySubtle"` / `variant="success"` / `variant="cyan"` |
| 5 | 335 | `border-black/[0.05]` | 边框色硬编码 | `border-border-secondary` |

### Alert 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 6 | 214,242,297 | `border-amber-500/20 bg-amber-500/10` | 警告 Alert 颜色硬编码 (3 处) | `border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]` |
| 7 | 323 | `border-primary/20 bg-primary/5` | 信息 Alert 颜色硬编码 | `border-primary/20 bg-primary-soft` |

---

## 7. XbkAnalysisModal

**文件**: `src/pages/Xbk/components/XbkAnalysisModal.tsx`

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 45 | `border-black/[0.06]` | StatCard 边框硬编码 | `border-border` |
| 2 | 99-114 | `border-red-500/20 bg-red-500/10 text-red-600` / `border-amber-500/20 bg-amber-500/10 text-amber-600` | 课程配额 Badge 硬编码 | `variant="danger"` / `variant="warning"` |

---

## 8. XbkEditModal

**文件**: `src/pages/Xbk/components/XbkEditModal.tsx`

无严重颜色/边框问题。

### 表单一致性

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 308,324,340 等 | 自定义 `ws-modal-label` class | 与其他弹窗使用 FormLabel 不一致 | 统一为 FormLabel 或全部用自定义 class |

---

## 9. XbkDeleteModal

**文件**: `src/pages/Xbk/components/XbkDeleteModal.tsx`

### Alert 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 75 | `border-amber-500/20 bg-amber-500/10 text-amber-700 [&>svg]:text-amber-700` | 警告 Alert 全部硬编码 | `border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)] text-[var(--ws-color-warning)]` |

---

## 10. XbkExportModal

**文件**: `src/pages/Xbk/components/XbkExportModal.tsx`

无严重问题。

---

## 11. XbkImportModal

**文件**: `src/pages/Xbk/components/XbkImportModal.tsx`

### 颜色硬编码

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 237 | `border-black/[0.08] bg-black/[0.02]` | 文件芯片边框/背景硬编码 | `border-border bg-surface-2` |
| 2 | 268 | `border-primary/20 bg-primary/5` | 加载 Alert 背景硬编码 | `bg-primary-soft` |
| 3 | 275-280 | `border-amber-500/25 bg-amber-500/10` / `border-emerald-500/20 bg-emerald-500/10` | 预览 Alert 颜色硬编码 | token 化 |
| 4 | 309 | `border-emerald-500/20 bg-emerald-500/10` | 成功 Alert 颜色硬编码 | token 化 |

---

## 12. LoginForm (BasicLayout)

**文件**: `src/components/Auth/LoginForm.tsx`

### 输入框

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 129,151 | `pl-9 h-11` | 输入框高度和左 padding 硬编码 | `h-[var(--ws-control-height)]` |

### 错误提示

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 2 | 133 | `text-sm text-destructive` | 错误字号 text-sm，其他弹窗用 text-xs | 统一为 `text-xs` |

---

## 13. LoginForm (AdminLayout)

**文件**: `src/layouts/AdminLayout.tsx` (登录部分)

无严重颜色/边框问题（z-index 和 border 已在管理后台报告中修复）。

---

## 14. 跨弹窗一致性问题

### A. Badge variant 未迁移 (5 处)

| 文件 | 行 | 当前 className | 应改为 |
|------|-----|---------------|--------|
| CategoryManageModal.tsx | 532-536 | `bg-sky-500/10 text-sky-600` | `variant="info"` |
| AgentDetail.tsx | 63 | `bg-black/[0.03]` | `variant="outline"` 或 `bg-surface-2` |
| DetailModal.tsx | 201-204 | `bg-emerald-500/10` / `bg-red-500/10` | `variant="success"` / `variant="danger"` |
| DetailModal.tsx | 272-278 | `bg-emerald-500/10` / `bg-cyan-500/10` | `variant="success"` / `variant="cyan"` |
| XbkAnalysisModal.tsx | 99-114 | `bg-red-500/10` / `bg-amber-500/10` | `variant="danger"` / `variant="warning"` |

### B. Alert 颜色硬编码 (8 处)

| 文件 | 行 | 颜色 | 语义 |
|------|-----|------|------|
| AgentConfigModal.tsx | 211 | `emerald-500` | 成功 → `success-soft` token |
| DetailModal.tsx | 214 | `amber-500` | 警告 → `warning-soft` token |
| DetailModal.tsx | 242 | `amber-500` | 警告 → `warning-soft` token |
| DetailModal.tsx | 297 | `amber-500` | 警告 → `warning-soft` token |
| DetailModal.tsx | 323 | `primary/5` | 信息 → `primary-soft` token |
| XbkDeleteModal.tsx | 75 | `amber-500` + `amber-700` | 警告 → `warning-soft` + `warning` token |
| XbkImportModal.tsx | 275-280 | `amber-500` / `emerald-500` | 警告/成功 → token |
| XbkImportModal.tsx | 309 | `emerald-500` | 成功 → `success-soft` token |

### C. `bg-black/[0.0x]` 残留 (6 处)

| 文件 | 行 | 值 | 建议 |
|------|-----|-----|------|
| UserDetailModal.tsx | 19 | `bg-black/[0.01]` | `bg-surface-2` |
| AgentDetail.tsx | 38 | `bg-black/[0.01]` | `bg-surface-2` |
| AgentDetail.tsx | 63 | `bg-black/[0.03]` | `bg-surface-2` |
| DetailModal.tsx | 142,178 | `bg-black/[0.01]` | `bg-surface-2` |
| DetailModal.tsx | 148 | `bg-black/[0.03]` | `bg-surface-2` |
| DetailModal.tsx | 335 | `border-black/[0.05]` | `border-border-secondary` |

### D. `border-black/[0.0x]` 残留 (3 处)

| 文件 | 行 | 值 | 建议 |
|------|-----|-----|------|
| XbkAnalysisModal.tsx | 45 | `border-black/[0.06]` | `border-border` |
| XbkImportModal.tsx | 237 | `border-black/[0.08]` | `border-border` |
| DetailModal.tsx | 335 | `border-black/[0.05]` | `border-border-secondary` |

### E. 错误提示字号不一致

| 文件 | 行 | 字号 |
|------|-----|------|
| LoginForm.tsx | 133 | `text-sm` |
| XbkEditModal.tsx | 319 | `text-xs` |
| AgentConfigModal.tsx | 162 | `text-xs` |

**建议**: 统一为 `text-xs`。

### F. Spinner 尺寸不一致

| 文件 | 行 | 尺寸 | 颜色 |
|------|-----|------|------|
| CategoryManageModal.tsx | 236 | `h-4 w-4` | 无 |
| AgentConfigModal.tsx | 150 | `h-8 w-8` | `text-text-tertiary` |
| DetailModal.tsx | 255 | `h-5 w-5` | `text-text-tertiary` |
| XbkImportModal.tsx | 269 | `h-4 w-4` | `text-primary` |

**建议**: 按钮内 Spinner 统一 `h-4 w-4`，页面级 Spinner 统一 `h-8 w-8 text-text-tertiary`。

---

## 15. 汇总统计

### 按问题类型

| 类型 | 数量 |
|------|------|
| Badge className 硬编码 (应迁移 variant) | 5 处 |
| Alert 颜色硬编码 (amber/emerald/primary) | 8 处 |
| `bg-black/[0.0x]` 背景硬编码 | 6 处 |
| `border-black/[0.0x]` 边框硬编码 | 3 处 |
| 文字颜色硬编码 (rose/emerald) | 1 处 |
| 选中态颜色硬编码 (sky-100/sky-50) | 1 处 |
| 文件芯片颜色硬编码 | 1 处 |
| 跨弹窗不一致 (错误字号/Spinner) | 2 类 |
| **总计** | **~27 处** |

### 按弹窗

| 弹窗 | 问题数 | 严重度 |
|------|--------|--------|
| DetailModal (AgentData) | 9 | 高 |
| CategoryManageModal | 4 | 中 |
| XbkImportModal | 4 | 中 |
| XbkAnalysisModal | 2 | 中 |
| AgentDetail | 2 | 低 |
| UserDetailModal | 1 | 低 |
| AgentConfigModal | 1 | 低 |
| XbkDeleteModal | 1 | 低 |
| LoginForm | 1 | 低 |
| MarkdownStyleManagerModal | 0 | - |
| XbkEditModal | 0 | - |
| XbkExportModal | 0 | - |

### 批量修复建议

**Badge variant 迁移 (5 处)**:
```
bg-sky-500/10 text-sky-600           → variant="info"
bg-emerald-500/10 text-emerald-600   → variant="success"
bg-red-500/10 text-red-600           → variant="danger"
bg-amber-500/10 text-amber-600       → variant="warning"
bg-cyan-500/10 text-cyan-600         → variant="cyan"
bg-black/[0.03]                      → variant="outline" 或 bg-surface-2
```

**Alert 颜色统一 (8 处)**:
```
border-amber-500/20 bg-amber-500/10  → border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]
border-emerald-500/25 bg-emerald-500/5 → border-[var(--ws-color-success)]/25 bg-[var(--ws-color-success-soft)]
border-primary/20 bg-primary/5       → border-primary/20 bg-primary-soft
```

**背景/边框替换**:
```
bg-black/[0.01]     → bg-surface-2
bg-black/[0.03]     → bg-surface-2
bg-black/[0.02]     → bg-surface-2
border-black/[0.05] → border-border-secondary
border-black/[0.06] → border-border
border-black/[0.08] → border-border
```
