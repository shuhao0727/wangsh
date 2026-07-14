# PythonLab 调试环境文档

> 状态：active
> Owner：pythonlab
> 最近复核：2026-07-13

## 概述

PythonLab 是基于 Docker 沙箱的 Python 代码调试环境，支持断点调试、变量查看、代码执行等功能。

## 历史事故记录

- 2026-04-08 调试 Continue 卡死事故（归档文档已删除，要点见下方"Continue 点击后疑似卡死"章节）

## 能力边界

| 能力 | 用户入口 | 协议/实现 | 当前合同 |
|---|---|---|---|
| Python 编辑 | 右侧编辑器 | Monaco + 文本回退 | Monaco 失败时仍可编辑 |
| 代码与流程图同步 | 编辑器、流程图 | `/flow/parse`、`/cfg/parse` | 失败必须显示明确错误 |
| 语法检查 | 编辑器输入 | `/syntax/check` | debounce 后标记问题 |
| 普通运行 | `Run` | 远端 session 或本地 Pyodide | stdout 和 `input()` 可用 |
| 断点调试 | gutter + `Debug` | session HTTP + DAP WebSocket | 至少一个断点，source mismatch 可恢复 |
| 调试控制 | Pause/Continue/Step/Reset | DAP request | 可用性由 runner 状态驱动 |
| 变量与 Watch | 调试器 Tab | DAP scopes/variables/evaluate | 暂停时刷新 |
| 会话生命周期 | 启动、恢复、停止、清理 | `/sessions*` | owner 权限和刷新恢复保持 |
| DAP 重连 | 页面重连 | `last_seq` + buffered replay | 窗口内顺序重放和暂停态恢复 |
| 终端 | 终端交互 Tab | terminal WS / Pyodide bridge | 按 active runner 切换 |
| 代码生成与优化 | 流程图、优化弹窗 | `/flow/generate_code`、`/optimize/*` | apply/rollback 合同保持 |
| Prompt/Agent 配置 | Admin 配置 | `/flow/prompt_template` 等 | Admin 依赖不能因重构丢失 |

公开 API 统一使用 `/api/v2/pythonlab/*`；历史 `/api/v1/debug/*` 兼容入口已删除。

删除、拆分或迁移实现前必须确认：

1. 公开 API 和 owner 鉴权保持不变。
2. Run 同时覆盖 Pyodide、远端 stdout 和 `input()`。
3. Debug 覆盖暂停、连续 Continue、Step、变量、Watch、停止和重连。
4. 流程图映射可重建，source mismatch 不产生错误高亮。
5. Admin Prompt/Agent 配置没有被静默打断。
6. sandbox 资源、namespace、workspace 和失败清理保持隔离。

---

## 架构设计

### 组件架构

```
前端 (React)
    ↓ WebSocket
后端 (FastAPI)
    ↓ Docker API
沙箱容器 (pythonlab-sandbox)
    ↓ debugpy
Python 进程
```

### 数据模型

**核心表**：
- `znt_debug_sessions` - 调试会话
- `znt_debug_optimization_logs` - 优化日志

**会话字段**：
- `session_id` - 会话 ID
- `user_id` - 用户 ID
- `container_id` - 容器 ID
- `status` - 状态（running、stopped、error）
- `created_at` - 创建时间
- `last_heartbeat` - 最后心跳时间

---

## 沙箱容器

### 容器配置

**镜像**：
- 生产 Compose：`shuhao07/pythonlab-sandbox:${IMAGE_TAG}`，当前默认 `1.6.0`
- 本地开发：`pythonlab-sandbox:py311-arm64`，可由 `PYTHONLAB_SANDBOX_IMAGE` 覆盖

**镜像构建**：
```bash
# 生产镜像统一通过受维护的六镜像构建入口
IMAGE_TAG=1.6.0 bash scripts/deploy.sh build

# 开发入口会在本地 sandbox 镜像缺失时按当前架构自动构建
bash start-dev.sh
```

**资源限制**：
- CPU：50000 微秒/100ms（50%）
- 内存：128MB（当前部署基线，可配置）
- 磁盘：512MB（工作目录配额）

**网络**：
- 隔离网络
- 仅允许访问后端 API

