# API 接口清单

> 基础路径：`/api/v1`（认证接口需携带 `Authorization: Bearer <token>` 头）
> 最后更新：2026-04-11

## 一、健康检查

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/health` | 健康检查（含 DB/Redis 状态） | 否 |
| GET | `/ping` | 简单 ping | 否 |
| GET | `/version` | 服务版本信息 | 否 |
| GET | `/config` | 配置检查（仅 DEBUG 模式） | 否 |

## 二、认证（/auth）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/login` | 用户登录（Form: username, password） | 否 |
| POST | `/auth/register` | 用户注册 | 否 |
| GET | `/auth/me` | 获取当前用户信息 | 是 |
| POST | `/auth/logout` | 用户登出 | 是 |
| POST | `/auth/refresh` | 刷新访问令牌 | 是 |
| GET | `/auth/verify` | 验证令牌有效性 | 是 |
| GET | `/auth/health` | 认证服务健康检查 | 否 |

补充说明（2026-03-24）：
- `/auth/refresh` 采用 refresh token 轮换策略：同一个 refresh token 成功换发一次后会被撤销，再次使用应返回 `401`。
- 前端 API 客户端在出现 `401 -> refresh 失败` 时，会触发 `ws:auth-expired` 全局事件，统一将页面登录态回收，避免“前端仍显示已登录但接口持续 401”。
- SSE 鉴权支持 query token 与 Cookie 双通道；当 query token 无效但 Cookie 中会话有效时，可继续完成握手（例如 `/classroom/stream`）。

## 三、系统管理（/system）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/system/feature-flags` | 列出所有功能开关 | 管理员 |
| GET | `/system/feature-flags/{key}` | 获取指定功能开关 | 管理员 |
| POST | `/system/feature-flags` | 创建/更新功能开关 | 管理员 |
| GET | `/system/public/feature-flags/{key}` | 公开获取功能开关 | 否 |
| GET | `/system/overview` | 系统概览 | 管理员 |
| GET | `/system/settings` | 获取系统设置 | 管理员 |
| GET | `/system/typst-metrics` | Typst 编译指标 | 管理员 |
| POST | `/system/typst-pdf-cleanup` | 清理 Typst PDF | 管理员 |
| GET | `/system/metrics` | 系统指标 | 管理员 |

<!-- APPEND_MARKER_1 -->

## 四、用户管理（/users）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/users/` | 获取用户列表 | 管理员 |
| GET | `/users/{user_id}` | 获取用户详情 | 管理员 |
| POST | `/users/` | 创建用户 | 管理员 |
| PUT | `/users/{user_id}` | 更新用户 | 管理员 |
| DELETE | `/users/{user_id}` | 删除用户 | 管理员 |
| POST | `/users/batch-delete` | 批量删除用户 | 管理员 |
| GET | `/users/import/template` | 获取导入模板（Excel） | 管理员 |
| POST | `/users/import` | 导入用户（Excel） | 管理员 |

## 五、文章系统（/articles）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/articles` | 获取文章列表 | 是 |
| POST | `/articles` | 创建文章 | 管理员 |
| GET | `/articles/{article_id}` | 获取文章详情 | 是 |
| GET | `/articles/slug/{slug}` | 按 slug 获取文章 | 是 |
| PUT | `/articles/{article_id}` | 更新文章 | 管理员 |
| DELETE | `/articles/{article_id}` | 删除文章 | 管理员 |
| POST | `/articles/{article_id}/publish` | 发布/取消发布 | 管理员 |
| GET | `/articles/{article_id}/tags` | 获取文章标签 | 是 |
| GET | `/articles/public/list` | 公开文章列表 | 否 |
| GET | `/articles/public/{slug}` | 公开文章详情 | 否 |

