# WangSh 项目整理、验证与发布收口计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans`
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> 状态：active
> Owner：project-governance
> 最近复核：2026-07-14
> 归档条件：当前分支完成 PR、release-set、生产迁移演练和最终文档归档

**Goal:** 用尽量简单的结构整理测试结果、测试内容、Markdown 文档和剩余工作区，
形成可审查提交、可重复验证和可追溯发布证据。

**Architecture:** 只保留一个当前测试状态文档、一个文档索引和一个执行计划。历史接力、
阶段报告和旧计划在长期结论沉淀后转为 archive 或 redirect。原计划按八个提交收口；
实际 Git 历史保留前五个专题提交，并由 `79a0c95` 合并收口剩余治理、拆分、清理和文档，
最终从分支 HEAD 执行完整本地门禁、远端 PR 和发布验收。

**Tech Stack:** FastAPI、pytest、SQLAlchemy、Alembic、PostgreSQL、Redis、Celery、
React 19、TypeScript、Vitest、Playwright、Docker Compose、GitHub Actions。

---

## 2026-07-13 Markdown 整理完成记录

### 完成范围

- 审计项目自有 Markdown，合并重复内容，归档历史正文，删除确认无唯一价值且无引用的老旧文件。
- 只保留一个当前执行计划、一个当前测试状态、一个健康报告和各主题 owner 文档。
- 同步修正 `docs/README.md`、目录 README、archive 索引和全部相对链接。

### 已确认决定

- 当前 dirty worktree 中已有文档和代码修改必须保留，不按 tracked/untracked 状态判断垃圾。
- 部署、回滚、数据库、CI、安全、PythonLab 和测试恢复资料不直接删除。
- 已整合但可能存在旧链接的文档保留短 redirect；日期型历史正文优先归档。
- 本轮不新增重复的最终报告；整理结果回写本计划、`TEST_STATUS.md` 和 owner 索引。

### 整理结果

- `docs/**/*.md` 整理后共 56 份；项目自有 Markdown（含学习章节）共 120 份。
- 项目 Markdown 由 129 份收缩到 120 份；删除 9 份未提交且已被 owner 文档完整替代的
  phase1-4、validation、cleanup handoff 和重复归档。
- 两个 ignored 生成物 `backend/.pytest_cache/README.md` 和
  `test-results/prod-smoke/failures.md` 已清理并由合同检查阻止回归。
- 已完成计划正文移入 `docs/docker/archive/plans/`，原路径保留短 redirect；
  `docs/docker/archive/README.md` 是唯一归档索引。
- 文档维护与 owner 规则合并到 `docs/DOCUMENTATION_RULES.md`；UI 样式、单页体检和
  回归清单合并到 `ui-single-page-governance.md`；PythonLab 能力清单合并到功能
  owner 文档，旧 tracked 路径只保留 redirect。
- 当前测试事实统一由 `docs/docker/testing/TEST_STATUS.md` 维护；当前发布动作统一由
  本计划维护；30/60/90 计划只维护发布后的长期治理。
- 新增 `scripts/check-markdown-contracts.mjs`、
  `scripts/markdown-contracts.test.mjs` 和 `markdown-quality.yml`，只读检查链接、
  锚点、结构、生命周期、归档索引和派生统计，不自动删除或移动文档。

### 本轮验证

- `node scripts/check-markdown-contracts.mjs`：
  `120 files / 264 links / 0 missing`。
- `node --test scripts/markdown-contracts.test.mjs`：`10 passed`。
- `node --test scripts/workflow-contracts.test.mjs`：`28 passed`。
- `node scripts/check-version-consistency.mjs`：版本一致为 `1.6.0`。
- `bash -n scripts/deploy.sh`、全部 workflow YAML 解析和 `git diff --check` 通过。

Markdown 整理已经完成并进入 `79a0c95`。最终分支 HEAD 的本地门禁和隔离生产模拟
已于 2026-07-14 通过；剩余动作是合并到 `main`、复验、推送并观察真实 GitHub runner。
本轮不新增第二份整理报告。

## 2026-07-13 CI 与日志脱敏接力

### 当前目标

- 收口 Commit 6 的 GitHub Actions、production smoke 和日志脱敏合同。
- 独立验证脱敏包装器是否保留子进程退出码，已知敏感值是否从 `run.py`
  贯穿子进程、前置检查、异常和服务日志。
