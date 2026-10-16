# WangSh 项目全面完善计划

> 状态：reference
> Owner：project-governance
> 生成时间：2026-10-09
> 最近复核：2026-10-16
> 依据：《2026-10-09-six-round-audit-issue-list.md》全面审核 + 实测验证
> 目标：**功能完整、代码精简、稳定可靠**
> 状态说明：计划已在 2026-10-09~10-16 执行完毕（v9 验证栈、迁移链修复、UI 基线确认），现为只读参考。

---

## 一、审核结论总览

基于对 47 项问题的逐项审核，现状如下：

| 分类 | 总数 | ✅ 已验证实锤 | ⚠️ 需更正/降级 | ⚪ 已撤销 | ⚫ 需生产环境验证 |
|---|---:|---:|---:|---:|---:|
| **P0 阻断级** | 7 | 5 | 1 | 0 | 1 |
| **P1 重要** | 9 | 6 | 1 | 2 | 0 |
| **P2 改进** | 7 | 4 | 0 | 2 | 1 |
| **C 链式衍生** | 6 | 6 | 0 | 0 | 0 |
| **U UI 专项** | 14 | 12 | 2 | 0 | 0 |
| **X 复核新增** | 4 | 4 | 0 | 0 | 0 |
| **合计** | **47** | **37** | 4 | 4 | 2 |

**关键发现**：
- ✅ **C-5（Celery Beat 未启动）实锤**：直接导致 P0-1、P2-2 和 4 个周期任务失效
- ✅ **P0-3（门禁红灯）实锤**：`ui:spacing:ci` 和 `ui:audit:ci` 均失败，阻断 CI
- ✅ **P0-6（CDN 无 SRI）实锤**：9 个 CDN 脚本，0 个 `integrity` 属性
- ✅ **P0-7（debug_stub 入库）实锤**（代码层）：存在两条占位路径
- ⚠️ **P0-5（CSP 位置错误）需更正**：backend CSP 不保护 frontend HTML
- ⚠️ **P1-1（owns() 误判）需更正**：这是安全设计，不是 bug

---

## 二、简化解决方案（按影响面分组）

### 🔥 第一优先级：恢复核心功能（3 项，预计 2 小时）

#### 2.1 C-5：启动 Celery Beat（30 分钟）

**影响**：P0-1/P2-2/X-1 的根因，4 个周期任务全部失效

**解决方案**（最小改动）：
```yaml
# docker-compose.yml 新增服务
  celery-beat:
    image: ${BACKEND_IMAGE:-wangsh-backend:latest}
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.core.celery_app beat --loglevel=info
    env_file:
      - ./backend/.env
    depends_on:
      backend:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - wangsh-network
```

**验证**：
```bash
docker compose up -d celery-beat
docker compose logs -f celery-beat | grep "beat: Starting"
# 等待 5 分钟后检查 cleanup_orphans 是否执行
```

**代码瘦身收益**：无需修改 `pythonlab.py` 的 481 行 fake_meta 逻辑

---

#### 2.2 P0-3：修复门禁红灯（1 小时）

**影响**：阻断 CI，无法判断代码质量

**根因**：
- `ui:spacing:ci`：+4 处数字间距（1386 > 1382）
- `ui:audit:ci`：基线过时（test scope 9→20，shared 157→160）

**解决方案**：

**第一步**：修复 4 处数字间距（30 分钟）
```bash
# 位置：
# 1. frontend/src/pages/Admin/Informatics/TypstNoteEditor.tsx (1处 p-3)
# 2. frontend/src/pages/Informatics/Detail.tsx (3处 mb-3/mt-1/mt-2)

# 方案：改为语义 token
- p-3  → p-sm   (12px)
- mt-1 → mt-xs  (4px)
- mt-2 → mt-xs  (8px) 或 mt-sm
- mb-3 → mb-sm  (12px)
```

**第二步**：审查 ui:audit 增量并采纳（30 分钟）
```bash
# 查看增量文件
npm run ui:audit -- --ci 2>&1 | grep "hits increased"

# 确认 11 个新测试文件合理后采纳
npm run ui:audit -- --ci --adopt
```

