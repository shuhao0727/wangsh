# 后端脚本说明

> 历史脚本清理记录：`docs/scripts/ARCHIVE_INDEX.md`

`backend/scripts/` 只保留当前仍在使用的后端验证脚本和数据库初始化脚本。

目录保留 `__init__.py` 作为显式 Python package 标记，保证在 `backend/` 工作目录、
CI 和生产镜像中稳定解析 `scripts.bootstrap_db`。仓库根目录另有同名 `scripts/`
工具包，因此后端测试和脚本仍应按本文命令从 `backend/` 运行。

## 当前入口

- `bootstrap_db.py` - 本地/部署场景数据库初始化；`--initial-only` 仅允许空库创建迁移链之前的 legacy baseline，不执行 stamp，随后必须完整运行 `alembic upgrade head`；创建前从独立 metadata 副本排除迁移管理的索引（含原生 SQL 定义），避免早于扩展创建 trgm 索引，不修改全局 ORM metadata；XBK 副本保留迁移前整数年份且不提前创建学年检查约束，由原迁移转换为当前学年范围，现有正常库不受此分支影响
- `check_migration_state.py` - 生产迁移前只读检查，AST 静态解析 revision 图；只读目录快照下，仅审核指纹及完整目录匹配才豁免特定等价索引。未知 guard、异结构、跨 schema 同名保守阻断，不执行迁移模块或自动放宽审核。具体兼容与回退边界见 [DEPLOY](../../docs/docker/deploy/DEPLOY.md)。
- `check_python_governance.py` - Python 文件物理行数与 AST 圈复杂度 ratchet 检查
- `check_changed_lines_coverage.py` - changed-lines 覆盖率门禁（审计 T-2 / 治理 §4.3）
- `smoke_openapi_sweep.py` - 只读 GET 广覆盖扫雷
- `smoke_feature_suite.py` - users/articles/xbk/classroom 等核心 CRUD 烟测
- `smoke_assessment_flow.py` - 测评主链路烟测
- `smoke_xxjs_dianming.py` - 点名链路烟测
- `smoke_full_deploy.py` - auth/articles/informatics/agents 综合验证
- `smoke_group_discussion.py` - 小组讨论链路验证
- `smoke_typst_pipeline.py` - Typst 编译链路验证
- `smoke_pythonlab_ws_owner_concurrency.py` - PythonLab owner 并发验证
- `smoke_pythonlab_dap_step_watch_soak.py` - PythonLab DAP 步进 soak
- `smoke_pythonlab_print_visibility_probe.py` - PythonLab print 可见性探针
- `soak_pythonlab_phasec.py` - PythonLab Phase C 专项门禁

## PythonLab owner 并发 smoke

`smoke_pythonlab_ws_owner_concurrency.py` 的 `OWNER_MODE=matrix` 分为两阶段：先以
`auto` 检测当前 owner 行为，随后显式请求停止 detect session，再以检测结果或
`EXPECT_OWNER_BEHAVIOR` 执行严格断言。阶段切换只对后端返回的精确 runtime-busy 错误
`已有会话仍在使用运行环境或状态未知，请先停止旧会话。` 做生命周期重试；认证、HTTP、
断言及其他未知错误不会被吞掉或误当成清理竞态。

清理等待是有界的：`RUNTIME_CLEANUP_TIMEOUT_SECONDS` 默认 45 秒，同时限制 session
create 请求和 READY 状态轮询；耗尽后以 `lifecycle`、退出码 `EXIT_DETECT=4` 失败，
不误报为普通 network 错误。runtime-busy 最多创建 3 个候选 session，
`RUNTIME_RETRY_INTERVAL_SECONDS` 默认 1 秒并采用指数退避，单次退避上限为 4 秒，
不会每秒无限创建真实 session 或无限派发 Celery 工作。

`/stop` 返回 HTTP 200 只表示异步清理请求已被接受，不证明 runtime 已立即释放；因此
所有已创建 session ID 都保留在最终清理列表，脚本在 `finally` 中再次发起幂等 stop。
该最终步骤是清理重试，不应表述为已经轮询证明 runtime 完全释放。脚本使用的
`requests` 与 `aiohttp` 由 `backend/requirements-dev.txt` 维护；
`pythonlab-pr-runtime.yml` 安装完整开发依赖，Phase C 与 owner 专项 workflow 则固定安装
同版本的最小依赖集合。

## changed-lines 覆盖率门禁

读取 pytest-cov 的 JSON 报告（`--cov-report=json`，默认
`backend/coverage.json`）与 Git diff 变更集，计算“被测试执行的变更行占比”：
普通文件 ≥85%，关键路径 ≥95%。关键路径 = `backend/app/core/deps.py`、
`backend/app/api/endpoints/auth`、`backend/app/core/security*`、
`backend/alembic/versions/`（alembic 版本文件被 `.coveragerc` 故意 omit，
无数据时报告 `NO DATA` 并告警，不参与数值门禁）。

```bash
# 先产 coverage（backend/ 下）
venv/bin/python -m pytest -q --cov=app --cov-report=json -m "not slow"

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

- `archive/seed_ai_content.py`、`archive/seed_agents_content.py` - 正式课程内容迁移源，
  直接执行会退出；完成版本化资源和幂等 seed 迁移前不得删除
- `archive/add_missing_indexes.sql` - 尚待逐项对照 Alembic 和真实查询的历史索引草案，
  文件内置 psql 拒绝执行保护，不能直接作为生产结构变更入口
- `archive/smoke_pythonlab_low_memory_start_failure.py` - 低内存启动失败故障注入工具；
  未接入自动化门禁，需手工注入 `PYTHONLAB_SMOKE_PASSWORD` 后在隔离环境运行

其余失效、重复或无内容价值的一次性 seed 执行壳已物理删除，原因记录在
[`../../docs/scripts/ARCHIVE_INDEX.md`](../../docs/scripts/ARCHIVE_INDEX.md)。

## 分层说明

- 统一生产烟测入口：[`../../scripts/prod-smoke/run.sh`](../../scripts/prod-smoke/run.sh)
- 后端 pytest 用例：[`../tests/README.md`](../tests/README.md)

## 使用建议

- 想跑整套生产烟测，优先使用 `scripts/deploy.sh simulate`；直接运行
  `scripts/prod-smoke/run.sh` 必须显式设置 `PROD_SMOKE_ALLOW_LIVE=true`
- 只排查单个模块时，再单独执行对应 `smoke_*.py`
- 状态型 smoke 可能创建用户、课程、会话、文章或智能体；清理失败保护完善前，只在
  `scripts/deploy.sh simulate` 的隔离栈或专用测试环境运行
- 不要把一次性排障脚本、旧 seed 脚本或数据库草案重新堆回本目录

## Python 治理检查

扫描范围固定为 `backend/app/**/*.py`。文件规模使用 `len(source.splitlines())`
统计物理行；函数复杂度使用标准库 `ast` 计算 McCabe 风格分支复杂度。

```bash
# 门禁：配置错误返回 2，治理违规返回 1，通过返回 0
python3 backend/scripts/check_python_governance.py check

# CI/PR 场景从 Git base 读取旧 baseline，阻止放宽或静默转移债务
python3 backend/scripts/check_python_governance.py check --base-ref origin/main

# 仅输出报告；即使发现治理错误也返回 0，配置错误仍返回 2
python3 backend/scripts/check_python_governance.py report

# 仅在确认当前工作树已验证后更新 baseline
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
