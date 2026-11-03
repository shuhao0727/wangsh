# 代码复核、真实环境验收与台账核验计划

> 状态：active
> Owner：project-governance（执行：本会话主工程师）
> 最近复核：2026-11-03（发布前核对）
> 范围：`/Users/wsh/wangsh`，本轮修复分支 `fix/release-gates`，基线为远端 `main` 的 `aafbf3f`；2.2.5 构建 tag 仍为 `189205c`；原始修复基线与结果保留在下方历史记录。

## 当前状态

- 更新：2026-11-03。
- 当前阶段：`fix/release-gates` 首轮修复已提交推送为 `1dc0260`；PR首轮CI为5项通过，后端3749 passed / 123 skipped / 1 failed。唯一失败的原子登录测试替身签名已修，显式接受并断言 `include_inactive=True`；本地先红后绿、相关36项通过，按授权推送待远端重跑。生产逻辑/事务断言未改，生产最后实测仍为2.2.2/healthy，本轮未连接或切换生产。
- 本轮范围：复用 provider 出站校验、去重认证身份字段投影，保留安全/登录行为；在无旧 node_modules 的 Node 20 环境补全普通 peer 解析的 lockfile，并跑隔离回归与相对基线检查。新增已复现的收集冲突：端点软校验自含用例必须由现有独立 CI 步骤执行，不能由普通 pytest 再次收集；仅分离该模块并以 workflow 合同锁定独立19项。保留已有文档差异，不放宽 baseline；用户已授权提交、推送并开PR，未授权合并或生产操作。
- 下一步：核对修复PR的远端CI，仍有失败先处理；release-set、源码/静态产物、配对备份/恢复证据齐备前不部署。发布过的 2.2.5 tag/镜像不覆盖。
- 阻塞与前置：`ci-quality` run `41592108696` 失败：阻塞对话复杂度 18→20、认证服务文件行数 612→620；`npm ci` 缺三个 `@emnapi/*` 条目。服务器现存 release-set 为 2.2.0，不能配给 2.2.5；备份/恢复准入尚未完成。
- 硬边界：**门禁未通过不重启生产、不切换镜像，不抬高 baseline 或强推标签**；保留数据库、Redis、上传与 PythonLab 工作区。PRIV/B/C 产品与真实数据边界仍保留，旧批次“不提交/不操作生产”仅表示当时授权范围。

## 阶段 B（台账）推进记录（2026-11-03）

- **历史项退役**：按用户确认，ACCEPT-01/03、OPS-02、COMMIT-01 记录退役理由，移出未结表；不声称相关功能已验收。
- **PRIV-02 同意闭环（部分）**：新增 `GET/PUT/DELETE /users/privacy/me/consents`，支持 `AI_USAGE`、`DATA_ANALYSIS`；写入/撤回记录 `CONSENT_GRANTED`/`CONSENT_WITHDRAWN` 审计；新增 `/privacy` 页面和用户菜单入口。后端隐私/同意 9 项测试、前端组件 2 项测试通过。
- **残余**：同意版本文本字段、AI 调用前强制校验、告知文本/运营政策（PRIV-04）未实现；不能宣称完整合规闭环。
- **UI/功能项**：按用户选择暂不实施 UI-02、XBK-01、PYLAB-01、PROGRAM-01、DIANMING-01、DIFY-01、ARCH-01、UI-01；继续保留台账。

## 阶段 D 修复记录（2026-11-03）

