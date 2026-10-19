# 深度分析异步任务使用指南

> 状态：archived
> Owner：backend
> 原文日期：2026-10-01
> 归档整理：2026-10-19（仅文档归属和历史边界复核）
> 当前入口：[AI_AGENTS.md](../../features/AI_AGENTS.md#深度分析异步任务)

> 历史说明：保留原始分析与实施记录，不指导当前操作，也不代表本轮重新验证。正文接口示例和启动说明是历史版本；当前端点、权限、分页与撤销限制已经收敛到 owner 文档。

## 概述

深度分析（热点问题分析和学生问题链分析）已改造为异步任务模式，避免长时间阻塞 HTTP 请求，支持进度追踪和结果持久化。

## 架构说明

### 技术栈
- **任务队列**: Celery
- **消息代理**: Redis (CELERY_BROKER_URL)
- **结果后端**: Redis (CELERY_RESULT_BACKEND)
- **数据持久化**: PostgreSQL (HotQuestionAnalysis / StudentChainAnalysis 表)

### 工作流程
1. 客户端通过 API 提交分析任务，立即返回 `task_id`
2. Celery worker 后台执行分析任务
3. 任务执行过程中更新进度状态
4. 任务完成后将结果保存到数据库
5. 客户端通过 `task_id` 查询任务状态和结果

## API 端点

### 1. 创建热点问题分析任务

**POST** `/api/agents/analyses/hot-questions/async`

```json
{
  "agent_id": 1,
  "start_at": "2024-01-01T00:00:00Z",
  "end_at": "2024-01-01T12:00:00Z",
  "task_sheet": "Python 基础语法课",
  "class_name": "高一(1)班",
  "bucket_seconds": 180,
  "teacher_marks": [],
  "custom_prompt": null,
  "title": "Python 基础语法课热点分析"
}
```

**响应**
```json
{
  "success": true,
  "task_id": "abc123-def456-ghi789",
  "status": "pending",
  "message": "热点分析任务已提交，请通过 task_id 查询进度"
}
```

### 2. 创建学生问题链分析任务

**POST** `/api/agents/analyses/student-chains/async`

```json
{
  "agent_id": 1,
  "start_at": "2024-01-01T00:00:00Z",
  "end_at": "2024-01-01T12:00:00Z",
  "class_name": "高一(1)班",
  "task_sheet": "Python 基础语法课",
  "merge_threshold": 0.30,
  "title": "学生问题链分析"
}
```

**响应**
```json
{
  "success": true,
  "task_id": "xyz789-abc123-def456",
  "status": "pending",
  "message": "问题链分析任务已提交，请通过 task_id 查询进度"
}
```

### 3. 查询任务状态

**GET** `/api/agents/analyses/tasks/{task_id}`

**响应 - 排队中**
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "pending",
  "message": "任务排队中，等待执行"
}
```

**响应 - 执行中**
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "progress",
  "progress": 50,
  "message": "正在进行热点分析..."
}
```

**响应 - 已完成**
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "completed",
  "progress": 100,
  "message": "分析完成",
  "result": {
    "analysis_id": 123,
    "title": "Python 基础语法课热点分析",
    "theme_count": 5,
    "question_count": 32,
    "unique_students": 18,
    "burst_count": 3
  }
}
```

**响应 - 失败**
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "failed",
  "message": "任务执行失败",
  "error": "数据库连接超时"
}
```

### 4. 取消任务

**DELETE** `/api/agents/analyses/tasks/{task_id}`

```json
{
  "success": true,
  "message": "任务已取消",
  "task_id": "abc123-def456-ghi789"
}
```

### 5. 列出任务记录

**GET** `/api/agents/analyses/tasks?analysis_type=hot_questions&skip=0&limit=20`

