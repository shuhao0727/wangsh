# PythonLab 调试环境文档

> 状态：active
> Owner：pythonlab
> 最近复核：2026-09-10

## 沙箱启动恢复与资源归属边界（2026-09-09）

- 复用容器前检查 inspect 配置、模式、资源限制、镜像、用户与工作区；plain 必须 network none。不兼容则拒绝，不拆除正在运行的 debug 容器。同一 session 重投不写工作区；跨 plain session 仅在缓存明确前者 TERMINATED 后允许复用。
- 创建、复用、停止及终止使用同一 workspace 持久文件锁；可信 journal 位于工作区根外的 `.pythonlab-ownership/`，不进入学生挂载。每次 claim 使用新的 generation token，记录精确容器 ID；旧 stop/补偿必须同时匹配 session、token 与 ID，不能删除已被新 generation 接管的同一容器。不得删除 lock inode。
- 互斥依赖**全部 writer 使用同一协议和同一支持 flock 的共享文件系统**；相同路径但不同 inode、旧版本或外部 Docker 操作不受保证。Redis lease 没有续租，不能把它单独视为持续互斥。部署及回滚前提见 [DEPLOY](../docker/deploy/DEPLOY.md)。
- provider 成功后 marker 缺失、已终止或被其他任务接管，结果发布返回 false 时按 generation 条件补偿；补偿不确定不会伪装成功。CLI 超时/取消 kill 并回收子进程；创建失败只按本次返回/cidfile ID 清理，不按名称猜删。
- STARTING 认领和启动结果发布使用 Redis 原值比较的 Lua CAS；已提交的 TERMINATED 或其他任务认领不会被本启动 writer 覆盖。JSON 在 Python 合并，保留大整数、空对象及未知字段；按原规则续 session TTL。此保证不约束其他旧/API writer 在 CAS 之后盲写。
- READY 写入抛异常或 CAS 拒绝后先核对 task、generation token 和 exact container ID。同世代 READY/ATTACHED/RUNNING/STOPPED 已发布则保留；确认仍属本启动且未发布时，先 CAS 成 FAILED 再按 generation 补偿。补偿完成后任务明确失败，不盲目重建。Redis 无法核对、持续竞争或补偿失败时保留可信 journal 并报错，不能承诺任意故障均零资源残留。
- 已存在容器的复用和退役均要求可信 live journal 且 exact ID 一致；缺失或 removed journal 不再依据学生可写 meta 接管同名容器。拒绝发生在工作区改写、认领或删除前。旧无 token/未知归属容器保守保留，需受控盘点迁移，不能自动接管或按名称批量清除。
- **OPS-01 未关闭**：debug 网络与 DAP 暴露策略未改变。已有真实 worker 崩溃与 Redis/Docker 恢复证据，不能重新归类为从未执行，也不能扩展为压力、任意断网恢复、混版本和发布网络策略均通过；浏览器调试与资源回收按对应源码/镜像批次单独绑定。不要在正常栈试改网络或清理未知资源。
- 原严格预期失败的归属调度反例已改为安全断言通过；仍存限制另有独立反例。测试结果与证据统一见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)，不得以测试零退出码关闭整个沙箱模块。

## 调试终端切页与输出归属

- 后端终端在切换到调试器/参考页时保持挂载与 TTY 连接，避免 Docker attach 的实时输出因组件卸载丢失，尤其是到达 `input()` 后才打开终端的提示。非活动页保留可测量尺寸，但使用 `visibility`、`inert` 与 `aria-hidden` 隔离显示、焦点和辅助技术；后台 WS 建连不得抢走调试器焦点。本地 Pyodide 终端沿用原有按页挂载生命周期。
- Python 调试 attach 关闭 `redirectOutput`，程序 stdout/stderr 由 TTY 单路显示，避免 DAP 与 TTY 双路写入导致重复行或提示被插入其他输出；DAP 的协议诊断输出仍按既有通道保留。终端生命周期结束时仍须释放 WS 与 Xterm，不能为了保留输出而跨 session 保留旧连接。
- Run/Debug/Pause/Continue/Step/Reset 控制按钮继续使用原生 `title` 与 `aria-label`，不引入复杂 tooltip。验收必须包含真实 Chrome channel 与 WebKit 的 hover 后 pointer 点击、多断点连续 Continue、Step/Watch、晚切终端输入及 Reset 后 exact 资源核对，不能以 JS click、默认 Chromium 或单元测试替代。
- 这不是历史日志回放机制：页面刷新/关闭或真实 TTY 中断期间的输出保全、连续重试耗尽、跨主机和混版本恢复仍须单独验证。专项采用冻结输入时必须同时记录源码与运行镜像；AUTH schema/ready gate/enrollment 变更后的集成验收须另行停流、迁移和重测，不能沿用 AUTH 前冻结后端的通过结论。

