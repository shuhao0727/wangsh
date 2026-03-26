# 部署指南

## 服务器信息

- **域名**: wangsh.cn
- **SSH 端口**: 6607
- **用户**: shuhao
- **当前版本**: 1.5.1

### 快速连接
```bash
ssh wangsh.cn
```

---

## 快速开始

### 开发环境

**方式1：使用便捷脚本（推荐）**

```bash
# 本地模式（Docker基础设施 + 本地业务代码）
bash start-dev.sh

# Docker模式（全部在Docker中运行）
bash start-dev.sh --docker
```

**方式2：直接使用 Docker Compose**

```bash
# 1. 复制配置文件
cp .env.dev.example .env.dev

# 2. 启动所有服务
docker compose -f docker-compose.dev.yml up -d

# 3. 访问
# 前端：http://localhost:6608
# 后端：http://localhost:8000
# 数据库管理：http://localhost:8081
```

**两种方式对比**：
- `start-dev.sh`：自动检测端口冲突、支持混合模式、日志管理
- `docker compose`：简单直接、全部容器化

### 生产环境

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，设置生产配置（修改密码、密钥等）

# 2. 构建镜像
./build_images.sh

# 3. 推送镜像到 Docker Hub（可选）
docker compose push

# 4. 部署
docker compose up -d
```

---

## 版本管理

版本号统一在 `.env` 中的 `APP_VERSION` 定义：

```bash
APP_VERSION=1.5.1
IMAGE_TAG=1.5.1
REACT_APP_VERSION=1.5.1
```

修改版本号后，其他相关变量会自动同步。

---

## 开发 vs 生产模式对比

| 特性 | 开发模式 | 生产模式 |
|------|----------|----------|
| **前端服务** | craco dev server (端口 6608) | Caddy 静态文件服务 (端口 80) |
| **后端服务** | uvicorn --reload | uvicorn --workers 4 |
| **调试模式** | DEBUG=true | DEBUG=false |
| **代码加载** | 本地目录挂载（热加载） | 代码打包到镜像内 |
| **网关** | 可选（开发时不启动） | 必需（Caddy 反向代理） |
| **数据库** | 本地 ./data/postgres | Docker volume postgres_data |
| **镜像来源** | 本地构建 (Dockerfile.dev) | Docker Hub 或本地构建 (Dockerfile.prod) |

---

## 镜像构建流程

### 1. 构建所有镜像

```bash
./build_images.sh
```

构建的镜像列表：
- `shuhao07/wangsh-backend:1.5.1` - 后端 FastAPI 服务
- `shuhao07/wangsh-frontend:1.5.1` - 前端静态文件
- `shuhao07/wangsh-gateway:1.5.1` - Caddy 网关
- `shuhao07/wangsh-typst-worker:1.5.1` - Typst PDF 编译 worker
- `shuhao07/wangsh-pythonlab-worker:1.5.1` - PythonLab 调试 worker

### 2. 测试镜像

```bash
# 启动所有服务
docker compose up -d

# 健康检查
curl http://localhost:6608/health
```

### 3. 推送到 Docker Hub

```bash
# 登录 Docker Hub
docker login

# 推送所有镜像
docker compose push
```

---

## 常用部署命令

Docker Compose 命令：

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 启动所有服务 |
| `docker compose up -d --build` | 构建并启动服务 |
| `docker compose pull` | 拉取最新镜像 |
| `docker compose push` | 推送镜像到 Docker Hub |
| `docker compose down` | 停止所有容器 |
| `docker compose down -v` | 停止容器并删除 volumes |
| `docker compose logs -f` | 查看实时日志 |
| `docker compose ps` | 查看服务状态 |
| `docker compose restart` | 重启所有服务 |

开发环境命令：
```bash
# 启动开发环境
docker compose -f docker-compose.dev.yml up -d

