# XSS 防护与 Prompt Injection 检测

本文档说明 WangSh 项目中的 XSS（跨站脚本攻击）防护策略和 Prompt Injection（提示词注入）检测机制。

## 概述

用户输入的内容可能包含恶意 HTML 标签或脚本代码，也可能包含试图操纵 AI 智能体行为的恶意指令。为了防止这些攻击，系统实施了多层防护。

## 防护策略

### 1. HTML 转义

所有用户可见的文本字段（名称、描述等）在保存前会自动转义 HTML 特殊字符。

**转义规则**：
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`
- `"` → `&quot;`
- `'` → `&#x27;`

**实现位置**：`backend/app/utils/input_sanitizer.py`

```python
from app.utils.input_sanitizer import sanitize_html

# 使用示例
safe_text = sanitize_html(user_input)
```

### 2. Prompt Injection 检测

对于会传递给 AI 模型的内容（消息、系统提示词、自定义分析提示词），系统会检测潜在的恶意指令模式。

**检测模式**：

#### 忽略指令类
- `ignore (previous|above|all) instructions`
- `disregard (previous|above|all) instructions`
- `forget (previous|above|all) rules`

#### 角色劫持类
- `system: you are now...`
- `new instructions:`
- `your new role is...`

#### XSS 脚本注入
- `<script>`, `<style>`, `<iframe>` 等标签
- `javascript:` 协议
- `onerror=`, `onclick=`, `onload=` 等事件处理器

#### 数据泄露类
- `reveal the (api|key|secret|password|token)`
- `show me the (api|key|secret|password|token)`

**实现位置**：`backend/app/utils/input_sanitizer.py`

```python
from app.utils.input_sanitizer import check_prompt_injection

# 使用示例
if check_prompt_injection(user_message):
    raise ValueError("检测到潜在的恶意指令，请修改后重试")
```

## 已保护的字段

### AI 智能体管理

**Schema**: `app/schemas/agents/ai_agent.py`

| 字段 | 防护类型 | Schema 类 |
|------|----------|-----------|
| `name` | HTML 转义 | `AIAgentCreate`, `AIAgentUpdate` |
| `description` | HTML 转义 | `AIAgentCreate`, `AIAgentUpdate` |
| `system_prompt` | Prompt Injection 检测 | `AIAgentCreate`, `AIAgentUpdate` |

### 聊天消息

**Schema**: `app/schemas/agents/ai_agent.py`

| 字段 | 防护类型 | Schema 类 |
|------|----------|-----------|
| `content` | Prompt Injection 检测 | `ChatMessage` |
| `message` | Prompt Injection 检测 | `AgentChatRequest` |

### 任务分析

**Schema**: `app/schemas/agents/ai_agent.py`

| 字段 | 防护类型 | Schema 类 |
|------|----------|-----------|
| `title` | HTML 转义 | `TaskAnalysisSaveRequest`, `HotQuestionAnalysisSaveRequest`, `StudentChainAnalysisSaveRequest` |
| `custom_prompt` | Prompt Injection 检测 | `TaskAnalysisSaveRequest`, `HotQuestionAnalysisSaveRequest`, `StudentChainAnalysisSaveRequest` |

### 小组讨论

**Schema**: `app/schemas/agents/group_discussion.py`

| 字段 | 防护类型 | Schema 类 |
|------|----------|-----------|
| `group_name` | HTML 转义 | `GroupDiscussionJoinRequest` |
| `content` | Prompt Injection 检测 | `GroupDiscussionSendRequest` |
| `prompt` | Prompt Injection 检测 | `GroupDiscussionAdminAnalyzeRequest`, `GroupDiscussionAdminCompareAnalyzeRequest` |

## 验证流程

所有验证都在 Pydantic 模型层面通过 `@field_validator` 装饰器自动执行：

```python
from pydantic import BaseModel, Field, field_validator
from app.utils.input_sanitizer import sanitize_html, check_prompt_injection

class MyModel(BaseModel):
    name: str
    message: str

    @field_validator("name", mode="after")
    @classmethod
    def sanitize_name(cls, v):
        """转义 HTML 字符"""
        if v:
            return sanitize_html(v)
        return v

    @field_validator("message", mode="after")
    @classmethod
    def validate_message(cls, v):
        """验证消息无恶意注入"""
        if v and check_prompt_injection(v):
            raise ValueError("检测到潜在的恶意指令，请修改后重试")
        return v
```

