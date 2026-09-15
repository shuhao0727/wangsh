# WangSh Docker 清理、重建、全量验证与发布计划

> 状态：archived
> Owner：ops
> 最近复核：2026-09-15
> 替代文档：../RELEASE_NOTES.md、../testing/TEST_STATUS.md、../deploy/DEPLOY.md
> 归档原因：2.1 发布闭环、项目临时产物整理和旧 2.0 标签清理已完成；本文件保留为历史执行证据。

## 一、计划目标

本计划用于完成 WangSh 当前工作树的一次可审计发布闭环：

1. 整理项目内明确可重建的垃圾文件，不误删配置、持久化数据、用户成果或近期验证证据。
2. 整理 Docker 中的 dangling 镜像和无效构建产物，不误删仍被 Compose、回滚或开发环境使用的镜像。
3. 使用 Docker 真实重新构建生产 release-set 的 6 个镜像。
4. 通过 Compose 启动隔离的真实运行栈，并执行服务健康、API、数据库、Redis、Celery、PythonLab sandbox、前端和网关验证。
5. 执行项目规定的前端、后端、脚本、工作流合同和文档合同门禁。
6. 使用真实浏览器访问实际运行的系统并留下截图证据；截图只放在 `/tmp` 或 Codex 证据目录，不提交生成物。
7. 在验证通过后，提交当前工作树中属于本次交付范围的更新并推送 GitHub 当前分支。
8. 在 GitHub 推送成功后，将同一提交对应的最终 amd64 release-set 推送到 Docker Hub，并核验远端 manifest 与 digest。

## 二、当前基线与执行边界

### 2.1 Git 基线

- 工作目录：`/Users/wsh/wangsh`
- 当前分支：`release/v1.6.0-audit-fixes`
- 远端：`origin = git@github.com:shuhao0727/wangsh.git`
- 当前分支在开始前与 `origin/release/v1.6.0-audit-fixes` 同步。
- 工作树在开始前包含 9 个已修改文件和 1 个未跟踪源码文件：
  - `.github/workflows/ci-quality.yml`
  - `.github/workflows/pythonlab-pr-runtime.yml`
  - `backend/app/core/sandbox/docker.py`
  - `backend/app/core/sandbox/docker_paths.py`（未跟踪）
  - `backend/scripts/python-governance-baseline.json`
  - `docs/docker/RELEASE_NOTES.md`
  - `docs/docker/deploy/CICD.md`
  - `docs/docker/archive/2026-09-09-release-readiness-gap.md`
  - `docs/docker/testing/TEST_STATUS.md`
  - `scripts/check-version-consistency.mjs`
- 这些改动视为当前待交付内容。任何执行者都不得使用 `git reset --hard`、`git checkout --`、`git clean`、强制推送或其他方式覆盖/回滚它们。
- 执行前后都必须保存 `git status --short --branch`、`git diff --stat` 和 `git diff --check` 结果。

### 2.2 Docker 基线

- Docker Client/Server：`29.6.1`
- Docker Compose：`v5.3.0`
- 目标构建架构：`linux/amd64`。
- 开始时无运行中的 WangSh 容器。
- 当前生产 release-set 目标为以下 6 个镜像，版本标签来自 `.env` 的 `IMAGE_TAG=2.0`：
  - `shuhao07/wangsh-backend:2.0`
  - `shuhao07/wangsh-typst-worker:2.0`
  - `shuhao07/wangsh-pythonlab-worker:2.0`
  - `shuhao07/pythonlab-sandbox:2.0`
  - `shuhao07/wangsh-frontend:2.0`
  - `shuhao07/wangsh-gateway:2.0`
- 开始时存在 5 个 dangling 镜像，其中 4 个是 WangSh 最近构建产生的无 tag镜像，另 1 个是无 tag PostgreSQL 镜像。
- 开始时没有本地 Docker volume；不要因为清理镜像而删除 Compose volume 或项目 `data/`。
- `.env` 的安全配置只允许在本机使用，日志和报告中不得输出密码、token、Cookie、密钥或完整连接串。

### 2.3 本轮被用户打断前已经发生的操作

以下操作已经在本计划创建前完成，不得盲目重复：

- 已将第一轮明确可重建的生成物和旧 `output/` 证据移到：
  `/tmp/wangsh-garbage-20260913-093358`
