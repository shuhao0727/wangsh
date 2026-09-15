# 部署指南

> 最后更新：2026-09-14

---

## 第二阶段未发布候选的发布前置（2026-09-14）

本批已完成第一批无网络门禁后的隔离 PostgreSQL、R3 服务层、Excel/WPS 往返与候选依赖
验证，但仍不得按“已生产发布”处理；没有执行服务重启、镜像构建/推送、正常数据库迁移或
真实数据修复，也不能据此宣称全部漏洞已经关闭。

### 依赖与请求入口

- `backend/requirements.txt` 已将候选 `python-multipart` 固定为 `0.0.32`。该版本已从仓库外
  隔离候选目录加载并通过上传/导入回归，但正式本地 venv 仍为 `0.0.22`，候选及生产镜像均
  未升级或重建。发布前仍需在正式候选镜像中确认实际安装版本并复跑入口回归，再生成
  release-set。
- 应用新增的 ASGI 请求预算发生在表单解析前，但它**不替代** Caddy/上游网关的原始请求头
  和请求体限制，也不提供入口限速、连接/任务并发治理或 multipart 解析 CPU 抢占控制。生产
  方案仍需独立核对网关限制、超时、限速、并发和可观测性。

### XBK 候选迁移与回导边界

- `20260914_0001_xbk_active_selection_unique` 已在回环端口、唯一数据库与唯一 schema 的
  一次性 PostgreSQL 16 容器中完成 upgrade → downgrade → upgrade、历史有效重复阻断、
  真实 asyncpg 约束识别和最后一个名额并发竞争验证。验证后一次性容器、卷和环境文件均已
  清理；过程未连接或迁移 `127.0.0.1:5432`、`wangsh-postgres:5433` 等正常数据库。
- 迁移会取得 `xbk_selections` 的 `SHARE ROW EXCLUSIVE` 锁，并在发现活跃重复时阻断，
  不会自动清理历史数据。生产发布仍必须先只读预检重复和 schema 状态，完成可恢复备份，
  停止并排空所有旧版选课 writer，在批准的维护窗口中执行审核过的目标 revision。一次性
  PostgreSQL 通过不构成正常数据库迁移授权。
- Alembic 兼容逻辑在非默认 `search_path` 下仍需专项验证：版本表存在性检查固定指向
  `public.alembic_version`，而未限定 schema 的 `CREATE TABLE`/`ALTER TABLE alembic_version`
  会跟随当前 `search_path`，可能触发 `DuplicateTableError`。XBK 最新 migration 的索引名已改为
  静态字面量，静态迁移门禁已通过；但自定义 schema 或多租户迁移前仍必须完成真实专项回放。
- R3 已接入管理员 multipart HTTP 预览/确认路由：`POST /xbk/import/preview` 与
  `POST /xbk/import/confirm`。预览使用服务器端期望值和签名 token，确认时重新核验完整有效
  学生集合、课程集合、选课基线与容量，并通过统一事务裁决整批应用。该链路已在一次性生产
  等价栈由真实产品 UI 上传/确认验证；仍不得据此宣称已部署生产或已处理真实业务数据。
- Excel 与 WPS 均已真实打开、保存、关闭并重新解析工作簿，班级页验证、保护、可编辑填写区
  和 `veryHidden` 元数据页保持。Excel 会把标准数据验证转换为 `x14:dataValidations` 扩展；
  openpyxl 对该扩展会发出不支持警告，因此不得再用 openpyxl 保存 Excel 往返成品，以免移除
  验证规则。真实客户端往返通过仍不替代正常数据库回导验收。

### AUTH 与点名上线检查

- 超级管理员启动初始化只创建完全缺失的配置账号；若用户名已存在，不会在重启时重置
  密码、提升角色或重新激活。发布前必须确认已有配置账号状态符合预期，不能依赖重启修复账号。
- 账号停用/删除/恢复/降权依赖 AUTH authority ready gate 和同事务持久撤销。发布前仍需在
  候选栈核对 migration/enrollment 状态及真实 login/refresh/logout 交错，不得绕过 ready gate。
- 教师—点名班级授权数据源尚未建立，当前教师读取会安全返回 `403`。这是候选的保守行为，
  不是教师功能已经完整交付；若要开放教师使用，必须先设计可撤销的授权关系及迁移。

## 发布验收报告最低字段（发布准入）