### 文章样式（/articles/markdown-styles）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/articles/markdown-styles` | 获取样式列表 | 管理员 |
| GET | `/articles/markdown-styles/{key}` | 获取指定样式 | 管理员 |
| POST | `/articles/markdown-styles` | 创建样式 | 管理员 |
| PATCH | `/articles/markdown-styles/{key}` | 更新样式 | 管理员 |
| DELETE | `/articles/markdown-styles/{key}` | 删除样式 | 管理员 |

## 六、分类管理（/categories）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/categories` | 获取分类列表 | 是 |
| POST | `/categories` | 创建分类 | 管理员 |
| GET | `/categories/{category_id}` | 获取分类详情 | 是 |
| GET | `/categories/slug/{slug}` | 按 slug 获取分类 | 是 |
| PUT | `/categories/{category_id}` | 更新分类 | 管理员 |
| DELETE | `/categories/{category_id}` | 删除分类 | 管理员 |
| GET | `/categories/search` | 搜索分类 | 是 |
| GET | `/categories/popular` | 热门分类 | 是 |
| POST | `/categories/get-or-create` | 获取或创建分类 | 管理员 |
| GET | `/categories/{category_id}/stats` | 分类统计 | 是 |
| GET | `/categories/{category_id}/articles` | 分类下的文章 | 是 |
| GET | `/categories/public/list` | 公开分类列表 | 否 |

<!-- APPEND_MARKER_2 -->

## 七、AI 智能体（/ai-agents）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/ai-agents/` | 获取智能体列表 | 管理员 |
| GET | `/ai-agents/active` | 获取活跃智能体 | 否 |
| GET | `/ai-agents/statistics` | 智能体统计 | 管理员 |
| GET | `/ai-agents/{agent_id}` | 获取智能体详情 | 管理员 |
| POST | `/ai-agents/` | 创建智能体 | 管理员 |
| PUT | `/ai-agents/{agent_id}` | 更新智能体 | 管理员 |
| DELETE | `/ai-agents/{agent_id}` | 删除智能体 | 管理员 |
| POST | `/ai-agents/test` | 测试智能体连接 | 管理员 |
| POST | `/ai-agents/{agent_id}/discover-models` | 发现可用模型 | 管理员 |
| POST | `/ai-agents/stream` | 流式对话（SSE） | 是 |
| GET | `/ai-agents/conversations` | 获取对话列表 | 是 |
| GET | `/ai-agents/conversations/{session_id}` | 获取对话消息 | 是 |
| GET | `/ai-agents/admin/conversations/{session_id}` | 管理员查看对话 | 管理员 |
| GET | `/ai-agents/usage` | 使用记录列表 | 管理员 |
| GET | `/ai-agents/usage/statistics` | 使用统计 | 管理员 |
| POST | `/ai-agents/usage` | 创建使用记录 | 是 |
| GET | `/ai-agents/analysis/hot-questions` | 热门问题分析 | 管理员 |
| GET | `/ai-agents/analysis/student-chains` | 学生问题链分析 | 管理员 |
| POST | `/ai-agents/admin/export/conversations` | 导出对话 | 管理员 |
| GET | `/ai-agents/admin/export/hot-questions` | 导出热门问题 | 管理员 |
| GET | `/ai-agents/admin/export/student-chains` | 导出学生链 | 管理员 |

补充说明（2026-03-24）：
- 当使用 OpenRouter 时，后端会自动做模型名双向回退以降低配置误差：
  - `xxx:free` 在 `404/429/5xx` 时可回退尝试 `xxx`
  - `xxx` 在“模型不存在类 404”或 `429/5xx` 时可回退尝试 `xxx:free`
