# WangSh 全项目核查报告

> 核查日期：2026-10-15
> 核查范围：main（领先 origin/main 27 个提交）、工作树、运行栈、CI 门禁
> 方法：静态走读 + 本地实测 + 容器/log 实测 + 5 路并行只读诊断
> 基线：HEAD = `968ba9f`（2026-10-10）；origin/main = `a1a8fe2`（2026-09-28）

---

## 一、核心结论

**当前 main 推上去 CI 必红，且存在一条已进入 main 的合规级生产缺陷。**

三个层次的结论：

1. **CI 从未验证过这批提交。** origin/main 停在 2026-09-28，main 领先 27 个提交，最近一次 CI 成功是在「UI 门禁尚未接入」的状态下取得的。`6f4eb84`（UI 门禁接入，10-05）不是 origin/main 的祖先 —— 8 条 UI 门禁**从未在 CI 中执行过一次**。
2. **至少 6 条 CI 门禁当前为 FAIL**，分布在 UI 治理、markdown 合同、后端迁移三条独立链上。
3. **一条生产正确性缺陷已随 27 个提交进入 main 代码路径**：会话列表 Redis 缓存在 PostgreSQL 下 100% 静默失效，且两条写路径无缓存失效，其中一条是 GDPR 硬删除。

---

## 二、实测通过项（确认已落地）

| 项 | 实测结果 |
|---|---|
| 前端类型检查 `npm run type-check` | **exit 0** |
| 前端单测 `npm run test` | **750 passed / 103 files** |
| 前端 lint | **exit 0**（473 warnings，0 errors） |
| 生产构建 `npm run build:check` | **exit 0**（WARN：总 JS 12.78 MB > 10 MB 阈值；`editor.api2` chunk 3.5 MB） |
| `ui:spacing:ci` | **PASS**（1382，迁移率 45.72%） |
| `ui:audit:ci` | **PASS**（733 命中） |
| `ui:dead-layout:ci` / `ui:token-values:ci` / `ui:migration:ci` | **PASS** |
| `check-version-consistency.mjs` | **PASS**（version 2.1.3 / tag 2.1.3） |
| Celery Beat（原审计 C-5） | **确认运行中**，worker 日志有 `[INFO/Beat] Scheduler: Sending due task` |
| `beat_schedule` 4 个任务 | **全部存在且可导入**（pythonlab×2、data_archiving×2） |
| Alembic 迁移链 | **head 唯一**：`2de7995a8f24`，47 个迁移、1 root、1 head |
| SRI 加固（原 P0-6） | **9 个 integrity 全部配对 `crossorigin`** |
| CSP（原 P0-5） | **三份配置逐字一致**（`gateway/Caddyfile`、`Caddyfile.dev`、`frontend/caddy/Caddyfile.prod`） |
| `test_metrics.py`（原 P0-4） | **12 passed**（权限测试已同步） |
| 假数据占位路径（原 P0-7） | **已清除**：`debug_stub`、`fallback_analysis` 全仓库 0 命中 |

---

## 三、CI 门禁红灯清单（6 条，均无 `continue-on-error`）

### 3.1 `ui:verify:ci` — FAIL，36 个错误（结构性必然失败）

36 个错误**全部**是规则 5（`generated_at` vs 文件 mtime），36/36 份报告全灭。

**根因**：`frontend/scripts/ui-verify-gate.mjs:65` 用 `fs.statSync().mtimeMs` 作参照，容差 24h。mtime 不是 git 属性，由 checkout 时刻决定。

**实测证据**：
```
blob 与 HEAD 完全一致：f3b6ceb2750d12e8755a71653b7915a0b8c0de7e == HEAD:.../xbk.md
mtime:              2026-10-15T21:38      （今天 checkout 时刻）
generated_at:       2026-10-05T07:39:57Z  （生成时的真实时钟）
```
报告内容未经篡改，`generated_at` 是真实值。在全新 checkout 环境下 `|mtime − generated_at|` 随日历单调增长，**永远 > 24h → 必然红，且不会自愈**。

**修复方向**：参照系从 mtime 换为 `git log -1 --format=%ct -- <file>`，未提交文件才回退 mtime。

### 3.2 `ui:alpha:ci` — FAIL，120 处

**根因是「修了一半」的配置缺陷，不是代码写错。** 决定性证据：

