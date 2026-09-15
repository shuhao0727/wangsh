---
status: active
owner: ops
最近复核: 2026-09-15
---

# Gateway 说明

`gateway/` 保存 WangSh 的 Caddy 网关配置，用于本地开发和生产反向代理。

## 文件说明

- `Caddyfile` - 生产候选网关配置
- `Caddyfile.dev` - 本地开发网关配置
- `Dockerfile` - 网关镜像构建文件
- `tests/test_caddy_config.sh` - Caddy 配置合同和 Docker 语法验证

## 生产候选治理

`Caddyfile` 只使用项目当前 Caddy 镜像（默认 `caddy:2.8.4`）提供的原生能力，不依赖第三方模块。

### 全站请求体上限

- 站点级 `request_body { max_size 16MB }` 位于所有路由处理器之前，覆盖 API、健康检查和前端入口；
- 超过 16 MiB 时客户端最终会收到 Caddy 的 `413 Request Entity Too Large`；但隔离实测发现，部分超限请求可能先有约 16 MB 前缀到达 upstream，因此当前不能把它表述为“超限请求绝不触达 upstream”；
- `servers.timeouts.read_body 30s` 负责慢请求时间预算，不替代大小上限；
- 16 MiB 高于当前后端导入请求预算（10 MiB）并留出 multipart 封装空间，后端业务限制仍然有效；
- 独立 Docker + mock upstream 已验证小请求正常、超限请求最终返回 413；同时观察到部分超限请求前缀可能到达 upstream。若要求“先完整缓冲、超限零转发”，仍需另设并验证可靠的边缘限制层。

### 通用入口限速

当前官方 Caddy 镜像没有本项目已验证的原生、按 IP/租户/全站请求速率限流器。不能把连接超时、keep-alive 或反代超时宣称为请求限速，也不能直接加入未经验证的 `rate_limit` 第三方模块。

因此当前安全方案是：

1. 网关保留请求体、请求头、慢请求和上游超时等基础保护；请求体 `413` 当前不能证明为零转发，发布前需由 WAF/LB/API Gateway 或经验证的缓冲层补足；
2. 公网入口的请求速率、并发连接、IP/租户配额和 DDoS/WAF 规则由受信任的 WAF/LB/API Gateway 实施；
3. 发布验收必须提供边缘设备的限速规则和压测证据，否则“通用入口限速”保持为**未完成/发布阻断项**，不伪造为已关闭。

`Caddyfile.dev` 保持开发热更新链路，不等同于生产候选安全边界。
## 使用说明

- 本地调试时优先查看 `Caddyfile.dev`
- 修改生产候选配置后运行：

  ```bash
  gateway/tests/test_caddy_config.sh
  ```

- 部署相关的完整说明请参考 `docs/docker/deploy/DEPLOY.md`
- 如果需要调整网关行为，先确认是否会影响开发和生产两个配置

## 相关文档

- [部署指南](../docs/docker/deploy/DEPLOY.md)
- [CI/CD 说明](../docs/docker/deploy/CICD.md)
