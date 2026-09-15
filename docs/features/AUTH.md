# 认证与权限系统

> 状态：active
> Owner：AUTH / backend
> 最近复核：2026-09-14

## 第一批未发布候选：公共配置与账号生命周期治理（2026-09-14）

本节描述当前源码中的**未发布候选**，不表示正式环境已经更新、AUTH 正常库已经完成
切换，或候选依赖与镜像已经发布。

### 匿名公共配置白名单

- `GET /api/v1/system/public/feature-flags/{key}` 只允许前端既有入口使用的 14 个明确
  布尔开关；未知 key 在数据库查询前返回 `404`，不能通过前缀、数据库中是否存在或
  敏感词黑名单扩大公开范围。
- 匿名响应只投影严格布尔类型的 `value.enabled`。记录不存在、值不是对象或 `enabled`
  不是布尔值时返回空 `value`，不透传通用 JSON；响应设置 `Cache-Control: no-store`。
- 管理端功能开关的读取与写入仍只允许 `super_admin`，匿名白名单不授予管理权限。

### 停用、删除、恢复与降权

- 停用、软删除、批量删除及导入导致的停用，与 durable inactive tombstone、全部 refresh
  token 撤销在同一数据库事务中提交；AUTH authority 未 ready 时拒绝这些生命周期变更，
  不以“先改账号、稍后撤销凭据”的方式降级。
- 重新启用账号不会恢复旧 access/refresh 凭据；历史停用但缺 tombstone 的账号在恢复时
  先补做持久撤销。普通资料修改不触发退出。
- 单用户降权、停用、删除、批量删除和用户导入都必须至少保留一名已激活且未删除的
  `super_admin`。违反时返回 `409`，错误码为 `LAST_ACTIVE_SUPER_ADMIN`。
- 治理事务先取得 AUTH 全局事务锁，再按用户 ID 顺序锁定操作者与目标账号，等待后重新
  校验操作者权限，随后锁定并更新持久会话/refresh 状态。该合同只覆盖采用此治理入口的
  writer，不应扩称所有外部 SQL 或旧版本实例均已受控。
- 创建用户也先取得 AUTH 全局事务锁并重新读取操作者，避免已被停用、删除或降权的管理员
  利用在途请求继续创建高权限账号。
- 启动初始化仅在配置用户名完全不存在时创建超级管理员；若该用户名已经存在，启动过程不会
  重置密码、提升角色、重新激活或覆盖人工治理结果。初始化失败会中止应用启动，不再只记录
  日志后继续提供服务。后续密码和生命周期变更必须走账号管理入口。

## 概述

WangSh 使用统一登录系统，所有角色通过 **姓名 + 学号** 登录。系统包含 5 级角色层级：`super_admin` > `admin` > `teacher` > `student` > `guest`。

---

## 登录系统

### 登录方式

**统一登录**：所有角色（super_admin/admin/teacher/student）使用 **姓名 + 学号** 登录。

- **姓名** = `full_name`
- **学号** = `student_id`
- **向后兼容**：有 `hashed_password` 的账号也可用密码登录
- **Guest 模式**：未登录可浏览，右上角显示"访客模式"

### 登录页设计

- **布局**：分栏布局 + 4 个动画角色（Tech Cyan 配色）
- **交互**：角色眼睛跟随鼠标移动
- **跳转逻辑**：
  - 未指定 `redirect` 时，所有角色登录后统一进入首页 `/home`，不再按角色自动进入后台；已登录用户访问登录页也遵循此规则。
  - 显式指定安全的站内 `redirect` 时，返回用户请求的页面，保留查询参数和锚点；显式 `/home` 不会被改写为后台。
  - `redirect` 仅接受以单个 `/` 开头的站内路径；外部地址、协议相对地址、反斜杠及原始控制字符均回退 `/home`，路径中的点段会先规范化。
  - 请求 `/admin` 路径仍须通过登录页的教职工校验；非教职工账号提示无后台权限并退出登录。目的地原有 `AdminGuard`、`RoleGuard` 与后端权限检查保持不变，redirect 不授予额外权限。

