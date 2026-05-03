/** 人工智能探索内置内容。 */

/** 学习路线阶段 */
export const ROADMAP_STAGES = [
  {
    id: "stage-1",
    title: "阶段一：AI 概览与数学基础",
    duration: "2-4 周",
    topics: [
      "人工智能发展简史与核心概念",
      "线性代数：向量、矩阵、特征值",
      "概率论与统计：贝叶斯、分布、假设检验",
      "微积分基础：导数、梯度、链式法则",
    ],
    resources: [
      { name: "3Blue1Brown —— 线性代数本质", type: "视频系列" },
      { name: "StatQuest —— 统计学入门", type: "视频系列" },
      { name: "《人工智能：一种现代方法》", type: "教材" },
    ],
    color: "var(--ws-color-primary)",
  },
  {
    id: "stage-2",
    title: "阶段二：机器学习核心",
    duration: "4-6 周",
    topics: [
      "监督学习：线性回归、逻辑回归、SVM",
      "非监督学习：K-Means、PCA、t-SNE",
      "集成学习：随机森林、XGBoost、LightGBM",
      "模型评估：交叉验证、偏差-方差权衡",
      "特征工程与正则化",
    ],
    resources: [
      { name: "Andrew Ng —— Machine Learning", type: "Coursera 课程" },
      { name: "《机器学习》(周志华)", type: "教材" },
      { name: "Scikit-learn 官方文档", type: "文档" },
    ],
    color: "var(--ws-color-info)",
  },
  {
    id: "stage-3",
    title: "阶段三：深度学习与神经网络",
    duration: "4-6 周",
    topics: [
      "感知机与多层神经网络",
      "反向传播与优化器 (SGD、Adam)",
      "CNN 原理与经典架构 (LeNet、ResNet)",
      "RNN、LSTM、GRU",
      "正则化：Dropout、BatchNorm",
      "框架入门：PyTorch / TensorFlow",
    ],
    resources: [
      { name: "Stanford CS231n —— CNN for Visual Recognition", type: "课程" },
      { name: "《动手学深度学习》(李沐)", type: "教材" },
      { name: "Fast.ai —— Practical Deep Learning", type: "课程" },
    ],
    color: "#8B5CF6",
  },
  {
    id: "stage-4",
    title: "阶段四：NLP 与计算机视觉",
    duration: "6-8 周",
    topics: [
      "NLP：词向量、Transformer、BERT、GPT",
      "CV：目标检测 (YOLO)、图像分割 (UNet)",
      "Seq2Seq 与注意力机制",
      "多模态学习基础",
      "HuggingFace 生态与模型微调",
    ],
    resources: [
      { name: "Stanford CS224n —— NLP with Deep Learning", type: "课程" },
      { name: "HuggingFace NLP Course", type: "教程" },
      { name: "《Attention Is All You Need》", type: "论文" },
    ],
    color: "#06B6D4",
  },
  {
    id: "stage-5",
    title: "阶段五：生成式 AI 与大模型",
    duration: "4-6 周",
    topics: [
      "GPT 系列架构与 RLHF",
      "Diffusion Model 原理",
      "Prompt Engineering 高级技巧",
      "RAG 与 Agent 应用开发",
      "模型量化与部署 (vLLM、Ollama)",
      "多模态大模型 (GPT-4V、Gemini)",
    ],
    resources: [
      { name: "DeepLearning.AI —— ChatGPT Prompt Engineering", type: "课程" },
      { name: "HuggingFace Diffusers 文档", type: "文档" },
      { name: "LangChain / LlamaIndex 教程", type: "框架" },
    ],
    color: "#F59E0B",
  },
  {
    id: "stage-6",
    title: "阶段六：AI 应用与前沿",
    duration: "持续学习",
    topics: [
      "AI Agent 与多智能体系统",
      "AI 安全与对齐研究",
      "Model as a Service (MaaS)",
      "AI 编程与 Copilot 进阶",
      "AI 行业落地案例",
      "前沿论文追踪",
    ],
    resources: [
      { name: "Anthropic Cookbook", type: "教程" },
      { name: "ArXiv / Papers with Code", type: "论文" },
      { name: "OpenAI DevDay 技术分享", type: "演讲" },
    ],
    color: "#10B981",
  },
];

