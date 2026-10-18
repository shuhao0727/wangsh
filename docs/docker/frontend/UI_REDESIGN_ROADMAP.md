# 页面嵌入式整理路线图

> 状态：active
> Owner：frontend
> 最近复核：2026-10-18
> 参考规范：[EMBEDDED_UI_STYLE_GUIDE.md](EMBEDDED_UI_STYLE_GUIDE.md)
> 页面清单来源：[UI-PAGES.md](UI-PAGES.md) 与 `frontend/src/App.tsx`

本文登记 WangSh 当前前端的页面族和后续整理顺序。后续按“一个页面族完成、真实浏览器检查、确认效果，再进入下一个页面族”的方式推进。这里的“页面族”会合并同一组件的参数路由，例如详情页、编辑器新建/编辑页和学习内容的动态模块路由。

## 执行规则

1. 默认每次处理一个页面族；用户明确指定批量时，可并行处理多个文件边界清楚的页面族，先保留业务行为，再调整嵌入关系、控件尺寸、字号、间距、边框和阴影。
2. 以 `/xbk` 为视觉基准：控件融入所在区域，筛选、搜索、页签、工具栏、表格和分页连成同一工作区。
3. 使用现有 `--ws-*` 语义 token 和共享 UI 组件；特殊编辑器、阅读器、画布和游戏页面保留专用布局。
4. 每个页面至少检查 `1280×800`、`1440×900`、`1680×1050`、`1920×1080`；窄屏页面再检查响应式折行、横向滚动和弹层边界。
5. 完成页面后记录：代码文件、视觉变化、交互回归、浏览器尺寸、未覆盖场景和证据路径；用户确认后才推进下一页。
6. 不主动修改登录页业务和视觉；重定向入口不重复计入页面族。

状态含义：`基准完成` 表示已作为 `/xbk` 参考页面整理；`已完成` 表示本页面已整理并经用户确认；`待用户确认` 表示本页实现与工程检查完成，等待用户检查实际页面效果；`下一页` 表示下一轮优先处理；`待处理` 表示尚未按本路线图完成；`专用布局` 表示需要遵守编辑器、阅读器、画布或游戏的独立交互约束；`保持现状` 表示用户认可当前页面，不纳入本轮视觉调整。

## 推荐处理顺序

### 第一批：后台数据工作区

| 顺序 | 路由 | 页面组件 | 页面类型 | 状态 | 处理重点 |
|---:|---|---|---|---|---|
| 1 | `/admin/agent-data` | `AdminAgentDataPage` | 数据列表、统计、筛选 | **已完成** | 已完成统计层级、筛选与结果区衔接、空状态密度整理，并经用户确认 |
| 2 | `/admin/articles` | `AdminArticlesPage` | 后台列表 | **已完成** | 已整理工具栏分组和窄屏表格滚动；用户已确认整体效果 |
| 3 | `/admin/assessment` | `AdminAssessmentPage` | 后台列表 | **已完成** | 已整理筛选/新建操作、计数密度和表格连续性；用户已确认效果 |
| 4 | `/admin/users` | `AdminUsersPage` | 后台列表 | **已完成** | 已整理统计摘要、筛选/管理操作分组、行内操作和详情弹窗；用户已确认效果 |
| 5 | `/admin/ai-agents` | `AdminAIAgentsPage` | 后台列表、卡片 | **待用户确认** | 统计摘要与筛选/管理动作合并为同一条顶部工具带，表格和分页继续共享工作区；已通过类型检查，待用户视觉确认 |
| 6 | `/admin/group-discussion` | `AdminGroupDiscussionPage` | 讨论工作区 | **待用户确认** | 筛选与会话操作分组，修正搜索 landmark 范围；待检查详情和浮动讨论面板关系 |
| 7 | `/admin/classroom-interaction` | `AdminClassroomInteractionPage` | 课堂工作区 | **待用户确认** | 活动筛选、操作栏、列表与分页整合；保留活动详情抽屉和操作逻辑 |
| 8 | `/admin/classroom-plan` | `AdminClassroomPlanPage` | 计划工作区 | **待用户确认** | 列表与计划详情/编辑改为分栏连续布局；待检查不同面板状态 |

### 第二批：内容与学习管理