每次候选发布、数据库迁移或回滚验收必须生成可回放报告，并至少包含：

- 目标环境标识、执行时间、责任人、源码 commit、镜像 tag/digest 与 release-set；
- 数据库标识、`current_schema`、database/role `search_path`、迁移前 revision、目标 revision；
- 预期/实际表、索引、约束与 schema 归属；
- upgrade、downgrade、re-upgrade（或明确的备份恢复回滚）结果及完整命令；
- 备份任务/文件标识、保存位置与隔离恢复验证证据；
- 点名教师 `403`、XBK 唯一性/容量、健康检查、错误合同和前端切换结果；
- 未执行项、阻断项、风险接受人和发布结论。

动态结果统一写入 `docs/docker/testing/TEST_STATUS.md`；本页只维护发布步骤与准入条件。

## 隔离生产镜像模拟的安全边界

本地模拟使用独立 project/标签、回环监听端口、专用空库/Redis/命名卷与合成账号，不复用开发栈或生产凭据。需要复现实测时，先按当前源码构建并保存 Dockerfile/context SHA、构建日志及镜像 ID，再核对运行容器的实际 image ID；基础层缓存命中可以接受，旧业务镜像改标签不算新源码构建。基础镜像网络失败保留原始日志，仅有限重试。

空库按本文既有 bootstrap legacy baseline → Alembic → compatibility bootstrap 流程执行，不称为纯 Alembic 从零建库。模拟前后保存资源清单，以本批 exact ID 清理，不运行针对其他批次的清理脚本或全局 prune。Docker socket、正常业务卷和真实名册不挂载到此类最小应用模拟中；因此它不能替代 PythonLab worker/沙箱压力或生产数据恢复验收。动态构建与运行结果只见 [TEST_STATUS](../testing/TEST_STATUS.md)。

认证上线还须考虑 `logout` 撤销失败的 `503` 响应与客户端提示、登录 issuance 被并发替换的 `409`，不能让网关把失败转换成成功。数据库提交后的 Redis 发布错误不具备跨存储回滚能力；旧 refresh/TTL/代理和迁移策略未因本地镜像构建自动验收。

## 未发布 AUTH 持久权威的受控切换前提（2026-09-10）

本节是 R5 新 AUTH 变更的部署前置约束，覆盖下方历史“本批无 migration”对 AUTH 的描述；**不是生产执行授权或发布验收结论**。本轮只允许合成专库演练，正常业务库与开发入口没有执行这项切换。

- 新增 revision `20260910_0001_auth_authority`，父 revision 为 `20260908_0001_xbk_academic_year`。升级前先核对实际 Alembic head、已有 schema 和父迁移影响；不能为了启用 AUTH 对正常库直接运行 `upgrade head`，也不能用 `create_all` 代替正式迁移。新增 `auth_authority` 与 `auth_session_states`，具体字段以 migration/模型和 [AUTH](../../features/AUTH.md) 为准。
- migration 将权威 gate 初始化为 `ready=False`。表存在不代表切换完成；新认证受保护路径与变更入口在未 ready 时拒绝服务，不允许启动时自动置 ready、逐请求懒接管或因缓存缺失放行。
- 切换必须先停止并排空旧认证 writer 和可能改变身份/会话证据的在途请求，冻结用户写入与对应 Redis 会话证据，确认所有合作 writer 将统一升级。计划中的布尔声明不是实际停流证明，必须保存停止、排空与成对快照记录。受控维护文件为 `backend/app/api/endpoints/auth/cutover.py`，直接运行文件而不是 `python -m`，不是公开 HTTP 接口或启动钩子；内部调用 `bootstrap_durable_auth_authority`。默认 dry-run 回滚，显式受保护 JSON 计划与 `--confirm-database` 精确确认；只有审阅后另加 `--apply` 才提交。完整计划及命令模板以 AUTH owner 为准。
- enrollment 在单个数据库事务内建立存量会话/撤销依据并提交 ready gate。可信证据可保留既有 nonce/legacy refresh；缺失或冲突的仍有效旧凭据证据必须中止，不得通过全量撤销或无条件 ready 刷过迁移。明确需要重新认证的用户必须另行确认范围，不擅改 legacy、TTL 或同 IP 政策。
- enrollment 在锁定的数据库事务中读取 Redis 会话与 IP binding 的值/PTTL；跨快照稳定性依赖实际停写。持久 `ip_expires_at` 只保存现有同 IP 租约剩余期限，不延长 TTL；过期租约不再占用 IP，inactive tombstone 不能随租约清理。维护输出计数并不替代逐用户 preserved/revoked 审计，应在受控环境记录切换前后用户明细，避免输出凭据。
- DB 提交与 Redis 发布仍非分布式原子事务。新合同以持久权威拒绝已撤销身份，发布失败返回失败但不承诺回滚已提交的撤销；提交 ACK 丢失也不能解释为数据库未写入。监控和重试应先核对权威状态，不能恢复旧缓存就恢复旧权限。
- 禁止混跑旧 writer 或直接降版：旧版本不认识持久 tombstone，可能重新放行旧凭据。downgrade 会删除安全证据，必须先停认证流量、处理全部未到期凭据并完成另行批准的回退方案和备份验证。不要定时清理 tombstone 来模拟 Redis TTL。
- 仍需新镜像/受控切换演练与真实调用方整合；PythonLab 本轮冻结后端不自动继承新 AUTH。发布状态和失败历史仅见 [TEST_STATUS](../testing/TEST_STATUS.md)，不以单项 PG 通过代替正常环境切换或生产验收。

