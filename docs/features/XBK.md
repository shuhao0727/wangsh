# XBK 校本课选课系统

> 最后更新：2026-09-10

## 导入恢复与取消事务的责任边界

- 导入恢复软删除数据须保持目标行身份及其他学年/学期的数据不变；后段 SQL 失败后的 rollback、同 session 重试和取消清理是不同合同，不用单一“导入通过”概括。
- `import_data` 在预检以及写入/提交阶段分别捕获 `asyncio.CancelledError`，显式 `await db.rollback()` 后原样抛出取消，不转换为成功响应或普通 HTTP 错误。一次取消且清理未再受中断时，直接调用并保留 session 的调用方也能结束失败事务、再发起导入；没有修改自然键或数据迁移政策。
- 正常请求的真实 `get_db` 依赖退出仍经 `AsyncSession.__aexit__/close` 清理。R4 的 SQLite retained-caller 失败曾属于更强合同缺口，并不证明正常 HTTP 持久化损坏；R5 在此基础上补充 PostgreSQL/asyncpg 在途查询、父行锁等待和延迟提交内取消的维护回归，验证独立 reader、锁释放及重试。
- **重复取消与提交确认边界**：第二次 `Task.cancel()` 可中断 rollback；本函数不使用无界 shield 或吞掉取消来承诺绝对清理。保留 session 的调用方此时仍须在自身清理上下文中 rollback/close，再复用。维护用例另核验 rollback 被第二次取消中断后真实 ASGI 依赖退出的清理。数据库已经提交、但客户端未收到响应时，不能靠后续 rollback 撤回提交，也不能把“请求断开”等同于“导入未生效”。
- 真实 TCP 断连测试区分两条路径：已上传请求的客户端离开后，服务端可继续完成导入；显式服务端任务取消时，依赖退出结束未完成事务并可重试。测试中的显式取消不是声称 Uvicorn 会自动取消断连请求，也不改变当前请求生命周期策略。
- 维护入口：`backend/tests/xbk/test_r4_import_restore_transaction.py` 保留 SQLite 故障模型；`backend/tests/xbk/test_xbk_import_cancellation_pg.py` 仅允许专用 `postgresql+asyncpg` 测试库和唯一合成 schema，TCP 分支还要求显式分配回环端口。必须经清环境、禁 dotenv、限制连接与写路径的外部运行器执行，不能普通未隔离 pytest 直跑。动态结果与证据统一见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

### 导出文件与 Excel 客户端验收

应用导出采用同一筛选条件和显式文本单元格，保留前导零、长学号及以 `= + - @` 开头的字面文本；合成名册的 HTTP 导出产物与工作簿结构核验不能代替 Microsoft Excel 实际打开。通用导出的 `data` 与孤立选课 `diagnostics` 分表，后者不冒充有效名单；打印用分发表不要求具有通用导出相同的自动筛选布局。Excel 客户端实际打开、筛选与文本显示的本批证据由 [TEST_STATUS](../docker/testing/TEST_STATUS.md) 统一记录，真实业务名册与大规模性能不由合成样本推断。

## 并发写入与父实体删除（2026-09-09）

- 手工创建、恢复、修改选课及导入 execute，按学生 SHARE → 课程 SHARE → 子行 UPDATE 的顺序持锁，并在等待后刷新 ORM、重验同期间有效父实体；同表按不可变 ID 排序，跨分块保持顺序。使用 SHARE 而非 KEY SHARE，避免软删除非键更新穿过检查。
- 父实体删除先锁父再级联；批量删除冻结目标 ID，后续只删除冻结集合，新插入父实体不被此次级联误纳入。原单行软删除与批量硬删除语义不变。
- preview 只是快照，不预留名额或承诺 execute 成功；execute 的严格校验失败或全部行无效时立即 rollback 释放预检锁。其他请求业务错误仍要求调用方结束事务。
- 保证限于 PostgreSQL READ COMMITTED 下使用此协议的合作入口。导入持锁至事务结束，删除可能等待；未做生产规模性能和混版本验证。没有新增 FK 或 schema migration，直接 SQL/旧代码绕过入口不受保证。
- **自然键更名仍待规则决定**：有关联选课时修改学号、课程代码或期间应拒绝还是事务同步迁移，不能由本次锁修复替用户决定；锁本身不能防止更名造成历史关联失联。真实名册与 Excel 实际打开仍独立验收。
- 测试结果统一见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。

