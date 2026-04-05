# 管理后台页面 UI 深度分析报告

> 对 19 个管理后台页面 + 布局组件进行深度分析的完整结果。
> 生成时间：2026-04-04 | 最后更新：2026-04-04（全部修复完成）

**状态：全部 ~114 处问题已修复 ✅**

---

## 目录

1. [DashboardPage](#1-dashboardpage)
2. [UsersPage](#2-userspage)
3. [ArticlesPage (Admin)](#3-articlespage-admin)
4. [ArticleEditorPage](#4-articleeditorpage)
5. [AssessmentPage](#5-assessmentpage)
6. [AssessmentEditorPage](#6-assessmenteditorpage)
7. [QuestionsPage](#7-questionspage)
8. [StatisticsPage](#8-statisticspage)
9. [AIAgentsPage (Admin)](#9-aiagentspage-admin)
10. [AgentDataPage](#10-agentdatapage)
11. [GroupDiscussionPage](#11-groupdiscussionpage)
12. [ClassroomInteractionPage](#12-classroominteractionpage)
13. [ClassroomPlanPage](#13-classroomplanpage)
14. [InformaticsPage (Admin)](#14-informaticspage-admin)
15. [TypstEditorPage](#15-typsteditorpage)
16. [ITTechnologyPage (Admin)](#16-ittechnologypage-admin)
17. [PersonalProgramsPage (Admin)](#17-personalprogramspage-admin)
18. [SystemPage](#18-systempage)
19. [NotFoundPage](#19-notfoundpage)
20. [布局 & 共享组件](#20-布局--共享组件)
21. [汇总统计](#21-汇总统计)

---

## 1. DashboardPage

**文件**: `src/pages/Admin/index.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 233 | `style={{ maxWidth: "1400px", margin: "0 auto", padding: 24 }}` | 内联样式硬编码 padding 24px | 改为 Tailwind `max-w-[1400px] mx-auto p-[var(--ws-space-4)]` |
| 2 | 246,253,260,267,295,312,337,362,408 | `bg-gray-50` | 硬编码灰色背景 (9 处) | `bg-surface-2` |
| 3 | 303,365,371,377,383,389,393,411,415,419,426,434 | `bg-white` | 硬编码白色背景 (12 处) | `bg-surface` |
| 4 | 277,303,365,371,377,383,389,393,407,411,415,419,426,434 | `border-black/[0.06]` 和 `border-black/5` | 硬编码边框色 (14 处) | `border-border` / `border-border-secondary` |
| 5 | 248,251,255,258,262,265,269,272 | `text-sky-500`, `text-emerald-500`, `text-violet-500`, `text-amber-500` | 图标颜色硬编码 (8 处) | 使用 `text-primary` / `text-[var(--ws-color-success)]` 等语义色 |

---

## 2. UsersPage

**文件**: `src/pages/Admin/Users/index.tsx`

无严重问题。已正确使用语义色 token 和组件抽象。

---

## 3. ArticlesPage (Admin)

**文件**: `src/pages/Admin/Articles/index.tsx`

无严重问题。已正确使用 Badge variant 和语义色。

---

## 4. ArticleEditorPage

**文件**: `src/pages/Admin/Articles/EditorPage.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 146 | `border-black/[0.06]` | 硬编码边框色 | `border-border` |

---

## 5. AssessmentPage

**文件**: `src/pages/Admin/Assessment/index.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 257 | `border-black/[0.08]` | 硬编码边框色 | `border-border` |
| 2 | 273 | `bg-blue-500/10 text-blue-600` | Badge 颜色硬编码 | 使用 Badge `variant="info"` |

---

## 6. AssessmentEditorPage

**文件**: `src/pages/Admin/Assessment/EditorPage.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 146 | `border-black/[0.06]` | 硬编码边框色 | `border-border` |

---

## 7. QuestionsPage

**文件**: `src/pages/Admin/Assessment/QuestionsPage.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 62-64 | `bg-sky-500/10 text-sky-600` 等 TYPE_MAP | 题型 Badge 颜色全部硬编码 | 改为 variant: `sky`/`success`/`warning` |
| 2 | 71-73 | `bg-emerald-500/10 text-emerald-600` 等 DIFF_MAP | 难度 Badge 颜色全部硬编码 | 改为 variant: `success`/`warning`/`danger` |
| 3 | 717,855,977 | `bg-white` | 硬编码白色背景 (3 处) | `bg-surface` |
| 4 | 717,855,959,977,1334 | `border-black/[0.06]` | 硬编码边框色 (5 处) | `border-border` |
| 5 | 682,1091 | `text-rose-600` | 文字颜色硬编码 | `text-destructive` |
| 6 | 1335 | `text-emerald-700` | 文字颜色硬编码 | `text-[var(--ws-color-success)]` |

---

## 8. StatisticsPage

**文件**: `src/pages/Admin/Assessment/StatisticsPage.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 84-86,92 | `bg-sky-500/10 text-sky-600` 等 badgeClass | 状态 Badge 颜色硬编码 | 使用 Badge variant |
| 2 | 736,795 | `bg-white` | 硬编码白色背景 | `bg-surface` |
| 3 | 736,737,777,795,796,851 | `border-black/[0.06]` 和 `border-black/[0.08]` | 硬编码边框色 (6 处) | `border-border` / `border-border-secondary` |

---

## 9. AIAgentsPage (Admin)

**文件**: `src/pages/Admin/AIAgents/index.tsx`

无严重问题。

---

## 10. AgentDataPage

**文件**: `src/pages/Admin/AgentData/index.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 57 | `<AdminPage padding={24}>` | padding 硬编码数字 | 使用 token |

---

## 11. GroupDiscussionPage

**文件**: `src/pages/Admin/AgentData/components/GroupDiscussion/index.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 987 | `border-black/10 bg-white` | 硬编码边框色 + 白色背景 | `border-border bg-surface` |
| 2 | 1034 | `border-black/[0.06]` | 硬编码边框色 | `border-border` |
| 3 | 1121,1225,1254,1309,1446,1454 | `border-black/[0.06] bg-white` | 多处硬编码 (6 处) | `border-border bg-surface` |
| 4 | 1559,1610 | `border-black/[0.06]` | 硬编码边框色 | `border-border` |
| 5 | 1267 | `hover:bg-black/[0.02]` | hover 背景硬编码 | `hover:bg-[var(--ws-color-hover-bg)]` |

---

## 12. ClassroomInteractionPage

**文件**: `src/pages/Admin/ClassroomInteraction/index.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 409-414 | `border-emerald-300 bg-emerald-50 text-emerald-700` 等 | Step 指示器颜色硬编码 | 使用 `--ws-color-success-soft` 等 token |
| 2 | 426 | `border-black/[0.08]` | 硬编码边框色 | `border-border` |
| 3 | 437 | `bg-white` | 白色背景硬编码 | `bg-surface` |
| 4 | 603,851 | `border-black/[0.06]` 和 `border-black/[0.08]` + `bg-white` | 硬编码边框和背景 | `border-border bg-surface` |

---

## 13. ClassroomPlanPage

**文件**: `src/pages/Admin/ClassroomPlan/index.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 183-185 | `bg-blue-500/10 text-blue-600` / `bg-slate-100 text-slate-500` | Step 指示器颜色硬编码 | `bg-[var(--ws-color-primary-soft)]` / `bg-surface-2` |
| 2 | 237,486,724 | `border-black/[0.06] bg-white` | 硬编码边框 + 白色背景 (3 处) | `border-border bg-surface` |
| 3 | 261,293,497 | `border-black/[0.04]` | 硬编码边框色 (3 处) | `border-border-secondary` |
| 4 | 263 | `bg-blue-50` | 高亮背景硬编码 | `bg-[var(--ws-color-primary-soft)]` |
| 5 | 294-295 | `bg-gray-50` | 交替行背景硬编码 | `bg-surface-2` |

---

## 14. InformaticsPage (Admin)

**文件**: `src/pages/Admin/Informatics/index.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 822 | `bg-gray-50` | 灰色背景硬编码 | `bg-surface-2` |
| 2 | 829-832 | `bg-emerald-500/10 text-emerald-600` 等 | 状态 Badge 颜色硬编码 | 使用 Badge variant |
| 3 | 856-859 | `bg-red-500`, `bg-emerald-500`, `bg-blue-500` | 进度条颜色硬编码 | `bg-[var(--ws-color-error)]` / `bg-[var(--ws-color-success)]` / `bg-[var(--ws-color-info)]` |

---

## 15. TypstEditorPage

**文件**: `src/pages/Admin/Informatics/typst/TypstSidebar.tsx`, `TypstNotesPanel.tsx`

### TypstNotesPanel.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 238-242 | `rgba(0,0,0,0.08)` + `rgba(14,165,233,0.08)` 内联样式 | 边框和背景色硬编码 | 改 Tailwind: `border-border-secondary` / `bg-primary-soft` |
| 2 | 202,261,312,326,329 | `border-black/[0.04]` 和 `border-black/[0.06]` | 硬编码边框色 (5 处) | `border-border-secondary` / `border-border` |

### TypstSidebar.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 3 | 335 | `border: "1px solid rgba(0,0,0,0.06)"` 内联样式 | 内联硬编码边框色 | `border border-border` Tailwind class |
| 4 | 344-350 | `padding: "8px 10px"`, `borderBottom: "1px solid rgba(0,0,0,0.04)"` | 内联样式硬编码 | 改为 Tailwind class |
| 5 | 143 | `padding: "4px 0"` 内联样式 | 间距硬编码 | `py-1` 或 token |
| 6 | 84 | `gap-[10px]` | gap 魔术数字 | `gap-[var(--ws-space-1)]` |
| 7 | 174 | 侧边栏折叠按钮 | 缺少 `aria-label` | 添加 `aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}` |

---

## 16. ITTechnologyPage (Admin)

**文件**: `src/pages/Admin/ITTechnology/index.tsx`

无严重问题。

---

## 17. PersonalProgramsPage (Admin)

无严重问题。

---

## 18. SystemPage

**文件**: `src/pages/Admin/System/TypstMetrics.tsx`

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 50 | `border-black/[0.06]` | 硬编码边框色 | `border-border` |

---

## 19. NotFoundPage

**文件**: `src/pages/NotFound/index.tsx`

无严重问题。页面简单，当前样式可接受。

---

## 20. 布局 & 共享组件

### AdminLayout.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 228 | `z-[90]` | z-index 硬编码 | `z-[var(--ws-z-overlay)]` |
| 2 | 234 | `z-[100] border-black/5 bg-white` | z-index 硬编码 + 边框/背景硬编码 | `z-[var(--ws-z-header)] border-border-secondary bg-surface` |
| 3 | 347 | `z-[99] border-black/[0.04] bg-white` | z-index 硬编码 + 边框/背景硬编码 | `z-[var(--ws-z-sticky)] border-border-secondary bg-surface` |

### AdminAppCard.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 4 | 36 | `border-black/5` | 硬编码边框色 | `border-border-secondary` |

### AdminTablePanel.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 52 | `border-black/[0.04]` | 硬编码边框色 | `border-border-secondary` |

---

## 21. 汇总统计

### 按问题类型

| 类型 | 数量 | 占比 |
|------|------|------|
| `border-black/[opacity]` 硬编码边框 | ~55 处 | 48% |
| `bg-white` 硬编码白色背景 | ~20 处 | 17% |
| `bg-gray-50` / `bg-slate-100` 硬编码灰色 | ~12 处 | 10% |
| Badge/状态颜色硬编码 (bg-xxx-500/10) | ~10 处 | 9% |
| z-index 硬编码 | 3 处 | 3% |
| 内联样式 (rgba, padding) | ~8 处 | 7% |
| 文字颜色硬编码 (text-rose/emerald) | ~5 处 | 4% |
| 无障碍缺失 | 1 处 | 1% |
| **总计** | **~114** | |

### 按页面严重度

| 页面 | 问题数 | 严重度 |
|------|--------|--------|
| DashboardPage (Admin/index.tsx) | ~43 | 高 — bg-gray-50, bg-white, border-black 大量重复 |
| QuestionsPage | ~15 | 高 — Badge 颜色体系硬编码 |
| GroupDiscussionPage | ~10 | 中 — border-black + bg-white 分散 |
| ClassroomPlanPage | ~10 | 中 |
| ClassroomInteractionPage | ~6 | 中 |
| StatisticsPage | ~8 | 中 |
| TypstEditor (Sidebar+NotesPanel) | ~12 | 中 — 内联样式 + border-black |
| AdminLayout.tsx | 3 | 高 — z-index 硬编码 |
| InformaticsPage (Admin) | 3 | 中 |
| 其余页面 (各 0-2 处) | ~4 | 低 |

### 批量修复建议

**全局搜索替换 (影响最大)**:

```
border-black/[0.06]  →  border-border          (~30 处)
border-black/[0.04]  →  border-border-secondary (~15 处)
border-black/5       →  border-border-secondary (~5 处)
border-black/[0.08]  →  border-border           (~5 处)
border-black/10      →  border-border           (~2 处)
bg-white             →  bg-surface              (~20 处，仅管理后台)
bg-gray-50           →  bg-surface-2            (~12 处)
```

**Badge variant 迁移 (QuestionsPage + StatisticsPage)**:
- TYPE_MAP / DIFF_MAP className → variant prop
- badgeClass string → variant string

**AdminLayout z-index**:
- `z-[90]` → `z-[var(--ws-z-overlay)]`
- `z-[99]` → `z-[var(--ws-z-sticky)]`
- `z-[100]` → `z-[var(--ws-z-header)]`
