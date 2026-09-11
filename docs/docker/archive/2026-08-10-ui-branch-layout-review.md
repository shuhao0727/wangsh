# UI 分支布局与内容审核报告（DOM/几何结构化）

> 状态：archived
> Owner：docs
> 最近复核：2026-09-08
> 归档说明：从 Git 历史恢复的 2026-08-10 审核快照，仅用于追溯，不代表当前 UI 状态。
> 证据边界：正文提到的 `screens/visual-review/` 截图目录未随本次正文恢复，不能据此证明当前视觉状态。

> 日期：2026-08-10
> 分支：`feature/ui-optimization-design`
> 方法：对每页按「预期布局模板 × 实际 DOM/几何」交叉验证 —— 抓元素存在性 / 位置 / 尺寸 / 对齐 / 可见性 / 响应式，逐项核对布局与内容是否合理（非像素审美，靠几何证据）。
> 截图：`screens/visual-review/*.png`（41 张，供像素复核）
> 门禁：type-check / token-check / build / ui:audit 全绿

## 0. 结论

**布局结构性健康（A-）。** 逐页 DOM/几何核对未发现"错位 / 缺元素 / 重叠 / 该显示未显示"的硬伤。骨架齐全、区块排布正确、对齐一致、响应式不溢出。主要观察集中在**内容/数据态**（部分页需预置数据才见满布局）和个别可复核项。

## 1. 逐页布局核对结果

> 图例：✅ 布局合理 · 🟡 需数据/可复核 · 证据 = 几何数值

### 公开页（BasicLayout 壳）

**✅ Home（hero）** — 视口 1728×940：
- 骨架：header ✓ main ✓ nav ✓（无 footer，hero 合理）
- hero 满屏 1728×940；标题 cx=864（垂直居中=视口中线）✅；标语 badge cx=864 ✅
- 5 pills 同 y=503、同高 41，cx 632/760/885/1004/1110 → 行居中、间距 106-128px 均匀 ✅
- 链接 2 个 y=581 位于 pill 下方；版本号 v1.6.0 可见 ✅
- **判定：hero 结构完整、居中、对齐一致**

**✅ IT技术 / ml / ai / agents（独立全屏学习站）** — 卡片圆角 24px 统一、网格等宽；布局完整

**✅ PythonLab（工作台）** — 画布 + 编辑器 + 流程图节点（开始/结束/赋值b=5/print）结构化呈现清晰；`hasEditor:true`
- 🟡 需人工复核：运行控制按钮的文本选择器未匹配到（`/运行|run|debug/` 无命中），按钮存在与否待确认

**✅ AI 智能体（工作台）** — 左侧当前智能体+历史+聊天区+输入框；占位 "向递归法发送消息..." 合理
- 🟡 消息区 3 个 msg 节点（多为骨架/空态），数据态需已配置 agent+会话

**✅ 其余公开页**（informatics/articles/personal-programs/xbk/games/lock-cracker/登录）— 结构存在，空态/数据态合理

### 后台页（AdminLayout 壳）

**✅ Dashboard（统计卡）** — 3 卡同 y=185 同高 51，x=233/729/1226，gutter 11-12px **相等** ✅ 对齐完美
**✅ Users（表格）** — 9 列 × 20 行，表头完整，tableW 1476 无横滚；筛选栏 ✓
- 🟡 `hasPagination:false` — 20 行未检出分页控件（可能单页隐藏或选择器未中），可复核
**✅ AI智能体（表格）** — 1 行数据态；列 名称/类型/描述/API密钥/状态/创建/操作 齐全
**✅ AgentData（Tab+统计+表格）** — 7 统计卡 + usage Table 20 行，hot/chains Tab 需历史数据（空态）
**✅ Assessment / GroupDiscussion / Informatics（后台）** — 空态"暂无 + 创建引导"友好
**✅ ClassroomInteraction / ClassroomPlan** — 1 行测试数据，表格/操作列正常