## 概述

XBK（校本课）模块是一个完整的校本课程选课管理系统。支持学生名单维护、课程目录管理、选课结果录入与分析，并提供 Excel 批量导入/导出功能。通过 Feature Flag 控制前台公开访问，非公开状态下仅管理员可操作。

### 核心功能

- **学生管理**：学生名单的增删改查，支持按学年、学期、年级、班级筛选
- **课程管理**：校本课程目录维护，含课程代码、任课教师、限额、上课地点
- **选课管理**：学生选课记录录入与编辑，LEFT JOIN 方式确保全部学生可见
- **数据分析**：汇总统计、课程分布、班级分布、未选课/空选课学生查询
- **Excel 导入/导出**：模板下载、预览导入、PostgreSQL upsert 执行导入、三种导出格式
- **软删除**：全部数据使用 `is_deleted` 标记实现软删除
- **Feature Flag 公开控制**：通过 `xbk_public_enabled` 开关控制前台可见性

---

## 架构设计

### 导入与导出职责边界

CSV/Excel 输入解析和预览/执行共同使用的整文件校验 helper 位于 `backend/app/api/endpoints/xbk/_import_parsing.py`；`import_export.py` 保留路由、事务编排和原子身份核验。无效行仍参与重复键/混合学期检查，身份冲突仍回滚整批；拆分不放宽校验或改变自然键更名规则。教师分布导出按查询、分组和工作表渲染拆分 helper，保持显式文本类型、CR/CRLF、自然班级次序及原页面方向。

### 数据模型

**核心表**（均使用软删除 `is_deleted`）：

- `xbk_students` (XbkStudent) -- 学生名单
- `xbk_courses` (XbkCourse) -- 课程目录
- `xbk_selections` (XbkSelection) -- 选课记录

**XbkStudent 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `year` | String(9) | 学年（如 `2026-2027`） |
| `term` | String(20) | 学期（上学期/下学期） |
| `grade` | String(20) | 年级（高一/高二） |
| `class_name` | String(50) | 班级名称 |
| `student_no` | String(50) | 学号 |
| `name` | String(50) | 姓名 |
| `gender` | String(10) | 性别 |
| `is_deleted` | Boolean | 软删除标记 |

唯一约束：`(year, term, student_no)`；`year` 受连续学年 CHECK 约束。

**XbkCourse 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `year` | String(9) | 学年（如 `2026-2027`） |
| `term` | String(20) | 学期 |
| `grade` | String(20) | 适用年级 |
| `course_code` | String(50) | 课程代码（如 12） |
| `course_name` | String(200) | 课程名称 |
| `teacher` | String(100) | 任课教师 |
| `quota` | Integer | 限报人数，默认 0 |
| `location` | String(200) | 上课地点 |
| `is_deleted` | Boolean | 软删除标记 |

唯一约束：`(year, term, course_code)`；`year` 受连续学年 CHECK 约束。

**XbkSelection 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `year` | String(9) | 学年（如 `2026-2027`） |
| `term` | String(20) | 学期 |
| `grade` | String(20) | 年级 |
| `student_no` | String(50) | 学号 |
| `name` | String(50) | 姓名快照 |
| `course_code` | String(50) | 课程代码 |
| `is_deleted` | Boolean | 软删除标记 |

唯一约束：`(year, term, student_no, course_code)`；`year` 受连续学年 CHECK 约束。

