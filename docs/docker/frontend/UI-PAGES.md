# 前端核心界面清单

> 状态：reference
> Owner：frontend
> 最近复核：2026-07-23
> 范围：核心页面和重点弹窗、抽屉、浮动面板；不是组件目录的穷举清单。

---

## 公共页面（19 个）

| # | 路由 | 组件 | 说明 |
|---|------|------|------|
| 1 | `/home` | HomePage | 首页，模块入口 |
| 2 | `/articles` | ArticlesPage | 文章列表 |
| 3 | `/articles/:slug` | ArticleDetailPage | 文章详情 |
| 4 | `/informatics` | InformaticsPage | 信息学笔记列表 |
| 5 | `/informatics/:id` | InformaticsDetailPage | PDF 阅读器 + 目录 |
| 6 | `/it-technology` | ITTechnologyPage | IT 技术应用 |
| 7 | `/it-technology/python-lab(/:id)` | PythonLabPage | PythonLab 画布编辑器 |
| 8 | `/personal-programs` | PersonalProgramsPage | 个人节目 |
| 9 | `/ai-agents` | AIAgentsPage | AI 智能体对话 |
| 10 | `/xbk` | XbkPage | 选课系统 |
| 11 | `/login` | LoginPage | 登录页 |
| 12 | `/it-technology/ml` | MLFullPage | ML 全屏学习书籍（无布局） |
| 13 | `/it-technology/ai` | AIFullPage | AI 全屏学习书籍（无布局） |
| 14 | `/it-technology/agents` | AgentsFullPage | Agents 全屏学习书籍（无布局） |
| 15 | `/it-technology/games` | GamesRepoPage | 游戏资源库浏览 |
| 16 | `/games` | GamesPage | 教学小游戏列表（无布局） |
| 17 | `/games/lock-cracker` | LockCrackerPage | 密码锁破解游戏（穷举法教学） |
| 18 | `/mindmaps` | MindmapGalleryPage | 思维导图广场（无布局） |
| 19 | `/mindmap-preview` | MindmapPreviewPage | 思维导图预览（无布局） |

---

## 管理后台页面（25 个）

| # | 路由 | 组件 | 说明 |
|---|------|------|------|
| 20 | `/admin/dashboard` | DashboardPage | 仪表盘概览 |
| 21 | `/admin/users` | UsersPage | 用户管理 |
| 22 | `/admin/articles` | ArticlesPage | 文章管理 |
| 23 | `/admin/articles/editor/new\|:id` | ArticleEditorPage | 文章编辑器 |
| 24 | `/admin/assessment` | AssessmentPage | 测评管理 |
| 25 | `/admin/assessment/editor/new\|:id` | AssessmentEditorPage | 测评编辑器 |
| 26 | `/admin/assessment/:id/questions` | QuestionsPage | 题目管理 |
| 27 | `/admin/assessment/:id/statistics` | StatisticsPage | 测评统计 |
| 28 | `/admin/ai-agents` | AIAgentsPage | 智能体管理 |
| 29 | `/admin/agent-data` | AgentDataPage | 智能体数据 |
| 30 | `/admin/group-discussion` | GroupDiscussionPage | 分组讨论管理 |
| 31 | `/admin/classroom-interaction` | ClassroomInteractionPage | 课堂互动 |
| 32 | `/admin/classroom-plan` | ClassroomPlanPage | 课堂计划 |
| 33 | `/admin/informatics` | InformaticsPage | 信息学笔记管理 |
| 34 | `/admin/informatics/editor/new\|:id` | TypstEditorPage | Typst 编辑器 |
| 35 | `/admin/it-technology` | ITTechnologyPage | IT 技术管理 |
| 36 | `/admin/it-technology/games` | AdminGamesManagerPage | 游戏资源库管理 |
| 37 | `/admin/it-technology/ml-book-editor` | AdminMLBookEditorPage | ML 书籍编辑器 |
| 38 | `/admin/it-technology/learning/:moduleKey` | AdminLearningEditorPage | 学习内容编辑器 |
| 39 | `/admin/it-technology/learning/:moduleKey/:section` | AdminTabEditorPage | 学习标签页编辑器 |
| 40 | `/admin/it-technology/mindmap/:moduleKey` | AdminMindMapEditorPage | 思维导图编辑器 |
| 41 | `/admin/personal-programs` | PersonalProgramsPage | 个人节目管理 |
| 42 | `/admin/system` | SystemPage | 系统设置 |
| 43 | `/admin/games/config` | GameConfigPage | 游戏配置（密码池管理） |
| 44 | `*` | NotFoundPage | 404 页面 |

