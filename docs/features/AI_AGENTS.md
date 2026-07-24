# AI 智能体系统文档

> 最后更新：2026-07-23
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

## 架构设计

### 数据模型

**核心表**：
- `znt_ai_agents` - 智能体配置
- `znt_conversations` - 对话会话
- `znt_conversation_messages` - 对话消息
- `znt_agent_usage` - 使用记录
- `znt_group_discussion_sessions` - 小组讨论会话
- `znt_group_discussion_messages` - 小组讨论消息
- `znt_group_discussion_members` - 小组讨论成员
- `znt_group_discussion_analyses` - 讨论分析结果

**关键字段**：
- `provider_type`：平台类型（openrouter、dify、siliconflow 等）
- `api_endpoint`：API 端点
- `api_key`：加密存储的 API 密钥
- `model_name`：模型名称
- `is_active`：是否启用

---

## Dify 集成

### 配置方式

在智能体配置中设置：
- `provider_type`: `dify`
- `api_endpoint`: Dify API 地址（如 `http://dify-api:5001/v1`）
- `api_key`: Dify API Key
- `model_name`: 对话应用 ID

### 流式输出修复（2026-03-23）

**问题**：Dify 对话响应一次性显示，无流式效果

**根因链**：后端 httpx → FastAPI StreamingResponse → 开发期 Vite 代理或生产
Caddy 网关 → 浏览器，任一层错误缓冲都会破坏流式体验

**修复方案（3层）**：

1. **后端 `backend/app/services/agents/chat_stream.py`**：
   - 使用 `aiter_bytes()` 透传 Dify 原始 SSE 字节流
   - 避免使用 `aiter_text()` 或 `aiter_lines()`（会缓冲）

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
- 可读取任意会话（用于巡检与管理）
- 可创建讨论组，班级必填
- 可禁言/取消禁言成员
- 批量删除会话返回实际删除数量，响应结构为
  `{"success": true, "deleted": number}`，空结果返回 `0` 而不是 `null`

### 并发控制

**组号锁机制**：
- 使用 Redis 分布式锁防止并发建组冲突
- 锁在加入成功后才会生效
- 失败请求不会写入锁，避免"失败后被锁组号"

**跨系统分析参数校验**：
- 当传入 `date`/`class_name` 时，校验所选 `session_ids` 与参数一致
- 当所选会话没有成员时直接返回 `422`，避免误扫全量 AI 对话数据

---

## 对话管理

### 会话生命周期

1. **创建会话**：用户首次发送消息时自动创建
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
- 模型名称
- Token 使用量
- 响应时间
- 时间戳

### 统计分析

- **热门问题分析**：识别高频问题
- **学生问题链分析**：追踪学生提问路径
- **使用趋势**：按时间统计使用量

### AgentData 深度分析

热点问题与学生问题链不再共用一套任务单分析逻辑：

- 热点问题分析生成 `hot_v2` 结果，先从 `znt_conversations` 联表 `sys_users` 构建事件，再区分教师/admin/super_admin 提问和学生问题，输出词云、热点主题、时序桶、教师锚点、爆发点、完整课程热点序列和证据索引。
- 学生问题链分析生成 `chain_v2` 结果，以教师提问为主线锚点，按时间邻近、同会话顺序和术语相似度把学生问题归属到澄清、跟进、应用、调试、质疑、迁移、延伸、偏离等关系，输出 AI 主问题链、逐学生链路摘要、语义光束图节点/边/泳道和证据索引。
- 分析提示词模板存放在 `agent_analysis_prompt_templates`，按 `hot_questions` / `student_chains` 分类管理，管理员可以新增、编辑、删除模板。
- v1 不引入向量数据库；当前以 SQL 结构化提取、规则聚类、时间关系和可追溯 evidence 为主，后续可在不改变结果契约的前提下增加 embedding 缓存。
- legacy、热点和学生问题链三张分析表使用独立自增主键，不能用同一个整数 ID 跨表
  猜测记录。legacy 路由只操作 legacy 表；typed 删除仅在业务字段、创建时间、任务单和
  结果快照唯一匹配时清理 legacy 双写副本。

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
- 自定义 OpenAI 兼容端点

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
- `GroupDiscussion.tsx` - 小组讨论
- `hooks/useStreamEngine.ts` - 流式输出 Hook

### 流式输出实现

使用 `useStreamEngine` Hook：
- XHR `onprogress` 监听数据流
- `eventsource-parser` 解析 SSE 事件
- 逐字显示 AI 响应

### UI 优化

- 登录弹窗美化
- 三个浮动按钮彩色阴影
- 全 Tailwind CSS 实现
- 响应式布局

---

## 配置示例

### OpenRouter 配置

```json
{
  "name": "OpenRouter GPT-4",
  "provider_type": "openrouter",
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
  "provider_type": "dify",
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
