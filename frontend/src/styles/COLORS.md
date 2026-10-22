# WangSh 色彩语义规范

所有颜色通过 CSS 变量 `--ws-*` 定义于 `frontend/src/styles/index.css`，Tailwind
配置把它们映射到语义 class（`bg-primary`、`text-success` 等）。**禁止直接硬编码色值**，除非明确设计决策（如模块识别色、分数梯度）。

## 设计主题：Tech Cyan + Bento Grids

- Primary: Teal 青 `#0D9488`
- Accent: Violet 紫 `#7C3AED`
- Background: Mint 薄荷白 `#F0FDFA`
- 内容容器沿用现有布局；按钮与表单控件使用小圆角、细边框的扁平样式。

## 控件外观

- 固定控件几何使用 `--ws-space-unit`（4px 网格）与 `--ws-border-width`（1px），避免重复定义相同间距和边界；页面响应式间距继续使用 `--ws-space-1` 到 `--ws-space-5`，标准控件高度沿用现有 control token。

- `Button`、`Input`、`Textarea`、`SelectTrigger` 统一使用 `--ws-radius-sm`，常规控件不加立体阴影或按压缩放；交互采用短暂的颜色变化。
- 输入、搜索、日期与筛选控件通过 `--ws-control-bg` 与 `--ws-control-border` 关联所在区域，使用 surface 白底和轻量中性边框；不逐个填充薄荷色。hover 加深边框，键盘焦点使用主色边框与 1px 主色环，不额外留出光晕间隔。
- 主按钮保留主色，危险按钮保留错误色；outline 按钮通过 `--ws-control-action-bg` 与 `--ws-control-action-border` 控制底色和边框，嵌入式区域使用透明底与轻边框，保留操作可识别性。结果区和工具行中的次要动作可使用 ghost，hover 提供柔色反馈。secondary 使用主色柔色背景。
- 页签使用透明底色与主色下划线表示选中；下拉菜单和选择面板使用小圆角、细边线，不加立体阴影。
- 复选框使用较小圆角，开关保留滑块形状并去掉滑块阴影；状态、禁用、加载与无障碍语义保持。
- 页面覆盖样式只调整所需尺寸、排布和语义状态，避免重新加上大圆角、立体阴影或缩放效果。原生表单控件遵循同样规范，代码编辑区保留专用布局。
- `Input` 使用块级显示，避免管理端 `.flex` 的响应式规则覆盖搜索框的最小宽度；工具栏按可用宽度换行，保持输入与操作可用。
- 常规搜索、日期、筛选与工具栏按钮统一使用 `--ws-control-height`（36px），行内操作与卡片管理链接使用 `--ws-control-height-sm`（28px），大尺寸场景沿用 `--ws-control-height-lg`（44px）。纯图标按钮保持同档位正方形，避免用随根字号变化的 `h-7`、`h-8` 覆盖标准高度。
- 复选框和开关保留各自的视觉尺寸；文章列表通过 28px 标签热区扩大复选框点击范围。密集筛选按搜索日期、条件与操作分组换行，日期范围和学号姓名保持成组。
- `SelectItem` 与操作菜单的普通、勾选、单选、子菜单选项统一使用紧凑字号和 28px 最小行高，长文本可自然撑开。选项 hover 与键盘焦点通过浅主色背景识别，组件显式处理 `focus-visible`，避免叠加全局紫色外描边。

### 嵌入式控件

