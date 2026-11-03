# PythonLab 调试环境文档

> 状态：active
> Owner：pythonlab
> 最近复核：2026-10-31（文档与源码合同核对）

本文维护 PythonLab 的能力、安全边界与验收要求。接口见 [API](../development/API.md)，
配置与发布步骤见 [DEPLOY](../operations/DEPLOY.md)，各批次实测只以 [TEST_STATUS](../testing/TEST_STATUS.md) 为准。

## 沙箱启动恢复与资源归属边界（2026-09-09）

- 复用容器前检查 inspect 配置、模式、资源限制、镜像、用户与工作区；plain 必须 network none。不兼容则拒绝，不拆除正在运行的 debug 容器。同一 session 重投不写工作区；跨 plain session 仅在缓存明确前者 TERMINATED 后允许复用。
- 创建、复用、停止及终止使用同一 workspace 持久文件锁；可信 journal 位于工作区根外的 `.pythonlab-ownership/`，不进入学生挂载。每次 claim 使用新的 generation token，记录精确容器 ID；旧 stop/补偿必须同时匹配 session、token 与 ID，不能删除已被新 generation 接管的同一容器。不得删除 lock inode。
- 互斥依赖**全部 writer 使用同一协议和同一支持 flock 的共享文件系统**；相同路径但不同 inode、旧版本或外部 Docker 操作不受保证。Redis lease 没有续租，不能把它单独视为持续互斥。部署及回滚前提见 [DEPLOY](../operations/DEPLOY.md)。
- provider 成功后 marker 缺失、已终止或被其他任务接管，结果发布返回 false 时按 generation 条件补偿；补偿不确定不会伪装成功。CLI 超时/取消 kill 并回收子进程；创建失败只按本次返回/cidfile ID 清理，不按名称猜删。
- STARTING 认领和启动结果发布使用 Redis 原值比较的 Lua CAS；已提交的 TERMINATED 或其他任务认领不会被本启动 writer 覆盖。JSON 在 Python 合并，保留大整数、空对象及未知字段；按原规则续 session TTL。此保证不约束其他旧/API writer 在 CAS 之后盲写。
- READY 写入抛异常或 CAS 拒绝后先核对 task、generation token 和 exact container ID。同世代 READY/ATTACHED/RUNNING/STOPPED 已发布则保留；确认仍属本启动且未发布时，先 CAS 成 FAILED 再按 generation 补偿。补偿完成后任务明确失败，不盲目重建。Redis 无法核对、持续竞争或补偿失败时保留可信 journal 并报错，不能承诺任意故障均零资源残留。
- 已存在容器的复用和退役均要求可信 live journal 且 exact ID 一致；缺失或 removed journal 不再依据学生可写 meta 接管同名容器。拒绝发生在工作区改写、认领或删除前。旧无 token/未知归属容器保守保留，需受控盘点迁移，不能自动接管或按名称批量清除。
- **OPS-01 未关闭**：debug 网络与 DAP 暴露策略未改变。已有真实 worker 崩溃与 Redis/Docker 恢复证据，不能重新归类为从未执行，也不能扩展为压力、任意断网恢复、混版本和发布网络策略均通过；浏览器调试与资源回收按对应源码/镜像批次单独绑定。不要在正常栈试改网络或清理未知资源。
- 原严格预期失败的归属调度反例已改为安全断言通过；仍存限制另有独立反例。测试结果与证据统一见 [TEST_STATUS](../testing/TEST_STATUS.md)，不得以测试零退出码关闭整个沙箱模块。

## 调试终端切页与输出归属

