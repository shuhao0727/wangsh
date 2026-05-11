# WangSh 色彩语义规范

所有颜色通过 CSS 变量 `--ws-*` 定义于 `frontend/src/styles/index.css`，Tailwind
配置把它们映射到语义 class（`bg-primary`、`text-success` 等）。**禁止直接硬编码色值**（`#0EA5E9`/`bg-sky-500`），除非明确设计决策（如模块识别色、分数梯度）。

## 语义色一览

| 语义 | Token | 亮色 | 暗色 | 用途 | 反例 |
|------|-------|------|------|------|------|
| **primary** | `--ws-color-primary` | `#0284C7` (Sky 600) | `#38BDF8` | 主按钮、链接、选中、进度条、表单聚焦 | 不用于危险操作、不作为大面积背景 |
| **primary-hover** | `--ws-color-primary-hover` | `#0EA5E9` | `#7DD3FC` | primary 元素 hover 态 | — |
| **primary-soft** | `--ws-color-primary-soft` | 低饱和淡蓝 | 深色半透 | 选中项背景、菜单 active bg | 不作为正文色 |
| **primary-muted** | `--ws-color-primary-muted` | `#E0F2FE` (Sky 50) | `#075985` | 超大面积 hero 浅蓝背景、tag bg | 不作为按钮背景 |
| **secondary** | `--ws-color-secondary` | Indigo | Indigo 亮 | 次要强调 | — |
| **accent** | `--ws-color-accent` | `#F97316` (Orange) | Orange 亮 | CTA 按钮、限时提示、重要标记 | 不用于警告（用 warning） |
| **success** | `--ws-color-success` | `#10B981` (Emerald) | Emerald 亮 | 完成、通过、正向指标、升幅 | 不用于"已选中"（用 primary） |
| **warning** | `--ws-color-warning` | `#F59E0B` (Amber) | Amber 亮 | 警告、待处理、需注意 | 不用于 CTA（用 accent） |
| **error** | `--ws-color-error` | `#EF4444` (Red) | Red 亮 | 错误、删除、危险操作、降幅 | 不用于中性信息（用 info） |
| **info** | `--ws-color-info` | `#0EA5E9` (Sky 500) | 同左 | 信息提示、帮助文本、中性徽标 | 不用于主行动（用 primary） |
| **purple** | `--ws-color-purple` | `#8B5CF6` | 同左 | 课堂互动模块识别色 | 不用于其它模块 |

## 模块识别色（固定，不随主题调整）

| 模块 | 色值 | 出现位置 |
|------|------|----------|
| ML（机器学习） | `#8B5CF6` Violet | `/admin/it-technology/ml` |
| AI（人工智能） | `#2563EB` Blue | `/admin/it-technology/ai` |
| Agents（智能体） | `#0D9488` Teal | `/admin/it-technology/agents` |

## 使用方式

### ✅ 推荐

```tsx
<Button>确定</Button>                                    {/* primary */}
<Button variant="destructive">删除</Button>              {/* error */}
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
