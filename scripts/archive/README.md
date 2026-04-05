# Scripts 清理记录

本目录当前只保留索引，不再保留历史根层测试/排障脚本实体。

已删除的历史脚本：

- `api-smoke-local.sh`
  - 原路径：`scripts/api-smoke-local.sh`
  - 类型：旧本地 API 探针
- `debug_group_visibility.py`
  - 原路径：`scripts/debug_group_visibility.py`
  - 类型：群聊可见性排障
- `debug_public_config.py`
  - 原路径：`scripts/debug_public_config.py`
  - 类型：公开配置排障
- `load60_p0.py`
  - 原路径：`scripts/load60_p0.py`
  - 类型：PythonLab 压测脚本
- `reproduce_update_400.py`
  - 原路径：`scripts/reproduce_update_400.py`
  - 类型：AI 智能体更新 400 复现脚本
- `smoke_test_all.py`
  - 原路径：`scripts/smoke_test_all.py`
  - 类型：历史全量 smoke 入口

保留原则：

- 当前正式入口仍是 `scripts/prod-smoke/run.sh` 与 `scripts/prod-smoke/run.py`。
- 根目录 `scripts/` 只保留仍在部署、迁移、回滚、生产烟测链路中使用的脚本。