## 未发布并发修复的部署前提（2026-09-09）

- 本批测评/XBK锁与认证、PythonLab代码修复没有新增数据库 migration，也没有执行生产部署。此前获授权的本地 XBK 指定学年迁移不能据此重跑或扩为 upgrade head。
- 测评按配置/用户事务互斥、XBK父子锁协议要求合作入口统一升级；默认 READ COMMITTED 已在专用 PostgreSQL 验证，其他隔离级别、混版本 worker 或直写 SQL 不属于保证。上线前评估 AI 长事务和导入持锁的连接池/等待影响。
- PythonLab 所有资源 writer 必须访问同一可信 ownership 目录及相同锁 inode，且底层共享文件系统真实支持 flock。仅“挂载路径同名”不足。journal 不得进入学生 `/workspace` 挂载，不得清理 lock inode 来解锁；跨主机、不同卷和旧版 writer 尚未验收。
- 升降版本须先停止接受新沙箱创建，等待或安全处理在途任务，盘点旧无 token 容器及 creating/live/deleting/removed journal。未知归属保守保留，不能按同名批量删容器；回滚旧版会失去 generation/fence 保护，不允许直接混跑后声称兼容。
- 启动 writer 已采用 Redis 原值 Lua CAS，READY 发布不确定时先核对世代再补偿；无可信 live journal 的 legacy 容器不再自动接管。Redis 无法核对、FAILED 提交 ACK 丢失、删除失败或其他旧 writer 盲写仍有保守保留/状态风险。发布前必须做真实 worker 崩溃恢复、共享 inode 和混版本演练，不能把专用 Redis/Docker 定向实例当作这些门禁已通过。
- 沙箱 CAS 要求 Redis 支持并授权 `EVAL` 及脚本内 GET/SET；DAP 断连清理还需脚本内 DEL 与 SET KEEPTTL（Redis 6.0+），在同一原子上下文中比较元信息和连接租约，缺失能力时保守失败而不盲写；认证旧 IP owner 条件旋转要求同一 Redis 原子上下文中的 `WATCH`、`MGET`、`MULTI`、`SET`、`EXEC` 及清理事务权限。应用账号 ACL 必须受控验证，不能通过扩大到全权限来规避失败。多 key 的 Redis Cluster slot、Sentinel 故障切换及 TLS/代理部署未由本批证明。
- 存量 terminal/DAP WS 和管理/课堂 SSE 增加周期/逐帧会话检查，部署时评估 Redis 请求量、连接数与背压；不是每秒必定断开的网络 SLA，也不补足 AUTH-01 双存储原子撤销。DB 提交失败仍可留下有效 refresh；Redis 写失败仍可留下旧 access，禁止据此宣布安全发布完成。


## 📑 目录

