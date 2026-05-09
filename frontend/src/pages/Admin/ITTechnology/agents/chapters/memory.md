# 记忆系统：AI 的"备忘录"

你有没有过这种尴尬时刻——同学跟你说了一件事，五分钟后你完全不记得了，只能再问一遍？

大多数 AI 就是这样的"健忘症患者"！每次你跟它聊天，它都像第一次见到你一样，不记得你叫什么、你喜欢什么、你上次问了什么。

**记忆系统（Memory）**就是给 AI 配一个"笔记本"——让它能记住重要的事情，并在需要时翻出来用。

## 一、AI 为什么需要记忆？

### 一个让人抓狂的例子

```
没有记忆的 AI:
  你: "我叫小明。"
  AI: "好的小明！"
  你: "帮我查作业。"
  AI: "好的，请问你叫什么名字？"  ← 又忘了！
  你: ...（无语）

有记忆的 AI:
  你: "我叫小明。"
  AI: "记住了，小明！"  ← 存入记忆
  （一周后）
  你: "帮我查作业。"
  AI: "小明，你的数学作业是课本 P45！"  ← 还记得你！
```

### 四种记忆：像你的学习装备

AI 的记忆分成四层，就像你的学习装备：

| 记忆类型 | 学习类比 | 存什么 | 保留多久 | 例子 |
|----------|----------|--------|----------|------|
| **工作记忆** | 草稿纸 | 当前正在算的东西 | 几分钟 | "你说的是哪道题来着？" |
| **情景记忆** | 日记本 | 过去发生的具体事件 | 几天到几个月 | "上次用这个方法解出来了" |
| **语义记忆** | 错题本 | 事实、概念、你的偏好 | 长期 | "小明喜欢 Python，讨厌物理" |
| **程序性记忆** | 肌肉记忆 | 做事的流程和方法 | 长期 | "遇到证明题，先画图" |

### 原神存档类比

玩原神的时候：

- **工作记忆** = 当前屏幕上发生的战斗（BOSS 放什么技能、你剩多少血）
- **情景记忆** = 上次打这个 BOSS 用的是什么配队和策略
- **语义记忆** = 这个 BOSS 叫什么、弱点是火还是冰、掉落什么材料
- **程序性记忆** = 怎么闪避、怎么连招、怎么切人放技能（肌肉记忆）

**没有存档的游戏**：每次打开都从第一关开始打。

**有存档的游戏**：打开就能接着上次的进度继续。

AI 的记忆就是它的"存档系统"。

### 短期记忆的管理难题

AI 的"脑容量"（上下文窗口）是有限的，就像你的书包——装不下整个学期所有的书。

三种管理策略：

1. **滑动窗口**：只保留最近几条信息，旧的扔掉。简单，但可能丢了重要的旧信息。
2. **摘要压缩**：把前面的对话总结成几句话。省空间，但细节会丢失。
3. **重要性标记**：判断每条信息的重要程度。重要的必须保留，不重要的可以扔。

### 长期记忆的魔法：把文字变成数字

长期记忆的核心技术是**把文字变成一串数字（向量），然后比较哪些数字串更"接近"**。

```
"我想吃火锅" → [0.12, -0.34, 0.56, ...] （一个向量）
"我喜欢辣的" → [0.11, -0.32, 0.58, ...] （很接近！）
"今天下雨了" → [-0.78, 0.45, -0.23, ...] （完全不同！）
```

当你问"推荐什么好吃的"，系统发现你之前的偏好和"火锅"最接近，于是回答"你以前说过喜欢吃辣的，要不试试火锅？"

这就像在书架找书——不是翻每一本，而是按"和你想要的多接近"来排序。

---

## 🎮 类比理解

### 记笔记 vs 不记笔记

```
上课不记笔记的你:
  老师讲完全部内容 → 回家 → "老师讲了什么来着？" → 全忘了

上课记笔记的你:
  老师讲重点 → 记在笔记本上 → 回家复习 → "哦对，老师说这里要考！"
  
AI 也是一样：
  用户说重点信息 → 存入记忆 → 以后聊天时检索 → "我记得你喜欢这个！"
```

### 王者荣耀的对局记忆

```
工作记忆（这一局里面）:
  "对面打野刚才在上路，现在可能在打龙"

情景记忆（之前的对局）:
  "上次遇到这个阵容，我们是用强开团打赢的"

语义记忆（长期经验）:
  "后羿怕刺客切，需要辅助保护"
  "我的本命英雄是李白，熟练度最高"

程序性记忆（操作习惯）:
  "看到控制技能就交闪现"
```

---

## 🤔 活动思考

### 活动一：你的"人工记忆"系统（20 分钟）

**任务**：模拟一个 AI 记忆系统！3 人一组。

**角色分配**：
- **用户**：连续提问
- **记忆管理员**：记下重要信息（写在纸上）
- **AI 助手**：回答问题（不能自己记，只能问记忆管理员）

**第一轮（没有记忆管理）**：用户连续问 5 个相关问题，AI 不能记笔记。每次答完把所有纸收走。

**第二轮（有记忆管理）**：同样的问题，但 AI 可以把重要信息记录在纸上，下次翻看。

**问题链示例**：
1. "我叫小明，我是高一 3 班的"
2. "我最喜欢的科目是物理"
3. "推荐一些物理竞赛题给我"
4. "对了，我叫什么名字来着？"
5. "我是哪个班的？"

**讨论**：
1. 第二轮和第一轮有什么区别？
2. 怎么决定"哪些信息值得记"？
3. 记太多东西翻找太慢怎么办？

### 活动二：什么该记住？（10 分钟）

为 AI 设计判断规则：下面这些场景，哪些该记住？

