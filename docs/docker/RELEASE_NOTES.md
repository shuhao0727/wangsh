# 发布与运维记录

> 状态：active
> Owner：release-ops
> 最近复核：2026-07-13
> 归档条件：当前未发布内容进入正式版本记录，且后续发布记录替代其当前指导作用
>
> 目标：集中记录每次发布的关键变更、配置影响、构建/部署步骤、验证结果与回滚点。

## 未发布 v1.6.0（2026-07-11）

当前源码版本继续使用 `1.6.0`。截至 2026-07-12，远端 Git 尚无 `v1.6.0` tag，
Docker Hub 六个正式 `1.6.0` 镜像也尚不存在。2026-06-15 早期候选内容已合并到本节，
下方只保留日期入口，不能视为第二个发布版本。

- 修复普通 admin/teacher 从无显式 redirect 的登录页进入时，角色跳转先执行、随后又被
  登录页认证 effect 覆盖为 `/home` 的竞态；登录提交和已登录恢复现在复用同一跳转
  规则，并增加 super_admin/admin/teacher/student 四角色组件回归。
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
此前工作区快照已完成后端、前端、脚本、Workflow、Compose、Alembic、
Python governance 和隔离生产模拟本地门禁；Commit 6-8 完成后仍须从最终 HEAD 重跑，
不能把阶段快照外推为正式发布结果。

- Alembic 单一 head 为 `20260711_0002_restore_legacy_baseline_indexes`；真实临时
  PostgreSQL 升级验证通过，确认旧 `VARCHAR(32)` 版本列扩容到 `VARCHAR(64)`、
  7 个 assessment 字段和 5 个 legacy baseline 条件索引均正确。
- 完整 Docker 生产模拟：`14/14 PASS / 0 WARN / 0 FAIL / 0 SKIP`；UI smoke：
  `13/13 PASS`。模拟容器、卷、网络、沙箱、workspace 和 host lock 均已清理，
  开发栈容器 ID 与 HTTP 健康状态保持不变。
- 修复北京时间跨零点时小组讨论默认列表错用 UTC 日期而看不到刚创建会话的问题，
  新增跨日回归测试并通过完整生产模拟。
- 生产 smoke 报告和落盘日志的敏感扫描均为 0 命中，refresh 实际结果仅记录
  `access_token=yes refresh_token=yes`；日志脱敏专项测试 `3 passed`。
- 本地 `backend`、`pythonlab-worker`、`frontend`、`typst-worker` 的 `1.6.0`
  镜像已重建并通过模拟验证；尚未推送 Docker Hub，也尚未在真实 GitHub Actions
  PR runner 上执行 workflow，因此本节是本地 release-gate 记录，不是远端发布完成声明。
- 私有 `.env` 的版本和镜像 tag 已保持 `1.6.0`，并继续由 `.gitignore` 排除。
- 开发模式四角色登录已真实复测：super_admin/admin 默认进入 dashboard，teacher
  进入课堂互动，student 进入首页且访问后台被守卫拒绝；重复姓名教师登录接口恢复
  `200`。
- PythonLab 开发模式真实 UI `run-happy-path`、`debug-happy-path` 及 DAP
  step/watch smoke 均通过；临时报告保存在 `/tmp/wangsh-pythonlab-dev-validation/`，
  未写入仓库。

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

## v1.5.9（2026-05-09）

### 1. 变更范围

前端 UI/体验/稳定性一轮系统性提升，覆盖 10 个 Phase：

