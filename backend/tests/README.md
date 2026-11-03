# 后端测试说明

`backend/tests/` 只放测试用例本体。专项 smoke/soak 脚本不放这里，统一收敛到 [`../scripts/README.md`](../scripts/README.md) 和 [`../../scripts/README.md`](../../scripts/README.md)。

所有测试选择均须先核验隔离环境；本目录没有自动保护全部旧用例的默认入口。实际源码、命令、红绿结果、跳过项和证据位置统一记录在 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)，不把历史成功当作当前验证。

## 保存端点软校验的自含离线回归

`ai_agents/test_agent_endpoint_warning.py` 使用 stdlib unittest，导入目标源码前安装文件/导入/
网络审计守卫，以合成 settings、DB、日志替身执行真实 create/update 与异步 guard；不加载正常
app、Settings、conftest 或 pytest 插件。这仅是该专项入口，不能推广到其他用例：

```bash
env -i PATH=/usr/bin:/bin PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 venv/bin/python -I -B -S tests/ai_agents/test_agent_endpoint_warning.py -q
```

命令在 `backend/` 执行；它不验证真实 SQLAlchemy 事务、实际 Loguru sink、数据库或 API 启动。
CI 的 `repo-config` 独立执行这19项；`backend-pytest` 仅排除该自含模块，避免普通 app 导入与
其隔离守卫冲突，其余 pytest 与 coverage 保留。workflow 合同同时约束独立步骤和该精确排除项，
不能只排除而不执行自含入口。

## 运行前提

1. 在 app 导入及 pytest collection **之前**清理继承环境、禁用 dotenv/secrets，注入合成 settings；运行器须阻断 `.env*` 读取并强制 `_env_file=None`、`_secrets_dir=None`。
2. 无网络分支从导入期阻断 socket/DNS，DB/cache 用隔离内存、临时文件或替身；专用 PG/Redis 分支限定目标白名单及写域，不挂业务卷。fixture 启动后禁网不能保护导入期。
3. 禁止加载正常 conftest 和自动插件：`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`、`--noconftest`、`-p no:cacheprovider`，只选择已审查用例。上述参数、opt-in 标志或 `TEST_DATABASE_URL` **单独都不构成隔离**。
4. 专用数据库先核对真实目标；部分旧 auth/classroom 用例直连 `settings.DATABASE_URL`（见下文），不能靠 `TEST_DATABASE_URL` 改写。无专用环境时显式排除并阻断外连，跳过不算通过。
5. 使用对应批次已核验运行器；日期型外部路径仅是历史证据，不保证仍可执行。专用 PG 与无网络结果分列；保留依赖/夹具失败、风险反例和 xfail，不删断言刷绿。

`core/test_config_optional_scoring_agent.py` 独立加载配置字段，验证评分智能体 ID 的空值、环境变量和正整数约束；虽不导入全局 Settings，仍须上述 collection 保护。

## KNN 采集隔离回归

`it/test_knn_collection_isolated.py` 使用 unittest、真实 PostgreSQL 事务和 HTTPX ASGITransport，覆盖学号规范化、严格字段与时间窗、并发防重和幂等、重填授权及历史版本、取消回滚、名单变更原子性、CSV 和冻结匿名数据。功能与迁移合同见 [KNN_SURVEY](../../docs/features/KNN_SURVEY.md)。

除共同前提外，须使用专用 PostgreSQL 的 `network=none` 命名空间，无业务卷、宿主端口或 Docker socket；只允许 `127.0.0.1:5432/knn_collection_test`，逐例建/清 schema。`KNN_ISOLATED_TEST=1` 仅为附加守卫，不在普通 shell 或正常开发容器直跑。

增量 migration 执行 upgrade/downgrade/upgrade，前置仅合成 `sys_users`，不加载正常 Alembic `env.py`。合成身份配合真实 staff/归属守卫，不证明完整历史迁移链、真实 JWT、浏览器或部署。

## 风险收口专项的隔离要求（2026-09-09）

