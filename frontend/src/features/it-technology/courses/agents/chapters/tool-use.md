# 工具使用：给 AI 装上"手"

你有没有想过，一个满腹经纶的学霸，如果把他关在房间里不给他手机、计算器、词典，他能完成多少事？他能凭记忆做很多事，但他查不了"今天的新闻"，算不出特别复杂的算式，也联系不上外面的人。

AI 面临的困境一模一样！它知道很多东西，但它无法获取**最新信息**、不会**精确计算**、也不能**操作现实世界**。这时候，**工具（Tools）**就派上用场了。

## 一、为什么 AI 需要工具？

### AI 的"闭卷考试"困境

想象一个学霸参加闭卷考试：

- 他不知道**今天**发生了什么（AI 的知识停在训练那天，比如 2024 年初）
- 他有时会**记错**（AI 也会"幻觉"——编造看起来合理但错误的内容）
- 他不会做**精确计算**（AI 是语言模型，不是计算器）
- 他不能查**你的个人数据**（比如你的班级课表）

**工具使用（Tool Use）**就是把"闭卷考试"变成"开卷考试 + 计算器 + 智能手机"。

### 文具盒类比：你的学习装备

你每天上学带什么？

| 文具 | 用在哪科 | AI 工具类比 |
|------|----------|-------------|
| 计算器 | 数学、物理 | 计算工具：精确算数 |
| 词典 | 英语、语文 | 搜索工具：查最新信息 |
| 圆规 | 数学作图 | 画图工具：生成图片 |
| 课程表 | 全部 | 日历工具：查你的日程 |
| 手机 | 全部 | 通信工具：发消息、发邮件 |

AI 的工具箱也一样——给它什么工具，它就能做什么事。

### 原神装备类比

刚开始玩原神时，你只有一个普通攻击。随着升级，你获得了：
- 新武器（搜索工具：能查到更多信息）
- 元素技能（计算工具：能精确运算）
- 地图传送（数据工具：能访问数据库）
- 食物 buff（辅助工具：优化输出质量）

AI Agent 的"升级"就是不断获得新工具的过程。工具越多，它能做的事越多。

### 工具怎么定义？

每个工具需要三样东西，就像 App 的使用说明：

```
工具名: send_message（发消息）
功能描述: 给指定联系人发一条微信消息
需要什么参数:
  - contact（联系人）: 文字，必填
  - message（消息内容）: 文字，必填
  - priority（优先级）: 可选，"正常"或"紧急"
```

就像你点外卖：必须填地址和菜品（必填参数），选填备注（可选参数）。

### 工具调用的安全规则

**重要**：AI 只负责决定"用什么工具"和"填什么参数"，但**AI 不自己执行**——执行由程序来做。就像你告诉助手"帮我查一下天气"，助手去查，而不是你亲自跑去气象局。

```
你问 → AI分析：需要搜索天气 
     → AI选工具：search_weather 
     → AI填参数：{"city": "上海", "days": 5}
     → 程序执行：真的去调天气API
     → 返回结果给AI
     → AI整理后回答你
```

---

## 🎮 类比理解

### 从"空手"到"满装备"

```
没有工具的 AI = 空手上学
  只能凭记忆回答问题
  答不上来就说"抱歉，我不知道"

有工具的 AI = 带齐文具上学
  不懂的可以查词典
  算不出的用计算器
  不知道的可以上网搜
  需要通知的可以发消息
```

### Minecraft 工具使用

```
Minecraft 里：
  空手挖石头 → 极慢，可能挖不下来
  用镐子挖   → 快速，效率高
  用钻石镐   → 更快，还能挖更硬的矿

AI 也是一样：
  纯靠记忆回答 → 可能过时、不准确
  调用搜索工具 → 获取最新信息
  调用专业API → 获取精确数据
```

### 就像一个万能助手

```
你: "帮我计划周末去上海的行程"

有工具的Agent:
  1. 用天气预报工具 → 周末上海晴天，26度
  2. 用航班查询工具 → 有3个航班可选
  3. 用酒店搜索工具 → 推荐5家评分高的酒店
  4. 综合所有结果 → "最佳方案：周六国航14:00航班，住XX酒店，天气适合户外活动！"

没有工具的Agent:
  "建议你去携程查查。"（只能给建议，不能自己查）
```

---

## 🤔 活动思考

### 活动一：设计 AI 工具卡片（15 分钟）

**任务**：你是一个 AI Agent 的产品经理！设计 3 个工具，让 AI 更好地帮助高中生。

**每组 3 人，在白纸上画 3 张"工具卡片"**，每张包含：
- 工具名称（像 App 名一样好记）
- 功能描述（一句话说清楚）
- 需要的参数（用户要填什么信息）
- 使用场景（什么时候会用到）

**示例**：
```
┌──────────────────────────────┐
│  工具名：check_homework      │
│  描述：查询今天各科作业        │
│  参数：                      │
│    - date: 日期（默认今天）   │
│    - subject: 科目（可选）    │
│  场景：问"今天有什么作业"时   │
└──────────────────────────────┘
```

### 活动二：该用哪个工具？（10 分钟）

| 问题 | 该用哪个工具？ | 为什么？ |
|------|:---:|------|
| "今天几号？" | | |
| "帮我算 12345 x 67890" | | |
| "我们班下周有什么活动？" | | |
| "帮我给妈妈发个生日祝福" | | |

**讨论**：如果 Agent 选错了工具会怎样？比如要查天气却调用了计算器？