**参数**
- `analysis_type`: (可选) `hot_questions` 或 `student_chains`
- `skip`: 跳过记录数，默认 0
- `limit`: 返回记录数，默认 20

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "Python 基础语法课热点分析",
      "agent_id": 1,
      "class_name": "高一(1)班",
      "created_at": "2024-01-01T12:00:00Z",
      "type": "hot_questions"
    }
  ],
  "total": 1
}
```

## 前端集成示例

### React/TypeScript 示例

```typescript
// 提交分析任务
async function submitHotAnalysis(params: HotAnalysisParams) {
  const response = await fetch('/api/agents/analyses/hot-questions/async', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await response.json();
  return data.task_id;
}

// 轮询任务状态
async function pollTaskStatus(taskId: string, onProgress?: (progress: number) => void) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/agents/analyses/tasks/${taskId}`);
        const status = await response.json();

        if (status.status === 'progress' && onProgress) {
          onProgress(status.progress);
        }

        if (status.status === 'completed') {
          clearInterval(interval);
          resolve(status.result);
        }

        if (status.status === 'failed') {
          clearInterval(interval);
          reject(new Error(status.error));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 2000); // 每 2 秒查询一次
  });
}

// 使用示例
async function runAnalysis() {
  try {
    // 提交任务
    const taskId = await submitHotAnalysis({
      agent_id: 1,
      start_at: '2024-01-01T00:00:00Z',
      end_at: '2024-01-01T12:00:00Z',
      task_sheet: 'Python 基础语法课',
      title: '热点分析'
    });

    console.log('任务已提交:', taskId);

    // 轮询状态
    const result = await pollTaskStatus(taskId, (progress) => {
      console.log(`进度: ${progress}%`);
    });

    console.log('分析完成:', result);

    // 跳转到结果页面
    window.location.href = `/analysis/hot/${result.analysis_id}`;

  } catch (error) {
    console.error('分析失败:', error);
  }
}
```

### TanStack Query 集成

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';

// 提交任务 mutation
const useSubmitHotAnalysis = () => {
  return useMutation({
    mutationFn: async (params: HotAnalysisParams) => {
      const response = await fetch('/api/agents/analyses/hot-questions/async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return response.json();
    }
  });
};

// 查询任务状态
const useTaskStatus = (taskId: string | null, enabled: boolean) => {
  return useQuery({
    queryKey: ['analysisTask', taskId],
    queryFn: async () => {
      const response = await fetch(`/api/agents/analyses/tasks/${taskId}`);
      return response.json();
    },
    enabled: enabled && !!taskId,
    refetchInterval: (data) => {
      // 任务完成或失败时停止轮询
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000; // 否则每 2 秒刷新
    }
  });
};

// 组件中使用
function AnalysisPage() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const submitMutation = useSubmitHotAnalysis();
  const taskStatus = useTaskStatus(taskId, !!taskId);

  const handleSubmit = async (params: HotAnalysisParams) => {
    const result = await submitMutation.mutateAsync(params);
    setTaskId(result.task_id);
  };

  return (
    <div>
      {/* 提交表单 */}
      {!taskId && <AnalysisForm onSubmit={handleSubmit} />}

      {/* 进度显示 */}
      {taskId && taskStatus.data && (
        <ProgressBar
          status={taskStatus.data.status}
          progress={taskStatus.data.progress}
          message={taskStatus.data.message}
        />
      )}

      {/* 结果显示 */}
      {taskStatus.data?.status === 'completed' && (
        <AnalysisResult result={taskStatus.data.result} />
      )}
    </div>
  );
}
```

## 运维配置

### 启动 Celery Worker

```bash
# 开发环境
cd backend
celery -A app.core.celery_app:celery_app worker --loglevel=info

# 生产环境（推荐使用 supervisor 或 systemd）
celery -A app.core.celery_app:celery_app worker \
  --loglevel=info \
  --concurrency=4 \
  --max-tasks-per-child=100
```

### 任务超时配置

任务超时在 `backend/app/core/celery_app.py` 中配置：

```python
celery_app.conf.update(
    task_soft_time_limit=300,   # 5 分钟软超时（发送异常）
    task_time_limit=600,        # 10 分钟硬超时（强制终止）
)
```

### 监控任务队列

```bash
# 查看 Celery 队列状态
celery -A app.core.celery_app:celery_app inspect active

# 查看已注册的任务
celery -A app.core.celery_app:celery_app inspect registered

# 查看任务统计
celery -A app.core.celery_app:celery_app inspect stats
```

## 注意事项

1. **任务 ID 有效期**: Celery 任务结果默认保留 24 小时，过期后无法查询状态
2. **并发控制**: 建议根据服务器性能调整 worker 并发数（`--concurrency`）
3. **数据量限制**: 单次分析最多处理 500 条对话事件，避免超时
4. **错误处理**: 任务失败时会自动记录日志，但不会自动重试
5. **数据库连接**: 每个任务独立创建数据库会话，任务完成后自动释放

## 迁移指南

### 从同步 API 迁移

**旧方式（同步）**
```typescript
// 直接调用，等待结果
const result = await fetch('/api/agents/analysis/hot-questions', {
  method: 'POST',
  body: JSON.stringify(params)
}).then(res => res.json());
```

**新方式（异步）**
```typescript
// 1. 提交任务
const { task_id } = await fetch('/api/agents/analyses/hot-questions/async', {
  method: 'POST',
  body: JSON.stringify(params)
}).then(res => res.json());

// 2. 轮询状态
const result = await pollTaskStatus(task_id);
```

## 故障排查

### 任务一直处于 pending 状态
- 检查 Celery worker 是否运行
- 检查 Redis 连接是否正常
- 查看 worker 日志是否有错误

### 任务执行失败
- 查看任务错误信息: `GET /api/agents/analyses/tasks/{task_id}`
- 查看 Celery worker 日志
- 检查数据库连接和权限

### 任务超时
- 调整任务超时配置
- 减少分析的数据量（缩短时间范围）
- 增加 worker 资源配置

## 相关文件

- **任务定义**: `backend/app/tasks/agent_analysis.py`
- **API 端点**: `backend/app/api/endpoints/agents/ai_agents/analysis_async.py`
- **Celery 配置**: `backend/app/core/celery_app.py`
- **测试文件**: `backend/tests/ai_agents/test_async_analysis.py`
