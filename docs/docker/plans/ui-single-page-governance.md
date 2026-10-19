# UI 治理与回归基线

> 状态：reference
> Owner：frontend
> 最近复核：2026-10-19
> 归档条件：设计系统和自动 UI 门禁完整覆盖本文规则

本文合并原样式护栏、单页治理、页面体检模板和最终回归清单。目标是在不改变业务
逻辑、接口和权限的前提下，以统一、可重复的方式治理前端页面。

本文只维护体检与回归方法。已确认的视觉规则以
[嵌入式页面整理规范](../frontend/EMBEDDED_UI_STYLE_GUIDE.md) 为准，页面族进度和用户确认
状态由 [整理路线图](../frontend/UI_REDESIGN_ROADMAP.md) 维护，不在此重复记录。

## 适用范围

- 页面布局、排版、间距、卡片、按钮和响应式调整。
- Admin 页面、公共页面、Task Analysis 页面和重点浮层。
- 页面族范围以 [UI_REDESIGN_ROADMAP.md](../frontend/UI_REDESIGN_ROADMAP.md) 为准；
  [UI-PAGES.md](../frontend/UI-PAGES.md) 补充核心页面和重点浮层。
- 无障碍专项以 [ACCESSIBILITY_GUIDE.md](../frontend/ACCESSIBILITY_GUIDE.md) 为准。

不用于替代功能 owner 文档、API 文档或组件实现说明。

## 样式护栏

### 允许

- 使用 `frontend/src/styles/index.css` 中已定义的 `--ws-*` 语义 token。
- 优先使用语义 Tailwind 尺寸，如 `text-sm`、`text-base`、`px-3`、`py-2`。
- 复用 `ws-fluid-container`、`ws-admin-page`、`panel-card-*` 和项目 UI 组件。
- 项目为永久浅色主题；使用现有语义 token，按当前浅色主题验证。

### 默认禁止

- 在业务页面新增硬编码色值或不存在的 CSS 变量。
- 新增 `text-[13px]`、`w-[256px]` 等无设计依据的任意值。
- 同一页面混用互不相关的字号、间距和圆角体系。
- 为解决局部问题复制一套新的按钮、表格、分页或弹窗样式。

### 例外

Canvas、媒体视口、拖拽手柄等确需固定尺寸时：

1. 只在一个文件或模块内使用。
2. 添加简短原因注释。
3. 不扩散为新的全局尺度。

## 单页治理流程

1. 默认指定一个页面族或一个浮层；用户明确授权批量时，可并行处理文件边界清楚的页面族。
2. 按 P0-P3 输出问题和证据。
3. 明确只改什么、不改什么。
4. 完成最小样式和布局调整。
5. 运行静态检查、视觉检查和关键交互回归。
6. 每页独立记录工程验证和用户视觉确认；批量执行也不能把工程检查等同于用户验收。

问题分级：

| 级别 | 含义 |
|---|---|
| P0 | 骨架或比例失衡，影响主要内容使用 |
| P1 | 字号、层级或可读性明显冲突 |
| P2 | 间距、卡片和组件密度不一致 |
| P3 | 阴影、图标、按钮等细节噪声 |

基础规则：

- 导航和正文使用项目统一字号层级。
- 同级区块保持一致间距。
- 卡片、按钮、表格和分页优先复用共享组件。
- 小屏先保证可读性和操作区域，再压缩间距，不先压缩字体。
- 页面截图基线：1280×800、1440×900、1680×1050、1920×1080；窄屏页面按工作流补充验证。

## 单页体检模板

```markdown
# 页面体检

- 页面名称：
- 路由：
- 日期：
- 负责人：

## 问题

- P0：
- P1：
- P2：
- P3：

## 改动边界

- 只改：
- 不改：

## 最小方案

- 改动点：
- 预期效果：
- 风险：

## 验收

- [ ] `npm run type-check`
- [ ] 1280×800
- [ ] 1440×900
- [ ] 1680×1050
- [ ] 1920×1080
- [ ] 适用的窄屏布局和浮层边界
- [ ] 核心交互
- [ ] 键盘和焦点
- [ ] 空态、加载态和错误态

## 结论

- 是否通过：
- 遗留问题：
```

## 最终回归清单

### 全局样式

- [ ] 字体、标题、正文和辅助信息层级一致。
- [ ] 链接、hover、active、focus 和禁用态正常。
- [ ] 页面无异常横向滚动或大面积空白。

### 表单、表格与分页

- [ ] Input、Textarea、Select、Checkbox、Switch 可操作。
- [ ] 主按钮、次按钮、危险按钮层级清晰。
- [ ] 表头、列宽、滚动、加载态和空态正常。
- [ ] 页码、每页条数和总数行为正确。

### Dialog、Sheet 与浮层

> **按钮顺序合同**（2026-10-04 抢救自已删除的 `DIALOG_BUTTON_ORDER_REPORT.md`，与代码一致）：
> `DialogFooter` 使用 `flex flex-col-reverse sm:flex-row sm:justify-end gap-button-gap`
> （见 `frontend/src/components/ui/dialog.tsx`）。即：**次要/取消按钮在前，主要按钮在后**；
> 移动端通过 `flex-col-reverse` 让主按钮显示在上方。危险操作按钮与常规按钮分离，
> 不与主按钮相邻。只有一个按钮的对话框（如纯提示）不受此约束。

- [ ] 打开、关闭、ESC、遮罩和焦点恢复正常。
- [ ] 底部按钮顺序为「次要在前、主要在后」，移动端主按钮在上。
- [ ] 移动端内容可滚动且不溢出。
- [ ] 删除、批量操作和 Toast 反馈完整。
- [ ] PythonLab 调试控制使用真实 pointer click 验证。

### 关键页面

- [ ] Assessment：列表、题目、统计和画像流程。
- [ ] XBK：筛选、Tab、导入、分析、分页和导出。
- [ ] AgentData：列表、详情、批量导出和分页。
- [ ] Classroom：活动、计划、筛选、详情和操作。
- [ ] PythonLab：Run、Debug、Pause、Continue、Step、Reset 和终端。

### 响应式与边界

- [ ] 430px、768px、1024px、1920px 无明显布局崩坏。
- [ ] 长文本、空数据、异常数据和慢网速状态正常。
- [ ] 当前浅色主题颜色和图表可读。

## 验证入口

```bash
cd frontend
npm run type-check
npm run test
npm run ui:audit:ci
npm run build:check
```

单页辅助入口：

```bash
npm run ui:audit -- --route /ai-agents
npm run ui:page:report -- --route /ai-agents
npm run ui:page:verify -- --route /ai-agents
```
