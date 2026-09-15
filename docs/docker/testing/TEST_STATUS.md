# 当前测试状态

> 状态：active
> Owner：testing
> 当前版本：2.1.0
> 最近更新：2026-09-15
> 说明：本文件是当前测试事实的唯一汇总入口；阶段报告只引用本页，不复制新基线。

## 2026-09-15 生产部署只读预检与恢复演练（阻断）

- **生产现状：** 目标主机 `shuhao-Virtual-Machine` 的 WangSh 生产栈仍运行
  `shuhao07/*:2.0`，应用配置为 `APP_VERSION=2.0.0` / `IMAGE_TAG=2.0`；数据库为
  PostgreSQL `16.14`，`current_schema=public`，session `search_path="$user", public`，数据库约
  `47 MB`。生产源码停留在 `cdf1df29`，且 `docker-compose.yml` 有生产专用未提交调整，后续
  更新不得覆盖。
- **迁移状态与阻断：** `public.alembic_version=20260910_0001_auth_authority`，AUTH authority
  `ready=true`。待执行 head 为 `20260914_0001_xbk_active_selection_unique`，但只读查询发现
  3 组历史有效重复选课：刘宇轩（150，课程 6/19）、陈子轩（438，课程 8/18）、朱子涵
  （728，课程 21/7）。该 migration 会按设计拒绝并回滚，未执行生产迁移。必须由业务方明确
  每名学生保留哪一门，再在停写、备份和复核后处理；不得自动猜测或直接删除。
- **数据观察：** 按当前“课程限额按班级分别计算”的规则，只读统计发现 97 个班级-课程组合
  超额，共超出 167 个位置，单组最大超出 4；这是历史数据治理项，不是本次唯一索引 migration
  的直接 DDL 阻断。另有 3 条空课程代码记录，代码合同将空值视为“未选”，不应误判为缺失课程。
- **备份与恢复实测：** 已生成生产一致性自定义格式备份
  `/home/shuhao/backups/wangsh/wangsh_db_pre_2.2_20260915_190028.dump`（约 `18 MB`，权限
  `0600`），SHA-256 为
  `9872a7b7c05dd2994be8919fcfccfed07ab4268aa838244c50b67af521f29c79`。首次隔离恢复因
  readiness 检查只验证服务接受连接、未等待目标数据库创建而失败；修正为等待管理库 SQL-ready
  并显式建库后，使用独立 PostgreSQL 16 容器恢复成功。生产与恢复库的核心计数完全一致：
  users `381`、students `1909`、courses `57`、selections `917`、revision 与 AUTH ready 均一致；
  临时恢复容器和卷已删除，正式备份保留。
- **镜像与 release-set 决策：** 用户已明确授权本轮继续使用并覆盖 Docker Hub 现有 `2.1` 标签。
  应用版本保持 `2.1.0`，正式镜像标签为 `2.1`；本轮只发布代码和镜像，不执行生产迁移、部署或
  重启。生产库中 3 组历史重复选课记录按用户要求暂不处理并保留。正式 `release-set.txt` 必须在
  六个镜像成功推送后，依据远端 registry manifest digest 生成并校验；在推送完成前不生成伪造文件。

## 发布前开放风险复核（2026-09-14，只读审查）

- **非默认 PostgreSQL `search_path`：阻断。** 已有专项用例仅验证兼容版本表逻辑和有限场景；完整
  Alembic 链在自定义 schema 下仍缺少可回放的 upgrade → downgrade → re-upgrade 证据。
  XBK 最新 migration 的索引名已改为静态字面量，`backend/scripts/check_migration_state.py` 静态门禁
  已通过；但这不替代自定义 schema 下的真实迁移链回放，发布仍阻断。
- **教师点名：安全保持 403。** `teacher` 在 `backend/app/services/xxjs/dianming_access.py`
  没有权威班级授权关系时明确拒绝；本轮 `tests/xxjs/test_dianming_object_access.py` 相关回归通过。
  在授权数据源、撤销和审计关系落库前，不得开放教师点名。
- **验收报告格式：已标准化为发布准入要求。** 每次迁移/发布报告必须记录目标标识、源码/镜像
  digest、数据库 `current_schema`、database/role `search_path`、迁移前后 revision、预期表/索引、
  upgrade/downgrade/re-upgrade 结果、备份恢复证据、运行命令、时间和责任人。
- **当前门禁结果：** 点名对象授权专项 `20 passed, 1 skipped`；Python compileall 通过；前端
  type-check 通过。生产数据库只读预检未执行，未连接正常服务或正常数据库。

## 2026-09-15 AI 智能体强制正式登录整改（当前工作区，Docker/浏览器已验）

- **行为边界：** 网站访客浏览模式继续保留，但前端 `/ai-agents` 由正式登录守卫保护；匿名用户
  跳转登录页并完整保留站内 pathname、query 与 hash。后端 `/api/v1/ai-agents` 命名空间中的
  智能体列表、会话、使用记录写入、流式对话和小组讨论配置/消息/流统一执行服务端认证；匿名
  返回 `401`，有效会话中的历史 `guest` 角色返回 `403`。本功能修复没有新增数据库结构或
  migration；真实验证时将本地开发库中已存在但尚未应用的 AUTH/XBK revision 升级到 head。
- **部署前候选复验（2026-09-15）：** 使用本地已有基础镜像和当前源码/构建产物生成未发布的
  `wangsh-local/wangsh-backend:2.1-prep-20260915`（`sha256:45d928cd8c6fc08871271761bd4583717b4a9a569bbce241351983b1a5210f03`）、
  `wangsh-local/wangsh-frontend:2.1-prep-20260915`（`sha256:7201533d0623af4d46b0223015f55ede916a7fb9588970da9f519f6cdd06c7da`）和
  `wangsh-local/wangsh-gateway:2.1-prep-20260915`（`sha256:067d10eb0eb55f64ce1fcc3ef41815bb04e1673bd6bcc77862a46cc0ef5b468f`）。
  未执行依赖安装或镜像拉取；`/api/health` 为 healthy，匿名 5 个 AI 端点均为 `401`，新 Chromium
  会话访问 AI 深链正确跳转登录且不展示智能体内容；正式账号登录后列表、历史和配置加载正常，
  真实 Provider 流返回“部署前验证通过”。正式 `shuhao07/*:2.1` 标签未被覆盖，候选仅用于本地验收。
- **静态与自动化复核：** `PYTHONDONTWRITEBYTECODE=1 pytest -q -p no:cacheprovider
  tests/ai_agents` 为 `196 passed, 2435 warnings`；覆盖动态路由认证依赖树、匿名 ASGI 请求在
  智能体列表、历史、配置和 Provider 服务之前被拒绝、正式用户核心路由准入、`guest` 角色拒绝
  以及受认证 SSE 会话边界。前端专项实际为 `2 files / 41 tests passed`；`npm run type-check`
  与 `npm run build` 均通过。警告主要为既有 Pydantic、SQLite、jieba、Browserslist、PDF.js
  和大 chunk 提示；本轮未扩大范围处理。
- **依赖复用与 Docker 实测：** 未执行 `npm install`、`npm ci`、`pip install` 或镜像拉取；后端
  复用本地 `shuhao07/wangsh-backend:2.1` 并挂载当前源码，前端复用当前 `frontend/build` 和
  本地 `caddy:2-alpine` 静态运行，PostgreSQL/Redis 使用既有开发容器。迁移前只读预检通过，
  在仓库外生成并校验 `16 MB` PostgreSQL 备份；停写窗口将开发库从
  `20260908_0001_xbk_academic_year` 升级到 `20260914_0001_xbk_active_selection_unique`。
  AUTH 受控切换 dry-run/apply 均为 `preserved=1, reauthenticate=0`，最终 `ready=true`；这不是生产
  环境发布或生产数据库迁移结论。
- **真实 HTTP/Chromium 闭环：** 未登录访问 `/home` 正常显示访客页面；访问
  `/ai-agents?agent=test-agent#chat` 跳转
  `/login?redirect=%2Fai-agents%3Fagent%3Dtest-agent%23chat`，未短暂展示智能体内容。匿名及退出后
  对 active、conversations、stream、group-discussion public-config 和 public-config/stream 的
  5 个请求均为 `401`。超级管理员真实登录 `200` 后返回原 AI 深链，列表、配置、会话加载均为
  `200`；发送“请只回复：登录验证通过”后真实 Provider 流返回“登录验证通过”，stream `200`、
  usage `201`；退出 `200` 后立即回到登录页并再次拒绝上述接口。额外保留本次签发的旧 access
  token 做撤销验证：退出前 AI 请求 `200`，退出后同一 token 请求普通 AI API 与 SSE 均为 `401`。
  日志未发现该闭环中的非预期 `500`、数据库异常或匿名业务写入。
- **部署前观察项：** 通过 Caddy 访问已登录页面时，现有 `/api/v1/admin/stream` 长连接在浏览器
  重连/页面关闭时会产生 `ERR_INCOMPLETE_CHUNKED_ENCODING`，网关日志对应为预期的
  `context canceled`；AI 业务流本身返回 `200` 且内容完整。本轮未扩大范围修改后台全局 SSE，
  因此“AI 功能通过”不等于“浏览器控制台零警告”。
- **剩余边界：** 当前开发库没有 `role_code=guest` 的真实账号，因此历史 `guest` 的真实浏览器
  `403` 未在正常数据中构造；该边界由后端专项和前端守卫测试覆盖。四种正式角色中本轮真实浏览器
  仅使用 `super_admin`，其余三种由自动化准入测试覆盖。该专项完成时仓库缺少正式发布所需的
  `release-set.txt`，且尚未执行生产预检；后续生产只读预检与恢复演练结果及阻断项以本页顶部
  “生产部署只读预检与恢复演练”章节为准。

## 当前源码生产等价一次性栈验收（2026-09-14，未发布候选）

- 使用当前 dirty worktree 源码构建 `wangsh-real-e2e-backend:20260914`
  （arm64，镜像 ID `sha256:1053d945a9234806f6c6be2c5b601429915edf460c7de333b8e6ba10d7121cc6`），
  以独立 Compose、PostgreSQL 16 tmpfs、Redis 7 tmpfs、正式 bootstrap → Alembic → AUTH cutover
  顺序和两个 Uvicorn worker启动；gateway 仅绑定 `127.0.0.1:17608`。
- 从空数据库升级到 `20260914_0001_xbk_active_selection_unique`，AUTH cutover 返回
  `already_ready=0, preserved=0, reauthenticate=0`；生产 health 为 healthy、debug=false。
- 真实 TCP/Cookie/JWT/multipart XLSX 验收 `result-mainagent03.json` 全部通过：动态班级导出、
  非管理员 403、token 篡改 401、文件/计划不匹配 409、首次确认 `applied`、同 token 同文件重复
  确认 `already_applied`、普通选课超限 409、畸形/高压缩 XLSX 拒绝及最终 API 状态一致。
- 2026-09-14 的真实 Chromium 产品 UI 验收已完整覆盖工作簿链：通过页面导出真实 XLSX，填写
  后使用真实文件选择器上传，preview 返回 `200`，页面显示 1 项变更；首次 confirm 返回 `applied`，
  UI 选课总表可见目标学生进入目标课程。同一签名 confirm 请求重试返回 `already_applied`；重新
  上传已应用的旧工作簿时，因工作簿导出基线过期在 preview 阶段返回预期 `422`，两者属于不同
  安全边界。最终日志未发现后端异常或 HTTP 5xx；预期负向验证产生的 `409/422` 均与安全裁决一致。
- 隔离前端镜像重建后，一个未刷新的旧管理页面曾请求已不存在的旧哈希 chunk。新增的
  `vite:preloadError` 恢复逻辑已在一次真实 Chromium 隔离观察中触发“一次自动刷新 →
  `sessionStorage` 防循环 → 错误边界”链路；但独立二次复验和正式验收报告尚未完成，正式前端切换
  仍列为发布观察项，不能误记为“无非预期 4xx”。
- 真实 PostgreSQL 终态存在 partial unique index；回查结果为目标学生仅 1 条有效选课，重复有效
  选课、同学生同课程重复、课程超额和活跃孤儿选课均为 0。重复 confirm 未增加课程人数。
- 修复学年筛选值不在服务器历史学年列表时 Select 显示空白的问题后，已重新构建一次性生产等价
  隔离前端镜像，并用真实 Chromium 复验当前学年正确显示、服务器历史学年仍可选择，且既有选课
  结果仍可见。
- 最新回归：R3/HTTP/apply 三文件 `48 passed, 8 warnings`；第一批清洁禁网门禁
  `849 passed, 2 skipped, 9 warnings`；第二阶段门禁 `1185 passed, 3 skipped, 9 warnings`；
  R4 合同门禁 `6 passed, 1 warning`。门禁清单相互重叠，数字不得相加冒充唯一用例总数。
- 真实 PostgreSQL 同计划并发文件 `8 passed, 8 warnings`：两个独立 session 对同 token、同 XLSX
  确认时真实进入锁等待，最终一个 `applied`、一个 `already_applied`，且仅一条有效选课。
- 真实 HTTP 并发运行 `r0915a01` 通过最后一个名额竞争、工作簿与普通选课竞争的整批回滚、
  同 token 并发确认和串行重复确认；数据库幂等指纹保持
  `ee81c6825e35434f120d42fe7537781b`，无重复、超 quota、孤儿或部分提交。
- 所有数据均为合成数据，未连接正常数据库，未接触 5433/6608/8000/6379/8081，未推送镜像、
  未部署生产。因此只能表述为“当前源码生产等价一次性环境通过”，不能表述为已经发布。

## 第二阶段隔离发布验证（2026-09-14，未发布候选）

本阶段在第一批无网络基线之后，补做一次性 PostgreSQL、R3 工作簿服务层、真实 Excel/WPS
往返和隔离依赖候选验证。所有数据库数据均为合成数据；未连接、读取或迁移正常数据库，未
重启业务服务、构建/推送镜像或部署。

### 第二阶段统一无网络隔离门禁

- 仓库外运行器 `run_second_stage_isolated.py` 在第一批白名单基础上加入 R3 预览/确认、XBK
  导入错误合同与 HTTP 脱敏边界测试；使用 `env -i`、禁用插件和 conftest、临时目录，并在
  collection 前阻断 socket、DNS 与网络连接。
- **最新复跑**：`1185 passed, 3 skipped, 9 warnings`。跳过项均依赖专用
  PostgreSQL，不能由无网络门禁冒充真实数据库验证；真实 PostgreSQL 结果另见下一节。

### 一次性 PostgreSQL、迁移与并发

- **环境**：一次性容器 `wangsh-pg-audit-20260914211501-9129dfca`，数据库
  `wangsh_pg_test_9129dfca`，schema `audit_9129dfca`，仅绑定回环端口
  `127.0.0.1:53627`，镜像为 `postgres:16-alpine`。
- **结果**：`7 passed, 8 warnings in 1.81s`。覆盖 Alembic
  upgrade → downgrade → upgrade、历史有效重复阻断与失败事务回滚、清理合成重复后的
  重试升级、partial unique index 的有效/软删除边界，以及 asyncpg 返回的目标与非目标
  `constraint_name` 分类。
- **并发边界**：XBK 最后一个名额竞争由一方成功、等待方锁后复核并返回 `409`，最终人数为
  `1`；AUTH 并发自停用、互相降权及相同学号并发创建均完成锁后重验。
- **资源与正常库保护**：结束后容器、卷和一次性环境文件残留均为 `0`。未触碰本机
  `127.0.0.1:5432` 或现有 `wangsh-postgres:5433`，该结果不是正常数据库迁移或生产验收。
- **新发现风险**：非默认 PostgreSQL `search_path` 下，Alembic 兼容函数对
  `public.alembic_version` 的检查与未限定 schema 的建表/改表语句不一致，可能产生
  `DuplicateTableError`。默认 `public` 路径当前通过；自定义 schema/多租户路径尚未整改和
  验收。

### R3 工作簿预览/确认服务层

- 已新增预览与确认服务层，使用服务器端 `WorkbookExpectation`、稳定 SHA-256 内容摘要
  `plan_id`，确认时重新核验完整有效学生集合、完整有效课程集合和全部学生选课基线，最终
  整批只调用一次统一事务裁决。`plan_id` 不是服务器签名，HTTP 接入必须另设服务器信任边界。
- 覆盖正常应用、`already_applied`、`no_changes`、明确未选、陈旧基线、计划篡改、部分应用、
  新增有效学生、新增有效课程、新增学生已有选课、多条有效选课冲突、整批回滚与取消回滚；
  无变化行的预览后漂移也会阻断确认。
- **最新独立复跑**：`48 passed, 8 warnings`。
- **接入边界**：已接入管理员 multipart `POST /xbk/import/preview` 与 `POST /xbk/import/confirm` 路由；真实 UI 上传/确认已在一次性生产等价栈验证。仍不能据此宣称已部署生产或已处理真实业务数据。

### Excel/WPS 真实往返

- Excel 实际打开、保存、关闭后的文件 SHA-256 为
  `5e96331b37c52db562ace98f130a294a4208580b3e427d9967f9d63b8fe8625f`；WPS 对应文件为
  `ff22c17a015d1f52d59216cf0740afd28c35824d540f19635aa78673ed3fb5f6`。
- 两个成品均重新解析为 `format=xbk-course-selection`、`version=1`、学年
  `2026-2027`、学期“上学期”、`4` 行，基线标识保持一致；班级页数据验证、工作表保护、
  D 列可编辑格和 `veryHidden` 元数据页仍存在。
- Excel 将标准 `dataValidations` 转换为 `x14:dataValidations` 扩展。openpyxl 会警告不支持
  该扩展，因此不能再用 openpyxl 保存 Excel 往返成品；这不是验证规则丢失。WPS 保存后的
  重新解析和结构检查通过。

### `python-multipart` 隔离候选

- `backend/requirements.txt` 候选声明为 `0.0.32`；从仓库外隔离候选目录实际加载该版本，
  上传/导入相关回归本轮重跑为 `328 passed, 1 skipped, 8 warnings in 5.18s`。
- 正式 `backend/venv` 当前仍安装 `0.0.22`，候选及生产镜像未升级或重建。因此该结果只证明
  隔离候选兼容性，不证明正式 venv、Docker 镜像或生产入口已经使用 `0.0.32`。

本阶段关闭了第一批中“专用 PostgreSQL、R3 服务层、Excel/WPS 往返和隔离依赖候选未验”的
部分空白，但仍不支持部署、正常数据库迁移、R3 HTTP 在生产环境可用或“全部漏洞已关闭”的结论。

## 第一批整改无网络隔离门禁（2026-09-14，未发布候选）

本轮覆盖公共配置白名单、账号生命周期治理、点名对象级授权、解析前请求预算，以及 XBK
统一事务裁决、全班工作簿和候选唯一约束。验证由仓库外隔离运行器
`run_first_batch_isolated.py` 执行，运行器未纳入仓库。

- **统一结果（本轮重跑）**：`841 passed, 2 skipped, 9 warnings in 6.56s`。
- **隔离条件**：`env -i` 清空继承环境，显式禁用 pytest 插件自动加载与仓库 conftest，
  使用测试文件白名单、临时工作目录和 pytest basetemp，并在导入 pytest 前阻断 socket、DNS
  与网络连接；未连接正常 PostgreSQL、Redis 或业务服务。
- **2 个 skip**：均为需要专用 PostgreSQL 的用例；在没有安全测试数据库 URL 时按设计跳过，
  不能记作 PostgreSQL 并发或迁移验证通过。
- **9 条 warning**：8 条为项目既有 Pydantic V2 class-based config 弃用提示，1 条为
  Alembic `path_separator` 弃用提示；本轮没有因此失败。
- **未覆盖**：正式 venv/候选镜像中的 `python-multipart 0.0.32`、专用 PostgreSQL 的 R4
  真实迁移与锁行为、正常数据库迁移、真实 Redis TCP 故障、完整认证交错、R3 数据库回导、
  Excel/WPS 往返、网关限速/并发/解析 CPU 治理及生产发布。

该结果只支持“第一批源码候选通过无网络隔离门禁”，不支持直接生产发布或宣称全部漏洞关闭。

## R6.1 发布后 CI-only/test-only 门禁收口（2026-09-13，已完成）

本节记录提交 `9ab18200174145d4cee3832e1f86fc0c74de09fb`、
`68d8b0cef8ac9844e24ec80326b9e63166588ab7` 及当前测试夹具收口的 PR 分支结果。修复只影响
CI/test 依赖来源、workflow 清理和测试夹具，不修改生产应用代码、API、数据库 schema、生产
依赖或已发布的 6 个 Docker Hub `:2.0` 镜像。结果绑定
`release/v1.6.0-audit-fixes`，不是 `main` 合并后的证明。

- **远端 Actions 全绿**：最新提交 `68d8b0cef8ac9844e24ec80326b9e63166588ab7` 的
  `ci-quality` Run `34739812265`、`markdown-quality` Run `34739812213`、
  `pr-pythonlab-owner-gate` Run `34739812343`、`pr-pythonlab-phasec-gate` Run `34739812377`
  均为 `success`。
- **SQLite 并发隔离**：`backend/tests/auth/test_logout_revocation_isolated.py` 启用 WAL，
  避免覆盖率运行下 SSE/logout 并发的 rollback-journal 锁竞争；logout 的 503 语义没有被改成
  测试替身，产品行为保持原定义。
- **PythonLab 清理竞态**：`.github/workflows/pythonlab-pr-runtime.yml` 对 sandbox 容器清理
  增加最多 10 次有界重试、最终残留检查和诊断输出；已知 transient removal race 可恢复，其他
  Docker 错误仍然阻断 workflow。
- **WebSocket task/session 收尾**：`backend/tests/pythonlab/test_ws_revocation_isolated.py`
  使用有界 `wait_for_task_cleanup` 等待异步 session/task finalizer，再执行无泄漏断言；本地
  定向回归为 `22 passed / 21 skipped / 8 warnings`。
- **本地收口结果**：后端隔离全量基线为 `3054 passed / 170 skipped / 2467 warnings /
  0 failed`；本地 Markdown 扫描为 `113 files / 431 links / 0 missing`，合同测试为
  `10 passed / 0 failed`。旧 Run `34733798985`、`34733799159` 的失败保留为历史事实，不能
  用来否定当前 `68d8b0c` 已通过的门禁。
- **镜像不变**：本节修复没有重新构建或推送 Docker Hub 镜像；6 个 `:2.0` digest 仍以
  [发布记录](../RELEASE_NOTES.md) 中的表格为准，`latest` 未更新。


## R6 门禁、Docker 全量验收与镜像发布（2026-09-13，已完成）

本节冻结运行时代码提交 `c653906f586ecaae4fde4b413d7fd4e612e867b8` 的发布证据，
覆盖下方同主题历史状态；后续 CI-only/test-only 收口以 R6.1 为准。本节不把本地通过冒称
GitHub Actions 已经运行，也不把公开页 smoke 扩称全角色/全业务 E2E。

- **repo-config（版本口径）**：`ci-quality.yml` 的 Compose 镜像标签检查改为调用
  `node scripts/check-version-consistency.mjs --print-image-tag`；当前完整版本为 `2.0.0`，镜像
  标签为 `2.0`。生产和开发 Compose 均已真实渲染通过。
- **Docker Hub 前端版本注入**：发布 workflow 统一写入并读取大写 `SOURCE_VERSION`；合同测试
  禁止恢复为小写 `source_version`，避免 Linux runner 上前端版本静默回退为 `unknown`。
- **backend-pytest（Python governance）**：`backend/app/core/sandbox/docker.py` file-size 回归
  `705→756` 后，已把 mountinfo 与 `HOST_WORKSPACE_ROOT` 解析拆到
  `backend/app/core/sandbox/docker_paths.py`（`DockerMountMixin`），`docker.py` 为 `756→655` 行；
  baseline complexity 条目按 `moved_from` 迁移。普通与 `--base-ref origin/main` 治理检查均为
  `errors=0 / warnings=24`。
- **phasec-pr-gate / owner-concurrency-pr-gate（登录超时）**：CI 在 migration 后、backend/worker
  启动前增加一次性合成库 AUTH enrollment；调用 `bootstrap_durable_auth_authority(...,
  legacy_writers_stopped=True)`，并使用独立 session 复核 `ready is True`。生产切换仍必须走
  `auth/cutover.py` 的停流、排空与冻结流程。
- **后端全量隔离回归**：独立临时 PostgreSQL 16 与 Redis 7、禁读仓库 `.env*`、只允许连接
  临时回环服务；最终 `3045 passed / 170 skipped / 2467 warnings / 0 failed`，耗时 `76.70s`。
  两次中间失败分别来自隔离配置缺 `APP_VERSION` 和网络守卫/独立 Redis 夹具，均只修正
  `/tmp` 外部运行器后重跑，未改源码或接入正常服务。证据：
  `/tmp/wangsh-backend-validation-20260913/`。
- **前端全门禁**：`type-check` 通过；lint `0 errors / 468 warnings`；Vitest
  `94 files / 676 passed`；脚本测试 `29 passed`；生产 build `4366 modules`；token 检查
  `1821 references / 0 undefined`。合计自动化测试 `705 passed / 0 failed`。
- **生产 release-set 构建**：以 `linux/amd64` 完整重建 backend、typst-worker、
  pythonlab-worker、pythonlab-sandbox、frontend、gateway 共 6 个 `:2.0` 镜像；当前 Image ID
  分别以 `5a265c...`、`f12d02...`、`b3fa14...`、`7b1e46...`、`c68547...`、`781865...`
  开头，容器标签与实际 Image ID 一致。构建日志：
  `/tmp/wangsh-docker-verify-20260913/logs/11-full-release-build.txt`。
- **真实 Docker 运行**：隔离 Compose 元数据使用 `COMPOSE_PROJECT_NAME=wangsh-verify`，网关端口
  `16608`；PostgreSQL、Redis、backend、frontend、gateway、Typst worker、PythonLab worker
  均 healthy，sandbox running。`/api/v1/health` 返回 database/redis healthy，Alembic 为
  `20260910_0001_auth_authority (head)`，两个 Celery node 均 pong；PythonLab 一次性 sandbox
  启动成功。运行阶段未强制 amd64 基础服务，避免 ARM64 本机 Redis 架构误配。
- **真实浏览器**：Playwright 访问 `http://127.0.0.1:16608`，在 `1280×800`、`1440×900`、
  `1680×1050`、`1920×1080` 四档截图；真实点击“访客模式进入”到 `/home`，首页显示
  `v2.0.0`。console errors/warnings 均为 `0`，5 个公开 feature flag API 均 HTTP 200。
  截图与日志位于 `/tmp/wangsh-docker-verify-20260913/`，不提交仓库。
- **清理**：第一轮约 `95 MB` 可重建生成物移到
  `/tmp/wangsh-garbage-20260913-093358`；5 个 dangling 镜像已删除，Docker 报告回收约
  `279.4 MB`，复核 dangling 数量为 `0`。验证结束后第二轮又将 `frontend/build`、
  Vite cache、本轮 Python 字节码与 Playwright 仓库副本共约 `75 MB` 移到
  `/tmp/wangsh-garbage-postverify-20260913-102702`。未删除 `.env`、业务数据、volume 或未知镜像。
- **发布结果**：运行时代码提交 `c653906f586ecaae4fde4b413d7fd4e612e867b8` 已推送到
  `release/v1.6.0-audit-fixes`。6 个已验证本地 Image ID 未经重新 build，先推送唯一 staging tag
  `2.0-verified-c653906-20260913`；远端核验 config digest 与本地 Image ID 一致、平台均为
  `linux/amd64` 后，原样提升到正式 `:2.0`。正式 digest 依次为：backend
  `dd721eda...`、typst-worker `4ae204ea...`、pythonlab-worker `df298132...`、sandbox
  `7902be0d...`、frontend `df0e3385...`、gateway `aa8a1a38...`。发布前后 6 个 `latest`
  digest 完全一致，本轮未更新 `latest`。GitHub Actions 尚未在 `main` 上复核该提交，不能把本地
  两阶段发布记录冒称 workflow 结果。完整 digest 台账见 `docs/docker/RELEASE_NOTES.md`。

## R5 三主线并行复核（2026-09-11，代码与整合已验，Excel 原生 setup 已打开但六份导出验收仍阻断，未发布）

本节覆盖下方同主题历史状态。证据根为
`/Users/wsh/.codex/artifacts/wangsh-r5-parallel-20260910/`；只使用专属合成资源，不把当前 dirty 全部计为本轮改动。

### XBK：真实 PostgreSQL 取消修复已核验，Excel 原生 setup 已打开，六份导出验收仍阻断

