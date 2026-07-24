# 当前测试状态

> 状态：active
> Owner：testing
> 当前版本：1.6.0
> 最近更新：2026-07-24
> 说明：本文件是当前测试事实的唯一汇总入口；阶段报告只引用本页，不复制新基线。

## 一、当前未提交整理批次

本节只记录当前 dirty worktree 的最后一次验证快照。远端 GitHub Actions、生产模拟和
Docker Hub 发布仍对应 `origin/main`；文档或代码继续变更后，必须重新执行对应门禁。
历史发布快照见第三节，不能与本节合并理解。

| 类别 | 当前结果 | 覆盖内容 |
|---|---|---|
| 后端全量 | `718 passed, 1 skipped, 9 warnings` | API、服务、迁移、脚本与核心业务回归；唯一 skip 是专用测试库保护 |
| 前端全量 | `76 files / 371 passed` | 组件、页面、状态与工具函数回归，包含 `src/lib` 运行时边界和 Assessment 静态新建路由 |
| Assessment | `38 passed, 6 warnings` | 画像班级隔离、会话、配置和课堂联动 |
| GroupDiscussion | `53 passed, 8 warnings` | 会话、成员、消息、权限、业务时区、并发冲突回退和原子切组 |
| IT 游戏 | `40 passed, 8 warnings` | 上传事务边界、更新校验、路径安全、并发删除下载、Range、客户端 IP、日志和路由契约 |
| prod-smoke 系统测试 | `11 passed` | Compose 上下文、脱敏、私有权限和缺失 UI 报告失败传播 |
| 前端脚本 | `29 passed` | UI smoke 页面/总控状态、前后端构建上下文、token、Pyodide、Git 白名单和最终产物合同 |
| 前端 clean install | 通过，`779 packages` | `npm ci --ignore-scripts` 使用当前 lockfile 完成真实干净安装 |
| Workflow contracts | `54 passed` | 发布、CI、Compose 时区、开发启动、破坏性命令保护、回滚、健康状态、release-set 和 XBK seed 合同 |
| TypeScript | 通过 | `tsc --noEmit` |
| ESLint | `0 errors / 480 warnings` | 现有 warning 基线，无阻断错误 |
| UI audit | 通过，`805 hits` | 当前审计基线未回退 |
| 生产构建与 bundle | 构建通过；`282 files / 29 MB` | Mindmap 本地运行时已从输出移除，正式字体与 favicon 保留 |
| Python governance | `5 errors / 5 warnings` | 当前 AI 长回答功能改动存在复杂度回退；本轮非功能整理未修改相关实现 |
| Markdown 链接 | `104 files / 256 links / 0 missing` | owner、索引、归档和相对链接 |
| Markdown contracts | `10 passed` | 链接、生命周期、Assessment owner 和 workflow 触发 |

### 2026-07-24 非功能文件整理验证

- 后端课堂模块与 smoke 清理定向回归：`97 passed, 8 warnings`；本轮未把该结果写成
  后端全量基线。
- 前端脚本合同：`29 passed`；新增后端 Docker CLI 构建上下文排除和本地 `.codex/`
  Git ignore 回归。
- Workflow contracts：`54 passed`；Markdown 为
  `104 files / 256 links / 0 missing`，合同测试 `10 passed`。
- 7 个维护中的 shell 脚本语法、生产/开发 Compose 配置和 staged/unstaged
  `git diff --check` 均通过。
- Python governance 当前为 `5 errors / 5 warnings`：阻断项位于已有的
  `chat_blocking.py` 和 `chat_stream.py` 长回答功能改动。本轮按非功能文件边界未修改
  相关实现，需在下一阶段单独拆分并恢复 complexity ratchet。

### 2026-07-23 智能体长回答专项

- 后端 `backend/tests/ai_agents`：`62 passed, 9 warnings`；覆盖持续有数据的长流、
  空闲超时、连接提前结束、OpenAI/Anthropic 正常、长度、策略和上下文结束原因、
  Dify 部分输出不重试与终止事件跨分片、DeepSeek Anthropic provider 识别、停用拦截、
  Provider 初始化错误、历史输入边界、当前问题去重、按智能体熔断和阻塞式入口停用拦截。
