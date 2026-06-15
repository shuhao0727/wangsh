# 历史文档归档摘要

> 以下为项目早期阶段（2026年3-5月）的规划和分析文档的精简摘要。
> 完整内容可在 git 历史 `v1.5.x` 标签中查阅。

## 部署与迁移

- database-migration-fix: PostgreSQL 迁移脚本修复方案（解决 create_all 绕过 Alembic 导致状态不一致的问题）
- migration_analysis: Alembic 迁移链断裂分析（20260325_xbk_idx 修订丢失排查）

## 前端 UI 分析

- UI-ANALYSIS-DIALOGS-COMPRESSED: 12个弹窗组件的颜色硬编码和样式不一致问题分析
- UI-ANALYSIS-GLOBAL-RESIDUAL-COMPRESSED: 全局 grep 扫描残留硬编码问题汇总（已全部修复）
- UI-ANALYSIS-PUBLIC-PAGES-COMPRESSED: 11个公共页面的间距/颜色/尺寸硬编码问题分析
- UI-ANALYSIS-SHEETS-PANELS-COMPRESSED: 3个抽屉和3个浮动面板的样式问题分析（已全部修复）

## 项目规划

- execution-roadmap: 项目改进执行路线图（多阶段计划，后被 IMPROVEMENT_CHECKLIST 取代）
- three-module-improvement: 点名系统/系统管理/选课系统三模块联合改进计划
- ui-upgrade-plan: antd 到 shadcn/ui 渐进式迁移计划（主体已完成）
- ui-page-tracker: UI 单页治理台账（页面治理状态跟踪）
- IMPROVEMENT_CHECKLIST: 134项可执行改进检查清单（四阶段统一计划）
- HISTORICAL_PLANS_SUMMARY: 多个历史计划文档的合并总结
- week1-execution-plan-2026-04-10: 第一周执行计划（group_discussion 拆分、前端测试、DB 性能）

## 代码质量与架构分析

- code-quality-audit: 代码质量与安全清理审查（pub/sub 提取、dead code 移除等）
- PROJECT_AND_MODULE_ANALYSIS-COMPRESSED: 项目级和模块级深度分析报告（压缩合并版）
- auth-analysis: 认证系统深度分析与访客权限方案（已在 v1.5.3 解决）
- responsive-analysis: 响应式布局 clamp/vw 方案分析（已采纳并稳定运行）
- AGENT_ANALYSIS_2026-05-02: 三 Agent 并行只读审计报告（代码质量、架构、文档一致性）

## 文档治理

- document-consolidation-report-2026-04-11: 文档整理工作报告（位置混乱/重复/时效性问题修复）
- document-unification-report-2026-04-11: 文档统一化管理执行报告（文档数量减少66%）

## Bug 复盘

- PYTHONLAB_DEBUG_CONTINUE_REGRESSION_2026-04-08: PythonLab 调试 Continue 按钮卡死事故（Radix Tooltip 交互阻塞根因）

## 单页体检报告

- ui-page-reports/ai-agents: /ai-agents 页面 UI 体检报告（响应式、字号体系、间距密度问题）
