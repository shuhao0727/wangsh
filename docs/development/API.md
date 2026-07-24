# API 接口清单

> 基础路径：`/api/v1`（认证接口需携带 `Authorization: Bearer <token>` 头）
> 最后更新：2026-07-24

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
| GET | `/auth/me` | 获取当前用户信息 | 是 |
| POST | `/auth/logout` | 撤销刷新令牌、轮换会话并清除 Cookie | 登录令牌可选 |
| POST | `/auth/refresh` | 使用 refresh token 原子轮换访问令牌 | Refresh token |
| GET | `/auth/health` | 认证服务健康检查 | 否 |

`/auth/logout` 始终清除当前浏览器的 access/refresh Cookie。若 Redis 会话轮换暂时失败，已持久化的 refresh token 仍会先撤销；若数据库本身不可用，服务端撤销会记录告警并尽力回滚，但客户端登出仍返回成功，不会因基础设施故障保留浏览器 Cookie。

补充说明（2026-07-11）：
- `/auth/refresh` 使用数据库行锁，在单个事务内撤销旧 token 并创建新 token；同一个 refresh token 并发或重复使用时只允许一次成功。
- refresh token 关联用户已停用或软删除时返回 `401`。
- 服务端 session nonce 缺失时，旧 access token 不会根据自身 nonce 重建会话；合法 refresh token 流程可以显式创建新的 session nonce。
- 前端 API 客户端在出现 `401 -> refresh 失败` 时，会触发 `ws:auth-expired` 全局事件，统一将页面登录态回收，避免“前端仍显示已登录但接口持续 401”。
- 若会话因为“同一账号在其他地方重新登录”而失效，后端会返回“账号已在其他地方登录，请重新登录”，前端会强提示当前设备已下线。
- 成功登录同一账号会重新旋转 session nonce，因此旧设备即使仍持有未过期 access token，也会在下一次访问受保护接口（包括 `/auth/me`）时收到 `401`。
- 同账号重新登录时，后端会撤销此前该用户尚未过期的 refresh token，避免旧设备通过 `/auth/refresh` 自动恢复登录态。
- `/auth/me` 与其他受保护接口一样受单会话策略约束；旧设备在同账号其他地方重新登录后再次访问 `/auth/me` 时，也会收到 `401`。
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
| POST | `/users/` | 创建用户；普通 admin 仅可创建 student/teacher | 管理员 |
| PUT | `/users/{user_id}` | 更新用户 | 管理员 |
| DELETE | `/users/{user_id}` | 删除用户；普通 admin 无权删除高权限用户 | 管理员 |
| POST | `/users/batch-delete` | 批量删除，请求体为 `{ "user_ids": [1, 2] }`；目标缺失或普通 admin 遇到高权限账号时整批拒绝 | 管理员 |
| GET | `/users/import/template` | 获取导入模板（Excel） | 管理员 |
| POST | `/users/import` | 导入用户；普通 admin 仅可新增/更新 student、teacher；高权限行在 `UserImportResult.errors` 中逐行失败 | 管理员 |

