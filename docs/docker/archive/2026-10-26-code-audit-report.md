# 代码审查与瘦身计划：整体报告

> 状态：archived
> Owner：project-governance
> 最近复核：2026-10-26

> 历史说明：本文是改动落地当时（未提交状态）的快照，行数和测试数字只代表那一刻。

> 时间：2026-10-26
> 工作树：`beautiful-satoshi-b71479`（分支 `claude/affectionate-shirley-640fd1`）
> 规则出处：[`.claude/code-audit-rules.md`](../../../.claude/code-audit-rules.md)
> **状态：改动全部完成并通过验证，但尚未提交。**

## 一、目标与约束

用户提出四个目标：提高效率与响应速度、拆分过于复杂的函数、拆分过大的文件、删除垃圾代码。

执行约束（用户确认）：

| 项 | 决定 |
|---|---|
| 允许改动的范围 | 四类全做 |
| 验收标准 | 必须真实测试，不接受"应该没问题" |
| 批次粒度 | 每批最多 3 个文件 |
| 修改前基线 | 必须实测，不能凭假设 |

## 二、总账

> 最终数据（2026-10-26 收尾时复测）。

| 指标 | 开工前 | 现在 | 变化 |
|---|---|---|---|
| 改动文件数 | — | 70（57 个已跟踪改动 + 13 个新增） | — |
| 代码增删（已跟踪） | — | +1,680 / −3,734 | **净删 2,054 行** |
| 后端文件 / 行数 | 359 / 59,396 | 361 / 59,203 | +2 文件，−193 行 |
| 前端文件 / 行数 | 548 / 105,462 | 551 / 105,738 | +3 文件，+276 行 |
| 后端测试 | 3647 passed / 123 skipped | 3646 passed / 123 skipped | −1（删除死代码测试，非回归；口径见阶段 1） |
| 前端测试 | 774 passed | 774 passed | 持平 |
| 治理 errors | 0 | 0 | 持平 |
| 前端构建 | echarts 全量导入 1,035,150 B (1010.89 KiB) | echarts 584,082 B (570.39 KiB) | 首屏减轻 43.6% |

前端行数略增，是因为拆分出的新文件带了独立文件头注释，同时新增了热点问题归类相关组件和防护性注释。

### 净删除量的构成（按文件）

| 文件 | 增 / 删 | 性质 |
|---|---|---|
| `HotAnalysisResultPage.tsx` | +100 / −1,091 | 热点归类重构，旧的 Bloom 诊断渲染整体移除（1,285 → 128 行） |
| `Xbk/index.tsx` | +33 / −751 | 列定义与筛选栏抽成独立模块（1,997 → 1,279 行） |
| `hot_agent.md` | +63 / −303 | 文档重写 |
| `hot_agent.py` | +359 / −235 | 归类模块重写 |
| `session_service.py` | +172 / −196 | `submit_answer` 拆分 |
| `analysis_helpers.py` +8 / −145、`llm_agent_base.py` 250 → 175 | — | 旧热点诊断辅助函数与 LLM 流式死函数删除 |

> 数据演进：初稿 67 文件 / −1,998 行；修订稿 69 / −1,983；最终 70 / −2,054。每轮都按实际情况重测，未沿用旧数。

## 三、分阶段结果

### 阶段 1：死代码清理 —— **已完成（删除 8 个函数）**

16 个候选逐个复检后：**8 个确认零引用并已实际删除**，7 个为误报（仍有引用，保留），1 个（`create_refresh_token`）属公共 API 不应删。

| 已删除（HEAD 有定义，工作树已无） | 保留（候选误报，实际仍有引用） |
|---|---|
| `check_and_auto_end` | `_enqueue_auto_analysis`(6)、`_mark_analysis_enqueue_failed`(4) |
| `analyze_fill_blank_stats` | `_slugify`(2)、`_truncate_utf8`(2) |
| `_build_dify_progress_log` | `_compile_typst_project_to_pdf_bytes`(2) |
| `_nonempty_chunks` | `_roster_sort_key`(3) |
| `call_llm_stream` | `_save_preserving_carriage_returns`(3) |
| `cluster_terms` | `create_refresh_token`（公共 API，测试在用，不删） |
| `_parse_int` | — |
| `set_print_a4_landscape` | — |

