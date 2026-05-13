# WangSh 色彩语义规范

所有颜色通过 CSS 变量 `--ws-*` 定义于 `frontend/src/styles/index.css`，Tailwind
配置把它们映射到语义 class（`bg-primary`、`text-success` 等）。**禁止直接硬编码色值**，除非明确设计决策（如模块识别色、分数梯度）。

## 设计主题：Tech Cyan + Bento Grids

- Primary: Teal 青 `#0D9488`
- Accent: Violet 紫 `#7C3AED`
- Background: Mint 薄荷白 `#F0FDFA`
- Style: 圆角 14-20px, 多层软阴影, card-based 布局

## 语义色一览

| 语义 | Token | 亮色 | 暗色 | 用途 |
|------|-------|------|------|------|
| **primary** | `--ws-color-primary` | `#0D9488` (Teal 600) | `#2DD4BF` | 主按钮、链接、选中 |
| **primary-hover** | `--ws-color-primary-hover` | `#14B8A6` | `#5EEAD4` | primary 元素 hover 态 |
| **primary-muted** | `--ws-color-primary-muted` | `#CCFBF1` (Teal 100) | `#134E4A` | 大面积浅色背景、tag bg |
| **secondary** | `--ws-color-secondary` | `#7C3AED` (Violet 600) | `#A78BFA` | 焦点环、装饰强调 |
| **accent** | `--ws-color-accent` | `#7C3AED` | `#A78BFA` | CTA、强调边框、点缀条 |
| **success** | `--ws-color-success` | `#059669` (Emerald) | `#34D399` | 完成、通过、正向指标 |
| **warning** | `--ws-color-warning` | `#D97706` (Amber) | `#FBBF24` | 警告、待处理 |
| **error** | `--ws-color-error` | `#DC2626` (Red) | `#F87171` | 错误、删除、危险操作 |
| **info** | `--ws-color-info` | `#0EA5E9` (Sky 500) | `#38BDF8` | 信息提示、帮助文本 |
| **purple** | `--ws-color-purple` | `#7C3AED` | `#A78BFA` | 课堂互动模块识别色 |

## 模块识别色

| 模块 | Token | 色值 |
|------|-------|------|
| ML（机器学习） | `--ws-color-purple` | `#7C3AED` |
| AI（人工智能） | `--ws-tag-blue` | `#2563EB` |
| Agents（智能体） | `--ws-color-primary` | `#0D9488` |

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

`#0284C7` 对白底为 4.58:1 ✅（AA 达标）。
`#0EA5E9` 对白底为 2.51:1 ❌（不满足 AA，只能作为 hover 态、非文本装饰）。

## 扩展流程

新增语义色应：
1. 在 `index.css` 的 `:root` 和 `.dark` 块同时定义
2. 更新本文档
3. 若需 Tailwind class 支持，同步 `tailwind.config.js` 的 `theme.extend.colors`
