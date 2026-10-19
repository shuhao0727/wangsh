import type { ToolItem } from "./types";

/** 生成式 AI 工具数据 */
export const GENAI_TOOL_CATEGORIES = [
  {
    name: "文本生成与对话",
    icon: "💬",
    tools: [
      { name: "ChatGPT", desc: "OpenAI 旗舰对话模型，GPT-4o 全模态理解，o3/o4 深度推理，支持插件与 GPTs", pricing: "免费 / Plus $20/月 / Pro $200/月", best_for: "通用对话、写作、编程、研究分析" },
      { name: "Claude", desc: "Anthropic 安全优先对话助手，Claude 4 支持 200K 上下文与 Computer Use，擅长代码与长文档", pricing: "免费 / Pro $20/月 / Max $100/月 / $200/月", best_for: "长文分析、技术写作、代码生成、安全教育" },
      { name: "Gemini", desc: "Google DeepMind 多模态大模型，深度整合 Google 生态与搜索增强，1M+ 上下文", pricing: "免费 / Advanced $19.99/月", best_for: "搜索增强、多模态理解、Google 办公生态" },
      { name: "DeepSeek", desc: "深度求索开源推理大模型，R1 系列强化学习推理能力突出，V3 MoE 架构高效", pricing: "免费 (网页/App) / API 按量计费 (性价比领先)", best_for: "推理任务、数学、编程、中文深度场景" },
      { name: "Grok", desc: "xAI 开发的对话模型，实时接入 X (Twitter) 数据流，风格幽默直接", pricing: "X Premium+ $40/月 含 SuperGrok", best_for: "实时信息分析、社交媒体洞察、技术问答" },
      { name: "Mistral", desc: "法国 Mistral AI 高效模型系列，Le Chat 对话平台，开源社区活跃", pricing: "免费 / 企业按量计费", best_for: "欧洲合规需求、多语言 (特别是法语)、企业私有部署" },
      { name: "Qwen (通义千问)", desc: "阿里云通义大模型系列，Qwen2.5-Max 旗舰，中文综合能力领先，开源生态完善", pricing: "免费 / 企业按量计费", best_for: "中文创作、阿里云集成、企业级应用" },
      { name: "文心一言 (ERNIE)", desc: "百度知识增强大语言模型，深度整合百度搜索与知识图谱", pricing: "免费 / 专业版按量计费", best_for: "中文知识问答、百度生态、企业搜索" },
    ],
  },
  {
    name: "图像生成",
    icon: "🎨",
    tools: [
      { name: "DALL·E 3", desc: "OpenAI 文本到图像生成，通过 ChatGPT 界面使用，高精度 Prompt 遵循", pricing: "含 ChatGPT Plus", best_for: "创意设计、概念可视化、营销素材" },
      { name: "Midjourney", desc: "顶级艺术品质图像生成，风格化突出，Discord 社区驱动迭代", pricing: "$10-$120/月", best_for: "艺术创作、概念设计、游戏/影视美术" },
      { name: "Stable Diffusion", desc: "Stability AI 开源图像生成，支持本地部署、LoRA 微调和 ControlNet 精准控制", pricing: "开源免费 / 云端 API 按量计费", best_for: "自定义模型训练、商业合规部署、研究工作" },
      { name: "Flux", desc: "Black Forest Labs (前 Stability AI 团队) 高质量图像生成，文字渲染与构图领先", pricing: "开源免费 (Flux.1) / API 按量计费 / Pro $29/月", best_for: "高质量商业图像、文字排版设计" },
      { name: "Ideogram", desc: "AI 图像生成，文字渲染 (Typography) 能力业界领先", pricing: "免费 / Plus $20/月", best_for: "Logo 设计、海报、需要精确文字渲染的素材" },
      { name: "Recraft", desc: "矢量图形与品牌素材 AI 生成，支持 SVG 导出和品牌风格统一", pricing: "免费 / Pro $20/月", best_for: "品牌设计、矢量图形、UI 素材" },
    ],
  },
  {
    name: "视频生成",
    icon: "🎬",
    tools: [
      { name: "Sora", desc: "OpenAI 视频生成模型，理解物理世界，可生成长达 60s 高清视频", pricing: "含 ChatGPT Plus/Pro ($200/月 无限)", best_for: "创意短片、概念视频、广告提案" },
      { name: "Veo 3", desc: "Google DeepMind 视频生成模型，物理模拟精度高，支持图生视频与编辑", pricing: "Vertex AI 按量计费", best_for: "专业视频制作、影视前期可视化" },
      { name: "Runway Gen-4", desc: "专业级 AI 视频生成与编辑平台，支持实时编辑和多模态控制", pricing: "$15-$95/月", best_for: "视频后期、特效合成、创意工作室" },
      { name: "Kling (可灵)", desc: "快手可灵 AI 视频生成，中文场景和人像表现突出", pricing: "免费 / 订阅制", best_for: "短视频创作、中文内容营销、社交媒体" },
      { name: "Pika", desc: "轻量级 AI 视频生成，界面友好，支持实时编辑和风格化", pricing: "免费 / Pro $10/月", best_for: "社交媒体短视频、快速创意迭代" },
    ],
  },
  {
    name: "AI 编程助手",
    icon: "💻",
    tools: [
      { name: "GitHub Copilot", desc: "GitHub + OpenAI 联合打造，IDE 深度代码补全与 Agent 模式，支持 VS Code/JetBrains", pricing: "免费 (基础) / Pro $10/月 / 企业 $39/月", best_for: "日常编码补全、测试生成、代码审查" },
      { name: "Cursor", desc: "AI-first 代码编辑器 (VS Code 分支)，深度集成对话式编程与上下文感知", pricing: "免费 / Pro $20/月 / Ultra $40/月", best_for: "全栈开发、大型代码库重构、快速原型" },
      { name: "Claude Code", desc: "Anthropic 官方终端 Agent 编码工具，原生支持自主编码/测试/调试循环", pricing: "按 API Token 计费 (Max 计划含额度)", best_for: "终端原生开发、复杂项目重构、自主 Debug" },
      { name: "Windsurf", desc: "Codeium 推出的 AI 原生 IDE，流式 (Cascade) 协作编程体验", pricing: "免费 / Pro $15/月", best_for: "AI 驱动的完整开发流程、团队协作" },
      { name: "Cline / Roo Code", desc: "VS Code 开源编码 Agent，MCP 工具调用、文件操作、浏览器自动化", pricing: "开源免费 (自带 API Key)", best_for: "自主编码任务、MCP 生态、开源可定制" },
    ],
  },
  {
    name: "音乐与音频生成",
    icon: "🎵",
    tools: [
      { name: "Suno", desc: "AI 音乐生成领导者，V4 版本音质媲美专业录音，支持中英文歌词与 200+ 风格", pricing: "免费 / Pro $10/月 / Premier $30/月", best_for: "歌曲创作、背景音乐、实验音乐" },
      { name: "Udio", desc: "高质量 AI 音乐生成，人声自然度领先，支持精细编辑", pricing: "免费 / 订阅制", best_for: "专业音乐制作、高保真人声配乐" },
      { name: "ElevenLabs", desc: "顶级 AI 语音合成与克隆，支持 32 种语言，情感丰富自然", pricing: "免费 / Starter $5/月 / Pro $22/月", best_for: "有声书、配音、多语言语音、虚拟角色" },
      { name: "NotebookLM", desc: "Google AI 笔记助手，一键生成双人播客式音频讨论 (Audio Overview)", pricing: "免费", best_for: "文档转播客、学习资料音频化、研究报告讨论" },
      { name: "AIVA", desc: "AI 古典与影视配乐生成，支持 DAW 工作流集成", pricing: "免费 / Pro €15/月", best_for: "影视配乐、游戏音乐、古典风格作曲" },
    ],
  },
  {
    name: "AI Agent 与工作流平台",
    icon: "🤖",
    tools: [
      { name: "Dify", desc: "开源 LLMOps 平台，可视化构建 RAG + Agent 应用，支持多模型切换", pricing: "开源免费 (自部署) / 云版免费+付费", best_for: "低代码构建 RAG 应用、Agent 工作流" },
      { name: "Coze (扣子)", desc: "字节跳动 AI Bot 开发平台，支持插件/知识库/工作流/多 Agent 编排", pricing: "免费 / 企业版", best_for: "快速搭建 ChatBot、多 Agent 编排、社交分发" },
      { name: "n8n + AI", desc: "开源自动化工作流引擎，集成 400+ 节点 + AI Agent 节点", pricing: "开源免费 (自部署) / 云版 €20/月起", best_for: "AI 驱动的业务自动化、API 编排" },
      { name: "LangGraph", desc: "LangChain 推出的有状态 Agent 框架，支持复杂多步 Agent 图流", pricing: "开源免费 / LangSmith 监控 $39/月起", best_for: "复杂 Agent 系统开发、多步推理与循环" },
      { name: "Relevance AI", desc: "无代码 AI Agent 团队构建平台，内置 150+ 工具集成", pricing: "免费 / Pro $29/月", best_for: "创建 AI 工作团队自动化、销售/营销 Agent" },
    ],
  },
  {
    name: "模型服务与部署平台",
    icon: "☁️",
    tools: [
      { name: "OpenAI API", desc: "GPT-4o/o3/o4 等模型 API，全球最大模型服务平台", pricing: "按 Token 计费 ($0.15-$60/M tokens)", best_for: "通用 API 接入、高并发生产级应用" },
      { name: "Anthropic API", desc: "Claude 4/3.5 系列 API，原生支持 Tool Use、Citations、Prompt Caching", pricing: "按 Token 计费 ($0.80-$15/M tokens)", best_for: "长文档、代码、安全敏感、Agent 应用" },
      { name: "Google AI Studio / Vertex AI", desc: "Gemini 系列 API，免费额度慷慨，Vertex AI 企业级部署", pricing: "免费 (AI Studio) / 企业按量计费", best_for: "原型验证、Google Cloud 集成、多模态" },
      { name: "Replicate", desc: "开源模型云端托管与推理平台，一键部署数千模型", pricing: "按 GPU 时间计费 ($0.0001-$1+/s)", best_for: "快速试用以开源模型、微调模型部署" },
      { name: "Together AI / Fireworks / Groq", desc: "高速推理平台，专注开源模型优化部署，低延迟", pricing: "按 Token 计费 (低于主流平台)", best_for: "低延迟推理、开源模型生产部署" },
      { name: "Ollama", desc: "本地运行开源大模型的极简工具，一键下载运行 LLaMA/Qwen/DeepSeek 等", pricing: "开源免费", best_for: "本地开发、隐私敏感场景、离线推理" },
    ],
  },
];

