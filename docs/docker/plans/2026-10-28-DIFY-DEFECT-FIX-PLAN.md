# Dify 集成缺陷修复计划（P0）

> 状态：active-ref — 实现参考，非独立执行计划
> Owner：project-governance
> 制定日期：2026-10-28
> 依据：独立分析 Agent 只读代码分析 + 主控服务器实测
> 归属：[2.2.1 发布计划](2026-10-28-RELEASE-2.2.1-PLAN.md) 的提交 2 与提交 3
> 说明：本文件只提供「怎么做」的技术细节（匹配规则、边界处理、Dify API 契约）。
> 执行排期、验证策略与部署流程以 2.2.1 发布计划为准。

---

## 〇、服务器实测事实（已验证，非推测）

以下全部是 2026-10-28 在生产服务器 `wangsh-server`（wangsh.cn:6607）上的只读探查结果。

| # | 事实 | 证据 |
|---|---|---|
| 1 | **内网直连 Dify 完全可用** | `docker-api-1:5001/v1/parameters` 从 `wangsh-backend` 容器内访问 **0.0s 响应**（HTTPError 仅因未带 Key，网络层通） |
| 2 | **公网 `wangsh.cn:6606` 从容器访问超时** | 同环境实测 **6.8s URLError 超时**，印证「8 秒超时」 |
| 3 | **6606 = Dify nginx** | `docker port docker-nginx-1` → `80/tcp -> 0.0.0.0:6606` |
| 4 | **ID22「召唤一名"AI伙伴"」是 `advanced-chat`** | Dify `apps` 表 `mode` 字段。**支持 blocking，不会 400** |
| 5 | **ID22 端点配置为内网地址** | `znt_agents` 表：`http://docker-api-1:5001/v1` |
| 6 | **`wangsh-backend` 同时加入 `docker_default` 网络** | `docker inspect` → `docker_default` + `wangsh_wangsh-network`，故能解析 `docker-api-1` |
| 7 | **生产配置** | `AI_PARTNER_SCORING_AGENT_ID=22` |

**结论：走内网 + 白名单是唯一正解。公网绕行不仅慢，而且实测不通。**

**一个需要记录的差异**：「循环中的KNN」是 `agent` 类型（只支持 streaming），「召唤AI伙伴」是 `advanced-chat`（支持 blocking）。**评分路径用 ID22，不受 agent 类型限制。**

---

## 一、缺陷清单（按优先级）

### P0-1：评分被安全检查拦截（`endpoint_security.py`）

**现状**：`_is_disallowed_ip` 的 `ip.is_private` 拒绝 `172.18.0.2`，评分请求在发往 Dify 前被拦，返回 503。

**影响**：AI 伙伴评分功能**完全不可用**。

**修复**：新增受信内部端点白名单，四元组精确匹配（scheme + host + 显式 port + path 前缀）。

### P0-2：连续对话上下文丢失（`dify_provider.py`）

**现状**：
- `build_stream_payload` 只取最后一条 user 消息作为 query
- 无 `conversation_id` 的产生、读取、落库
- **`/stream` 契约缺 `session_id`**（比前两条更靠前，不改则无处绑定）

**影响**：7 个 Dify 应用、7 项连续追问测试全部失败。

**修复**：分两阶段——先止血（有界重放），再终态（`conversation_id` 绑定）。

---

## 二、修复方案

### P0-1 详细方案

**新增配置**（`backend/app/core/config/_services.py`）：

```python
# 显式受信的内部服务端点（逗号分隔 URL 前缀）。
# 只能来自部署配置，无任何 API 可写入。
AGENT_TRUSTED_INTERNAL_ENDPOINTS: str = Field(default="")
```

**生产取值**：`AGENT_TRUSTED_INTERNAL_ENDPOINTS=http://docker-api-1:5001/v1`

**四元组匹配规则**（缺一不算）：

| 维度 | 规则 | 必须拒绝的绕过 |
|---|---|---|
| scheme | 完全一致 | 条目 http，目标 https |
| host | 大小写不敏感**完全相等**，不做后缀匹配 | `evil-docker-api-1`、`docker-api-1.evil` |
| port | **必须显式写出**，等值比较 | 条目漏写端口 → 启动即报错 |
| path | 前缀匹配且**必须在 `/` 边界** | `/v1x/chat`、`/v10/...` |