- 前端 AIAgents：`2 files / 17 passed`；覆盖持续输出、空闲超时、HTTP 502、非流式
  响应、无终止事件、用户停止、导航静默取消、截断终止包和 1000 个高频分片合并。
- TypeScript `tsc --noEmit`、Python `compileall` 和 `git diff --check` 通过。
- Docker 开发栈复核时 backend、PostgreSQL、Redis 均为 healthy；本专项没有调用真实
  外部 AI 端点，因此尚未证明某个具体供应商的账号额度或模型 token 配置。
- 当前结论：固定总时长导致的长回答中断已在代码和本地 stub 回归中修复；真实供应商
  若返回 `finish_reason=length`，系统会明确提示输出长度上限，而不是误报完整成功。
- Docker 开发栈完成真实 HTTP + SSE stub 闭环：管理员登录 `200`、临时智能体创建
  `201`、完整接收 `80000` 字符和 `message_end`、历史缺少本轮问题时只追加一次、
  停用后未再次调用 Provider、客户端 system 历史返回 `422`，临时智能体硬删除 `200`。
- 真实 DeepSeek Anthropic 兼容端点使用 `deepseek-v4-flash` 完成一次受控长流测试：
  `52.661s` 内收到 `3519` 个文本分片、`7063` 个字符，首包 `7.47s`，最大分片间隔
  `0.163s`。上游最终返回 `stop_reason=max_tokens`，WangSh 正确转换为
  `output_limit_reached` 并保留已生成内容；API 密钥仅通过进程 stdin 注入，未写入
  仓库、数据库或测试报告。

- Mindmap 第三方运行时的字体、SVG、图片和打包 JS 保留在当前开发机，但整个目录同时
  排除 Git 和 Docker 构建上下文；Vite 生产构建结束后删除输出中的本地副本，生产
  Caddy 对相关路径明确返回 `404 + no-store`。正式 KaTeX 字体和 `favicon.svg`
  继续保留，不使用会误伤功能资源的全局扩展名规则。当前 Git 索引中的上述静态扩展名
  只剩 `frontend/public/favicon.svg`；生产构建中的 `59` 个 KaTeX 字体和 `1` 个
  Monaco codicon 字体来自正式依赖，不是需要提交的本地第三方目录。`test:scripts`
  会阻止白名单外的高风险静态扩展进入 Git，`build:check` 会直接检查最终产物中的
  favicon、正式字体和 Mindmap 缺失状态。
- Mindmap 用户端和管理端在生产环境均阻止新建/编辑，不会先创建不可编辑记录；已有导图
  统一使用内置查看器只读预览。开发环境仍可在本机运行时存在时使用旧版编辑器。
- 日志脱敏已覆盖 FastAPI、Celery、标准 logging、Loguru、异常链、camelCase 字段、
  多层 JSON 转义、`stacklevel` 调用来源，以及 PostgreSQL、Redis、AMQP/Celery DSN
  的 URL userinfo 密码，专项测试 `25 passed`。
- GroupDiscussion 创建和默认列表使用配置的业务时区，无效 IANA 时区在配置加载期失败；
  `joined_at`、切组冷却和 recent-hours 继续使用 UTC。生产和开发 Compose 均向
  backend、Typst worker、PythonLab worker 显式传入同一 `TIMEZONE`/`TZ`，PostgreSQL
  开发配置同步使用该值；默认值和 `America/New_York` 自定义解析均已验证。
- Docker 开发栈完成 IT 游戏真实 API 闭环：管理员登录、ZIP 上传、空分类更新 `422`、
  分类读取、完整下载、`206 Range`、下载计数、可信代理客户端 IP、管理员日志查询和
  删除清理均成功。上传响应中的 `created_at`、`updated_at` 可直接序列化，下载文件
  SHA256 与原文件一致；后端热重载后的日志未再出现 `MissingGreenlet`、traceback
  或新 5xx，测试分类和游戏记录已清理。
