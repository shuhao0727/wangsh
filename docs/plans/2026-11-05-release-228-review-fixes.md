# 2.2.2→2.2.8 审查问题修复计划

> 状态：active
> Owner：project-governance
> 最近复核：2026-11-06
> 归档条件：全部条目已修复并验收、转回[台账](project-consolidation.md)或经老大决定不修；未结项先承接到台账再归档。

## 当前状态

- 更新：2026-11-05；当前阶段：**老大已按推荐拍板全部 8 项决策（2026-11-05），阶段 0–1 执行中**；已修条目按提交切分已推送 origin/main、未发布（`d6375a3` SSRF-FLOW-01、`199c5e9` D3、`2d239cf` A-1/A-2/FE-TEST-01、`0fa64ca` D-R2、`98f1c46` PYLAB-02、`50bb866` A-2 的治理复杂度修复，计划与台账等文档另行提交）。
- 进度（各条详情见对应小节的「进度」行）：
  - 已修复且独立审查通过：SSRF-FLOW-01（A+B）、D3（回退）、D-R2、A-1、A-2、FE-TEST-01、PYLAB-02（本地部分；开发栈两名合成学生同时调试与三项 PythonLab smoke 通过）。
  - 已完成只读核对：SEC-TPL-01（`SUPER_ADMIN_PASSWORD` 命中模板值，处置待老大决定）；D3 前提（生产项目名由 `-p wangsh` 显式传入，发布目录无 `.env`）。
  - ENV-DEV-01：已完成（开发栈沙箱镜像 2.2.8，重建后生效连接与启动前核对一致）。