删除位置（HEAD 版行号，均可在 `git diff HEAD` 的删除行中核对）：

| 函数 | HEAD 位置 |
|---|---|
| `check_and_auto_end` | `classroom.py:353` |
| `analyze_fill_blank_stats` | `classroom.py:423` |
| `_build_dify_progress_log` | `agents/ai_agent.py:141` |
| `_nonempty_chunks` | `agents/chat_stream_dify_helpers.py:206` |
| `call_llm_stream` | `agents/llm_agent_base.py:49` |
| `cluster_terms` | `agents/agent_analysis_events.py:184` |
| `_parse_int` | `xbk/exports/course_selection.py:40` |
| `set_print_a4_landscape` | `xbk/exports/common.py:129` |

候选误报的原因是初版检测只扫了 `backend/app`，漏掉了测试与脚本里的引用。

**后端测试 3647 → 3646 的那 1 个，正是删死代码连带删掉的测试。** 具体为 `backend/tests/classroom/test_classroom_service.py` 中的 `test_manual_analysis_can_reclaim_failed_status`，它调用的就是已删除的 `classroom_svc.analyze_fill_blank_stats`。该测试随被测函数一起移除，属预期结果，不是回归。

### 测试口径说明

`3646 passed / 123 skipped` 是**设置了 `TEST_DATABASE_URL`** 时的读数；未设置该变量时为 `3527 passed / 242 skipped`。两组总数均为 **3769**，差额 119 全部落在 skipped，即被该变量门控的用例。两者不可直接相减，对比时须锁定同一口径。

`tidy.ts` 的 `computeTidy` 只被 `tidy.test.ts` 引用，属于典型"疑似死代码"，但本轮未处理（PythonLab 前端，不在改动范围）。

### 阶段 2：重复实现合并

| 问题 | 处理 |
|---|---|
| LLM 调用有三份手写实现 | `agent_analysis.py` 改为调用统一的 `call_llm()`，删掉 32 行重复请求代码 |
| SSE 响应模板分散在各端点 | 抽出 `backend/app/core/sse.py`，提供统一带心跳的 SSE 响应 |
| XBK 导入报错判定重复 | 抽出 `backend/app/api/endpoints/xbk/import_errors.py` |

### 阶段 3：后端复杂度

| 函数 / 文件 | 改动前 | 改动后 |
|---|---|---|
| `session_service.submit_answer` 复杂度 | 40 | **4** |
| `session_service.submit_answer` 行数 | 222 | **44** |
| `hot_agent.merge_votes` 复杂度 | 19 | 已拆分 |
| `session_service.py` 文件行数 | 1,278 | 1,254 |

拆出的辅助函数：`_resolve_correct_answer`、`_text_matches`、`_grade_fill_answer`、`_grade_answer`、`_append_adaptive_question`、`_mastery_status`，以及新文件 `question_picker.py`（抽题逻辑）。

### 阶段 4：前端拆分

| 文件 | 改动前 | 改动后 |
|---|---|---|
| `pages/Xbk/index.tsx` | 1,997 行 | **1,279 行** |
| `pages/Admin/AgentData/components/GroupDiscussion/index.tsx` | 1,582 行 | 1,511 行 |

新文件：`Xbk/columns.tsx`（表格列定义）、`Xbk/components/XbkFilterBar.tsx`（筛选栏）、`DiscussionToolbar.tsx`（小组讨论工具栏）。

### 阶段 5：性能

| 项 | 改动前 | 改动后 | 实测方式 |
|---|---|---|---|
| echarts 前端包体 | 1.0 MB | **570 KB** | 按需注册 Bar/Line/Scatter/Radar + Grid/Tooltip/Legend/DataZoom/Radar + Canvas/SVG 双渲染器，构建产物实测 |
| 分类列表 SQL 次数（5 个分类） | 7 次 | **3 次** | 逐条计数改为一次 GROUP BY，实测 SQL 日志 |
| `classroom_plan_items.activity_id` 索引 | 无索引 | 已加 | 新增 Alembic 迁移 |