- **Phase 0 — Button 过渡修复**：`button-variants.ts` 中 `transition-colors` 与 `transition-transform` 互相覆盖导致颜色过渡失效的 bug，合并为 `transition-[color,background-color,border-color,transform,box-shadow] duration-150`
- **Phase 1 — 组件交互状态补齐**：`Input` 新增 hover 状态；`Card` 在传入 `onClick` 时自动进入交互模式（`tabIndex`/`role=button`/键盘 Enter/Space/`focus-visible` ring/hover 阴影）；`TableRow` 同步自动化
- **Phase 2 — a11y 审计**：24 处 `size="icon"` 图标按钮全部确认带 `aria-label`（审计确认已合规，无需修改）
- **Phase 3 — 排版语义化**：`styles/index.css` 新增 `.ws-heading-page / .ws-heading-section / .ws-heading-card / .ws-text-body / .ws-text-meta` 语义类
- **Phase 4 — 间距工具**：新增 `.ws-stack / .ws-stack-sm / .ws-grid-cards` 容器级栅格助手
- **Phase 5 — 加载/错误态**：`DataTable` 新增 `loading` + `loadingRows` prop（骨架行替代空正文）；新建 `components/Common/SectionErrorBoundary.tsx` 支持 section 级错误隔离 + retry
- **Phase 6 — 布局动效**：`AdminLayout` content 容器 `transition-all` 缩到 `transition-[margin-left]`，减少重排影响范围；`motion-reduce:transition-none` 兜底
- **Phase 7 — 响应式**：全仓 `100vh` → `100dvh`（8 处），修复移动浏览器工具栏截断问题
- **Phase 8 — 色彩一致性**：`FlowEdgesSvg / FlowAnnotationsSvg` 中硬编码旧 primary `#0EA5E9` 替换为 `var(--ws-color-primary)` 或新 primary `#0284C7`（保持 WCAG AA 对比度 ≥ 4.5:1）
- **Phase 9 — 色彩规范文档**：新建 `frontend/src/styles/COLORS.md` 列出每个语义色用途/反例/对比度要求
- **AI Agents 页面边距**：`BasicLayout` fullHeight 模式增加左右 `var(--ws-space-3)` 留白，避免对话内容贴屏幕边沿

### 2. Bug 修复（代码审查发现并修复）

- **[confidence=95]** DataTable ↔ TableRow 键盘事件重复触发：`data-table.tsx` 原本手工给 TableRow 传 `role/tabIndex/onKeyDown`，新 TableRow 组件自带相同逻辑，导致 Enter/Space 触发 `onRowClick` 两次。移除 DataTable 端的手工处理，职责下沉组件
- **[confidence=85]** `[role="dialog"]` 小屏全屏选择器过激：缩窄为 `[role="dialog"][aria-modal="true"]`，避免影响 Popover/非 modal 浮层
- **[confidence=82]** SVG marker 箭头与边线色差：FlowEdgesSvg 中 marker path `fill="#0EA5E9"` 同步改为 `#0284C7`，与边线 `var(--ws-color-primary)` 对齐

### 3. 类型错误修复（生产构建）

修复 30 个阻塞 `npm run build` 的 TypeScript 错误：

- `pages/ITTechnology/index.tsx`：`result.value.data.data` 类型窄化为带可选字段 object
- `pages/Admin/ITTechnology/ml/index.tsx`：`MLLearningContentPayload` 补 `roadmap / knowledge` 可选字段；清理 tab 字面量不可达分支
- `pages/Admin/ITTechnology/ai/index.tsx` 和 `agents/index.tsx`：API 返回 `rawPayload` 先断言为 `Record<string, unknown>` 再解构

### 4. 配置影响

- `.env`、`.env.dev`、`.env.example`、`docker-compose.yml`、`docker-compose.dev.yml`、`frontend/package.json`、`frontend/package-lock.json` 当前版本引用均更新到 `1.5.9`
- PythonLab sandbox 镜像默认标签同步到 `shuhao07/pythonlab-sandbox:1.5.9`
- `docs/docker/deploy/DEPLOY.md` 与 `scripts/deploy.sh` 中示例版本号同步

### 5. 构建与部署

```bash
# 构建全部生产镜像
./build_images.sh 1.5.9

# 推送到 Docker Hub
docker compose push

# 拉取并更新
docker compose pull && docker compose up -d

# 健康检查
curl http://localhost:6608/api/health
```

### 6. 验证

- `frontend npm run build`：✅ 通过（1.85s，零类型错误）
- ESLint：✅ 0 error / 409 warn（`any` 技术债，非阻塞）
- `scripts/check-version-consistency.mjs`：✅ 通过
- 7 个 Docker 容器：✅ 全部 Up
- 后端 `/health`：✅ 200 持续响应

### 7. 回滚

```bash
IMAGE_TAG=1.5.8 docker compose up -d
```

---

## v1.5.6（2026-04-27）

### 1. 变更范围

