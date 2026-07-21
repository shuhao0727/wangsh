# 当前测试状态

> 状态：active
> Owner：testing
> 当前版本：1.6.0
> 最近更新：2026-07-19
> 说明：本文件是当前测试事实的唯一汇总入口；阶段报告只引用本页，不复制新基线。

## 一、当前未提交整理批次

本节只记录当前 dirty worktree 的最后一次验证快照。远端 GitHub Actions、生产模拟和
Docker Hub 发布仍对应 `origin/main`；文档或代码继续变更后，必须重新执行对应门禁。
历史发布快照见第三节，不能与本节合并理解。

| 类别 | 当前结果 | 覆盖内容 |
|---|---|---|
| 后端全量 | `650 passed, 9 warnings` | API、服务、迁移、脚本与核心业务回归 |
| 前端全量 | `69 files / 350 passed` | 组件、页面、状态与工具函数回归 |
| Assessment | `38 passed, 6 warnings` | 画像班级隔离、会话、配置和课堂联动 |
| GroupDiscussion | `50 passed, 8 warnings` | 会话、成员、消息、权限、并发冲突回退和原子切组 |
| prod-smoke 系统测试 | `11 passed` | Compose 上下文、脱敏、私有权限和缺失 UI 报告失败传播 |
| 前端脚本 | `24 passed` | UI smoke 页面/总控状态、构建上下文、token、Pyodide 和静态资源合同 |
| Workflow contracts | `43 passed` | 发布、CI、开发启动、破坏性命令保护、回滚、日志脱敏、release-set 和 XBK seed 合同 |
| TypeScript | 通过 | `tsc --noEmit` |
| ESLint | `0 errors / 480 warnings` | 现有 warning 基线，无阻断错误 |
| UI audit | 通过，`805 hits` | 当前审计基线未回退 |
| 生产构建与 bundle | 构建通过；总量 `12.78 MB` | Entry `0.96 MB`，总量保持非阻断 warning |
| Python governance | `0 errors / 4 warnings` | 文件规模与复杂度 ratchet |
| Markdown 链接 | `101 files / 216 links / 0 missing` | owner、索引、归档和相对链接 |
| Markdown contracts | `10 passed` | 链接、生命周期、Assessment owner 和 workflow 触发 |

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
- 思维导图编辑器新增 iframe 运行时数据保存回归；问题链结果页新增无效时间桶控件回归。
  ClassroomPanel、问题链和思维导图新增回归后，前端全量当前为
  `69 files / 350 passed`。
- 真实 Chromium 打开 `/mindmap-demo/index.html?readonly=1`，自定义根节点和两个子节点
  均正确渲染并可从 takeover runtime 读取；控制台 `0 errors / 0 warnings`，96 个静态
  请求没有 `4xx/5xx`，测试 localStorage 已清理。
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
- 本批尚未 commit/push；远端 GitHub Actions 和已发布镜像仍对应当前 `origin/main`。

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
