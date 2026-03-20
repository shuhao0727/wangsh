# WangSh 项目记忆文档

> 此文档供 AI 助手（Claude）在后续对话中参考，持续更新。
> 最后更新：2026-03-18

---

## 一、项目概览

- 项目名称：WangSh（教育平台）
- 当前版本：1.3.0
- 技术栈：FastAPI + React 19 + PostgreSQL 16 + Redis 7 + Celery + Docker
- 仓库路径：`/Users/wsh/wangsh`

---

## 二、开发模式 vs 生产模式 对比分析

### 2.1 启动方式

| 维度 | 开发模式 | 生产模式 |
|------|---------|---------|
| compose 文件 | `docker-compose.dev.yml` | `docker-compose.yml` |
| 环境文件 | `.env.dev`（从 `.env.dev.example` 复制） | `.env`（从 `.env.example` 复制） |
| 启动脚本 | `bash start-dev.sh`（本地混合启动） | `bash scripts/deploy.sh deploy` |
| 停止脚本 | `bash stop-dev.sh` | `bash scripts/deploy.sh down` |
| DEPLOYMENT_ENV | `development` 或 `docker` | `production` |

### 2.2 服务架构差异

#### 开发模式（8 个服务）
```
┌─────────────────────────────────────────────────┐
│  Caddy (端口 8080)  ← 统一入口                    │
│    ├── /api/*  → backend:8000                    │
│    └── /*      → frontend:6608 (React dev server)│
├─────────────────────────────────────────────────┤
│  backend     (FastAPI + uvicorn --reload)         │
│  frontend    (React dev server, 热更新)            │
│  typst-worker   (Celery worker, typst 队列)       │
│  pythonlab-worker (Celery worker, celery 队列)    │
│  postgres    (端口 5432 暴露到宿主机)              │
│  redis       (端口 6379 暴露到宿主机)              │
│  adminer     (端口 8081, 数据库管理 UI)            │
└─────────────────────────────────────────────────┘
```

#### 生产模式（9 个服务）
```
┌──────────────────────────────────────────────────┐
│  gateway (Caddy, 端口 6608) ← 统一入口             │
│    ├── /api/*  → backend:8000                     │
│    ├── /static/* → frontend:80 (长期缓存)          │
│    └── /*      → frontend:80 (Caddy 静态服务)      │
├──────────────────────────────────────────────────┤
│  backend     (FastAPI + uvicorn --workers N)       │
│  frontend    (Caddy 托管静态构建产物, 端口 80)       │
│  typst-worker   (Celery worker)                    │
│  pythonlab-worker (Celery worker)                  │
│  pythonlab-sandbox (sleep infinity, 按需启动容器)    │
│  postgres    (不暴露端口)                           │
│  redis       (不暴露端口)                           │
│  ❌ 无 adminer                                     │
└──────────────────────────────────────────────────┘
```

### 2.3 关键配置差异

| 配置项 | 开发模式 | 生产模式 |
|--------|---------|---------|
| DEBUG | `True` | `False` |
| LOG_LEVEL | `DEBUG` | `INFO` |
| BACKEND_RELOAD | `True`（热重载） | `False` |
| uvicorn 启动 | `--reload` 单进程 | `--workers N` 多进程 |
| 前端 | React dev server (端口 6608) | 静态构建 + Caddy 托管 (端口 80) |
| 代码挂载 | `./backend:/app` 卷挂载（实时同步） | 镜像内置代码（COPY） |
| Dockerfile | `Dockerfile.dev` (单阶段) | `Dockerfile.prod` (多阶段构建) |
| 数据库端口 | 暴露 5432 到宿主机 | 仅内部网络 |
| Redis 端口 | 暴露 6379 到宿主机 | 仅内部网络 |
| Adminer | 有 (端口 8081) | 无 |
| 资源限制 | 无 | 有（见下表） |
| 日志驱动 | 默认 | json-file (max 10m × 3) |
| 平台 | 本机架构 (arm64/amd64) | `linux/amd64` 固定 |
| 健康检查 | 基础 curl | 完整 healthcheck + 重试 |
| 数据库迁移 | 启动时 `AUTO_CREATE_TABLES=True` | 启动命令中 `alembic upgrade head` |
| COOKIE_SECURE | `False` | 自动强制 `True` |
| 安全校验 | 跳过（DEBUG=True） | 强制校验 SECRET_KEY/密码长度 |

### 2.4 生产模式资源限制

