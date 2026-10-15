# WangSh 色彩语义规范

所有颜色通过 CSS 变量 `--ws-*` 定义于 `frontend/src/styles/index.css`，Tailwind
配置把它们映射到语义 class（`bg-primary`、`text-success` 等）。**禁止直接硬编码色值**，除非明确设计决策（如模块识别色、分数梯度）。

## 设计主题：Tech Cyan + Bento Grids

- Primary: Teal 青 `#0F766E`
- Accent: Violet 紫 `#4F46E5`
- Background: Mint 薄荷白 `#F8FBFC`
- Style: 永久浅色、扁平嵌入式与弱边界；本子批不升级页面布局或间距

## 语义色一览

| 语义 | Token | 浅色值 | 用途 |
|------|-------|------|------|
| **primary** | `--ws-color-primary` | `#0F766E` | 主按钮、链接；选中/焦点使用 accent |
| **primary-hover** | `--ws-color-primary-hover` | `#0B5F59` | primary 元素 hover 态（加深，非变浅） |
| **primary-active** | `--ws-color-primary-active` | `#084C47` | primary 元素 active 态 |
| **primary-muted** | `--ws-color-primary-muted` | `#E6F7F5` | 柔色背景、tag bg |
| **secondary** | `--ws-color-secondary` | `#4F46E5` | 品牌装饰、卡片 hover 边框 |
| **accent** | `--ws-color-accent` | `#4F46E5` | CTA、强调边框、点缀条（与 secondary 同值） |
| **focus-ring** | `--ws-color-focus-ring` | `#4F46E5` | 焦点环 `focus-visible:ring-*`、选中左条 |
| **hover-bg** | `--ws-color-hover-bg` | `rgba(15, 118, 110, 0.07)` | 菜单/列表项 hover 底色 |
| **success** | `--ws-color-success` | `#15803D` | 完成、通过、正向指标 |
| **warning** | `--ws-color-warning` | `#B45309` | 警告、待处理 |
| **error** | `--ws-color-error` | `#B42318` | 错误、删除、危险操作 |
| **danger** | `--ws-color-danger` | `#B42318` | error 的别名，避免混用 |
| **info** | `--ws-color-info` | `#0369A1` | 信息提示、帮助文本 |
| **purple** | `--ws-color-purple` | `#4F46E5` | 品牌强调的兼容 alias |

**配色原则**：对比度由**亮度**决定，「刺眼」来自**彩度**，两者可解耦。
页面保持近白，深色文字承担结构；Teal/Indigo 仅承担交互与小面积强调。主色与状态色需同时核白字叠色块、该色作白底文字和次级浅色面文字；内容 palette 与弱边界不可套用正文色承诺。

> ⚠️ 色值是**单一真源**：以 `index.css` 的 `:root` 为准。改色时先改代码再同步本表。
> 本表曾长期停留在旧色板（`#0D9488`/`#7C3AED`），导致多份报告引用过时值、
> 甚至可能「优化对比度」时把已达标色改回不达标值。请勿再让本表脱节。

`--ws-color-accent` 并不是 primary 的别名，也不等于 Teal：它与 secondary 同为
Violet `#4F46E5`，用于强调边框和课堂互动浮动入口。焦点环用独立的
`--ws-color-focus-ring`（同值），Tailwind 侧映射为 `ring`。

## 模块识别色

| 模块 | Token | 色值 |
|------|-------|------|
| ML（机器学习） | `--ws-color-secondary` | `#4F46E5` |
| AI（人工智能） | `--ws-tag-blue` | `#2563EB` |
| Agents（智能体） | `--ws-color-primary` | `#0F766E` |

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
<div style={{ color: "#0369A1" }}>...</div>               {/* 硬编码 hex，应用 var(--ws-color-info) */}
<Button className="bg-red-500">删除</Button>               {/* 绕过 destructive variant */}
```

## 对比度要求

所有组合都应满足 **WCAG AA**：
- 正常文本 ≥ 4.5:1
- 大文本（18pt 或 14pt bold）≥ 3:1
- 交互元素边框 ≥ 3:1

下表为实算值（WCAG 2.x 相对亮度公式，白底 `#FFFFFF`）。

### 作为前景（彩色文字 / 图标 / 描边）

