# 发布与运维记录

> 目标：集中记录每次发布的关键变更、配置影响、构建/部署步骤、验证结果与回滚点。

## v1.5.1（2026-03-24）

### 1. 变更范围

- 智能体对话稳定性修复（OpenRouter + 多平台并用）
- 登录时效切换为短时策略（Access 60 分钟 / Refresh 7 天）
- 版本号统一管理（单一来源）
- 文档与部署默认值同步到 `1.5.1`

关键提交：
- `d1f4798` `fix(auth,agents): harden login/session expiry and multi-provider stream reliability`
- `c633539` `chore(test): add frontend jest and babel config files`
- `9d50115` `chore(release): sync config and docs defaults to 1.5.1`
- `a5e3572` `chore(release): centralize version resolution via VERSION file`

### 2. 核心修复

- OpenRouter 运行时请求头与连接测试统一：`HTTP-Referer`、`X-Title`
- `/ai-agents/stream` 在上游 `HTTP 200` 且无文本时仍发送 `message_end`
- 前端流式引擎空结果明确报错（避免前端挂起/空消息）
- OpenRouter 全局 Key 不再兜底到 SiliconFlow 等非 OpenRouter endpoint

### 3. 配置影响

必看配置项：
- `ACCESS_TOKEN_EXPIRE_MINUTES=60`
- `REFRESH_TOKEN_EXPIRE_DAYS=7`
- `COOKIE_SECURE`：
  - HTTPS 生产建议 `true`
  - HTTP 场景需 `false`

多平台并用注意：
- OpenRouter 与 SiliconFlow 需分别在智能体配置中填写各自 `api_endpoint + api_key`

### 4. 版本统一机制

默认版本单一来源：
- 根目录 `VERSION`

脚本行为：
- `scripts/deploy.sh` / `build_images.sh` 优先读取 `VERSION`
- 自动派生：`APP_VERSION`、`IMAGE_TAG`、`REACT_APP_VERSION`
- 临时覆盖方式：
  - `VERSION_OVERRIDE=1.5.2 bash scripts/deploy.sh build`
  - `./build_images.sh 1.5.2`

### 5. 构建与部署（生产）

```bash
# 1) 确认版本
cat VERSION

# 2) 构建镜像
bash scripts/deploy.sh build

# 3) 推送镜像
bash scripts/deploy.sh push

# 4) 服务器拉取并启动
bash scripts/deploy.sh pull-up

# 5) 健康检查
bash scripts/deploy.sh health
```

### 6. 验证基线

- 后端测试：`105 passed`
- 前端测试：`53 suites / 280 tests passed`
- 前端 type-check：通过
- 前端 lint：`0 errors, 68 warnings`（基线告警）

### 7. 回滚参考

- 回滚到 `1.5.0`：
  - 将 `VERSION` 改为 `1.5.0`（或设置 `VERSION_OVERRIDE=1.5.0`）
  - 重新执行 `build/push/pull-up`

---

## 维护约定

- 每次发布后都在本文件追加新版本记录（按时间倒序）。
- 每条记录至少包含：`变更范围`、`配置影响`、`部署步骤`、`验证结果`、`回滚点`。