# 停止开发环境
docker compose -f docker-compose.dev.yml down
```

---

## 服务说明

### 核心服务

- **gateway** - Caddy 反向代理（生产环境）
- **backend** - FastAPI 后端服务
- **frontend** - React 前端（开发环境独立服务）
- **postgres** - PostgreSQL 数据库
- **redis** - Redis 缓存

### Worker 服务

- **typst-worker** - Typst PDF 渲染服务（信息学竞赛笔记）
- **pythonlab-worker** - PythonLab 调试 session Celery worker

### 可选服务

- **adminer** - 数据库管理界面（开发环境）

---

## 环境变量配置

关键环境变量说明：

### 版本配置
```bash
APP_VERSION=1.5.1          # 应用版本号
IMAGE_TAG=1.5.1            # Docker 镜像标签
REACT_APP_VERSION=1.5.1    # 前端版本号
```

### 安全配置（生产环境必须修改）
```bash
SECRET_KEY=...                        # 后端密钥
SUPER_ADMIN_PASSWORD=...              # 管理员密码
POSTGRES_PASSWORD=...                 # 数据库密码
AGENT_API_KEY_ENCRYPTION_KEY=...     # 智能体 API 密钥加密
```

### 功能开关
```bash
DEBUG=false                  # 生产环境必须为 false
BACKEND_RELOAD=false         # 生产环境必须为 false
```

---

## 常见问题

### 1. 前端无法访问后端 API

**开发环境**：确保 `REACT_APP_API_URL=/api/v1`，craco 会自动代理到后端

**生产环境**：确保 gateway 服务正常运行，Caddy 会转发 `/api/*` 到后端

### 2. PythonLab 调试超时

确保 `pythonlab-worker` 服务正常运行：
```bash
docker compose -f docker-compose.dev.yml ps pythonlab-worker
```

### 3. Typst PDF 渲染失败

确保 `typst-worker` 服务正常运行，且字体文件已正确挂载

### 4. 数据库连接失败

检查 `POSTGRES_HOST` 配置：
- Docker 内部：使用 `postgres`
- 本地连接：使用 `127.0.0.1`

---

## 数据库迁移策略

### 迁移前检查

```bash
# 查看当前版本
docker exec wangsh-backend alembic current

# 查看迁移历史
docker exec wangsh-backend alembic history
```

### 执行迁移

```bash
# 升级到最新版本
docker exec wangsh-backend alembic upgrade head

# 升级到指定版本
docker exec wangsh-backend alembic upgrade <revision>
```

### 迁移验证

```bash
# 验证数据库连接
docker exec wangsh-backend python -c "from app.db.database import engine; import asyncio; asyncio.run(engine.dispose())"
```

### 常见问题

- **迁移失败**: 检查数据库连接和权限
- **版本冲突**: 使用 `alembic heads` 查看分支

---

## 回滚流程

### 何时需要回滚

- 迁移导致数据错误
- 新版本出现严重 bug
- 需要紧急恢复服务

### 回滚步骤

```bash
# 1. 备份当前数据库
docker exec wangsh-postgres pg_dump -U admin wangsh_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 回滚数据库
docker exec wangsh-backend alembic downgrade -1

# 3. 回滚代码（重新部署旧版本）
IMAGE_TAG=1.5.0 docker compose pull && docker compose up -d

# 4. 验证
curl http://localhost:6608/health
```

### 回滚失败处理

如果回滚失败，使用备份恢复：
```bash
docker exec -i wangsh-postgres psql -U admin wangsh_db < backup_file.sql
```

---

## 数据备份与恢复

### 备份数据库

```bash
# 完整备份
docker exec wangsh-postgres pg_dump -U admin wangsh_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 仅备份结构
docker exec wangsh-postgres pg_dump -U admin --schema-only wangsh_db > schema_backup.sql

# 仅备份数据
docker exec wangsh-postgres pg_dump -U admin --data-only wangsh_db > data_backup.sql
```

### 恢复数据库

```bash
# 恢复完整备份
docker exec -i wangsh-postgres psql -U admin wangsh_db < backup_file.sql

# 先删除数据库再恢复（慎用）
docker exec wangsh-postgres psql -U admin -c "DROP DATABASE IF EXISTS wangsh_db;"
docker exec wangsh-postgres psql -U admin -c "CREATE DATABASE wangsh_db;"
docker exec -i wangsh-postgres psql -U admin wangsh_db < backup_file.sql
```

---

## 生产部署检查清单

- [ ] 修改 `.env` 中的所有密码和密钥
- [ ] 设置 `DEBUG=false`
- [ ] 配置 CORS 允许的域名
- [ ] 构建并测试所有镜像
- [ ] 推送镜像到 Docker Hub
- [ ] 在生产服务器上拉取镜像
- [ ] 执行健康检查
- [ ] 配置数据库备份计划
- [ ] 配置 HTTPS 证书（Caddy 自动申请）

---

## 技术栈

- **后端**: FastAPI + SQLAlchemy 2.0 + PostgreSQL
- **前端**: React 19 + TypeScript + Ant Design
- **网关**: Caddy 2
- **缓存**: Redis
- **任务队列**: Celery
- **容器**: Docker + Docker Compose

---

## 监控指南

### 健康检查

```bash
# 基础健康检查
curl http://localhost:6608/health

# 检查所有服务状态
docker compose ps

# 检查特定服务日志
docker compose logs backend --tail 50
```

### 关键指标

- **CPU 使用率**: 持续 > 80% 需扩容
- **内存使用率**: 持续 > 85% 需扩容
- **磁盘空间**: < 20% 需清理
- **API 响应时间**: > 2s 需优化

### 日志监控

```bash
# 查看实时日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend

# 查看错误日志
docker compose logs backend | grep ERROR
```

### 告警建议

- API 健康检查失败
- 数据库连接失败
- Worker 队列堆积
- 磁盘空间不足