用户管理权限说明：
- 普通 `admin` 只能管理和导入 `student`、`teacher`，不能创建、修改或删除 `admin`、`super_admin`。
- 导入文件中的高权限角色行不会自动降级；该行单独失败并继续处理后续行，失败明细通过 `UserImportResult.errors` 返回。
- 批量删除在目标缺失或包含普通 `admin` 无权删除的高权限账号时整批拒绝，不执行部分删除。
- 批量删除请求体与前端统一为对象结构 `{ "user_ids": number[] }`，不接受裸数组。
- 导入模板本轮仍为统一模板，暂不按当前角色动态变化。

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
| GET | `/articles/public/list` | 公开文章列表；支持 `page`、`size`、`category_id`、`q`，缓存按搜索词隔离 | 否 |
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
| GET | `/ai-agents/active` | 获取活跃智能体 | 是 |
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
| GET | `/ai-agents/usage/filter-options` | 获取使用记录筛选选项 | 管理员 |
| GET | `/ai-agents/analysis/hot-questions` | 热门问题分析 | 管理员 |
| GET | `/ai-agents/analysis/hot-questions/{analysis_id}` | 热点问题分析详情 | 管理员 |
| POST | `/ai-agents/analysis/hot-questions/stream` | 创建热点问题深度分析（SSE） | 管理员 |
| DELETE | `/ai-agents/analysis/hot-questions/{analysis_id}` | 删除热点问题分析记录 | 管理员 |
| GET | `/ai-agents/analysis/student-chains` | 学生问题链分析 | 管理员 |
| GET | `/ai-agents/analysis/student-chains/{analysis_id}` | 学生问题链分析详情 | 管理员 |
| POST | `/ai-agents/analysis/student-chains/stream` | 创建学生问题链深度分析（SSE） | 管理员 |
| DELETE | `/ai-agents/analysis/student-chains/{analysis_id}` | 删除学生问题链分析记录 | 管理员 |
| GET | `/ai-agents/analysis/trends` | 最近分析趋势汇总 | 管理员 |
| GET | `/ai-agents/analysis/prompt-templates` | 分析提示词模板列表 | 管理员 |
| POST | `/ai-agents/analysis/prompt-templates` | 创建分析提示词模板 | 管理员 |
| PUT | `/ai-agents/analysis/prompt-templates/{template_id}` | 更新分析提示词模板 | 管理员 |
| DELETE | `/ai-agents/analysis/prompt-templates/{template_id}` | 删除分析提示词模板 | 管理员 |
| POST | `/ai-agents/admin/export/conversations` | 导出对话 | 管理员 |
| GET | `/ai-agents/admin/export/hot-questions` | 导出热门问题 | 管理员 |
| GET | `/ai-agents/admin/export/student-chains` | 导出学生链 | 管理员 |

补充说明（2026-03-24）：
- `GET /ai-agents/conversations` 返回按 `session_id` 聚合的会话摘要：
  `session_id`、`agent_id`、`display_agent_name`、`display_user_name`、`last_at`、
  `turns`、`preview`。会话详情与管理员详情返回消息的 `id`、`session_id`、
  `user_id`、`agent_id`、显示名称、`message_type`、`content`、`response_time_ms`
  和 `created_at`。这两类响应共用 `schemas/agents/conversation.py` 的权威模型。
- 当使用 OpenRouter 时，后端会自动做模型名双向回退以降低配置误差：
  - `xxx:free` 在 `404/429/5xx` 时可回退尝试 `xxx`
  - `xxx` 在“模型不存在类 404”或 `429/5xx` 时可回退尝试 `xxx:free`
- `/ai-agents/stream` 的上游 HTTP 错误会保留经过长度限制的 Provider `detail`；内部
  初始化或运行异常只返回稳定错误码和通用提示，不向普通用户暴露内部异常详情。
- OpenRouter 运行时流式调用与“连接测试”统一请求头：`HTTP-Referer`、`X-Title`，减少“测试可用但对话报模型不存在”的配置偏差。
- `/ai-agents/stream` 在上游 `HTTP 200` 且无文本产出时仍会发送 `message_end`；前端若检测到空结果会明确提示“模型未返回内容”，避免界面长时间转圈。
- `/ai-agents/stream` 的 `messages` 最多 20 条，只允许 `user`/`assistant`。`message`
  表示本轮问题；若历史末尾尚未包含该问题，后端会自动追加一次，若已包含则不会重复。
  客户端传入 `system` 历史返回 `422`，系统提示词只来自智能体服务端配置。
- 停用智能体返回 SSE `agent_inactive`，不会连接外部 Provider。正常结束原因以
  `stop`、`end_turn`、`stop_sequence` 或明确终止标记为准；输出长度、上下文窗口、
  内容策略、工具调用和未知结束原因均返回对应 SSE `error`，不伪装成完整成功。
- 多平台并用时（如 OpenRouter + SiliconFlow），OpenRouter 全局 Key 仅用于 OpenRouter Endpoint，不再兜底到其他平台；其他平台请在智能体配置中填写对应 API Key。
- 使用记录列表 `/ai-agents/usage` 返回 `items`、`total`、`page`、`page_size`、
  `total_pages`；写入端点会强制绑定当前登录用户身份（`user_id` 可省略，传入也会被
  忽略），并以服务端接收时间作为记录时间（忽略客户端 `used_at`），用于防止伪造
  归属和客户端时钟错误。
