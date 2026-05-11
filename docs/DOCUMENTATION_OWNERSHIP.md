# 文档归属与自动整理策略

> 状态：active
> 维护范围：项目文档治理、文档归属、生命周期、自动检查策略
> 最近更新：2026-05-02

本文定义 WangSh 项目的文档归属、整理策略和自动更新规则。目标是让文档结构长期保持合理、稳定、高效，避免重复、过期和入口混乱。

## 目标

- 保持文档有明确归属，每个主题只有一个权威来源。
- 减少根 README 和索引文档中的重复内容。
- 让历史报告、一次性排查、阶段计划不会长期伪装成当前指南。
- 删除或归档老旧文档前有明确判断标准，避免误删有价值的部署、迁移、测试或安全信息。
- 为 Agent 和开发者提供固定的文档更新流程。

## 文档类型

项目文档按 Diataxis 思路分为四类：

| 类型 | 用途 | 典型位置 | 示例 |
|---|---|---|---|
| Tutorial 教程 | 帮新成员完成第一次操作 | `README.md`、模块入门文档 | 本地启动、首次部署 |
| How-to 指南 | 解决具体问题 | `docs/docker/deploy/`、脚本 README | 如何回滚、如何跑 smoke |
| Reference 参考 | 列出事实和接口 | `docs/development/API.md`、数据库文档 | API 表、环境变量、表结构 |
| Explanation 解释 | 解释设计原因 | `docs/features/`、设计文档 | PythonLab 架构、测评设计 |

新增或整理文档时，先判断文档类型。不要把操作步骤、接口表、历史报告和设计讨论混在同一个文件里。

## 权威来源表

| 主题 | 权威文档 | 支撑文档 | 触发更新 |
|---|---|---|---|
| 项目入口和快速启动 | `README.md` | `docs/README.md` | 本地启动、生产入口、核心导航变化 |
| 文档导航 | `docs/README.md` | 各目录 README | 新增、移动、归档重要文档 |
| 文档治理规则 | `docs/DOCUMENTATION_RULES.md` | 本文件 | 文档流程、检查规则变化 |
| 文档归属和生命周期 | 本文件 | `docs/README.md` | 整理策略、归档策略、自动检查策略变化 |
| Agent 默认行为 | `AGENTS.md` | `CLAUDE.md` | Agent 工作规则变化 |
| API 契约 | `docs/development/API.md` | 功能模块文档 | 新增、删除、修改 API 行为 |
| 数据库结构 | 对应模块数据库文档 | Alembic migration | 表、字段、索引、约束、枚举变化 |
| 部署和环境变量 | `docs/docker/deploy/DEPLOY.md` | `.env.example`、Compose 文件 | 部署流程、Docker、环境变量变化 |
| CI/CD | `docs/docker/deploy/CICD.md` | GitHub workflows | 工作流、门禁、镜像发布变化 |
| 测试治理 | `docs/docker/testing/README.md` | `backend/tests/README.md`、脚本 README | 测试策略、smoke/soak 入口变化 |
| 功能行为 | `docs/features/*.md` | API、DB、前端专项文档 | 模块行为或架构变化 |
| PythonLab | `docs/features/PYTHONLAB.md` | CI/CD、测试、脚本 README | 沙箱、WebSocket、DAP、可见性、并发变化 |
| 脚本入口 | 各脚本目录 README | `docs/scripts/ARCHIVE_INDEX.md` | 新增、删除、迁移脚本 |
| 发布和运维记录 | `docs/docker/RELEASE_NOTES.md` | deploy/CICD/testing 文档 | 重要 bug fix、部署行为变化 |

## 目录归属

| 路径 | 负责内容 | 不负责内容 | 老旧内容去向 |
|---|---|---|---|
| `README.md` | 项目简介、最短启动路径、核心文档入口 | 长篇 CI 细节、完整 smoke 手册、历史事故 | 移到对应 owner 文档后保留链接 |
| `docs/README.md` | 文档索引、目录导航、关键 owner 入口 | 操作细节、重复教程 | 对应 owner 文档 |
| `docs/development/` | API、开发协作、Agent/Claude 辅助上下文 | 部署操作、历史计划 | `docs/docker/archive/` 或功能文档 |
| `docs/features/` | 功能行为、模块架构、长期设计说明 | 一次性排查报告、阶段计划 | 摘要并归档 |
| `docs/features/assessment/` | 测评模块设计、DB、API、前端和提示词 | 其他模块设计 | 对应模块目录 |
| `docs/docker/deploy/` | 部署、环境变量、CI/CD | 功能设计、测试实现细节 | `docs/docker/archive/` |
| `docs/docker/testing/` | 测试入口、验证策略、smoke/soak 归属 | 单个脚本完整实现说明 | 脚本 README |
| `docs/docker/plans/` | 当前仍有用的计划、治理台账、迁移方案 | 已完成报告、过期周计划 | `docs/docker/archive/` |
| `docs/docker/frontend/` | 前端专项治理、UI 迁移、页面清单和无障碍指南 | 具体页面临时截图排查 | `docs/docker/archive/` 或删除 |
| `docs/docker/archive/` | 历史记录、已完成报告、不可作为当前指南的文档 | 当前操作指南 | 恢复到 owner 文档 |
| `scripts/README.md` | 根层运维和统一入口脚本 | 后端/前端内部脚本细节 | 对应脚本目录 README |
| `backend/scripts/README.md` | 后端 smoke、soak、DB 初始化脚本 | 根层部署脚本 | `scripts/README.md` |
| `frontend/scripts/README.md` | npm、CI、UI audit、前端 smoke 脚本 | 后端 smoke | `backend/scripts/README.md` |