### API 端点

- **登录**：`POST /api/v1/auth/login`
  - 请求格式：`application/x-www-form-urlencoded`
  - 参数：`username`（姓名）、`password`（学号或密码）
- **登出**：`POST /api/v1/auth/logout`
- **刷新**：`POST /api/v1/auth/refresh`

---

## 角色权限系统

### 角色层级

```
super_admin (超级管理员)
    ↓
admin (管理员)
    ↓
teacher (教师)
    ↓
student (学生)
    ↓
guest (访客)
```

**详细权限矩阵**：见 [`frontend/src/styles/ROLES.md`](../../frontend/src/styles/ROLES.md)

---

## 服务端身份解析与可选认证（2026-09-09）

- 旧 JWT 的字符串 subject 仅在有效、未删除用户中唯一匹配时解析；多用户跨字段碰撞拒绝，不按查询顺序任选用户。数据库无匹配不回落合成 id=0 用户。退出复用此解析；歧义 access 不阻断独立有效 refresh Cookie 的既有撤销路径。
- `get_current_user_or_none` 复用强制认证的身份、session nonce 与可选 IP 校验；缺凭据或认证 401 返回匿名，其他 HTTP 异常不转换为匿名。调用方必须按匿名合同限制数据，不能把可选认证当作授权。
- Cookie 回退保持现有规则：无 header 或 header 不能解析身份时可尝试独立 Cookie；header 已解析但 nonce 失效时，不另选 Cookie 用户。普通 HTTP 不新增 query token 通道。
- 服务层旧 `get_current_user` 是内部身份查找，不是完整会话验证入口。唯一匹配也不等于 subject 永久绑定用户；不可变用户 ID token 迁移、refresh 的旧 subject 合同、凭据变更撤销政策和真实代理链仍需单独处理。
- PythonLab terminal/DAP 建连在读取业务 session cache 或访问 terminal/DAP 前验证 JWT、有效用户及当前 nonce/IP；验证失败（含存储异常）关闭 4401。上述为接入规则；已建 terminal/DAP 连接另有逐输入/输出、attach 及空闲会话复查，不能理解为仅在建连时验证。检查与 IO 非原子，不改变可信代理配置；具体边界由 PythonLab 功能文档维护。
- 当前持久撤销与受控切换合同见下文；不存在 DB/Redis 分布式事务，也不代表正常实例已经迁移。验证范围见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

### 初始身份查询的数据库故障

已识别的数据库连接不可用（包括 PostgreSQL 拒绝新连接）在初始身份查询返回 `503`，
不返回身份，也不把基础设施故障降为匿名或错误的 `401`。Bearer、配置允许的 Cookie
回退、可选认证和 SSE 接入沿用相同边界；无效 JWT、缺少必需凭据仍按既有规则拒绝。
服务解析的临时 DNS 错误 `socket.gaierror(EAI_AGAIN)`（含 DBAPI 包装）也按该边界返回
`503`；解析器错误码单独分类，不与普通 `OSError.errno` 混用。永久解析失败
（如 `EAI_NONAME`、`EAI_FAIL`）、未知解析错误，以及 SQL/编程错误仍保留原异常边界，
不因异常链中出现临时 DNS 错误而统一转换为 `503`。既有 DBAPI
`connection_invalidated=True` 是独立的连接失效信号，仍优先按暂时不可用处理
（`ProgrammingError`、`IntegrityError`、`DataError` 除外）；因此不能把 DNS 负例理解为
在任何包装状态下都必然传播。此分类只负责反馈，不自动重试请求。

初始查询故障反馈本身不撤销凭据；数据库恢复后，是否仍可访问由下面的持久会话
状态和缓存校验决定。不能将 `503` 当成撤销完成或凭据失效的证据。

## 持久会话权威与受控切换

### 当前权威及跨存储顺序