- `xbk/test_xbk_import_cancellation_pg.py` 是专用 PostgreSQL/asyncpg opt-in：每例独立 schema，覆盖父行锁、INSERT/deferred COMMIT 在途取消、SQL 失败回滚、同 session 重试、真实 get_db 退出及重复取消边界。遵守共同隔离前提；`TEST_DATABASE_URL` 必须显式指向含独立 test/testing/ci 段的专用库。真实 TCP 分支需额外设置本批分配的 `R5_XBK_HTTP_PORT`，不能借用正常服务端口。TCP 断连与显式服务端取消分别验收，不能由断连推断事务已撤销。

- `xbk/test_xbk_parent_delete_concurrency_pg.py` 使用显式专用 PostgreSQL `TEST_DATABASE_URL`，核验真实双事务锁等待、父删除/写入顺序、冻结集合、回滚及跨批次顺序；不能指向正常库，缺少专用环境应安全跳过。按文件记录结果和排除项，不以模块总数代替。
- `xbk/test_export_list_row_parity_isolated.py` 核对普通导出的筛选全集、无选课/未选、多选、live grade、姓名快照及 `data` / `diagnostics` 边界；默认 SQLite/内存分支不证明 PostgreSQL。专用 PG/ASGI 分页与工作簿回读是独立证据，admin 依赖注入不验认证，也不等于最终镜像的 TCP/Chrome 下载或 Excel 实开。
- `auth/test_subject_ambiguity_isolated.py` 与 `auth/test_optional_session_isolated.py` 使用合成 JWT、SQLite ORM 和真实认证路由；原始 lookup/refresh 的已知边界刻画不等于修复通过。不直接用未审查的全 auth 目录访问本机 settings 数据库。
- `pythonlab/test_ws_session_auth_isolated.py` 使用真实 JWT/SQLite ORM/ASGI WS 验证接入 nonce/IP 和错误码；兼容 WS 用例需合成会话及隔离 backend IO。不得以 dummy token 的 raw 用户替身绕过新认证，不访问真实 DAP/Docker；已建连接即时撤销另验。
- `pythonlab/test_sandbox_ownership_closure.py` 和 `test_sandbox_start_recovery.py` 检查真实 provider/task 配合 fake Docker/Redis 的调度反例；文件锁多进程实测不代替真实多 worker 部署及资源回收验收。
- 整合运行器记录源码 SHA，必要纯 Python 依赖只读挂载；其他隔离与结果记录遵守共同前提。

## AUTH 持久权威专项

`auth/test_durable_session_authority_isolated.py` 遵守共同前提，`R5_AUTH_ISOLATED=1` 仅为 opt-in。

历史外部入口为 `/Users/wsh/.codex/artifacts/wangsh-r5-parallel-20260910/auth/run_tests.py`；默认合成 SQLite 且禁止外部连接，`--pg` 仅允许该批专属 PG/Redis 回环端口，每例独立 schema。它在隔离 schema 调用实际 incremental migration 与受控 enrollment，不加载正常迁移 `env.py` 或真实业务库。PG/Redis 故障、显式 ready gate、存量证据切换与回滚需分别看实际用例和 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)，不能用 SQLite 或 ready 修正前的绿例冒充最终 PG 结果。

同目录历史 `run_regression.py` 选择旧 auth 文件和合成存储。维护时保留旧反例与 DB-first 合同，不把撤销失败改成成功；这些运行器不是正式运维切换脚本。

## XBK 导入恢复与取消事务专项

`xbk/test_r4_import_restore_transaction.py` 在 `R4_XBK_OFFLINE!=1` 时整模块跳过。遵守共同前提，另禁子进程并限定 `R4_XBK_ARTIFACTS` 写域；opt-in 不授权普通业务环境执行。

历史入口为 `/Users/wsh/.codex/artifacts/wangsh-r4-resume-20260910/xbk/run_isolated.py`，支持 `matrix`、`controls`、`red` 和 `lifecycle`。SQLite 实际事务配合异步 facade / AsyncSession 同步驱动封装，使用确定性 await 点的 Task.cancel；`lifecycle` 验证真实 get_db 退出，`red` 刻意保留调用方 session 并要求函数自行 rollback。红例必须单列，不能当作正常 HTTP 数据损坏；不覆盖 asyncpg 或 PostgreSQL 网络/锁取消。结果与解释器边界见 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)。