## 生命周期状态

计划、报告、治理台账和历史文档必须有明确状态。建议在文件顶部放元信息块：

```markdown
> 状态：active | reference | superseded | archived | redirect
> Owner：docs | frontend | backend | ops | feature-name
> 最近复核：YYYY-MM-DD
> 替代文档：path/to/doc.md
> 归档条件：说明什么时候可以归档或删除
```

状态含义：

| 状态 | 含义 | 允许位置 | 处理方式 |
|---|---|---|---|
| `active` | 当前仍指导开发、部署或运维 | owner 目录 | 每次相关变更必须更新 |
| `reference` | 稳定参考资料，变化频率低 | owner 目录 | 定期复核即可 |
| `superseded` | 已被新文档替代，但仍需短期保留 | 原位置或 archive | 顶部标明替代文档 |
| `archived` | 历史记录，不指导当前操作 | `docs/docker/archive/` | 保留历史，不再更新正文 |
| `redirect` | 兼容旧链接的短跳转页 | 原位置 | 只保留替代说明和链接 |

## 新文档落位决策树

1. 是项目入口或快速启动吗？放 `README.md`，但只保留最短路径。
2. 是全局文档导航吗？放 `docs/README.md`。
3. 是 API 契约吗？更新 `docs/development/API.md`。
4. 是部署、环境变量、Docker、网关、CI/CD 吗？放 `docs/docker/deploy/`。
5. 是测试策略、smoke/soak 入口、验证矩阵吗？放 `docs/docker/testing/`。
6. 是功能行为、模块架构、用户可见规则吗？放 `docs/features/` 或对应子目录。
7. 是具体脚本怎么用吗？放脚本所在目录的 README。
8. 是当前执行计划、治理台账、迁移方案吗？放 `docs/docker/plans/` 并加生命周期状态。
9. 是已完成报告、历史事故、过期排查记录吗？摘要沉淀到 owner 文档后移入 `docs/docker/archive/`。
10. 是一次性临时记录吗？优先不入库；确需保存时放计划或归档区并标明生命周期。

## 自动更新策略

### Agent 默认动作

Agent 修改代码时应执行以下检查：

1. 根据改动类型查本文件的权威来源表。
2. 读取对应 owner 文档。
3. 修改代码。
4. 判断是否需要同步文档。
5. 若需要，更新 owner 文档，不在多个文档重复写同一事实。
6. 如果新增、移动、归档文档，同时更新 `docs/README.md`。
7. 总结时说明是否更新文档，若未更新则说明原因。

### 推荐自动检查项

后续可以增加轻量脚本或 CI 检查，先从只读检查开始，不自动删除文件。

| 检查项 | 目的 | 建议频率 | 自动修复 |
|---|---|---|---|
| Markdown 链接检查 | 找出断链和错误相对路径 | 每周或 PR | 否 |
| 文档索引检查 | 确认重要文档被 `docs/README.md` 或目录 README 引用 | 每周 | 否 |
| 生命周期元信息检查 | 找出 plans/report/archive 中缺状态的文档 | 每月 | 否 |
| 关键词陈旧检查 | 查找旧版本、旧技术栈、过期端口和路径 | 每月 | 否 |
| 文档 owner 检查 | 检查 API/DB/deploy/CI 改动是否同步 owner 文档 | PR | 否 |
| 脚本 README 检查 | 确认脚本目录新增/删除后 README 同步 | PR | 否 |

自动检查应优先输出报告，不直接删除或移动文档。删除、归档和大规模移动必须由人工确认。

## 清理策略

### 保持 active 的条件

文档满足以下条件时可以保持 active：

- 被文档索引或模块 README 引用。
- 有明确 owner 和使用场景。
- 描述当前行为或当前流程。
- 没有被更权威文档替代。
- 最近复核或没有明显版本、路径、技术栈漂移。

### 转为 redirect 的条件

满足以下条件时，优先转成 redirect，而不是立即删除：

