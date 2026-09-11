# 真实代理链验收报告（2026-09-11）

> 状态：archived
> Owner：project-governance
> 证据根：/tmp/wangsh-accept/（容器/网络/卷已清理，仅留本报告与镜像）
> 镜像：wangsh-accept/wangsh-backend|frontend|gateway:proxy-accept-1（当前工作区含全部未提交改动）

## 一、环境与拓扑

- 独立 compose 项目 `wangshaccept`、独立网络/卷/容器名；宿主端口仅 gateway `127.0.0.1:16610→80`。
- 生产 Caddyfile、生产 Dockerfile、生产启动链（preflight→bootstrap→alembic upgrade head→bootstrap→uvicorn）原样使用。
- 空库完整迁移至 head `20260910_0001_auth_authority`，gate 初始 `ready=f`。
- 关键环境：`AUTH_USER_UNIQUE_PER_IP=true`、`AUTH_ENFORCE_SAME_IP_PER_REQUEST=true`、`AUTH_TRUST_X_FORWARDED_FOR=true`、`COOKIE_SECURE=false`（裸 HTTP 网关现状）。
- 正常栈（wangsh-*）全程未触碰；测试过程中未修改正常库/镜像/部署栈。

## 二、场景结果

| # | 场景 | 结果 | 证据 |
|---|---|---|---|
| S0 | gate 关闭时经代理登录 | **503**「认证持久状态尚未完成受控迁移」 | DB `ready=f`；curl 日志 |
| S1 | 受控 enrollment（CLI dry-run→apply）后登录 | dry-run `{preserved:0,reauthenticate:0}`；apply 后 gate=`t`；登录恢复 **200** | `cutover.py` 输出；DB 行 |
| S2 | 伪造 `X-Forwarded-For`/`X-Real-IP`/`Forwarded` 经网关登录 B | 登录 200，DB 绑定 IP 为**真实宿主** `192.168.65.1`（头被 Caddy 清洗，未采用 9.9.9.9/8.8.8.8/7.7.7.7）；同 IP 替换立即生效（A `active=f`） | `auth_session_states` 行 |
| S3 | 同 IP A→B：A 旧 access/refresh 经代理重放 | access **401**「会话已失效」；refresh **401**「无效或过期的刷新令牌」；B 会话保持 200，refresh 轮换 200 | curl 时间线 |
| S4 | A→B→A 循环 | A 重新登录 200 后 B 被替换（`active=f`）；B 旧 access/refresh 均 401；A 新会话 200 | DB 行 + curl |
| S5 | 不同来源 IP（合成 client2 容器 `192.168.128.7`）登录 B | A（`192.168.65.1`）保持 `active=t` **未互踢**；B 从 client2 签发的 token 在宿主 IP 重放被 401「登录环境已变更」（每请求 IP 强校验生效） | DB 行 + curl |
| S6 | 拓扑防护审计 | 宿主端口映射只有 gateway 16610（正常栈 6608）；backend/postgres/redis 均无宿主映射；宿主无法直达 backend | `docker ps` 端口清单 |
| S7 | 直连后端（网络内绕过网关）伪造 XFF | **治理后（proxy-accept-2 镜像复测）**：不可信 peer `10.50.0.6` 直连 backend 伪造 `X-Forwarded-For: 6.6.6.6`，DB 绑定**真实 peer `10.50.0.6`**（治理前会绑定 6.6.6.6）；经可信网关（`10.50.0.10/32`）路径不受影响 | DB 行 + curl |

## 三、结论

1. **经网关路径验收通过**：头清洗（S2）、同 IP 替换撤销（S3）、A→B→A 循环（S4）、
   不同 IP 不互踢 + 每请求 IP 强校验（S5）、拓扑防护（S6）全部符合持久会话权威合同。
2. **S7 已治理（2026-09-11 复测）**：新增 `AUTH_TRUSTED_PROXY_CIDRS` 可信代理网段配置，
   fail-closed（为空即不信任任何转发头），settings 启动校验 CIDR 合法性；不可信 peer
   直连后端伪造头已被忽略，DB 绑定真实 peer IP。回归测试
   `tests/core/test_session_guard_proxy_trust.py` 5 项覆盖，后端全量 3042 passed。
3. 认证代理链验收通过（S0–S7）不等于全站发布验收；真实 NAT/机房共享 IP、跨主机
   多副本、压力与迁移回滚仍开放。
