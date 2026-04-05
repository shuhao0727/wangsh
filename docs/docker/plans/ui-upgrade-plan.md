# WangSh UI 渐进式迁移计划（antd → shadcn/ui）

## Context

项目已完成 CRA→Vite 迁移和 shadcn/ui 基础设施搭建，`antd` / `@ant-design/icons` 代码导入已清零。当前重点从“去依赖”转向“结构标准化与样式收敛”，目标：构建体验、bundle 减小、设计一致性、长期维护性。

### 当前状态（2026-04-03 更新）
- **构建**：Vite 8 + Tailwind v3.4.19 + TypeScript ES2022 ✅
- **shadcn**：25 组件已安装，实际已用约 10 个（持续增长中）
- **antd**：`0` 个文件导入（`ui:migration:metrics`）
- **icons**：`0` 个文件导入 `@ant-design/icons`
- **通知系统**：`message.*` 调用归零，统一为 `showMessage.*`（当前 `439` 处）
- **依赖状态**：`react-hook-form`、`zod`、`@tanstack/react-table`、`sonner` 均已安装 ✅
- **已完成主线**：公开站点主链路页面与 Admin 主要页面已去 antd 化并通过门禁；`index.tsx` 已切换 `Toaster + TooltipProvider`
- **未完成主线**：RHF+zod 尚未覆盖所有复杂表单；DataTable（tanstack）尚未形成全站统一范式
- **收尾项**：`tailwind preflight` 仍为 `false`，仍有 `.ant-*` 样式/类名残留待清理

---

## 总览：8 个阶段

| 阶段 | 内容 | 估时 | 前置 |
|------|------|------|------|
| 0 | 工程基础清理 | 1天 | 无 |
| 1 | 无状态组件替换（Tag/Space/Typography/Divider/Result） | 1-2天 | P0 |
| 2 | 交互基础组件（Button/Input/Select/Switch/Checkbox/Radio） | 2-3天 | P1 |
| 3 | 通知系统（message → sonner toast） | 2天 | P2 |
| 4 | 容器与反馈组件（Card/Modal/Drawer/Tabs/Alert/Tooltip/Popconfirm） | 2-3天 | P3 |
| 5 | 表单系统（Form → react-hook-form + zod） | 3-4天 | P4 |
| 6 | 数据表格（Table → @tanstack/react-table） | 3-4天 | P5 |
| 7 | 布局与清理（Layout/Menu/Sider → 自定义 + 移除 antd） | 2-3天 | P6 |

**总计：约 16-22 天**，分散在日常开发中，每阶段独立可合并。

---

## Phase 0：工程基础清理（1天）

### 目标
清理死代码，搭建缺失的工具链，为后续迁移打基础。

### 任务

**0.1 清理未使用的 shadcn 组件**
25 个组件中 16 个从未被页面引用，但**不要删除**——后续阶段要用。检查确认这 16 个组件文件正确可用即可。

**0.2 安装缺失依赖**
```bash
npm install sonner react-hook-form @hookform/resolvers zod @tanstack/react-table
```
> 说明：该项已完成，后续只需校验版本与 lockfile 一致性。

**0.3 迁移测试框架（可选，优先级低）**
- 安装 vitest + @testing-library/react
- 创建 vitest.config.ts
- 更新 package.json test 脚本
- 逐步迁移现有 Jest 测试

**0.4 创建迁移基线工具**
- 新增 `frontend/scripts/ui-migration-metrics.mjs`，输出：
  - antd 导入文件数
  - `@ant-design/icons` 导入文件数
  - `message.*` / `showMessage.*` 调用数
- 新增 npm 脚本：
  - `npm run ui:migration:metrics`
  - `npm run ui:migration:gate`（`type-check + build + metrics`）
- PR 模板加入迁移前后指标记录项（`.github/pull_request_template.md`）

### 验证
- `tsc --noEmit` 零错误
- `vite build` 成功
- 新依赖可正常 import

---

