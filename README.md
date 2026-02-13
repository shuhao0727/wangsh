# WangSh

## 本地开发

```bash
bash start-dev.sh
```

如果你还没有本地 `.env`：先执行 `cp .env.example .env`

停止：

```bash
bash stop-dev.sh
```

## 生产部署（Docker Compose）

看文档： [DEPLOY.md](file:///Users/wsh/wangsh/docs/DEPLOY.md)

最常用的一键部署命令（服务器上）：

```bash
cp .env.example .env
bash scripts/deploy.sh deploy
```

## 环境变量说明

看文档： [ENV.md](file:///Users/wsh/wangsh/docs/ENV.md)

## 镜像说明

看文档： [IMAGES.md](file:///Users/wsh/wangsh/docs/IMAGES.md)

## Typst 流水线

看文档： [TYPST.md](file:///Users/wsh/wangsh/docs/TYPST.md)

## 数据库设计

看文档： [DB_SCHEMA.md](file:///Users/wsh/wangsh/docs/DB_SCHEMA.md)
