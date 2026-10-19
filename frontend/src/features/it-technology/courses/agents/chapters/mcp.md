# MCP 协议：AI 的"USB-C 统一接口"

你有没有为了给手机充电，翻遍抽屉找"那条对的线"的经历？

你的手机是 Type-C，你爸的手机是老的 Micro-USB，你朋友的 iPhone 是 Lightning。每次出门，每个人都要带自己的充电线，借来借去用不了。

**AI 世界也有同样的问题**。ChatGPT 连接 GitHub 需要一套代码，Claude 连接 GitHub 需要另一套代码，换个数据库又要重新写。每个 AI 应用和每个工具之间都需要"一对一"定制。如果世界上有 100 种 AI 应用和 100 种工具，你就需要写 10000 套适配代码！

**MCP（Model Context Protocol，模型上下文协议）**就是来解决这个问题的。它就像 AI 世界的 USB-C——一个统一的标准，让所有 AI 应用和所有工具都能无缝连接。

## 一、标准化到底有多重要？

### 一个简单的算术

```
没有 MCP（每种组合都需要定制）:
  3个AI应用 × 3个工具 = 9套代码
  100个AI应用 × 100个工具 = 10000套代码

有 MCP（只需要实现一次标准）:
  3个AI应用 + 3个工具 = 6套代码
  100个AI应用 + 100个工具 = 200套代码
```

这就是标准化的力量！

### 生活中的标准化例子

你每天都被标准化包围着：

| 标准 | 它统一了什么 | 没有标准会怎样 |
|------|-------------|---------------|
| **USB-C** | 充电/数据接口 | 每种设备用不同的线 |
| **WiFi** | 无线网络连接 | 每家路由器只能用自家设备 |
| **蓝牙** | 短距离无线传输 | 耳机只能连同品牌手机 |
| **交通信号灯** | 红停绿行 | 各国规则不同，出国不会过马路 |
| **快递单号** | 包裹追踪 | 每家快递有自己的查询系统 |
| **MCP** | AI 与工具的连接 | 每个 AI 给每个工具写一套代码 |

### MCP 就像游戏手柄

不管你玩什么游戏——原神、王者荣耀、和平精英——只要游戏支持手柄，你就能用同一个手柄玩。因为手柄有一个**标准协议**：A 键是什么信号、B 键是什么信号，所有游戏都按这个标准来。

MCP 就是 AI 工具的"标准手柄协议"：
- 工具开发者：只需要实现一次 MCP 协议
- AI 应用开发者：只需要支持 MCP 协议
- 两者自动匹配，不需要任何定制代码

### MCP 的三种资源

MCP 不仅提供"工具"（AI 可以调用的功能），还提供：

| 类型 | 类比 | 说明 |
|------|------|------|
| **工具（Tools）** | 遥控器按钮 | AI 可以调用的功能（搜索、计算、发消息） |
| **资源（Resources）** | 参考资料 | AI 可以读取的数据（文件、文档、数据库） |
| **提示模板（Prompts）** | 快捷短语 | 预设的问题模板（"帮我审查这段代码"） |

---

## 🎮 类比理解

### 国际旅行转换插头类比

```
没有 MCP = 去不同国家要带不同的转换插头
  中国 → 中国插头
  美国 → 美国插头
  欧洲 → 欧洲插头
  出门箱子一半是转接头

有 MCP = 全球统一插座
  全世界 → 一个插头走天下
```

### USB 接口演变类比

```
以前（各种接口混战）:
  USB-A → 打印机
  USB-B → 扫描仪
  Micro-USB → 旧手机
  Lightning → iPhone
  Thunderbolt → MacBook
  抽屉里全是各种线！

现在（USB-C 统一）:
  一个 USB-C → 手机、平板、电脑、耳机、充电宝 全通用！

MCP 就是 AI 工具世界的 USB-C：
  一个 MCP → ChatGPT、Claude、Cursor、所有 AI 应用 全能用同一个工具！
```

### 学校里的统一标准类比