/** AI 发展历程里程碑 */
export const MILESTONES = [
  { year: "1950", event: "图灵测试", desc: "艾伦·图灵提出\"机器能思考吗\"，奠定 AI 测试基准" },
  { year: "1956", event: "达特茅斯会议", desc: "McCarthy 等人首次提出 Artificial Intelligence 术语" },
  { year: "1980s", event: "专家系统", desc: "基于规则的专家系统在医疗、矿产等领域取得商业成功" },
  { year: "1997", event: "深蓝击败卡斯帕罗夫", desc: "IBM 深蓝在国际象棋中击败世界冠军" },
  { year: "2012", event: "深度学习革命", desc: "AlexNet 在 ImageNet 上大幅突破，开启深度学习时代" },
  { year: "2016", event: "AlphaGo 击败李世石", desc: "DeepMind AlphaGo 在围棋中击败世界冠军" },
  { year: "2017", event: "Transformer 诞生", desc: "Google 发布《Attention Is All You Need》" },
  { year: "2018", event: "BERT & GPT", desc: "预训练语言模型 (BERT / GPT) 刷新 NLP 纪录" },
  { year: "2020", event: "GPT-3", desc: "OpenAI 发布 1750 亿参数 GPT-3，展示强大的少样本能力" },
  { year: "2022", event: "ChatGPT 发布", desc: "ChatGPT 面向公众，2 个月用户破亿，AI 走向大众" },
  { year: "2023", event: "GPT-4 多模态", desc: "GPT-4 支持图文理解，Claude、Gemini 竞相发布" },
  { year: "2024", event: "GPT-4o / Sora", desc: "Omni 多模态、视频生成 Sora、Agent 元年" },
  { year: "2025", event: "DeepSeek R1 / AI Agent 生态", desc: "DeepSeek R1 推理模型冲击全球、OpenAI o3、Claude 4、Agent 生态全面爆发" },
  { year: "2026", event: "推理模型普及", desc: "推理模型成为主流范式、AI Agent 规模化落地、多模态 Agent 走向生产环境" },
];

/** AI 分支领域 */
export const AI_DOMAINS = [
  {
    name: "自然语言处理 (NLP)",
    desc: "让计算机理解、生成人类语言",
    sub: ["机器翻译", "情感分析", "问答系统", "文本摘要", "对话系统"],
    color: "#3B82F6",
  },
  {
    name: "计算机视觉 (CV)",
    desc: "让计算机\"看懂\"图像与视频",
    sub: ["图像分类", "目标检测", "图像分割", "人脸识别", "视频理解"],
    color: "#8B5CF6",
  },
  {
    name: "语音识别与合成",
    desc: "处理语音信号，实现人机语音交互",
    sub: ["语音识别 (ASR)", "语音合成 (TTS)", "说话人识别", "语音情感分析"],
    color: "#06B6D4",
  },
  {
    name: "机器人学",
    desc: "赋予机器人感知、规划、控制能力",
    sub: ["SLAM 定位建图", "路径规划", "机械臂控制", "自主导航"],
    color: "#10B981",
  },
  {
    name: "生成式 AI",
    desc: "使用 AI 生成文本、图像、音频、视频等内容",
    sub: ["大语言模型 (LLM)", "图像生成 (Diffusion)", "视频生成", "音乐生成", "代码生成"],
    color: "#F59E0B",
  },
  {
    name: "强化学习 (RL)",
    desc: "Agent 通过与环境交互学习最优策略",
    sub: ["Q-Learning", "Policy Gradient", "PPO", "多智能体 RL"],
    color: "#EF4444",
  },
  {
    name: "AI Agent 与多智能体系统",
    desc: "自主 Agent 感知、推理、行动循环与协作",
    sub: ["ReAct Pattern", "工具调用 (Function Calling)", "多 Agent 协作", "MCP 协议", "Agent 评估框架"],
    color: "#EC4899",
  },
  {
    name: "AI for Science",
    desc: "AI 加速科学发现：蛋白质预测、分子模拟、数学推理",
    sub: ["AlphaFold 蛋白质结构", "AI 药物发现", "AI 数学证明", "气候建模"],
    color: "#14B8A6",
  },
];