- `/ai-agents/stream` 的 SSE `error` 事件会透传上游 `detail` 字段，前端会显示更具体的失败原因（如 guardrail/data policy 限制）。
- OpenRouter 运行时流式调用与“连接测试”统一请求头：`HTTP-Referer`、`X-Title`，减少“测试可用但对话报模型不存在”的配置偏差。
- `/ai-agents/stream` 在上游 `HTTP 200` 且无文本产出时仍会发送 `message_end`；前端若检测到空结果会明确提示“模型未返回内容”，避免界面长时间转圈。
- 多平台并用时（如 OpenRouter + SiliconFlow），OpenRouter 全局 Key 仅用于 OpenRouter Endpoint，不再兜底到其他平台；其他平台请在智能体配置中填写对应 API Key。
- 使用记录写入端点 `/ai-agents/usage` 会强制绑定当前登录用户身份（忽略请求体中的 `user_id`），用于防止伪造归属。
- 小组讨论组号锁在加入成功后才会生效；失败请求（如组号格式错误）不会写入锁，避免“失败后被锁组号”。
- 小组讨论班级归属策略：
  - 学生调用 `/ai-agents/group-discussion/join` 时，班级以登录态 `class_name` 为准；跨班级请求会被拒绝（`403`）。
  - 管理员新建/加入未显式传 `class_name` 时，后端优先使用管理员账号自身 `class_name`；若两者都为空则返回 `422`。前端创建表单已改为班级必填。
- 小组讨论会话读取权限：
  - 学生调用 `/ai-agents/group-discussion/messages` 与 `/ai-agents/group-discussion/stream` 时，必须是该会话成员，否则返回 `403`。
  - 管理员/超级管理员可读取任意会话（用于巡检与管理）。
- 跨系统分析 `/ai-agents/group-discussion/admin/cross-system-analyze`：
  - 当传入 `date`/`class_name` 时，会校验所选 `session_ids` 与参数一致；不一致返回 `422`。
  - 当所选会话没有成员时直接返回 `422`，避免误扫全量 AI 对话数据。

### 小组讨论（/ai-agents/group-discussion）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `.../public-config` | 获取公开配置 | 否 |
| GET | `.../public-config/stream` | SSE 监听配置变更 | 否 |
| PUT | `.../public-config` | 更新公开配置 | 管理员 |
| POST | `.../join` | 加入小组 | 是 |
| GET | `.../groups` | 获取小组列表 | 是 |
| PUT | `.../session/{session_id}/name` | 修改组名 | 是 |
| GET | `.../messages` | 获取消息列表 | 是 |
| GET | `.../stream` | SSE 实时消息 | 是 |
| POST | `.../messages` | 发送消息 | 是 |
| POST | `.../mute` | 禁言成员 | 管理员 |
| POST | `.../unmute` | 取消禁言 | 管理员 |
| POST | `.../add-member` | 添加成员 | 管理员 |
| POST | `.../remove-member` | 移除成员 | 管理员 |
| GET | `.../admin/sessions` | 管理员会话列表 | 管理员 |
| DELETE | `.../admin/sessions/{id}` | 删除会话 | 管理员 |
| POST | `.../admin/sessions/batch-delete` | 批量删除会话 | 管理员 |
| GET | `.../admin/messages` | 管理员消息列表 | 管理员 |
| GET | `.../admin/members` | 管理员成员列表 | 管理员 |
| GET | `.../admin/classes` | 获取班级列表 | 管理员 |
| POST | `.../admin/analyze` | AI 分析讨论 | 管理员 |
| POST | `.../admin/compare-analyze` | 横向对比分析 | 管理员 |
| GET | `.../admin/analyses` | 获取分析结果列表 | 管理员 |

<!-- APPEND_MARKER_3 -->

## 八、模型发现（/model-discovery）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/model-discovery/discover` | 发现可用模型 | 管理员 |
| POST | `/model-discovery/discover/{agent_id}` | 为指定智能体发现模型 | 管理员 |
| GET | `/model-discovery/preset-models` | 获取预设模型列表 | 否 |
| GET | `/model-discovery/detect-provider` | 检测 API 提供商 | 否 |
| GET | `/model-discovery/supported-providers` | 获取支持的提供商 | 否 |

## 九、信息学笔记