| 服务 | 内存上限 | CPU 上限 |
|------|---------|---------|
| postgres | 512M | 1.0 |
| redis | 256M | 0.5 |
| backend | 1024M | 2.0 |
| typst-worker | 512M | 1.0 |
| pythonlab-worker | 512M | 1.0 |
| pythonlab-sandbox | 32M | - |
| frontend | 256M | 0.5 |
| gateway | 256M | 0.5 |

### 2.5 网络与安全差异

| 维度 | 开发模式 | 生产模式 |
|------|---------|---------|
| 内部网络 | `wangsh-network` + `dify_network` | 同左 |
| 端口暴露策略 | PG/Redis/Adminer 全部暴露 | 仅 gateway:6608 对外 |
| SECRET_KEY | 可用简单值 | 强制 ≥32 字符，不能为默认值 |
| POSTGRES_PASSWORD | 可用简单值 | 必须设置，compose 用 `:?` 强制校验 |
| AGENT_API_KEY_ENCRYPTION_KEY | 可选 | 强制校验非空 |
| CORS_ORIGINS | `localhost:6608` | 需配置实际域名 |
| 代理清理 | 无 | 所有 `http_proxy/https_proxy` 强制清空 |
| Redis Sentinel | 关闭 | 可选开启高可用 |

### 2.6 构建与部署流程

#### 开发模式流程
```
start-dev.sh
  ├── 加载 .env.dev
  ├── 检查并释放占用端口 (5432, 6379, 8000, 6608)
  ├── docker compose -f docker-compose.dev.yml up (postgres, redis, adminer)
  ├── 本地启动 backend (uvicorn --reload)
  ├── 本地启动 frontend (npm start)
  └── 本地启动 celery worker (可选)
```
注意：`start-dev.sh` 支持混合模式 — 基础设施跑 Docker，业务代码跑本地进程，方便调试。也可以全部用 `docker-compose.dev.yml` 跑容器。

#### 生产模式流程
```
scripts/deploy.sh deploy
  ├── 读取 .env
  ├── docker compose pull (拉取预构建镜像)
  ├── docker compose up -d --no-build
  ├── 等待健康检查通过
  └── 输出访问地址

scripts/deploy.sh up (本地构建部署)
  ├── docker compose up -d --build (多阶段构建)
  └── 自动重试 3 次

scripts/deploy.sh push (推送镜像)
  ├── 读取 DOCKER_REGISTRY/DOCKERHUB_NAMESPACE/IMAGE_TAG
  └── docker push backend/frontend/worker 镜像
```

#### 镜像构建
```
build_images.sh
  ├── 构建 backend (Dockerfile.prod → backend_runtime)
  ├── 构建 frontend (Dockerfile.prod → 静态产物 + Caddy)
  ├── 构建 typst-worker (Dockerfile.prod → worker_runtime)
  ├── 构建 pythonlab-worker (Dockerfile.prod → pythonlab_worker_runtime)
  ├── 构建 gateway (gateway/Dockerfile → Caddy + Caddyfile)
  └── 构建 pythonlab-sandbox (backend/docker/pythonlab-sandbox/)
```

### 2.7 数据持久化

| 数据 | 开发模式 | 生产模式 |
|------|---------|---------|
| PostgreSQL | `./data/postgres` (bind mount) | `postgres_data` (named volume) |
| Redis | `./data/redis` (bind mount) | `redis_data` (named volume) |
| Typst PDF | `./data/typst_pdfs` (bind mount) | `typst_pdfs` (named volume) |
| PythonLab 工作区 | `./data/pythonlab/workspaces` | `./data/pythonlab/workspaces` |
| 上传文件 | `./data/uploads` | 镜像内 `/app/uploads` |

### 2.8 数据库迁移策略

- 开发模式：`AUTO_CREATE_TABLES=True`，FastAPI 启动时自动建表（适合快速迭代）
- 生产模式：启动命令中先执行 `python scripts/bootstrap_db.py && alembic upgrade head`，确保迁移有序执行
- Alembic 迁移文件位于 `backend/alembic/versions/`，共 14 个版本

### 2.9 配置智能适配机制

`backend/app/core/config.py` 中的 `Settings` 类实现了环境自适应：

