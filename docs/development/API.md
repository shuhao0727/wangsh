# API 接口清单

> 基础路径：`/api/v1`（认证接口需携带 `Authorization: Bearer <token>` 头）
> 最后更新：2026-10-20（KNN 运动习惯采集，v2.1.6 镜像已发布）

## KNN 运动习惯采集（/it/knn）

本节合同已随 `2.1.6` 镜像发布；服务器尚未部署，目标数据库迁移状态须在部署阶段核对。功能流程、特征含义、三张数据表与迁移影响见
[KNN 采集 owner](../features/KNN_SURVEY.md)。学生使用学号免登录填写，教师在信息技术应用管理内管理批次。
成功响应直接返回 JSON，不额外包装 `data`；下述正常成功响应均设置 `Cache-Control: no-store`。
JSON 请求对象禁止额外字段，非法字段、类型或范围返回 `422`。

### 公开接口

前缀为 `/api/v1/it/knn`，均不要求登录；不返回完整名单、其他学生身份或任何答案。

| 方法与路径 | 用途与成功响应 |
|---|---|
| `GET /batches` | 批次数组；只列出持久状态为 `scheduled` 且尚未到截止时间的批次，包含未来待开始的批次 |
| `GET /batches/{batch_id}` | 单个批次元信息；可按 ID 读取草稿或已关闭批次的元信息，但不能因此提交 |
| `POST /batches/{batch_id}/check` | 请求 `{"student_no":"1"}`；返回该学号的提交资格，不返回答案 |
| `POST /batches/{batch_id}/submissions` | 提交答案；成功 `201`，返回 `student_no`、`revision`、`submitted_at` |

批次元信息为 `id`、`title`、`starts_at`、`ends_at`、`phase`。`phase` 允许 `draft`、
`scheduled`、`open`、`ended`、`closed`，由持久状态和服务器当前时间计算。
`check` 在元信息外增加 `student_no`、`current_revision`、`refill_allowed`、`can_submit`。
学号有效、当前为 `open`，并且未提交或已获重填授权时，`can_submit=true`。

提交示例：

```json
{
  "student_no": "1",
  "request_id": "e69ca9b8-39e3-491c-9469-c01dbe300c8d",
  "expected_revision": 0,
  "features": [1, 2, 1, 2, 4, 4, 1, 2, 2, 3, 6, 4],
  "label": "耐力类",
  "display_consent": false
}
```

| 提交字段 | 合同 |
|---|---|
| `student_no` | 名单内学号；去除首尾空格，格式及等价规则见下文 |
| `request_id` | UUID；客户端一次提交生成一次，网络重试保持不变 |
| `expected_revision` | 严格整数，`>=0`；首次填写为 `0`，重填使用最近 `check` 返回的当前版本 |
| `features` | 固定 6 个严格整数；按六类运动顺序保存每周参与天数，每项范围 `0..7` |
| `label` | 只允许 `球类对抗`、`力量类`、`耐力类`、`技巧类` |
| `display_consent` | 严格布尔，默认 `false`；字段保留兼容，界面恒为 `false`，冻结不再要求同意 |

六类运动的固定顺序为球类对抗、力量、耐力、技巧、团队配合、日常活动。按教学设计只采集每周参与天数，不再采集喜欢程度。
特征不接受布尔或数字字符串。

新提交必须满足服务器时间 `starts_at <= now < ends_at`，且持久状态为 `scheduled`。
同一批次、同一学号默认只允许一次；重填新增答案版本并自动消耗一次授权，不能覆盖旧答案。
相同学号的同一 `request_id` 携带相同内容（含 `expected_revision`）重试，返回原成功回执，
即使批次随后结束；不会重复创建答案或消耗后来授予的重填机会。相同凭证携带不同内容返回 `409`。

### 教职工接口

前缀为 `/api/v1/admin/it/knn`，全部使用 `require_staff` 认证。教师只能管理自己创建的批次；
`admin`、`super_admin` 可管理全部批次。匿名为 `401`，非教职工或越权为 `403`。

| 方法与路径 | 请求与用途 |
|---|---|
| `GET /batches` | 可管理批次的统计数组，不含名单行 |
| `POST /batches` | 创建草稿，成功 `201`；请求为下述批次配置，返回批次详情 |
| `GET /batches/{batch_id}` | 读取批次详情及所有名单行、当前答案 |
| `PUT /batches/{batch_id}` | 全量更新批次配置；不能移除已提交学号 |
| `DELETE /batches/{batch_id}` | 仅删除无提交的草稿；返回 `{"ok":true}` |
| `POST /batches/{batch_id}/state` | `{"action":"start"}`、`{"action":"schedule"}` 或 `{"action":"close"}`；返回批次详情 |
| `POST /batches/{batch_id}/refill` | `{"student_numbers":["1"],"allowed":true}`；批量授权或撤销重填，返回批次详情 |
| `GET /batches/{batch_id}/history/{student_no}` | 读取学号的全部答案版本，按版本倒序 |
| `GET /batches/{batch_id}/export.csv` | 下载含全部名单与当前答案的 CSV |
| `POST /batches/{batch_id}/freeze` | `{"a_student_no":"1"}`；冻结一次课堂 JSON，也可传 `{}` 或 `{"a_student_no":null}` 自动选择匿名学生 A |
| `GET /batches/{batch_id}/frozen` | 下载已冻结 JSON；未冻结时 `404` |

创建与全量更新使用相同配置合同：

| 字段 | 合同 |
|---|---|
| `title` | 长度 `1..120`；去除首尾空格后不能为空 |
| `starts_at` / `ends_at` | 带时区的 datetime，截止时间必须晚于开始时间 |
| `student_numbers` | `1..1000` 个学号；省略时使用字符串 `1..65` |

学号长度 `1..24`，首位为 ASCII 字母或数字，后续可使用 ASCII 字母、数字、下划线、短横线。
去除首尾空格后，纯数字忽略前导零，其他学号统一大写；`01` 等价于 `1`，`a01` 等价于 `A01`，
但 `A01` 与 `A1` 不同。名单包含规范化后的重复学号时为 `422`。

`start` 把开始时间改为服务器当前时间并开放，`schedule` 使用配置的时间窗；两者均要求截止时间
尚未过去。`close` 立即停止新提交。`refill.allowed` 为严格布尔，默认 `true`；只能授权已提交学号，
名单有任一学号不存在或未提交时整次操作失败。待重填期间旧答案仍有效并计为已交。

批次统计包含元信息以及 `state`、`created_at`、`expected`、`submitted`、`missing`、
`pending_refill`、`frozen_at`。`state` 为持久状态 `draft`、`scheduled`、`closed`。
详情额外包含 `rows`，每行为：

```json
{
  "student_no": "1",
  "current_revision": 1,
  "refill_allowed": false,
  "answer": {
    "revision": 1,
    "features": [1, 2, 1, 2, 4, 4, 1, 2, 2, 3, 6, 4],
    "label": "耐力类",
    "display_consent": false,
    "submitted_at": "2026-10-20T15:00:00Z"
  }
}
```

未提交时 `current_revision=0`、`answer=null`。历史响应为 `{"student_no":"1","answers":[...]}`，
答案项字段同 `answer`。

### 导出、冻结与错误

CSV 使用 UTF-8 BOM，包含全部名单（含未交）、提交状态、当前版本、重填授权、六项每周参与天数、
报名类别与提交时间。公式危险学号加转义前缀。CSV 不包含历史版本；历史使用专用接口读取。

