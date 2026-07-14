# 工程治理条例

> 状态：active
> Owner：engineering-governance
> 最近复核：2026-07-11
> 复核周期：每 90 天

本文是 WangSh 代码规模、模块边界、质量门禁、迁移和发布流程的权威规则。
目标不是机械追求小文件，而是建立可理解、可测试、可恢复、可持续演进的工程体系。

## 一、基本原则

1. 先保持行为，再调整结构；重构不得顺带改变业务契约。
2. 按职责、依赖方向和测试边界拆分，不按行数机械切割。
3. 新代码遵守新标准，历史债务采用 baseline ratchet，不要求一次清零。
4. 高风险链路优先补测试和观测，再拆分实现。
5. API、数据库、部署、CI 和脚本变化必须同步 owner 文档。
6. 发布必须可验证、可回滚，不以“本地能运行”替代生产模拟。

## 二、Python 规模与复杂度

### 2.1 文件规模

| 范围 | 状态 | 处理要求 |
|---|---|---|
| `<= 400` 物理行 | 正常 | 可直接维护 |
| `401-500` 物理行 | 关注 | 新增职责前先评估提取 |
| `501-700` 物理行 | warning | PR 必须说明职责边界和后续拆分计划 |
| `> 700` 物理行 | error for new files | 新文件禁止；历史文件不得净增长 |

历史超限文件使用 ratchet：

- 不允许无说明增加净行数。
- 修改超过 700 行的文件时，优先同步减少职责或补拆分计划。
- 单次拆分保持公共导入、异常类型和返回契约兼容。
- 状态机、解析器、WebSocket 桥接器和生成代码可申请例外，但必须登记原因。

### 2.2 函数规模与复杂度

- 普通函数建议不超过 60 行。
- 超过 100 行必须拆分或登记例外。
- 新增或修改函数圈复杂度目标 `<= 12`，超过 15 阻断。
- 参数建议不超过 8 个；更多参数使用 dataclass、schema 或 options object。
- 路由函数只负责鉴权、校验、调用 service 和响应映射，建议不超过 80 行。

### 2.3 Python baseline ratchet

`backend/scripts/check_python_governance.py` 扫描 `backend/app/**/*.py`，并以
`python-governance-baseline.json` 记录历史债务的逐文件行数和逐函数复杂度 ceiling。
使用 `--base-ref` 时，门禁不仅比较 baseline ceiling，还会读取 Git base revision 的
实际 Python 指标；已存在的历史债务如果相对 base 实际指标回涨，即使仍低于旧
ceiling，也会阻断检查。

如果对应 ceiling 条目包含有效且未过期的 `exception`，它必须包含非空的
`owner`、`reason`、`expires_at`，并且回涨后的实际指标仍不得超过该条目的 ceiling。
exception 只提供有期限的受控窗口，不能绕过 ceiling；过期 exception 直接阻断检查。
首次 baseline 过渡中仅当前分支存在的债务也必须逐项登记 exception，不允许使用通配
或模块级总豁免。Owner 必须在到期前完成文件拆分、职责提取或复杂度下降，并删除
对应 exception；不得通过延长日期或提高 ceiling 代替治理。

如果 base revision 尚未包含 baseline 文件，`--base-ref` 不会静默跳过比较，而是扫描
base 源码：当前 baseline 只能记录 base 中已经达到 warning 阈值的债务，不能凭空接纳
本次变更新增的债务；确需在首次 baseline 过渡中临时承接时，必须使用上述逐项、
有期限的 exception。这允许仓库首次引入 baseline，同时阻止借首次登记掩盖新债务。

### 2.4 拆分顺序

1. 先提取纯函数、schema、序列化和兼容摘要。
2. 再提取查询、持久化、外部服务适配器。
3. 最后拆状态机和事务编排。
4. 原模块可保留 facade 和兼容 re-export，避免调用方一次性迁移。

## 三、模块边界

标准依赖方向：

```text
api/endpoints -> services -> models/db/core
tasks -> services
scripts -> public services
```

禁止事项：

- `services` 导入 endpoint。
- `core` 导入具体业务 feature。
- endpoint 内直接维护复杂 SQL、长事务或跨模块编排。
- 跨模块直接调用对方私有函数。
- 为绕过权限而直接查询用户或角色表。

允许的兼容方式：

- 原模块保留稳定 facade。
- 私有函数迁移期可短期 re-export，但应在治理台账标注移除条件。
- 跨模块能力通过公开 service 或明确 adapter 暴露。

## 四、测试与 CI 门禁

### 4.1 通用门禁

代码 PR 至少通过：

```bash
cd backend && pytest -q
cd backend && python scripts/check_python_governance.py check
cd frontend && npm test
cd frontend && npm run test:scripts
cd frontend && npm run token:check:ci
cd frontend && npm run type-check
cd frontend && npm run lint
cd frontend && npm run ui:audit:ci
cd frontend && npm run build:check
git diff --check
```