### super_admin + 编辑器（AdminEditorLayout 壳）

**✅ super 三页**（system/articles/personal-programs）— 结构均渲染
**✅ 编辑器 5 页**（article/typst/assessment/learning/mindmap）— 编辑区 textarea/编辑器齐全、布局分区清晰、全宽 1728

### 独立页

**✅ task-analysis 各视图**（new/result/hot/chains）— 表单/图表结果渲染
- 🟡 task-compare（13KB 近空）：需 ≥1 段历史分析才有图，空态可复核
**✅ mindmaps / mindmap-preview / games / notfound** — games 与 notfound 完整；mindmap-preview 需数据（7.7KB）

### 响应式（375px 抽查）

**✅ Home@375** — pills 纵向堆叠（x=16 单列）、docW 375 **无横向溢出**
**✅ Users@375** — 表格内部滚动、docW 375 无溢出、侧栏/菜单存在（移动端切换）

## 2. 布局问题清单

| 严重度 | 页面 | 发现 | 证据 | 建议 |
|---|---|---|---|---|
| ✅ 已核实 | PythonLab | 运行/调试按钮**确为图标**（无文字） | `/运行|run` 0 命中；点击区存在图标按钮 | 非缺陷，正常 |
| ✅ 已核实 | admin/Users | **分页正常**（先前探针选择器错误） | 实际底部："共 64 条 / 20 每页 / 上一页 / **1/4** / 下一页" | 非缺陷 |
| ✅ 已处理 | task-compare | **已造数据看全**：`?type=hot&ids=1,2` 渲染完整对比 | 见下 | 截图 `task-compare-full.png` |
| ✅ 已处理 | ITTechnology | **已开 9 个 feature flag 看全满网格** | 9 卡等宽 227px / gutter 16px | 截图 `it-tech-full-grid.png` |
| ✅ 已处理 | mindmap-preview | **已造 localStorage 数据看全导图** | 分层节点树渲染 | 截图 `mindmap-preview-full.png` |

> 核对结论：3 个"待复核"项中，2 个实为探针/判读问题（PythonLab 图标按钮、Users 分页均正常），3 个"需数据"项已全部造数据看全（it-tech 满网格 / task-compare 对比 / mindmap-preview 导图），布局均合理。

### 补充：三个数据态页的布局核对
- **ITTechnology 满网格**：9 模块卡，每行等宽 **227px**、gutter **16px** 均匀、列对齐；第1行 5 卡 y=80、第2行 1 卡 y=272（换行）、第3行 3 卡 y=497 → 网格节奏合理 ✅
- **task-compare 对比**：概览表（指标×N 记录）+ Bloom/时序/生发问题 多对比区块，表头 3 列 → 布局清晰 ✅
- **mindmap-preview 导图**：AI 主节点 → ML/DL/NLP 分支 → 子节点，分层树渲染 ✅

## 3. 视觉层级 / 一致性（结构维度）

- 各首页/后台标题层级通过 DOM 验证（h1 标题 + 副文案 + 卡片标题字重递增）✅
- 同一 admin 域表格共用 DataTable/AdminTablePanel 形态（9 列规则）✅
- 空态统一"暂无数据 + 创建引导" ✅

## 4. 与上一版报告的关系
- 上一版（2026-08-10-ui-branch-visual-review.md）是**数值探针**（溢出/取色/间距门禁）；本版是**布局与内容结构化核对**（元素存在/位置/对齐/响应式）。两者互补：前者证明"规范值达标"，后者证明"页面该有的布局确实合理呈现"。
- 工程/代码层问题见 2026-08-06 报告 §B/§F。

## 5. 建议
1. **复核 2 处**：PythonLab 运行按钮、Users 分页（几何证据已给）
2. **数据预置**：task-compare / mindmap-preview / it-tech 满网格 需造数据/开 flag 才能看全（低优先）
3. **无阻断**：布局主线健康，可继续推进 UI 分支
