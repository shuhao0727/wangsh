# 后端测试文档

## 测试目录结构

```
tests/
├── auth/              # 认证相关测试 (3个)
├── group_discussion/  # 小组讨论测试 (4个)
├── assessment/        # 评估系统测试 (3个)
├── ai_agents/         # AI智能体测试 (7个)
├── core/              # 核心功能测试 (5个)
└── test_health.py     # 健康检查测试
```

## 运行测试

```bash
# 运行所有测试
pytest tests/

# 运行特定模块
pytest tests/auth/
pytest tests/group_discussion/
pytest tests/assessment/
pytest tests/ai_agents/
pytest tests/core/

# 运行单个测试文件
pytest tests/auth/test_auth_login.py
```

## 测试覆盖

- **认证 (auth/)**: 登录、登出、刷新token、nonce验证
- **小组讨论 (group_discussion/)**: 加入锁、消息发送、访问控制、班级范围
- **评估系统 (assessment/)**: 评估会话、画像生成、课堂服务流程
- **AI智能体 (ai_agents/)**: 路由鉴权、流式对话、OpenAI/OpenRouter、凭证解析、Flow优化
- **核心功能 (core/)**: 缓存NX、依赖注入、会话守卫、WebSocket、限流