- **ASYNC-01**：`analysis_async.py` 混合列表改为 `union_all` 单一 SQL 排序/分页，`total` 由数据库 COUNT 得到；新增 SQLite 合成测试验证 skip/limit 与全量 total。
- **ASYNC-02**：`agent_analysis.py` 新增 `run_analysis_in_fresh_loop`，任务结束（含异常）后 `engine.dispose()`，避免下一任务复用旧事件循环的 asyncpg 连接；新增成功/异常释放测试。
- **PRIV-01/03**：`privacy.py` 增加 `operation_id`、`data_scope`、`EXPORT_DATA_REQUESTED/COMPLETED/FAILED`、`DELETE_DATA_REQUESTED/COMPLETED/FAILED`；删除与完成审计同事务，响应明确只删除两类消息；摘要改用 SQL COUNT。导出仍内存组装，未实现文档旧述的游标/临时文件/64KiB 流式发送。
- **AUTH-02**：登录查询支持 `include_inactive`；凭据正确但停用返回 403「账号已停用」，错误凭据仍 401；管理端重新认证仍只接受启用账号。新增回归。
- **COMPARE-01**：Bloom 缺失层级返回 `null` 而非 0；时序使用 `bucket_start` 真实时间并按最早桶对齐分钟；新增 3 项 helper 测试。
- **SSE-01**：`useAdminSSE` 增加 `enabled` 参数；学生端 `AIAgents` 仅在 `auth.isAdmin()` 时订阅 `/admin/stream`，管理员页面保持默认；新增 3 项 hook 测试。

验证：后端定向 pytest **24 passed**；前端相关 Vitest **10 passed**；`npm run type-check` 通过；Python 治理 errors=0（41 条存量 warning）；Markdown 109/697。真实浏览器、真实 Celery worker、生产与流式导出未验证。

## 阶段 A 复核记录（2026-11-02）

复核范围为本批 36 个修复文件及直接调用方；上一会话整理改动不重审。确认并修复：

1. **停止入口 Compose 选择器**：`stop-dev.sh --all` 原先直接执行 `docker compose -f ... down`，会继承外部 `COMPOSE_PROJECT_NAME`/`COMPOSE_FILE` 等选择器且不带开发 env 文件，可能停止另一项目或插值失败。新增 `stop_dev_compose`/`stop_prod_compose`，显式文件并清除 `COMPOSE_*`；新增 `scripts/stop-dev-compose.test.mjs` 两项合同，首轮实测抓到 bash 3.2 在 `set -u` 下展开空数组报 unbound，改用 `${arr[@]+...}` 后通过。
2. **文档口径**：`DEPLOY.md` 仍写游戏上传 `500MB`、把宿主 `5432` 列为开发库入口；已改为 `526385152` 字节（502MiB）与 `127.0.0.1:5433`/容器内 `postgres:5432` 的正确分层。
3. **入口提示与状态**：`deploy.sh` 缺开发 env 时提示 `.env.dev.example`；`start-dev.sh` 移除最后两处宽泛 `pgrep` 状态判断，改为具体 PID 与共享守卫。

延迟项（P3，不阻塞本批，已记录不修改）：`scripts/migrate-db.sh` 仍按调用目录解释相对 `ENV_FILE`/`COMPOSE_FILE`（单进程目标，不存在父子分叉）；`show_service_status` 在进程查询失败时显示“未运行”而非“未知”。

通过标准核对：根层合同 **151/151**，受影响脚本 `bash -n`、`git diff --check` 通过；原暂存差异 SHA-256 未变；无未解决 P1/P2。真实服务、数据库与生产仍未验证。

## 阶段 B 真实验收记录（2026-11-02）

环境：macOS 本机；Docker 29.8.2；Compose 5.6.0；分支 `codex/review-priority-fixes`；`.env.dev` 已存在、8 项必需值非空、目标 `127.0.0.1:5433`/development。未读取或输出密钥。

执行与结果：

- 首次 `bash start-dev.sh` 在进程守卫处失败：守卫把桌面所有同用户 Node/Python 进程纳入候选，且 `LC_ALL=C` 下解码中文 cwd 失败，任一无关进程读取失败即整体退出。修复为 UTF-8/`surrogateescape` 解码、容忍 lsof 非致命 stderr，并区分“无关进程保留跳过”与“端口选中/本树候选 fail-closed”；新增 4 项回归（31→35），真实桌面只读扫描 `project_unsafe=0`。
- 再次启动成功：容器归属检查通过（3 个容器，未删除/重建）；开发 PostgreSQL/Redis/Adminer 就绪；后端、Celery、Vite 启动。
- `/health` **200 / healthy**，`version=2.2.4`、`environment=development`、database/redis healthy；`http://127.0.0.1:6608/` **200**；后端实际 `DATABASE_URL` 为 `127.0.0.1:5433/wangsh_db`（asyncpg）。
- 浏览器 Chrome 打开 6608 自动进入 `/login`，标题 WangSh，登录表单渲染正常，控制台 **0 error / 0 warning**；未登录、未使用管理员凭据、未做上传。
- `bash stop-dev.sh --status` 退出 0 并正确列出后端/前端进程；`bash stop-dev.sh` 停止成功，8000/6608 释放；容器按默认行为保留，ID 前后一致（`d75a52f0301f`/`6a70d5691750`/`21c63b37b3e6`）。
- 二次 `bash start-dev.sh` 成功，健康与前端再次 200，容器 ID 未变；最终停止后端口空闲，容器保留。
- 按用户选择未拉取 `caddy:2.8.4`、未执行真实 adapt/代理上传；未验证 WebKit、窄屏、登录后业务页、生产或完整镜像。