- 当前部署、构建、前端包和文档中的默认版本号统一到 `1.5.6`
- 清理配置拆分后的残留文件，补齐 `.env.example` 中遗漏的开发/运维配置项
- `startup.py` 中开发环境 Alembic 标记逻辑从硬编码 revision 改为自动检测 head

### 2. 配置影响

- `.env`、`.env.dev`、`.env.example`、`docker-compose.yml`、`docker-compose.dev.yml`、`frontend/package.json`、`frontend/package-lock.json` 当前版本引用均应保持 `1.5.6`
- PythonLab sandbox 镜像默认标签同步到 `shuhao07/pythonlab-sandbox:1.5.6`
- 历史发布记录中的旧版本号保留为历史事实，不作为当前部署版本

### 3. 构建与部署

```bash
./build_images.sh 1.5.6
docker compose push
docker compose pull && docker compose up -d
curl http://localhost:6608/api/health
```

---

## v1.5.5（2026-04-05）

### 1. 变更范围

- 生产镜像默认版本升级 `1.5.3` → `1.5.5`
- 完成一轮大规模平台更新：系统接口拆分、XBK 实数据信链路、点名与测评收口、生产烟测体系落地、文档与脚本目录重组

### 2. 包含更新

- **系统接口重组**：`system/admin.py` 拆分为 `overview.py`、`feature_flags.py`、`metrics.py`
- **XBK 真数据化**：后端拆分 `students/courses/selections/bulk_ops` 端点，补齐导入导出规则与结构测试，前端移除 mock 兜底并改为真实空态
- **点名与课堂链路**：点名数据模型、接口和烟测脚本补齐；group discussion 成员识别与生产烟测覆盖增强
- **生产烟测收口**：新增/完善 `scripts/prod-smoke/`、`backend/scripts/smoke_*`、`frontend/scripts/prod-smoke-ui.mjs`，产出统一 API/UI/worker 验证链
- **前端工程升级**：前端脚本、路由页、管理后台组件和公共 UI 基础设施完成一轮收口整理
- **文档结构整理**：部署、前端、计划、测试治理、历史归档统一迁移到 `docs/docker/` 分层维护
- **测试与脚本整理**：补齐 `backend/scripts/README.md`、`scripts/README.md`、`frontend/scripts/README.md`、`docs/docker/testing/README.md`

### 3. 构建与部署

```bash
./build_images.sh 1.5.5
docker compose push
docker compose pull && docker compose up -d
curl http://localhost:6608/api/health
```

### 4. 验证建议

- 生产 API/UI/worker 全链路烟测：

```bash
./scripts/prod-smoke/run.sh
```

- 前端基础校验：

```bash
cd frontend && npm run type-check
```

### 5. 配置影响

- 【历史记录】在 v1.5.5 发布时，`.env.example`、`docker-compose.yml`、`docker-compose.dev.yml`、`frontend/package.json` 默认版本号已同步到 `1.5.5`
- 【历史记录】如当时生产环境仍显式写死旧 `IMAGE_TAG` / `APP_VERSION` / `REACT_APP_VERSION` / `PYTHONLAB_SANDBOX_IMAGE`，需要同步改为 `1.5.5`

---

## v1.5.3（2026-03-31）

### 1. 变更范围

- 生产镜像版本升级 `1.5.2` → `1.5.3`
- 代码质量提升 + 认证修复 + 架构优化

### 2. 包含修复

- **认证系统**：访客不再触发无谓 401/refresh，文章搜索改用公开 API
- **架构优化**：pub/sub 从 classroom.py 提取到独立模块 `app/core/pubsub.py`，main.py lifespan 拆分到 `app/core/startup.py`
- **代码清理**：celery_app 合并、database.py 死代码移除、deps.py 清理
- **文档修复**：README deploy.sh 引用、版本号同步、CLAUDE_MEMORY 引用清理
- **新增测试**：课堂计划 12 个测试用例（`backend/tests/classroom/test_classroom_plan.py`）
- **前端修复**：Monaco CDN 改本地加载、App.tsx 路由重定向 bug
- **SSE 安全**：docker-compose/env 添加单 worker 警告注释
- **新增分析文档**：5 个 plans 分析文件（项目深度分析、模块分析、认证分析、代码质量审计、响应式分析）