- 该临时归档约 95 MB，包含 Python 缓存、pytest/ruff 缓存、后端 coverage/log、前端 build/coverage、旧 Playwright 输出和字节码。
- 已执行 dangling image 清理，Docker 报告回收约 279.4 MB。
- 已启动一次生产 Compose 的 amd64 镜像构建：
  `docker compose --env-file .env -f docker-compose.yml --progress=plain build --pull backend typst-worker pythonlab-worker pythonlab-sandbox frontend gateway`
- 因用户中断，下一执行者必须先确认该构建进程是否仍在运行、是否已成功结束、哪些镜像已经更新；不能直接再启动第二次同样的构建。

## 三、不可逾越的安全边界

1. **不回滚现有源码改动**：当前工作树是交付输入，不把未提交等同于无效。
2. **不清理不明文件**：保留 `.env`、`.env.dev`、`data/`、`backend/data/`、`.codex/`、`.playwright-*`、`backend/docker/bin/`、`frontend/public/mindmap-demo/` 和 `frontend/src/styles/index.css.backup`，除非后续有明确证据证明某项是可删除生成物。
3. **不执行全局危险清理**：默认不使用 `docker system prune -a`、`docker volume prune`、`docker builder prune -a`、`git clean -fdx` 或删除全部本地镜像的命令。
4. **不删除持久化数据**：生产 Compose 验证结束时可以 `down --remove-orphans`，不得加 `-v`。
5. **不混用开发/生产栈**：开发 Compose 只用于热加载/开发验证；生产 Compose 用于最终 release-set 运行验证。
6. **不在未通过验证前推送**：先完成本地 Docker 真实运行验证和工程门禁，再提交 GitHub；Docker Hub 推送必须在 GitHub 推送成功后进行。
7. **不强推 GitHub**：只推送当前分支的普通 fast-forward 更新。若远端在执行期间发生变化，先停止并重新同步/复核，不能强推覆盖。
8. **凭据不进命令行历史和文档**：Docker Hub 使用已有 credential helper 或交互式登录；不得把 token 写入脚本、计划、日志或提交。
9. **发现任何不确定性时停止在对应阶段**：例如 Docker Hub 账号/仓库不明确、登录失效、Compose 使用了不可接受的外部网络、测试连接到了正常业务数据库、工作树出现非本次改动等。

## 四、阶段 0：恢复检查（下一模型的第一步）

用户要求本轮暂停执行，因此下一模型接手时必须先读本计划，再做恢复检查：

```bash
cd /Users/wsh/wangsh

git status --short --branch
git diff --stat
git diff --check

# 仅检查，不删除、不停止、不重启任何进程
ps aux | grep -E '[d]ocker compose.*build|[b]uildkit|[b]uildx' || true
docker ps --all --format 'table {{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Status}}'
docker image ls --all --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}'
```

恢复判断：

- 若上一轮 build 仍在运行：等待其自然结束，记录成功/失败和最终输出；不要并行启动重复构建。
- 若上一轮 build 已成功：用 `docker image inspect` 核对 6 个镜像的创建时间、架构和当前工作树构建结果，再进入 Compose 验证。
- 若上一轮 build 已失败：保留失败日志，定位失败阶段；修复前不要删缓存或重置源码。
- 若上一轮 build 已结束但镜像不完整或仍是旧镜像：只重建缺失/未更新的服务，必要时再执行全量构建。
- 若工作树状态与本基线不一致：先列出新增/删除/修改，保护其他 agent 或用户改动，再决定是否继续。

## 五、阶段 1：项目垃圾文件治理

### 5.1 允许整理的对象

仅处理明确可重建的对象：

- 根 `.pytest_cache/`、`.ruff_cache/`
- 后端 `.pytest_cache/`、`.coverage`、`backend.log`
- 各源码目录下的 `__pycache__/` 和 `.pyc`
- `frontend/build/`、`frontend/coverage/`
- 已确认是旧的、非当前验证证据的根 `output/`

### 5.2 推荐操作

为可恢复性，优先移动而不是直接删除：

```bash
ARCHIVE="/tmp/wangsh-garbage-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$ARCHIVE"
# 将上述明确生成物逐项移入 $ARCHIVE，保持相对目录结构
```

注意：不要把 `.env`、`data/`、`backend/data/`、当前 Codex/Playwright 状态或不明静态素材加入归档。不要把临时归档目录放进 Git。