索引迁移 `20261026_0001_idx_classroom_plan_items_activity.py` 验证：upgrade → downgrade → 再 upgrade 全部成功，`EXPLAIN` 确认走 `Bitmap Index Scan on ix_znt_classroom_plan_items_activity_id`。

#### 按需注册导致雷达图两次静默失效（均已修复）

按需引入 echarts 触发了**两个各自独立、且都不报错的**回归，一次比一次隐蔽。

**第一次：漏注册图表类型 → 空白画布**

初版只注册了 `BarChart` / `LineChart` / `ScatterChart`，漏掉 `RadarChart` 与 `RadarComponent`。`RadarChart.tsx` 用的是 `series.type = "radar"`，结果是**画布空白**——不抛异常、不进错误边界。

```
[ECharts] Series radar is used but not imported.
echarts.use([RadarChart]);   // 修复后
```

**第二次：漏注册渲染器 → 能画但全黑**

补上雷达注册后图能画出来了，但**整张图变成黑灰色块**。根因：

- `RadarChart.tsx` 通过 `opts={{ renderer: "svg" }}` 指定 SVG 渲染，并把 `var(--ws-color-primary)` 这类 CSS 变量**直接作为 fill/stroke** 交给 echarts。
- SVG 的 fill/stroke 是真正的 CSS 属性，**由浏览器原生解析**，所以 `var()` 能取到主题色。
- 按需注册只注册了 `CanvasRenderer`，缺少 `SVGRenderer`，echarts **静默回落到 Canvas**。
- Canvas 走 `ctx.fillStyle = "var(--ws-color-primary)"`，**Canvas API 不认 CSS 变量**，赋值失败后一律回退成黑色。

关键证据（同一真实 `RadarChart` 组件，仅切换 `lib/echarts.ts` 版本，保留页面 CSS 变量）：

| `lib/echarts.ts` | 实际渲染器 | 图形颜色 | 结论 |
|---|---|---|---|
| HEAD 全量 `import * as echarts from "echarts"` | `<svg>` | `stroke="var(--ws-color-primary)"` → **青色 #0D9488** ✅ | 正常 |
| 按需（仅 CanvasRenderer） | `<canvas>` | 彩色像素 **0%**、暗色 12.86% ❌ | 全黑 |
| 按需（+ SVGRenderer） | `<svg>` | 青色恢复正常 ✅ | 正常 |

修复：`frontend/src/lib/echarts.ts` 一并注册 `RadarChart` + `RadarComponent` + **`SVGRenderer`**。包体 550 KB → 570.39 KiB（仍比全量 1010.89 KiB 省 43.6%）。

> 教训一：按需注册的失败模式是**静默的**，而且**分层**——缺图表类型是"空白"，缺渲染器是"全黑"。两次都通过了 `tsc --noEmit`、774 个前端单测、`vite build`。
>
> 教训二：**光断言"画出来了"不够**。第一次修复后我验证到 canvas 非空白像素 25.73% 就收工了，但那是用 echarts 默认调色板测的、根本没过 `var()` 这条路径。**必须用真实组件 + 真实业务颜色配置 + 检查颜色本身是否正确**，而不是只检查"有没有像素"。
>
> 教训三：排查这类问题时，若为了隔离环境而清空 DOM（`documentElement.innerHTML = ...`），会顺带删掉 CSS 变量定义，从而制造出"全黑"的假象。必须在保留原页面样式的条件下注入组件。

另修复 Reader 目录超过 100 篇时静默截断的问题，改为明确提示并建议搜索。

> 该提示第一版放在「目录大纲」Tab 内部，而 Reader 默认打开的是「文档列表」Tab，导致**用户永远看不到这条提示**（逻辑对、位置错）。已移到 Tabs 外部、固定在左侧面板底部，两个 Tab 均可见。实测：默认 Tab 下 `notice=true`（修复前为 `false`）。

## 四、热点问题归类（同期完成的功能改动）

这部分不是审查任务，是在同工作树完成的独立功能，一并记录。设计详情见 [hot_agent.md](../../features/assessment/hot_agent.md)。

核心改动：