- 小组讨论组号锁在加入成功后才会生效；失败请求（如组号格式错误）不会写入锁，避免“失败后被锁组号”。
- 热点问题与学生问题链已拆分为两个深度分析流。热点结果使用 `analysis_version=hot_v2`，包含 `word_cloud`、`themes`、`timeline_buckets`、`teacher_questions`、`course_hotspot_sequence` 和 `evidence_index`。学生问题链结果使用 `analysis_version=chain_v2`，包含 `teacher_mainline`、`ai_main_question_chain`、`student_question_chains`、`beam_nodes`、`beam_edges`、`lanes` 和 `evidence_index`。
- `POST /ai-agents/analysis/hot-questions/stream` 与 `POST /ai-agents/analysis/student-chains/stream` 支持 `analysis_agent_id` 与 `prompt_template_id`。后端会先生成确定性结构化证据，再调用所选分析诊断智能体生成并保存 `deep_analysis`；同时返回 `analysis_agent` 与 `deep_analysis_status` 标记智能体名称、模型、完成或跳过原因。未配置 API Endpoint/API Key 时不会丢失基础结构化结果。
- legacy `GET/DELETE /ai-agents/task-analysis/{analysis_id}` 只接受
  `task_analyses.id`，不会再用裸整数 ID 跨热点/问题链表猜测记录。热点和学生问题链
  必须使用各自 typed 详情/删除端点；typed 删除只在完整快照唯一匹配时清理 legacy
  双写副本，歧义记录会安全保留。
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
| GET | `.../admin/export-sessions` | 导出筛选后的会话列表（Excel，默认最多 5000 条，上限 10000 条） | 管理员 |
| DELETE | `.../admin/sessions/{id}` | 删除会话 | 管理员 |
| POST | `.../admin/sessions/batch-delete` | 批量删除会话；响应 `deleted` 为实际删除的会话数量 | 管理员 |
| GET | `.../admin/messages` | 管理员消息列表 | 管理员 |
| GET | `.../admin/members` | 管理员成员列表 | 管理员 |
| GET | `.../admin/classes` | 获取班级列表 | 管理员 |
| POST | `.../admin/analyze` | AI 分析讨论 | 管理员 |
| POST | `.../admin/student-profile` | 学生个人画像分析 | 管理员 |
| POST | `.../admin/cross-system-analyze` | 跨系统综合分析 | 管理员 |
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

### 数据管理（/xbk/data）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xbk/data/students` | 获取学生列表 | 管理员 |
| POST | `/xbk/data/students` | 创建学生 | 管理员 |
| PUT | `/xbk/data/students/{student_id}` | 更新学生 | 管理员 |
| DELETE | `/xbk/data/students/{student_id}` | 删除学生 | 管理员 |
| GET | `/xbk/data/courses` | 获取课程列表 | 管理员 |
| POST | `/xbk/data/courses` | 创建课程 | 管理员 |
| PUT | `/xbk/data/courses/{course_id}` | 更新课程 | 管理员 |
| DELETE | `/xbk/data/courses/{course_id}` | 删除课程 | 管理员 |
| GET | `/xbk/data/selections` | 获取选课列表 | 管理员 |
| POST | `/xbk/data/selections` | 创建选课 | 管理员 |
| PUT | `/xbk/data/selections/{selection_id}` | 更新选课 | 管理员 |
| DELETE | `/xbk/data/selections/{selection_id}` | 删除选课 | 管理员 |
| GET | `/xbk/data/course-results` | 获取课程成绩 | 管理员 |
| GET | `/xbk/data/meta` | 获取元数据（年级/班级） | 管理员 |
| DELETE | `/xbk/data` | 清空所有数据 | 管理员 |

补充说明（2026-03-24）：
- `GET /xbk/data/selections` 可能包含 `id=0` 的虚拟行（用于展示未选课/休学等状态），该类虚拟行不对应真实选课主键。
- `PUT/DELETE /xbk/data/selections/{selection_id}` 仅适用于真实记录（`selection_id > 0`）。

