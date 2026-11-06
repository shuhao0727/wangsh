# 当前项目待办台账

> 状态：active
> Owner：project-governance
> 最近复核：2026-11-05
> 归档条件：未结事项已关闭，或已转入有明确 owner 和关闭条件的后续台账。

## 当前状态

- 更新：2026-11-06；**2.2.9 已部署生产**（构建源 `50f8c9f`，`current -> /home/shuhao/wangsh-releases/2.2.9/source`，[批次记录](../archive/testing/2026-11-06-release-229.md)）；外部入口 `wangsh.cn:6608` 经老大手机流量访问确认可用（网关同时段 47 个外部请求）；2.2.9 git tag 待授权。2.2.10：PYLAB-NET-01 已推送 origin/main（`a8fcb44`，CI 通过），PYLAB-03 已提交（`900a8ab`）；均未发布，见下表。
- 现行计划：2026-11-04 四方对齐记录已完成处置，转入归档（见[计划索引](README.md)）；**2026-11-05 新增 active 专项计划**：[2.2.2→2.2.8 审查问题修复计划](2026-11-05-release-228-review-fixes.md)（2026-11-05 老大已按推荐拍板，执行中；已修条目已推送 origin/main，见计划当前状态）。未结事项仍以本台账为准。
- 安全：服务器后门事件六项持久化已清除；**用户 2026-11-05 明确接受遗留风险**（不轮换密码、SSH 密码认证保持开启、不做主机重装），SEC-03 记录该决定；应用数据保密性未验证。
- 边界：不绕过门禁、不覆盖已发 tag/镜像、不改业务数据或默认挂载、不清理回滚资源。
- 2.2.8 部署证据：[批次记录](../archive/testing/2026-11-04-release-228.md)；服务器 `/home/shuhao/wangsh-releases/2.2.8/{backups,evidence}`。未做长时间运行观察、真实课堂并发与回滚实测。
- PRIV 导出仍为内存组装；文档旧述的游标/临时文件/流式发送未实现，已在 GDPR owner 文档标明。

本页是项目未结事项的唯一台账。当前测试结果见[测试状态](../testing/TEST_STATUS.md)，
历史批次过程见[归档](../archive/README.md)。已闭环的条目不再保留在下方表格，
其依据随批次记录一并归档。

## 未结事项