- Assessment 公共画像入口的真实 PostgreSQL 临时 schema 回归只允许安全测试库；
  优先读取 `TEST_DATABASE_URL`，没有专用测试库时明确跳过，不接触业务库。本轮另建
  随机命名的 `wangsh_test_*` 专用数据库执行 Assessment `38 passed`，完成后已删除。
- 详细健康检查要求 HTTP 2xx、有效 JSON 和顶层唯一 `status=healthy`；默认回滚先记录
  并停止三个写服务，再在无写入窗口中备份和 downgrade。停止或备份失败时不 downgrade，
  并尝试恢复停止前原本运行的写服务；恢复失败会明确要求人工处理。
- 删除 2 个永久 skip 的 XBK 墙钟测试；GroupDiscussion 的纯 skip 占位已替换为
  2 个可执行并发冲突回归，并补充 1 个切组提交失败保留旧成员关系的原子性回归。
- 后端通过数从整理前基线下降，原因是删除 Articles、用户 CRUD 和用户导入中的
  14 个空壳用例；这些用例只断言自建对象、常量或 mock 函数，没有覆盖真实项目行为。
  XBK 对应测试已改为真实端点和持久化回归，3 个 PythonLab 文件仅调整目录归属。
- 又删除 7 个 Typst 笔记/PDF 的自测 mock 空壳；保留缓存、哈希、路径安全和真实服务
  边界回归，不把“调用 mock 自己”计入功能覆盖。
- `down-v`、数据库恢复、回滚、XBK seed 和生产 smoke 的破坏性行为均改为显式授权；
  归档索引草案加入 psql 拒绝执行保护。
- 群体画像测评统计已限制为目标班级学生，避免跨班成绩混入。
- GroupDiscussion 并发创建冲突回滚前会保存旧成员的会话 ID，切组清理不再读取
  rollback 后过期的 ORM 对象；旧成员删除与新成员插入使用同一次提交，失败显式
  rollback，避免 `MissingGreenlet` 500 或提前永久退出原组。
- ClassroomPanel 已按学生用户 ID 做作用域隔离；管理员不再启动学生课堂轮询、计划请求
  或 SSE，账号切换会清理历史答案，旧异步回调不会覆盖新用户状态。
- ClassroomPanel 当前 8 个定向回归除角色和身份边界外，还覆盖同账号活动刷新乱序、
  旧结果失败覆盖较新活动、历史题统计乱序，以及跨账号手动刷新锁隔离。
- 思维导图编辑器的 iframe 数据保存回归仍保留；此前真实 Chromium 结果只证明当前
  开发机的本地运行时可用，不代表全新 checkout 或生产镜像包含该编辑器。
- `frontend/src/lib/**/*.test.{ts,tsx}` 已纳入 Vitest 默认范围，
  `mindmapRuntime.test.ts` 不再被默认门禁遗漏。
- 前端 lockfile 已恢复缺失的 3 个 `@emnapi/*` 可选 peer 条目并按当前 npm 归一化；
  真实 `npm ci --ignore-scripts` 安装 `779` 个当前平台依赖后，前端全量、脚本合同和
  生产构建再次通过，不依赖旧 `node_modules`。
- `backend/scripts` 显式包标记和真实解析路径均有回归覆盖。
- 无真实引用的旧路径 redirect 和重复历史摘要已删除；SSE 恢复资料和学习平台设计
  取舍保留为精简 archive；5 个失效或重复 seed 执行壳
  已删除，AI/Agents 正式课程内容迁移源继续保留。
- 回滚入口已修复函数外 `local` 和 Compose 环境文件传递；UI smoke 的 `skip-*` 动作
  现在记为 `WARN`，不再误计为 `PASS`。
- `prod-smoke` 缺少 `ui-results.json` 时会把 `ui-smoke` 步骤、汇总状态和退出码统一
  标记为失败，并生成私有权限的失败报告，不再出现报告缺失但进程返回 0 的假通过。