### 统计分析（/xbk/analysis）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xbk/analysis/summary` | 总体摘要 | 管理员 |
| GET | `/xbk/analysis/course-stats` | 课程统计 | 管理员 |
| GET | `/xbk/analysis/class-stats` | 班级统计 | 管理员 |
| GET | `/xbk/analysis/students-with-empty-selection` | 空选课学生 | 管理员 |
| GET | `/xbk/analysis/students-without-selection` | 未选课学生 | 管理员 |

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
| POST | `/api/v2/pythonlab/sessions/cleanup` | 清理过期会话 | 是 |
| WS | `/api/v2/pythonlab/sessions/{session_id}/terminal` | 终端 WebSocket | 是 |
| WS | `/api/v2/pythonlab/sessions/{session_id}/ws` | 调试 WebSocket（DAP） | 是 |
| POST | `/api/v2/pythonlab/optimize/code` | AI 代码优化 | 是 |
| POST | `/api/v2/pythonlab/optimize/apply/{log_id}` | 应用优化结果 | 是 |
| GET | `/api/v2/pythonlab/optimize/rollback/{log_id}` | 回滚优化 | 是 |
| GET | `/api/v2/pythonlab/flow/prompt_template` | 获取提示模板 | 管理员 |
| POST | `/api/v2/pythonlab/flow/prompt_template` | 创建提示模板 | 管理员 |
| POST | `/api/v2/pythonlab/ai/chat` | AI 聊天 | 是 |
| POST | `/api/v2/pythonlab/flow/generate_code` | 生成代码 | 是 |
| POST | `/api/v2/pythonlab/flow/test_agent_connection` | 测试智能体连接 | 是 |
| POST | `/api/v2/pythonlab/flow/parse` | 解析流程图 | 是 |

## 十三、自适应测评（/assessment）

### 管理端（/assessment/admin）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/assessment/admin/configs` | 创建测评配置 | 管理员（含超级管理员） |
| GET | `/assessment/admin/configs` | 测评配置列表 | 管理员（含超级管理员） |
| GET | `/assessment/admin/configs/{config_id}` | 测评配置详情 | 管理员（含超级管理员） |
| PUT | `/assessment/admin/configs/{config_id}` | 更新测评配置 | 管理员（含超级管理员） |
| DELETE | `/assessment/admin/configs/{config_id}` | 删除测评配置 | 管理员（含超级管理员） |
| PUT | `/assessment/admin/configs/{config_id}/toggle` | 开关测评 | 管理员（含超级管理员） |
| POST | `/assessment/admin/configs/{config_id}/generate-questions` | AI 生成题目 | 管理员（含超级管理员） |
| GET | `/assessment/admin/configs/{config_id}/questions` | 题库列表 | 管理员（含超级管理员） |
| POST | `/assessment/admin/questions` | 新增题目 | 管理员（含超级管理员） |
| PUT | `/assessment/admin/questions/{question_id}` | 更新题目 | 管理员（含超级管理员） |
| DELETE | `/assessment/admin/questions/{question_id}` | 删除题目 | 管理员（含超级管理员） |
| GET | `/assessment/admin/configs/{config_id}/class-names` | 已参与班级列表 | 管理员（含超级管理员） |
| GET | `/assessment/admin/configs/{config_id}/sessions` | 会话列表 | 管理员（含超级管理员） |
| GET | `/assessment/admin/sessions/{session_id}` | 会话详情 | 管理员（含超级管理员） |
| GET | `/assessment/admin/sessions/{session_id}/basic-profile` | 学生初级画像 | 管理员（含超级管理员） |
| GET | `/assessment/admin/configs/{config_id}/statistics` | 统计数据 | 管理员（含超级管理员） |
| POST | `/assessment/admin/sessions/{session_id}/allow-retest` | 单人重测 | 管理员（含超级管理员） |
| POST | `/assessment/admin/configs/{config_id}/batch-retest` | 批量重测 | 管理员（含超级管理员） |
| GET | `/assessment/admin/configs/{config_id}/export` | 导出 xlsx | 管理员（含超级管理员） |
| POST | `/assessment/admin/profiles/generate` | 生成三维画像 | 管理员（含超级管理员） |
| POST | `/assessment/admin/profiles/batch-generate` | 批量生成三维画像 | 管理员（含超级管理员） |
| GET | `/assessment/admin/profiles` | 画像列表 | 管理员（含超级管理员） |
| GET | `/assessment/admin/profiles/{profile_id}` | 画像详情 | 管理员（含超级管理员） |
| DELETE | `/assessment/admin/profiles/{profile_id}` | 删除画像 | 管理员（含超级管理员） |