```
tailwind.config.js:  alpha-value 出现 0 次，rgb( 出现 0 次
tailwind.config.js:14-15:  primary: { DEFAULT: "var(--ws-color-primary)" }
index.css: 10 个 --ws-color-*-rgb 三元组已全部定义
全仓库搜 "-rgb)" 消费点: 0 命中  ← 三元组定义了但无人使用
```

`index.css` 早在 `ad5288f`（10-05）就加好了 `-rgb` 三元组，但 `tailwind.config.js` 从未接上，因此 `alpha_capable = []`，`/N` 规则一条都不生成。

**我在构建产物上独立验证了后果**（`build/assets/style-DLwQL54S.css`）：
```
bg-surface\/90    → 0 命中
bg-surface\/95    → 0 命中
bg-primary\/10    → 0 命中
border-warning\/30 → 0 命中
实际只有: .bg-surface{background-color:var(--ws-color-surface)}
```
即这 120 处**静默失效**：`bg-surface/95` 类元素丢底色、`border-warning/30` 落到 Tailwind preflight 默认灰 `#e5e7eb`（错色而非无色）。

**修复方向**：把已存在的 10 个 `-rgb` 三元组接进 `tailwind.config.js`（`var(--ws-color-X)` → `rgb(var(--ws-color-X-rgb) / <alpha-value>)`），一处配置改动清零 120 处。

### 3.3 `ui:alpha:dead-classes:ci` — FAIL，7 个死类

```
[死类] 完全不生成 CSS 的颜色类：7 个（有死类即 exit 1）
```

已独立验证其中两类：
- `border-border-secondary`：**112 处调用**，`border-secondary` 色名在 `tailwind.config.js` 中不存在 → 0 CSS
- `text-2xs`（48 处）+ `text-3xs`（37 处）：变量在 `index.css:209-210` 有定义，但 `tailwind.config.js` 的 `fontSize` 只映射到 `2xl` → **85 处调用全部不生效**

### 3.4 `markdown-quality.yml` — FAIL，14 条合同错误

`check-markdown-contracts.mjs` EXIT=1，`markdown-contracts.test.mjs` 9 passed / 1 failed。

| 类别 | 数量 | 详情 |
|---|---|---|
| 真实断链 | 7 | `DATA_ARCHIVING.md`×3、`IMPLEMENTATION_SUMMARY.md`×1、`plans/README.md`×3 |
| 生命周期元数据缺失 | 6 | 3 个 plans 文档各缺 `> 状态` / `> Owner` |
| 派生摘要过期 | 1 | `TEST_STATUS.md` 写 `165/489`，实际 `170/494` |

**7 条断链的目标路径在 `git log --all --diff-filter=A` 下提交数均为 0 —— 从未存在过**（臆想路径，与该项目历史上的同类问题一致）。

其中 `plans/README.md` 的 3 条经查证**只活在 `stash@{0}` 的 untracked 树里**（124 个文件），从未被 commit，对任何 git 检查、clone、CI 完全不可见。

### 3.5 迁移门禁 — FAIL，阻断 CI 第一道

`backend/alembic/versions/291268877685_add_core_indexes_for_conversations.py:29-33` 的三个索引带 `if_not_exists=True`，触发 `backend/scripts/check_migration_state.py:267` 的 fail-closed 审查门：`unreviewed index guard/control flow; manual review required`。

该迁移由 `9c5bb3c` 引入，**不在 origin/main**。它同时导致：
- `test_migration_preflight_guard_contract.py` 6 项失败
- `test_xbk_active_selection_migration_isolated.py` 1 项失败（硬编码 head 已前移）

**影响**：CI 的 `migrate and bootstrap clean database` 以该脚本为首条命令 → **backend-pytest job 在第一步就挂，测试根本跑不到**。

### 3.6 `workflow-contracts.test.mjs` — FAIL，1 项

```
not ok 40 - CI runs repository governance gates
error: 'missing CI governance gate: python scripts/check_python_governance.py check'
```

`968ba9f`（提交主题正是「修复 CI 门禁路径错误」）把 CI 里的路径改成了 `backend/scripts/check_python_governance.py`，但**没有同步更新契约测试的期望值**（`scripts/workflow-contracts.test.mjs:1576` 仍期望旧路径）。修复 CI 的提交本身弄红了另一个 CI。

---

## 四、生产缺陷（已进入 main 代码路径）

### 4.1 会话列表缓存在 PG 下 100% 静默失效