## DAP 断连清理的状态保护

断连时先读取元信息原始字节，再执行 detach；随后用同一 Redis Lua 脚本检查连接租约、只释放本连接的租约，并对元信息作原值 CAS。detach 等待期间若其他请求写入 TERMINATED、更新 revision/owner 或换入新租约，旧清理不得覆盖新值；仅允许更新仍属于本 conn_id 的活动状态。元信息缺失/过期不复活，不延长其 TTL；Redis 原子能力缺失或错误时不退回盲写。detach 失败时跳过元信息更新，无法释放的租约留待 TTL。

这是 DAP 清理 writer 的保护，不是所有 PythonLab writer 的统一事务；后续旧 writer、混版本、transport 已在途数据及无法协作取消的清理仍需单独验收。Redis 命令与部署前提见 [DEPLOY](../docker/deploy/DEPLOY.md)，实例及反例证据见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

## WebSocket 建连认证边界（2026-09-09）

- terminal 与 DAP 在连接接入时，先校验 JWT、唯一有效用户及当前会话 nonce；按现有配置执行 IP 一致性检查，然后才读取业务 session 元信息、派发 terminal 任务或创建 DAP bridge。
- token 缺失/无效、nonce 撤销或缺失、用户停用/删除、校验依赖异常关闭 `4401`；认证有效但业务 session 不存在仍为 `4404`，owner 不符仍为 `4403`。沿用当前先 accept 后 close 的协议，不改成 HTTP 拒绝握手。
- token 来源及优先级沿用现有提取器，不新增 Cookie 回退。IP 校验复用现有代理信任配置，不代表真实代理已可信。
- 已接入连接固定入场 token 与用户，逐条输入/输出及 attach 边界检查 JWT/nonce/IP；空闲每秒复查，单次认证等待最多两秒。失效关闭 `4401` 并取消、等待 watcher/handler/receive/pump；POSIX PTY 采用可取消读，避免遗留线程读取。
- 撤销检查和 transport IO 不构成原子事务；已在途数据或已送出的 Continue 不能撤回，时间界限依赖事件循环和依赖可协作取消。DB 用户有效性只在接入时检查，后续不周期刷新角色、停用状态或班级。真实 Chrome/WebKit/DAP/TTY 与网关验收仍开放，不据此关闭 AUTH-02 迁移。管理与课堂 SSE 另见 [AUTH](AUTH.md#管理与课堂-sse-会话持续校验)。

## 会话停止与共享容器回收收口（2026-09-11）

- 前端「重置/停止 (Reset)」此前只重置前端状态，不通知后端：会话停在 `STOPPED` 后仍留在
  `debug:user:{owner}:sessions`，共享容器因此被保留到 `PYTHONLAB_IDLE_TIMEOUT_SECONDS`（默认 3600s），
  同一用户在这一小时内再次「调试」会被模式检查拒绝（`运行环境模式不兼容，请先停止旧会话`），
  而提示所要求的「停止旧会话」在 UI 上无法执行。现在 Reset 显式调用
  `POST /api/v2/pythonlab/sessions/{session_id}/stop`，「调试」启动前也会先停掉旧会话。
- `cleanup_stale_sessions` 的 `STOPPED` 分支改用 `PYTHONLAB_UNATTACHED_TTL_SECONDS`（默认 600s），
  使「关闭页面后不再回来」的会话在合理时间内由 `stop_session(force=True)` 以真实 session 身份回收；
  `ATTACHED` 仍沿用 `PYTHONLAB_IDLE_TIMEOUT_SECONDS`。
- `cleanup_orphans` 保持保守语义不变：它只有 owner 级探测能力，缺少 ownership 记录时拒绝删除，
  因此**不能**用它来回收容器，也不能把调度成功当作资源已回收。详见会话管理一节的自动清理。
- 实例验证边界：以上结论由本地生产模拟栈（真实浏览器 + 真实 PG/Redis + 真实沙箱容器）验证；
  多 worker、真实 broker、跨版本混部与生产网关仍未覆盖，仍需按 [TEST_STATUS](../docker/testing/TEST_STATUS.md) 的分层证据推进。

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

**会话回收（有权删除的路径）**：

`cleanup_stale_sessions` 按状态区分回收窗口：

- `PENDING` / `READY`：`PYTHONLAB_UNATTACHED_TTL_SECONDS`（默认 600s）
- `STOPPED`：同样使用未连接窗口。已停止的会话不再附着，不得以 `PYTHONLAB_IDLE_TIMEOUT_SECONDS`（默认 3600s）
  占住按 owner 复用的共享容器，否则同一用户再次「调试」会被模式检查拒绝
  （`运行环境模式不兼容，请先停止旧会话`）。
- `ATTACHED`：`PYTHONLAB_IDLE_TIMEOUT_SECONDS`（默认 3600s）
- `RUNNING`：`PYTHONLAB_HEARTBEAT_TIMEOUT_SECONDS`（默认 180s）

命中后投递 `stop_session(force=True)`，以**真实 session 身份**通过 ownership fence 校验，删除容器并清理
`debug:user:{owner_user_id}:sessions`。

**孤儿探测（不是删除授权）**：

- `cleanup_orphans` 按 `PYTHONLAB_ORPHAN_CLEANUP_ENABLED` 定期扫描容器名（`{namespace}_u{user_id}`）并按
  `debug:user:{owner}:sessions` 判断 owner 是否仍有会话。
- 它只做 owner 级探测：`terminate_session("orphan", ...)` 因缺少匹配的 ownership 记录会被保守拒绝
  （日志 `Preserving sandbox without current ownership`），因此**调度任务成功不等于资源已回收**。该合同由
  `backend/tests/pythonlab/test_sandbox_ownership_closure.py` 固定，不要把它改成按名字直删。

**停止入口**：前端「重置/停止 (Reset)」显式调用
`POST /api/v2/pythonlab/sessions/{session_id}/stop`；「调试」启动前也会先停掉旧会话。二者都不能只改前端本地状态，
否则后端会话与共享容器会残留。

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

### Docker 暂时通信错误与启动恢复

只读 container/image inspect 对受控的 Docker CLI 连接失败分类为 `DockerTransportError`，
启动恢复继续保持 `STARTING` 并进入既有有限重试；权限、鉴权、TLS、非法资源和未知输出
不按暂时通信错误放行。create、remove、cleanup 不因此放宽，资源接管仍校验可信归属。
HTTP provider 仅对选定的 `NetworkError` / `TimeoutException` 类型进入暂时错误分支，
不是对所有 `RuntimeError` 或 `TransportError` 重试。

`max_retries` 约束单条 retry lineage，并非同 task ID 在 broker 重复投递下的全局计数。
真实 worker 的 SIGKILL、重投、原锁自然到期、容器复用与 stop 回收证据，和未验证的
连续重试耗尽、HTTP 包装根因、Chrome/WebKit、DAP/TTY 边界统一见
[TEST_STATUS](../docker/testing/TEST_STATUS.md)。混用旧 worker 会保留旧失败行为；部署须
保证相关 worker 与 backend 一致升级，不自动修复既有 `FAILED` 记录。

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

**位置**：`frontend/src/pages/Admin/ITTechnology/pythonLab/`

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

- `backend/app/api/pythonlab/` - API 路由
- `backend/app/core/sandbox/docker.py` - Docker 沙箱兼容 facade
- `backend/app/core/sandbox/docker_runtime.py` - Docker runtime 操作
- `backend/app/tasks/pythonlab.py` - Celery 任务

### 前端

- `frontend/src/pages/Admin/ITTechnology/pythonLab/` - 页面组件

### 测试脚本

- `backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`
- `backend/scripts/smoke_pythonlab_print_visibility_probe.py`
- `backend/scripts/soak_pythonlab_phasec.py`

---

## 最佳实践

1. **资源限制**：合理设置内存和 CPU 限制
2. **会话清理**：及时清理过期会话
3. **错误处理**：捕获并记录所有异常
4. **并发控制**：使用 owner 互斥策略
5. **定期测试**：运行 CI/CD 测试确保稳定性