1. `DEPLOYMENT_ENV=docker` → 自动将 `localhost/127.0.0.1` 替换为容器名（`postgres`/`redis`）
2. `DEPLOYMENT_ENV=production` → 保持环境变量原值
3. 未设置但检测到 `/.dockerenv` → 自动切换为容器内地址
4. `DEBUG=False` 时强制校验安全配置（SECRET_KEY ≥ 32 字符、密码非默认值）
5. `DEBUG=False` 时自动启用 `COOKIE_SECURE=True`
6. 连接池大小根据 DEBUG 自动调整（开发 20/生产 50）

---

## 三、项目目录结构

```
wangsh/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/endpoints/   # API 路由 (auth, agents, content, debug, informatics, xbk, xxjs)
│   │   ├── core/            # 配置、依赖注入、沙箱、会话守卫
│   │   ├── db/              # 数据库引擎
│   │   ├── models/          # 21 个 SQLAlchemy ORM 模型
│   │   ├── schemas/         # 21 个 Pydantic 校验模型
│   │   ├── services/        # 业务逻辑层
│   │   ├── tasks/           # Celery 异步任务 (typst, pythonlab, github_sync)
│   │   └── utils/           # 工具函数 (安全、缓存、限流)
│   ├── alembic/             # 数据库迁移
│   ├── main.py              # 入口
│   ├── Dockerfile.dev       # 开发镜像
│   └── Dockerfile.prod      # 生产镜像（多阶段）
├── frontend/                # React 19 + TypeScript 前端
│   ├── src/
│   │   ├── pages/           # 页面 (Home, AIAgents, Articles, PythonLab, Admin...)
│   │   ├── components/      # 公共组件
│   │   ├── services/        # API 调用层 (Axios)
│   │   ├── hooks/           # 自定义 Hooks
│   │   └── styles/          # 全局样式 + Ant Design 主题
│   ├── craco.config.js      # Webpack 定制
│   └── package.json
├── gateway/                 # Caddy 反向代理
│   ├── Caddyfile            # 生产配置
│   ├── Caddyfile.dev        # 开发配置
│   └── Dockerfile
├── scripts/                 # 部署与运维脚本
│   └── deploy.sh            # 统一部署入口
├── data/                    # 持久化数据目录
├── docker-compose.yml       # 生产 compose
├── docker-compose.dev.yml   # 开发 compose
├── start-dev.sh             # 开发启动脚本
├── stop-dev.sh              # 开发停止脚本
├── build_images.sh          # 镜像构建脚本
├── .env.example             # 生产环境配置模板
└── .env.dev.example         # 开发环境配置模板
```

---

## 四、核心业务模块

| 模块 | 说明 | 表前缀 |
|------|------|--------|
| 用户认证 | JWT + Redis 会话，四种角色 | `sys_` |
| AI 智能体 | 多 LLM 提供商，SSE 流式对话，小组讨论 | `znt_` |
| PythonLab | 可视化流程图编程，Docker 沙箱，DAP 调试 | Redis 会话 |
| 文章系统 | Markdown 文章，自定义样式，分类管理 | `wz_` |
| 信息学笔记 | Typst 文档编辑，PDF 编译，GitHub 同步 | `inf_` |
| 校本课选课 | 学生/课程/选课管理，Excel 导入导出 | `xbk_` |
| 信息技术课堂 | 点名/考勤 | `xxjs_` |

---

## 五、常用命令速查

```bash
# 开发
bash start-dev.sh          # 启动开发环境
bash stop-dev.sh           # 停止开发环境

# 生产部署
bash scripts/deploy.sh deploy       # 拉取镜像并部署
bash scripts/deploy.sh up           # 本地构建并部署
bash scripts/deploy.sh down         # 停止所有服务
bash scripts/deploy.sh logs         # 查看日志
bash scripts/deploy.sh health       # 健康检查
bash scripts/deploy.sh backup-db    # 数据库备份 (full/schema/data)
bash scripts/deploy.sh restore-db <dump>  # 数据库恢复
bash scripts/deploy.sh simulate     # 模拟部署测试

# 镜像
bash build_images.sh                # 构建所有镜像
bash scripts/deploy.sh push         # 推送镜像到 DockerHub
```

---

## 六、重要注意事项（勿动）

- `dify_network`（external: true, name: docker_default）：生产环境中 WangSh 和 Dify 部署在同一台 Linux 服务器上，AI 智能体需要调用 Dify 的 API，此网络是两者通信的桥梁。绝对不要修改为非 external 或删除。
- `.env` 和 `.env.dev` 已提交到 Git 仓库，用户知晓且接受，不需要从 Git 历史中清除。

