# Typst 编译与预览流水线

## 总览

该项目的 Typst 笔记采用：

- 后端编译：Celery Worker 执行 Typst 编译
- 产物存储：PDF 默认写入共享文件存储（/app/data/typst_pdfs），数据库只存路径/大小
- 前端预览：PDF.js + Canvas 按需渲染（虚拟化）
- 观测治理：Redis 指标 + 管理端面板 + Prometheus 文本导出

## 服务与队列

- 后端服务：FastAPI
- Worker：Celery worker（队列 typst）
- Broker/Backend：Redis

docker-compose 生产文件包含 typst-worker 服务与共享卷：

- PDF 卷：typst_pdfs -> /app/data/typst_pdfs

## 关键接口

### 编译

- 同步导出（兼容旧逻辑）：`POST /api/v1/informatics/typst-notes/{id}/compile`
- 异步编译：
  - 提交：`POST /api/v1/informatics/typst-notes/{id}/compile-async` -> `{ job_id, note_id }`
  - 状态：`GET /api/v1/informatics/typst-notes/compile-jobs/{job_id}`
  - 取消：`POST /api/v1/informatics/typst-notes/compile-jobs/{job_id}/cancel`
- 导出 PDF：`GET /api/v1/informatics/typst-notes/{id}/export.pdf`

### 指标与清理

- 指标 JSON（管理端面板读取）：`GET /api/v1/system/typst-metrics`
- Prometheus 文本：`GET /api/v1/system/metrics`
- 清理未引用 PDF（默认 dry_run=true）：`POST /api/v1/system/typst-pdf-cleanup?dry_run=true&retention_days=30`

## 关键环境变量

后端：

- TYPST_COMPILE_USE_CELERY=true
- TYPST_PDF_STORAGE_DIR=/app/data/typst_pdfs
- TYPST_STORE_PDF_IN_DB=false
- TYPST_PDF_RETENTION_DAYS=30
- TYPST_METRICS_SAMPLE_SIZE=200
- TYPST_ASSET_MAX_BYTES=5242880
- TYPST_ASSET_ALLOWED_EXTS=png,jpg,jpeg,gif,webp,svg,pdf
- TYPST_ASSET_UPLOAD_RATE_LIMIT_SECONDS=1

worker：

- TYPST_WORKER_CONCURRENCY=1