### 5.3 清理后的检查

```bash
find . -path './.git' -prune \
  -o -path './frontend/node_modules' -prune \
  -o -path './backend/venv' -prune \
  -o -path './data' -prune \
  -o -path './backend/data' -prune \
  -o -type d -name '__pycache__' -print

git status --short --ignored | sed -n '1,240p'
git diff --check
```

预期：仓库中不再出现明确生成缓存；Git 的业务修改和未跟踪源码不变；`.env` 与数据目录仍保留。

## 六、阶段 2：Docker 垃圾镜像治理

### 6.1 先盘点

```bash
docker ps --all
docker image ls --all
docker system df -v
docker volume ls
docker network ls
```

将镜像分为：

- 当前 release-set 的带 tag 镜像：保留，后续由当前源码更新。
- Compose/开发环境仍使用的带 tag 基础镜像：保留，例如 PostgreSQL、Redis、Node、Adminer、Caddy。
- dangling 镜像：只有在确认没有容器引用后才清理。
- 历史带 tag 镜像：不因“看起来旧”直接删除；它们可能承担回滚或开发复现价值。

### 6.2 允许的清理

当 `docker ps -a` 确认没有容器引用，且镜像确实没有 tag 时，可执行：

```bash
docker image prune --force
```

不能把 `docker system prune -a` 作为默认方案。构建缓存单独评估；本轮优先保留缓存以便完成真实重建。只有在最终构建、验证和推送完成后仍明确需要释放空间，才考虑按时间过滤的非全量 build cache 清理，并记录回收量。

### 6.3 清理后的证据

保存：

```bash
docker image ls --all
docker system df
docker image ls --filter dangling=true
```

预期：dangling 镜像为 0 或只剩有明确保留理由的条目；带 tag 的基础镜像和 release-set 未被误删。

## 七、阶段 3：配置合同与生产镜像重新打包

### 7.1 配置渲染

先验证两个 Compose 文件都可解析：

```bash
docker compose --env-file .env.example -f docker-compose.yml config --quiet
docker compose --env-file .env.example -f docker-compose.dev.yml config --quiet
docker compose --env-file .env -f docker-compose.yml config --quiet
docker compose --env-file .env -f docker-compose.yml config --services
docker compose --env-file .env -f docker-compose.yml config --images
```

必须确认：

- 生产服务为 `postgres`、`redis`、`backend`、`frontend`、`gateway`、`pythonlab-sandbox`、`pythonlab-worker`、`typst-worker`。
- WangSh 镜像均为 `shuhao07/*:2.0`。
- PythonLab sandbox 与 worker 的镜像口径一致。
- 网关端口可通过 `WEB_PORT` 改为隔离验证端口，不占用用户已有服务。

### 7.2 重新构建

如果阶段 0 证明上一轮构建失败或不完整，执行：

```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64 \
  docker compose --env-file .env -f docker-compose.yml --progress=plain \
  build --pull backend typst-worker pythonlab-worker \
  pythonlab-sandbox frontend gateway
```

原则：

- 先使用 `--pull` 获取当前配置声明的基础镜像；不默认使用 `--no-cache`，因为 BuildKit cache 不等于错误或垃圾。
- 如果某一层明显复用了错误的旧源码，先通过镜像创建时间、源码 COPY 层和容器内版本核对；只有证据证明缓存不正确时，才对受影响服务使用 `--no-cache`。
- 生产 Dockerfile 的 6 个目标必须全部成功；不可只构建 backend 就宣称 release-set 完成。
- 构建输出中不得出现敏感环境变量值。

### 7.3 镜像构建后检查

```bash
for image in \
  shuhao07/wangsh-backend:2.0 \
  shuhao07/wangsh-typst-worker:2.0 \
  shuhao07/wangsh-pythonlab-worker:2.0 \
  shuhao07/pythonlab-sandbox:2.0 \
  shuhao07/wangsh-frontend:2.0 \
  shuhao07/wangsh-gateway:2.0
 do
   docker image inspect "$image" \
     --format '{{.RepoTags}} arch={{.Architecture}} os={{.Os}} created={{.Created}}'
 done
```

预期：6 个镜像均存在，架构为 `amd64/linux`，创建时间对应本轮构建，且名称/标签与 Compose 一致。

