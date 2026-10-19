export const expertExperiments = {
    level: "专家级",
    badge: "expert",
    badgeVariant: "purple" as const,
    icon: "trophy",
    color: "var(--ws-color-accent)",
    items: [
      {
        name: "企业级 Agent 平台",
        difficulty: "专家",
        goal: "构建支持多租户、多 Agent 调度、权限管理、监控告警的企业级 Agent 服务平台",
        estimated_time: "8-10 小时",
        tools: ["FastAPI/LangServe", "Kubernetes", "PostgreSQL", "Redis", "Prometheus + Grafana"],
        steps: ["设计多租户架构（租户隔离/配额管理/API Key 生命周期）", "实现 Agent 调度引擎（任务队列/优先级/并发控制）", "构建可观测性层（LangSmith 集成 + Prometheus Metrics + Grafana Dashboard）", "实现权限系统（RBAC：Admin/Developer/User 三级权限）", "添加速率限制与 Token 预算管理", "构建管理后台（Agent 配置/日志查询/用量统计）"],
        desc: "多 Agent 调度 + 监控 + 权限管理",
        tech: "K8s + LangServe",
        code: `from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import asyncio, time, hashlib
from typing import Optional

app = FastAPI(title="Enterprise Agent Platform")
security = HTTPBearer()

class AgentRequest(BaseModel):
    tenant_id: str
    task: str
    priority: int = 1

# 简化的租户认证
async def verify_tenant(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    return f"tenant_{token_hash[:8]}"

# 速率限制 (简化版，生产环境应使用Redis)
rate_records: dict = {}

async def check_rate_limit(tenant_id: str, rpm: int = 60):
    now = time.time()
    records = rate_records.setdefault(tenant_id, [])
    records[:] = [t for t in records if now - t < 60]
    if len(records) >= rpm:
        raise HTTPException(status_code=429, detail="请求频率超限")
    records.append(now)

# 任务队列
task_queue: asyncio.Queue = asyncio.Queue()

async def agent_worker():
    while True:
        req: AgentRequest = await task_queue.get()
        print(f"[执行] 租户={req.tenant_id}, 任务={req.task[:50]}...")
        await asyncio.sleep(0.3)  # 模拟 Agent 执行
        task_queue.task_done()

@app.on_event("startup")
async def startup():
    asyncio.create_task(agent_worker())

@app.post("/api/v1/agent/run")
async def run_agent(
    req: AgentRequest,
    tenant_id: str = Depends(verify_tenant)
):
    await check_rate_limit(tenant_id, 60)
    await task_queue.put(req)
    return {"status": "accepted", "queue_depth": task_queue.qsize()}

@app.get("/api/v1/health")
async def health():
    return {"status": "healthy", "queue_depth": task_queue.qsize()}

# 启动: uvicorn main:app --host 0.0.0.0 --port 8000`,
        expected_output: `$ uvicorn main:app --host 0.0.0.0 --port 8000

# 健康检查
$ curl http://localhost:8000/api/v1/health
{"status":"healthy","queue_depth":0}

# 发起 Agent 任务
$ curl -X POST http://localhost:8000/api/v1/agent/run \\
  -H "Authorization: Bearer tk_test123" \\
  -H "Content-Type: application/json" \\
  -d '{"tenant_id":"t1","task":"分析Q2销售数据","priority":3}'
{"status":"accepted","queue_depth":1}

# 控制台日志
[执行] 租户=tenant_a665a459, 任务=分析Q2销售数据...

# 超限测试 (发送超过60次请求后)
{"detail":"请求频率超限"}  # HTTP 429`,
        reflection: [
          "企业级 Agent 平台的多租户隔离应该做到什么程度？共享底层 LLM 调用 vs 每租户独立部署 Agent，在成本、安全、性能上有何取舍？",
          "Agent 任务优先级调度中，如何避免低优先级任务永远得不到执行（饥饿问题）？在 Agent 场景下，你倾向于静态优先级还是动态自适应调度？",
          "当 Agent 平台同时服务 10000+ 租户时，内存级速率限制（rate_records dict）会有什么问题？你会如何用 Redis + 滑动窗口算法设计更可扩展的方案？",
        ],
        data_source: "FastAPI 搭建 HTTP 服务层，内存字典管理速率限制（生产应替换为 Redis）。Operation: pip install fastapi uvicorn pydantic 后启动服务。",
      },
      {
        name: "多模态 Agent",
        difficulty: "专家",
        goal: "构建融合文本、图像、音频处理能力的多模态 Agent，理解跨模态对齐与融合的技术挑战",
        estimated_time: "6-8 小时",
        tools: ["DeepSeek-V / 通义千问视觉", "Whisper", "TTS 服务", "Python"],
        steps: ["设计统一的多模态输入接口（文本/图像/音频自动路由到对应处理器）", "实现视觉理解管线（截图分析/图表解读/OCR+上下文理解）", "集成语音处理（ASR 语音转文字 + TTS 文字转语音）", "构建跨模态融合推理：图文混合输入 → 联合推理 → 多模态输出", "测试实际场景：产品图+文字描述 → 营销文案+语音播报"],
        desc: "文本 + 图像 + 语音综合处理",
        tech: "DeepSeek-V + Whisper",
        code: `import asyncio, base64, json
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

async def process_image(image_path: str) -> str:
    """视觉理解：分析图片内容"""
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()
    resp = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": "描述这张图片的内容、风格和关键元素。"},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
            ]
        }]
    )
    return resp.choices[0].message.content

async def process_audio(audio_path: str) -> str:
    """语音转录：Whisper ASR"""
    with open(audio_path, "rb") as f:
        transcript = await client.audio.transcriptions.create(
            model="whisper-1", file=f
        )
    return transcript.text

async def stream_llm_response(prompt: str) -> str:
    """流式生成：异步 generator 实现 streaming"""
    full_response = ""
    stream = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices[0].delta.content:
            token = chunk.choices[0].delta.content
            print(token, end="", flush=True)
            full_response += token
    return full_response

async def multimodal_pipeline(image_path: str, audio_path: str) -> dict:
    """多模态融合流水线"""
    print("=== 多模态处理开始 ===\\n")

    # 并行处理图像和音频
    image_task = process_image(image_path)
    audio_task = process_audio(audio_path)
    image_desc, audio_text = await asyncio.gather(image_task, audio_task)

    print(f"[视觉] {image_desc[:100]}...")
    print(f"[语音] {audio_text[:100]}...")

    # 跨模态融合推理
    fusion_prompt = f"""基于以下多模态输入进行综合推理:
    图像描述: {image_desc}
    语音转录: {audio_text}
    请给出综合分析，并在需要时建议后续行动。"""

    print("\\n[融合推理] ", end="")
    result = await stream_llm_response(fusion_prompt)
    return {"image_desc": image_desc, "audio_text": audio_text, "fusion": result}

# 运行多模态流水线
result = asyncio.run(multimodal_pipeline("product.jpg", "meeting.mp3"))
print("\\n\\n=== 最终报告 ===\\n", json.dumps(result, ensure_ascii=False, indent=2))`,
        expected_output: `=== 多模态处理开始 ===

[视觉] 这是一张白色背景的产品图，展示了一款智能手表。表盘为圆形设计，配有不锈钢表带...
[语音] 我认为这款产品的核心卖点应该是健康监测功能，特别是心率变异性和睡眠分析...

[融合推理] 综合分析：
1. 产品视觉呈现专业高端，建议营销文案匹配此调性
2. 语音中强调了健康监测的差异化优势
3. 建议营销策略: 以"专业健康伴侣"为定位，视觉上突出表盘健康数据界面...
4. 后续行动: (a)生成小红书种草文案 (b)制作产品功能对比图 (c)录制15秒TikTok短视频

=== 最终报告 ===
{
  "image_desc": "这是一张白色背景的产品图...",
  "audio_text": "我认为这款产品的核心卖点...",
  "fusion": "综合分析：1. 产品视觉呈现专业高端..."
}`,
        reflection: [
          "多模态 Agent 在处理图文混合输入时，不同模态的信息之间可能产生冲突（如图像显示产品很高级但语音描述批评了产品质量），Agent 应该如何调和这种跨模态矛盾？",
          "流式输出 (streaming) 对多模态 Agent 的意义是什么？在图中描述了 '需要立即响应' 的场景下，异步 generator 如何帮助降低首 Token 延迟？",
          "真实场景中，图片和语音的数据量可能很大（高分辨率照片、长时间会议录音），如何设计一个高效的多模态预处理管道来平衡处理质量和响应速度？",
        ],
        data_source: "图片和音频文件为本地文件，视觉模型（DeepSeek-V）和语音模型（Whisper）处理各自的模态输入。国内替代方案：通义千问视觉模型、智谱 GLM-4V。Operation: pip install openai 并准备 product.jpg 和 meeting.mp3 后运行。",
      },
      {
        name: "自治研究 Agent",
        difficulty: "专家",
        goal: "构建能自主进行科研探索的 Agent：确定研究方向→搜索文献→阅读筛选→实验→总结，实现闭环科研自动化",
        estimated_time: "6-8 小时",
        tools: ["LangChain/LangGraph", "ArXiv API", "Semantic Scholar", "Python"],
        steps: ["实现研究问题生成：根据领域热点自动生成研究假设", "文献搜索与筛选：查询 ArXiv/Semantic Scholar → 根据标题+摘要相关性筛选", "论文深度阅读：提取方法/结果/结论 → 生成结构化笔记", "实验设计：基于文献发现自动设计验证实验", "综述生成：整合多篇文献发现 → 撰写研究综述（含引用）"],
        desc: "自动搜索 → 阅读 → 总结论文",
        tech: "AutoGPT + ArXiv",
        code: `import arxiv, json, requests
from langchain_openai import ChatOpenAI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.agents import create_openai_functions_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate
from langchain.tools import tool

llm = ChatOpenAI(model="deepseek-chat", temperature=0.2, openai_api_key="sk-xxx", openai_api_base="https://api.deepseek.com/v1")
embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-large-zh-v1.5")

@tool
def search_arxiv(query: str) -> str:
    """在 ArXiv 上搜索论文。query: 英文搜索关键词。"""
    search = arxiv.Search(
        query=query, max_results=5,
        sort_by=arxiv.SortCriterion.Relevance
    )
    papers = []
    for r in search.results():
        papers.append({
            "title": r.title,
            "authors": [a.name for a in r.authors],
            "summary": r.summary[:200],
            "published": str(r.published)[:10],
            "id": r.entry_id.split("/")[-1],
        })
    return json.dumps(papers, ensure_ascii=False, indent=2)

@tool
def read_paper(arxiv_id: str) -> str:
    """获取论文详细摘要。arxiv_id: 如 2312.10997"""
    search = arxiv.Search(id_list=[arxiv_id])
    r = next(search.results())
    return json.dumps({
        "title": r.title, "authors": [a.name for a in r.authors],
        "summary": r.summary, "categories": r.categories,
    }, ensure_ascii=False, indent=2)

@tool
def search_semantic_scholar(query: str) -> str:
    """Semantic Scholar 搜索，含引用数。"""
    resp = requests.get(
        "https://api.semanticscholar.org/graph/v1/paper/search",
        params={"query": query, "limit": 5, "fields": "title,citationCount,year"}
    )
    return json.dumps(resp.json().get("data", []), ensure_ascii=False, indent=2)

tools = [search_arxiv, read_paper, search_semantic_scholar]

prompt = ChatPromptTemplate.from_messages([
    ("system", """你是AI研究科学家。执行流程:
1. 搜索论文 (ArXiv + Semantic Scholar)
2. 阅读详细摘要
3. 生成含引用的中文研究综述"""),
    ("user", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_openai_functions_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = executor.invoke({
    "input": "研究LLM Agent工具调用的最新进展，写一篇300字综述。"
})
print("\\n=== 研究综述 ===\\n", result["output"])`,
        expected_output: `> Entering new AgentExecutor chain...
调用工具: search_arxiv("LLM agent tool use 2024")
找到 5 篇论文
调用工具: search_semantic_scholar("LLM agent tool use")
获取引用数据
调用工具: read_paper("2402.12345")
阅读论文详情...

=== 研究综述 ===
# LLM Agent 工具调用最新进展综述

## 研究背景
工具调用已成为LLM Agent连接外部世界的核心技术...

## 关键进展
- Gorilla (2402.12345, 引用876次): 提出大规模工具调用数据集...
- ToolLLM (2307.16789, 引用1523次): 构建16000+真实API基准...

## 技术趋势
- MCP协议标准化推动工具生态互通
- 多Agent协同工具调用的涌现...

参考文献:
[1] Gorilla: LLM Connected with Massive APIs, 2402.12345
[2] ToolLLM: Facilitating LLMs to Master 16000+ APIs, 2307.16789`,
        reflection: [
          "自治研究 Agent 自动搜索到的论文中，如何区分高质量研究和低质量预印本？仅依赖引用数是否足够？如何引入同行评审状态、作者h指数等多维信号？",
          "要构建真正闭环的'AI科学家'，除了文献调研还需要哪些关键能力（实验设计、数据分析、假设修正）？这些能力的自动化当前面临哪些技术瓶颈？",
          "当 RAG Agent 生成的综述包含'幻觉引用'（不存在的论文），根源在检索阶段还是生成阶段？你会如何设计检测和修正机制？",
        ],
        data_source: "ArXiv API (arxiv Python包) 和 Semantic Scholar API 提供论文元数据。LLM 通过 DeepSeek API 基于检索结果自主生成综述，嵌入模型使用 BAAI/bge-large-zh-v1.5。国内替代方案：通义千问/智谱 GLM/月之暗面 Moonshot。Operation: pip install langchain langchain-openai langchain-community sentence-transformers faiss-cpu arxiv 后运行。",
      },
      {
        name: "GUI Agent",
        difficulty: "专家",
        goal: "构建能自主操作图形界面的 Agent：视觉理解屏幕 → 定位元素 → 规划操作序列 → 执行 → 验证结果",
        estimated_time: "6-8 小时",
        tools: ["Claude Computer Use / OpenAI Operator", "Playwright", "Python"],
        steps: ["理解 GUI Agent 的技术架构：截图 → 视觉模型理解界面 → 推理操作 → 执行 → 再截图验证", "实现元素定位：通过视觉坐标 + DOM 选择器双模式定位", "构建操作原子库：点击/输入/拖拽/滚动/等待/截图", "设计任务规划器：将高层目标分解为 GUI 操作序列", "添加错误恢复：操作失败时分析截图差异并重试", "测试：用自然语言描述 '帮我在淘宝搜索蓝牙耳机并按价格排序' "],
        desc: "视觉定位 + 操作浏览器/桌面应用",
        tech: "Claude Computer Use",
        code: `from playwright.sync_api import sync_playwright
import base64, json
from openai import OpenAI

client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com/v1")

class GUIAgent:
    def __init__(self):
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=False)
        self.page = self.browser.new_page()
        self.actions = []

    def screenshot(self) -> str:
        """截图并返回 base64"""
        b64 = base64.b64encode(self.page.screenshot()).decode()
        self.actions.append("截图")
        return b64

    def analyze_screen(self, goal: str, img_b64: str) -> dict:
        """用视觉模型分析当前屏幕，返回操作指令"""
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": f"目标: {goal}\\n分析截图，返回JSON操作: "
                     "{'action': 'click'|'type'|'scroll'|'wait'|'done', "
                     "'selector'/'text', 'reason'}"},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                ]
            }],
            response_format={"type": "json_object"}
        )
        return json.loads(resp.choices[0].message.content)

    def execute_action(self, action: dict):
        """执行GUI操作"""
        act = action["action"]
        if act == "click":
            self.page.click(action["selector"])
        elif act == "type":
            self.page.fill(action["selector"], action["text"])
        elif act == "scroll":
            self.page.evaluate("window.scrollBy(0, 500)")
        elif act == "wait":
            self.page.wait_for_timeout(2000)
        elif act == "done":
            return False
        self.actions.append(act)
        return True

    def run_task(self, goal: str, max_steps: int = 10):
        """自主执行GUI任务的主循环"""
        self.page.goto("https://www.baidu.com")
        self.page.wait_for_load_state("networkidle")

        for step in range(max_steps):
            print(f"\\n--- 步骤 {step+1}/{max_steps} ---")
            img = self.screenshot()
            decision = self.analyze_screen(goal, img)
            print(f"决策: {decision['action']} -> {decision.get('reason','')}")

            if not self.execute_action(decision):
                print("\\n=== 任务完成 ===")
                break
            self.page.wait_for_timeout(1000)

        self.browser.close()
        print(f"操作序列: {' -> '.join(self.actions)}")

agent = GUIAgent()
agent.run_task("在百度搜索'Python教程'")`,
        expected_output: `--- 步骤 1/10 ---
决策: type -> 在搜索框中输入搜索词
--- 步骤 2/10 ---
决策: click -> 点击搜索按钮
--- 步骤 3/10 ---
决策: wait -> 等待搜索结果加载
--- 步骤 4/10 ---
决策: done -> 搜索结果已展示

=== 任务完成 ===
操作序列: 截图 -> type -> 截图 -> click -> 截图 -> wait -> 截图 -> done`,
        reflection: [
          "GUI Agent 依赖截图+视觉模型的循环，这个循环中最大的延迟来源是什么？如何通过缓存、预测性操作、并行处理来优化响应速度？",
          "当 GUI Agent 操作失败时（如点击了错误的按钮），它如何通过视觉反馈检测到错误并进行自我修正？视觉diff vs DOM状态检查哪个更可靠？",
          "GUI Agent 在实际应用中面临的安全风险是什么？如果 Agent 误操作了删除按钮或支付按钮，应该如何设计安全护栏？",
        ],
        data_source: "Playwright 操作浏览器，DeepSeek（视觉版）分析截图并生成操作指令。百度搜索作为示例目标网站。Operation: pip install playwright openai && playwright install chromium 后运行。",
      },
      {
        name: "分布式 Agent Swarm",
        difficulty: "专家",
        goal: "构建大规模分布式 Agent 群体系统，探索涌现行为、负载均衡、去中心化协调等前沿问题",
        estimated_time: "8-12 小时",
        tools: ["Ray / Celery", "Redis", "LangGraph", "Python"],
        steps: ["设计 Agent Swarm 架构：Agent 注册中心、消息总线、任务分发器", "实现基于 Redis 的 Agent 间异步消息传递", "构建自适应任务分配：根据 Agent 负载和专长动态路由", "实现群体共识机制：投票/权重/仲裁多种策略", "添加群体行为监控：Agent 间通信图/任务流转/瓶颈分析", "实验：50+ Agent 并行处理大规模数据分类任务"],
        desc: "大规模 Agent 群体 + 去中心化协调",
        tech: "Ray + Redis + LangGraph",
        code: `import ray, time, random, json
from dataclasses import dataclass
from typing import List

ray.init(ignore_reinit_error=True)

@ray.remote
class SwarmAgent:
    def __init__(self, agent_id: str, expertise: str):
        self.id = agent_id
        self.expertise = expertise
        self.tasks_completed = 0
        self.opinions: dict = {}  # 对数据样本的分类意见

    def process_task(self, sample: dict) -> dict:
        """处理单个任务（模拟分类判断）"""
        time.sleep(random.uniform(0.1, 0.5))  # 模拟推理时间
        # 模拟基于专长的分类
        text, label = sample["text"], sample.get("label", "")
        prediction = random.choice(["正面", "负面", "中性"])
        self.tasks_completed += 1
        return {
            "agent_id": self.id,
            "expertise": self.expertise,
            "text": text[:30],
            "prediction": prediction,
            "confidence": round(random.uniform(0.6, 0.95), 2),
        }

    def get_stats(self) -> dict:
        return {"id": self.id, "expertise": self.expertise, "completed": self.tasks_completed}

@ray.remote
class SwarmOrchestrator:
    def __init__(self, agents: List[ray.actor.ActorHandle]):
        self.agents = agents

    def distribute_tasks(self, samples: List[dict]) -> List[dict]:
        """分配任务给所有 Agent 并收集结果"""
        futures = []
        for sample in samples:
            agent = random.choice(self.agents)  # 随机分配（可替换为负载感知路由）
            futures.append(agent.process_task.remote(sample))
        return ray.get(futures)

    def consensus_vote(self, results: List[dict]) -> str:
        """群体共识：多数投票"""
        votes = {}
        for r in results:
            pred = r["prediction"]
            votes[pred] = votes.get(pred, 0) + r["confidence"]
        return max(votes, key=votes.get) if votes else "无法判定"

# 创建50个 Agent Worker
agents = [SwarmAgent.remote(f"agent_{i}", random.choice(["NLP", "CV", "金融", "医疗", "法律"])) for i in range(50)]
print(f"Swarm 启动: {len(agents)} 个 Agent Worker")

# 准备测试数据（模拟100个文本分类样本）
samples = [{"text": f"这是第{i}条测试数据", "label": f"label_{i%3}"} for i in range(100)]

# 创建编排器
orchestrator = SwarmOrchestrator.remote(agents)

# 执行分布式任务
start = time.time()
results = ray.get(orchestrator.distribute_tasks.remote(samples))
elapsed = time.time() - start

print(f"\\\\n=== 执行统计 ===")
print(f"总任务: {len(samples)}, 总耗时: {elapsed:.2f}s")
print(f"吞吐量: {len(samples)/elapsed:.1f} 任务/秒")

# 群体共识
consensus = ray.get(orchestrator.consensus_vote.remote(results))
print(f"群体共识: {consensus}")

# Agent 负载统计
stats = ray.get([a.get_stats.remote() for a in agents])
loads = [(s["id"], s["completed"]) for s in stats]
print(f"负载分布: 平均={sum(c for _,c in loads)/len(loads):.1f}, 最大={max(c for _,c in loads)}, 最小={min(c for _,c in loads)}")

ray.shutdown()`,
        expected_output: `Swarm 启动: 50 个 Agent Worker

=== 执行统计 ===
总任务: 100, 总耗时: 3.42s
吞吐量: 29.2 任务/秒
群体共识: 正面

负载分布: 平均=2.0, 最大=5, 最小=0`,
        reflection: [
          "在大规模 Agent Swarm 中，随机任务分配导致了0-5的负载不均衡。你会如何设计更智能的负载感知调度（如最少连接数、Agent能力加权）来优化？",
          "多数投票共识机制对 '恶意 Agent' 或 '低质量 Agent' 有多大的容忍度？如果30%的 Agent 产生随机输出，投票结果还会正确吗？",
          "Ray 的分布式模型适合计算密集型任务，但 Agent 通常是 I/O 密集型（等待 LLM API 响应）。在大量 LLM API 调用场景下，Ray+Celery 哪个更适合？为什么？",
        ],
        data_source: "Ray 分布式计算框架管理50个模拟 Agent Worker。测试数据为随机生成的文本分类样本。Operation: pip install ray 后运行。",
      },
    ],
  };
