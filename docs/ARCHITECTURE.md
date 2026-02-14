# 架构与访问入口

## 目标

- 仅暴露一个 Web 入口端口（默认 6608）
- 浏览器永远只访问 `http://localhost:6608`
- 后端/数据库/Redis 只在 Docker 网络内通信，不直接暴露到宿主机

## 服务关系

- `frontend`：生产形态为 Caddy
  - 静态文件：`/`、`/admin/*` 等路由由 Caddy 直接提供（SPA `try_files ... /index.html`）
  - 反向代理：`/api/*`、`/api/v1/*`、`/api/health` 代理到容器网络内的 `backend:8000`
  - 说明：生产 compose 不会出现独立的 `caddy` 服务；Caddy 就运行在 `frontend` 容器里
- `backend`：FastAPI（容器内监听 8000）
- `typst-worker`：Celery worker（不对外提供 HTTP）
- `postgres`、`redis`：仅容器网络内使用

## 为什么会出现 backend:8000

`backend` 是 Docker network 里的服务名，只有容器之间能解析；浏览器在宿主机上无法解析 `backend`，因此前端请求里一旦出现 `backend:8000/...` 就会报 `ERR_NAME_NOT_RESOLVED`。

正确做法是：浏览器只访问 `http://localhost:6608/api/...`，由 Caddy 在容器网络内转发到 `backend:8000`。

## 关键环境变量

- `WEB_PORT`：对外端口（默认 6608）
- `REACT_APP_API_URL`：生产应为 `/api/v1`（同源）
- `CORS_ORIGINS`：至少包含 `http://localhost:6608`
- `AGENT_API_KEY_ENCRYPTION_KEY`：必须设置为安全随机值，否则后端会拒绝启动
