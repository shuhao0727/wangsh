# Function Calling：AI 的"遥控器"

你有没有想过，为什么你按遥控器上的"音量+"，电视就一定能把声音调大，而不是换台？

因为遥控器的每个按钮都有**精确的功能定义**——"音量+"只能调音量，范围是 0-100，"频道+"只能换台。你不会对着遥控器喊"声音大一点"，因为遥控器听不懂。

AI 调用工具也是一样——它需要一种"遥控器"式的精确方式来告诉程序：我要调用哪个工具、用什么参数。这就是 **Function Calling（函数调用）**。

## 一、从"自由发挥"到"标准按钮"

### 自然语言太模糊了

上一章我们知道 AI 需要工具。但一个关键问题没解决：**AI 怎么精确地告诉电脑要调用什么？**

如果让 AI 自由发挥，它可能输出：
- "我想搜索一下上海的天气"——太模糊，程序没法解析
- "查天气 上海"——格式不统一
- "search_weather('shanghai')"——参数名可能写错

你没法指望每次都猜对 AI 想干嘛。这时候就需要 **Function Calling**——一种标准化的、结构化的、能让程序直接读懂的方式。

### 遥控器类比

想象你的电视遥控器：

| 遥控器 | Function Calling |
|--------|-------------------|
| 每个按钮有固定功能 | 每个函数有固定的名称 |
| 音量键只能调 0-100 | 参数有类型和范围限制 |
| 按错键电视不理你 | 参数不对就报错，不会"瞎执行" |
| 可以同时按多个键 | 可以并行调用多个函数 |

### Function Calling vs 普通工具调用

| | 普通工具调用 | Function Calling |
|------|------|------|
| 怎么告诉 AI 有什么工具？ | 写在文字提示里 | 通过 API 的专门参数传递 |
| AI 怎么表示"我要调用"？ | 自然语言描述 | 结构化的 JSON 对象 |
| 参数格式可靠吗？ | 可能会出错 | 严格按说明书验证 |
| 是标准吗？ | 各家不同 | OpenAI/Anthropic 等统一标准 |

简单理解：Function Calling 是"说普通话的工具调用"——大家用同一套标准，不会产生歧义。

### 一个 Function 的"说明书"

就像奶茶店的点单页面，每个函数调用需要一张"说明书"（JSON Schema）：

```
函数名: order_bubble_tea（点奶茶）
功能描述: 点一杯奶茶
参数:
  - flavor（口味）: 必需，只能是"原味/珍珠/椰果/芋泥"
  - size（杯型）: 必需，只能是"中杯/大杯/超大杯"
  - sugar（甜度）: 可选，只能是"无糖/三分糖/五分糖/七分糖/全糖"
  - ice（冰量）: 可选，只能是"去冰/少冰/正常冰"
```

有了这个说明书，AI 就知道：
- 必填什么（口味、杯型）
- 选填什么（甜度、冰量）
- 每项能填什么（不能填"火锅味"——奶茶没有这个口味！）

### 并行调用：同时按多个按钮

人类做事可以一心多用——边烧水边切菜。Function Calling 也支持！

你问 Agent："我周末去北京玩，帮我推荐行程。"

AI 同时发出 3 个调用：
1. 查周末北京天气
2. 查北京热门景点
3. 查北京酒店价格

三个互不依赖，可以同时执行。最快的一个完成的时间，而不是累加的时间。

```
串行（一个一个来）: 查天气(2秒) → 查景点(2秒) → 查酒店(2秒) = 6秒
并行（同时做）:    查天气(2秒)
                   查景点(2秒)  = 2秒（取最慢的那个）
                   查酒店(2秒)
```

---

## 🎮 类比理解

### 奶茶店点单类比

```
自由格式（容易出错）:
  你对店员说："随便来一杯"
  店员: ???（蒙了）

扫码点单（精确）:
  你点选: 口味=珍珠, 杯型=大杯, 甜度=三分糖, 冰量=少冰
  店员: 清楚！立刻制作！
```

### 游戏手柄类比