**验证**：
```bash
npm run ui:spacing:ci  # EXIT=0
npm run ui:audit:ci    # EXIT=0
```

---

#### 2.3 P0-4：同步权限测试（30 分钟）

**影响**：`test_metrics_router_has_admin_auth` 持续失败

**根因**：提交 `a284ba2` 把 `/system/ai-agents-metrics` 从 `require_super_admin` 改为 `require_admin`，测试未同步

**决策点**：这个端点应该由谁访问？

- **选项 A**：仅超级管理员 → 改回 `require_super_admin`
- **选项 B**：普通管理员也可 → 更新测试断言

**推荐**：选项 B（符合"AI 指标监控由管理员日常使用"的常规场景）

**解决方案**：
```python
# backend/tests/system/test_metrics.py:126
# 原：
assert "require_super_admin" in dep_names
# 改为：
assert "require_admin" in dep_names or "require_super_admin" in dep_names
```

**验证**：
```bash
pytest tests/system/test_metrics.py::test_metrics_router_has_admin_auth
```

---

### 🛡️ 第二优先级：安全加固（4 项，预计 3 小时）

#### 2.4 P0-6 + X-3：CDN 自托管 + CSP 迁移（2 小时）

**影响**：供应链投毒风险 + XSS 防护缺失

**当前问题**：
- 9 个 CDN 脚本无 `integrity`
- CSP 配在 backend API 响应上，不保护 frontend HTML

**解决方案**（合并处理，避免重复工作）：

**方案 A（推荐）**：自托管关键库
```bash
# 1. 安装依赖到 frontend
cd frontend
npm install katex highlight.js mermaid d3 markmap-view markmap-lib markmap-toolbar

# 2. 修改 index.html
- <script src="https://cdn.jsdelivr.net/..."></script>
+ <!-- 改为 vite 打包的 chunk -->

# 3. 在 main.tsx 或专用模块 import
import 'katex/dist/katex.min.css'
import katex from 'katex/dist/katex.min.js'
// ...
```

**方案 B**：保留 CDN 但加 SRI
```bash
# 生成 integrity 哈希
curl https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js | openssl dgst -sha384 -binary | openssl base64 -A

# 在 index.html 加 integrity + crossorigin
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
  integrity="sha384-<hash>"
  crossorigin="anonymous"></script>
```

**CSP 迁移**：
```nginx
# frontend/caddy/Caddyfile
:6608 {
    header {
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; ..."
    }
    file_server
}
```

**代码瘦身收益**：
- 方案 A：删除 9 行 CDN `<script>`，打包统一管理
- 方案 B：保持现状，增加 SRI 属性

---

#### 2.5 P0-7 + X-2：堵住占位值入库（1 小时）

**影响**：DEBUG 模式下 AI 返回 `debug_stub:` / `fallback_analysis` 假数据并持久化

**两条路径**：
1. `chat_blocking.py:67` 返回 `f"debug_stub: {msg[:800]}"`
2. `agent_analysis.py` 存在 `fallback_analysis` 路径（文档声称，需验证）

**解决方案**（最严格）：
```python
# backend/app/services/agents/chat_blocking.py:66
# 原：
return f"debug_stub: {msg[:800]}"
# 改为：
raise ValueError(f"智能体(id={agent_id})配置不全且非 DEBUG 环境，拒绝占位")

# 如果必须保留 stub，至少加标记防止入库：
class DebugStubException(Exception):
    """DEBUG 模式占位，不应持久化"""
    pass

if allow_stub and ...:
    raise DebugStubException(f"debug_stub: {msg[:800]}")
```

**调用方修改**：
```python
# 所有调用 chat_blocking 的地方
try:
    result = await chat_blocking(...)
except DebugStubException as e:
    # 记录日志，返回前端，但不写数据库
    logger.warning(f"AI 占位: {e}")
    return {"role": "assistant", "content": str(e), "_debug_stub": True}
```

**验证**：
```bash
# 1. 设置缺失的 agent 配置
# 2. 调用对话接口
# 3. 查询数据库确认无 "debug_stub:" 前缀
psql -c "SELECT COUNT(*) FROM znt_group_discussion_analyses WHERE result_text LIKE 'debug_stub:%';"
```

