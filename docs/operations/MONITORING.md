# AI 智能体监控与排障

> 状态：active
> Owner：ops
> 最近复核：2026-10-31（源码核对，未连接运行环境）

本页统一维护监控入口、指标限制与排查顺序。旧快速开始已合并到本页；
当前实现以指标采集和业务写入代码为准，接口返回成功不代表所有指标都已采集。

## 监控端点

| 请求 | 权限 | 内容 |
|---|---|---|
| `GET /api/v1/system/ai-agents-metrics` | 超级管理员 | 会话响应时间、分析缓存等 JSON 字段 |
| `GET /api/v1/system/metrics` | 超级管理员 | HTTP、Typst、数据库连接池及 AI 智能体的 Prometheus 文本 |

端点定义见 [system/metrics.py](../../backend/app/api/endpoints/system/metrics.py)。
鉴权使用已有登录会话；示例中的 `WS_API_BASE` 为已确认的服务地址，`WS_ADMIN_TOKEN`
为获准使用的令牌，不在仓库、日志或共享报告中保存令牌。

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer $WS_ADMIN_TOKEN" \
  "$WS_API_BASE/api/v1/system/ai-agents-metrics" | jq .

curl --fail --silent --show-error \
  -H "Authorization: Bearer $WS_ADMIN_TOKEN" \
  "$WS_API_BASE/api/v1/system/metrics"
```

## 哪些指标可以使用

以下为 2026-10-31 的主仓库源码核对，目标环境需单独确认。

| JSON 字段 | 数据来源 | 使用限制 |
|---|---|---|
| `conversations.api_duration_ms` | `ai_agents:conversations:dur_ms` | 列表请求写入，最多保留 500 条；读取量另受 `HTTP_METRICS_SAMPLE_SIZE` 限制。含 `n/p50/p90/p95/max`，单位 ms |
| `analysis.cache_hit/cache_miss/cache_hit_rate` | `analysis:cache:hit`、`analysis:cache:miss` | 分析缓存读写路径累计；目前仅 JSON 端点暴露这些缓存字段 |
| `conversations.cache_hit/cache_miss/cache_hit_rate` | 固定旧键名 | 会话列表缓存已移除，源码中无对应写入方；不能据此判断缓存故障 |
| `analysis.total/duration_ms` | 固定旧键名 | 源码中未找到对应采集方，不作为真实任务量或耗时依据 |
| `dify.active_leases/lease_limit` | 固定旧键名 | 未接入真实租约键，不能据此判断容量已满或租约泄漏 |

- 会话响应时间映射到 `ai_agents_conversations_duration_ms{quantile="0.95"}` 等指标。
- 采集异常会返回默认值并记录节流警告；无样本时百分位为 `0`。先看样本量和采集日志，不能把零值当作性能优良。
- Dify 固定键读取正常但无值时通常返回 `0/20`；Redis 在读取前失败时，当前实现可能保留 `20/20`。两者均不能替代真实租约状态。
- 真实 Dify 租约使用 `wangsh:dify:concurrency:{resource}`；已有续租、owner token 与 TTL 回收机制，不按旧指南重复开发租约池或直接删键。

源码依据：[采集器](../../backend/app/utils/metrics.py)、
[会话采样](../../backend/app/api/endpoints/agents/ai_agents/conversations.py)、
[分析缓存](../../backend/app/api/endpoints/agents/ai_agents/analysis.py)、
[Dify 租约](../../backend/app/services/agents/dify_concurrency.py)。

## 排障顺序

| 现象 | 先核对 | 后续检查 |
|---|---|---|
| 指标全为零或不增长 | 目标环境、权限、样本量与 Redis 采集警告 | 只对有写入方的指标，在获准请求后比较样本变化 |
| 会话列表慢 | 真实请求耗时、参数、数据量和响应样本 | 核对数据库查询计划、索引与连接池；会话缓存已移除，不调整旧 TTL |
| Dify 请求受限 | 应用错误、并发配置和真实租约记录 | 核对续租/释放日志及 TTL；不以 `.dify` 默认值触发重启或扩容 |
| Redis 不可用 | 当前服务实际使用的连接配置及运行状态 | 在已确认实例执行只读检查，不把本机默认 Redis 当作目标实例 |

只读 Redis 检查示例（连接方式按当前环境确认，以下不包含认证配置）：

```bash
redis-cli ping
redis-cli info memory
redis-cli info keyspace
redis-cli llen ai_agents:conversations:dur_ms
redis-cli lrange ai_agents:conversations:dur_ms 0 9
redis-cli get analysis:cache:hit
redis-cli get analysis:cache:miss
```

## 告警与容量判断

- 先确认指标有采集方、样本覆盖和实际负载，再制定阈值；旧文档中的 P95 100ms、命中率 60%、租约 18/20 均不是当前已验证的告警配置。
- Grafana/AlertManager 是否部署、抓取鉴权和规则是否生效需要现场验证；删除旧示例不表示服务配置发生变化。
- 对话按 `message_type`（`question` / `answer`）逐行存入 `znt_conversations`，没有独立 `conversation_messages` 表。容量按实际行数、增长量和查询负载评估，不按旧固定行数自动归档。
- 数据归档的权限、`days` 参数及恢复边界见 [DATA_ARCHIVING.md](../features/DATA_ARCHIVING.md)，本页不重复维护写入命令。
- 清理指标前明确目标键、用途和授权，先保留排障证据；不使用通配删除处理监控问题。

## 相关入口

- [AI 智能体](../features/AI_AGENTS.md)：业务、缓存及流式边界。
- [数据库性能](../development/DATABASE_PERFORMANCE_GUIDE.md)：查询和索引取舍。
- [部署指南](DEPLOY.md)：环境、发布与恢复操作。
- [测试状态](../testing/TEST_STATUS.md)：实际验证结果与未覆盖项。