`backend/app/api/endpoints/agents/ai_agents/conversations.py:30-35` 新增缓存：

```python
cache_key = compact_cache_key_generator("conversations:user", user_id, agent_id or 0, limit)
```

`list_user_conversations` 返回的 `last_at` 在 **PostgreSQL 下是 `datetime`**（实测 `pg_typeof` → `timestamp with time zone`），而 `cache.set`（`cache.py:180-183`）对 list 走 `json.dumps`：

```
json.dumps([{'last_at': datetime}]) → TypeError: Object of type datetime is not JSON serializable
```

`cache.set` 内部 `except Exception` 捕获后返回 `False` → **生产 PG 上缓存写入 100% 失败且静默**。而 SQLite 下 `last_at` 是 `str`（实测），写入成功 —— **测试环境与生产环境行为相反**。

### 4.2 两条写路径无缓存失效 → 合规问题

`agent_usage.py:133-142` 在写消息后会 `clear_pattern("conversations:user:{uid}:*")`，但另两条写路径完全没有失效：

| 写路径 | 位置 | 缓存失效 |
|---|---|---|
| 归档任务 `UPDATE ... SET is_archived=TRUE` | `app/tasks/data_archiving.py:29-33` | **无** |
| GDPR 硬删除 `delete(ZntConversation)` | `app/api/endpoints/management/users/privacy.py:195` | **无** |

后果：`list_conversations` 端点在 `conversations.py:21-25` **没有 `include_archived` 参数**，服务端硬编码归档过滤 → 归档后列表必须变化但缓存不失效；GDPR 删除接口声称「所有数据已永久删除」（`privacy.py:214`），但 60s 内再查列表仍可能返回已删除数据。

### 4.3 CI 里的 Redis 配置是死变量（假绿成因）

`.github/workflows/ci-quality.yml:86` 设了 `CONVERSATION_TEST_REDIS_URL: redis://127.0.0.1:56379/15`，但：

- **全仓库没有任何代码读取该变量**（`grep -rn` 除 CI yml 与一份历史报告外 0 命中）
- CI 也**没有设 `REDIS_HOST`/`REDIS_PORT`**，app 读默认 `6379`，而 CI Redis service 映射在 `56379`
- → CI 里 Redis 不可达，缓存降级，`test_conversation_list_isolated.py` **意外通过**

本地开发机 Redis 在 6379 可达，才暴露出上述缺陷。**CI 绿是假绿**，靠的是端口不匹配的巧合。

---

## 五、测试失败根因（37 failed / 7 errors）

| 失败文件 | 数量 | 根因 | 判定 |
|---|---|---|---|
| `test_conversation_list_isolated.py` | 28 | 缓存键无数据身份维度，跨用例碰撞（`user_id=11` 固定、`limit` 取值有限） | 真实回归 + 测试隔离缺陷 |
| `test_conversation_security.py` | 1 | 同源（import 复用前者 fixture，键空间重叠） | 同源 |
| `test_migration_preflight_guard_contract.py` | 6 | 新迁移 `if_not_exists=True` 命中审查门 | 真实回归 |
| `test_xbk_active_selection_migration_isolated.py` | 1 | 硬编码 head 已前移（同源，非独立缺陷） | 脆弱断言 |
| `test_agent_chat_contract.py` | 1 | `chat_blocking` 重构后 `get_agent` 下沉到 `chat_common`，monkeypatch 目标消失 | 真实回归（非行为回归） |
| `test_gdpr_compliance.py` | 7 ERROR | **仓库从未有 conftest.py，也从未安装 pytest-asyncio** | 测试从未可运行 |

**关键交叉验证**：
```
单文件本机运行：        28 failed
REDIS_PORT=6399 运行：  63 passed   ← Redis 不可达则全绿
origin/main worktree：  63 passed   ← 27 个提交之前是绿的
```
因果链确立：**这 29 项由 27 个未验证提交引入**。

---

## 六、基础设施与运行环境

### 6.1 实际运行状态（修正初始判断）

只有**一套**栈在运行：`wangsh-remediation-v9-*`（7 个容器，Up 37-38h，全部 healthy），跑的是 **codex artifact 里的 compose，不是仓库的 compose**。`wangsh-b05a-20261015-*` 6 个容器**已于约 1 小时前全部 Exited**（backend ExitCode=137，其余 0）——我此前观察到的是退出前的残留。

### 6.2 发现的问题

