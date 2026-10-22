# 前端无障碍指南

> 状态：reference
> Owner：frontend
> 最近复核：2026-07-13

本文维护 WangSh 当前可执行的无障碍约束，不提供未接入项目的 Jest/axe 脚手架示例。
页面结构和组件路径以 [UI-PAGES.md](UI-PAGES.md) 为准。

## 基线目标

- 键盘可以到达并操作全部核心功能。
- 交互元素具有稳定的可访问名称、角色和状态。
- 焦点可见，Dialog/Sheet 打开和关闭后的焦点位置可预测。
- 表单错误不仅依赖颜色表达。
- 正文和交互控件满足 WCAG AA 对比度要求。
- 缩放到 200% 或窄屏时不丢失核心操作。

## 组件要求

### 按钮与链接

- 原生导航使用链接，动作使用按钮，不用无语义 `div` 模拟交互。
- 图标按钮必须提供 `aria-label` 或可见文本。
- 禁用态使用真实 `disabled`；异步动作使用 `aria-busy` 并避免重复提交。
- 外部链接或新窗口行为要在文本或可访问名称中说明。

### 表单

- 每个输入项都要有可关联的 `label`。
- 错误信息通过 `aria-describedby` 与输入项关联。
- 必填、无效、只读和禁用状态使用语义属性表达。
- 提交失败后把焦点移动到错误摘要或第一个无效字段。
- placeholder 不能替代标签。

### Dialog、Sheet 与浮动面板

- 优先使用 `frontend/src/components/ui` 中已有组件。
- 打开后焦点进入容器，关闭后返回触发元素。
- Escape 行为、遮罩关闭和未保存内容保护遵循现有组件合同。
- 标题和描述必须由 `aria-labelledby` / `aria-describedby` 或组件属性建立关系。
- PythonLab 调试控制区不引入依赖 portal/hover/focus restore 的复杂 Tooltip。

### 表格与状态

- 表格使用正确的表头语义，排序状态通过 `aria-sort` 表达。
- loading、empty、error 和 success 状态都要有文本说明。
- 自动刷新区域避免抢焦点；必要时使用克制的 `aria-live`。
- 图表必须提供标题、摘要或同等信息的文本/表格替代。

## 视觉要求

- 使用 `--ws-*` 语义 token，不硬编码只适合浅色或深色主题的颜色。
- 正常文本对比度至少 4.5:1，大文本至少 3:1，交互边界至少 3:1。
- 焦点环不能仅靠浏览器不稳定默认样式，也不能被 `outline: none` 无替代地移除。
- 信息状态至少同时使用文本、图标、形状或位置中的一种，不只依赖红/绿颜色。
- 动画应尊重 `prefers-reduced-motion`，避免无必要的持续闪烁和大幅位移。

色彩 token 和对比度说明见
[COLORS.md](../../../frontend/src/styles/COLORS.md)。

## 验证流程

### 自动门禁

```bash
cd frontend
npm test
npm run type-check
npm run lint
npm run token:check:ci
npm run ui:audit:ci
npm run build:check
```

项目当前没有独立 `jest-axe` 命令。若未来引入自动 a11y 扫描，必须先在
`package.json`、CI 和本文件中建立正式入口，不能把未配置示例当成现行命令。

### 人工键盘检查

1. 只用 Tab、Shift+Tab、Enter、Space、方向键和 Escape 完成核心流程。
2. 确认焦点顺序与视觉顺序一致，焦点始终可见。
3. 打开和关闭 Dialog/Sheet，确认焦点进入内容并返回触发按钮。
4. 在 loading、错误和空状态下确认仍可理解当前状态。
5. 以 200% 缩放和窄屏复查导航、表单、表格和主要操作。

### 屏幕阅读器抽查

- macOS 使用 VoiceOver，Windows 可使用 NVDA。
- 优先抽查登录、导航、用户管理、课堂互动、内容编辑和 PythonLab。
- 检查标题层级、Landmark、控件名称、错误提示和动态状态播报。

## 变更清单

涉及新页面、表单、Dialog、Sheet、复杂表格或自定义交互时：

- [ ] 使用现有语义组件和设计 token。
- [ ] 补充键盘与可访问名称测试。
- [ ] 检查 loading、empty、error、disabled 和只读状态。
- [ ] 运行前端自动门禁。
- [ ] 完成键盘和至少一个屏幕阅读器抽查。
- [ ] 更新 `UI-PAGES.md` 或对应功能 owner 文档。

## 相关文档

- [前端文档索引](README.md)
- [页面清单](UI-PAGES.md)
- [UI 治理与回归基线](../plans/ui-single-page-governance.md)
- [前端测试](../../../frontend/docs/TESTING_SETUP.md)
- [角色权限](../../../frontend/src/styles/ROLES.md)
