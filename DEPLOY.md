# WangSh 部署文档

## 服务器信息

- **域名**: wangsh.cn
- **SSH 端口**: 6607
- **用户**: shuhao
- **SSH 配置**: ~/.ssh/config

## 快速连接

```bash
ssh wangsh.cn
```

## 本地开发环境

### 端口配置
- 前端/网关: 6608
- 后端 API: 8000
- PostgreSQL: 5432
- Redis: 6379
- Adminer: 8081

### 启动命令
```bash
# 开发环境
./start-dev.sh

# 生产环境
docker compose -f docker-compose.yml up -d
```

## 镜像版本

当前版本: **1.5.0**

### 镜像列表
- shuhao07/wangsh-backend:1.5.0
- shuhao07/wangsh-frontend:1.5.0
- shuhao07/wangsh-gateway:1.5.0
- shuhao07/wangsh-typst-worker:1.5.0
- shuhao07/wangsh-pythonlab-worker:1.5.0
- shuhao07/pythonlab-sandbox:py311

## 构建镜像

```bash
# 构建所有镜像
./build_images.sh 1.5.0

# 只构建前端
docker buildx build \
  --platform linux/amd64 \
  -t shuhao07/wangsh-frontend:1.5.0 \
  --build-arg REACT_APP_VERSION=1.5.0 \
  -f frontend/Dockerfile.prod \
  --load \
  frontend
```

## 推送镜像到 Docker Hub

```bash
# 推送所有镜像
docker push shuhao07/wangsh-backend:1.5.0
docker push shuhao07/wangsh-frontend:1.5.0
docker push shuhao07/wangsh-gateway:1.5.0
docker push shuhao07/wangsh-typst-worker:1.5.0
docker push shuhao07/wangsh-pythonlab-worker:1.5.0
docker push shuhao07/pythonlab-sandbox:py311
```

## 服务器部署步骤

### 1. 连接服务器
```bash
ssh wangsh.cn
```

### 2. 进入项目目录
```bash
cd /path/to/wangsh
```

### 3. 拉取最新镜像
```bash
docker compose pull
```

### 4. 重启服务
```bash
docker compose down
docker compose up -d
```

### 5. 查看服务状态
```bash
docker compose ps
docker compose logs -f
```

## 数据库管理

### 连接数据库
```bash
docker exec -it wangsh-postgres-1 psql -U admin -d wangsh_db
```

### 执行迁移
```bash
docker exec wangsh-backend-1 alembic upgrade head
```

### 查看迁移状态
```bash
docker exec wangsh-backend-1 alembic current
```

## 日志查看

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f gateway
```

## 备份与恢复

### 数据库备份
```bash
docker exec wangsh-postgres-1 pg_dump -U admin wangsh_db > backup_$(date +%Y%m%d).sql
```

### 数据库恢复
```bash
cat backup.sql | docker exec -i wangsh-postgres-1 psql -U admin -d wangsh_db
```

## 故障排查

### 检查服务健康状态
```bash
curl http://localhost:6608/api/health
```

### 检查容器状态
```bash
docker compose ps
docker stats
```

### 重启特定服务
```bash
docker compose restart backend
docker compose restart frontend
```

## 更新记录

### 2026-03-23 - v1.5.0
- ✅ 修复端口配置为 6608
- ✅ 移除镜像 latest 标签
- ✅ 修复数据库视图 v_conversations_with_deleted
- ✅ 统一 AIAgents 和 AgentData 页面卡片样式
- ✅ 创建测试用户和数据
- ✅ 验证所有核心功能 API

## 注意事项

1. 生产环境必须设置强密码和密钥
2. 定期备份数据库
3. 监控服务器资源使用情况
4. 及时更新依赖和安全补丁
