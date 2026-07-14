# WangSh 项目健康报告

> 状态：reference
> Owner：project-governance
> 快照日期：2026-07-13
> 替代条件：下一次完整发布后生成新的健康快照

本文是 2026-07-13 的项目健康判断，不维护实时测试数字。当前测试、证据和待执行门禁
统一见 [TEST_STATUS.md](../testing/TEST_STATUS.md)，当前发布动作见
[项目收口计划](2026-07-12-project-consolidation-and-release-plan.md)。

## 总体结论

WangSh 已经是功能较完整的教育平台，不再属于原型项目。认证、课堂、AI 智能体、
Assessment、内容学习、信息学、IT 游戏、XBK、PythonLab、Docker 部署和后台管理均有
明确实现与测试入口。

当前综合状态：

| 维度 | 判断 | 说明 |
|---|---|---|
| 功能完整性 | 良好 | 核心教学与管理模块齐全 |
| 后端架构 | 良好 | FastAPI、async SQLAlchemy、Alembic、Redis/Celery 边界基本清晰 |
| 前端架构 | 良好 | React 19、TypeScript、Query、懒加载和设计 token 已形成约束 |
| 自动化测试 | 良好 | 单元、组件、脚本、迁移、smoke、生产模拟均有入口 |
| 安全与权限 | 良好 | 角色层级、用户管理保护、会话轮换和日志脱敏已加强 |
| 发布成熟度 | 待收口 | 本地门禁较完整，真实 PR runner、registry 和生产恢复证据尚未闭环 |
| 维护成本 | 中等 | 仍有超长 Python、lint warning、bundle 和运行隔离债务 |

结论：项目可以进入可审查提交和远端 PR 验证，但在 Commit 6-8、最终 HEAD 门禁、
远端 release-set、数据库备份恢复和回滚演练完成前，不应宣布正式发布完成。

## 已完成改进

### 代码与模块

- 认证、会话、用户管理和角色路由已形成独立可审查提交。
- IT 游戏、学习内容、课堂/AI、Assessment/迁移和前端路由/bundle 合同已分批提交。
- 课堂、Typst、IT 游戏等高复杂度服务已开始按职责拆分。
- 25 个无引用旧源码或一次性脚本入口已完成专项审计，等待独立清理提交收口。
- Python 文件规模与复杂度 governance 已接入本地和 CI 合同。

### 数据库与部署

- 正式结构变化使用 Alembic，不再依赖 `create_all` 作为生产迁移方案。
- legacy baseline、Assessment 字段和索引恢复已进入 migration 链。
- 开发和生产 Compose 配置、PythonLab namespace/workspace、release-set 和生产模拟
  已形成明确合同。
- 生产 smoke、服务日志和 workflow 实时输出使用统一脱敏规则。
- 生产模拟使用隔离 project、sandbox namespace 和 workspace，清理范围不影响开发栈。

### 前端

- 角色路由、StrictMode 认证初始化和关键懒加载路径已有回归覆盖。
- CSS token、UI audit、TypeScript、生产构建和 bundle budget 形成自动门禁。
- Monaco、Pyodide、Graphviz、Typst、PDF、Xterm 等重型能力保持动态入口。
- UI 页面清单、样式护栏、颜色、角色和无障碍说明已按 owner 整理。

### 文档与脚本

- 文档已分为 owner、active plan、reference、redirect 和 archive。
- `TEST_STATUS.md` 是唯一动态测试状态入口。
- `docs/docker/archive/README.md` 是唯一归档索引。
- 根 README、`CLAUDE.md`、前端测试和无障碍文档已删除重复或失效教程。
- 9 份未提交且被完整替代的临时 handoff/重复归档副本已删除。
- 旧 tracked 计划保留短 redirect，历史正文进入 archive。
- 当前脚本由各目录 README 维护，历史删除原因由 `docs/scripts/ARCHIVE_INDEX.md` 维护。

## 主要风险

### 发布

- Commit 6-8 尚未完成，最终分支 HEAD 门禁尚未重跑。
- 新增/修改 workflow 尚未经过真实 GitHub Actions PR runner。
- Docker Hub 六镜像 digest 和 release-set 尚未完成远端验收。
- 正式生产数据库升级、备份恢复和镜像/数据库回滚尚未演练。

### 后端

- 仍有少量高复杂度或超长 owner，需要按测试覆盖和变更频率逐步拆分。
- application startup 与生产 migration 仍需进一步解耦为 one-shot migrator。
- 依赖方向目前主要依靠规则和审查，自动 import 边界仍可加强。

### 前端

- lint warning 仍是历史债务，必须通过按模块 ratchet 逐步下降。
- bundle 已受预算约束，但重型模块和静态资产来源仍需继续治理。
- 角色/路由自动测试较强，键盘、屏幕阅读器和多断点真实浏览器矩阵仍需制度化。

### PythonLab

- Docker、WebSocket、DAP、并发、资源限制和可见性使其保持高风险。
- DAP 已支持 reconnect window、`last_seq` 和事件重放，但真实浏览器状态恢复仍需持续
  覆盖。
- Docker socket 权限仍需通过最小权限 controller 分阶段隔离。
- 调试控制区必须继续避免复杂 Tooltip/portal/focus restore 引入点击回归。

## 当前优先级

| 优先级 | 工作 |
|---|---|
| P0 | 完成 Commit 6-8、最终 HEAD 门禁和凭据轮换 |
| P1 | 真实 PR runner、远端 release-set、数据库备份恢复和回滚 |
| P1 | 高风险 Python owner 拆分、lint/bundle ratchet、静态资产来源 |
| P2 | one-shot migrator、角色/无障碍矩阵、供应链证据 |
| P2 | 依赖方向门禁、Docker socket 隔离、可观测和恢复手册 |

## 改进路线

详细 30/60/90 天任务、依赖和退出标准见
[30/60/90 天工程治理计划](2026-07-11-project-governance-30-60-90-execution-plan.md)。

执行顺序保持简单：

1. 先完成当前发布闭环。
2. 再拆分高风险 owner、降低 warning 和 bundle。
3. 然后建立 migrator、依赖方向、无障碍和供应链证据。
4. 最后制度化发布前硬门禁、恢复演练和 Docker 权限隔离。

## 最终评价

WangSh 的主要问题已经从“功能是否可用”转为“发布是否可追溯、结构是否易维护、
故障是否可恢复”。现有测试和治理基础足以支持继续迭代；后续应减少并行大改，按 owner
小批次推进，并坚持测试、文档、迁移和发布证据同时收口。
