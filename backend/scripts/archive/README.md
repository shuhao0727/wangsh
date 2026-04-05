# Backend 脚本清理记录

本目录当前只保留索引，不再保留历史测试脚本实体。

已删除的历史后端测试脚本：

- `e2e_assessment.py`
  - 原路径：`backend/scripts/e2e_assessment.py`
  - 类型：早期 assessment 端到端脚本
- `e2e_assessment_phase3.py`
  - 原路径：`backend/scripts/e2e_assessment_phase3.py`
  - 类型：历史画像/Phase3 端到端脚本
- `seed_demo_data.py`
  - 原路径：`backend/scripts/seed_demo_data.py`
  - 类型：模拟展示数据写入脚本
- `seed_mock_agent_data.py`
  - 原路径：`backend/scripts/seed_mock_agent_data.py`
  - 类型：mock 智能体/用户数据脚本
- `smoke_ai_agent_key_management.py`
  - 原路径：`backend/scripts/smoke_ai_agent_key_management.py`
  - 类型：专项 API key 管理验证
- `xbk_verify.py`
  - 原路径：`backend/scripts/xbk_verify.py`
  - 类型：旧版 XBK 验证脚本

保留原则：

- 当前正式测试入口以 `scripts/prod-smoke/run.py` 和 `backend/tests/` 为准。
- 如果未来确实需要恢复某类专项脚本，应从现有主链路重新实现，而不是依赖旧归档脚本。
