# 当前测试状态

> 状态：active
> Owner：project-governance
> 当前版本：1.6.0
> 最近更新：2026-07-14
> 说明：本文件是当前测试事实的唯一汇总入口；阶段报告只引用本页，不复制新基线。

## 一、发布基线

下表记录截至 2026-07-14 的 `main` 主线本地验证。治理提交已推送；首轮 GitHub
runner 暴露的 clean-install 和测试环境问题已在本地修复并复验，本页不把修复结果
提前外推为远端 runner、registry 或正式生产结果。

| 类别 | 当前结果 | 覆盖内容 | 状态 |
|---|---|---|---|
| 后端全量 | `661 passed, 3 skipped, 9 warnings` | API、服务、迁移、脚本与核心业务回归 | 最终分支通过 |
| 前端全量 | `67 files / 338 passed` | 单元、组件、权限与页面回归 | 最终分支通过 |
| TypeScript | `tsc --noEmit` | 类型合同 | 已通过 |
| 前端 lint | `0 errors / 521 warnings` | ESLint 错误门禁与历史 warning 基线 | 已通过错误门禁 |
| 前端脚本 | `19 passed` | bundle、Pyodide、token、生产 UI smoke 辅助逻辑 | 已通过 |
| Workflow contracts | `30 passed` | GitHub Actions 路径、依赖、日志脱敏和发布合同 | 已通过 |
| Python governance | `0 errors / 4 warnings` | Python 文件规模与圈复杂度 ratchet | 已通过错误门禁 |
| Alembic | 单一 head | 四条新增 migration、bootstrap、空库升级 | 已通过 |
| Compose | 开发/生产配置解析通过 | 服务、环境变量、镜像与网络合同 | 已通过 |
| 前端生产构建 | bundle `WARN` | Entry `0.96 MB`、Deferred `11.61 MB`、Total `12.58 MB` | 构建通过，预算 warning 非阻断 |
| Markdown 链接 | `120 files / 264 links / 0 missing` | 当前文档、学习章节与归档相对链接 | 已通过 |
| Markdown contracts | `10 passed` | 链接/锚点、仓库边界、生命周期、归档、章节数量和 workflow 触发 | 已通过 |
| 生产模拟 | `14/14 PASS` | API、数据库、Redis、Celery、PythonLab 与日志 | 已通过 |
| UI smoke | `13/13 PASS` | 登录、后台、关键页面与 PythonLab UI | 已通过 |
| OpenAPI sweep | `89/89 OK` | 可执行只读 API 探针 | 已通过 |

## 二、当前提交验证

### Commit 1：认证、会话和用户权限

提交：`2d46feb fix: harden auth sessions and user management`

2026-07-12 对 21 个提交文件重新验证：

| 检查 | 结果 |
|---|---|
| 后端认证、会话和用户管理 | `60 passed, 9 warnings` |
| 前端认证组件 | `3 files / 10 passed` |
| TypeScript type-check | 通过 |
| 暂存区格式检查 | 通过 |
| 规格审查 | 通过 |
| 独立代码质量审查 | 通过；发现的会话交叉并发阻断均已完成 TDD 修复 |

本批新增覆盖：refresh token 原子轮换、旧 session nonce logout 不撤销新会话、停用用户
不可刷新、双并发登录只保留一个可刷新会话、登录/refresh/logout 使用一致用户锁顺序、
同名账号唯一消歧、管理员用户管理边界、登录竞态、StrictMode 初始化、
`/task-analysis/*` HttpOnly Cookie 深链恢复和认证探测超时收敛。

### Commit 2：IT 游戏、学习平台和内容功能

提交：`751689d feat: add IT game repository and harden learning surfaces`

2026-07-12 从 `2d46feb` 创建临时工作树，只应用当前暂存补丁后验证：

| 检查 | 结果 |
|---|---|
| 后端 IT、文章、信息学、XBK 与迁移启动专项 | `117 passed, 9 warnings` |
| 前端全量 | `65 files / 321 passed` |
| TypeScript type-check | 通过 |
| 前端生产 build | 通过 |
| Alembic | 单一 head `20260624_0001_add_it_game_tables` |
| 暂存区格式检查 | 通过 |