关键改动文件（37 files changed, +1958, -435）：
- `backend/app/core/pubsub.py` — 新增，独立 pub/sub 模块
- `backend/app/core/startup.py` — 新增，lifespan 拆分
- `backend/main.py` — 大幅精简（-246 行）
- `backend/tests/classroom/test_classroom_plan.py` — 新增 12 个测试
- `frontend/src/hooks/useAuth.ts` — 访客 401 修复
- `frontend/src/services/wz/articles.ts` — 文章搜索改用公开 API
- `docker-compose.dev.yml` / `docker-compose.yml` — 版本升级 + SSE 警告

### 3. 构建与部署

```bash
./build_images.sh 1.5.3
docker compose push
docker compose pull && docker compose up -d
curl http://localhost:6608/health
```

### 4. 配置影响

- 无新增配置项，沿用 v1.5.2 全部配置。
- docker-compose.yml 新增注释警告：SSE pub/sub 为进程内实现，多 worker 时推送会失效。

---

## v1.5.2（2026-03-26）

### 1. 变更范围

- 生产镜像版本升级 `1.5.1` → `1.5.2`
- 合并 v1.5.1 全部 hotfix（hotfix.1 ~ hotfix.7）

### 2. 包含修复

- 小组讨论发送消息防重（前后端双层防护）
- 全项目刷新交互优化（学生端 + 管理端）
- 智能体与模型发现接口鉴权收口
- 小组讨论组号锁机制修复与前端提示增强
- 课堂互动 SSE 实时监听、自我评价轮询上限
- 前端全局会话失效收敛与三面板登录失效回收
- 填空题兜底判分、XBK 选课虚拟行编辑修复
- 小组讨论班级归属与跨班 join 收口
- 小组讨论读取权限收口、跨系统分析参数校验
- 并发建组冲突兜底与初始化 SQL 对齐

### 3. 构建与部署

```bash
./build_images.sh 1.5.2
docker compose push
docker compose pull && docker compose up -d
curl http://localhost:6608/health
```

### 4. 配置影响

- 无新增配置项，沿用 v1.5.1 全部配置。

---

## v1.5.1-hotfix.7（2026-03-24）

### 1. 变更范围

- 小组讨论读取权限收口（阻断学生跨会话越权读取）
- 跨系统分析参数生效与空成员保护
- 并发建组冲突兜底与初始化 SQL 对齐

关键改动文件：
- `backend/app/services/agents/group_discussion.py`
- `backend/app/api/endpoints/agents/ai_agents/group_discussion.py`
- `backend/tests/test_group_discussion_access_control.py`
- `backend/db/init.sql/full_init_v4.sql`
- `docs/development/API.md`

### 2. 核心修复

- 学生读取讨论消息与 SSE 流时，新增“必须是会话成员”校验；非成员返回 `403`。
- `/admin/cross-system-analyze` 的 `date/class_name` 参数改为强校验：
  - 所选会话与参数不一致时返回 `422`。
  - 所选会话无成员时返回 `422`，避免误扫全量 AI 提问数据。
- 新建小组并发冲突时，创建路径捕获唯一键冲突并回查既有会话，避免并发报错。
- `full_init_v4.sql` 补齐 `znt_group_discussion_members` 表、索引和外键，确保脚本化初始化与当前模型一致。

### 3. 验证结果

- `pytest -q backend/tests/test_group_discussion_access_control.py backend/tests/test_group_discussion_send_message.py backend/tests/test_group_discussion_join_lock.py backend/tests/test_group_discussion_class_scope.py` → `17 passed`
- `CI=true npm test -- --runInBand src/pages/AIAgents/GroupDiscussionPanel.test.ts src/pages/AIAgents/groupDiscussionJoinLock.test.ts` → `7 passed`

### 4. 配置影响

- 无新增配置项。

---

## v1.5.1-hotfix.6（2026-03-24）

### 1. 变更范围

- 修复“管理员新建小组后学生看不到”的班级归属问题
- 收口学生端跨班 join 风险（避免通过请求体伪造班级）

