# AI 智能体系统文档

> 最后更新：2026-04-11
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

**根因链**：后端 httpx → FastAPI StreamingResponse → craco proxy → 浏览器，每层都有缓冲

**修复方案（3层）**：

1. **后端 `chat_stream.py`**：
   - 使用 `aiter_bytes()` 透传 Dify 原始 SSE 字节流
   - 避免使用 `aiter_text()` 或 `aiter_lines()`（会缓冲）

2. **后端 `stream.py`**：
   - StreamingResponse 添加响应头：
     - `Cache-Control: no-cache, no-transform`
     - `X-Accel-Buffering: no`

3. **craco proxy**（关键！）：
   - `selfHandleResponse: true`
   - 用 `proxyRes.on('data')` + `res.write(chunk)` + `res.flush()` 逐块转发
   - **不能用 `pipe`**（pipe 有内部缓冲会导致数据堆积）

**前端**：
- 使用 `useStreamEngine` hook
- XHR `onprogress` + `eventsource-parser` 解析 SSE 事件
- 替代 Fetch API（Fetch reader.read() 也会缓冲）

**教训**：SSE 流式输出需要全链路禁用缓冲，任何一层缓冲都会导致前端一次性收到所有数据

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
  "role": "user|assistant",
  "content": "消息内容",
  "timestamp": "2026-03-26T00:00:00Z",
  "session_id": "会话ID"
}
```

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

### 安全策略

- 使用记录写入端点强制绑定当前登录用户身份
- 忽略请求体中的 `user_id`，防止伪造归属

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

**位置**：`/Users/wsh/wangsh/frontend/src/pages/AIAgents/`

**主要文件**：
- `index.tsx` - 主页面
- `ChatArea.tsx` - 对话区域
- `AgentSidebar.tsx` - 智能体侧边栏
- `GroupDiscussion.tsx` - 小组讨论
- `useStreamEngine.ts` - 流式输出 Hook

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
2. 检查 craco proxy 配置是否使用 `selfHandleResponse: true`
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

- `/Users/wsh/wangsh/backend/app/api/endpoints/agents/` - API 路由
- `/Users/wsh/wangsh/backend/app/models/agents/` - 数据模型
- `/Users/wsh/wangsh/backend/app/services/chat_stream.py` - 流式输出服务
- `/Users/wsh/wangsh/backend/app/services/stream.py` - SSE 响应封装

### 前端

- `/Users/wsh/wangsh/frontend/src/pages/AIAgents/` - 页面组件
- `/Users/wsh/wangsh/frontend/src/hooks/useStreamEngine.ts` - 流式输出 Hook
- `/Users/wsh/wangsh/frontend/vite.config.ts` - 开发代理与前端构建配置

---

## 最佳实践

1. **API Key 安全**：使用加密存储，不要明文保存
2. **流式输出**：全链路禁用缓冲，确保实时性
3. **权限控制**：严格校验用户身份和班级归属
4. **并发控制**：使用 Redis 锁防止冲突
5. **错误处理**：透传上游错误信息，便于排查
