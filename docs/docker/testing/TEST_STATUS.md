# 当前测试状态

> 状态：active
> Owner：testing
> 当前版本：2.1.4 镜像已发布（服务器尚未部署）
> 最近更新：2026-10-19
> 说明：本文件是当前测试事实的唯一汇总入口；阶段报告只引用本页，不复制新基线。

## 2026-10-19 v2.1.5 发布候选（验证中，服务器未部署）

- **授权与版本：** 用户已授权把已完成的项目整理提交 GitHub 并重新发布镜像。候选使用独立 `codex/release-2.1.5` 分支，版本、环境示例、Compose 默认值、沙箱和发布工作流同步为 `2.1.5`，保留既有 `2.1.4` 正式标签。
- **发布前复核：** 两个 agent 只读复核了前端课程迁移、依赖与动态导入，以及测评计分、smoke 脱敏、清理白名单和 catalog/CI，未发现所查范围内的阻断回归；此前整理验证仍见下一节，不重复计为新发布 CI。
- **当前状态：** 正在构建六个本地候选镜像，准备隔离生产模拟与完整 prod-smoke；GitHub PR 完整质量门禁、正式构建和 registry release-set 校验尚未完成。不执行服务器部署或正常业务数据修改。

## 2026-10-19 项目文件与共享模块整理（整理阶段，本地未提交）

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