关键改动文件：
- `backend/app/services/agents/group_discussion.py`
- `backend/tests/test_group_discussion_class_scope.py`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.test.ts`
- `docs/development/API.md`

### 2. 核心修复

- 后端新增 `resolve_target_class_name` 班级解析逻辑：
  - 学生端：强制使用本人班级；若请求体携带其他班级，返回 `403`。
  - 管理员端：未显式传 `class_name` 时，优先回退到管理员账号自身 `class_name`，减少误落到“管理员”虚拟班级。
  - 管理员端：若请求与账号都无班级，接口直接返回 `422`，避免创建“不可见小组”脏数据。
- 前端“小组讨论 -> 新建小组”增加管理员班级必填项，默认回填筛选班级或已存在班级，避免误建到不可见班级。

### 3. 验证结果

- `pytest -q backend/tests/test_group_discussion_class_scope.py backend/tests/test_group_discussion_join_lock.py` → 通过
- `CI=true npm test -- --runInBand src/pages/AIAgents/GroupDiscussionPanel.test.ts` → 通过

### 4. 配置影响

- 无新增配置项。

---

## v1.5.1-hotfix.5（2026-03-24）

### 1. 变更范围

- 小组讨论组号锁机制修复（避免“加入失败却被锁组号”）
- 课堂互动服务层关键状态机测试补齐
- 小组讨论前端组号锁定提示增强（锁定组号 + 秒级剩余时间）

关键改动文件：
- `backend/app/services/agents/group_discussion.py`
- `backend/app/api/endpoints/agents/ai_agents/group_discussion.py`
- `backend/tests/test_group_discussion_join_lock.py`
- `backend/tests/test_classroom_service_flow.py`
- `backend/app/services/assessment/session_service.py`
- `backend/tests/test_assessment_session.py`
- `backend/tests/test_auth_logout_refresh.py`
- `backend/tests/test_auth_refresh_nonce.py`
- `frontend/src/pages/AIAgents/ClassroomPanel.tsx`
- `frontend/src/pages/AIAgents/ClassroomPanel.test.ts`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.test.ts`
- `frontend/src/pages/AIAgents/groupDiscussionJoinLock.ts`
- `frontend/src/pages/AIAgents/groupDiscussionJoinLock.test.ts`
- `frontend/src/pages/AIAgents/AssessmentPanel.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/api.test.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/hooks/useAuth.test.ts`
- `frontend/src/pages/Xbk/index.tsx`
- `frontend/src/pages/Xbk/index.test.ts`

### 2. 核心修复

- `enforce_join_lock` 改为“仅检查锁，不写入锁”。
- 新增 `set_join_lock`，仅在 `join` 成功后写入锁，避免失败请求污染锁状态。
- 组号锁冲突提示增强：返回当前锁定组号（如“组号已锁定为 3，xx 秒内不可更改”）。
- 前端 `GroupDiscussionPanel` 在 join 失败时会解析锁冲突提示，并可视化展示“锁定组号 + 剩余秒数”，减少误操作与重复报错。
- 自我评价结果页画像轮询增加上限（约 2 分钟）与超时提示，避免异常时无限轮询。
- 课堂互动学生端新增 SSE 实时监听（保留原轮询兜底）：活动开始/结束后可更快刷新状态，断线后 3 秒自动重连。
- 课堂互动服务新增关键用例：`submit_response` 重复提交、非 active 提交、`start_activity`/`end_activity` 状态门禁、`bulk_delete_activities` 跳过 active。
- 自主测评填空题判分兜底修复：未配置评分智能体时，`fill` 题回退文本比对（忽略大小写），避免正确答案被误判为 0 分。
- 小组讨论 SSE token 获取统一为 `getStoredAccessToken()`，避免不同存储路径导致的偶发“前端有登录态但流连接鉴权失败”。
- 前端新增全局会话失效收敛：当 `401 -> refresh 失败` 时触发 `ws:auth-expired` 事件，`useAuth` 立即切换未登录状态，避免页面停留在“伪登录态”。
- 认证链路补充 refresh 轮换单测：验证“旧 refresh token 在轮换后必须失效，新 refresh token 可继续轮换”。
- 三个学生端面板补充登录失效回收：
  - `GroupDiscussionPanel`：会话失效时关闭面板并清理会话缓存；SSE 建连条件增加 `isAuthenticated`，避免失效后仍保持旧连接/轮询。
  - `ClassroomPanel`：会话失效时回收到 `idle` 并清空当前活动态，防止重新登录后残留旧题面。
  - `AssessmentPanel`：会话失效时停止画像轮询并回收答题/结果态，避免后台继续轮询导致连续报错。
