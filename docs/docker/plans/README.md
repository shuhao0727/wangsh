# 计划与分析索引

`docs/docker/plans/` 只保留当前仍在推进的计划、治理基线和复用模板。已经完成、已经被后续结论覆盖、或者仅保留追溯价值的内容，应优先转到 `../archive/plans/`。

## 当前活跃文档

- [pythonlab-capability-inventory.md](pythonlab-capability-inventory.md) - PythonLab 能力盘点与删除前核对清单
- [sse-redis-pubsub-migration.md](sse-redis-pubsub-migration.md) - SSE pub/sub 从进程内迁移到 Redis 的方案
- [2026-05-03-learning-platform-improvement.md](2026-05-03-learning-platform-improvement.md) - ML/AI/Agents 学习平台改进实施计划
- [2026-05-03-it-technology-markdown-book-system.md](2026-05-03-it-technology-markdown-book-system.md) - IT Technology Markdown Book 系统实施计划
- [2026-05-03-learning-platform-improvement-design.md](2026-05-03-learning-platform-improvement-design.md) - 学习平台设计说明
- [ui-single-page-governance.md](ui-single-page-governance.md) - 单页治理基线
- [ui-page-health-template.md](ui-page-health-template.md) - 单页体检模板
- [ui-final-regression-checklist.md](ui-final-regression-checklist.md) - UI 回归检查清单

## 已归档计划入口

下列文档已归档，原位保留 redirect：

- `execution-roadmap.md`
- `three-module-improvement.md`
- `ui-page-tracker.md`
- `ui-upgrade-plan.md`
- `IMPROVEMENT_CHECKLIST.md`

归档总览请查看 [`../archive/plans/README.md`](../archive/plans/README.md)。

## 当前策略

- 当前入口层只保留“仍要继续执行”的计划、治理基线、回归台账和复用模板。
- 测试脚本清理、测试目录索引、烟测治理等跨模块测试文档统一转入 [`../testing/`](../testing/README.md)。
- 已完成、明显带时间戳、或内容已经被后续改动覆盖的分析报告统一转入 [`../archive/plans/`](../archive/plans/README.md)。
- 当前没有活跃的单页体检报告；如后续再做单页治理，建议新报告先生成到 `plans/`，完成后再归档。
