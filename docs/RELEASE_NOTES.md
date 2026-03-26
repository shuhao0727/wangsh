# 发布与运维记录

> 目标：集中记录每次发布的关键变更、配置影响、构建/部署步骤、验证结果与回滚点。

## v1.5.1-hotfix.7（2026-03-24）

### 1. 变更范围

- 小组讨论读取权限收口（阻断学生跨会话越权读取）
- 跨系统分析参数生效与空成员保护
- 并发建组冲突兜底与初始化 SQL 对齐

关键改动文件：
- `backend/app/services/agents/group_discussion.py`
- `backend/app/api/endpoints/agents/ai_agents/group_discussion.py`
- `backend/tests/test_group_discussion_access_control.py`
- `backend/db/init.sql/full_init_v4.sql`
- `docs/API.md`

### 2. 核心修复

- 学生读取讨论消息与 SSE 流时，新增“必须是会话成员”校验；非成员返回 `403`。
- `/admin/cross-system-analyze` 的 `date/class_name` 参数改为强校验：
  - 所选会话与参数不一致时返回 `422`。
  - 所选会话无成员时返回 `422`，避免误扫全量 AI 提问数据。
- 新建小组并发冲突时，创建路径捕获唯一键冲突并回查既有会话，避免并发报错。
- `full_init_v4.sql` 补齐 `znt_group_discussion_members` 表、索引和外键，确保脚本化初始化与当前模型一致。

### 3. 验证结果

- `pytest -q backend/tests/test_group_discussion_access_control.py backend/tests/test_group_discussion_send_message.py backend/tests/test_group_discussion_join_lock.py backend/tests/test_group_discussion_class_scope.py` → `17 passed`
- `CI=true npm test -- --runInBand src/pages/AIAgents/GroupDiscussionPanel.test.ts src/pages/AIAgents/groupDiscussionJoinLock.test.ts` → `7 passed`

### 4. 配置影响

- 无新增配置项。

---

## v1.5.1-hotfix.6（2026-03-24）

### 1. 变更范围

- 修复“管理员新建小组后学生看不到”的班级归属问题
- 收口学生端跨班 join 风险（避免通过请求体伪造班级）

关键改动文件：
- `backend/app/services/agents/group_discussion.py`
- `backend/tests/test_group_discussion_class_scope.py`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.test.ts`
- `docs/API.md`

### 2. 核心修复

- 后端新增 `resolve_target_class_name` 班级解析逻辑：
  - 学生端：强制使用本人班级；若请求体携带其他班级，返回 `403`。
  - 管理员端：未显式传 `class_name` 时，优先回退到管理员账号自身 `class_name`，减少误落到“管理员”虚拟班级。
  - 管理员端：若请求与账号都无班级，接口直接返回 `422`，避免创建“不可见小组”脏数据。
- 前端“小组讨论 -> 新建小组”增加管理员班级必填项，默认回填筛选班级或已存在班级，避免误建到不可见班级。

### 3. 验证结果

- `pytest -q backend/tests/test_group_discussion_class_scope.py backend/tests/test_group_discussion_join_lock.py` → 通过
- `CI=true npm test -- --runInBand src/pages/AIAgents/GroupDiscussionPanel.test.ts` → 通过

### 4. 配置影响

- 无新增配置项。

---

## v1.5.1-hotfix.5（2026-03-24）

### 1. 变更范围

- 小组讨论组号锁机制修复（避免“加入失败却被锁组号”）
- 课堂互动服务层关键状态机测试补齐
- 小组讨论前端组号锁定提示增强（锁定组号 + 秒级剩余时间）

关键改动文件：
- `backend/app/services/agents/group_discussion.py`
- `backend/app/api/endpoints/agents/ai_agents/group_discussion.py`
- `backend/tests/test_group_discussion_join_lock.py`
- `backend/tests/test_classroom_service_flow.py`
- `backend/app/services/assessment/session_service.py`
- `backend/tests/test_assessment_session.py`
- `backend/tests/test_auth_logout_refresh.py`
- `backend/tests/test_auth_refresh_nonce.py`
- `frontend/src/pages/AIAgents/ClassroomPanel.tsx`
- `frontend/src/pages/AIAgents/ClassroomPanel.test.ts`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx`
- `frontend/src/pages/AIAgents/GroupDiscussionPanel.test.ts`
- `frontend/src/pages/AIAgents/groupDiscussionJoinLock.ts`
- `frontend/src/pages/AIAgents/groupDiscussionJoinLock.test.ts`
- `frontend/src/pages/AIAgents/AssessmentPanel.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/api.test.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/hooks/useAuth.test.ts`
- `frontend/src/pages/Xbk/index.tsx`
- `frontend/src/pages/Xbk/index.test.ts`