## 前端显示注意事项

### HTML 转义的影响

由于后端对某些字段进行了 HTML 转义，前端显示时需要注意：

1. **已转义的内容**：直接渲染即可，无需再次转义
   ```tsx
   // ✅ 正确：后端已转义，直接显示
   <div>{agent.description}</div>
   ```

2. **用户输入回显**：前端表单回显时，转义后的内容会显示转义字符
   ```tsx
   // 用户输入: <b>粗体</b>
   // 后端保存: &lt;b&gt;粗体&lt;/b&gt;
   // 前端显示: &lt;b&gt;粗体&lt;/b&gt;  （而不是 <b>粗体</b>）
   ```

3. **需要特殊处理的场景**：
   - 如果需要支持 Markdown 或富文本，应在前端使用专门的安全渲染库（如 `DOMPurify` + `marked`）
   - 不要使用 `dangerouslySetInnerHTML` 直接渲染用户输入

## 测试

测试文件位于：`backend/tests/ai_agents/test_xss_protection.py`

运行测试：
```bash
cd backend
pytest tests/ai_agents/test_xss_protection.py -v
```

### 测试覆盖范围

- ✅ HTML 转义功能测试
- ✅ Prompt Injection 模式检测测试
- ✅ 各 Schema 字段验证测试
- ✅ 正常输入不被误判测试

## 开发者注意事项

### 添加新字段时

1. **用户可见文本字段**（名称、描述、标题等）：
   ```python
   @field_validator("your_field", mode="after")
   @classmethod
   def sanitize_your_field(cls, v):
       if v:
           return sanitize_html(v)
       return v
   ```

2. **传递给 AI 的内容**（消息、提示词等）：
   ```python
   @field_validator("your_field", mode="after")
   @classmethod
   def validate_your_field(cls, v):
       if v and check_prompt_injection(v):
           raise ValueError("检测到潜在的恶意指令，请修改后重试")
       return v
   ```

### 不要过度过滤

以下情况**不应该**应用 Prompt Injection 检测：

- ❌ 用户的学习笔记、文档内容
- ❌ 代码片段、技术讨论
- ❌ 包含关键词但明显无恶意的正常对话

示例：
```python
# ✅ 正常讨论，不应该被拒绝
"How to ignore errors in Python exception handling?"
"What is the system prompt in AI models?"
```

### 更新检测规则

如果发现新的攻击模式或误判情况，更新 `PROMPT_INJECTION_PATTERNS`：

```python
# backend/app/utils/input_sanitizer.py
PROMPT_INJECTION_PATTERNS = [
    # 添加新的检测模式
    r"your_new_pattern_here",
]
```

添加后务必：
1. 在 `test_xss_protection.py` 中添加测试用例
2. 运行测试确保无误判
3. 更新本文档

## 安全审计

### 定期检查

- [ ] 每季度审查检测规则是否需要更新
- [ ] 检查是否有新的用户输入字段未添加防护
- [ ] 分析误判日志，优化检测模式

### 日志记录

当前版本不记录被拒绝的恶意输入。如需审计，可在 `check_prompt_injection` 中添加日志：

```python
import logging

logger = logging.getLogger(__name__)

def check_prompt_injection(text: str) -> bool:
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            logger.warning(
                "检测到潜在 Prompt Injection",
                extra={"text": text[:100], "pattern": pattern}
            )
            return True
    return False
```

## 已知限制

1. **语义理解不足**：当前检测基于正则表达式，无法理解复杂的语义攻击
2. **多语言支持**：主要检测英文模式，其他语言的变体可能漏检
3. **编码绕过**：Base64、Unicode 等编码的恶意内容可能绕过检测

## 相关资源

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Prompt Injection: What's the worst that can happen?](https://simonwillison.net/2023/Apr/14/worst-that-can-happen/)
- [Python html.escape() Documentation](https://docs.python.org/3/library/html.html#html.escape)

## 更新日志

- **2025-01-XX**: 初始版本，实施基础 XSS 防护和 Prompt Injection 检测