---

## 七、已完成的修复（2026-03-17）

1. `/verify` 接口：token 无效时正确返回 `valid: False`（之前始终返回 True）
2. 会话验证降级放行：异常时拒绝请求返回 401（之前 catch Exception 后直接放行）
3. DEBUG 默认值：从 `True` 改为 `False`（防止生产环境意外暴露调试信息）
4. SVG XSS：PipelineTab.tsx 的 dangerouslySetInnerHTML 加上 DOMPurify 消毒
5. 上传文件持久化：生产 compose 增加 `uploads_data` 卷挂载到 `/app/uploads`
6. CSP 策略：增加 `object-src 'none'`、`frame-ancestors 'none'`、`form-action 'self'` 等限制
7. TSC_COMPILE_ON_ERROR：修复 21 个 TS 类型错误后去掉该标志
8. 涉及文件：ir.ts、python_runtime.ts、cfg_to_flow.ts、useBeautifyFlow.ts、TypstNoteEditor.tsx

---

## 八、全功能测试结果（2026-03-17）

49 项测试全部通过。

| 阶段 | 测试项 | 结果 |
|------|--------|------|
| 1. 认证系统 | 登录、/me、/verify(有效/无效)、刷新、登出、未授权 | 7/7 PASS |
| 2. 用户管理 | 列表、创建、详情、更新、删除、权限检查 | 6/6 PASS |
| 3. 文章系统 | 分类创建、文章CRUD、发布、公开列表、公开分类 | 10/10 PASS |
| 4. AI 智能体 | 列表、活跃、统计、使用记录、对话、权限、小组讨论 | 7/7 PASS |
| 5. 信息学笔记 | 笔记列表、公开笔记、公开样式、GitHub同步、权限 | 5/5 PASS |
| 6. 系统与安全 | 健康检查、根路径版本、安全头(5项)、Feature Flags、系统概览、权限 | 6/6 PASS |
| 7. 前端页面 | home、login、ai-agents、informatics、it-technology、articles、personal-programs、admin | 8/8 PASS |

备注：
- 版本信息通过 `GET /` 获取（无独立 `/version` 端点）
- 公开笔记路径：`/api/v1/public/informatics/typst-notes`
- 公开样式路径：`/api/v1/public/informatics/typst-style`
- 文章创建需要 `author_id` 字段

---

## 九、UI 全面优化（2026-03-18）

### 主题色
- 从 `#1677ff`（Ant Design 蓝）→ `#0EA5E9`（天空蓝 Sky 500）
- 辅助色：`#06B6D4`（Cyan）
- 成功：`#10B981`，警告：`#F59E0B`，错误：`#EF4444`
- 页码激活色：`#0284C7`（深蓝，保证白字对比度）

### 设计风格
- 无阴影、无边框、干净融合
- 背景统一白色 `#FFFFFF`，区块用 `#FAFAFA` 微灰区分
- 分隔线统一 `rgba(0,0,0,0.04)`
- 卡片 hover 用柔和背景色变化，不上浮不加阴影
- 按钮/输入框圆角 8px，卡片圆角 12px

### 修改范围
- 全局：antdTheme.ts、index.css、ui-polish.css、markdown.css
- 布局：BasicLayout、AdminLayout（头部/侧边栏/菜单）
- 公开页面：首页、登录、AI 智能体、文章列表/详情、信息学阅读器、IT 技术、个人程序、XBK
- 管理后台：Dashboard、用户管理、智能体管理、文章管理、分类管理、系统设置等 12 个页面
- 编辑器：文章编辑器、信息学编辑器
- 弹窗：全局 Modal 样式统一（圆角 12px、padding 24px）
- 颜色统一：消除所有旧硬编码颜色（#1677ff、#1890ff、#3498db、#52c41a 等）

### 注意事项
- `var(--ws-color-border)` 和 `var(--ws-color-border-secondary)` 现在是 `transparent`
- 需要可见分隔线时直接用 `rgba(0,0,0,0.04)` 或 `rgba(0,0,0,0.06)`
- 不要用 `var(--ws-color-primary-bg)`（不存在），用 `var(--ws-color-primary-soft)`

---

## 十、页面布局逐页优化（2026-03-18）

