export const intermediateExperiments = {
    level: "中级",
    badge: "intermediate",
    badgeVariant: "warning" as const,
    icon: "bar-chart",
    color: "var(--ws-color-warning)",
    items: [
      {
        name: "RAG 知识库 Agent",
        difficulty: "中级",
        goal: "构建完整的 RAG 流水线：文档加载→分块→向量化→检索→生成，理解检索增强生成的完整链路",
        estimated_time: "2-3 小时",
        tools: ["LangChain", "Chroma/FAISS", "bge-large-zh-v1.5 (BAAI)", "Unstructured"],
        steps: ["加载多种格式文档 (PDF/Markdown/TXT)", "实现 Recursive Character Text Splitter 智能分块", "生成 embedding 并存入向量数据库", "实现语义检索 + Top-K 结果融合", "构建含引用溯源的 RAG 回答流水线", "使用 Ragas 评测检索质量"],
        desc: "上传文档 → 向量化 → 语义检索回答",
        tech: "LangChain + Chroma",
          code: `from openai import OpenAI
import chromadb
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

# 使用国产 BAAI/bge-large-zh-v1.5 嵌入模型（中文优化）
from sentence_transformers import SentenceTransformer
embedder = SentenceTransformer("BAAI/bge-large-zh-v1.5")

# 初始化 ChromaDB 向量数据库（持久化存储）
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="knowledge_base")

def build_index(documents: list[str], metadatas: list[dict] = None):
    """将文档向量化并存入 ChromaDB"""
    for i, doc in enumerate(documents):
        # 使用 bge-large-zh 生成向量
        embedding = embedder.encode(doc).tolist()
        collection.add(
            embeddings=[embedding],
            documents=[doc],
            metadatas=[metadatas[i]] if metadatas else None,
            ids=[f"doc_{i}"],
        )
    print(f"已索引 {len(documents)} 篇文档")

def retrieve(query: str, k: int = 3) -> list[str]:
    """语义检索：返回与查询最相关的 Top-K 文档"""
    query_emb = embedder.encode(query).tolist()
    results = collection.query(query_embeddings=[query_emb], n_results=k)
    return results["documents"][0] if results["documents"] else []

SYSTEM_PROMPT = """你是一个知识库问答 Agent。规则：
1. 根据提供的参考文档回答问题
2. 如果文档中没有相关信息，诚实说明「文档中未找到相关信息」
3. 回答时标注引用来源（文档编号）"""

def rag_agent(query: str) -> str:
    docs = retrieve(query, k=3)
    context = "\n\n---\n\n".join(
        f"[文档{i+1}] {doc}" for i, doc in enumerate(docs)
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"参考文档：\n{context}\n\n用户问题：{query}"},
    ]
    response = client.chat.completions.create(
        model="deepseek-chat", messages=messages, temperature=0.3,
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    docs = [
        "Python 是一种解释型、面向对象的高级编程语言，由 Guido van Rossum 创建。",
        "RAG（检索增强生成）将信息检索与文本生成结合，通过外部知识库提高 LLM 回答的事实准确性。",
        "ChromaDB 是一个开源的向量数据库，专为 AI 应用设计，支持高效的语义搜索。",
    ]
    build_index(docs)
    print(rag_agent("什么是 RAG？它如何提高准确性？"))`,
	        expected_output: `运行 build_index 后，3 篇文档被向量化并存入 ChromaDB。
用户提问 "什么是 RAG？" 时，系统自动将问题向量化，在向量空间中检索最相关的 Top-3 文档。
检索到文档 2 后，LLM 基于文档内容生成准确回答，并标注引用来源。
这体现了 RAG 的完整流水线：文档加载 → 分块 → 向量化 → 语义检索 → 增强生成。`,
	        reflection: [
	          "如果知识库有 10,000+ 篇文档，简单的 Top-K 检索可能不够精确。你会如何引入「重排序（Re-ranking）」来提升检索精度？",
	          "用户问「Python 和 Java 有什么区别？」，但知识库中只有 Python 的文档没有 Java 的。RAG Agent 应该如何诚实应对这种「知识盲区」？",
	          "对比 BAAI/bge-large-zh-v1.5、text-embedding-3-small 和通义千问 Embedding 三种嵌入模型，在中文检索精度、速度和成本上如何权衡？什么场景下值得升级到更强的模型？",
	        ],
	        data_source: "用户上传的文档（PDF/Markdown/TXT），经 BAAI/bge-large-zh-v1.5 中文嵌入模型向量化后存入 ChromaDB",
	      },
      {
        name: "多工具协作 Agent",
        difficulty: "中级",
        goal: "构建使用多个工具的 Agent，理解工具选择路由、并行调用、结果融合的完整流程",
        estimated_time: "2 小时",
        tools: ["LangChain", "DeepSeek Function Calling", "Python"],
        steps: ["注册 3-5 种不同类型的工具（搜索/计算/翻译/数据库查询/文件读写）", "实现工具描述的最佳实践（name + description + parameters 完整 JSON Schema）", "构建 Agent 决策循环：观察需求 → 选择工具 → 执行 → 评估是否继续", "添加并行工具调用优化（独立工具同时执行）", "测试工具调用冲突与错误恢复"],
        desc: "组合搜索、计算、数据库等工具",
        tech: "LangChain + 多 Tool",
          code: `from openai import OpenAI
import json
import math
import requests
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

# === 工具定义 ===
def calculator(expr: str) -> float:
    """安全的数学计算"""
    allowed = {"sqrt": math.sqrt, "sin": math.sin, "cos": math.cos,
               "pi": math.pi, "e": math.e, "log": math.log, "pow": pow}
    return round(eval(expr, {"__builtins__": {}}, allowed), 6)

def translator(text: str, target: str = "英文") -> str:
    """翻译文本"""
    resp = client.chat.completions.create(
        model="deepseek-chat", temperature=0.3,
        messages=[{"role": "system", "content": f"翻译为{target}，只返回翻译结果"},
                  {"role": "user", "content": text}],
    )
    return resp.choices[0].message.content

def search_knowledge(query: str) -> str:
    """模拟知识库搜索"""
    kb = {"Python": "Python 3.12 发布于 2023年10月",
           "React": "React 19 引入了 Server Components"}
    return kb.get(query, "未找到相关信息")

# 工具注册表
tools = [
    {"type": "function", "function": {"name": "calculator",
        "description": "执行数学计算，用于任何需要精确数值的问题",
        "parameters": {"type": "object", "properties": {
            "expr": {"type": "string", "description": "数学表达式"}},
            "required": ["expr"]}}},
    {"type": "function", "function": {"name": "translator",
        "description": "将文本翻译为目标语言",
        "parameters": {"type": "object", "properties": {
            "text": {"type": "string"}, "target": {"type": "string"}},
            "required": ["text", "target"]}}},
    {"type": "function", "function": {"name": "search_knowledge",
        "description": "搜索内部知识库获取技术信息",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"}}, "required": ["query"]}}},
]

TOOL_MAP = {"calculator": lambda a: calculator(a["expr"]),
            "translator": lambda a: translator(a["text"], a["target"]),
            "search_knowledge": lambda a: search_knowledge(a["query"])}

def multi_tool_agent(query: str) -> str:
    """多工具协作 Agent：LLM 自动选择并组合多个工具"""
    messages = [{"role": "user", "content": query}]
    for _ in range(5):  # 最多 5 轮工具调用
        resp = client.chat.completions.create(
            model="deepseek-chat", messages=messages, tools=tools, tool_choice="auto",
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return msg.content
        messages.append(msg)
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments)
            result = TOOL_MAP[call.function.name](args)
            messages.append({"role": "tool", "tool_call_id": call.id,
                             "content": str(result)})
    final = client.chat.completions.create(model="deepseek-chat", messages=messages)
    return final.choices[0].message.content

if __name__ == "__main__":
    print("=== 多步链式调用 ===")
    print(multi_tool_agent("计算半径为 5 的圆面积，并把结果翻译成英文"))`,
	        expected_output: `用户输入 "计算半径为 5 的圆面积，并把结果翻译成英文"。
Agent 第一轮调用 calculator 计算 pi * 5^2 = 78.539816，
第二轮调用 translator 将结果翻译为英文 "The area of a circle with radius 5 is approximately 78.54 square units"。
通过 5 轮循环保护，防止 Agent 无限调用工具，同时展示了多工具的自动编排能力。`,
	        reflection: [
	          "当多个工具都能满足用户需求时（如可以直接心算的简单问题），如何让 Agent 选择最优路径而非盲目调用工具？",
	          "如果 calculator 调用因表达式错误而失败，Agent 应该如何优雅地重试并向用户解释？你会设计怎样的错误恢复策略？",
	          "在真实场景中可能有 20+ 个工具，tools 参数的描述会变得非常长。如何通过工具分类、分层路由来管理大规模工具集？",
	        ],
	        data_source: "计算器使用本地 Python math 库，翻译使用 DeepSeek API，知识搜索使用本地模拟数据",
	      },
      {
        name: "记忆持久化 Agent",
        difficulty: "中级",
        goal: "实现具备长期记忆的 Agent，掌握用户画像记忆 + 会话记忆 + 知识记忆的三层记忆架构",
        estimated_time: "2-3 小时",
        tools: ["Mem0", "DeepSeek API", "Chroma"],
        steps: ["集成 Mem0 实现自动记忆提取（从对话中自动识别值得记录的信息）", "配置记忆分类：用户偏好 / 关键事实 / 历史任务", "实现记忆检索：根据当前查询检索相关历史记忆", "注入记忆到 Prompt：构建「当前问题 + 相关记忆 + 近期对话」的上下文", "测试跨会话记忆效果（退出后重启仍能回忆上次对话内容）"],
        desc: "长期记忆 + 个性化对话",
        tech: "Mem0 + Vector DB",
          code: `from openai import OpenAI
import json
import os
from datetime import datetime

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")
MEMORY_FILE = "agent_long_term_memory.json"

def load_memory() -> list[dict]:
    """从本地文件加载长期记忆"""
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_memory(memories: list[dict]):
    """持久化记忆到本地文件"""
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(memories, f, ensure_ascii=False, indent=2)

def extract_key_info(user_msg: str, assistant_msg: str) -> dict:
    """使用 LLM 自动从对话中提取值得记忆的关键信息"""
    prompt = f"""从以下对话中提取值得长期记忆的关键信息（JSON格式）：
用户: {user_msg}
助手: {assistant_msg}

返回格式：{{"topic": "主题", "facts": ["事实1", "事实2"], "preference": "偏好(如有)"}}
如果对话中没有值得长期记忆的信息，返回 {{"skip": true}}"""
    resp = client.chat.completions.create(
        model="deepseek-chat", temperature=0.2,
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(resp.choices[0].message.content)

def search_memory(memories: list[dict], query: str) -> list[dict]:
    """从记忆中检索与当前查询相关的历史信息"""
    # 简化版：关键词匹配（生产环境应使用向量检索）
    return [m for m in memories
            if any(word in json.dumps(m, ensure_ascii=False)
                   for word in query[:20])][-5:]

SYSTEM_PROMPT = """你是一个有长期记忆的助手。你记得与用户的历史对话。
在回答时请参考相关历史记忆，展现对话的连续性和个性化。"""

def memory_agent(user_query: str) -> str:
    memories = load_memory()
    relevant = search_memory(memories, user_query)
    memory_context = json.dumps(relevant, ensure_ascii=False, indent=2)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"用户的历史记忆：\n{memory_context}"},
        {"role": "user", "content": user_query},
    ]
    resp = client.chat.completions.create(
        model="deepseek-chat", messages=messages,
    )
    reply = resp.choices[0].message.content

    # 提取并保存新记忆
    info = extract_key_info(user_query, reply)
    if not info.get("skip"):
        info["timestamp"] = datetime.now().isoformat()
        memories.append(info)
        save_memory(memories)

    return reply

if __name__ == "__main__":
    print(memory_agent("你好，我叫小明，我喜欢打篮球"))
    print(memory_agent("你还记得我喜欢什么运动吗？"))`,
	        expected_output: `第一轮对话：用户说 "我叫小明，我喜欢打篮球"。Agent 回答后，extract_key_info 自动提取
{"topic": "用户偏好", "facts": ["名字叫小明", "喜欢打篮球"], "preference": "篮球"} 并存入 JSON 文件。
第二轮对话：用户问 "你还记得我喜欢什么运动吗？"，Agent 从文件中读取历史记忆，
找到相关记忆并回答 "小明，你之前提到过喜欢打篮球！" 展现了跨轮次的记忆连续性。`,
	        reflection: [
	          "当前方案用 JSON 文件存储记忆，当记忆量达到数万条时，文件 I/O 和关键词搜索会变得非常慢。你会如何升级到向量数据库（如 ChromaDB）来支持语义检索？",
	          "不是所有对话都值得记忆。如何设计「记忆重要性评分」机制，让 Agent 只记住关键信息（如用户偏好），而忽略闲聊内容？",
	          "如果多个用户共用同一个 Agent，如何实现记忆隔离（每人只能看到自己的记忆）？这与个性化推荐系统有什么异同？",
	        ],
	        data_source: "用户对话历史，经 LLM 自动提取关键信息后持久化存储在本地 JSON 文件",
	      },
      {
        name: "MCP 工具 Agent",
        difficulty: "中级",
        goal: "学习 MCP 协议：搭建 MCP Server，通过 MCP Client 使 Agent 访问自定义工具",
        estimated_time: "2 小时",
        tools: ["MCP Python SDK", "Claude API", "Python"],
        steps: ["使用 MCP SDK 创建一个自定义 MCP Server（暴露文件系统读取/写入工具）", "配置 MCP Client 连接至 Server", "使 Agent 通过 MCP 协议发现并调用工具", "测试 Tool 的动态注册与热加载", "对比 MCP 与 Function Calling 的架构差异"],
        desc: "搭建 MCP Server，通过 MCP 协议接入工具",
        tech: "MCP SDK + Claude",
          code: `from openai import OpenAI
import json
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

# ===== MCP 工具：模拟 MCP Server 暴露的文件系统工具 =====
def mcp_read_file(path: str) -> str:
    """MCP 工具：读取文件内容"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return content[:2000]  # 限制返回长度
    except FileNotFoundError:
        return f"错误: 文件 '{path}' 不存在"
    except Exception as e:
        return f"读取失败: {str(e)}"

def mcp_list_directory(directory: str = ".") -> list[str]:
    """MCP 工具：列出目录内容"""
    try:
        entries = os.listdir(directory)
        result = []
        for entry in entries:
            full = os.path.join(directory, entry)
            tag = "[DIR]" if os.path.isdir(full) else "[FILE]"
            result.append(f"{tag} {entry}")
        return result
    except Exception as e:
        return [f"错误: {str(e)}"]

# MCP 协议中的工具定义（与 Function Calling 兼容的 JSON Schema）
mcp_tools = [
    {"type": "function", "function": {"name": "read_file",
        "description": "MCP工具：读取指定文件的内容。输入文件路径，返回文件内容（最多2000字符）",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string", "description": "文件的完整路径"}},
            "required": ["path"]}}},
    {"type": "function", "function": {"name": "list_directory",
        "description": "MCP工具：列出指定目录中的所有文件和子目录",
        "parameters": {"type": "object", "properties": {
            "directory": {"type": "string", "description": "目录路径，默认为当前目录"}},
            "required": ["directory"]}}},
]

MCP_TOOL_MAP = {
    "read_file": lambda args: mcp_read_file(args["path"]),
    "list_directory": lambda args: mcp_list_directory(args.get("directory", ".")),
}

SYSTEM_PROMPT = """你是一个文件管理 Agent，通过 MCP 协议访问文件系统工具。
可用的 MCP 工具：read_file（读取文件）、list_directory（列出目录）。
使用这些工具来回答用户关于文件系统的问题。"""

def mcp_agent(query: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]
    resp = client.chat.completions.create(
        model="deepseek-chat", messages=messages,
        tools=mcp_tools, tool_choice="auto",
    )
    msg = resp.choices[0].message

    if msg.tool_calls:
        for call in msg.tool_calls:
            fn_name = call.function.name
            args = json.loads(call.function.arguments)
            result = MCP_TOOL_MAP[fn_name](args)
            messages.append(msg)
            messages.append({
                "role": "tool", "tool_call_id": call.id,
                "content": json.dumps(result, ensure_ascii=False, default=str),
            })
        final = client.chat.completions.create(model="deepseek-chat", messages=messages)
        return final.choices[0].message.content
    return msg.content

if __name__ == "__main__":
    print(mcp_agent("列出当前目录下的所有文件"))
    print(mcp_agent("读取 README.md 文件的内容"))`,
	        expected_output: `Agent 通过 MCP 协议（这里简化为 Function Calling 兼容格式）访问文件系统工具。
当用户请求 "列出当前目录" 时，Agent 调用 list_directory 获取文件列表并格式化输出。
当用户请求 "读取 README.md" 时，Agent 调用 read_file 返回文件内容。
这演示了 MCP 的核心思想：通过标准化协议让 LLM 发现和调用外部工具，
实现工具与 Agent 的解耦。`,
	        reflection: [
	          "MCP 协议与 OpenAI Function Calling 在架构上有什么本质区别？为什么 MCP 更适合构建开放的工具生态系统？",
	          "如果 MCP Server 运行在远程服务器上，Agent 如何通过网络发现并连接它？这与微服务架构中的服务发现有什么相似之处？",
	          "MCP 支持工具的动态注册和热加载（无需重启 Agent）。这种能力对于生产环境的 Agent 系统有什么重要意义？",
	        ],
	        data_source: "本地文件系统，通过 MCP 协议（模拟）暴露为 Agent 可调用的标准化工具",
	      },
      {
        name: "数据分析 Agent",
        difficulty: "中级",
        goal: "构建 Text-to-SQL + 可视化 Agent，理解 Agent 如何将自然语言转化为结构化查询与图表",
        estimated_time: "2 小时",
        tools: ["LangChain SQL Agent", "Pandas", "Matplotlib/Plotly"],
        steps: ["连接 SQL 数据库并在 Prompt 中注入 Schema 信息", "实现 Text-to-SQL：自然语言问题 → SQL 查询", "查询结果自动可视化（选择合适的图表类型）", "添加数据质量检查（空值/异常值/类型不匹配处理）", "构建交互式数据探索循环（追问/钻取/对比）"],
        desc: "自然语言查数据库、生成图表",
        tech: "Text-to-SQL + 可视化",
          code: `from openai import OpenAI
import sqlite3
import pandas as pd
import json
import os

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

# 创建示例销售数据库
conn = sqlite3.connect(":memory:")
sales_df = pd.DataFrame({
    "产品": ["手机", "平板", "笔记本", "耳机", "手表"],
    "销量": [150, 80, 60, 200, 120],
    "单价": [2999, 3999, 6999, 299, 1999],
    "类别": ["电子", "电子", "电子", "配件", "穿戴"],
    "日期": ["2024-01", "2024-01", "2024-02", "2024-02", "2024-03"],
})
sales_df.to_sql("sales", conn, index=False)

SCHEMA = """表名: sales
列: 产品(TEXT), 销量(INT), 单价(INT), 类别(TEXT), 日期(TEXT)
说明: 销量为月度销售数量，单价为人民币元"""

def execute_sql(query: str) -> str:
    """在 sales 数据库上执行 SQL 查询"""
    try:
        result = pd.read_sql_query(query, conn)
        if result.empty:
            return "查询结果为空"
        return result.to_string(index=False)
    except Exception as e:
        return f"SQL 执行错误: {str(e)}"

tools = [{
    "type": "function",
    "function": {
        "name": "execute_sql",
        "description": f"在 sales 数据库上执行 SELECT 查询。\\n{SCHEMA}",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "SQL SELECT 查询语句"}
            },
            "required": ["query"],
        },
    },
}]

def data_agent(question: str) -> str:
    """数据分析 Agent：自然语言 → SQL → 结果分析"""
    messages = [
        {"role": "system", "content":
            f"你是数据分析 Agent。数据库 Schema:\n{SCHEMA}\n"
            "规则：1) 只生成 SELECT 语句 2) 计算总销售额用 '销量*单价'"},
        {"role": "user", "content": question},
    ]
    resp = client.chat.completions.create(
        model="deepseek-chat", messages=messages, tools=tools, tool_choice="auto",
    )
    msg = resp.choices[0].message

    if msg.tool_calls:
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments)
            result = execute_sql(args["query"])
            messages.append(msg)
            messages.append({
                "role": "tool", "tool_call_id": call.id,
                "content": result,
            })
        final = client.chat.completions.create(model="deepseek-chat", messages=messages)
        return final.choices[0].message.content
    return msg.content

if __name__ == "__main__":
    print("=== 总销售额最高的产品 ===")
    print(data_agent("哪种产品的总销售额（销量×单价）最高？"))
    print("\n=== 按类别汇总 ===")
    print(data_agent("按类别统计总销量，从高到低排序"))`,
	        expected_output: `Agent 接收到自然语言问题后，根据 Schema 信息自动生成 SQL 查询。
对于 "哪种产品的总销售额最高？"，生成类似
"SELECT 产品, 销量*单价 as 总销售额 FROM sales ORDER BY 总销售额 DESC" 的 SQL，
执行后返回结果：笔记本(419,940元) > 手机(449,850元)。
对于 "按类别汇总"，生成 GROUP BY 查询并返回分类统计。`,
	        reflection: [
	          "用户问「哪些产品卖得好」，这个表述很模糊——是指销量高还是销售额高？如何让 Agent 在遇到歧义时主动向用户澄清？",
	          "如果数据库包含敏感字段（如用户手机号、身份证号），Agent 自动生成的 SQL 可能泄露隐私。如何设计字段级别的权限控制？",
	          "当前方案只支持 SELECT 查询。如果需要支持数据可视化（如生成柱状图），你会如何扩展 Agent 让它自动选择合适的图表类型？",
	        ],
	        data_source: "SQLite 内存数据库，预置示例销售数据（产品、销量、单价、类别、日期）",
	      },
    ],
  };
