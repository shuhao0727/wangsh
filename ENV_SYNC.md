# 环境对齐说明（开发 vs 生产）

本文件梳理开发模式与生产模式的关键差异点，以及需要保持一致的配置与验证步骤。

## 目录
1. Typst PDF 存储目录对齐
2. Worker 启动与消息队列
3. 前端 API 基址与 CORS
4. 加密密钥（Fernet）
5. 上传目录与持久化
6. 快速验证清单

## 1. Typst PDF 存储目录对齐
- 生产（Compose）  
  - 后端与 Typst Worker 使用相同目录 `/app/data/typst_pdfs`，并通过卷共享。  
  - 环境变量：`TYPST_PDF_STORAGE_DIR=/app/data/typst_pdfs`
- 开发（本地热加载）  
  - 后端本地进程通过 `start-dev.sh` 设置：`TYPST_PDF_STORAGE_DIR=$PROJECT_ROOT/data/typst_pdfs` 并自动创建目录。  
  - 开发 Compose 对 backend 也挂载 `./data/typst_pdfs:/app/data/typst_pdfs`，保持与 Worker 一致。

必须确保：
- Worker 编译生成的 PDF 与后端读取的目录一致；
- 若启用 `TYPST_STORE_PDF_IN_DB=false`，必须共享文件目录，否则后端会找不到 PDF。

## 2. Worker 启动与消息队列
- 开发：不再启动本地 Celery Worker，改为 Docker 中运行
  - `typst-worker`：队列 `typst`
  - `pythonlab-worker`：队列 `celery`
- 生产：与开发相同，均使用 Redis 作为 broker 和 result backend。

## 3. 前端 API 基址与 CORS
- 开发：`REACT_APP_API_URL=http://localhost:8000/api/v1`（直连后端）  
  CORS 白名单需包含 `http://localhost:6608`、`http://127.0.0.1:6608`。
- 生产：前端使用相对路径 `/api/v1`，由网关转发到后端。  
  CORS 白名单需包含实际域名和本地调试入口（如需要）。

## 4. 加密密钥（Fernet）
- 必须为 32 字节随机数据的 URL-safe Base64 编码（通常长度 44）。  
- 生产 `.env` 中的 `AGENT_API_KEY_ENCRYPTION_KEY` 必须合规；`scripts/deploy.sh simulate` 会自动生成。

## 5. 上传目录与持久化
- 开发：`UPLOAD_FOLDER=./uploads`（本地相对路径）。如需与生产一致体验，可指向 `./data/uploads`。  
- 生产：容器内路径 `/app/uploads`，并挂载到 `./data/uploads`。

## 6. 快速验证清单
开发模式
1. `./stop-dev.sh && ./start-dev.sh`
2. 浏览器访问 `http://localhost:6608`
3. 在管理端创建/编辑 Typst 笔记，点击“编译/预览”，确认 `./data/typst_pdfs` 产出文件并能下载

生产模拟
1. `bash scripts/deploy.sh up-amd64`
2. 访问 `http://localhost:6608` 与 `http://localhost:6608/api/health`
3. 登录后执行 Typst “编译/预览”，确认页面可下载 PDF