## 阶段 C 核验记录（2026-11-02）

逐项核对 24 行未结事项的当前源码/文档证据，结果：

- **D 类（需设计实现，6 行）**：ASYNC-01/02、PRIV-01/03、AUTH-02、COMPARE-01、SSE-01。当前源码仍证实原问题；本轮只记录，不实施。
- **B 类（需产品/用户决策，12 行）**：DOC-01、ACCEPT-01/03/OPS-02/COMMIT-01、PRIV-02、PRIV-04、UI-01、ARCH-01、DIFY-01、UI-02、XBK-01、PYLAB-01、PROGRAM-01、DIANMING-01。
- **C 类（需真实数据/生产/外部，5 行）**：RELEASE-01、PERF-01、ACCEPT-02、HOT-01、OPS-01。
- **A 类**：本轮无待改代码项；DIFY-02 核验为首页外部 Dify 服务入口（6606 非前端 6608），按非缺陷关闭。
- 核验证据：`analysis_async.py` 混合列表未应用 skip、`agent_analysis.py` 仍 `asyncio.run`、`privacy.py` 仍返回“所有数据已永久删除”、AUTH 停用账号 401、COMPARE 页 Bloom `||0` 与 `i*3`、学生端 `useAdminSSE` 订阅 `/admin/stream`、`services/config.ts` 的 Dify 外部 URL 等。详见唯一台账。

未提交、未部署；B/C/D 的下一步需用户选择：优先 D 类工程项、B 类产品决策，或 C 类真实数据/环境。

## 背景

15 项高优先级修复已落盘并通过隔离回归，但尚未经过本批差异的专项复核，也未在真实开发栈运行。项目台账中仍有 24 行未结事项，其中部分此前被误关闭、现已重新打开。本计划把“复核—真实验收—台账核验”作为同一任务的三个阶段，按项目规则保持单一现行计划。

## 阶段 A：代码复核（先做）

### 范围

本批修复文件及其直接调用方，约 36 个文件：

- 运维：`start-dev.sh`、`stop-dev.sh`、`scripts/deploy.sh`、`scripts/rollback.sh`
- 配置：`scripts/compose-config.mjs`、`scripts/check-env-consistency.mjs`、`.env.dev.example`、`.gitignore`
- 进程/容器：`scripts/dev-processes.py`、`scripts/dev-containers.mjs`
- 后端：`backend/app/services/agents/ai_agent.py`、`endpoint_security.py`
- 网关：`gateway/Caddyfile`、`gateway/tests/validate_caddy_contract.py`、`test_caddy_contract.py`、`test_caddy_config.sh`
- 新测试与文档：`scripts/deploy-paths.test.mjs`、`dev-config.test.mjs`、`dev-containers.test.mjs`、`test_dev_processes.py`、`backend/tests/ai_agents/test_agent_endpoint_warning.py`，以及对应 README / DEPLOY / CICD / TEST_STATUS / 台账 / 发布记录 / `CLAUDE.md` 7.0

上一会话的 180 文件仓库整理已有 61 项初查与 50 组复核结论，不在本轮重审；只复核它与本批修复交叠的调用点。

### 方法

