# 当前测试状态

> 状态：active
> Owner：testing
> 最近更新：2026-11-05

本页只维护最近验证；早期整理批次见[归档](../archive/README.md)，未结事项见[唯一台账](../plans/project-consolidation.md)。

## 基线与边界

- 当前源码：本地 `main` 含 2.2.8 构建源 `2d9dda0` 的历史，2026-11-05 推送前联网核对 `origin/main` 为 `a129e14`，同日按授权快进推送到 `759e49a`（2.2.8 审查修复 6 个提交，未打 tag、未部署，推送后 markdown-quality 通过；ci-quality（run 42034193780）**失败**：python governance 报 `dify_test.py::run_dify_test` 复杂度 22 超过历史上限 21（`2d239cf` A-2 新增 3xx 分支引入，提交前漏跑治理检查），pytest 步骤因此未执行，repo-config 与 frontend-quality 通过。`50bb866` 修复并推送：`run_dify_test` 两处相同的成功响应抽为 `_dify_success_response`（22→18）；补跑 `--base-ref a129e14` 又发现 `run_agent_chat_blocking`、`stream_agent_chat` 同因 3xx 分支 18→19，3xx 判断分别并入非 200 处理（`_provider_failure`、既有 `_provider_error_frame`），恢复到 14 与 18；行为不变（阻塞路径另用 400+ 组合与拆分前逐例比对一致），未调整基线。重跑 CI：**通过**（run 42039152655：python governance 两次 errors=0；干净 PostgreSQL 上 pytest 3809 passed / 123 skipped；repo-config、frontend-quality 通过））；2.2.8 构建源与已部署身份见[发布记录](../operations/RELEASE_NOTES.md)。**2.2.8已于2026-11-04部署生产**，六镜像按digest核验、配对备份与隔离恢复通过、专用合成账号部署后双浏览器验收后按精确ID清理。
- 2.2.6的[发布workflow41661803455](https://github.com/shuhao0727/wangsh/actions/runs/41661803455)已成功，六镜像/release-set已发布；2026-11-04联网复核workflow与远端标签。此前“尚未构建”是文档未跟进，现据实际证据订正，不能因此重复发布。
- 生产访问：局域网已停用。本轮经既有 SSH 主机核验，实际外部入口为 `wangsh.cn:6608`（网关 80 映射）；本机 DNS 被代理劫持到 198.18.0.7，按真实地址 153.34.245.40 复测。**6607 为 SSH 端口**（`DEPLOY.md` 与 `~/.ssh/config` 一致；2026-11-05 服务器本机 http/https 探测均无响应，此前"另一套 Next.js 应用"的观察是本机 DNS 劫持期的误判，待 `--resolve` 复测确认）。实际 PG/Redis 为旧发布目录 bind，备用 production 配置命名卷不适用。
- 2.2.8 停流前五项准入均由现场重新核验：release-set 身份、六镜像官方 registry/本地 RepoDigest、纯正式镜像浏览器行为、真实数据目标、回滚配置。服务器直连 Docker Hub 仍超时，按用户本次授权使用发布范围临时 SSH 通道完成官方核验，未改系统 DNS/代理或跳过校验。

## 本轮结果

| 检查 | 命令 / 范围 | 结果 |
|---|---|---|
| 2.2.8 镜像到齐与官方核验 | 服务器 `import_exact_oci.py`、`deploy.sh verify-release-set`、逐镜像 inspect | 六镜像 RepoDigest/amd64 与 release-set 逐条一致；官方 registry 核验 `images=6`；三个经 OCI 原 digest 传输的镜像 `rebuilt=false`/`repacked_manifest=false` |
| 2.2.8 纯正式镜像合成栈 | `wangsh_sim` 隔离栈、回环 16608、原 4 场景 | Chrome 4/4、WebKit 4/4 PASS；`official_runtime_images=true`、无源码挂载、打包源码 hash 与 `2d9dda0` 一致。首两轮失败为本地缺 node_modules 与隔离栈未跑 AUTH 受控迁移，均非产品缺陷 |
| 生产停流与配对快照 | `freeze_and_backup.py` | 网关与三个写入服务按序停止、PG/Redis 保留；worker 活动/保留/计划均 0；pg_dump + `pg_restore --list` 自检；7 个备份文件逐文件 SHA256 记录 |
| 隔离恢复复核 | tmpfs 专用容器、仅内部网络 | 54 表/49 序列/schema/revision/auth/invalid constraints/角色模式时区全一致；Redis 2221 键值与绝对 TTL 0 不匹配；3 份业务归档字节权限属主通过；新代码在恢复数据上 health healthy；`passed=true` 且精确清理 |
| 生产切换 | `start_candidate_production.py`、`open_gateway_verified.py` | 按服务启动，PG/Redis ID/启动时间/挂载不变；运行镜像 ID+RepoDigest、打包源码 hash、`APP_VERSION=2.2.8`、网关健康均通过；`current -> 2.2.8/source` |
| 部署后行为验收 | 专用合成 admin（id 544）、真实 Chrome/WebKit、原 4 场景 | 两浏览器各 4/4 PASS（登录/运行/单多断点/Step/input，输出 8 与 5，结束后 session 0）；随后按精确 ID 撤销令牌、停用并软删除，未改真实用户 |
| 外部入口 | `wangsh.cn:6608` 按真实地址复测 | `/api/v1/health` 2.2.8 healthy、`/login` 200；6607 为 SSH 端口（服务器本机 http/https 无响应），非 Web 入口 |
| Linux DAP通道续修 | 服务器沙箱内监听vs后端宿主候选交叉探针、可信Docker exec修订候选 | 原正式2.2.7 Chrome输入通过/debug3失败；证实宿主loopback不可达。修订后服务器Chrome/WebKit各4/4通过，后端205 passed、JWT/ASGI78 passed/1 skipped/20 deselected；治理0 errors/41 warnings；已随2.2.8正式镜像发布 |
| 2.2.7正式发布 | main5e6c369、tag、[workflow41763078161](https://github.com/shuhao0727/wangsh/actions/runs/41763078161) | 质量与六镜像构建发布成功；清单b694677b…、六镜像registry/RepoDigest/amd64/source hash核准；未停流部署，正式候选DAP失败保留 |
| 2.2.7 PR首轮远端门禁 | ce78e0d、[ci-quality41760578668](https://github.com/shuhao0727/wangsh/actions/runs/41760578668) | 5项通过，backend3766 passed/123 skipped/1 failed：Linux超大header拒绝后peer返回ConnectionResetError，原测试只认EOF；Linux隔离同例先红，等价保留关闭断言后Linux/macOS均10 passed，等待新远端门禁，不改生产附着逻辑 |
| 2.2.6发布身份复核 | `gh run view 41661803455`、`git ls-remote --tags origin`、release-set SHA256 | 构建源c45ad0e、workflow成功、2.2.6标签一致；六镜像清单不变，未重新发布 |
| 本机候选与运行隔离 | 按digest拉取、逐镜像inspect、canonical配置及8容器实际挂载/网络/端口核对 | 六镜像均linux/amd64且Image ID匹配；仅wangsh_sim专属卷、工作区和回环16608；正常开发7容器未变 |
| 生产候选完整smoke | 精确构建源副本、合成空库/凭据、容器loopback本地供应商桩 | **14 PASS/0 WARN/0 FAIL、exit0**；13页UI全通过。首轮12/1/1失败因缺合成供应商/内容fixture，原证据保留；未调用真实模型 |
| 服务器外网现场与配置 | 既有可信SSH、应用Settings+psql交叉核对、worker inspect、实际挂载 | 2.2.2/healthy、AUTH ready、迁移20261026_0001；候选保留真实PG/Redis bind与卷/网络/安全策略，未切换 |
| TTY握手/归属后端回归 | 禁dotenv/外连/真实子进程与conftest的隔离运行器；5文件 | **191 passed**；首段输出保留、HTTP拒绝/残缺/过大header、超时/取消、协议鉴权及exact generation，未接生产 |
| 真实JWT/ASGI撤销回归 | 合成JWT/SQLite ORM/ASGI WS、内存cache | **78 passed / 1 skipped / 20 deselected**；专用Redis未提供，相关分支未覆盖，不计通过 |
| TTY修复前端门禁 | `type-check`、主应用Vitest、PythonLab模块、脚本合同、lint、独立副本build:check | **主应用118文件875 passed，PythonLab56文件295 passed（包含关系）**；脚本39 passed、类型/构建通过；lint0 errors/479 warnings，bundle WARN/约12.37MB；普通及相对c45ad0e治理errors0/warnings41，baseline不变 |
| 修订候选Chrome/WebKit | 最终生产build、原pointer脚本/15s门限、只读修订源码/产物挂载 | **两浏览器各4/4 PASS**：普通debug/多断点/Step/远程input；输出8/5、debug session0。调试input另各1 PASS，ready先于DAP；Chrome诊断0，WebKit debug仍有原有DAP关闭console信息，不称0 error |
| 真实Chrome/WebKit修前失败 | 原脚本、15s完成门限、独立事件与对照 | **历史各1 PASS/1 FAIL**：普通debug缺8、多断点5；terminal0帧、诊断预等附着1.5秒才显示8。原失败保留，不以延迟实验代替修复；原2.2.6正式镜像仍不含后续本地修复 |
| 服务器发布门禁 | 独立2.2.6目录 `verify-release-set`、官方registry独立curl | **阻断**：官方manifest连接超时；不因本机拉齐绕过核验，未改DNS/代理或停流部署 |
| 修复PR远端最终结果 | `e7f122a`；ci-quality41653115601、owner41653115306、PhaseC41653115436、markdown41653115301 | 6项必需检查全部成功，PR已合入ef4d517；不是2.2.6新发布提交的CI或镜像验收结果 |
| 根层合同 | `node --test scripts/*.test.mjs`；临时仓库与 fake Docker/进程 | 本轮152 passed / 0 failed（原151项加自含用例分离合同）；workflow单独60 passed |
| 自含用例收集冲突 | 普通pytest重现19个初始化错误；独立 `-I -B -S` 仍19 passed | 仅在CI普通pytest中精确排除该模块，repo-config独立执行保留；新增workflow合同同时守住两处，未删除断言或扩大排除 |
| 前端干净安装复验 | Node20.20.2/npm10.8.2；原lock普通 `npm ci` 先红、补全后再跑 | 旧800→803条目，仅新增三个 `@emnapi/*`，已有依赖/版本0变化；干净安装736包，exit0；当前lock与已验候选SHA-256一致 |
| 前端本轮完整门禁 | 类型、Vitest、脚本、lint、token、UI、隔离副本build:check | 115文件858 passed、伙伴55、脚本39；type-check通过，lint0 errors/479 warnings，token0 undefined，UI862 hits gate通过/baseline未改；build exit0/WARN，总JS12.37MB |
| 原子登录续修远端结果 | `9a9e54e` 的ci-quality run41636903630 | 后端3750 passed/123 skipped、治理/迁移通过；前端/仓库/文档/PhaseC通过，owner run41636903936在pointer smoke exit1，不因同源另一路通过认定偶发 |
| 调试状态与严格smoke | 真实hook/控制器内存WS20项；Chrome channel与WebKit实际指针点击 | 旧回包覆盖paused等反例先红后绿；两浏览器各2场景通过，精确断点/最终已停止/输出8和5/session0。原helper曾在运行中判PASS，现收紧并保留15s超时、固定错误码摘要；不声称原CI根因已证实 |
| PDF动态求值缓解 | getDocument显式isEvalSupported:false；组件回归2项、合成一页PDF实际渲染 | Chrome/WebKit均1页canvas405×270、pageerror0；不更改PDF.js版本，未重放恶意PDF，不宣称audit清零 |
| 发布提交远端 CI | [ci-quality run 41592108696](https://github.com/shuhao0727/wangsh/actions/runs/41592108696)；`189205c` | **历史失败/阻断**：治理2 errors与前端lock缺项；不以修复候选结果覆盖原构建失败 |
| PR首轮远端CI及续修 | [ci-quality run 41634049631](https://github.com/shuhao0727/wangsh/actions/runs/41634049631)；`1dc0260` | 5项通过，后端3749 passed/123 skipped/1 failed：原子登录测试替身未接受 `include_inactive`；本地先复现同一TypeError，再补显式参数并断言为True，相关4文件36 passed/隔离违规0，待修后远端重跑 |
| 相对基线复核 | `python3 -I -B backend/scripts/check_python_governance.py check --base-ref 3d05b08` | 修前退出 1：阻塞对话复杂度 18→20、auth.py 612→620；本轮修复后普通、`--base-ref 3d05b08`、`--base-ref aafbf3f` 均退出 0 / errors=0 / warnings=41；复杂度回到18、auth.py 为606行，baseline 字节未变 |
| 本轮后端隔离回归 | 临时隔离运行器；认证/登录、运行时替换、阻塞/流式、SSRF、Dify、端点分类 | 8文件121 passed；相邻健康/运行时替换/分类/OpenRouter另26 passed（有重叠，不合并计数）；禁真实env/外连/非内存SQLite，隔离违规0；仅合成数据，不证明真实PG或供应商 |
| 阶段A代码复核 | 本批修复差异及直接调用方 | 无未解决 P1/P2；修复停止入口 Compose 选择器与 bash 3.2 空数组；2 项 P3 延迟记录 |
| 阶段C台账核验 | 24 行未结事项；当前源码/文档 | 完成分类：D 6、B 12、C 5；DIFY-02 核验为非缺陷关闭；A 类无待改代码项 |
| D类修复 | 后端定向 pytest + 前端 Vitest + type-check | 后端24 passed；前端相关10 passed；type-check通过；PRIV导出流式边界未实现 |
| ai-partner 入 CI | `frontend/` 下 `npm run -s test:ai-partner`；`node --test scripts/workflow-contracts.test.mjs` | 55 passed；CI 新增该步骤并由合同断言锁定；此前该套件不在 `npm test` 收集范围 |
| 共享进程守卫 | `python3 -I -B scripts/test_dev_processes.py -q` | 35 passed；所有查询、信号与等待为替身 |
| 本机真实验收 | `bash start-dev.sh` / `stop-dev.sh`；真实 dev 栈 | 通过：health 200 healthy、6608 200、DATABASE_URL→127.0.0.1:5433、浏览器登录页 0 error、停止/二次启动成功、容器 ID 未变 |
| 保存端点软校验 | `backend/` 下自含 `env -i`、`venv/bin/python -I -B -S tests/ai_agents/test_agent_endpoint_warning.py -q` | 19 passed；未导入正常 app/Settings |
| 出站端点硬校验 | `pytest tests/ai_agents/test_agent_chat_contract.py test_chat_stream.py ...` | 流式/阻塞/测试连接调用前统一硬校验；定向 61 + 32 passed；未连接真实上游，白名单外的私网端点会被拒绝 |
| 健康检查脱敏 | `pytest tests/test_health.py`；`check_python_governance.py check` | 9 passed；DEBUG=False 时 detail 只回固定文案，异常原文仅进日志；治理 errors=0 |
| 端点核对脚本 | `pytest tests/ai_agents/test_agent_endpoint_audit.py` | 5 passed；白名单/本机 Ollama/内网/元数据/非法协议分类与出站判定同源，未连数据库 |
| 网关字节合同 | `python3 -I -B gateway/tests/test_caddy_contract.py -q` | 38 passed；526385152B 覆盖后端502MiB；普通16MB、read_body30s保留 |
| Compose 真解析 | 5.6.0，临时 HOME/合成 env/复制的两份 Compose；checker local、docker 与实际 setup 函数 | 通过；只执行 config，无 daemon 操作 |
| Python 治理 | `python3 -I -B backend/scripts/check_python_governance.py check`，本轮含两份 Git 基线对比 | errors=0 / warnings=41；365文件、2158函数（修前2156）；未放宽 baseline |
| 迁移守卫 | `python3 -I -B backend/scripts/check_migration_guard.py` | 50文件通过，未运行迁移 |
| 版本一致性 | `node scripts/check-version-consistency.mjs` | 发布准备2.2.6通过；lock根版本同步，is-docker元数据恢复为已装包/同integrity tarball实际2.2.1，其他依赖不升级 |
| 2.2.6干净安装尝试 | 合成目录、Node20.20.2/npm10.8.2普通npm ci，未触碰项目node_modules | 两次分别ECONNRESET与registry.npmjs.org元数据EIDLETIMEOUT；属下载失败，未记通过。后续必须由发布workflow的质量门禁验证，不关闭TLS/不放宽安装参数 |
| 审计决策批次（D1/D3/D6/D9/D12/D13/D14/A-01/A-07） | 定向 pytest、node 合同、compose 渲染、文档门禁 | 计分修正后 `tests/assessment` 等 **249 passed / 20 skipped**；治理 errors=0/41 warnings；根合同 **91/91**；`docker compose --env-file .env.example` 生产/dev 渲染均 exit 0（空值回归已修，见下）；版本一致 2.2.8；烟测 404 判定测试 4/4。**门禁顺序**：运行 pytest 会生成 `backend/.pytest_cache/README.md`，须先删除该目录再跑 `check-markdown-contracts`，否则误报（见独立审查 R-05） |
| 真实 prod-smoke（2.2.8 正式镜像合成栈） | `wangsh_sim` 隔离栈、回环 16608、容器 loopback:11434 合成供应商桩、`ANALYSIS_AGENT_ID` 指定桩智能体 | 两轮：①无桩首跑 **11 PASS/2 WARN/1 FAIL**，唯一 FAIL 为 group-discussion（活动智能体未配置 API 端点，503，属环境夹具缺失），FAIL 时 `test-results/prod-smoke/failures.md` 写入 1239B；②补桩后重跑 **12 PASS/2 WARN/0 FAIL、exit 0**，`failures.md` 不生成——**D13 FAIL/非 FAIL 双分支均经真实运行确认**。2 WARN 为两个只读端点 401 与内容/书籍夹具缺失（与历史一致）。用毕 8 容器/4 卷/网络/工作区精确清理，开发栈 7 容器未变。既有缺口：`deploy.sh simulate` 的 `run_sim_deploy`/`run_sim_compose` 未传 `REDIS_HOST`（模拟项目 redis 容器名为 `wangsh_sim-redis-1`），本轮以环境变量覆盖，登记为 OPS-06 |
| PYLAB-02 多人同时调试（`98f1c46`，已推送） | 开发容器 worker 内 provider 层真实 Docker，2.2.8 沙箱镜像，两名合成用户；`pytest -k 'pythonlab or sandbox'` | 修复前：u990001 成功、u990002 `port is already allocated`。修复后（宿主端口由 Docker 分配 + debugpy 只听 `127.0.0.1`）：两者同时启动，宿主端口 54831/54854，各自 DAP `initialize` success=True，容器内仅 `127.0.0.1:5678` 监听；pytest **472 passed / 60 skipped**。合成容器、工作区与归属记录已清理。开发栈端到端（2026-11-05，重建后沙箱镜像 2.2.8，两个合成学生账号）：两人同时跑 `smoke_pythonlab_dap_step_watch_soak.py` 各 **6/6**，最多同时 2 个 debug 容器、宿主端口不同且只绑 `127.0.0.1`；owner 并发 matrix（steal）与 print 可见性 smoke 均 exit 0，无残留容器。**未覆盖**：两个真实浏览器同时调试、生产验证 |
| 2.2.8 审查修复（`d6375a3`/`199c5e9`/`2d239cf`/`0fa64ca`，已推送） | `pytest tests -p no:cacheprovider -k 'ai_agents or pythonlab or sandbox'`（排除自含模块）；自含离线回归；前端 type-check、AIAgents vitest、eslint；`node --test scripts/*.test.mjs` | SSRF-FLOW-01 新增 13 条、A-1 新增 6 条、A-2 新增 7 条（含 Dify 双候选）全部通过；所选范围 **870 passed / 60 skipped**（跳过项为其他文件的隔离 bootstrap 要求）；自含 19 项 OK；前端 2 文件 4 例通过、lint 0 error；D-R2 合同测试实际执行 guard，6 种变异全部被拦。SSRF-FLOW-01、A 组（A-1/A-2/FE-TEST-01）、D-R2 独立审查均通过。开发栈（合成管理员 + 容器内 `127.0.0.1:11434` 合成供应商桩）API 层 **8/8**：测试连接成功、302 不跟随（桩只收 1 次请求、不回显响应体）、学生流式 200、flow 测试连接学生 403 且不出站；Playwright Chromium 两处管理员页失败/成功显示正确，只测不保存。**未覆盖**：生产 feature flag 与在用端点的出站核对（发布前） |
| 文档门禁 | `node scripts/check-markdown-contracts.mjs`、Markdown合同、`git diff --check` | 2026-11-05 2.2.8 审查修复执行中 116 files / 740 links / 0 missing；历史2026-11-05审查落账后116/738、台账重审后115/730，2026-11-03为109/702，2.2.6批次110/709、部署前110/713、2.2.8部署后111/720、四方对齐后112/724、清理后113/725。新增后门事件记录后更新当前派生计数，不覆盖历史 |
| 脚本语法 / 差异 | 已改 shell 的 `bash -n`、Node `--check`、`git diff --check` | 通过 |

根合同首轮为133/134：仅文档派生链接数过期；更新当前统计后全量复验通过。后续增加容器CLI等合同后为151项，未删除失败断言刷绿。
真实 Compose 合成验证首轮因临时 HOME 缺插件发现失败；定向挂入本机既有插件后，同一合成输入的local/docker均通过，未更改用户Docker设置。
本机真实验收首轮被进程守卫拦下：macOS `LC_ALL=C` 解码中文 cwd 失败且无关桌面进程读取失败会整体中止。修复后真实桌面只读扫描通过，再启动/停止/二次启动均成功。

## 未验证与保留项

- **2.2.8 已部署，但未做**：长时间运行观察、真实课堂并发、回滚/生产恢复脚本实际触发（隔离恢复已验证，二者不混记）；真实供应商、生产恢复演练与广覆盖业务仍未验。
- 依赖分类已复核：34为受影响包条目（5low/11moderate/18high），不是34个独立漏洞；完整锁另含未安装optional链而为37项/含1critical。PDF eval路径已最小缓解，其余按生产浏览器/Node/构建条件记录、仍待兼容升级或显式风险取舍；不以未证实利用链等同安全关闭。
- 2.2.8 合成栈仅用专用合成账号、wangsh_sim 专属 PG/Redis 卷/网络/workspace；backend 只读修订源码、frontend 只读修订生产 build，不改正式镜像。8容器/四卷/网络已精确收尾、动态沙箱0，正常开发7容器未变，证据保留。
- 原生显式上传目录保留；旧文件未搬迁、未证明自动恢复。进程身份核验非原子，PID复用竞态仍有边界；reload父消失且子残留时保守报错。
- D 类已完成代码与定向回归；PRIV 导出仍为内存组装，未实现游标/临时文件/64KiB 流式发送。B/C 类仍未实施，继续保留在台账。

发布行为与配置合同分别见[发布记录](../operations/RELEASE_NOTES.md)、[部署指南](../operations/DEPLOY.md)；2.2.8 详细证据见[批次记录](../archive/testing/2026-11-04-release-228.md)，2026-11-04 及更早结果仍为对应批次历史，不代表本轮重跑或生产生效。
