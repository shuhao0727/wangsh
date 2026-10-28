# 当前计划与回归参考

> 状态：active
> Owner：project-governance
> 最近复核：2026-10-19

本目录只保留当前执行计划与仍维护的回归参考。历史审计、日期报告与旧执行计划统一进入
[归档索引](../archive/README.md)，不因旧文件曾标记 active 或“唯一台账”而继续作为当前依据。

## 当前项目整理

| 文档 | 状态 | 职责 |
|---|---|---|
| [project-consolidation.md](project-consolidation.md) | `active` | 全项目整理批次、历史发现的复核方式、未解决事项与退出证据 |
| [2026-10-27-S1-S7-VERIFICATION-PLAN-V3.md](2026-10-27-S1-S7-VERIFICATION-PLAN-V3.md) | `active` | S1~S7 分级验证的执行计划、10 条规则与冻结检查项；取代同日两份早期计划 |

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
