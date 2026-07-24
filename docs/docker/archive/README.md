# 归档文档

> 状态：active
> Owner：docs
> 最近复核：2026-07-22

本目录是 WangSh 历史文档的唯一索引。归档内容用于追溯，不再指导当前开发、测试或
部署；当前入口见 [docs/README.md](../../README.md)。

## 归档规则

- 已完成的一次性计划、阶段分析和事故复盘可归档。
- 归档前必须把当前行为沉淀到 owner 文档。
- 部署、数据库、CI、安全、PythonLab 和测试恢复资料不因日期较旧而自动删除。
- 只有真实引用或迁移窗口依赖旧路径时才保留短 redirect。
- 没有唯一历史价值、没有引用且已有完整替代的临时 handoff 可以直接删除。

详细生命周期规则见
[DOCUMENTATION_RULES.md](../../DOCUMENTATION_RULES.md)。

## 已收敛的历史主题

### 2026-05 学习与实时更新方案

- [plans/2026-05-03-learning-platform-improvement-design.md](plans/2026-05-03-learning-platform-improvement-design.md)
  保留轻量内容层、fallback、进度兼容、无效 section 隔离和懒渲染等设计取舍；当前边界由
  [LEARNING.md](../../features/LEARNING.md)维护。
- Markdown 书籍使用稳定 slug、内置离线内容和后端可编辑覆盖，当前实现与兼容策略由
  [ML_BOOK.md](../../features/ML_BOOK.md)维护。
- [plans/sse-redis-pubsub-migration.md](plans/sse-redis-pubsub-migration.md)
  保留多 worker 丢事件、Redis 降级、首事件竞态和恢复验证；当前行为和验证要求由
  [AUTO_REFRESH.md](../../features/AUTO_REFRESH.md)维护。

已完成的学习平台实施步骤和 Markdown 书籍长计划已于 2026-07-18 从工作区移除；
完整过程保留在 Git 历史中，不再作为当前开发入口。

### 2026-07 项目整理与发布收口

- [plans/2026-07-project-consolidation-history.md](plans/2026-07-project-consolidation-history.md)
  将原变更批次清单、健康快照和发布收口长计划合并为一份短历史摘要，只保留冻结范围、
  跨批次依赖、真实提交映射、长期风险和停止条件。当前事实仍由测试状态、发布说明和
  30/60/90 计划维护。
- [CODE_REVIEW_FIXES_2026-07-19.md](CODE_REVIEW_FIXES_2026-07-19.md)
  7 月代码审查批次的历史范围。原“全部完成”结论已在 2026-07-22 复核后撤回，
  当前行为与验证结果以代码、测试状态和发布 owner 文档为准。
- [RELEASE_NOTES_v1.5.x.md](RELEASE_NOTES_v1.5.x.md)
  v1.5.1 到 v1.5.9 的历史发布记录（14个版本，589行）。当前发布记录由主
  [RELEASE_NOTES.md](../RELEASE_NOTES.md) 维护，只保留最近3个版本。

## Git 历史主题

以下早期文档已不保留工作区正文，完整内容可从 Git 历史的 `v1.5.x` 标签追溯：

- 部署与迁移：database migration fix、Alembic migration analysis。
- 前端 UI：dialog、public pages、sheet/panel、全局硬编码审计。
- 项目规划：execution roadmap、three-module improvement、UI upgrade/page tracker。
- 代码质量：code quality audit、项目模块分析、认证和响应式分析。
- 文档治理：2026-04 文档合并与统一报告。
- Bug 复盘：2026-04-08 PythonLab Continue/Tooltip 交互回归。
- 单页体检：AI Agents 页面 UI 报告。

## 维护要求

- 新增归档时更新本页，不再新增第二份 archive summary。
- 仍有真实引用的高层旧路径才保留 redirect；owner 已完整承接且无引用的旧路径直接删除。
- 删除归档正文前，先确认 owner 文档和 Git 历史能够覆盖其唯一信息。
