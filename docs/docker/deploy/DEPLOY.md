# 部署指南

> 最后更新：2026-07-12

## 服务器信息

- **域名**: wangsh.cn
- **SSH 端口**: 6607
- **用户**: shuhao
- **当前版本**: 1.6.0

### 快速连接
```bash
ssh wangsh.cn
```

---

## 快速开始

### 开发环境

**方式1：使用便捷脚本（推荐）**

```bash
# 本地模式（Docker基础设施 + 本地业务代码）
bash start-dev.sh

# Docker模式（全部在Docker中运行）
bash start-dev.sh --docker
```

**方式2：直接使用 Docker Compose**

```bash
# 1. 复制配置文件
cp .env.example .env.dev

# 2. 启动所有服务
docker compose -f docker-compose.dev.yml up -d

# 3. 访问
# 前端：http://localhost:6608
# 后端：http://localhost:8000
# 数据库管理：http://localhost:8081
```

**两种方式对比**：
- `start-dev.sh`：自动检测端口冲突、支持混合模式、日志管理
- `docker compose`：简单直接、全部容器化

### 生产环境

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，设置生产配置（修改密码、密钥等）

# 2. 构建镜像（发布机器）
bash scripts/deploy.sh build

# 3. 推送镜像到 Docker Hub
bash scripts/deploy.sh push

# 4. 下载发布 workflow 生成的 release-set artifact 到仓库根目录
# 文件名默认使用 release-set.txt

# 5. 生产服务器验证整组镜像并部署
bash scripts/deploy.sh deploy
```

---

## 版本管理

发布版本需要在以下机器可读配置中保持一致，CI 会运行
`scripts/check-version-consistency.mjs` 阻止版本漂移：

```bash
APP_VERSION=1.6.0
IMAGE_TAG=1.6.0
REACT_APP_VERSION=1.6.0
IMAGE_REPOSITORY_PREFIX=shuhao07
```

当前版本更新仍是显式同步，不会自动改写其他文件。至少需要同步
`.env.example`、`frontend/package.json` 和 `frontend/package-lock.json`。

---

## 开发 vs 生产模式对比

| 特性 | 开发模式 | 生产模式 |
|------|----------|----------|
| **前端服务** | Vite dev server (端口 6608) | Caddy 静态文件服务 (端口 80) |
| **后端服务** | uvicorn --reload | uvicorn --workers `${UVICORN_WORKERS:-1}` |
| **调试模式** | DEBUG=true | DEBUG=false |
| **代码加载** | 本地目录挂载（热加载） | 代码打包到镜像内 |
| **网关** | 可选（开发时不启动） | 必需（Caddy 反向代理） |
| **数据库** | 本地 ./data/postgres | Docker volume postgres_data |
| **镜像来源** | 本地构建 (Dockerfile.dev) | Docker Hub 或本地构建 (Dockerfile.prod) |

---

## 镜像构建流程

### 1. 构建所有镜像

```bash
bash scripts/deploy.sh build
```

后端生产镜像的 Debian 软件包源可通过 `DEBIAN_MIRROR` 和
`DEBIAN_SECURITY_MIRROR` 覆盖。Compose 默认使用已验证的阿里云镜像，以降低
`linux/amd64` Typst 字体包下载超时；境外部署或镜像不可用时可改回：

```bash
DEBIAN_MIRROR=http://deb.debian.org/debian
DEBIAN_SECURITY_MIRROR=http://deb.debian.org/debian-security
```

构建的镜像列表：
- `shuhao07/wangsh-backend:1.6.0` - 后端 FastAPI 服务
- `shuhao07/wangsh-frontend:1.6.0` - 前端静态文件
- `shuhao07/wangsh-gateway:1.6.0` - Caddy 网关
- `shuhao07/wangsh-typst-worker:1.6.0` - Typst PDF 编译 worker
- `shuhao07/wangsh-pythonlab-worker:1.6.0` - PythonLab 调试 worker
- `shuhao07/pythonlab-sandbox:1.6.0` - PythonLab 沙箱镜像

### 2. 本地生产模拟验证

```bash
# 使用本地已构建或已拉取的生产镜像，不重新 build
bash scripts/deploy.sh simulate

# 健康检查
curl http://localhost:16608/api/health

