# WangSh 项目问题清单与修复方案

> 状态：archived
> Owner：project-governance
> 最近复核：2026-10-09（第十七轮整合重排）
> 生成方式：多轮只读深度探查（源码走读 + 真实运行栈实测 + 真实浏览器驱动 + 并发压测 + 日志取证 + 迁移回放 + 多 Agent 交叉验证）
> 探查范围：运行态、设计、安全、效果、稳定性、UI、并发容量、AI 链路、数据一致性、门禁体系
> 归档整理：2026-10-19（仅索引和历史边界复核）
> 当前入口：[项目整理台账](../plans/project-consolidation.md)；UI 视觉以[嵌入式规范](../frontend/EMBEDDED_UI_STYLE_GUIDE.md)为准。

> 历史说明：本文不再是当前计划或唯一问题台账。正文中的完成、待办、版本和验证标记均保留为当时快照；未复核事项不能因归档自动关闭。

---

## 导航：如何使用本文档

本文档在 2026-10-09 做过一次**结构整合**。此前它是十余轮探查的追加式记录，
存在三类问题，本版已消除：

| 原问题 | 本版处理 |
|---|---|
| **编号冲突**：`N-1`~`N-6` 被**两处不同语境重复使用**（12 个定义争 6 个编号）| 拆分为 `C-*`（链式衍生）与 `U-*`（UI 专项），全文唯一 |
| **结论分散**：同一问题在 3~5 处不同章节各写一遍，且新旧结论不一致 | 每项问题**只在第三章之后出现一次**，历史轮次压缩进附录 A |
| **缺解决方案**：多数条目只有"现象+根因"，没有可执行的修复方案 | 每项补齐**现状 / 根因 / 解决方案 / 验证方式**四段式 |

### 阅读路径

| 你的角色 | 建议路径 |
|---|---|
| **只想看「该修什么」** | 第二章总表 → 第九章修复路线图 |
| **要动手修某个问题** | 第二章查到编号 → 跳到对应章节看四段式 → 按「验证方式」验收 |
| **关心代码规模** | 第十章代码瘦身建议 |
| **关心质量门禁是否可信** | 第八章门禁体系健康度 |
| **想知道哪些结论被推翻/更正过** | **第十四章（第十八轮：三维度复核 + Docker 全栈）** / 第十三章 / 第十二章 |
| **要追溯某结论怎么来的** | 附录 A 历史轮次 / 附录 B 证据资产 |

> **⚠️ 强烈建议先读第十三章**。它对全文 43 项做了一次独立复核，
> 结果：**4 项结论需更正、2 项需撤销、4 项新发现**。
> 不读这一章，你可能会按已被推翻的结论去动手。

### 编号体系

| 前缀 | 含义 | 数量 |
|---|---|---|
| `P0-x` | 阻断级：影响核心功能或数据安全 | 7 |
| `P1-x` | 重要：影响体验、容量或可维护性 | 9 |
| `P2-x` | 改进：优化项 | 7 |
| `C-x` | 链式衍生：由上述问题推演出的新问题 | 6 |
| `U-x` | UI / 设计系统专项 | 14 |

**状态取值**（全文档统一，无其它写法）：

| 状态 | 含义 |
|---|---|
| 🔴 **仍存在** | 本版复核时实测复现 |
| 🟢 **已修复** | 实测已不复现，附验证证据 |
| ⚪ **已撤销** | 经复核为误判，附撤销理由 |
| 🟡 **部分修复** | 主体已修，残留项已列出 |
| ⚫ **无法验证** | 需真实浏览器/生产环境，本版未取得证据（**不视为通过**）|

---

## 一、执行摘要

### 1.1 总体结论

本次探查覆盖**运行态、设计、安全、效果、稳定性、UI、并发容量、AI 链路、数据一致性、门禁体系**十个维度。
最值得注意的**不是单个 bug，而是三条系统性结论**：

**结论一：失效模式高度一致 ——「静默降级」**

多个最严重的问题共享同一模式：**系统在失败时返回看似成功的结果**。

| 问题 | 表现 |
|---|---|
| **P0-2 / P0-7** | AI 密钥解密失败，但接口**返回 200**，内容是可识别前缀的假数据，**并且被持久化** |
| **C-2** | `/test` 接口与真实对话路径**行为不一致**，掩盖了故障 |
| **U-1** | 对比度门禁测了两个背景，**真实使用的是第三个**，门禁打印"0 known failures" |
| **U-2** | 报告可被伪造而门禁通过（规则只校验字段**存在性**）|
| **U-3** | 基线缺键时比较结果为 `undefined`，`x > undefined` 恒假 → **门禁放行** |

> **不能只看"接口是否返回 200"，必须校验返回内容的语义有效性。**

**结论二：「护栏建好了，但从未被真实证据走过」**

质量门禁**已实现且被强制执行**，但证据层是空的：

- `ui-verify-gate.mjs` 的 6 条规则齐全（含 L3/L4 字段校验、防造假、BLOCKED 强制）
- 但 **36 份 UI 报告全部是 L0**，0 份 L1/L2/L3/L4
- 6 个浏览器字段（含 `screenshot_sha256`）命中数**全部为 0**
- 根因：`ui-page-workflow.mjs:15,108` 明确声明"本脚本无浏览器采集能力，永不产出 L3/L4"

**⇒ 门禁通过不能被解读为"视觉/无障碍已验收"。**

**结论三：红灯长期无人收口 —— 告警疲劳**

`ui:spacing:ci` 已红 **4 天**（基线构建于 2026-10-05）无人处理。
一个长期为红的门禁，其实际约束力等于零。

### 1.2 状态总览

**（状态口径已在第十七轮复核后更新，见第十三章）**

| 分类 | 总数 | 🔴 仍存在 | 🟡 部分修复 | ⚠️ 结论更正 | ⚫ 无法验证 | 🟢 已修复 | ⚪ 已撤销 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **P0 阻断** | 7 | 5 | 1 | 1 | 0 | 0 | 0 |
| **P1 重要** | 9 | 6 | 1 | 1 | 0 | 0 | 1 |
| **P2 改进** | 7 | 4 | 0 | 0 | 0 | 1 | 2 |
| **C 链式衍生** | 6 | 5 | 0 | 1 | 0 | 0 | 0 |
| **U UI 专项** | 14 | 11 | 2 | 1 | 0 | 0 | 0 |
| **合计** | **43** | **31** | 4 | 4 | 1 | 1 | 2 |

> **第十七轮复核新增 4 项**（由链式推演得出，见第十三章 13.3）：
> ① P0-1 的双成因（P1-1 ∧ C-5）② `fallback_analysis` 第二占位路径
> ③ 生产无文档级 CSP ④ `POSTGRES_MAX_CONNECTIONS` 命名误导。
> **问题总数 43 → 46（含新增）。**
>
> 另有 **10 项历史误判**被撤回（见第十二章），不在此表内。

**⚠️ 关于置信度的诚实声明**：第十三章的复核发现
**4 项结论需更正、2 项需撤销**，即原有结论准确率约 **88%**。
**使用本清单时，凡标"中置信"的条目，请先按"验证方式"复现再动手。**

### 1.3 三条待人工决策项

| # | 事项 | 为什么需要人来定 |
|---|---|---|
| 1 | **凭据轮换**（`SECRET_KEY` 等 5 项）| 涉及存量数据重加密，且**不确定即视为未轮换** |
| 2 | **P0-4 权限收窄的契约方向** | 是实现回退，还是测试跟进？取决于产品意图 |
| 3 | **B5 间距迁移是否解冻** | 已冻结（剩 1382 处），解冻前提是视觉回归基线就位 |

---
## 二、唯一权威问题索引

> **本表是全文档唯一的编号索引。** 任何其它章节出现的编号都必须在表中存在。
> 此前版本存在的 `N-*` 编号冲突已在本版消除（详见第十二章 12.3）。

### 2.1 阻断级 P0（7 项）

| ID | 问题 | 状态 | 影响 | 一句话解法 | 详见 |
|---|---|---|---|---|---|
| **P0-1** | PythonLab 调试链路完全不可用（孤儿容器占位）| 🟡 部分修复 | 核心教学功能 | 容器已清除；**根因见 P1-1，未修则复发** | §3.1 |
| **P0-2** | AI 智能体对话不可用（密钥解密失败）| 🔴 仍存在 | AI 功能不可信 | 密钥 `AGENT_API_KEY_ENCRYPTION_KEY` 与密文不匹配 → 重设或重加密 | §3.2 |
| **P0-3** | 质量门禁红灯（提交阻断）| 🔴 仍存在 | 无法判断能否发布 | `ui:spacing` 基线收紧 +4；`ui:audit` 双向失配 | §3.3 |
| **P0-4** | 权限收窄未同步测试 | 🔴 仍存在 | 契约不符 | 先定方向（回退实现 or 更新用例），二选一 | §3.4 |
| **P0-5** | ~~生产 CSP 拦截 CDN~~ → **生产缺少文档级 CSP** | ⚠️ **结论更正** | 生产 XSS 防护缺失 | 把 CSP 移到 gateway/frontend Caddy（真正提供 HTML 的层）| §3.5 / §13.2.1 |
| **P0-6** | 9 个 CDN 脚本无 SRI | 🔴 仍存在 | 供应链投毒 | 加 `integrity`+`crossorigin`，或随 P0-5 一起自托管 | §3.6 |
| **P0-7** | DEBUG 下 AI 返回假数据并入库 | 🔴 仍存在（**实测零污染**）| 数据**可能**被污染 | 堵住 **两条**占位路径（`debug_stub` + `fallback_analysis`）| §3.7 |

### 2.2 重要 P1（9 项）

| ID | 问题 | 状态 | 一句话解法 | 详见 |
|---|---|---|---|---|
| **P1-1** | `cleanup_orphans` 缺少**安全的孤儿回收路径** | ⚠️ **已重新定性** | 新增**独立的**受审计回收路径（**不要**放宽 `owns()`，那是安全设计）| §4.1 / §13.2.3 |
| **P1-2** | 数据库连接池是真实容量瓶颈 | 🔴 仍存在 | 按并发实测调 `pool_size`，并把探针拆独立池 | §4.2 |
| **P1-3** | 可观测性组件耦合关键路径（4 次 Redis 往返）| 🔴 仍存在 | 指标采集移出请求路径（异步/采样）| §4.3 |
| **P1-4** | Admin 统计条对比度 4.45:1（< AA 4.5）| 🔴 仍存在 | 换 `text-tertiary` 的用途或加深该 token | §4.4 |
| **P1-5** | 复选框触控目标 15×15px | 🔴 仍存在 | 视觉保持、热区扩到 24×24（伪元素外扩）| §4.5 |
| **P1-6** | 登录限流强度偏弱（2s 窗口，无失败计数）| 🔴 仍存在 | 加失败计数 + 指数退避 + 账户锁定 | §4.6 |
| **P1-7** | 无活跃会话管理界面 | 🔴 仍存在 | 复用现有表格模式加"会话"页 | §4.7 |
| **P1-8** | ~~索引漂移~~ → **证据撤销，降级**（生产库实测 diff 1/0，仅 alembic 记账表 PK 伪影）| ⚪ **已撤销** | 无需业务修复；`alembic_version_pkc` 伪影可择机补迁移 | §4.8 / §14.A.3 |
| **P1-9** | SSE 容量 + 连接池饱和 | 🟡 部分修复 | 已修客户端重连；服务端连接上限待定 | §4.9 |

### 2.3 改进 P2（7 项）

| ID | 问题 | 状态 | 一句话解法 | 详见 |
|---|---|---|---|---|
| **P2-1** | token 死数据 | 🟢 已修复 | 已删 1880 行，保留 1 个活跃 token | §5.1 |
| **P2-2** | 归档任务从未执行 | 🔴 仍存在 | 根因是 **C-5（Beat 未启动）**，先修 C-5 | §5.2 |
| **P2-3** | 沙箱启动慢 4.1×（0.33s vs 0.09s）| 🔴 仍存在 | 复用已预热容器 / 预拉镜像 | §5.3 |
| **P2-4** | 首屏 CDN 依赖抵消懒加载收益 | 🔴 仍存在 | 与 P0-5/P0-6 合并处理（自托管）| §5.4 |
| **P2-5** | 测评路由"重复入口" | ⚪ 已撤销 | 经核实为兼容性重定向，非缺陷 | §5.5 |
| **P2-6** | 前端测试分布严重倾斜 | 🔴 仍存在 | 按"核心链路优先"补测，不追求行数均衡 | §5.6 |
| **P2-7** | ~~`session_id` 越权查询~~ | ⚪ **已撤销** | 管理端点按设计可见全部会话；用户端点已正确过滤 owner | **无需修复** | §5.7 / §13.2.2 |

### 2.4 链式衍生 C（6 项）

> 由 P0/P1/P2 推演得到。**此前与 UI 项共用 `N-*` 编号，已拆分**。

| ID | 问题 | 状态 | 一句话解法 | 详见 |
|---|---|---|---|---|
| **C-1** | P0-2 与 P0-7 是**同一条因果链** | 🔴 仍存在 | 合并修复：一处解决密钥与 stub 两个表象 | §6.1 |
| **C-2** | `/test` 与对话路径**是独立实现**（掩盖方向与原文相反）| 🔴 仍存在 | 抽出单一"调用上游"函数，两条路径共用 | §6.2 / §13.2.4 |
| **C-3** | stub 触发条件含 `model_name` 为空 | 🔴 仍存在 | 补全条件判断，避免"配置缺失"被当"调试模式" | §6.3 |
| **C-4** | `try_decrypt_api_key` 多处共用，轮换影响面大 | 🔴 仍存在 | 收敛到单一入口 + 轮换前评估影响面 | §6.4 |
| **C-5** | **Celery Beat 从未启动** → 所有周期任务失效 | 🔴 仍存在 | 在 compose 加 `beat` 服务 | §6.5 |
| **C-6** | 健康检查探针与业务共用连接池 | 🔴 仍存在 | 探针用独立轻量连接 | §6.6 |

### 2.5 UI / 设计系统专项 U（14 项）

| ID | 问题 | 状态 | 一句话解法 | 详见 |
|---|---|---|---|---|
| **U-1** | 对比度门禁**结构性盲区**（测错背景）| 🔴 仍存在 | 把 `surface-2` 等真实背景纳入矩阵 | §7.1 |
| **U-2** | `ui-verify-gate` 可被**伪造报告**通过 | 🔴 仍存在 | 校验截图文件真实存在 + 哈希非零 | §7.2 |
| **U-3** | 基线缺键导致 **fail-open** | 🔴 仍存在 | 缺键即报错，不得跳过比较 | §7.3 |
| **U-4** | 触控目标 <24px（P1-5 的扩展面）| 🟡 部分修复 | 与 P1-5 同一解法 | §7.4 |
| **U-5** | 同色系 alpha chip 对比度不足 | 🟡 部分修复 | 提高底纹不透明度或换色 | §7.5 |
| **U-6** | 门禁强度不足（部分规则只校验字段存在性）| 🔴 仍存在 | 补语义校验（见 U-2/U-3）| §7.6 |
| **U-7** | **告警疲劳**：`ui:spacing:ci` 已红 4 天 | 🔴 仍存在 | 红灯纳入例行收口，或明确豁免 | §7.7 |
| **U-8** | 无 skip link | 🔴 仍存在 | 布局加"跳到主内容" | §7.8 |
| **U-9** | 版本号渲染为 `v–`（**根因已更正**）| 🔴 仍存在 | 构建期从 `package.json` 注入版本；首页留白**另立一项** | §7.9 / §13.2.5 |
| **U-10** | `/admin/users` chip 中文标签折行溢出 | 🔴 仍存在 | chip 高度改 `min-h` 或字号适配 | §7.10 |
| **U-11** | `AdminAppCard` 颜色拼接失败 → 徽标透明 | 🔴 仍存在 | 传色值而非 `var()`，或改 `color-mix()` | §7.11 |
| **U-12** | `ui:dead-layout:ci` 的"0 死类"是结构性保证 | 🔴 仍存在 | 让扫描包含 `index.css` 定义侧 | §7.12 |
| **U-13** | `SPACING.md` 文档漂移（含整段重复）| 🔴 仍存在 | 改为脚本生成或删重复段 | §7.13 |
| **U-14** | 9 个 UI 门禁中 **4 个绿灯不构成证据** | 🔴 仍存在 | 见第八章逐门禁处置 | §7.14 |

### 2.6 第十七轮复核新增（4 项，详见第十三章）

> 由链式推演得出，均为本轮**新发现**，此前不在清单内。

| ID | 问题 | 状态 | 来源 | 一句话解法 | 详见 |
|---|---|---|---|---|---|
| **X-1** | **P0-1 有双成因**：P1-1（无回收路径）**∧** C-5（无周期触发）| 🔴 仍存在 | 链 A | **两者必须一起修**，只修一个孤儿仍会累积 | §13.3 |
| **X-2** | **`fallback_analysis` 第二占位路径**同样入库 | 🔴 仍存在 | 链 B | 修 P0-7 时**两条路径一起堵** | §13.3 |
| **X-3** | **生产无文档级 CSP**（CSP 配在了 API 响应上）| 🔴 仍存在 | 链 C | 把 CSP 移到 gateway/frontend Caddy | §13.3 |
| **X-4** | **`POSTGRES_MAX_CONNECTIONS` 命名误导**（实为 `pool_size`）| 🟡 中 | 链 D | 更名 + 建立连接预算 | §13.3 |

### 2.7 合计

| 分类 | 数量 |
|---|---:|
| P0 / P1 / P2 | 7 / 9 / 7 = **23** |
| C 链式衍生 | **6** |
| U UI 专项 | **14** |
| **复核新增 X** | **4** |
| **总计** | **47** |

| 状态 | 数量 |
|---|---:|
| 🔴 仍存在 | **36** |
| 🟡 部分修复 | 4 |
| ⚫ 无法验证（不计为通过）| 1 |
| 🟢 已修复 | 1 |
| ⚪ 已撤销 | 1 |

---
## 三、P0 阻断级（7 项）

> 本部分每项采用统一四段式：**现状（证据）→ 根因 → 解决方案 → 验证方式**。
> 解决方案遵循"**可行、可靠、简单**"：优先最小改动，避免引入新依赖或新架构。

---

### 3.1 P0-1 PythonLab 调试链路不可用

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P0 |
| **状态** | 🟡 **部分修复**（症状已解除，根因 P1-1 未修）|
| 影响面 | PythonLab 调试 —— 平台核心教学功能 |
| 置信度 | 高（专项烟测实测 + 容器取证）|

**现状（证据）**

专项烟测 `pythonlab-debug-smoke.mjs`：**16 场景，11 失败**。

```
FAIL 的 11 个中，10 个是 debug-* 场景 → 故障精确定位在调试（DAP）链路
PASS 的 5 个中，"运行"(run-happy-path) 与"导航"真实通过
→ 结论：不是整个 PythonLab 坏了，是仅调试链路
```

容器取证：

```
容器 label:  wangsh.pythonlab.runtime-mode = "plain"   ← 调试需要 "debug"
worker 日志: RuntimeError: 运行环境模式不兼容，请先停止旧会话。
             File "docker_runtime.py", line 133, in _check_resource_settings
```

**根因（三环相扣）**

```
① 容器 pythonlab_u1 以 plain 模式创建，失去 Redis 会话关联 → 成为孤儿
      ↓
② 两条清理路径都够不到它（实测）
   cleanup_orphans       → terminate_session("orphan", …) → 所有权校验失败 → 保留
   cleanup_stale_sessions → 只扫 Redis dbg_* 键 → dbg_ 键数 = 0
      ↓
③ 它是用户级共享容器（_u{user_id}），admin 所有调试复用
   → label 是 plain 但调试要 debug → check_reuse 抛错
      ↓
④ 调试对 admin 完全不可用
```

**解决方案**

*第 1 步 —— 解除当前阻塞（一次性，已完成）*

```bash
docker rm -f pythonlab_u1
```

*第 2 步 —— 防复发（本次重点）*

> **⚠️ 第十七轮更正：P0-1 有**两个**独立成因，是合取关系。**
> 原文只提 P1-1，**遗漏了 C-5**。详见第十三章 13.3 链 A。

```
P0-1 的两个成因（缺一不可）：
  ① P1-1 —— 即使 cleanup_orphans 执行了，也**没有安全的回收路径**
  ② C-5  —— 即使有回收路径，也**不会被周期性执行**（Celery Beat 从未启动）
```

触发方式复核结果：

| 触发路径 | 状态 |
|---|---|
| Celery Beat 每 5 分钟 | ❌ **C-5：Beat 未启动，从不执行** |
| 后端启动时（`startup.py:187`）| ⚠️ 仅在**重启时**执行一次 |
| API 手动触发 | ❌ 不存在 |

**⇒ 只修 P1-1 或只修 C-5，孤儿仍会累积。两者必须一起修。**

