# 数据库设计文档 v3.0

## 概述

当前数据库包含核心表，并统一了用户系统，增强了数据保护机制。

最后更新时间：2026-02-09  
数据库版本：v3.1（模型自动发现增强版）

## 表清单（节选）

| 表名 | 描述 |
| --- | --- |
| alembic_version | 迁移版本表 |
| sys_users | 统一用户表 |
| sys_permissions | 权限定义表 |
| sys_role_permissions | 角色权限映射表 |
| wz_articles | 文章表 |
| wz_categories | 分类表 |
| znt_agents | 智能体配置表 |
| znt_conversations | 对话记录表 |
| znt_group_discussion_sessions | 小组讨论会话表 |
| znt_group_discussion_messages | 小组讨论消息表 |
| znt_group_discussion_analyses | 小组讨论分析表 |
| inf_typst_notes | Typst 笔记 |
| inf_typst_assets | Typst 资源 |
| inf_typst_styles | Typst 样式 |
| inf_typst_categories | Typst 分类 |

更详细字段与索引说明可参考历史文档版本（如需我可以再把原文归档到 docs/archive）。
