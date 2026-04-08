# PythonLab Capability Inventory

冻结时间：2026-04-08  
执行基线：`~/.claude/plans/velvet-questing-cocoa.md` 的 `Round 1 / 子阶段 1.1`

## 目标

本文件只记录当前 PythonLab 已暴露的功能面、UI 操作路径、API 路径和实现落点，不记录新方案的实现方式。后续重构时，删除旧代码前必须先对照本清单确认能力覆盖是否完整。

## 当前架构快照

- 当前前端不是单一路径，`PythonLabStudio` 通过 `useUnifiedRunner` 同时拼接了 `useDapRunner` 和 `usePyodideRunner` 两套执行/调试能力。
- 当前前端主调用面已经切到 `/api/v2/pythonlab/*`。
- 当前后端主实现已经收敛到 `backend/app/api/pythonlab/*`。
- 当前 `/api/v2/pythonlab/*` 直接引用该 canonical 模块。
- 当前 `/api/v1/debug/*` 仍作为 deprecated 兼容入口挂载，但只保留兼容壳，不再承载主实现。
- 当前普通运行既可能走 DAP，也可能走 Pyodide；当前断点调试既可能走 DAP，也可能走 Pyodide，本地/远端职责没有彻底收敛。

## 当前清理结论

- 对前端和烟测来说，`/api/v1/debug/*` 已不是主入口。
- 对后端实现层来说，主实现已经迁到 `backend/app/api/pythonlab/*`，`backend/app/api/endpoints/debug/*` 只剩 deprecated 兼容包装层。
- 真正的删除顺序应该是：
  1. 保持 `backend/app/api/pythonlab/*` 作为唯一 canonical 实现层；
  2. 继续让 `/api/v2/pythonlab/*` 作为默认公开入口；
  3. 维持 `/api/v1/debug/*` 为最小兼容别名；
  4. 等日志、调用量、脚本和外部依赖全部迁移后再下线别名。

## 能力清单

