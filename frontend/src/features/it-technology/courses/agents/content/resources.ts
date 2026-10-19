import type { ResourceItem } from "./types";

// ─── Tab 8: 学习资源 ────────────────────────────────────────────────────

export const RESOURCES_DATA: ResourceItem[] = [
  // ── 书籍 ───────────────────────────────────────
  {
    title: "《Build a Large Language Model (From Scratch)》",
    type: "book",
    description: "Sebastian Raschka 著，从零理解 LLM 内部机制——Attention、Transformer、预训练、指令微调、RLHF，配有完整可运行代码。理解 LLM 内部原理是掌控 Agent 行为的基础。",
    url: "https://www.manning.com/books/build-a-large-language-model-from-scratch",
    rating: 5,
    difficulty_level: "intermediate",
    best_for: "希望从原理层面理解 LLM，而非仅调用 API 的 Agent 开发者",
  },
  {
    title: "《Developing Apps with GPT-4 and ChatGPT》",
    type: "book",
    description: "Olivier Caelen & Marie-Alice Blete 著，O'Reilly 出版。从 LLM 基础到 Agent 架构、工具调用、RAG 流水线和生产部署的实践指南，代码导向。",
    url: "https://www.oreilly.com/library/view/developing-apps-with/9781098152482/",
    rating: 4,
    difficulty_level: "intermediate",
    best_for: "动手型学习者，希望快速将 LLM 集成到实际应用中的开发者",
  },
  // ── 课程 ───────────────────────────────────────
  {
    title: "DeepLearning.AI — Functions, Tools and Agents with LangChain",
    type: "course",
    description: "吴恩达与 Harrison Chase 联合授课，系统讲解 LangChain 中的 Agent 概念、工具调用、ReAct 推理和多步推理，是 Agent 入门的权威课程。",
    url: "https://www.deeplearning.ai/short-courses/functions-tools-agents-langchain/",
    rating: 5,
    difficulty_level: "beginner",
    best_for: "零基础 Agent 学习入门，理解 LLM Agent 核心范式",
  },
  {
    title: "DeepLearning.AI — Multi AI Agent Systems with crewAI",
    type: "course",
    description: "学习如何使用 CrewAI 构建多 Agent 协作系统，覆盖角色定义、任务分配、Sequential/Hierarchical 执行策略和 Agent 间通信。",
    url: "https://www.deeplearning.ai/short-courses/multi-ai-agent-systems-with-crewai/",
    rating: 5,
    difficulty_level: "intermediate",
    best_for: "希望系统学习多 Agent 协作模式的学习者",
  },
  // ── 论文 ───────────────────────────────────────
  {
    title: "ReAct: Synergizing Reasoning and Acting in Language Models (2023)",
    type: "paper",
    description: "Yao et al. 提出 ReAct 范式——推理与行动交替，显著提升 LLM 在知识密集和决策类任务上的表现。Agent 推理循环的奠基性工作。",
    url: "https://arxiv.org/abs/2210.03629",
    rating: 5,
    difficulty_level: "advanced",
    best_for: "理解 Agent 推理核心机制，所有 Agent 开发者的必读论文",
  },
  {
    title: "A Survey on LLM-based Autonomous Agents (2023)",
    type: "paper",
    description: "Wang et al. (人大) 的系统性综述，提出 Profile-Memory-Planning-Action 四模块 Agent 架构体系，梳理了 LLM Agent 的完整技术栈与评估方法。",
    url: "https://arxiv.org/abs/2308.11432",
    rating: 5,
    difficulty_level: "intermediate",
    best_for: "建立 Agent 技术的全局视野，理解各模块之间的关联",
  },
  // ── 网站 ───────────────────────────────────────
  {
    title: "Lilian Weng's Blog — LLM Powered Autonomous Agents",
    type: "website",
    description: "OpenAI 研究员 Lilian Weng 关于 LLM Agent 的深度技术博客，系统讲解 Agent 的规划、记忆和工具使用三大核心组件，被誉为 Agent 领域最好的技术综述。",
    url: "https://lilianweng.github.io/posts/2023-06-23-agent/",
    rating: 5,
    difficulty_level: "intermediate",
    best_for: "所有希望深入理解 Agent 系统设计的研究者和工程师",
  },
  {
    title: "Anthropic Research Blog —  Agent 相关",
    type: "website",
    description: "Anthropic 官方研究博客，发布 Claude Computer Use、MCP 协议、Tool Use 最佳实践、Constitutional AI 等 Agent 前沿研究。追踪 Agent 安全与工程实践的权威来源。",
    url: "https://www.anthropic.com/research",
    rating: 5,
    difficulty_level: "intermediate",
    best_for: "关注 Agent 安全、MCP 生态和前沿实践的开发者",
  },
  // ── GitHub ───────────────────────────────────────
  {
    title: "awesome-llm-agents",
    type: "github",
    description: "GitHub 上最全面的 LLM Agent 资源汇总，收录论文、框架、工具、教程和社区项目，定期更新。一站式了解 Agent 生态全貌。",
    url: "https://github.com/hyp1231/awesome-llm-powered-agent",
    rating: 5,
    difficulty_level: "beginner",
    best_for: "快速了解 Agent 领域全貌，寻找合适工具和参考资料",
  },
  {
    title: "MCP Official Documentation & Examples",
    type: "github",
    description: "Anthropic 官方 MCP 协议规范、SDK 源码和示例仓库。包含 Python/TypeScript SDK、MCP Inspector 调试工具和社区贡献的 MCP Server 集合。",
    url: "https://github.com/modelcontextprotocol",
    rating: 5,
    difficulty_level: "intermediate",
    best_for: "学习 MCP 协议、开发自定义 MCP Server、参与标准制定",
  },
];