冻结要求至少 4 份当前有效答案；学生 A 由 `a_student_no` 指定，未指定时按名单顺序取首位，不再要求
任何学生同意匿名展示。返回 `{"version":2,"aId":"S01","featureNames":[...],"students":[...]}`，
每个学生只含 `id`、`label`、`features`（6 个整数），不含学号；ID 按当前有效答案的名单顺序生成。每批只能冻结一次，重复冻结 `409`；
后续重填或配置变化不修改快照，可重复读取已冻结 JSON。

| 状态码 | 情况 |
|---|---|
| `401` / `403` | 管理接口未认证 / 非教职工或管理他人批次 |
| `404` | 批次不存在、学号不在名单或尚未生成冻结数据 |
| `409` | 当前不开放、已提交未获授权、版本变化、凭证冲突、移除已提交学号、无效状态操作、未提交学号授权重填、冻结条件不足或重复冻结 |
| `422` | 未知字段、时间缺少时区或顺序错误、学号非法或重复、特征/意向/布尔/版本类型或范围错误 |

数据库写入在事务内锁定批次行，并由名单与答案唯一约束裁决并发。详细迁移和降级边界见功能 owner；
本节不将源码合同或本地验证视为生产升级完成。

## AI伙伴临时共享榜单（未发布）

> 发布状态待复核：本节标题与正文沿用“未发布”口径，指未确认服务器部署与真实模型验收。
> 但 `docs/docker/RELEASE_NOTES.md:30`（v2.1.5 已发布镜像）已记录“AI伙伴目录改为服务端维护源
> 和前端生成副本”，v2.1.3 候选（同文件第 107-121 行）已包含榜单；因此“镜像是否已包含本功能”
> 与“是否已部署上线”需分开表述，待 release owner 核对后统一。

本节记录当前源码合同，不表示已部署或已完成真实模型验收。实现入口为
`backend/app/api/endpoints/ai_partner.py`、`backend/app/schemas/ai_partner.py` 与
`backend/app/services/ai_partner_evaluation.py`、`ai_partner_leaderboard.py`。
不新增管理员榜单接口、数据库表或 migration；复用平台已有智能体配置和认证。

### 认证与响应边界

- 下述三个接口均要求正式登录；匿名返回 `401`，历史 `guest` 角色返回 `403`。
  身份以服务端认证为准，`expected_user_id` 仅核对前端预期身份，不授予其他用户权限。
- 成功响应直接返回 JSON 对象，不额外包装 `data`。成功及认证、校验、业务错误响应均设置
  `Cache-Control: no-store`。请求对象禁止额外字段，类型或必填字段不符返回 `422`。

### POST /api/v1/ai-partner/evaluate

服务端按已配置的评分智能体调用平台模型；不接受客户端价格或总分，不使用本地规则、固定分数、
调试 stub 或备用模型替代真实调用。请求为 JSON，除 `round_id` 外下列字段均必填：

| 字段 | 类型与限制 |
|---|---|
| `round_id` | 可选字符串或 `null`；字符串长度 `1..128`。省略或 `null` 时使用服务端当前配置轮次；显式非空值与当前轮次不一致返回 `409` |
| `expected_user_id` | 严格正整数，须等于当前认证用户 ID，不接受布尔或数字字符串 |
| `ai_name` | 严格字符串，去除首尾空白后长度 `1..80` |
| `selected_ids` | `1..40` 个部件 ID；各项严格字符串，去除首尾空白后长度 `1..80`；须存在于后端 catalog 且不重复 |
| `primary_feature` | 核心任务，只允许 `question`、`homework`、`organize`、`voice`、`vision`、`action`、`sense` 之一 |
| `features` | 扩展任务数组，可为空，最多 `7` 项；各项只允许上述固定任务 ID，且业务校验要求不重复 |
| `budget` | JSON 数值或 `null`；数值须有限且 `0 <= budget <= 1000000000`，不接受数字字符串；`null` 表示未设预算上限 |
| `reason` / `test_plan` / `risk` | 取舍理由最多 `4000` 字符，测试计划最多 `1000` 字符，风险记录最多 `2000` 字符；均为严格字符串，可为空 |
| `paper_recorded` / `tested_core` | 严格布尔值，仅作为学生自述证据，不代表服务端实际执行测试 |

后端以自带 `ai_partner_catalog.json` 解析部件、规格、参考价格、模拟标记与候选方案，
不信任客户端报价。还校验类别数量限制（本地模型最多三项、运行空间最多两项、其他类别最多一项）、
增强项最多两项及内存/显存重复；违规返回 `422`。RTX 4060 计算模块与其显存整卡条目
按同一张卡只计一次价格，独立内存照常计价。参考价与课堂模拟价不是实时采购报价。

成功返回 `evaluation_id`、`round_id`、`total`、`level`、`dimensions`、`suggestions`：

| 字段 | 合同 |
|---|---|
| `evaluation_id` | 服务端签发的 `64` 位小写十六进制不透明凭证，后续用于提交榜单 |
| `round_id` | 本次评分所属的服务端轮次；提交时原样回传 |
| `total` | 服务端累加四个分项得到的 `0..100` 整数，不采用模型返回的总分 |
| `level` | `total >= 85` 为“优秀”，`>= 70` 为“良好”，其余为“待完善” |
| `dimensions` | 固定四项，依次为 `value`（价格性价比）、`completion`（任务完成度）、`suitability`（选择合理性）、`validation`（设计验证与风险）；每项含 `key`、`label`、`score`、`max`、`note`；`score` 为 `0..25` 整数、`max=25`，非空理由最多 `1200` 字符 |
| `suggestions` | `1..6` 条非空改进建议，每条最多 `600` 字符 |

模型输出必须是合法结构化 JSON，四维 key 完整且不重复；非法 JSON、重复 JSON 字段、
额外字段、越界分项等均拒绝，不通过修补分数伪造成功。标签与顺序由服务端归一化。
评分不会开启榜单倒计时；只有第一份有效榜单提交才开启窗口。

### GET /api/v1/ai-partner/leaderboard

读取当前配置轮次。响应包含 `round_id`、`status`（`waiting` / `open` / `ended`）、
`expires_at`（UTC ISO 8601 时间；`waiting` 时为 `null`）、`rows`。
每行仅含 `rank`、`student_name`、`ai_name`、`score`、`is_me`，不返回内部用户 ID。

### POST /api/v1/ai-partner/leaderboard

JSON 仅包含以下四个必填字段，响应与 GET 相同：

| 字段 | 合同 |
|---|---|
| `round_id` | 长度 `1..128` 的严格字符串，必须与评分凭证及当前配置轮次一致 |
| `expected_user_id` | 严格正整数，须等于当前认证用户 ID |
| `ai_name` | 去除首尾空白后长度 `1..80` 的严格字符串，须与签发凭证时的名称一致 |
| `evaluation_id` | 匹配 `^[a-f0-9]{64}$` 的严格字符串 |

- 不再接受客户端 `score`；携带旧字段返回 `422`。榜单成绩只从 Redis 中服务端签发的凭证读取。
- 凭证绑定用户、轮次、作品名，签发后最多 `600` 秒有效；签发时若轮次已经开启，有效期同时受
  该轮截止时间约束。轮次结束后任何未消费凭证都不能提交。
- 有效提交在 Redis 原子操作中一次性消费凭证；即使分数相同或更低、未替换已有成绩，也会消费。
  重复使用、过期、跨用户、改名或其他凭证不匹配返回 `409`，须重新评分。
- Redis 共享榜单按认证用户一人一条最高分；同分或更低分不覆盖已有条目。
  按分数降序排名，并列采用 `1/2/2/4`；显示姓名取服务端账号资料，而不是请求字段。