本批审查后补齐：IT 游戏前后台路由及管理员角色守卫、下载 Blob 避免二次复制与 Query
缓存失效、列表失败态、超长中文文件名与符号链接隔离、Typst 陈旧 PDF 缓存拒绝、
重复资产路径规范化和旧 PDF 延迟清理、Markmap 数值 SVG 尺寸、XBK 超限展示和
当前页导出，以及普通用户无法通过分类接口读取草稿或作者邮箱。

`build:check` 的 bundle budget 在纯净 `2d46feb` 基线同样失败；Commit 5 已将其收口为
可追踪的非阻断 warning，当前生产构建通过。

### Commit 3：课堂、AI agents 和异步任务

提交：`c584cc4 fix: enforce classroom ownership and async analysis consistency`

课堂访问控制、活动计划、Redis Pub/Sub、异步分析和前端分析页已完成提交级验证。后续
工作区补充了 typed/legacy 删除边界、broker 发布失败状态、worker 丢失重投递和课堂
服务拆分；相关组合专项于 2026-07-13 为 `141 passed`。

### Commit 4：Assessment 和数据库迁移

提交：`0e6d42a fix: formalize assessment and database migrations`

Assessment 正式迁移、legacy Alembic 兼容、bootstrap 和单一 head 已验证通过。

### Commit 5：前端路由、UI 和 bundle 合同

提交：`f4db083 refactor: enforce frontend route and bundle contracts`

当前前端全量 `67 files / 338 passed`，TypeScript、19 个脚本测试和生产构建通过；
lint 为 `0 errors / 521 warnings`，bundle 总量保持非阻断 warning。

### Commit 6：综合治理、服务拆分、清理和文档收口

提交：`79a0c95 Streamline project structure and remove obsolete code`

该提交合并收口原计划的 CI/脱敏、后端服务拆分、25 个已验证删除入口和文档治理范围。
2026-07-13 对其中 CI/脱敏增量完成独立复核：

| 检查 | 结果 |
|---|---|
| Workflow contracts | `28 passed` |
| prod-smoke 系统测试 | `10 passed` |
| Python/Node 语法 | 通过 |
| 7 个 workflow YAML 解析 | 通过 |
| actionlint | 先前独立复核通过；本轮本机未安装，使用 YAML 解析和 28 个合同测试复核 |

本批补齐：所有 PythonLab 实时 smoke 统一经过 `redact_exec.py`；普通退出码和信号退出码
正确传播；跨行凭据、非法 UTF-8、持管道孙进程、转义 JSON、Cookie、Basic、URL userinfo
和已知环境值均有回归覆盖。`run.py` 不再把宿主无关 secrets 广播给子进程，子脚本报告会
递归脱敏并以私有权限重写，Phase C 每轮日志也不再原样落盘。现有历史证据也已收紧为
目录 `0700`、文件 `0600`。小组讨论 smoke 已删除
硬编码密码候选，只接受显式注入凭据；由于历史源码中曾存在有效候选，对应管理员凭据
必须在发布前轮换。

### Commit 7：发布治理文档校正

提交：`2313e6f Update release governance docs for consolidated commit history`

该提交把原八提交计划校准为真实的综合收口历史，删除“Commit 6-8 仍在工作区”的陈旧
描述，并保持 `TEST_STATUS.md` 为唯一动态测试状态入口。

## 三、2026-07-14 最终 HEAD 验证

| 检查 | 最终结果 |
|---|---|
| 后端全量 | `661 passed, 3 skipped, 9 warnings` |
| 前端全量 | `67 files / 338 passed` |
| 前端脚本 | `19 passed` |
| TypeScript | 通过 |
| ESLint | `0 errors / 521 warnings` |
| 生产构建与 bundle | 构建通过；总量 `12.58 MB`，保持非阻断 warning |
| Workflow contracts | `30 passed` |
| Markdown contracts | `10 passed` |
| Markdown 链接 | `120 files / 264 links / 0 missing` |
| Python governance | `0 errors / 4 warnings` |
| Compose | 开发、生产配置解析通过 |
| Alembic | 单一 head `20260711_0002_restore_legacy_baseline_indexes` |
| 版本 | `1.6.0` 一致 |
| workflow YAML | 8 个文件解析通过 |
| 隔离生产模拟 | `14/14 PASS` |
| UI smoke | `13/13 PASS` |
| OpenAPI sweep | `89/89 OK` |
| 模拟清理 | `wangsh_sim` 容器、网络、卷和 workspace 均清空 |

