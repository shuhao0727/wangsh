# Docker 文档中心

`docs/docker/` 现在承接项目里和 Docker 生产部署、运维协作、测试治理、前端专项整理、阶段计划归档有关的通用 Markdown 文档。

这里的目标只有两个：

- 让通用说明文件集中，不再散落在仓库根层
- 不去打扰模块就近说明，例如 `backend/tests/README.md`、`backend/docker/pythonlab-sandbox/README.md`、`scripts/xbk/README.md`

## 当前结构

- [RELEASE_NOTES.md](RELEASE_NOTES.md) - 发布记录与运维变更
- [deploy/DEPLOY.md](deploy/DEPLOY.md) - Docker 开发/生产部署指南
- [deploy/CICD.md](deploy/CICD.md) - 镜像、工作流与 CI/CD 说明
- [testing/README.md](testing/README.md) - 测试与验证入口
- [frontend/README.md](frontend/README.md) - 前端专项文档入口
- [plans/README.md](plans/README.md) - 阶段计划、治理台账入口
- [archive/README.md](archive/README.md) - 历史归档总入口

## 归档规则

- 当前仍需执行、维护、复用的说明：放在 `deploy/`、`testing/`、`frontend/`、`plans/`
- 已完成、仅保留追溯价值的历史说明：放在 `archive/`
- 模块专用说明：继续就近放在模块目录，不强行搬迁
