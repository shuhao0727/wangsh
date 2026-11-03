# WangSh 色彩语义规范

项目**永久使用浅色主题**。颜色源为 `frontend/src/styles/index.css` 的 `--ws-*`，
Tailwind 将其映射为语义 class。业务组件不硬编码颜色；模块识别色、分数梯度也先定义 token。

## 设计主题：Tech Cyan + Bento Grids

- Primary: Teal 青 `#0D9488`
- Accent: Violet 紫 `#7C3AED`
- Background: Mint 薄荷白 `#F0FDFA`
- 内容容器沿用现有布局；按钮与表单控件使用小圆角、细边框的扁平样式。

## 控件外观

- 几何复用 `--ws-space-unit`（4px）、`--ws-border-width`（1px）；响应式间距用 `--ws-space-1` 至 `--ws-space-5`。
- `Button`、`Input`、`Textarea`、`SelectTrigger` 用 `--ws-radius-sm`，无立体阴影或按压缩放；页签透明底、主色下划线，菜单小圆角细边线。
- 输入、搜索、日期与筛选用 `--ws-control-bg` / `--ws-control-border`：surface 白底、中性边框，hover 加深；键盘焦点为主色边框及 1px 主色环，无光晕间隔。
- 主按钮用主色，危险按钮用错误色；outline 用 `--ws-control-action-bg` / `--ws-control-action-border`，嵌入区域透明底、轻边框。次要动作可用 ghost，secondary 用主色柔色背景。
- 复选框小圆角，开关保留滑块但去阴影；保留状态、禁用、加载及无障碍语义。文章列表复选框使用 28px 标签热区。
- 页面只覆盖必要尺寸、排布与语义状态；原生表单同样处理，代码编辑区保留专用布局。`Input` 块级显示，防止管理端 `.flex` 响应规则破坏搜索框最小宽度。
- 工具栏按可用宽度分组换行，日期范围、学号姓名保持成组。控件常规/行内/大号分别用 `--ws-control-height`（36px）、`--ws-control-height-sm`（28px）、`--ws-control-height-lg`（44px）；图标按钮同档正方形，不用 `h-7` / `h-8` 覆盖标准高度。
- `SelectItem` 及普通、勾选、单选、子菜单项用紧凑字号、最小 28px 行高，长文本自然撑开。hover/键盘焦点用浅主色背景，显式处理 `focus-visible`，避免叠加全局紫色描边。

### 嵌入式控件

- 按钮、筛选、页签与内容连续呈现，用对齐和细分隔线组织；桌面利用横向空间，减少重复外框、阴影、悬浮位移和独占横行。
- 前台常规布局、后台及独立编辑器、ML/AI/Agents 学习页使用 `ws-embedded-controls`；Dialog/Sheet 在 portal 根节点建立同一作用域。登录页与前台 PythonLab 未启用，保留默认底色、边框及全部操作语义。
- `AdminFilterBar` / 工具栏用底部分隔线；`DataTable` 无重复外框和圆角，表头用 `--ws-color-workspace-muted`；页签底线连入内容，统计用标签、数值和分隔线。
- 使用记录页保留连续摘要、可见筛选标签及成组日期，查询紧随条件、导出放结果区。日期组合外层 36px、内部输入 34px；无记录时保留真实表头。
- XBK 保留左右分区：摘要与导入/新增共用上栏，页签与导出/分析/维护共用下栏。侧栏筛选 36px、工具动作 32px、页签 40px；表头极浅工作区底色、1px 中性边线。
- 空表透明且占满可用区域，空状态居中，不应用普通行 hover。`PanelCard` 无装饰边框/阴影，交互卡片用颜色或边框反馈；编辑器、预览区保留专用布局。

## 语义色一览

| 语义 | Token | 浅色值 | 用途 |
|------|-------|------|------|
| **primary** | `--ws-color-primary` | `#0D9488` (Teal 600) | 主按钮、选中；文字用途另验对比度 |
| **primary-hover** | `--ws-color-primary-hover` | `#14B8A6` | primary 元素 hover 态 |
| **primary-muted** | `--ws-color-primary-muted` | `#CCFBF1` (Teal 100) | 大面积浅色背景、tag bg |
| **secondary** | `--ws-color-secondary` | `#7C3AED` (Violet 600) | 品牌装饰与 ML 模块识别；焦点环实际由独立 token `--ws-color-focus-ring` 提供 |
| **accent** | `--ws-color-accent` | `#7C3AED` | CTA、强调边框、点缀条 |
| **success** | `--ws-color-success` | `#059669` (Emerald) | 完成、通过、正向指标 |
| **warning** | `--ws-color-warning` | `#D97706` (Amber) | 警告、待处理 |
| **error** | `--ws-color-error` | `#DC2626` (Red) | 错误、删除、危险操作 |
| **info** | `--ws-color-info` | `#0EA5E9` (Sky 500) | 信息标识、装饰；不直接用作白底正文 |
| **purple** | `--ws-color-purple` | `#C026D3` | 课堂互动模块识别色 |