| 优先级 | 改动 | 说明 |
|---|---|---|
| **必做 ①** | **修 P1-1**（见 §4.1）—— 新增**独立的**受审计回收路径 | **注意：不要放宽 `owns()`**，那是安全设计（§13.2.3）|
| **必做 ②** | **修 C-5**（见 §6.5）—— compose 增加 `beat` 服务 | 一行改动，恢复周期触发 |
| 建议 | `_check_resource_settings` 模式不兼容时，若确认无活跃会话，**允许重建**而非抛错 | 把硬失败改为自愈 |
| 建议 | 后端返回**结构化错误码**（非纯中文文案）| 让前端能判断并自救 |

*第 3 步 —— 前端兜底*

提供"重置运行环境"按钮（依赖上面的结构化错误码）。

*第 4 步 —— 流程*

把 `pythonlab-debug-smoke.mjs` 写入**发布前手动 gate**，不可选。

**验证方式**

```bash
cd frontend && ADMIN_PASSWORD=<pw> node scripts/pythonlab-debug-smoke.mjs \
  --username admin --base-url http://localhost:6608
# 期望 16/16
```
界面点击调试能进入暂停态。

---

### 3.2 P0-2 AI 智能体对话不可用（密钥解密失败）

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P0 |
| **状态** | 🔴 仍存在 |
| 影响面 | AI 智能体全部对话功能 |
| 置信度 | 高 |

**现状（证据）**

后台显示「已配置 `…7b12`」，但实际调用时**解密失败**。
用户看到的是**成功响应**（见 P0-7 / C-1）—— 这是本问题最危险之处。

**根因**

`AGENT_API_KEY_ENCRYPTION_KEY` 与数据库中存量密文**不匹配**
（密钥被更换，或密文由另一把密钥加密）。

**解决方案**

三选一，按推荐顺序：

| 方案 | 操作 | 代价 | 适用 |
|---|---|---|---|
| **① 重设密钥（推荐）** | 后台重新录入各智能体的 API Key，用当前 `AGENT_API_KEY_ENCRYPTION_KEY` 重新加密 | 需重新录入 N 个智能体 | 智能体数量少（**当前场景**）|
| ② 找回旧密钥 | 从部署历史/密钥管理恢复原 `AGENT_API_KEY_ENCRYPTION_KEY` | 零录入，但可能拿不到 | 能找回时最优 |
| ③ 写迁移脚本 | 用旧密钥解密 → 新密钥加密 | 需同时拿到新旧两把密钥 | 智能体很多时 |

> **注意**：方案 ③ 依赖 C-4 的结论 —— `try_decrypt_api_key` 被多处共用，
> 轮换前必须评估影响面。

**验证方式**

```bash
curl -s -X POST http://localhost:8000/api/v1/ai-agents/stream \
  -H 'Content-Type: application/json' \
  -d '{"agent_id":1,"message":"你好"}' | head -20
# 期望：返回真实模型输出，且不含 "debug_stub:" 前缀
```

---

### 3.3 P0-3 质量门禁红灯

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P0 |
| **状态** | 🔴 仍存在 |
| 影响面 | 无法判断代码能否发布 |
| 置信度 | 高（本版实测 exit code）|

**现状（证据）**

```
ui:spacing:ci   EXIT=1   numeric_spacing_uses 1386 > 基线 1382   （+4，真实回归）
ui:audit:ci     EXIT=1   双向失配（见下）
```

`ui:audit:ci` 的失败是**双向**的：

```
—— 基线过松（4 项，需收紧）——
  type css_px_declaration : actual 160 < 169
  scope page             : actual 497 < 504
  scope infrastructure   : actual  47 <  56
  route /articles        : actual   9 <  11

—— 命中上升（8 项，真实回归）——
  actionable hits          : 630 > 629
  total hits               : 744 > 733
  type inline_style_numeric: 214 > 196
  scope shared_components  :  66 >  60
  scope test               :  20 >   9
  route shared             : 160 > 157
  file src/pages/Xbk/Xbk.css:  5 >   4
```

**根因**

不是门禁失灵 —— **门禁成功抓住了回归**。问题是**红灯长期无人收口**（见 U-7）。

`+4` 的来源已定位到 2 个未提交文件：
`frontend/src/pages/Informatics/Detail.tsx`（+3）、
`frontend/src/pages/Admin/Informatics/TypstNoteEditor.tsx`（+1）。

**解决方案**

```bash
# ① 处理 spacing 的 +4：优先用语义 token 替换，而不是调基线
#    在 Detail.tsx / TypstNoteEditor.tsx 中把新增的数字间距类换成语义类

# ② 处理 ui:audit 的"基线过松"4 项：收紧基线
cd frontend && npm run -s ui:audit -- --ci --adopt

# ③ 处理"命中上升"8 项：逐项判断是真实债还是可接受
#    不可接受 → 改代码；确属有意 → 删除对应基线键并记录理由（不要保留松弛阈值）
```

> **纪律**：不要为了让门禁变绿而**放宽基线**。
> 项目既有规则明确"基线只降不升"，放宽等于把债务藏起来。

**验证方式**

```bash
cd frontend && npm run -s ui:spacing:ci && npm run -s ui:audit:ci
# 期望 exit 0
```

---

### 3.4 P0-4 权限收窄未同步测试

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P0 |
| **状态** | 🔴 仍存在 |
| 影响面 | 契约不符，测试失去保护意义 |
| 置信度 | 中高 |

**现状**：权限模型被收窄（更严格），但测试用例仍按旧契约编写，
导致用例与实现**描述的不是同一套规则**。

**根因**：权限变更时未同步更新对应测试。

**解决方案 —— 先决策，再动手**

这是**必须人工决策**的项，因为它取决于产品意图：

| 方向 | 含义 | 适用 |
|---|---|---|
| **A. 回退实现** | 收窄是误改，恢复原权限 | 收窄前未评估影响面 |
| **B. 更新用例** | 收窄是正确意图，测试跟进 | 收窄是刻意的安全加固（**大概率**）|

**推荐 B**，理由：权限收窄通常是安全加固方向，且项目处于开发阶段。
确定后：

```bash
# 找到失败用例
cd backend && pytest -q tests/ 2>&1 | grep -i "permission\|403\|forbidden"

# 逐个核对：是用例过时，还是实现有 bug
# 用例过时 → 更新断言；实现有 bug → 修实现
```

**验证方式**：`cd backend && pytest -q` 全绿，且新增/修改的用例确实覆盖收窄后的边界。

---

### 3.5 P0-5 生产环境**缺少文档级 CSP**（原判"CSP 拦截 CDN"已推翻）

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P0（**仅生产环境**）|
| **状态** | ⚠️ **原结论证伪，重构为下述新结论** |
| 影响面 | 生产环境 **XSS 防护缺失** |
| 置信度 | **高（完整拓扑级确认）** |

> **⚠️ 重要更正**：本项在第十七轮复核中被**证伪并重新定义**。
> 原文判定"生产 CSP 拦截 CDN 脚本 → 白屏"**不成立**。详见第十三章 13.1。

**原来的判定（错误）**

`backend/main.py:89-91` 的 CSP 不含 `cdn.jsdelivr.net`，
而 `index.html` 有 9 个 CDN 脚本 —— 据此推断生产环境脚本被拦截。

**证伪过程（本版实测）**

关键是**确认 HTML 文档究竟由谁提供**。完整生产拓扑：

```
浏览器
  ↓
gateway (Caddy :80)          ← gateway/Caddyfile
  ├── /api/*    → backend:8000      ← 仅此处回传 backend 的 CSP
  └── 其它      → frontend:80       ← frontend/caddy/Caddyfile.prod
                     └── 返回 index.html（无 CSP）
```

逐层核查 CSP 设置情况：

| 出口 | 是否设置 CSP | 证据 |
|---|---|---|
| `gateway/Caddyfile` | ❌ **0 处** | 只设 X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy |
| `gateway/Caddyfile.dev` | ❌ **0 处** | 同上 |
| `frontend/caddy/Caddyfile.prod` | ❌ **0 处** | 只设 Cache-Control 族 |
| `frontend/index.html` 的 `<meta http-equiv>` | ❌ **无** | 无 meta CSP |
| `backend/main.py` | ✅ 有 | **但只作用于 `/api/*` 的 JSON 响应** |

**⇒ 浏览器拿到的 HTML 文档没有任何 CSP。
CDN 脚本不会被拦截，页面不会因此白屏。原结论错误。**

**修正后的真实问题 —— CSP 被放在了没有作用的地方**

`script-src` / `style-src` / `font-src` 这些指令**只对 HTML 文档有意义**
（它们约束的是文档里加载的资源）。把 CSP 配在返回 JSON 的 API 响应上：

- 对 CDN 脚本**无任何约束作用**（API 不加载脚本）
- 对 XSS **无任何防护作用**（攻击者注入的脚本在文档里执行，不在 JSON 里）

**⇒ 生产环境实际上处于"无 CSP"状态，XSS 防护缺失。**

值得注意的是：安全意图**是存在的**（代码里认真写了完整 CSP），
但由于放错了出口，**这个控制完全没有生效** —— 属于第八章"④ 结构性盲区"的又一实例。

**解决方案**

**正确做法：把 CSP 移到真正提供 HTML 的出口**（`gateway/Caddyfile` 或 `frontend/caddy/Caddyfile.prod`），并使其与 `index.html` 实际加载的资源一致。

同时，正因为**当前生产没有 CSP**，P0-6（CDN 脚本无 SRI）的风险被放大 ——
SRI 是这里唯一的纵深防御。**建议两者一起处理**：

| 方案 | 操作 | 评价 |
|---|---|---|
| **① 自托管 + 在 Caddy 加 CSP（推荐）** | 把 9 个脚本移到 `frontend/public/vendor/`，在 gateway Caddy 设 CSP | **一次解决 P0-5、P0-6、P2-4**；CSP 终于作用在正确位置 |
| ② 保留 CDN + 在 Caddy 加 CSP 并放行 CDN 域 | CSP 中显式允许 `cdn.jsdelivr.net`、`fonts.googleapis.com`、`fonts.gstatic.com` | 改动小，但**必须同时做 P0-6 的 SRI**，否则等于把 CDN 提权为可信源却无完整性校验 |

> **CSP 必须覆盖的实际资源**（否则加上 CSP 反而会打断生产页面）：
> `script-src` 需含 8 个 CDN 脚本域；
> `style-src` 需含 `cdn.jsdelivr.net`（KaTeX CSS）与 `fonts.googleapis.com`；
> `font-src` 需含 `fonts.gstatic.com`（Inter / Noto Sans SC）。
> **这是"先自托管"的另一个理由** —— 自托管后这些例外全都不需要。

> **附带发现（同一次核查）**：`index.html` 还外链了
> **Google Fonts（Inter + Noto Sans SC）** 与 **KaTeX CSS**。
> 当前无 CSP 所以能正常加载；**但如果按方案②加 CSP 却漏配 `style-src`/`font-src`，
> 会把"当前正常的中文字体"打成回退字体** —— 这是典型的"修一个造成另一个"。

**验证方式**

```bash
# ① 生产事实：HTML 文档确实无 CSP
curl -sI http://localhost/ | grep -i content-security-policy   # 当前：无输出
# ② 修复后：应由 gateway 返回 CSP，且页面样式/字体/脚本均正常
curl -sI http://localhost/ | grep -i "content-security-policy"
# ③ 浏览器控制台应无 CSP 违规
```

**同时确认 P0-5 原判不再列为缺陷**：
`grep -c 'Content-Security-Policy' backend/main.py` 的存在**不是** CDN 被拦的原因。

---
### 3.6 P0-6 CDN 脚本无 SRI

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P0 |
| **状态** | 🔴 仍存在（本版已实测确认）|
| 影响面 | 供应链投毒 |
| 置信度 | **高（实测：9 个脚本，0 个 integrity）** |

**现状（证据）**

```
frontend/index.html 中 CDN 脚本数:        9
其中有 integrity 属性的:                  0
```

CDN 被入侵或域名被劫持时，攻击者可在**任意用户浏览器**中执行任意脚本
（这些脚本运行在应用同源上下文，可读取页面数据）。

**解决方案**

**推荐：随 P0-5 方案①一起自托管** —— 自托管后 SRI 问题自然消失（同源资源由构建完整性保证）。

若短期必须保留 CDN，则加 SRI：

```html
<script
  src="https://cdn.jsdelivr.net/npm/xxx@1.2.3/dist/xxx.min.js"
  integrity="sha384-<hash>"
  crossorigin="anonymous"></script>
```

生成 hash：

```bash
curl -s <script-url> | openssl dgst -sha384 -binary | openssl base64 -A
```

> **注意**：CDN 脚本必须**锁定精确版本**（`@1.2.3` 而非 `@latest`），
> 否则每次上游更新都会导致 SRI 校验失败、站点崩溃。

**验证方式**

```bash
grep -c 'https://cdn' frontend/index.html          # 自托管方案目标 0
# 或（保留 CDN 时）
grep -oE '<script[^>]*integrity' frontend/index.html | wc -l   # 目标 = CDN 脚本数
```

---

### 3.7 P0-7 DEBUG 下 AI 返回假数据并入库

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P0（**潜在风险，尚未实际发生**）|
| **状态** | 🔴 代码路径仍存在，但 **实测零污染**（见下）|
| 影响面 | 数据库**可能**被污染 |
| 置信度 | **高（代码级确认 + 数据库实测）** |

> **⚠️ 第十七轮更正**：原文称"数据污染**正在持续发生**" —— **该表述不准确**。
> 本版直接查询数据库：**4 张相关表共 18 行，命中 `debug_stub:` 的为 0 行**。
> 风险是**真实的**（代码路径确实存在），但**尚未实际发生**。详见下"实测结果"。

**现状（证据 —— 本版实测）**

`backend/app/services/agents/chat_blocking.py:60-67`：

```python
allow_stub = bool(settings.DEBUG) or str(getattr(settings, "REACT_APP_ENV", "") or "").lower() not in {
    "production", "prod",
}
if allow_stub and (
    not api_endpoint or not api_key or (agent.agent_type != "dify" and not agent.model_name)
):
    msg = (message or "").strip()
    return f"debug_stub: {msg[:800]}"      # ← 返回假的"成功"结果
```

而调用方 `group_discussion/analysis_service.py:56-77` **把它当作正常结果持久化**：

```python
result_text = await run_agent_chat_blocking(...)   # 可能是 "debug_stub: …"
...
    result_text=result_text,
)
db.add(analysis)          # ← 假数据进入数据库
await db.commit()
```

**危害**：`debug_stub:` 文本被当成 AI 分析结论存入数据库，
后续统计、展示、导出都会带上这些**伪装成真实结果**的垃圾数据。
比"功能不可用"更糟 —— 因为**它看起来是成功的**。

**实测结果（第十七轮新增）—— 目前零污染**

直接查询数据库中 4 张可能承载分析结果的表：

```
znt_group_discussion_analyses : 总 0 行, debug_stub 命中 = 0
task_analyses                 : 总 5 行, debug_stub 命中 = 0
hot_question_analyses         : 总 7 行, debug_stub 命中 = 0
student_chain_analyses        : 总 6 行, debug_stub 命中 = 0
```

旁证：`znt_group_discussion_sessions` 只有 2 行、`messages` 只有 1 行、
`analyses` **0 行** —— 说明**该功能在当前环境基本未被使用**，
所以污染路径**没有机会被触发**。

**⇒ 准确定性：这是一个"已装填但未击发"的缺陷。**
修复优先级仍然高（一旦有人使用该功能就会污染），
但**不应按"正在发生的生产事故"处理**。

#### 3.7.1 同一位置还有**第二条**占位数据路径（第十七轮新发现）

链式推演时在调用方发现**另一个**同样会被持久化的占位符 ——
此前只记录了 `debug_stub`，漏掉了它：

`backend/app/services/agents/group_discussion/analysis_service.py:61-66`：

```python
try:
    result_text = await run_agent_chat_blocking(db, ...)
except ValueError as e:
    msg = str(e)
    if msg.startswith("provider_status_429"):
        raise HTTPException(status_code=429, detail=...)   # 429 正确抛出
    result_text = (
        "fallback_analysis\n"          # ← 第二条占位路径
        + f"error={msg}\n"
        + f"session_id={int(session_id)}\n"
        + f"analysis_type={analysis_type}\n"
    ).strip()
# ...
analysis = GroupDiscussionAnalysis(..., result_text=result_text)
db.add(analysis)          # ← 同样入库
await db.commit()
```

与 `debug_stub` 的区别：

| | `debug_stub:` | `fallback_analysis` |
|---|---|---|
| 触发条件 | 凭证缺失/未配置 | 调用**抛异常**（非 429）|
| 位置 | `chat_blocking.py` | `analysis_service.py` |
| 是否入库 | 是 | **是** |
| 是否可被检测 | 有固定前缀 | 有固定前缀 |

**⇒ 修复时必须两条路径一起处理**，否则只堵一条，
另一条仍会把"失败"伪装成"分析结果"。

实测该前缀当前命中数：**0 行**。

**解决方案**

*最小改动（推荐）*

1. **让 stub 无法进入持久化路径** —— 调用方判断返回值前缀，
   若为 `debug_stub:` 则**不写库**，改为抛出明确错误：

```python
result_text = await run_agent_chat_blocking(db, ...)
if result_text.startswith("debug_stub:"):
    raise RuntimeError("agent_not_configured: 智能体未配置，拒绝写入占位数据")
```

2. **收紧 stub 的触发条件**（同时解决 C-3）——
   不要用"缺配置"当作"调试模式"的判据。建议：
   - 显式开关：`settings.AGENT_DEBUG_STUB`（默认 `False`）
   - 且 `allow_stub` 不得在 `REACT_APP_ENV` 非 production 时**自动**为真

3. **清理存量污染**：

```sql
-- 先统计（只读）
SELECT count(*) FROM group_discussion_analyses WHERE result_text LIKE 'debug_stub:%';
```

确认后可标记或删除（**需人工确认范围与回滚策略**）。

**验证方式**

```bash
# ① 静态：确认 stub 不再直通持久化
grep -n "debug_stub" backend/app/services/agents/ -r

# ② 动态：DEBUG 下用未配置的智能体发起分析
#    期望：接口返回明确错误，且数据库中无新增含 debug_stub 的记录
```

---
## 四、P1 重要（9 项）

---

### 4.1 P1-1 `cleanup_orphans` 缺少**安全的孤儿回收路径**

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P1（**P0-1 的根本机制**）|
| **状态** | 🔴 仍存在（**但性质已重新定性**）|
| 置信度 | **高（代码级 + 测试级确认）** |

> **⚠️ 第十七轮重要更正 —— 性质重新定性**
>
> 原文把这里描述为"**逻辑缺陷**"、"**双重失败**"，暗示 `owns()` 的比较写错了。
> **这个定性是错的，而且危险** —— 按原文思路去"修复比较"会**引入安全漏洞**。
>
> 复核发现：容器被保留是 **刻意的 fail-closed 安全设计**，
> 由 **20+ 个对抗性测试**保障。详见第十三章 13.2。
>
> **正确的问题陈述**：不是"校验写错了"，而是
> **"用`owns()`去回收孤儿"这个设计本身不成立** ——
> 孤儿**定义上就没有合法 owner**，让一个"证明所有权"的函数去处理"已知无主"的对象是范畴错误。
> 真正缺的是**另一条**受审计的回收路径。

**现状（证据 —— 本版实测）**

`backend/app/tasks/pythonlab.py:481`：

```python
fake_meta = {"owner_user_id": user_id}
await provider.terminate_session("orphan", fake_meta)   # ← 字面量 "orphan"
```

`backend/app/core/sandbox/docker_runtime.py:264-271`：

```python
def owns(self, record, session_id, meta):
    return bool(
        record and record.get('phase') == 'live'
        and record.get('session_id') == session_id          # ← == "orphan" 恒 False
        and record.get('token') == meta.get('sandbox_owner_token')   # ← fake_meta 无此键
        and record.get('container_id') == meta.get('docker_container_id')  # ← 无此键
    )
```

**这里有两个层面，必须区分开：**

**层面 A —— `owns()` 拒绝，是**正确**的安全行为（不是缺陷）**

复核发现该行为有明确的测试保障。
`backend/tests/pythonlab/test_sandbox_ownership_closure.py` 文件头写道：

```
"""Offline ownership counterexamples, not worker/Redis/Docker E2E evidence."""
```

其中的测试名直接体现了**安全设计意图**：

