# 发布与运维记录

> 状态：active
> Owner：release-ops
> 最近复核：2026-07-21
> 归档条件：当前未发布内容进入正式版本记录，且后续发布记录替代其当前指导作用
>
> 目标：集中记录每次发布的关键变更、配置影响、构建/部署步骤、验证结果与回滚点。
>
> 历史命令说明：下方旧版本记录中的 `build_images.sh` 仅用于追溯，脚本已删除。
> 当前构建入口统一使用 `scripts/deploy.sh build` 或 `scripts/deploy.sh build-amd64`。

---

## 📚 历史版本归档

v1.5.9 及之前的版本（v1.5.1 - v1.5.9，共14个版本）已归档到：
[archive/RELEASE_NOTES_v1.5.x.md](archive/RELEASE_NOTES_v1.5.x.md)

当前文档只保留最近3个版本的发布记录。

---

## 未发布 v1.6.0（2026-07-11）

当前源码版本继续使用 `1.6.0`。截至 2026-07-14，远端 Git 尚无 `v1.6.0` tag；
Docker Hub 六个正式 `1.6.0` amd64 镜像已通过手工发布链推送，并由
`release-set.txt` 复核 Compose 引用和远端 manifest digest。`latest` 未更新，
本轮也未执行正式生产部署或数据库备份。2026-06-15 早期候选内容已合并到本节，
下方只保留日期入口，不能视为第二个发布版本。

- 修复 `scripts/rollback.sh` 在函数外使用 `local` 导致回滚入口运行即失败的问题；
  Compose 检查、备份和 downgrade 现在统一使用显式 `ENV_FILE` / `COMPOSE_FILE`，
  并增加隔离 Docker 桩合同测试。回滚入口按脚本自身路径定位备份工具，执行 downgrade
  前停止 gateway、frontend、backend 和两个 worker，避免新版服务继续访问已降级结构；
  downgrade 使用一次性 backend 容器，完成后保持业务服务停止等待旧 release-set。
- 修复浏览器 UI smoke 在目标输入框或管理按钮不存在时仍把 `skip-*` 动作计为
  `PASS` 的问题；未执行到预期动作现在记录为 `WARN` 并进入 skip 汇总。
- 修复 `prod-smoke` 在 `ui-results.json` 缺失时仍可能写入成功汇总并返回 0 的问题；
  当前会把 `ui-smoke` 步骤、总状态和退出码统一标记为失败，并生成失败报告。
- 修复正式部署只在拉取前校验 registry tag 的时间差风险；`pull-up/deploy` 现在会在
  拉取后逐个核对本地 `RepoDigests`，`up-no-build` 也会拒绝启动与 release-set
  digest 不一致的同标签镜像。清单逻辑名称必须与仓库名对应，所有已设置版本变量必须
  一致；正式发布只拉六个业务镜像，并以 `--pull never` 阻止 PostgreSQL、Redis 或其他
  服务被隐式更新。
- Docker Hub 正式标签发布增加 current-main commit 守卫和 workflow concurrency，
  非 `main` ref、落后于 `origin/main` 的提交或并发发布不能再覆盖同一版本标签。
- 生产 smoke 的免授权隔离判断改为精确的 `wangsh_sim` Compose 项目和本机回环地址，
  相似项目前缀或外部 origin 不再被误认为隔离环境。
- 部署健康门禁新增首页可用性检查，详细健康报告同时覆盖 `frontend`、`gateway`、
  PostgreSQL、Redis 和两个 worker；正式 `deploy` 会等待详细健康门禁通过，避免 API
  正常但前端或异步任务不可用时误报部署成功。
- 修复嵌入式思维导图保存按钮依赖不存在的 `_mmData/postMessage` 协议的问题；当前从
  同源 iframe 的 `takeOverAppMethods` 读取最新树后保存，富文本节点会转换为纯文本
  Markdown，首个一级标题不再重复生成同名根节点；独立窗口保存按钮也复用同一运行时
  数据源。课堂浮窗手动刷新增加学生作用域保护，旧账号的迟到请求不会解除新账号刷新锁。
- 学生问题链结果页移除未参与任何数据计算的 1/3/5 分钟按钮，避免把无效状态展示为
  可用分析控制。
- 文档和历史脚本完成一轮低风险收口：无真实引用的 redirect、重复历史摘要和长篇实施
  正文的长期结论已迁入 owner；SSE 恢复资料和学习平台设计取舍保留为精简 archive。5 个失效或重复
  seed 执行壳已删除；AI/Agents 正式课程内容迁移源和未完成审计的索引 SQL 继续保留。