- `pull-up/deploy` 在拉取后逐个核对本地镜像 `RepoDigests`；`up-no-build` 也拒绝
  启动与 release-set 不一致的同标签镜像。详细健康检查新增 frontend 和 gateway，
  部署健康入口同时验证站点首页和 API。
- 本批尚未 commit/push；2026-07-24 审计时本地 `main` 与 `origin/main` 提交点一致，
  但工作区仍包含既存 staged、unstaged 和未跟踪修改。远端 GitHub Actions 和已发布
  镜像不包含这些工作区修改。
- Docker daemon 当前可用，开发 Compose 中 PostgreSQL、Redis 和 backend 均为 healthy，
  前端及 worker 正常运行；本轮已完成上述开发栈 IT 游戏端到端。当前工作树已重建本地
  `shuhao07/wangsh-frontend:1.6.0` 的 `linux/amd64` 生产镜像，并在独立 Caddy 容器中
  验证主页和 favicon 为 `200`、Mindmap 路径为 `404 + no-store`，镜像内 `282` 个文件、
  `60` 个正式字体、`0` 个 Mindmap 文件。其余五个业务镜像重建和隔离生产模拟仍未执行；
  Shell 语法、两份 Compose `config --quiet` 及自定义时区解析已通过。

### 2026-07-23 Docker/API/Chrome 续验

- 当前 Docker 开发栈保持 `7` 个固定服务运行；backend、PostgreSQL、Redis 均为
  `healthy`，前端首页返回 `200`，`/health` 返回 `200`，版本为 `1.6.0`，数据库和
  Redis 检查均为 `healthy`。
- 并行定向 API 复验覆盖 AI 会话列表/详情与 usage 分页、Learning
  Progress/Content/Chapter、Mindmap、ML Book 和 Assessment 分页/统计；修复后的
  会话 schema、Assessment 分页上限和首次 progress 默认 payload 均按真实接口合同
  通过，验证时间窗内没有 `500`、`Traceback`、`ERROR` 或 `CRITICAL`。测试账号、
  fixture、refresh token、Redis 会话键和临时工作区已清理。
- 按 `docs/docker/frontend/UI-PAGES.md` 的核心 `44` 个页面族执行系统 Google Chrome
  巡检，实际覆盖 `45` 个 URL 用例（PythonLab 的无参数和带参数入口均单独覆盖）。
  首轮 `43 PASS / 2 WARN / 0 FAIL` 中的两个 WARN 来自刻意使用不存在的文章 slug 和
  信息学笔记 ID，触发页面自身预期的 `404` 日志，不是运行时崩溃；换用数据库中真实
  的文章 `article-1775356082696` 和信息学笔记 `55` 后，两个详情页均为 `200`、无
  console error、page error 或 `5xx`。随后补测 5 个 Task Analysis 页面族，4 个专用
  结果页/新建页直接通过，通用结果页使用旧类型入口时的 `404` 是预期兼容回退，改用
  无类型入口后通过。最终完整路由族门禁为 `49 PASS / 0 FAIL`，另有 1 个额外
  PythonLab 参数化 URL 通过。
- 本轮没有新增仓库脚本、截图或测试结果文件；未执行 commit、push、Docker Hub
  发布、生产部署或数据库备份。
- 本次续作从当前 dirty worktree 重新运行全量门禁，后端为
  `696 passed, 1 skipped, 9 warnings`，前端为 `75 files / 362 passed`，前端脚本
  `27 passed`，Workflow contracts `54 passed`，TypeScript、版本一致性和
  `git diff --check` 均通过；这些结果替代本节更早的定向通过数作为当前全量基线。
- Docker 有状态 smoke 重新覆盖 users、categories、XBK、AI Agent CRUD、Learning
  content/chapter/progress、Mindmap、ML Book、认证 refresh、文章 CRUD、Assessment
  学生答题、Typst 素材上传与异步 PDF、XXJS 导入清理，所有临时记录均由脚本清理。
