# 归档文档

> 状态：active
> Owner：docs
> 最近复核：2026-09-08

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

### 2026-08 全方位多 Agent 诊断

以下三份正文已从 Git 历史备份提交 `85ceba5` 恢复，并明确标记为 `archived`；它们只保留当时的审核证据和决策轨迹，不代表当前代码或运行状态。报告提到的 `screens/visual-review/` 截图目录当前不在工作区，本次未伪造或补建截图。

- [2026-08-10-ui-branch-layout-review.md](2026-08-10-ui-branch-layout-review.md)
  UI 分支**布局与内容结构化审核**（DOM/几何 交叉预期布局）：结论 A- 结构健康
  （无错位/缺元素/重叠/响应式溢出）；逐页核对 hero/统计卡/表格/工作台/编辑器/独立页，
  记录 3 处需复核(PythonLab 运行按钮、Users 分页、数据态近空页)。截图 `screens/visual-review/`。

- [2026-08-10-ui-branch-visual-review.md](2026-08-10-ui-branch-visual-review.md)
  UI 分支(`feature/ui-optimization-design`)**视觉审核**：浏览器实跑 41 页截图 +
  计算样式数值探针 + 全站门禁。结论 B+ 良好（无横滚/Violet 泄漏/空态得当）；
  记录 2 处需数据预置页(task-compare/mindmap-preview)与可复核索引。截图在
  `screens/visual-review/`。工程/代码层问题归并到 2026-08-06 报告 §B/§F。

- [2026-08-06-multi-agent-diagnosis-report.md](2026-08-06-multi-agent-diagnosis-report.md)
  **历史综合诊断快照**（工程健康 8 维 + UI 视觉 6 维合并）。快照记录：批次 1-2 已完成
  （accent 统一、V2 定一色，用户验收通过）、批次 3 进行中（token 映射地基 + 结果页壳整改）；
  待办 DEFECT-1（后台刷新弹回 /home，前端 token 续期）、DEFER-beam（光束图渲染暂缓）。
  报告在当时按 Decision Log + 状态字段持续更新。**含 §F 全仓库全方位深度分析**（8 维度：
  架构/DB/安全/性能/前端/部署/测试/文档），含综合评级与全项目 TOP 问题（P0 假数据/mock 边界、
  task_analyses 缺索引、安全 SSRF/路径穿越、性能双跑 SSE+轮询等）。
  当前事实以代码、门禁结果和 owner 文档为准。

### 2026-09 真实代理链验收

- [2026-09-11-proxy-chain-acceptance.md](2026-09-11-proxy-chain-acceptance.md)
  用当前工作区构建独立验收镜像（`wangsh-accept/*:proxy-accept-1`）部署合成栈，完成真实
  代理链 8 场景验收：gate 关闭 503、受控 enrollment 恢复、Caddy 头清洗、同 IP A→B 替换撤销、
  A→B→A 循环、不同 IP 不互踢、拓扑防护、后端直达伪造头边界。经网关路径全部通过；残留边界
  （`AUTH_TRUST_X_FORWARDED_FOR` 无 peer 校验）已由 `AUTH_TRUSTED_PROXY_CIDRS` 治理并复测。
  当前行为以 [AUTH](../../features/AUTH.md) 与 [DEPLOY](../../docker/deploy/DEPLOY.md) 为准。
- [2026-09-11-v2-multiagent-acceptance.md](2026-09-11-v2-multiagent-acceptance.md)
  v2.0 真实 Docker 栈 4 域多 agent 验收（认证/XBK/前端/运维）：27 通过 / 3 口径不符
  （均裁定无产品缺陷，含 XBK 前端路径对齐核查）。环境为独立 `v2accept` 项目、
  镜像 `shuhao07/*:2.0`，XBK 使用真实名单/课程/选课文件。

### 2026-07 项目整理与发布收口

- [plans/2026-07-project-consolidation-history.md](plans/2026-07-project-consolidation-history.md)
  将原变更批次清单、健康快照和发布收口长计划合并为一份短历史摘要，只保留冻结范围、
  跨批次依赖、真实提交映射、长期风险和停止条件。当前事实仍由测试状态、发布说明和
  30/60/90 计划维护。
- [CODE_REVIEW_FIXES_2026-07-19.md](CODE_REVIEW_FIXES_2026-07-19.md)
  7 月代码审查批次的历史范围。原“全部完成”结论已在 2026-07-22 复核后撤回，
  当前行为与验证结果以代码、测试状态和发布 owner 文档为准。
- [RELEASE_NOTES_v1.5.x.md](RELEASE_NOTES_v1.5.x.md)
  保留当前仓库可追溯的 v1.5.x 早期版本与 hotfix 记录。当前发布事实由主
  [RELEASE_NOTES.md](../RELEASE_NOTES.md) 维护。

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

### 2026-09 文件整理与 2.1 发布闭环

- [2026-09-13-docker-clean-build-verify-release-plan.md](2026-09-13-docker-clean-build-verify-release-plan.md)
  记录 2.1 发布候选的 Docker 构建、真实隔离验证、GitHub/Docker Hub 推送及旧标签清理；
  当前正式事实以 [RELEASE_NOTES.md](../RELEASE_NOTES.md)、
  [TEST_STATUS.md](../testing/TEST_STATUS.md) 和 [DEPLOY.md](../deploy/DEPLOY.md) 为准。
- [2026-09-09-release-readiness-gap.md](2026-09-09-release-readiness-gap.md)
  保留 v1.6/v2.0 阶段的审计差距快照，已由 2.1 发布记录替代。
- [2026-07-14-project-file-consolidation-plan.md](2026-07-14-project-file-consolidation-plan.md)
  保留项目整理批次的删除边界、引用核对与可恢复清理策略；后续动态清理由
  [TEST_STATUS.md](../testing/TEST_STATUS.md) 记录。