- `hot_agent.py` 整体重写：LLM 只做逐条语义判断，计数和分阶段全部由程序完成；新增三类七细分的归类体系和多轮投票（`VOTE_ROUNDS=3`，多数不足 `2/3` 标记为待确认）。
- 前端新增时间线堆叠柱、按类筛选、判断依据展示、按教师提问分阶段列表。
- 新增 `backend/tests/ai_agents/test_hot_question_classification.py`（207 行）。

验证中修的两个真实缺陷：

1. **教师提问编号重复**：自动识别与手填标记各占一个 Tn，页面显示 T4–T6 却只有 3 个提问。修复为按 `message_id` 去重。
2. **详情接口 500**：ORM 对象直接写入 Redis，读回无法通过响应校验。改为缓存 `model_dump(mode="json")` 纯数据。

## 五、有意不做的项

| 项 | 原因 |
|---|---|
| 其余 14 处缺索引外键 | 核对后当前没有查询把它们当过滤条件，加了无收益 |
| 高复杂度 PythonLab 沙箱函数 | 改动风险大于收益 |
| `QuestionsPage.tsx` 等剩余大文件 | 拆分方法已验证，可随时继续，但当前不影响功能 |
| 删除 `__init__.py` 的 re-export | 有接口契约测试锁定 |
| echarts 渲染器防护断言 | 方案已验证可行，但为避免拉长未提交状态，留作提交后的独立改动（见下文第八节） |

## 六、发现的问题

1. **生产数据不支持热点归类的核心假设**：生产库 271 条问题中**教师提问为 0 条**。归类体系依赖教师提问做锚点，没有教师提问时只能退化为普通分类。
   > **证据边界**：该结论来自 2026-10-25 对生产库 `192.168.5.3` 的只读查询。开发库 `hot_question_analyses` 为 0 行，本地无法复现，只能引用当时查询结果。