1. 逐 hunk 复核 + 反证：每个改动行检查输入、状态、失败路径；删除的行为逐条确认有新承接口。
2. 跨文件追踪：start/stop 与共享 helper、deploy/rollback 与 Compose 目标、checker 与启动器生效环境、guard 与真实 compose 渲染。
3. 安全复核：软告警不泄露、不硬拒绝；进程/容器归属 fail-closed；未知来源保留；日志不含凭据。
4. 集成复核：真实 Compose 合成渲染（local/docker）、PWD、显式/默认路径、venv 与 Celery 解释器。
5. 文档一致性：台账、TEST_STATUS、DEPLOY、CICD、AI_AGENTS、发布记录与代码行为一致，不夸大验证范围。
6. 复用已有证据：本会话已通过的 149 根合同、31 进程、19 端点、38 网关用例不重复跑；只在相关修改后重跑。

### 输出与通过标准

- 发现按 P1/P2/P3 分级，给文件:行、触发条件、错误结果与反证；只修已确认问题，发现即补红绿回归。
- 通过标准：无未解决 P1/P2；受影响隔离套件全绿；`git diff --check`；原暂存差异 SHA-256 保持 `1b7ea62b…`。
- 不新增功能、不为风格重写、不扩大待证候选。

## 阶段 B：真实环境验收（本机开发栈）

### B0 预检（失败即停）

- 启动 Docker Desktop（`open -a Docker`），等待 daemon 可用；记录版本。
- 确认 8000/6608/5433/6379/8081 无占用（当前已确认空闲）；若被占用，不杀进程，报告并停止。
- 确认 `.env.dev` 存在且必需键非空、目标为 `127.0.0.1:5433`/development（只检查存在与长度，不输出密钥明文）。
- 确认 `data/dev/` 为开发数据；记录启动前容器与端口基线。

### B1 启动

- 执行 `bash start-dev.sh`（本地模式）。该入口会：检查容器归属、启动开发 PostgreSQL/Redis/Adminer、启动后端与 Celery、启动前端；数据库初始化/迁移属预期副作用，仅作用于 `data/dev`。
- 启动前记录：分支、工作树状态、原暂存哈希、容器/端口基线。

### B2 启动后核对（任一不符即停）

- `http://localhost:8000/health` 返回 200 且 `status=healthy`。
- `http://localhost:6608/` 返回 200。
- 后端进程 `DATABASE_URL` 指向 `127.0.0.1:5433` 的 `wangsh_db`。
- Compose 容器来源与应用绑定符合开发栈。

### B3 行为验收（按已选深度）

- 容器守卫：启动日志显示归属检查通过；未按名称删除任何容器；现有容器 ID 与启动前基线对照。
- 进程守卫：`bash stop-dev.sh --status` 正常退出（无 Vite 时不得失败）；停止后 8000/6608 释放；再次 `bash start-dev.sh` 可正常启动（验证重复启动路径）。
- 浏览器：Chrome（必要时 WebKit）打开 6608 首页与登录页，检查加载、控制台错误与关键请求；不登录、不使用管理员凭据、不做真实上传。
- Caddy：本机缺 `caddy:2.8.4` 且不拉取，记录“未验证”，不改用其他镜像冒充。
- 部署/回滚：不在真实验收中执行 backup/restore/rollback（涉及数据与生产语义）；保留合成回归证据。

### B4 结束与失败处理

- 结束：`bash stop-dev.sh`（默认，不带 `--all`），确认端口释放；容器是否保留按脚本既有行为记录，不额外删除。
- 失败：保留日志与现场，记录证据后停止；不自动改配置、不重启掩盖、不删除容器/数据。
- 证据：命令、时间、退出码、HTTP 状态、脱敏日志、容器/端口状态，写入 TEST_STATUS（摘要）与归档测试批次（详细）。

## 阶段 C：台账核验与分批修复

### C1 逐项核验（24 行未结事项）

对台账每一项核对：当前源码/文档/环境证据 → 是否仍成立 → 关闭条件 → 分类：

- **A 类：可工程闭环**（无需产品决策或真实数据）：如 DIFY-02 变量实核、UI-02 复现、SSE-01 代码路径核对、OPS-01 清理证据核对等。
- **B 类：需产品/用户决策**：PRIV-02、PRIV-04、DIFY-01、XBK-01、PYLAB-01、PROGRAM-01、DIANMING-01、UI-01 等。
- **C 类：需真实数据/生产/外部**：RELEASE-01、HOT-01、PERF-01、ACCEPT-02 部分等。
- **D 类：需设计实现的已重开项**：ASYNC-01/02、PRIV-01/03、AUTH-02、COMPARE-01。