## 八、阶段 4：Docker 全量真实运行验证

### 8.1 启动隔离的生产栈

不要直接占用默认 6608 端口，也不要删除既有 volume。使用独立 Compose project name 和临时 Web 端口：

```bash
COMPOSE_PROJECT_NAME=wangsh-verify \
WEB_PORT=16608 \
  docker compose --env-file .env -f docker-compose.yml up -d --no-build --pull never
```

说明：生产 Compose 内部使用固定的容器名，执行前必须确认这些名称没有被其他环境占用。验证完成使用 `down --remove-orphans`，不得加 `-v`。

### 8.2 容器状态、健康和日志

```bash
COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml ps

# 等待 postgres、redis、backend、frontend、gateway 和 worker 健康；超时则停止并查看脱敏日志
COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml logs --tail=200
```

必须验证：

- PostgreSQL healthcheck 为 healthy。
- Redis healthcheck 为 healthy。
- backend healthcheck 为 healthy。
- frontend 和 gateway 可以返回 HTTP 200。
- `pythonlab-worker` 和 `typst-worker` 正常启动且无持续重启。
- 日志无数据库连接失败、迁移失败、导入错误、端口冲突、Caddy 配置错误或 worker 启动失败。
- 所有日志对外报告前先使用仓库现有脱敏脚本处理。

### 8.3 API 与版本验证

根据实际 Compose 路由和现有 API 文档执行，不假设旧端点一定存在：

```bash
curl -fsS http://127.0.0.1:16608/
curl -fsS http://127.0.0.1:16608/login
curl -fsS http://127.0.0.1:16608/api/health || true

# backend 容器内直接验证内部 health 和版本配置
COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml exec -T backend \
  sh -lc 'curl -fsS http://127.0.0.1:8000/health'

COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml exec -T backend \
  sh -lc 'python -m alembic current'
```

真实执行时需根据返回结果记录准确路径，不把 `|| true` 的结果当作通过；它只用于兼容不同路由的探测。

### 8.4 PostgreSQL、Redis、Celery 验证

```bash
COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml exec -T postgres \
  sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml exec -T redis redis-cli ping

COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml exec -T pythonlab-worker \
  sh -lc 'celery -A app.celery_app:celery inspect ping --timeout 5'

COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml exec -T typst-worker \
  sh -lc 'celery -A app.celery_app:celery inspect ping --timeout 5'
```

不能仅依据容器为 running 判定 worker 可用；必须看到真实 `pong` 或项目定义的健康结果。

### 8.5 PythonLab sandbox 真实检查

至少验证最终 sandbox 镜像可以启动、用户权限和 debugpy 可用：

```bash
docker run --rm --platform linux/amd64 \
  shuhao07/pythonlab-sandbox:2.0 \
  sh -lc 'id && python -c "import debugpy; print(debugpy.__version__)"'
```

随后运行项目规定的 PythonLab 相关测试或 smoke。重点覆盖本轮修改涉及的 `DockerProvider`、mount path 解析、workspace host mount、debugpy readiness 和 sandbox 生命周期；不能只运行普通静态测试。

### 8.6 前端和网关真实浏览器验证

使用真实 Chromium/Playwright 访问 `http://127.0.0.1:16608`，至少验证：

- 首屏能够加载，不出现白屏。
- `/login` 可打开，静态资源、字体和 JS 资源请求成功。
- 网关将前端请求和 API 路由转发到正确服务。
- 控制台无未处理的启动级 JavaScript 异常。
- 版本信息与 `2.0.0`/`2.0` 的项目约定一致，不暴露密钥。

截图至少保存以下桌面尺寸：

- `1280x800`
- `1440x900`
- `1680x1050`
- `1920x1080`

建议截图目录：`/tmp/wangsh-docker-verify-20260913/screenshots/`。截图应在实际 Docker 网关地址采集，而不是历史 `output/` 或旧 handoff 证据。截图完成后人工打开检查，确认没有白屏、溢出、错误叠层或明显资源失败。

## 九、阶段 5：工程全量门禁

### 9.1 根层和脚本合同

在当前工作树执行：