```
没有 Function Calling = 用语音控制游戏
  你喊："跳一下！不对，太高了，我是说往左跳！"
  游戏角色: 乱动一气

有 Function Calling = 用手柄玩游戏
  你按 A 键 = 跳跃
  你按左摇杆 = 移动
  你按 B 键 = 攻击
  每个按钮的行为是明确的、可预期的
```

### 原神快捷轮盘

```
原神里的快捷轮盘就是 Function Calling:
  按"打开地图"键 → 精确调用 open_map() 函数
  按"切换角色"键 → 精确调用 switch_character(角色编号)
  按"使用食物"键 → 精确调用 use_food(食物ID)

如果没有这个设计，你每次想切角色都要点开菜单翻半天——
就像没有 Function Calling，AI 每次想用工具都要说一堆模糊的自然语言。
```

---

## 🤔 活动思考

### 活动一：设计 Function 说明书（20 分钟）

**背景**：你要为"校园助手"设计 3 个函数，每个函数要有完整的说明书。

**任务**（每组 3 人）：在白纸上设计，每个参数包含：
- 参数名
- 类型（文字/数字/是或否）
- 是否必填
- 允许的值或范围

**选题**（选一个）：
- A. 借书系统（书名、借书日期、还书日期、学生 ID）
- B. 食堂点餐（菜品、数量、备注、送餐地址）
- C. 社团报名（社团名、学生姓名、年级、联系方式）

**模板**：
```
函数名: __________________
功能: ____________________
参数:
  - ________: 类型____, 必填/可选, 限制:________
  - ________: 类型____, 必填/可选, 限制:________
```

### 活动二：找出错误的参数（10 分钟）

| 调用 | 参数 | 有问题吗？ | 错在哪？ |
|------|------|:---:|------|
| 点奶茶 | flavor: "麻辣烫味" | | |
| 搜索航班 | passengers: -5 | | |
| 发短信 | phone: "不是号码" | | |
| 订酒店 | check_in: "明天", check_out: "昨天" | | |
| 查成绩 | student_id: 30211 | | |

**讨论**：什么情况下 AI 最容易填错参数？有什么办法减少错误？

---

## 🔬 动手实验：校园助手 Function Calling

