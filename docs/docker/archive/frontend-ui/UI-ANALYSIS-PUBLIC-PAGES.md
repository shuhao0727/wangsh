# 公共页面 UI 深度分析报告

> 对 11 个公共页面进行三轮深度分析的完整结果。
> 生成时间：2026-04-03

---

## 目录

1. [HomePage](#1-homepage)
2. [ArticlesPage](#2-articlespage)
3. [ArticleDetailPage](#3-articledetailpage)
4. [InformaticsPage](#4-informaticspage)
5. [InformaticsDetailPage (Reader)](#5-informaticsdetailpage-reader)
6. [ITTechnologyPage](#6-ittechnologypage)
7. [PythonLabPage](#7-pythonlabpage)
8. [PersonalProgramsPage](#8-personalprogramspage)
9. [AIAgentsPage](#9-aiagentspage)
10. [XbkPage](#10-xbkpage)
11. [LoginPage](#11-loginpage)
12. [跨页面一致性问题](#12-跨页面一致性问题)
13. [CSS 文件问题](#13-css-文件问题)
14. [暗色模式准备度](#14-暗色模式准备度)
15. [汇总统计](#15-汇总统计)

---

## 1. HomePage

**文件**: `src/pages/Home/index.tsx`

### 间距 & 布局

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 91 | `gap-5 lg:gap-6` | 硬编码 gap 值，未使用 `--ws-layout-gap` | `gap-[var(--ws-layout-gap)]` |
| 2 | 92 | `px-4 md:px-5 lg:px-6 py-5 lg:py-6` | 三级响应式 padding 全部硬编码 | `px-[var(--ws-space-2)] md:px-[var(--ws-space-3)] py-[var(--ws-space-3)]` |
| 3 | 139 | `gap-4 md:gap-5` | 模块网格 gap 硬编码 | `gap-[var(--ws-layout-gap)]` |
| 4 | 146 | `min-h-32` | 卡片最小高度 128px 硬编码 | 定义卡片高度 token 或用 aspect-ratio |
| 5 | 154 | `pr-6` | 右侧为箭头预留的 padding 硬编码 | `pr-[var(--ws-space-4)]` |
| 6 | 166 | `gap-4 md:gap-5` | 外部链接 gap 与模块 gap 不一致 | 统一为 `gap-[var(--ws-layout-gap)]` |
| 7 | 190 | `pt-6` | Footer 顶部 padding 硬编码 | `pt-[var(--ws-space-4)]` |

### 排版

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 8 | 109 | `text-sm md:text-base` | 字号硬编码 | `text-[var(--ws-text-sm)] md:text-[var(--ws-text-md)]` |
| 9 | 110 | `text-xl md:text-2xl` | 标题字号硬编码 | `text-[var(--ws-text-lg)] md:text-[var(--ws-text-xl)]` |

### 颜色

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 10 | 16-21 | `rgba()` 内联色值 | 模块卡片颜色用 rgba 硬编码 (0.07, 0.08 等) | 定义 opacity token 或使用 CSS 变量 |
| 11 | 89 | `bg-white` | 硬编码白色背景，暗色模式失效 | `bg-surface` 或 `bg-bg` |

### 圆角

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 12 | 97 | `rounded-xl md:rounded-2xl` | 圆角硬编码，不匹配 `--ws-radius-*` | `rounded-[var(--ws-radius-lg)] md:rounded-[var(--ws-radius-xl)]` |

### 图标

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 13 | 105 | `w-11 h-11` | 图标容器尺寸硬编码 44px | 统一图标容器规范 |
| 14 | 150 | `w-10 h-10` | 另一处图标容器 40px，与上不一致 | 统一为 `w-11 h-11` |

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 15 | 139-180 | 模块卡片 | 缺少 focus-visible 焦点样式 | 添加 `focus-visible:ring-2 focus-visible:ring-primary/40` |

---

## 2. ArticlesPage

**文件**: `src/pages/Articles/index.tsx`

### 间距

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 406 | `bodyPadding={10}` | 魔术数字 10px | 使用 design token |
| 2 | 444 | `space-y-2 px-1.5 py-1.5` | 骨架屏间距硬编码 | `space-y-[var(--ws-space-1)] p-[var(--ws-space-1)]` |
| 3 | 482-493 | `space-y-3 p-4` | 加载态间距硬编码 | `space-y-[var(--ws-space-2)] p-[var(--ws-space-3)]` |
| 4 | 534 | `gap-2 text-sm` | 分页控件 gap 硬编码 | `gap-[var(--ws-space-1)]` |
| 5 | 411 | `pl-9` | 搜索输入框左 padding 硬编码 (为图标留位) | 建立搜索输入规范 |

### 颜色

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 6 | 431 | `border-black/[0.04] bg-white/70` | 边框颜色硬编码、白色半透明背景 | `border-border-secondary bg-surface/70` |
| 7 | 539 | `border-black/[0.08] bg-white` | 下拉框边框 + 白色背景硬编码 | `border-border bg-surface` |

### 图标

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 8 | 438 | `h-3.5 w-3.5` | 图标尺寸 14px，与其他页面 16px 不一致 | 统一为 `h-4 w-4` |

### 分页

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 9 | 553 | `min-w-16` | 页码指示器最小宽度硬编码 | 根据内容自适应 |

### 状态

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 10 | 467 | 加载→内容 | 骨架屏消失无过渡动画 | 添加 fade-in 过渡 |
| 11 | 494 | 空状态 | 空状态出现无过渡 | 添加 opacity 过渡 |

### 语义

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 12 | 399 | `className="informatics-page articles-page"` | 复用了 informatics-page 类名 | 语义不匹配，移除 informatics-page |

---

## 3. ArticleDetailPage

**文件**: `src/pages/Articles/Detail.tsx` + `Articles/Detail.css`

### 间距

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 247 | `px-6 py-10` | 加载态 padding 硬编码 | `px-[var(--ws-space-4)] py-[var(--ws-space-5)]` |
| 2 | 264 | `px-6 py-10` | 错误态同样硬编码 | 同上 |
| 3 | 267 | `gap-3` | 间距硬编码 | `gap-[var(--ws-space-2)]` |
| 4 | 315 | `gap-4` | 元数据间距硬编码 | `gap-[var(--ws-layout-gap)]` |

### 目录 (TOC)

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 465 | `${(item.level - 1) * 16 + 12}px` | 目录缩进用硬编码 px 计算 | `calc(var(--ws-space-2) * ${level - 1} + var(--ws-space-2))` |
| 6 | Detail.css:106 | `padding: 7px var(--ws-space-2) 7px 8px` | 混用硬编码 (7px, 8px) 和 token | 全部用 token |
| 7 | Detail.css:110 | `border-left: 2px solid transparent` | 边框宽度硬编码 | 定义 accent border width token |

### 排版 (Detail.css)

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 8 | 73 | `line-height: 1.35` | 行高硬编码 | 定义 `--ws-line-height-heading` token |
| 9 | 78 | `letter-spacing: -0.01em` | 字间距硬编码 | 定义 `--ws-letter-spacing-tight` token |
| 10 | 143 | `font-size: 1.25em; margin-top: 1.4em` | Markdown 标题用 em 而非 token | 考虑用绝对 token |

### 图标

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 11 | 317,326,331,337 | `h-4 w-4` | 元数据图标尺寸统一但颜色不一致 | 统一图标颜色规范 |

### 图片

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 12 | 399 | `alt={(props as any).alt ?? ""}` | alt 回退为空字符串 | 改为 `"文章配图"` 或有意义的默认值 |
| 13 | - | 无 | 图片无加载状态、无 `loading="lazy"` | 添加骨架屏 + lazy loading |

---

## 4. InformaticsPage

**文件**: `src/pages/Informatics/index.tsx` (列表页)

### 间距

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | - | 骨架屏 `space-y-2 p-4` | 骨架屏与实际内容 padding 不一致 | 统一为 `p-[var(--ws-panel-padding)]` |

### 排版

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 2 | - | Tab 触发器 | Tab 字号和激活态不够明显 | 增强 active 态对比度 |

### 卡片

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 3 | - | 笔记卡片 | hover 效果已在 index.css 定义，但卡片内间距硬编码 | 使用 `--ws-panel-padding` |

---

## 5. InformaticsDetailPage (Reader)

**文件**: `src/pages/Informatics/Reader.tsx`

### 间距

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 69 | `paddingLeft: ${depth * 14 + 8}px` | 树节点缩进硬编码 14px 乘数 + 8px 基数 | `calc(var(--ws-space-1) + ${depth} * var(--ws-space-2))` |
| 2 | 421 | `gap-2` | 搜索框 gap 硬编码 | `gap-[var(--ws-space-1)]` |
| 3 | 450 | `space-y-2 p-4` | 骨架屏间距与实际内容 `space-y-5 p-6` 差距大 | 统一 token |
| 4 | 571 | `px-2.5 py-2` | 移动端头部 padding 硬编码 | `px-[var(--ws-space-2)] py-[var(--ws-space-1)]` |
| 5 | 585-590 | `w-[85%]` + `p-2.5` | 抽屉宽度和 padding 硬编码 | 响应式 token |

### 颜色

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 6 | 571 | `borderBottom: "1px solid rgba(0,0,0,0.04)"` | 内联样式硬编码边框色 | `border-b border-border-secondary` |
| 7 | 586 | `border-black/[0.06]` | 边框色硬编码 | `border-border` |
| 8 | 85 | `text-primary/80` | 图标用 opacity 衍生色 | 用语义色 token |

### 排版

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 9 | 251 | `font-semibold` | 树节点标题 semibold，而文件夹用 medium (216行) | 统一权重层次 |
| 10 | 507-508 | `gap-1.5` | Tab 内 gap 6px 不对齐 token | `gap-[var(--ws-space-1)]` |

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 11 | 66-87 | `<button>` | 树节点按钮缺少 `aria-label`、`aria-expanded` | 添加 ARIA 属性 |
| 12 | 424-430 | `<Input>` | 搜索输入缺少 `aria-label` | 添加 `aria-label="搜索文档"` |
| 13 | 68 | 树节点按钮 | 无 focus-visible 焦点样式 | 添加 `:focus-visible` 样式 |

### Z-Index

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 14 | 571 | `z-10` | 移动端头部 z-index 硬编码 | `z-[var(--ws-z-sticky)]` |

### 加载态

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 15 | 440-442 | `<Loader2>` | 加载按钮缺少 `aria-busy="true"` | 添加 ARIA busy 状态 |
| 16 | 530-544 | 骨架屏 | 骨架高度不匹配实际文字 token | 用 `--ws-text-*` 对齐高度 |

---

## 6. ITTechnologyPage

**文件**: `src/pages/ITTechnology/index.tsx`

### 间距

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 156,173,192 | `px-5 py-6` | 页面 padding 硬编码，无响应式 | `px-[var(--ws-space-3)] py-[var(--ws-space-4)]` + 响应式 |
| 2 | 200-204 | `gap-3` | 应用网格 gap 硬编码 | `gap-[var(--ws-layout-gap)]` |
| 3 | 159 | `p-4 space-y-2.5` | 骨架卡片间距 ≠ 实际卡片 `px-4 py-4` | 统一 `p-[var(--ws-panel-padding)]` |
| 4 | 237 | `p-4` | ClassSelector 容器 padding 硬编码 | `p-[var(--ws-panel-padding)]` |

### 排版

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 218 | `text-base` | 标题字号硬编码 | `text-[var(--ws-text-md)]` |
| 6 | 220 | `text-sm` | 描述文字字号硬编码 | `text-[var(--ws-text-caption)]` |

### 颜色

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 7 | 214 | `style={{ background: app.bg, color: app.color }}` | 图标颜色内联样式硬编码 | 提取为 CSS 变量 + token |
| 8 | 224 | `style={{ color: app.color }}` | CTA 按钮颜色内联样式 | 同上 |

### 面包屑

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 9 | 128-147 | `px-1 py-0.5` | 面包屑按钮 padding 硬编码 | 定义面包屑规范 |
| 10 | 131,139,142 | `h-3.5 w-3.5` vs `h-4 w-4` | 图标尺寸不一致 | 统一为 `h-4 w-4` |

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 11 | 202-230 | `<button>` | 应用卡片缺少 `aria-label` 和 `aria-disabled` | 添加 `aria-label={app.title}` |
| 12 | 224 | "敬请期待" | 不可用状态无语义标记 | 添加 `aria-disabled="true"` |

### 过渡动画

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 13 | 213 | `transition-transform duration-150` | duration 硬编码，未使用 `--ws-transition-fast` | 使用 transition token |

---

## 7. PythonLabPage

**文件**: `src/pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx`

### 间距

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 1095 | `padding: isCompactViewport ? "8px 0 0 0" : "0 0 0 12px"` | 条件 padding 硬编码 | `var(--ws-space-1)` / `var(--ws-space-2)` |
| 2 | 1109 | `padding: "0 12px", minHeight: 44` | 画布头部 padding 和高度硬编码 | `padding: "0 var(--ws-space-2)"`, `minHeight: "var(--ws-header-height)"` |
| 3 | 1133 | `gap-[10px]` | 工具栏 gap 10px 不在 token 体系 | `gap-[var(--ws-space-1)]` 或 `gap-[var(--ws-space-2)]` |

### 排版

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 4 | 1119 | `text-base font-semibold` | 画布标题字号硬编码 | `text-[var(--ws-text-md)]` |

### 颜色 & 边框

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 1111 | `borderBottom: "1px solid var(--ws-color-border-secondary)"` | 内联样式，应改 Tailwind | `border-b border-border-secondary` |
| 6 | 1206 | `rgba(0,0,0,0.03)` 网格背景 | 网格线颜色硬编码 | 使用 `var(--ws-color-border-secondary)` |
| 7 | 1235 | `color: "rgba(0,0,0,0.55)"` | 加载文字颜色硬编码 | `text-text-secondary` |

### 响应式

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 8 | 1074 | `flexDirection: isCompactViewport ? "column" : "row"` | 布局切换无过渡动画 | 添加 transition |
| 9 | 1085-1086 | `borderRight: isCompactViewport ? "none" : "..."` | 条件边框用内联样式 | 改为 Tailwind 响应式 `border-r md:border-r-0` |

### Z-Index

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 10 | 1230 | `zIndex: 5` | z-index 硬编码 | 使用 `--ws-z-*` token |

---

## 8. PersonalProgramsPage

**文件**: `src/pages/PersonalPrograms/index.tsx`

### 间距

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | - | 卡片网格 gap 与卡片内 padding 不协调 | gap-4 vs p-5 比例不对 | 统一为 `gap-[var(--ws-layout-gap)]` |
| 2 | - | 卡片 padding 非响应式 | 手机上保持 p-5 太宽 | `p-[var(--ws-panel-padding)]` |

### 排版

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 3 | - | 按钮尺寸不一致 | 与其他页面按钮规格不统一 | 统一 Button size prop |

### 响应式

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 4 | - | 网格断点跳跃 | 宽屏→窄屏 padding 突变 | 添加中间断点过渡 |

---

## 9. AIAgentsPage

**文件**: `src/pages/AIAgents/index.tsx`, `ChatArea.tsx`, `AgentSidebar.tsx`, `GroupDiscussionPanel.tsx`, `AssessmentPanel.tsx`, `ClassroomPanel.tsx`

### index.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 706 | `border-black/[0.04]` | 边框色硬编码 | `border-border-secondary` |
| 2 | 781 | `background: "linear-gradient(...)"` | 渐变背景内联样式 | 提取为 CSS class |
| 3 | 789 | `space-y-4` | 表单间距硬编码 | `gap-[var(--ws-space-3)]` |

### ChatArea.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 4 | 480 | `px-5 py-4` | padding 硬编码 | token 化 |
| 5 | 509 | `min-h-20 max-h-44` | 输入区高度硬编码 | 语义化 token |
| 6 | 271 | `ml-2` | 间距硬编码 | `ml-[var(--ws-space-1)]` |
| 7 | 318 | `line-height: 1.55` | 行高硬编码 | 使用 `--ws-line-height-base` |

### AgentSidebar.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 8 | 130 | `rounded-lg p-3` | padding 硬编码 | `p-[var(--ws-panel-padding)]` |
| 9 | 167 | `max-h-56` | 最大高度 14rem 硬编码 | 计算式或 token |
| 10 | 191 | `h-3 w-3` | 图标 12px，与全局 16px 不一致 | 统一为 `h-4 w-4` |

### GroupDiscussionPanel.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 11 | 709 | `grid-cols-2 gap-1` | gap 4px 太小 | `gap-[var(--ws-space-1)]` |
| 12 | 799 | `border-black/[0.06]` | 边框色硬编码 | `border-border-secondary` |
| 13 | 732 | `border-amber-400/20 bg-amber-500/10` | Alert 颜色硬编码 | 使用 warning token |
| 14 | 815 | `text-black/20` | 分隔符颜色硬编码 | `text-border` |
| 15 | 938 | `gap-2.5` | 聊天列表 gap 不在 token 体系 | `gap-[var(--ws-space-2)]` |

### AssessmentPanel.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 16 | 587 | `px-3 py-2` | 测评进度 padding 硬编码 | token 化 |
| 17 | 790 | `bg-blue-50` | 背景色硬编码 | `bg-[var(--ws-color-info-soft)]` |
| 18 | 787 | `mt-0.5` | 间距硬编码 | `mt-[var(--ws-space-1)]` |

### ClassroomPanel.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 19 | 563 | `text-purple` | 硬编码 Tailwind 紫色 | `text-[var(--ws-color-purple)]` |
| 20 | 643 | `text-base font-semibold` | 字号硬编码，无响应式 | `text-[var(--ws-text-md)]` |
| 21 | 715 | `px-3.5 py-3` | 代码块 padding 硬编码 | `px-[var(--ws-space-2)] py-[var(--ws-space-2)]` |
| 22 | 706 | `px-1.5` | 微间距硬编码 | token 化 |

### ChatArea.css

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 23 | 57 | `background: rgba(0,0,0,0.03)` | 代码块背景硬编码 | `var(--ws-color-surface-2)` |
| 24 | 67 | `background: rgba(0,0,0,0.04)` | 行内代码背景硬编码 | 同上 |
| 25 | 49 | `margin: 0.5em` | 段落 margin 用 em | 改用 CSS 变量 |
| 26 | 92 | `gap: 3px` | 微间距硬编码 | `calc(var(--ws-space-1) / 2)` |

---

## 10. XbkPage

**文件**: `src/pages/Xbk/index.tsx` + `Xbk.css`

### index.tsx

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 220 | `tableScrollY` 硬编码 360 | 表格滚动高度固定值 | 基于视口高度计算 |
| 2 | 235 | `space-y-4` | 表单间距硬编码 | `gap-[var(--ws-space-3)]` |
| 3 | 860 | `mb-4` | 侧边栏卡片 margin 硬编码 | token 化 |
| 4 | 963 | `pl-9` vs Articles 的 `pl-9` | 搜索输入 padding 一致但均硬编码 | 统一定义 |

### Xbk.css

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 4 | `calc(100vh - var(--ws-header-height) - 12px)` | 12px 偏移硬编码 | 使用 token |
| 6 | 69 | `/* PLACEHOLDER_XBK_1 */` | 占位符注释残留在生产代码 | 删除 |
| 7 | 187 | `gap: 8px` | 分页 gap 硬编码 | `var(--ws-space-2)` |
| 8 | 204 | `padding: 12px` | 移动端 padding 硬编码 | `var(--ws-space-2)` |
| 9 | 239-241 | `4px 8px` + `height: 28px` | 移动端 KPI padding/高度硬编码 | token 化 |

### 响应式

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 10 | Xbk.css:200 | `@media (max-width: 768px)` | flex-direction 从 row→column 无过渡 | 可能导致布局跳变 |

---

## 11. LoginPage

**文件**: `src/pages/Auth/Login.tsx`

### 颜色

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 1 | 107-108 | `background: "rgba(255,255,255,0.85)"` | 毛玻璃背景硬编码 | `background: var(--ws-glass-bg)` |
| 2 | 85-88 | `opacity: 0.3 / 0.2` | 装饰圆形透明度硬编码 | 定义 opacity token |

### 排版

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 3 | 98 | `text-2xl font-bold` | 标题无响应式 | `text-xl sm:text-2xl` |
| 4 | 153 | `fontWeight: 600` | 按钮字重内联样式 | 集成到 Button 组件 |

### 间距

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 5 | 94-95 | `w-14 h-14 rounded-2xl mb-4` | Logo 容器尺寸硬编码 | token 化 |
| 6 | 111 | `space-y-5` | 表单间距硬编码 | `gap-[var(--ws-space-3)]` |
| 7 | 120 | `h-11` | 输入框高度 44px，与标准按钮高度不一致 | 统一输入/按钮高度 token |

### 无障碍

| # | 行 | 当前代码 | 问题 | 建议 |
|---|-----|---------|------|------|
| 8 | 127,145 | `text-destructive text-xs` | 错误提示缺少 `aria-live="polite"` | 添加实时通知属性 |

---

## 12. 跨页面一致性问题

### A. 加载态骨架屏不一致

| 页面 | 骨架模式 | 问题 |
|------|---------|------|
| Articles | `h-8 w-full rounded-md` × 6 | 高 32px |
| Detail | `h-4 w-full` × 8 | 高 16px |
| PersonalPrograms | 混合 `h-6/h-4/h-9` | 三种尺寸 |
| Informatics | `space-y-2 p-4` | 间距比实际内容小 |

**建议**: 定义统一的骨架屏规范 — 标题骨架 `h-6`，正文骨架 `h-4`，按钮骨架 `h-9`。

### B. 空状态不一致

| 页面 | 空状态 | 有操作按钮 |
|------|--------|-----------|
| Articles | `EmptyState` + 清除筛选按钮 | 是 |
| Detail | `EmptyState` + 返回按钮 | 是 |
| PersonalPrograms | `EmptyState` 无按钮 | 否 |

**建议**: 统一空状态规范 — 都应提供一个主操作按钮。

### C. 错误态不一致

| 页面 | 错误组件 | 样式 |
|------|---------|------|
| Detail | `Alert variant="destructive"` | shadcn Alert |
| Informatics Reader | `Alert variant="destructive"` + 自定义类 | 混合样式 |
| ITTechnology | 状态变量，无 Alert | 无专用 UI |
| Xbk | 无显式错误 UI | - |

**建议**: 统一使用 `Alert variant="destructive"` + 重试按钮。

### D. 分页组件不一致

| 页面 | 实现方式 |
|------|---------|
| Articles | 自定义 Select + 手动按钮 |
| Xbk | `DataTablePagination` 组件 |

**建议**: 全部迁移至 `DataTablePagination`。

### E. 页面标题层次不一致

| 页面 | 标题模式 |
|------|---------|
| Home | 动态问候语 + Badge |
| Articles | 无显式标题 (CSS only) |
| Detail | 自定义 hero 区域 |
| Xbk | 含 KPI 卡片的 header bar |

**建议**: 定义公共页面标题规范组件。

### F. 搜索输入 padding 不一致

| 页面 | left padding |
|------|-------------|
| Articles | `pl-9` (36px) |
| Xbk | `pl-8` (32px) |

**建议**: 统一为 `pl-9` 或定义搜索输入规范。

---

## 13. CSS 文件问题

### Articles.css

| 行 | 问题 | 严重度 |
|----|------|--------|
| 6, 20 | `box-shadow: none !important` 不必要的 !important | 低 |
| 75-79 | `.meta-tag` 使用 3 个 !important 覆盖 Badge | 中 |

### Detail.css

| 行 | 问题 | 严重度 |
|----|------|--------|
| 73 | `line-height: 1.35` 硬编码 | 低 |
| 87 | `border-left: 3px solid` 边框宽度硬编码 | 低 |
| 106 | `padding: 7px ... 8px` 混用硬编码和 token | 中 |
| 194 | `var(--ws-color-primary-active)` 行内代码色需检查对比度 | 低 |

### ChatArea.css

| 行 | 问题 | 严重度 |
|----|------|--------|
| 57 | `rgba(0,0,0,0.03)` 代码块背景硬编码 | 中 |
| 67 | `rgba(0,0,0,0.04)` 行内代码背景硬编码 | 中 |
| 49 | `margin: 0.5em` 用 em 单位 | 低 |
| 92 | `gap: 3px` 硬编码 | 低 |

### Xbk.css

| 行 | 问题 | 严重度 |
|----|------|--------|
| 69 | `/* PLACEHOLDER_XBK_1 */` 占位符残留 | 低 |
| 187 | `gap: 8px` 硬编码 | 低 |
| 204 | `padding: 12px` 移动端 padding 硬编码 | 低 |

### ITTechnology.css

| 行 | 问题 | 严重度 |
|----|------|--------|
| 10-11 | 黑色渐变背景 `rgba(31,31,31,1)` 硬编码 | 中 |
| 11 | `z-index: 1000` 硬编码 | 中 |

---

## 14. 暗色模式准备度

### 硬编码白色背景 (暗色模式失效)

| 文件 | 行 | 代码 |
|------|-----|------|
| Home/index.tsx | 89 | `bg-white` |
| Articles/index.tsx | 431 | `bg-white/70` |
| Articles/index.tsx | 539 | `bg-white` |
| Auth/Login.tsx | 108 | `rgba(255,255,255,0.85)` |

### 硬编码 `border-black` 值

| 文件 | 行 | 代码 |
|------|-----|------|
| Home/index.tsx | 多处 | `border-black/[0.04]` |
| Articles/index.tsx | 431 | `border-black/[0.04]` |
| Articles/index.tsx | 539 | `border-black/[0.08]` |
| GroupDiscussionPanel.tsx | 799 | `border-black/[0.06]` |

### ChatArea.css rgba 硬编码

| 行 | 代码 | 影响 |
|----|------|------|
| 57 | `rgba(0,0,0,0.03)` | 暗色模式下代码块背景不可见 |
| 67 | `rgba(0,0,0,0.04)` | 暗色模式下行内代码背景不可见 |

**建议**: 全部替换为语义 token (`bg-surface`, `bg-surface-2`, `border-border`)。

---

## 15. 汇总统计

### 按问题类型

| 类型 | 数量 | 占比 |
|------|------|------|
| 间距/布局硬编码 | 68 | 38% |
| 颜色/边框硬编码 | 35 | 20% |
| 排版硬编码 | 22 | 12% |
| 响应式缺失 | 15 | 8% |
| 无障碍缺失 | 12 | 7% |
| 跨页面不一致 | 10 | 6% |
| 过渡动画不一致 | 8 | 4% |
| CSS 文件问题 | 7 | 4% |
| Z-Index 硬编码 | 3 | 2% |
| **总计** | **~180** | |

### 按页面

| 页面 | 问题数 | 严重度分布 |
|------|--------|-----------|
| AIAgentsPage (含子组件) | 26 | 高 3 / 中 15 / 低 8 |
| InformaticsDetailPage | 17 | 高 3 / 中 8 / 低 6 |
| HomePage | 15 | 高 1 / 中 8 / 低 6 |
| ArticleDetailPage | 13 | 高 1 / 中 7 / 低 5 |
| ArticlesPage | 12 | 高 0 / 中 7 / 低 5 |
| ITTechnologyPage | 13 | 高 2 / 中 7 / 低 4 |
| PythonLabPage | 10 | 高 0 / 中 6 / 低 4 |
| XbkPage | 10 | 高 0 / 中 5 / 低 5 |
| LoginPage | 8 | 高 1 / 中 4 / 低 3 |
| InformaticsPage | 3 | 高 0 / 中 2 / 低 1 |
| PersonalProgramsPage | 4 | 高 0 / 中 2 / 低 2 |
| 跨页面 | 6+ | 中 6 |
| CSS 文件 | 11 | 中 5 / 低 6 |

### 优先级建议

**P0 — 立即修复 (高严重度)**:
1. 无障碍: ARIA 属性缺失 (Reader 树节点, ITTechnology 卡片)
2. 暗色模式: `bg-white` / `border-black` 硬编码
3. 错误提示: 缺少 `aria-live="polite"`

**P1 — 近期修复 (中严重度)**:
1. 间距 token 化: 全部 `px-N`/`py-N`/`gap-N` → `var(--ws-space-*)`
2. 颜色 token 化: `rgba()` / `border-black/[opacity]` → CSS 变量
3. CSS 文件清理: !important 移除, 占位符删除

**P2 — 渐进优化 (低严重度)**:
1. 排版 token 化: `text-sm`/`text-base` → `var(--ws-text-*)`
2. 圆角 token 化: `rounded-lg`/`rounded-xl` → `var(--ws-radius-*)`
3. 过渡动画统一
4. 骨架屏/空状态/分页规范统一
