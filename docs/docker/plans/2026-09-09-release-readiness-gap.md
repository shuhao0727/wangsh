# 发布就绪差距清单（v1.6.0）

> 状态：active
> Owner：project-governance
> 最近复核：2026-09-09
> 归档条件：工作区修复完成拆分提交与推送、门禁全绿、用户决策项全部关闭后，长期结论并入 RELEASE_NOTES 并归档。

本清单是[审计台账](2026-09-08-project-audit-findings.md)的派生发布视图：以台账最新批次
（2026-09-09 全面修复整合）为准，并对照 2026-09-09 实际工作区源码逐条复核。
动态测试数字以 [TEST_STATUS](../testing/TEST_STATUS.md) 为准；源码状态以工作区当前文件为准。

## 一、24 条逐条现状（源码核对）

| ID | 级别 | 当前状态 | 发布前剩余 |
|---|---|---|---|
| XBK-01 | P1 | 未修：students/courses 更新仍直接改自然键，无拒绝/级联 | 用户决策：拒绝更名 or 级联迁移 |
| XBK-02 | P1 | 已修：手工/导入共享字段校验；导入预检与执行同期间核验有效父实体 | 真实名册回归；父实体并发删除锁 |
| XBK-03 | P1 | 已修：upsert 写入原子核验身份，冲突整批回滚 | 合法同 key 并发的计数语义 |
| XBK-04 | P2 | 已修：schemas/xbk/validation.py 共享非空/长度/NUL 合同 | 真实库边界回归 |
| XBK-05 | P2 | 已修：exports/common.py force_text_cells 全导出入口 | 真实 Excel 打开验证 |
| XBK-06 | P2 | **已修**：Xbk/index.tsx loadSummary 已有 summaryRequestSeqRef 代次保护（台账已同步） | 浏览器乱序回归 |
| XBK-07 | P2 | 部分修：年级口径已 coalesce；无选课虚拟行仍漏导（导出仍从 XbkSelection 出发） | 列表与导出共用行语义 |
| AUTH-01 | P1 | 已修（最小修复）：access 无效回退 refresh 撤销，cache 故障不撤回 DB 撤销 | 真实 PG/Redis 双存储故障验收；原子性未闭环 |
| AUTH-02 | P1 | **已入工作区并已迁移正常库**：DB 持久权威 + 显式 enrollment（`session_family.py`/迁移 `20260910_0001_auth_authority`），gate 已开启；真实代理链已验收（2026-09-11），S7 转发头 peer 可信范围已治理 | TTL/迁移边界验收 |
| AUTH-03 | P1 | 外部候选未应用（resolve_legacy_subject 仍 OR + scalar_one_or_none） | 不可变身份与旧 token 过渡决策 |
| AUTH-04 | P2 | 未修：凭据变更不撤销既有会话 | 用户决策撤销合同 |
| BIZ-01 | P1 | 已修：通用内容列表仅返回 owner_id 为空的公共内容 | 真实权限 E2E |
| BIZ-02 | P1 | 已修：结果接口白名单 submitted/graded，进行中 422 | 真实 PG/并发/AI 长事务 |
| BIZ-03 | P2 | 已修：个人画像详情校验 individual + 本人归属 | 真实 PG/画像 E2E |
| BIZ-04 | P2 | 已修：列表与新建共用 timezone-aware 时间窗判断 | PG 时区/DST 验收 |
| BIZ-05 | P2 | 已修：可选 agent_id 查本人全部 session，按最新时间/ID 聚合 | 大历史性能；preview 最新性台账内表述不一致，需 owner 定稿 |
| FE-01 | P1 | 已修：AIAgents/index.tsx 请求代次 ref，身份/agent 变更即递增 | 完整 E2E/真实供应商 |
| FE-02 | P2 | 未修：跨筛选批量删除仍无目标明细确认 | 用户决策选择语义 |
| FE-03 | P1 | 已修：保存/交卷互斥、失败草稿保留、显式重试 | 真实浏览器 pointer/网络延迟 E2E；PG 同时事务 |
| FE-04 | P1 | 已修：AuthQueryScope 按身份作用域隔离 QueryClient | 跨标签页、logout/relogin 竞态 |
| FE-05 | P2 | 已修：await 前捕获 input，finally 重置 | 完整导入 E2E |
| OPS-01 | P1 | 未修：debug 分支无 --network 隔离且发布 DAP 端口 | 外层隔离设计；公开使用前阻断候选 |
| OPS-02 | P2 | 已修：复用前核对模式/镜像/资源/归属，plain 强制 network none | 真实容器切换验证 |
| OPS-03 | P2 | 已修：有限瞬态重试（max_retries=2）+ 异常清理 + kill/reap | 真实 Celery worker/Redis |
| OPS-04 | P2 | 已修：迁移图指纹 + 审核 guard AST + 保守预检 | 中间版本升级演练 |