- 修复 `.gitignore` 将整个 `frontend/public/` 当作 Gatsby 产物忽略的问题；当前只忽略
  可重建的 Pyodide 运行时，思维导图静态资源和 favicon 随源码保留，确保新 checkout
  可以完成相同的前端构建。
- 修复普通 admin/teacher 从无显式 redirect 的登录页进入时，角色跳转先执行、随后又被
  登录页认证 effect 覆盖为 `/home` 的竞态；登录提交和已登录恢复现在复用同一跳转
  规则，并增加 super_admin/admin/teacher/student 四角色组件回归。
- 修复 GroupDiscussion 同日同班同组并发创建触发唯一约束时直接失败的问题；当前会
  rollback 并复用另一请求已提交的会话；切组路径会在 rollback 前保存旧成员会话 ID，
  不再读取过期 ORM 对象，避免 `MissingGreenlet` 500，管理员和学生路径均有回归覆盖。
- 应用 access log 在写入 loguru 前会脱敏 SSE 查询参数中的 token，避免运行日志保存
  可重放的认证凭据。
- 修复 Assessment 群体画像按配置统计全部班级 graded session 的问题；当前统计同时
  限定目标班级学生 ID，避免跨班成绩混入画像。
- 修复管理员从 `/task-analysis/*` 等受保护深链进入登录页后被角色默认落点覆盖的问题；
  只有缺省 `/home` 才应用角色默认页，合法显式 redirect 会保留路径和查询参数。
- 修复统一“姓名 + 学号”登录遇到同名用户时在校验学号前抛
  `MultipleResultsFound`、返回 HTTP 500 的问题；认证现在先取得候选账号，再用学号
  或历史密码唯一消歧，无法唯一匹配时按认证失败处理。
- 修复 React StrictMode 开发模式下认证初始化请求被首次 effect cleanup 取消后，
  `initialFetchRef` 阻止重新探测，导致后台直达页面永久停留在 loading 的问题；
  新增真实 `AuthProvider + React.StrictMode` 回归测试。
- 修复 Markmap 预览 SVG 使用百分比 `width/height` 时 D3 读取 `SVGLength.value`
  抛出运行时错误的问题；SVG 属性改用容器实际像素尺寸，CSS 继续保持响应式填充。
- 修复应用启动时覆盖管理员自定义 Markdown 样式的问题：默认 `terminal`、`paper`、
  `minimal` 样式现在只在缺失时创建，已有记录的标题、CSS 内容和排序保持不变；
  管理端 upsert/update API 行为不变。
- 修复用户管理 P0 越权：普通 admin 不能通过创建或导入生成 admin/super_admin，
  也不能通过导入更新已有高权限账号；批量删除会锁定并完整核对目标，
  缺失目标或包含 admin/super_admin 时整批拒绝，避免部分删除和高权限账号失效。
- 课堂活动和计划增加严格班级隔离与教师对象所有权校验，学生 active plan 不再返回正确答案。
- refresh token 改为数据库行锁下的原子轮换；停用/删除用户不可刷新，服务端会话缺失时旧 access token 不再自举。
- Redis SSE 订阅增加 listener ready 握手和按频道发布锁，消除首事件竞态；listener 超时改为按频道降级，并确保取消订阅失败时仍关闭连接。
- Logout 改为基础设施故障下的客户端强制登出：数据库或 Redis 撤销失败会告警并尽力回滚，但响应仍清除 access/refresh Cookie。
- IT 游戏上传改为分块临时文件、增量 SHA256、原子重命名与数据库失败补偿，并增加 `IT_GAME_MAX_UPLOAD_BYTES`。
- 前端增加真实角色路由守卫、认证超时取消和 IT 游戏 Query key 治理。
- 课堂管理 SSE 修复静态路由被动态活动 ID 路由抢占的问题；管理员改为订阅全局频道，学生班级频道统一规范化。
- 课堂活动严格限定仅草稿可编辑/删除；并发重复答题统一回滚为业务错误。
- 课堂计划推进改为活动、item、计划状态同事务提交，失败不再吞错或继续推进，SSE/分析延迟到提交后执行。
- 同一教师的活动启动/重启通过教师行锁串行化，重启也会自动结束其他 active 活动，避免并发产生多个进行中活动。
- 课堂填空分析改为 Celery 后台任务；SSE 全部发布后再入队，终态重复投递幂等，异常重试可接管遗留 `running` 状态，旧轮次结果不会覆盖已重启的新轮次。
- 课堂填空分析在所有候选提供商失败时先提交 `failed` 状态和错误摘要，再抛出专用
  可重试异常；Celery 重试可重新接管 `failed`，而未配置可用智能体仍作为配置失败
  直接结束，避免无意义重试。
