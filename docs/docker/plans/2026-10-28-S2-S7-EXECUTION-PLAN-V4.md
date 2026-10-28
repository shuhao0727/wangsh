# S2 ~ S7 执行计划（v4，基于探针实测重制）

> 状态：active
> Owner：project-governance
> 制定日期：2026-10-28
> 取代：[v3 计划](2026-10-27-S1-S7-VERIFICATION-PLAN-V3.md)（S1 部分已完成，S2~S7 部分被本文件取代）
> 清单依据：[S4~S7 条目清单](2026-10-28-S4-S7-ITEM-MANIFEST.md)
> 调研方式：两个独立探针 Agent 只读调研 + 主控逐条复核关键结论

---

## 〇、相对 v3 的关键变更

v3 是在**不知道代码实际状态**时写的。探针实测后，有五处必须改：

| # | v3 的说法 | 实测结果 | 影响 |
|---|---|---|---|
| 1 | D3 档位用 `frontend:dev` | **它是 10-22 的 Caddy 生产形态镜像，不是开发镜像** | 不改就用旧代码验证，结论无效 |
| 2 | S3 6 项 | `7645024` 已被 `9f84619` 整体删除，**无验证对象** | S3 实际 5 项 + 1 项处置 |
| 3 | S4 9 项按回归验证 | **6 项被回滚**，其中 `4a448a9` 当前会 500 | 不是验证，是需重新修复 |
| 4 | S5 8 项、S6 6 项 | 分别只剩 **4 项、2 项**可验 | 工作量大幅缩小 |
| 5 | S3-5 `4ffdb31` 按提交逐字段验收 | 一半字段被 `4ea3d69` 判死 | 按提交验收会永远过不了 |

**根本原因**：`9f84619`（2026-10-16「回滚合并引入的前端/业务代码」）是一个大范围回滚，
删掉了 S4 六项、S5 四项、S6 三项的实质代码。原计划把「已发布修复」一律当回归验证，
但其中相当一部分对象已经不存在了。

---

## 一、前置：先重建正确的 `frontend:dev`

**这是所有 D3 验证的前提，必须先做。**

`frontend/Dockerfile.dev` 有三个 stage：

```
FROM node:20-alpine AS development     ← 第 7 行，Vite 开发服务器，EXPOSE 6608
FROM node:lts-alpine3.23 AS builder    ← 第 53 行
FROM caddy:latest AS production        ← 第 90 行，静态站，EXPOSE 80
```

`docker build frontend` **不带 `--target` 会构建最后一个 stage（production）**。
现有的 `shuhao07/wangsh-frontend:dev` 就是这样产生的（2026-10-22，`CMD caddy run`）。

**正确命令：**

```bash
# frontend/ 下只有 Dockerfile.dev / Dockerfile.prod，没有 Dockerfile，
# 必须显式 -f，否则报 `failed to read dockerfile: open Dockerfile: no such file or directory`
docker build -f frontend/Dockerfile.dev --target development -t shuhao07/wangsh-frontend:dev frontend
```

**验收断言：**

| 断言 | 期望值 |
|---|---|
| `docker image inspect --format '{{.Config.ExposedPorts}}'` | 含 `6608/tcp`（不是 80） |
| `{{.Config.Cmd}}` | 含 `vite`（不是 `caddy run`） |
| 容器内 `vite --version` | 与 `package.json` 一致 |
| 构建时间 | 晚于 HEAD 提交时间 |

**风险**：重建后若与现有开发栈用法不符，需同步确认 `docker-compose.dev.yml` 的 frontend
服务（它用的是 `node:20-alpine` + 源码挂载，**不引用这个镜像**）。

---

## 二、S2 崩溃级（3 项）

### 执行顺序

```
S2-0（前置）重建 frontend:dev
   ↓
S2-3 验证 dev 镜像可构建且可启动
   ↓
S2-1 空库 bootstrap（两条路径、两个新库）
   ↓
S2-2 前端回退（一条命令 + 引用 S1-7）
```

### S2-3 `:dev` 镜像可构建且可启动