核验结果回写台账：保留原编号，补证据日期与分类；关闭需有当前实现和环境证据，不以“旧工作树删除”作为关闭理由。

### C2 分批修复

- 只执行 A 类中可独立闭环、风险可控的项；每项先复现/核对，再最小修复，补回归，更新台账与 TEST_STATUS。
- B/C 类只输出决策清单与所需材料，不擅自实现。
- D 类先给实现方案与影响面，待你确认后再逐个实施；不在本轮顺带修改。
- 本轮**不提交**；所有修改留在工作区，最后统一列出待提交范围。

### 通过标准

- 台账每行都有：当前证据、分类、下一步/关闭条件；无“已修”但无证据的条目。
- A 类完成项有红绿回归；B/C/D 类有明确阻塞原因与所需决策。

## 交付物

1. 本计划（唯一现行计划）。
2. 代码复核结论（分级、证据、修复/不修理由）。
3. 本机开发栈真实验收记录（含未验证项）。
4. 更新后的 `docs/plans/project-consolidation.md`、`docs/testing/TEST_STATUS.md`、必要的 DEPLOY/CICD/发布记录。
5. 未提交的完整工作区改动清单与建议提交分组。

## 风险与停止点

- Docker Desktop 无法启动 → 阶段 B 停止，阶段 A/C 不受影响。
- `.env.dev` 与启动核验不匹配 → 不启动，报告具体缺项，不擅自改用户配置文件。
- 端口被非本项目占用 → 不杀进程，报告后停止。
- 启动会写入 `data/dev`（初始化/迁移）；已确认这是开发数据，不代表生产。
- 浏览器验收不覆盖真实登录、上传、模型调用、支付或生产；Caddy adapt 与真实上传按选择不做。
- 隔离/合成通过不等于生产验收；发布仍需独立授权。

## 变更日志

- 2026-11-03：PR首轮后端仅1项旧替身签名失败，本地先复现TypeError；只补 `include_inactive` 显式参数并断言True，保留原子事务断言，相关36项隔离通过，按授权提交推送等待新CI。

- 2026-11-03：用户授权提交、推送 `fix/release-gates` 并开PR；同步当前授权与候选状态，远端CI仍待验证，不合并、不改已发tag/镜像、不部署生产。

- 2026-11-03：`fix/release-gates` 已完成已知门禁本地修复：两份重复逻辑去重、lock三条最小补齐、自含19项与普通pytest分离；普通/两份相对基线、隔离回归、干净npm ci及八项前端命令通过。未放宽baseline、未提交推送/重跑远端CI或部署；安装audit报告另保留待核。

- 2026-11-03：发布预检核准局域网 SSH 22 与生产 2.2.2/healthy；构建提交 `189205c` 的远端 CI 失败，本地 `--base-ref 3d05b08` 重现两项治理回归，现有 2.2.0 release-set 不适用；登记 RELEASE-01 并阻断切换，不改已发 tag/镜像。

- 2026-11-03：B 类按用户选择推进：历史项退役；PRIV-02 同意 API/`/privacy` 自助页部分实现（版本/调用前校验未完成）；UI/功能项暂不实施。
- 2026-11-03：D 类 6 项完成代码修复与定向回归（后端24、前端10、type-check通过）；PRIV 导出仍内存组装，流式边界保留；未提交、未部署。
- 2026-11-02：阶段 B 本机真实验收完成（健康/前端/数据库目标/浏览器/停止/二次启动/容器身份）；验收中发现并修复进程守卫 UTF-8 解码与无关进程误阻断问题，进程回归31→35；进入阶段 C 台账逐项核验。
- 2026-11-02：阶段 A 复核完成；修复停止入口 Compose 选择器、bash 3.2 空数组、部署模板提示与文档口径；记录 2 项 P3 延迟项；进入阶段 B 前等待 Docker Desktop。
- 2026-11-02：依据用户要求建立“代码复核 → 本机真实验收 → 台账核验与分批修复”三阶段计划；明确不提交、不部署、不操作生产，验收不含镜像拉取与真实上传。