PostgreSQL 保存撤销依据，Redis 只保存可重建的会话投影。新 Alembic revision
`20260910_0001_auth_authority`（前序 `20260908_0001_xbk_academic_year`）新增：

| 表 | 字段及用途 |
|---|---|
| `auth_authority` | `id` 主键；唯一约定行 `id=1` 的 `ready` 非空，迁移插入 `false` |
| `auth_session_states` | `user_id` 主键并外键引用 `sys_users.id`（用户硬删时 cascade）；`nonce` varchar(128)、`ip` varchar(64)、`active` 均非空；`ip_expires_at` nullable timestamptz |

`active=false` 的行是撤销 tombstone，**不随 Redis TTL 或 refresh 清理删除**；
`ip_expires_at` 只界定同 IP 占用租约，不是撤销依据的过期时间。

- 所有认证 mutation 固定获取 PostgreSQL 全局事务 advisory lock `(1465075777, 1)`，
  再获取用户/token/state 锁。用于正确性优先的序列化，不是高吞吐锁分片方案。
- 登录在一个 DB 事务中替换本用户 refresh、写入新 nonce/IP 和租约、撤销仍有有效租约
  的同 IP 旧 owner（含其全部 refresh），然后提交。Redis 丢键不再抹掉旧 owner 的撤销依据。
- 发布时重新获取同序锁，重验**本次具体 refresh**及持久状态；已被更新的 issuance 返回
  `409`，不能发布旧 nonce。Redis 部分写入/超时/确认丢失不撤回已提交的撤销。
- refresh 只恢复已接管且仍 active 的 nonce。已撤销、不匹配、未接管的 legacy/ws1 均拒绝；
  已接管 legacy 的 opaque token 格式和合法 cache-loss 恢复保留，不做 runtime 懒 adoption。
- refresh 单次消费先 commit 再发布。**commit 已成功而响应/发布丢失时，原 refresh 重试为
  `401`，须重新登录**；不为了重试可用性恢复已消费 token。DB commit 前失败则 rollback，
  原凭据保持原状态，可以在故障消除后重试。COMMIT 确认丢失可能已提交，不能臆断 rollback。
- 普通已匹配缓存的 refresh 不重写会话或续租。登录租约使用原 `_session_ttl()`；
  恢复缓存的 IP 写入最多使用持久租约的剩余秒数，已过期不重新占用 IP。
  cache-loss 从新 IP 恢复沿用原请求 IP 行为，但不认领新 IP binding；不能覆盖该 IP 的其他 owner。
  IP 租约过期后允许其他账号登录，不永久扩大同 IP 独占范围。
- Redis 会话缺失时 access 仍拒绝，必须由有效 refresh 或重新登录恢复；read 不偷偷建状态。
  发布结束后新 mutation 仍可能在 HTTP 响应到达前取胜，客户端可能收到已失效的 token；
  后续请求按 DB 状态拒绝。没有“返回过成功就一直有效”的保证。

### 被替换会话的 401 反馈（2026-09-12）

同一用户再次登录后，旧设备的 access 会被持久权威拒绝，`401` detail 区分两种语义：

- 持久状态仍 `active` 但 `nonce` 已被新登录轮换 → `账号已在其他地方登录，请重新登录`，
  前端据此展示“你的账号已在其他地方登录，当前设备已下线，请重新登录”。
- 主动登出/撤销/过期（状态 `inactive` 或缺失）→ `会话已失效，请重新登录`，不误报异地登录。

判定在 `session_guard.verify_request_session_detail`：持久权威拒绝时先读
`auth_session_states`，仅当 `active` 且 nonce 不匹配才给替换语义；Redis 投影不是该判定依据。
当 Redis 中存在 nonce、但与 access token 不一致时，也必须重新读取持久状态确认：数据库仍为
当前 token nonce 时按 Redis 投影陈旧处理并允许请求；数据库 nonce 确已轮换时才返回异地登录，
数据库状态 inactive 或缺失时返回普通会话失效。该反馈不改变撤销强度、`409`/`503` 合同或
cookie 清理行为。

