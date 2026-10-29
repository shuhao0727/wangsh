# Agent Instructions for WangSh

适用范围：`/Users/wsh/wangsh` 仓库及明确属于 WangSh 的工作树。本文是项目规则，不是 Codex 全局规则；下述技术栈、命令、设计系统、部署与文档要求只用于本项目，不扩散到教学、论文、课题或其他仓库。

Codex 全局协作原则由 `/Users/wsh/.codex/AGENTS.md` 维护。本项目内结合全局原则与本文执行；模块中另有更细规则时，按其适用范围补充。跨到其他项目工作，应读取目标项目的规则，不沿用本文的具体实现约束。

## 项目概览

- WangSh 是教育平台项目，包含前端、后端、Docker 部署、后台管理、AI 智能体、测评、PythonLab 等模块。
- 前端：React 19、TypeScript、Vite、Tailwind CSS、TanStack Query、TanStack Table。
- 后端：FastAPI、SQLAlchemy async、PostgreSQL、Redis、Celery、Alembic。
- 本地开发常用端口：前端 `6608`，后端 `8000`。
- 生产和开发 Docker Compose 配置不同，不要混用开发栈和生产模拟栈。

## 仓库规模和搜索约束

这个仓库体积较大，处理项目时必须优先避免全量递归扫描。

- 不要对仓库根目录运行递归 `directory_tree` 或等价的大范围目录树扫描。
- 不要读取或遍历 `node_modules/`、`frontend/node_modules/`、`frontend/build/`、`backend/venv/`、`data/`、`.git/`、`dist/`、`coverage/`。
- 需要了解结构时，先读取 `README.md`、`docs/README.md`、`docs/DOCUMENTATION_RULES.md`、`frontend/package.json`、`backend/requirements.txt`，再按需查看具体子目录。
- 搜索代码优先使用 `rg`，并排除大目录，例如：
  `rg "关键词" --glob '!node_modules/**' --glob '!frontend/build/**' --glob '!backend/venv/**' --glob '!data/**'`。
- 如果必须列目录，只列目标子目录的第一层，不要对项目根目录做深层遍历。

## 开发前阅读顺序

通用任务先读：

1. `README.md`
2. `docs/README.md`
3. `docs/DOCUMENTATION_RULES.md`
4. `frontend/package.json`
5. `backend/requirements.txt`

模块任务再读对应文档或 README：

- API 相关：`docs/development/API.md`
- 认证权限：`docs/features/AUTH.md`
- 后端测试：`backend/tests/README.md`
- 后端脚本：`backend/scripts/README.md`
- 前端脚本：`frontend/scripts/README.md`
- 根脚本：`scripts/README.md`
- Docker/部署：`docs/docker/README.md` 和 `docs/docker/deploy/DEPLOY.md`
- PythonLab：`docs/features/PYTHONLAB.md`
- 文档整理/归档：`docs/DOCUMENTATION_RULES.md`、`docs/scripts/ARCHIVE_INDEX.md`、对应 archive README

## 本地开发和常用命令

根目录常用命令：

```bash
bash start-dev.sh
bash stop-dev.sh
```

前端命令在 `frontend/` 下运行：

```bash
npm run dev
npm run type-check
npm run test
npm run lint
npm run build
```

后端测试在 `backend/` 下运行：

```bash
pytest -q
pytest -q tests/auth
pytest -q tests/xbk
pytest -q tests/group_discussion
```

按改动范围选择最小可靠验证。前端样式和 TS 改动至少运行 `npm run type-check`。

## 设计系统

WangSh 使用 Tech Cyan + Bento Grids 设计风格。所有颜色通过 `--ws-*` CSS 变量三层架构管理：

```
CSS 变量 (index.css) → Tailwind 映射 (tailwind.config.js) → shadcn/ui 别名
```

### 关键文档
- `frontend/src/styles/COLORS.md` — 色彩语义规范
- `frontend/src/styles/ROLES.md` — 角色权限矩阵

### 核心色彩
| Token | 值 | 用途 |
|-------|-----|------|
| `--ws-color-primary` | `#0D9488` (Teal) | 按钮、链接、主色 |
| `--ws-color-accent` | `#7C3AED` (Violet) | 强调、焦点环、选中左条 |
| `--ws-color-secondary` | `#7C3AED` (Violet) | 仅品牌装饰/插画，不参与主交互 |
| `--ws-color-bg` | `#F0FDFA` (Mint) | 页面背景 |
| `--ws-color-primary-muted` | `#CCFBF1` | 柔色背景 |

