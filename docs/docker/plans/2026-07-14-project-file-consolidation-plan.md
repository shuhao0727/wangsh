# WangSh 项目整理执行计划

> 状态：active
> Owner：project-governance
> 最近复核：2026-07-24
> 归档条件：当前整理批次提交并通过提交后门禁，剩余专项转入对应 owner 或 30/60/90 计划

本文是当前文件整理工作的唯一执行入口。动态测试结果统一写入
[TEST_STATUS.md](../testing/TEST_STATUS.md)，长期改进统一写入
[30/60/90 计划](2026-07-11-project-governance-30-60-90-execution-plan.md)。

## 一、目标

1. 基于真实引用和测试证据清理文档、测试、脚本与无引用代码。
2. 保留正式课程、迁移、部署恢复、PythonLab 验证、本地开发数据和缓存。
3. 让每个主题只有一个当前 owner，历史信息进入精简 archive。
4. 保证当前差异可解释、可验证，不覆盖其他未提交修改。

## 二、边界

### 保留

- 正式课程 Markdown、前端内置 ML/AI/Agents 内容和课程迁移源。
- `backend/alembic/versions/`、部署、回滚、数据库检查和生产 smoke。
- PythonLab 当前 smoke/soak，以及低内存故障注入的 archive 复现脚本。
- `backend/scripts/archive/add_missing_indexes.sql`，仅作为待审计草案，不直接用于生产。
- 根 `.env`、`.env.dev`、开发缓存和本地数据；这些不进入本批 tracked 文件整理。

### 排除

- `.reasonix/`、`reasonix.toml` 和临时 `release-set.txt` 不进入提交。
- Pyodide runtime、构建目录、coverage、截图、日志和临时报告属于可重建产物。
- 不执行数据库备份、正式生产部署、Docker Hub 发布、Git commit 或 push，除非用户明确要求。

## 三、已完成

### 文档

- Assessment 的设计、数据库、API、前端和测试入口收敛到
  [ASSESSMENT.md](../../features/ASSESSMENT.md)，Prompt 保留独立 owner。
- 删除无真实引用的旧 redirect、重复短摘要和已被 owner 完整替代的历史正文。
- 删除结论错误且无引用的 `PROJECT_CLEANUP_2026-07-21.md`；将 7 月代码审查长报告
  压缩为历史快照，撤回过强的“全部完成”和“生产就绪”结论。
- 三份 2026-07 长计划的唯一历史结论合并到
  [7 月归档摘要](../archive/plans/2026-07-project-consolidation-history.md)。
- SSE 恢复资料和学习平台设计取舍保留为精简 archive。
- Learning 与 ML Book 的独立模型/API 边界已校准。

### 代码、测试与脚本

- 删除已被同名 package 替代的 Python 兼容壳和无路由引用的旧前端页面/组件。
- 删除永久 skip、只断言自建 mock 或无真实入口的空壳测试；移动测试保持原行为。
- GroupDiscussion 并发冲突、Assessment 班级隔离、XBK 端点和日志脱敏已有直接回归。
- 日志脱敏已覆盖 FastAPI、Celery、标准 logging、Loguru、异常链和异常长输入；
  GroupDiscussion 业务日期使用配置时区，无效时区启动期失败；Assessment 班级隔离
  由真实 PostgreSQL 临时 schema 验证。
- 5 个失效、危险或重复的 seed 壳已删除；正式课程迁移源继续保留。
- `backend/scripts/__init__.py` 已补充，并覆盖仓库根目录导入与空库启动路径。
- 思维导图保存使用 iframe 当前运行时数据，富文本转为纯文本 Markdown，不再重复根节点；
  独立窗口保存不再依赖 `_mmData`。
- ClassroomPanel 跨账号刷新竞态和问题链无效分钟按钮已收口。

### 发布治理

- release-set 校验覆盖六镜像集合、逻辑名称、版本变量、registry digest 和本地 RepoDigest。
- 正式发布只拉六个业务服务，启动使用 `--pull never`，不隐式更新 PostgreSQL/Redis。
- `deploy` 等待首页、API、数据库、Redis、frontend、gateway 和两个 worker 全部健康。
- API 健康状态要求 HTTP 2xx 和顶层唯一 `status=healthy`；默认回滚先记录并停止三个
  数据库写服务建立无写入窗口，再执行备份和 downgrade。停止或备份失败时不降级，
  并尝试恢复停止前原本运行的写服务。恢复、删除 volume、XBK reset 和 live
  prod-smoke 仍要求显式授权。