前端把认证失效详情作为 60 秒内、同标签页的一次性事件处理：只写 `sessionStorage`，展示后立即
消费并清理；旧 `localStorage` 文本、过期事件、React StrictMode 重挂载以及普通登录入口均不得
重放历史“异地登录”提示。真实的新登录替换仍清除旧 token，并只提示一次。

### 转发头可信范围（S7 治理，2026-09-11）

`AUTH_TRUST_X_FORWARDED_FOR=true` 时，转发头（`AUTH_IP_HEADER_ORDER`）**仅在真实 socket
peer 属于 `AUTH_TRUSTED_PROXY_CIDRS`（逗号分隔 CIDR）时才被采纳**；否则一律回退 peer
真实 IP。`AUTH_TRUSTED_PROXY_CIDRS` 为空时 fail-closed：忽略所有转发头。设置项在启动时
校验 CIDR 合法性，非法网段直接拒绝启动。

- 生产拓扑必须把网关/反代的容器或主机网段写入该设置（例如 Docker bridge 网段或逐网关
  精确网段），不能填 `0.0.0.0/0` 泛授权。
- 后端端口不得对非合作来源可达；直连后端无法再伪造绑定 IP。
- 真实代理链验收（S0–S7）证据见
  [2026-09-11-proxy-chain-acceptance.md](../docker/archive/2026-09-11-proxy-chain-acceptance.md)。

### 必须停流的 enrollment（不是在线/自动迁移）

迁移创建 closed gate，**仅执行 Alembic 不会开启认证**。新代码在 gate 未 ready 时拒绝
登录/刷新和受保护身份（`503`）；退出无法完成时仍清理 Cookie，返回 `503/incomplete`。
不存在启动时建表、自动 ready、SQL 开关或每请求首次 adoption。

操作顺序，必须在有单独授权的维护窗口由运维执行；本轮仅验证专属合成实例：

1. 记录目标数据库/schema、认证 Redis 实例/DB、当前同 IP 政策、操作者及维护证据。
   停止全部旧应用副本的 HTTP login/refresh/logout，管理侧密码、用户状态和凭据修改，
   以及会修改 auth/session/token 的 worker、脚本和 Redis writer。排空在途请求；停止/排空
   旧 SSE/WS 等长连接及其重验任务，避免旧代码继续服务或重新写入旧会话。
   新 gate 无法阻止旧代码，不能混跑旧 writer。
2. 停流后取得同一逻辑时点的 PG/Redis **配对备份/快照**，保持停写直到切换完成。
   独立时间点的两份备份不构成证据；该一致性由运维确认，CLI 的声明字段不能自动检测。
   Redis 自然 TTL 继续流逝；读取仅保留剩余到期时间，不重置 TTL。
3. 使用现有受控 Alembic 流程应用上述 revision（不要依赖 `create_all`）。先 dry-run enrollment，
   审阅未知用户，再执行同计划的 apply。两次之间必须持续停流，apply 会重新读取和验证，
   dry-run 报告不是可绕过复核的授权快照。
4. service API 为 `app.services.auth.bootstrap_durable_auth_authority(db,
   legacy_writers_stopped=True, reauthenticate_user_ids=frozenset(...), dry_run=...)`。
   必须传独立、尚未开始事务的 session，不混入其他待写数据。它获取全局锁和 gate 行锁，
   在 PG 中还锁用户及 refresh 表以阻止账户/token 并发 writer；以 Redis MULTI/EXEC
   读取会话值及 PTTL，再读取 IP binding 快照。跨两次 Redis 快照的稳定性依赖第 1 步停写，
   不是跨库原子快照。异常整体 rollback，状态基线/token 撤销/ready 在**一次 commit**中完成。