export const TOOLS_DATA: ToolItem[] = [
  // ── LLM 平台 ──────────────────────────────────
  { name: "DeepSeek API", description: "国产开源大模型 DeepSeek-V3/R1 的 API，兼容 OpenAI 接口格式，性价比极高。实验代码默认使用的后端。", category: "llm-platforms", url: "https://platform.deepseek.com", difficulty: "beginner", pip_install: "pip install openai（使用 base_url 指向 DeepSeek）", best_for: "高性价比 LLM 调用、数学与代码推理、中文场景", related_experiments: ["Prompt 对决", "情感分析", "AI 面试官", "AI 安全实验"] },
  { name: "Anthropic Claude API", description: "Claude Opus 4 / Sonnet 4 系列模型，以深度推理、长上下文和安全性著称。支持 200K token 上下文和计算机操控。", category: "llm-platforms", url: "https://docs.anthropic.com", difficulty: "beginner", pip_install: "pip install anthropic", best_for: "长文档分析、复杂推理、代码生成与审查", related_experiments: ["情感分析", "AI 面试官", "RAG 知识库问答"] },
  { name: "Google Gemini API", description: "Gemini 2.5 Pro/Flash 系列，原生多模态（文本+图片+音频+视频），与 Google 生态深度集成。", category: "llm-platforms", url: "https://ai.google.dev", difficulty: "beginner", pip_install: "pip install google-generativeai", best_for: "多模态理解、长视频分析、Google 生态集成", related_experiments: ["AI 视觉探索"] },
  { name: "通义千问 API", description: "阿里云百炼平台的通义千问系列 API，qwen-plus/qwen-max/qwen-vl-plus 覆盖文本和视觉，中文理解和生成能力领先。", category: "llm-platforms", url: "https://bailian.console.aliyun.com", difficulty: "beginner", pip_install: "pip install dashscope", best_for: "中文场景、多模态理解、阿里云生态集成", related_experiments: ["AI 视觉探索", "AI 翻译"] },
  { name: "Ollama", description: "一行命令本地跑大模型——ollama run qwen2.5 就能在自己电脑上和 AI 对话，无需联网，数据完全本地化。", category: "llm-platforms", url: "https://ollama.com", difficulty: "beginner", pip_install: "需安装 Ollama Desktop, pip install ollama", best_for: "本地 LLM 部署、隐私敏感场景、离线使用", related_experiments: [] },
  // ── 开发框架 ──────────────────────────────────
  { name: "LangChain", description: "LLM 应用开发框架，把模型、数据库、搜索串成一条可编排的链。实验「RAG 知识库问答」的核心框架。", category: "dev-frameworks", url: "https://langchain.com", difficulty: "intermediate", pip_install: "pip install langchain langchain-community", best_for: "RAG 系统、Agent 编排、工具调用链", related_experiments: ["RAG 知识库问答"] },
  { name: "LlamaIndex", description: "数据到 LLM 的连接框架，专注 RAG 场景的索引构建和检索优化，内置多种数据加载器和检索策略。", category: "dev-frameworks", url: "https://www.llamaindex.ai", difficulty: "intermediate", pip_install: "pip install llama-index", best_for: "文档问答、企业知识库、RAG Pipeline", related_experiments: ["RAG 知识库问答"] },
  { name: "Vercel AI SDK", description: "前端友好的 AI 开发工具包，统一 OpenAI/Anthropic/Google 等多平台接口，支持流式输出和 React Hooks。", category: "dev-frameworks", url: "https://sdk.vercel.ai", difficulty: "intermediate", pip_install: "npm install ai", best_for: "前端 AI 应用、聊天界面、流式响应", related_experiments: [] },
  // ── 向量数据库 ─────────────────────────────────
  { name: "ChromaDB", description: "开源的轻量级向量数据库，几行代码即可搭建语义搜索。RAG 系统的「记忆」层。", category: "vector-dbs", url: "https://www.trychroma.com", difficulty: "intermediate", pip_install: "pip install chromadb", best_for: "向量存储与检索、语义搜索、原型开发", related_experiments: ["RAG 知识库问答"] },
  { name: "Pinecone", description: "全托管的向量数据库服务，无需运维，内置相似度搜索和高可用机制，适合生产环境。", category: "vector-dbs", url: "https://pinecone.io", difficulty: "advanced", pip_install: "pip install pinecone-client", best_for: "生产级向量搜索、大规模 RAG 系统", related_experiments: ["RAG 知识库问答"] },
  { name: "Milvus", description: "开源的高性能向量数据库，支持万亿级向量检索，提供 GPU 加速索引和混合搜索能力。", category: "vector-dbs", url: "https://milvus.io", difficulty: "expert", pip_install: "pip install pymilvus", best_for: "大规模向量检索、多模态搜索、企业级部署", related_experiments: [] },
  // ── 图像生成 ──────────────────────────────────
  { name: "通义万相", description: "阿里云 AI 图像生成模型，支持文本到图像、图像编辑和风格迁移。wanx2.0-t2i-turbo 速度与质量均衡。CogView (智谱) 为替代方案。", category: "image-gen", url: "https://bailian.console.aliyun.com", difficulty: "beginner", pip_install: "pip install dashscope", best_for: "中文创意设计、概念可视化、教育插图", related_experiments: ["AI 画画实验"] },
  { name: "DALL-E 3", description: "OpenAI 的文本到图像生成模型，理解复杂 Prompt，自动改写优化，生成高质量创意图片。", category: "image-gen", url: "https://openai.com/dall-e-3", difficulty: "beginner", pip_install: "pip install openai", best_for: "创意设计、概念可视化、教育插图", related_experiments: ["AI 画画实验"] },
  { name: "Stable Diffusion", description: "开源扩散模型，可本地部署，社区模型生态丰富（CivitAI 上万种风格模型），高度可控。", category: "image-gen", url: "https://stability.ai", difficulty: "intermediate", pip_install: "pip install diffusers", best_for: "本地图像生成、风格迁移、可控生成", related_experiments: ["AI 画画实验"] },
  { name: "Midjourney", description: "Discord 平台上的高质量 AI 绘画工具，艺术风格出众，v7 版本在材质感和光影上尤为突出。", category: "image-gen", url: "https://midjourney.com", difficulty: "beginner", best_for: "艺术创作、概念设计、高品质图像生成", related_experiments: ["AI 画画实验"] },
  // ── Agent 框架 ─────────────────────────────────
  { name: "CrewAI", description: "多 Agent 协作框架，为每个 Agent 定义角色、目标和工具，Agent 之间自动协商和传递任务。", category: "agent-frameworks", url: "https://crewai.com", difficulty: "intermediate", pip_install: "pip install crewai", best_for: "多 Agent 系统、角色扮演协作、复杂任务分解", related_experiments: [] },
  { name: "AutoGen", description: "微软开源的多 Agent 对话框架，支持代码生成与执行、人机交互回路和灵活的对话模式。", category: "agent-frameworks", url: "https://microsoft.github.io/autogen", difficulty: "intermediate", pip_install: "pip install pyautogen", best_for: "代码辅助 Agent、多 Agent 对话、人机协作", related_experiments: [] },
  { name: "Dify", description: "开源 LLM 应用开发平台，可视化编排 AI 工作流，内置 RAG 引擎、Agent 和对话管理。", category: "agent-frameworks", url: "https://dify.ai", difficulty: "beginner", pip_install: "Docker 部署，或 pip install dify", best_for: "可视化 AI 应用构建、低代码 Agent 编排", related_experiments: ["RAG 知识库问答"] },
  // ── 评估与监控 ───────────────────────────────
  { name: "LangSmith", description: "LangChain 官方的 LLM 应用追踪和评估平台，记录每次调用的输入输出、延迟和 Token，可对比不同 Prompt/Moel。", category: "evaluation", url: "https://smith.langchain.com", difficulty: "intermediate", pip_install: "pip install langsmith", best_for: "LLM 应用调试、Prompt 版本对比、性能监控", related_experiments: ["Prompt 对决"] },
  { name: "Weights & Biases", description: "ML 实验追踪平台，支持 LLM 微调监控、Prompt 评估和模型对比 Dashboard。", category: "evaluation", url: "https://wandb.ai", difficulty: "intermediate", pip_install: "pip install wandb", best_for: "模型训练监控、实验对比、LLM 评测", related_experiments: ["情感分析"] },
  // ── 云平台 ────────────────────────────────────
  { name: "Hugging Face", description: "AI 界的 GitHub——数万个预训练模型和数据集可一键使用，Spaces 免费部署 Demo。", category: "cloud-platforms", url: "https://huggingface.co", difficulty: "intermediate", pip_install: "pip install transformers", best_for: "模型下载分享、Demo 部署、社区协作", related_experiments: ["情感分析", "AI 视觉探索"] },
  { name: "Replicate", description: "云端模型运行平台，一行代码调用数千个社区模型，按使用量计费，无需管理 GPU。", category: "cloud-platforms", url: "https://replicate.com", difficulty: "intermediate", pip_install: "pip install replicate", best_for: "快速体验开源模型、原型验证、API 调用", related_experiments: ["AI 画画实验"] },
  { name: "Modal", description: "按秒计费的 GPU 云——需要跑实验但没有显卡？花几毛钱租一张 A100 用一小时。Python 函数直接部署到云。", category: "cloud-platforms", url: "https://modal.com", difficulty: "advanced", pip_install: "pip install modal", best_for: "按需 GPU 训练、成本敏感项目、无服务器部署", related_experiments: [] },
];