- 两个导入入口增加一次 `asyncio.CancelledError` 的显式 rollback 后原样抛出。`xbk/final.xml`：**90 passed**（新取消专项 23、既有 PG 并发 67）；主任务独立 `xbk/independent-main.xml`：**23 passed**。真实 PG 用独立 schema、第二 INSERT 阻塞、deferred COMMIT、`pg_stat_activity`/锁及 NOWAIT 观察，不以 SQLite 代替。
- `xbk/r4-regression/matrix.xml`：**18 passed**；旧 retained-caller 红例修复后复跑，不覆盖旧失败。`xbk/export-tests.xml`：**717 passed**，这是导出契约/结构回归，不是 Excel GUI 验收。主任务 XML 及当前源码 SHA 独立核对见 `main/xbk-independent-summary.json`。
- 覆盖直接 retained session、ASGI、真实 TCP 断连与重复取消。一次取消且 rollback 未被再次取消时 session 可复用；二次取消仍可打断清理，调用方负责 close/rollback。TCP 断连可能仍提交；deferred COMMIT 阻塞期间取消不等于能撤销已经提交的事务。没有新增 XBK migration 或更改自然键政策。
- 专库真实 FastAPI 导出六个合成 XLSX，`xbk/exports/manifest.json` 保存范围、筛选、SHA 和文本验证；`excel_ui_verified:false`。**历史阻断记录保留**：原生 Excel 打开目标文件受阻，字节相同的 `/tmp` 副本也未进入目标 grid；后续 CUA 路径输入/剪贴板超时；再次检查遇到 Mac 锁屏且自动解锁失败，已请求用户手动解锁并打开合成文件。另见 `main/excel-lock-blocker.json`；保留 `main/excel-open-blocked.*`、`main/excel-copy.json`、`main/excel-resume-blocker.json`。后续已记录原生 Excel 成功打开 `file:///private/tmp/wangsh-r5-excel-20260910/students-all.xlsx`，sheet 为 `data`，`native_open_verified=true`，但 `full_excel_acceptance=false`；该原生成功仅是 setup 证据，不替代六份导出验收。此前点击已有加载项 3825 后 AX 无变化，随后 `getScreenshot` 返回 `The Mac is locked and automatic unlock could not unlock it. Ask the user to unlock the Mac manually before continuing.`；该锁屏证据已实际写入 `main/excel-setup-lock-20260911.json`，保留为历史。最新本轮 CUA `getAXState` 成功返回目标 `students-all`，`getScreenshot` 成功显示原生网格，不再将锁屏作为当前确定状态；随后依据截图点击加载项坐标 `[1038,74]` 返回 `Computer Use server error -10005: noWindowsAvailable`。安装、pane、登录及连接状态均未知，不推断未安装或注册失败；不重复无效重试，需用户手动通过 Home > 加载项打开 ChatGPT 面板。本轮复核证据已写入 `main/excel-setup-recheck-20260911.json`。
- 首次 HTTPX 系统代理被隔离 runner 拦截，修为 `trust_env=False` 后复跑，保留初败。专用资源审计 `xbk/final-audit.json` 未发现残留测试 schema/idle transaction；不代表正常业务库接受过检查。

### AUTH：持久权威、受控切换与独立 PG 复跑已核验

- PostgreSQL 持久会话/tombstone 为撤销权威，Redis 为投影；DB 先提交，重新取锁重验具体 issuance 后发布。默认关闭的 `auth_authority.ready` 只由停流、排空、冻结证据后的受控 enrollment 提交；缺 durable row 不再 runtime legacy 懒接管。新增迁移只在合成专库演练，正常库未执行。
- 独立审查先后复现缺 row legacy 复活、非规范 bool/float owner 被当作合法用户的反例，推动严格类型、nonce、剩余 IP 租约与 ready gate 修正。固定最终六文件 SHA 的独立探针 **17 项预期断言成立**，见 `main/auth-independent-review.md`、`main/auth-cutover-independent-02/`、`main/auth-review-final-source-check.json`；这是提取生产 helper 的 SQLite/内存 Redis 探针，不是 PG/HTTP 证据。
- AUTH 冻结后 `auth/pg-final.xml`：**52 passed / 9 warnings**，实际专属 PostgreSQL/Redis、真实增量 migration/回退重升、enrollment、故障及维护入口；`auth/regression-final.xml`：**128 passed / 8 warnings**。主任务在独立证据目录复跑 `main/auth-final-independent/pg.xml`：**52 passed**，完整冻结文件源码前后无变化，见该目录 `summary.json`。
- 初次 `auth/regression-first.log` **36 failed / 92 passed**、早期通过及独立红例全部保留。早期 30 项 PG 通过不是最终版本；当前只关闭最终证据覆盖的旧会话恢复与跨存储反例，不扩大成分布式原子事务或发布许可。
- `ip_expires_at` 只限定同 IP 占用期限，tombstone 不随租约删除；存量缓存读取值/PTTL，不能重新延长旧租约。维护文件 `backend/app/api/endpoints/auth/cutover.py` 默认 dry-run，显式计划/目标确认及按用户授权后方可 apply；未知/冲突证据拒绝 ready。停旧 writer、冻结实际执行、逐用户审计和停流回滚仍是未来正常环境发布前提，详见 [AUTH](../../features/AUTH.md) 与 [部署说明](../deploy/DEPLOY.md)。

### PythonLab：终端修复、最终 AUTH 整合与双引擎真实回收已核验

- 修复后端 terminal tab 卸载导致的晚切丢 prompt：后台终端保持挂载和连接、保留可测量布局，但隐藏且 inert；WS 建连不再抢后台焦点。关闭重复 DAP stdout 转发，避免同一输出经 DAP/TTY 双通道重复。沿用原生 title/aria-label，不引入 Tooltip 状态机。
- Chrome08 的晚切丢提示和首版重复输出失败均保留。最终前端 v2 真实构建镜像 `sha256:02d6f903a5df42f78badfdeae9d68d92b7183c8d8d9e1e8aba3f0a2eb648cece`，context `80dd590316442eddd9d95733cdabeabeba7d17296af664c025f5e9dddba5a0ad`。主任务核对修改文件 SHA、运行镜像及 HTTP index 字节一致，见 `main/pythonlab-independent-review.json`。
- `chrome-11`/`webkit-02` 完成 late-switch 链路；`chrome-12`/`webkit-03` 再覆盖精确本批代理重启后的 DAP attach 和 TTY 重连。后两轮各 **13 次可信 pointer**，双断点多次 Continue、Step Into/Out/Over、Watch、Pause、terminal input、terminated 和 Reset；真实 TTY 分别输出 `HELLO R5_chrome 3`、`HELLO R5_webkit 3`，无 failure/pageerror/已记录 PythonLab HTTP 错误。不是 JS button.click 或仅默认 Chromium。
- 主任务已实看 Chrome `input-prompt.png`、WebKit `finished.png` 并审读事件原文；Reset 后本批 sandbox **0**，journal removed，Redis terminal 状态 TERMINATED 且 WS owner **0**。证据 `pythonlab/FINAL_BINDING.json`、`cleanup-final.json` 与各轮 events/trace/截图。只清理已核对本批归属资源，没有全局 prune。
- **最终 AUTH 整合已核验**：上述轮次作为 pre-AUTH 历史保留。最终 AUTH 11 文件 overlay 到原冻结后端，新 backend/worker 镜像 `sha256:73268e62225aefd5dec5270e29ef35828f15b8de5996bc8c91accb0d50229716`；两服务各 **313 文件** runtime SHA 匹配。仅专属栈停流并排空，配对备份后实际 Alembic 升级至 `20260910_0001_auth_authority`。login/旧 access `/me` 起初均 **503**；实际维护 CLI dry-run 保留 gate=false，apply 后 ready=true 且旧 access `/me` **200**，重复 apply 幂等。旧 writer 与迁移 runner 均保持 exited。
- 整合后的 `chrome-13` / `webkit-04` 分别使用 Chrome channel **152**、WebKit **26.4**，各 **13 次可信 pointer** 再覆盖上述完整调试、晚切输入、精确代理重启与 DAP/TTY 重连、Reset 链路；无 failure/pageerror/记录到的 PythonLab HTTP≥400。本批累计登记 **7 个 sandbox 均不存在**，终态 Redis metadata 留 TTL，不称所有缓存清空。报告及封存为 `pythonlab/auth-integration/REPORT.md`、`FINAL_BINDING.json`、`cleanup-final.json`；原始事件为两轮 `events.jsonl`。
- 主任务当前源码/冻结 SHA/运行镜像与 HTTP 字节、真实事件及截图、停止 writer、专属 PG 只读 revision/ready 独立核验全部成立，见 `main/pythonlab-integrated-independent-review.json`。这是独立审查与实时只读核对，不是另一次浏览器复跑。
- **范围限制**：只验旧冻结后端 + 最终 AUTH overlay + PythonLab v2，不是整个 dirty 工作区或发布验收。浏览器为 headless、1440×900，不是物理 Safari 或全尺寸视觉；长断网/字节无损、混版本/跨主机/压力、多人存量接管与备份回滚演练未覆盖。旧 R2 prefork SIGKILL/Redis/Docker 证据保留于原范围。

### 当前门禁与保护边界

- 主任务独立可选认证/subject/SSE/WS 六文件隔离回归，最终源码复跑 `main/auth-final-independent/entry-final.xml`：**165 passed / 21 skipped / 8 warnings**；跳过项仅需专属 Redis UNIX socket，未以 TCP 外部资源代替。实际 JWT/SQLite/ASGI，非 PG/真实浏览器整合；完整 AUTH 冻结文件（含 session_family）前后无变化，旧结果保留于 `main/auth-entry/`。首轮默认 pytest log 触发写域 guard，显式把日志放证据目录后通过，首败保留。
- 最终前端 `main/type-check-final3.log` **exit 0**，两文件回归 `main/pythonlab-regression-final.log` **2 文件 / 3 tests passed**，覆盖终端隐藏生命周期与单一 TTY 输出源；此前完整 PythonLab 专项 `pythonlab/pythonlab-vitest-02.log` **52 文件 / 258 tests passed**，是此前执行结果，不是本次收口重跑；较早单文件结果保留。误在根目录执行 npm 的设施失败 `main/type-check-final.log` 保留。本轮当前 Markdown 扫描摘要：**110 files / 416 links / 0 missing**；首次旧摘要及 AUTH owner 改标题导致的旧锚点失效已保留并修正，`main/markdown-final.log` **exit 0**、`main/markdown-tests-final.log` **10 passed**、`main/diff-check-final.log` **exit 0**；整合文档收口后再次执行的门禁见 `main/markdown-closeout.log`、`main/markdown-tests-closeout.log`、`main/diff-check-closeout.log`。2026-09-11 新增代理链验收报告后实测摘要为 `111 files / 421 links / 0 missing`（含 S7 治理合同补充）；同日新增 v2 多 agent 验收报告并修正 RELEASE_NOTES 链接后实测摘要为 `112 files / 424 links / 0 missing`。2026-09-12 全面真实测试修复与文档同步（AUTH/API/RELEASE_NOTES/scripts README）后实测摘要为 `112 files / 425 links / 0 missing`。2026-09-13 新增 Docker 清理、重建、全量验证与发布计划并补齐三层索引后，当时实测摘要为 `113 files / 428 links / 0 missing`。
- 不提交、推送、部署或 prune；不触正常业务数据、登录页及原有容器。`main/baseline.json`、`main/containers.before.json` 为本轮对照基线，最终资源保护审计 `main/final-audit.json`：原 **57 个容器元信息无变化**，当前 **70 个容器**，无意外新增，HEAD/Login 未变；本批已登记 sandbox 的回收解释中间快照数量变化。只核元信息与指定源码，不把容器元信息一致称为业务卷字节验证。

## R4 接续独立核验（2026-09-10，未发布，全项目仍未闭环）

本节优先于下方对应历史状态，不把缺陷刻画通过计为安全修复。旧 R4 证据根为
`/Users/wsh/.codex/artifacts/wangsh-next-r4-20260910/`；本轮新增证据根为
`/Users/wsh/.codex/artifacts/wangsh-r4-resume-20260910/`。本轮没有产品代码修复，既有 dirty 改动保留。

### 测评 FE-03：旧 Chrome 证据独立复核与当前只读核对

- `verify_assessment.py` 独立检查 **27 项通过**，不是新增 27 项产品测试。旧 `assessment/attempt-01/` 为真实 Chrome、无 mock 路由及可信 pointer；真实 PG gate 阻塞 answer 期间 submit=0、确认框=0，释放后 answer 完成才发 submit；answer/submit/result 均 HTTP 200，总 answer=1、submit=1。原时间线与失败历史保留。
- 已实看旧 `final-score.png`：1440×900 成绩页 **10/10、100%**，单题加分与 API 一致；“生成初级画像”仍可见，画像成功和全站无错误不在范围内。本轮未再次驱动浏览器，不把这张旧图称作本轮新截图。
- 当前核对 `127.0.0.1:18766` 隔离 frontend/backend 与旧证据镜像一致，两个测评 JS 的 HTTP/容器字节与旧 SHA 一致。专属合成库 `synthetic_r3_assessment_test` 通过只读 session 核对四张表与旧最终记录一致，session 6 仍 graded 10/10，无锁等待及 idle transaction。
- 当前 frontend ID `sha256:20c5d0769ca41408fde91952ba77aab99ba473601f13dc2a2f5bae1af34579bb`；backend ID `sha256:000ef56d55f3deee95aaacc374f06d46729b1ca4a6c38e94b1c843c26e79ea7d`。新证据：`assessment/independent-review.json`、`assessment/current-db-readonly.json`、`assessment-review.log`；只关闭上述固定客观题链路，AI 长事务/响应丢失恢复/压力不扩大。

### AUTH：刻画通过与安全失败分列

- 首次 repo venv 缺少 `aiosqlite`：`auth-review/run.log` 为 **103 failed / 45 passed**，security gate 也因依赖缺失失败；这是设施失败，保留原日志。未安装或升级依赖。
- 改用旧批次实际解释器 `/Library/Frameworks/Python.framework/Versions/3.13/bin/python3`（已核验 `aiosqlite 0.20.0`）重新执行：`auth-review-runtime2/run.log` 为 **148 passed / 8 warnings**；包含成功复现不安全行为的刻画用例，不代表认证安全通过。
- 单独安全断言 `auth-security-gate-runtime2/run.log` 为 **1 failed / 38 deselected / 8 warnings**：同 IP A 被 B 替换后精确删除 A 会话缓存，A refresh 实际 **200，预期 401**。legacy 替换/故障注销反例仍开放。该 gate 在拒绝断言后的成功路径还有待分支整理，未来产品修复后需版本化校准；当前首个拒绝断言的红例成立，不借此改期望刷绿。
- 运行器禁 dotenv、网络及子进程、限制写域，使用当前真实 auth router/JWT/ORM、SQLite 和合成 Redis，不是 PG/Redis TCP 故障矩阵。`source-binding.json` / `source-after*.json` 记录源码绑定。
- 精确 family 撤销 + 锁序 + Redis CAS 候选仍被离线反例否决：Redis 已替换绑定、DB 撤销未提交时，重试丢失旧 family 撤销依据；不得合入或擅改 legacy/TTL/代理策略。详见本轮 `auth-review-runtime2/REPORT.md` 及 [AUTH](../../features/AUTH.md)。

### 前端认证：校准旧文档，不冒称新实现

- `npm test -- src/components/Auth/UserMenu.auth-race.test.tsx src/services/api.auth-race.test.ts src/components/Auth/authQueryIsolation.test.tsx`：**3 文件 / 68 tests passed**；`npm run type-check` **exit 0**。日志：`frontend/auth-specialized.log`、`frontend/type-check.log`。
- 核实已有退出失败撤销未确认提示、即时清本地身份/导航、旧退出响应不覆盖新身份、共享存储身份同步及新 protected tab 的 pending/signed-out Cookie 恢复门禁。此前文档称“提示仍需补齐、仅同实例”已校准；本轮未修改这些产品文件或 Login。
- 这组是 jsdom、受控 adapter/storage 事件及组件生命周期回归，不是本轮真实多标签 Chrome，也不证明 HttpOnly Cookie 乱序或跨存储撤销已闭环。

### XBK：实际事务与取消清理分层

- repo venv 经已审查的外部 `xbk/run_isolated.py matrix`：**12 passed / 6 failed / 8 warnings**，`blocked_operations=[]`；见 `xbk/matrix.log`、`matrix.xml`、`matrix-metadata.json`。
- 恢复软删除/保留其他期间和行 ID **3 passed**；后段 SQL 失败完整 rollback 并同 session 重试 **3 passed**；真实 `get_db` 依赖退出经 AsyncSession close 清理取消事务 **6 passed**。
- 刻意保留调用方 session、要求函数自身在取消返回前 rollback 的强合同 **6 failed**，独立 reader 未见持久化写入；不等于正常 HTTP 持久化事故。真实 Task.cancel 在确定 await 点触发，SQLite 实际事务不代表 asyncpg 在途取消、真实 HTTP 断连或 PG 行锁。
- 维护测试 `backend/tests/xbk/test_r4_import_restore_transaction.py` 为此前 R4 产物，本轮复跑并补文档；opt-in 与运行边界见 [后端测试说明](../../../backend/tests/README.md)，判读见本轮 `xbk/REPORT.md`。

### 本轮门禁与保护边界

- 当前 Markdown 派生摘要：`110 files / 405 links / 0 missing`。首轮 checker 因摘要滞后失败，合同测试 **9 passed / 1 failed**，均为同一摘要原因；日志保留在 `gates/markdown-01.log`、`gates/markdown-tests.log`，没有断链，不修改 checker 或重写历史数字。同步摘要后 checker **exit 0**，合同测试 **10 passed / 0 failed**，`git diff --check` **exit 0**；见 `gates/markdown-02.log`、`gates/markdown-tests-02.log`、`gates/diff-check-01.log`。最终文档再次封存复核见 `gates/sealed-results.json`。
- PythonLab 会话停止/回收收口文档同步：新增小节后 checker 实测摘要为 `110 files / 417 links / 0 missing`（无断链），按实测同步；历史批次数字不改写。
- 收尾 `final_audit.py` **exit 0**：本轮基线与当前均 **57 容器**，ID/镜像/状态/挂载/端口/项目元信息无差异；HEAD、Login 和认证核心 SHA 不变，**467 个冻结前端输入无差异**，AUTH/XBK 测试绑定源码与当前一致。见 `final-audit.json` / `final-audit.log`；元信息相等不证明卷字节或全部数据库内容相等，本轮未为此读取正常业务库。
- 正常业务数据、Login、认证核心、旧证据及冻结前端输入保护；没有提交、推送、部署、迁移、prune 或自行恢复正常 6608。下轮仍优先 AUTH 持久撤销设计、PythonLab 浏览器/资源恢复和 XBK PG/Excel 验收。

## R3 实例与独立交叉验收（2026-09-10，未发布，尚未全项目闭环）

证据根：`/Users/wsh/.codex/artifacts/wangsh-cross-acceptance-r3-d8c3da3/`。
本节优先于下文历史检查点；只记录实际执行，不将独立证据检查计为产品测试，不把复现失败写成修复成功。

### 元信息、镜像和真实浏览器

- `useAppMeta` 改读构建期版本/环境，不再调用受限系统API；缺失/空/unknown版本显示占位符。专项修前20失败、修后20通过，已纳入默认include。后端权限未放宽，无依赖升级。
- 第一个真实新前端镜像：`wangsh/frontend:20260910-2eb72bd5622e`，ID `sha256:82377ffb16041fb80668c807925d6aeb0ff271e11f5908f9954754bad489221f`。冻结467项生产输入；主任务核实18768容器无源码mount、镜像正确，HTTP HTML/entry/API版本chunk与容器字节一致。版本在导入chunk，不一定在entry。证据：`main/frontend-build/result.json`、`main/frontend-runtime-independent.json`。
- 真实Chrome run-02共42页面记录：核心元信息 **34 PASS / 8 FAIL**（含2个dashboard诊断）；其中指定核心桌面32通过、手机8失败。首页/非系统页35例无overview/settings请求；super_admin系统页5例合法请求均200。独立HTTP确认普通admin两接口403、super_admin均200。
- **手机真实产品失败**：3例首页版本标签右界超出390视口而被裁切；5例后台展开后overlay(1040)覆盖sidebar(1000)。初始折叠隐藏不算bug，全页无水平溢出也不能证明内部内容未裁切。普通admin dashboard另有页面自身overview403，不归因于已经修复的hook。
- run-02原始严格结果为 **42 FAIL_OBSERVED**：462条外域资源guard导致的requestfailed，464条console error（含dashboard403相关2条），pageerror为0。外域隔离限制不豁免真实产品失败，也不宣称浏览器无错误。Chrome为headless真实channel，390×844是CSS viewport，不是手机实机。
- 对上述首页裁切、侧栏层级及dashboard请求已完成限定修复，run-03真实镜像证据另列，run-01错误入口和run-02失败证据保留，不覆盖。

### 本轮UI补丁门禁（新镜像动态验收另列）

- 手机侧栏同一最终专项：修前1失败/5通过，修后6通过；Dashboard初始13例专项修前12失败/1通过、修后13通过；扩展后同一最终18例修前17失败/1通过、修后18通过。Home已有run-02真实裁切红例，不用class静态断言冒充渲染验证。
- 修改后默认include：**92文件 / 673 passed**，type-check exit0；五个本轮组件/测试文件定向ESLint为0 errors/1 warning（测试中的import()类型注解），不是全站lint。证据在 `main/ui-final/`，这些结果不与此前649简单相加。
- Dashboard按user ID/role重建局部状态并使用既有AuthRequestGate；这是页面请求归属修复，不是全站session epoch实现。独立审查另保留无已提交退出/loading边界、相同ID/role替换的更强session失效合同红例；不能因此宣称同账号重登/跨标签/全部token竞态闭环。

### UI 新镜像部署验收（限定三项修复，严格错误门禁未通过）

- 新前端镜像构建成功：`wangsh/frontend:20260910-22b4d88ae446`，ID `sha256:20c5d0769ca41408fde91952ba77aab99ba473601f13dc2a2f5bae1af34579bb`；context SHA `22b4d88ae446f7aa78927b4f363f405f5fc88e1df468777a048983f2731aa66c`。独立冻结构建，未覆盖首个元信息镜像。记录在 `main/frontend-build-ui/`。
- 已仅对18768合成项目替换frontend；主任务独立核实467项生产输入SHA与当前工作区一致，相对上一镜像只有上述三个产品文件变化。运行容器 `a111d8406b22bc6ec93fe5b3cafbbf1ac68bb5d33acefa6d427d8f74232ec542` healthy、无mount，image/context label正确；HTTP HTML/entry/API版本chunk与容器字节一致。证据：`main/ui-final/runtime-independent.json`。这是来源绑定，不是全功能验收；8条外部CDN脚本未拉取验证。
- 真实 headless Chrome run-03已执行原42页面矩阵，`evidence/summary.json`原始结果：核心断言42通过，产品断言37通过/5失败，严格结果42 FAIL_OBSERVED；不将核心通过改写为全绿。3种身份手机首页版本号均在390视口内；主任务实际查看手机首页、后台展开侧栏、普通admin仪表盘截图。
- 两角色Dashboard均覆盖首次加载、真实pointer刷新、browser reload：普通admin每阶段health=1、overview=0、settings=0；super_admin每阶段health=1、overview=1、settings=0，overview返回200。另独立Python HTTP四项核实admin overview/settings为403、super_admin均200；后端权限未放宽。
- 原始错误保留：484条外域guard拦截、493条requestfailed、484条console error、0 pageerror。执行agent逐条核对9条同源SSE取消：均先返回200，随后在菜单导航期间ERR_ABORTED；8条有新页面替代流200，另1条进入无需该流的系统页。结合冻结源码的EventSource.close清理，仅推断为页面卸载取消，不冒称取得运行调用栈；原始产品37通过/5失败及严格失败均不改绿。记录见 `metadata-browser/run-03-ui-fixes/sse-navigation-review.json`，只读独立agent已从原network按requestId重建得到一致结论，见 `independent-ui-fixes/RUN03-CROSS-REVIEW.md`、`run03-sse-independent.json`；这不是第二轮浏览器/HTTP执行。外部CDN加载与依赖这些脚本的功能尚未验收。
- 手机pointer专项：5例执行20个真实鼠标步骤，45项断言通过、15次版本中心hit-test通过；包括遮罩关闭、菜单导航后收回、显式收回及返回原页。仅Chrome鼠标与CSS视口，不是真机触摸或全视觉/对比度验收。执行agent收尾核对260个原始证据文件SHA一致，未覆盖原矩阵。独立agent重算手机动作/请求窗口并实际查看6张PNG；返回后自动收回仅有即时布尔记录，最终截图已再次展开，不能称每一步都有关闭几何快照。最终报告见 `metadata-browser/run-03-ui-fixes/REPORT.md`、`result.json`。
- 该环境是生产构建的frontend加隔离backend；健康检查显示backend development，不能称为完整生产配置验收。390×844是桌面Chrome CSS viewport，不是手机实机或WebKit。普通6608/正常业务栈没有因此更新。

### FE-03：限定保存与交卷争用实例

- `assessment/concurrent-http-result.json`：4组真实HTTP争用；外部PG行锁屏障建立不同PG backend PID等待链，两个HTTP future等待后释放。保存先锁时保存200/交卷200，A答案最终10/10；交卷先锁时交卷200/晚保存422，保持未答0分；重复提交、重复保存及四组晚到答案422后持久化不变均核实。两个PG PID不证明请求来自不同Uvicorn worker。
- `assessment/browser-ui-result.json`：真实Chrome保存被PG锁阻塞，点击交卷产生0 submit请求、0确认框并显示警告；释放后保存/交卷各一次，DB为A、10/10、graded。没有mock路由或源码修改。最终成绩来自API/DB，**未证明成绩页渲染10分**；保存期截图10分是题目满分。
- 独立只读审查：HTTP151项、浏览器44项证据一致性断言；不是独立HTTP/浏览器重跑，也不是195个产品测试。独立审查发现脚本等待“答案保存中”但页面实际为“AI 判题中…”，该hidden等待可能空通过；不推翻PG锁/零submit证据。浏览器只保留聚合请求计数而events为空，不能独立重算逐请求时间线。见 `independent-assessment/BROWSER-REVIEW.md`。
- 本次FE03使用旧前端 `sha256:4d95e960f7657cf20900d5f1350091d9deb69bb1524aa70da6a0867466311be6` 和后端 `sha256:000ef56d55f3deee95aaacc374f06d46729b1ca4a6c38e94b1c843c26e79ea7d`，不覆盖新元信息镜像。初始化bootstrap→Alembic→兼容bootstrap，不是纯Alembic空库验收。AI长事务、取消/丢响应、混版本、跨worker归属、高压及最终成绩UI未闭环。

### AUTH：三项安全目标仍为 OPEN

`auth/REPORT.md`、`auth/REPAIR_DESIGN.md` 与 `main/auth-independent/result.json` 为依据。本轮只有实例与修复设计，没有AUTH产品修改。

1. **ws1同IP替换后精确cache-loss**：A被B替换时A旧access401/B200；A refresh未持久撤销。精确删除A会话缓存键后，A旧refresh200，A原access和新access均200，B仍200。不是自然TTL到期测试。
2. **legacy同IP替换**：旧refresh200产生正确A的新access200；原legacy access仍401，与ws1分开记录。
3. **legacy logout + Redis故障**：logout503且PG refresh已撤销；Redis恢复后refresh401，但原legacy access200。诚实503不等于全部凭据撤销。

- 首轮11 PASS/4 FAIL保留。其中ACL恢复脚本错误地要求规则文本必须是`+@all`，不能接受等价`+@all +set`，引发AssertionError；属于harness问题。修订用独立账号复验通过，完整原ACL指纹恢复，不掩盖上述三项产品反例。
- 主任务89项只读一致性断言核实身份/状态，不是89次产品重跑。PG/Redis停机503而恢复后凭据200的PASS仅指诚实故障反馈。并发refresh线程池没有确定性PG屏障；合成IP头不代表真实生产代理链；legacy由fixture生成，不是存量客户迁移。
- 六次故障停止均有同ID finally恢复；原失败migrate等资源保留。仅禁止缺缓存refresh会破坏合法恢复；持久撤销需IP串行化、替换对象重验、Redis CAS及双存储故障语义。legacy、TTL和迁移政策仍待定，不以扩权/盲撤销刷绿。

### 工程门禁与安全边界

- 首个metadata镜像后默认include范围Vitest **90文件/649 passed**；type-check exit0。不是全量未纳入include测试，更不是E2E全覆盖。后续UI修复后重新跑的结果另列，不能简单相加。
- 初次文档门禁因摘要滞后失败（9通过/1失败），保留 `main/markdown-*.initial.log`；更新摘要后按真实checker重跑，不改checker。独立证据脚本的KeyError、错误legacy预期、entry/chunk绑定假设等首败均保存为设施失败，不算产品修复。
- 正常业务七容器保持停止，不操作正常DB/Redis或真实名册，不提交推送或生产发布，不重复prune/清理R2证据。主任务本次重跑资源保护检查通过：7容器exited，脚本所列3个保护文件SHA未变；见 `main/final-safety.json`、本次接力 `main/closeout-safety.json`。此检查不等同完整资源/所有文件无变化。
- 当前Markdown派生摘要：110 files / 398 links / 0 missing。本次接力初检仅摘要滞后失败，保留 `main/closeout/markdown-before.log`；本次接力复跑checker通过，Markdown合同10通过/0失败，git diff --check通过；日志为 `main/closeout/markdown-check.resume.log`、`markdown-tests.resume.log`、`diff-check.resume.log`。报告新增引用后再次触发派生摘要滞后（无断链），首败保留 `main/closeout/markdown-check.post-report.log`；已按checker实测同步，完成两agent报告同步后，封存复查结果见 `main/closeout/markdown-check.sealed.log`、`markdown-tests.sealed.log`、`diff-check.sealed.log`；checker通过、合同10通过/0失败、diff检查通过。

## R2 交叉验收接续（2026-09-10，真实镜像与 Chrome 已执行，限定范围验收）

证据根：`/Users/wsh/.codex/artifacts/wangsh-cross-acceptance-r2-d8c3da3/`。
本节覆盖下文旧运行状态；历史失败及历史通过范围均保留，不等于本轮重跑全项目。