台账外关联项（PythonLab 最新批次）：STARTING/结果原值 CAS、READY 发布补偿、trusted journal/
文件锁/条件删除、WS 建连 nonce/IP 校验、DAP detach CAS 均已在源码与测试中确认；**跨
Redis/worker/Docker 的原子 claim 仍未闭环**（对应 5 个 strict xfail 开放项）。

## 二、台账与源码不一致点（已修复，2026-09-11）

1. ~~XBK-06：台账仍标「未修」~~ → 台账快照表已改标「已修」并指向源码行号。
2. ~~AI preview 最新性表述冲突~~ → owner 定稿：preview 已按最新时间/ID 实现；TEST_STATUS 债务行已删除该残留表述。
3. ~~stream_session 接入文件台账写错~~ → 台账从未声称接入 `conversations.py`（原指 BIZ-05 位置），已复核实际接入 `stream_session.py` 及 `admin_stream.py`、`analysis_streams.py`、`group_discussion.py`、`stream.py`、`classroom/admin.py`、`classroom/student.py`，无需改台账正文。
4. ~~历史快照表缺「最新批次优先」指向~~ → 表头已加显式快照提示。

## 三、发布前必须完成的用户决策

1. **XBK-01**：被引用自然键更名策略（拒绝 or 级联迁移 + Alembic）。
2. **AUTH-02/03**：是否整合外部候选；不可变用户 ID、旧 token 过渡窗口、代理/TTL/迁移政策。
3. **AUTH-04**：登录凭据变更是否全会话撤销。
4. **FE-02**：跨筛选/跨页批量选择语义（保留并展示明细 or 筛选变化清空）。
5. **业务名册恢复**：独立审批（备份 → dry-run → 确认 → 事务执行 → 对账 → 回滚预案）。
6. **Python governance 7 errors**：拆分超限函数，或治理豁免决策。

## 四、发布前必须补齐的验证（非本地隔离环境）

- **认证**：真实 PG/Redis 的 AUTH-01 双存储故障；全角色 E2E（真实网关、可信代理、CSRF/Cookie）。
- **PythonLab**：原子 claim/资源归属；真实 worker/Redis/Docker 崩溃恢复；多断点连续 Continue、
  hover 真实 pointer（Chrome channel + WebKit）。
- **XBK**：真实名册 dry-run/对账；真实 Excel 打开；父实体并发删除；大文件导出性能。
- **前端**：真实后端全链路的四档桌面（1280×800 / 1440×900 / 1680×1050 / 1920×1080）；
  跨标签页竞态。
- **AI**：真实供应商调用；SSE 断线重连/取消；AI 长事务与测评并发。
- **运维**：OPS-01 网络隔离设计评审；中间版本迁移演练；备份恢复演练；依赖安全扫描；
  Typst/PDF/Monaco 等重型模块生产构建运行。
- **门禁**：Python governance 7 errors 修复；3 个 skip 用例补齐（2 个 XBK HTTP 缺显式 app
  分配、1 个历史 XLS 缺 xlrd）；bundle-budget/ui-audit 重跑；前端 lint 469 warnings 收敛。

## 五、发布流程差距（现状：全部未做）

1. **提交/推送**：工作区约 86 个 modified + 60 个 untracked 未提交，main 领先 origin 1 个
   提交未推送。建议按主题拆分 4 组提交：① XBK 学年+校验+导出；② 认证会话闭环
   （session_family/stream_session/guard）；③ 业务+前端（BIZ/FE 修复）；④ PythonLab+运维+
   迁移预检。`git diff --check` 已通过。
2. **CI**：提交后 GitHub Actions 全绿。
3. **版本/镜像**：v1.6.0 无 tag；6 个 amd64 镜像已手工推送但 latest 未更新 → 打 tag、
   按 release-set 全量 build/push、staging 部署验证。
4. **生产**：备份 → 迁移 → 部署 → 冒烟 → RELEASE_NOTES 更新。
5. **凭据卫生**：~~明文密码常量 `wangshu0727`~~ → **已修复（2026-09-11）**：改为
   `settings.XBK_EXPORT_SHEET_PASSWORD`（`.env.example` 已加说明），旧值仅作兼容默认；
   生产部署仍需覆盖环境变量并考虑轮换该密码。

## 六、可立即执行、无需用户决策的事项

- 按主题拆分提交并推送（见五.1）。
- ~~同步台账四处不一致~~（已修复，见二）。
- 修复 3 个 skip 用例与 governance 7 errors（函数拆分）。