- 课堂分析任务发布增加 broker 侧有限重试，最终入队失败会写入可观察的 `failed`
  状态并允许教师手工重投；课堂 Celery 任务启用 late ack 和 worker-lost 重投，
  redelivery 可接管遗留 `running` 状态。
- 多进程自动结束改为逐条 `FOR UPDATE SKIP LOCKED` 认领，已被其他进程结束的候选
  会幂等跳过；活动 restart 同时清空旧分析上下文和更新时间。
- 课堂班级迁移会锁定活动表、清洗历史班级空格，并在仍有 active 活动时阻断升级；部署文档要求维护窗口停写后再执行迁移。
- 新增 Python 物理行数与 AST 圈复杂度 ratchet，19 个历史超长文件和历史复杂函数
  使用逐项 baseline；CI 阻止 ceiling 放宽、一对多债务迁移和超期例外。
- 前端清零 `no-floating-promises`，CSS token 检查覆盖源码、Tailwind 映射、注释和
  多行引用；相关脚本测试与 token 门禁已接入 CI。
- PythonLab PR 门禁改为在 runner 启动当前 PR 的 PostgreSQL、Redis、backend、
  Celery、sandbox 和 Vite；使用隔离临时账号，fork PR 也可执行，并通过 Playwright
  Chromium 覆盖真实 pointer-click 的基础调试和多断点 Continue。
- PythonLab PR 门禁等待失败和汇总失败日志统一通过 prod-smoke 脱敏器，只发布最后
  200 行；实时 smoke 也统一通过 `redact_exec.py`。脱敏覆盖 query/userinfo、
  Bearer/Basic、JSON/字典、Cookie、password、api_key、已知环境值和跨行凭据，
  同时保留普通退出码及 shell 兼容的信号退出码。
- prod-smoke 子进程改用环境白名单，不再继承宿主无关 API token；子脚本 JSON 报告
  递归清洗后以 `0600` 重写，证据目录使用 `0700`，Phase C 每轮日志落盘前先脱敏。
- 删除小组讨论 smoke 中的硬编码管理员密码候选，仅接受显式环境注入。历史候选曾与
  本地有效凭据重合，因此发布前必须轮换对应管理员凭据。
- 镜像发布强制 tag 与源码版本一致，默认不推广 `latest`；六个镜像先推 staging，
  推广后生成已验证 digest 清单 `release-set.txt`。正式部署会强制校验版本、六镜像、
  Compose 引用和 registry manifest digest。Registry 不支持跨仓库事务，但不完整
  release-set 不能进入 `compose pull/up`。
- Bundle 门禁改为读取 Vite manifest 静态/动态 import 图；移除会造成依赖倒置的
  Monaco 手工 vendor 分包，Entry 降至 `0.96 MB`，重型 Monaco/ECharts 保持按需加载。
- 修复课堂计划行锁刷新后的异步关系加载：计划和 item 的
  `populate_existing` 查询保留 eager-load 选项，避免写操作访问 `items/activity`
  时触发 SQLAlchemy `MissingGreenlet`；新增独立临时 schema 的真实 AsyncSession
  回归测试。
- 手动镜像发布调用通用 CI 时也会相对 `origin/main` 执行 Python governance
  防放宽比较；已有 exception 禁止滚动延长到期日。
- `up-no-build` 现在同样强制验证 `release-set.txt`；Monaco worker 配置变化会
  触发 PythonLab PR 真实浏览器门禁。
- 登录流程增加可取消 epoch gate，logout、组件卸载或会话过期会使迟到的 login
  响应失效，避免显式退出后恢复会话。
- 修复 legacy、热点和学生问题链三张独立分析表出现相同整数主键时，兼容删除可能
  命中错误类型记录的问题；legacy 路由不再跨表猜 ID，typed 删除仅清理唯一快照
  匹配的 legacy 双写副本。
- Bundle budget 将 `build/pyodide/` 的生产 JavaScript 纳入 Deferred 和总量，
  修正此前约 `1.22 MB` 的漏算。