```bash
node scripts/check-version-consistency.mjs
node scripts/check-version-consistency.mjs --print-image-tag
node --test scripts/workflow-contracts.test.mjs
node --test scripts/markdown-contracts.test.mjs
git diff --check

for script in \
  scripts/deploy.sh scripts/rollback.sh scripts/migrate-db.sh \
  scripts/health-check-detailed.sh scripts/prod-smoke/run.sh \
  start-dev.sh stop-dev.sh
 do
   bash -n "$script"
 done
```

### 9.2 前端门禁

在 `frontend/` 执行，使用项目现有依赖，不重新提交生成物：

```bash
npm run type-check
npm run lint
npm run test
npm run test:scripts
npm run build
npm run token:check:ci
```

若 `npm run build` 或测试重新生成 `build/`、`coverage/`、缓存等，验证完成后按阶段 1 的可恢复移动策略再次整理，不要把这些文件加入 Git。

### 9.3 后端门禁

在 `backend/` 执行，严格遵守 `backend/tests/README.md` 的隔离要求：

- 使用项目规定的合成配置、隔离数据库和受控网络方式。
- 不将全量 pytest 直接指向正常开发/生产数据库。
- 至少运行本轮涉及的 Python governance 检查、`docker.py`/`docker_paths.py` 对应测试、PythonLab sandbox/任务相关测试。
- 在隔离环境允许且依赖完整时运行后端全量 pytest；记录 passed、skipped、xfail、failed 数量。
- 若选择不运行某个专项，必须在 `docs/docker/testing/TEST_STATUS.md` 记录原因，不能把未运行写成通过。

候选检查入口包括：

```bash
python scripts/check_python_governance.py check
python scripts/check_python_governance.py check --base-ref origin/main
pytest -q
```

上述命令不是无条件直接执行许可；实际执行必须先满足测试 README 的隔离前置。对 Docker provider 的测试若需要 Docker socket，明确记录它使用的是哪个隔离 Docker context。

### 9.4 文档同步

由于本计划新增到 `docs/docker/plans/`，提交前至少确认：

- `docs/docker/README.md` 和 `docs/docker/plans/README.md` 是否需要加入入口链接。
- 如果本次只增加执行计划而没有改变部署/CI 契约，可不改 owner 文档；如果实际执行改变了 Docker 发布流程、镜像标签或验证事实，必须同步 `DEPLOY.md`、`CICD.md`、`TEST_STATUS.md` 和必要的 `RELEASE_NOTES.md`。
- 文档合同和 `git diff --check` 通过。

## 十、阶段 6：最终整理与证据归档

### 10.1 停止验证栈

```bash
COMPOSE_PROJECT_NAME=wangsh-verify \
  docker compose --env-file .env -f docker-compose.yml down --remove-orphans
```

禁止 `down -v`。停止后确认没有遗留 WangSh 验证容器；如有 PythonLab 动态 sandbox，按项目 namespace 精确清理并再次确认没有误伤其他容器。

### 10.2 第二轮项目文件整理

- 移走本轮测试产生的 `__pycache__`、`.pytest_cache`、`.ruff_cache`、coverage、build、日志和临时报告。
- 只保留对用户有价值的最终截图/报告于 `/tmp` 或 Codex 可见证据位置；不提交生成物。
- 不整理、不删除 `.env`、`data/`、工具状态和不明静态资源。
- 最终执行：

```bash
git status --short --ignored | sed -n '1,260p'
git diff --stat
git diff --check
docker ps --all
docker image ls --all
```

预期 Git 工作区只包含计划中明确的代码、工作流、治理 baseline、owner 文档和本计划文件。

## 十一、阶段 7：提交并推送 GitHub

### 11.1 提交前审查

```bash
git status --short --branch
git diff --stat
git diff --name-only

git diff -- .github backend docs scripts
sed -n '1,260p' backend/app/core/sandbox/docker_paths.py
```

确认：

- 没有 `.env`、密码、token、Cookie、coverage、build、截图、日志或临时归档进入 Git。
- 新增 `docker_paths.py` 已被 `docker.py` 正确导入，测试和 governance baseline 与实现一致。
- 文档中的测试结果、版本号、镜像标签、服务名和日期与真实执行结果一致。

### 11.2 暂存与提交

只暂存经过审查的本次交付文件，不使用 `git add -A` 盲目加入 ignored/untracked 文件：