## 状态恢复与长期连接专项（2026-09-09）

- `auth/test_session_guard_ip_binding_isolated.py` 用隔离原子接口替身保护陈旧绑定、TTL、冲突与 fail-closed 合同；真实 Redis WATCH/ACL/并发和真实 PG 登录、退出、refresh 的故障矩阵由专用外部运行器执行。必须区分“风险成功复现”和“安全断言通过”。
- `pythonlab/test_sandbox_state_recovery_atomic.py` 是显式 opt-in 专项；没有外部专用 harness 则跳过，不自动创建资源。真实 Redis/Docker 必须限制唯一 UNIX socket、唯一 label、完整 exact-ID manifest、无网络业务卷，精确清理。Celery eager 不代表真实多 worker。
- `pythonlab/test_ws_revocation_isolated.py` 验证真实 ASGI/JWT/退出路由和连接取消，transport 用替身；专用 Redis 分支未配置时跳过。它不能替代浏览器真实 pointer、Continue 或真实 DAP/TTY 验收。
- `pythonlab/test_ws_cleanup_atomic_isolated.py` 用真实专用 Redis 与 ASGI 验证 detach 等待期间状态/租约更换、过期及原子错误；缺专用运行器应跳过，不访问正常缓存。单独保留旧字节失败与作者/独立复验，不能用仅模拟 EVAL 的测试冒充真 Redis。
- `auth/test_sse_asgi_lifecycle_isolated.py` 在实际三条路由、入场依赖和 StreamingResponse 上驱动 ASGI receive/send，覆盖退出和客户端断连；是 SQLite/合成 cache/pubsub 环境，不是 TCP 浏览器 SSE。逐层证据见 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)。

## PythonLab transport 与最终 sandbox 验收分层

- `pythonlab/test_sandbox_worker_recovery.py` 是隔离分类/任务分支回归，覆盖可信 Docker CLI 连接错误、权限/非法资源拒绝、provider 暂时错误及重试耗尽；不能把所有 `RuntimeError` / HTTP transport 错误当作可重试，也不能以单测代替真实 broker。
- 专用报告另保留真实 Redis broker、prefork worker SIGKILL、同 ID 重投、原锁自然到期、真实 CLI 连接故障以及容器复用/执行/stop 回收证据。该专项有合成 settings/cache、故障 gate 和可见性配置，不是原封生产栈；每条 retry lineage 的上限不是同 task ID 的全局重试计数，真实 broker 耗尽仍未证明。
- 最终 Docker 的 worker start/ping 不等于最终 sandbox E2E。Chrome/WebKit、多断点 Continue、DAP/TTY、混版本及旧 FAILED 状态恢复仍需单列，不能将专项证据记为最终 E2E 通过，也不能笼统退回“真实 worker 完全未测”。分层结果与运行器只见 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)。

## 当前结构

```text
tests/
├── ai_agents/         # AI 智能体接口、凭证、流式与兼容性
├── ai_partner/        # AI伙伴评分与榜单接口
├── articles/          # 文章与分类相关行为
├── assessment/        # 测评配置、会话、画像、课堂联动
├── auth/              # 登录、登出、刷新、nonce
├── classroom/         # 课堂计划与课堂域服务
├── content/           # 学习内容、章节和内容访问边界
├── core/              # 核心依赖、限流、缓存、会话守卫
├── group_discussion/  # 小组讨论访问控制、成员切换、消息流
├── informatics/       # Typst 笔记与 PDF 渲染
├── it/                # IT 游戏资源、KNN 采集及隔离合同
├── learning/          # 章节学习进度
├── pythonlab/         # 沙箱、WebSocket、流程图、DAP 和资源限制
├── system/            # feature flags、metrics、迁移、bootstrap、生产 smoke 和治理合同
├── users/             # 用户 CRUD 与导入
├── xbk/               # 校本课程结构、导入导出规则
├── xxjs/              # 点名相关测试
├── test_conversations_view_contract.py  # 会话视图合同
├── test_health.py     # 全局健康检查
├── test_learning_content_visibility_isolated.py  # 学习内容可见性隔离回归
├── test_migration_preflight_guard_contract.py    # 迁移前置守卫合同
└── test_pubsub.py     # pubsub 核心行为
```