# 完整 prod-smoke，结束或失败后自动清理模拟容器和 volumes
SIM_RUN_PROD_SMOKE=true SIM_CLEANUP=true bash scripts/deploy.sh simulate
```

默认模拟参数：

```bash
SIM_VERSION=1.6.0
SIM_IMAGE_REPOSITORY_PREFIX=shuhao07
SIM_WEB_PORT=16608
SIM_RUN_PROD_SMOKE=false
SIM_CLEANUP=false
```

`simulate` 是本地生产镜像验证入口，不消费 `release-set.txt`。脚本会先确认 Compose
引用和 PythonLab sandbox 镜像均已存在于本机，再停止旧的 `wangsh_sim` 栈并清理
`data/pythonlab/simulations/run.*` 残留目录。模拟固定覆盖
`COMPOSE_PROJECT_NAME=wangsh_sim`、版本、镜像、端口和
`PYTHONLAB_CONTAINER_NAMESPACE=wangsh_sim` 等关键变量，不受父 shell 同名变量影响。
同一主机上的 `simulate` 使用进程锁互斥；已有活跃模拟时新运行会立即退出，遗留的失效
锁会在确认原进程不存在后原子接管，避免并发运行相互停止容器或删除工作区。

每次模拟使用独立的 `data/pythonlab/simulations/run.*` 工作区，不会读写或删除
`data/pythonlab/workspaces`。运行失败时会自动清理模拟栈和本次工作区；
`SIM_CLEANUP=true` 时成功后也会清理。显式保留成功栈时，本次隔离工作区会随栈保留，
并在下一次 simulate 停止旧栈后作为残留清理。清理命令失败不会被忽略：原流程成功但
清理失败时，`deploy.sh` 返回非零。

`SIM_RUN_PROD_SMOKE=true` 时，随机生成的临时管理员密码只在当前进程内传给
`scripts/prod-smoke/run.sh`，不会写入仓库或输出到终端。PythonLab 三个 smoke
子脚本统一读取 `PYTHONLAB_SMOKE_USERNAME` / `PYTHONLAB_SMOKE_PASSWORD`；UI smoke
通过环境变量读取密码，`summary.json` 的 `command` 字段不记录明文密码。
基础认证检查也只记录 refresh 响应中 access/refresh token 是否存在，不将有效 token
写入 `summary.json` 或 `api-results.json`。步骤日志和 Compose 服务日志在落盘前还会
统一脱敏 URL query/userinfo、Bearer/Basic、JSON/字典、Cookie、password、api_key
和已知环境敏感值。子脚本 JSON 报告会递归清洗后重写；证据目录使用 `0700`，文件使用
`0600`，新运行前会清空旧结果。smoke 子进程只接收运行所需环境白名单，不继承宿主
中的无关 API token。

完整 `prod-smoke` 会继承 simulate 的同一 Compose 上下文：
`COMPOSE_PROJECT_NAME=wangsh_sim`、临时 `ENV_FILE` 和当前 `COMPOSE_FILE` 会分别作为
`PROD_SMOKE_COMPOSE_PROJECT_NAME`、`PROD_SMOKE_COMPOSE_ENV_FILE`、
`PROD_SMOKE_COMPOSE_FILE` 传入。烟测采集日志或执行容器内检查时会带上
`--project-name`、`--env-file` 和 `-f`，不会误连默认生产 project。

模拟清理动态沙箱时只匹配精确前缀 `^/wangsh_sim_`。因此 simulate 可以删除本次或上次
遗留的 `wangsh_sim_*` 沙箱，但不会匹配开发环境默认的 `pythonlab_*` 容器；清理后还会
再次查询确认没有同前缀残留。

正式 `deploy`、`pull-up`、`up-no-build` 仍必须验证 registry `release-set.txt`，
本地模拟通过不能替代正式发布门禁。

### 3. 推送到 Docker Hub

```bash
# 登录 Docker Hub
docker login

# 推送所有生产镜像
bash scripts/deploy.sh push
```

### 4. 生产服务器部署

```bash
# 确认 .env 使用生产配置
APP_VERSION=1.6.0
IMAGE_TAG=1.6.0
REACT_APP_VERSION=1.6.0
IMAGE_REPOSITORY_PREFIX=shuhao07

# 将发布 workflow 生成的 release-set.txt 放到仓库根目录。
# 也可通过 RELEASE_SET_FILE=/secure/path/release-set.txt 指定位置。

# 先独立验证版本、六镜像集合、Compose 引用和 registry digest
bash scripts/deploy.sh verify-release-set release-set.txt

