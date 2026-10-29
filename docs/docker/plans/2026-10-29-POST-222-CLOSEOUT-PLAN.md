# 2.2.2 后续收口执行计划

> 状态：active
> Owner：release-ops
> 制定日期：2026-10-29
> 依据：本文所有“现状”均来自 2026-10-29 对生产与仓库的实测，标注了具体命令与输出。
> 未实测的项一律标「待确认」，不作推断。

## 零、当前状态（实测基线）

### 生产环境

```bash
$ docker ps --filter name=wangsh- --format "{{.Names}}|{{.Image}}|{{.Status}}"
wangsh-backend           shuhao07/wangsh-backend:2.2.2           Up (healthy)
wangsh-gateway           shuhao07/wangsh-gateway:2.2.2           Up (healthy)
wangsh-frontend          shuhao07/wangsh-frontend:2.2.2          Up (healthy)
wangsh-pythonlab-worker  shuhao07/wangsh-pythonlab-worker:2.2.1  Up (healthy)
wangsh-typst-worker      shuhao07/wangsh-typst-worker:2.2.1      Up (healthy)
wangsh-pythonlab-sandbox shuhao07/pythonlab-sandbox:2.2.1        Up
wangsh-postgres          postgres:16-alpine                     Up (healthy)
wangsh-redis-1           redis:7-alpine                         Up (healthy)
```

```bash
$ curl -s http://localhost:6608/api/health
{"status":"healthy","checks":{"database":"healthy","redis":"healthy"},
 "system":{"version":"2.2.2","environment":"production","debug_mode":false}}
```

```bash
$ psql -tAc "SELECT (SELECT count(*) FROM sys_users),
                    (SELECT count(*) FROM information_schema.tables WHERE table_schema='public'),
                    (SELECT version_num FROM alembic_version);"
433|55|20261026_0001
```

### 仓库

```bash
$ git rev-parse --short origin/main   # 4d774ec
$ git rev-list --count origin/main..HEAD   # 0（已全部推送）
$ git rev-parse --short main               # c2b1742（本地 main 落后 48 个提交）
```

tag `2.2.2` 已打并推送；GitHub Release `2.2.2` 已建并设为 Latest。

---

## 一、待办清单（按优先级，全部有实测依据）

### P0-1　连续对话 L3 验证（✅ 2026-10-29 已通过）

**现状**：`/tmp/verify-221/verify-2.2.1-dify-context.sh` 已存在且逻辑完备，
但**从未跑过**。2.2.1 与 2.2.2 的发布记录都把此项记为未完成。

**脚本设计**（已读源码确认）：第一轮给模型一个 4 位临时编号，第二轮追问该编号。
后端把历史折叠进 query（最近 4 轮 / 3000 字符），因此第二轮应能答出编号。
阶段一是「有界历史重放」，不带 `conversation_id`，所以两轮 `conversation_id`
不同属预期行为，脚本已注明。

**执行**：
```bash
ssh shuhao@wangsh.cn
cd /home/shuhao/wangsh-releases/2.2.0/source
ADMIN_USER=admin ADMIN_PASS=<密码> bash /tmp/verify-221/verify-2.2.1-dify-context.sh
```

**判定**：第二轮回答包含第一轮的 4 位编号 → PASS；答「不知道/未提及」→ FAIL。

**失败时的排查顺序**（避免误判）：
1. 先确认 `tests/ai_agents` 里 `build_bounded_query` 的单测是否通过（本地已是绿）
2. 再看后端日志中该请求的 `query` 字段是否真的带上了 `[历史对话]` 段
3. 只有在 2 成立而回答仍缺失时，才判定为 Dify 侧问题

**预估**：10–15 分钟（含一次实际调用约 30–60s）

---

### P0-2　SSE 长连接 L3 验证（✅ 2026-10-29 已通过）

**现状**：2.2.1 修了 Caddy 30 秒切断（`write 0`），但**没有独立的验证脚本**。
`/tmp/verify-221/` 下只有 health、score、dify-context 三个脚本。

**待确认项**：需要先确定用哪条 SSE 端点验证。已知后端注册了这些流式路径
（来自 `gateway/Caddyfile` 的 `@api_stream`）：
```
/api/v1/admin/stream
/api/v1/ai-agents/stream
/api/v1/ai-agents/analysis/*/stream
/api/v1/ai-agents/group-discussion/stream
/api/v1/classroom/admin/stream
```

