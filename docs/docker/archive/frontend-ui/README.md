# 前端 UI 归档索引

这里存放已完成修复、仅保留追溯价值的 UI 审计与复盘报告。

## 保留的全局快照

- [UI-ANALYSIS-GLOBAL-RESIDUAL.md](UI-ANALYSIS-GLOBAL-RESIDUAL.md) - 全局残留问题分析

说明：

- `UI-ANALYSIS-GLOBAL-RESIDUAL.md` 保留为最后一份全局残留快照。
- 早期中间快照 `UI-ANALYSIS-FULL-PROJECT.md`、`UI-ANALYSIS-FINAL-AUDIT.md` 已在本轮移除。
- 若要追溯具体页面或组件，请直接看下方范围审计文档。

## 范围审计

- [UI-ANALYSIS-ADMIN-PAGES.md](UI-ANALYSIS-ADMIN-PAGES.md) - 管理后台页面深度分析
- [UI-ANALYSIS-PUBLIC-PAGES.md](UI-ANALYSIS-PUBLIC-PAGES.md) - 公共页面深度分析
- [UI-ANALYSIS-DIALOGS.md](UI-ANALYSIS-DIALOGS.md) - Dialog 体系分析
- [UI-ANALYSIS-DEEP-DIALOGS.md](UI-ANALYSIS-DEEP-DIALOGS.md) - 弹窗与浮层深度审计
- [UI-ANALYSIS-SHEETS-PANELS.md](UI-ANALYSIS-SHEETS-PANELS.md) - 抽屉与浮动面板审计

## 归档约定

- 已归档报告默认不再作为当前治理入口
- 如需继续推进同类问题，应把有效规则抽到 `../../frontend/` 或 `../../plans/`
- 若审计结论再次失效，应产出新的报告，而不是继续在历史快照上叠加
- 优先保留“最后一份全局残留快照 + 按范围拆开的专题报告”，删除明显重复的中间快照
