# AI 智能体系统文档

> 最后更新：2026-10-24
> 
> **注意**：SSE流式输出修复已于2026-03-23完成，Dify集成已支持完整流式效果。

## 概述

AI 智能体系统是项目的核心功能模块，支持多平台 AI 对话、小组讨论、流式输出等功能。

### 核心功能

- **多平台支持**：OpenRouter、Dify、SiliconFlow 等
- **流式对话**：SSE（Server-Sent Events）实时响应
- **小组讨论**：多人协作讨论，支持禁言、成员管理
- **对话管理**：会话历史、消息记录、导出功能
- **使用统计**：记录使用情况、热门问题分析
- **深度分析**：热点问题和学生问题链使用独立可解释分析管线
- **模型发现**：自动检测可用模型

---

## 管理端使用记录控件

`/admin/agent-data?tab=usage` 的搜索、日期、筛选与查询操作遵循
[全站控件规范](../../frontend/src/styles/COLORS.md#控件外观)，统一使用 36px 常规高度。
搜索与日期范围、筛选条件与操作分为两组，按可用宽度换行；日期范围、学号姓名和查询操作各自保持成组。
筛选参数、查询触发、日期范围、导出权限与分页行为保持。

使用记录详情在桌面并排展示学生与智能体信息，在窄屏改为纵向排列。问题与回答按会话顺序分开标注；回答内容支持 Markdown/GFM 列表、行内代码、代码块和表格。开发环境首次未筛选查询成功且无记录时可展示带有明确标记的排版预览；筛选结果为空、翻页或接口失败均不使用预览数据，预览不写入数据库。

---

## 登录与访客访问边界

- 网站继续保留访客浏览模式，未登录用户仍可访问现有公开页面；该模式不授予 AI 智能体能力。
- `/ai-agents` 页面只允许有效登录的 `student`、`teacher`、`admin`、`super_admin` 访问。未登录访问时跳转 `/login`，并通过安全的站内 `redirect` 在登录后返回原路径、查询参数和锚点。
- 后端 `/api/v1/ai-agents` 命名空间中的智能体列表、会话历史、使用记录写入、模型流式对话和小组讨论接口均执行服务端认证。匿名请求返回 `401`，不能只依赖前端隐藏或路由跳转。
- 历史数据库中的 `guest` 角色即使持有有效会话，也不能使用智能体功能，返回 `403`；必须退出并登录正式账号。
- 小组讨论的 `public-config` 与 `public-config/stream` 只表示配置内容面向已登录用户公开，不再允许匿名读取或订阅。SSE 端点继续使用受控 query token/Cookie/Bearer 认证和会话持续校验。
- 准入校验必须发生在智能体业务服务、会话读取/写入和外部模型调用之前；前端守卫属于用户体验层，后端认证是最终权限边界。

---

## AI伙伴临时共享榜单（未发布）

> 发布状态更新（2026-10-20 复核）：本节对应源码已随 `2.1.4` 及后续发布构建进入镜像
> （`0797303` 为 `2.1.3` 版本准备提交，其后是 `2.1.4` 发布准备 `78b86de`；当前
> `frontend/package.json` 为 `2.1.6`）。标题保留原文以维持既有链接锚点；“未发布”只适用于
> 本节记录的候选阶段，不代表当前构建内容。服务器是否已部署仍以发布记录为准。

- 独立页面入口仍为 `/games/ai-partner/index.html`。源码维护于 `frontend/ai-partner/`，
  来源为 `/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1`；保留三维展示、选型与课堂检查。
  本轮将原前端规则评分改为后端调用平台已配置模型，评价价格/性价比、完成度、选型合理性和验证风险；
  课堂参考价格不是实时采购报价，课堂检查也不等于真实硬件或模型验证。
- 前端通过 `POST /ai-partner/evaluate` 获取服务端评分与 `evaluation_id`，榜单提交不再传入客户端 `score`。
  未配置可用 AI 或评分调用失败时必须明确提示不可评分，不使用本地规则或固定分数冒充模型结果。
  四维各 `25` 分，总分由服务端求和；价格依据后端目录而非客户端传价。
  字段、模型配置和凭证限制分别以 API 与部署 owner 为准。
- 评分智能体 ID 留空或仅空白时视为未配置，后端正常启动；非空值继续要求正整数。
- **评分的耗时与容错**（2026-10-29 实测后确定，改动前请先读）：
  - 单次推理实测 24–43s（中位数约 25s）。四层超时必须严格嵌套：
    httpx 单次 50s < 总预算 110s < Redis 锁 120s < 前端 140s < 网关该路径 180s。
    任何一层比上一层短，都会在上一层的预算用完前先断开。
  - 网关必须为 `/api/v1/ai-partner/evaluate` 单独放宽 `response_header_timeout`
    （默认 30s）。注意：这个评分接口是普通 JSON 响应，响应头要等整段推理结束才会发出
    （`/ai-agents/stream` 这类 SSE 接口是流式返回、头会先发出，不受这一层约束），
    用默认值会在 30s 断开。
  - 模型偶发输出语法损坏的 JSON 或多余维度。解析失败会**重试一次**（`MODEL_ATTEMPTS=2`）；
    超时与上游 5xx **不重试**——重试只会翻倍延迟且多半仍失败。
    实测重试能挽回约 2/3 的坏输出，但无法完全消除：模型侧损坏概率仍在。
  - Dify 的 DeepSeek 插件会把思维链写进 `<think>…</think>`，与答案共用同一字符串；
    解析前必须过 `assistant_answer_sanitizer`，否则 `json.loads` 必然失败。
- 桌面左上角入口与浮窗标题统一为“榜单”，浮窗不额外展示说明段落；保留状态与错误反馈。
- 页面精简重复介绍和装饰文字，选型规则折叠查看；操作引导、配置缺项、风险提醒、评分理由及数据说明保留，选型/测试/评分/上榜/草稿与导出规则不变。
  本轮桌面优先、不测手机，不将这项范围选择写成移动端验收通过。
- 修改方案会使已有评分失效；评分中修改方案或切换账号后，旧响应不能覆盖当前方案。
  前端仍在课堂检查、核心测试和课堂记录满足条件后允许提交，但这些前端门槛不是服务端实测证明。
- 榜单面向正式登录用户，拒绝 `guest`；前端复用原平台 auth 客户端，不另建登录或 token 来源。
  草稿仅按用户隔离；切换账号清空当前方案、课堂记录与评分，不能读取其他账号草稿。
  草稿不按轮次隔离，不属于临时榜单数据；换课不会自动删除同一账号保存的方案。
- 仅当榜单浮窗开启且页面可见时，每 `5` 秒轮询；关闭浮窗或页面不可见时停止轮询。
- 榜单是 Redis 共享的课堂临时展示，不是防作弊或考试评分系统；不永久记录姓名和成绩，
  不新增管理员、数据库表或 migration。排名、有效期及错误码以 [API 合同](../development/API.md#ai伙伴临时共享榜单未发布) 为准。
- 新一课通过更换轮次配置开始，不增加管理员操作入口；见 [配置说明](../docker/deploy/DEPLOY.md#ai伙伴临时共享榜单配置未发布)。
  独立源码构建与静态资源边界见 [前端脚本说明](../../frontend/scripts/README.md#ai伙伴独立源码入口未发布)。
- AI 伙伴选型目录的唯一维护源为 `backend/app/services/ai_partner_catalog.json`。修改后在仓库根目录运行
  `node scripts/sync-ai-partner-catalog.mjs --write`，生成 `frontend/ai-partner/src/catalog.json` 并同时保留两份变更；
  前后端各自携带运行资源，继续独立构建。CI 使用 `node scripts/sync-ai-partner-catalog.mjs --check` 检查副本漂移，
  不直接编辑前端派生副本；脚本入口见 [scripts/README.md](../../scripts/README.md)。

以上为候选阶段的变更记录；当前构建状态见本节开头说明。本节不复制测试数字，实际结果
由主线程统一写入 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

## 历史加载与会话身份边界

- 历史作用域包括已认证用户 ID、当前智能体、session 与请求代次。自动恢复、手动选择及发送后的延迟刷新共用失效逻辑；新会话、身份或智能体变化、卸载使旧请求/计时器/流回调无效。当前实现是逻辑失效，不保证中止传输。
- 加载中、失败或只读历史不能作为旧上下文继续发送；失败允许显式重试，不可续发历史通过新建会话恢复。已认证但 user 信息为 NULL 时不读、不发、不退回 guest 持久化。
- 历史 API 每个本人 session 一条摘要；省略智能体过滤列出本人所有 session。混合 agent 或含 NULL agent 的 session 摘要身份为 NULL；传 agent 筛选仅决定 session 是否入选，摘要统计仍覆盖整个本人 session。
- 当前页面初始列表仅保留当前 agent 可续发历史，未新增跨 agent/混合历史的全量只读入口。活动 session 刷新后身份变为 NULL 或其他 agent 时，保留已加载消息并转只读，不回退当前 agent 身份。
- 前端防误发是纵深防御，不替代后端用户归属和 session 权限。历史摘要分别按 `created_at DESC, id DESC` 选取最新问题和最新答案，优先最新答案；该答案为空白时回退最新问题，二者为空白则为空，不回捞更旧的非空消息，预览截取前 80 字符。真实供应商 SSE、认证切换、生产视图与大历史数据性能仍需独立端到端验证。

## 架构设计

### SSRF 防护的放行边界（改动前必读）

智能体端点、模型发现都要过 `backend/app/services/agents/endpoint_security.py` 的
IP 校验。判定**按真实风险分级，不是按 `is_private` 一刀切**：

| 地址类别 | 判定 | 理由 |
|---|---|---|
| 云元数据 `169.254.169.254`、`100.100.100.200`、`fd00:ec2::254` | **拒绝（最高优先级）** | 命中即可拿到云主机临时凭证，是真实的攻击面 |
| 基准测试段 `198.18.0.0/15`、`2001:2::/48` | **放行** | 现代内网基本不用；本地代理的 fake-ip 恰好落在这里 |
| RFC 1918 私网 `10/8`、`172.16/12`、`192.168/16` | 拒绝 | 常规内网 |
| 环回 `127/8`、`::1` | 拒绝 | 打到自身服务 |
| 链路本地 `169.254/16`（非上述元数据地址） | 拒绝 | |
| 组播 / 未指定 / 保留 | 拒绝 | |

**为什么放行基准测试段**（2026-10-29 实测）：

本地开启 Clash 的 fake-ip 后，`newapi.dragon3api.com` 被解析成 `198.18.1.8`。
浏览器和 `curl` 都能正常访问——`curl -sv` 显示 `Trying 198.18.1.8:443`
且连接成功返回 401，说明代理在该地址上转发。旧逻辑按 `is_private` 拒绝，
导致本地**完全无法配置 AI 智能体**。而这两个段不在 RFC 1918 内、云元数据也不用，
放行的实际风险很低。

**IPv4-mapped 归一化**：`::ffff:198.18.1.8` 这类写法先归一化成 IPv4 再判定，
否则可以用 IPv6 写法绕过。`::ffff:10.0.0.1` 仍然判为内网。

**写测试时的注意事项**：不要依赖真实 DNS。本地开 fake-ip 后，
`docker-api-1` 会被解析成 `198.18.0.198`、`.invalid` 域名也能"解析成功"，
测试会得到与 CI 相反的结果。应该在 fixture 里 mock `socket.getaddrinfo`。

### 智能体缓存约定（踩过坑，改动前必读）

`ai_agent.get_agent()` 带进程级 `TTLCache(ttl=60)`。**缓存里只能放普通属性字典，
绝不能放 ORM 实例。**

原因：ORM 实例绑定在创建它的 session 上，而 `get_db` 是请求级的。
session 关闭后实例变 detached；一旦需要刷新属性就抛
`DetachedInstanceError: Instance <AIAgent> is not bound to a Session`。

2026-10-29 生产实测症状：`POST /api/v1/ai-agents/stream` **3 次里 2 次 503**
「读取智能体配置失败」，堆栈落在 `build_messages` 读 `system_prompt`。
用户点开 AI 智能体对话大概率看不到回答。

修法是缓存只存列数据快照（用 `sa_inspect(agent).mapper.column_attrs` 取），
命中时用 `AIAgent(**snapshot)` 重建游离实例返回——返回值类型不变，
但不再与任何 session 绑定。有测试 `tests/ai_agents/test_agent_cache_detached.py` 锁住。

### 数据模型

**核心表**：
- `znt_agents` - 智能体配置
- `znt_conversations` - 对话记录（问题与回答以 `message_type=question/answer` 分行保存）
- `znt_group_discussion_sessions` - 小组讨论会话
- `znt_group_discussion_messages` - 小组讨论消息
- `znt_group_discussion_members` - 小组讨论成员
- `znt_group_discussion_analyses` - 讨论分析结果

> 使用记录不是独立表：`/ai-agents/usage` 由 `v_conversations_with_deleted` 视图按
> `session_id` 聚合 `znt_conversations` 生成（`backend/app/services/agents/agent_usage.py`）。

**关键字段**：
- `agent_type`：平台类型（`general` / `dify` / `openai`）；OpenRouter、SiliconFlow 等由 `api_endpoint` 识别为 OpenAI 兼容协议
- `api_endpoint`：API 端点
- `api_key_encrypted`：加密存储的 API 密钥（旧 `api_key` 列保留但不再写入明文）
- `model_name`：模型名称
- `is_active`：是否启用

---

## Dify 集成

### 配置方式

在智能体配置中设置：
- `agent_type`: `dify`
- `api_endpoint`: Dify API 地址（如 `http://dify-api:5001/v1`）
- `api_key`: Dify API Key
- `model_name`: 模型标识，仅对非 Dify 智能体用于请求体和模型列表；Dify 的请求体不携带该值，
  应用身份由 API Key 绑定，因此 Dify 配置表单不再展示“模型”字段（历史值保留在库中但不生效）

### 流式输出修复（2026-03-23）

**问题**：Dify 对话响应一次性显示，无流式效果

**根因链**：后端 httpx → FastAPI StreamingResponse → 开发期 Vite 代理或生产
Caddy 网关 → 浏览器，任一层错误缓冲都会破坏流式体验

**修复方案（3层）**：

1. **后端 `backend/app/services/agents/chat_stream.py`（Dify 字节流细节在 `chat_stream_dify_helpers.py`）**：
   - 使用 `aiter_bytes()` 增量读取 Dify SSE 字节流，并按单个 SSE 事件边界重新组帧
   - 避免使用 `aiter_text()` 或 `aiter_lines()`（会缓冲），也不聚合完整响应后再返回

2. **后端 `backend/app/api/endpoints/agents/ai_agents/stream.py`**：
   - StreamingResponse 添加响应头：
     - `Cache-Control: no-cache, no-transform`
     - `X-Accel-Buffering: no`

3. **代理与网关**：
   - 开发环境由 `frontend/vite.config.ts` 将流式 API 代理到 `DEV_PROXY_TARGET`
   - 生产环境由 Caddy 转发 `/api/*`
   - 不要重新引入会聚合完整响应后再返回的自定义代理处理

**前端**：
- 使用 `useStreamEngine` hook
- XHR `onprogress` + `eventsource-parser` 解析 SSE 事件
- 替代 Fetch API（Fetch reader.read() 也会缓冲）

**教训**：SSE 流式输出需要全链路禁用缓冲，任何一层缓冲都会导致前端一次性收到所有数据

### Dify 推理内容隔离（2026-09-20）

Dify 的 DeepSeek 插件可能把 `reasoning_content` 编入同一文本流，表现为
`<think><!--dify-deepseek-reasoning-->…</think>`。该内容属于内部推理，不是用户可见回答，
不得出现在浏览器 SSE、页面、使用记录或历史会话中。

- 后端继续使用 `aiter_bytes()` 保持实时性，但不再对 Dify SSE 做无条件原始透传：按事件边界
  增量解析，丢弃 `agent_thought`，并对 `message`、`agent_message`、`text_chunk` 的正文
  执行可跨分片的状态化过滤。`message_end`、`workflow_finished` 等完整事件中的字符串也会清理。
- 前端正文只接受 `message_delta`、`message`、`agent_message`、`text_chunk` 四类明确事件；
  未知事件和推理事件默认忽略。流式增量、终止事件完整答案和 Markdown 渲染前各有一道清理边界。
- 使用记录写入前统一清理 assistant answer；清理后为空时不创建 answer 行。会话摘要、本人详情、
  管理员详情和使用记录响应会在读取时再次清理，以保护尚未治理的历史污染数据。用户 question
  保持原样，避免用户正常讨论 `<think>` 标签时被修改。
- 未闭合的 `<think>` 区块按失败关闭处理：区块开始后的剩余内容不展示、不持久化。该策略优先
  防止推理泄露；历史数据库本身不会由应用启动或读取接口自动批量改写。

### Dify 完整回答与失败合同（2026-09-28）

Dify 流式响应只有在“出现可见正文 + 收到合法终止事件”时才算成功。后端允许从以下位置提取最终答案：
`answer`、`data.answer`、`outputs.answer`、`data.outputs.answer`；`thought`、`reasoning`、
`agent_thought` 等字段永远不作为用户正文。`message_end` 或 `workflow_finished` 为空、只有推理内容、
HTTP 200 后无有效 SSE，均返回结构化错误而不是成功的空 `message_end`。

当前 Dify 失败码包括：`dify_empty_answer`、`dify_rate_limited`、`dify_upstream_error`、
`dify_stream_incomplete`、`dify_stream_interrupted`。前端会透传并转换为用户可理解的提示，
不再把错误码或“模型未返回内容”混在正常回答中。

智能体长 SSE 在返回响应前已完成智能体、Provider、配置和历史加载，并释放 request-scoped 数据库会话；
流期间只使用内存中的 prepared provider/config。Dify user 标识使用稳定的
`wangsh:user:{user_id}:agent:{agent_id}`，不使用显示名或 `guest`。会话失效或无法复核时，SSE
会发送 `session_invalid` 或 `session_revalidation_unavailable` 错误事件，并在 finally 中关闭上游流。

以上修复消除了已识别的空回答、推理泄露和长流持有请求数据库会话问题。2026-09-28 起，Dify 长流还会通过 Redis 分布式租约执行跨 worker 的智能体级并发保护：默认每个智能体最多 20 条活动 Dify 流，最多等待 2 秒；超限返回 `provider_busy` 和 `retry_after`，Redis 不可用时返回 `concurrency_unavailable`，不再无限排队或把连接池耗尽。租约带 TTL、定期续期，并在成功、异常、客户端断开时释放；worker 崩溃后由 TTL 回收。续租失败会立即把租约标记为失效，停止继续读取上游或把响应标记为成功，避免 Redis 故障时保护阈值失效。

另外，Redis 客户端初始化采用 single-flight 保护，60 条并发请求不会在首次访问时重复创建 Redis 连接池。`DIFY_MAX_CONCURRENCY` 是保护阈值，不是 Dify 官方容量承诺。60 人同时使用是否能全部成功，仍需结合真实 Dify 配额、响应时长和压测结果验收；并发保护的目标是把超载转换为可重试的明确失败，避免空回答和级联资源耗尽。

### 长回答与截断处理（2026-07-23）

- 前后端不再使用固定的 120 秒总时长截断；前端 120 秒、后端 `HTTPX_TIMEOUT`
  均表示“连续无新数据”的空闲超时。只要上游持续产生分片，回答可以超过 120 秒。
- OpenAI 兼容流必须出现 `[DONE]` 或 `finish_reason` 才算正常结束；连接提前关闭、
  读取超时和 Dify 中途断流都会返回错误事件，并保留已经生成的文本。
- `finish_reason=length`、`max_tokens` 或 `max_output_tokens` 会返回
  `output_limit_reached`，不伪装成完整成功；前端会保留部分回答并提示模型达到输出
  长度上限。
- `content_filter`/`refusal`、工具调用、上下文窗口超限和未知结束原因不会再发送
  `message_end`；只有正常停止原因或显式终止标记才视为完整成功。
- DeepSeek Anthropic 兼容地址（例如 `https://api.deepseek.com/anthropic`）按 URL
  路径识别为 Anthropic provider，并使用 `/v1/messages` 与 Anthropic SSE 事件合同。
- `messages` 最多 20 条且只允许 `user`/`assistant`；后端会在历史未包含本轮问题时
  自动追加一次 `message`，同时拒绝客户端注入 `system` 历史。
- 停用智能体在连接 Provider 前直接拒绝；熔断状态按智能体隔离，Dify 与其他 Provider
  都会记录成功和失败，不会因一个端点故障阻断全部同类智能体。
- 前端会合并高频分片后再更新界面，避免长回答造成过多 React 更新；用户主动停止、
  空闲超时和网络错误均会区分提示。切换智能体、会话或卸载页面会静默取消旧请求，
  截断的终止事件不会被误判为成功。
- 错误场景的部分回答保留在当前界面，但在引入正式的完成状态与幂等键之前，不作为
  完整回答自动写入会话记录。
- 本地专项回归覆盖持续输出、空闲超时、半截流、HTTP 错误、OpenAI 结束原因、Dify
  部分输出不重试和高频分片。真实外部 AI 端点不作为本地测试依赖。

---

## 小组讨论功能

### 功能特性

- **实时消息**：SSE 推送新消息
- **成员管理**：添加、移除成员
- **禁言功能**：管理员可禁言/取消禁言成员
- **权限控制**：学生只能访问自己所在的讨论组
- **AI 分析**：管理员可对讨论内容进行 AI 分析

### 权限策略

**学生端**：
- 只能加入自己班级的讨论组
- 只能读取自己所在讨论组的消息
- 班级以登录态 `class_name` 为准

**管理员端**：
- 可读取任意会话（用于巡检与管理；`ensure_session_view_access` 对 `admin`/`super_admin` 直接放行，`teacher` 不在此例外中）
- 可创建讨论组，班级必填
- 可禁言/取消禁言成员
- 批量删除会话返回实际删除数量，响应结构为
  `{"success": true, "deleted": number}`，空结果返回 `0` 而不是 `null`

### 并发控制

**组号锁机制**：
- Redis 按用户记录加入锁（`znt:group_discussion:join_lock:{user_id}`），学生加入后在本锁窗口内不能切换到其他组；教师/管理员和 `GROUP_DISCUSSION_REDIS_ENABLED=false` 时不启用（`backend/app/services/agents/group_discussion/join_lock_service.py`）
- 锁在加入成功后才会生效
- 失败请求不会写入锁，避免"失败后被锁组号"
- 并发建组去重依赖数据库唯一约束：`(session_date, class_name, group_no)` 冲突后回查已有会话（`backend/app/services/agents/group_discussion/session_creation.py`），不是 Redis 分布式锁

**跨系统分析参数校验**：
- 当传入 `date`/`class_name` 时，校验所选 `session_ids` 与参数一致
- 当所选会话没有成员时直接返回 `422`，避免误扫全量 AI 对话数据

---

## 对话管理

### 会话生命周期

1. **会话与用量记录**：对话走 `POST /ai-agents/stream`（SSE）写入消息；用量由前端另行调用 `POST /ai-agents/usage` 上报，服务端按 `session_id` 归并（没有独立会话表）
2. **消息记录**：每条消息都记录到数据库
3. **会话列表**：用户可查看历史会话
4. **导出功能**：管理员可导出对话记录

### 消息结构

```json
{
  "id": 123,
  "session_id": "会话ID",
  "user_id": 23,
  "agent_id": 7,
  "message_type": "question|answer",
  "content": "消息内容",
  "response_time_ms": 125,
  "created_at": "2026-03-26T00:00:00Z"
}
```

### 会话响应合同

- 会话列表以 `session_id` 聚合，返回智能体、用户显示名、最后消息时间、问答轮数和预览。
- 会话详情保留 `session_id`、用户/智能体 ID 与显示名、消息类型、响应时间和创建时间。
- `backend/app/schemas/agents/conversation.py` 是会话列表、会话详情和使用记录筛选选项的
  单一权威 schema；`ai_agent.py` 只保留旧导入路径兼容别名，不再维护重复类定义。
- 响应模型必须使用真实有数据的会话回归验证；空列表会绕过逐项序列化，不能证明字段
  合同正确。

### 2026-07-23 续验记录

- Docker 开发栈中的非空会话已完成列表、详情和 usage 分页复验；列表与详情均按
  `schemas/agents/conversation.py` 的统一合同返回，旧 `ai_agent.py` 导入别名未重新
  引入重复 schema。
- 本轮没有调用真实外部 AI 端点；连接失败场景继续使用本机不可达地址验证降级路径。

---

## 使用统计

### 记录内容

- 用户 ID
- 智能体 ID
- 模型名称（由智能体配置回填）
- 响应时间
- 时间戳

> Token 使用量没有独立持久化字段或响应字段：`znt_conversations` 与
> `AgentUsageResponse` 均不记录 token 计数，使用统计只包含问答次数、响应时间与模型名。

### 统计分析

- **热门问题分析**：识别高频问题
- **学生问题链分析**：追踪学生提问路径
- **使用趋势**：按时间统计使用量

### AgentData 深度分析

热点问题与学生问题链不再共用一套任务单分析逻辑：

- 热点问题分析生成 `hot_v2` 结果，先从 `znt_conversations` 联表 `sys_users` 构建事件，再区分教师/admin/super_admin 提问和学生问题，输出词云、热点主题、时序桶、教师锚点、爆发点、完整课程热点序列和证据索引。
- `hot_v2` 的热点主统计使用质量筛选后的学生问题：原始问题保留在 `student_question_events` 和 `evidence_index` 中，并通过 `quality_label` / `quality_reason` 标记 `valid_question`、`prompt_echo`、`duplicate`、`off_track`、`too_short` 等状态；任务单回声、短时间重复、明显闲聊不会进入主题、词云和时间线。
- 有效问题同时生成可解释的 `intent_code` / `intent_label`（如概念定义、原理原因、边界条件、运行调试、对比选择、迁移应用）和 `semantic_terms`；主题聚类、时间桶和深度分析优先使用语义词，原始 `terms` 与原文仍保留用于证据追溯，避免把同一知识点的换说法拆成多个热点。
- 热点结果的 `summary` / `data_quality` 同时记录 `raw_count`、`valid_question_count`、`prompt_echo_count`、`noise_count`、`duplicate_count` 和 `active_interval_count`。这些字段用于区分“原始消息很多”和“多个学生共同提出有效问题”，不能把回声数量直接解释成学习困难。
- `hot_v2` 的主题增加确定性评分：`commonness_score`（有效学生覆盖率）、`difficulty_signal_score`（调试/澄清/质疑等可观察卡点信号）、`persistence_score`（跨非空时间桶持续度）和 0–100 的 `hotness_score`。综合分固定为 `0.45 × 共性 + 0.30 × 困难信号 + 0.25 × 持续度`，并输出 `heat_profile`；这些是排序和人工复核信号，不等同于真实学习困难。
- 时间桶保留原有 180 秒分桶、1.8 倍增长和 `is_burst` 语义，同时补充 `volume_signal`、`growth_signal`、`student_diversity_signal`、`burst_score` 和 `burst_reasons`。课程热点阶段不会跨越空档时间桶合并，避免把间断提问误读为连续课堂热点。
- 学生问题的教师锚点不再只按最近时间匹配：关联分数由时间接近 `0.55`、语义词重合 `0.30`、同一会话 `0.15` 组成；允许学生问题早于教师问题最多 120 秒作为时钟误差容错，但会降低时间分。结果附带 `teacher_anchor_score`、`teacher_anchor_confidence`、`teacher_anchor_match_type` 和 `teacher_anchor_reason`。置信度阈值为 `high >= 0.70`、`medium >= 0.45`，低置信度只能作为待复核线索。
- 主题附带 `hotness_components`、`hotness_explanation` 和 `score_basis`，时间桶/课程阶段保留教师锚点 ID、分数、置信度和原因。`teacher_anchor_match_count`、`teacher_anchor_coverage` 和 `teacher_anchor_confidence_distribution` 统一只基于 `included_in_analysis=true` 的有效学生事件计算；被质量筛选排除的事件仍保留在证据中，但不进入热点锚点统计。`teacher_anchor_coverage` 只表示可解释关联覆盖率，不代表教师教学效果或因果关系；对外保存的 `teacher_questions` / `teacher_mainline` 不包含用于匹配的内部词项。
- 新生成的 `hot_v2` 结果额外保存 `analysis_audit`：明确记录分析原始事件数、原始学生事件数、有效问题数、排除事件数、教师锚点统计分母、匹配数、置信度统计总数和 `warnings`。`teacher_anchor_statistics_consistent=false` 或存在 warning 时，前端只提示复核，不自行修正后端口径；旧记录没有该字段时标记为“未记录”，不伪造审计结论。
- 学生问题链分析生成 `chain_v2` 结果，以教师提问为主线锚点，按时间邻近、同会话顺序和术语相似度把学生问题归属到澄清、跟进、应用、调试、质疑、迁移、延伸、偏离等关系，输出 AI 主问题链、逐学生链路摘要、语义光束图节点/边/泳道和证据索引。
- 分析提示词模板存放在 `agent_analysis_prompt_templates`，按 `hot_questions` / `student_chains` 分类管理，管理员可以新增、编辑、删除模板。
- v1 不引入向量数据库；当前以 SQL 结构化提取、规则聚类、时间关系和可追溯 evidence 为主，后续可在不改变结果契约的前提下增加 embedding 缓存。
- legacy、热点和学生问题链三张分析表使用独立自增主键，不能用同一个整数 ID 跨表
  猜测记录。legacy 路由只操作 legacy 表；typed 删除仅在业务字段、创建时间、任务单和
  结果快照唯一匹配时清理 legacy 双写副本。

### 热点结果页的时间视图

- 主视图为紧凑基础信息和一张时间图：展示课程/智能体、班级、完整分析时段、参与学生、有效提问和其中生成性问题。有效学生提问用柱形，生成性问题用同轴折线；生成性沿用已保存的 `transfer + extend` 分类，是总提问的子集，不堆叠、不解释为学习效果。
- 横轴使用真实时间和已保存的统计粒度，保留空时段，不提供比原始分桶更细的切换，也不平滑插值。仅在 `hot_v2` 的起止时间、分桶和总数口径完整一致时，将省略的空桶补零；缺失数量、缺失分类或冲突时段明确提示，未知值不按零计。
- 教师提问在独立时间轨道定位，悬停显示原问；与学生提问的先后关系不代表因果关系。点击柱形查看该时段全部有效原问，点击折线仅查看迁移、延伸原问，也可通过时段选择框访问；旧记录只保存典型摘要时明确标注，不能还原全部原问或逐条分类。
- 全程参与人数优先使用保存的去重摘要，必要时仅从完整有效事件按学生身份去重，不累加或取各桶人数最大值。说明、统计审计与任务单默认折叠，词云、评分、排行和长篇诊断退出主视图；底层分析结果保持原合同。
- HTML、Markdown 导出与页面使用同一时间统计模型，保留时段、有效提问、其中生成性、参与人数及缺失数据说明；HTML 对动态文本进行转义。

### 深度分析异步任务

热点问题和学生问题链各有独立 Celery 任务，复用上节的分析管线。以下是默认
`/api/v1` 前缀下的完整路径，全部使用 `require_admin` 校验管理员权限：

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/v1/ai-agents/analyses/hot-questions/async` | 提交热点分析，返回 `task_id` 和 `pending` |
| POST | `/api/v1/ai-agents/analyses/student-chains/async` | 提交学生问题链分析，返回 `task_id` 和 `pending` |
| GET | `/api/v1/ai-agents/analyses/tasks/{task_id}` | 查询排队、进度、完成结果或失败信息 |
| DELETE | `/api/v1/ai-agents/analyses/tasks/{task_id}` | 请求撤销尚未就绪的任务 |
| GET | `/api/v1/ai-agents/analyses/tasks` | 列出已保存的分析记录 |

两个提交接口都要求 `agent_id`、ISO 格式的 `start_at` 和 `end_at`；热点分析另要求
`task_sheet`，并支持 `bucket_seconds`。问题链分析支持可选任务单与 `merge_threshold`。
班级、教师标记、自定义提示词和标题等字段以路由 schema 与 [API 合同](../development/API.md)
为准。提交时会把当前管理员 ID 传入任务的 `created_by`。

查询状态返回 `pending`、`progress`、`completed` 或 `failed`。完成结果包含
`analysis_id`，持久化结果分别进入 `HotQuestionAnalysis` 和 `StudentChainAnalysis`。
仅收到 `task_id` 不代表模型调用或结果落库已经完成。

取消接口在任务已就绪时返回 `success: false`；其他情况调用 Celery
`revoke(terminate=True)`。撤销请求不能作为数据库已回滚、结果未写入或 worker 已停止的证明，
需要结合最终任务状态与分析记录核验。

列表接口读取数据库中的分析记录，不提供运行中队列清单。指定 `analysis_type` 为
`hot_questions` 或 `student_chains` 时应用 `skip`、`limit`；未指定时分别取两类各
`limit // 2` 条并合并，当前不应用 `skip`。响应 `total` 是本次返回条数，不能作为全库总数。
混合列表的统一分页是 [项目整理台账](../docker/plans/project-consolidation.md#未解决与待复核事项)
中的后续事项。

运行依赖 Redis broker/result backend、Celery worker 和数据库；配置、启动、超时与运行检查
统一遵循 [部署指南](../docker/deploy/DEPLOY.md)，不在本文复制启动命令。
实现入口为 `backend/app/api/endpoints/agents/ai_agents/analysis_async.py` 和
`backend/app/tasks/agent_analysis.py`，任务注册由 `backend/app/core/celery_app.py` 维护。
维护用例 `backend/tests/ai_agents/test_async_analysis.py` 检查签名、路由与 schema；
真实模型、队列进度、失败/撤销和落库仍需专项端到端验证，结果只记入
[TEST_STATUS.md](../docker/testing/TEST_STATUS.md)。

数据库索引、归档与输入防护分别由 [数据库性能指南](../DATABASE_PERFORMANCE_GUIDE.md)、
[DATA_ARCHIVING.md](DATA_ARCHIVING.md) 和 [XSS_PROTECTION.md](../security/XSS_PROTECTION.md) 维护。
历史分析报告中的容量、提速倍数和缓存收益是当时的估算或快照，未经当前负载复跑不能作为性能承诺。

### 安全策略

- 使用记录写入端点强制绑定当前登录用户身份
- 忽略请求体中的 `user_id`，防止伪造归属
- 使用记录列表保留 `page`、`page_size` 和 `total_pages`，与前端分页合同一致

---

## 模型发现机制

### 支持的平台

- OpenRouter
- SiliconFlow
- Dify
- Anthropic
- 自定义 OpenAI 兼容端点

> 模型发现端点还列出 OpenAI、DeepSeek、Azure、Volcengine、Aliyun、Ollama、custom
> （`backend/app/api/endpoints/agents/model_discovery.py`）。

### 发现流程

1. 检测 API 提供商类型
2. 调用平台的模型列表接口
3. 解析返回的模型信息
4. 保存到智能体配置

### 模型回退策略（OpenRouter）

当使用 OpenRouter 时，后端会自动做模型名双向回退：
- `xxx:free` 在 `404/429/5xx` 时可回退尝试 `xxx`
- `xxx` 在"模型不存在类 404"或 `429/5xx` 时可回退尝试 `xxx:free`

---

## API 端点

详见 [API.md](../development/API.md) 第七章节：AI 智能体（/ai-agents）

### 核心端点

- `POST /ai-agents/stream` - 流式对话（SSE）
- `GET /ai-agents/conversations` - 获取对话列表
- `POST /ai-agents/group-discussion/join` - 加入小组讨论
- `GET /ai-agents/group-discussion/stream` - SSE 实时消息
- `POST /ai-agents/group-discussion/messages` - 发送消息

---

## 前端实现

### 核心组件

**位置**：`frontend/src/pages/AIAgents/`

**主要文件**：
- `index.tsx` - 主页面
- `ChatArea.tsx` - 对话区域
- `AgentSidebar.tsx` - 智能体侧边栏
- `GroupDiscussionPanel.tsx` - 小组讨论
- `hooks/useStreamEngine.ts` - 流式输出 Hook

### 流式输出实现

使用 `useStreamEngine` Hook：
- XHR `onprogress` 监听数据流
- `eventsource-parser` 解析 SSE 事件
- 正文事件白名单与跨分片推理内容过滤
- 合并高频增量后实时显示 AI 响应

### UI 优化

- 登录弹窗美化
- 三个浮动按钮彩色阴影
- 全 Tailwind CSS 实现
- 响应式布局

### 课堂互动浮动入口角色边界

- 学生登录后显示“课堂互动”浮动按钮，继续使用学生课堂轮询、课堂计划查询、SSE 和答题面板。
- 管理员和超级管理员登录后同样显示“课堂互动”浮动按钮；点击后进入
  `/admin/classroom-interaction` 管理页面，不启动学生课堂接口、学生 SSE 或答题状态。
- 浮动入口可见权限与学生参与权限必须分开维护，不能通过放宽学生 API 权限来实现管理端入口。

---

## 配置示例

### OpenRouter 配置

```json
{
  "name": "OpenRouter GPT-4",
  "agent_type": "general",
  "api_endpoint": "https://openrouter.ai/api/v1",
  "api_key": "sk-or-xxx",
  "model_name": "openai/gpt-4-turbo",
  "is_active": true
}
```

### Dify 配置

```json
{
  "name": "Dify 对话应用",
  "agent_type": "dify",
  "api_endpoint": "http://dify-api:5001/v1",
  "api_key": "app-xxx",
  "model_name": "对话应用ID",
  "is_active": true
}
```

---

## 故障排查

### 流式输出不工作

1. 检查后端响应头是否包含 `Cache-Control: no-cache`
2. 检查 Vite 开发代理或生产 Caddy 是否保持流式转发，且没有聚合完整响应
3. 检查前端是否使用 XHR 而非 Fetch API

### 小组讨论加入失败

1. 检查班级是否匹配
2. 检查组号是否已被占用
3. 检查 Redis 连接是否正常

### 模型调用失败

1. 检查 API Key 是否正确
2. 检查模型名称是否存在
3. 查看后端日志获取详细错误信息

---

## 相关文件

### 后端

- `backend/app/api/endpoints/agents/` - API 路由
- `backend/app/models/agents/` - 数据模型
- `backend/app/services/agents/chat_stream.py` - 流式输出服务
- `backend/app/api/endpoints/agents/ai_agents/stream.py` - SSE 响应封装

### 前端

- `frontend/src/pages/AIAgents/` - 页面组件
- `frontend/src/pages/AIAgents/hooks/useStreamEngine.ts` - 流式输出 Hook
- `frontend/vite.config.ts` - 开发代理与前端构建配置

---

## 最佳实践

1. **API Key 安全**：使用加密存储，不要明文保存
2. **流式输出**：全链路禁用缓冲，确保实时性
3. **权限控制**：严格校验用户身份和班级归属
4. **并发控制**：使用 Redis 锁防止冲突
5. **错误处理**：透传上游错误信息，便于排查