- 确认 PythonLab PR/远程 workflow 的真实 smoke 命令均经过实时脱敏包装，
  且规则不会明显破坏正常诊断信息。

### 已确认决定

- smoke 凭据统一使用 `PYTHONLAB_SMOKE_USERNAME` /
  `PYTHONLAB_SMOKE_PASSWORD`；浏览器脚本密码只通过环境变量传递。
- 实时 smoke 输出使用 `scripts/prod-smoke/redact_exec.py`，落盘日志使用
  `scripts/prod-smoke/redact.py`。
- 脱敏至少覆盖 query 参数、Bearer/Basic、JSON、Python 单引号字典、
  Cookie/Set-Cookie、password、api_key 和已知环境敏感值。
- workflow 合同测试不能替代真实 GitHub runner、Docker/PythonLab 全栈和
  WebSocket 失败路径验证。

### 已完成成果

- worker 已实现 `redact_exec.py`、扩展 `redact.py` / `run.py`，并调整
  PythonLab PR 与远程 workflow。
- worker 报告 `node --test scripts/workflow-contracts.test.mjs` 为
  `21/21 passed`，Python AST、Node 语法、三个 workflow YAML 和
  `git diff --check` 通过。
- 主 agent 独立复核后新增并修复误清洗、多词/转义结构、跨行凭据、非法 UTF-8、
  信号退出码、持管道孙进程、子进程环境广播、子报告落盘和 Phase C 每轮日志问题。
- 当前定向结果：workflow contracts `28 passed`，prod-smoke 系统测试 `10 passed`。

### 当前问题

- 历史源码中曾存在与本地有效管理员凭据重合的硬编码候选；代码已删除，但凭据仍需
  在发布前轮换。
- 尚未执行真实 GitHub runner、Docker/PythonLab 全栈或 WebSocket 401
  故障注入；这些必须与本地合同测试结论分开记录。

### 下一步

1. 将治理分支合并到本地 `main`，在合并结果上重跑最小可靠门禁。
2. 完成管理员凭据轮换，不把本地或远端有效凭据写入仓库。
3. 推送 `origin/main`，并等待真实 GitHub runner 验证。

## 一、当前基线

| 项目 | 当前状态 |
|---|---|
| 分支 | `codex/project-governance-release-1.6.0` |
| 工作区 | 干净；代码、治理和发布状态已形成提交 |
| 已暂存 | 空 |
| 已提交 | 前五个专题提交、综合收口 `79a0c95`、治理文档校正 `2313e6f` |
| 后端全量 | `661 passed, 3 skipped, 9 warnings` |
| 前端全量 | `67 files / 338 passed` |
| 前端 lint | `0 errors / 521 warnings` |
| 前端脚本 | `19 passed` |
| Workflow contracts | `28 passed` |
| Python governance | `0 errors / 4 warnings` |
| 生产模拟 | `14/14 PASS`，UI `13/13 PASS` |
| Markdown | 120 份、264 个相对链接、0 断链 |
| 发布状态 | v1.6.0 尚无远端 Git tag 和 Docker Hub 六镜像 release-set |

本地提交已收口，工作区干净。后端、前端、脚本、workflow contracts、Compose、
Python governance、Markdown、格式检查和隔离生产模拟已从最终分支 HEAD 重新执行并
通过。远端 runner、registry 和生产迁移演练仍未完成。

## 二、整理原则

1. 不再新增重复的“最终报告”；当前测试事实只维护一份权威文档。
2. 原始测试日志只保留对发布有价值的 smoke、截图和失败诊断，不提交可重建噪声。
3. owner 文档描述当前行为，计划文档描述未来动作，archive 只保存历史。
4. redirect 保留旧链接，不复制旧正文。
5. 每个代码批次必须包含对应测试；文档在最终文档批次统一收口。
6. 不使用 `git add -A`，只按批次清单显式暂存。
7. 不 commit、不 push、不发布镜像，除非用户明确授权对应动作。

## 三、阶段 1：统一测试结果和测试内容

**Files:**

