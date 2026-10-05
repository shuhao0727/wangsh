# WangSh 色彩语义规范

所有颜色通过 CSS 变量 `--ws-*` 定义于 `frontend/src/styles/index.css`，Tailwind
配置把它们映射到语义 class（`bg-primary`、`text-success` 等）。**禁止直接硬编码色值**，除非明确设计决策（如模块识别色、分数梯度）。

## 设计主题：Tech Cyan + Bento Grids

- Primary: Teal 青 `#36776F`
- Accent: Violet 紫 `#7164A1`
- Background: Mint 薄荷白 `#F0FDFA`
- Style: 圆角 14-20px, 多层软阴影, card-based 布局

## 语义色一览

| 语义 | Token | 浅色值 | 用途 |
|------|-------|------|------|
| **primary** | `--ws-color-primary` | `#36776F` | 主按钮、链接、选中（白字 5.22:1） |
| **primary-hover** | `--ws-color-primary-hover` | `#2F7169` | primary 元素 hover 态（加深，非变浅） |
| **primary-active** | `--ws-color-primary-active` | `#266961` | primary 元素 active 态 |
| **primary-muted** | `--ws-color-primary-muted` | `#CCFBF1` | 大面积浅色背景、tag bg |
| **secondary** | `--ws-color-secondary` | `#7164A1` | 品牌装饰、卡片 hover 边框 |
| **accent** | `--ws-color-accent` | `#7164A1` | CTA、强调边框、点缀条（与 secondary 同值） |
| **focus-ring** | `--ws-color-focus-ring` | `#7164A1` | 焦点环 `focus-visible:ring-*`、选中左条 |
| **hover-bg** | `--ws-color-hover-bg` | `rgba(54, 119, 111, 0.08)` | 菜单/列表项 hover 底色 |
| **success** | `--ws-color-success` | `#39795D` | 完成、通过、正向指标 |
| **warning** | `--ws-color-warning` | `#976135` | 警告、待处理 |
| **error** | `--ws-color-error` | `#A25850` | 错误、删除、危险操作 |
| **danger** | `--ws-color-danger` | `#A25850` | error 的别名，避免混用 |
| **info** | `--ws-color-info` | `#4B6EA1` | 信息提示、帮助文本 |
| **purple** | `--ws-color-purple` | `#C026D3` | 课堂互动模块识别色 |

**配色原则**：对比度由**亮度**决定，「刺眼」来自**彩度**，两者可解耦。
上述语义色统一在 OKLCH 彩度带 **0.068–0.098**，亮度只取「刚够 AA（4.5:1）」而不追求高数字——
否则会把颜色压得又深又闷。全部色值同时满足三种场景 ≥4.5:1：
白字落在色块上、该色作文字在白底、该色作文字在 `#F0FDFA` 与 `#E6F5F3` 上。

> ⚠️ 色值是**单一真源**：以 `index.css` 的 `:root` 为准。改色时先改代码再同步本表。
> 本表曾长期停留在旧色板（`#0D9488`/`#7C3AED`），导致多份报告引用过时值、
> 甚至可能「优化对比度」时把已达标色改回不达标值。请勿再让本表脱节。

`--ws-color-accent` 并不是 primary 的别名，也不等于 Teal：它与 secondary 同为
Violet `#7164A1`，用于强调边框和课堂互动浮动入口。焦点环用独立的
`--ws-color-focus-ring`（同值），Tailwind 侧映射为 `ring`。

## 模块识别色

| 模块 | Token | 色值 |
|------|-------|------|
| ML（机器学习） | `--ws-color-secondary` | `#7164A1` |
| AI（人工智能） | `--ws-tag-blue` | `#2563EB` |
| Agents（智能体） | `--ws-color-primary` | `#36776F` |

资源分类中的社区标签使用 `--ws-tag-orange`（`#F97316`）。数据标签色必须从
`--ws-tag-*` palette 中选择，不要新增无定义的 `--ws-color-*` 引用或用 fallback
掩盖缺失 token。

## 使用方式

### ✅ 推荐

```tsx
<Button>确定</Button>                                    {/* teal primary */}
<Button variant="destructive">删除</Button>              {/* error red */}
<Badge className="bg-primary-soft text-primary">新</Badge>
<div className="text-text-secondary">副标题</div>
<div style={{ color: "var(--ws-color-success)" }}>+12%</div>
```

### ❌ 避免

