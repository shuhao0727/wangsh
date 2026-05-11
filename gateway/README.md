---
status: active
owner: ops
最近复核: 2026-05-10
---

# Gateway 说明

`gateway/` 保存 WangSh 的 Caddy 网关配置，用于本地开发和生产反向代理。

## 文件说明

- `Caddyfile` - 生产环境网关配置
- `Caddyfile.dev` - 本地开发网关配置
- `Dockerfile` - 网关镜像构建文件

## 使用说明

- 本地调试时优先查看 `Caddyfile.dev`
- 部署相关的完整说明请参考 `docs/docker/deploy/DEPLOY.md`
- 如果需要调整网关行为，先确认是否会影响开发和生产两个配置

## 相关文档

- [部署指南](../docs/docker/deploy/DEPLOY.md)
- [CI/CD 说明](../docs/docker/deploy/CICD.md)