### 禁止事项
- ❌ 硬编码色值（`#xxx`、`bg-sky-500`）
- ❌ 使用不存在于 `index.css` 的 CSS 变量
- ✅ 始终使用 `var(--ws-color-*)` 或 Tailwind token

## 前端约定

- 使用项目已有 UI 组件，优先使用 `frontend/src/components/ui`（shadcn/ui）和 `frontend/src/components/Admin`。
- Admin 页面优先使用 `AdminPage`、`AdminTablePanel`、`AdminFilterBar`、`DataTable`、`DataTablePagination`。
- 数据请求优先走 `frontend/src/services` 和 `frontend/src/hooks/queries` 中已有模式。
- TanStack Query 必须使用 `queryKeys`，不要新增散落的字符串 query key。
- Toast 优先使用 `showMessage`。
- 表格列宽、分页、空状态优先复用 `frontend/src/components/ui/data-table.tsx` 和 `frontend/src/constants/tableDefaults.ts`。
- 项目为**永久浅色主题**，不做深色/暗色模式。样式仍必须使用 Tailwind token（映射到
  `--ws-*` 变量），保证单一配色源与全局一致性：
  - `text-primary` / `bg-primary` / `bg-primary-soft`
  - `text-text-base` / `text-text-secondary` / `text-text-tertiary`
  - `bg-surface` / `bg-surface-2`
  - `border-border` / `border-border-secondary`
  - `text-accent` / `bg-[var(--ws-color-primary-muted)]`
- ECharts/SVG/Canvas 使用 `var(--ws-color-*)` 变量，确保当前浅色主题可读且一致。
- 不要随意新增 CSS 文件。确有必要时，优先确认现有 Tailwind token 和全局样式无法满足。
- 避免破坏懒加载和重型模块拆分，尤其是 Monaco、Graphviz、Typst、PDF、Xterm、PythonLab 相关模块。
- `body` 可能由全局布局控制滚动，页面滚动应按现有 Admin/Layout 模式处理。

## 后端约定

- API 路由位于 `backend/app/api`，业务逻辑优先放入 `backend/app/services`。
- SQLAlchemy 模型位于 `backend/app/models`，Pydantic schema 位于 `backend/app/schemas`。
- 数据库会话使用现有 `AsyncSession` 和依赖注入模式。
- 权限和用户上下文使用 `backend/app/core/deps.py` 中的依赖，不要绕过 `get_current_user`、`require_admin`、`require_student` 等既有机制。
- 写 DB 时遵循现有模式：变更、`commit`、必要时 `refresh`，异常时 `rollback`。
- 新模型必须确保被 `backend/app/models/__init__.py` 导入，否则 Alembic autogenerate 可能漏掉。
- 生产结构变更必须走 Alembic migration，不要依赖开发用 `Base.metadata.create_all`。
- Redis、Celery、SSE 等模块已有降级和鉴权约定，扩展时跟随本模块现有风格。

## 数据库和迁移规则

- 改表结构、索引、约束、枚举、持久化字段时，必须先说明迁移影响并考虑 Alembic。
- 不要随意改历史数据。需要批量修复数据时，先确认范围、回滚策略和验证方式。
- 如果只是展示、筛选、搜索增强，优先复用现有字段，除非用户明确要求新增正式字段。
- 不要把启动时自动建表当作正式迁移方案。
- 不要把裸 SQL 脚本当作生产结构变更入口。索引、视图、约束等正式 DB 变更必须转 Alembic migration。
- 发现散落的数据库分析或索引 SQL 时，先判断是历史草案、只读诊断、还是待迁移建议；不确定时保留并标注，不要直接删除。
- 删除或归档数据库脚本前，必须检查 README、workflow、文档引用和 Alembic 覆盖情况。

## 文档同步规则

遵守 `docs/DOCUMENTATION_RULES.md`；该文件统一维护 owner、生命周期和清理规则。