> 注意：`docker-compose.yml` 中的 `pythonlab-sandbox` 服务只是镜像构建/预拉取占位容器；真实调试会话的 CPU / 内存限制由 backend 创建 sandbox 时按 `PYTHONLAB_DEFAULT_MEMORY_MB` 和请求 limits 动态下发。

### 内存配置修复（2026-03-22）

**问题**：sandbox 容器内存不足导致 debugpy OOM

**修复**：
- 历史止血阶段曾将默认内存从 32MB 提升到 80MB
- 当前部署基线已统一到 128MB
- `docker.py` 添加 `max(limits_mb, default_mem)` 保底逻辑
- 环境变量：`PYTHONLAB_DEFAULT_MEMORY_MB=128`

---

## debugpy 集成

### DAP 协议

使用 Debug Adapter Protocol (DAP) 进行调试通信：
- `initialize` - 初始化
- `launch` - 启动调试
- `setBreakpoints` - 设置断点
- `continue` - 继续执行
- `next` - 单步执行
- `stepIn` - 步入
- `stepOut` - 步出
- `variables` - 查看变量

### debugpy 配置

```python
import debugpy
debugpy.listen(("0.0.0.0", 5678))
debugpy.wait_for_client()
```

---

## WebSocket 通信

### 端点

- 主入口：`/api/v2/pythonlab/sessions/{session_id}/ws` - 调试 WebSocket（DAP）
- 主入口：`/api/v2/pythonlab/sessions/{session_id}/terminal` - 终端 WebSocket
- 历史 `/api/v1/debug/*` 兼容入口已下线

### 消息格式

**DAP 消息**：
```json
{
  "seq": 1,
  "type": "request",
  "command": "setBreakpoints",
  "arguments": {
    "source": {"path": "/workspace/main.py"},
    "breakpoints": [{"line": 10}]
  }
}
```

**终端消息**：
```json
{
  "type": "input",
  "data": "print('hello')\n"
}
```

---

## 会话管理

### 会话生命周期

1. **创建**：`POST /api/v2/pythonlab/sessions`
2. **运行**：WebSocket 连接，执行代码
3. **心跳**：定期发送心跳保持活跃
4. **清理**：超时或手动停止

### 超时配置

- `PYTHONLAB_SESSION_TTL_SECONDS=3600` - 会话总超时
- `PYTHONLAB_UNATTACHED_TTL_SECONDS=600` - 未连接超时
- `PYTHONLAB_IDLE_TIMEOUT_SECONDS=3600` - 空闲超时
- `PYTHONLAB_HEARTBEAT_TIMEOUT_SECONDS=180` - 心跳超时

### 自动清理

**孤儿容器清理**：
- 定期扫描无对应会话的容器
- 自动停止并删除
- 配置：`PYTHONLAB_ORPHAN_CLEANUP_ENABLED=true`

---

## 并发控制

### Owner 互斥策略

防止同一个调试会话被多个浏览器窗口同时控制：

**运行时配置**：`PYTHONLAB_DEBUG_WS_OWNER_MODE`
- `steal` - 新连接接管旧连接
- `deny` - 会话已有 owner 时拒绝新连接

其他值会按 `deny` 处理；当前配置默认值为 `steal`。

### 并发测试

**测试脚本**：`backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`

`OWNER_MODE` 只控制 smoke 的断言方式，不会修改后端运行配置：
- `auto` - 自动识别当前是 `deny` 还是 `steal`
- `deny` / `steal` - 严格断言指定行为
- `matrix` - 先自动识别，再创建新会话重复验证同一行为

**运行方式**：
```bash
OWNER_MODE=matrix python backend/scripts/smoke_pythonlab_ws_owner_concurrency.py
```

---

## Phase C 可见性测试

### 测试目标

验证断点调试时变量的可见性：
- 断点命中
- 变量值正确
- 事件顺序正确

### 测试脚本

`backend/scripts/smoke_pythonlab_print_visibility_probe.py`

**运行方式**：
```bash
TIMEOUT_SECONDS=20 python backend/scripts/smoke_pythonlab_print_visibility_probe.py
```

### 故障排查

**debugpy readiness timeout**：
1. 检查 sandbox 容器日志：`docker logs pythonlab_u33`
2. 检查镜像架构兼容性
3. 查看 debugpy 诊断日志：`/tmp/debugpy/*.log`

