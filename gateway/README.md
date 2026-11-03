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
- `tests/test_caddy_config.sh` - 静态合同检查后执行 Docker/Caddy 语法验证
- `tests/validate_caddy_contract.py` - stdlib 请求体静态合同（不导入后端应用）
- `tests/test_caddy_contract.py` - stdlib unittest，含真实配置及合成反例回归

## 生产候选治理

`Caddyfile` 只使用项目当前 Caddy 镜像（默认 `caddy:2.8.4`）提供的原生能力，不依赖第三方模块。

### 全站请求体上限

- 按路径分两条 `request_body`（2026-11-02 订正 C41）：`/api/v1/admin/it/games` 使用明确的
  `max_size 526385152` 字节（502 MiB），覆盖 `backend/app/core/request_budget.py` 的
  `GAME_UPLOAD_BUDGET`；后端仍单独限制文件为 500 MiB，另留 2 MiB 给 multipart。
  Caddy 的 `500MB` 只有 500,000,000 字节，小于文件和完整请求预算，不能代替 500 MiB。
- 其余路径继续保持 `16MB`（16,000,000 字节，不是 16 MiB），高于后端普通导入请求预算
  12 MiB；后端业务限制仍然有效。
- 为什么用「具名 matcher 排除」而不是分层叠加：站点级 `request_body` 是独立 handler、
  先于所有 route 执行，外层 `http.MaxBytesReader` 仍是底层 reader，内层更大额度读不到。
- 超过各自上限时客户端收到 Caddy 的 `413 Request Entity Too Large`；历史隔离实测发现部分
  超限请求可能先有约上限大小的前缀到达 upstream，不能表述为“超限请求绝不触达 upstream”。
- `servers.timeouts.read_body 30s` 是整次上传的硬截止且无法按路径放宽；保持 30s 是有意取舍
  （放宽会扩大 slowloris 窗口）。502 MiB / 30s 约需 17.6 MB/s，仅为算术估计；慢链路仍可能超时。
- 历史 Docker + mock upstream 证据仅覆盖当时的小请求及超限 413；本次字节预算订正未重跑
  Caddy adapt、真实代理或大文件上传，不将静态合同通过视为端到端验收。

### 通用入口限速

当前官方 Caddy 镜像没有本项目已验证的原生、按 IP/租户/全站请求速率限流器。不能把连接超时、keep-alive 或反代超时宣称为请求限速，也不能直接加入未经验证的 `rate_limit` 第三方模块。

因此当前安全方案是：

1. 网关保留请求体、请求头、慢请求和上游超时等基础保护；请求体 `413` 当前不能证明为零转发，发布前需由 WAF/LB/API Gateway 或经验证的缓冲层补足；
2. 公网入口的请求速率、并发连接、IP/租户配额和 DDoS/WAF 规则由受信任的 WAF/LB/API Gateway 实施；
3. 发布验收必须提供边缘设备的限速规则和压测证据，否则“通用入口限速”保持为**未完成/发布阻断项**，不伪造为已关闭。

`Caddyfile.dev` 保持开发热更新链路，不等同于生产候选安全边界。
## 使用说明

- 本地调试时优先查看 `Caddyfile.dev`
- 不启动 Docker/Caddy 的静态回归（只读网关配置和后端预算源码，合成 fixture 在临时目录）：

  ```bash
  python3 -I -B gateway/tests/test_caddy_contract.py -v
  python3 -I -B gateway/tests/validate_caddy_contract.py \
    gateway/Caddyfile backend/app/core/request_budget.py
  ```

  helper 只支持现有单行指令、独占行大括号和指定具名 matcher，不是通用 Caddy parser。
  它按作用域核对游戏路径、互补 fallback、两个 `request_body` 和真实 `read_body 30s`；
  `max_size` 支持正整数字节（无后缀或 `B`）、十进制 `MB` 和二进制 `MiB`。
  后端预算只用 AST 读取 `GAME_UPLOAD_BUDGET` 的整数、常量引用、加法与乘法，不执行源码；
  缺项、注释伪满足、歧义、不支持的表达式或后端预算超过网关时直接失败，不静默跳过。
  既有 SSE 全文路径检查未在本轮升级为精确 matcher/动态调用合同（C33 仍未扩展）。
- 已获准运行 Docker 时，修改生产候选配置后使用完整入口（先调用上述 helper，再执行 `docker run ... caddy adapt`）：

  ```bash
  gateway/tests/test_caddy_config.sh
  ```

- 部署相关的完整说明请参考 `docs/operations/DEPLOY.md`
- 如果需要调整网关行为，先确认是否会影响开发和生产两个配置

## 相关文档

- [部署指南](../docs/operations/DEPLOY.md)
- [CI/CD 说明](../docs/operations/CICD.md)
