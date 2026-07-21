"""Archived Agents learning content migration source.

Hardcoded from frontend/src/pages/Admin/ITTechnology/agents/data.ts
experimentLevels and TOOLS_DATA exports.

Do not execute this file directly. Its course content must first be migrated to
the versioned, idempotent seed format described by the project plan.
"""

if __name__ == "__main__":
    raise SystemExit("Archived course source only; direct database seeding is disabled.")

import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import AsyncSessionLocal
from app.models.learning.content import LearningContentItem


# ─── Agents Experiments ────────────────────────────────────────────────────
# Derived from agents/data.ts experimentLevels
AGENTS_EXPERIMENTS = {
    "beginner": [
        {
            "name": "Hello World Agent",
            "difficulty": "beginner",
            "goal": "理解 Agent 最简实现：Prompt → LLM 调用 → 响应。学习 Agent 的本质是 LLM + 循环",
            "estimated_time": "30 分钟",
            "tools": ["DeepSeek API (OpenAI 兼容)", "Python"],
            "steps": [
                "设置 DeepSeek API Key（或通义千问/智谱 GLM 等其他国产平台）",
                "编写 System Prompt 定义 Agent 角色",
                "实现单轮问答循环",
                "添加简单退出条件 (输入 quit 退出)",
            ],
            "desc": "用 30 行 Python 实现最简 Agent 对话循环",
            "tech": "DeepSeek API",
        },
        {
            "name": "天气查询 Agent",
            "difficulty": "beginner",
            "goal": "学习 Function Calling 的基本模式：定义工具 Schema → LLM 选择工具 → 执行 → 返回结果",
            "estimated_time": "1 小时",
            "tools": ["DeepSeek Function Calling", "OpenWeatherMap API"],
            "steps": [
                "定义 get_weather 函数的 JSON Schema",
                "注册工具到 LLM 调用",
                "解析 LLM 返回的工具调用",
                "执行天气查询并返回结果",
                "处理工具调用失败的情况",
            ],
            "desc": "调用天气 API，Function Calling 入门",
            "tech": "DeepSeek + 天气API",
        },
        {
            "name": "翻译 Agent",
            "difficulty": "beginner",
            "goal": "掌握 System Prompt 角色定义与多语言处理，理解 Prompt 对 Agent 行为的控制力",
            "estimated_time": "45 分钟",
            "tools": ["DeepSeek / 通义千问 API", "langdetect"],
            "steps": [
                "设计翻译 Agent 的 System Prompt（含目标语言/风格/术语约束）",
                "集成语言检测自动识别源语言",
                "实现批量翻译与格式保持",
                "测试方言与俚语处理效果",
            ],
            "desc": "多语言翻译 + 语言检测",
            "tech": "LLM Prompt",
        },
        {
            "name": "计算器 Agent",
            "difficulty": "beginner",
            "goal": "实践 Tool Use 模式，理解 Agent 如何判断何时需要调用外部工具而非依靠自身知识",
            "estimated_time": "45 分钟",
            "tools": ["DeepSeek Function Calling", "Python math"],
            "steps": [
                "创建计算器工具 (加减乘除/幂/开方)",
                "编写指南让 LLM 判断何时调用计算器 vs 自己推理",
                "测试混合推理：复杂公式自动分解为多步计算",
                "添加计算精度控制",
            ],
            "desc": "数学计算 + Tool Use",
            "tech": "DeepSeek + Python",
        },
        {
            "name": "网页搜索 Agent",
            "difficulty": "beginner",
            "goal": "集成实时搜索增强 Agent 的事实性，理解 Grounding 对减少幻觉的作用",
            "estimated_time": "1 小时",
            "tools": ["Tavily / Brave Search API", "DeepSeek API"],
            "steps": [
                "注册搜索 API 并封装为 Tool",
                "设计 Agent 判断何时需要搜索（时效性问题/事实核查）",
                "将搜索结果格式化后注入 LLM 上下文",
                "添加引用溯源功能（标注信息来源）",
            ],
            "desc": "集成搜索引擎，实时信息查询",
            "tech": "SerpAPI + LLM",
        },
    ],
    "intermediate": [
        {
            "name": "RAG 知识库 Agent",
            "difficulty": "intermediate",
            "goal": "构建完整的 RAG 流水线：文档加载→分块→向量化→检索→生成，理解检索增强生成的完整链路",
            "estimated_time": "2-3 小时",
            "tools": ["LangChain", "Chroma/FAISS", "bge-large-zh-v1.5 (BAAI)", "Unstructured"],
            "steps": [
                "加载多种格式文档 (PDF/Markdown/TXT)",
                "实现 Recursive Character Text Splitter 智能分块",
                "生成 embedding 并存入向量数据库",
                "实现语义检索 + Top-K 结果融合",
                "构建含引用溯源的 RAG 回答流水线",
                "使用 Ragas 评测检索质量",
            ],
            "desc": "上传文档 → 向量化 → 语义检索回答",
            "tech": "LangChain + Chroma",
        },
        {
            "name": "多工具协作 Agent",
            "difficulty": "intermediate",
            "goal": "构建使用多个工具的 Agent，理解工具选择路由、并行调用、结果融合的完整流程",
            "estimated_time": "2 小时",
            "tools": ["LangChain", "DeepSeek Function Calling", "Python"],
            "steps": [
                "注册 3-5 种不同类型的工具（搜索/计算/翻译/数据库查询/文件读写）",
                "实现工具描述的最佳实践（name + description + parameters 完整 JSON Schema）",
                "构建 Agent 决策循环：观察需求 → 选择工具 → 执行 → 评估是否继续",
                "添加并行工具调用优化（独立工具同时执行）",
                "测试工具调用冲突与错误恢复",
            ],
            "desc": "组合搜索、计算、数据库等工具",
            "tech": "LangChain + 多 Tool",
        },
        {
            "name": "记忆持久化 Agent",
            "difficulty": "intermediate",
            "goal": "实现具备长期记忆的 Agent，掌握用户画像记忆 + 会话记忆 + 知识记忆的三层记忆架构",
            "estimated_time": "2-3 小时",
            "tools": ["Mem0", "DeepSeek API", "Chroma"],
            "steps": [
                "集成 Mem0 实现自动记忆提取（从对话中自动识别值得记录的信息）",
                "配置记忆分类：用户偏好 / 关键事实 / 历史任务",
                "实现记忆检索：根据当前查询检索相关历史记忆",
                "注入记忆到 Prompt：构建「当前问题 + 相关记忆 + 近期对话」的上下文",
                "测试跨会话记忆效果（退出后重启仍能回忆上次对话内容）",
            ],
            "desc": "长期记忆 + 个性化对话",
            "tech": "Mem0 + Vector DB",
        },
        {
            "name": "MCP 工具 Agent",
            "difficulty": "intermediate",
            "goal": "学习 MCP 协议：搭建 MCP Server，通过 MCP Client 使 Agent 访问自定义工具",
            "estimated_time": "2 小时",
            "tools": ["MCP Python SDK", "Claude API", "Python"],
            "steps": [
                "使用 MCP SDK 创建一个自定义 MCP Server（暴露文件系统读取/写入工具）",
                "配置 MCP Client 连接至 Server",
                "使 Agent 通过 MCP 协议发现并调用工具",
                "测试 Tool 的动态注册与热加载",
                "对比 MCP 与 Function Calling 的架构差异",
            ],
            "desc": "搭建 MCP Server，通过 MCP 协议接入工具",
            "tech": "MCP SDK + Claude",
        },
        {
            "name": "数据分析 Agent",
            "difficulty": "intermediate",
            "goal": "构建 Text-to-SQL + 可视化 Agent，理解 Agent 如何将自然语言转化为结构化查询与图表",
            "estimated_time": "2 小时",
            "tools": ["LangChain SQL Agent", "Pandas", "Matplotlib/Plotly"],
            "steps": [
                "连接 SQL 数据库并在 Prompt 中注入 Schema 信息",
                "实现 Text-to-SQL：自然语言问题 → SQL 查询",
                "查询结果自动可视化（选择合适的图表类型）",
                "添加数据质量检查（空值/异常值/类型不匹配处理）",
                "构建交互式数据探索循环（追问/钻取/对比）",
            ],
            "desc": "自然语言查数据库、生成图表",
            "tech": "Text-to-SQL + 可视化",
        },
    ],
    "advanced": [
        {
            "name": "多 Agent 辩论系统",
            "difficulty": "advanced",
            "goal": "构建使用辩论模式提升决策质量的系统：正方+反方+裁判三方 Agent 通过多轮辩论达成更优结论",
            "estimated_time": "3-4 小时",
            "tools": ["AutoGen / CrewAI", "DeepSeek API / 通义千问"],
            "steps": [
                "设计三方 Agent 的 System Prompt（正方/反方/法官各有不同的论证风格与评判标准）",
                "实现多轮辩论循环：立论→反驳→再反驳→总结→裁决",
                "添加逻辑谬误检测机制（循环论证/稻草人/滑坡谬误）",
                "构建辩论质量评分体系（论证深度/证据引用/逻辑一致性）",
                "对比单 Agent 决策 vs 辩论共识的质量差异",
            ],
            "desc": "正反方辩论提升决策质量",
            "tech": "AutoGen / CrewAI",
        },
        {
            "name": "Agent 自动编码系统",
            "difficulty": "advanced",
            "goal": "构建端到端编码 Agent：自然语言需求 → 架构设计 → 代码生成 → 自动测试 → Bug 修复循环",
            "estimated_time": "4 小时",
            "tools": ["MetaGPT / Claude Code", "Python", "Pytest"],
            "steps": [
                "定义产品经理 Agent（需求分析 + 生成 PRD）",
                "定义架构师 Agent（技术选型 + 架构设计）",
                "定义工程师 Agent（按 PRD 和架构生成代码）",
                "定义测试 Agent（自动生成单元测试 + 集成测试）",
                "定义 QA Agent（运行测试→报告失败→反馈给工程师修复）",
            ],
            "desc": "自然语言需求 → 代码生成 → 测试",
            "tech": "MetaGPT / Claude",
        },
        {
            "name": "Agent 数据分析流水线",
            "difficulty": "advanced",
            "goal": "构建多 Agent 编排的 ETL + 分析流水线，理解 Agent 编排中状态传递、错误传播、断点恢复的设计",
            "estimated_time": "3 小时",
            "tools": ["LangGraph", "Pandas", "SQL"],
            "steps": [
                "定义 ETL 各阶段的 Agent 节点（数据提取/清洗/转换/加载/分析/可视化）",
                "用 LangGraph StateGraph 编排流水线",
                "添加条件路由：根据数据质量决定是否需要额外清洗",
                "实现 Checkpoint 持久化：任务中断后从断点恢复",
                "添加 Human-in-the-Loop 审核节点（关键数据变更需人工确认）",
            ],
            "desc": "Agent 编排 ETL 流程",
            "tech": "LangGraph + Pandas",
        },
        {
            "name": "内容创作 Agent 团队",
            "difficulty": "advanced",
            "goal": "构建多角色创意团队：调研员→策划→文案→设计师→审核员，完整产出营销内容",
            "estimated_time": "3-4 小时",
            "tools": ["CrewAI", "DALL-E / Stable Diffusion", "Python"],
            "steps": [
                "定义调研 Agent（搜索热点话题+竞品分析）",
                "定义策划 Agent（内容策略+大纲 + 角度定位）",
                "定义文案 Agent（按大纲生成各平台版本的内容）",
                "定义配图 Agent（根据内容生成/检索配图）",
                "定义审核 Agent（品牌一致性检查+事实核查+SEO优化）",
                "实现全流程串联与人工最终审核节点",
            ],
            "desc": "多 Agent 协作：调研→撰写→配图",
            "tech": "CrewAI + DALL-E",
        },
        {
            "name": "安全 Agent 攻防实验",
            "difficulty": "advanced",
            "goal": "深入理解 Agent 安全：构建红队攻击 Agent 与防御层，通过实战理解 Prompt 注入、越狱、数据泄露风险",
            "estimated_time": "3-4 小时",
            "tools": ["Python", "DeepSeek API", "自定义安全层"],
            "steps": [
                "构建红队 Agent：自动化生成各类 Prompt 注入攻击（直接注入/间接注入/多轮注入/编码绕过）",
                "实现输入净化层：检测并过滤已知攻击模式",
                "实现输出过滤层：检查输出是否含敏感信息",
                "构建权限沙箱：工具调用需要权限校验",
                "统计攻防成功率并生成安全报告",
            ],
            "desc": "红队攻击 vs 防御层实战",
            "tech": "Python + DeepSeek API",
        },
    ],
    "expert": [
        {
            "name": "企业级 Agent 平台",
            "difficulty": "expert",
            "goal": "构建支持多租户、多 Agent 调度、权限管理、监控告警的企业级 Agent 服务平台",
            "estimated_time": "8-10 小时",
            "tools": ["FastAPI/LangServe", "Kubernetes", "PostgreSQL", "Redis", "Prometheus + Grafana"],
            "steps": [
                "设计多租户架构（租户隔离/配额管理/API Key 生命周期）",
                "实现 Agent 调度引擎（任务队列/优先级/并发控制）",
                "构建可观测性层（LangSmith 集成 + Prometheus Metrics + Grafana Dashboard）",
                "实现权限系统（RBAC：Admin/Developer/User 三级权限）",
                "添加速率限制与 Token 预算管理",
                "构建管理后台（Agent 配置/日志查询/用量统计）",
            ],
            "desc": "多 Agent 调度 + 监控 + 权限管理",
            "tech": "K8s + LangServe",
        },
        {
            "name": "多模态 Agent",
            "difficulty": "expert",
            "goal": "构建融合文本、图像、音频处理能力的多模态 Agent，理解跨模态对齐与融合的技术挑战",
            "estimated_time": "6-8 小时",
            "tools": ["GPT-4V / Claude Vision", "Whisper", "TTS 服务", "Python"],
            "steps": [
                "设计统一的多模态输入接口（文本/图像/音频自动路由到对应处理器）",
                "实现视觉理解管线（截图分析/图表解读/OCR+上下文理解）",
                "集成语音处理（ASR 语音转文字 + TTS 文字转语音）",
                "构建跨模态融合推理：图文混合输入 → 联合推理 → 多模态输出",
                "测试实际场景：产品图+文字描述 → 营销文案+语音播报",
            ],
            "desc": "文本 + 图像 + 语音综合处理",
            "tech": "GPT-4V + Whisper",
        },
        {
            "name": "自治研究 Agent",
            "difficulty": "expert",
            "goal": "构建能自主进行科研探索的 Agent：确定研究方向→搜索文献→阅读筛选→实验→总结，实现闭环科研自动化",
            "estimated_time": "6-8 小时",
            "tools": ["LangChain/LangGraph", "ArXiv API", "Semantic Scholar", "Python"],
            "steps": [
                "实现研究问题生成：根据领域热点自动生成研究假设",
                "文献搜索与筛选：查询 ArXiv/Semantic Scholar → 根据标题+摘要相关性筛选",
                "论文深度阅读：提取方法/结果/结论 → 生成结构化笔记",
                "实验设计：基于文献发现自动设计验证实验",
                "综述生成：整合多篇文献发现 → 撰写研究综述（含引用）",
            ],
            "desc": "自动搜索 → 阅读 → 总结论文",
            "tech": "AutoGPT + ArXiv",
        },
        {
            "name": "GUI Agent",
            "difficulty": "expert",
            "goal": "构建能自主操作图形界面的 Agent：视觉理解屏幕 → 定位元素 → 规划操作序列 → 执行 → 验证结果",
            "estimated_time": "6-8 小时",
            "tools": ["Claude Computer Use / 国产视觉 Agent", "Playwright", "Python"],
            "steps": [
                "理解 GUI Agent 的技术架构：截图 → 视觉模型理解界面 → 推理操作 → 执行 → 再截图验证",
                "实现元素定位：通过视觉坐标 + DOM 选择器双模式定位",
                "构建操作原子库：点击/输入/拖拽/滚动/等待/截图",
                "设计任务规划器：将高层目标分解为 GUI 操作序列",
                "添加错误恢复：操作失败时分析截图差异并重试",
                "测试：用自然语言描述 '帮我在淘宝搜索蓝牙耳机并按价格排序'",
            ],
            "desc": "视觉定位 + 操作浏览器/桌面应用",
            "tech": "Claude Computer Use",
        },
        {
            "name": "分布式 Agent Swarm",
            "difficulty": "expert",
            "goal": "构建大规模分布式 Agent 群体系统，探索涌现行为、负载均衡、去中心化协调等前沿问题",
            "estimated_time": "8-12 小时",
            "tools": ["Ray / Celery", "Redis", "LangGraph", "Python"],
            "steps": [
                "设计 Agent Swarm 架构：Agent 注册中心、消息总线、任务分发器",
                "实现基于 Redis 的 Agent 间异步消息传递",
                "构建自适应任务分配：根据 Agent 负载和专长动态路由",
                "实现群体共识机制：投票/权重/仲裁多种策略",
                "添加群体行为监控：Agent 间通信图/任务流转/瓶颈分析",
                "实验：50+ Agent 并行处理大规模数据分类任务",
            ],
            "desc": "大规模 Agent 群体 + 去中心化协调",
            "tech": "Ray + Redis + LangGraph",
        },
    ],
    "research": [
        {
            "name": "自我进化 Agent",
            "difficulty": "expert",
            "goal": "实验 Agent 的自我改进能力：自动发现自身弱点 → 生成改进策略 → 重训练/微调 → 评估改进效果",
            "estimated_time": "12-16 小时",
            "tools": ["DSPy", "DeepSeek API", "Python", "MLflow"],
            "steps": [
                "构建性能自诊断系统（自动分析 Agent 失败案例的根因）",
                "用 DSPy 实现 Prompt 自动优化（根据失败案例自动调整 Prompt）",
                "实现策略库：存储成功策略→检索→相似场景复用",
                "构建自动 A/B 测试框架（新策略 vs 旧策略对比评测）",
                "实现持续学习管道：新案例→分析→优化→评测→上线",
            ],
            "desc": "Agent 自我诊断弱点 → 自动优化 Prompt + 策略",
            "tech": "DSPy + MLflow",
        },
        {
            "name": "多 Agent 社会模拟",
            "difficulty": "expert",
            "goal": "构建包含 100+ Agent 的模拟社会，研究信息传播、观点演化、合作与竞争等社会动力学现象",
            "estimated_time": "12-16 小时",
            "tools": ["Camel / AutoGen", "Python", "NetworkX"],
            "steps": [
                "设计 Agent 社会参数：人口规模/社交网络拓扑/初始观点分布/信息传播速率",
                "定义 Agent 类型（领导者/追随者/怀疑者/孤立者）",
                "构建社交网络（小世界网络/无标度网络）",
                "实现信息传播模拟：谣言/新闻/观点的传播与演化",
                "可视化分析：社会网络图/观点分布变化/影响力排名",
                "实验：不同网络结构对共识达成的速度影响",
            ],
            "desc": "100+ Agent 社会动力学模拟",
            "tech": "Camel + NetworkX",
        },
        {
            "name": "长期自主 Agent 生存实验",
            "difficulty": "expert",
            "goal": "验证 Agent 在无人工干预下持续运行 24 小时的能力：自主管理 Token 预算、处理错误、任务优先级动态调整",
            "estimated_time": "24 小时运行 + 4 小时搭建",
            "tools": ["LangGraph", "DeepSeek API", "PostgreSQL", "Prometheus"],
            "steps": [
                "设计长期自主运行架构（任务队列/状态持久化/健康检查/心跳监控）",
                "实现自适应 Token 预算管理（根据剩余预算调整任务粒度）",
                "构建故障自恢复机制（死锁检测/级联错误隔离/降级策略）",
                "添加运行日志与指标采集（每小时 Token 消耗/任务完成率/错误率）",
                "设计多样化任务集（信息检索/数据分析/内容生成/代码编写）",
                "24 小时运行 + 实时监控 Dashboard + 最终分析报告",
            ],
            "desc": "Agent 24 小时无干预自主运行极限测试",
            "tech": "LangGraph + PostgreSQL + Prometheus",
        },
    ],
}