| 场景 | 该记住吗？ | 为什么？ |
|------|:---:|------|
| "我叫小明" | | |
| "今天中午吃了面条" | | |
| "我对花生过敏" | | |
| "刚才说了句'嗯'" | | |
| "我的手机号是 138xxxx" | | |
| "我下周一要考试" | | |

**讨论**：如何让 AI 自己判断一件事重不重要？

---

## 🔬 动手实验：有记忆的 AI 伙伴

```python
# 有记忆的AI伙伴——它会记住你！
import datetime

class MemoryAgent:
    def __init__(self, name):
        self.name = name
        self.working_memory = []     # 草稿纸（工作记忆）
        self.semantic_memory = {}    # 笔记本（语义记忆）
        self.episodic_memory = []    # 日记本（情景记忆）
        self.max_working = 10

    def perceive(self, message):
        """收到新信息"""
        self.working_memory.append({
            "role": "user",
            "content": message,
            "time": datetime.datetime.now().strftime("%H:%M")
        })
        if len(self.working_memory) > self.max_working:
            self.compress_working_memory()

    def compress_working_memory(self):
        """压缩工作记忆：把旧内容总结"""
        old = self.working_memory[:-5]
        summary = "之前的对话摘要: "
        for msg in old:
            if msg["role"] == "user":
                summary += f"用户说了'{msg['content']}'; "
        self.working_memory = [
            {"role": "system", "content": summary}
        ] + self.working_memory[-5:]
        print("[记忆压缩] 已将旧对话压缩为摘要")

    def extract_facts(self, message):
        """从消息中提取值得记住的事实"""
        facts = []
        if "我叫" in message or "我是" in message:
            name = message.split("我叫")[-1].split("我是")[-1].strip("了。，！")
            facts.append(("name", name))
        if "喜欢" in message:
            parts = message.split("喜欢")
            if len(parts) > 1:
                facts.append(("preference", parts[-1].strip("了。，！")))
        if "过敏" in message or "不能吃" in message:
            parts = message.split("过敏") if "过敏" in message else message.split("不能吃")
            if len(parts) > 1:
                facts.append(("allergy", parts[-1].strip("了。，！")))
        return facts

    def remember(self, facts):
        """把事实存入长期记忆"""
        for fact_type, fact_value in facts:
            old = self.semantic_memory.get(fact_type)
            if old:
                print(f"[更新记忆] {fact_type}: '{old}' → '{fact_value}'")
            else:
                print(f"[新记忆] {fact_type}: '{fact_value}'")
            self.semantic_memory[fact_type] = fact_value

    def recall(self, query_type):
        """从记忆中检索信息"""
        return self.semantic_memory.get(query_type)

    def respond(self, message):
        """处理用户消息并回复"""
        self.perceive(message)
        facts = self.extract_facts(message)
        if facts:
            self.remember(facts)
        self.episodic_memory.append({
            "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "event": f"用户说了: {message}"
        })

        if "我叫什么" in message or "我是谁" in message:
            name = self.recall("name")
            return f"你叫{name}呀！我记得呢。" if name else "你还没告诉我名字呢~"

        elif "我喜欢什么" in message:
            pref = self.recall("preference")
            return f"根据我的记忆，你喜欢{pref}。" if pref else "你还没说过哦。"

        elif "推荐" in message:
            pref = self.recall("preference")
            allergy = self.recall("allergy")
            if pref:
                response = f"既然你喜欢{pref}，推荐相关的内容给你！"
                if allergy:
                    response += f"（已避开你过敏的{allergy}）"
                return response
            return "我还不了解你，多和我说说话吧！"

        elif "记性" in message or "记得什么" in message:
            if self.semantic_memory:
                items = "\n".join(f"  - {k}: {v}" for k, v in self.semantic_memory.items())
                return f"我记住了这些：\n{items}"
            return "我现在脑子里还什么都没有呢。"

        else:
            return f"收到！我记住了你说的：'{message[:30]}...'"


# 来试试有记忆的 AI！
agent = MemoryAgent("备忘录")

conversations = [
    "你好！我叫小明",
    "我特别喜欢打篮球",
    "对了，我对海鲜过敏",
    "你能推荐一些运动给我吗？",
    "我叫什么名字来着？",
    "我喜欢什么？",
    "晚饭推荐吃什么呢？",
    "你都记得我什么？",
]

for msg in conversations:
    print(f"\n小明: {msg}")
    print(f"备忘录: {agent.respond(msg)}")
```

### 思考题

1. 如果用户说了 100 条消息，工作记忆怎么处理？
2. 如果用户说"我不喜欢篮球了，现在喜欢足球"，记忆应该怎么更新？
3. **挑战题**：给 Agent 加上"遗忘"机制——长时间没用到的事实，自动降低重要性。
4. **隐私思考**：AI 记住了你的名字、手机号、过敏信息。这些存在哪里？谁可以访问？

---

## 💡 本章彩蛋

**你知道吗？** 2023 年斯坦福大学做了一个超级有趣的实验——他们创建了一个虚拟小镇，里面住着 25 个 AI 居民，每个 AI 都有自己的记忆系统。结果发现，这些 AI 居民会自己组织情人节派对、互相八卦、甚至产生"谣言"——因为记忆传递过程中出现了偏差！这个实验的论文叫《Generative Agents》，非常推荐一读。

还有一个叫 **MemGPT** 的项目，它把 AI 的内存管理设计成操作系统的样子——就像 Windows 有内存和硬盘一样，AI 也有"短期工作区"和"长期存储区"。它在 GitHub 上开源，搜"MemGPT"就能找到。

**回忆一下**：记忆 = 草稿纸（短期）+ 笔记本（长期）+ 知道什么该记、什么该忘。下一章我们看看多个 Agent 怎么像王者开黑一样协作！