```bash
git add \
  .github/workflows/ci-quality.yml \
  .github/workflows/dockerhub-amd64.yml \
  .github/workflows/pythonlab-pr-runtime.yml \
  backend/app/core/sandbox/docker.py \
  backend/app/core/sandbox/docker_paths.py \
  backend/scripts/python-governance-baseline.json \
  docs/README.md \
  docs/docker/README.md \
  docs/docker/RELEASE_NOTES.md \
  docs/docker/deploy/CICD.md \
  docs/docker/plans/README.md \
  docs/docker/plans/2026-09-09-release-readiness-gap.md \
  docs/docker/plans/2026-09-13-docker-clean-build-verify-release-plan.md \
  docs/docker/testing/TEST_STATUS.md \
  scripts/check-version-consistency.mjs \
  scripts/workflow-contracts.test.mjs

git diff --cached --check
git diff --cached --stat
git diff --cached --name-status
```

提交消息建议使用能覆盖本轮真实内容的说明，例如：

```bash
git commit -m "fix: close release readiness and Docker verification gaps"
```

如果审查发现本计划文件不应与业务修复同一提交，可拆分提交，但不得把当前改动丢弃或重写。

### 11.3 推送 GitHub

```bash
git fetch origin

git rev-parse HEAD
git rev-parse origin/release/v1.6.0-audit-fixes

git push origin release/v1.6.0-audit-fixes

git status --short --branch
```

若远端分支在执行期间有新提交，停止，不强推；先让用户或负责人决定合并/变基策略。推送后记录提交 SHA。

## 十二、阶段 8：Docker Hub 最终镜像发布

### 12.1 发布前条件

必须全部满足后才能推送：

- GitHub 当前分支已成功推送，且记录了最终 commit SHA。
- 6 个本地镜像已经通过真实 Compose 运行验证。
- 6 个镜像均为 `linux/amd64`，没有遗漏。
- Docker Hub credential helper/登录状态可用。
- namespace 和 repository 已从当前项目配置确认：`shuhao07` + 6 个 repository。
- 不把未验证的 `latest` 当作默认发布目标。项目工作流的 `push_latest` 默认是 `false`，因此安全默认是先发布明确版本标签 `2.0`；是否覆盖 `latest` 必须由执行负责人明确决定并记录。

### 12.2 已验证本地镜像的两阶段推送策略

为避免重新构建出一套未经本轮 Compose 和浏览器验收的镜像，本阶段**禁止再次执行
`docker buildx build` 或 `docker compose build`**。只允许使用阶段 3 已记录的 6 个本地
Image ID，先添加唯一 staging tag、直接推送，再在远端完整核验后 promote：

```bash
SOURCE_VERSION="2.0.0"
IMAGE_TAG="2.0"
COMMIT_SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
STAGING_TAG="${IMAGE_TAG}-verified-${SHORT_SHA}-20260913"
```

发布前把阶段 3 记录的 Image ID 固化为只读映射，并逐项确认 tag 当前仍指向该 ID：

```bash
cat > /tmp/wangsh-docker-verify-20260913/verified-images.tsv <<'EOF'
wangsh-backend	sha256:5a265cfbdf2eeaea68a145e869a094de573838d889ab95b3365d5d7030dd99e1
wangsh-typst-worker	sha256:f12d02aeed23070f9aa78851a5049fe614b1fa08486eb92ef0dac4f24adf8f03
wangsh-pythonlab-worker	sha256:b3fa14fbcf215802134827ee94f5cb7f4ebc6bce5445773a029c80af7f2647fa
pythonlab-sandbox	sha256:7b1e46394a9bde06b02e54cf74e4c7dd85ecf5daeab41634df22375c05bb4f58
wangsh-frontend	sha256:c68547902e9414a99b20f8d6c5c39bc3b34af93c09b145b0dfa4d11bbfb6a147
wangsh-gateway	sha256:781865985a68ae1c874ddde57c5934da08340aeab4e01b25109ed2fd4ad18c0b
EOF
```

使用现有 Docker Hub 登录状态，不在命令中写明文 token。若 inspect 或 push 返回未授权，
立即停止，不猜测账号或 token：

```bash
docker buildx imagetools inspect docker.io/shuhao07/wangsh-backend:2.0 || true
```

给**已验证 Image ID**添加 staging tag 并直接推送：

