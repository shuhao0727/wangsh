export interface AgentLearningProgress {
  stages: {
    stage: number;
    name: string;
    completed: number;
    total: number;
    status: "not_started" | "in_progress" | "completed";
  }[];
  overall_progress: number;
  total_completed: number;
  total_items: number;
  notes?: string;
}

// Tab 1: 学习路线图
export const roadmapStages = [
  {
    stage: 1,
    period: "1-2 月",
    title: "Agent 基础概念",
    color: "var(--ws-color-primary)",
    badge: "入门",
    badgeVariant: "info" as const,
    items: [
      "理解 Agent 定义、核心特征与分类",
      "区分 AI Agent 与传统程序、RPA 的本质差异",
      "掌握 Agent 的感知-决策-行动循环模型",
      "了解 LLM-based Agent 的基础架构",
      "阅读经典论文：Lilian Weng 的 Agent 综述",
      "小项目：用 OpenAI API 实现一个简单对话 Agent",
    ],
    projects: [
      "实现 CLI 版简单问答 Agent",
      "用 LangChain 调用 LLM 完成结构化输出",
    ],
  },
  {
    stage: 2,
    period: "3-4 月",
    title: "单 Agent 开发",
    color: "var(--ws-color-info)",
    badge: "基础",
    badgeVariant: "info" as const,
    items: [
      "掌握 Prompt Engineering：角色、上下文、示例、约束四层结构",
      "学习 Tool Use / Function Calling：定义工具、自动路由",
      "理解 RAG 技术：文档分块、向量检索、检索增强生成",
      "掌握 ReAct 推理模式：思考-行动-观察循环",
      "学习 Agent 记忆系统：会话记忆、持久化记忆",
      "项目：开发一个知识库问答 RAG Agent",
    ],
    projects: [
      "天气查询 Agent（Function Calling）",
      "个人知识库 RAG Agent",
      "带记忆的 Multi-Turn 对话 Agent",
    ],
  },
  {
    stage: 3,
    period: "5-8 月",
    title: "多 Agent 系统",
    color: "var(--ws-color-warning)",
    badge: "进阶",
    badgeVariant: "warning" as const,
    items: [
      "理解多 Agent 协作模式：主管-专家、流水线、辩论",
      "学习 Agent 间通信协议：消息传递、共享记忆、事件驱动",
      "掌握任务编排：DAG 工作流、条件分支、递归分解",
      "学习 CrewAI / AutoGen 等多 Agent 框架",
      "研究 Agent 社会模拟：角色分配、行为博弈",
      "项目：构建多 Agent 辩论与共识系统",
    ],
    projects: [
      "主管+专家 Agent 编程团队",
      "多 Agent 内容审核系统",
      "Agent 辩论法庭模拟",
    ],
  },
  {
    stage: 4,
    period: "9-12 月",
    title: "生产级 Agent",
    color: "var(--ws-color-error)",
    badge: "高级",
    badgeVariant: "destructive" as const,
    items: [
      "Agent 部署架构：容器化、Serverless、GPU 调度",
      "监控与可观测性：Trace、Metric、Log",
      "Agent 评测体系：自动化测试、Benchmark、A/B 测试",
      "安全与对齐：提示注入防护、输出过滤、权限管理",
      "缓存与优化：Prompt Cache、KV Cache、请求合并",
      "项目：部署一个企业级 Agent 服务平台",
    ],
    projects: [
      "Agent 性能监控 Dashboard",
      "安全 Agent 的提示注入攻防实验",
      "端到端 Agent 自动化评测流水线",
    ],
  },
  {
    stage: 5,
    period: "12 月+",
    title: "前沿探索",
    color: "var(--ws-color-accent)",
    badge: "前沿",
    badgeVariant: "purple" as const,
    items: [
      "自治 Agent：长期目标规划、自我反思、迭代改进",
      "Agent 社会：多 Agent 经济模拟、社交网络模拟",
      "具身 Agent：机器人 + LLM、GUI Agent（Computer Use）",
      "AGI 探索：Agent 作为通向 AGI 的路径",
      "MCP 与 A2A 协议：标准化 Agent 互操作",
      "跟进最新论文与开源项目",
    ],
    projects: [
      "自治研究 Agent（自动搜索、阅读、总结论文）",
      "GUI Agent 浏览器自动化",
      "参与开源 Agent 项目贡献",
    ],
  },
];

