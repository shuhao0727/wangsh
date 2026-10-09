# AI 智能体监控与告警指南

> 状态：active
> Owner：ops
> 最近复核：2026-10-06
> 归档条件：监控端点、告警和排障流程被新的 ops owner 文档完整替代后归档

## 概述

本文档描述 AI 智能体板块的监控指标、告警规则和运维响应流程。

## 监控端点

### 1. AI 智能体专用指标（JSON 格式）

**端点**: `GET /api/system/ai-agents-metrics`

**权限**: 超级管理员

**返回示例**:
```json
{
  "conversations": {
    "cache_hit": 1234,
    "cache_miss": 56,
    "cache_hit_rate": 0.956,
    "api_duration_ms": {
      "n": 500,
      "p50": 15,
      "p90": 45,
      "p95": 68,
      "max": 120
    }
  },
  "analysis": {
    "total": 789,
    "duration_ms": {
      "n": 200,
      "p50": 85,
      "p90": 150,
      "p95": 220,
      "max": 450
    }
  },
  "dify": {
    "active_leases": 12,
    "lease_limit": 20
  }
}
```

### 2. Prometheus 格式指标

**端点**: `GET /api/system/metrics`

**权限**: 超级管理员

包含 AI 智能体指标和全系统指标（HTTP、Typst、数据库连接池等）。

## 关键指标说明

### 性能指标

#### 会话列表响应时间
- **指标名**: `ai_agents_conversations_duration_ms`
- **类型**: 百分位数（P50/P90/P95/Max）
- **目标**: 
  - P50 < 50ms
  - P95 < 100ms
- **说明**: 会话列表 API 响应时间，包含缓存查询和数据库查询

#### 分析任务响应时间
- **指标名**: `ai_agents_analysis_duration_ms`
- **类型**: 百分位数（P50/P90/P95/Max）
- **目标**:
  - P50 < 100ms
  - P95 < 200ms
- **说明**: 热点分析、学生问题链等分析任务的响应时间

### 缓存指标

#### 缓存命中率
- **指标名**: `ai_agents_conversations_cache_hit_rate`
- **类型**: 比率（0-1）
- **计算**: `cache_hit / (cache_hit + cache_miss)`
- **目标**: > 0.8 (80%)
- **说明**: 会话列表缓存命中率，低命中率表示缓存配置需要优化

#### 缓存命中/未命中次数
- **指标名**: 
  - `ai_agents_conversations_cache_hit_total`
  - `ai_agents_conversations_cache_miss_total`
- **类型**: 计数器
- **说明**: 累计缓存命中和未命中次数

### 容量指标

#### Dify 租约使用情况
- **指标名**: 
  - `ai_agents_dify_active_leases`: 当前活跃租约数
  - `ai_agents_dify_lease_limit`: 租约总限制
- **类型**: 仪表（gauge）
- **告警阈值**: `active_leases / lease_limit > 0.9` (90%)
- **说明**: Dify API 并发租约使用情况，接近上限时需要限流或扩容

#### 分析任务总数
- **指标名**: `ai_agents_analysis_total`
- **类型**: 计数器
- **说明**: 累计分析任务请求数，用于容量规划

## 告警规则

### 1. 会话列表慢查询告警

**级别**: ⚠️ 警告

**条件**: `ai_agents_conversations_duration_ms{quantile="0.95"} > 100`

**含义**: 95% 的会话列表请求响应时间超过 100ms

**处理步骤**:
1. 检查 Redis 缓存状态
   ```bash
   redis-cli ping
   redis-cli info stats
   ```
2. 检查缓存命中率
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://api.example.com/api/system/ai-agents-metrics | jq '.conversations.cache_hit_rate'
   ```
3. 如果命中率 < 60%，检查：
   - Redis 内存是否充足
   - TTL 配置是否合理（当前 60 秒）
   - 是否有大量冷启动请求
4. 检查数据库索引：
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM conversations 
   WHERE user_id = ? AND agent_id = ? 
   ORDER BY updated_at DESC LIMIT 20;
   ```

### 2. 缓存命中率过低告警

**级别**: ⚠️ 警告

**条件**: `ai_agents_conversations_cache_hit_rate < 0.6`

**含义**: 缓存命中率低于 60%

**处理步骤**:
1. 检查 Redis 可用性和内存
2. 检查 TTL 配置（`backend/app/api/endpoints/agents/ai_agents/conversations.py`）
3. 分析请求模式，是否有大量不同参数组合
4. 考虑调整缓存策略或增加 TTL

### 3. Dify 租约接近上限告警

**级别**: 🔴 严重

**条件**: `ai_agents_dify_active_leases > 18` (假设限制为 20)

**含义**: Dify 并发租约接近上限，可能影响新请求