- 后端终端在切换到调试器/参考页时保持挂载与 TTY 连接，避免 Docker attach 的实时输出因组件卸载丢失，尤其是到达 `input()` 后才打开终端的提示。非活动页保留可测量尺寸，但使用 `visibility`、`inert` 与 `aria-hidden` 隔离显示、焦点和辅助技术；后台 WS 建连不得抢走调试器焦点。本地 Pyodide 终端沿用原有按页挂载生命周期。
- Python 调试 attach 关闭 `redirectOutput`，程序 stdout/stderr 由 TTY 单路显示，避免 DAP 与 TTY 双路写入导致重复行或提示被插入其他输出；DAP 的协议诊断输出仍按既有通道保留。终端生命周期结束时仍须释放 WS 与 Xterm，不能为了保留输出而跨 session 保留旧连接。
- 控制按钮与浏览器验收统一遵循下文“调试控制区交互约束”和“调试控制区真实浏览器验证”。
- 这不是历史日志回放机制：页面刷新/关闭或真实 TTY 中断期间的输出保全、连续重试耗尽、跨主机和混版本恢复仍须单独验证。专项采用冻结输入时必须同时记录源码与运行镜像；AUTH schema/ready gate/enrollment 变更后的集成验收须另行停流、迁移和重测，不能沿用 AUTH 前冻结后端的通过结论。

## DAP 断连清理的状态保护

断连时先读取元信息原始字节，再执行 detach；随后用同一 Redis Lua 脚本检查连接租约、只释放本连接的租约，并对元信息作原值 CAS。detach 等待期间若其他请求写入 TERMINATED、更新 revision/owner 或换入新租约，旧清理不得覆盖新值；仅允许更新仍属于本 conn_id 的活动状态。元信息缺失/过期不复活，不延长其 TTL；Redis 原子能力缺失或错误时不退回盲写。detach 失败时跳过元信息更新，无法释放的租约留待 TTL。

这是 DAP 清理 writer 的保护，不是所有 PythonLab writer 的统一事务；后续旧 writer、混版本、transport 已在途数据及无法协作取消的清理仍需单独验收。Redis 命令与部署前提见 [DEPLOY](../operations/DEPLOY.md)，实例及反例证据见 [TEST_STATUS](../testing/TEST_STATUS.md)。

## WebSocket 建连认证边界（2026-09-09）