- OpenAPI 直连 backend sweep 为 `109 OK / 0 WARN / 0 FAIL / 51 SKIP`；维护中的
  Playwright UI smoke 为 `13 PASS / 0 WARN / 0 FAIL`，每页均为 `0` console error、
  page error、failed request 和 `5xx`。缺失的 Playwright Chromium 运行时已安装到
  用户缓存，报告与截图在结论沉淀后从 `/tmp` 删除。
- PythonLab Docker Worker 的 DAP 步进为 `1/1 PASS`，owner 并发自动识别并验证
  `steal` 行为；会话已停止，动态 sandbox/DAP 容器和 `/tmp` 日志均无残留。
- IT 游戏真实 API 重新覆盖 ZIP 上传、列表、分类更新、公开详情、完整下载 SHA256、
  `206 Range`、下载日志和删除，数据库记录与物理文件均清理。GroupDiscussion 重新
  覆盖建组、发消息、管理员读取和批量删除，并修复批量删除成功时 `deleted` 返回
  `null` 的合同缺陷；当前返回数据库实际删除数量，Docker 回归为 `deleted=1`。
- `smoke_full_deploy.py` 的默认健康地址面向生产网关；Docker 开发模式首次使用
  `/api/health` 得到预期 `404`，在任何写操作前退出，改用 backend `/health` 后全绿。
  本轮临时 IT 和 GroupDiscussion stdin 驱动各有一次仅由驱动断言引起的失败，均已
  明确复跑并验证清理，不计为应用失败。
- 最终 Docker backend、Typst worker 和 PythonLab worker 日志窗口没有
  `ERROR`、`CRITICAL`、`Traceback` 或 `5xx`；7 个固定开发服务继续运行，backend、
  PostgreSQL、Redis healthy，前端 `200`。仓库中没有新增 `test-results`、截图、
  JSON/HTML 报告或一次性 `test_*.py`，开发缓存按既定决定保留。
- 最终定向门禁：后端 `115 passed, 1 skipped, 9 warnings`；前端路由与运行时回归
  `7 files / 16 passed`；前端脚本合同 `27 passed`；TypeScript 通过；Markdown
  `104 files / 253 links / 0 missing` 和 `10 passed`；Python 治理为
  `0 errors / 5 warnings`。`git diff --check` 通过，最近 20 分钟的 backend、Typst 和
  PythonLab worker 日志没有服务性错误或 `5xx`，也没有动态 PythonLab 容器或新增
  `test-results` 产物。

### 2026-07-22 Docker 开发模式全功能复验

- 认证：管理员、教师、学生登录及 `/auth/me` 身份核对均为 `200`；匿名访问受保护入口
  返回 `401`，学生、教师和管理员之间的课堂及讨论管理权限边界按合同返回 `403`。
- OpenAPI sweep：super admin 场景为 `100 OK / 5 WARN / 0 FAIL / 55 SKIP`；WARN
  均为需要额外业务 fixture 或具有流式/参数化边界的非阻断项。
- 公开 API：共执行 `35` 次请求，`31` 个 `200`、`3` 个预期 `401`、`1` 个预期
  `404`，没有 `5xx`。
- UI smoke：首次为 `12 PASS / 1 WARN / 0 FAIL`，由 WARN 定位到
  `/admin/assessment/editor/new` 静态路由没有参数、页面却只把 `id === "new"`
  当作新建模式，导致永久加载。修复并增加路由回归后重跑为
  `13 PASS / 0 WARN / 0 FAIL`，全部页面均无 console error、page error、失败请求或
  异常响应。
- Classroom：教师创建并启动活动和计划、学生读取活动并提交答案、重复提交拦截、实时及
  最终统计、结束、重置和删除闭环通过，正确答案未在活动进行中泄露。
- GroupDiscussion：匿名读取公共配置、学生建组/入组/发言、成员权限、管理员查询与删除、
  配置恢复均通过；本轮没有调用外部 AI 端点。
- PythonLab：Docker worker 下真实运行和多断点连续 `Continue` 两个场景 `2/2 PASS`；
  结束后远端会话为 `0`，无遗留动态 sandbox/DAP 容器。