// Tab 2: 知识体系数据
export const agentCoreArchitecture = [
  { step: "感知 (Perception)", desc: "接收多模态输入：文本、语音、图像、结构化数据", icon: "👁️" },
  { step: "规划 (Planning)", desc: "任务分解、路径规划、资源分配、目标设定", icon: "🧠" },
  { step: "记忆 (Memory)", desc: "短期记忆（上下文）、长期记忆（向量库、关系库）", icon: "💾" },
  { step: "执行 (Execution)", desc: "调用工具、执行代码、调用 API、与外部系统交互", icon: "⚡" },
  { step: "工具 (Tools)", desc: "Function Calling、MCP 协议、自定义工具、Web 搜索", icon: "🔧" },
];

export const agentTypeComparison = [
  {
    type: "反应式 Agent",
    desc: "基于规则/条件反射响应，无内部状态",
    pros: ["响应快", "资源消耗低", "行为可预期"],
    cons: ["无学习能力", "无法处理复杂任务", "缺乏灵活性"],
    example: "Siri 简单指令、FAQ 聊天机器人",
    color: "var(--ws-color-info)",
  },
  {
    type: "认知式 Agent",
    desc: "包含记忆、推理、规划模块的自主系统",
    pros: ["强推理能力", "支持长期目标规划", "可自我迭代"],
    cons: ["资源消耗高", "推理延迟大", "设计复杂"],
    example: "AutoGPT、BabyAGI 类系统",
    color: "var(--ws-color-warning)",
  },
  {
    type: "LLM-based Agent",
    desc: "以大语言模型为核心，工具调用驱动",
    pros: ["自然语言交互", "零样本学习", "工具生态丰富"],
    cons: ["幻觉问题", "Token 成本高", "推理不可控"],
    example: "Claude Computer Use、ChatGPT Plugins、ReAct Agent",
    color: "var(--ws-color-primary)",
  },
  {
    type: "学习型 Agent",
    desc: "通过强化学习/模仿学习持续优化策略",
    pros: ["可自我改进", "适应动态环境", "长期性能提升"],
    cons: ["训练成本高", "奖励函数设计困难", "收敛不稳定"],
    example: "Deep RL Agent、RLHF 优化的对话 Agent",
    color: "var(--ws-color-success)",
  },
  {
    type: "多模态 Agent",
    desc: "融合文本、图像、语音、视频等多模态输入输出",
    pros: ["感知维度丰富", "交互方式自然", "适用场景广"],
    cons: ["模态对齐困难", "计算开销大", "数据标注复杂"],
    example: "GPT-4V Agent、Claude 视觉 Agent、具身 Agent",
    color: "var(--ws-color-accent)",
  },
];

// Tab 3: 核心技术分析
export const coreTechs = [
  {
    title: "Prompt Engineering",
    icon: "scroll-text",
    color: "var(--ws-color-primary)",
    desc: "引导 LLM 行为的核心技能，四层递进结构",
    levels: [
      { name: "角色设定", desc: "定义 Agent 身份、语气、知识边界" },
      { name: "上下文注入", desc: "提供背景信息、历史记录、相关数据" },
      { name: "示例引导", desc: "Few-shot 示例、Chain-of-Thought 模板" },
      { name: "约束规则", desc: "输出格式、行为边界、安全过滤" },
    ],
    bestFor: "所有 Agent 开发者的必备基础技能",
  },
  {
    title: "RAG 技术",
    icon: "database",
    color: "var(--ws-color-info)",
    desc: "检索增强生成，赋予 Agent 外部知识能力",
    steps: ["文档加载与分块", "向量 Embedding", "向量数据库存储", "语义检索", "检索结果增强 Prompt"],
    bestFor: "知识库问答、文档分析、事实性任务",
  },
  {
    title: "推理模式",
    icon: "brain",
    color: "var(--ws-color-warning)",
    desc: "五种主流推理模式，让 Agent 具备深度思考能力",
    modes: [
      { name: "CoT", desc: "思维链 —— 逐步推理", use: "数学、逻辑问题" },
      { name: "ReAct", desc: "思考-行动-观察循环", use: "工具调用 Agent" },
      { name: "ToT", desc: "思维树 —— 多路径探索", use: "创意生成、复杂规划" },
      { name: "Reflexion", desc: "自我反思与修正", use: "代码生成、写作" },
      { name: "Plan-and-Solve", desc: "先规划后执行", use: "复杂多步骤任务" },
    ],
    bestFor: "数学推理、逻辑分析、代码生成等深度思考场景",
  },
  {
    title: "记忆系统",
    icon: "layers",
    color: "var(--ws-color-success)",
    desc: "四种记忆类型支撑 Agent 持续交互能力",
    memories: [
      { name: "工作记忆", desc: "当前对话上下文（Token Window）", duration: "瞬时" },
      { name: "情景记忆", desc: "历史交互记录、对话摘要", duration: "会话级" },
      { name: "语义记忆", desc: "知识图谱、向量库存储的事实知识", duration: "长期" },
      { name: "程序记忆", desc: "技能、工具使用方式、执行流程", duration: "持久" },
    ],
    bestFor: "需要长期对话与持续学习的 Agent",
  },
  {
    title: "工具调用",
    icon: "puzzle",
    color: "var(--ws-color-error)",
    desc: "Agent 连接外部世界的能力",
    protocols: [
      { name: "Function Calling", desc: "OpenAI 原生函数调用协议", style: "API 原生" },
      { name: "MCP 协议", desc: "Model Context Protocol，标准化工具接入", style: "开放标准" },
      { name: "自定义工具", desc: "自己实现 REST/GraphQL 工具包装", style: "灵活" },
      { name: "Web 搜索", desc: "集成搜索引擎 API 获取实时信息", style: "实时" },
    ],
    bestFor: "Agent 获得外部执行能力的关键技术",
  },
  {
    title: "多 Agent 协作",
    icon: "users",
    color: "var(--ws-color-accent)",
    desc: "多个 Agent 协同解决复杂任务",
    patterns: [
      { name: "主管-专家", desc: "一个主管 Agent 协调多个专家 Agent", use: "复杂任务分解" },
      { name: "流水线", desc: "Agent 链式处理，每个处理一个步骤", use: "数据处理流水线" },
      { name: "辩论", desc: "多个 Agent 正反辩论提升质量", use: "决策分析" },
      { name: "群体智能", desc: "多 Agent 投票/共识机制达成决策", use: "预测、评测" },
      { name: "去中心化 DAG", desc: "基于有向无环图的任务编排", use: "复杂工作流" },
    ],
    bestFor: "超越单 Agent 能力边界的复杂任务",
  },
];