---

## pythonlab-worker

### Worker 配置

**服务**：`wangsh-pythonlab-worker`

**队列**：`celery`

**并发数**：3（可配置）

**任务**：
- 会话清理
- 容器管理
- 孤儿容器清理

### Kill 脚本修复

**问题**：kill 脚本误杀容器 init 进程

**修复**：
- 排除 PID 1
- 排除非 python 进程
- 只杀死用户代码进程

---

## API 端点

详见 [API.md](../development/API.md) 第十二章节：调试工具 / PythonLab（主入口：`/api/v2/pythonlab`）

### 核心端点

- `POST /api/v2/pythonlab/sessions` - 创建调试会话（已登录用户）
- `GET /api/v2/pythonlab/sessions/{session_id}` - 获取会话详情（仅会话所有者）
- `POST /api/v2/pythonlab/sessions/{session_id}/stop` - 停止会话（仅会话所有者）
- `WS /api/v2/pythonlab/sessions/{session_id}/ws` - 调试 WebSocket（仅会话所有者）
- `WS /api/v2/pythonlab/sessions/{session_id}/terminal` - 终端 WebSocket（仅会话所有者）
- `POST /api/v2/pythonlab/flow/parse` - 代码解析流程图（已登录用户）
- `POST /api/v2/pythonlab/flow/generate_code` - 流程图生成代码（已登录用户）
- `POST /api/v2/pythonlab/ai/chat` - AI 助手对话（已登录用户）
- `POST /api/v2/pythonlab/optimize/code` - AI 优化代码（已登录用户）
- `GET /api/v2/pythonlab/flow/prompt_template` - 获取全局提示模板（管理员）
- `POST /api/v2/pythonlab/flow/prompt_template` - 保存全局提示模板（管理员）

---

## 前端实现

### 核心组件

**位置**：`/Users/wsh/wangsh/frontend/src/pages/Admin/ITTechnology/pythonLab/`

**主要文件**：
- `index.tsx` - 主页面
- `CanvasToolbar.tsx` - 工具栏
- `TemplatePalette.tsx` - 模板面板
- `RightPanelView.tsx` - 右侧面板
- `FloatingPopup.tsx` - 浮动弹窗
- `OptimizationDialog.tsx` - 优化对话框

### addNode 坐标修复

**问题**：拖拽添加节点位置不准确

**修复**：转换为画布坐标系
```typescript
const canvasX = (clientX - rect.left) / scale - panX;
const canvasY = (clientY - rect.top) / scale - panY;
```

### 调试控制区交互约束

PythonLab 右侧调试控制按钮是高频连续点击控件，点击可靠性优先于 tooltip 丰富度。

- `Run`、`Debug`、`Pause`、`Continue`、`Step Over`、`Step Into`、`Step Out`、`Reset` 默认只使用原生 `title` 和 `aria-label`。
- 不要给调试控制按钮套用 Radix Tooltip 或同类依赖 portal、hover 状态机、pointer outside、focus restore 的复杂弹层组件。
- 如果确需引入 tooltip、popover、dialog 或 hover 提示，必须覆盖真实 pointer click 链路，不能只验证 JS `button.click()`。
- 鼠标悬停在控制按钮上时连续点击，是调试控制区必须覆盖的交互场景。

---

## CI/CD 测试

### GitHub Actions

**并发测试**：`.github/workflows/pythonlab-owner-concurrency.yml`
- 定时：UTC 02:30
- 手动触发
- 使用已部署的专项测试环境和 `PYTHONLAB_SMOKE_*` secrets

**Phase C 测试**：`.github/workflows/pythonlab-phasec-gate.yml`
- 定时：UTC 03:10
- 手动触发
- 使用已部署的专项测试环境和 `PYTHONLAB_SMOKE_*` secrets

**当前 PR 全核运行时**：`.github/workflows/pythonlab-pr-runtime.yml`
- 由 `.github/workflows/pr-pythonlab-owner-gate.yml` 和
  `.github/workflows/pr-pythonlab-phasec-gate.yml` 调用
- 在 GitHub runner 启动当前 PR 的 PostgreSQL、Redis、backend、Celery、
  PythonLab sandbox 和 Vite，不使用远端环境代替当前源码
