# 发布与运维记录

> 目标：集中记录每次发布的关键变更、配置影响、构建/部署步骤、验证结果与回滚点。

## v1.5.1-hotfix.4（2026-03-24）

### 1. 变更范围

- 智能体与模型发现接口鉴权收口（最小改动，避免前端回归）

关键改动文件：
- `backend/app/api/endpoints/agents/ai_agents/usage.py`
- `backend/app/api/endpoints/agents/model_discovery.py`
- `backend/tests/test_ai_agents_route_auth.py`

### 2. 核心修复

- `GET /ai-agents/usage`、`GET /ai-agents/usage/statistics`：改为管理员权限。
- `POST /ai-agents/usage`：改为登录用户权限，并强制使用当前登录用户 `id` 作为 `user_id`（忽略请求体传入值）。
- `POST /model-discovery/discover`、`POST /model-discovery/discover/{agent_id}`：改为管理员权限。
- 保持 `GET /ai-agents/active` 为公开可读，避免未登录页面初始化回归。

### 3. 验证结果

- 新增测试：
  - `pytest -q tests/test_ai_agents_route_auth.py tests/test_chat_stream.py` → `5 passed`
- 动态探针（未登录）：
  - `/ai-agents/usage`、`/ai-agents/usage/statistics`、`/ai-agents/usage (POST)`、`/model-discovery/discover*`、`/ai-agents CRUD/test` → `401`
  - `/ai-agents/active` → `200`

### 4. 配置影响

- 无新增配置项。

---

## v1.5.1-hotfix.3（2026-03-24）

### 1. 变更范围

- 全项目刷新交互专项优化（重点修复“点击刷新无反馈/无效果感知”）

关键改动文件：
- `frontend/src/pages/Admin/ClassroomInteraction/index.tsx`
- `frontend/src/pages/Admin/ClassroomPlan/PlanPage.tsx`
- `frontend/src/pages/Admin/ClassroomPlan/index.tsx`
- `frontend/src/pages/Admin/Informatics/TypstNoteEditor.tsx`
- `frontend/src/pages/Informatics/Reader.tsx`
- `frontend/src/pages/Admin/Articles/CategoryManageModal.tsx`
- `frontend/src/pages/Admin/Categories/index.tsx`

### 2. 核心修复

- 课堂互动：列表刷新增加 loading 与成功反馈；智能体列表刷新失败不再静默吞错。
- 课堂计划（新旧两套入口）：计划详情刷新失败不再静默；刷新按钮增加 loading 与明确反馈。
- Typst 编辑器：手动“刷新预览”在编辑模式下可强制触发（修复此前点击无效果）。
- Informatics 阅读器：刷新目录时同步刷新当前文档内容，避免只刷新左侧目录。
- 分类管理页：刷新按钮接入 loading，避免用户误判按钮未生效。

### 3. 验证结果

- `npm run -s type-check`（frontend）→ 通过
- `CI=true npm test -- --runInBand`（frontend）→ `53 suites / 280 tests passed`

---

## v1.5.1-hotfix.2（2026-03-24）

### 1. 变更范围

- 修复多处“刷新按钮点击后无明显效果”的交互问题（重点覆盖学生端智能体面板）

关键改动文件：
- `frontend/src/pages/AIAgents/AssessmentPanel.tsx`
- `frontend/src/pages/AIAgents/ClassroomPanel.tsx`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`

### 2. 核心修复

- `AssessmentPanel`：刷新按钮不再只在 `list` 视图生效，`result` 视图可刷新结果数据；`quiz` 视图给出明确提示。
- `ClassroomPanel`：手动刷新增加可视化 loading 与成功/失败反馈；异常不再完全静默吞掉。
- `GroupDiscussionPanel`：手动刷新改为全量消息刷新（`afterId=0`），并增加 loading/禁用态，避免“点了没变化”的误判。

### 3. 验证结果

- `npm run -s type-check`（frontend）→ 通过
- `CI=true npm test -- --runInBand`（frontend）→ `53 suites / 280 tests passed`

---

## v1.5.1-hotfix.1（2026-03-24）

### 1. 变更范围

- 修复“小组讨论发送消息偶发重复两条”的问题（前后端双层防护）

关键改动文件：
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`
- `backend/app/services/agents/group_discussion.py`
- `backend/app/utils/cache.py`
- `backend/tests/test_group_discussion_send_message.py`
- `backend/tests/test_cache_set_nx.py`

