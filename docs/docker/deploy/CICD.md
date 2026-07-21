# CI/CD 工作流说明

> 最后更新：2026-07-18

## 一、概览

WangSh 项目使用 GitHub Actions 进行持续集成，使用 Docker Compose + 自定义脚本进行部署。

```
开发者 → git push → GitHub Actions（构建镜像 / 自动化测试）
                                ↓
                    DockerHub（镜像仓库）
                                ↓
              服务器 → 验证远端 release-set → 拉六个业务镜像
                     → 校验本地 digest → 禁止隐式拉取启动 → 详细健康门禁
```

---

## 二、GitHub Actions 工作流

### 2.1 dockerhub-amd64.yml — 镜像构建与推送

- **触发方式**：手动触发（workflow_dispatch）
- **输入参数**：
  - `image_tag`（必填）：镜像版本号，如 `1.6.0`
  - `push_latest`（可选）：是否同时推送 `latest` 标签，默认 `false`
- **构建平台**：`linux/amd64`
- **发布门禁**：workflow 通过 concurrency 串行执行，只允许当前 `origin/main` 对应
  commit 调用 reusable `ci-quality.yml`；非 main、落后提交或质量门禁失败时不发布镜像
- **版本约束**：`image_tag` 必须符合版本格式并与 `frontend/package.json` 完全一致；
  workflow 输入通过环境变量传入 shell，禁止直接拼接执行
- **推广流程**：六个镜像先推 `${version}-build-${run_id}`，全部 staging
  manifest 可读取后再推广版本 tag；推广后逐镜像校验 registry manifest digest，
  并上传可由 `scripts/deploy.sh` 直接消费的 `release-set-${run_id}` artifact
- **服务器锁定**：`pull-up/deploy` 拉取后再次检查本地镜像 `RepoDigests`；
  `up-no-build` 也必须通过同一检查，避免同标签旧镜像或标签漂移绕过清单。
  release-set 的逻辑名称必须与镜像仓库 basename 一致，所有已设置版本变量必须与
  清单版本一致
- **基础设施边界**：正式发布只拉取六个业务服务，PostgreSQL、Redis 不随应用发布
  隐式升级；Compose 启动使用 `--pull never`
- **部署完成门禁**：`deploy` 等待首页、API、PostgreSQL、Redis、frontend、gateway、
  Typst worker 和 PythonLab worker 全部健康后才返回成功
- **构建的镜像**（共 6 个）：

| 镜像名 | Dockerfile | 构建目标 |
|--------|-----------|---------|
| `shuhao07/wangsh-backend` | `backend/Dockerfile.prod` | `backend_runtime` |
| `shuhao07/wangsh-typst-worker` | `backend/Dockerfile.prod` | `worker_runtime` |
| `shuhao07/wangsh-pythonlab-worker` | `backend/Dockerfile.prod` | `pythonlab_worker_runtime` |
| `shuhao07/pythonlab-sandbox` | `backend/docker/pythonlab-sandbox/Dockerfile` | — |
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

- **触发方式**：PR 修改 PythonLab、sandbox、Celery、通用认证/启动依赖、
  Monaco 或 Compose 相关路径时自动触发
- **功能**：调用 `pythonlab-pr-runtime.yml`，在 GitHub runner 启动当前 PR 合并结果的
  PostgreSQL、Redis、backend、Celery、sandbox 和 Vite；先以 Playwright Chromium
  执行真实 pointer-click 的基础调试与多断点 Continue，再执行 owner matrix
- **Fork PR**：使用 runner 内临时测试账号，不读取仓库 secrets，因此 fork PR 不跳过
- **浏览器凭据**：密码只通过 step `env.ADMIN_PASSWORD` 传给
  `pythonlab-debug-smoke.mjs`，命令行只包含用户名和报告路径，不出现密码参数
- **实时输出**：浏览器及 Python smoke 均通过 `redact_exec.py` 执行，合并脱敏
  stdout/stderr，同时保留普通退出码和 shell 兼容的信号退出码
- **失败日志**：backend、Celery worker 和 Vite 日志仅发布最后 200 行，并通过
  `scripts/prod-smoke/redact.py` 清除 query/userinfo、Bearer/Basic、JSON/字典、
  Cookie、password、api_key 和已知环境敏感值
- **触发范围**：修改共享的 `scripts/prod-smoke/**` 脱敏实现也会触发两条
  PythonLab PR runtime 门禁

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

- **触发方式**：与 owner PR 门禁共享 PythonLab 运行时影响路径，并覆盖 Phase C
  probe/soak 脚本
- **功能**：调用 `pythonlab-pr-runtime.yml`，先执行可见性预热探针，再执行默认
  5 轮 PR soak；同一全栈运行时也执行真实浏览器 PythonLab smoke，失败上传
  backend/worker/frontend 日志并始终清理临时资源

### 2.6 ci-quality.yml — 通用质量门禁