| 测试 | 断言的安全属性 |
|---|---|
| `test_mutable_workspace_metadata_is_not_delete_authority` | 可变的元数据**不构成**删除授权 |
| `test_tokenless_stop_retains_legacy_and_current_generations` | 无 token 时**保留**容器 |
| `test_writable_legacy_meta_cannot_authorize_external_container` | 伪造 meta **不能**授权删除外部容器 |
| `test_caller_workspace_path_cannot_redirect_deletion` | 调用方路径**不能**重定向删除目标 |
| `test_counterexample_id_only_compensation_would_delete_new_adopter` | 仅凭 ID 的补偿**会误删**新接入者 |
| `test_cleanup_orphans_fake_meta_retains_resources` | fake_meta 场景**保留**资源 |

最后一条尤其关键，它显式断言：

```python
result = tasks.cleanup_orphans.apply(throw=False)
assert result.state == 'SUCCESS'  # Scheduler success is NOT resource recovery.
client.scard.assert_awaited_once()
assert live_ids == before_ids                    # ← 容器被保留（预期行为）
assert not any(c[1] in {'rm', 'exec'} for c in calls)   # ← 未发出删除命令
```

注释 **"Scheduler success is NOT resource recovery"** 说明这是**有意为之**：
任务"成功"不等于"资源被回收"。

> **为什么这是对的**：误删一个**正在被其他用户使用**的容器，
> 比泄漏一个孤儿容器**严重得多**。所以宁可保留。
> 若按原文"修复比较"使其通过，就等于**打开了误删活跃会话的通道**。

**层面 B —— 真正的缺口（这才是问题所在）**

`cleanup_orphans` 的代码注释表达了**正确意图**：

```python
if count > 0:
    continue          # 还有会话 → 保留
# No sessions, terminate container      ← 意图：无会话则回收
fake_meta = {"owner_user_id": user_id}
await provider.terminate_session("orphan", fake_meta)   # ← 但机制做不到
```

**意图与机制不匹配**：注释说"无会话则回收"，但调用的是**带所有权校验**的
`terminate_session`，而孤儿不可能通过该校验。

**⇒ 正确的问题陈述**：
不是"`owns()` 写错了"，而是
**"系统缺少一条针对**已证实无主**容器的、受审计的回收路径"**。

**解决方案**

| 方案 | 操作 | 评价 |
|---|---|---|
| **① 受限回收路径（推荐）** | 在 `cleanup_orphans` 走**独立**的回收函数，不经过 `owns()`；条件收紧为"无 Redis 关联 **且** 空闲 > N×TTL **且** 写审计日志" | 语义正确：孤儿**本来就没有**合法 owner，用 owner 校验去回收它本身是矛盾 |
| ② 伪造完整 meta | 传入真实的 `sandbox_owner_token` / `docker_container_id` | 需要从容器 label 反查，复杂度高 |

**推荐①**，并在函数上明确注释：

```python
async def terminate_orphan(provider, user_id, container_id):
    """回收已确认的孤儿容器。

    孤儿没有 session 关联，因此**不能**复用 terminate_session 的
    owns() 所有权校验 —— 该校验的前提（有合法 session）在孤儿场景下不成立。
    本函数以"无 Redis 关联 + 超时"为唯一判据，并强制记审计日志。
    """
```

**验证方式**

```bash
# 制造孤儿容器，触发任务，确认被回收
docker ps -a --filter 'label=wangsh.pythonlab.runtime-mode' | wc -l
# 期望：清理后孤儿数量归零
```

---

### 4.2 P1-2 数据库连接池是真实容量瓶颈

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1 |
| **状态** | 🔴 仍存在（**本版已量化确认**）|
| 置信度 | **高（配置级 + 数据库实测）** |

**现状（证据 —— 本版实测，含具体数字）**

配置（`backend/app/db/database.py:26-27`）：

```python
pool_size=settings.POSTGRES_MAX_CONNECTIONS,   # DEBUG=20 / 生产=50
max_overflow=settings.DB_MAX_OVERFLOW,         # DEBUG=10 / 生产=20
```

数据库实测（本版查询）：

```
PostgreSQL max_connections = 100
当前连接数                =  26
```

**⇒ 生产配置下，单个进程的连接上限 = 50 + 20 = 70 条。**

```
生产：1 个进程最多 70 条
      PostgreSQL 总上限 100 条
      → 留给其它所有服务：仅 30 条
          （Celery worker、pythonlab worker、typst worker、监控、运维连接）
```

**若后端有 2 个进程，理论上限就是 140 > 100** —— **必然耗尽**。

**根因（两个，第二个是命名陷阱）**

1. **池大小未按"总预算"分配** —— 每个进程都按"独自拥有整个数据库"来配置。
2. **⚠️ `POSTGRES_MAX_CONNECTIONS` 这个名字是误导性的**：
   它听起来像"PostgreSQL 允许的最大连接数"，**实际却当作本进程的 `pool_size`**。
   更糟的是它的生产默认值（50）**大于**真实 `max_connections`（100）的一半，
   让人误以为还留有余量。

**解决方案**

*第 1 步 —— 建立连接预算表（先算再改）*

按 `pool_size + max_overflow` 逐服务统计，总和必须 **< `max_connections`**（留 20% 余量）：

| 服务 | 进程数 | 单进程上限 | 小计 |
|---|---:|---:|---:|
| backend | ? | 70（当前） | ? |
| celery worker | ? | 70 | ? |
| pythonlab worker | ? | — | ? |
| typst worker | ? | — | ? |
| **目标** | | | **< 80** |

*第 2 步 —— 按预算下调并更名*

```python
# 建议：把配置名改为表达其真实含义，并给生产一个保守值
DB_POOL_SIZE:  int = Field(default=5)     # 单进程池大小
DB_MAX_OVERFLOW: int = Field(default=5)   # 单进程溢出上限
```

> 生产环境若确需 50 的池，必须有配套的 `max_connections` 提升
> **并**确认进程数 —— 二者必须一起算。

*第 3 步 —— 探针拆独立连接*（见 C-6）

**验证方式**

```bash
# 修改前后对比峰值
docker exec wangsh-backend python -c "
import asyncio,sys; sys.path.insert(0,'/app')
from app.db.database import AsyncSessionLocal
from sqlalchemy import text
async def m():
    async with AsyncSessionLocal() as s:
        print('max_connections =', (await s.execute(text('SHOW max_connections'))).scalar())
        print('current =', (await s.execute(text('SELECT count(*) FROM pg_stat_activity'))).scalar())
asyncio.run(m())"
# 压测到目标并发，确认无 "QueuePool limit ... overflow" 错误
```

---

### 4.3 P1-3 可观测性组件耦合关键路径

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1 |
| **状态** | 🔴 仍存在（**本版已定位到具体代码**）|
| 置信度 | **高（代码级确认）** |

**现状（证据 —— 本版实测）**

`backend/main.py:113` 的 `HttpMetricsMiddleware` 是一个
**全局 `BaseHTTPMiddleware`**，在**每个请求**上执行 Redis 操作：

```python
class HttpMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # 只豁免健康检查/文档等少量路径
        if path in {"/health", f"{API_V1_STR}/health", "/ping", "/docs", ...}:
            return await call_next(request)
        ...
        client = await cache.get_client()          # ← Redis 往返 ①
        await client.incr("http:req:inflight")     # ← Redis 往返 ②
        ...
        await client.decr("http:req:inflight")     # ← Redis 往返 ③（finally）
        tmp = await cache.get_client()             # ← ④
        client = client or await cache.get_client() # ← ⑤
```

**实测：该中间件在单次请求路径上有 5 个 `await`（Redis）点位**
（原文写"4 次"，实测为 **5 个点位**，具体执行几个取决于分支）。

**根因**：指标写入与业务逻辑**同步**执行，且在**最外层的全局中间件**里 ——
即**每一个 API 请求（含静态资源之外的任何路径）都要先付这个成本**。

**补充（本版核实为正面的部分）**：
该中间件**已有良好的降级设计** —— Redis 不可用时
`except Exception` 捕获并**限频告警**（同类告警 60 秒内只打一次），不会拖垮请求。
所以问题的性质是**常态性能开销**，而非"Redis 抖动就雪崩"。

**解决方案**

按**代价从低到高**：

1. **采样**（最简单、立刻见效）：只对 N% 请求或**慢请求**记指标
2. **合并往返**：把 `get_client` 的多次调用复用同一个 client；
   把 `incr`/`decr` 用 pipeline 合并为 1 次往返
3. **移出请求路径**：由独立采集器读 Redis，而非请求内写

> 推荐 **① + ②** 组合：① 立刻降低开销，② 是**纯优化**且风险低
> （`get_client()` 被调用多次是明显的可优化点）。
> ③ 改动最大，收益边际递减，可暂缓。

**验证方式**：对比改动前后同一接口的 P95 延迟；确认指标仍能正确采集。

---

### 4.4 P1-4 Admin 统计条对比度 4.45:1

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1（**WCAG AA 违规**）|
| **状态** | 🔴 仍存在（本版浏览器实测确认）|
| 置信度 | **高（真实浏览器测量）** |

**现状（证据）**

`text-tertiary` = `#64748B` 在 `surface-2` = `#F4F8F9` 上 = **4.4510:1**（< AA 4.5:1）。

浏览器实测 **10 处违规**，横跨 3 条路由：

| 路由 | 处数 | 违规文本 |
|---|---|---|
| `/admin` | 4 | 用户总数、文章总数、服务检查 |
| `/admin/users` | 6 | 用户、激活 |
| `/admin/agent-data` | 3 | 共 10 条 |

均为 `rgb(100,116,139)` on `rgb(244,248,249)` @13.8px。

> **放大效应**：`#64748B` 被 **9 个 token 共用**
> （`text-tertiary`、`text-placeholder`、`interaction-disabled-text`、`chart-axis`、
> `diagram-node-border`、`diagram-note-border`、`editor-line-number`、
> `editor-diff-unchanged`、`editor-syntax-comment`），
> 改一处会影响 9 个语义位 —— **必须区分对待**。

**根因**

不是"某个 token 选错了色"，而是**门禁的对比度矩阵漏测了这个背景**（见 U-1）。

**解决方案**

| 方案 | 操作 | 评价 |
|---|---|---|
| **① 局部换 token（推荐）** | 仅把"统计条"这类**小字号正文**从 `text-tertiary` 改为 `text-text-secondary`（`#475569`，对比度充足）| 改动面最小；**不动 9 个共用位的语义** |
| ② 加深 `#64748B` | 全局调整该色值 | 影响 9 个 token 与图表/编辑器，**风险大** |
| ③ 换底 | 统计条改用更浅背景 | 可能破坏视觉层次 |

**推荐①**，并同步做 U-1（把 `surface-2` 纳入对比度矩阵），防止未来复发。

**验证方式**

```bash
# 浏览器实测：取元素计算色与背景色，算对比度
# 期望 ≥ 4.5:1
cd frontend && npm run -s ui:token-values:ci   # 待 U-1 修复后应能覆盖此背景
```

---

### 4.5 P1-5 复选框触控目标 15×15px

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1 |
| **状态** | 🔴 仍存在 |
| 置信度 | 高（浏览器几何实测）|

**现状**：复选框实际可点区域 **15×15px**，低于 WCAG 2.5.8 的 **24×24px** 最低要求。

**根因**：组件尺寸按视觉设计定，未考虑触控热区。

**解决方案 —— 视觉不变，只扩热区**

用伪元素外扩（**不改变视觉尺寸、不影响布局**）：

```css
.checkbox-wrapper { position: relative; }
.checkbox-wrapper::after {
  content: "";
  position: absolute;
  inset: -5px;              /* 15 + 5×2 = 25px ≥ 24px */
}
```

> 优于直接放大控件：**布局零变化、视觉零变化**，只增加可点区域。

**验证方式**：实测热区 ≥24×24px；确认不遮挡相邻元素、不改变现有布局。

---

### 4.6 P1-6 登录限流强度偏弱

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1（安全）|
| **状态** | 🔴 仍存在 |
| 置信度 | 中高 |

**现状**：限流窗口 **2 秒**，且**无失败计数、无账户锁定**。
2 秒窗口意味着攻击者可长期以低速率持续爆破（如每分钟 30 次）。

**根因**：限流只做了"速率限制"，没做"失败累计"。

**解决方案（三层，逐层加严）**

| 层 | 规则 | 作用 |
|---|---|---|
| ① 失败计数 | 同账户 15 分钟内失败 N 次 → 指数退避 | 挡住慢速爆破 |
| ② 账户锁定 | 连续失败 M 次 → 临时锁定（**带自动解锁**）| 挡住定向爆破 |
| ③ IP 维度 | 同 IP 跨账户失败 → 限流 | 挡住撞库 |

> **必须同时提供解锁路径**（时间自动解锁即可），否则会变成拒绝服务。
> 优先做 ①，改动最小且效果最明显。

**验证方式**：脚本模拟连续失败登录，确认触发退避/锁定，且正常用户解锁后可登录。

---

### 4.7 P1-7 无活跃会话管理界面

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1 |
| **状态** | 🔴 仍存在 |
| 置信度 | 高 |

**现状**：不存在"查看/踢出我的活跃会话"界面。用户无法自查异常登录。

**根因**：功能缺失。

**解决方案**

复用项目既有表格模式新增一个页面：

- 组件：`AdminPage` + `AdminTablePanel` + `DataTable`（**项目已有约定，勿自创**）
- 数据：复用后端已有的会话存储（登录时已维护）
- 操作：单个"踢出" + "全部踢出"
- 入口：用户菜单 → 安全设置

> 后端登录已维护会话记录，**大概率不需要新增表**，先确认现有结构。

**验证方式**：登录多端 → 页面上能看到全部会话 → 踢出后对应端失效。

---

### 4.8 P1-8 索引漂移 —— ⚠️ **证据撤销 / 大幅降级**

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 降级（**原 🟠 P1**）|
| **状态** | ⚠️ **历史证据已撤销**；当前生产库实测**无业务漂移** |
| 置信度 | 高（全量回放 + 逐名 diff）|

> **⚠️ 第十八轮复核结论：本项的历史证据不成立，大幅降级。**
> 详见第十四章 14.A.3。核心反证：
> ① 48 个迁移全量回放 = **215 索引**；当前生产库 = **214**，逐名 diff **missing=1 / extra=0**，
> 且唯一"缺失"是 `alembic_version_pkc` —— alembic **记账表**的 PK 索引伪影，**非业务漂移**。
> ② 原文"决定性证据"（生产 Seq Scan vs 回放 Index Scan）**不成立**：
> 该索引在生产库**已存在**，计划差异由**表行数**驱动（生产 sys_users 65 行 vs 回放 0 行），
> `SET enable_seqscan=off` 后生产立刻走 Index Scan。
> ③ "15 缺失 / 8 多余"在当前生产库**无法复现**。

**保留的**：`alembic_version_pkc` 差异本身是个无害的伪影（不影响任何查询），
可按需补一个迁移消除；**不再作为 P1 问题跟踪**。

**解决方案**

```bash
# ① 以生产库为准导出实际索引
docker exec wangsh-postgres pg_dump --schema-only -U postgres <db> > /tmp/prod_schema.sql

# ② 与 alembic 迁移推导的期望结构对账
cd backend && alembic upgrade head --sql > /tmp/expected_schema.sql

# ③ 差异逐条判断：
#    生产多出的 → 写新迁移补进来（或确认可删）
#    迁移多出的 → 说明未执行，检查部署流程
```

> **原则**：Alembic 是**唯一真源**。任何手工 SQL 索引都必须转成迁移。

**验证方式**：对账后差异为 0；`alembic upgrade head` 在干净库上能重建出等价结构。

---

### 4.9 P1-9 SSE 容量 + 连接池饱和

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1 |
| **状态** | 🟡 部分修复 |
| 置信度 | 中高 |

**现状**：客户端重连已修复；**服务端并发连接上限未定**。

**根因**：SSE 长连接与请求池共享资源；`connect-src` CSP 与 `wss:` 的配置需与 P0-5 一起复核。

**解决方案**

1. 明确 SSE 服务端**最大并发连接数**并按实测设限（超出时拒绝而非静默排队）
2. SSE 连接**不占用**业务连接池（与 C-6 同一原则）
3. 心跳保活，及时回收死连接

**验证方式**：压测到 N 个并发 SSE 连接，确认无池耗尽、无请求饥饿。

---

## 五、P2 改进（7 项）

---

### 5.1 P2-1 token 死数据 — 🟢 已修复

已删除 **1880 行**（1491 撤销且过期 + 375 仅撤销 + 14 仅过期），保留 1 个活跃 token。
登录验证正常。**无需进一步动作。**

---

### 5.2 P2-2 归档任务从未执行

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 P2 |
| **状态** | 🔴 仍存在 |
| 置信度 | 高 |

**现状**：归档任务从未产出任何归档结果。

**根因**：**不是任务写错了，而是根本没有进程触发它** —— 见 **C-5（Celery Beat 从未启动）**。

**解决方案**：**先修 C-5**，本项自动解决。修复后确认首次归档产出。

**验证方式**：修 C-5 后观察一个完整周期，确认归档表有新记录。

---

### 5.3 P2-3 沙箱启动慢 4.1×

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 P2 |
| **状态** | 🔴 仍存在 |
| 置信度 | 高（实测计时）|

**现状**：沙箱启动 **0.330–0.390s** vs 后端 **0.091–0.093s**，约 **4.1×**。

**根因**：每次冷启动创建容器 + 拉取/初始化运行环境。

**解决方案**

1. **容器预热池**（最有效）：维持 N 个空闲容器，用时直接取（代价：常驻内存）
2. **镜像预拉**：确保镜像已在本地，消除拉取时间
3. **降低启动步骤**：确认没有可并行的初始化被串行执行

> 若目标是**交互式调试体验**，推荐①；若只是偶尔启动，②成本更低。

**验证方式**：重复测量启动耗时，目标降低至 2× 以内。

---

### 5.4 P2-4 首屏 CDN 依赖抵消懒加载收益

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 P2 |
| **状态** | 🔴 仍存在 |
| 置信度 | 高 |

**现状**：首屏需加载 9 个 CDN 脚本，阻塞渲染，抵消了代码分割的收益。

**解决方案**：**与 P0-5 / P0-6 合并处理** —— 自托管后可以对这些脚本
实施 `defer`/`async` 与按需加载，一并解决三个问题。

**验证方式**：构建产物分析 + 首屏加载时间对比。

---

### 5.5 P2-5 测评路由"重复入口" — ⚪ 已撤销

经多轮复核确认：这是**兼容性重定向**（旧路径指向新路径），**不是缺陷**。

> 撤销理由：初判只看了路由表存在两个入口，未核对其实现是 redirect。
> 这是"静态读码而未验证运行时行为"导致的误判，已记入第十二章。

---

### 5.6 P2-6 前端测试分布严重倾斜

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 P2 |
| **状态** | 🔴 仍存在 |
| 置信度 | 高（统计）|

**现状**：测试覆盖集中在少数模块，核心链路覆盖不足。

**解决方案 —— 按风险补测，不追求数字均衡**

优先级：

1. **核心教学链路**（PythonLab 调试、测评提交、AI 对话）
2. **权限边界**（与 P0-4 呼应）
3. **数据写入路径**（与 P0-7 呼应）

> 不要为了"覆盖率好看"给简单组件补测试 —— 那是另一种形式的技术债。

**验证方式**：新增用例确实覆盖上述三类场景中的具体缺陷。

---

### 5.7 P2-7 `session_id` 查询 —— ⚪ **已撤销（误判）**

| 字段 | 值 |
|---|---|
| 严重度 | — |
| **状态** | ⚪ **已撤销** |
| 置信度 | **高（代码级确认撤销）** |

> **⚠️ 第十七轮复核结论：本项为误判，予以撤销。**

**原判定**：`GET /admin/messages?session_id=99999` → 200，判定为"越权查询"。

**证伪过程（本版实测）**

核查两个端点的**鉴权与查询范围**：

| 端点 | 鉴权 | 查询范围 | 判定 |
|---|---|---|---|
| `/conversations/{session_id}`（学生/用户） | `require_registered_user` | `WHERE user_id = :user_id AND session_id = :session_id` | ✅ **正确限定归属** |
| `/admin/conversations/{session_id}`（管理） | `require_admin` | `WHERE session_id = :session_id` | ✅ **管理员按设计可见全部会话** |

关键代码（`backend/app/services/agents/agent_conversations.py`）：

```python
# 用户端点：正确过滤 owner
WHERE user_id = :user_id
  AND session_id = :session_id

# 管理端点：不按 owner 过滤 —— 这是管理功能的定义
WHERE session_id = :session_id
```

**⇒ 不构成越权，原因有二：**

1. **该端点是管理员专用**。管理员**本来就应该**能查看任意会话 ——
   这正是"会话管理"功能的意义。不按 owner 过滤**不是缺陷，是需求**。
2. **""不存在的 session_id 返回 `200 []`""不是鉴权失败** ——
   它只是"查询结果为空"，返回空列表**语义正确**。返回 200 不泄露任何信息
   （攻击者无法区分"不存在"与"存在但无消息"）。

