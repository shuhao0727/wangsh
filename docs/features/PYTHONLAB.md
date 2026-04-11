# PythonLab 调试环境文档

> 最后更新：2026-04-11

## 概述

PythonLab 是基于 Docker 沙箱的 Python 代码调试环境，支持断点调试、变量查看、代码执行等功能。

## 近期事故记录

- [2026-04-08 调试 Continue 卡死事故记录](./PYTHONLAB_DEBUG_CONTINUE_REGRESSION_2026-04-08.md)

### 核心功能

- **沙箱隔离**：每个用户独立的 Docker 容器
- **断点调试**：基于 debugpy 的 DAP 协议
- **WebSocket 通信**：实时双向通信
- **会话管理**：自动清理过期会话
- **并发控制**：防止会话冲突

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

**镜像**：`shuhao07/pythonlab-sandbox:1.5.5`

**镜像构建**：
```bash
docker build --build-arg http_proxy= --build-arg https_proxy= \
  --build-arg HTTP_PROXY= --build-arg HTTPS_PROXY= \
  --build-arg all_proxy= --build-arg ALL_PROXY= \
  -t shuhao07/pythonlab-sandbox:py311 \
  backend/docker/pythonlab-sandbox
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

防止同一用户并发创建多个会话：

**策略类型**：
- `steal` - 新会话抢占旧会话
- `reject` - 拒绝新会话
- `allow` - 允许并发

**配置**：`OWNER_MODE=matrix`（自动探测）

### 并发测试

**测试脚本**：`backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`

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

- `POST /api/v2/pythonlab/sessions` - 创建调试会话
- `GET /api/v2/pythonlab/sessions/{session_id}` - 获取会话详情
- `POST /api/v2/pythonlab/sessions/{session_id}/stop` - 停止会话
- `WS /api/v2/pythonlab/sessions/{session_id}/ws` - 调试 WebSocket
- `WS /api/v2/pythonlab/sessions/{session_id}/terminal` - 终端 WebSocket

---

## 前端实现

### 核心组件

**位置**：`/Users/wsh/wangsh/frontend/src/pages/ITTechnology/PythonLab/`

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

---

## CI/CD 测试

### GitHub Actions

**并发测试**：`.github/workflows/pythonlab-owner-concurrency.yml`
- 定时：UTC 02:30
- 手动触发

**Phase C 测试**：`.github/workflows/pythonlab-phasec-gate.yml`
- 定时：UTC 03:10
- PR 门禁

### 退出码约定

- `0` - 成功
- `2` - 参数错误
- `3` - 网络错误
- `4` - 行为探测失败
- `5` - 断言失败
- `10` - 未知异常

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

---

## 相关文件

### 后端

- `/Users/wsh/wangsh/backend/app/api/pythonlab/` - API 路由
- `/Users/wsh/wangsh/backend/app/api/endpoints/debug/` - deprecated 兼容别名
- `/Users/wsh/wangsh/backend/app/core/sandbox/docker.py` - Docker 沙箱服务
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