/** Prompt 工程体系 */
export const PROMPT_LEVELS = [
  {
    level: "基础",
    icon: "star",
    items: [
      { title: "角色设定", desc: "明确 AI 的角色身份、专业背景、交流风格" },
      { title: "指令清晰", desc: "使用肯定句、分步骤描述、避免歧义" },
      { title: "格式控制", desc: "指定输出格式：JSON、Markdown、表格、列表" },
      { title: "上下文限定", desc: "提供足够背景信息，限定回答范围" },
    ],
    color: "#10B981",
  },
  {
    level: "中级",
    icon: "target",
    items: [
      { title: "Few-shot 示例", desc: "提供 2-3 个输入输出示例引导模型行为" },
      { title: "Chain-of-Thought (CoT)", desc: "引导模型逐步推理，提升复杂问题准确率" },
      { title: "结构化输出", desc: "要求模型按 Schema 输出，便于程序解析" },
      { title: "温度控制", desc: "通过 temperature / top_p 控制输出创造性与确定性" },
    ],
    color: "#F59E0B",
  },
  {
    level: "高级",
    icon: "lightbulb",
    items: [
      { title: "ReAct 模式", desc: "推理 + 行动循环：思考 → 工具调用 → 观察 → 继续" },
      { title: "Tree-of-Thought (ToT)", desc: "分支探索多个推理路径，选择最优解" },
      { title: "MCP 提示资源", desc: "通过 Model Context Protocol 复用和组合标准化提示模板" },
      { title: "Contextual Retrieval", desc: "结合 RAG 与动态上下文注入，提升长尾知识召回" },
      { title: "自动优化 (AutoPrompt)", desc: "使用 AI 自动迭代优化 Prompt 模板" },
      { title: "Meta-Prompting", desc: "让 AI 自己设计 Prompt 策略和任务分解方案" },
    ],
    color: "#8B5CF6",
  },
];

/** Prompt 模板示例 */
export const PROMPT_TEMPLATES = [
  { title: "角色写作", template: "你是一位资深{领域}专家，请用{风格}风格写一篇关于{主题}的文章，字数约{字数}字。" },
  { title: "代码审查", template: "Review 以下 {语言} 代码，列出：1) 安全漏洞 2) 性能问题 3) 可读性改进。\n```\n{代码}\n```" },
  { title: "学习助手", template: "我想学习{主题}，请按以下框架输出：\n1. 核心概念（3-5个）\n2. 学习路径（分阶段）\n3. 推荐的实践项目\n4. 常见误区" },
  { title: "数据分析", template: "我有以下{数据描述}。请：\n1. 分析关键趋势\n2. 指出异常点\n3. 给出可操作的建议\n数据：{数据}" },
];

/** Prompt Checklist */
export const PROMPT_CHECKLIST = [
  "模型是否清楚自己的角色和任务？",
  "指令是否使用肯定句式，没有歧义？",
  "是否需要示例（Few-shot）来引导输出？",
  "输出格式是否明确指定？",
  "是否提供了足够的上下文和约束？",
  "复杂问题是否拆解为子任务？",
  "是否采用了逐步推理（CoT）策略？",
  "温度参数是否根据场景调整？",
  "是否使用了 MCP 提示资源复用通用模板？",
  "输出是否经过人类审查和校对？",
  "是否建立了 Prompt 版本管理？",
];

