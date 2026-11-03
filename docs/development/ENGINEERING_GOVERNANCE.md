# 工程治理条例

> 状态：active
> Owner：engineering-governance
> 最近复核：2026-10-31
> 复核周期：每 90 天

本文维护代码规模、模块边界与工程验收约束。协作授权见 [CLAUDE.md](../../CLAUDE.md)，
实际工作流见 [CI/CD](../operations/CICD.md)，动态结果见[测试状态](../testing/TEST_STATUS.md)。

## 一、基本原则

- 重构先保持行为，按职责、依赖与测试边界拆分，不按行数切割或顺带改变业务合同。
- 新代码遵守标准，历史债务只减不增；高风险链路先补测试和观测。
- API、数据库、部署、CI、测试和脚本变化同步对应 owner；发布须可验证、可回退。

## 二、Python 规模与复杂度

### 2.1 文件规模

| 物理行数 | 要求 |
|---|---|
| ≤400 | 正常维护 |
| 401–500 | 新增职责前评估提取 |
| 501–700 | warning；说明职责边界与后续拆分计划 |
| >700 | 新文件禁止；历史文件不得净增长，确需例外按 §十审批并接受 baseline ratchet 检查 |

状态机、解析器、WebSocket 桥接器和生成代码确需例外时登记原因，不因此自动豁免。
拆分保持公共导入、异常类型和返回合同兼容。

### 2.2 函数规模与复杂度

- 普通函数建议 ≤60 行，>100 行须拆分或登记例外；路由建议 ≤80 行，只做鉴权、校验、调用与响应映射。
- 圈复杂度目标 ≤12；无基线/有效例外的函数 >15 报错，历史债务按逐函数 ceiling 检查，不代表已达到目标。
- 参数建议 ≤8 个，更多参数使用 dataclass、schema 或 options object。

文件行数、函数复杂度和 baseline 防回退由 Python 守卫检查；函数/路由行数、参数数量和职责边界
属于人工评审标准。脚本通过不能代替这些评审，也不授权放宽标准。

### 2.3 Python baseline ratchet

`backend/scripts/check_python_governance.py` 检查 `backend/app/**/*.py`，
`python-governance-baseline.json` 保存逐文件行数和逐函数复杂度 ceiling。

- `--base-ref` 同时比较 Git 基线实际指标；历史债务回涨默认阻断，即使仍低于旧 ceiling。
  脚本允许有效逐项例外范围内、未超过 ceiling 的回涨；例外仍须按 §十审批，脚本接受不等于已获准。
- 例外必须逐条包含非空 `owner`、`reason`、`expires_at`，有效期内也不得超过 ceiling；过期直接阻断。
- 基线提交没有 baseline 文件时仍扫描其源码；只承接基线已达 warning 的债务，新增债务须逐项、限期例外。
- 首次过渡不允许通配或模块级豁免。到期前降低职责/复杂度并移除例外，不靠延长日期或提高 ceiling 过关。

### 2.4 拆分顺序

先纯函数/schema/序列化，再查询与外部适配，最后状态机与事务编排。
原模块可保留 facade 和兼容 re-export，标明迁移与移除条件。

## 三、模块边界

```text
api/endpoints -> services -> models/db/core
tasks -> services
scripts -> public services
```

禁止 services 导入 endpoint、core 导入具体业务 feature、跨模块调用私有函数，
以及为绕过权限直接查用户/角色表。复杂 SQL、长事务和跨模块编排不堆在 endpoint。
跨模块能力通过公开 service/adapter 暴露；兼容 facade 或临时 re-export 必须有退出条件。

## 四、测试与 CI 门禁

### 4.1 通用门禁