**建议做法**：用 `/api/v1/ai-agents/stream` 发一次真实对话，
用 `curl -N --max-time 100` 保持连接并观察是否在 30 秒处被切断。
若 80 秒后仍能收到心跳/数据 → PASS。

**为什么这条重要**：Caddy 的 `write` 是整条连接的绝对截止时间，且**省略即默认 30s**。
2.2.1 之前所有 SSE 都在 30 秒断开——这是用户可感知的严重问题（长回答被腰斩）。
修了但没验证，等于没有证据。

**注意**：验证前需确认该端点要求的鉴权与参数，不能凭空构造请求。
如果端点需要特定业务上下文（比如必须有一个进行中的分析任务），
应改用 classroom 的 SSE（可以自己创建活动），避免依赖第三方状态。

**预估**：20–30 分钟（含摸清端点参数）

---

### P0-3　评分成功率不是 100%（✅ 已实现，待部署验证）

**现状（实测）**：

```bash
$ docker logs wangsh-backend --since 40m | grep "POST /api/v1/ai-partner/evaluate" \
    | grep -oE 'HTTP/1.1" [0-9]+' | sort | uniq -c
      4 HTTP/1.1" 200
      1 HTTP/1.1" 502
```

**近 5 次评分 4 次成功、1 次 502（80%）**。

**失败根因（已抓到样本）**：模型输出的 JSON 在括号内部有语法错误
（实测抓到一例：`dimensions` 段 `{` 有 5 个但 `}` 只有 4 个，
`json.loads` 报 `Expecting ',' delimiter: line 1 column 1839`）。
这不是我们的代码问题，但用户会看到 502。

**三个可选方案，需老大决策**：

| 方案 | 做法 | 优点 | 代价 |
|---|---|---|---|
| A. 自动重试一次 | 捕获解析失败后重新调一次模型 | 成功率可从 80% 提到 ~96%（按独立事件估算），改动小 | 单次失败时耗时翻倍（最坏 160s），需同步放宽锁与网关超时 |
| B. 提示词加固 | 在 SYSTEM_PROMPT 里强调 JSON 严格性、给正例 | 从源头降低概率 | 效果不可控，需重新实测验证 |
| C. 接受现状 | 用户重试即可 | 零改动 | 用户体验受损，课堂场景下会尴尬 |

**我的建议：A + B 同时做**。B 成本低且可能直接降低失败率；A 兜底。
若只选一个，选 A（确定性收益）。

**注意（防止误判）**：A 方案会让 `EVALUATION_LOCK_TTL_SECONDS` 不够用——
当前 90s，两次 80s 预算会超。必须同步调整，否则同用户并发会双跑评分。
这一点在实施前必须算清楚，不能只改重试不改锁。

**预估**：B 需 30 分钟；A 需 1 小时（含锁/超时重算与测试）

---

### P1-1　三个 worker 镜像版本不一致（✅ 2026-10-29 已对齐 2.2.2）

**现状（实测）**：三个 worker 与 backend **同源**：

```bash
$ grep -A 6 "^  typst-worker:" docker-compose.yml | grep -E "build:|context:|dockerfile:"
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
```
`pythonlab-worker` 完全相同。

即三个 worker 与 backend 用同一份 backend 代码构建，但**跑的是 2.2.1 镜像**：

```bash
$ docker exec wangsh-pythonlab-worker grep -c "_normalize_dimensions" \
    /app/app/services/ai_partner_evaluation.py
0     # ← 旧代码
$ docker exec wangsh-typst-worker grep -c "_normalize_dimensions" ...
0     # ← 旧代码
```

**影响评估（区分事实与推断）**：
- **事实**：这两个容器内的 `ai_partner_evaluation.py` 等文件是旧版。
- **事实**：Celery 任务通过 `apply_async` 派发，worker 侧会 import 任务模块。
- **推断（未实测）**：评分走的是 HTTP 同步路径，不经过 Celery，因此
  **评分本身不受影响**（这也与实测吻合：评分 200 正常）。
- **风险点**：如果某个 Celery 任务在未来引用了新代码里的函数（例如
  `_normalize_dimensions`、或拆出去的 `classroom_queries`），worker 会
  `ImportError`。当前没有证据表明已发生，但这是隐患。