| 编号 | 事项 | Owner | 关闭条件 |
|---|---|---|---|
| SEC-03 | **后门事件遗留风险（用户已接受，留待审计追溯）**：入侵入口未定；SSH `passwordauthentication yes` 仍开启（爆破尝试多）；root/shuhao 密码与 Dify 历史凭据**不轮换**；未做全盘完整性校验；未做主机重装；应用数据保密性未验证 | ops + 安全责任人 | **2026-11-05 用户明确风险接受**：不轮换、保持密码认证、不重装。本项保留为记录，不因接受视为风险消除；若后续决定处置，另立行动项 |
| DOC-01 | 历史审计编号（C 系列等）仅为历史记录，不作为当前验收依据 | project-governance | **2026-11-05 用户确认退役**。**订正**：C 系列 14 个编号的定义**并非不可恢复**——59 个候选的编号/位置/机制/验证状态已提炼保存至[归档候选定义](../archive/reviews/2026-11-02-c-series-candidates.md)；多数已由 `fed2b8a` 等后续提交修复，引用前须按当前代码重新核实。退役不声称相关功能已验收 |
| PRIV-02 | 同意写入/撤回 API 与 `/privacy` 自助页已实现并记录审计；同意版本文本字段、AI 调用前强制校验和告知政策未完成 | backend + frontend | 工程侧"AI 调用前同意校验"属行为变更（未同意即阻断），需产品确认后再实施；版本文本随 PRIV-04 |
| PRIV-04 | 运营地区、责任人、渠道与保留期限未核 | ops + 运营责任人 | **2026-11-05 用户说明：运营方不存在隐私政策文本**。台账如实记录现状；如未来需要合规文本，由运营方另行提供，不在仓库虚构 |
| PERF-01 | 索引与性能候选需按当前实现重新评估 | backend + ops | 暂缓：当前无实测性能症状；出现真实性能问题或获授权测试环境后再评估，不预设候选清单 |
| UI-01 | UI 路线图仍有待用户确认的页面族 | frontend | 按[UI 路线图](../ui/UI_REDESIGN_ROADMAP.md)推进时逐页确认；无 UI 排期时不单独清点 |
| ARCH-01 | 大页面、重复业务、重型模块静默降级（ECharts 注册加固已完成，见 `frontend/src/lib/echarts.ts:19-42`） | 各模块 owner | 按实际触发的问题小范围处理；不按行数拆分，不做形式清单 |
| ACCEPT-02 | 窄屏响应式抽查与真实课堂并发未覆盖 | testing + 功能 owner | 窄屏按 UI 路线图断点（`UI_REDESIGN_ROADMAP.md:16`）逐页记录；并发场景与观测指标待真实课堂或压测环境（普通 admin、WebKit、前端产物来源已由 2.2.8 验收覆盖） |
| HOT-01 | 热点归类的 mock 只验证机制，真实课堂语义未验 | 教学使用方 + ai-agents | 填写教师提问标记，用获准真实记录抽查标签；不沿用旧课堂数量作当前事实 |
| DIFY-01 | `conversation_id` 阶段二涉及新表、迁移及隐私/归档联动，待取舍 | ai-agents + 数据 owner | 先确认是否实施；若实施再验会话隔离、迁移和上下文。阶段一为有界历史重放 |
| OPS-01（服务器清理） | 服务器临时脚本、样本与备份清理未见收尾证据（区别于 `PYTHONLAB.md` 的 OPS-01（debug 网络/DAP）） | release-ops | 核实待清理对象（脚本/样本/备份路径）与当前用途后，另按授权清理 |
| UI-02 | 入口与开关关系待定：首页无 ai-partner 游戏入口（AI 智能体入口存在）；feature flag 全关时 `/it-technology` 无应用入口 | frontend | **2026-11-05 默认：维持现状用名与入口**；开关关系与"AI 伙伴/AI 智能体"用名如需变更另行提出。前端失败态缺陷另见 UI-03 |
| UI-03 | 公开启动器把 flag 请求失败伪装为"管理员未开启"，错误/重试分支不可达；点名班级选择器把加载失败与教师 403 显示为空态 | frontend | 失败→错误态+重试；教师 403→"无权限"；保留 fail-closed |
| UI-04 | P3 【2.2.8 审查验收中发现，早于区间】`/admin/it-technology` 对 admin 开放（`IT_TECHNOLOGY_MANAGEMENT_ROLES = ADMIN_ROLES`），但 PythonLab 智能体配置弹窗打开时读 `GET /system/feature-flags`，该接口要求超级管理员（`feature_flags.py:58-61`），普通管理员得到 403、弹窗字段为空；保存同样需要超级管理员。2026-11-05 开发栈合成管理员实测 | frontend + 权限 | 老大决定：入口只对超级管理员显示，或放开该 flag 的读取；未决前维持现状 |
| XBK-01 | 名册页无勾选/批量调班动作；Excel 导入 upsert 可更新班级并经容量重验 | xbk + 产品 | **2026-11-05 默认：不新增交互式批量调班**，Excel 导入为官方批量路径；出现真实需求另行提出 |
| PYLAB-01 | 普通 Pyodide 运行路径无执行期限（手动停止/重置可用） | pythonlab + 产品 | **2026-11-05 默认：不设执行上限，保留现有手动停止**；验证停止控件后按此写关闭条件。如需期限另行提出 |
| PYLAB-02 | **多名学生无法同时调试**：调试容器固定发布宿主 `127.0.0.1:5678:5678`（`docker.py` debug 分支的 `-p`，`cd868f8` 引入，早于 2.2.2，生产 2.2.8 受影响），同机第二个调试容器 `docker run` 报 `port is already allocated`，学生看到"运行环境启动失败，请联系老师检查配置"。2026-11-05 provider 层真实 Docker 复现：u990001 成功、u990002 失败。**本地已修（`98f1c46`，已推送 origin/main）**：`-p 127.0.0.1::5678` + debugpy `--listen 127.0.0.1`（后者防修复后同 bridge 调试容器互连）；pytest 472/60 skipped；provider 层双用户同时启动、各自 DAP initialize 成功、仅回环监听 | pythonlab | 2026-11-05 开发栈两名合成学生同时调试 soak 各 6/6、三项 PythonLab smoke 通过。2026-11-06 随 2.2.9 部署（服务器合成栈双人调试 6/6 通过）；**在生产验证两名学生同时调试**后关闭；debug 容器网络隔离见下方 PYLAB-NET-01 |
| PROGRAM-01 | 个人程序页实为 XBK 应用入口 | frontend + 产品 | **2026-11-05 默认：维持双入口现状**，删除未定义的"统一"目标，按现状验收；如需合页或学生代码库另行提出 |
| DIANMING-01 | 随机点名无持久历史；教师调用名单接口固定 403（`DIANMING.md` 已记载教师—班级授权尚未建立） | it + 产品 | **2026-11-05 默认：记录=本次抽取结果，不持久化**；教师点名维持管理员专用并在台账注明。如需持久历史或教师授权另行提出 |
| WORKER-01 | ~~`user: "0:0"` 把 worker 提成 root~~ 已于 `09fb1db`（2026-11-03）移除，worker 改 appuser + `group_add`；`09fb1db` 已进入 2.2.6–2.2.8 构建源。**生产时间线**：2.2.2 部署期间 worker 为 root（`git show 2.2.2:docker-compose.yml` 第 314 行为 `user: "0:0"`），2.2.5/2.2.6/2.2.7 从未部署生产，2.2.8 切换后才以 appuser 运行。**2026-11-05 现场核验**：生产 `wangsh-pythonlab-worker` 实际 `User=1000:1000 GroupAdd=[0 984]`，与仓库定义一致 | ops + backend | **uid 提权部分已关闭**（2026-11-05）。残余 docker.sock 架构风险转入 SOCKET-01 |
| SOCKET-01 | backend 与 PythonLab worker 均挂载 `/var/run/docker.sock`（`docker-compose.yml:219/:328`，dev `:134/:252`）；socket 等于宿主 root 等价能力，是非 root 化后仍存在的架构风险 | ops + backend | 按[工程治理](../development/ENGINEERING_GOVERNANCE.md) 周期性审计表（每半年 Docker socket 复查）评估；若引入 socket 代理等缓解方案，先核实宿主兼容与授权 |
| OPS-06 | `deploy.sh simulate` 的 `run_sim_deploy`/`run_sim_compose` 未传 `REDIS_HOST`：模拟项目 redis 容器名为 `wangsh_sim-redis-1`，compose 默认 `wangsh-redis-1` 连不上，后端 unhealthy；2026-11-05 实测复现，以环境变量覆盖绕过 | release-ops | 在 sim 函数中传入 `REDIS_HOST="${sim_project}-redis-1"`（或在 DEPLOY.md 标注必须手工覆盖），并复跑 `simulate` 验证 |
| SSRF-FLOW-01 | **P1** 【2.2.8 审查】`/api/v2/pythonlab/flow/test_agent_connection` 只要求登录（`require_user`），请求体 `api_url` 不做出站校验、跟随重定向并回显上游响应体前 600 字；任何登录用户（含学生）可让服务器请求局域网/本机服务并读回。早于 2.2.2，生产 2.2.8 受影响 | backend + 安全 | **2026-11-05 老大选热修 + A+B；`d6375a3`，独立审查通过，已推送 origin/main**。开发栈 API 与浏览器验收通过。2026-11-05 生产只读核对：生效 flag 地址校验通过、不重定向。**2026-11-06 随 2.2.9 部署**，生产未登录调用返回 401 |
| PYLAB-NET-01 | P2 【2.2.8 审查】debug 容器在默认 bridge 且可出站，学生代码联网限制只靠工作区内可改写的 `sitecustomize`（PythonLab 文档 OPS-01） | pythonlab | 方案 C（`--network none`）已定，**2026-11-05 改为进 2.2.10**。**2026-11-06 已修（`a8fcb44`，已推送 origin/main，推送后 CI 通过，未发布）**：debug 也 `--network none`、不发布宿主端口，DAP 端口门槛只对旧 TCP 会话保留；开发栈验收与独立审查通过（见[修复计划](2026-11-05-release-228-review-fixes.md)）。随 2.2.10 部署并在生产核对 debug 容器 `NetworkMode=none` 后关闭。仅记录：debug 仍 `--cap-add NET_BIND_SERVICE`，5678 大于 1024 用不到，下次改调试启动参数时一并去掉并做双浏览器回归 |
| PYLAB-03 | P2 【2.2.10 审查发现，早于区间，`d972f5d` 引入】启动恢复路径 `_recovery_expected_config`（`backend/app/tasks/pythonlab.py:261`）调用异步 `_resolve_host_mount_path` 未 `await`，期望挂载是协程对象而非路径，复用检查必报"运行环境工作区不兼容"。2026-11-06 最小复现确认（期望值为 `<coroutine …>`，并有 never awaited 警告）。影响：worker 在 STARTING 中途丢失、任务重投时，恢复必定失败，会话进 FAILED（该错误不在可重试集合内），学生需重新启动；失败是关闭方向，不涉及越权。容器回收时机未核。`_recover_interrupted_start` 当前没有测试覆盖 | pythonlab | **2026-11-06 老大决定进 2.2.10，已修（`900a8ab`），未发布**（验证见[修复计划](2026-11-05-release-228-review-fixes.md)）。根因：`d972f5d`（2026-09-12 治理复杂度拆分）把原本带 `await` 的内联表达式抽成同步 helper 时丢了 `await`；真实 prefork SIGKILL/Redis 恢复证据是 2026-09-11（`abb8bec`）记录的，早于该提交一天，之后没有重测。同类排查：静态扫描 `backend/app` 内私有协程未 await 的调用，只有此处（其余 9 处交给调度包装，不是缺陷；公开同名方法未覆盖）。关闭条件：改为 `await`，补一条走真实 Celery 任务与 `_recover_interrupted_start` 的恢复测试（修复前必须失败），开发栈真实 Docker 恢复一次，随 2.2.10 发布 |
| A-1 | P2 【2.2.8 审查】智能体"测试连接"校验拼接前的相对路径，2.2.5 起恒失败（`aeae945`） | ai-agents | **2026-11-05 `2d239cf`（已推送 origin/main），独立审查通过**；开发栈合成供应商桩下测试连接返回成功（API 与浏览器），**2026-11-06 已随 2.2.9 部署**，可关闭 |
| A-2 | P2 【2.2.8 审查】智能体出站客户端跟随重定向，绕过 SSRF 硬校验（含 Dify 流式与阻塞路径）；须与 A-1 同批 | ai-agents + 安全 | **2026-11-05 `2d239cf`（已推送 origin/main），六条路径不跟随重定向的断言通过（含 Dify 双候选地址），独立审查通过** |
| SSRF-ANA-01 | P3 【2.2.8 审查 A 组发现，早于区间】管理员分析功能（热点问题、学生思维链、任务分析）经 `llm_agent_base.call_llm` 出站，不调用 `assert_agent_outbound_endpoint`，只受保存时软校验约束；与对话、测试连接的硬校验口径不一致。入口均为 `require_admin`，httpx 默认不跟随重定向，非 200 只记日志不回显 | ai-agents + 安全 | 老大决定是否在 `call_llm` 出站前补同一硬校验（成本小，会让指向未列白名单内网地址的分析智能体开始失败）；AI_AGENTS 已订正口径 |
| FE-TEST-01 | 【2.2.8 审查】前端把智能体测试连接失败显示为"成功"（判定外层信封而非 `data.success`），早于区间 | frontend | **2026-11-05 `2d239cf`（已推送 origin/main），单测通过，独立审查通过**；开发栈真实浏览器验证通过（列表页与编辑弹窗），**2026-11-06 已随 2.2.9 部署**，可关闭 |
| C-R1 | P2 【2.2.8 审查】多课时对比图用全局最早时间做原点，跨天对比曲线挤到两端（`b9cbd53`） | frontend + ai-agents | 按老大选定口径修复，文档同步 |
| D3 | 【2.2.8 审查】发版前风险：`a129e14` 给仓库 compose 加 `name: wangsh`，服务器发布目录里的 `stop-dev.sh --all`/裸 `compose down` 可能作用于生产；任何从 main 发版的前置条件。**2026-11-05 老大拍板回退，`199c5e9`（已推送 origin/main）**。同日生产只读核对：发布目录无 `.env`、项目名由 `-p wangsh` 显式传入；2.2.8 compose 有 4 处 `:?` 必填守卫，发布目录里缺变量时 compose 先报错退出，D3 的实际增量风险小于原推断 | release-ops | 回退随 2.2.9 发布后关闭；旧目录残余风险见 OPS-07 |
| OPS-07 | 【2.2.8 审查】服务器旧目录 `/home/shuhao/wangsh` 目录名即 `wangsh`、有 `.env`、有 `stop-dev.sh`：在该目录误跑 `stop-dev.sh --all` 会以项目名 `wangsh`（生产项目）执行开发与生产两套 compose 的 `down --remove-orphans`，与 D3 无关、早于区间。2026-11-05 只读核对：该 `.env` 未设 `COMPOSE_PROJECT_NAME`；`--all` 的停止逻辑不做目标确认 | release-ops | 老大决定：给 `stop-dev.sh --all` 加目标确认（拒绝作用于运行中生产项目），或在服务器旧目录移除/改名该脚本；未决前在 DEPLOY 标注"服务器上禁跑 stop-dev.sh" |
| SEC-TPL-01 | 【2.2.8 审查】生产密钥是否沿用 `.env.example` 历史模板值。**2026-11-05 只读核对（读生产 backend 容器实际环境，与 Git 历史全部模板值比对，未输出任何值）**：`SECRET_KEY`、`POSTGRES_PASSWORD`、`AGENT_API_KEY_ENCRYPTION_KEY` 未命中，加密密钥为合法 Fernet；**`SUPER_ADMIN_PASSWORD` 命中模板值，仓库为 PUBLIC**。`init_super_admin` 只在账号不存在时创建、不改写既有密码，实际登录密码取决于数据库哈希，未核验 | ops + 安全 | 老大决定：是否授权只读核验超管哈希是否等于该模板值；命中则经后台审计流程改密，并把服务器环境变量换成非模板值 |
| ENV-DEV-01 | 【2.2.8 审查】开发栈运行中的 worker 沙箱镜像为 `2.2.4`（两天前启动时的值），该 tag 在 Docker Hub 不存在，开发栈调试起不来。**订正**：`.env.dev` 文件此前已改为 `2.2.6`，只是开发栈未重建。2026-11-05 按老大授权改为 `2.2.8`（只改这一行） | 本机开发环境 | **2026-11-05 已完成**：重建后 worker/backend 沙箱镜像 2.2.8、生效连接 `postgres:5432` 与启动前核对一致，调试到断点由 PYLAB-02 开发栈验收覆盖；可移入已关闭 |
| C-R2 | P3 【2.2.8 审查】对比页图例/Bloom 横轴/概览缺记录编号、Bloom 无桶汇总兜底；`AI_AGENTS.md:367` 表述过宽（`a129e14` 订正时写宽） | frontend | 三处补实现或订正文档 |
| B-1 | P3 【2.2.8 审查】终端附着被拒后启动状态卡在 starting 最多 10 秒才报通用文案（`ce78e0d`） | pythonlab | 致命关闭码立即失败并带原因，双浏览器验证 |
| C-1 | P3 【2.2.8 审查】教师打开课堂互动/小组讨论/信息学三页时 SSE 每 60 秒 403（SSE-01 只覆盖学生端） | frontend | hook 内按管理员判定订阅 |
| A-3 | P3 【2.2.8 审查】缓存修复的回归测试未真正调用 `get_agent` | ai-agents | 补真实调用两次 `get_agent` 的测试 |
| A-4 | P3 【2.2.8 审查】`AGENT_API_KEY_ENCRYPTION_KEY` 只校验非空不校验 Fernet 格式 | backend | 启动校验实例化 Fernet；依赖 SEC-TPL-01 核对 |
| A-R1 | P3 【2.2.8 审查】隐私导出失败未先 rollback 就写 FAILED 审计，审计丢失（`8be5c03`） | backend | 补 rollback，测试在去掉 rollback 时必须失败 |
| C-2 | P3 【2.2.8 审查】隐私面板缺撤回与保存失败测试 | frontend | 补两条用例 |
| D-1 | P3 仅记录 【2.2.8 审查】游戏上传在鉴权前放宽到 502MiB；带宽×30s 约束下不改 | gateway + backend | 仅记录，出现实际资源问题再处理 |
| D-R1 | 条件 P2 【2.2.8 审查】本地进程模式逐键回落读取根目录生产 `.env`，违反规则 7.0（全容器开发栈不受影响） | backend + 开发环境 | 本地进程模式不再读根 `.env` |
| D-R2 | P3 【2.2.8 审查】发布 workflow promote 不拒绝已存在的正式 tag；须先于任何发布 workflow 合入 | release-ops | **2026-11-05 `0fa64ca`（已推送 origin/main）**：构建前检查，已存在或无法确认即失败；执行式合同测试 + 6 种变异验证；针对性复核通过 |
| D-R3 | P3 【2.2.8 审查】`restore-db` 执行前不显示目标容器 | release-ops | 执行前打印目标容器与 `config_files` 标签 |
| CI-CADDY-01 | P3 【2.2.8 审查】Caddy `adapt --validate` 从未进 CI，发布门禁也不校验 | ci + gateway | 进 CI 且 `workflow_call` 下照常执行 |