2. **生产版本说法需要按镜像而非源码核对**：`frontend/package.json` 与最新提交都是 2.1.7；"生产运行 2.1.8"指的是服务器上的镜像标签，本地源码里没有 2.1.8 这个版本号。部署前应按 [DEPLOY.md 版本管理](../deploy/DEPLOY.md#版本管理)核对。
3. **全部改动未提交**：70 个文件，暂存 0，分散在多个阶段加 1 个功能，且工作树里还有另一个会话的未提交改动，存在混淆风险。
4. **按需注册两次导致雷达图静默失效**（均已修复，见阶段 5）：先是漏注册 `RadarChart`/`RadarComponent` → 画布空白；补上后又因漏注册 `SVGRenderer` → 静默回落 Canvas、`var(--ws-color-*)` 解析失败 → 整图全黑。两轮 `tsc`、774 个前端单测、`vite build` 全部通过。说明现有前端验证体系无法发现"运行时静默降级"，且**"有像素"不等于"颜色对"**。
5. **CI 开始实际执行一批此前从未跑过的测试**：`.github/workflows/ci-quality.yml` 新增了 `TEST_DATABASE_URL`。此前该变量缺失，16 个文件里的并发 / 迁移 / token 轮换 / KNN 用例在 CI 中一律 `pytest.skip`。
   > 数量更正：工作流注释写"约 230 个"，**实测该变量真实点亮 118 个用例**（A/B 对照：关闭时 142 passed / 179 skipped，开启时 260 passed / 61 skipped）。剩余 61 个 skip 来自另外 6 个独立环境变量（`LEGACY_CONVERSATIONS_VIEW_TEST_DATABASE_URL` 49 个、`ALEMBIC_CONCURRENCY_TEST_DATABASE_URL` 3 个、`CONVERSATIONS_VIEW_TEST_DATABASE_URL` 3 个等），与本变量无关。
   >
   > 本地实测：**260 passed / 61 skipped / 0 failed**，且 `pg_stat_database` 前后快照确认开发库 `wangsh_db` 新增行数为 **0**，测试库完全隔离。
6. **索引迁移的真实依据与注释不符**（已修复）：迁移 docstring 原写"代码中有 5 处按 `activity_id` 过滤"，实测这 5 处全部是 `ClassroomResponse.activity_id`（对应表已建索引），对 `ClassroomPlanItem.activity_id` 的过滤全库 **0 处**。
   - 迁移本身有效，但服务的是**外键 `ON DELETE CASCADE` 级联路径**（实测 60k 行基准表：1.722ms → 0.662ms），已按真实理由重写 docstring。
   - `app/models/classroom/plan.py` 的 `activity_id` 原缺 `index=True`，导致 `compare_metadata` 报 `remove_index`——**下一次 autogenerate 会生成删除该索引的迁移**。已补 `index=True`，迁移后实测 drift 归 0。
7. **清理死函数时遗留了同类死代码**（已修复）：`llm_agent_base._call_dify_stream` / `_call_openai_compatible_stream` 在 `call_llm_stream` 删除后已无调用方（全库 0 引用），与本次清理的 8 个死函数属同一类问题。已一并删除（文件 250 → 175 行）。
8. **新增 18 处 ruff F401 未使用 import**（已修复）：`admin_stream.py`、`classroom/student.py`、`agent_analysis.py`、`question_picker.py`、`xbk/exports/common.py` 等，改动前基线为 0。已全部清理。ruff 未接入 CI，故不阻断门禁。
9. **`StatisticsPage` 配色曾被误判为缺陷**（已证伪）：曾据代码推断"19 处 `var()` + 未指定 renderer → 图表全黑"。实际截图确认配色正常，原因是它复用了同一个 `RadarChart` 组件、走 SVG 路径。**结论：代码推断不能替代渲染验证。**

## 七、过程中的方法论教训

本轮多个问题都不是"改错了代码"，而是**验证方法本身出了问题却得出了"通过"的结论**。三次都由交叉检验抓出：

| 误判 | 表现 | 根因 | 抓出方式 |
|---|---|---|---|
| 雷达图第一次"修复" | 断言非白像素 25.73% 即判定通过 | 用 echarts 默认调色板测试，没过 `var()` 路径 | 子代理看图发现全黑 |
| 索引迁移基准表 | 基准组"无索引"实际继承了索引 | 建表用 `LIKE ... INCLUDING ALL`，连带复制了索引 | 后端 agent 自查发现并重建 |
| `StatisticsPage` | 报为"既有缺陷" | 只看代码没渲染，属推断 | 截图证伪 |

共同结论：**静默失败的改动（按需注册、CSS 变量、索引）必须实际渲染/实测看效果；断言"元素存在"不等于"属性值正确"；同一结论最好由一条独立路径复核。**

## 八、关于 echarts 渲染器防护的结论

曾提议两种防护方案，实测后**否掉了一种**：

- ❌ **断言最终 DOM 不含 `var(`**：探针实测（jsdom 真实初始化 echarts）显示，SVG 路径下 `var(--ws-color-primary)` 会**原样保留在 DOM 中**（`residual: 3`），这正是它正常工作的原因。该断言会把正确行为判成错误。
- ⚠️ **lint 静态扫描**：只能看到同一文件里出现 `var(` 和 `renderer: "canvas"`，看不到"库没注册 SVGRenderer 导致运行时回落"这类问题。
- ✅ **推荐**：断言"options 中含 `var(--ws-` 的图表，最终必须渲染出 `<svg>`"。探针已验证可行（`hasSvg: true`），不依赖像素和颜色，能同时覆盖两次失灵。

## 九、建议

1. **优先提交**：70 个文件横跨五轮修正仍未提交，风险在累积。建议拆成 3 个提交：
   - ① 本次审查改动（死代码、合并、拆分、性能、索引迁移、雷达图与 Reader 修复）
   - ② CI 的 `TEST_DATABASE_URL`（独立，便于回退）
   - ③ 热点归类功能（独立，便于回退）
   提交时按文件名逐个 `git add`，排除另一会话的 11 个文件。
2. 提交后单独加"渲染器断言"防护，作为独立提交。
3. 热点归类功能上线后，先确认教师在生成分析时确实填写了"教师提问标记"，否则该模块的价值无法体现。
4. 剩余大文件拆分和低收益索引可以留到后续迭代，不必一次做完。