- Create: `docs/docker/testing/TEST_STATUS.md`
- Modify: `docs/docker/testing/README.md`
- Modify: `docs/docker/RELEASE_NOTES.md`
- Modify: `docs/docker/plans/2026-07-11-project-health-and-improvement-report.md`
- Reference: `docs/docker/plans/2026-07-11-change-batch-manifest.md`

- [x] **Step 1：建立唯一测试状态文档**

`TEST_STATUS.md` 固定只包含：

1. 当前版本和验证日期。
2. 后端、前端、脚本、workflow、Compose、migration、浏览器和生产模拟结果。
3. 每类测试覆盖的功能。
4. 跳过项、warning 和未执行的远端验证。
5. 对应证据路径和重跑命令。

- [x] **Step 2：整理测试内容矩阵**

按以下七个功能域记录测试范围：

| 域 | 主要验证内容 |
|---|---|
| 认证权限 | 登录、refresh、logout、用户管理、角色路由、深链返回 |
| 课堂与 AI | 活动、计划、分组讨论、Redis Pub/Sub、Celery、深度分析 |
| 数据库 | Alembic 单 head、四条 migration、bootstrap、空库升级 |
| IT 与内容 | IT 游戏、学习平台、信息学、文章、XBK |
| 前端工程 | Vitest、type-check、lint、CSS token、UI audit、bundle |
| PythonLab | Run、Debug、DAP、Continue、owner concurrency、可见性 |
| 发布 | Compose、workflow contract、prod-smoke、日志脱敏、release-set |

- [x] **Step 3：整理测试证据**

保留：

```text
test-results/prod-smoke/summary.json
test-results/prod-smoke/api-results.json
test-results/prod-smoke/ui-results.json
test-results/prod-smoke/openapi-sweep.json
test-results/prod-smoke/screenshots/
test-results/prod-smoke/step-logs/
test-results/prod-smoke/service-logs/
```

删除或不提交：

```text
frontend/build/
coverage/
.coverage
.pytest_cache/
__pycache__/
临时浏览器 page-* / console-* 文件
系统临时目录中的 PythonLab 验证快照
```

- [x] **Step 4：统一当前基线**

当前数字只维护在 `docs/docker/testing/TEST_STATUS.md`。Release Notes、CI/CD、健康报告
和计划文档只引用该状态页；必须保留的历史数字要明确标记为阶段快照。

**阶段验收：**

```bash
rg "594 passed|306 passed|61 files" docs --glob '!docs/docker/archive/**'
git diff --check
```

Expected：活跃文档不再把旧数字描述为当前基线。

## 四、阶段 2：整理全部 Markdown 文档

**Files:**

- Modify: `docs/README.md`
- Modify: `docs/docker/README.md`
- Modify: `docs/docker/plans/README.md`
- Modify: `docs/docker/archive/README.md`
- Modify: `docs/DOCUMENTATION_RULES.md`
- Redirect: `docs/DOCUMENTATION_OWNERSHIP.md`

- [x] **Step 1：按五类重新审计项目自有 Markdown**

| 分类 | 处理方式 |
|---|---|
| owner | 保留为当前唯一权威说明 |
| active plan | 只保留仍有未完成动作的计划 |
| reference | 保留稳定清单、模板和低频参考 |
| redirect | 保留短链接，不恢复旧正文 |
| archive | 保存历史，不作为当前操作指南 |

- [x] **Step 2：固定权威文档**

以下文档保持 active/owner：

```text
README.md
docs/README.md
docs/DOCUMENTATION_RULES.md
docs/ENGINEERING_GOVERNANCE.md
docs/development/API.md
docs/docker/deploy/DEPLOY.md
docs/docker/deploy/CICD.md
docs/docker/testing/README.md
docs/docker/testing/TEST_STATUS.md
docs/docker/RELEASE_NOTES.md
docs/features/*.md
```

- [x] **Step 3：收缩计划目录**

当前发布完成前保留 active：

```text
2026-07-11-change-batch-manifest.md
2026-07-12-project-consolidation-and-release-plan.md
2026-07-11-project-governance-30-60-90-execution-plan.md
```

健康报告作为带日期的 `reference` 快照保留，不承担实时测试或执行权威。

已删除未提交且已完全替代的 phase1-4、validation 和 cleanup 临时 handoff；当前事实由
`TEST_STATUS.md`，整理结论由健康报告，执行顺序由本计划维护。发布完成后：