### Typst 笔记（/informatics/typst-notes）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/informatics/typst-notes` | 获取笔记列表 | 管理员 |
| POST | `/informatics/typst-notes` | 创建笔记 | 管理员 |
| GET | `/informatics/typst-notes/{note_id}` | 获取笔记详情 | 管理员 |
| PUT | `/informatics/typst-notes/{note_id}` | 更新笔记 | 管理员 |
| DELETE | `/informatics/typst-notes/{note_id}` | 删除笔记 | 管理员 |
| GET | `/informatics/typst-notes/{note_id}/assets` | 获取资源列表 | 管理员 |
| POST | `/informatics/typst-notes/{note_id}/assets` | 上传资源 | 管理员 |
| DELETE | `/informatics/typst-notes/{note_id}/assets/{asset_id}` | 删除资源 | 管理员 |
| GET | `/informatics/typst-notes/{note_id}/assets/{asset_id}` | 获取资源 | 管理员 |
| GET | `/informatics/typst-notes/{note_id}/export.typ` | 导出 Typst 源码 | 管理员 |
| POST | `/informatics/typst-notes/{note_id}/compile` | 编译为 PDF | 管理员 |
| POST | `/informatics/typst-notes/{note_id}/compile-async` | 异步编译 | 管理员 |
| GET | `/informatics/typst-notes/compile-jobs/{job_id}` | 查询编译任务状态 | 管理员 |
| POST | `/informatics/typst-notes/compile-jobs/{job_id}/cancel` | 取消编译任务 | 管理员 |
| GET | `/informatics/typst-notes/{note_id}/export.pdf` | 导出 PDF | 管理员 |

### Typst 样式（/informatics/typst-styles）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/informatics/typst-styles` | 获取样式列表 | 管理员 |
| GET | `/informatics/typst-styles/{key}` | 获取样式详情 | 管理员 |
| POST | `/informatics/typst-styles` | 创建样式 | 管理员 |
| PATCH | `/informatics/typst-styles/{key}` | 更新样式 | 管理员 |
| DELETE | `/informatics/typst-styles/{key}` | 删除样式 | 管理员 |
| POST | `/informatics/typst-styles/seed/{key}` | 从资源种子样式 | 管理员 |

### Typst 分类（/informatics/typst-categories）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/informatics/typst-categories` | 获取分类列表 | 管理员 |
| POST | `/informatics/typst-categories` | 创建分类 | 管理员 |
| PATCH | `/informatics/typst-categories/{category_id}` | 更新分类 | 管理员 |
| DELETE | `/informatics/typst-categories/{category_id}` | 删除分类 | 管理员 |

### 公开笔记（/public/informatics/typst-notes）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/public/informatics/typst-notes` | 公开笔记列表 | 否 |
| GET | `/public/informatics/typst-notes/{note_id}` | 公开笔记详情 | 否 |
| GET | `/public/informatics/typst-notes/{note_id}/export.pdf` | 公开笔记 PDF | 否 |
| GET | `/public/informatics/typst-notes/{note_id}/export.typ` | 公开笔记源码 | 否 |

### 公开样式（/public/informatics/typst-style）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/public/informatics/typst-style` | 公开样式列表 | 否 |
| GET | `/public/informatics/typst-style/{style_key}.typ` | 获取样式文件 | 否 |
| GET | `/public/informatics/typst-style/my_style.typ` | 获取个人样式 | 否 |

### GitHub 同步（/informatics/sync/github）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/informatics/sync/github/settings` | 获取同步设置 | 管理员 |
| PUT | `/informatics/sync/github/settings` | 更新同步设置 | 管理员 |
| POST | `/informatics/sync/github/test-connection` | 测试 GitHub 连接 | 管理员 |
| POST | `/informatics/sync/github/trigger` | 触发同步 | 管理员 |
| GET | `/informatics/sync/github/runs` | 获取同步记录 | 管理员 |
| GET | `/informatics/sync/github/task-status` | 获取任务状态 | 管理员 |

