# AI 智能体监控快速开始

## 快速访问监控指标

### 1. 查看 AI 智能体指标

```bash
# 需要超级管理员权限（require_super_admin）
curl -H "Authorization: Bearer <your_superadmin_token>" \
  https://your-domain.com/api/v1/system/ai-agents-metrics | jq .
```

**关键指标快速检查**:
```bash
# 检查缓存命中率
curl -s -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/v1/system/ai-agents-metrics | \
  jq '.conversations.cache_hit_rate'

# 检查 P95 响应时间
curl -s -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/v1/system/ai-agents-metrics | \
  jq '.conversations.api_duration_ms.p95'

# 检查 Dify 租约使用情况
curl -s -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/v1/system/ai-agents-metrics | \
  jq '.dify'
```

### 2. 查看 Prometheus 格式指标

```bash
# 需要超级管理员权限
curl -H "Authorization: Bearer <your_superadmin_token>" \
  https://your-domain.com/api/v1/system/metrics
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
curl http://localhost:8000/health

# 测试 AI 智能体指标（需要先登录获取 token）
# 1. 获取超级管理员 token（登录端点为表单提交，不是 JSON）
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=admin&password=your_password' | jq -r '.access_token')

# 2. 访问监控端点
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/system/ai-agents-metrics | jq .
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
  "http://localhost:8000/api/v1/ai-agents/conversations?limit=20"

# 等待 1 秒后查看指标
sleep 1
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/system/ai-agents-metrics | jq .
```

### 缓存命中率为 0

**现状**: 会话列表缓存已于 2026-10-15 移除
（`backend/app/api/endpoints/agents/ai_agents/conversations.py:26-38`），当前仓库也没有写入
`ai_agents:conversations:cache_hit` / `cache_miss` 的代码，因此该指标恒为 0 属预期行为，
不能据此判断缓存异常。会话列表仍会写入 `ai_agents:conversations:dur_ms` 响应时间样本。

**检查**（在缓存重新引入后才适用）:
```bash
# 连续执行相同查询，然后查看响应时间样本是否增长
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/ai-agents/conversations?limit=20"

redis-cli llen ai_agents:conversations:dur_ms
```

### Redis 连接失败

**检查 Redis 服务**:
```bash
# 检查 Redis 是否运行
redis-cli ping

# 检查 Redis 连接配置（配置加载自仓库根目录 .env）
grep REDIS_HOST /Users/wsh/wangsh/.env
```

## 监控数据清理

监控指标存储在 Redis 中，当前实际有写入的键为：
- `ai_agents:conversations:dur_ms`（会话列表响应时间样本，最多保留 500 条）
- `analysis:cache:hit` / `analysis:cache:miss`（分析结果缓存命中计数）

以下前缀虽然被指标端点读取，但当前仓库未检索到写入方，通常为 0/默认值：
- `ai_agents:conversations:cache_hit`、`ai_agents:conversations:cache_miss`
- `ai_agents:analysis:total`、`ai_agents:analysis:dur_ms`
- `ai_agents:dify:active_leases`、`ai_agents:dify:lease_limit`

证据：`backend/app/utils/metrics.py:242-261`、`backend/app/api/endpoints/agents/ai_agents/conversations.py:47-48`、
`backend/app/api/endpoints/agents/ai_agents/analysis.py:182,189`。

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
