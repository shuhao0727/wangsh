# 后端脚本说明

`backend/scripts/` 只保留当前仍在使用的后端验证脚本和数据库初始化脚本。历史脚本清理后，只通过 [`archive/README.md`](archive/README.md) 保留索引。

## 当前入口

- `bootstrap_db.py` - 本地/部署场景数据库初始化
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

## 分层说明

- 统一生产烟测入口：[`../../scripts/prod-smoke/run.sh`](../../scripts/prod-smoke/run.sh)
- 后端 pytest 用例：[`../tests/README.md`](../tests/README.md)
- 历史脚本清理记录：[`archive/README.md`](archive/README.md)

## 使用建议

- 想跑整套生产烟测，优先使用 `scripts/prod-smoke/run.sh`
- 只排查单个模块时，再单独执行对应 `smoke_*.py`
- 不要把一次性排障脚本重新堆回本目录