- API 行为或契约变化：更新 `docs/development/API.md`。
- DB/model/migration 变化：更新相关功能或数据库文档。
- 部署、环境变量、Docker、网关变化：更新 `docs/docker/deploy/DEPLOY.md` 或相关 Docker 文档。
- CI/CD 变化：更新 `docs/docker/deploy/CICD.md`。
- 测试、smoke、脚本治理变化：更新对应 README，例如 `backend/scripts/README.md`、`frontend/scripts/README.md`、`scripts/README.md`。
- 重要 bug fix 或行为变化：按项目规则更新 `RELEASE_NOTES.md`。
- 文档移动、归档、redirect 或删除时：更新 `docs/README.md`、对应目录 README、archive README 和所有旧路径引用。
- 已完成报告、日期型事故、过期计划应先把长期结论沉淀到 owner 文档，再移入 `docs/docker/archive/`。
- 被整合的旧文档优先转短 redirect；只有确认无唯一历史价值且已有替代内容时才删除。

## 项目规则自动维护

- **持续授权与触发**：用户已授权在 WangSh 任务中主动维护本项目已有的 `AGENTS.md`。已确认采用且完成相应验证的工程约定、工作流程、入口或命令发生变化，或发现确需长期防范的已定位陷阱时，应在本次任务收尾前同步相关规则，不等用户再提醒；本轮明确只读或禁止更新时遵守该限制。
- **项目证据优先**：更新依据是用户已确认的项目决定及当前适用分支/工作树中的代码、配置、测试与权威文档。实现与规则冲突时，先判断是实现回归还是已确认的约定变化；不能仅因当前代码这样写就改规则，更不能为绕过失败测试或质量门禁而放宽规则。
- **按归属落位**：全仓通用的 Agent 操作约束写本文件，仅某模块适用的约束优先更新其已有下级 `AGENTS.md` 或模块 README；API、数据库、部署、测试等细节仍由 `docs/DOCUMENTATION_RULES.md` 指定的 owner 文档维护，本文件只保留必要约束和入口，不复制整套细则。
- **不固化过程状态**：一次性修复通常落在代码、回归测试和对应 owner 文档；只有会长期影响后续 Agent 工作的结论才进入规则。未采纳方案、实验分支、临时绕过、待发布状态和本次测试数字不写成永久约定，分别留在计划或既有状态文档。
- **限定修改范围**：先核对相关规则、实际来源和工作区已有改动，再对原位置做最小修订，清理确已被替代的同主题表述；不为每次修复新增规则文件，不覆盖其他任务的改动，不自动改写 Codex 全局规则或其他项目规则。发现跨项目价值，也须按全局规则的独立门槛判断，不能直接推广 WangSh 实现。
- **不扩大执行授权**：规则同步只授权必要文档维护，不附带部署、重启、改生产配置、执行数据库迁移、清理数据或发布版本的权限；架构、权限、安全和发布策略的未确认取舍，先说明并确认，已明确授权的决定不反复确认。
- **验证与交付**：回读修改内容，核对引用及命令来源，运行相关 Markdown 检查和差异检查；需要代码行为验证时按实际影响选取测试，不能把文档检查当作运行验证。结果中简要说明更新位置、触发依据及验证；没有需要沉淀的项目约束时，不做凑数更新。

## 脚本和临时文件

- `scripts/` 只放跨模块、运维、部署、统一入口脚本。
- `backend/scripts/` 只放维护中的后端 smoke、soak、DB 初始化或专项验证脚本。
- `frontend/scripts/` 只放 npm、CI、生产 smoke 或治理相关脚本。
- 不要把一次性排查脚本、截图脚本、临时调试脚本提交到项目脚本目录。
- 临时实验优先使用系统临时目录或明确的外部 scratch 空间。
- 删除脚本前必须检查 `package.json`、GitHub workflows、README、生产 smoke 编排和文档引用。
- 删除历史脚本后更新 `docs/scripts/ARCHIVE_INDEX.md`，说明原路径、类型和删除原因。
- 可重建生成物（`.DS_Store`、`__pycache__`、`.coverage`、测试结果截图等）可清理，但不要误删近期仍需人工复核的证据。
- 含明文账号、密码、token、Cookie 的一次性脚本应优先删除或改为环境变量，并提醒轮换凭据。

## 项目整理和清理流程

