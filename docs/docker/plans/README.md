# 计划与分析索引

`docs/docker/plans/` 用来存放阶段性计划、迁移方案、审计结果和治理台账，不作为长期产品文档入口。已经稳定下来的结论应沉淀到 [`docs/`](../../README.md)，测试治理文档请放到 [`../testing/README.md`](../testing/README.md)，纯前端 UI 专项文档请放到 [`../frontend/README.md`](../frontend/README.md)。

## 当前活跃文档

- [sse-redis-pubsub-migration.md](sse-redis-pubsub-migration.md) - SSE pub/sub 从进程内迁移到 Redis 的方案
- [three-module-improvement.md](three-module-improvement.md) - 点名系统、系统管理、选课系统联合改进计划
## UI 治理与回归

- [ui-upgrade-plan.md](ui-upgrade-plan.md) - UI 渐进式迁移计划
- [ui-single-page-governance.md](ui-single-page-governance.md) - 单页治理基线
- [ui-page-tracker.md](ui-page-tracker.md) - 页面治理台账
- [ui-final-regression-checklist.md](ui-final-regression-checklist.md) - UI 回归检查清单
- [ui-page-health-template.md](ui-page-health-template.md) - 单页体检模板

## 当前策略

- 当前入口层只保留“仍要继续执行”的计划、治理基线、回归台账和复用模板。
- 测试脚本清理、测试目录索引、烟测治理等跨模块测试文档统一转入 [`../testing/`](../testing/README.md)。
- 已完成或明显带时间戳的分析报告统一转入 [`../archive/plans/`](../archive/plans/README.md)。
- 当前没有活跃的单页体检报告；如后续再做单页治理，建议新报告先生成到 `plans/`，完成后再归档。

## 历史归档

- [../archive/plans/README.md](../archive/plans/README.md) - 归档目录总览
- [../archive/plans/project-deep-analysis.md](../archive/plans/project-deep-analysis.md) - 项目级深度分析快照
- [../archive/plans/module-deep-analysis.md](../archive/plans/module-deep-analysis.md) - 模块级深度分析快照
- [../archive/plans/code-quality-audit.md](../archive/plans/code-quality-audit.md) - 代码质量与安全清理审查快照
- [../archive/plans/auth-analysis.md](../archive/plans/auth-analysis.md) - 认证系统深度分析和访客权限方案
- [../archive/plans/responsive-analysis.md](../archive/plans/responsive-analysis.md) - 响应式布局问题分析与修复方案
- [../archive/plans/ui-page-reports/ai-agents.md](../archive/plans/ui-page-reports/ai-agents.md) - `/ai-agents` 单页体检历史报告

## 保留 / 归档 / 删除

- 保留：仍在推进的计划、治理规则、回归台账、复用模板。
- 归档：已完成、已被后续结论覆盖、仅保留追溯价值的报告。
- 删除：自动生成且可重建、没有历史价值的中间产物。本轮未直接删除作者撰写的计划文档。