// Tab 4: 框架对比
export const frameworkData = [
  {
    name: "LangChain",
    desc: "最流行的 Agent 开发框架，生态丰富",
    ease: "中等",
    completeness: "★★★★★",
    curve: "中等",
    scenario: "通用开发、原型快速搭建",
    githubStars: "105k+",
    color: "var(--ws-color-primary)",
  },
  {
    name: "CrewAI",
    desc: "专注多 Agent 协作，简单易用",
    ease: "简单",
    completeness: "★★★★",
    curve: "低",
    scenario: "多 Agent 协作任务、角色扮演",
    githubStars: "28k+",
    color: "var(--ws-color-info)",
  },
  {
    name: "AutoGen",
    desc: "微软开源，多 Agent 对话框架",
    ease: "中等",
    completeness: "★★★★★",
    curve: "中高",
    scenario: "多 Agent 对话、代码生成",
    githubStars: "42k+",
    color: "var(--ws-color-warning)",
  },
  {
    name: "MetaGPT",
    desc: "元编程框架，模拟软件公司协作",
    ease: "中等",
    completeness: "★★★★",
    curve: "中等",
    scenario: "软件工程自动化、角色扮演",
    githubStars: "18k+",
    color: "var(--ws-color-success)",
  },
  {
    name: "OpenAI Agents SDK",
    desc: "OpenAI 官方 Agent 开发套件",
    ease: "简单",
    completeness: "★★★★",
    curve: "低",
    scenario: "OpenAI 生态 Agent 开发",
    githubStars: "22k+",
    color: "var(--ws-color-error)",
  },
  {
    name: "Dify",
    desc: "可视化 Agent 工作流搭建平台",
    ease: "简单",
    completeness: "★★★★",
    curve: "低",
    scenario: "非开发者快速搭建 Agent 应用",
    githubStars: "90k+",
    color: "#8B5CF6",
  },
  {
    name: "Semantic Kernel",
    desc: "微软 AI 编排 SDK，企业级集成",
    ease: "较难",
    completeness: "★★★★★",
    curve: "高",
    scenario: ".NET/Azure 企业集成",
    githubStars: "25k+",
    color: "#06B6D4",
  },
  {
    name: "Camel",
    desc: "多 Agent 研究框架，角色扮演探索",
    ease: "中等",
    completeness: "★★★",
    curve: "中等",
    scenario: "Agent 社会研究、角色模拟",
    githubStars: "7k+",
    color: "#F97316",
  },
  {
    name: "AutoGPT",
    desc: "自治 Agent 先驱，全自动任务执行",
    ease: "中等",
    completeness: "★★★",
    curve: "中等",
    scenario: "全自动任务、自主研究",
    githubStars: "172k+",
    color: "#10B981",
  },
  {
    name: "BabyAGI",
    desc: "轻量级任务驱动自治 Agent",
    ease: "简单",
    completeness: "★★",
    curve: "低",
    scenario: "学习 Agent 原理、轻量任务",
    githubStars: "21k+",
    color: "#F43F5E",
  },
  {
    name: "Agno",
    desc: "新一代轻量级 Agent 框架",
    ease: "简单",
    completeness: "★★★",
    curve: "低",
    scenario: "快速原型、轻量 Agent 开发",
    githubStars: "24k+",
    color: "var(--ws-color-accent)",
  },
  {
    name: "Smolagents",
    desc: "Hugging Face 开源轻量 Agent 框架",
    ease: "简单",
    completeness: "★★★",
    curve: "低",
    scenario: "Hugging Face 生态、模型集成",
    githubStars: "18k+",
    color: "#FFB347",
  },
  {
    name: "Pydantic AI",
    desc: "基于 Pydantic 的类型安全 Agent 框架",
    ease: "中等",
    completeness: "★★★★",
    curve: "中等",
    scenario: "类型安全 Agent、企业级 Python 应用",
    githubStars: "12k+",
    color: "#E92063",
  },
];

