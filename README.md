# WangSh

## 本地开发

**开发配置**：请使用 `.env.dev`（可从 `.env.example` 复制）。`start-dev.sh` 会自动优先加载它。

```bash
cp .env.example .env.dev
bash start-dev.sh
```

停止：

```bash
bash stop-dev.sh
```

## 生产部署（Docker Compose）

**生产配置**：请使用 `.env` (复制自 `.env.example`)。

看文档： [docs/docker/deploy/DEPLOY.md](./docs/docker/deploy/DEPLOY.md)

最常用的部署命令（服务器上）：

```bash
cp .env.example .env
# 修改 .env 中的密钥和配置
bash scripts/deploy.sh deploy
```

`deploy` 会校验 release-set 后拉取并启动整组镜像。构建、推送、首次生成 release-set、
数据库备份和回滚步骤以部署文档为准，不使用 `up --build` 绕过发布门禁。

## PythonLab 验证

完整测试矩阵、GitHub Actions、退出码和故障排查由以下文档维护：

- [测试与验证索引](./docs/docker/testing/README.md)
- [CI/CD 说明](./docs/docker/deploy/CICD.md)
- [PythonLab 功能与验证](./docs/features/PYTHONLAB.md)

## 文档索引

### 总览入口
- 总文档索引：[docs/README.md](./docs/README.md)
- Docker 文档中心：[docs/docker/README.md](./docs/docker/README.md)
- 测试与验证索引：[docs/docker/testing/README.md](./docs/docker/testing/README.md)
- 计划与分析索引：[docs/docker/plans/README.md](./docs/docker/plans/README.md)
- 前端 UI 文档索引：[docs/docker/frontend/README.md](./docs/docker/frontend/README.md)

### 核心文档
- 接口清单：[docs/development/API.md](./docs/development/API.md)
- 部署指南：[docs/docker/deploy/DEPLOY.md](./docs/docker/deploy/DEPLOY.md)
- CI/CD 说明：[docs/docker/deploy/CICD.md](./docs/docker/deploy/CICD.md)
- 发布与运维记录：[docs/docker/RELEASE_NOTES.md](./docs/docker/RELEASE_NOTES.md)

### 功能模块文档
- AI 智能体系统：[docs/features/AI_AGENTS.md](./docs/features/AI_AGENTS.md)
- 课堂互动系统：[docs/features/CLASSROOM.md](./docs/features/CLASSROOM.md)
- 信息学竞赛笔记：[docs/features/INFORMATICS.md](./docs/features/INFORMATICS.md)
- PythonLab 调试环境：[docs/features/PYTHONLAB.md](./docs/features/PYTHONLAB.md)
- 自主检测系统：[docs/features/assessment/ASSESSMENT_DESIGN.md](./docs/features/assessment/ASSESSMENT_DESIGN.md)
- 前端实时更新：[docs/features/AUTO_REFRESH.md](./docs/features/AUTO_REFRESH.md)

### 其他文档
- 文档维护规范：[docs/DOCUMENTATION_RULES.md](./docs/DOCUMENTATION_RULES.md)
- Agent 协作规则：[AGENTS.md](./AGENTS.md)
- Docker 历史归档：[docs/docker/archive/README.md](./docs/docker/archive/README.md)
- 后端测试说明：[backend/tests/README.md](./backend/tests/README.md)
- 后端 smoke/soak 脚本说明：[backend/scripts/README.md](./backend/scripts/README.md)
- 根层脚本说明：[scripts/README.md](./scripts/README.md)
- 前端脚本说明：[frontend/scripts/README.md](./frontend/scripts/README.md)
- 网关说明：[gateway/README.md](./gateway/README.md)
- XBK 脚本说明：[scripts/xbk/README.md](./scripts/xbk/README.md)