| 检查项 | 断言 | 档位 |
|---|---|---|
| backend:dev 启动 | `/health` 返回 200 且 `status=healthy` | D2 |
| backend:dev 内容 | `alembic heads` 为单 head `20261026_0001` | D2 |
| typst-worker:dev | 日志出现 `celery@... ready.` | D2 |
| pythonlab-worker:dev | 日志出现周期性清理任务 succeeded | D2 |
| frontend:dev 形态 | EXPOSE 6608 + CMD 含 vite（见第一节） | 静态 |

### S2-1 空库 bootstrap（`312f387`）

**表数基线：55 条 = 54 BASE TABLE + 1 VIEW**（三重证据：开发库实测、S1-3 空库实测、模型 53+1）

**两条路径必须都跑，各用一个全新库：**

| 路径 | 命令 | 覆盖的修复点 |
|---|---|---|
| A. 完整部署链 | `check_migration_state.py` → `bootstrap_db.py --initial-only` → `alembic upgrade head` → `bootstrap_db.py` | `bootstrap_db.py` 的 `MIGRATION_ORIGIN_COLUMNS` |
| B. 裸 `upgrade head` | 仅 `alembic upgrade head` | `20260211_0004` 的视图守卫 |

**断言清单：**

- `information_schema.tables` = 55（54 基表 + 1 视图）
- `v_conversations_with_deleted` 存在且 14 列
- `alembic heads` 单 head `20261026_0001`
- 5 个关键索引存在（3 个 XBK `grade`、2 个文章样式）
- 49 个序列

**部署必经步骤（S2-1 不覆盖，但必须写明）**

空库 bootstrap 完成后，`auth_authority` 这个部署闸门是 **CLOSED** 的（模型注释：
`Migration starts CLOSED; never auto-open`）。此时前后台**全部无法登录**（返回 503），
这不是缺陷，是有意设计——避免未完成运维前置的环境被误用。

开通需走 `backend/app/api/endpoints/auth/cutover.py`，它要求显式提供 `database_url`、
`redis_url`、`operator`、`paired_snapshot_id`、`freeze_evidence`，并记录
`legacy_writers_stopped` / `inflight_drained` / `account_writes_frozen` /
`redis_auth_writes_frozen` 四项运维冻结证据。**这是正式部署流程，不是 bootstrap 的一部分。**

因此 S2-1 的验证范围明确**不含 auth 开通**：断言只到「55 张表 / 视图 / 索引 / 序列 / 单 head」，
不验证登录可用性。任何需要登录的后续验证（S3-1、S3-4 等）都必须自行处理闸门状态。

**坑**：

1. **失败后不能重跑同一库**。`bootstrap_db.py` 在 `alembic_version` 存在但为空时直接
   `RuntimeError`。每次失败必须换新库。
2. `MIGRATION_ORIGIN_COLUMNS` 是白名单式的——以后模型再加「由后置迁移添加」的列，
   忘了登记就会 `DuplicateColumn` 静默回归。
3. `DEPLOY.md:871` 说「不要在空库裸跑 Alembic（标识超 32 字符）」，但
   `alembic_compat.py` 已自动扩到 `VARCHAR(64)`。**若路径 B 实测通过，这条文档需订正。**

### S2-2 前端整体回退（`cba3c0e`）

**判为「由 S1-7 覆盖」，不重复执行。**

理由：S2-2 的唯一可观测面（外观、布局、无 JS 崩溃）与 S1-7 完全相同，重复执行不产生新信息。

**但要补一条命令级确认 + 一处风险声明：**

```bash
git merge-base --is-ancestor cba3c0e HEAD && echo ok
```

**风险声明（必须写进报告）**：S1-7 用的前端产物**没有在 TEST_STATUS 里记录**。
如果当时用的是 `frontend:dev`（10-22 生产镜像），那「pageerror=0」证明的是 10-22 的代码，
不是 HEAD。**这一条无法回溯确认，必须在报告中如实标注为未验证前提。**

---

## 三、S3 阻断级（5 项可验 + 1 项处置）

### 分组与并行

| 组 | 项 | 环境 | 并行性 |
|---|---|---|---|
| **G1** | S3-2 评分智能体空值 | 一次性 PG + Redis + `:dev` 后端 | 可与其他组并行 |
| **G2** | S3-4 GDPR 导出兜底 | 一次性 PG + `:dev` 后端 | 可并行 |
| **G3** | S3-1 KNN UUID + S3-3 KaTeX 字体 | **共用**一套 Caddy + 前端 + 后端 + PG | 两项合并在同一 D3 栈 |
| **G4** | S3-5 中间状态恢复（重定义） | vitest（无环境）+ 并入 G3 | 部分可并行 |
| **G5** | S3-6 批量变更守卫 | 无 | **不做实例验证** |

