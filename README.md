# WangSh

高中信息技术教学管理平台，集成 AI 智能体、PythonLab 调试环境、信息学竞赛笔记、课堂互动等功能。

## 快速启动

### 本地开发

```bash
# 复制开发配置
cp .env.example .env.dev

# 启动开发环境（前端 6608，后端 8000）
bash start-dev.sh

# 停止
bash stop-dev.sh
```

**开发端口**：前端 `http://localhost:6608`，后端 `http://localhost:8000`

### 生产部署

```bash
# 复制生产配置并修改密钥
cp .env.example .env

# 部署（校验 + 拉取 + 启动）
bash scripts/deploy.sh deploy
```

**详细文档**：[docs/docker/deploy/DEPLOY.md](./docs/docker/deploy/DEPLOY.md)

---

## 文档导航

| 类型 | 链接 | 说明 |
|------|------|------|
| **总索引** | [docs/README.md](./docs/README.md) | 所有文档的导航入口 |
| **部署运维** | [docs/docker/README.md](./docs/docker/README.md) | Docker 完整指南 |
| **开发规范** | [AGENTS.md](./AGENTS.md) | Claude Agent 协作规则 |
| **API 接口** | [docs/development/API.md](./docs/development/API.md) | 后端接口清单 |

**功能模块文档**：`docs/features/` 目录包含所有功能详细说明（AI 智能体、PythonLab、课堂系统等）

---

## 技术栈

- **前端**: React + TypeScript + Ant Design
- **后端**: FastAPI + SQLAlchemy + PostgreSQL + Redis
- **容器**: Docker + Docker Compose
- **AI**: Claude API（Anthropic）

---

## 项目结构

```
wangsh/
├── frontend/          # React 前端
├── backend/           # FastAPI 后端
├── gateway/           # Nginx 网关
├── docs/              # 文档中心
└── scripts/           # 部署与验证脚本
```

完整说明见 [docs/README.md](./docs/README.md)