| 范围 | 实际证据 | 结论与限制 |
|---|---|---|
| 初始身份查询临时 DNS 故障 | 旧 Docker 停 PG 日志显示 `socket.gaierror(EAI_AGAIN)`；本轮新增同合同红例，修前 **8 failed / 126 passed**，修后 **134 passed** | 本地修复通过；真实 JWT/ASGI + 注入直接/包装异常，覆盖 Bearer、Cookie fallback、optional、SSE admission。不是 Docker/TCP 故障重测 |
| DNS 负例 | 永久/未知 DNS、普通 OSError 同数值、SQL/程序错误及 cause 链测试保留 | 不单凭这些错误统一返回503；既有DBAPI `connection_invalidated=True` 的优先分支另列，不更改撤销、TTL、迁移或重试政策 |
| 独立 AST/驱动异常矩阵 | `independent/results.json`：相同窄合同修前160通过/14失败，修后174通过/0失败，另有2个返回值控制通过 | 只提取两个实际函数体并使用真实安装驱动异常类型，不导入app、不联网；外平台常量是模拟，不是Linux/Windows实机或镜像验收 |
| 独立对抗边界 | 另7例更强预期在修前/修后均未满足：5例连接失效标记优先于底层错误，2例人为cause/多层DBAPI包装未识别 | **不能写181全通过**。这些构造未证明生产可达，不直接判新增产品漏洞；当前窄修复不覆盖，保留探针及可达性限制，禁止抹掉失败 |
| 独立补充cause观察 | `independent/wrapping-observations.json` 另2例程序/权限orig携带PG cause，修前/修后均按既有规则转503，未满足更强不转换预期 | 与主矩阵分开计数；手工构造，未证明驱动自然生成。真实库helper不等于真实Engine连接，详见 `independent/REPORT.md` |
| 测试隔离与源码绑定 | `auth-local/after-unit/result.json`、`after-freeze.json`；dotenv/网络守卫，`blocked: []`；加载 deps SHA 与冻结一致 | 主机 Python 3.13.1；并非最终镜像内执行结果 |
| 当前 Docker 环境 | 用户批准后实际启动 Docker Desktop，Server 29.6.1；`docker/engine-resume/startup.json`、`containers.json` 保留恢复记录 | 离线阻断已解除；正常7容器在恢复后快照仍为exited。恢复既有专用18763栈，D2另建18764/18765隔离栈；真实构建、故障注入及Chrome结果见下表，不等于全项目通过 |
| Docker 启动影响核查 | 旧离线风险报告保留；恢复后实际inspect确认正常7容器均unless-stopped，但未自动运行 | 已获用户确认，不再等待授权；18763原镜像、专用network/volume和回环绑定已核对，仅start原运行服务，未重跑迁移。D2独立执行18764/18765计划 |
| Browser 最终指定身份 | `browser/attempt-05-canonical-guard/xbk-real-result.json`：指定 `browser_admin`，真实Chrome channel 152.0.7977.83，18/18检查，3次真实下载，五尺寸截图均已实际查看；finally配置PUT/GET恢复深比较一致 | 52人50/2分页、搜索回第一页、各导出筛选全集52条。attempt03误用超级管理员与attempt04规范值guard误判保留，不当最终身份结果；原作用域错误亦保留。仅一次seed，后续实时只读核52/1/51后复用 |
| 交叉复核与文档 | Docs四文件已同步；主任务核对导出源码和AUTH/API合同。文档结构当前为110 files / 390 links / 0 missing | 初次110/380/0与10通过保留；合并后首次门禁因摘要未同步失败（9通过/1失败），见 `docs/markdown-check.final.log`、`markdown-tests.final.log`；只更新实测摘要，不改checker或移除链接，重跑结果见下文 |

### 本轮部署实例与独立交叉核验

以下均为本轮新落盘结果；原始矩阵与加严重跑不累加成覆盖率。

| 范围 | 真实结果 | 仍有限制 |
|---|---|---|
| 旧镜像故障复现 | `docker/before/auth-fault-matrix.json`：55/0是**复现合同**通过，其中10项已认证请求实际500；真实停PG日志有临时DNS errno -3 | 不是修后通过；before未运行数据库拒绝新会话场景 |
| 新镜像认证故障 | `docker/after/auth-fault-matrix.json` 88/0；独立反馈后加严首帧解析、用户id/role和token指纹，`strict-auth-fault-matrix.json`再次88/0 | 两次各自保留。停专用PG与`ALLOW_CONNECTIONS false`期间已认证入场返回503、恢复后同token身份一致；后者是数据库拒绝新会话，不是TCP ECONNREFUSED。SSE仅入场/首帧，不是存量连接生命周期 |
| 业务HTTP | `docker/after/business-http-matrix.json`：90检查通过；XBK学年、分页、导出、BIZ-02进行中答案阻断与已完成本人结果、BIZ-03类型碰撞均使用合成实例 | 串行start/answer/submit不算FE-03并发；没有外部AI供应商调用 |
| 运行器假绿修正 | 原`no_answers(None)`会把非JSON泄漏判安全；原脚本/反例保留，修为JSON形状与raw/解析内容双重检查。`docker/runner-review/counterexample-results.json`离线44例通过，新HTTP矩阵记录了加强断言 | 修复的是验收脚本缺口，不等于发现产品答案泄漏；离线反例不冒充真实请求 |
| 新worker实例 | `docker/after/worker-runtime-verification.json`：5项检查通过，核定目标worker自身pong、进程、broker及任务注册 | worker无Docker healthcheck，不能称其Docker healthy；未挂socket，非真实沙箱任务与耗尽测试 |
| 三下载独立复核 | `main-gates/xlsx-independent-cross-check.json`：独立stdlib ZIP/XML解析三本，每本52个精确ID，data/diagnostics两sheet，诊断无数据行、无公式，050姓名`=1+1`为文本、051未选、052休学或其他，三本逐行一致 | 主任务首版解析器遇空inlineStr缺is失败，已单独保留并最小修正；不是产品错误。未用Excel GUI实开 |
| Browser异常保留 | 35条API记录中34条200、1条`/system/overview`403；console error 2，字体ERR_ABORTED 2；pageerror和API5xx均0 | 不是零异常。主任务源码核对：公共页面元信息hook先请求仅super_admin可用且不返回version的overview，属多余权限请求，尚未修改；字体中止根因未查 |
| 视觉与门禁 | Browser实看四桌面及390手机视口；主任务另实看最终1280/390两图。`main-gates/type-check.log`本轮通过；frontend/gateway生产allowlist 469文件SHA与旧构建全部一致 | XBK不是全站视觉；手机筛选内部滚动/全列触控未验，桌面Chrome手机尺寸不是物理手机；旧前端输入一致不等于本轮重建 |

本轮新构建镜像（运行容器image ID及镜像内源码SHA已独立核对，见`main-gates/after-runtime-binding.json`）：

- `wangsh/backend:20260910-857eab7933ec` → `sha256:000ef56d55f3deee95aaacc374f06d46729b1ca4a6c38e94b1c843c26e79ea7d`。
- `wangsh/pythonlab-worker:20260910-857eab7933ec` → `sha256:baae7976f141799608251e5a2d7af01a01d367018a6992765c0e32b465a54b09`。
- 前端复用 `wangsh/frontend:20260909-1f873bc511c0`；网关复用 `wangsh/gateway:20260909-635e90c85687`，不是旧镜像改标签冒充新构建。

独立只读审查已完成，见 `independent/runtime-review/REPORT.md` 与同目录机器核对文件：重新核数before/after业务矩阵及11项protected断言，确认非JSON假绿已在实际HTTP重跑中关闭；strict认证矩阵核9项用户身份和12项完整首帧；backend/worker各362条冻结源码集合及SHA均匹配。不是让原执行者自行声明通过。主任务另重算Browser清单90文件SHA，全部一致。

收尾现场：D2故障注入于2026-09-10 09:27:38（北京时间）结束，`active_fault=null`；主任务在负责人确认后对18763/18764/18765的`/api/v1/health`各做只读请求，均200，见`main-gates/final-health-probes.json`。正常7个业务容器仍exited；本轮三个执行/交叉审agent均已收尾关闭，不存在继续运行的后台验收。D2报告中“Carver待定”为交付时旧检查点，已由上述独立最终报告覆盖。隔离栈保留供复查，未重复资源清理。

本轮收尾文档门禁：`main-gates/markdown-check.final.log`、`markdown-tests.final.log`通过（110 files / 390 links / 0 missing；10/0），`diff-check.final.log`通过；后续最终小幅状态同步复查另存`*.sealed.log`，不覆盖原日志。

**开放项**：匿名/无效凭据的optional入口在通过认证降级后执行业务DB查询，停库期间仍有500，单独观察，不在此次初始身份503合同内；AUTH双存储撤销、旧refresh/代理/跨标签竞态、真实FE-03并发、存量WS/SSE失效、PythonLab完整沙箱与Chrome/WebKit调试、旧数据迁移回退、Excel GUI和全站功能/视觉尚不能宣称通过。新发现的元信息多余403请求应独立小修后重新构建前端验收，不放宽后端权限。

合并后文档门禁重跑通过：110 files / 390 links / 0 missing；合同10 passed / 0 failed。见 `docs/markdown-check.retry.log`、`markdown-tests.retry.log`。
`git diff --check` 合并检查通过，日志 `docs/diff-check.final.log`。

原始红/绿日志和 JUnit：`auth-local/before.log`、`after.log`、
`before-unit/junit.xml`、`after-unit/junit.xml`。原 Docker 失败日志保留在上一批
`docker/private/backend-outage-observed.log`。未重跑已完成文件/镜像清理，未提交、推送或生产部署。

## 四线审查状态复核（2026-09-09 最终镜像证据，验收未完成）

证据根：`/Users/wsh/.codex/artifacts/wangsh-full-audit-20260909-1610/`。本节依据已落盘记录及本轮只读运行状态核对，**不是本轮重新跑过所有测试**；与下文历史结论冲突时，以本节的限定范围为准。

| 范围 | 已有证据 | 当前结论与边界 |
|---|---|---|
| 最终镜像与隔离运行 | backend、pythonlab-worker、frontend、gateway 四组件均由冻结源码真实构建，日期+源码摘要命名；运行容器 image ID 与构建记录一致，隔离入口 `127.0.0.1:18763` 本轮只读访问返回 200 | 构建记录的 `BUILT_NOT_STARTED` 为阶段快照，已被运行证据推进；不是正式发布或全功能验收。首次 Docker Hub 限流失败保留，第二次使用已核验的本地基础镜像 |
| 最终真实 HTTP 矩阵 | `docker/http-matrix-retry.json`：已记录 88 个检查事件，87 通过、1 失败；包含合成 XBK 学年/分页/导出工作簿、BIZ-02 答案权限、BIZ-03 类型碰撞及顺序答题交卷 | **整体 FAIL，后续未完成检查不计通过**。顺序答题交卷不证明 FE-03 并发闭环；首轮因工作簿运行器异常中止的证据保留 |
| AUTH 初始数据库故障 | 局部专用 PG+ASGI 回归曾通过；最终 Docker/TCP 中停止专用 PG 后，`GET /api/v1/auth/me` 预期 503、实得 500 | **最终镜像故障分支未闭环**。不得再由局部隔离绿例推出部署通过；双存储撤销、旧 refresh 恢复及 Cookie/跨标签竞态仍开放 |
| XBK 导出修复 | 前端明确导出筛选全集而非当前分页；后端保留未选/无选课名册行，孤立记录进入 `diagnostics`。最终 HTTP 工作簿行集合、虚拟行及诊断分离检查通过 | 新双 sheet 合同须同步 owner/API 文档；最终 Chrome 点击下载、四桌面/手机目视及 Excel GUI 实开尚未完成 |
| 前端完整测试 | `browser/frontend-full-tests-after.log`：89 文件、629 用例通过；此前旧导出文案静态断言失败已最小校正 | 不是全站浏览器验收；本轮只核对既有日志，不重新执行该套件 |
| PythonLab | 专项真实 Redis/prefork/SIGKILL 恢复证据已落盘；最终 worker 独立镜像已运行，Celery ping 与必需任务注册有实证 | 最终栈未挂 Docker socket，不等于最终镜像沙箱 E2E；真实连续重试耗尽、Chrome/WebKit/DAP/TTY 仍未完成 |
| 文件与镜像清理 | exact 备份并校验后删除 30 个可重建文件；4 个旧零引用构建镜像保留恢复 tar 后删除，未使用 force/prune | 不重复清理；不宣称净磁盘回收或全仓垃圾已清空，在用/未知/回退版本保留 |

本轮文档门禁：状态说明新增后首次检查提示摘要滞后；按检查器真实结果更新为 `110 files / 380 links / 0 missing`。历史段落中的旧断链/旧计数保留作阶段记录，不代表当前结果。

主要原始依据：`docker/private/final-runtime-verification.json`、`docker/http-matrix-retry.json`、`browser/final/RUNNER-REVIEW.md`、`file-governance/cleanup-result.json`、`docker/cleanup-image-result.json`。浏览器运行器仅完成审查，不能作为浏览器已执行证据。下一步先闭环 Docker 认证故障分支，再完成最终 Chrome/XLSX 实例及 owner/API/发布记录/台账同步。

## 2026-09-09 认证反馈与 Docker 隔离模拟（限定链路验收及清理完成，未发布）

证据根 `/Users/wsh/.codex/artifacts/wangsh-auth-docker-20260909-1246/`；本批 before 独立保存。四 agent 分别实现认证、独立 PG/Redis 反证、Docker、前端竞态；主任务交叉整合及真实浏览器验收。以下覆盖相关历史“未修”描述，不代表全项目关闭。正常 DB/Redis/业务卷和真实名册不操作，未提交、推送或生产部署。

| 范围 | 已取得证据 | 尚未覆盖或失败 |
|---|---|---|
| 独立认证 PG/Redis | before/after 各25场景执行；登录提交失败副作用修复，两种提交后交错拒绝旧 issuance（409） | 3种退出写故障与GET-only故障改为503仅修诚实反馈；凭据实际撤销仍未全满足，同IP旧refresh恢复仍RED |
| 认证作者测试 | 原14文件194 case全部保留通过，加新18，共212 passed | 初始139 passed/55 failed的fixture及旧合同失败保留；不等于故障时凭据全部撤销 |
| 前端 Axios | 专项42项；主任务最终88文件614 passed，type-check通过，lint 0 errors/469 warnings | A发现pending login被旧refresh失败取消后，新增15例修前11失败/31通过，修后42通过；A独立原反例1通过/27跳过及另3门禁通过。仅同标签JS门禁；HttpOnly Cookie顺序、跨标签、503可见提示及迟到页面跳转未覆盖 |
| 后端受影响最终合跑 | 2018 passed /142 skipped /2 deselected /2468 warnings；307个实际编译项目模块SHA与源码匹配 | `integration/final-backend-r3/`；守卫拒绝2次旧query-token HTTP用例缓存初始化连接，没有成功外连；不是全后端suite，跳过不算通过 |
| bootstrap 顺序回归 | 第一轮2新例红→7绿；第二轮年份新例红→8绿；A独立R3 16通过、相同断言R2 4失败/12通过 | unit均0外连；静态AST索引发现非通用Python/SQL求值器，有docstring/动态SQL边界；真实迁移证据另列 |
| 真实空库迁移 | 最终backend R4在全新专用DB正常bootstrap→Alembic→兼容patch→uvicorn；head为20260908_0001_xbk_academic_year；pg_trgm1.6、2个trgm+5个legacy索引、3个VARCHAR(9)+学年CHECK均实证 | 不是纯Alembic从零建全表；不是目标存量库/升级回退/备份恢复验收，未手工ALTER、建扩展或stamp绕过 |
| Docker镜像与运行 | backend R4 `3fa0677c…`、frontend R2 `741cf4d5…`、gateway `87f92bd1…`真实构建；5服务健康，运行容器认证/bootstrap源码SHA及前端首页字节已核 | 应用amd64，PG/Redis arm64；仅localhost HTTP、单uvicorn worker、无worker/Docker socket/业务卷，不代表生产TLS、PythonLab或重型模块可用 |
| 原XBK三接口HTTP | 2026-2027/上学期：空态和API种入合成学生/课程/选课后均200，summary 1/1/1、course-results total1；正常logout200、旧Bearer me401及私有XBK三接口403拒绝 | 第一版工具硬编码XBK旧token应401而误报失败；按既有optional-auth契约另存补验，不改生产代码或覆盖首证据；公开模式不以该拒绝契约为保证 |
| 真实浏览器XBK | 实际登录；原三接口200、合成行显示；搜索空态/重置/刷新/六页签/班级筛选/每页条数/分析弹窗、页面重载、退出至登录页通过；Excel真实下载且ZIP/XML含合成学生/学号/课程 | 仅合成1条，无多页翻页、大名册或实际Excel打开；导入只开窗未提交。专用DB通过管理UI临时开启前台后已恢复关闭，无正常数据操作 |
| 浏览器尺寸与错误 | 1280×800、1440×900、1680×1050、1920×1080及390×844截图人工查看，均无document横向溢出；手机刷新/导入弹窗/导出实际点击；业务阶段console 0 errors/0 warnings | 小屏表格横向滚动、筛选面板内部滚动；不是全站视觉/无障碍或WebKit验收。未复现用户content.js异常，不据文件名归因扩展 |

正常logout同时失效旧access/refresh的对照、Redis ACL -get的有效refresh fallback对照通过；GET-only bearer恢复Redis后旧access仍有效，不能把503写成安全撤销已闭环。完整矩阵见 `auth-independent/`。A/B共27个自建容器已独立exact-ID确认不存在；C模拟的9容器、2网络、2卷均按本批manifest精确清理；3个合成DB随专用PG卷移除。主任务独立逐项inspect及列表确认不存在，原7容器/5网络/19卷身份保持，10个本地镜像保留追溯。7份私密合成文件脱敏留证后删除，18680已释放；不发布。证据见 `docker/clean/final-clean-verification.json` 与 `integration/main-cleanup-verification.json`。

失败完整保留：Python基础源首次TLS超时；R1 trgm扩展顺序、R2整数year转换；R3迁移成功但外部context误排纯代码agent_secrets.py，审核精确路径后R4重建；HTTP工具401误断；浏览器工具require不可用/监听脚本期间session中断后改简单fill/click重开成功。这些工具问题不冒充新增生产缺陷，也不删除原始失败证据。业务浏览器证据见 `integration/browser/`，专用会话已关闭，临时内嵌合成凭据脚本/日志已脱敏。

最终轻门禁：Markdown 109 files / 372 links / 0 missing；摘要合同10 passed；Python治理0 errors /14 warnings；`git diff --check`通过。收尾复跑见 `integration/*-closeout.log`。资源清理完成不扩大本批验收范围。

## 2026-09-09 状态恢复与连接撤销批次（本批验证完成，非全项目验收）

证据根 `/Users/wsh/.codex/artifacts/wangsh-state-recovery-20260909/`。三 agent 分区修改，主任务整合与共享文档；本节覆盖下方相关历史“未修”状态，不覆盖其余开放项。未提交、推送、部署或操作正常库/名册；此前 XBK 指定迁移不重复执行。

### 已收分层证据

| 范围 | 当前实测 | 边界与证据 |
|---|---|---|
| PythonLab 原子启动与发布恢复 | 15 passed | `sandbox/green-governance.log`，实际专用 Redis、Docker、provider/journal/flock；Celery eager，无真实多 worker/broker；故障由隔离注入 |
| WS 撤销、原兼容及 cleanup 原子修复 | 179 passed | `ws/cleanup-race-r2/green-freeze-179.log`；原 150 项加 cleanup 29 项，专用 Redis 分支实际运行；真实 JWT/ASGI/SQLite/logout，DAP/TTY transport 替身，不是浏览器网络 E2E |
| 课堂/SSE 无网络整合 | 134 passed / 2 deselected / 8 warnings | `sse/classroom-isolated-corrected-v3.log`；两条 PG 用例另验；此前错误 deselect/路径失败保留 |
| 三端点 ASGI 流生命周期 | 6 passed / 8 warnings | `sse/asgi-lifecycle.log`；实际路由/依赖/StreamingResponse，合成 receive/send 和 SQLite/cache/pubsub，未走 TCP |
| AUTH 固定依赖白名单 | 194 passed | `auth/auth-regression-03.log`，Python 3.11/FastAPI 0.128，14 文件含原认证及新增 SSE/ASGI/CAS；非全认证 E2E |
| AUTH 真实 PG/Redis 故障矩阵 | 11 场景运行完成；5 RED 风险仍成立 | `auth/real-fixed-results.json`；另 4 既有行为通过、1 本批修复、1 代理头刻画；运行成功不等于安全断言通过 |
| AUTH 绑定原子专项 | 8 实例通过 + 15 隔离 unit | `auth/binding-fixed-results.json` / `binding-unit.xml`；真 WATCH 冲突、迁 IP、到期、ACL；不是完整登录原子事务 |
| C→主任务 SSE | 6 实例通过 | `auth/sse-real-results.json`，真 PG logout/Redis nonce撤销，三端点×Bearer/Cookie；直接 body_iterator/合成 pubsub，不是网络 SSE |
| 旧课堂 PG 两用例 | 2 passed | `auth/classroom-pg.xml`；首轮遗漏 znt_agents 外键前置而失败，runner 在专用 schema 补真实空表后保留原测试复跑 |
| 主任务→C 独立反证 | 3 实例通过 | `integration/auth-cross/results.json`；真 Redis 三次 WATCH 冲突、ACL 禁 WATCH、损坏 JSON，均不发新会话；非 HTTP/DB |
| 沙箱旧 fixture 兼容与补强 | 136 passed；与真实专项联合 151 passed | 原 125 场景全部保留，追加 11 个错误/交错场景；两份替身适配 raw GET/EVAL 与可信 journal，READY 未提交改为明确失败+一次世代补偿而非盲重建。`sandbox/COMPAT_REPORT.md` 记录断言变化，非放宽断言 |
| 受影响最终无网络合跑 | 1987 passed / 142 skipped / 2 deselected / 2468 warnings | `integration/final-audited/run.log` 与 `command.json`，原白名单加 cleanup 新文件；此前 `backend-final.log` 同结果。守卫拒绝 2 次旧 query-token HTTP 用例的缓存初始化连接，未成功外连；实际编译源码 SHA 已核对 |

### 交叉验证与必须保留的失败

- B→A：真实 Redis WRONGTYPE 和真实 TTL 到期窗口，旧字节 2 红、冻结实现 2 绿。TTL 路径任务 SUCCESS 是取消/补偿结束，不是 READY 成功；补偿 provider 为替身，见 `ws/cross-a/CROSS_A_REVIEW.md`。
- A→B：`_touch` 等待期间真实 nonce 撤销，旧 1 红/新 1 绿；另发现 cleanup 在 detach 等待期间盲写 READY 覆盖新 TERMINATED/RUNNING。初次 before/current 都红；B 实修后 A 按 R2 最终编译 SHA 独立复跑原两个反例，2/2 绿：新状态/revision/debug_owner/lease 不变，失效 Continue 阻断、4401、detach 一次且无遗留任务。见 `sandbox/ws-cross-review/CROSS_B_REVIEW.md` 与 `cleanup-r2-final/manifest.json`；真实 Redis/ASGI，DB/transport 替身。
- 全合跑首次因清空环境后 APP_VERSION 未提供而收集失败；仅外部运行器补合成版本，未改 main/settings。随后 52 个沙箱旧测试失败，旧替身未模拟新原子接口并触发 316 次被守卫拒绝的外连尝试；未连接正常资源。失败日志完整保留，不删测试或放宽治理 ceiling。
- 最终无网络合跑跳过项：XBK PG 67、迁移 1、HTTP 2、xlrd 1；测评 profile 1、PG 19；WS 专用 Redis 21、cleanup 专用 Redis 29；sandbox 外部 harness 模块 1。跳过不是通过，PG/Redis 定向层另列且不能重复相加。
- 本机 Python 3.13/FastAPI 0.136.3 隔离测试与固定依赖运行器分层记录；不把本机版本冒充 requirements 版本。

### 尚未关闭

AUTH-01 单边/双边存储故障可留下旧 access 或有效 refresh；AUTH-02 同 IP 替换后旧 refresh 恢复、登录 DB 失败已旋 nonce、代理白名单/头清洗/后端直达与迁移窗口仍开放。小范围 CAS 没有解决双存储原子性。

PythonLab 真实 worker 崩溃、压力、跨主机共享 inode/混版本、Redis 不可核对与删除失败的恢复；真实 Chrome/WebKit 多断点与 pointer、真实 DAP/TTY、AI/小组 SSE、供应商故障、全站视觉、重型模块生产运行、六份导出 Excel 验收、真实名册及目标库/生产验收仍开放。本批未复验正常登录态 XBK 页面，也未重复其迁移。

### 门禁与资源收尾

当前 Markdown 派生摘要：109 files / 372 links / 0 missing。

- Python 治理：0 errors / 14 warnings（308 files / 1551 functions），未抬高 ceiling；Markdown 合同 10 passed，`git diff --check` 通过。新增 owner 引用后派生摘要曾失败，修正实际统计后复跑，不删规则。
- 原 52 项失败、APP_VERSION 收集失败、fixture 迭代及 WS cleanup 旧红日志保留；本批未改前端，不声称视觉、type-check、build 或正常登录态 XBK 验收。
- 源码及增量：`integration/final-source-integrity.json` 核对最终合跑实际编译字节与冻结源码，`integration/batch-delta.json`/`batch.patch` 相对本批 before 字节生成，非将 HEAD 全量 dirty 算成本批。HEAD 与 Login 保持原值。
- 资源终核：本批 A/C 共 69 个专用 Docker exact ID、1 个 C 关联匿名卷均只读确认不存在；A/B/主任务共 31 个专用 Redis 进程均有原始 handle exit 0 记录且 exact socket 当前不存在。详见 `integration/resources-{containers,volumes,redis}-final.json`。没有重跑旧资源脚本、批量清理正常栈或移除镜像。
- 本批证据总览：外部 `REPORT.md`；开放问题仍按上节保留，不能据此宣布全项目或生产发布完成。

## 2026-09-09 风险收口并行批次（本批验证完成，非全项目验收）

本节覆盖下方历史批次中认证歧义/optional、测评首次起测及 XBK 父删除竞争尚未修复的状态；不抹去历史失败，不扩大为全项目验收。证据根 `/Users/wsh/.codex/artifacts/wangsh-risk-closure-20260909/`。本批未提交、推送、生产部署、正常库迁移或名册操作；此前获批 XBK 本地迁移不重复执行。

### 已收结果与分层

| 范围 | 实际结果 | 证据与边界 |
|---|---|---|
| 测评整模块专用 PostgreSQL 运行器 | 246 passed / 8 warnings | `assessment-pg/assessment-integration-final.log`；包含 19 项 PG 并发专项，其余混合单元/SQLite 等，不是 246 项 PG 并发 |
| XBK 专用 PostgreSQL 运行器 | 1101 passed / 1 skipped / 8 warnings | `xbk-pg/xbk-integration-final.log`；包括新增 59 项父锁/删除/恢复/导入专项；缺可选 xlrd 跳过旧 xls。明确排除 live schema migration、外部 HTTP 两个文件 |
| AUTH 固定依赖兼容 | 137 passed / 8 warnings | `assessment-pg/auth-pinned-pre-ws.log`；Python 3.11.16 / FastAPI 0.128.0，原认证八文件，合成缓存/SQLite，不是 PG/Redis 认证 E2E |
| 受影响后端无网络合跑（WS 前） | 1705 passed / 91 skipped / 2468 warnings | `integration/backend-pre-ws.log`；禁止 dotenv、conftest、外连。91 skip 为 XBK PG 67、live migration 1、外部 HTTP 2、xlrd 1，测评 profile 1、PG 19；PG 另验，不能把 skip 算 passed |
| 受影响后端最终无网络合跑（含冻结 WS） | 1812 passed / 91 skipped / 2468 warnings | `integration/backend-final.log`；同原白名单加 WS 三文件，0 外连尝试；skip 解释同上。并非全后端测试，不能与其他行简单相加 |
| 原认证 + WS 固定依赖最终复验 | 244 passed / 8 warnings | `assessment-pg/auth-ws-pinned-final.log`；Python 3.11.16 / FastAPI 0.128.0，实际 PG 连接 0、拦截尝试 0；仍为合成 cache/SQLite/ASGI 与 transport 替身 |
| WS 作者专项及兼容 | 107 passed / 8 warnings | `auth/ws-session/final-green.log`；同 56 项专属测试旧 handlers overlay 22 failed / 34 passed，最终专属通过；兼容用例保留原 assert AST |
| PythonLab generation 归属专项 | 140 passed | `sandbox/green-final.log`；真实本机多进程 flock，Docker/cache 替身；不是实际 Docker/Redis/worker 恢复 |
| 前端与正常服务只读 | type-check exit 0；壳页/健康接口 200 | `frontend-typecheck.log`、`integration/runtime-readonly-final.json`（2026-09-09 10:49 CST）；本批无前端修改，未做本批登录态全站浏览器验收 |

### 实例、红绿与交叉审查