**原判定的错误来源**：只观察到"没有按 user_id 过滤"，
**未核对端点的鉴权级别**（是否 admin-only），也未区分
"越权访问他人数据"与"管理员按权限访问"。

**教训**：判定越权类问题，**必须先确认鉴权边界**，
再判断是否缺少归属过滤 —— 否则会把"按设计工作"当成漏洞。

**无需修复。** 若产品上希望管理端点也更严格（例如仅允许查看统计而非全文明细），
那属于**产品决策**，不是安全缺陷。

---
## 六、C 链式衍生问题（6 项）

> **编号变更说明**：C-1 ~ C-6 在此前版本中编号为 `N-1` ~ `N-6`，
> 与第七章 UI 专项**共用同一编号空间**（12 个定义争 6 个编号）。
> 本版把 UI 侧改为 `U-9` ~ `U-14`，`C-*` 专供链式衍生。详见第十二章 12.3。

---

### 6.1 C-1 P0-2 与 P0-7 是同一条因果链

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 高（严重度升级）|
| **状态** | 🔴 仍存在 |

**推演**

```
密钥解密失败 (P0-2)
   ↓ 触发
allow_stub 判定为真（因为 api_key 为空）
   ↓
返回 "debug_stub: …" 假数据 (P0-7)
   ↓
调用方写库 → 数据污染
```

**关键结论**：这两个问题**不是独立的**，而是**同一根因的两种表象**。

**解决方案**：**合并修复**。修好密钥（P0-2）能让 stub 不再触发；
但**必须同时**做 P0-7 的"禁止 stub 入库"，否则下次任何配置缺失都会重现数据污染。

> 只修 P0-2 是治标 —— 一旦有智能体未配置，污染立刻重来。

---

### 6.2 C-2 `/test` 与对话路径行为不一致

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 中（**方向已更正**）|
| **状态** | 🔴 仍存在（但"掩盖方向"与原文相反）|

> **⚠️ 第十七轮更正**：原文说"`/test` 掩盖故障"。
> 复核后**方向相反** —— `/test` 实际上是**更诚实**的那条路径。详见第十三章 13.4。

**现状（证据 —— 本版实测）**

两条路径确实**是不同实现**：

| | `/test` 路径 | 对话路径 |
|---|---|---|
| 解析凭证 | `_resolved_agent_api_key()` | `resolve_credentials()` |
| 凭证回退链 | 解密 → 明文 `api_key` → OPENROUTER | 解密/明文 → OPENROUTER |
| **凭证缺失时** | **发起真实 HTTP 调用并返回真实错误** | **返回 `debug_stub:` 假成功** |

**关键更正**：两个凭证解析函数的回退链**实质等价**
（都尝试解密，失败后落到明文，再落到 OPENROUTER），
**不存在"一个严一个松"的差异**。

真正的差异在于**凭证缺失后的行为**：

- `/test` → 真的去调用上游 → 上游返回 401 → **如实报错**（**诚实**）
- 对话 → 命中 stub 分支 → **返回假成功**（**不诚实**）

**⇒ 所以"掩盖故障"的是**对话路径（P0-7）**，不是 `/test`。**

**修正后的问题陈述**

问题不在于"`/test` 不可信"，而在于：

1. **两条路径是独立实现**，因此 `/test` 通过**不能证明**对话可用
   （它们可能因任意其它差异而分叉）—— 这仍是真实风险
2. **面向终端用户的是不诚实的那条**：学生/教师看到的是假成功，
   而只有管理员主动跑 `/test` 才能看到真相

**解决方案**（比原文更精准）

| 方案 | 操作 |
|---|---|
| **① 统一凭证与失败语义（推荐）** | 抽出**单一**的"调用上游"函数，两条路径共用；保证"凭证缺失"在两条路径都表现为**明确错误**而不是 stub |
| ② 让 `/test` 覆盖对话路径的关键分支 | 至少让 `/test` 显式报告"是否会命中 stub"，避免管理员被误导 |

> ① 与 P0-7 的修复是**同一件事** —— 修好 P0-7 后，
> 对话路径也不再假成功，两条路径的差异自然收敛。

**验证方式**

构造一个"凭证缺失"的智能体，分别调用两条路径：

```bash
# 期望：两条路径都以明确错误结束，都不产生 "debug_stub:" 结果
```

---

### 6.3 C-3 stub 触发条件包含 `model_name` 为空

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 中 |
| **状态** | 🔴 仍存在 |

**现状**（`chat_blocking.py:64-66`）：stub 触发条件之一是非 dify 类型智能体的
`model_name` 为空 —— **"配置缺失"被当成了"调试模式"**。

**解决方案**：用**显式开关**替代隐式推断：

```python
allow_stub = bool(getattr(settings, "AGENT_DEBUG_STUB", False))
```

配置缺失应当是**明确报错**，而不是返回假数据。

---

### 6.4 C-4 `try_decrypt_api_key` 多处共用

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 中 |
| **状态** | 🔴 仍存在 |

**现状**：解密函数被多处调用，**密钥轮换影响面大**。

**解决方案**：收敛到**单一入口**（已经是，但需确认调用点全部经此），
并在轮换流程中**先评估所有调用点**。

> 这条与 §3.2 的密钥修复直接相关 —— 选方案③（写迁移脚本）时必须先看此条。

---

### 6.5 C-5 Celery Beat 从未启动

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 高（**影响所有周期任务**）|
| **状态** | 🔴 仍存在 |
| 置信度 | 高 |

**现状（证据）**

`beat_schedule` 定义了 **4 个周期任务**，但**没有任何进程运行 Celery Beat**。

**根因**：`docker-compose` 只有 `worker`，**没有 `beat` 服务**。

**影响**：所有 `crontab` 类周期任务**从未执行过**（P2-2 即其一）。

**解决方案 —— 最简单且可靠**

在 compose 中增加一个 beat 服务：

```yaml
  celery-beat:
    <<: *backend-common
    command: celery -A app.core.celery_app beat --loglevel=info
    restart: unless-stopped
```

> **注意**：Beat **必须有且仅有一个实例**（多实例会导致任务重复调度）。
> 生产环境应使用 `--scheduler` 持久化调度，避免重启丢失。

**验证方式**

```bash
docker compose ps | grep beat
docker compose logs celery-beat | grep -i "scheduler"
# 观察一个完整周期，确认周期任务实际执行
```

---

### 6.6 C-6 健康检查探针与业务共用连接池

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 中 |
| **状态** | 🔴 仍存在 |

**现状**：健康检查探针与业务请求**共用同一连接池**。

**危害**：高负载时健康检查会抢占业务连接，甚至**因池耗尽而误报不健康** →
编排器重启容器 → **雪崩**。

**解决方案**：探针使用**独立的轻量连接**（或独立的只读连接池），
并让探针逻辑尽量不查库（如只检查进程存活 + 一个极轻量查询）。

**验证方式**：压满业务池，确认健康检查仍返回 200。

---

## 七、UI / 设计系统专项（14 项）

---

### 7.1 U-1 对比度门禁结构性盲区

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P1（**P1-4 的漏检根因**）|
| **状态** | 🔴 仍存在（本版已实测确认）|
| 置信度 | **高** |

**现状（证据 —— 本版实测）**

`frontend/scripts/ui-token-values.mjs:219-225` 的 `SCENARIOS` 只测试两个背景：

```js
const SCENARIOS = {
  accent: [3],
  text: ["color_text_on_surface", "color_text_on_page_bg"],
  ...
}
```

实测结果：

| 背景 | 对比度 | 判定 |
|---|---|---|
| `#FFFFFF` | 4.7588 | ✅ 通过 |
| `#F8FBFC`（page bg）| 4.5766 | ✅ 通过 |
| **`#F4F8F9`（surface-2）** | **4.4510** | ❌ **但从未被测试** |

门禁打印 "**0 known contrast failure(s)**"。

**根因**：矩阵**漏了真实在用的背景**。不是算错了，是**没算**。

> **9 倍放大**：`#64748B` 被 9 个 token 共用，所以这一格漏测 = 9 个语义位全部失守。

**解决方案**

```js
// ui-token-values.mjs —— 把真实在用的背景全部纳入
const SURFACE_BACKGROUNDS = [
  "color_surface",          // #FFFFFF
  "color_page_bg",          // #F8FBFC
  "color_surface_2",        // #F4F8F9  ← 新增
  "color_primary_muted",    // 柔色底
];
```

> **根本改进**：背景列表不应**手工维护**，而应从 `index.css` 的
> surface 类 token 自动派生，避免再次漏格。

**验证方式**

```bash
cd frontend && npm run -s ui:token-values:ci
# 修复后：应当报出真实失败（而不是 0 failures）
# 修完 P1-4 后：应当回到 0 failures（这次是真的）
```

---

### 7.2 U-2 `ui-verify-gate` 可被伪造报告通过

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P1 |
| **状态** | 🔴 仍存在 |
| 置信度 | 高 |

**现状**：`ui-verify-gate.mjs:33` 的 `BROWSER_FIELDS` 包含 `screenshot_sha256`，
但 `:78` **只检查字段是否存在**，不校验值。

实测：构造一份 `screenshot_sha256` 全为 0、**且截图文件根本不存在**的报告 → 门禁**通过**。

**根因**：校验的是**格式**而非**实质**。

**解决方案**

```js
// ① 哈希不得为空/全零
if (!/^[a-f0-9]{64}$/.test(v) || /^0+$/.test(v)) fail(...);

// ② 截图文件必须真实存在且非空
if (!fs.existsSync(screenshotPath) || fs.statSync(screenshotPath).size === 0) fail(...);

// ③ 校验哈希与文件内容一致（最关键）
const actual = sha256(fs.readFileSync(screenshotPath));
if (actual !== report.screenshot_sha256) fail(...);
```

**验证方式**：用伪造报告跑门禁，期望 **exit≠0**；用真实报告跑，期望 exit 0。

---

### 7.3 U-3 基线缺键导致 fail-open

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P1 |
| **状态** | 🔴 仍存在（本版已实测确认）|
| 置信度 | **高** |

**现状（证据 —— 本版实测）**

`ui-spacing-metrics.mjs` 的 ratchet 比较：

```js
cmp(label, actual, expected)   // expected 来自基线
```

当基线**缺少某个键**时 `expected === undefined`：

```js
1386 > undefined   // → false
1386 < undefined   // → false
```

**两个方向都是 false** → problems 为空 → **门禁通过**。

实测：删除基线中的键后跑 `--ci` → **EXIT=0**，打印 "gate passed (ratchet exact)"，
**尽管 1386 > 1382**。

**根因**：JS 的 `undefined` 比较语义 —— 不是"没比较"，而是**比较结果恒为 false**。

**解决方案**

```js
function cmp(label, actual, expected) {
  if (typeof expected !== "number") {
    problems.push(`${label}: baseline key missing (expected a number, got ${typeof expected})`);
    return;                        // ← 缺键即失败，绝不静默跳过
  }
  ...
}
```

**对照**：`ui-migration-metrics.mjs:120-133` 的写法是**正确**的：

```js
const base = typeof b[k] === "number" ? b[k] : 0;   // ✅ 有兜底
```

建议**统一采用此范式**。

**验证方式**：删掉基线一个键 → 门禁必须 **exit≠0**（对照：`ui-audit` 已正确，exit=2）。

---

### 7.4 U-4 触控目标 <24px — 🟡 部分修复

与 **P1-5** 同一问题（复选框 15×15px），解法见 §4.5。
扩展面还包括图标按钮，需一并核查。

---

### 7.5 U-5 同色系 alpha chip 对比度不足 — 🟡 部分修复

**现状**：同色系低透明度底纹上的文字，对比度不足。

**解决方案**：提高底纹不透明度（如 `18` → `33`），或改用"浅底+深字"的
两 token 组合而非 alpha 叠加。

---

### 7.6 U-6 门禁强度不足

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P1 |
| **状态** | 🔴 仍存在 |

**现状**：多个门禁的校验停留在"字段存在性"层面（见 U-2），
或只守**单个键**（见 U-3）。

**解决方案**：见 U-2 / U-3 的具体补丁；统一原则是
**"宁可报错，不可静默通过"** —— 任何无法比较的情况都必须视为失败。

---

### 7.7 U-7 告警疲劳：`ui:spacing:ci` 已红 4 天

| 字段 | 值 |
|---|---|
| 严重度 | 🔴 P1（**元问题**）|
| **状态** | 🔴 仍存在 |

**现状**：`ui:spacing:ci` 自基线构建（2026-10-05）起持续为红，
**4 天无人处理**。

**危害**：长期为红的门禁 ≈ 没有门禁。团队成员会习惯性忽略它，
真实回归（如本次的 +4）**混在长期红灯里无法被识别**。

**解决方案（二选一，必须明确）**

| 选项 | 操作 | 适用 |
|---|---|---|
| **A. 收口** | 修掉 +4，让门禁回绿 | 债务可控时（**推荐**，本次仅 +4）|
| B. 明确豁免 | 若确定不修，就把该门禁从 CI 移除并记录理由 | 债务不可控时 |

> **最坏的选择是维持现状** —— 既红着又不处理。

---

### 7.8 U-8 无 skip link

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 P2 |
| **状态** | 🔴 仍存在 |

**现状**：键盘用户必须 Tab **穿过整个导航**才能到主内容。

**解决方案**（标准做法，约 10 行）：

```tsx
<a href="#main-content"
   className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 …">
  跳到主内容
</a>
// 并在主内容容器加 id="main-content"
```

---

### 7.9 U-9 首页大面积留白 + 版本号 `v–`

> **⚠️ 第十九轮浏览器实测更正**：部署中的镜像（09-28 构建）**显示 v2.1.3 正确**；
> `v–` 是**当前仓库代码重建后**的风险。详见 §15.1.2 / §15.4。

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1（**根因已更正**；症状仅在重建后出现）|
| **状态** | 🔴 仍存在（本版实测）|
| 置信度 | 高（代码级确认）|

> **⚠️ 第十七轮更正**：原文的根因分析（"接口 `/api/v1/home/stats` 返回 404 → version 为 undefined"）**是错的**。
> 版本号**根本不来自任何 HTTP 接口**。详见第十三章 13.3。

**现状（证据 —— 本版实测）**

- 首页约 **70% 为空白**（待独立确认，见下）
- `frontend/src/pages/Home/index.tsx:97` 版本号渲染为 **`v–`**：

```tsx
const { version } = useAppMeta();          // ← 来自本地配置，非 HTTP
...
<span className="max-w-full break-all text-text-tertiary text-xs">v{version}</span>
```

**真实根因（与原文不同）**

`frontend/src/hooks/useAppMeta.ts:9-13` —— **`v–` 是刻意设计的兜底**：

```ts
const normalizeVersion = (v?: string | null): string => {
  const s = String(v ?? "").trim();
  if (!s || s.toLowerCase() === "unknown") return "–";   // ← 有意返回 "–"
  return s;
};
```

并且该文件明确注释：

```ts
// Build metadata is public and identity-independent; never query privileged system APIs.
```

**⇒ 所以这里没有"接口 404"这回事**（`curl /api/v1/home/stats` 确实 404，
但**前端从未调用它**，二者无因果关系）。

**真正的原因是构建变量默认为空**：

`docker-compose.yml:346`：

```yaml
args:
  REACT_APP_VERSION: ${REACT_APP_VERSION:-}      # ← 默认展开为空字符串
```

而 `vite.config.ts:283` 把它写入构建：

```ts
"process.env.REACT_APP_VERSION": JSON.stringify(
  env.REACT_APP_VERSION || env.VITE_APP_VERSION || ""    // ← 空 → 空
)
```

**而 `package.json` 里明明有 `"version": "2.1.3"` —— 但它从未被接入构建。**

**⇒ 完整因果链**：

```
deployer 未设置 REACT_APP_VERSION
   ↓（compose 默认空）
vite define 注入空字符串
   ↓
config.version = ""
   ↓
normalizeVersion("") 命中兜底（**这是正确行为**）
   ↓
渲染 "v–"
```

**⇒ 结论：`normalizeVersion` 的兜底是**对的**，问题在于
"版本号应该总是可得"这个前提没有被满足** —— 依赖了一个默认为空的部署变量。

**解决方案 —— 让版本号不再依赖部署变量**

**推荐：在构建期从 `package.json` 读取版本**（单一真源，不可能忘记设置）：

```ts
// vite.config.ts
import pkg from "./package.json";
define: {
  "process.env.REACT_APP_VERSION": JSON.stringify(
    env.REACT_APP_VERSION || env.VITE_APP_VERSION || pkg.version   // ← 兜底到 package.json
  ),
}
```

这样：
- 默认情况下版本号自动正确（`2.1.3`）
- 部署方若确实要覆盖，仍可用环境变量
- **不改变 `normalizeVersion` 的兜底逻辑**（它本身是正确的）

**关于"首页 70% 留白"**：这与版本号是**两个独立问题**，
本版未取得足以定性的证据（需确认是设计如此、数据未加载、还是布局缺陷）。
**建议从本项拆出，单独核查后另行立项**，不要与版本号混为一谈。

**验证方式**

```bash
# 构建后检查注入值非空
cd frontend && npm run build && grep -ro 'v2\.1\.3' build/assets/*.js | head -1
# 浏览器中首页版本号应显示 "v2.1.3"（不再是 "v–"）
```

---

### 7.10 U-10 `/admin/users` chip 标签折行溢出

> **⚠️ 第十九轮浏览器实测更正**：部署镜像在 768/1440 两档**均不溢出**（实测 0 处）；
> 溢出是**当前仓库代码**（root 字号 clamp + 未提交改动）的表现。详见 §15.1.2。

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1（当前仓库代码风险；已部署镜像未复现）|
| **状态** | 🔴 仍存在（本版浏览器实测）|
| 置信度 | **高（几何实测）** |

**现状（证据 —— 本版实测）**

`frontend/src/pages/Admin/Users/index.tsx:157,161,166,174`：

```tsx
<span className="inline-flex items-center gap-1.5 rounded-md … h-9">
```

实测（768px 视口）：

```
标签文本:   12.2 × 39.1px
行高:       19.543px  → 39.1 / 19.543 = 2.00 行（正好两行）
chip 高度:  31.5px（h-9）
溢出:       +7.6px
```

1024px 与 1440px 同样溢出（+7.8 / +7.7）。

**根因**：**根字号被变量化** —— `index.css:455`：

```css
--ws-font-size-base: clamp(14px, calc(0.12vw + 13px), 15px);
```

导致 768→14.000px、1024→14.229px、1440→14.728px。
**CJK 标签在固定高度 `h-9` 的 chip 里折成两行**。

**解决方案（三选一，按推荐排序）**

| 方案 | 操作 | 评价 |
|---|---|---|
| **① `h-9` → `min-h-9`（推荐）** | 允许 chip 随内容增高 | **1 个词**，最小改动，彻底消除溢出 |
| ② 禁止折行 | 加 `whitespace-nowrap` | 可能造成横向溢出（更糟）|
| ③ 缩小字号 | 用 `text-2xs` | 与 P1-4 的对比度问题叠加，**不推荐** |

> **推荐①**：既解决溢出，又不牺牲可读性。

**验证方式**：在 768 / 1024 / 1440 三档实测 chip 高度 ≥ 文本高度，无裁切/溢出。

---

### 7.11 U-11 `AdminAppCard` 颜色拼接失败

| 字段 | 值 |
|---|---|
| 严重度 | 🟠 P1 |
| **状态** | 🔴 仍存在（本版实测确认）|
| 置信度 | **高** |

**现状（证据 —— 本版实测）**

`frontend/src/components/Admin/AdminAppCard.tsx:26`：

```tsx
style={{ color, background: `${color}18` }}
```

调用方 `frontend/src/pages/Admin/ITTechnology/index.tsx:41,43` 传入
`"var(--ws-tag-blue)"` → 拼成 `"var(--ws-tag-blue)18"` → **无效 CSS** → 渲染为 `rgba(0,0,0,0)`（透明）。

实测对比：

| 输入 | 背景解析结果 |
|---|---|
| `"var(--ws-tag-blue)18"` | `rgba(0, 0, 0, 0)` ❌ 透明 |
| `"#2563EB18"` | `rgba(37, 99, 235, 0.094)` ✅ 正常 |

已在 `/admin/it-technology` 实测到 **2 个元素**透明。

**根因**：**把 CSS 变量的字符串拼接当作颜色运算** —— 字符串拼接对 `var()` 无效。

**解决方案**

| 方案 | 操作 | 评价 |
|---|---|---|
| **① 现代 CSS（推荐）** | 用 `color-mix()`：`background: color-mix(in srgb, ${color} 10%, transparent)` | **对 `var()` 有效**，语义正确 |
| ② 传具体色值 | 调用方改传 `#2563EB` | 需改所有调用点，且违反"用 token"的约定 |
| ③ 独立 alpha token | 定义 `--ws-tag-blue-soft` | 最规范，但需新增 11 个 token |