**处理步骤**:
1. 立即检查当前租约状态
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://api.example.com/api/system/ai-agents-metrics | jq '.dify'
   ```
2. 检查是否有租约泄露（长时间未释放）
3. 短期方案：启用请求限流
4. 长期方案：
   - 联系 Dify 申请扩容
   - 优化租约使用模式
   - 考虑实现租约池和排队机制

### 4. 分析任务性能下降告警

**级别**: ⚠️ 警告

**条件**: `ai_agents_analysis_duration_ms{quantile="0.95"} > 200`

**含义**: 95% 的分析任务响应时间超过 200ms

**处理步骤**:
1. 检查热点分析相关服务状态
2. 检查 jieba 分词服务是否正常
3. 检查数据库聚合查询性能
4. 检查是否有大量数据需要归档

## 容量规划

### 对话记录数量监控

虽然当前监控端点未直接暴露对话记录总数，但可以通过数据库查询获取：

```sql
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM conversation_messages;
```

**告警阈值**:
- 对话记录数 > 500,000 条：触发归档任务
- 消息记录数 > 5,000,000 条：考虑分片或归档

**归档操作**:
```bash
# 手动触发归档（仅管理员）
curl -X POST -H "Authorization: Bearer <token>" \
  https://api.example.com/api/system/archiving/conversations \
  -d '{"before_date": "2024-01-01", "dry_run": false}'
```

### Redis 内存监控

```bash
# 检查 Redis 内存使用
redis-cli info memory

# 检查键空间
redis-cli info keyspace

# 检查特定前缀的键数量
redis-cli --scan --pattern "ai_agents:*" | wc -l
```

**建议配置**:
- 为 AI 智能体指标预留至少 100MB Redis 内存
- 监控 Redis 碎片率，超过 1.5 时考虑重启

## 监控仪表板示例

### Grafana 面板配置

```yaml
# AI 智能体性能仪表板
panels:
  - title: "会话列表响应时间"
    type: graph
    targets:
      - expr: ai_agents_conversations_duration_ms
        legend: "{{quantile}}"
    thresholds:
      - value: 50
        color: yellow
      - value: 100
        color: red

  - title: "缓存命中率"
    type: gauge
    targets:
      - expr: ai_agents_conversations_cache_hit_rate
    thresholds:
      - value: 0.6
        color: red
      - value: 0.8
        color: yellow
      - value: 1.0
        color: green

  - title: "Dify 租约使用"
    type: gauge
    targets:
      - expr: ai_agents_dify_active_leases / ai_agents_dify_lease_limit
    thresholds:
      - value: 0.7
        color: yellow
      - value: 0.9
        color: red
```

## 日常运维检查清单

### 每日检查
- [ ] 检查 AI 智能体指标端点是否正常响应
- [ ] 检查缓存命中率是否在正常范围（> 60%）
- [ ] 检查 P95 响应时间是否正常（< 100ms）

### 每周检查
- [ ] 检查对话记录和消息表行数
- [ ] 检查 Redis 内存使用情况
- [ ] 分析 Dify 租约使用趋势

### 每月检查
- [ ] 评估是否需要执行归档任务
- [ ] 检查监控指标保留策略
- [ ] 审查告警规则是否需要调整

## 故障排查流程

### 问题：会话列表加载缓慢

1. **确认症状**
   ```bash
   curl -w "@curl-format.txt" -H "Authorization: Bearer <token>" \
     "https://api.example.com/api/agents/conversations?limit=20"
   ```

2. **检查缓存**
   - 缓存命中率
   - Redis 可用性
   - 缓存键是否正确生成

3. **检查数据库**
   - 查询执行计划
   - 索引是否有效
   - 表行数是否过大

4. **临时缓解**
   - 增加缓存 TTL
   - 启用降级模式（仅查询最近数据）
   - 限制单次查询结果数

### 问题：Dify 租约耗尽

1. **确认当前状态**
   ```bash
   # 检查活跃租约数
   curl -H "Authorization: Bearer <token>" \
     https://api.example.com/api/system/ai-agents-metrics | jq '.dify.active_leases'
   ```

2. **排查租约泄露**
   - 检查应用日志，查找未正确释放的租约
   - 检查是否有长时间运行的分析任务

3. **临时缓解**
   - 重启相关服务释放僵尸租约
   - 启用请求限流保护

4. **永久方案**
   - 实现租约池管理
   - 添加租约超时自动释放机制
   - 申请 Dify 扩容

## 相关文档

- [AI 智能体系统说明](../features/AI_AGENTS.md) — 缓存与 SSE 流式的实现背景
- [部署运维文档](../docker/deploy/DEPLOY.md)

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2024-10-01 | 1.0 | 初始版本，包含基础监控指标和告警规则 |
