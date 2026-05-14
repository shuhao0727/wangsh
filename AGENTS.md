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
- 需要了解结构时，先读取 `README.md`、`docs/README.md`、`docs/DOCUMENTATION_RULES.md`、`docs/DOCUMENTATION_OWNERSHIP.md`、`frontend/package.json`、`backend/requirements.txt`，再按需查看具体子目录。
- 搜索代码优先使用 `rg`，并排除大目录，例如：
  `rg "关键词" --glob '!node_modules/**' --glob '!frontend/build/**' --glob '!backend/venv/**' --glob '!data/**'`。
- 如果必须列目录，只列目标子目录的第一层，不要对项目根目录做深层遍历。

## 开发前阅读顺序

通用任务先读：

1. `README.md`
2. `docs/README.md`
3. `docs/DOCUMENTATION_RULES.md`
4. `docs/DOCUMENTATION_OWNERSHIP.md`
5. `frontend/package.json`
6. `backend/requirements.txt`

模块任务再读对应文档或 README：

- API 相关：`docs/development/API.md`
- 后端测试：`backend/tests/README.md`
- 后端脚本：`backend/scripts/README.md`
- 前端脚本：`frontend/scripts/README.md`
- 根脚本：`scripts/README.md`
- Docker/部署：`docs/docker/README.md` 和 `docs/docker/deploy/DEPLOY.md`
- PythonLab：`docs/features/PYTHONLAB.md`
- 文档整理/归档：`docs/DOCUMENTATION_OWNERSHIP.md`、`docs/scripts/ARCHIVE_INDEX.md`、对应 archive README

Claude 专属背景可参考：

- `docs/development/CLAUDE_GUIDE.md`
- `docs/development/CLAUDE_MEMORY.md`

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
- 深浅主题都必须考虑，颜色优先使用 Tailwind token（映射到 `--ws-*` 变量）：
  - `text-primary` / `bg-primary` / `bg-primary-soft`
  - `text-text-base` / `text-text-secondary` / `text-text-tertiary`
  - `bg-surface` / `bg-surface-2`
  - `border-border` / `border-border-secondary`
  - `text-accent` / `bg-[var(--ws-color-primary-muted)]`
- ECharts/SVG/Canvas 使用 `var(--ws-color-*)` 变量，确保深色模式可读。

## 登录系统

统一登录：所有角色（super_admin/admin/teacher/student）使用 **姓名 + 学号** 登录。

- 姓名 = full_name，学号 = student_id
- 向后兼容：有 `hashed_password` 的账号也可用密码登录
- Guest 模式：未登录可浏览，右上角显示"访客模式"
- 登录页：分栏布局 + 4 个动画角色（Tech Cyan 配色），眼睛跟随鼠标
- 登录后跳转：teacher → 课堂互动，admin → Dashboard，student → 首页
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

遵守 `docs/DOCUMENTATION_RULES.md` 和 `docs/DOCUMENTATION_OWNERSHIP.md`。

- API 行为或契约变化：更新 `docs/development/API.md`。
- DB/model/migration 变化：更新相关功能或数据库文档。
- 部署、环境变量、Docker、网关变化：更新 `docs/docker/deploy/DEPLOY.md` 或相关 Docker 文档。
- CI/CD 变化：更新 `docs/docker/deploy/CICD.md`。
- 测试、smoke、脚本治理变化：更新对应 README，例如 `backend/scripts/README.md`、`frontend/scripts/README.md`、`scripts/README.md`。
- 重要 bug fix 或行为变化：按项目规则更新发布或测试相关文档。
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

大范围整理必须先审计再修改。优先使用多 agent 并行只读审计，至少按文档、脚本、前端、后端分区返回候选和证据。

- 分类处理候选：直接删除、归档、redirect、保留但加状态、需要人工确认。
- 第一批只处理高可信低风险项，例如生成物、`.backup` 残留、未引用且含敏感信息的一次性脚本、已完成且已沉淀结论的报告。
- 不要删除 Alembic 历史迁移、部署/回滚脚本、当前 smoke/soak、PythonLab 关键验证脚本或兼容层，除非完成专项审计和验证。
- 移动文档时同步修正旧路径引用；移动到 archive 后更新 archive README。
- 清理后至少运行 `git diff --check`，并按影响范围运行最小测试或构建。