```tsx
<div className="bg-sky-500 text-white">...</div>           {/* 硬编码 Tailwind 色 */}
<div style={{ color: "#4B6EA1" }}>...</div>               {/* 硬编码 hex，应用 var(--ws-color-info) */}
<Button className="bg-red-500">删除</Button>               {/* 绕过 destructive variant */}
```

## 对比度要求

所有组合都应满足 **WCAG AA**：
- 正常文本 ≥ 4.5:1
- 大文本（18pt 或 14pt bold）≥ 3:1
- 交互元素边框 ≥ 3:1

下表为实算值（WCAG 2.x 相对亮度公式，白底 `#FFFFFF`）。

### 作为前景（彩色文字 / 图标 / 描边）

| Token | 色值 | 对白底 | 对 `#E6F5F3` | 结果 |
|-------|------|--------|------|------|
| `--ws-color-primary-active` | `#266961` | 6.41:1 | 5.71:1 | ✅ AA 正文 |
| `--ws-color-secondary` / `--ws-color-accent` | `#7164A1` | 5.20:1 | 4.63:1 | ✅ AA 正文 |
| `--ws-color-primary-hover` | `#2F7169` | 5.70:1 | 5.08:1 | ✅ AA 正文 |
| `--ws-color-primary` | `#36776F` | 5.22:1 | 4.65:1 | ✅ AA 正文 |
| `--ws-color-error` | `#A25850` | 5.19:1 | 4.62:1 | ✅ AA 正文 |
| `--ws-color-info` | `#4B6EA1` | 5.19:1 | 4.63:1 | ✅ AA 正文 |
| `--ws-color-success` | `#39795D` | 5.16:1 | 4.60:1 | ✅ AA 正文 |
| `--ws-color-warning` | `#976135` | 5.15:1 | 4.59:1 | ✅ AA 正文 |
| `--ws-color-text-tertiary` | `#626F82` | 5.10:1 | 4.55:1 | ✅ AA 正文 |
| `--ws-color-purple` | `#C026D3` | 4.71:1 | 4.20:1 | ⚠️ 仅大字/图标 |
| `--ws-tag-orange` | `#F97316` | 2.80:1 | — | ❌ 仅标签底色/装饰 |
| `--ws-tag-sky` | `#0284C7` | 4.10:1 | — | ⚠️ 仅大字/图标 |

### 作为底色（白色文字 `#FFFFFF` 叠在其上）

| Token | 色值 | 白字对比度 | 结果 |
|-------|------|-----------|------|
| `--ws-color-primary-active` | `#266961` | 6.41:1 | ✅ |
| `--ws-color-primary-hover` | `#2F7169` | 5.70:1 | ✅ |
| `--ws-color-primary` | `#36776F` | 5.22:1 | ✅ |
| `--ws-color-secondary` / `--ws-color-accent` | `#7164A1` | 5.20:1 | ✅ |
| `--ws-color-error` | `#A25850` | 5.19:1 | ✅ |
| `--ws-color-info` | `#4B6EA1` | 5.19:1 | ✅ |
| `--ws-color-success` | `#39795D` | 5.16:1 | ✅ |
| `--ws-color-warning` | `#976135` | 5.15:1 | ✅ |
| `--ws-color-purple` | `#C026D3` | 4.71:1 | ⚠️ 可用，余量薄 |

注意：浅色页面背景是 `--ws-color-bg` `#F0FDFA`、次级面板是 `--ws-color-surface-2` `#E6F5F3`，
两者都比纯白略暗，因此**按这两种底色核验更严格**——上表已同时列出。

**未覆盖的欠账**（已知，待处理）：`--ws-tag-orange`(2.80:1)、`--ws-tag-sky`(4.10:1)、
`--ws-color-purple` 在次级面板上(4.20:1) 仍不满足 AA。这些用于数据标签/模块识别，
若其上要叠正文文字需先调深。

`#0EA5E9`（旧 Sky 500 值）对白底仅 2.77:1，不满足 AA，已不再作为
`--ws-color-info` 使用，也不要重新引入。

## 扩展流程

新增语义色应：
1. 在 `index.css` 的 `:root` 块中定义
2. 更新本文档
3. 若需 Tailwind class 支持，同步 `tailwind.config.js` 的 `theme.extend.colors`
4. 运行 `npm run token:check:ci`，确保所有 `var(--ws-*)` 引用均有定义