5. 只有可证明的 per-user nonce/IP 能保留 legacy。单一 owner 即使 IP key 丢失也可从有效
   user-session 证据接管；重复 IP 必须 exact binding 证明 winner，`user_id` 必须为真正的
   正整数（不接受 bool/float/string），nonce 必须格式正确且精确匹配。有 key 但 owner/nonce/
   TTL 不规范、缺会话且有 live refresh、无法判断胜者时整事务拒绝。
   **未知用户默认不撤销，也不开 gate**。运维只可对返回的具体 user id 明确批准重新登录，
   不得默认为全员批准。停用/删除账号或被有效绑定证明已替换的 owner 可写 inactive。
6. apply 成功后再启用新版本流量。若结果丢失，重新调用同一入口：已 ready 的基线不覆盖，
   返回幂等结果。closed gate 但已有 state 时拒绝覆盖，必须调查，不手工改 ready。

### 显式维护入口与计划文件

入口：`backend/app/api/endpoints/auth/cutover.py`，**直接运行文件，不使用 `python -m`**
（后者会提前导入 router/settings）。它不是 HTTP endpoint、不是应用启动钩子、也不自动
执行 Alembic。没有 plan/目标确认时不会连接；默认 dry-run；清除继承的应用配置、禁读 dotenv，
只使用显式 PG/Redis 目标。计划文件应权限 `0600`，不得提交或在日志粘贴含密钥内容。

计划包含以下字段（URL 从受控凭据渠道填写，不从正常 `.env` 自动发现）：

```json
{
  "database_url": "postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DATABASE",
  "database_schema": "public",
  "redis_url": "redis://USER:PASSWORD@HOST:PORT/AUTH_DB",
  "operator": "APPROVED_OPERATOR",
  "paired_snapshot_id": "PAIRED_PG_REDIS_SNAPSHOT_RECORD",
  "freeze_evidence": "STOP_DRAIN_AND_FREEZE_RECORD",
  "legacy_writers_stopped": true,
  "inflight_drained": true,
  "account_writes_frozen": true,
  "redis_auth_writes_frozen": true,
  "unique_per_ip": true,
  "reauthenticate_user_ids": []
}
```

其中 `unique_per_ip` 必须与待启用配置一致；`redis_url` 必须指向实际认证缓存 DB，而不是
依据名称猜测通用 Redis URL。入口直接连接这个 URL，仅读会话快照，不写 Redis。
支持直连 Redis URL（包括受验证 TLS URL）；不负责自动发现 Sentinel 主节点。

```bash
# 以下是维护调用模板，不是本轮对正常库已执行的命令。
/path/to/reviewed/python /path/to/wangsh/backend/app/api/endpoints/auth/cutover.py \
  --plan /protected/auth-cutover.json --confirm-database EXACT_DATABASE_NAME
# 审阅 dry-run、处理具体未知用户授权后，保持同一停流窗口：
/path/to/reviewed/python /path/to/wangsh/backend/app/api/endpoints/auth/cutover.py \
  --plan /protected/auth-cutover.json --confirm-database EXACT_DATABASE_NAME --apply
```

标准输出只给计数；缺证据只报告需要批准的 user id，不打印 token、密码、URL 或原始 DB
异常。默认不会读取正常配置或访问正常库；显式指定正常目标仍属于须另行授权的运维操作。

### 回滚、历史反例与准确边界

- 缺少迁移前已丢失的 nonce/IP 证据，无法追溯判断谁被替换；有 live refresh 的未知用户必须
  显式处理，不能伪造“无损接管”。这是历史信息不可恢复，不是允许迁移后无 state 放行的免责。
- 普通 HTTP read 不持有 mutation 锁。其持久验证发生在撤销提交之前、但响应发生在提交之后的
  已在途请求可以完成；提交之后新 admission 必须拒绝旧 nonce。持续 SSE/WS 由各入口重验，
  此 AUTH 专项不等于 WS 全覆盖，也不能收回已发送事件/数据或已授权开始的业务 mutation。
- downgrade 会删除两表及撤销证据，只能在停止认证流量且所有未过期凭据已显式失效/排空后考虑。
  不能在线降级到 Redis-only 代码，也不能只恢复某一份 DB/Redis 备份；旧 nonce 的重新引入
  是安全事故风险。tombstone 治理、全局锁吞吐及大用户量 enrollment 维护时长须独立评估。
