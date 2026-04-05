# 前端可见页面清单

> 全部用户可见界面（50 个），包含页面、弹窗、抽屉、浮动面板。

---

## 公共页面（11 个）

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

---

## 管理后台页面（19 个）

| # | 路由 | 组件 | 说明 |
|---|------|------|------|
| 12 | `/admin/dashboard` | DashboardPage | 仪表盘概览 |
| 13 | `/admin/users` | UsersPage | 用户管理 |
| 14 | `/admin/articles` | ArticlesPage | 文章管理 |
| 15 | `/admin/articles/editor/new\|:id` | ArticleEditorPage | 文章编辑器 |
| 16 | `/admin/assessment` | AssessmentPage | 测评管理 |
| 17 | `/admin/assessment/editor/new\|:id` | AssessmentEditorPage | 测评编辑器 |
| 18 | `/admin/assessment/:id/questions` | QuestionsPage | 题目管理 |
| 19 | `/admin/assessment/:id/statistics` | StatisticsPage | 测评统计 |
| 20 | `/admin/ai-agents` | AIAgentsPage | 智能体管理 |
| 21 | `/admin/agent-data` | AgentDataPage | 智能体数据 |
| 22 | `/admin/group-discussion` | GroupDiscussionPage | 分组讨论管理 |
| 23 | `/admin/classroom-interaction` | ClassroomInteractionPage | 课堂互动 |
| 24 | `/admin/classroom-plan` | ClassroomPlanPage | 课堂计划 |
| 25 | `/admin/informatics` | InformaticsPage | 信息学笔记管理 |
| 26 | `/admin/informatics/editor/new\|:id` | TypstEditorPage | Typst 编辑器 |
| 27 | `/admin/it-technology` | ITTechnologyPage | IT 技术管理 |
| 28 | `/admin/personal-programs` | PersonalProgramsPage | 个人节目管理 |
| 29 | `/admin/system` | SystemPage | 系统设置 |
| 30 | `*` | NotFoundPage | 404 页面 |

---

## 弹窗 / Dialog（12 个）

| # | 组件 | 文件 | 触发场景 |
|---|------|------|---------|
| 31 | CategoryManageModal | `Admin/Articles/CategoryManageModal.tsx` | 文章管理 → 分类管理 |
| 32 | CategoryEditDialog | （嵌套在 CategoryManageModal 内） | 新建/编辑分类 |
| 33 | MarkdownStyleManagerModal | `Admin/Articles/components/MarkdownStyleManagerModal.tsx` | 文章编辑器 → 样式管理 |
| 34 | UserDetailModal | `Admin/Users/components/UserDetailModal.tsx` | 用户管理 → 查看详情 |
| 35 | AgentDetail | `Admin/AIAgents/components/AgentDetail.tsx` | 智能体管理 → 查看详情 |
| 36 | AgentConfigModal | `Admin/ITTechnology/components/AgentConfigModal.tsx` | IT 技术 → AI 配置 |
| 37 | DetailModal（AgentData） | `Admin/AgentData/components/DetailModal.tsx` | 智能体数据 → 对话详情 |
| 38 | XbkAnalysisModal | `Xbk/components/XbkAnalysisModal.tsx` | 选课 → 分析报表 |
| 39 | XbkEditModal | `Xbk/components/XbkEditModal.tsx` | 选课 → 新建/编辑 |
| 40 | XbkDeleteModal | `Xbk/components/XbkDeleteModal.tsx` | 选课 → 删除确认 |
| 41 | XbkExportModal | `Xbk/components/XbkExportModal.tsx` | 选课 → 导出 Excel |
| 42 | XbkImportModal | `Xbk/components/XbkImportModal.tsx` | 选课 → 导入 Excel |

---

## 抽屉 / Sheet（3 个）

| # | 组件 | 文件 | 触发场景 |
|---|------|------|---------|
| 43 | ActivityDetailDrawer | `components/ActivityDetailDrawer.tsx` | 课堂互动/计划 → 活动详情 |
| 44 | TypstTocDrawer | `Admin/Informatics/typst/TypstTocDrawer.tsx` | Typst 编辑器 → 目录导航 |
| 45 | Informatics PDF Sheet | `Informatics/Reader.tsx` | 信息学阅读 → 移动端目录 |

---

## 浮动面板（3 个）

| # | 组件 | 文件 | 说明 |
|---|------|------|------|
| 46 | GroupDiscussionPanel | `AIAgents/GroupDiscussionPanel.tsx` | 可拖拽分组讨论窗口 |
| 47 | OptimizationDialog | `pythonLab/components/OptimizationDialog.tsx` | PythonLab 代码优化对比 |
| 48 | AIAssistantModal | `pythonLab/components/AIAssistantModal.tsx` | PythonLab AI 助手聊天 |

---

## 登录弹窗（2 个）

| # | 组件 | 文件 | 触发场景 |
|---|------|------|---------|
| 49 | LoginForm（BasicLayout） | `layouts/BasicLayout.tsx` | 未登录访问需认证功能 |
| 50 | LoginForm（AdminLayout） | `layouts/AdminLayout.tsx` | 未登录访问管理后台 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 公共页面 | 11 |
| 管理后台页面 | 19 |
| 弹窗 / Dialog | 12 |
| 抽屉 / Sheet | 3 |
| 浮动面板 | 3 |
| 登录弹窗 | 2 |
| **总计** | **50** |