### 2. 核心修复

- `enforce_join_lock` 改为“仅检查锁，不写入锁”。
- 新增 `set_join_lock`，仅在 `join` 成功后写入锁，避免失败请求污染锁状态。
- 组号锁冲突提示增强：返回当前锁定组号（如“组号已锁定为 3，xx 秒内不可更改”）。
- 前端 `GroupDiscussionPanel` 在 join 失败时会解析锁冲突提示，并可视化展示“锁定组号 + 剩余秒数”，减少误操作与重复报错。
- 自我评价结果页画像轮询增加上限（约 2 分钟）与超时提示，避免异常时无限轮询。
- 课堂互动学生端新增 SSE 实时监听（保留原轮询兜底）：活动开始/结束后可更快刷新状态，断线后 3 秒自动重连。
- 课堂互动服务新增关键用例：`submit_response` 重复提交、非 active 提交、`start_activity`/`end_activity` 状态门禁、`bulk_delete_activities` 跳过 active。
- 自主测评填空题判分兜底修复：未配置评分智能体时，`fill` 题回退文本比对（忽略大小写），避免正确答案被误判为 0 分。
- 小组讨论 SSE token 获取统一为 `getStoredAccessToken()`，避免不同存储路径导致的偶发“前端有登录态但流连接鉴权失败”。
- 前端新增全局会话失效收敛：当 `401 -> refresh 失败` 时触发 `ws:auth-expired` 事件，`useAuth` 立即切换未登录状态，避免页面停留在“伪登录态”。
- 认证链路补充 refresh 轮换单测：验证“旧 refresh token 在轮换后必须失效，新 refresh token 可继续轮换”。
- 三个学生端面板补充登录失效回收：
  - `GroupDiscussionPanel`：会话失效时关闭面板并清理会话缓存；SSE 建连条件增加 `isAuthenticated`，避免失效后仍保持旧连接/轮询。
  - `ClassroomPanel`：会话失效时回收到 `idle` 并清空当前活动态，防止重新登录后残留旧题面。
  - `AssessmentPanel`：会话失效时停止画像轮询并回收答题/结果态，避免后台继续轮询导致连续报错。
- XBK 选课记录编辑修复：`/xbk/data/selections` 存在 `id=0` 的虚拟未选/休学行时，前端不再错误调用 `PUT /xbk/data/selections/0`。
  - 虚拟行“编辑”改为“补录”（走 `createSelection`）。
  - 虚拟行隐藏删除按钮，避免误触发 `DELETE /xbk/data/selections/0`。
  - 选课记录表 `rowKey` 对虚拟行改为复合键，避免 `id=0` 重复导致潜在错行。

### 3. 验证结果