代码 PR 通过适用的 CI 质量门禁；工作流与命令集中见 [CI/CD](../operations/CICD.md#24-ci-qualityyml-通用质量门禁)。
本地按改动选择可靠验证，后端先满足 [测试隔离前提](../../backend/tests/README.md#运行前提)，
不能将 CI 的专用库命令直接照搬到普通 shell。

- lint error 为 0，现有 warning 不因本次修改净增；Bundle error 阻断，warning 进入量化台账。
- 认证、权限、会话、迁移、并发和数据完整性改动有直接回归；重构覆盖公共导入、返回或关键行为兼容。
- 文档变更按[文档规范](../DOCUMENTATION_RULES.md#检查与交付)验收，不以文档检查替代业务门禁。
- 未覆盖的数据库、外部模型、队列、浏览器与目标环境单列，不合并成“全部通过”。

lint warning 不净增是评审要求；当前 `eslint src` 命令不做 warning 基线比较，须核对本次差异。

### 4.2 专项门禁

- PythonLab、Docker sandbox、WebSocket、Redis、Celery 按影响运行对应 smoke/soak。
- PR 运行时验证使用本次代码与依赖；真实浏览器 channel 和 pointer click 不能由 DOM click 替代。
- 启动验证同时检查目标健康接口和 `RestartCount == 0`；`uvicorn --reload` 的监督进程可能掩盖子进程失败。
- 启动失败场景用不带 `--reload` 的命令核对退出码与错误；“容器 running”不能证明服务正常。

### 4.3 覆盖率目标

变更新代码目标 ≥85%，认证/权限/迁移/并发关键路径目标 ≥95%。未建立全仓可靠基线前，
以 changed-lines 和关键路径测试评价；当前 CI 的 changed-lines 步骤为 `continue-on-error`，
是报告而非阻断，不能把目标写成已强制执行或已达标。

## 五、前端质量

- TypeScript 保持 `strict: true`；service/auth/query/上传代码不引入无理由 `any` 或 `as unknown as`。
- 优先清理 `no-floating-promises`、`react-hooks/exhaustive-deps`；query key 统一用 `queryKeys`。
- 使用已定义 `--ws-*` token，未定义 token 为 0；Monaco、Typst、Graphviz、PDF、Pyodide 等重型运行时保持延迟加载。
- 核心页面覆盖键盘操作、焦点恢复和 WCAG AA 对比度；详细规范由 [UI 入口](../ui/README.md)维护。

## 六、数据库迁移

- 正式结构变更走 Alembic，CI 保持单 head，并在专用空库建立 legacy baseline 后验证完整升级；不等同对生产库验收。
- 破坏性变更采用 expand-migrate-contract，至少跨两个发布版本；数据迁移幂等、可分批、可续跑并有验证查询。
- 独立 one-shot migrator 与 advisory lock 是演进要求；不能据本文假定已取代 Web 启动迁移。
- 破坏性或长锁迁移先核备份、停写窗口和回退；不改写已在生产执行的历史 DDL。

**静态守卫**：在 `backend/` 运行 `python scripts/check_migration_guard.py`，只检查源码。
新增迁移的 upgrade 禁止 `IF NOT EXISTS` / `if_not_exists`，避免静默跳过同名 schema 漂移。
历史 revision 按 `FROZEN_GUARD_COUNTS` 冻结命中数，只减不增；新增例外须说明理由。
清理已执行历史问题走新迁移，不能修改旧 DDL 或提高冻结数掩盖错误。

**运行库漂移检测**：`check_migration_state.py` 检查“待执行迁移要建的对象”与“库中已有对象”的前向冲突，
不覆盖迁移从未创建的孤儿对象，也不重新评估已执行迁移曾被守卫跳过的对象。
后两类须用 `alembic check` 或空库完整升级后比较 schema；不能把预检通过当作整个库无漂移。

## 七、文档和脚本

归属、状态、归档和精简规则由 [DOCUMENTATION_RULES.md](../DOCUMENTATION_RULES.md)维护。
文档元数据、复核周期与删除条件按该规范执行，不在此维护第二套规则。
脚本变动同步就近 README；固定账号/日期/班级或直接写生产数据的脚本不作默认入口。
一次性脚本放外部 scratch，确需保留则说明用途与删除条件。

## 八、发布流程

发布准入保留以下要求，操作步骤见 [DEPLOY](../operations/DEPLOY.md)：

1. 版本输入与源码一致，通用质量门禁通过；`latest` 不作可追溯依据。
2. 六镜像先推 staging，全部可读后推广正式 tag，核准整组 digest，并生成已验证的 `release-set.txt`。
3. 生产只接受完整 release-set；多个镜像仓库改 tag 不是跨仓库原子事务。
4. 最近 24 小时内完成生产模拟与完整 prod-smoke；有迁移时核备份并定期恢复演练。
5. 部署后验证健康、登录、核心 API、关键 UI 和 worker；失败停止推广，按明确方案回滚。
6. 保存镜像 digest，逐步增加 SBOM 与漏洞扫描；演进要求不表示当前已覆盖。

## 九、周期审计

| 周期 | 检查项 |
|---|---|
| 每周 | 文档断链、脚本引用、workflow 漂移 |
| 每月 | 文件规模、复杂度、lint、bundle、依赖漏洞、文档生命周期 |
| 每季度 | 备份恢复、发布回滚演练 |
| 每半年 | Docker socket、Secrets、权限模型、灾难恢复 |

这是维护约定，不表示已创建定时任务或已执行审计。

## 十、例外机制

例外注明规则、范围、Owner、原因、补偿测试/监控和到期日。普通例外最长 30 天；
安全、迁移和数据完整性例外须双人复核。紧急发布例外最长 72 小时，两个工作日内补测试与复盘。
例外不能自行扩大权限或改写安全边界。

## 十一、完成定义

目标行为或结构已实现；按影响选择的必要测试、静态检查、构建和差异检查通过，专项明确要求的全量验证不得省略；
owner 文档已同步、他人改动保留、剩余风险和例外已记录。未覆盖项不得用历史成功补齐。

## 十二、历史分级验证规则入口

旧计划曾称本节已收录 S1–S7 的 10 条规则，但本轮整理前正文实际缺失。
原规则保留在 v3 计划第四节（正文已清理），
包含检查清单冻结、原始证据与判定分离、独立复核、环境隔离、失败复现和链式改动同批验收。
它们属于该专项历史计划；固定版本、顺序、复核比例和整组重跑要求不能自动套用所有后续任务。
当前专项按其已确认清单执行，通用验证遵守本文件 §四与项目 AGENTS。
