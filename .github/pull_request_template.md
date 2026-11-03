## 摘要

- 改了什么：
- 为什么改：

## 影响范围

- [ ] 前端（页面 / 组件 / 样式 / 服务）
- [ ] 后端（API / service / 模型 / 迁移）
- [ ] 数据库迁移（Alembic revision：______）
- [ ] 部署 / CI / 脚本 / 文档
- [ ] 仅测试或仅文档

## 验证

按改动选择最小可靠验证；未执行的项保留未勾选，并在“未验证”中说明原因。

### 通用

- [ ] `git diff --check`
- [ ] `node scripts/check-version-consistency.mjs`（改版本或发布相关时）
- [ ] `node --test scripts/*.test.mjs`（改根层脚本、workflow、文档合同时）

### 前端（`frontend/`）

- [ ] `npm run type-check`
- [ ] `npm run lint`（error 为 0，warning 不因本次净增）
- [ ] `npm test`
- [ ] `npm run test:scripts`
- [ ] `npm run token:check:ci`（改样式或颜色时）
- [ ] `npm run ui:audit:ci`（改界面时）
- [ ] `npm run build:check`（改构建、分包或依赖时）

### 后端（`backend/`）

- [ ] 相关 `pytest` 用例（按 `backend/tests/README.md` 的隔离前提执行）
- [ ] `python backend/scripts/check_python_governance.py check`（改后端 Python 时）
- [ ] `python backend/scripts/check_migration_guard.py`（新增或修改迁移时）
- [ ] 迁移 upgrade / downgrade / 再 upgrade（改 Alembic 时）

### 界面与交互

- [ ] 真实浏览器验证（Chrome channel；涉及指针、悬停或焦点时补 WebKit）
- [ ] 桌面四档宽度：1280 / 1440 / 1680 / 1920
- [ ] 窄屏（390 或 430）
- [ ] 键盘操作与焦点顺序

### 发布相关（改部署、镜像或版本时）

- [ ] `bash scripts/deploy.sh verify-local-images`
- [ ] `docker compose --env-file .env.example -f docker-compose.yml config --quiet`
- [ ] `docker compose --env-file .env.example -f docker-compose.dev.yml config --quiet`

## 未验证

列出本次没有执行、或环境不具备而无法执行的检查，并说明原因（例如：无专用 PostgreSQL、未配置真实模型、未部署目标环境）。

-

## 风险与后续

- 已知行为变化：
- 回滚方式：
- 后续任务：

## 检查清单

- [ ] 没有提交 `.env`、密钥、令牌、Cookie、构建产物或截图
- [ ] 新增/修改的配置、脚本、迁移与测试已一并包含在本 PR 中
- [ ] 相关 owner 文档已同步（API / 功能 / 部署 / CI / 测试状态）
- [ ] 若为行为修复，已在 `docs/operations/RELEASE_NOTES.md` 记录