- [服务器信息](#服务器信息)
- [快速开始](#快速开始)
  - [开发环境](#开发环境)
  - [生产环境](#生产环境)
- [版本管理](#版本管理)
- [开发 vs 生产模式对比](#开发-vs-生产模式对比)
- [镜像构建流程](#镜像构建流程)
- [常用部署命令](#常用部署命令)
- [服务说明](#服务说明)
  - [核心服务](#核心服务)
  - [Worker 服务](#worker-服务)
  - [可选服务](#可选服务)
- [环境变量配置](#环境变量配置)
- [常见问题](#常见问题)
- [数据库迁移策略](#数据库迁移策略)
- [回滚流程](#回滚流程)
- [数据备份与恢复](#数据备份与恢复)

---

## 服务器信息

- **域名**: wangsh.cn
- **SSH 端口**: 6607
- **用户**: shuhao
- **当前发布候选版本**: 2.1.0（Docker 镜像标签 `2.1`）

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

**本地开发数据库**：

- 本机 Homebrew PostgreSQL（`127.0.0.1:5432`）是标准开发库，日常开发直接连接它。
- Docker dev 栈内的数据库通过 Compose 服务名 `postgres:5432` 访问（容器内）；
  宿主机访问 Docker 栈数据库使用 `127.0.0.1:5433`（dev 栈已把 5432 让给本机 PG，
  避免端口冲突）。
- 两个库数据不互通，迁移需各自验证：

```bash
# 本机 Homebrew PG（标准开发库）
psql -h 127.0.0.1 -p 5432 -U admin -d wangsh_db

# Docker dev 栈 PG（宿主机入口）
psql -h 127.0.0.1 -p 5433 -U admin -d wangsh_db
```

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
APP_VERSION=2.1.0
IMAGE_TAG=2.1
REACT_APP_VERSION=2.1.0
IMAGE_REPOSITORY_PREFIX=shuhao07
```

`frontend/package.json` 的 `version` 是完整版本号（如 `2.1.0`）的权威源；
`IMAGE_TAG` 使用同源的 major.minor（如 `2.1`）。`check-version-consistency.mjs`
按这两套口径分别校验，两者必须同源一致。 `verify-release-set` 同样按这一区分校验：
release-set 和 `IMAGE_TAG` 必须等于派生出的 major.minor 标签，`APP_VERSION`、`VERSION`（如配置）
和 `REACT_APP_VERSION` 必须等于完整应用版本，不能把 `2.1.0` 与镜像标签 `2.1` 错判为漂移。

当前版本更新仍是显式同步，不会自动改写其他文件。至少需要同步
`.env.example`、`frontend/package.json` 和 `frontend/package-lock.json`。

首页和后台布局的版本/环境标签由前端构建时的 `REACT_APP_VERSION` /
`REACT_APP_ENV` 提供，不通过 `/system/overview` 或 `/system/settings` 查询。
版本未注入、为空或为 `unknown` 时显示 `–`，不回退读取服务器设置。
因此只修改后端版本或容器运行时环境不会更新已生成的静态页面，需重新构建前端镜像；
验收时应核对镜像来源、实际页面版本与构建注入值。系统接口的超级管理员权限不变。

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
- `shuhao07/wangsh-backend:2.1` - 后端 FastAPI 服务
- `shuhao07/wangsh-frontend:2.1` - 前端静态文件
- `shuhao07/wangsh-gateway:2.1` - Caddy 网关
- `shuhao07/wangsh-typst-worker:2.1` - Typst PDF 编译 worker
- `shuhao07/wangsh-pythonlab-worker:2.1` - PythonLab 调试 worker
- `shuhao07/pythonlab-sandbox:2.1` - PythonLab 沙箱镜像

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
SIM_VERSION=2.1
SIM_IMAGE_REPOSITORY_PREFIX=shuhao07
SIM_WEB_PORT=16608
SIM_RUN_PROD_SMOKE=false
SIM_CLEANUP=false
```

`simulate` 是本地生产镜像验证入口，不消费 `release-set.txt`。一次性隔离数据库在迁移与
健康检查后会自动完成合成 AUTH authority enrollment，并用独立 session 核验 `ready=true`，
然后才运行需要登录的 smoke；这不适用于正式数据库，正式切换仍必须执行本页前述
`auth/cutover.py` 停流、排空、配对快照与显式 apply 流程。脚本会先确认 Compose
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
APP_VERSION=2.1.0
IMAGE_TAG=2.1
REACT_APP_VERSION=2.1.0
IMAGE_REPOSITORY_PREFIX=shuhao07

# 将发布 workflow 生成的 release-set.txt 放到仓库根目录。
# 也可通过 RELEASE_SET_FILE=/secure/path/release-set.txt 指定位置。

# 先独立验证版本、六镜像集合、Compose 引用和 registry digest
bash scripts/deploy.sh verify-release-set release-set.txt

# 再拉取并启动，不在生产服务器重新构建。deploy 只拉六个业务镜像，
# 复核本地 RepoDigest，并等待详细健康检查通过。
bash scripts/deploy.sh deploy

# 可重复查看 deploy 使用的同一份详细健康状态
./scripts/health-check-detailed.sh
docker compose ps
```

详细健康检查要求首页可访问、API 返回 HTTP 2xx 且顶层唯一
`status` 为 `healthy`，并检查 PostgreSQL、Redis、frontend、gateway 和两个 worker。
宿主机需要 Bash、Docker CLI、curl 和基础 Unix 工具；API JSON 由已运行的 backend
容器内 Python 标准库从 stdin 校验，不要求宿主机安装 Python。

正式发布不会拉取或隐式更新 `postgres`、`redis`。这两个基础设施镜像必须由运维侧提前
准备和升级；缺少本地镜像时，`--pull never` 会阻止启动，不能用一次普通发布顺带更新
数据库或缓存运行时。

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
| `bash scripts/deploy.sh verify-release-set <文件>` | 拉取前校验版本、Compose 引用和远端 manifest digest |
| `bash scripts/deploy.sh deploy` | 验证远端清单，只拉六个业务镜像，复核本地 RepoDigest，以 `--pull never` 启动并等待详细健康门禁 |
| `bash scripts/deploy.sh up-no-build` | 远端清单与本地 RepoDigest 均一致时才使用已有镜像启动，禁止隐式拉取 |
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
APP_VERSION=2.1.0          # 应用版本号
IMAGE_TAG=2.1              # Docker 镜像标签（major.minor，与 package.json 同源）
REACT_APP_VERSION=2.1.0    # 前端版本号
IMAGE_REPOSITORY_PREFIX=shuhao07  # Docker Hub 镜像命名空间
```

### 安全配置（生产环境必须修改）
```bash
SECRET_KEY=...                        # 后端密钥
SUPER_ADMIN_PASSWORD=...              # 管理员密码
POSTGRES_PASSWORD=...                 # 数据库密码
AGENT_API_KEY_ENCRYPTION_KEY=...     # 智能体 API 密钥加密
AI_AGENT_MAX_OUTPUT_TOKENS=8192      # Anthropic 兼容接口单次回答上限
AUTH_TRUSTED_PROXY_CIDRS=...         # 可信反代网段（CIDR 逗号分隔）；为空=不信任任何转发头
                                      # 生产必须按网关容器/主机网段配置，禁止 0.0.0.0/0
```

### 功能开关
```bash
DEBUG=false                  # 生产环境必须为 false
BACKEND_RELOAD=false         # 生产环境必须为 false
SSE_REDIS_PUBSUB_ENABLED=true # 多 worker SSE 必须开启并保证 Redis 可用
IT_GAME_MAX_UPLOAD_BYTES=524288000 # IT 游戏安装包上传上限（字节）
```

### 业务时区

```bash
TIMEZONE=Asia/Shanghai
```

`TIMEZONE` 是后端业务日期计算的唯一配置；生产和开发 Compose 会把同一值同时传给
backend、Typst worker、PythonLab worker 的 `TIMEZONE` 和容器 `TZ`。开发 PostgreSQL
还会同步设置 `TZ`、`PGTZ` 和服务器 `timezone`。不要只覆盖 `TZ`，否则容器本地时间
可能变化，但应用 `settings.TIMEZONE` 仍会使用另一时区。

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
- `TIMEZONE=Asia/Shanghai` 同时驱动应用业务时区和 Compose 容器时区。
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

### 5. Mindmap 本地运行时边界

`frontend/public/mindmap-demo/` 只保留在开发机，不进入 Git 或生产 Docker 构建上下文。
Vite 开发服务器仍可读取本地目录；普通生产构建即使先复制了 `public/`，结束时也会删除
`build/mindmap-demo`。因此全新 checkout 和当前生产镜像不包含旧 Mindmap 编辑器；
数据库中的导图数据仍保留，但依赖该运行时的编辑、预览和独立窗口入口在生产端不可用。

生产 Caddy 对 `/mindmap-demo` 及其子路径明确返回
`404 + Cache-Control: no-store`，不能进入 SPA fallback。不要把本地目录临时复制进
发布镜像；恢复该能力前，应先建立有固定版本、来源校验和许可说明的可复现生成、下载或
独立镜像流程。

### 6. Typst PDF 渲染失败

确保 `typst-worker` 服务正常运行，且字体文件已正确挂载

```bash
docker compose ps typst-worker
docker compose exec -T typst-worker typst --version
```

### 7. 数据库连接失败

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

### XBK 整数学年库与热加载代码不匹配

`20260908_0001_xbk_academic_year` 的父版本为
`20260817_0001_query_filter_indexes`。前端/API 采用规范字符串学年后，旧库三个
XBK 表的整数 `year` 会导致查询失败；开发栈的 `uvicorn --reload` 不会代替 Alembic
执行此迁移。不能因其他隔离测试通过就认定正在使用的本地库已升级。

处理顺序：确认连接的是目标本地/生产栈，运行只读迁移预检，检查三个表的列类型、
待迁移年份范围及依赖对象；经授权建立停写窗口并完成可恢复备份后，只升级到审核过的
目标 revision。此迁移改变三表列类型并可能等待表锁，不应在未确认的数据操作窗口
直接运行 `upgrade head` 或裸 SQL。先在隔离库预演升级和降级；降级只保留起始年份，
不能与仍使用字符串学年的新版应用配套运行，回退时需同步恢复兼容应用版本。

该迁移不会把 `term="1"` 改成 `上学期`，也不会恢复、重导或合并名册。升级后应使用
同一学年/学期检查 `analysis/summary`、`data/meta`、`data/course-results` 的 HTTP
响应及真实页面，而不只查看 `/health`。实际执行与未执行边界只维护于
[TEST_STATUS](../testing/TEST_STATUS.md)。

备份验收须在隔离 PostgreSQL 实际恢复，比较完整 schema、逐表内容摘要、序列与关联，
不能以目录清单替代恢复。跨实例计算 timestamptz 内容摘要时，在各校验连接显式设置
相同会话时区；仅传 PGOPTIONS 可能仍被客户端 PGTZ 覆盖，应读取当前时区核实。
备份应保留在受限权限的仓库外目录，日志只保留聚合与摘要，不输出凭据或名册明细。

当前 Alembic env 会先独立提交版本表容量兼容 DDL，再进入目标迁移事务；失败时不能
声称所有 DDL 一起回滚。超时须显式传入其新建 asyncpg 连接并读取实际设置，不能把
应用连接或另一 psql 会话的超时当作迁移超时；前置探针不得留下隐式事务。最后须以
独立连接确认目标 revision 与三表结构同时持久化。整库备份不涵盖 Redis、上传文件，
迁移后的新写入仍需要单独的恢复边界和配套代码回退方案。

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

`check_migration_state.py` 是只读检查，不会修改数据库。revision 图由 AST 静态读取，不执行迁移模块；缺失父节点、重复与循环会拒绝。目录读取使用只读 REPEATABLE READ 快照，不替代随后升级的并发 DDL 控制。

对 `20260430_migrate_dev_schema` 中已审核的索引存在性 guard，仅完整 migration AST 指纹及 `pg_get_indexdef` 等目录证据均匹配时允许跳过已有等价索引；要求 public 中唯一同名、目标表及完整定义一致、普通索引且 valid/ready/live。跨 schema 同名、异结构、缺少证据或未知动态 guard 保守阻断。代码改变须重新人工审核，不通过自动重算指纹放行。其他未审核历史 guard 仍可能阻断中间版本；这不是全部版本可升级的保证，也没有执行完整目标库升级。实际证据范围见 [TEST_STATUS](../testing/TEST_STATUS.md)。

PythonLab 更新后，旧运行容器若缺少模式标签或资源/镜像/网络配置不兼容，将拒绝复用而不是自动强拆。请在专用环境完成终止、资源归属与 DAP 路径验收后再安排切换；启动 CAS 的覆盖范围和可能孤儿资源的边界见 [PYTHONLAB](../../features/PYTHONLAB.md#沙箱启动恢复与资源归属边界2026-09-09)。

它用于阻断以下危险状态：

- `alembic_version` 缺失或为空，但 public schema 已经有业务表。
- 当前 Alembic 版本不是代码中 head 的祖先。
- 当前版本落后，但待执行迁移要创建的表、索引或列已经存在。

如果检查失败，不要删除已有表，也不要直接重跑迁移。先备份数据库，再对照待执行迁移确认真实表、列、索引、约束是否完整；只有在确认真实 schema 已等价于目标迁移后，才允许手动补齐缺失索引/约束并 `alembic stamp <verified_revision>`。

`bootstrap_db.py --initial-only` 只用于真正空库的首次初始化：它仅创建受维护迁移链之前的 legacy baseline，并以 `VARCHAR(64)` 创建空的 `alembic_version`，不会 stamp。创建前会从独立 metadata 副本排除迁移管理的索引（包括迁移原生 SQL 定义），由所属 migration 按依赖顺序创建扩展和索引；不得在 bootstrap 中临时建扩展或先建再删这些索引。 XBK baseline 副本使用迁移前的整数年份，并排除后续学年检查约束；原 migration 负责转换到 `VARCHAR(9)` 并建立约束，不能把当前 ORM 字段形态提前当作旧基线。失败后已提交 baseline 的专用模拟库不能再次当成空库；保留诊断并使用新的专用空库重验，不绕过非空保护。随后必须执行完整 `alembic upgrade head`，再由普通 `bootstrap_db.py` 补兼容字段和视图。不要在全新空库上绕过 bootstrap 直接执行 Alembic；历史 revision 中存在超过 32 字符的标识。对于已有标准 `VARCHAR(32)` 版本表的历史库，Alembic online 环境会在迁移事务前幂等扩容为 `VARCHAR(64)`。已有业务表但缺失 `alembic_version` 的数据库仍会被拒绝，避免把历史库误标记为最新。

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
# 1. 使用统一回滚入口；要求输入 yes；
#    默认先停止数据库写服务建立无写入窗口，再备份并回退一个 Alembic revision；
#    --image-tag 指定旧版本镜像执行 downgrade，脚本会先断言旧镜像包含目标 revision
OLD_VERSION=1.5.10
bash scripts/rollback.sh rollback -1 --image-tag "${OLD_VERSION}"

# 2. 回滚完成后 backend 和两个 worker 保持停止；
#    取出发布时归档的旧版本 release-set，并先独立验证
OLD_RELEASE_SET=/secure/releases/release-set-${OLD_VERSION}.txt
IMAGE_TAG=${OLD_VERSION} APP_VERSION=${OLD_VERSION} REACT_APP_VERSION=${OLD_VERSION} \
  PYTHONLAB_SANDBOX_IMAGE=shuhao07/pythonlab-sandbox:${OLD_VERSION} \
  RELEASE_SET_FILE=${OLD_RELEASE_SET} \
  bash scripts/deploy.sh verify-release-set "${OLD_RELEASE_SET}"

# 3. 使用同一份旧 release-set 拉取并启动旧版本
IMAGE_TAG=${OLD_VERSION} APP_VERSION=${OLD_VERSION} REACT_APP_VERSION=${OLD_VERSION} \
  PYTHONLAB_SANDBOX_IMAGE=shuhao07/pythonlab-sandbox:${OLD_VERSION} \
  RELEASE_SET_FILE=${OLD_RELEASE_SET} \
  bash scripts/deploy.sh pull-up "${OLD_RELEASE_SET}"

# 4. 验证全部服务
./scripts/health-check-detailed.sh
```

每次正式发布都必须把 `release-set.txt` 按版本归档到安全位置。只覆盖
`IMAGE_TAG`/`APP_VERSION` 而继续使用当前版本的 release-set 会被门禁拒绝，这是预期
行为；`VERSION`、`REACT_APP_VERSION` 如已设置也必须完全一致，不能通过跳过校验规避。
回滚脚本通过一次性 backend 容器执行 Alembic downgrade，不要求新版 backend 保持
运行。默认流程先记录原本运行的写服务，再停止 `backend`、`typst-worker` 和
`pythonlab-worker` 建立数据库无写入窗口，之后才执行备份和 downgrade。停止或备份
失败时脚本绝不 downgrade，并只重启停止前原本运行的写服务；恢复成功时返回原操作
失败状态，恢复失败时返回恢复失败状态并明确提示人工处理。downgrade 成功或失败后
写服务都保持停止，应先排查数据库状态或部署旧 release-set，并通过详细健康检查后
再开放流量。

downgrade 必须使用**旧版本镜像**执行：通过 `--image-tag <旧版本>` 指定（默认沿用
compose/`IMAGE_TAG` 解析出的镜像）。执行前脚本会先断言旧镜像包含目标 revision
（`docker run --rm <旧镜像> alembic history`），缺失即报错并提示用
`scripts/deploy.sh restore-db` 从备份恢复，绝不继续 downgrade；相对值 `-1`/`-N` 会
结合数据库当前 revision 从旧镜像 history 推导为具体 revision 后再校验与执行。

> ⚠️ 回滚完成后、旧版本部署完成前，**禁止执行 `docker compose up/restart`**：
> backend 启动命令会自动执行 `alembic upgrade head`，会立刻把刚回退的迁移重新应用，
> 导致回滚失效。此窗口内只允许按上述步骤部署旧 release-set。

`--no-backup` 是显式危险选项，只能在已经明确确认不需要新备份时使用：
`bash scripts/rollback.sh rollback -1 --no-backup`。

### 回滚失败处理

如果回滚失败，使用备份恢复：
```bash
bash scripts/deploy.sh restore-db "${BACKUP_FILE:-./backups/your-backup.dump}" --yes
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
bash scripts/deploy.sh restore-db ./backups/your-backup.dump --yes
```

`backup-db` 默认输出自定义格式 `.dump`，`restore-db` 使用 `pg_restore --clean
--if-exists` 恢复；也兼容已有 `.sql` 文件。不要依赖 Compose 自动生成的容器名，也不要
在未确认目标环境前手工删除生产数据库。`restore-db` 必须显式传入 `--yes`；
`down-v` 必须设置 `ALLOW_VOLUME_DELETION=true`，隔离 `wangsh_sim` 模拟栈清理除外。

### 备份计划

当前仓库提供 `bash scripts/deploy.sh backup-db [full|schema|data]`，通过已配置的 Compose
`postgres` 服务生成时间戳备份；输出目录由 `BACKUP_DIR` 指定，默认 `./backups`。
该入口依赖 Docker、环境配置和运行中的数据库服务，不包含自动调度、按天轮转或异地同步。
执行前必须确认所选配置、数据库和输出目录，不将“命令存在”当作备份可恢复证明。

仍需安排每日备份、按运维保留策略轮转、异地保存和季度恢复演练；这些属于部署侧待配置并
验收的运维措施，不是本仓库当前已实现的自动化能力。本页不提供依赖缺失脚本的 cron
或演练命令，也未核查仓库外的调度系统。

当前源码没有可直接执行的独立恢复演练入口。`restore-db` 会恢复到配置选中的现有目标库，
并可能清理其中对象，**不能当作演练命令**。演练必须另行确认隔离数据库/实例、目标保护、
恢复后数据与迁移版本检查、记录留存和清理方案，再授权执行。

历史 `85ceba53` 快照含独立备份与演练脚本，但不在当前源码中；恢复历史实现须单独审查与
验证，尤其不能直接复用删除固定演练库的行为。本轮只校正文档，未执行数据库备份或恢复。

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

### 网关边界治理（生产候选）

生产候选 `gateway/Caddyfile` 使用 Caddy 2.8.4 原生能力，不依赖未验证的第三方限速模块：

- - 请求头上限 `64KB`，超限由 Caddy 返回 `431`；
- Caddy server 读取请求头、读取请求体、写响应和空闲连接分别设置 `5s`、`30s`、`30s`、`2m`；
- 反代 dial、等待上游响应头、读取上游响应、写入上游请求分别设置 `5s`、`30s`、`60s`、`30s`；
- 上游 keep-alive 空闲时间设置为 `30s`。

本配置不伪造通用 IP 限速或并发限速。Caddy 2.8.4 当前镜像未启用已验证的第三方限速模块；公网部署如需要 IP/租户限速、并发配额、WAF 和慢连接清理，必须由受信任的 WAF/LB/API Gateway 提供并在发布验收中记录证据。隔离验证不得接触正常端口，使用独立 Docker 网络和宿主端口。

配置合同和 Docker 语法检查：

```bash
gateway/tests/test_caddy_config.sh
```

发布前还必须在独立网关环境验证 `413`、`431`、上游响应超时、健康检查和现有 `/api/*`、前端反代不回归；这些隔离证据不能替代公网边缘防护验收。
