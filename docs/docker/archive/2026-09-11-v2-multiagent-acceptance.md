# v2.0 真实栈多 Agent 验收报告（2026-09-11）

> 状态：archived
> Owner：project-governance
> 环境：独立 compose 项目 `v2accept`（网关宿主端口 16610，8 容器），镜像 `shuhao07/*:2.0`
> 数据：空库启动链自动迁移至 head + 受控 enrollment；XBK 使用 `~/Desktop/校本上课` 真实名单/课程/选课文件

## 验收结论

**27 项通过 / 3 项口径不符（无产品缺陷）**。

| 域 | 通过 | 口径项 | 关键证据 |
|---|---|---|---|
| 认证会话闭环 | 5 | 0 | gate 登录 200；伪造 XFF 被 Caddy 清洗（DB 绑定真实宿主 IP）；logout 后旧凭据全 401；同 IP A→B 替换生效；直连后端伪造头被 S7 治理忽略（绑定真实 peer 10.50.0.66） |
| XBK 业务 | 8 | 0 | 学年字符串格式；真实名单 import/preview 974/974 有效、inserted=974；export XLSX openpyxl 读回学年列全部 str；删除/清理恢复干净 |
| 前端网关 | 5 | 1 | 首页/静态资源 200 + 长期缓存头；backend 无宿主端口映射；无 5xx/堆栈泄露 |
| 运维迁移 | 9 | 2 | head=20260910_0001_auth_authority；ready=t；check_migration_state exit 0；bootstrap 幂等；worker 日志无 ERROR；6 应用镜像 tag 2.0 |

## 3 项口径不符的裁定

1. **XBK 未带 token 期望 401 实得 403/404**：真实路由为 `/api/v1/xbk/data/students`；功能未开放时
   `require_xbk_access` 的可选鉴权 + feature flag 检查返回 403「XBK 未开放」是既有设计
   （`_common.py:23-35`），非鉴权缺陷。验收任务写错了路径与状态码预期。
2. **sandbox 占位容器非 network none**：compose 中该服务仅为镜像构建/预拉取（`sleep infinity`），
   真正用户调试容器由 backend 运行时动态加 `--network none`（`sandbox/docker.py:365`）。
3. **sandbox 占位容器无 healthcheck**：同为占位服务定位，不属于验收目标。

## 未覆盖

真实 NAT 共享 IP、多副本并发压力、跨主机部署、TTL/迁移回滚演练；镜像推送（Docker Hub 凭据待刷新）。