- `waiting` 等待首个有效提交原子开启窗口；默认 `3600` 秒，可由配置调整，后续提交不续期。
  到期进入 `ended` 并清除榜单姓名、成绩；只保留 deadline-only metadata 防止同轮次重新开启。
  新一课必须更换轮次 ID，不通过删除 metadata 重开旧轮次。

### 错误与限流

| 状态码 | 情况 |
|---|---|
| `401` / `403` | 未认证 / 历史 guest 角色无权限 |
| `409` | 预期身份或轮次不一致、模型返回时轮次已变化、凭证无效/已消费/已过期/归属或名称不符，或评估请求已失效 |
| `410` | 轮次已结束，拒绝评估或榜单提交；读取榜单仍返回 `ended` |
| `422` | 请求类型/字段/部件选型不合法；包括榜单仍传旧 `score` |
| `429` | 评估、榜单或上游模型限流；响应附 `Retry-After` |
| `502` | 上游模型非成功响应（除限流）、响应过大或未返回合法结构化结果等模型失败 |
| `503` | 未指定评分智能体、智能体不存在/停用/配置不全、端点不安全，或 Redis 获取/保存评分及榜单失败；明确不可评分，不内存降级 |
| `504` | 模型调用超时；后端评分调用总时限 `25` 秒 |

评估按同轮次同用户每 `60` 秒最多 `5` 次、同轮次全局最多 `60` 次，并限制同用户并发评分；
已占用额度的失败尝试仍计数。榜单按同轮次同用户分别限制 GET 每分钟 `120` 次、POST 每分钟 `30` 次。
前端仅浮窗开启且页面可见时每 `5` 秒轮询，关闭或不可见时停止。