**建议**：重建这两个 worker 到 2.2.2，消除版本漂移。
代价很小（同源镜像，构建一次即可），收益是集群内所有容器版本一致、
排查问题时不需要先确认「哪个容器是哪个版本」。

**预估**：15 分钟（构建 + 重启，worker 重启不影响 HTTP 服务）

---

### P1-2　本地 main 分支落后（已实测）

**现状**：`main` = `c2b1742`，`origin/main` = `4d774ec`，落后 48 个提交。

**为什么没做**：主仓库 `/Users/wsh/wangsh` 检出着 main，我的会话被沙箱隔离，
git 命令无法指向那个检出。

**执行**（老大手动，一条命令）：
```bash
cd /Users/wsh/wangsh && git pull --ff-only
```
之前阻塞它的两个文件冲突已由我处理（`TEST_STATUS.md`、`package-lock.json`
已同步为远程版本，备份在 `/tmp/main-backup-20261029/`）。

**预估**：1 分钟

---

### P2-1　清理服务器诊断脚本（低优先）

**现状**：服务器 `/tmp` 与容器 `/tmp` 下留有我的诊断脚本：
`p6.py`、`pd.py`、`ps.py`、`prp.py`、`pep.py`、`pe.py`、`pj.py`、`pf.py`、
`v.py`、`fail-sample-*.txt`，以及宿主 `/tmp/ai_pe.py`、`Caddyfile.new`、
`source-backup-before-222-*.tgz`、`wangsh-sync-*` 目录。

**影响**：不影响运行，但属残留，且 `wangsh-sync-*` 占磁盘。

**建议**：确认 2.2.2 稳定运行几天后再清理备份；诊断脚本可立即清理。

---

### P2-2　文档复核（低优先，需一次性做完）

**现状**：本轮已订正 4 处失真，但**没有再全量复核一遍**。已知可能仍有：
- `docs/features/ASSESSMENT.md` 的 head 记录（实测正确，无需改）
- 各文档中的 `55 表` 断言（当前实测仍 55，正确）
- `DEPLOY.md` 中关于 `REDIS_HOST` 的说明已订正

**建议**：跑一次文档合同检查，再抽查 3–5 份与本次改动相关的文档。
不做全仓通读（仓库大，收益低）。

---

## 二、执行顺序与依赖

```
第 1 步：P0-1 连续对话验证 ──┐
第 2 步：P0-2 SSE 验证      ──┤ 互不依赖，都只读生产，可连续做
                              │
第 3 步：P0-3 评分成功率决策 ←┘ 依赖老大选 A/B/C
                              │
第 4 步：P1-1 重建 worker    ← 可与第 3 步并行，但需先确认第 3 步不改后端代码
                              │
第 5 步：P1-2 本地 main 同步 ← 老大手动，随时可做
```

**关键约束**：
- 第 1、2 步是纯验证，不改代码，风险为零，应最先做——先拿到事实再决定改什么。
- 第 3 步若选 A，会改后端代码，必须**在 P1-1 重建 worker 之前**完成，
  否则 worker 又要重建一次。
- 所有涉及重建的操作，部署后必须做「镜像内代码特征验证」
  （`docker exec grep <新符号>`），不能只看健康检查——这是 2.2.1 的教训。

---

## 三、每一步的验证判定标准

| 步骤 | 通过标准 | 不通过的处置 |
|---|---|---|
| P0-1 连续对话 | 第二轮回答含第一轮编号 | 按上文三步排查，区分「历史没传」与「Dify 没用好历史」 |
| P0-2 SSE | 连接维持 ≥80 秒不断 | 检查 Caddy `write 0` 是否生效、`@api_stream` 路径是否匹配 |
| P0-3 评分 | 连续 5 次调用 ≥4 次 200（维持现状）或更高 | 若低于 4/5，说明改动有回归，立即回滚 |
| P1-1 worker | 三容器镜像均为 2.2.2，且 `grep` 到新符号 | 单独回滚该容器到 2.2.1（不影响 HTTP 服务） |
| P1-2 本地 main | `git status` 干净且 HEAD = `4d774ec` | —— |

---

## 四、明确不做的事（避免范围蔓延）

- **不做** `pg_stat_statements` 安装（需要重启 PostgreSQL，生产中断风险，
  且当前没有性能问题证据）