### S3-1 KNN HTTP UUID（`b2d97a7`）

**构造非安全上下文是最大障碍**：

- `127.0.0.1` / `localhost` 是**安全上下文**，用它验不出问题
- Vite 8 默认 `allowedHosts` 只放行 localhost/IP，用 `knn.test` 会被 `Blocked request`

**唯一干净解**：Caddy 反代 + `header_up Host localhost`，不改 `vite.config.ts`、不改系统 hosts。

**检查项：**

| 检查项 | 断言 |
|---|---|
| 非安全上下文 | `window.isSecureContext === false`（前置，不成立则整项无效） |
| 提交成功 | 填写 → 核对 → 提交，`pageerror=0` |
| request_id 格式 | 符合 UUID v4 正则 |
| 重试一致性 | 首包失败后重试，`request_id` 与首包**完全相同** |
| 负向（可选） | 抹掉 `crypto.getRandomValues` → 出现「当前浏览器暂不支持提交」提示，未发出请求 |

**数据前置**：开发库 `it_knn_batches` 为 **0 行**，必须自建一个 open 状态、名单含测试学号的批次。

### S3-2 评分智能体空值（`7a4af95`）

**该项未失效**，仍在主路径。检查项：

| 检查项 | 断言 |
|---|---|
| 空值启动 | `AI_PARTNER_SCORING_AGENT_ID=` 空串时进程不退出，`/health` 200 |
| 业务行为 | 评分端点返回 **503**（不是 500） |
| 负向 | `AI_PARTNER_SCORING_AGENT_ID=abc` 时启动**失败**（rc≠0，日志含 ValidationError） |

**坑**：不要用开发栈当证据（它现在就是空值在跑且 healthy，属「观察记录」，不可冻结）。必须用一次性容器，且看 `/health` 而不是容器 `Up`（`restart: unless-stopped` 会让崩溃容器反复重启）。

### S3-3 KaTeX 本地字体（`c3f0de4`）

**断言必须收窄**——KaTeX 的 **JS 仍在 jsdelivr**（CSP 也允许），只有 CSS/字体同源。

| 检查项 | 断言 |
|---|---|
| 静态 | `index.html` 无 `katex.min.css` 链接 |
| 静态 | 主 CSS 中 `KaTeX_*` 资源均为 `/assets/` 同源 |
| 运行 | 打开渲染公式的页面，**无** `cdn.jsdelivr.net/**/KaTeX_*.woff*` 请求 |
| 运行 | **有** `/assets/KaTeX_*.woff2` 且 200 |
| CSP | `font-src` 仍不含 jsdelivr |

**数据前置**：`/informatics` 无已发布内容，需自造 typst 内容或用 AI 聊天页注入公式。

### S3-4 GDPR 导出兜底（`6abef78`）

**注意这是写操作**（会写 `sys_audit_logs`），必须用一次性库。

| 检查项 | 断言 |
|---|---|
| 基线先于修复 | 用 `6abef78^` 的代码跑同一场景 → **500 / AttributeError** |
| 修复后 | 同一场景 → **200**，`discussion_messages_count >= 1` |
| 字段 | `discussion_messages[0]["message_type"] is None`，`content` 正确 |

**坑**：端点路径是 `/api/v1/users/privacy/me/export`（不是 `/privacy/me/export`）。开发库无讨论消息，必须自建。

### S3-5 中间状态恢复（`4ffdb31`）—— **必须重定义检查项**

**原计划按提交逐字段验收是错的**：`4ea3d69`（10-26 热点分析重构）已覆盖式改写，
`normalize.ts` 里一半字段只剩定义、无消费者。

**实际还活着的两条链：**

| 链 | 检查项 | 方式 |
|---|---|---|
| **链 1：SSE 错误码 → 用户文案** | 后端 7 个 code 都能被 `getStreamErrorMessage` 命中并给出中文文案 | vitest 12 项 + D3 断言气泡文案为中文且**不出现原始 code** |
| **链 2：热点结果页** | 空态渲染、`pageerror=0` | vitest 17 项 + D3 |

