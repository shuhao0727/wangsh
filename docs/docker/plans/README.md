# 当前计划与回归参考

> 状态：active
> Owner：project-governance
> 最近复核：2026-10-19

本目录只保留当前执行计划与仍维护的回归参考。历史审计、日期报告与旧执行计划统一进入
[归档索引](../archive/README.md)，不因旧文件曾标记 active 或“唯一台账”而继续作为当前依据。

## 当前执行计划

**当前只有一个正在执行的计划，其余是实现参考或后续排期。**

| 文档 | 状态 | 职责 |
|---|---|---|
| [2026-10-28-RELEASE-2.2.1-PLAN.md](2026-10-28-RELEASE-2.2.1-PLAN.md) | `active` | **当前执行**：2.2.1 的 8 个提交拆分、验证策略、部署与回滚流程 |

## 实现参考与后续排期

这两份不单独启动执行，由 2.2.1 计划或其他更高层计划引用时才用。

| 文档 | 状态 | 职责 |
|---|---|---|
| [2026-10-28-DIFY-DEFECT-FIX-PLAN.md](2026-10-28-DIFY-DEFECT-FIX-PLAN.md) | `active-ref` | Dify 两处 P0 的**技术细节**（四元组匹配规则、边界处理、Dify API 契约）；归属 2.2.1 的提交 2 与 3 |
| [2026-10-28-S2-S7-EXECUTION-PLAN-V4.md](2026-10-28-S2-S7-EXECUTION-PLAN-V4.md) | `active` | S2~S7 分级验证计划；S1~S6 已完成，S5/S7 待做 |
| [2026-10-28-S4-S7-ITEM-MANIFEST.md](2026-10-28-S4-S7-ITEM-MANIFEST.md) | `active` | S4~S7 条目清单与「存活/已回滚」状态冻结基线，V4 依赖它 |

## 长期维护

| 文档 | 状态 | 职责 |
|---|---|---|
| [project-consolidation.md](project-consolidation.md) | `active` | 全项目整理批次、历史发现的复核方式、未解决事项与退出证据 |

动态验证结果只写 [TEST_STATUS.md](../testing/TEST_STATUS.md)，工程门禁由
[ENGINEERING_GOVERNANCE.md](../../ENGINEERING_GOVERNANCE.md) 维护，部署与镜像操作遵循
[DEPLOY.md](../deploy/DEPLOY.md)。

## UI 视觉、进度与回归

| 文档 | 职责 |
|---|---|
| [EMBEDDED_UI_STYLE_GUIDE.md](../frontend/EMBEDDED_UI_STYLE_GUIDE.md) | 用户已确认的嵌入式视觉规则 |
| [UI_REDESIGN_ROADMAP.md](../frontend/UI_REDESIGN_ROADMAP.md) | 页面族清单、整理进度和用户确认状态 |
| [ui-single-page-governance.md](ui-single-page-governance.md) | 页面体检模板、交互与无障碍回归清单 |

批量授权不改变逐页记录工程验证和用户确认的要求；不恢复用户已否定的旧视觉方案。

## 历史边界

- 2026-07 至 2026-10 的治理、审查和文件扫描文档仅保留历史证据，入口见
  [归档索引](../archive/README.md)。归档不等于其中所有未验证项已经修复。
- 2026-10-09 的“全面深度审核报告”仍含未填写占位段；2026-10-10 的“68 条发现”是历史候选口径，
  均不能作为当前自动清理或全部完成的证明。
- 以下三个计划从未提交，只曾存在于本地 stash 的 untracked 树中，不恢复为当前计划：
  `2026-10-10-project-review-plan.md`、`2026-10-05-uncommitted-changes-remediation-plan.md`、
  `2026-10-06-color-system-comprehensive-migration-plan.md`。本轮不读取、弹出或恢复 stash。

## 维护规则

当前行为先更新功能、API、部署或测试 owner；未来动作更新当前计划；历史过程进入 archive。
新增或移动文档按 [DOCUMENTATION_RULES.md](../../DOCUMENTATION_RULES.md) 同步索引和真实引用。
