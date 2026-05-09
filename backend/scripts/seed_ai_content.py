"""Seed AI learning content (experiments & tools) into database.

Run: python backend/scripts/seed_ai_content.py
"""

import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import AsyncSessionLocal
from app.models.learning.content import LearningContentItem


# ─── AI Experiments ───────────────────────────────────────────────────────

AI_EXPERIMENTS = {
    "beginner": [
        {
            "name": "你的第一个 LLM API 调用",
            "difficulty": "beginner",
            "goal": "学会使用 DeepSeek/通义千问 API 进行基本的文本生成，理解 System Prompt 与 User Message 的区别",
            "estimated_time": "30 分钟",
            "tools": ["DeepSeek API", "Python"],
            "steps": [
                "注册 DeepSeek 或阿里云百炼账号并获取 API Key",
                "用 pip install openai 安装 SDK（DeepSeek 兼容 OpenAI 接口格式）",
                "编写第一个 API 调用：设置 System Prompt 定义 AI 角色，发送 User Message 获取回复",
                "实验 temperature 参数：对比 temperature=0.1 和 temperature=0.9 的输出差异",
                "实验 max_tokens 参数：理解 Token 计数和输出截断",
            ],
            "desc": "用 20 行 Python 完成第一次 LLM API 调用",
            "tech": "DeepSeek / 通义千问 API",
        },
        {
            "name": "Prompt 角色扮演实验",
            "difficulty": "beginner",
            "goal": "理解 System Prompt 如何控制 AI 的行为、语气和专业领域，掌握角色设定的核心技巧",
            "estimated_time": "45 分钟",
            "tools": ["DeepSeek API", "Python"],
            "steps": [
                "设计 3 种不同角色的 System Prompt（科学家/诗人/程序员）",
                "用相同的问题向 3 种角色提问，对比回复风格差异",
                "实验边界设定：在 System Prompt 中加入「不确定时说不知道」的约束",
                "实验语气控制：「请用小学生能听懂的语言解释」",
            ],
            "desc": "System Prompt 角色设定与风格控制实验",
            "tech": "Prompt Engineering",
        },
        {
            "name": "AI 图片理解入门",
            "difficulty": "beginner",
            "goal": "使用多模态 API（通义千问 VL / DeepSeek-VL）让 AI 理解图片内容，体验多模态交互",
            "estimated_time": "30 分钟",
            "tools": ["通义千问 API (qwen-vl-plus)", "Python"],
            "steps": [
                "准备 2-3 张不同类型的图片（风景/图表/文字截图）",
                "将图片编码为 base64 格式",
                "发送图片 + 文字提问，让 AI 描述、分析或回答问题",
                "实验：同一张图问不同问题（描述/分析数据/识别文字）",
            ],
            "desc": "用多模态 API 让 AI 看懂图片",
            "tech": "通义千问 VL / DeepSeek-VL",
        },
        {
            "name": "Few-shot 提示学习",
            "difficulty": "beginner",
            "goal": "理解 Few-shot Prompting 的工作原理，掌握用示例引导 AI 输出格式和风格的方法",
            "estimated_time": "45 分钟",
            "tools": ["DeepSeek API", "Python"],
            "steps": [
                "设计一个分类任务（如情感分析），准备 5 个标注示例",
                "对比零样本（不给示例）和少样本（给 3-5 个示例）的准确率差异",
                "实验示例顺序的影响：相同示例不同排列是否改变输出",
                "实验示例数量的影响：1/3/5/10 个示例的效果曲线",
            ],
            "desc": "用示例引导 AI 掌握输出格式和风格",
            "tech": "Few-shot Prompting",
        },
        {
            "name": "AI 联网搜索实战",
            "difficulty": "beginner",
            "goal": "集成搜索引擎（Tavily/Brave Search），使 AI 能获取实时信息并给出有据可查的回答",
            "estimated_time": "1 小时",
            "tools": ["Tavily Search API", "DeepSeek API", "Python"],
            "steps": [
                "注册 Tavily 或 Brave Search API Key",
                "实现搜索函数：输入查询词，返回前 5 条搜索结果（标题+摘要+URL）",
                "将搜索结果注入 Prompt：构建「用户问题 + 搜索结果 + 要求引用来源」的 Prompt",
                "测试时效性问题（今日天气、最新新闻）vs 知识性问题（历史事件）",
                "添加引用溯源：要求 AI 在每个事实后标注来源 URL",
            ],
            "desc": "搜索引擎 + LLM 实现带引用的实时问答",
            "tech": "Tavily Search + LLM",
        },
    ],
    "intermediate": [
        {
            "name": "RAG 文档问答系统",
            "difficulty": "intermediate",
            "goal": "构建完整的检索增强生成（RAG）流水线：PDF 加载 → 分块 → 向量嵌入 → 语义检索 → 增强回答",
            "estimated_time": "2-3 小时",
            "tools": ["LangChain", "ChromaDB", "DeepSeek API", "PyPDF"],
            "steps": [
                "加载 PDF/Markdown 文档，用 PyPDF/Unstructured 解析文本",
                "实现 RecursiveCharacterTextSplitter 语义分块（chunk_size=500, overlap=50）",
                "用 BGE (bge-large-zh-v1.5) 生成向量并存入 ChromaDB",
                "实现检索流水线：用户提问 → 向量检索 Top-5 → 拼接上下文 → LLM 生成",
                "用 Ragas 评估检索命中率和答案准确性",
            ],
            "desc": "上传文档 → 向量化 → 语义检索 → 智能问答",
            "tech": "LangChain + ChromaDB + RAG",
        },
        {
            "name": "结构化输出生成",
            "difficulty": "intermediate",
            "goal": "掌握 JSON Mode 和 Pydantic 约束输出，让 AI 生成可被程序可靠解析的结构化数据",
            "estimated_time": "1.5 小时",
            "tools": ["DeepSeek API (JSON Mode)", "Instructor", "Pydantic"],
            "steps": [
                "用 Pydantic 定义输出数据模型（如 MovieReview: title, rating, summary, pros, cons）",
                "使用 Instructor 库让 LLM 严格遵守 Schema 生成结构化输出",
                "对比原生 JSON Mode 和 Instructor 的可靠性差异",
                "实现自动重试：输出校验失败时自动重新生成",
                "实验复杂嵌套结构（列表嵌套对象/可选字段/枚举类型）",
            ],
            "desc": "Pydantic + Instructor 实现类型安全的结构化输出",
            "tech": "Instructor + Pydantic + JSON Mode",
        },
        {
            "name": "AI 图像生成实验",
            "difficulty": "intermediate",
            "goal": "使用通义万相 / Stable Diffusion API 生成图像，理解 Prompt 对图像质量的影响",
            "estimated_time": "2 小时",
            "tools": ["通义万相 API", "Stable Diffusion (Replicate)", "Python"],
            "steps": [
                "用通义万相生成图像：从简单描述到精细 Prompt 的对比实验",
                "学习 Prompt 工程六要素：主体/风格/构图/光线/色彩/细节",
                "使用 Stable Diffusion 的 negative_prompt 排除不需要的元素",
                "实验风格迁移：同一主体不同艺术风格（油画/水彩/像素/赛博朋克）",
                "对比通义万相和 Stable Diffusion 在同 Prompt 下的风格差异",
            ],
            "desc": "文本到图像：Prompt 如何影响 AI 绘画效果",
            "tech": "通义万相 + Stable Diffusion",
        },
        {
            "name": "AI 翻译与摘要流水线",
            "difficulty": "intermediate",
            "goal": "构建多步骤 AI 处理流水线：长文分段 → 逐段翻译/摘要 → 结果合并 → 质量检查",
            "estimated_time": "2 小时",
            "tools": ["DeepSeek API", "Python", "tiktoken"],
            "steps": [
                "用 tiktoken 计算 Token 数，实现长文自动分段（不超过模型上下文限制）",
                "实现并行处理：多段同时调用 API 翻译/摘要",
                "分段结果合并与衔接优化（处理分段边界的不连贯问题）",
                "实现后处理质量检查：用另一个 LLM 调用审查翻译/摘要质量",
            ],
            "desc": "长文分段 + 并行 AI 处理 + 质量审查",
            "tech": "DeepSeek API + tiktoken",
        },
        {
            "name": "Chain-of-Thought 推理实验",
            "difficulty": "intermediate",
            "goal": "对比 Zero-shot CoT 和 Few-shot CoT 在数学推理、逻辑推理任务上的效果差异",
            "estimated_time": "1.5 小时",
            "tools": ["DeepSeek API", "Python"],
            "steps": [
                "准备 10 道不同难度的数学/逻辑推理题（含标准答案）",
                "对比 3 种策略的准确率：直接回答 vs Zero-shot CoT（加「让我们逐步思考」） vs Few-shot CoT（提供 3 个带推理过程的示例）",
                "分析错误案例：CoT 失败的原因（推理步骤错误/计算错误/理解错误）",
                "实验 Self-Consistency：对同一问题跑 5 次 CoT，取多数答案",
            ],
            "desc": "CoT 逐步推理 vs 直接回答的准确率对比",
            "tech": "Chain-of-Thought + Self-Consistency",
        },
    ],
    "advanced": [
        {
            "name": "LoRA 微调开源模型",
            "difficulty": "advanced",
            "goal": "使用 LoRA 高效微调开源 LLM（如 Qwen2.5），理解参数高效微调的原理和实践",
            "estimated_time": "3-4 小时",
            "tools": ["Hugging Face PEFT", "Transformers", "PyTorch", "Qwen2.5"],
            "steps": [
                "加载 Qwen2.5-1.5B 模型和分词器，打印参数量",
                "配置 LoRA：r=8, lora_alpha=16, target_modules=['q_proj','v_proj']，用 get_peft_model 包装",
                "统计可训练参数占比（预期 < 1%），理解 LoRA 的效率优势",
                "准备 50 条中文指令微调数据，格式化为 instruction-input-output",
                "用 Trainer 训练 3 个 epoch，保存 LoRA adapter",
                "对比微调前后模型在测试问题上的回答质量",
            ],
            "desc": "LoRA 高效微调：仅 0.5% 参数实现指令跟随",
            "tech": "PEFT + LoRA + Qwen2.5",
        },
        {
            "name": "AI 安全攻防实验",
            "difficulty": "advanced",
            "goal": "理解 AI 安全的核心风险：Prompt 注入、越狱、数据泄露，构建基础防护层",
            "estimated_time": "2-3 小时",
            "tools": ["DeepSeek API", "Python"],
            "steps": [
                "构建攻击测试集：直接注入（忽略以上指令）、间接注入（文档中嵌入指令）、角色扮演绕过",
                "实现输入净化层：关键词检测 + PPL 异常检测",
                "实现输出过滤层：PII 脱敏（姓名/电话/邮箱正则替换）",
                "构建权限分级 System Prompt：定义「禁止回答」的敏感话题列表",
                "统计各攻击手法的绕过成功率，分析最薄弱的环节",
            ],
            "desc": "Prompt 注入攻击 vs 多层防御实战",
            "tech": "Prompt Injection Defense",
        },
        {
            "name": "多轮对话记忆管理",
            "difficulty": "advanced",
            "goal": "实现智能的对话记忆管理：自动摘要、关键信息提取、记忆压缩和遗忘策略",
            "estimated_time": "2-3 小时",
            "tools": ["DeepSeek API", "Mem0", "Python"],
            "steps": [
                "集成 Mem0 SDK 实现自动记忆提取：从对话中识别用户偏好和关键事实",
                "实现滑动窗口上下文管理：保留最近 N 轮对话，超出的自动摘要压缩",
                "设计记忆检索：根据当前问题从记忆中检索最相关的历史信息",
                "实现记忆更新：同一事实被多次提及时合并去重",
                "测试跨会话记忆：退出重启后能否回忆上次对话的用户信息",
            ],
            "desc": "Mem0 + 滑动窗口实现智能对话记忆",
            "tech": "Mem0 + Context Window Management",
        },
        {
            "name": "AI Agent 自动编码",
            "difficulty": "advanced",
            "goal": "构建能自动生成、测试和修复代码的 AI Agent：需求 → 编码 → 测试 → 迭代修复",
            "estimated_time": "3-4 小时",
            "tools": ["DeepSeek API", "Python", "Pytest"],
            "steps": [
                "设计编码 Agent 的 System Prompt（含编码规范/测试要求/错误处理指南）",
                "实现需求解析：从自然语言描述中提取函数签名、输入输出规格",
                "实现代码生成 + 自动测试循环：生成代码 → 运行 pytest → 分析失败 → 修复 → 重新测试",
                "添加代码审查 Agent：检查安全性（SQL 注入/XSS）、性能和可读性",
                "设置最大迭代次数和人工确认点（文件操作、网络请求需要确认）",
            ],
            "desc": "需求 → 自动编码 → 测试 → 修复循环",
            "tech": "LLM + Pytest + Agent Loop",
        },
        {
            "name": "多模态内容分析流水线",
            "difficulty": "advanced",
            "goal": "构建文本 + 图像 + 音频的综合分析流水线，实现多模态内容的联合理解",
            "estimated_time": "3-4 小时",
            "tools": ["通义千问 VL (qwen-vl-plus)", "Whisper API", "Python"],
            "steps": [
                "实现图像分析模块：上传截图 → 提取文字（OCR）+ 理解内容 + 生成描述",
                "实现音频分析模块：上传会议录音 → Whisper 转录 → LLM 生成会议纪要",
                "构建统一分析接口：输入可以是文本/图片/音频的任意组合，自动路由到对应处理模块",
                "实现跨模态关联：将图片中的图表数据与文本描述交叉验证",
            ],
            "desc": "文本 + 图像 + 音频统一处理流水线",
            "tech": "通义千问 VL + Whisper + Multi-modal",
        },
    ],
    "expert": [
        {
            "name": "从零构建 RAG 系统（不使用框架）",
            "difficulty": "expert",
            "goal": "不使用 LangChain/LlamaIndex，从零实现完整的 RAG 系统，深入理解每个环节的原理",
            "estimated_time": "4-5 小时",
            "tools": ["DeepSeek API", "NumPy", "Python"],
            "steps": [
                "从零实现文本分块：固定大小分块 + 重叠分块 + 语义分块三种策略",
                "手写向量检索：用 NumPy 实现余弦相似度计算和 Top-K 检索",
                "实现 Hybrid Search：BM25 关键词检索 + 向量语义检索的加权融合",
                "实现 Reranker：用 Cross-Encoder 对初检结果精排",
                "对比自实现 vs LangChain 方案在检索质量上的差异",
            ],
            "desc": "不用 langchain，纯手工实现 RAG 全链路",
            "tech": "NumPy + DeepSeek + 纯 Python",
        },
        {
            "name": "大模型量化部署",
            "difficulty": "expert",
            "goal": "使用 llama.cpp / vLLM 将大模型量化并高效部署，理解 GPTQ/AWQ/GGUF 格式差异",
            "estimated_time": "4-5 小时",
            "tools": ["llama.cpp", "Ollama", "Python"],
            "steps": [
                "下载 Qwen2.5-7B 原始模型，转换为 GGUF 格式",
                "使用 llama.cpp 进行 INT4/INT8 量化，对比不同量化精度的模型大小和推理速度",
                "用 Ollama 创建 Modelfile，一键部署量化模型并暴露 API",
                "对比量化前后模型在 MMLU 基准上的准确率下降",
                "测试不同硬件（CPU/GPU/Apple Silicon）的推理性能",
            ],
            "desc": "llama.cpp 量化 + Ollama 一键部署开源模型",
            "tech": "llama.cpp + GGUF + Ollama",
        },
        {
            "name": "AI 评测基准搭建",
            "difficulty": "expert",
            "goal": "搭建自定义 AI 评测流水线：构建测试集 → 批量评测 → 结果分析 → 报告生成",
            "estimated_time": "4-5 小时",
            "tools": ["DeepSeek API", "Python", "Pandas", "Matplotlib"],
            "steps": [
                "构建 Golden Dataset：收集或生成 50+ 条带标注答案的问答对",
                "设计多维评测指标：准确性 / 完整性 / 简洁性 / 安全性 / 格式合规",
                "实现 LLM-as-Judge：用 DeepSeek 作为评判模型，对被评测模型的输出打分",
                "批量评测多个模型（DeepSeek/通义千问/Gemini），生成对比雷达图",
                "分析评估偏差：LLM-as-Judge 是否对同厂商模型有偏好",
            ],
            "desc": "Golden Dataset + LLM-as-Judge 自动化评测",
            "tech": "LLM Evaluation + LLM-as-Judge",
        },
    ],
}