---

## Task Analysis 页面（5 个，无布局）

| # | 路由 | 组件 | 说明 |
|---|------|------|------|
| 45 | `/task-analysis/new` | TaskAnalysisNewPage | 创建任务分析（4 步向导） |
| 46 | `/task-analysis/compare` | TaskAnalysisComparePage | 多课次对比分析 |
| 47 | `/task-analysis/:analysisId` | TaskAnalysisResultPage | 分析结果路由（分发到 hot/chains） |
| 48 | `/task-analysis/hot/:analysisId` | HotAnalysisResultPage | 热点问题分析详情 |
| 49 | `/task-analysis/chains/:analysisId` | ChainAnalysisResultPage | 问题链分析详情 |

---

## 弹窗 / Dialog（12 个）

| # | 组件 | 文件 | 触发场景 |
|---|------|------|---------|
| 50 | CategoryManageModal | `Admin/Articles/CategoryManageModal.tsx` | 文章管理 → 分类管理 |
| 51 | CategoryEditDialog | （嵌套在 CategoryManageModal 内） | 新建/编辑分类 |
| 52 | MarkdownStyleManagerModal | `Admin/Articles/components/MarkdownStyleManagerModal.tsx` | 文章编辑器 → 样式管理 |
| 53 | UserDetailModal | `Admin/Users/components/UserDetailModal.tsx` | 用户管理 → 查看详情 |
| 54 | AgentDetail | `Admin/AIAgents/components/AgentDetail.tsx` | 智能体管理 → 查看详情 |
| 55 | AgentConfigModal | `Admin/ITTechnology/components/AgentConfigModal.tsx` | IT 技术 → AI 配置 |
| 56 | DetailModal（AgentData） | `Admin/AgentData/components/DetailModal.tsx` | 智能体数据 → 对话详情 |
| 57 | XbkAnalysisModal | `Xbk/components/XbkAnalysisModal.tsx` | 选课 → 分析报表 |
| 58 | XbkEditModal | `Xbk/components/XbkEditModal.tsx` | 选课 → 新建/编辑 |
| 59 | XbkDeleteModal | `Xbk/components/XbkDeleteModal.tsx` | 选课 → 删除确认 |
| 60 | XbkExportModal | `Xbk/components/XbkExportModal.tsx` | 选课 → 导出 Excel |
| 61 | XbkImportModal | `Xbk/components/XbkImportModal.tsx` | 选课 → 导入 Excel |

---

## 抽屉 / Sheet（3 个）

| # | 组件 | 文件 | 触发场景 |
|---|------|------|---------|
| 62 | ActivityDetailDrawer | `components/ActivityDetailDrawer.tsx` | 课堂互动/计划 → 活动详情 |
| 63 | TypstTocDrawer | `Admin/Informatics/typst/TypstTocDrawer.tsx` | Typst 编辑器 → 目录导航 |
| 64 | Informatics PDF Sheet | `Informatics/Reader.tsx` | 信息学阅读 → 移动端目录 |

---

## 浮动面板（2 个）

| # | 组件 | 文件 | 说明 |
|---|------|------|------|
| 65 | GroupDiscussionPanel | `AIAgents/GroupDiscussionPanel.tsx` | 可拖拽分组讨论窗口 |
| 66 | OptimizationDialog | `pythonLab/components/OptimizationDialog.tsx` | PythonLab 代码优化对比 |

---

## 当前登记统计

| 类别 | 数量 |
|------|------|
| 公共页面 | 19 |
| 管理后台页面 | 25 |
| Task Analysis 页面 | 5 |
| 弹窗 / Dialog | 12 |
| 抽屉 / Sheet | 3 |
| 浮动面板 | 2 |
| **总计** | **66** |