> 推荐① —— 兼容目标浏览器（现代浏览器均支持 `color-mix()`），改动最小。

**验证方式**：`/admin/it-technology` 实测徽标背景**非透明**（alpha > 0）。

---

### 7.12 U-12 `ui:dead-layout:ci` 的"0 死类"是结构性保证

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 P2 |
| **状态** | 🔴 仍存在（本版已实测确认）|
| 置信度 | 高 |

**现状（证据 —— 本版实测）**

`frontend/scripts/dead-layout-classes.mjs`：

- `:37` `SCAN_ROOTS` 包含 `SRC`
- `:62` `filter((f) => f !== INDEX_CSS && …)` ← **排除了 index.css**
- `:87-94` 的命中统计方式

⇒ `index.css` 中定义的 34 个类**永远不会**被计入"死类"，
所以"**0 死类**"是**结构性保证**，不是检测结果。

实测：34 个类**全部有 >0 外部引用** → 当前"0 死类"**碰巧正确**，
但脚本无法发现真正的死类。

**解决方案**

- 让扫描包含 `index.css` 的**定义侧**（当前只看引用侧，且排除了定义文件本身）
- 或明确声明该门禁只覆盖"TSX 中的 Tailwind 类"，并在文档中写明**不覆盖 index.css**

**验证方式**：在 `index.css` 中人为加一个零引用类 → 门禁应能报出。

---

### 7.13 U-13 `SPACING.md` 文档漂移

| 字段 | 值 |
|---|---|
| 严重度 | 🟡 P2 |
| **状态** | 🔴 仍存在 |
| 置信度 | 高 |

**现状（证据 —— 本版实测）**

`frontend/src/styles/SPACING.md` 共 **541 行**，内容是**两份几乎完全相同的副本**：

```
副本 1: 第   1-275 行   （含 H1 标题）
副本 2: 第 276-541 行   （无 H1，其余同副本 1）
```

**冗余约 266 行**（占全文 49%）。

**关键发现：两份副本的唯一分歧点正是 §4.4** —— 这不是巧合，
而是**同一次编辑只改了其中一份**导致的：

```diff
副本1 §4.4 : "### 4.4 语义标题 / 文本 class（已于 2026-10-05 删除）"
             + 一整段说明：这 5 个 class 已删除、为何删除、清理清单

副本2 §4.4 : "### 4.4 语义标题 / 文本 class"
             + 把它们列成 css 代码块，看起来**仍然存在**
```

**⇒ 所以"重复"与"自相矛盾"是同一个缺陷的两种表现。**
读者读到副本 1 认为这些 class 已删除，读到副本 2 又以为它们在用。

**另有一项独立的数字过期**：第 157-159 行声称
"语义 82 / 数字 2737 / 迁移率 2.9%"，
实测为 **1166 / 1386 / 45.69%** —— **差一个数量级**。

**解决方案**

1. **先删副本 2**（保留含 H1 的副本 1，即第 1-275 行）
   —— 一次性消除重复**和**自相矛盾，约 **−266 行**
2. 确认保留的副本中 §4.4 的"已删除"表述与当前代码一致
3. **数字改为脚本生成** —— 手工维护的统计数字必然过期：

```bash
npm run -s ui:spacing   # 输出真实数字
# 把该输出注入文档的生成区块，而不是手抄
```

> **根因提醒**：这份文档是**手工维护**的，所以出现"改了一处忘另一处"。
> 若第 3 步不做，同样的漂移会再次发生。

**验证方式**

```bash
wc -l frontend/src/styles/SPACING.md        # 目标 ≈ 275 行（当前 541）
grep -c "^# " frontend/src/styles/SPACING.md # 目标 1（H1 只应有一处）
# 文档中数字与 npm run -s ui:spacing 输出一致
```

---

### 7.14 U-14 9 个 UI 门禁中 4 个绿灯不构成证据

见**第八章**逐门禁处置表。

---
## 八、门禁体系健康度总评

> 这是本文档**最有复用价值的一章**：它评估的不是某个 bug，而是"**我们凭什么相信门禁**"。

### 8.1 总览：9 个 UI 门禁中，4 个绿灯不构成证据

| 门禁 | 状态 | 绿灯是否可信 | 问题 |
|---|---|---|---|
| `ui:spacing:ci` | 🔴 红（4 天）| ❌ **不可信** | 基线缺键 **fail-open**（U-3）；且已红 4 天无人收口（U-7）|
| `ui:dead-layout:ci` | 🟢 绿 | ❌ **不可信** | "0 死类"是**结构性保证**（U-12）|
| `ui:token-values:ci` | 🟢 绿 | ❌ **不可信** | 对比度矩阵**漏测真实背景**（U-1）|
| `token:check:ci` | 🟢 绿 | ⚠️ **部分** | **只校验名字存在，完全不校验值** |
| `ui:verify:ci` | 🟢 绿 | ❌ **不可信** | 规则只校验字段**存在性**，可被伪造通过（U-2）|
| `ui:audit:ci` | 🔴 红 | ✅ **可信** | 有真实等式比较，双向报警（过松+回归）|
| `ui:migration:ci` | 🟢 绿 | ✅ **可信** | 有正确的缺失键兜底（`typeof … === "number" ? … : 0`）|
| `ui:alpha:ci` | 🟢 绿 | ✅ 可信 | — |
| `bundle-budget` | 🟢 绿 | ❌ **不可信** | 实测 12.83MB > 10MB 阈值，但**只 WARN，exit 0** |

**⇒ 9 个门禁中，只有 3 个（`ui:audit` / `ui:migration` / `ui:alpha`）的绿灯真正代表"检查过了"。**

### 8.2 四种失效模式

本文档发现的所有门禁缺陷，可归为**四种模式**：

| 模式 | 含义 | 实例 |
|---|---|---|
| **① 测错了对象** | 检查的逻辑正确，但被测的输入不是真实使用的那份 | U-1（测了两个背景，真实用的是第三个）|
| **② 只查形式不查实质** | 校验字段**存在**，不校验**值** | U-2（`screenshot_sha256` 全 0 也通过）、`token:check`（只查名字）|
| **③ 比较语义错误** | 无法比较时**静默通过** | U-3（`undefined` 比较恒 false）|
| **④ 结构性盲区** | 脚本设计上就够不到目标 | U-12（排除了 index.css）|

### 8.3 统一修复原则

> **宁可报错，不可静默通过。**

具体三条规则：

1. **缺数据即失败** —— 任何"无法比较""键不存在""文件找不到"都必须判失败，
   不能跳过（对照 `ui-migration-metrics.mjs` 的正确写法）。
2. **校验值而非字段** —— 有 `screenshot_sha256` 字段不够，要校验它对应真实文件且哈希一致。
3. **背景/输入列表自动派生** —— 手工维护的测试矩阵必然漏格（U-1 的根因）。

### 8.4 "护栏建好了，但从未被真实证据走过"

这是本轮**跨章节最重要的发现**，与上面四种模式互补：

| 维度 | 实测状态 |
|---|---|
| `ui-verify-gate.mjs` 的 6 条规则 | **已实现且被强制执行**（36 份报告全判"合法"，错误 0）|
| 规则的 **L3/L4 分支** | **从未被任何真实报告触发过** |
| 6 个浏览器字段（含 `screenshot_sha256`）| 36 份报告中命中数**全部 = 0** |
| `evidence_level` 分布 | **36 份全 L0**，0 份 L1/L2/L3/L4 |
| 根本原因 | `ui-page-workflow.mjs:15,108` 明确声明"本脚本**无浏览器采集能力**，永不产出 L3/L4" |

**⇒ 门禁"通过"不能被解读为"视觉/无障碍已验收"。**

护栏设计本身是合理的（含 `generated_at` vs mtime 防造假、`BLOCKED(no_browser)` 强制），
但**证据层是空的** —— 一套只守 L0 的护栏，对 L3/L4 的真实质量**没有任何约束力**。

**解决方向**：要么建立真实的浏览器采集入口（Playwright 已在依赖中），
要么**明确承认**该门禁只覆盖 L0，并在验收标准中不要把它当作视觉验收依据。

---

## 九、修复路线图

### 9.1 四个批次（按依赖与收益排序）

**批次 1 —— 数据安全与可信度（最高优先）**

| 项 | 理由 |
|---|---|
| **P0-7** | 数据污染**正在持续发生**，每晚一天就多一批脏数据 |
| **C-1** | 与 P0-7 同链，一起修 |
| **P0-2** | 修完 P0-7 的"禁止 stub 入库"后，密钥问题会**显式暴露**而不是被掩盖 |
| **C-3** | stub 触发条件收紧，防止复发 |

> **不先修 P0-7，其它 AI 相关结论都不可信。**

**批次 2 —— 解除提交阻断**

| 项 | 理由 |
|---|---|
| **P0-3** | 门禁红灯使团队无法判断能否发布 |
| **U-7** | 同时解决"告警疲劳" |
| **P0-6** | 供应链风险，可与 P0-5 合并 |

**批次 3 —— 生产可用性**

| 项 | 理由 |
|---|---|
| **P0-5 + P0-6 + P2-4** | **一个方案（自托管）解决三个问题** |
| **P1-1** | 防止 P0-1 复发（**不修则必然复发**）|
| **C-5** | 一行 compose 改动，恢复所有周期任务（含 P2-2）|

**批次 4 —— 门禁可信度与体验**

| 项 | 理由 |
|---|---|
| **U-1 / U-2 / U-3** | 恢复门禁的**证据价值** |
| **U-9 / U-10 / U-11** | 三个已实测的可见缺陷 |
| **P1-4 / P1-5** | 无障碍达标 |
| **P1-6 / P2-7** | 安全 |

### 9.2 优先级矩阵（影响 × 成本）

```
高影响 ┃ C-5(极低成本)  P0-7   U-1/U-3
       ┃ P1-1          P0-5/6 P0-3
       ┃ U-11          P0-2
       ┃ U-10          P1-4
───────┃──────────────────────────────
低影响 ┃ U-8   P2-1    P2-3   P1-2
       ┃ U-13          P1-7   P1-3
       低成本 ──────────────→ 高成本
```

**左上角是"立刻做"** —— 尤其 **C-5**（一行 compose 改动，恢复 4 个周期任务）
和 **P1-1**（防止核心功能再次失效）。

### 9.3 依赖关系

```
P0-7 ──┐
       ├──→ C-1（同链，需一起修）
P0-2 ──┘
C-4 ───────→ P0-2 方案③的前提
C-5 ───────→ P2-2（修 C-5 后自动解决）
P1-1 ──────→ P0-1（防复发）
U-1 ───────→ 让 P1-4 的修复可被门禁验证
U-3 ───────┐
U-2 ───────┴──→ 恢复门禁可信度（批次 4 的前置）
P0-5 ──────→ 同时解决 P0-6 与 P2-4
```

---
## 十、代码瘦身建议

> 本章是**新增**内容。所有数字均为本版实测，非估算。
> 原则：**先删死代码（零风险），再谈重构（有风险）**。

### 10.1 代码规模基线（实测）

| 范围 | 行数 | 文件数 |
|---|---:|---:|
| 前端 `src`（不含测试）| **94,514** | 532 |
| 前端测试 | 16,879 | — |
| 后端 `app` | **57,892** | 342 |
| 后端测试 | 45,368 | — |
| **源码合计** | **152,406** | 874 |

**测试/源码比**：

| 端 | 比例 | 评价 |
|---|---:|---|
| 前端 | **17.8%** | 偏低 |
| 后端 | **78.3%** | 健康 |

### 10.2 立即可删：4 个零引用文件（292 行）

用 import 图分析（非字符串匹配）确认**零引用**：

| 文件 | 行数 | 验证 |
|---|---:|---|
| `frontend/src/components/ui/command.tsx` | 152 | 全仓 0 引用 |
| `frontend/src/components/Admin/AdminDialog.tsx` | 61 | 全仓 0 引用 |
| `frontend/src/services/aiPartner.ts` | 58 | 全仓 0 引用 |
| `frontend/src/pages/Admin/AgentData/components/SummaryCard.tsx` | 21 | 全仓 0 引用 |
| **合计** | **292**（`command.tsx` 152 + 61 + 58 + 21 = 292）| |

> 这些都是 UI 库或早期实现的残留。`command.tsx` 是 shadcn 的 Command 组件，
> 当前项目未使用（搜索框走的是其它实现）。

**删除前确认**（必做）：

```bash
# 逐个确认零引用（含动态 import 与字符串引用）
rg -n "command\b" frontend/src --glob '*.tsx' --glob '*.ts' | grep -v "command.tsx"
rg -n "AdminDialog|aiPartner|SummaryCard" frontend/src
```

**零风险**，因为都是模块级导出，无人 import 即无副作用。
（对照：`pyodideRunner.worker.ts` 看似零引用，实际通过
`new Worker(new URL(...))` 动态加载 —— **已排除，不可删**。）

### 10.3 可删依赖：`dagre` + `@types/dagre`

**实测证据**：

| 检查项 | 结果 |
|---|---|
| `frontend/src` 中引用 | **0** |
| `vite.config` 中引用 | **0** |
| `tailwind.config` 中引用 | **0** |
| 其它直接依赖是否依赖它 | **否**（`simple-mind-map` 的依赖列表不含 dagre）|

**结论**：可安全移除。

```bash
cd frontend && npm uninstall dagre @types/dagre
npm run type-check && npm run build   # 必须验证构建通过
```

> **注意**：另有 `@myriaddreamin/typst.ts`、`remark-parse`、`xterm-addon-webgl`
> 虽然 `src` 中零直接引用，但**被 `vite.config` 的 manualChunks 规则引用**
> （用于分包），且是其它包的传递依赖 —— **不可删**。
> `tailwindcss-animate` 是 tailwind 插件（`tailwind.config.js:302`）—— **不可删**。

### 10.4 文档瘦身：最大的单一收益

| 文档 | 现状 | 建议 |
|---|---|---|
| **本文档** | 整合前 **3,790 行**（十余轮追加）| 本版已重排压缩；历史轮次进附录 |
| `frontend/src/styles/SPACING.md` | **整段重复**：541 行 = 两份副本（1-275 / 276-541），且两份**只在 §4.4 分歧**（自相矛盾）；另有数字过期一个数量级 | 删副本 2（省 **266 行**，同时消除矛盾）+ 数字改脚本生成 |
| `docs/docker/plans/` | 已清除 5 个过期文档 | ✅ 已完成 |

**SPACING.md 的具体收益**：

```
重复副本:      266 行（541 行中占 49%）
过期数字:      与实测差一个数量级（82 → 1166）
自相矛盾:      副本1 §4.4 说类已删除，副本2 §4.4 又列为存在
               —— 同一次编辑只改了一份副本所致
```

> **根因**：手工维护统计数字必然过期。
> **解法**：改为 `npm run -s ui:spacing` 输出注入，不手抄。

### 10.5 超大文件（建议拆分，需评估）

**前端 >600 行**（12 个）：

| 行数 | 文件 |
|---:|---|
| 1772 | `pages/Xbk/index.tsx` |
| 1605 | `pages/Admin/AgentData/components/GroupDiscussion/index.tsx` |
| 1442 | `pages/Admin/Assessment/QuestionsPage.tsx` |
| 1320 | `pages/Admin/Assessment/StatisticsPage.tsx` |
| 1283 | `pages/Admin/ClassroomPlan/PlanPage.tsx` |
| 1254 | `pages/Admin/ITTechnology/pythonLab/PythonLabStudio.tsx` |
| 1247 | `pages/AIAgents/GroupDiscussionPanel.tsx` |
| 1129 | `pages/Admin/AgentData/results/HotAnalysisResultPage.tsx` |
| 1100 | `pages/Admin/ITTechnology/agents/index.tsx` |
| 1099 | `pages/AIAgents/AssessmentPanel.tsx` |
| 1044 | `pages/AIAgents/index.tsx` |
| 1035 | `pages/Admin/Informatics/TypstNoteEditor.tsx` |

**后端 >800 行**（2 个）：

| 行数 | 文件 |
|---:|---|
| 1352 | `services/assessment/session_service.py` |
| 842 | `api/endpoints/xbk/import_export.py` |

**建议**：**不要为了行数而拆**。只在以下情况拆：
1. 文件内有**明显独立的子领域**（如 `Xbk/index.tsx` 的导入/导出/分析）
2. 拆分后**能被复用**（而非只是把代码搬走）

> 拆文件本身不减代码，只减**单文件认知负担**。
> 若没有复用收益，优先级应低于 10.2/10.3 的实际删除。

### 10.6 结构性重复（需专项评估）

| 现象 | 实测 | 建议 |
|---|---|---|
| `--ws-*` token 定义数 | **330** 个 | 排查是否有同值不同名（已知 `#64748B` 被 **9 个 token 共用**）|
| `animate-spin` 残留 | **16** 处（原 132）| 已大幅收敛；剩余可在统一 LoadingState 时清理 |
| CSS 变量缺 Tailwind 映射 | `--ws-tag-*` 全族 **11 个**未映射，却被 **45 处**消费 | 补映射，消除绕过 token 的写法 |
| 前端测试分布 | 集中少数模块 | 按风险补测（见 P2-6）|
| `console.log` / `TODO` / `FIXME` | **0 / 0 / 0** | ✅ 保持良好 |

### 10.7 瘦身执行顺序（按风险从低到高）

| 序 | 动作 | 风险 | 收益 |
|---|---|---|---|
| 1 | 删 4 个死文件 | **零** | −292 行 |
| 2 | 删 `dagre` 依赖 | 低 | 减依赖树 |
| 3 | 删 SPACING.md 副本 2 | **零** | −266 行 |
| 4 | SPACING.md 数字改脚本生成 | 低 | 消除过期 |
| 5 | 补 `--ws-tag-*` 映射 | 低 | 规范一致性 |
| 6 | 拆分超大文件 | **中** | 可维护性 |
| 7 | 排查 330 个 token 的重复 | 中 | 规范简化 |

**总计**：前 4 步约 **−570 行 + 一个依赖**，且**风险极低**，建议直接执行。
第 5-7 步需要专项评估。

### 10.8 一条重要提醒

> **本文档本身也是"代码库的一部分"。**
>
> 整合前它是 3,790 行、含 12 个重复编号的定义、
> 同一问题分散在 5 个章节 —— 这与代码里的重复逻辑是**同一种债**。
> 文档的可维护性和代码的可维护性应当用**同一标准**衡量。

---
## 十一、流程改进建议

> 比单个 bug 更重要 —— 这些问题**为什么没被更早发现**。

### 11.1 七个系统性盲区

| # | 盲区 | 实例 | 改进 |
|---|---|---|---|
| 1 | **单元测试用 mock，测不到真实外部状态** | P0-1 的容器 label（mock provider 不校验）| 关键外部状态加**集成测试** |
| 2 | **CI 跑不了需要 Docker+浏览器+镜像的端到端** | P0-1 的调试烟测 | 端到端烟测列为**发布前手动 gate** |
| 3 | **手工烟测存在但不在例行流程** | 已有专业 9 场景烟测，无人定期跑 | 写入 checklist，**不可选** |
| 4 | **只在生产生效的分支本地永远不执行** | P0-5 的 `if not DEBUG` | 生产模式配置加**启动自检** |
| 5 | **"配置缺失"被当成"调试模式"** | P0-7 / C-3 | 显式开关，禁止隐式推断 |
| 6 | **门禁只验形式不验实质** | U-2 / U-3 | 见第八章统一原则 |
| 7 | **红灯无人收口** | U-7（`ui:spacing` 红 4 天）| 红灯纳入例行例会，或明确豁免并移除 |

### 11.2 三条可直接落地的机制

**① 生产配置启动自检**

对"只在生产生效"的逻辑（CSP、HSTS、限流），在启动时校验配置与资源是否自洽：

```python
# 启动时检查：CSP 是否允许 index.html 中实际使用的所有域名
if not settings.DEBUG:
    assert_csp_allows(index_html_script_sources())
```

> 这一类缺陷（P0-5）**无法通过开发环境测试发现**，只能靠自检。

**② "返回值语义有效性"检查**

对 AI 等外部依赖，不能只看 HTTP 200：

```python
if result_text.startswith("debug_stub:"):
    raise RuntimeError("agent_not_configured")   # 而不是当作成功
```

**③ 门禁的"缺数据即失败"范式**

统一所有 ratchet 脚本的缺失键处理（见第八章 8.3）。

---

## 十二、误判、撤销与更正记录

> **保留此章是刻意的** —— 一个只记录"发现了什么"的清单是不完整的。
> 记录"推翻过什么"才能校准这份清单的可信度。

### 12.1 本版主动撤回的 10 项误判

