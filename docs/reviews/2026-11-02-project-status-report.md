# WangSh 项目状况报告

> 生成日期：2026-11-02
> 分支：`main`，基线 `3d05b08` + 未提交整理改动（202 项）
> 方法：四路并行只读扫描（后端/前端/数据/安全），结论逐条用命令复核

---

## 一、规模与构成

| 维度 | 数据 |
|---|---|
| 后端源码 | 365 文件 / 60,367 行（api 20,772 · services 25,861 · models 1,811 · schemas 3,774 · core 5,169 · tasks 1,181 · utils 1,354） |
| 后端测试 | 171 文件 / 49,236 行，3,835 个用例 |
| 前端源码 | 560 文件 / 106,152 行，59 条路由（50 条懒加载） |
| 文档 | 42 篇 Markdown |
| 数据库 | 54 表 + 1 视图，225 索引，142 约束，50 个 Alembic revision（单 head） |
| API | 274 路径 / 347 个操作 |
| 依赖 | 后端 20 个直接依赖，前端 51 个运行时依赖 |
| Git | 583 次提交，2026-01-31 → 2026-10-29，2 位贡献者 |

**当前运行状态**：后端 200 / 前端 200 / PG 5433 / Redis 6379 全健康，版本 2.2.4。

---

## 二、架构健康度

### 做得好的地方

- **模型层纯净**：`app/models/` 51 个文件 1,811 行，零 `select()`、零 `await`，纯声明。
- **异步正确性**：全仓 async 函数内 **0 处** `requests.*`、0 处 `time.sleep`、0 处同步 httpx；HTTP 统一走 `httpx.AsyncClient`。唯一的 `subprocess` 调用已用 `asyncio.to_thread` 包裹。
- **迁移链健康**：50 个 revision、单 head、无断链、无孤儿；1 个合并点，1 个受控分支点。启动时 schema 与迁移链不一致会报错退出。
- **认证实现扎实**：JWT + refresh 一次性轮换落库 + nonce 会话栅栏 + 持久授权层，实现质量高于同规模项目。

### 需要关注的地方

**1. 分层在 api 层有明显泄漏**

- api 层含 120 处 ORM 查询、42 处 `.commit()`
- services 层反向抛 `HTTPException` 135 处，19 个 service 文件 `from fastapi import`
- core 层反向依赖 services（8 处，`deps.py:19` 依赖 `services.auth`）
- **35 个 api 文件完全不 import services**，自行写库（如 `learning/chapters.py`、`progress.py`）

后果：`app.core.deps` 被 58 个模块导入，它又依赖 `services.auth`——改一次认证契约会波及半个 api 层。

**2. 事务边界没有统一单位**

187 处 `.commit()` 散落在 services(137) / api(42) / tasks(4) / core(3)。`get_db` 只做 finally-rollback 不提交，语义是"谁写谁 commit"。配合 `expire_on_commit=False`，漏掉 `await db.refresh()` 就会拿到陈旧对象。

**3. 循环依赖靠延迟 import 化解（4 组）**

`(classroom, classroom_tasks, tasks.classroom)`、`(session_family, session_guard, services.auth)`、`(xbk.import_export, xbk.import_snapshots)`、`(assessment.basic_profile_service, assessment.session_service)`。

当前无崩溃风险，但**这些延迟 import 没有测试保护**——一旦有人把它们提到模块顶部，立刻循环失败。

**4. 复杂度热点集中在 PythonLab**

| 函数 | 复杂度 | 位置 |
|---|---|---|
| `_lower_stmt` | **123** | `api/pythonlab/flow/ast_transformer.py:73` |
| `run_github_sync` | **93** | `services/informatics/github_sync.py:327` |
| `dap_ws` | 54 | `api/pythonlab/ws/handlers.py:289` |
| `_build_stmt` | 52 | `api/pythonlab/structured_ir.py:192` |
| `_pump_tcp_to_client` | 50 | `api/pythonlab/ws/bridge.py:645` |