| 项 | 状态 | 证据 |
|---|---|---|
| **清理任务双投递** | 确认 | `startup.py:155-182` 的后端进程内循环仍在 `send_task(cleanup_orphans/cleanup_stale_sessions)`，与 Celery Beat 重叠。日志实测每 5 分钟接收 **2 次**（`22:54/22:57/22:59/23:02/...`，奇数分钟来自 Beat，整五分来自 startup 循环） |
| `docker.sock` 挂载范围 | 偏大 | 挂在 **backend**（`docker-compose.yml:209`）与 pythonlab-worker（`:314`），dev 同。缓解措施只有注释建议，等于 API 进程持有宿主 root 级控制权 |
| 归档 beat 任务从未验证 | 确认 | `archive-old-conversations`（周 cron）/`archive-old-analyses`（月 cron）在日志采样窗口内 0 次触发 |
| `pythonlab-sandbox` 服务 | 名不副实 | `docker-compose.yml:322-345` 是 `sleep infinity` 占位服务，未 `network_mode: none`、无 `read_only`/`cap_drop`；真实沙箱是 backend 动态创建的容器 |
| 真实沙箱隔离 | 较好 | `docker.py:236-264`：`no-new-privileges`、`cap-drop ALL`、`--user 1000:1000`、`pids-limit`、内存/CPU 限制、tmpfs `noexec/nosuid`、plain 模式 `--network none` |
| 孤儿资源堆积 | 约 25 GB 可回收 | Volumes 4.08 GB（90% 可回收）、Build Cache 22.76 GB（20.36 GB 可回收）、8 个无存活容器的网络 |
| dev compose 缺 `pythonlab-sandbox` | 确认 | 生产有、开发无 |

### 6.3 用户级容器回收缺口（代码推断）

`cleanup_orphans`（`pythonlab.py:466-478`）的用户级分支用字面量 `"orphan"` 调 `terminate_session`，但 `owns()`（`docker_runtime.py:264-271`）要求 `session_id`/token/container_id 三者匹配 → **必然拒绝**。代码注释明说是故意保守，回收走 `cleanup_stale_sessions`。

缺口在于：当某用户 Redis meta 被驱逐、但 `debug:user:{uid}:sessions` 集合仍存活时，`cleanup_orphans` 的 `scard>0` 分支主动保活，而 `stop_session`（`pythonlab.py:602-604`）走 `skip_provider_stop=True` 永久跳过删除 —— 两个保守分支叠加，容器无人回收。**此为代码推断，未实测复现**（当前 sandbox 容器数为 0，无孤儿）。

---

## 七、待回收的本地工作进程（`stash@{0}`）

`stash@{0}: On codex/release-2.2.0-prep` 含 **124 个 untracked 文件**，包括 2026-10-10 ～ 10-14 的 plans、archive、session-reports，以及一份 2026-10-14 的 `plans/README.md`。

- `refs/stash` 不在 `git log --all` 的可达性语义里 → **这些文档对任何 git 检查、clone、CI 完全不可见**，随时可能被 `git stash drop` 抹掉
- 该 stash 自带的 `plans/README.md` **自身有 8 条断链**（目标也只在同一条 stash 里）
- `main` 的 `plans/README.md` 引用的 3 个文件，正是只活在这条 stash 里的那 3 个

另有一条 `stash@{1}: WIP on main: 74886db` 和 `stash@{2}: On feature/ui-optimization-2026-07`。

---

## 八、文档一致性

`docs/docker/plans/README.md` 是重灾区：13 个条目里只有 6 个是「有索引且实际存在」的正常态（一致率 46%）。

- **声称存在但缺失**：3 个（只在 stash 里）
- **声称已移除但实际仍在**：4 个（`968ba9f` 只改了 README 表格，文件一个没删，archive 也没加）
- **存在但未索引**：5 个

`TEST_STATUS.md` 记录了一批**从未提交**的修复（`:22-37` 声称「11 条错误已清零」「6 条断链已修复」），实测对应改动不在任何提交里，这 4 条断链现在仍在。**该文档声称门禁绿，实际全红** —— 会误导接手人跳过验证。

另发现一个**静默门禁盲区**：`check-markdown-contracts.mjs:13` 的 `git ls-files` 未传 `-c core.quotepath=false`，两个中文名 md 被八进制转义后 `fs.existsSync` 失败、被静默丢弃 → 含非 ASCII 文件名的 md **永久逃过所有合同检查**。