## XBK 整数学年运行库迁移回归

`xbk/test_xbk_academic_year_live_schema.py` 合成旧整数 schema 与两种 term，执行真实 Alembic upgrade/downgrade 和 XBK router。默认跳过；共同隔离前提外，须使用 network-none 专用运行器及 `xbk_migration_rehearsal_test` 库。skip 不算迁移通过，专项不替代正常库备份恢复或完整历史迁移链。

## 内容权限与测评写入隔离回归

- `test_learning_content_visibility_isolated.py`：真实 JWT、路由、服务和 SQLite ORM 验证通用学习内容排除个人导图，并保留公共、个人和管理端正常/拒绝对照。不是 PostgreSQL 或完整认证端到端测试。
- `assessment/test_assessment_session_concurrency_pg.py`：必须显式设置专用 `TEST_DATABASE_URL`，限定 `postgresql+asyncpg` 且库名包含独立 `test/testing/ci` 段；未设置则跳过，不回退到正常配置。各用例创建并清理唯一合成 schema，真实事务与锁等待验证首次并发起测、已有会话被锁时复用、起测取消/延迟约束最终提交失败后的回滚重试、不同学生/配置互不阻塞，以及保存/交卷交错、重复写入、回滚重试、不同会话和缓存状态；同时验证结果与画像权限。需要该测试库的 CREATE SCHEMA 权限。禁止设置为正常业务库。
- 遵守共同前提；PG runner 仅允许本批专用库，不挂 Docker socket。

## 常用命令

先满足[运行前提](#运行前提)，再按对应批次运行器选择文件；不提供普通 shell 的全量或整个 auth 直跑命令。以下路径以 `backend/` 为根；`--deselect` 的 nodeid 须与所选 rootdir 一致，先在同一隔离环境 collect 核对。

| 隔离运行器中的测试选择 | 用途 |
|---|---|
| `tests/auth/test_logout_revocation_isolated.py`、`tests/auth/test_auth_logout_refresh.py` | SQLite/合成缓存的认证退出合同 |
| `tests/auth/test_auth_storage_unavailable.py` | 真实 JWT/ASGI 身份依赖加数据库异常注入；无网络，不是真 PG 故障 |
| `tests/xbk`、`tests/group_discussion` 或已审查的单文件 | 仍需按用例选择安全适配与资源白名单，不能推定整个模块安全 |

真实 PostgreSQL 集成用例只允许在明确的一次性专用测试库运行；实现安全检查的用例要求数据库名包含 `test`、`testing` 或 `ci`，并可使用 `TEST_DATABASE_URL`。**这不是整个测试目录的统一防护，不能假定所有旧测试会自动跳过业务库。**

已确认 `auth/test_refresh_token_relogin_revoke.py` 的 `test_revoke_all_user_refresh_tokens_revokes_existing_tokens`，以及 `auth/test_refresh_token_rotation.py` 的 `test_concurrent_refresh_rotation_allows_only_one_consumer`、`test_concurrent_login_refresh_issue_leaves_only_one_active_token`、`test_refresh_waits_for_login_user_lock_and_rechecks_revocation`、`test_refresh_waits_for_logout_user_lock_and_rechecks_revocation` 直接使用 `settings.DATABASE_URL`。仅设置 `TEST_DATABASE_URL` 不会改写它们的连接目标；未经专用环境确认，不得直接运行全量/整个 auth 目录。本地只需认证回归时，优先选用下面的隔离入口；扩展运行须显式 `--deselect` 这些用例并在运行器阻断外连，不以修改旧断言刷绿。

## 认证存储故障的证据层级

- `auth/test_auth_storage_unavailable.py` 通过异常注入区分身份存储故障与编程/SQL 合同错误，保护应报告 `503` 的窄分类；它不是 PostgreSQL 进程、DNS 或 Docker 离线的实测。
- 外部 PG/ASGI 运行器使用专用 PG/Redis，真实拒绝新连接，再经 HTTPX `ASGITransport` 驱动身份请求；SSE admission probe 仅验证入场依赖，不覆盖完整流或 TCP。
- 新 freeze 镜像必须另经真实 TCP 的故障—恢复与保留凭据验证。局部 ASGI/本地 DNS 分类回归不能覆盖最终 Docker 的 `500`（预期 `503`）历史红例；未取得新实例证据前不得写已闭环。Docker 恢复须获授权，不为了验收操作正常服务。结果与未测项仅见 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)。

