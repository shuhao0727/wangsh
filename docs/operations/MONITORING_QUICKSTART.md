# AI 智能体监控快速开始

## 快速访问监控指标

### 1. 查看 AI 智能体指标

```bash
# 需要管理员权限
curl -H "Authorization: Bearer <your_admin_token>" \
  https://your-domain.com/api/system/ai-agents-metrics | jq .
```

**关键指标快速检查**:
```bash
# 检查缓存命中率
curl -s -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/system/ai-agents-metrics | \
  jq '.conversations.cache_hit_rate'

# 检查 P95 响应时间
curl -s -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/system/ai-agents-metrics | \
  jq '.conversations.api_duration_ms.p95'

# 检查 Dify 租约使用情况
curl -s -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/system/ai-agents-metrics | \
  jq '.dify'
```

### 2. 查看 Prometheus 格式指标

```bash
# 需要超级管理员权限
curl -H "Authorization: Bearer <your_superadmin_token>" \
  https://your-domain.com/api/system/metrics
```

## 本地开发测试

### 启动开发环境

```bash
cd /Users/wsh/wangsh
bash start-dev.sh
```

### 访问监控端点

```bash
# 等待服务启动后测试
sleep 10

# 测试健康检查
curl http://localhost:8000/api/health

# 测试 AI 智能体指标（需要先登录获取 token）
# 1. 获取管理员 token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' | jq -r '.access_token')

# 2. 访问监控端点
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/system/ai-agents-metrics | jq .
```

## 常见问题排查

### 监控指标全为 0

**原因**: Redis 中还没有收集到数据

**解决**:
1. 确认 Redis 服务运行正常
2. 执行几次会话列表查询触发指标记录
3. 再次查看监控端点

```bash
# 触发会话列表查询
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/agents/conversations?limit=20"

# 等待 1 秒后查看指标
sleep 1
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/system/ai-agents-metrics | jq .
```

### 缓存命中率为 0

**原因**: 缓存还没有建立，或每次查询参数都不同

**检查**:
```bash
# 连续执行相同查询，第二次应该命中缓存
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/agents/conversations?limit=20"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/agents/conversations?limit=20"

# 查看缓存命中情况
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/system/ai-agents-metrics | \
  jq '.conversations | {cache_hit, cache_miss, cache_hit_rate}'
```

### Redis 连接失败

**检查 Redis 服务**:
```bash
# 检查 Redis 是否运行
redis-cli ping

# 检查 Redis 连接配置
grep REDIS_URL /Users/wsh/wangsh/.env
```

## 监控数据清理

监控指标存储在 Redis 中，使用以下前缀：
- `ai_agents:conversations:*`
- `ai_agents:analysis:*`
- `ai_agents:dify:*`

### 手动清理监控数据

```bash
# 清理所有 AI agents 监控指标
redis-cli --scan --pattern "ai_agents:*" | xargs redis-cli del

# 或者只清理特定类型
redis-cli del ai_agents:conversations:cache_hit
redis-cli del ai_agents:conversations:cache_miss
redis-cli del ai_agents:conversations:dur_ms
```

### 查看当前监控数据

```bash
# 查看所有 AI agents 相关的键
redis-cli --scan --pattern "ai_agents:*"

# 查看缓存命中统计
redis-cli get ai_agents:conversations:cache_hit
redis-cli get ai_agents:conversations:cache_miss

# 查看响应时间样本（最近 10 个）
redis-cli lrange ai_agents:conversations:dur_ms 0 9
```

## 下一步

- 阅读完整的[监控与告警指南](./MONITORING.md)了解详细配置
- 配置 Grafana 仪表板进行可视化监控
- 设置 AlertManager 实现自动告警
