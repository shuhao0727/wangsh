# SSE Redis Pub/Sub 迁移与恢复记录

> 状态：archived
> Owner：backend
> 最近复核：2026-07-18
> 替代文档：[AUTO_REFRESH.md](../../../features/AUTO_REFRESH.md)
> 部署文档：[DEPLOY.md](../../deploy/DEPLOY.md)

本文精简保留 SSE 从进程内队列迁移到 Redis Pub/Sub 的故障背景、恢复边界和验证方法。

## 原始 P0 问题

旧实现把订阅者保存在进程级 `_subscribers` 中。Uvicorn 多 worker 时，每个 worker
拥有独立队列：

- 浏览器 SSE 连接可能落在 Worker B。
- 写请求和 `publish()` 可能落在 Worker A。
- Worker A 的进程内事件无法到达 Worker B，表现为随机丢失实时更新。

这个问题不能通过前端重连解决，因为事件从未进入浏览器所在 worker。

## 迁移原则

1. 发布优先进入 Redis，所有 worker 订阅统一的 `sse:` 命名空间频道。
2. 每个 worker 的 listener 把 Redis 消息分发到本地 `asyncio.Queue`。
3. Redis 不可用时保留进程内降级，保证单 worker 或同 worker 的有限可用性。
4. `SSE_REDIS_PUBSUB_ENABLED` 可关闭 Redis 路径，但多 worker 环境不能把降级模式
   误认为完整可用。
5. `sse:` 前缀用于隔离小组讨论等已有 Redis Pub/Sub 频道。

## 订阅与首事件

- `subscribe()` 必须等 Redis `SUBSCRIBE` 完成后再返回 ready。
- 同频道的启动和发布通过锁协调，避免刚订阅就发布时丢失首事件。
- Redis 广播期间需要兼顾本地补发和去重，不能产生首事件重复。
- 取消等待或连接断开时必须移除本地订阅，避免残留 Queue 和 listener。

## 降级与恢复边界

- 单个频道 listener 启动失败时，只降级该频道，不关闭其他健康频道。
- Redis publish 失败时可回退到本地分发，但事件只能到达当前 worker。
- listener 异常需要记录频道和错误；恢复 Redis 后应重新建立订阅。
- 应用关闭时即使 `unsubscribe()` 失败，也继续关闭 PubSub 和底层连接。
- 客户端兼容 `aclose()` 与旧版 `close()`，避免 Redis 客户端升级后泄漏连接。

## 生产检查

多 worker 部署至少确认：

```text
SSE_REDIS_PUBSUB_ENABLED=True
REDIS_HOST/REDIS_PORT 指向当前部署 Redis
Redis 健康检查通过
所有 backend worker 使用同一 Redis 实例和频道前缀
```

Redis 故障期间可以临时降为单 worker，避免把进程内降级用于多 worker 生产。

## 回归矩阵

1. Redis 模式下 `publish -> subscribe` 能收到一次事件。
2. 两个 worker 间发布和订阅能跨进程到达。
3. Redis 不可用或功能关闭时，同 worker 本地降级仍可工作。
4. 订阅后立即发布不会丢失或重复首事件。
5. 单频道 listener 失败不影响其他频道。
6. 取消订阅、listener 异常和应用关闭不泄漏任务或连接。
7. 管理员全局事件、课堂事件和讨论删除事件保持当前类型与频道合同。
8. 小组讨论的独立 Redis 频道不受 `sse:` 前缀改动影响。
9. 前端 EventSource 断线后按指数退避重连，成功后重置退避时间。

## 故障定位顺序

1. 先确认浏览器是否建立 SSE 连接以及是否收到 401/403。
2. 再确认发布端是否执行、事件类型和频道是否正确。
3. 检查 Redis 健康、配置开关、频道订阅数和 listener 日志。
4. 对比发布和订阅所在 worker；只有本地降级时，跨 worker 丢事件是预期限制。
5. 最后检查前端事件名、防抖和 Query 缓存刷新逻辑。

当前行为与频道清单见 [AUTO_REFRESH.md](../../../features/AUTO_REFRESH.md)，环境与 worker
配置见 [DEPLOY.md](../../deploy/DEPLOY.md)。
