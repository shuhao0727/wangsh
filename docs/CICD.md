# CI/CD 工作流说明

> 最后更新：2026-03-18

## 一、概览

WangSh 项目使用 GitHub Actions 进行持续集成，使用 Docker Compose + 自定义脚本进行部署。

```
开发者 → git push → GitHub Actions（构建镜像 / 自动化测试）
                                ↓
                    DockerHub（镜像仓库）
                                ↓
              服务器 → scripts/deploy.sh deploy（拉取镜像并部署）
```

---

## 二、GitHub Actions 工作流

### 2.1 dockerhub-amd64.yml — 镜像构建与推送

- **触发方式**：手动触发（workflow_dispatch）
- **输入参数**：
  - `image_tag`（必填）：镜像版本号，如 `1.3.0`
  - `push_latest`（可选）：是否同时推送 `latest` 标签，默认 `true`
- **构建平台**：`linux/amd64`
- **构建的镜像**（共 5 个）：

| 镜像名 | Dockerfile | 构建目标 |
|--------|-----------|---------|
| `shuhao07/wangsh-backend` | `backend/Dockerfile.prod` | `backend_runtime` |
| `shuhao07/wangsh-typst-worker` | `backend/Dockerfile.prod` | `worker_runtime` |
| `shuhao07/wangsh-pythonlab-worker` | `backend/Dockerfile.prod` | `pythonlab_worker_runtime` |
| `shuhao07/wangsh-frontend` | `frontend/Dockerfile.prod` | `production` |
| `shuhao07/wangsh-gateway` | `gateway/Dockerfile` | — |

- **所需 Secrets**：`DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`

### 2.2 pythonlab-owner-concurrency.yml — PythonLab 并发测试

- **触发方式**：
  - 定时：每日 UTC 02:30（北京时间 10:30）
  - 手动触发（workflow_dispatch）
  - 被其他工作流调用（workflow_call）
- **功能**：测试 PythonLab 的 owner 并发行为（auto/deny/steal 模式）
- **测试脚本**：`backend/scripts/smoke_pythonlab_ws_owner_concurrency.py`
- **失败处理**：自动创建 GitHub Issue（带去重逻辑），成功时自动关闭
- **所需 Secrets**：`PYTHONLAB_SMOKE_USERNAME`、`PYTHONLAB_SMOKE_PASSWORD`

### 2.3 pr-pythonlab-owner-gate.yml — PR 门禁（并发）

- **触发方式**：PR 修改 `backend/app/api/endpoints/debug/**` 路径时自动触发
- **功能**：调用 `pythonlab-owner-concurrency.yml` 进行并发测试

### 2.4 pythonlab-phasec-gate.yml — PythonLab Phase C 可见性测试

- **触发方式**：
  - 定时：每日 UTC 03:10（北京时间 11:10）
  - 手动触发（workflow_dispatch）
  - 被其他工作流调用（workflow_call）
- **功能**：测试 PythonLab Phase C 的 print 可见性行为
- **测试脚本**：
  - 预热探针：`backend/scripts/smoke_pythonlab_print_visibility_probe.py`
  - 浸泡测试：`backend/scripts/soak_pythonlab_phasec.py`
- **所需 Secrets**：`PYTHONLAB_SMOKE_USERNAME`、`PYTHONLAB_SMOKE_PASSWORD`

### 2.5 pr-pythonlab-phasec-gate.yml — PR 门禁（Phase C）

- **触发方式**：PR 修改 debug 相关路径时自动触发
- **功能**：调用 `pythonlab-phasec-gate.yml` 进行可见性测试

---

## 三、本地脚本

### 3.1 scripts/deploy.sh — 统一部署入口

```bash
bash scripts/deploy.sh <命令>
```

| 命令 | 说明 |
|------|------|
| `deploy` | 拉取镜像 → 启动服务 → 健康检查 |
| `deploy-amd64` | 同上，强制 `linux/amd64` 平台 |
| `deploy-local` | 本地部署（不重新构建） |
| `up` | 本地构建并启动（`docker compose up -d --build`） |
| `pull-up` | 拉取最新镜像并启动 |
| `build` | 仅构建镜像 |
| `push` | 推送镜像到 DockerHub |
| `down` | 停止所有服务 |
| `down-v` | 停止服务并删除数据卷 |
| `logs` | 查看服务日志 |
| `health` | 健康检查 |
| `simulate` | 模拟部署测试（临时环境） |
| `backup-db [full\|schema\|data]` | 数据库备份 |
| `restore-db <dump文件>` | 数据库恢复 |

带 `-amd64` 后缀的命令（如 `up-amd64`、`build-amd64`）会强制使用 `linux/amd64` 平台。

### 3.2 build_images.sh — 本地镜像构建

构建所有 6 个 Docker 镜像（backend、frontend、gateway、typst-worker、pythonlab-worker、pythonlab-sandbox）。

### 3.3 start-dev.sh / stop-dev.sh — 开发环境

- `start-dev.sh`：启动 Docker 基础设施 + 本地后端/前端进程
- `stop-dev.sh`：停止所有开发服务

---

## 四、Docker 镜像清单

| 镜像 | 用途 | 基础镜像 |
|------|------|---------|
| `wangsh-backend` | FastAPI 后端 API | Python 3.13 |
| `wangsh-frontend` | React 静态资源 + Caddy | Node 构建 + Caddy |
| `wangsh-gateway` | Caddy 反向代理网关 | Caddy |
| `wangsh-typst-worker` | Celery Worker（Typst PDF 编译） | Python 3.13 + Typst |
| `wangsh-pythonlab-worker` | Celery Worker（PythonLab 任务） | Python 3.13 |
| `wangsh-pythonlab-sandbox` | PythonLab 沙箱容器 | Python 3.11（精简） |

---

## 五、所需 Secrets

| Secret | 用途 |
|--------|------|
| `DOCKERHUB_USERNAME` | DockerHub 登录用户名 |
| `DOCKERHUB_TOKEN` | DockerHub 访问令牌 |
| `PYTHONLAB_SMOKE_USERNAME` | PythonLab 冒烟测试用户名 |
| `PYTHONLAB_SMOKE_PASSWORD` | PythonLab 冒烟测试密码 |