## 2026-11-02 逐项核验分类

分类：A 可工程闭环（无产品决策/真实数据）、B 需产品/用户决策、C 需真实数据/生产/外部、D 需设计实现。D 类已于 2026-11-03 修复并关闭；B/C 未实施。

> 注：本表是 2026-11-02 的历史快照（当时口径 B 类 12 行，含连带退役组），**不代表 2026-11-05 当前缺口**；当前状态以「未结事项」表为准。

| 编号 | 分类 | 当前证据与结论 |
|---|---|---|
| DOC-01 | B | 台账订正已做；其余原编号需逐项证据，不能以工作树删除关闭 |
| ACCEPT-01/03、OPS-02、COMMIT-01 | 退役 | 用户 2026-11-03 确认旧工作树验收/运行/提交材料无继续价值；记录退役，不声称功能已验收 |
| SSE-01 | D——已完成 | 学生端仅 `auth.isAdmin()` 时订阅；hook 增加 enabled，3 项测试通过 |
| RELEASE-01 | C | 2026-11-03 生产 2.2.2 已只读核准；2.2.5 因 CI 失败及 release-set/备份恢复证据未齐阻断，不以镜像存在代替准入 |
| PRIV-02 | B | 同意/撤回 API 与自助闭环需产品与合规确认 |
| PRIV-04 | B | 迁移、运营地区、责任人、渠道与保留期限需运营确认 |
| PERF-01 | C | 索引与性能候选需代表性负载实测 |
| UI-01 | B | 路线图页面族仍需用户逐页确认 |
| ARCH-01 | B | 大页面/重复业务/降级加固需模块级设计 |
| ACCEPT-02 | C | 仅完成 Chrome 登录页基础验收；WebKit/窄屏/admin/并发未覆盖 |
| HOT-01 | C | 需真实课堂记录抽查语义，mock 不足 |
| DIFY-01 | B | 阶段二新表/迁移/隐私联动待产品取舍 |
| OPS-01 | C | 服务器临时脚本、样本与备份需现场核实 |
| UI-02 | B | 首页无 AI 伙伴入口已由代码确认；feature flag 与登录页缓存需产品/复现 |
| XBK-01 | B | 批量调班流程未实现，需产品确认 |
| PYLAB-01 | B | 普通 Pyodide 死循环终止期限需产品确认 |
| PROGRAM-01 | B | 个人程序入口/代码库语义需产品确认 |
| DIANMING-01 | B | 点名记录是否持久化需产品确认 |