- 文章缓存隔离：真实序列为 `4 -> 0 -> 4 -> 0`，确认有搜索词、不同搜索词和普通列表
  使用独立缓存分区。
- 清理状态：Classroom 活动/响应/计划、GroupDiscussion 会话/成员/消息/分析和
  PythonLab 动态容器/工作区均无本轮残留。临时账号 `24-27` 已按项目语义软删除，
  refresh token 全部撤销；其 `smoke-*` Typst note、asset 和 PDF 已清理。数据库、
  Redis 和 7 个固定开发服务保持健康，本轮 `/tmp` 浏览器/API 证据在结论沉淀后删除。

### 2026-07-18 本地开发模式真实场景复验

- 通过 `bash start-dev.sh` 重新启动本地开发模式：FastAPI reload、Vite development、
  PostgreSQL、Redis、Adminer 和本地 Celery Worker 均启动成功；本地模式按设计跳过
  Docker PythonLab Worker。
- 真实 API 场景 `29/29` 通过：健康检查、登录、`/auth/me`、refresh rotation、用户
  列表/统计、课堂活动创建/读取/更新/统计/删除、课堂计划创建/列表/删除、测评配置、
  测评可用性、任务分析列表、IT 游戏、XBK 公共配置、PythonLab 语法正确/错误和 CFG
  解析、登出后的 token 失效。
- 管理员真实示例创建的课堂活动和课堂计划均在验证结束后删除，没有留下本轮测试数据。
- 浏览器页面 smoke `13` 个路由中 `12 PASS / 1 WARN / 0 FAIL`；唯一 WARN 是测评
  新建页未找到标题输入框，页面本身加载成功，没有 console error、page error 或失败
  请求。
- PythonLab 本地浏览器场景 `4/4 PASS`：页面/个人程序导航、真实 Python 代码运行、
  单断点 Debug/Continue、双断点连续 Continue；远端 Docker 沙箱调试未在本轮本地模式
  中宣称通过，因为启动入口按设计跳过 `pythonlab-worker`。
- 角色与页面浏览器复验覆盖 `/ai-agents`、6 个公开页面、7 个后台页面和 PythonLab，
  共 15 次路径巡检；修复后均无失败请求、控制台错误或 `4xx/5xx`。`/xbk` 显示
  “未开放”，属于当前功能开关状态，不是页面崩溃。
- `/ai-agents` 管理员场景中课堂浮窗按钮为 0，`/classroom/active`、
  `/classroom/plans/active-plan` 和 `/classroom/stream` 均未发起请求。
- 本轮最终门禁：后端 `645 passed`、前端 `67 files / 341 passed`、前端脚本
  `23 passed`、workflow contracts `36 passed`、TypeScript 通过、UI audit 通过、
  Python governance `0 errors / 4 warnings`、Markdown contracts `101 files / 214 links /
  0 missing`。
- 本轮运行日志没有应用异常；`401` 仅来自未登录探测或登出失效验证，`404
  /openapi.json` 是错误路径探测，`422` 是缺少请求字段的探测，不属于业务回归。
- `uvicorn.access` 日志已增加查询参数脱敏，SSE 的 `token`、`access_token` 和
  `refresh_token` 不再原样写入应用日志；对应单测覆盖多参数 URL。
- `start-dev.sh` 的 PostgreSQL readiness probe 已显式使用配置的 `POSTGRES_DB`；
  从完全停止状态重启后连接 `wangsh_db`，PostgreSQL、后端、前端和 Celery 当前时段
  均无 `ERROR` / `FATAL`，旧的 `database "admin" does not exist` 日志噪声未再出现。
- 原始报告和截图写入系统临时目录后已删除；项目内没有新增 `test-results` 产物。

### 2026-07-16 空库导入复核

- 已发布 `shuhao07/wangsh-backend:1.6.0` 在 `/app` 中可直接解析
  `scripts.bootstrap_db`；缺少 `backend/scripts/__init__.py` 不会导致生产镜像
  `ModuleNotFoundError`，原 P0 判断不成立。
