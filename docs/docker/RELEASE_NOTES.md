# 发布与运维记录

> 状态：active
> Owner：release-ops
> 最近复核：2026-09-10
> 归档条件：当前未发布内容进入正式版本记录，且后续发布记录替代其当前指导作用
>
> 目标：集中记录每次发布的关键变更、配置影响、构建/部署步骤、验证结果与回滚点。
>
> 历史命令说明：下方旧版本记录中的 `build_images.sh` 仅用于追溯，脚本已删除。
> 当前构建入口统一使用 `scripts/deploy.sh build` 或 `scripts/deploy.sh build-amd64`。

---

## 未发布：PythonLab 终端生命周期与输出修复（2026-09-10）

- 后端终端在切换至调试器或参考页时保持挂载和流连接，修复晚切终端丢失输入提示；隐藏终端不进入焦点或辅助技术导航，WS 打开不抢后台焦点。本地终端保留既有按需生命周期。
- stdout/stderr 已经通过 TTY 到达时关闭重复 DAP 转发，避免重复行和损坏输入提示。不更换原生 title/aria-label 控制按钮，不增加复杂 Tooltip。
- 新前端与冻结后端已做真实 Chrome/WebKit late-switch、步进/Continue、输入、代理重连和 Reset 回收；最终 AUTH overlay 经专库正式迁移和受控切换后再次完成双浏览器整合。仅专项冻结组合，不是全 dirty 工作区或发布验收；结果与边界按 [TEST_STATUS](testing/TEST_STATUS.md) 区分。未更新正常开发入口或部署生产。

## 未发布：AUTH 持久会话权威（2026-09-10）

- 将已接管会话的撤销依据持久化到 PostgreSQL，Redis 只承担会话投影；DB 提交后缓存发布失败不再以恢复旧缓存作为恢复旧权限的依据。分布式提交不承诺回滚，失败或响应丢失仍可能已有持久副作用。
- 新增 AUTH migration 和默认关闭的权威 gate，必须先受控 enrollment，禁止 runtime legacy 懒接管或无条件置 ready。未知存量证据需要明确处理，不能通过暗中全量退出改变兼容政策。
- 仅在合成专库演练，未变更正常业务库或发布。切换、混版本与回滚风险见 [部署说明](deploy/DEPLOY.md)；最终验证和开放项只见 [TEST_STATUS](testing/TEST_STATUS.md)。

## 未发布：XBK 导入取消清理（2026-09-10）

- 导入预检、写入和提交尚未完成时遇到一次任务取消，显式回滚并保留取消异常，避免直接保留 session 的调用方带着失败事务重试；没有新增接口或 XBK 数据库迁移，未改变自然键更名政策。
- 不将此前 retained-caller 问题描述为正常 HTTP 持久化损坏；二次取消仍可能打断 rollback，调用方必须确保 session 清理。真实断连后服务端可能继续提交，不承诺响应丢失等于数据未写入。
- 代码尚未发布，分层验证与 Excel 实开状态只见 [TEST_STATUS](testing/TEST_STATUS.md)。

## 未发布：首页与管理后台实例修复（2026-09-10）

- 首页内容区约束可用宽度，模块入口允许换行，版本长文本限制在容器内换行，修复手机视口下入口及版本被裁切的问题；保留既有视觉和导航行为。
- 管理后台仅在手机断点将侧栏提升到现有浮动面板层级，位于遮罩之上；桌面层级、尺寸和菜单处理保持原逻辑，不通过删除遮罩绕过问题。
- 状态概览按已认证身份取数，仅超级管理员请求和展示系统统计；普通管理员保留健康检查、刷新和明确权限说明，不放宽后端overview/settings权限。沿用请求所有权机制取消旧请求并拒绝迟到结果，身份或角色变化重置页面局部状态；统计请求失败不再静默显示空卡片。
- 组件专项纳入默认测试收集。真实Chrome旧失败、新镜像绑定、交叉复核及未覆盖范围统一见 [当前测试状态](testing/TEST_STATUS.md)。本条不代表全项目验收或生产发布，无后端结构迁移和依赖升级。

## 未发布：公共页面版本元信息（2026-09-10）