| 顺序 | 路由 | 页面组件 | 页面类型 | 状态 | 处理重点 |
|---:|---|---|---|---|---|
| 9 | `/admin/informatics` | `AdminInformaticsPage` | 内容列表 | **待用户确认** | 搜索、分类、管理动作、表格和分页整合进同一工作区 |
| 10 | `/admin/informatics/editor/new\|:id` | `AdminTypstEditorPage` | 专用编辑器 | **待用户确认** | 压平侧栏与正文边界，侧栏独立滚动；窄屏退出分屏，保留 Typst 编译与编辑流程 |
| 11 | `/admin/it-technology` | `AdminITTechnologyPage` | 内容管理 | **已完成** | 三列应用卡片、轻量分类与融入式底栏，按可用宽度减列；用户已认可卡片版并授权进入发布准备 |
| 12 | `/admin/it-technology/games` | `AdminGamesManagerPage` | 资源管理 | **待用户确认** | 搜索与分类在空态和错误态仍可操作，保留上传、资源列表与分页工作流 |
| 13 | `/admin/it-technology/ml-book-editor` | `AdminMLBookEditorPage` | 书籍编辑器 | **待用户确认** | 目录、正文与元数据改为连续三栏；分屏方向和编辑器填充高度已修正，当前仅隔离请求检查空态 |
| 14 | `/admin/it-technology/learning/:moduleKey` | `AdminLearningEditorPage` | 学习内容编辑器 | **待用户确认** | 移除重复顶栏和预览目录；窄屏提供章节选择，编辑与预览显示当前未保存内容 |
| 15 | `/admin/it-technology/learning/:moduleKey/:section` | `AdminTabEditorPage` | 学习页签编辑器 | **待用户确认** | 工具栏统一尺寸，窄屏列表与编辑区上下排列；无条目时保存禁用并显示空态 |
| 16 | `/admin/it-technology/mindmap/:moduleKey` | `AdminMindMapEditorPage` | 思维导图编辑器 | **待用户确认** | 统一导图工具栏、标题和编辑区域，保留画布与 Markdown 专用工作流 |
| 17 | `/admin/personal-programs` | `AdminPersonalProgramsPage` | 后台列表 | **待用户确认** | 单应用入口改为横向工作条目，开关与打开入口保持相邻 |
| 18 | `/admin/system` | `AdminSystemPage` | 系统设置 | **待用户确认** | 分区页签、设置字段与观测指标连续排布，只读设置使用文本表达 |
| 19 | `/admin/games/config` | `GameConfigPage` | 配置工作区 | **待用户确认** | 密码池标签、数量、输入与提示对齐，移除重复标题，返回操作可在当前标签页使用 |

### 第三批：测评与任务分析

| 顺序 | 路由 | 页面组件 | 页面类型 | 状态 | 处理重点 |
|---:|---|---|---|---|---|
| 20 | `/admin/articles/editor/new\|:id` | `AdminArticleEditorPage` | 文章编辑器 | 专用布局 | 标题、分类、样式、摘要、正文编辑和保存状态 |
| 21 | `/admin/assessment/editor/new\|:id` | `AdminAssessmentEditorPage` | 测评编辑器 | **待用户确认** | 表单分组、题目编辑、操作栏和保存状态；已移除重复返回栏，保留专用编辑器布局 |
| 22 | `/admin/assessment/:id/questions` | `AdminAssessmentQuestionsPage` | 题目管理 | **待用户确认** | 题目列表、筛选、排序、编辑和批量操作；工作区、空状态和行内控件已压平 |
| 23 | `/admin/assessment/:id/statistics` | `AdminAssessmentStatisticsPage` | 统计分析 | **待用户确认** | 条件栏、指标、图表和结果表格；错误状态与轻边界工作区已整理 |
| 24 | `/task-analysis/new` | `TaskAnalysisNewPage` | 四步向导 | **待用户确认** | 步骤导航、表单密度、主次操作和错误状态；已检查桌面与 390px 窄屏 |
| 25 | `/task-analysis/compare` | `TaskAnalysisComparePage` | 对比分析 | **待用户确认** | 课次筛选、对比区域、结果表和导出操作；错误状态保持嵌入式头部与连续背景 |
| 26 | `/task-analysis/:analysisId` | `TaskAnalysisResultPage` | 结果分发页 | **待用户确认** | 结果入口、加载、错误和返回路径；共享结果布局已取消渐变和重复卡片层级 |
| 27 | `/task-analysis/hot/:analysisId` | `HotAnalysisResultPage` | 热点分析 | **待用户确认** | 指标摘要、问题列表、详情和返回操作；复用共享结果工作区 |
| 28 | `/task-analysis/chains/:analysisId` | `ChainAnalysisResultPage` | 问题链分析 | **待用户确认** | 链路视图、筛选、详情和导出操作；复用共享结果工作区 |

### 第四批：后台概览与公共内容页

