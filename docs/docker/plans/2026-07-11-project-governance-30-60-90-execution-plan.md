# WangSh 30/60/90 天工程治理计划

> 状态：active
> Owner：project-governance
> 最近复核：2026-07-13
> 归档条件：90 天退出标准完成，或由下一版治理计划替代

本计划只维护发布收口后的长期改进，不重复 Commit 6-8、PR、Docker Hub、release-set、
数据库发布演练等当前动作。当前发布顺序见
[项目收口计划](2026-07-12-project-consolidation-and-release-plan.md)，实时测试事实见
[TEST_STATUS.md](../testing/TEST_STATUS.md)。

## 原则

1. 先完成当前发布闭环，再启动长期重构。
2. 每次只治理一个 owner 区域，保留公共入口和返回合同。
3. Python 拆分使用“测试 -> 提取 -> facade -> 回归”，不机械按行数切文件。
4. warning、bundle 和复杂度使用 baseline ratchet，只降不升。
5. 数据库结构通过 Alembic，生产升级必须包含备份、恢复和回滚证据。
6. 自动检查先报告后阻断，稳定后再升级为硬门禁。

## 前置条件

- Commit 6-8 已完成并从最终 HEAD 重跑本地门禁。
- 真实 GitHub PR runner 通过。
- 六镜像 release-set、生产数据库备份恢复和回滚演练完成。
- 当前收口计划、manifest 和发布证据已归档。

## 0-30 天：代码和质量收敛

### 1. 拆分高风险 Python owner

先重新运行 Python governance，按“超长 + 高复杂度 + 高频改动 + 测试覆盖”排序。优先候选：

- AI analysis endpoint：路由只保留参数、鉴权和响应映射，兼容逻辑进入 service。
- Assessment session service：拆分会话生命周期、作答持久化、评分和统计查询。
- XBK import/export：拆分解析、校验、事务写入、导出和错误报告。

验收：

- facade 公共 import 和 API 路径不变。
- 目标文件低于当前 warning 线，新增函数不超过复杂度门禁。
- 对应专项、后端全量和 OpenAPI smoke 通过。
- API/功能 owner 文档同步。

```bash
cd backend
venv/bin/python scripts/check_python_governance.py check
venv/bin/pytest -q
```

### 2. 偿还直接 warning

- 优先处理本轮新增或触达文件的 lint warning，不做全仓无差别格式化。
- 清理已到期的 Python governance baseline 条目。
- 把 Pydantic/SQLAlchemy 弃用 warning 按 owner 建立小批次。
- 禁止通过提高阈值或新增 blanket ignore 掩盖问题。

验收：

- ESLint 保持 `0 errors`，warning 不高于开始基线。
- Python governance `0 errors`，warning 数量下降。
- `git diff --check` 通过。

### 3. 前端 bundle 与静态资产来源

- 建立 `frontend/public/pyodide`、mindmap demo 和其他大资产的来源、版本和重建说明。
- 继续保持 Monaco、Pyodide、ECharts、Graphviz、Typst、PDF、Xterm 懒加载。
- 从体积最大的动态 chunk 开始，避免为了“分包”把共享 helper 拉回首屏。
- bundle warning 先形成 owner 和预算，再逐步降低。

验收：

```bash
cd frontend
npm run test:scripts
npm run type-check
npm run build:check
```

- fresh clone 能重建或获得必要静态资产。
- Entry、Deferred、Worker、Pyodide 分类没有漏算。
- Total JS 和首屏体积不高于开始基线。

### 4. 文档与测试自动审计

- 将 Markdown 相对链接、重要索引、生命周期元信息和脚本 README 同步检查加入只读 CI。
- `TEST_STATUS.md` 保持唯一动态测试状态入口。
- 自动检查只输出问题，不自动移动或删除文档。

验收：

- 项目自有 Markdown 0 断链。
- plans/report/archive 均有状态和 owner。
- 新增/删除脚本时对应 README 或 archive index 同步。

## 31-60 天：架构和交付能力

### 5. 角色、路由与无障碍集成矩阵