## Phase 1：无状态展示组件（1-2天）

### 目标
替换最简单的、没有交互状态的 antd 组件。这些改动风险最低。

### 组件映射

| antd | 替代方案 | 涉及文件数 | 方式 |
|------|----------|-----------|------|
| `Tag` | shadcn `Badge` | ~25 | 1:1 替换 |
| `Typography.Text/Title` | Tailwind 文字类 `<span>`/`<h1>`-`<h6>` | ~35 | 删除 import，改 HTML |
| `Space` | Tailwind `flex gap-*` / `space-x-*` | ~27 | 删除 import，改 className |
| `Divider` | shadcn `Separator` 或 `<hr>` | ~5 | 1:1 替换 |
| `Result` | 自定义 Tailwind 组件 | 4 | 写简单替代 |
| `Grid (Row/Col)` | Tailwind `grid` / `flex` | ~14 | 逐个替换布局 |
| `Avatar` | shadcn `Avatar` | ~5 | 1:1 替换（已安装） |

### 同步：图标迁移
每个文件在替换 antd 组件时，**同时**将该文件的 `@ant-design/icons` 替换为 `lucide-react`。不单独做图标迁移阶段。

### 关键文件（优先改）
- `src/pages/Home/index.tsx` — 主要用 Tag + Typography
- `src/pages/Articles/index.tsx` — Tag + Typography + Space + Pagination
- `src/pages/Informatics/Notes/index.tsx` — Tag + Typography
- `src/pages/PersonalPrograms/index.tsx` — Tag + Card + Typography
- `src/components/Admin/StatisticsCards.tsx` — Typography + Row/Col

### 验证
- 每个改完的页面视觉对比无变化
- 无 antd 组件残留 import（在改过的文件中）
- `tsc --noEmit` 零错误

---

## Phase 2：交互基础组件（2-3天）

### 目标
替换有交互状态但逻辑简单的 antd 组件。

### 组件映射

| antd | shadcn | 涉及文件数 | 注意点 |
|------|--------|-----------|--------|
| `Button` | shadcn `Button` | ~53 | variant 映射：primary→default, text→ghost, link→link, default→outline |
| `Input` | shadcn `Input` | ~30 | 需匹配 antd 高度 34px → shadcn 自定义 size |
| `Input.Password` | shadcn Input + 密码切换 | ~3 | 需要自行实现眼睛图标切换 |
| `InputNumber` | shadcn Input type=number | ~5 | 需自定义增减按钮 |
| `Select` | shadcn `Select` | ~15 | API 差异大：antd options prop vs shadcn children |
| `Switch` | shadcn `Switch` | ~6 | 1:1 映射 |
| `Checkbox` | shadcn `Checkbox` | ~3 | 1:1 映射 |
| `Radio` | shadcn `RadioGroup` | ~3 | 组模式不同 |

### 前置：自定义 shadcn Button 尺寸
修改 `src/components/ui/button.tsx`，添加与 antd 一致的尺寸：
```
size: {
  default: "h-[34px] px-[18px] py-1",   // 匹配 antd controlHeight: 34
  sm: "h-[28px] px-3",                   // 匹配 antd controlHeightSM: 28
  lg: "h-[42px] px-8",                   // 匹配 antd controlHeightLG: 42
  icon: "h-[34px] w-[34px]",
}
```

### 前置：自定义 shadcn Input 高度
修改 `src/components/ui/input.tsx`，默认高度匹配 antd 的 34px，背景色匹配 `#F8FAFC`。

### 策略
- 按页面逐个替换，不做全局 find-replace
- 每个页面改完立刻验证
- Button 最多（53 文件），可分 3 批：Admin 页面 → 前台页面 → 组件

### 验证
- 所有按钮/输入框视觉尺寸与之前一致
- focus ring 颜色一致（Sky Blue）
- 表单交互正常（输入、选择、提交）

---

## Phase 3：通知系统（2天）