A 类本轮无待改代码项；DIFY-02 已核验为非缺陷并关闭；D 类已于 2026-11-03 修复。B/C 类保留原编号、owner 与关闭条件，等待确认或真实数据。

## 已关闭（摘要）

以下事项已在对应批次修复或确认，详细依据见归档批次记录；不再单独占表。

- **LEDGER-01**（2026-11-04 关闭）：本地 `main` 落后与工作区 40 项未提交改动已清查——34 项内容与已发布 2.2.8 逐字节相同，stash→ff-only→pop 后仅提交 8 个文档为 `c795313` 并推送；`merge-base --is-ancestor 2d9dda0 HEAD` 为真。
- **LEDGER-02**（2026-11-04 关闭）：2.2.5 缺发布链路（无 workflow/staging tag/release-set，同提交 `ci-quality` 41592108696 为 failure），已在[发布记录](../operations/RELEASE_NOTES.md#历史发布留痕订正2026-11-04-核验)标注来源不可审计；不补推伪造发布。
- **LEDGER-03**（2026-11-04 关闭）：DockerHub 缺 2.2.2/2.2.3（六仓库 404）、2.2.1 镜像构建源早于 tag，已逐条标注；2.2.2 服务器本地镜像为唯一回滚副本，列入不可删红线。
- **SEC-01**（2026-11-04 关闭）：2026-05-18 植入的六项持久化（后门账号 `systemd`、sudoers、crontab、log.service、XMRig、sshdd.so rootkit）已全部清除并逐一复验，证据 `/root/security-remediation-20261104/`。遗留风险转入 SEC-03 跟踪。
- **SEC-02**（2026-11-04 关闭）：桌面 `.env`（旧版 Dify 配置副本）已归档为 `600 root:root` 并移除桌面副本；凭据轮换按 SEC-03 的用户风险接受处理。
- **OPS-04**（2026-11-04 关闭）：服务器冗余文件清理（`.npm` 248M、`2.2.7/incoming` 412M、`/tmp` 252 个目录、旧 vscode-server 1.5G、`/swapfile_extra` 16G、`btmp.1` 截断），磁盘 69G→51G；`/home/shuhao/dify`（670KB，属 Dify 项目）保留。
- **OPS-05**（2026-11-04 关闭）：三个无容器引用的旧数据库卷已删除（`wangsh_postgres_data` 111M、匿名卷 110M、`wangsh_redis_data` 45M）。**如实记录**：创建于 2026-02-15，最后写入 2026-10-28；已知的 2.2.0 生产部署为 2026-10-26 20:52（`release-226:49` 首次记录生产使用 bind 目录；bind 首次生效精确时点无单独记录）；**未做内容级独立备份**，仅记录文件数/字节数/时间边界/`PG_VERSION`/文件清单 sha256 到 `/root/security-remediation-20261104/deletion-20261104/deletion-metadata.json`；经用户确认删除。"迁移前快照"定性无法证实，不作结论。

- **RELEASE-01**（2026-11-04 关闭）：2.2.8 从 `2d9dda0` 完成发布与部署。六镜像按 digest 到齐、官方 registry 核验 `images=6`、本地 RepoDigest/amd64 一致；纯正式镜像隔离合成栈 Chrome/WebKit 各 4/4；停流配对备份（7 文件逐文件 SHA256）与隔离恢复（54 表/49 序列/2221 Redis 键/3 份业务归档全一致）通过；按服务切换后 `current -> 2.2.8/source`，PG/Redis ID/启动时间/挂载不变；专用合成 admin 部署后双浏览器各 4/4 并按精确 ID 停用软删除。证据见[批次记录](../archive/testing/2026-11-04-release-228.md)。**未覆盖**：长时间运行观察、真实课堂并发、回滚脚本实际触发；不据此宣称长期稳定。

- **DIFY-02**（2026-11-02 核验关闭）：`REACT_APP_DIFY_URL`/`config.difyUrl` 是首页外部 Dify 服务入口，默认 `http://wangsh.cn:6606`；它与前端 `WEB_PORT=6608` 不是同一含义，默认值保留，实际地址由部署配置决定。
- **ASYNC-01**（2026-11-03 修复）：混合列表改为 `union_all` 单 SQL 排序/分页，`total` 使用数据库 COUNT；SQLite 合成测试覆盖 skip 与全量总数。
- **ASYNC-02**（2026-11-03 修复）：`run_analysis_in_fresh_loop` 每任务结束/异常都 `engine.dispose()`，避免跨事件循环复用 asyncpg 连接；成功与异常回归通过。
- **PRIV-01 / PRIV-03**（2026-11-03 核心修复）：增加 `operation_id`、`data_scope` 与 REQUESTED/COMPLETED/FAILED 审计，删除与完成审计同事务，响应改为只承诺两类消息；24 项定向测试通过。**残余边界：导出仍内存组装，旧述游标/临时文件/64KiB 流式发送未实现，已在 GDPR owner 文档标明。**
- **AUTH-02**（2026-11-03 修复）：登录支持包含停用账号的凭据匹配；凭据正确但停用返回 403「账号已停用」，错误凭据仍 401；管理端重新认证仍只接受启用账号。
- **COMPARE-01**（2026-11-03 修复）：Bloom 缺失层级返回 `null`，时序使用 `bucket_start` 真实分钟并按最早桶对齐；3 项 helper 测试通过。
- **ACCEPT-01 / ACCEPT-03 / OPS-02 / COMMIT-01**（2026-11-03 用户确认退役）：旧 lucid 工作树的验收、运行与提交材料已退出，仓库无可核原始内容；记录退役理由，不再作为当前待办，也不据此宣称相关功能已验收。
- **SSE-01**（2026-11-03 修复）：`useAdminSSE` 增加 `enabled`；学生端仅管理员订阅 `/admin/stream`，管理员页面默认保持；3 项 hook 测试通过。
- **CI-01** `manualChunks` → `codeSplitting.groups` 断言已修，脚本 34/34 通过。
- **CLASS-01** 课堂活动班级校验本地闭环（前端 19/19、后端 12/12）。
- **SCORE-01 / SCORE-02** AI 伙伴评分与提示去重已修。
- **2026-10-31 历史关闭集合**：COMPARE-01、ASSESS-01、ARTICLE-01、AUTH-02、UI-03、OPS-03、OPS-04、PYLAB-ENV-01、SCORE-02 曾被整体记录闭环；2026-11-02 曾核实 AUTH-02、COMPARE-01 不适用于当前实现并重新打开，二者已于 2026-11-03 修复关闭。其余仅保留当批记录，不据此宣称当前代码已验收。
- **ENV-01**：早期目录/密钥拆分是历史操作；本批按 canonical 服务数据源、物理路径和最终连接/密钥覆盖补启动守卫。缺生产配置仅做受限 dev-only，不宣称已验生产运行隔离。
- **SSRF-01**：保存路径已 await 异步软校验，日志不携带 URL/名称/异常原文；本批19项离线回归，不代表出站硬拒绝或完整 SSRF 闭环。
- **UPLOAD-01**：游戏请求体526385152字节覆盖502MiB multipart预算，普通16MB及30秒读取保留；本批38项静态合同通过，未验真代理上传。
- **C30/C59/C54组/C57/C14/C15/C35/C26/C36/C38/C40/C28/C41/C46（仅记录、未复核，不作为已关闭依据）**：本条保留在摘要仅为历史记录。原文仅记录“本批优先修复及必要回归已落盘；进程31项、根合同149项、端点19项与网关38项隔离通过；显式旧上传目录不迁移，真实进程/容器与数据库、生产未验”。全仓检索未见这些编号的定义、对应问题、修改文件与验证命令留存，任何人都不能据此认定对应当前代码已修复或已验收。升级条件：需重新给出编号定义、修改位置与验证命令并复核通过后，才可按已关闭处理。
- **ACCEPT-01 / ACCEPT-03 / DOC-01 / OPS-02 / COMMIT-01**：原文曾以 lucid 工作树删除认定失效；2026-11-02 订正为“历史材料退出，非事项自动取消”，已恢复跟踪边界。

## 变更日志

- 2026-11-06：PYLAB-03 按老大授权提交为 `900a8ab`（代码与测试），随本文档提交一起推送 main；推送后 CI 结果在下次文档更新回填。未打 tag、未部署。
- 2026-11-06：老大决定 PYLAB-03 进 2.2.10 并在本会话修复：`_recovery_expected_config` 改回 `await`（`d972f5d` 拆分时丢失）；新增走真实 Celery 任务的恢复测试（plain/debug × 重试/重投递）与三种拒绝用例，修复前恢复用例均 FAILED，四种变异均被拦下；独立审查通过，三条 P3 测试意见已补；开发栈真实 Docker 恢复两种模式均接管同一容器与同一 generation，修复前写法在同一环境复现"工作区不兼容"。本地已修，未提交。
- 2026-11-06：按老大授权推送 main（`eed0e21..060bd13`，快进、未强推）；推送后 ci-quality run 42149242348 通过（python governance 两次 errors=0；干净 PostgreSQL 上 pytest 3812 passed / 123 skipped；frontend 120 文件 / 879 例；repo-config 通过），markdown-quality 通过。未打 tag、未部署。
- 2026-11-06：2026-11-06 07:48 老大用手机流量（不经操作机代理）打开 `https://wangsh.cn:6608` 正常；同一时段网关记录 47 个外部来源请求（200×45、401×1、429×1），确认外部入口经 2.2.9 网关可用。
- 2026-11-06：PYLAB-NET-01 提交为 `a8fcb44`，按老大授权快进合入本地 main（未推送、未打 tag、未部署）；提交前迁移守卫通过，治理检查当前与 `--base-ref 50f8c9f`（上次 CI 全绿）均 errors=0。
- 2026-11-06：PYLAB-NET-01（2.2.10）本地修复完成，开发栈验收与独立审查通过，未提交；审查中新登记 PYLAB-03（启动恢复路径漏 `await`，早于区间）。
- 2026-11-06：**2.2.9 部署生产**。07:26 停流配对快照、隔离恢复通过，按服务切换，PG/Redis 未重建，停流约 4.5 分钟；部署后不登录检查通过。SSRF-FLOW-01、A-1/A-2/FE-TEST-01、D-R2、D3、PYLAB-02 已随 2.2.9 上线，各条剩余的生产验证见对应行。
- 2026-11-05：版本切分改为热修切分：2.2.9 = 当前 main 内容；PYLAB-NET-01 进 2.2.10，2.2.9 部署后开发。
- 2026-11-05：2026-11-05 生产只读核对（老大授权；生产 backend 容器 2.2.8，相关 5 个文件与 2.2.8 源码 sha256 一致；只读事务、不输出密钥；只对解析为公网的地址发不带凭据、不跟随重定向的请求）：生效的 flow 地址来自 `python_lab_agent_config`（`ai_agent_config` 不存在），为公网模型服务商，新出站校验**通过**、**不重定向**；未删除的 9 个智能体**全部停用**（对话与测试连接都会拒绝停用智能体，当前不出站），其中 2 个通用智能体指向公网中转，校验通过、不重定向；7 个 Dify 指向受信内网白名单地址，校验通过，按规则不对内网发请求，重定向情况未核。结论：2.2.9 的出站硬校验与不跟随重定向不会让生产现有配置失效。
- 2026-11-05：`50bb866` 修复首次推送的 ci-quality 治理失败（A-2 引入的复杂度回归，行为不变、未调整基线）并推送。重跑 CI：**通过**（run 42039152655：python governance 两次 errors=0；干净 PostgreSQL 上 pytest 3809 passed / 123 skipped；repo-config、frontend-quality 通过）。
- 2026-11-05：2.2.8 审查修复 6 个提交已推送（`a129e14..759e49a` 快进）；未打 tag、未部署。推送后 markdown-quality 通过；ci-quality（run 42034193780）**失败**：python governance 报 `dify_test.py::run_dify_test` 复杂度 22 超过历史上限 21（`2d239cf` A-2 新增 3xx 分支引入，提交前漏跑治理检查），pytest 步骤因此未执行，repo-config 与 frontend-quality 通过。`50bb866` 修复并推送：`run_dify_test` 两处相同的成功响应抽为 `_dify_success_response`（22→18）；补跑 `--base-ref a129e14` 又发现 `run_agent_chat_blocking`、`stream_agent_chat` 同因 3xx 分支 18→19，3xx 判断分别并入非 200 处理（`_provider_failure`、既有 `_provider_error_frame`），恢复到 14 与 18；行为不变（阻塞路径另用 400+ 组合与拆分前逐例比对一致），未调整基线。重跑 CI：**通过**（run 42039152655：python governance 两次 errors=0；干净 PostgreSQL 上 pytest 3809 passed / 123 skipped；repo-config、frontend-quality 通过）。
- 2026-11-05：**2.2.8 审查已修条目按计划切分提交**（老大授权，只提交）：`d6375a3` SSRF-FLOW-01、`199c5e9` D3、`2d239cf` A-1/A-2/FE-TEST-01、`0fa64ca` D-R2、`98f1c46` PYLAB-02，加本文档提交；均未推送、未打 tag、未部署。联网核对 `origin/main` 为 `a129e14`。
- 2026-11-05：**2.2.8 审查修复开始执行**（老大按推荐拍板 8 项决策）。SSRF-FLOW-01 本地已修且独立审查通过；D3 已回退；D-R2 按审查意见改为执行式合同测试；A-1/A-2/FE-TEST-01 本地已修、审查进行中；SEC-TPL-01、D3 前提完成生产只读核对；全部未提交。详见[修复计划](2026-11-05-release-228-review-fixes.md)。
- 2026-11-05：**2.2.2→2.2.8 发布增量审查落账**。四组审查 + 独立复查 + 主 Agent 核证确认：区间内 P2 3 条（A-1、A-2、C-R1）、P3 8 条；范围外 P1 1 条（SSRF-FLOW-01）及 PYLAB-02、PYLAB-NET-01、D3 等。新增 21 条未结事项，详细方案入 active 计划 [2.2.2→2.2.8 审查问题修复计划](2026-11-05-release-228-review-fixes.md)（经一次独立审查与两次针对性复核）。PYLAB-02 本地已修（未提交）：宿主端口改由 Docker 分配 + debugpy 只听回环，pytest 472/60 skipped，provider 层双用户复验通过。
- 2026-11-05：**补齐两项未完成验证并随本批提交**。①独立只读审查重跑（配额恢复后）：11/11 通过、0 P1、5 P3（R-01/R-03/R-04 已修、R-02 随本批提交成立、R-05 已记录）；②真实 prod-smoke 两轮（2.2.8 正式镜像、`wangsh_sim` 隔离栈）：无桩首跑 11 PASS/2 WARN/1 FAIL、FAIL 时 `failures.md` 写入 1239B；补容器 loopback:11434 合成供应商桩后重跑 **12 PASS/2 WARN/0 FAIL、exit 0、`failures.md` 不生成**，D13 FAIL/非 FAIL 双分支均经真实运行确认。栈/卷/网络/工作区精确清理，开发栈 7 容器未变。新增 OPS-06（simulate 未传 REDIS_HOST 的既有缺口）。
- 2026-11-05：**执行审计决策批次（D1/D3/D6/D9/D12/D13/D14 + A-01/A-07）**。①D6 计分修正按 ASSESSMENT.md 合同合入：固定题逐题计分、仅自适应按知识点保留首轮（`scoring.py` + 测试 + 文档状态更新）；②D14 移除不可实例化的 k8s provider 注册、未知 provider 启动报错；③D13 prod-smoke 仅在 FAIL 时写 failures.md；④D1 stop-dev 帮助声明 `--all` 会停本机生产栈（行为未改）；⑤D3 仓库 compose 补 `name: wangsh`；⑥D9 `.env.dev` 补 `COOKIE_SECURE=false`/`AI_PARTNER_SCORING_AGENT_ID=`（消除对生产 .env 的静默回落）；⑦D12 四处 AI 榜单状态更新为"已发布、生产已配置评分智能体（只读核验）、真实模型行为未验收"；⑧A-01 修复烟测 404 判定文案并加防漂移合同测试；⑨A-07 env 模板占位路径清空。**过程中发现并修复一个 P1 回归**：清空 `.env.example` 必填键会使 CI 的 `docker compose config` 失败（`SECRET_KEY` 等有 `:?` 守卫），改为 `change_me` 占位——Compose 渲染通过、生产 `must_set` 启动即拒绝；同步更新原"模板密钥必须可直接使用"测试为新安全契约。**独立只读审查**（E1/E2 执行后委派）：11/11 项通过、0 个 P1、5 个 P3——R-01（防漂移测试收紧为 JSX 整段断言）、R-03（RELEASE_NOTES TTY 修复归属改为 `5e6c369`/2.2.7 合入、2.2.8 包含）、R-04（XBK "当前为 2.1.2" 加时点限定）已修；R-02（ASSESSMENT.md"已合入 main"随本批提交成立）随提交闭环；R-05（pytest 缓存与文档门禁的顺序冲突）在 TEST_STATUS 说明。D2（xbk 目标守卫）与 D16/D17/D18 维持记录不动。验证：后端 249 passed/20 skipped、治理 errors=0、根合同 91/91、compose 渲染 exit 0、烟测测试 4/4、文档门禁 115/730/0。
- 2026-11-05：**本地整理**。①订正 DOC-01：C 系列候选定义并非不可恢复，已从会话恢复检查点提炼为[归档候选定义](../archive/reviews/2026-11-02-c-series-candidates.md)；②清理 `/tmp` 下 1.9G 发布/候选临时目录（镜像 OCI tar、checkout、证据副本，均已在服务器或归档留证）；③删除 3 个已合入 main 的本地分支引用、`__pycache__`、`.DS_Store`、`backend/celerybeat-schedule`（运行中容器持有、可重建）；④`output/agent-reports/` 保留为本轮审核证据，不提交（git 忽略）。
- 2026-11-05：**D2 生产只读核验完成**（经局域网 192.168.5.3 实际连接，`wangsh.cn` 本机 DNS 仍被代理劫持）。确认：①生产 `docker-compose.production.json` 服务集含 postgres/redis 共 8 服务，其 pg/redis bind 指向 `2.2.0/source/data/{postgres,redis}`（与运行实例一致）；②生产 worker `User=1000:1000 GroupAdd=[0 984]`；③`/api/v1/health` 返回 2.2.8 healthy、DB/Redis healthy；④6607 端口在服务器本机 http/https 均无响应（000，与"SSH 端口"口径一致，Web 入口为 6608）。据此：P1-1 的生产风险由"条件性"变为"已确认服务集含 pg/redis"，`deploy.sh` 白名单为必要修复——**该修复目前只在仓库 main（未推送、未发布）**，生产 2.2.8 发布目录的脚本仍是旧版，下次生产发布前必须确认运行的是含白名单的版本，否则仍按 DEPLOY 禁令人工核对；WORKER-01 的 uid 部分关闭，残余 socket 风险登记为 SOCKET-01。用户明确：①不轮换服务器凭据、SSH 密码认证保持开启、不做主机重装（SEC-03 记为风险接受，不视为消除）；②批准 D2 生产只读核验包与 `deploy.sh` 发布服务白名单；③运营方不存在隐私政策文本（PRIV-04 按现状记录，不虚构）。同时按重审结论落账六项默认决策：PYLAB-01 不设执行上限、UI-02 维持现状、XBK-01 不新增批量调班、PROGRAM-01 维持双入口、DIANMING-01 记录不持久化、DOC-01 退役。新增 UI-03（前端失败态缺陷）。已关闭条目按维护规则移入摘要，WORKER-01 按真实生产时间线重写。

- 2026-11-04：**垃圾扫描与旧卷删除（OPS-05 关闭）**。清理 `/tmp` 一次性产物与孤立 vscode-server 版本约 515MB；经用户确认后删除三个无引用的旧数据库卷（`wangsh_postgres_data` 111M、匿名卷 110M、`wangsh_redis_data` 45M，共 266M），删前记录文件数/字节/时间边界/PG_VERSION/清单 sha256 到 `deletion-metadata.json` 并保留 3.4MB 的 SQLite 副本。`/tmp/weekly-school-archive-before.sqlite` 经只读核对确认是运维前副本（106 条记录），活库 `archive.sqlite`（139 条，容器使用中）未受影响，副本已删除。磁盘 69G→50G（本日累计 19G）。生产八容器 healthy、`/api/health` 2.2.8、十条红线 `ALL_PASS`。

- 2026-11-04：**处置服务器后门账号事件（SEC-01/SEC-02 关闭）**。确认 2026-05-18 植入后门（账号 `systemd` uid 1001 + sudoers NOPASSWD + root crontab `@reboot` + log.service + XMRig 挖矿程序 + sshdd.so LD_PRELOAD rootkit），2026-10-26 有一次来自 `77.239.124.120` 的成功密码登录。更早会话已隔离 rootkit 主体但遗漏账号与四项持久化（log.service 被加 immutable）。本次清除全部六项并逐一复验；桌面 `.env` 归档收紧。生产八容器 healthy、`/api/health` 2.2.8 未受影响。证据在 `/root/security-remediation-20261104/`。

- 2026-11-04：**完成 sudo 阶段清理**。删除 `/swapfile_extra`（16G，删前三重校验：未启用、fstab 无条目、无进程打开）与 `~/.vscode-server` 旧版，截断 `btmp.1`；磁盘 69G→51G（累计释放约 18.2G）。`/home/shuhao/dify` 经四种方法实测仅 670KB（审计所报 100MB 有误）且属 Dify 项目，决定保留。清理后十条红线复验 `ALL_PASS: true`，八容器 RestartCount 全 0、启动时间未变，生产 healthy/2.2.8。密码经 stdin 管道传入，未落盘、未入 argv、未进日志。

- 2026-11-04：**执行阶段一（对齐）与阶段二（服务器清理）**。本地 stash→ff-only→pop 后提交 `c795313` 并推送，LEDGER-01 关闭；LEDGER-02/03 的 2.2.5 链路缺失、2.2.2/2.2.3 未上 DockerHub、2.2.1 构建源偏差均已逐个核实并写入发布记录。服务器清理按白名单脚本执行，十条红线基线与清理后逐项复验一致（compose sha256、PG inode/mtime、回滚六镜像、悬空镜像、2.2.8 六镜像、容器集、配对备份 8 文件、PythonLab 工作区、活 swap）；`CURRENT_PRODUCTION.txt` 由 2.1.6 订正为 2.2.8 并保留 `.bak-20261104`。

- 2026-11-04：完成四方台账对齐盘点（本地/GitHub/DockerHub/服务器），两个独立只读审计交叉复核。发布链路五段一致；新增未结 LEDGER-01/02/03、SEC-01/02、OPS-04。现行计划转入四方对齐盘点（已于 2026-11-05 归档，约束内容沉淀到 DEPLOY/RELEASE_NOTES 与本台账），上一阶段计划 superseded。

- 2026-11-04：**2.2.8 部署生产并关闭 RELEASE-01**。六镜像按 digest 到齐 + 官方 registry 核验，纯正式镜像合成栈双浏览器各 4/4；停流配对备份与隔离恢复通过；按服务切换，PG/Redis 未重建；专用合成 admin 部署后各 4/4 并按精确 ID 清理；合成栈与临时通道收尾。未做长时间观察与回滚实测。

- 2026-11-04：TTY附着竞态本地实现完成，按Engine101及当前session ready门控恢复原Chrome/WebKit两场景，保留单路输出、世代与鉴权；后端191/JWT-WS78/前端295及类型构建治理通过。修复未提交发布，RELEASE-01仍等待正式源/registry/备份恢复及生产验收，不覆盖2.2.6。

- 2026-11-04：原始双浏览器调试失败保留；独立时序诊断与1.5秒附着对照支持TTY输出竞态，尚未修复，不修改原超时/断言刷绿。生产全部容器与current链接未变、API healthy；官方registry超时门禁保留，未停流或备份切换。

- 2026-11-04：完整合成smoke14项/13页UI通过，真实Chrome/WebKit普通debug均最终缺输出8，另多断点通过；独立WS诊断复现且terminal收到0帧，根因待核，不放宽超时。服务器registry门禁连接超时，RELEASE-01保留阻断，未停流/备份切换。

- 2026-11-04：用户确认接力续做2.2.6未完成验收部署；发布与远端标签复核、本机六镜像核准通过。外网SSH恢复，后续停用局域网；发现实际PG/Redis bind与备用production命名卷差异，RELEASE-01明确阻断直接启动，先保全真实目标并完成验收/备份恢复。

- 2026-11-03：修复PR全部六项CI成功并合入main，按用户授权准备2.2.6重建/发布/部署。保留2.2.5，is-docker仅更正实际2.2.1元数据；当前SSH连接失败，现场备份/恢复及切换未做，RELEASE-01仍开放。

- 2026-11-03：按用户授权提交推送本轮20文件修复与证据到现有PR；Chrome/WebKit及本地门禁通过不替代远端结果，RELEASE-01继续开放，已发2.2.5和生产不变。

- 2026-11-03：`9a9e54e` 后端远端3750通过；owner点击失败缺原报告，未定因。独立竞态/严格smoke/PDF缓解本地完成并经Chrome/WebKit验收，34包告警分类但未清零；临时资源清理完成，本轮差异未提交推送，RELEASE-01继续开放。

- 2026-11-03：RELEASE-01 PR首轮5项门禁通过，后端仅原子登录测试替身签名不匹配；补显式参数/True断言，36项隔离通过后按授权推送，仍待远端CI，不改生产逻辑或部署。

- 2026-11-03：按用户授权提交并推送门禁修复候选、发起PR；RELEASE-01仍等待修复候选的远端CI及发布准入证据，不据本地通过关闭。

- 2026-11-03：RELEASE-01 已知门禁本地修复完成：后端共享guard/身份投影、lock三个缺项与自含测试精确分离；相对基线/隔离回归/干净安装及八项前端命令通过，未放宽baseline。远端CI、修订候选及备份恢复仍未完成，安装audit报告保留待核，未提交推送/部署。

- 2026-11-03：RELEASE-01 发布前核对发现构建提交 CI 失败（治理回归 2 项、前端 lock 缺项），原 release-set 仍为 2.2.0；停止切换。局域网 22 直连与生产 2.2.2/healthy 已只读核准，订正头部旧“未推送/未连接生产”口径。

- 2026-11-03：新增 WORKER-01：PythonLab worker 的 Compose 运行身份与镜像、DEPLOY 约定不一致，需先核实 workspace 可写再改；同批完成 /health 脱敏、智能体端点核对脚本与 C 系列口径订正。
- 2026-11-03：订正 C30/C59/C54组/C57/C14/C15/C35/C26/C36/C38/C40/C28/C41/C46 条目为「仅记录、未复核」：全仓无这些编号的定义、修改位置与验证命令留存，原表述易被误读为已核验通过；补齐定义与验证后才可按已关闭处理。
- 2026-11-03：B 类按用户选择推进：历史项 ACCEPT-01/03、OPS-02、COMMIT-01 退役；PRIV-02 同意写入/撤回 API 与 `/privacy` 自助页实现（版本/调用前强制校验仍未完成）；UI/功能项暂不实施。
- 2026-11-03：D 类 6 项完成修复并关闭（ASYNC-01/02、PRIV-01/03、AUTH-02、COMPARE-01、SSE-01）；后端定向 24、前端相关 10、type-check 通过；PRIV 导出流式边界保留。
- 2026-11-02：阶段 C 完成 24 行台账核验与分类（D 6、B 12、C 5；DIFY-02 核验为非缺陷关闭）；A 类无待改代码项，B/C/D 等待确认或真实数据，未擅自实施。
- 2026-11-02：阶段 B 本机真实验收完成（健康/前端/数据库目标/浏览器/停止/二次启动/容器身份）；验收中发现并修复进程守卫 UTF-8 解码与无关进程误阻断问题，进程回归31→35。
- 2026-11-02：建立三阶段现行计划（代码复核 → 本机真实环境验收 → 台账核验与分批修复）；真实验收仅本机开发栈，不提交、不部署、不操作生产。
- 2026-11-02：完成本批15项代码/状态修复与隔离验收；恢复ASYNC/PRIV/AUTH/COMPARE等原编号，撤回工作树删除自动关闭推论；保留历史结果与真实环境未验边界。
- 2026-11-02：登记审查后高优先级修复范围、任务分支和隔离验收边界；现行计划集中于本页，保留原关闭摘要待证据订正。

## 维护规则

- 新发现的问题登记到本表，沿用原编号；不新建平行台账。
- 条目闭环后移入「已关闭」并附一句依据，不长期占用未结表。
- 发现新问题先更新台账再动手，问题、影响、处置和是否阻塞一并写入。
