# API 接口清单

> 基础路径：`/api/v1`（认证接口需携带 `Authorization: Bearer <token>` 头）
> 最后更新：2026-03-18

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
| GET | `/ai-agents/analysis/hot-questions` | 热门问题分析 | 管理员 |
| GET | `/ai-agents/analysis/student-chains` | 学生问题链分析 | 管理员 |
| POST | `/ai-agents/admin/export/conversations` | 导出对话 | 管理员 |
| GET | `/ai-agents/admin/export/hot-questions` | 导出热门问题 | 管理员 |
| GET | `/ai-agents/admin/export/student-chains` | 导出学生链 | 管理员 |

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
| GET | `/model-discovery/preset-models` | 获取预设模型列表 | 管理员 |
| GET | `/model-discovery/detect-provider` | 检测 API 提供商 | 管理员 |
| GET | `/model-discovery/supported-providers` | 获取支持的提供商 | 管理员 |

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

## 十二、调试工具 / PythonLab（/debug）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/debug/syntax/check` | 语法检查 | 是 |
| POST | `/debug/cfg/parse` | CFG 解析 | 是 |
| POST | `/debug/sessions` | 创建调试会话 | 是 |
| GET | `/debug/sessions/{session_id}` | 获取会话详情 | 是 |
| POST | `/debug/sessions/{session_id}/stop` | 停止会话 | 是 |
| GET | `/debug/sessions` | 获取会话列表 | 是 |
| POST | `/debug/sessions/cleanup` | 清理过期会话 | 管理员 |
| WS | `/debug/sessions/{session_id}/terminal` | 终端 WebSocket | 是 |
| WS | `/debug/sessions/{session_id}/ws` | 调试 WebSocket（DAP） | 是 |
| POST | `/debug/optimize/code` | AI 代码优化 | 是 |
| POST | `/debug/optimize/apply/{log_id}` | 应用优化结果 | 是 |
| GET | `/debug/optimize/rollback/{log_id}` | 回滚优化 | 是 |
| GET | `/debug/flow/prompt_template` | 获取提示模板 | 是 |
| POST | `/debug/flow/prompt_template` | 创建提示模板 | 是 |
| POST | `/debug/ai/chat` | AI 聊天 | 是 |
| POST | `/debug/flow/generate_code` | 生成代码 | 是 |
| POST | `/debug/flow/test_agent_connection` | 测试智能体连接 | 是 |
| POST | `/debug/flow/parse` | 解析流程图 | 是 |
