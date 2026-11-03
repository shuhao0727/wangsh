# WangSh

高中信息技术教学管理平台，包含 AI 智能体、PythonLab、课堂互动、测评和竞赛笔记。

## 本地开发

首次创建开发配置；已有 `.env.dev` 时保留原文件，按开发模板核对所需项。生产模板 `.env.example` 不能直接用于本地启动。

```bash
test -e .env.dev || cp .env.dev.example .env.dev
```

填写 `.env.dev` 中的 `POSTGRES_PASSWORD`、`SUPER_ADMIN_PASSWORD`、`SECRET_KEY` 和合法的
`AGENT_API_KEY_ENCRYPTION_KEY`，使用独立开发凭据；模板已指定 `127.0.0.1:5433` 和 development。

```bash
bash start-dev.sh
```

结束本次开发环境：

```bash
bash stop-dev.sh
```

默认前端 `6608`、后端 `8000`。启动前核对当前工作树和已有服务，避免端口及数据挂载冲突。

## 生产部署

按 [部署指南](docs/operations/DEPLOY.md) 核对授权、发布来源、配置、备份与回退方式后，
使用 `scripts/deploy.sh` 对应入口。不要照抄开发配置覆盖生产环境。

## 文档导航

| 用途 | 入口 |
|---|---|
| 文档总索引 | [docs/README.md](docs/README.md) |
| Agent 工作规则 | [CLAUDE.md](CLAUDE.md) |
| API 合同 | [API.md](docs/development/API.md) |
| 部署与发布 | [运维入口](docs/operations/README.md) |
| 当前验证与待办 | [测试状态](docs/testing/TEST_STATUS.md)、[项目台账](docs/plans/project-consolidation.md) |

## 技术与目录

- 前端：React、TypeScript、Vite、Tailwind、TanStack；版本以 `frontend/package.json` 为准。
- 后端：FastAPI、SQLAlchemy async、PostgreSQL、Redis、Celery；依赖见 `backend/requirements.txt`。
- `frontend/`、`backend/`：应用源码；`gateway/`：网关；`scripts/`：跨模块和运维入口；`docs/`：文档。

开发和生产分别使用 `docker-compose.dev.yml`、`docker-compose.yml`，不要混用。