# ─── Agents Tools ──────────────────────────────────────────────────────────
# Mirrors frontend/src/pages/Admin/ITTechnology/agents/data.ts TOOLS_DATA

AGENTS_TOOLS = [
    # ── 核心框架 ──────────────────────────────────
    {
        "name": "LangChain",
        "description": "LLM 应用开发的事实标准框架，提供 Chains/Agents/Tools/Memory 完整抽象与 700+ 三方集成。实验「多工具协作 Agent」和「RAG 知识库 Agent」的核心依赖。",
        "category": "核心框架",
        "url": "https://www.langchain.com",
        "difficulty": "intermediate",
        "pip_install": "pip install langchain langchain-community",
        "best_for": "通用 LLM 应用与 Agent 开发，原型到生产全流程",
        "related_experiments": ["多工具协作 Agent", "RAG 知识库 Agent", "自治研究 Agent"],
    },
    {
        "name": "CrewAI",
        "description": "专注多 Agent 角色化协作的框架，通过 Role/Goal/Backstory 定义 Agent 角色，支持 Sequential 和 Hierarchical 两种执行策略。实验「内容创作 Agent 团队」用它编排多角色协作。",
        "category": "核心框架",
        "url": "https://www.crewai.com",
        "difficulty": "beginner",
        "pip_install": "pip install crewai",
        "best_for": "多 Agent 角色扮演、内容创作团队、协作式任务",
        "related_experiments": ["多 Agent 辩论系统", "内容创作 Agent 团队"],
    },
    {
        "name": "AutoGen",
        "description": "微软开源的多 Agent 对话编程框架，ConversableAgent 统一抽象 + GroupChat 群聊管理。v0.4 重构后引入异步消息传递。实验「多 Agent 辩论系统」可用它实现三方辩论。",
        "category": "核心框架",
        "url": "https://github.com/microsoft/autogen",
        "difficulty": "advanced",
        "pip_install": "pip install pyautogen",
        "best_for": "多 Agent 对话系统、代码生成与审查、企业协作场景",
        "related_experiments": ["多 Agent 辩论系统", "Agent 自动编码系统", "多 Agent 社会模拟"],
    },
    {
        "name": "LangGraph",
        "description": "LangChain 生态的有状态图编排引擎，StateGraph + 条件边 + Checkpoint 持久化，专为复杂多步 Agent 工作流设计。实验「Agent 数据分析流水线」用它编排 ETL 各阶段节点。",
        "category": "核心框架",
        "url": "https://github.com/langchain-ai/langgraph",
        "difficulty": "advanced",
        "pip_install": "pip install langgraph",
        "best_for": "复杂 Agent 工作流编排、多 Agent 状态机、人机协同流程",
        "related_experiments": ["Agent 数据分析流水线", "分布式 Agent Swarm", "长期自主 Agent 生存实验"],
    },
    {
        "name": "Dify",
        "description": "可视化 LLM 应用搭建平台，通过拖拽式工作流编排降低 Agent 开发门槛。支持 RAG 流水线与 Agent 策略的可视化配置，适合非开发者快速搭建 Agent 应用。",
        "category": "核心框架",
        "url": "https://dify.ai",
        "difficulty": "beginner",
        "pip_install": "无需安装（Docker 部署）或使用云版",
        "best_for": "非开发者快速搭建 Agent、企业内部 AI 应用平台、可视化工作流编排",
    },
    # ── 开发工具 ──────────────────────────────────
    {
        "name": "DeepSeek API",
        "description": "国产大模型 API，OpenAI 兼容接口（base_url=\"https://api.deepseek.com/v1\"），支持 Function Calling / 流式输出 / JSON Mode。实验的学习实现均使用 DeepSeek 作为默认后端，可无缝替换为通义千问 (Qwen)、智谱 GLM、月之暗面 Moonshot 等其他国产平台。",
        "category": "开发工具",
        "url": "https://platform.deepseek.com",
        "difficulty": "beginner",
        "pip_install": "pip install openai（使用 OpenAI SDK 兼容接口调用）",
        "best_for": "通用 Agent 推理、代码生成、国内生态深度集成",
        "related_experiments": ["Hello World Agent", "天气查询 Agent", "翻译 Agent", "计算器 Agent", "网页搜索 Agent", "RAG 知识库 Agent", "多工具协作 Agent", "记忆持久化 Agent", "MCP 工具 Agent", "数据分析 Agent"],
    },
    {
        "name": "通义千问 (Qwen)",
        "description": "阿里云通义千问系列模型，包括 Qwen-Max/Qwen-Plus/Qwen-Turbo 等，支持长文本和多模态。API 兼容 OpenAI 协议，提供专属 DashScope SDK。适合企业级中文场景。",
        "category": "开发工具",
        "url": "https://dashscope.aliyun.com",
        "difficulty": "beginner",
        "pip_install": "pip install dashscope（或使用 OpenAI SDK 兼容模式）",
        "best_for": "中文长文本处理、企业应用、多模态理解",
        "related_experiments": ["翻译 Agent", "RAG 知识库 Agent", "多模态 Agent"],
    },
    {
        "name": "智谱 GLM",
        "description": "智谱 AI 的 GLM 系列模型（GLM-4/GLM-4V），中文理解能力强，支持 Function Calling 和 Code Interpreter。适合对中文生成质量要求高的 Agent 场景。",
        "category": "开发工具",
        "url": "https://open.bigmodel.cn",
        "difficulty": "beginner",
        "pip_install": "pip install zhipuai（或使用 OpenAI SDK 兼容模式）",
        "best_for": "中文深度推理、多模态、代码生成",
        "related_experiments": ["翻译 Agent", "数据分析 Agent", "Agent 自动编码系统"],
    },
    {
        "name": "月之暗面 Moonshot",
        "description": "月之暗面 Kimi 系列模型，128K 超长上下文窗口，擅长长文档分析和知识问答。API 兼容 OpenAI 协议。",
        "category": "开发工具",
        "url": "https://platform.moonshot.cn",
        "difficulty": "beginner",
        "pip_install": "pip install openai（使用 OpenAI SDK 兼容接口调用）",
        "best_for": "长文档分析、知识库问答、超长上下文对话",
        "related_experiments": ["RAG 知识库 Agent", "记忆持久化 Agent", "自治研究 Agent"],
    },
    {
        "name": "Anthropic API",
        "description": "Claude 系列 API，200K 上下文窗口 + 原生 Tool Use + Prompt Caching，擅长长文档分析与代码生成。实验「安全 Agent 攻防实验」推荐用它测试注入防御。",
        "category": "开发工具",
        "url": "https://docs.anthropic.com",
        "difficulty": "beginner",
        "pip_install": "pip install anthropic",
        "best_for": "长文档分析、代码生成、安全敏感场景、MCP 集成",
        "related_experiments": ["MCP 工具 Agent", "安全 Agent 攻防实验", "Agent 自动编码系统"],
    },
    {
        "name": "Ollama",
        "description": "一行命令本地运行开源大模型——ollama run qwen2.5 就能在不联网的机器上和 AI 对话。适合本地开发和隐私敏感场景的 Agent 实验基础设施。",
        "category": "开发工具",
        "url": "https://ollama.com",
        "difficulty": "beginner",
        "pip_install": "需安装 Ollama Desktop，然后 pip install ollama",
        "best_for": "本地运行开源 LLM、离线推理、隐私敏感 Agent 开发",
        "related_experiments": ["Hello World Agent", "翻译 Agent"],
    },
    # ── MCP 生态 ──────────────────────────────────
    {
        "name": "MCP SDK",
        "description": "Anthropic 开源的 Model Context Protocol 官方 SDK，提供 Python/TypeScript 双语言支持。通过 stdio/SSE 传输层实现 LLM 与外部工具的标准化连接。实验「MCP 工具 Agent」用它搭建自定义 MCP Server。",
        "category": "MCP生态",
        "url": "https://github.com/modelcontextprotocol",
        "difficulty": "intermediate",
        "pip_install": "pip install mcp",
        "best_for": "构建 MCP Server/Client、标准化工具接入、Agent 工具生态",
        "related_experiments": ["MCP 工具 Agent"],
    },
    {
        "name": "mcp-server-python",
        "description": "MCP Python Server 快速启动模板，提供 FastMCP 装饰器风格的 API，用 @server.tool() 一行注解即可将 Python 函数暴露为 MCP 工具。大幅降低 MCP Server 开发门槛。",
        "category": "MCP生态",
        "url": "https://github.com/modelcontextprotocol/python-sdk",
        "difficulty": "intermediate",
        "pip_install": "pip install mcp",
        "best_for": "快速构建 MCP Server、将现有 Python 函数暴露为 Agent 工具",
        "related_experiments": ["MCP 工具 Agent"],
    },
    # ── 向量数据库 ──────────────────────────────────
    {
        "name": "ChromaDB",
        "description": "开源的轻量级向量数据库，pip install 即可使用，无需额外部署。支持嵌入式模式和客户端-服务器模式。实验「RAG 知识库 Agent」用它存储文档向量。",
        "category": "向量数据库",
        "url": "https://www.trychroma.com",
        "difficulty": "beginner",
        "pip_install": "pip install chromadb",
        "best_for": "本地开发、原型验证、中小规模向量检索",
        "related_experiments": ["RAG 知识库 Agent", "记忆持久化 Agent"],
    },
    {
        "name": "Pinecone",
        "description": "全托管生产级向量数据库，支持毫秒级十亿级向量检索、元数据过滤和命名空间隔离。适合从原型到生产的无缝迁移。",
        "category": "向量数据库",
        "url": "https://www.pinecone.io",
        "difficulty": "intermediate",
        "pip_install": "pip install pinecone-client",
        "best_for": "生产级 RAG、大规模语义搜索、多租户向量隔离",
        "related_experiments": ["RAG 知识库 Agent"],
    },
    # ── 可观测性 ──────────────────────────────────
    {
        "name": "LangSmith",
        "description": "LangChain 官方的 LLM 应用可观测性平台，提供全链路 Trace、Prompt 版本管理、数据集标注与评测。Agent 生产化的标配监控工具。",
        "category": "可观测性",
        "url": "https://www.langchain.com/langsmith",
        "difficulty": "intermediate",
        "pip_install": "pip install langsmith",
        "best_for": "LLM 应用全链路追踪、Prompt 版本管理与 A/B 测试、Agent 评测",
        "related_experiments": ["企业级 Agent 平台", "Agent 自动编码系统"],
    },
    {
        "name": "LangFuse",
        "description": "开源 LLM 工程平台，提供 Tracing、Prompt 管理、评测和成本监控。支持自部署，数据不出域，适合企业合规场景。",
        "category": "可观测性",
        "url": "https://langfuse.com",
        "difficulty": "intermediate",
        "pip_install": "pip install langfuse",
        "best_for": "私有化部署的可观测性、成本追踪、Prompt 管理",
        "related_experiments": ["企业级 Agent 平台", "长期自主 Agent 生存实验"],
    },
    {
        "name": "Weave",
        "description": "Weights & Biases 推出的 LLM 应用追踪工具，自动记录模型调用、工具执行、检索结果和成本。与 W&B 实验管理生态深度集成。",
        "category": "可观测性",
        "url": "https://weave-docs.wandb.ai",
        "difficulty": "intermediate",
        "pip_install": "pip install weave",
        "best_for": "实验追踪与 Agent 评估结合、深度学习 + LLM 混合项目",
        "related_experiments": ["Agent 对齐实验", "自我进化 Agent"],
    },
]


