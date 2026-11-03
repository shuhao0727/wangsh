# CI/CD 工作流说明

> 状态：active
> Owner：release-ops
> 最近复核：2026-11-02

本文维护 GitHub Actions 的触发、门禁、凭据与镜像发布合同；操作步骤由
[DEPLOY.md](DEPLOY.md) 维护，执行结果见 [TEST_STATUS.md](../testing/TEST_STATUS.md)。
工作流源码位于 `.github/workflows/`，修改后同步本页，不把历史通过写成当前保证。

## 一、概览

代码 PR / main push 运行适用的质量检查；镜像发布须另行手动触发。
发布 workflow 核对 main → 质量门禁 → 构建六镜像 → 推广版本标签 → 生成 release-set。
服务器再按部署授权校验清单、拉取、核对 digest、启动及验收；推送镜像不等于已部署。

## 二、GitHub Actions 工作流

### 2.1 dockerhub-amd64.yml — 镜像构建与推送

| 项目 | 合同 |
|---|---|
| 触发 | 仅 `workflow_dispatch`，concurrency 串行，不取消在途发布 |
| 输入 | `image_tag` 必须与源码完整 SemVer 一致；默认值以 workflow 为准。`push_latest` 默认 false |
| 源码 | `refs/heads/main`，检出 SHA 必须等于联网 fetch 后的 `origin/main` |
| 前置 | reusable `ci-quality.yml` 成功后才构建 |
| 平台 | 六镜像均为 `linux/amd64` |
| 凭据 | `DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN` |

发布与 PythonLab PR 构建通过 build args 使用 Docker Hub 官方基础镜像；本地 Dockerfile
默认源仍可配置。输入经环境变量传给 shell，不直接拼接执行。

六镜像先推 `${image_tag}-build-${run_id}`；全部 staging manifest 可读后才推广版本 tag，
逐镜像核对 registry digest，上传 `release-set-${run_id}` artifact。
清单中的逻辑名须与镜像仓库 basename 一致，所有已设置版本变量保持同一版本。

正式 deploy/pull-up 拉取后、up-no-build 启动前均复核本地 RepoDigest；只更新六个业务
镜像，PostgreSQL/Redis 不随应用隐式升级。具体清单校验与健康要求见部署指南。

### 2.2 pr-pythonlab-owner-gate.yml — PR 门禁（并发）

影响 PythonLab、sandbox、Celery、认证/启动依赖、Monaco、Compose 或共享脱敏实现的 PR
调用 `pythonlab-pr-runtime.yml`。runner 启动当前 PR 合并结果的 PG、Redis、backend、
Celery、sandbox 和 Vite，先跑 Chromium 真实 pointer-click 调试/多断点 Continue，再跑 owner matrix。

Fork PR 使用临时本地账号，不读取仓库 secrets。密码经 step env 传递，不进命令参数；
浏览器与 Python smoke 通过 `redact_exec.py` 实时脱敏，保留退出码/信号语义。
失败仅发布限长、脱敏日志并清理资源。pointer smoke逐场景输出固定错误码与阶段，不把原始错误
或页面/变量快照写stdout；详细报告和截图不自动对外上传。调试、断点及完成条件helper变更
同时触发两条PR门禁。CI的Chromium不替代CLAUDE要求的Chrome channel/WebKit专项验收。

> 2026-11-01：原远端巡检工作流 `pythonlab-owner-concurrency.yml` 与 `pythonlab-phasec-gate.yml`
> 已删除；对已部署环境的巡检改在本地用 `backend/scripts/` 下同名 smoke/soak 脚本执行。

### 2.3 pr-pythonlab-phasec-gate.yml — PR 门禁（Phase C）

与 owner PR 门禁共享运行时影响路径，另覆盖 Phase C 脚本。调用相同临时全栈运行时，
执行可见性 probe、默认 5 轮 soak 和 Chromium 真实点击 smoke；失败留脱敏日志并清理。

共享 runtime 在迁移后只对一次性 CI 合成库做 AUTH enrollment，再独立确认 ready；
未 ready 时认证返回 503。此步骤不得直接用于生产，正式切换走 AUTH owner 的停流/排空流程。

### 2.4 ci-quality.yml — 通用质量门禁

PR、main push 及 `workflow_call` 触发；普通 PR/push 仅改 `docs/**`、`**/*.md` 时跳过，
文档由独立 workflow 检查。各 job 的实际命令以工作流为准：

