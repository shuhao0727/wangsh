# 当前测试状态

> 状态：active
> Owner：testing
> 当前版本：生产正式 2.2.0（2026-10-26 20:52 部署）；2.2.1 待发布
> 最近更新：2026-10-28
> 说明：本文件是当前测试事实的唯一汇总入口；阶段报告只引用本页，不复制新基线。

## 2026-10-28 S2 / S3 / S4 / S6 分级验证

按 [S2~S7 执行计划 v4](../plans/2026-10-28-S2-S7-EXECUTION-PLAN-V4.md) 与
[S4~S7 条目清单](../plans/2026-10-28-S4-S7-ITEM-MANIFEST.md) 执行。
规则：一次性环境隔离 + 基线对照 + 主控复核关键结论。

### S2 崩溃级（3 项通过）

- **前置 S2-0：** `wangsh-frontend:dev` 原为 2026-10-22 的 Caddy 生产形态（EXPOSE 80 / `caddy run`），
  已用 `docker build -f frontend/Dockerfile.dev --target development` 重建为开发形态
  （EXPOSE 6608 / `npx vite --mode development`，vite 8.0.3）。非测试源码与 HEAD 零差异（621 文件比对）。
- **S2-1 空库 bootstrap（`312f387`），两条路径均通过：**
  - 路径 A（`check_migration_state` → `bootstrap_db --initial-only` → `alembic upgrade head` → `bootstrap_db`）：
    四步全 rc=0，50 条迁移。**55 条 = 54 BASE TABLE + 1 VIEW**、视图 14 列、49 序列、5 个关键索引、单 head `20261026_0001`。
  - 路径 B（裸 `alembic upgrade head`）：同样全通过，表集合 `IDENTICAL_TABLE_SETS`、视图定义逐字相同。
  - **结论：`DEPLOY.md:871`「不要在空库裸跑 Alembic（历史 revision 标识超 32 字符）」需订正**——
    `alembic_compat` 已自动扩到 `VARCHAR(64)`，最长 revision 47 字符，实测两路列宽均 64，无截断。
    同段「当前 head 20261020_0001_knn_collection」也已过时（2026-10-28 已订正为 `20261026_0001`）。
  - **形态差异（待评估）：** 路径 A 的 `alembic_version` **无主键**（`bootstrap_db.py:219` 用
    `CREATE TABLE IF NOT EXISTS` 不带 PRIMARY KEY），路径 B 有 `alembic_version_pkc`；索引数 224 vs 225。
    功能都能跑通，但生产路径 A 的版本表缺唯一约束。
  - **部署必经步骤（不在 S2-1 范围）：** bootstrap 后 `auth_authority` 闸门为 CLOSED，前后台全部 503。
    这是有意设计（模型注释 `Migration starts CLOSED; never auto-open`），开通需走
    `backend/app/api/endpoints/auth/cutover.py` 且要求四项运维冻结证据。S2-1 断言不含 auth 开通。
- **S2-2 前端回退（`cba3c0e`）：** `git merge-base --is-ancestor` 返回 ok，判为「由 S1-7 覆盖」，不重复执行。
  **未验证前提：** S1-7 当时用的前端产物未记录；若用的是旧 `frontend:dev`（10-22 生产镜像），
  其 `pageerror=0` 证明的是 10-22 代码而非 HEAD。该前提无法回溯确认。
- **S2-3 dev 镜像：** `alembic heads` 单 head 正确；两 worker `celery ready` 且周期任务 succeeded；
  frontend:dev 四项形态断言全中并实跑 vite（`/`、`/@vite/client`、`/src/main.tsx` 均 200）。
  **但三个后端 `:dev` 镜像落后 HEAD 一个提交**（缺 `b129572` 的 CORS `NoDecode`），
  用 `.env.dev` 不挂载源码启动会 `SettingsError`；本次验证靠 `-e 'CORS_ORIGINS=[...]'` 变通跑通，
  验的是镜像内容而非最终形态。**S3/S4 若引用这些镜像需先重建。**

### S3 阻断级（5 项通过 + 1 项判失效）

- **S3-1 KNN HTTP UUID（`b2d97a7`）通过。** 前置 `window.isSecureContext === false` 成立
  （Caddy 反代 `http://knn.test:8443` + `header_up Host localhost`，未改 `vite.config.ts`/hosts）。
  提交流程 201 且 `pageerror=0`；`request_id` 为合法 UUID v4 并与库内落盘一致；
  **首包人为 503 后二次提交，两次 body 逐字节相同、`request_id` 完全相同**；
  负向（抹掉 `randomUUID`+`getRandomValues`）出现「当前浏览器暂不支持提交…本页填写内容已保留」
  且 `/submissions` 请求数为 0。后端契约核实：`request_id: UUID` + `uq_knn_submission_request` + `payload_hash`。
- **S3-2 评分智能体空值（`7a4af95`）通过。** 空串时 `/health` 200 且 `status=healthy`、
  `RestartCount=0`；评分端点返回 **503**「尚未配置AI评分智能体」；负向 `abc` 时 `ExitCode=1` +
  pydantic `ValidationError`；基线 `7a4af95^` 空串确实崩。25 项参数化用例等价重写全通过
  （含「空白串未被全局忽略」——`AI_PARTNER_LEADERBOARD_DURATION_SECONDS=''` 仍报错）。
- **S3-3 KaTeX 本地字体（`c3f0de4`）通过。** `index.html` 无 `katex.min.css` 链接；
  生产构建主 CSS **59/59** 条 `KaTeX_*` 均 `/assets/` 同源；运行期 jsdelivr 字体请求为空、
  5 条 `/assets/KaTeX_*.woff2` 全 200；CSP `font-src` 不含 jsdelivr。
  **负向对照**：退回修复前形态后 Chromium 报 55 条 `violates font-src ... blocked`。
  断言已收窄——KaTeX 的 **JS 仍走 jsdelivr**（CSP 允许），只验 CSS/字体同源。
- **S3-4 GDPR 导出兜底（`6abef78`）通过。** 基线对照（规则 5）：同一库同一数据，
  `6abef78^` 版本 **HTTP 500** + `AttributeError: 'GroupDiscussionMessage' object has no attribute 'message_type'`；
  修复后 **HTTP 200**，`discussion_messages_count=1`、`message_type: null`、`content` 逐字一致。
  审计日志每次导出稳定落一条 `EXPORT_DATA`。对照无讨论消息的用户打同端点 → 200，排除端点本身故障。
- **S3-5 中间状态恢复（`4ffdb31`）：需重定义检查项。** `4ea3d69` 已覆盖式改写热点分析管线，
  `normalize.ts` 中一半字段只剩定义、无消费者。仍活着的两条链：SSE `errorCode` → 中文文案
  （`useStreamEngine.ts`/`index.tsx` 对该提交 diff 为 0）、热点结果页渲染。
- **S3-6 批量变更守卫（`7645024`）：判为已失效。** `9f84619` 删除了该提交全部 7 个文件，
  `rg` 零命中。无验证对象，不占 S3 配额。核实：`RELEASE_NOTES.md` 中**没有**该提交的残留宣传段落。

### S4 错误级（3 项通过 + 4 项不通过 + 2 项能力缺失）

**批次 A（`e74bb61` XBK 年级约束）全通过：**
- 高一学生选仅高二课程 → **409**「课程 C1 仅面向 高二 开设」
- quota 改 0 后仍报年级错误，证明年级校验在容量校验之前（`selection_rules.py:558`）
- 导入缺「各班限报人数」列 → **422** 带行号
- 补充：`test_xbk_selection_rules_isolated.py -k grade` 7 passed；`test_xbk_import_validation.py` 17 passed

**批次 B 实测结果：**

| 项 | 实测 | 判定 |
|---|---|---|
| `4a448a9` 用户唯一性 | 单字段冲突正常 400；**双字段各命中不同用户 → 500** `Multiple rows were found`；PUT 同样 500。位置 `users.py:249`（create）与 `:321`（`_assert_update_unique_fields`） | 需修 |
| `14aeba9` 学习进度 | 基本持久化保留；但 **PUT/POST 是全量替换** `progress_data`，只提交 `{notes}` 会冲掉其他字段；`version` 字段与 PATCH 端点均不存在（405） | 保护逻辑全丢 |
| `888f32b` 导入加固 | **非法 UTF-8 → 500**、**破坏的 xlsx → 500**；逐行 savepoint 正常（中间行缺陷 → 200 + `error_count=1`）；**非法角色值静默降级成 `student`**（`import_service.py:190-191`） | 需修 |
| `73853e2` 文章搜索 | 公开端 `?q=` 精确命中正文；后台 `GET /articles` **无 `search` 参数**，前端降级为客户端 `title`/`slug` 过滤，不查正文 | 降级 |
| `2171d6d` 移动端 | 375px 无页面级横向溢出；但 **`SplitPanePage.tsx:24` 的 `gridTemplateRows: "minmax(0,1fr)"` 只有一行却塞两个子元素**，目录面板高度被压成 0，**移动端目录不可见**；折叠目录 `article-mobile-toc` 已被 `9f84619` 删除且无替代入口 | 需修 |
| `17709be` PDF | 匿名访问未发布笔记 → **404**（不区分不存在与未发布，有意设计）；`pdf_available` 前后端均不存在，前端靠 404 + toast 兜底 | 能力缺失 |
| `903eb00` PythonLab | 目标 2 用例 + 整文件 **54 passed**（fake Docker/Redis）；**未创建任何真实 `pythonlab_u*` 容器** | 通过 |

### S6 质量级（2 项通过）

- **`b77d849` 往返次数通过，520 → 1。** 两条独立证据链：
  - ORM 级（`before_cursor_execute` 计数器，26 班×20 课 520 条选课）：基线 `6d694b1` **553 条总 SQL / 520 次容量 COUNT**；HEAD **34 条 / 1 次**
  - 真实 HTTP（`SQLALCHEMY_ECHO=true`，`POST /xbk/import?scope=selections`）：基线 **566 / 520**；HEAD **47 / 1**（单条 `GROUP BY`）
- **`cd868f8` echarts 产物通过。** `build:check` 退出码 0，`echarts-vendor` 584,082 字节（570.5 KB）vs 全量 1,033,870（1009.6 KB），瘦身约 45%。
  **雷达图 SVGRenderer 回归做了对照组**：生产版 `svgCount=1/canvasCount=0`、彩色像素 4.84%；
  模拟缺 `SVGRenderer` 的对照组 `svgCount=0/canvasCount=1`、**彩色像素 0%**（只剩灰阶网格）。
  另注 `build:check` 整体状态为 WARN（total JS 10.96MB > 10MB、`editor.api2` 3541.7KB > 500KB），
  非本次改动引入。

### 本轮方法论发现

- **`uvicorn --reload` 会掩盖子进程崩溃。** 用镜像默认 CMD 起 `AI_PARTNER_SCORING_AGENT_ID=abc`
  的容器显示 `Status=running ExitCode=0`，但 `/health` 完全不通；去掉 `--reload` 后才看到真实
  `ExitCode=1` + `ValidationError`。已写入 `ENGINEERING_GOVERNANCE.md` §4.2：
  验证启动类条目必须看 `/health` 而非容器状态、检查 `RestartCount==0`、失败类场景禁用 `--reload`。

### 未覆盖 / 残余风险

- 三个后端 `:dev` 镜像在 arm64 上验证，生产链声明 `platform: linux/amd64`，架构差异未测。
- S1-7 所用前端产物来源无法回溯。
- S4-B5 只在 Chromium 375px 测，未覆盖 WebKit 与 320px；`articleDetailUi.governance.test.tsx` 已随回滚消失。
- S4-B2 未做并发验证，多标签页丢写风险是代码推断。
- S4-B1 只测 `super_admin` 路径，普通 admin 的 `_assert_role_assignment_allowed` 未覆盖。
- S6-1 只测导入路径，单条 `POST /data/selections` 改动前后都是 1 次、无区分度。
- S3-2 的单元测试未用 pytest 正式跑（`wangsh-backend:dev` 镜像内无 pytest），改用裸 pydantic 等价重写 25 项。
- S3-4 只验导出读路径，`conversations`/`analyses` 段在一次性库中均为空数组。

## 2026-10-27~28 S1 致命级验证（7 项全部通过）

- **文档门禁：** Markdown 合同检查为 `151 files / 701 links / 0 missing`。

- **范围：** 按 [S1~S7 验证计划](../archive/plans/2026-10-27-S1-S7-VERIFICATION-PLAN-V3.md)（已归档）执行 S1 致命级 7 项。
  规则：Docker 实例验证（D1/D2/D3）+ 双 Agent 交叉验证 + 主控复现争议结论。

### 逐项结论

| 项 | 档位 | 结论 | 关键证据 |
|---|---|---|---|
| S1-1 backup-db / restore-db | D2 | **通过** | 见下「S1-1 复验」 |
| S1-2 XBK 名册权限 | D3 | 通过 | admin 403 / super_admin 200 / 未认证 401 / 伪造 token 401；student 403、过期 token 401、伪造 `role_code=super_admin` 的合法签名 token 也 401 |
| S1-3 迁移守卫 | D2 | 通过（附不变量缺口） | 漂移时抛 `DuplicateTableError`，`alembic_version` 停在上一个 revision；表数 **55**（54 BASE TABLE + 1 VIEW） |
| S1-4 假数据路径 | D2 | 通过 | 不存在智能体、无凭证、不可达端点均抛 `ValueError`，无假数据回落 |
| S1-5 CSP / metrics | D1+D3 | 通过 | 七个路径均带 CSP、XFO DENY、nosniff；三个 metrics 端点 super 200 / admin 403 / 匿名 401 |
| S1-6 生产模拟隔离 | D1 | 通过（清理曾不完整） | 8 个容器均未挂载 `./data`，网络按项目隔离 |
| S1-7 前端回退 | D3 | 通过 | 三提交在祖先链；计算样式 primary `#0d9488`、bg `#f0fdfa`、accent `#7c3aed`；1440/768/375 无横向溢出；`pageerror=0` |

### S1-1 复验（D2，一次性栈 `s1v3`，端口 15496）

- **修复内容（`scripts/deploy.sh` restore-db）：** 加 `--exit-on-error` 并检查返回码；`--list` 失败即退出（覆盖尾部截断）；按 `TABLE`/`TABLE DATA` 条目数区分 full 与 data 备份，不再写死 `public`；只对备份里实际存在的表逐张核对（`n_live_tup` 为 0 时用动态 SQL 真实计数复核）；去掉吞错的 `2>/dev/null`，查询加 `ON_ERROR_STOP=1`；`.sql` 分支加 `ON_ERROR_STOP=1` 并向上返回非零。
- **结果：19 个断言全部通过。** full→空库 700/123 行一致且 16MB 中文 emoji 内容 md5 一致（`cad7249678bd1653a1f78fa23ca9a95c`）；data→非空库被拒绝（退出码 1，列出冲突表名）且数据未变；data→空表库 700 行成功；空文件/随机损坏/尾部截断均非零退出；非 `public` schema 的 full 备份恢复 `app.t3=10`；目标库有无关表不影响恢复；空表未 analyze 不被误拒；备份不存在的库时 `pg_dump` 非零退出。
- **`--exit-on-error` 对照实测：** 三表按 TOC 顺序恢复，中间表因列宽冲突失败。不加时 `a_ok=2 / c_late=1`（坏表被跳过、后续表继续写入，仅一条 warning）；加了之后 `a_ok=2 / c_late=0`（立即中止）。退出码都是 1，差别在于**是否留下半套数据**。
- **DDL 阶段失败实测：** 构造「目标库有外部外键依赖备份表」，在 `DROP CONSTRAINT` 处失败、退出码 1、后续 COPY 未执行。另测「目标库同名对象是视图」，在 `ALTER TABLE ... DROP CONSTRAINT` 处失败（`This operation is not supported for views`）、退出码 1。
- **`--clean` 范围：** 目标库预置 `extra_table`、`extra_view`，恢复只含 `t1` 的 full 备份后 `exit=0` 且 `t1` 数据还原，两个额外对象**全部保留**。
- **`schema` / `data` 边界：** `schema` 恢复到空库只得到空表；`data` 恢复到没有对应表的库 `exit=1`，报 `relation ... does not exist`（有意为之）。
- **残余风险：** 「逐张核对」依赖统计视图与真实计数两层判断；目标库在核对与 COPY 之间被并发写入时仍可能撞键，此时以非零退出码报错，不再静默成功。
- **未覆盖：** PostgreSQL 跨版本（16 dump 恢复到更低版本）。

### S1 交叉复核（两个独立复核 Agent）

- **S1-2 / S1-5 确认。** 另测 student 写入 403、匿名 PUT 401、过期 token 401、伪造 `role_code=super_admin` 的合法签名 token 401；同 flag 旁路接口 `POST /system/feature-flags` 同样 super 200 / admin、student 403 / 匿名 401；admin 自提权与创建 super_admin 均 403。`role_code` 取自数据库而非 JWT。CSP 在七个路径生效，metrics 内容扫描无密码、连接串、token。
- **S1-3 表数推翻。** `information_schema.tables` 实为 **55** 条（`BASE TABLE` 54 + `VIEW` 1 个 `v_conversations_with_deleted`）。早先记的「54 张表」只数了表、漏了视图。`alembic heads` 为 `20261026_0001`，降级后 49 张。
- **S1-3 不变量缺口。** `if_not_exists` 仍有残留，且**列级漂移会被静默放过**（降级 → 手工 `ADD COLUMN` → 再升级，`rc=0` 版本推进、冲突列无人处理）。索引级漂移的 `DuplicateTableError` 行为本身确认。2026-10-28 已新增静态守卫检查 `backend/scripts/check_migration_guard.py` 阻止新增守卫，见下节。
- **S1-6 清理被推翻。** `wangsh_sim` 曾遗留 4 个卷与 `run.ep4Il6` 工作区（锁已释放，说明外部中断没走到 trap）。**已手动清理**，复查无残留。
- **S1-7 措辞更正。** 实际是顶部导航，不是侧边栏（无 `aside`）。