关键请求体：

| 接口 | 必填字段 | 主要约束 |
|---|---|---|
| `POST /assessment/admin/configs` | `title` | 可选 `grade`、`teaching_objectives`、`knowledge_points`、`total_score`、`question_config`、`ai_prompt`、`agent_id`、`agent_ids`、`time_limit_minutes`、`available_start/end`；`total_score` 为 1-1000，时限不小于 0 |
| `POST /assessment/admin/configs/{config_id}/generate-questions` | 无 | 可选 `count`、`question_type`、`difficulty`、`knowledge_points`；配置必须绑定出题智能体 |
| `POST /assessment/admin/questions` | `config_id`、`question_type`、`content`、`correct_answer`、`score` | 可选 `options`、`difficulty`、`knowledge_point`、`explanation`、`source`、`mode`、`adaptive_config`；题型仅 `choice/fill/short_answer`，模式仅 `fixed/adaptive` |
| `POST /assessment/admin/configs/{config_id}/batch-retest` | `session_ids` 或 `class_name` | 删除匹配的旧会话及其级联答题/初级画像，并清理对应高级画像 |
| `POST /assessment/admin/profiles/generate` | `profile_type`、`target_id`、`agent_id` | 可选 `config_id`、`discussion_session_id`、`agent_ids`；小组画像必须绑定讨论会话 |
| `POST /assessment/admin/profiles/batch-generate` | `user_ids`、`agent_id` | 可选 `config_id`、`discussion_session_id`、`agent_ids`；`user_ids` 至少 1 项，仅批量生成个人画像 |
| `POST /assessment/sessions/start` | `config_id` | 配置必须启用且题库非空；尽量复用已有 `in_progress` 会话，但数据库没有严格唯一约束 |
| `POST /assessment/sessions/{session_id}/answer` | `answer_id`、`student_answer` | 会话必须属于当前用户且仍在进行；同一答题记录不可重复提交 |

列表与统计查询参数：

| 接口 | 查询参数 |
|---|---|
| `GET /assessment/admin/configs` | `skip>=0`、`1<=limit<=100`，可选 `grade`、`enabled`、`search` |
| `GET /assessment/admin/configs/{config_id}/questions` | `skip>=0`、`1<=limit<=200`，可选 `question_type`、`difficulty` |
| `GET /assessment/admin/configs/{config_id}/sessions` | `skip>=0`、`1<=limit<=100`，可选 `class_name`、`status`、`search`、`time_field=submitted_at|started_at`、`start_date/end_date=YYYY-MM-DD` |
| `GET /assessment/admin/configs/{config_id}/statistics` | 可选 `class_name`、`time_field=submitted_at|started_at`、`start_date/end_date=YYYY-MM-DD` |
| `GET /assessment/admin/profiles` | `skip>=0`、`1<=limit<=100`，可选 `profile_type`、`target_id` |
| `GET /assessment/admin/configs/{config_id}/export` | 可选 `class_name`、`status`、`search`、`time_field=submitted_at|started_at`、`start_date/end_date=YYYY-MM-DD` |
| `GET /assessment/my-profiles` | `skip>=0`、`1<=limit<=100` |

`profile_type` 仅允许 `individual`、`group`、`class`。完整 DB、Prompt 和前端契约见
[`docs/features/ASSESSMENT.md`](../features/ASSESSMENT.md)。

核心响应字段：