- XBK 选课记录编辑修复：`/xbk/data/selections` 存在 `id=0` 的虚拟未选/休学行时，前端不再错误调用 `PUT /xbk/data/selections/0`。
  - 虚拟行“编辑”改为“补录”（走 `createSelection`）。
  - 虚拟行隐藏删除按钮，避免误触发 `DELETE /xbk/data/selections/0`。
  - 选课记录表 `rowKey` 对虚拟行改为复合键，避免 `id=0` 重复导致潜在错行。

### 3. 验证结果

- 新增/回归测试：
  - `pytest -q backend/tests/test_assessment_session.py backend/tests/test_assessment_profile.py backend/tests/test_classroom_service_flow.py backend/tests/test_group_discussion_join_lock.py backend/tests/test_group_discussion_send_message.py` → `43 passed`
  - `pytest -q backend/tests/test_assessment_session.py backend/tests/test_assessment_profile.py backend/tests/test_classroom_service_flow.py backend/tests/test_group_discussion_join_lock.py backend/tests/test_group_discussion_send_message.py backend/tests/test_auth_logout_refresh.py backend/tests/test_auth_refresh_nonce.py` → `51 passed`
  - `npm run -s type-check`（frontend）→ 通过
  - `CI=true npm test -- --runInBand src/pages/AIAgents/groupDiscussionJoinLock.test.ts src/pages/AIAgents/AssessmentPanel.test.ts` → `14 passed`
  - `CI=true npm test -- --runInBand src/pages/AIAgents/ClassroomPanel.test.ts src/pages/AIAgents/groupDiscussionJoinLock.test.ts src/pages/AIAgents/AssessmentPanel.test.ts` → `17 passed`
  - `CI=true npm test -- --runInBand src/services/api.test.ts src/hooks/useAuth.test.ts src/pages/AIAgents/ClassroomPanel.test.ts src/pages/AIAgents/groupDiscussionJoinLock.test.ts src/pages/AIAgents/AssessmentPanel.test.ts` → `19 passed`
  - `CI=true npm test -- --runInBand src/pages/AIAgents/GroupDiscussionPanel.test.ts src/pages/AIAgents/ClassroomPanel.test.ts src/pages/AIAgents/AssessmentPanel.test.ts` → `19 passed`
  - `CI=true npm test -- --runInBand src/pages/Xbk/index.test.ts` → `3 passed`
- 动态探针：
  - 学生端非法组号 `group_no=XABC` → `422`
  - 紧接着合法组号加入不再被非法请求触发的锁影响（可成功 `200`）
  - 三板块第 6 轮全链路探针（admin + 新建学生）：`38/38` 通过（含小组讨论锁冲突、消息限流、测评幂等、课堂互动重复提交防重）。
  - 三板块第 7 轮并发探针：`6/6` 通过（小组讨论并发发送仅 1 条成功、测评重复答题防重、课堂活动切换自动结束旧活动）。
  - 三板块第 8 轮长连接探针：课堂互动 `/classroom/stream` 与小组讨论 `/ai-agents/group-discussion/stream` 均可稳定接收事件（含 `activity_ended`、消息推送）。
  - 三板块第 9 轮认证边界探针（学生账号）：登录 `200`、`/auth/me` `200`、`rt1 -> rt2` 轮换成功、旧 `rt1` `401`、`rt2` 继续轮换 `200`。
  - 三板块第 11 轮真实页面探针（学生账号，Chrome 自动化）通过：
    - 初次登录后三面板（小组讨论/自我评价/课堂互动）入口可见且可打开。
    - 强制写入无效 `ws_access_token/ws_refresh_token` 并清空 Cookie 后，前端自动触发会话失效回收（三面板入口全部收起）。
    - 重新登录后三面板入口恢复，且三面板可再次打开。
  - `GET /classroom/stream?token=bad.invalid.token` 在存在有效 Cookie 会话时仍可握手 `200`（`text/event-stream`），验证 query token 失效场景的 Cookie 回退链路。
  - XBK 样本验证：`GET /xbk/data/selections?page=1&size=200` 返回中同时存在真实选课行与 `id=0` 虚拟行（未选/休学），证实 `/selections/0` 404 的触发条件。
  - 填空题兜底验证：未配置评分智能体时，`student_answer=print` 可正确判分（`is_correct=true, earned_score=10`）。

