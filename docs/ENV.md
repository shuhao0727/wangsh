# 环境变量文件说明（精简且稳定）

## 文件各自负责什么

- `.env.example`：模板（**带详细注释**，提交到仓库）
- `.env`：你机器/服务器上的真实配置（**不提交**）

## 推荐工作流

开发/生产/部署：

```bash
cp .env.example .env
```

开发启动：

```bash
bash start-dev.sh
```

生产部署：

```bash
bash scripts/deploy.sh up
```

## 变量组织原则

- `.env.example` 作为“最完整的说明书”，包含所有关键变量与注释
- `.env` 只写你需要的变量（不要复制一大坨，避免以后难维护）