# ─── AI Tools ──────────────────────────────────────────────────────────────

AI_TOOLS = [
    # ── 文本生成与对话 ──────────────────────
    {
        "name": "国产大模型 API（DeepSeek / 通义千问）",
        "description": "DeepSeek-V3/R1 兼容 OpenAI 接口格式，通义千问 (qwen-max/plus) 中文领先。国产 API 性价比高、网络延迟低。",
        "category": "文本生成与对话",
        "url": "https://platform.deepseek.com",
        "difficulty": "beginner",
        "pip_install": "pip install openai（使用 base_url 指向 DeepSeek）或 pip install dashscope（通义千问）",
        "best_for": "通用文本生成、中文场景、代码生成、Agent 推理",
    },
    {
        "name": "Anthropic API",
        "description": "Claude 系列 API，200K 上下文窗口 + 原生 Tool Use + Prompt Caching。长文档分析与安全敏感场景的首选。",
        "category": "文本生成与对话",
        "url": "https://docs.anthropic.com",
        "difficulty": "beginner",
        "pip_install": "pip install anthropic",
        "best_for": "长文分析、代码生成、安全教育、MCP 生态",
    },
    {
        "name": "Google AI Studio",
        "description": "Gemini 系列 API，免费额度慷慨，原生多模态 + 1M 上下文 + Google 搜索接地。原型验证的最佳入口。",
        "category": "文本生成与对话",
        "url": "https://aistudio.google.com",
        "difficulty": "beginner",
        "pip_install": "pip install google-generativeai",
        "best_for": "多模态实验、免费原型验证、Google 生态集成",
    },
    # ── 图像生成 ────────────────────────────
    {
        "name": "通义万相 / DALL·E 3",
        "description": "阿里云 DashScope 通义万相提供国产 AI 图像生成，wanx2.0 支持中文 Prompt。OpenAI DALL·E 3 也支持高精度 Prompt 遵循。CogView (智谱) 为替代方案。",
        "category": "图像生成",
        "url": "https://bailian.console.aliyun.com",
        "difficulty": "beginner",
        "pip_install": "pip install dashscope",
        "best_for": "创意设计、概念可视化、营销素材",
    },
    {
        "name": "Stable Diffusion",
        "description": "Stability AI 开源图像生成，支持本地部署、LoRA 微调和 ControlNet 精准控制。自定义模型训练的首选。",
        "category": "图像生成",
        "url": "https://stability.ai",
        "difficulty": "intermediate",
        "pip_install": "pip install diffusers transformers accelerate",
        "best_for": "自定义模型训练、商业合规部署、研究工作",
    },
    # ── AI 编程助手 ──────────────────────────
    {
        "name": "Cursor",
        "description": "AI-first 代码编辑器（VS Code 分支），深度集成对话式编程与上下文感知。适合全栈开发和大型代码库重构。",
        "category": "AI 编程助手",
        "url": "https://cursor.com",
        "difficulty": "beginner",
        "pip_install": "无需 pip，直接安装 IDE",
        "best_for": "全栈开发、大型代码库重构、快速原型",
    },
    {
        "name": "GitHub Copilot",
        "description": "GitHub + OpenAI 联合打造，IDE 深度代码补全与 Agent 模式。日常编码效率提升的标配工具。",
        "category": "AI 编程助手",
        "url": "https://github.com/features/copilot",
        "difficulty": "beginner",
        "pip_install": "IDE 插件安装",
        "best_for": "日常编码补全、测试生成、代码审查",
    },
    # ── 模型服务与部署 ──────────────────────
    {
        "name": "Hugging Face",
        "description": "AI 界的 GitHub——数万个预训练模型一键下载，Inference API + Spaces 免费部署 Demo。开源 AI 生态的核心枢纽。",
        "category": "模型服务与部署",
        "url": "https://huggingface.co",
        "difficulty": "intermediate",
        "pip_install": "pip install transformers",
        "best_for": "预训练模型下载、模型分享、Demo 部署、开源 AI 生态",
    },
    {
        "name": "Ollama",
        "description": "一行命令本地运行开源大模型——ollama run qwen2.5 就能在自己电脑上和 AI 对话，不需要联网。本地开发和隐私敏感场景的理想选择。",
        "category": "模型服务与部署",
        "url": "https://ollama.com",
        "difficulty": "beginner",
        "pip_install": "需安装 Ollama Desktop，然后 pip install ollama",
        "best_for": "本地运行开源 LLM、离线推理、隐私敏感开发",
    },
    {
        "name": "Replicate",
        "description": "开源模型云端托管与推理平台，一键部署数千模型。快速试用开源模型的最佳平台。",
        "category": "模型服务与部署",
        "url": "https://replicate.com",
        "difficulty": "intermediate",
        "pip_install": "pip install replicate",
        "best_for": "快速试用以开源模型、微调模型部署",
    },
    # ── AI Agent 平台 ────────────────────────
    {
        "name": "Dify",
        "description": "开源 LLMOps 平台，可视化构建 RAG + Agent 应用，支持多模型切换。非开发者也能快速搭建 AI 应用。",
        "category": "AI Agent 平台",
        "url": "https://dify.ai",
        "difficulty": "beginner",
        "pip_install": "无需安装（Docker 部署）或使用云版",
        "best_for": "低代码构建 RAG 应用、Agent 工作流、企业内部 AI 平台",
    },
    {
        "name": "LangChain",
        "description": "LLM 应用开发的事实标准框架，提供 Chains/Agents/Tools/Memory 完整抽象与 700+ 三方集成。从原型到生产的全流程支持。",
        "category": "AI Agent 平台",
        "url": "https://www.langchain.com",
        "difficulty": "intermediate",
        "pip_install": "pip install langchain langchain-community",
        "best_for": "通用 LLM 应用开发、RAG 系统、Agent 编排",
    },
    # ── Prompt 工程与评测 ────────────────────
    {
        "name": "Instructor",
        "description": "基于 Pydantic 的结构化输出增强库，让 LLM 输出严格遵守 Python 类型定义。编译时校验 + 自动重试，是类型安全 AI 应用的基础设施。",
        "category": "Prompt 工程与评测",
        "url": "https://python.useinstructor.com",
        "difficulty": "intermediate",
        "pip_install": "pip install instructor",
        "best_for": "结构化输出、类型安全、API 响应解析",
    },
    {
        "name": "Tavily Search API",
        "description": "专为 AI Agent 优化的搜索引擎 API，返回结构化搜索结果（标题+摘要+URL+相关性分数）。比传统搜索引擎更适合 LLM 消费。",
        "category": "Prompt 工程与评测",
        "url": "https://tavily.com",
        "difficulty": "beginner",
        "pip_install": "pip install tavily-python",
        "best_for": "AI Agent 联网搜索、实时信息获取、RAG 外部知识源",
    },
    # ── 向量数据库 ──────────────────────────
    {
        "name": "ChromaDB",
        "description": "开源轻量级向量数据库，pip install 即用。支持嵌入式模式和客户端-服务器模式，RAG 入门的最佳选择。",
        "category": "向量数据库",
        "url": "https://www.trychroma.com",
        "difficulty": "beginner",
        "pip_install": "pip install chromadb",
        "best_for": "本地开发、原型验证、中小规模语义搜索",
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
    print(f"  AI experiments: {count} items")


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
    print(f"  AI tools: {len(tools)} items")


async def main():
    async with AsyncSessionLocal() as db:
        print("=== Seeding AI content ===")
        await seed_experiments(db, "ai", AI_EXPERIMENTS)
        await seed_tools(db, "ai", AI_TOOLS)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