---

## 🔬 动手实验：给 AI 装上工具箱

```python
# 装备齐全的AI助手——带上它的工具箱！
import datetime
import random

class ToolBoxAgent:
    def __init__(self, name):
        self.name = name
        self.tools = {
            "get_time": self.tool_get_time,
            "get_date": self.tool_get_date,
            "calculate": self.tool_calculate,
            "random_number": self.tool_random_number,
            "search_school": self.tool_search_school,
            "flip_coin": self.tool_flip_coin,
            "roll_dice": self.tool_roll_dice,
        }

    def tool_get_time(self, params=None):
        now = datetime.datetime.now()
        return f"现在时间是 {now.hour}时{now.minute}分{now.second}秒"

    def tool_get_date(self, params=None):
        now = datetime.datetime.now()
        weekdays = ["周一","周二","周三","周四","周五","周六","周日"]
        return f"今天是{now.year}年{now.month}月{now.day}日 {weekdays[now.weekday()]}"

    def tool_calculate(self, params):
        try:
            result = eval(params)
            return f"{params} = {result}"
        except:
            return f"无法计算: {params}"

    def tool_random_number(self, params):
        try:
            parts = params.split("-")
            if len(parts) == 2:
                lo, hi = int(parts[0]), int(parts[1])
            else:
                lo, hi = 1, int(params)
            return f"随机生成: {random.randint(lo, hi)}"
        except:
            return "格式错误，请输入如 1-100"

    def tool_search_school(self, params):
        database = {
            "食堂": "今天食堂：红烧肉、番茄炒蛋、青菜。11:30-12:30。",
            "图书馆": "图书馆开放：周一至周五 8:00-21:00，周末 9:00-17:00。",
            "作业": "数学：课本P45 习题3-1。物理：实验报告。",
            "考试": "下周：周三数学，周四英语，周五语文。",
            "活动": "本周五下午篮球赛，地点体育馆。",
        }
        for key, value in database.items():
            if key in params:
                return value
        return f"未找到关于'{params}'的校园信息"

    def tool_flip_coin(self, params=None):
        return f"抛硬币结果: {'正面' if random.random() > 0.5 else '反面'}"

    def tool_roll_dice(self, params=None):
        return f"掷骰子的点数是: {random.randint(1, 6)}"

    def show_tools(self):
        print("\n我的工具箱：")
        for name, func in self.tools.items():
            print(f"  {name}: {func.__doc__}")

    def think_and_choose(self, question):
        """根据问题选择工具（简单规则匹配）"""
        if "时间" in question or "几点" in question:
            return "get_time", None
        elif "日期" in question or "今天" in question:
            return "get_date", None
        elif any(op in question for op in ['+', '-', '*', '/', '×', '÷', '计算']):
            expr = question.replace('×', '*').replace('÷', '/')
            for word in ['计算', '等于', '=']:
                expr = expr.replace(word, '')
            return "calculate", expr.strip()
        elif "随机" in question or "抽" in question:
            return "random_number", "1-100"
        elif any(w in question for w in ["食堂", "图书馆", "作业", "考试", "活动"]):
            return "search_school", question
        elif "硬币" in question:
            return "flip_coin", None
        elif "骰子" in question:
            return "roll_dice", None
        return None, None

    def run(self, question):
        print(f"\n{'='*50}")
        print(f"你: {question}")
        tool_name, params = self.think_and_choose(question)
        if tool_name is None:
            print(f"{self.name}: 抱歉，我没有处理这个问题的工具。")
        else:
            print(f"{self.name} 选择工具: {tool_name}")
            result = self.tools[tool_name](params)
            print(f"{self.name}: {result}")


# 来试试！
agent = ToolBoxAgent("工具人小王")
agent.show_tools()
agent.run("现在几点了？")
agent.run("计算 123 × 456")
agent.run("帮我抽个随机数，1到100")
agent.run("今天食堂有什么？")
agent.run("抛个硬币帮我决定")
agent.run("掷个骰子")
agent.run("帮我写首诗")  # 失败——没有这个工具！
```

### 思考题

1. Agent 怎么知道该用哪个工具？上面代码用了什么方法？有什么缺点？
2. 如果两个工具都能处理同一个问题，Agent 该怎么选？
3. 工具调用失败了怎么办？比如搜索"食堂"但数据库里没有。
4. **挑战题**：给 Agent 加一个"发邮件"的工具。需要哪些参数？
5. **开放题**：你最希望 AI Agent 有什么工具？为什么这个工具最重要？

---

## 💡 本章彩蛋

**你知道吗？** 2023 年有一篇论文叫《Toolformer》，它让 AI **自学**使用工具！研究者给 AI 一堆文本和一堆 API 说明，AI 自己学会了什么时候该搜索、什么时候该计算、什么时候该翻译。这就像你扔给一个人一本工具说明书，他看完后自己知道"遇到螺丝钉要拿螺丝刀，遇到钉子要拿锤子"。

还有一个有趣的事实：当 AI 有太多工具可选时，它会"选择困难症"——就像你面对一个 100 页的菜单不知道点什么。所以在实践中，工程师会精心挑选真正有用的工具，而不是把 1000 个工具全扔给 AI。

**回忆一下**：工具 = 名称 + 功能描述 + 参数规格。AI 负责决定"用什么、填什么参数"，程序负责"真的去执行"。下一章我们聊 Function Calling——让工具调用变得更精确，就像遥控器对比语音控制！