前 5 名里 4 个在 PythonLab 的 IR/WS 子系统，是天然的复杂度聚集区（AST 变换 + 双工桥接）。

---

## 三、数据层

### 事实

- **模型与库完全一致**：53 个 `__tablename__` 与库中业务表 diff 为空。
- **索引命名有偏差**：`znt_student_profiles.profile_type` 在模型中生成名是 `_profile_type`，库里叫 `ix_znt_student_profiles_type`。这类偏差会让 `alembic autogenerate` 反复生成多余的 create/drop。
- **43 处索引冗余**：其中 **33 个 `ix_<表>_id` 与主键完全重复**（定义逐字节相同），纯属写入负担。
- **14 个外键列无前导索引**：影响 `DELETE` 级联和 `ON DELETE SET NULL`，不只是查询问题。
- **N+1 定位到 6 处**：
  - `services/assessment/session_service.py:710,795` 在 `for answer in session.answers` 内查 `AssessmentQuestion`，且该关系是 `lazy="select"`
  - `services/informatics/github_sync.py:433,603` 按 `note_id` 逐条查
  - 全局 37 处 `lazy="select"`，仅 52 处用 eager loading

### 重要限定

**当前库只有 88 行数据**（`sys_users` 11 行，30 张表全空），是开发/演示库。上面所有索引与 N+1 判断都是**结构性判断，没有任何性能实测证据**。要出性能结论必须先在真实量级上跑 `EXPLAIN ANALYZE`。

---

## 四、安全状况

### 已有防护（做得好的）

- `.env*` 全部 gitignore，git 历史只提交过 `.env.example`
- 30 条无守卫路由全部是公开端点（文章/typst/游戏/健康/登录），未见越权漏洞
- 8 处 `dangerouslySetInnerHTML` 全部经 DOMPurify
- 全仓 **无 f-string 拼接 SQL**，`text()` 均为常量或绑定参数
- 沙箱加固到位：`--cap-drop ALL`、`no-new-privileges`、`--network none`、pids/mem 限制
- 日志脱敏扎实：loguru patcher + stdlib 拦截 + URL query 脱敏
- 备份恢复脚本质量高：空文件检测、`pg_restore --list` 校验、目标表非空即拒

### 需要处理的风险（按优先级）

**① dev 与 prod 共用同一套密钥** ⚠️ 已实测确认 —— **2026-11-02 已处置**：两栈数据目录
拆分为 `./data/postgres` 与 `./data/dev/postgres`，`.env.dev` 的 SECRET_KEY /
AGENT_API_KEY_ENCRYPTION_KEY / SUPER_ADMIN_PASSWORD 已轮换为独立值；下文为当时记录。

`SECRET_KEY`、`AGENT_API_KEY_ENCRYPTION_KEY`、`POSTGRES_PASSWORD`、`SUPER_ADMIN_PASSWORD` **四组完全相同**（哈希比对：`0287507e` / `2fa5a9bf` / `17e9557c` / `17e9557c`）。而两栈共用 `./data/postgres`——开发栈可以直接污染生产数据，密钥无环境隔离。

**② 保存智能体时不校验 endpoint** ⚠️ 已实测确认

`endpoint_security.py` 的 SSRF 防护只在 `model_discovery.py:242` 和 `ai_partner_evaluation.py:236` 调用。**`create_agent` / `update_agent`（`ai_agent.py:59-80, 240-275`）完全不校验**，且 httpx 全线 `follow_redirects=True`——任何补校都可能被 302 绕过。当前攻击面限于 admin 角色。

**③ 认证的 IP 绑定实际失效**

`.env` 把 `AUTH_USER_UNIQUE_PER_IP`、`AUTH_IP_UNIQUE_PER_USER`、`AUTH_ENFORCE_SAME_IP_PER_REQUEST` 全设 `false`；`AUTH_TRUSTED_PROXY_CIDRS` 未配置，后端看到的客户端 IP 全是 Caddy 容器 IP。结果是登录限流（2 秒/IP）退化成**全站共享配额**。

**④ 生产 worker 以 root 运行并挂载 docker.sock**