| # | 曾判定 | 实测更正 | 误判原因 |
|---|---|---|---|
| 1 | `prefers-reduced-motion` 未实现 | **已实现**（`index.css:479`、`:795`）| 只搜了部分文件 |
| 2 | 加载态不一致 | 组件契约**统一** | 未读 `loading-state.tsx` 的 variant 定义 |
| 3 | 术语不一致（174 vs 3）| 是两个**不同概念** | 词频统计替代了语义判断 |
| 4 | 存在未定义 CSS 变量 | 合并两处定义后 = **0** | 搜索范围未含 `cssTokens.ts` |
| 5 | 核心色不匹配 | 两层别名解析后**浏览器中全部正确** | 静态比对未跑浏览器 |
| 6 | 存在硬编码色 | hex **只在注释里** | 正则命中注释 |
| 7 | 存在 Tailwind 调色板类 | **0** | 同上 |
| 8 | 有深色模式残留 | **0**（项目是永久浅色）| 误把历史命名当残留 |
| 9 | `ROLES.md` 有漂移 | **无漂移** | 未逐项核对 |
| 10 | `--ws-color-scrollbar` 渲染为透明（ auditors 判定，置信度中）| **渲染正常** = `rgba(0,0,0,0.08)` | 我的浏览器实测证伪了该判定 |

**共同教训**：10 项中有 **9 项**源于**静态读码/字符串搜索替代了运行时验证**。
**"三角度验证"（静态 + 运行时 + 反证）不是多余的流程，而是必需的。**

### 12.2 另一类更正：计划文档的数字陈述

| 位置 | 计划原文 | 实测 |
|---|---|---|
| UI 计划 §八 TEST_STATUS 期望值 | `144 files / 486 links` | **166 files / 531 links** |
| UI 计划 §九-4 `w-[120px]` | "尚有 **13 处**" | **28 处**，涉及 **13 个文件**（把文件数当处数）|
| UI 计划 §八 合同失败项数 | "当前 11 项" | 实测 **36 条**（其中约 24 条由一批文档删除产生）|

### 12.3 编号冲突（本版最重要的结构性修正）

**问题**：`N-1` ~ `N-6` 被**两处不同语境重复使用**，共 **12 个定义**：

| 编号 | 位置 A（§12.x 链式）| 位置 B（UI 专项）|
|---|---|---|
| **N-1** | P0-2 与 P0-7 同因果链 | 首页留白 + 版本号 `v–` |
| **N-2** | `/test` 与对话路径不一致 | chip 标签折行溢出 |
| **N-3** | stub 触发条件含 `model_name` 空 | `AdminAppCard` 底色透明 |
| **N-4** | `try_decrypt_api_key` 多处共用 | `ui:dead-layout` "0 死类" |
| **N-5** | Celery Beat 未启动 | `SPACING.md` 文档漂移 |
| **N-6** | 健康探针共用连接池 | 9 个 UI 门禁中 4 个绿灯不成立 |

**危害**：任何人读到"请修复 N-3"，都有 **50% 概率修错东西**。
这是追加式记录最典型的失败模式。

**本版处理**：

| 原编号 | 新编号 | 归入 |
|---|---|---|
| N-1 ~ N-4（链式）| **C-1 ~ C-4** | §六 链式衍生 |
| N-5（Beat）、N-6（探针）| **C-5、C-6** | §六 链式衍生 |
| N-1 ~ N-6（UI）| **U-9 ~ U-14** | §七 UI 专项 |

**⇒ 全文编号现在唯一**，且第二章索引表覆盖全部 43 项。

### 12.4 其它已撤销项

| 项 | 原判定 | 撤销理由 |
|---|---|---|
| **P2-5** | 测评路由"重复入口" | 经核实是**兼容性重定向**，非缺陷 |
| **P2-1** | token 死数据 | 已清理（1880 行），**转为已修复** |

### 12.5 本清单自身的可信度声明

| 维度 | 说明 |
|---|---|
| **高置信**（代码级/实测复现）| P0-1/2/3/5/6/7、P1-1/4、C-5、U-1/2/3/9/10/11/12/13 |
| **中置信**（历史观测，本版未重测）| P1-2/3/5/6/7/9、P2-3/6/7、C-2/3/4/6 |
| **已撤销**（第十八轮复核）| **P1-8**（生产库实测 diff 1/0，仅 alembic 记账表 PK 伪影；EXPLAIN 证据由行数驱动，一并撤销）|
| **曾误判率** | 撤回 10 项 / 总计约 53 项 ≈ **19%** |

> **19% 的误判率意味着**：使用本清单时，对"中置信"条目应**先复现再动手**。
> 每个条目的"验证方式"一栏就是为此准备的。

---

## 十三、第十七轮复核：逐项实锤与链式反应（2026-10-09 晚）

> 本章是**对全文 43 项的一次独立复核**，目标是回答两个问题：
> ① 每个问题**能不能实锤**？② 这些问题**会不会产生链式反应、带出新的错误**？
>
> **复核方法**：直接检查源码、查询运行中的数据库、核对完整部署拓扑，
> **不以文档中的历史结论为依据**。

### 13.1 复核结果总览

| 结果 | 数量 | 含义 |
|---|---:|---|
| ✅ **实锤**（代码级/运行时确认）| 19 | 问题真实，证据充分 |
| ⚠️ **需重新定性** | 4 | 真实但性质/方向与原文不同 |
| ❌ **证伪/撤销** | 3 | 不是问题 |
| ⚫ 未取得新证据（维持原判）| 17 | 需生产库或浏览器 |

**⇒ 原有结论的准确率约 88%（35/43 经复核成立），但其中 4 项的性质描述有误。**

### 13.2 证伪与重新定性（逐条）

#### ❌ 13.2.1 P0-5「生产 CSP 拦截 CDN 脚本」—— **证伪**

**原文结论**：生产 CSP 不含 `cdn.jsdelivr.net` → 9 个 CDN 脚本被拦 → 白屏。

**证伪证据**：核查**完整部署拓扑**后发现，提供 HTML 文档的**不是** FastAPI：

```
浏览器 → gateway (Caddy :80)
           ├── /api/*  → backend:8000        （CSP 只在这里的响应上）
           └── 其它    → frontend:80 (Caddy)  （返回 index.html）
```

逐层核查 CSP：

| 层 | CSP 设置数 |
|---|---:|
| `gateway/Caddyfile` | **0** |
| `gateway/Caddyfile.dev` | **0** |
| `frontend/caddy/Caddyfile.prod` | **0** |
| `index.html` 的 meta | **无** |

**⇒ HTML 文档根本没有 CSP，CDN 脚本不会被拦截。原结论错误。**

**但复核带出了一个更值得修的真问题**（见 13.3 链式反应 C）：
**CSP 被配置在了不起作用的地方** —— 配在返回 JSON 的 API 响应上，
而 `script-src`/`style-src`/`font-src` 只对 HTML 文档有意义。
**⇒ 生产环境实际上处于无 CSP 状态。**

#### ❌ 13.2.2 P2-7「`session_id` 越权查询」—— **撤销**

**原文结论**：`GET /admin/messages?session_id=99999` → 200，判定越权。

**撤销证据**：该端点是 `require_admin`；且**用户端点已正确过滤 owner**：

```python
# 用户端点（正确）
WHERE user_id = :user_id AND session_id = :session_id

# 管理端点（按设计可见全部会话）
WHERE session_id = :session_id
```

**⇒ 不构成越权**：管理员按定义就应能查看任意会话；
"不存在返回 `200 []`"只是空结果，不泄露信息。

**误判根源**：只看到"没按 user_id 过滤"，**未核对端点的鉴权级别**。

#### ⚠️ 13.2.3 P1-1「`owns()` 恒失败是逻辑缺陷」—— **重新定性（且原定性有害）**

**原文结论**：`owns()` 比较恒 False → "双重失败" → 沙箱永不回收（暗示是 bug）。

**复核证据**：该行为有 **20+ 个对抗性测试**明确保障，
测试文件自称 *"Offline ownership counterexamples"*，测试名直接体现安全意图：

| 测试 | 保障的安全属性 |
|---|---|
| `test_mutable_workspace_metadata_is_not_delete_authority` | 元数据不构成删除授权 |
| `test_tokenless_stop_retains_legacy_and_current_generations` | 无 token 则保留 |
| `test_writable_legacy_meta_cannot_authorize_external_container` | 伪造 meta 不能授权删除 |
| `test_counterexample_id_only_compensation_would_delete_new_adopter` | 仅凭 ID 会误删 |
| `test_cleanup_orphans_fake_meta_retains_resources` | 显式断言**保留**资源 |

最后一条的注释点明设计哲学：

```python
assert result.state == 'SUCCESS'  # Scheduler success is NOT resource recovery.
assert live_ids == before_ids                    # 保留（预期）
assert not any(c[1] in {'rm','exec'} for c in calls)   # 未发删除命令
```

**⇒ 保留容器是刻意的 fail-closed 安全设计**（误删活跃会话 ≫ 泄漏孤儿容器）。

**⚠️ 原定性的危害**：按原文思路"修复比较"会让 `owns()` 变宽松，
**等于打开误删活跃会话的通道** —— 把安全设计当成 bug 去"修"，会引入真实漏洞。

**正确的问题陈述**：不是"校验写错了"，而是
**"用 `owns()` 回收孤儿"这一设计本身不成立**（孤儿定义上无 owner），
缺的是**另一条**受审计的回收路径。

#### ⚠️ 13.2.4 C-2「`/test` 掩盖故障」—— **方向更正**

**原文结论**：`/test` 与对话路径行为不一致，`/test` **掩盖**故障。

**复核证据**：两个凭证解析函数的回退链**实质等价**（都：解密 → 明文 → OPENROUTER），
不存在"一严一松"。真正的差异在**凭证缺失之后**：

| 路径 | 凭证缺失时的行为 |
|---|---|
| `/test` | 发起**真实** HTTP 调用 → 返回**真实错误**（**诚实**）|
| 对话 | 命中 stub → 返回**假成功**（**不诚实**）|

**⇒ 掩盖故障的是对话路径（P0-7），不是 `/test`。方向与原文相反。**

**修正后仍成立的部分**：两条路径是独立实现，
所以 `/test` 通过**不能证明**对话可用；且**面向用户的是不诚实的那条**。

#### ⚠️ 13.2.5 U-9「版本号 `v–` 因接口 404」—— **根因更正**

**原文结论**：接口 `/api/v1/home/stats` 404 → `version` undefined → 渲染 `v–`。

**复核证据**：版本号**不来自任何 HTTP 接口**：

```ts
// useAppMeta.ts —— 明确注释"never query privileged system APIs"
const normalizeVersion = (v) => {
  if (!s || s.toLowerCase() === "unknown") return "–";   // ← 刻意兜底
  return s;
};
```

真实原因：`docker-compose.yml:346` 的 `REACT_APP_VERSION: ${REACT_APP_VERSION:-}`
**默认为空**，而 `package.json` 里的 `2.1.3` **从未接入构建**。

**⇒ `v–` 是兜底**（这部分是对的），但**根因不是接口 404**，
而是"版本号依赖一个默认为空的部署变量"。

#### ⚠️ 13.2.6 P0-7「污染正在持续发生」—— **实测零污染**

**原文结论**：数据污染**正在持续发生**。

**复核证据**：直接查询数据库 4 张相关表：

```
znt_group_discussion_analyses : 总 0 行, 命中 0
task_analyses                 : 总 5 行, 命中 0
hot_question_analyses         : 总 7 行, 命中 0
student_chain_analyses        : 总 6 行, 命中 0
```

旁证：该功能的 `sessions`=2、`messages`=1、`analyses`=**0** → **功能基本未被使用**。

**⇒ 准确定性：已装填但未击发。** 优先级仍高，但不是"正在发生的事故"。

---

### 13.3 链式反应分析：由现有问题带出的**新发现**

> 这是本章最有价值的部分 —— 顺着问题往下追，找到 4 个此前未记录的错误。

#### 🔴 链 A：P0-1 有**两个**独立成因，只修一个无效

**推演起点**：P0-1（调试不可用）的根因被记为 P1-1。

**追查 `cleanup_orphans` 的触发方式**时发现：

| 触发路径 | 是否存在 | 结果 |
|---|---|---|
| **Celery Beat 每 5 分钟** | `beat_schedule` 有定义，但 **C-5：Beat 从未启动** | ❌ 从不执行 |
| **后端启动时**（`startup.py:187`）| 存在 | ⚠️ **仅在后端重启时执行一次** |
| API 手动触发 | **不存在** | — |

**⇒ 新结论**：`cleanup_orphans` **只有启动时那一枪**。
换句话说：

```
P0-1 的两个独立成因：
  ① P1-1：即使执行了，也没有安全的回收路径（回收机制缺失）
  ② C-5 ：即使有回收路径，也不会被周期性执行（Beat 未启动）
```

**两者缺一不可** —— **只修 P1-1 或只修 C-5，孤儿仍会累积**。

> **这直接修正了修复计划**：原计划把 P1-1 列为"必做"、
> 把 C-5 列为"一行 compose 改动"分别处理，未指出二者**对 P0-1 是合取关系**。

#### 🔴 链 B：同一位置存在**第二条**占位数据路径

**推演起点**：P0-7 记录 `debug_stub` 会入库。

**追查"还有谁把失败写进库"**时发现，
调用方 `analysis_service.py:61-66` 有**另一个**同样入库的占位符：

```python
except ValueError as e:
    msg = str(e)
    if msg.startswith("provider_status_429"):
        raise HTTPException(429, ...)        # 429 正确抛出
    result_text = "fallback_analysis\n" + f"error={msg}\n" ...   # ← 第二条路径
# ...
db.add(analysis); await db.commit()
```

**⇒ 修复 P0-7 时必须**同时**堵住两条路径** ——
只处理 `debug_stub` 的话，`fallback_analysis` 仍会把"调用失败"伪装成"分析结果"。

#### 🔴 链 C：CSP 放错位置 → **生产无 XSS 防护**（P0-5 的真问题）

**推演起点**：证伪 P0-5 时（13.2.1）追问了一个新问题：
"CSP 既然不拦 CDN，那它到底起什么作用？"

**发现**：`script-src`/`style-src`/`font-src` 是**文档级指令** ——
它们约束的是 HTML 文档加载哪些资源。而这份 CSP 被配在
**返回 JSON 的 `/api/*` 响应**上：

| CSP 指令 | 在 API 响应上的作用 | 在 HTML 文档上的作用 |
|---|---|---|
| `script-src` | **无**（JSON 不加载脚本）| 阻止 XSS 注入的脚本 |
| `style-src` | **无** | 阻止注入样式 |
| `font-src` | **无** | 限制字体来源 |
| `object-src` | **无** | 阻止插件 |

**⇒ 生产环境的 HTML 文档没有任何 CSP，XSS 纵深防御缺失。**

**这个新问题比原来的 P0-5 更值得修**，而且原 P0-5 还**放大**了它的方向性错误 ——
如果按原方案"往 CSP 里加 CDN 域名"，改动加在了**错误的位置**，
生产页面**依然没有 CSP**。

**附带发现**：`index.html` 还外链 **Google Fonts（Inter + Noto Sans SC）** 与 **KaTeX CSS**：

```
link href → fonts.googleapis.com   （字体 CSS）
link href → fonts.gstatic.com      （字体文件）
link href → cdn.jsdelivr.net/.../katex.min.css
```

**⇒ 将来给 HTML 加 CSP 时，若漏配 `style-src`/`font-src`，
会把"现在正常显示的中文字体"打成回退字体** —— 典型的"修一个引入另一个"。

#### 🔴 链 D：`POSTGRES_MAX_CONNECTIONS` 是**误导性命名**

**推演起点**：量化 P1-2 时核对配置名与用途。

```python
pool_size=settings.POSTGRES_MAX_CONNECTIONS,   # 名字像"数据库上限"，实际是"本进程池大小"
```

**⇒ 两个后果**：

1. 运维看到 `POSTGRES_MAX_CONNECTIONS=50` 会以为"数据库允许 50 个连接"，
   **实际它是每个进程的池大小，与数据库上限无关**
2. 生产默认值 50（+20 overflow = 70）**看起来留有余量**，
   实际上单进程就吃掉真实上限（100）的 70%

> 这是"命名导致误配"的典型案例，也是 P1-2 长期未被发现的可能原因。

#### ✅ 被证伪的链式假设（同样重要）

链式推演也产生过几个**看似合理但实际不成立**的假设，一并记录：

| 假设 | 验证结果 |
|---|---|
| XFF 可伪造 → 绕过 IP 限流（放大 P1-6）| ❌ **已被修**：`extract_client_ip` 要求 peer 属于 `AUTH_TRUSTED_PROXY_CIDRS`，否则 fail-closed（S7 治理）|
| `cutover.py` 的第二 engine 使连接数翻倍 | ❌ CLI-only 路径，且 `finally: engine.dispose()`，不在运行时 |
| 生产缺 CORS（`main.py:193` 只在 DEBUG 加）| ❌ 存在 `elif settings.CORS_ORIGINS:` 生产分支 |
| `test_agent` 返回模拟数据（docstring 如此写）| ❌ docstring **已过期**，实现真实发起 HTTP 调用 |

> **"证伪自己的假设"与"证实问题"同等重要** —— 这 4 条若不核查就写进清单，
> 会变成 4 条新的误报。

---

### 13.4 复核后的状态变更汇总

| ID | 原状态 | 复核后 | 变更性质 |
|---|---|---|---|
| **P0-5** | 🔴 仍存在（CSP 拦 CDN）| ⚠️ **证伪 → 转为新问题** | 结论错误 |
| **P0-7** | 🔴 仍存在（正在污染）| 🔴 仍存在（**零污染**）| 严重度描述修正 |
| **P1-1** | 🔴 逻辑缺陷 | 🔴 **安全设计 + 机制缺口** | 性质重定性 |
| **P1-2** | 🔴 仍存在 | 🔴 仍存在（**已量化**）| 证据加强 |
| **P1-3** | 🔴 仍存在（4 次往返）| 🔴 仍存在（**5 个点位**）| 数字修正 |
| **P2-7** | 🔴 越权 | ⚪ **已撤销** | 误判 |
| **C-2** | 🔴 `/test` 掩盖 | 🔴 仍存在（**方向相反**）| 方向更正 |
| **U-9** | 🔴 接口 404 导致 | 🔴 仍存在（**根因更正**）| 根因更正 |
| **新** | — | 🔴 **生产无文档级 CSP** | 链 C |
| **新** | — | 🔴 **`fallback_analysis` 第二占位路径** | 链 B |
| **新** | — | 🔴 **P0-1 双成因（P1-1 ∧ C-5）** | 链 A |
| **新** | — | 🟡 **配置命名误导** | 链 D |

**修正后的问题总数：43 → 46**（新增 4 项，撤销 1 项）。

### 13.5 本轮复核的方法论结论

| 教训 | 实例 |
|---|---|
| **静态读码必须配运行时验证** | U-9（接口 404 是**臆测的**因果，代码里根本没有这个调用）|
| **判定安全类问题必须先确认鉴权边界** | P2-7（没看 `require_admin` 就判越权）|
| **"看起来像 bug"的可能是安全设计** | P1-1（20+ 对抗测试保障的行为，差点被当 bug "修"坏）|
| **必须核查完整部署拓扑** | P0-5（没确认 HTML 由谁提供，就得出了错误结论）|
| **严重度描述要与实测证据一致** | P0-7（"正在持续发生" vs 实测 0 行）|
| **链式推演必须同时尝试证伪** | 4 条链式假设被证伪，避免新增 4 条误报 |

> **对使用者的建议**：使用本清单时，
> **凡标"中置信"的条目，先按"验证方式"复现再动手**。
> 本章的 6 处更正说明：**即使经过多轮审计，仍会有约 12% 的结论需要修正。**

---
## 十四、第十八轮：三维度复核 + Docker 全栈启动验证（2026-10-09 晚）

> 本轮分两部分：
> **A.** 对全部问题做三维度复核（静态 / 运行时 / 反证），4 名验证员 + Lead 反证
> **B.** 用 Docker **完整启动生产栈**（此前只跑过 dev 栈），逐步验证并发现新错误
>
> **结论先行：B 部分发现 4 个生产启动阻断（D-1 ~ D-4），其中 3 个已按守卫规定路径解除，
> 1 个（认证受控迁移）是设计上的人工步骤，需要用户决策。**

---

### 14.A 三维度复核结果

#### 14.A.1 判定汇总