约束：

- lint error 必须为 0。
- 现有 warning 不得因当前改动净增加。
- Bundle 达到 error 阈值必须阻断；warning 进入量化治理台账。
- 认证、权限、会话、迁移、并发和数据完整性改动必须有直接回归测试。
- 结构重构至少包含公共导入、返回结构或关键行为的兼容测试。

### 4.2 专项门禁

- PythonLab、Docker sandbox、WebSocket、Redis、Celery 改动必须运行对应 smoke/soak。
- 专项 PR workflow 必须启动当前 PR 的代码和依赖，不能用远端生产环境替代。
- 浏览器交互风险必须使用真实浏览器 channel 验证，不能只调用 DOM `click()`。

### 4.3 覆盖率目标

- 变更新代码目标覆盖率 `>= 85%`。
- 认证、权限、迁移和并发关键路径目标 `>= 95%`。
- 未建立全仓可靠 baseline 前，先以 changed-lines 和关键路径测试作为门禁。

## 五、前端质量

- TypeScript 保持 `strict: true`。
- 新增 service、auth、query 和上传代码禁止使用无理由 `any` 或 `as unknown as`。
- `no-floating-promises` 和 `react-hooks/exhaustive-deps` 应优先清零。
- Query key 统一通过 `queryKeys`。
- 颜色必须来自已定义的 `--ws-*` token；未定义 token 数量必须为 0。
- 重型运行时必须延迟加载，Monaco、Typst、Graphviz、PDF、Pyodide 不进入首屏。
- 核心页面必须覆盖键盘操作、焦点恢复和 WCAG AA 对比度。

## 六、数据库迁移

1. 正式结构变更只通过 Alembic。
2. CI 必须保持单一 head，并验证空库完整升级。
3. 破坏性变更采用 expand-migrate-contract，至少跨两个发布版本。
4. 数据迁移必须幂等、可分批、可续跑并有验证查询。
5. 生产迁移应逐步改为独立 one-shot migrator，并使用数据库 advisory lock。
6. Web 容器不应长期承担自动生产迁移职责。
7. 有破坏性或长锁迁移时，发布前必须确认备份、停写窗口和回滚路径。

## 七、文档和脚本

- API、DB、部署、CI、测试和脚本入口变化必须更新权威文档。
- plans/report 必须包含 status、owner、review date 和归档条件。
- active 文档每 90 天复核，reference 每 180 天复核。
- 新增或删除脚本必须同步对应 README。
- 固定账号、固定日期、固定班级或直接写生产数据的脚本不得作为默认入口。
- 一次性脚本放外部 scratch；确需保留时必须标明用途和删除条件。

## 八、发布流程

发布必须满足：

1. 版本输入与源码版本完全一致。
2. 通用质量门禁全部通过。
3. 六个镜像先推 staging tag，全部可读取后再推广正式 tag，并校验整组 digest。
4. `latest` 默认不作为可追溯发布依据。
5. 记录镜像 digest，逐步增加 SBOM 和漏洞扫描。
6. 最近 24 小时内完成生产模拟和完整 prod-smoke。
7. 有迁移时确认备份，并定期执行恢复演练。
8. 部署后验证健康检查、登录、核心 API、关键 UI 和 worker。
9. 验证失败时停止推广并执行明确回滚。

Docker Registry 不提供跨六个独立镜像仓库的事务式原子改 tag。发布 workflow
必须在推广后生成并上传已验证的 `release-set.txt`；生产部署只接受存在完整
release-set 的版本。这样可以阻止半套版本进入部署流程，但不能把多个仓库改
tag 伪装成单一原子事务。

## 九、周期审计

| 周期 | 检查项 |
|---|---|
| 每周 | 文档断链、脚本引用、workflow 漂移 |
| 每月 | 超长文件、复杂度、lint、bundle、依赖漏洞、文档生命周期 |
| 每季度 | 数据库备份恢复、发布回滚演练 |
| 每半年 | Docker socket、Secrets、权限模型和灾难恢复 |

## 十、例外机制

例外记录必须包含：

- 规则
- 范围
- Owner
- 原因
- 补偿测试或监控
- 到期日

普通例外最长 30 天。安全、迁移和数据完整性例外需要双人复核。
紧急发布例外最长 72 小时，并在两个工作日内补测试和复盘。

## 十一、完成定义

一项工程治理任务只有同时满足以下条件才算完成：

- 行为或结构目标已实现。
- 最小可靠测试和相关全量测试通过。
- 静态检查、构建和 `git diff --check` 通过。
- owner 文档已同步。
- 没有覆盖其他未提交改动。
- 已记录剩余风险、例外和下一步。