- 修复本地生产模拟被正式 release-set 门禁误阻断的问题：`simulate` 会在清理旧模拟
  数据前验证全部本地镜像，不再调用 `up-no-build`；可通过
  `SIM_RUN_PROD_SMOKE=true` 在同一进程安全传递临时凭据执行完整 smoke，并通过
  `SIM_CLEANUP=true` 保证成功或失败后清理隔离模拟栈。正式部署门禁保持不变。
- 前端 Docker 构建上下文排除生成型 `public/pyodide`，避免宿主机绝对符号链接或
  陈旧运行时覆盖容器内资产；生产 Dockerfile 同时在 `npm ci` 缓存层校验完整且
  非空的 Pyodide 核心文件和 PDF worker，Vite 复制失败或最终 worker 缺失时构建会
  立即失败。
- 后端生产构建增加可配置 Debian 主仓库和 security 镜像源；Compose 默认使用已验证
  的阿里云镜像，避免 amd64 Typst 大字体包在官方源直连下长时间重试，部署方仍可通过
  环境变量切回官方源。
- 新增 `20260711_0001_add_assessment_availability` migration，正式补齐 assessment
  模型历史上遗漏的 7 个字段：配置开放时间 2 个、题目自适应字段 2 个、答案知识点/
  尝试序号/自适应标记 3 个。
- 新增 `20260711_0002_restore_legacy_baseline_indexes` migration，幂等恢复空库
  legacy baseline 路径可能跳过的 3 个 XBK `grade` 索引和 2 个文章样式索引。
- `prod-smoke` 的 Docker Compose 命令继承 simulate 的 project、env file 和 compose
  file，日志与容器检查不再回落到默认 project。
- simulate 动态沙箱清理严格限定 `wangsh_sim_*`，并在删除后复查残留；默认开发
  `pythonlab_*` 沙箱不在匹配范围内。
- 用户单体 update/delete 在鉴权和修改前锁定目标行；普通 admin 的列表、详情和统计
  仅暴露 student/teacher（本人详情除外），不能通过筛选探测高权限账号。
- PythonLab PR 浏览器 smoke 的密码仅通过环境变量传入，不再出现在命令参数中。
- Pyodide 复制增加 npm 包版本 marker、完整性检查和临时目录原子替换；旧版本、缺文件
  或空文件均不会被误判为可复用运行时。
- `.env.example` 明确 Redis 服务名、PythonLab 容器 namespace、Compose 宿主机
  workspace bind mount 与 DockerProvider 显式回退路径之间的合同。
- assessment repair migration 会统一已有字段的类型、默认值和 nullable 约束，保守
  downgrade 不删除来源不明的历史字段；Alembic online 环境会在升级前将旧式
  `alembic_version VARCHAR(32)` 扩容为 `VARCHAR(64)`。
- `prod-smoke` 不再把 refresh 响应中的有效 access/refresh token 写入 JSON 报告；
  用户批量删除 API 与前端统一为 `{ "user_ids": [...] }` 请求体。
- `prod-smoke` 的步骤日志和 Compose 服务日志增加统一敏感信息脱敏，URL query
  token、Bearer token 和 JSON access/refresh token 不再进入本地测试证据。
- `simulate` 增加主机级互斥锁，避免并发运行共享 `wangsh_sim` 资源；Pyodide 目录替换
  增加失败恢复，UI smoke 仅通过真实 NotFound 页面标记判定 404，不再扫描整页业务文本。

### 验证结果

当前测试事实、覆盖矩阵、证据路径和待执行远端门禁统一维护在
[testing/TEST_STATUS.md](testing/TEST_STATUS.md)，本页不再复制会持续变化的测试数字。
验证范围包括后端、前端、脚本、Workflow、Compose、Alembic、Python governance
和隔离生产模拟；每次发布前都必须从最终提交重新执行，不得把阶段快照外推为正式发布结果。
数据库结构变更以 `20260711_0002_restore_legacy_baseline_indexes` 为当前迁移 head，
具体迁移结果和待执行门禁仍以测试状态文档为准。

## v1.6.0 早期候选快照（2026-06-15）

该未远端发布快照的安全、性能、前后端和迁移内容已合并到上方“未发布 v1.6.0”。
当前验收事实统一见 [testing/TEST_STATUS.md](testing/TEST_STATUS.md)；本节只保留日期
入口，避免同一版本维护两份发布正文。

---

## v1.5.16（2026-05-28）

### 1. 变更范围

