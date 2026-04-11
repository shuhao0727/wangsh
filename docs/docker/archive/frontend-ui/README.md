# 前端 UI 归档索引

这里存放已完成修复、仅保留追溯价值的 UI 审计与复盘报告。

## 压缩版本说明

为减少文档体积，所有详细分析报告已压缩为精简版本。压缩版本仅保留核心结论和关键发现，原始详细报告已备份。

## 压缩版文档

- [UI-ANALYSIS-PUBLIC-PAGES-COMPRESSED.md](UI-ANALYSIS-PUBLIC-PAGES-COMPRESSED.md) - 公共页面分析（压缩版，3KB）
- [UI-ANALYSIS-DIALOGS-COMPRESSED.md](UI-ANALYSIS-DIALOGS-COMPRESSED.md) - 弹窗组件分析（压缩版，2KB）
- [UI-ANALYSIS-SHEETS-PANELS-COMPRESSED.md](UI-ANALYSIS-SHEETS-PANELS-COMPRESSED.md) - 抽屉和面板分析（压缩版，1.5KB）
- [UI-ANALYSIS-GLOBAL-RESIDUAL-COMPRESSED.md](UI-ANALYSIS-GLOBAL-RESIDUAL-COMPRESSED.md) - 全局残留问题分析（压缩版，1.8KB）

## 原始详细报告（备份）

> **注意**：以下为原始详细报告，包含大量表格和详细分析，仅用于历史追溯。

- [UI-ANALYSIS-ADMIN-PAGES.md](UI-ANALYSIS-ADMIN-PAGES.md) - 管理后台页面深度分析（12KB）
- [UI-ANALYSIS-PUBLIC-PAGES.md](UI-ANALYSIS-PUBLIC-PAGES.md) - 公共页面深度分析（25KB）
- [UI-ANALYSIS-DIALOGS.md](UI-ANALYSIS-DIALOGS.md) - Dialog 体系分析（12KB）
- [UI-ANALYSIS-DEEP-DIALOGS.md](UI-ANALYSIS-DEEP-DIALOGS.md) - 弹窗与浮层深度审计（8.6KB）
- [UI-ANALYSIS-SHEETS-PANELS.md](UI-ANALYSIS-SHEETS-PANELS.md) - 抽屉与浮动面板审计（11KB）
- [UI-ANALYSIS-GLOBAL-RESIDUAL.md](UI-ANALYSIS-GLOBAL-RESIDUAL.md) - 全局残留问题分析（11KB）

## 归档约定

- 已归档报告默认不再作为当前治理入口
- 如需继续推进同类问题，应把有效规则抽到 `../../frontend/` 或 `../../plans/`
- 若审计结论再次失效，应产出新的报告，而不是继续在历史快照上叠加
- 优先保留“最后一份全局残留快照 + 按范围拆开的专题报告”，删除明显重复的中间快照
