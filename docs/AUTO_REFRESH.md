# 前端实时更新功能文档

> 最后更新：2026-03-26

## 概述

前端实时更新功能通过 SSE（Server-Sent Events）实时推送，当后端数据变更时主动通知前端更新，无需轮询。

---

## SSE 实时推送机制

**文件**: `frontend/src/hooks/useAdminSSE.ts`

**功能**:
- 连接后端 SSE 端点 `/api/v1/admin/stream`
- 监听指定事件类型
- 300ms 事件防抖，避免快速连续事件触发多次请求
- 指数退避重连（1s → 2s → 4s → ... → 30s cap），成功连接后重置

**使用方式**:
```typescript
import { useAdminSSE } from '@hooks/useAdminSSE';

// 监听文章变更事件
useAdminSSE('article_changed', loadArticles);
```

---

## 后端 SSE 实现

**端点**: `GET /api/v1/admin/stream`

**文件**: `backend/app/api/endpoints/admin_stream.py`

**频道**: `admin_global` - 全局管理员频道

**鉴权**: `require_admin` — 仅管理员可订阅

**事件类型**:
- `article_changed` - 文章变更（create/update/delete）
- `user_changed` - 用户变更（create/update/delete/batch_delete）
- `agent_changed` - 智能体变更（create/update/delete）
- `assessment_changed` - 测评变更（create/update/delete）
- `discussion_changed` - 讨论会话变更（delete/batch_delete）
- `activity_started` / `activity_ended` / `activity_changed` - 课堂活动
- `new_response` - 新答题

---

## 已实现 SSE 的页面

| 页面 | 事件类型 | 文件位置 |
|------|---------|---------|
| Articles | article_changed | `pages/Admin/Articles/index.tsx` |
| Users | user_changed | `pages/Admin/Users/hooks/useUsers.ts` |
| AIAgents | agent_changed | `pages/Admin/AIAgents/index.tsx` |
| Assessment | assessment_changed | `pages/Admin/Assessment/index.tsx` |
| GroupDiscussion | discussion_changed | `pages/Admin/AgentData/components/GroupDiscussion/index.tsx` |

---

## 注意事项

1. **SSE 连接**：需要管理员权限，自动携带 token
2. **自动重连**：连接断开后指数退避重连（1s → 30s cap）
3. **全局频道**：所有管理员共享同一频道，确保多用户协作时数据同步
4. **⚠️ 单进程限制（重要）**：后端 pub/sub 为进程内实现，`UVICORN_WORKERS` 必须设为 `1`。多 worker 时不同进程间无法共享 SSE 事件，会导致部分管理员收不到实时推送。未来如需多 worker 扩容，需将 pub/sub 迁移到 Redis Pub/Sub
