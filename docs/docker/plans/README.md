# 计划与分析

> 状态：active
> Owner：project-governance
> 最近复核：2026-10-16

本目录只保留仍需执行的计划和稳定参考。已完成内容进入 owner、必要归档或 Git 历史，
不再为无引用旧路径长期保留 redirect。

> **2026-10-16 索引校正**：本表此前与目录实际内容不一致，本次改为如实列出目录内全部文档：
>
> - 3 个曾出现在表中的文件（`2026-10-10-project-review-plan.md`、
>   `2026-10-05-uncommitted-changes-remediation-plan.md`、
>   `2026-10-06-color-system-comprehensive-migration-plan.md`）**从未被 commit**，
>   只存在于本地 `stash@{0}` 的 untracked 树中，对任何 git 检查、clone、CI 完全不可见，
>   对应索引行已删除；禁止从 stash 恢复这些文件。
> - 4 个被「2026-10-09 索引重整」声称已移除的文档实际仍在目录中（`968ba9f` 只改了
>   本表格，文件一个没删，archive 也没收录）：`2026-07-11-project-governance-30-60-90-execution-plan.md`、
>   `2026-09-08-project-audit-findings.md`、`2026-09-08-project-comprehensive-audit-plan.md`、
>   `ui-single-page-governance.md`。本次如实重新列出，状态沿用各文件头部声明。
> - 归档索引见 [../archive/README.md](../archive/README.md)。

## 计划与治理文档

| 文件 | 状态 | 描述 |
|------|------|------|
| [2026-07-11-project-governance-30-60-90-execution-plan.md](2026-07-11-project-governance-30-60-90-execution-plan.md) | `active` | 30/60/90 天工程治理计划（头部仍声明 active；此前索引曾声称已移除，文件实际仍在） |
| [2026-09-08-project-audit-findings.md](2026-09-08-project-audit-findings.md) | `active` | 全项目首轮问题台账（XBK 优先；此前索引曾声称已移除，文件实际仍在） |
| [2026-09-08-project-comprehensive-audit-plan.md](2026-09-08-project-comprehensive-audit-plan.md) | `active` | 全项目首轮审查执行计划（此前索引曾声称已移除，文件实际仍在） |
| [2026-10-03-ui-improvement-plan.md](2026-10-03-ui-improvement-plan.md) | `active` | **UI 改造唯一执行计划**（实测基线、批次、门禁加固与旧文档处置） |
| [2026-10-03-view-migration-and-pythonlab-type.md](2026-10-03-view-migration-and-pythonlab-type.md) | `active` | 后端视图静默失败修复与 PythonLab 原生按钮核查 |
| [2026-10-09-comprehensive-audit-final-report.md](2026-10-09-comprehensive-audit-final-report.md) | `reference` | 2026-10-09 全面深度审核报告（含未填写的占位段） |
| [2026-10-09-comprehensive-remediation-plan.md](2026-10-09-comprehensive-remediation-plan.md) | `active` | 审计问题的分阶段修复执行计划（Phase 1-4，含负责人、时长与验收标准） |
| [2026-10-09-comprehensive-review.md](2026-10-09-comprehensive-review.md) | `active` | 2026-10-09 工作区综合审查报告 |
| [2026-10-09-six-round-audit-issue-list.md](2026-10-09-six-round-audit-issue-list.md) | `active` | **现存问题唯一汇总台账**（九轮深度探查、修复方案、含 UI 专项审计与完成度核查） |
| [2026-10-09-verification-report.md](2026-10-09-verification-report.md) | `reference` | 2026-10-09 审计项的逐项独立复核结论（验证率与判定依据） |
| [2026-10-10-file-organization-findings.md](2026-10-10-file-organization-findings.md) | `reference` | 2026-10-10 文件整理扫描报告（68 条发现，CI 路径问题已修复并验证） |
| [ui-single-page-governance.md](ui-single-page-governance.md) | `reference` | UI 治理与回归基线（此前索引曾声称已移除，文件实际仍在） |

## 已完成/已归档

2026-09-15 的文件整理与 2.1 发布闭环已完成；历史执行计划已移入 [归档索引](../archive/README.md)。

已完成但仍承担稳定参考作用的文档使用 `reference`；长期结论已沉淀到 owner 文档且
不再被活跃入口依赖后，再归档至 [../archive/](../archive/)。
已归档内容参见 [../archive/README.md](../archive/README.md)。

2026-05 学习平台和 SSE 的当前行为已经收敛到 owner；仍有恢复或设计价值的内容保留为
精简 archive。2026-07 的批次、健康和发布长文档已压缩到
[历史摘要](../archive/plans/2026-07-project-consolidation-history.md)；当前事实由
`TEST_STATUS.md` 与 `RELEASE_NOTES.md` 维护，不再保留重复正文或 redirect。

## 相关文档

- [DOCUMENTATION_RULES.md](../../DOCUMENTATION_RULES.md) — 文档 owner 与生命周期规则
- [ENGINEERING_GOVERNANCE.md](../../ENGINEERING_GOVERNANCE.md) — 工程治理条例
- [../README.md](../README.md) — Docker 文档中心