# 再拉取并启动，不在生产服务器重新构建；deploy 会重复执行同一硬门禁
bash scripts/deploy.sh deploy

# 验证网关和后端
curl http://localhost:6608/api/health
docker compose ps
```

---

## 常用部署命令

Docker Compose 命令：

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 启动所有服务 |
| `docker compose up -d --build` | 构建并启动服务 |
| `docker compose pull` | 拉取最新镜像 |
| `docker compose push` | 推送镜像到 Docker Hub |
| `docker compose down` | 停止所有容器 |
| `docker compose down -v` | 停止容器并删除 volumes |
| `docker compose logs -f` | 查看实时日志 |
| `docker compose ps` | 查看服务状态 |
| `docker compose restart` | 重启所有服务 |

项目脚本推荐命令：

| 命令 | 说明 |
|------|------|
| `bash scripts/deploy.sh build` | 按 `.env` 构建生产镜像 |
| `bash scripts/deploy.sh push` | 推送 `shuhao07/*:${IMAGE_TAG}` 生产镜像 |
| `bash scripts/deploy.sh verify-release-set <文件>` | 拉取前校验完整发布镜像集合 |
| `bash scripts/deploy.sh deploy` | 验证 release-set 后拉取镜像并 `up -d --no-build` |
| `bash scripts/deploy.sh up-no-build` | 验证 release-set 后使用已有镜像启动，不拉取、不构建 |
| `bash scripts/deploy.sh simulate` | 校验本地镜像后，用临时配置在 `16608` 端口做生产模拟 |

开发环境命令：
```bash
# 启动开发环境
docker compose -f docker-compose.dev.yml up -d

# 停止开发环境
docker compose -f docker-compose.dev.yml down
```

---

## 服务说明

### 核心服务

- **gateway** - Caddy 反向代理（生产环境）
- **backend** - FastAPI 后端服务
- **frontend** - React 前端（开发环境独立服务）
- **postgres** - PostgreSQL 数据库
- **redis** - Redis 缓存

### Worker 服务

- **typst-worker** - Typst PDF 渲染服务（信息学竞赛笔记）
- **pythonlab-worker** - 默认 `celery` 队列 worker，处理 PythonLab 调试任务和课堂结束后的 AI 分析

### 可选服务

- **adminer** - 数据库管理界面（开发环境）

---

## 环境变量配置

关键环境变量说明：

### 版本配置
```bash
APP_VERSION=1.6.0          # 应用版本号
IMAGE_TAG=1.6.0            # Docker 镜像标签
REACT_APP_VERSION=1.6.0    # 前端版本号
IMAGE_REPOSITORY_PREFIX=shuhao07  # Docker Hub 镜像命名空间
```

### 安全配置（生产环境必须修改）
```bash
SECRET_KEY=...                        # 后端密钥
SUPER_ADMIN_PASSWORD=...              # 管理员密码
POSTGRES_PASSWORD=...                 # 数据库密码
AGENT_API_KEY_ENCRYPTION_KEY=...     # 智能体 API 密钥加密
```

### 功能开关
```bash
DEBUG=false                  # 生产环境必须为 false
BACKEND_RELOAD=false         # 生产环境必须为 false
SSE_REDIS_PUBSUB_ENABLED=true # 多 worker SSE 必须开启并保证 Redis 可用
IT_GAME_MAX_UPLOAD_BYTES=524288000 # IT 游戏安装包上传上限（字节）
```

### Redis 与 PythonLab 隔离

```bash
REDIS_HOST=redis
PYTHONLAB_CONTAINER_NAMESPACE=pythonlab
PYTHONLAB_WORKSPACE_ROOT=/tmp/pythonlab/workspaces
PYTHONLAB_HOST_WORKSPACE_ROOT=./data/pythonlab/workspaces
# 可选：DockerProvider 无法自动解析 bind mount 时，填写宿主机绝对路径
HOST_WORKSPACE_ROOT=
```

生产 Compose 不固定 Redis `container_name`，应用和 worker 统一通过服务名 `redis`
访问缓存，从而允许不同 Compose project 并存。开发 Compose 的现有 Redis 容器行为
保持不变。

`PYTHONLAB_CONTAINER_NAMESPACE` 决定动态沙箱容器前缀以及
`list_active_sessions` 的枚举范围，默认 `pythonlab` 保持现有容器名兼容。
`PYTHONLAB_HOST_WORKSPACE_ROOT` 是生产 Compose 的宿主机 bind mount 源；
`PYTHONLAB_WORKSPACE_ROOT` 是 backend/worker 容器内路径。需要显式帮助
DockerProvider 定位宿主机目录时，`HOST_WORKSPACE_ROOT` 应填写同一目录的绝对路径。

`.env.example` 是该合同的机器可读基线：

- `REDIS_HOST=redis` 对应生产 Compose 服务发现，不再依赖固定 Redis 容器名。
- `PYTHONLAB_CONTAINER_NAMESPACE=pythonlab` 保持开发/正式环境动态沙箱命名兼容。
- `PYTHONLAB_HOST_WORKSPACE_ROOT` 负责 Compose bind mount 源目录。
- `HOST_WORKSPACE_ROOT` 只用于 DockerProvider 无法从 mount 信息自动解析宿主机路径时
  的显式绝对路径回退；不要再将容器内 `/tmp/pythonlab/workspaces` 当成宿主机路径。

---

## 常见问题

### 1. 前端无法访问后端 API

**开发环境**：确保 `REACT_APP_API_URL=/api/v1`；Vite 会将 `/api` 和 WebSocket
请求代理到 `DEV_PROXY_TARGET`，未设置时默认为 `http://localhost:8000`

**生产环境**：确保 gateway 服务正常运行，Caddy 会转发 `/api/*` 到后端

### 2. PythonLab 调试超时

确保 `pythonlab-worker` 服务正常运行。该 worker 不仅处理 PythonLab，也消费默认 `celery` 队列中的课堂 AI 分析任务：
```bash
docker compose ps pythonlab-worker
docker compose exec -T pythonlab-worker docker --version
```

### 3. 前端出现 `Failed to load module script` 或 MIME `text/html`

- 根因通常不是前端业务代码，而是生产静态资源路由把缺失的 `/assets/*`、`/static/*`、`/pyodide/*` 错误回退成了 `index.html`
- 正确行为应该是：
  - SPA 页面路由回退到 `index.html`
  - 静态构建产物和运行时资源缺失时直接返回 `404`
- 如果浏览器提示 `Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"`，优先检查：
  - `frontend/caddy/Caddyfile.prod`
  - `gateway/Caddyfile`

### 4. 前端镜像构建复制 Pyodide 失败

`frontend/public/pyodide` 是 `prebuild` 从 `node_modules/pyodide` 生成的目录，不是
Docker 构建输入。该目录必须保留在 `frontend/.dockerignore` 中；否则本地残留文件或
指向宿主机绝对路径的符号链接会被 `COPY . .` 带入容器，覆盖镜像内应重新生成的运行时。

复制脚本使用 `.wangsh-pyodide-version` 记录当前 npm 包版本。只有 marker 与
`node_modules/pyodide/package.json` 版本一致，且 6 个核心文件全部存在且非空时才会
跳过复制；否则先写入 `public/pyodide.tmp-<pid>`，验证通过后再替换正式目录，避免中断
复制留下半成品。

`frontend/Dockerfile.prod` 还会在 `npm ci` 的同一个缓存层中校验核心运行时文件均
存在且非空：

```bash
test -s node_modules/pyodide/pyodide.js
test -s node_modules/pyodide/pyodide.mjs
test -s node_modules/pyodide/pyodide.asm.js
test -s node_modules/pyodide/pyodide.asm.wasm
test -s node_modules/pyodide/python_stdlib.zip
test -s node_modules/pyodide/pyodide-lock.json
test -s node_modules/pdfjs-dist/build/pdf.worker.js
```

依赖包不完整时应在源码复制和 Vite 构建前立即失败。构建完成后还必须确认最终镜像
包含完整的 Pyodide 运行时和 PDF worker：

```bash
test -s build/pyodide/pyodide.js
test -s build/pyodide/pyodide.mjs
test -s build/pyodide/pyodide.asm.js
test -s build/pyodide/pyodide.asm.wasm
test -s build/pyodide/python_stdlib.zip
test -s build/pyodide/pyodide-lock.json
test -s build/assets/pdf.worker.js
```

不要在
`copy-pyodide.js` 中伪造缺失依赖，也不要把本地 `public/pyodide` 加回构建上下文。
Vite 复制 PDF worker 失败时必须抛出错误，Docker 构建还会复核最终
`build/assets/pdf.worker.js`。

### 5. Typst PDF 渲染失败

确保 `typst-worker` 服务正常运行，且字体文件已正确挂载

```bash
docker compose ps typst-worker
docker compose exec -T typst-worker typst --version
```

### 6. 数据库连接失败

检查 `POSTGRES_HOST` 配置：
- Docker 内部：使用 `postgres`
- 本地连接：使用 `127.0.0.1`

---

## 数据库迁移策略

### 迁移前检查

```bash
# 只读检查：提前发现 alembic_version 与真实 schema 漂移
docker compose exec -T backend python /app/scripts/check_migration_state.py

# 查看当前版本
bash scripts/migrate-db.sh current

# 查看迁移历史
bash scripts/migrate-db.sh history

# 课堂迁移前必须确认没有进行中的活动
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, title, created_by FROM znt_classroom_activities WHERE status = '\''active'\'';"'
```

`20260628_0001_add_classroom_activity_class_desc` 会为课堂活动增加班级隔离字段。为避免旧 active 活动在升级后因班级为空而从学生端静默消失，该迁移会在发现进行中活动时主动中止。发布前应由教师正常结束活动，确认上述查询返回 0 行后再升级；不要直接修改或删除课堂答题数据。

该迁移会先以 `SHARE ROW EXCLUSIVE` 模式锁定课堂活动表，再检查 active 活动并执行 DDL，从而消除“检查通过后旧版本又写入”的竞态。锁表会阻塞课堂活动表上的并发写入，因此生产发布仍应安排维护窗口：先停止旧后端或关闭课堂写入口，等待在途课堂事务结束，再执行 `alembic upgrade head`。不要依赖锁等待代替停写流程。

### 执行迁移

```bash
# 升级到最新版本
bash scripts/migrate-db.sh upgrade

# 升级到指定版本
bash scripts/migrate-db.sh upgrade <revision>
```

生产 backend 容器启动时也会自动执行：

```bash
python /app/scripts/check_migration_state.py
python /app/scripts/bootstrap_db.py --initial-only
alembic -c /app/alembic.ini upgrade head
python /app/scripts/bootstrap_db.py
```

`check_migration_state.py` 是只读检查，不会修改数据库。它用于阻断以下危险状态：

- `alembic_version` 缺失或为空，但 public schema 已经有业务表。
- 当前 Alembic 版本不是代码中 head 的祖先。
- 当前版本落后，但待执行迁移要创建的表、索引或列已经存在。

如果检查失败，不要删除已有表，也不要直接重跑迁移。先备份数据库，再对照待执行迁移确认真实表、列、索引、约束是否完整；只有在确认真实 schema 已等价于目标迁移后，才允许手动补齐缺失索引/约束并 `alembic stamp <verified_revision>`。

`bootstrap_db.py --initial-only` 只用于真正空库的首次初始化：它仅创建受维护迁移链之前的 legacy baseline，并以 `VARCHAR(64)` 创建空的 `alembic_version`，不会 stamp。随后必须执行完整 `alembic upgrade head`，再由普通 `bootstrap_db.py` 补兼容字段和视图。不要在全新空库上绕过 bootstrap 直接执行 Alembic；历史 revision 中存在超过 32 字符的标识。对于已有标准 `VARCHAR(32)` 版本表的历史库，Alembic online 环境会在迁移事务前幂等扩容为 `VARCHAR(64)`。已有业务表但缺失 `alembic_version` 的数据库仍会被拒绝，避免把历史库误标记为最新。

当前 head `20260711_0002_restore_legacy_baseline_indexes` 会幂等恢复 legacy baseline
路径可能跳过的 3 个 XBK `grade` 索引和 2 个文章样式索引。空库升级验收必须查询
`pg_indexes` 确认这 5 个索引存在，不能只以 `alembic current` 到达 head 作为成功依据。

### 迁移验证

```bash
# 验证数据库连接
docker compose exec -T postgres sh -c \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

### 常见问题

- **迁移失败**: 检查数据库连接和权限
- **版本冲突**: 使用 `alembic heads` 查看分支
- **表已存在但迁移版本落后**: 这是 schema drift。先备份，运行 `check_migration_state.py`，核对真实结构后再补齐缺失索引/约束并 stamp 已验证版本；不要删表重建。

---

## 回滚流程

### 何时需要回滚

- 迁移导致数据错误
- 新版本出现严重 bug
- 需要紧急恢复服务

### 回滚步骤

```bash
# 1. 备份当前数据库
BACKUP_FILE="$(bash scripts/deploy.sh backup-db full)"

# 2. 回滚数据库
docker compose exec -T backend alembic -c /app/alembic.ini downgrade -1

# 3. 取出发布时归档的旧版本 release-set，并先独立验证
OLD_VERSION=1.5.10
OLD_RELEASE_SET=/secure/releases/release-set-${OLD_VERSION}.txt
IMAGE_TAG=${OLD_VERSION} APP_VERSION=${OLD_VERSION} REACT_APP_VERSION=${OLD_VERSION} \
  PYTHONLAB_SANDBOX_IMAGE=shuhao07/pythonlab-sandbox:${OLD_VERSION} \
  RELEASE_SET_FILE=${OLD_RELEASE_SET} \
  bash scripts/deploy.sh verify-release-set "${OLD_RELEASE_SET}"

# 4. 使用同一份旧 release-set 拉取并启动旧版本
IMAGE_TAG=${OLD_VERSION} APP_VERSION=${OLD_VERSION} REACT_APP_VERSION=${OLD_VERSION} \
  PYTHONLAB_SANDBOX_IMAGE=shuhao07/pythonlab-sandbox:${OLD_VERSION} \
  RELEASE_SET_FILE=${OLD_RELEASE_SET} \
  bash scripts/deploy.sh pull-up "${OLD_RELEASE_SET}"

# 5. 验证
curl http://localhost:6608/api/health
```

每次正式发布都必须把 `release-set.txt` 按版本归档到安全位置。只覆盖
`IMAGE_TAG`/`APP_VERSION` 而继续使用当前版本的 release-set 会被门禁拒绝，这是预期
行为，不能通过跳过校验规避。

### 回滚失败处理

如果回滚失败，使用备份恢复：
```bash
bash scripts/deploy.sh restore-db "${BACKUP_FILE:-./backups/your-backup.dump}"
```

---

## 数据备份与恢复

### 备份数据库

```bash
# 完整备份
bash scripts/deploy.sh backup-db full

# 仅备份结构
bash scripts/deploy.sh backup-db schema

# 仅备份数据
bash scripts/deploy.sh backup-db data
```

### 恢复数据库

```bash
# 恢复脚本按 .env 中的 POSTGRES_USER / POSTGRES_DB 连接当前 Compose 服务
bash scripts/deploy.sh restore-db ./backups/your-backup.dump
```

`backup-db` 默认输出自定义格式 `.dump`，`restore-db` 使用 `pg_restore --clean
--if-exists` 恢复；也兼容已有 `.sql` 文件。不要依赖 Compose 自动生成的容器名，也不要
在未确认备份可恢复前手工删除生产数据库。

---

## 生产部署检查清单

- [ ] 修改 `.env` 中的所有密码和密钥
- [ ] 设置 `DEBUG=false`
- [ ] 确认 `IMAGE_REPOSITORY_PREFIX=shuhao07`
- [ ] 确认 `APP_VERSION`、`IMAGE_TAG`、`REACT_APP_VERSION` 均为目标版本
- [ ] 配置 CORS 允许的域名
- [ ] 构建并测试所有镜像
- [ ] 推送镜像到 Docker Hub
- [ ] 在生产服务器上拉取镜像
- [ ] 执行健康检查
- [ ] 配置数据库备份计划
- [ ] 配置 HTTPS 证书（Caddy 自动申请）

---

## 技术栈

- **后端**: FastAPI + SQLAlchemy 2.0 + PostgreSQL
- **前端**: React 19 + TypeScript + Tailwind CSS + 自定义主题
- **网关**: Caddy 2
- **缓存**: Redis
- **任务队列**: Celery
- **容器**: Docker + Docker Compose

---

## 监控指南

### 健康检查

```bash
# 基础健康检查
curl http://localhost:6608/api/health

# 检查所有服务状态
docker compose ps

# 检查特定服务日志
docker compose logs backend --tail 50
```

### 关键指标

- **CPU 使用率**: 持续 > 80% 需扩容
- **内存使用率**: 持续 > 85% 需扩容
- **磁盘空间**: < 20% 需清理
- **API 响应时间**: > 2s 需优化

### 日志监控

```bash
# 查看实时日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend

# 查看错误日志
docker compose logs backend | grep ERROR
```

### 告警建议

- API 健康检查失败
- 数据库连接失败
- Worker 队列堆积
- 磁盘空间不足