> 注意：Tailwind 的 `accent` 语义类（`bg-accent`、`text-accent`）映射到
> `--ws-color-hover-bg`（`tailwind.config.js` 的 `theme.extend.colors.accent`），
> 与上表的 `--ws-color-accent`（`#7C3AED`）不是同一变量。需要紫色强调时直接写
> `var(--ws-color-accent)`，不要用 `bg-accent` 代替。

## 模块识别色

| 模块 | Token | 色值 |
|------|-------|------|
| ML（机器学习） | `--ws-color-secondary` | `#7C3AED` |
| AI（人工智能） | `--ws-tag-blue` | `#2563EB` |
| Agents（智能体） | `--ws-color-primary` | `#0D9488` |

资源分类中的社区标签使用 `--ws-tag-orange`（`#F97316`）。数据标签色必须从
`--ws-tag-*` palette 中选择，不要新增无定义的 `--ws-color-*` 引用或用 fallback
掩盖缺失 token。

## 使用方式

### ✅ 推荐

```tsx
<Button>确定</Button>                                    {/* teal primary */}
<Button variant="destructive">删除</Button>              {/* error red */}
<Badge className="bg-primary-soft text-text-base">新</Badge>
<div className="text-text-secondary">副标题</div>
<div style={{ color: "var(--ws-color-text)" }}>+12%</div>
```

### ❌ 避免

```tsx
<div className="bg-sky-500 text-white">...</div>           {/* 硬编码 Tailwind 色 */}
<div style={{ color: "#0EA5E9" }}>...</div>               {/* 硬编码 hex */}
<Button className="bg-red-500">删除</Button>               {/* 绕过 destructive variant */}
```

## Canvas / ECharts 等非 CSS 渲染器

Canvas `fillStyle` 等不解析 CSS 变量的接口，先用 `frontend/src/lib/cssTokens.ts`
取具体色值，不依赖绘图库赋值失败后的默认颜色：

```ts
import { readCssColor, readChartPalette, alphaColor } from "@/lib/cssTokens";

readCssColor("--ws-color-primary");                  // "#0D9488"（浏览器里读实时值）
const palette = readChartPalette();                  // 一次性拿到整套语义色 + tag palette
alphaColor("var(--ws-color-border)", 0.5);           // 在原 alpha 上相乘，不会把半透明变实
```

规则：

- ECharts 优先用 SVG 渲染器（`opts={{ renderer: "svg" }}`）；仅在已验证支持 CSS 变量的属性中直接用 `var()`。Canvas 或库内部还需计算的颜色先用 `cssTokens` 解析，并检查真实显示。
- `cssTokens.ts` 里的 `COLOR_TOKEN_FALLBACKS` 是 `:root` 的镜像，供 SSR/测试/读取失败时使用。
  它由 `cssTokens.contract.test.ts` 与 `index.css` 逐项比对，**改色值时两处必须同步**，否则测试会红。
- 不要新增未在 `index.css` 定义的颜色 token；需要新色先定义 token 再引用。


## 对比度要求

按实际前景/背景检查 **WCAG AA**，语义 token 不自动保证对比度：

- 正常文本 ≥ 4.5:1
- 大文本（18pt 或 14pt bold）≥ 3:1
- 用于识别控件或状态的必要非文本视觉信息 ≥ 3:1

`#0284C7` 对白底为 4.10:1 ❌（未达正常文本 4.5:1；仅可用于大文本、图标或 ≥3:1 的非文本元素）。
`#0EA5E9` 对白底为 2.77:1 ❌，不能用作正文或必要的非文本识别信息；hover 状态并不豁免对比度要求。

> 计算方式：WCAG 2.x 相对亮度公式（sRGB 线性化后取 0.2126R + 0.7152G + 0.0722B）。
> `--ws-color-primary`（`#0D9488`）对白底约 3.74:1，也不满足正常文本要求。
> 正文优先用 `--ws-color-text` / `--ws-color-text-*`，仍须核对实际背景与状态；不要直接以品牌色或信息色承载正文。

## 扩展流程

新增语义色应：

1. 在 `index.css` 的 `:root` 块中定义
2. 更新本文档
3. 若需 Tailwind class 支持，同步 `tailwind.config.js` 的 `theme.extend.colors`
4. 同步 `cssTokens.ts` 中对应 fallback；在 `frontend/` 运行 `npm run token:check:ci`、`npm test -- src/lib/cssTokens.contract.test.ts` 与 `npm run type-check`，再验证受影响页面
