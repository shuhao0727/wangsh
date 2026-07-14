# 归档文档

> 状态：active
> Owner：docs
> 最近复核：2026-07-13

本目录是 WangSh 历史文档的唯一索引。归档内容用于追溯，不再指导当前开发、测试或
部署；当前入口见 [docs/README.md](../../README.md)。

## 归档规则

- 已完成的一次性计划、阶段分析和事故复盘可归档。
- 归档前必须把当前行为沉淀到 owner 文档。
- 部署、数据库、CI、安全、PythonLab 和测试恢复资料不因日期较旧而自动删除。
- 已有旧链接的 tracked 文档优先保留短 redirect。
- 没有唯一历史价值、没有引用且已有完整替代的临时 handoff 可以直接删除。

详细生命周期规则见
[DOCUMENTATION_RULES.md](../../DOCUMENTATION_RULES.md)。

## 当前归档

### 2026-05 已完成方案

- [plans/2026-05-03-learning-platform-improvement.md](plans/2026-05-03-learning-platform-improvement.md)
  - 学习平台实施历史；当前行为由
    [LEARNING.md](../../features/LEARNING.md)维护。
- [plans/2026-05-03-learning-platform-improvement-design.md](plans/2026-05-03-learning-platform-improvement-design.md)
  - 学习平台设计背景；当前架构由
    [LEARNING.md](../../features/LEARNING.md)维护。
- [plans/2026-05-03-it-technology-markdown-book-system.md](plans/2026-05-03-it-technology-markdown-book-system.md)
  - Markdown 书籍系统实施历史；当前行为由
    [ML_BOOK.md](../../features/ML_BOOK.md)维护。
- [plans/sse-redis-pubsub-migration.md](plans/sse-redis-pubsub-migration.md)
  - Redis Pub/Sub 迁移历史；当前行为由
    [AUTO_REFRESH.md](../../features/AUTO_REFRESH.md)和部署文档维护。

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
- 原路径保留 redirect 时，redirect 只包含状态、替代文档和归档正文链接。
- 删除归档正文前，先确认 owner 文档和 Git 历史能够覆盖其唯一信息。