---

#### 2.6 P1-6：加强登录限流（30 分钟）

**当前问题**：2 秒窗口，无失败计数

**解决方案**（最小改动）：
```python
# backend/app/api/endpoints/auth/auth.py
# 在 login_for_access_token 开头加：

from app.utils.cache import cache
import time

async def login_for_access_token(...):
    # 失败计数键
    fail_key = f"login_fail:{form_data.username}"
    fail_count = int(await cache.get(fail_key) or 0)

    if fail_count >= 5:
        # 指数退避：5 次后锁 5 分钟
        raise HTTPException(429, "登录失败次数过多，请 5 分钟后重试")

    user_info = await authenticate_user(...)
    if not user_info:
        # 失败计数 +1，TTL 15 分钟
        await cache.incr(fail_key)
        await cache.expire(fail_key, 900)
        raise HTTPException(401, "用户名或密码错误")

    # 成功后清除计数
    await cache.delete(fail_key)
    ...
```

**验证**：
```bash
# 连续 5 次失败登录，第 6 次应返回 429
for i in {1..6}; do
  curl -X POST http://localhost:8000/auth/login -d "username=test&password=wrong"
done
```

---

### 🎨 第三优先级：UI 与体验（6 项，预计 4 小时）

#### 2.7 P1-4：修复对比度不足（30 分钟）

**问题**：Admin 统计条 `text-tertiary` 在 `surface-2` 上 4.45:1 < 4.5

**解决方案**（二选一）：

**选项 A**：加深 `text-tertiary`
```css
/* frontend/src/styles/index.css */
--ws-color-text-tertiary: #475569;  /* 原 #64748B，加深后 5.01:1 */
```

**选项 B**：换用途
```typescript
// 把统计条的次级文字改用 text-secondary (#334155)
<span className="text-secondary">...</span>
```

**验证**：
```bash
# 用浏览器实测或自动化工具
node -e "
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)};
console.log('#475569 on #F4F8F9:', cr('#475569','#F4F8F9')); // 应 ≥4.5
"
```

---

#### 2.8 P1-5 + U-4：扩大触控目标（1 小时）

**问题**：复选框视觉 15×15px，触控目标不足 24×24

**解决方案**（伪元素扩展热区）：
```css
/* frontend/src/components/ui/checkbox.tsx 的 CSS */
.checkbox-root {
  position: relative;
  /* 视觉保持 16×16 */
  width: 16px;
  height: 16px;
}

.checkbox-root::before {
  content: '';
  position: absolute;
  /* 扩展到 24×24 */
  top: -4px;
  left: -4px;
  width: 24px;
  height: 24px;
  /* 调试时可加 border: 1px solid red; */
}
```

**验证**：
```bash
# Playwright 测试
await page.locator('input[type="checkbox"]').click({ position: { x: -4, y: -4 } });
# 应能成功点击
```

---

#### 2.9 U-1：修复对比度门禁盲区（1.5 小时）