### 2. 核心修复

- 前端发送增加同步防重入锁（`sendingRef`），避免 Enter/点击并发触发双发。
- 后端发送限流改为 Redis 原子 `SET NX EX`，消除 `exists + set` 并发竞态。
- Redis 锁未获取时优先读取 TTL 返回剩余等待秒数；TTL 不可用时继续 DB 回退校验，保证降级安全。
- 缓存工具新增 `cache.set(..., nx=True)` 能力，供原子限流等场景复用。

### 3. 配置影响

- 无新增配置项。
- 继续沿用 `GROUP_DISCUSSION_RATE_LIMIT_SECONDS`、`GROUP_DISCUSSION_REDIS_ENABLED`。

### 4. 验证结果

- 新增测试：`tests/test_group_discussion_send_message.py`、`tests/test_cache_set_nx.py`
- 执行结果：
  - `pytest -q tests/test_group_discussion_send_message.py tests/test_cache_set_nx.py` → `3 passed`
  - `pytest -q tests/test_rate_limit.py tests/test_chat_stream.py tests/test_openrouter_fallback.py` → `16 passed`
  - `npm run -s type-check`（frontend）→ 通过

---

## v1.5.1（2026-03-24）

### 1. 变更范围

- 智能体对话稳定性修复（OpenRouter + 多平台并用）
- 登录时效切换为短时策略（Access 60 分钟 / Refresh 7 天）
- 版本号统一管理（单一来源）
- 文档与部署默认值同步到 `1.5.1`

关键提交：
- `d1f4798` `fix(auth,agents): harden login/session expiry and multi-provider stream reliability`
- `c633539` `chore(test): add frontend jest and babel config files`
- `9d50115` `chore(release): sync config and docs defaults to 1.5.1`
- `a5e3572` `chore(release): centralize version resolution via VERSION file`

### 2. 核心修复

- OpenRouter 运行时请求头与连接测试统一：`HTTP-Referer`、`X-Title`
- `/ai-agents/stream` 在上游 `HTTP 200` 且无文本时仍发送 `message_end`
- 前端流式引擎空结果明确报错（避免前端挂起/空消息）
- OpenRouter 全局 Key 不再兜底到 SiliconFlow 等非 OpenRouter endpoint

### 3. 配置影响

必看配置项：
- `ACCESS_TOKEN_EXPIRE_MINUTES=60`
- `REFRESH_TOKEN_EXPIRE_DAYS=7`
- `COOKIE_SECURE`：
  - HTTPS 生产建议 `true`
  - HTTP 场景需 `false`

多平台并用注意：
- OpenRouter 与 SiliconFlow 需分别在智能体配置中填写各自 `api_endpoint + api_key`

### 4. 版本统一机制

默认版本单一来源：
- 根目录 `VERSION`

脚本行为：
- `scripts/deploy.sh` / `build_images.sh` 优先读取 `VERSION`
- 自动派生：`APP_VERSION`、`IMAGE_TAG`、`REACT_APP_VERSION`
- 临时覆盖方式：
  - `VERSION_OVERRIDE=1.5.2 bash scripts/deploy.sh build`
  - `./build_images.sh 1.5.2`

### 5. 构建与部署（生产）

```bash
# 1) 确认版本
cat VERSION

# 2) 构建镜像
bash scripts/deploy.sh build

# 3) 推送镜像
bash scripts/deploy.sh push

# 4) 服务器拉取并启动
bash scripts/deploy.sh pull-up

# 5) 健康检查
bash scripts/deploy.sh health
```

### 6. 验证基线

- 后端测试：`105 passed`
- 前端测试：`53 suites / 280 tests passed`
- 前端 type-check：通过
- 前端 lint：`0 errors, 68 warnings`（基线告警）

### 7. 回滚参考

- 回滚到 `1.5.0`：
  - 将 `VERSION` 改为 `1.5.0`（或设置 `VERSION_OVERRIDE=1.5.0`）
  - 重新执行 `build/push/pull-up`

---

## 维护约定

- 每次发布后都在本文件追加新版本记录（按时间倒序）。
- 每条记录至少包含：`变更范围`、`配置影响`、`部署步骤`、`验证结果`、`回滚点`。