## 认证退出隔离回归

开发依赖见 `backend/requirements-dev.txt`（含 `aiosqlite`、供 PythonLab smoke 导入使用的 `aiohttp`）。普通单会话可用内存 SQLite；WS watcher 或 login/logout 并发夹具须用每测试独立临时文件库，避免 `StaticPool` 共享物理连接。脚本重试/清理语义见 [后端脚本说明](../scripts/README.md)。

在隔离运行器中选择 `tests/auth/test_logout_revocation_isolated.py` 与 `tests/auth/test_auth_logout_refresh.py`。它们使用真实 auth router、JWT、ORM、nonce，以及仅含合成 User/RefreshToken、开启 FK 的 SQLite；DB session/cache 为隔离适配器，不访问业务表或正常 PostgreSQL/Redis。

- 校验新 DB session 读到的持久撤销位、保留令牌副本的 refresh/`me` 返回，以及配置 Cookie 的清理，不只检查 `200`。
- 覆盖无效 access 的 refresh fallback、nonce 写入/读取失败、数据库 commit 失败、Cookie/header 冲突、旧会话重登保护和 refresh replay。
- 在首次读出 refresh 归属与获取用户锁之间插入已完成的 login/refresh，检验锁后重验；这是确定性逻辑回归，不证明 PostgreSQL 行锁调度或真实并发吞吐。真实 PG/Redis、TTL、生产 middleware 与前端网络竞态须另在专用环境验收。

## 管理与课堂 SSE 撤销回归

`auth/test_sse_revocation_isolated.py` 使用真实 JWT、auth logout 路由、SQLite ORM 与三个实际端点的事件生成器，覆盖退出前后事件、Cookie 回退、空闲失效、存储故障/超时与取消退订。cache/pubsub 为合成适配器，不是网络 SSE 或浏览器验收；真实 PG/Redis 的独立实例层另见 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)。

课堂旧测试 `classroom/test_classroom_auto_end_concurrency.py::test_concurrent_auto_end_claims_activity_once` 和 `classroom/test_classroom_plan.py::test_locked_plan_keeps_items_and_activities_eagerly_loaded` 直接使用 `settings.DATABASE_URL`，不能依赖 `TEST_DATABASE_URL` 保护。没有专用数据库时必须显式排除并阻断外连；pytest 的 nodeid 相对所选 rootdir（在 backend 下为 `tests/classroom/...`），应先 collect 核对，不将排除项算通过。

## 测评开放时间窗隔离回归

开发依赖见 `backend/requirements-dev.txt`。在已核验的隔离运行器中选择 `tests/assessment/test_assessment_availability_isolated.py`；扩展到 assessment 目录前逐例审查，无专用 PostgreSQL 时至少显式排除 `tests/assessment/test_assessment_profile.py::test_generate_class_profile_isolates_students_by_class`，不能仅安装依赖便普通 shell 直跑。

- BIZ-04 专项加载真实学生 router、JWT 签发/验签、角色/nonce 守卫、service 与 ORM；仅替换 DB session 和 nonce cache，并为 AI 设置调用哨兵。SQLite 内存库开启 FK，仅建立合成用户、智能体和测评相关表；fixture 阻断 socket 连接，不需要业务数据库、Redis 或 AI 服务。
- 校验列表与直接起测的一致边界、单边/无窗口、等价 UTC/正负 offset、起止时刻与微秒相邻时刻；新 DB session 核对已提交的 session/answer，SQL 哨兵检查窗外不查题、不写会话/答案，正常起测反证哨兵有效。
- 保留跨截止或改到未来后的本人同配置续答，核对开始时间、答案和原 session 不变且可继续答题；另一用户、另一配置以及非进行中历史会话不能绕过限制。配置缺失/禁用、空题库、未登录和 guest 角色拒绝维持原合同。
- SQLite 会丢弃时区；fixture 仅在配置加载/刷新边界恢复 UTC/等价 aware offset，并保留冻结时钟的 datetime 类型判断。该适配不证明 PostgreSQL 的时间戳转换、DST 或 `SKIP LOCKED` 并发行为；专用 PostgreSQL 用例必须单独配置并验收，不把 `deselected` 记作通过。
- 运行器另用不可用 DB/Redis 哨兵；临时 runner 与日志不进入维护脚本目录。