- `change-batch-manifest.md` 转 archive。
- 本计划转 archive。
- 30/60/90 计划只保留尚未完成的长期改进项。

- [x] **Step 4：验证索引和链接**

Run:

```bash
node - <<'NODE'
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const files = execFileSync("rg", [
  "--hidden", "--files", "-g", "*.md",
  "-g", "!node_modules/**", "-g", "!frontend/node_modules/**",
  "-g", "!backend/venv/**", "-g", "!data/**", "-g", "!.git/**",
], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const missing = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, "");
    if (!raw || raw.startsWith("#") || /^[a-z]+:/i.test(raw)) continue;
    const target = decodeURIComponent(raw.split("#")[0]);
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) missing.push(`${file} -> ${raw}`);
  }
}

if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`markdown relative links OK: ${files.length} files`);
NODE
git diff --check
```

Expected：`docs/README.md`、目录 README 和 archive README 能找到所有重要文档；
相对链接缺失为 0。

## 五、阶段 3：提交收口记录

原计划按八个提交拆分。实际执行保留 Commit 1-5，并将原 Commit 6-8 及后续后端服务
拆分统一收口为 Commit 6。为避免未经授权改写已形成的 Git 历史，不再重排或 amend。

### Commit 1：认证、会话和用户权限

状态：已提交 `2d46feb`；规格审查、质量审查和定向验证通过。

Commit:

```bash
git commit -m "fix: harden auth sessions and user management"
```

前置条件：用户明确授权 commit。

### Commit 2：IT 游戏、学习平台和内容功能

Test:

```bash
cd backend
venv/bin/pytest -q tests/it tests/articles

cd ../frontend
npm run test -- --run \
  src/components/Auth/ITGamesAccess.test.ts \
  src/components/adminITFeatureFlagsAsync.test.tsx \
  src/components/asyncLearningEditors.test.tsx \
  src/components/mindMapViewer.test.tsx \
  src/components/mindmapGalleryAsync.test.tsx
npm run type-check
```

Commit:

```bash
git commit -m "feat: add IT game repository and harden learning surfaces"
```

### Commit 3：课堂、AI agents 和异步任务

状态：已提交 `c584cc4`。

Test:

```bash
cd backend
venv/bin/pytest -q \
  tests/classroom \
  tests/group_discussion \
  tests/ai_agents/test_agent_deep_analysis.py \
  tests/test_pubsub.py
```

Commit:

```bash
git commit -m "fix: enforce classroom ownership and async analysis consistency"
```

### Commit 4：Assessment 和数据库迁移

状态：已提交 `0e6d42a`。

Test:

```bash
cd backend
venv/bin/alembic heads
venv/bin/pytest -q \
  tests/assessment \
  tests/system/test_bootstrap_db.py \
  tests/system/test_migration_state_check.py \
  tests/system/test_startup_database_init.py
```

Expected：Alembic 只有
`20260711_0002_restore_legacy_baseline_indexes` 一个 head。

Commit:

```bash
git commit -m "fix: formalize assessment and database migrations"
```

### Commit 5：前端路由、UI 和 bundle 合同

状态：已提交 `f4db083`。

Test:

```bash
cd frontend
npm run test
npm run type-check
npm run lint
npm run test:scripts
npm run build:check
```

Commit:

```bash
git commit -m "refactor: enforce frontend route and bundle contracts"
```

### Commit 6：Docker、PythonLab、CI 和发布合同

状态：已由综合收口提交 `79a0c95 Streamline project structure and remove obsolete code`
完成；该提交同时包含后端服务拆分、25 个已验证删除入口和文档治理。

Test:

```bash
docker compose --env-file .env.example -f docker-compose.dev.yml config --quiet
docker compose --env-file .env.example -f docker-compose.yml config --quiet
node scripts/check-version-consistency.mjs
node --test scripts/workflow-contracts.test.mjs

cd backend
venv/bin/python scripts/check_python_governance.py check
venv/bin/pytest -q \
  tests/pythonlab \
  tests/system/test_prod_smoke_compose_context.py \
  tests/system/test_smoke_openapi_sweep.py
```

实际提交：

```text
79a0c95 Streamline project structure and remove obsolete code
```