// Tab 5: 动手实验
export const experimentLevels = [
  {
    level: "入门级",
    badge: "beginner",
    badgeVariant: "info" as const,
    icon: "rocket",
    color: "var(--ws-color-primary)",
    items: [
      { name: "天气查询 Agent", desc: "调用天气 API，Function Calling 入门", tech: "OpenAI + 天气API" },
      { name: "翻译 Agent", desc: "多语言翻译 + 语言检测", tech: "LLM Prompt" },
      { name: "计算器 Agent", desc: "数学计算 + Tool Use", tech: "OpenAI + Python" },
      { name: "网页搜索 Agent", desc: "集成搜索引擎，实时信息查询", tech: "SerpAPI + LLM" },
    ],
  },
  {
    level: "中级",
    badge: "intermediate",
    badgeVariant: "warning" as const,
    icon: "bar-chart",
    color: "var(--ws-color-warning)",
    items: [
      { name: "RAG 知识库 Agent", desc: "上传文档 → 向量化 → 语义检索回答", tech: "LangChain + Chroma" },
      { name: "多工具协作 Agent", desc: "组合搜索、计算、数据库等工具", tech: "LangChain + 多 Tool" },
      { name: "记忆持久化 Agent", desc: "长期记忆 + 个性化对话", tech: "Mem0 + Vector DB" },
      { name: "数据分析 Agent", desc: "自然语言查数据库、生成图表", tech: "Text-to-SQL + 可视化" },
    ],
  },
  {
    level: "高级",
    badge: "advanced",
    badgeVariant: "destructive" as const,
    icon: "cpu",
    color: "var(--ws-color-error)",
    items: [
      { name: "多 Agent 辩论系统", desc: "正反方辩论提升决策质量", tech: "AutoGen / CrewAI" },
      { name: "Agent 自动编码", desc: "自然语言需求 → 代码生成 → 测试", tech: "MetaGPT / Claude" },
      { name: "Agent 数据分析流水线", desc: "Agent 编排 ETL 流程", tech: "LangGraph + Pandas" },
      { name: "内容创作 Agent", desc: "多 Agent 协作：调研→ 撰写 → 配图", tech: "CrewAI + DALL-E" },
    ],
  },
  {
    level: "专家级",
    badge: "expert",
    badgeVariant: "purple" as const,
    icon: "trophy",
    color: "var(--ws-color-accent)",
    items: [
      { name: "企业级 Agent 平台", desc: "多 Agent 调度 + 监控 + 权限管理", tech: "K8s + LangServe" },
      { name: "多模态 Agent", desc: "文本 + 图像 + 语音综合处理", tech: "GPT-4V + Whisper" },
      { name: "自治研究 Agent", desc: "自动搜索 → 阅读 → 总结论文", tech: "AutoGPT + ArXiv" },
      { name: "GUI Agent", desc: "视觉定位 + 操作浏览器/桌面应用", tech: "Claude Computer Use" },
    ],
  },
];

// Tab 6: 默认进度数据（fallback）
export const defaultProgress: AgentLearningProgress = {
  stages: [
    { stage: 1, name: "Agent 基础概念", completed: 0, total: 8, status: "not_started" },
    { stage: 2, name: "单 Agent 开发", completed: 0, total: 7, status: "not_started" },
    { stage: 3, name: "多 Agent 系统", completed: 0, total: 7, status: "not_started" },
    { stage: 4, name: "生产级 Agent", completed: 0, total: 7, status: "not_started" },
    { stage: 5, name: "前沿探索", completed: 0, total: 7, status: "not_started" },
  ],
  overall_progress: 0,
  total_completed: 0,
  total_items: 36,
};
