# 部署指南

> 状态：active
> Owner：release-ops
> 最近复核：2026-11-02

本文维护部署、环境变量、备份恢复与回滚。协作授权见 [CLAUDE.md](../../CLAUDE.md)，
构建工作流见 [CICD.md](CICD.md)；运行版本和验收结果只记录于
[TEST_STATUS.md](../testing/TEST_STATUS.md) 与 [发布记录](RELEASE_NOTES.md)。
命令须在已确认的目录、Compose、环境文件和授权范围内执行，不能整页连续照跑。

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

## 生产发布目录与运行身份

运维前核对容器的 Compose `working_dir` / `config_files` 标签、Image ID、挂载和配置。
服务器发布目录可能原地升级，目录名不证明运行版本；以实际容器和对应验收记录为准。
例如历史目录 `/home/shuhao/wangsh-releases/2.2.0/source` 的检查方式为：

```bash
docker compose --env-file .env -p wangsh -f docker-compose.production.yml ps
COMPOSE_PROJECT_NAME=wangsh ENV_FILE=.env COMPOSE_FILE=docker-compose.production.yml bash scripts/health-check-detailed.sh
```

- 现场适配 Compose 保留既有四个 external named volumes、网络和绝对 PythonLab workspace；不得用仓库默认 bind 目录替换。旧 `/home/shuhao/wangsh` 配置保留，使用前核对是否仍是启动来源。
- **双 Compose 事实与 up/down 禁令（2026-11-05 现场核验）**：生产 `wangsh` 项目混用两份配置——postgres/redis 的 compose label 指向 `2.2.0/source/docker-compose.yml`，其余六容器指向 `2.2.8/source/docker-compose.production.json`。**已核实生产 `docker-compose.production.json` 的服务集包含 `postgres` 与 `redis`**（共 8 服务：backend/frontend/gateway/postgres/pythonlab-sandbox/pythonlab-worker/redis/typst-worker），其中 pg/redis 的 bind 恰好指向 `2.2.0/source/data/{postgres,redis}`（与运行实例一致，当前正确，但依赖该文件保持不含仓库默认相对路径）。该文件不在仓库中、内容只在服务器。**禁止以任一历史 compose 文件作 `-f`/override 执行 `docker compose up/down/restart`**，排障只用固定 image ID 的 rollback compose 或只读 `ps`/`exec`/健康检查。
- **服务器上禁跑 `stop-dev.sh`（2026-11-05，台账 OPS-07）**：`stop-dev.sh --all` 会对开发与生产两套 compose 执行 `down --remove-orphans`，且不做目标确认。服务器旧目录 `/home/shuhao/wangsh` 目录名即 `wangsh`（与生产项目同名）且有 `.env`，在那里误跑会停掉并移除生产容器；各发布目录也带有该脚本。它只用于本机开发栈，服务器排障按上一条只用只读命令或固定 image ID 的 rollback compose。
- **发布命令作用域（2026-11-06 起随 2.2.9 进入生产发布目录 `2.2.9/source`；2.2.8 及更早目录仍是旧脚本）**：`scripts/deploy.sh` 的 `pull-up`/`up-no-build` 在仓库主分支上已改为只对 `release_services`（backend、typst-worker、pythonlab-worker、pythonlab-sandbox、frontend、gateway）执行 `compose up -d --no-build --pull never --no-deps`，不再影响 pg/redis。**该修改尚未进入任何已发布版本**——生产 `/home/shuhao/wangsh-releases/2.2.8/source/scripts/deploy.sh` 仍是旧脚本（裸 `compose up`，对 `COMPOSE_FILE` 全部服务生效）。在包含此修复的版本发布并部署前，对生产执行发布仍须先核对 `COMPOSE_FILE` 服务集含 pg/redis，并按既有禁令避免 `compose up/down` 触及基础设施。发布前核对 `COMPOSE_FILE` 指向：若为仓库默认 `docker-compose.yml`，其 pg/redis 为相对 bind（`./data/postgres`、`./data/redis`），相对路径按 compose 文件所在目录解析。
- 更新应用前通过镜像与迁移准入；保留基础设施，按服务使用 `up -d --no-deps --no-build --pull never`，再等待后端、worker 和网关健康。`restart` 不会换镜像。
- backend 与 PythonLab worker 保持一致的运行身份（既有部署为 `1000:1000`）及 socket 补充组。调整旧 root 属主工作区前停写、配对备份、逐对象盘点；不递归改整个 data、删锁或重写 journal。
- registry 与本地 digest 必须逐一匹配；当前脚本没有 `REGISTRY_INSPECT_PREFIX` 代理查询入口，也不因镜像已缓存而跳过核验。

## Redis 连接工厂基础（未发布）

**历史记录，非当前配置。** 该工厂已于 2026-10-16 的 `9f84619` 回滚；当前
`cache_helpers.py` 仍传入 `ssl_context`，不含原候选的 `REDIS_SSL_CA_CERTS` 等配置。
恢复实现时须重新核对 redis-py 原生证书参数、数据/发现通道各自的密码与 TLS、连接池释放，
并分别验证 TCP、TLS 和 Sentinel；不得用关闭证书校验通过验收。历史结果见 TEST_STATUS。

## 第二阶段未发布候选的发布前置（2026-09-14）

本节保留该批候选引入的发布边界，不表示当前版本尚未发布，也不证明生产已验收。
依赖版本按 `backend/requirements.txt` 与目标镜像实查；旧候选目录和 venv 快照不能代替。

### 依赖与请求入口

表单解析前的 ASGI 请求预算不替代网关请求头/体限制、超时、限速与并发治理。
升级 multipart 等依赖后，在实际候选镜像复跑上传和导入入口，再生成 release-set。

### XBK 候选迁移与回导边界

- `20260914_0001_xbk_active_selection_unique` 取得 `SHARE ROW EXCLUSIVE` 锁；发现活跃重复时阻断，不自动修数据。先只读核对重复与 schema，完成备份，停止并排空旧选课 writer，再按授权执行目标 revision。
- 自定义 `search_path` 须专项回放；当前版本表按 `current_schema()` 处理，不能沿用旧版“固定 public”假设。迁移和提交合同见下文。
- 回导预览/确认、完整有效集合、容量与事务裁决由 [XBK](../features/XBK.md) 维护。隔离 UI 或数据库通过不能代表真实业务回导完成。
- Excel 往返可能将验证改为 `x14:dataValidations`；不要再用不支持该扩展的 openpyxl 保存成品。Excel/WPS 打开保存测试不替代数据库回导验收。

### AUTH 与点名上线检查

- 启动初始化只创建缺失的配置管理员，不重置已有账号的密码、角色或启用状态。
- 停用、删除、恢复和降权依赖 AUTH ready gate 与持久撤销；核对迁移/enrollment 和真实 login/refresh/logout 交错，不绕过 gate。
- 教师点名授权未建立时的 `403` 是保守拒绝，不能作为教师功能完整交付；开放前须建立可撤销授权及迁移。

## 发布验收报告最低字段（发布准入）

报告按日期或版本保留在 `docs/archive/testing/`，当前结论与证据入口写入
[TEST_STATUS](../testing/TEST_STATUS.md)。报告保留：

