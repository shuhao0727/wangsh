# 2026-11-02 仓库整理批次记录

> 状态：archived
> Owner：testing
> 最近复核：2026-11-02

按 backend → data/docs/frontend → 根目录/scripts → gateway/scripts 的顺序整理了整个仓库。
本页保留各批次实际执行过的检查与结果，供追溯；当前状态见
[TEST_STATUS.md](../../testing/TEST_STATUS.md)。

## 总体验证矩阵（各批次共同的收口）

| 检查 | 命令 | 结果 |
|---|---|---|
| 后端全量 | `venv/bin/python -m pytest -q tests/` | 3602 passed / 243 skipped / 0 failed |
| Python 治理 | `check_python_governance.py check` | errors=0 |
| 迁移守卫 | `check_migration_guard.py` | 通过（50 文件） |
| 迁移链 | `alembic upgrade head`（空库） | 50 个 revision 全部成功 |
| GET 扫雷 | `smoke_openapi_sweep.py` | 97 端点：95 OK / 2 预期 401 / 0 fail |
| 核心 CRUD | `smoke_feature_suite.py` | 38/38 |
| 前端类型 | `npm run type-check` | 通过 |
| 前端测试 | `npm test` | 828 passed（110 文件） |
| 前端脚本 | `npm run test:scripts` | 34 passed |
| 前端 lint | `npm run lint` | 0 error（476 存量 warning） |
| 根层合同 | `node --test scripts/*.test.mjs` | 100 passed |
| gateway 合同 | `test_caddy_config.sh` | PASS（含 `caddy adapt`） |
| 文档门禁 | `check-markdown-contracts.mjs` | 0 missing |
| 版本/env 一致性 | 两个 check 脚本 | 通过 |

## backend（2026-11-01 夜）

删除死代码：`cross_system_service.py` 空占位模块、`xbk/data.py` 20 行兼容桥、
`providers/compat.py`（并入 registry）、`CACHE_IMPLEMENTATION.md`、5 个零引用
classroom schema、6 个未调用函数/常量。合并 `_unique_sheet_name` 两处副本到
`exports/common.py`。治理基线移除 9 条失效条目、下调 8 条 ceiling。精简 4 个未使用
依赖（passlib / argon2-cffi / sse-starlette / email-validator），bcrypt 改为显式声明。
`.dockerignore` 补 3 项。

## data / docs / frontend（2026-11-02）

