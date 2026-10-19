export const beginnerExperiments = {
    level: "入门级",
    badge: "beginner",
    badgeVariant: "info" as const,
    icon: "rocket",
    color: "var(--ws-color-primary)",
    items: [
      {
        name: "Hello World Agent",
        difficulty: "初级",
        goal: "理解 Agent 最简实现：Prompt → LLM 调用 → 响应。学习 Agent 的本质是 LLM + 循环",
        estimated_time: "30 分钟",
        tools: ["DeepSeek API (OpenAI 兼容)", "Python"],
        steps: ["设置 DeepSeek API Key（或通义千问/智谱 GLM 等其他国产平台）", "编写 System Prompt 定义 Agent 角色", "实现单轮问答循环", "添加简单退出条件 (输入 quit 退出)"],
        desc: "用 30 行 Python 实现最简 Agent 对话循环",
        tech: "DeepSeek API",
          code: `from openai import OpenAI
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

SYSTEM_PROMPT = "你是一个友好的助手Agent，用中文回答问题。如果用户输入'quit'则退出对话。"

def hello_agent():
    """最简 Agent：Prompt → LLM 调用 → 响应 的对话循环"""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    print("Hello World Agent 启动！输入 'quit' 退出。\n")

    while True:
        user_input = input("你: ")
        if user_input.lower() == "quit":
            print("Agent: 再见！下次聊～")
            break

        messages.append({"role": "user", "content": user_input})

        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            temperature=0.7,
            max_tokens=512,
        )

        reply = response.choices[0].message.content
        print(f"Agent: {reply}\n")
        messages.append({"role": "assistant", "content": reply})

if __name__ == "__main__":
    hello_agent()`,
	      expected_output: `Agent 启动后显示欢迎语。用户输入任何问题后，Agent 通过 DeepSeek API（OpenAI 兼容接口）获取回复并打印。
对话历史自动累积在 messages 列表中，保证多轮对话的上下文连贯性。
用户输入 "quit" 后程序优雅退出。整个过程演示了 Agent 最基础的运行模式：
接收输入 → 调用 LLM → 输出响应 → 循环。`,
	      reflection: [
	        "如果去掉 messages 中的历史对话（只保留最后一轮），Agent 的表现会有哪些变化？为什么？",
	        "当对话超过 20 轮时，可能会超过模型的上下文窗口限制。你会设计怎样的压缩策略来应对这个问题？",
	        "如果把 System Prompt 中的「用中文回答」改为「用莎士比亚风格回答」，Agent 的行为会发生什么本质变化？这说明 Prompt 对 Agent 的控制力有多强？",
	      ],
	      data_source: "无外部数据源，完全依赖 LLM 自身知识库回答",
	    },
      {
        name: "天气查询 Agent",
        difficulty: "初级",
        goal: "学习 Function Calling 的基本模式：定义工具 Schema → LLM 选择工具 → 执行 → 返回结果",
        estimated_time: "1 小时",
        tools: ["DeepSeek Function Calling", "OpenWeatherMap API"],
        steps: ["定义 get_weather 函数的 JSON Schema", "注册工具到 LLM 调用", "解析 LLM 返回的工具调用", "执行天气查询并返回结果", "处理工具调用失败的情况"],
        desc: "调用天气 API，Function Calling 入门",
        tech: "DeepSeek + 天气API",
          code: `from openai import OpenAI
import json
import requests
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")
WEATHER_API_KEY = "your_openweathermap_api_key"

def get_weather(city: str) -> dict:
    """调用 OpenWeatherMap API 查询城市天气"""
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": WEATHER_API_KEY, "units": "metric", "lang": "zh_cn"}
    resp = requests.get(url, params=params, timeout=10)
    data = resp.json()
    if resp.status_code != 200:
        return {"error": f"查询失败: {data.get('message', '未知错误')}"}
    return {
        "城市": city,
        "温度(°C)": data["main"]["temp"],
        "天气": data["weather"][0]["description"],
        "湿度": f"{data['main']['humidity']}%",
    }

# 定义天气工具的 JSON Schema
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "查询指定城市的当前天气，返回温度、天气描述和湿度",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名称，如 '北京'、'Tokyo'"}
            },
            "required": ["city"],
        },
    },
}]

def weather_agent(query: str) -> str:
    """天气 Agent：LLM 决策 → 工具调用 → 结果整合"""
    messages = [{"role": "user", "content": query}]
    response = client.chat.completions.create(
        model="deepseek-chat", messages=messages, tools=tools, tool_choice="auto",
    )
    msg = response.choices[0].message

    if msg.tool_calls:
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments)
            result = get_weather(args["city"])
            messages.append(msg)
            messages.append({
                "role": "tool", "tool_call_id": call.id,
                "content": json.dumps(result, ensure_ascii=False),
            })
        final = client.chat.completions.create(model="deepseek-chat", messages=messages)
        return final.choices[0].message.content
    return msg.content

if __name__ == "__main__":
    print(weather_agent("北京今天天气怎么样？"))`,
	      expected_output: `LLM 接收到用户问题后，自动判断需要调用 get_weather 工具。从回复中解析出 city 参数 "北京"，
执行 HTTP 请求获取天气数据。将结构化的天气结果返回给 LLM 后，DeepSeek 将其转化为自然语言回答，
如 "北京当前温度 25°C，天气晴朗，湿度 45%"。整个过程体现了 Function Calling 的核心模式：
定义工具 → LLM 选择 → 执行 → 返回结果 → LLM 总结。`,
	      reflection: [
	        "如果 OpenWeatherMap API 返回错误（如城市名不存在或 API Key 失效），Agent 应该如何优雅地向用户说明？",
	        "用户问「北京和上海的天气哪个更热」，Agent 需要调用两次 get_weather。你如何设计让 LLM 自动发起并行工具调用？",
	        "Function Calling 模式下，LLM 本身并不执行工具，只是「建议」调用哪个工具。这种设计有什么安全性优势？",
	      ],
	      data_source: "OpenWeatherMap API (https://openweathermap.org/api) 提供的实时天气数据",
	    },
      {
        name: "翻译 Agent",
        difficulty: "初级",
        goal: "掌握 System Prompt 角色定义与多语言处理，理解 Prompt 对 Agent 行为的控制力",
        estimated_time: "45 分钟",
        tools: ["DeepSeek / 通义千问 API", "langdetect"],
        steps: ["设计翻译 Agent 的 System Prompt（含目标语言/风格/术语约束）", "集成语言检测自动识别源语言", "实现批量翻译与格式保持", "测试方言与俚语处理效果"],
        desc: "多语言翻译 + 语言检测",
        tech: "LLM Prompt",
          code: `from openai import OpenAI
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

SYSTEM_PROMPT = """你是一个专业翻译Agent，遵循以下规则：
1. 自动检测源语言（中文/英文/日文/韩文/法文等）
2. 将用户输入翻译为目标语言
3. 保持原文格式（Markdown、段落、列表结构不丢失）
4. 对于专业术语，首次出现时在括号中标注原文
5. 遇到俚语或习语时，优先使用目标语言中的等效表达而非直译
6. 翻译完成后，简要说明检测到的源语言和翻译策略"""

def translate(text: str, target_lang: str = "中文") -> str:
    """将任意文本翻译为目标语言"""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"目标语言：{target_lang}\n\n待翻译文本：\n{text}"},
    ]
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        temperature=0.3,  # 低温度保证翻译一致性
        max_tokens=2048,
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    # 测试英译中
    print("=== 英译中 ===")
    print(translate("The quick brown fox jumps over the lazy dog.", "中文"))

    # 测试俚语翻译
    print("\n=== 俚语翻译测试 ===")
    print(translate("It's raining cats and dogs outside!", "中文"))

    # 测试保持 Markdown 格式
    print("\n=== Markdown 格式保持 ===")
    md_text = "# Hello World\n\nThis is **important**."
    print(translate(md_text, "中文"))`,
	      expected_output: `翻译 Agent 根据 System Prompt 中的 6 条规则，自动检测源语言（英文），
将其翻译为中文，对 "raining cats and dogs" 给出等效表达 "倾盆大雨"，
对 Markdown 格式文本保持 # 标题和 **加粗** 结构的完整输出。
最后的翻译策略说明帮助用户理解 Agent 的决策过程。`,
	      reflection: [
	        "翻译一篇 5000 字的技术文档时，如何确保全文术语翻译的一致性（如 'blockchain' 始终译为 '区块链'）？",
	        "如果要翻译的文本包含双关语（pun），直译会失去幽默效果。你应该如何修改 System Prompt 让 Agent 创造性地保留双关？",
	        "对比 temperature=0.3 和 temperature=1.0 的翻译结果，它们的风格和一致性有何差异？这对生产环境的翻译系统意味着什么？",
	      ],
	      data_source: "用户输入的任意文本，LLM 基于自身多语言知识进行翻译",
	    },
      {
        name: "计算器 Agent",
        difficulty: "初级",
        goal: "实践 Tool Use 模式，理解 Agent 如何判断何时需要调用外部工具而非依靠自身知识",
        estimated_time: "45 分钟",
        tools: ["DeepSeek Function Calling", "Python math"],
        steps: ["创建计算器工具 (加减乘除/幂/开方)", "编写指南让 LLM 判断何时调用计算器 vs 自己推理", "测试混合推理：复杂公式自动分解为多步计算", "添加计算精度控制"],
        desc: "数学计算 + Tool Use",
        tech: "DeepSeek + Python",
          code: `from openai import OpenAI
import json
import math
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

# 安全的数学计算函数（限制可用的内置函数）
SAFE_NAMESPACE = {
    "abs": abs, "round": round, "pow": pow, "max": max, "min": min,
    "sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan,
    "log": math.log, "log10": math.log10, "exp": math.exp,
    "pi": math.pi, "e": math.e, "factorial": math.factorial,
}

def calculate(expression: str) -> float:
    """安全执行数学表达式计算"""
    try:
        result = eval(expression, {"__builtins__": {}}, SAFE_NAMESPACE)
        return round(result, 6)
    except Exception as e:
        return f"计算错误: {str(e)}"

tools = [{
    "type": "function",
    "function": {
        "name": "calculate",
        "description": "执行精确的数学计算。支持四则运算、三角函数、对数、幂运算等。对于任何需要数值结果的问题，必须调用此工具而非心算。",
        "parameters": {
            "type": "object",
            "properties": {
                "expression": {"type": "string", "description": "数学表达式，如 'sqrt(144) + sin(pi/4)'"}
            },
            "required": ["expression"],
        },
    },
}]

SYSTEM_PROMPT = """你是一个数学助手 Agent。重要规则：
1. 对于任何需要精确数值的问题，必须使用 calculate 工具，不要依赖自身心算
2. 对于概念性问题（如「什么是圆周率」），可以用自身知识回答
3. 复杂问题应分解为多步计算，每步调用一次工具"""

def calculator_agent(query: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]
    response = client.chat.completions.create(
        model="deepseek-chat", messages=messages, tools=tools, tool_choice="auto",
    )
    msg = response.choices[0].message

    if msg.tool_calls:
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments)
            result = calculate(args["expression"])
            messages.append(msg)
            messages.append({
                "role": "tool", "tool_call_id": call.id, "content": str(result),
            })
        final = client.chat.completions.create(model="deepseek-chat", messages=messages)
        return final.choices[0].message.content
    return msg.content

if __name__ == "__main__":
    print(calculator_agent("计算 sin(pi/4) + log(e^3) 的精确值"))
    print(calculator_agent("半径为 7.5 的圆的面积是多少？"))`,
	      expected_output: `对于 "计算 sin(pi/4) + log(e^3) 的精确值"，LLM 识别这是需要精确计算的问题，
自动调用 calculate 工具执行计算，返回数值结果（约 3.707107），
而非给出 LLM 自身的模糊估算。对于 "半径为 7.5 的圆的面积"，
LLM 同样调用工具计算 pi * 7.5^2 = 176.714587。
这验证了 Tool Use 模式的核心价值：LLM 通过外部工具获得自身不具备的精确计算能力。`,
	      reflection: [
	        "如果用户输入了包含 100 次迭代的循环计算请求（如累加求和），Agent 逐次调用工具会极其低效。你会如何设计来让 Agent 识别这种情况并改用更高效的方案？",
	        "eval() 函数存在安全风险。如果用户通过自然语言尝试注入恶意代码（如执行系统命令），当前的「白名单命名空间」设计能否有效防御？还有什么额外的安全措施可以添加？",
	        "LLM 有时会在不需要工具的问题上也调用 calculate（过度调用），有时又会在需要工具时依赖自身知识（调用不足）。如何通过 System Prompt 调优来找到最佳平衡点？",
	      ],
	      data_source: "Python math 库，所有计算在本地安全沙箱中执行",
	    },
      {
        name: "网页搜索 Agent",
        difficulty: "初级",
        goal: "集成实时搜索增强 Agent 的事实性，理解 Grounding 对减少幻觉的作用",
        estimated_time: "1 小时",
        tools: ["Tavily / Brave Search API", "DeepSeek API"],
        steps: ["注册搜索 API 并封装为 Tool", "设计 Agent 判断何时需要搜索（时效性问题/事实核查）", "将搜索结果格式化后注入 LLM 上下文", "添加引用溯源功能（标注信息来源）"],
        desc: "集成搜索引擎，实时信息查询",
        tech: "SerpAPI + LLM",
          code: `from openai import OpenAI
import json
import requests
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")
TAVILY_API_KEY = "your_tavily_api_key"

def web_search(query: str, max_results: int = 5) -> list[dict]:
    """调用 Tavily Search API 执行网络搜索"""
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
    }
    resp = requests.post(url, json=payload, timeout=15)
    data = resp.json()
    return [
        {"title": r["title"], "url": r["url"], "snippet": r["content"][:300]}
        for r in data.get("results", [])
    ]

tools = [{
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "搜索互联网获取最新信息。当用户问及时事新闻、最新数据、或需要事实核查时使用此工具。返回标题、URL和摘要。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词，用简洁的英文或中文"}
            },
            "required": ["query"],
        },
    },
}]

SYSTEM_PROMPT = """你是一个需要实时信息的 Agent。关键决策规则：
1. 用户询问当前事件、最新新闻、实时数据 → 必须搜索
2. 用户要求核实具体事实、数据或引用 → 必须搜索
3. 用户问及你知识截止日期之后的信息 → 必须搜索
4. 通用知识类问题（如历史事件）→ 可以基于自身知识回答
5. 回答时标注信息来源（标题 + URL）"""

def search_agent(query: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]
    response = client.chat.completions.create(
        model="deepseek-chat", messages=messages, tools=tools, tool_choice="auto",
    )
    msg = response.choices[0].message

    if msg.tool_calls:
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments)
            results = web_search(args["query"])
            messages.append(msg)
            messages.append({
                "role": "tool", "tool_call_id": call.id,
                "content": json.dumps(results, ensure_ascii=False),
            })
        final = client.chat.completions.create(model="deepseek-chat", messages=messages)
        return final.choices[0].message.content
    return msg.content

if __name__ == "__main__":
    # 时效性问题 → 应触发搜索
    print(search_agent("2024年诺贝尔物理学奖获得者是谁？"))`,
	      expected_output: `当用户询问时效性问题（如诺贝尔奖获得者）时，LLM 根据 System Prompt 中的规则判断需要搜索，
自动调用 web_search 工具获取最新信息。搜索结果（标题、URL、摘要）返回后，
LLM 将其整合为自然语言回答，并标注信息来源 URL。这体现了「Grounding」机制：
通过实时数据验证和补充 LLM 知识，有效减少幻觉。`,
	      reflection: [
	        "如果搜索结果中存在相互矛盾的信息（如两个来源对同一事件给出不同的数据），Agent 应该如何判断和呈现？你会设计怎样的置信度评估机制？",
	        "每次搜索消耗 Token 和 API 费用。你如何设计缓存策略，让 Agent 对于短时间内的重复搜索复用之前的结果？",
	        "对比 Tavily、Brave Search 和 Google SerpAPI 三种搜索 API，它们的搜索结果在质量、覆盖范围、响应速度上各有什么优劣？Agent 如何选择最合适的搜索后端？",
	      ],
	      data_source: "Tavily Search API (https://tavily.com/) 实时搜索互联网内容，适合 AI Agent 的语义搜索",
	    },
    ],
  };