### Commit 7：删除已验证无引用代码

状态：未形成独立提交；25 个删除入口已包含在 `79a0c95`，删除清单保持不变。

范围严格限制为变更批次清单中的 25 个删除入口。

Test:

```bash
git diff --cached --name-status
git diff --cached --diff-filter=D --name-only
git diff --cached --diff-filter=D --name-only | wc -l
cd backend && venv/bin/pytest -q
cd ../frontend && npm run test && npm run type-check && npm run build:check
```

Expected：暂存区只包含清单列出的 25 个删除入口，删除计数为 25。

### Commit 8：文档和治理收口

状态：未形成独立提交；文档和治理范围已包含在 `79a0c95`，后续准确性修正使用新的小提交。

包含：

- 本计划。
- `TEST_STATUS.md`。
- 文档索引和 archive 索引。
- Release Notes、部署、CI/CD、功能 owner 文档。
- 变更批次清单和最终健康报告。

Test:

```bash
git diff --check
node scripts/check-version-consistency.mjs
node --test scripts/workflow-contracts.test.mjs
```

## 六、阶段 4：完整本地发布门禁

状态：已于 2026-07-14 从最终分支 HEAD 完成，不复用 dirty worktree 结果。当前结果见
[`TEST_STATUS.md`](../testing/TEST_STATUS.md)。

重跑入口：

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

随后运行隔离生产模拟：

```bash
IMAGE_TAG=1.6.0 \
IMAGE_REPOSITORY_PREFIX=shuhao07 \
SIM_RUN_PROD_SMOKE=true \
SIM_CLEANUP=true \
bash scripts/deploy.sh simulate
```

Expected：

- 后端、前端和脚本无失败。
- lint 保持 0 errors。
- production smoke `14/14 PASS`。
- UI smoke `13/13 PASS`。
- 模拟容器、网络、卷和 workspace 全部清理。
- 开发栈仍可访问。

## 七、阶段 5：远端 PR 和发布验证

- [ ] 合并治理分支到本地 `main`，并在合并结果上复验。
- [ ] 推送 `origin/main`。
- [ ] 等待 push 触发的通用 CI 和相关 workflow 全部通过。
- [ ] 将真实 workflow run 结果写入 `TEST_STATUS.md`。
- [ ] 构建并推送六个 staging 镜像。
- [ ] 六个 staging manifest 全部可读取后推广正式 `1.6.0`。
- [ ] 生成并验证 `release-set.txt`。
- [ ] 不默认推送 `latest`。

远端镜像集合：

```text
shuhao07/wangsh-backend:1.6.0
shuhao07/wangsh-frontend:1.6.0
shuhao07/wangsh-gateway:1.6.0
shuhao07/wangsh-typst-worker:1.6.0
shuhao07/wangsh-pythonlab-worker:1.6.0
shuhao07/pythonlab-sandbox:1.6.0
```

## 八、阶段 6：数据库演练和最终归档

- [ ] 使用脱敏备份或隔离数据库执行 `alembic upgrade head`。
- [ ] 验证 assessment 字段、约束和 5 个 legacy 索引。
- [ ] 使用旧版本 release-set 演练镜像回滚。
- [ ] 验证数据库备份恢复。
- [ ] 更新最终健康报告和 Release Notes。
- [ ] 将已完成 manifest 和本计划移入 archive。
- [ ] 更新 `docs/README.md`、plans README 和 archive README。
- [ ] 更新 `TEST_STATUS.md` 和健康快照，不再新增重复的“最终报告”。

## 九、停止条件

出现以下任一情况立即停止进入下一阶段：

1. 当前批次测试失败。
2. 暂存区出现清单外文件。
3. Alembic 出现多 head 或空库升级失败。
4. 测试报告保存有效 token、Cookie 或密码。
5. production smoke 有 FAIL。
6. GitHub Actions 未通过。
7. 六镜像或 release-set 不完整。
8. 数据库备份、恢复或回滚无法验证。

## 十、推荐执行顺序

1. 提交最终验证状态文档。
2. 合并到本地 `main` 并重跑最小可靠门禁。
3. 推送 `origin/main`，执行真实 GitHub Actions。
4. 另行授权后再发布六镜像和 release-set。
5. 完成数据库演练、文档归档和最终报告。
