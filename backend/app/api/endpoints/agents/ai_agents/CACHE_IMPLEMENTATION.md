# 会话列表 API Redis 缓存实现

## 概述

为会话列表 API (`GET /api/v1/ai-agents/conversations`) 添加了 Redis 缓存支持，提升高频查询的响应速度。

## 实现细节

### 1. 缓存逻辑 (`conversations.py`)

- **缓存键格式**: `conversations:user:{user_id}:{agent_id}:{limit}`
  - 示例: `conversations:user:1:0:20` (用户 1，所有智能体，20 条记录)
  - 示例: `conversations:user:1:5:20` (用户 1，智能体 5，20 条记录)

- **缓存 TTL**: 60 秒
  - 平衡数据新鲜度和缓存命中率

- **降级策略**: Redis 异常时自动降级到数据库查询，确保服务可用性

### 2. 缓存失效机制 (`agent_usage.py`)

当用户发送新消息时（调用 `create_agent_usage`），自动清除该用户的所有会话列表缓存：

- **清除模式**: `conversations:user:{user_id}:*`
- **清除时机**: 在 `db.commit()` 之后，确保数据已持久化
- **容错处理**: 缓存清除失败不影响主流程

## 缓存键设计

使用 `compact_cache_key_generator` 生成紧凑的缓存键：

```python
cache_key = compact_cache_key_generator(
    "conversations:user",
    user_id,
    agent_id or 0,  # None 转为 0
    limit
)
```

## 性能影响

- **缓存命中**: 响应时间从数据库查询（通常 50-200ms）降至 Redis 读取（< 5ms）
- **缓存未命中**: 增加约 2-5ms 的 Redis 查询开销
- **缓存失效**: 增加约 5-10ms 的模式匹配清除开销

## 监控建议

通过日志监控缓存效果：

```
# 缓存命中
会话列表缓存命中: user_id=1, agent_id=None, limit=20

# 缓存写入
会话列表已缓存: user_id=1, agent_id=None, limit=20

# 缓存清除
清除了 3 个用户 1 的会话列表缓存

# 异常降级
Redis 缓存读取失败，降级到数据库查询: ...
```

## 相关文件

- `backend/app/api/endpoints/agents/ai_agents/conversations.py` - 缓存读写逻辑
- `backend/app/services/agents/agent_usage.py` - 缓存失效逻辑
- `backend/app/utils/cache.py` - 缓存工具类

## 测试验证

已通过以下测试：

1. ✅ 缓存键生成正确
2. ✅ 缓存读写正常
3. ✅ 模式清除功能正常
4. ✅ 降级策略生效
5. ✅ 后端认证测试通过

## 注意事项

1. **不要过度依赖缓存**: 60 秒的 TTL 确保数据不会太旧
2. **监控 Redis 健康**: 异常时会降级但会影响性能
3. **缓存键冲突**: 使用结构化键名避免冲突
4. **多实例部署**: Redis 缓存在多个后端实例间共享，缓存失效会影响所有实例