## 安全和环境文件

- `.env`、`.env.dev`、前端 `.env` 等环境文件按敏感文件处理。
- 不要打印、复制、提交令牌、密钥、Cookie、数据库密码等 secrets。
- 发现用户在对话或文件中暴露 token，应提醒轮换。
- 不要主动清理 Git 历史或删除已存在环境文件，除非用户明确要求并理解影响。
- 不要修改外部 Docker 网络或生产相关资源，除非任务明确要求。

## Git 行为

- 不要主动 commit，除非用户明确要求。
- 不要主动 push，除非用户明确要求。
- 不要使用破坏性 Git 命令，例如 `git reset --hard`、`git checkout --`、强推等，除非用户明确批准。
- 工作区可能有用户或其他 agent 的改动。不要回滚、覆盖或整理不属于当前任务的改动。
- 修改前后按需检查 `git status` 和相关 diff，但不要把 unrelated changes 当作自己的改动。

## 角色权限系统

WangSh 有 5 级角色层级：`super_admin` > `admin` > `teacher` > `student` > `guest`。详细权限矩阵见 `frontend/src/styles/ROLES.md`。

### 前端角色检查

```typescript
import useAuth from "@hooks/useAuth";
const auth = useAuth();
auth.isSuperAdmin();  // 仅 super_admin
auth.isAdmin();       // admin OR super_admin
auth.isTeacher();     // 仅 teacher
auth.isStaff();       // teacher OR admin OR super_admin
auth.isStudent();     // 仅 student
```

- `AdminGuard.tsx` 用 `isStaff()` 做路由准入（教师也可进 `/admin/*`）
- `AdminLayout.tsx` 用 `menuWhitelist` 按角色过滤侧边栏菜单
- `Login.tsx` 登录后按角色跳转：teacher → classroom，admin → dashboard，student → home

### 后端权限依赖

```python
from app.core.deps import require_super_admin, require_admin, require_staff, require_student
```

- `require_staff()` = teacher/admin/super_admin
- `require_admin()` = admin/super_admin
- `require_super_admin()` = super_admin only

### 用户管理保护

- 管理员**不能**修改/删除超级管理员和其他管理员
- 管理员**只能**将角色改为 student 或 teacher
- 导入时管理员**只能**导入 student/teacher 角色
- 超级管理员默认不在用户列表中显示

### 修改角色系统 checklist

1. 后端：`deps.py`、`services/auth.py`、`endpoints/auth/auth.py`、`endpoints/management/users/users.py`
2. 前端：`useAuth.ts`、`AdminGuard.tsx`、`AdminLayout.tsx`、`UserMenu.tsx`、`Login.tsx`
3. 用户管理：`Users/data.ts`、`Users/columns.tsx`、`Users/UserForm.tsx`
4. 文档：`ROLES.md`

## 项目特殊风险

- PythonLab 涉及 Docker、WebSocket、沙箱、并发和可见性验证，风险高。相关改动要阅读对应脚本/测试说明，并按范围运行 smoke/soak。
- PythonLab 调试控制按钮（`Run`、`Debug`、`Pause`、`Continue`、Step 系列、`Reset`）优先保证真实点击可靠性，默认只用原生 `title` 和 `aria-label`。
- 不要在 PythonLab 调试控制按钮上引入 Radix Tooltip 或同类依赖 portal、hover 状态机、pointer outside、focus restore 的复杂弹层，除非完成真实 Chrome channel 和 WebKit 验证。
- 涉及 PythonLab tooltip、hover、pointer、focus、Radix 弹层或调试状态切换时，必须覆盖多断点连续 `Continue`、hover 状态真实 pointer click，不要只依赖 JS `button.click()` 或默认 Chromium smoke。
- Docker Compose 开发和生产模式不同，不要混用配置或同时启动混淆的栈。
- UI 改动必须考虑深色/浅色主题，避免硬编码黑色、白色或不存在的 CSS 变量。
- ECharts、SVG、Canvas 等场景使用 CSS 变量时要确认变量存在且在深色模式可读。
- 大仓库中避免无目标搜索、全量格式化或批量重命名。