```
学校的标准化:
  所有教室用同一套电铃 → 不用每个教室自己调时间
  所有班级用同一套课表格式 → 教务处统一管理
  所有学生用同一套学号系统 → 成绩、图书、食堂一卡通

如果每个班都有自己的标准，学校就乱套了——
就像没有 MCP 的 AI 世界，每个 AI 都要为每个工具定制代码。
```

---

## 🤔 活动思考

### 活动一：标准化的力量——积木游戏（20 分钟）

**材料**：两组积木（或纸条代替）

**A 组（没有标准）**：
- 每组拿到不同形状的"接口"（三角形、五角星、六边形、圆形）
- 任务：用积木搭一座桥
- 限制：只有接口形状相同的积木才能连接

**B 组（有标准）**：
- 所有人拿到相同接口的积木（都是正方形）
- 同样的任务

**讨论**：
1. 哪组搭得更快、更高、更稳？
2. 这和 MCP 有什么关系？
3. 生活中还有哪些"标准化"的例子？

### 活动二：设计学校的 MCP 工具服务器（15 分钟）

**任务**：为学校创建一个 MCP 工具服务器，让任何 AI 都能访问学校数据。

列出 5 个可以提供给 AI 的"工具"：

| 工具名 | 功能 | 需要的参数 |
|--------|------|------|
| | | |
| | | |
| | | |
| | | |
| | | |

**讨论**：如果只为一个 AI 写代码，和为所有 AI 写标准接口，工作量差多少？

---

## 🔬 动手实验：MCP 生态系统模拟

```python
# MCP模拟器：展示标准化接口的威力
# 核心思想：所有工具都遵循同一个接口规范

class MCPServer:
    """MCP工具服务器基类——定义统一接口"""
    def list_tools(self):
        raise NotImplementedError("子类必须实现")
    def call_tool(self, tool_name, params):
        raise NotImplementedError("子类必须实现")

class WeatherMCPServer(MCPServer):
    """天气查询MCP服务器"""
    def list_tools(self):
        return [{
            "name": "get_weather",
            "description": "查询指定城市的天气",
            "parameters": {"city": {"type": "string", "required": True}}
        }]

    def call_tool(self, tool_name, params):
        if tool_name == "get_weather":
            city = params.get("city", "未知")
            import random
            temp = random.randint(15, 35)
            conditions = ["晴", "多云", "小雨", "阴"][random.randint(0, 3)]
            return f"{city}天气: {conditions}, 温度{temp}°C"
        return "未知工具"

class HomeworkMCPServer(MCPServer):
    """作业查询MCP服务器"""
    def list_tools(self):
        return [
            {"name": "get_homework", "description": "查询作业",
             "parameters": {"subject": {"type": "string", "required": True}}},
            {"name": "submit_homework", "description": "提交作业",
             "parameters": {"subject": {"type": "string", "required": True},
                           "content": {"type": "string", "required": True}}}
        ]

    def call_tool(self, tool_name, params):
        if tool_name == "get_homework":
            subject = params.get("subject", "")
            db = {"数学": "课本P45 习题3-1", "英语": "背诵Unit5单词"}
            return f"{subject}作业: {db.get(subject, '暂无')}"
        elif tool_name == "submit_homework":
            return f"已提交{params.get('subject')}作业"
        return "未知工具"

class CalendarMCPServer(MCPServer):
    """日历查询MCP服务器"""
    def list_tools(self):
        return [{
            "name": "get_schedule",
            "description": "查询日程",
            "parameters": {"date": {"type": "string", "required": True}}
        }]

    def call_tool(self, tool_name, params):
        if tool_name == "get_schedule":
            date = params.get("date", "今天")
            return f"{date}日程: 8:00-数学, 10:00-英语, 14:00-体育"
        return "未知工具"


class MCPClient:
    """MCP客户端——可以连接任何MCP服务器"""
    def __init__(self):
        self.servers = {}

    def connect(self, server_name, server):
        """连接一个MCP服务器（就像插上USB设备）"""
        self.servers[server_name] = server
        tools = server.list_tools()
        print(f"已连接 [{server_name}]，可用工具: {[t['name'] for t in tools]}")

    def list_all_tools(self):
        """列出所有已连接服务器的工具"""
        print("\n所有可用工具:")
        for srv_name, srv in self.servers.items():
            for tool in srv.list_tools():
                print(f"  [{srv_name}] {tool['name']}: {tool['description']}")

    def call_tool(self, server_name, tool_name, params):
        """调用某个服务器的某个工具（统一接口！）"""
        if server_name not in self.servers:
            return f"服务器 {server_name} 未连接"
        return self.servers[server_name].call_tool(tool_name, params)

    def run_query(self, user_input):
        """模拟AI使用MCP处理用户请求"""
        print(f"\n{'='*50}")
        print(f"用户: {user_input}")

        if "天气" in user_input:
            result = self.call_tool("天气", "get_weather", {"city": "上海"})
        elif "作业" in user_input:
            subject = "数学" if "数学" in user_input else "英语" if "英语" in user_input else "全部"
            result = self.call_tool("作业", "get_homework", {"subject": subject})
        elif "日程" in user_input:
            result = self.call_tool("日历", "get_schedule", {"date": "今天"})
        elif "提交" in user_input:
            result = self.call_tool("作业", "submit_homework",
                                     {"subject": "数学", "content": "已完成"})
        else:
            result = "我可以帮你查天气、作业和日程。"
        print(f"回答: {result}")


# 启动你的MCP生态系统！
client = MCPClient()
print("启动MCP生态系统...")
client.connect("天气", WeatherMCPServer())
client.connect("作业", HomeworkMCPServer())
client.connect("日历", CalendarMCPServer())

client.list_all_tools()

client.run_query("今天上海天气怎么样？")
client.run_query("数学作业是什么？")
client.run_query("今天有什么日程？")
client.run_query("提交数学作业")

print("\n" + "=" * 50)
print("MCP的关键优势:")
print("  1. 添加新服务器不影响已有代码")
print("  2. 所有服务器用同一种方式调用（统一接口）")
print("  3. 任何MCP客户端都能使用这些服务器")
print("  4. 工具开发者和AI开发者互不依赖")
```