- 覆盖 super_admin/admin/teacher/student/guest 的默认落点、菜单、深链和拒绝路径。
- 对登录、用户管理、课堂互动、内容编辑和 PythonLab 做键盘/焦点回归。
- 自动扫描稳定后再升级为 PR 门禁，人工屏幕阅读器抽查继续保留。

验收：

- 角色矩阵无越权和错误跳转。
- 核心流程无键盘阻断。
- Dialog/Sheet 焦点进入和返回正确。

### 6. 独立 one-shot migrator

- 把生产 migration 从 application startup 解耦为显式、一次性、可观察的执行单元。
- migrator 运行前检查单一 head、备份状态和目标数据库版本。
- 应用容器只验证 schema 状态，不隐式修改结构。

验收：

- 空库、legacy baseline 和生产副本三种路径通过。
- migration 失败不会启动新应用版本。
- downgrade/恢复边界有书面说明和演练证据。

### 7. 依赖方向和复杂度门禁

- 为 `api -> services -> models/core` 建立可解释的依赖方向检查。
- 先报告循环和越层 import，清理稳定后再阻断新增违规。
- 复杂度门禁继续使用按 base revision 防放宽。

验收：

- 新代码不新增循环依赖。
- API 路由不直接承载复杂事务和跨模块业务编排。
- owner 边界在 `ENGINEERING_GOVERNANCE.md` 中可查。

### 8. 供应链证据

- 为六个发布镜像生成 SBOM、digest 和来源信息。
- 依赖与基础镜像扫描结果随 release-set 保存。
- 高危漏洞必须有修复、接受或回滚决定。

验收：

- release-set 可关联 Git commit、镜像 digest、SBOM 和扫描结果。
- 正式 tag 不依赖可变 `latest`。

## 61-90 天：稳定发布与运行隔离

### 9. 发布前 24 小时硬门禁

- 从候选 HEAD 运行完整后端、前端、脚本、Compose、migration 和生产模拟。
- 真实 PR runner 与 staging 镜像 digest 必须与最终 release-set 一致。
- 发布窗口前完成数据库备份恢复、镜像回滚和服务健康演练。

退出条件：

- 所有硬门禁通过。
- 证据无 token、Cookie、密码或 API key。
- 回滚目标、负责人和命令明确。

### 10. Docker socket 隔离

- 盘点 backend、worker、PythonLab 对 Docker socket 的真实调用。
- 优先拆出最小权限 sandbox controller，限制可见 namespace、镜像和操作。
- 不在没有恢复路径时一次性替换生产控制面。

验收：

- Web API 容器不再拥有超出职责的 Docker 权限。
- sandbox 创建、查询、停止和清理仍通过 owner/concurrency/Phase C 验证。
- 失败时不会清理其他环境的容器或 workspace。

### 11. 可观测与恢复手册

- 为 API、Celery、Redis、PostgreSQL、PythonLab session 和发布任务定义最小健康指标。
- 建立告警分级、值班处置、备份恢复和故障后复盘模板。
- 每季度至少演练一次恢复，不把“脚本存在”等同于“恢复可用”。

验收：

- 核心服务异常可定位到 owner。
- 恢复时间和数据恢复点有实际演练记录。
- 事故结论进入长期 owner，日期型报告转 archive。

## 多 Agent 编排

可并行但写入范围必须分离：

- Backend：Python owner 拆分、依赖方向、migration。
- Frontend：bundle、路由矩阵、无障碍。
- Release：CI、SBOM、release-set、恢复演练。
- Docs/QA：测试状态、链接、生命周期和证据审计。

主 agent 负责冻结范围、整合冲突、运行最终门禁和更新 owner 文档；并行 agent 不同时
修改同一索引或计划文件。

## 阶段退出标准

### 30 天

- 当前发布闭环完成。
- 三个高风险 Python owner 至少完成一批拆分。
- lint/Python warning 和 bundle 不高于起始基线。
- 静态资产来源与文档自动审计可重复。

### 60 天

- 角色/路由/无障碍矩阵稳定。
- one-shot migrator 可在隔离环境执行。
- 依赖方向和复杂度新增违规受控。
- release-set 具备 SBOM 和扫描证据。

### 90 天

- 发布前 24 小时硬门禁和恢复演练制度化。
- Docker socket 隔离第一阶段落地。
- 可观测、恢复和事故归档流程可执行。