```python
# 校园助手：用 Function Calling 的方式设计
# 每个功能都是一个"函数"，有明确的参数规范
import json

class CampusAssistant:
    def __init__(self):
        self.functions = {
            "check_homework": {
                "description": "查询某天的作业",
                "parameters": ["date", "subject"],
                "required": ["subject"],
                "execute": self.do_check_homework
            },
            "check_menu": {
                "description": "查询食堂菜单",
                "parameters": ["date", "meal"],
                "required": ["meal"],
                "execute": self.do_check_menu
            },
            "book_room": {
                "description": "预约自习室",
                "parameters": ["date", "time_slot", "room_type"],
                "required": ["date", "time_slot"],
                "execute": self.do_book_room
            },
            "send_notice": {
                "description": "发送班级通知",
                "parameters": ["content", "urgency"],
                "required": ["content"],
                "execute": self.do_send_notice
            },
        }

    def do_check_homework(self, params):
        subject = params.get("subject", "全部")
        homework_db = {
            "数学": "课本P45 习题3-1 至 3-5",
            "英语": "背诵Unit 5单词，完成练习册P30-32",
            "物理": "完成实验报告：验证牛顿第二定律",
            "语文": "作文：《我的理想》，不少于800字",
        }
        if subject == "全部":
            return "\n".join(f"  {k}: {v}" for k, v in homework_db.items())
        return homework_db.get(subject, f"未找到{subject}的作业")

    def do_check_menu(self, params):
        meal = params.get("meal", "午餐")
        menu_db = {
            "早餐": "豆浆、油条、包子、鸡蛋、牛奶",
            "午餐": "红烧肉、番茄炒蛋、清炒时蔬、米饭",
            "晚餐": "宫保鸡丁、麻婆豆腐、紫菜汤、馒头",
        }
        return f"{meal}: {menu_db.get(meal, '未查询到')}"

    def do_book_room(self, params):
        date = params.get("date", "今天")
        time_slot = params.get("time_slot", "18:00-20:00")
        room_type = params.get("room_type", "普通")
        return f"已预约 {date} {time_slot} 的{room_type}自习室。"

    def do_send_notice(self, params):
        content = params.get("content", "")
        urgency = params.get("urgency", "普通")
        urgency_mark = {"紧急": "[紧急]", "重要": "[重要]", "普通": "[普通]"}
        return f"{urgency_mark.get(urgency, '[普通]')} 已发送通知: {content[:50]}..."

    def parse_intent(self, user_input):
        """解析用户意图（模拟AI的Function Calling）"""
        text = user_input.lower()
        if "作业" in text:
            func = "check_homework"
            params = {}
            if "数学" in text: params["subject"] = "数学"
            elif "英语" in text: params["subject"] = "英语"
            elif "物理" in text: params["subject"] = "物理"
            elif "语文" in text: params["subject"] = "语文"
            else: params["subject"] = "全部"
            return func, params
        elif "食堂" in text or "吃" in text or "菜单" in text:
            func = "check_menu"
            params = {}
            if "早餐" in text or "早饭" in text: params["meal"] = "早餐"
            elif "晚餐" in text or "晚饭" in text: params["meal"] = "晚餐"
            else: params["meal"] = "午餐"
            return func, params
        elif "自习室" in text or "预约" in text:
            func = "book_room"
            params = {"date": "今天", "time_slot": "19:00-21:00"}
            return func, params
        elif "通知" in text or "公告" in text:
            func = "send_notice"
            params = {"content": user_input, "urgency": "普通"}
            if "紧急" in text: params["urgency"] = "紧急"
            return func, params
        return None, None

    def run(self, user_input):
        print(f"\n{'='*50}")
        print(f"用户: {user_input}")
        func_name, params = self.parse_intent(user_input)
        if func_name is None:
            print(f"助手: 我不太确定你想做什么。试试说'查作业'、'查菜单'等。")
            return
        func_call = {"function": func_name, "parameters": params}
        print(f"Function Call: {json.dumps(func_call, ensure_ascii=False, indent=2)}")
        result = self.functions[func_name]["execute"](params)
        print(f"返回结果:\n{result}")


# 来试试！
assistant = CampusAssistant()
assistant.run("今天有什么作业？")
assistant.run("数学作业是什么？")
assistant.run("中午食堂吃什么？")
assistant.run("帮我预约今晚的自习室")
assistant.run("发一个紧急通知：明天考试提前到8点")
assistant.run("明天天气怎么样？")  # 没有这个函数！
```

### 思考题

1. 观察 Function Call 的 JSON。它和自由文本描述相比，各有什么优缺点？
2. 如果用户说"帮我查数学和英语的作业"，目前的代码只能返回一个。怎么让它支持查多个科目？（提示：并行调用）
3. **挑战题**：添加一个新函数 `set_reminder`（设置提醒），需要标题、时间、重复方式。实现完整的流程。
4. **开放题**：Function Calling 这种"遥控器"设计，和自然语言相比，是更方便了还是更限制了？

---

## 💡 本章彩蛋

**你知道吗？** Function Calling 这个功能在 2023 年由 OpenAI 首次推出，现在几乎所有大模型（包括 Anthropic 的 Claude、Google 的 Gemini）都支持了这个标准。这意味着你写好的函数定义，可以在不同的 AI 模型之间"共享"——就像同一个遥控器可以控制不同品牌的电视。

还有一个有趣的细节：当 AI 决定调用函数时，它实际上不会执行任何代码。它只是输出一个结构化的 JSON，说"我想调用这个函数，参数是这些"。真正执行的是你的程序——这个设计确保了**安全性**，AI 不能擅自操作你的电脑。

**回忆一下**：Function Calling = 精确的函数名 + 结构化的参数 + 严格的类型验证。它让 AI 的工具调用从"猜你什么意思"变成了"精确按按钮"。下一章我们聊 MCP 协议——就像 USB-C 统一了所有充电线！