- **测评**：同配置同学生两个事务同时第一次起测，先取得 PostgreSQL 事务 advisory lock 后查会话，等待者复用同一进行中会话；按会话行锁与交卷协调。原最小红例 2 failed / 2 passed。新增取消整体回滚、延迟约束提交失败后的重试、不同用户/配置不互相阻塞，以及交卷先提交后按规则起新测评。默认 READ COMMITTED、合作写入口；AI 调用仍占事务，不保证 SQLite、混版本和旧重复数据。Ohm 只读核验见 `auth/ASSESSMENT_CROSS_REVIEW.md`。
- **XBK**：写选课和父实体软删交错，先学生 SHARE、后课程 SHARE，再子行 UPDATE；按不可变 ID 排序、锁后重验有效性；批删只级联冻结的父 ID 集合。新增 59 项同条件旧源 47 failed / 12 passed，修复后通过：其中 37 真实 orphan、6 恢复/硬删异常或锁等待、4 顺序/释放/状态断言，不是 47 个独立 orphan。40 项为真实 PG writer/delete 顺序矩阵。未加 FK，不保证旧版本、直接 SQL 和自然键更名；见 `xbk/REPORT.md`。
- **认证**：跨字段 subject 碰撞只允许唯一有效用户；optional 复用 mandatory nonce/IP 验证，不以 raw lookup 代替认证。Pasteur 独立 HTTP/SSE/Cookie 等 19 项加原 58 项：同断言旧 deps 20 failed / 57 passed →最终 77 passed；0 外连尝试，loader 实际源字节 SHA 核对。自写 fixture 首轮预期错误保留；见 `sandbox/AUTH_CROSS_REVIEW.md`。不是 AUTH-01 双存储或 AUTH-02 迁移闭环。
- **PythonLab**：旧 stop/补偿不得删除已由新 generation 接管的同一 ID；五个原 strict xfail 调度反例改为安全断言通过。Boyle 独立核对三生产 SHA，另 3 passed 是**开放风险复现**：持续发布异常留下 live 资源、非 CAS READY 可覆盖中途 TERMINATED、removed journal 仍可走可写 meta 兼容接管。不得把这三个绿测试写成修复，见 `xbk/SANDBOX_CROSS_REVIEW.md`。

- **WS 独立交叉**：Pasteur 在作者 107 项基础上加 11 项，共 118 passed / 8 warnings；同 118 项仅旧 handlers overlay 为 24 failed / 94 passed。实际加载 SHA 与冻结四文件一致，0 外连尝试，见 `sandbox/WS_CROSS_REVIEW.md`。其中 3 个绿测试是**未修风险刻画**：terminal/DAP 的 nonce 检查后暂停，再真实 logout，仍到达 transport；已 attach DAP 在 logout 后仍转发 continue。不宣称持续撤销或真实容器 DAP E2E。

### 最终门禁、失败与资源

当前 Markdown 派生摘要：109 files / 349 links / 0 missing。

- Python 治理 `integration/governance-final.log`：exit 0，0 errors / 13 warnings，305 files / 1526 functions；没有提高 ceiling。WS 草稿超行数先失败，拆小 helper 后恢复历史上限，旧失败保留。前端 type-check exit 0，本批未改前端。
- 最终 Markdown 合同 exit 0：109 files / 349 links / 0 missing；合同自测 10 passed，`git diff --check` exit 0，见 `integration/docs-final.log`、`integration/markdown-tests-final.log` 与 `final-gates-exit.json`。不能沿用旧批绿色替代本轮。初轮因本批 PYTHONLAB 改标题产生 DEPLOY 旧锚点、派生摘要过期而失败；原日志保留并修正，未放宽 checker。
- 测评首轮环境缺 aiosqlite 的 124 failed / 121 passed、补依赖后的 245 passed 与增加交叉用例后的 246 passed 均保留，不当作产品红绿。WS 初期 107 passed 仍有 2 次被 guard 阻断的网络尝试，修正直接 IO 替身后最终 0 尝试；历史日志未覆盖，不把“无成功外连”等同“无尝试”。
- 最终源码对照 `integration/final-source-integrity.json` 与 `integration/this-batch-vs-before.patch`：46 个白名单文件中 42 个相对本批 before 有变化，87 项加载哈希对照无漂移，HEAD 不变，Login 字节不变。只计入本批变化。主任务整合记录为加载模块文件哈希，作者/独立审查另有实际 loader 编译字节证据；不混同两种强度，也不把全 dirty 据为本批。
- 两个专属无网络 PostgreSQL 已按 manifest 精确 ID、名称、label、无业务挂载/发布端口验证后删除；同 label 无残余 runner，见 `integration/cleanup-owned-pg.json`。第一轮第一个容器删除成功，后置缺失检测因 Docker 小写报错文本误判，第二个尚未执行；记录 `cleanup-first-attempt-diagnostic.json`，修正大小写检查并确认前者已不存在后才清理后者。正常服务/数据库未操作。
- 三个 worker 的分区修复与只读交叉结果已收取；未提交、推送、生产部署或执行本批正常库迁移。不代替正常登录、真实浏览器/供应商、真实 PostgreSQL/Redis 认证、Docker worker 和生产验收。

仍开放：AUTH-01 双存储、AUTH-02 代理/候选集成与 token 迁移，以及长期连接撤销；PythonLab 非 CAS/持续故障/兼容接管与崩溃恢复、debug 网络/DAP、真实 worker；自然键更名等业务政策；真实供应商、全站视觉/浏览器、完整依赖扫描、目标库迁移和生产验收。

## 2026-09-09 用户实际 XBK 页面 500（本地故障已恢复）

本节覆盖下方批次关于正常库未迁移/等待授权的历史状态，不覆盖其隔离测试事实。用户明确回复“允许”后执行本地备份、实际恢复验证、指定迁移和原页面验收。证据根 `/Users/wsh/.codex/artifacts/wangsh-xbk-live-500-20260909/`，实际操作证据位于 `live-migration/`。本次关闭的是 XBK-RUNTIME-01 的本地类型不匹配故障，不是全项目、全模块或生产验收。

- **根因与限定修复**：原 `2026-2027/上学期` 三接口 HTTP 500 为数据库整数 year 与代码 String(9) 的比较异常。现已仅从 `20260817_0001_query_filter_indexes` 升至 `20260908_0001_xbk_academic_year`；三表均为 `VARCHAR(9) NOT NULL`，新增 3 个已验证学年 CHECK。通过既有 Alembic env 执行，没有 `upgrade head`、stamp、裸 SQL 替代迁移或额外 revision。env 仍执行独立事务的版本表容量兼容 DDL；原/现容量都是 VARCHAR(64)，未改变版本表结构。
- **真实备份恢复**：全库 custom-format dump 保留在外部受限权限目录，最终文件 17,030,484 bytes。独立无网络/无映射端口/无业务卷 PostgreSQL 实际恢复后，47 张表、2,235 行的逐表完整行摘要、完整 schema（只忽略 pg_dump 随机 restrict 标记）、已采集序列属性及 XBK 索引/约束/关联与备份前相符；不是仅运行 `pg_restore --list`。备份不是 Redis/上传文件或全应用恢复方案，不公开 dump 或真实名册内容。
- **校验失败透明记录**：前两次 pg_restore 成功，但全行摘要比较失败，流程停止且恢复服务，正常库未迁移。第一轮正常库时区 Asia/Shanghai、恢复库 UTC；第二轮发现容器 PGTZ 覆盖 PGOPTIONS。对第二轮恢复库显式设为原快照时区后，与保留的备份前快照完全一致；最终新窗口重新备份，并在两个校验连接显式 `SET TIME ZONE 'UTC'` 后通过。原失败、备份与证明保留在 `attempt-01/`、`attempt-02/`，不是修改数据或放宽内容断言刷绿。
- **正常库迁移与保真**：最终先在真实备份恢复库试跑同一入口并验证，再迁移正常库；两条 Alembic 连接均实测 lock_timeout=5s、statement_timeout=1min、idle_in_transaction_session_timeout=1min。09:08:40 CST 独立连接验证持久化结果，09:08:41 恢复服务。46 张业务表（排除版本表）归一化完整行摘要及 44 条已采集序列属性不变；XBK 分组精确映射 `2026 → 2026-2027`，其他字段、term 原文、索引和自然键关联保留。全 schema 差异仅三表 year 类型/注释/CHECK（另有 dump 随机标记），未改其他业务表。
- **真实 Chrome 原页面**：原登录态保留。真实点击“重试加载”和整页刷新后，原 summary、meta、course-results 三个 URL 各自 HTTP 200，均非磁盘缓存；错误提示消失、表格显示共 58 条。实际点击第二页再回第一页，两个分页请求均 HTTP 200，界面分别显示 2/2 和 1/2。见 `browser-retry-responses.json`、`browser-reload.json`、`browser-pagination.json`、`browser-restored.png`；不是覆盖鉴权/DB 依赖的合成 API。
- **数据含义保持**：迁移后上学期学生 58；独立 term='1' 的学生、课程、选课仍各 2，未合并。上学期没有实际课程/选课，既有分类将学生列入“休学或其他”，页面显示学生58/课程0/选课0/未选0/休学58；这是现有数据与算法，不是新认定学生的真实学籍状态，也不是导入了真实课程或完成名册对账。
- **前端最终回归**：agent 7 文件 87 passed，type-check 通过；主任务独立复验 6 文件 85 passed，加展示回归 1 文件 2 passed，type-check 通过。页面专项含 7 项，涵盖三接口失败、成功重试、局部失败、隐藏旧列表、过期响应及班级保持/合法清除。见 `front/phase2/`、`front/main-rerun.log`、`front/main-presentation.log` 和 `front/main-typecheck.log`。第一阶段改前副本是编辑记录重建，没有事前哈希，不能独立证明历史字节；第二阶段有实际修改前副本，均保留说明。
- **独立 PostgreSQL 预演**：最终 1 passed，含升级前 8 次 500、真实迁移后 10 次 200、降级后当前 String 模型再次 8 次预期 500。使用真实 XBK router、真实 Alembic env/迁移及合成数据，覆盖两个 term；仅替换认证和 DB 依赖，不是正常登录 E2E。年份映射后其余字段逐行不变、行数/约束/索引/自然键关联保持；降级快照还原。首轮因测试查询 contype 的 bytes/string 不匹配失败，已保留；修正测试查询后通过，非迁移失败。见 `migration-rehearsal/REPORT.md`、`observations.json`、`attempt-01/`。
- **范围与资源**：主任务实操，独立 agent 分别复核迁移安全和结果。停写仅针对正常后端、两个 worker、Adminer，未停 PostgreSQL/Redis/前端；同 ID 服务均恢复运行，backend healthy。三轮恢复容器及两个一次性迁移 runner 按 ID/label 精确清理，专属 label 剩余 0；临时私密 env 已删除，备份保留。没有提交、推送、生产部署、合并学期、删数据或重导名册。
- **独立结果复核边界**：`live-migration-result-review.md` 离线复算四份快照，未发现本批数据结果的新硬阻断；未访问 dump、数据库或浏览器，不替代主任务实际恢复和页面证据。sequence 未直接采集 is_called 等全部内部状态；未实测超时触发后的中止/回滚路径。两次历史时区失败不在其获准材料内，不能称已由该 agent 独立确证；主任务第二轮匹配时区证明见 `live-migration/attempt-02/attempt02-timezone-proof.json`。
- **仍开放**：浏览器扩展 `content.js-081daf6f.js` 的错误与 API 500 独立，已确认扩展来源，未停用/修复扩展。React DevTools 下载提示不是故障。本次未测锁争用故障注入、迁移后新增数据的恢复/回退、完整历史迁移链、所有角色与全站多尺寸视觉；其他 AUTH/PythonLab/XBK 业务规则开放项不因此关闭。
- 当前 Markdown 派生摘要：`109 files / 343 links / 0 missing`。本次同步后 checker 通过、合同测试 10 passed / 0 failed；日志见 `live-migration/markdown-check.log`、`live-migration/markdown-tests.log`，保留所有历史失败，不改旧批次统计或放宽规则。


## 2026-09-09 闭环反证复核与剩余修复（当前工作区，未发布）