---

## 九、建议的修复顺序

按「解除 CI 阻断 + 消除生产风险」的性价比排序：

| 优先级 | 项 | 理由 |
|---|---|---|
| **P0** | 迁移门禁（3.5） | 不修则 CI 在第一步挂，其余测试跑不到 |
| **P0** | 缓存正确性（4.1 / 4.2 / 4.3） | 已进入 main 代码路径；含 GDPR 合规问题；且 CI 假绿使其无法被捕获 |
| **P1** | `ui:verify:ci` 规则 5（3.1） | 结构性必然失败，一行参照系改动清零 36 个错误 |
| **P1** | `ui:alpha:ci`（3.2） | 约 10 个色名映射改动清零 120 处 + 修复 120 处静默视觉降级 |
| **P1** | `ui:alpha:dead-classes:ci`（3.3） | 197 处调用（112+48+37）当前完全不生效 |
| **P1** | `workflow-contracts.test.mjs`（3.6） | 一处期望值同步 |
| **P2** | markdown 14 条（3.4） | 纯文档，但阻断 `markdown-quality.yml` |
| **P2** | 后端测试修复（第五节） | 缓存隔离、monkeypatch 目标、conftest/pytest-asyncio |
| **P2** | 清理任务双投递（6.2） | 去掉 startup 循环或 Beat 之一 |
| **P3** | 资源回收（约 25 GB）、stash 抢救（第七节） | 无功能影响，但 stash 内容有丢失风险 |
| **P3** | 文档索引重建（第八节） | 索引与实际双向不一致 |

---

## 十、`codex/release-2.2.0-prep` 分支盘点

**关键事实**：该分支是 main 的**严格直接延续**（merge-base == main tip `968ba9f`，可 fast-forward，0 分叉），领先 15 个提交，**172 files / +22587 / −3458**。全部为 `fix`/`refactor`/`feat(scripts|backend)` 形态，**无 feature commit**；约 1/3 改动量是新增测试（`backend/tests` +5511 行、前端 30+ 测试文件）。**无文件删除、无重命名、无 Python 依赖变更。**

### 10.1 它修了什么（实测确认）

| 项 | 验证结果 |
|---|---|
| `ui:alpha:ci`（3.2） | **已修**。`tailwind.config.js` 的 `alpha-value` 出现 **30 次**（30 处 `rgb(var(--ws-color-X-rgb) / <alpha-value>)`），main 的 0 次 → 120 处归零 |
| CI `env consistency` step（不存在的脚本） | **已修**。`92e2438` 补齐 `scripts/check-env-consistency.mjs` + `env-consistency.test.mjs` |
| 视图漂移静默 500 | **已修**。`cb3ed34` 删除 `startup.py` 的 DDL 兜底 + 静默吞异常路径，视图定义收敛到唯一迁移 `f1a2b3c4d5e6` |
| `/health` 假健康 | **已修**。main 的 `/health` 只要 DB+Redis 活着就报 healthy，而 `docker-compose.yml:184` 正拿它当 readiness gate；分支改为未就绪返回 **503** |

### 10.2 它**没有**修的红灯（合并后依然红）

已用 `git diff --stat` 逐项确认 **0 行改动**：

- `ui:verify:ci` 规则 5 mtime（3.1）—— 未碰 `ui-verify-gate.mjs`
- `docs/docker/plans/README.md` 3 条断链（3.4）—— 未碰 `docs/docker/plans/` 任何文件
- `workflow-contracts.test.mjs` governance 路径（3.6）—— 未碰
- 迁移门禁预检（3.5）—— `.github/workflows/` 与 `docker-compose*.yml` **完全 0 行改动**

**所以准确定性是**：它是「运行时缺陷修复集 + 语义色/迁移安全加固」，**不是「CI 红灯修复集」**。

### 10.3 新增迁移（生产迁移安全重点）

新增 `backend/alembic/versions/f1a2b3c4d5e6_rebuild_conversations_with_deleted_view.py`（424 行），`down_revision = 2de7995a8f24`（main 当前 head），新 head = `f1a2b3c4d5e6`（单 head 保持）。

它做的是**破坏性 DDL**：`DROP VIEW`（**无 CASCADE**）→ 重建 14 列 → 同一事务内恢复 owner / ACL / comment / security label。