### 已完成的页面
- 首页：模块卡片居中对齐、独特图标背景色、Banner 渐变装饰
- AI 智能体聊天：侧边栏重写（CSS class 替代 inline styles）、聊天气泡优化（用户蓝底/AI 白底、微灰消息区背景）
- 文章列表：行 hover 不跳动、分类菜单选中态修复
- 文章详情：TOC 左边框指示器、正文 15px、标题 24px
- 信息学阅读器：树节点间距、选中态修复
- Admin Dashboard：去掉重复标题
- Admin 用户管理：去掉重复标题
- Admin 智能体管理：分页固定底部（AdminTablePanel 模式）
- Admin 文章管理：改用 AdminTablePanel 模式
- Admin 信息学管理：改用 AdminTablePanel 模式
- Admin 小组讨论：修复高度问题（scrollable=false + flex 布局）
- Admin 智能体数据：全部重写（index + StatisticsCards + SearchBar + UsageRecordPanel + AnalysisPanel）
- Admin IT 技术/个人程序：去掉重复标题

### 分页统一规范
- 所有管理后台表格用 AdminTablePanel + 独立 Pagination（分页固定底部右下角）
- Table 自身 pagination={false}
- 统一 showSizeChanger + showTotal，不用 showQuickJumper
- showTotal 格式：`共 X 条`
- Ant Design 已配置中文 locale（zhCN）

### 重复标题问题
- AdminLayout 头部自动显示页面标题，页面内部不再重复
- 已清理：Dashboard、用户管理、智能体数据、IT 技术、个人程序

---

## 十一、小组讨论功能测试（2026-03-18）

### 测试数据
- 创建了 12 个测试学生（高一(1)班 5人、高一(2)班 4人、高二(1)班 3人）
- 5 个活跃小组：
  - 高一(1)班 3组 Python学习小组（5人 16条）
  - 高一(1)班 5组 英语角（3人 10条）
  - 高一(2)班 1组 数学讨论组（4人 9条）
  - 高一(2)班 2组 化学讨论组（3人 9条）
  - 高二(1)班 2组 物理讨论组（3人 13条）

### 聊天气泡优化
- 字体 13px、padding 8px 12px
- 自己的消息：主色背景白字、右对齐、不显示名字
- 别人的消息：白色背景、左对齐、显示名字+时间
- 圆角 14px、无阴影

### 学生登录方式
- username 字段传 full_name（姓名），password 字段传 student_id（学号）
- curl 中文编码有问题，用 Python requests 正常
- 加入小组有 300 秒锁定期（join_lock_seconds），管理员不受限制

---

## 十二、待继续的工作

- [x] 逐页精修剩余页面布局（XBK 选课、IT 技术、个人程序、404 等）
- [x] 管理后台弹窗逐个精修
- [x] 管理后台编辑器页面优化（文章编辑器、信息学编辑器）
- [x] 响应式/移动端适配优化
- [x] 排查前端加入小组偶发 500 错误
- [ ] 提交代码（git commit）
- [x] CI/CD 工作流详细说明 → `docs/CICD.md`
- [x] 各模块 API 接口清单 → `docs/API.md`

---

## 十三、Bug 修复与功能完善（2026-03-18 下午）

### 小组讨论 500 错误修复
- 根因：`get_or_create_today_session` 步骤 5 重复插入触发 `UniqueConstraint("session_id", "user_id")`
- 修复：插入前精确查询目标 `(session_id, user_id)` 是否已存在 + `try/except IntegrityError` 兜底
- 文件：`backend/app/services/agents/group_discussion.py`

### 小组讨论加入后历史消息不加载
- 根因：`handleJoinOrCreate` 中 sessionId 未变时 useEffect 不重新触发 SSE
- 修复：加入成功后主动调用 `listMessages` 加载历史
- 文件：`frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`

### GitHub 同步功能修复
- `update_sync_settings` 过滤 `__use_saved_token__` 占位符，防止覆盖真实 token
- `run_github_sync` 开头自动清理残留 running 记录 + 锁获取失败时自动释放残留锁重试
- 前端 `limit: 200` → `100`（后端限制 `le=100`）
- 前端 `message.error` 安全化（防止 FastAPI 422 返回对象数组导致 React 崩溃）
- 同步进度条：同步执行模式下也显示进度和结果弹窗
- 文件：`backend/app/services/informatics/github_sync.py`、`frontend/src/pages/Admin/Informatics/index.tsx`、`frontend/src/pages/Informatics/Reader.tsx`