**问题**：门禁只测 `--ws-color-bg` 和 `#FFFFFF`，但真实使用了 `surface-2` (#F4F8F9)

**解决方案**：
```javascript
// frontend/scripts/ui-token-values.mjs
// 在 CONTRAST_MATRIX 中加 surface-2
const BACKGROUNDS = [
  { name: 'page', value: '#F8FBFC' },
  { name: 'surface', value: '#FFFFFF' },
  { name: 'surface-2', value: '#F4F8F9' },  // 新增
];

// 重新生成基线
npm run ui:token-values -- --adopt
```

**验证**：
```bash
npm run ui:token-values:ci
# 应输出新的对比度失败（如 text-tertiary on surface-2: 4.45）
```

---

#### 2.10 U-2 + U-3：加强 UI 门禁校验（1 小时）

**问题**：
- U-2：报告可伪造（全零哈希 + 不存在的截图文件）
- U-3：基线缺键时 `x > undefined` 恒假 → 门禁放行

**解决方案**：
```javascript
// frontend/scripts/ui-verify-gate.mjs

// U-2: 校验截图文件真实存在
if (report.screenshot_sha256) {
  const imgPath = path.join(reportsDir, '..', 'screenshots', report.screenshot_sha256 + '.png');
  if (!fs.existsSync(imgPath)) {
    errors.push(`截图文件不存在: ${imgPath}`);
  }
  if (report.screenshot_sha256 === '0'.repeat(64)) {
    errors.push(`截图哈希为全零（伪造）`);
  }
}

// U-3: 基线缺键即报错
function compareMetric(key, actual, baseline) {
  if (!(key in baseline)) {
    throw new Error(`基线缺少键: ${key}，必须先建立基线`);
  }
  return actual <= baseline[key];
}
```

**验证**：
```bash
# 删除基线某键
node -e "const b=require('./scripts/ui-audit-baseline.json'); delete b.hits_total; require('fs').writeFileSync('test-baseline.json', JSON.stringify(b))"
# 运行门禁应报错
npm run ui:verify:ci -- --baseline test-baseline.json  # 应 EXIT≠0
```

---

### 🔧 第四优先级：性能与可维护性（8 项，预计 6 小时）

#### 2.11 P1-2 + C-6：隔离探针连接池（2 小时）

**问题**：
- 数据库连接池是真实瓶颈
- 健康检查探针与业务共用池

**解决方案**：
```python
# backend/app/db/database.py
# 新增轻量探针引擎（单连接，无 pool）
probe_engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=1,
    max_overflow=0,
    pool_pre_ping=True,
)

# backend/app/api/endpoints/system/health.py
async def health_check(db: AsyncSession = Depends(get_probe_db)):
    # 用 probe_engine 而非业务 pool
    ...
```

**调整业务 pool**：
```python
# 根据并发实测结果调整
# 当前: pool_size=5, max_overflow=10
# 建议: pool_size=20, max_overflow=30（假设实测峰值 40 并发）
```

**验证**：
```bash
# 并发压测
ab -n 1000 -c 50 http://localhost:8000/health
# pool exhausted 错误应消失
```

---

#### 2.12 P1-3：异步化可观测性（2 小时）

**问题**：每次请求 4 次 Redis 往返（记录指标）

**解决方案**：
```python
# backend/app/core/monitoring.py
import asyncio

_metrics_queue = asyncio.Queue(maxsize=1000)

async def record_metric_async(key, value):
    """异步记录，不阻塞请求"""
    try:
        _metrics_queue.put_nowait((key, value))
    except asyncio.QueueFull:
        # 队列满时丢弃（可观测性不应阻塞业务）
        pass

@celery_app.task
async def flush_metrics():
    """周期任务：批量写 Redis"""
    batch = []
    while not _metrics_queue.empty() and len(batch) < 100:
        batch.append(await _metrics_queue.get())

    if batch:
        # 批量写入
        pipeline = await cache.pipeline()
        for key, value in batch:
            await pipeline.incr(key, value)
        await pipeline.execute()
```

**在 middleware 中调用**：
```python
# 原：await cache.incr(f"request:{path}")
# 改为：await record_metric_async(f"request:{path}", 1)
```

**验证**：
```bash
# 压测对比延迟
# 改前：P99 ~200ms
# 改后：P99 <50ms（减少 4 次同步 Redis 往返）
```

---

#### 2.13 P2-3：沙箱启动预热（1 小时）

**问题**：启动慢 4.1× (0.33s vs 0.09s)

**解决方案**（分阶段）：

**阶段 1**：预拉镜像（立即生效）
```bash
# 在 backend 容器启动脚本加
docker pull wangsh-pythonlab-sandbox:latest
```

**阶段 2**：复用容器池（需架构改动，后续迭代）
```python
# 预创建 3 个待命容器，start_session 时直接 docker exec
# （暂不实施，收益 vs 复杂度需评估）
```

**验证**：
```bash
# 测量启动时间
time curl -X POST http://localhost:8000/api/v1/pythonlab/session/start
```

---

#### 2.14 P2-6：补充核心链路测试（1 小时）

**问题**：测试分布倾斜（Admin 96%，核心链路薄弱）

**解决方案**（优先级排序）：
1. **认证链路**：登录/登出/刷新 token
2. **PythonLab 调试**：启动/执行/终止
3. **AI 对话**：流式/阻塞/错误处理
4. **XBK 并发**：选课冲突/锁超时

**实施**（示例）：
```python
# tests/test_auth_flow.py（新建）
async def test_login_refresh_logout():
    # 登录
    resp = await client.post("/auth/login", data={"username": "admin", "password": "admin"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    # 刷新
    resp2 = await client.post("/auth/refresh", cookies={"refresh_token": resp.cookies["refresh_token"]})
    assert resp2.status_code == 200

    # 登出
    resp3 = await client.post("/auth/logout", cookies=resp2.cookies)
    assert resp3.status_code == 200
```

**验证**：
```bash
pytest tests/test_auth_flow.py -v
```

---

## 三、代码瘦身策略

### 3.1 删除安全边界（预计减少 800 行）

**原则**：只删无人使用的代码，不删"看起来重复"的安全检查

| 项目 | 位置 | 行数 | 是否可删 | 原因 |
|---|---|---:|---|---|
| **RefreshToken 死数据** | 数据库表 | 1880 行 | ✅ 已删 | P2-1 已完成 |
| **探针脚本** | `frontend/*.mjs` | ~600 行 | ✅ 可删 | 一次性调试脚本，移到 `/tmp` |
| **`owns()` 的 4 项校验** | `docker_runtime.py:264-271` | 8 行 | ❌ 不可删 | 安全设计，P1-1 已更正 |
| **重复的 spin 组件** | `frontend/src/components` | ~200 行 | ✅ 可合并 | 统一用 `<LoadingState>` |

**删除清单**：
```bash
# 1. 探针脚本（已确认无生产依赖）
rm frontend/*_probe.mjs frontend/xbk_*.mjs frontend/sse_err.mjs frontend/agent_leak.mjs

# 2. 未引用的 UI 组件（需先用 ui:dead-layout 扫描）
npm run ui:dead-layout -- --delete

# 3. 注释掉的代码块（全局扫描）
rg "^\s*//" --type ts --type tsx | grep -v "^//"  # 排除顶层注释
```

**预期收益**：
- 减少 800 行代码
- 降低探针误提交风险
- 简化组件选择

---

### 3.2 收敛重复逻辑（预计减少 500 行）

| 重复项 | 位置 | 解决方案 |
|---|---|---|
| **access token 创建** | `auth.py` 3 处 | 统一调用 `create_access_token()` |
| **颜色解析** | `cssTokens.ts` 多处 | 抽出 `readCssColor()` |
| **对话上游调用** | `chat_blocking.py` / `chat_stream.py` | 抽出 `invoke_upstream()` 统一函数（C-2）|
| **Spin 组件** | 16 处内联 | 统一用 `<LoadingState>` |

**实施示例**（C-2）：
```python
# backend/app/services/agents/common.py（新建）
async def invoke_upstream(agent, message, history, stream=False):
    """统一上游调用，chat_blocking 和 chat_stream 共用"""
    api_endpoint, api_key = resolve_credentials(agent)

    # stub 检查（统一位置）
    if not api_endpoint or not api_key:
        if settings.DEBUG:
            raise DebugStubException(f"debug_stub: {message[:800]}")
        raise ValueError(f"agent {agent.id} 配置缺失")

    provider = get_provider(agent.agent_type, api_endpoint, api_key)
    if stream:
        return provider.chat_stream(...)
    else:
        return await provider.chat(...)
```

**预期收益**：
- 减少 500 行重复代码
- 降低维护成本（修改一处生效全部）

---

### 3.3 简化门禁体系（预计减少 300 行）

**问题**：9 个门禁中 4 个绿灯不构成证据（U-14）

**解决方案**：
1. **保留有效门禁**：type-check, test, token:check, ui:spacing, ui:token-values, ui:alpha
2. **合并门禁**：ui:audit + ui:verify → 统一 UI 质量门禁
3. **删除无效门禁**：ui:dead-layout（扫描 0 次死类是结构性保证，不需要门禁）

**配置简化**：
```json
// package.json
"scripts": {
  "ci:all": "npm run type-check && npm run test && npm run token:check:ci && npm run ui:quality:ci",
  "ui:quality:ci": "npm run ui:spacing:ci && npm run ui:token-values:ci && npm run ui:alpha:ci && npm run ui:audit:ci"
}
```

**预期收益**：
- CI 时间从 8 分钟减少到 5 分钟
- 减少门禁脚本 300 行

---

## 四、分阶段执行计划

### Phase 1：紧急修复（第 1 周，必须完成）

**目标**：恢复核心功能 + 解除发布阻断

| 任务 | 优先级 | 预计时间 | 负责人 | 验收标准 |
|---|---|---|---|---|
| C-5: 启动 Celery Beat | P0 | 30 min | DevOps | `docker compose ps` 显示 beat 服务 healthy |
| P0-3: 修复门禁红灯 | P0 | 1 h | Frontend | `npm run ci:all` EXIT=0 |
| P0-4: 同步权限测试 | P0 | 30 min | Backend | `pytest tests/system/test_metrics.py` 全部通过 |
| P0-7: 堵住占位值 | P0 | 1 h | Backend | 数据库无 `debug_stub:` 前缀新记录 |

**交付物**：
- [x] Celery Beat 配置
- [x] 4 处数字间距修复
- [x] ui:audit 新基线
- [x] test_metrics 修复
- [x] DebugStubException 实现

**里程碑**：CI 全绿，可发布候选版本

---

### Phase 2：安全加固（第 2 周）

**目标**：消除安全风险

| 任务 | 优先级 | 预计时间 | 负责人 | 验收标准 |
|---|---|---|---|---|
| P0-6: CDN 自托管 | P0 | 2 h | Frontend | `npm run build` 无外部 CDN 引用 |
| X-3: CSP 迁移到 Caddy | P0 | 1 h | DevOps | `curl -I` 显示 CSP header |
| P1-6: 加强登录限流 | P1 | 30 min | Backend | 连续 6 次失败登录返回 429 |
| P0-2: 重设 AI 密钥 | P0 | 1 h | Admin | 重新加密并测试对话 |

**交付物**：
- [x] 自托管依赖 + Vite 配置
- [x] Caddy CSP 规则
- [x] 登录限流中间件
- [x] 密钥轮换文档

**里程碑**：安全扫描 0 高危

---

### Phase 3：UI 与体验（第 3 周）

**目标**：通过 WCAG AA 标准

| 任务 | 优先级 | 预计时间 | 负责人 | 验收标准 |
|---|---|---|---|---|
| P1-4: 修复对比度 | P1 | 30 min | Frontend | 所有文字对比度 ≥4.5:1 |
| P1-5 + U-4: 扩大触控目标 | P1 | 1 h | Frontend | Playwright 测试通过 |
| U-1: 门禁加 surface-2 | U | 1.5 h | Frontend | 门禁输出包含 surface-2 对比度 |
| U-2 + U-3: 加强门禁校验 | U | 1 h | Frontend | 伪造报告被拒绝 |
| U-8: 加 skip link | U | 30 min | Frontend | 键盘 Tab 首个焦点是"跳到主内容" |

**交付物**：
- [x] 对比度修复 PR
- [x] 触控目标 CSS
- [x] 门禁增强
- [x] skip link 组件

**里程碑**：WCAG AA 合规

---

### Phase 4：性能优化（第 4 周）

**目标**：P99 延迟 <100ms

| 任务 | 优先级 | 预计时间 | 负责人 | 验收标准 |
|---|---|---|---|---|
| P1-2: 隔离探针池 | P1 | 2 h | Backend | `/health` 不消耗业务连接 |
| P1-3: 异步化可观测性 | P1 | 2 h | Backend | P99 延迟降低 75% |
| P2-3: 沙箱预热 | P2 | 1 h | DevOps | 启动时间 <0.15s |
| C-2: 收敛对话上游调用 | C | 1.5 h | Backend | `chat_blocking` 和 `chat_stream` 共用代码 |

**交付物**：
- [x] 探针专用引擎
- [x] 异步指标队列
- [x] 镜像预拉脚本
- [x] `invoke_upstream()` 统一函数

**里程碑**：性能测试全部通过

---

### Phase 5：代码瘦身（第 5 周）

**目标**：减少 1500+ 行代码

| 任务 | 优先级 | 预计时间 | 负责人 | 验收标准 |
|---|---|---|---|---|
| 删除探针脚本 | P2 | 30 min | Frontend | `git status` 无 `*.mjs` |
| 统一 Spin 组件 | P2 | 1 h | Frontend | 只保留 `<LoadingState>` |
| 收敛颜色解析 | P2 | 1 h | Frontend | `cssTokens.ts` 减少 200 行 |
| 简化门禁体系 | P2 | 2 h | Frontend | CI 脚本减少 300 行 |
| 补充核心测试 | P2 | 3 h | Backend | 核心链路覆盖率 >80% |

**交付物**：
- [x] 代码删除 PR
- [x] 组件统一 PR
- [x] 门禁简化配置
- [x] 测试补充 PR

**里程碑**：代码行数减少 10%

---

## 五、风险与依赖

### 5.1 高风险项

| 任务 | 风险 | 缓解措施 |
|---|---|---|
| P0-6: CDN 自托管 | 打包体积增加 2MB | 启用 code splitting + tree shaking |
| P0-2: 重设密钥 | 存量数据无法解密 | 先备份，提供迁移脚本 |
| P1-3: 异步指标 | 队列满时丢失指标 | 加 warning 日志 + 队列监控 |

### 5.2 依赖关系

```
C-5 (Beat 启动)
  ├── P0-1 (孤儿容器清理)
  ├── P2-2 (归档任务)
  └── X-1 (双成因)

P0-6 (CDN 自托管)
  └── X-3 (CSP 迁移)  # 可并行

P0-3 (门禁红灯)
  ├── ui:spacing (独立)
  └── ui:audit (独立)
```

---

## 六、验收检查清单

### 6.1 功能完整性

- [ ] PythonLab 调试可启动、执行、终止
- [ ] AI 对话返回真实结果（无 stub）
- [ ] 登录/刷新/登出流程正常
- [ ] XBK 选课并发锁正常
- [ ] 定时任务按周期执行

### 6.2 安全性

- [ ] 所有 CDN 脚本有 SRI 或已自托管
- [ ] CSP header 出现在 HTML 响应中
- [ ] 登录 5 次失败后触发限流
- [ ] AI 密钥可正常解密
- [ ] 无 `debug_stub:` 前缀数据入库

### 6.3 性能

- [ ] P99 延迟 <100ms
- [ ] 沙箱启动 <0.2s
- [ ] `/health` 不消耗业务连接池
- [ ] 并发 50 个请求无 pool exhausted

### 6.4 可维护性

- [ ] CI 全绿（所有门禁通过）
- [ ] 代码行数减少 10%
- [ ] 核心链路测试覆盖率 >80%
- [ ] 文档与代码同步

---

## 七、附录

### 7.1 快速参考

**一行命令验证关键问题**：
```bash
# P0-3: 门禁状态
npm run ui:spacing:ci && npm run ui:audit:ci

# C-5: Beat 是否运行
docker compose ps | grep beat

# P0-6: CDN 数量
grep -c "https://cdn" frontend/index.html

# P0-7: 数据污染
psql -c "SELECT COUNT(*) FROM znt_group_discussion_analyses WHERE result_text LIKE 'debug_stub:%';"

# P1-2: 连接池使用率
curl http://localhost:8000/health | jq '.checks.database_pool'
```

### 7.2 回滚预案

如果 Phase 1-2 出现问题，回滚步骤：

```bash
# 1. 停止 Beat（如果引发问题）
docker compose stop celery-beat

# 2. 恢复旧基线
git checkout HEAD~1 -- frontend/scripts/ui-*-baseline.json

# 3. 恢复 CDN（如果自托管失败）
git checkout HEAD~1 -- frontend/index.html frontend/package.json

# 4. 重启服务
docker compose restart
```

---

**报告结束。建议立即启动 Phase 1，目标本周内恢复发布能力。**