- R4 的 Redis-first 候选及“同 IP 替换后 cache-loss 恢复旧 ws1 / legacy access 在退出故障后
  可用”属于**修前历史反例**，没有作为安全实现采用。旧 Redis WATCH helper 的局部 CAS
  测试不证明当前整条登录事务。当前 nonce fence/closed gate 取代那些风险路径；修前证据和
  源码绑定的合成 PG/Redis、维护回归范围见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。
  测试通过不代表正常实例已执行切换。

## 管理与课堂 SSE 会话持续校验

- 通用管理推送、课堂管理推送和学生课堂推送使用入场认证实际接受的 token（含既有 Cookie 回退），不重新挑选另一身份。订阅前、每次输出事件前及等待事件期间重验 JWT 到期、nonce 与现有可选 IP 合同。
- 事件等待轮询为 1 秒，单次会话存储校验上限为 2 秒；缺失认证上下文、验证拒绝、存储异常/超时均结束流，并取消待取事件任务、释放订阅。不发送附带私有数据的错误帧；已开始响应后也不改写 HTTP 状态。
- 这不是原子即时撤销：最后检查与发送之间的在途帧、浏览器/代理已缓存数据及网络发送阻塞仍有边界。不能把轮询间隔当作全链路断连 SLA；不周期重查数据库角色、停用或班级关系。
- AI 供应商流和小组讨论流未接入本守卫；完整网关/浏览器、多角色及故障验收与 AUTH 双存储问题保持独立。实例证据只见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

## 前端权限检查

### 使用 useAuth Hook

```typescript
import useAuth from "@hooks/useAuth";

const auth = useAuth();

// 角色检查
auth.isSuperAdmin();  // 仅 super_admin
auth.isAdmin();       // admin OR super_admin
auth.isTeacher();     // 仅 teacher
auth.isStaff();       // teacher OR admin OR super_admin
auth.isStudent();     // 仅 student
```

### 身份边界与业务缓存隔离

- `AuthProvider` 通过 `AuthQueryScope` 管理当前身份专属的 TanStack Query `QueryClient`；入口不再跨身份共享模块级单例。使用 `useAuth` 的业务组件及查询须位于该 Provider 内。
- 用户 ID、角色、班级、学年或启用状态变化时，整体替换业务查询作用域并重新挂载其业务子树，避免旧 observer 的 `placeholderData` 或页面局部状态带入新身份。普通同身份资料刷新（如显示名称变化）保留当前缓存。
- 会话失效、直接 `/me` 失败清身份、主动退出切换至访客作用域；退出先撤下本地身份，不等待退出 HTTP 返回才隐藏旧业务数据。失效后同一账号重登也建立新作用域。
- 旧作用域真正卸载后取消查询并清空缓存；清理避开 React StrictMode 的 effect 重放。忽略 AbortSignal 的迟到查询、捕获旧 client 的 mutation 回调只作用于旧 client，不进入新身份的缓存。这不是仅设置失效时间或 invalidate，不能在新身份首帧先展示旧缓存再刷新。
- 边界：本机制在前端收到新的身份/权限信息时生效，不负责侦测尚未获知的服务端权限变更；不替代服务端鉴权、JWT/refresh 撤销、跨标签页协调或退出与再次登录的并发网络合同。已发出的 mutation 可能仍在服务端完成，清理缓存不能回滚写操作。浏览器持久化、模块级缓存等非 QueryClient 存储仍须各自审查。
- 维护回归位于 `frontend/src/components/Auth/authQueryIsolation.test.tsx`；真实应用与隔离认证/用户接口的复验范围、门禁及未覆盖项统一见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。登录页目的地规则和后端 API 契约未因本项改变。

### API 在途身份隔离与跨标签身份同步