**实现要点**：

- 命中白名单是**短路**，不是放宽 `_is_disallowed_ip`
- `_is_disallowed_ip` **一行不改**，所有未命中目标继续全拒（含 172.18/16、169.254.169.254）
- 只在 `ai_partner_evaluation.py:200` 传 `allow_trusted_internal=True`；`model_discovery` 保持 `False`
- 条目含 `*`、CIDR、无端口、userinfo、query、fragment → 启动期 `ValueError`（fail-fast）
- 重定向：现有 `follow_redirects=False` + `trust_env=False` 已阻断，但建议显式识别 3xx 并返回 502 + 日志
- 命中白名单时打 info 日志（目标 URL + 命中条目），**不打印 Key**

**残余风险（写进 docstring）**：host 是域名时不做 DNS 校验（这正是放行目的），DNS 被篡改可指向别处。缓解：内网 DNS 由编排控制；建议白名单只放一条，新增需变更评审。

### P0-2 方案（两阶段）

#### 阶段一：止血 —— 有界重放（无迁移，快速）

**做法**：`build_stream_payload` 把历史拼进 `query`，但有明确上限：

- 只取最近 N 轮（建议 4 轮 = 8 条消息）
- 总长度上限（建议 3000 字符，超出则截断更早的轮次）
- 格式：`[历史对话]\n用户: ...\n助手: ...\n[当前问题]\n用户: ...`

**优点**：无迁移、无新表、改动集中在 `dify_provider.py`，半天级。
**缺点**：**不是终态**——Dify 侧会话列表/统计会碎（每条都算新会话）。

#### 阶段二：终态 —— `conversation_id` 绑定（有迁移）

**前置阻塞**：`/stream` 契约缺 `session_id`，必须先补。

**改动链**：

1. `AgentChatRequest` 加 `session_id: Optional[str]`
2. 前端 `index.tsx` 把 `activeSessionId` 加进请求体
3. 新建 `znt_agent_conversations` 表：

| 列 | 说明 |
|---|---|
| `user_id` / `agent_id` / `session_id` | 三元组主键（隔离） |
| `dify_conversation_id` | 上游 ID |
| `dify_user` | 必须存——格式一旦变更，旧会话立刻 404 |
| `endpoint_fingerprint` | sha256(endpoint + key 尾4位)，防换后端应用后串会话 |
| `state` | `active` / `stale` |

4. 首轮不带 `conversation_id` → 捕获响应中的 ID → 落库；后续带上
5. **捕获必须在 `_sanitize_dify_event_block` 之前**，否则将来 sanitizer 加字段黑名单会误伤

**必须同步的连带改动**（不做会出事）：

| 项 | 位置 | 后果 |
|---|---|---|
| 表数量断言 55 → 56 | `DEPLOY.md:881`、`TEST_STATUS.md`（3 处）、`2026-10-27-KNOWN-ISSUES.md`、本组计划 | 多处断言同时失效，非单点 |
| `models/__init__.py` 注册新模型 | `backend/app/models/__init__.py` | 未导入则 Alembic autogenerate 漏表 |
| GDPR 删除/导出 | `privacy.py:197` | 删了消息留下绑定，合规缺口 |
| 归档任务 | `tasks/data_archiving.py` | 孤儿行无限增长 |
| GDPR 测试 | `backend/tests/users/test_gdpr_compliance.py` | 新表未被覆盖，回归测不出来 |
| 4 份功能文档 | `AI_AGENTS.md`、`DATA_ARCHIVING.md`、`MONITORING.md`、`DATABASE_PERFORMANCE_GUIDE.md` | 文档与实际表结构脱节 |

**注意：`MIGRATION_ORIGIN_COLUMNS` 不需要登记**（原计划列错了方向）。
它只对「已进 `LEGACY_BASELINE_TABLES`、且列由后置迁移添加」的表生效——
`bootstrap_db.py:151` 是 `baseline.tables.get(table_name)`，取不到就跳过。
阶段二的新表由新迁移整表创建，本来就不该进 legacy baseline，因此无需登记。