### 加载失败展示

统计或列表接口失败不等于没有业务数据：页面持续显示失败和重试入口，统计用横线表示未知，失败列表隐藏旧记录及分页；只有相关刷新请求全部成功才提示成功。筛选元数据失败保留上次成功选项及已选班级，不据失败清空班级或扩大请求范围；成功元数据仍按原规则校验班级有效性。

## 学年结构兼容与升级

当前代码要求三个 XBK 表的 `year` 为 `VARCHAR(9)`，既有整数年份数据库需通过
`20260908_0001_xbk_academic_year` 迁移升级。该迁移仅将 `2026` 等起始年份转换为
`2026-2027`，保留行身份、学期及关联键的其他部分；不把历史 `term="1"` 自动合并到
`上学期`。学期数据对账须另行确认业务规则。

开发容器热加载源码不等于升级数据库。若 `summary`、`meta`、`course-results` 同时报
`operator does not exist: integer = character varying`，先只读检查实际列类型和
`alembic_version`，不要通过返回空数据或临时截取请求年份规避结构不匹配。
备份、目标 revision 升级及回滚要求见
[部署文档的数据库迁移策略](../docker/deploy/DEPLOY.md#数据库迁移策略)。

### 虚拟行处理

选课管理（selections）和选课结果（course-results）端点使用 LEFT JOIN 确保所有学生都出现在结果中：

- **有选课记录的学生**：正常显示选课信息，支持 PUT/DELETE 操作
- **无选课记录的学生**：构造 `id=0` 的虚拟行，`course_code` 显示为 "休学或其他"
- **有选课记录但 course_code 为空的学生**：显示为 "未有选择" 或 "未选"

仅 `id > 0` 的真实记录支持编辑和删除操作。

### 权限控制

- **公开模式**（Feature Flag `xbk_public_enabled` 为 true）：所有用户可查看数据，管理员可编辑
- **非公开模式**：仅 `admin` / `super_admin` 角色可访问
- 修改操作（增删改、导入导出）始终需要管理员权限

---

## API 端点

完整路径、认证要求和请求合同统一维护在
[API 文档](../development/API.md) 的“选课系统”章节，本功能文档不再复制端点表。

当前接口按学生、课程、选课、分析、批量操作、公开配置和导入导出拆分。公开读取仍受
`xbk_public_enabled` 控制，所有写操作始终要求管理员权限；导入导出的业务语义见下节。

---

## Excel 导入导出

### 导入流程

1. **模板下载**：按 scope 下载对应模板，标准列名为“学年”；导入仍兼容旧“年份”和英文 `year` 别名
2. **预览导入**：上传 Excel 文件，服务端逐行验证，返回 `valid_rows`/`invalid_rows`、列名、`preview` 数据和 `errors` 详情
3. **执行导入**：
   - Students：`ON CONFLICT (year, term, student_no) DO UPDATE`
   - Courses：`ON CONFLICT (year, term, course_code) DO UPDATE`
   - Selections：`ON CONFLICT (year, term, student_no, course_code) DO UPDATE`
   - 支持 `skip_invalid` 参数跳过无效行

### 导入校验与交互约定

- 推荐 `.xlsx`；CSV 支持 UTF-8（含 BOM）和 GB18030。学号、课程代码按文本读取，保留文本前导零。真正的旧版 `.xls` 需要 `xlrd`；缺少引擎时返回转换为 `.xlsx` / CSV 的明确提示，不保证所有 Docker 镜像都支持旧格式。
- 文件中非空的学年、学期、年级优先；缺列或空单元格使用页面筛选对应的 `year` / `term` / `grade` 默认值。最终学年和学期必须有值，年级仍可选。四位起始年份（如 `2026`）会规范化为 `2026-2027`，不连续区间（如 `2026-2028`）拒绝。
- 单文件最多 10 MiB，Excel 解压后最多 50 MiB；最多 50,000 数据行、100 列。拒绝重复/别名冲突表头、无表头数据列、缺失必要列和损坏文件；行校验包含连续学年格式、非负整数限额、字段长度及空字符。
- 预检与执行共用校验规则。只有当前文件、导入类型和默认值对应的最新预检成功且存在有效行，才允许提交。严格模式存在无效行时不能提交；跳过错误行模式仅写有效行。切换文件或默认值会重新预检，过期请求不得覆盖当前结果。
- 上传预检失败后保留可见错误，可移除文件或重选（包括同名文件）重试；提交期间锁定范围、关闭和重复提交，成功后刷新列表。
- 严格模式在写入前完成整份文件校验，数据库异常回滚。单文件自然键重复时整份拒绝（422），不再末行覆盖；开启“跳过错误行”也不能绕过。学生自然键是 `(year, term, student_no)`，学号必须在同一学期跨班级、跨年级唯一，班内序号不能直接作为学号。课程按学年/学期/代码、选课按学年/学期/学号/课程代码判断重复。
- 单文件只能包含一个学年/学期组合（应用默认值和学年规范化后判断），混合时期返回 422，防止 Excel 学年列误写多个时期；单一时期的文件非空值仍优先于页面默认值。
- 学生预检及执行都检查现存自然键（包含软删除记录）：姓名不同或双方非空年级不一致时整份拒绝 422。同一学生允许重复导入更新班级/性别并恢复软删除记录；更正姓名/年级需明确编辑原记录，不用批量导入替换身份。执行学生 upsert 时还在 `ON CONFLICT DO UPDATE WHERE` 内重新核对姓名与非空年级，按与 Python strip 一致的空白规范化兼容历史记录；冲突未返回记录即拒绝并回滚整份文件，包括此前已写行，`skip_invalid` 不绕过。新增/更新计数仍依据写前快照，合法同键并发下计数不是精确的 INSERT/UPDATE 分类。
- 手工 POST/PUT 与导入共享写入字段校验：去首尾空白、必填/长度/NUL、可选空值及非负整型限额（拒绝布尔、小数、非有限数和超出数据库整数范围的数值）。不对历史输出模型追加写入约束。
- 选课手工写入、预检及执行均检查同学年、同学期、未删除的学生和课程；手工缺失父实体保持 404，导入作为带行号的无效行（严格模式 422，跳过模式不写该行）。空课程/“未选”规范为“未选”，只需有效学生，不要求创建虚假课程。姓名与年级快照不是关联键，不另拒绝跨年级课程。
- preview 的父实体校验仍是分批查询快照；手工写入与 execute 已按上文 SHARE 锁协议等待后重验，并持锁至事务结束，不能再视为无并发删除保护。该保证不是外键，也不覆盖绕过协议的其他入口、旧代码或直接 SQL。自然键改号拒绝还是级联迁移仍须另定合同；未迁移或修复真实名册。

### 删除与统计边界

- 批量删除必须明确学年和学期；有班级筛选时禁止删除“全部”或“选课目录”，以免删除其他班级共享课程。前端禁止相关选项并解释原因，不自动改变用户选中的删除范围。
- 删除学生/课程时同步删除同年份、学期自然键关联的选课数据；年级快照过期不应遗漏关联行。批量清理也覆盖当前范围内的空选课或孤立记录。
- 班级身份使用 `(grade, class_name)`，跨年级同名班级不合并。年级与班级筛选从有效学生名册解析实际作用域；不存在的年级/班级组合不返回该年级课程。
- 课程统计以有效课程目录为主表，因此 0 人课程仍显示，已删除课程和孤立课程代码不进入真实课程行。课程容量按“各班限报人数 × 课程所属年级的班级数”计算；指定班级时，每个匹配年级的 `class_count` 均为 1。摘要课程数与相同筛选下的真实课程统计行数保持一致。
- 涉及学生的统计以有效学生名册为准，排除已删除或无有效学生的选课记录。无选课记录为“休学/其他”，课程代码为空串或导入标记“未选”的记录均为“未选”；统计合并这两种存量表示，不迁移或改写业务数据。未选列表、分析明细与导出保持一致；跨学期不能互相抵消。
- 编辑触发唯一键冲突时返回 409。更换已有记录的年份、学期、学号或课程代码仍需谨慎：自然键变更尚无统一级联迁移合同，不应当作无损改号工具。

### 导出文本安全

所有 XBK XLSX 导出在保存前将字符串单元格显式保存为文本类型及文本格式，保留前导零、原始空白与内容，不加单引号或删改公式前缀；数字计数仍是数字，既有应用数据验证保留。覆盖基础数据表及学生选课表、班级/教师分发表。工作簿结构回读不等于 Microsoft Excel 实际打开验收；历史文件不自动重写。

选课表（course-selection）的课程目录与班级工作表启用**编辑保护密码**：密码来自
`settings.XBK_EXPORT_SHEET_PASSWORD`（环境变量同名），当前默认值与本批次导出模板保持一致；
仅防止误改、不构成文件加密。生产部署应在 `.env` 覆盖该环境变量并定期轮换。

### 导入模板与字段约定

- 学生名单、课程目录、学生选课结果分别通过 `/xbk/import/template` 下载对应模板；第一张 `template` 工作表只放可导入表头，第二张“示例与说明”工作表用于解释字段规则，不参与导入。
- 学年必须使用 `xxxx-xxxx` 格式，例如 `2026-2027`；学号和课程代码按文本处理，避免前导零或长数字被 Excel 转换。
- 为避免不同年级的自然键冲突，建议学号使用年级前缀（例如 `G1-101`、`G2-101`），课程代码使用年级前缀和两位课程号（例如 `G1-09`、`G2-09`）。
- 课程目录的“各班限报人数”兼容原始字段别名“限报人数”和“课程人数”，并要求为非负整数。
- 导入顺序固定为：学生名单 → 课程目录 → 学生选课结果；选课结果中的学生和课程自然键必须已经存在于同学年、同学期的父记录中。

## 导出格式

- 表格导出必须明确学年与学期；同一个规范学年同时用于数据筛选和标题，缺失时禁止提交，不静默代入默认值。导出中禁止重复提交、修改条件或关闭弹窗。
- 普通 `selections` / `course_results` 的 `data` 导出**当前筛选全集，不限当前分页**：从有效学生名册出发，按同学年、同学期、学号 LEFT JOIN 有效选课。无有效选课（含只有软删除选课）也有一行，课程代码为 `休学或其他`；已有选课的空课程代码显示 `未选`，显式 `未选` 保留，多选保留多行，不按学生去重。
- `data` 的学年、学期、年级与班级筛选作用于当前有效名册；搜索匹配当前学号、姓名、班级，不因选课快照姓名、课程或教师额外混入主表。两个 scope 的导出年级均取名册当前值，NULL/空串显示为空，不回退选课快照。
- 姓名字段有意保留差异：`selections` 已有选课用选课姓名快照，虚拟行用当前名册姓名；`course_results` 始终用当前名册姓名。`selections` 页面列表的已有选课仍展示快照年级，故行集合/筛选一致**不等于列表与导出每个字段完全相等**。
- 无有效学生名册的有效选课（含学生已软删除）单列于 `diagnostics`，不混入 `data`，也不删除数据库记录。诊断表按选课快照学年、学期、年级筛选，保留快照姓名及旧搜索口径：学号、课程代码、快照姓名；`course_results` 还匹配课程名、教师、地点。指定非空班级筛选时，诊断表为空，因为孤立选课不能归入有效名册班级。
- 有有效学生但课程缺失/软删除的选课仍在 `data`，保留原课程代码；`course_results` 的课程名称按既有逻辑回退为 `未选`，不误归为名册孤立诊断。
- **两 sheet 兼容提醒**：这两个 scope 始终输出 `data`、`diagnostics`，空表也保留各 scope 的稳定列头，并同样应用样式与文本安全处理。原先只读第一 sheet 获取孤立诊断的消费者必须改读 `diagnostics`；主表搜索与行集合也已调整，不能宣称完全向后兼容或把两个 sheet 合并后当作页面列表。
- 主表与诊断表分别查询，不承诺并发写入时二者来自同一数据库快照；大名册性能、Excel 实际打开及最终镜像/浏览器下载另行验收，结果见 [TEST_STATUS](../docker/testing/TEST_STATUS.md)。
- **course-selection**（学生选课表）：按名册与课程目录生成待填写的空白选课表，含课程代码/限额校验；课程目录及班级表启用工作表编辑保护，仅课程代码填写区域解锁；标题学年直接由规范 `year` 解析，不再单独提交 `yearStart` / `yearEnd`
- **distribution**（各班分发表）：按班级分布的选课统计
- **teacher-distribution**（教师分发表）：按教师分布的选课统计

使用 pandas + openpyxl 生成，含格式化（表头样式、自动筛选、列宽自适应、冻结窗格）。

---

## 前端页面

### 管理后台

- `/admin/xbk` -- XBK 管理主页面（AdminLayout）

**6 个 Tab 页签**：

| Tab | 标识 | 功能 |
|-----|------|------|
| 选课结果 | `course_results` | 三表联合视图，展示学生-课程-教师完整信息 |
| 学生管理 | `students` | 学生名单 CRUD |
| 课程管理 | `courses` | 课程目录 CRUD |
| 选课管理 | `selections` | 选课记录 CRUD，含虚拟行 |
| 未选课学生 | `unselected` | 查询存在空课程选课记录的学生 |
| 休学/其他 | `suspended` | 查询完全没有选课记录的学生 |

### 公开页面

- `/xbk` -- 公开选课查看页面（BasicLayout，需 Feature Flag 开启）

### 核心组件

**位置**：`frontend/src/pages/Xbk/`

| 文件 | 说明 |
|------|------|
| `index.tsx` | 主页面，Tab 切换、筛选栏、数据表格、工具栏 |
| `types.ts` | TypeScript 类型定义 |
| `className.ts` | 班级名称格式化工具（如 "高一(1)班"） |
| `components/XbkEditModal.tsx` | 新增/编辑弹窗（学生、课程、选课通用） |
| `components/XbkImportModal.tsx` | Excel 导入弹窗（预览 + 执行） |
| `components/XbkExportModal.tsx` | Excel 导出弹窗（格式选择） |
| `components/XbkDeleteModal.tsx` | 批量删除弹窗 |
| `components/XbkAnalysisModal.tsx` | 数据分析弹窗（汇总 + 图表） |
| `hooks/useXbkFilters.ts` | 筛选状态管理 Hook |
| `hooks/useXbkPagination.ts` | 分页状态管理 Hook |

**服务层**：
- `frontend/src/services/xbk/data.ts` -- 数据 CRUD API 封装
- `frontend/src/services/xbk/publicConfig.ts` -- 公开配置 API

---

## 使用场景

### 场景 1：新学期选课准备

1. 管理员在管理后台切换到目标学年和学期
2. 导入学生名单（下载模板 -> 填写 -> 预览 -> 执行导入）
3. 导入课程目录（同上流程）
4. 设置 XBK 公开开关（可选，控制学生端是否可见）

### 场景 2：录入选课结果

1. 管理员在「选课管理」Tab 中逐条新增学生选课记录
2. 或通过 Excel 批量导入选课结果
3. 在「选课结果」Tab 中查看完整的学生-课程-教师映射

### 场景 3：分析选课数据

1. 打开数据分析弹窗，查看汇总统计（总人数、已选、未选、休学）
2. 查看课程分布：每门课的选课人数 vs 限额 vs 允许总人数
3. 查看班级分布：各班学生人数统计
4. 导出 Excel 报表（选课表 / 班级分发表 / 教师分发表）

### 场景 4：数据清理

1. 使用批量删除功能，按 scope（all/students/courses/selections）清理指定学年、学期的数据
2. 单条删除仅做软删除（`is_deleted=True`），数据可恢复

---

## 相关文件

### 后端

- `backend/app/api/endpoints/xbk/__init__.py` -- 路由注册
- `backend/app/api/endpoints/xbk/_common.py` -- 共享依赖（权限校验、通用过滤）
- `backend/app/api/endpoints/xbk/students.py` -- 学生 CRUD
- `backend/app/api/endpoints/xbk/courses.py` -- 课程 CRUD
- `backend/app/api/endpoints/xbk/selections.py` -- 选课 CRUD + 选课结果查询
- `backend/app/api/endpoints/xbk/analysis.py` -- 数据分析端点
- `backend/app/api/endpoints/xbk/bulk_ops.py` -- 批量删除 + 元数据
- `backend/app/api/endpoints/xbk/public_config.py` -- 公开配置端点
- `backend/app/api/endpoints/xbk/import_export.py` -- 导入导出端点
- `backend/app/api/endpoints/xbk/exports.py` -- 多表汇总导出端点
- `backend/app/models/xbk/` -- 数据模型
- `backend/app/schemas/xbk/` -- Pydantic schemas
- `backend/app/services/xbk/` -- 业务逻辑服务
- `backend/app/services/xbk/exports/` -- Excel 导出构建器

### 前端

- `frontend/src/pages/Xbk/index.tsx` -- 管理主页
- `frontend/src/pages/Xbk/types.ts` -- 类型定义
- `frontend/src/pages/Xbk/components/` -- UI 组件
- `frontend/src/pages/Xbk/hooks/` -- 自定义 Hooks
- `frontend/src/services/xbk/data.ts` -- API 服务
- `frontend/src/services/xbk/publicConfig.ts` -- 公开配置 API

### 测试

- `backend/tests/xbk/test_xbk_students.py`
- `backend/tests/xbk/test_xbk_courses.py`
- `backend/tests/xbk/test_xbk_selections.py`
- `backend/tests/xbk/test_xbk_structure.py`
- `backend/tests/xbk/test_xbk_import_export_rules.py`

---

## 最佳实践

1. **先导学生再导课程**：选课导入依赖学生和课程已存在，先确保基础数据完整
2. **使用模板导入**：下载模板后填写，避免列名不匹配导致的导入错误
3. **预览后再执行**：导入前先预览，确认数据无误后再执行正式导入
4. **定期数据清理**：利用批量删除功能清理过期数据，注意必须指定学年和学期
5. **公开开关谨慎使用**：确认数据准备完毕后再开启 Feature Flag，避免学生看到不完整数据
6. **关注休学学生**：选课分析中 `suspended_count` 和 `unselected_count` 含义不同，休学学生（无任何选课记录）需要单独关注

---

## 相关文档

- [API 参考](../development/API.md)

### 文本导出的 XML writer 兼容边界

所有当前 XBK 导出须在填充工作表完成后执行 `force_text_cells` 或 `force_text_workbook`，数值统计保持数值。含 CR 的工作簿仅在该实例的 `save` 路径增加 ZIP XML 适配，将原始 CR 写为字符引用，避免无 lxml 时 CR/CRLF 在回读中归一成 LF；不修改全局 openpyxl writer。该保证限合法 XML/Excel 长度内文本，不承诺非法控制字符、write-only 工作簿或绕过实例直接调用底层保存函数。含 CR 会增加一次内存缓冲与重压缩，大名册峰值内存/耗时及真实 Excel 打开仍需验收。