| 范围 | 检查 |
|---|---|
| 仓库配置 | 版本一致性、workflow/env fixture、shell 语法、两套 Compose 配置与镜像标签 |
| 整理/模拟 | 临时仓库中的清理保护、目录生成一致性、模拟挂载/网络/端口隔离；不操作真实业务资源 |
| 开发安全专项 | fake Docker 容器来源、canonical 配置/有效覆盖、备份父子路径、exact-PID 进程身份；后端端点与网关预算使用自含离线用例 |
| 数据库 | 单 Alembic head、legacy baseline 后完整升级；专用 PG/Redis |
| 后端 | dev 依赖、文件规模/复杂度 baseline 防放宽、一次 pytest 同时生成 coverage |
| 前端 | 干净 npm ci、脚本测试、token、Vitest（主应用与 ai-partner 子应用各一套配置）、type-check、lint、UI baseline、生产构建与 bundle budget |

测试专用 PG `55433`、Redis `56379` 和安全配置统一在 job env，迁移/bootstrap/pytest
使用同一环境；不设 `DEBUG=true` 绕过安全校验。密钥使用测试专用非默认值与合法格式。
ECharts/词云 peer major、manifest 与 lockfile 由 workflow contracts 校验。
前端锁文件须在无旧 `node_modules` 的 Node 20 / npm 10 环境中验证普通 `npm ci`；
生产 Dockerfile 的 `--legacy-peer-deps` 安装结果不能替代此检查，不以宽松参数绕过缺失 peer 条目。
后端发布前同时运行普通治理检查及相对原发布基线的 `--base-ref`，不能只看默认 check 的 errors=0。
保存端点软校验的19项自含用例只在 `repo-config` 的隔离Python入口运行；`backend-pytest`
精确排除该模块以防正常app导入冲突，不排除其他用例或coverage；workflow合同锁定两处。

以下仍为非阻断或有限覆盖，不得写成完整端到端已过：

- changed-lines coverage（普通变更行 85%、认证/权限/迁移关键路径 95%）以 `continue-on-error: true` 出报告。
- 核心业务 smoke 暂做后端 import/前端 `node --check`，也为 `continue-on-error`；真实 HTTP、浏览器、模型与完整栈需另验。
  后端 import 脚本捕获异常后只打印失败列表，不返回失败退出码；还须检查日志，步骤绿色不证明全部导入成功。
- `token:check:ci`、`ui:audit:ci` 与 Python governance 不得通过抬高 baseline 掩盖新增问题。

### 2.5 markdown-quality.yml — 文档质量门禁

PR/main push 修改 Markdown、合同脚本或本 workflow 时运行
`node --test scripts/markdown-contracts.test.mjs`，覆盖链接/锚点、围栏/H1、生命周期、
redirect、archive 索引、学习章节与派生统计。文档-only 改动仍有门禁，不代表应用测试已跑。

## 三、部署接口边界

Compose、环境变量、生产模拟、release-set、数据库备份/恢复及回滚统一见
[DEPLOY.md](DEPLOY.md)；跨模块脚本见 [scripts/README.md](../../scripts/README.md)。
本页不复制操作命令，CI 发布也不授权生产切换。

## 四、Docker 镜像清单

默认命名空间为 `shuhao07`，版本与源码一致：

| 镜像 | Dockerfile / target |
|---|---|
| `wangsh-backend` | `backend/Dockerfile.prod` / `backend_runtime` |
| `wangsh-typst-worker` | 同上 / `worker_runtime` |
| `wangsh-pythonlab-worker` | 同上 / `pythonlab_worker_runtime` |
| `wangsh-frontend` | `frontend/Dockerfile.prod` / `production` |
| `wangsh-gateway` | `gateway/Dockerfile` |
| `pythonlab-sandbox` | `backend/docker/pythonlab-sandbox/Dockerfile` |

## 五、所需 Secrets

| Secret | 用途 |
|---|---|
| `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` | 镜像发布登录 |
| `PYTHONLAB_SMOKE_USERNAME` / `PYTHONLAB_SMOKE_PASSWORD` | 远端专项 workflow 账号 |

远端专项还需 API URL；PR runtime 使用合成账号，不读取远端凭据。
不在日志、报告、命令参数或仓库明文保存 secret。

## 六、当前质量基线

当前数字、失败、warning 和未执行项汇总到 TEST_STATUS，详细证据按批次存入
`docs/archive/testing/`；发布事实写 RELEASE_NOTES，不在指南重复维护动态结果。
`build:check` 的 bundle error、Python governance error 会使对应门禁失败；warning
留治理台账，不提高阈值掩盖。是否阻止 PR 合并还取决于仓库 required checks 配置。
本地通过不替代真实 runner、生产迁移、恢复/回滚或用户验收。