**边界处理**：

| 场景 | 处理 |
|---|---|
| Dify 返回 404 `Conversation Not Exists` | 置 `stale`，**不带 ID 重试 1 次**，成功则写新 ID |
| 换端点/换 Key | `endpoint_fingerprint` 不匹配 → 直接当新会话 |
| 很旧的历史会话 | 按 `updated_at` 软过期（建议 7 天），过期重建 |
| 并发首轮 | `UNIQUE` 约束 + `ON CONFLICT DO NOTHING` |
| 流中断无终止事件 | 不放 ID，保持原映射 |

---

## 三、验证方案

### P0-1 验证（三层）

| 层 | 内容 |
|---|---|
| **L1 单元** | 命中白名单放行、同 host 异 port 拒、path 越界拒、近似 host 拒、未命中内网仍拒、`169.254.169.254` 仍拒、非法条目启动失败 |
| **L2 集成** | MockTransport：白名单配置后评分不再 503、请求 URL 精确 `/v1/chat-messages`、payload **不含 `conversation_id`**（评分必须无状态） |
| **L3 真实（服务器）** | 配置后重启 → `POST /api/v1/ai-partner/evaluate` 期望 **200** 且含 `evaluation_id/total/level/dimensions(4)/suggestions`；反查 Dify 日志 200；**负例**：清空白名单应回到 503 |

### P0-2 验证

| 阶段 | 验证 |
|---|---|
| 阶段一 | 同一会话追问「刚才的编号」，能正确回答；`query` 长度不超上限 |
| 阶段二 | 两轮 `conversation_id` 一致；新会话/切智能体/切用户三种情况均生成新 ID；Dify 侧 `/conversations` 能看到正确会话 |

### 关键未知（必须在 L3 确认）

**Dify 应用侧的「记忆/上下文轮数」配置**。如果设为 0，**即使传了 `conversation_id` 也不会有上下文**。这一项代码读不到，必须在控制台确认 + 实测第二轮追问。

---

## 四、多 Agent 执行分工

| Agent | 任务 | 可写范围 | 依赖 |
|---|---|---|---|
| **A** | P0-1 白名单实现 + L1/L2 测试 | `endpoint_security.py`、`_services.py`、`ai_partner_evaluation.py`、测试 | 无 |
| **B** | P0-2 阶段一（有界重放） | `dify_provider.py`、测试 | 无 |
| **C** | `session_id` 契约打通（前端 + schema + stream.py） | `ai_agent.py`、`index.tsx`、`stream.py` | 无 |
| **D** | P0-2 阶段二（新表 + 迁移 + 绑定） | 模型、迁移、`chat_stream*.py`、GDPR、归档 | C 完成 |

**A、B、C 可并行；D 依赖 C。**

**服务器 L3 验证由主控执行**，Agent 只在本地做 L1/L2。

---

## 五、执行顺序

```
1. Agent A + B + C 并行（本地实现 + 单元/集成测试）
   ↓
2. 主控复核三份改动，跑本地测试
   ↓
3. 部署到服务器，执行 P0-1 的 L3 验证
   ↓
4. 确认 Dify 记忆配置 + 第二轮追问实测
   ↓
5. Agent D（阶段二，需迁移）—— 用户确认后再启动
```

---

## 六、需要用户确认

| # | 事项 | 建议 |
|---|---|---|
| 1 | P0-2 是否先只做阶段一止血，阶段二排期？ | 建议先止血，因为阶段二要迁移 + GDPR 连带改动 |
| 2 | 白名单是否只放一条（仅评分用的 Dify）？ | 建议只放 `http://docker-api-1:5001/v1` |
| 3 | 部署窗口 | 改 `endpoint_security.py` 需重启 backend，建议低峰期 |
| 4 | 是否要我在服务器上直接操作？ | 当前只做了只读探查，改动请明确授权 |

---

## 七、不在本计划范围

- S2~S7 验证（用户明确「先放放」）
- S5 的 3 项重新开发（等验证完再定）
- 前端 `REACT_APP_DIFY_URL=http://wangsh.cn:6606` 与 compose `WEB_PORT=6608` 的配置债（独立问题，记录待办）