/** 生成式 AI 工具数据 */
export const GENAI_TOOL_CATEGORIES = [
  {
    name: "文本生成",
    icon: "💬",
    tools: [
      { name: "ChatGPT", desc: "OpenAI 旗舰对话模型，支持 GPT-4o / o3 推理，多模态理解", pricing: "免费 / Plus $20/月", use: "通用对话、写作、编程、分析" },
      { name: "Claude", desc: "Anthropic 注重安全与推理的对话助手，擅长长文档与代码", pricing: "免费 / Pro $20/月", use: "长文分析、技术写作、代码生成" },
      { name: "Gemini", desc: "Google 多模态大模型，深度整合 Google 生态与搜索增强", pricing: "免费 / Advanced $19.99/月", use: "搜索增强、多模态理解、Google 办公" },
      { name: "DeepSeek", desc: "DeepSeek 开源推理大模型，R1 系列推理能力突出", pricing: "免费 (网页/App) / API 按量计费", use: "推理任务、数学、编程、中文场景" },
      { name: "Grok", desc: "xAI 开发的对话模型，实时接入 X (Twitter) 数据", pricing: "X Premium+ $16/月", use: "实时信息分析、社交媒体、技术问答" },
      { name: "Mistral", desc: "Mistral AI 高效开源大模型，Le Chat 对话平台", pricing: "免费 / Pro 按量计费", use: "高效推理、多语言、企业部署" },
      { name: "文心一言", desc: "百度知识增强大语言模型", pricing: "免费 / 专业版 ¥59.9/月", use: "中文创作、知识问答、百度生态" },
      { name: "通义千问", desc: "阿里云推出的通义大模型系列", pricing: "免费 / 企业按量计费", use: "中文理解、阿里云集成、企业应用" },
    ],
  },
  {
    name: "图像生成",
    icon: "🎨",
    tools: [
      { name: "DALL·E 3", desc: "OpenAI 文本到图像生成，高精度遵循 Prompt", pricing: "含 ChatGPT Plus", use: "创意设计、概念图、插画" },
      { name: "Midjourney", desc: "顶级艺术风格图像生成，社区活跃", pricing: "$10-$60/月", use: "艺术创作、概念设计、游戏美术" },
      { name: "Stable Diffusion", desc: "开源图像生成模型，可本地部署与微调", pricing: "开源免费 / 云端按量计费", use: "自定义模型、商业部署、研究" },
      { name: "Flux", desc: "Black Forest Labs 高质量开源图像生成，媲美 Midjourney", pricing: "开源免费 / API 按量计费", use: "高质量图像生成、商业应用" },
      { name: "Ideogram", desc: "AI 图像生成，文字渲染能力领先", pricing: "免费 / Paid $20/月", use: "Logo 设计、海报文字、营销素材" },
      { name: "文心一格", desc: "百度 AI 艺术与创意辅助平台", pricing: "免费额度 + 按张计费", use: "中文创意设计、海报生成" },
    ],
  },
  {
    name: "视频生成",
    icon: "🎬",
    tools: [
      { name: "Sora", desc: "OpenAI 视频生成模型，可生成长达 60s 高清视频", pricing: "含 ChatGPT Plus/Pro", use: "创意短片、概念视频、广告" },
      { name: "Veo 3", desc: "Google DeepMind 视频生成模型，高质量物理模拟", pricing: "Vertex AI 按量计费", use: "专业视频制作、广告、影视前期" },
      { name: "Runway Gen-3", desc: "专业级 AI 视频生成与编辑平台", pricing: "$12-$76/月", use: "视频编辑、特效、内容创作" },
      { name: "Kling", desc: "快手可灵 AI 视频生成，中文场景表现突出", pricing: "免费 / 付费订阅", use: "短视频、中文内容、社交媒体" },
      { name: "Vidu", desc: "生数科技 AI 视频生成，支持图生视频", pricing: "免费 / 付费订阅", use: "创意视频、动态设计、短视频" },
    ],
  },
  {
    name: "代码生成",
    icon: "💻",
    tools: [
      { name: "GitHub Copilot", desc: "GitHub + OpenAI 联合打造，IDE 内代码补全与 Agent 模式", pricing: "$10/月 (个人) / $19/月 (企业)", use: "代码补全、函数生成、测试编写" },
      { name: "Cursor", desc: "AI-first 代码编辑器，深度集成对话式编程", pricing: "免费 / Pro $20/月", use: "全栈开发、代码审查、重构" },
      { name: "Cline / Roo Code", desc: "开源 AI 编码 Agent，支持 MCP 工具调用与自省式开发", pricing: "开源免费 (自带 API Key)", use: "自主编码、文件操作、浏览器自动化" },
      { name: "Windsurf", desc: "Codeium 推出的 AI 原生 IDE，流式协作编程", pricing: "免费 / Pro $15/月", use: "AI 协作编程、代码理解、重构" },
      { name: "Codeium", desc: "免费 AI 代码补全工具，支持 70+ 语言", pricing: "免费 / Teams $15/月", use: "个人开发、团队协作、多 IDE" },
    ],
  },
  {
    name: "音乐生成",
    icon: "🎵",
    tools: [
      { name: "Suno", desc: "AI 音乐生成，支持歌词与多种风格", pricing: "免费 / Pro $10/月", use: "歌曲创作、背景音乐、实验音乐" },
      { name: "Udio", desc: "高质量 AI 音乐生成平台", pricing: "免费 / 付费订阅", use: "专业音乐制作、配乐生成" },
    ],
  },
];

