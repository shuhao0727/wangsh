# 前端实时更新功能文档

> 最后更新：2026-07-18

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
4. **多 Worker 支持**：后端 pub/sub 已迁移到 Redis Pub/Sub（优先），当 Redis 不可用时自动降级为进程内模式（仅单 worker 有效）。多 worker 部署时确保 Redis 可用且 `SSE_REDIS_PUBSUB_ENABLED=True` 即可实现跨 worker SSE 广播。
5. **订阅就绪保证**：`subscribe()` 会等待 Redis 完成 `SUBSCRIBE` 后才返回，本频道并发订阅者共享 ready 信号；发布和订阅握手由按频道锁串行化，发布先发生时会在继续 Redis 广播的同时补发本地队列，避免首事件丢失或重复。
6. **按频道降级**：单个频道 listener 启动失败或超时只将该频道切换为本地分发，不会把其他健康频道的 Redis 广播一并禁用；等待期间取消连接会同步移除本地订阅。
7. **关闭兼容性**：清理 Redis PubSub 时优先使用 `aclose()`，并兼容旧客户端的 `close()`；即使 `unsubscribe()` 失败也会继续关闭底层连接。

## 故障边界与回归要求

SSE 迁移解决的原始 P0 问题是：进程内 `_subscribers` 无法跨 Uvicorn worker 共享，导致
发布事件和浏览器连接落在不同 worker 时随机丢失。当前实现使用 `sse:` Redis 频道前缀，
避免与小组讨论等既有 Redis 频道冲突。

发布或 listener 失败时会降级到当前进程内队列；这只能保证同一 worker 内可用，不等同于
多 worker 完整可用。因此生产环境启用多个 worker 时，Redis 健康和
`SSE_REDIS_PUBSUB_ENABLED=True` 都是必要条件。

涉及 pub/sub、SSE 端点或 Redis 配置的修改至少验证：

1. Redis 模式下 `publish -> subscribe` 能收到事件。
2. Redis 不可用或功能关闭时，同 worker 的本地降级仍可工作。
3. 两个 worker 间的管理员事件可以跨进程到达。
4. 首次订阅与立即发布不会丢失或重复首事件。
5. listener 异常、取消订阅和应用关闭不会泄漏任务或连接。
6. 小组讨论等独立 Redis Pub/Sub 频道不受 `sse:` 命名空间改动影响。