### 目标
将 380 处 `message.success/error/warning/info` 调用统一替换为 sonner toast。这是单独一个阶段因为调用量巨大。

### 策略

**3.1 安装并配置 sonner**
- 在 `src/index.tsx` 中添加 `<Toaster />` （sonner 的，替代现有 shadcn toaster）
- 配置默认样式匹配项目设计 token

**3.2 创建兼容 API**
在 `src/lib/toast.ts` 中封装：
```typescript
import { toast } from "sonner";
export const showMessage = {
  success: (content: string) => toast.success(content),
  error: (content: string) => toast.error(content),
  warning: (content: string) => toast.warning(content),
  info: (content: string) => toast.info(content),
};
```

**3.3 批量替换**
- `message.success("xxx")` → `showMessage.success("xxx")`
- `message.error("xxx")` → `showMessage.error("xxx")`
- 可用 VS Code 全局搜索替换，46 个文件逐一确认

**3.4 移除 antd message import**
每个文件中删除 `message` 从 antd 的 import。

### 验证
- 所有操作反馈 toast 正常显示
- toast 位置、样式与项目风格一致
- 无残留 `message` import

---

## Phase 4：容器与反馈组件（2-3天）

### 组件映射

| antd | shadcn | 涉及文件数 | 注意点 |
|------|--------|-----------|--------|
| `Modal` | shadcn `Dialog` | ~17 | open/onCancel → open/onOpenChange；footer 需手动构建 |
| `Drawer` | shadcn `Sheet` | ~4 | placement → side |
| `Card` | shadcn `Card` | ~16 | 已有 AdminCard，统一改用 shadcn Card |
| `Tabs` | shadcn `Tabs` | ~6 | items prop → children 模式 |
| `Alert` | shadcn `Alert` | ~6 | 1:1 替换 |
| `Tooltip` | shadcn `Tooltip` | ~10 | 需 TooltipProvider 包裹 |
| `Popconfirm` | shadcn `AlertDialog` | ~4 | 需手动构建确认按钮 |
| `Skeleton` | shadcn `Skeleton` | ~8 | 形状 API 不同 |
| `Spin` | 自定义 Loader | ~16 | 创建 `<Loader>` 组件替代 |
| `Dropdown` | shadcn `DropdownMenu` | ~5 | 已有组件，API 差异 |
| `Pagination` | shadcn `Pagination` | ~5 | 需适配 antd 的 total/pageSize/onChange |

### 关键：Modal 迁移策略
Modal 是最关键的（17 文件 49 实例）：
1. 先创建 `src/components/ui/app-dialog.tsx` 兼容层，保持 antd Modal 类似的 API
2. 逐页面替换
3. 最后删除兼容层，直接用 shadcn Dialog

### 验证
- 所有弹窗打开/关闭正常
- 弹窗内表单提交正常
- 抽屉组件展开/收起正常

---

## Phase 5：表单系统（3-4天）

### 目标
将 23 个 `Form.useForm()` 文件迁移到 react-hook-form + zod。

### 前置
Phase 0 已安装 react-hook-form、@hookform/resolvers、zod。

### 策略

**5.1 创建表单基础组件**
基于 shadcn Form 模式，创建：
- `src/components/ui/form.tsx`（shadcn 的 FormField/FormItem/FormLabel/FormMessage）
- 通用 schema 工具（zod 验证规则）

**5.2 按复杂度分批迁移**

| 批次 | 文件 | 复杂度 |
|------|------|--------|
| 1 | 简单表单（1-3 个字段）：登录、搜索过滤 | 低 |
| 2 | 中等表单（4-8 个字段）：文章编辑、分类管理 | 中 |
| 3 | 复杂表单（8+ 字段）：用户管理、智能体配置 | 高 |

**5.3 迁移模式**
```
antd:  Form.useForm() + Form.Item + rules
  ↓
shadcn: useForm() + FormField + zodResolver(schema)
```

### 验证
- 所有表单验证规则正常工作
- 提交/重置行为一致
- 错误提示显示正确