### 静态资源

- `favicon.svg` 等正式源码资产继续跟踪。
- `frontend/public/pyodide/` 继续作为可重建 runtime 忽略。
- `frontend/public/mindmap-demo/` 保留在开发机，但目录内字体、SVG、图片和打包 JS
  整体排除 Git 与 Docker 构建上下文；Vite 生产构建结束后还会删除复制到
  `build/mindmap-demo` 的本地副本，不再维护逐文件白名单或 manifest。
- 生产 Caddy 对 Mindmap 路径返回 `404 + no-store` 且不进入 SPA fallback；恢复生产
  能力前，另行建立可复现的资源准备流程。

### 2026-07-24 非功能文件复核

- 文档、测试、脚本、配置和本地产物已由四个只读 agent 分域审计，未发现可批量删除的
  正式测试、课程 Markdown、部署恢复脚本或受维护 smoke/soak。
- XBK 与 ML Book 的 API 合同收敛到 `docs/development/API.md`；发布归档和测试索引不再
  复制易漂移的版本数、文件行数或路由数量。
- 旧 `backend/db/init_database.py` 已由 Alembic、`bootstrap_db.py` 和
  `check_migration_state.py` 完整替代并退出活动路径；错误目录中的课堂测试已移入
  `backend/tests/classroom/`，重复用例已删除。
- 本地 Docker CLI、Pyodide、Mindmap 和开发缓存继续保留；后端 Docker 构建上下文新增
  `docker/bin/` 排除，避免发送约 76 MiB 的本地缓存。

## 四、当前状态

1. 本轮非功能整理的后端定向回归、前端脚本、Markdown、workflow、Compose、Dockerfile
   check 和格式门禁已通过；完整结果见 `TEST_STATUS.md`。
2. Python governance 当前仍有 `5 errors / 5 warnings`，阻断项来自已有 AI 长回答功能
   改动的复杂度回退；本轮按边界未修改功能实现，需在下一阶段单独拆分。
3. Git 和 Docker 均已排除 Mindmap 本地运行时，`favicon.svg` 等正式源码资产未被
   宽泛规则误伤；不含 Mindmap 的临时副本构建已通过。
4. 本地 `shuhao07/wangsh-frontend:1.6.0` 已从当前工作树重建，并完成独立 Caddy
   容器验证；其余五个业务镜像重建和完整隔离生产模拟仍未执行。
5. 当前已有既存 staged、unstaged 和未跟踪修改；本轮未新增 stage/commit，push、部署
   和镜像发布继续要求单独授权。

## 五、验证门禁

```bash
cd backend
venv/bin/pytest -q
venv/bin/python scripts/check_python_governance.py check --base-ref origin/main

cd ../frontend
npm test
npm run test:scripts
npm run token:check:ci
npm run type-check
npm run lint
npm run ui:audit:ci
npm run build:check

cd ..
node --test scripts/workflow-contracts.test.mjs
node --test scripts/markdown-contracts.test.mjs
node scripts/check-markdown-contracts.mjs
node scripts/check-version-consistency.mjs
bash -n scripts/deploy.sh
bash -n scripts/rollback.sh
bash -n scripts/migrate-db.sh
bash -n scripts/health-check-detailed.sh
bash -n scripts/prod-smoke/run.sh
docker compose --env-file .env.example -f docker-compose.yml config --quiet
docker compose --env-file .env.example -f docker-compose.dev.yml config --quiet
git diff --check
```

发布前另行执行：

```bash
SIM_RUN_PROD_SMOKE=true SIM_CLEANUP=true bash scripts/deploy.sh simulate
```

生产模拟不能替代 GitHub Actions、Docker Hub digest 和生产数据库恢复演练。

## 六、完成定义

- 文档、测试、脚本和删除项终审没有未处理的高可信问题。
- 当前代码、构建、合同、Compose 和格式门禁通过。
- `TEST_STATUS.md` 与最后一次实际验证一致。
- 没有提交本地配置、数据、缓存、密钥或可重建产物。
- 没有删除正式课程、迁移、部署恢复或 PythonLab 验证资产。
- 当前差异边界清楚，且未 stage、commit、push 或发布镜像。