**报告中必须显式列出「已被 `4ea3d69` 取代、不作为检查项」的字段清单。**

### S3-6 批量变更守卫（`7645024`）—— **判为已失效**

**验证对象不存在**：`9f84619` 删除了该提交的全部 7 个文件（`useBatchMutation.ts`、
`usePagination.ts`、`pagination.ts`、`errorHandling.ts`、`dateFormat.ts`、
`useStandaloneReturn.ts`、`sharedUtilitiesHooks.test.tsx`），`rg` 零命中。

**处置：**

- 判定为「提交已被 revert，无验证对象」，**不占 S3 配额**
- **记账**：`docs/docker/RELEASE_NOTES.md` 仍保留该提交的「未发布基础：共享前端工具与导航」段落——
  文档还在宣传一个已被删除的能力。**本轮只记录，不擅自删。**

---

## 四、S4 错误级（2 项完整 + 4 项部分 + 1 项需修复）

详见 [MANIFEST 第二节](2026-10-28-S4-S7-ITEM-MANIFEST.md)。

### 批次 A：XBK 年级约束（`e74bb61`，2 项，代码完整）

| 检查项 | 断言 | 档位 |
|---|---|---|
| 选课年级约束 | 高一学生选仅高二课程 → **409**，detail 含「仅面向」 | D2 |
| 年级优先于容量 | 同一场景把 quota 设 0 → 仍报**年级错误**而非「课程已满」 | D2 |
| 导入缺列 | 缺「各班限报人数」的课程文件 → **422** 且带行号 | D2 |

**坑**：`e74bb61` 是 106 文件的大 release 提交，其中 KNN 采集、导出拆分等**不属于** S4。
验证范围必须限定在 `grade_scope` + 导入校验。

### 批次 B：其他 6 项（需先判定存活范围）

| 项 | 状态 | 处置 |
|---|---|---|
| `4a448a9` 用户唯一性 | ❌ **需重新修复** | 两处缺 `.limit(1)`，当前会 500 |
| `14aeba9` 学习进度 | ⚠️ 部分 | 降级为验证「基本保存持久化」 |
| `888f32b` 导入加固 | ⚠️ 部分 | 畸形文件当前会 500，需修复后才能验 |
| `73853e2` 文章搜索 | ⚠️ 部分 | 只验公开端 `q`；后台只验标题过滤 |
| `2171d6d` 移动端 | ⚠️ 部分 | 只验「375px 无横向溢出」，**不验折叠目录** |
| `17709be` PDF | ⚠️ 部分 | 断言 **404**（不是 403） |
| `903eb00` PythonLab | ✅ 完整 | 用 fake-Docker 测试对，**不造真实容器** |

**`903eb00` 特别说明**：`cleanup_orphans` 是 **Celery Beat 每 300 秒自动跑**的，
且开发栈挂载了 `/var/run/docker.sock`。**在开发栈里造 `pythonlab_u*` 容器会被后台任务扫走，
还可能误删其他 namespace 的容器。** 用 fake-Docker + 真实 Redis 的路径验证判定逻辑即可。

---

## 五、S5 体验级（4 项可验 + 1 项部分）

| 项 | 状态 | 验证方式 |
|---|---|---|
| `76cb9c3` 骨架屏 | ✅ | DOM 断言 `min-h-20` |
| `02805bc` 使用记录详情 | ✅ | 真实浏览器 + 视觉 |
| `78b86de` 嵌入式布局 | ✅ | 真实浏览器 + 视觉 |
| `8f711f8` Three.js 0.180 | ✅ | 版本断言 + `build:check` |
| `7895d9d` alpha/rgb | ⚠️ 部分 | 部分门禁脚本已删 |
| `531e323` 色彩 token | ❌ 已回滚 | 不做验证 |
| `7d29c07` Mermaid 懒加载 | ❌ 已回滚 | 不做验证 |
| `51cf5c0` Caddy 目录条目 | ❌ 已回滚 | 不做验证 |

---

## 六、S6 质量级（2 项）

### `b77d849` 往返次数

**量测手段（有现成的，不用改代码）**：

- `SQLALCHEMY_ECHO=true` 重启后端，数日志里的 `SELECT` 行数
- 或复用 `test_conversation_list_isolated.py:375` 的 `before_cursor_execute` 计数器

