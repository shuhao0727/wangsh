# 文档维护与归属规范

> 状态：active
> Owner：docs
> 最近复核：2026-07-13
> 复核周期：每 90 天

本文是 WangSh 文档维护、归属、生命周期、整理和自动检查的唯一权威规则。
目标是让每个主题只有一个当前入口，历史信息可追溯，操作说明与代码保持一致。

## 一、核心原则

1. 代码行为变化必须同步更新对应 owner 文档。
2. 一个主题只保留一个权威来源，其他文档只引用，不复制动态事实。
3. 当前行为放 owner 文档，未来动作放 active plan，历史过程放 archive。
4. 先迁移有效内容，再 redirect、archive 或删除旧文档。
5. 部署、回滚、数据库、CI、安全、PythonLab 和测试恢复资料从严处理。
6. 自动检查只报告和阻断问题，不自动移动或删除文件。
7. 项目文档统计排除 `node_modules`、`venv`、构建产物、coverage 和 data 目录。

## 二、权威来源

| 主题 | 权威文档 | 触发更新 |
|---|---|---|
| 项目入口与快速启动 | `README.md` | 启动方式、端口、核心导航变化 |
| 文档导航与治理 | `docs/README.md`、本文件 | 新增、移动、归档文档或规则变化 |
| 工程质量门禁 | `docs/ENGINEERING_GOVERNANCE.md` | 文件规模、复杂度、模块边界和发布规则变化 |
| Agent 默认行为 | `AGENTS.md` | Agent 工作方式、项目约定变化 |
| API 契约 | `docs/development/API.md` | API 路径、参数、权限或响应变化 |
| 数据库结构 | 对应功能的数据库文档 | 表、字段、索引、约束、枚举和 migration 变化 |
| 部署与环境变量 | `docs/docker/deploy/DEPLOY.md` | Compose、Docker、网关、环境变量和回滚变化 |
| CI/CD | `docs/docker/deploy/CICD.md` | workflow、镜像和质量门禁变化 |
| 测试策略 | `docs/docker/testing/README.md` | 测试分层、smoke/soak 和脚本入口变化 |
| 当前测试结果 | `docs/docker/testing/TEST_STATUS.md` | 本地或远端验证结果变化 |
| 发布记录 | `docs/docker/RELEASE_NOTES.md` | 重要 bug fix、发布行为和版本变化 |
| 功能行为 | `docs/features/*.md` | 功能、架构、权限和用户可见行为变化 |
| Assessment | `docs/features/assessment/` | 评估设计、DB、API、前端或提示词变化 |
| 脚本入口 | 各脚本目录 README | 新增、删除、迁移或重命名脚本 |
| 当前执行计划 | `docs/docker/plans/` | 当前批次、治理或发布动作变化 |
| 历史归档 | `docs/docker/archive/README.md` | 新增、移动或删除归档正文 |

动态数字只写入 `TEST_STATUS.md`。当前发布步骤只写入
`2026-07-12-project-consolidation-and-release-plan.md`。其他文档引用这两个入口，
不得复制新的“最终结果”。

## 三、文档类型与目录

| 类型 | 目的 | 主要位置 |
|---|---|---|
| Tutorial | 帮助新成员第一次完成操作 | 根 README、模块入门 |
| How-to | 完成部署、回滚、测试等具体任务 | `docs/docker/`、脚本 README |
| Reference | 描述 API、DB、配置、能力清单 | `docs/development/`、`docs/features/` |
| Explanation | 解释架构、设计取舍和治理原因 | 功能文档、工程治理文档 |

目录职责：

- `docs/`：长期维护的全局规则、API 和功能文档。
- `docs/docker/deploy/`：部署、环境变量、CI/CD、回滚。
- `docs/docker/testing/`：测试策略、当前状态和验证入口。
- `docs/docker/plans/`：仍有当前价值的计划、治理台账和 reference。
- `docs/docker/frontend/`：前端页面清单和无障碍说明。
- `docs/docker/archive/`：历史记录，不指导当前操作。
- 模块 README：只说明本模块的测试或脚本使用方式。
- 一次性分析和临时接力优先不入库。

## 四、生命周期

计划、报告、治理台账和历史文档在文件顶部使用：

```markdown
> 状态：active | reference | superseded | archived | redirect
> Owner：docs | frontend | backend | ops | feature-name
> 最近复核：YYYY-MM-DD
> 替代文档：path/to/doc.md
> 归档条件：完成或移除条件
```