- 新增/回归测试：
  - `pytest -q backend/tests/test_assessment_session.py backend/tests/test_assessment_profile.py backend/tests/test_classroom_service_flow.py backend/tests/test_group_discussion_join_lock.py backend/tests/test_group_discussion_send_message.py` → `43 passed`
  - `pytest -q backend/tests/test_assessment_session.py backend/tests/test_assessment_profile.py backend/tests/test_classroom_service_flow.py backend/tests/test_group_discussion_join_lock.py backend/tests/test_group_discussion_send_message.py backend/tests/test_auth_logout_refresh.py backend/tests/test_auth_refresh_nonce.py` → `51 passed`
  - `npm run -s type-check`（frontend）→ 通过
  - `CI=true npm test -- --runInBand src/pages/AIAgents/groupDiscussionJoinLock.test.ts src/pages/AIAgents/AssessmentPanel.test.ts` → `14 passed`
  - `CI=true npm test -- --runInBand src/pages/AIAgents/ClassroomPanel.test.ts src/pages/AIAgents/groupDiscussionJoinLock.test.ts src/pages/AIAgents/AssessmentPanel.test.ts` → `17 passed`
  - `CI=true npm test -- --runInBand src/services/api.test.ts src/hooks/useAuth.test.ts src/pages/AIAgents/ClassroomPanel.test.ts src/pages/AIAgents/groupDiscussionJoinLock.test.ts src/pages/AIAgents/AssessmentPanel.test.ts` → `19 passed`
  - `CI=true npm test -- --runInBand src/pages/AIAgents/GroupDiscussionPanel.test.ts src/pages/AIAgents/ClassroomPanel.test.ts src/pages/AIAgents/AssessmentPanel.test.ts` → `19 passed`
  - `CI=true npm test -- --runInBand src/pages/Xbk/index.test.ts` → `3 passed`
- 动态探针：
  - 学生端非法组号 `group_no=XABC` → `422`
  - 紧接着合法组号加入不再被非法请求触发的锁影响（可成功 `200`）
  - 三板块第 6 轮全链路探针（admin + 新建学生）：`38/38` 通过（含小组讨论锁冲突、消息限流、测评幂等、课堂互动重复提交防重）。
  - 三板块第 7 轮并发探针：`6/6` 通过（小组讨论并发发送仅 1 条成功、测评重复答题防重、课堂活动切换自动结束旧活动）。
  - 三板块第 8 轮长连接探针：课堂互动 `/classroom/stream` 与小组讨论 `/ai-agents/group-discussion/stream` 均可稳定接收事件（含 `activity_ended`、消息推送）。
  - 三板块第 9 轮认证边界探针（学生账号）：登录 `200`、`/auth/me` `200`、`rt1 -> rt2` 轮换成功、旧 `rt1` `401`、`rt2` 继续轮换 `200`。
  - 三板块第 11 轮真实页面探针（学生账号，Chrome 自动化）通过：
    - 初次登录后三面板（小组讨论/自我评价/课堂互动）入口可见且可打开。
    - 强制写入无效 `ws_access_token/ws_refresh_token` 并清空 Cookie 后，前端自动触发会话失效回收（三面板入口全部收起）。
    - 重新登录后三面板入口恢复，且三面板可再次打开。
  - `GET /classroom/stream?token=bad.invalid.token` 在存在有效 Cookie 会话时仍可握手 `200`（`text/event-stream`），验证 query token 失效场景的 Cookie 回退链路。
  - XBK 样本验证：`GET /xbk/data/selections?page=1&size=200` 返回中同时存在真实选课行与 `id=0` 虚拟行（未选/休学），证实 `/selections/0` 404 的触发条件。
  - 填空题兜底验证：未配置评分智能体时，`student_answer=print` 可正确判分（`is_correct=true, earned_score=10`）。

### 4. 配置影响

- 无新增配置项，沿用现有 `GROUP_DISCUSSION_JOIN_LOCK_SECONDS`。

---

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
- `build_images.sh` 优先读取 `VERSION`
- 自动派生：`APP_VERSION`、`IMAGE_TAG`、`REACT_APP_VERSION`
- 临时覆盖方式：
  - `./build_images.sh 1.5.2`

### 5. 构建与部署（生产）

```bash
# 1) 确认版本
cat VERSION

# 2) 构建镜像
bash build_images.sh

# 3) 推送镜像
docker compose push

# 4) 服务器拉取并启动
docker compose pull && docker compose up -d

# 5) 健康检查
curl http://localhost:6608/health
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
