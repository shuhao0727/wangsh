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
├── core/              # 核心依赖、限流、缓存、会话守卫
├── group_discussion/  # 小组讨论访问控制、成员切换、消息流
├── informatics/       # Typst 笔记与 PDF 渲染
├── system/            # feature flags、metrics
├── users/             # 用户 CRUD 与导入
├── xbk/               # 校本课程结构、导入导出规则
├── xxjs/              # 点名相关测试
├── test_health.py     # 全局健康检查
├── test_pubsub.py     # pubsub 核心行为
└── test_xbk_performance.py
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

## 分层约定

- `backend/tests/`：pytest 单元/集成测试
- `backend/scripts/`：后端 smoke/soak/专项验证脚本
- `scripts/prod-smoke/`：生产环境全链路烟测编排

## 维护规则

- 不在这里放一次性排障脚本。
- 不提交 `__pycache__/`、`.pytest_cache/` 等缓存产物。
- 如果新增测试模块，同时更新本文件的目录说明。