## 测评结果与个人画像权限隔离回归

- `assessment/test_assessment_result_visibility_isolated.py`：真实学生 router、请求 schema、service、SQLite ORM，响应另经真实 schema 校验。覆盖未交卷拒绝、终态结果、存在性/归属、合法单题反馈；身份为合成适配器但角色守卫真实，后台画像仅记录，不运行 AI。
- `assessment/test_assessment_profile_detail_isolated.py`：真实 JWT/角色守卫、学生和管理 router、schema、service、SQLite ORM。覆盖个人类型与本人归属双重校验、group/class 数字碰撞拒绝、管理端合法访问及缺失 ID 合同。
- `assessment/test_assessment_scoring.py`：只读纯 Python 计分边界，覆盖自适应首次尝试去重、无知识点兼容、知识点得分率和分数区间；直接加载 `scoring.py`，不导入 app、dotenv、数据库或外部服务，可在 `--noconftest -p no:cacheprovider` 下运行。
- 前两组用合成内存数据，遵守共同前提；不证明 PostgreSQL 锁/时区、Redis、完整 app lifespan/middleware、真实浏览器或供应商行为。

## 自适应首题与闭环反证回归

- `tests/assessment/test_assessment_adaptive_start_isolated.py` 使用真实 ORM/FK，默认 SQLite；显式安全 `TEST_DATABASE_URL` 可使用专用 PG 唯一 schema。按实际调用次序覆盖多题正常、首/末/全失败及真实 SQL/答案 ORM INSERT 外键异常，检查固定答案和成功题目保留、占位答案持久化、复用会话不再次调用 AI。保存点建立前的固定答案或前一题占位答案 flush 失败则要求整体失败；关闭失败 Session 后以新 Session 确认零会话/答案部分提交。供应商为替身，不代表真实 AI、最终 commit 故障恢复或起测并发唯一性。
- 退出补验同时运行 `tests/auth/test_logout_boundaries_isolated.py` 与 `test_logout_revocation_isolated.py`；确定性交错验证过期凭据、冲突身份、锁内顺序和故障后 Cookie 清理，仍非 PostgreSQL/Redis 双存储故障验收。
- AI 会话列表专项补最新问题/答案的时间与 ID 次序、空白回退、完整 session 统计和 limit；SQLite 与专用 PG 可共用该入口，合成视图不代替生产视图性能测试。
- `tests/pythonlab/test_sandbox_ownership_closure.py` 与既有启动恢复/limits/tasks behavior 合跑，验证真实任务/provider 分支，cache/CLI 为替身。当前仓库已无 xfail 标记，相关未修路径由对应用例直接断言。
- CSV/Excel 解析拆分在 `app/api/endpoints/xbk/_import_parsing.py`，XBK 原回归与新增边界保持字段校验、全批原子性、文本/换行合同；不通过放宽治理 baseline 或接受非法 API 输入使测试通过。
- 上述专项不得连接正常数据库或复用真实名册；风险反例通过不算修复完成。

## XBK 隔离 HTTP 回归

`tests/xbk/test_xbk_isolated_http.py` 默认跳过。满足共同运行前提，并配置一次性 XBK 审查服务后，在隔离运行器中使用以下选择：

```bash
XBK_AUDIT_BASE_URL=http://localhost:8009 XBK_AUDIT_ALLOW_LEGACY_SEED=1 \
  pytest -q -s tests/xbk/test_xbk_isolated_http.py
```