| 场景 | 关键字段 |
|---|---|
| 配置详情 | `id`、配置业务字段、`enabled`、`question_count`、`session_count`、`config_agents`、创建者和时间 |
| 题目详情 | `id`、`config_id`、`question_type`、`content`、`options`、`correct_answer`、`score`、`difficulty`、`knowledge_point`、`explanation`、`source`、`mode`、`adaptive_config` |
| 开始测评 | `session_id`、`config_title`、`total_questions`、`total_score`、`time_limit_minutes`、`started_at` |
| 获取题目 | 直接返回题目数组；每题含 `answer_id`、题型、内容、选项、分值、已有答案、是否已答、自适应标记、知识点和尝试序号，不返回正确答案 |
| 提交单题 | `answer_id`、`question_type`、`is_correct`、`correct_answer`、`explanation`、`earned_score`、`max_score`、`ai_feedback`；自适应题还可能返回下一题和掌握状态 |
| 提交整卷 | `session_id`、`status=graded`、`earned_score`、`total_score`；初级/高级画像在后台生成，因此初始 `basic_profile_id` 和 `summary` 可为空 |
| 测评结果 | 会话字段、逐题 `student_answer` / `correct_answer` / `earned_score` / `max_score` / `ai_feedback` / `explanation`、`basic_profile_id` |
| 初级画像 | 得分、`knowledge_scores`、`wrong_points`、`ai_summary`、`class_knowledge_rates` |
| 画像状态 | `basic_ready`、`advanced_ready` |
| 高级画像 | `profile_type`、`target_id`、`config_id`、`discussion_session_id`、`agent_ids`、`data_sources`、`result_text`、`scores` 和创建信息 |
| 统计 | `total_students`、`submitted_count`、`avg_score`、`max_score`、`min_score`、`pass_rate`、`knowledge_rates`、分数分布和趋势 |

评分时机：选择题立即精确判分；填空题立即 AI 评分，并在未配置智能体或 AI 失败时回退
文本比对；简答题单题提交时只保存答案，整卷提交后统一评分。

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

## 十四、学习中心（/learning）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/learning/progress/{module_key}` | 获取当前用户学习进度；首次无记录返回 `200` 和同构默认 payload，`module_key` 支持 `ml`、`ai`、`agents` | 是 |
| POST | `/learning/progress/{module_key}` | 保存当前用户学习进度 JSON，前端会按模块保留阶段状态、收藏、完成项和笔记 | 是 |
| GET | `/learning/content/{module_key}` | 获取启用的学习内容扩展项；无数据库内容时前端回退内置内容 | 是 |
| GET | `/learning/content/{module_key}/admin` | 管理员获取学习内容扩展项（包含禁用项） | 管理员 |
| PUT | `/learning/content/{module_key}/{section_key}/{item_key}` | 创建或更新学习内容项，`content` 为结构化 JSON，唯一键为模块、分区、条目 | 管理员 |
| PATCH | `/learning/content/{module_key}/{section_key}/{item_key}/enabled` | 启用或禁用学习内容项 | 管理员 |

说明：`module_key` 目前限制为 `ml`、`ai`、`agents`。`section_key` 用于区分路线图、知识体系、实验、工具、资源、Prompt、安全伦理、框架、核心技术等内容分区；前端也支持 `raw` 分区作为整包覆盖扩展入口。

Markdown 学习书可通过学习内容接口在后台维护。前端内置完整百科式学习书作为 fallback；当管理员写入 `section_key=raw`、`item_key=book` 且 `content` 包含 `book` 对象时，前端会使用该对象覆盖对应模块的内置学习书。外部链接应放在章节 `references` 中作为可选参考，主体知识内容应写入章节 `markdown` 字段。

示例：覆盖机器学习模块学习书。

```http
PUT /learning/content/ml/raw/book
Content-Type: application/json
```

