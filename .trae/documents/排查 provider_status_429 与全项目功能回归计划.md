## 现状判断
- `provider_status_429` 来自上游模型服务返回 HTTP 429（限流/额度不足/并发过高），不是“账号密码错误”。你使用的 `qwen/qwen3-next-80b-a3b-instruct:free` 在 OpenRouter 上本身就更容易触发 429（免费路由通常限制更严格）。

## 目标
- 把 429 从“生硬错误码”升级为“可读原因 + 可操作建议 + 可观测信息”。
- 按 A-H 对整个项目做一次可重复的全功能回归，尽可能发现类似问题（UI 不同步、权限、初始化幂等、队列/异步等）。
- 解决你提出的 2 个体验问题：
  - 编辑智能体时能看到/可控地管理 API Key
  - “操作”悬浮弹窗（Tooltip/Popover）为空的问题

## 1) 复现并定位 429（基于 docker 实际部署环境）
- 在你当前 docker 部署的环境里复现：
  - 管理后台“测试智能体”（调用 `/api/v1/ai-agents/test`）
  - 前台对话页发送（调用 `/api/v1/ai-agents/stream`）
  - 小组讨论管理端分析（如果启用）
- 采集上游响应关键信息（不记录密钥/敏感数据）：
  - 429 响应体（前 200-500 字符）
  - 常见限流字段（如果上游返回：重试建议/剩余额度/重置时间）
  - 触发路径（哪个 endpoint / 哪个 agent_id / 哪个 model_name）
- 判断 429 类型并给出直接结论：
  - 限流（RPM/TPM/并发）
  - 免费额度/账单/余额限制
  - 代理/镜像源导致的异常限流

## 2) 改进 429 的错误处理（后端 + 前端）
- 后端（blocking + streaming）：
  - 对 401/403/402/404/429/5xx 做统一的“人类可读”映射，返回结构化字段：`provider_status`、`message`、`detail`。
  - 对 429/5xx 增加可控的重试与退避（exponential backoff + jitter），并设置最大重试次数与总超时，避免卡死。
  - 对 OpenRouter 增加“提示策略”：当选择 `:free` 模型且频繁 429 时，提示更换非 free 模型或充值/降频。
- 前端：
  - 对话页（SSE）与后台测试弹窗统一把 429 显示成明确中文原因（限流/额度不足/稍后重试/更换 key）。
  - 把错误信息按“标题 + 详细原因”展示，避免出现“错误\n错误\nprovider_status_429”。

## 3) API Key 的“保存 + 编辑可见”设计（满足你需求且尽量安全）
- 现状：编辑智能体时表单会把 `api_key` 初始化为空（见 [AgentForm.tsx](file:///Users/wsh/wangsh/frontend/src/pages/Admin/AIAgents/components/AgentForm.tsx#L72-L83)），这是为了避免把密钥直接回显。
- 我会做成“默认不明文回显，但可按需显示”的方案：
  - 数据库存储：把 `api_key` 改为加密存储（新增 `api_key_encrypted` / `api_key_last4` / `has_api_key`），避免明文落库。
  - API 返回：列表/详情默认只返回 `has_api_key` + `api_key_last4`（不返回明文 key）。
  - 新增“显示密钥”接口：仅 `super_admin` 可调用，并要求二次确认（例如再次输入管理员密码或二次验证），返回一次性的明文 key。
  - 前端编辑体验：
    - API Key 输入框显示：`已保存（末尾 ****1234）`
    - 提供按钮：`显示`（二次确认后填充输入框并允许复制）、`更换`、`清除`（显式操作才会改库）

## 4) “操作”悬浮弹窗为空的问题
- 先在 docker 实际页面复现你说的 hover 场景（表头“操作”还是行内按钮区域）。
- 针对 Antd Tooltip 空白常见原因逐项修：
  - disabled 元素 Tooltip 不触发/内容不显示（用 `<span>` 包裹）
  - title 传入空值（确保每个操作按钮都有固定 title）
  - 样式覆盖导致文字不可见（统一 Tooltip 主题/颜色）
- 同时把“操作”的含义做成更明确的 UI：
  - 给图标按钮加 `aria-label` + 更清晰的 tooltip 文案（查看/编辑/测试/删除分别说明作用）
  - 必要时把纯图标改成“图标+文字”（可选）

## 5) A-H 全项目功能回归（从 A 到 H 依次）
- A 基础设施：health、容器健康、数据库迁移幂等、Redis、worker 队列
- B 认证与权限：登录/刷新/me/退出、管理员权限、刷新后登录态
- C 用户管理：CRUD/分页/搜索/批删/权限
- D 内容系统：分类 CRUD、文章 CRUD、前台列表/详情
- E Typst：笔记 CRUD、上传、编译/导出、metrics、worker 消费
- F XBK：public-config、students/courses/selections CRUD、analysis、导入/导出
- G 智能体：CRUD、测试、对话流式、usage、group discussion（含管理员分析）
- H 前端一致性：所有关键页面的状态同步、错误提示一致性、权限跳转
- 输出结果：每一项给出“通过/失败/复现步骤/修复建议/是否阻塞上线”。

## 交付物
- 429 的根因结论（针对你这个 `qwen/...:free` + OpenRouter 具体场景）
- API Key 的“可见/可控且尽量安全”的完整实现
- Tooltip/操作说明修复
- A-H 回归测试脚本与一份可重复执行的检查清单（含自动化与必要的手工点检）