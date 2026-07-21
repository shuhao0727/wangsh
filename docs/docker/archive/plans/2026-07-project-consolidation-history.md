# 2026-07 项目整理与发布收口历史摘要

> 状态：archived
> Owner：project-governance
> 快照范围：2026-07-11 至 2026-07-14
> 最近复核：2026-07-19
> 替代文档：`docs/docker/testing/TEST_STATUS.md`、`docs/docker/RELEASE_NOTES.md`、`docs/docker/plans/2026-07-11-project-governance-30-60-90-execution-plan.md`

本文合并以下已完成长文档中仍有唯一历史价值的内容，不再恢复原始正文：

- `docs/docker/plans/2026-07-11-change-batch-manifest.md`
- `docs/docker/plans/2026-07-11-project-health-and-improvement-report.md`
- `docs/docker/plans/2026-07-12-project-consolidation-and-release-plan.md`

## 冻结范围

2026-07-11 的工作区快照包含 222 个入口：142 个 tracked、80 个 untracked，按七个
领域归类：

1. 用户权限、认证和会话
2. 课堂、AI agents 和异步任务
3. Assessment、Alembic 和数据库
4. IT 游戏、学习平台、XBK 和文章
5. 前端认证、路由、UI 和 bundle
6. Docker、PythonLab、CI 和发布脚本
7. 文档、测试与工程治理

后续另审计并删除 25 个无引用旧源码或一次性脚本入口；该集合未继续扩张。

## 关键依赖决定

- migration 顺序固定为 IT 游戏表、课堂字段、Assessment repair、legacy 索引恢复；
  中间提交不能破坏单一 Alembic revision graph。
- `frontend/src/App.tsx` 同时承载权限矩阵和功能路由，不能脱离对应组件单独提交。
- `.env.example` 同时承载发布配置和功能上限，配置与实现必须一起审查。
- `frontend/package.json` 与 lockfile 必须同批提交。
- CI、部署、测试和功能 owner 文档必须与代码行为同步到达。
- `.env`、本地数据、生产 smoke 证据、Pyodide runtime、浏览器报告和明文凭据禁止提交。

## 实际提交收口

原计划为八个提交，实际保留五个专题提交：

1. `2d46feb`：认证、会话和用户管理
2. `751689d`：IT 游戏、学习平台和内容功能
3. `c584cc4`：课堂、AI agents 和异步任务
4. `0e6d42a`：Assessment 和数据库迁移
5. `f4db083`：前端路由、UI 和 bundle 合同

原 Commit 6-8、后端服务拆分、25 个删除入口和文档治理由
`79a0c95 Streamline project structure and remove obsolete code` 统一收口；
后续 clean-runner 修复由 `17da07b` 完成。已形成的历史不通过 rebase 或 amend 重写。

## 提交与发布验证摘要

- Commit 1 覆盖认证、refresh rotation、logout、用户锁和管理员权限边界；Commit 2
  覆盖 IT 游戏、学习内容、文章、Typst 和 XBK；Commit 3 覆盖课堂、AI agents、
  Redis Pub/Sub 和异步分析；Commit 4 覆盖 Assessment、Alembic 和 bootstrap；
  Commit 5 覆盖前端路由、UI 和 bundle 合同。
- 综合治理提交补齐日志脱敏、服务拆分、脚本清理、文档 owner 和 workflow 合同；
  clean-runner 修复解决 ECharts peer 依赖、CI 安全配置作用域和 refresh-token 测试
  对预置用户的依赖。
- 2026-07-14 的 `origin/main` 基线为：后端 `661 passed, 3 skipped`，前端
  `67 files / 338 passed`，前端脚本 `19 passed`，Workflow contracts `30 passed`，
  Markdown contracts `10 passed`，开发/生产 Compose 解析和单一 Alembic head 通过。
- 隔离生产模拟从零重跑为 `14/14 PASS`，UI smoke `13/13 PASS`，OpenAPI sweep
  `89/89 OK`；模拟容器、网络、卷和 workspace 均完成清理。
- GitHub Actions `ci-quality` run `29310765657` 和 `markdown-quality` run
  `29310765680` 成功。Docker Hub 六个 `1.6.0` 镜像均为 `linux/amd64`，
  `release-set.txt` 已完成手工验证。

## 2026-07-13 健康快照

当时判断：核心教学和管理模块齐全，前后端架构、权限、自动化测试和通用 CI 已形成
稳定基础；主要问题从“功能是否可用”转为“发布是否可追溯、结构是否易维护、故障是否
可恢复”。

保留下来的长期风险：

- PythonLab 的 Docker、WebSocket、DAP、并发、资源限制和真实浏览器恢复仍属高风险。
- 高复杂度 Python owner、ESLint warning 和重型 bundle 需要按模块逐步降低。
- one-shot migrator、依赖方向门禁、无障碍矩阵、供应链证据和 Docker socket 隔离
  仍需后续推进。
- 凭据轮换、专项远端 workflow、release-set 和生产恢复演练必须与普通本地测试分开
  形成证据。

这些事项现由 30/60/90 计划和当前测试状态维护，不在本历史摘要复制动态结果。

## 历史停止条件

当时发布流程约定，出现以下情况不得进入下一阶段：

- 当前批次测试失败或暂存区出现范围外文件。
- Alembic 出现多 head 或空库升级失败。
- 测试报告包含有效 token、Cookie 或密码。
- production smoke 或 GitHub Actions 失败。
- 六镜像或 release-set 不完整。
- 数据库恢复或回滚无法验证。

## 当前入口

- 当前测试事实：[TEST_STATUS.md](../../testing/TEST_STATUS.md)
- 当前发布记录：[RELEASE_NOTES.md](../../RELEASE_NOTES.md)
- 当前部署方式：[DEPLOY.md](../../deploy/DEPLOY.md)
- 长期治理：[30/60/90 计划](../../plans/2026-07-11-project-governance-30-60-90-execution-plan.md)
- 当前文件整理：[项目整理执行计划](../../plans/2026-07-14-project-file-consolidation-plan.md)
