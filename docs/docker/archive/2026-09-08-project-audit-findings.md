# 全项目首轮问题台账（XBK 优先）

> 状态：active
> Owner：project-governance
> 最近复核：2026-09-10
> 归档条件：条目完成修复回归或由负责人明确接受；长期结论同步功能、安全、部署 owner 文档后归档。

## 2026-09-10 R5 三主线接续（整合已验，Excel 阻断，未发布）

- **XBK**：一次取消显式 rollback 修复及真实 PostgreSQL 独立复跑已核验；重复取消与 TCP 响应丢失不承诺无提交。合成导出已生成，但 Excel 原生打开设施阻断，尚未进入 grid 或检查 add-in，故 Excel 验收保持开放。自然键更名政策不在本轮更改范围。
- **AUTH**：持久权威、默认关闭 gate、严格存量证据与显式 enrollment 已完成限定修复；独立反例修正后，最终冻结源码的专属 PG/Redis 和接入回归已复跑。正常库已在停流/排空/配对备份后完成 Alembic 升级与受控 enrollment（gate 已开启）；新 AUTH 与 PythonLab 已在专属合成栈完成真实迁移、受控会话保留和双浏览器整合验收。停流/冻结/逐用户审计等发布前提保留，真实代理链与 TTL/迁移边界仍待验收。
- **PythonLab**：晚切终端丢 prompt 与双通道重复输出已修复，完成真实 Chrome/WebKit 可信 pointer、多断点、TTY 输入、代理重连与 Reset 回收；主任务核对镜像、事件及截图。最终 AUTH overlay 整合后再次完成双引擎调试、重连与回收；主任务独立核验源码/镜像、事件、gate 与专库状态。仅冻结专项组合，不扩大为全 dirty 工作区或发布通过。
- 当前数字、失败与证据只维护在 [TEST_STATUS](../testing/TEST_STATUS.md)。主任务已统一公共文档，三个 agent 分域交付并关闭；不把未验项关闭，不动正常资源或发布。

## 2026-09-10 R4 接续收尾（未发布，限定验证完成）

本节优先于下方对应历史描述；不删除红例，不把本轮独立复核误写为重新执行浏览器。动态数字、命令日志与资源核对统一见 [TEST_STATUS](../testing/TEST_STATUS.md)。

- **FE-03**：旧 R4 的真实 Chrome 保存阻塞、最终成绩页和逐请求时间线已独立核验，并在当前隔离入口核对镜像、静态字节及只读数据库最终状态。固定客观题链路收口；画像、AI 长事务、响应丢失恢复及持续压力不在此结论内。
- **AUTH**：离线复跑仍确认 cache-loss 旧 refresh 恢复的安全红例；精确 family + 锁序 + Redis CAS 候选在跨存储故障后丢失撤销依据，不能合入。认证前端已有退出失败风险提示及共享存储身份同步，本轮源码和专项回归已核实，不再列为完全未实现；真实多标签及服务端撤销仍未闭环。
- **XBK**：恢复、SQL 失败回滚重试与真实 get_db 退出清理已分层核验；保留 session 的直接调用取消反例不等于 HTTP 持久化事故。真实 PG 在途取消、Excel 实开及自然键更名政策仍开放。
- **后续优先级**：先设计 AUTH 可恢复的持久撤销依据并反证，再推进 PythonLab 真实 Chrome/WebKit/DAP/TTY 与资源恢复、XBK PG 事务和合成 Excel 验收；涉及迁移、正常资源恢复及政策取舍另行确认，不用修改断言刷绿。
- 本轮只补独立验证和文档校准，没有新产品实现、正常数据写入、镜像替换或发布；保留旧任务作为历史，不再反复读取长对话。

## 2026-09-10 R3 真实实例推进（未发布，认证开放项保留）

本节覆盖下方相应旧检查点，历史红例不删除；动态结果与最终 Chrome 状态以
[TEST_STATUS](../testing/TEST_STATUS.md) 为准。

