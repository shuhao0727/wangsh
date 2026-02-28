# WangSh

## 本地开发

**开发配置**：请使用 `.env.dev` (复制自 `.env.dev.example`)。`start-dev.sh` 会自动优先加载它。

```bash
cp .env.dev.example .env.dev
bash start-dev.sh
```

停止：

```bash
bash stop-dev.sh
```

## 生产部署（Docker Compose）

**生产配置**：请使用 `.env` (复制自 `.env.example`)。`scripts/deploy.sh` 默认使用它。

看文档： [DEPLOY.md](docs/DEPLOY.md)

最常用的一键部署命令（服务器上）：

```bash
cp .env.example .env
# 修改 .env 中的密钥和配置
bash scripts/deploy.sh deploy
```

## 环境变量说明

看文档： [ENV.md](file:///Users/wsh/wangsh/docs/ENV.md)

## 环境对齐（开发 vs 生产）

请阅读： [ENV_SYNC.md](file:///Users/wsh/wangsh/docs/ENV_SYNC.md)

快速验证：
- 开发：`./stop-dev.sh && ./start-dev.sh`，访问 `http://localhost:6608`，执行 Typst 编译/预览
- 生产模拟：`bash scripts/deploy.sh up-amd64`，访问 `http://localhost:6608`

## 镜像说明

看文档： [IMAGES.md](file:///Users/wsh/wangsh/docs/IMAGES.md)

## Typst 流水线

看文档： [TYPST.md](file:///Users/wsh/wangsh/docs/TYPST.md)

## 数据库设计

看文档： [DB_SCHEMA.md](file:///Users/wsh/wangsh/docs/DB_SCHEMA.md)