本节优先于下方历史批次。证据根 `/Users/wsh/.codex/artifacts/wangsh-closure-review-20260909/`，HEAD 仍为 `d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加既有 dirty。多 agent 分区修复并执行反证，主任务独立整合；不把测试替身、SQLite、隔离 PG、合成 API 浏览器混称全项目 E2E。未接触正常 PG/Redis、8000、真实名册、供应商或远端，未提交、推送、迁移或部署。

### 实测结果与分层

| 范围 | 本轮实际结果 | 证据与结论边界 |
|---|---|---|
| AI preview | 旧实现 27 failed / 38 passed；新实现 SQLite 65 passed，独立 PG 65 passed；六个错误变异均被捕获 | `ai/preview-report.md`、`postgres/ai-integration.log`；按最新时间/ID，而非字典序；保留 session/user/agent 合同，生产视图和大历史性能未验 |
| XBK 重构反证 | 1034 passed / 11 skipped；七组不安全变异均被捕获 | `xbk/RESULTS.md`、`release-metadata.json`；旧 dirty+新增测试也通过，属于行为保持拆分，不冒称新增业务修复 |
| AUTH logout | 67 passed / 8 warnings，新增 22 项；六组不安全变异均被捕获 | `auth/REPORT.md`；同文件 helper 拆分，原回归字节不变；无真实 PG/Redis 双存储验收 |
| 自适应起测 | SQLite 与真实 PG 旧实现均 4 failed / 1 passed；逐题保存点及补测后 SQLite/PG 各 9 passed | `assessment/adaptive-red.log`、`postgres/adaptive-red.log`、`assessment-review/report.md`、`postgres/post-review-final.log`；真实 ORM/FK 和 SQL 约束异常、供应商替身；保存点内保留成功题和原占位策略，保存点前置 flush 失败则验证整体回滚 |
| PythonLab 归属 | 四文件 117 passed / 5 xfailed；旧实现新测试 14 failed / 11 passed / 5 xfailed；`--runxfail` 为 5 failed / 25 deselected | `sandbox/RESULTS.md`；归属异常/缺失/未知保守保留已修。**5 个严格 xfail 是确认未修，不属于通过** |
| 后端受影响范围整合 | 1599 passed / 23 skipped / 5 xfailed / 2468 warnings，exit 0，外连尝试 0 | `integration/backend-final.log`、`junit.xml`、`run_metadata.json`；全 XBK/assessment、logout 两文件、AI 两文件、内容权限、PythonLab 四文件及迁移预检两文件，**非全后端测试** |
| 独立 PostgreSQL 整合 | 101 passed / 8 warnings，exit 0，无 skip | `postgres/post-review-final.log`、`post-review-final-metadata.json`；AI 65、XBK 真并发 8、自适应 9、测评真并发 11、画像 8；唯一 schema、无映射端口、network none 的专用 PG |
| XBK 真实隔离 HTTP | 2 passed / 0 skipped，exit 0；58 状态断言及 multipart/export 链路通过 | `http/final-integrity-rerun/REPORT.md`；真实 XBK router/PG/multipart/XLSX，合成角色；空代码当前 POST 必须 422，历史空值只在外部 seed 适配器中写隔离库 |
| 真实 BIFF `.xls` 补验 | 1 passed / 9 warnings，exit 0，外连 0 | `xls/test.log`、`dependency-source.json`；只向外部 runner 复制主机已有 xlrd 2.0.1，不安装/改变环境，不等于默认镜像具备 xlrd 或 Excel 客户端验收 |
| Chrome / WebKit | 各 17 项，page errors 0、非白名单请求 0、exit 0 | `frontend/browser/*-results.json`；1440×900 当前真实组件/合成身份、API 和 stream 边界；AssessmentPanel 为替身，**不作为本轮测评 UI 验收**；frontend/src SHA 前后无漂移 |
| 前端工程 | 86 files / 565 passed；type-check、lint、token gate 均 exit 0 | `integration/frontend-*.log`；本轮无前端源码修改，未重跑生产 build，旧批次 build 不能记为本轮执行 |
| Python 治理 | 0 errors / 11 warnings，303 files / 1509 functions，exit 0 | `integration/governance-post-review.log`；未放宽 `python-governance-baseline.json`；剩余复杂度/文件规模警告保留 |

### 失败、跳过和未闭环边界

- 后端普通整合跳过 23 项：XBK PG 并发 8、测评 PG 并发 11、画像 PG 1、隔离 HTTP 2，以及缺少 xlrd 的真实 BIFF `.xls` 1。PG/HTTP 由对应独立运行补验；`.xls` 另用现有主机 xlrd 外部 overlay 跑真实 BIFF2 原用例通过，未用改扩展名 XLSX 代替。默认 venv/现有 backend 镜像仍缺 xlrd，requirements 未声明，部署依赖覆盖不能据此关闭。2468 条警告以 SQLite datetime adapter、Pydantic/Starlette 和 utcnow 弃用为主，未过滤刷绿。
- 首轮 PG 整合误选只支持 SQLite 的 `test_assessment_profile_detail_isolated.py`，镜像缺 aiosqlite，出现 **56 failed / 89 passed**；保留 `postgres/final-integration.log`。改选维护 PG 文件 `test_assessment_profile.py` 得到 `final-green`；SQLite 详情文件已在本地无网络整合覆盖，未改断言或下载依赖掩盖失败。
- 自适应初次新增夹具漏填 User.full_name、XBK 首次 rollback 变异注入未命中已注册 callable 等执行错误保留原日志；后者修复变异设施后重新捕获。独立只读审查确认 parser 两函数 AST 与 before 一致、未发现保存点修复阻断项，要求的前置 flush/答案 ORM flush/严格调用顺序边界已追加：SQLite 与独立 PG 各 9 项通过；去除保存点负对照 2 failed / 7 deselected，严格捕获失败。前置 flush 两例仍要求 PendingRollbackError、Session 失效，并以新 Session 确认无部分提交，不放宽为成功。补测前整合证据保留 `integration/pre-supplement-*`；最终合跑包含新增四例。最终 commit 失败、断连、取消尚未验证。
- PythonLab 创建成功后 marker 消失/终止/替换可能导致容器未登记；归属查询后实际停止前被新会话复用/替换，旧 stop 仍可能误清。精确容器 ID 不等于不可接管的 generation token。严格 xfail 已复现，仍需跨 Redis/worker/Docker 的原子归属方案，不能宣布安全闭环。
- 其余开放：AUTH 候选集成/可信代理/迁移与双存储故障；XBK 自然键更名、父删除并发、合法并发计数、lxml 路径及真实 Excel/名册；首次并发起测唯一性、占位后评分及 AI 长事务；生产供应商/实时链路、全站视觉、重型模块生产运行、依赖扫描与备份恢复/远端验收。

### 整合与资源收尾

当前 Markdown 派生摘要：`109 files / 339 links / 0 missing`。本轮首次 checker/合同测试因摘要滞后失败（9 passed / 1 failed），原日志保留；未放宽 checker，历史批次数字不重写。

- 全部 agent 写权已释放。新增事务边界补测完成后重跑受影响后端和独立 PG；HTTP 因产品 EOF 空行清理导致已加载 SHA 过时，保留旧 `final`，新增 `final-integrity-rerun` 重跑，不以“仅空白变化”跳过源码一致性验证。首次补测中完整性失败保留 `integration/pre-supplement-integrity.json`，不删除失败证据。
- `integration/final-integrity.json` 重新核对后端 1752、PG 265、`.xls` 1613 个加载模块条目（本地主机项含运行时依赖），HTTP 259 个实际加载产品模块和 304 个快照文件，均与当前文件 SHA 一致；模块加载不等于所有路径已覆盖。前端 542 文件无漂移，HEAD、Login、治理 baseline 未变。相对本轮 1045 文件基线，23 个修改、5 个新增、1022 原字节保持，无缺失；本轮差异另存 `integration/batch-only.diff`，不把全部既有 dirty 算作本轮修改。
- 主任务专用 PG 按精确 ID/name/label、network none、无映射端口核验后清理，label 范围剩余 0，见 `postgres/post-review-cleanup.json`。HTTP 旧阶段与 EOF 后重跑的自有容器均精确清理，见 `http/final-cleanup.json`、`http/final-integrity-rerun/cleanup.json`；浏览器与自有测试服务已清理。没有重启或清理正常栈。
- Markdown checker 最终通过（109 files / 339 links / 0 missing），合同测试 10 passed / 0 failed，结果见 `integration/docs-post-review.log`、`integration/markdown-tests-post-review.log`；本轮闭环仅限上述实测范围，PythonLab 已复现开放项、真实基础设施和全项目验收仍不关闭。

## 2026-09-09 全面修复整合（当前工作区，未发布）

本节优先于下方历史批次。HEAD 为 `d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加既有 dirty；证据根 `/Users/wsh/.codex/artifacts/wangsh-repair-batch-20260908/` 保留开始日期，最终整合实际跨至 2026-09-09。未访问正常 PG/Redis、真实名册、供应商或远端；未迁移、重启正常服务、提交、推送或部署。结论为限定修复及分层验证，不是全项目验收。

| 层级 | 最终实际结果 | 证据与边界 |
|---|---|---|
| 后端受影响范围整合 | **1478 passed / 23 skipped / 392 warnings**，exit 0，无网络尝试 | `integration/backend-final.log`、`backend-final-junit.xml`、`backend-final-run_metadata.json`；整个 XBK/assessment，退出撤销、AI 会话新旧、内容权限、PythonLab 三文件、迁移两文件；不是全后端目录 |
| 独立真实 PostgreSQL | **62 passed / 8 warnings**，无跳过，exit 0 | `postgres/final.log`、`final-junit.xml`、`final-metadata.json`；AI 会话新旧、XBK 真双事务、测评锁与画像。唯一隔离 PG16，无映射端口；不含正常认证/Redis |
| XBK 并发红绿 | **3 failed / 5 passed → 8 passed** | `postgres/xbk-red.log`、`xbk-green.log`；维护测试真实 import_data、双 AsyncSession、pg_stat_activity 锁等待，覆盖异身份不覆盖和整批回滚；helper 提取后已纳入最终 PG |
| XBK 文本与 CR writer | 两种 XML writer、三个现有解释器配置各 **596 passed**，网络尝试 0 | `export/xml-writer/report.md`、`handoff-{lxml,etree,venv}`；真实生成/回读及 ZIP XML 检查，不实际打开 Excel。无 lxml 红测为 88 failed / 506 passed（含原整合 76 例及新增 12 例），相同精确保留断言转绿 |
| AI session 聚合 | SQLite 定向 **32 passed**，同时纳入最终真实 PG | `conversations-consistency/report.md`；混合/NULL 身份、过滤、limit、用户隔离；旧 preview 的字典序行为仅刻画未修 |
| PythonLab 启动恢复 | 三文件实际 app settings **92 passed / 8 warnings**，无网络尝试 | `sandbox/RESULTS.md`、`real-config-{red,green}`；新 fixture 修前 4 failed / 88 passed，修后 92 passed；真实 Celery wrapper/memory broker、Docker/Redis 替身，不是 worker/Redis/Docker E2E |
| 迁移预检 | 本地与现有镜像各 **62 passed**；真实 PG 目录 **14/14** | `migration/REPORT.md`；真实 loader/evaluator，索引结构正例采用唯一 schema→public adapter；不是 public 目标库升级或迁移执行 |
| 前端全量工程 | **86 files / 565 tests passed**；type-check、lint、token gate exit 0 | `integration/frontend-{test,typecheck,lint,token}.log`；lint 为 **0 errors / 469 warnings** |
| AI 历史/导入浏览器 | Chrome 152 与 WebKit 26.4 各 **17 passed**，pageerror/非允许外连 0 | `frontend/report.md` 及 `browser/chrome-results.json`、`webkit-results.json`；1440×900，真实 pointer/filechooser、合成 API；不是真实后端/供应商/全站多尺寸视觉 |
| 前端生产构建 | 外部 scratch Vite 构建 exit 0，PDF worker 落在 scratch | `integration/frontend-build.log`、`build-scratch/`；清 env、无 install/prebuild；保留大 chunk 和 Browserslist 警告，不是生产运行 E2E；未写正常 frontend/build |

### 合跑失败保留与跳过说明

- 后端第一次合跑 **84 failed / 1369 passed / 23 skipped**，见 `integration/backend-first.log`、`backend-first-junit.xml`、`backend-first-run_metadata.json`。其中 76 项为本地无 lxml 导出 CR/CRLF 归一化的真实保真问题，4 项为 XBK 旧夹具未适配更早的 schema/父实体校验，4 项为沙箱新 fixture 依赖外部默认配置。分别修复局部保存适配与自包含测试夹具，未放宽生产校验或精确保留断言，最终原范围重跑通过。
- XBK 维护夹具先保留红测，三文件最终 30 passed；全 XBK 单独维护运行 998 passed / 10 skipped，后续 helper 提取与最终版本以本节整合/PG结果为准，不能拿旧子集数字替代最终加载源码。
- 最终 23 skipped：11 个测评并发、8 个 XBK 并发及 1 个画像数据库保护用例要求显式专用 DB，已在最终 PG 运行实际覆盖；另 2 个 XBK 隔离 HTTP 用例缺显式分配 app，1 个历史 XLS 用例缺 xlrd，**这 3 项仍未执行**。没有联网安装依赖来隐藏跳过。
- 警告主要来自已有 Pydantic/Starlette/SQLite datetime/utcnow 弃用。未用过滤警告、排除失败测试或放宽治理 baseline 来刷绿。

### 工程门禁与保留债务

- Python governance 最终 **7 errors / 11 warnings**，仍为失败。`integration/python-governance-final.log` 和 `governance-final-batch-comparison.json` 对照本批真实 before：logout 21→21、delete_data 19→19、parse_import_file 24→24、prepare_import 27→26、start_session 16→16、teacher distribution 17→17，assessment 服务行数 1403→1403。它们在本批开始时已超治理 ceiling；本批中途增长经 helper 提取消除，**不因此声称工程门禁通过**。
- 前端工程通过不替代全站视觉，scratch 构建不替代生产部署。AUTH-02/03 正式整合与真实代理/迁移、AUTH-01 双存储并发故障、全角色认证 E2E、AI 长事务/真实 SSE/供应商、PythonLab 原子 claim 与资源归属、OPS-01 debug 网络/DAP、重型模块生产运行、依赖扫描及备份恢复仍未验收。
- XBK 自然键更名策略、凭据变更撤销、批量选择/删除目标和真实名册恢复仍待用户规则；父实体并发删除、合法同 key 并发计数、大文件导出性能/Excel 实际打开保留。跨 agent 全历史只读入口未实现。

### 资源与完整性收尾

- 所有 agent 释放写权后才运行最终后端；前端源码由最终全量测试前快照核对。首次完整性审查发现 PG 间接加载的 2 个导出模块晚于该次测试发生 helper 调整；保留 `integration/integrity-first-failure.json` 与 `postgres/pre-integrity-final-*`，重新分配独立 PG 后以最终源码再次运行 62 passed。最终后端 1747、PG 262 个加载模块及前端 542 文件 SHA 均与工作区一致，不以历史 report 的“final”名称代替验证。
- 专用 PG 和 --rm runner 已经精确 ID、label、network none、无映射端口核验后清理；`postgres/cleanup-final.json` 及二次补验的 `postgres/integrity-rerun-cleanup.json` 记录 label 范围剩余 0。迁移两个唯一 schema 均由各自 finally 清理。正常服务与数据库未触碰。
- 浏览器 agent 自有 Vite/runner/context 已关闭，外部 scratch 与日志作为可复核证据保留。Login 与 HEAD、既有改动保护另见 `integration/final-integrity.json`；本批 diff 相对 `before/` 生成，不将整个 dirty 归为本批成果。
- 本批相对捕获基线修改 34 文件，新增 9 个已知源码/测试文件；1147 个基线文件无缺失、Login 字节不变、HEAD 不变，`git diff --check` 通过。新增文件另做 no-index 空白检查。
- Markdown 最终派生摘要为 **109 files / 337 links / 0 missing**；同步后合同测试 **10 passed / 0 failed**。首轮摘要过期、合同 9 passed / 1 failed 记录在 `integration/docs-before-summary.log` 和 `markdown-tests-before-summary.log`；最终见 `docs-final.log`、`markdown-tests-final.log`。原归档断链没有复发。

## 2026-09-08 下一验证批次（当前工作区，未发布）

本节优先于下方同日历史批次。HEAD 仍为 `d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加既有 dirty 修改；证据根 `/Users/wsh/.codex/artifacts/wangsh-next-validation-20260908/`。本次修复 BIZ-01 与 FE-03 服务端事务竞态，其余验证不自动关闭条目。无正常 PG/Redis、真实名册或供应商访问，无迁移/部署/提交/推送。

| 专项 | 本次实际结果 | 证据及限制 |
|---|---|---|
| BIZ-01 内容权限 | 同一维护测试：红 30 failed / 11 passed → 绿 41 passed；加进度回归 43 passed | `content/report.md`、各阶段日志/metadata；真实 JWT/router/service/SQLite ORM，个人内容排除、公共与管理对照；不是生产认证 E2E |
| PostgreSQL 测评 | 原外部固定调度套件红 3 failed / 11 passed → 绿 14 passed；维护最终 19 passed / 8 warnings，无跳过 | `postgres/baseline.log`、`baseline-observations.json`、`green.log`、`maintained.log`、`final.log`、`junit.xml`、`metadata.json`；专用 PG16、独立 schema、真实锁等待；含 11 项新用例和 8 项既有画像测试 |
| 后端集成 | 292 passed / 12 skipped / 41 warnings | `integration/backend-final.log`、`junit.xml`、`run_metadata.json`；测评目录、退出撤销、内容权限和学习进度；无网络 SQLite/替身合跑。12 项 PG 用例在这里安全跳过，随后/此前的专用 PG 运行才提供实际证据；警告为 Pydantic 和 utcnow 弃用 |
| FE-03 Chrome / WebKit | 各 14/14，最终 28 passed / 0 failed；保留 1 次首轮 WebKit timeout 夹具失败 | `browser/REPORT.md、`results.json`、请求时序、trace、DOM 与截图；当前组件/真实弹窗/service/Axios，合成 API，无正常应用外壳/认证 |
| XBK 关联/校验/导出 | 253 passed（163 既有 + 90 新诊断） | `xbk/report.md`、`results.json`、`runner/final.log`；含反例断言通过，不是问题修复。01/02/04/05 限定复现未修，03 仅受控串行重入而非 PG 双事务 |
| PythonLab OPS-01 | plain/debug 主解释器 hook 均拒绝；独立子解释器 plain ENETUNREACH，internal-network debug 克隆合成 HTTP 200 | `sandbox/report.md`、`results.json`；真实 debugpy/DAP，但未发布 DAP、未探测生产/宿主/公网，整体安全状态 UNKNOWN；不是安全 PASS |

### 测评事务红绿与失败记录

原 PG 红证据：保存先读后交卷出现答案 5 分、总分 0；交卷先读后答案提交仍成功；重复整卷均返回成功。增加同会话 `FOR UPDATE` 后在原样调度套件转绿，保留基线/绿灯加载源码 SHA。维护测试进一步要求实际 `pg_stat_activity` 锁等待，并补事务回滚重试、不同会话不互锁、预加载会话状态刷新。以取得锁的顺序串行，不承诺 HTTP 到达顺序，也不新增响应丢失幂等恢复。

PG 镜像缺 pytest/py 的前置失败已保留，仅外部挂载现有纯 Python 测试依赖；没有安装或重建镜像。维护夹具首次参数替换错误造成 4 failed / 13 passed / 2 errors，记录在 `maintained-first.log`；改为绑定参数并确保释放后等待任务结束，再得到维护绿灯。夹具错误不是新的业务缺陷，也未删除失败证据。

独立审阅提醒预加载答案边界后，补充真实 PG 用例：保留旧 `AssessmentAnswer` 的同一 ORM session 可绕过重复拒绝（`preloaded-red.log`：1 failed / 18 passed）。单题查询也增加 `populate_existing` 刷新；最终 `final.log` 为 19 passed，包含预加载答案拒绝覆盖及预加载整卷计分对照。该情形限定于预加载对象，未声称正常路由每次都会触发。服务异常本身不释放锁，必须由调用者 rollback 或退出 DB 会话。

### 本批清理与工程门禁

- PG runner 自动删除；专用 PG 容器经 ID、label、network none 核验后定点删除，label 范围剩余 0。夹具首轮错误遗留的 2 个合成 schema 随唯一 tmpfs 数据容器一并移除；没有操作正常库。证据 `postgres/cleanup.json`。
- PythonLab 本批 6 个容器、2 个 internal 网络已按 manifest 清理，剩余 0；浏览器两轮自有服务、canary、contexts 和浏览器关闭，端口无监听、无自有 runner 残留，外部证据保留。
- 本批未修改前端，因此未重复全量前端门禁；浏览器加载的 27 个前端文件 SHA 无漂移。前批前端工程数字只作为历史结果。
- 首次文档门禁因新增 1 条合法链接触发摘要过期（期望 109 files / 331 links / 0 missing），不是旧归档断链复发；首次 Markdown 合同为 9 passed / 1 failed，失败日志保留。同步派生摘要后重新执行。
- 最终 Markdown 链接合同 `109 files / 331 links / 0 missing`，合同测试 `10 passed / 0 failed`，`git diff --check` 通过；新增 PG 维护测试 Ruff 检查通过。变更边界共 3 业务源、2 新测试、7 文档；107 份捕获基线中 98 份字节未变，9 份为本批预期修改。另一个原先 clean 的学习 owner 以 HEAD 对照，未冒称有修改前字节备份。最终后端两组加载源码 SHA 与工作区一致，详见 `integration/final-integrity.json`。

### 浏览器覆盖与边界

Chrome channel 与 WebKit 均用原生 pointer 操作，覆盖保存/交卷互斥、旧确认回调复验、跨题草稿、失败显式重试、交卷成功后读取失败不重复提交和四档桌面基础操作。旧确认的焦点顺序故障注入单独标注，不冒充默认浏览器事件顺序。真实 service 的 120 秒 timeout：Chrome 120243 ms，WebKit 120064 ms；WebKit 首轮 route-paused 夹具不产生预期 timeout，改为自有 loopback HTTP 读取请求后不回复，原场景复核通过。不是全站四档视觉或真实后端 E2E。

### 尚未完成

- PG 覆盖固定选择题的确定性交错；AI 填空/自适应/简答的长事务、供应商故障、请求取消、并发起测及压力不在本批验收内。
- XBK 更名策略、真实双事务 upsert、完整导出字段矩阵/Excel 打开和真实名册仍待处理；本批未改 XBK。
- PythonLab 仅安全限制下克隆对照；活跃真实 sandbox、原 debug 网络/发布端口、宿主防火墙和生产外层隔离未知。
- AUTH-02/03 外部候选未集成；AUTH-01 Redis/PG 双存储及完整认证链路、全站 E2E 均不因此完成。

## 2026-09-08 优先缺陷并行修复（本地限定修复，未发布）

本节是本日后续实际修复结果，优先于下方“只验证、未修复”的历史快照。基线为 `d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加已有 dirty 改动。三个 agent 分别修改 BIZ-02、BIZ-03、FE-03 的业务文件并新增隔离测试；主任务合跑并同步文档。AUTH-03 独立 agent 只写外部候选，未应用正常源码。

### 当前行为与专项红绿

| 范围 | 前测 / 修复后 | 本批结论与证据边界 |
|---|---|---|
| BIZ-02 结果可见性 | 6 failed / 12 passed → 18 passed；独立复跑 18 passed | result 仅接受 submitted/graded，进行中返回 422；提交后答案/解析及合法单题反馈保留。真实 router/schema/service/SQLite ORM，身份为合成 override，角色守卫真实；不是完整 JWT/供应商/自适应验收 |
| BIZ-03 个人画像详情 | 10 failed / 46 passed → 56 passed；复跑 56 passed | individual 类型及本人 target_id 双校验；group/class 数字碰撞返回 403，缺失 404，管理端合法读取保留。真实 JWT/角色守卫/router/schema/service/SQLite ORM；不是 PG/网关验收 |
| FE-03 保存与交卷互斥 | 原组件 11 项：9 failed / 2 passed；最终扩展 14 passed | 共享同步锁拒绝保存中交卷；草稿按题保留、失败阻止交卷并要求显式重试；已确认交卷成功后，结果读取失败只重试读取。真实组件和弹窗挂载，合成 API、JSDOM/RTL 事件，不是浏览器 E2E |
| AUTH-03 外部异常降级候选 | 旧复现 5 passed；同组基线 11 failed / 35 passed → 候选 46 passed | **未修复、未应用。**仅捕获 MultipleResultsFound，将无独立有效 Cookie 的歧义 /me 从 500 降为 401；绿色包含残留风险观察断言，不代表安全问题关闭 |

FE-03 没有自动排队交卷；用户须在保存成功后再次显式交卷。原倒计时仅显示时间/00:00，没有自动交卷入口，本轮不改变该规则。保存 timeout 作为失败保留草稿，不自动重试；服务端已写入但响应丢失的歧义、跨标签页/刷新退出后的恢复和服务端幂等仍未解决。

AUTH-03 候选不恢复碰撞账号，refresh 仍可能换发同样歧义的 subject；原身份停用/删除/改名后，唯一跨字段匹配可能重绑定到另一用户，在 service/optional 依赖的合成测试中已观察到。强制 /me 的 nonce 拒绝不能替代所有认证入口的结论，不据此断言生产可利用。不可变 ID claim、legacy token/full_name 兼容期限、异常身份拒绝规则及所有验证入口一致性须先确认，不能擅自迁移身份合同。

### 主任务集成复验

| 门禁 | 最终结果 | 范围与日志 |
|---|---|---|
| 后端测评目录 + 退出撤销隔离回归 | **249 passed / 1 skipped / 8 warnings** | `integration/backend-final.log`、`junit.xml`、`run_metadata.json`；跳过为缺少专用 PG 的班级画像隔离测试，不算通过 |
| 前端默认 Vitest | **84 files / 522 passed** | `integration/frontend-all.log`，21:51:02 开始；禁网络预加载，未按专项数字重复累加 |
| TypeScript | 通过 | `integration/type-check.log` |
| CSS token CI | 通过 | `integration/token.log` |
| 本批组件及新增测试 ESLint | **0 errors / 6 warnings** | `integration/lint-targeted.log`；组件 any 类型警告保留，非全站 lint |

证据根目录：`/Users/wsh/.codex/artifacts/wangsh-priority-fixes-20260908/`。每项子目录保留 report、results、红绿日志及源码指纹；本批基线/逐文件备份为 `baseline.json` 与 `before/`。集成入口为该目录下 `integration/run_isolated.py`，使用 `/Library/Frameworks/Python.framework/Versions/3.13/bin/python3` 和外部 `/tmp/wangsh-audit-accuracy-20260908/deps`，清空环境、合成哨兵 PG/Redis 配置、禁 dotenv/socket、禁插件自动加载及 `--noconftest`。前端使用上一批外部 `no-network.cjs` 禁连接/global fetch；不将其表述为 dotenv 严格守卫。

主任务执行命令（均在本地，前端命令于 frontend 目录）：

```bash
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 /Users/wsh/.codex/artifacts/wangsh-priority-fixes-20260908/integration/run_isolated.py
NODE_OPTIONS='--require=/Users/wsh/.codex/artifacts/wangsh-parallel-verify-20260908/no-network.cjs' npm run test -- --maxWorkers=4
npm run type-check
npm run token:check:ci
./node_modules/.bin/eslint src/pages/AIAgents/AssessmentPanel.tsx src/pages/AIAgents/AssessmentPanel.submission.test.tsx
```

### 文档收尾门禁

本批新增引用后首次 checker 仅报告当前派生摘要过期（无缺失目标），合同测试为 9 passed / 1 failed；保留 `integration/markdown-first.log` 与 `markdown-tests-first.log`。同步摘要后 checker 通过、Markdown 合同测试 10 passed、`git diff --check` 通过；最终日志及退出码见 `integration/final-gates.json`。旧归档断链不是本次失败原因。

完整性核对见 `integration/final-integrity.json` 和相对本批备份的 `integration/this-batch.diff`：仅三份业务源码、三份新增测试及六份共享文档变化；基线内其他文件（含 XBK、Login 与正常 auth.py）逐字保持，HEAD 不变。后端最终运行时源码指纹与当前文件一致。新增未跟踪测试另做 no-index 空白检查，无诊断；其返回 1 表示存在差异，不按普通门禁失败解释。

### 失败保留与未覆盖

- 首次后端合跑发生在 BIZ-03 尚为红态时：10 failed / 239 passed / 1 skipped；均是新增碰撞用例，保留 `backend-first.log`、`backend-first-junit.xml`、`backend-first-metadata.json`，不冒充最终失败或隐去。
- FE 初版新测试类型错误、红态 act warnings 和 AUTH-03 前置守卫失败均保留；最终 FE 专项无 act warnings。全量 Vitest 的 Browserslist 过期提示保留，未更新依赖。
- BIZ-03 初次 runner 收尾校验错误保留。AUTH-03 记录两份文档并发变化，但受检后端源码未漂移；候选不修改正常 auth.py。
- **未完成**修复后真实 Chrome/WebKit E2E、PG 答题/交卷事务并发、真实 Redis/代理/JWT 全链路、供应商调用、全站 lint、生产 build、全站视觉、迁移备份恢复与远端验收。AUTH-02 仍是未集成候选，其他 XBK/OPS/FE 条目不随本批测试通过关闭。
- 本批不操作正常 PG/Redis、名册、迁移、正常服务重启、提交、推送或部署。全项目最终验收仍未完成。

## 2026-09-08 并行反证验证接续（历史验证批次，未实施全项目修复）

本节优先于同日更早的失败快照。旧任务因模型服务接口 403 中断，本地证据保留；新任务接收既有验证产物，分区补齐报告，不重复启动同一批完整测试。基线为 `main@d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加已有未提交改动，不能当作干净 main 或生产发布版本。

### 接续门禁与服务状态

| 项目 | 结果 | 时间与边界 |
|---|---|---|
| Markdown checker | 通过，无缺失目标 | 20:23 接续重跑；文档收尾同步派生摘要后复核通过；归档恢复早于本轮 |
| Markdown 合同测试 | 10 passed | 20:23 接续重跑；文档收尾同步派生摘要后再次通过 |
| TypeScript、CSS token、`git diff --check` | 通过 | 20:23 接续重跑；文档编辑后另复核 |
| 前端默认 Vitest | 83 files / 508 passed | 接收 20:13 既有日志，禁网络预加载；未在本次接续重复全量执行 |
| 前端脚本测试 | 29 passed | 接收 20:12 既有日志，不算本轮新跑 |
| AUTH 隔离专项 | 37 passed（32 + 5） | 接收既有日志及真实源文件指纹；其中 AUTH-03 通过是在复现缺陷，不代表修复或 Redis/PG 集成验收 |
| BIZ-04 开放时间窗 | 50 passed | 接收既有 pytest 日志，本次接续未重跑 |
| BIZ 业务探针 | 26/26 条断言通过 | 实际 assessment router/schema/service/ORM 配 SQLite 合成数据；不是 26 个 pytest 用例，不与其他计数混算 |
| FE 定向反例与正常对照 | 23 passed | 接收 20:14 外部 Vitest 日志；含证明缺陷存在的断言，不能解读为修复完成 |
| XBK 隔离专项 | 163 passed | 接收既有日志；缺少运行时源码 SHA 链，当前指纹不证明当时精确同版；不代表真实名册、PG 并发或 Excel 打开验收 |
| OPS 定向反例与正常对照 | 25 passed | 本次接续补跑；模拟 Docker I/O、Celery eager、合成 schema，不执行沙箱或迁移 |
| 本地服务只读检查 | 前端 200；后端健康 GET 200，DB/Redis healthy | 2026-09-08 20:24；health 的 HEAD 返回 405 是方法不支持，不当作服务故障 |

日志根目录：`/Users/wsh/.codex/artifacts/wangsh-parallel-verify-20260908/`；接续门禁、健康记录、源码基线及补跑在 `resume/`。数目有跨批次和用例重叠，不累加成全项目独立测试总量。

文档收尾复核：20:45 首次检查发现新增引用后的派生链接摘要仍为旧数，导致 checker 与一项合同测试失败（无断链）；保留 `resume/pre-summary-sync-*` 日志并同步当前派生摘要。这是本轮文档同步问题，不是三条旧归档断链复发。修正后最终门禁记录见 `resume/final-gates.json`。

### 隔离、证据局限与最终校准

- 20:07 原始 dirty 文件指纹在接续时全部匹配；保留所有现有 XBK、登录页及其他任务改动。接续基线见 `resume/baseline.json`。
- OPS 原夹具漏读 `ast.AnnAssign` 形式的 revision/down_revision，导致基线祖先断言失败；只在 `resume/ops/verify_ops.py` 副本补齐读取并检查完整根 revision，原失败日志保留。它是探针缺陷，不是应用迁移故障。
- OPS 补跑所读取源码指纹全部匹配，结果及限制见 `resume/ops/results.json`、`integrity.json`、`report.md`。启动参数不能证明公网可达；eager 不等于真实 worker 调度；合成 schema 不等于完整迁移。
- AUTH/BIZ、FE/XBK 最终分区报告与 OPS 独立侧审已收齐，见 `resume/auth-biz/report.md`、`resume/fe-xbk/report.md`、`resume/ops-review.md`；条目级状态已同步[问题台账](../plans/2026-09-08-project-audit-findings.md)。两个接续分区新增执行用例均为 0，恢复旧结果并核对当前源码，不冒充重跑。
- AUTH-03 已有真实 JWT/更新路由/SQLite ORM/ASGI 的 HTTP 500 与恢复、拒绝对照；BIZ-02、FE-03 和条件性 BIZ-03 仍未修。AUTH-01、BIZ-04、FE-04 保持已有本地限定修复，AUTH-02 外部候选未应用；BIZ-01/05 保留待复核。
- FE-01 为抽取 handler 乱序对照；FE-05 为真实 React 事件局部复现，失败点是 await 后文件输入重置，不等于后端导入失败。均非完整应用 E2E；FE 的 23 项中不含 FE-02 专项。
- XBK-06 摘要仍无代次保护，列表 loadData 已有保护不能关闭该条；XBK-07 仅当前年级分支已修，无选课虚拟行仍漏导。XBK-01～05 当前源码缺口仍在，历史 HTTP/并发/公式探针未在本次接续重跑。
- 独立侧审收紧 OPS：模式切换用例未注入旧配置，仅能验证 running 替身复用分支；Celery 为 eager，不是 worker；迁移接受对照使用不完整 schema，只能确认 evaluator 分支，索引级误报不证明整库可迁移。debug 仅 argv 证据，不证明网络可达。
- 本轮不应用 AUTH-02 外部候选、不修改业务源代码、不连接正常业务数据库做测试、不操作名册、不迁移、不重启、不部署、不提交或推送。只有本地健康端点只读 GET；后端全量、真实代理与 Redis、PG 并发、浏览器全链路、视觉和发布验收仍未完成。


## 2026-09-08 Markdown 归档合同治理

- 从 Git 历史备份提交恢复三份有唯一追溯价值的 2026-08 UI／综合诊断正文，没有伪造报告内容；新增 `archived` 生命周期元数据，并明确这些快照不代表当前代码或运行状态。
- 更新归档唯一索引并修正恢复正文中的仓库内相对链接。下方较早批次记录的三条断链和失败数字保留为当时的历史证据，不回写成“当时已通过”。
- 当前 Markdown 派生摘要：`109 files / 331 links / 0 missing`；Markdown 合同测试 `10 passed`，`git diff --check` 通过。

## 2026-09-08 AUTH-02 TTL 与代理边界补验（隔离候选，未切换）

继续上一轮候选验收，仅新增外部测试并核对源码，不修改候选实现、正常后端或原交付包。补验包：`/Users/wsh/.codex/artifacts/wangsh-auth02-boundaries-20260908/`；临时目录 `/tmp/wangsh-auth02-boundaries-20260908/`。沿用下节 SQLite 依赖版本，实际版本和 SOURCE_PROVENANCE 见日志。

- 新增确定性边界用例 **23 passed / 8 warnings**（`evidence/boundaries-first.log`）；与原 SQLite 专项同进程合跑为 **105 passed / 4 deselected / 8 warnings**（`evidence/combined-final.log`）。后者已包含前者，不累加。4 个 PG 用例本轮未运行，上一轮专用 PG 结果仍是历史证据，不冒充重跑；没有创建容器或连接业务 PG/Redis。
- runner 导入前合成配置、禁止 socket；两次 `OUTBOUND_CONNECTIONS_BLOCKED=[]`。显式设置 pytest pythonpath 指向候选 backend 和 auth fixture，避免加载正常热重载源码。候选测试时仅冻结持久 session 时钟，JWT/refresh 到期墙钟未冻结；这是 SQLite/内部 ASGI 逻辑验收，不证明实际系统时钟漂移、Redis TTL、生产网关或 PG 并发。
- TTL 精确验证：负/零值跟随配置 refresh 天数，正值按秒；普通 `/me` 不续期；期限前 1 微秒可用、等于/超过期限均拒绝 access 与 refresh；refresh 延长期限但继承 epoch，旧 refresh 重放被拒且状态不变；提交故障同时回滚期限及 token 轮换。**测试符合候选合同不代表用户已批准 TTL 行为变更。**
- **代理风险现状，不是安全通过**：关闭信任时 X-Forwarded-For、X-Real-IP、Forwarded、Remote-Addr 均忽略并使用 peer；开启时校验 IP 语法/规范化，但未检查 peer allowlist。同一合成 ASGI peer 用不同头 IP 登录，在开启信任时旧账号仍有效，关闭时旧账号被替换。含 characterization 名称的通过仅确认此现状；不能据此宣称生产可伪造，仍需确认真实入口、头清洗、可信代理与后端直达隔离。
- refresh 从不同头 IP 发起仍返回成功并轮换 token，持久 epoch/IP 不被改写；每请求 IP 检查开启时新 access 在变更 IP 被拒、原 IP 可用，关闭时变更 IP 也可用。该开关不能解释为 refresh 路由本身拒绝异 IP；此行为合同留待确认，没有擅改策略。
- 只读源码核对 `gateway/Caddyfile`、`gateway/Caddyfile.dev`、两个 compose：gateway 声明 reverse_proxy；开发 compose 声明 `8000:8000`。没有运行网关请求或推断 Caddy 默认头清洗/防火墙/生产可达性，源码摘录及 SHA 见 `evidence/proxy-source-check.json`。
- 补验检查 **366 个候选文件**符合原始 baseline 加候选 manifest；原包和补丁未变。26 个候选路径中，正常 API 文档仍是唯一偏离 base 的路径（并行 XBK 合同，已保留）；其余 25 个匹配。XBK 父迁移与打包前置文件指纹一致，HEAD 未变；仅为当前快照，不等于未来可直接应用。见 `evidence/integrity-final.json`（19:53 快照）。随后收尾发现正常 `docs/docker/RELEASE_NOTES.md` 也新增 XBK 导出合同，原样保留；交付复核为 API 与发布记录 2 个候选路径偏离 base，不能将先前 25 个匹配当作最终状态。当前快照及增量见 `evidence/closing-check.json`、`parallel-drift.diff`。
- 本轮实际门禁：Markdown checker 未通过，仍报告 archive README 的 3 个既有缺失目标及派生摘要合同；Markdown 合同测试 **9 passed / 1 failed**，`git diff --check` 通过。未报告新增缺失链接，未改 checker 或造归档文件刷绿。日志为本补验包 `evidence/markdown-contracts-final.log`、`markdown-tests-final.log`、`workspace-diff-check-final.log`；本节专项通过不等于全部门禁通过。未修改前端/登录页，不执行前端门禁，不迁移/部署/提交/推送，不将正常工作区已有改动归入本批。

## 2026-09-08 AUTH-02 隔离候选实施与收尾（正常服务未应用）

本批在外部副本实现持久 epoch、refresh 发行代次、版本化 IP binding、事务锁序与 HTTP/optional/SSE/WS 准入。**下列结果只验收隔离候选，不表示当前正常服务已修复。** 正常 backend 为 bind mount + uvicorn reload，因此没有应用候选源码或迁移业务库。当前状态见[原计划](../plans/2026-09-08-project-comprehensive-audit-plan.md)与[AUTH-02 台账](../plans/2026-09-08-project-audit-findings.md)。

### 证据、版本与隔离边界

- 持久包：`/Users/wsh/.codex/artifacts/wangsh-auth02-20260908/`，临时实施目录 `/tmp/wangsh-auth02-implementation-20260908/`。交付含本轮 dirty base/candidate 增量、SHA manifest、候选 owner 合同及必要日志；不是从 git HEAD 混合打出的全部工作区差异。HEAD `d8c3da3344cde9a23d58952c247c50a3f90e0e8f`。打包时 26 个候选变更路径均与正常工作区基线匹配，原启动记录内 356 个文件指纹无漂移；但 19:44 收尾复核发现正常 `docs/development/API.md` 新增一条 XBK 导出合同，已保留，未归入本批。其余 25 个候选路径仍匹配 base；持久包 base/candidate 与补丁指纹全部未变。打包时 manifest 是历史快照，应用前须重新合并核对 API 文档，不能声称当前全部路径仍匹配；见 `evidence/delivery-integrity-check.json` 与 `evidence/parallel-api-drift.diff`。
- 宿主 SQLite/接口：Python **3.13.1**、aiosqlite **0.22.1**、pytest **9.0.2**、SQLAlchemy **2.0.46**、FastAPI **0.128.0**、PyJWT **2.9.0**、httpx **0.28.1**。复用此前 scratch 依赖，没有安装/更新依赖。runner 在导入前设置合成配置并禁止所有 socket 外连；最终 `OUTBOUND_CONNECTIONS_BLOCKED=[]`。内部 ASGI 请求不是正常 8000，也不包含完整 app lifespan/middleware。
- 真实 PG：专用 `postgres:16-alpine` 本地镜像，实测 **PostgreSQL 16.14**；`network none`、无发布端口、数据 tmpfs。测试 runner 使用本地 `wangsh-backend:latest` 内的 Python **3.11.16**、SQLAlchemy **2.0.46**、Alembic **1.18.3**、asyncpg **0.31.0**，共享该唯一测试网络 namespace，挂载只读候选，不启动业务 app；socket 仅允许且只观察到 `127.0.0.1:5432`。专用库名 `auth02_epoch_test_f2bf35f10f0b4f3f99b2bcd74260ce45`，不连接正常 PG/Redis。

### 最终专项结果

| 范围 | 实际结果 | 日志与限制 |
|---|---|---|
| SQLite/真实 auth router 与 unit 扩展 | **82 passed，4 deselected，8 warnings** | `evidence/final-selected-expanded.log`；AUTH-02 27 项、退出 45 项、登录 5 项、refresh 发行 nonce 2 项、rotation unit 3 项。排除的 4 个旧 PG 用例另在专用 PG runner 运行，不在业务库运行；警告为既有依赖弃用 |
| PostgreSQL 新增专项与旧集成 fixture | **15 tests，OK** | `evidence/postgres-final-expanded.log`；新增 10 项及旧集成 5 项。覆盖 pg_stat_activity 观察真实锁等待、同 IP 双登录/相反 IP、refresh 单消费者、login/refresh/logout 锁后重验、token 行锁超时完整回滚、单次 migration 与 WS 准入 |
| Alembic 完整 revision 图与限定离线 SQL | **通过：43 个 revision，单 head `20260908_0002_auth_epoch`** | `evidence/migration-check.log`；从 XBK parent 到本次 revision 的 offline SQL，禁止网络。真实 PG migration 用的是合成最小旧表，不是完整目标业务库 upgrade/recovery 演练 |
| 增量补丁外部重放、指纹与 Python AST | **通过** | `evidence/patch-replay-check.json`；只对外部重建 base 执行 apply/check 与 replay，全部候选 SHA 匹配。no-index diff check 无空白诊断（返回 1 为存在差异），非全项目代码检查 |
| 专用测试资源清理 | **通过** | `evidence/pg-cleanup.json`；核对 id/任务 label 后只删除 `wangsh-auth02-pg-f2bf35f1`，确认不存在，tmpfs 数据随之删除 |
| 正常服务只读健康 | **6608 HTTP 200；8000/health HTTP 200，database/redis healthy** | `evidence/health-final.json`，**2026-09-08 19:36:34 +08:00**；仅 GET，无认证/业务写入。runtime snapshot 显示正常容器运行，启动时间仍为 2026-09-08 00:34:12 UTC（08:34:12 +08），restart_count=0；不把容器计数当 worker 从未热重载的证明 |

### 前测、合同变动与未覆盖

- 保留 `evidence/red.log`：实现前专项 **9 failed / 1 passed**；日志 SOURCE 指向 candidate，但当时候选源码与复制 base 相同。AUTH02_SOURCE 单独覆盖会被 pytest pythonpath 抢先，重跑前测须显式指定基线 pythonpath 并核对源码指纹，不把路径标签当红灯证据。
- 初期旧 logout mock/缓存合同和 PG WS fixture 有失败，日志保留；修复为显式 db/发行 epoch、完整 WebSocket 构造以及新的原子 DB 合同。旧 PG fixture 新增有效 epoch/deadline 后在专用 runner 真跑，不仅修改断言。最终只引用上表，不把历次运行累加成覆盖率。
- **需单独验收**：TTL 改为成功 refresh 时续期（正配置为空闲上限，非正按 refresh lifetime），不同于旧缓存 `max(access, student TTL)`；NULL legacy/缺 epoch 凭据须重新登录。DB commit 成功时 cache 故障不再保留旧 access，commit 失败则 refresh 与 epoch 一起回滚；退出保留原 200/Cookie 清理合同，不承诺服务端撤销一定成功。
- 已验证锁超时（测试设置）回滚，但候选没有新增自动死锁重试或生产锁超时配置。未完成真实 Redis 故障/TTL/多 worker、代理可信链、负载与重复 DB 查询成本、全后端/跨模块旧 nonce fixture、真实 PythonLab 浏览器/沙箱/长连接撤销、前端退出重登竞态、完整迁移切换与备份恢复验收。
- WS/SSE 只验证新连接准入，不主动断开已建立连接。AUTH-03 subject 与 AUTH-04 凭据生命周期不随候选宣称解决。候选 migration 依赖并行 XBK revision，切换前须重新审核 parent/head，禁止混跑新旧 reader/writer 或裸 downgrade。
- 无前端改动及门禁；未修改登录页、未重启正常服务、未提交/推送/发布镜像/部署。本轮实际执行文档门禁：`node scripts/check-markdown-contracts.mjs` 未通过，仍为 archive README 的 3 个既有缺失目标及派生摘要合同；`node --test scripts/markdown-contracts.test.mjs` 为 **9 passed / 1 failed**；`git diff --check` 通过。本轮检查未报告新增缺失链接，不改 checker 或造归档文件刷绿。日志位于持久包 `evidence/markdown-contracts-final.log`、`evidence/markdown-tests-final.log`、`evidence/workspace-diff-check-final.log`；候选专项通过不等于全部门禁通过。

## 2026-09-08 AUTH-02 设计补验（未修复）

> 以下为先前设计阶段的历史快照；本轮隔离候选结果见上节，正常服务仍未切换。

接续旧任务的 AUTH-02 设计检查点。本批没有修改业务代码、维护测试、依赖或 schema；设计仅落入[原计划](../plans/2026-09-08-project-comprehensive-audit-plan.md)，问题保持[原台账](../plans/2026-09-08-project-audit-findings.md)的条件性确认/未修复状态。**下列 characterization 的通过表示当前缺陷与反证可重复，不是修复验收通过。**

### 实际环境与证据边界

- 证据：`/tmp/wangsh-auth02-resume-20260908/`；新基线与旧 `/tmp/wangsh-auth02-design-20260908-182415/` 启动基线分开保留，不覆盖旧记录。
- 宿主 Python **3.13.1**、aiosqlite **0.22.1**、pytest **9.0.2**、SQLAlchemy **2.0.46**、FastAPI **0.128.0**、PyJWT **2.9.0**、httpx **0.28.1**；未安装/变更依赖。复用已维护 logout fixture 的真实 router/JWT/ORM，仅合成 SQLite 内存 User/RefreshToken 与内存 cache，FK 开启；测试代码及 runner 只放 scratch。
- runner 在导入 app 前用合成密钥、不可用 DB/Redis 哨兵配置并安装 socket 审计阻断，fixture 另阻断 socket；两次测试日志均 `OUTBOUND_CONNECTIONS_BLOCKED=[]`，无外连尝试。ASGI 内部请求不是正常 8000 HTTP，也不覆盖生产 middleware/lifespan。
- `docker exec` 仅在正常 `wangsh-backend` 容器的独立 Python 进程加载白名单配置，禁止该进程外连；未输出完整环境或凭据，未调用 auth/业务接口。读取结果：`AUTH_USER_UNIQUE_PER_IP=false`、`AUTH_ENFORCE_SAME_IP_PER_REQUEST=false`、`AUTH_TRUST_X_FORWARDED_FOR=true`；header order 为 `X-Forwarded-For,X-Real-IP,Forwarded,Remote-Addr`；session TTL 配置 0、access 60 分钟、student session TTL 7200 秒。此为容器内新进程的配置快照，不等于读取已运行 worker 的内存设置，更不代表生产网关验证。源码默认 unique=true 不得当作当前容器已开启。
- 单 IP 单账号缺陷在本轮**主动开启该开关的隔离合成环境**确认；正常容器配置快照关闭，不推断当前正常环境已经触发。测试显式禁用信任转发头，以文档保留地址指定 ASGI peer；未核验真实代理可信链。

### 本轮实际结果

| 范围 | 结果 | 证据与限制 |
|---|---|---|
| AUTH-02 当前行为专项 | **13 passed / 8 warnings** | `characterization.log`；8 项 unique/enforce/same-IP 矩阵，另有 A→B→A、手动删除 cache、陈旧 IP 绑定、IP 写入 false、guard 受控交错各 1 项；最后一项不是并发 HTTP/PG，cache 手动缺失不代表真实 TTL |
| AUTH-01 维护退出回归复跑 | **45 passed / 8 warnings** | `logout-regression.log`；仅 `test_logout_revocation_isolated.py` 与 `test_auth_logout_refresh.py`，未跑直连 DB 的旧 auth 用例；警告为既有依赖弃用提示 |
| 正常服务只读健康检查 | **6608 HTTP 200；8000/health HTTP 200，database/redis healthy** | `health.json`，2026-09-08 **18:43:04 +08:00**；仅 GET，无认证或业务写入，无重启 |
| `git diff --check` | **通过** | `diff-check.log`；只证明空白格式，不代表全工作区改动归属 |
| Markdown checker | **未通过** | 修改前后仍为 archive README 的 3 个既有缺失目标及派生摘要合同；详见 `markdown-before.log`、`markdown-final.log` |
| Markdown 合同测试 | **9 passed / 1 failed** | `markdown-tests.log`；仓库 Markdown 总合同失败，未改 checker 或补假归档文件 |

### 收尾与未覆盖

- 当前 refresh 及 cache 守卫的发行代次缺口未修复；设计中的持久 epoch、统一锁序、旧格式过渡、迁移/回滚均未实施，不把 scratch 测试登记成受维护回归入口。
- 两次 runner 记录的 auth service/router、session_guard、RefreshToken 模型指纹一致；最终比对见 `workspace-verification.json`。本批只修改原计划、原台账、本页与 ignored 接力；不把 XBK 任务的工作区变化归为本批成果，最终检查仍以基线 hash 逐项记录。
- 未新增监听器、容器或后台服务，不存在本批需要停止的测试资源。已观察到 XBK 专项容器在运行，未停止或复用其数据库；未重启正常栈、连接业务 DB/Redis、提交、推送、部署或迁移。
- 未覆盖真实 PG 事务锁、Redis 多 worker/TTL/故障恢复、实际 HTTP 代理链、前端 token 竞态、全项目回归或四档桌面验收。本轮纯设计/后端隔离验证未运行前端门禁，不宣称全项目验收或文档门禁全绿。

## 2026-09-08 BIZ-04 本地修复：直接起测开放时间窗

本批仅修复 BIZ-04 的**窗外新建会话**缺口，保留合法续答；基线为 `main@d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加已有 dirty worktree。长期合同见 [ASSESSMENT](../../features/ASSESSMENT.md#会话与答题边界)、[API](../../development/API.md)，维护入口见 [后端测试说明](../../../backend/tests/README.md#测评开放时间窗隔离回归)，限定状态与下一批见原 [台账](../plans/2026-09-08-project-audit-findings.md) 和 [计划](../plans/2026-09-08-project-comprehensive-audit-plan.md)。下方 AUTH-01 及其他批次是各自范围的历史结果，不代替本批验证。

### BIZ-04 实际环境与隔离边界

- 宿主 Python **3.13.1**；实际加载 aiosqlite **0.22.1**、pytest **9.0.2**、SQLAlchemy **2.0.46**、FastAPI **0.128.0**、PyJWT **2.9.0**、httpx **0.28.1**。aiosqlite 从 `/tmp/wangsh-audit-accuracy-20260908/deps` 加载，runner 校验版本；未安装、升级或修改本批依赖。
- 真实 FastAPI 学生 router、JWT 签发/验签、角色与 nonce 守卫、业务 service 和 ORM；仅替换 DB session/nonce cache，AI 为调用即报错的哨兵。每例为开启 FK 的 SQLite 内存库，仅含合成 User/AIAgent/AssessmentConfig/Question/Session/Answer；新 DB session 验证已提交状态，SQL 事件记录查题和 session/answer DML，正常起测反证记录器有效。
- 固定业务时钟为 `2032-06-01T04:00:00Z`，并测试 UTC、UTC+08、UTC-05 的等价 aware offset。SQLite 存储 UTC，配置 load/refresh 恢复 aware offset，冻结时钟保留真实 datetime 的类型识别；不更改生产时区合同。此处不证明 PostgreSQL 时间戳转换、DST 或行锁并发。
- runner 在 app 导入前设置合成密钥、不可用的 DB/Redis 哨兵地址并安装 socket audit hook；pytest fixture 另阻断 socket 连接。最终红灯、绿灯和扩展回归均**无外连尝试**；未连接业务 PG/Redis、未调用外部 AI、未启动应用 listener。

### BIZ-04 最终同集合红绿对照与门禁

证据目录：`/tmp/wangsh-biz04-fix-20260908-173029/`。

| 范围 | 实际结果 | 证据与解释 |
|---|---|---|
| 最终维护回归对修复前源码 | **23 failed / 27 passed / 8 warnings** | `regression-red-overlay-final.log`；只读 import overlay 加载本批 `before/` 备份，不替换当前工作区源码 |
| 同一维护回归对当前源码 | **50 passed / 8 warnings** | `regression-green-final.log`；窗口专项使用真实 router/JWT/service/ORM |
| Assessment 扩展回归 | **143 passed / 1 deselected / 8 warnings** | `assessment-expanded-final.log`；包含上述专项，不与其相加；显式排除真实 PG 班级画像隔离用例 |
| Python AST 与内存 compile | **通过** | `python-syntax-final.log`；本批 service/新旧测试及未改 router，无 pycache 写入 |
| `git diff --check` | **通过** | `diff-check-final.log`；空白门禁通过不等于审查了整个 dirty worktree |
| Markdown checker | **失败：3 个既有缺失目标及派生摘要合同** | `markdown-check-before-docs.log` 与 `markdown-check-final.log`；缺失目标集合不变，未伪造目标、零缺失摘要或修改 checker |
| Markdown 合同测试 | **9 passed / 1 failed** | `markdown-tests-final.log`；失败为当前全库 Markdown 审计 |

最终红灯中的失败是同一缺陷的参数化场景，不是新的 bug 数：窗外固定题仍成功创建会话、窗外空题库先报题库错误、自适应题先触发 AI 哨兵。无窗口/窗口内/等于起止等正常场景通过，避免将测试环境异常当产品缺陷。早期 `setup-no-tests.log` 为工作目录错误导致未收集测试，`setup-clock-truncation.log` 为冻结 datetime 影响 SQLite 类型识别导致时分秒截断；两者仅保留排查轨迹，不计入正式红绿结果。后续最终测试在修复前快照和当前源码上重新运行并记录了相同测试文件 SHA256。

pytest 警告均为既有 `app/schemas/agents/ai_agent.py`、`app/schemas/it/game.py` 中 Pydantic class-based Config 弃用；未修改这些模块。最终源码来源：service 修复前 SHA256 `b2b14f0ea7390ef7fd80ccdf96c62bb0db85fea6c729059b2c8a8bd51f1c6260`，修复后 `dc740ca3f311afff91a4242dc4b78e275a6612e2965201163143e53dbd222fa8`；router 保持 `d5c89ed2f6aa795e27b074b9ac4fde4137a64f7e95ce9b66f3795b929f972949`。各最终日志记录模块路径、源码与测试 SHA256，`final-workspace-verification.json` 对照最终工作区指纹。

### BIZ-04 已确认行为与未覆盖项

- 窗口内、无窗口、单边窗口、恰好开始/结束、起止同刻允许起测；开始前与结束后一微秒拒绝。窗前/窗后分别返回 422 和明确文案，先于查题、AI 与 session/answer 写入；成功会话归属、开始时间、总分与 answer 行均查已提交数据库验证。
- 跨截止或配置窗口改到未来后，本人同配置进行中会话仍可恢复，session/开始时间/已答记录不变、不重抽，并可继续提交剩余答案；列表仍隐藏窗外配置。另一用户、另一配置、pending/submitted/graded/archived 历史会话不能绕过新建限制。
- 配置缺失、禁用（包括已有进行中会话）、窗内空题库以及 anonymous/guest 的原有拒绝保留。已有单测仅补齐配置 mock 的 `available_start/end=None`，未弱化原断言。
- **明确未运行** `tests/assessment/test_assessment_profile.py::test_generate_class_profile_isolates_students_by_class`：没有获准的专用 PostgreSQL；使用 `--deselect`，不是通过或自动安全 skip。真实 PG 时区/并发/事务调度、Redis、生产中间件与实际应用 HTTP 入口未验；未跑全后端、前端或四档视觉验收。未新增进行中唯一约束，`FOR UPDATE SKIP LOCKED` 仍不是严格幂等保证。
- Markdown 既有缺失目标仍在 `docs/docker/archive/README.md`：`2026-08-10-ui-branch-layout-review.md`、`2026-08-10-ui-branch-visual-review.md`、`2026-08-06-multi-agent-diagnosis-report.md`。本批前后缺失集合一致；派生摘要要求与实际缺失冲突，不能写虚假的全绿统计。独立文档治理待办不阻断本批已执行的限定功能回归，也不等于全部门禁通过。
- 工作区 HEAD/分支与本批 baseline 一致，测试过的 service/router/测试文件指纹匹配；范围外 XBK 源码与测试仍有漂移，详见 `final-workspace-verification.json`，因此不能声称全工作区静止或将其归入本批成果。文档写入前与本批原始备份逐个核对，无并行文档漂移；本批差异单独保存为 `this-batch-only.diff`。
- 没有改前端、认证、XBK、schema、锁文件或依赖，没有业务数据读写、迁移、提交、推送、部署或镜像发布。仅运行已结束的本地隔离测试和静态门禁，未启动/重启服务。下一批依原计划先设计 AUTH-02 的会话代次/跨用户锁序；AUTH-01 与 BIZ-04 的真实基础设施验收须独立专用环境。

## 最新补充：AUTH-01 退出 refresh 撤销修复（2026-09-08）

本批仅实施 AUTH-01 的限定本地修复：有效 refresh Cookie fallback、用户锁后重验，以及 nonce 轮换失败仍尝试提交 refresh 撤销。基线为 `main@d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加已有 dirty worktree；未提交、推送、部署或发布镜像。
长期机制见 [AUTH](../../features/AUTH.md#服务端退出与撤销边界)，输入/响应见 [API](../../development/API.md)，限定状态及下一批见 [台账](../plans/2026-09-08-project-audit-findings.md) 与 [计划](../plans/2026-09-08-project-comprehensive-audit-plan.md)。下方旧批次均为历史结果，不代替本批验证。

### AUTH-01 实际环境与安全边界

- 宿主 Python **3.13.1**；最终回归实际加载 `aiosqlite 0.22.1`、pytest 9.0.2、SQLAlchemy 2.0.46、FastAPI 0.128.0、PyJWT 2.9.0、httpx 0.28.1。`aiosqlite` 从 `/tmp/wangsh-audit-accuracy-20260908/deps` 加载，运行器校验版本与来源；声明同步到 `backend/requirements-dev.txt`。没有安装或升级生产依赖，也没有改锁文件。
- 真 FastAPI auth router、JWT 签发/验签、ORM 和 `/me` nonce 检查；SQLite 内存库仅创建合成 User/RefreshToken 并开启 FK，session cache 为内存适配器。故障只在 cache/commit 边界注入，持久撤销位由独立 DB session 检查。每次请求独立 HTTP client，避免测试 Cookie 污染。
- 临时运行器在 app 导入前设置合成密钥、DB/Redis 到不可用哨兵 `127.0.0.1:1`，`socket.connect` audit hook 拦截全部连接；新维护夹具另有 socket 防护。没有连接业务 PostgreSQL/Redis，不执行生产 middleware/lifespan，不调用外部 AI。
- 扩展范围明确 deselect `test_refresh_token_rotation.py` 中 4 个直连 DB 的并发用例，以及 `test_refresh_token_relogin_revoke.py::test_revoke_all_user_refresh_tokens_revokes_existing_tokens`，共 **5 项**；它们不统一遵守 `TEST_DATABASE_URL` 跳过规则，已在测试 README 校正，未运行或改动旧测试。

### AUTH-01 本批门禁与红绿对照

| 验证 | 实际结果 | 证据与限制 |
|---|---|---|
| 最终维护回归对修复前源码 | **18 failed / 14 passed，8 warnings** | `regression-red-pinned-final-with-provenance.log`；32 项最终用例使用 `before/` 的两个认证源码，通过只读 import overlay 加载；日志记录实际模块路径/SHA256，工作区未替换。失败为撤销位、commit、保留副本、fallback/重验分支断言，不是 import 或依赖错误 |
| 当前退出专项 | **45 passed，8 warnings** | `regression-green-pinned-logout-final.log`；新隔离回归 32 项 + 原退出端点 13 项，实际加载当前源码和 aiosqlite 0.22.1，外连尝试为空 |
| 认证 + 相关 core | **86 passed / 5 deselected，8 warnings** | `regression-green-pinned-auth-core-attributed.log`；auth 加 session_guard_bootstrap/rate_limit/deps_token_fallback/deps_query_token_scope/cache_set_nx，包含上述 45 项，不能相加计覆盖 |
| 扩展回归外连防护 | **4 次连接尝试全部在 socket 层阻断** | 上述日志末尾按测试归因：`test_auth_me_uses_session_guard`、`test_generic_http_endpoint_rejects_query_token` 各 2 次，目标均为测试哨兵，不是连接真实依赖。测试通过不能证明这些实际外部路径可用 |
| Python 源码/新测试语法 | **AST 与 compile 通过** | `syntax-check.json`；仅两处认证源码与新维护测试，不执行全后端构建 |
| Markdown checker | **失败：3 条既有归档断链及派生摘要合同** | `markdown-check-final.log`；目标均在 `docs/docker/archive/README.md`，见下方范围说明，未改 checker 或伪造缺失文件刷绿 |
| Markdown 合同测试 | **9 passed / 1 failed** | `markdown-tests-final.log`；失败项为当前全库 Markdown 审计 |
| `git diff --check` | **通过** | `diff-check-final.log`；当前工作区空白门禁，不代表所有其他改动由本批审查 |
| 正常服务只读检查 | **6608 HTTP 200；8000/health HTTP 200、healthy** | `health-check.json`，2026-09-08 17:16（Asia/Shanghai）；仅 GET，没有业务接口调用、服务重启或栈切换 |

所有 pytest 警告来自既有 Pydantic class-based Config 弃用，未修改相关模块。前轮初始 21 项的红灯为 12 failed / 9 passed，扩展到最终 32 项后重新完成同版本红绿对照，不能混用两个用例集合。`regression-green-first.log`、`regression-green-expanded.log` 曾使用系统 aiosqlite **0.20.0**，保留为过程证据，最终声明版本结果以上表为准。

### AUTH-01 已确认行为与未解决边界

- 正常退出、access 缺失/过期/损坏 + 有效 refresh：DB 持久撤销后保留 refresh 副本刷新 401；nonce 成功轮换时旧 access `/me` 401。无效/过期/撤销 refresh、无凭据与旧会话不能误撤销当前会话。
- 覆盖有效 header 与另一账号 Cookie 冲突、无效 header fallback、configured 与 legacy refresh 优先级、nonce 缺失/读取返回 None/抛异常、cache 写返回 false/抛异常及 DB commit 故障。
- **cache 写失败、DB commit 成功**：refresh 撤销位为 true，保留 refresh 401；旧 access 仍可通过 `/me`。**DB commit 失败、cache 轮换成功**：refresh 撤销位仍 false，旧 access 401，但保留 refresh 仍可成功刷新。成功响应只保留客户端退出合同，不声称 DB/cache 全部撤销。
- 读出 refresh owner 后、取得用户锁前插入已完成 login/refresh，旧 token 必须重验且新 token 保持有效；另断言无效 access A 的锁先释放才锁 refresh B。这是 SQLite 确定性交错，不是 PostgreSQL 同时事务或实际锁调度验收。
- 未运行完整后端、被排除 PG 并发、真实 Redis/TTL/存储故障、真实账号/CSRF/网关/生产中间件、四档浏览器或前端门禁；本批没有前端改动，不能挪用 FE-04 的浏览器/前端结果作为 AUTH-01 验收。未扩改 AUTH-02/03/04、BIZ-04 或 logout/relogin token 竞态；未做 DB/cache 原子协议与 legacy Cookie 别名清理。

### AUTH-01 文档、工作区与证据收尾

- 证据根目录 `/tmp/wangsh-auth01-fix-20260908/`：`baseline.json`、`before/`、`run_tests.py`、`run_before_tests.py`、上述日志、`checkpoint-before-doc-sync.json`、`syntax-check.json`、`health-check.json`、`final-workspace-verification.json`。运行器及临时脚本不放项目脚本目录，输出不包含真实凭据。
- 已同步 AUTH/API/tests owner、发布记录、原台账、原计划与本页；没有新增长期报告。Markdown 仍因归档索引引用的 `2026-08-10-ui-branch-layout-review.md`、`2026-08-10-ui-branch-visual-review.md`、`2026-08-06-multi-agent-diagnosis-report.md` 不存在而失败。checker 另要求精确的零缺失摘要；不能在存在断链时补写虚假零缺失文本，不改门禁规避。当前文件/链接计数以最终 checker 原始日志为准。
- 本批允许写入仅认证源码 2 处、新隔离测试、requirements-dev、上述 7 个同步文档和 ignored 接力；HEAD、分支、锁文件 diff SHA256 复核见最终 JSON。未改 Login、XBK、原有测试或锁文件，未做业务数据/结构操作。
- **全工作区并非与原基线完全一致**：原基线 49 个 dirty 路径中有 8 个 XBK endpoint 文件后来变化；另有 5 个 XBK model/schema 路径进入 dirty/untracked 集合。这些范围外变化已在文档同步前快照记录；之后仍有 XBK 修改及新增 `backend/app/utils/academic_year.py`，因此全工作区指纹一致性核验未通过。已确认同目录《测试 xbk 板块内容》任务仍运行，但不据此逐文件归因；本批不覆盖、不删除、不纳入认证成果。最终 JSON 分别报告原基线漂移与文档同步前快照的新增漂移，认证源码则与最终回归 SHA256 对照；不能把“我未改”写成“它们未变”。
- 本批未启动浏览器、临时 HTTP listener、Docker 或后台服务；所有测试进程结束，无测试服务待清理。正常栈 GET 健康通过。下一批按原计划先做 BIZ-04 窗外新建失败回归，保留合法续答；更强认证并发/故障保证须另开专用环境设计与验收。

## 最新补充：FE-04 身份切换缓存隔离修复（2026-09-08）

本批只实施 FE-04 的本地最小修复，基线为 `main@d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加已有未提交改动；未提交、推送、部署或发布镜像。
长期机制见 [AUTH](../../features/AUTH.md)，限定结论与剩余风险见 [原问题台账](../plans/2026-09-08-project-audit-findings.md)，下一批见 [原审查计划](../plans/2026-09-08-project-comprehensive-audit-plan.md)。以下旧批次保留为历史证据，不能代替修复后结果。

### FE-04 本批实际门禁

| 验证 | 本批结果 | 证据范围与限制 |
|---|---|---|
| 失败回归先验 | **旧实现 7 failed / 2 passed（最初 9 项）** | `regression-red.log`；真实 AuthProvider/useUsersList/QueryClient，服务网络 mock。旧列表由 queryFn 填入，不以人工缓存赋值伪造缺陷；不是 JWT E2E |
| 最终缓存隔离回归 | **12 / 12 passed** | 新增 `frontend/src/components/Auth/authQueryIsolation.test.tsx`；身份/权限变化、保留同身份缓存、退出 pending、迟到 query/mutation、401 和 StrictMode；新身份渲染断言要求样本非空 |
| 认证范围回归 | **6 files / 73 tests passed** | `auth-green-final.log`，包含新增 12 项及原认证测试；未修改既有测试 |
| TypeScript | **通过：tsc --noEmit** | 同一最终认证日志；不是仅以打包代替类型检查 |
| 全量前端 Vitest | **83 files / 526 tests passed** | `frontend-gates-final.log`；旧中间日志中的 523 项不是最终基线 |
| 全量 ESLint | **0 errors / 470 warnings** | 同一最终日志；不是零警告。目标源码另跑 lint，0 errors / 3 warnings；修复前备份经 stdin 对照，useAuth 的 3 条 warning 规则/行号相同，不外推全项目 warning 全部已逐条复核 |
| Vite 生产打包 | **通过** | `npx vite build --mode production --outDir /tmp/wangsh-fe04-build`，本地前端容器内执行。存在大 chunk、direct eval、Browserslist 数据过期等警告；输出目录在容器 /tmp。不是 `npm run build`（未执行 prebuild 资源复制）或 bundle-budget |
| 当前应用真实浏览器 | **21 / 21 汇总断言通过，15 个 auth/users HTTP 响应，B 登录期间 25 次 DOM/帧采样** | `browser-acceptance/browser-verification.json`；Chrome 1440×900、真实表单 pointer、当前 index/App/用户表，auth/users 转真实 JWT 的隔离内存后端；无手工 QueryClient 注入 |
| Markdown 合同 | **未通过；107 files / 290 links / 3 missing** | 三条既有归档断链，checker 另要求精确零缺失汇总而报摘要不匹配；不造文件、不修改 checker 掩盖 |
| Markdown 合同测试 | **9 passed / 1 failed** | 真实仓库合同失败，其他夹具/workflow 合同通过；不是整体通过 |
| 工作区保护与 diff | **43 个基线文件中 38 个 hash 不变，仅 5 个约定文档变化；diff check 通过** | HEAD/锁文件差异 hash 不变，无基线文件缺失；4 个预期新增 status 路径。另有 2 个基线外文件（UI 快照及 XBK 接力摘要），保留未触碰，全工作区精确范围比对不一致，不能称整个目录静止 |

**代码边界**：AuthProvider 外层保留认证控制器，以用户/权限范围切换 AuthQueryScope；每个作用域独立 QueryClient，并重挂业务子树。旧 scope 真卸载后 cancel/clear，StrictMode effect replay 不误清同一 scope；同身份显示名刷新不清缓存。
退出先撤下本地身份再等待 HTTP，但 `authApi.logout()` 的网络 finally token 清理仍在：退出请求与再次登录并发的 token 竞态未纳入本项；AUTH-01/02、BIZ-04 未修复，AUTH-04 仍须产品确认。清缓存不取消已发服务端 mutation，也不覆盖非 QueryClient 持久化或跨标签页。

### FE-04 修复后真实页面证据

A 超管实际登录、真实列表含 `Audit Privileged Record / P001` → 仅隔离服务撤销 A → 搜索 users 401 / refresh 401 → RoleGuard 软跳转登录页 → B 管理员实际登录及 `/me` 确认。
记录 `api-start`、隔离服务返回 `api`、向页面交付 `api-deliver`；B 同参数列表仅请求一次，真实后端只返回学生 IDs `[1001,1002,1003]`。
特意持有 B 列表响应，确认页面已经是 `/admin/users`、B 身份可见、列表为骨架加载态；尚无 B 列表交付事件，且没有 A 的敏感姓名/学号。
释放响应后真实表只显示学生，DOM 变更与 animation-frame 观察记录未发现旧字段。该采样加受维护 render 回归支持本链路结论，不宣称穷尽任何网络交错。

切换前、B pending、B loaded、直接接口对照前 document 均为 1；A 时设置的页面哨兵与 `performance.timeOrigin` 保持。随后 **显式** reload 才产生第 2 个 document，哨兵消失，新列表依旧只有学生。
B 直接列表 200 且仅学生、其他管理员 8002 详情 403；不是修改后端权限让列表看起来正确。pending/成功两张截图已实际查看。
`pageerror=[]`；预期 401/403、CDN abort、无关系统 API 503、空 SSE 的重连可能产生 console error，不称 console 零错误，也不将这些隔离边界计为新产品缺陷。

**环境限制**：独立 `127.0.0.1:18768`，SQLite 内存 ORM、合成身份、真实 JWT/auth/users 路由、内存 nonce/cache，后端出站 socket 防护；不接业务 PostgreSQL/Redis，不运行生产 middleware/lifespan，不调用外部 AI。
本次不是线上真实账号验收、全角色/历史返回/跨标签页矩阵、退出菜单逐项 pointer 回归或四档桌面视觉验收；后端全套 AUTH/时间窗探针未在本批重复运行。

**夹具失败如实保留**：最早手工等待超过客户端超时，产生重试；`browser-final/` 的 run-code 环境没有 global setTimeout；`browser-verified/` 的异步等待误判，所谓 pending 实际仍在登录页，因此不计有效 pending 验收。
最终 `browser-acceptance/` 改为显式轮询加 URL/held 断言，并在客户端超时前自动截图及释放，完整重新走 A→失效→B。前三轮日志/说明未删除，不把夹具错误算成产品错误，也不拿无效画面凑通过。

### FE-04 证据、清理与保护

证据根目录：`/tmp/wangsh-fe04-fix-20260908/`。

- 门禁：`regression-red.log`、`auth-green-final.log`、`frontend-gates-final.log`、`lint-targeted-final.log`、`lint-useAuth-before.log`。
- 最终浏览器：`browser-acceptance/a-state.json`、`browser-login-b.json`、`browser-controls.json`、`browser-verification.json`；截图 `fe04-a-users.png`、`fe04-b-pending.png`、`fe04-b-users.png`、`fe04-b-reloaded-users.png`。脚本与原始日志留同目录，无令牌输出。
- 清理：`fe04-acceptance` 已关闭；核对完整命令后 SIGINT 停止本批 PID 40283，进程与 18768 监听均已消失。早前尝试的浏览器已关闭；不关闭其他任务资源。
- 正常栈：`http://localhost:6608` 与 `http://localhost:8000/health` 均 200；本批未停止/重启正常栈，未查业务数据。
- 本批允许改动仅 AuthQueryScope/useAuth/index、新缓存隔离测试、AUTH/RELEASE_NOTES/原台账/原计划/本状态文档及 ignored 本地接力；不改 Login.tsx、既有 XBK/测试/锁文件、不迁移 schema、不恢复名册。最终 hash 结果与文档门禁日志在同一证据根目录。
- 工作区额外发现 `xbk-material-ui-snapshot.md`（文件时间 2026-09-08 15:04:47 +08:00，晚于本批 baseline）和收尾时新出现的 `XBK接力摘要.md`。前者是 UI 可访问性快照片段；两者来源未归因，均未移动、删除或加入本批允许范围。`final-workspace-verification.json` 分开报告 baseline_protected 与 strict_scope_match，保留首次不一致记录 `workspace-verification-unattributed-file.json`，不改基线刷绿。
- 文档门禁原始记录：`markdown-contracts-final.log`、`markdown-contract-tests-final.log`。缺失目标均由 `docs/docker/archive/README.md` 引用：`2026-08-10-ui-branch-layout-review.md`、`2026-08-10-ui-branch-visual-review.md`、`2026-08-06-multi-agent-diagnosis-report.md`；不属于 FE-04 修复范围。


## 历史补充：认证、缓存与时间窗准确性复审第二批（2026-09-08）

本批继续准确性复审，**未实施业务修复**。基线为本地 `main@d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加既有未提交改动。
限定结论、反证和修复入口见 [原问题台账](../plans/2026-09-08-project-audit-findings.md)，下一步见 [原审查计划](../plans/2026-09-08-project-comprehensive-audit-plan.md)。
下方其他批次均保留为历史快照；本批未重跑全量 Vitest、type-check、lint、build、XBK 回归或生产集成测试。

### 第二批实际执行与边界

| 验证 | 本批结果 | 证据范围与限制 |
|---|---|---|
| 认证/时间窗真实后端隔离探针 | **124 / 124 断言成立，102 个 ASGI 请求，出站 socket 尝试 0；failure=null** | 真实 login、凭据匹配、JWT 签发/验签、角色依赖、router/service/SQLAlchemy ORM；7 张 SQLite 内存表、FK 开启。断言包含缺陷复现，不能写成产品 124 项通过 |
| AUTH-01 退出撤销矩阵 | 限定缺陷复现；有效 access 退出拒绝旧令牌对照通过 | 缺失/过期/损坏 access 退出清 Cookie 后，已保留的 refresh 副本仍可恢复；cache 写失败注入证实事务 rollback 撤回 refresh 撤销。另有同账号重登、旧会话退出不影响新会话、refresh 重放/限流对照 |
| AUTH-02 同 IP 账号替换 | 条件性缺陷复现 | 开启唯一性时 A 被 B 替换，A 旧 access 拒绝、旧 refresh 恢复可用 access，B 仍可访问且 IP binding 仍 B；每请求同 IP 校验亦复现。关闭开关/不同 IP 是正常对照；部署开关及代理策略未核定 |
| AUTH-04 凭据与停用生命周期 | 现状验证，降为策略风险/合同待确认 | 真超管更新学号；学生更新被拒。固定 username 的旧 access 保留，无 username 的旧 access 失效；两者旧 refresh 可恢复。停用拒绝 access/refresh，再启用未撤销令牌恢复。未测试密码重置，不称停用仍可访问 |
| BIZ-04 时间窗 | 窗外新建缺陷复现 | available 排除未来/结束配置，直接 start 仍写入新 session/answer。开放/无时间窗/两侧相等边界允许，disabled/未知 ID 拒绝；已有会话恢复另作对照，不擅自禁止续答 |
| FE-04 真实应用浏览器 | **14 / 14 汇总断言成立，记录 14 个 auth/users HTTP 响应** | 当前真实 index/App/Login/用户表，Chrome 1440×900，真实 pointer 登录 A/B；auth/users 转隔离真实后端。失效软跳转换号后旧敏感行可见；B 直接列表过滤、详情 403；reload 后旧行消失。不是生产泄露或全角色验收 |
| Markdown 合同 | **未通过；106 files / 282 links / 3 missing** | 3 条既有归档断链；checker 要求精确 0 missing 汇总，另报汇总不匹配；不造文件或修改规则掩盖 |
| Markdown 合同测试 | **9 passed / 1 failed** | 真实仓库合同失败，9 项夹具/workflow 合同通过；不是整体通过 |
| 工作区保护与 diff | **43 个基线文件中 39 个 hash 不变，仅 4 个约定文档变化；diff check 通过** | 对照本批 baseline，无意外新增/删除 status 路径，HEAD 与锁文件差异 hash 不变；另更新 ignored 本地接力 |

**隔离边界**：仅替换 `get_db`，没有覆盖认证/角色依赖。session cache 使用内存适配器，真实 rate limiter 使用内存 fallback，独立场景间重置测试限流状态；随机测试签名密钥只存进程内，不输出令牌。
SQLite 加载测评配置时只补 UTC，冻结时钟而保留真实比较、抽题和 ORM。未运行生产 lifespan/middleware、PG 行锁并发、Redis TTL/故障集成、外部 AI；禁止出站只描述后端探针，不泛化为浏览器没有本地网络。

**FE-04 浏览器证据精度**：A 超管登录 → 真实用户接口填缓存 → 仅隔离服务撤销 A → 搜索 users 401 / refresh 401 → RoleGuard SPA 登录页 → B 普通管理员真实登录。
切换前后 document 计数为 1；B 身份已由真实 `/auth/me` 确认，却仍显示 A 可见的管理员行。捕获记录中未出现 B 的同参数列表交换；日志记录于响应完成，不能据此排除任意在途请求。
B 直接列表只返回合成学生 IDs `[1001,1002,1003]`，管理员记录 8002 详情 403；reload 增至第 2 个 document 后旧行消失且真实列表重新请求。
`pageerror=[]`；预期 401/403、被阻断资源会产生 console error，不能称 console 零错误。外部 fonts/CDN 主动 abort、无关 system API 隔离 503、admin SSE 空替身导致重复重连，均非本轮项目 bug。
未测所有角色、跨标签页、迟到请求、内嵌 AI 登录弹窗，也未逐项点击主动退出菜单；主动退出重载只由源码及 reload 对照支持。

### 第二批证据与资源收尾

- 证据目录：`/tmp/wangsh-audit-auth-window-20260908/`。后端 `backend_probe.py`、`backend-results.json`、`backend-probe.log`；浏览器 `browser-bootstrap.js`、`browser-b-result.json`、`browser-controls.json`、`browser-verification.json`；`verify_browser_evidence.py` 从原始结果重算断言并保存来源 SHA256，不重跑探针。
- 截图 `fe04-a-users.png`、`fe04-b-cached-users.png`、`fe04-b-reloaded-users.png` 保留；后两张已在运行阶段实看。临时证据可能被系统清理，不替代下一批受维护回归测试。
- 后端日志中的 session 写失败告警为 AUTH-01 明确注入；早期 CLI 工作目录定位错误与 zsh 裸 glob 错误为操作失误，不计产品 bug。后续探针和汇总断言均完成；不隐去夹具限制。
- 仅关闭本批 `audit-auth-cache` 浏览器；核对 `18767` 的 PID 32218 与完整 `serve_isolated.py` 命令后 SIGINT，之后无该端口监听。SQLite 内存随退出释放。见 `browser-cleanup.log`、`server-cleanup.json`、`final-browser-sessions.log`。
- 未对 `wangsh-verify` 执行关闭操作；本次 CLI 在仓库及两批 scratch 目录的列表均不再显示它，因此不能沿用上一批“仍 open”的状态。保留会话不可由本次列表确认，不为核查而重建或关闭其他浏览器。
- 普通栈仅做健康检查：`6608` HTTP 200，`8000/health` HTTP 200，status/database/redis 均 healthy，见 `health-check.json`。未访问普通业务 API、真实名册、成绩或 schema；未迁移、提交、推送、部署或发布镜像。
- 本批仅纠正 API 文档关于退出撤销持久化顺序的错误描述；未改实现、测试、依赖、锁文件或登录页。工作区核验 `verify_workspace.py` / `final-workspace-verification.json` 对照本批 `baseline.json`；锁文件 Git diff SHA256 仍为 `f2ec0327cbd3595de582163b622a7e47c3ab268f7ce535a92a80cc6ff6c2445b`。
- 本批首次文档检查还发现新增 API 链接的标题锚点不匹配，已改为原台账文档链接并复跑；初次失败保留为 `markdown-check.initial.log` / `markdown-tests.initial.log`。最终日志 `markdown-check.log` / `markdown-tests.log` 只剩既有归档断链和由此触发的汇总合同失败，`diff-check.log` 通过。未篡改 checker 或把非零缺失写成零。
- 仍缺失的原归档目标：`2026-08-10-ui-branch-layout-review.md`、`2026-08-10-ui-branch-visual-review.md`、`2026-08-06-multi-agent-diagnosis-report.md`，均来自 `docs/docker/archive/README.md`。本批不擅自删除引用或伪造历史内容。

## 同日早先：问题准确性复审第一批（2026-09-08）

本节响应用户“分析不深入、bug 不够准确”的反馈，优先反证、缩小范围并升级实际调用链证据，**不是扩大 bug 数量或完成修复**。
基于本地 `main@d8c3da3344cde9a23d58952c247c50a3f90e0e8f` 加既有未提交改动。
业务结论、确认/降级/待复核及修复建议只维护在 [原问题台账](../plans/2026-09-08-project-audit-findings.md)；执行入口为 [原审查计划](../plans/2026-09-08-project-comprehensive-audit-plan.md)。
本轮未重跑全量 Vitest、type-check、lint、build 或 XBK 回归；下方各节数字均为各自历史快照，不能当作本轮工程全绿。

### 实际执行与证据边界

| 验证 | 本轮结果 | 实际范围与限制 |
|---|---|---|
| assessment 隔离后端探针 | **26 条断言成立 / 25 个 ASGI HTTP 请求；出站 socket 尝试 0** | 真实 router/schema/service/ORM、AsyncSession、11 张模型表；SQLite 内存库 FK 开启。断言包括缺陷复现，**不是 26 项产品通过** |
| BIZ-02 未答结果读取 | 本人进行中固定选择/填空/简答的标准答案实际返回 | 实际 `/sessions/start` 后未答即 `/result`；`/questions` 不含答案/解析；他人 422、guest 403；合法单题反馈、重复作答拒绝、交卷后结果为对照 |
| BIZ-03 画像详情类型 | 非成员读取数字碰撞 group 画像，条件性缺陷确认 | 真正管理员生成路由、组数据采集与 DB commit，仅 AI 内容替身；列表仍只含 individual；本人 individual 正常、他人 individual/非碰撞 group/guest 被拒绝；student 不能生成 |
| FE-03 API 顺序对照 | submit 先到：graded/0，迟到 answer 422；数据库确认未作答 | 另测进行中先保存成功并持久化；不是 PostgreSQL 同时事务或真实外部 AI 评分 |
| FE-03 真实组件浏览器 | answer pending 时确认按钮 enabled；submit 200/graded/0；result 未作答；释放 answer 后 422 | 当前 AssessmentPanel/ConfirmDialog/services 隔离挂载，真实 pointer；assessment API 转本轮内存后端；不是正常登录/应用外壳完整 E2E |
| FE-02 批量删除复核 | 补全数量提示、确认入口差异及后端角色/软删除保护，降为交互风险 | 仅当前源码调用链与历史合成载荷；未执行真实删除或验证恢复流程，跨筛选选择语义待确认 |
| Markdown 合同 | **未通过；106 files / 279 links / 3 missing** | `node scripts/check-markdown-contracts.mjs`：3 条既有归档断链；汇总合同要求 0 missing，故另报汇总不匹配；不改门禁或造文件刷绿 |
| Markdown 合同测试 | **9 passed / 1 failed** | `node --test scripts/markdown-contracts.test.mjs`；失败为真实仓库合同，其他夹具/workflow 合同通过；不是整体通过 |
| 工作区保护与 diff | **43 个基线文件中 38 个 hash 不变，仅 5 个约定文档变化；diff check 通过** | 无意外新增/删除 status 路径；HEAD 与原锁文件差异不变；另更新 ignored 本地接力；未改业务源码或测试 |

**后端隔离方式**：`get_current_user` 注入合成身份，保留真实 `require_student_or_staff` / `require_admin`；没有 JWT 验签。
不导入 `backend/main.py`，不运行生产 lifespan/middleware。PG/Redis 配置指向不可用 `127.0.0.1:1`，探针以审计钩子拒绝出站 socket；仅替换外部 AI 及后台画像任务。
`aiosqlite 0.22.1`、pycache 都放 `/tmp/wangsh-audit-accuracy-20260908/`，没有修改仓库依赖或锁文件。浏览器集成阶段只允许本地 Vite/本轮内存 API 通信，不将后端探针的“0 出站”泛化为浏览器无网络。

**画像的合成条件**：管理员请求参数为 `profile_type=group, target_id="1001", discussion_session_id=1001, agent_id=1`，真实存储的讨论组属于合成 B 班、成员只有 1002，1001 是非成员；生成后的报告被该用户从个人详情读取。
另一个数字 class 名碰撞仅来自合成存储夹具，不是实际 class 生成流程。未查询业务库碰撞数量，未确认当前前端存在正常 group 生成页面。

**浏览器顺序与可见结果**：测试 HTML 由 route 拦截提供，地址 `http://localhost:6608/audit-accuracy.html`，并非新增仓库页面。合成身份 props，assessment 请求仅转发 `127.0.0.1:18766`，其他业务 API 禁止访问。
打开“自我评价”→开始检测→填写简答→pointer 点击“提交检测”触发 blur 保存→确认。
控制 `/answer` 在到达后端前挂起约 32 秒，`/submit` 先返回 `200 / graded / earned_score=0`；`/result` 返回 `student_answer=null / ai_feedback=未作答`。
释放 answer 后返回 `422：该检测已提交，无法继续答题`。合成 `config_id=2`、`session_id=1`、`answer_id=1`；结果截图已实看，显示 `0/10`、“我的答案：未作答”。
该延迟只证明排序缺口，不估计真实网络发生率；`pageerror=[]`，422 有预期 console error，不能称 console 无错误。

### 证据文件、夹具失败与资源收尾

- 证据根目录：`/tmp/wangsh-audit-accuracy-20260908/`；核心文件 `backend_probe.py`、`backend-results.json`、`backend-probe.log`、`browser-bootstrap.js`、`browser-race.json`、`browser-pending-check.log`、`browser-race.log`；截图 `fe03-pending-confirm.png`、`fe03-result.png`。临时文件可能被系统清理，不能替代受维护回归测试。
- 夹具错误记录 `harness-errors.md`：首次 CLI 沙箱无 `URL` 全局，后改正则解析；Vite 的 CJS ReactDOM client 需 default import 后访问 `createRoot`。均已纠正并完成探针，**不是项目 bug**，不隐去早期失败。
- 核验监听端口与完整命令后，仅向本轮 `serve_isolated.py` PID 28574 发送 SIGINT；之后该进程及 `18766` 监听均已消失。`audit-accuracy` 浏览器关闭，`wangsh-verify` 仍 open，正常 Docker 栈未停止。清理日志 `server-cleanup.json`、`browser-cleanup.log`、`final-browser-sessions.log`。
- 收尾健康检查：前端 `6608` HTTP 200；后端 `8000/health` HTTP 200、status/database/redis 均 healthy。仅健康检查，未向业务 API 写入、恢复名册、改 schema、迁移、提交、推送或部署。
- 复审基线 `baseline.json` 记录于 `2026-09-08T11:53:36+08:00`；写回前全部 hash 不变。最终 43 个基线文件中 38 个仍不变，变化仅为原台账、原计划、TEST_STATUS、docs 索引和 plans 索引；另更新 ignored 本地接力，`git status` 无意外路径增减，HEAD 不变。校验记录 `final-workspace-verification.json`，验证脚本 `verify_workspace.py`。
- 原 `frontend/package-lock.json` 的 Git diff SHA256 仍为 `f2ec0327cbd3595de582163b622a7e47c3ab268f7ce535a92a80cc6ff6c2445b`；已有 XBK、登录跳转、测试及其他源码改动均未覆盖。
- 文档门禁复跑日志：`markdown-check.log`、`markdown-tests.log`；差异空白检查 `git diff --check` 通过，见 `diff-check.log`。原台账所有 ID 保留，总览级别与详情一致，非本轮重点条目均有初审待复核状态。
- 仍缺失的既有归档目标都由 `docs/docker/archive/README.md` 引用：`2026-08-10-ui-branch-layout-review.md`、`2026-08-10-ui-branch-visual-review.md`、`2026-08-06-multi-agent-diagnosis-report.md`。未伪造替代文件、删除历史引用或修改 checker 以取得通过；汇总据实保留 3 missing，后续另按文档治理规则处理。

## 同日早先：全项目首轮审查接续（2026-09-08）

本节是来源任务《检查 WangSh 项目状态》的接续复核，覆盖计划阶段 0～3 的首轮，**不是全项目最终验收，也不是修复完成报告**。
依据为本地 `main@d8c3da3` 加既有未提交改动；发现及证据等级统一见
[首轮问题台账](../plans/2026-09-08-project-audit-findings.md)，执行与决策边界见
[审查计划](../plans/2026-09-08-project-comprehensive-audit-plan.md)。台账所有问题/风险仍未修复。
下方“实际名单与登录跳转”及更早章节是历史快照，不能把它们的构建、定向 lint 或资源状态当成本次重跑。

| 验证 | 本次结果 | 实际范围与限制 |
|---|---|---|
| 后端 XBK 回归 | `201 passed, 1 skipped, 9 warnings` | `XBK_AUDIT_BASE_URL=http://localhost:8009 backend/venv/bin/python -B -m pytest -q backend/tests/xbk`；测试安全已审核，仅隔离测试库/内存替身，不是后端全仓库 |
| Docker TypeScript | 通过 | `docker exec wangsh-frontend sh -lc 'npm run type-check && npm run test && npm run lint'` 中类型检查成功 |
| Docker 前端全量 Vitest | `82 files / 514 passed` | 当前挂载源码的全量前端测试；不替代真实角色端到端 |
| Docker 前端全量 lint | `0 errors / 470 warnings` | 本次是 `eslint src` 全量，不是早先的定向 lint；保留告警，不宣称零告警 |
| 前端生产 build | **本次未重跑** | 同日来源任务已有成功日志及 pdfjs eval/体积告警；这里只继承历史证据，不构成本次构建验收 |
| XBK 隔离 HTTP / 导出对账 | 缺陷复现 | 实际 router/PostgreSQL，角色由测试适配器注入；覆盖自然键编辑、孤立导入、手工校验、公式单元格、页面/导出口径。合成随机键，定向清理 |
| XBK 并发导入 | 缺陷复现 | 屏障使双方身份检查都先于 upsert；双方均报新增，最终只保留一方姓名。真实 PostgreSQL/函数调用，不是并发 HTTP 或发生概率压测 |
| 认证撤销/身份解析 | 合成缺陷场景复现，正常退出对照通过 | AST 提取真实函数体，内存 JWT/查询/缓存替身；不是真实 JWT 验签、Redis 或 HTTP 验收。同 IP 开关及凭据变更撤销策略未核定 |
| 其他业务后端 | 合成缺陷复现 | 实际函数/SQL 加 SQLite 内存库或替身；个人内容、测评答案/时间窗、画像类型、可选历史参数。日志中的 PASS 表示复现断言成立，不是修复通过 |
| 前端五项专项 / XBK 摘要浏览器 | 来源证据 + 当前源码独立复核 | 本次未重跑五项前端专用脚本或摘要 mock 浏览器；源码指纹一致不等于新端到端。未执行真实用户批量删除、真实成绩结算或外部 AI 请求 |
| 运维启动任务 | 真实函数加替身复现 | 去除 Celery 装饰器，假 provider 抛 TimeoutError/RuntimeError 后函数正常返回且业务 FAILED；未运行 Celery worker 自动重试 |
| 迁移预检 | 真实 parser/evaluator 加合成 schema 集复现 | 合法中间 revision `20260428_agent_idx` 被误拒，空 schema/head 对照通过；AST 确认 `20260210_0000_legacy_baseline_tables` 是祖先。**没有执行真实 migration** |
| 沙箱网络与复用 | 源码风险待处置/验证 | 没有进行越界网络探测、实际 DAP 连接、外传、宿主逃逸或运行模式切换实验；不宣称已公网暴露 |
| Markdown 链接/汇总合同 | **未通过**；当前 `106 files / 274 links / 3 missing` | 3 条既有归档断链；脚本还要求完全匹配带“0 missing”的汇总，因此报告汇总过期，不能将实际缺失改写为零 |
| Markdown 合同测试 | `9 passed / 1 failed` | 失败项为真实仓库合同，另 9 项夹具测试通过；不篡改门禁或把整体写成通过 |
| `git diff --check` | 通过 | 本次文档同步后执行；包括现有 tracked 差异 |

### 本次证据与资源收尾

- 临时证据根目录：`/tmp/wangsh-project-audit-20260908/`；本次复验在 `resume/`。
  主要文件：`xbk-regression.log`、`frontend-gates.log`、`auth-synthetic-results.json`、`backend-business-recheck.log`、
  `xbk-probes.json`、`export-parity.json`、`concurrency-probe.log`、`ops-independent-results.json`。
  根目录四份分区报告与前端专项是来源证据，未重新分派。临时附件可能被系统清理，不保证长期存在。
- 工具/夹具失败留痕：并发脚本首次缺 `PYTHONPATH=/app`；运维 AST 夹具初版漏读 `AnnAssign`、随后误用简写 baseline revision。
  均保留 `resume/*error.log`，修正后复验成功；它们不是应用 import 故障、多 head 或实际迁移事故。
- 清理前严格核验 `wangsh-xbk-audit` 的独立数据库名、挂载和 `127.0.0.1:8009` 绑定；仅停止移除此临时容器，并关闭专用 `project-audit` 浏览器。
  没有删除数据库/卷；独立测试库保留，非本任务的 `wangsh-verify` 浏览器保持开启。
- 2026-09-08 11:31（Asia/Shanghai）收尾检查：前端 6608 HTTP 200；后端 8000 `/health` HTTP 200，database/redis 均 healthy。
  正常前后端、PostgreSQL、Redis、PythonLab worker、Typst worker、Adminer 均仍运行。证据：`resume/final-runtime.json`、`container-cleanup.json`、`browser-final.log`。
- 本次没有新增业务源码/测试/锁文件修改，没有写入正常业务数据、恢复名册、执行迁移、提交、推送、部署或访问远端。
  来源任务的业务数据数量仅是旧只读快照，本次未重查，不能声称当前仍为相同数量。
- 工作区保护：对接续开始的 `resume-baseline.json` 中 42 个文件逐一 SHA256 对比，38 个完全未变，仅本轮约定的 4 个计划/状态/索引文档变化；新问题台账及本地接力另计。既有业务源码、测试和锁文件未被本轮覆盖。
  原 `frontend/package-lock.json` 的 diff SHA256 仍为 `f2ec0327cbd3595de582163b622a7e47c3ab268f7ce535a92a80cc6ff6c2445b`。
  完整对比：`resume/final-worktree-check.json`；不使用历史 UI 分支或旧截图替代当前源码。
- 文档失败定位：`docs/docker/archive/README.md` 引用了缺失的 `2026-08-10-ui-branch-layout-review.md`、
  `2026-08-10-ui-branch-visual-review.md`、`2026-08-06-multi-agent-diagnosis-report.md`。
  已用 `git show HEAD:docs/docker/archive/README.md`、`git ls-tree` 和限定 docs 文件名查找确认：当前 HEAD 已有引用但无目标，本轮未改归档索引。
  新增台账/索引后汇总数量也需要更新；实际缺失尚未解决，故保留合同失败，不复制脚本要求的零缺失字符串来假装通过。
  后续文档治理需先查历史与替代 owner，再决定恢复历史文件还是标注失效，不能直接删历史说明。
  日志：`resume/markdown-contracts.log`、`markdown-contracts-tests.log`、`diff-check.log`。

## 同日早先：实际名单与登录跳转（2026-09-08）

此节更新同日早先合成样本审查的结论，不将早先“未提供实际文件”当作当前状态。

| 验证 | 当前结果 | 范围/边界 |
|---|---|---|
| 后端 XBK（含显式隔离 HTTP） | `201 passed, 1 skipped, 9 warnings` | 独立8009/测试库，实际router与PostgreSQL；未运行后端全仓库 |
| Docker 前端全量 Vitest | `82 files / 514 passed` | 包括默认首页、显式redirect/角色权限、导入失败禁用提交 |
| Docker TypeScript / 定向 ESLint / build | 通过 | lint `0 errors / 10 warnings`；build仍有pdfjs eval/体积告警 |
| 当前高一工作簿只读预检 | `974 total / 974 valid / 0 invalid` | 单独文件；未执行真实名单导入 |
| 当前高二工作簿只读预检 | `883 total / 883 valid / 0 invalid` | 单独文件；未执行真实名单导入 |
| 重复键/混合时期合成文件 | 预检和执行均422 | `skip_invalid=true`也整份阻止；隔离2026数据前后不变 |
| 隔离身份冲突 | 通过 | 同人可新增/更新班级；不同姓名或不同非空年级被422拦截，无写入 |
| 浏览器原生上传 | 通过已测流程 | 重复学号可见错误、勾选跳过仍禁用导入；改选当前高一文件预检恢复可提交，随后取消 |
| 导入错误视觉 | 1280×800已截图并实看 | 本轮新增风险提示和错误完整可读；未重做全部四档视觉验收 |
| 登录浏览器回归（模拟身份） | 9条目的地检查通过，`pageerror=[]` | admin/super_admin/teacher/student各表单登录和已有会话均到/home；显式/xbk可返回。真实用户名密码未验证 |

实际材料在排查期间发生外部更新：高一文件10:01修改后学号已单文件唯一，高二10:02修改后年份统一2026。
两份当前文件之间仍有828个相同短学号，不可将各自预检通过理解为可以同时安全导入。
初次诊断确认高一班内序号导致末行覆盖；业务库只读汇总仍有58条高一记录，未自动修复/删除。
原工作簿未由本轮工具修改；建议先确认跨年级唯一ID规则及恢复范围，再备份并恢复名单。

临时证据：`/tmp/wangsh-xbk-audit-20260908/real-files-backend-http.log`、
`real-files-frontend-gates.log`、`real-files-http.json`、`duplicate-blocked-1280.png`、
`browser-login-final.log`、`login-home-final.png`（均非真实学生截图）。
隔离测试容器首次启动误选了后端的另一个网络，未连上测试库；已改为后端与PostgreSQL共有网络并完整复验。
没有业务库写入、真实账号密码登录测试、远端部署或镜像发布；并发预检/upsert仍非锁定隔离，不能承诺所有条件零错误。
收尾已关闭专用浏览器、移除临时审查容器并保留独立测试库；正常6608 HTTP200，8000及DB/Redis healthy，业务名册仍58条，原package-lock差异指纹未变，`git diff --check`通过。

## 2026-09-08：校本课本地 Docker 专项复验

此快照针对本地 `main@d8c3da3` 上尚未提交的 XBK 修复。正常开发栈前端
`localhost:6608`、后端 `localhost:8000` 挂载当前工作区源码；真实写入测试只走
临时 Docker 服务 `localhost:8009` 和独立数据库 `wangsh_xbk_test_20260908`。
没有改写正常业务数据、执行 migration、访问远端、推送代码或发布镜像；
本次验证不能替代生产镜像构建及远端验收。下方旧批次结果保留作历史参考，不能视为本轮全后端验证。

| 类别 | 本轮结果 | 范围与说明 |
|---|---|---|
| 后端 XBK 单元/回归 | `190 passed, 3 skipped, 9 warnings` | 在 backend venv 执行 `pytest -q tests/xbk`；2 项隔离 HTTP 默认跳过并另行实跑，1 项因缺少 xlrd 跳过；非整个后端仓库全量 |
| 真实 Docker HTTP | 导入专项 30 项通过；最终 HTTP 测试 `2 passed` | 后者含 53 个 HTTP 状态断言及真实 multipart 空选课导入；验证权限拒绝、CRUD、删除、统计及导出；身份由隔离应用注入，未验证真实登录 |
| Docker 前端类型 | 通过 | `npm run type-check` |
| Docker 前端全量测试 | `82 files / 468 passed` | 包括 Import、Delete、Export、Analysis 组件及数据服务；旧 presentation mock 随正确未选课 API 同步 |
| Docker 前端定向 lint | `0 errors, 9 warnings` | XBK 页面、全部 Modal、相关测试和数据服务；警告为 `no-explicit-any`，非全仓库 lint |
| Docker 前端构建 | 通过 | `npm run build`；仍有 pdfjs eval 和大 chunk 告警，不宣称零警告 |
| 真实浏览器 | 通过已测流程 | 三类原生文件上传、预检与导入；无效 CSV 阻止导入、同文件重选、未选统计/分析、班级共享课程删除保护、导出及当前表导出 |
| 文件实检 | 通过 | 下载的 XLSX 用 openpyxl 打开；班级工作表保留 `00001` / `00002`，未选导出只含目标学生；未验证 Excel 实际公式重算 |
| 桌面视觉 | 四档已截图并实看 | 1280×800、1440×900、1680×1050、1920×1080；标题已移除，无页面水平溢出；1280 表格内部仍需横向滚动查看末列 |
| 新鲜浏览器错误监测 | `pageerror=[]`、失败 HTTP `=[]` | 页面重载/截图和最终导出操作窗口；不将先前故意错误输入、测试代理问题或扩展日志计为此结论 |
| 差异检查 | 通过 | `git diff --check`；原有 package-lock 差异指纹未改变 |

复验中修复了空字符串/“未选”统计口径不一致、分析页误取休学列表、名册年级筛选及跨学期
同学号误关联；导入/删除/导出弹窗补充重复提交和旧响应防护。接口与行为见
[XBK](../../features/XBK.md) 和 [API](../../development/API.md)。

已知边界：当前容器缺少 `xlrd` 时，真正旧版 `.xls` 需另存 `.xlsx` 或 CSV；自然键编辑未扩展
为级联改号，导入未新增关联存在性约束，并发同键 upsert 的结果计数未提供额外一致性保证。
这些测试不能证明所有输入或并发条件绝对无错。没有真实业务导入文件，使用的是隔离测试样本。

09:48 收尾：专用测试浏览器已关闭，临时 `wangsh-xbk-audit` 容器已停止并移除；独立测试数据库保留。正常开发栈继续运行，8000 健康检查及 DB/Redis 均为 healthy，6608 页面返回 200。

本机临时证据位于 `/tmp/wangsh-xbk-audit-20260908/`：
`backend-final-tests.log`、`isolated-http-final.log`、`frontend-final-gates.log`、
`desktop-acceptance.txt`、`browser-export-final.txt`、`xbk-<分辨率>.png`、
`import-preview-1280x800.png` 及下载的 XLSX；临时路径不保证长期保留。

## 一、当前未提交整理批次

本节只记录当前 dirty worktree 的最后一次验证快照。远端 GitHub Actions、生产模拟和
Docker Hub 发布仍对应 `origin/main`；文档或代码继续变更后，必须重新执行对应门禁。
历史发布快照见第三节，不能与本节合并理解。

| 类别 | 当前结果 | 覆盖内容 |
|---|---|---|
| 后端全量 | `906 passed, 1 skipped, 9 warnings` | 新增行为级越权矩阵 159 用例（assessment 10 端点 4 角色、typst 15 端点 staff、student→admin 403）、SSRF 17、query-token 收窄 5 |
| 前端全量 | `77 files / 374 passed` | 组件、页面、状态与工具函数回归，包含 `src/lib` 运行时边界和 Assessment 静态新建路由 |
| 迁移链 | 单 head `20260817_0001_query_filter_indexes` | 根迁移 `20260210_0000`（18 表入链）后裸空库 upgrade 实测成功；两库（Homebrew/docker）均升至 head；alembic check 漂移 14→9（存量登记中） |
| TypeScript | 通过 | `tsc --noEmit` |
| CSS token | 通过，`0 undefined / 1821 references` | `token:check:ci` |
| ESLint | `0 errors / 435 warnings` | no-explicit-any 本轮净减 47（TOP4 文件清零，长尾仍存 122 文件） |
| Python governance | `0 errors / 10 warnings` | `check` 与 `check --base-ref HEAD` 均为 0 ERROR |
| 变更行覆盖率门禁 | 已接入（非阻断起步） | 后端 32.7% / 前端 20.1%（分支重构导致基数大）；关键路径（auth/deps/security/alembic）95% 阈值脚本就绪 |
| UI audit / bundle / prod-smoke 等 | 见 2026-07-24 快照 | 本轮未重跑；合入前需按 §4.1 全量重跑 |
| Markdown 链接 | `104 files / 256 links / 0 missing` | owner、索引、归档和相对链接 |
| Markdown contracts | `10 passed` | 链接、生命周期、Assessment owner 和 workflow 触发 |

### 2026-07-24 非功能文件整理验证

- 后端课堂模块与 smoke 清理定向回归：`97 passed, 8 warnings`；本轮未把该结果写成
  后端全量基线。
- 前端脚本合同：`29 passed`；新增后端 Docker CLI 构建上下文排除和本地 `.codex/`
  Git ignore 回归。
- Workflow contracts：`54 passed`；Markdown 为
  `104 files / 256 links / 0 missing`，合同测试 `10 passed`。
- 7 个维护中的 shell 脚本语法、生产/开发 Compose 配置和 staged/unstaged
  `git diff --check` 均通过。
- Python governance 当前为 `5 errors / 5 warnings`：阻断项位于已有的
  `chat_blocking.py` 和 `chat_stream.py` 长回答功能改动。本轮按非功能文件边界未修改
  相关实现，需在下一阶段单独拆分并恢复 complexity ratchet。

### 2026-07-23 智能体长回答专项

- 后端 `backend/tests/ai_agents`：`62 passed, 9 warnings`；覆盖持续有数据的长流、
  空闲超时、连接提前结束、OpenAI/Anthropic 正常、长度、策略和上下文结束原因、
  Dify 部分输出不重试与终止事件跨分片、DeepSeek Anthropic provider 识别、停用拦截、
  Provider 初始化错误、历史输入边界、当前问题去重、按智能体熔断和阻塞式入口停用拦截。
- 前端 AIAgents：`2 files / 17 passed`；覆盖持续输出、空闲超时、HTTP 502、非流式
  响应、无终止事件、用户停止、导航静默取消、截断终止包和 1000 个高频分片合并。
- TypeScript `tsc --noEmit`、Python `compileall` 和 `git diff --check` 通过。
- Docker 开发栈复核时 backend、PostgreSQL、Redis 均为 healthy；本专项没有调用真实
  外部 AI 端点，因此尚未证明某个具体供应商的账号额度或模型 token 配置。
- 当前结论：固定总时长导致的长回答中断已在代码和本地 stub 回归中修复；真实供应商
  若返回 `finish_reason=length`，系统会明确提示输出长度上限，而不是误报完整成功。
- Docker 开发栈完成真实 HTTP + SSE stub 闭环：管理员登录 `200`、临时智能体创建
  `201`、完整接收 `80000` 字符和 `message_end`、历史缺少本轮问题时只追加一次、
  停用后未再次调用 Provider、客户端 system 历史返回 `422`，临时智能体硬删除 `200`。
- 真实 DeepSeek Anthropic 兼容端点使用 `deepseek-v4-flash` 完成一次受控长流测试：
  `52.661s` 内收到 `3519` 个文本分片、`7063` 个字符，首包 `7.47s`，最大分片间隔
  `0.163s`。上游最终返回 `stop_reason=max_tokens`，WangSh 正确转换为
  `output_limit_reached` 并保留已生成内容；API 密钥仅通过进程 stdin 注入，未写入
  仓库、数据库或测试报告。

- Mindmap 第三方运行时的字体、SVG、图片和打包 JS 保留在当前开发机，但整个目录同时
  排除 Git 和 Docker 构建上下文；Vite 生产构建结束后删除输出中的本地副本，生产
  Caddy 对相关路径明确返回 `404 + no-store`。正式 KaTeX 字体和 `favicon.svg`
  继续保留，不使用会误伤功能资源的全局扩展名规则。当前 Git 索引中的上述静态扩展名
  只剩 `frontend/public/favicon.svg`；生产构建中的 `59` 个 KaTeX 字体和 `1` 个
  Monaco codicon 字体来自正式依赖，不是需要提交的本地第三方目录。`test:scripts`
  会阻止白名单外的高风险静态扩展进入 Git，`build:check` 会直接检查最终产物中的
  favicon、正式字体和 Mindmap 缺失状态。
- Mindmap 用户端和管理端在生产环境均阻止新建/编辑，不会先创建不可编辑记录；已有导图
  统一使用内置查看器只读预览。开发环境仍可在本机运行时存在时使用旧版编辑器。
- 日志脱敏已覆盖 FastAPI、Celery、标准 logging、Loguru、异常链、camelCase 字段、
  多层 JSON 转义、`stacklevel` 调用来源，以及 PostgreSQL、Redis、AMQP/Celery DSN
  的 URL userinfo 密码，专项测试 `25 passed`。
- GroupDiscussion 创建和默认列表使用配置的业务时区，无效 IANA 时区在配置加载期失败；
  `joined_at`、切组冷却和 recent-hours 继续使用 UTC。生产和开发 Compose 均向
  backend、Typst worker、PythonLab worker 显式传入同一 `TIMEZONE`/`TZ`，PostgreSQL
  开发配置同步使用该值；默认值和 `America/New_York` 自定义解析均已验证。
- Docker 开发栈完成 IT 游戏真实 API 闭环：管理员登录、ZIP 上传、空分类更新 `422`、
  分类读取、完整下载、`206 Range`、下载计数、可信代理客户端 IP、管理员日志查询和
  删除清理均成功。上传响应中的 `created_at`、`updated_at` 可直接序列化，下载文件
  SHA256 与原文件一致；后端热重载后的日志未再出现 `MissingGreenlet`、traceback
  或新 5xx，测试分类和游戏记录已清理。
- Assessment 公共画像入口的真实 PostgreSQL 临时 schema 回归只允许安全测试库；
  优先读取 `TEST_DATABASE_URL`，没有专用测试库时明确跳过，不接触业务库。本轮另建
  随机命名的 `wangsh_test_*` 专用数据库执行 Assessment `38 passed`，完成后已删除。
- 详细健康检查要求 HTTP 2xx、有效 JSON 和顶层唯一 `status=healthy`；默认回滚先记录
  并停止三个写服务，再在无写入窗口中备份和 downgrade。停止或备份失败时不 downgrade，
  并尝试恢复停止前原本运行的写服务；恢复失败会明确要求人工处理。
- 删除 2 个永久 skip 的 XBK 墙钟测试；GroupDiscussion 的纯 skip 占位已替换为
  2 个可执行并发冲突回归，并补充 1 个切组提交失败保留旧成员关系的原子性回归。
- 后端通过数从整理前基线下降，原因是删除 Articles、用户 CRUD 和用户导入中的
  14 个空壳用例；这些用例只断言自建对象、常量或 mock 函数，没有覆盖真实项目行为。
  XBK 对应测试已改为真实端点和持久化回归，3 个 PythonLab 文件仅调整目录归属。
- 又删除 7 个 Typst 笔记/PDF 的自测 mock 空壳；保留缓存、哈希、路径安全和真实服务
  边界回归，不把“调用 mock 自己”计入功能覆盖。
- `down-v`、数据库恢复、回滚、XBK seed 和生产 smoke 的破坏性行为均改为显式授权；
  归档索引草案加入 psql 拒绝执行保护。
- 群体画像测评统计已限制为目标班级学生，避免跨班成绩混入。
- GroupDiscussion 并发创建冲突回滚前会保存旧成员的会话 ID，切组清理不再读取
  rollback 后过期的 ORM 对象；旧成员删除与新成员插入使用同一次提交，失败显式
  rollback，避免 `MissingGreenlet` 500 或提前永久退出原组。
- ClassroomPanel 已拆分浮动入口权限与学生参与作用域：管理员和超级管理员显示通往
  `/admin/classroom-interaction` 的管理入口，但不启动学生课堂轮询、计划请求或 SSE；
  学生账号切换仍会清理历史答案，旧异步回调不会覆盖新用户状态。
- ClassroomPanel 当前 8 个定向回归除角色和身份边界外，还覆盖同账号活动刷新乱序、
  旧结果失败覆盖较新活动、历史题统计乱序，以及跨账号手动刷新锁隔离。
- 思维导图编辑器的 iframe 数据保存回归仍保留；此前真实 Chromium 结果只证明当前
  开发机的本地运行时可用，不代表全新 checkout 或生产镜像包含该编辑器。
- `frontend/src/lib/**/*.test.{ts,tsx}` 已纳入 Vitest 默认范围，
  `mindmapRuntime.test.ts` 不再被默认门禁遗漏。
- 前端 lockfile 已恢复缺失的 3 个 `@emnapi/*` 可选 peer 条目并按当前 npm 归一化；
  真实 `npm ci --ignore-scripts` 安装 `779` 个当前平台依赖后，前端全量、脚本合同和
  生产构建再次通过，不依赖旧 `node_modules`。
- `backend/scripts` 显式包标记和真实解析路径均有回归覆盖。
- 无真实引用的旧路径 redirect 和重复历史摘要已删除；SSE 恢复资料和学习平台设计
  取舍保留为精简 archive；5 个失效或重复 seed 执行壳
  已删除，AI/Agents 正式课程内容迁移源继续保留。
- 回滚入口已修复函数外 `local` 和 Compose 环境文件传递；UI smoke 的 `skip-*` 动作
  现在记为 `WARN`，不再误计为 `PASS`。
- `prod-smoke` 缺少 `ui-results.json` 时会把 `ui-smoke` 步骤、汇总状态和退出码统一
  标记为失败，并生成私有权限的失败报告，不再出现报告缺失但进程返回 0 的假通过。
- `pull-up/deploy` 在拉取后逐个核对本地镜像 `RepoDigests`；`up-no-build` 也拒绝
  启动与 release-set 不一致的同标签镜像。详细健康检查新增 frontend 和 gateway，
  部署健康入口同时验证站点首页和 API。
- 本批尚未 commit/push；2026-07-24 审计时本地 `main` 与 `origin/main` 提交点一致，
  但工作区仍包含既存 staged、unstaged 和未跟踪修改。远端 GitHub Actions 和已发布
  镜像不包含这些工作区修改。
- Docker daemon 当前可用，开发 Compose 中 PostgreSQL、Redis 和 backend 均为 healthy，
  前端及 worker 正常运行；本轮已完成上述开发栈 IT 游戏端到端。当前工作树已重建本地
  `shuhao07/wangsh-frontend:1.6.0` 的 `linux/amd64` 生产镜像，并在独立 Caddy 容器中
  验证主页和 favicon 为 `200`、Mindmap 路径为 `404 + no-store`，镜像内 `282` 个文件、
  `60` 个正式字体、`0` 个 Mindmap 文件。其余五个业务镜像重建和隔离生产模拟仍未执行；
  Shell 语法、两份 Compose `config --quiet` 及自定义时区解析已通过。

### 2026-07-23 Docker/API/Chrome 续验

- 当前 Docker 开发栈保持 `7` 个固定服务运行；backend、PostgreSQL、Redis 均为
  `healthy`，前端首页返回 `200`，`/health` 返回 `200`，版本为 `1.6.0`，数据库和
  Redis 检查均为 `healthy`。
- 并行定向 API 复验覆盖 AI 会话列表/详情与 usage 分页、Learning
  Progress/Content/Chapter、Mindmap、ML Book 和 Assessment 分页/统计；修复后的
  会话 schema、Assessment 分页上限和首次 progress 默认 payload 均按真实接口合同
  通过，验证时间窗内没有 `500`、`Traceback`、`ERROR` 或 `CRITICAL`。测试账号、
  fixture、refresh token、Redis 会话键和临时工作区已清理。
- 按 `docs/docker/frontend/UI-PAGES.md` 的核心 `44` 个页面族执行系统 Google Chrome
  巡检，实际覆盖 `45` 个 URL 用例（PythonLab 的无参数和带参数入口均单独覆盖）。
  首轮 `43 PASS / 2 WARN / 0 FAIL` 中的两个 WARN 来自刻意使用不存在的文章 slug 和
  信息学笔记 ID，触发页面自身预期的 `404` 日志，不是运行时崩溃；换用数据库中真实
  的文章 `article-1775356082696` 和信息学笔记 `55` 后，两个详情页均为 `200`、无
  console error、page error 或 `5xx`。随后补测 5 个 Task Analysis 页面族，4 个专用
  结果页/新建页直接通过，通用结果页使用旧类型入口时的 `404` 是预期兼容回退，改用
  无类型入口后通过。最终完整路由族门禁为 `49 PASS / 0 FAIL`，另有 1 个额外
  PythonLab 参数化 URL 通过。
- 本轮没有新增仓库脚本、截图或测试结果文件；未执行 commit、push、Docker Hub
  发布、生产部署或数据库备份。
- 本次续作从当前 dirty worktree 重新运行全量门禁，后端为
  `696 passed, 1 skipped, 9 warnings`，前端为 `75 files / 362 passed`，前端脚本
  `27 passed`，Workflow contracts `54 passed`，TypeScript、版本一致性和
  `git diff --check` 均通过；这些结果替代本节更早的定向通过数作为当前全量基线。
- Docker 有状态 smoke 重新覆盖 users、categories、XBK、AI Agent CRUD、Learning
  content/chapter/progress、Mindmap、ML Book、认证 refresh、文章 CRUD、Assessment
  学生答题、Typst 素材上传与异步 PDF、XXJS 导入清理，所有临时记录均由脚本清理。
- OpenAPI 直连 backend sweep 为 `109 OK / 0 WARN / 0 FAIL / 51 SKIP`；维护中的
  Playwright UI smoke 为 `13 PASS / 0 WARN / 0 FAIL`，每页均为 `0` console error、
  page error、failed request 和 `5xx`。缺失的 Playwright Chromium 运行时已安装到
  用户缓存，报告与截图在结论沉淀后从 `/tmp` 删除。
- PythonLab Docker Worker 的 DAP 步进为 `1/1 PASS`，owner 并发自动识别并验证
  `steal` 行为；会话已停止，动态 sandbox/DAP 容器和 `/tmp` 日志均无残留。
- IT 游戏真实 API 重新覆盖 ZIP 上传、列表、分类更新、公开详情、完整下载 SHA256、
  `206 Range`、下载日志和删除，数据库记录与物理文件均清理。GroupDiscussion 重新
  覆盖建组、发消息、管理员读取和批量删除，并修复批量删除成功时 `deleted` 返回
  `null` 的合同缺陷；当前返回数据库实际删除数量，Docker 回归为 `deleted=1`。
- `smoke_full_deploy.py` 的默认健康地址面向生产网关；Docker 开发模式首次使用
  `/api/health` 得到预期 `404`，在任何写操作前退出，改用 backend `/health` 后全绿。
  本轮临时 IT 和 GroupDiscussion stdin 驱动各有一次仅由驱动断言引起的失败，均已
  明确复跑并验证清理，不计为应用失败。
- 最终 Docker backend、Typst worker 和 PythonLab worker 日志窗口没有
  `ERROR`、`CRITICAL`、`Traceback` 或 `5xx`；7 个固定开发服务继续运行，backend、
  PostgreSQL、Redis healthy，前端 `200`。仓库中没有新增 `test-results`、截图、
  JSON/HTML 报告或一次性 `test_*.py`，开发缓存按既定决定保留。
- 最终定向门禁：后端 `115 passed, 1 skipped, 9 warnings`；前端路由与运行时回归
  `7 files / 16 passed`；前端脚本合同 `27 passed`；TypeScript 通过；Markdown
  `104 files / 253 links / 0 missing` 和 `10 passed`；Python 治理为
  `0 errors / 5 warnings`。`git diff --check` 通过，最近 20 分钟的 backend、Typst 和
  PythonLab worker 日志没有服务性错误或 `5xx`，也没有动态 PythonLab 容器或新增
  `test-results` 产物。

### 2026-07-22 Docker 开发模式全功能复验

- 认证：管理员、教师、学生登录及 `/auth/me` 身份核对均为 `200`；匿名访问受保护入口
  返回 `401`，学生、教师和管理员之间的课堂及讨论管理权限边界按合同返回 `403`。
- OpenAPI sweep：super admin 场景为 `100 OK / 5 WARN / 0 FAIL / 55 SKIP`；WARN
  均为需要额外业务 fixture 或具有流式/参数化边界的非阻断项。
- 公开 API：共执行 `35` 次请求，`31` 个 `200`、`3` 个预期 `401`、`1` 个预期
  `404`，没有 `5xx`。
- UI smoke：首次为 `12 PASS / 1 WARN / 0 FAIL`，由 WARN 定位到
  `/admin/assessment/editor/new` 静态路由没有参数、页面却只把 `id === "new"`
  当作新建模式，导致永久加载。修复并增加路由回归后重跑为
  `13 PASS / 0 WARN / 0 FAIL`，全部页面均无 console error、page error、失败请求或
  异常响应。
- Classroom：教师创建并启动活动和计划、学生读取活动并提交答案、重复提交拦截、实时及
  最终统计、结束、重置和删除闭环通过，正确答案未在活动进行中泄露。
- GroupDiscussion：匿名读取公共配置、学生建组/入组/发言、成员权限、管理员查询与删除、
  配置恢复均通过；本轮没有调用外部 AI 端点。
- PythonLab：Docker worker 下真实运行和多断点连续 `Continue` 两个场景 `2/2 PASS`；
  结束后远端会话为 `0`，无遗留动态 sandbox/DAP 容器。
- 文章缓存隔离：真实序列为 `4 -> 0 -> 4 -> 0`，确认有搜索词、不同搜索词和普通列表
  使用独立缓存分区。
- 清理状态：Classroom 活动/响应/计划、GroupDiscussion 会话/成员/消息/分析和
  PythonLab 动态容器/工作区均无本轮残留。临时账号 `24-27` 已按项目语义软删除，
  refresh token 全部撤销；其 `smoke-*` Typst note、asset 和 PDF 已清理。数据库、
  Redis 和 7 个固定开发服务保持健康，本轮 `/tmp` 浏览器/API 证据在结论沉淀后删除。

### 2026-07-18 本地开发模式真实场景复验

- 通过 `bash start-dev.sh` 重新启动本地开发模式：FastAPI reload、Vite development、
  PostgreSQL、Redis、Adminer 和本地 Celery Worker 均启动成功；本地模式按设计跳过
  Docker PythonLab Worker。
- 真实 API 场景 `29/29` 通过：健康检查、登录、`/auth/me`、refresh rotation、用户
  列表/统计、课堂活动创建/读取/更新/统计/删除、课堂计划创建/列表/删除、测评配置、
  测评可用性、任务分析列表、IT 游戏、XBK 公共配置、PythonLab 语法正确/错误和 CFG
  解析、登出后的 token 失效。
- 管理员真实示例创建的课堂活动和课堂计划均在验证结束后删除，没有留下本轮测试数据。
- 浏览器页面 smoke `13` 个路由中 `12 PASS / 1 WARN / 0 FAIL`；唯一 WARN 是测评
  新建页未找到标题输入框，页面本身加载成功，没有 console error、page error 或失败
  请求。
- PythonLab 本地浏览器场景 `4/4 PASS`：页面/个人程序导航、真实 Python 代码运行、
  单断点 Debug/Continue、双断点连续 Continue；远端 Docker 沙箱调试未在本轮本地模式
  中宣称通过，因为启动入口按设计跳过 `pythonlab-worker`。
- 角色与页面浏览器复验覆盖 `/ai-agents`、6 个公开页面、7 个后台页面和 PythonLab，
  共 15 次路径巡检；修复后均无失败请求、控制台错误或 `4xx/5xx`。`/xbk` 显示
  “未开放”，属于当前功能开关状态，不是页面崩溃。
- `/ai-agents` 管理员场景中课堂浮窗按钮为 0，`/classroom/active`、
  `/classroom/plans/active-plan` 和 `/classroom/stream` 均未发起请求。
- 本轮最终门禁：后端 `645 passed`、前端 `67 files / 341 passed`、前端脚本
  `23 passed`、workflow contracts `36 passed`、TypeScript 通过、UI audit 通过、
  Python governance `0 errors / 4 warnings`、Markdown contracts `101 files / 214 links /
  0 missing`。
- 本轮运行日志没有应用异常；`401` 仅来自未登录探测或登出失效验证，`404
  /openapi.json` 是错误路径探测，`422` 是缺少请求字段的探测，不属于业务回归。
- `uvicorn.access` 日志已增加查询参数脱敏，SSE 的 `token`、`access_token` 和
  `refresh_token` 不再原样写入应用日志；对应单测覆盖多参数 URL。
- `start-dev.sh` 的 PostgreSQL readiness probe 已显式使用配置的 `POSTGRES_DB`；
  从完全停止状态重启后连接 `wangsh_db`，PostgreSQL、后端、前端和 Celery 当前时段
  均无 `ERROR` / `FATAL`，旧的 `database "admin" does not exist` 日志噪声未再出现。
- 原始报告和截图写入系统临时目录后已删除；项目内没有新增 `test-results` 产物。

### 2026-07-16 空库导入复核

- 已发布 `shuhao07/wangsh-backend:1.6.0` 在 `/app` 中可直接解析
  `scripts.bootstrap_db`；缺少 `backend/scripts/__init__.py` 不会导致生产镜像
  `ModuleNotFoundError`，原 P0 判断不成立。
- 仓库根目录执行后端系统测试时，根 `scripts` 包会与 `backend/scripts` 发生导入歧义；
  当前增加显式 package marker 和回归合同作为开发工具链加固。
- 隔离 PostgreSQL 16 空库真实执行 `init_database()`，完整迁移到
  `20260711_0002_restore_legacy_baseline_indexes`，创建 47 张 public 表并成功更新视图。
- 系统导入/迁移专项从仓库根目录通过，后端全量 `665 passed`。

历史提交、clean-runner 和 2026-07-14 发布验证已压缩到
[7 月整理与发布归档摘要](../archive/plans/2026-07-project-consolidation-history.md)；
本文件不再重复维护过期提交流水和旧基线。

## 二、功能测试矩阵

| 域 | 主要验证内容 |
|---|---|
| 认证权限 | 登录、refresh、logout、用户管理、角色路由、深链返回 |
| 课堂与 AI | 活动、计划、分组讨论、Redis Pub/Sub、Celery、深度分析 |
| 数据库 | Alembic 单 head、四条 migration、bootstrap、空库升级 |
| IT 与内容 | IT 游戏、学习平台、信息学、文章、XBK |
| 前端工程 | Vitest、type-check、lint、CSS token、UI audit、bundle |
| PythonLab | Run、Debug、DAP、Continue、owner concurrency、可见性 |
| 发布 | Compose、workflow contract、prod-smoke、日志脱敏、release-set |

## 三、证据与保留策略

生产 smoke 运行时会在 `test-results/prod-smoke/` 生成以下可重建证据：

```text
test-results/prod-smoke/summary.json
test-results/prod-smoke/api-results.json
test-results/prod-smoke/ui-results.json
test-results/prod-smoke/openapi-sweep.json
test-results/prod-smoke/screenshots/
test-results/prod-smoke/step-logs/
test-results/prod-smoke/service-logs/
```

验证摘要沉淀到本文件后，本地证据副本可以清理；发布排错期间可短期保留，但不提交
Git。开发缓存可以继续留在本地复用，不作为正式发布证据。`frontend/build/`、
`coverage/`、`.coverage`、`.pytest_cache/`、`__pycache__/`、临时浏览器
`page-*` / `console-*` 文件和系统临时目录中的 PythonLab 快照均属于本地产物。
任何证据都不得包含有效 token、Cookie、密码或其他密钥。

## 四、待执行验证

- 当前 PR #1 分支为 `release/v1.6.0-audit-fixes`。提交并推送 R6.1 的
  CI-only/test-only 收口后，绑定该新提交复验 `ci-quality`、
  `pr-pythonlab-owner-gate`、`pr-pythonlab-phasec-gate` 与 `markdown-quality`；在 PR
  合并并由 `main` 对应 workflow 运行前，不写成 `main` 已复验。旧 Phase C Run
  `34733799071` 已成功；旧 owner Run `34733799159` 是 runtime 清理时序失败，不是
  secrets 缺失。
- 升级 GitHub Actions action runtime，消除 Node 20 弃用提醒。
- Docker Hub 六镜像和 `release-set.txt` 已通过手工发布链验证；GitHub
  `dockerhub-amd64` workflow 仍需配置 `DOCKERHUB_USERNAME` /
  `DOCKERHUB_TOKEN` 后单独复验。
- 本轮按用户要求不执行数据库备份；正式生产部署前仍需另行完成数据库升级、
  恢复和回滚演练。

## 五、重跑入口

```bash
cd backend
venv/bin/pytest -q
venv/bin/python scripts/check_python_governance.py check

cd ../frontend
npm run test
npm run test:scripts
npm run type-check
npm run lint
npm run build:check

cd ..
node --test scripts/workflow-contracts.test.mjs
docker compose --env-file .env.example -f docker-compose.dev.yml config --quiet
docker compose --env-file .env.example -f docker-compose.yml config --quiet
git diff --check
```

完整生产模拟：

```bash
IMAGE_TAG=1.6.0 \
IMAGE_REPOSITORY_PREFIX=shuhao07 \
SIM_RUN_PROD_SMOKE=true \
SIM_CLEANUP=true \
bash scripts/deploy.sh simulate
```

## 2026-09-15 Gateway 风险整改（生产候选，隔离验证）

- `gateway/Caddyfile` 增加 Caddy 2.8.4 原生请求头上限 `64KB`、server 读取/写入/空闲超时，以及反代 dial、响应头、读取、写入和 keep-alive 超时。
- 未加入未经验证的第三方 `rate_limit` 指令；通用 IP/并发限速继续要求由受信任 WAF/LB/API Gateway 提供。
- `gateway/tests/test_caddy_config.sh` 通过 Caddy Docker 镜像执行配置合同检查和 `caddy adapt --validate`。
- 本轮隔离 Docker 已记录独立宿主端口、`413`、`431`、上游超时、`/api/health` 健康检查和前端反代结果；另发现部分超限请求前缀可能到达 upstream，因此 `413` 仅表示客户端最终拒绝，不能证明零转发。未访问正常端口、未部署生产。

## 2026-09-15 WangSh 2.1 发布前全量回归（本地隔离）

- 使用独立 PostgreSQL 16 容器 `wangsh-release21-pg`，仅绑定回环地址
  `127.0.0.1:55433`；未连接开发数据库或正式数据库。
- 空库已执行 initial bootstrap、Alembic `upgrade head` 与应用 bootstrap，迁移状态只读预检确认
  当前单一 head 为 `20260914_0001_xbk_active_selection_unique`。
- 修复 schema-aware 迁移预检合同后，后端全量回归最终为
  `3183 passed / 183 skipped / 2468 warnings / 0 failed`，覆盖率 `66%`，耗时
  `125.77s`。警告主要为既有 Pydantic、SQLite 和依赖弃用提示，不阻断本次候选发布。
- Python governance 普通检查和 `--base-ref origin/main` 均为
  `errors=0 / warnings=28`；版本一致性为应用 `2.1.0`、镜像标签 `2.1`；Docker workflow
  contracts 为 `56 passed / 0 failed`。
- 六个 `linux/amd64` 本地候选镜像已构建并通过 `verify-local-images`；`2.0` 六镜像回滚集完整保留。
- 使用 `SIM_VERSION=2.1 SIM_RUN_PROD_SMOKE=true SIM_CLEANUP=true bash scripts/deploy.sh simulate`
  完成一次性真实生产模拟：`14` 个步骤中 `12 PASS / 2 WARN / 0 FAIL / 0 SKIP`。管理员登录、
  AUTH 被替换登录、用户、文章、XBK、点名、测评、课堂/智能体、小组讨论、Typst、PythonLab
  owner/DAP/print 和产品 UI 均通过；OpenAPI 只读扫描的两个模型发现接口按权限返回 `401`，空白
  模拟库没有稳定学习内容和 ML book 可执行原数据恢复验证，因此汇总为非阻断 WARN。
- 模拟前在空白一次性库显式完成 AUTH authority enrollment，结果为
  `already_ready=0, preserved=0, reauthenticate=0`；模拟结束后容器、网络和数据卷均由脚本清理。
  该夹具不适用于正式数据库。
- Docker Hub manifest、release-set 与 GitHub Actions 结果将在远端步骤真实完成后补充，不提前宣称通过。