**对照基线**：`b77d849` 的父提交是 `6d694b1`，用 `git worktree add /tmp/base 6d694b1` 起第二份代码。

**断言**：同一场景下 `M < N` 且 `M == 1`（26 班 × 20 课，改动前最坏 520 次，改动后 1 次）。

**坑**：`selection_rules.py` 现在的函数名与 `b77d849` 时不同（`ae658df` 又抽了一次），
diff 不能直接按提交号对着看。

### `cd868f8` echarts 产物

**断言**：`npm run build:check`，`echarts-vendor` chunk 存在且约 584KB（全量版 1,035KB）。

**必测回归**：`RadarChart.tsx` 用 `renderer:"svg"`，缺 `SVGRenderer` 时会**静默回落到 Canvas，图全黑**。
必须断言 DOM 里是 `<svg>` 而非 `<canvas>`，采样像素非全黑。

### 其余 4 项

`9f1e7b2`、`c2ff823` **已回滚，不做验证**；`63c362b`、`625356c` 只跑门禁。

---

## 七、S7 工程级（一次性门禁收口）

**S7 没有一项需要起容器做实例验证。**

```bash
cd frontend && npm run test:scripts && npm run ui:audit:ci
cd backend && pytest -q
node scripts/check-markdown-contracts.mjs
python backend/scripts/check_migration_guard.py
```

按 [MANIFEST 第五节](2026-10-28-S4-S7-ITEM-MANIFEST.md) 分类逐条标注豁免依据：

- **A 类纯文档（约 28 项）**：豁免实例验证，只需文档合同检查
- **B 类 CI（4 项）**：`node --test scripts/*.test.mjs`
- **C 类测试基建（5 项）**：跑对应测试目录
- **D 类零行为重构（3 项）**：门禁

**必须剔除**：`c2440ff`（不在 HEAD）、`fc28b14`（WIP 快照，非真实提交）。

---

## 八、需要用户决定的事

| # | 事项 | 选项 |
|---|---|---|
| 1 | **S4 的 6 项已被回滚，是先验证还是先修复？** | (a) 只验存活的（5 项），其余记为「需重新立项」<br>(b) 先修复再验证（`4a448a9` 只需 2 行，收益最高）<br>(c) 全部记为历史，S4 只做 XBK 批次 |
| 2 | S5 的 3 项已回滚，是否重新开发？ | token 体系与 Mermaid 懒加载改动量大，需评估 |
| 3 | `RELEASE_NOTES.md` 里 `7645024` 的残留宣传段落是否清理？ | 建议清理并记账 |
| 4 | `DEPLOY.md:871` 的「不能裸跑 Alembic」是否订正？ | 取决于 S2-1 路径 B 的实测结果 |

---

## 九、执行顺序总表

| 顺序 | 内容 | 前置 | 预计 |
|---|---|---|---|
| 1 | **重建 `frontend:dev`**（`--target development`） | 无 | 短 |
| 2 | S2-3 dev 镜像验证 | 1 | 短 |
| 3 | S2-1 空库 bootstrap（两路径两库） | 2 | 中 |
| 4 | S2-2 前端回退（命令 + 引用 S1-7） | 无 | 极短 |
| 5 | S3-G1 评分智能体空值 | 2 | 短 |
| 6 | S3-G2 GDPR 导出 | 2 | 中 |
| 7 | S3-G3 KNN + KaTeX（共用 D3 栈） | 1, 2 | 长 |
| 8 | S3-G4 4ffdb31 重定义 | 1, 7（部分） | 中 |
| 9 | S3-G5 7645024 判失效 | 无 | 极短 |
| 10 | S4 批次 A（XBK 2 项） | 2 | 中 |
| 11 | S4 批次 B（按用户决定） | 用户决策 | 视情况 |
| 12 | S5（4 项） | 1, 2 | 中 |
| 13 | S6（2 项） | 2 | 中 |
| 14 | S7 门禁收口 | 无 | 短 |

---

## 十、与 v3 的规则继承

v3 的 10 条规则（已在 `ENGINEERING_GOVERNANCE.md` §十二）**全部继续适用**，无变更。
本文件只调整「验证什么」和「按什么顺序」，不改变验证方法论。