- 仓库根目录执行后端系统测试时，根 `scripts` 包会与 `backend/scripts` 发生导入歧义；
  当前增加显式 package marker 和回归合同作为开发工具链加固。
- 隔离 PostgreSQL 16 空库真实执行 `init_database()`，完整迁移到
  `20260711_0002_restore_legacy_baseline_indexes`，创建 47 张 public 表并成功更新视图。
- 系统导入/迁移专项从仓库根目录通过，后端全量 `665 passed`。

历史提交、clean-runner 和 2026-07-14 发布验证已压缩到
[7 月整理与发布归档摘要](../archive/plans/2026-07-project-consolidation-history.md)；
本文件不再重复维护过期提交流水和旧基线。

## 二、功能测试矩阵

| 域 | 主要验证内容 |
|---|---|
| 认证权限 | 登录、refresh、logout、用户管理、角色路由、深链返回 |
| 课堂与 AI | 活动、计划、分组讨论、Redis Pub/Sub、Celery、深度分析 |
| 数据库 | Alembic 单 head、四条 migration、bootstrap、空库升级 |
| IT 与内容 | IT 游戏、学习平台、信息学、文章、XBK |
| 前端工程 | Vitest、type-check、lint、CSS token、UI audit、bundle |
| PythonLab | Run、Debug、DAP、Continue、owner concurrency、可见性 |
| 发布 | Compose、workflow contract、prod-smoke、日志脱敏、release-set |

## 三、证据与保留策略

生产 smoke 运行时会在 `test-results/prod-smoke/` 生成以下可重建证据：

```text
test-results/prod-smoke/summary.json
test-results/prod-smoke/api-results.json
test-results/prod-smoke/ui-results.json
test-results/prod-smoke/openapi-sweep.json
test-results/prod-smoke/screenshots/
test-results/prod-smoke/step-logs/
test-results/prod-smoke/service-logs/
```

验证摘要沉淀到本文件后，本地证据副本可以清理；发布排错期间可短期保留，但不提交
Git。开发缓存可以继续留在本地复用，不作为正式发布证据。`frontend/build/`、
`coverage/`、`.coverage`、`.pytest_cache/`、`__pycache__/`、临时浏览器
`page-*` / `console-*` 文件和系统临时目录中的 PythonLab 快照均属于本地产物。
任何证据都不得包含有效 token、Cookie、密码或其他密钥。

## 四、待执行验证

- 配置 `PYTHONLAB_SMOKE_USERNAME` / `PYTHONLAB_SMOKE_PASSWORD` 后，在当前
  `main` 复验 PythonLab owner concurrency 和 Phase C 专项 workflow；现有失败
  记录的直接原因是仓库缺少这两个 secrets。
- 升级 GitHub Actions action runtime，消除 Node 20 弃用提醒。
- Docker Hub 六镜像和 `release-set.txt` 已通过手工发布链验证；GitHub
  `dockerhub-amd64` workflow 仍需配置 `DOCKERHUB_USERNAME` /
  `DOCKERHUB_TOKEN` 后单独复验。
- 本轮按用户要求不执行数据库备份；正式生产部署前仍需另行完成数据库升级、
  恢复和回滚演练。

## 五、重跑入口

```bash
cd backend
venv/bin/pytest -q
venv/bin/python scripts/check_python_governance.py check

cd ../frontend
npm run test
npm run test:scripts
npm run type-check
npm run lint
npm run build:check

cd ..
node --test scripts/workflow-contracts.test.mjs
docker compose --env-file .env.example -f docker-compose.dev.yml config --quiet
docker compose --env-file .env.example -f docker-compose.yml config --quiet
git diff --check
```

完整生产模拟：

```bash
IMAGE_TAG=1.6.0 \
IMAGE_REPOSITORY_PREFIX=shuhao07 \
SIM_RUN_PROD_SMOKE=true \
SIM_CLEANUP=true \
bash scripts/deploy.sh simulate
```
