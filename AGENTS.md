# Agent Instructions for WangSh

本文件是 WangSh 项目的默认 Agent 操作指南。任何自动化编码助手在本仓库工作时，都应优先遵守这些规则。

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
| `--ws-color-accent` | `#7C3AED` (Violet) | 强调、焦点环 |
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
- 当前运行时只启用浅色主题；样式仍必须使用 Tailwind token（映射到 `--ws-*` 变量），
  避免阻碍未来启用深色主题：
  - `text-primary` / `bg-primary` / `bg-primary-soft`
  - `text-text-base` / `text-text-secondary` / `text-text-tertiary`
  - `bg-surface` / `bg-surface-2`
  - `border-border` / `border-border-secondary`
  - `text-accent` / `bg-[var(--ws-color-primary-muted)]`
- ECharts/SVG/Canvas 使用 `var(--ws-color-*)` 变量，确保当前浅色主题可读并保留未来
  深色主题的切换能力。
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

## 项目特殊风险

- PythonLab 涉及 Docker、WebSocket、沙箱、并发和可见性验证，风险高。相关改动要阅读对应脚本/测试说明，并按范围运行 smoke/soak。
- PythonLab 调试控制按钮（`Run`、`Debug`、`Pause`、`Continue`、Step 系列、`Reset`）优先保证真实点击可靠性，默认只用原生 `title` 和 `aria-label`。
- 不要在 PythonLab 调试控制按钮上引入 Radix Tooltip 或同类依赖 portal、hover 状态机、pointer outside、focus restore 的复杂弹层，除非完成真实 Chrome channel 和 WebKit 验证。
- 涉及 PythonLab tooltip、hover、pointer、focus、Radix 弹层或调试状态切换时，必须覆盖多断点连续 `Continue`、hover 状态真实 pointer click，不要只依赖 JS `button.click()` 或默认 Chromium smoke。
- Docker Compose 开发和生产模式不同，不要混用配置或同时启动混淆的栈。
- 当前 UI 运行时为浅色主题；改动必须使用语义 token，避免硬编码黑色、白色或不存在
  的 CSS 变量，为未来深色主题保留兼容空间。
- ECharts、SVG、Canvas 等场景使用 CSS 变量时要确认变量存在且在当前浅色主题可读。
- 大仓库中避免无目标搜索、全量格式化或批量重命名。