| 功能名称 | UI 操作路径 | 当前 API 路径 | 当前实现文件 | 当前行为备注 |
|---|---|---|---|---|
| Python 编辑器加载与回退 | 右侧面板顶部 `Python` 编辑器；弹出式编辑器 | 无 | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/MonacoPythonEditor.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx` | 默认使用 Monaco；1.2s 内未挂载时回退到 `textarea`；编辑器 loading 文案会显示“正在加载编辑器...”。 |
| 代码编辑与流程图代码同步 | 右侧编辑器修改代码；“从流程图同步”按钮 | 无直接 API | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePythonFlowSync.ts` | `codeMode` 在 `auto/manual` 间切换；可从流程图反生成代码，也可从代码重建流程图。 |
| 语法检查 | 编辑器输入后自动检查 | `POST /api/v2/pythonlab/syntax/check` | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabDebugApi.ts`<br>`backend/app/api/pythonlab/syntax.py` | 前端 800ms debounce 调后台语法检查，并将错误标记回 Monaco。 |
| 断点设置与显示 | 点击编辑器左侧行号 / gutter | 无直接 API；DAP 模式下后续走 `setBreakpoints` over WS | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/MonacoPythonEditor.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useUnifiedRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts` | 断点状态先保存在前端；统一同步给 DAP/Pyodide 两套 runner；支持 enabled、condition、hitCount。 |
| 普通运行入口 | 控制栏 `Run` 按钮 | 可能使用 `POST /api/v2/pythonlab/sessions`、`GET /api/v2/pythonlab/sessions/{id}`、`WS /api/v2/pythonlab/sessions/{id}/terminal`；也可能无后端 API | `frontend/src/pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/launchPlan.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useUnifiedRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts` | 由 `decidePythonLabLaunchPlan` 决定走 DAP 还是 Pyodide；当前“普通运行”并未强制固定到单一引擎。 |
| 终端输出与 stdin 交互 | 右侧面板 `终端交互` tab | DAP 模式：`WS /api/v2/pythonlab/sessions/{id}/terminal`；Pyodide 模式：无后端 API | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/components/XtermTerminal.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/components/PyodideTerminal.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts`<br>`backend/app/api/pythonlab/ws.py` | 右侧 tab 根据 active runner 在 `XtermTerminal` 与 `PyodideTerminal` 间切换；DAP 终端通过 TTY WS；Pyodide 终端通过本地 bridge。 |
| 调试启动 | 控制栏 `Debug` 按钮 | 可能使用 `POST /api/v2/pythonlab/sessions`、`GET /api/v2/pythonlab/sessions/{id}`、`WS /api/v2/pythonlab/sessions/{id}/ws` | `frontend/src/pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/launchPlan.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabSessionApi.ts`<br>`backend/app/api/pythonlab/sessions.py`<br>`backend/app/api/pythonlab/ws.py` | 当前要求至少有 1 个启用断点；若 `sourceMismatch`，会先尝试重建流程图映射；实际调试仍可能回落到 Pyodide。 |
| 调试继续 / 暂停 / 单步 / 重置 | 控制栏 `Pause / Continue / Step Over / Step Into / Step Out / Reset` | DAP 模式：通过 `WS /api/v2/pythonlab/sessions/{id}/ws` 转发 DAP 请求；Pyodide 模式：worker + SAB | `frontend/src/pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useUnifiedRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts` | 控制矩阵由 `runner.status` 驱动；Pyodide 的 `stepInto`/`stepOut` 目前直接复用 `stepOver`。 |
| 变量面板 | 右侧面板 `调试器` tab 的“变量”区 | 无独立 HTTP API；DAP 走 `scopes/variables` over WS；Pyodide 从 worker paused 事件回传 | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/DebugTab.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts` | 暂停时刷新变量；支持 changed vars 高亮；数据源随 runner 不同而不同。 |
| Watch 表达式与求值 | 右侧面板 `调试器` tab 的“表达式”区 | 无独立 HTTP API；DAP 走 `evaluate` over WS；Pyodide 走 worker `evalResult` | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/DebugTab.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts` | 仅在暂停时计算；添加 watch 后若当前未暂停，会提示“等待下次暂停时计算...”。 |
| 调试态流程图高亮与跟随 | 命中断点后画布节点高亮、自动跟随 | 无直接 HTTP API；数据来自 runner 状态 | `frontend/src/pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/adapters/debugEventBridge.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/flow/debugMap.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePyodideRunner.ts` | 通过 `activeLine / activeFlowLine / activeNodeId / activeFocusRole` 驱动画布激活；当前 `running` 和 `paused` 都可能触发高亮。 |
| 流程图与代码版本失配检测 | 点击 `Debug` 前；控制栏警告 badge；手动点击刷新映射 | 无独立 API；依赖已有 flow rebuild / session meta | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePythonFlowSync.ts` | DAP 会比对 `session code_sha256` 与 `debugMap codeSha256`；失配时禁用节点高亮并提示用户先重建映射。 |
| 会话创建 / 查询 / 停止 / 列表 / 清理 | Run/Debug 启动；会话恢复；后台清理 | `POST /api/v2/pythonlab/sessions`<br>`GET /api/v2/pythonlab/sessions/{id}`<br>`POST /api/v2/pythonlab/sessions/{id}/stop`<br>`GET /api/v2/pythonlab/sessions`<br>`POST /api/v2/pythonlab/sessions/cleanup` | `frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabSessionApi.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`backend/app/api/pythonlab/sessions.py`<br>`backend/app/tasks/pythonlab.py` | DAP 启动会轮询 session 状态直到 ready；session id 会暂存到 `sessionStorage` 以支持刷新恢复。 |
| DAP WebSocket 调试代理 | 调试启动后的控制与事件流 | `WS /api/v2/pythonlab/sessions/{id}/ws` | `frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/useDapRunner.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/dapRunnerHelpers.ts`<br>`backend/app/api/pythonlab/ws.py` | 当前支持 token 鉴权、互斥接管、关闭码提示；当前没有按计划定义的顺序保证 / 重连补发协议。 |
| 代码转流程图（主路径） | 编辑代码后自动重建流程图；调试前重建映射 | `POST /api/v2/pythonlab/flow/parse` | `frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePythonFlowSync.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabDebugApi.ts`<br>`backend/app/api/pythonlab/flow.py` | 当前 `preferBackendCfg: true`，手改代码后主路径优先走 `flow/parse` 并立即渲染结果。 |
| CFG 解析（备选路径） | `preferBackendCfg=false` 且本地构建失败时回退 | `POST /api/v2/pythonlab/cfg/parse` | `frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePythonFlowSync.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabDebugApi.ts`<br>`backend/app/api/pythonlab/cfg.py` | 当前在 `PythonLabStudio` 中默认不开主用；保留为后备解析路径。 |
| 流程图反生成代码（AI 兜底） | 本地代码生成失败时自动触发；也可被其他入口复用 | `POST /api/v2/pythonlab/flow/generate_code` | `frontend/src/pages/Admin/ITTechnology/pythonLab/hooks/usePythonFlowSync.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabDebugApi.ts`<br>`backend/app/api/pythonlab/flow.py` | 语义失败时会触发 AI fallback；若 `autoOptimizeCode` 打开，还会继续调用优化接口。 |
| 代码优化 | 右侧编辑器工具栏“闪电”按钮；优化弹窗的应用/重生成功能 | `POST /api/v2/pythonlab/optimize/code`<br>`POST /api/v2/pythonlab/optimize/apply/{log_id}`<br>`GET /api/v2/pythonlab/optimize/rollback/{log_id}` | `frontend/src/pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/components/OptimizationDialog.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabDebugApi.ts`<br>`backend/app/api/pythonlab/flow.py` | 当前前端实际使用 `optimize` 与 `apply`；`rollback` 已有 API client，但当前页面未见稳定入口。 |
| AI 聊天助手 | 预留弹窗入口，当前在右侧面板中被注释掉 | `POST /api/v2/pythonlab/ai/chat` | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/AIAssistantModal.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabDebugApi.ts`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/components/rightPanel/RightPanelView.tsx`<br>`backend/app/api/pythonlab/flow.py` | 能力仍在，但当前主 UI 入口被注释，属于“后端可用 / 前端未正式挂载”的状态。 |
| Prompt 模板读取/保存 | Admin 里的 Agent 配置弹窗打开与保存时 | `GET /api/v2/pythonlab/flow/prompt_template`<br>`POST /api/v2/pythonlab/flow/prompt_template` | `frontend/src/pages/Admin/ITTechnology/components/AgentConfigModal.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabDebugApi.ts`<br>`backend/app/api/pythonlab/flow.py` | 这是 PythonLab 之外的直接依赖方，迁移 v2 时不能遗漏。 |
| Agent 连通性测试 | Admin 里的 Agent 配置弹窗“测试连接” | `POST /api/v2/pythonlab/flow/test_agent_connection` | `frontend/src/pages/Admin/ITTechnology/components/AgentConfigModal.tsx`<br>`frontend/src/pages/Admin/ITTechnology/pythonLab/services/pythonlabDebugApi.ts`<br>`backend/app/api/pythonlab/flow.py` | 同属 Admin 依赖；当前与 feature flag 配置一起使用。 |
| 兼容入口命中观测 | 后端排查 / 下线 `/api/v1/debug/*` 前查看最近使用量 | `GET /api/v2/pythonlab/compat/deprecated_usage` | `backend/app/api/pythonlab/compat.py`<br>`backend/app/api/pythonlab/compat_routes.py` | 返回最近 N 天 v1 HTTP / WebSocket 命中计数，用于确认 deprecated 别名是否还能下线。 |

## 需要在删除旧实现前保持可回归验证的行为

- 编辑器必须支持代码输入、语法错误标记、断点点击、活动行高亮和加载回退。
- 普通运行必须支持 stdout 展示，以及需要 `input()` 时的终端交互。
- 调试必须覆盖：启动、暂停、继续、单步、停止、变量查看、watch 表达式、流程图高亮跟随。
- 流程图必须支持：代码改动后重建、调试前失配修复、解析失败时给出明确错误。
- Admin 的 `AgentConfigModal` 依赖必须跟随迁移，否则 PythonLab 之外的管理能力会被静默打断。

## 风险冻结（Round 1 / 1.2）

| 风险 | 严重度 | 当前代码证据 | 冻结结论 |
|---|---|---|---|
| Pyodide worker 的 module/classic 兼容冲突 | P0 | `usePyodideRunner.ts` 直接 `new Worker(new URL(...))` 创建 worker；`pyodideDebug.worker.ts` 内显式写了 `importScripts shim` 来绕过 module worker 与 Pyodide classic 兼容问题；`frontend/vite.config.ts` 当前没有 `worker.format` 相关配置。 | 该风险真实存在，而且当前实现已经依赖运行时 shim 才能勉强兼容；这是需要在新方案里彻底移除的历史补丁点。 |
| DAP 沙箱内存基线不一致，存在 OOM 风险 | P0 | `sessions.py` 的请求默认 `memory_mb=32`；`docker.py` 启动 sandbox 时又会取 `PYTHONLAB_DEFAULT_MEMORY_MB`；`docker-compose.dev.yml` 设为 `128`，但 `docker-compose.yml` 的 `pythonlab-sandbox` 容器限制仍是 `80M`。 | 风险不是单点，而是“请求默认值 / sandbox 默认值 / 容器硬限制”三套口径并存；调试链路需要统一内存基线后再做稳定性验证。 |
| `clearPauseVisualState` 级联 dispatch 导致暂停态清理抖动 | P1 | `useDapRunner.ts` 中 `clearPauseVisualState` 连续派发 `SET_FRAMES / SET_VARIABLES / SET_CHANGED_VARS / SET_ACTIVE_LINE / SET_ACTIVE_EMPHASIS / SET_WATCH_RESULTS`；同文件其他暂停/关闭分支也重复清空这些状态。 | 风险真实存在，且属于当前前端状态模型分散的直接后果；新状态机应把这类“暂停态清空”收束为单次状态迁移。 |
| `debugEventBridge` 对激活信息的判定过脆，可能丢失高亮连续性 | P1 | `debugEventBridge.ts` 中 `toDebugPauseEvent` 在没有 `activeNodeId/activeLine/activeFlowLine` 时直接返回 `null`；`resolveFlowActivation` 又允许 `running` 态激活依赖 runner 兜底。 | 当前实现并非稳定的事件协议，而是“事件对象 + runner 当前态”混合推断；重构时要把 flow activation 改成单一来源，避免继续/运行瞬间高亮闪断。 |
| DAP 调试事件流缺少协议级重连与补发 | P2 | `useDapRunner.ts` 的 DAP WS 在 `close` 后直接报错并置 `stopped`，没有 `last_seq`、重放或自动重连；`backend/app/api/pythonlab/ws.py` 也没有计划中定义的 `seq`、缓存补发、ping/pong 协议。当前只有 `XtermTerminal.tsx` 对终端 WS 做了 UI 层重连。 | 需要把风险精确定义为“DAP 调试事件流无协议级重连补发”；不能笼统描述成所有 WebSocket 都无重连。 |

## 技术预研（Round 1 / 1.3）

### 预研结论表

| 预研项 | 验证方式 | 结果 | 结论 |
|---|---|---|---|
| Vite worker 兼容方案 | 在当前开发环境 `http://localhost:6608` 登录后进入 `/it-technology/python-lab/seq_basic`，点击 `Run` 触发本地运行路径；同时检查浏览器控制台、网络请求和 dev server 暴露的 worker 资源。 | `FAIL` | 当前开发模式下 Pyodide worker 没有正常初始化，验收标准“开发模式下 Pyodide Worker 正常初始化”未满足。 |
| Pyodide 版本锁定 | 检查 `frontend/package.json`、`frontend/public/pyodide/pyodide-lock.json`、`pyodideDebug.worker.ts`。 | `PASS` | 当前项目已把 Pyodide 版本锁到 `0.25.1`，对应 Python `3.11.3` 与 `emscripten_3_1_46`；版本来源是清晰的。 |
| DAP 内存基线 | 读取当前开发容器环境变量；运行现有 `smoke_pythonlab_dap_step_watch_soak.py`；再用同脚本逻辑追加 `256MB` 版本的 10 轮 soak。 | `PASS` | 当前开发环境下，`128MB` 与 `256MB` 两组 10 轮 DAP step/watch soak 都未出现 OOM 或调试链路异常。 |

### 1.3.1 Vite worker 兼容实测

- 当前开发环境前端与后端均在线：
  - `http://localhost:6608` 可访问
  - `http://localhost:8000/health` 返回 `healthy`
- 实测路径：
  - 登录 `admin / wangshuhao0727`
  - 打开 `/it-technology/python-lab/seq_basic`
  - 点击右侧控制栏 `Run`
- 页面实测结果：
  - 页面直接显示 `Pyodide 未就绪`
  - 浏览器控制台报错：`Cannot use import statement outside a module`
  - 截图已保存：`output/playwright/pythonlab-pyodide-not-ready.png`
- 代码证据：
  - `usePyodideRunner.ts` 当前通过 `new Worker(new URL("../workers/pyodideDebug.worker.ts", import.meta.url))` 创建 worker，但没有显式传 `{ type: "module" }`
  - dev server 实际暴露的 worker 资源 `.../pyodideDebug.worker.ts?worker_file&type=module` 首行就是 ESM `import "/node_modules/vite/dist/client/env.mjs"`
  - `pyodideDebug.worker.ts` 内还保留了 `importScripts shim`，说明这条链路本身就在兼容 classic/module 冲突
- 结论：
  - 当前问题不是“偶发卡顿”，而是 dev 模式下 Pyodide worker 初始化链路直接失败。
  - 推断：后续方案必须显式统一“浏览器创建 worker 的模式”和“Vite 输出 worker 的格式”；仅在现有代码上继续叠加 shim 风险很高。
  - 推断：`worker.format: "iife"` 是否足以解决当前 dev 模式问题，本轮尚未单独验证，不能直接当成已确认方案。

### 1.3.2 Pyodide 版本锁定结果

- `frontend/package.json` 依赖固定为：`pyodide: 0.25.1`
- `frontend/public/pyodide/pyodide-lock.json` 记录：
  - `version: 0.25.1`
  - `python: 3.11.3`
  - `platform: emscripten_3_1_46`
- `pyodideDebug.worker.ts` 的加载方式：
  - 先动态 `import("${normalizedBase}pyodide.mjs")`
  - 再调用 `loadPyodide({ indexURL: normalizedBase })`
  - 并用 `importScripts shim` 兼容 Pyodide 旧式加载预期
- 结论：
  - 版本锁定是明确的，不存在“前端 package 版本”和“实际 public 目录版本”不一致的证据。
  - 当前真正的问题不在版本漂移，而在 worker 启动模式和加载机制冲突。

### 1.3.3 DAP 内存基线结果

- 当前开发环境证据：
  - `wangsh-backend` 容器内 `PYTHONLAB_DEFAULT_MEMORY_MB=128`
  - 当前 sandbox 镜像：`shuhao07/pythonlab-sandbox:1.5.5`
- `128MB` 验证：
  - 直接运行现有脚本 `backend/scripts/smoke_pythonlab_dap_step_watch_soak.py`
  - 连续 10 轮全部通过
  - 每轮都完整覆盖 `initialize -> attach -> setBreakpoints -> configurationDone -> stackTrace -> scopes -> variables -> evaluate -> stepIn -> stepOut -> next -> continue`
- `256MB` 验证：
  - 复用同一脚本逻辑，用会话 `limits.memory_mb=256` 再跑 10 轮
  - 结果：`{"memory_mb": 256, "rounds": 10, "passed": 10, "failed": 0}`
- 结论：
  - 在当前开发环境里，DAP 路径在 `128MB` 与 `256MB` 下都通过了 10 轮 step/watch soak，没有观察到 OOM。
  - 但 `docker-compose.yml` 中 `pythonlab-sandbox` 的 `80M` 限制仍与当前开发环境结论冲突，因此这份结论只能说明“当前 dev 基线稳定”，不能直接推导出所有部署口径都稳定。

## Round 1 备注

- 本清单冻结的是“当前真实代码面”，不是用户期望的最终架构。
- 当前最核心的历史包袱是：运行/调试链路、终端链路、流程图链路都存在本地与远端混合分流。
- 进入 Round 2 前，应先完成风险冻结与技术预研，确认哪些能力必须彻底删除旧路径后再重建，哪些仅需路由/状态机替换。