| Token | 色值 | 对白底 | 对 `#F4F8F9` | 结果 |
|-------|------|--------|------|------|
| `--ws-color-primary-active` | `#084C47` | 9.84:1 | 9.20:1 | ✅ AA 正文 |
| `--ws-color-secondary` / `--ws-color-accent` | `#4F46E5` | 6.29:1 | 5.88:1 | ✅ AA 正文 |
| `--ws-color-primary-hover` | `#0B5F59` | 7.51:1 | 7.03:1 | ✅ AA 正文 |
| `--ws-color-primary` | `#0F766E` | 5.47:1 | 5.12:1 | ✅ AA 正文 |
| `--ws-color-error` | `#B42318` | 6.57:1 | 6.15:1 | ✅ AA 正文 |
| `--ws-color-info` | `#0369A1` | 5.93:1 | 5.55:1 | ✅ AA 正文 |
| `--ws-color-success` | `#15803D` | 5.02:1 | 4.69:1 | ✅ AA 正文 |
| `--ws-color-warning` | `#B45309` | 5.02:1 | 4.70:1 | ✅ AA 正文 |
| `--ws-color-text-tertiary` | `#64748B` | 4.76:1 | 4.45:1 | ⚠️ 仅大字/图标 |
| `--ws-color-purple` | `#4F46E5` | 6.29:1 | 5.88:1 | ✅ AA 正文 |
| `--ws-tag-orange` | `#F97316` | 2.80:1 | — | ❌ 仅标签底色/装饰 |
| `--ws-tag-sky` | `#0284C7` | 4.10:1 | — | ⚠️ 仅大字/图标 |

### 作为底色（白色文字 `#FFFFFF` 叠在其上）

| Token | 色值 | 白字对比度 | 结果 |
|-------|------|-----------|------|
| `--ws-color-primary-active` | `#084C47` | 9.84:1 | ✅ |
| `--ws-color-primary-hover` | `#0B5F59` | 7.51:1 | ✅ |
| `--ws-color-primary` | `#0F766E` | 5.47:1 | ✅ |
| `--ws-color-secondary` / `--ws-color-accent` | `#4F46E5` | 6.29:1 | ✅ |
| `--ws-color-error` | `#B42318` | 6.57:1 | ✅ |
| `--ws-color-info` | `#0369A1` | 5.93:1 | ✅ |
| `--ws-color-success` | `#15803D` | 5.02:1 | ✅ |
| `--ws-color-warning` | `#B45309` | 5.02:1 | ✅ |
| `--ws-color-purple` | `#4F46E5` | 6.29:1 | ✅ |

注意：浅色页面背景是 `--ws-color-bg` `#F8FBFC`、次级面板是 `--ws-color-surface-2` `#F4F8F9`，
两者都比纯白略暗，因此**按这两种底色核验更严格**——上表已同时列出。

**内容 palette 限制**：`--ws-tag-orange` 与 `--ws-tag-sky` 仍不满足正常正文 AA；标签/图形须按实际前景背景核验，不能因公共语义色合格宣称全站对比度通过。

`#0EA5E9`（旧 Sky 500 值）对白底仅 2.77:1，不满足 AA，已不再作为
`--ws-color-info` 使用，也不要重新引入。

## 扩展流程

新增语义色应：
1. 在 `index.css` 的 `:root` 块中定义
2. 更新本文档
3. 若需 Tailwind class 支持，同步 `tailwind.config.js` 的 `theme.extend.colors`
4. 运行 `npm run token:check:ci`，确保所有 `var(--ws-*)` 引用均有定义

## 颜色桥基础合同（未发布）

`index.css :root` 是唯一真源。页面、表面、文字、边界、primary/status 的
fill/text/border/soft、interaction、chart 以及专业 renderer token 已登记；旧名称
保留 alias。细分隔/控件/强边界分别为 `rgba(15,23,42,.12/.18/.28)`；弱分隔不是
满足 3:1 的独立交互识别手段，控件还需清晰文字、形状及 focus ring。

Tailwind 颜色映射保留旧 class 并增加语义家族；实色透明度修饰符走同名 RGB
投影，不能把半透明 `var(...)` 误认为支持任意 `/N`。本批不改间距、布局、
markdown 渲染、专业消费者或审计批准来源。

`src/lib/cssTokens.ts` 统一 live CSS 读取、递归 alias、SSR fallback、alpha 和
ECharts 颜色槽投影，`lib/echarts.ts` 重导出。不得改 dataset/source/value、标题、
系列名或 formatter，输入不可变且 callback 不执行；未解析表达式告警并采用
有定义的 fallback。新增桥不代表所有消费方已接入。

`cssTokens.contract.test.ts` 从运行目录的 `src/styles/index.css` 读取真源，核每个
renderer fallback、RGB 投影和 Tailwind 引用定义。在 `frontend/` 运行
`npm test -- src/lib/cssTokens.test.ts src/lib/cssTokens.charts.test.ts src/lib/cssTokens.contract.test.ts`。
静态合同不代替浏览器/CSS 编译、实际图表或全站视觉验收；动态结果仅见
[TEST_STATUS](../../../docs/docker/testing/TEST_STATUS.md)。

## 本子批的边界与未改内容

细分隔、控件与强边界分别为 `rgba(15,23,42,.12)`、`.18`、`.28`；
`border-border-secondary` 保留弱分隔 alias，控件显式选择 control。
本子批仅 root 颜色、RGB、Tailwind 投影与 renderer 桥；gradient 与标签 palette
保留 HEAD 定义，专业消费者接入、页面布局/间距、全站视觉验收另批。
颜色快照承接必须核源批准，值相等不是批准。