/** AI 安全与伦理主题 */
export const ETHICS_TOPICS = [
  {
    title: "AI 对齐 (Alignment)",
    desc: "确保 AI 系统的目标与人类价值观和意图相一致",
    icon: "target",
    details: [
      "RLHF (基于人类反馈的强化学习) 是对齐的核心技术",
      "超对齐 (Superalignment) 研究如何让超人类 AI 对齐人类价值",
      "价值锁定 (Value Lock-in) 问题：早期对齐决定可能被永久固化",
    ],
  },
  {
    title: "公平性 (Fairness)",
    desc: "消除 AI 系统中的偏见，确保公平对待所有群体",
    icon: "check",
    details: [
      "训练数据中的社会偏见可能被模型放大",
      "不同种族、性别、地域群体的表现差异需要监控",
      "Fairness 指标：均等机会、人口平等、均等化赔率",
    ],
  },
  {
    title: "可解释性 (Explainability)",
    desc: "让 AI 决策过程透明、可理解和可审计",
    icon: "lightbulb",
    details: [
      "XAI (可解释 AI) 研究如何解释模型内部运作",
      "SHAP / LIME 是目前最常用的解释方法",
      "黑箱 vs 白箱模型在监管场景中的权衡",
    ],
  },
  {
    title: "隐私保护 (Privacy)",
    desc: "保护用户数据隐私，防止 AI 系统泄露敏感信息",
    icon: "shield",
    details: [
      "联邦学习在不共享原始数据前提下训练模型",
      "差分隐私在训练过程中注入噪声保护个体数据",
      "数据投毒攻击：恶意数据影响模型输出",
    ],
  },
  {
    title: "安全性 (Safety)",
    desc: "防范恶意使用、对抗攻击和灾难性风险",
    icon: "alert",
    details: [
      "Prompt 注入：恶意指令绕过安全限制",
      "对抗样本：微小的输入扰动导致模型误判",
      "红队测试：系统性地寻找模型的安全漏洞",
    ],
  },
];

export const ETHICS_CASES = [
  {
    title: "微软 Tay 聊天机器人",
    lesson: "上线仅 24 小时即被恶意操控生成极端言论，暴露 AI 被恶意利用的风险",
    source: "2016",
  },
  {
    title: "COMPAS 再犯风险评估",
    lesson: "算法对不同种族群体的预测偏差引发公平性争议",
    source: "2016",
  },
  {
    title: "Deepfakes 滥用",
    lesson: "深度伪造技术用于制作虚假视频，引发社会信任危机",
    source: "2017-至今",
  },
  {
    title: "ChatGPT 幻觉问题",
    lesson: "模型生成虚假信息但表现得确信无疑，误导用户",
    source: "2023",
  },
  {
    title: "AI 操纵选举争议",
    lesson: "生成式 AI 被用于制作虚假政治宣传，多国出台 AI 选举监管法规",
    source: "2024",
  },
  {
    title: "AI 版权诉讼浪潮",
    lesson: "New York Times 等版权方起诉 OpenAI，引发训练数据版权全球性讨论",
    source: "2023-至今",
  },
];

export const RESPONSIBLE_AI_PRINCIPLES = [
  "透明度：向用户明确说明 AI 的功能与局限",
  "问责制：明确 AI 决策的责任归属",
  "公平性：定期审计模型对弱势群体的影响",
  "隐私优先：最小化数据收集，实施数据保护",
  "安全性：通过红队测试和边界测试确保安全",
  "人类控制：关键决策保留人类判断权",
  "持续监控：部署后持续监测模型漂移和异常",
];