- “嵌入式”指按钮、筛选、页签与内容在同一区域连续呈现。通过排版、对齐和细分隔线建立联系，避免重复外框、阴影和悬浮位移；桌面优先使用横向空间，不把摘要、导航与工具机械地各占一行，造成左侧拥挤、右侧空旷。
- 前台常规布局、后台、后台独立编辑器与 ML/AI/Agents 学习页使用 `ws-embedded-controls` 作用域；Dialog 和 Sheet 在 portal 内容根节点建立相同作用域，保证弹层表单一致。
- `AdminFilterBar` 和响应式工具栏以底部分隔线衔接内容；`DataTable` 移除重复外框与圆角，表头使用中性 `--ws-color-workspace-muted`；页签以底线连入所在区域。统计摘要减少装饰性色块，以标签、数值和分隔线表达层次。
- 使用记录页使用连续统计摘要、可见筛选标签与成组日期；查询紧随筛选条件，导出属于结果区。没有记录时仍保留真实表头和空状态，避免只剩无结构的大空白。日期组合外层为 36px，内部日期输入扣除外框后为 34px。
- XBK 保留左右分区，桌面摘要与导入/新增共用上栏，页签与导出、分析、维护操作共用下栏；侧栏筛选框使用 36px，工具栏动作使用 32px，页签导航使用 40px，表头使用极浅工作区底色和 1px 中性边线。不要把这三类内容拆成三个左对齐横条。
- 空数据表格保持透明背景并占据可用工作区，空状态文本居中显示；普通数据行的 hover 不得影响空状态，避免形成孤立色带。
- `PanelCard` 取消装饰边框与阴影，交互卡片使用颜色或边框反馈。代码编辑器、预览区与其他专用工作区保留自己的布局和内容样式。
- 登录页及前台 PythonLab 工作区未启用此作用域。作用域外的控件沿用默认底色与边框，不覆盖控件尺寸、主色、危险状态、禁用或键盘操作。

## 语义色一览

| 语义 | Token | 浅色值 | 用途 |
|------|-------|------|------|
| **primary** | `--ws-color-primary` | `#0D9488` (Teal 600) | 主按钮、链接、选中 |
| **primary-hover** | `--ws-color-primary-hover` | `#14B8A6` | primary 元素 hover 态 |
| **primary-muted** | `--ws-color-primary-muted` | `#CCFBF1` (Teal 100) | 大面积浅色背景、tag bg |
| **secondary** | `--ws-color-secondary` | `#7C3AED` (Violet 600) | 品牌装饰与 ML 模块识别；焦点环实际由独立 token `--ws-color-focus-ring` 提供 |
| **accent** | `--ws-color-accent` | `#7C3AED` | CTA、强调边框、点缀条 |
| **success** | `--ws-color-success` | `#059669` (Emerald) | 完成、通过、正向指标 |
| **warning** | `--ws-color-warning` | `#D97706` (Amber) | 警告、待处理 |
| **error** | `--ws-color-error` | `#DC2626` (Red) | 错误、删除、危险操作 |
| **info** | `--ws-color-info` | `#0EA5E9` (Sky 500) | 信息提示、帮助文本 |
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
<Badge className="bg-primary-soft text-primary">新</Badge>
<div className="text-text-secondary">副标题</div>
<div style={{ color: "var(--ws-color-success)" }}>+12%</div>
```

### ❌ 避免

```tsx
<div className="bg-sky-500 text-white">...</div>           {/* 硬编码 Tailwind 色 */}
<div style={{ color: "#0EA5E9" }}>...</div>               {/* 硬编码 hex */}
<Button className="bg-red-500">删除</Button>               {/* 绕过 destructive variant */}
```

## 对比度要求

所有组合都应满足 **WCAG AA**：
- 正常文本 ≥ 4.5:1
- 大文本（18pt 或 14pt bold）≥ 3:1
- 交互元素边框 ≥ 3:1

`#0284C7` 对白底为 4.10:1 ❌（未达正常文本 4.5:1；仅可用于大文本、图标或 ≥3:1 的非文本元素）。
`#0EA5E9` 对白底为 2.77:1 ❌（不满足 AA，只能作为 hover 态、非文本装饰）。

> 计算方式：WCAG 2.x 相对亮度公式（sRGB 线性化后取 0.2126R + 0.7152G + 0.0722B）。
> 小字号正文请使用 `--ws-color-primary`（`#0D9488`，对白底 3.74:1 亦不达标）等更深色值，
> 或搭配 `--ws-color-text-*` 中性文本色；不要用 `#0284C7` / `#0EA5E9` 承载正文。

## 扩展流程

新增语义色应：
1. 在 `index.css` 的 `:root` 块中定义
2. 更新本文档
3. 若需 Tailwind class 支持，同步 `tailwind.config.js` 的 `theme.extend.colors`
4. 运行 `npm run token:check:ci`，确保所有 `var(--ws-*)` 引用均有定义