<!-- APPEND_MARKER_4 -->

## 十、选课系统（/xbk）

### 数据管理（/xbk）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xbk/students` | 获取学生列表 | 管理员 |
| POST | `/xbk/students` | 创建学生 | 管理员 |
| PUT | `/xbk/students/{student_id}` | 更新学生 | 管理员 |
| DELETE | `/xbk/students/{student_id}` | 删除学生 | 管理员 |
| GET | `/xbk/courses` | 获取课程列表 | 管理员 |
| POST | `/xbk/courses` | 创建课程 | 管理员 |
| PUT | `/xbk/courses/{course_id}` | 更新课程 | 管理员 |
| DELETE | `/xbk/courses/{course_id}` | 删除课程 | 管理员 |
| GET | `/xbk/selections` | 获取选课列表 | 管理员 |
| POST | `/xbk/selections` | 创建选课 | 管理员 |
| PUT | `/xbk/selections/{selection_id}` | 更新选课 | 管理员 |
| DELETE | `/xbk/selections/{selection_id}` | 删除选课 | 管理员 |
| GET | `/xbk/course-results` | 获取课程成绩 | 管理员 |
| GET | `/xbk/meta` | 获取元数据（年级/班级） | 管理员 |
| DELETE | `/xbk` | 清空所有数据 | 管理员 |

补充说明（2026-03-24）：
- `GET /xbk/data/selections` 可能包含 `id=0` 的虚拟行（用于展示未选课/休学等状态），该类虚拟行不对应真实选课主键。
- `PUT/DELETE /xbk/data/selections/{selection_id}` 仅适用于真实记录（`selection_id > 0`）。

### 统计分析（/xbk）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xbk/summary` | 总体摘要 | 管理员 |
| GET | `/xbk/course-stats` | 课程统计 | 管理员 |
| GET | `/xbk/class-stats` | 班级统计 | 管理员 |
| GET | `/xbk/students-with-empty-selection` | 空选课学生 | 管理员 |
| GET | `/xbk/students-without-selection` | 未选课学生 | 管理员 |

### 导入导出（/xbk）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xbk/import/template` | 获取导入模板 | 管理员 |
| POST | `/xbk/import/preview` | 预览导入数据 | 管理员 |
| POST | `/xbk/import` | 执行导入 | 管理员 |
| GET | `/xbk/export` | 导出数据 | 管理员 |
| GET | `/xbk/export/{export_type}` | 按类型导出 | 管理员 |

### 公开配置（/xbk）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xbk/public-config` | 获取公开配置 | 否 |
| PUT | `/xbk/public-config` | 更新公开配置 | 管理员 |

## 十一、点名系统（/xxjs）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xxjs/dianming/classes` | 获取班级列表 | 是 |
| GET | `/xxjs/dianming/students` | 获取学生列表 | 是 |
| POST | `/xxjs/dianming/import` | 导入班级数据 | 管理员 |
| DELETE | `/xxjs/dianming/class` | 删除班级 | 管理员 |
| PUT | `/xxjs/dianming/class/students` | 更新班级学生 | 管理员 |

## 十二、调试工具 / PythonLab（主入口：/api/v2/pythonlab）

