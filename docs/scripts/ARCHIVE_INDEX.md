# 脚本归档索引

> 更新时间：2026-04-11
> 状态：归档索引（历史脚本清理记录）

---

## 概述

本文档记录了项目中已删除的历史脚本，仅作为追溯参考。所有当前活跃脚本请参考对应的README文档。

## 脚本清理原则

1. **根层脚本**：只保留跨模块、运维级和统一入口级脚本
2. **后端脚本**：只保留当前仍在使用的后端验证脚本和数据库初始化脚本
3. **前端脚本**：只保留当前仍接入npm命令、CI或生产烟测链路的脚本
4. **测试脚本**：pytest用例放 `backend/tests/`，专项验证脚本放对应脚本目录

## 已删除的历史脚本记录

### 1. 根层脚本（原 `scripts/archive/`）

| 脚本 | 原路径 | 类型 | 删除原因 |
|------|--------|------|----------|
| `api-smoke-local.sh` | `scripts/api-smoke-local.sh` | 旧本地API探针 | 被 `scripts/prod-smoke/` 替代 |
| `debug_group_visibility.py` | `scripts/debug_group_visibility.py` | 群聊可见性排障 | 一次性排障脚本 |
| `debug_public_config.py` | `scripts/debug_public_config.py` | 公开配置排障 | 一次性排障脚本 |
| `load60_p0.py` | `scripts/load60_p0.py` | PythonLab压测脚本 | 被正式压测流程替代 |
| `reproduce_update_400.py` | `scripts/reproduce_update_400.py` | AI智能体更新400复现脚本 | 问题已修复 |
| `smoke_test_all.py` | `scripts/smoke_test_all.py` | 历史全量smoke入口 | 被 `scripts/prod-smoke/` 替代 |

### 2. 后端脚本（原 `backend/scripts/archive/`）

| 脚本 | 原路径 | 类型 | 删除原因 |
|------|--------|------|----------|
| `e2e_assessment.py` | `backend/scripts/e2e_assessment.py` | 早期assessment端到端脚本 | 被正式测试替代 |
| `e2e_assessment_phase3.py` | `backend/scripts/e2e_assessment_phase3.py` | 历史画像/Phase3端到端脚本 | 被正式测试替代 |
| `seed_demo_data.py` | `backend/scripts/seed_demo_data.py` | 模拟展示数据写入脚本 | 一次性数据准备脚本 |
| `seed_mock_agent_data.py` | `backend/scripts/seed_mock_agent_data.py` | mock智能体/用户数据脚本 | 一次性数据准备脚本 |
| `smoke_ai_agent_key_management.py` | `backend/scripts/smoke_ai_agent_key_management.py` | 专项API key管理验证 | 被集成测试替代 |
| `xbk_verify.py` | `backend/scripts/xbk_verify.py` | 旧版XBK验证脚本 | 被新版验证流程替代 |

### 3. 前端脚本（原 `frontend/scripts/archive/`）

| 脚本 | 原路径 | 类型 | 删除原因 |
|------|--------|------|----------|
| `capture_pythonlab_task12_screenshots.cjs` | `frontend/scripts/capture_pythonlab_task12_screenshots.cjs` | PythonLab Task12截图采集脚本 | 一次性辅助脚本 |

## 当前活跃脚本入口

### 根层脚本
- **主入口**：`scripts/README.md`
- **生产烟测**：`scripts/prod-smoke/run.sh`
- **XBK脚本**：`scripts/xbk/README.md`

### 后端脚本
- **主入口**：`backend/scripts/README.md`
- **数据库初始化**：`backend/scripts/bootstrap_db.py`
- **专项烟测**：`backend/scripts/smoke_*.py`

### 前端脚本
- **主入口**：`frontend/scripts/README.md`
- **PythonLab调试烟测**：`frontend/scripts/pythonlab-debug-smoke.mjs`
- **UI审计**：`frontend/scripts/ui-audit.mjs`

### 测试脚本
- **主入口**：`backend/tests/README.md`
- **pytest用例**：`backend/tests/` 各模块目录

## 维护建议

1. **新脚本创建**：
   - 跨模块/运维脚本 → `scripts/`
   - 后端专项验证 → `backend/scripts/`
   - 前端专项验证 → `frontend/scripts/`
   - pytest测试用例 → `backend/tests/`

2. **脚本清理**：
   - 一次性排障脚本完成后立即删除
   - 临时验证脚本不提交到仓库
   - 被替代的历史脚本及时归档删除

3. **文档更新**：
   - 新增脚本时更新对应README
   - 删除脚本时更新本文档记录

---

**相关文档**：
- `scripts/README.md` - 根层脚本说明
- `backend/scripts/README.md` - 后端脚本说明
- `frontend/scripts/README.md` - 前端脚本说明
- `backend/tests/README.md` - 后端测试说明