- **公共页面元信息**：`useAppMeta` 改为读取构建配置，不再向仅超级管理员可用且不含版本的系统接口回退；未放宽后端权限。已真实构建命名前端镜像，运行来源与静态字节独立核对；不等于全站无错误。
- **首页与后台实例修复**：限定修复手机首页宽度/换行、手机侧栏高于遮罩的层级，以及普通管理员仪表盘仅请求有权访问的数据；沿用后端权限，不改登录页、全局色彩或依赖。补充默认回归入口并真实重建前端；新镜像指针、手机几何及角色刷新验收状态只见 TEST_STATUS，不以 jsdom 或构建成功代替浏览器验收。Dashboard 的相同身份静默换会话模型仍保留更强合同反例，不扩大为全站会话隔离已闭环。
- **FE-03**：既有保存/交卷修复补充真实 HTTP、PostgreSQL 确定性等待链与 Chrome 保存中点击交卷证据；限定固定客观题、合作 writer、现有隔离级别。锁顺序不是 HTTP 发起顺序保证，AI 长事务、丢响应重试和持续压力仍开放。
- **AUTH-01/02**：同 IP 替换后的 ws1 会话键精确丢失会使旧 refresh 恢复旧账号；legacy refresh 替换后换得新 access，以及 Redis 失败退出后 legacy access 恢复仍为开放反例。ACL 初始恢复断言失败已分类为测试设施问题，不能混列产品安全漏洞。具体合同见 [AUTH](../../features/AUTH.md#持久会话权威与受控切换)。
- **历史状态纠正**：Docker 引擎授权及恢复已完成，R2 最终 TCP 故障反馈及 Chrome/XBK 限定验收已有实证；下文“恢复待用户确认/离线待验”等为历史检查点，不再代表当前阻断。仍不能因此关闭认证撤销、全部 XBK 或全站验收。
- **下一步**：设计持久会话撤销与 cache-loss 恢复的一致性，再做独立反证、新后端镜像和旧/新令牌迁移预演；保留原失败，不能用改变断言或擅改 legacy/TTL 政策刷绿。正常业务库、真实名册、生产发布和重复资源清理不属于本批。

### R3 UI 新镜像限定验收补记

首页版本裁切、手机侧栏遮罩层级、普通管理员仪表盘受限请求已取得 run-03 真实镜像/Chrome 和独立 HTTP 证据；仅这些限定行为可收口。原始产品与严格错误门禁仍有失败，导航中的 SSE 取消按有时间线支持的推断单独解释，不删除原失败。当前是生产构建前端配合 development 隔离后端，不是完整生产配置验收，也没有更新正常开发入口。动态结果和交叉审查边界统一见 [TEST_STATUS](../testing/TEST_STATUS.md)。

## 2026-09-10 R2 文档契约交叉复核（未发布，最终验收未完成）

本节仅覆盖下方对应的过时结论；历史红例、原探针和失败原因保留。当前代码行为与专项报告已交叉核对，本次没有重跑业务测试；动态结果统一见 [TEST_STATUS](../testing/TEST_STATUS.md)。

| 范围 | R2 核查结论 | 仍未完成 / 不得扩大 |
|---|---|---|
| XBK-07 普通导出 | `data` 从有效名册出发，导出筛选全集，含无选课、未选和多选；无有效名册的有效选课单列 `diagnostics`，班级筛选时诊断表为空 | 两 sheet 是兼容变化；live grade 与 selections 姓名/列表年级快照差异见 [XBK](../../features/XBK.md#导出格式)，不承诺字段逐项相等；最终浏览器、Excel 实开、大名册及并发双查询快照另验 |
| XBK-02 父引用 / 删除 | 手工与导入校验有效同期间父实体；execute 与手工写入使用 SHARE 父锁，按稳定 ID 顺序等待后重验，父删除先锁父、批量冻结集合后级联 | preview 非锁定快照；限定 PostgreSQL READ COMMITTED 合作入口，无 FK；自然键更名、绕过入口、混版本及真实名册不关闭 |
| 认证初始身份存储故障 | 原最终 Docker `/api/v1/auth/me` 的 PG 故障红例仍为 `500`（预期 `503`）；R2 DNS 窄分类修复有本地 after 回归证据 | 本地/PG-ASGI 不是最终 TCP；Docker 恢复待用户确认，新镜像离线故障—恢复待验，不得写认证链路已闭环 |
| PythonLab transport / 恢复 | 专用报告保留真实 Redis broker、prefork worker SIGKILL、同 ID 重投、原锁自然到期、CLI 连接故障与容器执行/stop 回收证据 | 合成配置/故障 gate 不等于原封生产栈；retry lineage 上限不等于 task ID 全局计数，真实 broker 耗尽未证明；最终 start/ping 不是 sandbox E2E |

认证双存储、cache-loss/旧 refresh 恢复、同 IP 旧 refresh、跨标签/Cookie、代理/TTL/存量迁移继续 OPEN；XBK 自然键/其他入口与 PythonLab 混版本/旧 FAILED 恢复也不由本轮关闭。AUTH/API/TEST_STATUS 及接力由主任务整合；正常库、资源和用户待确认的策略没有扩权操作。

## 2026-09-09 认证反馈与 Docker 模拟批次（历史批次，未发布）

本节覆盖下方相关滞后描述，实测和构建状态只见 [TEST_STATUS](../testing/TEST_STATUS.md)。

- AUTH-01：退出撤销异常不再固定返回成功；严格 Redis GET 故障且无有效 refresh fallback 时也报告未完成。仍可能留下有效 access/refresh，未实现单一权威或双存储原子撤销，不能整项关闭。
- 登录 DB 提交失败提前改变 Redis 的反例已修；提交后重新获取用户锁并重验本次 refresh，被新登录/退出取代则拒绝发布。Redis 发布失败不能撤回已经提交的 refresh 替换。
- FE-04 补强：同标签 Axios 请求/refresh/退出增加身份世代门禁，旧响应不得覆盖或清理新账号；HttpOnly Cookie、跨标签和服务端失败提示仍有边界。
- 空库 bootstrap 真实启动发现索引早于 `pg_trgm` 扩展创建的阻断；本地改为复制 metadata 后在 DDL 前排除迁移索引，随后真实迁移又暴露当前学年字符串与legacy整数年份基线不兼容，仅私有副本恢复历史year/check顺序；正常空库流程已复验，动态状态以测试 owner 为准，不手工建扩展或stamp绕过。
- Docker 以合成库及生产 Dockerfile 独立构建模拟，不等于正常栈部署、生产验收或业务名册恢复。AUTH-02 同 IP 旧 refresh、代理/TTL/迁移政策及其他模块开放项继续保留。

## 2026-09-09 状态恢复后续批次（以测试状态为准，未发布）

本节覆盖下方“尚未解决”的部分历史描述，不覆盖未验边界；本批结果与失败归于 [TEST_STATUS](../testing/TEST_STATUS.md)。

- PythonLab：STARTING/结果写入改为原值 CAS；READY 发布异常按可信世代核对、确认未发布后补偿；缺失/removed journal 不再走可写 meta 接管。存储不可核对、删除失败、其他 writer、真实 worker 崩溃和跨主机仍未闭环。
- terminal/DAP：存量连接新增逐 IO/空闲会话撤销及可取消读取；管理与课堂三条 SSE 新增逐帧/空闲校验。不是原子即时踢出，不含 AI/小组 SSE 或真实浏览器/transport 最终验收。
- DAP 清理：detach 等待期间的新终止/运行状态与新租约采用原值 CAS 保护，旧连接不覆盖；不将单 writer 保护扩大为全模块事务。
- 认证：陈旧 IP binding 不误踢已迁 IP 用户，IP 绑定写失败不返回登录成功。真实 PG/Redis 仍复现 AUTH-01 单边/双边故障留下旧 access 或可用 refresh；同 IP 替换后旧 refresh 恢复和登录 DB 失败副作用仍开放，不能以此局部 CAS 修复关闭 AUTH-02。
- AUTH-02 代理/迁移/TTL 及旧 token 政策、凭据更新全会话撤销、自然键更名、选择/删除规则和名册范围未擅自决定。正常栈迁移、部署和资源清理没有扩权执行。

## 2026-09-09 风险收口进展（本批限定修复已验证，未发布）

本节优先于下方历史状态；动态结果和失败仅见 [TEST_STATUS](../testing/TEST_STATUS.md)，本地源码修复不等于生产已生效。

| 范围 | 本批修复 | 不能据此关闭 |
|---|---|---|
| 测评起测并发 | PostgreSQL config/user 事务 advisory lock、会话行锁及锁后重读；取消/提交失败实际回滚重试 | AI 长事务、历史重复、混版本、非 READ COMMITTED 与端到端重试 |
| XBK 父删除竞争 | 学生/课程 SHARE 锁和稳定顺序；写入重验；父删除冻结 ID 后级联；无效导入及时 rollback | 自然键更名政策、直接 SQL/旧写入口、真实名册及 Excel 实开 |
| 认证歧义与 optional | 唯一有效 subject 解析；退出复用 resolver；optional 复用完整 nonce/IP 验证 | raw lookup/refresh 迁移、双存储、真实代理、凭据变更撤销政策 |
| PythonLab 归属 | trusted journal、共享文件锁、generation + exact ID 条件删除与发布拒绝补偿 | 非 CAS 状态覆盖、持续发布异常遗留、removed journal 的 meta 兼容接管；不是恢复闭环 |

WS terminal/DAP 建连验证已冻结并通过独立交叉、受影响合跑及固定依赖复验：业务 IO 前校验 nonce/IP，失败关闭 4401；不改变 token 来源/优先级，不新增 Cookie fallback。检查后撤销及既有 DAP 继续转发已独立复现，仍未解决，不能写成实时踢出完成。前批 BIZ-01/02/03/04、FE-03/04、AI 历史/preview、XBK 校验/upsert/文本保真和本地 500 迁移不退回“未修”，但各自保留未验边界。下一步专项处理 PythonLab 剩余恢复、长期连接撤销与认证代理/迁移；自然键更名、全会话撤销、批量删除选择、名册恢复不代替用户决定。不得用扩大隔离测试数量取代真实浏览器和部署验收。

## 2026-09-09 用户实际 XBK 500：限定本地故障已闭环

- **XBK-RUNTIME-01 本地已恢复**：用户批准后完成正常库备份、隔离实际恢复和指定学年迁移；已解除模型字符串学年与旧库整数 year 的比较异常。不代表生产迁移、完整 XBK 验收或全项目完成。
- 前端持续失败提示和重试已修；正常库迁移后，用原登录态真实点击重试、分页和整页刷新，原请求成功、表格恢复。独立 agent 审查与实操证据分别保留；前两轮校验时区差异触发阻断，未隐瞒失败。
- 未合并 `term='1'` 与上学期，未重新导入、删除或整理名册，未以截断请求参数或返回空数据绕过问题。`content.js` 来自浏览器扩展，独立于服务端故障，未操作扩展。
- 结果、证据与覆盖边界只维护在 [TEST_STATUS](../testing/TEST_STATUS.md)；迁移操作边界见 [部署说明](../deploy/DEPLOY.md)。恢复后可继续既有开放项，不能把旧隔离通过直接当成真实基础设施通过。


## 2026-09-09 闭环反证复核（本地未发布）

本节覆盖后续历史批次的滞后状态，证据根 `/Users/wsh/.codex/artifacts/wangsh-closure-review-20260909/`；测试数字和门禁只维护在 [TEST_STATUS](../testing/TEST_STATUS.md)。对已经处理的内容重新执行边界与故障变异，不因旧测试通过自动关闭全模块。

- **AI preview 已修（owner 定稿）**：`list_user_conversations` 的 preview 按 message_type 分组取 `(created_at, id)` 倒序 rank=1，即最新时间/ID 而非字典序；用户隔离、混合 agent 与 session 级统计保留。真实供应商、生产视图和大历史性能仍未验。
- **自适应首题事务故障限定修复**：旧实现供应商/SQL异常回滚新会话并触发过期 ORM 访问，改为逐题保存点；保存点内失败保留固定题、已生成题和原占位合同，保存点前置 flush 失败则整体回滚且无部分提交。首次起测并发唯一性、占位题后续评分与 AI 长事务仍开放。
- **XBK 与 AUTH-01 反证补强**：行为保持重构、变异及边界回归已落地；XBK HTTP 旧空值只由外部测试设施种入，不能以合法输入校验放宽刷绿。AUTH-01 PG/Redis 双存储故障、AUTH-02/03 候选整合与代理链仍未闭环。
- **PythonLab 部分新故障已修，但不能关闭**：其他 session 归属读取异常/未知时保守保留；创建成功后 marker 变化可能未登记，归属查询后被接管仍可能误清，已有严格预期失败测试记录。这些是确认开放风险，不是测试通过。
- 前批 BIZ-01/02/03、FE-03 修复在受影响范围回归中保留；合成身份/API 浏览器证据不替代正常站点认证和全站视觉。
- 自然键更名、凭据变更撤销、批量选择/删除、真实名册恢复规则仍待用户确认；未提交、推送、部署或操作正常库。

## 2026-09-09 全面修复批次（历史批次，未发布）

本节优先于下方历史“未修”状态。证据根 `/Users/wsh/.codex/artifacts/wangsh-repair-batch-20260908/` 保留批次开始日期；实际整合跨至次日。动态结果、失败和门禁仅维护于 [TEST_STATUS](../testing/TEST_STATUS.md)，不把隔离验证当作全项目或生产验收。

| 条目 | 当前修复 | 未闭环边界 |
|---|---|---|
| XBK-02 / XBK-04 | 手工/导入共用字段校验；导入预检及执行检查同期间有效父实体，未选记录仍要求有效学生 | 当时尚无并发删除锁；R2 已核对合作入口 SHARE 锁修复。无 FK、自然键及真实名册边界仍保留 |
| XBK-03 | 学生冲突 upsert 内原子核验身份，冲突回滚整份文件；独立 PostgreSQL 双事务红绿验证 | 同一合法身份并发的 inserted/updated 仍按写前快照计数；更名策略未定 |
| XBK-05 | 基础及专项 XLSX 导出显式文本类型，保留原值而不是加前缀或 trim；兼容 XML fallback CR 转义 | 尚未在真实 Excel 打开；不得扩大为其他模块导出均安全 |
| BIZ-05 | 可选 agent 查询本人全部 session；混合或 NULL 身份摘要不伪装为当前 agent，列表/详情 session 聚合一致 | 旧 preview 是字典序聚合而非最新答案；真实历史数据与查询性能未验 |
| FE-01 / FE-05 | 历史代次与 user-null 隔离，旧回调失效；导入在 await 前捕获 input、finally 重置 | 浏览器为合成 API；没有新增跨 agent 全历史只读入口 |
| OPS-02 / OPS-03 | 核验容器配置/资源/归属与 plain network none；启动异常清理、CLI kill/reap 和有限瞬态重试 | STARTING/发布非 CAS、Redis 持续故障和锁续租仍有风险；真实 worker/Redis 未验 |
| OPS-04 | 静态迁移图及审核 guard 指纹，完整索引目录与一致性快照保守预检 | 未审核历史操作继续阻断；不是 public 目标库部署升级/回滚验收 |
| BIZ-01 / BIZ-02 / BIZ-03 / FE-03 | 保留前批源码修复并纳入整合回归；测评事务互斥补真实 PostgreSQL 复验 | AI 长事务、取消、并发起测、异常评分和完整认证 E2E 未闭环 |

仍待处理：AUTH-02/03 外部候选正式整合及代理/迁移验收，AUTH-01 双存储故障与并发，AUTH-04 凭据变更撤销规则；XBK-01 自然键更名拒绝或级联、批量选择/删除目标规则、真实名册恢复均须用户先确认。OPS-01 debug 网络/DAP 暴露面本批未改，不宣称安全通过。全站多尺寸视觉、重型模块生产运行、依赖扫描、故障恢复与远端验收未完成。

没有提交、推送、部署、重启正常服务、修改 Login、迁移正常库或操作真实名册。旧失败证据保留；后端范围测试、真实 PG、真实浏览器合成 API、生产构建及工程门禁各自独立，不合并为“全项目正常”。

## 2026-09-08 下一验证批次（最新状态）

本节优先于下方历史批次；“通过”须附测试层级，不代表全项目或生产验收。证据根为 `/Users/wsh/.codex/artifacts/wangsh-next-validation-20260908/`，动态数字和门禁仅见 [TEST_STATUS](../testing/TEST_STATUS.md)。本轮主任务加并行分区验证，只有公共内容隔离与测评事务互斥进入本地源码，未发布。

| 条目 | 当前结论 | 保留边界 |
|---|---|---|
| BIZ-01 | 真实通用内容路由可读他人未发布导图，已最小修复为启用且 owner_id 为空；正常个人、广场及管理端对照保留 | JWT/ASGI/SQLite 隔离验证，不是生产权限验收；不改变发布策略 |
| BIZ-02 / BIZ-03 | 前批修复在独立真实 PostgreSQL 上补验结果终态和本人个人画像类型控制 | 合成身份，不含完整认证中间件 |
| FE-03 | Chrome/WebKit 真实 pointer 指定场景通过；另复现服务端答案分数与总分不一致、重复交卷，已增加同会话事务行锁 | 以取得锁顺序为准，不保证 HTTP 顺序；AI 长事务、取消、超时响应丢失恢复仍待验 |
| XBK-01 | 更名后选课自然键未同步，合成查询出现虚拟学生/未选/新代码零统计 | 原行未物理丢失；拒绝更名还是迁移关联须先确认，未修改 |
| XBK-02 | 缺失、已删除、其他学年/学期父实体：手工拒绝而导入预检通过并落库 | SQLite 合成实际路由/服务证据；未修、未对真实名册操作 |
| XBK-03 | 串行身份冲突有拒绝；检查后受控重入可被 upsert 覆盖 | 仅同 Session 串行重入，不是 PostgreSQL 双事务，保留并发待验 |
| XBK-04 | 手工和导入的空值、NUL、超长学号等校验不一致 | 不据 SQLite 推断 PostgreSQL 接受或报错；未修 |
| XBK-05 | 所测导出把合成 `=1+1` 写为 XLSX 公式单元格；普通文本/前导零对照正常 | 未实际打开 Excel 或执行公式，不代表其他导出全覆盖；未修 |
| OPS-01 | 当前配置 plain 使用 network none，debug 未显式指定网络；隔离 debug 克隆的独立子解释器可访问唯一合成 HTTP，主解释器 hook 拒绝 | hook 非进程外网络边界；原 debug 网络/端口发布及生产可达性未知，未修，不能称总体安全通过 |

AUTH-02/03 候选仍在外部，未应用身份或迁移政策；其他未覆盖条目不因此关闭。未连接正常 PG/Redis、未进行正常认证、未调用供应商，未迁移、重启正常栈、提交、推送或部署。外部失败夹具与修正记录保留，不能将诊断断言通过误记为缺陷已修。

## 结论与使用方式

本台账收拢《检查 WangSh 项目状态》及其接续任务的首轮审查，基于本地 `main@d8c3da3` **加现有未提交修改**，不是该提交的干净版本或线上版本。
原首轮候选条目保留审计轨迹，**不再把原汇总数量或优先级分布解释成已确认 bug 数**。用户指出分析深度与定位准确性不足后，本轮按业务合同、完整调用链、正常/拒绝对照重新校准，而不是继续增加条目。
第一批确认 BIZ-02、FE-03 的限定缺陷；BIZ-03 确认条件性类型越权并从 P1 降至 P2；FE-02 从 P1 降为 P2 交互风险。第二批经真实 JWT/隔离数据库/API 对照，限定确认 AUTH-01、条件性确认 AUTH-02，确认 BIZ-04 的窗外新建缺口；FE-04 经真实应用登录和用户表验证，确认跨身份缓存残留。AUTH-04 改为 P2 策略风险：现状已验证，但凭据更新是否应踢出全部会话仍待产品明确。
未列入上述两批结论的其余条目标为“初审待复核”，保留原证据及候选优先级，**既不统一确认，也不因未重跑而统一撤回**。没有足够证据认定 P0，不等于排除所有 P0。
前两批准确性复审未修改业务源码、测试、依赖或业务数据。随后对 **FE-04 完成指定链路复验，AUTH-01 完成隔离故障回归，BIZ-04 完成开放时间窗限定修复与隔离回归**；其他台账条目仍保持原状态，未触碰业务数据或实施全项目修复。真实 PostgreSQL/Redis 与生产并发验收不在这些本地修复批次内。

- 执行入口：[审查计划](2026-09-08-project-comprehensive-audit-plan.md)。动态测试数字、门禁和资源收尾只维护 [TEST_STATUS](../testing/TEST_STATUS.md)。
- 优先级表示前提成立后的影响；证据等级、发生概率和已发生事故是不同概念。不得将合成复现表述成线上数据泄露、真实成绩错误或沙箱逃逸。
- 既有 XBK 与登录跳转改动仍保留；本轮不是重做前两轮修复。登录页没有新增业务或视觉改动。
- 独立测试仅使用合成数据。正常后端仅健康检查；未恢复名册、清空业务表、迁移 schema、提交、推送、发布镜像、部署或访问远端。
- 名单原文件在早先排查中已被外部更新；“当前工作簿仍用重复班内序号/年份递增”不是本台账结论。现有业务数据恢复仍须独立决策。

## 并行反证验证接续校准（2026-09-08，历史验证批次）

本节及本次更新的条目状态优先于上方首轮/前两批历史描述；不将“初审待复核”批量认定为缺陷，也不因验证用例通过就宣称修复。当前本地工程门禁已复跑通过，旧归档断链失败只保留为历史快照，动态结果与隔离边界见 [TEST_STATUS](../testing/TEST_STATUS.md)。

本轮只接收既有产物、补齐缺失的反证并更新台账；没有修改应用源码或业务数据。AUTH-02 外部候选仍未应用到正常目录。独立接续证据根目录为 `/Users/wsh/.codex/artifacts/wangsh-parallel-verify-20260908/resume/`，原始失败日志保留。

- OPS-01 的参数级风险已复核：debug 与 plain 命令对照支持“配置缺少明确进程外网络限制”的限定结论，不支持“生产网络已可达”。
- AUTH-03 补充隔离 ASGI/ORM 的 HTTP 500 与恢复/拒绝对照，确认未修；BIZ-02、FE-03 与条件性 BIZ-03 仍未修。FE-01、FE-05 有局部反例；BIZ-01/05 仍须专项复核。
- 当时 XBK-06 的摘要无代次保护仍未修，列表保护不能替代；XBK-07 仅修当前年级分支，仍漏无选课虚拟行（该漏行结论已由上方 R2 修复状态替代）。XBK-01～05 保留各自静态/局部证据边界，不因专项通过一概关闭。
- OPS-02 降为缺少配置检查的源码/运行状态替身证据，未验证真实模式切换；OPS-03 仅确认 eager 路径；OPS-04 仅确认索引级静态误报。独立反证详见接续 ops-review.md。
- AUTH/BIZ、FE/XBK 最终分区报告分别为接续 auth-biz/report.md、fe-xbk/report.md。XBK 旧测试日志没有运行时源码 SHA 链，本次当前静态指纹不能填补该缺口。

## 2026-09-08 优先修复批次（当前状态）

本节为后续实际修复，优先于上方只验证批次及下方历史复现描述。BIZ-02、BIZ-03、FE-03 已完成当前工作区最小修复及限定回归；不是全项目/生产验收完成。三个 agent 分别独占业务文件与新增测试，主任务交叉核对并合跑。修改前逐文件备份及红绿证据：`/Users/wsh/.codex/artifacts/wangsh-priority-fixes-20260908/`；动态结果仅见 [TEST_STATUS](../testing/TEST_STATUS.md)。

- BIZ-02：进行中结果拒绝，提交后答案/解析及合法单题反馈保留。
- BIZ-03：个人详情同时检查个人类型和本人归属，保留管理端合法访问。
- FE-03：保存/交卷同步互斥、失败草稿保留、显式重试；没有新增自动交卷。真实浏览器修复后 E2E、PG 同时事务和响应丢失后的恢复仍待验。
- AUTH-03 只制作外部兼容性候选，正常源码未应用；不能把捕获歧义异常改为认证拒绝当成被碰撞账号恢复。AUTH-02 也仍未集成。
- XBK、OPS、FE-01/05 等其他条目状态不因本批回归通过而关闭；没有名册操作、数据库迁移或部署。

## 证据定义与覆盖矩阵

|标记|含义|不能替代|
|---|---|---|
|H|独立 8009 HTTP、实际 XBK router 与 PostgreSQL，合成角色注入|真实登录、正常业务库、线上验收|
|C|独立 PostgreSQL 上受控并发交错，直接调用真实导入函数|HTTP 并发压测、发生概率估计|
|B|真实浏览器、受控 mock 响应|真实认证、真实后端全链路|
|S|当前真实函数/SQL/React 行为配合内存或依赖替身|真实 JWT、Redis、事务并发、Celery worker、浏览器端到端|
|R|当前源码调用链独立复核|部署实际可达性、利用成功或动态通过|
|A|真实 assessment router/schema/service/ORM，经 ASGI 请求及 SQLite 内存库（FK 开启）；仅合成身份注入，保留角色依赖；外部 AI/后台画像替身|JWT 验签、生产 middleware/lifespan、PostgreSQL 并发、外部 AI 或正常业务库|
|I|当前真实 AssessmentPanel/ConfirmDialog/services 隔离挂载，经浏览器 pointer 操作；assessment 请求转发本轮内存 API，受控延迟到达|正常登录与应用外壳完整 E2E、真实网络发生率、生产 PostgreSQL 同时事务|
|J|真实 login/签发及验签/认证角色依赖/router/service/ORM，经 ASGI + SQLite 内存库；仅替换 get_db，会话 cache 为内存适配，实际限流走内存 fallback；学号更新实际走管理接口|Redis 集成/TTL、PostgreSQL 行锁并发、正常业务库、生产 middleware/lifespan；时间窗夹具另有 UTC 加载适配/冻结时钟|
|E|当前 index/App/RoleGuard/Login/AuthProvider/真实用户管理表及查询服务，真实浏览器 pointer；认证/用户 HTTP 转独立临时 API，真实 JWT 与合成用户，未注入 QueryClient 数据；非目标 SSE/系统/CDN 隔离|真实账号或生产库、生产网关及完整 middleware、内嵌 AI 登录弹窗、所有身份/在途请求/跨标签页组合|

同日较早的首轮接续完成了分区报告收拢及部分探针重跑，它们是历史证据，不是本轮准确性复审重新完成的全项目验证。第一批对 BIZ-02、BIZ-03、FE-03 升级实际链路证据并补核 FE-02；第二批对 AUTH-01/02/04、BIZ-04 补 J，对 FE-04 补 E。前两批没有重新分派分区审查或重跑全量前端门禁，原替身证据保留作历史对照。后续 FE-04 修复批次已执行定向及全量前端门禁和真实应用复验，结果与警告只见 TEST_STATUS。源码指纹一致只证明没有漂移，不等于独立逻辑验证。

- **已复核确认**：触发条件和结果经实际链路验证；仍必须附适用范围及未验证边界，不代表线上发生或已修复。
- **交互风险 / 合同待确认**：保护和选择语义需要完整评估，不能直接等同误删或越权事故。
- **初审待复核**：已有线索保留，但尚未按本轮准确性标准完成业务反证和边界核验。

|模块/链路|实际审查与验证|当前结论及尚缺内容|
|---|---|---|
|XBK 学生、课程、选课、统计、导入导出|源码、既有专项回归；H/C；摘要 B；R2 代码/专项报告|XBK-07 普通导出行集合与 XBK 父删除合作入口锁已校准；其他条目按各自后续批次，不一概关闭；未完成全部异常/并发矩阵|
|XBK 原名单与登录跳转|继承同日早先只读预检、模拟身份浏览器证据|本次未重新导入真实名单或验证真实密码；数据恢复未执行|
|认证/用户管理|AUTH-01/02/04 补 J + R；FE-04 另含真实认证 HTTP|AUTH-01 本地修复及隔离回归完成，AUTH-02 条件性确认；AUTH-04 策略待确认；AUTH-03 隔离 ASGI/ORM 复现确认；Redis/PG并发待补|
|学习内容、测评与画像|BIZ-02/03 补 A + R；BIZ-04 补 J + R|BIZ-02/03 本地限定修复及隔离回归完成，BIZ-03 仍为条件性/P2，BIZ-04 窗外新建限定修复及隔离回归完成/P2；BIZ-01 初审待复核；未查业务库或调用外部 AI|
|AI 历史与前端对话|实际历史 SQL 内存验证；前端乱序 S|发现 BIZ-05、FE-01；真实 SSE、中断恢复、供应商故障待补|
|管理端、测评前端、身份缓存|FE-03 补 I + A + R；FE-02 补删除链 R；FE-04 补 E + J + R|FE-03 本地限定修复及组件回归完成；FE-04 本地修复并完成指定链路复验；FE-02 为 P2 交互风险；导入事件局部复现、完整流程待验；不等于完整角色矩阵或四档桌面验收|
|PythonLab、任务运行|Docker provider/任务/运行器调用链；启动异常函数 S|OPS-01～03；未运行越界网络探测、真实调试控制、多断点 Chrome/WebKit 或 worker 重试|
|数据库迁移与部署|迁移图/预检/启动链 R；实际预检函数配合合成 schema 集 S|OPS-04；未执行真实中间版本升级、备份恢复或生产模拟部署|
|课堂、IT Games、Typst、小组讨论等|来源分区报告有入口/权限/存储链路抽查，本轮未逐条重做|保留未验证状态；不将未发现高置信问题当作完整通过|
|全项目路由与运行基线|完成路由盘点、工作区保护、容器挂载/健康检查|路由操作盘点不等于逐端点测试；没有完整依赖漏洞扫描或全后端回归|

## 候选条目与复核状态

> **快照提示**：下表是首轮/前两批复核时的历史证据索引，多条仍标「未修复」；
> 最新结论一律以上方「2026-09-10 R5 三主线接续」及更晚批次为准，本表不单独更新。

未标注 R2 的状态保留为历史证据索引，当前结论以上方对应后续批次为准，不将旧“未修”或局部“完成”扩大到整个模块。

|ID|级别|问题|证据|状态|
|---|---|---|---|---|
|XBK-01|P1|编辑学生学号或课程代码会断开已有选课关联|R；历史 H|当前静态确认关联保护缺口；未修复；策略待确认|
|XBK-02|P1|选课导入允许不存在的学生或课程|S + R；历史 H；R2 代码复核|有效父引用校验及合作入口 SHARE 锁已修；无 FK、自然键/绕过入口与真实名册仍 OPEN|
|XBK-03|P1|身份校验与并发 upsert 之间仍可覆盖不同学生|R；历史 C|当前静态确认原子身份保护缺口；未修复；PG 并发待验|
|XBK-04|P2|手工学生接口的字段校验弱于导入|R；历史 H|当前静态确认字段校验缺口；未修复|
|XBK-05|P2|导出中的用户文本可成为公式单元格|R；历史 H|文本防护缺口仍在；未修复；公式专项本次未重跑|
|XBK-06|P2|统计摘要可被旧筛选响应覆盖|R；历史 B|**已修**：`frontend/src/pages/Xbk/index.tsx:249/300-309` 的 loadSummary 已有 `summaryRequestSeqRef` 代次保护（旧「未修复」结论已被 09-09 发布差距清单校准）|
|XBK-07|P2|导出当前表与页面列表的结果口径不一致|S + R；历史 H；R2 专项报告|名册驱动筛选全集与虚拟行已修；diagnostics 分表需消费者适配，字段差异和最终验收边界保留|
|AUTH-01|P1|access 无效或会话轮换失败时退出未完成 refresh 撤销|J + R|本地最小修复及隔离回归完成；PG/Redis 集成待验|
|AUTH-02|P1|同 IP 替换账号后旧 refresh 可恢复被踢会话|J + R|**已入工作区并已迁移正常库**：DB 持久权威 + 显式 enrollment（`session_family.py`/迁移 `20260910_0001_auth_authority`），正常库 gate 已开启；真实代理链已验收（2026-09-11），S7 转发头 peer 可信范围已治理（`AUTH_TRUSTED_PROXY_CIDRS`）；TTL/迁移边界仍待验收|
|AUTH-03|P1|显示名跨字段碰撞可阻断另一账号的认证解析|J + R|外部拒绝歧义候选未应用；身份解析根因及过渡待处理|
|AUTH-04|P2|更换登录凭据未同步撤销既有会话|J + R|策略风险；现状已验证，撤销合同待确认|
|BIZ-01|P1|通用学习内容接口可返回其他用户的未发布个人导图|S + R|初审待复核；未修复|
|BIZ-02|P1|本人进行中固定题会话的结果接口提前返回标准答案|A + R|本地最小修复及隔离回归完成；真实基础设施待验|
|BIZ-03|P2|个人画像详情缺少类型校验，数字碰撞可读取异组报告|A + J + R|条件性缺陷已本地修复及隔离回归；真实基础设施待验|
|BIZ-04|P2|直接起测未校验开放时间窗|J + R|本地限定修复及隔离回归完成；PG 时区/并发待验|
|BIZ-05|P2|历史会话省略可选 agent_id 时恒空|S + R|初审待复核；未修复|
|FE-01|P1|AI 历史请求乱序导致选中会话与消息上下文错位|S + R|抽取 handler 乱序对照确认；未修复；整页 E2E 待验|
|FE-02|P2|跨筛选批量删除目标缺少明细确认|R；历史 S|交互风险；由 P1 降级；选择合同待确认|
|FE-03|P1|单题保存仍在途时整卷先结算，迟到答案被拒绝|I + A + R；新增组件回归|本地最小修复及组件回归完成；浏览器/PG并发待验|
|FE-04|P1|会话失效后同页重认证可复用前身份业务缓存|E + J + R|本地最小修复；指定链路验证完成|
|FE-05|P2|用户导入 await 后访问失效的 currentTarget 导致重置异常|S + R|真实 React 事件局部复现；未修复；完整导入待验|
|OPS-01|P1|debug 沙箱创建命令缺少进程外网络隔离并发布 DAP|S + R|参数级条件性风险；实际网络与外层防护待验；未修复|
|OPS-02|P2|plain 复用容器未核对运行模式与新资源配置|S + R|静态复用检查缺口；仅 running 替身分支验证；实际切换待验|
|OPS-03|P2|沙箱启动异常被任务吞掉，声明的自动重试无法覆盖|S + R|限定复核确认；Celery eager 正反对照；真实 worker 待验；未修复|
|OPS-04|P2|迁移预检误判有存在性保护的索引创建|S + R|索引级静态误报确认；完整 schema 与真实迁移待验；未修复|

## 逐项证据、建议与回归

### XBK-01 · P1 · 编辑学生学号或课程代码会断开已有选课关联

- **证据 / 状态**：R；历史 H；当前静态确认关联保护缺口；未修复；策略待确认。
- **本次接续校准**：当前学生/课程更新直接修改自然键，未加入被引用键拒绝或级联改键。已有冲突 409、删除级联修正不是更名保护；原 HTTP 探针仅保留为历史，本次未写库。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/students.py:90-112`；`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/courses.py:93-117`；`/Users/wsh/wangsh/backend/app/models/xbk/selection.py:10-31`。
- **触发前提**：同一时期已经存在学生、课程及选课，管理员再修改学生 student_no 或课程 course_code。
- **预期与实际**：更新接口只改当前实体，不迁移按自然键关联的选课。合成学生改号后选课统计归零并出现“休学或其他”虚拟行；课程改代码后选课仍保留旧代码，但课程统计为空、结果课程名显示“未选”。预期同一身份的编辑应保持关联，或在明确风险提示下阻止变更。
- **影响与限制**：正常编辑可破坏名单、选课和统计的一致性；旧选课并未被物理删除，不能称作已永久丢失。
- **复核材料**：resume/xbk-probes.json：student_rename、course_rename；实际隔离 HTTP/PostgreSQL。
- **建议修复**：短期对已有引用的自然键变更作明确拒绝；长期采用稳定内部关联，或事务性级联迁移并校验新键冲突。二者需先确认行为，schema 变更须 Alembic。
- **必要回归**：有/无引用、跨时期同号、冲突回滚、软删除恢复、课程改码；编辑前后列表/统计/导出应对账。

### XBK-02 · P1 · 选课导入允许不存在的学生或课程

- **证据 / 状态（R2）**：当前代码已有有效父引用校验及合作入口 SHARE 锁；不是无 FK 就没有并发保护。preview 与 execute 保证不同，自然键/其他入口与真实名册仍 OPEN，详见上方 R2 表。
- **历史接续校准（修复前）**：当时选课 upsert 未验证有效学生/课程父记录；学生导入身份校验不覆盖选课父引用。静态与 FakeDb 对照支持当时缺口，未向真实数据库写入孤立行。以下位置、触发、红例与原建议保留历史范围，不作为当前实现描述。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/import_export.py:406-434`；`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/import_export.py:466-499`。
- **触发前提**：管理员导入选课行，学生学号或课程代码没有对应的有效父记录。
- **预期与实际**：预检把未知学生/课程行判为有效，执行直接 upsert；合成孤立行实际入库。预期预检和执行均按同一时期、软删除与跨年级规则检查父记录。
- **影响与限制**：总选课数、名册查询及按课程统计可以互相矛盾；只修页面显示不能清除源头不一致。
- **复核材料**：resume/xbk-probes.json：orphan_import，含预检、执行和统计响应。
- **建议修复**：定义父记录存在性及未选/特殊课程的明确例外，预检和提交共用规则；执行时重新验证，必要时以正式约束维护并发一致性。历史孤立记录先只读分类，不自动删除。
- **必要回归**：未知学生、未知课程、跨时期、软删除父记录、合法共享课程、跳过模式、父记录并发删除。

### XBK-03 · P1 · 身份校验与并发 upsert 之间仍可覆盖不同学生

- **证据 / 状态**：R；历史 C；当前静态确认原子身份保护缺口；未修复；PG 并发待验。
- **本次接续校准**：当前身份 SELECT 与无身份谓词的 on_conflict_do_update 仍分离；文件内/串行身份保护有效，但不证明并发原子性。早期受控数据库并发仅作历史证据，本次接续未重跑 PG 并发。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/import_export.py:406-434`；`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/import_export.py:470-499`。
- **触发前提**：两份不同姓名的导入使用同一个尚不存在的学生自然键，双方都在首次写入前完成身份检查。
- **预期与实际**：受控交错下，两方均宣称新增，最终记录只保留一方姓名。文件内重复及串行身份冲突拦截仍有效，但没有使“校验+写入”成为原子操作。
- **影响与限制**：并发导入可再次覆盖身份，新增/更新计数也可能不准确；不是随机压测或实际发生率评估。
- **复核材料**：resume/concurrency-probe.log；脚本只在独立测试数据库直接调用真实函数，屏障强制两次身份校验先完成，finally 按随机键清理。
- **建议修复**：用数据库原子条件/按身份键锁或等效机制绑定身份检查和写入；冲突应明示且整笔回滚，计数基于实际落库行为。不要仅延长预检或增加前端禁用按钮。
- **必要回归**：同键不同人、同键同人、不同键、失败回滚和锁超时；补真实并发 HTTP/事务测试，断言不覆盖身份。

### XBK-04 · P2 · 手工学生接口的字段校验弱于导入

- **证据 / 状态**：R；历史 H；当前静态确认字段校验缺口；未修复。
- **本次接续校准**：AcademicYear 约束及冲突 409 为已有局部改进；姓名、班级、学号仍无共享的非空/长度/NUL 合同。旧空字符串入库及超长 500 仅为历史探针结果，本次只核对当前源码。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/app/schemas/xbk/data.py:50-57`；`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/students.py:55-87`。
- **触发前提**：直接新增/编辑学生，提交空姓名、班级、学号或超长学号。
- **预期与实际**：合成空字符串被 200 接收入库，超长学号触发 500；预期在边界统一给出明确 4xx 校验。课程负 quota 已被 422 拦截，不列为本问题。
- **影响与限制**：产生不可用记录，且可预见的用户输入错误变成服务端异常。
- **复核材料**：resume/xbk-probes.json：manual_validation，包含负 quota 的反证。
- **建议修复**：将非空、trim、最大长度、空字符等规则沉淀为手工与导入共享合同，保留数据库最终约束及回滚。
- **必要回归**：空白/纯空格、长度上下界、前导零、空字符、新增和更新；非法输入不写库、不返回 500。

### XBK-05 · P2 · 导出中的用户文本可成为公式单元格

- **证据 / 状态**：R；历史 H；文本防护缺口仍在；未修复；公式专项本次未重跑。
- **本次接续校准**：用户姓名仍直接进入 DataFrame/openpyxl，样式函数未强制文本类型。当前专项含前导零/课程码，不含恶意公式单元格断言；旧 =1+1 类型探针未重跑，未验证 Excel 重算、外传或命令执行。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/import_export.py:549-561`；`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/import_export.py:799-802`。
- **触发前提**：导出的姓名等文本来自可写入数据，值以公式形式开头。
- **预期与实际**：合成姓名 =1+1 导出后 F3 的 data_type 为 f，而非普通文本；预期用户文本保持文本类型。
- **影响与限制**：打开工作簿时有公式解释风险；本次只检查单元格类型，没有运行 Excel 重算、外传或系统命令，不把这些未测后果写成已发生。
- **复核材料**：resume/xbk-probes.json：formula_export。
- **建议修复**：对不应为公式的导出列显式按文本写入，统一所有 XLSX 导出入口；不要破坏学号前导零。CSV 如有相关入口须独立设计转义。
- **必要回归**：以 =、+、-、@ 及控制空白开头的文本、正常数字与前导零；验证单元格类型，必要时再做受控 Excel 打开验证。

### XBK-06 · P2 · 统计摘要可被旧筛选响应覆盖

- **证据 / 状态**：R；历史 B；摘要仍无请求代次保护；未修复；列表保护不覆盖摘要。
- **本次接续校准**：当前 /Users/wsh/wangsh/frontend/src/pages/Xbk/index.tsx:285–297 的 loadSummary 成功仍无条件 setSummary，失败无条件清空。相邻 loadData 的 dataRequestSeqRef 不保护摘要；此前“摘要旧响应覆盖已修复”的汇总不成立，四档可见验收也不覆盖乱序。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/frontend/src/pages/Xbk/index.tsx:285-297`。
- **触发前提**：快速切换年级等筛选，旧筛选摘要请求慢于新请求返回。
- **预期与实际**：受控浏览器里选中高二并显示新摘要，释放迟到的高一响应后数字回退；loadSummary 无代次检查，而旁边 loadData 已有 requestSeq。预期最终摘要始终属于当前筛选。
- **影响与限制**：筛选标签与统计卡片不一致，用户可能据此误判断人数；不是数据库数据改变。
- **复核材料**：summary-race.log、xbk-summary-race-1280.png：来源任务真实浏览器 mock；接续任务独立核对源码，未重拍。
- **建议修复**：为摘要请求添加代次/取消机制，并防止旧请求错误分支清空新结果；在筛选依赖变化时一致处理 loading。
- **必要回归**：A→B 逆序、旧请求失败、关闭/卸载、连续切换；断言标签和摘要同代。

### XBK-07 · P2 · 导出当前表与页面列表的结果口径不一致

- **证据 / 状态（R2）**：当前 `data` 由有效 `XbkStudent` LEFT JOIN 有效选课，包含筛选全集及无选课虚拟行；空代码显示 `未选`。年级取 live roster，NULL/空串不回退快照；`selections` 姓名保留选课快照，`course_results` 姓名取当前名册。列表已有选课的快照年级差异仍在，不声称字段逐项相等。
- **R2 兼容与边界**：无有效学生的有效选课移到 `diagnostics`，保留快照及旧搜索；指定班级时诊断为空，有效学生但课程缺失仍留 `data`。两个 sheet 始终保留列头；只读第一 sheet 的诊断消费者须适配。专用 PG/ASGI 报告不是最终 TCP/浏览器/Excel 实开验收，完整合同见 [XBK](../../features/XBK.md#导出格式)。
- **历史接续校准（R2 前）**：当时 `import_export.py:600–668` 使用 `coalesce(有效学生.grade,选课.grade)`，只修复非空当前年级与旧快照冲突；导出仍从 `XbkSelection` 出发，漏掉名册虚拟行。以下位置、预期与实际、探针和建议均保留该历史范围，不描述 R2 当前代码。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/import_export.py:597-604`；`/Users/wsh/wangsh/backend/app/api/endpoints/xbk/import_export.py:636-704`。
- **触发前提**：学生没有选课形成页面虚拟行，或学生当前年级与选课记录中的年级快照不同。
- **预期与实际（历史红例）**：初审曾同时发现快照年级与虚拟行差异；当时仅校正非空名册年级，导出仍由选课表驱动并漏掉无选课虚拟行。后续 before/after 专项另保留真实漏行、空码和错筛证据；旧版本缺少新 `diagnostics` sheet 的合同断言不能全部包装成历史生产 bug。
- **影响与限制**：下载表缺人、与屏幕不对账；这不是仅导出分页还是全量的差别。
- **复核材料**：resume/export-parity.json；脚本 export-parity.py，实际隔离 HTTP/PostgreSQL。
- **建议修复**：抽出列表与导出共用的查询/投影规则，明确当前年级、快照年级、未选/休学语义；大导出可分批但不另造口径。
- **必要回归**：无选课、空课程代码、过期年级快照、软删除、跨时期同号、班级/搜索筛选，对比集合而不只总数。

### AUTH-01 · P1 · access 无效或会话轮换失败时退出未完成 refresh 撤销

- **证据 / 状态**：J + R；限定缺陷已完成本地最小修复与受维护隔离回归，未发布。真实 PG/Redis 与生产并发仍待专用环境验收；不据此宣称整个认证批次关闭。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/auth/auth.py` 的 `logout`；`/Users/wsh/wangsh/backend/app/services/auth.py` 的 `lock_refresh_token_owner_for_logout`；维护回归 `/Users/wsh/wangsh/backend/tests/auth/test_logout_revocation_isolated.py`。
- **原触发前提**：退出时 access 缺失、过期或损坏，但 refresh 尚有效；另一客户端已持有该 refresh 副本。本问题本身不提供窃取令牌能力。
- **修复前链路与红灯**：真实登录获得令牌→Cookie logout→新 DB session 查撤销位→保留副本 refresh→真实 `/auth/me`。旧实现清 Cookie 并返回成功，却未撤销 refresh；内存 cache 写故障又会使旧实现回滚撤销。修复前源码备份以临时 import overlay 运行最终维护回归，失败对照保留，未替换工作区源码。
- **本地修复**：当前有效 access 优先，否则使用有效 refresh Cookie；先释放无效 access 候选锁，再按用户→token 顺序锁后重验 refresh。nonce 轮换故障仍尝试 DB commit，防止单独缓存异常撤回 refresh 撤销。一个请求只处理一个证明过的身份，不忽略 JWT 过期或仅凭旧 user_id 踢新会话。长期合同只维护于 [AUTH](../../features/AUTH.md#服务端退出与撤销边界) 与 [API](../../development/API.md)。
- **正常/拒绝反证**：正常退出后旧 access/refresh 均拒绝；未知、过期、已撤销 refresh 和无凭据退出不撤销当前会话；同账号重登/refresh rotation 后的旧凭据不能踢新会话。覆盖 configured/legacy Cookie 优先级与 header 身份冲突；在读 owner 后、获取用户锁前插入 login/refresh 完成，确认必须重验旧 token。
- **故障反证**：cache 写返回 false/抛异常时，DB 成功提交后 refresh 持久撤销，但旧 access 可能仍有效；DB commit 失败时撤销未持久化，旧 access 可已失效但 refresh 仍可恢复。成功响应不等于全部服务端撤销。未修复双存储原子性、legacy 别名清理、AUTH-02/03/04 或前端 logout/relogin 竞态。
- **证据与限制**：第二批历史复现 `/tmp/wangsh-audit-auth-window-20260908/backend-results.json`；本批 `/tmp/wangsh-auth01-fix-20260908/` 含失败/成功日志、修复前备份与禁止外连运行器。具体动态结果、版本与门禁仅见 [TEST_STATUS](../testing/TEST_STATUS.md)。SQLite 确定性交错不等于 PG 锁调度，内存 cache 故障不等于真实 Redis 故障/TTL；未运行生产中间件、真实角色/CSRF 或发生率验证。
- **剩余验收**：在专用 PG/Redis 环境验证 logout/refresh/新登录锁竞争与真实存储失败；数据库提交失败下是否需更强撤销确认须另定合同，不在本地补丁中暗改成功响应。

### AUTH-02 · P1 · 同 IP 替换账号后旧 refresh 可恢复被踢会话

- **证据 / 状态**：J + R；条件性确认；外部候选未应用；代理/迁移/集成待验。
- **位置**：`/Users/wsh/wangsh/backend/app/core/session_guard.py:106-156`；`/Users/wsh/wangsh/backend/app/api/endpoints/auth/auth.py:272-311`；`/Users/wsh/wangsh/backend/app/services/auth.py:316-387`。
- **触发前提**：启用 `AUTH_USER_UNIQUE_PER_IP`，同 IP 的 B 登录替换 A，而 A 仍保留有效 refresh。测试直接指定 ASGI peer IP 并关闭信任转发头，不伪称验证了生产网关。
- **实际链路**：真实 A/B 登录后，A 的旧 access 被真实认证依赖拒绝；A 旧 refresh 仍能在真实表中消费、轮换并用当前 nonce 签新 access；新 access 通过 `/auth/me`。与此同时 B 仍能访问，IP binding 仍是 B。开启每请求同 IP 检查的同 IP 场景同样复现。
- **正常/拒绝反证**：开关关闭或不同 IP 时 A 原 access 保持有效，是允许路径而非踢出失败；同账号重登确实拒绝旧 access 和 refresh，不与本条的不同账号替换混为一谈。
- **影响与限制**：已启用的单 IP 单账号策略在串行正常流程中可被旧刷新凭据绕过。证明不依赖并发；本轮补验覆盖 A→B→A 主动登录循环、cache 缺失，以及 guard 的受控读写交错；真实 Redis/TTL、PG 并发锁序、代理可信范围和线上发生率尚未验证。
- **复核材料**：第二批 `backend-results.json` 中 AUTH02 的开关/IP/每请求校验矩阵及同账号重登对照；旧 `resume/auth-synthetic-results.json` 保留作历史线索。
- **建议修复**：使 refresh 绑定可撤销会话代次，或在替换时安全撤销被踢会话的 refresh；跨用户/IP 操作先设计事务与锁序，避免用粗暴全局撤销伤及新会话。
- **必要回归**：现有串行矩阵转正式测试，补并发登录/刷新、A→B→A、Redis 丢失、可信代理与开关兼容性。

- **设计批次新增边界**：A 从 IP1 重登 IP2 后，B 在 IP1 登录可因陈旧绑定误踢 A 新会话；IP binding 写入返回 false 时登录仍成功，下一用户登录不能据此替换先前用户；两个 guard 在任一写入前都读到无绑定时可留下两个通过守卫的 nonce。前两项由真实 auth router/JWT/合成 ORM 验证，后一项仅 guard/cache 确定性交错，不推断为并发 HTTP/PG 验收。上述为 AUTH-02 设计约束，未单独扩大为生产事故结论。
- **实施边界**：不得简单撤销 old_uid 全部 refresh；须锁后确认绑定 epoch，保护新会话。推荐持久代次、统一锁序、跨存储失败与旧格式过渡方案已写入原计划的 AUTH-02 设计检查点；未创建模型、迁移或改变策略。补验证据 `/tmp/wangsh-auth02-resume-20260908/`，动态结果只维护 TEST_STATUS。

- **隔离交付与下一步**：候选及 owner 合同在 `/Users/wsh/.codex/artifacts/wangsh-auth02-20260908/`，真实 PG 锁序/交错/超时回滚、SQLite/接口、迁移图等事实统一见 [TEST_STATUS](../testing/TEST_STATUS.md)。原缺陷链路描述仍对应正常未切换实现，不与候选绿灯混淆。先验收 refresh 续期 TTL 新合同、legacy 重新登录与完整迁移/回退、全后端/Redis/代理/PythonLab 浏览器/负载门槛，再单独批准安全切换；不能把候选补丁直接放入热重载目录。

- **边界补验（隔离，不改候选）**：确定性 TTL 与提交回滚符合候选规则，但新合同仍待批准。信任转发头时未检查 peer 可信范围，同一合成 peer 可通过不同头 IP 避开同 IP 替换；关闭信任时按 peer 替换。refresh 从不同头 IP 可轮换但不重绑，开启每请求检查后新 access 在变更 IP 被拒。均为隔离 characterization，不推断生产可利用；网关头清洗/后端直达/可信代理必须单独验收。证据包 `/Users/wsh/.codex/artifacts/wangsh-auth02-boundaries-20260908/`，运行事实只见 TEST_STATUS。

### AUTH-03 · P1 · 显示名跨字段碰撞可阻断另一账号的认证解析

- **本批候选 / 当前状态**：外部候选仅将 MultipleResultsFound 转为明确认证拒绝，不随机挑选身份，不应用正常源码。它不恢复被碰撞账号，也不完成不可变用户 ID 与旧 token 迁移；身份过渡须另行决定。候选专项还观察到原身份停用/删除/改名后，唯一跨字段匹配可在 service/optional 依赖重绑定到另一用户；强制 /me 的 nonce 拒绝不能替代其他入口的结论。refresh 仍可能换发歧义 subject。该证据仅限合成环境，不断言生产可利用。
- **历史复现证据 / 当时状态**：J + R；隔离 ASGI/ORM 复现确认；未修复；真实 PG/网关待验。
- **本次接续校准**：既有真实 JWT、管理更新路由、SQLite ORM 和 ASGI 请求已断言 HTTP 500，不再只是异常链推断；普通管理员仅修改本人显示名即可触发目标 subject 碰撞，改回恢复 200；停用/删除碰撞行及学生无修改权限为拒绝对照。没有冒充/提权证据。见接续 auth-biz/report.md；本次接续接收日志并核对 SHA，未重新执行专项。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/app/services/auth.py:120-129`；`/Users/wsh/wangsh/backend/app/api/endpoints/management/users/users.py:313-379`。
- **触发前提**：普通管理员修改自己的 full_name，使其等于另一账号 JWT subject 所用的 username/student_id；需要合法管理员权限及目标标识。
- **预期与实际**：认证使用 username/full_name/student_id 的 OR 查询再 scalar_one_or_none，产生多行异常。合成场景中目标账号记录未改，之后认证解析报 MultipleResultsFound；初审 HTTP 500 仅来自源码异常链推断；本次接收的后续隔离 ASGI 日志已明确断言 HTTP 500，仍不等于真实 socket/网关验收。
- **影响与限制**：可阻断包括超级管理员在内的受保护请求；没有证据证明冒充或提权，不得用 .first() 隐藏歧义。
- **复核材料**：resume/auth-synthetic-results.json：admin_self_name_blocks_super_admin_subject；真实更新/认证函数体加合成查询适配器。
- **建议修复**：认证后用不可变唯一用户 ID 解析 JWT subject；保留既有姓名/学号登录交互但将其与已登录身份解析分开。明确旧 token 迁移或集中失效窗口。
- **必要回归**：跨字段碰撞、同名、姓名/用户名/学号更新、不同角色、旧 token 过渡；管理员仍不得改其他管理员记录。

### AUTH-04 · P2 · 更换登录凭据未同步撤销既有会话

- **证据 / 状态**：J + R；**降为策略风险/合同待确认**，不是已确认违反产品合同的安全缺陷。当前行为已动态核验，未修复或擅自引入踢出策略。
- **位置**：`/Users/wsh/wangsh/backend/app/services/auth.py:53-74`；`/Users/wsh/wangsh/backend/app/services/auth.py:120-150`；`/Users/wsh/wangsh/backend/app/api/endpoints/management/users/users.py:358-383`；`/Users/wsh/wangsh/backend/app/services/auth.py:316-387`。
- **真实入口与对照**：真实管理员 JWT 经 `require_admin` 调用用户更新接口修改 student_id；普通学生同操作被拒。修改后旧学号登录被拒，新学号能登录，证明凭据变更本身生效，不把姓名+学号登录合同报告成漏洞。
- **纠正初审泛化**：保持非空 username 的账号，原 access 仍可用；没有 username 的账号，JWT subject 原为旧 student_id，修改后原 access 被拒。两种账号的旧 refresh 都未撤销，可换出按当前信息签发的新 access 并通过 `/auth/me`。
- **保护与政策对照**：只改 class_name 保持登录；停用用户时旧 access 和 refresh 都被拒，重新启用后未撤销令牌又可用。后者作为同一生命周期策略观察保留，不追加“停用仍可访问”的错误结论。
- **影响与限制**：若“改学号”用于收回泄露凭据，已持有 refresh 的登录端不会随之退出；但现有 AUTH owner 未承诺凭据变更必踢出全部会话。是否修改合同必须先决定，无 username 情况不能再写“旧 access 均继续接受”。未验证密码重置接口或并发。
- **复核材料**：第二批 `backend-results.json` 中 AUTH04、Display-only、Disabled/Re-enabled 对照；旧合成场景只覆盖固定 username，现已补齐缺口。
- **建议决策**：明确登录凭据、纯展示字段、停用再启用及重置凭据各自的会话生命周期，再决定原子撤销或版本绑定；仅改显示资料不宜无条件踢出。
- **必要回归**：策略确定后将有/无 username、旧新凭据、refresh、停用/启用对照固化，补并发与相关密码流程。

### BIZ-01 · P1 · 通用学习内容接口可返回其他用户的未发布个人导图

- **证据 / 状态**：S + R；初审待复核；未修复。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/learning/content.py:23-31`；`/Users/wsh/wangsh/backend/app/services/learning/content_service.py:43-58`；`/Users/wsh/wangsh/backend/app/services/learning/mindmap_service.py:72-88`。
- **触发前提**：已登录用户查询合法 module_key，另一用户在该模块创建了 enabled 的个人导图。默认 module_key 不匹配的导图不在本用例范围。
- **预期与实际**：个人导图保存 owner_id 且默认 enabled；专用公共列表有 owner_id 为空限制，但通用列表仅筛 module_key/enabled 并返回 content。预期私人内容不会经旁路查询公开。
- **影响与限制**：跨用户读取私人学习内容；本轮是内存 ORM 合成记录，未读取真实个人导图。
- **复核材料**：resume/backend-business-recheck.log：BIZ-01；真实模型/查询函数与 SQLite 内存 ORM，公共/个人专用列表为对照。
- **建议修复**：明确通用列表只返回公共内容，或传入当前身份实施公共+本人过滤；保护 admin 管理范围但不向普通接口复用无 owner 查询。
- **必要回归**：公共、本人、他人、disabled、不同模块与 section、嵌套内容；用真实隔离权限 HTTP 再验证。

### BIZ-02 · P1 · 本人进行中固定题会话的结果接口提前返回标准答案

- **本批修复 / 当前状态**：本地最小修复及隔离回归完成。结果白名单为 submitted/graded；进行中（含全部已答）和其他非结果状态返回 422；所有权/缺失 ID 原合同与单题合法反馈保留。下方描述为修改前复现，真实 PG 并发和自适应仍待验。
- **历史复现证据 / 当时状态**：A + R；已复核确认，未修复。由原结果函数替身升级为实际创建会话、查询及响应序列。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/assessment/student.py:134-147`；`/Users/wsh/wangsh/backend/app/services/assessment/session_service.py:789-839`。
- **触发前提与真实入口**：学生实际调用 `/api/v1/assessment/sessions/start` 创建自己的固定题会话，尚未作答、状态为 `in_progress`，直接请求该会话 `/result`。不需要他人会话或管理员权限。
- **预期与实际 / 根因**：正常 `/questions` 隐去答案与解析，但 `/result` 经真实 ORM 加载后返回未答固定选择题、填空题和简答题的 `correct_answer`，已有解析也返回。`_load_session` 校验所有权，却不校验答案发布时机；结果 service 没有状态/发布策略门槛，route 也没有用于过滤答案的 `response_model`。因此只保护了“谁能读”，没有保护“什么时候能读什么”。
- **反证与正常对照**：他人会话被拒绝；guest 被真实角色依赖拒绝；正常题目列表不泄露。合法单题提交后的即时反馈、重复作答拒绝、整卷提交后的结果读取仍有效，不能把这些合法反馈一并列为漏洞。
- **影响与边界**：可提前取得本人未答固定题标准答案，削弱测评有效性；不是跨用户会话泄露，也未证实全部自适应答案可读或线上已经作弊。请求使用合成身份与 SQLite，不替代 JWT/生产链路验证。
- **复核材料**：`/tmp/wangsh-audit-accuracy-20260908/backend_probe.py`、`backend-results.json`；具体请求、断言结果和隔离边界见 [TEST_STATUS](../testing/TEST_STATUS.md)。原 `resume/backend-business-recheck.log` 仅作早期证据。
- **建议修复**：定义进行中、已答未交卷、已交卷的字段发布矩阵；在 service/响应结构按状态及题目发布策略过滤，而不是一刀切删除标准答案。保留正常单题即时反馈和合法终态结果。
- **必要回归**：本人未答/部分已答/已交卷/已过期、固定/自适应、他人会话和 guest；逐字段断言公开内容，保留正常即时反馈对照。

### BIZ-03 · P2 · 个人画像详情缺少类型校验，数字碰撞可读取异组报告

- **本批修复 / 当前状态**：本地类型与归属双重校验已应用，新增真实 JWT/学生及管理路由/SQLite ORM 红绿回归，管理端合法路径保留。下方为修改前复现；本批不是生产画像生成或真实 PG 验收。
- **历史复现证据 / 当时状态**：A + R；条件性确认，P1 降至 P2，未修复。范围取决于合法组画像存在、标识碰撞及详情 ID 可请求，不当作任意画像泄露。
- **位置**：`/Users/wsh/wangsh/backend/app/api/endpoints/assessment/student.py:275-287`；`/Users/wsh/wangsh/backend/app/services/assessment/profile_service.py:436-499`、`:562-572`、`:588-605`。
- **触发前提与真实入口**：管理员经 `/api/v1/assessment/admin/profiles/generate` 生成 `group` 画像，`target_id` 恰与某非成员用户 ID 的字符串相等；该用户请求对应 `/my-profiles/{profile_id}`。本轮真实采集了合成 B 班讨论组数据并写入，只有外部 AI 内容生成替身，不再仅靠 `get_profile` 假返回证明可达。
- **预期与实际 / 根因**：生成链按 `profile_type` 选择资料并原样保存 `target_id`；详情先按画像主键加载，再仅比较 `target_id == str(current_user.id)`，没有检查 `profile_type == individual` 或组成员资格。多种对象共用一个字符串字段，数值相同被错误当成所有权相同。
- **反证与正常对照**：本人 individual 正常；他人 individual、无碰撞 group、guest 均被拒绝；学生不能调用管理员生成接口。个人列表确实只返回本人 individual，漏洞局限在详情，不能宣称列表主动展示所有组画像。
- **降级理由与未验证边界**：后端生成入口已验证，但当前前端检索仅找到 individual 生成流程，尚未确认 group 的正常 UI 生成入口；未查业务库是否存在碰撞或估计发生率。不能说“无真实入口”，也不能因后端支持就宣称线上普遍暴露。数字 class 名碰撞仅用合成存储夹具验证，不作为正常 class 生成业务的闭环证据。组报告由 AI 替身生成，不代表真实学生内容已泄露。
- **复核材料**：`/tmp/wangsh-audit-accuracy-20260908/backend_probe.py`、`backend-results.json`；具体合成请求及对照见 [TEST_STATUS](../testing/TEST_STATUS.md)。
- **建议修复**：个人详情同时约束 `profile_type == individual` 和用户所有权；group/class 另定义成员、任课教师或管理员可见规则，不沿用多态 `target_id` 的纯数字比较。无需仅为这处拒绝规则引入数据迁移。
- **必要回归**：本人/他人 individual、同数字/异数字 group、class、未知类型、guest、学生/教师/管理员；分别覆盖列表、详情及生成入口，保持管理员合法访问。

### BIZ-04 · P2 · 直接起测未校验开放时间窗

- **证据 / 状态**：J + R；本地限定修复及受维护隔离回归完成，未发布；真实 PG 时区/并发待验。
- **位置**：`/Users/wsh/wangsh/backend/app/services/assessment/session_service.py:113-140`（共享窗口判断与列表）；`/Users/wsh/wangsh/backend/app/services/assessment/session_service.py:177-222`（配置校验、复用、新建前拒绝）；真实入口 `/Users/wsh/wangsh/backend/app/api/endpoints/assessment/student.py` 的 `api_start_session`。
- **触发前提**：修复前，用户持有效学生身份、知道 config_id、配置仍 enabled 且有固定题；开放尚未来到或已经截止，且该用户没有同配置进行中会话。实际角色守卫为 `require_student_or_staff`，并非任意登录用户。
- **修复前真实链路**：`/assessment/available` 排除未来/结束配置，但 `/sessions/start` 仍创建 in_progress 会话与固定题 answer；隔离数据库已核对持久化的会话归属与答题记录。窗外空题库返回题库错误，自适应题会先触发 AI 哨兵，而不是在时间窗拒绝处停止。
- **本地修复**：列表与新建共用 timezone-aware 判断；只在未能复用本人同配置 `in_progress` 后校验，新建窗前/窗后分别 422；起止时刻包含在窗内，拒绝早于查题、AI 和会话/答案写入。禁用配置仍先拒绝，不改原有响应结构。
- **正常/拒绝反证**：窗内、无窗口、单边窗口、恰好开始/结束与起止同刻仍可起测。跨截止或窗口改到未来后，本人恢复同一 session，开始时间和已答记录不变且可继续答题；列表仍隐藏窗外配置。另一用户、另一配置及 pending/submitted/graded/archived 历史会话不能豁免窗外新建。缺失/禁用（含已有会话）、窗内空题库、anonymous/guest 的原拒绝保留。
- **影响与限制**：修复绕过开放窗的新检测创建，不等于曾发生真实成绩篡改。SQLite 存储 UTC、配置 load/refresh 恢复 aware 等价 offset，且冻结时钟保留 datetime 类型识别；不把 fixture 的时间截断算产品 bug。未运行真实 PostgreSQL 时间戳转换、DST 或并发调度；无进行中唯一约束，现有 `SKIP LOCKED` 仍不是严格幂等保证。
- **复核材料**：维护回归 `backend/tests/assessment/test_assessment_availability_isolated.py` 使用真实 JWT/router/service/ORM、独立 DB session 和 SQL/AI 哨兵；最终测试对修复前只读源码 overlay 与当前源码分别回归，数字和路径仅维护在 [TEST_STATUS](../testing/TEST_STATUS.md)。第二批 Window/BIZ04 探针与旧假 DB 探针仅保留历史轨迹。
- **后续验收**：专用 PostgreSQL 时间戳/时区/并发与真实应用入口另验；不随本批添加 schema 或改变会话续答策略。

### BIZ-05 · P2 · 历史会话省略可选 agent_id 时恒空

- **证据 / 状态**：S + R；初审待复核；未修复。
- **位置**：`/Users/wsh/wangsh/backend/app/services/agents/agent_conversations.py:22-44`。
- **触发前提**：用户存在历史，调用允许省略 agent_id 的列表入口。
- **预期与实际**：SQL 固定使用 agent_id = :agent_id，参数 None 时没有匹配结果；指定有效 agent_id 则返回本人历史。预期可选筛选省略后按约定返回全部或未指定智能体历史。
- **影响与限制**：历史记录“消失”的假象，数据本身仍在；不涉及越权查询。
- **复核材料**：resume/backend-business-recheck.log：BIZ-05；真实 SQL 与内存合成表，其他用户排除为对照。
- **建议修复**：明确省略参数的语义，动态追加等值过滤或显式 IS NULL；返回多智能体列表时同步字段合同。
- **必要回归**：None、指定智能体、无历史、其他用户、混合智能体、limit/排序。

### FE-01 · P1 · AI 历史请求乱序导致选中会话与消息上下文错位

- **证据 / 状态**：S + R；抽取 handler 乱序对照确认；未修复；整页 E2E 待验。
- **本次接续校准**：接续 FE 抽取真实 handler：先返回新会话 B 再返回旧会话 A 时，选中 B 而消息被 A 覆盖；顺序返回为正常对照。未挂载完整页面，未证明错位消息实际进入后端上下文。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/frontend/src/pages/AIAgents/index.tsx:620-641`。
- **触发前提**：快速选择 A、B 两个会话，A 历史比 B 迟返回。
- **预期与实际**：选中 ID 已设为 B，迟到 A 响应仍 setMessages，显示内容来自 A；预期选择与展示同代。
- **影响与限制**：用户可能在 B 会话继续提问却带入 A 的消息上下文；本轮没有向真实 AI 发请求。
- **复核材料**：frontend.md：FE-01 实际处理函数+deferred Promise；接续任务复核源码，未重跑专项脚本。
- **建议修复**：按用户/智能体/会话建立请求代次并取消旧读取；切换时不允许旧消息参与新请求。
- **必要回归**：A→B、智能体切换、身份切换、失败/取消/卸载和边切换边发送，验证 sessionId 与消息同源。

### FE-02 · P2 · 跨筛选批量删除目标缺少明细确认

- **证据 / 状态**：当前完整调用链 R，保留历史合成选择/载荷 S；由 P1 降为 P2 交互风险，跨筛选选择合同待确认。不是已证实误删或越权。
- **位置**：`/Users/wsh/wangsh/frontend/src/pages/Admin/Users/index.tsx:78-86`、`:282-291`、`:338-355`；`/Users/wsh/wangsh/frontend/src/pages/Admin/Users/hooks/useUsers.ts:180-194`；`/Users/wsh/wangsh/backend/app/api/endpoints/management/users/users_helpers.py:59-112`；`/Users/wsh/wangsh/backend/app/api/endpoints/management/users/policy.py:28-40`。
- **触发前提与实际链路**：选中用户后变更筛选，旧 ID 继续保留而当前表格可能不显示这些用户；批量按钮直接调用删除 handler/mutation，没有经过单行删除用的 `ConfirmDialog`。
- **纠正原判断 / 已有保护**：按钮明确显示“删除 (N)”，并非完全无提示；单行删除有姓名确认。后端要求管理员、去重 ID、核验全部目标存在且未删除、使用 `FOR UPDATE`，普通 admin 不可删除 admin/super_admin，最终是软删除。这些源码保护必须保留在风险描述中，不能把不可见选择直接称为绕过权限或不可恢复删除。
- **剩余风险与产品合同**：批量删除缺乏实际目标姓名/范围的可见确认，使用者可能误解选择范围；但跨页/跨筛选保留选择可能是有意设计，不能先验规定筛选一变就必须清空。
- **影响与边界**：本轮没有发出真实删除请求，也没有验收软删除恢复流程；不能宣称已误删、不可恢复或可一键恢复。历史合成载荷只证明选择状态保留，不证明用户意图或真实事故。
- **建议修复**：先明确当前页、跨页、跨筛选的选择规则，再展示实际数量和目标范围、提供可检查的明细及二次确认；若确定保留选择，需明确提示，若确定清空也应保持一致。后端逐对象权限不放宽。
- **必要回归**：筛选/翻页/返回/全选/刷新后的选中 ID、可见数量与确认明细一致；验证取消无请求、确认后载荷匹配、权限拒绝/缺失目标；仅在隔离合成库验证写入和恢复。

### FE-03 · P1 · 单题保存仍在途时整卷先结算，迟到答案被拒绝

- **本批修复 / 当前状态**：本地共享同步锁和失败草稿保护已应用，旧确认/同批次事件也检查；真实组件合成 API 回归通过。采用保存中拒绝并提示显式重试，不是自动排队交卷；倒计时只提示。下方为修改前真实浏览器复现，不能当作修复后浏览器验收；响应丢失后服务端已写入的恢复、跨标签页和 PG 并发仍待验。
- **历史复现证据 / 当时状态**：I + A + R；已复核确认，未修复。由两个 handler 的 deferred Promise 替身升级为当前真实组件、pointer、真实隔离 API 和结果页闭环。
- **位置**：`/Users/wsh/wangsh/frontend/src/pages/AIAgents/AssessmentPanel.tsx:363-413`、`:460-479`、`:765-773`、`:839-845`、`:1034-1042`。
- **触发前提与真实操作**：填写最后一道简答题，点击“提交检测”导致 textarea 失焦保存，在 `/answer` 尚未到达后端时确认整卷提交。真实 AssessmentPanel/ConfirmDialog/services 在本地 Vite 隔离挂载，业务请求仅转发本轮内存 API。
- **预期与实际 / 根因**：单题忙状态 `submittingRef/submittingAnswerId` 与整卷 `submitting` 分离，`handleSubmitAll` 不等待保存 Promise，确认框也未连接保存状态。受控挂起 answer 后确认仍可点击，submit 先完成结算；结果显示未作答，释放的 answer 随后被后端按终态拒绝。不是仅凭函数调用顺序推测成绩后果。
- **反证与正常对照**：进行中先保存的简答成功写库；整卷提交后拒绝继续答题是正常保护。问题是前端未保证提交顺序，不能通过移除后端终态检查“修复”。
- **影响与验证边界**：这条到达顺序可使用户已填写的内容未计入本次结算，终态也无法再用原答题接口补交；未验证恢复路径。延迟由探针人为控制，不估计真实网络发生率。SQLite 不证明 PostgreSQL 同时事务的旧状态读取或晚写覆盖；隔离组件不等同正常登录/应用外壳完整 E2E。
- **复核材料**：`/tmp/wangsh-audit-accuracy-20260908/browser-bootstrap.js`、`browser-race.json`、`fe03-pending-confirm.png`、`fe03-result.png`，及后端探针的先后到达/正常保存对照；响应与截图结果、夹具边界见 [TEST_STATUS](../testing/TEST_STATUS.md)。
- **建议修复**：统一保存队列；整卷入口先 flush 当前草稿、等待全部保存成功，再原子地锁定提交状态。保存失败需阻止交卷并保留可重试草稿；不能只加固定延时或仅依赖一次 React state disabled。保留后端终态保护，另行验证数据库并发边界。
- **必要回归**：真实 pointer 下最后一题失焦立即确认、保存延迟/失败、AI 判题慢、重复确认及超时自动交卷；分别测试到达顺序与 PostgreSQL 同时事务，断言保存内容、最终得分/未作答标记和终态不可再答。

### FE-04 · P1 · 会话失效后同页重认证可复用前身份业务缓存

- **证据 / 状态**：E + J + R；修复前限定确认，现已完成**本地最小修复及指定链路验证**，未发布。旧人工 QueryClient 值不作为最终证据；保留真实应用修复前后对照。
- **当前修复位置**：`/Users/wsh/wangsh/frontend/src/components/Auth/AuthQueryScope.tsx`；`/Users/wsh/wangsh/frontend/src/hooks/useAuth.ts` 的 logout 与 AuthProvider；`/Users/wsh/wangsh/frontend/src/index.tsx`。受维护回归：`/Users/wsh/wangsh/frontend/src/components/Auth/authQueryIsolation.test.tsx`。原 RoleGuard、Login、useUsersList 与 queryKeys 调用链保留，未改登录目的地规则。
- **收紧并纠正前提（修复前）**：同一标签页 A 超级管理员访问用户列表，随后会话失效，B 普通管理员在 React 路由内重新登录、返回同参数列表且 A 缓存仍 fresh。**不必依赖内嵌 AI 弹窗**：正常登录页软跳转链已实测，原“必须内嵌弹窗”的限制撤回；不是所有退出路径都泄漏。
- **真实触发链（修复前）**：表单登录 A → 实际用户接口填充缓存 → 仅隔离服务撤销 A → 真实搜索 users 401 / refresh 401 → auth-expired 清身份 → RoleGuard SPA 登录页 → pointer 登录 B → 实际 `/auth/me` 确认 B → 用户表仍显示 A 可见的管理员姓名/学号。整个切换未重建 document；未覆写 auth 依赖、useAuth 或 QueryClient。记录中未出现 B 的同参数列表 HTTP 交换，但旧日志在响应完成时记录，不外推为绝无在途请求。
- **后端反证（修复前后均保留）**：B 同参数直接请求列表仅返回可管理学生，读取合成其他管理员详情返回 403。修复前整页 reload 后旧管理员行消失，故定位为前端缓存跨身份残留，不是用户列表/详情服务端越权；可见按钮不能证明写操作获准。
- **已实施修复**：认证控制器留在作用域外，按用户 ID、角色、班级、学年、启用状态为业务子树创建独立 QueryClient；身份范围改变时连同 observer、placeholderData 和页面局部状态一起重建，同身份普通资料刷新保留缓存。会话失效及主动退出立即切至访客作用域，旧 scope 真正卸载后取消查询并清缓存，兼容 StrictMode effect 重放。迟到 query / 捕获旧 client 的 mutation 回调不能回填新身份 client。选择此方案而非给所有 query key 改写身份代次；仅 invalidate 或 staleTime=0 不足以保证新身份首帧无旧值。
- **修复后实际验证**：当前 index/App/正常登录页/真实用户表重走同一 A→失效→B 链。记录请求开始、隔离后端完成和向页面交付三个时点；有意持有 B 的真实列表响应，确认 B 已登录、用户页处于加载态且不显示 A 的敏感姓名/学号，释放后只显示学生。DOM 变更及 animation-frame 采样未见旧字段，哨兵和 timeOrigin 保持，未用 reload 替代隔离。B 直接接口拒绝对照与显式 reload 对照保持正确；采样证据不外推任意时序的数学证明。
- **维护回归**：真实 AuthProvider、useUsersList、QueryClient 配合服务网络 mock，先证明旧实现失败；覆盖失效后换号、直接换号、同账号重登、角色/班级/学年变化、同身份资料刷新保留缓存、退出 HTTP pending、迟到 query/mutation、`/me` 401 与 StrictMode。初始缓存通过 queryFn 填充，不以人工 setQueryData 伪造旧缺陷；迟到 mutation 测试中的 setQueryData 是被验证行为。该层不是 JWT E2E。
- **正常退出与剩余边界**：UserMenu/AdminLayout 常规退出仍有 window.location.href 重载，本批未逐项点击两种菜单。HTTP 退出与再次登录的 token 竞态、AUTH-01 后端撤销、跨标签页、尚未获知的服务端权限变更及非 QueryClient 存储未纳入修复；已发 mutation 不能靠清缓存回滚。未测全角色/跨页历史返回/内嵌 AI 登录组合、生产 PG/Redis 或四档桌面，不宣称线上已泄露或已部署修复。
- **证据入口**：修复前 `/tmp/wangsh-audit-auth-window-20260908/` 的 browser 结果及旧/刷新截图；修复后 `/tmp/wangsh-fe04-fix-20260908/` 的红绿回归及 `browser-acceptance/` 最终结果。pending/成功截图已实看；较早失败夹具保留且不计验收。动态数字、门禁与资源清理只维护 [TEST_STATUS](../testing/TEST_STATUS.md)，长期机制见 [AUTH](../../features/AUTH.md)。

### FE-05 · P2 · 用户导入 await 后访问失效的 currentTarget 导致重置异常

- **证据 / 状态**：S + R；真实 React 事件局部复现；未修复；完整导入待验。
- **本次接续校准**：精确故障位置为 /Users/wsh/wangsh/frontend/src/pages/Admin/Users/index.tsx:268–269：await 完成后访问失效的 e.currentTarget.value。局部真实 React 事件对照支持重置异常，不等于后端导入失败。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/frontend/src/pages/Admin/Users/index.tsx:265-269`。
- **触发前提**：原生文件输入触发异步上传，处理函数在 await 后重置文件控件。
- **预期与实际**：React 事件回调离开同步派发后 currentTarget 已为空，赋值抛 TypeError；预期导入后可正常清空并重选同一文件。
- **影响与限制**：导入本身可能已成功，只是输入重置失败；不能误报后端导入失败或自动重试造成重复导入。
- **复核材料**：frontend.md：FE-05 实际 React/JSDOM change 事件；接续任务只核对当前源码。
- **建议修复**：await 前捕获 input 元素，或使用已有 fileInputRef，在 finally 中安全重置，业务结果提示与控件重置分离。
- **必要回归**：成功、失败、取消/卸载、同文件重选、重复点击，无未处理异常。

### OPS-01 · P1 · debug 沙箱创建命令缺少进程外网络隔离并发布 DAP

- **证据 / 状态**：S + R；参数级条件性风险；实际网络与外层防护待验；未修复。
- **本次接续校准**：接续实际函数配模拟 Docker I/O 的 argv 对照确认 debug 未显式指定网络隔离或 host bind，plain 使用 network none 且不发布 DAP。P1 是条件性风险优先级，不是已证实暴露等级；未测实际端口、容器网络或逃逸。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/app/core/sandbox/docker.py:316-365`；`/Users/wsh/wangsh/backend/app/core/sandbox/base.py:71-115`。
- **触发前提**：使用 Docker debug provider，且没有另行施加足够的 daemon/网络/宿主防火墙策略；当前实际外层策略与可达面未验证。
- **预期与实际**：debug 命令发布 DAP 端口而不指定 host bind IP，只有 plain 分支配置 --network none；限制主要靠同一 Python 信任域的 socket 补丁。源码不体现文档约定的独立隔离网络。
- **影响与限制**：有不可信代码出网和直接访问调试入口的潜在风险；没有运行绕过代码、网络探测、真实 DAP 连接或宿主逃逸，不宣称公网已暴露。
- **复核材料**：ops-data.md：OPS-01；接续任务核对当前 Docker argv、补丁与 PYTHONLAB 文档。仅 R。
- **建议修复**：先设计后端到 DAP 的可信路径，再通过进程外 ingress/egress 规则限制沙箱；不机械改 localhost 破坏容器后端连接。保留现有 uid/cap/resource 保护。
- **必要回归**：先 mock 检查 debug/plain 启动参数；另行获批隔离网络验收调试可用、未授权端点不可达、学生及子进程受限。

### OPS-02 · P2 · plain 复用容器未核对运行模式与新资源配置

- **证据 / 状态**：S + R；静态复用检查缺口；仅 running 替身分支验证；实际切换待验。
- **本次接续校准**：独立侧审发现 debug-to-plain 与 plain-same-config 部分夹具仅 label 不同，未注入旧配置。只能确认 running=True 时 plain 早返回且不检查配置；不证明实际模式切换、内存更新或网络继承。debug 重建分支仅模拟 I/O 覆盖。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/app/core/sandbox/docker.py:251-278`。
- **触发前提**：同一用户已有运行中的 debug 或旧资源配置容器，后续请求 plain 会话或改变内存要求。
- **预期与实际**：检测容器运行后，plain 分支直接复用返回，未核查原运行模式/实际限制，也未走后续资源计算和创建参数。预期复用需验证模式、镜像与资源合同。
- **影响与限制**：可能沿用旧运行方式和内存/网络配置；具体终端表现及资源生效情况未实跑。
- **复核材料**：ops-data.md：OPS-02；接续任务独立核对早返回与后续创建路径，未启动沙箱会话。
- **建议修复**：用不可歧义标签/配置指纹判定可复用性，不匹配时先安全停止与重建；避免破坏同用户在途会话。
- **必要回归**：debug→plain、plain→debug、内存变化、同配置复用、并发开始、部分失败清理；核查实际容器配置。

### OPS-03 · P2 · 沙箱启动异常被任务吞掉，声明的自动重试无法覆盖

- **证据 / 状态**：S + R；限定复核确认；Celery eager 正反对照；真实 worker 待验；未修复。
- **本次接续校准**：接续使用真实 Celery eager 包装器与模拟状态存储：provider 异常被捕获，最终写回成功时业务 FAILED、eager SUCCESS；首次元数据写入持续失败且未落状态的对照触发包装器重试。不能推广到 STARTING 已持久化后的恢复，也未验证 worker/broker/投递/backoff。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/app/tasks/pythonlab.py:97-145`；`/Users/wsh/wangsh/backend/app/core/sandbox/docker_runtime.py:57-84`。
- **触发前提**：provider 启动发生瞬态错误，任务能成功写回 FAILED 状态。
- **预期与实际**：真实任务函数 catch Exception 后正常返回；命令超时另被包装为 RuntimeError，也不在当前 autoretry 类型列表。预期可重试错误保留分类并传播给任务重试策略。
- **影响与限制**：瞬态故障直接变为用户失败，任务层正常结束与业务失败不一致；不推广成所有 Celery 任务均无重试。
- **复核材料**：resume/ops-independent-results.json：TimeoutError/RuntimeError 均单次 provider 调用、正常返回、FAILED；去装饰器实际任务函数+假 cache/provider，不是运行中的 Celery worker。
- **建议修复**：建立可重试异常分类及幂等资源清理，再交给 Celery retry；下一次尝试须能通过状态守卫。不无差别重试全部 RuntimeError。
- **必要回归**：先失败后成功、永久失败、耗尽、已创建部分资源、状态守卫；覆盖真实 Celery 包装层与退避而不只内部协程。

### OPS-04 · P2 · 迁移预检误判有存在性保护的索引创建

- **证据 / 状态**：S + R；索引级静态误报确认；完整 schema 与真实迁移待验；未修复。
- **本次接续校准**：修正外部 AST 夹具的 AnnAssign 读取后，当前字面量 revision 图一致；合成索引存在时 evaluator 忽略实际迁移 guard，确认索引级误报。空 schema/head/中间版接受对照仅是 evaluator 分支，不是合法完整 schema 或迁移成功证明；生产 exec 加载器与实际 DDL 未验。 后续未注明接续的探针描述保留其原历史范围。
- **位置**：`/Users/wsh/wangsh/backend/scripts/check_migration_state.py:138-190`；`/Users/wsh/wangsh/backend/scripts/check_migration_state.py:284-307`；`/Users/wsh/wangsh/backend/alembic/versions/20260430_migrate_dev_schema.py:70-83`；`/Users/wsh/wangsh/backend/alembic/versions/20260210_0000_legacy_baseline_tables.py:424-429`。
- **触发前提**：数据库处于合法中间版本 20260428_agent_idx，baseline 已创建 group_name 索引，之后按当前启动链继续升级。真实数据库迁移未执行。
- **预期与实际**：预检对迁移文件做正则抓取，忽略 if not _index_exists；实际 evaluator 配合合成 schema 集返回 drift 并拒绝升级。AST 图确认 baseline 是该中间版本祖先；空 schema 和已在 head 的对照仅确认 evaluator 接受分支，不证明 schema 完整或可迁移。
- **影响与限制**：特定中间版本升级可被预检提前阻断，不等于所有部署失败；不能用空库到 head 成功排除此路径，也不能因此删除索引或直接 stamp。
- **复核材料**：resume/ops-independent-results.json：OPS-04；实际解析/评估函数+当前迁移图+合成 schema 集；生产 Compose 启动链静态核验。
- **建议修复**：为幂等迁移建立可审核的预检/结构等价合同，保留真实漂移阻断；仅限定 regex 到 upgrade 仍不能识别存在性条件。
- **必要回归**：单元覆盖合法已存在索引与真实冲突；独立数据库验证 baseline→四月父版本→head、空库→head、当前 head、版本缺失。

## 分批修复计划与决策点

以下分组不是全项目自动执行授权清单。用户已授权的优先批次完成 BIZ-02、BIZ-03、FE-03 本地限定修复；AUTH-01、BIZ-04、FE-04 保持既有本地修复，真实基础设施验收仍单列。AUTH-02 与 AUTH-03 外部候选尚未应用，不直接覆盖正常目录。

下一步补齐 BIZ-02、FE-03、BIZ-03 真实环境验收；AUTH-03 纳入认证高优先修复并先确认不可变身份与旧 token 过渡。并行复核 BIZ-01、XBK 关联与沙箱外层隔离，随后完成 AUTH-02 的代理、迁移及跨模块集成。FE-02、AUTH-04 和自然键更名等产品合同仍须确认，业务名册恢复独立审批。不得把全项目最终验收或部署视为已完成。

|批次|范围|开始前的决策/安全条件|完成判据|
|---|---|---|---|
|A 可隔离的权限/内容边界|BIZ-01～04、FE-04|确认进行中测评可公开字段和身份切换语义|隔离角色/状态/归属测试通过，不改变合法单题反馈|
|B 认证会话闭环|AUTH-01～04|确认 JWT subject 过渡、旧会话失效范围、凭据更新策略和同 IP 合同|实际 JWT+PostgreSQL+Redis+HTTP 与并发撤销验证；旧令牌迁移有方案|
|C XBK 数据一致性|XBK-01～03，随后 XBK-04～07|先稳定身份设计；短期禁改被引用自然键与长期迁移方案分开；不要顺手恢复业务名单|失败回归、并发身份保护、导入/列表/统计/导出同口径；无未说明迁移|
|D 前端核心流程|FE-01～03、FE-05、BIZ-05|确认跨筛选选择语义、草稿提交合同|真实 pointer/延迟网络流程，类型/测试/lint/build；相关页面桌面可见验收|
|E 运维与沙箱|OPS-01～04|先评估网络/运行模式兼容性；独立环境、无课堂在途活动，迁移有备份回滚|真实隔离网络/调试、worker 重试、中间版本升级与恢复演练|

OPS-01 涉及安全边界，源码已应优先评审；如实际环境缺乏外层隔离，应将该批次提升到公开使用前的阻断项，而不是等一般体验修复完成。

### 学号不重要后的稳定身份设计（仅设计）

1. 区分系统用户凭据、XBK 名册显示学号、学期参与记录和跨学期人员身份；不能把这些字段不经判断混成一个 ID。
2. 现有学生表的内部主键可作为关联改造候选，但当前按学期存行，它不是已经完成的跨学期稳定人员身份方案。先明确“人”与“参与记录”的层次，再决定复用还是迁移。
3. 外部短学号可保留为展示/溯源字段；正式映射不能依赖会变化的班级或仅姓名。初次建立映射后重导复用，不能每次随机生成新编号。
4. 没有稳定外部标识时，改名、转班、同名、跨年级短号冲突必须进入冲突确认；不能保证完全自动识别。
5. 业务名册恢复是独立动作：备份并验证可恢复 → dry-run 输出新增/更新/冲突/关联转移 → 用户确认范围 → 事务性执行 → 数量/关联/统计/导出对账 → 失败回滚。原工作簿只读，映射和修订输出另存副本。
6. 若变更持久化关联或约束，必须给出 Alembic、历史数据处理和降级/恢复方案；本轮不执行。

## 未覆盖与后续验收清单

- [ ] 实际账号、JWT 验签、Cookie/CSRF、Redis 及代理 IP 下的真实认证端到端；本轮 auth 替身不构成认证验收。
- [ ] 真正 PostgreSQL 的测评答题/提交并发、画像数据权限、AI 自适应与异常评分；没有向外部供应商请求。
- [ ] AI/SSE、群组讨论实时通知、课堂多人并发、断网重连、取消和消息顺序。
- [ ] 全部路由权限矩阵、完整后端测试、依赖安全扫描；没有做无差别全量数据库测试。
- [ ] PythonLab 多断点连续 Continue、hover 后真实 pointer click、Chrome channel/WebKit、沙箱网络、资源回收和压测。
- [ ] Typst/PDF/Monaco 等重型功能端到端和生产构建运行；未用工程门禁替代功能验收。
- [ ] 修复后四档桌面 1280×800、1440×900、1680×1050、1920×1080；移动端主要操作与无溢出。
- [ ] 中间版本迁移、真实备份恢复、故障注入及生产模拟/远端验收；本轮都未执行。
- [ ] 全 XBK 功能矩阵剩余边界：共享课程、跨期软删除/恢复、事务失败、导出文本类型与 Excel 受控打开。

## 证据保全与可恢复性

- FE-04 修复证据：`/tmp/wangsh-fe04-fix-20260908/`；维护回归已放入认证组件测试目录，临时浏览器/隔离服务脚本只留 scratch。
- 前两批准确性复审证据：`/tmp/wangsh-audit-accuracy-20260908/`；依赖、pycache、脚本、JSON、截图均留 scratch，不新增仓库测试入口。
- 初审临时根目录：`/tmp/wangsh-project-audit-20260908/`；本台账中的 `resume/` 指该根目录下的较早接续复验。
- 来源报告：`auth-security.md`、`backend-business.md`、`frontend.md`、`ops-data.md`。这些是证据附件，不另立为当前问题 owner。
- 可复跑脚本：根目录的 `xbk-probes.py`、`export-parity.py`、`backend-business-repro.py`；`resume/auth_synthetic_checks.py`、`resume/ops-independent-checks.py`。XBK 脚本必须先核验独立测试服务，不可改向正常 8000。
- 受控并发脚本：`/tmp/wangsh-xbk-audit-20260908/concurrency_probe.py`；只能在已核验的独立测试数据库运行。它调用真实函数但不是并发 HTTP。
- 初审前端五项专项通过来源任务 stdin 执行，保留报告输出而非独立脚本；FE-03 本轮另保留 scratch 浏览器脚本与网络记录。它们都不是已入库的受维护回归，后续修复需补正式测试。
- 所有日志均为局部证据；临时目录可能被系统清理，不保证长期保留。本台账保留触发条件、结果、源码位置和证据局限，后续要提交附件时先脱敏。
- 复验过程中的工具/夹具错误保留在 `resume/*error.log`，不混入项目 bug：并发脚本首次缺 PYTHONPATH；新增 AST 图读取器初版漏读带类型注解的 revision、随后误用简写 baseline revision，均已修正并运行成功。它们不是应用多 head 或业务故障。
- 早先批次的资源状态、工作区 hash 对比和文档合同失败作为历史保留在 TEST_STATUS；本次接续文档门禁已通过，但不把局部门禁推广为完整功能与发布验收。不要复用本台账的临时端口假设直接写入。