- 移除无用代码、过期注释、绕过代码前：检查 Git 历史，确认无历史复盘价值再清理。
- 整理文档时遵守 `docs/DOCUMENTATION_RULES.md`，优先归档或 redirect，少删除。
- 大规模重命名或批量格式化前，必须核对影响范围并确认没有其他待合并改动。
- 不要批量删除 README 或功能文档中的测试、部署、FAQ、历史记录、烟测结果；除非替代内容已沉淀、引用已完整清理。

## Git 规则

- 不要使用破坏性 Git 命令，例如 `git reset --hard`、`git checkout --`、强推等，除非用户明确批准。
- 工作区可能有用户或其他 agent 的改动。不要回滚、覆盖或整理不属于当前任务的改动。
- 修改前后按需检查 `git status` 和相关 diff，但不要把 unrelated changes 当作自己的改动。
- **不要用 `git add -A` / `git add .` 提交**，一律显式列出文件路径。
  多 agent 并行或验证进行中时，工作区随时会冒出别人的临时文件；`-A` 会把它们一并带走。
  实测事故：`0251f52` 用 `git add -A` 把验证 agent 在跑测期间生成的两个一次性探针
  （`frontend/s46-radar-check.html`、`frontend/src/components/__s46_radar_entry.tsx`）
  提交进了仓库，事后需要 `8d3ab7b` 再删一次。显式列出路径成本极低，却能避免这类返工。
- 提交前用 `git status --porcelain` 复核暂存清单，确认只有本次任务的文件。

## 发布与部署约束

**这一节每一条都来自真实事故，不是理论要求。**

### 部署节奏：先本地、攒批、一次中断

- **默认在本地完成开发与验证，攒成一个版本后再部署**。不要「改一点 → 传服务器 → 重建 → 再改」：
  生产上有真实师生在用，`docker compose up -d` 会中断 30–60 秒，`build` 会抢占 CPU 与内存。
  一轮 6 次重建就是 6 次打扰。
- 部署前确认时机（使用低谷、无人正在使用），一次只中断一次。
- 只读操作（查日志、查库、跑只读脚本）可随时做；**重建与重启必须先确认**。

### 部署后必须做代码特征核对，健康检查不算验证

- `/api/health` 返回 `healthy` **只证明服务活着，不证明容器里是新的代码**。
- 实测教训：2.2.1 部署后 18 项健康检查全过，但镜像里根本没有评分修复代码——
  以为上线了、实际没上线，排查一整轮才发现。
- 核对：挑本版引入的独特符号（常量名/函数名/注释片段），
  `git show <提交>:<文件> | grep -c <符号>` 与
  `docker exec <容器> grep -c <符号> /app/<路径>` 应相等。
- **容器跑镜像，不读源码目录**：只 `cp` 文件进服务器源码目录再 `restart` 不会生效。

### 标签必须打在构建源上

- 先在**实际用于构建的提交**上打标签，再构建；不要部署完再把标签打在收尾的文档提交上。
- 连续踩过两次：2.2.1 标签比镜像新 5 个提交、2.2.2 标签比镜像旧 3 个提交。
  根因相同——镜像先建、之后又追加文档提交、标签却打在那个提交上。