| 顺序 | 路由 | 页面组件 | 页面类型 | 状态 | 处理重点 |
|---:|---|---|---|---|---|
| 29 | `/admin/dashboard` | `AdminDashboardPage` | 仪表盘 | **待用户确认** | 指标、快捷入口、图表和工作区间距；状态区、服务检查和标题栏已连续化 |
| 30 | `/articles` | `ArticlesPage` | 公共列表 | **待用户确认** | 搜索、分类、文章列表、分页和空状态；清除筛选、分页操作补充无障碍名称 |
| 31 | `/articles/:slug` | `ArticleDetailPage` | 公共详情 | **待用户确认** | 标题、元信息、正文和返回/相关推荐关系 |
| 32 | `/home` | `HomePage` | 首页 | **保持现状** | 用户认为原有首页效果合适；撤回本批首页改版并沿用原设计 |
| 33 | `/informatics` | `InformaticsPage` | 公共列表 | **待用户确认** | 笔记筛选、卡片/列表、分页和阅读入口 |
| 34 | `/informatics/:id` | `InformaticsDetailPage` | PDF 阅读器 | **待用户确认（专用布局）** | 阅读区、目录 Sheet、工具栏和移动端边界；当前无有效已发布笔记可验正文 |
| 35 | `/it-technology` | `ITTechnologyPage` | 学习入口 | **待用户确认** | 模块卡片、进度、入口按钮和内容层次 |
| 36 | `/it-technology/games` | `GamesRepoPage` | 资源库浏览 | **待用户确认** | 搜索、分类、下载入口和空状态；当前资源库为空 |
| 37 | `/it-technology/python-lab(/:id)` | `ITTechnologyPythonLabPage` | 代码实验室 | **待用户确认（专用布局）** | 编辑器、运行控制、面板、调试和真实点击可靠性 |
| 38 | `/personal-programs` | `PersonalProgramsPage` | 公共列表 | **待用户确认** | 节目卡片、筛选、详情入口和状态 |
| 39 | `/ai-agents` | `AIAgentsPage` | 对话工作区 | **待用户确认（专用布局）** | 对话区、智能体选择、分组讨论面板和输入区 |

### 第五批：全屏学习、游戏与思维导图

| 顺序 | 路由 | 页面组件 | 页面类型 | 状态 | 处理重点 |
|---:|---|---|---|---|---|
| 40 | `/it-technology/ml` | `MLFullPage` | 全屏学习书籍 | **待用户确认（专用布局）** | 书籍导航、内容阅读和专用工具栏 |
| 41 | `/it-technology/ai` | `AIFullPage` | 全屏学习书籍 | **待用户确认（专用布局）** | 与 ML 页面保持同一阅读密度和交互规则 |
| 42 | `/it-technology/agents` | `AgentsFullPage` | 全屏学习书籍 | **已完成** | 与 ML/AI 页面保持一致的阅读框架；用户已认可上一批整体效果 |
| 43 | `/games` | `GamesPage` | 游戏列表 | **已完成** | 游戏入口、卡片密度、筛选和空状态；用户已认可上一批整体效果 |
| 44 | `/games/lock-cracker` | `LockCrackerPage` | 教学游戏 | **已完成** | 游戏区、说明、控制和响应式可用性；用户已认可上一批整体效果 |
| 45 | `/mindmaps` | `MindmapGalleryPage` | 思维导图广场 | **已完成** | 搜索、画廊、预览入口和空状态；用户已认可上一批整体效果 |
| 46 | `/mindmap-preview` | `MindmapPreviewPage` | 思维导图预览 | **已完成** | 画布、缩放、返回和内容边界；用户已认可上一批整体效果 |

### 第六批：基准与系统页面

| 顺序 | 路由 | 页面组件 | 页面类型 | 状态 | 处理重点 |
|---:|---|---|---|---|---|
| 47 | `/xbk` | `XbkPage` | 选课工作区 | **基准完成** | 当前嵌入式视觉基准；后续页面以其控件尺寸、对齐和工作区关系为参照 |
| 48 | `/login` | `LoginPage` | 登录页 | 保持现状 | 本轮不主动修改登录页 |
| 49 | `*` | `NotFoundPage` | 404 页面 | **已完成** | 错误信息、返回入口和页面边界；用户已认可上一批整体效果 |

> 说明：`/`、`/admin`、`/admin/articles/new`、`/admin/articles/edit/:id` 是重定向入口，不新增页面族；它们分别进入登录页、后台仪表盘或文章编辑器。统计按 49 个页面族计算。

## 非页面交互界面

这些界面不单独占用页面整理顺序，但在宿主页面完成时一并检查：

| 类型 | 数量 | 范围 |
|---|---:|---|
| Dialog | 12 | 文章分类、文章样式、用户详情、智能体详情与配置、AgentData 详情、XBK 分析/编辑/删除/导入/导出 |
| Sheet / Drawer | 3 | 课堂活动详情、Typst 目录、信息学阅读目录 |
| 浮动面板 | 2 | 分组讨论面板、PythonLab 优化对比 |

详细组件和文件位置见 [UI-PAGES.md](UI-PAGES.md)。

## 完成记录模板

每个页面完成后，在本文件对应行更新状态，并补充以下信息到 `TEST_STATUS.md` 或页面 owner 文档：

- 实际修改的组件、样式和共享控件文件。
- 四档桌面尺寸及必要的窄屏检查结果。
- 搜索、筛选、下拉、页签、主次按钮、分页、空/错/加载状态的真实交互结果。
- 未覆盖的真实数据、权限、模型请求或高风险编辑流程。
- 临时截图和指标证据的外部路径；不把一次性截图提交到仓库。