### 思考题

1. 添加一个新的 MCP 服务器（比如"图书馆服务器"）需要改哪些地方？
2. 如果不用 MCP，3 个 AI 应用要连接 3 个工具，需要写多少套代码？
3. 生活中还有哪些"标准化"的设计？
4. **挑战题**：让用户可以通过命令"连接"和"断开"不同的 MCP 服务器，像插拔 USB 一样。
5. **开放题**：你觉得未来 MCP 会不会像 USB-C 一样成为 AI 工具的标准？为什么？

---

## 💡 本章彩蛋

**你知道吗？** MCP 协议是由 Anthropic（Claude 的创造者）在 2024 年底发布的，一经推出就在 AI 社区引起了轰动。短短几个月内，社区就贡献了上百个 MCP 服务器——从 GitHub、数据库、文件系统到 Slack、Notion、Google Drive，几乎所有常用工具都有对应的 MCP 接口了。

还有一个有趣的事实：MCP 底层用的是 **JSON-RPC 2.0** 协议，这是一个 2010 年就存在的标准。就像 USB-C 虽然是最新的接口标准，但它借用了很多成熟的底层技术。这说明一个道理：**好的创新不一定要从零开始，把已有的好东西组合起来，同样可以改变世界**。

**回忆一下**：MCP = AI 工具的 USB-C。它定义了统一的接口标准，让任何 AI 应用都能调用任何工具，而不需要为每个组合写定制代码。这就是标准化的力量！

---

**恭喜你完成了 Agent 系列的全部 8 章！** 从 Agent 是什么、怎么思考（ReAct）、怎么做计划、怎么记忆、怎么协作、怎么用工具、怎么精确调用、怎么标准化连接——你已经了解了构建智能 AI Agent 的全部核心概念。下一步？去写代码、做实验，造出你自己的 AI Agent 吧！