### 全局 message.error 安全化
- 所有 `message.error(e?.response?.data?.detail || ...)` 替换为安全提取函数
- 防止 FastAPI 422 返回 `[{type, loc, msg, input, ctx}]` 数组导致 React 崩溃
- 涉及页面：Admin Informatics、Informatics Reader、EditorPage、TypstNoteEditor、TypstMetrics、System

---

## 十四、页面深度优化（2026-03-18 下午）

### Typst 编辑器（/admin/informatics/editor）
- CSS 统一：grid gap 16px、侧边栏 top 64px、卡片标题正文色、card head 透明
- 行号动态宽度：根据总行数自动调整 gutter 宽度（32px~52px+）
- 行号对齐：gutter 和编辑器字号统一 13px、line-height 统一 22px
- 侧边栏折叠：折叠后只显示展开按钮，不再溢出产生滚动条
- 底部操作栏：统一 `.typst-editor-footer` class（sticky + 背景 + 圆角）
- `Space orientation` → `direction`（3 处）
- 资源列表 border 从 transparent 变量改为可见的 `rgba(0,0,0,0.06)`

### 文章编辑器（/admin/articles/editor）
- 行号动态宽度（与 Typst 编辑器一致）
- 行号对齐：gutter 字号 12px → 14px、line-height `23.8px` → `24px`
- border 柔化 `rgba(0,0,0,0.06)`、border-radius 用 CSS 变量
- 折叠状态 `overflow: hidden`
- 底部操作栏 `.article-edit-actions-card` 样式
- `Space orientation` → `direction`（3 处）

### IT 技术管理（/admin/it-technology）
- AdminAppCard：`borderRadius` 和 `background` 改用 CSS 变量，标题颜色改为正文色
- 点名管理：去掉重复标题、Table 改用 AdminTablePanel + 独立 Pagination（底部固定）
- 编辑按钮：`type="primary" ghost` → 默认按钮（浅蓝色在白底上看不清）
- 编辑弹窗：年份和班级名称允许修改（之前 disabled）
- 面包屑简化为"← 返回"按钮
- Modal 加 `styles={{ body: { padding: 24 } }}` + `destroyOnHidden`

### XBK 选课页面（/xbk）全面重写
- 代码从 1124 行精简到约 450 行
- 分页状态：18 个 useState 合并为 1 个 `pg` Map + `pgRef` 防止无限循环
- 年份动态化：`2026` → `new Date().getFullYear()`
- 布局：侧边栏 200→220px、KPI 和按钮分行、表格区域加 surface-2 背景
- 按钮全部外露（导入/导出/当前页/新增/分析/删除/刷新），加 `wrap` 自动换行
- Tab 保留 6 个（选课总表/学生名册/课程目录/选课记录/未选课/休学）
- `renderTable` 函数复用 6 个 Tab 的表格渲染
- 添加 576px 响应式断点
- XBK 全功能测试 26 项通过

### 系统设置（/admin/system）
- 去掉无用的 "保存设置" disabled 按钮
- 提取 `InfoRow` 组件统一 key-value 行样式，去掉 Divider
- `Space orientation` → flex column 布局
- 导航可见性 Switch onChange 提取为独立函数
- `message.error` 安全化

### IT 技术页面硬编码颜色清理
- `index.css` 新增 `--ws-color-error-dark` 和 `--ws-color-error-light`
- `ITTechnology.css` 按钮渐变色替换为 CSS 变量
- `RollCallPlayer.tsx` 行内颜色替换

### 响应式/移动端适配
- `markdown.css`：576px 断点（字号/标题/代码块缩小）
- `Detail.css`：576px 断点（标题/正文/摘要缩小）
- `EditForm.css`：768px 断点（编辑器工具栏/body padding）
- `Informatics.css`：576px 断点（hero/树节点）
- `ui-polish.css`：576px 断点（管理后台表格/Modal）
- `PersonalPrograms.css`：576px + 768px 断点
- `NotFound.css`：576px 断点

---

## 十五、文档新增

- `docs/CICD.md`：CI/CD 工作流说明（5 个 GitHub Actions、deploy.sh 命令、镜像清单、Secrets）
- `docs/API.md`：全量 API 接口清单（12 个模块、192+ 个端点）

---

## 十六、待继续的工作

- [ ] 提交代码（git commit）
- [ ] 生产环境部署验证
- [ ] 前端 Ant Design 废弃 API 清理（bordered→variant、orientation→direction 等残留）
- [ ] 更多页面的移动端深度适配（PythonLab Studio、AI 智能体聊天等）
