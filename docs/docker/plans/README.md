# 计划与分析

> 状态：active
> Owner：project-governance
> 最近复核：2026-07-13

本目录存放项目的计划文档、设计提案和分析报告。每份文档标注状态
（`active` / `reference` / `superseded` / `archived` / `redirect`）。

## 计划与治理文档

| 文件 | 状态 | 描述 |
|------|------|------|
| [sse-redis-pubsub-migration.md](sse-redis-pubsub-migration.md) | `redirect` | 已完成迁移，当前跳转到功能和部署文档 |
| [pythonlab-capability-inventory.md](pythonlab-capability-inventory.md) | `redirect` | 能力矩阵已合并到 PythonLab owner 文档 |
| [2026-05-03-learning-platform-improvement.md](2026-05-03-learning-platform-improvement.md) | `redirect` | 已完成计划，当前跳转到学习平台文档 |
| [2026-05-03-learning-platform-improvement-design.md](2026-05-03-learning-platform-improvement-design.md) | `redirect` | 已完成设计，当前跳转到学习平台文档 |
| [2026-05-03-it-technology-markdown-book-system.md](2026-05-03-it-technology-markdown-book-system.md) | `redirect` | 已完成计划，当前跳转到 ML 书籍文档 |
| [ui-single-page-governance.md](ui-single-page-governance.md) | `reference` | UI 样式、单页体检和最终回归唯一参考 |
| [ui-page-health-template.md](ui-page-health-template.md) | `redirect` | 旧体检模板兼容入口 |
| [ui-final-regression-checklist.md](ui-final-regression-checklist.md) | `redirect` | 旧回归清单兼容入口 |
| [2026-07-11-project-health-and-improvement-report.md](2026-07-11-project-health-and-improvement-report.md) | `reference` | 2026-07-13 项目健康快照与风险判断 |
| [2026-07-11-project-governance-30-60-90-execution-plan.md](2026-07-11-project-governance-30-60-90-execution-plan.md) | `active` | 30/60/90 天详细任务、依赖、验证命令和退出标准 |
| [2026-07-12-project-consolidation-and-release-plan.md](2026-07-12-project-consolidation-and-release-plan.md) | `active` | 当前测试、Markdown、八个提交、PR 和发布收口的唯一执行计划 |
| [2026-07-11-change-batch-manifest.md](2026-07-11-change-batch-manifest.md) | `active` | 2026-07-11 冻结的 222 个工作区入口快照、七批分类、依赖和 commit 边界 |

## 已完成/已归档

已完成但仍承担稳定参考作用的文档使用 `reference`；长期结论已沉淀到 owner 文档且
不再被活跃入口依赖后，再归档至 [../archive/](../archive/)。
已归档内容参见 [../archive/README.md](../archive/README.md)。

## 相关文档

- [DOCUMENTATION_RULES.md](../../DOCUMENTATION_RULES.md) — 文档 owner 与生命周期规则
- [ENGINEERING_GOVERNANCE.md](../../ENGINEERING_GOVERNANCE.md) — 工程治理条例
- [../README.md](../README.md) — Docker 文档中心