- 时间、责任人、环境/目录、源码 commit、未提交范围、镜像 tag/digest、release-set。
- 数据库、role、`current_schema` / `search_path`、迁移前后 revision、实际表/索引/约束。
- 执行命令、健康与关键行为；迁移的 upgrade/downgrade/re-upgrade 或备份恢复结果。
- 配对备份位置、隔离恢复证据、未覆盖项、阻断项和发布结论；风险接受须有明确责任人。

## 隔离生产镜像模拟的安全边界

模拟使用独立 project、回环端口、空库/Redis/卷和合成账号；不复用开发或生产凭据。
记录构建提交、Dockerfile/context、镜像 ID 及实际运行 ID。缓存命中可接受，旧镜像改标签
不算新源码构建；网络失败保留日志、有限重试。清理只针对本批资源，不运行全局 prune。

`scripts/deploy.sh simulate` 的 Docker socket 和 PythonLab 专属挂载详见下文。
不需要 PythonLab 的最小应用模拟不挂 Docker socket、正常业务卷或真实名册。
空库采用既有 bootstrap → Alembic → compatibility bootstrap 流程；模拟通过不代替
真实数据库恢复、PythonLab 压力、真实供应商或正式发布验收。

## 未发布 AUTH 持久权威的受控切换前提（2026-09-10）

技术合同与计划模板由 [AUTH](../features/AUTH.md) 维护。发布时仍须：

- 核对 `20260910_0001_auth_authority` 及父迁移、目标 schema；表存在不代表 ready，不用 `create_all`、启动自动置位或缓存缺失放行代替切换。
- 停止并排空旧认证 writer 与身份/会话在途请求，冻结用户写入及 Redis 证据，保存停流与成对快照。所有合作 writer 统一升级。
- 直接执行 `backend/app/api/endpoints/auth/cutover.py`；默认 dry-run 回滚，受保护 JSON 计划与 `--confirm-database` 精确确认，审阅后才 `--apply`。它不是 HTTP 接口或启动钩子。
- enrollment 在一个数据库事务内保存存量会话/撤销证据和 ready gate。仍有效的旧凭据证据缺失或冲突时中止，不擅自全量撤销、延长 TTL、改变 legacy 或同 IP 政策；保留逐用户审计但不输出凭据。
- DB 提交与 Redis 发布不是跨存储原子事务。发布失败、ACK 丢失先核对持久权威，不能恢复旧缓存即恢复旧权限；网关须保留 logout `503`、issuance `409` 等失败语义。
- 禁止混跑旧 writer 或直接降版。回退先停流，处理未到期凭据并验证备份；downgrade 会删除安全证据，tombstone 不按 Redis TTL 定时清除。

## 未发布并发修复的部署前提（2026-09-09）

本节是历史批次引入的兼容边界；当前迁移集合以代码为准，不沿用旧“无 migration”结论。

- 测评/XBK 合作 writer 统一锁协议；额外隔离级别、直写 SQL 和混版本需单独验收，评估 AI 长事务、导入锁等待与连接池影响。
- PythonLab writer 共享可信 ownership 目录、同一锁 inode，文件系统真实支持 `flock`。journal 不进入学生 `/workspace`；不删锁文件解锁。
- 升降级前停新建沙箱、处理在途任务、盘点无 token 容器及各状态 journal。未知归属保留，不按同名批量删；旧版本不能直接混跑。
- 启动 CAS、世代核对、崩溃恢复与孤儿资源边界见 [PYTHONLAB](../features/PYTHONLAB.md)。共享 inode、真实 worker 恢复与混版本必须专验。
- Redis ACL 须覆盖 CAS 所需 `EVAL`、GET/SET，DAP 清理的 DEL / SET KEEPTTL（Redis 6+），认证条件旋转的 WATCH/MGET/MULTI/SET/EXEC；不扩大到全权限绕过失败。Cluster slot、Sentinel、TLS/代理须分别验证。
- WS/SSE 会话检查需评估 Redis 请求量、连接与背压；检查周期不构成断开 SLA，也不证明双存储原子撤销。

### AI 智能体流式并发发布门槛（2026-09-28）

前后端配套更新，按 [AI 智能体](../features/AI_AGENTS.md) 验证：空答案结构化报错、
推理不泄漏、断开释放连接、会话失效与上游错误可识别、长流不耗尽数据库池。
`DIFY_MAX_CONCURRENCY`、等待/租约时长和启用开关只是资源治理配置；Redis 故障、
`provider_busy` / `retry_after` / `concurrency_unavailable` 也需验收。
多 worker 前完成长流压力测试，记录 active streams、首字节、首答案、terminal/error、
上游取消及 cleanup latency；真实配额、网关超时和 60 人容量必须实测，不能由连接池大小推断。

## 服务器信息

域名 `wangsh.cn`，既有 SSH 配置用户 `shuhao`、端口 `6607`；连接入口：

```bash
ssh wangsh.cn
```

生产当前目录、版本与上次发布结果见 TEST_STATUS，并在操作前重新核对运行实例。
旧发布记录中的版本号不作为当前版本或默认回滚目标。

## 快速开始

### 开发环境

