# 数据归档功能

## 概述

WangSh 项目实现了自动和手动数据归档功能，用于定期归档旧的对话记录和分析记录，保持数据库性能和数据可管理性。

## 功能特性

### 1. 自动定时归档

通过 Celery Beat 实现的定时任务：

- **对话记录归档**：每周日凌晨 2 点自动归档 90 天前的对话记录
- **分析记录归档**：每月 1 号凌晨 3 点自动归档 180 天前的分析记录

### 2. 手动触发归档

管理员可通过 API 接口手动触发归档任务，自定义归档天数。

## 架构设计

### 文件结构

```
backend/app/
├── tasks/
│   └── data_archiving.py          # 归档任务实现
├── api/endpoints/system/
│   └── archiving.py                # 归档 API 接口
└── core/
    └── celery_app.py              # Celery 配置（含定时任务）
```

### 归档逻辑

1. **对话记录归档** (`archive_old_conversations`)
   - 更新 `znt_conversations` 表
   - 设置 `is_archived = TRUE`
   - 记录 `archived_at` 时间戳

2. **分析记录归档** (`archive_old_analyses`)
   - 批量更新以下表：
     - `task_analyses`
     - `hot_question_analyses`
     - `student_chain_analyses`
   - 设置 `is_archived = TRUE`
   - 记录 `archived_at` 时间戳

### 任务配置

- **重试机制**：最多重试 2 次
- **重试策略**：指数退避，最大 60 秒
- **超时控制**：
  - 软超时：5 分钟
  - 硬超时：10 分钟

## API 接口

### 手动归档对话记录

```http
POST /api/system/archiving/conversations
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "days": 90
}
```

**响应：**
```json
{
  "task_id": "abc-123-def-456",
  "message": "已提交对话归档任务，将归档 90 天前的数据"
}
```

### 手动归档分析记录

```http
POST /api/system/archiving/analyses
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "days": 180
}
```

**响应：**
```json
{
  "task_id": "xyz-789-uvw-012",
  "message": "已提交分析归档任务，将归档 180 天前的数据"
}
```

### 参数说明

- `days`：归档 N 天前的数据
  - 类型：整数
  - 范围：1 ~ 3650 天
  - 建议：对话记录 30-90 天，分析记录 90-180 天

## 权限要求

- 手动触发接口需要**管理员权限**
- 自动定时任务由系统自动执行，无需人工干预

## 监控与日志

### 日志输出

任务执行时会输出以下日志：

```
INFO: 已归档 1234 条对话记录（90 天前）
INFO: 已归档 567 条分析记录（180 天前）
ERROR: 归档对话记录失败: <错误详情>
```

### 任务状态查询

使用 Celery 的任务 ID 可查询任务状态：

```python
from celery.result import AsyncResult

result = AsyncResult(task_id)
print(result.state)      # PENDING / SUCCESS / FAILURE
print(result.result)     # 归档结果统计
```

## 配置修改

### 调整定时任务时间

编辑 `backend/app/core/celery_app.py`：

```python
beat_schedule={
    "archive-old-conversations": {
        "task": "app.tasks.data_archiving.archive_old_conversations",
        "schedule": crontab(day_of_week="sunday", hour=2, minute=0),  # 修改这里
        "args": (90,),  # 修改归档天数
    },
    # ...
}
```

### 调整默认归档天数

修改 `backend/app/tasks/data_archiving.py` 中的默认参数：

```python
def archive_old_conversations(self, days: int = 90) -> dict:  # 修改默认值
    ...
```

## 注意事项

1. **数据安全**：归档操作会修改数据库记录，建议先在测试环境验证
2. **性能影响**：大量数据归档可能需要较长时间，建议在低峰时段执行
3. **回滚方案**：如需恢复归档数据，执行以下 SQL：
   ```sql
   UPDATE znt_conversations
   SET is_archived = FALSE, archived_at = NULL
   WHERE archived_at > '2026-01-01';
   ```
4. **数据库索引**：确保 `created_at` 和 `is_archived` 字段有索引以提升性能

## 测试

### 本地测试

1. 启动 Celery worker 和 beat：
   ```bash
   # Terminal 1: 启动 worker
   cd backend
   celery -A app.core.celery_app.celery_app worker --loglevel=info

   # Terminal 2: 启动 beat（定时任务调度器）
   celery -A app.core.celery_app.celery_app beat --loglevel=info
   ```

2. 手动触发测试：
   ```bash
   curl -X POST http://localhost:8000/api/system/archiving/conversations \
     -H "Authorization: Bearer <admin_token>" \
     -H "Content-Type: application/json" \
     -d '{"days": 90}'
   ```

### 验证归档结果

```sql
-- 查看已归档的对话数量
SELECT COUNT(*) FROM znt_conversations WHERE is_archived = TRUE;

-- 查看最近归档的记录
SELECT id, created_at, archived_at
FROM znt_conversations
WHERE is_archived = TRUE
ORDER BY archived_at DESC
LIMIT 10;
```

## 相关文档

- [Celery 异步分析任务](AI_AGENTS.md#深度分析异步任务)
- [数据库性能指南](../DATABASE_PERFORMANCE_GUIDE.md)
- [系统监控](../operations/MONITORING.md)
