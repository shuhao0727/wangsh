# 计划归档索引

这里存放已经完成、被后续结论覆盖，或只保留追溯价值的历史计划与分析报告。

## 最新合并（2026-04-11）

为减少文档数量和提高管理效率，已对历史计划文档进行合并和清理：

- [HISTORICAL_PLANS_SUMMARY.md](HISTORICAL_PLANS_SUMMARY.md) - 历史计划文档总结（合并版）

## 架构与代码分析

- [PROJECT_AND_MODULE_ANALYSIS-COMPRESSED.md](PROJECT_AND_MODULE_ANALYSIS-COMPRESSED.md) - 项目与模块深度分析（压缩合并版，4.5KB）
- [code-quality-audit.md](code-quality-audit.md) - 代码质量与安全清理审查快照

## 专项历史方案

- [auth-analysis.md](auth-analysis.md) - 认证系统深度分析和访客权限方案
- [responsive-analysis.md](responsive-analysis.md) - 响应式布局问题分析与修复方案

## UI 单页历史报告

- [ui-page-reports/ai-agents.md](ui-page-reports/ai-agents.md) - `/ai-agents` 单页体检历史报告

## 归档约定

- 归档文件默认不再作为当前执行入口
- 如果归档报告中的结论仍有效，应同步回 `docs/` 或 `plans/` 的活文档
- 新的阶段性报告完成后，可按同样规则转入 `archive/`
- 当前活跃计划入口请查看 [`../../plans/README.md`](../../plans/README.md)

## 清理说明

### 已删除的文档
以下文档已被删除，内容已在 `HISTORICAL_PLANS_SUMMARY.md` 中总结：
- `improvement-plan-2026-04-10.md` - 内容已被 `IMPROVEMENT_CHECKLIST.md` 覆盖
- `project-cleanup-audit-2026-04-08.md` - 历史审计记录，无长期价值
- `pythonlab-ws-7-week-plan-2026-04-10.md` - 阶段性计划，已完成
- `group-discussion-test-gap-analysis-2026-04-10.md` - 测试缺口分析，已修复

### 已删除的原始报告
以下原始详细报告已被删除，内容已在压缩版中：
- `project-deep-analysis.md` - 内容已在 `PROJECT_AND_MODULE_ANALYSIS-COMPRESSED.md`（已删除）
- `module-deep-analysis.md` - 内容已在 `PROJECT_AND_MODULE_ANALYSIS-COMPRESSED.md`（已删除）