| 分类 | 结果 |
|---|---|
| ✅ 实锤（三维度均通过）| P0-2/3/4/5/6、P1-1/2/3/4/5/6/7、P2-1/2/3/4/6、C-1/2/3/4/5/6、X-2/3/4、U-1/2/3/6/8/9/11/13/14 |
| 🔴 升级 | **P0-7 已从"零污染"转为"已击发"**（见 14.A.2）|
| ⚪ 撤销 | **U-12**（反证成功）；**P1-8 降级**（全量回放 diff 1/0，唯一差异是 alembic 记账表 PK 伪影）|
| ⚠️ 更正证据 | **U-7**（"红 4 天"不成立）、**P1-3**（第 3 个 incr 属限流器非中间件）、**P1-4**（门禁 `SCENARIOS.surface=[]` 零场景已量化）、**C-6**（部分解耦）、P0-3 表述、P0-6 数量 |
| ⚫ 证据不足 | U-4 / U-5 / U-10（需浏览器）、**P1-9 运行时**（并发曲线未复现，静态成立）|

#### 14.A.2 最重要的复核发现：P0-7 已击发

文档第十三轮实测"**4 张表 18 行，命中 0 行**"，并定性"已装填未击发"。
**该结论已失效。** 三维度复核期间（20:38）验证员调用了一次小组讨论分析接口：

```
znt_group_discussion_analyses
  id=9 | created_at = 2026-10-09 20:38:27
  result_text = "debug_stub: 你是一位经验丰富的教学分析助手，擅长从学生讨论中…"
```

**⇒ "一用就污染"得到实证。** 定性改为：**"已击发，当前 1 行污染"**。
修复优先级**上调** —— 这不是潜在风险，是**每次使用都会写入垃圾数据**的活缺陷。

#### 14.A.3 三维度复核的自我更正（反证维度的价值）

| ID | 原结论 | 复核后 | 证据 |
|---|---|---|---|
| **U-12** | "0 死类是结构性保证" | ⚪ **撤销** | 注入死类 → 门禁**报出** EXIT=1；注入被引用类 → 正确不报。误读根因：第 62 行排除的是 index.css 作为**引用侧**扫描源，而**定义侧**走 :77-78 从未被排除 |
| **U-7** | "ui:spacing 红 4 天无人处理" | ⚠️ **更正** | 抽 HEAD 版本单跑 → **EXIT=0**（1382=基线）。红灯只存在于**未提交工作树**（Detail.tsx +3、TypstNoteEditor.tsx +1）。CI 签出 commit ⇒ **CI 上一直是绿的** |
| **C-6** | 健康探针与业务共用池 | ⚠️ **部分更正** | `health_endpoint`（:128）**已改**独立 `AsyncSessionLocal()` 并捕获异常；`health_check`（:122）仍 `Depends(get_db)`。需区分两个入口 |
| **P0-6** | "9 个 CDN 脚本" | 🟠 数字更正 | 按 `<script src>` 口径实测 **8 个**；若含字体/样式外链则更多（另见 14.B）|
| **P0-3** | "3 红 1 绿" | 🟠 表述更正 | 实测 **3 红 6 绿**（token-check、ui-alpha、ui-token-values、ui-migration、ui-verify-gate、tsc 均 EXIT 0）|
| **P0-4** | 权限收窄未同步测试 | ✅ **补到决定性证据** | `pytest tests/system/test_metrics.py` → **1 failed**：代码 `metrics.py:56` 用 `require_admin`，测试断言 `require_super_admin` |
| **X-4** | POSTGRES_MAX_CONNECTIONS 命名误导 | ✅ **加重** | `.env.dev:73` 配的 **100 被静默忽略**（compose 不传该变量），实测 `settings.POSTGRES_MAX_CONNECTIONS=20` |
| **P1-8** | 索引漂移"15 缺失 / 8 多余" + EXPLAIN 证据 | ⚪ **证据撤销、降级** | 全量回放 48 迁移 = **215 索引** vs 当前生产库 **214**，逐名 diff **missing=1 / extra=0**，唯一差异是 `alembic_version_pkc`（alembic 记账表 PK 伪影）。EXPLAIN 的 Seq vs Index Scan 由**表行数**（65 vs 0）驱动，非索引缺失。**已从 §4.8 降级，不再作为 P1 跟踪** |
| **P1-3** | "中间件 4/5 次 Redis 往返" | 🟠 **归因修正** | 零噪声实测（200 请求）：`decrby=1.000/req`、`exec=1.000/req`；稳态中间件只发 2 个显式往返 + 1 次 pipeline。实测 `incrby=3/req` 中的**第 3 个来自限流器** `rate_limit.py:40`（`http:429` 计数），**非中间件** |
| **P1-4** | 对比度门禁盲区 | ✅ **盲区精确量化** | 门禁把 `--ws-color-surface-2` 归为 `surface` 角色，而 `SCENARIOS.surface = []`（**零场景**）；tertiary×surface-2 = **4.4510** 门禁**从不计算**。复算 4.76/4.58 与门禁输出完全吻合 → 方法一致，"0 failures"是覆盖率缺口 |

#### 14.A.4 其它实锤确认（三维度均通过，证据不变）

P0-2（active 显示已配置 vs stream 报 missing_api_key，双密钥指纹不同）、
P1-1（字面量 "orphan" 永不匹配 + 20 对抗测试确认是安全设计）、
P1-6（auth.py:56 仍是 `interval_seconds=2`）、
P2-1（token 表又涨到 **133 行 / 132 revoked**，无 GC）、
C-5（compose 无 beat、无 `-B`、`celerybeat-schedule` 停在 Oct 2）、
X-3（三 Caddyfile CSP 计数全 0）、
U-2（伪造 L3 报告仍 EXIT=0）、
U-3（缺键仍 fail-open）。

---

### 14.B Docker 全栈启动验证（本轮新增）

#### 14.B.1 启动方式

`docker compose up -d`（生产栈：postgres / redis / backend / typst-worker /
pythonlab-worker / pythonlab-sandbox / frontend(Caddy) / gateway(Caddy)）。
镜像 2.1.3 全部本地存在，无需重建。此前 6 天运行的是 dev 栈（Vite 前端 + 无 gateway）。

#### 14.B.2 🔴 新发现 D-1：`AI_PARTNER_SCORING_AGENT_ID` 空串使后端无法启动

**现象**：backend 无限重启，pydantic 抛

```
ValidationError: AI_PARTNER_SCORING_AGENT_ID
  Input should be a valid integer, unable to parse string as an integer
  [type=int_parsing, input_value='', input_type=str]
```

**根因链**（三处协同）：

| 层 | 问题 |
|---|---|
| `docker-compose.yml:19` | `AI_PARTNER_SCORING_AGENT_ID: ${AI_PARTNER_SCORING_AGENT_ID:-}` —— 未设置时展开为**空字符串**而非省略 |
| `config/_services.py:33` | `Optional[int] = Field(default=None, gt=0)` —— Optional[int] 接受 None，但**不接受空字符串** |
| `.env` / `.env.example:67` | 均无该键（example 甚至给出空值示例）|

**为什么 dev 栈 6 天没炸**：dev compose **不传**该变量 → pydantic 走默认 None。
只有生产 compose 强制注入空串。

**同类地雷排查**：compose 中还有 6 处 `${X:-}` 空默认（APP_VERSION、AGENT_API_KEY_ENCRYPTION_KEY、
HOST_WORKSPACE_ROOT、AUTH_TRUSTED_PROXY_CIDRS、XBK_EXPORT_SHEET_PASSWORD、REACT_APP_VERSION），
但其余均为字符串字段，无害（REACT_APP_VERSION 的空值正是 U-9 `v–` 的根因）。

**处置（本轮）**：`.env` 补 `AI_PARTNER_SCORING_AGENT_ID=1`（配置层，非代码改动）。
**建议修复**：compose 用 `:-null` 或 pydantic 加 field_validator 把 `""` 归一为 None。

#### 14.B.3 🔴 新发现 D-2：迁移状态守卫阻止启动（3 个未审查索引）

**现象**：修好 D-1 后，backend 仍无法启动：

```
[FAIL] schema drift detected before Alembic upgrade
[FAIL] 291268877685: ix_conversations_session_created: unreviewed index guard/control flow; manual review required
[FAIL] ix_group_messages_session_created / ix_conversations_user_agent_time（同）
```

**根因**：数据库停在 `20260914_0001`（落后 3 个迁移）。守卫
（`check_migration_state.py`）发现待应用迁移 `291268877685` 使用
`if_not_exists=True` + 原生 `CREATE INDEX IF NOT EXISTS`（含部分索引），
**静态无法验证** → 要求人工审查。

**这是守卫按设计工作**（"宁可停，不可盲迁"），不是缺陷 —— 但意味着
**"干净数据库 + 当前镜像"无法无人值守启动**，任何生产部署都必须人工走一遍守卫流程。

**处置（本轮，按守卫自身规定路径）**：
① `pg_dump -Fc` 备份（250KB，存 /tmp/r18/）→ ② 人工审查 3 个迁移全部为**加索引/加列**（无数据删除）
→ ③ `alembic upgrade head` 手工应用 → ④ 重启。

#### 14.B.4 🔴 新发现 D-3：视图形状冲突 —— 镜像 stale，宿主已修

**现象**：迁移应用后仍失败：

```
InvalidTableDefinitionError: cannot change name of view column "is_user_deleted" to "is_archived"
```

**根因**：镜像内 `startup.py` / `bootstrap_db.py` 用
`CREATE OR REPLACE VIEW` 同步视图，而 DB 中旧视图列序与新 SQL 不同
（新 SQL 在 is_user_deleted 位置插入 is_archived → Postgres 禁止改名）。
**宿主仓库已把视图重建移到迁移 `f1a2b3c4d5e6`（DROP VIEW + CREATE）——
但该迁移是 untracked，镜像 2.1.3 构建时它尚不存在。**

**处置（本轮）**：`DROP VIEW IF EXISTS v_conversations_with_deleted`（派生视图，无数据），
启动时按新形状重建。

**建议修复**：**重新构建镜像**（把 f1a2b3c4d5e6 及后续迁移动纳入镜像），
或让 startup 的视图同步改为 DROP+CREATE（与 f1a2b3c4d5e6 一致）。

#### 14.B.5 🔴 新发现 D-4：认证持久状态未完成受控迁移 —— **登录被 503 阻断**

**现象**：全栈启动、全部容器 healthy 后，**合法凭据登录失败**：

```
POST /api/v1/auth/login → HTTP 503
{"detail":"认证持久状态尚未完成受控迁移"}
```

无效凭据仍返回 401（凭据校验在前），说明**只有通过凭据校验的真实用户被拒**。

**根因**：`session_family.py:98` 检查 `AuthAuthority(id=1).ready != True` 即拒绝。
该表由迁移 `20260910_0001_auth_authority` 创建，但"受控迁移"（enrollment）
**从未在该数据库上执行过** —— 迁移建了表，没建状态。

**受控迁移的形态**：`cutover.py` CLI，要求显式 JSON plan（含 database_url、
redis_url、schema、**reauthenticate_user_ids**——需要重新登录的用户清单），
默认 rollback-only，`--apply` 才提交。

**⇒ 这是设计上的**人工步骤**，不是 bug** —— 但意味着：
**"全新部署当前镜像"无法登录任何账号，直到有人执行 enrollment。**

**✅ 已解决（用户批准后执行）**：
① 构造 JSON plan（dry-run 先验证：`{"mode":"dry-run","already_ready":0,"preserved":0,"reauthenticate":0}`）
② `--apply` 提交 → `{"mode":"apply", ...}` → `auth_authority.ready = t`
③ **登录验证通过**：`POST /api/v1/auth/login` → 200，取得有效 token（345 字符）
④ `/auth/me` → 200 返回 admin 信息

> **注意**：enrollment 是对**生产栈的数据库**（named volume）执行的 ——
> 见下方 D-5，dev 栈的真实数据在**另一个数据库**里，那个库若也需登录，
> 需要**单独再执行一次** enrollment。


#### 14.B.8 🔴 新发现 D-5：dev 与生产 compose 使用**两个不同的数据库**（静默换库）

**发现过程**：enrollment 成功后验证登录链路，查询智能体列表发现 `znt_agents = 0 行`。
追查数据去向，发现两个 compose 的 postgres 持久化方式**完全不同**：

| compose | postgres 持久化 | 内容 |
|---|---|---|
| `docker-compose.dev.yml` | **bind mount** `./data/postgres`（宿主机目录）| **真实数据：102MB**（智能体、会话、小组讨论、污染行 id=9 等）|
| `docker-compose.yml`（生产）| **named volume** `wangsh_postgres_data` | **稀疏库**：1 个 admin 用户、0 智能体、0 会话 |

**实测对比（同表行数）**：

```
             native(5432, 真实)   docker 生产栈(5433)
znt_agents          1                    0
znt_conversations   —                    0
znt_gd_analyses     —                    0
sys_users           —                    1
```

**⇒ 切换到生产 compose = 静默换库。** 任何"一键切生产栈"的操作，
后端都会连到一个**近乎空白的数据库**，而真实数据留在宿主机 `./data/postgres`。

**为什么没人发现**：容器名都是 `wangsh-postgres`、端口映射都是 5433，
只有持久化方式不同 —— 一个 bind mount 一个 named volume，
`docker compose ps` 完全看不出区别。

**危害链**：
1. 生产部署时若沿用 dev 的 `./data/postgres` 数据 → 生产连错库
2. 反过来，dev 若误用 named volume → 开发时看不到真实数据
3. 曾误以为 enrollment（D-4）打在真实库上，实际打在稀疏库

**✅ 已解决（用户决策：统一数据源）**：

```
① 备份真实数据目录：/tmp/r18/postgres-real-backup-212102（101MB）+ redis
② docker-compose.yml 改动（YAML 校验通过）：
   postgres: postgres_data:/var/lib/postgresql/data → ./data/postgres:/var/lib/postgresql/data
   redis:    redis_data:/data                    → ./data/redis:/data
   并在两处加注释说明 D-5 的教训
③ 重建 postgres/redis 容器 → 后端经容器名自动连到真实库
```

**切换后的实测（真实库状态出奇地完备，无需重做任何迁移步骤）**：

| 检查项 | 结果 |
|---|---|
| `znt_agents` | **5 行**（真实数据），其中 1 个 active（deepseek，last4=7b12）|
| alembic 版本 | **f1a2b3c4d5e6（head）** —— dev 栈早已应用全部迁移，**无需 D-2 流程** |
| 视图形状 | **新形状**（含 is_archived/archived_at）—— **无需 D-3 的 DROP** |
| `auth_authority.ready` | **= t** —— 真实库**早已完成 enrollment**，无需 D-4 |

> **解释**：dev 栈用最新代码（含 untracked 迁移 f1a2b3c4d5e6），
> 6 天运行中早已把真实库迁到 head 并完成 enrollment。
> 之前 D-2/D-3/D-4 全部踩在**镜像 2.1.3 缺失这些代码 + 稀疏库落后**的组合上。

**统一后真实数据下的核心链路验证**：

| 链路 | 实测 |
|---|---|
| 登录 | ✅ 200，token 有效（redis 换库后旧 token 失效、重登即恢复 —— 符合单会话互斥设计）|
| `/auth/me` | ✅ 200 admin/super_admin |
| **P0-2 现场** | ✅ 复现：`/stream` → `missing_api_key`（而管理后台显示"已配置 …7b12"）|
| **C-2 现场** | ✅ 复现且方向确凿：`/test` → **401 "API Key 无效或过期"**（诚实）；`/stream` → "未配置"（误导）。**同一把坏密钥，两条路径给出两个不同诊断** |
| `/system/metrics` | ✅ 200 |
| 前端页面 | ✅ title "WangSh" |

> **named volume `wangsh_postgres_data`（稀疏库）未删除** —— 里面的 3 个迁移 + enrollment
> 现在无意义，但保留不破坏任何东西；如确认不需要可另行清理。

---
#### 14.B.6 生产栈对既有问题的实测确认（证据等级升级）

| 问题 | 生产栈实测 |
|---|---|
| **X-3 生产无文档级 CSP** | 直接实测：HTML 响应头只有 Referrer-Policy / X-Content-Type-Options / X-Frame-Options，**无 CSP**；而 API 响应**有**完整 CSP（DEBUG=False）→ 第十三章的拓扑推断得到运行时确证 |
| **P0-6 CDN 无 SRI** | 生产 HTML：**8 个 CDN 脚本，0 个 integrity**；另有 Google Fonts（Inter + Noto Sans SC）+ KaTeX CSS + highlight CSS 共 **5 个外链样式/字体资源** |
| **U-9 版本 `v–`** | 生产 bundle 中**不存在 "2.1.3"** → 版本注入为空 → 首页渲染 `v–`（第十三章根因确证）|
| **/docs 禁用** | `/api/v1/docs` → 404（生产正确行为）✅ |

#### 14.B.7 本轮启动验证的元发现

**"镜像 2.1.3 与当前仓库已经分叉"** —— D-3 的根因（仓库有镜像没有的迁移）
说明镜像构建早于最近的认证/视图工作。三个未入库迁移
（`f1a2b3c4d5e6` 等）**不在镜像里**，任何基于该镜像的部署都会依次踩 D-1 ~ D-4。

**⇒ 建议**：完成认证受控迁移决策后，**重新构建全部镜像**，
并以"干净 DB + 新镜像一键启动成功"作为发布验收标准。

---

### 14.C 需要用户决策的事项

| # | 事项 | 选项 |
|---|---|---|
| 1 | ~~D-4 认证受控迁移~~ | **✅ 已执行**（用户批准）：enrollment 提交、登录 200。真实库经 D-5 统一后**无需重复执行**（其 `ready=t` 早已就绪）|
| 2 | ~~P1-8 基线库~~ | **已解决**：全量回放证明无业务漂移（diff 1/0），P1-8 已撤销 |
| 3 | ~~.env 变更确认~~ | **✅ 已定（Lead 决策）**：保留 `AI_PARTNER_SCORING_AGENT_ID=1` —— 实测 id=1 即 deepseek（general），语义正确；此键缺失时生产栈无法启动（D-1），必须保留。备份在 /tmp/r18/env.backup |
| 4 | ~~数据库变更确认~~ | **✅ 已收口**：稀疏库的 3 个迁移 + DROP VIEW 已随卷清理（见下），真实库无需任何操作（已处于 head）。备份 /tmp/r18/pre_migration_backup.dump 仍保留 |
| 5 | ~~D-5 双数据库~~ | **✅ 已解决**：统一数据源后，**稀疏 named volume `wangsh_postgres_data` / `wangsh_redis_data` 已删除**（Lead 决策：零业务价值、留着是 D-5 陷阱源）；compose 中对应声明与注释已清理（YAML 校验通过、`docker compose up -d` 无重建）|

---
## 十五、第十九轮：UI 深度实测与设计系统完善方案（2026-10-09 夜）

> 本轮背景：全栈已切到**真实数据 + 生产镜像**，单账号互斥解除，首次可以
> **真实浏览器实测** UI 问题。同时派设计系统审计员做了静态深挖。
> 两部分结果合并成下面的"完善方案"。

---

### 15.1 真实浏览器实测（Playwright，真实数据，1440/768 双视口）

#### 15.1.1 实测确认的（证据升级）

| ID | 实测结果 | 证据 |
|---|---|---|
| **U-4 / P1-5** | 🔴 **实锤**：复选框是 BUTTON 元素 **14.7×14.7px**（h-4 w-4），页面 10+ 处 | probe1：`grid place-content-center peer h-4 w-4 shrink-0` |
| **U-11** | 🔴 **实锤**：/admin/it-technology 上 **10 个徽标** `background: var(--ws-*)18` 全部计算为 `rgba(0,0,0,0)` 透明 | probe3：primary×2、warning、success、info、purple、tag-blue×2、accent |
| **task-9 键盘** | ✅ **正常**：真实 Tab 键 10 次遍历导航，每个焦点元素都有可见焦点环（白 2px offset + 色环）| probe2：`boxShadow: rgb(255,255,255) 0 0 0 2px, rgb(124,58,2…) ` |
| 登录/数据链路 | ✅ 正常：13 个真实用户、6 个统计 chip 正常渲染 | probe2 bodyText |

> **U-11 的补充**：此前 probe2 用 `[class*=card]` 筛选漏掉了徽标（它们是 card 内部的 DIV）。
> 修正选择器（扫 inline style）后 10 个透明背景全部现形 —— **"证据不足"只是因为探测方法不对**。

#### 15.1.2 需要修正的两项（部署镜像 ≠ 仓库代码）

| ID | 原结论 | 实测修正 | 原因 |
|---|---|---|---|
| **U-9 版本** | "生产 bundle 无 2.1.3 → 首页必然 v–" | ⚠️ **部分修正**：部署中的镜像**显示 v2.1.3 正确**（侧栏 `text-white/25` 元素）| 该镜像 09-28 构建时带版本号；**当前 compose 空默认只影响下次重建**。风险仍在，症状未现 |
| **U-10 chip** | "768/1024/1440 三档溢出 +7.6px" | ⚠️ **部分修正**：部署镜像在 **768 与 1440 均不溢出**（probe1/3 实测 0 处）| 溢出测量自 dev 服务器（当前仓库代码 + 未提交改动）；镜像代码较老 |

