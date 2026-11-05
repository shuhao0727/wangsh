# 归档文档

> 状态：active
> Owner：docs
> 最近复核：2026-11-01

本目录是 WangSh 历史文档的归档位置。归档内容用于追溯，不再指导当前开发、测试或
部署；当前入口见 [docs/README.md](../README.md)。

## 目录分组

归档正文按主题分子目录，新增时在下表登记：

| 目录 | 内容 |
|---|---|
| `reviews/` | 审计、复核和阶段总结 |
| `plans/` | 旧计划、旧台账及其决策依据 |
| `operations/` | 日期型部署清单和遗留记录 |
| `testing/` | 按日期保留的详细测试证据 |
| `releases/` | 早期发布说明与构建记录 |
| `scripts/` | 脚本退出与归档记录 |

## 已归档正文

| 文件 | 内容 |
|---|---|
| [testing/2026-11-02-maintenance-batches.md](testing/2026-11-02-maintenance-batches.md) | 2026-11-02 仓库整理各批次的检查结果与未采纳判断 |
| [testing/2026-11-04-release-226.md](testing/2026-11-04-release-226.md) | 2.2.6发布身份、接力候选验收、外网现场与部署准入阻断 |
| [testing/2026-11-04-release-228.md](testing/2026-11-04-release-228.md) | 2.2.8正式镜像验收、配对备份与隔离恢复、生产切换与部署后行为验收 |
| [operations/2026-11-04-backdoor-account-incident.md](operations/2026-11-04-backdoor-account-incident.md) | 服务器后门账号与挖矿程序事件的证据链、清除动作与复验结果 |
| [plans/2026-11-02-verification-and-backlog.md](plans/2026-11-02-verification-and-backlog.md) | 代码复核、真实环境验收与台账核验计划（2026-11-04 被四方对齐计划取代，2026-11-05 归档） |
| [plans/2026-11-04-local-changes-audit.md](plans/2026-11-04-local-changes-audit.md) | 本地 41 项未提交改动审核（stash→ff-only→pop 处置依据，2026-11-05 归档） |
| [reviews/2026-11-04-four-way-ledger-alignment.md](reviews/2026-11-04-four-way-ledger-alignment.md) | 本地/GitHub/DockerHub/服务器四方台账对齐盘点；约束内容已沉淀到 DEPLOY/RELEASE_NOTES/台账（2026-11-05 归档） |
| [reviews/2026-11-02-c-series-candidates.md](reviews/2026-11-02-c-series-candidates.md) | 2026-11-02 审查 59 个候选（C 系列）的编号、位置、机制与验证状态，供 DOC-01 追溯；不代表当前代码仍有该问题 |

当前未结事项统一见[项目整理台账](../plans/project-consolidation.md#未结事项)；
归档不表示已修复、已验收，也不延续历史操作授权。

## 归档规则

- 已完成的一次性计划、阶段分析和事故复盘可归档。
- 归档前必须把当前行为沉淀到 owner 文档。
- 没有唯一历史价值、没有引用且已有完整替代的临时记录可以直接删除。
- 只有真实引用或迁移窗口依赖旧路径时才保留短 redirect。

详细生命周期规则见
[DOCUMENTATION_RULES.md](../DOCUMENTATION_RULES.md)。

## 当前状态

2026-11-01 按用户明确指示清理：所有归档正文已删除，且不再保留备份。此前各次整理
（2026-10-31 重复旧稿退出、目录与历史分层、2026-11-01 历史正文清理）的正文内容
均不再存在，只保留本索引作为归档目录入口。

需要追溯历史时，以 Git 历史中 `3d05b08` 及更早提交为准；未提交或未跟踪的历史内容
已不可恢复。

## 维护要求

- 新增归档时更新本页，不再新增第二份 archive summary。
- 仍有真实引用的高层旧路径才保留 redirect；owner 已完整承接且无引用的旧路径直接删除。
