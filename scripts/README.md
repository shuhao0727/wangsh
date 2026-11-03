# 根层脚本说明

`scripts/` 放跨模块、运维和统一入口；模块脚本留在各自目录。
历史清理记录见 [归档索引](../docs/archive/README.md)。先确认目标配置与授权，
检查、发布、恢复、重置是不同操作，不要把下列入口当成一串连续命令。

## 当前结构

| 入口 | 用途 |
|---|---|
| `deploy.sh` | 镜像构建/核验、部署、隔离模拟、备份恢复 |
| `rollback.sh`、`migrate-db.sh` | 数据库回滚与迁移 |
| `health-check-detailed.sh` | API 与必要容器健康检查 |
| `prod-smoke/` | 全链路 smoke 与共享日志脱敏 |
| `xbk/` | XBK 增量种子、导入样例与 smoke |
| `prepare-production-simulation.py` | 将 Compose 配置转为独立卷/网络/回环端口的模拟配置，拒绝未知挂载 |
| `clean-local-artifacts.sh` | 临时产物清理，默认预览 |
| `sync-ai-partner-catalog.mjs` | 检查/生成 AI 伙伴前端目录副本 |
| `check-version-consistency.mjs` | 以前端 package 版本为源核对完整 SemVer |
| `check-env-consistency.mjs` / `compose-config.mjs` | 在内存解析 Compose canonical JSON，按服务核对 bind 与启动生效连接/密钥；未知目标不视为隔离，缺生产配置只做受限 dev-only 核验 |
| `dev-containers.mjs` | 只读核对同名容器的 Compose 来源与 bind，拒绝生产/外树/未知来源，不执行删除 |
| `dev-processes.py` | start/stop 共用的 UID/cwd/明确 CLI/进程身份守卫；按具体 PID 停止，不执行全局模式信号 |
| `check-markdown-contracts.mjs` | 文档链接、生命周期、归档和派生数字 |
| `*.test.mjs`、`test_dev_processes.py` | 临时合成配置和假 Docker/进程替身合同；不启停真实服务。后端与网关另有自含隔离专项入口 |

## 常用入口

### 检查与隔离模拟

```bash
node scripts/check-version-consistency.mjs
node scripts/check-markdown-contracts.mjs
node --test scripts/markdown-contracts.test.mjs
bash scripts/health-check-detailed.sh
```

健康脚本默认访问网关 6608：API 要求 HTTP 2xx 且唯一顶层 `status=healthy`，
frontend、gateway、数据库、Redis 和两个 worker 须有健康状态。宿主不需 Python，
由 backend 容器解析 JSON；健康通过不证明代码版本和业务验收完成。

```bash
# 使用本地生产镜像，运行完整 smoke 后清理本次隔离栈
SIM_RUN_PROD_SMOKE=true SIM_CLEANUP=true bash scripts/deploy.sh simulate
```

只启动模拟可用 `bash scripts/deploy.sh simulate`，默认端口 16608、保留成功栈。
模拟不读正式 release-set，不代替真实供应商或生产验收。

### 对已确认环境运行 smoke

```bash
PROD_SMOKE_ALLOW_LIVE=true ./scripts/prod-smoke/run.sh
```

该 smoke 会改变状态，目标和范围须获准；开关本身不代表授权。
PythonLab 凭据经 secret 注入 `PYTHONLAB_SMOKE_USERNAME` / `PYTHONLAB_SMOKE_PASSWORD`，
不用明文命令参数。小组分析可用 `ANALYSIS_AGENT_ID` 指定现有分析智能体；
隔离环境使用供应商桩时须标明，不能据此宣称真实模型通过。

### 发布入口

| 命令 | 用途 |
|---|---|
| `bash scripts/deploy.sh build` | 本地生产构建 |
| `bash scripts/deploy.sh verify-local-images` | 核对本地镜像与平台 |
| `bash scripts/deploy.sh push` | 推送本地业务镜像；须有推送授权 |
| `bash scripts/deploy.sh verify-release-set release-set.txt` | 校验清单、版本、Compose 与远端 digest |
| `bash scripts/deploy.sh deploy` | 拉六个业务镜像，复核 RepoDigest，禁止隐式拉取启动并等待健康 |
| `bash scripts/deploy.sh up-no-build` | 同时核对远端清单/本地 RepoDigest 后启动，不拉取或构建 |

正式发布优先用 CI；手工 push 不自动产生 release-set。构建、推送和服务器部署分别
按授权执行，完整步骤见 [部署指南](../docs/operations/DEPLOY.md)。

### 数据操作

| 命令 | 影响 |
|---|---|
| `bash scripts/migrate-db.sh current` / `history` | 查看迁移状态/历史 |
| `bash scripts/migrate-db.sh upgrade <revision>` | 预检后升级已审核 revision |
| `bash scripts/deploy.sh backup-db full` | 备份配置选中的 postgres；也支持 schema/data |
| `bash scripts/deploy.sh restore-db <备份文件> --yes` | 写入已确认目标库，可能清理同名对象；不是演练 |
| `bash scripts/rollback.sh rollback -1 --image-tag <旧版本>` | 停写、备份后用旧镜像回退；须核对目标 revision 与旧 release-set |
| `python scripts/xbk/run_all.py` | 增量种子、样例导入与 smoke，仍会写数据 |
| `python scripts/xbk/run_all.py --reset` | 清空并重建本地 XBK，仅在明确获准时使用 |

rollback 停止/备份失败不执行 downgrade，只恢复原先运行的写服务；恢复失败单独报错。
进入 downgrade 后写服务保持停止，待数据库核证及旧 release-set 部署验收；
`--no-backup` 仅在明确获准跳过新备份时使用。备份轮转和隔离恢复演练没有自动入口。

### 清理与目录同步

```bash
bash scripts/clean-local-artifacts.sh            # 只预览
bash scripts/clean-local-artifacts.sh --apply    # 按已确认范围删除
node scripts/sync-ai-partner-catalog.mjs --check
```

清理限源码白名单中已忽略、无跟踪文件的缓存及 `backend/.coverage`；不进入工作树、
虚拟环境、业务数据、上传、依赖和构建目录，不跟随符号链接，始终保护 `.codex/`。
默认保留浏览器证据；`--include-browser-artifacts` 可纳入预览，另加 `--apply` 才删除，
先确认 `.playwright-mcp`、`.playwright-cli`、`output/playwright` 的证据已保留。

AI 伙伴只编辑 `backend/app/services/ai_partner_catalog.json`，再运行
`node scripts/sync-ai-partner-catalog.mjs --write` 生成 `frontend/ai-partner/src/catalog.json`。
两份随同一次变更审查，提交另按授权；运行时后端不跨目录读取前端副本。

## 维护边界

`prod-smoke/log_redaction.py` 只处理传入文本/配置，不加载 env 或执行命令。
runner 保留兼容入口，`redact.py` / `redact_exec.py` 直接复用纯模块，可独立于编排器导入。
修改时运行 workflow 与后端 smoke 合同，覆盖流式输出、退出码、信号和敏感值脱敏。

生产模拟的隔离、凭据/证据权限与失败清理由 [DEPLOY](../docs/operations/DEPLOY.md)
维护；测试覆盖和结果归 [测试说明](../docs/testing/README.md)及 TEST_STATUS，
本页只保留脚本入口。