首次使用从 `.env.dev.example` 创建 `.env.dev`，填写独立的数据库口令、管理员口令、JWT/Fernet
密钥；已有文件不要覆盖。开发模板固定宿主 `127.0.0.1:5433` 与 development，生产模板 `.env.example`
不能直接用于开发。缺少开发文件或最终必需值为空时启动器拒绝启动，不回退生产 `.env`。
本机开发栈只从 [CLAUDE.md 第 7.0 节](../../CLAUDE.md#70-运行环境唯一入口) 指定的
主仓库 `/Users/wsh/wangsh` 启动；加载该仓库 `.env.dev`，本机个人覆盖才用 `.env.local`。

```bash
cd /Users/wsh/wangsh
bash start-dev.sh          # 本地业务进程与基础设施
bash start-dev.sh --docker # 全容器模式，二选一
```

开发 Compose 的配置形式如下；本机常规启停由上方唯一入口调用，不另起一套栈。
排查对应配置时必须带开发环境文件：

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d
```

前端 `6608`、后端 `8000`、Adminer `8081`。启动前按 Compose canonical JSON 核对实际开发
连接、密钥及 PostgreSQL/Redis bind；`.env.local` 与最终默认值纳入校验，解析失败不证明隔离。
没有生产 `.env` 时，只允许物理 `data/dev/` 内的开发目标，明确不验证生产隔离。
启动后仍须核对 `/health`、6608 可达与生效连接；本地进程连接宿主 `127.0.0.1:5433`，
全容器模式连接开发服务 `postgres:5432`。任一不符即停，不以再次启动掩盖目标不一致。

启停共享 `scripts/dev-processes.py`，核对 UID、物理 cwd、明确 Uvicorn/Celery/Vite 启动参数与
进程身份后才向具体 PID 发信号；没有全局 `pkill` 兜底。TERM 后按原 PID 复验，不因关闭监听
就认定进程退出；信息缺失或身份变化会保留并报错。非原子查询不能完全消除 PID 复用竞态。
启动入口另以 `scripts/dev-containers.mjs check` 核对全部同名容器的 Compose 来源和 bind；
不按名字删除容器，发现生产/其他目录/未知来源会中止，后续重建仅交给开发 Compose。
本地后端与 Celery 共用选出的 `backend/venv/bin/python`（存在时），不要求用户事先激活 venv。
本地上传默认使用 `data/dev/uploads`，与容器挂载一致；显式个人目录保持原值，已有旧文件
不会自动搬迁，切换模式前需按授权核对来源与目标，不能把配置修正当作数据恢复。
开发数据库按实际配置选择，不能因端口能连通就认定是目标库：

| 连接位置 | 入口 |
|---|---|
| 本机开发连接 Docker dev | `127.0.0.1:5433`（开发模板固定值） |
| Docker dev 容器内 | `postgres:5432` |
| 宿主已有 PostgreSQL（非本项目开发库） | 通常为 `127.0.0.1:5432`，不得当作开发库连接 |

本机与 Docker 数据库独立，迁移各自验证；镜像整理见[镜像命名与整理](#镜像命名与整理)。

### 生产环境

首次配置从 `.env.example` 复制 `.env` 并设置目标环境值；已有配置不要覆盖。
确认源码、发布窗口、配对备份和 release-set 后，按下文“镜像构建流程”操作。
正式构建优先使用发布 workflow；手工构建/推送必须另行核准打包源码与完整清单，
不能把另一批 workflow 的 release-set 配给本地镜像。

## 版本管理

`frontend/package.json` 的完整 SemVer 是源码版本权威。`IMAGE_TAG`、release-set、
`APP_VERSION`、`REACT_APP_VERSION` 及已设置的 `VERSION` 必须完全一致。
发布前运行 `node scripts/check-version-consistency.mjs`；显式同步 package/lockfile、
`.env.example`、生产 Compose 默认标签、发布 workflow 输入和 `deploy.sh` 的 `SIM_VERSION`。
本指南不维护“当前版本”常量。

前端页面版本/环境标签来自构建时的 `REACT_APP_VERSION` / `REACT_APP_ENV`；缺失或
`unknown` 显示 `–`。它不查询服务器设置，修改后端或运行时环境后仍需重建前端静态资源。

### 标签必须打在构建源上（血泪教训）

发布标签必须指向实际构建提交；打标签在构建前后均可，但不能指向后续文档收尾提交。
先确认构建目录和工作区，再记录 `git rev-parse HEAD`，将源码、六镜像与 release-set
关联到同一提交。tag、push 各按明确授权执行，已发布标签不得强推重写。

**tag message 格式（以 2.2.6 为实例，2026-11-05 起沿用）**：tag message 至少写明
构建提交、发布 workflow run id 与 release-set SHA256；2.2.7/2.2.8 的 message 只有一行
标题，审计时需回查 workflow，后续发版不要省略。

历史 2.2.1 构建源 `c0b44b6` 与标签 `a3a5a54` 不同；2.2.2 构建源 `7973dc2`
与标签 `4d774ec` 也不同。事故结果见发布记录和 TEST_STATUS。
部署后同时核对 registry digest、本地 Image ID/RepoDigest、代码挂载和目标行为。
代码独特符号可辅助比对，符号计数相等、健康通过或镜像时间均不能单独证明版本一致。

### 生产镜像必须用 `docker compose build`，不要手动 `docker build`

本地生产构建用 `docker compose build` 或既有 `deploy.sh build[-amd64]`，统一读取
Compose 的 `linux/amd64` 平台与构建参数；不要逐个裸跑 `docker build`。
GitHub 发布 workflow 使用受门禁约束的 `build-push-action`，也显式指定该平台。
六镜像包含独立 Dockerfile 的 `pythonlab-sandbox`，不得漏建或混入本机 arm64 镜像。

```bash
bash scripts/deploy.sh build
bash scripts/deploy.sh verify-local-images
```

平台检查之外仍须核对构建提交、打包内容与目标行为；本机可运行不证明服务器平台匹配。

### 镜像命名与整理

- 沿用既有仓库名；开发后端/worker 用 `shuhao07/wangsh-<组件>:dev`，正式版本用完整 SemVer，以 release-set digest 确认身份。
- 本地标签保持用途明确，避免工作树名、长日期和无引用的 `latest` 别名；构建日期、架构与 revision 写入记录。CI 的 `${version}-build-${run_id}` 是发布中间标签，不是新的正式版本。
- 清理前核对容器 Image ID、有效 Compose、PythonLab 按需镜像；先迁移引用并验证，再精确删旧标签，不按年龄或版本数字判断用途。
- PostgreSQL、Redis、Node 等依赖沿用官方仓库和各自有效版本，不改成应用版本，不重复推送成自建镜像；架构通过 manifest/platform 选择。
- 历史验证镜像保留真实版本身份，不能冒充新正式发布。

### 本地只保留最新正式镜像

只有明确获准整理时才执行：拉齐目标 release-set → 核对容器、沙箱引用和配置 →
备份退役栈与确认无在途任务 → 替换目标服务并验证 → 精确删除无引用旧镜像。
数据卷、绑定业务目录、必要基础镜像和待复核证据按已确认范围保留，不用强删或全局 prune。

开发服务换基础镜像时保留源码挂载、数据、命令、用户和环境，按服务执行
`up --no-deps --no-build --pull never`，记录完整覆盖配置与启动方式。
源码挂载环境仍是开发环境；HTTP readiness、worker 响应和基础执行通过不能当作生产验收。

### 已推送候选镜像的发布核对

手工候选须独立核对打包源码；前端用相同参数重建并比较静态文件哈希。确认源码、平台、
registry digest 后生成完整 release-set，再通过本地 RepoDigest、生产配置、配对备份和
恢复门禁。记录真实构建路径，不声称执行过未运行的 workflow。

### KNN 采集版本迁移（历史记录，2.1.6 起）

Alembic `20261020_0001` 在 `f1a2b3c4d5e6` 后新增采集批次、名单与答案版本三表，
不回填旧业务数据。降级会删除 KNN 数据；已有新答卷时按配对备份恢复，不视为无损降级。
功能与权限见 [KNN 采集](../features/KNN_SURVEY.md)。

### 如何确认当前最新内容

| 对象 | 核对依据 |
|---|---|
| 源码 | 联网确认远端 main；检查实际开发工作树、版本及未提交改动 |
| 正式发布 | 成功构建提交、完整版本、release-set 与 registry digest |
| 运行内容 | 容器 Image ID/RepoDigest、代码挂载、环境及前端构建注入值 |

`Config.Image` 字符串、目录名和热更新源码不能单独证明版本；推送镜像也不代表服务器已部署。

## 开发 vs 生产模式对比

| 特性 | 开发模式 | 生产模式 |
|------|----------|----------|
| **前端服务** | Vite dev server (端口 6608) | Caddy 静态文件服务 (端口 80) |
| **后端服务** | uvicorn --reload | uvicorn --workers `${UVICORN_WORKERS:-1}` |
| **调试模式** | DEBUG=true | DEBUG=false |
| **代码加载** | 本地目录挂载（热加载） | 代码打包到镜像内 |
| **网关** | 可选（开发时不启动） | 必需（Caddy 反向代理） |
| **数据库** | 本机库或 dev Compose 数据挂载 | 仓库默认 bind；现场以实际适配 Compose/卷为准 |
| **镜像来源** | 本地构建 (Dockerfile.dev) | 经验证的正式 release-set |

生产 Compose 用 `./data/postgres` / `./data/redis`，开发 Compose 用 `./data/dev/` 下的
独立目录（2026-11-02 起分离，避免开发栈污染生产数据与密钥）。不要并行启动冲突栈，
切换前核对数据挂载。服务器的 external volumes 不得替换成这些默认目录。

---

## 镜像构建流程

正式镜像从通过质量门禁的当前 main 构建。优先使用 [发布 workflow](CICD.md)，
统一生成 `linux/amd64` 六镜像及 release-set；服务器不从源码重建。
前后端 Docker context 排除 `.env` / `.env.*`，运行凭据由目标环境注入。

### 1. 构建所有镜像

获准本地生产构建时执行：

```bash
bash scripts/deploy.sh build
bash scripts/deploy.sh verify-local-images
```

| 镜像仓库（默认命名空间 `shuhao07`） | 构建入口 |
|---|---|
| `wangsh-backend` | `backend/Dockerfile.prod`，`backend_runtime` |
| `wangsh-typst-worker` | 同文件，`worker_runtime` |
| `wangsh-pythonlab-worker` | 同文件，`pythonlab_worker_runtime` |
| `wangsh-frontend` | `frontend/Dockerfile.prod` |
| `wangsh-gateway` | `gateway/Dockerfile` |
| `pythonlab-sandbox` | `backend/docker/pythonlab-sandbox/Dockerfile` |

后端 Debian 源由 `DEBIAN_MIRROR` / `DEBIAN_SECURITY_MIRROR` 配置；Compose 默认
使用阿里云镜像。需要上游源时分别设为 `http://deb.debian.org/debian` 与
`http://deb.debian.org/debian-security`，保留下载失败与构建证据。

### 2. 本地生产模拟验证

```bash
# 使用本地生产镜像，不重建；默认保留成功栈
bash scripts/deploy.sh simulate

# 完整 smoke，成功/失败后清理本次隔离栈
SIM_RUN_PROD_SMOKE=true SIM_CLEANUP=true bash scripts/deploy.sh simulate
```

默认网关 `127.0.0.1:16608`，`SIM_RUN_PROD_SMOKE=false`、`SIM_CLEANUP=false`；
`SIM_VERSION` 与源码版本同步，镜像命名空间由 `SIM_IMAGE_REPOSITORY_PREFIX` 指定。
`simulate` 不消费 release-set，不能替代正式发布门禁。

隔离合同由 `prepare-production-simulation.py` 与脚本测试约束：

- 解析生产 Compose 后生成 `0600` 临时配置：移除固定容器名/外部网络；PG/Redis 使用 `wangsh_sim` 专属卷，网关仅 loopback，除 Docker socket 和本次 PythonLab 目录外拒绝宿主挂载。不读取生产 `data/postgres` / `data/redis`。
- 校验配置和所有本地镜像后才停止旧模拟栈；关键 project、镜像、端口和 namespace 强制隔离。进程锁互斥，只有确认原进程不存在才接管失效锁。
- 每次工作区为 `data/pythonlab/simulations/run.*`，不读写正常 `workspaces`。失败清理本次栈与工作区；成功保留或清理由 `SIM_CLEANUP` 决定，下次运行清理旧模拟残留。动态沙箱只匹配 `^/wangsh_sim_`，清理失败返回非零。
- 合成空库迁移后执行 AUTH enrollment，再用独立 session 确认 ready。正式数据库必须另走停流、配对快照和显式 apply，不复用自动 enrollment。
- smoke 继承同一 project/env/Compose 上下文；临时密码仅进程传递，PythonLab 子脚本使用 `PYTHONLAB_SMOKE_USERNAME` / `PYTHONLAB_SMOKE_PASSWORD`，不写命令参数或报告。
- 运行所需环境按白名单传递。日志/JSON 脱敏 URL、认证头、Cookie、密码、API key 与已知敏感值；证据目录 `0700`、文件 `0600`，新运行清空旧结果，临时凭据/配置退出时删除。

### 3. 推送到 Docker Hub

只有获准手工推送时执行；该入口不自动生成 workflow artifact：

```bash
docker login
bash scripts/deploy.sh push
```

手工候选必须按前述“已推送候选镜像的发布核对”形成匹配的 release-set。

### 4. 生产服务器部署

先确认当前发布目录、实际 Compose/环境文件、目标版本与配对备份；将对应构建的
`release-set.txt` 放到约定位置，也可用 `RELEASE_SET_FILE` 指定受保护路径。
以下使用默认配置；现场适配环境须在每条命令中保持相同上下文。

```bash
bash scripts/deploy.sh verify-release-set release-set.txt
bash scripts/deploy.sh deploy
bash scripts/health-check-detailed.sh
```

`deploy` 校验版本、六镜像集合、Compose 引用和 registry digest，只拉业务镜像，
复核本地 RepoDigest 后以 `--no-build --pull never` 启动并等待详细健康检查。
PostgreSQL/Redis 必须预先准备，不随应用发布隐式升级；缺少基础镜像时拒绝启动。

健康检查要求 API HTTP 2xx 且顶层唯一 `status=healthy`，并要求数据库、Redis、
frontend、gateway 和两个 worker 健康。宿主需 Bash、Docker CLI、curl 与基础 Unix 工具；
JSON 由运行中的 backend 容器解析，不依赖宿主 Python。健康通过后仍须核对代码身份与关键行为。

## 常用部署命令

| 入口 | 用途与边界 |
|---|---|
| `bash scripts/deploy.sh verify-local-images` | 核对本地业务镜像及平台 |
| `bash scripts/deploy.sh verify-release-set <文件>` | 校验版本、Compose 和远端 manifest |
| `bash scripts/deploy.sh deploy` | 校验、拉业务镜像、启动、等待健康 |
| `bash scripts/deploy.sh up-no-build` | 远端清单和本地 RepoDigest 一致后启动，不拉取/构建 |
| `bash scripts/deploy.sh simulate` | 本地隔离生产模拟 |
| `docker compose ps` / `logs --tail 50 <服务>` | 查看已确认栈的状态/日志 |

开发使用 `docker-compose.dev.yml` 与 `.env.dev`，启停优先 `start-dev.sh` / `stop-dev.sh`。
不要用普通 `up --build` 绕过生产门禁；停栈、重启或删除卷必须有对应授权，
`down-v` 另需 `ALLOW_VOLUME_DELETION=true`，不能作为常规清理步骤。

## 服务说明

### 核心服务

`gateway`：生产 Caddy 反代；`backend`：FastAPI；`frontend`：开发 Vite/生产静态文件；
`postgres`：数据库；`redis`：缓存及共享状态。

### Worker 服务

`typst-worker` 渲染 PDF；`pythonlab-worker` 消费默认 `celery` 队列，处理 PythonLab
调试及课堂结束后的 AI 分析。沙箱由 PythonLab 按需创建。

### 可选服务

`adminer` 仅用于开发数据库管理。

## 环境变量配置

关键环境变量说明：

### 版本配置

`APP_VERSION`、`IMAGE_TAG`、`REACT_APP_VERSION` 使用同一完整版本；
`IMAGE_REPOSITORY_PREFIX` 默认 `shuhao07`。维护位置见“版本管理”，不要从旧示例复制版本号。

### 安全配置（生产环境必须修改）

| 配置 | 要求 |
|---|---|
| `SECRET_KEY`、`SUPER_ADMIN_PASSWORD`、`POSTGRES_PASSWORD` | 按目标环境注入非默认值，不输出明文 |
| `AGENT_API_KEY_ENCRYPTION_KEY` | 合法 Fernet 密钥，变更前核对已有密文的解密/迁移 |
| `AUTH_TRUSTED_PROXY_CIDRS` | 只填可信网关网段；空值不信任转发头，禁止 `0.0.0.0/0` |
| `AI_AGENT_MAX_OUTPUT_TOKENS` | Anthropic 兼容接口单次回答上限，默认配置见 `.env.example` |

### 功能开关

生产 `DEBUG=false`、`BACKEND_RELOAD=false`。多 worker SSE 需
`SSE_REDIS_PUBSUB_ENABLED=true` 且 Redis 可用。IT 游戏上传上限由
`IT_GAME_MAX_UPLOAD_BYTES` 配置，并同步核对网关请求体限制。

### AI伙伴临时共享榜单配置（未发布）

标题保留原链接。状态（2026-11-05 只读核验）：相关代码已随 2.2.5–2.2.8 发布；生产 backend 已配置评分智能体（`AI_PARTNER_SCORING_AGENT_ID` 非空），该功能在生产启用；真实模型评分行为未单独验收。本节只维护配置合同。

| 后端配置 | 默认值 | 说明 |
|---|---|---|
| `AI_PARTNER_LEADERBOARD_ROUND_ID` | `classroom` | 新课换新轮次，不复用已结束轮次 |
| `AI_PARTNER_LEADERBOARD_DURATION_SECONDS` | `3600` | 首次有效提交开启的固定正整数秒窗口，不续期 |
| `AI_PARTNER_SCORING_AGENT_ID` | 未设置 | 已启用评分智能体 ID；空白视为未设置，非法非空值报错；未设置时评分返回 `503` |

生产 Compose 透传三项配置。评分智能体在现有管理入口配置：须有显式 API URL，
非 Dify 还须模型名；凭据复用平台加密解析，符合既有条件的 OpenRouter 可用
`OPENROUTER_API_KEY` 回退。无有效配置则不可评分，不补前端规则分数。

端点沿用 SSRF 校验，不放行本地 Ollama 例外，不允许 URL 凭据/query/fragment，
不跟随重定向或继承代理；不得为联调绕过。学生提交内容会发给所配供应商，应最小化个人信息。
共享 Redis 故障或评分凭证写入失败均不能提交，不退化为进程内榜单。
到期保留 deadline-only metadata 防止旧轮次重开，Redis 丢键会破坏该保证，不作持久考试存储。

目录唯一维护源为 `backend/app/services/ai_partner_catalog.json`，前端副本由同步脚本生成，
不重复计价。模型限额、凭证时效、接口与错误码见
[API owner](../development/API.md#ai伙伴临时共享榜单未发布)及 [AI 智能体](../features/AI_AGENTS.md)。
未配置/已配置两种状态和真实供应商分别验收；mock、Redis 或页面测试不能证明真实评分通过。

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
REDIS_HOST=wangsh-redis-1
PYTHONLAB_CONTAINER_NAMESPACE=pythonlab
PYTHONLAB_WORKSPACE_ROOT=/tmp/pythonlab/workspaces
PYTHONLAB_HOST_WORKSPACE_ROOT=/absolute/path/to/wangsh/data/pythonlab/workspaces
# 可选：显式指定 DockerProvider 使用的宿主机绝对路径；按实际部署填写
HOST_WORKSPACE_ROOT=/absolute/path/to/wangsh/data/pythonlab/workspaces
```

生产 Compose **不**使用短服务名 `redis`，而是默认指向显式容器名 `wangsh-redis-1`。
原因：本栈 backend 为访问 Dify 而加入 `docker_default` 网络，与 Dify 同网；Dify 也有
一个名为 `redis` 的服务，短名会被其抢占，导致 backend 连到需要密码的 Dify Redis 并报
`Authentication required`，健康检查转 degraded。取值形式为
`${REDIS_HOST:-wangsh-redis-1}`——默认行为不变，但允许在其它 COMPOSE_PROJECT
（如 simulate / deploy-local）下显式覆盖，避免容器名不同导致解析失败。

**横向边界（2026-11-05 记录）**：backend 与 Dify 同处 `docker_default` 网络意味着
Dify 若被攻破，攻击面可达 backend 的该网络接口。当前不改变网络拓扑（用户未要求），
此处仅将既有边界写入运维文档；排障时不要为该连通性扩大白名单或新增网络。
开发 Compose 的现有 Redis 容器行为保持不变。

`PYTHONLAB_CONTAINER_NAMESPACE` 决定动态沙箱容器前缀以及
`list_active_sessions` 的枚举范围，默认 `pythonlab` 保持现有容器名兼容。
`PYTHONLAB_HOST_WORKSPACE_ROOT` 是生产 Compose 的宿主机 bind mount 源；
`PYTHONLAB_WORKSPACE_ROOT` 是 backend/worker 看到的目录。容器部署中需要显式帮助
DockerProvider 定位宿主机目录时，`HOST_WORKSPACE_ROOT` 应填写同一份工作区的宿主机绝对路径。

`.env.example` 是机器可读基线；`PYTHONLAB_HOST_WORKSPACE_ROOT` / `HOST_WORKSPACE_ROOT`
默认留空，Compose 回落到 `./data/pythonlab/workspaces`。容器部署需要显式宿主机路径时，
必须按目标机器填写实际绝对路径；留空与错误的显式映射都有实际影响。
DockerProvider 先尝试 `HOST_WORKSPACE_ROOT` 显式映射，再尝试容器 bind mount 和 mountinfo，
最终沿用原路径；显式值与 `PYTHONLAB_WORKSPACE_ROOT` 相同时会忽略该映射并继续解析。
宿主目录与容器内路径不可互换，错误的显式映射可能优先覆盖正确的自动解析。

2026-10-31 本机 lucid 开发使用宿主进程，`.env.local` 将 `HOST_WORKSPACE_ROOT` 覆盖为
`/tmp/pythonlab/workspaces`，与实际 `PYTHONLAB_WORKSPACE_ROOT` 相同，使解析回到真实本机目录，
避免继承示例路径而导致 `Mounts denied`。这是当前本机配置修正，不能照搬为生产或全容器
部署路径；配置修改、进程重载和真实调试分别核验，结果见 [TEST_STATUS](../testing/TEST_STATUS.md)。

## 常见问题

### 1. 前端无法访问后端 API

**开发环境**：确保 `REACT_APP_API_URL=/api/v1`；Vite 会将 `/api` 和 WebSocket
请求代理到 `DEV_PROXY_TARGET`，未设置时默认为 `http://localhost:8000`

**生产环境**：确保 gateway 服务正常运行，Caddy 会转发 `/api/*` 到后端

### 2. PythonLab 调试超时

确保 `pythonlab-worker` 服务正常运行。该 worker 也消费课堂 AI 分析任务：

```bash
docker compose ps pythonlab-worker
docker compose exec -T pythonlab-worker docker --version
```

### 3. 前端出现 `Failed to load module script` 或 MIME `text/html`

优先检查 `frontend/caddy/Caddyfile.prod` 与 `gateway/Caddyfile`：SPA 页面可回退
`index.html`，缺失 `/assets/*`、`/static/*`、`/pyodide/*` 必须返回 404，不能返回 HTML。

### 4. 公开课独立静态页与 SPA 回退

- `/games` 是主 SPA 路由；`/games/ai-partner/index.html` 是同源独立页，资源随前端镜像构建。
- 独立目录只返回真实文件，缺失返回 404，入口 HTML 不长期缓存；SPA 使用 `{path}/index.html`，不用 `{path}/` 目录候选。
- 独立源码、favicon 与构建入口由 [前端脚本说明](../../frontend/scripts/README.md#ai伙伴独立源码入口未发布) 维护。
- 隔离 simulate 验收 `/games`、AI 伙伴、lock-cracker 及资源 MIME/404，再按授权发布；不拿一次性标签覆盖正式版本。

### 5. 前端镜像构建复制 Pyodide 失败

`frontend/public/pyodide` 由 prebuild 从 npm 依赖生成，必须排除在 Docker context 外，
防止宿主残留或绝对符号链接覆盖容器产物。复制脚本仅在版本 marker 匹配、六个核心文件
均非空时跳过，否则先写临时目录、验证后替换，不能伪造缺失依赖。

`frontend/Dockerfile.prod` 在 `npm ci` 层和最终产物分别核对：

| 依赖文件 | 最终位置 |
|---|---|
| `node_modules/pyodide/` 下的 `pyodide.js`、`pyodide.mjs`、`pyodide.asm.js`、`pyodide.asm.wasm`、`python_stdlib.zip`、`pyodide-lock.json` | `build/pyodide/` 同名文件 |
| `node_modules/pdfjs-dist/build/pdf.worker.js` | `build/assets/pdf.worker.js` |

任一缺失或空文件应中止构建；Vite 复制 PDF worker 失败也必须抛错。

### 6. Mindmap 本地运行时边界

`frontend/public/mindmap-demo/` 仅本地保留，不进 Git/生产 context；普通构建结束也移除
`build/mindmap-demo`。生产缺少旧编辑器运行时，数据库内容仍保留，但相关编辑、预览和独立
窗口不可用。Caddy 对该目录返回 `404 + Cache-Control: no-store`，不走 SPA fallback。
恢复前须建立固定版本、来源校验、许可明确的可复现流程，不临时复制本地目录进镜像。

### 7. Typst PDF 渲染失败

确保 `typst-worker` 服务正常运行，且字体文件已正确挂载

```bash
docker compose ps typst-worker
docker compose exec -T typst-worker typst --version
```

### 8. 数据库连接失败

检查 `POSTGRES_HOST` 配置：

- Docker 内部：使用 `postgres`
- 本地连接：使用 `127.0.0.1`

---

## 数据库迁移策略

### 迁移前检查

先确认目标数据库、schema/search_path、运行配置、当前/目标 revision、业务停写窗口和
配对备份；只读检查不构成迁移授权。

```bash
docker compose exec -T backend python /app/scripts/check_migration_state.py
bash scripts/migrate-db.sh current
bash scripts/migrate-db.sh history
```

课堂迁移 `20260628_0001_add_classroom_activity_class_desc` 遇到 active 活动会中止。
应由教师正常结束活动，再停止旧 writer、排空在途事务；不直接修改或删除课堂答题数据。
该迁移的 `SHARE ROW EXCLUSIVE` 锁消除检查/写入竞态，但锁等待不能替代维护窗口。

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, title, created_by FROM znt_classroom_activities WHERE status = '\''active'\'';"'
```

### XBK 整数学年库与热加载代码不匹配

`20260908_0001_xbk_academic_year`（父 `20260817_0001_query_filter_indexes`）
将三个 XBK 表的整数年份转为规范字符串。热加载不执行迁移；须核对目标库列类型、
年份范围及依赖，在隔离库预演后，按授权停写、备份并升级审核过的 revision。

降级只保留起始年份，必须配套兼容应用版本；迁移不改 `term="1"`、不恢复或重导名册。
升级后用同一学年/学期验证 `analysis/summary`、`data/meta`、`data/course-results`
及真实页面，不能只看健康。备份须隔离恢复并比较 schema、逐表摘要、序列和关联；
timestamptz 摘要比较须在各连接设置并读取相同时区，避免 PGTZ 覆盖造成误差。

超时须施加于迁移新建的 asyncpg 连接并读回，不拿别的 psql 会话设置替代。
探针不留隐式事务，完成后用独立连接确认 revision 与结构持久化。
数据库备份不涵盖 Redis、上传文件和迁移后的新写入，需明确配套恢复边界。

### 执行迁移

审核目标 revision 后执行；`upgrade` 无参数代表 head，不宜在未知历史库盲跑。

```bash
bash scripts/migrate-db.sh upgrade <revision>
```

生产 backend 启动顺序：

```bash
python /app/scripts/check_migration_state.py
python /app/scripts/bootstrap_db.py --initial-only
alembic -c /app/alembic.ini upgrade head
python /app/scripts/bootstrap_db.py
```

- 预检只读，用 AST 解析 revision 图，不执行迁移模块；拒绝非法/多 head 图、缺失或未知版本、非祖先版本及待建对象已存在等漂移。目录读取采用 REPEATABLE READ，不代替后续 DDL 并发控制。
- `20260430_migrate_dev_schema` 的已审索引 guard，只有完整 AST 指纹与目录定义等证据一致时可放行；跨 schema 同名、异结构、无效索引或未知动态 guard 均阻断，不自动重算指纹绕过审核。
- `--initial-only` 只给真正空库建立 legacy baseline，不 stamp；排除由迁移负责的索引/约束，并保留 XBK 旧整数年形态。失败后已落地 baseline 的模拟库不能重新当空库，使用新的专库重验。
- 完整 Alembic 后普通 bootstrap 处理兼容项并检查合同；已有 head 的 startup 不做 schema DDL。新增持久字段仍需正式 migration，不能依赖 bootstrap 掩盖模型/迁移差异。
- 当前 online runner 在同一事务/连接中取得 advisory lock、扩容版本表和运行迁移。版本表位于 `current_schema()`，容量为 `VARCHAR(64)`；提交或回滚统一释放锁，详见下文提交合同。
- 2026-10-28 曾对规定启动路径及裸 `alembic upgrade head` 作等价验证，证据见 TEST_STATUS；不将该历史结果推广为所有后续版本或目标库均可裸跑。
- head 以当前迁移图为准。`20260711_0002_restore_legacy_baseline_indexes` 恢复的三个 XBK grade 与两个文章样式索引须查 `pg_indexes` 验证；到达 head 不等于结构完整。

预检失败时保留现场、先备份，再比较真实表/列/索引/约束；只有 schema 已证明等价，
且修复获准后，才补齐并 `alembic stamp <verified_revision>`。不删表重建来消除漂移。
PythonLab 旧容器不兼容时保守拒绝复用，资源归属、终止和 DAP 验收见 [PYTHONLAB](../features/PYTHONLAB.md)。

### 迁移验证

```bash
docker compose exec -T postgres sh -c \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

连接可用仅为一项检查；还须用独立连接核对 revision、结构、关键业务与恢复方案。

### 常见问题

- 连接/权限失败：核对实际目标和角色，不绕过权限。
- 版本分叉：检查 `alembic heads` 和迁移图，先确定整合方式。
- 表已存在但版本落后：按 schema drift 核证，不直接重跑、删表或 stamp head。

## 回滚流程

### 何时需要回滚

严重功能或数据问题需要回退时，先判断旧代码、数据库 revision、AUTH 撤销证据及新增业务
数据是否兼容；不能把所有故障都处理成 `downgrade -1`。

### 回滚步骤

确认目标版本、旧源码、镜像、release-set、备份和窗口后执行。下面的 `OLD_VERSION`
与 `OLD_RELEASE_SET` 须先设置为已核准值，不能照搬旧示例版本。

**本地-only 回滚版（2.2.2 特例）**：2.2.2/2.2.3 未发布到 DockerHub（六仓库 404），
服务器本地六镜像（五个 `:2.2.2` 加 `pythonlab-sandbox:2.2.1`）是该版本唯一副本，
`verify-release-set` 与 `pull-up` 的远端核验/拉取路径对其不可用。回滚到 2.2.2 时：

```bash
# 1) 先用本地镜像 ID 核验（固定 digest/ID 的 rollback compose，不联网、不 pull）
docker image inspect shuhao07/wangsh-backend:2.2.2 shuhao07/wangsh-frontend:2.2.2 \
  shuhao07/wangsh-gateway:2.2.2 shuhao07/wangsh-typst-worker:2.2.2 \
  shuhao07/wangsh-pythonlab-worker:2.2.2 shuhao07/pythonlab-sandbox:2.2.1
# 2) 用服务器固定的 rollback compose（按 image ID 引用）启动，禁止普通 compose up/restart
```

旧 release-set 部署完成前不要普通 `compose up/restart`，否则新版 backend 启动会重新
`upgrade head`（`scripts/rollback.sh` 的 Usage note 有同等警示）。通过健康、代码与关键
行为后再开放流量。

本地-only 版本的回滚同样适用下面的默认流程（先停写、备份、再用旧镜像 downgrade）；
区别只在于镜像来源与核验方式，不能因为 DockerHub 缺失而跳过备份与健康核证。

```bash
: "${OLD_VERSION:?请先设置已核准旧版本}"
: "${OLD_RELEASE_SET:?请先设置对应的归档清单}"
bash scripts/rollback.sh rollback -1 --image-tag "${OLD_VERSION}"
```

默认先记录并停止 backend、Typst worker 和 PythonLab worker，建立无写入窗口后备份，
再用一次性旧 backend 镜像执行 downgrade。停止/备份失败绝不 downgrade，只恢复原先运行的
写服务；恢复失败单独报错。开始 downgrade 后无论成功/失败，写服务保持停止，先核证数据库。
旧镜像必须含目标 revision；相对 `-1`/`-N` 转成明确 revision 验证，不满足时转向经核准的备份恢复。
`--no-backup` 只在明确获准跳过新备份时使用。

每次发布须安全归档 release-set。校验会比较源码 `frontend/package.json`，因此旧清单
须在对应旧源码或等价 `VERSION_CHECK_ROOT` 下验证；不能用新源码强行配旧清单。
以下两步必须使用同一发布目录和 Compose/环境配置：

```bash
IMAGE_TAG=${OLD_VERSION} APP_VERSION=${OLD_VERSION} REACT_APP_VERSION=${OLD_VERSION} \
  PYTHONLAB_SANDBOX_IMAGE=shuhao07/pythonlab-sandbox:${OLD_VERSION} \
  RELEASE_SET_FILE=${OLD_RELEASE_SET} \
  bash scripts/deploy.sh verify-release-set "${OLD_RELEASE_SET}"

IMAGE_TAG=${OLD_VERSION} APP_VERSION=${OLD_VERSION} REACT_APP_VERSION=${OLD_VERSION} \
  PYTHONLAB_SANDBOX_IMAGE=shuhao07/pythonlab-sandbox:${OLD_VERSION} \
  RELEASE_SET_FILE=${OLD_RELEASE_SET} \
  bash scripts/deploy.sh pull-up "${OLD_RELEASE_SET}"

bash scripts/health-check-detailed.sh
```

已设置的 `VERSION` 也须一致。旧 release-set 部署完成前不要普通 `compose up/restart`，
否则新版 backend 启动会重新 `upgrade head`。通过健康、代码与关键行为后再开放流量。

### 回滚失败处理

保持写服务停止，核对当前 revision、已执行变化与可恢复备份；确认恢复目标和影响后，
按下文 `restore-db` 执行。命令失败可能留下部分数据，不能未经核证直接再次启动。

## 数据备份与恢复

### 执行前提

`backup-db` / `restore-db` 通过 Compose 的 postgres 服务操作。`deploy.sh` 与 `rollback.sh`
在入口即固定路径：显式相对 `ENV_FILE`、`COMPOSE_FILE`、`BACKUP_DIR`、`RELEASE_SET_FILE`
及清单/恢复文件参数相对调用目录解析；未设置的默认项目文件和备份目录相对脚本仓库根。
父回滚与备份子入口继承同一绝对配置，不以仓库同名文件代替缺失的显式输入；Compose 的
`PWD` 插值固定为配置文件父目录的物理路径，不随入口内部 cd 改变。
先核对 project、`POSTGRES_DB` / `POSTGRES_USER`、数据挂载与输出目录；现场生产若使用适配
Compose，必须显式指定，不能照默认值操作。开发栈示例：

```bash
ENV_FILE=.env.dev COMPOSE_FILE=docker-compose.dev.yml bash scripts/deploy.sh backup-db full
```

`.env.dev` 不受 Git 跟踪；数据库三项须非空，CORS 采用配置要求的 JSON 格式，
密钥和管理员配置不得依赖默认值。`start-dev.sh` 会预检必需项；绕过启动入口前须同样核对。
不把环境文件或凭据打印进报告。

### 备份数据库

```bash
bash scripts/deploy.sh backup-db full
# 仅需结构/数据时，分别使用 schema / data
```

备份默认输出时间戳 `.dump` 到 `./backups`，可用 `BACKUP_DIR` 指定受限的仓库外目录。
入口校验非空及归档目录可读；这不证明完整恢复成功，仍需独立隔离恢复。

### 恢复数据库

确认目标库、停写窗口、备份完整性及恢复授权后：

```bash
bash scripts/deploy.sh restore-db ./backups/your-backup.dump --yes
```

该命令写入配置选中的现有数据库，**不是恢复演练**。`.dump` 使用 pg_restore，
full/schema 采用 `--clean --if-exists`；`.sql` 使用 psql。
`--exit-on-error` / `ON_ERROR_STOP=1` 使错误返回非零，但不保证整次恢复原子回滚，
失败后目标库可能不完整，须核证后处理。

| 模式 | 恢复前提与边界 |
|---|---|
| `full` | 含结构和数据；核对目标兼容性与权限，同名对象会被清理，额外对象仍保留 |
| `schema` | 仅结构，恢复后为空表，不是业务数据备份 |
| `data` | 目标表必须已存在且为空；入口按归档 TABLE DATA 检查，已有数据则拒绝；缺表仍会失败 |

同名异类对象（如表/视图）可能导致恢复中止；`--clean` 不删除备份之外的对象。
特殊字符表名有专门解析，仍须按实际 schema 验证。回到某时间点应使用完整配对备份，
不能以 data-only 或命令退出码代替 schema、逐表摘要、序列、关联和迁移版本核对。
数据库备份不包含 Redis、上传文件及其他绑定目录。

### 备份计划

仓库入口不提供自动调度、轮转、异地同步或独立恢复演练；这些部署侧措施须另行配置、
验证并留证，不能把命令存在写成已具备。演练需明确独立数据库/实例、目标保护、验证与清理。
历史 `85ceba53` 曾含独立脚本，但不在当前源码，恢复前须单独审查，不能照搬删除固定演练库的行为。

## 生产部署检查清单

- [ ] 已确认授权范围、发布窗口、实际目录/Compose、数据挂载与可信代理。
- [ ] 非默认密钥、`DEBUG=false`、版本变量和 CORS/HTTPS 配置正确。
- [ ] 构建提交、平台、六镜像及 release-set 一致；已完成必要模拟与功能验证。
- [ ] 数据库/认证等切换条件满足，配对备份通过隔离恢复，回滚目标明确。
- [ ] 按清单拉取、核对实际镜像，健康、代码身份和关键行为均已验证。
- [ ] 当前结果与未覆盖项写入 TEST_STATUS，详细报告与发布清单安全归档，备份运维措施已核准。

## 技术栈

FastAPI / SQLAlchemy / PostgreSQL、React / TypeScript、Caddy、Redis、Celery 与 Compose。
具体版本以依赖文件、Dockerfile 和 Compose 为准。

## 监控指南

### 健康检查

```bash
# 基础健康检查（生产网关会把 /api/health 重写为后端 /health）
curl http://localhost:6608/api/health

# 开发直连后端
curl http://localhost:8000/health

# 检查所有服务状态
docker compose ps

# 检查特定服务日志
docker compose logs backend --tail 50
```

### 关键指标

监控 CPU/内存、磁盘剩余量、API 延迟、数据库池等待、worker 队列和流式连接。
告警阈值按实际容量与业务基线设定；单一百分比不直接推出扩容或删除数据。

### 日志监控

只收集排查需要的限长、脱敏日志，例如 `docker compose logs --tail 50 backend`；
不把环境变量、令牌、Cookie 或无关个人信息写入证据。

### 告警建议

健康失败、连接池超时、队列持续积压、存储不足和流式资源释放异常均应有可追溯处理记录。

### 网关边界治理（生产候选）

以 `gateway/Caddyfile` 为配置源，原生 Caddy 限制如下：

| 边界 | 配置 |
|---|---|
| 请求头/体 | `64KB` / 游戏上传 `526385152` 字节（502 MiB，覆盖后端完整请求预算）、其余 `16MB`，超限分别 431 / 413 |
| server 超时 | read_header `5s`、read_body `30s`、write `0`、idle `2m` |
| 普通反代 | dial `5s`、响应头 `30s`、read `60s`、write `30s`、keepalive `30s` |
| `@api_stream` 五个 SSE 端点 | 响应头 `60s`，read/write `0`，后端 keepalive |
| AI 伙伴评分 | 响应头/read/write `180s`，与后端总预算和重试配套 |

server `write 0` 用于避免长 SSE 被连接写截止切断，不能只改 route transport。
没有通用 IP/租户限速或并发防护保证；需要时由经验证的 WAF/LB/API Gateway 提供。

配置检查入口为 `gateway/tests/test_caddy_config.sh`。发布前在独立网络/端口验证
413、431、超时、SSE、评分和现有反代；隔离证据不能代替公网边缘防护验收。

## DB 启动与视图迁移的提交合同

在线 Alembic runner 在同一事务中先取得固定 advisory lock，再扩容版本表并迁移；
提交或回滚释放锁。离线 SQL 生成不取得该锁。`migration_state.py` 只静态解析
revision 图，拒绝缺失、空、多行、未知 revision、非法 parent 及非单 head 图。

`v_conversations_with_deleted` 的最终 14 列定义由 forward revision
`f1a2b3c4d5e6` 负责。历史 `20260211_0004` 仅在当前 schema 没有同名关系且
全部投影依赖列齐全时创建；已有对象不重建，缺列暂不创建，交后续 migration
收敛。已执行该历史 revision 的库不会重跑；后续修复不能恢复早先已经丢失的
owner、ACL 或 comment，须另行核备份和授权记录。

Forward 在单事务内预读并恢复 owner、对象级有效显式授权及 grant option、注释和
对象级 security label，不保留原 grantor 的审计来源。列级 label、列级 ACL/comment、view reloptions、自定义 trigger/rule、
依赖对象、缺列或权限不足须失败并回滚，不使用 CASCADE，也不在 startup 用 DDL 兜底。
Downgrade 删除视图而非恢复旧定义/授权，不能当作无损生产回退；视图缺失由
readiness 拒绝服务，生产恢复须另验备份及权限来源。

`--initial-only` bootstrap 只为真正空库建立 legacy baseline；已有业务表但
缺失或空版本表须拒绝，不 stamp 冒充完成迁移。完整升级后普通 bootstrap
再处理兼容字段并检查合同；已有 head 的 startup 不执行 schema DDL。
`/health`（根路径）与 `/api/v1/health`（system health 路由，不含 `/system` 前缀）均返回
`status` 字段；当前代码未按 `status` 改写 HTTP 状态码，`/api/v1/health` 仅在异常路径
返回 503，`/health` 异常时仍返回 `unhealthy` 状态体，`/ping` 仅为 liveness。健康状态体、HTTP 状态与 `/ping` 的含义应分别核验；代码提交不代表运行栈已切换。

实际执行范围和首败/复测见 [TEST_STATUS](../testing/TEST_STATUS.md)；
本地提交不构成生产迁移、镜像发布或完整备份恢复的授权。

## 前端独立 HTML 目录入口与字体源

生产前端 Caddy 对 `/games/ai-partner/*` 明确处理；
`try_files {path} =404` 只允许命中该路径下真实存在的文件。
独立入口和 JS/静态资源缺失必须为 404，不得用主站 `/index.html` 刷出 200。
独立 HTML 保持 `no-cache`，字体源为 `'self' data: https://fonts.gstatic.com`
（`https://cdn.jsdelivr.net` 仅出现在 `style-src`，不扩大 object、base、form 边界，也不关闭 TLS 校验）。

验收须用同一候选配置及构建产物检查裸路径、目录、显式 HTML 与不存在资源；
检查 MIME、CSP、cache header 和双引擎原生交互。只挂载静态产物的 Caddy
运输验证不是全 production Dockerfile 构建、后台功能或真实字体渲染验收。