---

## Phase 6：数据表格（3-4天）

### 目标
将 8 个 antd Table 文件迁移到 @tanstack/react-table + shadcn Table。

### 前置
Phase 0 已安装 @tanstack/react-table。

### 策略

**6.1 创建通用 DataTable 组件**
基于 shadcn DataTable 模式：
- 列定义（columnDef）
- 排序
- 分页
- 行选择
- 与 Phase 4 的 shadcn Pagination 集成

**6.2 按页面逐个迁移**

| 优先级 | 页面 | 列数 | 复杂度 |
|--------|------|------|--------|
| 1 | Admin/Categories | 少 | 低 |
| 2 | Admin/Articles | 中 | 中 |
| 3 | Admin/Users | 多 | 中（有 Upload） |
| 4 | Admin/AIAgents | 中 | 中 |
| 5 | Admin/Informatics | 中 | 中 |
| 6 | Admin/AgentData | 多 | 高（有 Tabs） |
| 7 | Admin/Assessment | 多 | 高（有统计） |
| 8 | Xbk | 多 | 最高（15 列，多 Tab） |

### 验证
- 表格排序、筛选功能正常
- 分页工作正常
- 数据加载/空状态显示正确

---

## Phase 7：布局与最终清理（2-3天）

### 目标
迁移最后的布局组件，彻底移除 antd。

### 7.1 布局迁移

| 组件 | 当前 | 目标 |
|------|------|------|
| AdminLayout | antd Layout/Sider/Menu | 自定义 Tailwind + shadcn Sidebar |
| BasicLayout | antd Layout/Header/Menu/Drawer | 自定义 Tailwind + shadcn Sheet |
| AdminEditorLayout | antd Layout/Button | Tailwind flex 布局 |

**关键**：此时所有子页面已完成迁移，布局改动不会造成风格割裂。

### 7.2 移除 antd

1. 确认 `grep -r "from 'antd'" src/` 返回 0 结果
2. 确认 `grep -r "from '@ant-design" src/` 返回 0 结果
3. 删除 `src/styles/antdTheme.ts`
4. 删除 `src/styles/ui-polish.css`（全是 antd 覆盖样式）
5. 从 `src/index.tsx` 移除 ConfigProvider/AntdApp 包裹和 `antd/dist/reset.css`
6. `npm uninstall antd @ant-design/icons`
7. 启用 Tailwind preflight（`tailwind.config.js` 中 `preflight: true`）
8. 删除 `craco.config.js`
9. 清理 vite.config.ts 中 antd 相关的 manualChunks 和 optimizeDeps

### 7.3 最终优化
- 清理 `--ws-*` 与 shadcn 变量的重复定义
- 检查 bundle 体积变化（目标：减少 1MB+ gzip）
- 考虑 Tailwind v4 升级（独立计划）

### 验证
- `npm ls antd` 确认已卸载
- `vite build` 成功，无 antd chunk
- 所有页面功能正常
- Bundle 体积对比记录

---

## 阶段间依赖图

```
P0 (基础清理)
 ↓
P1 (展示组件) ←── 可与日常开发并行
 ↓
P2 (交互组件) ←── Button/Input 被大量引用，需先完成
 ↓
P3 (通知系统) ←── 需要 P2 的 Button 已迁移
 ↓
P4 (容器组件) ←── Modal/Drawer 内部用到 Button/Input
 ↓
P5 (表单系统) ←── 表单内用到 Input/Select/Button/Modal
 ↓
P6 (数据表格) ←── 表格页面包含表单和弹窗
 ↓
P7 (布局+清理) ←── 必须最后，所有子组件迁移完成后
```

## 每阶段检查清单

每完成一个阶段后必须：
1. `tsc --noEmit` 零错误
2. `vite build --mode production` 成功
3. Docker 热加载启动，主要页面手动验证
4. 记录 antd import 文件数变化（目标：每阶段减少 10-20 个）
5. 独立 git commit/PR，可回滚
