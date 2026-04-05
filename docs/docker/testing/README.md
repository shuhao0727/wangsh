# 测试与验证索引

`docs/docker/testing/` 用来集中放和测试治理、测试目录说明、清理策略、烟测入口有关的文档。这里不替代模块就近说明，而是负责给整个仓库的测试链路提供总入口。

## 当前入口

- [test-script-cleanup-inventory.md](test-script-cleanup-inventory.md) - 测试脚本保留/归档/删除清单
- [../../DOCUMENTATION_RULES.md](../../DOCUMENTATION_RULES.md) - 文档维护规范
- [../../README.md](../../README.md) - 项目总入口

## 就近测试说明

- [../../../backend/tests/README.md](../../../backend/tests/README.md) - 后端 pytest 目录说明与常用命令
- [../../../backend/scripts/README.md](../../../backend/scripts/README.md) - 后端 smoke/soak 脚本说明
- [../../../scripts/README.md](../../../scripts/README.md) - 根层运维、生产烟测与 XBK 脚本入口
- [../../../frontend/scripts/README.md](../../../frontend/scripts/README.md) - 前端 UI 审计、页面治理和 UI smoke 脚本入口
- [../../../scripts/xbk/README.md](../../../scripts/xbk/README.md) - XBK 独立重建与回归说明

## 目录约定

- `backend/tests/`：后端 pytest 用例本体
- `backend/scripts/`：后端 smoke/soak/专项验证脚本
- `scripts/prod-smoke/`：生产环境全链路烟测编排入口
- `frontend/scripts/`：前端 UI 审计、迁移统计、页面治理、UI smoke
- `docs/docker/testing/`：测试治理文档与清理台账

## 整理原则

- 不把后端 pytest 用例从 `backend/tests/` 挪走。
- 模块专用说明优先就近放在模块目录。
- 测试治理、清理策略、跨模块测试索引统一收敛到这里。
