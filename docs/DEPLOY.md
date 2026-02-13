# 生产部署（精简版）

## 文件约定

- 只需要两个文件：
  - `.env`：你的真实部署配置（不提交）
  - `docker-compose.yml`：统一的生产/部署 compose（可构建也可拉镜像运行）

## 1）准备环境变量

```bash
cp .env.example .env
```

至少需要修改：

- `SECRET_KEY`
- `POSTGRES_PASSWORD`
- `SUPER_ADMIN_PASSWORD`
- `DOCKERHUB_NAMESPACE`
- `DEPLOYMENT_ENV`（生产用 production）
- `REACT_APP_API_URL`（生产用 /api/v1）

可选：

- `WEB_PORT`（默认 6608）
- `IMAGE_TAG`（建议固定版本，例如 1.0.3；需要始终拉最新时用 latest）

## 2）部署方式 A：服务器直接拉取镜像并运行（推荐）

```bash
bash scripts/deploy.sh pull-up
```

一键部署（拉取/启动 + 健康检查）：

```bash
bash scripts/deploy.sh deploy
```

本地 Docker 镜像部署验证（不依赖 Docker Hub 网络；只要本地已有镜像即可直接启动）：

```bash
bash scripts/deploy.sh deploy-local
```

## 3）部署方式 B：服务器本地构建并运行（不推荐，作为兜底）

```bash
bash scripts/deploy.sh up
```

## 4）镜像发布（你需要重新打包/更新版本时）

本地：

```bash
bash scripts/deploy.sh build
docker login
bash scripts/deploy.sh push
```

如果你在 Apple 芯片（arm64）机器上构建，但目标服务器是 AMD（linux/amd64），用下面命令生成 amd64 镜像：

```bash
bash scripts/deploy.sh build-amd64
docker login
bash scripts/deploy.sh push-amd64
```

如果你本地网络无法访问 Docker Hub（push 超时），建议用 GitHub Actions 在云端构建并推送 linux/amd64 镜像：

- 在 GitHub 仓库 Settings -> Secrets and variables -> Actions 添加：
  - `DOCKERHUB_USERNAME=shuhao07`
  - `DOCKERHUB_TOKEN=<Docker Hub access token>`
- 运行 Actions 工作流 `dockerhub-amd64`，填写 `image_tag`（例如 1.0.0）

服务器：

```bash
bash scripts/deploy.sh pull-up
```

## 5）验证 / 常用命令

健康检查：

```bash
bash scripts/deploy.sh health
```

日志：

```bash
bash scripts/deploy.sh logs
```

停止：

```bash
bash scripts/deploy.sh down
```

完全清理（含卷）：

```bash
bash scripts/deploy.sh down-v
```

## 5）备份与恢复（可选）

备份：

```bash
bash scripts/deploy.sh backup-db full
```

恢复：

```bash
bash scripts/deploy.sh restore-db ./backups/xxx.dump
```