| 状态 | 含义 | 处理方式 |
|---|---|---|
| `active` | 当前操作或开发依据 | 相关变更必须同步更新 |
| `reference` | 稳定参考资料 | 定期复核，不维护动态结果 |
| `superseded` | 已被替代但短期保留 | 明确替代文档和移除条件 |
| `archived` | 只用于历史追溯 | 放入 archive，不指导当前操作 |
| `redirect` | 兼容旧链接 | 不超过 25 行，只保留状态、说明和目标链接 |

## 五、标准更新流程

### 修改前

1. 从权威来源表找到 owner 文档。
2. 阅读 owner 文档和相关模块 README。
3. 确认 API、DB、权限、部署或测试合同是否受影响。

### 修改时

1. 保持一个主题一个来源。
2. 示例命令必须使用当前脚本、服务名、环境变量和真实路径。
3. 不把测试快照写成永久事实。
4. 不把历史计划重新包装成当前指南。

### 修改后

1. 更新 owner 文档。
2. 新增、移动或归档文档时更新 `docs/README.md` 和对应目录 README。
3. 脚本变化同步脚本目录 README；删除记录同步 `docs/scripts/ARCHIVE_INDEX.md`。
4. 运行最小可靠验证和 Markdown 合同。

常见映射：

- API 变化：更新 `docs/development/API.md`。
- DB/model/migration 变化：更新模块数据库文档。
- Docker、环境变量、网关变化：更新 `DEPLOY.md`。
- GitHub Actions 变化：更新 `CICD.md`。
- 测试或 smoke/soak 变化：更新测试 README 或脚本 README。
- 重要 bug fix：更新 `RELEASE_NOTES.md`。

## 六、新文档决策

新增文件前按顺序判断：

1. 项目入口或最短启动路径：更新根 `README.md`。
2. 全局导航：更新 `docs/README.md`。
3. API、DB、部署、CI 或测试事实：更新现有 owner 文档。
4. 功能行为或架构：更新 `docs/features/` 对应文档。
5. 脚本使用方法：更新脚本所在目录 README。
6. 当前计划或迁移方案：放 `docs/docker/plans/`，并设置生命周期。
7. 已完成报告或事故：先沉淀长期结论，再放 archive。
8. 一次性排查记录：使用系统临时目录，不提交。

## 七、合并、归档与删除

### 合并

- 先确定新的唯一 owner。
- 把仍然有效的规则、命令和结论迁入 owner 文档。
- 删除重复叙述和过期数字。
- 旧 tracked 路径仍可能被引用时保留 redirect。

### 归档

适用于有历史价值、但不再指导当前操作的日期型计划、审计和事故报告。
归档后必须更新 `docs/docker/archive/README.md`。

### 删除

只有同时满足以下条件才直接删除：

- 不属于部署、回滚、数据库、CI、安全、PythonLab 或测试恢复资料。
- 没有唯一历史决策。
- 没有 README、workflow、脚本或代码引用。
- 已有 owner 文档完整替代。
- 删除原因可在变更记录中说明。

可重建生成物、未引用且已完全替代的临时 handoff 可以直接清理。

## 八、自动检查

当前只读门禁：

```bash
node scripts/check-markdown-contracts.mjs
node --test scripts/markdown-contracts.test.mjs
git diff --check
```

`markdown-quality.yml` 在 Markdown、检查脚本或 workflow 自身变化时运行，覆盖：

- 相对链接、reference-style 链接和标题锚点。
- 仓库外绝对路径和 symlink 逃逸。
- fenced/inline code 排除、围栏平衡和单 H1。
- lifecycle metadata、redirect 长度和目标链接。
- archive 唯一索引、学习章节数量和派生统计。

自动检查不替代人工判断。内容是否准确仍需对照代码、配置和运行结果。

## 九、提交前清单

- [ ] 每个主题只有一个当前 owner。
- [ ] 动态测试结果只出现在 `TEST_STATUS.md`。
- [ ] 示例命令、端口、版本、服务名和路径与代码一致。
- [ ] active/reference/redirect/archive 状态正确。
- [ ] 索引和旧路径引用已同步。
- [ ] 没有提交生成物、临时接力或敏感信息。
- [ ] Markdown 合同和 `git diff --check` 通过。

旧路径 `docs/DOCUMENTATION_OWNERSHIP.md` 仅作为兼容 redirect 保留。