- 首页与后台布局改为同步读取前端构建版本和环境标签，删除为展示版本而发出的受限系统 API 请求、异步状态及模块级缓存。解决普通身份页面产生多余权限错误的问题，不放宽后端权限。
- 版本缺失或为 `unknown` 时显示占位符；服务器设置不再作为该标签的回退来源。构建与静态页面更新规则见 [部署版本管理](deploy/DEPLOY.md#版本管理)。没有依赖升级、数据库结构或会话政策变更。
- R2 下文“Docker 恢复尚待确认、新镜像待复验”是当时检查点，已由后续真实实例覆盖；DNS 窄修复的镜像验收及剩余双存储风险以 [当前测试状态](testing/TEST_STATUS.md) 为准，不将它扩称完整认证闭环。
- 本次元信息修复的专项、真实新镜像和浏览器验收分层记录在 [当前测试状态](testing/TEST_STATUS.md)；未发布到生产，不等于全项目验收。

## 未发布：R2 契约复核与验收边界（2026-09-10）

本节只校准下方相关历史描述，保留原红例，不代表发布或全部风险关闭。源码、隔离专项、最终镜像 TCP 和浏览器是不同证据层；动态结果仅见 [TEST_STATUS](testing/TEST_STATUS.md)。

- **XBK 普通导出**：`selections` / `course_results` 的 `data` 改为有效名册驱动的当前筛选全集，含无选课虚拟行与未选、多选，不受列表分页限制；无有效学生名册的选课移入 `diagnostics`。两个 sheet 始终保留列头，旧的第一 sheet 诊断消费者须改读 `diagnostics`，不能称完全向后兼容。live grade、姓名快照、班级与搜索的精确合同见 [XBK](../features/XBK.md#导出格式)。
- **XBK 父删除**：当前手工写入/恢复/修改及导入 execute 已采用学生 SHARE → 课程 SHARE → 子行 UPDATE，等待后刷新并重验；父删除先锁父，批量冻结 ID 后级联。下方“无并发删除锁”的判断不再适用于这些合作入口；preview 仍是快照，保证限定 PostgreSQL READ COMMITTED，不覆盖自然键更名、直接 SQL/旧代码、其他入口或存量迁移。
- **认证故障仍未最终闭环**：原最终 Docker 实例的 `/api/v1/auth/me` 在 PG 故障时返回 `500`，预期为 `503`；保留该红例。R2 DNS 窄分类修复已有本地 after 回归证据，但新镜像离线/真实 TCP 故障—恢复仍待复验，Docker 恢复尚待用户确认，不能把本地结果写成 Docker 通过。
- **PythonLab 专项与最终验收分开**：可信只读 Docker CLI 连接故障分类已有源码与专用真实 Redis/prefork worker 崩溃重投、原锁自然到期和容器执行/回收证据；未知/权限/非法资源仍 fail closed。专项含合成配置与故障 instrumentation，不证明真实 broker 重试耗尽；最终 worker start/ping 不等于最终 sandbox E2E，Chrome/WebKit、Continue、DAP/TTY 仍需独立验收。入口见 [后端测试说明](../../backend/tests/README.md)。
- **继续 OPEN**：认证双存储失败、cache-loss/旧 refresh 恢复、同 IP 旧 refresh、跨标签与 Cookie 竞态、代理/TTL/存量迁移；XBK 自然键及真实名册；PythonLab 混版本、旧 FAILED 恢复等。本轮没有升级依赖、操作正常栈或补做业务测试。

## 未发布：空库初始化索引顺序（2026-09-09）

- 修复生产镜像在空库首次启动时提前创建 `gin_trgm_ops` 索引、早于 Alembic 创建 `pg_trgm` 扩展而失败的问题。bootstrap 创建独立 metadata 副本，创建表前排除迁移管理的索引，并静态识别迁移原生 SQL 索引；不改变全局 ORM metadata，不执行迁移模块发现索引。
- 修复后继续真实迁移暴露的 XBK 年份类型顺序：空库 legacy 副本保留迁移前整数 year，不提前创建当前学年 check；原 migration 完成转换，正常 ORM 仍保持当前字段类型和约束。
- 保留非空未标版本数据库的拒绝保护、空版本表及完整 Alembic 流程；不新增历史库迁移，不手工补扩展，不操作正常业务库。流程见 [DEPLOY](deploy/DEPLOY.md)，真实失败、回归和模拟启动结果见 [TEST_STATUS](testing/TEST_STATUS.md)。

## 未发布：认证失败反馈与在途身份隔离（2026-09-09）

- 交叉反例补强：新登录等待期间，旧凭据请求的 refresh 先失败不再取消该登录或误报会话过期；当前登录失败/取消后废弃其在途任务，同时保留原身份 token。该门禁仅约束同标签 JS 状态，不承诺 Cookie 或跨标签隔离。

- 退出遇到已识别的 Redis/数据库撤销异常返回 `503` 与 `revocation_status: incomplete`，仍清配置 Cookie；严格 GET 区分故障与缺键，合法 refresh fallback 保留。失败反馈不等于保留凭据已失效。
- 登录先提交 refresh，再重取用户锁重验本次 issuance 才发布 Redis 会话；被并发新登录/退出替换时返回 `409`。避免 DB 提交失败提前改 Redis，不提供跨存储原子性。
- API 客户端为同标签在途请求增加身份世代隔离；旧 refresh/401/退出完成不能改写新身份，退出先清本地 token 并携带原 Bearer 凭据。HttpOnly Cookie 到达顺序、跨标签协调及服务端撤销仍需独立验收。
- 使用白名单源码快照与合成资源演练本地生产镜像构建；不等于生产发布。构建、失败、实例与资源状态统一见 [当前测试状态](testing/TEST_STATUS.md)。

## 未发布：状态恢复与连接撤销补强（2026-09-09）

- PythonLab 启动状态采用 Redis 原值 CAS，发布异常按可信世代核对后补偿；拒绝用缺失/removed journal 加可写 meta 接管既有容器。旧无归属资源需受控迁移，不做自动删除。
- DAP 断连清理增加原值 CAS 与租约保护，避免旧连接覆盖并发终止/新连接状态；不复活过期元信息、不续 TTL，原子接口失败不盲写。
- terminal/DAP 存量连接及管理/课堂 SSE 增加持续会话复查和取消清理；不承诺已在途 IO 撤回，也不覆盖其他 SSE 或数据库角色实时刷新。
- 修复陈旧 IP 绑定误踢已迁移用户，绑定写失败不返回登录成功；AUTH-01 双存储与 AUTH-02 refresh/代理/迁移仍保留为开放风险。
- 本地改动未部署；实际通过项、失败、资源清理和兼容范围统一见 [当前测试状态](testing/TEST_STATUS.md)，上线前提见 [部署指南](deploy/DEPLOY.md)。

## 未发布修复：认证与并发资源归属（2026-09-09）

- 测评首次起测在 PostgreSQL 按配置与用户取得事务 advisory lock，已有会话行锁等待后重读，减少同一学生并发创建重复会话；无 schema 变更。
- XBK 选课写入/恢复/导入与学生、课程删除统一父锁及固定顺序，锁后重验有效关联；批量删除只级联已冻结的父 ID，不改变自然键更名政策。
- 旧 subject 歧义时拒绝解析；退出复用解析器并保留独立 refresh fallback。可选认证复用完整会话 nonce/IP 验证，不再把 raw 身份查找当成有效会话。
- PythonLab 创建/复用/停止增加共享持久文件锁、可信 journal 与 generation/精确资源 ID 验证，旧 stop 不误删被接管资源，结果发布被拒时条件补偿。要求所有 writer 统一版本并共享同一 flock inode；状态发布非 CAS、持续故障遗留及兼容接管仍开放。
- PythonLab terminal/DAP 建连在业务 IO 前校验有效用户及当前 nonce/IP，失败关闭 4401，owner/不存在错误保持；不增加 Cookie 回退或已建连接持续撤销。
- 本批未提交、推送、生产部署或执行正常库迁移；不改真实名册。测试分层与最终状态统一见 `testing/TEST_STATUS.md`。

## 未发布修复：XBK 学生选课表保护密码（2026-09-09）

- 学生选课表导出的课程目录及各班工作表不再使用 WPS 无法以空输入解除的空密码哈希，统一改为管理员指定的非空工作表保护密码；课程代码填写区仍保持可编辑。该保护仅防止误改，不构成 XLSX 文件加密。


## 未发布修复与本地处置：XBK 加载失败及学年迁移（2026-09-09）

- XBK 页面加载失败持续显示错误与重试，统计失败不再显示零，失败列表不伪装空数据，失败刷新不报告成功；请求参数和服务端合同不变。
- 补充整数库与字符串学年代码不兼容的运维说明及隔离迁移回归。经用户明确批准，完成本地真实库备份、隔离恢复核对和仅指定学年迁移；原页面重试、分页及刷新恢复。生产环境尚未迁移，不扩大为生产验收。
- 仅转换获批的 year 字段，不合并学期、不整理或重导名册；临时停写服务已恢复，专属资源已清理，备份保留。不提交推送或生产部署。验证结果、校验失败和边界见 `testing/TEST_STATUS.md`。


## 未发布修复：闭环反证补强（2026-09-09）

- AI 会话 preview 改为按时间及 ID 选择最新问题/答案；最新答案为空时回退最新问题，不回捞更旧非空文本，保留本人 session 聚合、agent membership 和截断合同。本节覆盖下方旧批次“preview 尚未修复”的当时状态。
- 自适应测评首题生成使用逐题保存点，保存点内的供应商或答案 SQL 异常不再回滚整个新会话和已成功题目；保存点前置 flush 失败仍整体回滚、不保留部分提交。保持原占位策略，解析函数抽至纯模块并保留兼容导出。首次并发起测唯一性、占位后的评分体验和真实供应商仍待验。
- PythonLab 其他会话归属查询异常、缺失、畸形及终止中状态采取保守保留，防止将未知误当作无人使用。创建后未登记及检查后被新会话接管的非原子竞态仍已复现、未修复，不能宣称沙箱整体安全。
- XBK 导入/批量与导出、logout 按职责拆分以消除治理阻断，新增故障变异与边界回归；不改变业务规则或放宽治理 baseline。隔离 HTTP 夹具通过外部专用 seed 写测试库旧空值，正常接口仍拒绝非法输入。
- 无模型、迁移或部署配置变更；没有提交、推送、部署、正常服务重启或真实名册操作。实际测试层级、失败证据及剩余范围仅见 `testing/TEST_STATUS.md`。

## 未发布修复：XBK 数据保护、AI 历史与启动预检（2026-09-09）

- XBK：手工/导入共用字段校验，选课检查同期间有效学生及课程（未选仅校验学生）；学生 upsert 在冲突更新处原子核验姓名与非空年级，冲突回滚整批。导出将用户字符串显式写为文本，保留前导零、空白与换行，不把用户文本当作公式。自然键更名策略、父实体并发删除及并发 inserted/updated 计数仍有边界。
- AI 历史：省略 agent 筛选返回本人 session 级历史；混合/NULL agent 不再伪装为单一 agent。前端统一历史请求代次和 user-null 隔离，旧回调不能覆盖新会话，加载失败/只读历史禁发旧上下文。未增加全历史只读入口，旧 preview 最新性尚未修复。
- 用户导入：await 前捕获 input，finally 重置同一输入，支持成功/失败后重选文件。
- PythonLab：强化容器复用配置与资源归属检查、启动异常清理和有限重试；不兼容的运行容器拒绝复用。非原子启动 claim、debug 网络/DAP 与真实 Redis/worker 并未完成验收。
- 迁移预检：静态 AST revision 图及经审核的历史 guard 指纹，读取完整索引目录并保守拒绝不匹配/未知操作；不执行迁移模块，不改数据库。未覆盖目标 public schema 的真实升级与回滚。
- 本地未提交、推送、部署、迁移正常数据库或操作真实名册。验证分层、失败与最终门禁仅见 `testing/TEST_STATUS.md`，不代表全项目或生产验收。

## 未发布修复：公共内容隔离与测评服务端事务互斥（2026-09-08）

- BIZ-01：通用学习内容查询排除 `owner_id` 非空的个人内容，保留管理端全量与现有发布规则；不改变个人导图创建、编辑、删除入口。
- FE-03 服务端补强：真实独立 PostgreSQL 复现答题/交卷错分及重复交卷后，两个写入口增加同会话事务行锁并刷新状态，保持既有重复拒绝响应。前端互斥不再被当作服务端并发保证。
- 无模型或迁移、部署配置改动；未提交、推送或发布。AI 长事务、响应丢失恢复、并发起测和正常环境认证端到端仍不在本批闭环内。后续专项结果优先于下方较早批次的验证边界，数字仅见 `testing/TEST_STATUS.md`。

## 未发布修复：测评结果、个人画像与交卷互斥（2026-09-08）

- BIZ-02：整卷结果仅允许本人已提交/已评分会话，进行中及其他非结果状态返回 422；保留单题合法反馈和终态答案、解析。
- BIZ-03：个人画像详情同时校验个人类型与本人归属，拒绝 group/class 数字碰撞；原 403/404 及管理端合法入口不变。
- FE-03：单题/整卷共享同步锁，旧确认回调也校验；保存中、未保存或失败草稿阻止交卷，保留内存草稿并支持显式重试。整卷成功后的结果加载重试不重复提交。倒计时仍只提示，不新增自动交卷或服务端超时规则。
- 后端增加真实路由/SQLite ORM 隔离回归，前端增加真实组件/合成 API 交互回归。未改 schema、认证或 XBK，未迁移、提交、推送或部署。真实 PG 并发、浏览器完整 E2E、跨标签页及超时写入歧义未验收，不能当作全项目完成。合同见 [API](../development/API.md) 与 [ASSESSMENT](../features/ASSESSMENT.md)，实际红绿及集成结果仅见 [TEST_STATUS](testing/TEST_STATUS.md)。

## 未发布修复：测评开放时间窗起测限制（2026-09-08）

- 修复 BIZ-04：直接请求起测接口不再绕过教师设置的开放窗创建新会话。列表与新建共用 timezone-aware 判断，开始、结束时刻仍可起测；窗外在查题、AI 和 session/answer 写入前返回明确的 422。
- 保留本人同配置进行中会话的跨截止续答；窗口改到未来也不重置已有答案或开始时间。配置禁用仍优先拒绝，其他用户/配置或非进行中历史会话不享有豁免；未添加进行中唯一约束，不宣称解决并发起测。
- 新增隔离 HTTP/JWT/ORM 维护回归，仅补全旧测试配置 mock 的已有时间窗字段。未改 schema、依赖、前端、认证或 XBK；机制见 [ASSESSMENT](../features/ASSESSMENT.md#会话与答题边界)，输入/错误合同见 [API](../development/API.md)。红绿对照、扩展回归及未覆盖范围只见 [TEST_STATUS](testing/TEST_STATUS.md)。仅本地未发布修复，未提交、推送或部署。

## 未发布修复：退出 refresh 撤销闭环（2026-09-08）

- 修复 AUTH-01 的限定缺口：access 缺失、过期或无法证明当前 nonce 时，可以有效 refresh Cookie 授权退出；在用户锁后重验 refresh，避免旧凭据撤销新登录。有效当前 access 优先，不连带撤销冲突 Cookie 的另一身份。
- nonce 缓存轮换异常不再回滚 refresh 撤销，仍尝试提交数据库；保留数据库失败的告警/回滚与配置 Cookie 清理。缓存故障仍可能保留旧 access 能力，数据库提交失败仍可能保留 refresh 能力，不宣称双存储原子撤销。
- 新增隔离 HTTP/JWT/ORM 维护回归与开发依赖 `aiosqlite`，未改生产依赖、schema、登录页或 XBK。长期机制与 API 合同分别见 [AUTH](../features/AUTH.md)、[API](../development/API.md)；修复前/后验证、门禁及未覆盖范围只见 [TEST_STATUS](testing/TEST_STATUS.md)。仅本地未发布修复，未提交、推送或部署。

## 未发布修复：身份切换业务缓存隔离（2026-09-08）

- 修复 FE-04：会话失效后在同一标签页软跳转登录，下一身份可能沿用上一身份的 fresh 用户列表缓存。按身份/权限范围分配独立 QueryClient，并同时重建业务查询子树，避免旧 observer、局部状态和迟到缓存回调跨身份复用。
- 主动退出先清本地身份与查询作用域；普通同身份资料刷新保留缓存。前端隔离本身不承担后端撤销，也不回滚已经发出的服务端写操作；AUTH-01 的服务端修复另见上方独立记录。
- 同步[认证 owner](../features/AUTH.md)与维护回归；实际验证和未覆盖范围只维护于 [TEST_STATUS](testing/TEST_STATUS.md)。本项不改登录页视觉、目的地规则、后端接口或数据库结构；未提交、部署或发布镜像。

## 未发布修复：校本课本地审查（2026-09-08）

- 实际名单复核发现班内学号重复会导致导入末行覆盖；新增整份重复自然键、混合年份/学期、现存学生身份冲突拦截，跳过错误行不能绕过。已有误导入数据未自动删除或重建，修复前需核对学校唯一编号规则并备份。
- 修复登录按角色强制跳后台：所有角色默认进入首页，保留安全的显式站内目的地与原权限守卫；登录页视觉不变。
- 移除校本课页面“校本课管理”标题，保留筛选、统计与操作按钮。
- 修复导入默认年份/学期未传递、预检与提交状态不一致、过期响应、同文件重选及重复提交；完善文件解析、容量/字段校验和回滚。
- 修复年级/班级/跨学期筛选统计、软删除关联清理、唯一键冲突、共享课程删除保护和导出空数据/长学号问题；跨年级同名班级按 `(grade, class_name)` 区分。
- 课程统计改用课程目录主表，保留 0 人课程并排除删除课程和孤立代码；课程容量按课程所属年级的班级数计算，班级筛选后摘要与课程统计保持同一作用域。
- XBK 学年统一为 `YYYY-YYYY`，兼容四位起始年份输入；三张表的 `year` 迁移为 `VARCHAR(9)` 并增加连续学年 CHECK 约束。Excel 标准列名改为“学年”，旧“年份”/`year` 仍可导入。
- 统一空代码与“未选”标记的统计、列表和导出口径，修正分析弹窗未选明细误用休学接口；防止过期分析响应覆盖新筛选。
- 普通 `selections` / `course_results` 导出对有效学生按同学年、同学期名册匹配班级，筛选并输出名册当前年级；仅在缺少有效名册的孤立选课记录上回退使用选课年级快照，避免页面、统计与导出口径不一致。
- 导出弹窗不再静默代入学年/学期，也不再重复填写标题起止年份；提交期间锁定条件与关闭操作，防止重复下载请求。
- 补充前后端回归及显式启用的隔离 HTTP 验证；结果和未覆盖范围见 [TEST_STATUS.md](testing/TEST_STATUS.md)。
- 本轮仅在本地隔离环境验证，未提交、推送、发布镜像或访问远端；数据库结构变化由 `20260908_0001_xbk_academic_year` Alembic migration 管理。

## 📚 历史版本归档

v1.5.x 早期版本和 hotfix 记录已归档到：
[archive/RELEASE_NOTES_v1.5.x.md](archive/RELEASE_NOTES_v1.5.x.md)

当前发布事实和运维变更继续在本文维护。

---

## 未发布 v1.6.0（更新至 2026-07-23）

当前源码版本继续使用 `1.6.0`。截至 2026-07-14，远端 Git 尚无 `v1.6.0` tag；
Docker Hub 六个正式 `1.6.0` amd64 镜像已通过手工发布链推送，并由
`release-set.txt` 复核 Compose 引用和远端 manifest digest。`latest` 未更新，
本轮也未执行正式生产部署或数据库备份。2026-06-15 早期候选内容已合并到本节，
下方只保留日期入口，不能视为第二个发布版本。

- 修复 `scripts/rollback.sh` 在函数外使用 `local` 导致回滚入口运行即失败的问题；
  Compose 检查、备份和 downgrade 现在统一使用显式 `ENV_FILE` / `COMPOSE_FILE`，
  并增加隔离 Docker 桩合同测试。默认回滚先记录原运行状态并停止 `backend`、
  `typst-worker`、`pythonlab-worker` 建立无写入窗口，再备份和 downgrade；备份失败
  绝不降级，并只重启原先运行的写服务。停止写服务失败也采用同一恢复保护，不会继续
  备份或降级。恢复成功时保留原操作失败状态，恢复失败时返回恢复状态并明确要求人工
  处理。`--no-backup` 仍是显式危险选项。downgrade 使用一次性 backend 容器，完成后
  写服务保持停止等待旧 release-set。
- 修复 AI 智能体长回答被前后端固定 120 秒总时长截断的问题；前端改为空闲超时并合并
  高频分片，后端依赖 HTTPX 读取空闲超时，同时识别连接提前结束和 Dify 部分断流。
  OpenAI 兼容 provider 遇到 `finish_reason=length`、`max_tokens` 或
  `max_output_tokens` 时返回 `output_limit_reached`，保留已生成文本并明确提示模型
  输出长度上限；内容策略、工具调用、上下文窗口超限和未知结束原因也不会再误报完整
  成功。DeepSeek `/anthropic` base URL 现在会正确选择 Anthropic provider，并读取
  Anthropic `message_delta.stop_reason`。历史上下文限制为 20 条 user/assistant 消息，
  当前问题由后端保证只追加一次，停用智能体在连接 Provider 前拒绝，熔断按智能体隔离。
  前端切换智能体或会话时静默取消旧流，截断终止包不再污染新会话；部分回答在错误时
  只保留于界面，不作为完整记录自动落库。专项回归为后端 `61 passed`、前端 AIAgents
  `17 passed`；后端停用拦截同时覆盖流式和阻塞式智能体入口。Docker 开发栈本机
  Provider stub 完整接收 `80000` 字符并清理临时智能体。
  真实 DeepSeek 长流测试收到 `7063` 个字符后以
  `max_tokens` 正常终止，部分内容和明确提示均保留。
- 扩展应用日志脱敏，PostgreSQL、SQLAlchemy async、Redis 和 AMQP/Celery 连接串中的
  URL userinfo 密码现在统一替换为 `<redacted>`，同时保留 scheme、用户名、主机和路径
  供排错；只有用户名、没有密码的公开 URL 不会被误改。
- 生产和开发 Compose 现在把 `${TIMEZONE:-Asia/Shanghai}` 同时传给 backend、Typst
  worker 和 PythonLab worker 的 `TIMEZONE`/`TZ`；开发 PostgreSQL 的 `TZ`、`PGTZ`
  和启动参数也使用同一值，避免容器时区与应用业务日期计算漂移。
- Vitest 默认范围新增 `src/lib/**/*.test.{ts,tsx}`，旧 Mindmap 运行时的生产禁用边界
  测试不再需要显式路径才能执行。
- 修复 `frontend/package-lock.json` 丢失 `@emnapi/core`、`@emnapi/runtime` 和
  `@emnapi/wasi-threads` 可选 peer 条目导致全新环境 `npm ci` 拒绝安装的问题；
  lockfile 已按当前 npm 重新归一化，并通过真实 clean install、全量测试和生产构建。
- 修复浏览器 UI smoke 在目标输入框或管理按钮不存在时仍把 `skip-*` 动作计为
  `PASS` 的问题；未执行到预期动作现在记录为 `WARN` 并进入 skip 汇总。
- 修复 `/admin/assessment/editor/new` 使用静态路由时 `useParams().id` 为空、页面却
  永久显示加载动画的问题；参数缺失现在正确进入新建模式，并增加静态路由组件回归。
  Docker 开发模式 UI smoke 已从 `12 PASS / 1 WARN` 提升为
  `13 PASS / 0 WARN / 0 FAIL`。
- 修复 `GET /ai-agents/conversations` 在存在真实会话数据时因响应 schema 错配返回
  `500` 的问题；会话列表和详情模型现在与 SQL 服务及前端合同一致，详情不再静默丢弃
  `session_id`、用户/智能体字段和响应时间。拆分前的旧导入路径改为指向
  `schemas/agents/conversation.py` 的兼容别名，避免同名模型再次漂移。
- 修复 AI 使用记录列表响应模型静默裁掉 `page`、`page_size` 和 `total_pages` 的
  问题；后端现在完整保留服务分页结果，与前端分页类型一致。
- 修复 `prod-smoke` 在 `ui-results.json` 缺失时仍可能写入成功汇总并返回 0 的问题；
  当前会把 `ui-smoke` 步骤、总状态和退出码统一标记为失败，并生成失败报告。
- 修复正式部署只在拉取前校验 registry tag 的时间差风险；`pull-up/deploy` 现在会在
  拉取后逐个核对本地 `RepoDigests`，`up-no-build` 也会拒绝启动与 release-set
  digest 不一致的同标签镜像。清单逻辑名称必须与仓库名对应，所有已设置版本变量必须
  一致；正式发布只拉六个业务镜像，并以 `--pull never` 阻止 PostgreSQL、Redis 或其他
  服务被隐式更新。
- Docker Hub 正式标签发布增加 current-main commit 守卫和 workflow concurrency，
  非 `main` ref、落后于 `origin/main` 的提交或并发发布不能再覆盖同一版本标签。
- 生产 smoke 的免授权隔离判断改为精确的 `wangsh_sim` Compose 项目和本机回环地址，
  相似项目前缀或外部 origin 不再被误认为隔离环境。
- 部署健康门禁新增首页可用性检查，详细健康报告同时覆盖 `frontend`、`gateway`、
  PostgreSQL、Redis 和两个 worker；正式 `deploy` 会等待详细健康门禁通过，避免 API
  正常但前端或异步任务不可用时误报部署成功。API 现在必须同时满足 HTTP 2xx、有效
  JSON 和顶层唯一 `status=healthy`；宿主不新增 Python 依赖，JSON 由 backend 容器
  标准库校验，两份 Compose backend healthcheck 采用相同状态语义。
- 修复嵌入式思维导图保存按钮依赖不存在的 `_mmData/postMessage` 协议的问题；当前从
  同源 iframe 的 `takeOverAppMethods` 读取最新树后保存，富文本节点会转换为纯文本
  Markdown，首个一级标题不再重复生成同名根节点；独立窗口保存按钮也复用同一运行时
  数据源。课堂浮窗手动刷新增加学生作用域保护，旧账号的迟到请求不会解除新账号刷新锁。
- 学生问题链结果页移除未参与任何数据计算的 1/3/5 分钟按钮，避免把无效状态展示为
  可用分析控制。
- 文档和历史脚本完成一轮低风险收口：无真实引用的 redirect、重复历史摘要和长篇实施
  正文的长期结论已迁入 owner；SSE 恢复资料和学习平台设计取舍保留为精简 archive。5 个失效或重复
  seed 执行壳已删除；AI/Agents 正式课程内容迁移源和未完成审计的索引 SQL 继续保留。
- 修复 `.gitignore` 将整个 `frontend/public/` 当作 Gatsby 产物忽略的问题；favicon
  等正式源码资产继续跟踪，Pyodide 和 Mindmap 本地运行时使用独立目录规则。Mindmap
  中的字体、SVG、图片和打包 JS 保留在开发机但不进入 Git 或 Docker 构建上下文；
  Vite 生产构建还会删除复制到输出目录的本地副本。生产 Caddy 对 `/mindmap-demo`
  明确返回 `404 + no-store`，避免缺失资源进入 SPA fallback。恢复生产编辑器前需要
  补充可复现的资源准备流程。生产前端同步阻止用户端和管理端新建/编辑，避免生成无法
  再编辑的记录；已有导图仍可通过内置查看器只读预览。Caddy 将 `/favicon.svg` 纳入
  真实静态文件匹配，`test:scripts` 和 `build:check` 分别增加 Git 静态资产白名单与
  最终构建产物合同。
- 修复普通 admin/teacher 从无显式 redirect 的登录页进入时，角色跳转先执行、随后又被
  登录页认证 effect 覆盖为 `/home` 的竞态；登录提交和已登录恢复现在复用同一跳转
  规则，并增加 super_admin/admin/teacher/student 四角色组件回归。
- 修复 GroupDiscussion 同日同班同组并发创建触发唯一约束时直接失败的问题；当前会
  rollback 并复用另一请求已提交的会话；切组路径会在 rollback 前保存旧成员会话 ID，
  不再读取过期 ORM 对象，避免 `MissingGreenlet` 500，管理员和学生路径均有回归覆盖。
  创建和默认列表还统一使用 `TIMEZONE` 配置的业务日期；`joined_at`、冷却和
  recent-hours 仍使用 UTC，无效 IANA 时区在配置加载期直接失败。批量删除接口现在
  返回数据库实际删除的会话数量，不再把 `deleted` 序列化为 `null`。
- 应用标准 logging 和 Loguru 在最终 sink 前统一脱敏 query、JSON/Python 字典字段、
  Authorization/Proxy-Authorization、Cookie 和异常链中的凭据；多行、未闭合引号和
  超长输入使用有界扫描，避免泄漏和正则回溯。FastAPI 与 Celery worker 入口均安装
  同一脱敏器，普通 bearer/cookie 说明文本保持不变。
- 修复 Assessment 群体画像按配置统计全部班级 graded session 的问题；当前统计同时
  限定目标班级学生 ID，避免跨班成绩混入画像；公共 `generate_profile` 回归使用真实
  PostgreSQL 临时 schema 覆盖班级、角色、删除状态和 session 状态隔离。
- 修复管理员从 `/task-analysis/*` 等受保护深链进入登录页后被角色默认落点覆盖的问题；
  只有缺省 `/home` 才应用角色默认页，合法显式 redirect 会保留路径和查询参数。
- 修复统一“姓名 + 学号”登录遇到同名用户时在校验学号前抛
  `MultipleResultsFound`、返回 HTTP 500 的问题；认证现在先取得候选账号，再用学号
  或历史密码唯一消歧，无法唯一匹配时按认证失败处理。
- 修复 React StrictMode 开发模式下认证初始化请求被首次 effect cleanup 取消后，
  `initialFetchRef` 阻止重新探测，导致后台直达页面永久停留在 loading 的问题；
  新增真实 `AuthProvider + React.StrictMode` 回归测试。
- 修复 Markmap 预览 SVG 使用百分比 `width/height` 时 D3 读取 `SVGLength.value`
  抛出运行时错误的问题；SVG 属性改用容器实际像素尺寸，CSS 继续保持响应式填充。
- 修复应用启动时覆盖管理员自定义 Markdown 样式的问题：默认 `terminal`、`paper`、
  `minimal` 样式现在只在缺失时创建，已有记录的标题、CSS 内容和排序保持不变；
  管理端 upsert/update API 行为不变。
- 修复用户管理 P0 越权：普通 admin 不能通过创建或导入生成 admin/super_admin，
  也不能通过导入更新已有高权限账号；批量删除会锁定并完整核对目标，
  缺失目标或包含 admin/super_admin 时整批拒绝，避免部分删除和高权限账号失效。
- 课堂活动和计划增加严格班级隔离与教师对象所有权校验，学生 active plan 不再返回正确答案。
- refresh token 改为数据库行锁下的原子轮换；停用/删除用户不可刷新，服务端会话缺失时旧 access token 不再自举。
- Redis SSE 订阅增加 listener ready 握手和按频道发布锁，消除首事件竞态；listener 超时改为按频道降级，并确保取消订阅失败时仍关闭连接。
- Logout 改为基础设施故障下的客户端强制登出：数据库或 Redis 撤销失败会告警并尽力回滚，但响应仍清除 access/refresh Cookie。
- IT 游戏上传改为分块临时文件、增量 SHA256、原子重命名与数据库失败补偿，并增加
  `IT_GAME_MAX_UPLOAD_BYTES`。上传会在元数据二次 flush 后 commit，commit 成功后
  才 refresh ORM 对象，以加载数据库时间戳供响应序列化使用；commit 前或 commit
  失败仍会回滚并清理文件，commit 后的 refresh 失败不会删除已提交记录对应的文件。
  更新接口拒绝空分类；下载在记日志前持有稳定文件描述符，保留 Range 能力并避免
  并发删除导致已开始的下载失败，审计 IP 复用统一的可信代理头解析。
- 公开文章列表缓存键纳入搜索参数 `q`；不同搜索词以及有、无搜索词的列表使用独立
  缓存，避免搜索结果与普通列表或其他搜索结果串用。
- 前端增加真实角色路由守卫、认证超时取消和 IT 游戏 Query key 治理。
- 课堂管理 SSE 修复静态路由被动态活动 ID 路由抢占的问题；管理员改为订阅全局频道，学生班级频道统一规范化。
- 课堂活动严格限定仅草稿可编辑/删除；并发重复答题统一回滚为业务错误。
- 课堂计划推进改为活动、item、计划状态同事务提交，失败不再吞错或继续推进，SSE/分析延迟到提交后执行。
- 同一教师的活动启动/重启通过教师行锁串行化，重启也会自动结束其他 active 活动，避免并发产生多个进行中活动。
- 课堂填空分析改为 Celery 后台任务；SSE 全部发布后再入队，终态重复投递幂等，异常重试可接管遗留 `running` 状态，旧轮次结果不会覆盖已重启的新轮次。
- 课堂填空分析在所有候选提供商失败时先提交 `failed` 状态和错误摘要，再抛出专用
  可重试异常；Celery 重试可重新接管 `failed`，而未配置可用智能体仍作为配置失败
  直接结束，避免无意义重试。
- 课堂分析任务发布增加 broker 侧有限重试，最终入队失败会写入可观察的 `failed`
  状态并允许教师手工重投；课堂 Celery 任务启用 late ack 和 worker-lost 重投，
  redelivery 可接管遗留 `running` 状态。
- 多进程自动结束改为逐条 `FOR UPDATE SKIP LOCKED` 认领，已被其他进程结束的候选
  会幂等跳过；活动 restart 同时清空旧分析上下文和更新时间。
- 课堂班级迁移会锁定活动表、清洗历史班级空格，并在仍有 active 活动时阻断升级；部署文档要求维护窗口停写后再执行迁移。
- 新增 Python 物理行数与 AST 圈复杂度 ratchet，19 个历史超长文件和历史复杂函数
  使用逐项 baseline；CI 阻止 ceiling 放宽、一对多债务迁移和超期例外。
- 前端清零 `no-floating-promises`，CSS token 检查覆盖源码、Tailwind 映射、注释和
  多行引用；相关脚本测试与 token 门禁已接入 CI。
- PythonLab PR 门禁改为在 runner 启动当前 PR 的 PostgreSQL、Redis、backend、
  Celery、sandbox 和 Vite；使用隔离临时账号，fork PR 也可执行，并通过 Playwright
  Chromium 覆盖真实 pointer-click 的基础调试和多断点 Continue。
- PythonLab PR 门禁等待失败和汇总失败日志统一通过 prod-smoke 脱敏器，只发布最后
  200 行；实时 smoke 也统一通过 `redact_exec.py`。脱敏覆盖 query/userinfo、
  Bearer/Basic、JSON/字典、Cookie、password、api_key、已知环境值和跨行凭据，
  同时保留普通退出码及 shell 兼容的信号退出码。
- prod-smoke 子进程改用环境白名单，不再继承宿主无关 API token；子脚本 JSON 报告
  递归清洗后以 `0600` 重写，证据目录使用 `0700`，Phase C 每轮日志落盘前先脱敏。
- 删除小组讨论 smoke 中的硬编码管理员密码候选，仅接受显式环境注入。历史候选曾与
  本地有效凭据重合，因此发布前必须轮换对应管理员凭据。
- 镜像发布强制 tag 与源码版本一致，默认不推广 `latest`；六个镜像先推 staging，
  推广后生成已验证 digest 清单 `release-set.txt`。正式部署会强制校验版本、六镜像、
  Compose 引用和 registry manifest digest。Registry 不支持跨仓库事务，但不完整
  release-set 不能进入 `compose pull/up`。
- Bundle 门禁改为读取 Vite manifest 静态/动态 import 图；移除会造成依赖倒置的
  Monaco 手工 vendor 分包，Entry 降至 `0.96 MB`，重型 Monaco/ECharts 保持按需加载。
- 修复课堂计划行锁刷新后的异步关系加载：计划和 item 的
  `populate_existing` 查询保留 eager-load 选项，避免写操作访问 `items/activity`
  时触发 SQLAlchemy `MissingGreenlet`；新增独立临时 schema 的真实 AsyncSession
  回归测试。
- 手动镜像发布调用通用 CI 时也会相对 `origin/main` 执行 Python governance
  防放宽比较；已有 exception 禁止滚动延长到期日。
- `up-no-build` 现在同样强制验证 `release-set.txt`；Monaco worker 配置变化会
  触发 PythonLab PR 真实浏览器门禁。
- 登录流程增加可取消 epoch gate，logout、组件卸载或会话过期会使迟到的 login
  响应失效，避免显式退出后恢复会话。
- 修复 legacy、热点和学生问题链三张独立分析表出现相同整数主键时，兼容删除可能
  命中错误类型记录的问题；legacy 路由不再跨表猜 ID，typed 删除仅清理唯一快照
  匹配的 legacy 双写副本。
- Bundle budget 将 `build/pyodide/` 的生产 JavaScript 纳入 Deferred 和总量，
  修正此前约 `1.22 MB` 的漏算。
- 修复本地生产模拟被正式 release-set 门禁误阻断的问题：`simulate` 会在清理旧模拟
  数据前验证全部本地镜像，不再调用 `up-no-build`；可通过
  `SIM_RUN_PROD_SMOKE=true` 在同一进程安全传递临时凭据执行完整 smoke，并通过
  `SIM_CLEANUP=true` 保证成功或失败后清理隔离模拟栈。正式部署门禁保持不变。
- 前端 Docker 构建上下文排除生成型 `public/pyodide`，避免宿主机绝对符号链接或
  陈旧运行时覆盖容器内资产；生产 Dockerfile 同时在 `npm ci` 缓存层校验完整且
  非空的 Pyodide 核心文件和 PDF worker，Vite 复制失败或最终 worker 缺失时构建会
  立即失败。
- 后端生产构建增加可配置 Debian 主仓库和 security 镜像源；Compose 默认使用已验证
  的阿里云镜像，避免 amd64 Typst 大字体包在官方源直连下长时间重试，部署方仍可通过
  环境变量切回官方源。
- 新增 `20260711_0001_add_assessment_availability` migration，正式补齐 assessment
  模型历史上遗漏的 7 个字段：配置开放时间 2 个、题目自适应字段 2 个、答案知识点/
  尝试序号/自适应标记 3 个。
- 新增 `20260711_0002_restore_legacy_baseline_indexes` migration，幂等恢复空库
  legacy baseline 路径可能跳过的 3 个 XBK `grade` 索引和 2 个文章样式索引。
- `prod-smoke` 的 Docker Compose 命令继承 simulate 的 project、env file 和 compose
  file，日志与容器检查不再回落到默认 project。
- simulate 动态沙箱清理严格限定 `wangsh_sim_*`，并在删除后复查残留；默认开发
  `pythonlab_*` 沙箱不在匹配范围内。
- 用户单体 update/delete 在鉴权和修改前锁定目标行；普通 admin 的列表、详情和统计
  仅暴露 student/teacher（本人详情除外），不能通过筛选探测高权限账号。
- PythonLab PR 浏览器 smoke 的密码仅通过环境变量传入，不再出现在命令参数中。
- Pyodide 复制增加 npm 包版本 marker、完整性检查和临时目录原子替换；旧版本、缺文件
  或空文件均不会被误判为可复用运行时。
- `.env.example` 明确 Redis 服务名、PythonLab 容器 namespace、Compose 宿主机
  workspace bind mount 与 DockerProvider 显式回退路径之间的合同。
- assessment repair migration 会统一已有字段的类型、默认值和 nullable 约束，保守
  downgrade 不删除来源不明的历史字段；Alembic online 环境会在升级前将旧式
  `alembic_version VARCHAR(32)` 扩容为 `VARCHAR(64)`。
- `prod-smoke` 不再把 refresh 响应中的有效 access/refresh token 写入 JSON 报告；
  用户批量删除 API 与前端统一为 `{ "user_ids": [...] }` 请求体。
- `prod-smoke` 的步骤日志和 Compose 服务日志增加统一敏感信息脱敏，URL query
  token、Bearer token 和 JSON access/refresh token 不再进入本地测试证据。
- `simulate` 增加主机级互斥锁，避免并发运行共享 `wangsh_sim` 资源；Pyodide 目录替换
  增加失败恢复，UI smoke 仅通过真实 NotFound 页面标记判定 404，不再扫描整页业务文本。

### 验证结果

当前测试事实、覆盖矩阵、证据路径和待执行远端门禁统一维护在
[testing/TEST_STATUS.md](testing/TEST_STATUS.md)，本页不再复制会持续变化的测试数字。
验证范围包括后端、前端、脚本、Workflow、Compose、Alembic、Python governance
和隔离生产模拟；每次发布前都必须从最终提交重新执行，不得把阶段快照外推为正式发布结果。
数据库结构变更以 `20260711_0002_restore_legacy_baseline_indexes` 为当前迁移 head，
具体迁移结果和待执行门禁仍以测试状态文档为准。

## v1.6.0 早期候选快照（2026-06-15）

该未远端发布快照的安全、性能、前后端和迁移内容已合并到上方“未发布 v1.6.0”。
当前验收事实统一见 [testing/TEST_STATUS.md](testing/TEST_STATUS.md)；本节只保留日期
入口，避免同一版本维护两份发布正文。

---

## v1.5.16（2026-05-28）

### 1. 变更范围

**小组讨论管理修复**：
- 新增管理员会话 Excel 导出接口，并限制默认最多导出 5000 条、上限 10000 条，避免大范围导出拖慢后端。
- 管理端会话列表保留单一关键词筛选，导出与列表使用同一筛选条件。
- 前端导出请求改为复用项目 API 客户端，保持鉴权与刷新行为一致。

**清理项**：
- 移除临时 Typst quick Dockerfile 和 mock 分析数据 seed 脚本，避免临时构建路径和演示数据误入生产流程。

### 2. 配置影响

- `.env.example`、Compose、前端 package 版本默认值同步到 `1.5.16`。
- 生产镜像默认使用 Docker Hub 短名称 `shuhao07/*:1.5.16`，不再渲染为 `docker.io/shuhao07/*`。
- PythonLab sandbox 默认镜像同步到 `shuhao07/pythonlab-sandbox:1.5.16`。

### 3. 验证

```bash
npm run type-check
pytest -q tests/ai_agents/test_usage_filter_options_schema.py tests/system/test_feature_flags.py tests/system/test_metrics.py tests/group_discussion/test_group_discussion_session_creation.py
docker compose --env-file .env.example -f docker-compose.yml config --quiet
git diff --check
```

### 4. 镜像与生产模拟

```bash
ENV_FILE=.env COMPOSE_FILE=docker-compose.yml DOCKER_DEFAULT_PLATFORM=linux/amd64 bash scripts/deploy.sh build-amd64
bash scripts/deploy.sh simulate
```

已验证镜像：
- `shuhao07/wangsh-backend:1.5.16`
- `shuhao07/wangsh-frontend:1.5.16`
- `shuhao07/wangsh-gateway:1.5.16`
- `shuhao07/wangsh-typst-worker:1.5.16`
- `shuhao07/wangsh-pythonlab-worker:1.5.16`
- `shuhao07/pythonlab-sandbox:1.5.16`

本地生产模拟验证通过：
- `http://localhost:6608/api/health` 返回 200。
- 登录、`/api/v1/auth/me`、`/api/v1/users/stats`、`/api/v1/system/overview` 返回 200。
- 小组讨论 admin sessions 返回 200，空范围 Excel 导出返回 200。
- `typst-worker` 内 `typst 0.14.2` 可用，`pythonlab-worker` 内 Docker CLI 可用。

## v1.5.10（2026-05-09）

### 1. 变更范围

**关键修复** — v1.5.9 的 backend 镜像遗漏了 ML/AI/Agents 章节 API 后端代码，因为相关文件未 commit 到 Git，用户从 GitHub 构建时拿不到。v1.5.10 将所有遗漏文件纳入版本控制并重做镜像。

**后端新增**：
- ML/AI/Agents 章节 CRUD API（`learning/chapters.py`）：`GET/PUT/DELETE /learning/chapters/{module_key}/{slug}`
- `LearningChapter` 模型（`sys_learning_chapters` 表）
- Alembic migration `20260509_lrn_chapters`（建表 `sys_learning_chapters`）

**Alembic 修复**：
- 重命名 revision `20260503_0002_learning_content_items` → `20260503_0002_learning_content`（36→30 字符，解决 VARCHAR(32) 超限）

**前端**：Phase 0-9 全面优化（与 v1.5.9 相同内容，因 v1.5.9 未 commit 到 Git）

### 2. 配置影响

- 所有部署文件版本引用统一升级到 `1.5.10`
- `IMAGE_TAG=1.5.10` 为新的默认值
- PythonLab sandbox 镜像同步到 `shuhao07/pythonlab-sandbox:1.5.10`

### 3. 构建与部署

```bash
git fetch origin claude/inspiring-gould-f407ac && git merge origin/claude/inspiring-gould-f407ac
./build_images.sh 1.5.10
docker compose push
IMAGE_TAG=1.5.10 docker compose pull && IMAGE_TAG=1.5.10 docker compose up -d
curl http://wangsh.cn:6608/api/v1/health
```

### 4. Docker Hub 备选镜像源

如直连超时，使用 `docker.1ms.run`：
```bash
docker pull docker.1ms.run/shuhao07/wangsh-backend:1.5.10
docker tag docker.1ms.run/shuhao07/wangsh-backend:1.5.10 shuhao07/wangsh-backend:1.5.10
# 同理拉取其他 6 个镜像
```

### 5. 回滚

```bash
IMAGE_TAG=1.5.9 docker compose up -d
```

---