**小组讨论管理修复**：
- 新增管理员会话 Excel 导出接口，并限制默认最多导出 5000 条、上限 10000 条，避免大范围导出拖慢后端。
- 管理端会话列表保留单一关键词筛选，导出与列表使用同一筛选条件。
- 前端导出请求改为复用项目 API 客户端，保持鉴权与刷新行为一致。

**清理项**：
- 移除临时 Typst quick Dockerfile 和 mock 分析数据 seed 脚本，避免临时构建路径和演示数据误入生产流程。

### 2. 配置影响

- `.env.example`、Compose、前端 package 版本默认值同步到 `1.5.16`。
- 生产镜像默认使用 Docker Hub 短名称 `shuhao07/*:1.5.16`，不再渲染为 `docker.io/shuhao07/*`。
- PythonLab sandbox 默认镜像同步到 `shuhao07/pythonlab-sandbox:1.5.16`。

### 3. 验证

```bash
npm run type-check
pytest -q tests/ai_agents/test_usage_filter_options_schema.py tests/system/test_feature_flags.py tests/system/test_metrics.py tests/group_discussion/test_group_discussion_session_creation.py
docker compose --env-file .env.example -f docker-compose.yml config --quiet
git diff --check
```

### 4. 镜像与生产模拟

```bash
ENV_FILE=.env COMPOSE_FILE=docker-compose.yml DOCKER_DEFAULT_PLATFORM=linux/amd64 bash scripts/deploy.sh build-amd64
bash scripts/deploy.sh simulate
```

已验证镜像：
- `shuhao07/wangsh-backend:1.5.16`
- `shuhao07/wangsh-frontend:1.5.16`
- `shuhao07/wangsh-gateway:1.5.16`
- `shuhao07/wangsh-typst-worker:1.5.16`
- `shuhao07/wangsh-pythonlab-worker:1.5.16`
- `shuhao07/pythonlab-sandbox:1.5.16`

本地生产模拟验证通过：
- `http://localhost:6608/api/health` 返回 200。
- 登录、`/api/v1/auth/me`、`/api/v1/users/stats`、`/api/v1/system/overview` 返回 200。
- 小组讨论 admin sessions 返回 200，空范围 Excel 导出返回 200。
- `typst-worker` 内 `typst 0.14.2` 可用，`pythonlab-worker` 内 Docker CLI 可用。

## v1.5.10（2026-05-09）

### 1. 变更范围

**关键修复** — v1.5.9 的 backend 镜像遗漏了 ML/AI/Agents 章节 API 后端代码，因为相关文件未 commit 到 Git，用户从 GitHub 构建时拿不到。v1.5.10 将所有遗漏文件纳入版本控制并重做镜像。

**后端新增**：
- ML/AI/Agents 章节 CRUD API（`learning/chapters.py`）：`GET/PUT/DELETE /learning/chapters/{module_key}/{slug}`
- `LearningChapter` 模型（`sys_learning_chapters` 表）
- Alembic migration `20260509_lrn_chapters`（建表 `sys_learning_chapters`）

**Alembic 修复**：
- 重命名 revision `20260503_0002_learning_content_items` → `20260503_0002_learning_content`（36→30 字符，解决 VARCHAR(32) 超限）

**前端**：Phase 0-9 全面优化（与 v1.5.9 相同内容，因 v1.5.9 未 commit 到 Git）

### 2. 配置影响

- 所有部署文件版本引用统一升级到 `1.5.10`
- `IMAGE_TAG=1.5.10` 为新的默认值
- PythonLab sandbox 镜像同步到 `shuhao07/pythonlab-sandbox:1.5.10`

### 3. 构建与部署

```bash
git fetch origin claude/inspiring-gould-f407ac && git merge origin/claude/inspiring-gould-f407ac
./build_images.sh 1.5.10
docker compose push
IMAGE_TAG=1.5.10 docker compose pull && IMAGE_TAG=1.5.10 docker compose up -d
curl http://wangsh.cn:6608/api/v1/health
```

### 4. Docker Hub 备选镜像源

如直连超时，使用 `docker.1ms.run`：
```bash
docker pull docker.1ms.run/shuhao07/wangsh-backend:1.5.10
docker tag docker.1ms.run/shuhao07/wangsh-backend:1.5.10 shuhao07/wangsh-backend:1.5.10
# 同理拉取其他 6 个镜像
```

### 5. 回滚

```bash
IMAGE_TAG=1.5.9 docker compose up -d
```

---