- **data/**：补 `data/uploads`、`data/pythonlab/workspaces`（compose 声明但缺失，
  此前由 Docker 以 root 自动创建）与 `.gitkeep`。
- **docs/**：修 `DEPLOY.md` 指向已删 lucid 工作树的启动命令、`TEST_STATUS.md` 自相矛盾、
  `project-consolidation.md` 工作树表、`RELEASE_NOTES.md` 工作树描述、
  `DIALOG-AND-BREAKPOINT-GUIDE.md` 8 条偏移 3 行的断点行号；14 份文档补状态/Owner。
- **frontend/**：删 793 行零引用死页面 `pages/Admin/Categories`（`cba3c0e` 回退残留）、
  零引用 `AIAssistantModal`、`services/znt/index.ts` 空 barrel、`Admin/Users/data.ts`
  四个零引用导出。合并 `Experiment/ToolItem/ResourceItem`（ai/agents 两份 → shared-types）、
  `asApiError/toDetailMessage`（三份 → assessment/errors.ts）、`TabKey/SectionKey`（三份）。
  移除冗余 `@types/dompurify`。

## 根目录与 scripts（2026-11-02）

- `.gitignore` 的 `data/` → `data/*` + `!data/.gitkeep`（原写法无法重新包含目录内文件）。
- `.codex/AGENTS.md` 的 `../../CLAUDE.md` → `../CLAUDE.md`（原路径解析到仓库外）。
- 删除 `frontend/.codex/` 空目录树。
- `pull_request_template.md` 的脚本路径补 `backend/` 前缀。
- 两个 pythonlab gate 移除指向已删 workflow 与 `endpoints/debug/**` 的触发路径。
- `ci-quality.yml` 补入 `start-dev-processes.test.mjs` 与 `test_caddy_config.sh` 的 `bash -n`。
- `deploy.sh` 补 `cd "${repo_root}"`（三处相对路径从其他目录调用会失败）。

## gateway 与 scripts（2026-11-02）

- `Caddyfile` 的 `@api_stream` 补 `/api/v1/classroom/stream` 与
  `/api/v1/ai-agents/group-discussion/public-config/stream`。前者前端实际订阅，
  漏掉会落到 30s 写超时 transport，SSE 在 keepalive 之外被切断。
- `test_caddy_config.sh` 补反向合同：从 `frontend/src` 提取 SSE 订阅路径逐一校验，
  已用「故意删掉白名单条目」验证断言有效。
- `xbk/common.py` 合并 `_list_items`；`migrate-db.sh`/`rollback.sh` 的容器存活判断
  改用 `compose ps --status running`；`scripts/README.md` 与 `deploy.sh` 的文档引用修正。

## 未采纳的判断

- `echarts-wordcloud` 无 import 但被 `workflow-contracts.test.mjs` 的 peer 版本合同约束，
  且后端确实产出 `word_cloud` 数据。
- `ml/` 的 `Experiment` 已与 ai/agents 分叉（多数据集字段），不并入共享类型。
- `get_ip_binding_strict`、`require_user_sse` 是与同族 API 对等的预留，非死代码。
- `check-markdown-contracts.mjs` 用 `process.cwd()` 定根是有意的——测试依赖把脚本复制到
  临时 fixture 后以该目录为根。
- `compose()` 在 deploy 与 rollback/migrate 之间的差异是发布版本注入 vs 裸调用。

## 同日高优先级审查修复（未提交、未发布）

对象 `/Users/wsh/wangsh`、`codex/review-priority-fixes`、`3d05b08` 加原整理和修复差异。
前文的全量后端、CRUD、运行时、前端和 Caddy adapt 仅是更早快照，不能当作此分支重新执行。

- 备份父子脚本的真实组合使用 fake Docker、临时独立 cwd/同名诱饵配置：先红，固定调用方
  显式路径后通过。独立复核又发现 `${PWD}` 展开随 cd 变化，新增返回95的反例后，固定为
  Compose 文件父目录，3 项路径合同再次通过。release-set、restore 参数及自调用保持绝对锚点。
- 开发配置 6 项初测为2过4失败；修复缺 dev 禁回退、最终值检查、默认上传/PDF与模板后通过，
  加实际 Compose wrapper 的选择器清除合同。旧 `.env.dev` 未改，不自动搬迁或删除上传文件。
- 进程专项先缺 helper 红测；24项绿后补 `fcwd` 与 reload 父消失边界为28项。所有 subprocess、
  signal 和 sleep mock；不是实际停止服务。独立审阅再发现 macOS comm 为真实解释器、argv 为
  含空格 venv 别名的漏判，补完整文件归属/同一解释器证明及3例后31项通过。Node 启停合同
  覆盖无进程状态、失败退出和共享解释器。
- 环境 checker 合同先23项3过20失败；canonical 服务选择/真实路径/有效覆盖后23项绿，
  补固定 PWD 与显式本地 Docker 目标回归后24项绿。mock canonical 不等于验证了 YAML 解析器。
- 容器 guard 先12项红，完整 fake CLI/共享 helper 集成后25项通过；仅 check，无 remove 接口。
- 后端端点专项核心红测17项（子断言35失败、6错误）；实现异步 await、固定日志后补边界，
  19项通过。`env -i`、`-I -B -S` 自含加载真实目标源码，导入前禁真实配置/网络/DB/子进程。
- 网关真实旧配置反例 `500000000 < 526385152` 先失败；38项纯静态合同全过。保留16MB及30s，
  不执行完整 shell 的 Docker 阶段，也未验证上传端到端。
- 根层合同首轮133/134，唯一失败为当前文档派生链接统计；更新当前值并完成新增CLI用例后，
  `node --test scripts/*.test.mjs` 149/149。Python治理 errors0/warnings41（365文件、2140函数），
  迁移守卫50文件通过；没有修改治理baseline或运行数据库迁移。
- 本机 Compose 5.6.0 真实 `config --format json`：先因临时 HOME 不含插件发现失败，定向链接
  已安装插件后，两份复制Compose+合成env的local/docker checker通过；实际 setup函数在临时根
  以含特殊字符的合成口令通过dev-only核验并创建预期临时目录。没有 daemon、业务数据或真实env。

2026-11-02 订正：前文“SSE业务间隔受transport写超时切断”不准确。transport write约束向上游
写请求，活跃SSE响应不受server idle的keep-alive等待期限回收；本批只订正说明，不据此改正确配置。
部署、迁移、远端CI、实际进程/容器归属、浏览器和生产均未验，最终当前结果仍由TEST_STATUS维护。

### 阶段 A 代码复核（同日）

复核本批 36 个修复文件及直接调用方，不重审上一会话整理改动。确认并修复：停止入口
`--all` 会继承外部 `COMPOSE_PROJECT_NAME`/`COMPOSE_FILE` 等选择器且未带开发 env，新增
`stop_dev_compose`/`stop_prod_compose` 与两项 fake Docker 合同；首轮实测抓到 bash 3.2
在 `set -u` 下展开空数组报 unbound，修正后通过。同步 DEPLOY 的游戏预算（526385152
字节）与开发连接口径（127.0.0.1:5433 / 容器内 postgres:5432），部署入口缺开发 env 时
提示 `.env.dev.example`；启动脚本剩余两处宽泛 `pgrep` 状态判断改为具体 PID 与共享守卫。
延迟记录 2 项 P3：`migrate-db.sh` 相对路径锚点未统一、进程查询失败时状态显示“未运行”。
复核后根层合同 151/151，脚本语法与 `git diff --check` 通过；无未解决 P1/P2；原暂存
差异 SHA-256 未变。未启动服务、数据库或浏览器。

### 阶段 B 本机真实验收（同日）

Docker 29.8.2、Compose 5.6.0；`.env.dev` 8 项必需值非空，目标 127.0.0.1:5433/development。
首次启动被进程守卫拦下：`LC_ALL=C` 解码中文 cwd 失败，且无关桌面 Node/Python 进程读取
失败会整体中止。修复为 UTF-8/surrogateescape、允许 lsof 非致命 stderr、区分无关进程跳过与
端口选中/本树候选 fail-closed；进程回归 31→35，真实桌面只读扫描 `project_unsafe=0`。

再次启动成功：容器归属检查通过（3 个容器未删除/重建），开发 PostgreSQL/Redis/Adminer、
后端、Celery、Vite 均启动。`/health` 200/healthy、version 2.2.4、environment=development、
database/redis healthy；6608 200；后端实际 `DATABASE_URL` 为 127.0.0.1:5433/wangsh_db；
Chrome 打开 6608 自动进入 `/login`，表单正常、控制台 0 error。`stop-dev.sh --status` 退出 0；
`stop-dev.sh` 停止后 8000/6608 释放；二次启动与健康再次通过；容器 ID 前后一致
（d75a52f0301f / 6a70d5691750 / 21c63b37b3e6），最终停止后端口空闲、容器按默认保留。
按选择未拉取 caddy:2.8.4，未执行 adapt/真实上传，未验证 WebKit、窄屏、登录后业务页、生产。

### 阶段 C 台账核验（同日）

逐项核对 24 行未结事项的当前源码/文档证据，回写唯一台账：D 类 6 行（ASYNC-01/02、
PRIV-01/03、AUTH-02、COMPARE-01、SSE-01）、B 类 12 行、C 类 5 行；A 类本轮无待改代码项。
DIFY-02 核验为首页外部 Dify 服务入口（默认 `http://wangsh.cn:6606`，与前端 WEB_PORT=6608
非同义），按非缺陷关闭。关键证据：混合分析列表未应用 skip、worker 仍 `asyncio.run`、
隐私删除仍返回“所有数据已永久删除”、停用账号 401、对比页 Bloom `||0` 与 `i*3`、学生端
`useAdminSSE` 订阅 `/admin/stream`。未实施 B/C/D，未提交、未部署。

### D 类修复（2026-11-03）

- ASYNC-01：`analysis_async.py` 混合列表改 `union_all` 单 SQL 排序/分页，total 为数据库 COUNT；
  SQLite 合成测试覆盖 skip 与全量总数。
- ASYNC-02：`agent_analysis.py` 新增 `run_analysis_in_fresh_loop`，任务结束/异常均释放 engine 连接池；
  成功与异常释放测试通过。
- PRIV-01/03：`privacy.py` 增加 operation_id、data_scope、REQUESTED/COMPLETED/FAILED 审计；
  删除与完成审计同事务；响应明确只删除两类消息。导出仍内存组装，游标/临时文件/流式未实现。
- AUTH-02：登录支持 include_inactive；凭据正确但停用返回 403“账号已停用”，错误凭据仍 401；
  管理端重新认证仍只接受启用账号。
- COMPARE-01：Bloom 缺失返回 null；时序使用 bucket_start 真实分钟并按最早桶对齐。
- SSE-01：useAdminSSE 增加 enabled；学生端仅 auth.isAdmin() 时订阅管理流。
- 验证：后端定向 pytest 24 passed、前端相关 Vitest 10 passed、type-check 通过、Python 治理
  errors=0/warnings=41（365 文件、2147 函数）。未运行真实 Celery worker、真实浏览器或生产。

## RELEASE-01 门禁修复复验（2026-11-03）

基线 `aafbf3f`，分支 `fix/release-gates`，本轮未提交。发布提交 `189205c` 的远端 CI
`41592108696` 已证实失败：普通治理通过，但相对 `3d05b08` 的阻塞对话复杂度18→20、
认证服务文件行数612→620；前端普通 `npm ci` 因缺少三个 `@emnapi/*` lock 条目失败。
这些失败不以历史本地成功覆盖，2.2.5 tag/镜像保持不变。

### 后端本地修复与实测

- `endpoint_security.py` 统一 Provider 候选地址选择及顺序校验，流式/阻塞调用复用；保留
  请求前硬校验、拒绝与取消传播、白名单/Ollama 例外及既有熔断顺序，不扩充放行规则。
- `auth.py` 两处相同身份字典改共用固定十字段投影，保留登录与 legacy 查询合同；未通过
  删注释、挤空行或提高 ceiling 刷指标。复杂度20→18、文件620→606行。
- 治理普通 check、`--base-ref 3d05b08` 与 `--base-ref aafbf3f` 均退出0：errors=0、
  warnings=41、365文件、2158函数。baseline 文件与修前字节相同，SHA-256 为
  `9c3275bbcd3d19339e59ebef4febb22adccd0eecaf58cbe60c550fcf9ad2e457`。
- 一次性隔离运行器（仓库外）清空继承环境，导入前阻断 dotenv/secrets，强制 Settings
  `_env_file=None`、`_secrets_dir=None`；仅合成配置和内存SQLite，禁真实socket/子进程及
  临时目录外写入。自动pytest插件、conftest、cache禁用，仅显式加载async插件。
- 8文件121 passed：认证字段投影、停用/删除过滤、正确/错误凭据、歧义、运行时替换、
  候选顺序、拒绝后不发HTTP、取消传播、流式、SSRF、Dify和端点分类。相邻健康/运行时
  替换/分类/OpenRouter另26 passed（与前者有重叠，不相加）；隔离违规均为0。
- 首次隔离运行器因pytest临时文件默认写到隔离域外被守卫中止；将TMPDIR固定为本次
  临时目录后同一测试选择通过，未放宽隔离规则。测试使用本机Python3.13，不代表CI的
  Python3.11全套或真实PostgreSQL、Redis、供应商验收。
- 软保存自含回归19 passed；治理fixture回归29 passed（首轮禁自动插件导致1条
  `asyncio_mode` 未识别配置warning；用 `-c /dev/null` 独立配置再跑29 passed、无warning）；
  根层151、网关38、迁移守卫50文件、版本一致性2.2.5均通过，未执行迁移或启动/重启服务。

### 普通pytest与自含入口分离

继续复核被旧治理门禁挡住的后续CI路径，在同一隔离运行器中重现自含端点模块被普通pytest
收集时的19个初始化错误（正常app已导入，不满足其 `-I -B -S` 约束）；这不是端点断言失败。
保留 `repo-config` 原有独立执行19项，仅在 `backend-pytest` 的命令精确排除该单文件，其他
pytest/coverage命令不变。新增workflow合同同时约束独立命令、精确排除与coverage，不能
只排除而不运行。独立19项再次通过，workflow合同60项通过；根层完整合同152 passed / 0 failed。
没有删除用例或放宽安全断言。

### 前端lock与干净安装复验

- 独立前端会话仅写回 `frontend/package-lock.json`；父会话核对实际差异、日志退出码与源码
  哈希。仅新增npm自动解析的 `@emnapi/core@1.11.3`、`@emnapi/runtime@1.11.3`、
  `@emnapi/wasi-threads@1.2.3` 三条，原有800条目均未修改或删除，应用仍2.2.5；npm顺带
  生成的73处dev标记变动未带回。候选与当前lock的SHA-256均为
  `9d414dfe683c98508e960bd805c92212bfcf1e81c273fb0246b731f66427b8ba`。
- Node20.20.2/npm10.8.2、Linux arm64 Alpine：原lock的普通 `npm ci` exit1（完整重现三个
  缺项）；无旧node_modules下 `npm install --package-lock-only --ignore-scripts --no-audit
  --no-fund` 生成缺项，再对最小候选普通 `npm ci` exit0，干净安装736包。没有修改CI安装
  参数、直接依赖、全局registry或项目真实node_modules。
- 后续非root/断网、无真实env/业务数据/socket的隔离源码执行：脚本34/34、主应用
  113文件836 passed、ai-partner4文件55 passed，token0 undefined/2077引用，type-check通过，
  lint0 errors/479 warnings，UI gate通过（860 baseline hits），build:check exit0、预算WARN。
  仅隔离副本生成构建产物，当前前端源码与验证副本逐字节比较一致。
- 脚本首轮被bind目录Git ownership守卫阻断；改用容器内同属主副本后，补齐同一干净
  node_modules再34/34通过。保留两次失败日志，未配置safe.directory或改断言刷绿。
- npm安装报告34项audit vulnerabilities（5 low/11 moderate/18 high）；本轮未逐条定性或
  执行自动升级。构建总JS12.37MB/Monaco3541.7KB告警及Browserslist旧数据提醒仍保留。
- 临时前端证据目录 `/tmp/wangsh-frontend-lock.AKU9df9f/evidence/` 的 `final-summary.json`
  包含逐命令退出码，原lock失败、修复安装、同属主脚本重跑与八项门禁日志均核过；后端
  仓库外临时目录保存隔离运行器、日志与对应源码哈希。临时文件不是长期发布恢复材料，
  关键范围/结果在本节留存，不把未来提交当作已存在的备份。

本轮已知问题本地验证完成，尚未提交/推送；未执行远端GitHub/Ubuntu amd64或后端CI全套，
未启动生产、未重建正式镜像或覆盖2.2.5 tag。RELEASE-01仍保留，等待远端CI及修订候选
release-set、源码/静态产物、配对备份/隔离恢复等准入证据。

### PR首轮远端结果与原子登录替身续修

- 修复提交 `1dc0260` 已推送并开PR。首轮远端5项门禁通过：repo-config、markdown、
  frontend-quality及两项PythonLab专项；后端治理与迁移/bootstrap已通过，pytest为
  3749 passed / 123 skipped / 1 failed。唯一失败用例
  `tests/auth/test_auth_logout_refresh.py::test_login_uses_atomic_refresh_token_issue` 的
  `fake_authenticate` 未接受真实登录端点传入的 `include_inactive=True`，抛TypeError。
- 在原受保护隔离运行器中先单跑该用例，复现同一TypeError（1 failed，隔离违规0）；
  然后仅为替身增加keyword-only `include_inactive=False` 并断言 `is True`。原来用户行锁、
  refresh原子签发、commit=False、发布在commit之后及禁止独立撤销/创建的断言全部保留，
  未修改生产代码、pytest选择或任何门禁阈值。
- 同一隔离环境合跑退出/刷新、登录、认证合同、运行时替换四文件：36 passed / 8项既有
  Pydantic弃用warning，隔离违规0。只有合成settings、内存/替身存储；不连接业务DB/Redis，
  不读取真实env，不代表本次修复的远端全套已通过。按用户授权提交推送到现有PR，等待新CI。