- 文档已明确整合到另一个文件。
- 仍可能有外部或历史链接指向它。
- 正文容易误导读者继续使用旧内容。
- 新 owner 文档已经完整覆盖其有效内容。

redirect 文档只保留：

- 当前状态。
- 替代文档链接。
- 简短说明。

### 归档条件

满足以下条件时，适合归档：

- 文件名带具体日期，内容是阶段报告、审计、迁移记录或一次性排查。
- 当前流程不再依赖它。
- 有历史追溯价值。
- 关键结论已沉淀到 owner 文档。

归档后必须：

- 放入 `docs/docker/archive/` 下合适位置。
- 更新对应 archive README 或索引。
- 在原索引中删除 active 链接，或改为 archive 链接。

### 删除条件

删除 Markdown 文档必须保守。只有满足全部条件才删除：

- 不是部署、回滚、数据库、CI、安全、PythonLab 或测试恢复资料。
- 没有唯一历史决策或事故信息。
- 不被 README、docs index、脚本、CI 或代码注释引用。
- 已有新文档完整替代。
- 删除原因能在 commit 或整理报告中说明。

不确定时，优先归档或 redirect，不直接删除。

## 当前已识别的整理候选

以下是当前探测到的候选项，执行前仍需逐项复核内容和引用。

| 候选 | 当前问题 | 建议动作 |
|---|---|---|
| `README.md` 的 PythonLab CI 长段落 | 根 README 过载 | 将细节迁移到 `docs/docker/deploy/CICD.md`、`docs/docker/testing/README.md`、`docs/features/PYTHONLAB.md`，README 只保留链接 |
| `docs/DATABASE_PERFORMANCE_ANALYSIS.md` | 已是 redirect | 已处理 |
| `docs/development/CLAUDE_GUIDE.md` | 可能存在旧部署链接 | 修正为 `docs/docker/deploy/DEPLOY.md` 相关路径 |
| `docs/development/CLAUDE_MEMORY.md` | 可能包含旧版本号和历史状态 | 标记为 snapshot，不作为 source of truth |
| `docs/docker/archive/plans/PYTHONLAB_DEBUG_CONTINUE_REGRESSION_2026-04-08.md` | 日期型回归报告 | 长期经验已沉淀到 `docs/features/PYTHONLAB.md`，原文归档保留 |
| ~~`docs/ACCESSIBILITY_GUIDE.md`~~ | 已迁移到 `docs/docker/frontend/` | 已处理，原位留 redirect |
| ~~`docs/IMPROVEMENT_CHECKLIST.md`~~ | 已归档 | 已处理，原位留 redirect |
| ~~`docs/analysis/AGENT_ANALYSIS_2026-05-02.md`~~ | 已归档到 `docs/docker/archive/analysis/` | 已处理 |
| ~~`docs/docker/plans/ui-page-tracker.md`~~ | 已归档 | 已处理，原位留 redirect |
| ~~`docs/docker/plans/three-module-improvement.md`~~ | 已归档 | 已处理，原位留 redirect |
| ~~`docs/docker/plans/ui-upgrade-plan.md`~~ | 已归档 | 已处理，原位留 redirect |
| ~~`docs/docker/plans/execution-roadmap.md`~~ | 已归档 | 已处理，原位留 redirect |

## 整理批次建议

### 第一批：治理骨架

- 新增本文件。
- 更新 `docs/README.md`，加入本文件入口和 owner 模型。
- 更新 `docs/DOCUMENTATION_RULES.md`，引用本文件作为归属和生命周期规则。
- 更新 `AGENTS.md`，要求 Agent 遵守本文件。

### 第二批：入口减负

- 精简 `README.md`。
- 将 PythonLab CI/smoke 细节迁移到对应 owner 文档。
- 保留根 README 的快速入口和链接。

### 第三批：链接和陈旧信息修复

- 修复 Claude 文档中的旧链接。
- 修复脚本 README 的 archive 相对链接。
- 检查版本号、技术栈描述、端口和路径是否与代码一致。

### 第四批：归档和 redirect

- 处理 `DATABASE_PERFORMANCE_ANALYSIS.md`。
- 处理日期型 PythonLab 回归报告。
- 为 `docs/docker/plans/` 中计划/报告补生命周期元信息。
- 将已完成报告移入 archive，并更新 archive 索引。

### 第五批：自动检查

- 增加只读文档检查脚本或 CI job。
- 先输出报告，不自动移动或删除。
- 稳定后再考虑自动生成文档审计报告。

## 执行原则

- 先建立规则，再移动文档。
- 先 redirect 或 archive，再考虑删除。
- 先迁移有效内容，再清理旧入口。
- 一次只整理一个 owner 区域，避免大范围路径变更造成断链。
- 每批整理都要更新 `docs/README.md` 或对应目录 README。
