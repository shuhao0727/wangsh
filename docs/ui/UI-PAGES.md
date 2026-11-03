# 前端路由入口与重点浮层

> 状态：reference
> Owner：frontend
> 最近复核：2026-10-31（入口、文件路径与导出名核对）
> 范围：已登记的重点弹窗、抽屉、浮动面板；不是组件目录的穷举清单。

页面路由以 [App.tsx](../../frontend/src/App.tsx) 为准；页面族、整理顺序和用户确认状态
统一维护在[整理路线图](UI_REDESIGN_ROADMAP.md)。本页只补充浮层位置，不重复维护页面表与总数。
视觉规则见[嵌入式规范](EMBEDDED_UI_STYLE_GUIDE.md)；本次未重新验收页面或浮层交互。

## 路由与组件命名

`App.tsx` 的懒加载常量名可能不同于模块默认导出名；导入时以实际模块为准：

| 模块 | 默认导出名 |
|---|---|
| `frontend/src/pages/Informatics/index.tsx` | `InformaticsReaderPage` |
| `frontend/src/pages/MindmapGallery.tsx` | `MindmapGallery` |
| `frontend/src/pages/MindmapPreview.tsx` | `MindmapPreview` |

## 弹窗 / Dialog

文件路径以下均从仓库根目录起算；分类编辑弹窗嵌套在分类管理组件中。

| 组件 | 文件 | 触发场景 |
|---|---|---|
| CategoryManageModal | `frontend/src/pages/Admin/Articles/CategoryManageModal.tsx` | 文章管理 → 分类管理 |
| CategoryEditDialog | 同上，嵌套组件 | 新建/编辑分类 |
| MarkdownStyleManagerModal | `frontend/src/pages/Admin/Articles/components/MarkdownStyleManagerModal.tsx` | 文章编辑器 → 样式管理 |
| UserDetailModal | `frontend/src/pages/Admin/Users/components/UserDetailModal.tsx` | 用户管理 → 查看详情 |
| AgentDetail | `frontend/src/pages/Admin/AIAgents/components/AgentDetail.tsx` | 智能体管理 → 查看详情 |
| AgentConfigModal | `frontend/src/pages/Admin/ITTechnology/components/AgentConfigModal.tsx` | IT 技术 → AI 配置 |
| DetailModal（AgentData） | `frontend/src/pages/Admin/AgentData/components/DetailModal.tsx` | 智能体数据 → 对话详情 |
| XbkAnalysisModal | `frontend/src/pages/Xbk/components/XbkAnalysisModal.tsx` | 选课 → 分析报表 |
| XbkEditModal | `frontend/src/pages/Xbk/components/XbkEditModal.tsx` | 选课 → 新建/编辑 |
| XbkDeleteModal | `frontend/src/pages/Xbk/components/XbkDeleteModal.tsx` | 选课 → 删除确认 |
| XbkExportModal | `frontend/src/pages/Xbk/components/XbkExportModal.tsx` | 选课 → 导出 Excel |
| XbkImportModal | `frontend/src/pages/Xbk/components/XbkImportModal.tsx` | 选课 → 导入 Excel |

## 抽屉 / Sheet

| 组件 | 文件 | 触发场景 |
|---|---|---|
| ActivityDetailDrawer | `frontend/src/components/ActivityDetailDrawer.tsx` | 课堂互动/计划 → 活动详情 |
| TypstTocDrawer | `frontend/src/pages/Admin/Informatics/typst/TypstTocDrawer.tsx` | Typst 编辑器 → 目录导航 |
| Informatics PDF Sheet | `frontend/src/pages/Informatics/Reader.tsx` | 信息学阅读 → 移动端目录 |

## 浮动面板

| 组件 | 文件 | 说明 |
|---|---|---|
| GroupDiscussionPanel | `frontend/src/pages/AIAgents/GroupDiscussionPanel.tsx` | 可拖拽分组讨论窗口 |
| OptimizationDialog | `frontend/src/pages/Admin/ITTechnology/pythonLab/components/OptimizationDialog.tsx` | PythonLab 代码优化对比 |

浮层随宿主页面一起验证，检查开关、焦点、滚动、权限和错误状态；方法见[回归基线](ui-single-page-governance.md)。
