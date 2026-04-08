# PythonLab 调试 Continue 卡死事故记录

> 记录日期：2026-04-08
> 适用范围：PythonLab 右侧调试控制区，特别是 `Continue / Pause / Step / Run / Debug / Reset` 按钮

## 事故摘要

- 现象：
  - 用户在 PythonLab 中打好断点后点击 `调试`，能正常命中断点。
  - 命中断点后点击 `继续`，页面表面上停在当前状态，看起来像“正在加载”或“卡死”。
  - Chrome 与 Safari 都可能出现。
  - 卡死后 CPU / 内存占用显著上升，用户误以为是后端调试循环或死循环。
- 实际根因：
  - 不是后端没有恢复执行，也不是 DAP 会话本身的状态机错误。
  - 根因在前端右侧调试控制按钮外层的 Radix Tooltip hover/pointer 交互。
  - 命中断点后，鼠标悬停在 `Continue` 按钮上时，tooltip 打开，真实浏览器中的 pointer/click 链路被卡住，导致按钮点击没有真正触发到业务 `onContinue`。

## 关键证据

### 1. 后端证据：没有收到 Continue 请求

- 典型会话：`dbg_722d4b11a0284a26886e5508f8289b38`
- 该会话已经成功完成：
  - `initialize`
  - `attach`
  - `initialized`
  - `setBreakpoints`
  - `configurationDone`
  - `stopped`
  - `stackTrace`
  - `scopes`
  - `variables`
- 但在用户声称“点击 Continue 后卡死”的那段时间里，后端没有收到 `continue` 请求。
- 结论：
  - 断点暂停之后，前端按钮点击没有穿透到调试控制器。
  - 这说明问题在浏览器点击链路，不在后端调试执行链路。

### 2. 真实浏览器证据：JS click 可以，真实 pointer click 不可以

- 在真实 WebKit / Safari 路径中复现时：
  - 正常 `hover + click` 会卡在浏览器点击动作上。
  - `button.click()` 这种 JS 直接触发可以继续执行并正常结束。
- 在真实 Google Chrome channel 中也复现到同样行为：
  - 第一处断点命中后，`Continue` 按钮可见、可用。
  - 但 hover 后的真实点击会卡在 click action 本身。
- 结论：
  - 这不是某个浏览器专属 API 差异，而是“真实 pointer 事件 + tooltip 弹层 + 调试控制按钮”这条组合链路存在兼容性问题。

### 3. Chromium smoke 不能替代真实 Chrome / WebKit

- 事故期间，部分 Chromium smoke 可以通过。
- 但真实 Chrome channel 与真实 WebKit 仍能稳定复现。
- 结论：
  - 仅依赖 Playwright 默认 Chromium 不能覆盖这类 hover-tooltip-pointer 交互问题。

## 根因拆解

### 表层原因

- `RightPanelView` 中调试控制按钮外层使用了 Radix Tooltip。
- 用户命中断点后，鼠标通常停留在 `Continue` 按钮上方。
- hover 导致 tooltip 进入打开或延迟打开状态。
- 在真实浏览器里，这层交互会干扰后续 pointer click 提交。

### 深层原因

- 调试控制按钮属于“高频、连续点击”的强操作控件。
- 这类控件不应该依赖需要 hover / pointer outside 管理的复杂 tooltip 组件。
- 右侧调试面板的交互优先级应该是“点击绝对可靠”，而不是“悬浮提示更丰富”。

## 修复方案

- 修复文件：
  - `frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`
- 修复策略：
  - 右侧调试控制区的 `PanelTooltip` 不再使用 Radix Tooltip。
  - 改为给按钮直接注入原生 `title` 与 `aria-label`。
- 为什么这样修：
  - 原生 `title` 不会引入额外的 hover state machine、portal、pointer outside、focus restore 等复杂行为。
  - 对调试控制按钮来说，稳定点击比富 tooltip 更重要。

## 为什么这次修复是正确方向

- 修复后在以下路径都已通过：
  - 真实 Google Chrome channel：
    - 多断点
    - 连续多次 `Continue`
    - 直到程序结束
  - 真实 WebKit：
    - 多断点
    - 连续多次 `Continue`
    - 直到程序结束
  - Chromium smoke：
    - `debug-happy-path`
    - `debug-multi-breakpoint-continue-to-end`
    - `debug-pause-resume-to-end`
- 最新 smoke 报告：
  - `frontend/test-results/pythonlab/debug-smoke-report.json`

## 以后不允许再犯的约束

### 交互设计约束

- 不要再给 PythonLab 右侧调试控制按钮套用需要 hover 管理的复杂 tooltip 组件。
- 对以下控件，默认只能使用原生 `title`，除非有非常强的理由且经过真实浏览器验证：
  - `Run`
  - `Debug`
  - `Pause`
  - `Continue`
  - `Step Over`
  - `Step Into`
  - `Step Out`
  - `Reset`

### 验证约束

- 只跑默认 Chromium smoke 不算调试控制区验证完成。
- 只要改动了以下任一内容，必须补跑真实浏览器验证：
  - 调试控制按钮
  - tooltip
  - hover / pointer / focus 交互
  - Radix 弹层类组件
  - 调试状态切换 UI
- 最少验证矩阵：
  - 真实 Chrome channel
  - WebKit
  - 多断点连续 `Continue` 到结束

### 排障约束

- 如果再次出现“断点暂停后点击 Continue 卡死”：
  1. 先确认后端是否真的收到 `continue` 请求。
  2. 如果后端没收到，请先查前端点击链路，不要先怀疑 DAP 死循环。
  3. 优先排查 tooltip、popover、dialog、pointer capture、focus restore、outside click 相关组件。

## 建议的回归检查清单

- 单断点：`Debug -> Pause -> Continue -> Finish`
- 多断点：`Debug -> Continue -> Continue -> Continue -> Finish`
- 运行中暂停：`Debug -> Continue -> Pause -> Continue -> Finish`
- 鼠标悬停在控制按钮上时重复点击
- Chrome channel 与 WebKit 都至少跑一遍

## 结论

- 这次故障不是后端调试协议错误，而是前端调试控制区 tooltip 设计不适合高频调试按钮。
- 以后要把这类问题归类为“真实浏览器交互兼容性故障”，而不是“仅 smoke 通过即可关闭”的问题。
- 当前正确原则只有一句话：
  - 调试控制按钮的第一优先级是点击可靠性，不是 tooltip 丰富度。