说明：
- 当前主入口应视为 `/api/v2/pythonlab/*`
- 历史 `/api/v1/debug/*` 兼容入口已下线，所有调用方都应使用 `/api/v2/pythonlab/*`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/v2/pythonlab/syntax/check` | 语法检查 | 是 |
| POST | `/api/v2/pythonlab/cfg/parse` | CFG 解析 | 是 |
| POST | `/api/v2/pythonlab/sessions` | 创建调试会话 | 是 |
| GET | `/api/v2/pythonlab/sessions/{session_id}` | 获取会话详情 | 是 |
| POST | `/api/v2/pythonlab/sessions/{session_id}/stop` | 停止会话 | 是 |
| GET | `/api/v2/pythonlab/sessions` | 获取会话列表 | 是 |
| POST | `/api/v2/pythonlab/sessions/cleanup` | 清理过期会话 | 管理员 |
| WS | `/api/v2/pythonlab/sessions/{session_id}/terminal` | 终端 WebSocket | 是 |
| WS | `/api/v2/pythonlab/sessions/{session_id}/ws` | 调试 WebSocket（DAP） | 是 |
| POST | `/api/v2/pythonlab/optimize/code` | AI 代码优化 | 是 |
| POST | `/api/v2/pythonlab/optimize/apply/{log_id}` | 应用优化结果 | 是 |
| GET | `/api/v2/pythonlab/optimize/rollback/{log_id}` | 回滚优化 | 是 |
| GET | `/api/v2/pythonlab/flow/prompt_template` | 获取提示模板 | 是 |
| POST | `/api/v2/pythonlab/flow/prompt_template` | 创建提示模板 | 是 |
| POST | `/api/v2/pythonlab/ai/chat` | AI 聊天 | 是 |
| POST | `/api/v2/pythonlab/flow/generate_code` | 生成代码 | 是 |
| POST | `/api/v2/pythonlab/flow/test_agent_connection` | 测试智能体连接 | 是 |
| POST | `/api/v2/pythonlab/flow/parse` | 解析流程图 | 是 |

## 十三、自适应测评（/assessment）

### 管理端（/assessment/admin）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/assessment/admin/configs` | 创建测评配置 | 超级管理员 |
| GET | `/assessment/admin/configs` | 测评配置列表 | 超级管理员 |
| GET | `/assessment/admin/configs/{config_id}` | 测评配置详情 | 超级管理员 |
| PUT | `/assessment/admin/configs/{config_id}` | 更新测评配置 | 超级管理员 |
| DELETE | `/assessment/admin/configs/{config_id}` | 删除测评配置 | 超级管理员 |
| PUT | `/assessment/admin/configs/{config_id}/toggle` | 开关测评 | 超级管理员 |
| POST | `/assessment/admin/configs/{config_id}/generate-questions` | AI 生成题目 | 超级管理员 |
| GET | `/assessment/admin/configs/{config_id}/questions` | 题库列表 | 超级管理员 |
| POST | `/assessment/admin/questions` | 新增题目 | 超级管理员 |
| PUT | `/assessment/admin/questions/{question_id}` | 更新题目 | 超级管理员 |
| DELETE | `/assessment/admin/questions/{question_id}` | 删除题目 | 超级管理员 |
| GET | `/assessment/admin/configs/{config_id}/class-names` | 已参与班级列表 | 超级管理员 |
| GET | `/assessment/admin/configs/{config_id}/sessions` | 会话列表 | 超级管理员 |
| GET | `/assessment/admin/sessions/{session_id}` | 会话详情 | 超级管理员 |
| GET | `/assessment/admin/sessions/{session_id}/basic-profile` | 学生初级画像 | 超级管理员 |
| GET | `/assessment/admin/configs/{config_id}/statistics` | 统计数据 | 超级管理员 |
| POST | `/assessment/admin/sessions/{session_id}/allow-retest` | 单人重测 | 超级管理员 |
| POST | `/assessment/admin/configs/{config_id}/batch-retest` | 批量重测 | 超级管理员 |
| GET | `/assessment/admin/configs/{config_id}/export` | 导出 xlsx | 超级管理员 |
| POST | `/assessment/admin/profiles/generate` | 生成三维画像 | 超级管理员 |
| POST | `/assessment/admin/profiles/batch-generate` | 批量生成三维画像 | 超级管理员 |
| GET | `/assessment/admin/profiles` | 画像列表 | 超级管理员 |
| GET | `/assessment/admin/profiles/{profile_id}` | 画像详情 | 超级管理员 |
| DELETE | `/assessment/admin/profiles/{profile_id}` | 删除画像 | 超级管理员 |