```json
{
  "section_key": "raw",
  "item_key": "book",
  "title": "机器学习百科式学习书",
  "summary": "后台可编辑的 Markdown 学习书覆盖内容。",
  "content": {
    "book": {
      "moduleKey": "ml",
      "title": "机器学习百科式学习书",
      "subtitle": "从数据理解到模型作品的完整成长路径",
      "description": "面向信息技术课堂和项目学习的机器学习教材。",
      "audience": "适合具备基础 Python 或数据表格经验的学习者。",
      "outcomes": [
        "能描述机器学习项目从问题定义到复盘的完整流程",
        "能完成可运行实验，并用指标和图表解释结果"
      ],
      "chapters": [
        {
          "slug": "overview",
          "title": "机器学习总览：从问题到作品",
          "summary": "建立机器学习项目全局视角。",
          "estimatedMinutes": 35,
          "difficulty": "beginner",
          "goals": ["说明机器学习项目的基本流程"],
          "markdown": "# 机器学习总览\n\n## 学习定位\n这里写后台可编辑的 Markdown 正文。",
          "checklist": ["能画出项目流程图"],
          "experiments": [
            {
              "title": "最小建模闭环",
              "goal": "完成一次数据读取、训练、评估和报告流程。",
              "steps": ["准备数据", "训练基线模型", "记录指标"],
              "output": "一份实验报告",
              "difficulty": "beginner"
            }
          ],
          "glossary": [{ "term": "特征", "definition": "描述样本的输入变量。" }],
          "references": [
            {
              "title": "可选延伸资料",
              "source": "参考资料",
              "note": "仅作为拓展阅读，不替代章节正文。"
            }
          ]
        }
      ]
    }
  },
  "tags": ["markdown", "book", "ml"],
  "difficulty": "beginner",
  "sort_order": 0,
  "enabled": true,
  "source_type": "admin"
}
```

## 十五、课堂互动（/classroom）

### 管理端（/classroom/admin）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/classroom/admin/` | 创建活动 | `require_staff` |
| PUT | `/classroom/admin/{activity_id}` | 更新活动，仅 `draft` | `require_staff` + 教师所有权 |
| DELETE | `/classroom/admin/{activity_id}` | 删除活动，仅 `draft` | `require_staff` + 教师所有权 |
| POST | `/classroom/admin/{activity_id}/duplicate` | 复制活动 | `require_staff` + 教师所有权 |
| POST | `/classroom/admin/{activity_id}/restart` | 重启活动 | `require_staff` + 教师所有权 |
| POST | `/classroom/admin/bulk-delete` | 批量删除，仅删除 `draft` | `require_staff` + 教师所有权 |
| GET | `/classroom/admin/` | 活动列表 | `require_staff`，教师仅本人 |
| GET | `/classroom/admin/{activity_id}` | 活动详情 | `require_staff` + 教师所有权 |
| POST | `/classroom/admin/{activity_id}/start` | 开始活动 | `require_staff` + 教师所有权 |
| POST | `/classroom/admin/{activity_id}/end` | 结束活动 | `require_staff` + 教师所有权 |
| GET | `/classroom/admin/{activity_id}/statistics` | 活动统计 | `require_staff` + 教师所有权 |
| GET | `/classroom/admin/stream` | SSE 活动流 | `require_staff` |

### 学生端（/classroom）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/classroom/active` | 当前活动 | `require_student` + 班级匹配 |
| GET | `/classroom/stream` | SSE 活动流 | `require_student` + 非空班级 |
| GET | `/classroom/{activity_id}` | 活动详情 | `require_student` + 班级匹配 |
| POST | `/classroom/{activity_id}/respond` | 提交响应 | `require_student` + 班级匹配 |
| GET | `/classroom/{activity_id}/result` | 查看活动结果 | `require_student` + 班级匹配 |

### 课堂计划（/classroom/plans）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/classroom/plans/admin` | 创建计划 | `require_staff` + 活动所有权 |
| PUT | `/classroom/plans/admin/{plan_id}` | 更新计划 | `require_staff` + 计划所有权 |
| DELETE | `/classroom/plans/admin/{plan_id}` | 删除计划 | `require_staff` + 计划所有权 |
| GET | `/classroom/plans/admin` | 计划列表 | `require_staff`，教师仅本人 |
| GET | `/classroom/plans/admin/{plan_id}` | 计划详情 | `require_staff` + 计划所有权 |
| POST | `/classroom/plans/admin/{plan_id}/start` | 启动计划 | `require_staff` + 计划所有权 |
| POST | `/classroom/plans/admin/{plan_id}/reset` | 重置计划 | `require_staff` + 计划所有权 |
| POST | `/classroom/plans/admin/{plan_id}/next` | 下一项 | `require_staff` + 计划所有权 |
| POST | `/classroom/plans/admin/{plan_id}/end` | 结束计划 | `require_staff` + 计划所有权 |
| POST | `/classroom/plans/admin/{plan_id}/items/{item_id}/start` | 启动计划项 | `require_staff` + 计划所有权 |
| POST | `/classroom/plans/admin/{plan_id}/items/{item_id}/end` | 结束计划项 | `require_staff` + 计划所有权 |
| GET | `/classroom/plans/active-plan` | 当前生效计划 | `require_student` + 班级匹配 |