- 已发布的标签需修正时，**新建订正标签而非强推重写**；强推会让已拉取的人与 CI 缓存不一致。
- 详见 [部署指南的标签规则](docs/docker/deploy/DEPLOY.md#标签必须打在构建源上血泪教训)。

### 生产镜像只能通过 `docker compose build`

- 六个生产镜像都在 `docker-compose.yml` 有 build 段，包括位置特殊的
  `pythonlab-sandbox`（`backend/docker/pythonlab-sandbox/`）。
- compose 按服务的 `platform: linux/amd64` 强制交叉编译；**裸 `docker build` 不读该字段**，
  在 Apple Silicon 上会产出 arm64。本机 `docker run` 完全正常，推到 x86 服务器才炸。
- 构建后先跑 `bash scripts/deploy.sh verify-local-images`，校验镜像存在性与平台。

### 服务器与 main 的一致性

- 服务器发布目录**不是 git 仓库**（纯拷贝），不产生代码；方向永远是 `本地 → main → 服务器`。
- 手动 `scp` 传文件**会漏**（实测漏过 `.env.example`），一致性只能靠事后全量比对发现。
- 比对时排除 `data/`、`backups/`、`.env*`、`*.bak*`，只比运行代码与配置。

### 本地代理会干扰服务端网络判定

- 本机开着 Clash / Surge / sing-box 等代理时，它们的 **fake-ip 模式**会把所有域名
  解析成保留段地址（`198.18.x.x`、`2001:2::x`）。浏览器和 `curl` 照样能通，
  因为代理在那地址上转发；但**服务端按 IP 段做的安全判定会把它当内网拒绝**。
- 因此：本地出现「服务端说地址不可达/不安全，但我浏览器能打开」时，先查
  `dig +short <域名>` 拿到的是不是 `198.x` 段，再判断是代码问题还是代理问题。
- **不能用环境问题一句话带过**：实测过 `curl -sv` 显示 `Trying 198.18.1.8:443`
  且连接成功（401），说明该地址是合法入口，问题出在设计把「保留段」等同于「内网攻击」。
  判定应当按真实风险分级，而不是按 `is_private` 一刀切。
- SSRF 放行范围的取舍见 [AI_AGENTS 的 SSRF 说明](docs/features/AI_AGENTS.md)：
  **基准测试段放行，云元数据与 RFC 1918 私网永远拒绝**。

## 验证纪律

### 退出码为 0 不等于做成了事

- 命令 `exit 0` 只说明「没报错」，不说明「产生了预期结果」。
- 实测：`docker compose build --no-cache` 之外的普通 rebuild 全部命中缓存、`exit 0`，
  但镜像的 `CreatedSince` 还是 27 小时前——**等于没重建**。
  要验证结果状态（镜像时间、文件内容、进程状态），不要只看退出码。
- 同理，`git push` 成功只说明推上了，不代表 CI 会过、不代表内容正确。

### 抓真实样本，不要手写复现

- 排查线上问题时，**从生产抓真实样本**存成 fixture，而不是凭想象构造测试输入。
- 实测教训：手写「损坏 JSON 样本」时构造出的其实完全合法，`json.loads` 不报错，
  测试直接失败、结论完全跑偏。模型产生的损坏形态是随机的，只有真实样本靠得住。
- 排查失败**先让日志说话**：如果代码只记录异常类型不记录原始输出，
  就先把原始输出（截断）加进日志；否则一轮排查下来一个样本都拿不到。

### 区分「实测」与「推断」，不编造数字

- 报告里凡涉及成功率、耗时、数量，都要说明数据来源与样本量。
- 样本不足时明说「样本量不足，无法给出统计结论」，改为逐条形态分析，**不要凑数字**。
- 估算被实测推翻时，如实订正原估算，不要沿用。

## 项目特殊风险

- PythonLab 涉及 Docker、WebSocket、沙箱、并发和可见性验证，风险高。相关改动要阅读对应脚本/测试说明，并按范围运行 smoke/soak。
- PythonLab 调试控制按钮（`Run`、`Debug`、`Pause`、`Continue`、Step 系列、`Reset`）优先保证真实点击可靠性，默认只用原生 `title` 和 `aria-label`。
- 不要在 PythonLab 调试控制按钮上引入 Radix Tooltip 或同类依赖 portal、hover 状态机、pointer outside、focus restore 的复杂弹层，除非完成真实 Chrome channel 和 WebKit 验证。
- 涉及 PythonLab tooltip、hover、pointer、focus、Radix 弹层或调试状态切换时，必须覆盖多断点连续 `Continue`、hover 状态真实 pointer click，不要只依赖 JS `button.click()` 或默认 Chromium smoke。
- Docker Compose 开发和生产模式不同，不要混用配置或同时启动混淆的栈。
- 镜像命名与清理遵循 [部署指南的镜像命名与整理](docs/docker/deploy/DEPLOY.md#镜像命名与整理)：开发镜像统一用 `:dev`，不要再新增含长日期或工作树名称的标签，也不要保留无实际引用的 `latest` 别名。
- 最新版本按 [版本管理](docs/docker/deploy/DEPLOY.md#版本管理) 核对源码提交、版本配置、构建记录与 release-set；不要把旧验证镜像的较大版本号当作最新正式发布。
- 当前 UI 为**永久浅色主题**；改动必须使用语义 token，避免硬编码黑色、白色或不存在
  的 CSS 变量。不做深色/暗色模式，无需为未来换肤预留兼容空间。
- ECharts、SVG、Canvas 等场景使用 CSS 变量时要确认变量存在且在当前浅色主题可读。
- 大仓库中避免无目标搜索、全量格式化或批量重命名。