这是课堂临时展示，不是防作弊或考试评分服务；模型评语不能视为真实硬件或供应商验收。
交互边界见 [AI 智能体 owner](../features/AI_AGENTS.md#ai伙伴临时共享榜单未发布)，
配置与真实调用前提见 [部署 owner](../docker/deploy/DEPLOY.md#ai伙伴临时共享榜单配置未发布)。

## 第一、二阶段未发布候选 API 合同（2026-09-14）

以下合同已进入当前源码，但尚未部署或迁移正常数据库。

### 公共配置与账号治理

- `GET /system/public/feature-flags/{key}` 只接受 14 个明确公开 key；未知 key 在数据库查询前
  返回 `404`。成功响应只可能包含空 `value` 或严格布尔 `value.enabled`，并设置
  `Cache-Control: no-store`。管理端 `/system/feature-flags*` 权限仍为 `super_admin`。
- `PUT /users/{user_id}`、`DELETE /users/{user_id}`、`POST /users/batch-delete` 以及
  `POST /users/import` 中导致账号停用、删除、恢复或降权的变更，按 AUTH ready gate 和
  持久撤销事务执行。移除最后一名活跃 `super_admin` 返回 `409`，detail 中包含
  `code=LAST_ACTIVE_SUPER_ADMIN`；普通资料更新不撤销会话。
- `POST /users/` 在写入前进入同一 AUTH 全局事务锁并重新校验操作者，已被停用、删除或
  降权的在途管理员请求不能继续创建账号。应用启动只在配置用户名不存在时创建超级管理员，
  不再重置或恢复已存在账号。

### 点名对象级授权

- `GET /xxjs/dianming/classes`：`admin/super_admin` 可读取全局聚合；学生只返回认证身份
  `study_year + class_name` 对应的班级；教师授权关系尚未建立，因此当前教师返回 `403`。
- `GET /xxjs/dianming/students?year=...&class_name=...`：学生跨班、跨学年或身份映射缺失
  时在查询名单前返回 `403`；管理员保留全局读取。

### XBK 事务与工作簿边界

- 手工新增/改课、导入执行和软删除恢复统一裁决同一学年、学期、学号的唯一有效位置及
  每班课程容量；并发陈旧源记录或候选唯一约束冲突返回 `409`。
- `course-selection` 工作簿覆盖实际名册中的全部班级并携带版本化基线。
  `POST /xbk/course-selection-workbook/preview` 以管理员身份、`year`、`term` 和 multipart XLSX
  生成签名预览令牌；`POST /xbk/course-selection-workbook/confirm` 必须回传同一文件和令牌。
  `plan_id` 是内容摘要，授权边界由服务器签名令牌提供。确认先从文件恢复不可变导出合同并
  核对令牌，再在数据库锁内重验完整名册、课程代码/名称/限额和选课状态；完整原基线可应用，
  完整目标状态幂等返回 `already_applied`，部分目标、第三状态或父数据变化整批拒绝。
- 现有 `POST /xbk/import/preview` 与 `POST /xbk/import` 仍只接受
  `scope=students|courses|selections` 的既有导入合同，不会自动识别 R3 工作簿。预览不预留名额，
  最终容量和唯一有效位置仍以确认事务为准。
- R4 partial unique index 已在回环地址的一次性 PostgreSQL 中完成迁移循环、历史有效重复阻断、
  回滚后无半成品索引以及真实 asyncpg 约束名验证；同周期同学生的第二条有效选课会被目标
  约束拒绝，软删除记录不参与限制。该证据不表示正常数据库已连接或迁移，也不表示服务已部署。

### 解析前请求预算

ASGI middleware 在 FastAPI/Starlette 表单解析前约束请求头和表单请求体：请求头最多 100 条、
总计 32 KiB、单条 8 KiB；无效或冲突的 `Content-Length` 返回 `400`，请求头超限返回
`431`，预声明或累计请求体超限返回 `413`，等待下一段请求体数据超时返回 `408`。路由预算为：

- `/auth/login`：16 KiB；
- `/users/import`、`/xbk/import/preview`、`/xbk/import`：12 MiB；
- `/informatics/typst-notes/*/assets`：6 MiB；
- `/admin/it/games`：502 MiB 请求预算，业务层仍保留 500 MiB 文件上限；
- 其他未登记的 `POST/PUT/PATCH` 表单：2 MiB。

该预算仅覆盖 `application/x-www-form-urlencoded` 与 `multipart/form-data`，不套用于 JSON。
它不等于网关原始请求限制、入口限速、并发治理或 multipart 解析 CPU 抢占治理。
`python-multipart==0.0.32` 目前只写入候选依赖清单，尚未安装到正式 venv 或候选镜像。

> 并发行为补充（2026-09-09）：XBK 手工选课写入/恢复及导入 execute 在持有学生、课程共享锁后重验父实体；父删除先锁父再级联，批量删除仅作用于冻结 ID 集合，preview 不作并发承诺。无新增响应字段、FK 或迁移，自然键更名政策未改变；详见 [XBK owner](../features/XBK.md)。

## 未发布 AUTH 持久权威合同（2026-09-10）

- `login`、`refresh`、`logout` 不新增路由或 token 来源。新增持久会话权威要求先完成 migration 和受控 enrollment；`auth_authority.ready` 未就绪时拒绝认证服务，不因 Redis 会话缺失自动接管旧凭据。切换流程不是公开 HTTP API，详见 [AUTH](../features/AUTH.md) 与 [部署说明](../docker/deploy/DEPLOY.md)。
- PostgreSQL 是已接管会话的撤销依据，Redis 为投影；普通认证读取不能用缺失/迟到缓存绕过持久 inactive 或 nonce 不匹配。DB 提交后 Redis 发布失败仍可能产生持久撤销，失败响应不代表无副作用，也不把恢复旧 Redis key 当作恢复旧权限。
- 本轮受控增量迁移与跨存储反证已在合成专库完成限定验证，正常库未迁移、未发布；不能把下方历史缓存丢失边界直接当作新实现结论，也不据此扩大成生产切换通过。具体覆盖和剩余 WS/SSE/真实实例整合状态仅见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

## 管理与课堂事件流会话合同补充

`GET /api/v1/admin/stream`、`GET /api/v1/classroom/admin/stream`、`GET /api/v1/classroom/stream` 在既有接入认证后增加持续会话校验：订阅前及每帧发送前复核实际接受的 JWT/nonce/IP，空闲等待也有界复查。失效或存储故障结束流并退订；事件格式、角色守卫及 token 来源优先级不变，不改为成功空数据或匿名订阅。响应开始后不补发 HTTP 401。

检查和网络发送不是原子操作，不能保证已经在途/已缓存事件被收回，也不刷新数据库角色或班级。AI 与小组讨论 SSE 不由此覆盖。规则见 [AUTH](../features/AUTH.md#管理与课堂-sse-会话持续校验)，证据见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

## 认证存储不可用反馈补充

初始身份查询遇到已识别的数据库连接故障返回 `503` 并拒绝身份，覆盖 Bearer、已配置
Cookie 回退、可选认证与 SSE admission；不将此故障当匿名或 `401`，无效 JWT 和缺少
必需凭据的既有错误码不变。临时 DNS 解析失败 `socket.gaierror(EAI_AGAIN)`（含
DBAPI 包装）属于已识别的暂时不可用；不单凭永久/未知 DNS 错误或异常 cause 链
转换为 `503`，既有 DBAPI 连接失效标记及 SQL/编程错误的优先级见 AUTH。
此处不自动重试，也不承诺故障时撤销凭据。
详见 [AUTH](../features/AUTH.md#初始身份查询的数据库故障)。

## 登录与 PythonLab 长连接合同补充

以下 Redis-first 机制属于旧版本背景；当前未发布 AUTH 以本页顶部持久权威合同为准：同 IP 替换在数据库权威事务中确定，陈旧 Redis 绑定不误踢已经迁移的 owner，缓存发布失败不返回成功 token/Cookie。DB/Redis 仍非分布式原子提交，但已撤销会话不能通过恢复或丢失缓存重新获得权限，详见 [AUTH](../features/AUTH.md#持久会话权威与受控切换)。

PythonLab terminal/DAP 保持原接入错误码和 token 优先级，既有连接新增输入、输出、attach 边界及空闲会话复查，撤销以 `4401` 关闭；取消并回收连接任务。检查后已在途 IO 不保证撤回，不周期刷新 DB 角色。详见 [PYTHONLAB](../features/PYTHONLAB.md#websocket-建连认证边界2026-09-09)。

DAP 断连清理采用元信息原值 CAS 与连接租约条件检查，不覆盖 detach 等待期间的新状态/新 owner，不复活已过期元信息，也不延长其 TTL。原子存储能力缺失时保守跳过，不退回盲写；该保护只约束此清理 writer，不改变对外消息格式或扩为全模块事务。

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

`/auth/logout` 不要求必须提供凭据；有凭据时优先使用当前有效且 nonce 匹配的 access。access 缺失、过期、验签失败或无法证明当前会话时，使用配置的 refresh Cookie，缺少该值才读取兼容 `refresh_token`；不从请求 body 读取 refresh。refresh 必须有效且所属用户可登录，并在用户锁后重验。有效当前 access 与 Cookie 身份冲突时，只撤销 access 证明的账号。

撤销在用户锁内执行：更新 refresh 撤销位、尝试 nonce 轮换、提交数据库。缓存轮换失败仍尝试提交 refresh 撤销；数据库提交失败仍告警并尽力回滚。始终尝试删除配置的 access/refresh Cookie。正常处理或无有效凭据的幂等清理返回 `200` 与 `{message: "登出成功", timestamp: ...}`；已识别的撤销异常返回 `503`、`revocation_status: "incomplete"` 及说明消息。logout 严格读取会话遇到故障且无有效 refresh fallback 时也返回 `503`，缺失 nonce 不授权撤销。读取兼容 Cookie 不等于清理全部兼容别名；`503` 不保证保留的凭据已失效，不提供双存储原子性。故障边界与身份/锁保护机制见 [认证 owner](../features/AUTH.md#服务端退出与撤销边界)，本地修复范围见 [审查台账 AUTH-01](../docker/archive/2026-09-08-project-audit-findings.md)。

登录提交边界（2026-09-09）：先提交 refresh 替换，再重取用户锁并重验本次 refresh 后发布 Redis 会话。第一阶段提交失败不提前旋转 Redis；若重验发现已被新的登录/退出替换则返回 `409`，无成功登录 Cookie。Redis 发布失败不能撤回已提交的 refresh 替换，仍需按认证 owner 的故障边界处理。

被替换会话反馈（2026-09-12）：同一用户被新登录替换后，旧 access 访问 `/auth/me` 等受保护端点返回 `401`，detail 区分「账号已在其他地方登录，请重新登录」（持久状态仍 active 但 nonce 已轮换）与「会话已失效，请重新登录」（登出/撤销/过期）。前端仅对前者展示“已下线”提示。判定不依赖 Redis 投影，见 [AUTH](../features/AUTH.md#被替换会话的-401-反馈2026-09-12)。

身份解析补充（2026-09-09）：旧 subject 仅接受有效未删除用户中的唯一匹配，歧义拒绝。可选认证依赖复用完整 nonce/IP 会话检查，认证 401 作为匿名，其他 HTTP 异常保留；Cookie 回退不扩大，普通 HTTP 不新增 query token。服务层身份查找不能替代完整认证。退出 access 歧义仍允许独立 refresh fallback；不可变 subject 迁移和双存储撤销保证见认证 owner。

PythonLab WS 接入补充（2026-09-09）：terminal/DAP 在业务缓存、terminal 任务或 DAP bridge IO 前校验有效用户及会话 nonce/IP；失败含存储异常关闭 4401，有效身份下不存在/owner 不符保持 4404/4403。仍先 accept 后 close，token 提取渠道及优先级不变、不新增 Cookie 回退。已建连接按上方长连接合同持续校验，但不承诺原子即时撤销。

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
- 安全审计 S-3（2026-08）：`?token=` query 鉴权仅限 SSE 端点（`/admin/stream`、`/classroom/stream`、`/ai-agents/group-discussion/stream`）；普通 HTTP 端点只接受 Authorization header 或 Cookie 中的 token，带 `?token=` 的普通请求将返回 401。

## 三、系统管理（/system）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/system/feature-flags` | 列出所有功能开关 | 超级管理员 |
| GET | `/system/feature-flags/{key}` | 获取指定功能开关 | 超级管理员 |
| POST | `/system/feature-flags` | 创建/更新功能开关 | 超级管理员 |
| GET | `/system/public/feature-flags/{key}` | 公开获取功能开关 | 否 |
| GET | `/system/overview` | 系统概览 | 超级管理员 |
| GET | `/system/settings` | 获取系统设置 | 超级管理员 |
| GET | `/system/typst-metrics` | Typst 编译指标 | 超级管理员 |
| POST | `/system/typst-pdf-cleanup` | 清理 Typst PDF | 超级管理员 |
| GET | `/system/metrics` | 系统指标（Prometheus 文本格式） | 超级管理员 |
| GET | `/system/ai-agents-metrics` | AI 智能体监控指标（JSON） | 超级管理员 |
| POST | `/system/archiving/conversations` | 触发对话归档任务，请求体 `{"days": N}` | 管理员 |
| POST | `/system/archiving/analyses` | 触发分析记录归档任务，请求体 `{"days": N}` | 管理员 |

> 注：本节认证列已按代码实际守卫修正（`require_super_admin`），除公开接口外仅超级管理员可访问；
> 归档接口为 `require_admin`（`backend/app/api/endpoints/system/archiving.py:25,46`）。

<!-- APPEND_MARKER_1 -->

## 四、用户管理（/users）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/users/` | 获取用户列表 | 管理员 |
| GET | `/users/stats` | 用户统计（总数、激活数、角色分布） | 管理员 |
| GET | `/users/{user_id}` | 获取用户详情 | 管理员 |
| POST | `/users/` | 创建用户；普通 admin 仅可创建 student/teacher | 管理员 |
| PUT | `/users/{user_id}` | 更新用户 | 管理员 |
| DELETE | `/users/{user_id}` | 删除用户；普通 admin 无权删除高权限用户 | 管理员 |
| POST | `/users/batch-delete` | 批量删除，请求体为 `{ "user_ids": [1, 2] }`；目标缺失或普通 admin 遇到高权限账号时整批拒绝 | 管理员 |
| GET | `/users/import/template` | 获取导入模板（Excel） | 管理员 |
| POST | `/users/import` | 导入用户；普通 admin 仅可新增/更新 student、teacher；高权限行在 `UserImportResult.errors` 中逐行失败 | 管理员 |
| GET | `/users/privacy/me/export` | 导出本人基础信息、AI 对话与小组讨论消息 | 是 |
| GET | `/users/privacy/me/data-summary` | 本人上述两类消息数量 | 是 |
| DELETE | `/users/privacy/me/data` | 校验 `confirmation="DELETE MY DATA"` 后硬删除本人上述两类消息 | 是 |

用户管理权限说明：
- 普通 `admin` 只能管理和导入 `student`、`teacher`，不能创建、修改或删除 `admin`、`super_admin`。
- 导入文件中的高权限角色行不会自动降级；该行单独失败并继续处理后续行，失败明细通过 `UserImportResult.errors` 返回。
- 批量删除在目标缺失或包含普通 `admin` 无权删除的高权限账号时整批拒绝，不执行部分删除。
- 批量删除请求体与前端统一为对象结构 `{ "user_ids": number[] }`，不接受裸数组。
- 导入模板本轮仍为统一模板，暂不按当前角色动态变化。

## 五、文章系统（/articles）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/articles` | 获取文章列表 | 超级管理员 |
| POST | `/articles` | 创建文章 | 超级管理员 |
| GET | `/articles/{article_id}` | 获取文章详情 | 是 |
| GET | `/articles/slug/{slug}` | 按 slug 获取文章 | 是 |
| PUT | `/articles/{article_id}` | 更新文章 | 超级管理员 |
| DELETE | `/articles/{article_id}` | 删除文章 | 超级管理员 |
| POST | `/articles/{article_id}/publish` | 发布/取消发布 | 超级管理员 |
| GET | `/articles/{article_id}/tags` | 获取文章标签 | 是 |
| GET | `/articles/public/list` | 公开文章列表；支持 `page`、`size`、`category_id`、`q`，缓存按搜索词隔离 | 否 |
| GET | `/articles/public/{slug}` | 公开文章详情 | 否 |

> 注：本节认证列已按代码实际守卫修正（`require_super_admin`），文章列表与增删改/发布操作均仅超级管理员可访问，公开接口除外。

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
| POST | `/categories` | 创建分类 | 超级管理员 |
| GET | `/categories/{category_id}` | 获取分类详情 | 是 |
| GET | `/categories/slug/{slug}` | 按 slug 获取分类 | 是 |
| PUT | `/categories/{category_id}` | 更新分类 | 超级管理员 |
| DELETE | `/categories/{category_id}` | 删除分类 | 超级管理员 |
| GET | `/categories/search` | 搜索分类 | 是 |
| GET | `/categories/popular` | 热门分类 | 是 |
| POST | `/categories/get-or-create` | 获取或创建分类 | 超级管理员 |
| GET | `/categories/{category_id}/stats` | 分类统计 | 是 |
| GET | `/categories/{category_id}/articles` | 分类下的文章 | 是 |
| GET | `/categories/public/list` | 公开分类列表 | 否 |

> 注：本节认证列已按代码实际守卫修正（`require_super_admin`），分类创建/更新/删除/获取或创建均仅超级管理员可访问。

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
| POST | `/ai-agents/analysis/hot-questions/stream` | 创建热点问题分析并逐条归类（SSE） | 管理员 |
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

上表未逐一展开、但已注册的补充端点（均见 `backend/app/api/endpoints/agents/ai_agents/`）：

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/ai-agents/{agent_id}/reveal-api-key` | 二次校验管理员密码后返回明文 API Key | 超级管理员 |
| GET | `/ai-agents/analysis/hot-questions/live` | 热点实时分桶 | 管理员 |
| GET | `/ai-agents/analysis/student-chains/live` | 学生问题链实时会话 | 管理员 |
| POST | `/ai-agents/analysis/task-analysis` | 任务分析（即时） | 管理员 |
| GET/POST | `/ai-agents/analysis/task-analyses` | 任务分析列表 / 保存 | 管理员 |
| GET/DELETE | `/ai-agents/analysis/task-analyses/{analysis_id}` | 任务分析详情 / 删除 | 管理员 |
| POST | `/ai-agents/analysis/task-analyses/stream` | 任务分析 SSE | 管理员 |
| POST | `/ai-agents/analyses/hot-questions/async` | 异步热点分析 | 管理员 |
| POST | `/ai-agents/analyses/student-chains/async` | 异步学生链分析 | 管理员 |
| GET | `/ai-agents/analyses/tasks` | 异步任务列表 | 管理员 |
| GET/DELETE | `/ai-agents/analyses/tasks/{task_id}` | 异步任务状态 / 取消 | 管理员 |
| GET | `/ai-agents/analysis/trends`、`/ai-agents/trends` | 分析趋势汇总（两个注册路径） | 管理员 |

> 注：`GET /ai-agents/active` 使用 `require_registered_user`，`POST /ai-agents/usage` 亦为正式登录用户
> （`crud.py:123`、`usage.py:121`）。

认证边界（2026-09-15）：
- `/api/v1/ai-agents` 下所有路由均要求服务端认证；“是”表示仅允许正式登录角色 `student`、`teacher`、`admin`、`super_admin`，历史 `guest` 角色不属于正式登录用户。
- 未携带有效登录凭据返回 `401`；有效会话但角色为 `guest` 返回 `403`。准入失败时不得进入智能体业务服务、会话读写或外部模型调用。
- 前端 `/ai-agents` 同步使用登录守卫并保留安全的站内 `redirect`，但前端守卫不替代上述 API 权限。

### `POST /ai-agents/stream` SSE 合同（2026-09-28）

- 响应为 `text/event-stream`；正常成功必须包含可见答案正文，并以合法终止事件结束。
- Dify 的 `message`、`message_delta`、`agent_message`、`text_chunk` 只输出经过推理过滤的正文；
  `agent_thought`、`thought`、`reasoning` 及不在 allow-list 的字段不得透传。
- Dify 最终答案支持 `answer`、`data.answer`、`outputs.answer`、`data.outputs.answer`。
  空终止事件不再发送成功的空答案。
- 失败通过 `event: error` 返回 JSON：
  `dify_empty_answer`、`dify_rate_limited`、`dify_upstream_error`、`dify_stream_incomplete`、
  `dify_stream_interrupted`、`session_invalid`、`session_revalidation_unavailable`。客户端应按
  `error` 字段处理，不应仅依据 HTTP 200 判断成功。
- 后端在建立长流前完成数据库读取；流期间不持有 request-scoped DB Session。客户端断开、
  上游异常或会话失败时关闭上游资源。
- Dify 长流使用 Redis 分布式租约按智能体限制活动流数量。超出 `DIFY_MAX_CONCURRENCY` 且等待窗口耗尽时，返回 `event: error`，错误码为 `provider_busy`，并带 `retry_after` 秒数；Redis 无法执行租约时返回 `concurrency_unavailable`。租约使用 TTL、续期和 finally 释放，客户端断开也会触发清理；续租丢失时返回 `concurrency_unavailable`，不会继续把该流当作已受保护请求。
- `DIFY_MAX_CONCURRENCY` 只是保护阈值，不是固定容量承诺；60 人同时使用仍需结合真实 Dify 配额、响应时长和压测验收。

流式回答与持久化边界（2026-09-20）：
- `POST /ai-agents/stream` 对 Dify 仍保持事件级实时流式转发，但会丢弃 `agent_thought`，并从
  文本增量和终止事件中删除 `<think>…</think>` 与 Dify DeepSeek reasoning 标记；客户端不得
  依赖接收供应商内部推理事件或未经处理的 Dify 原始 SSE。
- 浏览器正文解析只接受 `message_delta`、`message`、`agent_message`、`text_chunk`；未知事件
  即使包含 `text`、`content` 或 `answer` 也不进入正文。`message_end`、`workflow_finished`
  仍是成功终止事件，并可携带经过清理的完整答案。
- `POST /ai-agents/usage` 的 question 保持原样，assistant answer 在写入前清理；若清理后为空，
  响应中的 `answer` 为空且不创建 answer 消息。会话摘要、会话详情和管理端使用记录对历史
  answer 执行读取时兼容清理，但不会自动批量修改数据库中的旧行。

补充说明（2026-03-24）：
- `GET /ai-agents/conversations` 返回按 `session_id` 聚合的会话摘要：
  `session_id`、`agent_id`、`display_agent_name`、`display_user_name`、`last_at`、
  `turns`、`preview`。会话详情与管理员详情返回消息的 `id`、`session_id`、
  `user_id`、`agent_id`、显示名称、`message_type`、`content`、`response_time_ms`
  和 `created_at`。这两类响应共用 `schemas/agents/conversation.py` 的权威模型。
- 历史列表契约（2026-09-09）：省略 `agent_id` 查询本人所有智能体的会话；传入时筛选包含该智能体消息的本人 session，不把 session 拆成多个摘要。统计覆盖整个本人 session，按 `last_at DESC, session_id ASC` 排序后执行 session 级 `limit`。只有全部消息属于同一个非空 agent 时，摘要 `agent_id`/`display_agent_name` 才有身份值；混合或含 NULL 时二者均为 NULL，不得映射为当前 agent 续发。相同 session 字符串不跨用户聚合。`preview` 的问题/答案候选分别按 `created_at DESC, id DESC` 取最新一条，与详情的时间/ID 顺序对应；最新答案优先，空白则回退最新问题，二者空白则为空。保留 80 字符截断，不回捞更旧的非空消息，排名不缩小统计或 agent membership 的消息范围。
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
- `hot_v2.themes` 的主题输出 `commonness_score`、`difficulty_signal_score`、`persistence_score`、`hotness_score` 和 `heat_profile`；`timeline_buckets` 额外输出 `volume_signal`、`growth_signal`、`student_diversity_signal`、`burst_score` 和 `burst_reasons`。这些字段是可解释排序信号，旧的 `is_burst`、180 秒分桶和 1.8 倍爆发阈值保持兼容。
- `hot_v2` 的学生事件输出 `teacher_anchor_id`、`teacher_anchor_question`、`teacher_anchor_score`、`teacher_anchor_confidence`、`teacher_anchor_match_type`、`teacher_anchor_reason` 和 `trigger_delay_seconds`。关联分数固定按时间接近 `0.55`、语义词重合 `0.30`、同一会话 `0.15` 计算，置信度阈值为 `high >= 0.70`、`medium >= 0.45`；最多容忍学生问题早于教师问题 120 秒，但会降低时间分。`summary.teacher_anchor_coverage` 是关联覆盖率，不是教学效果或因果证明。
- `hot_v2.analysis_audit` 是结构化统计口径审计信息，包含 `audit_version`、`raw_event_count`、`raw_student_event_count`、`valid_question_count`、`excluded_event_count`、`teacher_anchor_denominator`、`teacher_anchor_match_count`、`teacher_anchor_coverage`、`teacher_anchor_confidence_total`、`teacher_anchor_statistics_consistent` 和 `warnings`。新结果应以该字段为准判断统计是否自洽；旧结果可能缺少该字段，客户端必须显示“未记录”而不能伪造审计结论。
- `themes` 额外返回 `hotness_components`、`hotness_explanation` 和 `score_basis`；`timeline_buckets`、`course_hotspot_sequence` 保存最可信教师锚点的 ID、分数、置信度和原因。对外的 `teacher_questions` / `teacher_mainline` 只保留稳定字段 `id`、`message_id`、`time`、`question`、`source`、`user_name`，不暴露匹配用的内部词项。
- `POST /ai-agents/analysis/hot-questions/stream` 与 `POST /ai-agents/analysis/student-chains/stream` 支持 `analysis_agent_id` 与 `prompt_template_id`。后端会先生成确定性结构化证据，再调用所选分析智能体；未配置 API Endpoint/API Key 时不会丢失基础结构化结果。
  - 热点问题：智能体按教学设计与教师提问 T1…Tn 逐条归类学生提问（回应型 / 生成性 / 无关及细分），结果保存在 `question_classification`，状态在 `classification_status`（`completed` / `partial` / `empty` / `skipped`）。计数由程序完成；不再生成 `deep_analysis` 教学诊断。合同见 [热点问题归类 Agent](../features/assessment/hot_agent.md)。
  - 学生问题链：仍调用诊断智能体生成并保存 `deep_analysis`，以 `deep_analysis_status` 标记完成或跳过原因。
  - 两者都返回 `analysis_agent` 标记智能体名称、模型与状态。
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
| GET | `.../public-config` | 获取已登录用户可见的配置 | 是 |
| GET | `.../public-config/stream` | SSE 监听配置变更 | 是 |
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
| GET | `/model-discovery/preset-models` | 获取预设模型列表 | 管理员 |
| GET | `/model-discovery/detect-provider` | 检测 API 提供商 | 管理员 |
| GET | `/model-discovery/supported-providers` | 获取支持的提供商 | 管理员 |

## 九、信息学笔记

### Typst 笔记（/informatics/typst-notes）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/informatics/typst-notes` | 获取笔记列表 | 教职工 |
| POST | `/informatics/typst-notes` | 创建笔记 | 教职工 |
| GET | `/informatics/typst-notes/{note_id}` | 获取笔记详情 | 教职工 |
| PUT | `/informatics/typst-notes/{note_id}` | 更新笔记 | 教职工 |
| DELETE | `/informatics/typst-notes/{note_id}` | 删除笔记 | 教职工 |
| GET | `/informatics/typst-notes/{note_id}/assets` | 获取资源列表 | 教职工 |
| POST | `/informatics/typst-notes/{note_id}/assets` | 上传资源 | 教职工 |
| DELETE | `/informatics/typst-notes/{note_id}/assets/{asset_id}` | 删除资源 | 教职工 |
| GET | `/informatics/typst-notes/{note_id}/assets/{asset_id}` | 获取资源 | 教职工 |
| GET | `/informatics/typst-notes/{note_id}/export.typ` | 导出 Typst 源码 | 教职工 |
| POST | `/informatics/typst-notes/{note_id}/compile` | 编译为 PDF | 教职工 |
| POST | `/informatics/typst-notes/{note_id}/compile-async` | 异步编译 | 教职工 |
| GET | `/informatics/typst-notes/compile-jobs/{job_id}` | 查询编译任务状态 | 教职工 |
| POST | `/informatics/typst-notes/compile-jobs/{job_id}/cancel` | 取消编译任务 | 教职工 |
| GET | `/informatics/typst-notes/{note_id}/export.pdf` | 导出 PDF | 教职工 |

> 注：本组守卫为 `require_staff`（teacher/admin/super_admin），见 `typst_notes.py:73` 等。

### Typst 样式（/informatics/typst-styles）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/informatics/typst-styles` | 获取样式列表 | 教职工 |
| GET | `/informatics/typst-styles/{key}` | 获取样式详情 | 教职工 |
| POST | `/informatics/typst-styles` | 创建样式 | 教职工 |
| PATCH | `/informatics/typst-styles/{key}` | 更新样式 | 教职工 |
| DELETE | `/informatics/typst-styles/{key}` | 删除样式 | 教职工 |
| POST | `/informatics/typst-styles/seed/{key}` | 从资源种子样式 | 教职工 |

### Typst 分类（/informatics/typst-categories）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/informatics/typst-categories` | 获取分类列表 | 教职工 |
| POST | `/informatics/typst-categories` | 创建分类 | 教职工 |
| PATCH | `/informatics/typst-categories/{category_id}` | 更新分类 | 教职工 |
| DELETE | `/informatics/typst-categories/{category_id}` | 删除分类 | 教职工 |

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
- 权限修正：`/xbk/data` 与 `/xbk/analysis` 的 **GET 读取**使用 `require_xbk_access`
  （公开开关开启时允许匿名读取，否则仅 admin/super_admin）；同组 **POST/PUT/DELETE 写操作**
  使用 `require_admin`。见 `backend/app/api/endpoints/xbk/_common.py:23` 与
  `students.py:36,62`、`analysis.py:81`、`bulk_ops.py:71`。

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

### 校本课校验与筛选合同

- 导入在预检、写入及提交尚未完成时遇到一次任务取消，会显式 rollback 并原样抛出取消；不新增正常响应状态。rollback 再次被取消时，直接保留 session 的调用方仍须负责 rollback/close。客户端 TCP 断连不等于服务端取消，响应丢失也不等于未提交；本接口不提供提交结果的幂等回放或已提交数据撤销保证。
- R3 使用独立端点 `POST /xbk/course-selection-workbook/preview` 与 `POST /xbk/course-selection-workbook/confirm`；二者均要求管理员权限、multipart XLSX、`year` 和 `term`，确认还要求预览返回的签名 `preview_token`。同一 token 与同一文件重复确认在完整目标状态返回 `already_applied`；文件与 token 计划不一致返回 `409`。现有两个通用导入 POST 不会自动识别或执行该工作簿。

- XBK 请求与响应中的 `year` 是规范学年字符串 `YYYY-YYYY`（例如 `2026-2027`）；API/导入边界仍兼容四位起始年份 `2026` 并规范化输出，拒绝 `2026-2028` 等不连续区间。数据库三张 XBK 表使用 `VARCHAR(9)` 并施加连续学年 CHECK 约束。
- `POST /xbk/import/preview` 与 `POST /xbk/import` 使用 multipart `file`，接受 `scope=students|courses|selections` 以及 `year`、`term`、`grade` 默认值；非空文件值优先，空单元格或缺列回退到默认值。
- 预检返回有效/无效行数、预览和带工作表行号的错误。执行支持 `skip_invalid`；严格模式先完成全文件校验再写入，数据库失败回滚。导入格式、容量限制及重复键规则以 [XBK 功能文档](../features/XBK.md#导入校验与交互约定) 为准。
- 非法文件/内容可返回 400，容量超限 413，字段/行校验失败 422；缺少旧 `.xls` 引擎返回 400 并提示格式转换。
- 预检与执行均在单文件重复自然键、包含多个年份/学期组合、学生同学号与现存姓名/年级冲突时整份返回 422；`skip_invalid=true` 不绕过这些文件级保护。学生学号需跨班级及年级唯一；同人重复导入仍可更新班级/性别，具体规则见 XBK 文档。
- 课程导入中新增课程缺少“各班限报人数”整份 422（含行号与字段名）；已存在课程缺该列时保留库中原限额。导入请求的 `grade` 与文件中某行年级不一致、或文件年级与库中已有课程/选课快照不一致时整份 422；文件未提供年级时保留库中快照。
- `GET /xbk/export/{export_type}?format=xlsx&year=…&term=…` 的 `export_type` 取 `course-selection` / `distribution` / `teacher-distribution`；`grade` / `class_name` 会真正参与筛选，`course-selection` 只生成匹配班级的工作表，筛选后无匹配名册返回 422，未筛选时仍导出全部班级（R3 回导基线）。`format` 只决定文件字节格式，不决定导出类型。
- 两类导出端点的 `format` 都只接受 `xlsx`；传 `xls` 返回 400“不支持 .xls 导出，请使用 xlsx”，不再返回伪装成 `.xls` 的 xlsx 字节，文件名固定为 `.xlsx`。
- `DELETE /xbk/data` 必须指定 `year` 和 `term`；携带 `class_name` 时 `scope=all|courses` 返回 400，不能按班级删除共享课程。父记录删除会清理同一时期的关联选课。
- `DELETE /xbk/data` 的年级范围统一按“属于本次筛选范围的学生集合”裁决：`scope=all` 与 `scope=selections` 对同一筛选的选课删除结果一致，不再因课程所属年级扩展删除范围。孤立选课（学生已不存在）仍按 `year`/`term` 与年级快照清理。
- 学生、课程、选课 PUT 唯一键冲突返回 409 并回滚；不意味着自然键变更已实现关联级联改号。手工与导入共享字段规范化/校验，选课未知或已删除父实体：手工 404，导入作为行错误处理；“未选”只要求有效学生。学生导入冲突更新在数据库写入时重新校验身份，晚冲突整批回滚；新增/更新计数与父实体并发删除边界见 XBK 文档。
- 课程开设年级（`xbk_courses.grade`）为空表示全年级可选，非空时仅同年级学生可选。跨年级选课在手工写入返回 409，导入在预检阶段给出行级错误（严格模式 422）；该规则与列表筛选、容量分桶口径一致。
- `/xbk/analysis/summary` 接受 `grade`；班级身份是 `(grade, class_name)`，班级筛选从有效名册解析实际年级，跨年级同名班级不合并。课程统计以有效课程目录为主表并保留 0 人课程；容量与限额校验口径一致，按 `(课程, 学生年级, 班级)` 分桶累计，并以 `capacity_basis`（`per_grade_class` / `unset_grade` / `cross_grade`）标明口径。指定班级时每个匹配年级的 `class_count=1`，摘要课程数与真实课程统计行数一致。涉及学生的统计排除孤立及已删除学生选课。完全无选课记录属于“休学/其他”，课程代码为空串或“未选”的记录均属于“未选”，课程统计合并两种表示；未选明细与导出使用同一口径。
- `/xbk/data/selections` 的响应行同时包含 `grade`（选课写入时的年级快照）与 `student_grade`（学生当前年级）。列表筛选按学生当前年级，展示应优先使用 `student_grade`，学生转年级后二者会不同。
- `GET /xbk/export?scope=selections|course_results` 对存在有效学生名册的选课按名册当前年级筛选并输出；孤立或无有效名册的选课回退使用选课记录中的年级快照。`class_name` 仅通过同学年、同学期、同学号的有效名册匹配，避免跨时期同学号造成班级筛选串数据。

### 公开配置（/xbk）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xbk/public-config` | 获取公开配置 | 否 |
| PUT | `/xbk/public-config` | 更新公开配置 | 超级管理员 |

> 公开开关开启后匿名用户可读取全量学生名册与选课数据，因此写权限与系统功能开关一致，仅 `super_admin` 可切换。

## 十一、点名系统（/xxjs）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/xxjs/dianming/classes` | 获取班级列表 | 是 |
| GET | `/xxjs/dianming/students` | 获取学生列表 | 是 |
| POST | `/xxjs/dianming/import` | 导入班级数据 | 管理员 |
| DELETE | `/xxjs/dianming/class` | 删除班级 | 管理员 |
| PUT | `/xxjs/dianming/class/students` | 更新班级学生 | 管理员 |

> 权限细节：读接口（classes / students）使用 `require_user`，再由
> `backend/app/services/xxjs/dianming_access.py:39` 按身份收窄范围——admin/super_admin 全局，
> 学生限本人 `study_year + class_name`，教师因尚无授权班级关系返回 `403`（同文件第 61-65 行）。

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
| `POST /assessment/sessions/start` | `config_id` | 配置必须存在且启用；先尝试复用本人同配置 `in_progress` 会话，否则须处于开放时间窗且题库非空；数据库没有严格唯一约束 |
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

`GET /assessment/my-profiles/{profile_id}` 要求 `profile_type=individual` 且 `target_id` 等于当前用户 ID 的字符串；其他类型即使数字碰撞也返回 403，缺失 ID 仍返回 404。管理端既有画像入口及其管理员权限不变，不能通过个人入口读取 group/class 报告。

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

结果访问：`GET /assessment/sessions/{session_id}/result` 在既有会话存在性与归属检查之后，仅接受 `submitted` / `graded`；进行中及其他非结果状态返回 `422 {"detail":"该检测尚未提交，无法查看结果"}`，不返回整卷答案或解析。合法单题提交的即时反馈保持不变，已答完但尚未交卷也不开放整卷结果。

并发写入：单题 `/answer` 与整卷 `/submit` 在同一会话行上取得事务锁后重验状态，随后写入并提交。先保存成功的答案计入随后交卷；先交卷成功后单题保存返回既有 422；重复提交只允许一个成功。按取得锁的顺序处理，不承诺 HTTP 先到先处理，不提供响应丢失后的幂等成功回放。AI 调用仍位于该事务内，长事务与取消边界另行验收。

评分时机：选择题立即精确判分；填空题立即 AI 评分，并在未配置智能体或 AI 失败时回退
文本比对；简答题单题提交时只保存答案，整卷提交后统一评分。

### 学生端（/assessment）

本组接口要求 `require_student_or_staff`（`student/teacher/admin/super_admin`）；未认证返回 401，其他角色返回 403，并非任意登录用户均可访问。

`GET /assessment/available` 与新建会话共用开放窗判断：未设置的边界不限制，恰好开始或结束可起测。`POST /assessment/sessions/start` 在配置存在且启用、又无本人同配置进行中会话时，于查题、AI 与写入之前校验；窗前返回 `422 {"detail":"该测评尚未开始"}`，窗后返回 `422 {"detail":"该测评已结束"}`。可复用会话不受窗口重新限制，保持原 session、开始时间和答案；这不改变窗外配置在列表中隐藏的行为，也不保证严格并发幂等。配置禁用仍先于复用拒绝，原有成功响应字段不变。详见 [会话与答题边界](../features/ASSESSMENT.md#会话与答题边界)。


起测并发（2026-09-09）：PostgreSQL READ COMMITTED 下，`POST /assessment/sessions/start` 先按配置与本人 ID 取得事务级互斥，再检查/复用进行中会话；已有会话被保存或交卷锁住时等待，不再跳过另建。事务提交、回滚或会话关闭释放互斥；不同配置/学生可独立起测。该保护只覆盖当前服务入口，不替代唯一约束、历史重复数据修复或新旧版本混跑验收；SQLite 不据此承诺并发唯一。开放窗、题目及响应字段不变。

首轮自适应题在已建立的保存点内生成或写入失败时，仅回滚该题保存点，保留新会话、固定题及此前成功题目，并按既有合同建立无题目快照的占位答案；后续正常请求复用同一进行中会话，不重新生成首轮题。这不保证 AI 可用、占位题的后续评分完整性或首次起测并发唯一性；保存点建立前的自动 flush 及其他外层事务失败仍按请求边界整体回滚，不适用占位恢复。响应字段、开放窗与结果权限不变，无结构迁移。

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
| GET | `/learning/progress` | 获取当前用户所有模块的学习进度列表 | 是 |
| GET | `/learning/progress/{module_key}` | 获取当前用户学习进度；首次无记录返回 `200` 和同构默认 payload，`module_key` 支持 `ml`、`ai`、`agents` | 是 |
| POST | `/learning/progress/{module_key}` | 保存当前用户学习进度 JSON（与 PUT 行为一致），前端会按模块保留阶段状态、收藏、完成项和笔记 | 是 |
| PUT | `/learning/progress/{module_key}` | 同上（upsert） | 是 |
| DELETE | `/learning/progress/{module_key}` | 删除当前用户该模块的学习进度 | 是 |
| GET | `/learning/content/{module_key}` | 获取启用且 `owner_id IS NULL` 的公共学习内容；不包含个人导图 | 是 |
| GET | `/learning/content/{module_key}/admin` | 管理员获取学习内容扩展项（包含禁用项） | 管理员 |
| PUT | `/learning/content/{module_key}/{section_key}/{item_key}` | 创建或更新学习内容项，`content` 为结构化 JSON，唯一键为模块、分区、条目 | 管理员 |
| PATCH | `/learning/content/{module_key}/{section_key}/{item_key}/enabled` | 启用或禁用学习内容项 | 管理员 |

说明：`module_key` 目前限制为 `ml`、`ai`、`agents`。`section_key` 用于区分路线图、知识体系、实验、工具、资源、Prompt、安全伦理、框架、核心技术等内容分区；前端也支持 `raw` 分区作为整包覆盖扩展入口。

已注册但上表未列出的补充端点：

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/learning/chapters/{module_key}` | 获取模块全部章节（含未启用） | 是 |
| GET | `/learning/chapters/{module_key}/{slug}` | 获取单章节 | 是 |
| PUT | `/learning/chapters/{module_key}/{slug}` | 创建或更新章节 | 管理员 |
| DELETE | `/learning/chapters/{module_key}/{slug}` | 删除章节 | 管理员 |
| GET | `/learning/mindmaps` | 已发布思维导图广场 | 否 |
| GET | `/learning/mindmaps/my` | 我的个人导图 | 是 |
| POST | `/learning/mindmaps` | 创建个人导图 | 是 |
| PUT | `/learning/mindmaps/{mindmap_id}` | 更新个人导图（仅所有者） | 是 |
| DELETE | `/learning/mindmaps/{mindmap_id}` | 删除导图（所有者或管理员） | 是 |
| PATCH | `/learning/mindmaps/{mindmap_id}/publish` | 发布/取消发布导图 | 管理员 |

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
- 管理端计划接口中，计划不存在返回 `404`，对象级权限失败返回 `403`；状态不允许、空计划、活动缺少班级或班级不一致等业务校验失败返回 `400`。
- 创建、更新和启动计划都要求计划内活动具有非空且一致的 `class_name`。缺班级错误列出活动 ID 与标题；混班错误按班级列出对应活动；计划引用已删除活动时列出缺失的活动 ID。
- `reset` 只允许将 `ended` 计划恢复为 `draft` 并重置计划项，不修复历史活动数据。若已结束活动缺少班级，应先复制为草稿，在副本中补充班级，再更新计划后启动。
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