测试强制仅接受回环地址的 8009 端口及 `/health` 的 `isolated-xbk-test` 标识；会创建并删除分配给测试的 `2032-2033` 学年记录。启动前必须确认该服务连接独立测试库，不能将正常业务服务改名冒充审查服务。审查适配器需要真实 XBK router、PostgreSQL，并通过 `x-audit-role` 注入 admin/student/teacher/anonymous 身份；它验证路由权限而非真实登录链路。适配器属于一次性本地测试设施，不随普通 Docker 栈启动。

空课程代码的当前写入接口必须返回 422，不能放宽 schema 来制造历史数据。multipart 用例另显式要求 `XBK_AUDIT_ALLOW_LEGACY_SEED=1`，由外部审查适配器专用 `POST /__audit__/xbk/legacy-empty-codes` 以 year/term/tag 种入并提交隔离库的历史空值，再以新 session 读回确认。该 seed 路由不能加入正常 app；测试末尾仍清理限定学期记录，最终销毁一次性库。它不证明真实名册或正常认证链路。

## 分层约定

- `backend/tests/`：pytest 单元/集成测试
- `backend/scripts/`：后端 smoke/soak/专项验证脚本
- `scripts/prod-smoke/`：生产环境全链路烟测编排

## 维护规则

- 不在这里放一次性排障脚本。
- 不提交 `__pycache__/`、`.pytest_cache/` 等缓存产物。
- 如果新增测试模块，同步更新本文件的目录说明。

## 性能基线

以下为历史手动回归参考目标，未附当前数据量与实测样本，不能作为当前性能达标证据：

| 端点 | 历史参考目标 | 说明 |
|------|------|------|
| `/api/v1/xbk/analysis/summary` | < 500ms | XBK 统计摘要 |
| `/api/v1/xbk/analysis/course-stats` | < 300ms | 课程统计 |

**验证方法**：在获准的专用环境用真实参数计时，记录代码版本、数据规模、查询次数、耗时与前后对照；不要将正常业务服务用作默认测试目标。

**历史记录**: 性能测试文件于 2026-07 整理时移除（commit 39293d2），基线值保留于此作为手动验证参考。

## 全面修复批次的隔离回归入口

在显式隔离配置、禁用正常 conftest 与外连的运行器中选择以下维护文件，不直接把全量 pytest 指向正常基础设施：

- XBK：`tests/xbk/test_xbk_validation_parity.py` 对照手工/导入的字段及父实体合同；`test_xbk_export_text_safety.py` 检查 XLSX 文本类型及 XML，不等于 Excel 实际打开。
- XBK PG：`tests/xbk/test_xbk_import_concurrency_pg.py` 要求显式 `TEST_DATABASE_URL`，仅接受 asyncpg 和名称包含 test/testing/ci 段的专用库；每例唯一 schema/finally 清理，真实事务锁等待与晚冲突整批回滚。不可用正常库替代。
- AI：`tests/ai_agents/test_conversation_list_isolated.py` 默认合成 SQLite/ASGI；显式 `CONVERSATION_TEST_DATABASE_URL` 可用专用 PG 唯一 schema，覆盖本人 session 级聚合及详情隔离；搭配 `test_agent_conversations.py` 保留响应合同。
- PythonLab：`tests/pythonlab/test_sandbox_start_recovery.py` 结合既有 docker limits/tasks behavior。运行真实 Celery task wrapper，但 provider/cache/CLI 均受控替身；保留的非 CAS 风险反例通过不表示风险已修。
- 迁移：`tests/test_migration_preflight_guard_contract.py` 与 `tests/system/test_migration_state_check.py`，不加载 app conftest；不执行实际 upgrade。完整命令、红绿记录、环境与未覆盖范围只维护于 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)。

认证撤销反馈专项：`auth/test_auth_publication_failure_contract.py` 覆盖 `503`/Cookie 清理、严格会话读取、独立 refresh fallback 及登录提交后重锁重验。故障响应与凭据实际失效分别断言，不能把返回 `503` 当成双存储撤销保证。旧 fixture 必须模拟严格 GET 而非只模拟降级 cache.get；独立 PostgreSQL/Redis 故障与并发层的结果统一见 [TEST_STATUS](../../docs/testing/TEST_STATUS.md)。
