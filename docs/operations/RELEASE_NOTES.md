# 发布与运维记录

> 状态：active
> Owner：release-ops
> 最近整理：2026-11-04
> 归档条件：版本记录不再承担当前指导作用，独有证据保留并更新索引后归档。

本文按版本和日期保留变更、配置影响、发布证据与回滚点。下方“已部署”“未发布”均为
对应批次的记录，不代表当前生产状态；本次只整理目录与历史分层，未重新验证历史发布。
当前操作见 [部署指南](DEPLOY.md)，实际验收见 [测试状态](../testing/TEST_STATUS.md)。
2026-10-31 及更早的未发布批次记录已删除（lucid 工作树已删除、改动未合入 main）。
2026-10-24 及更早的正式版本记录见 发布历史（正文已清理）。

近期版本：[2.2.9](#v229228-审查修复2026-11-06-已部署)、[2.2.8](#v228linux-docker内dap通道2026-11-04-已部署)、
[2.2.2](#v222ai-伙伴评分真正可用2026-10-29-0950-已部署)、
[2.2.1](#v221dify-连续对话与评分修复s4-缺陷性能与前端体验2026-10-28-2339-已部署)、
[2.2.0](#v220代码审查瘦身热点归类与使用记录详情2026-10-26-2052-部署)。

历史命令中的 `build_images.sh` 已删除，仅供追溯；当前构建入口为
`scripts/deploy.sh build` 或 `scripts/deploy.sh build-amd64`。

## 历史发布留痕订正（2026-11-04 核验）

以下三条为 2026-11-04 四方台账对齐时逐个核实的结论，用于说明历史版本的可复现边界。
不据此补推镜像、不改写已发布 tag。

- **2.2.5 发布链路缺失，镜像源码不可自证**：`2.2.5` tag 指向 `189205c`，但该提交没有
  `dockerhub-amd64` 发布 run（该 workflow 历史 run 中不存在对应记录），六个 DockerHub 仓库
  也没有 `2.2.5-build-<run>` staging tag 与 `release-set-*` artifact。同提交的 `ci-quality`
  run 41592108696 结论为 **failure**。DockerHub 上存在 `2.2.5` 镜像标签，但缺少 workflow
  与清单证据链，不能证明其与 tag 代码一致。2.2.5 从未部署生产，已被 2.2.6 取代。
- **2.2.1 镜像构建源与 tag 不一致**：`2.2.1` tag 指向 `a3a5a54`；DockerHub 上的 2.2.1
  镜像构建自更早的提交（tag 说明中自述），即镜像早于标签代码。已发布标签不重写，
  该差异保留为历史事实。
- **2.2.2 / 2.2.3 未发布到 DockerHub**：`2.2.2`、`2.2.3` 在 git 有 tag，但在
  `wangsh-backend`、`wangsh-typst-worker`、`wangsh-pythonlab-worker`、`pythonlab-sandbox`、
  `wangsh-frontend`、`wangsh-gateway` 六个仓库全部返回 404。服务器本地保有 2.2.2 回滚镜像集
  （五个 `:2.2.2` 加 `pythonlab-sandbox:2.2.1`），**这是该版本唯一的镜像副本**，
  清理服务器时必须保留。

---

## 未发布：2.2.10

### PythonLab 调试容器断网（PYLAB-NET-01，`a8fcb44`，已推送 origin/main，推送后 ci-quality run 42149242348 通过）

- 问题：debug 容器在默认 bridge 上、可出站，学生代码的联网限制只靠工作区里可改写的 `sitecustomize`（PythonLab 文档 OPS-01）。学生代码可以访问外网与 bridge 上可达的服务。
- 修复：`backend/app/core/sandbox/docker.py` 让 debug 也 `--network none`，不再发布宿主端口；启动以容器内就绪检查（`/proc/net/tcp`）为准。复用要求两种模式都无网络。`dap_ws` 对 Docker 会话不再要求宿主端口（DAP 本就经 `docker exec` 在容器内连接），旧 TCP 会话保留端口校验。
- 验证（本地开发栈）：PythonLab/sandbox pytest 488 passed / 60 skipped；容器内绕过 `sitecustomize` 的 TCP/UDP 出站均 `Network is unreachable`、DNS 失败；两名合成学生同时调试各 6/6；Chrome channel 与 WebKit 真实点击各 4/4；独立审查通过。未覆盖：生产验证。
- 切换与回滚（按代码推断，未实测）：backend 与 pythonlab-worker 同版本切换；部署前已在运行的调试容器在其会话结束前不受隔离；回滚到 2.2.9 后，2.2.10 建的调试会话以 4410 关闭，学生重新开始调试即可。部署后核对带 `wangsh.pythonlab.runtime-mode=debug` 标签的容器 `NetworkMode` 均为 `none`。
- 详情见[审查问题修复计划](../plans/2026-11-05-release-228-review-fixes.md)。

### worker 在启动中途丢失后，会话恢复必定失败（PYLAB-03，`900a8ab`）

- 问题：worker 在会话 `STARTING` 中途丢失、启动任务再次执行时，恢复路径本应接管已建好的那一代容器，但期望挂载值是没有 `await` 的协程对象，复用检查必报"运行环境工作区不兼容"，会话进 `FAILED`，学生需重新启动。失败是关闭方向，不越权、不删资源。
- 范围：`d972f5d`（2026-09-12 治理复杂度拆分）引入；2.1.6 至 2.2.9 均受影响，包括生产 2.2.9。
- 修复：`backend/app/tasks/pythonlab.py` 的 `_recovery_expected_config` 改回 `await`。
- 验证（本地）：新增走真实 Celery 任务的恢复测试（plain/debug × 重试/重投递）与三种拒绝用例，修复前恢复用例均失败；独立审查通过；开发栈真实 Docker 两种模式都接管同一容器与同一 generation，修复前写法在同一环境复现该错误。未覆盖：真实 worker SIGKILL 加 broker 重投的端到端。
- 切换：无额外步骤；已因本缺陷进入 `FAILED` 的会话不会自动恢复。

---

## v2.2.9：2.2.8 审查修复（2026-11-06 已部署）

- 构建提交 `50f8c9f`；发布 workflow run 42050650608 发布六镜像，release-set SHA256 `0471e46b166b3b65b59405289fdc1dd7c3e9e3c6229bee7f0413c26b45fc276e`。服务器访问不了 Docker Hub，六镜像经操作机按 digest 生成 OCI 归档传输，服务器逐 blob 校验后导入。
- 服务器隔离合成栈 Chrome/WebKit 各 4/4，两名合成学生同时调试各 6/6；2026-11-06 07:26 停流做配对快照，隔离恢复 54 表 / 49 序列 / 2225 Redis 键 / 3 份业务归档一致；按服务切换，PG/Redis 未重建，`current` 指向 2.2.9，停流约 4.5 分钟。
- 部署后（不登录）：六镜像等于 release-set、详细健康全部 ok、未登录调用 flow 测试连接 401、日志无错误。外部入口：2026-11-06 07:48 老大用手机流量（不经操作机代理）打开 `https://wangsh.cn:6608` 正常；同一时段网关记录 47 个外部来源请求（200×45、401×1、429×1），确认外部入口经 2.2.9 网关可用。登录态浏览器验收未做。
- 证据：[批次记录](../archive/testing/2026-11-06-release-229.md)；服务器 `/home/shuhao/wangsh-releases/2.2.9/{backups,evidence}`。

逐条方案、审查结论与剩余验收见[审查问题修复计划](../plans/2026-11-05-release-228-review-fixes.md)。提交：`d6375a3` SSRF-FLOW-01、`199c5e9` D3、`2d239cf` A-1/A-2/FE-TEST-01、`0fa64ca` D-R2、`98f1c46` PYLAB-02；`50bb866` 为 A-2 治理复杂度修复（行为不变）。

### PythonLab 多人同时调试端口冲突（PYLAB-02）

- 问题：调试容器固定发布宿主 `127.0.0.1:5678:5678`，同机第二个调试容器启动失败（`port is already allocated`），学生看到"运行环境启动失败"。该行早于 2.2.2，生产 2.2.8 受影响。
- 修复：`backend/app/core/sandbox/docker.py` 改为 `-p 127.0.0.1::5678`，仍只绑定回环地址，宿主端口由 Docker 分配，实际端口由既有 `_get_dynamic_port()` 读回。DAP 数据经 `docker exec` 在容器内连接，不经宿主端口；但读回端口仍是启动门槛（读不回时新建容器报超时，`dap_ws` 要求端口大于 0）。
- 同批收紧（独立审查发现的回归）：修复后同机可并存多个调试容器，原 debugpy `--listen 0.0.0.0` 会让同一 bridge 上其他学生的代码直连本调试器；改为 `--listen 127.0.0.1`，容器内 DAP 代理本就连 `127.0.0.1`，不受影响。
- 验证（本地）：修复前 provider 层两名合成用户复现第二个失败；修复后 PythonLab/sandbox 相关 pytest 472 passed / 60 skipped；provider 层两名合成用户同时启动成功（宿主端口不同）、各自 DAP `initialize` 返回 success、容器内 debugpy 仅监听 `127.0.0.1:5678`。未覆盖：真实浏览器双人同时调试、生产验证（待发布后）。
- 未变：debug 容器仍在默认 bridge、可出站（PythonLab 文档 OPS-01），学生代码的联网限制仅靠可绕过的 `sitecustomize`，已列为 PYLAB-NET-01，见[审查问题修复计划](../plans/2026-11-05-release-228-review-fixes.md)。

### flow 测试连接可被任何登录用户用来请求内网（SSRF-FLOW-01，P1）

- 问题：`POST /api/v2/pythonlab/flow/test_agent_connection` 只要求登录，服务器按请求体 `api_url` 发出请求、跟随重定向、失败时回显上游响应体前 600 字；学生账号直接调用即可让服务器访问局域网或本机服务并读回内容。由 `39293d2`（2026-04-11）引入，生产 2.2.8 受影响。
- 修复：接口改为仅管理员可调（前端唯一入口本就在管理员页）；`code_generator.py` 的 `chat_completion` 在发出请求前做出站硬校验，被拒时直接返回"目标地址不允许"、不重试；不再跟随重定向，3xx 判失败；HTTP 错误对外只返回状态码与固定文案，响应体限 500 字、替换密钥后只写服务端日志。
- 行为变化：①管理员"测试连接"不再显示上游错误原文（例如 DeepSeek "model not exist"），排错需看服务端日志；②学生可达的 AI 对话、代码优化、流程图生成三个接口的地址取自管理员 feature flag，同样受出站硬校验约束。flag 指向私网或 `host.docker.internal` 且不在 `AGENT_TRUSTED_INTERNAL_ENDPOINTS` 白名单内时，上线后会报"目标地址不允许"。2026-11-05 只读核对生产：生效的 `python_lab_agent_config` 指向公网服务商，校验通过、不重定向，不受影响。
- 验证（本地）：新增 13 条测试（内网、回环、元数据地址被拒且不发请求；302 不跟随；500 不回显；学生、教师 403，管理员可调）全部通过；独立审查通过。开发栈 API 与管理员页浏览器验收通过（合成供应商桩）。生产 flag 只读核对通过。

### 智能体"测试连接"恢复可用，出站不再跟随重定向（A-1、A-2、FE-TEST-01）

- 问题：①2.2.5 起（`aeae945`）"测试连接"把拼接前的相对路径交给出站校验，所有智能体测试恒失败（A-1）；②智能体出站跟随重定向，硬校验只查首个地址，上游 302 可把请求带到内网（A-2）；③前端按外层信封判定，把测试失败显示成"成功"（FE-TEST-01）。
- 修复：测试连接校验实际请求的完整地址（Dify 校验 `api_endpoint`）；对话（普通/Dify、流式/阻塞）与测试连接逐请求不跟随重定向，3xx 判失败、提示"请填写最终地址"、不回显响应体；前端两处改按 `data.success` 判定并显示 `data.message`。
- 行为变化：依赖 http→https 或补斜杠跳转的智能体地址会开始失败，需改填最终地址；学生端对话页遇此类错误只显示固定文案，排查用管理员测试连接。
- 验证（本地）：新增后端测试 13 条、前端 4 例通过；独立审查通过。开发栈合成桩下测试连接成功、302 不跟随、学生流式对话正常，两处管理员页浏览器显示正确。生产只读核对：智能体当前全部停用；公网地址不重定向，Dify 内网白名单地址未发请求、重定向情况未核，重新启用后用管理员测试连接确认。

### 发布 workflow 拒绝覆盖已发布的版本 tag（D-R2）

- 问题：main 版本号仍是 2.2.8 时，按默认参数重跑发布 workflow 能过全部门禁并覆盖已发布的 2.2.8 六个镜像，之后从 registry 回滚到 2.2.8 会拉到新镜像。
- 修复：`dockerhub-amd64.yml` 在登录之后、构建之前逐个检查六个版本 tag；任一已存在，或 registry 未明确回答 not found，即失败退出。合同测试实际执行该步骤，并经 6 种变异验证能拦住失效改动。门禁说明见 [CI/CD](CICD.md)。

### 回退仓库 compose 顶层 `name: wangsh`（D3）

- `a129e14` 给仓库 `docker-compose.yml` 加的 `name: wangsh` 已删除，文件恢复为与 2.2.8 一致。该行只在 main 上，从未随版本发布。保留它会让服务器发布目录里的裸 `compose down` 或 `stop-dev.sh --all` 有机会作用于生产项目；生产命令照旧显式传 `-p wangsh`。

### 同版本还包含（2.2.8 部署后已在 main 的修复）

- **D6 计分修正（会改变学生成绩）**：固定题逐题计分，仅自适应题按知识点保留首轮；同一知识点多道固定题不再折叠。上线前须告知教师（`a129e14`）。
- **发布命令作用域**：`deploy.sh` 的 `pull-up`/`up-no-build` 只对六个业务服务 `--no-deps` 启动，不再触及 postgres/redis（`6da7580`）。
- **前端失败态（UI-03）**：公开启动器 flag 加载失败显示错误与重试，不再伪装为"管理员未开启"；点名班级选择器区分无权限、加载失败与无数据（`6da7580`）。
- **D14**：移除不可实例化的 k8s sandbox provider 注册，未知 provider 启动即报错；**D13**：prod-smoke 只在失败时写 `failures.md`（`a129e14`）。
- 没有 Alembic 迁移；沙箱镜像目录与 2.2.8 相同，镜像随版本号重新发布。

## v2.2.8：Linux Docker内DAP通道（2026-11-04 已部署）

- 修复源 `210655a` 经 PR #17 六项门禁合入 main 的 `2d9dda0`；
  [workflow41783222115](https://github.com/shuhao0727/wangsh/actions/runs/41783222115) 发布六镜像，
  release-set SHA256 `cda44253f4ba39880ed45c20b16fc817392e2d5e3ee4cf020043cdf8bc9e9ba0`。
- 六镜像按 digest 精确到达服务器（三个原生拉取，三个经本次授权的临时 SSH 通道 + OCI 原 digest 传输，
  逐 blob 校验，未重建或重打包 manifest），官方 registry 核验 `images=6`。
- 纯正式镜像隔离合成栈 Chrome/WebKit 各 4/4 通过；随即停流做 PG/Redis 配对快照与
  上传/PDF/PythonLab 归档，隔离恢复 54 表/49 序列/2221 Redis 键/3 份业务归档全部一致，
  新代码在恢复数据上正常启动。
- 按服务切换：PG/Redis 未重建（ID、启动时间、挂载不变），应用与网关切到 2.2.8，
  `current` 指向 `/home/shuhao/wangsh-releases/2.2.8/source`；部署后专用合成 admin 账号
  在真实浏览器 Chrome/WebKit 各 4/4 通过后按精确 ID 停用并软删除。
- 证据：`docs/archive/testing/2026-11-04-release-228.md`；服务器
  `/home/shuhao/wangsh-releases/2.2.8/{backups,evidence}`。

## v2.2.8（原记录）：Linux Docker内DAP通道（发布准备）

- 2.2.7正式候选证实：沙箱内部debugpy监听正常，但backend容器无法访问Linux宿主loopback
  映射。按可信session/token/exact container ID在workspace fence内建立Docker exec固定代理，
  仅连接沙箱自身127.0.0.1；不公开DAP、不回退其他主机、失败取消回收传输。
- 服务器修订合成栈Chrome/WebKit原四场景各4/4通过；后端隔离205项、JWT/ASGI78项通过，
  治理errors0/warnings41、baseline未变。当前准备2.2.8新构建，不覆盖已发2.2.7。

## v2.2.7：已发布，Linux正式候选阻断（2026-11-04，未部署）

- 修复ce78e0d及Linux关闭断言续修d87f7e9经6项PR门禁合入main的5e6c369；
  [workflow41763078161](https://github.com/shuhao0727/wangsh/actions/runs/41763078161)成功发布六镜像，
  2.2.7 tag精确指向构建源，release-set SHA256为
  b694677b5234d943f59e29be9323e1e5a70eea96446ce6e9a4033d4acaa4c969。
- 六镜像官方registry、本地RepoDigest/amd64及打包源码hash核准；mirror缺失的layer按用户
  允许的SSH+OCI原digest无损传输，逐blob校验，未改manifest或跳过清单门禁。
- 服务器正式候选Chrome输入通过，但调试首次暂停前失败；内部5678可连、backend三个宿主
  候选地址均拒绝，确认Linux回环可达性缺口。生产未停流，转入2.2.8，不覆盖已发版本。

## 2026-11-04：PythonLab TTY附着竞态修复（本地候选 → 随 2.2.8 发布）

- debug终端从“Docker attach进程已创建”改为Engine101握手后就绪，使用当前Docker上下文，
  按可信session/token/exact container ID附着；失败/取消清理本次传输，不删未知容器。
- binary ready确认与程序文本分离；前端按当前会话门控启动/configurationDone/Continue/Step，
  断开、stop/reset或旧世代失效；保留TTY单路输出与原烟测完成门限，不用固定延时。
- 最终修订生产build的原Chrome channel/WebKit四场景各4/4通过，普通debug输出8、多断点5且
  session0；后端191项、JWT/SQLite/ASGI78项、主前端875项通过（PythonLab295为子集）。
  调试input及无断点既有合同补验通过；WebKit原有DAP关闭console信息保留，实际范围见测试状态。
- **订正（2026-11-05）**：本段最初写“未提交的本地修订、未发布/部署”。该修复先经 PR #17 合入 main
  的 `5e6c369`（2.2.7 标签提交），再包含于 2.2.8 构建源 `2d9dda0`，随 2.2.7/2.2.8 发布，2.2.8 已部署生产。
  当时所述“未发布”仅指写下该段时的状态，不代表当前；原始记录保留，结论以上述订正为准。

## v2.2.6：镜像已发布，生产未部署（2026-11-04核对）

- 2026-11-03由构建源 `c45ad0ef2cdbd7844874fcfbfc6c5e817408d42c` 完成
  [发布workflow41661803455](https://github.com/shuhao0727/wangsh/actions/runs/41661803455)，
  source-guard、三项quality-gate与build-and-push成功；六个linux/amd64镜像及release-set已发布。
  2026-11-04联网复核workflow及远端2.2.6标签仍精确指向构建源，不重发或覆盖旧2.2.5。
- artifact为 `release-set-41661803455`，清单SHA256为
  `f663933820e95584499a7190b6c56cf7b2a3816d78a23a8fb589b07026721ea7`；
  六镜像身份及本轮验收详见[批次证据](../archive/testing/2026-11-04-release-226.md)。
- 覆盖门禁、调试状态守卫、严格smoke与PDF禁eval修复；lock中is-docker恢复为同tarball/
  integrity对应的实际2.2.1元数据，未升级该依赖，不宣称依赖漏洞清零。
- 外网SSH已恢复，后续只使用 `wangsh.cn:6607`。现场仍为2.2.2/healthy；PG/Redis实际bind
  与备用production Compose命名卷不一致，独立候选配置保留真实挂载，不重建基础设施。
- 候选完整合成smoke14项及13页UI通过，但原脚本Chrome/WebKit普通debug均缺最终输出8；
  独立时序/附着等待对照支持TTY竞态，尚未修复，不能把延迟诊断当发布验收通过。
- 服务器官方registry manifest核验连接超时，发布门禁仍阻断；未停流、配对备份/隔离恢复或
  切换应用。镜像已发布不等于生产已生效，当前结论见测试状态与RELEASE-01。
- 订正：本节此前停留“发布准备/尚未构建”，落后于已完成workflow；本轮按现存清单及联网
  结果订正，不以旧文档重复发布，也不将本机验收冒充生产部署。

## 2026-11-03：RELEASE-01 门禁修复（已合入main，未部署）

- 复用Provider出站端点校验与认证固定身份投影，消除相对原基线的复杂度/文件规模回归，
  保留原白名单、请求前拒绝、取消传播、账号状态和凭据匹配合同；未放宽治理baseline。
- 前端lock只补三个缺失的 `@emnapi/*` peer/传递条目，普通 `npm ci` 干净安装通过；
  不改直接依赖版本，不用 `--legacy-peer-deps` 代替CI准入。
- 端点软保存19项自含测试保留独立 `-I -B -S` 执行，普通pytest只精确排除该模块，避免
  正常app导入冲突；新增workflow合同守住两处，不减少用例或coverage范围。
- 调试Continue/Step及握手running fallback增加同步世代/session/lifecycle守卫；补真实hook
  交错回归，防止旧响应覆盖新暂停/停止；不把该独立竞态未经证据归为原owner CI失败根因。
- pointer smoke核对精确断点行、已停止/输出/会话清零，保留原超时；新增Chrome/WebKit入口、
  固定错误码/阶段摘要与helper合同，不输出原始错误快照；两项PR门禁同步覆盖helper变更。
- PDF预览显式关闭PDF.js动态求值，缓解CVE-2024-4367路径；不升级整批依赖或宣称audit清零。
- 已发2.2.5 tag/镜像保持不变；本地复验不等于远端CI通过，也不解除生产发布阻断。
  实际结果与未覆盖项见[当前测试状态](../testing/TEST_STATUS.md)。

## 2026-11-02：高优先级审查修复（本地未提交、未发布）

- 运维入口先固定显式调用方相对配置/备份/清单/恢复路径，父回滚和备份子进程沿用同一目标。
- 开发入口拒绝按固定名称删除容器，先核对 Compose 来源和 bind；启停共用 exact-PID 归属守卫，
  保留未知来源进程，修正无进程状态和符号链接路径，后端/worker 使用同一解释器。
- 配置检查改用 canonical JSON，独立处理两栈环境与个人覆盖，未知不作隔离证明；新增开发模板，
  缺开发配置不再回退生产。上传默认对齐 `data/dev/uploads`，不自动搬迁历史文件。
- 保存 endpoint 使用异步软校验，固定日志不携带 URL/名称/异常原文；策略仍是告警而非硬拒绝。
- 游戏请求体预算对齐后端 502MiB（526385152 字节），普通路径和 30 秒读取边界不变。
- 停止入口 `--all` 统一清除外部 Compose 选择器，按显式开发/生产文件停止；修复 bash 3.2 空数组兼容；部署文档同步 526385152 字节与 5433 开发连接口径。
- 订正台账中的误关闭状态；功能未合入的事项恢复原编号跟踪，未借此实施其他 ASYNC/PRIV 功能。

验证以[当前测试状态](../testing/TEST_STATUS.md)为准。仅隔离合成回归，不代表真实服务、历史数据、
完整镜像或生产已验收；本批未部署、重启、迁移或变更真实配置。

## v2.2.2：AI 伙伴评分真正可用（2026-10-29 09:50 已部署）

2.2.1 的镜像构建于 2026-10-28 22:17，构建源是 `c0b44b6`；而 tag `2.2.1` 指向
`a3a5a54`，比镜像新 5 个提交。代码级特征已确认镜像里既没有评分修复
（`MODEL_HTTP_TIMEOUT_SECONDS`）也没有治理拆分（`classroom_queries.py`）。
所以 2.2.1 部署后用户访问评分仍是 504/502——**修复从未真正上线**。

本版把修复重新构建并验证到端到端 HTTP 200。

### 评分的三个独立故障（逐个修掉）

1. **`<think>` 思维链污染 JSON**（`5a4c86d`）
   Dify 的 DeepSeek 插件把推理写进 `<think>…</think>` 并与答案共用同一字符串。
   评分路径没接平台的 `assistant_answer_sanitizer`，`json.loads` 首字符是 `<`
   必然失败。改为统一走 sanitizer。

2. **网关 30 秒切断**（`0834433`）
   `@api` 通用 handler 的 `response_header_timeout 30s` 卡的是「等后端返回响应头」
   阶段——评分端点整段推理期间不发响应头，30s 一到 Caddy 就断开。
   实测评分耗时 24–43s，超过一半请求因此失败。
   给 `/api/v1/ai-partner/evaluate` 单独 handler，放宽到 120s。
   同时三层预算整体上调：httpx 20→75s、总预算 25→80s、Redis 锁 35→90s、
   前端 axios 65→110s（前端必须比后端宽，否则用户先看到 abort）。

3. **模型返回 5 个维度**（`e34270f`）
   模型偶尔把 suggestions 里一条塞进 `dimensions`，而 schema 是
   `min_length=4/max_length=4` → `ValidationError`。这是「有时能过有时 502」
   的根源。新增 `_normalize_dimensions`：按 key 白名单精确挑 4 项，
   多余项与重复 key 丢弃；**缺任何一项仍判无效**，不补 0 分糊过去。

另加 `_extract_json_object`：模型在 JSON 前后多写解释或包 ```json 围栏时，
用括号配对扫描（正确处理字符串内 `{}` 与转义）截出对象重试。

### 其它修复（相对 2.2.1 镜像）

- `5f6e815` 三个超基线文件真拆，governance errors 3 → 0
- `3bdb184` `alembic_version` 两条建表路径主键对齐（空库 bootstrap 原先无主键，
  会破坏单 head 前提）；用户页批量删除补确认弹窗与互斥

### 部署过程中发现的配置问题

- **服务器 `.env` 的 `REDIS_HOST=127.0.0.1`** 覆盖了 compose 默认值
  `wangsh-redis-1`，容器内 127.0.0.1 指向自己，Redis 连不上、健康检查 degraded。
  已改为 `wangsh-redis-1`。这也说明 compose 的默认值只在 `.env` 未设置时生效。

### 验证

- `tests/ai_partner`：**127 passed / 1 skipped**（新增 9 项覆盖 think 剥离、
  前后缀容忍、多余维度收敛、缺维度拒绝、重复 key 去重、超时预算嵌套）
- 网关合同 61 passed / 0 fail；根脚本 89 passed
- 生产端到端：**连续 3 次 `POST /api/v1/ai-partner/evaluate` 全部 HTTP 200**，
  返回 total=35、四维度齐全、6 条建议、evaluation_id 正常
- 数据完整性：**433 用户 / 55 表 / head `20261026_0001`**，与部署前完全一致
- 8 容器全 healthy

---

## v2.2.1：Dify 连续对话与评分修复、S4 缺陷、性能与前端体验（2026-10-28 23:39 已部署）

### 修复

- **AI 伙伴评分可用**：新增 `AGENT_TRUSTED_INTERNAL_ENDPOINTS` 受信内部端点白名单，
  四元组严格匹配（scheme + host + 显式 port + path 前缀）。此前 SSRF 检查把 Docker 内网
  `172.18.0.2` 判为私网，评分请求在发往 Dify 前就被拦（503）。`_is_disallowed_ip` 一行未改，
  未命中白名单的目标继续全拒。
  白名单打通后暴露了另外两个独立故障（`5a4c86d`）：Dify 把思维链和答案塞进同一个字符串
  （`<think>…</think>{json}`），而评分路径没接 `assistant_answer_sanitizer`，`json.loads`
  必然失败 → 502；以及三层超时倒挂（内层 httpx 20s < 外层 25s），而实测真实评分需
  22.5–34.1s → 504。现剥离思维链、并把预算改为 45s / 50s / 锁 60s 严格嵌套。
- **Dify 连续对话上下文**：流式对话此前只把最后一条 user 消息当 query，多轮第二轮上下文全丢
  （7 个应用连续追问全部失败）。本版做阶段一止血——把历史折叠进 query，双重上限
  （最近 4 轮 / 3000 字符），超出从最早一轮整轮丢弃。评分路径保持无状态。
- **用户唯一性**：双字段各命中不同用户时 `or_` 返回多行，`scalar_one_or_none()` 抛
  `MultipleResultsFound` → 500。两处加 `.order_by(User.id).limit(1)`。
- **用户导入**：非法 UTF-8 CSV 与损坏 xlsx 由 500 改为 400 并给出可操作提示；
  非法角色值不再静默降级成 `student`，改为行级 error。
  另补两处（`bda288b`、`bc7b4eb`）：xlsx 内部 XML 损坏抛的是 `ParseError`——它既不是
  `ValueError` 也不是 `OSError` 子类，此前漏在捕获清单外；且文件级失败时缺 `rollback`，
  前面已 flush 的行会被调用方后续 `commit` 写进库，造成「报了错却入库一半」。
- **移动端文章目录**：`SplitPanePage` 堆叠时 `gridTemplateRows` 只有一行却塞两个子元素，
  目录面板被压成 0px 完全不可见。改为两行 + 左侧 40vh 限高可滚
  （需 `alignSelf: start`，否则网格 stretch 会让内部列表仍滚不动）。
- **网关合同测试**：`c3a845a` 把 server 级 `write` 改成 `0` 后合同测试仍要求 `30s`，
  实测已失败。修正期望值并补反向断言。

### 配置影响

生产需要在 `.env` 增加：

```bash
AGENT_TRUSTED_INTERNAL_ENDPOINTS=http://docker-api-1:5001/v1
```

不配置则评分行为与修复前一致（仍 503）。白名单只放这一条，新增需走变更评审。

另有两项部署侧修正：`b6b3eaf` 补上 compose 对上述变量的透传（否则只在宿主 `.env` 里
生效、进不了容器），`6bff788` 修正该提交误删的 `AI_AGENT_MAX_OUTPUT_TOKENS`；
`8a42f22` 把 `REDIS_HOST` 从短名 `redis` 改为容器名 `wangsh-redis-1`——本栈 backend
同时加入 `docker_default` 网络以访问 Dify，而 Dify 也有一个名为 `redis` 的服务，
短名会被抢占，导致连到需要密码的 Dify Redis 并报 `Authentication required`。

### 性能优化（五项）

- **首屏 markdown-vendor 移出静态闭包**（`2a747ee`）：Entry JS 1041.3 KB → 594.2 KB（−43%），
  gzip 317.6 → 186.2 KB（−41%）。根因是两处叠加——入口 `import 'katex/dist/katex.min.css'`
  被判进 markdown-vendor，且 Rolldown 的 `manualChunks` 默认 `includeDependenciesRecursively`
  会把 react、react/jsx-runtime 递归吞进同一 chunk。改为 `output.codeSplitting.groups` +
  `priority`（react 100 > markdown 10）。只改 jsx-runtime 分组无效（实测过）。
- **导出改线程池**（`91cd134`）：pandas/openpyxl 是同步阻塞调用，直接写在 `async def` 里
  会卡住事件循环。实测 3000 行 + 样式：最大停顿 231ms → 47ms（5x）。
- **agent_analysis 加 LIMIT 5000**（`91cd134`）：原本 `content`（TEXT）数万条全文进内存，
  再 join 成字符串翻一倍。改为 `ORDER BY created_at DESC LIMIT 5000`，取回后 reversed()
  恢复升序，下游时间线语义不变。
- **学生端 `/classroom/active` 批量取作答**（`91cd134`）：原本每活动一次往返，
  改为 `IN` 一次查回。
- **SSE 连通后停轮询**（`2a747ee`）：`ClassroomPanel` 的 3s 轮询原本无条件启动，
  SSE 连上后仍在跑——一节课 45 分钟 × 每生 3s ≈ 每生 900 次请求。改为收到 `connected`
  停轮询、`onerror` 恢复。

### 前端体验（S5 三项重开发）

`9f84619` 大回滚删掉的三项，本版按当前代码状态重新实现（不是恢复原样）：

- **语义色彩 token 体系**（`2e5d002`）：新增 `frontend/src/lib/cssTokens.ts`，把
  `--ws-color-*` 解析成 TS 可用的具体色值，供 ECharts Canvas 等拿不到 CSS 变量的场景使用
  （`fillStyle = 'var(--ws-color-*)'` 会静默失败变黑，是踩过的真实坑）。配 2 个测试，
  其中 contract 测试守 TS 常量与 `index.css` 的一致性。
- **内容运行时懒加载**（`2e5d002`）：KaTeX / highlight.js / Mermaid / D3+Markmap 从
  `index.html` 的 7 个 `<script defer>`（gzip ≈1.37MB）改为 `contentRuntimeLoader.ts`
  在首次真正渲染时按需注入。首屏静态脚本请求 7 → 0。
- **AI Partner 独立入口**（`2e5d002`）：Caddyfile 为 `/games/ai-partner` 加了独立
  `try_files` 条目，该路径不再落到主 SPA 的 `index.html`，而是返回自己的
  `index.html`（实测 522B vs 主站 1508B）。
  注：此项只覆盖 `/games/ai-partner`，**不涉及** `/docs/` 等其它目录——
  `/docs/` 仍由 SPA 回退（实测返回 1508B，与 `/` 相同）。

### 工程治理（`9cdb9cd` 等）

governance errors 5 → 0，四项历史债务真正拆分而非登记豁免：

- `_apply_valid_import_rows` complexity 16 → 拆出 `_prepare_import_context`
- `build_assessment_export_xlsx` complexity 35 → 拆成 3 个辅助函数
- `course_selection_workbook.py` 706 行 → 抽 `workbook_types.py`，降为 617 行
- `selection_rules.py` 759 行 → 抽 `selection_capacity.py`，降为 680 行
- `matches_trusted_endpoint` complexity 18 → 拆出 `_parse_trusted_candidate`

### 已知局限

- Dify 连续对话只做到阶段一：每次仍是全新 query、不带 `conversation_id`，
  Dify 后台会话列表与统计会碎。终态方案见
  Dify 缺陷修复计划（正文已清理） 的阶段二。
- 双字段冲突只提示 id 最小的那个字段，不是精确语义（代码注释已说明取舍）。
- `docs/features/ASSESSMENT.md:74` 的 head 仍是过期的 `20261020_0001`，未在本版订正。

### 验证

- 本地门禁：根脚本 89 passed、文档合同 152 files / 703 links、版本一致性 2.2.1、
  compose 生产与 dev 均通过、网关合同 PASS、**governance errors=0**
- 后端：`tests/users` 36 passed、`tests/ai_agents` 350 passed、`tests/ai_partner`
  121 passed / 1 skipped、`tests/xbk`+`tests/assessment`+`tests/classroom` 合计
  **1755 passed / 125 skipped**（2026-10-29 实测；此前记的 1997 无法复现，已订正）
- 前端：`tsc --noEmit` 0 错误、`token:check:ci` 0 undefined / 2077 引用、
  S5+性能新增测试 52 项通过
- **生产部署**（2026-10-28 23:39）：六镜像 linux/amd64，digest 与 release-set 一致；
  `/api/health` 返回 `version=2.2.1`、`status=healthy`、database 与 redis 均 healthy；
  8 容器全 healthy；433 用户 / 55 表与部署前一致
- **评分链路 L3**（2026-10-29）：临时容器挂载修复代码 + 生产 env/网络跑真实评分两次，
  34.1s / 24.8s 均成功（total=51 / 36）。修复前同样调用分别止步于
  `JSONDecodeError`（502）与 20s `ReadTimeout`（504）
- **服务器 L3 仍待验证**：连续对话追问、SSE 80s 长连接

---

## v2.2.0：代码审查瘦身、热点归类与使用记录详情（2026-10-26 20:52 部署）

六镜像已发布并部署到生产（`/api/v1/health` 返回 `"version":"2.2.0"`、`environment: production`）；
源码标签 `2.2.0` 指向 `62d3976`（发布提交 `af8caec`）。部署准备与风险见
部署准备清单（2026-10-26）（正文已清理），发布后遗留项见
遗留待办（2026-10-27）（正文已清理）。

### 代码审查与瘦身（`cd868f8`）

- 删除 10 个零引用函数（`check_and_auto_end`、`analyze_fill_blank_stats`、`_build_dify_progress_log`、`_nonempty_chunks`、`call_llm_stream`、`cluster_terms`、`_parse_int`、`set_print_a4_landscape`、`_call_dify_stream`、`_call_openai_compatible_stream`），`llm_agent_base.py` 250→175 行；本批改动（含热点归类）累计 69 个文件，其中已跟踪部分净删 1,983 行。
- 三份重复的 LLM 调用合并为统一 `call_llm()`，抽出 `core/sse.py` 与 `xbk/import_errors.py`。
- 复杂度：`submit_answer` 复杂度 40→4、行数 222→44（抽出 `question_picker.py`）；前端 `Xbk/index.tsx` 1997→1279（抽出 `columns.tsx`、`XbkFilterBar.tsx`），GroupDiscussion 抽出 `DiscussionToolbar.tsx`。
- 性能：分类列表 SQL 7→3 次；echarts 改为按需注册，构建产物 1,035,150 B→584,082 B（省 43.6%）。
- 回归修复：echarts 按需注册先后漏 `RadarChart`/`RadarComponent` 与 `SVGRenderer`（雷达图空白、`var(--ws-*)` 失效导致全图全黑）；Reader 截断提示误放进目录大纲 Tab。

### 热点问题按教师提问逐条归类（`4ea3d69`）

即历史记录中的热点问题按教师提问归类（正文已清理）与
热点结果时间视图（正文已清理）两节所述内容（均记于 2026-10-24），本次随 2.2.0 发布上线；
多轮投票（默认 3 轮、上限 5 轮、一致率不足 2/3 标为待确认）也在发布代码中
（`hot_agent.py` 的 `VOTE_ROUNDS` / `merge_votes`）。
另修复验证中发现的教师提问编号重复（自动识别与手填各占一个 Tn）与分析详情接口 500
（ORM 对象写入 Redis 后无法通过响应校验）。

### 使用记录详情与入口嵌入式样式（`02805bc`、`76cb9c3`）

- 智能体使用记录详情：学生/智能体信息并排、窄屏纵向；对话按问答分段，回答支持 GFM Markdown；加载失败可回退到记录中保存的问答；空态区分加载失败/无搜索结果/暂无数据。
- 首页五个模块入口同排、信息技术入口两列，去掉胶囊底色、边框与阴影；加载骨架同步新布局。`76cb9c3` 把骨架屏硬编码像素改为 Tailwind 刻度以通过 ui-audit 门禁。

### 数据库与 CI

- 新增迁移 `20261026_0001`（`20261026_0001_idx_classroom_plan_items_activity`）：为 `znt_classroom_plan_items.activity_id` 建索引，服务 `ON DELETE CASCADE` 级联路径，60k 行基准 1.722ms→0.662ms。生产该表为 0 行，建索引毫秒级完成。升级后 head 为 `20261026_0001`。
- `448aa98` 让 CI 真正执行并发/迁移/token 轮换/KNN 采集等 118 个此前一律 skip 的用例（开启 `TEST_DATABASE_URL` 后 260 passed / 61 skipped）。
- 版本号六处配置同步到 2.2.0；`workflow-contracts.test.mjs` 漂移用例改为由当前版本派生 `${sourceVersion}-drift`，不再硬编码版本号。

### 验证与部署

- 发布前：后端 3646 passed / 123 skipped / 0 failed（专用测试库 + `alembic upgrade head`）、前端 779 passed、`tsc` 与治理 errors=0 通过；`ci-quality`（`0f2df61`）与 `markdown-quality`（`62d3976`）通过。
- 部署（2026-10-26 20:52，192.168.5.3）：六镜像全部切到 2.2.0 且 digest 与 Docker Hub 一致；迁移执行到 `20261026_0001`，索引已建成；数据 321 用户 / 3 文章 / 9 智能体与部署前一致；首页、信息技术、使用记录三页实测无溢出、无 console 错误；服务器旧镜像已清理。

> 待补：2.2.0 的 release-set 文件名与 SHA-256、六镜像 digest 对照表、部署前备份与离机证据目录，
> 本轮未能从仓库记录中核实（本地 `.codex/releases/` 已于 2026-11-01 清理），不在本文补写。
> 另：仓库有 git tag `2.2.0`，但 GitHub Releases 中没有 v2.2.0 发布页（`gh release view v2.2.0` 为 not found）。
