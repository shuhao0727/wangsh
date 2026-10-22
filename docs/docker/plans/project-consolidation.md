# 当前项目整理计划与未解决台账

> 状态：active
> Owner：project-governance
> 最近复核：2026-10-20
> 归档条件：本轮批次完成并验证，未解决事项转入后续明确 owner 和计划后归档。

本文是当前全项目文件整理和历史审计复核的唯一执行台账。用户已授权按先前扫描建议分批实施，
并允许多 agent 按文件边界协作。本文记录范围、决策和退出条件；实际检查结果只写
[TEST_STATUS.md](../testing/TEST_STATUS.md)，不把旧报告数字复制为当前事实。

## 执行边界

- 以当前工作区的源码、配置、真实引用和可复核结果为准，保留用户与其他 agent 的未提交改动。
- 整理阶段不执行生产数据修改、部署或发布。用户于 2026-10-19 追加 GitHub 提交与镜像发布授权，按 `2.1.5` 候选执行独立发布门禁；`2.1.6` 随后按同一门禁发布镜像（见 `docs/docker/RELEASE_NOTES.md`）。服务器部署和业务数据修改仍不在本轮范围。
- 删除代码先核对运行入口、懒加载、动态 import、测试、npm、workflow 和文档引用；外部引用不明则保留。
- 数据库、认证、测评事务、PythonLab 和运维脚本按专项风险处理，不因历史报告给出低优先级就直接合并或删除。
- 不恢复 stash 中未提交的废弃计划，不改变用户已确认的 UI 视觉决定。

## 批次与验收

| 批次 | 当前范围 | 执行安排 | 退出证据 |
|---|---|---|---|
| 1 文档入口与生命周期 | 当前台账、失效索引、历史归档、功能 owner 和不存在的脚本条目 | 本轮已完成并验证 | Markdown 链接/锚点/生命周期检查；历史原文和 owner 边界人工复核 |
| 2 废弃入口与本地产物治理 | 仅处理已证实无引用的组件、旧导出和可重建产物；清理脚本默认可预览 | 本轮已完成，缓存严格按最终预览清理 | 引用复核、适用的类型检查/构建；清理范围及拒绝越界验证 |
| 3 重复数据与共享源 | AI伙伴目录单源同步；IT课程、阅读器、导图和稳定实验资源共享；测评计分与 smoke 脱敏纯计算复用 | 本轮已完成，按兼容边界验证 | 内容与行为保真、生成合同、类型/构建、隔离回归和只读浏览器抽查；保留双端独立构建与原服务入口 |
| 4 普通大页面与样式 | 按页面或模块抽取复用关系，避免全仓格式化与无依据拆文件 | 后续逐模块执行 | 类型检查、关键交互和浏览器效果；用户确认单独记录 |
| 5 高风险架构专项 | 认证、测评提交事务、PythonLab 调试/沙箱、数据库迁移和运维 | 后置独立验证 | 对应 owner 的真实数据库、队列、Chrome/WebKit、备份或隔离栈门禁 |

批次完成必须同时说明实际修改、已执行验证、未覆盖场景和遗留事项；不能以“文件变短”作为业务正确的证明。

## 本轮代码与产物整理

- 删除已核对 Git 历史和引用的闲置 AdminDialog、SummaryCard、command、popover 组件，
  清除旧模拟智能体/用户 API 导出及其专用类型；真实 API 和业务组件保留。
- 移除无直接用途的 npm 依赖声明与失效分块规则，不升级仍保留的锁定版本。
  `remark-parse` 继续作为 Markdown 工具链的间接依赖存在，不按锁文件名字重复删除。
- AI伙伴目录以 `backend/app/services/ai_partner_catalog.json` 为维护源，通过脚本生成
  前端副本；CI 检查漂移与无效输入，前后端运行时不跨 Docker 上下文读文件。
- 公开课程、BookReader、只读思维导图与 PythonLab 稳定实验资源迁至
  `frontend/src/features/it-technology/`；课程内容和 CSS 保真，编辑器、Studio、
  画布与调试状态机继续留在 Admin 原边界。
- 测评首次成绩去重、知识点聚合和分数分布迁至 `assessment/scoring.py`，
  原 session 服务的查询、事务、统计入口和测试挂载点保留。