`pythonlab_worker_runtime` 在 compose 里显式 `user: "0:0"` + 挂 `/var/run/docker.sock`，等价于持有宿主机 root。compose 注释已自认风险并给了缓解建议，但未实施。

**⑤ 网关 16MB 限制与 500MiB 上传预算冲突**

`gateway/Caddyfile:28` 是 `max_size 16MB`，而 `IT_GAME_MAX_UPLOAD_BYTES` 默认 500MB。**大于 16MB 的游戏文件会在代理层直接被 413**，后端限制形同虚设。

**⑥ 其他**

- `/metrics` 用 `require_super_admin` 守卫，Prometheus 无法抓取
- `it/knn` 的 `/batches`、`/batches/{id}/check` 匿名可访问且**无限流**（未知学号 404 / 已知 200，可枚举）
- `/health` 未鉴权时 503 直接返回 `str(e)`，泄漏 DB/Redis 连接错误细节
- SSE/WS 走 query token，Caddy 访问日志无 URI 过滤 → token 会进日志
- `AuditLog` 模型存在但只有一处写入，**管理员改智能体、reveal-api-key、导出学生数据均无审计**
- **CI 无任何安全扫描**（无 bandit / pip-audit / npm audit / gitleaks / trivy）

---

## 五、工程实践

### 质量门禁（都已实测通过）

| 门禁 | 现状 |
|---|---|
| 后端测试 | 3,602 passed / 0 failed |
| 前端测试 | 828 passed（110 文件）+ ai-partner 55 passed |
| Python 治理 | errors=0，365 文件 / 2,136 函数全扫描 |
| 迁移守卫 | 通过（50 文件） |
| 文档合同 | 106 文件 / 400 链接 / 0 missing |
| 版本一致性 | 通过（2.2.4） |
| 根层脚本合同 | 100 passed |
| gateway Caddy 合同 | PASS（含真实 `caddy adapt`） |

这套门禁的密度在个人项目里属于很高的水平，而且大多不是形式主义——治理脚本有 ratchet 机制（ceiling 只降不升）、文档检查器会校验锚点和元信息、Caddy 测试会真跑 `caddy adapt`。

### 发现的漂移

- **`.env` 版本仍是 2.1.3**（仓库是 2.2.4）。`pull-up` 会被 fail-closed 拦下，但 **`deploy.sh up` 和 `deploy-local` 不调用 `verify_release_set`**，可以绕过。
- 前端 lint 476 个 warning 中 **380 个是 `no-explicit-any`（占 80%）**，类型安全有改进空间。

---

## 六、总结

**这个项目的工程质量高于它的形态给人的预期。** 60K 行后端 + 106K 行前端、3,835 个测试用例、完整迁移链、一套自建的治理 ratchet——这些不是临时拼凑能出来的。异步正确性、日志脱敏、沙箱加固、备份脚本这几块，做得比多数同规模项目扎实。

**真正的短板集中在"环境与边界"而非"代码本身"**：

1. 开发与生产的密钥、数据库没有隔离
2. SSRF 校验覆盖不全，只在部分路径生效
3. IP 绑定与限流因配置缺失实际失效
4. 几处配置互相矛盾（16MB vs 500MB、`.env` 版本 vs 仓库版本）
5. 完全没有安全扫描
6. 没有审计日志（除了隐私删除那一处）

**关于数据性能**：所有的索引和 N+1 结论都是结构性的，库只有 88 行。**在有真实数据量之前，任何性能优化都缺乏依据**——这既是限制，也说明现在不必急着优化。

---

## 附：本报告的可信度说明

- 所有"事实"条目都用命令复核过；标 ⚠️ 的是我亲自实测确认的
- 四位 Agent 的原始报告中有 3 条结论经核实**不成立**，已剔除：`MONITORING_QUICKSTART.md` 已不存在、`classroom-scoring.ts` 在溯源清单内、`PyodideTerminal` 确实在用
- 未验证项：专用 PG/Redis 隔离用例、真实浏览器验收、生产环境状态、真实数据量下的性能