- terminal 与 DAP 在连接接入时，先校验 JWT、唯一有效用户及当前会话 nonce；按现有配置执行 IP 一致性检查，然后才读取业务 session 元信息、派发 terminal 任务或创建 DAP bridge。
- token 缺失/无效、nonce 撤销或缺失、用户停用/删除、校验依赖异常关闭 `4401`；认证有效但业务 session 不存在仍为 `4404`，owner 不符仍为 `4403`。沿用当前先 accept 后 close 的协议，不改成 HTTP 拒绝握手。
- token 来源及优先级沿用现有提取器，不新增 Cookie 回退。IP 校验复用现有代理信任配置，不代表真实代理已可信。
- 已接入连接固定入场 token 与用户，逐条输入/输出及 attach 边界检查 JWT/nonce/IP；空闲每秒复查，单次认证等待最多两秒。失效关闭 `4401` 并取消、等待 watcher/handler/receive/pump；POSIX PTY 采用可取消读，避免遗留线程读取。
- 撤销检查和 transport IO 不构成原子事务；已在途数据或已送出的 Continue 不能撤回，时间界限依赖事件循环和依赖可协作取消。DB 用户有效性只在接入时检查，后续不周期刷新角色、停用状态或班级。真实 Chrome/WebKit/DAP/TTY 与网关验收仍开放，不据此关闭 AUTH-02 迁移。管理与课堂 SSE 另见 [AUTH](AUTH.md#管理与课堂-sse-会话持续校验)。

## 会话停止与共享容器回收收口（2026-09-11）

Reset 和新 Debug 前必须停止旧会话；`STOPPED` 按未连接窗口回收，`ATTACHED` 按空闲窗口处理。
实际删除须通过 session 归属校验，owner 级孤儿探测不授予删除权限，详见下文“自动清理”。
历史本地生产模拟栈验证不覆盖多 worker、真实 broker、跨版本混部或生产网关。

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

**持久化位置**：
- 调试会话元信息保存在 Redis `debug:session:{session_id}`，不落 PostgreSQL 表；定义见 `backend/app/api/pythonlab/`。
- 代码优化记录表为 `znt_optimize_logs`，模型见 `backend/app/models/agents/optimization.py`。

**会话元信息字段**（`backend/app/api/pythonlab/sessions.py`）：
- `session_id` - 会话 ID
- `owner_user_id` - 所有者用户 ID
- `status` - 状态（`PENDING`/`READY`/`ATTACHED`/`RUNNING`/`STOPPED`/`TERMINATING`/`TERMINATED`/`FAILED`/`STARTING`，见 `backend/app/api/pythonlab/constants.py`）
- `created_at`、`last_heartbeat_at` - 创建与最后心跳时间
- `docker_container_id` - 容器 ID
- `dap_host`、`dap_port` - DAP 连接信息

---

## 沙箱容器

### 工作区路径与本地开发

`PYTHONLAB_WORKSPACE_ROOT` 是 backend/worker 写入代码的目录；Docker 沙箱实际挂载源
必须是 Docker 守护进程可访问、且含同一份代码的宿主目录。`HOST_WORKSPACE_ROOT`
是显式宿主路径映射，不能保留 `/absolute/path/to/...` 示例值。容器部署与本机运行的路径
关系不同，解析顺序和当前本机覆盖见 [部署指南](../operations/DEPLOY.md#redis-与-pythonlab-隔离)。

本机开发遵循 [唯一启动入口](../../CLAUDE.md#70-运行环境唯一入口)，修改本地覆盖后须让
backend/worker 重新加载，并核对实际挂载。普通 Pyodide 运行不依赖该 Docker 挂载，
输出成功不能代替远端调试验收；出现 `Mounts denied` 时先核对实际宿主路径与 Docker
共享目录，不能仅凭健康检查或镜像架构警告判断根因。

### 容器配置

**镜像**：
- `PYTHONLAB_SANDBOX_IMAGE` 可显式指定镜像；生产默认由 `docker-compose.yml` 的 `IMAGE_TAG` 组合。
- `start-dev.sh` 的本地构建标签与 `docker-compose.dev.yml` 的默认标签不同。启动前核对实际入口、
  配置和镜像；不要把源码默认标签当作运行实例版本。发布版本只在发布记录维护。

**镜像构建**：
```bash
# 在已核对发布版本的环境中使用统一构建入口
IMAGE_TAG="${IMAGE_TAG:?先设置已确认的发布版本}" bash scripts/deploy.sh build

# 开发入口会在本地 sandbox 镜像缺失时按当前架构自动构建
bash start-dev.sh
```

**资源限制**：
- CPU：50000 微秒/100ms（50%）
- 内存：生产 Compose 默认 128MB，可配置；代码默认值见下节。
- 磁盘：`PYTHONLAB_WORKSPACE_DISK_QUOTA_MB` 默认 512MB；Docker provider 在创建前检查工作区大小，不能当作运行期硬配额。

**网络**：
- `plain` 模式使用 `--network none`；`debug` 使用默认 Docker 网络并发布 debugpy 端口。
  配置入口为 `backend/app/core/sandbox/docker.py`，DAP 暴露策略仍受 OPS-01 约束。

> 注意：`docker-compose.yml` 中的 `pythonlab-sandbox` 服务只是镜像构建/预拉取占位容器；真实调试会话的 CPU / 内存限制由 backend 创建 sandbox 时按 `PYTHONLAB_DEFAULT_MEMORY_MB` 和请求 limits 动态下发。

### 内存配置修复（2026-03-22）

历史 OOM 止血曾使用 32MB → 80MB。当前 `PYTHONLAB_DEFAULT_MEMORY_MB` 的代码默认值为 512，
Compose 与 `.env.example` 覆盖为 128；`docker.py` 的 `_resolve_memory_mb_limit` 对请求和默认值
均取 `max(32, 值)`。目标环境以生效配置和容器限制为准，不照抄历史数值。

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

沙箱实际通过命令行启动 debugpy 并等待客户端，而不是在用户代码里调用 Python API
（`backend/app/core/sandbox/docker.py`）：

```bash
python -Xfrozen_modules=off -m debugpy \
  --listen 0.0.0.0:${PYTHONLAB_DEBUGPY_PORT:-5678} --wait-for-client /workspace/main.py
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

| 配置项 | 代码默认（秒） | 生产 Compose 默认（秒） | 用途 |
|---|---:|---:|---|
| `PYTHONLAB_SESSION_TTL_SECONDS` | 1800 | 3600 | 会话缓存 TTL |
| `PYTHONLAB_UNATTACHED_TTL_SECONDS` | 300 | 600 | 未连接回收窗口 |
| `PYTHONLAB_IDLE_TIMEOUT_SECONDS` | 1800 | 3600 | 空闲窗口 |
| `PYTHONLAB_HEARTBEAT_TIMEOUT_SECONDS` | 60 | 180 | 心跳窗口 |

来源为 `backend/app/core/config/_pythonlab.py`、`docker-compose.yml` 和 `.env.example`；
目标环境以生效环境变量为准，TTL 不等于不可续期的最长运行时间。

### 普通运行与个人程序的边界（2026-10-31）

普通 Pyodide 运行和远端会话是两条路径，以上 TTL/回收配置不能证明普通运行有最长执行期限。
本批死循环观察8秒未自动终止，手动重置后重新运行正常；`usePyodideRunner` 的运行消息没有执行期限，自动终止仍为待办 PYLAB-01。
当前 `/personal-programs` 承载校本选课页面，没有学生代码命名保存、重载、删除流程；程序管理按 PROGRAM-01 单独确认范围，不以导航可达计通过。

### 自动清理

**会话回收（有权删除的路径）**：

`cleanup_stale_sessions` 按状态区分回收窗口：

- `PENDING` / `READY` / `STOPPED`：`PYTHONLAB_UNATTACHED_TTL_SECONDS`。
- `ATTACHED`：`PYTHONLAB_IDLE_TIMEOUT_SECONDS`。
- `RUNNING`：`PYTHONLAB_HEARTBEAT_TIMEOUT_SECONDS`。

命中后投递 `stop_session(force=True)`，以**真实 session 身份**通过 ownership fence 校验，删除容器并清理
`debug:user:{owner_user_id}:sessions`。

**孤儿探测（不是删除授权）**：

- `cleanup_orphans` 按 `PYTHONLAB_ORPHAN_CLEANUP_ENABLED` 定期扫描容器名（`{namespace}_u{user_id}`）并按
  `debug:user:{owner}:sessions` 判断 owner 是否仍有会话。该开关同时门控 backend 启动时的
  `start_background_tasks` 轮询（`backend/app/core/startup.py`）；关闭后 Celery beat
  仍按 `pythonlab-cleanup-orphans` 调度（`backend/app/core/celery_app.py`）。
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
1. 从会话元信息和可信归属记录核对容器 ID，再读取该容器日志
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
[TEST_STATUS](../testing/TEST_STATUS.md)。混用旧 worker 会保留旧失败行为；部署须
保证相关 worker 与 backend 一致升级，不自动修复既有 `FAILED` 记录。

## pythonlab-worker

### Worker 配置

**服务**：`wangsh-pythonlab-worker`

**队列**：`celery`

**并发数**：生产 Compose 取 `${PYTHONLAB_WORKER_CONCURRENCY:-3}`。

**任务**（定义见 `backend/app/tasks/pythonlab.py`，调度见 `backend/app/core/celery_app.py`）：
- `app.tasks.pythonlab.cleanup_stale_sessions` - 会话清理（beat 每 120s）
- `app.tasks.pythonlab.cleanup_orphans` - 孤儿容器清理（beat 间隔取 `PYTHONLAB_ORPHAN_CLEANUP_INTERVAL_SECONDS`，默认 300s）
- `app.tasks.pythonlab.start_session`、`app.tasks.pythonlab.stop_session` - 容器创建与停止

### Kill 脚本修复

沙箱中的 debugpy 清理（`backend/app/core/sandbox/docker.py`）必须保持：
- 排除 PID 1 与当前执行脚本自身的进程
- 只匹配 cmdline 以 `python` 开头且包含 `debugpy` 的进程
- 命中后对该进程发 `SIGKILL`；不按名称批量杀其他进程

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

**主要文件**（均在 `frontend/src/pages/Admin/ITTechnology/pythonLab/` 下）：
- `PythonLabStudio.tsx` - Studio 主入口（无 `index.tsx`）
- `components/CanvasToolbar.tsx` - 工具栏
- `components/TemplatePalette.tsx` - 模板面板
- `components/rightPanel/RightPanelView.tsx` - 右侧面板
- `components/FloatingPopup.tsx` - 浮动弹窗
- `components/OptimizationDialog.tsx` - 优化对话框

### 共享实验资源

**位置**：`frontend/src/features/it-technology/python-lab/`

- `types.ts`：实验难度、场景与 `PythonLabExperiment` 合同。
- `storage.ts`：内置实验目录与既有本地存储读写，保留存储键和兼容行为。
- `forTeachingExample.ts`：正式教学实验示例。

公开 PythonLab 入口直接从共享资源读取实验；`PythonLabStudio.tsx`、flow、调试状态机、
worker 与 Monaco 实现仍留在 Admin 的原目录，公开入口目前继续复用该 Studio。
`FlowNodeShape`、`FlowNodeTemplate` 属于画布实现，仍在原 `pythonLab/types.ts`。
此边界只提取稳定资源，不改变 Run、Debug、Continue、Reset 或终端生命周期。

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

**远端巡检（2026-11-01 起改为本地执行）**
- 原 `pythonlab-owner-concurrency.yml` 与 `pythonlab-phasec-gate.yml` 两个远端巡检工作流已删除。
- 需要巡检已部署环境时，在本地用 `backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`、
  `smoke_pythonlab_print_visibility_probe.py`、`soak_pythonlab_phasec.py` 直接对目标 API 执行，
  凭据经环境变量 `PYTHONLAB_SMOKE_USERNAME` / `PYTHONLAB_SMOKE_PASSWORD` 注入。

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

> YAML/合同检查、本地等价运行和真实 Actions runner 是不同层次；验收状态见测试记录。

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
- 同时覆盖 Step/Watch、到达 `input()` 后晚切终端输入，以及 Reset 后按精确容器 ID 和归属记录核对资源。
- 单元测试、JS click 和默认 Chromium 不能代替上述 Chrome/WebKit 验收；运行镜像与源码基线须记录。

---

## 故障排查

### 调试超时

1. 检查 pythonlab-worker 服务是否运行
2. 检查容器内存是否足够（部署基线 128MB）
3. 检查 debugpy 端口是否可访问
4. 查看容器日志

### WebSocket 连接失败

1. 检查会话是否存在
2. 核对返回关闭码、owner、认证状态与当前会话状态，不把所有失败都归因于网络
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

- `frontend/src/pages/Admin/ITTechnology/pythonLab/` - Studio、画布和调试实现
- `frontend/src/features/it-technology/python-lab/` - 共享实验资源、存储与实验类型
- `frontend/src/pages/ITTechnology/PythonLab.tsx` - 公开入口

### 测试脚本

- `backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`
- `backend/scripts/smoke_pythonlab_print_visibility_probe.py`
- `backend/scripts/soak_pythonlab_phasec.py`

---

## 最佳实践

按影响核对资源归属、认证、生命周期和真实浏览器行为；异常日志须脱敏、限长。
未知归属资源保留待核查，单次测试通过不代替恢复、并发或部署验收。
