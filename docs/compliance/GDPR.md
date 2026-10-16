# GDPR 合规指南

## 概述

本文档描述 WangSh 教育平台如何遵守《通用数据保护条例》(GDPR) 的要求，以及用户如何行使其数据权利。

## 数据收集和使用

### 收集的数据类型

1. **用户基本信息**
   - 用户名、全名、学号
   - 班级、学年
   - 角色信息（学生、教师、管理员）

2. **使用数据**
   - AI 对话记录
   - 小组讨论消息
   - 课堂互动记录
   - 学习进度和测评结果

3. **技术数据**
   - IP 地址（仅用于安全审计）
   - 浏览器信息（User Agent）
   - 登录会话信息

### 数据使用目的

- **教学服务**：提供 AI 辅导、课堂互动、作业评测等教学功能
- **学习分析**：生成学习报告，帮助教师了解学生学习情况
- **系统安全**：防止未授权访问，保护用户账号安全
- **服务改进**：分析使用模式，优化教学效果

### 法律依据

- 履行教育服务合同
- 用户明确同意
- 遵守法律义务
- 保护用户或他人的合法利益

## 用户权利

根据 GDPR，用户享有以下权利：

### 1. 访问权（Right to Access）

用户有权知道我们收集了哪些个人数据。

**行使方式**：
- 登录系统后访问个人中心
- 查看自己的所有对话记录、讨论消息等

### 2. 数据可携带权（Right to Data Portability）

用户有权以结构化、常用且机器可读的格式获取其数据。

**API 端点**：
```
GET /api/users/privacy/me/export
```

**返回内容**：
- JSON 格式的完整用户数据
- 包含所有对话记录、讨论消息、学习记录等

**使用示例**：
```bash
curl -X GET "https://your-domain.com/api/users/privacy/me/export" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o my-data.json
```

### 3. 被遗忘权（Right to Erasure）

用户有权要求删除其个人数据。

**API 端点**：
```
DELETE /api/users/privacy/me/data
```

**请求体**：
```json
{
  "confirmation": "DELETE MY DATA"
}
```

**删除范围**：
- 所有对话记录
- 所有小组讨论消息
- 相关的学习记录和分析数据

**注意事项**：
- ⚠️ **此操作不可逆**
- 审计日志将被保留（法律要求）
- 某些匿名化的统计数据可能保留用于教学研究

**使用示例**：
```bash
curl -X DELETE "https://your-domain.com/api/users/privacy/me/data" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmation": "DELETE MY DATA"}'
```

### 4. 数据摘要查询

在删除前，用户可以查看将被删除的数据摘要。

**API 端点**：
```
GET /api/users/privacy/me/data-summary
```

**返回示例**：
```json
{
  "user_id": 123,
  "data_summary": {
    "conversations": 45,
    "discussion_messages": 12
  },
  "warning": "删除操作将永久移除所有数据且不可恢复"
}
```

### 5. 更正权（Right to Rectification）

用户有权要求更正不准确的个人数据。

**行使方式**：
- 在个人中心自行修改基本信息
- 联系系统管理员更正无法自行修改的数据

### 6. 限制处理权（Right to Restriction of Processing）

用户有权要求限制对其数据的处理。

**行使方式**：
- 联系系统管理员提出请求
- 处理时间：5 个工作日内

### 7. 反对权（Right to Object）

用户有权反对基于合法利益的数据处理。

**行使方式**：
- 联系系统管理员提出反对
- 我们将评估并停止相关处理

## 数据保护措施

### 技术措施

- **传输加密**：所有数据传输使用 HTTPS/TLS 加密
- **存储加密**：敏感数据（如 API 密钥）加密存储
- **访问控制**：基于角色的权限管理（RBAC）
- **会话安全**：JWT 令牌 + Cookie 双重验证

### 组织措施

- **最小化原则**：只收集必要的数据
- **数据保留期限**：
  - 活跃用户数据：账号存续期间
  - 审计日志：永久保留（法律要求）
  - 归档对话：按教学需求保留，可随时删除
- **访问审计**：关键操作记录审计日志

### 审计日志

系统记录以下关键操作：

- `EXPORT_DATA`：用户导出数据
- `DELETE_DATA`：用户删除数据
- `VIEW_CONVERSATION`：查看敏感对话（可选）

审计日志包含：
- 操作时间
- 用户 ID
- IP 地址
- 操作类型和资源

## 数据处理者和接收者

### 内部访问

- **教师**：可查看所属班级学生的学习数据
- **管理员**：可管理系统和用户数据
- **系统运维**：仅在必要时访问，受监控

### 第三方服务

- **AI 服务提供商**：用户对话内容发送至配置的 AI 服务（如 DeepSeek、OpenAI）
  - 用户同意后进行
  - 遵守第三方隐私政策
- **基础设施提供商**：数据存储在云服务器（如阿里云、AWS）

### 数据传输

- 所有数据存储在中国境内
- 如使用国际 AI 服务，对话内容可能传输至境外
- 用户将在使用前获得明确告知

## 用户同意管理

系统记录用户对以下事项的同意：

- `AI_USAGE`：同意使用 AI 服务
- `DATA_ANALYSIS`：同意参与学习数据分析
- `MARKETING`：同意接收教学活动通知（可选）

用户可随时撤回同意。

## 数据泄露响应

如发生数据泄露：

1. **72 小时内**通知监管机构
2. **及时通知**受影响用户
3. **采取措施**防止进一步泄露
4. **评估影响**并记录事件

## 投诉和联系方式

如对数据处理有疑问或投诉：

**联系方式**：
- 邮箱：privacy@your-domain.com
- 管理员：通过系统内消息联系

**投诉渠道**：
- 向学校数据保护官投诉
- 向当地数据保护监管机构投诉

**处理时限**：
- 一般查询：5 个工作日
- 数据访问/删除请求：10 个工作日
- 复杂案例：最长 1 个月，并说明原因

## 未成年人保护

- 学生用户可能为未成年人
- 需取得监护人同意（通过学校）
- 提供额外的隐私保护措施
- 不收集不必要的个人信息

## 政策更新

- 本隐私政策可能更新
- 重大变更将通知用户
- 最新版本日期：2026-10-01

## 开发者文档

### API 集成

开发人员需要遵守以下原则：

1. **数据最小化**：只请求必要的用户数据
2. **明确告知**：清楚说明数据用途
3. **安全传输**：使用 HTTPS
4. **访问控制**：正确使用认证和授权

### 示例代码

**导出用户数据**：
```python
import httpx

async def export_user_data(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.example.com/api/users/privacy/me/export",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        response.raise_for_status()
        return response.json()
```

**删除用户数据**：
```python
async def delete_user_data(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            "https://api.example.com/api/users/privacy/me/data",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"confirmation": "DELETE MY DATA"}
        )
        response.raise_for_status()
        return response.json()
```

## 附录：技术实现

### 数据库表

- `sys_audit_logs`：审计日志
- `sys_user_consents`：用户同意记录

### Migration

```bash
# 应用迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

### 测试

```bash
# 运行 GDPR 合规测试
pytest -v tests/users/test_gdpr_compliance.py
```

## 相关法规

- GDPR（欧盟通用数据保护条例）
- 《中华人民共和国个人信息保护法》
- 《中华人民共和国网络安全法》
- 《中华人民共和国数据安全法》

---

**最后更新**：2026 年 10 月 1 日
**版本**：1.0.0
**所有者**：WangSh 项目团队
