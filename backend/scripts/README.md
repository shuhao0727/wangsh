# 后端脚本说明

本目录维护后端验证、数据库初始化和质量检查入口。历史清理见
[归档索引](../../docs/archive/README.md)，pytest 隔离前提见 [测试说明](../tests/README.md#常用命令)。

未另注目录时，本文命令从 `backend/` 执行；治理检查和整套烟测明确从仓库根目录运行。
保留 `__init__.py`，确保 `scripts.bootstrap_db` 不与根目录同名工具包混淆。

## 当前入口

### 数据库与迁移

- `bootstrap_db.py`：`--initial-only` 仅为空库创建迁移前 legacy baseline，不 stamp；随后须完整执行 `alembic upgrade head`。独立 metadata 副本排除迁移管理索引（含原生 SQL），防止扩展前创建 trgm 索引；XBK 保留迁移前整数年份，不提前建学年约束，由原迁移转换。该分支不改全局 metadata 或现有正常库。
- `check_migration_state.py`：迁移前只读 AST revision 图和目录快照。仅审核指纹、完整目录均匹配时豁免特定等价索引；未知 guard、异结构及跨 schema 同名均阻断，不执行迁移模块。兼容与回退见 [DEPLOY](../../docs/operations/DEPLOY.md)。

### 代码质量与覆盖率

- `check_python_governance.py` - Python 文件物理行数与 AST 圈复杂度 ratchet 检查
- `check_changed_lines_coverage.py` - changed-lines 覆盖率门禁（审计 T-2 / 治理 §4.3）

### 功能验证与测试

[tests/ai_agents/test_async_analysis.py](../tests/ai_agents/test_async_analysis.py) 检查任务签名、路由和 schema；
按测试说明核验 collection 前隔离后，在运行器中选择该文件。它不证明真实 Redis、Celery worker、模型调用或结果落库。
接口边界见 [AI_AGENTS](../../docs/features/AI_AGENTS.md#深度分析异步任务)。

### 烟测套件

- `smoke_openapi_sweep.py` - 只读 GET 广覆盖扫雷
- `smoke_feature_suite.py` - users/articles/xbk/classroom 等核心 CRUD 烟测；学习内容部分拆分在同目录 `_smoke_feature_learning.py`，由本脚本导入，不单独执行
- `smoke_assessment_flow.py` - 测评主链路烟测
- `smoke_xxjs_dianming.py` - 点名链路烟测
- `smoke_full_deploy.py` - auth/articles/informatics/agents 综合验证
- `smoke_group_discussion.py` - 小组讨论链路验证
- `smoke_typst_pipeline.py` - Typst 编译链路验证

### PythonLab 专项验证

- `smoke_pythonlab_ws_owner_concurrency.py` - PythonLab owner 并发验证
- `smoke_pythonlab_dap_step_watch_soak.py` - PythonLab DAP 步进 soak
- `smoke_pythonlab_print_visibility_probe.py` - PythonLab print 可见性探针
- `soak_pythonlab_phasec.py` - PythonLab Phase C 专项门禁

## PythonLab owner 并发 smoke

`OWNER_MODE=matrix` 先用 `auto` 探测 owner 行为，停止 detect session，再按探测结果或
`EXPECT_OWNER_BEHAVIOR` 严格断言。阶段切换仅重试精确错误
`已有会话仍在使用运行环境或状态未知，请先停止旧会话。`；不吞掉认证、HTTP、断言或未知错误。

- `RUNTIME_CLEANUP_TIMEOUT_SECONDS` 默认 45 秒，同时限制创建和 READY 轮询；耗尽报 `lifecycle`，退出码 `EXIT_DETECT=4`。
- runtime-busy 最多创建 3 个候选 session；`RUNTIME_RETRY_INTERVAL_SECONDS` 默认 1 秒，指数退避上限 4 秒。
- `/stop` 的 200 仅表示接受异步清理。全部已创建 ID 在 `finally` 再次幂等 stop，不代表已证明 runtime 释放。
- `requests`、`aiohttp` 版本由 `requirements-dev.txt` 维护；`pythonlab-pr-runtime.yml` 安装完整开发依赖，Phase C 与 owner workflow 安装同版本最小集合。

## changed-lines 覆盖率门禁

读取 pytest-cov JSON（`--cov-report=json`，默认 `backend/coverage.json`）与 Git diff：普通文件 ≥85%，
关键路径 ≥95%。关键路径为 `backend/app/core/deps.py`、`backend/app/api/endpoints/auth`、
`backend/app/core/security*`、`backend/alembic/versions/`。后者被 `.coveragerc` omit，无数据时
报告 `NO DATA` 并告警，不计入数值门禁。

先在已核验的隔离运行器中为所选测试生成覆盖率；不得为产报告在普通 shell 全量运行 pytest。
报告须对应本轮源码和测试范围，再执行以下只读检查：

```bash
# 本地：未提交改动（含 staged + unstaged）vs HEAD
venv/bin/python scripts/check_changed_lines_coverage.py --worktree

# 本地：只查已 staged 改动
venv/bin/python scripts/check_changed_lines_coverage.py --cached

# CI/PR 场景：提交 diff 对比 base（默认 origin/main；CI 传 PR base SHA / push before SHA）
venv/bin/python scripts/check_changed_lines_coverage.py --base-ref origin/main
```

退出码：0 通过，1 门禁失败，2 配置错误。`.coveragerc` 固定
`source=app`，omit `venv/`、`tests/`、`alembic/`。

## 归档目录

- `archive/add_missing_indexes.sql` - 尚待逐项对照 Alembic 和真实查询的历史索引草案，
  文件内置 psql 拒绝执行保护，不能直接作为生产结构变更入口

2026-11-02 删除 `seed_ai_content.py`、`seed_agents_content.py`（课程内容已迁移到
`frontend/src/features/it-technology/courses/*/content/` 的版本化资源）与
`smoke_pythonlab_low_memory_start_failure.py`（手工故障注入工具，未接入任何门禁）。

历史清理记录见 [归档索引](../../docs/archive/README.md)。

## 分层说明

- 统一生产烟测入口：[`../../scripts/prod-smoke/run.sh`](../../scripts/prod-smoke/run.sh)
- 后端 pytest 用例：[`../tests/README.md`](../tests/README.md)

## 使用建议

- 整套烟测从仓库根目录用 `bash scripts/deploy.sh simulate`。直接执行 `scripts/prod-smoke/run.sh` 须有对应授权并设置 `PROD_SMOKE_ALLOW_LIVE=true`；开关本身不构成授权。
- 单模块选对应 `smoke_*.py`。状态型 smoke 会创建用户、课程、会话等；清理失败保护完善前，仅在 simulate 隔离栈或专用环境运行。
- 一次性探针放临时目录；清理须核对用途、引用和恢复证据，不重新堆回本目录。

## Python 治理检查

以下命令从**仓库根目录**运行。固定扫描 `backend/app/**/*.py`，以 `len(source.splitlines())`
统计物理行，使用 `ast` 计算 McCabe 风格分支复杂度。

```bash
# 门禁：配置错误返回 2，治理违规返回 1，通过返回 0
python3 backend/scripts/check_python_governance.py check

# CI/PR 场景从 Git base 读取旧 baseline，阻止放宽或静默转移债务
python3 backend/scripts/check_python_governance.py check --base-ref origin/main

# 仅输出报告；即使发现治理错误也返回 0，配置错误仍返回 2
python3 backend/scripts/check_python_governance.py report

# 仅在当前工作树已验证且获准维护基线时更新，不用来刷绿
python3 backend/scripts/check_python_governance.py snapshot \
  --source-ref worktree-YYYY-MM-DD-verified
```

治理规则：

- baseline 外文件 `501-700` 行为 warning，`>700` 为 error；历史文件不得超过逐文件 ceiling。
- baseline 外函数复杂度 `13-15` 为 warning，`>15` 为 error；历史函数不得超过逐函数 ceiling。
- 条件分支中同一作用域的同名函数使用确定性 `#1`、`#2` 后缀区分；`match`
  只有存在无 guard 的 `case _` 时才按 default case 扣减一次复杂度。
- `--base-ref` 拒绝 ceiling 上调、删除仍存在的债务条目，以及没有 `moved_from` 的 ceiling 转移；
  每个旧 ceiling 只能通过 `moved_from` 一对一转移到一个新条目。
- 临时例外写在对应 ceiling 条目的 `exception` 对象中，必须同时包含非空
  `owner`、`reason`、`expires_at`，日期格式为 `YYYY-MM-DD`，最长期限为从检查当天起 30 天；
  过期例外会阻断检查。