- 使用 runner 内临时账号，不依赖 fork PR 无法读取的仓库 secrets
- 安装 Playwright Chromium，以真实 pointer click 执行基础调试和多断点
  `Continue` 到结束，再执行 owner matrix 或 Phase C probe/soak
- 实时浏览器/后端 smoke 均通过 `redact_exec.py`，失败时只输出 backend、worker、
  frontend 日志的最后 200 行；实时与落盘内容统一脱敏 query/userinfo、
  Bearer/Basic、JSON/字典、Cookie、password、api_key 和已知环境敏感值
- Phase C 每轮日志在写入 `/tmp/phasec_soak` 前先脱敏；随后始终清理进程、
  沙箱容器和工作目录

> 当前 PR workflow 已通过 YAML、合同测试和本地等价运行时验证；在真实 GitHub
> Actions PR runner 首次成功执行前，不能将其视为已经完成远端门禁验收。

### 退出码约定

- `0` - 成功
- `2` - 参数错误
- `3` - 网络错误
- `4` - 行为探测失败
- `5` - 断言失败
- `10` - 未知异常

### 调试控制区真实浏览器验证

只跑 Playwright 默认 Chromium smoke 不足以证明调试控制区交互可靠。只要改动调试控制按钮、tooltip、hover、pointer、focus、Radix 弹层类组件或调试状态切换 UI，应补跑：

- 真实 Google Chrome channel：多断点连续 `Continue` 到程序结束。
- WebKit：多断点连续 `Continue` 到程序结束。
- 鼠标悬停在 `Continue` 等控制按钮上时，用真实 pointer click 连续点击。
- 回归路径至少覆盖：`Debug -> Pause -> Continue -> Finish`、`Debug -> Continue -> Continue -> Continue -> Finish`、`Debug -> Continue -> Pause -> Continue -> Finish`。

---

## 故障排查

### 调试超时

1. 检查 pythonlab-worker 服务是否运行
2. 检查容器内存是否足够（部署基线 128MB）
3. 检查 debugpy 端口是否可访问
4. 查看容器日志

### WebSocket 连接失败

1. 检查会话是否存在
2. 检查会话状态是否为 running
3. 检查网络连接
4. 查看后端日志

### 容器启动失败

1. 检查 Docker 守护进程是否运行
2. 检查镜像是否存在
3. 检查资源限制是否合理
4. 查看 Docker 日志

### Continue 点击后疑似卡死

断点暂停后点击 `Continue` 卡住时，先确认后端是否收到 DAP `continue` 请求。

- 如果后端未收到，不要优先怀疑 debugpy 或 DAP 后端死循环，应先排查前端真实点击链路。
- 优先检查 tooltip、popover、dialog、pointer capture、focus restore、outside click 管理和 hover 状态机。
- 区分真实 pointer click 与 JS `button.click()`：后者能成功不代表真实用户点击链路可靠。
- 相关历史事故见上方"历史事故记录"章节（原归档文档已删除）。

---

## 相关文件

### 后端

- `/Users/wsh/wangsh/backend/app/api/pythonlab/` - API 路由
- `/Users/wsh/wangsh/backend/app/core/sandbox/docker.py` - Docker 沙箱兼容 facade
- `/Users/wsh/wangsh/backend/app/core/sandbox/docker_runtime.py` - Docker runtime 操作
- `/Users/wsh/wangsh/backend/app/tasks/pythonlab.py` - Celery 任务

### 前端

- `/Users/wsh/wangsh/frontend/src/pages/Admin/ITTechnology/pythonLab/` - 页面组件

### 测试脚本

- `/Users/wsh/wangsh/backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`
- `/Users/wsh/wangsh/backend/scripts/smoke_pythonlab_print_visibility_probe.py`
- `/Users/wsh/wangsh/backend/scripts/soak_pythonlab_phasec.py`

---

## 最佳实践

1. **资源限制**：合理设置内存和 CPU 限制
2. **会话清理**：及时清理过期会话
3. **错误处理**：捕获并记录所有异常
4. **并发控制**：使用 owner 互斥策略
5. **定期测试**：运行 CI/CD 测试确保稳定性