async def seed_experiments(db, module_key: str, experiments: dict):
    """Seed experiments into DB."""
    count = 0
    for level, exps in experiments.items():
        for exp in exps:
            name = exp.get("name", f"exp_{count}")
            db.add(
                LearningContentItem(
                    module_key=module_key,
                    section_key="experiments",
                    item_key=name,
                    title=name,
                    summary=exp.get("goal", "")[:200],
                    content=json.dumps(exp, ensure_ascii=False),
                    difficulty=exp.get("difficulty", level),
                    sort_order=count,
                    source_type="seed",
                    enabled=True,
                )
            )
            count += 1
    await db.commit()
    print(f"  Agents experiments: {count} items")


async def seed_tools(db, module_key: str, tools: list):
    """Seed tools into DB."""
    for i, tool in enumerate(tools):
        name = tool.get("name", f"tool_{i}")
        db.add(
            LearningContentItem(
                module_key=module_key,
                section_key="tools",
                item_key=name,
                title=name,
                summary=tool.get("description", "")[:200],
                content=json.dumps(tool, ensure_ascii=False),
                sort_order=i,
                source_type="seed",
                enabled=True,
            )
        )
    await db.commit()
    print(f"  Agents tools: {len(tools)} items")


async def main():
    async with AsyncSessionLocal() as db:
        print("=== Seeding Agents content ===")
        await seed_experiments(db, "agents", AGENTS_EXPERIMENTS)
        await seed_tools(db, "agents", AGENTS_TOOLS)
    print("Done!")