第一次生产模拟在最后 UI smoke 创建页面时遇到 Docker Desktop/Chromium 运行时整体中断；
恢复环境后，UI smoke 单独复测 `13/13 PASS`。随后从零重跑完整模拟得到单次
`14/14 PASS` 并自动清理，因此最终结论以第二次完整模拟为准。

### Main clean-runner 收口

首次推送 `f2de61b` 后，GitHub Actions run `29309768777` 暴露两类本地旧环境未发现的问题：

- `npm ci` 拒绝 `echarts@6` 与 `echarts-wordcloud@2.1.0` 的 peer 冲突；项目收敛到
  插件支持的 `echarts@5.6.0`，并用隔离目录重新执行完整前端 CI 链。
- 后端安全配置只位于 migration step，pytest 无法继承；现统一为 job-level 测试配置，
  保留生产 fail-fast，并使用合法 Fernet 测试键。
- 环境修复后，两个 refresh-token 集成测试暴露对预置用户的依赖；测试现各自创建和
  清理用户，在空 PostgreSQL 经完整 Alembic 升级后全量通过。

本轮本地证据：隔离 `npm ci` 成功、前端 `67 files / 338 passed`、前端脚本
`19 passed`、后端 `661 passed, 3 skipped, 9 warnings`、workflow contracts
`30 passed`、`git diff --check` 通过。修复后的 GitHub Actions 结论待推送后确认。

## 四、功能测试矩阵

| 域 | 主要验证内容 |
|---|---|
| 认证权限 | 登录、refresh、logout、用户管理、角色路由、深链返回 |
| 课堂与 AI | 活动、计划、分组讨论、Redis Pub/Sub、Celery、深度分析 |
| 数据库 | Alembic 单 head、四条 migration、bootstrap、空库升级 |
| IT 与内容 | IT 游戏、学习平台、信息学、文章、XBK |
| 前端工程 | Vitest、type-check、lint、CSS token、UI audit、bundle |
| PythonLab | Run、Debug、DAP、Continue、owner concurrency、可见性 |
| 发布 | Compose、workflow contract、prod-smoke、日志脱敏、release-set |

## 五、证据与保留策略

发布相关证据保留在：

```text
test-results/prod-smoke/summary.json
test-results/prod-smoke/api-results.json
test-results/prod-smoke/ui-results.json
test-results/prod-smoke/openapi-sweep.json
test-results/prod-smoke/screenshots/
test-results/prod-smoke/step-logs/
test-results/prod-smoke/service-logs/
```

不提交可重建噪声：`frontend/build/`、`coverage/`、`.coverage`、`.pytest_cache/`、
`__pycache__/`、临时浏览器 `page-*` / `console-*` 文件，以及系统临时目录中的
PythonLab 验证快照。证据不得包含有效 token、Cookie、密码或其他密钥。

## 六、待执行验证

- 提交并推送当前 clean-runner 修复。
- 在真实 GitHub Actions runner 上确认修复后的通用 CI。
- 验证 Docker Hub 六镜像 manifest、`release-set.txt`、数据库升级、备份恢复和回滚。

## 七、重跑入口

```bash
cd backend
venv/bin/pytest -q
venv/bin/python scripts/check_python_governance.py check

cd ../frontend
npm run test
npm run test:scripts
npm run type-check
npm run lint
npm run build:check

cd ..
node --test scripts/workflow-contracts.test.mjs
docker compose --env-file .env.example -f docker-compose.dev.yml config --quiet
docker compose --env-file .env.example -f docker-compose.yml config --quiet
git diff --check
```

完整生产模拟：

```bash
IMAGE_TAG=1.6.0 \
IMAGE_REPOSITORY_PREFIX=shuhao07 \
SIM_RUN_PROD_SMOKE=true \
SIM_CLEANUP=true \
bash scripts/deploy.sh simulate
```