```bash
while IFS=$'\t' read -r image image_id; do
  current_id="$(docker image inspect "shuhao07/${image}:${IMAGE_TAG}" --format '{{.Id}}')"
  test "$current_id" = "$image_id"
  docker tag "$image_id" "docker.io/shuhao07/${image}:${STAGING_TAG}"
  docker push "docker.io/shuhao07/${image}:${STAGING_TAG}"
done < /tmp/wangsh-docker-verify-20260913/verified-images.tsv
```

每个 staging push 完成后，逐项检查 manifest、平台和 digest，并写入证据目录：

```bash
: > /tmp/wangsh-docker-verify-20260913/staging-manifests.txt
while IFS=$'\t' read -r image image_id; do
  docker buildx imagetools inspect \
    "docker.io/shuhao07/${image}:${STAGING_TAG}" \
    | tee -a /tmp/wangsh-docker-verify-20260913/staging-manifests.txt
done < /tmp/wangsh-docker-verify-20260913/verified-images.tsv
```

只有 6 个 staging manifest 全部存在、架构均为 `linux/amd64`、digest 可记录后，才 promote
到版本 tag；默认不更新 `latest`：

```bash
while IFS=$'\t' read -r image image_id; do
  docker buildx imagetools create \
    --tag "docker.io/shuhao07/${image}:${IMAGE_TAG}" \
    "docker.io/shuhao07/${image}:${STAGING_TAG}"
done < /tmp/wangsh-docker-verify-20260913/verified-images.tsv
```

最终发布台账必须记录 `COMMIT_SHA`、6 个本地 Image ID、staging digest 与正式 tag digest
的对应关系。若负责人以后明确要求同步 `latest`，必须在版本 tag 全部完成且 digest 校验通过后
另行 promote；本轮默认不覆盖 `latest`。

### 12.3 Docker Hub 远端验收

```bash
for image in \
  wangsh-backend wangsh-typst-worker wangsh-pythonlab-worker \
  pythonlab-sandbox wangsh-frontend wangsh-gateway
 do
   docker buildx imagetools inspect \
     "docker.io/shuhao07/${image}:2.0"
done
```

记录 6 个最终 tag 的 digest、平台和发布时间到 `/tmp/wangsh-docker-verify-20260913/`。不得把含凭据的 Docker config、token 或完整私有日志复制到项目。

## 十三、失败处理与停止条件

出现以下任一情况，立即停止当前阶段，只报告证据和下一步，不伪造“已完成”：

- 上一轮 build 仍在运行但结果未知。
- Compose config 无法渲染，尤其是缺少必需 secret、external network 或 image tag 不一致。
- 生产栈容器持续重启、数据库迁移失败、worker 无法 ping、sandbox 无法启动或网关返回错误。
- 测试失败、测试连接到非隔离数据库、Playwright 截图出现白屏/资源错误。
- Git diff 出现非本任务来源的用户改动、敏感文件或大量生成物。
- 远端 Git 分支已前进，无法普通 fast-forward。
- Docker Hub 登录失败、repository 不存在、push 返回 unauthorized/denied、staging release-set 不完整。
- 任何步骤需要 `git reset`、强推、删除 volume、删除未知镜像或覆盖 `latest`，但没有额外明确授权。

## 十四、最终交付清单

完成时必须给出以下可核验结果，而不是只说“已完成”：

- [ ] 项目垃圾文件清理范围、临时归档路径和回收大小。
- [ ] Docker dangling 镜像清理前后数量和回收大小。
- [ ] 6 个镜像的本地 tag、架构、image ID/ digest。
- [ ] Compose 生产栈每个服务的最终状态和健康结果。
- [ ] backend、frontend、脚本合同、文档合同的测试命令与通过/跳过/失败数量。
- [ ] PythonLab sandbox/worker 的真实 Docker 验证结果。
- [ ] 4 个桌面尺寸的真实浏览器截图路径，并说明人工检查结果。
- [ ] 最终 Git commit SHA、分支和 GitHub push 结果。
- [ ] Docker Hub 6 个最终镜像的 tag、manifest 平台和 digest。
- [ ] 任何未执行项、阻断项、未覆盖风险和后续建议。

本计划的核心原则：**不以历史截图、旧镜像 tag、通过测试或“容器 running”替代当前工作树上的真实 Docker 运行证据；不以推送成功替代远端 digest 验收；不以清理数量替代可恢复性和数据安全。**