统一 Axios 客户端为请求、refresh 单飞任务及延迟失效通知携带本地身份世代。登录开始/成功、当前登录失败或取消后的结算以及本地清理推进世代；旧成功响应、旧错误响应及原业务重试不得进入新身份。普通同身份 token 轮换不推进世代，保留该世代内的 refresh 单飞与业务重试。 登录等待期间的普通请求仍可能携带旧身份凭据，因此另设 pending-login 门禁：其 refresh 结果不得提交 token、清理存储、触发失效通知或取消正在等待的新登录。失败登录保留此前 token，但废弃该尝试期间的在途任务；旧登录的 finally 不解除较新登录的门禁。此保护不能撤回已发送请求或浏览器已处理的 HttpOnly Cookie。

主动退出先捕获当前 Bearer 证明并立即清本地 token，再发送退出请求；不在旧请求的 finally 中无条件清理后来登录的账号。直接调用 refreshToken 的消费者同样拒绝过期世代的响应。维护实例见 `frontend/src/services/api.auth-race.test.ts`，实际 Axios adapter 与受控延迟覆盖交错，而非仅测试计数器。

跨标签身份同步使用共享存储中的 `ws_auth_identity`（`pending` / `settled` / `signed-out`）和 token 快照。除了监听 `storage` 事件，请求/响应边界也读取实时快照，避免只依赖可能迟到的事件；检测到身份变化后推进本地世代并由 Provider 撤下旧身份。新挂载的受保护标签遇到 pending 或 signed-out 意图时不从仍存活的 Cookie 自动恢复；跨标签登录取得新身份仍需 `/me` 验证。

退出按钮立即导航至登录页，不等旧退出响应回来再次导航。当前身份的退出请求失败（包括服务端 `503`）时，页面保持访客并显示“已清除本页登录状态，但服务端会话撤销未确认”的风险提示；若已切换至新身份，旧失败不得覆盖新身份或弹出过时提示。维护回归还见 `frontend/src/components/Auth/UserMenu.auth-race.test.tsx`。

边界：共享存储不可用时为 best effort；这些机制不是跨标签的全局原子互斥，不能撤回浏览器已接收的 HttpOnly Set-Cookie，也不能取消已经在服务端完成的操作。本地退出及风险提示不等于服务端凭据全部失效。当前跨标签专项属于 jsdom/storage 事件与受控 HTTP adapter 测试，不代表真实多标签浏览器或所有 Cookie 乱序场景已验收；实测结果统一见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

### 服务端退出与撤销边界

`POST /api/v1/auth/logout` 的输入与返回合同见 [API 清单](../development/API.md)。客户端清身份/缓存与服务端撤销是两项独立动作，不能用 Cookie 已删除推断保留令牌副本已经失效。

- 当前有效 access 优先：按 Bearer header、配置的 access Cookie、兼容 `access_token` Cookie 选取；必须通过 JWT 过期/签名检查，并在用户行锁内与当前 nonce 匹配。不忽略 JWT 过期，也不接受裸用户 ID 授权退出。
- access 缺失、过期、验签失败、nonce 不匹配或无法读取时，改用配置的 refresh Cookie（无此值才取兼容 `refresh_token`）。refresh 必须未过期、未撤销，所属用户仍启用且未软删除。无效凭据只能触发客户端清理，不能撤销其他人的会话。
- refresh 先只读归属，再按用户行→refresh 行的顺序获取锁并重新检查有效性；不能凭等待锁之前读出的用户 ID 直接撤销。若另一个登录或 refresh 已替换旧令牌，旧 refresh 不再有退出权限。切换到 refresh 所属用户前先释放无效 access 候选用户锁；一个请求只撤销一个证明过的身份，有效当前 access 不连带撤销冲突 Cookie 所属的另一账号。
- 在同序全局锁和用户锁内将 durable state 标为 inactive，并撤销该用户 refresh，一次 DB commit 完成。退出不再写 Redis nonce；不做提交后无锁缓存轮换，也不误踢随后完成的新登录。
- **数据库提交成功**：已接管 legacy/ws1 的 access 与 refresh 均被持久 fence 拒绝，即使旧缓存仍在或后来丢失。**数据库提交前失败**：rollback 且不改缓存，原凭据可能仍有效；返回 `503/incomplete` 并在存储恢复后重试。**COMMIT 确认丢失**：结果不确定，`503` 不能说明未提交；不自动恢复原凭据。历史 Redis-first“旧 access 仍可用”的故障结论不适用于此已接管路径。
- 无论凭据是否可用或撤销是否成功，端点均尝试删除配置的 access/refresh Cookie。已识别的撤销异常返回 `503` 与 `revocation_status: "incomplete"`，不再伪装为登出成功；正常处理或无有效凭据的幂等清理返回 `200`。兼容别名仅参与凭据读取；配置为不同名称时，不保证兼容别名也被清除。
- logout 专用严格 Redis GET 区分缺键与读取故障/损坏数据，不改变通用 cache 的降级策略。读取失败先释放 access 候选用户锁，仍允许独立有效 refresh Cookie 授权撤销；无法取得有效 fallback 时返回 `503`。真正缺失或不匹配的 nonce 不可授权撤销。`503` 表示未确认完成，不保证保留的凭据副本已失效。