课堂权限与数据边界：
- 学生端全部使用 `require_student`，活动详情、答题、结果、活动列表、SSE 和 active plan 都要求学生与活动具有完全匹配的非空 `class_name`。
- active plan 仅返回所有活动均属于当前学生班级的计划，并始终移除 `correct_answer`。
- 教师只能查看和管理自己创建的活动、计划及计划内活动；`admin`、`super_admin` 可全局管理。
- 教师 SSE 订阅 `admin_{user_id}`，`admin` / `super_admin` 订阅 `admin_global`；静态 `/stream` 路由优先于动态活动 ID 路由。
- 计划推进使用单一事务，活动转换失败会回滚计划状态；SSE 与自动分析在提交后触发。
- 并发重复答题触发唯一约束时会回滚，并稳定返回“已提交过答案”，不会留下失败事务。
- 同一教师的活动启动/重启按教师行锁串行化，并自动结束其他 active 活动。
- 填空活动结束后的 AI 分析投递到 Celery `celery` 队列；终态任务幂等，异常重试可接管遗留的 `running` 状态。

## 十六、IT 游戏资源库（/it/games）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/it/games` | 上架游戏列表，`page >= 1`、`size <= 100` | 否 |
| GET | `/it/games/categories` | 上架游戏分类，响应为 `{"categories": string[]}` | 否 |
| GET | `/it/games/{game_id}` | 上架游戏详情 | 否 |
| GET | `/it/games/{game_id}/download` | 下载文件并记录日志 | 是 |
| GET | `/admin/it/games` | 全部游戏列表，`size <= 100` | 管理员 |
| POST | `/admin/it/games` | 流式上传游戏安装包 | 管理员 |
| PUT | `/admin/it/games/{game_id}` | 编辑元数据与上下架状态 | 管理员 |
| DELETE | `/admin/it/games/{game_id}` | 删除数据库记录和物理文件 | 管理员 |
| GET | `/admin/it/games/{game_id}/logs` | 下载日志，`size <= 200` | 管理员 |

上传使用 1 MiB 分块、临时文件、增量 SHA256 和同目录原子重命名；默认上限由 `IT_GAME_MAX_UPLOAD_BYTES=524288000` 控制。数据库提交失败会回滚并删除最终文件，删除提交失败会恢复隔离文件。

## 十七、ML Book（/ml/book）

`module_key` 仅允许 `ml`、`ai`、`agents`。公开接口不需要认证，管理接口需要管理员权限。

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/ml/book/{module_key}` | 获取已启用书籍及章节；不存在时返回 `{"book": null}` | 否 |
| GET | `/admin/ml/book/{module_key}` | 获取完整书籍及全部章节 | 管理员 |
| PUT | `/admin/ml/book/{module_key}` | 创建或更新书籍元数据 | 管理员 |
| GET | `/admin/ml/book/{module_key}/chapters/{slug}` | 获取章节详情 | 管理员 |
| PUT | `/admin/ml/book/{module_key}/chapters/{slug}` | 创建或更新章节 | 管理员 |
| DELETE | `/admin/ml/book/{module_key}/chapters/{slug}` | 删除章节 | 管理员 |
| PATCH | `/admin/ml/book/{module_key}/chapters/reorder` | 批量重排章节 | 管理员 |
| PATCH | `/admin/ml/book/{module_key}/chapters/{slug}/toggle` | 启用或停用章节 | 管理员 |