### restore-db 复核发现与修复

- **`.sql` 分支吞错（高，已修）。** `psql` 不加 `ON_ERROR_STOP` 时中途报错仍继续执行、退出码 0。主控复现：不加时 `rc=0`，加上后 `rc=3`。
- **表名拼接（中，已修）。** 原实现把表名拼成带逗号/点号的 SQL 字面量：`a'b` 触发语法错误被拒、`we,ird` 被拆成两段漏判、`dot.tbl` 被误认成 schema.table。改为 awk 把 `schema\x01表名` 逐条拼成一行、生成静态 VALUES 行（单引号双写转义），psql 侧不做字符串切分；动态 count 用 `quote_ident`。实测：空表时三种特殊表名全部放行并恢复成功，有数据时全部点名拒绝。
- **`--clean` 不清理 dump 外多余对象（已知边界，已写入 DEPLOY.md）。**

### 工作树执行前提（运维）

本工作树无 `.env`，开发栈由 `docker-compose.dev.yml` + `.env.dev` 启动，容器为 `wangsh-postgres`。
直接执行 `deploy.sh backup-db`/`restore-db` 会因 `require_env_file` 失败或找不到容器。正确方式见
[DEPLOY](../deploy/DEPLOY.md#执行前提)。

## 2026-10-28 遗留缺陷修复（迁移守卫 + AI SSE 状态码）

- **迁移守卫静态检查（新增，未改既有判定逻辑）：** 新增 `backend/scripts/check_migration_guard.py`，只读迁移源码、AST 解析 `upgrade()` 函数体，禁止新增 `IF NOT EXISTS` / `if_not_exists`；历史 revision 按 `FROZEN_GUARD_COUNTS` 冻结命中数（以 `--update-baseline` 实测值写入），只许减少不许增加。`downgrade()` 里的 `DROP ... IF EXISTS` 与注释文字不计入。已挂到 `.github/workflows/ci-quality.yml` 的 python governance 步骤第一步（纯静态、不需要数据库）。
  - **验证：** 仓库现行 50 个迁移文件 `[OK]`；自造三条用例——干净迁移通过、`upgrade()` 含守卫失败（退出码 1）、注释文字不计入（通过）。
  - **回归：** `tests/test_migration_preflight_guard_contract.py` **56 passed**，与 HEAD 基线一致，既有 `evaluate_migration_state` 判定逻辑未被触碰。
- **AI SSE 设置阶段错误码（`/ai-agents/stream` 等）：** 设置阶段失败不再返回 `200 + event: error`，改为直接返回 404/409/503。映射见 `docs/development/API.md`「AI 分析/对话 SSE 的设置阶段错误码」。流开始之后的错误仍走 `event: error` 帧（SSE 协议限制）。
  - **实例验证（真实后端进程内、真实路由）：** 9 种错误码映射全部符合预期（`invalid_agent→404`；`agent_inactive`/`missing_endpoint`/`missing_api_key`/`circuit_open`/`model_not_configured→409`；`stream_setup_failed`/`stream_failed`/未知错误码→503）。未认证请求仍为 `401`。
  - **测试：** `tests/ai_agents/test_sse_setup_error_status_asgi_isolated.py` **11 passed**；`tests/ai_agents/test_stream_session_asgi_isolated.py` **44 passed**；`tests/ai_agents` 全目录 **311 passed, 1 skipped**。
  - **前端契约：** `frontend/src/services/znt/api/index.ts` 已按 `if (!response.ok)` 处理非 200，无需改动；`useAdminSSE.ts` 走 `EventSource`（GET `/admin/stream`），不受影响。

## 2026-10-28 生产网关 SSE 30 秒断连（已修，实测验证）

- **问题：** `gateway/Caddyfile` 的 server 级 `timeouts { write 30s }` 是**整个连接**的绝对写截止时间，不是两次写之间的空闲时间。后端每 15 秒发一次 keepalive，第 3 个 keepalive（30s）之前连接就被硬切断，前端只能不断退避重连，浏览器报 `ERR_INCOMPLETE_CHUNKED_ENCODING`。开发用的 `Caddyfile.dev` 没有这项，所以只在生产出现。
- **关键发现（推翻先前判断）：** `write 30s` 是 Caddy v2 的 **server 级默认值**，**省略不写仍然生效**，而且**优先于** `reverse_proxy transport` 里的 `write_timeout`——route 级设置覆盖不了它。曾先尝试「移除 write 行」，实测连接仍在 30 秒断开；必须**显式写 `write 0`**。
- **对照实测（最小 Caddy + 探针后端，生产同款 Caddyfile）：**
  - 保留 `write 30s`：连接在 **30.0s** 结束，只收到 0s 与 15s 两个 keepalive。
  - 移除 write 行（取默认 30s）：同样在 **30s** 结束。
  - 显式 `write 0`：连续收到 0/15/30/45/60/75s 共 **6 个 keepalive，稳定跑满 80s**。
- **修复：** server 级 `write 0`；同时保留 `@api_stream` 专用 handle（对 5 个 SSE 端点把 `read_timeout`/`write_timeout` 置 0），用于覆盖 `/api` 默认 transport 的 30s 写超时。空闲回收交给 `idle 2m`。
- **验证：** `caddy validate` 返回 `Valid configuration`；上述对照实验为真实容器 + 真实 HTTP 长连接实测。
- **未覆盖：** 未在生产环境实测；未在真实用户会话下验证前端重连行为是否消失。


## 2026-10-27 算法复杂度 P0 修复（未提交）

- **范围：** 按 [全项目算法复杂度审查报告](../archive/全项目算法复杂度审查报告_20261025.md) 的 P0 清单，修复批量画像无上限、用户导入无界、XBK 容量校验逐键 COUNT 等 DB 往返与阻塞问题。
- **后端相关测试：** `tests/assessment/` 与 `tests/xbk/` 合计 **1655 passed / 125 skipped / 0 failed**（未接专用测试库，不含 PG 专项用例）。
- **文档门禁：** Markdown 合同检查为 `145 files / 678 links / 0 missing`。
- **边界：** 本轮只跑了上述两个目录，未跑后端全量与前端 `vitest`；性能收益未经真实数据验证，结论以审查报告的证据边界为准。

## 2026-10-26 代码审查与瘦身（未提交）

- **范围：** 五阶段改动（死代码清理、重复实现合并、后端复杂度、前端拆分、性能），加同工作树的热点归类功能，累计 69 个文件，已跟踪部分净删 1,983 行。总账与阶段明细见 [2026-10-26-code-audit-report.md](../archive/2026-10-26-code-audit-report.md)。
- **后端：** 全量 **3646 passed / 123 skipped / 0 failed**（专用测试库 `wangsh_ci_test` + `alembic upgrade head`）；比基线少 1 是删除了 1 个只测死代码的用例。`tests/test_migration_preflight_guard_contract.py` **56 passed**。
- **前端：** `vitest` **774 passed / 774**；`tsc --noEmit` 通过。
- **治理：** `check_python_governance.py check --base-ref origin/main` 为 **errors=0 / warnings=37 / 361 files / 2100 functions**。
- **文档门禁：** Markdown 合同检查为 `145 files / 676 links / 0 missing`，`git diff --check` 通过。
- **迁移：** 新增 `20261026_0001_idx_classroom_plan_items_activity.py`，upgrade → downgrade → 再 upgrade 均成功，`EXPLAIN` 确认走 `Bitmap Index Scan`；索引名必须写字面量，常量会被预检判为“动态索引名”。
- **性能实测：** 分类列表 5 个分类的 SQL 从 7 次降到 3 次；echarts 构建产物从 1,035,150 B 降到 584,082 B（省 43.6%）。
- **已清理：** 测试库容器、临时测量脚本、`backend/.pytest_cache`、生产库中的测试分类。

## 2026-10-24 热点问题逐条归类（未发布）

- **实现范围：** 热点分析智能体改为按教学设计与教师提问 T1…Tn 逐条归类学生提问（回应型 4 细分 / 生成性 3 细分 / 无关），计数、分阶段与分桶由程序完成；原热点教学诊断不再生成。结果页时间图按类别堆叠、可按类筛选，并新增“按教师提问分阶段”。
- **后端：** 新增 `tests/ai_agents/test_hot_question_classification.py`（假 LLM，不发起真实调用），覆盖 Tn 按时间编号、非法组合丢弃、程序计数、130 条分 60/60/10 三批、提示词携带教学设计；`tests/ai_agents` 为 **294 passed / 1 skipped**。全量后端 **3512 passed / 241 skipped**，4 failed / 7 errors 与此前基线相同（环境与 pytest 版本问题）。`check_python_governance.py --base-ref origin/main` 为 **errors=0**。
- **前端：** `tsc` 通过；`src/components/hotAnalysisResultPage.test.tsx` 为 **16 passed / 16**（新增 4 项：标签优先于关键词、按 Tn 分阶段、堆叠柱筛选与判断依据、未配置智能体降级提示）；全量 `vitest` **773 passed / 773**；相关文件 ESLint 0 error。
- **文档门禁：** Markdown 合同检查为 `141 files / 661 links / 0 missing`，合同测试 **10/10** 通过，`git diff --check` 通过。
- **本地 Docker 端到端（2026-10-24）：** 用本地开发栈和真实 LLM（OpenAI 兼容接口 `deepseek-v4.1-flash`）跑通：造 3 名学生、3 个教师提问、18 条学生提问（含 T2 时段仍在回应 T1、无关键词的生成性问题、闲聊），走 `/ai-agents/analysis/hot-questions/stream` 生成两类记录。
  - 归类结果 18/18 全部归类：回应 9、生成性 8、无关 1、未归类 0；逐条核对正确——T2 时段“少写一个数”正确归回 T1，“为什么下标从 0 开始”判为生成性·原理深挖，“range 不包含 6”按 T3 上下文判为调试求助，闲聊判为无关。
  - 页面实测：堆叠柱、按类筛选原问、判断依据、“按教师提问分阶段”（T1 回应 3 条含理解追问 2 / 核对确认 1；T2 回应 2 条、仍回应更早 1 条、生成性 5 条）、Markdown 导出含分阶段与生成性原文；390px 窄屏无横向溢出；未配置智能体时显示降级提示且不出现分阶段区。
  - 测试数据、分析记录、智能体均已清理，数据库回到初始状态。
- **本轮修复的真实缺陷：**
  - 教师提问编号重复：自动识别的教师提问与手填标记各占一个 Tn，页面编号与“回应 Tn”对不上。改为同一 `message_id` 只计一次、无 id 时 30 秒内同内容视为同一条，并把去重后的 `teacher_refs` 随归类结果返回，前端以其编号。
  - 分析详情接口 500：`get_hot_analysis` / `get_chain_analysis` 把 ORM 对象直接写入 Redis，读回后无法通过响应校验。改为缓存 `model_dump(mode="json")` 的纯数据。
- **提示词调优与稳定性复测（2026-10-25）：** 同一份 21 条问题的课堂数据各跑 5 次，对比改动前后。
  - 改动前（关键词判生成性 + 无温度约束）：三次分别为回应 11 / 12 / 14，生成性 8 / 7 / 5；「为什么下标从 0 开始」曾被判成“回应 T2”。
  - 改动后（提示词加入“先看内容再看时间”“教师提问未涉及即归生成性”、五条真实误判反例；归类调用显式传 `temperature=0`）：三次计数同为 10 / 9 / 2；五次合计 21 条中 **18 条大类完全一致、16 条含细分完全一致**，三条核心生成性问题全部稳定判为生成性。剩余分歧均为确有歧义的条目（如“列表要写在 input 后面还是前面”“刚才的圆括号问题我还没搞懂”）。
  - **已知局限：** 上游接口对 `temperature=0` 的执行不严格（同一请求连续 4 次仍出现 1 次不同结果），提示词只能降低、不能消除随机性；如需完全确定，需在同一批次上多次调用取多数。
- **多次投票（2026-10-25）：** 新增每批 3 轮判定取多数（上限 5 轮），未达 2/3 一致标为“待确认”且不计入任何类别。后端新增 3 项测试（多数合并与平票标记、待确认不计入统计、轮数上限）；`tests/ai_agents` 为 **298 passed / 1 skipped**，全量 **3516 passed**（4 failed / 7 errors 为既有基线），治理 errors=0；前端 **774 passed**，新增“待确认”渲染与筛选测试。
  - 实测（6 条代表性问题的 3 轮投票，重复 4 次）：三轮全一致的问题 4 次均稳定；原先摇摆的“列表要写在 input 后面还是前面”现 4 次全一致；“刚才的圆括号问题我还没搞懂”仍在 2:1 间摆动，一致度 0.67，会显示为低一致度；“for 后面那行要缩进几格”大类稳定、细分在“理解追问/尝试应用”间切换。
- **审查后修复与 Docker 实测（2026-10-25）：** 三路审查（后端逻辑、文档真实性、前端）加自查确认了 7 个缺陷，已全部修复并在本地 Docker 栈实测。
  - ① 教师提问去重失效：手填与自动识别的容差原为 30 秒，老师手填常晚十几秒到一分钟，实测差 35 秒即被拆成两个 Tn。改为以自动识别为主、手填在 `MANUAL_MERGE_SECONDS=120` 内同内容时并入；实测差 35 秒与差 31 秒均合并为一条，不同内容正确保留。
  - ② 投票平票按 `Counter.most_common` 的插入顺序任选细分；改为并列最高票返回 `None`。
  - ③ `ambiguous_count` 把“模型未返回”也算作待确认；拆出 `unlabelled_count`。
  - ④ 细分平票得到 `subtype=None` 时 `per_teacher[None]` 抛 `KeyError`（我修复 ② 时引入）；改为细分缺失时只计回应总数，实测不再崩溃。
  - ⑤ 任务分析详情缓存写入失败被吞掉（`datetime` 无法 `json.dumps`）；改为序列化为 ISO 字符串，实测 `cache.set` 返回 True、读回为 dict 且日期可解析。
  - ⑥ 前端把没有 `message_id` 的事件计成“未归类”，与后端口径不一致；改为只统计可归类事件。
  - ⑦ 筛选按钮缺“未归类”，待确认条目无法单独查看；补入口并补图例。
  - **端到端（本地 Docker + 真实 LLM）：** 造 6 名学生、自动识别 2 条教师提问 + 手填 2 条重复标记（各差 40 秒），跑完整分析：教师提问正确合并为 T1/T2，7 条学生提问全部归类（回应 2 / 生成性 4 / 无关 1），一致度均 1.0；页面筛选含“未归类/待确认”。后端 `tests/ai_agents` **300 passed**、治理 errors=0、前端 **774 passed**、`tsc` 通过、文档门禁通过。
- **视觉复测：** vision-reader 读图时报告的“图例被截断”“T3 卡片空白”“窄屏图例挤压”经 DOM 实测均为截图观感误差（图例完整、卡片 388px 完整渲染、390px 无横向溢出）；**唯一确认的缺陷**是“课前提问”卡片保留了空统计行，已修复（卡片高度 120px → 109px）。
- **未验证：** 未用真实班级的大规模记录（数百条问题、多小时跨度）验证调用次数、总耗时与费用；未做生产部署验证。

## 2026-10-24 热点结果页时间视图（未发布）

- **实现范围：** 热点结果页改为紧凑基础信息与连续真实时间柱线图；柱形为有效学生提问，折线为其中迁移、延伸子集。保留空时段、教师时间轨道、悬停提示、按时段查看原问与生成性筛选；说明、审计和任务单默认折叠。HTML、Markdown 导出同步为时间统计表。后端算法、提示词、API 与数据库合同保持原状。
- **工程检查：** 容器内 `npm run type-check` 通过；`npm test -- src/components/hotAnalysisResultPage.test.tsx` 为 **12 passed / 12**，覆盖空桶、缺失分类、摘要降级、人数去重、冲突桶、跨午夜教师标记等；相关文件定向 ESLint 通过，`npm run token:check:ci` 为 **0 undefined tokens**。
- **文档门禁：** Markdown 合同检查为 `141 files / 659 links / 0 missing`，合同测试 **10/10** 通过，`git diff --check` 通过。
- **浏览器与交互：** Chrome headed 实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080` 和 `390×844`，可见元素无文档横向溢出，未出现 Vite 错误遮罩。真实鼠标悬停/点击柱形、生成性折线、教师标记、零提问时段，以及时段选择、筛选与折叠均正常；窄屏下拉与筛选可用。实际下载并读取 HTML、Markdown，核对完整时段、数量和统计口径说明。
- **缺失数据降级：** 浏览器模拟旧记录确认分类缺失显示“未记录”，未知空档不按零计；仅有典型原问摘要时明确提示，不能伪装为完整原问。无时间统计记录显示空态和原因；这些页面加载未捕获新的 JavaScript 页面异常。
- **证据与边界：** 截图与导出保存在仓库外 `/Users/wsh/.codex/artifacts/wangsh-hot-analysis-20261024/`。当前真实热点列表为空，使用仅限自动化浏览器会话的 API 拦截预览，并在标题与班级标明“模拟数据”；未写入数据库。真实课堂记录尚未验收，当前页面视觉效果待用户确认；本轮仅本地实现验证，未提交、推送、发布镜像或部署。

## 2026-10-23 KNN HTTP UUID 修复与生产部署 2.1.8（已完成）

- **问题与范围：** 学生在普通 HTTP 域名点击“核对内容”时，`crypto.randomUUID` 不存在而抛错。仅调整前端请求 UUID 生成与可恢复错误处理，并同步发布版本；后端接口、数据库字段和 Alembic 均未改变。
- **回归：** UUID 原生分支、HTTP 随机字节分支、随机源缺失、HTTP 确认与网络重试、草稿/学号/批次结束等针对性测试共 **8 项通过**；TypeScript 检查、改动文件 ESLint、生产构建与版本一致性通过。首轮新增重试用例预期原始异常文案，与已有统一错误提示不符；修正测试期望后复验通过。
- **Chrome 普通 HTTP：** 在回环监听的隔离页面通过 `http://0.0.0.0` 访问，实测 `isSecureContext=false`、`randomUUID=undefined`、`getRandomValues=function`。以真实 pointer 点击可见选项，完整验证填写、核对、模拟首次提交 503、重试成功；两次请求对象完全相同，UUID v4 合法，六项答案含 0/7 边界值且不变，pageerror 为 0。全部 API 被隔离模拟，没有写真实学生答卷；首轮驱动点击隐藏 input 被 label 遮挡，改为点击真实可见选项后通过。截图与执行记录在仓库外 `wangsh-knn-http-uuid-20261023` 证据目录。
- **文档门禁：** 当前派生摘要 `141 files / 665 links / 0 missing`；收尾首轮因新增链接使派生统计过期，更新后复验通过，原版本数字保留为历史快照。
- **源码与镜像：** 修复提交 `b2d97a7ca2df2e7b65c4e851b2b45f4fad7a53c4` 已由 [PR #12](https://github.com/shuhao0727/wangsh/pull/12) 合并，GitHub 六项检查全部通过（含完整前后端质量与两项 PythonLab runtime）。frontend 按上一版固定 Node/Caddy 基础 digest 重新构建，正式镜像本体也通过上述 Chrome HTTP 流程；其余五组件源码树未变，明确固定复用 2.1.7 digest，并以 `--prefer-index=false` 建立同内容的 2.1.8 标签，没有冒称重新构建。六镜像 `linux/amd64`、manifest、服务器 RepoDigest 与实际容器 Image ID 均与清单一致，标准 GitHub 镜像 workflow 未在本轮执行。
- **备份与恢复：** 两次核对任务、队列与学生沙箱为空后停流，最终 PostgreSQL 自定义备份 **20,417,072 bytes** 且目录可读；七份数据/SQL 备份均有大小和 SHA-256。无网络专用 PostgreSQL 恢复后，**54 张表和 49 个序列**一致；新版 backend 启动后、开放网关前再次比对一致。无新增 migration，生产仍为 `20261020_0001`。离机七文件校验全部一致，归档 SHA-256 为 `1cd2f93068c06e51eaae233537e9c0e1e444e8c38f68dccdeed0682961f5cdee`。
- **上线验收：** **2026-10-23 07:42:53（Asia/Shanghai）**完成切换，API 与详细健康为 healthy，公网版本为 `2.1.8`。六业务容器 RestartCount=0，启动日志未见 ERROR/CRITICAL/Traceback/HTTP 5xx；PostgreSQL/Redis 容器 ID、四个 named volumes、网络/端口、生产配置差异及 workspace/ownership 均保留，UID1000 可打开原锁，未修改锁 inode 或权限。
- **公网浏览器复验：** 在真实 `http://wangsh.cn:6608` 静态页面上隔离模拟 API，再次通过完整填写、核对、模拟 503 与重试成功；原生 `randomUUID` 仍为 undefined、pageerror 为 0，证明已经发布的静态代码在普通 HTTP 下可用。所有模拟 POST 均被浏览器拦截，没有新增真实学生答卷；真实业务 API 写入不在该浏览器复验范围。
- **发布与回滚：** 当前目录 `/home/shuhao/wangsh-releases/2.1.8/source`，使用 `.env`、`docker-compose.production.yml`、project `wangsh`。旧 2.1.7 目录/镜像保留，服务器证据 `/home/shuhao/wangsh-deploy-evidence/2.1.8-20261023`，本机证据 `/Users/wsh/.codex/artifacts/wangsh-knn-http-uuid-20261023`，离机备份 `/Users/wsh/.local/share/wangsh-production-backups/2.1.8-20261023`。发布清单和来源记录随 [GitHub Release v2.1.8](https://github.com/shuhao0727/wangsh/releases/tag/v2.1.8) 附上。

## 2026-10-22 生产部署 2.1.7（已完成）

- **文档收尾：** 当前 Markdown 合同为 `141 files / 662 links / 0 missing`，十项合同测试与 diff whitespace 复验通过；首轮因派生统计未更新而失败，更新后复验，不将首轮失败记为通过。
- **源码与发布身份：** 业务源码为 `7b91a7d55cf2a7c69d21fd52bff58b9cf181ab0e`（PR #9）；部署源码归档为 `15e23ee597de57ff995fbca1747aa5fc581796f7`，它只补充此前生产部署与本地镜像记录，已由 [PR #10](https://github.com/shuhao0727/wangsh/pull/10) 合入主线。保留主目录原有十个未提交文件，没有把旧工作区的 UI 草稿覆盖到新版主线。
- **镜像与源码核对：** 六个 `shuhao07/*:2.1.7` 镜像来自既有本地构建推送，本轮没有重跑标准 `dockerhub-amd64` workflow。发布前验证 Docker Hub manifest、`linux/amd64`、服务器拉取后的 RepoDigest 与实际容器 Image ID 均对应本次清单；backend 的 421 个打包源码文件、两个 worker 各 413 个源码文件与主线相同。从当前源码重新 Docker 构建 frontend 后，289 个静态文件逐一哈希相同，252 个 Vite manifest 条目一致。清单随 [GitHub Release v2.1.7](https://github.com/shuhao0727/wangsh/releases/tag/v2.1.7) 发布。
- **检查与配置：** 本地 Markdown 合同、十项合同测试、版本一致性、前端类型检查与生产构建通过；PR #10 的 Markdown 检查通过。正式业务源码此前主线的 ci-quality 已通过，本轮未额外重跑全量业务测试。生产 Compose 对照确认仅版本与六镜像变化，四个 external named volumes、网络、端口、Redis alias、PG max_connections、Typst 内存、worker 并发、UID/GID 1000 与绝对 PythonLab workspace 保持。
- **停流与备份：** 维护前和 gateway/backend 停止后均核对两个 worker 的 active/reserved/scheduled、两个队列及学生沙箱为空，再停止 worker 与 Redis。PostgreSQL 自定义备份为 **20,416,974 bytes**，`pg_restore --list` 可读；Redis、上传、PDF、workspace/ownership、数据库及角色共七份备份均记录大小和 SHA-256，原生产配置与旧 release-set 完整保存。没有修改 workspace 属主、模式、journal 或锁 inode。
- **恢复与数据：** 在无发布端口且 `network none` 的专用 PostgreSQL 中恢复最终备份，**54 张表与 49 个序列**的内容/状态逐项一致；仅清理该演练容器与专用卷。2.1.7 无新增 migration，生产继续为 `20261020_0001`。新 backend 启动后、重新开放 gateway 前，再次验证所有表内容与序列不变。
- **上线验收：** **2026-10-22 22:29:34（Asia/Shanghai）**完成切换，详细健康为 healthy。六业务容器的实际 Image ID 与清单匹配，RestartCount 均为 0；PostgreSQL/Redis 容器 ID 未变。公网首页、games、KNN、health、version 与 KNN 列表 API 均 HTTP 200，API 报告生产 `2.1.7`。真实浏览器访客首页可见 `v 2.1.7`，公开课目录显示三个入口。六服务本次启动日志未发现 ERROR、CRITICAL、Traceback 或 HTTP 5xx。
- **证据与回滚：** 当前发布目录 `/home/shuhao/wangsh-releases/2.1.7/source`，沿用 `.env`、`docker-compose.production.yml`、project `wangsh`；旧 2.1.6 发布目录与镜像保留。服务器受限证据 `/home/shuhao/wangsh-deploy-evidence/2.1.7-20261022`，本机证据 `/Users/wsh/.codex/artifacts/wangsh-deploy-2.1.7-20261022`。离机备份 `/Users/wsh/.local/share/wangsh-production-backups/2.1.7-20261022`，七文件大小/哈希均一致，归档 SHA-256 为 `d187f00fea19976f17f250d697593a369f79bb1ec8fc18f2e3b5ed89303932f0`。
- **边界与重试：** 未调用真实模型、填写真实学生答卷或进行完整管理员业务回归。首次服务器镜像拉取在 25 秒边界被中断，续传后成功并严格核验 digest；GitHub 连接器缺少写权限，改用已登录的本机 gh 完成普通 PR 操作。标准发布 workflow 不作为本批镜像构建证据。

## 2026-10-20 生产部署 2.1.6（已完成）

- **文档收尾：** 当前工作树 Markdown 合同为 `135 files / 511 links / 0 missing`，历史发布前检查数字保留。

- **环境与镜像：** 生产主机 `wangsh-server`，对外入口 `http://wangsh.cn:6608`；正式源码 `542c0d8e20832c8e367bac43a81e4c365ce1c949`，发布 workflow `39381756718`。六个 `:2.1.6` 镜像的 registry manifest、拉取后 RepoDigest、实际容器 Image ID 与 release-set 一致，平台为 `linux/amd64`。服务器使用 `9b69ec3831fd4eac74f049fbf4b7a5848a9935a7` 文档收尾树的源码归档；业务镜像来源仍为前述构建提交。
- **维护与备份：** 任务 active/reserved/scheduled、两个队列和运行中的学生沙箱均为空后停止 gateway/backend/两个 worker；最终 PostgreSQL 自定义备份为 **20,092,728 bytes**，目录可读。Redis SAVE 后停止，备份其卷、上传、Typst PDF、PythonLab workspace/ownership、原配置、角色与旧 release-set。七份数据/SQL 备份均有大小和 SHA-256；本机离机归档的逐项校验全部一致。原服务器 `.env`、Compose 和已暂存差异完整保留。
- **恢复与迁移：** 在本次专用、无发布端口且 `network none` 的 PostgreSQL 中恢复最终备份，49 张原表内容摘要和 45 个序列一致；执行五步升级及 bootstrap 后，按原列再次比较一致。随后完整恢复旧备份并再次比较一致，仅清理该演练容器和卷。生产同样通过预检、initial-only、五步升级及 bootstrap，目标为 `20261020_0001`，KNN 三表齐全；原表/序列内容核对通过。迁移实际连接已核验 5 秒锁超时、120 秒语句超时，未用降级删除业务数据。
- **配置与 PythonLab：** 保留四个 named volumes、现有网络/端口、Redis alias、PG max_connections、Typst 768 MiB、worker 并发和无 Beat 策略。两个 ownership writer 统一 UID/GID 1000；备份后只对清单中 1,089 个必要目录/运行文件/锁/journal 原位调整属主，inode、mode 和 journal 内容摘要不变。服务器实际文件系统完成两个镜像双向同 inode flock 排他/释放重获，并验证 UID 1000 的 Docker socket 访问；合成探针已清理，业务锁未删除。
- **上线验收：** 2026-10-20 16:17（Asia/Shanghai）详细健康状态为 healthy，七个受检服务全部 healthy；六个业务容器 RestartCount 均为 0，PostgreSQL/Redis 容器 ID 未变。API 报告生产 `2.1.6`；本机经公网访问版本、`/games`、`/games/knn` 均成功，服务端 KNN 列表 API 为 HTTP 200。六服务启动日志未发现 ERROR/CRITICAL/Traceback/HTTP 5xx。
- **证据与启动入口：** 服务器当前发布目录 `/home/shuhao/wangsh-releases/2.1.6/source`，使用其 `.env`、`docker-compose.production.yml`、project `wangsh`；旧仓库保留为原配置与 Git 状态，后续升级不得误用旧 `.env`。服务器受限证据 `/home/shuhao/wangsh-deploy-evidence/2.1.6-20261020`；离机备份 `/Users/wsh/.local/share/wangsh-production-backups/2.1.6-20261020`，归档 SHA-256 `cc577fc6eced03046ff42fbcf6cd6b78e966ecfaf1ac331a86491ca1a4c0645b`。
- **边界与重试：** 本轮未调用真实模型、提交学生答卷或重跑全量 CI。首次隔离升级因 localhost 被应用设置改写为 Docker 服务名而失败，修正为专用容器回环地址后完整通过；失败日志保留。IAB 公网页面导航超时，浏览器渲染/完整登录后的操作未在本轮复验；公网 HTTP、实际静态镜像与此前发布前浏览器验收分别记录。

## 2026-10-21 XBK 导入导出、年级语义与前端交互修复（未发布）

- **范围：** 修复课程导入 quota 静默为 0、选课表导出忽略筛选、导入年级静默覆盖、批量删除年级范围不一致、公开开关权限过宽；统一 `xbk_courses.grade` 语义（空表示全年级可选），补充 `student_grade`、容量分桶口径 `capacity_basis` 与前端年级/学年/导出交互。无新增数据库迁移。行为变更见 [RELEASE_NOTES](../RELEASE_NOTES.md#xbk-导入导出与年级语义一致)。
- **后端：** `tests/xbk` 为 **1415 passed / 104 skipped**，跳过项不计为通过。
- **前端：** `frontend/src/pages/Xbk` 测试 **109 项通过**；`npm run type-check`（`tsc`）通过，XBK 相关 ESLint 为 **0 error**。
- **真实环境端到端：** 使用真实 PostgreSQL 与真实 API 验证年级规则：跨年级选课由 200 变为 409，正确匹配仍为 200，无年级课程仍可正常选择。
- **真实教务数据验证：** 使用 `07-课程处/2026-2027学年/01-上学期` 的真实名单与课程目录，改写为专用学年 `2099-2100` 后导入：学生 **1857** 条、课程 **55** 条、选课 **974** 条全部成功；汇总与列表一致。四条年级规则实测通过：高一学生选高二课程 409、高一学生选高一课程 200、高二学生选高一课程 409、已有选课学生改年级 409。验证后测试数据已清理，三表回到 0 行。
- **真实数据发现的输入约束：** 原始名单中学号跨年级重号 **828** 个、课程代码跨年级重码 **28** 个，与系统“全校唯一”要求冲突，需在 Excel 侧修正；另有 2 门课的“各班限报人数”填为“固定名单”（非数字），会被字段校验拒绝。这些属于数据准备问题，不是系统缺陷。
- **选课工作簿（R3）端到端：** 用真实名册导出的工作簿修改 3 名学生（2 人改课、1 人填「未选」）后回导：预览 **0.44 秒 / changed=3**，确认 **0.62 秒 / applied 3 项**，数据库逐项核对全部符合预期。修复前同一文件预览需 **306 秒**、确认超时无响应；根因是元数据表在 `read_only` 模式下逐格调用 `ws.cell()` 反复重解析 XML。再次提交同一文件按设计返回「工作簿导出基线已过期」，不重复应用。
- **导出拆分实测：** 三个导出按钮在浏览器中均能打开对应弹窗并触发下载，文件可正常打开：选课表 36 个工作表、各班分发表 34 个、教师分发表 50 个；筛选「高一」后各班分发表只含 18 个高一班级表，不含高二。
- **边界：** 仅本地验证；未构建或发布镜像、未部署服务器、未迁移生产数据库。未额外执行生产模拟 smoke 或真实浏览器多端断点复验。

## 2026-10-21 文档复核遗留项收口（未发布）

- **索引复核（无需补建）：** 逐条核对 `DATABASE_PERFORMANCE_GUIDE.md` 2.1 的候选索引。`GroupDiscussionSession.created_at`
  无过滤/排序使用点；`ClassroomActivity.analysis_agent_id` 仅在内存过滤，不做数据库谓词或连接；
  `ClassroomActivity.updated_at`、`InformaticsGithubSyncRun.status`（同步运行记录表体量极小）、
  `InformaticsGithubSyncSetting`（单例配置表）均无查询价值；`ClassroomActivity.status` 与
  `InformaticsGithubSyncSource.note_id` 已由迁移覆盖。全部标记为“不需要”，未新增迁移。
- **SSE 发布点补齐：** 分类（创建/更新/删除）、Typst 笔记（创建/更新/删除）、课堂活动
  （创建/更新/删除/复制/启动/结束/重启）现在向 `admin_global` 发布 `category_changed`、
  `informatics_changed`、`classroom_interaction_changed`，与三个管理页的 `useAdminSSE` 监听对齐。
  新增 `backend/tests/test_admin_sse_publish_points.py` 固定该合同，结果 **3 passed**。
- **Dify 模型字段：** 确认 Dify 请求体由 `build_stream_payload` 构造，不含 `model_name`，
  该值只影响列表/详情展示；`AgentForm` 在 `agent_type=dify` 时不再渲染“模型”字段，历史库值保留但不生效。
- **无障碍指南：** 删除 `ACCESSIBILITY_GUIDE.md` 中已回退且不存在的 `Input` `clearable` 契约整节。
- **回归：** `tests/classroom + tests/informatics + tests/articles + test_pubsub.py` 为 **235 passed / 2 failed**；
  两个失败（`test_concurrent_auto_end_claims_activity_once`、`test_locked_plan_keeps_items_and_activities_eagerly_loaded`）
  在 HEAD 上同样失败，与本次改动无关，未修复也未计入通过。前端 `tsc --noEmit` 通过，
  `AgentForm.tsx` ESLint **0 error / 4 既有 warning**，Python 治理 **0 errors / 38 warnings**。
- **边界：** 未部署、未迁移数据库、未发布镜像；SSE 改动只做单元合同验证，未在真实浏览器多标签场景复验。

## 2026-10-20 全量文档准确性整理（未发布）

- **范围：** 按文件边界分七组并行核对 `docs/` 与模块 README，逐条对照源码/配置/迁移更正事实性描述。只改文档，未改代码、配置、迁移或业务数据，未提交、未发布、未部署。
- **主要更正：** AI 智能体表名 `znt_ai_agents`→`znt_agents`，`provider_type`→`agent_type`、`api_key`→`api_key_encrypted`；PythonLab 会话由数据库表改为 Redis `debug:session:*`，优化日志表为 `znt_optimize_logs`；Alembic head 统一为 `20261020_0001_knn_collection`；Typst 笔记/样式/分类权限由“管理员”更正为 `require_staff`；学习中心多个端点由“公开”更正为需登录；XBK 批量删除由“软删除”更正为物理删除、`/admin/xbk` 更正为 `/xbk`；监控与归档端点补 `/api/v1` 前缀并更正归档请求体为 `{"days": N}`；DEPLOY/CICD 版本号、迁移 head、健康检查与自引用跳转描述同步。
- **派生计数：** 补录 2.1.6 新增 `/games/knn(/:batchId)` 为第 50 个页面族，UI-PAGES 公共页面 19→20、总计 66→67；`docs/README.md`、`docs/docker/README.md`、`docs/docker/frontend/README.md` 的“49 个页面族”同步为 50。
- **门禁：** `node scripts/check-markdown-contracts.mjs`（`141 files / 658 links / 0 missing`）、`node --test scripts/markdown-contracts.test.mjs` 与 `git diff --check` 通过；上一条 v2.1.6 记录中的 `652 links` 保留为发布时快照。
- **验证边界：** 仅做静态核对，未运行后端/前端测试、未启动浏览器、未连接真实数据库或模型。仍标注“待复核”的条目见各文档内注记与本次整理报告。

## 2026-10-20 v2.1.6 镜像发布（已完成，服务器未部署）

- **GitHub 与来源：** [PR #7](https://github.com/shuhao0727/wangsh/pull/7) 已通过六项检查并合并；正式镜像源码为 `542c0d8e20832c8e367bac43a81e4c365ce1c949`。[发布工作流 39381756718](https://github.com/shuhao0727/wangsh/actions/runs/39381756718) 全部成功，输入 `image_tag=2.1.6`、`push_latest=false`。[GitHub Release v2.1.6](https://github.com/shuhao0727/wangsh/releases/tag/v2.1.6) 已正式创建，tag 指向同一源码，附件 `release-set.txt` 已上传。
- **镜像身份：** 六个 `shuhao07/` 仓库 `wangsh-backend`、`wangsh-frontend`、`wangsh-gateway`、`wangsh-typst-worker`、`wangsh-pythonlab-worker`、`pythonlab-sandbox` 的 `:2.1.6` 已推送。release-set 由正式 workflow 生成并下载到主目录 `.codex/releases/2.1.6/release-set.txt`；独立 registry digest/platform 核验结果见本轮外部证据，六镜像均匹配清单并包含 `linux/amd64`。发布前六标签均不存在，未更新 `latest`。
- **CI 证据：** PR 通用质量门禁为后端 **3482 passed / 242 skipped / 14 warnings**，前端 **101 files / 743 tests passed**，另 **30 项脚本测试**。Python governance 为 **0 errors / 38 warnings**，前端 lint 为 **0 errors / 463 warnings**；保留弃用和大 chunk 警告。两项 PythonLab PR runtime 门禁、文档、repo-config 均通过；正式发布重跑内置质量门禁并全部成功，未额外重跑本地全量业务测试。
- **本地发布检查：** 版本一致性、发布记录提交树 Markdown 检查（`141 files / 652 links / 0 missing`）、Markdown 合同 **10 项通过** 和 diff whitespace 通过；记录同步首轮因新增链接后的派生统计未更新而失败，修正后复验通过。保留原有四文件脏改动，未提交 npm 标记噪声或先前运维草稿。外部证据位于 `/Users/wsh/.codex/artifacts/wangsh-release-2.1.6-20261020/`。
- **部署边界：** 本轮未访问或部署服务器，未迁移生产数据库、未改写学生答卷。后续部署须按部署指南备份并核对 Alembic `20261020_0001`；它新增三表，降级会删除 KNN 数据。此前开发库及浏览器验收为发布前证据，不能当作生产验收。

## 2026-10-20 IT 应用目录嵌入式紧凑化（未发布）

- **本次范围：** 仅调整 `/admin/it-technology` 应用目录，移除卡片外框、阴影、底栏分割线及独立底色；图标与名称同行，移除重复分类和常驻功能说明。公开课依次为“召唤一名AI同学”“密码锁破解”“KNN 运动习惯采集”，其他应用保留原管理入口和前台开关。
- **Chrome 实测：** 页面标题与路由正确，四个分组共 11 项应用；实际计算样式确认全部卡片外框 `0px`、阴影 `none`、底栏分割线 `0px`、默认透明背景。桌面 `1280×800`、`1440×900`、`1680×1050`、`1920×1080` 与窄屏 `375×811` 均检查，无文档横向溢出或名称裁切；手机布局稳定后单列宽度为 351px，卡片高度约 96px。响应式切换过程截图曾捕获过渡中的侧栏，稳定后重新核验并覆盖手机截图。临时视口已恢复，侧栏恢复原展开状态。
- **交互与边界：** 点击 KNN 管理并通过“IT 应用”返回目录正常；没有切换功能开关、提交答案、修改批次或新增数据。目录无框架报错遮罩；控制台无 error，进入 KNN 管理时仍出现既有 Select 从 uncontrolled 切换为 controlled 的 warning，本次未改该管理组件，不计为告警已修复。
- **工程检查：** `npm run type-check` 通过，目录组件 ESLint 无错误或警告，`git diff --check` 通过。截图保存在仓库外 `/Users/wsh/.codex/artifacts/wangsh-it-cards-20261020/embedded-*.jpg`；视觉规则与页面路线图同步，当前效果已获用户确认。未提交、推送、发布镜像或部署。

## 2026-10-20 KNN 开发库、浏览器与前端权限验收（未发布）

- **学生直选控件补验：** 按用户反馈，将六类运动的 12 个下拉控件替换为原生单选组：每组完整展示 `0–7` 天或五档喜欢程度，初始不预选；桌面左右分栏、手机上下排列并完整显示五档文字。真实浏览器验证点击换选、组内互斥、方向键切换、12 项答案进入核对页和返回保留，核对内容正确保留 `0 天` 与 `7 天`。本轮用 IAB 的新标签验收用户批次，只核对学号和编辑本标签草稿，未点击确认提交、修改配置或已有答案；验收选择已清除。DOM 实测桌面 `1231×865`、窄屏 `375×811`，文档宽度与视口一致，均无横向溢出，console warn/error 为空，临时视口已恢复。`npm run type-check` 通过；涉及两文件的 ESLint 为 **0 error / 1 既有 Fast Refresh warning**。截图位于外部 `/Users/wsh/.codex/artifacts/wangsh-knn-20261020/direct-choices/`，功能和发布说明同步。
- **本地实现：** `/games` 增加即时搜索、匹配数量与无结果恢复；新增 KNN 免登录采集入口与教师批次管理。信息技术目录保留卡片，按“公开课”“课堂工具”“AI 与编程”“游戏与资源”四组展示；本次实际浏览器可见 11 项应用。
- **开发库迁移：** 已在源码挂载的本机开发栈应用 revision `20261020_0001`，本轮只读查询确认版本一致，没有重复迁移。迁移前 `pg_dump -Fc` 备份为 **268,747 bytes**，归档目录可读取，SHA-256 为 `fb8c2e7c66ef839c9162403ce62be117de1c77e728c8e593553f441e469b5285`；备份和 manifest 位于仓库外 `/Users/wsh/.codex/artifacts/wangsh-knn-20261020/local-migration/`。未迁移服务器。
- **Chrome 交互：** 在 `http://localhost:6608` 验证搜索匹配、无结果和清除恢复；默认 65 人批次创建、开放与结束、四名合成学生提交、重复学号拦截、授权重填与历史版本、应交/已交/未交统计、答案查看、CSV 和课堂 JSON 下载动作均已验收。教师端结束收集后，学生入口显示已结束并禁用开始填写；为补验冻结不变性曾临时重新开放，最终已结束。
- **冻结与导出内容：** 第五名合成学生在冻结后经页面提交成功，教师端显示 **5 已填 / 60 未填**。只读调用当前应用导出服务核对 CSV 为 65 行名单、5 份答案，冻结结果仍为原 4 位 `S01–S04`，冻结时间早于第五份提交，字段仅含匿名课堂合同。CSV、冻结 JSON、哈希与断言结果保存在外部 `browser/` 证据目录。浏览器只确认下载成功提示；下载记录页被策略拦截，未绕过，实际下载文件落盘仍未核验；服务导出副本不等同于浏览器下载文件。
- **响应式与 console：** 桌面实际视口 `1728×906`，学生表单额外以 `390×844` 检查顶端、下拉选项和底部意向/同意/按钮，文档宽度为 390，无横向溢出；窄屏仅测试学号 6 的未提交草稿，临时视口已恢复。普通 viewport API 没有改变实际尺寸，改用同一 CUA Chrome 会话的 CDP Emulation 后读取 DOM 尺寸确认，不将未生效的尝试记为移动端通过。清理前教师和学生页的 warn/error 为空；清理后仍指向已删除合成批次的轮询产生预期 404，不计为业务成功请求。
- **权限修复与检查：** 教师仅能进入 `/admin/it-technology?view=knn`，其批次直链/刷新参数和侧栏入口已覆盖；目录与其他 IT 编辑器继续沿用管理员限制，学生与匿名用户由原守卫拒绝或跳转登录。前端 **4 个测试文件 / 43 项通过**，`npm run type-check`（含 AI 同学配置）通过。首轮 3 项失败来自测试 Harness 缺少实际 App 外层 AdminGuard，补齐真实结构后通过；真实教师 JWT 浏览器登录未另测，角色回归使用模拟认证上下文。
- **合成数据清理：** 批次 `c4680eea-fc48-445d-bf95-21126e0fa76f` 已先备份再按 ID、精确标题和 closed 状态断言清理，删除 **1 批次 / 65 名单 / 9 个答案历史版本**，提交后复查三者均为零，其他 KNN 记录数不变。教师管理页已回到“还没有采集批次”；不留下可被误用的验收批次。外部 `browser/synthetic-batch-before-cleanup.json` 为受限备份，`cleanup-verification.json` 记录清理结果。
- **文档门禁：** 当前 Markdown 派生摘要为 `141 files / 645 links / 0 missing`，检查通过；Markdown 合同 **10 项通过 / 0 失败**，`git diff --check` 通过。首轮检查和合同中的仓库检查因旧派生统计未更新而失败，更新统计后复验通过，不将首次失败计为通过。
- **证据与边界：** 上述浏览器、导出与清理证据位于 `/Users/wsh/.codex/artifacts/wangsh-knn-20261020/browser/`，课程入口及清理后管理页截图已保存。未读取原型真实 `data/responses.json`，未执行普通后端 pytest collection、全量负载、真实课堂或生产浏览器验收；未提交、推送、发布新镜像或部署服务器。

## 2026-10-20 KNN 采集后端隔离验收（未发布）

- **范围：** 新增 KNN 批次、学号名单及不可覆盖的提交版本，学生匿名填报，教师管理时间窗、重填、导出和课堂数据冻结。开发位于 `codex/release-2.1.5-record` 的活动工作树，本节不改变已发布 `2.1.5` 镜像身份。
- **真实 PostgreSQL/ASGI：** `backend/tests/it/test_knn_collection_isolated.py` 为 **19 passed / 0 failed**，覆盖默认名单与学号规范化、严格字段、时间边界、迁移 upgrade/downgrade/upgrade、约束、并发防重、相同请求幂等重放、重填及旧请求不消耗新授权、撤销/陈旧版本拒绝、取消回滚、名单修改原子性、CSV、匿名冻结与教师归属/角色权限。
- **隔离与源码：** 专用 PostgreSQL 使用 `network=none`、tmpfs 且无宿主挂载，测试进程只允许同命名空间的 PostgreSQL 回环连接；导入前禁 dotenv/secrets，清空继承环境，注入合成 settings，不加载正常 pytest conftest。普通业务数据库未访问，专用 PostgreSQL 容器已删除。证据 manifest 中八个源码 SHA-256 与本次记录时的活动工作树一致。
- **证据：** 外部目录 `/Users/wsh/.codex/artifacts/wangsh-knn-20261020/backend-verification/` 保存 `run_isolated.py`、`results.txt` 和 `manifest.json`。该一次性运行器是本批隔离证据，不是维护脚本或普通 shell 的直接测试入口。
- **验证边界：** 增量迁移只以前置合成 `sys_users` 表验收，未执行完整历史迁移链；ASGI 权限用例使用合成身份与真实 staff/归属守卫，未验证真实 JWT 登录。本节不代表浏览器、生产部署、全量后端或课堂负载验收；页面交互与本机开发库迁移由对应实测另记。未提交、推送、发布镜像或部署服务器。

## 2026-10-19 v2.1.5 镜像发布（已完成，服务器未部署）

- **GitHub 与来源：** [PR #5](https://github.com/shuhao0727/wangsh/pull/5) 已通过最新源码的六项检查并合并，正式镜像源码为 `d078fec19cc6500d39e08ac55ddbf4ab8c079003`。[正式发布工作流 39193692530](https://github.com/shuhao0727/wangsh/actions/runs/39193692530) 全部成功，输入为 `image_tag=2.1.5`、`push_latest=false`；六个标签在发布前均不存在，保留 `2.1.4`，未更新 `latest`。
- **远端镜像：** `shuhao07/` 下的 `wangsh-backend`、`wangsh-frontend`、`wangsh-gateway`、`wangsh-typst-worker`、`wangsh-pythonlab-worker`、`pythonlab-sandbox` 六个 `:2.1.5` 镜像已发布。下载官方 `release-set-39193692530` artifact 后，独立读取 registry manifest，六个 digest 全部与清单一致，均包含 `linux/amd64`；使用 `.env.example` 的 `verify-release-set` 退出成功，输出 `version=2.1.5 images=6`。发布源、工作流结果、release-set、manifest 与校验日志归档于 `/Users/wsh/wangsh/.codex/releases/2.1.5/`。
- **完整质量门禁：** PR 与正式发布工作流均通过仓库配置、完整前端和后端门禁。正式工作流后端为 **3482 passed / 241 skipped / 14 warnings**（226.69 秒），跳过项不计为通过；前端最新 PR 为 **100 files / 723 tests passed**，另有 **30 项脚本测试**，类型检查、lint、token、UI audit 和生产构建均成功。lint 为 **0 errors / 462 warnings**，既有构建与治理警告保留。最终本地根合同为 **88 passed / 0 failed / 0 skipped**，Markdown 为 **140 files / 624 links / 0 missing**，Python 治理为 **0 errors / 37 warnings**。
- **发布前复核：** 两个 agent 只读复核了前端课程迁移、依赖与动态导入，以及测评计分、smoke 脱敏、清理白名单和 catalog/CI，未发现所查范围内的阻断回归；此前整理验证仍见下一节，不重复计为新发布 CI。
- **模拟隔离修复：** 发布前发现默认生产模拟沿用固定容器名及 PG/Redis 宿主数据目录。已改为启动/停止前生成临时独立 Compose；真实 `config → helper CLI → config` 回读确认八服务、四个项目专属卷、仅 Docker socket/本次工作区两种宿主绑定、网关仅 `127.0.0.1:16608`，healthcheck 字符串保持。未知挂载、外部配置、工作区/端口边界和失败脱敏合同通过；最终真实容器 smoke 已完成并自动清理模拟容器、卷和工作区。
- **首败与修复：** 首轮模拟与补充诊断因可选 `AI_PARTNER_SCORING_AGENT_ID` 空值触发整数解析错误，后端未启动，不计为通过。修复仅将该字段空串/全空白视为未配置，正整数约束和其他字段严格校验保留，定向隔离配置测试 **25 passed**。配置修复后首轮完整 smoke 为 **10 PASS / 3 WARN / 1 FAIL**：未配置供应商导致小组对比分析 503；UI 十三个 WARN 来自 KaTeX CDN 字体被 CSP 拦截。KaTeX 已改为同源 CSS/字体，59 个字体引用存在；未放宽 CSP 或 smoke 断言。
- **最终生产模拟：** 修复后六个本地候选镜像的完整 smoke 退出成功，**14 步骤：12 PASS / 2 WARN / 0 FAIL**；UI 为 **13 PASS / 0 WARN / 0 FAIL**。覆盖登录、测评、点名、讨论、Typst、PythonLab owner 并发、DAP step/watch、print visibility 和登录替换 UI。两项 WARN 为：旧 OpenAPI public 名单匿名调用两个需认证的 model-discovery GET 得到 401；合成空库没有 stable learning content/旧 ML book，因此历史内容恢复未验证。
- **模型验收边界：** 小组对比分析使用临时本地 OpenAI 兼容供应商桩，原脚本三轮请求、落库和二次缓存同 ID 断言均通过；夹具恰好收到三个有效 POST，`real_model_called=false`。这证明本次合成链路与缓存合同，不是真实模型能力验收。
- **发布收尾文档：** 同步发布记录与部署示例后的 Markdown 派生摘要为 `140 files / 629 links / 0 missing`；发布前的链接数量保留为历史快照。
- **证据与环境保护：** 本地 smoke 与首次失败、夹具证明、完整 CI 日志、根合同和保护快照位于活动工作树 `.codex/release-2.1.5/`；最终 smoke 位于其 `smoke-final/`。发布收尾再次确认主目录 HEAD/Git 状态/九个初始 dirty 文件哈希与七个正常开发容器的 ID、镜像、运行和重启状态均未变化。本轮没有部署服务器，没有迁移或修改正常业务数据；后续上线仍按 [部署前置](../deploy/DEPLOY.md) 单独核对。

## 2026-10-19 项目文件与共享模块整理（整理阶段历史快照）

以下保留整理阶段的验证范围；该批内容随后已随上节 `2.1.5` 合并并发布，原阶段的“不提交/推送”边界不代表当前发布状态。

- **范围与保护：** 基于 `codex/release-2.1.4` 的 `1db95a91bc2502360995fb072b0051ba5b21d35c`，在 `/Users/wsh/wangsh/.claude/worktrees/beautiful-satoshi-b71479` 整理。保留既有 dirty 修改，主目录不覆盖；本轮不提交、推送、构建发布镜像、部署、迁移或修改业务数据，已发布版本身份不变。
- **实际整理：** 归档九份日期报告、收敛当前 owner 与台账；移除四个闲置组件、五个旧模拟 API 导出、六个专用类型和九项多余直接依赖。锁文件未升级保留包版本。共享课程、阅读器、只读导图及稳定实验资源迁入 `features/it-technology`；Admin 编辑器、PythonLab Studio、画布和调试状态机保留原边界。
- **前端门禁：** `npm test` 为 **100 files / 723 tests passed**；`npm run type-check`、`npm run test:scripts`（30 tests）、`npm run build:check` 均退出成功。token 检查为 `0 undefined tokens across 2064 references`，UI audit 为 `899 hits` 且沿用原门禁。构建保留已有 Browserslist、PDF.js eval 和大 chunk 警告，不据此宣称包体已全部优化。
- **lint 基线：** 同一依赖、ESLint 配置和 tsconfig 下，HEAD 为 `0 errors / 465 warnings`，当前为 `0 / 462`；按迁移路径映射后新增警告 **0**，减少的三条来自删除的旧模拟用户 API。未通过降阈值或批量关闭规则清零。
- **共享内容保真：** 基线与当前的 41 个课程/书籍导出深度一致，51 个章节 Markdown 的 SHA-256 一致，13 个移动模块的非 import 实现一致，BookReader CSS 字节一致；PythonLab 共享与 flow 类型为原合同精确切分。相关 **9 files / 30 tests** 通过。
- **测评纯计算：** 外部隔离 runner `/tmp/wangsh-session-scoring-20261019/run_isolated.py` 运行六个选定文件，结果 **130 passed / 1 deselected / 8 warnings**。明确排除真实 PG schema 用例 `test_generate_class_profile_isolates_students_by_class`，不计为通过。collection 前禁 dotenv/secrets、正常 conftest、自动插件及网络/DNS/子进程，限制 scratch 写域，使用 SQLite/mock；首次成绩去重、分数分布和聚合循环 AST 保真，session 服务查询、事务和 monkeypatch 入口保留。八条为已有 Pydantic 弃用警告。
- **smoke 脱敏：** 定向工作流回归 **15 tests passed**，覆盖独立 CLI 导入、stdout/stderr、普通/信号退出码、跨行敏感值和编码；后端 `test_prod_smoke_compose_context.py` 的 **11 tests passed**。外部 runner 禁 dotenv、网络和正常配置，仅允许精确 Python stdin 脱敏子进程。最初完全禁子进程时该 CLI 合同被隔离守卫拦截，限定白名单后全部通过，未执行真实 Docker 或部署 smoke。
- **Python 治理：** `python scripts/check_python_governance.py check` 为 `0 errors / 37 warnings`；不把已有复杂度和文件规模警告当作已处理。
- **浏览器抽查：** 无 Browser 插件，使用现有 Playwright/Chrome 和实际挂载本树的 `localhost:6608`。管理员登录后，ML、AI、Agents 三页在 `1440×900` 的首章、目录及第二章切换均正常，无框架错误层、运行错误或失败请求；三页桌面及 AI 页 `390×844` 无页面横向溢出。Agents 学习地图呈现 SVG，导图广场为空，因此未验证真实单张预览。PythonLab 默认 `seq_basic` 的代码区和示例流程正常，仅观察页面自动解析与语法检查，未点击 Run/Debug、保存或调用模型。匿名学习接口 401 与已登录状态分开记录。
- **根脚本与配置：** `node --test scripts/*.test.mjs` 为 **82 passed / 0 failed / 0 skipped**，包括 61 项工作流、十项 Markdown、六项环境合同和五项清理/catalog 合同；目录同步检查、版本一致性、开发/生产 Compose config 及八个 Bash 入口语法检查均通过。
- **缓存清理：** 按最终预览精确清理 **69 项、7012 KiB** 的已忽略测试/Python缓存，实际删除集合与预览完全一致；清理后预览为零项。未纳入浏览器转储、`.codex/`、其他工作树、依赖、构建或业务数据。
- **文档派生摘要：** Markdown checker 与十项合同通过，为 `140 files / 624 links / 0 missing`，`git diff --check` 通过。
- **既有改动保护：** 主目录 HEAD、Git 状态及九个初始 dirty 文件 SHA-256 全部未变；发布工作树的 AGENTS、开发 Compose、DEPLOY 三份原有修改按 SHA-256 保持，原 TEST_STATUS 内容完整保留，仅更新日期并新增本节。
- **证据与限制：** 初始 patch、内容校验、测试、lint 对照及 agent 结果位于 `.codex/project-consolidation-2026-10-19/`；浏览器截图位于 `/tmp/wangsh-consolidation-ui-20261019/`。本轮不是全量后端、真实 PostgreSQL/Redis/模型、PythonLab Chrome/WebKit 调试、生产部署或用户视觉终验。后续异步分页、隐私闭环和高风险架构问题仍留在当前整理台账。

## 2026-10-18 Docker Hub 发布与依赖标签整理（已完成，服务器未部署）

- **远端发布：** Docker Hub 上的六个 `shuhao07/*:2.1.4` 均可读取，registry manifest digest 与 `/Users/wsh/wangsh/.codex/releases/2.1.4/release-set.txt` 完全一致，并包含 `linux/amd64`。正式发布对应 GitHub Actions run `39128634727`，源码提交为 `4656faec87b989e15c20028d01011c64e4222c0f`；没有重复覆盖正式标签。
- **当前业务标签：** `shuhao07/wangsh-backend:2.1.4`、`shuhao07/wangsh-frontend:2.1.4`、`shuhao07/wangsh-gateway:2.1.4`、`shuhao07/wangsh-typst-worker:2.1.4`、`shuhao07/wangsh-pythonlab-worker:2.1.4`、`shuhao07/pythonlab-sandbox:2.1.4`。
- **依赖标签：** 统一保留官方有效标签 `postgres:16-alpine`、`redis:7-alpine`、`node:20-alpine`、`adminer:4.8.1`。已精确删除无人引用的 `postgres:16-alpine-amd64` 和 `redis:7-alpine-amd64`；没有升级依赖，也没有把官方依赖重复推送到 WangSh 仓库。
- **本机快照：** 当前共 10 个镜像标签（6 个业务 + 4 个官方依赖）；7 个运行容器保持原 ID、正常运行且零重启，6 个数据卷保留。首页、后端和前端代理健康检查仍为 HTTP 200 / healthy。
- **验证记录：** `verify-release-set` 退出码为 0，输出 `version=2.1.4 images=6`；远端 manifest 和依赖整理证据位于 `/Users/wsh/.codex/artifacts/wangsh-hub-tags-20261018/review-221903/`。
- **文档门禁：** `node scripts/check-markdown-contracts.mjs`（137 files / 534 links / 0 missing）、`node --test scripts/markdown-contracts.test.mjs`（10 tests passed）和 `git diff --check` 均通过。
- **边界：** 镜像已提交 Docker Hub，可供后续服务器部署拉取；本轮没有执行服务器部署、代码提交/推送、数据迁移或生产环境切换。正式业务镜像当前验证平台为 `linux/amd64`。

## 2026-10-18 镜像命名规范与版本辨识（依赖整理前的记录）

- **规范：** 部署指南集中维护开发 `:dev`、清理长日期/工作树名/无引用 `latest` 及版本身份核对流程；AGENTS 提供默认入口。开发 Compose 镜像名称已在上一轮显式固定。
- **新鲜核对：** 当前工作树与远端 main 均为 `1db95a9`，版本一致性检查为 `2.1.4 / 2.1.4`。已完成的构建 39128634727 实查 success，正式后端 registry digest 与原 release-set 一致。
- **运行辨识：** 开发容器仍挂载当前工作树代码，但环境中的 APP_VERSION 保留创建时的 2.1.3；旧验证栈 2.2.0 不是最新正式发布。命名、Compose 和文档的本地修改尚未构成新正式版本。
- **文档检查：** Markdown 派生摘要为 `137 files / 534 links / 0 missing`；文档和配置 diff 无空白错误。
- **边界：** 本节记录依赖整理前的状态；后续 Docker Hub 发布核对和依赖标签整理以本页顶部的最新条目为准。


## 2026-10-19 本机退役 2.1.4 并切换正式镜像 2.1.5（已完成）

- **正式镜像核验：** 从 Docker Hub 按发布清单逐个拉取六个 `shuhao07/*:2.1.5` 镜像；远端 tag、拉取后的 RepoDigest 均与 `.codex/releases/2.1.5/release-set.txt` 一致，平台为 `linux/amd64`。发布源码为 `d078fec19cc6500d39e08ac55ddbf4ab8c079003`；本地同版本候选标签已替换为清单指定的正式镜像，未推送或覆盖远端标签。
- **服务切换：** 仅重建 backend、typst-worker、pythonlab-worker，使用正式 `2.1.5` 作为源码挂载开发环境的运行基础；后端和 PythonLab worker 的按需沙箱引用同步为 `shuhao07/pythonlab-sandbox:2.1.5`。配置比对确认只有镜像、`APP_VERSION`、`PYTHONLAB_SANDBOX_IMAGE` 改变，命令、用户、工作目录、挂载及其他业务环境配置保持。PostgreSQL、Redis、前端与 Adminer 四个容器 ID 未变，全部六个数据卷和原有网络保留。
- **精确删除：** 上轮已移除旧前端/网关；本轮进一步删除剩余四个 `2.1.4` 镜像及六个被正式镜像替代的本地候选镜像。本机仅余六个正式 `2.1.5` 业务镜像与四个官方依赖，`2.1.4` 和 dangling 镜像均为零；未使用强制删除或全局 prune，共享 BuildKit 缓存保留。
- **备份与数据：** 开发库已完成 `pg_dump -Fc`，文件非空且 `pg_restore --list` 可读取目录；未执行恢复演练。切换前后 51 张表的逐表记录数一致，合计 65 行，结构摘要与 Alembic revision `f1a2b3c4d5e6` 均不变，未执行数据库迁移。切换前两个 worker 的 active/reserved/scheduled 均为零。
- **运行验证：** 七个容器全部运行且重启计数为零，四个有健康检查的服务均 healthy；首页、直接与前端代理的健康接口均 HTTP 200，API 显示 `2.1.5`。两个 Celery worker 均响应 `pong`，分别监听 `celery` / `typst`；Typst 实际生成有效 PDF，`linux/amd64` 沙箱在无网络、只读根文件系统和非 root 用户下执行 Python 并导入 debugpy。新应用容器启动后的日志未发现 ERROR / CRITICAL / Traceback 或 HTTP 5xx。
- **证据与复用：** 备份、配置前后快照、digest 核验、删除日志和验证结果位于 `/Users/wsh/.codex/artifacts/wangsh-retire-2.1.4-20261019/`。当前覆盖文件仍为 `.codex/docker-release-only-2026-10-18/compose.release-images.yml`，内容已更新为 `2.1.5`；完整复用命令与接力摘要见 `.codex/docker-release-only-2026-10-19/HANDOFF.md`。原有源码及未提交改动保留。
- **边界：** 本轮只操作本机，没有删除 Docker Hub 历史标签、部署服务器、提交/推送代码或验证真实模型与完整浏览器业务链路；前端仍由原开发容器提供，不将基础检查视为正式前端镜像部署或视觉验收。

## 2026-10-19 本机 Docker 精确清理（已完成）

- **删除范围：** 仅删除确认无容器引用、也未被当前 Compose/覆盖配置使用的 `shuhao07/wangsh-frontend:2.1.4`、`shuhao07/wangsh-gateway:2.1.4`，以及本轮检查临时拉取的 `alpine:3.20`。均为精确 `docker image rm --no-prune`，没有使用全局 prune 或强制删除。
- **保留范围：** 运行中的 `2.1.4` 后端、Typst worker、PythonLab worker 及其按需沙箱 `shuhao07/pythonlab-sandbox:2.1.4` 保留；本地 `2.1.5` 六个镜像候选保留但未视作已核实正式发布；`postgres:16-alpine`、`redis:7-alpine`、`node:20-alpine`、`adminer:4.8.1`、6 个卷、活动网络和共享 BuildKit 缓存均保留。
- **运行验证：** 7 个原容器 ID 未变且全部运行，后端、PostgreSQL、Redis 和前端健康状态正常；首页、前端代理健康接口、后端健康接口均返回 HTTP 200，接口版本为 `2.1.4`；PythonLab 与 Typst Celery worker 均返回 `pong`，两个节点在线。
- **现场事件：** 清理后的并行复核期间观察到现有 7 个容器均已停止，原因未确认；未重建或替换容器，按原容器 ID 依次启动后完成上述检查，当前重启计数均为 0。该事件不改变镜像删除范围。
- **当前余量：** 业务旧版中仍被运行配置引用的 4 个 `2.1.4` 镜像继续保留；未发现 dangling 镜像。BuildKit 约 4.8 GB 为共享 builder 缓存，未做全局清理。

## 2026-10-18 本地仅保留正式版 2.1.4（已执行）

- **镜像整理：** 六个 `shuhao07/*:2.1.4` 均与归档 release-set 的 digest 一致；精确删除三个旧 `:dev` 和六个历史验证 `:2.2.0` 镜像，无强制删除。当前项目镜像仅六个正式版，另保留必要的官方基础镜像。
- **运行栈：** 退役 `wangsh-remediation-v9` 的七个容器及专用网络；开发后端与两个 worker 改用正式镜像作运行基础，源码挂载、数据目录、命令、用户及业务环境配置保留，仅调整版本与沙箱镜像。PostgreSQL、Redis、前端和 Adminer 容器未重建，全部六个原有数据卷保留。
- **已验证：** 本地首页、后台页面 HTML、直接与前端代理的健康接口均 HTTP 200；后端 readiness 为 healthy，两个 Celery worker 分别响应并监听 `celery` / `typst` 队列，三个替换容器重启次数均为零。Typst 实际生成 PDF，沙箱在无网络、只读根文件系统下完成基础 Python 执行；切换后的三个服务日志未发现 ERROR / CRITICAL / Traceback 或 5xx。
- **数据核对：** 开发库 51 张表的逐表记录数不变，合计 64 行；归一化 schema 摘要及 Alembic revision `f1a2b3c4d5e6` 不变。两套数据库已分别完成自定义格式备份、非空与目录读取校验，未做恢复演练。
- **证据与启动：** 受限权限证据、备份及切换前配置位于 `/Users/wsh/.codex/artifacts/wangsh-release-only-20261018/continuation-220056/`；本地启动覆盖文件及完整复用命令见 `.codex/docker-release-only-2026-10-18/HANDOFF.md`。覆盖文件显式保留活动工作树的 PythonLab 工作目录及当前跨域配置。
- **边界：** 本节记录 Docker Hub 发布核对前的本机镜像整理与基础运行验证；后续发布状态以本页顶部条目为准。服务器仍未部署，未运行数据库迁移、未验证真实模型请求或完整业务/浏览器调试链路。前端仍由原开发容器提供源码页面，不把本轮 HTTP 检查描述为正式前端镜像或视觉验收。

## 2026-10-18 v2.1.4 检查与镜像推送（完成，服务器未部署）

- **源码：** [PR #4](https://github.com/shuhao0727/wangsh/pull/4) 的全部六项检查通过后正常合并到 `main`。镜像源码 commit 为 `4656faec87b989e15c20028d01011c64e4222c0f`；当前记录属于随后的文档提交，不改变镜像中的业务代码。
- **发布流程：** [dockerhub-amd64 39128634727](https://github.com/shuhao0727/wangsh/actions/runs/39128634727) 成功，source-guard、完整 quality-gate、六镜像构建/推送、staging 与正式 digest 核对、release-set 产出全部通过；`push_latest=false`，旧版本与 `latest` 未覆盖。
- **完整 CI：** 镜像流程使用临时 PostgreSQL/Redis，执行 legacy baseline/bootstrap、Alembic 与后端覆盖率测试，结果 `3442 passed / 241 skipped / 14 warnings`；241 项条件测试跳过，不算验收通过。前端全量 Vitest 100 文件 / 723 项、类型检查、lint、生产构建、包体预算与脚本 30 项通过。PR 的 PythonLab owner-concurrency 与 Phase C 运行门禁均通过，包括真实浏览器点击。AI伙伴另有本地 4 文件 / 55 项通过。
- **发布阻断修复：** 固定尺寸改为共享 4px 网格与 1px 边界，UI 审计由 991 降到 901，原阈值 912 和审计器保持；token 检查 `0 undefined tokens across 2066 references`。SSE 测试只对注入超时保留 30ms，正常核验恢复原 2s 预算，严格错误码断言不变；外部禁 dotenv、禁网络、合成配置运行器验证 24 项及 50ms 延迟场景 3 项通过，延迟场景修复前复现 3 个失败，应用认证代码未改。锁文件补齐 3 个 `@emnapi` 间接依赖，已锁定版本未升级；独立空依赖卷标准 `npm ci`、30 脚本、723 测试与类型检查通过。GitHub 构建通过已有 build args 使用 Docker Hub 官方基础镜像，解决 ECR 429 阻断。前后端 context 排除私有环境文件。
- **正式镜像验证：** 本机再次执行 `ENV_FILE=.env.example bash scripts/deploy.sh verify-release-set`，六个 registry digest 全匹配；另读取正式 manifest 验证六镜像包含 `linux/amd64`。实际 staging 后端镜像在 `--network none`、不导入业务 app 的容器中检查 `python-multipart=0.0.32`、`fastapi=0.128.0`、`redis=7.1.0`，其 digest 与正式后端镜像一致。
- **清单与证据：** GitHub artifact 为 `release-set-39128634727`。本地持久副本在 `/Users/wsh/wangsh/.codex/releases/2.1.4/`，包含 `release-set.txt`、`source.json`、`workflow-status.json`、`platforms.json`、`registry-verification.log`、`backend-quality.log` 和 `backend-package-check.log`；release-set SHA-256 为 `3c08f582ce5df1071814bc35daaa81c3a5b7bae7249ae80df51be083b892c71b`。卡片尺寸仍约 185px、按钮 32px，无横向溢出，复核图为 `/tmp/wangsh-release-ui-2.1.4.png`。
- **保护与边界：** 主工作树 6 个原有未提交文件按 SHA-256 保持原样，当前开发与 remediation 栈均未重建或停用；只清理本次新建的临时 npm 依赖卷。未部署服务器、迁移正常业务库、修改真实业务数据或调用真实模型。CI 与镜像通过不代替生产数据迁移、认证受控切换、模型配置和生产环境运行验收。
- **其他门禁：** 根合同 76 项、更新后的 workflow 合同 60 项、Compose 开发/生产配置和 Bash 语法通过；文档派生摘要 `137 files / 531 links / 0 missing`，`git diff --check` 通过。

| 镜像 | 正式标签 digest |
|---|---|
| `shuhao07/wangsh-backend:2.1.4` | `sha256:357a19b674f8bd66232c7cc4651d19d2dea22e4a328b163b54c3cc84c371c2c7` |
| `shuhao07/wangsh-typst-worker:2.1.4` | `sha256:20d1278515bec5cd9ec34104a462686295857e5d2420e1257ca4f89d4f1724c2` |
| `shuhao07/wangsh-pythonlab-worker:2.1.4` | `sha256:965cb33a38feaeb93547db198c5650145ef9d0d5d4e5577f4563efabc202dda7` |
| `shuhao07/pythonlab-sandbox:2.1.4` | `sha256:79090cf4c11d07ad0813089ee66e4aa37c879820663bd3633bae0a3deefa673b` |
| `shuhao07/wangsh-frontend:2.1.4` | `sha256:fc39ff26054dbebae9697271c93be5a37d19679a013a46c724505e2c6012a172` |
| `shuhao07/wangsh-gateway:2.1.4` | `sha256:486b22c35e2432320ca29cd764daac31680d950ba4c2f08b7a5c8c2df7ea9332` |

## 2026-10-18 信息技术应用管理卡片返工（用户已认可）

- **范围：** 用户否定连续列表，明确偏好卡片；本轮仅重做 `/admin/it-technology` 主管理页面。9 项应用采用三列卡片，分类为轻量标记，图标、名称和短说明同层组织，开关与管理动作融入浅色底栏；未修改共享卡片或其他页面。
- **尺寸与视觉复核：** 当前已登录内置浏览器实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`、`390×844`。四档桌面均为三列三行，卡片高约 185px，列表底部位于约 655–658px；按钮高 32px。页面无横向溢出，名称、摘要、底栏和按钮无横向裁切。按容器宽度自动减为两列或一列，窄屏纵向滚动。
- **真实交互：** 人工智能探索内容管理进入与返回、Python 智能体配置弹层打开与取消通过；Tab 从随机点名开关进入同卡片管理按钮，焦点可见。未切换真实功能开关，未保存、上传、发布、删除或调用模型；机器学习缺书自动初始化入口仍未点击。
- **工程检查：** 前端类型检查通过；相关 2 个测试文件共 5 项通过，覆盖公共状态部分失败、超级管理员加载失败时禁止开关写入，以及已知状态的模拟保存。当前页面与回归测试 ESLint 无 error / warning；token 检查为 `0 undefined tokens across 1943 references`；Markdown 合同 `137 files / 526 links / 0 missing`、合同测试 10 项与 `git diff --check` 均通过。
- **证据与验收：** `/tmp/wangsh-it-admin-cards/` 保存 5 档截图、`metrics.json` 与 `interactions.json`。用户已认可卡片版并授权进入发布准备；此前列表截图仅保留为历史证据。

## 2026-10-18 信息技术应用管理列表返工（已被卡片方案替代）

- **范围：** 仅 `/admin/it-technology` 主管理工作区；上一版两列长条布局被用户否定。现改为连续分组列表，分类、应用信息、前台入口和管理动作使用稳定列位置，未修改共享应用卡片或其他页面。
- **尺寸与视觉复核：** 当前已登录内置浏览器实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`、`390×844`，页面宽度均与视口一致，应用名称、摘要和按钮无横向裁切。桌面列表高度约 706px，9 项均可在最小桌面视口内完整显示；按钮实测 32px，入口开关约 32×18px，状态与操作列逐行对齐。窄屏改为信息行与操作行，可纵向滚动。
- **真实交互：** 人工智能探索、智能体探索的内容管理与返回、Python 智能体配置弹层打开及取消、游戏资源库导航通过；Tab 可从入口开关进入相邻管理按钮，焦点环可见。未执行真实开关切换、保存、上传、发布、删除或模型请求。机器学习管理入口因既有自动创建逻辑未点击，沿用上批数据边界。
- **工程检查：** 前端容器类型检查通过；功能开关异步与游戏资源权限相关 2 个测试文件共 5 项通过，覆盖公共状态部分失败、超级管理员加载失败时禁用开关，以及已知状态的模拟保存与更新。CSS token 为 `0 undefined tokens across 1962 references`。当前页与测试 ESLint 无 error / warning；Markdown 合同为 `137 files / 526 links / 0 missing`，合同测试 10 项通过，`git diff --check` 通过。
- **证据：** `/tmp/wangsh-it-admin-redesign/` 保存 5 档截图、`metrics.json`、`interactions.json` 和键盘焦点截图。此列表布局已被用户否定，不作为当前视觉方案；历史测试事实不等于视觉认可。

## 2026-10-18 内容管理与专用编辑器批次（待用户视觉确认）

- **工作区：** 本地 `claude/beautiful-satoshi-b71479` worktree，`localhost:6608` 的 `wangsh-frontend` 绑定其 `frontend/`。保留既有未提交改动，本轮没有提交、发布或修改数据库结构。
- **页面范围：** 路线图第 10–19 项：信息学 Typst 编辑器、信息技术管理、游戏资源库管理、ML 书籍编辑器、学习内容编辑器、学习页签编辑器、思维导图编辑器、个人程序管理、系统设置、游戏密码池配置。
- **实现：** 管理入口改为紧凑条目；空数据和错误态保留游戏搜索/分类；学习编辑器只保留一套工作区顶栏与章节目录，预览使用当前编辑副本；ML 编辑器修正横向分屏和正文填充高度；Typst 侧栏、正文、工具行压平，窄屏退出隐性分屏；系统配置与密码池表单减少重复框和标题。
- **尺寸检查：** 使用当前已登录的内置浏览器实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`、`390×844`，10 个页面族共 50 组尺寸记录，页面 `scrollWidth` 均未超过实测视口宽度。截图使用减少动态效果的浏览器模拟设置，保存前复核了可见页面；临时视口和模拟设置在收尾恢复。
- **真实交互：** 游戏空库下搜索输入保留、分类菜单打开与 Escape 关闭；学习编辑器编辑/预览切换可显示未保存文本，窄屏章节选择可进入 KNN 章节；系统与 Typst 页签切换正常；Typst 窄屏由分屏转为编辑。未触发保存、发布、删除、上传、开关写入、PDF 清理、编译或模型请求。
- **ML 书籍数据边界：** 当前公开接口返回 `book: null`。该管理编辑器原有缺书自动创建逻辑保持不变；检查时在浏览器临时阻断该书籍 API，避免自动创建，完成空态布局和分屏尺寸检查后离开该页并清除阻断。复查公开接口仍为 `book: null`。本轮不代表已验证真实书籍、章节排序或保存流程；该页未作为可直接操作的浏览器标签保留。
- **其他数据边界：** 游戏资源库与结构化实验内容当前为空；思维导图只检查编辑区，真实非空画布渲染和保存没有覆盖。Typst 只检查新建空稿和布局，预览/编译会涉及写请求，未触发。临时编辑文本随导航丢弃，没有保存。
- **工程检查：** 前端容器类型检查通过；相关 3 个测试文件共 12 项通过，其中补充空库仍可搜索/分类的回归断言；本批涉及文件的 ESLint 为 0 error、55 warning（保留既有未使用导入、any 与 Hook 依赖警告）；CSS token 检查为 `0 undefined tokens across 1928 references`。Markdown 合同为 `137 files / 526 links / 0 missing`，合同测试 10 项通过，`git diff --check` 通过。
- **证据：** `/tmp/wangsh-ui-batch10-19/` 中包含各页 `1440`/`390` 截图、`metrics.json` 和 `interactions.json`。该目录为本机临时证据，不进入仓库。路线图保持“待用户确认”。

## 2026-10-18 游戏、思维导图与智能体学习尾批（承接记录，用户已认可）

- **实现范围：** 路线图第 42–46、49 项，共 6 页：智能体全屏学习、游戏入口、密码锁游戏、思维导图广场、无数据预览和 404。`/xbk` 保持视觉基准，`/login` 保持现状。
- **承接验证：** 前轮已检查四档桌面与 `390×844`，无页面级横向溢出；错误密码反馈、切换锁类型后清空尝试、空预览返回广场、404 返回 `/home` 已通过。前轮相关 3 个测试文件共 12 项通过，类型检查与 token 检查通过；本轮仅承接并补全文档，不重复声称重新验收这些页面。
- **证据与边界：** 截图为 `/tmp/wangsh-ui-batch42-{agents,games,lock,mindmaps,preview,notfound}-{1440,390}.png`。前轮独立会话未登录，学习与个人导图接口有 401；公开导图为空，非空卡片未验收。用户已认可前批整体效果并要求继续，路线图对应项更新为已完成；该认可不覆盖上述未测业务流。

## 2026-10-17 当前页面整理状态

- **已确认页面：** 用户已确认 `/admin/agent-data?tab=usage` 的本轮整理效果；该页面在路线图中标记为 `已完成`。
- **已确认页面：** `/admin/articles` 已完成本轮布局调整并经用户确认；路线图已标记为已完成。
- **已确认页面：** `/admin/assessment` 与 `/admin/users` 已完成代码整理和工程验证，用户已查看并确认整体效果；尚未覆盖的真实数据业务流仍按下方记录处理。
- **当前批次：** `/admin/ai-agents`、`/admin/group-discussion`、`/admin/classroom-interaction`、`/admin/classroom-plan`、`/admin/informatics`，按用户要求由多 agent 并行整理；代码复核及工程检查完成，等待用户视觉确认。
- **复用规则：** 后续页面遵循 [EMBEDDED_UI_STYLE_GUIDE.md](../frontend/EMBEDDED_UI_STYLE_GUIDE.md) 中的统计层级、操作占位、空状态连续性、控件尺寸、分组工具栏和表格内部横向滚动规则。

## 2026-10-18 测评、任务分析、仪表盘与公共文章页（待用户视觉确认）

- **页面实现：** `/admin/assessment/editor/new|:id` 收紧表单工作区并移除重复返回栏；`/admin/assessment/:id/questions` 统一基本设置、固定题和自适应题工作区；`/admin/assessment/:id/statistics` 统一返回区、错误状态、筛选、图表和结果面板；`/task-analysis/new` 将四步向导、表单、进度和确认操作统一为轻边界专用工作流；`/task-analysis/compare`、`/task-analysis/:analysisId`、`/task-analysis/hot/:analysisId`、`/task-analysis/chains/:analysisId` 复用连续的任务分析结果布局；`/admin/dashboard` 和 `/articles` 完成状态区、服务检查、搜索、分类、列表与分页的嵌入式整理。
- **工程验证：** 前端容器 `npm run type-check`、`npm run test`、`npm run lint`、`npm run build` 全部 exit 0。测试通过；lint 为 469 条既有 warning、0 error；build 仅保留依赖 `eval` 和大 chunk 警告。`git diff --check` 通过；Markdown 合同更新后为 `137 files / 526 links / 0 missing`。
- **浏览器复核：** 使用已登录 Playwright 会话检查测评编辑器、题目管理、测评统计错误态、任务分析新建页、对比错误态、结果不存在错误态、后台仪表盘和公共文章页；任务分析新建页额外检查 `390×844`，步骤栏、表单控件和下一步操作未横向溢出。编辑器重复返回栏已在复核后修正。
- **数据边界：** 当前本地数据没有有效测评统计或任务分析记录，统计和任务分析结果页只覆盖错误/空状态；未执行创建测评、保存题目、导出分析、删除、发布或模型请求。路线图中本批页面保持 `待用户确认`，等待用户查看实际效果。

## 2026-10-18 公共内容与学习工作区批次（待用户视觉确认）

- **页面范围：** `/articles/demo-style-terminal`、`/informatics`、`/informatics/55`、`/it-technology`、`/it-technology/games`、`/it-technology/python-lab/seq_basic`、`/personal-programs`、`/ai-agents`、`/it-technology/ml`、`/it-technology/ai`。首页按用户要求保持原样，不纳入本批检查。
- **浏览器与断点：** 本地 Playwright CLI 检查 `1280×800`、`1440×900`、`1680×1050`、`1920×1080` 和 `390×844`。所有可渲染目标页的 `documentElement.scrollWidth` 与视口一致；没有发现页面级横向溢出。阅读器和信息技术入口另检查了桌面、窄屏截图。
- **页面交互：** 从文章卡片打开终端风格详情，再返回文章列表；ML、AI 阅读器的目录抽屉分别打开并用 Escape 关闭。抽屉含读屏标题和说明，复测时控制台为 0 error / 0 warning。AI 对话未发送消息，未触发模型请求。
- **页面状态与数据边界：** `/informatics` 当前无已发布内容，`/informatics/55` 返回预期的“内容不存在”404；游戏资源库为空。PythonLab 只检查默认实验 `seq_basic` 的画布、编辑器、控制栏和终端状态，未点击 Run、Debug、Pause、Continue 或 Reset。未保存学习进度或修改业务数据。
- **本轮修正：** 信息技术入口三张学习卡片的统计说明压缩为完整可读的短文案；ML/AI 阅读器将窄屏目录与回到顶部操作移入正文外的底部工具行，避免浮层遮挡正文，并为目录弹层补齐无障碍标题与描述。
- **工程检查：** 在当前前端容器执行 `npm run type-check`，exit 0；`git diff --check` 无输出。未提交或发布。
- **证据：** 桌面/窄屏截图保存在 `/tmp/wangsh-ui-article-detail-1440-final.png`、`/tmp/wangsh-ui-article-detail-390-final.png`、`/tmp/wangsh-ui-it-technology-final-1440.png`、`/tmp/wangsh-ui-it-technology-final-390.png`、`/tmp/wangsh-ui-pythonlab-initial-1440.png`、`/tmp/wangsh-ui-pythonlab-initial-390.png`、`/tmp/wangsh-ui-ml-after-1440.png`、`/tmp/wangsh-ui-ml-after-390.png`、`/tmp/wangsh-ui-ai-after-1440.png` 和 `/tmp/wangsh-ui-ai-after-390.png`。页面仍待用户视觉确认。

## 2026-10-17 五个后台页面嵌入式整理（待用户视觉确认）

- **页面实现：** `/admin/ai-agents` 将统计摘要与搜索、筛选、管理动作合并为同一条顶部工具带，表格和分页仍在同一工作区；`/admin/group-discussion` 整合筛选及会话操作，搜索 landmark 仅包含查询表单，导出和学生端开关留在工具栏；`/admin/classroom-interaction` 整合筛选、批量操作、刷新/创建、列表与分页，并区分空数据与无匹配结果；`/admin/classroom-plan` 移除列表/详情内层卡片，保留分栏；`/admin/informatics` 整合筛选、操作、表格与分页。
- **环境与代码检查：** 前端容器 `wangsh-frontend:/app` 挂载当前 worktree。`npm run type-check` 通过；全量 `npm run test -- --reporter=dot` 为 **100 个测试文件、719 项通过**；`npm run token:check:ci` 为 `0 undefined tokens across 1859 references`；`node scripts/check-markdown-contracts.mjs` 为 `137 files / 526 links / 0 missing`；`git diff --check` 通过。
- **页面可达性：** 四个独立路由及课堂互动路由通过本地 HTTP 返回 200，但这只确认 Vite 页面外壳可达，不代表登录后的 React 页面渲染或业务操作通过。
- **智能体管理视觉复核：** 已在当前已登录 Chrome 页面检查，统计摘要、搜索、类型筛选、重置和新建位于同一顶部工具带；当前 `1728×906` 视口 `document.scrollWidth` 等于视口宽度，搜索框高度为 `36px`，未发现横向溢出。
- **视觉验收边界：** Chrome 新标签创建时 CUA 会话断开；本批没有完成截图、断点尺寸测量或页面内交互检查，不记录为视觉验收通过。用户确认前路线图状态保持 `待用户确认`。
- **数据边界：** 本轮未执行新建、编辑、删除、发布、活动启停、GitHub 同步或学生端配置切换；批量删除及真实记录下的分页和筛选也未实测。

## 2026-10-17 后台文章管理页嵌入式整理（用户已确认）

- **实现：** `frontend/src/pages/Admin/Articles/index.tsx` 将筛选控件和页面动作分组，桌面维持左右分布，窄屏筛选并排且操作统一成组；表格最小宽度作用到实际 `<table>`，在内部滚动容器横向滚动，避免响应式规则压缩列宽。
- **桌面浏览器：** Chrome/Playwright 实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`；页面 `scrollWidth` 与视口一致，工具栏维持单行，表格适配工作区宽度。
- **窄屏浏览器：** `390×844` 下筛选为并排双控件，页面动作另成一组；表格本体宽 `1100px`，在约 `366px` 的内部容器滚动，日期和标题列不再被挤成竖排，页面无横向溢出，分页可见。
- **交互：** 搜索 `terminal` 筛出对应示例文章，清空恢复 3 条；分类菜单打开和 Escape 关闭通过，当前数据仅提供“按分类筛选”选项；勾选一条文章后出现“批量操作 (1)”菜单，菜单项可见，取消后批量入口消失。未执行批量发布、转草稿、删除、单篇状态切换或文章编辑/保存。
- **数据边界：** 当前页显示 3 条本地示例文章且均未分类；未覆盖有分类文章、真实分页、空结果、错误/加载状态和真实文章数据下的编辑流程。
- **工程验证：** `docker exec wangsh-frontend sh -lc 'cd /app && npm run type-check'` exit 0；DataTable 测试 3/3 通过，CSS token 检查为 `0 undefined tokens`，Markdown 合同 10/10 通过，`git diff --check` 通过。首次未登录访问时 `/api/v1/auth/me` 返回 401；登录后页面正常，后续交互未产生新增控制台错误。用户已确认视觉效果。

## 2026-10-17 测评配置与用户管理页整理（用户已确认）

- **测评配置 `/admin/assessment`：** 筛选控件与主操作分组，普通筛选为 36px、行内动作约 32px；知识点和计数改为紧凑文本，去掉重复空状态 CTA，并区分筛选无结果与无配置。
- **用户管理 `/admin/users`：** 统计改为无底色摘要行，搜索/角色/状态筛选与模板/导入/批量删除/新建按组排列；用户详情从嵌套小卡片改为连续字段行，行内图标操作使用 28px token。表格实际最小宽度按列宽设为 1044px，由表格容器内部横向滚动。
- **工程验证：** 前端容器 `npm run type-check` exit 0；用户导入交互测试 8/8、测评 API 合同测试 2/2 通过；测评类型测试 5/5 通过；ESLint 无错误（测评页保留 3 条既有 `any` 警告）；Markdown 合同 `137 files / 526 links / 0 missing`，`git diff --check` 通过。
- **浏览器状态：** 用户已在浏览器查看并认可两页整体效果；当前记录不代表四档桌面尺寸和窄屏的逐项量测均已完成。开发容器为 Alpine，Playwright Chromium 启动时缺少 `glib-2.0`、`nss3` 等系统运行库。
- **数据与交互边界：** 用户管理页面类型检查和既有导入测试通过；未验证真实用户筛选、行选择、分页、详情、编辑、删除、导入流程。测评配置真实列表、筛选、切换状态、新建和删除流程同样未在浏览器中操作。
- **验收状态：** 用户已确认两页整体视觉效果，路线图状态更新为已完成；真实数据筛选、分页和写操作仍未由本轮记录覆盖。

## 2026-10-17 页面整理路线图登记

- **范围：** 新增 [UI_REDESIGN_ROADMAP.md](../frontend/UI_REDESIGN_ROADMAP.md)，按当前 `frontend/src/App.tsx` 登记 49 个页面族，并区分公共页面、后台页面、任务分析页面、专用布局页面、重定向入口和重点浮层。
- **推进方式：** 以后每次只处理一个页面族；完成代码调整后在四档桌面尺寸进行真实浏览器检查，记录控件尺寸、嵌入关系、交互回归和未覆盖边界，再进入下一项。
- **当前顺序：** `/xbk` 是已确认的视觉基准；`/admin/agent-data` 已完成并经用户确认；`/admin/articles` 整理后等待用户视觉确认，后续为 `/admin/assessment`；其余页面保持待处理或专用布局状态。
- **文档门禁：** Markdown 派生摘要为 `137 files / 526 links / 0 missing`；本次未新增业务测试或运行时断言。

## 2026-10-17 智能体数据页嵌入式整理

- **实现：** 调整 `frontend/src/styles/ui-polish.css` 中 AgentData 筛选布局。宽度达到 1680px 时关键词、日期、五个条件和操作收为一行；1280px 与 1440px 时保留关键词/日期行及条件/操作行，查询与重置留在条件同行。手机断点将筛选字段改为两列，避免控件被挤窄；原控件 36px 高度、主色查询按钮和现有工作区边界保持。
- **桌面浏览器：** 已在 Chrome 实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`；页面无横向溢出，行数符合对应断点，查询和重置未掉到单独第三行。
- **窄屏浏览器：** `390×844` 下五个条件输入为两列，单项约 179px，页面 `scrollWidth` 等于视口宽度；表格保留内部横向滚动。
- **交互：** 搜索字段输入、查询和重置通过；“使用记录 / 热点问题 / 学生问题链”切换及 URL 参数同步通过；智能体下拉选项实测 28px，Escape 可关闭。当前接口返回空记录，未验证真实记录的选择、详情和导出数据流。
- **工程验证：** `docker exec wangsh-frontend sh -lc 'cd /app && npm run type-check'` 通过。首次宿主机检查因未安装 TypeScript 依赖失败，不作为项目结果。
- **阶段边界：** 当时完成了筛选布局和已有交互检查；随后用户指出统计区、导出操作位置和空状态区域仍不协调，页面重新进入视觉调整，尚未验收，不进入 `/admin/articles`。

## 2026-10-17 智能体数据页二次视觉返工（待用户确认）

- **统计区：** 七个指标从等宽分散改为“核心数量 / 时间范围”两组紧凑摘要，标签与数值同行；仅总使用量保留主色提示，延续 `/xbk` 的行内指标密度。
- **结果工作区：** 记录数量与导出动作相邻；工具栏按钮为 32px。空状态从宽表单元格移到表头下方的工作区覆盖层，避免 1024px 表格最小宽度将手机上的提示推离视口；空数据时结果表区收至桌面约 196px、手机约 168px，白底与页面保持连续。
- **浏览器尺寸：** Playwright/Chrome 实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`、`390×844`；各尺寸 `document.scrollWidth` 与视口宽度相同，空状态可见。截图保存在临时目录 `/tmp/agent-data-accepted-candidate-<宽度>.png`。
- **交互：** 搜索输入与查询、重置清空、热点问题与使用记录切换及 URL `tab` 同步通过；智能体菜单选项约 27px，Escape 关闭；无记录时导出按钮禁用。接口当前返回空记录，真实记录的选择、详情和导出仍未覆盖。
- **工程验证：** 前端容器 `npm run type-check` 通过；DataTable 测试 3/3 通过；Markdown 合同测试 10/10 通过；`git diff --check` 通过。
- **验收状态：** 代码与浏览器复核已完成，仍待用户确认视觉效果；确认前不开始 `/admin/articles`。

## 2026-10-17 智能体数据页统计与操作区再调整（待用户确认）

- **统计顶栏：** 将统计摘要与三个页签合并到同一条工作区顶栏；总使用量、活跃学生、活跃智能体使用更醒目的核心字号，平均响应和时间范围指标保持较轻层级，避免七项指标平均铺开造成视觉失衡。
- **结果操作：** 移除独立的“共 0 条记录 / 导出会话”结果工具栏。空数据时不显示无效的数量和导出入口；有记录时总数由分页统一表达，有选中会话时显示紧凑的图标导出按钮，减少结果区额外占用并保留真实操作入口。
- **浏览器复核：** Chrome 实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`、`390×844`；统计/页签顶栏在桌面保持单行，窄屏自然折叠，筛选区与空状态均未产生横向溢出，`document.scrollWidth` 与视口宽度一致。
- **当前空状态：** 表头直接连接筛选区，空状态工作区保留约 161px（窄屏约 133px）内容高度；无数据时页面不再显示独立结果工具栏。
- **工程验证：** 前端容器 `npm run type-check` exit 0；`git diff --check` 通过。真实记录下的选中、详情与导出数据流仍未覆盖。
- **验收状态：** 等待用户确认这版统计字号、顶栏关系和操作区位置；确认前不开始 `/admin/articles`。

## 2026-10-17 智能体数据页字号与操作占位微调（待用户确认）

- **统计层级：** 提高三项核心指标的标签与数值辨识度，时间指标保留较轻字号；组内取消逐项竖线，通过间距保持连续阅读，统计与页签顶栏在桌面保持单行。
- **操作占位：** 移除筛选操作旁的结果总数。数据存在时总数由分页统一表达；仅有选中记录时显示导出图标，空数据状态不占用额外操作行。
- **浏览器复核：** Chrome 实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080` 和 `390×844`；视口 `document.scrollWidth` 与宽度一致，桌面顶栏及筛选区未横向溢出，窄屏筛选与空状态可见。
- **工程验证：** 前端容器 `npm run type-check` exit 0，`git diff --check` 通过。当前接口没有使用记录，真实数据下分页总数、选中导出和详情仍未覆盖。
- **验收状态：** 等待用户确认统计字号与整体占位；确认前不开始 `/admin/articles`。

## 2026-10-17 智能体数据页统计密度收紧（待用户确认）

- **统计排版：** 参照 `/xbk` 的行内指标密度，核心指标改为中等字号与稳定行高，主色只用于总使用量数值；时间指标进一步降低字号和对比度，组内使用留白表达关系，避免数字过大或分隔线过密。
- **桌面复核：** 在 `1440×900` 下统计顶栏约 `49px`，统计与页签保持单行；筛选区两行，空数据下未出现结果数量或导出占位，`document.scrollWidth` 与视口宽度一致。
- **窄屏复核：** 在 `390×844` 下统计区、页签、筛选区和空状态均可见，页面 `scrollWidth` 仍为 `390px`，没有横向溢出。
- **工程验证：** 前端容器 `npm run type-check` exit 0，`git diff --check` 通过。当前接口没有使用记录，真实数据下分页、选中导出和详情仍未覆盖。
- **验收状态：** 等待用户确认本轮字号与布局；确认前不开始 `/admin/articles`。

## 2026-10-17 嵌入式工作区重设计与横向排布校正（本地，未提交）

- **范围：** 在实际运行的 `claude/beautiful-satoshi-b71479` worktree 重做共享控件表面、使用记录样板与 XBK 工作区；保留无关未提交改动。前轮逐个控件填充薄荷色的视觉被白底、轻边界与中性表头替代。
- **XBK 两层布局：** 上层摘要左、导入/条件性新增右；下层页签左、导出/分析/删除/刷新右。Chrome 实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`，两层均保持左右分布、无重叠、页面无横向溢出。当前细节基准为侧栏筛选 36px、工具栏动作 32px、页签导航 40px；表头使用极浅工作区底色和 1px 中性边线，文字层级与筛选区统一。旧版 28px 动作和 29–30px 触发框记录保留在历史快照中，不代表当前视觉。
- **XBK 交互：** 原生点击学生名册页签可见“新增”，上栏仍为 49px；已返回选课总表。未改学年、学期、筛选值，未导入、导出、删除或写入数据。
- **XBK 空状态：** 空表行不再响应普通数据行 hover；表格高度填满可用工作区，“暂无数据”垂直居中，Chrome 复核鼠标停留在空状态附近时背景保持连续白色。
- **使用记录：** 连续统计摘要替代彩色胶囊，筛选有可见标签，日期成组；查询紧随条件，导出归入结果工具行。空数据时保留真实表头，调整列宽后四档桌面均可容纳整张表，筛选控件均在区域内；普通输入/选择/查询/重置为 36px，日期组合外层 36px、内部输入 34px，结果区导出为 28px。
- **使用记录交互：** 关键词、学号、姓名输入后查询、重置可用；重置后五个输入值均为空。班级菜单选项为 28px，Escape 关闭正常。结果为空，未验证真实记录的选中导出和详情业务流。
- **共享抽查：** 后台文章页 1280 桌面搜索和分类为 36px 白底，表头采用中性柔色，原有三条文章显示正常；未修改文章或发布状态。
- **工程验证：** 前端容器 `npm run type-check` exit 0；DataTable 测试 3/3、XBK 页面测试 11/11 通过；颜色变量检查无未定义 token。Markdown 合同及 `git diff --check` 通过，文档派生摘要为 `136 files / 517 links / 0 missing`。
- **边界与证据：** 当前为桌面视觉与已有交互复核，未进行全路由、手机、PythonLab 调试、模型请求或生产验收。源文件修改前快照、三行中间版本、最终两行截图、`xbk-two-row-metrics.json` 与 `usage-final-metrics.json` 位于 `/tmp/wangsh-embedded-redesign-20261017/`。截图不进入仓库。

## 2026-10-17 共享控件嵌入式视觉（本地开发 worktree，未提交）

- **历史说明：** 本节记录前轮初版的实现和验证；当前视觉与横向排布以上方重设计记录为准。
- **方向与环境：** 用户确认“控件融入所在区域：按钮、筛选、页签与内容连成整体”。保留原页面布局，在 `claude/beautiful-satoshi-b71479` 的实际前端容器与 Chrome `http://localhost:6608` 验证。
- **共享实现：** 输入、选择与多行输入使用作用域内的表面变量；次级按钮融入所在区域，主色、危险操作、焦点与尺寸保持。工具栏、页签与表格使用细分隔线和柔色表头，取消重复外框、卡片阴影和悬浮位移；弹窗与抽屉内容建立独立作用域。
- **四档桌面：** 后台文章页和使用记录页实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`。可见常规控件均为 36px 且未越界；表格外框为 0，使用记录筛选以 1px 分隔线衔接内容，空状态外层圆角为 0。文章搜索后显示 1 条，清空后恢复 3 条。
- **弹窗与编辑器：** 用户新增弹窗内 Input/Select 为 36px，角色下拉选项为 28px，Escape 关闭菜单、取消关闭弹窗通过；未填写或保存用户。打开现有文章编辑器，标题、分类、样式为 36px，摘要与编辑预览保持专用布局，未改动或保存文章内容。
- **前台抽查：** 文章页在 1280、1440 桌面下可见搜索、分页与内容区域；智能体页、竞赛页、信息技术、个人程序、XBK 及 ML/AI/Agents 独立学习页在 1280 桌面完成截图复核。竞赛页签切换、ML 工具箱切换通过。XBK 筛选框仍为白底，保持原来的紧凑高度。
- **工程检查：** 实际前端容器 `npm run type-check` exit 0；现有 DataTable 测试 3/3 通过；`npm run token:check:ci` 为 `0 undefined tokens across 1853 references`。本批未新增业务测试，样式以真实浏览器与 DOM 尺寸复核。
- **限制：** 使用记录、竞赛内容及部分后台列表为空，未验证这些页面的有数据业务流；学习页仅抽查可见布局及页签，未运行全部实验或保存进度；未发起模型请求、修改数据、测试 PythonLab 调试流程或进行全路由验收。抽屉作用域完成代码核对，未打开抽屉作可见验收。
- **证据：** 本批源文件快照、截图和 `admin-metrics.json`、`usage-metrics.json` 位于 `/tmp/wangsh-control-sizes-20261017/embedded/`，临时证据不进入仓库。浏览器临时视口在收尾时重置。
- **文档派生摘要：** `135 files / 515 links / 0 missing`。


## 2026-10-17 管理端控件尺寸与筛选布局（本地开发 worktree，未提交）

- **环境：** `claude/beautiful-satoshi-b71479`，前端容器 `wangsh-frontend` 的 `/app` 挂载当前 worktree `frontend/`，浏览器目标 `http://localhost:6608`。保留已有未提交改动。
- **工程检查：** 在实际前端容器执行 `npm run type-check`，主应用与 AI伙伴类型检查均 exit 0。宿主机缺少项目依赖、命中全局 TypeScript，宿主检查失败，不作为项目通过证据。
- **使用记录：** Chrome 实测 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`，搜索、日期、下拉、学号姓名与按钮均为 36px 且位于容器边界内；前两档为两行，后两档为一行。查询操作紧随条件组，未出现单独一行的操作按钮。
- **交互：** 关键词、学号姓名查询与重置通过；日期通过原生按键输入后，查询保留完整范围，重置清空。直接自动填日期未触发 React 状态更新的结果不计入通过。
- **其他可见控件：** AI 智能体重置为 36×36px，搜索后重置通过；游戏管理顶部按钮和分页为 36px；信息技术卡片管理按钮为 28px，管理入口可打开游戏资源管理。
- **文章行内：** 编辑和更多按钮为 28px；复选框视觉尺寸保持，标签热区为 28×28px。真实指针点击单行与全选标签的外围区域均可切换选择，验证后已恢复未选状态；更多菜单可打开。
- **未完成的可见数据状态：** 当前测评列表为空，统计筛选区只完成代码核对和类型检查；游戏列表为空，搜索和分类栏被现有空状态隐藏，仅完成代码核对。未将这些范围记为页面验收通过。
- **证据：** 四档使用记录截图与 `usage-metrics.json`、其他页面截图保存在本地临时目录 `/tmp/wangsh-control-sizes-20261017/`；不提交一次性截图或排查脚本。
- **文档派生摘要：** `135 files / 513 links / 0 missing`。

### 下拉选项协调补充

- XBK 学年触发框在默认桌面为 30px、紧凑字号，原选项约 33.85px、字号较大；键盘焦点可叠加全局 2px 紫色外描边。共享 `SelectItem` 与操作菜单选项改为紧凑字号、28px 最小行高，保留浅主色背景焦点，未改动触发框高度或全局焦点规则。
- Chrome 实测 XBK 学年、学期、年级、班级、每页条数选项均为 28px；文章普通操作菜单同为 28px。勾选、单选和子菜单变体完成代码核对，未将未打开的变体计为可见验收通过。
- XBK 学年在实际 `1280/1440/1680/1920` 视口中，选项均为 28px，字号与触发框一致，菜单未越界；原生方向键、回车选择和 Escape 关闭通过，复核后恢复原学年、学期和分页条数。浏览器临时视口已重置，独立检查标签已关闭。
- 本次容器 `npm run type-check` exit 0。原始与调整后截图、`dropdown-metrics.json`、`dropdown-viewport-metrics.json` 位于同一临时证据目录。Command 候选组件未发现调用，本轮保持原样。

## 2026-10-16 契约与文档门禁修复（本次工作区，未提交）

- **范围：** 只改 `scripts/`、`docs/` 与 `.github/workflows/` 下相关文件；未 commit、未 push、
  未触碰 stash。
- **CI 门禁路径修复：** `968ba9f` 把 `ci-quality.yml` backend-pytest job
  （`working-directory: backend`）内的 8 处 `scripts/X.py` 改成 `backend/scripts/X.py`，
  造成 `backend/backend/scripts/...` 双重前缀（CI 第一步 file not found）。本轮改回
  `scripts/`（check_python_governance×4、check_migration_state、bootstrap_db×2、
  check_changed_lines_coverage）；`pythonlab-pr-runtime.yml` 迁移步骤的 3 处同类双重前缀一并
  改回。契约测试期望值不变，`node --test scripts/workflow-contracts.test.mjs` **60 passed**。
- **env-consistency 移植：** CI repo-config 引用的 `scripts/env-consistency.test.mjs` 与
  `scripts/check-env-consistency.mjs` 在 main 缺失（CI 直接挂）。本轮从
  `codex/release-2.2.0-prep` 移植并按当前 `.env.example` 校准；
  `node --test scripts/env-consistency.test.mjs` **6 passed**。
- **Markdown 合同：** `node scripts/check-markdown-contracts.mjs` **exit 0** —
  `135 files / 508 links / 0 missing`。此前 14 条错误全部修复：
  - 7 条断链改指真实文档或删除引用行：`DATA_ARCHIVING.md`×3
    （Celery→`analysis/ASYNC_ANALYSIS.md`、数据库→`DATABASE_PERFORMANCE_GUIDE.md`、
    监控→`operations/MONITORING.md`）、`IMPLEMENTATION_SUMMARY.md`×1
    （数据库→`DATABASE_PERFORMANCE_GUIDE.md`）、`plans/README.md`×3
    （目标文件只活在本地 `stash@{0}`，从未 commit，索引行删除）；
  - 6 条生命周期元数据补齐：`2026-10-09-comprehensive-audit-final-report.md`、
    `2026-10-09-verification-report.md`、`2026-10-10-file-organization-findings.md` 各补
    `> 状态：reference` 与 `> Owner：project-governance`；
  - 门禁盲区修复：`check-markdown-contracts.mjs` 的 `git ls-files` 补
    `-c core.quotepath=false`，两个中文名 md 自本轮起纳入合同检查
    （此前被八进制转义后静默丢弃）。
- **索引一致性：** `docs/docker/plans/README.md` 表格改为如实列出目录内全部 11 个文档
  （此前 3 条指向 stash-only 文件、4 条声称已移除但文件实际仍在）。
- **历史数字更正：** 2026-10-04 一节（见下）声称的「11 条错误已清零」「6 条断链已修复」
  对应改动从未提交，已按实测更正为如实说明。
- **Markdown 合同测试：** `node --test scripts/markdown-contracts.test.mjs` 全 pass。
- **行尾空白：** 清理 `docs/` 下 12 个文件的 `git diff --check` 行尾空白（只删空白字符，
  不改正文内容）；`git diff --check HEAD` 无输出。
- **边界：** 未 commit、未 push；本轮未改动后端/前端业务源码。

## 2026-10-04 UI 文档重制与门禁转绿（更正：对应修复从未提交，原结论不成立）

- **更正说明：** 本节原始版本声称 `node scripts/check-markdown-contracts.mjs` exit 0、
  `165 files / 489 links / 0 missing`、「11 条错误已清零」「6 条断链已修复」。经 2026-10-15
  全项目核查（[2026-10-15-project-audit.md](../archive/2026-10-15-project-audit.md) §3.4/§八）实测：
  这些修复**从未出现在任何提交中**；截至 2026-10-15，仓库内 Markdown 合同仍为 14 条错误
  （7 条断链 + 6 条生命周期元数据缺失 + 1 条过期摘要），当时「门禁已绿」的结论不成立。
  本节原始数字与结论仅作历史保留，不再作为当前状态依据。
- **原始记载（未提交、未经核验）：** 移除 18 份失真 UI/运维文档、抢救 7 项唯一内容到
  owner 文档、`ui:audit:ci` 824→822、`npm run type-check` exit 0，以及 6 条臆想路径断链的
  改链方案（`docs/database/`、`docs/architecture/`、`docs/development/DATABASE.md`、
  `docs/docker/CELERY.md`、`docs/docker/deploy/MONITORING.md`、`.../CACHE_IMPLEMENTATION.md`
  经 `git log --all` 查证从未存在）。上述内容均未落地到仓库，与当前实际状态无关。

## 2026-09-28 AI伙伴页面文案精简（未发布）

- **范围：** 删除重复介绍、英文装饰标题与“本地交互模式”字样；缩短任务引导和检查说明，
  选型规则默认折叠。保留按钮、表单、校验、关键风险提示及评分数据发送说明，不改业务逻辑。
- **自动化：** `npm run type-check`、`npm run build:ai-partner` 通过；AI伙伴测试
  4 文件 / 55 passed。新增文案与操作保留回归，首次断言发现状态栏会被身份通知覆盖，
  将数据发送说明保留在可展开的数据说明中后复跑通过。构建仍有既有 chunk 大小提醒。
- **桌面交互：** 系统 Chrome + Playwright，1440×1000、1280×800，10 组检查通过。
  覆盖页面/canvas、精简文案、规则展开、三维工具、左上角榜单、评分与凭证上榜、
  修改作废/迟到响应、搜索重置、草稿保存恢复、报告与JSON下载；无相关console/pageerror。
  评分使用隔离接口夹具，不代表真实模型验收；本轮不测手机。
- **证据：** 外部可视化目录 `ai-partner-copy-simplified/`，含 `ui-results.json`、
  `desktop-simplified.png` 和实际导出文件；临时脚本与构建日志位于
  `/tmp/ai-partner-copy-20260928/`。预览保持 `127.0.0.1:16610`。
- **边界：** 不修改后端、模型配置、教学原源或发布文件；未打包Docker镜像、commit、push或部署。

## 2026-09-28 AI伙伴智能评分与左上角榜单（未发布，桌面隔离验证）

- **范围：** 在前轮临时榜单基础上，改为后台模型 API 四维评分（价格性价比、任务完成度、
  选择合理性、设计验证与风险，各 25 分）；榜单移至左上角、简化文案并避让标题。客户端只提交
  部件 ID 与设计材料，使用服务器一次性评分凭证上榜；修改方案/换号作废旧结果。
- **前端：** 完整 `npm run build` 通过（主站与独立页类型检查及静态构建）；
  `npm run test:ai-partner` 为 4 文件、54 passed，共享 `api.auth-race.test.ts` 为 52 passed。
  既有 Browserslist、PDF.js eval、较大 chunk 警告不影响构建通过。
- **后端：** 整个 `backend/tests/ai_partner` 收集 evaluation 61 项与 leaderboard 58 项。
  fakeredis 模式 118 passed / 1 skipped（仅真实 Redis 用例），独立真实 Redis 模式
  119 passed / 0 skipped；均无失败，6 条既有 Pydantic 弃用警告。覆盖任务 ID/目录计价、
  模型结构验证、超时/限流/并发、轮次/身份、凭证过期/盗用/重放、伪造分数、无配置/存储故障。
- **桌面浏览器：** 使用系统 Google Chrome + Playwright，在 1440×1000、1280×800 验证。
  UI/API 夹具 8 组通过；真实产品路由＋独立 Redis、模拟身份/模型的联调 7 组通过。
  后者覆盖签发评分、双用户互见、盗用/重放拒绝、伪造分数 422 及同名用户分离。
  上述均无相关 console error/pageerror；本轮不做手机模拟。
- **未配置模式：** 本地预览恢复真实未配置路径，评分返回 503 且 `Cache-Control: no-store`，
  不显示替代分数，上榜按钮禁用，独立轮次榜单为空；左上按钮不遮挡标题。
  预期存在一条 HTTP 503 资源日志，不存在 pageerror。
- **证据与边界：** 本轮证据位于外部可视化目录 `ai-partner-ai-scoring/` 的
  `ui-results.json`、`live-results.json`、`unconfigured-results.json` 及桌面截图；后端两模式
  runner/日志位于 `/tmp/ai-partner-llm-backend/`。预览为 `127.0.0.1:16610`，隔离后端
  `51641`、专用 Redis `51640`。**真实供应商模型 API 与真实 JWT 登录尚未验收**；
  模型 fixture 仅验证接口联动，不能代表智能评分质量。不访问生产数据库或模型。
- **合同门禁：** 构建/工作流合同合计 68 passed；Markdown 派生摘要为
  `113 files / 448 links / 0 missing`，Markdown 合同 10 passed，`git diff --check` 通过。
- **发布边界：** 未打包 Docker 镜像、未 commit/push、未部署；真实模型需要后台配置并绑定
  `AI_PARTNER_SCORING_AGENT_ID`，生产 Compose 透传等发布准备仍按部署文档另行验收。

## 2026-09-28 AI伙伴临时互动榜（未发布，本地隔离验证）

- **范围：** 集成新版三维教学源码与浮动共享榜单，保留五维评分与课堂记录门槛；使用平台
  身份、每人最高分、同分并列及 Redis 固定期限，不新增 DB 表、migration 或管理员页面。
- **前端：** `npm run type-check` 通过；`npm run test:ai-partner` 为 4 文件、42 passed；
  既有 `api.auth-race.test.ts` 为 52 passed。未将这些限定测试表述为主站全量测试。
- **后端：** 同一套 58 项测试分别在 fakeredis Lua 和独立真实 Redis 模式通过，不是
  116 项独立测试；覆盖认证/guest拒绝、严格参数、身份与轮次冲突、最高分、并列排名、
  固定到期及 deadline tombstone、限流、no-store 与 Redis 故障关闭。复审补齐
  未捕获路由/认证依赖异常的统一 500 no-store 响应，新增 4 项用例并在两模式重跑通过。
- **源码与构建：** 教学原目录 11 项源文件哈希与导入清单一致；7 项未改视觉/规则文件
  与源文件逐字节一致。完整 `npm run build`（双类型检查、主站、独立页）通过；构建路径
  核验 258 个文件，两份入口及依赖资源共 8 项临时 HTTP 检查均为 200、内容匹配。
  已知非阻塞 warning：Browserslist 数据较旧、既有 PDF.js `eval`、较大 chunk；AI伙伴 JS
  约 692.4 kB。未通过放宽阈值或改依赖掩盖 warning。
- **真实浏览器：** 系统 Google Chrome + Playwright，桌面 1440×1000、手机 390×844，
  共 14 组检查通过；页面标题/三维 canvas/非空/无错误覆盖层、真实点击选型→测试→课堂
  记录→评分→提交、独立用户互见与自动刷新、同名不同ID分离、真实同分 `1,1,3`、
  低分不覆盖、关闭停止轮询、手机浮窗不越界及 Escape 恢复焦点、换号清空和草稿隔离、
  匿名不读取实名榜均通过；已认证会话无 console error 或 pageerror。
- **构建产物浏览器复验：** 在 `127.0.0.1:16610` 用 `vite preview` 提供本次正式静态
  构建产物，重复同一套 14 组 Chrome 桌面/手机检查全部通过、无已认证会话运行时错误；
  已加载最终 no-store 补丁的隔离后端再次复验通过。
  这是相同场景的第二运行模式，不计为额外 14 个独立场景。证据为同一外部目录下的
  `ai-partner-production-smoke/verification.json` 及桌面/手机截图；并非 Docker 或生产验收。
- **隔离边界：** 预览 `http://127.0.0.1:16608/games/ai-partner/index.html` → 本地后端
  `51641` → 专用 Redis `51640`；使用模拟身份及真实榜单 API/Redis，**未验证真实 JWT
  登录全链路**，不访问生产 DB/Redis。Browser plugin 不可用，按测试 skill 使用 Playwright。
  未测其他浏览器、生产容器、真实全班负载；到期/故障在后端测试验证，不冒称浏览器验收。
- **证据：** 外部 `ai-partner-verification/verification.json`、`desktop.png`、`mobile.png`，
  位于 `/Users/wsh/.codex/visualizations/2026/09/27/01a0e238-eeb8-7632-be78-1af588c3909e/`。
  初次 UI 脚本因错误选择器超时，修正脚本后重跑通过，未为此修改产品逻辑。
- **构建合同：** `frontend/scripts/docker-build-context.test.mjs` 的 8 项及
  `scripts/workflow-contracts.test.mjs` 的 60 项，合并运行 68 passed；未执行镜像构建。
- **文档门禁：** 本批 Markdown 派生摘要为 `114 files / 452 links / 0 missing`，合同测试 10 passed；
  首次因当前摘要过期失败，同步真实统计后复跑通过，不改历史批次统计。
- **发布边界：** 未打包 Docker 镜像、未 commit/push、未部署，原 `2.1.2` 发布记录不变。

## 2026-09-27 公开课静态页 v2.1.2 发布与生产验收（当前工作区）

- **范围：** 信息技术页入口文案从“小游戏”改为“公开课”；`/games` 新增“召唤一名AI同学”
  公开课卡片；保留 `/games/lock-cracker` 原有入口、功能开关和访问逻辑。公开课静态构建产物
  以同源顶层页面 `/games/ai-partner/index.html` 集成，不使用 iframe。
- **前端验证：** `npm run type-check`、`npm run test`（99 个测试文件、712 个测试通过）和
  `npm run build` 通过；正式构建产物包含公开课 HTML、JS、CSS 和 favicon。部署/工作流合同测试
  `node scripts/workflow-contracts.test.mjs` 为 `60 passed / 0 failed`，版本一致性检查和
  `git diff --check` 通过。
- **Docker 模拟：** 使用正式镜像 `shuhao07/*:2.1.2`、隔离端口 `16609` 启动生产模拟，
  项目自带生产 smoke 全部通过；`/games`、公开课三维 canvas、密码锁页面、JS/CSS MIME 和
  缺失资源 404 均通过。
- **镜像与 release-set：** 六个 `linux/amd64` 业务镜像已构建并推送；
  `release-set-2.1.2.txt` 按 Docker Hub registry manifest digest 生成并在本地校验。服务器直连
  registry manifest 超时，配置的镜像 mirror 拉取出现 EOF，因此没有在服务器源码构建或依赖不确定的
  registry 重拉；已将本地已验证镜像通过 SSH 传输到服务器，并按 `--pull never` 运行。
- **生产验收：** `shuhao-Virtual-Machine` 的六个业务容器均为 `2.1.2` 且 healthy；详细健康检查
  为 `healthy`（API、PostgreSQL、Redis、frontend、gateway、Typst worker、PythonLab worker
  全部通过）。服务器本机自检确认 `/api/health`、`/games`、`/games/ai-partner/index.html`、
  `/games/lock-cracker` 为 200，公开课 JS/CSS MIME 正确，缺失资源为 404；公开课 HTML/JS/CSS
  响应 SHA-256 与本地正式静态源一致。未执行数据库迁移，旧 `.env` 与 `release-set.txt` 已备份。

---

> 2026-09-20 及更早的测试状态历史已归档至 [TEST_STATUS-history.md](TEST_STATUS-history.md)。