### 4. 配置影响

- 无新增配置项，沿用现有 `GROUP_DISCUSSION_JOIN_LOCK_SECONDS`。

---

## v1.5.1-hotfix.4（2026-03-24）

### 1. 变更范围

- 智能体与模型发现接口鉴权收口（最小改动，避免前端回归）

关键改动文件：
- `backend/app/api/endpoints/agents/ai_agents/usage.py`
- `backend/app/api/endpoints/agents/model_discovery.py`
- `backend/tests/test_ai_agents_route_auth.py`

### 2. 核心修复

- `GET /ai-agents/usage`、`GET /ai-agents/usage/statistics`：改为管理员权限。
- `POST /ai-agents/usage`：改为登录用户权限，并强制使用当前登录用户 `id` 作为 `user_id`（忽略请求体传入值）。
- `POST /model-discovery/discover`、`POST /model-discovery/discover/{agent_id}`：改为管理员权限。
- 保持 `GET /ai-agents/active` 为公开可读，避免未登录页面初始化回归。

### 3. 验证结果

- 新增测试：
  - `pytest -q tests/test_ai_agents_route_auth.py tests/test_chat_stream.py` → `5 passed`
- 动态探针（未登录）：
  - `/ai-agents/usage`、`/ai-agents/usage/statistics`、`/ai-agents/usage (POST)`、`/model-discovery/discover*`、`/ai-agents CRUD/test` → `401`
  - `/ai-agents/active` → `200`

### 4. 配置影响

- 无新增配置项。

---

## v1.5.1-hotfix.3（2026-03-24）

### 1. 变更范围

- 全项目刷新交互专项优化（重点修复“点击刷新无反馈/无效果感知”）

关键改动文件：
- `frontend/src/pages/Admin/ClassroomInteraction/index.tsx`
- `frontend/src/pages/Admin/ClassroomPlan/PlanPage.tsx`
- `frontend/src/pages/Admin/ClassroomPlan/index.tsx`
- `frontend/src/pages/Admin/Informatics/TypstNoteEditor.tsx`
- `frontend/src/pages/Informatics/Reader.tsx`
- `frontend/src/pages/Admin/Articles/CategoryManageModal.tsx`
- `frontend/src/pages/Admin/Categories/index.tsx`

### 2. 核心修复

- 课堂互动：列表刷新增加 loading 与成功反馈；智能体列表刷新失败不再静默吞错。
- 课堂计划（新旧两套入口）：计划详情刷新失败不再静默；刷新按钮增加 loading 与明确反馈。
- Typst 编辑器：手动“刷新预览”在编辑模式下可强制触发（修复此前点击无效果）。
- Informatics 阅读器：刷新目录时同步刷新当前文档内容，避免只刷新左侧目录。
- 分类管理页：刷新按钮接入 loading，避免用户误判按钮未生效。

### 3. 验证结果

- `npm run -s type-check`（frontend）→ 通过
- `CI=true npm test -- --runInBand`（frontend）→ `53 suites / 280 tests passed`

---

## v1.5.1-hotfix.2（2026-03-24）

### 1. 变更范围

- 修复多处“刷新按钮点击后无明显效果”的交互问题（重点覆盖学生端智能体面板）

关键改动文件：
- `frontend/src/pages/AIAgents/AssessmentPanel.tsx`
- `frontend/src/pages/AIAgents/ClassroomPanel.tsx`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`

### 2. 核心修复

- `AssessmentPanel`：刷新按钮不再只在 `list` 视图生效，`result` 视图可刷新结果数据；`quiz` 视图给出明确提示。
- `ClassroomPanel`：手动刷新增加可视化 loading 与成功/失败反馈；异常不再完全静默吞掉。
- `GroupDiscussionPanel`：手动刷新改为全量消息刷新（`afterId=0`），并增加 loading/禁用态，避免“点了没变化”的误判。

### 3. 验证结果

- `npm run -s type-check`（frontend）→ 通过
- `CI=true npm test -- --runInBand`（frontend）→ `53 suites / 280 tests passed`

---

## v1.5.1-hotfix.1（2026-03-24）

### 1. 变更范围

- 修复“小组讨论发送消息偶发重复两条”的问题（前后端双层防护）

关键改动文件：
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`
- `backend/app/services/agents/group_discussion.py`
- `backend/app/utils/cache.py`
- `backend/tests/test_group_discussion_send_message.py`
- `backend/tests/test_cache_set_nx.py`

