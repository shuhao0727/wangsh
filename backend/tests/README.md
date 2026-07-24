# 后端测试说明

`backend/tests/` 只放 pytest 用例本体。专项 smoke/soak 脚本不放这里，统一收敛到 [`../scripts/README.md`](../scripts/README.md) 和 [`../../scripts/README.md`](../../scripts/README.md)。

## 当前结构

```text
tests/
├── ai_agents/         # AI 智能体接口、凭证、流式与兼容性
├── articles/          # 文章与分类相关行为
├── assessment/        # 测评配置、会话、画像、课堂联动
├── auth/              # 登录、登出、刷新、nonce
├── classroom/         # 课堂计划与课堂域服务
├── content/           # 学习内容、章节和内容访问边界
├── core/              # 核心依赖、限流、缓存、会话守卫
├── group_discussion/  # 小组讨论访问控制、成员切换、消息流
├── informatics/       # Typst 笔记与 PDF 渲染
├── it/                # IT 游戏资源上传、下载和安全校验
├── pythonlab/         # 沙箱、WebSocket、流程图、DAP 和资源限制
├── system/            # feature flags、metrics、迁移、bootstrap、生产 smoke 和治理合同
├── users/             # 用户 CRUD 与导入
├── xbk/               # 校本课程结构、导入导出规则
├── xxjs/              # 点名相关测试
├── test_health.py     # 全局健康检查
└── test_pubsub.py     # pubsub 核心行为
```

## 常用命令

```bash
# 运行全部 pytest
pytest -q

# 运行某个模块
pytest -q tests/auth
pytest -q tests/xbk
pytest -q tests/group_discussion

# 运行单个文件
pytest -q tests/auth/test_auth_login.py
```

真实 PostgreSQL 集成用例只允许连接到数据库名包含 `test`、`testing` 或 `ci` 的测试库。
本机可设置 `TEST_DATABASE_URL` 指向专用测试数据库；未设置且当前数据库不满足安全规则时，
相关用例会明确跳过，不会在业务库创建临时 schema。

## 分层约定

- `backend/tests/`：pytest 单元/集成测试
- `backend/scripts/`：后端 smoke/soak/专项验证脚本
- `scripts/prod-smoke/`：生产环境全链路烟测编排

## 维护规则

- 不在这里放一次性排障脚本。
- 不提交 `__pycache__/`、`.pytest_cache/` 等缓存产物。
- 如果新增测试模块，同步更新本文件的目录说明。

## 性能基线

以下是关键 API 端点的性能基线，用于手动回归测试：

| 端点 | 基线 | 说明 |
|------|------|------|
| `/api/v1/xbk/analysis/summary` | < 500ms | XBK 统计摘要 |
| `/api/v1/xbk/analysis/course-stats` | < 300ms | 课程统计 |

**验证方法**:
```bash
# 使用 curl + time 或 httpie
time curl -X GET "http://localhost:8000/api/v1/xbk/analysis/summary?year=2024&term=上学期" \
  -H "Authorization: Bearer $TOKEN"
```

**历史记录**: 性能测试文件于 2026-07 整理时移除（commit 39293d2），基线值保留于此作为手动验证参考。
