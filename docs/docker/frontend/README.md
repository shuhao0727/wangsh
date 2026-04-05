# 前端 UI 文档索引

`docs/docker/frontend/` 存放前端专项的 UI 审计、页面清单和视觉规范，重点是界面治理，不替代 [`docs/`](../../README.md) 中的正式功能文档。涉及推进计划和治理台账时，配合查看 [`../plans/README.md`](../plans/README.md)。

## 当前保留文档

- [UI-PAGES.md](UI-PAGES.md) - 前端可见页面清单
- [ui-style-guardrails.md](ui-style-guardrails.md) - UI 风格护栏和视觉约束

## 归档报告

- [../archive/frontend-ui/README.md](../archive/frontend-ui/README.md) - 历史 UI 审计与修复报告索引

## 当前策略

- 入口层只保留可持续复用的页面清单和样式规则。
- 带明确时间戳、且已标记“问题全部修复”的 UI 审计报告统一转入 `../archive/frontend-ui/`。
- 如果未来继续做专项 UI 审计，先生成新报告，确认完成后再转入归档。

## 保留 / 归档 / 删除

- 保留：页面清单、视觉规范、长期治理规则。
- 归档：一次性审计、修复快照、最终复盘报告。
- 删除：自动生成且可重建的分析产物。本轮未直接删除作者撰写的 UI 报告正文。