### 2. 核心修复

- 前端发送增加同步防重入锁（`sendingRef`），避免 Enter/点击并发触发双发。
- 后端发送限流改为 Redis 原子 `SET NX EX`，消除 `exists + set` 并发竞态。
- Redis 锁未获取时优先读取 TTL 返回剩余等待秒数；TTL 不可用时继续 DB 回退校验，保证降级安全。
- 缓存工具新增 `cache.set(..., nx=True)` 能力，供原子限流等场景复用。

### 3. 配置影响

- 无新增配置项。
- 继续沿用 `GROUP_DISCUSSION_RATE_LIMIT_SECONDS`、`GROUP_DISCUSSION_REDIS_ENABLED`。

### 4. 验证结果

- 新增测试：`tests/test_group_discussion_send_message.py`、`tests/test_cache_set_nx.py`
- 执行结果：
  - `pytest -q tests/test_group_discussion_send_message.py tests/test_cache_set_nx.py` → `3 passed`
  - `pytest -q tests/test_rate_limit.py tests/test_chat_stream.py tests/test_openrouter_fallback.py` → `16 passed`
  - `npm run -s type-check`（frontend）→ 通过

---

## v1.5.1（2026-03-24）

### 1. 变更范围

- 智能体对话稳定性修复（OpenRouter + 多平台并用）
- 登录时效切换为短时策略（Access 60 分钟 / Refresh 7 天）
- 版本号统一管理（单一来源）
- 文档与部署默认值同步到 `1.5.1`

关键提交：
- `d1f4798` `fix(auth,agents): harden login/session expiry and multi-provider stream reliability`
- `c633539` `chore(test): add frontend jest and babel config files`
- `9d50115` `chore(release): sync config and docs defaults to 1.5.1`
- `a5e3572` `chore(release): centralize version resolution via VERSION file`

### 2. 核心修复

- OpenRouter 运行时请求头与连接测试统一：`HTTP-Referer`、`X-Title`
- `/ai-agents/stream` 在上游 `HTTP 200` 且无文本时仍发送 `message_end`
- 前端流式引擎空结果明确报错（避免前端挂起/空消息）
- OpenRouter 全局 Key 不再兜底到 SiliconFlow 等非 OpenRouter endpoint

### 3. 配置影响

必看配置项：
- `ACCESS_TOKEN_EXPIRE_MINUTES=60`
- `REFRESH_TOKEN_EXPIRE_DAYS=7`
- `COOKIE_SECURE`：
  - HTTPS 生产建议 `true`
  - HTTP 场景需 `false`

多平台并用注意：
- OpenRouter 与 SiliconFlow 需分别在智能体配置中填写各自 `api_endpoint + api_key`

### 4. 版本统一机制

默认版本单一来源：
- 根目录 `VERSION`

脚本行为：
- `build_images.sh` 优先读取 `VERSION`
- 自动派生：`APP_VERSION`、`IMAGE_TAG`、`REACT_APP_VERSION`
- 临时覆盖方式：
  - `./build_images.sh 1.5.2`

### 5. 构建与部署（生产）

```bash
# 1) 确认版本
cat VERSION

# 2) 构建镜像
bash build_images.sh

# 3) 推送镜像
docker compose push

# 4) 服务器拉取并启动
docker compose pull && docker compose up -d

# 5) 健康检查
curl http://localhost:6608/health
```

### 6. 验证基线

- 后端测试：`105 passed`
- 前端测试：`53 suites / 280 tests passed`
- 前端 type-check：通过
- 前端 lint：`0 errors, 68 warnings`（基线告警）

### 7. 回滚参考

- 回滚到 `1.5.0`：
  - 将 `VERSION` 改为 `1.5.0`（或设置 `VERSION_OVERRIDE=1.5.0`）
  - 重新执行 `build/push/pull-up`

---

## 维护约定

- 每次发布后都在本文件追加新版本记录（按时间倒序）。
- 每条记录至少包含：`变更范围`、`配置影响`、`部署步骤`、`验证结果`、`回滚点`。
