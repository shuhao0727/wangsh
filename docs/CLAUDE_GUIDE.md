# Claude AI 助手使用指南

> 最后更新：2026-03-26

## 概述

本项目使用 Claude AI 助手进行开发协作。Claude 会自动记忆项目的关键信息，帮助提高开发效率。

---

## Claude 记忆系统

### 记忆文件位置

Claude 的项目记忆存储在：
```
~/.claude/projects/-Users-wsh/memory/MEMORY.md
```

### 记忆内容

Claude 会自动记忆：
- 项目架构和技术栈
- 开发环境配置
- 端口分配和服务配置
- 已完成的功能模块
- UI 优化规则
- 常见问题和解决方案

---

## 使用建议

### 1. 开发前

告诉 Claude 你要做什么，它会：
- 检查相关的项目记忆
- 提供相关的代码位置
- 提醒注意事项

### 2. 开发中

Claude 会：
- 遵循项目的编码规范
- 使用项目约定的技术栈
- 保持代码风格一致

### 3. 开发后

Claude 会：
- 更新记忆文档（如有重要变更）
- 记录新的解决方案
- 更新配置信息

---

## 项目关键记忆

### 开发环境

- Docker Compose 启动：`docker compose -f docker-compose.dev.yml up -d`
- 必须包含：`typst-worker` 和 `pythonlab-worker`
- 开发访问：http://localhost:6608

### 端口分配

| 服务 | 端口 |
|------|------|
| 前端 | 6608 |
| 后端 | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Adminer | 8081 |

### UI 优化规则

1. 优先用 Tailwind CSS
2. inline style 只保留动态值
3. 不新增 .css 文件
4. hover 效果优先用 CSS
5. 色调统一：主色 `#0EA5E9`

---

## 常见任务

### 创建新功能

1. 告诉 Claude 功能需求
2. Claude 会检查现有代码
3. 提供实现方案
4. 编写代码并测试

### 修复 Bug

1. 描述问题现象
2. Claude 会查找相关代码
3. 分析根因
4. 提供修复方案

### 优化代码

1. 指定要优化的部分
2. Claude 会分析现有实现
3. 提供优化建议
4. 应用优化

---

## 注意事项

1. **记忆更新**：重要变更后，Claude 会自动更新记忆
2. **记忆准确性**：如发现记忆错误，及时纠正 Claude

---

## 相关文档

- [API 文档](./API.md)
- [部署指南](./DEPLOY.md)