- **不做** XBK 导入批量化（需先给 `guard_course_change` 做预取，
  是数量级更大的改动，不在本次收口范围）
- **不做** keyset 分页（实测最深处 12000 行 offset 仅 2.2ms，无收益）
- **不删除** 任何远端分支或标签（上一轮已整理完毕）
- **不改** 数据库结构（本轮无迁移需求）

---

## 五、回滚预案

| 场景 | 回滚方式 |
|---|---|
| P0-3 改动导致评分回归 | 回滚 backend 镜像到 `2.2.2` 当前 tag 的前一个构建（需先给当前 2.2.2 打一个 `2.2.2-hotfix` 备查） |
| P1-1 worker 重建出问题 | `docker compose up -d --no-deps typst-worker pythonlab-worker` 并临时把 `.env` 的 `IMAGE_TAG` 指回 2.2.1 只重建这两个 |

**注意**：回滚 worker 时 `.env` 的 `IMAGE_TAG` 是全局的，单独回滚某个容器需要
用 `docker run` 指定镜像或临时改 compose，操作前必须先确认方式，
不能想当然认为改 `.env` 就只影响一个容器。

---

## 六、执行结果（2026-10-29 实测）

| 项 | 结果 | 证据 |
|---|---|---|
| P0-1 连续对话 | ✅ **PASS** | 第一轮给编号 4831，第二轮回答包含该编号 |
| P0-2 SSE 长连接 | ✅ **PASS** | `classroom/admin/stream` 连接持续 90s，6 次 keepalive；30s 限制确认解除 |
| P0-3 评分成功率 | ⚠️ **部分** | 重试挽回 2/3 坏输出，成功率仍 80%；追加分块抢救待部署 |
| P1-1 worker 对齐 | ✅ 完成 | 7 个容器统一 2.2.2；sandbox 保持 2.2.1（Dockerfile 无改动） |
| P2-2 文档复核 | ✅ 完成 | 根脚本 89/89；订正 AI_AGENTS 两处 |

### 计划外的重大发现

**`DetachedInstanceError` 导致流式对话高频 503**（已修为 `293b24f`）。

`_AGENT_CACHE` 直接缓存 ORM 实例，而 ORM 实例绑定在创建它的 session 上。
session 关闭后变 detached，刷新属性即抛异常。生产实测
`POST /api/v1/ai-agents/stream` **3 次里 2 次 503**「读取智能体配置失败」——
用户点开 AI 智能体对话大概率看不到回答，而健康检查完全显示不出来。

修法：缓存改存列数据快照，命中时重建游离实例。修复后连续 6 次全部 200。

### P0-3 的实测修正

原计划估算「重试可把成功率从 80% 提到 96%」，**实测不成立**：
5 次请求 3 次触发重试、2 次救回、1 次失败，挽回率 67%，成功率仍 80%。

后续分析真实失败样本发现：模型写坏 JSON 时**数据本身是完好的**，
只是包裹结构错。于是追加「分块抢救」——分别取出 dimensions 与 suggestions
重建，可省掉 20–40 秒的重调。本地用真实样本验证通过，**尚未部署**。

---

## 七、部署节奏约定（2026-10-29 老大确认）

**改为「本地开发、攒批部署」**，不再边改边传服务器。

原因：此前一轮在服务器上做了 6 次镜像重建 + 6 次容器重启。
`docker compose up -d` 会中断服务 30–60 秒，`build` 会抢占 CPU/内存，
把生产当开发环境用会影响正在使用系统的师生。

新流程：
1. 所有改动**在本地完成**并跑全量测试
2. **攒成一个版本**，不零散部署
3. 部署前**先确认时机**，一次只中断一次

### 服务器与 main 的一致性（已核对）

2026-10-29 全量比对（排除 `data/`、`backups/`、`.env*`、`*.bak*`）：

- **运行代码 100% 一致**（backend / frontend / gateway 零差异）
- `docker-compose.yml` 一致
- 发现 `.env.example` 停在 2.2.0、3 份文档与 1 个测试文件落后 → **已补齐**

结论：服务器不存在「自己改的代码」，因为它根本不是 git 仓库（纯拷贝目录），
代码方向始终是 本地 → main → 服务器。但手动 `scp` **确实会漏文件**
（`.env.example` 就是证据），一致性只能靠事后比对发现，没有自动校验。