**⇒ 这两项的定性要区分"已部署现实"与"当前代码风险"**：
U-9 与 U-10 是**当前仓库代码**的风险（重新构建即会出现），
U-4 与 U-11 是**已部署镜像**的现实（现在就有）。

#### 15.1.3 🔴 新发现 D-6：镜像与仓库脱节 —— 版本号 2.1.3 不代表代码内容

实测证据链：

```
镜像 wangsh-frontend:2.1.3  构建于 2026-09-28 05:37
B 系列 UI 整改（token 化/死色清收/焦点环/大屏网格）提交于 2026-10-05（176c189）
→ 镜像比 B 系列早 7 天，5 个 frontend 提交不在镜像内
→ 但 tag 仍是 2.1.3（与 package.json version 一致）
```

**后果**：
1. "2.1.3" 这个名字**同时指向两个不同的前端**（09-28 版与 10-05 版）
2. U-9/U-10 的"当前代码风险"无法通过部署来验证 —— **部署的永远不是最新代码**
3. 后端同理（D-3 的根因也是镜像 stale）

**建议**：任何"以仓库 HEAD 为准"的验证结论，都要先确认**镜像构建时间**；
版本号应随每次构建变化（或加 build 时间戳）。

---

### 15.2 设计系统静态深挖（ui-design-system 交付，全文 /tmp/ws-audit/U2-design-system-plan.md）

#### 15.2.1 数字修正

| 原文 | 实测修正 |
|---|---|
| "330 个 --ws-* token" | **345 个自定义属性** = 247 个 `--ws-color-*`（含 32 个 -rgb，纯语义色 **215**）+ 98 个非颜色 |
| "9 个共用 #64748B" | ✅ 恰好 9 个；但整个颜色族**同值不同名共 44 组**，≥3 成员 15 组，最大 15×#FFFFFF、12×#4F46E5。理论可收敛 **123 个** |

#### 15.2.2 🔴 语义塌陷（比"同值不同名"更危险，4 组）

| # | 现象 | 证据 | 建议 |
|---|---|---|---|
| **B1** | success/warning/error/info/primary **五族的 fill = text = border 完全相同** | success 三值皆 #15803D；border 不是描边而是实色 | border 改为可辨识描边（如 `rgba(fill,.35)`）|
| **B2** | `terminal-black == terminal-bright-white`（皆 #0F172A）；`debug-idle == debug-stopped` | index.css 实测 4 组 | 终端 ANSI 层 black≠brightWhite 是硬要求；debug 状态色需区分 |
| **B3** | danger 只有 1 个 token，Tailwind 里却是 error 的 7 键完整镜像 | tailwind.config.js:139-146 | **删 danger**（Tailwind 侧），error 是事实标准 |
| **B4** | error / danger / destructive **三种写法并存** | text-destructive 60 处 + text-error-text 16 + bg-error-soft 16 + border-error 12 + text-error 11 + bg-destructive 8 | 统一到 error；destructive 仅留 shadcn 兼容 alias 并注释"新代码勿用" |

#### 15.2.3 tag 族映射方案（U-11 根治）

现状：`--ws-tag-*` 11 个定义、Tailwind **零映射**、46 处消费全部走 `style={{...}}` 内联
—— 这正是 AdminAppCard 拼字符串的根因：**token 层没有给"半透明变体"提供出口**。

方案（P2 阶段执行）：

```js
// tailwind.config.js → colors，与 success/error 同级
tag: {
  blue:  { DEFAULT: "rgb(var(--ws-tag-blue-rgb) / <alpha-value>)" },
  // …共 11 个；同时补 5 个直写值的 -rgb 三元组（其余 6 个 alias 已有 -rgb）
}
// 消费侧：AdminAppCard 由 color 字符串拼接改为
//   className={'bg-tag-blue/10 text-tag-blue'}   // tag 名由 prop 决定
```

46 处消费分两类：**41 处 class 化**（ai/data.ts 20、agents/data.ts 18、ml/data.ts 1、ITTechnology/index.tsx 2），
**4 处保留 var()**（pythonLab/flow/ports.ts —— SVG fill 不能走 Tailwind 类）。

#### 15.2.4 🔴 对比度矩阵：角色感知派生后**真实违规是 7 条，不是 1 条**

审计员实现了"合成半透明 + 角色感知配对"的正确算法（笛卡尔积会产生 148 条假阳性，不可用）：

| 前景 | 背景 | 比值 | 状态 |
|---|---|---|---|
| text-tertiary | surface-2 | **4.4510** | ❌ 已知（P1-4/U-1）|
| text-tertiary | primary-muted (#E6F7F5) | **4.3028** | ❌ **新** |
| warning-text | warning-soft@surface | **4.4979** | ❌ **新**（差 0.0021）|
| warning-text | warning-soft@surface-2 | **4.2316** | ❌ **新** |
| warning-text | warning-soft@page | **4.3562** | ❌ **新** |
| success-text | success-soft@surface-2 | **4.2159** | ❌ **新** |
| success-text | success-soft@page | **4.3396** | ❌ **新** |

对照：error/info 两族全部合格（5.40 / 4.97）→ **是 success/warning 两族特有缺口，不是矩阵过严**。

**代码共现已核实**：`bg-<fam>-soft` + `text-<fam>-text` 同一 className 串**共现 12 处**
（AdminTablePanel.tsx:85、UserMenu.tsx:210、PdfCanvasVirtualViewer.tsx:252、AdminLayout.tsx:195、
BasicLayout.tsx:231/237、GroupDiscussionPanel.tsx:725 等）；
`text-text-tertiary` + `bg-surface-2` 同行 **8 处**。

---

### 15.3 完善方案（P0-P6，风险由低到高）

| 阶段 | 动作 | 风险 | 验证标准 |
|---|---|---|---|
| **P0** | 修文档漂移：COLORS.md:50-52 border alpha、:278 `54 119 111`→`15 118 110`；删 SPACING.md 重复副本 | 无 | 建议加 `docs:colors:ci` 门禁 |
| **P1** | 修值失效：`--ws-color-scrollbar` 的裸 rgba 逗号写法 | 无 | getComputedStyle 断言非透明 |
| **P2** | **补 tag 映射 + 41 处 class 化**（根治 U-11）| 中 | type-check + 三页视觉回归；ports.ts 4 处**不动** |
| **P3** | **对比度矩阵改造**：角色感知 + 半透明合成 + 自动派生背景集 | 中 | **必须复现出 7 条**，少于 7 条说明派生有 bug |
| **P4** | **修 7 条违规**：success/warning 的 -soft alpha 提高，或 text 侧加深 | 中高 | 重跑 P3 至全绿 |
| **P5** | token 收敛：44 组同值不同名优先 G2/G4/G6，全改 alias **不删名** | 高 | token:check + 全站视觉 |
| **P6** | 语义去重（破坏性）：删 danger 族、统一 error 三轨、-rgb 命名统一 | **最高** | 全量 grep 0 引用后再删 |

**配套流程建议**：P2/P4 完成后重跑本轮的 Playwright 探针（/tmp/r18/ui_probe*.mjs）作为回归基线；
P3 的派生算法须与 P4 的修复同批上线，否则矩阵改严后门禁全红（与 U-7 告警疲劳同源）。

---

### 15.4 本轮修正记录

| 项 | 修正 |
|---|---|
| U-9 | 定性改为"已部署正常（v2.1.3）/ 重建风险"；根因不变 |
| U-10 | 定性改为"当前仓库代码风险"；部署镜像不溢出 |
| U-11 | probe2 误报"未复现"系选择器错误；probe3 修正后 10 处实锤 |
| task-9（键盘）| 真实 Tab 实测焦点环正常 → 收口 |
| 新增 D-6 | 镜像与仓库脱节（09-28 vs 10-05），tag 2.1.3 名不副实 |
| 新增 7 条对比度违规 | success/warning 两族 + text-tertiary×primary-muted |

---


### 15.5 方案论断独立复核（Lead 复算，深夜追加）

> 用户要求"审核后完善 list.md"而非动手修复。
> 本小节是对 15.2/15.3 方案**论断本身的独立核验** —— 每个数字都重新算过。

#### 15.5.1 核验结果总表

| 论断 | 独立核验 | 结论 |
|---|---|---|
| 247 个颜色 token / 215 语义色 / 32 个 -rgb | 重新解析 `:root` | ✅ **逐项吻合** |
| "44 组同值不同名" | 按**字面值**重算得 **22 组 / 71 token**（队友的 44 组含 alias 解析口径）| 🟠 **两口径并存**，建议文档写"字面 22 组、alias 解析后 44 组" |
| B1 五族 fill=text=border 同值 | 独立分组：primary 6×#0F766E、info 6×#0369A1、warning 5×#B45309、error 5×#B42318 | ✅ **证实**，且**超出报告**：`chart-1` 与 primary 同值、`terminal-blue/yellow/red` 与 info/warning/error 同值 |
| B2 `terminal-black == terminal-bright-white` | 独立分组：#0F172A 出现 4×（text、terminal-black、terminal-bright-white、editor-syntax-variable）| ✅ **证实** |
| B4 三轨计数 | 独立计数：text-destructive **48**、text-error-text **13**、text-error **11**、bg-destructive **9**、bg-error-soft **17** | ✅ **量级一致**（与报告的 60/16/11/8/16 略有出入，系口径差）|
| **7 条对比度违规** | **独立重算全部 7 条** | ✅ **逐位一致**（4.4510/4.3028/4.4979/4.2316/4.3562/4.2159/4.3396）|
| "代码共现 12 处" | 独立扫描 .tsx | ⚠️ **修正**：同串实测 **11 处**（报告的 7 个点名列号**全部精确命中**）；但**暴露面被低估**（见下）|
| P1 "--ws-color-scrollbar 值失效" | 实测 `rgba(0, 0, 0, 0.08)` 为**合法 CSS**，且此前浏览器验证渲染正常 | ❌ **证伪**，从方案中移除 |

#### 15.5.2 重要修正：违规暴露面是 31 处，不是 12 处

逐家族实测使用点（.tsx 全量）：

| 组合 | 使用处数 | 对比度 | 现场 |
|---|---|---|---|
| `bg-warning-soft` | **19** | 其上 warning-text = 4.23~4.50 ❌ | HotAnalysisResultPage 独占 13 处 + GroupDiscussionPanel:725 + MindMapEditorLib:137 等 |
| `bg-success-soft` | **5**（4 个真实站点 + 1 测试）| 其上 success-text = 4.22~4.34 ❌ | Dashboard:140、ChainAnalysisResultPage:155、DetailModal:164/190 —— **成功族违规不是潜伏态，是现场** |
| `text-tertiary`+surface-2 同串 | **7** | 4.4510 ❌ | GroupDiscussionPanel:887、GamesManager:423、TaskAnalysisNewPage:263/322、HotAnalysisResultPage:888、SharedResultLayout:73、ChapterList:108 |
| `bg-error-soft`+text-error-text（同串 11 处中的多数）| 8+ | **5.40 ✅ 合格** | —— 同串共现≠违规，error 族是安全参照 |

**⇒ 修正后的结论**：
1. 7 条违规中 **3 条有现场**（warning-soft、success-soft、tertiary×surface-2），合计约 **31 处使用点需逐一核查**；
2. 报告的"12 处共现"口径**漏掉了一半以上**（它只数了同 className 串，而 `bg-warning-soft` 19 处里有大量是与 warning-text 分写在**父子元素**上的）；
3. success 族违规**不是潜伏态** —— Dashboard:140 等 4 处真实站点现在就在违规。

#### 15.5.3 对完善方案的修订（替代 15.3 的 P0-P6）

| 阶段 | 原方案 | 修订 |
|---|---|---|
| **P0** | 修文档漂移（border/rgb/SPACING 副本）| ✅ **维持**，且已核验漂移为真（文档 .08/.16/.24 vs 代码 .12/.18/.28；文档 rgb 54 119 111 vs 代码 15 118 110）|
| **P1** | 修 `--ws-color-scrollbar` | ❌ **移除**（证伪：合法 CSS，浏览器验证正常）|
| **P2** | 补 tag 映射 + 41 处 class 化 | ✅ **维持**；新增核验：tag 11 个定义、Tailwind 0 映射、消费 46 处（41 class 化 + 4 SVG 保留 var + chartTheme.ts 1 处注释）|
| **P3** | 对比度矩阵改造（角色感知 + 合成）| ✅ **维持**；验收标准"必须复现 7 条"已验证成立（独立复算逐位一致）|
| **P4** | 修 7 条违规 | 🟠 **扩大范围**：按 15.5.2 的 **31 处暴露面**逐一核对宿主；success/warning 两族优先（error 族无需动）|
| **P5/P6** | token 收敛 / 语义去重 | ✅ 维持；B1 的"chart-1 与 primary 同值"等新增证据支持收敛 |

#### 15.5.4 本轮新发现（复核过程中）

| # | 发现 |
|---|---|
| R-1 | `chart-1` 与 `primary-fill` 同值、`terminal-blue/yellow/red` 与 info/warning/error 同值 —— 图表/终端色**没有独立色板**，与状态色共源（这解释了为什么改状态色会牵连图表）|
| R-2 | `editor-syntax-variable` 与 `--ws-color-text` 同值 #0F172A —— 编辑器变量名与正文同色，语法高亮区分度存疑 |
| R-3 | 同串共现 11 处中 8 处是 error 族（合格），**"共现=违规"的推断方法本身有缺陷** —— 正确方法是按家族×背景的组合表核对，而非数同串 |
| R-4 | HotAnalysisResultPage 一处文件占 bg-warning-soft 的 13/19 —— 修复可以**单文件试点**验证方案 |

---
## 附录 A：历史轮次核查记录（压缩）

> 完整过程已压缩。每轮只保留**结论**与**对结论的改变**。

| 轮次 | 主题 | 关键结论 / 改变 |
|---|---|---|
| 1-6 | 首轮全面探查 | 建立 P0/P1/P2 分类；发现 PythonLab 调试、AI 密钥、门禁三类问题 |
| 7 | 课堂互动 / 小组讨论 / 迁移回放 | 发现迁移回放与生产不一致（→ P1-8）|
| 8 | XBK 并发锁实测 | 并发锁行为正确；**自我纠正 3 处** |
| 9 | SSE 并发容量 + 迁移回滚 | SSE 容量瓶颈（→ P1-9）；回滚可正常执行 |
| 10 | **全量复核 23 项** | 逐条重新验证；**修正了原报告的多处数字**（如 P0-1 的"5 个通过全是否路径"实为 2 个正路径）|
| 11 | 真实性复核 | 确认 23 项真实；**撤销 P2-5** |
| 12 | 三角度交叉验证 | 发现 **C-5（Celery Beat 未启动）**、**C-6（探针共用池）**；修正数字偏差 |
| 13 | 多角度纠错 | **撤销 1 项**；收窄 P0-1 的故障范围 |
| 14 | 多 Agent 交叉验证（5 验证员 + 1 红队）| 建立 U-1 ~ U-8 |
| 15 | UI / 设计系统专项 | 确认 U-1（对比度盲区）、U-2（报告可伪造）、U-3（fail-open）；**撤回 7 项 UI 误判** |
| 16 | UI 优化计划完成度核查 | 计划主体达标；发现"护栏未被真实证据走过"；合同 exit 1 |
| **17** | **本版整合重排** | **消除编号冲突；补齐解决方案；新增瘦身章节；修正 10 项误判** |

---

## 附录 B：证据资产清单

> 按用户要求**保留**，供后续复核。**不清理。**

### B.1 证据数据

| 资产 | 用途 |
|---|---|
| `/tmp/ui/` | 浏览器截图（含 `home_loggedin.png`）、对比度实测数据 |
| UI 报告（36 份）| `docs/docker/testing/ui-page-reports/` —— **全部 L0**（见第八章 8.4）|
| `frontend/test-results/pythonlab/` | PythonLab 烟测结果 |

### B.2 关键证据对应关系

| 结论 | 证据 |
|---|---|
| U-1 对比度 4.4510 | 浏览器实测 `rgb(100,116,139)` on `rgb(244,248,249)` |
| U-2 报告可伪造 | 全零 sha + 不存在的截图 → 门禁通过 |
| U-3 fail-open | 删基线键 → `--ci` EXIT=0 |
| U-11 色拼接失败 | `var(--ws-tag-blue)18` → `rgba(0,0,0,0)` |
| P0-5/6 | `backend/main.py:89`、`index.html`（9 CDN / 0 integrity）|
| P0-7 | `chat_blocking.py:67` + `analysis_service.py:76-77`（commit）|
| P1-1 | `pythonlab.py:481` + `docker_runtime.py:264-271` |

### B.3 复现命令

```bash
# 门禁状态
cd frontend && npm run -s ui:spacing:ci; echo "EXIT=$?"
cd frontend && npm run -s ui:audit:ci;   echo "EXIT=$?"
cd frontend && npm run -s ui:token-values:ci; echo "EXIT=$?"

# 文档合同
node scripts/check-markdown-contracts.mjs   # 当前 EXIT=0 ✅

# 快速统计
rg -oE 'text-\[[0-9]+px\]' frontend/src | wc -l        # B2: 目标 0
rg -c 'animate-spin' frontend/src -g '*.tsx' | wc -l     # B6: 16
```

---

## 附录 C：探查方法与验证分级

### C.1 三角度验证法

| 角度 | 方法 | 作用 |
|---|---|---|
| **① 静态** | 源码走读、依赖分析、正则统计 | 快速定位候选 |
| **② 运行时** | 真实栈实测、浏览器驱动、压测、日志取证 | **确认问题真实存在** |
| **③ 反证** | 主动寻找"它其实没问题"的证据 | **过滤误判**（本版撤回的 10 项全靠此关）|

> **只用角度①会产出大量误判** —— 本版 10 项撤回中 9 项源于此。

### C.2 验证分级（L0-L4）

| 级别 | 含义 | 本清单现状 |
|---|---|---|
| **L0** | 静态扫描 | **36 份 UI 报告全部是 L0** |
| L1 | 类型检查 + 构建 | 部分项目 |
| L2 | 单元测试 | 部分项目 |
| L3 | **真实浏览器** | **0 份** |
| L4 | 多视口视觉回归 | **0 份** |

**⇒ 本清单中所有标 ⚫"无法验证"的项，都因为缺 L3/L4 证据。**

### C.3 环境快照

| 项 | 值 |
|---|---|
| 容器 | 7 个（backend / typst-worker / frontend / pythonlab-worker / adminer / redis / postgres）|
| 栈模式 | **DEV**（`DEBUG=True`）|
| PostgreSQL 宿主端口 | 5433 |
| 前端 | Vite dev server（:6608）|
| 后端 | :8000 |
| 技术栈 | React 19 / TS 5.9 / Vite 8 / FastAPI 0.128 / SQLAlchemy 2.0 / PostgreSQL 16 / Redis 7.1 |

### C.4 纪律声明

- 本轮为**只读审计**，未修改任何产品代码
- 临时探针一律放 `/tmp`，未进项目目录
- 未在并发场景下登录浏览器（单账号互斥会踢掉其他会话）

---

## 附录 D：本版修订记录

| 日期 | 修订 |
|---|---|
| 2026-10-09（初版）| 九轮探查结果汇总 |
| 2026-10-09（第十五轮）| 新增 UI 专项审计（U-1 ~ U-8）与证据资产 |
| 2026-10-09（第十六轮）| 新增 UI 优化计划完成度核查 |
| **2026-10-09（第十七轮）** | **结构整合**：① 消除 `N-*` 编号冲突（拆为 C-*/U-*）② 每项补齐"现状/根因/解决方案/验证"四段式 ③ 新增第十章代码瘦身 ④ 新增第八章门禁健康度总评 ⑤ 历史轮次压缩入附录 A ⑥ 修正 10 项误判并记录 |
| **2026-10-09（第十八轮）** | **三维度复核 + Docker 全栈启动**：① 4 名验证员三维度复核 47 项 → 撤销 U-12、更正 U-7/P1-8/C-6、P0-7 转为"已击发" ② 生产栈启动发现 **D-1~D-5 五个启动阻断**（env 空串、迁移守卫、视图 stale、认证受控迁移、双数据库静默换库）③ 生产栈实测确证 X-3/P0-6 ④ D-4/D-5 已解决，数据源已统一（见第十四章 14.C）|
| **2026-10-09（第十九轮）** | **UI 深度实测 + 设计系统完善方案**：① 真实浏览器实测（Playwright 双视口）→ U-4/U-11 实锤、键盘焦点环正常、U-9/U-10 定性修正为"重建风险" ② 新发现 **D-6**（镜像 09-28 vs B 系列 10-05，tag 名不副实）③ 设计系统深挖：44 组同值不同名、语义塌陷 B1-B4、**7 条真实对比度违规**（success/warning 两族）④ 产出 P0-P6 完善方案（见第十五章）|