登录和 refresh 的 DB-first 发布、精确重验、单次消费及重试合同见上文；没有 DB/Redis
分布式原子性承诺。退出 helper 与 HTTP/JWT/ORM 维护回归位于 `backend/tests/auth/`；
`test_durable_session_authority_isolated.py` 另覆盖专用 PG/Redis 事务、同 IP 替换、故障与
受控 enrollment。合成 SQLite 仅证明顺序语义，不能代替 PostgreSQL 锁、Redis TCP 或生产
网关/CSRF 验收；结果统一见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

### 路由保护

- **AdminGuard.tsx**：使用 `isStaff()` 做路由准入（教师也可进 `/admin/*`）
- **AdminLayout.tsx**：使用 `menuWhitelist` 按角色过滤侧边栏菜单
- **Login.tsx**：默认跳转 `/home`；保留安全站内 redirect 与后台教职工校验

---

## 后端权限依赖

### 权限装饰器

```python
from app.core.deps import (
    require_super_admin,
    require_admin,
    require_staff,
    require_student
)

# 使用示例
@router.get("/admin-only")
async def admin_endpoint(user: dict = Depends(require_admin)):
    pass

@router.get("/staff-only")
async def staff_endpoint(user: dict = Depends(require_staff)):
    pass
```

### 权限级别说明

- `require_staff()` = teacher **OR** admin **OR** super_admin
- `require_admin()` = admin **OR** super_admin
- `require_super_admin()` = super_admin **only**

---

## 用户管理保护规则

### 管理员限制

管理员（`admin`）受以下限制保护：

1. **不能**修改或删除超级管理员（`super_admin`）
2. **不能**修改或删除其他管理员（`admin`）
3. **只能**将角色改为 `student` 或 `teacher`
4. 导入用户时**只能**导入 `student` 或 `teacher` 角色
5. 超级管理员默认不在用户列表中显示

### 超级管理员权限

超级管理员（`super_admin`）拥有完全权限，可以：

- 修改和删除所有角色用户（包括其他管理员）
- 创建和管理管理员账户
- 修改系统全局配置

---

## 修改角色系统

角色层级、权限矩阵和新增角色检查清单统一由
[ROLES.md](../../frontend/src/styles/ROLES.md) 维护，本文只说明认证流程和用户可见行为。

修改认证或权限时，至少同步检查后端权限依赖、认证服务、认证/用户端点，以及前端
`useAuth.ts`、`AdminGuard.tsx`、`AdminLayout.tsx` 和角色矩阵；不要在多个文档中复制
同一份文件清单。

---

## 相关文档

- [角色权限矩阵](../../frontend/src/styles/ROLES.md) — 详细权限列表
- [API 文档](../development/API.md) — 认证相关接口
- [AGENTS.md](../../AGENTS.md) — 开发规范
