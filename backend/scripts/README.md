# 后端脚本说明

> 详细文档请参考：`docs/scripts/ARCHIVE_INDEX.md`

`backend/scripts/` 只保留当前仍在使用的后端验证脚本和数据库初始化脚本。

目录保留 `__init__.py` 作为显式 Python package 标记，保证在 `backend/` 工作目录、
CI 和生产镜像中稳定解析 `scripts.bootstrap_db`。仓库根目录另有同名 `scripts/`
工具包，因此后端测试和脚本仍应按本文命令从 `backend/` 运行。

## 当前入口

- `bootstrap_db.py` - 本地/部署场景数据库初始化；`--initial-only` 仅允许空库创建迁移链之前的 legacy baseline，不执行 stamp，随后必须完整运行 `alembic upgrade head`
- `check_migration_state.py` - 生产迁移前只读检查，阻断 `alembic_version` 与真实 schema 漂移
- `check_python_governance.py` - Python 文件物理行数与 AST 圈复杂度 ratchet 检查
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