- smoke 日志脱敏迁至标准库纯模块 `scripts/prod-smoke/log_redaction.py`；两个 CLI
  直接复用，`run.py` 保留兼容入口，独立导入、输出、退出码和信号合同均纳入回归。
- 缓存清理仅接受 `.gitignore` 已忽略且不含跟踪文件的白名单路径；不进入其他工作树、
  数据、上传、依赖或构建目录，不跟随符号链接；浏览器证据与 `.codex/` 默认保留。

## 本轮文档收敛决定

- 文档入口、生命周期和全项目整理计划统一由 [DOCUMENTATION_RULES.md](../../DOCUMENTATION_RULES.md) 约束。
- 已确认 UI 视觉以 [EMBEDDED_UI_STYLE_GUIDE.md](../frontend/EMBEDDED_UI_STYLE_GUIDE.md) 为准，
  进度与用户确认状态由 [UI_REDESIGN_ROADMAP.md](../frontend/UI_REDESIGN_ROADMAP.md) 维护。
  [UI 回归参考](ui-single-page-governance.md) 只保留体检和交互验证方法。
- 异步分析当前端点、权限、状态、撤销和列表限制收敛到
  [AI_AGENTS.md](../../features/AI_AGENTS.md#深度分析异步任务)。
- 隐私接口的导出/删除范围、审计事务和同意管理状态收敛到
  [GDPR.md](../../compliance/GDPR.md)。日期实施总结不再作为合规完成证明。
- 输入防护、归档和数据库索引继续由 [XSS_PROTECTION.md](../../security/XSS_PROTECTION.md)、
  [DATA_ARCHIVING.md](../../features/DATA_ARCHIVING.md) 和
  [DATABASE_PERFORMANCE_GUIDE.md](../../DATABASE_PERFORMANCE_GUIDE.md) 维护，不复制旧收益估算。
- 后端脚本索引移除不存在的 `verify_async_analysis.py` 与 `test_async_analysis.py`，
  维护用例直接指向 `backend/tests/ai_agents/test_async_analysis.py`，不恢复一次性脚本。

## 未解决与待复核事项

| 编号 | 状态与事实 | Owner | 后续动作与关闭证据 |
|---|---|---|---|
| DOC-01 | 历史审计保留大量当时的已完成/待办标记，当前并未逐条重新验收 | project-governance + 各功能 owner | 需要动作时先重现或找当前反证，再登记具体条目；只有当前回归或明确接受记录才能关闭 |
| ASYNC-01 | 已确认：混合分析记录列表不应用 `skip`，`total` 仅为返回数量 | backend / ai-agents | 独立设计列表分页合同，补稳定排序、边界与 API/前端回归；本轮只纠正文档 |
| ASYNC-02 | 待专项验证：真实模型、Redis/Celery、失败与撤销、结果落库的完整链路 | backend + ops | 在隔离环境跑真实任务并保存状态与数据库证据；结构/schema 用例不替代端到端验收 |
| PRIV-01 | 已确认：导出和删除仅覆盖本人 AI 对话与小组讨论，未覆盖其他学习域及备份 | backend + 数据 owner | 明确数据域矩阵、删除/匿名化和备份策略，修正“所有数据”说明及响应；补关联和失败事务回归 |
| PRIV-02 | 已确认：存在同意模型和迁移，未发现写入/撤回 API 与前端自助闭环 | backend + frontend | 明确告知版本、同意与撤回合同、可用入口和审计证据后实现；不以表结构代替完成状态 |
| PRIV-03 | 已确认：导出/删除审计在后续业务前单独提交，只能证明请求尝试 | backend | 若需记录完成结果，设计明确结果字段和失败路径，补成功/失败隔离测试 |
| PRIV-04 | 未验证：隐私迁移在具体数据库的应用状态；运营地区、责任人、渠道、保留期限等不能由源码判定 | ops + 运营责任人 | 逐环境核对迁移、配置与数据流，由运营方确认政策；不写占位承诺或法规认证结论 |
| PERF-01 | 历史数据量、缓存命中、提速倍数和容量结论包含估算，当前未复跑 | backend + ops | 确认负载、样本、索引和环境后测量，证据写测试状态；不按估算执行破坏性优化 |
| UI-01 | 路线图仍有“待用户确认”和专用布局状态 | frontend | 按路线图逐页保留工程验证与用户确认；归档旧 UI 计划不提升验收状态 |
| ARCH-01 | 大文件和重复业务属于候选架构调整，不能只按行数认定应拆分 | 各模块 owner | 先明确依赖和事务边界，按批次 4/5 提供小范围实现与对应回归 |

上述状态是本次源码与文档核对所得；未运行的专项仍保持未验证，不因为本轮其他门禁通过而关闭。

## 历史来源与复核方式

以下原文保留在 archive。它们是分析输入和历史证据，不再承担当前计划或唯一台账职责。

| 历史来源 | 当前用途与限制 |
|---|---|
| [30/60/90 治理计划](../archive/2026-07-11-project-governance-30-60-90-execution-plan.md) | 长期治理取舍参考；旧退出标准不是本轮已完成证明 |
| [2026-09-08 首轮问题台账](../archive/2026-09-08-project-audit-findings.md) | 保留 XBK、认证和 PythonLab 的当时证据与边界 |
| [2026-09-08 全项目审查计划](../archive/2026-09-08-project-comprehensive-audit-plan.md) | 审查范围、分工和保护措施的历史记录 |
| [2026-10-03 UI 改造计划](../archive/2026-10-03-ui-improvement-plan.md) | 保留旧实测与废弃方向；当前视觉以嵌入式规范为准 |
| [视图迁移与 PythonLab 类型计划](../archive/2026-10-03-view-migration-and-pythonlab-type.md) | 迁移与控件约束的历史决策，需按当前代码专项核验 |
| [2026-10-09 综合审查](../archive/2026-10-09-comprehensive-review.md) | 保留当时代码/门禁反证，不扩展成当前全项目保证 |
| [六轮问题清单](../archive/2026-10-09-six-round-audit-issue-list.md) | 历史候选和验证脉络，旧“唯一台账”称谓停止生效 |
| [全面深度审核报告](../archive/2026-10-09-comprehensive-audit-final-report.md) | 存在未填写占位段，不把“final”名称解释为完整终验 |
| [全面完善计划](../archive/2026-10-09-comprehensive-remediation-plan.md) | 历史执行安排；逐条状态须有当前证据 |
| [六轮审计验证报告](../archive/2026-10-09-verification-report.md) | 保留当时逐项核查与反证，不复制历史通过率 |
| [文件整理扫描](../archive/2026-10-10-file-organization-findings.md) | 68 条为旧扫描候选口径，不按数量直接删除 |
| [AI 智能体全面分析](../archive/2026-10-01-ai-agents-analysis.md) | 旧评分、架构与优化建议，当前行为回到 AI_AGENTS owner |
| [智能体数据全面分析](../archive/2026-10-01-agent-data-analysis.md) | 数据量与性能估算待复测；已有索引/归档不重复建设 |
| [异步分析使用指南](../archive/2026-10-01-async-analysis-guide.md) | 保留原设计；旧接口和运行命令停止指导当前操作 |
| [异步分析验证报告](../archive/2026-10-01-async-analysis-verification.md) | 保留历史验证声明；旧脚本不存在且本轮未重跑队列 |
| [隐私实施总结](../archive/2026-10-01-gdpr-implementation-summary.md) | “全部数据”、同意闭环和合规完成声明以当前 owner 更正为准 |

已有反证不能忽略：`backend/app/celery_app.py` 与 `backend/app/core/celery_app.py` 的双路径
兼容同一 Celery 实例，不应仅凭文件名相似删除兼容入口；“尚无异步分析、归档或索引”的旧描述
也必须先核对当前实现。后续新发现应登记可复现事实、当前证据和 owner，避免复活已废弃方案。

## 验证与交付

本轮文档至少执行 Markdown 合同、合同测试和 `git diff --check`；代码和脚本按实际变更运行
相应门禁。具体命令结果由主 agent 统一更新 [TEST_STATUS.md](../testing/TEST_STATUS.md)。
未验证的生产、数据库、真实模型、浏览器和用户视觉场景保持明确，不归入自动通过。