- **触发方式**：
  - `pull_request`
  - `push` 到 `main`
  - 文档-only 改动会跳过（`docs/**`、`**/*.md`）
- **功能**：
  - 版本：校验 package/lockfile、`.env.example`、生产 Compose 默认标签、Docker Hub
    workflow 默认输入和生产模拟默认版本
  - Compose：使用已跟踪的 `.env.example` 校验开发/生产配置和镜像版本
  - 根脚本：对部署、回滚、迁移、健康检查、生产 smoke 和本地开发启动/停止入口执行
    Bash 语法检查
  - 数据库：动态解析 Alembic heads，强制单 head；空库创建 legacy baseline 后执行完整 `alembic upgrade head`
  - 后端：安装 `backend/requirements-dev.txt`，执行 Python 文件规模/复杂度
    ratchet 和 `pytest -q`；PR、main push 与镜像发布调用都会对旧 baseline
    做防放宽比较
  - 前端：脚本测试、CSS token 完整性、组件测试、type-check、lint、UI audit、
    生产构建和 bundle budget
- **测试环境合同**：
  - PostgreSQL 连接和四项测试专用安全配置统一声明在 `backend-pytest` job 的
    `env`，迁移、bootstrap 和 pytest 使用同一套配置。
  - CI 不设置 `DEBUG=true` 绕过生产安全校验；测试值必须非默认，
    `SECRET_KEY` 不少于 32 字符，加密键使用合法 Fernet 格式。
  - 前端必须通过干净 `npm ci`；ECharts 与词云插件的 peer major、manifest 和
    lockfile 版本由 workflow contracts 保持一致。
- **目的**：覆盖全仓基础质量，不仅限于 PythonLab 路径

---

### 2.7 markdown-quality.yml — 文档质量门禁

- **触发**：Markdown、Markdown 合同脚本或本 workflow 变化。
- **执行**：`node --test scripts/markdown-contracts.test.mjs`。
- **覆盖**：相对链接与锚点、代码块/H1 结构、生命周期字段、redirect 长度、
  archive 索引、学习章节数量和 `TEST_STATUS.md` 派生统计。
- **目的**：文档-only PR 不触发完整应用 CI，但仍有独立质量门禁。

---

## 三、部署接口边界

本文件维护 workflow 触发条件、Secrets、质量门禁和镜像发布合同。开发/生产 Compose、
release-set、数据库备份恢复、生产模拟和回滚命令统一由
[DEPLOY.md](DEPLOY.md)维护；根层脚本入口见
[scripts/README.md](../../../scripts/README.md)。

CI/CD 文档不复制部署命令，避免 workflow 合同与人工运维步骤分别漂移。

---

## 四、Docker 镜像清单

| 镜像 | 用途 | 基础镜像 |
|------|------|---------|
| `wangsh-backend` | FastAPI 后端 API | Python 3.11 |
| `wangsh-frontend` | React 静态资源 + Caddy | Node 构建 + Caddy |
| `wangsh-gateway` | Caddy 反向代理网关 | Caddy |
| `wangsh-typst-worker` | Celery Worker（Typst PDF 编译） | Python 3.11 + Typst |
| `wangsh-pythonlab-worker` | Celery Worker（PythonLab 任务） | Python 3.11 |
| `pythonlab-sandbox` | PythonLab 沙箱容器 | Python 3.11（精简） |

---

## 五、所需 Secrets

| Secret | 用途 |
|--------|------|
| `DOCKERHUB_USERNAME` | DockerHub 登录用户名 |
| `DOCKERHUB_TOKEN` | DockerHub 访问令牌 |
| `PYTHONLAB_SMOKE_USERNAME` | PythonLab 冒烟测试用户名 |
| `PYTHONLAB_SMOKE_PASSWORD` | PythonLab 冒烟测试密码 |

`PYTHONLAB_SMOKE_*` 仅供定时或手工远端专项 workflow 使用。PR runtime 使用
runner 内的临时本地账号，不读取这两个 secrets。

---

## 六、当前质量基线

当前测试数字、证据路径、warning 和未执行远端门禁统一维护在
[TEST_STATUS.md](../testing/TEST_STATUS.md)。本页只维护 CI/CD 合同，不复制动态基线。

- CI 使用 `npm run build:check`，因此 bundle 达到 error 阈值会阻止合并
  和镜像发布；warning 继续作为治理台账中的量化改进项。
- Python governance 达到 error 阈值时阻止合并；warning 通过 baseline ratchet
  逐步偿还，不得通过提高阈值掩盖新增问题。
- 本地完整生产模拟通过不能替代真实 GitHub runner、生产数据库升级、恢复和回滚演练。
- 本地/远端执行结果、镜像发布状态和仍待执行门禁统一查看
  [TEST_STATUS.md](../testing/TEST_STATUS.md) 与 [RELEASE_NOTES.md](../RELEASE_NOTES.md)。