### 学生端（/assessment）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/assessment/available` | 可参与测评列表 | 是 |
| POST | `/assessment/sessions/start` | 开始测评 | 是 |
| GET | `/assessment/sessions/{session_id}/questions` | 当前测评题目 | 是 |
| POST | `/assessment/sessions/{session_id}/answer` | 提交单题答案 | 是 |
| POST | `/assessment/sessions/{session_id}/submit` | 提交整卷 | 是 |
| GET | `/assessment/sessions/{session_id}/result` | 测评结果 | 是 |
| GET | `/assessment/sessions/{session_id}/basic-profile` | 初级画像 | 是 |
| GET | `/assessment/sessions/{session_id}/profile-status` | 三维画像状态 | 是 |
| GET | `/assessment/my-profiles` | 我的三维画像列表 | 是 |
| GET | `/assessment/my-profiles/{profile_id}` | 我的三维画像详情 | 是 |

说明：统计接口 `pass_rate` 字段返回 `0~1` 比例值，前端再格式化为百分比。

## 十四、课堂互动（/classroom）

### 管理端（/classroom/admin）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/classroom/admin/` | 创建活动 | 管理员 |
| PUT | `/classroom/admin/{activity_id}` | 更新活动 | 管理员 |
| DELETE | `/classroom/admin/{activity_id}` | 删除活动 | 管理员 |
| POST | `/classroom/admin/{activity_id}/duplicate` | 复制活动 | 管理员 |
| POST | `/classroom/admin/{activity_id}/restart` | 重启活动 | 管理员 |
| POST | `/classroom/admin/bulk-delete` | 批量删除 | 管理员 |
| GET | `/classroom/admin/` | 活动列表 | 管理员 |
| GET | `/classroom/admin/{activity_id}` | 活动详情 | 管理员 |
| POST | `/classroom/admin/{activity_id}/start` | 开始活动 | 管理员 |
| POST | `/classroom/admin/{activity_id}/end` | 结束活动 | 管理员 |
| GET | `/classroom/admin/{activity_id}/statistics` | 活动统计 | 管理员 |
| GET | `/classroom/admin/stream` | SSE 活动流 | 管理员 |

### 学生端（/classroom）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/classroom/active` | 当前活动 | 是 |
| GET | `/classroom/stream` | SSE 活动流 | 是 |
| GET | `/classroom/{activity_id}` | 活动详情 | 是 |
| POST | `/classroom/{activity_id}/respond` | 提交响应 | 是 |
| GET | `/classroom/{activity_id}/result` | 查看活动结果 | 是 |

### 课堂计划（/classroom/plans）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/classroom/plans/admin` | 创建计划 | 管理员 |
| PUT | `/classroom/plans/admin/{plan_id}` | 更新计划 | 管理员 |
| DELETE | `/classroom/plans/admin/{plan_id}` | 删除计划 | 管理员 |
| GET | `/classroom/plans/admin` | 计划列表 | 管理员 |
| GET | `/classroom/plans/admin/{plan_id}` | 计划详情 | 管理员 |
| POST | `/classroom/plans/admin/{plan_id}/start` | 启动计划 | 管理员 |
| POST | `/classroom/plans/admin/{plan_id}/reset` | 重置计划 | 管理员 |
| POST | `/classroom/plans/admin/{plan_id}/next` | 下一项 | 管理员 |
| POST | `/classroom/plans/admin/{plan_id}/end` | 结束计划 | 管理员 |
| POST | `/classroom/plans/admin/{plan_id}/items/{item_id}/start` | 启动计划项 | 管理员 |
| POST | `/classroom/plans/admin/{plan_id}/items/{item_id}/end` | 结束计划项 | 管理员 |
| GET | `/classroom/plans/active-plan` | 当前生效计划 | 是 |