**合并前必须验证（不可跳过）**：
1. 在**生产库副本**（非空库）跑 `alembic upgrade head`
2. 确认迁移角色有 `ALTER VIEW ... OWNER TO` 权限 —— 否则整个事务回滚，API 永远 503
3. 确认生产 `alembic_version` **恰有 1 行**（多行会被 `validate_revision_state()` 拒绝）
4. 确认视图无 `reloptions` / 列级 ACL / 非内部 trigger / 自定义 rule（任一存在即 raise）
5. **回滚预案必须写清：回滚 = 前滚，不是 `alembic downgrade`**（`downgrade()` 是 DROP VIEW，之后所有流量 503）
6. 该迁移**无法恢复早先已丢失的元数据** —— 若生产库的视图 owner/ACL 已被 `CREATE OR REPLACE` 时期冲掉，这次会把**错误的现状固化**

同时修改了历史 revision `20260211_0004`（`CREATE OR REPLACE VIEW` → 条件化 `CREATE VIEW`）。对已执行过该 revision 的存量库无影响，但**空库全量初始化路径必须实跑**。

### 10.4 需人工复核的风险点

| # | 风险 | 说明 |
|---|---|---|
| 1 | `bootstrap_db.py` 用 SQLAlchemy **私有 API** | `table._columns.remove()` 等（无公开 API），且是空库初始化关键路径 |
| 2 | `contentRuntimeLoader.ts` 移除 HTML 中全部 8 个 CDN 脚本 | 改为运行时异步加载，**无重试、无超时**；`markmap-view`/`markmap-lib` 的 URL 从 `/dist/index.js` 改为 `/dist/browser/index.js` —— 若该路径不存在，Markmap 全站失效且只表现为一个事件，无硬失败 |
| 3 | 学习进度 API **破坏性语义变更** | PATCH 新增版本要求：缺版本返回 **428**、陈旧返回 **409**。需前后端同时上线 |
| 4 | Three.js `0.180` → `0.186` + 阴影降级 | `PCFSoftShadowMap` → `PCFShadowMap`，跨 6 个 minor 版本，视觉效果需真机看 |
| 5 | `531e323` 全站色彩系统重构 | `--ws-color-*` 令牌 49 → 247，**品牌色变更**（primary `#36776F`→`#0F766E`，accent Teal→Violet `#4F46E5`，bg `#F0FDFA`→`#F8FBFC`），`AGENTS.md` 色彩表同步。需真机逐页看 |
| 6 | 迁移 AST 摘要豁免机制 | `check_migration_state.py` 的豁免是「**任何** AST 摘要等于已知哈希的迁移都获豁免」，范围由哈希碰撞面决定，需复核白名单审查记录 |
| 7 | `.github/workflows/` 与 compose 未跟随代码语义变更 | CI 的 `migrate and bootstrap` step 未加 view-contract 断言；compose 启动链未同步 `bootstrap_db.py` 的语义变更 |

### 10.5 明文密钥扫描

**未发现任何明文密钥被提交。** `password`/`secret`/`token` 命中项全部为合成测试值（`"synthetic-only"` 等）、指纹比较代码、或 `.env.example` 占位符。

---

## 十一、待决策项（需用户判断）

1. **`codex/release-2.2.0-prep` 是否合并** —— 它能一次性解决 `ui:alpha`（120 处）+ CI 断链 + 一组运行时缺陷，但**不能**解决 `ui:verify` / markdown / workflow-contracts 三条红灯。且它含一个破坏性 DDL 迁移和一次全站色彩系统重构，需要按 §10.3 逐条验证。**建议：不要以「合并后 CI 转绿」为理由合并。**
2. **`ui:alpha` 的两条修复路径选哪条** —— 若不合 release 分支，则需自行在 main 上把 `-rgb` 三元组接进 `tailwind.config.js`（约 10 个色名映射）。
3. **`stash@{0}` 的 124 个文件是否恢复** —— 含 10-10～10-14 的工作进程，但恢复后的 `plans/README.md` 会把断链从 3 条推高到 8 条，**不要直接提升**。
4. **`plans/README.md` 的 3 条断链如何处置** —— 从 stash 恢复文件，还是删掉表格行 + 清理「已移除」的虚假声明。
5. **会话列表缓存的处置** —— 修复（键加数据身份维度 + 补两条失效路径 + 换 JSON 序列化器），还是直接回滚这段缓存（PG 上它本就 100% 失效，回滚零功能损失）。