- 下一步：**2.2.9 已于 2026-11-06 部署生产**（[批次记录](../archive/testing/2026-11-06-release-229.md)）；**2.2.10：PYLAB-NET-01（方案 C）`a8fcb44` 已推送 origin/main、CI 通过；PYLAB-03（启动恢复漏 `await`）`900a8ab` 已推送、CI 通过；版本号提交即 2.2.10 构建源，已获授权提交、推送并构建；均未部署**（部署步骤见[版本切分与执行顺序](#版本切分与执行顺序)）。待老大：部署窗口、打 2.2.9 tag、是否批准生产合成账号做登录态验收；随后阶段 2–3。
- 阻断与待老大决定：
  - ①SEC-TPL-01：超管密码命中公开模板值，建议先在后台改密，再把服务器环境变量换成非模板值。
  - ②OPS-07：建议 2.2.9 前给 `stop-dev.sh --all` 加目标确认（会改变 D1 的既有行为）。
  - ③~~2.2.9 发版前只读核对生产 flag 与智能体地址~~：已完成，2026-11-05 生产只读核对（老大授权；生产 backend 容器 2.2.8，相关 5 个文件与 2.2.8 源码 sha256 一致；只读事务、不输出密钥；只对解析为公网的地址发不带凭据、不跟随重定向的请求）：生效的 flow 地址来自 `python_lab_agent_config`（`ai_agent_config` 不存在），为公网模型服务商，新出站校验**通过**、**不重定向**；未删除的 9 个智能体**全部停用**（对话与测试连接都会拒绝停用智能体，当前不出站），其中 2 个通用智能体指向公网中转，校验通过、不重定向；7 个 Dify 指向受信内网白名单地址，校验通过，按规则不对内网发请求，重定向情况未核。结论：2.2.9 的出站硬校验与不跟随重定向不会让生产现有配置失效。
  - ④D-R2 须先于 2.2.9 的发布 workflow 合入。
- 来源：2026-11-05 对 2.2.2（`4d774ec`）→2.2.8（`2d9dda0`）的四组审查 + 独立复查 + 主 Agent 核证。计划本身经一次独立审查（结论"需修改"，13 条意见采纳）和两次针对性复核（均为"仍需修改"，已采纳；最后一轮由主 Agent 直接修订，其中 PYLAB-NET-01 方案 C 的前提经 Docker 实测）。审查材料在仓库外临时目录 `/tmp/wangsh-review-228/`（不入库），结论以本计划与台账为准。
- 范围约定：被复查驳回的结论不列为修复项；P3 中修复成本大于收益的标为「仅记录」。

## 变更日志

- 2026-11-06：老大授权提交、推送并触发发布构建：本文档先提交，版本号随后单独提交为 2.2.10 构建源（构建源提交号、发布 run 与 release-set 在部署记录中写明）。
- 2026-11-06：2.2.10 发版准备：版本号 2.2.9 → 2.2.10（与 `50f8c9f` 同一批 7 个文件、20 行，本地未提交）；版本一致性、workflow/env 合同、两份 compose 解析与镜像标签、`deploy.sh` 语法均通过。回填 PYLAB-03 推送后 ci-quality run 42155133967 通过：pytest 3819 passed / 123 skipped（python governance 两次 errors=0，frontend 879 例）。部署步骤写入计划；按代码核对切换与回滚影响（无迁移；回滚后 2.2.10 建的调试容器不能被 2.2.9 复用，等清理任务回收）。
- 2026-11-06：PYLAB-03 按老大授权提交为 `900a8ab`（代码与测试），随本文档提交一起推送 main；推送后 CI 结果在下次文档更新回填。未打 tag、未部署。
- 2026-11-06：老大决定 PYLAB-03 进 2.2.10 并在本会话修复：`_recovery_expected_config` 改回 `await`（`d972f5d` 拆分时丢失）；新增走真实 Celery 任务的恢复测试（plain/debug × 重试/重投递）与三种拒绝用例，修复前恢复用例均 FAILED，四种变异均被拦下；独立审查通过，三条 P3 测试意见已补；开发栈真实 Docker 恢复两种模式均接管同一容器与同一 generation，修复前写法在同一环境复现"工作区不兼容"。本地已修，未提交。
- 2026-11-06：按老大授权推送 main（`eed0e21..060bd13`，快进、未强推）；推送后 ci-quality run 42149242348 通过（python governance 两次 errors=0；干净 PostgreSQL 上 pytest 3812 passed / 123 skipped；frontend 120 文件 / 879 例；repo-config 通过），markdown-quality 通过。未打 tag、未部署。
- 2026-11-06：PYLAB-NET-01 提交为 `a8fcb44`，按老大授权快进合入本地 main（未推送、未打 tag、未部署）；提交前迁移守卫通过，治理检查当前与 `--base-ref 50f8c9f` 均 errors=0。
- 2026-11-06：PYLAB-NET-01 按方案 C 本地修复（分支 `claude/pylab-net-01`，未提交）：debug 与 plain 都 `--network none`、不发布宿主端口，启动以容器内就绪检查为准，`dap_ws` 只对旧 TCP 会话要求端口。开发栈验收、smoke/soak、Chrome/WebKit 真实点击与独立审查通过；按审查意见修文档两处与一处注释、补 token 分支测试。审查发现范围外 P2，登记台账 PYLAB-03。
- 2026-11-06：2026-11-06 07:48 老大用手机流量（不经操作机代理）打开 `https://wangsh.cn:6608` 正常；同一时段网关记录 47 个外部来源请求（200×45、401×1、429×1），确认外部入口经 2.2.9 网关可用。
- 2026-11-06：2.2.9 部署生产（构建源 `50f8c9f`，run 42050650608）。部署工具沿用 2.2.8 并经独立审查与针对性复核；合成栈 Chrome/WebKit 各 4/4、双人调试 6/6；配对快照与隔离恢复通过；按服务切换，停流约 4.5 分钟；部署后不登录检查通过。外部入口与登录态验收未覆盖。
- 2026-11-05：版本切分改为热修切分：2.2.9 用当前 main 内容尽快发，PYLAB-NET-01 进 2.2.10（2.2.9 部署后在 main 上开发）。理由：SSRF-FLOW-01 是任何登录账号可利用的 P1，PYLAB-NET-01 改调试启动契约、需双浏览器真实点击与 smoke/soak，赶不上 2.2.9。
- 2026-11-05：2026-11-05 生产只读核对（老大授权；生产 backend 容器 2.2.8，相关 5 个文件与 2.2.8 源码 sha256 一致；只读事务、不输出密钥；只对解析为公网的地址发不带凭据、不跟随重定向的请求）：生效的 flow 地址来自 `python_lab_agent_config`（`ai_agent_config` 不存在），为公网模型服务商，新出站校验**通过**、**不重定向**；未删除的 9 个智能体**全部停用**（对话与测试连接都会拒绝停用智能体，当前不出站），其中 2 个通用智能体指向公网中转，校验通过、不重定向；7 个 Dify 指向受信内网白名单地址，校验通过，按规则不对内网发请求，重定向情况未核。结论：2.2.9 的出站硬校验与不跟随重定向不会让生产现有配置失效。新观察：生产当前没有启用的智能体（学生对话页无可用智能体），原因未核，不属于本计划。
- 2026-11-05：首次推送后 ci-quality 的 python governance 失败（A-2 的 3xx 分支使三个函数复杂度超过基线，提交前漏跑治理检查）。`50bb866` 在不改变行为、不调整基线的前提下恢复，三种比较基准均 errors=0。重跑 CI：**通过**（run 42039152655：python governance 两次 errors=0；干净 PostgreSQL 上 pytest 3809 passed / 123 skipped；repo-config、frontend-quality 通过）。以后提交前把 `check_python_governance.py check` 与 `--base-ref <推送前 SHA>` 列入必跑项。
- 2026-11-05：老大授权推送，`main` 由 `a129e14` 快进到 `759e49a`（6 个提交，未强推）；未打 tag、未部署。推送后 markdown-quality 通过；ci-quality（run 42034193780）**失败**：python governance 报 `dify_test.py::run_dify_test` 复杂度 22 超过历史上限 21（`2d239cf` A-2 新增 3xx 分支引入，提交前漏跑治理检查），pytest 步骤因此未执行，repo-config 与 frontend-quality 通过。`50bb866` 修复并推送：`run_dify_test` 两处相同的成功响应抽为 `_dify_success_response`（22→18）；补跑 `--base-ref a129e14` 又发现 `run_agent_chat_blocking`、`stream_agent_chat` 同因 3xx 分支 18→19，3xx 判断分别并入非 200 处理（`_provider_failure`、既有 `_provider_error_frame`），恢复到 14 与 18；行为不变（阻塞路径另用 400+ 组合与拆分前逐例比对一致），未调整基线。重跑 CI：**通过**（run 42039152655：python governance 两次 errors=0；干净 PostgreSQL 上 pytest 3809 passed / 123 skipped；repo-config、frontend-quality 通过）。
- 2026-11-05：老大授权按计划切分提交（只提交，不推送、不打 tag、不部署）。`d6375a3` SSRF-FLOW-01、`199c5e9` D3、`2d239cf` A-1/A-2/FE-TEST-01、`0fa64ca` D-R2、`98f1c46` PYLAB-02 各自成提交，代码、测试与对应 owner 文档同提交；计划、台账、测试状态与发布说明另一提交。提交前逐个导出暂存树做导入可解析核对，前端全量 120 文件 / 879 例通过。
- 2026-11-05：开发栈管理员验收。建合成管理员（role=admin），用容器内合成供应商桩做 API 层 8 项与浏览器两处页面验收，A-1、A-2、FE-TEST-01、SSRF-FLOW-01 全部通过；发现 UI-04（普通管理员打开 PythonLab 智能体配置时读 flag 403，早于本区间）。
- 2026-11-05：A-1、A-2、FE-TEST-01 独立审查通过；补发布说明、API 文档与 Dify 双候选测试；新登记 SSRF-ANA-01（管理员分析路径不经出站硬校验）。
- 2026-11-05：开发栈验收。ENV-DEV-01 完成（重建后核对生效连接）；建两个合成学生账号，PYLAB-02 开发栈双人同时调试 soak 各 6/6 与三项 PythonLab smoke 通过；D-R2 针对性复核通过（补 login 存在断言）；D3 补齐两条验收命令结果。
- 2026-11-05：开始执行。老大按推荐拍板 8 项决策。SSRF-FLOW-01、D3、D-R2、A-1/A-2/FE-TEST-01 分组修复，每组一名执行者加一名只读审查者；D-R2 按审查意见把合同测试改为实际执行 guard 并做 6 种变异验证，guard 前移到构建之前；SEC-TPL-01 与 D3 前提完成生产只读核对；新增 OPS-07；当前状态与各条进度同步。
- 2026-11-05：主 Agent 按第二次针对性复核做最后修订。PYLAB-NET-01 方案 C 订正事实（旧 TCP 路径与平台无关，真实约束是端口读回门槛），附 Docker 实测（`--network none` 下 `docker port` 读不回、`docker exec` 内 DAP `initialize` 成功），推荐由 A 改为 C，决策 #8 同步；热修最小内容与决策 #1 补 D-R2；SSRF-FLOW-01"仅 A"补严格模式传参；21 条已登记台账。
- 2026-11-05：按针对性复核再修订。
  - SSRF-FLOW-01：校验位置改为 `code_generator.py` 出站函数的重试循环之前，一处覆盖两条路径；写明"仅 A"与 A+B 不等价（`endpoint_security` 的 Ollama 与可信内网例外依赖 admin-only 前提）；回填同类排查结论（前端唯一调用点在管理员页）。
  - 热修路径订正为只能从 main 发 2.2.9，补写连锁影响；D3 列为任何发版的前置条件。
  - CI-CADDY-01：`workflow_call` 下 `BASE` 为空或全零时照常校验，并加 `apt-get update`。
  - A-R1：假会话改为在模拟错误之后才拒绝 commit。
  - B-1：测试表述与方案对齐；回滚涉及六个文件；关闭码在 `ws.onclose` 现有那次调用传出。
  - D-R3：理由改用 DEPLOY 现场事实。
  - PYLAB-02 更新为本地已修复与复验的状态；新增 PYLAB-NET-01（P2）及决策项；总览与阶段 1 订正"SSRF-FLOW-01 与 A-2 同改 `code_generator.py`"。
  - 决策项现为 8 项。
- 2026-11-05：按计划独立审查修订。新增阶段 1 首位 SSRF-FLOW-01（P1）；A-2 补 Dify 流式（`chat_stream_dify_helpers.py:439`）与 `_blocking_dify`，订正 `chat_stream.py` 只有一处 `client.stream`；SEC-TPL-01 改为与模板历史全部值比对；A-3、A-R1 的测试断言改为能证明修复的写法；C-R2 扩到三处显示位置；C-R1 选 A 须同步改写 AI_AGENTS 口径；B-1 改为扩展现有 `TerminalConnectionState` 载荷；C-1 改为 hook 内取 `useAuth`；D-R3 改为只打印目标；CI-CADDY-01 补 runner 依赖与按路径触发；阶段 4 订正"不需重建镜像"；新增「需登记台账的条目」；决策项改为 7 项，原 #7、#8 转为默认执行。
- 2026-11-05：起草。纳入区间内 P2 3 条、P3 8 条，范围外 7 条，配置漂移 1 条，文档自我订正 1 条；按阶段 0–4 编排。

## 总览

| 阶段 | 条目 | 进入版本 | 可并行 |
|---|---|---|---|
| 0 环境前置 | ENV-DEV-01 | 不入版本（本地配置） | 先于阶段 1–2 的开发栈验证 |
| 1 发版阻断与安全 | **SSRF-FLOW-01**、A-1、FE-TEST-01、A-2、D3、PYLAB-02（发布部分）、PYLAB-NET-01（待决策）、SEC-TPL-01 | 2.2.9（热修也只能是从 main 出的 2.2.9） | 后端 flow 出站（SSRF-FLOW-01）/ 智能体出站（A-1、A-2）/ compose+脚本（D3）/ 前端（FE-TEST-01）文件不重叠，可并行；PYLAB-NET-01 待老大选定方案后排期 |
| 2 用户可见功能 | C-R1、C-R2（含 AI_AGENTS 订正）、B-1、C-1 | 2.2.9 | 对比页 / PythonLab 前端 / SSE hook 三组可并行 |
| 3 测试与可维护性 | A-3、A-4、A-R1、C-2、D-1（仅记录） | 2.2.9 | 全部可并行 |
| 4 运维与 CI | D-R1、D-R2、D-R3、CI-CADDY-01 | D-R2、CI-CADDY-01 只在仓库生效；D-R1 改在后端镜像内，随 2.2.9；D-R3 需随发布源同步到服务器 | D-R2 须在 2.2.9 发布 workflow 运行前合入 |

每条按：问题 / 证据 / 修复方案 / 文件 / 测试与验收 / 风险与回退 / 依赖 / 是否需要老大决策。行号以 main `a129e14` 为准。

## 阶段 0：环境前置

先修好开发栈，阶段 1–2 的端到端验证才有意义。

### ENV-DEV-01（配置漂移，阻断开发栈调试）

- **问题**：开发栈运行中的 pythonlab-worker 沙箱镜像为 `shuhao07/pythonlab-sandbox:2.2.4`，该 tag 在 Docker Hub 不存在（2.2.4 从未发布，`docker manifest inspect` 返回 `no such manifest`），本地也只有 2.2.8。开发栈任何调试会话都起不来，并会掩盖 PYLAB-02 等问题。**订正（2026-11-05）**：`.env.dev` 文件里实际已是 `2.2.6`（Docker Hub 存在），2.2.4 是开发栈两天前启动时读到的旧值；问题是开发栈改文件后未重建，而非文件写错。
- **证据**：`docker exec wangsh-pythonlab-worker` 读到 `image=...:2.2.4`；`.env.dev` 第 101 行为 `2.2.6`；模板 `.env.dev.example:47` 为 `2.2.8`；`docker-compose.dev.yml:119,235` 缺省回落 `2.2.0`。
- **修复方案**：只改 `.env.dev` 这一行为 `shuhao07/pythonlab-sandbox:2.2.8`（与模板一致），不动其他键；然后按 `bash start-dev.sh` 正常入口重建 backend 与 pythonlab-worker（worker 是 `celery ... worker`，无热加载）。
- **文件**：`.env.dev`（用户本地、不入库）。
- **测试与验收**：worker 内 `echo $PYTHONLAB_SANDBOX_IMAGE` 为 2.2.8；开发栈单用户调试能到断点暂停。
- **风险与回退**：只影响本机开发栈；回退即改回原值。
- **依赖**：无。
- **需要老大决策**：**是**——该文件是老大的本地配置，按规则需授权后才改。
- **进度（2026-11-05）**：老大授权。`.env.dev` 第 101 行已改为 `shuhao07/pythonlab-sandbox:2.2.8`，只改这一行（前后均 149 行）。按 `bash start-dev.sh --docker` 重建：启动前用 canonical Compose 配置核对项目 `wangsh`、数据挂载 `data/dev/`、数据库 `postgres:5432/wangsh_db`；重建了 backend、typst-worker、pythonlab-worker，postgres/redis/frontend 未动。启动后 `/health` healthy（DB、Redis 正常），6608 返回 200，worker 与 backend 内沙箱镜像均为 2.2.8，backend 生效 `DATABASE_URL` 指向 `postgres:5432`，与启动前核对一致。单用户调试到断点已由下方 PYLAB-02 开发栈验收覆盖，ENV-DEV-01 可关闭。

## 阶段 1：发版阻断项与安全

排在最前：SSRF-FLOW-01 是任何登录用户都能触发的 SSRF，严重度最高；A-1 是生产上用户可见的故障；A-2 是 A-1 修好后才真正可达的 SSRF 回显路径，必须同批；D3 是任何从 main 发版的前置条件。SSRF-FLOW-01 只改 flow 路由与 `code_generator.py`，A-1/A-2 改智能体出站文件，D3 改 compose/脚本，FE-TEST-01 改前端，四组文件不重叠，可并行，各配一名只读审查者。PYLAB-NET-01 需老大先选方案再排期。

### SSRF-FLOW-01（P1，范围外，早于 2.2.2）任何登录用户可让服务器请求任意地址并读回响应

- **问题**：`POST /api/v2/pythonlab/flow/test_agent_connection` 只要求登录，`api_url` 直接取自请求体，只检查 http(s) 前缀与长度 ≤500，随后由服务器 POST 到该地址，跟随重定向、最多重试 3 次，失败时把上游响应体前 600 字回显给调用者。任何登录账号（含学生）直接调用该 API 即可探测内网、回环服务与云元数据地址并读回内容。由 `39293d2`（2026-04-11）引入，早于 2.2.2，生产 2.2.8 受影响。主 Agent 已做代码链路核实，**未做运行验证**（不向内网探测）。
- **证据**：
  - 路由：`backend/app/api/pythonlab/flow/api.py:152-186`，依赖 `require_user`（`backend/app/core/deps.py:357-366`，任何角色）；`backend/main.py:224` 以前缀 `/api/v2/pythonlab` 挂载。
  - 流向：`flow/ai_service.py:281` `test_agent_connection_internal` → `code_generator.py:172` `chat_completion(api_url=...)`。
  - 出站：`code_generator.py:17-21` 的 `httpx.AsyncClient(follow_redirects=True)`，无任何出站校验；`:198` 起 `for attempt in range(retries)` 重试；`_format_http_error`（`:24-33`）回显 `body[:600]`。
  - 前端：唯一调用点是 `frontend/src/pages/Admin/ITTechnology/components/AgentConfigModal.tsx:168`（经 `pythonlabCodeApi.ts:99`），只渲染在管理员页 `Admin/ITTechnology/index.tsx:317`。学生界面没有入口，但后端不拦，学生可直接调 API。
- **同类排查结论**（主 Agent 初步排查，见临时材料 `main-verification.md`）：`backend/app/api` 中显式从请求取出站 URL 的只有 `flow/api.py:161` 一处；`model_discovery` 系列均为 `require_admin` 且经 `endpoint_security`。其余 flow 接口的 `api_url` 来自管理员写入的 feature flag（`flow/ai_service.py:117-121`），同样经 `code_generator.py` 出站、无校验、跟随重定向。排查只覆盖"显式取 URL"的写法，执行阶段需按 `rg -n 'api_url|base_url|endpoint|webhook|callback' backend/app/api` 结合各路由 `Depends` 做完整排查。
- **修复方案（取舍）**：
  - **A 出站硬校验 + 不跟随重定向 + 不回显**：校验放进 `code_generator.py` 的出站函数（`chat_completion`，`:172-221`）、**在重试循环之前**，对最终目标 URL 调一次校验；这样请求体 `api_url` 与管理员 feature flag 两条路径一处覆盖，不在路由层另做一遍。客户端改 `follow_redirects=False`，3xx 按失败处理；`_format_http_error` 对外只返回状态码与固定文案，响应体只写服务端日志（限长、脱敏）。
  - **B 收紧为仅管理员可调**：路由依赖改为 `require_admin`。前端唯一入口本来就在管理员页，**不会去掉任何学生界面功能**，只需确认管理员页调用不受影响。
  - **C 不再接受请求体 `api_url`**：只测服务端已配置的 `python_lab_agent_config`/`ai_agent_config`。最彻底，但"填好地址先测再保存"要改成"先保存再测"，前后端都要改。
  - **"仅 A"与 A+B 不等价**：`assert_agent_outbound_endpoint` 有两类例外——本机 11434（Ollama，`endpoint_security.py:40-43`）与 `AGENT_TRUSTED_INTERNAL_ENDPOINTS` 白名单（`:219-225`），注释写明放行理由是"接口 admin-only"。学生可达入口若只套同一校验，学生仍能读回这两类内部服务。若选"仅 A"，学生可达入口必须用**不带任何例外**的校验（不传 `allow_local_ollama`/`allow_trusted_internal`），管理员 flag 路径可沿用带例外的校验。由于 A 的校验只放在 `chat_completion` 一处，分不清入口，"仅 A"时由 `test_agent_connection_internal` 向 `chat_completion` 传入严格模式参数（或在路由层另做一次严格校验）。
  - **推荐 A+B**：B 让入口回到 admin-only，A 的例外前提随之成立；A 同时修好管理员 flag 路径的重定向与回显问题。C 改动大、收益与 A+B 相近，暂不采用。
- **文件**：`backend/app/api/pythonlab/flow/api.py`（B）、`backend/app/services/agents/code_generator.py`（A）；新增 `backend/tests/pythonlab/test_flow_agent_connection_ssrf.py`。
- **测试与验收**：
  - 内网、回环、元数据地址（如 `http://10.0.0.1/`、`http://127.0.0.1:6379/`、`http://169.254.169.254/latest/meta-data/`）被拒，且没有发出任何出站请求（`httpx.MockTransport` 记录请求数为 0）；请求体路径与 feature flag 路径各一条。
  - 公网合法地址返回 302 指向内网时，不发出第二个请求，结果为失败，返回内容不含上游响应体。
  - 上游返回 500 带响应体时，接口返回只含状态码与固定文案。
  - 选 B 时：学生、教师角色调用返回 403，管理员可调用；管理员页 `AgentConfigModal` 测试连接在浏览器中仍可用。
  - 若选"仅 A"：学生调用时 `http://127.0.0.1:11434/` 与白名单内网地址均被拒。
  - `cd backend && pytest tests/pythonlab -q`。
- **风险与回退**：A 可能让少数依赖重定向的模型地址测试失败（文案提示改填最终地址）。回滚为逐文件还原。
- **依赖**：无（与 A-2 文件不重叠）。发布受 D3 前置条件约束。
- **需要老大决策**：**是**——①是否热修（只能从 main 发 2.2.9，连带影响见「版本切分与执行顺序」）；②方案选 A+B / 仅 A / C。
- **进度（2026-11-05）**：老大选热修 + A+B。已按 A+B 修复，`d6375a3`（已推送 origin/main）：路由改 `require_admin`；`chat_completion` 在归一化之后、重试之前做一次出站校验，被拒不重试；客户端不跟随重定向，3xx 判失败；HTTP 错误对外只给状态码与固定文案，响应体限长脱敏后只写服务端日志。新增 13 条测试全部通过。独立审查**通过**，其意见：①发布前只读核对生产 `python_lab_agent_config`、`ai_agent_config` 的 `api_url` 能否通过新校验（学生可达的三个 AI 接口也会受硬校验约束）；②管理员测试连接不再看到上游错误原文，写进发布说明；③`generate_code` 无出站校验但无调用者，不加防御。开发栈验收（2026-11-05，合成管理员 + 容器内 `127.0.0.1:11434` 合成供应商桩，桩只返回合成数据）：API 层学生调用 403 且桩未收到请求；管理员正常地址成功；上游 302 时判失败、桩只收到 1 次请求、返回不含上游响应体。浏览器（Playwright Chromium）在 `/admin/it-technology` 的智能体配置弹窗中，正常地址显示"测试通过"、重定向地址显示"测试失败"及固定提示，只测不保存，未写 feature flag。生产 flag 只读核对已完成，见当前状态③。

### A-1（P2）智能体"测试连接"恒失败

- **问题**：`test_agent` 把拼接前的相对路径交给出站硬校验，所有智能体（含 Dify）测试必然失败，报"仅支持 http/https 的 API 端点"。2.2.5 起生产受影响（`aeae945`）；对话路径用完整 URL，不受影响。
- **证据**：`backend/app/services/agents/ai_agent.py:415-418`；`agent_testing.py:90-95` 返回 `/v1/models` 等相对路径，实际 GET 用 `join_api_url(ctx.api_endpoint, ...)`（`agent_testing.py:164`）。2026-11-05 开发容器实测三种相对路径全部抛 `EndpointNotAllowedError`。
- **修复方案**：在 `ai_agent.py` 校验处改为校验**实际要请求的地址**：普通智能体校验 `_join_api_url(ctx.api_endpoint, test_endpoint)`；Dify 分支校验 `ctx.api_endpoint`（`dify_test.py` 只在其后拼 `/chat-messages` 等路径，同主机）；无 `test_endpoint` 时保持校验 `ctx.api_endpoint`。只算一个 `target` 再调一次 `assert_agent_outbound_endpoint`，不新增 helper。
- **文件**：`backend/app/services/agents/ai_agent.py`；新增 `backend/tests/ai_agents/test_agent_test_endpoint_validation.py`。
- **测试与验收**：
  - 单测：普通 / openrouter / volcengine 三种 flags 下，校验函数收到的是完整 URL 且流程进入请求；Dify 收到 `api_endpoint`；端点为私网地址时仍返回 `success=False` 且消息为拒绝原因。
  - `cd backend && pytest tests/ai_agents -q`。
  - 运行验证：开发栈配一个指向容器 loopback:11434 合成桩的智能体（`allow_local_ollama` 放行），调 `POST /api/v1/ai-agents/test` 得 `data.success=true`。
- **风险与回退**：只改校验目标，回滚单文件即可。
- **依赖**：与 FE-TEST-01、A-2 同批。
- **需要老大决策**：否。

### FE-TEST-01（早于区间，与 A-1 同批）前端把测试失败显示成"成功"

- **问题**：列表页 `if (!response.success)` 判断的是 HTTP 外层信封，后端 `AgentTestResponse.success=false` 时仍弹"测试成功"再弹失败原文；编辑弹窗同理显示绿色勾配失败文字。A-1 修好后用户会第一次真正看到失败结果，必须一起修。
- **证据**：`frontend/src/pages/Admin/AIAgents/index.tsx:241-251`；`frontend/src/pages/Admin/AIAgents/components/AgentForm.tsx:312-316`。
- **修复方案**：两处都改为以 `response.data.success` 判定；失败时用 `data.message` 作为错误文案（列表页 `showMessage.error`，表单 `connectivityResult.success=false`）。
- **文件**：上述两个前端文件；补对应测试（列表页测试处理函数或 AgentForm 测试，按现有测试位置就近添加）。
- **测试与验收**：单测覆盖 `{success:true, data:{success:false}}` 显示失败；`cd frontend && npm run type-check && npm run test`；浏览器分别测一个可用、一个不可用的智能体。
- **风险与回退**：纯展示逻辑。
- **依赖**：A-1。
- **需要老大决策**：否。

### A-2（P2）智能体出站请求跟随重定向，绕过 SSRF 硬校验

- **问题**：硬校验只查首个 URL，而智能体出站客户端都 `follow_redirects=True`。恶意或被攻陷的上游（生产在用第三方中转）返回 302/307 指向内网或 `169.254.169.254`，请求会被带过去；A-1 修好后，测试连接非 200 时 `agent_testing.py:194` 回显 `response.text[:500]`，可读回内网响应。配置端点只需普通管理员，但重定向由上游控制，与权限无关；概率无法估算。
- **证据**：`backend/app/core/http_client.py:27`（共享客户端，普通流式 `chat_stream.py:168` 与 Dify 流式 `chat_stream_dify_helpers.py:439` 的 `client.stream` 使用）；`chat_blocking.py:81`（普通阻塞）与 `:124`（`_blocking_dify`）；`dify_test.py:21`；`ai_agent.py:420`。参照：`ai_partner_evaluation.py:267` 已 `follow_redirects=False` 并显式识别 3xx。
- **修复方案**：
  - **不改**共享客户端 `core/http_client.py` 的默认值：`informatics/github_sync.py:233/246/263` 也用它，可能依赖重定向。
  - 在智能体出站的**每个请求**上传 `follow_redirects=False`（httpx 0.28.1 的 `stream/post/get` 支持逐请求参数，已在开发容器核实）：`chat_stream.py:168` 一处与 `chat_stream_dify_helpers.py:439` 一处 `client.stream(...)`；`chat_blocking.py:81,124` 两个 `AsyncClient` 构造改为 `False`；`dify_test.py:21`、`ai_agent.py:420` 同理。
  - 3xx 一律按失败处理，文案写"上游返回重定向（HTTP 3xx），已拒绝跟随，请填写最终地址"，不回显响应体；对话路径沿用现有 provider 错误帧。
  - `code_generator.py:17-21` 的客户端由 SSRF-FLOW-01 一并处理（请求体 `api_url` 与管理员 feature flag 两条路径），本条不改该文件。
- **文件**：`chat_stream.py`、`chat_stream_dify_helpers.py`、`chat_blocking.py`、`dify_test.py`、`ai_agent.py`、`agent_testing.py`（3xx 文案）；新增 `backend/tests/ai_agents/test_agent_outbound_no_redirect.py`。
- **测试与验收**：用 `httpx.MockTransport` 让首个请求返回 `302 Location: http://169.254.169.254/` ，断言没有发出第二个请求、结果为失败、文案不含响应体；覆盖普通流式、**Dify 流式**、普通阻塞、**`_blocking_dify`**、测试连接、Dify 测试六条路径。`pytest tests/ai_agents -q`；再跑一次合成桩下的正常对话，确认 200 路径不受影响。
- **风险与回退**：依赖 http→https 或补斜杠重定向的现有端点会开始失败。缓解：文案明确提示改填最终地址；执行前可用 `backend/scripts/check_agent_endpoints.py`（只读、不输出密钥）列出生产在用端点人工判断。回滚为逐文件还原参数。
- **依赖**：与 A-1 同一提交批次。
- **需要老大决策**：否（安全修复按已有授权）；行为变化需写进 2.2.9 发布说明。
- **进度（2026-11-05，A-1、FE-TEST-01、A-2 同批）**：执行者已修复，`2d239cf`（已推送 origin/main）。A-1 改为校验实际请求地址；A-2 六条路径逐请求 `follow_redirects=False`，3xx 判失败、不读响应体，`test_basic_endpoint` 成功条件由 `<400` 改为 `<300`；FE-TEST-01 两处改按 `data.success` 判定。执行者额外改了 `frontend/vitest.config.ts` 一行 include（项目用显式清单，不加则新前端测试不被收集；该 glob 只匹配两个新测试文件）。主 Agent 复跑：A-1、A-2 新增测试各 6 条通过，`-k 'ai_agents or pythonlab or sandbox'` 870 passed / 60 skipped，自含离线回归 19 项 OK；前端 type-check 通过、AIAgents 测试 2 文件 4 例通过、lint 0 error（5 条 warning 均在未改动行）。执行者自述旧代码下新增测试全部失败。独立审查**通过**（静态推演同样认为旧代码下新增测试会失败），意见已处理：①补 RELEASE_NOTES 与 API.md；②补 Dify base 不带 `/v1` 的双候选测试（遇 3xx 换下一个同主机候选，两次请求都不发往 Location），A-2 测试现为 7 条；③范围外发现管理员分析路径 `call_llm` 不经硬校验，登记台账 SSRF-ANA-01 并订正 AI_AGENTS 口径。Dify 对话遇 3xx 继续试下一候选、测试连接遇 3xx 即停，两者不一致，审查认为安全上无问题，维持现状。开发栈验收（2026-11-05，合成管理员 + 容器内 `127.0.0.1:11434` 合成供应商桩，桩只返回合成数据）：API 层 A-1 正常智能体 `data.success=true`（桩收到模型列表与对话两次请求）；A-2 重定向智能体判失败、桩只收到 1 次请求、文案含 302 提示且不含响应体；学生流式对话 200 路径正常。浏览器（Playwright Chromium）在 `/admin/ai-agents`：列表页重定向智能体只弹失败提示、不再先弹"测试成功"，正常智能体弹"测试成功"；编辑弹窗失败结果为红色 circle-x 样式。合成智能体经界面软删除，无对话记录残留。生产智能体地址只读核对已完成（全部停用；公网地址不重定向，Dify 内网地址未发请求），见当前状态③。

### D3（发版前风险，本会话 `a129e14` 引入）仓库 compose 的 `name: wangsh`

- **问题**：`stop-dev.sh` 的 `stop_prod_compose`（`:97-103`）先 `env -u COMPOSE_PROJECT_NAME`，再用仓库 `docker-compose.yml`；`--all` 调 `down --remove-orphans`。服务器发布目录名是 `.../2.2.8/source`，2.2.8 的 compose 没有 `name:`，项目名默认 `source`，这些命令碰不到生产 `wangsh` 项目。main 加了 `name: wangsh` 后，**若生产 `.env` 未设 `COMPOSE_PROJECT_NAME`**，同一命令会停掉并移除全部生产容器（bind 数据保留）。
- **证据**：`docker-compose.yml:1`；`stop-dev.sh:97-103`；`docs/operations/DEPLOY.md` 生产检查命令显式 `-p wangsh`（推断生产 `.env` 不依赖默认名）。未读生产 `.env`，前提未核实。仓库内无测试锁定 `name:`。
- **修复方案（二选一）**：
  - **方案 A（推荐）回退 D3**：删除 `docker-compose.yml` 第 1 行。本机目录名本就是 `wangsh`，这行对本机是空操作；去掉后恢复服务器"目录名隔离"。"项目名统一"改为文档约定（生产命令一律显式 `-p wangsh`，DEPLOY 已是如此）。成本最低。
  - **方案 B 保留 D3，给 `stop_prod_compose` 加目标确认**：执行 `down` 前列出目标项目的容器与 `com.docker.compose.project.config_files` 标签，交互确认或要求 `--yes`；并在 `stop-dev.sh` 检测到在 `wangsh-releases/*/source` 下运行时直接拒绝。成本较高，且挡不住其他裸 `compose` 命令。
  - 无论选哪个：**人工核对生产 `.env` 是否设置 `COMPOSE_PROJECT_NAME`**（只看该键是否存在及其值，不读其他键）。若已设为 `wangsh`，风险早于 D3 存在，方案 A 也不够，应再加方案 B 的目录检测。
- **文件**：A：`docker-compose.yml`；B：`stop-dev.sh` 及 `scripts/stop-dev-compose.test.mjs`。
- **测试与验收**：`docker compose --env-file .env.example -f docker-compose.yml config --quiet` exit 0；`node --test scripts/*.test.mjs`；A 方案下核对本机 `docker compose ls` 项目名仍为 `wangsh`。
- **风险与回退**：A 为单行回退；B 改脚本，回滚还原脚本。
- **依赖**：必须在 2.2.9 构建前落地。
- **需要老大决策**：**是**——选 A 或 B；是否授权只读核对生产 `.env` 的 `COMPOSE_PROJECT_NAME`。
- **进度（2026-11-05）**：老大选 A 并授权只读核对。已删除 `docker-compose.yml` 头部 `name: wangsh`，文件与 2.2.8 版本逐字节一致（blob `a3ab396`），`199c5e9`（已推送 origin/main）；独立审查确认回退完整。生产只读核对：三个发布目录都没有 `.env`，生产项目名由命令行 `-p wangsh` 显式传入；2.2.8 compose 有 4 处 `:?` 必填守卫，在发布目录误跑 compose 会先因缺变量报错退出。D3 的实际增量风险小于原推断；真正的残余风险在服务器旧目录 `/home/shuhao/wangsh`，另列 OPS-07。验收：`docker compose --env-file .env.example -f docker-compose.yml config --quiet` exit 0，渲染出的项目名为 `wangsh`（取目录名）；本机 `docker compose ls` 项目名仍为 `wangsh`（开发栈 7 容器运行中）。

### PYLAB-02（范围外，A 线本地已修复）多名学生无法同时调试

- **问题**：调试容器固定发布宿主 `127.0.0.1:5678:5678`（2.2.8 `backend/app/core/sandbox/docker.py:265`，`cd868f8` 引入，早于 2.2.2），同机第二个调试容器启动即报 `port is already allocated`，学生看到"运行环境启动失败，请联系老师检查配置"。2026-11-05 provider 层真实 Docker 复现：u990001 成功，u990002 失败。
- **修复（主 Agent A 线，`98f1c46`，已推送 origin/main）**：
  - 端口：`-p 127.0.0.1::5678`，由 Docker 分配宿主端口，`_get_dynamic_port()` 读回。
  - 收紧：debugpy 改为 `--listen 127.0.0.1:5678`，防止修复后同一 bridge 上的其他调试容器直连本调试器；DAP 本就经 `docker exec` 在容器内连接（`docker_dap.py`）。
  - 已验证：单测；provider 层双用户并发复验通过。未验证：开发栈 API/浏览器端到端（被 ENV-DEV-01 阻断）。
  - **不在本计划执行范围**。
- **本计划只列剩余步骤**：
  1. ENV-DEV-01 解决后，在开发栈用两个账号同时调试，补一次 API/浏览器端到端，并按项目规则跑 PythonLab 调试相关 smoke（`backend/scripts/smoke_pythonlab_dap_step_watch_soak.py`、`smoke_pythonlab_ws_owner_concurrency.py`、`smoke_pythonlab_print_visibility_probe.py`）。
  2. 随 2.2.9 构建发布（后端镜像；worker 为 celery，开发栈改代码后需重建 worker 才生效）。
  3. 生产部署后，用两个学生账号同时点"调试"，两者都到 READY 并能在断点暂停；记录到测试状态。
  4. 满足后关闭台账 PYLAB-02。
- **需要老大决策**：否（发布本身按发版授权）。
- **进度（2026-11-05，剩余步骤 1 完成）**：老大授权后在开发库建两个合成学生账号（`合成调试甲-PYLAB02` id=13、`合成调试乙-PYLAB02` id=14，班级"合成验收"；学号即登录凭据，随机生成，只存于仓库外 600 权限临时文件，未写入任何文档）。开发栈（容器挂载工作区源码，重建后修复已生效）上两人同时跑 `smoke_pythonlab_dap_step_watch_soak.py` 各 6 轮：**均 6/6 通过**，每轮覆盖 initialize、setBreakpoints、stackTrace、variables、evaluate、stepIn/stepOut/next、continue；运行期间采样 60 次，最多同时 2 个 debug 容器，宿主端口各不相同且都只绑 `127.0.0.1`。另跑 `smoke_pythonlab_ws_owner_concurrency.py`（`OWNER_MODE=matrix`，识别为 steal 并通过）与 `smoke_pythonlab_print_visibility_probe.py`（7 个标记全部可见且有序），均 exit 0；结束后无残留 sandbox 容器。合成账号保留在开发库，供 B-1、PYLAB-NET-01 复用，老大要求时删除。**未覆盖**：两个真实浏览器同时调试（Chrome channel / WebKit 真实点击按规则留给 B-1 与 PYLAB-NET-01 的前端验收）、生产验证（步骤 3）。

### PYLAB-NET-01（P2，范围外，早于区间）调试容器可联网，限制只靠学生可改写的 sitecustomize

- **问题**：plain 模式容器 `--network none`（`docker.py:272`），debug 模式不加网络限制，跑在默认 bridge 上且可出站。学生代码的联网限制只有工作区里的 `sitecustomize.py`（`docker.py:558-559` 写入，`backend/app/core/sandbox/base.py:81-125` 生成）。它有三个弱点：
  - 只替换了 `socket.socket.connect` 与 `socket.create_connection`；
  - 放行回环；
  - 写在学生可写的 `/workspace` 里（`:rw` 挂载，`PYTHONPATH=/workspace`）。学生代码可以改写或删除它，也可以用 `sendto`、子进程等不经这两个函数的方式联网。
  - 结果：调试模式下学生代码可访问外网与 bridge 上可达的服务。PYLAB-02 已把 debugpy 收到容器内回环，但不解决学生代码本身的出站。
- **证据**：上述行号；`docs/features/PYTHONLAB.md:19` 记录"OPS-01（debug 网络/DAP）未关闭"。
- **修复方案（取舍）**：
  - **A debug 容器改用 `--internal` 独立网络**：建一个 `docker network create --internal pythonlab-debug`，debug 容器接入它。无外网出口；同网容器之间仍互通（debugpy 已只听回环，风险较小）。internal 网络能否发布宿主端口未实测（审查者按源码判断不能），若不能，A 要做 C 的全部端口契约改动，另加服务器网络对象的创建与维护。
  - **B 每个会话独立 internal 网络**：隔离最彻底，容器之间也不互通；代价是网络对象的创建、回收与泄漏处理，复杂度明显更高。
  - **C debug 也用 `--network none`**：**2026-11-05 主 Agent 用 2.2.8 沙箱镜像实测**：`--network none` 加 `-p` 时容器能启动，但 `docker port` 返回"no public port published"；debugpy `--listen 127.0.0.1:5678` 正常监听，经 `docker exec` 在容器内连 `127.0.0.1:5678` 发 DAP `initialize` 返回 `success=True`。旧 TCP 路径只在 meta 既无 `docker_container_id` 也无 `sandbox_owner_token` 时才走（`dap_transport.py:12`），Docker 会话与平台无关都走 `docker exec`。**真实约束是读回宿主端口这道启动门槛**：新建容器读不回端口会报"调试端口分配超时"（`docker.py:358-364`），复用路径（`:304-306`）与 `dap_ws`（`handlers.py:348-352`）都要求端口大于 0。C 需要：Docker 会话不再加 `-p`，启动以既有 `_wait_for_readiness`（容器内 `/proc/net/tcp`）为准，不再要求读回端口；`dap_ws` 对有容器 ID 的会话不再要求 `dap_port>0`，K8s/旧 TCP 会话保留端口校验。
  - **推荐 C**：无出站、容器间也不互通、不需要服务器网络对象；端口契约改动 A 同样要做。B 不采用。无论选哪个，都不再把 `sitecustomize` 当安全边界，只作为友好提示保留。
- **文件**：`backend/app/core/sandbox/docker.py`（`docker run` 网络参数、去掉端口读回门槛）、`backend/app/api/pythonlab/ws/handlers.py`（`dap_port` 门槛）、`backend/app/api/pythonlab/sessions.py`（`dap_port` 字段语义）、相关单测；选 A 时另加部署文档与网络对象初始化。
- **测试与验收**：
  - debug 容器内 Python 用 `socket.socket().sendto` 与原生连接访问公网地址均失败；
  - 两名学生的 debug 容器互相不可达（C 下没有网络路由）；
  - 调试全流程（断点、多断点连续 Continue）不回归，按项目规则做 Chrome channel 与 WebKit 真实点击；
  - 跑 PythonLab smoke/soak。
- **风险与回退**：改动调试启动契约，这是 PythonLab 历史上最易回归的部分（TTY 附着竞态、DAP 传输都在这里出过问题）。回滚为还原网络参数与端口门槛。
- **依赖**：PYLAB-02 合入后进行；ENV-DEV-01（开发栈验证）。
- **进度（2026-11-06，`a8fcb44`，已推送 origin/main，推送后 CI 通过，未发布）**：
  - 改动：`docker.py` 两种模式都 `--network none`，不再 `-p`，删去端口读回与"调试端口分配超时"，新建与复用都以 `_wait_for_readiness`（容器内 `/proc/net/tcp`）为准，返回的 `dap_host`/`dap_port` 为空；`docker_runtime.py` 复用要求两种模式都是 `NetworkMode=none`，旧版本接在 bridge 上的调试容器不被接管；`dap_ws` 对带 `docker_container_id` 或 `sandbox_owner_token` 的会话不再要求端口大于 0（判断放在 `ws/validation.py`，为守住治理复杂度上限），旧 TCP 会话保留 4410。`sessions.py` 无需改动（API 返回 `dap_port` 为空，前端不依赖）。
  - 验证：`pytest -k 'pythonlab or sandbox'` 488 passed / 60 skipped，新增/改动的测试在修复前源码上失败，token 分支另经变异确认；治理检查当前与 `--base-ref 50f8c9f` 均 errors=0。开发栈（2.2.8 沙箱镜像，合成学生）：debug 容器 `NetworkMode=none`、`PortBindings={}`、`docker port` 为空；容器内 `python3 -I`（不加载 sitecustomize）TCP 连接与 UDP `sendto` 到 TEST-NET-1 地址 192.0.2.1 均 `Network is unreachable`，DNS 解析失败，debugpy 仍在 `127.0.0.1:5678` 监听。两名合成学生同时 DAP soak 各 6/6；owner 并发与 print 可见性 smoke 通过；Chrome channel 与 WebKit 真实点击各 4/4；无残留容器。
  - 独立审查（只读）：**通过**，改动范围内无 P1/P2；P3 文档两处与一处过时注释已改，并补 `sandbox_owner_token` 分支的 ws 测试。范围外 P2 登记为台账 PYLAB-03。
  - 未覆盖：两个 debug 容器之间的互探未单独测（`--network none` 下只有回环，由单容器探针推断）；生产验证。
  - 切换与回滚（按代码推断，未实测）：backend 与 pythonlab-worker 必须同版本切换；部署时仍在运行、接在 bridge 上的旧调试容器在其会话结束前不受隔离，之后同名复用会报"运行环境网络不兼容"；回滚到 2.2.9 时，2.2.10 建的调试会话没有宿主端口，`dap_ws` 会以 4410 关闭，需学生重新开始调试。部署后核对 `docker ps --filter label=wangsh.pythonlab.runtime-mode=debug` 的容器 `NetworkMode` 均为 `none`。
- **需要老大决策**：**是**——选 A / B / C，以及排期。推荐 C；只改后端代码、不需要服务器网络对象，可以进 2.2.9，但前提是开发栈端到端与双浏览器真实点击、smoke/soak 全部通过，否则 2.2.9 之后单独发版。

### PYLAB-03（P2，2.2.10 审查发现，早于区间）worker 在启动中途丢失后恢复必定失败

- **问题**：`backend/app/tasks/pythonlab.py` 的 `_recovery_expected_config` 调用异步 `_resolve_host_mount_path` 未 `await`，期望挂载成了协程对象的字符串，`check_reuse` 必报"运行环境工作区不兼容"。worker 在 `STARTING` 中途丢失、任务再次执行时，本应接管已建好的那一代容器，结果会话进 `FAILED`（该错误不可重试），学生需重新启动；失败是关闭方向，不越权、不删资源。
- **根因与范围**：`d972f5d`（2026-09-12 治理复杂度拆分）把原本带 `await` 的内联表达式抽成同步 helper 时丢失。2.1.6 起各 tag 与 2.2.9 构建源 `50f8c9f` 都包含该提交，生产 2.2.9 受影响。真实 prefork SIGKILL/Redis 恢复证据记录于 2026-09-11（`abb8bec`），早于该提交，之后没有重测。同类排查：静态扫描 `backend/app` 内私有协程未 await 的调用，只有此处（另 9 处交给调度包装，不是缺陷；公开同名方法与 dict 方法同名，未覆盖）。
- **修复**：helper 改为 `async def` 并 `await`，调用处 `await`；不新增抽象。
- **进度（2026-11-06，`900a8ab`，已推送，推送后 ci-quality run 42155133967 通过：pytest 3819 passed / 123 skipped，未发布）**：
  - 测试：新增 `test_worker_loss_during_start_recovers_running_generation`（plain/debug × 重试/重投递），走注册的真实 Celery 任务、真实 `DockerProvider` 与工作区 journal，修复前均 `FAILED`（`SANDBOX_START_FAILED`，"工作区不兼容"），修复后在 `STARTING` 下等就绪、再发布 READY，接管同一容器与 token，不新建/不删除/不改写工作区。eager 模式的 `delivery_info` 不带 `redelivered`，重投递用例经 `task_prerun` 注入 `redelivered=True`（retries=0）。另加 `test_worker_loss_recovery_rejects_untrusted_target`（旧 generation token、容器已退出、缺恢复协议号）：均 `FAILED`，journal 与工作区不变，不删资源。内存变异核对：去掉就绪等待、归属校验、running/名称检查、协议号检查，分别被对应用例拦下；去掉重投递注入，重投递用例失败。`pytest -k 'pythonlab or sandbox'` 495 passed / 60 skipped；迁移守卫通过；治理检查当前与 `--base-ref 060bd13`（上次 CI 全绿）均 errors=0。
  - 独立审查（只读）：**通过**，无 P1/P2；三条 P3 测试意见（就绪等待未断言、恢复独有拒绝分支无任务级负例、未走真实 `redelivered` 解析）已按上条补齐。审查另指出既有行为（主 Agent 已核代码，回收时长未实测）：恢复以永久错误结束时容器仍在运行、journal 仍为 live，但 FAILED 元数据没有 token，`stop_session` 不会删它（按设计保留未证实归属的资源），同一用户的新会话在其被清理任务回收前会被拒绝。修复后只剩真正不可信或失败的恢复会走到这里。
  - 开发栈真实 Docker（worker 容器内独立进程，读当前源码；合成用户 990003，不在业务库）：两种模式都先真实建容器、journal 记 live、Redis 保持 `STARTING`，再跑恢复。修复前写法复现"工作区不兼容"且容器不变；修复后接管同一容器 ID 与同一 generation token，`NetworkMode=none`，`dap_port` 为空。结束后容器、合成 Redis 键与工作区均无残留。
  - 未覆盖：真实 worker SIGKILL 加 broker 重投的端到端（上次是 2026-09-11）；已因本缺陷进入 `FAILED` 的会话不会自动恢复。

### SEC-TPL-01（来自 A-4/D-2，生产人工核对）生产 `.env` 是否沿用了模板值

- **问题**：`must_set` 只拒绝空值和 `change_me`。2.2.2 与 2.2.8 的 `.env.example` 中，`SECRET_KEY`、`POSTGRES_PASSWORD`、`SUPER_ADMIN_PASSWORD` 的占位值都能通过，2.2.8 的 `AGENT_API_KEY_ENCRYPTION_KEY` 更是一把公开的合法 Fernet 密钥。若生产照抄过其中任一值：`SECRET_KEY` 泄露可伪造 JWT；加密密钥公开则已存 API Key 可被解密。main 已统一改为 `change_me`。
- **证据**：`backend/app/core/config/__init__.py:53-60`；`git show 2.2.8:.env.example`。
- **修复方案**：在服务器上用不输出明文的方式比对。比对对象是**`.env.example` 历史上这四个键出现过的全部值**，不只 2.2.2、2.2.8 两版：
  1. 执行时在本地用 `git log -p --all -- .env.example` 收集这四个键所有出现过的值，去重后只把**哈希**带到服务器（值本身不写进本文档、命令记录或日志）。
  2. 服务器上对生产 `.env` 同名四键求同样的哈希，逐键打印"命中模板历史值 / 未命中"；另对加密密钥只输出"`Fernet()` 可接受 / 不可接受"。
  - 全部"未命中"：结束，记录到测试状态。
  - `SECRET_KEY` 命中：轮换后所有登录会话失效。
  - 加密密钥命中：轮换需要一次性迁移脚本，用旧密钥解密、新密钥重加密全部已存 API Key，需另立行动项并先备份。
- **文件**：无代码改动（仅服务器只读命令；如需轮换另立项）。
- **测试与验收**：比对输出四行"命中/未命中"加一行格式结论，不含任何值；收集到的模板历史值个数记录在执行记录中（只记个数）。
- **风险与回退**：只读核对无风险；轮换为高影响操作，另行授权。
- **依赖**：A-4 上线前必须先确认生产加密密钥是合法 Fernet 格式（否则 A-4 会让后端起不来）。
- **需要老大决策**：**是**——是否授权这次生产只读比对（这是应用层密钥，与 SEC-03 已接受"不轮换服务器密码"不是同一件事）；比对命中时是否轮换。
- **进度（2026-11-05）**：老大授权只读比对。读生产 backend 容器实际环境，与 Git 历史中这四个键的全部模板值比对，未输出任何值：`SECRET_KEY`、`POSTGRES_PASSWORD`、`AGENT_API_KEY_ENCRYPTION_KEY` 未命中，加密密钥为合法 Fernet（A-4 进 2.2.9 的前提满足）；**`SUPER_ADMIN_PASSWORD` 命中模板值，且仓库为 PUBLIC**。`init_super_admin` 只在账号不存在时创建、不改写既有密码，实际登录密码取决于数据库哈希，未核验（不用模板密码试登录）。处置待老大决定，推荐：后台给超管改密，再把服务器环境变量换成非模板值。

## 阶段 2：用户可见功能

阶段 1 之后做：这些是功能错误或体验问题，不涉及安全，也不阻断发版。对比页（C-R1/C-R2）、PythonLab 前端（B-1）、SSE hook（C-1）三组文件不重叠，可并行。B-1 改动调试启动时序，按项目规则第 3 节必须做 Chrome channel 与 WebKit 真实点击验收。

### C-R1（P2）多课时对比图用全局最早时间做原点

- **问题**：`timelineSeriesData` 取所有记录里最早的桶作共同原点。跨天对比时后一节课横坐标偏移 1440 分钟以上，两条曲线被挤到图两端；与 `AI_AGENTS.md:367`"按各分析起点计算相对分钟"不符。
- **证据**：`frontend/src/pages/Admin/AgentData/TaskAnalysisComparePage.tsx:59`；测试 `TaskAnalysisComparePage.helpers.test.ts:26` 把全局原点固化成了期望值（同日 1 分钟差的数据掩盖了跨天情形）。
- **修复方案**：每条 series 用自己的起点算相对分钟，把 `allTimes`/`origin` 从函数级移到 `prepared.map` 内部。起点口径三选一：
  - **方案 A（推荐）**：各记录自己最早的有效桶。改动最小，前端可独立完成。**注意口径差异**：后端分桶以分析的 `start_at` 为基准（`backend/app/services/agents/agent_analysis_timeline.py:87` `start_epoch = start_at.timestamp()`，`:94` 按 `start_epoch` 对齐分桶），首个时段无提问时，"最早有效桶"会晚于分析起点。选 A 时须同步把 `AI_AGENTS.md:367`"按各分析起点计算相对分钟"改写为"按各记录首个有提问的时段计算相对分钟"，不能只改代码。
  - **方案 B**：分析时段的 `start_at`，与后端分桶基准和现有文档一致。但需先核实结果里是否保存了 `start_at`（`agent_analysis_timeline.py:71` 是函数参数，未确认写入返回结果）；未保存则需改后端，范围变大。
  - 方案 C：维持绝对时间对齐，改文档。不推荐，跨天对比不可读。
- **文件**：`TaskAnalysisComparePage.tsx`、`TaskAnalysisComparePage.helpers.test.ts`。
- **测试与验收**：改测试期望为各自从 0 开始；新增跨天用例（两条记录相隔一天，均从 0 起）。`npm run type-check && npm run test`；浏览器打开一组跨天对比截图确认。
- **风险与回退**：纯前端展示。
- **依赖**：无。
- **需要老大决策**：**是**——起点口径 A 或 B（产品语义："第几分钟"从本节课第一次提问算，还是从分析时段开始算）。

### C-R2（P3）对比页文档声称的图例与 Bloom 行为未实现（含 AI_AGENTS 自我订正）

- **问题**：`AI_AGENTS.md:367` 写"概览、Bloom 横轴、时序图例与提示统一使用短标题及记录编号""Bloom 优先兼容旧总分布，否则汇总已保存桶分布"。实际三处显示位置都没有带编号：时序图例只在标题为空时用 `#id`（`TaskAnalysisComparePage.tsx:49`），Bloom 横轴同样（`:151`），概览表头只有标题截断加日期（`:241`）；Bloom 只读 `normalizedResult.bloom`（`:30`），无桶汇总兜底。同一行还有本会话 `a129e14` 加的订正"该修正已随 2.2.5–2.2.8 发布"，写得过宽：实际只有"真实时间分钟"部分发布，且原点口径与文档不一致（即 C-R1）。
- **修复方案**：
  - 显示名：三处（`:49` 时序图例、`:151` Bloom 横轴、`:241` 概览表头）统一为短标题加 `#id`，如 `` `${title.slice(0, 12)} #${record.id}` ``，同前缀记录可区分。只在文件内就近写一个显示名表达式，三处都用它，不另建跨文件 helper。
  - Bloom：执行时先核实本文件 `:69-73` 的 `normalizeRecord`（它只做 `record.result.result || record.result` 解包，看上去不汇总桶分布）以及后端保存结果时是否已写入 `bloom`。已有总分布则只订正文档；没有则在 `bloomSeriesData` 中对 `timeline_buckets[].bloom` 求和兜底，缺失仍为 `null`（不用 0 冒充）。
  - 文档：重写 367 行的状态说明，分别写清"已发布（真实时间分钟，2.2.5 起）""随 2.2.9 修正（原点口径、显示编号、Bloom 兜底）"，删除过宽的那句订正；若 C-R1 选 A，同时改写原点口径表述。
- **文件**：`TaskAnalysisComparePage.tsx`、helpers 测试、`docs/features/AI_AGENTS.md`。
- **测试与验收**：同前缀标题的两条记录在三处显示名都不同；如实现 Bloom 兜底，补"无 bloom、有桶分布"用例；浏览器核对三处显示；文档门禁三项。
- **风险与回退**：低。
- **依赖**：与 C-R1 同一提交。
- **需要老大决策**：否（Bloom 兜底按核实结果走，不新增产品口径）。

### B-1（P3）终端附着被拒后启动状态卡 10 秒

- **问题**：后端 `close(4500)` 等致命关闭时，终端里已立刻写出原因（`XtermTerminal.tsx:498-499`），但 `terminalReadiness.ts:32-36` 的 `update(false)` 不让等待者失败，`useDapRunner.ts:867` 状态停在 starting，最多 10 秒后才报通用文案"终端连接未就绪，请停止后重试"。
- **修复方案**：沿用现有链路，不新增回调链：
  - `core/terminalReadiness.ts` 的 `TerminalConnectionState` 由 `{ sessionId, ready }` 扩为 `{ sessionId, ready, closeCode? }`；`update()` 收到 `ready=false` 且 `closeCode` 属于致命码 `{4401, 4403, 4404, 4500}` 时，reject 该会话当前全部等待者（与已有 `reset` 的取消逻辑同形），错误文案按码给出（4500：终端附着失败，请重新运行；4401：登录失效；4403/4404：会话无权限或已不存在）。非致命码行为不变。
  - `XtermTerminal.tsx` 的 `ws.onclose`（`:488`）里已有一次 `onConnectionReady?.(false)`，**就在这一次调用中**传出关闭码（`onConnectionReady?.(false, ev.code)`，参数可选），不在后面的致命码分支再调第二次；是否致命由 `terminalReadiness.update()` 按码判断。
  - `RightPanelView.tsx:148-150` 的 `handleTerminalReady` 把关闭码放进 `onTerminalConnection({ sessionId, ready, closeCode })`；`RunnerActionsContext.ts:35`、`useDebugSession.ts:60/337` 只需随类型变化透传，`useDapRunner.ts:316-317` 把 `closeCode` 交给 `update()`。
  - 不改后端。
- **文件**：`core/terminalReadiness.ts`、`components/XtermTerminal.tsx`、`components/rightPanel/RightPanelView.tsx`、`stores/RunnerActionsContext.ts`、`hooks/useDebugSession.ts`、`hooks/useDapRunner.ts`（均在 `frontend/src/pages/Admin/ITTechnology/pythonLab/` 下）。
- **测试与验收**：`terminalReadiness.test.ts` 增加"`update(sessionId, false, 4500)` 只 reject 该会话的等待者、带具体文案，不影响随后新会话；非致命码 `update(sessionId, false, 1006)` 不 reject"；`useDapRunner.runControl.test.ts` 增加"致命关闭后 startSession 立即报具体原因而非等待超时"。`npm run type-check && npm run test`；**Chrome channel 与 WebKit 真实点击**：正常调试、多断点连续 Continue 不回归。
- **风险与回退**：触及调试启动时序；回滚涉及上面列出的六个文件，按同一提交整体还原。
- **依赖**：ENV-DEV-01（开发栈调试可用）；PYLAB-02 已合入（避免并发验收时混入端口冲突）。
- **需要老大决策**：否。

### C-1（P3）教师打开三个管理页时 SSE 每 60 秒 403

- **问题**：课堂互动、小组讨论、信息学三页对 staff 开放，但 `useAdminSSE` 默认 `enabled=true`，后端 `require_admin_sse`（`backend/app/core/deps.py:285`）只放行 admin/super_admin，教师在页内持续 403 重试（退避上限 60s，`useAdminSSE.ts:70`）。SSE-01 只修了学生端，这三页早于区间就如此。
- **证据**：`frontend/src/pages/Admin/ClassroomInteraction/index.tsx:110`、`frontend/src/pages/Admin/Informatics/index.tsx:172`、`frontend/src/pages/Admin/AgentData/components/GroupDiscussion/index.tsx:259`。
- **修复方案**：
  - **方案 A（推荐）**：在 `useAdminSSE` 内部调用 `useAuth()`（`frontend/src/hooks/useAuth.ts`，已导出 `isAdmin`），实际订阅条件取 `enabled && isAdmin()`。签名不变，与后端判定同源，一处修改覆盖现有与未来页面；学生端 `AIAgents` 已显式传 `auth.isAdmin()`，结果不变。执行时确认 hook 的调用方都在 `useAuth` 的 Provider 之内。
  - 方案 B：只给这三页显式传 `auth.isAdmin()`。改动分散，未来新页面可能再漏。
  - 两种方案对教师都只是不再发无效请求，实时刷新本来就收不到，无功能退化。
- **文件**：A：`frontend/src/hooks/useAdminSSE.ts` 及其测试；B：三个页面。
- **测试与验收**：hook 单测"非管理员不创建 EventSource、管理员照常订阅"；浏览器用教师账号打开三页，网络面板无 `/admin/stream`。
- **风险与回退**：低。
- **依赖**：无。
- **需要老大决策**：否（默认按方案 A；如老大希望改动只落在三页，选 B）。

## 阶段 3：测试与可维护性

不影响用户可见行为，主要补回归保护和失败路径。各条文件互不重叠，可全部并行；A-4 依赖 SEC-TPL-01 的结论。

### A-3（P3）缓存修复的回归测试没有真正调用 `get_agent`

- **问题**：`test_agent_cache_detached.py` 第一个测试手工往 `_AGENT_CACHE` 塞 dict 再断言是 dict，第二个直接 `AIAgent(**snapshot)`；`293b24f` 的快照写入与命中重建两步都没被执行。代码按阅读无误（`ai_agent.py:169-193`），风险是以后回归无人拦截。
- **修复方案**：复用现有 SQLite 异步会话夹具（参照 `backend/tests/assessment/test_assessment_availability_isolated.py` 等的 `sqlite+aiosqlite` 写法），插入一个智能体后连调两次 `get_agent`：第二次命中缓存，断言返回实例**不属于任何 session**（`sqlalchemy.orm.object_session(obj) is None`，或 `sqlalchemy.inspect(obj).transient`）且关键字段齐全；再调 update/delete 后断言缓存失效。只改测试。
- **文件**：`backend/tests/ai_agents/test_agent_cache_detached.py`。
- **测试与验收**：`pytest tests/ai_agents/test_agent_cache_detached.py -q`；临时把快照逻辑改回存 ORM 实例，确认新测试会失败（验证后还原）。
- **风险与回退**：仅测试。
- **依赖**：无。
- **需要老大决策**：否。

### A-4（P3）必填密钥只校验非空，不校验格式

- **问题**：`config/__init__.py:53-60` 的 `must_set` 只判空值和 `change_me`；格式错误的 `AGENT_API_KEY_ENCRYPTION_KEY` 要到第一次保存智能体才暴露。现有 `test_fernet_key_format_rejects_wrong_length` 测的是 cryptography 库本身，不是应用代码。
- **修复方案**：在同一 `if not self.DEBUG:` 分支内，`must_set` 之后实例化一次 `Fernet(self.AGENT_API_KEY_ENCRYPTION_KEY)`，失败时抛 `ValueError("AGENT_API_KEY_ENCRYPTION_KEY 不是合法的 Fernet 密钥")`。不扩展到其他键（`SECRET_KEY` 已有长度校验）。
- **文件**：`backend/app/core/config/__init__.py`；`backend/tests/ai_agents/test_agent_cache_detached.py` 中现有模板占位测试旁补一条"非法格式被拒"的应用级测试。
- **测试与验收**：`pytest tests/ai_agents -q`；`DEBUG=False` + 合法 Fernet 能启动、非法格式启动即报错。
- **风险与回退**：**若生产现有密钥格式不合法，部署后后端起不来**。所以必须先完成 SEC-TPL-01 并确认生产密钥能被 `Fernet()` 接受（可与那次比对一起只输出"合法/不合法"）。回滚为单文件还原。
- **依赖**：SEC-TPL-01。
- **需要老大决策**：否（但受 SEC-TPL-01 授权影响；未授权核对前不建议进 2.2.9）。

### A-R1（P3）隐私导出失败时 FAILED 审计记录丢失

- **问题**：导出路径 `except Exception:` 直接 `_log_failure`，没有先 rollback。导出失败多为数据库错误，PostgreSQL 事务处于 aborted 状态时审计 INSERT 也会失败，被 `_log_failure` 内部吞掉，FAILED 审计丢失。同一提交里删除路径已先 rollback（`:372-374`）。
- **证据**：`backend/app/api/endpoints/management/users/privacy.py:295-296`（`8be5c03`）。
- **修复方案**：在 `:296` 前加 `await db.rollback()`，与删除路径一致。
- **文件**：`privacy.py`；`backend/tests/users/test_gdpr_compliance.py` 补一条。
- **测试与验收**：模拟导出过程中数据库错误，断言 `EXPORT_DATA_FAILED` 审计行存在且原异常照常抛出。测试必须能证明修复本身：
  - 注意 `EXPORT_DATA_REQUESTED` 审计在 `try` 之外先写入并提交（`privacy.py:220-223`），这次 commit 必须正常成功。
  - 首选用一个假会话：**在模拟的数据库错误发生之后**、`rollback()` 被调用之前拒绝 `commit()`（模拟 PostgreSQL aborted 事务）；调用 `rollback()` 后恢复正常。这样不 rollback 时 FAILED 审计写入必然失败。
  - 或真实会话下先触发会话失败状态。
  - 验收时**临时去掉新增的 `rollback()`，确认该测试失败**，再还原。
  - `pytest tests/users -q`。
- **风险与回退**：一行改动。
- **依赖**：无。
- **需要老大决策**：否。

### C-2（P3）隐私面板缺撤回与保存失败的测试

- **问题**：`PrivacyConsentPanel.test.tsx` 只覆盖加载、授予 `AI_USAGE`、加载失败；撤回成功、`update`/`withdraw` 失败无断言。代码行为正确，属回归保护缺口。
- **修复方案**：补两条用例：撤回成功后显示"已撤回"；`withdraw`/`update` reject 后出现错误提示且未调用 `showMessage.success`。只改测试。
- **文件**：`frontend/src/components/PrivacyConsentPanel.test.tsx`。
- **测试与验收**：`npm run test`。
- **风险与回退**：仅测试。
- **依赖**：无。
- **需要老大决策**：否。

### D-1（P3，仅记录）游戏上传在鉴权前放宽到 502MiB

- **问题**：`gateway/Caddyfile` 的 `@game_upload` 与后端 `request_budget.py:89-93` 对 `/api/v1/admin/it/games` 放行 502MiB；FastAPI 0.128 先解析 multipart 再求值 `require_admin`，未登录请求的 body 会先落临时文件再 401。
- **处置：仅记录，不改代码**。复查依据：`read_body 30s` 卡住单请求，预鉴权暂存总量约等于攻击带宽×30s，旧 16MB 上限多开连接也能达到同样总量；连接断开即释放，不涉及数据或权限；后端预算只对 POST 生效，其他方法不读 body。审查者原建议"先查 Authorization/Cookie 是否存在"填任意值即可绕过，已撤回。
- **重新评估条件**：生产出现临时目录磁盘告警或该路径异常流量；届时再评估网关层鉴权（如 `forward_auth`）的成本。
- **需要老大决策**：否（如老大希望主动收紧，另行提出）。

## 阶段 4：运维与 CI

改的是脚本、工作流和配置加载，四条文件互不重叠，可并行。生效位置各不相同：

- D-R2、CI-CADDY-01 只在仓库与 GitHub Actions 中生效，合入 main 即可。
- **D-R1 的改动在后端镜像内**（`backend/app/core/config/__init__.py`），生产不受影响但代码随 2.2.9 镜像一起发布。
- **D-R3 改的是 `scripts/deploy.sh`**，要随发布源同步到服务器发布目录才在生产生效。
- **D-R2 必须在 2.2.9 的发布 workflow 运行之前合入**，否则这次发布本身就不受保护。

### D-R1（范围外，条件 P2）本地进程模式逐键回落读取生产 `.env`

- **问题**：`backend/app/core/config/__init__.py:79` 的 `env_file=str(PROJECT_ROOT / ".env")` 是仓库根绝对路径。`start-dev.sh` 本地进程模式只导出 `.env.dev`/`.env.local` 里有的键（值含 `${` 的行被 `:159` 跳过），其余键由 pydantic-settings 回落到根 `.env`。开发机根目录确有 `.env`（只确认存在，未读内容），违反项目规则 7.0。全容器开发栈不受影响（容器内 `PROJECT_ROOT=/`，`/.env` 不存在，已实测）。
- **影响边界**：数据库、Redis、Celery 地址由脚本导出，两把密钥经 `check_required_env` 与 `--startup` 核对，回落改不了这些目标；可能回落的是未导出的次要键，如 `REDIS_PASSWORD`、`REDIS_SENTINEL_*`、`GITHUB_SYNC_TOKEN`、`AUTH_TRUSTED_PROXY_CIDRS`。
- **修复方案**：
  - **方案 A（推荐）**：`model_config` 的 `env_file` 改为读环境变量 `WANGSH_ENV_FILE`，未设置时保持现值；`start-dev.sh` 本地进程模式导出 `WANGSH_ENV_FILE=<仓库>/.env.dev`，回落目标从生产 `.env` 变成开发文件本身。对生产与容器零影响。
  - 方案 B：本地模式导出 `WANGSH_ENV_FILE=`（空），完全关闭 dotenv 回落。更严格，但 `.env.dev` 未导出的键会直接取代码默认值。
  - 执行前先盘点宿主侧直接加载 Settings 的入口：`backend/alembic/env.py:23` 会加载 settings，宿主上跑 alembic 的场景要一并确认（是否也应读 `.env.dev`）。
- **文件**：`backend/app/core/config/__init__.py`、`start-dev.sh`、`scripts/start-dev-processes.test.mjs`（或 `scripts/env-consistency.test.mjs`）。
- **测试与验收**：后端单测：设置 `WANGSH_ENV_FILE` 指向临时文件时只读该文件；未设置时行为不变。脚本合同测试断言本地进程模式导出该变量。本地进程模式实际启动一次，启动日志或调试端点确认读取的是 `.env.dev`（不打印任何值）。
- **风险与回退**：改配置加载属于行为变更，回滚两文件。
- **依赖**：无。
- **需要老大决策**：否（**按默认执行方案 A**，老大有异议再改）；本条属于配置加载行为变更，执行前在提交说明里写明。

### D-R2（范围外，P3）发布 workflow 的 promote 不拒绝已存在的正式 tag

- **问题**：`.github/workflows/dockerhub-amd64.yml:168-182` 的 `promote version tags after all builds` 直接 `imagetools create` 正式 tag。main 版本号仍是 2.2.8，按默认参数重跑能过全部门禁并覆盖已发布的 2.2.8 六个镜像 tag。部署时 digest 比对会拦住，不会静默上错镜像，但从 registry 回滚到 2.2.8 会失效；也违反"已发布标签不强推重写"。
- **修复方案**：对六个正式 tag 逐个 `docker buildx imagetools inspect`，任一已存在即失败退出（"正式 tag 已存在，需提升版本号"）；registry 没有明确回答 not found（网络或鉴权失败）也失败退出，不当作"不存在"照常覆盖。不提供覆盖开关（需要订正时按规则新增 tag）。实现时把该步骤放在 registry 登录之后、六个构建之前（原方案为 promote 之前）：版本号用错时尽早失败，不白跑构建；发布 workflow 由 concurrency 串行，检查与 promote 之间没有别的发布运行插入。
- **文件**：`.github/workflows/dockerhub-amd64.yml`；`scripts/workflow-contracts.test.mjs`。
- **测试与验收**：`node --test scripts/workflow-contracts.test.mjs`。合同测试从 workflow 中取出该步骤的 bash 原样执行，用假 `docker` 模拟三种 registry 回答：全部不存在 → 退出 0 且依次检查六个 tag；最后一个已存在（promote 半途失败后重跑的情形）→ 退出 1；鉴权失败 → 退出 1 且在第一个 tag 停止；另断言步骤位于登录之后、构建与 promote 之前。2.2.9 发布时实际观察该步骤对六个 tag 输出 `Release tag absent, continuing`。
- **风险与回退**：只增加前置检查；误拦时回滚 workflow 改动。promote 半途失败后重跑同样会被拦，须提升版本号再发。
- **依赖**：在 2.2.9 版本号提升之后、发布 workflow 运行之前合入。
- **需要老大决策**：否。
- **进度（2026-11-05）**：已实现，`0fa64ca`（已推送 origin/main）。独立审查认为 workflow 逻辑正确，但原合同测试只做正则匹配，删掉"无法确认就中止"分支仍能通过（P2）。已改为上述执行式测试，并在临时副本上做 6 种变异（删"无法确认"分支、已存在时不退出、不捕获 stderr、not found 判断取反、漏查一个镜像、guard 挪到构建之后），全部被测试拦下。本机实测 `imagetools inspect` 对不存在的 tag 返回 `ERROR: <ref>: not found`、退出 1，对已发布的 2.2.8 退出 0，与 guard 的判断一致。CICD.md 已补该门禁。针对性复核**通过**（补了 login 步骤存在的断言）。

### D-R3（范围外，P3）`restore-db` 执行前不显示、不核对目标

- **问题**：`scripts/deploy.sh:977` 起的 `restore-db` 只按 Compose 项目名加服务名选容器（`:1019` `compose exec -T postgres psql ...`）。主仓库 dev compose 无 `name:`，启动脚本清掉 `COMPOSE_PROJECT_NAME` 后项目名就是目录名 `wangsh`；在 Mac 上漏设变量时 `--clean` 会写进正在运行的开发库。只影响开发库，概率无法估算。
- **修复方案（选定：只打印目标，不做不一致即拒绝）**：执行恢复前打印目标 postgres 容器名、所属 Compose 项目及其 `com.docker.compose.project.config_files` 标签，然后照常执行。
- **选这个方案的理由**：
  - 不选"不一致即拒绝"：`config_files` 标签不能可靠代表"当前该恢复的目标"。`docs/operations/DEPLOY.md:46` 的现场核验显示，生产 `wangsh` 项目里 postgres/redis 的 compose 标签指向 `2.2.0/source/docker-compose.yml`，其余容器指向 `2.2.8/source/docker-compose.production.json`。按当前 `COMPOSE_FILE` 严格比对，会把合法的生产恢复误拦。
  - 不选"仅记录"：打印几行成本极低、不影响非交互调用，却能让操作者在 `--clean` 写库前看清目标（包括上面这种混用情况）。
  - 主要受影响的是开发库，不值得加更重的保护。
- **文件**：`scripts/deploy.sh`；`scripts/deploy-paths.test.mjs` 或新增合同用例。
- **测试与验收**：`node --test scripts/*.test.mjs` 断言 restore-db 分支在执行 `psql`/`pg_restore` 之前输出目标信息；在开发栈试跑一次，确认输出的容器与 `config_files` 正确。
- **风险与回退**：只加输出。
- **依赖**：需随发布源同步到服务器才在生产生效。若 D3 选方案 B，与 `stop_prod_compose` 复用同一段"列出目标容器与 config_files"的写法。
- **需要老大决策**：否。

### CI-CADDY-01（范围外，P3）Caddy 真实配置校验从未进 CI

- **问题**：`ci-quality.yml:59` 对 `gateway/tests/test_caddy_config.sh` 只跑 `bash -n` 语法检查；脚本里真正的 `caddy adapt --validate`（`test_caddy_config.sh:72-73`）CI 从不执行。预算合同由 `test_caddy_contract.py`（`ci-quality.yml:47`）校验真实 Caddyfile，不受影响。不是回归。
- **修复方案**：在 `ci-quality.yml` 现有 `ubuntu-latest` job 中增加一步执行 `bash gateway/tests/test_caddy_config.sh`。
  - **runner 依赖**：
    - 脚本 `:6` 用 `docker run` 跑 `${CADDY_IMAGE:-caddy:2.8.4}` 做 `caddy adapt --validate`。GitHub 托管的 `ubuntu-latest` 自带 Docker，无需另装 caddy。版本要与网关镜像一致：`gateway/Dockerfile:1` 默认 `caddy:2.8.4`，发布 workflow `dockerhub-amd64.yml:150` 也是 `caddy:2.8.4`；CI 步骤显式传 `CADDY_IMAGE=docker.io/library/caddy:2.8.4`，避免脚本默认值与发布版本漂移。
    - 脚本 `:60` 用 `rg` 做 SSE 路径比对，`ubuntu-latest` 不保证预装 ripgrep。在该步骤前加 `command -v rg || { sudo apt-get update && sudo apt-get install -y ripgrep; }`，并打印 `rg --version` 与 `docker version --format '{{.Server.Version}}'` 留证。
  - **按路径触发**：
    - 不改整个 workflow 的 `paths-ignore`（会连带跳过其他门禁）。
    - 在该 job 已有 `fetch-depth: 0` 的前提下（`ci-quality.yml:22`），步骤内用 `git diff --name-only "$BASE"...HEAD -- gateway/` 判断是否有网关改动。没有改动时打印"无网关改动，跳过"并成功退出。
    - `BASE` 在 PR 事件取 `github.event.pull_request.base.sha`，push 事件取 `github.event.before`。
    - **`BASE` 为空或全零时照常执行校验**，不跳过。发布 workflow 以 `workflow_call` 调用本 workflow（`dockerhub-amd64.yml:40-42`）时取不到 `BASE`；新分支首次 push 时 `before` 为全零。若不处理，diff 为空会被当成"无改动"跳过，发布门禁恰好不校验 Caddy。
    - 不引入第三方 paths-filter action。
- **文件**：`.github/workflows/ci-quality.yml`；`scripts/workflow-contracts.test.mjs` 补断言（该步骤存在、调用脚本、含路径判断，且 `BASE` 为空/全零分支执行校验）。
- **测试与验收**：在一个只改 `gateway/Caddyfile` 的 PR 上确认该步骤实际运行并通过；故意写错一行确认失败（验证后还原）；在不改网关的 PR 上确认打印"跳过"；2.2.9 发布 workflow 的 quality-gate 中确认该步骤**实际执行**了校验。
- **风险与回退**：CI 多一次镜像拉取；回滚 workflow。
- **依赖**：无。
- **需要老大决策**：否。

## 版本切分与执行顺序

- **2026-11-05 老大拍板改为热修切分**：2.2.9 = 当前 main 已有内容（阶段 1 已修条目 + main 上 2.2.8 之后的既有修复），尽快发布；PYLAB-NET-01（方案 C）进 2.2.10，2.2.9 部署后再在 main 上开发；阶段 2–3 视进度进 2.2.10 或之后。下面一句是原默认切分，保留作依据。
- 原默认：**2.2.9 = 阶段 1–3 全部**，以及 main 上已合入、尚未发布的修复（D6 计分、D14 sandbox provider、UI-03 前端失败态、D13 烟测、`deploy.sh` 发布服务白名单等，见 `git log 2.2.8..main`）。单个版本，改动都小且分布在不同文件。**这是默认切分**，老大有异议（例如拆成 2.2.9 只含阶段 1、2.2.10 含阶段 2–3）再改。
- **发版只能从当前 main 出**：发布 workflow 的 `source-guard`（`.github/workflows/dockerhub-amd64.yml:28-38`）要求 `GITHUB_REF` 为 `refs/heads/main` 且 HEAD 等于 `origin/main`，以 2.2.8 发布源单独出补丁走不通。
- **D3 是任何从 main 发版的前置条件**：main 已含 `name: wangsh`（`a129e14`），不处理就发版，服务器发布目录里的 `stop-dev.sh --all`/裸 `compose down` 可能作用于生产。热修也不例外。
- **SSRF-FLOW-01 热修的连锁影响**：热修只能是"尽快从 main 发 2.2.9"，会同时带上 main 上 2.2.8 之后的全部改动，包括：
  - **D6 计分修正**：改变学生成绩（固定题逐题计分，同一知识点多道固定题不再折叠），上线时间点需要老大接受，最好告知教师；
  - **D3 `name: wangsh`**：必须先按决策处理；
  - D13 烟测 failures 行为、D14 移除 k8s provider、UI-03 前端失败态、`deploy.sh` 发布服务白名单；
  - PYLAB-02（若已合入）。
  - 因此"热修"与"阶段 1 优先发 2.2.9"实质相同，差别只在是否等阶段 2–3。最小热修内容建议：SSRF-FLOW-01 + D3 + **D-R2**（发布 workflow 运行前必须合入：main 版本号仍是 2.2.8，不先修就有覆盖已发布 2.2.8 镜像的风险）+ 已在 main 的改动，其余阶段 1 条目能同批验收就一起带上。
- **阶段 4**：D-R2、CI-CADDY-01 可随时并入 main；D-R1 随 2.2.9 镜像；D-R3 随发布源同步。D-R2 与 CI-CADDY-01 必须先于 2.2.9 的发布 workflow 合入（后者保证发布门禁实际校验 Caddy）。
- 建议提交切分（每个提交可独立审查，代码与测试同提交）：
  1. SSRF-FLOW-01（flow 测试连接出站防护）
  2. D3（按老大选定方案）
  3. A-1 + A-2 + FE-TEST-01（智能体出站与测试连接）
  4. C-R1 + C-R2 + AI_AGENTS 订正（对比页）
  5. B-1（PythonLab 终端就绪）
  6. C-1（SSE 默认开关）
  7. A-3、A-4、A-R1、C-2（测试与校验，可各自成提交）
  8. 阶段 4 各条各自成提交
  9. PYLAB-NET-01（按老大选定方案，可在 2.2.9 之后）
- **执行组织**：每个提交按全局规则"一名执行者 + 一名只读审查者"；同文件的条目由同一执行者串行（C-R1/C-R2 同在对比页）。主 Agent 负责整合、跑门禁与浏览器验收。
- **2.2.9 发版前检查**：
  - D3 已落地；
  - SEC-TPL-01 已核对（A-4 进版本的前提）；
  - 后端 `pytest` 相关目录、前端 `type-check`/`test`/`lint`/`build`、文档门禁三项全部通过；
  - 合成栈 prod-smoke（`deploy.sh simulate` 目前仍需手工 `REDIS_HOST=wangsh_sim-redis-1` 覆盖，见台账 OPS-06）；
  - PythonLab 双用户同时调试（PYLAB-02）；
  - 合成供应商桩下智能体测试连接返回成功（A-1）；
  - flow 测试连接对内网/回环/元数据地址返回拒绝，选 B 时学生、教师角色 403（SSRF-FLOW-01）；
  - quality-gate 中 Caddy 校验实际执行（CI-CADDY-01，若已合入）；
  - Chrome channel 与 WebKit 调试真实点击（B-1）。
- **2.2.10 发版前检查与部署步骤（2026-11-06 准备，待授权执行）**：
  - 内容：PYLAB-NET-01（`a8fcb44`）、PYLAB-03（`900a8ab`）与版本号提交；`50f8c9f..` 只改 5 个后端运行文件（`ws/handlers.py`、`ws/validation.py`、`sandbox/docker.py`、`sandbox/docker_runtime.py`、`tasks/pythonlab.py`），无 Alembic 迁移、无前端/网关/依赖改动。阶段 2–3 不进 2.2.10。
  - 构建：版本号提交推送 main、ci-quality 全绿后，dispatch `dockerhub-amd64`（`image_tag=2.2.10`、`push_latest=false`）；版本号提交即构建源，tag 打在它上面，后续文档收尾提交不作构建源。D-R2 守卫拒绝覆盖已发布 tag，构建失败或需改动只能出 2.2.11。
  - 传输：沿用 2.2.9 的 OCI 归档（`skopeo copy --all --preserve-digests`、本地核对根 digest、scp、服务器 `import_exact_oci.py` 逐 blob 校验）。
  - 部署工具：从 `2.2.9/tools` 复制改为 2.2.10（ROOT、提交号、版本串、current 期望值 `2.2.9/source`、候选配置读 `2.2.9/production.env`）。本版本另需：合成栈双人调试的断言由"宿主端口只绑 127.0.0.1"改为"debug 容器 `NetworkMode=none`、无端口绑定"；源码身份核对加入上述 5 个后端文件；部署后检查加入 debug 容器网络核对。改写后由只读子 Agent 独立审查再执行。
  - 合成栈（服务器 `wangsh_sim`，纯正式镜像）：Chrome channel / WebKit 各 4/4、两名合成学生同时调试 soak 各 6/6、debug 容器内 `python3 -I` 对 TEST-NET-1 地址出站失败。
  - 停流前只读列出沙箱容器及其 `NetworkMode`（不删除）。按代码推断：2.2.9 留下、接在 bridge 上的调试容器不会被 2.2.10 复用（"运行环境网络不兼容"）；停流期间心跳中断，会话超时后由 pythonlab-worker 内置 beat 的 `cleanup_stale_sessions`（每 120 秒）与 `cleanup_orphans`（每 300 秒）回收。开网关后约 10 分钟复查，仍有非 `none` 的沙箱容器先报老大再处理，不按名称删除。
  - 切换：同 2.2.9（停流配对快照、隔离恢复、按服务切换、PG/Redis 不重建）；backend 与 pythonlab-worker 必须同版本。
  - 部署后：六镜像等于 release-set、详细健康、未登录 flow 测试连接 401、日志无错误、debug 标签容器 `NetworkMode=none`、外部入口。
  - 回滚：服务器保留的 2.2.9 镜像与回滚 compose，只涉及六个应用服务。2.2.10 建的调试会话以 4410 关闭；2.2.10 建的调试容器没有宿主端口，2.2.9 复用时报"已有调试环境端口不可用"，等清理任务回收。无迁移，不涉及数据库回退。
  - tag：部署验收后按授权给构建源打 `2.2.10`，message 写构建提交、workflow run id、release-set SHA256。2.2.9 tag 仍待授权（构建源 `50f8c9f`）。
- 发布、打 tag、推送、部署分别按老大的明确指令执行；本计划不构成发布授权。

## 需要老大决策的事项

**2026-11-05 老大按下表「推荐」列全部拍板**，默认执行项同样采纳。新增待决项见「当前状态」。

| # | 事项 | 选项与影响 | 推荐 |
|---|---|---|---|
| 1 | **SSRF-FLOW-01：是否热修** | **热修**＝尽快从 main 发 2.2.9（发布 workflow 只允许当前 main），连带上线 main 上 2.2.8 之后的全部改动，含 **D6 计分修正（改变学生成绩）**、D13/D14、UI-03、PYLAB-02，且必须先处理 D3、先合入 D-R2。**不热修**＝等阶段 1–3 全部完成再发 2.2.9，生产 SSRF 继续暴露更久。 | 热修（先接受 D6 上线时间点，处理 D3，合入 D-R2） |
| 2 | SSRF-FLOW-01：修复方案 | A+B（出站硬校验 + 仅管理员可调；前端唯一入口本就在管理员页，学生不失去功能） / 仅 A（学生入口须用不带 Ollama 与可信内网例外的校验） / C（不再接受请求体地址，前后端都改） | A+B |
| 3 | ENV-DEV-01：是否授权改本地 `.env.dev` 的沙箱镜像为 2.2.8 并重建开发栈 backend/worker | 授权 / 不授权（开发栈调试继续不可用，PYLAB-02、B-1、PYLAB-NET-01 无法做开发栈端到端） | 授权 |
| 4 | D3：仓库 compose 的 `name: wangsh` 怎么处理（任何发版的前置条件） | A 回退 / B 保留并给 `stop_prod_compose` 加目标确认与发布目录检测 | A |
| 5 | D3 前提：是否授权只读核对生产 `.env` 是否设置 `COMPOSE_PROJECT_NAME`（只看这一个键） | 授权 / 不授权 | 授权 |
| 6 | SEC-TPL-01：是否授权在服务器只读比对四个密钥与模板历史值（只输出"命中/未命中"及加密密钥格式结论）；命中时是否轮换 | 授权比对，命中后再定轮换 / 不授权（则 A-4 不进 2.2.9） | 授权比对 |
| 7 | C-R1：对比图起点口径 | A 各记录首个有提问的时段（须同步改写 AI_AGENTS.md 口径，后端分桶以 `start_at` 为基准）/ B 分析时段 `start_at`（与现有文档一致，可能需改后端） | A |
| 8 | PYLAB-NET-01：调试容器网络隔离方案与排期 | A debug 用 `--internal` 独立网络（需服务器网络对象，端口契约改动与 C 相同）/ B 每会话独立 internal 网络 / C debug 也 `--network none`（已实测 DAP 经 `docker exec` 可用，只改后端）；进 2.2.9（需全部调试验收通过）或之后单独发版 | C；验收通过则进 2.2.9，否则之后单独发版 |

**按默认执行、老大有异议再改**：D-R1 选方案 A（本地进程模式指向 `.env.dev`）；版本切分为阶段 1–3 合为 2.2.9；C-1 选方案 A（hook 内取 `useAuth`）；D-R3 只打印目标。

## 需登记台账的条目

由主 Agent 登记到[台账](project-consolidation.md)，本计划为详细方案入口。PYLAB-02 已登记，不重复。

| 编号 | 一句话 |
|---|---|
| SSRF-FLOW-01 | P1：`/api/v2/pythonlab/flow/test_agent_connection` 任何登录用户可让服务器请求任意地址并读回响应体，生产 2.2.8 受影响 |
| PYLAB-NET-01 | P2：调试容器在默认 bridge 且可出站，学生代码联网限制只靠工作区内可改写、只替换 `connect`/`create_connection` 的 sitecustomize |
| A-1 | P2：智能体"测试连接"校验拼接前的相对路径，2.2.5 起恒失败 |
| A-2 | P2：智能体出站跟随重定向，绕过 SSRF 硬校验（含 Dify 流式与阻塞路径） |
| FE-TEST-01 | 前端把测试连接失败显示成"成功"（判定外层信封而非 `data.success`） |
| C-R1 | P2：多课时对比图用全局最早时间做原点，跨天对比不可读 |
| D3 | 发版前风险：仓库 compose `name: wangsh` 可能让服务器发布目录里的 `stop-dev.sh --all`/裸 `compose down` 作用于生产 |
| SEC-TPL-01 | 生产 `.env` 四个密钥是否沿用过 `.env.example` 历史模板值，待只读核对 |
| ENV-DEV-01 | 开发栈运行中的 worker 沙箱镜像 `2.2.4` 在 Docker Hub 不存在（`.env.dev` 已是 2.2.6 但未重建），开发栈调试起不来 |
| OPS-07 | 服务器旧目录 `/home/shuhao/wangsh` 误跑 `stop-dev.sh --all` 会作用于生产项目（与 D3 无关、早于区间） |
| C-R2 | P3：对比页三处显示名缺记录编号、Bloom 无桶汇总兜底，AI_AGENTS:367 表述过宽 |
| B-1 | P3：终端附着被拒后启动状态卡 10 秒才报通用文案 |
| C-1 | P3：教师打开三个管理页时 SSE 每 60 秒 403 |
| A-3 | P3：缓存修复的回归测试未真正调用 `get_agent` |
| A-4 | P3：`AGENT_API_KEY_ENCRYPTION_KEY` 只校验非空不校验 Fernet 格式 |
| A-R1 | P3：隐私导出失败未先 rollback，FAILED 审计丢失 |
| C-2 | P3：隐私面板缺撤回与保存失败测试 |
| D-1 | P3 仅记录：游戏上传在鉴权前放宽到 502MiB，带宽×30s 约束下不改 |
| D-R1 | 条件 P2：本地进程模式逐键回落读取生产 `.env`，违反规则 7.0 |
| D-R2 | P3：发布 workflow promote 不拒绝已存在的正式 tag |
| D-R3 | P3：`restore-db` 执行前不显示目标容器 |
| CI-CADDY-01 | P3：Caddy `adapt --validate` 从未进 CI |

## 本计划不覆盖

- 被复查驳回或撤回的结论：学生沙箱伪造归属日志、陈旧回包串给其他用户、`docker exec` 参数注入、评分失败日志泄露、登录歧义、DNS 未钉扎、`migrate-db` 无备份、`check_agent_endpoints.py` 输出完整端点、workspace 属主、lockfile registry 混用。
- 低置信待验证疑点（需 Linux 真实后端复现后再定）：Docker 分支 DAP 首包前断开重连只试一次；大段粘贴时 `handlers.py:199` 的 `os.write` 短写丢字节；评分重试也重试 `ConnectError`（只多一次快速失败，在总预算内）。
- `_prepare_workspace_files` 向学生可写目录写文件的防御审查（不在本区间，建议另做一次专项审查）。
- 台账已有未结项（SEC-03、PRIV-02/04、PERF-01、UI-01/02、XBK-01、PYLAB-01、PROGRAM-01、DIANMING-01、DIFY-01、SOCKET-01、OPS-01、OPS-06、ACCEPT-02、HOT-01、ARCH-01），以[台账](project-consolidation.md)为准。
- 生产长时间运行观察、真实课堂并发压测与回滚实测。
